# kobberogkran.no

Source for the website of Kobber og Kran AS at [kobberogkran.no](https://kobberogkran.no),
in Norwegian (`nb`, default, served at `/`) and English (`en`, served at `/en/`).

This repo is the single source of truth for code, content and images. Pushes to `main`
deploy automatically to Cloudflare. Content can be edited through the no-code editor at
`/admin` or by asking an agent.

## Commands

Requires Node 24 (see `.nvmrc`).

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server |
| `npm run build` | Build the site into `dist/` |
| `npm run preview` | Preview the built site locally |
| `npm run check` | Type-check the project (`astro check`) |
| `npm test` | Run the unit tests (Vitest) |
| `npm run check:dist` | Assert the built output is complete (run after `build`) |

## Where things are

- Agent and contributor instructions: [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md)
- Owner runbooks (DNS, Cloudflare, GitHub, rollback, watchdog): [`docs/runbooks/`](docs/runbooks/)
- Incoming branding and layout files: [`brand/`](brand/)
- Design and plan: [`docs/superpowers/`](docs/superpowers/)
