import { redirect } from "next/navigation";
import { legacyPlacesHref } from "@/shared/utils/navigation";

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { building } = await searchParams;
  redirect(
    legacyPlacesHref(typeof building === "string" ? building : undefined),
  );
}
