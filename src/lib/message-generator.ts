import type { Creator } from "@/types/creator";

export function generateMessage(
  creator: Creator,
  brandName: string,
): string {
  return `Hi ${creator.name.split(" ")[0]},\n\nI’ve been enjoying your ${creator.niche.toLowerCase()} content on Instagram, especially the thoughtful perspective you bring to your community. I’m reaching out from ${brandName} to explore a potential collaboration that feels like a natural fit for your audience.\n\nWould you be open to hearing a few more details? We’d love to learn what a partnership could look like for you.\n\nBest,\n${brandName} team`;
}
