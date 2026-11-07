/**
 * LOCAL DEMO of the Website Admin tracker. Same UI as the Studio tool, but
 * items live in this browser's localStorage instead of Sanity.
 * Dev-server only: `npm run admin:demo --prefix studio`. Never built or deployed.
 */
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@sanity/ui/styles.css';
import { Button, Card, LayerProvider, PortalProvider, Stack, Text, ThemeProvider, studioTheme, usePrefersDark } from '@sanity/ui';
import { TrackerApp } from '../admin-tracker/TrackerApp';
import { createLocalRepository } from '../admin-tracker/localRepository';
import { REPO_URL } from '../admin-tracker/model';
import checklistMarkdown from '../../docs/launch-checklist.md?raw';

function safeStorage(): Storage | undefined {
  try {
    const s = window.localStorage;
    s.setItem('kfsb-storage-test', '1');
    s.removeItem('kfsb-storage-test');
    return s;
  } catch {
    return undefined;
  }
}

function Demo() {
  const scheme = usePrefersDark() ? 'dark' : 'light';
  const [version, setVersion] = useState(0);
  const repository = useMemo(() => createLocalRepository(safeStorage(), window), [version]);

  const banner = (
    <Card padding={4} radius={2} tone="caution" border>
      <Stack gap={3}>
        <Text weight="semibold">Local demo: changes are private to this browser</Text>
        <Text size={1}>
          {repository.persistent
            ? 'Items are saved in this browser’s local storage and survive a refresh. Nobody else can see them, and nothing is sent to Sanity or the website.'
            : 'This browser is blocking local storage, so changes will be lost when you refresh. Nothing is sent anywhere.'}{' '}
          The real tool runs inside Sanity Studio and is shared by everyone signed in to the project.
        </Text>
      </Stack>
    </Card>
  );

  const reset = (
    <Button
      text="Reset demo"
      mode="ghost"
      fontSize={1}
      padding={2}
      onClick={async () => {
        await repository.reset();
        setVersion((v) => v + 1);
      }}
    />
  );

  return (
    <ThemeProvider theme={studioTheme} scheme={scheme}>
      <LayerProvider>
        <PortalProvider element={document.body}>
          <TrackerApp
            key={version}
            repository={repository}
            canEdit
            banner={banner}
            headerActions={reset}
            checklistMarkdown={checklistMarkdown}
            checklistSourceUrl={`${REPO_URL}/blob/main/docs/launch-checklist.md`}
            contentReviewUrl="http://localhost:4321/dev/content-review"
          />
        </PortalProvider>
      </LayerProvider>
    </ThemeProvider>
  );
}

const root = createRoot(document.getElementById('root')!);
if (!import.meta.env.DEV) {
  root.render(<p>The Website Admin demo only runs on the local development server.</p>);
} else {
  root.render(
    <StrictMode>
      <Demo />
    </StrictMode>,
  );
}
