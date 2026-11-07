// Vite `?raw` imports (used to bundle docs/launch-checklist.md as text).
declare module '*.md?raw' {
  const content: string;
  export default content;
}
