import { Skeleton } from "@/components/ui/skeleton";

export default function EventDetailLoading() {
  return (
    <div className="flex flex-col gap-4 px-4 py-8">
      <Skeleton className="-mx-4 -mt-8 aspect-[16/9] rounded-none sm:mx-0 sm:mt-0 sm:rounded-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-72 w-full" />
      ))}
    </div>
  );
}
