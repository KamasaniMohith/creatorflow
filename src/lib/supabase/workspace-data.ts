"use client";

import type { Campaign, CampaignStatus } from "@/types/campaign";
import type { Creator, CreatorProfileInput } from "@/types/creator";
import type {
  MessageTemplate,
  Outreach,
  OutreachEvent,
  OutreachEventType,
  OutreachStatus,
} from "@/types/outreach";
import { DEFAULT_MESSAGE_TEMPLATES } from "@/data/message-templates";
import creatorData from "@/data/creators.json";
import { generateMessage } from "@/lib/message-generator";
import { createId } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { WorkspaceRole } from "@/components/WorkspaceProvider";

export interface WorkspaceData {
  creators: Creator[];
  campaigns: Campaign[];
  shortlist: string[];
  outreach: Outreach[];
  templates: MessageTemplate[];
}

export interface LocalMigrationData {
  creators: Creator[];
  campaigns: Campaign[];
  shortlist: string[];
  outreach: Outreach[];
  templates: MessageTemplate[];
}

export interface LocalMigrationResult {
  creators: number;
  campaigns: number;
  associations: number;
  shortlist: number;
  outreach: number;
  events: number;
  templates: number;
  skipped: number;
}

interface CreatorRow {
  id: string;
  name: string;
  username: string;
  platform: Creator["platform"];
  niche: Creator["niche"];
  sub_niche: string;
  location: Creator["location"];
  state: string;
  followers: number;
  engagement_rate: number;
  average_views: number;
  average_likes: number;
  average_comments: number;
  email: string | null;
  bio: string;
  profile_url: string;
  avatar: string;
  language: string;
  audience_type: string;
  data_source: Creator["dataSource"];
  last_updated: string | null;
}

interface CampaignRow {
  id: string;
  name: string;
  brand: string;
  niche: Campaign["niche"];
  location: Campaign["location"];
  min_followers: number;
  max_followers: number;
  description: string;
  status: CampaignStatus;
  created_at: string;
}

interface OutreachRow {
  id: string;
  creator_id: string;
  campaign_id: string | null;
  contact_method: Outreach["contactMethod"];
  subject: string;
  message: string;
  status: OutreachStatus;
  brand_name: string;
  campaign_name: string;
  collaboration_description: string;
  offer: string;
  tone: NonNullable<Outreach["tone"]>;
  follow_up_date: string | null;
  notes: string[];
  created_at: string;
}

interface EventRow {
  id: string;
  outreach_id: string;
  event_type: OutreachEventType;
  text: string;
  message_snapshot: string | null;
  created_at: string;
}

interface TemplateRow {
  id: string;
  name: string;
  description: string;
  channel: MessageTemplate["channel"];
  subject: string;
  body: string;
  custom: boolean;
}

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function mapCreator(row: CreatorRow): Creator {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    platform: row.platform,
    niche: row.niche,
    subNiche: row.sub_niche,
    location: row.location,
    state: row.state,
    followers: Number(row.followers),
    engagementRate: Number(row.engagement_rate),
    averageViews: Number(row.average_views),
    averageLikes: Number(row.average_likes),
    averageComments: Number(row.average_comments),
    email: row.email,
    bio: row.bio,
    profileUrl: row.profile_url,
    avatar: row.avatar,
    language: row.language,
    audienceType: row.audience_type,
    dataSource: row.data_source,
    lastUpdated: row.last_updated ?? "",
  };
}

function mapCreatorInput(
  creator: CreatorProfileInput | Creator,
  workspaceId: string,
  userId: string,
  source: "manual" | "import" | "catalog_copy",
) {
  const creatorId = "id" in creator ? creator.id : createId("creator");
  const dataSource =
    "dataSource" in creator ? creator.dataSource : "User Entry";
  const lastUpdated =
    "lastUpdated" in creator
      ? creator.lastUpdated
      : new Date().toISOString().slice(0, 10);
  return {
    id: creatorId,
    workspace_id: workspaceId,
    name: creator.name,
    username: creator.username,
    platform: creator.platform,
    niche: creator.niche,
    sub_niche: creator.subNiche,
    location: creator.location,
    state: creator.state,
    followers: creator.followers,
    engagement_rate: creator.engagementRate,
    average_views: creator.averageViews,
    average_likes: creator.averageLikes,
    average_comments: creator.averageComments,
    email: creator.email,
    bio: creator.bio,
    profile_url: creator.profileUrl,
    avatar: creator.avatar,
    language: creator.language,
    audience_type: creator.audienceType,
    data_source: dataSource,
    source,
    verification_status: "unverified",
    last_updated: lastUpdated || new Date().toISOString().slice(0, 10),
    created_by: userId,
  };
}

function mapOutreachEvent(row: EventRow): OutreachEvent {
  return {
    id: row.id,
    type: row.event_type,
    text: row.text,
    ...(row.message_snapshot ? { message: row.message_snapshot } : {}),
    createdAt: row.created_at,
  };
}

function templateRows(
  templates: MessageTemplate[],
  workspaceId: string,
  userId: string,
) {
  return templates.map((template) => ({
    id: template.id,
    workspace_id: workspaceId,
    name: template.name,
    description: template.description,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
    custom: template.custom,
    system_template_key: template.custom ? null : template.id,
    created_by: userId,
  }));
}

export async function loadWorkspaceData(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<WorkspaceData> {
  const supabase = createClient();
  const [
    creatorResult,
    campaignResult,
    associationResult,
    shortlistResult,
    outreachResult,
    eventResult,
    templateResult,
  ] = await Promise.all([
    supabase.from("creators").select("*").eq("workspace_id", workspaceId),
    supabase.from("campaigns").select("*").eq("workspace_id", workspaceId),
    supabase
      .from("campaign_creators")
      .select("campaign_id, creator_id")
      .eq("workspace_id", workspaceId),
    supabase
      .from("shortlist_entries")
      .select("creator_id")
      .eq("workspace_id", workspaceId),
    supabase.from("outreach_records").select("*").eq("workspace_id", workspaceId),
    supabase
      .from("outreach_events")
      .select("id, outreach_id, event_type, text, message_snapshot, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at"),
    supabase
      .from("message_templates")
      .select("id, name, description, channel, subject, body, custom")
      .eq("workspace_id", workspaceId),
  ]);
  for (const result of [
    creatorResult,
    campaignResult,
    associationResult,
    shortlistResult,
    outreachResult,
    eventResult,
    templateResult,
  ]) {
    throwOnError(result.error);
  }

  let templateRowsResult = (templateResult.data ?? []) as TemplateRow[];
  if (
    templateRowsResult.length === 0 &&
    role !== "viewer" &&
    DEFAULT_MESSAGE_TEMPLATES.length > 0
  ) {
    const { error } = await supabase
      .from("message_templates")
      .upsert(
        templateRows(DEFAULT_MESSAGE_TEMPLATES, workspaceId, userId),
        { onConflict: "workspace_id,id", ignoreDuplicates: true },
      );
    throwOnError(error);
    const { data, error: reloadError } = await supabase
      .from("message_templates")
      .select("id, name, description, channel, subject, body, custom")
      .eq("workspace_id", workspaceId);
    throwOnError(reloadError);
    templateRowsResult = (data ?? []) as TemplateRow[];
  }

  const workspaceCreators = ((creatorResult.data ?? []) as CreatorRow[]).map(mapCreator);
  const tenantCreatorIds = new Set(workspaceCreators.map((creator) => creator.id));
  const allCreators = [
    ...workspaceCreators,
    ...(creatorData as Creator[]).filter(
      (creator) => !tenantCreatorIds.has(creator.id),
    ),
  ];

  const associations = (associationResult.data ?? []) as Array<{
    campaign_id: string;
    creator_id: string;
  }>;
  const campaignRows = (campaignResult.data ?? []) as CampaignRow[];
  const campaigns = campaignRows.map((row) => ({
    id: row.id,
    name: row.name,
    brand: row.brand,
    niche: row.niche,
    location: row.location,
    minFollowers: Number(row.min_followers),
    maxFollowers: Number(row.max_followers),
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    creatorIds: associations
      .filter((association) => association.campaign_id === row.id)
      .map((association) => association.creator_id),
  }));

  const eventsByOutreach = new Map<string, OutreachEvent[]>();
  for (const event of (eventResult.data ?? []) as EventRow[]) {
    const events = eventsByOutreach.get(event.outreach_id) ?? [];
    events.push(mapOutreachEvent(event));
    eventsByOutreach.set(event.outreach_id, events);
  }
  const outreach = ((outreachResult.data ?? []) as OutreachRow[]).map((row) => ({
    id: row.id,
    creatorId: row.creator_id,
    campaignId: row.campaign_id,
    contactMethod: row.contact_method,
    subject: row.subject,
    message: row.message,
    status: row.status,
    brandName: row.brand_name,
    campaignName: row.campaign_name,
    collaborationDescription: row.collaboration_description,
    offer: row.offer,
    tone: row.tone,
    followUpDate: row.follow_up_date ?? "",
    notes: row.notes ?? [],
    createdAt: row.created_at,
    history: eventsByOutreach.get(row.id) ?? [],
  }));

  const templates = templateRowsResult.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    channel: row.channel,
    subject: row.subject,
    body: row.body,
    custom: row.custom,
  }));

  return {
    creators: allCreators,
    campaigns,
    shortlist: ((shortlistResult.data ?? []) as Array<{ creator_id: string }>).map(
      (row) => row.creator_id,
    ),
    outreach,
    templates:
      templates.length > 0
        ? templates
        : DEFAULT_MESSAGE_TEMPLATES,
  };
}

async function ensureWorkspaceCreator(
  workspaceId: string,
  userId: string,
  creator: Creator,
): Promise<void> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("creators")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", creator.id)
    .maybeSingle();
  throwOnError(error);
  if (data) return;

  const { error: insertError } = await supabase
    .from("creators")
    .insert(mapCreatorInput(creator, workspaceId, userId, "catalog_copy"));
  throwOnError(insertError);
}

async function ensureWorkspaceCreators(
  workspaceId: string,
  userId: string,
  creators: Creator[],
  creatorIds: string[],
): Promise<void> {
  const uniqueIds = Array.from(new Set(creatorIds));
  for (const id of uniqueIds) {
    const creator = creators.find((item) => item.id === id);
    if (!creator) throw new Error("A selected creator is no longer available.");
    await ensureWorkspaceCreator(workspaceId, userId, creator);
  }
}

export async function createWorkspaceCreator(
  workspaceId: string,
  userId: string,
  input: CreatorProfileInput,
): Promise<Creator> {
  const creator: Creator = {
    ...input,
    id: createId("creator"),
    dataSource: "User Entry",
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
  const { error } = await createClient()
    .from("creators")
    .insert(mapCreatorInput(creator, workspaceId, userId, "manual"));
  throwOnError(error);
  return creator;
}

export async function updateWorkspaceCreator(
  workspaceId: string,
  userId: string,
  creator: Creator,
): Promise<Creator> {
  const updated = {
    ...creator,
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
  await ensureWorkspaceCreator(workspaceId, userId, updated);
  const row = mapCreatorInput(updated, workspaceId, userId, "catalog_copy");
  const mutable = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "created_by" && key !== "source"),
  );
  const { data, error } = await createClient()
    .from("creators")
    .update(mutable)
    .eq("workspace_id", workspaceId)
    .eq("id", creator.id)
    .select("id");
  throwOnError(error);
  if (!data?.length) throw new Error("Creator was not found in this workspace.");
  return updated;
}

export async function deleteWorkspaceCreator(
  workspaceId: string,
  creatorId: string,
): Promise<void> {
  const supabase = createClient();
  const { error: shortlistError } = await supabase
    .from("shortlist_entries")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("creator_id", creatorId);
  throwOnError(shortlistError);
  const { error: associationsError } = await supabase
    .from("campaign_creators")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("creator_id", creatorId);
  throwOnError(associationsError);
  const { data, error } = await supabase
    .from("creators")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", creatorId)
    .select("id");
  throwOnError(error);
  if (!data?.length) throw new Error("Only workspace-owned creator records can be deleted.");
}

export async function toggleWorkspaceShortlist(
  workspaceId: string,
  userId: string,
  creators: Creator[],
  creatorId: string,
  currentlyShortlisted: boolean,
): Promise<void> {
  await ensureWorkspaceCreators(workspaceId, userId, creators, [creatorId]);
  const supabase = createClient();
  const query = currentlyShortlisted
    ? supabase
        .from("shortlist_entries")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("creator_id", creatorId)
    : supabase.from("shortlist_entries").insert({
        workspace_id: workspaceId,
        creator_id: creatorId,
        added_by: userId,
      });
  const { error } = await query;
  throwOnError(error);
}

export async function createWorkspaceCampaign(
  workspaceId: string,
  userId: string,
  campaign: Omit<Campaign, "id" | "createdAt">,
  creators: Creator[],
): Promise<Campaign> {
  const record: Campaign = {
    ...campaign,
    id: createId("campaign"),
    createdAt: new Date().toISOString(),
  };
  await ensureWorkspaceCreators(workspaceId, userId, creators, campaign.creatorIds);
  const supabase = createClient();
  const { error } = await supabase.from("campaigns").insert({
    id: record.id,
    workspace_id: workspaceId,
    name: record.name,
    brand: record.brand,
    niche: record.niche,
    location: record.location,
    min_followers: record.minFollowers,
    max_followers: record.maxFollowers,
    description: record.description,
    status: record.status,
    created_by: userId,
  });
  throwOnError(error);
  if (record.creatorIds.length) {
    const { error: associationError } = await supabase
      .from("campaign_creators")
      .insert(
        record.creatorIds.map((creatorId) => ({
          workspace_id: workspaceId,
          campaign_id: record.id,
          creator_id: creatorId,
          added_by: userId,
        })),
      );
    throwOnError(associationError);
  }
  return record;
}

export async function updateWorkspaceCampaign(
  workspaceId: string,
  userId: string,
  campaign: Campaign,
  creators: Creator[],
): Promise<void> {
  await ensureWorkspaceCreators(workspaceId, userId, creators, campaign.creatorIds);
  const supabase = createClient();
  const { error } = await supabase
    .from("campaigns")
    .update({
      name: campaign.name,
      brand: campaign.brand,
      niche: campaign.niche,
      location: campaign.location,
      min_followers: campaign.minFollowers,
      max_followers: campaign.maxFollowers,
      description: campaign.description,
      status: campaign.status,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", campaign.id);
  throwOnError(error);

  const { error: clearError } = await supabase
    .from("campaign_creators")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id);
  throwOnError(clearError);
  if (campaign.creatorIds.length) {
    const { error: associationError } = await supabase
      .from("campaign_creators")
      .insert(
        campaign.creatorIds.map((creatorId) => ({
          workspace_id: workspaceId,
          campaign_id: campaign.id,
          creator_id: creatorId,
          added_by: userId,
        })),
      );
    throwOnError(associationError);
  }
}

export async function deleteWorkspaceCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<void> {
  const supabase = createClient();
  const { error: outreachError } = await supabase
    .from("outreach_records")
    .update({ campaign_id: null })
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId);
  throwOnError(outreachError);
  const { error: associationError } = await supabase
    .from("campaign_creators")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId);
  throwOnError(associationError);
  const { data, error } = await supabase
    .from("campaigns")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId)
    .select("id");
  throwOnError(error);
  if (!data?.length) throw new Error("Campaign was not found in this workspace.");
}

export async function addWorkspaceCreatorsToCampaign(
  workspaceId: string,
  userId: string,
  creators: Creator[],
  campaignId: string,
  creatorIds: string[],
): Promise<void> {
  await ensureWorkspaceCreators(workspaceId, userId, creators, creatorIds);
  const { error } = await createClient()
    .from("campaign_creators")
    .upsert(
      Array.from(new Set(creatorIds)).map((creatorId) => ({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        creator_id: creatorId,
        added_by: userId,
      })),
      { onConflict: "workspace_id,campaign_id,creator_id", ignoreDuplicates: true },
    );
  throwOnError(error);
}

function mapOutreachInput(
  workspaceId: string,
  userId: string,
  record: Outreach,
) {
  return {
    id: record.id,
    workspace_id: workspaceId,
    creator_id: record.creatorId,
    campaign_id: record.campaignId,
    contact_method: record.contactMethod,
    subject: record.subject ?? "",
    message: record.message,
    status: record.status,
    brand_name: record.brandName ?? "",
    campaign_name: record.campaignName ?? "",
    collaboration_description: record.collaborationDescription ?? "",
    offer: record.offer ?? "",
    tone: record.tone ?? "Friendly",
    follow_up_date: record.followUpDate || null,
    notes: record.notes ?? [],
    created_by: userId,
    created_at: record.createdAt,
  };
}

function mapEventInput(
  workspaceId: string,
  userId: string,
  outreachId: string,
  event: OutreachEvent,
) {
  return {
    id: event.id,
    workspace_id: workspaceId,
    outreach_id: outreachId,
    event_type: event.type,
    text: event.text,
    message_snapshot: event.message ?? null,
    actor_user_id: userId,
    created_at: event.createdAt,
  };
}

export async function createWorkspaceOutreach(
  workspaceId: string,
  userId: string,
  creators: Creator[],
  campaigns: Campaign[],
  existingOutreach: Outreach[],
  creatorIds: string[],
  campaignId: string | null,
  channel?: Outreach["contactMethod"],
): Promise<string[]> {
  const supabase = createClient();
  const campaign = campaigns.find((item) => item.id === campaignId);
  const ids = Array.from(new Set(creatorIds));
  await ensureWorkspaceCreators(workspaceId, userId, creators, ids);
  const records: Outreach[] = [];
  const existingIds: string[] = [];

  for (const creatorId of ids) {
    const creator = creators.find((item) => item.id === creatorId);
    if (!creator) continue;
    const contactMethod = channel ?? (creator.email ? "Email" : "Instagram DM");
    const existing = existingOutreach.find(
      (item) =>
        item.creatorId === creatorId &&
        item.campaignId === campaignId &&
        item.contactMethod === contactMethod,
    );
    if (existing) {
      existingIds.push(existing.id);
      continue;
    }

    const createdAt = new Date().toISOString();
    records.push({
      id: createId("outreach"),
      creatorId,
      campaignId,
      contactMethod,
      subject: "",
      brandName: campaign?.brand ?? "",
      campaignName: campaign?.name ?? "",
      collaborationDescription: campaign?.description ?? "",
      offer: "",
      tone: "Friendly",
      message: generateMessage({
        creator,
        brandName: campaign?.brand || "your brand",
        campaignName: campaign?.name || "an upcoming campaign",
        collaborationDescription: campaign?.description ?? "",
        offer: "",
        objective: "",
        tone: "Friendly",
        channel: contactMethod,
      }).body,
      status: "Draft",
      createdAt,
      notes: [],
      history: [
        {
          id: createId("event"),
          type: "created",
          text: "Outreach draft created.",
          createdAt,
        },
      ],
    });
  }

  if (records.length === 0) return existingIds;

  const { error } = await supabase
    .from("outreach_records")
    .insert(records.map((record) => mapOutreachInput(workspaceId, userId, record)));
  throwOnError(error);
  const eventRows = records.flatMap((record) =>
    (record.history ?? []).map((event) =>
      mapEventInput(workspaceId, userId, record.id, event),
    ),
  );
  if (eventRows.length) {
    const { error: eventError } = await supabase
      .from("outreach_events")
      .insert(eventRows);
    throwOnError(eventError);
  }
  return [...existingIds, ...records.map((record) => record.id)];
}

export async function updateWorkspaceOutreach(
  workspaceId: string,
  userId: string,
  record: Outreach,
): Promise<void> {
  const supabase = createClient();
  const mutable = Object.fromEntries(
    Object.entries(mapOutreachInput(workspaceId, userId, record)).filter(
      ([key]) => key !== "created_by" && key !== "created_at",
    ),
  );
  const { error } = await supabase
    .from("outreach_records")
    .update(mutable)
    .eq("workspace_id", workspaceId)
    .eq("id", record.id);
  throwOnError(error);

  if (record.history?.length) {
    const { error: eventError } = await supabase
      .from("outreach_events")
      .upsert(
        record.history.map((event) =>
          mapEventInput(workspaceId, userId, record.id, event),
        ),
        { onConflict: "workspace_id,id", ignoreDuplicates: true },
      );
    throwOnError(eventError);
  }
}

export async function addWorkspaceOutreachEvent(
  workspaceId: string,
  userId: string,
  outreachId: string,
  event: OutreachEvent,
): Promise<void> {
  const { error } = await createClient()
    .from("outreach_events")
    .insert(mapEventInput(workspaceId, userId, outreachId, event));
  throwOnError(error);
}

export async function deleteWorkspaceOutreach(
  workspaceId: string,
  outreachId: string,
): Promise<void> {
  const supabase = createClient();
  const { error: eventError } = await supabase
    .from("outreach_events")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("outreach_id", outreachId);
  throwOnError(eventError);
  const { error } = await supabase
    .from("outreach_records")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", outreachId);
  throwOnError(error);
}

export async function updateWorkspaceTemplates(
  workspaceId: string,
  userId: string,
  templates: MessageTemplate[],
): Promise<void> {
  const supabase = createClient();
  for (const template of templates) {
    const { data, error: lookupError } = await supabase
      .from("message_templates")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("id", template.id)
      .maybeSingle();
    throwOnError(lookupError);

    const values = {
      name: template.name,
      description: template.description,
      channel: template.channel,
      subject: template.subject,
      body: template.body,
      custom: template.custom,
      system_template_key: template.custom ? null : template.id,
    };
    const result = data
      ? await supabase
          .from("message_templates")
          .update(values)
          .eq("workspace_id", workspaceId)
          .eq("id", template.id)
      : await supabase.from("message_templates").insert({
          ...values,
          id: template.id,
          workspace_id: workspaceId,
          created_by: userId,
        });
    throwOnError(result.error);
  }
}

export async function resetWorkspaceData(
  workspaceId: string,
  outreach: Outreach[],
  campaigns: Campaign[],
): Promise<void> {
  const supabase = createClient();
  const outreachIds = outreach.map((record) => record.id);
  const campaignIds = campaigns.map((campaign) => campaign.id);
  if (outreachIds.length) {
    const { error } = await supabase
      .from("outreach_events")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("outreach_id", outreachIds);
    throwOnError(error);
  }
  if (campaignIds.length) {
    const { error } = await supabase
      .from("campaign_creators")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("campaign_id", campaignIds);
    throwOnError(error);
  }
  if (outreachIds.length) {
    const { error } = await supabase
      .from("outreach_records")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("id", outreachIds);
    throwOnError(error);
  }
  if (campaignIds.length) {
    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("workspace_id", workspaceId)
      .in("id", campaignIds);
    throwOnError(error);
  }
  const { error } = await supabase
    .from("shortlist_entries")
    .delete()
    .eq("workspace_id", workspaceId);
  throwOnError(error);
}

export async function importLocalWorkspaceData(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
  localData: LocalMigrationData,
): Promise<LocalMigrationResult> {
  if (!isWorkspaceEditor(role)) {
    throw new Error("Only workspace editors can import local data.");
  }

  const supabase = createClient();
  const referencedCreatorIds = new Set([
    ...localData.shortlist,
    ...localData.campaigns.flatMap((campaign) => campaign.creatorIds),
    ...localData.outreach.map((record) => record.creatorId),
  ]);
  const importCreators = localData.creators.filter(
    (creator) =>
      creator.dataSource === "User Entry" || referencedCreatorIds.has(creator.id),
  );
  const { data: existingCreatorsData, error: existingCreatorsError } = await supabase
    .from("creators")
    .select("id, username")
    .eq("workspace_id", workspaceId);
  throwOnError(existingCreatorsError);
  const existingCreators = (existingCreatorsData ?? []) as Array<{
    id: string;
    username: string;
  }>;
  const existingCreatorIds = new Set(existingCreators.map((row) => row.id));
  const existingCreatorNames = new Set(
    existingCreators.map((row) => row.username.toLowerCase()),
  );
  const creatorIds = new Set(existingCreatorIds);
  const creatorNames = new Set(existingCreatorNames);
  const creatorsToInsert = importCreators.filter((creator) => {
    if (
      creatorIds.has(creator.id) ||
      creatorNames.has(creator.username.toLowerCase())
    ) {
      return false;
    }
    creatorIds.add(creator.id);
    creatorNames.add(creator.username.toLowerCase());
    return true;
  });
  let skipped = importCreators.length - creatorsToInsert.length;
  for (const creator of creatorsToInsert) {
    const source = creator.dataSource === "User Entry" ? "import" : "catalog_copy";
    const { error } = await supabase
      .from("creators")
      .insert(mapCreatorInput(creator, workspaceId, userId, source));
    throwOnError(error);
  }

  const availableCreatorIds = new Set([...existingCreatorIds, ...creatorIds]);
  const { data: existingCampaignData, error: existingCampaignError } =
    await supabase
      .from("campaigns")
      .select("id")
      .eq("workspace_id", workspaceId);
  throwOnError(existingCampaignError);
  const campaignIds = new Set(
    ((existingCampaignData ?? []) as Array<{ id: string }>).map((row) => row.id),
  );
  const campaignsToInsert = localData.campaigns.filter((campaign) => {
    if (campaignIds.has(campaign.id)) {
      skipped += 1;
      return false;
    }
    campaignIds.add(campaign.id);
    return true;
  });
  for (const campaign of campaignsToInsert) {
    const { error } = await supabase.from("campaigns").insert({
      id: campaign.id,
      workspace_id: workspaceId,
      name: campaign.name,
      brand: campaign.brand,
      niche: campaign.niche,
      location: campaign.location,
      min_followers: campaign.minFollowers,
      max_followers: campaign.maxFollowers,
      description: campaign.description,
      status: campaign.status,
      created_by: userId,
      created_at: campaign.createdAt,
    });
    throwOnError(error);
  }

  const campaignIdSet = new Set(campaignIds);
  const { data: existingAssociationData, error: associationLoadError } =
    await supabase
      .from("campaign_creators")
      .select("campaign_id, creator_id")
      .eq("workspace_id", workspaceId);
  throwOnError(associationLoadError);
  const associationKeys = new Set(
    ((existingAssociationData ?? []) as Array<{
      campaign_id: string;
      creator_id: string;
    }>).map((row) => `${row.campaign_id}\u0000${row.creator_id}`),
  );
  const associationRows = localData.campaigns.flatMap((campaign) =>
    campaign.creatorIds.flatMap((creatorId) => {
      const key = `${campaign.id}\u0000${creatorId}`;
      if (
        !campaignIdSet.has(campaign.id) ||
        !availableCreatorIds.has(creatorId) ||
        associationKeys.has(key)
      ) {
        return [];
      }
      associationKeys.add(key);
      return [{
        workspace_id: workspaceId,
        campaign_id: campaign.id,
        creator_id: creatorId,
        added_by: userId,
      }];
    }),
  );
  if (associationRows.length) {
    const { error } = await supabase
      .from("campaign_creators")
      .insert(associationRows);
    throwOnError(error);
  }
  skipped += localData.campaigns.reduce(
    (count, campaign) =>
      count +
      campaign.creatorIds.filter(
        (id) => !availableCreatorIds.has(id) || !campaignIdSet.has(campaign.id),
      ).length,
    0,
  );

  const { data: existingShortlistData, error: shortlistLoadError } =
    await supabase
      .from("shortlist_entries")
      .select("creator_id")
      .eq("workspace_id", workspaceId);
  throwOnError(shortlistLoadError);
  const shortlistIds = new Set(
    ((existingShortlistData ?? []) as Array<{ creator_id: string }>).map(
      (row) => row.creator_id,
    ),
  );
  const shortlistRows = localData.shortlist.flatMap((creatorId) => {
    if (!availableCreatorIds.has(creatorId) || shortlistIds.has(creatorId)) {
      skipped += 1;
      return [];
    }
    shortlistIds.add(creatorId);
    return [{
      workspace_id: workspaceId,
      creator_id: creatorId,
      added_by: userId,
    }];
  });
  if (shortlistRows.length) {
    const { error } = await supabase.from("shortlist_entries").insert(shortlistRows);
    throwOnError(error);
  }

  const { data: existingOutreachData, error: outreachLoadError } = await supabase
    .from("outreach_records")
    .select("id")
    .eq("workspace_id", workspaceId);
  throwOnError(outreachLoadError);
  const outreachIds = new Set(
    ((existingOutreachData ?? []) as Array<{ id: string }>).map((row) => row.id),
  );
  const outreachToInsert = localData.outreach.filter((record) => {
    if (
      outreachIds.has(record.id) ||
      !availableCreatorIds.has(record.creatorId) ||
      (record.campaignId && !campaignIdSet.has(record.campaignId))
    ) {
      skipped += 1;
      return false;
    }
    outreachIds.add(record.id);
    return true;
  });
  for (const record of outreachToInsert) {
    const { error } = await supabase
      .from("outreach_records")
      .insert(mapOutreachInput(workspaceId, userId, record));
    throwOnError(error);
  }
  const importableOutreach = localData.outreach.filter(
    (record) =>
      outreachIds.has(record.id) &&
      availableCreatorIds.has(record.creatorId) &&
      (!record.campaignId || campaignIdSet.has(record.campaignId)),
  );
  const { data: existingEventData, error: existingEventError } = await supabase
    .from("outreach_events")
    .select("id")
    .eq("workspace_id", workspaceId);
  throwOnError(existingEventError);
  const eventIds = new Set(
    ((existingEventData ?? []) as Array<{ id: string }>).map((row) => row.id),
  );
  const eventRows = importableOutreach.flatMap((record) =>
    (record.history ?? []).flatMap((event) => {
      if (eventIds.has(event.id)) return [];
      eventIds.add(event.id);
      return [mapEventInput(workspaceId, userId, record.id, event)];
    }),
  );
  if (eventRows.length) {
    const { error } = await supabase.from("outreach_events").insert(eventRows);
    throwOnError(error);
  }

  const { data: existingTemplateData, error: templateLoadError } = await supabase
    .from("message_templates")
    .select("id")
    .eq("workspace_id", workspaceId);
  throwOnError(templateLoadError);
  const templateIds = new Set(
    ((existingTemplateData ?? []) as Array<{ id: string }>).map((row) => row.id),
  );
  const templatesToInsert = localData.templates.filter((template) => {
    if (templateIds.has(template.id)) {
      skipped += 1;
      return false;
    }
    templateIds.add(template.id);
    return true;
  });
  for (const template of templatesToInsert) {
    const { error } = await supabase.from("message_templates").insert({
      ...templateRows([template], workspaceId, userId)[0],
      system_template_key: template.custom ? null : template.id,
    });
    throwOnError(error);
  }

  return {
    creators: creatorsToInsert.length,
    campaigns: campaignsToInsert.length,
    associations: associationRows.length,
    shortlist: shortlistRows.length,
    outreach: outreachToInsert.length,
    events: eventRows.length,
    templates: templatesToInsert.length,
    skipped,
  };
}

export function toOutreachEvent(
  type: OutreachEventType,
  text: string,
  message?: string,
): OutreachEvent {
  return {
    id: createId("event"),
    type,
    text,
    ...(message ? { message } : {}),
    createdAt: new Date().toISOString(),
  };
}

export function isWorkspaceEditor(role: WorkspaceRole): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
