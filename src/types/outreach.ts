export type OutreachStatus =
  | "Draft"
  | "Ready to Send"
  | "Sent (Demo)"
  | "Replied"
  | "Interested"
  | "Not Interested"
  | "Follow-up Required";

export type OutreachChannel = "Email" | "Instagram DM";
export type MessageTone = "Professional" | "Friendly" | "Enthusiastic" | "Premium";
export type OutreachEventType =
  | "created"
  | "message"
  | "status"
  | "note"
  | "follow-up";

export interface OutreachEvent {
  id: string;
  type: OutreachEventType;
  text: string;
  message?: string;
  createdAt: string;
}

export interface Outreach {
  id: string;
  creatorId: string;
  campaignId: string | null;
  contactMethod: OutreachChannel;
  message: string;
  status: OutreachStatus;
  createdAt: string;
  subject?: string;
  brandName?: string;
  campaignName?: string;
  collaborationDescription?: string;
  offer?: string;
  tone?: MessageTone;
  followUpDate?: string;
  notes?: string[];
  history?: OutreachEvent[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  description: string;
  channel: OutreachChannel;
  subject: string;
  body: string;
  custom: boolean;
}
