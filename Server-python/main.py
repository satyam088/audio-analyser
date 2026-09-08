import tempfile
import os
import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, HttpUrl
from faster_whisper import WhisperModel

app = FastAPI(title="URL Media Transcription API")

# Load model on startup
MODEL_SIZE = "base"
DEVICE = "cpu"  # Set to "cuda" if using NVIDIA GPU
COMPUTE_TYPE = "int8"

print("Loading Whisper model into memory...")
model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
print("Model loaded successfully!")


class TranscriptionRequest(BaseModel):
    file_url: HttpUrl


@app.get("/api/v1/root")
def handleRoot():
    return { "msg" : "Got your request"}
@app.post("/api/v1/transcribe-url")
def transcribe_from_url(payload: TranscriptionRequest):
    """
    Accepts an S3 public or presigned HTTP/HTTPS URL, downloads the 
    media file locally, and runs transcription.
    """
    media_url = str(payload.file_url)
    
    # Extract file extension from URL path for the temp file
    url_path = media_url.split('?')[0]  # Remove query params (crucial for presigned URLs)
    file_extension = os.path.splitext(url_path)[1] or ".tmp"

    try:
        # 1. Stream file directly from S3 URL into a local temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            temp_path = temp_file.name
            
            # Using stream=True prevents loading large video files entirely into RAM
            with requests.get(media_url, stream=True, timeout=60) as response:
                response.raise_for_status()
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)

        # 2. Transcribe local video/audio file
        segments, info = model.transcribe(
            temp_path, 
            beam_size=5, 
            vad_filter=True
        )

        # 3. Format response
        transcription_segments = []
        full_text = []

        for segment in segments:
            full_text.append(segment.text.strip())
            transcription_segments.append({
                "start": round(segment.start, 2),
                "end": round(segment.end, 2),
                "text": segment.text.strip()
            })

        # 4. Clean up temporary file
        os.remove(temp_path)

        return JSONResponse({
            "status": "success",
            "detected_language": info.language,
            "language_probability": round(info.language_probability, 4),
            "duration_seconds": round(info.duration, 2),
            "text": " ".join(full_text),
            "segments": transcription_segments
        })

    except requests.exceptions.RequestException as req_err:
        raise HTTPException(status_code=400, detail=f"Failed to download media from S3 URL: {str(req_err)}")
    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)