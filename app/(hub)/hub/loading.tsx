import { Skeleton } from "@/components/ui/skeleton"

// Route-level skeleton for the Hub. Mirrors the console layout (top bar,
// manufacturer rail, workspace) so entry doesn't flash a blank screen while
// the server component resolves auth + the manufacturer list.
export default function HubLoading() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-muted/30">
      {/* Top bar */}
      <div className="flex h-[52px] shrink-0 items-center gap-4 border-b bg-background px-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-[4px] border-2 border-[#2f6ea3]" />
          <span className="font-mono text-[13px] font-semibold tracking-[0.08em]">
            DATAHUB
          </span>
        </div>
        <Skeleton className="mx-auto h-[38px] w-full max-w-[560px]" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Manufacturer rail */}
        <aside className="flex w-[262px] shrink-0 flex-col border-r bg-background p-4">
          <Skeleton className="mb-3 h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="mb-2.5 flex items-center gap-3">
              <Skeleton className="h-[26px] w-[26px] shrink-0 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2 w-1/2" />
              </div>
            </div>
          ))}
        </aside>

        {/* Workspace */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-4 border-b bg-background px-6 py-4">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
          <div className="flex-1 p-6">
            <Skeleton className="mb-4 h-14 w-full" />
            <Skeleton className="mb-2 h-10 w-full" />
            <Skeleton className="mb-2 h-10 w-full" />
            <Skeleton className="mb-2 h-10 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
