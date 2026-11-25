import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/order";

/** Iraqi Arabic: order confirmation. */
const order: Messages<typeof en> = {
  eyebrow: "شكراً إلك",
  title: "تم تثبيت طلبك",
  notFound: "ما لگينا هذا الطلب على هذا الجهاز.",
  backHome: "ارجع للرئيسية",
  number: "رقم الطلب",
  thanks: "شكراً على طلبك.",
  prepare: "راح نجهّز جاكيتك حسب التفاصيل اللي اخترتها.",
  callYou: "راح نتصل بيك على <phone>{phone}</phone> حتى نرتّب التوصيل إلى {area}، {city}.",
  summaryTitle: "ملخّص الطلب",
  payment: "الدفع",
  paymentMethod: {
    cod: "الدفع عند الاستلام",
    card: "بطاقة / Visa",
  },
};

export default order;
