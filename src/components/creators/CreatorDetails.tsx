"use client";

import { ExternalLink, MapPin, UsersRound, Eye, Heart, Mail, Camera, MessageCircle, Languages, Users, Pencil, Trash2 } from "lucide-react";
import type { Creator } from "@/types/creator";
import { formatCount } from "@/lib/utils";
import { Modal } from "@/components/ui/Modal";

export function CreatorDetails({
  creator,
  onClose,
  isShortlisted,
  onToggleShortlist,
  onEdit,
  onDelete,
}: {
  creator: Creator;
  onClose: () => void;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <Modal title="Creator profile" description="Sample metrics are fictional; user-entered profile details are unverified." onClose={onClose}>
      <div className="creator-detail">
        <div className="detail-profile">
          <div className={`creator-avatar avatar-large avatar-${creator.niche.toLowerCase()}`}>{creator.avatar}</div>
          <div><h3>{creator.name}</h3><span className="muted">@{creator.username}</span></div>
        </div>
        <div className="detail-demo-banner"><span className="demo-pill">{creator.dataSource === "Demo Dataset" ? "DEMO DATA" : "USER-ADDED"}</span><span>{creator.dataSource === "Demo Dataset" ? "Fictional profile for product demonstration. Metrics are not verified." : "User-entered profile information. Details and metrics are not verified."}</span></div>
        <p className="detail-bio">{creator.bio}</p>
        <div className="detail-stats">
          <div><UsersRound size={17} /><strong>{formatCount(creator.followers)}</strong><span>Followers</span></div>
          <div><Heart size={17} /><strong>{creator.engagementRate}%</strong><span>Engagement</span></div>
          <div><Eye size={17} /><strong>{formatCount(creator.averageViews)}</strong><span>Avg. views</span></div>
        </div>
        <div className="detail-info-row"><span>Average likes</span><strong><Heart size={14} /> {formatCount(creator.averageLikes)}</strong></div>
        <div className="detail-info-row"><span>Average comments</span><strong><MessageCircle size={14} /> {formatCount(creator.averageComments)}</strong></div>
        <div className="detail-info-row"><span>Platform</span><strong><Camera size={14} /> {creator.platform}</strong></div>
        <div className="detail-info-row"><span>Niche</span><strong>{creator.niche} <span className="detail-subniche">· {creator.subNiche}</span></strong></div>
        <div className="detail-info-row"><span>Location</span><strong><MapPin size={14} /> {creator.location}, {creator.state}</strong></div>
        <div className="detail-info-row"><span>Language</span><strong><Languages size={14} /> {creator.language}</strong></div>
        <div className="detail-info-row"><span>Audience</span><strong><Users size={14} /> {creator.audienceType}</strong></div>
        <div className="detail-info-row"><span>Business contact</span><strong><Mail size={14} /> {creator.email ? `${creator.email} · ${creator.dataSource === "Demo Dataset" ? "Demo address" : "User-entered, unverified"}` : "Not listed"}</strong></div>
        <div className="detail-info-row"><span>Data source</span><strong>{creator.dataSource} · Updated {creator.lastUpdated}</strong></div>
        <div className="modal-actions">
          <a className="button button-secondary" href={creator.profileUrl} target="_blank" rel="noreferrer"><Camera size={16} /> View Instagram profile <ExternalLink size={14} /></a>
          <button className="button button-primary" onClick={onToggleShortlist}>{isShortlisted ? "Remove from shortlist" : "Add to shortlist"}</button>
        </div>
        {(onEdit || onDelete) && (
          <div className="creator-management-actions">
            {onEdit && <button className="text-button" onClick={onEdit}><Pencil size={13} /> Edit creator</button>}
            {onDelete && <button className="text-button creator-delete-action" onClick={onDelete}><Trash2 size={13} /> Delete creator</button>}
          </div>
        )}
        <p className="demo-disclaimer">{creator.dataSource === "Demo Dataset" ? "Demo record only. Profile, contact address, and audience metrics are fictional and unverified." : "User-entered record. Profile, contact address, and audience metrics have not been independently verified."}</p>
      </div>
    </Modal>
  );
}
