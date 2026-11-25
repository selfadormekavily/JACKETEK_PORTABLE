# features/configurator/

The jacket customisation experience, mounted at `/design`.

## Layers

```
model/        pure data + logic — no React, no 3D
  types.ts      JacketConfig (the design), zones, placements, views
  catalog.ts    every selectable option (colours, threads, sizes…)
  config.ts     defaults, embroidery sanitising, order validation

state/        React state
  reducer.ts    config (what gets ordered) + ui (step, view, focus)
  context.ts    useConfigurator()
  ConfiguratorProvider.tsx
  steps.ts      Colour → Embroidery → Fit → Review

viewer/       the rendering boundary
  types.ts      JacketViewerProps — the contract every renderer implements
  appearance.ts JacketConfig → JacketAppearance (hex + finish per zone)
  assetContract.ts  mesh / anchor / camera names the .glb must use
  JacketViewer.tsx  the ONE place a renderer is chosen: the lazy 3D
                    viewer (src/three/), or the 2D fallback without WebGL
  ViewerPlaceholder.tsx  2D fallback

components/   configurator UI (stage, numbered sections, panels, primitives)
index.ts      public API — import from "@/features/configurator"
```

Data flows one way: panels dispatch actions → reducer updates
`config`/`ui` → `resolveAppearance(config)` → `<JacketViewer>`.

## The real 3D jacket

The 3D viewer lives in `src/three/` (see its README). Swapping the
temporary procedural jacket for the real GLB is a change to
`src/three/assets.ts` — no panel, layout or state changes.

## Adding options

New colours/threads/sizes: edit `model/catalog.ts`. A new colour
zone or placement: add it to the union in `model/types.ts`, then
TypeScript will point at every place that must handle it.
