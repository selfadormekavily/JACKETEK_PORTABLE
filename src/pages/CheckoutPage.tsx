import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckoutProgress, ProductStage, Receipt } from "@/features/cart/components/editorial";
import { ArrowRight, Field, PageShell, PageTitle, Price, PriceRows, SectionTitle } from "@/features/cart/components/ui";
import { useCart } from "@/features/cart/context";
import { buildOrder, cartTotals } from "@/features/cart/order";
import { OrderSubmitError, submitOrder } from "@/features/cart/orderService";
import { CARD_PROVIDER } from "@/features/cart/payment";
import type { CartItem, PaymentMethod } from "@/features/cart/types";
import Ltr from "@/i18n/Ltr";
import { localizeServerMessage } from "@/i18n/serverErrors";
import { Trans } from "@/i18n/Trans";
import { useCatalogNames } from "@/i18n/useCatalogNames";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { ROUTES } from "@/lib/routes";
import { CITIES, cityValue } from "@/features/cart/cities";

type Form = {
  fullName: string;
  phone: string;
  city: string;
  area: string;
  address: string;
  notes: string;
  payment: PaymentMethod | null;
};
type FieldName = keyof Form;

/** Validation problems, as message ids (worded at render, in the current language). */
type ErrorId =
  | "cartEmpty"
  | "fullName"
  | "phoneRequired"
  | "phoneInvalid"
  | "city"
  | "area"
  | "address"
  | "payment"
  | "cardUnavailable";
type Errors = Partial<Record<FieldName | "cart", ErrorId>>;

/** Why placing the order failed (worded at render). */
type SubmitError = { kind: "network" } | { kind: "server"; message: string } | { kind: "notPlaced" } | { kind: "generic" };

const EMPTY: Form = { fullName: "", phone: "", city: "", area: "", address: "", notes: "", payment: null };

/** Digits of a phone number; accepts spaces, dashes, brackets and a leading +. */
const phoneDigits = (v: string) => v.replace(/[\s\-().]/g, "");

function validate(form: Form, items: CartItem[]): Errors {
  const e: Errors = {};
  if (items.length === 0) e.cart = "cartEmpty";
  if (form.fullName.trim().length < 2) e.fullName = "fullName";
  const digits = phoneDigits(form.phone);
  if (!digits) e.phone = "phoneRequired";
  else if (!/^\+?\d{9,15}$/.test(digits)) e.phone = "phoneInvalid";
  if (!form.city.trim()) e.city = "city";
  if (!form.area.trim()) e.area = "area";
  if (form.address.trim().length < 5) e.address = "address";
  if (!form.payment) e.payment = "payment";
  else if (form.payment === "card" && !CARD_PROVIDER) e.payment = "cardUnavailable";
  return e;
}

const ORDER: FieldName[] = ["fullName", "phone", "city", "area", "address", "payment"];

/**
 * /checkout — guest checkout: contact, delivery, payment, and the order
 * summary beside it (desktop) or folded above it with a sticky total
 * (phones). Errors appear inline, under their fields, after the first
 * attempt to place the order.
 */
export default function CheckoutPage() {
  const i18n = useI18n();
  const { t } = i18n;
  const { items, clear } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>(EMPTY);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const totals = cartTotals(items);
  const errorIds = attempted ? validate(form, items) : {};
  const errors: Partial<Record<FieldName, string>> = {};
  for (const name of ORDER) {
    const id = errorIds[name];
    if (id) errors[name] = t(`checkout.errors.${id}`);
  }
  useDocumentTitle("meta.title.checkout");

  const set = (name: FieldName) => (value: string) => setForm((f) => ({ ...f, [name]: value }));
  const text = (name: Exclude<FieldName, "payment">) => ({
    name,
    value: form[name],
    error: errors[name],
    onChange: (e: { target: { value: string } }) => set(name)(e.target.value),
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setSubmitError(null);
    const found = validate(form, items);
    const first = ORDER.find((name) => found[name]);
    if (found.cart || first) {
      // Take the customer to the first thing to fix.
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      return;
    }
    // A suggested city picked in Arabic is sent as its usual (English) name.
    const delivery = { ...form, city: cityValue(form.city, (key) => t(`checkout.cities.${key}`)) };
    const order = buildOrder(items, form, delivery, form.payment!);
    setSubmitting(true);
    try {
      // The server assigns the order its ID, date and prices.
      const placed = await submitOrder(order);
      if (placed.payment.method === "card" && CARD_PROVIDER) await CARD_PROVIDER.pay(placed);
      clear();
      navigate(`${ROUTES.order}/${placed.id}`, { state: { order: placed } });
    } catch (err) {
      setSubmitError(
        err instanceof OrderSubmitError
          ? err.reason === "network"
            ? { kind: "network" }
            : err.serverMessage
              ? { kind: "server", message: err.serverMessage }
              : { kind: "notPlaced" }
          : { kind: "generic" }
      );
      setSubmitting(false);
    }
  }

  const submitMessage =
    submitError === null
      ? null
      : submitError.kind === "server"
        ? localizeServerMessage(submitError.message, i18n)
        : t(`checkout.errors.${submitError.kind}`);

  return (
    <PageShell>
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <PageTitle eyebrow={t("checkout.eyebrow")}>{t("checkout.title")}</PageTitle>
        {items.length > 0 && <CheckoutProgress current={1} />}
      </div>

      {items.length === 0 ? (
        <div className="mt-12 max-w-[440px]">
          <p className="jk-body">{t("checkout.empty.body")}</p>
          <Link to={ROUTES.design} className="jk-btn-primary mt-8 w-full sm:w-[320px]">
            {t("checkout.empty.cta")}
            <ArrowRight />
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
          {/* Phones: the summary folds away above the form. */}
          <details className="group border-y border-[rgb(var(--t-head)/.22)] lg:hidden">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
              <span className="jk-label text-jk-ink">
                {t("checkout.summaryToggle")}
                <span className="ms-3 inline-block transition-transform duration-200 group-open:rotate-180" aria-hidden="true">
                  ▾
                </span>
              </span>
              <span className="text-[15px] font-medium text-jk-ink">
                <Price amount={totals.total} />
              </span>
            </summary>
            <div className="pb-5">
              <OrderSummary items={items} totals={totals} />
            </div>
          </details>

          <form ref={formRef} id="checkout-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-12">
            <fieldset className="jk-form-panel flex flex-col gap-5">
              <legend className="mb-5">
                <SectionTitle index="01">{t("checkout.steps.contact")}</SectionTitle>
              </legend>
              <Field label={t("checkout.fields.fullName")} autoComplete="name" {...text("fullName")} />
              <Field
                label={t("checkout.fields.phone")}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder={t("checkout.fields.phonePlaceholder")}
                hint={errors.phone ? undefined : t("checkout.fields.phoneHint")}
                {...text("phone")}
              />
            </fieldset>

            <fieldset className="jk-form-panel flex flex-col gap-5">
              <legend className="mb-5">
                <SectionTitle index="02">{t("checkout.steps.delivery")}</SectionTitle>
              </legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t("checkout.fields.city")} list="jk-cities" autoComplete="address-level2" {...text("city")} />
                <Field
                  label={t("checkout.fields.area")}
                  placeholder={t("checkout.fields.areaPlaceholder")}
                  autoComplete="address-level3"
                  {...text("area")}
                />
              </div>
              <datalist id="jk-cities">
                {CITIES.map((c) => (
                  <option key={c.key} value={t(`checkout.cities.${c.key}`)} />
                ))}
              </datalist>
              <Field
                label={t("checkout.fields.address")}
                multiline
                placeholder={t("checkout.fields.addressPlaceholder")}
                autoComplete="street-address"
                {...text("address")}
              />
              <Field
                label={t("checkout.fields.notes")}
                optional
                multiline
                placeholder={t("checkout.fields.notesPlaceholder")}
                {...text("notes")}
              />
            </fieldset>

            <fieldset className="jk-form-panel" aria-describedby={errors.payment ? "payment-message" : undefined}>
              <legend className="mb-5">
                <SectionTitle index="03">{t("checkout.steps.payment")}</SectionTitle>
              </legend>
              <div role="radiogroup" aria-label={t("checkout.payment.aria")} className="grid gap-3 sm:grid-cols-2">
                <PaymentOption
                  value="cod"
                  label={t("checkout.payment.cod.label")}
                  detail={t("checkout.payment.cod.detail")}
                  selected={form.payment === "cod"}
                  invalid={Boolean(errors.payment)}
                  onSelect={() => setForm((f) => ({ ...f, payment: "cod" }))}
                />
                <PaymentOption
                  value="card"
                  label={t("checkout.payment.card.label")}
                  detail={t("checkout.payment.card.detail")}
                  selected={form.payment === "card"}
                  invalid={Boolean(errors.payment)}
                  onSelect={() => setForm((f) => ({ ...f, payment: "card" }))}
                />
              </div>
              {form.payment && <PaymentDetails method={form.payment} />}
              {errors.payment && (
                <p id="payment-message" className="mt-3 text-[13px] leading-[1.5] text-jk-accent">
                  {errors.payment}
                </p>
              )}
            </fieldset>

            <div className="hidden lg:block">
              <PlaceOrder submitting={submitting} />
            </div>
            {submitMessage && (
              <p role="alert" className="-mt-6 text-[13px] text-jk-accent">
                {submitMessage}
              </p>
            )}
          </form>

          <aside aria-label={t("cart.summary.title")} className="hidden lg:sticky lg:top-[108px] lg:block lg:self-start">
            <Receipt title={t("cart.summary.title")}>
              <OrderSummary items={items} totals={totals} />
            </Receipt>
          </aside>
        </div>
      )}

      {/* Phones and tablets: room under the last section, so it clears the sticky bar below. */}
      <div aria-hidden="true" className="h-12 lg:hidden" />

      {/* Phones: the total and the button stay in reach. */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[rgb(var(--t-head)/.14)] bg-jk-paper px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="jk-label text-jk-muted">{t("cart.price.total")}</span>
            <span className="text-[16px] font-medium text-jk-ink">
              <Price amount={totals.total} />
            </span>
          </div>
          <PlaceOrder submitting={submitting} />
        </div>
      )}
    </PageShell>
  );
}

function PlaceOrder({ submitting }: { submitting: boolean }) {
  const { t } = useI18n();
  return (
    <button type="submit" form="checkout-form" disabled={submitting} className="jk-btn-primary w-full lg:w-[320px]">
      {submitting ? t("checkout.placingOrder") : t("checkout.placeOrder")}
      <ArrowRight />
    </button>
  );
}

/** A radio card: hairline box; selected = raised cream with an inset Crimson border. */
function PaymentOption({
  value,
  label,
  detail,
  selected,
  invalid,
  onSelect,
}: {
  value: PaymentMethod;
  label: string;
  detail: string;
  selected: boolean;
  invalid: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`jk-pay-option flex min-h-[72px] cursor-pointer items-center gap-4 border px-4 py-4 ${
        selected
          ? "is-selected border-transparent bg-jk-raised"
          : `${invalid ? "border-jk-accent" : "border-[rgb(var(--t-head)/.22)]"} bg-jk-raised/40 hover:bg-jk-raised`
      }`}
    >
      <input type="radio" name="payment" value={value} checked={selected} onChange={onSelect} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border ${selected ? "border-jk-accent" : "border-[rgb(var(--t-head)/.35)]"} peer-focus-visible:outline peer-focus-visible:outline-[1.5px] peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-jk-accent`}
      >
        {selected && <span className="block h-2 w-2 rounded-full bg-jk-accent" />}
      </span>
      <span>
        <span className="jk-label block text-jk-ink">{label}</span>
        <span className="mt-1 block text-[13px] leading-[1.4] text-jk-muted">{detail}</span>
      </span>
    </label>
  );
}

/**
 * Beneath the choice: cash needs nothing more; card shows the payment
 * provider's own fields (mounted by it — card numbers never pass through
 * this code) or, while none is configured, says so.
 */
function PaymentDetails({ method }: { method: PaymentMethod }) {
  const { t } = useI18n();
  const slot = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (method !== "card" || !CARD_PROVIDER || !slot.current) return;
    return CARD_PROVIDER.mount(slot.current);
  }, [method]);

  if (method === "cod") {
    return (
      <div className="mt-5 jk-dashed-top pt-4">
        <p className="jk-label-xs text-jk-muted">{t("checkout.payment.method")}</p>
        <p className="mt-1 text-[15px] text-jk-ink">{t("checkout.payment.cod.name")}</p>
      </div>
    );
  }
  return (
    <div className="mt-5 jk-dashed-top pt-4">
      <p className="jk-label-xs text-jk-muted">{t("checkout.payment.method")}</p>
      <p className="mt-1 text-[15px] text-jk-ink">{t("checkout.payment.card.name")}</p>
      {CARD_PROVIDER ? (
        <div ref={slot} className="mt-4" />
      ) : (
        <p className="mt-3 text-[13px] leading-[1.5] text-jk-muted">{t("checkout.payment.card.comingSoon")}</p>
      )}
    </div>
  );
}

/** Product · size · quantity per jacket, then the totals. */
function OrderSummary({
  items,
  totals,
}: {
  items: CartItem[];
  totals: { subtotal: number | null; delivery: number | null; total: number | null };
}) {
  const names = useCatalogNames();
  return (
    <>
      <ul className="jk-receipt__items">
        {items.map((item) => (
          <li key={item.id} className="jk-receipt__item">
            <ProductStage src={item.preview} size="sm" className="h-[76px] w-[64px] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="jk-cart-product text-[13px] font-medium uppercase tracking-[0.13em] text-jk-ink">
                {names.product(item.productName)}
              </p>
              <p className="mt-1 text-[13px] text-jk-muted">
                <Trans
                  k="cart.summary.line"
                  vars={{ size: item.config.size ?? "—", quantity: item.quantity }}
                  tags={{ size: (c) => <Ltr>{c}</Ltr> }}
                />
              </p>
            </div>
            <p className="text-[13px] text-jk-ink">
              <Price amount={item.unitPrice === null ? null : item.unitPrice * item.quantity} />
            </p>
          </li>
        ))}
      </ul>
      <PriceRows {...totals} />
    </>
  );
}
