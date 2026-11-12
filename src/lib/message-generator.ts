import type { Creator } from "@/types/creator";
import type { MessageTone, OutreachChannel } from "@/types/outreach";

export interface MessageGenerationInput {
  creator: Creator,
  brandName: string;
  campaignName: string;
  collaborationDescription: string;
  offer: string;
  objective: string;
  tone: MessageTone;
  channel: OutreachChannel;
}

export interface GeneratedMessage {
  subject: string;
  body: string;
}

const toneOpenings: Record<MessageTone, string> = {
  Professional: "I’m reaching out from {{brand_name}} regarding a potential collaboration.",
  Friendly: "I’ve been enjoying your {{creator_niche}} content and wanted to say hello from {{brand_name}}.",
  Enthusiastic: "We’re excited about the possibility of working together on behalf of {{brand_name}}!",
  Premium: "On behalf of {{brand_name}}, I’d be delighted to explore a considered partnership with you.",
};

export function generateMessage(input: MessageGenerationInput): GeneratedMessage {
  const { creator, brandName, campaignName, collaborationDescription, offer, objective, tone, channel } = input;
  const greeting = channel === "Email" ? `Hi ${creator.name},` : `Hi ${creator.name.split(" ")[0]}!`;
  const context = collaborationDescription.trim() || `a ${creator.niche.toLowerCase()} collaboration`;
  const goal = objective.trim() || "introduce the campaign to your community in a way that feels natural to you";
  const offerText = offer.trim() || "We’d be happy to share the scope and discuss what would work best for you.";
  const body = [
    greeting,
    "",
    `${toneOpenings[tone]} ${creator.niche} creator ${creator.username} caught our attention, and we appreciate the point of view you share with your community.`,
    "",
    `We’re planning ${campaignName || "an upcoming campaign"}: ${context}. Our goal is to ${goal}.`,
    "",
    `For the collaboration, ${offerText}`,
    "",
    channel === "Email"
      ? "Would you be open to a conversation? We can share the full brief and answer any questions."
      : "Would you be open to hearing more? Happy to share the details if it feels like a fit.",
    "",
    channel === "Email" ? `Best,\n${brandName || "The team"}` : `Thanks,\n${brandName || "The team"}`,
  ].join("\n");
  return {
    subject: channel === "Email" ? `${brandName || "Partnership"} × ${campaignName || "collaboration"}` : "",
    body,
  };
}
