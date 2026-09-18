import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";

import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // A marketplace grid is fine slightly stale; refetching on every focus
        // makes a phone feel busy and burns data on a metered connection.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Dehydrate the query cache into the HTML and rehydrate it in the browser.
  // Without this, anything a loader prefetched on the server is invisible to
  // the client, which re-renders the pending state and breaks hydration.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
