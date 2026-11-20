FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir torch==2.4.1 --index-url https://download.pytorch.org/whl/cpu
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
# تنزيل النموذج وقت البناء لتسريع الإقلاع
RUN python -c "from transformers import WhisperForConditionalGeneration as M, WhisperProcessor as P; i='tarteel-ai/whisper-base-ar-quran'; P.from_pretrained(i); M.from_pretrained(i)"
EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
