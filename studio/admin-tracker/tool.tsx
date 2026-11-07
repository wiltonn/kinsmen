/**
 * The Sanity Studio tool: "Website Admin" in the Studio's top menu.
 * Uses the logged-in volunteer's own Sanity session; no extra tokens.
 */
import { useMemo } from 'react';
import { useClient, useCurrentUser, type Tool } from 'sanity';
import { ClipboardIcon } from '@sanity/icons/Clipboard';
import { TrackerApp } from './TrackerApp';
import { createSanityRepository, type TrackerClient } from './sanityRepository';
import { REPO_URL, canEditTracker } from './model';
import checklistMarkdown from '../../docs/launch-checklist.md?raw';

export interface AdminTrackerOptions {
  /** Preview site origin, used to link its /dev/content-review page. */
  previewUrl?: string;
}

function AdminTrackerTool({ tool }: { tool: Tool<AdminTrackerOptions> }) {
  const client = useClient({ apiVersion: '2026-10-01' });
  const user = useCurrentUser();
  const repository = useMemo(() => createSanityRepository(client as unknown as TrackerClient), [client]);
  const previewUrl = tool.options?.previewUrl?.replace(/\/$/, '');
  return (
    <TrackerApp
      repository={repository}
      canEdit={canEditTracker(user?.roles)}
      checklistMarkdown={checklistMarkdown}
      checklistSourceUrl={`${REPO_URL}/blob/main/docs/launch-checklist.md`}
      contentReviewUrl={previewUrl ? `${previewUrl}/dev/content-review` : undefined}
    />
  );
}

export const adminTrackerTool = (options: AdminTrackerOptions = {}): Tool<AdminTrackerOptions> => ({
  name: 'website-admin',
  title: 'Website Admin',
  icon: ClipboardIcon,
  component: AdminTrackerTool,
  options,
});
