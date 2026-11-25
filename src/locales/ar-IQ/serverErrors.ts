import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/serverErrors";

/** Iraqi Arabic: API messages. Errors stay plain and direct — no slang. */
const serverErrors: Messages<typeof en> = {
  generic: "صار خطأ. حاول مرة ثانية.",
  passwordShort: "كلمة السر لازم تكون {min} أحرف على الأقل.",
  passwordLong: "كلمة السر طويلة هواية.",
  signupRateLimit: "صارت محاولات تسجيل هواية من هذا المكان. حاول بعد كم دقيقة.",
  firstNameRequired: "اكتب اسمك.",
  lastNameRequired: "اكتب لقبك.",
  nameTooLong: "الاسم طويل هواية.",
  phoneInvalid: "اكتب رقم موبايل صحيح للبلد اللي اخترته.",
  emailInvalid: "اكتب إيميل صحيح، مثل name@example.com.",
  emailInvalidShort: "اكتب إيميل صحيح.",
  checkFields: "راجع الحقول المعلّمة.",
  emailTaken: "اكو حساب مسجّل بهذا الإيميل.",
  emailTakenLogIn: "اكو حساب مسجّل بهذا الإيميل. سجّل دخول بداله.",
  phoneTaken: "اكو حساب مسجّل بهذا الرقم.",
  phoneTakenLogIn: "اكو حساب مسجّل بهذا الرقم. سجّل دخول بداله.",
  detailsTaken: "اكو حساب مسجّل بهذي المعلومات. سجّل دخول بداله.",
  loginFailed: "الإيميل أو الرقم أو كلمة السر غير صحيحة.",
  loginRateLimitIp: "محاولات هواية. حاول بعد دقيقة.",
  loginRateLimitAccount: "محاولات هواية على هذا الحساب. حاول بعد 15 دقيقة.",
  forbidden: "هذا الطلب غير مسموح.",
  orderFullName: "الاسم الكامل مطلوب.",
  orderPhone: "رقم هاتف صحيح مطلوب.",
  orderCity: "المدينة مطلوبة.",
  orderArea: "المنطقة مطلوبة.",
  orderAddress: "العنوان الكامل مطلوب.",
  orderCardUnavailable: "الدفع بالبطاقة مو متوفّر بعد. اختار الدفع عند الاستلام.",
  orderPaymentMethod: "اختار طريقة الدفع.",
  orderItemCount: "الطلب لازم يكون بيه من 1 إلى 20 جاكيت.",
  orderDesignMissing: "الجاكيت {n}: التصميم مالته ناقص.",
  orderNoSize: "الجاكيت {n}: ما مختار قياس.",
  orderBadQuantity: "الجاكيت {n}: العدد غير صحيح.",
  orderTooLarge: "الطلب كبير هواية.",
};

export default serverErrors;
