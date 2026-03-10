import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { StoreProvider } from "./store";

type RouterHistory = NonNullable<Parameters<typeof createRouter>[0]["history"]>;

let cachedRouter: ReturnType<typeof createRouter> | null = null;

export function getRouter(history: RouterHistory): ReturnType<typeof createRouter> {
  if (cachedRouter) {
    return cachedRouter;
  }

  const queryClient = new QueryClient();

  cachedRouter = createRouter({
    routeTree,
    history,
    context: {
      queryClient,
    },
    Wrap: ({ children }: { children: ReactNode }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(StoreProvider, null, children),
      ),
  });

  return cachedRouter;
}

export function getRouterInstance(): ReturnType<typeof createRouter> | null {
  return cachedRouter;
}

export type AppRouter = ReturnType<typeof createRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
