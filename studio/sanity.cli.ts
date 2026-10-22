import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? 'replace-me',
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  // Hosted at https://<studioHost>.sanity.studio after `npm run deploy`.
  studioHost: process.env.SANITY_STUDIO_HOST,
});
