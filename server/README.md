---
title: Moeen ASR
sdk: docker
app_port: 7860
---

# خادم تسميع مُعِين

يشغّل `tarteel-ai/whisper-base-ar-quran` ويستقبل الصوت عبر WebSocket (`/ws`).
الفحص: `GET /health`.

## النشر على Hugging Face Spaces
1. أنشئ Space جديدًا واختر **Docker** (الخطة المجانية CPU تكفي للتجربة).
2. ارفع محتويات هذا المجلد (`app.py`, `requirements.txt`, `Dockerfile`, `README.md`) إلى الـSpace.
3. انتظر انتهاء البناء، ثم انسخ رابط الـSpace (مثل `https://user-moeen-asr.hf.space`).
4. في التطبيق: الإعدادات ← «التسميع الدقيق» ← الصق الرابط ← «اختبار الاتصال».

## تشغيل محلي
`pip install -r requirements.txt && uvicorn app:app --port 7860`
(للاختبار دون نموذج: `MOCK=1`). متغيرات اختيارية: `MODEL_ID`, `THREADS`, `SPEECH_RMS`.
