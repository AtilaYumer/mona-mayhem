# Mona Mayhem Agent Instructions

## Scope
- Work in `src/`, `public/`, and root config files.
- Ignore workshop materials unless explicitly requested: `workshop/**`.

## Project Overview
- Astro v5 app that compares two GitHub contribution graphs.
- SSR runtime with Node adapter in standalone mode.
- Main page: `src/pages/index.astro`.
- Runtime API route: `src/pages/api/contributions/[username].ts`.

## Build and Dev Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Production build: `npm run build`
- Local preview: `npm run preview`

## Astro Best Practices
- Keep API routes server-only and typed with `APIRoute`.
- Use `export const prerender = false` for runtime API routes.
- Validate and sanitize route params before external requests.
- Return explicit API responses with status code and JSON error payloads.
- Prefer mostly static Astro pages; add client scripts only when needed.

## Working Rules
- Make focused, minimal edits; avoid unrelated refactors.
- Run `npm run build` for substantial changes.
- Prefer links over duplicated guidance:
	- Project overview and setup: [README.md](README.md)
	- Astro runtime config: [astro.config.mjs](astro.config.mjs)
	- TypeScript strictness: [tsconfig.json](tsconfig.json)
- If instructions conflict, follow explicit user requests.