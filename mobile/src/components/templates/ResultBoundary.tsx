import type { Result } from "@/data/contracts";
import { Banner, EmptyState, SkeletonList } from "@/components/ui/primitives";

/**
 * Renders the five load states consistently so no screen has to special-case
 * them. Skeletons preserve the final row geometry.
 *
 * Deliberately NOT a Client Component: it takes a render function for the ok
 * branch, and a Server Component cannot pass a function across the client
 * boundary. Keeping it server-compatible lets both server pages and client
 * screens use the same boundary. It holds no state, so it costs nothing.
 */
export function ResultBoundary<T>({
  result,
  children,
  emptyTitle = "Nothing here yet",
  emptyBody = "Work will appear here as it is created.",
  emptyAction,
  skeletonRows = 6,
}: {
  result: Result<T>;
  children: (data: T) => React.ReactNode;
  emptyTitle?: string;
  emptyBody?: string;
  emptyAction?: React.ReactNode;
  skeletonRows?: number;
}) {
  switch (result.status) {
    case "loading":
      return <SkeletonList rows={skeletonRows} />;
    case "empty":
      return (
        <div data-testid="state-empty">
          <EmptyState title={emptyTitle} body={emptyBody} action={emptyAction} />
        </div>
      );
    case "error":
      return (
        <div data-testid="state-error" style={{ marginTop: 16 }}>
          <Banner tone="error">{result.message}</Banner>
        </div>
      );
    case "offline":
      return (
        <div data-testid="state-offline" style={{ marginTop: 16 }}>
          <Banner tone="info">
            Offline. Showing nothing rather than something stale — reconnect to load
            operations.
          </Banner>
        </div>
      );
    default:
      return <>{children(result.data)}</>;
  }
}
