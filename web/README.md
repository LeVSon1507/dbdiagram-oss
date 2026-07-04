# Schema Studio web

A single-user, local-first DBML editor built with Next.js 16, React 19, React
Flow, CodeMirror, and `@dbml/core`.

## Features

- Edit DBML with live validation and source locations for parser errors.
- DBML syntax highlighting and context-aware autocomplete for snippets, tables,
  field settings, and common data types.
- Interactive ER diagram with pan, zoom, minimap, drag, snap-to-grid,
  auto-layout, fit-to-view, and table search.
- Local schema insights for missing primary keys, likely unlinked foreign keys,
  and optional relationships.
- Optional AI Architect for schema review, DBML generation, improvement
  proposals, and schema questions. AI changes can be accepted or rejected by
  hunk before an explicit Apply action.
- Unified undo and redo for DBML edits and table positions.
- IndexedDB persistence with automatic migration from the previous
  `localStorage` format.
- Durable version history with manual, automatic, pre-import, pre-AI, and
  pre-restore snapshots.
- Semantic schema comparison covering tables, columns, indexes, checks,
  defaults, nullability, primary keys, unique constraints, and relationships.
- PostgreSQL migration preview with explicit rename mapping, dependency-safe
  ordering, destructive-operation warnings, copy, and download.
- Create, rename, switch, and delete multiple diagrams.
- Automatic browser storage persistence. No backend or login is required.
- Import DBML, PostgreSQL, MySQL, SQL Server, and Oracle schemas.
- Export DBML, PostgreSQL, MySQL, SQL Server, Oracle, and normalized JSON.
- Responsive light and dark interfaces.

## Development

Node.js 20.9 or newer is required.

```bash
npm install
npm run dev
```

The app runs at <http://localhost:3000>.

## Quality checks

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
```

## Self-host

The production build uses Next.js standalone output:

```bash
npm run build
node .next/standalone/server.js
```

The entire workspace and up to 50 snapshots per diagram stay in browser
IndexedDB. Back up important diagrams with the DBML export before clearing
browser data.

## AI configuration

The server route supports providers exposing an OpenAI-compatible
`/chat/completions` endpoint. Credentials are never returned to the browser.

```bash
cp .env.example .env.local
```

Configure:

```dotenv
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=your-provider-key
AI_MODEL=your-model-name
```

For a local provider such as Ollama:

```dotenv
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=your-local-model
```

Restart the development server after changing environment variables. DBML is
sent to the configured provider only when you click an AI action.
