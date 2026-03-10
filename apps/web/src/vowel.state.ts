import { useMemo } from "react";
import { useSyncContext } from "@vowel.to/client/react";
import { useRouterState } from "@tanstack/react-router";
import { useStore } from "./store";
import type { Project, Thread } from "./types";

interface VowelAppContext {
  currentPath: string;
  projects: Array<{
    id: string;
    name: string;
    cwd: string;
    expanded: boolean;
    model: string;
  }>;
  threads: Array<{
    id: string;
    title: string;
    projectId: string;
  }>;
}

export function VowelStateSync() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const projects = useStore((store) => store.projects);
  const threads = useStore((store) => store.threads);

  const context = useMemo<VowelAppContext>(() => {
    return {
      currentPath: pathname,
      projects: projects.map((p: Project) => ({
        id: p.id,
        name: p.name,
        cwd: p.cwd,
        expanded: p.expanded,
        model: p.model,
      })),
      threads: threads.map((t: Thread) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
      })),
    };
  }, [pathname, projects, threads]);

  useSyncContext(context as unknown as Record<string, unknown>);

  return null;
}
