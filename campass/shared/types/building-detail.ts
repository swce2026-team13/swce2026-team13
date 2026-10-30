import type { LocalPoint } from "../utils/campus3d/types.ts";

export type BuildingDetailData = {
  id: string;
  name: string;
  floorRange: string;
  elevator: boolean;
  entrances: { name: string; local: LocalPoint }[];
  floors: { code: string; label: string; summary: string }[];
  facilities: string;
};
