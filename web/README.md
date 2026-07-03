# Schema Studio web

A single-user, local-first DBML editor built with Next.js 16, React 19, React
Flow, CodeMirror, and `@dbml/core`.

## Features

- Edit DBML with live validation and source locations for parser errors.
- Interactive ER diagram with pan, zoom, minimap, drag, snap-to-grid,
  auto-layout, fit-to-view, and table search.
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

The entire workspace stays in the browser's local storage. Back up important
diagrams with the DBML export before clearing browser data.
