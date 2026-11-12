import type { Campaign } from "@/types/campaign";
import type { Creator } from "@/types/creator";
import type { Outreach } from "@/types/outreach";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  isOutreachChannel,
} from "@/data/message-templates";
import type {
  MessageTemplate,
  OutreachEvent,
  OutreachStatus,
} from "@/types/outreach";
import creators from "@/data/creators.json";

const KEYS = {
  creators: "creatorflow_creators",
  campaigns: "creatorflow_campaigns",
  shortlist: "creatorflow_shortlist",
  outreach: "creatorflow_outreach",
  templates: "creatorflow_message_templates",
} as const;

const baseCreators = creators as Creator[];
const baseCreatorIds = new Set(baseCreators.map((creator) => creator.id));

export interface LocalStorageBackup {
  format: "creatorflow-local-backup";
  version: 1;
  exportedAt: string;
  records: Record<string, string | null>;
}

function read<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch (error) {
    console.error(`Unable to read CreatorFlow data from ${key}.`, error);
    return fallback;
  }
}

function normalizeCreatorIds(value: unknown, validCreatorIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value.filter(
        (id): id is string => typeof id === "string" && validCreatorIds.has(id),
      ),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCreator(value: unknown): value is Creator {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.username === "string" &&
    value.platform === "Instagram" &&
    typeof value.niche === "string" &&
    typeof value.subNiche === "string" &&
    typeof value.location === "string" &&
    typeof value.state === "string" &&
    Number.isFinite(value.followers) &&
    Number.isFinite(value.engagementRate) &&
    Number.isFinite(value.averageViews) &&
    Number.isFinite(value.averageLikes) &&
    Number.isFinite(value.averageComments) &&
    (typeof value.email === "string" || value.email === null) &&
    typeof value.bio === "string" &&
    typeof value.profileUrl === "string" &&
    typeof value.avatar === "string" &&
    typeof value.language === "string" &&
    typeof value.audienceType === "string" &&
    (value.dataSource === "Demo Dataset" || value.dataSource === "User Entry") &&
    typeof value.lastUpdated === "string"
  );
}

const OUTREACH_STATUSES: OutreachStatus[] = [
  "Draft",
  "Ready to Send",
  "Sent (Demo)",
  "Replied",
  "Interested",
  "Not Interested",
  "Follow-up Required",
];

function normalizeStatus(value: unknown): OutreachStatus {
  if (OUTREACH_STATUSES.includes(value as OutreachStatus)) {
    return value as OutreachStatus;
  }
  if (value === "Approved") return "Ready to Send";
  if (value === "Sent") return "Sent (Demo)";
  if (value === "Rejected") return "Not Interested";
  return "Draft";
}

function normalizeEvents(value: unknown, createdAt: string): OutreachEvent[] {
  if (!Array.isArray(value)) {
    return [
      {
        id: `event_${createdAt}`,
        type: "created",
        text: "Outreach draft created.",
        createdAt,
      },
    ];
  }
  return value.filter(
    (event): event is OutreachEvent =>
      isRecord(event) &&
      typeof event.id === "string" &&
      typeof event.type === "string" &&
      typeof event.text === "string" &&
      typeof event.createdAt === "string" &&
      [
        "created",
        "message",
        "status",
        "note",
        "follow-up",
      ].includes(event.type),
  );
}

function normalizeOutreach(value: unknown, validCreatorIds: Set<string>): Outreach[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      typeof item.creatorId !== "string" ||
      !validCreatorIds.has(item.creatorId) ||
      typeof item.message !== "string" ||
      typeof item.createdAt !== "string" ||
      (typeof item.campaignId !== "string" && item.campaignId !== null)
    ) {
      return [];
    }

    const contactMethod = isOutreachChannel(item.contactMethod)
      ? item.contactMethod
      : item.contactMethod === "Email"
        ? "Email"
        : "Instagram DM";
    const status = normalizeStatus(item.status);
    const createdAt = item.createdAt;
    const history = normalizeEvents(item.history, createdAt);
    if (status !== "Draft" && history.length === 1 && history[0].type === "created") {
      history.push({
        id: `event_migrated_${item.id}`,
        type: "status",
        text: `Legacy status migrated to ${status}.`,
        createdAt,
      });
    }

    return [
      {
        ...item,
        id: item.id,
        creatorId: item.creatorId,
        campaignId: item.campaignId,
        contactMethod,
        status,
        message: item.message,
        createdAt,
        subject: typeof item.subject === "string" ? item.subject : "",
        brandName: typeof item.brandName === "string" ? item.brandName : "",
        campaignName: typeof item.campaignName === "string" ? item.campaignName : "",
        collaborationDescription:
          typeof item.collaborationDescription === "string"
            ? item.collaborationDescription
            : "",
        offer: typeof item.offer === "string" ? item.offer : "",
        tone:
          item.tone === "Friendly" ||
          item.tone === "Enthusiastic" ||
          item.tone === "Premium"
            ? item.tone
            : "Professional",
        followUpDate:
          typeof item.followUpDate === "string" ? item.followUpDate : "",
        notes: Array.isArray(item.notes)
          ? item.notes.filter((note): note is string => typeof note === "string")
          : [],
        history,
      },
    ];
  });
}

function normalizeTemplates(value: unknown): MessageTemplate[] {
  if (!Array.isArray(value)) return DEFAULT_MESSAGE_TEMPLATES;
  const valid = value.filter(
    (template): template is MessageTemplate =>
      isRecord(template) &&
      typeof template.id === "string" &&
      typeof template.name === "string" &&
      typeof template.description === "string" &&
      isOutreachChannel(template.channel) &&
      typeof template.subject === "string" &&
      typeof template.body === "string" &&
      typeof template.custom === "boolean",
  );
  const savedById = new Map(valid.map((template) => [template.id, template]));
  const defaults = DEFAULT_MESSAGE_TEMPLATES.map(
    (template) => savedById.get(template.id) ?? template,
  );
  const defaultIds = new Set(DEFAULT_MESSAGE_TEMPLATES.map((template) => template.id));
  return [...defaults, ...valid.filter((template) => !defaultIds.has(template.id))];
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save CreatorFlow data to ${key}.`, error);
  }
}

export const storage = {
  hasLocalData: (): boolean =>
    Object.values(KEYS).some((key) => window.localStorage.getItem(key) !== null),
  createRawBackup: (): LocalStorageBackup => ({
    format: "creatorflow-local-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: Object.fromEntries(
      Object.entries(KEYS).map(([name, key]) => [
        name,
        window.localStorage.getItem(key),
      ]),
    ),
  }),
  loadMigrationData: () => {
    const creatorsList = storage.loadCreators();
    return {
      creators: creatorsList,
      campaigns: storage.loadCampaigns(creatorsList),
      shortlist: storage.loadShortlist(creatorsList),
      outreach: storage.loadOutreach(creatorsList),
      templates: storage.loadTemplates(),
    };
  },
  loadCreators: (): Creator[] => {
    const stored = read<unknown>(KEYS.creators, null);
    if (!isRecord(stored) || !Array.isArray(stored.records)) return baseCreators;

    const records = new Map(
      stored.records.filter(isCreator).map((creator) => [creator.id, creator]),
    );
    const deletedIds = new Set(
      Array.isArray(stored.deletedIds)
        ? stored.deletedIds.filter(
            (id): id is string => typeof id === "string" && baseCreatorIds.has(id),
          )
        : [],
    );
    const merged = baseCreators
      .filter((creator) => !deletedIds.has(creator.id))
      .map((creator) => records.get(creator.id) ?? creator);
    const existingIds = new Set(baseCreators.map((creator) => creator.id));
    for (const creator of records.values()) {
      if (!existingIds.has(creator.id)) merged.push(creator);
    }
    return merged;
  },
  saveCreators: (value: Creator[]) => {
    const validRecords = value.filter(isCreator);
    const currentIds = new Set(validRecords.map((creator) => creator.id));
    write(KEYS.creators, {
      version: 1,
      records: validRecords,
      deletedIds: baseCreators
        .filter((creator) => !currentIds.has(creator.id))
        .map((creator) => creator.id),
    });
  },
  loadCampaigns: (creatorsList: Creator[] = baseCreators): Campaign[] => {
    const validCreatorIds = new Set(creatorsList.map((creator) => creator.id));
    const stored = read<unknown>(KEYS.campaigns, []);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(
        (item): item is Campaign =>
          isRecord(item) &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.brand === "string" &&
          typeof item.createdAt === "string",
      )
      .map((campaign) => ({
        ...campaign,
        creatorIds: normalizeCreatorIds(campaign.creatorIds, validCreatorIds),
      }));
  },
  saveCampaigns: (value: Campaign[]) => write(KEYS.campaigns, value),
  loadShortlist: (creatorsList: Creator[] = baseCreators): string[] =>
    normalizeCreatorIds(
      read<unknown>(KEYS.shortlist, []),
      new Set(creatorsList.map((creator) => creator.id)),
    ),
  saveShortlist: (value: string[]) => write(KEYS.shortlist, value),
  loadOutreach: (creatorsList: Creator[] = baseCreators): Outreach[] =>
    normalizeOutreach(
      read<unknown>(KEYS.outreach, []),
      new Set(creatorsList.map((creator) => creator.id)),
    ),
  saveOutreach: (value: Outreach[]) => write(KEYS.outreach, value),
  loadTemplates: (): MessageTemplate[] =>
    normalizeTemplates(read<unknown>(KEYS.templates, DEFAULT_MESSAGE_TEMPLATES)),
  saveTemplates: (value: MessageTemplate[]) => write(KEYS.templates, value),
};
