import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AsYouType, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import mobileExamples from "libphonenumber-js/mobile/examples";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
import Atmosphere from "@/components/Atmosphere";
import Nav from "@/components/Nav";
import { AuthRequestError, type Identifier } from "@/features/auth/api";
import { useAuth } from "@/features/auth/context";
import CountrySelect from "@/features/auth/CountrySelect";
import { defaultCountry } from "@/features/auth/countries";
import { safeReturnTo } from "@/features/auth/returnTo";
import { isValidEmail, PASSWORD_MIN, passwordLongEnough, toE164 } from "@/features/auth/validation";
import { useCart } from "@/features/cart/context";
import { localizeServerMessage } from "@/i18n/serverErrors";
import { Trans } from "@/i18n/Trans";
import { useDocumentTitle, useI18n } from "@/i18n/useI18n";
import { peekPendingAdd, takePendingAdd } from "@/features/cart/pendingAdd";
import { ROUTES } from "@/lib/routes";

type Mode = "login" | "signup";
type Method = "email" | "phone";
type Field = "firstName" | "lastName" | "email" | "phone" | "password";
/** Client checks (keys in auth.errors) or a raw API message, localized when shown. */
type ClientError =
  | "firstNameRequired"
  | "lastNameRequired"
  | "emailInvalid"
  | "emailRequired"
  | "phoneInvalid"
  | "phoneRequired"
  | "passwordShort"
  | "passwordRequired";
type Msg = { client: ClientError } | { server: string };
type Errors = Partial<Record<Field, Msg>>;
/** The form-level alert: unreachable server, or an API message. */
type Alert = { network: true } | { server: string | null };
const FIELDS: Field[] = ["firstName", "lastName", "email", "phone", "password"];

const JACKET = "/assets/auth/jacket.webp";
const FLAG_FONT = "/assets/fonts/TwemojiCountryFlags.woff2";

/**
 * /auth — log in or create an account, as one experience. Opened from the
 * nav ("Log in") or from Add to Cart (?returnTo=/cart&intent=add-to-cart),
 * in which case the jacket the customer was adding waits in
 * cart/pendingAdd.ts and is put in the cart as soon as they're signed in.
 * ?returnTo only ever resolves to an internal page (auth/returnTo.ts).
 */
export default function AuthPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const cart = useCart();
  const mode: Mode = params.get("mode") === "signup" ? "signup" : "login";
  const returnTo = safeReturnTo(params.get("returnTo"));
  const addingToCart = params.get("intent") === "add-to-cart";
  const [savedPreview, setSavedPreview] = useState<string | null>(null);
  const [hasSavedDesign, setHasSavedDesign] = useState(false);

  useDocumentTitle("meta.title.auth");
  useEffect(() => {
    polyfillCountryFlagEmojis("Twemoji Country Flags", FLAG_FONT);
  }, []);

  // Show the customer their own waiting jacket.
  useEffect(() => {
    if (!addingToCart) return;
    void peekPendingAdd().then((item) => {
      setHasSavedDesign(!!item);
      setSavedPreview(item?.preview ?? null);
    });
  }, [addingToCart]);

  /** Signed in: hand the waiting jacket to the cart, then continue. */
  const finishing = useRef(false);
  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    if (addingToCart) {
      const item = await takePendingAdd();
      if (item) cart.add(item);
    }
    navigate(addingToCart ? ROUTES.cart : returnTo, { replace: true });
  }, [addingToCart, cart, navigate, returnTo]);

  // Already signed in (e.g. opened in a second tab): continue straight away.
  useEffect(() => {
    if (auth.status === "authenticated") void finish();
  }, [auth.status, finish]);

  const setMode = (next: Mode) => {
    const p = new URLSearchParams(params);
    if (next === "signup") p.set("mode", "signup");
    else p.delete("mode");
    setParams(p, { replace: true });
  };

  return (
    <>
      <Nav variant="page" />
      <main className="jk-auth">
        <AuthStage addingToCart={addingToCart && hasSavedDesign} preview={savedPreview} mode={mode} />
        <section className="jk-auth__panel" aria-labelledby="auth-title">
          <div className="jk-auth__sheet">
            <ModeTabs mode={mode} onChange={setMode} />
            <AuthForm key={mode} mode={mode} onDone={finish} onSwitchMode={setMode} addingToCart={addingToCart} />
          </div>
        </section>
      </main>
    </>
  );
}

// ---------------------------------------------------------------------------
// The stage: the jacket suspended in the cream room, and one line of copy.

const accent = { accent: (c: ReactNode) => <span className="text-jk-crimson">{c}</span> };

function AuthStage({ addingToCart, preview, mode }: { addingToCart: boolean; preview: string | null; mode: Mode }) {
  const { t } = useI18n();
  return (
    <section className="jk-auth__stage" aria-label={addingToCart ? t("auth.stage.ariaSaved") : "JACKETEK"}>
      <Atmosphere className="jk-atmos--center absolute inset-0" />
      <svg aria-hidden="true" className="jk-thread jk-auth__thread" viewBox="0 0 800 900" preserveAspectRatio="none" fill="none">
        <path d="M -20 760 C 180 700, 260 520, 420 470 S 700 300, 840 120" stroke="rgb(var(--brand-red))" strokeWidth={1.6} strokeLinecap="round" strokeDasharray="7 9" vectorEffect="non-scaling-stroke" />
      </svg>
      <figure className="jk-auth__jacket">
        <img src={preview ?? JACKET} alt={addingToCart ? t("auth.stage.altSaved") : t("auth.stage.altDefault")} width={1071} height={1241} decoding="async" />
      </figure>
      <div className="jk-auth__statement">
        {addingToCart ? (
          <>
            <p className="jk-label text-jk-red">{t("auth.stage.savedEyebrow")}</p>
            <p className="jk-headline jk-auth__headline">
              <Trans k="auth.stage.savedHeadline" tags={accent} />
            </p>
            <p className="jk-auth__note">
              <span aria-hidden="true" className="jk-auth__note-mark" />
              {t("auth.stage.savedNote")}
            </p>
          </>
        ) : (
          <>
            <p className="jk-label text-jk-red">{t("auth.stage.atelierEyebrow")}</p>
            <p className="jk-headline jk-auth__headline">
              <Trans k={mode === "signup" ? "auth.stage.signupHeadline" : "auth.stage.loginHeadline"} tags={accent} />
            </p>
          </>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Log in | Create account, with a sliding crimson indicator.

function ModeTabs({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const { t } = useI18n();
  const tabs: [Mode, string][] = [
    ["login", t("auth.tabs.logIn")],
    ["signup", t("auth.tabs.createAccount")],
  ];
  return (
    <div role="tablist" aria-label={t("auth.tabs.aria")} className="jk-auth-tabs" data-mode={mode}>
      {tabs.map(([m, label]) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          tabIndex={mode === m ? 0 : -1}
          onClick={() => onChange(m)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              onChange(mode === "login" ? "signup" : "login");
              (e.currentTarget.parentElement?.querySelector(`[aria-selected="false"]`) as HTMLElement | null)?.focus();
            }
          }}
          className="jk-auth-tab jk-hit"
        >
          {label}
        </button>
      ))}
      <span aria-hidden="true" className="jk-auth-tabs__bar" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form

function AuthForm({ mode, onDone, onSwitchMode, addingToCart }: { mode: Mode; onDone: () => void; onSwitchMode: (m: Mode) => void; addingToCart: boolean }) {
  const auth = useAuth();
  const i18n = useI18n();
  const { t, tp } = i18n;
  const [method, setMethod] = useState<Method>("email");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [serverError, setServerError] = useState<Alert | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const validate = (): Errors => {
    const e: Errors = {};
    if (signup && !firstName.trim()) e.firstName = { client: "firstNameRequired" };
    if (signup && !lastName.trim()) e.lastName = { client: "lastNameRequired" };
    if (method === "email" && !isValidEmail(email)) e.email = { client: email.trim() ? "emailInvalid" : "emailRequired" };
    if (method === "phone" && !toE164(phone, country)) e.phone = { client: phone.trim() ? "phoneInvalid" : "phoneRequired" };
    if (signup ? !passwordLongEnough(password) : !password) e.password = { client: signup ? "passwordShort" : "passwordRequired" };
    return e;
  };

  /** A message in the current language (a language switch re-words it live). */
  const say = (m: Msg | undefined): string | undefined => {
    if (!m) return undefined;
    if ("server" in m) return localizeServerMessage(m.server, i18n);
    if (m.client === "passwordShort") return tp("auth.errors.passwordShort", PASSWORD_MIN);
    return t(`auth.errors.${m.client}`);
  };

  // Inline validation once a field has been left (or after a submit attempt).
  const shown = (f: Field) => say(touched[f] ? errors[f] : undefined);
  const blur = (f: Field) => {
    setTouched((t) => ({ ...t, [f]: true }));
    setErrors(validate());
  };
  useEffect(() => {
    if (Object.keys(touched).length) setErrors(validate());
    // Re-check as the customer types, only for fields already visited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, email, phone, country, password, method]);

  const onPhoneChange = (raw: string) => {
    // A full international number (typed, pasted or autofilled) picks its own country.
    if (raw.trim().startsWith("+")) {
      const parsed = parsePhoneNumberFromString(raw);
      if (parsed?.country) {
        setCountry(parsed.country);
        setPhone(new AsYouType(parsed.country).input(parsed.nationalNumber));
        return;
      }
    }
    const digits = raw.replace(/[^\d]/g, "");
    setPhone(digits.length > 3 ? new AsYouType(country).input(digits) : digits);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setServerError(null);
    const found = validate();
    setErrors(found);
    setTouched({ firstName: true, lastName: true, email: true, phone: true, password: true });
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>(`[aria-invalid="true"]`)?.focus();
      return;
    }
    const identifier: Identifier = method === "email" ? { method, email: email.trim() } : { method, phone: { country, number: phone } };
    setBusy(true);
    try {
      if (signup) await auth.signUp({ ...identifier, firstName: firstName.trim(), lastName: lastName.trim(), password });
      else await auth.logIn({ ...identifier, password });
      onDone();
    } catch (err) {
      if (err instanceof AuthRequestError) {
        // API messages stay raw here and are localized when shown.
        const fields: Errors = {};
        for (const f of FIELDS) if (err.fields[f]) fields[f] = { server: err.fields[f] };
        setErrors(fields);
        if (err.status === 0) setServerError({ network: true });
        else setServerError(Object.keys(err.fields).length ? null : { server: err.message });
      } else setServerError({ server: null });
      setBusy(false);
    }
  };

  return (
    <form className="jk-auth-form" noValidate onSubmit={onSubmit} aria-busy={busy}>
      <h1 id="auth-title" className="jk-headline jk-auth-form__title">
        {signup ? t("auth.title.signup") : t("auth.title.login")}
      </h1>
      <p className="jk-auth-form__lede">
        {addingToCart ? t("auth.lede.addingToCart") : signup ? t("auth.lede.signup") : t("auth.lede.login")}
      </p>

      {signup && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label={t("auth.fields.firstName")} value={firstName} onChange={setFirstName} onBlur={() => blur("firstName")} error={shown("firstName")} autoComplete="given-name" />
          <TextField label={t("auth.fields.lastName")} value={lastName} onChange={setLastName} onBlur={() => blur("lastName")} error={shown("lastName")} autoComplete="family-name" />
        </div>
      )}

      <MethodSwitch
        method={method}
        onChange={(m) => {
          setMethod(m);
          setServerError(null);
        }}
      />

      {method === "email" ? (
        <TextField
          key="email"
          label={t("auth.fields.email")}
          type="email"
          dir="ltr"
          inputMode="email"
          value={email}
          onChange={setEmail}
          onBlur={() => blur("email")}
          error={shown("email")}
          autoComplete="email"
          placeholder={t("auth.fields.emailPlaceholder")}
        />
      ) : (
        <FieldShell key="phone" label={t("auth.fields.phone")} error={shown("phone")}>
          {(id, describedBy) => (
            <div className={`jk-auth-input jk-auth-input--phone ${shown("phone") ? "is-invalid" : ""}`}>
              <CountrySelect value={country} onChange={setCountry} />
              <input
                id={id}
                type="tel"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder={getExampleNumber(country, mobileExamples)?.formatNational() ?? ""}
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                onBlur={() => blur("phone")}
                aria-invalid={shown("phone") ? true : undefined}
                aria-describedby={describedBy}
              />
            </div>
          )}
        </FieldShell>
      )}

      <PasswordField
        signup={signup}
        value={password}
        onChange={setPassword}
        onBlur={() => blur("password")}
        error={shown("password")}
      />

      <div aria-live="assertive" className="min-h-0">
        {serverError && (
          <p role="alert" className="jk-auth-alert">
            {"network" in serverError ? t("auth.errors.network") : localizeServerMessage(serverError.server, i18n)}
          </p>
        )}
      </div>

      <button type="submit" className="jk-btn-primary jk-auth-submit w-full" disabled={busy}>
        <span>{busy ? (signup ? t("auth.submit.creating") : t("auth.submit.loggingIn")) : signup ? t("auth.submit.createAccount") : t("auth.submit.logIn")}</span>
        {busy ? (
          <span aria-hidden="true" className="jk-auth-spinner" />
        ) : (
          <svg aria-hidden="true" className="jk-arrow" width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9 H15 M10 4 L15 9 L10 14" />
          </svg>
        )}
      </button>

      <p className="jk-auth-form__switch">
        {signup ? t("auth.switch.haveAccount") : t("auth.switch.newTo")}{" "}
        <button type="button" className="jk-link text-jk-ink" onClick={() => onSwitchMode(signup ? "login" : "signup")}>
          {signup ? t("auth.switch.logIn") : t("auth.switch.createAccount")}
        </button>
      </p>
    </form>
  );
}

/** Email | Mobile, with a sliding navy pill. */
function MethodSwitch({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  const { t } = useI18n();
  const options: [Method, string][] = [
    ["email", t("auth.method.email")],
    ["phone", t("auth.method.phone")],
  ];
  return (
    <div role="radiogroup" aria-label={t("auth.method.aria")} className="jk-auth-method" data-method={method}>
      <span aria-hidden="true" className="jk-auth-method__pill" />
      {options.map(([m, label]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={method === m}
          tabIndex={method === m ? 0 : -1}
          onClick={() => onChange(m)}
          onKeyDown={(e) => {
            if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault();
              onChange(method === "email" ? "phone" : "email");
              (e.currentTarget.parentElement?.querySelector(`[aria-checked="false"]`) as HTMLElement | null)?.focus();
            }
          }}
          className="jk-auth-method__option jk-hit"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FieldShell({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className="jk-auth-field">
      <label htmlFor={id} className="jk-auth-label">
        {label}
      </label>
      {children(id, error || hint ? messageId : undefined)}
      {(error || hint) && (
        <p id={messageId} className={`jk-auth-message ${error ? "is-error" : ""}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  error,
  type = "text",
  dir,
  inputMode,
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  error?: string;
  type?: string;
  dir?: "ltr";
  inputMode?: "email" | "text";
  autoComplete: string;
  placeholder?: string;
}) {
  return (
    <FieldShell label={label} error={error}>
      {(id, describedBy) => (
        <div className={`jk-auth-input ${error ? "is-invalid" : ""}`}>
          <input
            id={id}
            type={type}
            dir={dir}
            inputMode={inputMode}
            autoComplete={autoComplete}
            placeholder={placeholder}
            spellCheck={false}
            autoCapitalize={type === "email" ? "none" : "words"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
          />
        </div>
      )}
    </FieldShell>
  );
}

function PasswordField({ signup, value, onChange, onBlur, error }: { signup: boolean; value: string; onChange: (v: string) => void; onBlur: () => void; error?: string }) {
  const { t, tp } = useI18n();
  const [visible, setVisible] = useState(false);
  const long = passwordLongEnough(value);
  return (
    <FieldShell label={t("auth.fields.password")} error={error} hint={signup ? tp("auth.fields.passwordHint", PASSWORD_MIN) : undefined}>
      {(id, describedBy) => (
        <div className={`jk-auth-input ${error ? "is-invalid" : ""}`}>
          <input
            id={id}
            type={visible ? "text" : "password"}
            dir="ltr"
            autoComplete={signup ? "new-password" : "current-password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            minLength={signup ? PASSWORD_MIN : undefined}
          />
          {signup && value && (
            <span aria-hidden="true" dir="ltr" className={`jk-auth-strength ${long ? "is-ok" : ""}`}>
              {long ? "✓" : t("auth.fields.passwordCounter", { n: [...value].length, min: PASSWORD_MIN })}
            </span>
          )}
          <button
            type="button"
            className="jk-auth-reveal"
            aria-label={visible ? t("auth.fields.hidePassword") : t("auth.fields.showPassword")}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            <svg aria-hidden="true" width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <path d="M2 10 C 4.5 5.5, 15.5 5.5, 18 10 C 15.5 14.5, 4.5 14.5, 2 10 Z" />
              <circle cx="10" cy="10" r="2.6" />
              <path className="jk-auth-reveal__slash" d="M4 16 L16 4" />
            </svg>
          </button>
        </div>
      )}
    </FieldShell>
  );
}
