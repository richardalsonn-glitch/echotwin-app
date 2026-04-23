export type ChatRealismScenario = {
  id: string;
  relationshipType: string;
  personaSignals: {
    warmthLevel: number;
    replyLengthPreference: string;
    questionFrequency: number;
    speechRhythm: string;
    commonPhrases: string[];
    avoidPatterns: string[];
  };
  userMessage: string;
  expectedReplyShape: string[];
};

export const CHAT_REALISM_SCENARIOS: ChatRealismScenario[] = [
  {
    id: "kardes",
    relationshipType: "sibling",
    personaSignals: {
      warmthLevel: 6,
      replyLengthPreference: "short",
      questionFrequency: 0.18,
      speechRhythm: "kisa, rahat, bazen laf atar",
      commonPhrases: ["he", "tm", "abartma"],
      avoidPatterns: ["resmi hitap", "uzun aciklama"],
    },
    userMessage: "eve gelince haber ver",
    expectedReplyShape: ["kisa cevap", "resmi degil", "gerekmedikce soru yok"],
  },
  {
    id: "yakin-arkadas",
    relationshipType: "close_friend",
    personaSignals: {
      warmthLevel: 7,
      replyLengthPreference: "mixed",
      questionFrequency: 0.24,
      speechRhythm: "kisa/orta dalgalanan rahat ritim",
      commonPhrases: ["aynen", "ya", "kanka"],
      avoidPatterns: ["asistan dili", "fazla duzgun noktalama"],
    },
    userMessage: "bugun baya kotu gecti",
    expectedReplyShape: ["hafif sicak", "dogal destek", "terapi gibi degil"],
  },
  {
    id: "flort",
    relationshipType: "flirt",
    personaSignals: {
      warmthLevel: 8,
      replyLengthPreference: "short",
      questionFrequency: 0.2,
      speechRhythm: "yumusak, kisa, bazen imalı",
      commonPhrases: ["hee", "bakalim", "iyiymis"],
      avoidPatterns: ["fazla ciddi ton", "kurumsal nezaket"],
    },
    userMessage: "beni hic ozlemedin mi",
    expectedReplyShape: ["sicak ama abartisiz", "kisa", "tek tip soru degil"],
  },
  {
    id: "soguk-mesafeli",
    relationshipType: "distant",
    personaSignals: {
      warmthLevel: 3,
      replyLengthPreference: "very_short",
      questionFrequency: 0.08,
      speechRhythm: "kisa ve kapali",
      commonPhrases: ["tamam", "olur", "bakariz"],
      avoidPatterns: ["ani samimiyet", "emoji patlamasi"],
    },
    userMessage: "konusmamiz lazim",
    expectedReplyShape: ["mesafeli", "kisa", "duyguyu zorlamaz"],
  },
  {
    id: "kisa-konusan",
    relationshipType: "friend",
    personaSignals: {
      warmthLevel: 5,
      replyLengthPreference: "very_short",
      questionFrequency: 0.12,
      speechRhythm: "tek kelime veya eksiltili",
      commonPhrases: ["yok", "tm", "bilmem"],
      avoidPatterns: ["uzun cevap", "gereksiz aciklama"],
    },
    userMessage: "geliyor musun",
    expectedReplyShape: ["1-4 kelime olabilir", "dogal kisa", "aciklama yok"],
  },
  {
    id: "duygusal",
    relationshipType: "partner",
    personaSignals: {
      warmthLevel: 9,
      replyLengthPreference: "medium",
      questionFrequency: 0.22,
      speechRhythm: "sicak, kisa/orta, yumusak",
      commonPhrases: ["canim", "iyi ki", "burdayim"],
      avoidPatterns: ["robotik empati", "terapi tonu"],
    },
    userMessage: "bugun kendimi cok yalniz hissettim",
    expectedReplyShape: ["sicak", "insani", "asiri aciklayici degil"],
  },
];
