import { Skeleton } from "@/components/ui/skeleton"

export default function ManufacturerLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-20" />
      <div className="flex items-center gap-5">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-9 w-80 rounded-lg" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
