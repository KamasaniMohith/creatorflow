import type { Location, Niche } from "./creator";

export type CampaignStatus = "Draft" | "Active" | "Completed";

export interface Campaign {
  id: string;
  name: string;
  brand: string;
  niche: Niche;
  location: Location;
  minFollowers: number;
  maxFollowers: number;
  description: string;
  status: CampaignStatus;
  creatorIds: string[];
  createdAt: string;
}
