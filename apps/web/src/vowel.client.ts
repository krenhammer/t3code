import { Vowel, createTanStackAdapters } from "@vowel.to/client";
import { getRouterInstance } from "./router";
import { useStore } from "./store";
import type { Project, Thread } from "./types";

interface AppState {
  currentPath: string;
  projects: Array<{
    id: string;
    name: string;
    cwd: string;
    expanded: boolean;
  }>;
  threads: Array<{
    id: string;
    title: string;
    projectId: string;
  }>;
  activeThreadId: string | null;
}

function buildVowelContext(): AppState {
  const router = getRouterInstance();
  const store = useStore.getState();

  const projects: AppState["projects"] = store.projects.map((p: Project) => ({
    id: p.id,
    name: p.name,
    cwd: p.cwd,
    expanded: p.expanded,
  }));

  const threads: AppState["threads"] = store.threads.map((t: Thread) => ({
    id: t.id,
    title: t.title,
    projectId: t.projectId,
  }));

  const activeThreadId = store.threads.length > 0 ? store.threads[0]?.id ?? null : null;

  const currentPath = router?.state?.location?.pathname ?? "/";

  return {
    currentPath,
    projects,
    threads,
    activeThreadId,
  };
}

let _currentAppId: string | null = null;
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
    instructions: `You are a helpful coding assistant for T3 Code, a Codex-first workspace for using AI coding agents.

## CRITICAL: Write to App Store, Not DOM
**MOST IMPORTANT RULE**: When performing actions, you MUST write to the application store/state management system, NOT manipulate the DOM directly. Always use registered actions that modify the app store. The UI will automatically update to reflect state changes.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## CRITICAL: Initial Greeting (First Thing You Say)
When you first speak in a new session, you MUST call getAppState() FIRST. The context may not be populated yet - getAppState() reliably returns the current route, projects, threads, and user state. Do NOT rely on context alone for the initial greeting.

## Current Application State:
The current state is automatically provided in the <context> section. You always have access to the latest state - no need to call any actions to read it.

## Available Routes:
- Home (/) - Project and thread list
- Thread (/chat/:threadId) - Active coding session
- Settings (/settings) - App settings

## Available Actions:
- getAppState: Get current route, projects, threads. CALL THIS FIRST when starting a new session.
- navigateToThread: Navigate to a specific thread by ID.
- navigateToHome: Navigate to the home/projects view.
- toggleProject: Expand or collapse a project in the sidebar.
- createNewThread: Create a new thread in a project.

Help users navigate and interact with the application by modifying state through registered actions.`,

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
      initialGreetingPrompt: `Welcome the user to T3 Code! Briefly mention you're here to help with coding tasks. Check the current route and available projects from context, then ask what they'd like to work on. If they have existing threads, mention those as options.`,
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
  _currentAppId = appId;
  vowelInstance = createVowelClient(appId);
  vowelInstance.updateContext(buildVowelContext() as unknown as Record<string, unknown>);
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
        "Get current route, projects, threads, and app state. CALL THIS FIRST when starting a new session - context may not be populated yet.",
      parameters: {},
    },
    async () => {
      const state = buildVowelContext();
      return { success: true, ...state };
    },
  );

  vowel.registerAction(
    "navigateToThread",
    {
      description: "Navigate to a specific thread by thread ID",
      parameters: {
        threadId: { type: "string", description: "The ID of the thread to navigate to" },
      },
    },
    async ({ threadId }) => {
      const router = getRouterInstance();
      if (!router) {
        return { success: false, error: "Router not initialized" };
      }
      (router as any).navigate({ to: "/$threadId", params: { threadId } });
      return { success: true, message: `Navigated to thread ${threadId}` };
    },
  );

  vowel.registerAction(
    "navigateToHome",
    {
      description: "Navigate to the home/projects view",
      parameters: {},
    },
    async () => {
      const router = getRouterInstance();
      if (!router) {
        return { success: false, error: "Router not initialized" };
      }
      (router as any).navigate({ to: "/", replace: true });
      return { success: true, message: "Navigated to home" };
    },
  );

  vowel.registerAction(
    "toggleProject",
    {
      description: "Expand or collapse a project in the sidebar",
      parameters: {
        projectId: { type: "string", description: "The ID of the project to toggle" },
      },
    },
    async ({ projectId }) => {
      const store = useStore.getState();
      store.toggleProject(projectId);
      return { success: true, message: `Toggled project ${projectId}` };
    },
  );

  vowel.registerAction(
    "createNewThread",
    {
      description: "Create a new thread in a project (navigates to create new thread)",
      parameters: {
        projectId: { type: "string", description: "The ID of the project to create thread in" },
        title: { type: "string", description: "Optional title for the new thread", optional: true },
      },
    },
    async ({ projectId }) => {
      const router = getRouterInstance();
      if (!router) {
        return { success: false, error: "Router not initialized" };
      }
      (router as any).navigate({ to: "/", search: { newThreadProjectId: projectId } });
      return { success: true, message: `Creating new thread in project ${projectId}` };
    },
  );
}

export type VowelClientType = Vowel | null;
