# TCRP — Base44 dev notes

- Run: `docker compose -f docker-compose.base44.yml up -d` (web on host port 3000).
- Plain Node http server (`server.js`), no bundler; `node --watch` restarts on edits.
- DB is Turso (libSQL) accessed over raw HTTPS `/v2/pipeline` in `lib/db.js`. Locally a
  `libsql-server` container stands in; `DATABASE_URL=http://db:8080` (no auth token needed).
- `schema.sql` is applied by the one-shot `db-init` service (`scripts/base44-init-db.mjs`).
  `lib/db.js` also self-runs additive migrations on import.
- Quirk: a stray repo-root file named `node` shadows the runtime when invoked as `node x.mjs`
  from /app — use the absolute `/usr/local/bin/node` in compose commands.
- Placeholder env values live in `.env.base44-defaults`; real secrets come from
  `/run/base44/app.env` (listed last so they win).
- Static pages served from `public/` then `views/`.
