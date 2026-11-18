"""خادم تسميع مُعِين: يبث الصوت عبر WebSocket ويُرجع نص التلاوة بنموذج Whisper المدرَّب على القرآن."""
import asyncio, json, os
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

SR = 16000
MODEL_ID = os.environ.get("MODEL_ID", "tarteel-ai/whisper-base-ar-quran")
MOCK = os.environ.get("MOCK") == "1"          # للاختبار بدون نموذج
FRAME = SR // 10                               # 100 مللي ثانية
SPEECH_RMS = float(os.environ.get("SPEECH_RMS", "0.012"))
END_SILENCE = 7                                # 0.7 ثانية صمت تُنهي المقطع
PARTIAL_EVERY = 10                             # تحديث جزئي كل ثانية صوت
MAX_SEG = 25 * SR                              # حدّ أمان تحت نافذة Whisper (30ث)
MIN_SEG = int(0.3 * SR)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
_lock = asyncio.Lock()
_model = {}


def load():
    if MOCK or _model:
        return
    import torch
    from transformers import WhisperForConditionalGeneration, WhisperProcessor
    torch.set_num_threads(int(os.environ.get("THREADS", "2")))
    _model["p"] = WhisperProcessor.from_pretrained(MODEL_ID)
    _model["m"] = WhisperForConditionalGeneration.from_pretrained(MODEL_ID).eval()
    _model["torch"] = torch


def transcribe(pcm: np.ndarray) -> str:
    if MOCK:
        return f"mock {len(pcm)}"
    p, m, torch = _model["p"], _model["m"], _model["torch"]
    feats = p(pcm, sampling_rate=SR, return_tensors="pt").input_features
    dur = len(pcm) / SR
    with torch.inference_mode():
        ids = m.generate(feats, language="ar", task="transcribe",
                         max_new_tokens=min(220, int(dur * 8) + 12), num_beams=1)
    return p.batch_decode(ids, skip_special_tokens=True)[0].strip()


@app.on_event("startup")
def _startup():
    load()


@app.get("/health")
def health():
    return {"ok": True, "model": "mock" if MOCK else MODEL_ID}


@app.websocket("/ws")
async def ws(sock: WebSocket):
    await sock.accept()
    loop = asyncio.get_running_loop()
    seg = []            # عيّنات المقطع الحالي (float32)
    pending = np.zeros(0, dtype=np.float32)
    speech = False      # هل سُمع كلام في المقطع الحالي
    silent = 0          # إطارات صمت متتالية
    since = 0           # إطارات منذ آخر تحديث جزئي
    seg_id = 0

    async def run(audio):
        async with _lock:
            return await loop.run_in_executor(None, transcribe, audio)

    async def emit(kind, audio):
        text = await run(audio)
        await sock.send_text(json.dumps({"type": kind, "seg": seg_id, "text": text}, ensure_ascii=False))

    async def finalize():
        nonlocal seg, speech, silent, since, seg_id
        audio = np.concatenate(seg) if seg else np.zeros(0, dtype=np.float32)
        if speech and len(audio) >= MIN_SEG:
            await emit("final", audio)
        seg, speech, silent, since = [], False, 0, 0
        seg_id += 1

    try:
        while True:
            msg = await sock.receive()
            if msg.get("type") == "websocket.disconnect":
                break
            if msg.get("text"):
                if json.loads(msg["text"]).get("type") == "stop":
                    await finalize()
                    await sock.send_text(json.dumps({"type": "done"}))
                continue
            data = msg.get("bytes")
            if not data:
                continue
            pending = np.concatenate([pending, np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0])
            while len(pending) >= FRAME:
                fr, pending = pending[:FRAME], pending[FRAME:]
                loud = float(np.sqrt(np.mean(fr * fr))) > SPEECH_RMS
                if not speech and not loud:
                    continue                    # تجاهل الصمت قبل بدء الكلام
                seg.append(fr)
                if loud:
                    speech, silent = True, 0
                else:
                    silent += 1
                since += 1
                total = sum(len(x) for x in seg)
                if silent >= END_SILENCE or total >= MAX_SEG:
                    await finalize()
                elif speech and since >= PARTIAL_EVERY and not _lock.locked():
                    since = 0
                    await emit("partial", np.concatenate(seg))
    except WebSocketDisconnect:
        pass
