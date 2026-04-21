import { InfoPageShell } from "@/components/app/info-page-shell";

const FAQS = [
  {
    question: "Bendeki Sen tam olarak ne yapıyor?",
    answer:
      "Geçmiş sohbetleri analiz ederek seçtiğin kişinin konuşma tarzına yakın bir sohbet deneyimi oluşturur.",
  },
  {
    question: "Gerçekten o kişinin aynısı mı oluyor?",
    answer:
      "Hayır. Bu uygulama birebir aynı kişiyi geri getirmez. Geçmiş konuşmalardan öğrenilen dil, ton ve iletişim alışkanlıklarıyla bir simülasyon üretir.",
  },
  {
    question: "Hangi dosyaları yükleyebilirim?",
    answer:
      "Mesaj dışa aktarımlarını yükleyebilirsin. Desteklenen formatlar uygulama akışında gösterilir.",
  },
  {
    question: "Mesajlarım güvende mi?",
    answer:
      "Mesajlar yalnızca uygulama deneyimini sağlamak ve persona oluşturmak amacıyla işlenir. Gizlilik ve veri işleme politikaları ayrıca sunulmalıdır.",
  },
  {
    question: "Ücretsiz sürümde neler var?",
    answer:
      "Ücretsiz sürüm temel deneyimi keşfetmek içindir. Gelişmiş analiz, ses temelli özellikler ve daha kapsamlı kullanım için ücretli paketler gerekir.",
  },
  {
    question: "Sesli özellikler herkese açık mı?",
    answer: "Hayır. Gelişmiş ses özellikleri yalnızca uygun paketlerde açılır.",
  },
  {
    question: "Bu uygulama terapötik veya resmi tavsiye yerine geçer mi?",
    answer:
      "Hayır. Bendeki Sen duygusal veya kişisel bir deneyim sunar, ancak profesyonel destek veya resmi değerlendirme yerine geçmez.",
  },
];

export default function FaqPage() {
  return (
    <InfoPageShell
      eyebrow="FAQ"
      title="Merak Edilenler"
      subtitle="Uygulamayla ilgili en çok sorulan sorular"
    >
      <div className="space-y-3">
        {FAQS.map((item, index) => (
          <details
            key={item.question}
            className="group rounded-3xl border border-white/8 bg-white/[0.045] px-5 py-4 open:border-primary/25 open:bg-primary/[0.07]"
            open={index === 0}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-white/86">
              {item.question}
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/8 text-lg leading-none text-primary transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-white/56">{item.answer}</p>
          </details>
        ))}
      </div>
    </InfoPageShell>
  );
}
