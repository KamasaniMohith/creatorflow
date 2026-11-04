"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Camera, Mail, MessageSquareText, Send, Sparkles } from "lucide-react";
import creators from "@/data/creators.json";
import type { Creator } from "@/types/creator";
import type { OutreachStatus } from "@/types/outreach";
import { useAppData } from "@/components/AppProvider";
import { PageHeading } from "@/components/layout/AppLayout";
import { formatDate } from "@/lib/utils";
import { generateMessage } from "@/lib/message-generator";
import { MessageEditor } from "@/components/outreach/MessageEditor";

const directory = creators as Creator[];
const statusOptions: OutreachStatus[] = ["Draft", "Approved", "Sent", "Replied", "Interested", "Rejected"];

export function OutreachPage() {
  const { campaigns, outreach, updateOutreach } = useAppData();
  const [filter, setFilter] = useState<"All" | OutreachStatus>("All");
  const [notice, setNotice] = useState("");
  const visible = useMemo(() => outreach.filter((item) => filter === "All" || item.status === filter), [outreach, filter]);
  const totals = statusOptions.reduce((result, status) => ({ ...result, [status]: outreach.filter((item) => item.status === status).length }), {} as Record<OutreachStatus, number>);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="RELATIONSHIPS, NOT BLASTS" title="Outreach" description="Create thoughtful messages and keep every conversation organized." action={<Link className="button button-secondary" href="/shortlist"><MessageSquareText size={16} /> Generate from shortlist</Link>} />
      <div className="demo-banner"><div className="demo-banner-icon"><Sparkles size={17} /></div><div><strong>Demo message generator</strong><span>Messages are local templates only. Instagram DMs remain drafts for you to send manually. No messages are sent from CreatorFlow.</span></div></div>
      <section className="outreach-stats">{statusOptions.slice(0, 4).map((status) => <button key={status} className={`outreach-stat ${filter === status ? "outreach-stat-active" : ""}`} onClick={() => setFilter(filter === status ? "All" : status)}><span>{status}</span><strong>{totals[status]}</strong></button>)}<button className={`outreach-stat outreach-stat-all ${filter === "All" ? "outreach-stat-active" : ""}`} onClick={() => setFilter("All")}><span>All messages</span><strong>{outreach.length}</strong></button></section>
      <div className="section-title-row outreach-title-row"><div><h2>Creator conversations <span>{visible.length}</span></h2><p>Update messages and track each relationship as it develops.</p></div><div className="outreach-filter"><label htmlFor="outreach-status-filter">Filter</label><select id="outreach-status-filter" value={filter} onChange={(event) => setFilter(event.target.value as "All" | OutreachStatus)}><option>All</option>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></div></div>
      {visible.length ? <div className="outreach-list">{visible.map((item) => {
        const creator = directory.find((profile) => profile.id === item.creatorId);
        const campaign = campaigns.find((candidate) => candidate.id === item.campaignId);
        if (!creator) return null;
        const brand = campaign?.brand || "your brand";
        return <article className="outreach-card" key={item.id}>
          <div className="outreach-card-top">
            <div className="outreach-creator"><div className={`creator-avatar avatar-${creator.niche.toLowerCase()}`}>{creator.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><div><strong>{creator.name}<span className="demo-pill">DEMO</span></strong><a href={creator.profileUrl} target="_blank" rel="noreferrer">@{creator.username}</a></div></div>
            <div className="outreach-card-meta"><span className={`status-pill status-${item.status.toLowerCase()}`}>{item.status}</span><label className="status-control"><span>Update status</span><select aria-label={`Update status for ${creator.name}`} value={item.status} onChange={(event) => { updateOutreach(item.id, { status: event.target.value as OutreachStatus }); showNotice(`Status updated to ${event.target.value}.`); }}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label></div>
          </div>
          <div className="outreach-context"><span>{campaign?.name ?? "General outreach"}</span><span>·</span><span>{campaign?.brand ?? "No campaign selected"}</span><span>·</span><span>{formatDate(item.createdAt)}</span><span className="contact-chip">{item.contactMethod === "Email" ? <Mail size={13} /> : <Camera size={13} />}{item.contactMethod}</span></div>
          <MessageEditor creator={creator} brand={brand} message={item.message} onChange={(message) => updateOutreach(item.id, { message })} onGenerate={() => updateOutreach(item.id, { message: generateMessage(creator, brand), status: "Draft" })} />
          {item.contactMethod === "Instagram DM" && <div className="manual-send-note"><Camera size={14} /> Manual send required — this message has not been sent.</div>}
        </article>;
      })}</div> : <div className="empty-state"><div className="empty-icon"><Send size={20} /></div><h3>{outreach.length ? "No messages in this status" : "Your next conversation starts here"}</h3><p>{outreach.length ? "Select a different status to see more conversations." : "Select creators from your shortlist to generate personal, editable message drafts."}</p>{!outreach.length && <Link className="button button-primary" href="/shortlist"><ArrowRight size={16} /> Go to shortlist</Link>}</div>}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </div>
  );
}
