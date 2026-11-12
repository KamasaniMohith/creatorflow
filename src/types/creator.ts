export const NICHES = [
  "Fitness",
  "Food",
  "Fashion",
  "Travel",
  "Technology",
  "Beauty",
  "Lifestyle",
  "Gaming",
  "Business",
  "Education",
  "Finance",
] as const;

export const LOCATIONS = [
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Mumbai",
  "Delhi",
  "Pune",
  "Kochi",
  "Jaipur",
  "Kolkata",
  "Ahmedabad",
] as const;

export type Niche = (typeof NICHES)[number];
export type Location = (typeof LOCATIONS)[number];
export type Platform = "Instagram";
export type CreatorDataSource = "Demo Dataset" | "User Entry";

export interface Creator {
  id: string;
  name: string;
  username: string;
  platform: Platform;
  niche: Niche;
  subNiche: string;
  location: Location;
  state: string;
  followers: number;
  engagementRate: number;
  averageViews: number;
  averageLikes: number;
  averageComments: number;
  email: string | null;
  bio: string;
  profileUrl: string;
  avatar: string;
  language: string;
  audienceType: string;
  dataSource: CreatorDataSource;
  lastUpdated: string;
}

export type CreatorProfileInput = Omit<
  Creator,
  "id" | "lastUpdated" | "dataSource"
>;
