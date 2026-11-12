import type { MessageTemplate, OutreachChannel } from "@/types/outreach";

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: "template_professional",
    name: "Professional collaboration proposal",
    description: "A thoughtful introduction for a potential brand partnership.",
    channel: "Email",
    subject: "A collaboration with {{brand_name}}",
    body: "Hi {{creator_name}},\n\nI’m reaching out from {{brand_name}}. We’ve been following your {{creator_niche}} work and appreciate the perspective you bring to your community in {{creator_location}}.\n\nWe’re exploring a collaboration for {{campaign_name}} and would love to share more about the brief. Would you be open to a short conversation?\n\nBest,\n{{brand_name}}",
    custom: false,
  },
  {
    id: "template_friendly",
    name: "Friendly creator outreach",
    description: "Warm, conversational, and personal.",
    channel: "Instagram DM",
    subject: "",
    body: "Hey {{creator_name}}! I’m {{brand_name}} and I really enjoy your {{creator_niche}} content. We’re putting together {{campaign_name}} and thought you could be a lovely fit. Would you be open to hearing a little more? No pressure either way!",
    custom: false,
  },
  {
    id: "template_gifting",
    name: "Product gifting proposal",
    description: "An invitation to experience a product with no posting obligation.",
    channel: "Email",
    subject: "A little something from {{brand_name}}",
    body: "Hi {{creator_name}},\n\nWe’d love to send you a product from {{brand_name}} as a thank-you for the thoughtful {{creator_niche}} content you share.\n\nThere’s no posting obligation. If you’re interested, reply and we can share the details for {{campaign_name}}.\n\nWarmly,\n{{brand_name}}",
    custom: false,
  },
  {
    id: "template_paid",
    name: "Paid partnership proposal",
    description: "Open a conversation about a compensated campaign.",
    channel: "Email",
    subject: "Paid partnership opportunity · {{campaign_name}}",
    body: "Hi {{creator_name}},\n\nI’m contacting you on behalf of {{brand_name}} about a paid partnership for {{campaign_name}}. Your {{creator_niche}} content and connection with your audience in {{creator_location}} caught our attention.\n\nWe’d be happy to share the scope, timing, and budget for your consideration. If it sounds interesting, let us know the best way to continue.\n\nThank you,\n{{brand_name}}",
    custom: false,
  },
  {
    id: "template_event",
    name: "Event invitation",
    description: "Invite a creator to an upcoming brand gathering.",
    channel: "Email",
    subject: "You’re invited by {{brand_name}}",
    body: "Hi {{creator_name}},\n\n{{brand_name}} would love to invite you to {{campaign_name}}. We’re bringing together a small group of voices we admire, and your {{creator_niche}} perspective would be a wonderful addition.\n\nThe event is in {{creator_location}}. Would you like us to send the details?\n\nHope to see you,\n{{brand_name}}",
    custom: false,
  },
];

export const TEMPLATE_VARIABLES = [
  "{{creator_name}}",
  "{{creator_username}}",
  "{{brand_name}}",
  "{{campaign_name}}",
  "{{creator_niche}}",
  "{{creator_location}}",
] as const;

export function personalizeTemplate(
  text: string,
  values: Record<(typeof TEMPLATE_VARIABLES)[number], string>,
): string {
  return text.replace(/\{\{(creator_name|creator_username|brand_name|campaign_name|creator_niche|creator_location)\}\}/g, (variable) =>
    values[variable as (typeof TEMPLATE_VARIABLES)[number]] || variable,
  );
}

export function isOutreachChannel(value: unknown): value is OutreachChannel {
  return value === "Email" || value === "Instagram DM";
}
