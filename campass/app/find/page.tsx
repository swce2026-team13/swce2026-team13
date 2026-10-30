import Screen from "@/features/search/find";
import { facilityPlaces } from "@/server/services/rooms";
import { buildingDetails } from "@/server/services/building-details";

// rooms.tsv·places.tsv는 서버에서만 읽을 수 있어 목록을 여기서 만들어 넘김
export default function Page() {
  return <Screen buildingsInfo={buildingDetails()} facilities={facilityPlaces()} />;
}
