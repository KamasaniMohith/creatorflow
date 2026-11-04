export type OutreachStatus =
  | "Draft"
  | "Approved"
  | "Sent"
  | "Replied"
  | "Interested"
  | "Rejected";

export interface Outreach {
  id: string;
  creatorId: string;
  campaignId: string | null;
  contactMethod: "Email" | "Instagram DM";
  message: string;
  status: OutreachStatus;
  createdAt: string;
}
