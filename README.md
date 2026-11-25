# JACKETEK

Custom senior and varsity jacket design platform. Customers design a jacket in a 3D configurator (colours, materials, embroidery, patches and lettering), save designs, order, and organise group orders. The admin side manages orders and generates manufacturing Tech Packs from the R2 base-garment master.

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, three.js (react-three-fiber)
- **Backend:** Node.js (`server/index.mjs`, plain `node:http`), SQLite via the built-in `node:sqlite`
- **PDF Tech Packs:** HTML printed by a local Chrome or Edge (headless)

## Requirements

- **Node.js 24** (see `.nvmrc`; `node:sqlite` needs Node 22.5 or newer) and npm
- **Google Chrome or Microsoft Edge**, only for generating PDF Tech Packs
- **Git / GitHub Desktop**

## Installation

```bash
git clone https://github.com/<owner>/jacketek.git
cd jacketek
npm ci
```

`npm ci` installs exactly the versions in `package-lock.json`.

## Environment configuration

`npm run dev` creates `.env.local` on first run, with a random `ADMIN_KEY`, and prints the key. To set it up by hand instead:

```bash
cp .env.example .env.local     # then set ADMIN_KEY (16+ random characters)
```

`.env.example` lists every optional variable (`PORT`, `DATA_DIR`, `GROUP_INVITE_SECRET`, `EMBROIDERY_LIBRARY_DIR`, …). Never commit `.env.local`.

The database is created automatically on the first server start: an empty `server-data/jacketek.db`, with migrations applied. `server-data/` holds orders and customer data and is never committed.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Website at http://localhost:5173 plus the API server at http://localhost:8787 (Vite forwards `/api`). Admin: http://localhost:5173/admin/orders |
| `npm run dev:site` / `npm run dev:server` | Frontend only / backend only |
| `npm run build` | Type-check (`tsc -b`) and production build into `dist/` |
| `npm start` | Serve the API (and `dist/`, after a build) with `server/index.mjs` |
| `npm run lint` | ESLint |
| `npm run test:groups` | Group-order tests (sign-up, groups, saved design items, migrations) |
| `node --test --test-concurrency=1 scripts/techpack/production-techpack.test.mjs` | Production Tech Pack (R2 master) tests. The generation part is skipped, with a message, until the full embroidery library is installed. |
| `npm run test:techpack` | RFQ / Development Tech Pack tests. 5 of them need the licensed working flat and the full library (see below). Without those they fail with "Canonical flat not imported". |

Tests that generate PDFs need Chrome or Edge.

## Working together (two developers)

- **`main`** is the stable shared branch. Don't commit to it directly.
- Create a **feature branch** for every change, for example `feature/cart-discounts`. In GitHub Desktop: *Current branch → New branch*.
- Commit small steps, then **Push origin**. Open a **Pull Request** on GitHub; the other developer reviews it, then it is merged into `main`.
- **Fetch / Pull `main` often**, at least before starting new work. Then bring `main` into your branch (*Branch → Update from main*).
- Never force-push and never rewrite `main`. If both of you edited the same file, resolve the conflict in the Pull Request together.

## External assets (not in this repository)

These are needed for some features, but cannot be published for licence or privacy reasons. Each feature fails with a clear error when its asset is missing; the rest of the site works.

| Asset | Path | Needed for | How to obtain |
|---|---|---|---|
| Full embroidery library (licensed artwork) | `runtime-assets/embroidery-library/` (`assets/`, `colourways/`, `letter-templates/`, full `library.json`) | The full ready-made design catalogue. The repository has a small test subset that works out of the box. | Copied privately by the owner, never via Git. The licence covering the third-party character artwork must be confirmed before it is shared or deployed. Or point `EMBROIDERY_LIBRARY_DIR` at a private copy. |
| ↳ after copying the full library | | Keep its catalogues out of Git | `git update-index --skip-worktree runtime-assets/embroidery-library/library.json runtime-assets/embroidery-library/colourways/index.json runtime-assets/embroidery-library/letter-templates/index.json` |
| Embroidery colour layers | `embroidery-library-layers/` | Colourways for the full library | Copied together with the library |
| S.i. Graphics working flat (purchased licence) | `garment-spec/working-varsity-flat/` | RFQ Tech Packs, Development Tech Packs, `npm run test:techpack` | Licence forbids sharing the files. Each user needs their own licence, or the owner must get written permission from S.i. Graphics. Then run `node scripts/techflat/import-si-varsity.mjs`. |
| Purchased CLO garment source and R2 engineering pipeline | `garment-spec/varsity-mv2-source/`, `scripts/jacketek-*` | Only for rebuilding the R2 pattern itself | Owner's machine only (purchase terms not yet recorded) |
| Orders and customer data | `server-data/` | Real orders | Never shared. Each developer works with their own empty local database. |

The R2 master (`garment-spec/ACTIVE_TECHPACK_MASTER.json`) and every file it pins (the R2 supplier package and engineering data) **are** in the repository. The Production Tech Pack generator checks each one by SHA-256, so do not edit or re-save them. Change them only through `node scripts/techpack-master/build-active-master.mjs`, with the owner's approval. `.gitattributes` keeps their bytes identical on every checkout.
