"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Role = "user" | "assistant";
type ChatLine = { id: string; role: Role; text: string };

export default function Home() {
  const [status, setStatus] = useState("พร้อมเริ่มต้น");
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([
    { id: "welcome", role: "assistant", text: "สวัสดีครับ ผม MAYA AI ผู้ช่วยส่วนตัวของคุณ กดเริ่มสนทนาแล้วพูดกับผมได้เลยครับ" }
  ]);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptBuffer = useRef<Record<string, string>>({});
  const seenEvents = useRef<Set<string>>(new Set());

  const addLine = (role: Role, text: string) => {
    const value = text.trim();
    if (!value) return;
    setLines((current) => [...current, { id: `${Date.now()}-${Math.random()}`, role, text: value }]);
  };

  const cleanup = () => {
    try { channelRef.current?.close(); } catch {}
    try { pcRef.current?.getSenders().forEach((sender) => sender.track?.stop()); } catch {}
    try { pcRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }
    channelRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
  };

  const stopSession = () => {
    cleanup();
    setConnected(false);
    setBusy(false);
    setStatus("จบการสนทนาแล้ว");
  };

  useEffect(() => () => cleanup(), []);

  const startSession = async () => {
    if (busy || connected) return;
    setBusy(true);
    setStatus("กำลังขอใช้ไมโครโฟน…");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("เบราว์เซอร์ไม่รองรับไมโครโฟน โปรดใช้ Safari/Chrome ผ่าน HTTPS หรือ localhost");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = audioRef.current;
      if (audio) {
        audio.autoplay = true;
        audio.playsInline = true;
        pc.ontrack = async (event) => {
          audio.srcObject = event.streams[0];
          try {
            await audio.play();
            setStatus("เชื่อมต่อแล้ว • พูดได้เลย");
          } catch {
            setStatus("เชื่อมต่อแล้ว แต่เล่นเสียงไม่ได้ แตะปุ่มเปิดเสียงด้านล่าง");
          }
        };
      }

      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));

      const channel = pc.createDataChannel("maya-events");
      channelRef.current = channel;

      channel.onopen = () => {
        setConnected(true);
        setBusy(false);
        setStatus("กำลังสนทนา • พูดได้เลย");
      };

      channel.onclose = () => {
        setConnected(false);
        if (pcRef.current) setStatus("ช่องทางสนทนาปิดแล้ว");
      };

      channel.onerror = () => setStatus("ช่องทางรับส่งข้อความขัดข้อง");

      channel.onmessage = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "session.created":
            case "session.updated":
              setStatus("เซสชันพร้อมใช้งาน");
              break;
            case "input_audio_buffer.speech_started":
              setStatus("กำลังฟังคุณอยู่…");
              break;
            case "input_audio_buffer.speech_stopped":
              setStatus("กำลังประมวลผลเสียง…");
              break;
            case "conversation.item.input_audio_transcription.completed":
              if (data.transcript) addLine("user", data.transcript);
              break;
            case "response.created":
              setStatus("MAYA กำลังตอบ…");
              break;
            case "response.output_audio_transcript.delta": {
              const key = data.item_id || data.response_id || "assistant-current";
              transcriptBuffer.current[key] = (transcriptBuffer.current[key] || "") + (data.delta || "");
              break;
            }
            case "response.output_audio_transcript.done": {
              const key = data.item_id || data.response_id || "assistant-current";
              const finalText = data.transcript || transcriptBuffer.current[key] || "";
              if (finalText && !seenEvents.current.has(key)) {
                addLine("assistant", finalText);
                seenEvents.current.add(key);
              }
              delete transcriptBuffer.current[key];
              break;
            }
            case "response.output_text.delta": {
              const key = data.item_id || data.response_id || "assistant-text-current";
              transcriptBuffer.current[key] = (transcriptBuffer.current[key] || "") + (data.delta || "");
              break;
            }
            case "response.output_text.done": {
              const key = data.item_id || data.response_id || "assistant-text-current";
              const finalText = data.text || transcriptBuffer.current[key] || "";
              if (finalText && !seenEvents.current.has(key)) {
                addLine("assistant", finalText);
                seenEvents.current.add(key);
              }
              delete transcriptBuffer.current[key];
              break;
            }
            case "response.done":
              setStatus("กำลังสนทนา • พูดได้เลย");
              break;
            case "error":
              setStatus(data.error?.message || "Realtime API แจ้งข้อผิดพลาด");
              break;
            default:
              break;
          }
        } catch {
          setStatus("ได้รับข้อมูลจาก AI แต่แปลผลเหตุการณ์ไม่สำเร็จ");
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "failed") setStatus("การเชื่อมต่อเสียงล้มเหลว ตรวจสอบเครือข่ายแล้วลองใหม่");
        if (state === "disconnected") setStatus("เสียงขาดหาย กำลังรอการเชื่อมต่อกลับ…");
      };

      setStatus("กำลังเชื่อมต่อ MAYA AI…");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const localSdp = pc.localDescription?.sdp;
      if (!localSdp) throw new Error("สร้าง SDP offer ไม่สำเร็จ");

      const response = await fetch("/api/realtime-call", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: localSdp,
        cache: "no-store"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `เชื่อมต่อ API ไม่สำเร็จ (${response.status})`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      setStatus("กำลังเปิดช่องทางเสียง…");
    } catch (error) {
      cleanup();
      setConnected(false);
      setBusy(false);
      setStatus(error instanceof Error ? error.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
    }
  };

  const sendText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    const channel = channelRef.current;
    if (!text || !channel || channel.readyState !== "open") return;

    addLine("user", text);
    channel.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text }] }
    }));
    channel.send(JSON.stringify({ type: "response.create" }));
    setDraft("");
    setStatus("MAYA กำลังตอบ…");
  };

  const enableAudio = async () => {
    try {
      await audioRef.current?.play();
      setStatus("เปิดเสียงแล้ว • สนทนาต่อได้เลย");
    } catch {
      setStatus("ยังเปิดเสียงไม่ได้ ตรวจสอบระดับเสียงและการตั้งค่า Safari");
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark"><span /></div>
        <div><div className="brand">MAYA <b>AI</b></div><div className="subtitle">FUTURE VOICE ASSISTANT</div></div>
        <div className={`connection ${connected ? "online" : ""}`}><i />{connected ? "ONLINE" : "OFFLINE"}</div>
      </header>

      <section className="hero">
        <div className={`orb-wrap ${connected ? "active" : ""} ${busy ? "loading" : ""}`}>
          <div className="orb-ring ring-one" /><div className="orb-ring ring-two" />
          <div className="orb"><div className="orb-core" /><div className="orb-shine" /></div>
          <div className="orb-dots"><i /><i /><i /><i /></div>
        </div>
        <div className="eyebrow">YOUR PERSONAL AI</div>
        <h1>สวัสดีครับ <span>ผม MAYA</span></h1>
        <p className="hero-copy">ผู้ช่วยอัจฉริยะที่พร้อมรับฟังและช่วยคุณ<br className="desktop-break" /> คิด วิเคราะห์ และค้นหาคำตอบผ่านการสนทนา</p>
        <div className="status"><span className={`status-dot ${connected ? "pulse" : ""}`} />{status}</div>
        <div className="controls">
          {!connected ? (
            <button className="primary-button" onClick={startSession} disabled={busy}>
              <span className="mic-icon">⌁</span>{busy ? "กำลังเชื่อมต่อ…" : "เริ่มสนทนาด้วยเสียง"}
            </button>
          ) : (
            <button className="end-button" onClick={stopSession}><span className="stop-icon" />จบการสนทนา</button>
          )}
        </div>
        {connected && <button className="audio-button" onClick={enableAudio}>เปิดเสียงตอบกลับ</button>}
        <div className="hint"><span>✦</span> เริ่มสนทนาแล้วพูดได้ตามธรรมชาติ</div>
      </section>

      <section className="conversation">
        <div className="section-heading">
          <div><span className="section-kicker">SESSION</span><h2>บทสนทนา</h2></div>
          <span className="message-count">{lines.length} ข้อความ</span>
        </div>
        <div className="chat-list" aria-live="polite">
          {lines.map((line) => (
            <article key={line.id} className={`chat-line ${line.role}`}>
              <div className="avatar">{line.role === "user" ? "คุณ" : "M"}</div>
              <div className="chat-content">
                <div className="chat-name">{line.role === "user" ? "คุณ" : "MAYA AI"}</div>
                <p>{line.text}</p>
              </div>
            </article>
          ))}
        </div>
        <form className="text-form" onSubmit={sendText}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={connected ? "พิมพ์ข้อความถึง MAYA…" : "เริ่มเชื่อมต่อเพื่อส่งข้อความ"} disabled={!connected} aria-label="พิมพ์ข้อความ" />
          <button type="submit" disabled={!connected || !draft.trim()} aria-label="ส่งข้อความ">↑</button>
        </form>
        <p className="privacy-note"><span>◆</span> ไมโครโฟนทำงานเมื่อคุณเริ่มสนทนาเท่านั้น</p>
      </section>
      <footer><div className="footer-brand">MAYA <b>AI</b></div><span>Designed for the future · Built for you</span></footer>
      <audio ref={audioRef} autoPlay playsInline />
    </main>
  );
}