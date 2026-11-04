"use client";

import { useEffect, useMemo, useState } from "react";
import { Grid2X2, List, Search, SlidersHorizontal, X } from "lucide-react";
import creators from "@/data/creators.json";
import type { Creator, Location, Niche } from "@/types/creator";
import { LOCATIONS, NICHES } from "@/types/creator";
import { filterCreators, type CreatorFilters } from "@/lib/filters";
import { useAppData } from "@/components/AppProvider";
import { CreatorCard } from "@/components/creators/CreatorCard";
import { CreatorDetails } from "@/components/creators/CreatorDetails";
import { PageHeading } from "@/components/layout/AppLayout";

const directory = creators as Creator[];
const emptyFilters: CreatorFilters = { niche: "", location: "", minFollowers: "", maxFollowers: "", minEngagement: "", platform: "", query: "" };

export function DiscoverPage() {
  const [filters, setFilters] = useState<CreatorFilters>(emptyFilters);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Creator | null>(null);
  const [notice, setNotice] = useState("");
  const { shortlist, toggleShortlist } = useAppData();
  const results = useMemo(() => filterCreators(directory, filters), [filters]);
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

  function toggleAndNotify(creatorId: string) {
    const added = !shortlist.includes(creatorId);
    toggleShortlist(creatorId);
    setNotice(added ? "Added to your shortlist" : "Removed from your shortlist");
    window.setTimeout(() => setNotice(""), 2200);
  }

  return (
    <div className="page-stack">
      <PageHeading eyebrow="THE CREATOR DIRECTORY" title="Discover creators" description="Find the right voice for your next campaign from our curated creator directory." action={<span className="demo-pill large-pill">{directory.length} SAMPLE PROFILES</span>} />
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
        <div className="filter-footnote"><span><span className="online-dot" /> Sample data only</span><span>All results update as you refine your filters</span></div>
      </section>
      <div className="results-toolbar"><div><h2>Creators <span>{results.length}</span></h2><p>Showing {results.length} of {directory.length} sample creators</p></div><div className="view-switch" aria-label="View mode"><button className={view === "grid" ? "view-active" : ""} onClick={() => setView("grid")} aria-label="Grid view"><Grid2X2 size={16} /></button><button className={view === "list" ? "view-active" : ""} onClick={() => setView("list")} aria-label="List view"><List size={17} /></button></div></div>
      {results.length ? <div className={`creator-grid ${view === "list" ? "creator-list" : ""}`}>{results.map((creator) => <CreatorCard key={creator.id} creator={creator} shortlisted={shortlist.includes(creator.id)} onToggleShortlist={() => toggleAndNotify(creator.id)} onView={() => setSelected(creator)} compact={view === "list"} />)}</div> : <div className="empty-state"><div className="empty-icon"><Search size={21} /></div><h3>No creators match those filters</h3><p>Try widening your follower range or clearing one of the selected filters.</p><button className="button button-secondary" onClick={clearFilters}>Clear all filters</button></div>}
      {selected && <CreatorDetails creator={selected} onClose={() => setSelected(null)} isShortlisted={shortlist.includes(selected.id)} onToggleShortlist={() => toggleAndNotify(selected.id)} />}
      {notice && <div className="toast-message" role="status">{notice}</div>}
    </div>
  );
}
