import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/** Loading placeholder for the Deals tab — three stat tiles, a toolbar, and a
 *  handful of table rows. Mirrors the real layout so the swap is calm. */
export function DealsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}><CardContent className="py-3 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
          </CardContent></Card>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 flex-1 min-w-[220px]" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-3">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-24 rounded-sm" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
