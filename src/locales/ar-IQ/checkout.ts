import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/checkout";

/** Iraqi Arabic: checkout. Fields, payment and errors stay clear and direct. */
const checkout: Messages<typeof en> = {
  eyebrow: "اطلب بدون حساب",
  title: "إتمام الطلب",
  empty: {
    body: "سلّتك فاضية — ماكو شي تكمّل طلبه هسه.",
    cta: "يلا صمّم جاكيتك",
  },
  summaryToggle: "ملخّص الطلب",
  steps: {
    contact: "معلومات التواصل",
    delivery: "التوصيل",
    payment: "الدفع",
  },
  fields: {
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    phonePlaceholder: "07X XXX XXXX",
    phoneHint: "راح نتصل بهذا الرقم حتى نرتّب التوصيل.",
    city: "المدينة",
    area: "المنطقة",
    areaPlaceholder: "مثلاً: خلدا",
    address: "العنوان الكامل",
    addressPlaceholder: "الشارع، رقم البناية، الطابق، الشقة",
    notes: "ملاحظات التوصيل",
    notesPlaceholder: "مثلاً: اتصلوا بيّ قبل التوصيل",
  },
  cities: {
    Amman: "عمّان",
    Zarqa: "الزرقاء",
    Irbid: "إربد",
    Aqaba: "العقبة",
    Salt: "السلط",
    Madaba: "مادبا",
    Jerash: "جرش",
    Ajloun: "عجلون",
    Karak: "الكرك",
    Mafraq: "المفرق",
    Tafilah: "الطفيلة",
    Maan: "معان",
  },
  payment: {
    aria: "طريقة الدفع",
    method: "طريقة الدفع",
    cod: {
      label: "الدفع عند الاستلام",
      detail: "تدفع من يوصلك الجاكيت.",
      name: "الدفع عند الاستلام",
    },
    card: {
      label: "بطاقة / Visa",
      detail: "دفع آمن أونلاين.",
      name: "بطاقة / Visa",
      comingSoon: "الدفع بالبطاقة أونلاين راح يتوفّر قريباً. هسه، اختار الدفع عند الاستلام.",
    },
  },
  placeOrder: "ثبّت الطلب",
  placingOrder: "دنثبّت طلبك…",
  errors: {
    cartEmpty: "سلّتك فاضية.",
    fullName: "اكتب اسمك الكامل.",
    phoneRequired: "اكتب رقم هاتفك.",
    phoneInvalid: "اكتب رقم هاتف صحيح، مثل 07X XXX XXXX.",
    city: "اكتب مدينتك.",
    area: "اكتب منطقتك.",
    address: "اكتب عنوانك الكامل (الشارع، البناية، الطابق).",
    payment: "اختار طريقة الدفع.",
    cardUnavailable: "الدفع بالبطاقة مو متوفّر بعد. اختار الدفع عند الاستلام.",
    network: "ما گدرنا نوصل للسيرفر. تأكّد من اتصالك بالإنترنت وحاول مرة ثانية.",
    notPlaced: "ما گدرنا نثبّت طلبك. حاول مرة ثانية.",
    generic: "صار خطأ. حاول مرة ثانية.",
  },
};

export default checkout;
