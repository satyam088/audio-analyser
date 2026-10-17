# Audio Lens 
### AI-Powered Audio Transcription & Analysis

Audio Lens is an AI-powered application that transforms audio into text and generates meaningful insights using speech recognition and Large Language Models (LLMs).

The project combines **OpenAI Whisper** for speech-to-text transcription with the **Gemini API** for AI-powered transcript analysis.

## How It Works

```text
        Audio Input
             |
             v
      Audio Preprocessing
             |
             v
    Whisper Transcription
             |
             v
     Transcript Processing
             |
             v
      Gemini LLM Analysis
             |
             v
       Generated Insights
```

## Key Features

- **Speech-to-Text:** Transcribes audio using OpenAI Whisper.
- **AI-Powered Analysis:** Uses the Gemini API to analyze the generated transcript.
- **End-to-End Pipeline:** Connects audio input, transcription, and LLM analysis in a single workflow.
- **Local Inference:** Supports local Whisper model inference without requiring a dedicated cloud GPU server.

## Tech Stack

- **Speech Recognition:** OpenAI Whisper
- **LLM Integration:** Google Gemini API
- **Backend:** Python and the technologies used in the project's server components
- **Frontend:** Technologies used in the client application

## Project Structure

```text
audio-analyser/
├── client/          # Client-side application
├── server/          # Main backend server
├── Server-python/   # Python audio processing and inference
└── README.md
```

## Getting Started

Audio Lens is currently designed to run locally. Follow the setup instructions for each component in its respective directory.

1. Clone the repository.
2. Install the required dependencies for the client and server components.
3. Configure the required environment variables, including your Gemini API key.
4. Start the application components in the required order.
5. Provide an audio file and run the transcription and analysis pipeline.

Refer to the individual project directories for component-specific setup instructions.

## Current Status

- Audio transcription and LLM-based analysis have been tested locally.
- Full cloud deployment is not currently available because of the computational requirements of audio inference.

## Future Improvements

- Optimize audio inference and resource consumption.
- Improve error handling and processing reliability.
- Explore cost-effective deployment options.
- Add more structured analysis outputs and evaluation methods.

## Contributors

- **Satyam Chauhan**  
  [@satym088](https://github.com/satym088)

- **Sheetal Katiyar**  
  [@sheetal-in](https://github.com/sheetal-in)


---

*Audio Lens — Turning audio into actionable insights.*
