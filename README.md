# Schema Studio

Schema Studio is a private, local-first database diagram editor inspired by
dbdiagram.io. The application has been rewritten from Vue/Quasar to Next.js,
React, and strict TypeScript.

All diagrams are stored in the browser. There is no account, backend, tracking,
or cloud sync.

## Run locally

```bash
cd web
npm install
npm run dev
```

Open <http://localhost:3000>.

## Verify

```bash
cd web
npm test
npm run lint
npm run build
```

See [web/README.md](web/README.md) for features and deployment details.
