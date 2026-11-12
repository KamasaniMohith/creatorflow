import "server-only";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESERVED_SUFFIXES = [
  ".example",
  ".invalid",
  ".test",
  ".example.com",
  ".example.net",
  ".example.org",
];
const RESERVED_DOMAINS = new Set(["example.com", "example.net", "example.org", "invalid", "test"]);
const N8N_WEBHOOK_HOST = "creatorflow.app.n8n.cloud";
const N8N_WEBHOOK_PATH = "/webhook/creatorflow-gmail-test";

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function isDemoAddress(value: string): boolean {
  const domain = value.split("@").at(-1)?.toLowerCase() ?? "";
  return RESERVED_DOMAINS.has(domain) || RESERVED_SUFFIXES.some((suffix) => domain.endsWith(suffix));
}

export function isValidSender(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 254 || /[\r\n]/.test(value)) {
    return false;
  }
  const address = value.match(/<([^<>]+)>/)?.[1] ?? value;
  return isValidEmail(address);
}

export function emailTestConfiguration(): {
  configured: boolean;
  testRecipient: string | null;
  senderConfigured: boolean;
  webhookConfigured: boolean;
} {
  const recipient = process.env.OUTREACH_TEST_RECIPIENT ?? "";
  const testRecipient = isValidEmail(recipient) && !isDemoAddress(recipient) ? recipient : null;
  const senderConfigured = isValidSender(process.env.EMAIL_FROM);
  return {
    configured: Boolean(process.env.RESEND_API_KEY && senderConfigured && testRecipient),
    testRecipient,
    senderConfigured,
    webhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  };
}

export function getN8nEmailWebhookUrl(): string | null {
  const value = process.env.N8N_EMAIL_WEBHOOK_URL;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.hostname !== N8N_WEBHOOK_HOST ||
      url.pathname !== N8N_WEBHOOK_PATH ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isN8nEmailConfigured(): boolean {
  return Boolean(
    getN8nEmailWebhookUrl() && process.env.N8N_EMAIL_WEBHOOK_SECRET,
  );
}
