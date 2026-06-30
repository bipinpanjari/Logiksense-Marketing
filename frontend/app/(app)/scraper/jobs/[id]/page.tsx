import ScraperJobDetailPageClient from "./page-client";

export async function generateStaticParams() {
  return [{ id: "fallback" }];
}

export default function Page() {
  return <ScraperJobDetailPageClient />;
}
