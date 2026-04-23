import { NextRequest, NextResponse } from "next/server";
import { generateGeminiImage } from "@/lib/ai/gemini";
import { getAiErrorResponse } from "@/lib/ai/errors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const promptValue = formData.get("prompt");
    const prompt =
      typeof promptValue === "string" && promptValue.trim()
        ? promptValue.trim()
        : "Bu gorseli kisa, somut ve guvenli sekilde yorumla. JSON dondur: {\"description\": string, \"mood\": string, \"notable_details\": string[]}";

    if (!isUploadedFile(image)) {
      return NextResponse.json({ error: "image dosyasi gerekli" }, { status: 400 });
    }

    const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");
    const raw = await generateGeminiImage({
      systemInstruction: "Sen bir gorsel yorumlama servis katmanisin. Sadece JSON dondur.",
      prompt,
      image: {
        mimeType: image.type || "image/jpeg",
        base64,
      },
      json: true,
      temperature: 0.15,
      maxOutputTokens: 900,
    });

    return NextResponse.json({ analysis: parseJson(raw), provider: "gemini" });
  } catch (error) {
    const aiError = getAiErrorResponse(error);
    return NextResponse.json(
      { error: aiError.message, code: aiError.code },
      { status: aiError.status }
    );
  }
}

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return typeof value !== "string" && value !== null;
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return { description: raw };
  }
}
