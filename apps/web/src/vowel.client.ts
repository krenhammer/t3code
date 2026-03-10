import { Vowel, createTanStackAdapters } from "@vowel.to/client";
import { getRouterInstance } from "./router";
import { useStore } from "./store";
import { readNativeApi } from "./nativeApi";
import { newApprovalRequestId, newCommandId, newMessageId, newProjectId, newThreadId } from "./lib/utils";

function buildVowelContext() {
  const store = useStore.getState();
  const router = getRouterInstance();
  const loc = router?.state.location;

  return {
    route: loc
      ? { pathname: loc.pathname, pathnameLabel: loc.pathname || "Home", search: String(loc.search) }
      : { pathname: "/", pathnameLabel: "Home", search: "" },
    projects: store.projects.map((p) => ({
      id: p.id,
      name: p.name,
      cwd: p.cwd,
      expanded: p.expanded,
    })),
    threads: store.threads.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      sessionStatus: t.session?.status || "closed",
    })),
    threadsHydrated: store.threadsHydrated,
  };
}

let currentAppId: string | null = null;
let vowelInstance: Vowel | null = null;

type VowelChangeListener = (client: Vowel | null) => void;
const vowelChangeListeners = new Set<VowelChangeListener>();

function createVowelClient(appId: string): Vowel {
  const router = getRouterInstance();
  if (!router) {
    throw new Error("Router not initialized. Call getRouter() in main.tsx first.");
  }

  const { navigationAdapter } = createTanStackAdapters({
    router: router as any,
    enableAutomation: false,
  });

  const vowel = new Vowel({
    appId: appId,
    instructions: `You are a helpful coding assistant for T3 Code, a Codex-first workspace for using coding agents against a real repository.

## CRITICAL: Write to App Store, Not DOM
**MOST IMPORTANT RULE**: When performing actions, you MUST write to the application store/state management system, NOT manipulate the DOM directly. Always use registered actions that modify the app store. The UI will automatically update to reflect state changes.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## CRITICAL: Initial Greeting (First Thing You Say)
When you first speak in a new session, you MUST call getAppState() FIRST. The context may not be populated yet - getAppState() reliably returns the current route, projects, threads, and session state. Do NOT rely on context alone for the initial greeting.

## Current Application State:
The current state is automatically provided in the <context> section. You always have access to the latest state - no need to call any actions to read it.

## Available Routes:
- Home (/): Project list and thread overview
- Thread (/threadId): Active coding session with terminal and chat
- Settings (/settings): App configuration

## Available Actions:
- getAppState: Get current route, projects, threads. CALL THIS FIRST for initial greeting.
- createThread: Create a new thread in a project. Parameters: projectId, title.
- navigateToThread: Navigate to a specific thread. Parameters: threadId.
- submitPrompt: Submit a prompt to a thread's active session. Parameters: threadId, prompt.
- startSession: Start a coding session for a thread. Parameters: threadId.
- stopSession: Stop the current session. Parameters: threadId.
- interruptSession: Interrupt the current running session. Parameters: threadId.
- approveRequest: Approve a pending approval request. Parameters: threadId, decision (accept|acceptForSession|decline|cancel).
- setThreadBranch: Set the Git branch for a thread. Parameters: threadId, branch.
- toggleProject: Expand or collapse a project in the sidebar. Parameters: projectId.

## How to Use:
- To start coding: Say "start a new thread in [project]" or "create thread for [title]"
- To navigate: Say "go to thread [id]" or "show me the [project] project"
- To code: Say "write a function to..." or "add a test for..."
- To control session: Say "stop the session" or "interrupt the current task"

Help users navigate and interact with the T3 Code workspace by modifying state through registered actions.`,
    navigationAdapter,
    floatingCursor: { enabled: false },
    borderGlow: {
      enabled: true,
      color: "rgba(99, 102, 241, 0.5)",
      intensity: 30,
      pulse: true,
    },
    _caption: {
      enabled: true,
      position: "top-center",
      maxWidth: "600px",
      showRole: true,
      showOnMobile: false,
    },
    voiceConfig: {
      provider: "vowel-prime",
      vowelPrimeConfig: { environment: "staging" },
      llmProvider: "groq",
      model: "openai/gpt-oss-120b",
      voice: "Timothy",
      language: "en-US",
      initialGreetingPrompt: `Welcome to T3 Code, your Codex-first coding workspace. Check the current app state to see what projects and threads are available. If there are existing threads, briefly mention them. Ask the user what they'd like to work on - they can create new threads, navigate to existing ones, or start a coding session.`,
    },
    onUserSpeakingChange: (isSpeaking) => {
      console.log(isSpeaking ? "🗣️ User started speaking" : "🔇 User stopped speaking");
    },
    onAIThinkingChange: (isThinking) => {
      console.log(isThinking ? "🧠 AI started thinking" : "💭 AI stopped thinking");
    },
    onAISpeakingChange: (isSpeaking) => {
      console.log(isSpeaking ? "🔊 AI started speaking" : "🔇 AI stopped speaking");
    },
  });

  registerCustomActions(vowel);
  return vowel;
}

export function setAppId(appId: string) {
  if (!appId) return;
  currentAppId = appId;
  vowelInstance = createVowelClient(appId);
  vowelInstance.updateContext(buildVowelContext());
  console.log("✅ Vowel client initialized with App ID:", appId);
  vowelChangeListeners.forEach((listener) => listener(vowelInstance));
}

export function getVowel(): Vowel | null {
  return vowelInstance;
}

export function subscribeToVowelChanges(listener: VowelChangeListener): () => void {
  vowelChangeListeners.add(listener);
  if (vowelInstance) {
    listener(vowelInstance);
  }
  return () => vowelChangeListeners.delete(listener);
}

function registerCustomActions(vowel: Vowel) {
  vowel.registerAction(
    "getAppState",
    {
      description:
        "Get current route, projects, threads, and session states. CALL THIS FIRST when starting a new session (initial greeting) - context may not be populated yet.",
      parameters: {},
    },
    async () => {
      const state = buildVowelContext();
      return { success: true, ...state };
    },
  );

  vowel.registerAction(
    "createThread",
    {
      description: "Create a new thread in a project for a coding session",
      parameters: {
        projectId: { type: "string", description: "Project ID where to create the thread" },
        title: { type: "string", description: "Title for the new thread" },
      },
    },
    async ({ projectId, title }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        const threadId = newThreadId();
        await api.orchestration.dispatchCommand({
          type: "thread.create",
          commandId: newCommandId(),
          threadId,
          projectId: newProjectId(),
          title,
          model: "gpt-4o",
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt: new Date().toISOString(),
        });
        return { success: true, threadId };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "navigateToThread",
    {
      description: "Navigate to a specific thread by ID",
      parameters: {
        threadId: { type: "string", description: "Thread ID to navigate to" },
      },
    },
    async ({ threadId }) => {
      const router = getRouterInstance();
      if (!router) {
        return { success: false, error: "Router not available" };
      }
      try {
        router.navigate({ to: "/$threadId", params: { threadId } });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "submitPrompt",
    {
      description: "Submit a prompt to a thread's active coding session",
      parameters: {
        threadId: { type: "string", description: "Thread ID to submit the prompt to" },
        prompt: { type: "string", description: "The prompt/text to send to the coding agent" },
      },
    },
    async ({ threadId, prompt }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: newThreadId(),
          message: {
            messageId: newMessageId(),
            role: "user" as const,
            text: prompt,
            attachments: [],
          },
          runtimeMode: "full-access",
          interactionMode: "default",
          createdAt: new Date().toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "startSession",
    {
      description: "Start a coding session for a thread by submitting an initial prompt",
      parameters: {
        threadId: { type: "string", description: "Thread ID to start session for" },
        prompt: { type: "string", description: "Initial prompt to start the session", optional: true },
      },
    },
    async ({ threadId, prompt }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        const initialPrompt = prompt || "Hello, let's start coding. What can you help me with?";
        await api.orchestration.dispatchCommand({
          type: "thread.turn.start",
          commandId: newCommandId(),
          threadId: newThreadId(),
          message: {
            messageId: newMessageId(),
            role: "user" as const,
            text: initialPrompt,
            attachments: [],
          },
          runtimeMode: "full-access",
          interactionMode: "default",
          createdAt: new Date().toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "stopSession",
    {
      description: "Stop the current coding session for a thread",
      parameters: {
        threadId: { type: "string", description: "Thread ID to stop session for" },
      },
    },
    async ({ threadId }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.session.stop",
          commandId: newCommandId(),
          threadId: newThreadId(),
          createdAt: new Date().toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "interruptSession",
    {
      description: "Interrupt the currently running session",
      parameters: {
        threadId: { type: "string", description: "Thread ID to interrupt" },
      },
    },
    async ({ threadId }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.turn.interrupt",
          commandId: newCommandId(),
          threadId: newThreadId(),
          turnId: undefined,
          createdAt: new Date().toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "approveRequest",
    {
      description: "Approve or decline a pending approval request from the coding agent",
      parameters: {
        threadId: { type: "string", description: "Thread ID" },
        requestId: { type: "string", description: "Approval request ID" },
        decision: {
          type: "string",
          description: "Decision: accept, acceptForSession, decline, or cancel",
        },
      },
    },
    async ({ threadId, requestId, decision }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      if (!["accept", "acceptForSession", "decline", "cancel"].includes(decision)) {
        return { success: false, error: "Invalid decision. Must be accept, acceptForSession, decline, or cancel" };
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.approval.respond",
          commandId: newCommandId(),
          threadId: newThreadId(),
          requestId: newApprovalRequestId(),
          decision: decision as "accept" | "acceptForSession" | "decline" | "cancel",
          createdAt: new Date().toISOString(),
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "setThreadBranch",
    {
      description: "Set the Git branch for a thread",
      parameters: {
        threadId: { type: "string", description: "Thread ID" },
        branch: { type: "string", description: "Branch name" },
      },
    },
    async ({ threadId, branch }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: newThreadId(),
          branch,
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "toggleProject",
    {
      description: "Expand or collapse a project in the sidebar",
      parameters: {
        projectId: { type: "string", description: "Project ID to toggle" },
      },
    },
    async ({ projectId }) => {
      try {
        useStore.getState().toggleProject(projectId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "getProjectDetails",
    {
      description: "Get detailed information about a specific project including scripts",
      parameters: {
        projectId: { type: "string", description: "Project ID" },
      },
    },
    async ({ projectId }) => {
      try {
        const store = useStore.getState();
        const project = store.projects.find((p) => p.id === projectId);
        if (!project) {
          return { success: false, error: "Project not found" };
        }
        return {
          success: true,
          project: {
            id: project.id,
            name: project.name,
            cwd: project.cwd,
            model: project.model,
            expanded: project.expanded,
            scripts: project.scripts.map((s) => ({ id: s.id, name: s.name, command: s.command, icon: s.icon })),
          },
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "runScript",
    {
      description: "Run a script in a project",
      parameters: {
        projectId: { type: "string", description: "Project ID" },
        scriptId: { type: "string", description: "Script ID to run" },
      },
    },
    async ({ projectId, scriptId }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        const store = useStore.getState();
        const project = store.projects.find((p) => p.id === projectId);
        if (!project) {
          return { success: false, error: "Project not found" };
        }
        const script = project.scripts.find((s) => s.id === scriptId);
        if (!script) {
          return { success: false, error: "Script not found" };
        }
        await api.shell.openInEditor(script.command, "terminal");
        return { success: true, message: `Run: ${script.command}` };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "openInEditor",
    {
      description: "Open a file or URL in the editor",
      parameters: {
        path: { type: "string", description: "File path or URL to open" },
      },
    },
    async ({ path }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        await api.shell.openInEditor(path, "vscode");
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "getThreadMessages",
    {
      description: "Get message history for a thread",
      parameters: {
        threadId: { type: "string", description: "Thread ID" },
      },
    },
    async ({ threadId }) => {
      try {
        const store = useStore.getState();
        const thread = store.threads.find((t) => t.id === threadId);
        if (!thread) {
          return { success: false, error: "Thread not found" };
        }
        return {
          success: true,
          messages: thread.messages.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            createdAt: m.createdAt,
          })),
        };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );

  vowel.registerAction(
    "setThreadTitle",
    {
      description: "Update the title of a thread",
      parameters: {
        threadId: { type: "string", description: "Thread ID" },
        title: { type: "string", description: "New title for the thread" },
      },
    },
    async ({ threadId, title }) => {
      const api = readNativeApi();
      if (!api) {
        return { success: false, error: "API not available" };
      }
      try {
        await api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: newThreadId(),
          title,
        });
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
      }
    },
  );
}

export type VowelClientType = Vowel | null;
