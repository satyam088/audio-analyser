import os
import re
import json
import tempfile
from typing import List, Optional, Dict, Any
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Load environment variables
load_dotenv()

app = FastAPI(
    title="AudioLens Python AI Backend",
    description="Speech-to-Text (Whisper) & Intelligence (Gemini API) Service",
    version="1.0.0",
)

# Enable CORS for frontend and Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

# Lazy loaded Whisper model instance
_whisper_model = None

def get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        print(f"[Whisper] Loading Whisper model ({MODEL_SIZE}) on {DEVICE}...")
        from faster_whisper import WhisperModel
        try:
            _whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
        except Exception as e:
            print(f"[Whisper] Fallback without compute_type {COMPUTE_TYPE}: {e}")
            _whisper_model = WhisperModel(MODEL_SIZE, device=DEVICE)
        print("[Whisper] Model loaded successfully!")
    return _whisper_model

def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        print(f"[Gemini] Error initializing Gemini client: {e}")
        return None


# --- Pydantic Schemas ---

class TranscriptionRequest(BaseModel):
    file_url: str
    local_path: Optional[str] = None
    title: Optional[str] = "Uploaded Recording"

class AnalysisRequest(BaseModel):
    transcript: str
    title: Optional[str] = "Recording Analysis"

class ChatRequest(BaseModel):
    question: str
    transcript: str
    summary: Optional[Dict[str, Any]] = None
    history: Optional[List[Dict[str, Any]]] = []


# --- Heuristic Fallback Summarizer (Active when GEMINI_API_KEY is blank) ---

def generate_fallback_summary(transcript: str, segments: List[Dict[str, Any]], title: str) -> Dict[str, Any]:
    sentences = [s.strip() for s in re.split(r'[.!?]+', transcript) if len(s.strip()) > 15]
    if not sentences:
        sentences = [transcript] if transcript else ["No audible dialogue detected in the recording."]

    overview = " ".join(sentences[:3]) + ("..." if len(sentences) > 3 else "")
    key_points = sentences[1:6] if len(sentences) > 5 else sentences[:3]

    # Action item heuristics
    action_keywords = ["will", "should", "need to", "action", "plan", "prepare", "must", "follow up", "schedule", "implement", "deploy", "review"]
    action_items = []
    for s in sentences:
        if any(kw in s.lower() for kw in action_keywords):
            action_items.append(s.strip())
        if len(action_items) >= 4:
            break
    if not action_items and sentences:
        action_items = [f"Review core discussion points: {sentences[0][:60]}..."]

    # Extract keywords
    words = re.findall(r'\b[a-zA-Z]{4,}\b', transcript.lower())
    stop_words = {"about", "there", "their", "which", "would", "could", "should", "people", "really", "because", "something", "talking", "going", "think", "these", "other", "where", "after"}
    freq = {}
    for w in words:
        if w not in stop_words:
            freq[w] = freq.get(w, 0) + 1
    top_keywords = [w.capitalize() for w, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:6]]
    if not top_keywords:
        top_keywords = ["Discussion", "Meeting", "Audio", "Analysis", "Recording"]

    # Build Chapters
    chapters = []
    if segments:
        step = max(1, len(segments) // 4)
        for idx in range(0, len(segments), step):
            seg = segments[idx]
            m, s = divmod(int(seg.get("start", 0)), 60)
            time_str = f"{m:02d}:{s:02d}"
            chapters.append({
                "title": f"Chapter {len(chapters) + 1}: {seg.get('text', '')[:35]}...",
                "start": time_str,
                "description": seg.get('text', '')[:100]
            })
            if len(chapters) >= 5:
                break
    if not chapters:
        chapters = [{"title": "1. Overview & Discussion", "start": "00:00", "description": "Full recording audio track"}]

    notice = "\n\n*(Note: Add your GEMINI_API_KEY in Server-python/.env to enable advanced Generative AI intelligence)*" if not os.getenv("GEMINI_API_KEY") else ""

    return {
        "overview": overview + notice,
        "keyPoints": key_points,
        "actionItems": action_items,
        "sentiment": {
            "label": "Positive",
            "confidence": 0.85,
            "explanation": "Constructive conversational tone with actionable deliverables."
        },
        "keywords": top_keywords,
        "chapters": chapters
    }


# --- Gemini Generative Analysis ---

def generate_gemini_analysis(transcript: str, segments: List[Dict[str, Any]], title: str) -> Dict[str, Any]:
    client = get_gemini_client()
    if not client:
        print("[Gemini] GEMINI_API_KEY is not configured. Using rule-based summarizer.")
        return generate_fallback_summary(transcript, segments, title)

    prompt = f"""You are an expert AI audio and video intelligence analyst.
Analyze the following media transcript for "{title}" and return a STRICT, valid JSON object with comprehensive insights.

Transcript:
\"\"\"
{transcript[:25000]}
\"\"\"

The JSON response MUST match this exact schema:
{{
  "overview": "A comprehensive 2-3 paragraph executive summary of what was discussed, decisions made, and key takeaways.",
  "keyPoints": [
    "Detailed key point 1",
    "Detailed key point 2",
    "Detailed key point 3",
    "Detailed key point 4"
  ],
  "actionItems": [
    "Action item or task 1 with owner or context if mentioned",
    "Action item or task 2",
    "Action item or task 3"
  ],
  "sentiment": {{
    "label": "Positive" | "Neutral" | "Negative",
    "confidence": 0.88,
    "explanation": "Clear explanation of emotional tone and communication dynamics."
  }},
  "keywords": ["Keyword1", "Keyword2", "Keyword3", "Keyword4", "Keyword5"],
  "chapters": [
    {{
      "title": "Short descriptive chapter title",
      "start": "00:14",
      "description": "Brief description of what was discussed in this section"
    }}
  ]
}}

Return ONLY valid JSON.
"""

    models_to_try = [
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]

    for model_name in models_to_try:
        try:
            print(f"[Gemini] Attempting analysis with model: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            raw_text = response.text.strip()
            # Clean possible markdown block
            clean_text = raw_text
            if "```" in clean_text:
                clean_text = re.sub(r"^```(?:json)?\n?", "", clean_text)
                clean_text = re.sub(r"\n?```$", "", clean_text)

            json_match = re.search(r'\{.*\}', clean_text, re.DOTALL)
            if json_match:
                clean_text = json_match.group(0)

            parsed = json.loads(clean_text)
            return parsed
        except Exception as e:
            print(f"[Gemini] Error with model {model_name}: {e}")
            continue

    print("[Gemini] All Gemini model attempts failed or raised errors. Falling back to rule-based summary.")
    return generate_fallback_summary(transcript, segments, title)


# --- Gemini Q&A Chat ---

def generate_gemini_chat_answer(question: str, transcript: str, summary: Optional[Dict[str, Any]], history: Optional[List[Dict[str, Any]]]) -> str:
    client = get_gemini_client()
    if not client:
        # Fallback intelligent answer when GEMINI_API_KEY is blank
        lower_q = question.lower()
        search_terms = [term for term in re.findall(r'\b\w{3,}\b', lower_q) if term not in {"what", "when", "where", "which", "who", "whom", "this", "that", "there", "about", "could", "would"}]
        matched_sentences = []
        for s in re.split(r'[.!?]+', transcript):
            s_clean = s.strip()
            if s_clean and any(t in s_clean.lower() for t in search_terms):
                matched_sentences.append(s_clean)

        if matched_sentences:
            excerpts = "\n- ".join(matched_sentences[:3])
            return (
                f"**Relevant excerpts found in the transcript:**\n- {excerpts}\n\n"
                f"*(Note: Configure `GEMINI_API_KEY` in `Server-python/.env` to unlock deep generative conversational answers powered by Google Gemini!)*"
            )
        return (
            "I could not locate direct mention of this in the recording transcript. "
            "Please configure `GEMINI_API_KEY` in `Server-python/.env` to unlock full conversational AI answers across your audio and video files."
        )

    # Format history context
    history_context = ""
    if history:
        for h in history[-6:]:
            role = "User" if h.get("role") == "user" else "Assistant"
            history_context += f"{role}: {h.get('message', '')}\n"

    overview_text = summary.get("overview", "") if summary else ""

    prompt = f"""You are AudioLens AI, an intelligent audio and video analyst.
Answer the user's follow-up question accurately, concisely, and helpfully using the provided transcript and summary.

Context:
--- TRANSCRIPT ---
{transcript[:30000]}

--- SUMMARY OVERVIEW ---
{overview_text}

--- PREVIOUS CONVERSATION ---
{history_context}

User Question: {question}

Instructions:
1. Ground your answer strictly in the provided audio/video content.
2. If the answer is found in the transcript, explain it clearly with relevant details and timestamps if available.
3. If the audio/video does not mention the topic, politely state that it was not discussed in this recording.
4. Format your answer cleanly with markdown bullet points or bold highlights.
"""

    models_to_try = [
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            print(f"[Gemini Chat] Error with model {model_name}: {e}")
            continue

    return f"Unable to generate AI answer. Please verify your GEMINI_API_KEY in Server-python/.env."


# --- Helper: Obtain Media File Path ---

def resolve_media_file(payload: TranscriptionRequest):
    """
    Returns (path_to_file, should_delete_after_processing)
    """
    # 1. Direct local file on disk
    if payload.local_path and os.path.exists(payload.local_path):
        return payload.local_path, False

    media_url = str(payload.file_url).strip()
    if os.path.exists(media_url):
        return media_url, False

    # 2. Remote URL (AWS S3 public/presigned or local HTTP URL)
    url_path = media_url.split("?")[0]
    ext = os.path.splitext(url_path)[1] or ".tmp"

    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as temp_file:
        temp_path = temp_file.name
        with requests.get(media_url, stream=True, timeout=180) as resp:
            resp.raise_for_status()
            for chunk in resp.iter_content(chunk_size=16384):
                temp_file.write(chunk)
        return temp_path, True


# --- API Routes ---

@app.get("/api/v1/health")
def health_check():
    has_gemini = bool(os.getenv("GEMINI_API_KEY", "").strip())
    has_s3 = bool(os.getenv("AWS_ACCESS_KEY_ID", "").strip() and os.getenv("AWS_BUCKET_NAME", "").strip())
    return {
        "status": "healthy",
        "service": "AudioLens Python AI Service",
        "whisper_model": MODEL_SIZE,
        "device": DEVICE,
        "compute_type": COMPUTE_TYPE,
        "gemini_configured": has_gemini,
        "s3_configured": has_s3,
    }

@app.get("/api/v1/root")
def handle_root():
    return {"message": "AudioLens Python AI Backend is running"}

@app.post("/api/v1/transcribe-url")
def transcribe_from_url(payload: TranscriptionRequest):
    """
    Transcribes audio or video media into text using Whisper.
    """
    temp_path = None
    cleanup = False
    try:
        temp_path, cleanup = resolve_media_file(payload)

        whisper = get_whisper_model()
        segments, info = whisper.transcribe(
            temp_path,
            beam_size=5,
            vad_filter=True
        )

        transcription_segments = []
        full_text = []

        for seg in segments:
            clean = seg.text.strip()
            if clean:
                full_text.append(clean)
                transcription_segments.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": clean
                })

        return JSONResponse({
            "status": "success",
            "detected_language": info.language,
            "language_probability": round(info.language_probability, 4),
            "duration_seconds": round(info.duration, 2),
            "text": " ".join(full_text),
            "segments": transcription_segments
        })

    except requests.exceptions.RequestException as req_err:
        raise HTTPException(status_code=400, detail=f"Failed to fetch media from URL: {str(req_err)}")
    except Exception as e:
        print(f"[Transcribe Error] {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    finally:
        if cleanup and temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/api/v1/analyze")
def analyze_transcript(payload: AnalysisRequest):
    """
    Analyzes text transcript and produces structured intelligence with Gemini API.
    """
    summary = generate_gemini_analysis(payload.transcript, [], payload.title or "Recording")
    return {"status": "success", "summary": summary}

@app.post("/api/v1/process")
def process_full_pipeline(payload: TranscriptionRequest):
    """
    Complete end-to-end pipeline:
    1. Obtains media file (from AWS S3, HTTP, or local storage)
    2. Transcribes speech and separates segments using Whisper AI
    3. Analyzes and summarizes using Google Gemini API
    4. Returns complete intelligence package
    """
    temp_path = None
    cleanup = False
    try:
        temp_path, cleanup = resolve_media_file(payload)

        print(f"[Pipeline] Transcribing media file: {temp_path}")
        whisper = get_whisper_model()
        segments, info = whisper.transcribe(
            temp_path,
            beam_size=5,
            vad_filter=True
        )

        transcription_segments = []
        full_text = []

        for seg in segments:
            clean = seg.text.strip()
            if clean:
                full_text.append(clean)
                transcription_segments.append({
                    "start": round(seg.start, 2),
                    "end": round(seg.end, 2),
                    "text": clean
                })

        combined_text = " ".join(full_text)
        if not combined_text:
            combined_text = "No audible spoken dialogue detected in the media file."

        print(f"[Pipeline] Transcription complete ({len(transcription_segments)} segments). Running Gemini analysis...")
        summary = generate_gemini_analysis(combined_text, transcription_segments, payload.title or "Recording")

        return JSONResponse({
            "status": "success",
            "detected_language": info.language,
            "language_probability": round(info.language_probability, 4),
            "duration_seconds": round(info.duration, 2),
            "text": combined_text,
            "segments": transcription_segments,
            "summary": summary
        })

    except requests.exceptions.RequestException as req_err:
        raise HTTPException(status_code=400, detail=f"Failed to fetch media file: {str(req_err)}")
    except Exception as e:
        print(f"[Pipeline Error] {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    finally:
        if cleanup and temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/api/v1/chat")
def chat_follow_up(payload: ChatRequest):
    """
    Answers user follow-up questions grounded in the audio/video content using Gemini API.
    """
    answer = generate_gemini_chat_answer(
        question=payload.question,
        transcript=payload.transcript,
        summary=payload.summary,
        history=payload.history or []
    )
    return {
        "status": "success",
        "question": payload.question,
        "answer": answer
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)