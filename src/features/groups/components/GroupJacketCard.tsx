import { useState } from "react";
import { Link } from "react-router-dom";
import { PatchChip, ProductStage, SwatchTrio } from "@/features/cart/components/editorial";
import { QuantityStepper } from "@/features/cart/components/ui";
import { getColour, getMaterial } from "@/features/configurator/model/catalog";
import { zoneName } from "@/features/configurator/model/embroideryGeometry";
import Ltr from "@/i18n/Ltr";
import { Trans } from "@/i18n/Trans";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";
import { groupsApi } from "../api";
import { useGroupError } from "../errors";
import type { GroupJacket, VisibleDesign } from "../types";
import { ConfirmAction } from "./ui";

/** Colours, materials and the visible embroidery of a jacket — what the group may see. */
function DesignDetails({ design }: { design: VisibleDesign }) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const zone = (z: "body" | "sleeves") => {
    const colour = getColour(design.colours[z]);
    const material = getMaterial(design.materials[z]);
    return t("cart.item.zoneValue", { colour: names.colour(colour.id, colour.name), material: names.material(material.id, material.name) });
  };
  return (
    <>
      <div className="jk-gjacket__chips">
        <PatchChip>{zone("body")}</PatchChip>
        <PatchChip>{zone("sleeves")}</PatchChip>
      </div>
      <SwatchTrio config={design} />
      <div>
        <p className="jk-label-xs text-jk-muted">{t("group.jacket.embroidery")}</p>
        {design.embroidery.length === 0 ? (
          <p className="mt-2 text-[13px] text-jk-ink">{t("group.jacket.noEmbroidery")}</p>
        ) : (
          <dl className="jk-gjacket__embroidery mt-2">
            {design.embroidery.map((e, i) => (
              <div key={`${e.placement}-${i}`} className="contents">
                <dt>{names.placement(e.placement, zoneName(e.placement))}</dt>
                <dd>
                  {e.kind === "text" ? (
                    <bdi dir="auto">{e.text}</bdi>
                  ) : e.design.frontLetters ? (
                    <Trans
                      k="group.jacket.letters"
                      vars={{ letters: `${e.design.frontLetters.letter1} ${e.design.frontLetters.letter2}` }}
                      tags={{ letters: (c) => <Ltr>{c}</Ltr> }}
                    />
                  ) : e.design.source === "library" ? (
                    <>
                      {t("group.jacket.library")}
                      {e.design.libraryTitle && (
                        <>
                          {" · "}
                          <bdi dir="auto">{e.design.libraryTitle}</bdi>
                        </>
                      )}
                    </>
                  ) : (
                    t("group.jacket.upload")
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </>
  );
}

/**
 * One jacket in the group. Everyone sees the still, size, quantity and
 * visible details. Only its owner gets the controls (quantity, edit,
 * remove) — and only while the server allows changes (`editable`); the
 * server checks ownership again on every change.
 */
export function GroupJacketCard({
  jacket,
  groupId,
  ownerName,
  editable,
  onChanged,
}: {
  jacket: GroupJacket;
  groupId: string;
  ownerName: string;
  editable: boolean;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const message = useGroupError();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const yours = jacket.isYours;
  const canChange = yours && editable;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
      // Success or conflict alike: show what the server has now.
      onChanged();
    }
  };

  return (
    <article className={`jk-gjacket ${yours ? "jk-gjacket--yours" : ""}`} aria-label={yours ? t("group.jacket.yours") : t("group.jacket.previewAlt", { name: ownerName })}>
      <ProductStage
        src={jacket.previewUrl}
        className="jk-gjacket__stage"
        emptyLabel={yours ? undefined : t("group.jacket.noPreview")}
        alt={yours ? t("group.jacket.previewAltYours") : t("group.jacket.previewAlt", { name: ownerName })}
      />
      <div className="jk-gjacket__body">
        {yours && <p className="jk-label text-jk-red">{t("group.jacket.yours")}</p>}
        <div className="jk-gjacket__chips">
          <PatchChip strong>
            {jacket.design.size ? (
              <Trans k="group.jacket.size" vars={{ size: jacket.design.size }} tags={{ size: (c) => <Ltr>{c}</Ltr> }} />
            ) : (
              t("group.jacket.noSize")
            )}
          </PatchChip>
          {!canChange && <PatchChip>{t("group.jacket.quantity", { quantity: jacket.quantity })}</PatchChip>}
        </div>
        <DesignDetails design={jacket.design} />
        {error && (
          <p className="jk-gjacket__error" role="alert">
            {error}
          </p>
        )}
        {canChange && (
          <div className="jk-gjacket__actions">
            <QuantityStepper
              label={t("group.jacket.quantityAria")}
              value={jacket.quantity}
              onChange={(quantity) => !busy && void run(() => groupsApi.updateJacket(groupId, jacket.id, { quantity, expectedVersion: jacket.version }))}
            />
            <Link to={`${ROUTES.design}?group=${groupId}&item=${jacket.id}`} className="jk-label jk-link min-h-11 inline-flex items-center text-jk-ink">
              {t("group.jacket.edit")}
            </Link>
            <ConfirmAction
              label={t("group.jacket.remove")}
              question={t("group.jacket.removeConfirm")}
              className="jk-label jk-link min-h-11 text-jk-muted hover:text-jk-accent"
              disabled={busy}
              onConfirm={() => run(() => groupsApi.removeJacket(groupId, jacket.id, jacket.version))}
            />
          </div>
        )}
      </div>
    </article>
  );
}
