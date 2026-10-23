import Screen from "@/components/screens/find";
import { facilityPlaces, roomPlaces } from "@/lib/rooms";

// rooms.tsv·places.tsv는 서버에서만 읽을 수 있어 목록을 여기서 만들어 넘김
export default function Page() {
  return <Screen rooms={roomPlaces()} facilities={facilityPlaces()} />;
}
