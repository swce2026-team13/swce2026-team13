import Screen from "@/features/search/places";
import { RouteModal } from "@/components/ui/route-modal";
import { titles } from "@/shared/utils/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["places"]}>
      <Screen />
    </RouteModal>
  );
}
