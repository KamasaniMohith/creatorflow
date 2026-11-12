"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { useAppData } from "@/components/AppProvider";
import { PageHeading } from "@/components/layout/AppLayout";
import { CampaignForm, type CampaignInput } from "@/components/campaigns/CampaignForm";
import type { Campaign, CampaignStatus } from "@/types/campaign";
import { formatCount, formatDate } from "@/lib/utils";

const statusOrder: CampaignStatus[] = ["Draft", "Active", "Completed"];

export function CampaignsPage() {
  const { creators: creatorDirectory, campaigns, outreach, createCampaign, updateCampaign, deleteCampaign, updateCampaignStatus } = useAppData();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("new") === "1") setFormOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function saveCampaign(data: CampaignInput) {
    const saved = editing
      ? await updateCampaign({ ...editing, ...data })
      : await createCampaign(data);
    if (!saved) return false;
    setFormOpen(false);
    setEditing(undefined);
    return true;
  }

  async function removeCampaign(campaign: Campaign) {
    if (!window.confirm(`Delete “${campaign.name}”? This cannot be undone.`)) return;
    await deleteCampaign(campaign.id);
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="PLAN & ORGANIZE" title="Campaigns" description="Keep creator partnerships organized, from first brief to final wrap-up." action={<button className="button button-primary" onClick={() => setFormOpen(true)}><Plus size={17} /> New campaign</button>} />
      <div className="campaign-summary-row">
        <SummaryItem label="All campaigns" value={campaigns.length} />
        <SummaryItem label="Active" value={campaigns.filter((item) => item.status === "Active").length} />
        <SummaryItem label="Creators connected" value={new Set(campaigns.flatMap((item) => item.creatorIds)).size} />
        <div className="campaign-summary-note">Campaign data is shared with authorized workspace members.</div>
      </div>
      <div className="section-title-row"><div><h2>Your campaigns <span>{campaigns.length}</span></h2><p>A clear view of every partnership in motion</p></div></div>
      {campaigns.length ? <div className="campaign-grid">
        {campaigns.map((campaign) => {
          const attached = creatorDirectory.filter((creator) => campaign.creatorIds.includes(creator.id));
          const creatorsWithOutreach = new Set(outreach.filter((item) => item.campaignId === campaign.id).map((item) => item.creatorId)).size;
          const progress = campaign.creatorIds.length ? (creatorsWithOutreach / campaign.creatorIds.length) * 100 : 0;
          return <article className="campaign-card" key={campaign.id}>
            <div className="campaign-card-top"><span className="campaign-symbol">{campaign.brand.slice(0, 1).toUpperCase()}</span><div className="campaign-card-actions"><button className="icon-button" aria-label="Edit campaign" onClick={() => { setEditing(campaign); setFormOpen(true); }}><Pencil size={16} /></button><button className="icon-button danger-hover" aria-label="Delete campaign" onClick={() => removeCampaign(campaign)}><Trash2 size={16} /></button></div></div>
            <div className="campaign-card-title"><h3>{campaign.name}</h3><span className={`status-pill status-${campaign.status.toLowerCase()}`}>{campaign.status}</span></div>
            <div className="campaign-brand">{campaign.brand} <span>·</span> {campaign.niche}</div>
            <p className="campaign-description">{campaign.description || "No campaign description added yet."}</p>
            <div className="campaign-meta"><span><MapPin size={14} />{campaign.location}</span><span><UsersRound size={14} />{campaign.minFollowers.toLocaleString()}–{formatCount(campaign.maxFollowers)}</span><span><CalendarDays size={14} />{formatDate(campaign.createdAt)}</span></div>
            <div className="progress-heading"><span>Outreach prep</span><strong>{creatorsWithOutreach} / {campaign.creatorIds.length} drafted</strong></div>
            <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
            <div className="campaign-card-footer">
              <button className="text-button" onClick={() => setExpanded(expanded === campaign.id ? null : campaign.id)}>{expanded === campaign.id ? "Hide creators" : "View creators"} <ArrowRight size={14} /></button>
              <select aria-label="Campaign status" className="status-select" value={campaign.status} onChange={(event) => updateCampaignStatus(campaign.id, event.target.value as CampaignStatus)}>{statusOrder.map((status) => <option key={status}>{status}</option>)}</select>
            </div>
            {expanded === campaign.id && <div className="attached-creators">{attached.length ? attached.map((creator) => <span key={creator.id}>{creator.name}</span>) : <span>No creators added yet. <Link href="/shortlist">Add from shortlist</Link></span>}</div>}
          </article>;
        })}
      </div> : <div className="empty-state"><div className="empty-icon"><Plus size={21} /></div><h3>No campaigns yet</h3><p>Create your first campaign to keep creator partnerships and outreach in one place.</p><button className="button button-primary" onClick={() => setFormOpen(true)}><Plus size={16} /> Create campaign</button></div>}
      {formOpen && <CampaignForm key={editing?.id ?? "new"} initial={editing} onClose={() => { setFormOpen(false); setEditing(undefined); }} onSave={saveCampaign} />}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: number }) {
  return <div className="campaign-summary-item"><span>{label}</span><strong>{value}</strong></div>;
}
