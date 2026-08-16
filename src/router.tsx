import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// The zip/portal build (STATIC=1) is served from an arbitrary sub-path
// (e.g. /qa-tool/<id>/index.html), where a path-based history would look for a
// route named after that folder and render the 404 page. Hash history keeps the
// app anchored at "/" no matter which folder index.html lives in.
const useHashHistory =
  import.meta.env["VITE_STATIC"] === "1" && typeof window !== "undefined";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(useHashHistory ? { history: createHashHistory() } : {}),
  });

  return router;
};
