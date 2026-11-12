export type DeliveryStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "delivery_delayed"
  | "failed"
  | "bounced";

export type EmailProvider = "resend" | "n8n";

export interface DeliveryRecord {
  id: string;
  outreachId: string;
  creatorId: string;
  campaignId: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  providerMessageId: string | null;
  status: DeliveryStatus;
  errorCode: string | null;
  errorMessage: string | null;
  retryable: boolean;
  attempt: number;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface DeliveryStatusSummary {
  outreachId: string;
  status: DeliveryStatus;
  providerMessageId: string | null;
  errorMessage: string | null;
  retryable: boolean;
  attempt: number;
  createdAt: string;
  sentAt: string | null;
  updatedAt: string;
}

export interface IntegrationSetup {
  serverStorageConfigured: boolean;
  email: {
    configured: boolean;
    testMode: true;
    testRecipient: string | null;
    apiKeyConfigured: boolean;
    senderConfigured: boolean;
    testRecipientConfigured: boolean;
    webhookConfigured: boolean;
    n8nConfigured: boolean;
  };
  instagram: {
    configured: boolean;
    connected: boolean;
    username: string | null;
    accountId: string | null;
    setupRequired: string[];
  };
}

export interface InstagramConversationSummary {
  id: string;
  recipientId: string;
  lastInboundAt: string;
  lastMessage: string;
  eligibleToReply: boolean;
  messages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    text: string;
    createdAt: string;
  }>;
}
