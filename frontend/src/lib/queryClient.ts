// src/lib/queryClient.ts
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { RateLimitError, UnauthorizedError } from "../services/api";

// Module-level callback set by AppProvider on mount.
// Lets the QueryCache/MutationCache 401 handler call signOut without a circular dependency.
// Note: onUnauthorized is null until the first AppProvider render flush (after first paint).
// The `enabled: !!token` guard on all authenticated queries means a 401 can only arrive
// when signed in, and AppProvider will have registered the handler by then.
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

function handle401(error: unknown): void {
  if (error instanceof UnauthorizedError && onUnauthorized) {
    onUnauthorized();
  }
}

export const queryClient = new QueryClient({
  // QueryCache covers all useQuery / useInfiniteQuery errors
  queryCache: new QueryCache({
    onError: handle401,
  }),
  // MutationCache covers useMutation errors (e.g. token expires mid-session)
  mutationCache: new MutationCache({
    onError: handle401,
  }),
  defaultOptions: {
    queries: {
      // 401s are terminal (the handler above signs the user out); rate limits
      // get a couple of patient retries honouring the server's retry_after;
      // anything else gets one quick retry.
      retry: (failureCount, error) => {
        if (error instanceof UnauthorizedError) return false;
        if (error instanceof RateLimitError) return failureCount < 2;
        return failureCount < 1;
      },
      retryDelay: (attemptIndex, error) =>
        error instanceof RateLimitError
          ? error.retryAfter * 1000
          : Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
  },
});
