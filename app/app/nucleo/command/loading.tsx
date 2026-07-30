import { Skeleton } from "@/components/ui/skeleton";

export default function NucleoCommandLoading() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3 rounded-lg border border-border p-6">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}
