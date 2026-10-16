import Screen from "@/components/screens/places";
import { RouteModal } from "@/components/route-modal";
import { titles } from "@/lib/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["places"]}>
      <Screen />
    </RouteModal>
  );
}
