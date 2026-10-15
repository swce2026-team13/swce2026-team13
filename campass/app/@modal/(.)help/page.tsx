import Screen from "@/components/screens/help";
import { RouteModal } from "@/components/route-modal";
import { titles } from "@/lib/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["help"]}>
      <Screen />
    </RouteModal>
  );
}
