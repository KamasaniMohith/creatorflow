"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Campaign, CampaignStatus } from "@/types/campaign";
import type { Outreach, OutreachChannel, OutreachEventType } from "@/types/outreach";
import type { MessageTemplate } from "@/types/outreach";
import type { Creator, CreatorProfileInput } from "@/types/creator";
import creatorData from "@/data/creators.json";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/data/message-templates";
import { useAuth } from "@/components/AuthProvider";
import { useWorkspace } from "@/components/WorkspaceProvider";
import {
  addWorkspaceCreatorsToCampaign,
  addWorkspaceOutreachEvent,
  createWorkspaceCampaign,
  createWorkspaceCreator,
  createWorkspaceOutreach,
  deleteWorkspaceCampaign,
  deleteWorkspaceCreator,
  isWorkspaceEditor,
  loadWorkspaceData,
  resetWorkspaceData,
  toOutreachEvent,
  toggleWorkspaceShortlist,
  updateWorkspaceCampaign,
  updateWorkspaceCreator,
  updateWorkspaceOutreach,
  updateWorkspaceTemplates,
} from "@/lib/supabase/workspace-data";

interface AppContextValue {
  creators: Creator[];
  campaigns: Campaign[];
  shortlist: string[];
  outreach: Outreach[];
  templates: MessageTemplate[];
  ready: boolean;
  saving: boolean;
  error: string | null;
  clearError: () => void;
  reloadWorkspaceData: () => Promise<void>;
  addCreator: (creator: CreatorProfileInput) => Promise<string | null>;
  updateCreator: (creator: Creator) => Promise<boolean>;
  deleteCreator: (creatorId: string) => Promise<boolean>;
  resetWorkspace: () => Promise<boolean>;
  toggleShortlist: (creatorId: string) => Promise<boolean>;
  createCampaign: (
    campaign: Omit<Campaign, "id" | "createdAt">,
  ) => Promise<boolean>;
  updateCampaign: (campaign: Campaign) => Promise<boolean>;
  deleteCampaign: (campaignId: string) => Promise<boolean>;
  addCreatorsToCampaign: (
    campaignId: string,
    creatorIds: string[],
  ) => Promise<boolean>;
  createOutreach: (
    creatorIds: string[],
    campaignId: string | null,
    channel?: OutreachChannel,
  ) => Promise<string[]>;
  saveOutreach: (id: string, updates: Partial<Outreach>) => Promise<boolean>;
  addOutreachNote: (id: string, note: string) => Promise<boolean>;
  saveTemplates: (templates: MessageTemplate[]) => Promise<boolean>;
  recordOutreachEvent: (
    id: string,
    type: OutreachEventType,
    text: string,
  ) => Promise<boolean>;
  updateCampaignStatus: (
    id: string,
    status: CampaignStatus,
  ) => Promise<boolean>;
}

const AppContext = createContext<AppContextValue | null>(null);
const EMPTY_CAMPAIGNS: Campaign[] = [];
const EMPTY_SHORTLIST: string[] = [];
const EMPTY_OUTREACH: Outreach[] = [];

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const {
    activeWorkspace,
    loading: workspaceLoading,
  } = useWorkspace();
  const [creators, setCreators] = useState<Creator[]>(creatorData as Creator[]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [outreach, setOutreach] = useState<Outreach[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>(
    DEFAULT_MESSAGE_TEMPLATES,
  );
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutationInFlight = useRef(false);

  const refreshData = useCallback(async () => {
    if (!activeWorkspace || !user) {
      setReady(false);
      return;
    }

    const data = await loadWorkspaceData(
      activeWorkspace.id,
      user.id,
      activeWorkspace.role,
    );
    setCreators(data.creators);
    setCampaigns(data.campaigns);
    setShortlist(data.shortlist);
    setOutreach(data.outreach);
    setTemplates(data.templates);
    setLoadedWorkspaceId(activeWorkspace.id);
    setReady(true);
  }, [activeWorkspace, user]);

  useEffect(() => {
    let active = true;
    if (authLoading || workspaceLoading) return;
    if (!user || !activeWorkspace) {
      void Promise.resolve().then(() => {
        if (!active) return;
        setReady(false);
        setCampaigns([]);
        setShortlist([]);
        setOutreach([]);
        setCreators(creatorData as Creator[]);
        setTemplates(DEFAULT_MESSAGE_TEMPLATES);
      });
      return () => {
        active = false;
      };
    }

    void Promise.resolve()
      .then(() =>
        loadWorkspaceData(activeWorkspace.id, user.id, activeWorkspace.role),
      )
      .then((data) => {
        if (!active) return;
        setCreators(data.creators);
        setCampaigns(data.campaigns);
        setShortlist(data.shortlist);
        setOutreach(data.outreach);
        setTemplates(data.templates);
        setLoadedWorkspaceId(activeWorkspace.id);
        setError(null);
        setReady(true);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Unable to load workspace data.", loadError);
        setError(
          loadError instanceof Error
            ? `Workspace data could not be loaded: ${loadError.message}`
            : "Workspace data could not be loaded. Refresh and try again.",
        );
        setReady(false);
        setLoadedWorkspaceId(null);
      });

    return () => {
      active = false;
    };
  }, [activeWorkspace, authLoading, user, workspaceLoading]);

  const performMutation = useCallback(
    async <T,>(action: () => Promise<T>): Promise<{ ok: boolean; value?: T }> => {
      if (mutationInFlight.current) return { ok: false };
      if (
        !ready ||
        !user ||
        !activeWorkspace ||
        !isWorkspaceEditor(activeWorkspace.role)
      ) {
        setError("You do not have permission to change this workspace.");
        return { ok: false };
      }

      mutationInFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        const value = await action();
        try {
          await refreshData();
        } catch (refreshError) {
          console.error("Saved workspace change but could not refresh data.", refreshError);
          setError("Your change was saved, but the latest workspace data could not be loaded.");
        }
        return { ok: true, value };
      } catch (mutationError) {
        console.error("Workspace change failed.", mutationError);
        setError(
          mutationError instanceof Error
            ? mutationError.message
            : "Your change could not be saved. Please try again.",
        );
        return { ok: false };
      } finally {
        mutationInFlight.current = false;
        setSaving(false);
      }
    },
    [activeWorkspace, ready, refreshData, user],
  );

  const addCreator = useCallback(
    async (input: CreatorProfileInput) => {
      const result = await performMutation(() =>
        createWorkspaceCreator(activeWorkspace!.id, user!.id, input),
      );
      return result.ok ? result.value?.id ?? null : null;
    },
    [activeWorkspace, performMutation, user],
  );

  const updateCreator = useCallback(
    async (creator: Creator) => {
      const result = await performMutation(() =>
        updateWorkspaceCreator(activeWorkspace!.id, user!.id, creator),
      );
      return result.ok;
    },
    [activeWorkspace, performMutation, user],
  );

  const deleteCreator = useCallback(
    async (creatorId: string) => {
      if (outreach.some((item) => item.creatorId === creatorId)) return false;
      const result = await performMutation(() =>
        deleteWorkspaceCreator(activeWorkspace!.id, creatorId),
      );
      return result.ok;
    },
    [activeWorkspace, outreach, performMutation],
  );

  const resetWorkspace = useCallback(async () => {
    const result = await performMutation(() =>
      resetWorkspaceData(activeWorkspace!.id, outreach, campaigns),
    );
    return result.ok;
  }, [activeWorkspace, campaigns, outreach, performMutation]);

  const toggleShortlist = useCallback(
    async (creatorId: string) => {
      const result = await performMutation(() =>
        toggleWorkspaceShortlist(
          activeWorkspace!.id,
          user!.id,
          creators,
          creatorId,
          shortlist.includes(creatorId),
        ),
      );
      return result.ok;
    },
    [activeWorkspace, creators, performMutation, shortlist, user],
  );

  const createCampaign = useCallback(
    async (campaign: Omit<Campaign, "id" | "createdAt">) => {
      const result = await performMutation(() =>
        createWorkspaceCampaign(
          activeWorkspace!.id,
          user!.id,
          campaign,
          creators,
        ),
      );
      return result.ok;
    },
    [activeWorkspace, creators, performMutation, user],
  );

  const updateCampaign = useCallback(
    async (campaign: Campaign) => {
      const result = await performMutation(() =>
        updateWorkspaceCampaign(
          activeWorkspace!.id,
          user!.id,
          campaign,
          creators,
        ),
      );
      return result.ok;
    },
    [activeWorkspace, creators, performMutation, user],
  );

  const deleteCampaign = useCallback(
    async (campaignId: string) => {
      const result = await performMutation(() =>
        deleteWorkspaceCampaign(activeWorkspace!.id, campaignId),
      );
      return result.ok;
    },
    [activeWorkspace, performMutation],
  );

  const addCreatorsToCampaign = useCallback(
    async (campaignId: string, creatorIds: string[]) => {
      const result = await performMutation(() =>
        addWorkspaceCreatorsToCampaign(
          activeWorkspace!.id,
          user!.id,
          creators,
          campaignId,
          creatorIds,
        ),
      );
      return result.ok;
    },
    [activeWorkspace, creators, performMutation, user],
  );

  const createOutreach = useCallback(
    async (
      creatorIds: string[],
      campaignId: string | null,
      channel?: OutreachChannel,
    ) => {
      const result = await performMutation(() =>
        createWorkspaceOutreach(
          activeWorkspace!.id,
          user!.id,
          creators,
          campaigns,
          outreach,
          creatorIds,
          campaignId,
          channel,
        ),
      );
      return result.ok ? result.value ?? [] : [];
    },
    [activeWorkspace, campaigns, creators, outreach, performMutation, user],
  );

  const saveOutreach = useCallback(
    async (id: string, updates: Partial<Outreach>) => {
      const current = outreach.find((item) => item.id === id);
      if (!current) return false;
      const history = [...(current.history ?? [])];
      if (updates.message !== undefined && updates.message !== current.message) {
        history.push(
          toOutreachEvent("message", "Previous message draft saved.", current.message),
        );
      }
      if (updates.status !== undefined && updates.status !== current.status) {
        history.push(
          toOutreachEvent(
            "status",
            `Status changed from ${current.status} to ${updates.status}.`,
          ),
        );
      }
      if (
        updates.followUpDate !== undefined &&
        updates.followUpDate !== current.followUpDate
      ) {
        history.push(
          toOutreachEvent(
            "follow-up",
            updates.followUpDate
              ? `Follow-up scheduled for ${updates.followUpDate}.`
              : "Follow-up date cleared.",
          ),
        );
      }
      const updated = { ...current, ...updates, history };
      const result = await performMutation(() =>
        updateWorkspaceOutreach(activeWorkspace!.id, user!.id, updated),
      );
      return result.ok;
    },
    [activeWorkspace, outreach, performMutation, user],
  );

  const addOutreachNote = useCallback(
    async (id: string, note: string) => {
      const current = outreach.find((item) => item.id === id);
      const trimmed = note.trim();
      if (!current || !trimmed) return false;
      const updated = {
        ...current,
        notes: [...(current.notes ?? []), trimmed],
        history: [
          ...(current.history ?? []),
          toOutreachEvent("note", trimmed),
        ],
      };
      const result = await performMutation(() =>
        updateWorkspaceOutreach(activeWorkspace!.id, user!.id, updated),
      );
      return result.ok;
    },
    [activeWorkspace, outreach, performMutation, user],
  );

  const saveTemplates = useCallback(
    async (next: MessageTemplate[]) => {
      const result = await performMutation(() =>
        updateWorkspaceTemplates(activeWorkspace!.id, user!.id, next),
      );
      return result.ok;
    },
    [activeWorkspace, performMutation, user],
  );

  const recordOutreachEvent = useCallback(
    async (id: string, type: OutreachEventType, text: string) => {
      const result = await performMutation(() =>
        addWorkspaceOutreachEvent(
          activeWorkspace!.id,
          user!.id,
          id,
          toOutreachEvent(type, text),
        ),
      );
      return result.ok;
    },
    [activeWorkspace, performMutation, user],
  );

  const updateCampaignStatus = useCallback(
    async (id: string, status: CampaignStatus) => {
      const campaign = campaigns.find((item) => item.id === id);
      if (!campaign) return false;
      const result = await performMutation(() =>
        updateWorkspaceCampaign(
          activeWorkspace!.id,
          user!.id,
          { ...campaign, status },
          creators,
        ),
      );
      return result.ok;
    },
    [activeWorkspace, campaigns, creators, performMutation, user],
  );

  const clearError = useCallback(() => setError(null), []);
  const workspaceLoaded = Boolean(
    activeWorkspace && loadedWorkspaceId === activeWorkspace.id,
  );
  const visibleCreators = workspaceLoaded ? creators : (creatorData as Creator[]);
  const visibleCampaigns = workspaceLoaded ? campaigns : EMPTY_CAMPAIGNS;
  const visibleShortlist = workspaceLoaded ? shortlist : EMPTY_SHORTLIST;
  const visibleOutreach = workspaceLoaded ? outreach : EMPTY_OUTREACH;
  const visibleTemplates = workspaceLoaded
    ? templates
    : DEFAULT_MESSAGE_TEMPLATES;

  const value = useMemo(
    () => ({
      campaigns: visibleCampaigns,
      creators: visibleCreators,
      shortlist: visibleShortlist,
      outreach: visibleOutreach,
      templates: visibleTemplates,
      ready: ready && workspaceLoaded,
      saving,
      error,
      clearError,
      reloadWorkspaceData: refreshData,
      addCreator,
      updateCreator,
      deleteCreator,
      resetWorkspace,
      toggleShortlist,
      createCampaign,
      updateCampaign,
      deleteCampaign,
      addCreatorsToCampaign,
      createOutreach,
      saveOutreach,
      addOutreachNote,
      saveTemplates,
      recordOutreachEvent,
      updateCampaignStatus,
    }),
    [
      visibleCampaigns,
      visibleCreators,
      visibleShortlist,
      visibleOutreach,
      visibleTemplates,
      ready,
      workspaceLoaded,
      saving,
      error,
      clearError,
      refreshData,
      addCreator,
      updateCreator,
      deleteCreator,
      resetWorkspace,
      toggleShortlist,
      createCampaign,
      updateCampaign,
      deleteCampaign,
      addCreatorsToCampaign,
      createOutreach,
      saveOutreach,
      addOutreachNote,
      saveTemplates,
      recordOutreachEvent,
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
