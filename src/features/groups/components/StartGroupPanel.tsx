import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/context";
import { authUrl } from "@/features/auth/returnTo";
import { ArrowRight, Field } from "@/features/cart/components/ui";
import { zoneName } from "@/features/configurator/model/embroideryGeometry";
import { useCart } from "@/features/cart/context";
import type { CartItem } from "@/features/cart/types";
import Ltr from "@/i18n/Ltr";
import { Trans } from "@/i18n/Trans";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";
import { GroupApiError, groupsApi, newRequestId } from "../api";
import { useGroupError } from "../errors";
import { Notice } from "./ui";

/** One import carries at most this many jackets (what one checkout accepts). */
const MAX_IMPORT = 20;

/** A cart line's import id: the same line always has the same id, so a retry never adds it twice. */
const importId = (item: CartItem) => `cart:${item.id}`;

type Issue = { path: string; message: string };

/** Which part of a design an issue is about: the reason key and, for embroidery, the zone. */
function reasonOf(issues: Issue[], item: CartItem): { key: string; zone?: string } {
  const first = issues[0]?.path ?? "";
  const zoneAt = (path: string) => {
    const i = Number(/^embroidery\.(\d+)/.exec(path)?.[1]);
    return Number.isInteger(i) ? item.config.embroidery[i]?.placement : undefined;
  };
  if (first === "size") return { key: "size" };
  if (/^(colours|materials|buttons|fit|zipper)\b/.test(first)) return { key: "catalog" };
  if (/^embroidery\.\d+\.image/.test(first)) return { key: "artwork", zone: zoneAt(first) };
  if (/^embroidery\.\d+\.text/.test(first)) return { key: "text", zone: zoneAt(first) };
  if (/^embroidery\.\d+\.placement/.test(first)) return { key: "zone" };
  if (first === "quantity") return { key: "quantity" };
  return { key: "unreadable" };
}

/**
 * On the cart: start a group order — empty, or bringing chosen jackets from
 * the cart. The personal cart only changes after the server has confirmed
 * EVERY chosen jacket (the import is all-or-nothing): then exactly those
 * lines leave the cart. If the group is made but the jackets can't be moved,
 * they stay in the cart and moving them can simply be tried again.
 */
export function StartGroupPanel({ onOpenChange }: { onOpenChange?: (open: boolean) => void } = {}) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const message = useGroupError();
  const auth = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The cart line the server couldn't take (shown on its row).
  const [badItemId, setBadItemId] = useState<string | null>(null);

  /** A refused import in words: which jacket and what is wrong with it, when the server said. */
  const importProblem = (err: unknown) => {
    if (err instanceof GroupApiError && err.code === "INVALID_DESIGN" && typeof err.details.index === "number") {
      const item = chosen[err.details.index];
      if (item) {
        setBadItemId(item.id);
        const { key, zone } = reasonOf((err.details.issues as Issue[]) ?? [], item);
        const zoneLabel = zone ? names.placement(zone, zoneName(zone)) : "";
        return t("group.start.problem", {
          n: cart.items.indexOf(item) + 1,
          size: item.config.size ?? "—",
          reason: t(`group.start.reasons.${key}` as "group.start.reasons.unreadable", { zone: zoneLabel }),
        });
      }
    }
    if (err instanceof GroupApiError && err.code === "PAYLOAD_TOO_LARGE") return t("group.start.tooLarge");
    return message(err);
  };
  // Kept across retries: a double-click or a retry never makes a second group.
  const [createId, setCreateId] = useState(newRequestId);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const chosen = cart.items.filter((i) => picked.has(i.id));
  const tooMany = chosen.length > MAX_IMPORT;

  const moveJackets = async (groupId: string) => {
    const r = await groupsApi.importJackets(
      groupId,
      chosen.map((i) => ({ clientRequestId: importId(i), config: i.config, quantity: i.quantity, preview: i.preview })),
    );
    // Only lines the server confirmed (created now or already there) leave the cart — and only if all of them were.
    const confirmed = new Set(r.items.map((x) => x.clientRequestId));
    if (!chosen.every((i) => confirmed.has(importId(i)))) throw new Error("Import not confirmed");
    for (const i of chosen) cart.remove(i.id);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || tooMany) return;
    setBusy(true);
    setError(null);
    setBadItemId(null);
    try {
      let groupId = createdId;
      if (!groupId) {
        const created = await groupsApi.create({ name: name.trim() || null, clientRequestId: createId });
        groupId = created.group.id;
        setCreatedId(groupId);
      }
      if (chosen.length) {
        try {
          await moveJackets(groupId);
        } catch (err) {
          setError(`${t("group.start.partial")} ${importProblem(err)}`);
          return;
        }
      }
      setCreateId(newRequestId());
      navigate(`${ROUTES.groups}/${groupId}`, { state: { notice: chosen.length ? "imported" : "created" } });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <div className="jk-group-start">
        <div className="jk-group-start__intro">
          <span aria-hidden="true" className="jk-cart-more__plus">
            +
          </span>
          <div>
            <p className="jk-label text-jk-red">{t("group.start.kicker")}</p>
            <p className="mt-2 text-[15px] leading-[1.5] text-jk-ink">{t("group.start.body")}</p>
            {auth.status === "authenticated" ? (
              <button type="button" className="jk-label jk-link mt-3 inline-flex min-h-11 items-center text-jk-ink" onClick={() => setOpen(true)} data-testid="start-group">
                {t("group.start.open")}
              </button>
            ) : (
              <Link to={authUrl(ROUTES.cart)} className="jk-label jk-link mt-3 inline-flex min-h-11 items-center text-jk-ink">
                {t("group.start.signIn")}
              </Link>
            )}
          </div>
        </div>
      </div>
    );

  return (
    <form className="jk-group-start" onSubmit={(e) => void submit(e)} aria-labelledby="jk-start-title">
      <div className="jk-group-start__intro">
        <div>
          <p className="jk-label text-jk-red">{t("group.start.kicker")}</p>
          <h2 id="jk-start-title" className="jk-display mt-2 text-[clamp(28px,3vw,36px)] text-jk-ink">
            {t("group.start.title")}
          </h2>
        </div>
      </div>
      <div className="jk-group-start__form">
        <Field
          label={t("group.start.nameLabel")}
          optional
          value={name}
          maxLength={80}
          // Typed names take their own direction; the empty field follows the page (placeholder included).
          dir={name ? "auto" : undefined}
          placeholder={t("group.start.namePlaceholder")}
          hint={t("group.start.nameHint")}
          onChange={(e) => setName(e.target.value)}
          disabled={busy || createdId !== null}
          name="groupName"
        />
        {cart.items.length > 0 && (
          <fieldset className="flex flex-col gap-3" disabled={busy}>
            <legend className="jk-label mb-2 text-jk-ink" style={{ fontSize: 10 }}>
              {t("group.start.importTitle")}
            </legend>
            {cart.items.map((item) => (
              <label key={item.id} className={`jk-group-pick ${item.id === badItemId ? "jk-group-pick--problem" : ""}`}>
                <input
                  type="checkbox"
                  aria-invalid={item.id === badItemId || undefined}
                  checked={picked.has(item.id)}
                  onChange={(e) =>
                    setPicked((s) => {
                      const next = new Set(s);
                      if (e.target.checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })
                  }
                />
                {item.preview ? <img src={item.preview} alt="" className="jk-group-pick__thumb" /> : <span aria-hidden="true" className="jk-group-pick__thumb" />}
                <span className="text-[14px] text-jk-ink">
                  {names.product(item.productName)}
                  <span className="block text-[13px] text-jk-muted">
                    <Trans k="group.start.importItem" vars={{ size: item.config.size ?? "—", quantity: item.quantity }} tags={{ size: (c) => <Ltr>{c}</Ltr> }} />
                  </span>
                </span>
              </label>
            ))}
            <p className="text-[13px] leading-[1.5] text-jk-muted">{t("group.start.importHint")}</p>
            {tooMany && <Notice attention>{t("group.start.importLimit", { max: MAX_IMPORT })}</Notice>}
          </fieldset>
        )}
        {error && (
          <Notice attention live>
            {error}
          </Notice>
        )}
        <button type="submit" className="jk-btn-primary w-full" disabled={busy || tooMany} data-testid="create-group">
          {busy ? t("group.start.creating") : createdId && chosen.length ? t("group.start.retryImport") : t("group.start.create")}
          <ArrowRight />
        </button>
        {createdId ? (
          <Link to={`${ROUTES.groups}/${createdId}`} className="jk-label jk-link self-start text-jk-ink">
            {t("group.start.openGroup")}
          </Link>
        ) : (
          <button type="button" className="jk-label jk-link self-start text-jk-muted" onClick={() => setOpen(false)} disabled={busy}>
            {t("group.start.cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
