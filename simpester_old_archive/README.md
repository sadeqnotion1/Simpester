# Simpester — Elite Control

A polished, dark-glassmorphism control-center dashboard built from the Google
Stitch design export. Stack: **Vite + React + TypeScript + Tailwind CSS**.

## Screens

- **Overview** (`/`) — KPI stat cards, network performance chart, recent activity feed
- **Entity List** (`/entities`) — searchable/filterable entity table with pagination
- **Entity Detail** (`/entities/:id`) — system overview, resource allocation, network interfaces, quick config, danger zone
- **Settings** (`/settings`) — account profile, alerts & notifications, API key management

## Getting started

```bash
npm install
npm run dev
```

Then open the URL Vite prints (default http://localhost:5173).

Other scripts:

```bash
npm run build     # type-check + production build to dist/
npm run preview   # preview the production build
npm run lint      # type-check only (tsc --noEmit)
```

## Project structure

```
src/
  main.tsx              # app entry + router
  index.css             # Tailwind layers + design-token utility classes
  lib/data.ts           # mock data (KPIs, activity, entities, chart series)
  components/
    Layout.tsx          # sidebar + content shell
    Sidebar.tsx         # fixed left navigation
    Topbar.tsx          # per-page header (title, search, profile)
    PageBody.tsx        # max-width content wrapper
    GlassPanel.tsx      # reusable glassmorphism card
    Icon.tsx            # Material Symbols wrapper
    StatusBadge.tsx     # status pills (active/syncing/offline/critical...)
    Toggle.tsx          # accessible switch
    PerformanceChart.tsx# dependency-free SVG area chart
  pages/
    Overview.tsx
    EntityList.tsx
    EntityDetail.tsx
    Settings.tsx
```

## Design system

The design tokens from the Stitch `DESIGN.md` are wired into
`tailwind.config.js`:

- **Palette** — near-black background (`#05060a`) with violet/indigo accents
  (`primary #cfbcff`, gradient `#7c5cff → #b39dff`) and Material-style surface
  tokens.
- **Typography** — `Geist` for display/headings, `Inter` for body (loaded from
  Google Fonts in `index.html`).
- **Glassmorphism** — `.glass` utility: translucent surface + `backdrop-blur` +
  1px white/10 border + soft ambient shadow.
- **Icons** — Google Material Symbols, loaded via the font link in `index.html`
  and rendered through `<Icon name="..." />`.

> Fonts and icons load from Google Fonts CDN at runtime, so the first render
> needs network access.

## Why Vite + React (not Next.js)

This is a fully client-rendered dashboard (charts, toggles, blur effects). Vite
keeps the setup minimal with zero SSR/"use client" friction and maps almost 1:1
onto the Stitch Tailwind output. If you later need server rendering, API routes,
or SEO-critical pages, the components port cleanly into a Next.js App Router
project.

## Notes

- All data in `src/lib/data.ts` is mock data — wire it to your real API by
  replacing those exports (or fetching in each page).
- The chart is hand-rolled SVG (no charting dependency) so the bundle stays
  light; swap in Recharts/visx later if you need richer interactions.
