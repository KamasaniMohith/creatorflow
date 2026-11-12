"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Heart, MessageSquareText, Plus, Search, Trash2, UsersRound } from "lucide-react";
import { useAppData } from "@/components/AppProvider";
import { PageHeading } from "@/components/layout/AppLayout";
import { formatCount } from "@/lib/utils";

export function ShortlistPage() {
  const { creators: directory, campaigns, shortlist, toggleShortlist, addCreatorsToCampaign, createOutreach } = useAppData();
  const [selected, setSelected] = useState<string[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [notice, setNotice] = useState("");
  const savedCreators = useMemo(() => directory.filter((creator) => shortlist.includes(creator.id)), [directory, shortlist]);

  function toggleSelected(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function assignToCampaign() {
    if (!campaignId) {
      showNotice("Choose a campaign first.");
      return;
    }
    const campaign = campaigns.find((item) => item.id === campaignId);
    if (!(await addCreatorsToCampaign(campaignId, selected))) return;
    showNotice(`${selected.length} creator${selected.length === 1 ? "" : "s"} added to ${campaign?.name}.`);
    setSelected([]);
  }

  async function generateMessages() {
    if (!selected.length) return;
    const created = await createOutreach(selected, campaignId || null);
    showNotice(created.length ? `${created.length} draft message${created.length === 1 ? "" : "s"} ready in Outreach.` : "No messages could be created for the selected creators.");
    setSelected([]);
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="YOUR CREATOR COLLECTION" title="Shortlist" description="A focused place for the creators you want to work with." action={<Link className="button button-secondary" href="/discover"><Search size={16} /> Discover creators</Link>} />
      <div className="shortlist-toolbar">
        <label className="select-all"><input type="checkbox" checked={savedCreators.length > 0 && selected.length === savedCreators.length} onChange={(event) => setSelected(event.target.checked ? savedCreators.map((item) => item.id) : [])} /> Select all <span>{savedCreators.length} creators</span></label>
        <div className="bulk-actions">
          <span className="selected-count">{selected.length} selected</span>
          <select className="campaign-picker" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} aria-label="Choose campaign"><option value="">Choose campaign...</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} · {campaign.brand}</option>)}</select>
          <button className="button button-secondary" onClick={assignToCampaign} disabled={!selected.length}><Plus size={15} /> Add to campaign</button>
          <button className="button button-primary" onClick={generateMessages} disabled={!selected.length}><MessageSquareText size={15} /> Generate messages</button>
        </div>
      </div>
      {savedCreators.length ? <div className="shortlist-list">{savedCreators.map((creator) => {
        const checked = selected.includes(creator.id);
        const initials = creator.name.split(" ").map((part) => part[0]).slice(0, 2).join("");
        return <article className={`shortlist-item ${checked ? "shortlist-item-selected" : ""}`} key={creator.id}>
          <input className="shortlist-checkbox" aria-label={`Select ${creator.name}`} type="checkbox" checked={checked} onChange={() => toggleSelected(creator.id)} />
          <div className={`creator-avatar avatar-${creator.niche.toLowerCase()}`}>{initials}</div>
          <div className="shortlist-identity"><strong>{creator.name}<span className="demo-pill">{creator.dataSource === "Demo Dataset" ? "DEMO" : "USER-ADDED"}</span></strong><a href={creator.profileUrl} target="_blank" rel="noreferrer">@{creator.username}</a></div>
          <span className="tag">{creator.niche}</span>
          <div className="shortlist-stat"><UsersRound size={14} /><strong>{formatCount(creator.followers)}</strong><span>Followers</span></div>
          <div className="shortlist-stat"><Heart size={14} /><strong>{creator.engagementRate}%</strong><span>Engagement</span></div>
          <div className="shortlist-location">{creator.location}</div>
          <button className="icon-button danger-hover" onClick={() => { toggleShortlist(creator.id); setSelected((current) => current.filter((id) => id !== creator.id)); }} aria-label={`Remove ${creator.name}`}><Trash2 size={16} /></button>
        </article>;
      })}</div> : <div className="empty-state"><div className="empty-icon"><Heart size={21} /></div><h3>Your shortlist is ready to take shape</h3><p>Save creators while browsing and they’ll show up here for your team to review.</p><Link className="button button-primary" href="/discover"><Search size={16} /> Discover creators</Link></div>}
      {savedCreators.length > 0 && <div className="shortlist-footer-note"><Check size={15} /> Your shortlist is shared with authorized workspace members.</div>}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </div>
  );
}
