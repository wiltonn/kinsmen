/**
 * Build-time configuration, read from environment variables.
 * `readConfig` is pure so the safety rules can be unit-tested.
 */

export type SiteEnv = 'production' | 'preview' | 'development';
export type ContentSource = 'sanity' | 'fixtures';

export interface RuntimeConfig {
  siteEnv: SiteEnv;
  /** Only true for the live production deployment. Controls indexing. */
  isProduction: boolean;
  siteUrl: string;
  contentSource: ContentSource;
  sanity?: {
    projectId: string;
    dataset: string;
    apiVersion: string;
    token?: string;
    /** Testing only: point the client at a mock API (e.g. http://localhost:3333). */
    apiHost?: string;
  };
  /** Fail the build when published content still needs review. */
  strictReview: boolean;
  fixtureBooking: { bookingUrl?: string; widgetLoaderUrl?: string };
}

type Env = Record<string, string | boolean | undefined>;

const str = (value: string | boolean | undefined) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export function readConfig(env: Env): RuntimeConfig {
  const rawEnv = str(env.SITE_ENV)?.toLowerCase();
  const siteEnv: SiteEnv =
    rawEnv === 'production' ? 'production' : rawEnv === 'preview' || rawEnv === 'staging' ? 'preview' : 'development';
  const isProduction = siteEnv === 'production';

  const projectId = str(env.SANITY_PROJECT_ID);
  const requested = str(env.CONTENT_SOURCE)?.toLowerCase();
  if (requested && requested !== 'sanity' && requested !== 'fixtures') {
    throw new Error(`CONTENT_SOURCE must be "sanity" or "fixtures", got "${requested}".`);
  }
  const contentSource: ContentSource = (requested as ContentSource | undefined) ?? (projectId ? 'sanity' : 'fixtures');

  if (isProduction && contentSource === 'fixtures') {
    throw new Error(
      'Refusing to build the production site from development fixture content. ' +
        'Set SANITY_PROJECT_ID (and CONTENT_SOURCE=sanity) for production builds. See README.md.',
    );
  }
  if (contentSource === 'sanity' && !projectId) {
    throw new Error('CONTENT_SOURCE=sanity requires SANITY_PROJECT_ID. See .env.example.');
  }

  return {
    siteEnv,
    isProduction,
    siteUrl: (str(env.PUBLIC_SITE_URL) ?? 'https://www.kinsmenfanshawesugarbush.com').replace(/\/$/, ''),
    contentSource,
    sanity:
      contentSource === 'sanity' && projectId
        ? {
            projectId,
            dataset: str(env.SANITY_DATASET) ?? 'production',
            apiVersion: str(env.SANITY_API_VERSION) ?? '2026-10-01',
            token: str(env.SANITY_READ_TOKEN),
            apiHost: str(env.SANITY_API_HOST),
          }
        : undefined,
    strictReview: str(env.STRICT_CONTENT_REVIEW)?.toLowerCase() === 'true',
    fixtureBooking: {
      bookingUrl: str(env.FIXTURE_OPENTABLE_BOOKING_URL),
      widgetLoaderUrl: str(env.FIXTURE_OPENTABLE_WIDGET_LOADER_URL),
    },
  };
}

let cached: RuntimeConfig | undefined;

/** Config for the current build (Astro exposes .env values on import.meta.env server-side). */
export function getConfig(): RuntimeConfig {
  cached ??= readConfig({ ...process.env, ...import.meta.env });
  return cached;
}
