import { NextRequest, NextResponse } from "next/server";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import {
  emailTestConfiguration,
  isN8nEmailConfigured,
} from "@/lib/server/email-config";
import type { IntegrationSetup } from "@/types/integrations";

export async function GET(request: NextRequest) {
  const authorization = await authorizeApiWorkspace(
    request.nextUrl.searchParams.get("workspaceId"),
    ["owner", "admin", "member", "viewer"],
  );
  if (!authorization.ok) {
    return NextResponse.json(
      { error: authorization.error },
      { status: authorization.status },
    );
  }

  const { data: connection, error } = await authorization.supabase
    .from("integration_connections")
    .select("account_id, username, token_expires_at, connected_at")
    .eq("workspace_id", authorization.workspaceId)
    .eq("provider", "instagram")
    .maybeSingle();
  if (error) {
    console.error("Unable to load workspace integration metadata.", error);
    return NextResponse.json(
      { error: "Integration status could not be loaded." },
      { status: 500 },
    );
  }

  const emailConfig = emailTestConfiguration();
  const instagramSetupRequired = [
    !process.env.META_INSTAGRAM_APP_ID && "Instagram App ID",
    !process.env.META_INSTAGRAM_APP_SECRET && "Instagram App Secret",
    !process.env.META_INSTAGRAM_REDIRECT_URI && "OAuth redirect URI",
    !process.env.META_WEBHOOK_VERIFY_TOKEN && "Webhook verify token",
    !process.env.INTEGRATION_ENCRYPTION_KEY && "Token encryption key",
    !process.env.SUPABASE_SERVICE_ROLE_KEY && "Server-side Supabase provider storage",
  ].filter((item): item is string => Boolean(item));

  const status: IntegrationSetup = {
    serverStorageConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    email: {
      configured:
        emailConfig.configured && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      testMode: true,
      testRecipient:
        authorization.role === "owner" || authorization.role === "admin"
          ? emailConfig.testRecipient
          : null,
      apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
      senderConfigured: emailConfig.senderConfigured,
      testRecipientConfigured: Boolean(emailConfig.testRecipient),
      webhookConfigured: emailConfig.webhookConfigured,
      n8nConfigured:
        isN8nEmailConfigured() &&
        Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    instagram: {
      configured:
        instagramSetupRequired.length === 0 &&
        Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      connected: Boolean(connection?.token_expires_at),
      username: connection?.username ?? null,
      accountId: connection?.account_id ?? null,
      setupRequired: instagramSetupRequired,
    },
  };
  return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
}
