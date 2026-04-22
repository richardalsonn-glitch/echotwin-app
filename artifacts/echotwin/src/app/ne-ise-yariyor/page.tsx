"use client";

import { InfoCard, InfoPageShell } from "@/components/app/info-page-shell";
import { useI18n } from "@/context/language-context";
import type { TranslationKey } from "@/lib/i18n";

const STEPS: Array<{
  label: string;
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}> = [
  { label: "A", titleKey: "info.how.step.0.title", bodyKey: "info.how.step.0.body" },
  { label: "B", titleKey: "info.how.step.1.title", bodyKey: "info.how.step.1.body" },
  { label: "C", titleKey: "info.how.step.2.title", bodyKey: "info.how.step.2.body" },
  { label: "D", titleKey: "info.how.step.3.title", bodyKey: "info.how.step.3.body" },
  { label: "E", titleKey: "info.how.step.4.title", bodyKey: "info.how.step.4.body" },
];

export default function HowItWorksPage() {
  const { t } = useI18n();

  return (
    <InfoPageShell
      eyebrow={t("info.howEyebrow")}
      title={t("info.howTitle")}
      subtitle={t("info.howSubtitle")}
    >
      <div className="space-y-3">
        {STEPS.map((step) => (
          <InfoCard key={step.label}>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] text-sm font-bold text-primary">
                {step.label}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{t(step.titleKey)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/58">
                  {t(step.bodyKey)}
                </p>
              </div>
            </div>
          </InfoCard>
        ))}
      </div>

      <div className="rounded-3xl border border-amber-400/18 bg-amber-400/[0.07] p-5 text-sm leading-relaxed text-amber-100/78">
        {t("info.note")}
      </div>
    </InfoPageShell>
  );
}

