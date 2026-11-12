"use client";

import { Eye, Heart, MapPin, UsersRound } from "lucide-react";
import type { Creator } from "@/types/creator";
import { formatCount } from "@/lib/utils";

export function CreatorCard({
  creator,
  shortlisted,
  onToggleShortlist,
  onView,
  compact = false,
}: {
  creator: Creator;
  shortlisted: boolean;
  onToggleShortlist: () => void;
  onView: () => void;
  compact?: boolean;
}) {
  return (
    <article className={`creator-card ${compact ? "creator-card-compact" : ""}`}>
      <div className="creator-card-top">
        <div className={`creator-avatar avatar-${creator.niche.toLowerCase()}`}>{creator.avatar}</div>
        <button className={`save-button ${shortlisted ? "save-active" : ""}`} onClick={onToggleShortlist} aria-label={shortlisted ? "Remove from shortlist" : "Add to shortlist"}>
          <Heart size={17} fill={shortlisted ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="creator-card-name"><h3>{creator.name}</h3><span className="demo-pill">{creator.dataSource === "Demo Dataset" ? "DEMO" : "USER-ADDED"}</span></div>
      <a className="creator-handle" href={creator.profileUrl} target="_blank" rel="noreferrer">@{creator.username}</a>
      <div className="creator-tags"><span className="tag">{creator.niche}</span><span className="location-tag"><MapPin size={12} />{creator.location}</span></div>
      <div className="creator-metrics">
        <div><UsersRound size={15} /><strong>{formatCount(creator.followers)}</strong><span>Followers</span></div>
        <div><Heart size={15} /><strong>{creator.engagementRate}%</strong><span>Engagement</span></div>
        <div><Eye size={15} /><strong>{formatCount(creator.averageViews)}</strong><span>Avg. views</span></div>
      </div>
      <div className="creator-card-footer">
        <span className={`contact-label ${creator.email ? "" : "contact-muted"}`}>{creator.email ? "Demo email only" : "No demo email"}</span>
        <button className="text-button" onClick={onView}>View profile <span>→</span></button>
      </div>
    </article>
  );
}
