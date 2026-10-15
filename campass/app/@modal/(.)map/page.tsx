import Screen from "@/components/screens/map";
import { RouteModal } from "@/components/route-modal";
import { titles } from "@/lib/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["map"]}>
      <Screen />
    </RouteModal>
  );
}
