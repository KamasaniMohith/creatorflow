# CreatorFlow

CreatorFlow is a local-first influencer discovery and outreach MVP for agency teams. It uses fictional sample profiles and stores campaign, shortlist, and outreach data in the current browser.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Run `npm run build` for a production build and `npm run lint` for ESLint.

## MVP features

- Discover 54 fictional Instagram creator profiles by niche, location, followers, engagement, name, or username.
- Add creators to a persistent shortlist and connect them to campaigns.
- Create, edit, track, and delete campaigns.
- Generate and edit personalized outreach message drafts, copy them, and manually track their statuses.
- Keep all sample data and working records in `src/data/creators.json` and browser LocalStorage.

## Demo limitations

The creator directory is fictional demonstration data; contact emails are not fabricated. The message generator is a local template, not an AI integration. Instagram messages must be sent manually. CreatorFlow does not scrape Instagram or send email/DMs.
