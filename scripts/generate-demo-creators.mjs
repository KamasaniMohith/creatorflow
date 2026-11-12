import { readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { fakerEN_IN } from "@faker-js/faker";
const DATA_PATH = new URL("../src/data/creators.json", import.meta.url);
const BACKUP_DIR = new URL("../backups/", import.meta.url);
const GENERATED_COUNT = 1000;
const SEED = 20261110;
const TEST_EMAILS = ["mohithr1435@gmail.com", "krishna@zyrohouse.com"];
const niches = [
  "Fitness", "Food", "Fashion", "Travel", "Technology",
  "Beauty", "Lifestyle", "Gaming", "Business", "Education", "Finance",
];
const locations = {
  Bangalore: { state: "Karnataka", language: "Kannada" },
  Hyderabad: { state: "Telangana", language: "Telugu" },
  Chennai: { state: "Tamil Nadu", language: "Tamil" },
  Mumbai: { state: "Maharashtra", language: "Hindi" },
  Delhi: { state: "Delhi", language: "Hindi" },
  Pune: { state: "Maharashtra", language: "Marathi" },
  Kochi: { state: "Kerala", language: "Malayalam" },
  Jaipur: { state: "Rajasthan", language: "Hindi" },
  Kolkata: { state: "West Bengal", language: "Bengali" },
  Ahmedabad: { state: "Gujarat", language: "Gujarati" },
};
const subNiches = {
  Fitness: ["Home workouts", "Strength training", "Yoga", "Running", "Nutrition"],
  Food: ["Home cooking", "Street food", "Plant-based cooking", "Baking", "Regional cuisine"],
  Fashion: ["Streetwear", "Traditional fusion", "Minimalist style", "Affordable fashion", "Ethnic wear"],
  Travel: ["Budget travel", "Solo travel", "Weekend getaways", "Adventure travel", "Travel photography"],
  Technology: ["Gadgets", "AI tools", "Software tutorials", "Consumer tech", "Tech reviews"],
  Beauty: ["Skincare", "Makeup tutorials", "Haircare", "Clean beauty", "Beauty reviews"],
  Lifestyle: ["Daily routines", "Productivity", "Home decor", "Personal growth", "Minimal living"],
  Gaming: ["Mobile gaming", "PC gaming", "Game reviews", "Esports", "Gaming streams"],
  Business: ["Entrepreneurship", "Startups", "Marketing", "Personal branding", "Small business"],
  Education: ["Study tips", "Career guidance", "Science explainers", "Language learning", "Exam preparation"],
  Finance: ["Personal finance", "Saving tips", "Financial literacy", "Investing basics", "Budgeting"],
};
const bioTemplates = {
  Fitness: ["Sharing practical fitness ideas and everyday movement.", "Helping beginners build sustainable fitness habits."],
  Food: ["Exploring flavours, recipes and everyday food stories.", "Simple recipes and inspiration for curious home cooks."],
  Fashion: ["Everyday style, thoughtful outfits and fashion inspiration.", "Making personal style practical and accessible."],
  Travel: ["Discovering places, local culture and memorable journeys.", "Travel stories and practical tips for curious explorers."],
  Technology: ["Breaking down technology, tools and useful digital ideas.", "Exploring useful technology and sharing practical tutorials."],
  Beauty: ["Sharing beauty routines, product knowledge and honest tips.", "Simple beauty ideas and everyday self-care inspiration."],
  Lifestyle: ["Sharing everyday routines, ideas and personal discoveries.", "Practical inspiration for a thoughtful everyday life."],
  Gaming: ["Gaming highlights, recommendations and community moments.", "Exploring games, strategies and digital entertainment."],
  Business: ["Sharing practical lessons from business and entrepreneurship.", "Ideas for building, learning and growing in business."],
  Education: ["Making learning approachable through useful explanations.", "Study strategies and learning resources for curious minds."],
  Finance: ["Making money concepts easier to understand.", "Sharing educational content about saving and financial habits."],
};
const audienceTypes = [
  "Gen Z explorers",
  "Young professionals",
  "Students and learners",
  "Working professionals",
  "Beauty and style enthusiasts",
  "Tech-curious audiences",
  "Families and everyday consumers",
  "Fitness enthusiasts",
];
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
fakerEN_IN.seed(SEED);
const existing = JSON.parse(readFileSync(DATA_PATH, "utf8"));
assert(Array.isArray(existing), "The creator catalogue must be a JSON array.");
const previousGenerated = existing.filter(
  (creator) =>
    creator.id?.startsWith("creator_faker_") &&
    creator.dataSource === "Demo Dataset",
);
const originals = existing.filter(
  (creator) => !previousGenerated.includes(creator),
);
const ids = new Set();
const usernames = new Set();
for (const creator of originals) {
  assert(creator.id && typeof creator.id === "string", "An existing creator has an invalid ID.");
  assert(creator.username && typeof creator.username === "string", `Invalid username for ${creator.id}.`);
  const username = creator.username.toLowerCase();
  assert(!ids.has(creator.id), `Duplicate existing ID: ${creator.id}`);
  assert(!usernames.has(username), `Duplicate existing username: ${creator.username}`);
  ids.add(creator.id);
  usernames.add(username);
}
const generated = [];
for (let index = 1; index <= GENERATED_COUNT; index++) {
  const niche = niches[(index - 1) % niches.length];
  const location = fakerEN_IN.helpers.arrayElement(Object.keys(locations));
  const locationInfo = locations[location];
  const name = fakerEN_IN.person.fullName();
  const nameSlug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 14);
  const id = `creator_faker_${String(index).padStart(4, "0")}`;
  const username = `cf_${nameSlug}_${String(index).padStart(4, "0")}`;
  assert(!ids.has(id), `Generated ID collision: ${id}`);
  assert(!usernames.has(username.toLowerCase()), `Generated username collision: ${username}`);
  ids.add(id);
  usernames.add(username.toLowerCase());
  const followers = fakerEN_IN.number.int({ min: 1500, max: 900000 });
  const engagementRate =
    fakerEN_IN.number.int({ min: 12, max: 85 }) / 10;
  const viewsRatio =
    fakerEN_IN.number.int({ min: 15, max: 75 }) / 100;
  const averageViews = Math.max(100, Math.round(followers * viewsRatio));
  const averageLikes = Math.min(
    averageViews,
    Math.round(followers * engagementRate / 100 * 0.65),
  );
  const averageComments = Math.max(
    1,
    Math.round(averageLikes * fakerEN_IN.number.int({ min: 2, max: 10 }) / 100),
  );
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const daysAgo = fakerEN_IN.number.int({ min: 0, max: 365 });
  const lastUpdated = new Date(
    Date.UTC(2026, 10, 10) - daysAgo * 86400000,
  ).toISOString().slice(0, 10);
  generated.push({
    id,
    name,
    username,
    platform: "Instagram",
    niche,
    subNiche: fakerEN_IN.helpers.arrayElement(subNiches[niche]),
    location,
    state: locationInfo.state,
    followers,
    engagementRate,
    averageViews,
    averageLikes,
    averageComments,
    email: TEST_EMAILS[(index - 1) % TEST_EMAILS.length],
    bio: fakerEN_IN.helpers.arrayElement(bioTemplates[niche]),
    profileUrl: `https://example.invalid/creator/${id}`,
    avatar: initials || "CF",
    language: fakerEN_IN.helpers.arrayElement([
      locationInfo.language,
      "English",
      "Hindi",
    ]),
    audienceType: fakerEN_IN.helpers.arrayElement(audienceTypes),
    dataSource: "Demo Dataset",
    lastUpdated,
  });
}
// Validate every generated record before writing anything.
for (const creator of generated) {
  assert(creator.platform === "Instagram", `Invalid platform: ${creator.id}`);
  assert(niches.includes(creator.niche), `Invalid niche: ${creator.id}`);
  assert(Object.hasOwn(locations, creator.location), `Invalid location: ${creator.id}`);
  assert(creator.dataSource === "Demo Dataset", `Invalid source: ${creator.id}`);
  assert(TEST_EMAILS.includes(creator.email), `Unexpected email: ${creator.id}`);
  assert(creator.profileUrl.includes(".invalid/"), `Unsafe profile URL: ${creator.id}`);
  assert(Number.isInteger(creator.followers) && creator.followers > 0, `Invalid followers: ${creator.id}`);
  assert(creator.averageLikes <= creator.averageViews, `Invalid engagement metrics: ${creator.id}`);
}
for (const email of TEST_EMAILS) {
  const count = generated.filter((creator) => creator.email === email).length;
  assert(count === GENERATED_COUNT / TEST_EMAILS.length, `Unexpected count for ${email}: ${count}`);
}
const combined = [...originals, ...generated];
assert(combined.length === originals.length + GENERATED_COUNT, "Unexpected final record count.");
assert(new Set(combined.map((creator) => creator.id)).size === combined.length, "Duplicate IDs in final catalogue.");
assert(
  new Set(combined.map((creator) => creator.username.toLowerCase())).size === combined.length,
  "Duplicate usernames in final catalogue.",
);
mkdirSync(BACKUP_DIR, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = new URL(`creators-before-faker-${timestamp}.json`, BACKUP_DIR);
copyFileSync(DATA_PATH, backupPath);
writeFileSync(DATA_PATH, `${JSON.stringify(combined, null, 2)}\n`, "utf8");
const counts = Object.fromEntries(
  niches.map((niche) => [
    niche,
    generated.filter((creator) => creator.niche === niche).length,
  ]),
);
console.log("Creator catalogue generated successfully.");
console.log(`Original records preserved: ${originals.length}`);
console.log(`Previous Faker records replaced: ${previousGenerated.length}`);
console.log(`New Faker records added: ${generated.length}`);
console.log(`Final catalogue size: ${combined.length}`);
console.log("Generated creators by niche:", counts);
console.log(`Backup created: ${backupPath.pathname}`);
