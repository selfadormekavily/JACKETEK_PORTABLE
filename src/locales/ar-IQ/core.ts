import type { Messages } from "@/i18n/types";
import type * as en from "@/locales/en/core";

/** Iraqi Arabic: site-wide strings. Clear on actions, warm on headlines. */
export const meta: Messages<typeof en.meta> = {
  title: {
    default: "JACKETEK — جاكيتات تخرّج على ذوقك",
    auth: "تسجيل الدخول — JACKETEK",
    design: "صمّم جاكيتك — JACKETEK",
    cart: "سلّتك — JACKETEK",
    checkout: "إتمام الطلب — JACKETEK",
    orderConfirmed: "تم تثبيت طلبك — JACKETEK",
    notFound: "الصفحة مو موجودة — JACKETEK",
    groups: "الطلبات الجماعية — JACKETEK",
    group: "طلب جماعي — JACKETEK",
    join: "ادخل لطلب جماعي — JACKETEK",
  },
};

export const common: Messages<typeof en.common> = {
  loading: "دنحمّل",
  loadingProgress: "دنحمّل {percent}%",
  optional: "اختياري",
  none: "ماكو",
  edit: "تعديل",
  remove: "حذف",
  close: "سكّر",
  back: "رجوع",
  genericError: "صار خطأ. حاول مرة ثانية.",
};

export const language: Messages<typeof en.language> = {
  label: "اللغة",
  switchAria: "اختار اللغة",
  switchTo: "حوّل لـ{language}",
};

export const nav: Messages<typeof en.nav> = {
  home: "الرئيسية",
  design: "صمّم",
  cart: "السلة",
  cartCountAria: {
    zero: "ماكو قطع",
    one: "قطعة وحدة",
    two: "قطعتين",
    few: "{count} قطع",
    many: "{count} قطعة",
    other: "{count} قطعة",
  },
  homeAria: "الرئيسية — JACKETEK",
  collection: "مجموعة 27 — التخرّج",
  primaryAria: "القائمة الرئيسية",
  menu: "القائمة",
  menuDialogAria: "القائمة",
  closeMenuAria: "سكّر القائمة",
};

export const account: Messages<typeof en.account> = {
  logIn: "سجّل دخول",
  logInOrCreate: "سجّل دخول أو سوّي حساب",
  signedInAs: "مسجّل باسم",
  signedIn: "مسجّل دخول",
  logOut: "تسجيل الخروج",
  myGroups: "الطلبات الجماعية",
  menuAria: "الحساب",
};

export const footer: Messages<typeof en.footer> = {
  brand: "JACKETEK",
  tagline: "مصمّم <accent>لدفعتك.</accent>",
  columns: { explore: "استكشف", studio: "الاستوديو" },
  links: {
    home: "الرئيسية",
    design: "صمّم جاكيتك",
    contact: "تواصل ويانا",
    instagram: "إنستغرام",
    cart: "السلة",
  },
  copyright: "© {year} JACKETEK",
  small: "جاكيتات تخرّج على ذوقك",
};

export const notFound: Messages<typeof en.notFound> = {
  eyebrow: "الصفحة مو موجودة",
  title: "هالصفحة <accent>ماكو منها.</accent>",
  cta: "ارجع للرئيسية",
};
