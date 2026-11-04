"use client";

import { useState, type FormEvent } from "react";
import { LOCATIONS, NICHES, type Location, type Niche } from "@/types/creator";
import type { Campaign, CampaignStatus } from "@/types/campaign";
import { Modal } from "@/components/ui/Modal";

export type CampaignInput = Omit<Campaign, "id" | "createdAt">;

export function CampaignForm({
  initial,
  onClose,
  onSave,
}: {
  initial?: Campaign;
  onClose: () => void;
  onSave: (campaign: CampaignInput) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [niche, setNiche] = useState<Niche>(initial?.niche ?? "Lifestyle");
  const [location, setLocation] = useState<Location>(initial?.location ?? "Bangalore");
  const [minFollowers, setMinFollowers] = useState(String(initial?.minFollowers ?? 10000));
  const [maxFollowers, setMaxFollowers] = useState(String(initial?.maxFollowers ?? 100000));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<CampaignStatus>(initial?.status ?? "Draft");
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = Number(minFollowers);
    const max = Number(maxFollowers);
    if (min < 0 || max < min) {
      setError("Maximum followers must be greater than or equal to the minimum.");
      return;
    }
    onSave({
      name: name.trim(),
      brand: brand.trim(),
      niche,
      location,
      minFollowers: min,
      maxFollowers: max,
      description: description.trim(),
      status,
      creatorIds: initial?.creatorIds ?? [],
    });
  }

  return (
    <Modal title={initial ? "Edit campaign" : "Create a campaign"} description="Set a clear brief to find the creators who fit." onClose={onClose} wide>
      <form className="campaign-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field"><span>Campaign name</span><input required maxLength={70} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Summer essentials" /></label>
          <label className="field"><span>Client / brand name</span><input required maxLength={60} value={brand} onChange={(event) => setBrand(event.target.value)} placeholder="e.g. Northstar Goods" /></label>
          <label className="field"><span>Campaign niche</span><select value={niche} onChange={(event) => setNiche(event.target.value as Niche)}>{NICHES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Target location</span><select value={location} onChange={(event) => setLocation(event.target.value as Location)}>{LOCATIONS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Minimum followers</span><input type="number" min="0" required value={minFollowers} onChange={(event) => setMinFollowers(event.target.value)} /></label>
          <label className="field"><span>Maximum followers</span><input type="number" min="0" required value={maxFollowers} onChange={(event) => setMaxFollowers(event.target.value)} /></label>
          {initial && <label className="field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value as CampaignStatus)}><option>Draft</option><option>Active</option><option>Completed</option></select></label>}
          <label className="field form-full"><span>Campaign description</span><textarea rows={3} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Share the goals, story, and details creators should know..." /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">{initial ? "Save changes" : "Create campaign"}</button></div>
      </form>
    </Modal>
  );
}
