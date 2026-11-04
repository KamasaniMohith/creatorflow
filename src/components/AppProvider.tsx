"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { storage } from "@/lib/storage";
import type { Campaign, CampaignStatus } from "@/types/campaign";
import type { Outreach } from "@/types/outreach";
import type { Creator } from "@/types/creator";
import creators from "@/data/creators.json";
import { createId } from "@/lib/utils";
import { generateMessage } from "@/lib/message-generator";

interface AppContextValue {
  campaigns: Campaign[];
  shortlist: string[];
  outreach: Outreach[];
  ready: boolean;
  toggleShortlist: (creatorId: string) => void;
  createCampaign: (campaign: Omit<Campaign, "id" | "createdAt">) => void;
  updateCampaign: (campaign: Campaign) => void;
  deleteCampaign: (campaignId: string) => void;
  addCreatorsToCampaign: (campaignId: string, creatorIds: string[]) => void;
  createOutreach: (creatorIds: string[], campaignId: string | null) => number;
  updateOutreach: (id: string, updates: Partial<Outreach>) => void;
  updateCampaignStatus: (id: string, status: CampaignStatus) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCampaigns(storage.loadCampaigns());
      setShortlist(storage.loadShortlist());
      setOutreach(storage.loadOutreach());
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready) storage.saveCampaigns(campaigns);
  }, [campaigns, ready]);
  useEffect(() => {
    if (ready) storage.saveShortlist(shortlist);
  }, [shortlist, ready]);
  useEffect(() => {
    if (ready) storage.saveOutreach(outreach);
  }, [outreach, ready]);

  const toggleShortlist = useCallback((creatorId: string) => {
    setShortlist((current) =>
      current.includes(creatorId)
        ? current.filter((id) => id !== creatorId)
        : [...current, creatorId],
    );
  }, []);

  const createCampaign = useCallback(
    (campaign: Omit<Campaign, "id" | "createdAt">) => {
      setCampaigns((current) => [
        { ...campaign, id: createId("campaign"), createdAt: new Date().toISOString() },
        ...current,
      ]);
    },
    [],
  );

  const updateCampaign = useCallback((campaign: Campaign) => {
    setCampaigns((current) =>
      current.map((item) => (item.id === campaign.id ? campaign : item)),
    );
  }, []);

  const deleteCampaign = useCallback((campaignId: string) => {
    setCampaigns((current) => current.filter((item) => item.id !== campaignId));
    setOutreach((current) =>
      current.map((item) =>
        item.campaignId === campaignId ? { ...item, campaignId: null } : item,
      ),
    );
  }, []);

  const addCreatorsToCampaign = useCallback(
    (campaignId: string, creatorIds: string[]) => {
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                creatorIds: Array.from(
                  new Set([...campaign.creatorIds, ...creatorIds]),
                ),
              }
            : campaign,
        ),
      );
    },
    [],
  );

  const createOutreach = useCallback(
    (creatorIds: string[], campaignId: string | null) => {
      const campaign = campaigns.find((item) => item.id === campaignId);
      const next = creatorIds.flatMap((creatorId) => {
        const creator = (creators as Creator[]).find(
          (item) => item.id === creatorId,
        );
        if (!creator) return [];
        const existing = outreach.find(
          (item) => item.creatorId === creatorId && item.campaignId === campaignId,
        );
        if (existing) return [];
        return [
          {
            id: createId("outreach"),
            creatorId,
            campaignId,
            contactMethod: creator.email ? "Email" as const : "Instagram DM" as const,
            message: generateMessage(creator, campaign?.brand || "your brand"),
            status: "Draft" as const,
            createdAt: new Date().toISOString(),
          },
        ];
      });
      if (next.length) setOutreach((current) => [...next, ...current]);
      return next.length;
    },
    [campaigns, outreach],
  );

  const updateOutreach = useCallback((id: string, updates: Partial<Outreach>) => {
    setOutreach((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    );
  }, []);

  const updateCampaignStatus = useCallback(
    (id: string, status: CampaignStatus) => {
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === id ? { ...campaign, status } : campaign,
        ),
      );
    },
    [],
  );

  const value = useMemo(
    () => ({
      campaigns,
      shortlist,
      outreach,
      ready,
      toggleShortlist,
      createCampaign,
      updateCampaign,
      deleteCampaign,
      addCreatorsToCampaign,
      createOutreach,
      updateOutreach,
      updateCampaignStatus,
    }),
    [
      campaigns,
      shortlist,
      outreach,
      ready,
      toggleShortlist,
      createCampaign,
      updateCampaign,
      deleteCampaign,
      addCreatorsToCampaign,
      createOutreach,
      updateOutreach,
      updateCampaignStatus,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppData(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppData must be used within AppProvider.");
  return context;
}
