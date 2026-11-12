"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, Grid2X2, List, Search, SlidersHorizontal, X } from "lucide-react";
import type { Creator, Location, Niche } from "@/types/creator";
import { LOCATIONS, NICHES } from "@/types/creator";
import { filterCreators, type CreatorFilters } from "@/lib/filters";
import { useAppData } from "@/components/AppProvider";
import { CreatorCard } from "@/components/creators/CreatorCard";
import { CreatorDetails } from "@/components/creators/CreatorDetails";
import { CreatorForm } from "@/components/creators/CreatorForm";
import { PageHeading } from "@/components/layout/AppLayout";
import { DemoDataNotice } from "@/components/creators/DemoDataNotice";

const emptyFilters: CreatorFilters = { niche: "", location: "", minFollowers: "", maxFollowers: "", minEngagement: "", platform: "", query: "" };
type CreatorSort = "followers-desc" | "followers-asc" | "engagement-desc" | "engagement-asc";

export function DiscoverPage() {
  const [filters, setFilters] = useState<CreatorFilters>(emptyFilters);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [sort, setSort] = useState<CreatorSort>("followers-desc");
  const [selected, setSelected] = useState<Creator | null>(null);
  const [creatorForm, setCreatorForm] = useState<{ initial?: Creator } | null>(null);
  const [notice, setNotice] = useState("");
  const {
    creators: directory,
    campaigns,
    outreach,
    shortlist,
    toggleShortlist,
    addCreator,
    updateCreator,
    deleteCreator,
  } = useAppData();
  const matchingCreators = useMemo(() => filterCreators(directory, filters), [directory, filters]);
  const results = useMemo(() => [...matchingCreators].sort((a, b) => {
    switch (sort) {
      case "followers-asc": return a.followers - b.followers;
      case "engagement-desc": return b.engagementRate - a.engagementRate;
      case "engagement-asc": return a.engagementRate - b.engagementRate;
      default: return b.followers - a.followers;
    }
  }), [matchingCreators, sort]);
  const filterCount = Object.values(filters).filter(Boolean).length;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = new URLSearchParams(window.location.search).get("search");
      if (query) setFilters((current) => ({ ...current, query }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function update<K extends keyof CreatorFilters>(key: K, value: CreatorFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearFilters() {
    setFilters(emptyFilters);
  }

  async function toggleAndNotify(creatorId: string) {
    const added = !shortlist.includes(creatorId);
    if (!(await toggleShortlist(creatorId))) return;
    setNotice(added ? "Added to your shortlist" : "Removed from your shortlist");
    window.setTimeout(() => setNotice(""), 2200);
  }

  async function saveCreator(input: Omit<Creator, "id" | "lastUpdated" | "dataSource">) {
    if (creatorForm?.initial) {
      const saved = await updateCreator({
        ...input,
        id: creatorForm.initial.id,
        dataSource: creatorForm.initial.dataSource,
        lastUpdated: creatorForm.initial.lastUpdated,
      });
      if (!saved) return false;
      setNotice("Creator profile updated.");
    } else {
      if (!(await addCreator(input))) return false;
      setNotice("Creator added to your directory.");
    }
    setCreatorForm(null);
    window.setTimeout(() => setNotice(""), 2600);
    return true;
  }

  async function removeCreator(creator: Creator) {
    if (creator.dataSource === "Demo Dataset") {
      setNotice("Bundled demo creators are read-only and cannot be deleted.");
      window.setTimeout(() => setNotice(""), 3500);
      return;
    }
    const relatedOutreach = outreach.filter((item) => item.creatorId === creator.id).length;
    if (relatedOutreach) {
      setNotice("This creator has outreach history. Keep the profile so those records remain understandable.");
      window.setTimeout(() => setNotice(""), 3500);
      return;
    }
    const campaignCount = campaigns.filter((campaign) => campaign.creatorIds.includes(creator.id)).length;
    const confirmation = campaignCount
      ? `Delete ${creator.name}? This also removes the creator from ${campaignCount} campaign${campaignCount === 1 ? "" : "s"} and the shortlist.`
      : `Delete ${creator.name}? This also removes the creator from your shortlist.`;
    if (!window.confirm(`${confirmation} This action cannot be undone.`)) return;
    if (!(await deleteCreator(creator.id))) {
      setNotice("This creator has outreach history and cannot be deleted.");
      return;
    }
    setSelected(null);
    setNotice("Creator deleted.");
    window.setTimeout(() => setNotice(""), 2600);
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="THE CREATOR DIRECTORY" title="Discover creators" description="Find the right voice for your next campaign from the sample directory or add a profile." action={<div className="directory-heading-actions"><span className="demo-pill large-pill">{directory.length} PROFILES</span><button className="button button-primary" onClick={() => setCreatorForm({})}>Add creator</button></div>} />
      <DemoDataNotice count={directory.length} demoCount={directory.filter((creator) => creator.dataSource === "Demo Dataset").length} />
      <div className="directory-intro">
        <div className="directory-icon"><SlidersHorizontal size={19} /></div>
        <div><strong>Thoughtful discovery starts with a good brief.</strong><span>Use the filters to find creators by niche, location and audience size.</span></div>
      </div>
      <section className="filter-panel">
        <div className="filter-panel-heading"><div><h2>Refine your search</h2><span>{filterCount ? `${filterCount} filters applied` : "Filter the directory to find your fit"}</span></div><button className="text-button clear-button" onClick={clearFilters}><X size={14} /> Clear filters</button></div>
        <div className="filter-grid">
          <label className="field"><span>Niche</span><select value={filters.niche} onChange={(event) => update("niche", event.target.value as Niche | "")}><option value="">All niches</option>{NICHES.map((niche) => <option key={niche}>{niche}</option>)}</select></label>
          <label className="field"><span>Location</span><select value={filters.location} onChange={(event) => update("location", event.target.value as Location | "")}><option value="">All locations</option>{LOCATIONS.map((location) => <option key={location}>{location}</option>)}</select></label>
          <label className="field"><span>Min. followers</span><input type="number" min="0" placeholder="e.g. 10,000" value={filters.minFollowers} onChange={(event) => update("minFollowers", event.target.value)} /></label>
          <label className="field"><span>Max. followers</span><input type="number" min="0" placeholder="e.g. 100,000" value={filters.maxFollowers} onChange={(event) => update("maxFollowers", event.target.value)} /></label>
          <label className="field"><span>Min. engagement</span><div className="input-suffix"><input type="number" min="0" step="0.1" placeholder="e.g. 3.5" value={filters.minEngagement} onChange={(event) => update("minEngagement", event.target.value)} /><span>%</span></div></label>
          <label className="field"><span>Platform</span><select value={filters.platform} onChange={(event) => update("platform", event.target.value)}><option value="">All platforms</option><option value="Instagram">Instagram</option></select></label>
          <label className="field search-field"><span>Creator name or username</span><div className="input-icon"><Search size={16} /><input placeholder="Search creators..." value={filters.query} onChange={(event) => update("query", event.target.value)} /></div></label>
        </div>
        <div className="filter-footnote"><span><span className="online-dot" /> Demo data + workspace profiles</span><span>All results update as you refine your filters</span></div>
      </section>
      <div className="results-toolbar"><div><h2>Matching creators <span>{matchingCreators.length}</span></h2><p>Showing {results.length} of {directory.length} creators</p></div><div className="results-controls"><label className="sort-picker"><ArrowDownWideNarrow size={15} /><span>Sort by</span><select aria-label="Sort creators" value={sort} onChange={(event) => setSort(event.target.value as CreatorSort)}><option value="followers-desc">Followers: high to low</option><option value="followers-asc">Followers: low to high</option><option value="engagement-desc">Engagement: high to low</option><option value="engagement-asc">Engagement: low to high</option></select></label><div className="view-switch" aria-label="View mode"><button className={view === "grid" ? "view-active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={16} /></button><button className={view === "list" ? "view-active" : ""} onClick={() => setView("list")} aria-label="List view"><List size={17} /></button></div></div></div>
      {results.length ? <div className={`creator-grid ${view === "list" ? "creator-list" : ""}`}>{results.map((creator) => <CreatorCard key={creator.id} creator={creator} shortlisted={shortlist.includes(creator.id)} onToggleShortlist={() => toggleAndNotify(creator.id)} onView={() => setSelected(creator)} compact={view === "list"} />)}</div> : <div className="empty-state"><div className="empty-icon"><Search size={21} /></div><h3>No creators match those filters</h3><p>Try widening your follower range or clearing one of the selected filters.</p><button className="button button-secondary" onClick={clearFilters}>Clear all filters</button></div>}
      {selected && <CreatorDetails
        creator={selected}
        onClose={() => setSelected(null)}
        isShortlisted={shortlist.includes(selected.id)}
        onToggleShortlist={() => toggleAndNotify(selected.id)}
        onEdit={() => { setCreatorForm({ initial: selected }); setSelected(null); }}
        onDelete={() => removeCreator(selected)}
      />}
      {creatorForm && <CreatorForm
        initial={creatorForm.initial}
        creators={directory}
        onClose={() => setCreatorForm(null)}
        onSave={saveCreator}
      />}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </div>
  );
}
