import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/studies";

/** Iraqi Arabic: studies. */
const studies: Messages<typeof en> = {
  backdropWord: "خامات",
  eyebrow: "دراسات",
  headline: "تحسّها من قريب، <accent>قبل لا تصير مالتك.</accent>",
  body: "قماش قطن، جلد، خيط بارز وكبسات مضغوطة: هاي الخامات اللي ينسوّى منها كل JACKETEK.",
  number: "دراسة {nn}",
  item: {
    chenille: {
      name: "شانيل بارز",
      alt: "حرف شانيل أحمر بحافة ساتان كريمية على قماش قطن كحلي، من قريب",
    },
    cuff: {
      name: "ردن جلد وطرف ريب",
      alt: "ردن جلد كريمي يوصل لطرفه الريب المقلّم",
    },
    collar: {
      name: "ياقة ريب وكبسة مضغوطة",
      alt: "ياقة الريب المقلّمة وكبسة مضغوطة على قماش قطن كحلي",
    },
  },
};

export default studies;
