"use client";

import { ExternalLink, MapPin, UsersRound, Eye, Heart, Mail, Camera } from "lucide-react";
import type { Creator } from "@/types/creator";
import { formatCount } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

export function CreatorDetails({
  creator,
  onClose,
  isShortlisted,
  onToggleShortlist,
}: {
  creator: Creator;
  onClose: () => void;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
}) {
  return (
    <Modal title="Creator profile" description="A closer look at this demo creator." onClose={onClose}>
      <div className="creator-detail">
        <div className="detail-profile">
          <div className="creator-avatar avatar-large">{creator.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
          <div><h3>{creator.name}</h3><span className="muted">@{creator.username}</span></div>
        </div>
        <span className="demo-pill">DEMO RECORD</span>
        <p className="detail-bio">{creator.bio}</p>
        <div className="detail-stats">
          <div><UsersRound size={17} /><strong>{formatCount(creator.followers)}</strong><span>Followers</span></div>
          <div><Heart size={17} /><strong>{creator.engagementRate}%</strong><span>Engagement</span></div>
          <div><Eye size={17} /><strong>{formatCount(creator.averageViews)}</strong><span>Avg. views</span></div>
        </div>
        <div className="detail-info-row"><span>Niche</span><strong>{creator.niche}</strong></div>
        <div className="detail-info-row"><span>Location</span><strong><MapPin size={14} /> {creator.location}</strong></div>
        <div className="detail-info-row"><span>Business contact</span><strong><Mail size={14} /> {creator.email || "Not publicly listed"}</strong></div>
        <div className="modal-actions">
          <a className="button button-secondary" href={creator.profileUrl} target="_blank" rel="noreferrer"><Camera size={16} /> View Instagram <ExternalLink size={14} /></a>
          <button className="button button-primary" onClick={onToggleShortlist}>{isShortlisted ? "Remove from shortlist" : "Add to shortlist"}</button>
        </div>
        <p className="demo-disclaimer">Sample record for product demonstration. Not a real creator profile.</p>
      </div>
    </Modal>
  );
}
