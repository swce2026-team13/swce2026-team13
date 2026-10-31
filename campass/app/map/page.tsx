import { redirect } from "next/navigation";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const values = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (typeof value === "string") params.set(key, value);
  params.set("pick", "start");
  if (!params.has("destination")) params.set("destination", "");
  if (!params.has("elevator")) params.set("elevator", "false");
  redirect(`/directions?${params}`);
}
