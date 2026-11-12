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
import type { Creator } from "@/types/creator";
import { useAppData } from "@/components/AppProvider";
import { CreatorCard } from "@/components/creators/CreatorCard";
import { CreatorDetails } from "@/components/creators/CreatorDetails";
import { PageHeading } from "@/components/layout/AppLayout";
import { formatDate } from "@/lib/utils";
import { useState } from "react";
import { DemoDataNotice } from "@/components/creators/DemoDataNotice";

export function DashboardPage() {
  const { creators: creatorList, campaigns, shortlist, outreach, ready, resetWorkspace, toggleShortlist } = useAppData();
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);
  const recentCreators = creatorList.slice(0, 3);
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "Active").length;
  const sentOutreach = outreach.filter((item) => item.status === "Sent (Demo)").length;
  const latestCampaigns = campaigns.slice(0, 4);
  const activity = outreach.slice(0, 4);

  async function resetDemoWorkspace() {
    const confirmed = window.confirm(
      "Reset this shared workspace? This permanently clears campaigns, shortlists, outreach drafts, notes, and message history for every workspace member. Creator profiles, templates, and email delivery records will remain.",
    );
    if (!confirmed) return;
    await resetWorkspace();
  }

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="YOUR CREATOR WORKSPACE"
        title="Welcome to CreatorFlow"
        description="A local demo workspace for discovering creators and organizing outreach."
        action={<Link className="button button-primary" href="/campaigns?new=1"><Plus size={17} /> Create campaign</Link>}
      />
      <DemoDataNotice count={creatorList.length} demoCount={creatorList.filter((creator) => creator.dataSource === "Demo Dataset").length} />
      <section className="welcome-strip">
        <div className="welcome-copy">
          <div className="welcome-overline"><span className="welcome-spark"><UsersRound size={15} /></span> START WITH A SIMPLE WORKFLOW</div>
          <h2>Discover. Shortlist.<br /><em>Start a conversation.</em></h2>
          <p>Explore fictional sample profiles, organize a campaign, and prepare creator-specific outreach drafts.</p>
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
        <StatCard label="Total creators" value={creatorList.length.toString()} note="Demo and user-added profiles" icon={<UsersRound size={18} />} />
        <StatCard label="Active campaigns" value={String(activeCampaigns)} note={`${campaigns.length} total campaigns`} icon={<CheckCircle2 size={18} />} accent="green" />
        <StatCard label="Shortlisted creators" value={String(shortlist.length)} note="Ready for a campaign" icon={<Clock3 size={18} />} accent="purple" />
        <StatCard label="Sent status" value={String(sentOutreach)} note="Manual/demo status only" icon={<Send size={18} />} accent="orange" />
      </section>
      <section className="getting-started panel">
        <div className="getting-started-heading">
          <div><h2>Quick start</h2><p>Try the core workflow with sample creators. No setup is needed.</p></div>
          <button className="button button-secondary button-small" onClick={resetDemoWorkspace} disabled={!ready}>Reset workspace data</button>
        </div>
        <div className="getting-started-steps">
          <Link href="/discover"><span>1</span><div><strong>Discover creators</strong><small>Filter profiles and add a few to your shortlist.</small></div><ArrowRight size={15} /></Link>
          <Link href="/campaigns?new=1"><span>2</span><div><strong>Create a campaign</strong><small>Set a brand, niche, location, and creator target.</small></div><ArrowRight size={15} /></Link>
          <Link href="/shortlist"><span>3</span><div><strong>Prepare outreach</strong><small>Assign creators to the campaign and edit their drafts.</small></div><ArrowRight size={15} /></Link>
        </div>
        <p className="getting-started-note">Workspace reset clears campaigns, shortlist, and outreach notes/drafts for all members. It preserves creator profiles, templates, and server-side email delivery history.</p>
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
        {recentCreators.length ? <div className="creator-grid dashboard-creator-grid">{recentCreators.map((creator) => <CreatorCard key={creator.id} creator={creator} shortlisted={shortlist.includes(creator.id)} onToggleShortlist={() => toggleShortlist(creator.id)} onView={() => setSelectedCreator(creator)} compact />)}</div> : <div className="empty-inline"><strong>No creator profiles</strong><span>Add a creator in Discover to start building your directory.</span><Link className="text-button" href="/discover">Open creator directory <ArrowRight size={14} /></Link></div>}
      </section>
      {selectedCreator && <CreatorDetails creator={selectedCreator} onClose={() => setSelectedCreator(null)} isShortlisted={shortlist.includes(selectedCreator.id)} onToggleShortlist={() => toggleShortlist(selectedCreator.id)} />}
    </div>
  );
}

function StatCard({ label, value, note, icon, accent = "blue" }: { label: string; value: string; note: string; icon: React.ReactNode; accent?: string }) {
  return <article className="stat-card"><div className={`stat-icon stat-${accent}`}>{icon}</div><span className="stat-label">{label}</span><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>;
}
