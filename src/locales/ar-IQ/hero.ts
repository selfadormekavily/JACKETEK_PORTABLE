import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/hero";

/** Iraqi Arabic: hero. */
const hero: Messages<typeof en> = {
  storyAria: "حكاية JACKETEK",
  jacketAria: "جاكيت تخرّج من JACKETEK: جسم قماش قطن كحلي وردن جلد أوف وايت",
  side: {
    series: "السلسلة 01 — فارسيتي",
    class: "دفعة / 2027",
  },
  eyebrow: "جاكيتات تخرّج فاخرة، تنصنع إلك",
  wordmarkAlt: "JACKETEK",
  headline: "جاكيت تخرّجك، <accent>يتصمّم على ذوقك.</accent>",
  lede: "قماش قطن، جلد، واسمك مطرّز بخيط بارز — إنت تصمّمه، وإحنا نسوّيه بالطلب لدفعتك.",
  cta: "يلا صمّم جاكيتك",
  preparingJacket: "دنجهّز جاكيتك",
  scrollCue: "[ نزّل واكتشف ]",
  jacketName: "الفارسيتي — 01",
  colourwayAria: "الألوان",
  colourway: {
    navyOffWhite: "كحلي / أوف وايت",
    navyIvory: "كحلي / عاجي",
    maroonIvory: "عنّابي / عاجي",
    forestCamel: "أخضر غامق / جملي",
  },
  chaptersAria: "فصول الحكاية",
  compact: {
    eyebrow: "مطرّز — دفعة 2027",
    counter: "[ {current} / {total} ]",
  },
};

export default hero;
