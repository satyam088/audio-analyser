/**
 * AudioLens - Processing Page Controller
 * Manages live progress polling, animated progress bar, and multi-stage status indicator.
 */

let progress = 15;
let pollTimer = null;
let animTimer = null;

const stages = [
  "Preparing media stream...",
  "Transcribing audio with Whisper AI...",
  "Detecting speakers and dialogue...",
  "Generating Gemini executive summary...",
  "Structuring action items and chapters...",
  "Finalizing intelligence dashboard..."
];

function initProcessing() {
  const urlParams = new URLSearchParams(window.location.search);
  const analysisId = urlParams.get("id");

  const bar = document.getElementById("bar");
  const percent = document.getElementById("percent");
  const stage = document.getElementById("stage");
  const actionArea = document.getElementById("actionArea");

  // Animate progress smoothly while waiting for background AI
  animTimer = setInterval(() => {
    if (progress < 90) {
      progress += Math.floor(Math.random() * 8) + 2;
      progress = Math.min(progress, 90);
      if (bar) bar.style.width = `${progress}%`;
      if (percent) percent.textContent = `${progress}%`;
      const stageIdx = Math.min(Math.floor((progress / 90) * stages.length), stages.length - 1);
      if (stage) stage.textContent = stages[stageIdx];
    }
  }, 750);

  async function checkStatus() {
    if (!analysisId) {
      setTimeout(() => {
        window.location.href = "analyzer.html";
      }, 2500);
      return;
    }

    try {
      const analysis = await fetchAnalysisById(analysisId);

      if (analysis.status === "completed") {
        clearInterval(animTimer);
        clearInterval(pollTimer);
        if (bar) {
          bar.style.width = "100%";
          bar.className = "h-full bg-emerald-500 rounded-full transition-all duration-300";
        }
        if (percent) percent.textContent = "100%";
        if (stage) stage.textContent = "Analysis complete! Redirecting...";
        setTimeout(() => {
          window.location.href = `results.html?id=${analysis._id}`;
        }, 600);
      } else if (analysis.status === "failed") {
        clearInterval(animTimer);
        clearInterval(pollTimer);
        if (bar) {
          bar.className = "h-full bg-rose-500 rounded-full";
        }
        if (stage) stage.textContent = "Analysis failed";
        if (actionArea) {
          actionArea.innerHTML = `
            <div class="bg-rose-50 border border-rose-200 p-4 rounded-xl text-rose-800 text-xs mb-4 text-left">
              <strong>Error:</strong> ${escapeHtml(analysis.errorMessage || "Audio/video processing encountered an unexpected error.")}
            </div>
            <a class="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#20233d] hover:bg-[#34384d] text-white text-xs font-semibold shadow-md transition-all" href="analyzer.html">Try Another File →</a>
          `;
        }
      }
    } catch (err) {
      console.warn("Poll error:", err.message);
    }
  }

  if (analysisId) {
    pollTimer = setInterval(checkStatus, 2000);
    checkStatus();
  }
}

// Expose globals
window.initProcessing = initProcessing;

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("bar") && document.getElementById("stage")) {
    initProcessing();
  }
});
