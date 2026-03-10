import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { StoreProvider } from "./store";

type RouterHistory = NonNullable<Parameters<typeof createRouter>[0]["history"]>;

let routerInstance: ReturnType<typeof createRouter> | null = null;

export function getRouter(history: RouterHistory) {
  const queryClient = new QueryClient();

  routerInstance = createRouter({
    routeTree,
    history,
    context: {
      queryClient,
    },
    Wrap: ({ children }) =>
      createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(StoreProvider, null, children),
      ),
  });

  return routerInstance;
}

export function getRouterInstance(): typeof routerInstance {
  return routerInstance;
}

export type AppRouter = typeof routerInstance;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
