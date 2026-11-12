"use client";

import { useState, type FormEvent } from "react";
import { LOCATIONS, NICHES, type Creator, type CreatorProfileInput, type Location, type Niche } from "@/types/creator";
import { Modal } from "@/components/ui/Modal";

export function CreatorForm({
  initial,
  creators,
  onClose,
  onSave,
}: {
  initial?: Creator;
  creators: Creator[];
  onClose: () => void;
  onSave: (creator: CreatorProfileInput) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [niche, setNiche] = useState<Niche>(initial?.niche ?? "Lifestyle");
  const [subNiche, setSubNiche] = useState(initial?.subNiche ?? "");
  const [location, setLocation] = useState<Location>(initial?.location ?? "Bangalore");
  const [state, setState] = useState(initial?.state ?? "");
  const [followers, setFollowers] = useState(String(initial?.followers ?? ""));
  const [engagementRate, setEngagementRate] = useState(String(initial?.engagementRate ?? ""));
  const [averageViews, setAverageViews] = useState(String(initial?.averageViews ?? ""));
  const [averageLikes, setAverageLikes] = useState(String(initial?.averageLikes ?? 0));
  const [averageComments, setAverageComments] = useState(String(initial?.averageComments ?? 0));
  const [email, setEmail] = useState(initial?.email ?? "");
  const [bio, setBio] = useState(initial?.bio ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "English");
  const [audienceType, setAudienceType] = useState(initial?.audienceType ?? "General");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanUsername = username.trim().replace(/^@/, "");
    const cleanEmail = email.trim();
    const followerCount = Number(followers);
    const engagement = Number(engagementRate);
    const views = Number(averageViews);
    const likes = Number(averageLikes);
    const comments = Number(averageComments);

    if (cleanName.length < 2) {
      setError("Enter a creator name with at least two characters.");
      return;
    }
    if (!/^[\w.]{1,30}$/.test(cleanUsername)) {
      setError("Use a valid Instagram username (letters, numbers, periods, or underscores).");
      return;
    }
    if (creators.some((creator) => creator.id !== initial?.id && creator.username.toLowerCase() === cleanUsername.toLowerCase())) {
      setError("That username is already in the creator directory.");
      return;
    }
    if (
      !Number.isSafeInteger(followerCount) ||
      followerCount < 0 ||
      !Number.isFinite(engagement) ||
      engagement < 0 ||
      engagement > 100 ||
      ![views, likes, comments].every((value) => Number.isSafeInteger(value) && value >= 0)
    ) {
      setError("Enter valid non-negative whole-number metrics and an engagement rate from 0 to 100.");
      return;
    }
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid contact email or leave it blank.");
      return;
    }
    if (!bio.trim()) {
      setError("Add a short creator bio.");
      return;
    }

    const initials = cleanName
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
    setSaving(true);
    const saved = await onSave({
      name: cleanName,
      username: cleanUsername,
      platform: "Instagram",
      niche,
      subNiche: subNiche.trim() || niche,
      location,
      state: state.trim(),
      followers: followerCount,
      engagementRate: Math.round(engagement * 10) / 10,
      averageViews: views,
      averageLikes: likes,
      averageComments: comments,
      email: cleanEmail || null,
      bio: bio.trim(),
      profileUrl: `https://www.instagram.com/${cleanUsername}/`,
      avatar: initials,
      language: language.trim() || "Not specified",
      audienceType: audienceType.trim() || "Not specified",
    });
    setSaving(false);
    if (!saved) setError("The creator could not be saved. Review the workspace error and try again.");
  }

  return (
    <Modal
      title={initial ? "Edit creator" : "Add a creator"}
      description="Creator data is shared with authorized workspace members and is not independently verified."
      onClose={onClose}
      wide
    >
      <form className="campaign-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field">
            <span>Creator name</span>
            <input required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span>Instagram username</span>
            <input required maxLength={31} value={username} onChange={(event) => setUsername(event.target.value)} placeholder="creator_username" />
          </label>
          <label className="field">
            <span>Niche</span>
            <select value={niche} onChange={(event) => setNiche(event.target.value as Niche)}>{NICHES.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="field">
            <span>Sub-niche</span>
            <input maxLength={50} value={subNiche} onChange={(event) => setSubNiche(event.target.value)} placeholder="e.g. strength training" />
          </label>
          <label className="field">
            <span>Location</span>
            <select value={location} onChange={(event) => setLocation(event.target.value as Location)}>{LOCATIONS.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <label className="field">
            <span>State</span>
            <input maxLength={50} value={state} onChange={(event) => setState(event.target.value)} placeholder="State or region" />
          </label>
          <label className="field">
            <span>Followers</span>
            <input type="number" min="0" step="1" required value={followers} onChange={(event) => setFollowers(event.target.value)} />
          </label>
          <label className="field">
            <span>Engagement rate (%)</span>
            <input type="number" min="0" max="100" step="0.1" required value={engagementRate} onChange={(event) => setEngagementRate(event.target.value)} />
          </label>
          <label className="field">
            <span>Average views</span>
            <input type="number" min="0" step="1" required value={averageViews} onChange={(event) => setAverageViews(event.target.value)} />
          </label>
          <label className="field">
            <span>Average likes</span>
            <input type="number" min="0" step="1" value={averageLikes} onChange={(event) => setAverageLikes(event.target.value)} />
          </label>
          <label className="field">
            <span>Average comments</span>
            <input type="number" min="0" step="1" value={averageComments} onChange={(event) => setAverageComments(event.target.value)} />
          </label>
          <label className="field">
            <span>Business contact email (optional)</span>
            <input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="field">
            <span>Language</span>
            <input maxLength={80} value={language} onChange={(event) => setLanguage(event.target.value)} />
          </label>
          <label className="field">
            <span>Audience type</span>
            <input maxLength={80} value={audienceType} onChange={(event) => setAudienceType(event.target.value)} />
          </label>
          <label className="field form-full">
            <span>Bio</span>
            <textarea required rows={3} maxLength={300} value={bio} onChange={(event) => setBio(event.target.value)} />
          </label>
        </div>
        <p className="integration-footnote">Any contact email is stored only as creator profile data; Resend always uses the configured test recipient.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="button button-primary" disabled={saving}>{saving ? "Saving..." : initial ? "Save changes" : "Add creator"}</button>
        </div>
      </form>
    </Modal>
  );
}
