"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Camera,
  Mail,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import type { Creator } from "@/types/creator";
import type { Outreach, OutreachChannel, OutreachStatus } from "@/types/outreach";
import { useAppData } from "@/components/AppProvider";
import { PageHeading } from "@/components/layout/AppLayout";
import { formatDate } from "@/lib/utils";
import { MessageComposer, type ComposerValues } from "@/components/outreach/MessageComposer";
import { ProviderIntegrationPanel } from "@/components/outreach/ProviderIntegrationPanel";
import type {
  DeliveryStatusSummary,
  EmailProvider,
  InstagramConversationSummary,
  IntegrationSetup,
} from "@/types/integrations";
import { CreatorDetails } from "@/components/creators/CreatorDetails";
import { useWorkspace } from "@/components/WorkspaceProvider";

const statusOptions: OutreachStatus[] = [
  "Draft",
  "Ready to Send",
  "Sent (Demo)",
  "Replied",
  "Interested",
  "Not Interested",
  "Follow-up Required",
];

export function OutreachPage() {
  const {
    creators: directory,
    campaigns,
    outreach,
    shortlist,
    templates,
    toggleShortlist,
    createOutreach,
    saveOutreach,
    addOutreachNote,
    saveTemplates,
  } = useAppData();
  const { activeWorkspace } = useWorkspace();
  const [statusFilter, setStatusFilter] = useState<"All" | OutreachStatus>("All");
  const [campaignFilter, setCampaignFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");
  const [channelFilter, setChannelFilter] = useState<"All" | OutreachChannel>("All");
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState<{
    record?: Outreach;
    creatorId?: string;
    campaignId?: string | null;
  } | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const [notice, setNotice] = useState("");
  const [integrationSetup, setIntegrationSetup] = useState<IntegrationSetup | null>(null);
  const [integrationNotice, setIntegrationNotice] = useState("");
  const [integrationBusy, setIntegrationBusy] = useState(false);
  const [deliverySummaries, setDeliverySummaries] = useState<DeliveryStatusSummary[]>([]);
  const [instagramConversations, setInstagramConversations] = useState<InstagramConversationSummary[]>([]);
  const [emailSending, setEmailSending] = useState(false);

  const refreshIntegrationData = useCallback(async () => {
    if (!activeWorkspace) {
      setIntegrationSetup(null);
      setDeliverySummaries([]);
      setInstagramConversations([]);
      return;
    }
    const workspaceQuery = `workspaceId=${encodeURIComponent(activeWorkspace.id)}`;
    const setupResponse = await fetch(
      `/api/integrations/status?${workspaceQuery}`,
      { cache: "no-store" },
    );
    if (!setupResponse.ok) throw new Error("Could not load integration setup status.");
    const setup = (await setupResponse.json()) as IntegrationSetup;
    setIntegrationSetup(setup);
    if (!setup.serverStorageConfigured) {
      setDeliverySummaries([]);
      setInstagramConversations([]);
      return;
    }
    const [deliveryResponse, conversationResponse] = await Promise.all([
      fetch(`/api/email/deliveries?${workspaceQuery}`, { cache: "no-store" }),
      fetch(`/api/instagram/conversations?${workspaceQuery}`, { cache: "no-store" }),
    ]);
    if (!deliveryResponse.ok || !conversationResponse.ok) {
      throw new Error("Workspace provider records could not be loaded.");
    }
    const [deliveryData, conversationData] = await Promise.all([
      deliveryResponse.json() as Promise<{ deliveries: DeliveryStatusSummary[] }>,
      conversationResponse.json() as Promise<{
        conversations: InstagramConversationSummary[];
      }>,
    ]);
    setDeliverySummaries(deliveryData.deliveries);
    setInstagramConversations(conversationData.conversations);
  }, [activeWorkspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshIntegrationData().catch((error: unknown) => {
        setIntegrationNotice(
          error instanceof Error ? error.message : "Could not load integration status.",
        );
      });
      const oauthResult = new URLSearchParams(window.location.search).get("instagram");
      if (oauthResult) {
        setIntegrationNotice(
          oauthResult === "connected"
            ? "Instagram professional account connected."
            : oauthResult === "connection-failed"
              ? "Instagram connection failed. Check Meta setup and permissions."
              : "Instagram connection requires complete Meta setup.",
        );
        window.history.replaceState(null, "", window.location.pathname);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshIntegrationData]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return outreach.filter((item) => {
      const creator = directory.find((profile) => profile.id === item.creatorId);
      if (!creator) return false;
      return (
        (statusFilter === "All" || item.status === statusFilter) &&
        (campaignFilter === "All" || item.campaignId === campaignFilter) &&
        (platformFilter === "All" || creator.platform === platformFilter) &&
        (channelFilter === "All" || item.contactMethod === channelFilter) &&
        (!query ||
          creator.name.toLowerCase().includes(query) ||
          creator.username.toLowerCase().includes(query))
      );
    });
  }, [directory, outreach, statusFilter, campaignFilter, platformFilter, channelFilter, search]);

  const totals = useMemo(
    () =>
      statusOptions.reduce(
        (result, status) => ({
          ...result,
          [status]: outreach.filter((item) => item.status === status).length,
        }),
        {} as Record<OutreachStatus, number>,
      ),
    [outreach],
  );

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function saveMessage(values: ComposerValues) {
    let recordId = composer?.record?.id;
    if (!recordId) {
      recordId = (await createOutreach(
        [values.creatorId],
        values.campaignId,
        values.contactMethod,
      ))[0];
    }
    if (!recordId) {
      showNotice("Could not save this message. Choose a valid creator.");
      return;
    }

    const saved = await saveOutreach(recordId, {
      creatorId: values.creatorId,
      campaignId: values.campaignId,
      contactMethod: values.contactMethod,
      subject: values.subject,
      message: values.message,
      brandName: values.brandName,
      campaignName: values.campaignName,
      collaborationDescription: values.collaborationDescription,
      offer: values.offer,
      tone: values.tone,
      followUpDate: values.followUpDate,
      status: values.status,
    });
    if (!saved) return;
    setComposer(null);
    showNotice(values.status === "Ready to Send" ? "Message saved and marked ready to send." : "Message draft saved.");
  }

  function startNewMessage() {
    setComposer({ campaignId: campaignFilter === "All" ? null : campaignFilter });
  }

  async function openShortlistDrafts() {
    if (!shortlist.length) {
      showNotice("Add creators to your shortlist before generating messages.");
      return;
    }
    const selectedCampaign = campaignFilter === "All" ? null : campaignFilter;
    const createdIds = await createOutreach(shortlist, selectedCampaign);
    showNotice(
      `${createdIds.length} creator draft${createdIds.length === 1 ? "" : "s"} ready below. Open each one to personalize and review before marking it ready.`,
    );
  }

  async function handleStatusChange(item: Outreach, status: OutreachStatus) {
    await saveOutreach(item.id, { status });
  }

  async function connectInstagram() {
    setIntegrationBusy(true);
    setIntegrationNotice("");
    try {
      const response = await fetch("/api/instagram/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace?.id }),
      });
      const result = (await response.json()) as { authorizationUrl?: string; error?: string };
      if (!response.ok || !result.authorizationUrl) {
        throw new Error(result.error ?? "Instagram OAuth could not be started.");
      }
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setIntegrationNotice(error instanceof Error ? error.message : "Instagram OAuth could not be started.");
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function disconnectInstagram() {
    if (!window.confirm("Disconnect the Instagram professional account from CreatorFlow?")) return;
    setIntegrationBusy(true);
    try {
      const response = await fetch("/api/instagram/connection", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: activeWorkspace?.id }),
      });
      if (!response.ok) throw new Error("Instagram account could not be disconnected.");
      await refreshIntegrationData();
    } catch (error) {
      setIntegrationNotice(error instanceof Error ? error.message : "Instagram account could not be disconnected.");
    } finally {
      setIntegrationBusy(false);
    }
  }

  async function sendEmail(input: {
    outreachId: string;
    creatorId: string;
    campaignId: string | null;
    subject: string;
    body: string;
    approved: true;
    workflowStatus: "Ready to Send";
    retry: boolean;
    provider: EmailProvider;
  }) {
    setEmailSending(true);
    try {
      const response = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, workspaceId: activeWorkspace?.id }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        provider?: EmailProvider;
      };
      let refreshFailed = false;
      try {
        await refreshIntegrationData();
      } catch {
        refreshFailed = true;
        setIntegrationNotice("Could not refresh delivery status. Use Refresh before retrying or sending again.");
      }
      if (!response.ok) throw new Error(result.error ?? "The email could not be sent.");
      if (!refreshFailed) {
        setIntegrationNotice(
          result.message ??
            `${result.provider === "n8n" ? "n8n/Gmail" : "Resend"} accepted the email; delivery is pending confirmation.`,
        );
      }
      showNotice(result.message ?? "Email request accepted. Delivery is not yet confirmed.");
    } finally {
      setEmailSending(false);
    }
  }

  async function sendInstagramReply(conversationId: string, text: string, requestId: string) {
    const response = await fetch("/api/instagram/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId: activeWorkspace?.id,
        conversationId,
        text,
        requestId,
        approved: true,
      }),
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) throw new Error(result.error ?? "Instagram reply could not be sent.");
    setIntegrationNotice("Meta accepted the reply request. Check the conversation history for its status.");
    try {
      await refreshIntegrationData();
    } catch {
      setIntegrationNotice("Meta accepted the reply, but CreatorFlow could not refresh its history. Do not retry until you check Instagram.");
    }
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="RELATIONSHIPS, NOT BLASTS"
        title="Outreach workspace"
        description="Write one-to-one messages, manage creator conversations, and keep every follow-up in view."
        action={
          <>
            <button className="button button-secondary" onClick={openShortlistDrafts}>
              <MessageSquareText size={15} /> Draft from shortlist
            </button>
            <button className="button button-primary" onClick={startNewMessage}>
              <Plus size={16} /> New message
            </button>
          </>
        }
      />
      <div className="demo-banner">
        <div className="demo-banner-icon"><Sparkles size={17} /></div>
        <div>
          <strong>Test mode · No creator sample addresses are sent</strong>
          <span>Email is restricted to the configured test recipient. Instagram API replies are allowed only in user-initiated eligible conversations; first contact remains manual.</span>
        </div>
      </div>
      <ProviderIntegrationPanel
        setup={integrationSetup}
        onConnectInstagram={() => void connectInstagram()}
        onDisconnectInstagram={() => void disconnectInstagram()}
        onSendInstagramReply={sendInstagramReply}
        conversations={instagramConversations}
        onRefresh={() => {
          setIntegrationBusy(true);
          void refreshIntegrationData()
            .catch((error: unknown) => setIntegrationNotice(error instanceof Error ? error.message : "Refresh failed."))
            .finally(() => setIntegrationBusy(false));
        }}
        busy={integrationBusy}
        notice={integrationNotice}
      />

      <section className="outreach-stats">
        {statusOptions.map((status) => (
          <button
            key={status}
            className={`outreach-stat ${statusFilter === status ? "outreach-stat-active" : ""}`}
            onClick={() => setStatusFilter(statusFilter === status ? "All" : status)}
          >
            <span>{status}</span><strong>{totals[status]}</strong>
          </button>
        ))}
        <button className={`outreach-stat outreach-stat-all ${statusFilter === "All" ? "outreach-stat-active" : ""}`} onClick={() => setStatusFilter("All")}>
          <span>All messages</span><strong>{outreach.length}</strong>
        </button>
      </section>

      <section className="messaging-filter-panel">
        <div className="messaging-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search creator name or username..." aria-label="Search outreach creators" /></div>
        <label className="field"><span>Campaign</span><select value={campaignFilter} onChange={(event) => setCampaignFilter(event.target.value)}><option value="All">All campaigns</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <label className="field"><span>Platform</span><select value={platformFilter} onChange={(event) => setPlatformFilter(event.target.value)}><option value="All">All platforms</option><option value="Instagram">Instagram</option></select></label>
        <label className="field"><span>Channel</span><select value={channelFilter} onChange={(event) => setChannelFilter(event.target.value as "All" | OutreachChannel)}><option value="All">All channels</option><option>Email</option><option>Instagram DM</option></select></label>
        <label className="field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "All" | OutreachStatus)}><option>All</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
      </section>

      <div className="section-title-row outreach-title-row">
        <div><h2>Creator conversations <span>{visible.length}</span></h2><p>Each record is linked to its campaign and creator.</p></div>
        <Link className="subtle-link" href="/shortlist">Manage shortlist <ArrowUpRight size={14} /></Link>
      </div>

      {visible.length ? (
        <div className="outreach-list">
          {visible.map((item) => {
            const creator = directory.find((profile) => profile.id === item.creatorId);
            const campaign = campaigns.find((candidate) => candidate.id === item.campaignId);
            const delivery = deliverySummaries.find((candidate) => candidate.outreachId === item.id);
            if (!creator) return null;
            return (
              <article className="outreach-card workspace-outreach-card" key={item.id}>
                <div className="outreach-card-top">
                  <button className="outreach-creator outreach-creator-button" onClick={() => setComposer({ record: item })}>
                    <span className={`creator-avatar avatar-${creator.niche.toLowerCase()}`}>{creator.avatar}</span>
                    <span className="outreach-creator-copy"><strong>{creator.name}<span className="demo-pill">{creator.dataSource === "Demo Dataset" ? "DEMO DATA" : "USER-ADDED"}</span></strong><span>@{creator.username} · {creator.platform} · {creator.niche}</span><span className="outreach-open-link">Open messaging workspace</span></span>
                  </button>
                  <div className="outreach-card-meta">
                    <span className={`status-pill status-${item.status.toLowerCase().replaceAll(" ", "-").replace("(", "").replace(")", "")}`}>{item.status}</span>
                    <label className="status-control"><span>Update status</span><select aria-label={`Update status for ${creator.name}`} value={item.status} onChange={(event) => handleStatusChange(item, event.target.value as OutreachStatus)}>{item.status === "Sent (Demo)" && <option value="Sent (Demo)" disabled>Sent (Demo) · legacy</option>}{statusOptions.filter((status) => status !== "Sent (Demo)").map((status) => <option key={status}>{status}</option>)}</select></label>
                  </div>
                </div>
                <div className="outreach-context">
                  <span>{campaign?.name ?? item.campaignName ?? "General outreach"}</span><span>·</span><span>{item.brandName || campaign?.brand || "No brand"}</span><span>·</span><span>{formatDate(item.createdAt)}</span>
                  <span className="contact-chip">{item.contactMethod === "Email" ? <Mail size={13} /> : <Camera size={13} />}{item.contactMethod}{item.contactMethod === "Email" && " · test mode"}</span>
                  {item.followUpDate && <span className="follow-up-chip">Follow-up {formatDate(item.followUpDate)}</span>}
                  {delivery && (
                    <span className={`provider-delivery-chip delivery-${delivery.status}`}>
                      Provider · {delivery.status.replaceAll("_", " ")}
                    </span>
                  )}
                </div>
                {delivery?.errorMessage && (
                  <p className="delivery-error-detail">{delivery.errorMessage}</p>
                )}
                {item.subject && <div className="outreach-subject"><span>SUBJECT</span>{item.subject}</div>}
                <p className="outreach-preview">{item.message}</p>
                <div className="outreach-record-footer">
                  <span>{item.history?.length ?? 0} history updates · {item.notes?.length ?? 0} notes</span>
                  <div>
                    {item.contactMethod === "Instagram DM" && <button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(item.message); showNotice("Message copied. Send it manually in Instagram."); } catch (error) { console.error("Could not copy message.", error); showNotice("Clipboard unavailable. Open the message to copy it manually."); } }}><Camera size={13} /> Copy for manual send</button>}
                    <button className="text-button" onClick={() => setComposer({ record: item })}>Open conversation <ArrowUpRight size={13} /></button>
                    <button className="creator-detail-link" onClick={() => setSelectedCreator(creator)}>Creator details</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon"><Send size={20} /></div>
          <h3>{outreach.length ? "No messages match these filters" : "Start a thoughtful conversation"}</h3>
          <p>{outreach.length ? "Try another status, campaign, or creator search." : "Create a draft for a shortlisted creator or start a message with any demo profile."}</p>
          <div className="empty-actions">
            {!outreach.length && <button className="button button-primary" onClick={startNewMessage}><Plus size={15} /> Compose message</button>}
            <Link className="button button-secondary" href="/shortlist"><MessageSquareText size={15} /> Go to shortlist</Link>
          </div>
        </div>
      )}

      {composer && (
        <MessageComposer
          key={composer.record?.id ?? `${composer.creatorId ?? "new"}-${composer.campaignId ?? "none"}`}
          initial={composer.record}
          creatorId={composer.creatorId}
          campaignId={composer.campaignId}
          campaigns={campaigns}
          templates={templates}
          onClose={() => setComposer(null)}
          onSave={saveMessage}
          onSaveTemplates={saveTemplates}
          onAddNote={(note) => composer.record && addOutreachNote(composer.record.id, note)}
          onSendEmail={sendEmail}
          emailTestRecipient={integrationSetup?.email.testRecipient ?? null}
          emailConfigured={Boolean(integrationSetup?.email.configured)}
          emailN8nConfigured={Boolean(integrationSetup?.email.n8nConfigured)}
          emailSending={emailSending}
          delivery={deliverySummaries.find((delivery) => delivery.outreachId === composer.record?.id)}
          deliveryHistory={deliverySummaries
            .filter((delivery) => delivery.outreachId === composer.record?.id)
            .sort((left, right) => right.attempt - left.attempt)}
          sendAccessAuthorized={activeWorkspace?.role !== "viewer"}
        />
      )}
      {selectedCreator && <CreatorDetails creator={selectedCreator} onClose={() => setSelectedCreator(null)} isShortlisted={shortlist.includes(selectedCreator.id)} onToggleShortlist={() => toggleShortlist(selectedCreator.id)} />}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </div>
  );
}
