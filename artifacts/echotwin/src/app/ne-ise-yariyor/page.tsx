import { InfoCard, InfoPageShell } from "@/components/app/info-page-shell";

const STEPS = [
  {
    label: "A",
    title: "Sohbet yükle",
    body:
      "WhatsApp dışa aktarımlarını yükleyerek geçmiş konuşmaları sisteme verirsin. Uygulama mesaj dilini, hitap biçimini ve iletişim dinamiğini analiz eder.",
  },
  {
    label: "B",
    title: "Kişi seç",
    body:
      "Yüklenen konuşmalar içinden konuşmak istediğin kişiyi seçersin. Sistem o kişiye ait bir persona oluşturur.",
  },
  {
    label: "C",
    title: "Analiz et",
    body:
      "Konuşma tarzı, sık kullanılan kelimeler, mesaj yoğunluğu, ton ve genel iletişim alışkanlıkları analiz edilir.",
  },
  {
    label: "D",
    title: "Konuşmaya başla",
    body:
      "O kişiyle yeniden konuşuyormuş gibi sohbet edebilirsin. Yanıtlar yüklediğin geçmişe ve çıkarılan persona yapısına göre şekillenir.",
  },
  {
    label: "E",
    title: "Gelişmiş deneyim",
    body:
      "Premium / Full özelliklerde ses, gelişmiş hafıza, medya analizi ve daha zengin etkileşimler desteklenebilir.",
  },
];

export default function HowItWorksPage() {
  return (
    <InfoPageShell
      eyebrow="Çalışma Mantığı"
      title="Bu uygulama ne işe yarıyor?"
      subtitle="Sadece bir sohbet botu değil, bir iletişim izini yeniden kurma aracı."
    >
      <div className="space-y-3">
        {STEPS.map((step) => (
          <InfoCard key={step.label}>
            <div className="flex gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.12] text-sm font-bold text-primary">
                {step.label}
              </div>
              <div>
                <h2 className="text-base font-bold text-white">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/58">{step.body}</p>
              </div>
            </div>
          </InfoCard>
        ))}
      </div>

      <div className="rounded-3xl border border-amber-400/18 bg-amber-400/[0.07] p-5 text-sm leading-relaxed text-amber-100/78">
        Bendeki Sen gerçek bir insanın birebir kopyası değildir; geçmiş iletişimi temel
        alan bir yapay zeka simülasyonudur.
      </div>
    </InfoPageShell>
  );
}
