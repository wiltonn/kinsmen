import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes, SINGLETONS } from './schemaTypes';
import { structure } from './structure';
import { adminTrackerTool } from './admin-tracker/tool';

// Project ID and dataset are public identifiers, not secrets.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'replace-me';
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';
const singletons = new Set<string>(SINGLETONS);
// Website Admin tracker: off until the project is set up for it (docs/spikes/admin-tracker.md).
const adminTrackerEnabled = process.env.SANITY_STUDIO_ADMIN_TRACKER === 'enabled';

export default defineConfig({
  name: 'default',
  title: 'Kinsmen Fanshawe Sugar Bush',
  projectId,
  dataset,
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: '2026-10-01' })],
  tools: (prev) => (adminTrackerEnabled ? [...prev, adminTrackerTool({ previewUrl: process.env.SANITY_STUDIO_PREVIEW_URL })] : prev),
  schema: {
    types: schemaTypes,
    // Singletons can't be created again from the "new document" menu.
    templates: (templates) => templates.filter(({ schemaType }) => !singletons.has(schemaType)),
  },
  document: {
    // Singletons can't be deleted or duplicated.
    actions: (actions, { schemaType }) =>
      singletons.has(schemaType)
        ? actions.filter(({ action }) => action && ['publish', 'discardChanges', 'restore'].includes(action))
        : actions,
  },
});
