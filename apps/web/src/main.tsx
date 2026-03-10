import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { createHashHistory, createBrowserHistory } from "@tanstack/react-router";
import { VowelProvider } from "@vowel.to/client/react";

import "@xterm/xterm/css/xterm.css";
import "./index.css";

import { isElectron } from "./env";
import { getRouter } from "./router";
import { APP_DISPLAY_NAME } from "./branding";
import {
  setAppId,
  getVowel,
  subscribeToVowelChanges,
  type VowelClientType,
} from "./vowel.client";

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

function AppLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function AppContent() {
  const [vowel, setVowel] = useState<VowelClientType>(getVowel());
  const appId = import.meta.env.VITE_VOWEL_APP_ID;

  useEffect(() => {
    const unsubscribe = subscribeToVowelChanges((client) => setVowel(client));
    return () => unsubscribe();
  }, []);

  const vowelReady = vowel !== null || !appId;
  if (!vowelReady) {
    return <AppLoading />;
  }

  return (
    <VowelProvider client={vowel ?? null}>
      <RouterProvider router={router} />
    </VowelProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <VowelInit />
    <AppContent />
  </React.StrictMode>,
);
