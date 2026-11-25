import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useI18n } from "@/i18n/useI18n";
import { canUseWebGL } from "@/lib/webgl";
import ViewerPlaceholder from "./ViewerPlaceholder";
import type { JacketViewerProps } from "./types";

// Three.js lives in its own chunk, loaded only when the viewer mounts.
const ThreeJacketViewer = lazy(() => import("@/three/ThreeJacketViewer"));

/**
 * The single mount point for the jacket renderer: the 3D viewer, or —
 * without WebGL, or if the 3D viewer fails — the 2D readout. Both
 * implement JacketViewerProps, so nothing else in the configurator
 * cares which.
 */
export default function JacketViewer(props: JacketViewerProps) {
  const fallback = <ViewerPlaceholder {...props} />;
  if (!canUseWebGL()) return fallback;

  return (
    <ErrorBoundary fallback={fallback}>
      <Suspense fallback={<ViewerLoading />}>
        <ThreeJacketViewer {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

function ViewerLoading() {
  const { t } = useI18n();
  return (
    <div className="flex h-full w-full items-center justify-center">
      <span className="jk-cfg-meta text-[10px] tracking-widest2 uppercase text-jk-muted">
        {t("common.loading")}
      </span>
    </div>
  );
}
