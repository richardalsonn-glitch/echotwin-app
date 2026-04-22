"use client";

import { InfoPageShell } from "@/components/app/info-page-shell";
import { useI18n } from "@/context/language-context";
import type { TranslationKey } from "@/lib/i18n";

const FAQS: Array<{ questionKey: TranslationKey; answerKey: TranslationKey }> = [
  { questionKey: "info.faq.0.q", answerKey: "info.faq.0.a" },
  { questionKey: "info.faq.1.q", answerKey: "info.faq.1.a" },
  { questionKey: "info.faq.2.q", answerKey: "info.faq.2.a" },
  { questionKey: "info.faq.3.q", answerKey: "info.faq.3.a" },
  { questionKey: "info.faq.4.q", answerKey: "info.faq.4.a" },
  { questionKey: "info.faq.5.q", answerKey: "info.faq.5.a" },
  { questionKey: "info.faq.6.q", answerKey: "info.faq.6.a" },
];

export default function FaqPage() {
  const { t } = useI18n();

  return (
    <InfoPageShell
      eyebrow="FAQ"
      title={t("info.faqTitle")}
      subtitle={t("info.faqSubtitle")}
    >
      <div className="space-y-3">
        {FAQS.map((item, index) => (
          <details
            key={item.questionKey}
            className="group rounded-3xl border border-white/8 bg-white/[0.045] px-5 py-4 open:border-primary/25 open:bg-primary/[0.07]"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-white/86">
              {t(item.questionKey)}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 text-lg leading-none text-primary transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/56">
              {t(item.answerKey)}
            </p>
          </details>
        ))}
      </div>
    </InfoPageShell>
  );
}

