import ErrorBoundary from "@/components/ErrorBoundary";
import type { JacketAppearance } from "@/features/configurator";
import { MODEL_ASSETS } from "../assets";
import GltfJacket, { type EmbroideryInteraction } from "./GltfJacket";
import ProceduralJacket from "./ProceduralJacket";
import type { JacketSilhouette } from "./silhouettes";

export type JacketModelProps = {
  appearance: JacketAppearance;
  silhouette: JacketSilhouette;
  /**
   * A specific file to render; defaults to this silhouette's entry in
   * MODEL_ASSETS.jackets. null = stand-in.
   */
  url?: string | null;
  /** Cast real-time shadows (scenes with a shadow-casting light). */
  castShadow?: boolean;
  /** Editable embroidery (configurator); omit for display-only jackets. */
  embroidery?: EmbroideryInteraction;
  /** Front open (with appearance.closure.zipper). */
  open?: boolean;
};

/**
 * The one jacket component scenes use. Renders the real GLB when one is
 * listed for this silhouette in assets.ts, otherwise the temporary
 * procedural jacket — which is also the fallback if the GLB fails to
 * load. Both take the same props. Suspends while a GLB loads, so wrap
 * it in <Suspense>.
 */
export default function JacketModel({
  appearance,
  silhouette,
  url: explicitUrl,
  castShadow = false,
  embroidery,
  open = false,
}: JacketModelProps) {
  const url = explicitUrl === undefined ? MODEL_ASSETS.jackets[silhouette] : explicitUrl;
  const standIn = <ProceduralJacket appearance={appearance} silhouette={silhouette} />;

  if (!url) return standIn;
  return (
    <ErrorBoundary fallback={standIn} resetKey={url}>
      <GltfJacket
        url={url}
        appearance={appearance}
        castShadow={castShadow}
        embroidery={embroidery}
        open={open}
      />
    </ErrorBoundary>
  );
}
