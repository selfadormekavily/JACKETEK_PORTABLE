import type { Messages } from "@/i18n/types";
import type en from "@/locales/en/story";

/** Iraqi Arabic: story. */
const story: Messages<typeof en> = {
  backdrop: {
    detail: "تفصيلة",
    moment: "اللحظة",
  },
  counter: "[ {n} / {total} ]",
  idea: {
    eyebrow: "الفكرة",
    headline: "<l1>مصمّم</l1> <a2>لدفعتك.</a2>",
    body: "التخرّج <em>لحظة تستاهل تنحفظ</em>. في JACKETEK نسوّي جاكيتات بالطلب، مصمّمة على ناس كل دفعة وذكرياتها وهويتها.",
    cta: "اكتشف الصنعة",
    spec: {
      wool: "جسم قماش قطن",
      leather: "ردن جلد",
      rib: "أطراف ريب",
      made: "ينسوّى بالطلب",
    },
  },
  jacket: {
    eyebrow: "الجاكيت",
    headline: "<l1>كل تفصيلة</l1> <a2>محسوب حسابها.</a2>",
    callout: {
      wool: { title: "جسم قماش قطن", detail: "قماش قطن كثيف وناعم، بلمسة مطفية." },
      leather: { title: "ردن جلد", detail: "جلد طري، يصير أنعم كل ما تلبسه." },
      fit: { title: "قَصّة واسعة", detail: "قصّة وحدة واسعة ومريحة، على قياسك." },
      built: { title: "مصنوع حتى يدوم", detail: "أطراف ريب وكبسات مضغوطة." },
    },
    footer: "قماش قطن · جلد · ريب · كبسات مضغوطة",
    compact: {
      wool: { term: "جسم قماش قطن", value: "قماش قطن كثيف وناعم" },
      leather: { term: "ردن جلد", value: "يصير أنعم ويّا اللبس" },
      fit: { term: "قَصّة واسعة", value: "واسعة، على قياسك" },
      built: { term: "مصنوع حتى يدوم", value: "ريب وكبسات مضغوطة" },
    },
  },
  craft: {
    eyebrow: "الصنعة",
    headline: "<l1>مصنوع</l1> <a2>حتى يبقى وياك.</a2>",
    body: "ياقة وأطراف ريب، كبسات مضغوطة، وخياطة نظيفة ومرتّبة — كل قطعة مختارة حتى تعيش أكثر من يوم التخرّج.",
    spec: {
      collar: "ياقة وأطراف ريب",
      snaps: "كبسات مضغوطة",
      seams: "خياطة نظيفة ومرتّبة",
    },
    tag: {
      collar: "ياقة ريب",
      snap: "كبسة مضغوطة",
      sleeve: "ردن جلد",
    },
    figCaption: "لقطة 03 — من قريب",
  },
  stitch: {
    sideLabel: "من ورا — لقطة 04",
    macro: "من قريب",
    raised: "خيط بارز",
    threadByThread: "خيط بخيط.",
    eyebrow: "التطريز",
    stitched: "مطرّز،",
    afterStitched: "",
    notPrinted: "مو مطبوع.",
    body: "الأسماء والسنين والشعارات تنطرز خيط بخيط — بارزة، بملمس تحسّه، وبالمكان اللي تريده بالضبط.",
    bodyCompact: "الأسماء والسنين والشعارات، مطرّزة خيط بخيط — بالمكان اللي تريده بالضبط.",
    spec: {
      name: "اسمك",
      year: "دفعتك",
      crest: "شعارك",
    },
  },
  finale: {
    eyebrow: "مالتك",
    lead: "مسوّى",
    rest: "<l2>للحظة</l2> <a3>تخرّجك.</a3>",
    headlineCompact: "<l1>مسوّى</l1> <a2>للحظة تخرّجك.</a2>",
    body: "سوّي جاكيت ما يشبه غيره — مالتك إنت.",
    cta: "يلا صمّم جاكيتك",
    viewCraft: "شوف الصنعة",
    footer: "ينسوّى بالطلب — دفعة 2027",
  },
};

export default story;
