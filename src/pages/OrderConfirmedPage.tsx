import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { cityKey } from "@/features/cart/cities";
import { Receipt } from "@/features/cart/components/editorial";
import { ArrowRight, PageShell, PageTitle, Price, PriceRows } from "@/features/cart/components/ui";
import { getOrder } from "@/features/cart/orderService";
import type { Order } from "@/features/cart/types";
import Ltr from "@/i18n/Ltr";
import { Trans } from "@/i18n/Trans";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";

/**
 * /order/:orderId — shown after an order is placed: the order number, a
 * thank-you and a compact summary. (Production data — the full design,
 * supplier details, drawings — is never shown to the customer.)
 */
export default function OrderConfirmedPage() {
  const { t } = useI18n();
  const names = useCatalogNames();
  const { orderId = "" } = useParams();
  const passed = (useLocation().state as { order?: Order } | null)?.order;
  const [order, setOrder] = useState<Order | null | undefined>(passed?.id === orderId ? passed : undefined);
  useDocumentTitle("meta.title.orderConfirmed");

  useEffect(() => {
    if (order !== undefined) return;
    let live = true;
    getOrder(orderId).then((found) => live && setOrder(found));
    return () => {
      live = false;
    };
  }, [order, orderId]);

  // The recorded city (an English name) shown in the current language.
  const city = (value: string) => {
    const key = cityKey(value);
    return key ? t(`checkout.cities.${key}`) : value;
  };

  return (
    <PageShell>
      <PageTitle eyebrow={t("order.eyebrow")}>{t("order.title")}</PageTitle>

      {order === undefined ? null : order === null ? (
        <div className="mt-10 max-w-[440px]">
          <p className="jk-body">{t("order.notFound")}</p>
          <Link to={ROUTES.home} className="jk-btn-primary mt-8 w-full sm:w-[320px]">
            {t("order.backHome")}
            <ArrowRight />
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          <div className="max-w-[520px]">
            <p className="jk-label-xs text-jk-muted">{t("order.number")}</p>
            <p className="mt-2 text-[24px] font-medium tracking-[0.04em] text-jk-ink">
              <Ltr>#{order.id}</Ltr>
            </p>
            <p className="jk-headline mt-8 text-[clamp(32px,5vw,48px)] text-jk-ink">
              {t("order.thanks")}
              <span className="jk-order-prepare mt-2 block text-[0.6em] leading-[1.15] tracking-[-0.03em] text-jk-taupe">
                {t("order.prepare")}
              </span>
            </p>
            <p className="jk-body mt-8">
              <Trans
                k="order.callYou"
                vars={{ phone: order.customer.phone, area: order.delivery.area, city: city(order.delivery.city) }}
                tags={{ phone: (c) => <Ltr>{c}</Ltr> }}
              />
            </p>
            <Link to={ROUTES.home} className="jk-btn-primary mt-10 w-full sm:w-[320px]">
              {t("order.backHome")}
              <ArrowRight />
            </Link>
          </div>

          <Receipt title={t("order.summaryTitle")} className="self-start">
            <ul className="mb-2">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-baseline justify-between gap-4 py-3">
                  <div>
                    <p className="jk-cart-product text-[13px] font-medium uppercase tracking-[0.13em] text-jk-ink">
                      {names.product(item.productName)}
                    </p>
                    <p className="mt-1 text-[13px] text-jk-muted">
                      <Trans
                        k="cart.summary.line"
                        vars={{ size: item.size ?? "—", quantity: item.quantity }}
                        tags={{ size: (c) => <Ltr>{c}</Ltr> }}
                      />
                    </p>
                  </div>
                  <p className="text-[13px] text-jk-ink">
                    <Price amount={item.lineTotal} />
                  </p>
                </li>
              ))}
            </ul>
            <PriceRows {...order.pricing} />
            <div className="jk-dashed-top mt-2 flex items-baseline justify-between py-3">
              <span className="jk-label text-jk-muted">{t("order.payment")}</span>
              <span className="text-[14px] text-jk-ink">{t(`order.paymentMethod.${order.payment.method}`)}</span>
            </div>
          </Receipt>
        </div>
      )}
    </PageShell>
  );
}
