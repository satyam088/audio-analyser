/**
 * AudioLens - Analyzer Page Controller
 * Manages media file selection, drag & drop, live mic recording, and upload workflow.
 */

let currentFile = null;
let isRecording = false;

function initAnalyzer() {
  const dropZone = document.getElementById("dropZone");
  const mediaInput = document.getElementById("mediaFile");

  if (mediaInput) {
    mediaInput.addEventListener("change", function () {
      if (this.files.length) {
        selectFile(this.files[0]);
      }
    });
  }

  if (dropZone) {
    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.classList.add("border-[#856cc1]", "bg-purple-50/60");
      dropZone.classList.remove("border-slate-300", "bg-slate-50/60");
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.classList.remove("border-[#856cc1]", "bg-purple-50/60");
      dropZone.classList.add("border-slate-300", "bg-slate-50/60");
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.classList.remove("border-[#856cc1]", "bg-purple-50/60");
      dropZone.classList.add("border-slate-300", "bg-slate-50/60");
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        selectFile(e.dataTransfer.files[0]);
      }
    });
  }
}

function selectFile(file) {
  currentFile = file;
  const selectedFileName = document.getElementById("selectedFileName");
  const selectedFileSize = document.getElementById("selectedFileSize");
  const fileCard = document.getElementById("fileCard");
  const fileTypeIcon = document.getElementById("fileTypeIcon");

  if (selectedFileName) selectedFileName.textContent = file.name;
  if (selectedFileSize) selectedFileSize.textContent = formatFileSize(file.size);

  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/i.test(file.name);
  if (fileTypeIcon) fileTypeIcon.textContent = isVideo ? "🎬" : "🎵";

  if (fileCard) {
    fileCard.classList.remove("hidden");
    fileCard.classList.add("flex");
  }

  showToast(`Loaded: ${file.name}`, "info");
}

function clearSelectedFile() {
  currentFile = null;
  const mediaInput = document.getElementById("mediaFile");
  if (mediaInput) mediaInput.value = "";
  const fileCard = document.getElementById("fileCard");
  if (fileCard) {
    fileCard.classList.add("hidden");
    fileCard.classList.remove("flex");
  }
}

// Microphone live recording
async function toggleRecording() {
  const btn = document.getElementById("recordBtn");
  const indicator = document.getElementById("micIndicator");
  const status = document.getElementById("recordStatus");

  if (!isRecording) {
    try {
      await startMicrophoneRecording((elapsed) => {
        if (status) status.textContent = `Recording audio... ${formatDuration(elapsed)}`;
      });
      isRecording = true;
      if (btn) {
        btn.textContent = "Stop & Use Recording";
        btn.className = "inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 border border-rose-300 text-rose-600 hover:bg-rose-100 transition-all";
      }
      if (indicator) {
        indicator.className = "w-9 h-9 rounded-lg bg-rose-500 text-white grid place-items-center text-sm animate-pulse";
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  } else {
    if (status) status.textContent = "Finalizing recorded audio...";
    const recordedFile = await stopMicrophoneRecording();
    isRecording = false;

    if (btn) {
      btn.textContent = "Start Recording";
      btn.className = "inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:border-[#856cc1] hover:text-[#6958a9] transition-all";
    }
    if (indicator) {
      indicator.className = "w-9 h-9 rounded-lg bg-rose-50 text-rose-500 grid place-items-center text-sm";
    }
    if (status) status.textContent = "Use your microphone to record audio directly";

    if (recordedFile) {
      selectFile(recordedFile);
    }
  }
}

// Start Analysis & Upload
async function handleStartAnalysis() {
  if (!currentFile) {
    showToast("Please choose an audio or video file first.", "error");
    return;
  }

  const titleInput = document.getElementById("customTitle");
  const title = titleInput ? titleInput.value.trim() : "";

  const submitBtn = document.getElementById("submitBtn");
  const progressSection = document.getElementById("uploadProgressSection");
  const progressBar = document.getElementById("progressBar");
  const progressPercent = document.getElementById("progressPercent");
  const progressLabel = document.getElementById("progressLabel");
  const progressHint = document.getElementById("progressHint");

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-60", "cursor-not-allowed");
    submitBtn.textContent = "Processing Recording...";
  }

  if (progressSection) progressSection.classList.remove("hidden");
  if (progressPercent) progressPercent.textContent = "0%";
  if (progressBar) progressBar.style.width = "0%";
  if (progressLabel) progressLabel.textContent = "Uploading media to server...";

  try {
    const result = await uploadMedia(currentFile, title, (percent) => {
      if (progressBar) progressBar.style.width = `${percent}%`;
      if (progressPercent) progressPercent.textContent = `${percent}%`;
      if (percent >= 100 && progressLabel) {
        progressLabel.textContent = "Transcribing with Whisper AI...";
        if (progressHint) progressHint.textContent = "Extracting dialogue and computing Gemini intelligence summary...";
      }
    });

    showToast("Analysis complete! Opening dashboard...", "success");
    const analysisId = result.analysis?._id;
    if (analysisId) {
      window.location.href = `results.html?id=${analysisId}`;
    } else {
      window.location.href = "results.html";
    }
  } catch (err) {
    showToast(err.message, "error");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-60", "cursor-not-allowed");
      submitBtn.textContent = "Start AI Analysis →";
    }
    if (progressLabel) progressLabel.textContent = "Failed";
    if (progressHint) progressHint.textContent = err.message;
  }
}

// Home page quick drop upload
async function handleHomeUpload(file) {
  showToast(`Uploading ${file.name}...`, "info");
  const homeDropZone = document.getElementById("homeDropZone");
  const uploadBoxH3 = homeDropZone?.querySelector("h3");
  const originalText = uploadBoxH3 ? uploadBoxH3.textContent : "Drop your audio or video here";
  if (uploadBoxH3) uploadBoxH3.textContent = `Analyzing ${file.name}...`;

  try {
    const result = await uploadMedia(file, "", (percent) => {
      if (uploadBoxH3) uploadBoxH3.textContent = `Analyzing ${percent}%...`;
    });
    showToast("Analysis complete! Opening report...", "success");
    if (result.analysis?._id) {
      window.location.href = `results.html?id=${result.analysis._id}`;
    } else {
      window.location.href = "results.html";
    }
  } catch (err) {
    showToast(err.message, "error");
    if (uploadBoxH3) uploadBoxH3.textContent = originalText;
  }
}

// Expose globals
window.initAnalyzer = initAnalyzer;
window.selectFile = selectFile;
window.clearSelectedFile = clearSelectedFile;
window.toggleRecording = toggleRecording;
window.handleStartAnalysis = handleStartAnalysis;
window.handleHomeUpload = handleHomeUpload;

document.addEventListener("DOMContentLoaded", () => {
  initAnalyzer();
});
