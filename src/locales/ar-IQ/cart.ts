import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/cart";

/** Iraqi Arabic: cart. */
const cart: Messages<typeof en> = {
  title: "سلّتك",
  eyebrow: {
    empty: "السلة",
    count: {
      zero: "ولا جاكيت",
      one: "جاكيت واحد",
      two: "جاكيتين",
      few: "{count} جاكيتات",
      many: "{count} جاكيت",
      other: "{count} جاكيت",
    },
  },
  empty: {
    body: "سلّتك فاضية هسه. صمّم جاكيت تخرّجك، وراح يستناك هنا.",
    cta: "يلا صمّم جاكيتك",
  },
  itemsAria: "الجاكيتات اللي بسلّتك",
  more: {
    question: "تصمّم لواحد ثاني همّين؟",
    continue: "كمّل تصميم",
  },
  summary: {
    title: "ملخّص الطلب",
    codNote: "الدفع كاش عند الاستلام — تختاره وقت تكمّل الطلب.",
    checkout: "كمّل الطلب",
    line: "القياس <size>{size}</size> · العدد {quantity}",
  },
  item: {
    aria: "{productName}، القياس {size}",
    ariaNoSize: "{productName}، القياس ما مختار",
    madeToOrder: "ينسوّى بالطلب",
    size: "القياس <size>{size}</size>",
    sizeNotSelected: "القياس ما مختار",
    zoneValue: "{colour} · {material}",
    embroidery: "التطريز: {value}",
    embroideryCustomised: "مخصّص",
    embroideryNone: "بدون",
    quantityAria: "عدد {productName}",
    remove: "حذف",
    number: "رقم {nn}",
    imageAlt: "تصميم جاكيتك",
    emptyStage: "تصميمك",
  },
  trio: {
    aria: "الألوان",
  },
  stepper: {
    decrease: "قلّل العدد",
    increase: "زيد العدد",
  },
  price: {
    subtotal: "المجموع الفرعي",
    delivery: "التوصيل",
    total: "المجموع الكلي",
    tbc: "يتأكّد لاحقاً",
  },
  progress: {
    aria: "خطوات الطلب",
    cart: "السلة",
    details: "التفاصيل",
    confirmation: "التأكيد",
  },
};

export default cart;
