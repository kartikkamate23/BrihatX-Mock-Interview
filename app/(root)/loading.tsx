import { InterviewCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-10" role="status" aria-live="polite" aria-label="Loading dashboard">
      <span className="sr-only">Loading your dashboard and interview history.</span>
      <section className="dashboard-hero min-h-64">
        <div className="relative z-10 flex w-full max-w-2xl flex-col gap-5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-12 w-full max-w-lg" />
          <Skeleton className="h-4 w-full max-w-xl" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Skeleton className="h-11 w-full rounded-full sm:w-48" />
            <Skeleton className="h-11 w-full rounded-full sm:w-48" />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-5">
        <Skeleton className="h-7 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-36 rounded-2xl" />)}
        </div>
      </section>
      <section className="flex flex-col gap-5">
        <Skeleton className="h-7 w-48" />
        <div className="interviews-section">
          {Array.from({ length: 3 }, (_, index) => <InterviewCardSkeleton key={index} />)}
        </div>
      </section>
    </div>
  );
}
