/**
 * AudioLens - Core Script Orchestrator
 * Loads modular business logic components:
 * - js/ui.js: UI helpers, formatting, toasts, markdown
 * - js/api.js: Node/Python backend API communication
 * - js/auth.js: Auth state, modal, registration & OTP flow
 * - js/recorder.js: MediaRecorder microphone helper
 * - js/analyzer.js: Upload, drag & drop, analysis submission
 * - js/history.js: History view, search, deletion
 * - js/processing.js: Polling & animated progress
 * - js/results.js: Player, waveform, transcript & Gemini Q&A
 */

(function () {
  const scripts = [
    "js/ui.js",
    "js/api.js",
    "js/auth.js",
    "js/recorder.js",
    "js/analyzer.js",
    "js/history.js",
    "js/processing.js",
    "js/results.js",
  ];

  scripts.forEach((src) => {
    // Check if script is already present in document
    const exists = document.querySelector(`script[src="${src}"]`) || document.querySelector(`script[src="./${src}"]`);
    if (!exists) {
      const scriptEl = document.createElement("script");
      scriptEl.src = src;
      scriptEl.async = false;
      document.head.appendChild(scriptEl);
    }
  });
})();
