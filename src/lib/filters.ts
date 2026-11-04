import type { Creator } from "@/types/creator";

export interface CreatorFilters {
  niche: string;
  location: string;
  minFollowers: string;
  maxFollowers: string;
  minEngagement: string;
  platform: string;
  query: string;
}

export function filterCreators(
  creators: Creator[],
  filters: CreatorFilters,
): Creator[] {
  const query = filters.query.trim().toLowerCase();
  const minFollowers =
    filters.minFollowers === "" ? 0 : Number(filters.minFollowers);
  const maxFollowers =
    filters.maxFollowers === "" ? Infinity : Number(filters.maxFollowers);
  const minEngagement =
    filters.minEngagement === "" ? 0 : Number(filters.minEngagement);

  return creators.filter((creator) => {
    const searchMatches =
      !query ||
      creator.name.toLowerCase().includes(query) ||
      creator.username.toLowerCase().includes(query);

    return (
      (!filters.niche || creator.niche === filters.niche) &&
      (!filters.location || creator.location === filters.location) &&
      (!filters.platform || creator.platform === filters.platform) &&
      creator.followers >= minFollowers &&
      creator.followers <= maxFollowers &&
      creator.engagementRate >= minEngagement &&
      searchMatches
    );
  });
}
