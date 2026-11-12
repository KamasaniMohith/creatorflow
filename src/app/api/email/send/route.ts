import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import {
  createWorkspaceDeliveryAttempt,
  updateWorkspaceDelivery,
} from "@/lib/server/supabase-delivery-store";
import { authorizeApiWorkspace } from "@/lib/server/api-workspace";
import {
  getN8nEmailWebhookUrl,
  isDemoAddress,
  isValidEmail,
  isValidSender,
} from "@/lib/server/email-config";
import creatorCatalogue from "@/data/creators.json";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isSendInput(value: unknown): value is {
  workspaceId: string;
  outreachId: string;
  creatorId: string;
  campaignId: string | null;
  subject: string;
  body: string;
  approved: true;
  workflowStatus: "Ready to Send";
  retry: boolean;
  provider: "resend" | "n8n";
} {
  if (typeof value !== "object" || value === null) return false;
  const input = value as Record<string, unknown>;
  return (
    typeof input.workspaceId === "string" &&
    /^[0-9a-f-]{36}$/i.test(input.workspaceId) &&
    typeof input.outreachId === "string" &&
    /^[\w-]{1,128}$/.test(input.outreachId) &&
    typeof input.creatorId === "string" &&
    /^[\w-]{1,128}$/.test(input.creatorId) &&
    (typeof input.campaignId === "string" || input.campaignId === null) &&
    typeof input.subject === "string" &&
    input.subject.trim().length > 0 &&
    input.subject.length <= 200 &&
    !/[\r\n]/.test(input.subject) &&
    typeof input.body === "string" &&
    input.body.trim().length > 0 &&
    input.body.length <= 20000 &&
    input.approved === true &&
    input.workflowStatus === "Ready to Send" &&
    typeof input.retry === "boolean" &&
    (input.provider === "resend" || input.provider === "n8n")
  );
}

function isRetryableProviderError(error: {
  statusCode?: number | null;
  name?: string | null;
}): boolean {
  return (
    error.statusCode === 429 ||
    (typeof error.statusCode === "number" && error.statusCode >= 500) ||
    error.name === "application_error" ||
    error.name === "internal_server_error" ||
    error.name === "rate_limit_exceeded"
  );
}

function isN8nSuccess(value: unknown): value is {
  messageId: string;
  threadId: string;
  to: string;
  executionId: string;
} {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.messageId === "string" &&
    result.messageId.length > 0 &&
    typeof result.threadId === "string" &&
    result.threadId.length > 0 &&
    typeof result.to === "string" &&
    typeof result.executionId === "string" &&
    result.executionId.length > 0
  );
}

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return errorResponse("A same-origin request is required.", 403);
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return errorResponse("Invalid request body.", 400);
  }
  if (!isSendInput(input)) {
    return errorResponse("Complete and approve a valid email message before sending.", 400);
  }
  const authorization = await authorizeApiWorkspace(input.workspaceId);
  if (!authorization.ok) {
    return errorResponse(authorization.error, authorization.status);
  }
  const { data: outreach, error: outreachError } = await authorization.supabase
    .from("outreach_records")
    .select("id, creator_id, campaign_id, status")
    .eq("workspace_id", authorization.workspaceId)
    .eq("id", input.outreachId)
    .maybeSingle();
  if (outreachError) {
    console.error("Unable to validate outreach before email send.", outreachError);
    return errorResponse("The outreach record could not be validated.", 500);
  }
  if (
    !outreach ||
    outreach.creator_id !== input.creatorId ||
    outreach.campaign_id !== input.campaignId
  ) {
    return errorResponse("The outreach record does not match this workspace.", 403);
  }
  if (outreach.status !== "Ready to Send") {
    return errorResponse("Save and approve the outreach record before sending.", 409);
  }

  let n8nRecipient = "";
  if (input.provider === "n8n") {
    const { data: workspaceCreator, error: creatorError } = await authorization.supabase
      .from("creators")
      .select("id, email, data_source")
      .eq("workspace_id", authorization.workspaceId)
      .eq("id", input.creatorId)
      .maybeSingle();
    if (creatorError) {
      console.error("Unable to validate the workspace creator before n8n email send.", creatorError);
      return errorResponse("The creator could not be validated for n8n delivery.", 500);
    }

    const catalogueCreator = creatorCatalogue.find(
      (creator) => creator.id === input.creatorId,
    );
    const allowedTestEmails = [
      "mohithr1435@gmail.com",
      "krishna@zyrohouse.com",
    ];
    if (
      !workspaceCreator ||
      !catalogueCreator ||
      !/^creator_faker_\d{4}$/.test(catalogueCreator.id) ||
      catalogueCreator.dataSource !== "Demo Dataset" ||
      !catalogueCreator.email ||
      !allowedTestEmails.includes(catalogueCreator.email) ||
      workspaceCreator.data_source !== "Demo Dataset" ||
      workspaceCreator.email !== catalogueCreator.email
    ) {
      return errorResponse(
        "n8n delivery is available only for verified Faker demo creators with a matching assigned test email.",
        403,
      );
    }
    n8nRecipient = catalogueCreator.email;
  }

  const resendRecipient = process.env.OUTREACH_TEST_RECIPIENT ?? "";
  const sender = process.env.EMAIL_FROM;
  const apiKey = process.env.RESEND_API_KEY;
  const n8nWebhookUrl = getN8nEmailWebhookUrl();
  const n8nWebhookSecret = process.env.N8N_EMAIL_WEBHOOK_SECRET;
  const resendRecipientValid =
    isValidEmail(resendRecipient) && !isDemoAddress(resendRecipient);
  const deliveryRecipient =
    input.provider === "n8n" ? n8nRecipient : resendRecipient;
  let delivery;
  try {
    delivery = await createWorkspaceDeliveryAttempt({
      workspaceId: authorization.workspaceId,
      userId: authorization.userId,
      outreachId: input.outreachId,
      creatorId: input.creatorId,
      campaignId: input.campaignId,
      recipientEmail: deliveryRecipient,
      subject: input.subject.trim(),
      body: input.body.trim(),
      retry: input.retry,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("limit of five")) {
      return errorResponse(error.message, 429);
    }
    return errorResponse(
      error instanceof Error ? error.message : "The delivery could not be started.",
      409,
    );
  }

  const configurationError =
    input.provider === "n8n"
      ? !n8nWebhookUrl || !n8nWebhookSecret
        ? "Configure N8N_EMAIL_WEBHOOK_URL and N8N_EMAIL_WEBHOOK_SECRET before sending."
        : !n8nRecipient
          ? "A verified Faker creator test email is required for n8n delivery."
          : null
      : !apiKey
        ? "Configure RESEND_API_KEY before sending."
        : !isValidSender(sender)
          ? "Configure a valid EMAIL_FROM sender before sending."
          : !resendRecipientValid
            ? "Configure OUTREACH_TEST_RECIPIENT with a real test inbox. Demo addresses are blocked."
            : null;
  if (
    configurationError ||
    (input.provider === "resend" && !resendRecipientValid) ||
    (input.provider === "resend" &&
      (!apiKey || !isValidSender(sender))) ||
    (input.provider === "n8n" && (!n8nWebhookUrl || !n8nWebhookSecret))
  ) {
    await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
      status: "failed",
      errorCode: "email_setup_required",
      errorMessage: configurationError ?? "Email provider setup is incomplete.",
      retryable: true,
    });
    return NextResponse.json(
      {
        error: configurationError ?? "Email provider setup is incomplete.",
        status: "failed",
        retryable: true,
        attempt: delivery.attempt,
      },
      { status: 503 },
    );
  }

  await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, { status: "sending" });
  if (input.provider === "n8n" && n8nWebhookUrl && n8nWebhookSecret) {
    let response: Response;
    try {
      response = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CreatorFlow-Key": n8nWebhookSecret,
        },
        body: JSON.stringify({
          to: n8nRecipient,
          subject: input.subject.trim(),
          message: input.body.trim(),
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
        status: "failed",
        errorCode: "n8n_provider_outcome_unknown",
        errorMessage: "The n8n request outcome is unknown. Check the n8n execution and Gmail before sending again.",
        retryable: false,
      });
      return NextResponse.json(
        {
          error: "The n8n request outcome is unknown. Check n8n and Gmail before attempting another send.",
          status: "failed",
          retryable: false,
        },
        { status: 502 },
      );
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      result = null;
    }
    if (
      !response.ok ||
      !isN8nSuccess(result) ||
      result.to.toLowerCase() !== n8nRecipient.toLowerCase()
    ) {
      const retryable = response.status === 400;
      await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
        status: "failed",
        errorCode: "n8n_provider_rejected",
        errorMessage: response.status === 400
          ? "n8n rejected the email request before sending. Review the message and validation."
          : "n8n did not confirm the email request. Check the n8n execution and Gmail before sending again.",
        retryable,
      });
      return NextResponse.json(
        {
          error: response.status === 400
            ? "n8n rejected the email request before sending. Review the message and validation."
            : "n8n did not confirm the email request. Check n8n and Gmail before attempting another send.",
          status: "failed",
          retryable,
        },
        { status: response.status === 400 ? 400 : 502 },
      );
    }

    const sentAt = new Date().toISOString();
    await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
      providerMessageId: `n8n:${result.messageId}`,
      status: "sent",
      errorCode: null,
      errorMessage: null,
      retryable: false,
      sentAt,
    });
    return NextResponse.json({
      provider: "n8n",
      status: "sent",
      providerMessageId: result.messageId,
      threadId: result.threadId,
      to: result.to,
      executionId: result.executionId,
      sentAt,
      attempt: delivery.attempt,
      message: "n8n confirmed Gmail accepted the email request. Delivery is not otherwise confirmed.",
    });
  }

  if (input.provider !== "resend" || !apiKey || !isValidSender(sender)) {
    await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
      status: "failed",
      errorCode: "email_setup_required",
      errorMessage: "Resend setup is incomplete.",
      retryable: true,
    });
    return NextResponse.json(
      { error: "Resend setup is incomplete.", status: "failed", retryable: true },
      { status: 503 },
    );
  }

  const resend = new Resend(apiKey);
  const idempotencyKey = `creatorflow:${input.outreachId}:${delivery.attempt}`;
  let response: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    response = await resend.emails.send(
      {
        from: sender,
        to: [resendRecipient],
        subject: input.subject.trim(),
        text: input.body.trim(),
      },
      { idempotencyKey },
    );
  } catch {
    await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
      status: "failed",
      errorCode: "provider_outcome_unknown",
      errorMessage: "The provider request ended unexpectedly. Check the Resend dashboard before retrying.",
      retryable: false,
    });
    return NextResponse.json(
      {
        error: "The provider outcome is unknown. Check Resend before attempting another send.",
        status: "failed",
        retryable: false,
      },
      { status: 502 },
    );
  }
  const { data, error } = response;

  if (error || !data?.id) {
    const retryable = isRetryableProviderError(error ?? {});
    await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
      status: "failed",
      errorCode: retryable ? "temporary_provider_failure" : "provider_rejected",
      errorMessage: retryable
        ? "Resend could not accept this message because of a temporary error. A retry may be available."
        : "Resend rejected this message. Check the sender and provider setup.",
      retryable,
    });
    return NextResponse.json(
      {
        error: retryable
          ? "Resend could not accept the email. You may retry this failed attempt."
          : "Resend rejected the email. Check the sender and provider setup.",
        status: "failed",
        retryable,
        attempt: delivery.attempt,
      },
      { status: retryable ? 503 : 502 },
    );
  }

  const sentAt = new Date().toISOString();
  await updateWorkspaceDelivery(authorization.workspaceId, delivery.id, {
    providerMessageId: data.id,
    status: "sent",
    errorCode: null,
    errorMessage: null,
    retryable: false,
    sentAt,
  });
  return NextResponse.json({
    status: "sent",
    providerMessageId: data.id,
    sentAt,
    attempt: delivery.attempt,
    message: "Resend accepted the email. Delivery is not confirmed until a delivery webhook arrives.",
  });
}
