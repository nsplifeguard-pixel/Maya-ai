import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionConfig = {
  type: "realtime",
  model: "gpt-realtime",
  instructions: [
    "คุณคือ MAYA AI ผู้ช่วยส่วนตัวที่ฉลาด สุภาพ เป็นมิตร และตอบเป็นภาษาไทยเป็นหลัก",
    "พูดให้เป็นธรรมชาติ กระชับ และเข้าใจง่าย",
    "หากผู้ใช้พูดภาษาอื่นให้ตอบตามภาษานั้น",
    "หากไม่แน่ใจให้บอกตรง ๆ อย่าแต่งข้อมูลขึ้นมาเอง",
    "อย่าพูดทับผู้ใช้โดยไม่จำเป็น และหยุดพูดเมื่อผู้ใช้ขัดจังหวะ"
  ].join(" "),
  audio: {
    input: {
      noise_reduction: { type: "near_field" },
      transcription: { model: "gpt-4o-mini-transcribe", language: "th" },
      turn_detection: {
        type: "semantic_vad",
        eagerness: "medium",
        create_response: true,
        interrupt_response: true
      }
    },
    output: { voice: "marin" }
  }
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า OPENAI_API_KEY" },
      { status: 500 }
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/sdp")) {
    return NextResponse.json({ error: "Content-Type ต้องเป็น application/sdp" }, { status: 415 });
  }

  const offerSdp = await request.text();
  if (!offerSdp || offerSdp.length > 200_000 || !offerSdp.startsWith("v=0")) {
    return NextResponse.json({ error: "SDP offer ไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const form = new FormData();
    form.set("sdp", offerSdp);
    form.set("session", JSON.stringify(sessionConfig));

    const upstream = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000)
    });

    const answerSdp = await upstream.text();

    if (!upstream.ok) {
      // Log only a short provider response; never log the secret key or user audio.
      console.error("Realtime API rejected call", upstream.status, answerSdp.slice(0, 500));
      const message = upstream.status === 401 || upstream.status === 403
        ? "API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้ Realtime API"
        : upstream.status === 429
          ? "คำขอเกินโควตาหรือ rate limit กรุณาตรวจสอบการใช้งาน API"
          : "ผู้ให้บริการ AI ปฏิเสธการเชื่อมต่อ ตรวจสอบชื่อโมเดลและการตั้งค่า API";
      return NextResponse.json({ error: message }, { status: upstream.status === 429 ? 429 : 502 });
    }

    return new Response(answerSdp, {
      status: 200,
      headers: {
        "Content-Type": "application/sdp",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Realtime session creation failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { error: "เชื่อมต่อเซิร์ฟเวอร์ AI ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่" },
      { status: 502 }
    );
  }
}