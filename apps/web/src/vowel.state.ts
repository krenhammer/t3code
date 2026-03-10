import { useEffect } from "react";
import { useSyncContext } from "@vowel.to/client/react";
import { useStore } from "./store";
import { getRouterInstance } from "./router";

export function useVowelStateSync() {
  const projects = useStore((state) => state.projects);
  const threads = useStore((state) => state.threads);
  const threadsHydrated = useStore((state) => state.threadsHydrated);
  const syncContext = useSyncContext();

  useEffect(() => {
    if (!syncContext) return;

    const router = getRouterInstance();
    const loc = router?.state.location;

    const context = {
      route: loc
        ? { pathname: loc.pathname, pathnameLabel: loc.pathname || "Home", search: String(loc.search) }
        : { pathname: "/", pathnameLabel: "Home", search: "" },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        cwd: p.cwd,
        expanded: p.expanded,
        model: p.model,
        scriptCount: p.scripts.length,
      })),
      threads: threads.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        title: t.title,
        sessionStatus: t.session?.status || "closed",
        messageCount: t.messages.length,
      })),
      threadsHydrated,
      lastUpdated: new Date().toISOString(),
    };

    syncContext(context);
  }, [projects, threads, threadsHydrated, syncContext]);
}

export function VowelStateSync() {
  useVowelStateSync();
  return null;
}
