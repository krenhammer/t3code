import { Vowel, createTanStackAdapters } from "@vowel.to/client";
import { getRouterInstance } from "./router";
import { useStore } from "./store";

let _currentAppId: string | null = null;
let vowelInstance: Vowel | null = null;

type VowelChangeListener = (client: Vowel | null) => void;
const vowelChangeListeners = new Set<VowelChangeListener>();

function buildVowelContext() {
  const store = useStore.getState();
  const router = getRouterInstance();
  const loc = router?.state?.location;

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
      title: t.title,
      projectId: t.projectId,
      hasActiveSession: t.session?.status === "running",
    })),
  };
}

function createVowelClient(appId: string): Vowel {
  const router = getRouterInstance();
  if (!router) {
    throw new Error("Router not initialized. Ensure getRouter() is called before creating Vowel client.");
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
When you first speak in a new session, you MUST call getAppState() FIRST. The context may not be populated yet - getAppState() reliably returns the current route, projects, threads, user state, etc. Do NOT rely on context alone for the initial greeting.

## Current Application State:
The current state is automatically provided in the <context> section. You always have access to the latest state - no need to call any actions to read it.

## Available Routes:
- Home (/) - Project and thread overview
- Thread (/$threadId) - Active coding session with terminal
- Settings (/settings) - App configuration

## Available Actions:
- getAppState: Get current route, projects, threads. CALL THIS FIRST when starting a new session.
- navigateToThread: Navigate to a specific thread by ID.
- navigateToHome: Navigate to the home screen.
- navigateToSettings: Navigate to the settings page.
- createNewThread: Create a new thread in a project.
- toggleProject: Expand or collapse a project in the sidebar.
- refreshProjects: Refresh the project list from the server.

## How to Use:
- To navigate: Say "go to thread [name]" or "show me the home screen"
- To create a thread: Say "create new thread in [project name]"
- To manage projects: Say "expand project [name]" or "collapse project [name]"
- **DO NOT use DOM manipulation** - always write to the store

Help users navigate and interact with the T3 Code application by modifying state through registered actions.`,
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
      initialGreetingPrompt: `Welcome to T3 Code! You're in a Codex-first workspace for coding with AI agents. I'm your voice assistant. I'll help you navigate projects, threads, and manage your coding sessions. Briefly reference the current projects or active threads from the context, then ask what you'd like to do - whether it's opening a thread, creating a new one, or navigating the app.`,
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
        "Get current route, projects, threads, and UI state. CALL THIS FIRST when starting a new session (initial greeting) - context may not be populated yet.",
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
      router.navigate({ to: "/$threadId", params: { threadId } });
      return { success: true, message: `Navigated to thread ${threadId}` };
    },
  );

  vowel.registerAction(
    "navigateToHome",
    {
      description: "Navigate to the home screen showing all projects and threads",
      parameters: {},
    },
    async () => {
      const router = getRouterInstance();
      if (!router) {
        return { success: false, error: "Router not initialized" };
      }
      router.navigate({ to: "/" });
      return { success: true, message: "Navigated to home" };
    },
  );

  vowel.registerAction(
    "navigateToSettings",
    {
      description: "Navigate to the settings page",
      parameters: {},
    },
    async () => {
      const router = getRouterInstance();
      if (!router) {
        return { success: false, error: "Router not initialized" };
      }
      router.navigate({ to: "/settings" });
      return { success: true, message: "Navigated to settings" };
    },
  );

  vowel.registerAction(
    "createNewThread",
    {
      description: "Create a new thread in a project",
      parameters: {
        projectId: { type: "string", description: "The ID of the project to create the thread in" },
        title: { type: "string", description: "Title for the new thread", optional: true },
      },
    },
    async ({ projectId, title }) => {
      const store = useStore.getState();
      const project = store.projects.find((p) => p.id === projectId);
      if (!project) {
        return { success: false, error: "Project not found" };
      }
      const api = (window as any).nativeApi;
      if (!api) {
        return { success: false, error: "Native API not available" };
      }
      try {
        const result = await api.orchestration.createThread({
          projectId,
          title: title || "New conversation",
        });
        return { success: true, threadId: result.threadId, message: "Thread created" };
      } catch (error) {
        return { success: false, error: String(error) };
      }
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
      const project = store.projects.find((p) => p.id === projectId);
      if (!project) {
        return { success: false, error: "Project not found" };
      }
      useStore.getState().toggleProject(projectId);
      return { success: true, message: `Project ${project.name} ${project.expanded ? "collapsed" : "expanded"}` };
    },
  );

  vowel.registerAction(
    "refreshProjects",
    {
      description: "Refresh the project list from the server",
      parameters: {},
    },
    async () => {
      const api = (window as any).nativeApi;
      if (!api) {
        return { success: false, error: "Native API not available" };
      }
      try {
        const snapshot = await api.orchestration.getSnapshot();
        useStore.getState().syncServerReadModel(snapshot);
        return { success: true, message: "Projects refreshed" };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
  );
}

export type VowelClientType = Vowel | null;
