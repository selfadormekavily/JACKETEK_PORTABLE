import { useState } from "react";
import { Link } from "react-router-dom";
import { getColour, getMaterial } from "@/features/configurator/model/catalog";
import { getActiveEmbroidery } from "@/features/configurator/model/config";
import { ArrowRight, PageShell, PageTitle, Price, PriceRows, QuantityStepper } from "@/features/cart/components/ui";
import { CheckoutProgress, PatchChip, ProductStage, Receipt, StitchRule, SwatchTrio } from "@/features/cart/components/editorial";
import { useCart } from "@/features/cart/context";
import { cartTotals } from "@/features/cart/order";
import type { CartItem } from "@/features/cart/types";
import { StartGroupPanel } from "@/features/groups/components/StartGroupPanel";
import Ltr from "@/i18n/Ltr";
import { Trans } from "@/i18n/Trans";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

/**
 * /cart — the designed jackets waiting to be ordered. Each is a raised
 * cream card: the jacket in its own small fitting room, then its design as
 * patches, colours and the quantity; beside them, the order summary as a
 * light receipt and the way to checkout.
 */
export default function CartPage() {
  const { t, tp } = useI18n();
  const { items, count, setQuantity, remove } = useCart();
  const totals = cartTotals(items);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  useDocumentTitle("meta.title.cart");

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <PageTitle eyebrow={items.length ? tp("cart.eyebrow.count", count) : t("cart.eyebrow.empty")}>{t("cart.title")}</PageTitle>
        {items.length > 0 && <CheckoutProgress current={0} />}
      </div>

      {items.length === 0 ? (
        <div className="jk-cart-empty mt-12">
          <ProductStage src={null} size="lg" className="jk-cart-empty__stage" />
          <div className="max-w-[440px]">
            <p className="jk-body">{t("cart.empty.body")}</p>
            <Link to={ROUTES.design} className="jk-btn-primary mt-8 w-full sm:w-[320px]">
              {t("cart.empty.cta")}
              <ArrowRight />
            </Link>
            <div className="mt-10">
              <StartGroupPanel />
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:mt-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
          <ul aria-label={t("cart.itemsAria")} className="flex flex-col gap-8">
            {items.map((item, i) => (
              <li key={item.id}>
                <CartItemCard item={item} number={i + 1} onQuantity={(q) => setQuantity(item.id, q)} onRemove={() => remove(item.id)} />
              </li>
            ))}
            <li className="jk-cart-more">
              <span aria-hidden="true" className="jk-cart-more__plus">+</span>
              <span>
                <span className="block text-[15px] text-jk-ink">{t("cart.more.question")}</span>
                <Link to={ROUTES.design} className="jk-label jk-link mt-2 inline-block text-jk-ink">
                  {t("cart.more.continue")}
                </Link>
              </span>
            </li>
          </ul>

          {/* The summary follows the scroll; not while the (tall) group form is open, so all of it stays reachable. */}
          <div className={`flex flex-col gap-8 lg:self-start ${groupFormOpen ? "" : "lg:sticky lg:top-[108px]"}`}>
            <Receipt title={t("cart.summary.title")}>
              <PriceRows {...totals} />
              <p className="jk-receipt__note">{t("cart.summary.codNote")}</p>
              <Link to={ROUTES.checkout} className="jk-btn-primary mt-6 w-full">
                {t("cart.summary.checkout")}
                <ArrowRight />
              </Link>
            </Receipt>
            <StartGroupPanel onOpenChange={setGroupFormOpen} />
          </div>
        </div>
      )}
    </PageShell>
  );
}

function CartItemCard({
  item,
  number,
  onQuantity,
  onRemove,
}: {
  item: CartItem;
  number: number;
  onQuantity: (q: number) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const names = useCatalogNames();
  const { config } = item;
  // The design read by id (never by its English labels).
  const zone = (z: "body" | "sleeves") => {
    const colour = getColour(config.colours[z]);
    const material = getMaterial(config.materials[z]);
    return t("cart.item.zoneValue", {
      colour: names.colour(colour.id, colour.name),
      material: names.material(material.id, material.name),
    });
  };
  const embroidered = getActiveEmbroidery(config).length > 0;
  const productName = names.product(item.productName);
  return (
    <article
      className="jk-item"
      aria-label={config.size ? t("cart.item.aria", { productName, size: config.size }) : t("cart.item.ariaNoSize", { productName })}
    >
      <ProductStage src={item.preview} number={number} className="jk-item__stage" />
      <div className="jk-item__body">
        <p className="jk-label text-jk-red">{t("cart.item.madeToOrder")}</p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 className="jk-display text-[clamp(30px,2.5vw,38px)] text-jk-ink">{productName}</h2>
          <p className="text-[14px] text-jk-muted">
            <Price amount={item.unitPrice === null ? null : item.unitPrice * item.quantity} />
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <PatchChip strong>
            {config.size ? (
              <Trans k="cart.item.size" vars={{ size: config.size }} tags={{ size: (c) => <Ltr>{c}</Ltr> }} />
            ) : (
              t("cart.item.sizeNotSelected")
            )}
          </PatchChip>
          <PatchChip>{zone("body")}</PatchChip>
          <PatchChip>{zone("sleeves")}</PatchChip>
          <PatchChip>
            {t("cart.item.embroidery", {
              value: t(embroidered ? "cart.item.embroideryCustomised" : "cart.item.embroideryNone"),
            })}
          </PatchChip>
        </div>

        <StitchRule className="my-6" />
        <SwatchTrio config={config} />

        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-7">
          <QuantityStepper label={t("cart.item.quantityAria", { productName })} value={item.quantity} onChange={onQuantity} />
          <button type="button" onClick={onRemove} className="jk-label jk-link min-h-11 text-jk-muted hover:text-jk-accent">
            {t("cart.item.remove")}
          </button>
        </div>
      </div>
    </article>
  );
}
