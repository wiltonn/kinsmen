/**
 * Development-only fixture scenarios, for previewing seasonal states without
 * Sanity. Set FIXTURE_SCENARIO when running `npm run dev` / `npm run build`.
 * Fixtures (and therefore scenarios) can never be used in production.
 *
 * Scenario content is clearly fictional and labelled `sample`.
 */
import type { SiteContent } from './content/types';

export const SCENARIOS = [
  'default',
  'reservations-opening-soon',
  'reservations-open',
  'season-active',
  'visitor-alert',
  'season-ended',
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export function applyScenario(content: SiteContent, name: string | undefined): SiteContent {
  const scenario = (name?.trim() || 'default') as Scenario;
  if (!SCENARIOS.includes(scenario)) {
    throw new Error(`Unknown FIXTURE_SCENARIO "${name}". Use one of: ${SCENARIOS.join(', ')}`);
  }
  if (scenario === 'default' || !content.season) return content;

  const season = structuredClone(content.season);
  const next: SiteContent = { ...content, season };
  const sampleNote = `FIXTURE_SCENARIO=${scenario} (development preview, not real).`;
  season.provenance = 'sample';
  season.reviewNote = sampleNote;

  switch (scenario) {
    case 'reservations-opening-soon':
      season.reservations = { ...season.reservations, state: 'openingSoon', opensOn: '2027-01-15' };
      break;
    case 'reservations-open':
      season.reservations = { ...season.reservations, state: 'open' };
      season.pancakeHouse = { ...season.pancakeHouse, dateMode: 'sameAsOperating' };
      break;
    case 'season-active':
      season.status = 'open';
      season.reservations = { ...season.reservations, state: 'open' };
      season.pancakeHouse = { ...season.pancakeHouse, dateMode: 'sameAsOperating' };
      break;
    case 'visitor-alert':
      season.status = 'open';
      season.notice = {
        level: 'important',
        message: '[Sample alert] Trails are icy today — please wear sturdy boots.',
        expiresAt: '2099-01-01T00:00:00-05:00',
      };
      break;
    case 'season-ended':
      season.status = 'closed';
      season.reservations = { ...season.reservations, state: 'closed' };
      break;
  }
  return next;
}
