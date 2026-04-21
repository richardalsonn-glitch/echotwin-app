import { InfoCard, InfoPageShell } from "@/components/app/info-page-shell";

const HIGHLIGHTS = [
  "Geçmiş sohbetlerden persona analizi",
  "Daha kişisel ve bağlamsal yanıtlar",
  "Ses, metin ve hafıza temelli deneyim",
  "Premium kullanıcılar için gelişmiş özellikler",
];

export default function AboutPage() {
  return (
    <InfoPageShell
      eyebrow="Hakkımızda"
      title="Bendeki Sen"
      subtitle="Birinin konuşma izini yeniden hissetmek için tasarlandı."
    >
      <InfoCard>
        <div className="space-y-4 text-sm leading-relaxed text-white/62">
          <p>
            Bendeki Sen, geçmiş sohbetlerinden bir kişinin konuşma tarzını, kelime
            alışkanlıklarını ve sana karşı yaklaşımını analiz ederek daha gerçekçi bir
            sohbet deneyimi sunmak için geliştirildi.
          </p>
          <p>
            Bu uygulama, yalnızca mesaj üretmeyi değil; bir kişiyi hatırlama, yeniden
            konuşma, olası tepkilerini görme ve geçmiş iletişimin tonunu yeniden hissetme
            fikri üzerine kuruldu.
          </p>
          <p>
            İster birini anmak iste, ister yarım kalmış bir konuşmayı zihninde tamamlamak
            iste, istersen de sadece “buna ne derdi?” diye merak et; Bendeki Sen bu
            deneyimi daha kişisel ve daha anlamlı hale getirmeyi amaçlar.
          </p>
        </div>
      </InfoCard>

      <div className="grid grid-cols-1 gap-3">
        {HIGHLIGHTS.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-primary/15 bg-primary/[0.07] px-4 py-3 text-sm font-medium text-white/78"
          >
            {item}
          </div>
        ))}
      </div>
    </InfoPageShell>
  );
}
