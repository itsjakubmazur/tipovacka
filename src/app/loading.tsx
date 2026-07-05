import { BrandLoader } from "@/components/brand-loader";

// Root-level loading state: shows for navigation to ANY route that
// doesn't define its own loading.tsx (i.e. all of them - the nav bar
// stays put, the content area shows the shimmering wordmark).
export default function RootLoading() {
  return <BrandLoader />;
}
