import { useProgress } from "@react-three/drei";
import { useI18n } from "@/i18n/useI18n";

/**
 * A quiet label shown over a canvas while model files download; fades
 * out when done. Render it next to (not inside) the <Canvas>.
 */
export default function LoadingIndicator() {
  const { active, progress } = useProgress();
  const { t } = useI18n();
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-700 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="text-[10px] tracking-widest2 uppercase text-jk-muted">
        {active ? t("common.loadingProgress", { percent: Math.round(progress) }) : ""}
      </span>
    </div>
  );
}
