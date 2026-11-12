"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  Eye,
  FileText,
  Mail,
  MessageCircle,
  Save,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { useAppData } from "@/components/AppProvider";
import creatorCatalogue from "@/data/creators.json";
import { personalizeTemplate, TEMPLATE_VARIABLES } from "@/data/message-templates";
import { generateMessage } from "@/lib/message-generator";
import { createId } from "@/lib/utils";
import type { Campaign } from "@/types/campaign";
import type {
  MessageTemplate,
  MessageTone,
  Outreach,
  OutreachChannel,
  OutreachStatus,
} from "@/types/outreach";
import type { DeliveryStatusSummary, EmailProvider } from "@/types/integrations";
import { Modal } from "@/components/ui/Modal";

const TONES: MessageTone[] = ["Professional", "Friendly", "Enthusiastic", "Premium"];

interface ComposerValues {
  creatorId: string;
  campaignId: string | null;
  campaignName: string;
  contactMethod: OutreachChannel;
  subject: string;
  message: string;
  brandName: string;
  collaborationDescription: string;
  offer: string;
  tone: MessageTone;
  followUpDate: string;
  status: OutreachStatus;
}

export function MessageComposer({
  initial,
  creatorId: initialCreatorId,
  campaignId: initialCampaignId,
  campaigns,
  templates,
  onClose,
  onSave,
  onSaveTemplates,
  onSendEmail,
  onAddNote,
  emailTestRecipient,
  emailConfigured,
  emailN8nConfigured,
  emailSending,
  delivery,
  deliveryHistory,
  sendAccessAuthorized,
}: {
  initial?: Outreach;
  creatorId?: string;
  campaignId?: string | null;
  campaigns: Campaign[];
  templates: MessageTemplate[];
  onClose: () => void;
  onSave: (values: ComposerValues) => void | Promise<unknown>;
  onSaveTemplates: (templates: MessageTemplate[]) => void | Promise<unknown>;
  onSendEmail: (input: {
    outreachId: string;
    creatorId: string;
    campaignId: string | null;
    subject: string;
    body: string;
    approved: true;
    workflowStatus: "Ready to Send";
    retry: boolean;
    provider: EmailProvider;
  }) => Promise<void>;
  onAddNote: (note: string) => void | Promise<unknown>;
  emailTestRecipient: string | null;
  emailConfigured: boolean;
  emailN8nConfigured: boolean;
  emailSending: boolean;
  delivery?: DeliveryStatusSummary;
  deliveryHistory: DeliveryStatusSummary[];
  sendAccessAuthorized: boolean;
}) {
  const { creators: creatorDirectory } = useAppData();
  const [creatorId, setCreatorId] = useState(initial?.creatorId ?? initialCreatorId ?? "");
  const [campaignId, setCampaignId] = useState<string | null>(initial?.campaignId ?? initialCampaignId ?? null);
  const [campaignName, setCampaignName] = useState(initial?.campaignName ?? campaigns.find((campaign) => campaign.id === (initial?.campaignId ?? initialCampaignId))?.name ?? "");
  const [contactMethod, setContactMethod] = useState<OutreachChannel>(initial?.contactMethod ?? "Email");
  const [brandName, setBrandName] = useState(initial?.brandName ?? campaigns.find((campaign) => campaign.id === (initial?.campaignId ?? initialCampaignId))?.brand ?? "");
  const [collaborationDescription, setCollaborationDescription] = useState(initial?.collaborationDescription ?? campaigns.find((campaign) => campaign.id === (initial?.campaignId ?? initialCampaignId))?.description ?? "");
  const [offer, setOffer] = useState(initial?.offer ?? "");
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState<MessageTone>(initial?.tone ?? "Friendly");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [followUpDate, setFollowUpDate] = useState(initial?.followUpDate ?? "");
  const [status, setStatus] = useState<OutreachStatus>(initial?.status ?? "Draft");
  const [showTemplates, setShowTemplates] = useState(false);
  const [previewingTemplate, setPreviewingTemplate] = useState<MessageTemplate | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);
  const [emailProvider, setEmailProvider] = useState<EmailProvider>("resend");
  const selectedEmailProvider =
    emailProvider === "resend" && !emailConfigured && emailN8nConfigured
      ? "n8n"
      : emailProvider;
  const selectedProviderConfigured =
    selectedEmailProvider === "n8n" ? emailN8nConfigured : emailConfigured;

  const creator = useMemo(() => creatorDirectory.find((item) => item.id === creatorId), [creatorId, creatorDirectory]);
  const outreachCreator = initial
    ? creatorDirectory.find((item) => item.id === initial.creatorId)
    : undefined;
  const catalogueCreator = initial
    ? creatorCatalogue.find((item) => item.id === initial.creatorId)
    : undefined;
  const n8nCreatorEligible = Boolean(
    initial &&
      creatorId === initial.creatorId &&
      outreachCreator &&
      catalogueCreator &&
      /^creator_faker_\d{4}$/.test(catalogueCreator.id) &&
      catalogueCreator.dataSource === "Demo Dataset" &&
      (catalogueCreator.email === "mohithr1435@gmail.com" ||
        catalogueCreator.email === "krishna@zyrohouse.com") &&
      outreachCreator.dataSource === "Demo Dataset" &&
      outreachCreator.email === catalogueCreator.email,
  );
  const selectedProviderRecipientAvailable =
    selectedEmailProvider === "n8n"
      ? n8nCreatorEligible
      : Boolean(emailTestRecipient);
  const campaign = campaigns.find((item) => item.id === campaignId);
  const variables = {
    "{{creator_name}}": creator?.name ?? "Creator name",
    "{{creator_username}}": creator ? `@${creator.username}` : "@creator_username",
    "{{brand_name}}": brandName || "Brand name",
    "{{campaign_name}}": campaignName || "Campaign name",
    "{{creator_niche}}": creator?.niche ?? "Niche",
    "{{creator_location}}": creator?.location ?? "Location",
  };
  const personalizedSubject = personalizeTemplate(subject, variables);
  const personalizedMessage = personalizeTemplate(message, variables);

  function setCampaign(nextCampaignId: string) {
    const next = campaigns.find((item) => item.id === nextCampaignId);
    setCampaignId(nextCampaignId || null);
    setCampaignName(next?.name ?? "");
    if (next && !brandName) setBrandName(next.brand);
    if (next && !collaborationDescription) setCollaborationDescription(next.description);
  }

  function selectCreator(nextCreatorId: string) {
    setCreatorId(nextCreatorId);
    setApproved(false);
    const nextCreator = creatorDirectory.find((item) => item.id === nextCreatorId);
    if (nextCreator && !initial) {
      const generated = generateMessage({
        creator: nextCreator,
        brandName: brandName || campaign?.brand || "",
        campaignName: campaignName || campaign?.name || "",
        collaborationDescription,
        offer,
        objective,
        tone,
        channel: contactMethod,
      });
      setSubject(generated.subject);
      setMessage(generated.body);
    }
  }

  function setChannel(channel: OutreachChannel) {
    setContactMethod(channel);
    setApproved(false);
    if (channel === "Instagram DM") setSubject("");
  }

  function generate() {
    if (!creator) {
      setError("Choose a creator before generating a message.");
      return;
    }
    const generated = generateMessage({
      creator,
      brandName,
      campaignName: campaignName || campaign?.name || "",
      collaborationDescription,
      offer,
      objective,
      tone,
      channel: contactMethod,
    });
    setSubject(generated.subject);
    setMessage(generated.body);
    setApproved(false);
    setError("");
    setNotice("Generated locally from your brief. No AI service was called.");
    window.setTimeout(() => setNotice(""), 3000);
  }

  function values(nextStatus = status): ComposerValues {
    return {
      creatorId,
      campaignId,
      campaignName: campaignName || campaign?.name || "",
      contactMethod,
      subject,
      message,
      brandName,
      collaborationDescription,
      offer,
      tone,
      followUpDate,
      status: nextStatus,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!creator) {
      setError("Select a creator to continue.");
      return;
    }
    if (!message.trim()) {
      setError("Add a message body or generate a draft before saving.");
      return;
    }
    if (contactMethod === "Email" && !subject.trim()) {
      setError("Add an email subject before saving.");
      return;
    }
    await onSave(values());
  }

  async function markReady() {
    if (!creator || !message.trim() || (contactMethod === "Email" && !subject.trim())) {
      setError("Choose a creator and complete the message before marking it ready.");
      return;
    }
    await onSave(values("Ready to Send"));
  }

  async function sendEmail() {
    if (!initial || !creator || status !== "Ready to Send") {
      setError("Save the message as ready to send before sending.");
      return;
    }
    if (selectedEmailProvider === "n8n" && !n8nCreatorEligible) {
      setError(
        "n8n/Gmail is available only for Faker demo creators with a matching approved catalogue test email.",
      );
      return;
    }
    if (selectedEmailProvider === "resend" && !emailTestRecipient) {
      setError("Configure a test recipient before sending with Resend.");
      return;
    }
    if (!approved) {
      setError("Review and approve the final personalized email before sending.");
      return;
    }
    setError("");
    try {
      await onSendEmail({
        outreachId: initial.id,
        creatorId: initial.creatorId,
        campaignId: initial.campaignId,
        subject: personalizedSubject,
        body: personalizedMessage,
        approved: true,
        workflowStatus: "Ready to Send",
        retry: Boolean(delivery?.status === "failed" && delivery.retryable),
        provider: selectedEmailProvider,
      });
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The email could not be sent.");
    }
  }

  function insertVariable(variable: (typeof TEMPLATE_VARIABLES)[number]) {
    setMessage((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${variable}`);
  }

  function applyTemplate(template: MessageTemplate) {
    setContactMethod(template.channel);
    setSubject(template.subject);
    setMessage(template.body);
    setApproved(false);
    setPreviewingTemplate(null);
    setShowTemplates(false);
  }

  function editTemplate(template: MessageTemplate) {
    setEditingTemplateId(template.id);
    setSubject(template.subject);
    setMessage(template.body);
    setContactMethod(template.channel);
    setShowTemplates(false);
    setNotice(`Editing “${template.name}”. Save the template to keep your changes.`);
  }

  async function saveTemplate() {
    const existing = templates.find((template) => template.id === editingTemplateId);
    if (!existing) return;
    const saved = await onSaveTemplates(
      templates.map((template) =>
        template.id === existing.id
          ? {
              ...template,
              subject,
              body: message,
              channel: contactMethod,
              description: "Custom edited template.",
            }
          : template,
      ),
    );
    if (saved === false) return;
    setEditingTemplateId(null);
    setNotice("Template changes saved.");
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function duplicateTemplate(template: MessageTemplate) {
    const copy: MessageTemplate = {
      ...template,
      id: createId("template"),
      name: `${template.name} (copy)`,
      description: "Duplicated template. Edit and save it to make it yours.",
      custom: true,
    };
    const saved = await onSaveTemplates([...templates, copy]);
    if (saved === false) return;
    setNotice(`Duplicated “${template.name}”.`);
    window.setTimeout(() => setNotice(""), 2400);
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(personalizedMessage);
      setCopied(true);
      setNotice("Personalized message copied. Send it manually in Instagram.");
      window.setTimeout(() => {
        setCopied(false);
        setNotice("");
      }, 2600);
    } catch (copyError) {
      console.error("Unable to copy the Instagram draft.", copyError);
      setError("Could not copy the draft. Select the message and copy it manually.");
    }
  }

  return (
    <Modal
      title={initial ? "Creator messaging workspace" : "Compose outreach"}
      description="Write one-to-one messages and keep the conversation history together."
      onClose={onClose}
      wide
    >
      <form className="composer-form" onSubmit={submit}>
        {!initial && (
          <div className="form-grid composer-identity">
            <label className="field"><span>Creator</span><select required value={creatorId} onChange={(event) => selectCreator(event.target.value)}><option value="">Select a creator...</option>{creatorDirectory.map((item) => <option key={item.id} value={item.id}>{item.name} · @{item.username}</option>)}</select></label>
            <label className="field"><span>Campaign</span><select value={campaignId ?? ""} onChange={(event) => setCampaign(event.target.value)}><option value="">No campaign</option>{campaigns.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.brand}</option>)}</select></label>
          </div>
        )}
        {initial && creator && <div className="composer-creator-summary"><span className={`creator-avatar avatar-${creator.niche.toLowerCase()}`}>{creator.avatar}</span><div><strong>{creator.name}</strong><span>@{creator.username} · {creator.niche} · {creator.location}</span></div><span className="demo-pill">{creator.dataSource === "Demo Dataset" ? "DEMO DATA" : "USER-ADDED"}</span></div>}

        <div className="channel-row">
          <div><span className="field-label">Message channel</span><p>Choose how this message is prepared.</p></div>
          <div className="channel-switch">
            <button type="button" className={contactMethod === "Email" ? "channel-selected" : ""} onClick={() => setChannel("Email")}><Mail size={15} /> Email</button>
            <button type="button" className={contactMethod === "Instagram DM" ? "channel-selected" : ""} onClick={() => setChannel("Instagram DM")}><MessageCircle size={15} /> Instagram DM</button>
          </div>
        </div>

        <div className="composer-fields">
          <label className="field"><span>Brand / business name</span><input value={brandName} onChange={(event) => setBrandName(event.target.value)} placeholder="Your brand name" /></label>
          <label className="field"><span>Campaign name</span><input value={campaignName} readOnly={Boolean(campaignId)} onChange={(event) => setCampaignName(event.target.value)} placeholder="Name this collaboration" /></label>
          <label className="field composer-full"><span>Collaboration description</span><textarea rows={2} value={collaborationDescription} onChange={(event) => setCollaborationDescription(event.target.value)} placeholder="What are you inviting the creator to collaborate on?" /></label>
          <label className="field composer-full"><span>Proposed collaboration offer</span><textarea rows={2} value={offer} onChange={(event) => setOffer(event.target.value)} placeholder="For example, a paid partnership, product gifting, or event invitation." /></label>
        </div>

        <div className="generation-panel">
          <div className="generation-heading"><div className="generation-icon"><WandSparkles size={16} /></div><div><strong>Message generator</strong><span>Local template-based assistance · No AI API is connected</span></div></div>
          <div className="generation-controls">
            <label className="field"><span>Collaboration objective</span><input value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="e.g. Introduce the new collection" /></label>
            <label className="field"><span>Tone</span><select value={tone} onChange={(event) => setTone(event.target.value as MessageTone)}>{TONES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="button button-secondary" type="button" onClick={generate}><Sparkles size={15} /> Generate message</button>
          </div>
        </div>

        <div className="composer-tool-row">
          <button type="button" className="button button-secondary button-small" onClick={() => setShowTemplates((current) => !current)}><FileText size={14} /> {showTemplates ? "Hide templates" : "Message templates"} <span className="template-count">{templates.length}</span></button>
          <button type="button" className={`button button-secondary button-small ${showPreview ? "preview-active" : ""}`} onClick={() => setShowPreview((current) => !current)}><Eye size={14} /> {showPreview ? "Edit message" : "Preview personalization"}</button>
          {editingTemplateId && <button type="button" className="button button-secondary button-small" onClick={saveTemplate}><Save size={14} /> Save template changes</button>}
        </div>

        {showTemplates && <div className="template-library">
          <div className="template-library-heading"><div><h3>Template library</h3><span>Preview, edit, duplicate, or use a starting point.</span></div></div>
          <div className="template-grid">{templates.map((template) => <article className="template-card" key={template.id}>
            <div className="template-card-heading"><strong>{template.name}</strong><span className="template-channel">{template.channel}</span></div>
            <p>{template.description}</p>
            <div className="template-actions">
              <button type="button" className="text-button" onClick={() => setPreviewingTemplate(template)}>Preview</button>
              <button type="button" className="text-button" onClick={() => editTemplate(template)}>Edit</button>
              <button type="button" className="text-button" onClick={() => duplicateTemplate(template)}>Duplicate</button>
              <button type="button" className="text-button template-use" onClick={() => applyTemplate(template)}>Use template</button>
            </div>
          </article>)}</div>
        </div>}

        {previewingTemplate && <div className="template-preview">
          <div className="template-preview-heading"><strong>{previewingTemplate.name} · Preview</strong><button type="button" className="text-button" onClick={() => setPreviewingTemplate(null)}>Close</button></div>
          {previewingTemplate.subject && <strong className="template-subject">{personalizeTemplate(previewingTemplate.subject, variables)}</strong>}
          <p>{personalizeTemplate(previewingTemplate.body, variables)}</p>
          <button type="button" className="button button-secondary button-small" onClick={() => applyTemplate(previewingTemplate)}>Use this template</button>
        </div>}

        {contactMethod === "Email" && <label className="field composer-subject"><span>Email subject</span><input value={subject} onChange={(event) => { setSubject(event.target.value); setApproved(false); }} placeholder="A clear subject for your collaboration" /></label>}
        <div className="composer-body-label"><span className="field-label">Message body</span><span>{message.length} characters</span></div>
        {showPreview ? <div className="message-preview"><div className="preview-label">PERSONALIZED PREVIEW {contactMethod === "Email" ? "· EMAIL" : "· INSTAGRAM DM"}</div>{personalizedSubject && <strong>{personalizedSubject}</strong>}<p>{personalizedMessage || "Your personalized message preview will appear here."}</p></div> : <textarea className="composer-message-body" required value={message} onChange={(event) => { setMessage(event.target.value); setApproved(false); }} rows={8} placeholder="Write your message or generate a starting point..." />}
        <div className="variable-row"><span>Insert variable</span>{TEMPLATE_VARIABLES.map((variable) => <button key={variable} type="button" onClick={() => insertVariable(variable)}>{variable}</button>)}</div>

        {initial && <div className="conversation-history">
          <div className="conversation-heading"><div><h3>Conversation history</h3><span>{initial.history?.length ?? 0} timeline events · {initial.notes?.length ?? 0} notes</span></div></div>
          <label className="field followup-field"><span>Follow-up date</span><input type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} /></label>
          <div className="note-entry"><input aria-label="Add conversation note" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Add an internal note..." /><button type="button" className="button button-secondary button-small" disabled={!noteDraft.trim()} onClick={async () => { const saved = await onAddNote(noteDraft); if (saved !== false) setNoteDraft(""); }}><Save size={13} /> Add note</button></div>
          <div className="history-list">{(initial.history ?? []).slice().reverse().map((event) => <div className={`history-item history-${event.type}`} key={event.id}><i /><div><p>{event.text}</p>{event.message && <details className="previous-message"><summary>View previous message</summary><pre>{event.message}</pre></details>}<time>{new Date(event.createdAt).toLocaleString()}</time></div></div>)}</div>
        </div>}

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="composer-notice" role="status">{notice}</p>}
        {contactMethod === "Instagram DM" && <div className="manual-send-note"><MessageCircle size={14} /> Draft only — copy this message and send it manually in Instagram. No DMs are sent from CreatorFlow. <button type="button" className="text-button" onClick={copyDraft}><Copy size={13} /> {copied ? "Copied" : "Copy message"}</button></div>}
        {contactMethod === "Email" && (
          <div className="email-send-panel">
            <div className="email-send-panel-heading"><Mail size={15} /><strong>Email test mode</strong></div>
            <p>
              {selectedEmailProvider === "n8n"
                ? n8nCreatorEligible
                  ? `n8n/Gmail will send to the approved Faker test address ${catalogueCreator?.email}.`
                  : "n8n/Gmail requires a Faker demo creator whose workspace email matches its approved catalogue test address."
                : emailTestRecipient
                  ? `Resend will send only to ${emailTestRecipient}; creator profile emails are not used.`
                  : "Resend requires OUTREACH_TEST_RECIPIENT. Creator profile emails are not used."}
            </p>
            <label className="field">
              <span>Email provider</span>
              <select
                onChange={(event) => setEmailProvider(event.target.value as EmailProvider)}
                value={selectedEmailProvider}
              >
                <option disabled={!emailConfigured} value="resend">Resend</option>
                <option disabled={!emailN8nConfigured} value="n8n">n8n · Gmail</option>
              </select>
            </label>
            {delivery && (
              <div className={`delivery-detail delivery-${delivery.status}`}>
                <strong>Provider status: {delivery.status.replaceAll("_", " ")}</strong>
                <span>
                  {delivery.status === "sent"
                    ? "The selected provider accepted the request; delivery is not confirmed."
                    : delivery.status === "delivered"
                      ? "Resend confirmed delivery to the recipient mail server."
                      : delivery.errorMessage ?? `Attempt ${delivery.attempt}`}
                </span>
                {delivery.providerMessageId && <small>Provider message ID: {delivery.providerMessageId}</small>}
                {delivery.sentAt && <small>Accepted at {new Date(delivery.sentAt).toLocaleString()}</small>}
              </div>
            )}
            {deliveryHistory.length > 0 && (
              <div className="delivery-attempt-history">
                <strong>Delivery attempts</strong>
                {deliveryHistory.map((attempt) => (
                  <div key={`${attempt.outreachId}-${attempt.attempt}`}>
                    <span>Attempt {attempt.attempt} · {attempt.status.replaceAll("_", " ")}</span>
                    <time>{new Date(attempt.updatedAt).toLocaleString()}</time>
                    {attempt.errorMessage && <small>{attempt.errorMessage}</small>}
                  </div>
                ))}
              </div>
            )}
            {initial && status === "Ready to Send" && !["sent", "delivered", "bounced"].includes(delivery?.status ?? "") && (
              <>
                <label className="reply-approval">
                  <input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} />
                  I reviewed the personalized subject and message and approve this test email.
                </label>
                <button
                  type="button"
                  className="button button-primary button-small"
                  onClick={() => void sendEmail()}
                  disabled={
                    emailSending ||
                    !sendAccessAuthorized ||
                    !selectedProviderConfigured ||
                    !selectedProviderRecipientAvailable ||
                    !approved ||
                    (delivery?.status === "queued" || delivery?.status === "sending") ||
                    (delivery?.status === "failed" && !delivery.retryable)
                  }
                >
                  <Mail size={14} />
                  {emailSending
                    ? "Sending…"
                    : delivery?.status === "failed" && delivery.retryable
                      ? "Retry test email"
                      : "Send approved test email"}
                </button>
                {!sendAccessAuthorized && <span className="integration-footnote">A workspace member role is required to send.</span>}
              </>
            )}
          </div>
        )}

        <div className="composer-footer">
          {initial && <label className="field followup-footer"><span>Communication status</span><select value={status} onChange={(event) => setStatus(event.target.value as OutreachStatus)}>{status === "Sent (Demo)" && <option value="Sent (Demo)" disabled>Sent (Demo) · legacy</option>}<option>Draft</option><option>Ready to Send</option><option>Replied</option><option>Interested</option><option>Not Interested</option><option>Follow-up Required</option></select></label>}
          <div className="composer-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="button button-secondary" onClick={markReady}><Check size={14} /> Mark ready</button>
            <button type="submit" className="button button-primary"><Save size={14} /> Save draft</button>
          </div>
        </div>
      </form>

    </Modal>
  );
}

export type { ComposerValues };
