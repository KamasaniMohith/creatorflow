"use client";

import { useState } from "react";
import {
  AlertCircle,
  Camera,
  Mail,
  RefreshCw,
  Send,
  Unplug,
} from "lucide-react";
import type {
  InstagramConversationSummary,
  IntegrationSetup,
} from "@/types/integrations";
import { useWorkspace } from "@/components/WorkspaceProvider";

export function ProviderIntegrationPanel({
  setup,
  onConnectInstagram,
  onDisconnectInstagram,
  onSendInstagramReply,
  conversations,
  onRefresh,
  busy,
  notice,
}: {
  setup: IntegrationSetup | null;
  onConnectInstagram: () => void;
  onDisconnectInstagram: () => void;
  onSendInstagramReply: (
    conversationId: string,
    text: string,
    requestId: string,
  ) => Promise<void>;
  conversations: InstagramConversationSummary[];
  onRefresh: () => void;
  busy: boolean;
  notice: string;
}) {
  const { activeWorkspace } = useWorkspace();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState("");
  const [requestIds, setRequestIds] = useState<Record<string, string>>({});
  const canManage = activeWorkspace?.role === "owner" || activeWorkspace?.role === "admin";
  const canSend = canManage || activeWorkspace?.role === "member";

  async function sendReply(conversation: InstagramConversationSummary) {
    const text = replies[conversation.id]?.trim() ?? "";
    if (!text || !approvals[conversation.id] || !conversation.eligibleToReply) return;
    setSendingId(conversation.id);
    setReplyError("");
    try {
      const requestId = requestIds[conversation.id] ?? globalThis.crypto.randomUUID();
      setRequestIds((current) => ({ ...current, [conversation.id]: requestId }));
      await onSendInstagramReply(conversation.id, text, requestId);
      setReplies((current) => ({ ...current, [conversation.id]: "" }));
      setApprovals((current) => ({ ...current, [conversation.id]: false }));
      setRequestIds((current) => {
        const next = { ...current };
        delete next[conversation.id];
        return next;
      });
    } catch (error) {
      setReplyError(error instanceof Error ? error.message : "The Instagram reply failed.");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <section className="provider-panel" id="integrations">
      <div className="provider-panel-heading">
        <div>
          <span className="section-eyebrow">CONNECTED CHANNELS</span>
          <h2>Delivery integrations</h2>
          <p>Provider receipts and encrypted connection tokens are stored server-side per workspace.</p>
        </div>
        <button className="button button-secondary button-small" onClick={onRefresh} disabled={busy}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {setup && !setup.serverStorageConfigured && (
        <div className="provider-warning" role="status">
          <AlertCircle size={16} />
          <span>Configure server-side Supabase provider storage before enabling delivery or OAuth.</span>
        </div>
      )}
      {notice && <p className="integration-notice" role="status">{notice}</p>}

      <div className="integration-cards">
        <article className="integration-card">
          <div className="integration-card-heading">
            <span className="integration-icon"><Mail size={17} /></span>
            <div>
              <h3>Email · Test delivery</h3>
              <span className={`integration-state ${setup?.email.configured || setup?.email.n8nConfigured ? "is-ready" : ""}`}>
                {setup?.email.configured || setup?.email.n8nConfigured ? "Test provider configured" : "Setup required"}
              </span>
            </div>
          </div>
          <p>n8n/Gmail sends only to the assigned email of a verified Faker creator. Resend sends only to OUTREACH_TEST_RECIPIENT. Choose the provider in the email composer; provider acceptance does not confirm delivery.</p>
          <ul>
            <li>{setup?.email.n8nConfigured ? "n8n Gmail webhook configured" : "Set N8N_EMAIL_WEBHOOK_URL and N8N_EMAIL_WEBHOOK_SECRET for n8n"}</li>
            <li>n8n recipient: verified Faker creator email from the bundled catalogue</li>
            <li>{setup?.email.apiKeyConfigured ? "Resend: API key configured" : "Resend only: set RESEND_API_KEY"}</li>
            <li>{setup?.email.senderConfigured ? "Resend: sender configured" : "Resend only: set a valid EMAIL_FROM"}</li>
            <li>{setup?.email.testRecipientConfigured ? "Resend: test recipient configured" : "Resend only: set OUTREACH_TEST_RECIPIENT; sample domains are blocked"}</li>
            <li>{setup?.email.webhookConfigured ? "Resend: delivery webhook signing secret configured" : "Resend only: set RESEND_WEBHOOK_SECRET for delivery receipts"}</li>
            {setup?.email.testRecipient && <li className="integration-recipient">Test recipient: {setup.email.testRecipient}</li>}
          </ul>
          <span className="integration-footnote">Five test sends per workspace per 24 hours · One message per request</span>
        </article>

        <article className="integration-card">
          <div className="integration-card-heading">
            <span className="integration-icon instagram-icon"><Camera size={17} /></span>
            <div>
              <h3>Instagram Messaging API</h3>
              <span className={`integration-state ${setup?.instagram.connected ? "is-ready" : ""}`}>
                {setup?.instagram.connected ? `Connected · @${setup.instagram.username}` : "Not connected"}
              </span>
            </div>
          </div>
          <p>Official replies are available only for conversations started by an Instagram user and within the applicable messaging window. Cold outbound DMs are not supported.</p>
          {setup?.instagram.setupRequired.length ? (
            <div className="integration-setup-list"><strong>Setup required</strong><span>{setup.instagram.setupRequired.join(" · ")}</span></div>
          ) : !setup?.instagram.connected ? (
            <div className="integration-setup-list"><strong>Not connected</strong><span>Connect an eligible Instagram professional account using Meta Business Login.</span></div>
          ) : null}
          <div className="integration-actions">
            {canManage && setup?.instagram.configured && !setup.instagram.connected && (
              <button className="button button-secondary button-small" onClick={onConnectInstagram} disabled={busy}><Camera size={14} /> Connect account</button>
            )}
            {canManage && setup?.instagram.connected && (
              <button className="text-button" onClick={onDisconnectInstagram} disabled={busy}><Unplug size={13} /> Disconnect</button>
            )}
            {!canManage && <span className="integration-footnote">Only workspace owners and admins can manage connections.</span>}
          </div>
          <span className="integration-footnote">Requires Meta app setup, webhook subscription, permissions, and any required app review.</span>
        </article>
      </div>

      <div className="instagram-inbox">
        <div className="instagram-inbox-heading">
          <div><h3>Eligible Instagram conversations</h3><p>Only user-initiated conversations with an active 24-hour standard reply window are available here.</p></div>
          <span>{conversations.length} conversations</span>
        </div>
        {!setup?.instagram.connected ? (
          <div className="integration-empty">Connect Instagram to receive verified webhook conversations.</div>
        ) : conversations.length === 0 ? (
          <div className="integration-empty">No incoming Instagram conversations received. Until a creator messages the connected account, first contact must be manual.</div>
        ) : (
          <div className="instagram-conversation-list">
            {conversations.map((conversation) => (
              <article className="instagram-conversation" key={conversation.id}>
                <div className="instagram-conversation-header">
                  <div><strong>Instagram user · {conversation.recipientId}</strong><time>Last inbound {new Date(conversation.lastInboundAt).toLocaleString()}</time></div>
                  <span className={conversation.eligibleToReply ? "eligibility-open" : "eligibility-closed"}>{conversation.eligibleToReply ? "Reply window open" : "Window expired"}</span>
                </div>
                <div className="instagram-history">
                  {conversation.messages.map((message) => (
                    <p className={message.direction === "outbound" ? "message-outbound" : "message-inbound"} key={message.id}>
                      <span>{message.direction === "outbound" ? "You" : "Incoming"}</span>{message.text}
                    </p>
                  ))}
                </div>
                {conversation.eligibleToReply && canSend ? (
                  <>
                    <textarea
                      aria-label={`Reply to Instagram conversation ${conversation.recipientId}`}
                      rows={3}
                      maxLength={1000}
                      value={replies[conversation.id] ?? ""}
                      onChange={(event) => setReplies((current) => ({ ...current, [conversation.id]: event.target.value }))}
                      placeholder="Write a permitted reply..."
                    />
                    <label className="reply-approval">
                      <input
                        type="checkbox"
                        checked={Boolean(approvals[conversation.id])}
                        onChange={(event) => setApprovals((current) => ({ ...current, [conversation.id]: event.target.checked }))}
                      />
                      I reviewed and approve this reply for the user-initiated conversation.
                    </label>
                    <button className="button button-primary button-small" onClick={() => void sendReply(conversation)} disabled={busy || sendingId !== null || !replies[conversation.id]?.trim() || !approvals[conversation.id]}>
                      <Send size={14} /> {sendingId === conversation.id ? "Sending…" : "Send permitted reply"}
                    </button>
                  </>
                ) : conversation.eligibleToReply ? (
                  <p className="integration-footnote">A workspace member role is required to send replies.</p>
                ) : (
                  <p className="integration-footnote">The standard reply window has expired. Use manual outreach where appropriate; this API will not send outside the window.</p>
                )}
              </article>
            ))}
          </div>
        )}
        {replyError && <p className="form-error" role="alert">{replyError}</p>}
      </div>
    </section>
  );
}
