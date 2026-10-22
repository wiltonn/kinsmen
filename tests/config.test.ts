import { describe, expect, it } from 'vitest';
import { readConfig } from '../src/lib/config';

describe('readConfig', () => {
  it('defaults to non-production fixtures with no environment', () => {
    expect(readConfig({})).toMatchObject({ siteEnv: 'development', isProduction: false, contentSource: 'fixtures' });
  });

  it('uses Sanity automatically when a project ID is set', () => {
    const config = readConfig({ SANITY_PROJECT_ID: 'abc123' });
    expect(config.contentSource).toBe('sanity');
    expect(config.sanity).toMatchObject({ projectId: 'abc123', dataset: 'production' });
  });

  it('refuses to build production from fixtures', () => {
    expect(() => readConfig({ SITE_ENV: 'production' })).toThrow(/fixture/);
    expect(() => readConfig({ SITE_ENV: 'production', SANITY_PROJECT_ID: 'abc', CONTENT_SOURCE: 'fixtures' })).toThrow(/fixture/);
  });

  it('allows production with Sanity', () => {
    expect(readConfig({ SITE_ENV: 'production', SANITY_PROJECT_ID: 'abc' })).toMatchObject({ isProduction: true, contentSource: 'sanity' });
  });

  it('treats anything other than "production" as non-production (never indexed)', () => {
    for (const value of ['preview', 'staging', 'Production-ish', '']) {
      expect(readConfig({ SITE_ENV: value }).isProduction).toBe(false);
    }
  });

  it('rejects unknown content sources and Sanity without a project', () => {
    expect(() => readConfig({ CONTENT_SOURCE: 'wordpress' })).toThrow();
    expect(() => readConfig({ CONTENT_SOURCE: 'sanity' })).toThrow(/SANITY_PROJECT_ID/);
  });
});
