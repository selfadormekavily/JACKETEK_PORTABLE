import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/auth";

/**
 * Iraqi Arabic: auth. Warm in the stage headlines and ledes; fields,
 * errors and security UI stay plain and direct. Never «لـ» glued before
 * Latin (JACKETEK): rephrased instead.
 */
const auth: Messages<typeof en> = {
  stage: {
    ariaSaved: "تصميمك المحفوظ",
    altSaved: "الجاكيت اللي صمّمته",
    altDefault: "جاكيت فارسيتي من JACKETEK",
    savedEyebrow: "تصميمك محفوظ",
    savedHeadline: "خطوة وحدة <accent>وتوصل للسلة.</accent>",
    savedNote: "سجّل دخول أو سوّي حساب، وجاكيتك يروح للسلة مباشرةً، بالضبط مثل ما صمّمته.",
    atelierEyebrow: "مشغل JACKETEK",
    signupHeadline: "مفصّل <accent>على دفعتك.</accent>",
    loginHeadline: "هلا بيك <accent>من جديد.</accent>",
  },
  tabs: {
    aria: "سجّل دخول أو سوّي حساب",
    logIn: "تسجيل الدخول",
    createAccount: "حساب جديد",
  },
  title: {
    signup: "سوّي حسابك",
    login: "سجّل دخولك",
  },
  lede: {
    addingToCart: "جاكيتك ينتظرك — أول ما تدخل، يصير بسلّتك.",
    signup: "احفظ تصاميمك، اطلب أسرع، وتابع طلب دفعتك.",
    login: "استخدم الإيميل أو رقم الموبايل اللي سجّلت بيه.",
  },
  method: {
    aria: "استخدم الإيميل أو رقم الموبايل",
    email: "الإيميل",
    phone: "رقم الموبايل",
  },
  fields: {
    firstName: "الاسم",
    lastName: "اللقب",
    email: "الإيميل",
    emailPlaceholder: "name@example.com",
    phone: "رقم الموبايل",
    password: "كلمة السر",
    passwordHint: {
      zero: "{count} حرف على الأقل. تگدر تستخدم حروف، أرقام أو رموز.",
      one: "حرف واحد على الأقل. تگدر تستخدم حروف، أرقام أو رموز.",
      two: "حرفين على الأقل. تگدر تستخدم حروف، أرقام أو رموز.",
      few: "{count} أحرف على الأقل. تگدر تستخدم حروف، أرقام أو رموز.",
      many: "{count} حرف على الأقل. تگدر تستخدم حروف، أرقام أو رموز.",
      other: "{count} حرف على الأقل. تگدر تستخدم حروف، أرقام أو رموز.",
    },
    passwordCounter: "{n}/{min}",
    showPassword: "إظهار كلمة السر",
    hidePassword: "إخفاء كلمة السر",
  },
  errors: {
    firstNameRequired: "اكتب اسمك.",
    lastNameRequired: "اكتب لقبك.",
    emailInvalid: "اكتب إيميل صحيح، مثل name@example.com.",
    emailRequired: "اكتب إيميلك.",
    phoneInvalid: "الرقم مو صحيح للبلد اللي اخترته.",
    phoneRequired: "اكتب رقم موبايلك.",
    passwordShort: {
      zero: "كلمة السر لازم تكون {count} حرف على الأقل.",
      one: "كلمة السر لازم تكون حرف واحد على الأقل.",
      two: "كلمة السر لازم تكون حرفين على الأقل.",
      few: "كلمة السر لازم تكون {count} أحرف على الأقل.",
      many: "كلمة السر لازم تكون {count} حرف على الأقل.",
      other: "كلمة السر لازم تكون {count} حرف على الأقل.",
    },
    passwordRequired: "اكتب كلمة السر.",
    network: "ما گدرنا نتصل بـ JACKETEK. تأكد من الإنترنت وحاول مرة ثانية.",
  },
  submit: {
    creating: "دنسوّي حسابك",
    loggingIn: "دنسجّل دخولك",
    createAccount: "سوّي حساب",
    logIn: "سجّل دخول",
  },
  switch: {
    haveAccount: "عندك حساب؟",
    newTo: "أول مرة ويانا؟",
    logIn: "سجّل دخول",
    createAccount: "سوّي حساب",
  },
  country: {
    triggerAria: "رمز البلد: {country} {dial}",
    searchAria: "دوّر على بلد",
    searchPlaceholder: "دوّر على البلد أو الرمز",
    listAria: "البلدان",
    noMatch: "ماكو بلد يطابق «<q>{query}</q>».",
  },
};

export default auth;
