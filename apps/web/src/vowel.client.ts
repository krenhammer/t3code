import { Vowel, createTanStackAdapters } from "@vowel.to/client";
import type { Vowel as VowelType } from "@vowel.to/client";
import { getRouter } from "./router";
import { useStore } from "./store";
import { isElectron } from "./env";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";
import { APP_DISPLAY_NAME } from "./branding";

interface VowelContext {
  route: {
    pathname: string;
    pathnameLabel: string;
    search: string;
  };
  app: {
    name: string;
    isElectron: boolean;
  };
  threads: {
    count: number;
    activeThreadId: string | null;
  };
  projects: {
    count: number;
    activeProjectId: string | null;
  };
}

function buildVowelContext(): VowelContext {
  const store = useStore.getState();
  const history = isElectron ? createHashHistory() : createBrowserHistory();
  const loc = history.location;

  const currentThread = store.threads[0] ?? null;
  const currentProject = store.projects[0] ?? null;

  return {
    route: {
      pathname: loc.pathname,
      pathnameLabel: loc.pathname || "Home",
      search: String(loc.search),
    },
    app: {
      name: APP_DISPLAY_NAME,
      isElectron,
    },
    threads: {
      count: store.threads.length,
      activeThreadId: currentThread?.id ?? null,
    },
    projects: {
      count: store.projects.length,
      activeProjectId: currentProject?.id ?? null,
    },
  };
}

let currentAppId: string | null = null;
let vowelInstance: VowelType | null = null;

type VowelChangeListener = (client: VowelType | null) => void;
const vowelChangeListeners = new Set<VowelChangeListener>();

function createVowelClient(appId: string): VowelType {
  const history = isElectron ? createHashHistory() : createBrowserHistory();
  const router = getRouter(history);

  const { navigationAdapter, automationAdapter } = createTanStackAdapters({
    router: router as never,
    enableAutomation: false,
  });

  const vowel = new Vowel({
    appId: appId,
    instructions: `You are a helpful voice assistant for ${APP_DISPLAY_NAME}, an AI-powered coding assistant powered by Codex.

## CRITICAL: Write to App Store, Not DOM
**MOST IMPORTANT RULE**: When performing actions, you MUST write to the application store/state management system, NOT manipulate the DOM directly. Always use registered actions that modify the app store. The UI will automatically update to reflect state changes.

## CRITICAL: Always Refer to Context for Information
Before answering ANY question or performing ANY action, ALWAYS check the <context> section for current information. The context contains the most up-to-date state of the application.

## CRITICAL: Initial Greeting (First Thing You Say)
When you first speak in a new session, you MUST call getAppState() FIRST. The context may not be populated yet - getAppState() reliably returns the current route, threads, projects, and app state. Do NOT rely on context alone for the initial greeting.

## ${APP_DISPLAY_NAME} Application:
This is an AI coding assistant that helps developers write code, manage git branches, run terminal commands, and navigate their projects through conversation with the Codex agent.

## Available Routes:
- Home (/) - List of threads and projects
- Thread (/\$threadId) - Chat view with Codex agent where you can discuss code, run commands, and review changes
- Settings (/_chat/settings) - Application settings

## Available Actions:
### State & Navigation:
- getAppState: Get current route, threads, projects. CALL THIS FIRST when starting a new session.
- getThreads: Get all available conversation threads.
- getProjects: Get all available projects with their details.
- toggleProjectExpanded: Expand or collapse a project in the sidebar.
- navigateToSettings: Navigate to the settings page.

### Code Assistant Actions:
- listProjectScripts: List available scripts (tests, builds, linting) for a project.
- getRecentActivity: Get recent activity from all threads.

## How to Use Voice Commands:
- To navigate: Say "go to settings" or "show me the thread"
- To see projects: Say "show me my projects" or "list projects"
- To see threads: Say "show me my conversations" or "list threads"
- To get project scripts: Say "what scripts are available" or "list scripts"
- To expand/collapse projects: Say "expand project" or "collapse project"
- To get recent activity: Say "what have you been working on" or "show recent activity"

The Codex agent in the thread can help with writing code, explaining code, running terminal commands, git operations, and more. Direct users to start or continue a conversation with the agent.

Help users navigate and interact with ${APP_DISPLAY_NAME} by modifying state through registered actions.`,
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
      initialGreetingPrompt: `Welcome the user to ${APP_DISPLAY_NAME}. Say hello and briefly introduce yourself as their voice assistant for coding. Mention you can help them navigate between conversations, manage projects, and control the app using voice commands. Ask if they'd like to start a new conversation with the AI agent or continue an existing thread. Personalize based on available context - if they have existing threads, mention them by name.`,
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

export function setAppId(appId: string): void {
  if (!appId) return;
  currentAppId = appId;
  vowelInstance = createVowelClient(appId);
  vowelInstance.updateContext(buildVowelContext() as unknown as Record<string, unknown>);
  console.log("✅ Vowel client initialized with App ID:", appId);
  vowelChangeListeners.forEach((listener) => listener(vowelInstance));
}

export function getVowel(): VowelType | null {
  return vowelInstance;
}

export function subscribeToVowelChanges(listener: VowelChangeListener): () => void {
  vowelChangeListeners.add(listener);
  if (vowelInstance) {
    listener(vowelInstance);
  }
  return () => vowelChangeListeners.delete(listener);
}

export function updateVowelContext(): void {
  if (vowelInstance) {
    vowelInstance.updateContext(buildVowelContext() as unknown as Record<string, unknown>);
  }
}

function registerCustomActions(vowel: VowelType): void {
  vowel.registerAction(
    "getAppState",
    {
      description:
        "Get current route, threads, projects, and app state. CALL THIS FIRST when starting a new session - context may not be populated yet.",
      parameters: {},
    },
    async () => {
      const state = buildVowelContext();
      return { success: true, ...state };
    },
  );

  vowel.registerAction(
    "createNewThread",
    {
      description: "Create a new conversation thread in a project",
      parameters: {
        projectId: { type: "string", description: "Project ID to create thread in", optional: true },
      },
    },
    async ({ projectId }) => {
      const store = useStore.getState();
      const targetProject = projectId
        ? store.projects.find((p) => p.id === projectId)
        : store.projects[0];
      if (!targetProject) {
        return { success: false, message: "No project available" };
      }
      return {
        success: true,
        message: `Ready to create new thread in ${targetProject.name}. Use the UI to create a new conversation.`,
        projectId: targetProject.id,
      };
    },
  );

  vowel.registerAction(
    "selectThread",
    {
      description: "Switch to a different conversation thread",
      parameters: {
        threadId: { type: "string", description: "Thread ID to switch to" },
      },
    },
    async ({ threadId }) => {
      const store = useStore.getState();
      const thread = store.threads.find((t) => t.id === threadId);
      if (!thread) {
        return { success: false, message: "Thread not found" };
      }
      return {
        success: true,
        message: `Switched to thread: ${thread.title}`,
        threadId: thread.id,
      };
    },
  );

  vowel.registerAction(
    "toggleProjectExpanded",
    {
      description: "Expand or collapse a project in the sidebar",
      parameters: {
        projectId: { type: "string", description: "Project ID" },
        expanded: { type: "boolean", description: "Whether to expand (true) or collapse (false)" },
      },
    },
    async ({ projectId, expanded }) => {
      const store = useStore.getState();
      const project = store.projects.find((p) => p.id === projectId);
      if (!project) {
        return { success: false, message: "Project not found" };
      }
      useStore.getState().setProjectExpanded(projectId, expanded);
      return {
        success: true,
        message: `${expanded ? "Expanded" : "Collapsed"} project: ${project.name}`,
      };
    },
  );

  vowel.registerAction(
    "navigateToSettings",
    {
      description: "Navigate to the settings page",
      parameters: {},
    },
    async () => {
      return {
        success: true,
        message: "Navigating to settings. Say 'go to settings' to navigate.",
        route: "/_chat/settings",
      };
    },
  );

  vowel.registerAction(
    "getThreads",
    {
      description: "Get all available conversation threads with their titles and status",
      parameters: {},
    },
    async () => {
      const store = useStore.getState();
      const threads = store.threads.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.session?.status ?? "disconnected",
        projectId: t.projectId,
      }));
      return {
        success: true,
        threads,
        count: threads.length,
      };
    },
  );

  vowel.registerAction(
    "getProjects",
    {
      description: "Get all available projects with their scripts",
      parameters: {},
    },
    async () => {
      const store = useStore.getState();
      const projects = store.projects.map((p) => ({
        id: p.id,
        name: p.name,
        cwd: p.cwd,
        model: p.model,
        expanded: p.expanded,
        scripts: p.scripts.map((s) => ({ name: s.name, command: s.command })),
      }));
      return {
        success: true,
        projects,
        count: projects.length,
      };
    },
  );

  vowel.registerAction(
    "getRecentActivity",
    {
      description: "Get recent activity from all threads",
      parameters: {
        limit: { type: "number", description: "Maximum number of activities to return", optional: true },
      },
    },
    async ({ limit = 10 }) => {
      const store = useStore.getState();
      const activities = store.threads
        .flatMap((t) =>
          t.activities.slice(-limit).map((a) => ({
            ...a,
            threadId: t.id,
            threadTitle: t.title,
          })),
        )
        .slice(-limit);
      return {
        success: true,
        activities,
        count: activities.length,
      };
    },
  );

  vowel.registerAction(
    "listProjectScripts",
    {
      description: "List available scripts for a project",
      parameters: {
        projectId: { type: "string", description: "Project ID", optional: true },
      },
    },
    async ({ projectId }) => {
      const store = useStore.getState();
      const project = projectId
        ? store.projects.find((p) => p.id === projectId)
        : store.projects[0];
      if (!project) {
        return { success: false, message: "Project not found" };
      }
      return {
        success: true,
        projectId: project.id,
        projectName: project.name,
        scripts: project.scripts.map((s) => ({
          name: s.name,
          command: s.command,
        })),
      };
    },
  );
}

export type VowelClientType = VowelType | null;
