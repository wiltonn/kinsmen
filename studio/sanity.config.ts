import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes, SINGLETONS } from './schemaTypes';
import { structure } from './structure';

// Project ID and dataset are public identifiers, not secrets.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? 'replace-me';
const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production';
const singletons = new Set<string>(SINGLETONS);

export default defineConfig({
  name: 'default',
  title: 'Kinsmen Fanshawe Sugar Bush',
  projectId,
  dataset,
  plugins: [structureTool({ structure }), visionTool({ defaultApiVersion: '2026-10-01' })],
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
