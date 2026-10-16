import Screen from "@/components/screens/guide-map";
import { RouteModal } from "@/components/route-modal";
import { titles } from "@/lib/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["guide-map"]}>
      <Screen />
    </RouteModal>
  );
}
