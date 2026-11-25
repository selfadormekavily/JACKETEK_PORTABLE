# Ready-made embroidery library

The configurator's ready-made designs, colourways and Front Letters all read one
library, served under the URL prefix `/embroidery-library/` (`root.ts`). Orders
store library paths under that prefix, so it never changes.

## Where the files are

`runtime-assets/embroidery-library/` at the project root (`library.json`,
`assets/`, `colourways/`, `letter-templates/`). It is deliberately **not** under
`public/`: Vite copies everything in `public/` into `dist/`, which would add
another ~1.7 GB copy on every `npm run build`. The Vite dev server
(`vite.config.ts`) and the Node server (`server/index.mjs`) both serve
`/embroidery-library/` from this one folder, and production reads library files
from it (`server/embroideryLibrary.mjs`). `EMBROIDERY_LIBRARY_DIR` in
`.env.local` (relative to the project root, or absolute) points them at another
folder instead.

## What ships in the repository

Git tracks the catalogues (`library.json`, `colourways/index.json`,
`letter-templates/index.json`) and the artwork of a **test subset** only: four
original JACKETEK designs drawn by `scripts/embroidery-fixtures/build.mjs` from
shapes and the site's own SIL OFL embroidery fonts (no third-party artwork):

| Design | Exercises | Zones |
| --- | --- | --- |
| Varsity monogram | Front Letters (template + glyphs A–Z) | chest |
| Star crest | Colourway (Outer / Inner slots, region map) | chest, back, sleeves |
| "27" number | plain ready-made design | chest, sleeves |
| "Class of 2027" banner | plain ready-made design | main back |

Rebuild it with `node scripts/embroidery-fixtures/build.mjs <outDir>` (needs
Chrome or Edge). It wipes its output folder first, so it refuses a folder that
holds the full library.

## The full library

The imported OJISAN library (about 1.7 GB, including licensed-character
collections) is **not** in the site bundle and its artwork is git-ignored. Do
not put it in `public/`, and do not deploy it publicly, until its licensing is
confirmed in writing. Collections can be removed from its `library.json` to
publish only cleared ones.
