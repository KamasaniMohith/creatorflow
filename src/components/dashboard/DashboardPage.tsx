"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Camera,
  Plus,
  Send,
  UsersRound,
} from "lucide-react";
import creators from "@/data/creators.json";
import type { Creator } from "@/types/creator";
import { useAppData } from "@/components/AppProvider";
import { CreatorCard } from "@/components/creators/CreatorCard";
import { CreatorDetails } from "@/components/creators/CreatorDetails";
import { PageHeading } from "@/components/layout/AppLayout";
import { formatDate } from "@/lib/utils";
import { useState } from "react";

const creatorList = creators as Creator[];

export function DashboardPage() {
  const { campaigns, shortlist, outreach, toggleShortlist } = useAppData();
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const recentCreators = creatorList.slice(0, 3);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "Active").length;
  const sentOutreach = outreach.filter((item) => item.status === "Sent").length;
  const latestCampaigns = campaigns.slice(0, 4);
  const activity = outreach.slice(0, 4);

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR CREATOR WORKSPACE"
        title="Good morning, Jordan"
        description="Here’s what’s happening across your creator partnerships."
        action={<Link className="button button-primary" href="/campaigns?new=1"><Plus size={17} /> Create campaign</Link>}
      />
      <section className="welcome-strip">
        <div className="welcome-copy">
          <div className="welcome-overline"><span className="welcome-spark"><UsersRound size={15} /></span> YOUR CREATOR WORKSPACE</div>
          <h2>Find creators who make<br />your brand <em>feel like itself.</em></h2>
          <p>Discover standout voices, build meaningful partnerships, and keep every campaign moving.</p>
          <Link className="button button-light" href="/discover">Discover creators <ArrowRight size={16} /></Link>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="art-center"><Camera size={27} /></div>
          <div className="art-person art-person-one">AM</div><div className="art-person art-person-two">KR</div><div className="art-person art-person-three">SJ</div>
          <span className="art-star star-one">✳</span><span className="art-star star-two">✦</span>
        </div>
      </section>
      <section className="stats-grid">
        <StatCard label="Total creators" value={creatorList.length.toString()} note="Curated demo profiles" icon={<UsersRound size={18} />} />
        <StatCard label="Active campaigns" value={String(activeCampaigns)} note={`${campaigns.length} total campaigns`} icon={<CheckCircle2 size={18} />} accent="green" />
        <StatCard label="Shortlisted creators" value={String(shortlist.length)} note="Ready for a campaign" icon={<Clock3 size={18} />} accent="purple" />
        <StatCard label="Outreach sent" value={String(sentOutreach)} note={`${outreach.length} total messages`} icon={<Send size={18} />} accent="orange" />
      </section>
      <div className="dashboard-columns">
        <section className="panel recent-campaigns-panel">
          <div className="panel-heading"><div><h2>Recent campaigns</h2><p>Keep an eye on your latest work</p></div><Link className="subtle-link" href="/campaigns">View all <ArrowUpRight size={15} /></Link></div>
          {latestCampaigns.length ? (
            <div className="table-scroll"><table className="data-table"><thead><tr><th>CAMPAIGN</th><th>CREATORS</th><th>STATUS</th><th>CREATED</th></tr></thead><tbody>
              {latestCampaigns.map((campaign) => <tr key={campaign.id}><td><div className="campaign-cell"><span className="table-brand">{campaign.brand.slice(0, 1).toUpperCase()}</span><div><strong>{campaign.name}</strong><small>{campaign.brand}</small></div></div></td><td>{campaign.creatorIds.length} creators</td><td><span className={`status-pill status-${campaign.status.toLowerCase()}`}>{campaign.status}</span></td><td>{formatDate(campaign.createdAt)}</td></tr>)}
            </tbody></table></div>
          ) : <div className="empty-inline"><div className="empty-icon"><Plus size={18} /></div><strong>Your first campaign starts here</strong><span>Set a goal and bring your creator shortlist into focus.</span><Link className="text-button" href="/campaigns?new=1">Create a campaign <ArrowRight size={14} /></Link></div>}
        </section>
        <section className="panel activity-panel">
          <div className="panel-heading"><div><h2>Outreach activity</h2><p>Your latest creator conversations</p></div><Link className="subtle-link" href="/outreach">View all <ArrowUpRight size={15} /></Link></div>
          {activity.length ? <div className="activity-list">{activity.map((item) => {
            const creator = creatorList.find((candidate) => candidate.id === item.creatorId);
            const campaign = campaigns.find((candidate) => candidate.id === item.campaignId);
            return <div className="activity-item" key={item.id}><div className="activity-avatar">{creator?.name.split(" ").map((p) => p[0]).join("")}</div><div className="activity-copy"><strong>{creator?.name ?? "Creator"}</strong><span>{item.status} · {campaign?.name ?? "General outreach"}</span></div><time>{formatDate(item.createdAt)}</time></div>;
          })}</div> : <div className="empty-inline compact-empty"><div className="empty-icon"><Send size={17} /></div><strong>No outreach activity yet</strong><span>Build your shortlist and start a conversation.</span><Link className="text-button" href="/shortlist">Go to shortlist <ArrowRight size={14} /></Link></div>}
          {campaigns.length > 0 && <div className="status-overview">
            <div className="status-overview-heading"><strong>Campaign overview</strong><Link href="/campaigns">Details <ArrowRight size={12} /></Link></div>
            {(["Active", "Draft", "Completed"] as const).map((status) => {
              const total = campaigns.filter((campaign) => campaign.status === status).length;
              return <div className="overview-row" key={status}><span>{status}</span><div className="overview-track"><i className={`overview-${status.toLowerCase()}`} style={{ width: `${Math.max(total ? 10 : 0, (total / campaigns.length) * 100)}%` }} /></div><strong>{total}</strong></div>;
            })}
          </div>}
        </section>
      </div>
      <section className="panel discovered-panel">
        <div className="panel-heading"><div><h2>Recently discovered creators</h2><p>A few profiles from your sample directory</p></div><Link className="subtle-link" href="/discover">Explore all creators <ArrowUpRight size={15} /></Link></div>
        <div className="creator-grid dashboard-creator-grid">{recentCreators.map((creator) => <CreatorCard key={creator.id} creator={creator} shortlisted={shortlist.includes(creator.id)} onToggleShortlist={() => toggleShortlist(creator.id)} onView={() => setSelectedCreator(creator)} compact />)}</div>
      </section>
      {selectedCreator && <CreatorDetails creator={selectedCreator} onClose={() => setSelectedCreator(null)} isShortlisted={shortlist.includes(selectedCreator.id)} onToggleShortlist={() => toggleShortlist(selectedCreator.id)} />}
    </div>
  );
}

function StatCard({ label, value, note, icon, accent = "blue" }: { label: string; value: string; note: string; icon: React.ReactNode; accent?: string }) {
  return <article className="stat-card"><div className={`stat-icon stat-${accent}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>;
}
