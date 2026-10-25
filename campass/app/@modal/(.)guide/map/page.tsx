import Screen from "@/features/navigation/guide-map";
import { RouteModal } from "@/components/ui/route-modal";
import { titles } from "@/shared/utils/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["guide-map"]}>
      <Screen />
    </RouteModal>
  );
}
