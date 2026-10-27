import Screen from "@/features/navigation/help";
import { RouteModal } from "@/components/ui/route-modal";
import { titles } from "@/shared/utils/navigation";
export default function Page() {
  return (
    <RouteModal title={titles["help"]}>
      <Screen />
    </RouteModal>
  );
}
