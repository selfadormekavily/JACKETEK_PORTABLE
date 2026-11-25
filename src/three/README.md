# three/

Three.js / React Three Fiber code. Everything here is lazy-loaded, so
the 3D bundle never delays the page's first paint.

```
assets.ts               THE list of GLB files (null = use stand-in), incl.
                        the Design page jacket, plus per-file load options
                        (drop leftover nodes, recentre/rescale)

scene/                  the homepage hero scene
  FidelioScene.tsx      the hero canvas: two real jackets in a full-bleed
                        photo studio (or a framed stage), the camera, and
                        the scroll-driven transition (fade, travel, turn)

jacket/                 the customisable jacket
  JacketModel.tsx       what scenes render — GLB, or procedural stand-in
                        (also the fallback if the GLB fails to load)
  GltfJacket.tsx        real jacket GLB: zones tinted, embroidery, fit
  materialMapping.ts    MATERIAL-MAPPING LAYER: finds body / sleeves /
                        trim in any GLB by mesh or material name/pattern,
                        tints clones (keeps the asset's textures), logs
                        the discovered map in dev. Tune ZONE_MATCHERS here.
  ProceduralJacket.tsx  TEMPORARY stand-in varsity jacket
  materials.ts          the stand-in's own materials, updated live
  textures.ts           canvas-generated bump maps + embroidery text
  EmbroideryDecal.tsx   embroidery projected onto any parent mesh
                        (thread + contact shadow + selection frame)
  silhouettes.ts        male / female proportions of the stand-in

embroidery/             the embroidery customisation layer
  EmbroideryLayer.tsx   stitches every element onto the garment; pick +
                        drag along the fabric
  embroideryMaps.ts     text / image → stitch maps (colour, normal,
                        roughness, contact shadow); images are reduced
                        to ≤ 6 thread colours, sewn in blocks
  surfacePlacement.ts   zones (L/R/centre chest, upper back) and their
                        real-world sizes; ray-casts the actual surface

stage/                  reusable scene pieces
  StudioLighting.tsx    soft key, fill and rim light; no HDR download
  ProductControls.tsx   drag-to-rotate turntable, view presets, idle
                        sway, measured auto-framing with distance limits;
                        works with frameloop="demand"
  LoadingIndicator.tsx  quiet "Loading n%" over a canvas while files load
  pointerClaim.ts       lets a scene object take a drag from the turntable
  Cyclorama.tsx         seamless studio infinity cove (receives shadows)

ThreeJacketViewer.tsx   configurator viewer (implements JacketViewerProps)
heroLayout.ts           hero jackets (colours), composition authored in
                        screen space (wide + portrait) and scroll timeline
```

## The jacket model

The current file is set as `configuratorJacket` in `assets.ts` and is
used by both the Design page and the hero. Swap it there (and add its
`MODEL_FILE_OPTIONS` entry if it needs leftovers removed or recentring).

Export conventions: glTF 2.0 binary, metres, Y up, facing +Z, origin on
the floor. Jacket parts don't need specific names —
`jacket/materialMapping.ts` matches them (check the dev console's
"[jacket] material map" after loading and adjust `ZONE_MATCHERS` if a
part lands in the wrong zone). Base-colour textures should be neutral
(white/grey) so tints are accurate. Embroidery anchors follow
`features/configurator/viewer/assetContract.ts`.

Notes:
- Keep each file lean for the web (e.g. ≤ 10–15 MB, 2K textures).
- Draco-compressed files make drei fetch its decoder from Google's CDN
  (gstatic.com); host the decoder locally if that's not acceptable.
- The configurator frames the jacket from `silhouettes.ts`; when a real
  jacket GLB is used there, check its framing.

## Performance notes

- The configurator canvas renders on demand only (while rotating,
  easing or after a change).
- The hero canvas animates only while on screen and when the user
  hasn't asked for reduced motion.
- The environment map and bump textures are generated once.
