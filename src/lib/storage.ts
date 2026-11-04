import type { Campaign } from "@/types/campaign";
import type { Outreach } from "@/types/outreach";

const KEYS = {
  campaigns: "creatorflow_campaigns",
  shortlist: "creatorflow_shortlist",
  outreach: "creatorflow_outreach",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch (error) {
    console.error(`Unable to read CreatorFlow data from ${key}.`, error);
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save CreatorFlow data to ${key}.`, error);
  }
}

export const storage = {
  loadCampaigns: (): Campaign[] => read(KEYS.campaigns, []),
  saveCampaigns: (value: Campaign[]) => write(KEYS.campaigns, value),
  loadShortlist: (): string[] => read(KEYS.shortlist, []),
  saveShortlist: (value: string[]) => write(KEYS.shortlist, value),
  loadOutreach: (): Outreach[] => read(KEYS.outreach, []),
  saveOutreach: (value: Outreach[]) => write(KEYS.outreach, value),
};
