import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";

import "@xterm/xterm/css/xterm.css";
import "./index.css";

import { isElectron } from "./env";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";
import { setAppId, subscribeToVowelChanges } from "./vowel.client";
import { useStore } from "./store";
import { useEffect, useState } from "react";
import { VowelProvider } from "@vowel.to/client/react";
import { getVowel } from "./vowel.client";

const history = isElectron ? createHashHistory() : createBrowserHistory();

const router = getRouter(history);

document.title = APP_DISPLAY_NAME;

function VowelInit() {
  useEffect(() => {
    const appId = import.meta.env.VITE_VOWEL_APP_ID;
    if (appId) {
      setAppId(appId);
    }
  }, []);
  return null;
}

function VowelAppStateSync() {
  const store = useStore();
  const vowel = getVowel();
  const routerLocation = router.state.location;

  useEffect(() => {
    if (vowel) {
      const context = {
        route: {
          pathname: routerLocation.pathname,
          pathnameLabel: routerLocation.pathname || "Home",
          search: String(routerLocation.search),
        },
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
      vowel.updateContext(context);
    }
  }, [store.projects, store.threads, vowel, routerLocation.pathname, routerLocation.search]);

  return null;
}

function App() {
  const [vowel, setVowel] = useState(getVowel());
  const appId = import.meta.env.VITE_VOWEL_APP_ID;

  useEffect(() => {
    const unsubscribe = subscribeToVowelChanges((client) => setVowel(client));
    return () => unsubscribe();
  }, []);

  const vowelReady = vowel !== null || !appId;

  if (!vowelReady) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground">Loading T3 Code...</p>
      </div>
    );
  }

  return (
    <VowelProvider client={vowel ?? null}>
      <VowelInit />
      <VowelAppStateSync />
      <RouterProvider router={router} />
    </VowelProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
