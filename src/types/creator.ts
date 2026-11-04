export const NICHES = [
  "Fitness",
  "Food",
  "Fashion",
  "Beauty",
  "Technology",
  "Travel",
  "Lifestyle",
  "Gaming",
  "Business",
] as const;

export const LOCATIONS = [
  "Bangalore",
  "Mumbai",
  "Delhi",
  "Hyderabad",
  "Chennai",
  "Pune",
] as const;

export type Niche = (typeof NICHES)[number];
export type Location = (typeof LOCATIONS)[number];

export interface Creator {
  id: string;
  name: string;
  username: string;
  platform: "Instagram";
  niche: Niche;
  location: Location;
  followers: number;
  engagementRate: number;
  averageViews: number;
  email: string | null;
  bio: string;
  profileUrl: string;
}
