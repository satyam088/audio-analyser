/**
 * AudioLens - Intelligence Dashboard & Results Controller
 * Handles interactive audio/video playback, transcript timeline seeking,
 * executive summaries, Gemini chat Q&A, and report exports.
 */

let currentAnalysis = null;
let activeMediaElement = null;
let isPlaying = false;

async function initResults() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    try {
      const list = await fetchAllAnalyses();
      if (list && list.length > 0) {
        window.location.replace(`results.html?id=${list[0]._id}`);
        return;
      }
    } catch (e) {}
    showToast("No analysis ID specified. Please select a recording from History.", "warning");
    const titleEl = document.getElementById("analysisTitle");
    if (titleEl) titleEl.textContent = "No Analysis Selected";
    return;
  }

  try {
    currentAnalysis = await fetchAnalysisById(id);
    renderAnalysisData(currentAnalysis);
  } catch (err) {
    showToast(err.message, "error");
    const titleEl = document.getElementById("analysisTitle");
    if (titleEl) titleEl.textContent = "Error Loading Recording";
  }
}

function renderAnalysisData(data) {
  if (!data) return;

  // Title and metadata
  const titleEl = document.getElementById("analysisTitle");
  const metaEl = document.getElementById("analysisMeta");
  if (titleEl) titleEl.textContent = data.title || data.originalFileName || "Untitled Analysis";
  if (metaEl) {
    metaEl.textContent = `${data.originalFileName || "media"} • ${formatFileSize(data.fileSize || 0)} • ${formatDate(data.createdAt)} • Status: ${data.status}`;
  }

  // KPIs
  const sentimentVal = document.getElementById("sentimentValue");
  const sentimentDesc = document.getElementById("sentimentDesc");
  const sentimentPill = document.getElementById("sentimentPill");
  if (data.summary?.sentiment) {
    if (sentimentVal) sentimentVal.textContent = data.summary.sentiment.label || "Neutral";
    if (sentimentDesc) sentimentDesc.textContent = data.summary.sentiment.explanation || "Overall emotional tone";
    if (sentimentPill) {
      const s = (data.summary.sentiment.label || "").toLowerCase();
      sentimentPill.className = s.includes("pos")
        ? "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800"
        : s.includes("neg")
        ? "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800"
        : "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700";
    }
  }

  const speakersCount = document.getElementById("speakersCount");
  const speakersDesc = document.getElementById("speakersDesc");
  const uniqueSpeakers = [...new Set((data.segments || []).map((s) => s.speaker).filter(Boolean))];
  if (speakersCount) speakersCount.textContent = uniqueSpeakers.length ? `${uniqueSpeakers.length} Detected` : "1 Speaker";
  if (speakersDesc) speakersDesc.textContent = uniqueSpeakers.length ? uniqueSpeakers.join(", ") : "Single presenter";

  const languageVal = document.getElementById("languageValue");
  const keywordsSummary = document.getElementById("keywordsSummary");
  if (languageVal) languageVal.textContent = (data.language || "en").toUpperCase();
  if (keywordsSummary) {
    const kws = data.summary?.keywords || [];
    keywordsSummary.textContent = kws.length ? kws.slice(0, 3).join(", ") : "English Speech";
  }

  // Duration
  const durBadge = document.getElementById("durationBadge");
  const timeTotal = document.getElementById("timeTotal");
  if (durBadge) durBadge.textContent = formatDuration(data.duration || 0);
  if (timeTotal) timeTotal.textContent = formatDuration(data.duration || 0);

  // Setup Media Player (Audio vs Video)
  setupMediaPlayer(data);

  // Render Transcript
  renderTranscript(data.segments || []);

  // Render AI Summary & Action Items
  renderSummarySection(data.summary || {});

  // Render Topics & Sentiment
  renderTopicsAndSentiment(data.summary || {});

  // Render Initial Chat
  renderChatHistory(data.chatHistory || []);
}

function setupMediaPlayer(data) {
  const audioEl = document.getElementById("audioPlayer");
  const videoEl = document.getElementById("videoPlayer");
  const fileUrl = data.s3Url || (data.localPath ? `${API_BASE}/${data.localPath.replace(/\\/g, "/")}` : "");

  const isVideo = data.mediaType === "video" || /\.(mp4|mov|avi|mkv|webm)$/i.test(data.originalFileName || "");

  if (isVideo && videoEl) {
    videoEl.src = fileUrl;
    videoEl.classList.remove("hidden");
    if (audioEl) audioEl.classList.add("hidden");
    activeMediaElement = videoEl;
  } else if (audioEl) {
    audioEl.src = fileUrl;
    audioEl.classList.remove("hidden");
    if (videoEl) videoEl.classList.add("hidden");
    activeMediaElement = audioEl;
  }

  if (activeMediaElement) {
    activeMediaElement.ontimeupdate = handleTimeUpdate;
    activeMediaElement.onended = () => {
      isPlaying = false;
      const btn = document.getElementById("playPauseBtn");
      if (btn) btn.textContent = "▶ Play";
    };
  }

  generateWaveformBars(data.duration || 120);
}

function generateWaveformBars(duration) {
  const container = document.getElementById("waveBarContainer");
  if (!container) return;
  container.innerHTML = "";

  const barCount = 60;
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement("div");
    bar.className = "flex-1 min-w-[3px] bg-slate-300 hover:bg-[#856cc1] rounded-full transition-all duration-150 cursor-pointer";
    const heightPercent = Math.floor(Math.sin(i / 3) * 35 + Math.random() * 45 + 20);
    bar.style.height = `${Math.min(100, Math.max(15, heightPercent))}%`;
    bar.dataset.time = (i / barCount) * duration;

    bar.addEventListener("click", () => {
      seekToTime((i / barCount) * duration);
    });

    container.appendChild(bar);
  }
}

function handleTimeUpdate() {
  if (!activeMediaElement) return;
  const current = activeMediaElement.currentTime;
  const total = activeMediaElement.duration || currentAnalysis?.duration || 1;

  const currentLabel = document.getElementById("timeCurrent");
  if (currentLabel) currentLabel.textContent = formatDuration(current);

  const container = document.getElementById("waveBarContainer");
  if (container) {
    const bars = container.children;
    const activeIndex = Math.floor((current / total) * bars.length);
    for (let i = 0; i < bars.length; i++) {
      if (i <= activeIndex) {
        bars[i].className = "flex-1 min-w-[3px] bg-gradient-to-t from-[#856cc1] to-[#e6a3aa] rounded-full transition-all duration-150 cursor-pointer";
      } else {
        bars[i].className = "flex-1 min-w-[3px] bg-slate-300 hover:bg-[#856cc1] rounded-full transition-all duration-150 cursor-pointer";
      }
    }
  }

  // Highlight active segment
  highlightActiveSegment(current);
}

function highlightActiveSegment(currentTime) {
  const items = document.querySelectorAll(".transcript-segment-row");
  items.forEach((row) => {
    const start = parseFloat(row.dataset.start || 0);
    const end = parseFloat(row.dataset.end || 0);
    if (currentTime >= start && currentTime <= end) {
      row.classList.add("bg-purple-50", "border-purple-300");
    } else {
      row.classList.remove("bg-purple-50", "border-purple-300");
    }
  });
}

function togglePlayPause() {
  if (!activeMediaElement) return;
  const btn = document.getElementById("playPauseBtn");

  if (activeMediaElement.paused) {
    activeMediaElement.play();
    isPlaying = true;
    if (btn) btn.textContent = "⏸ Pause";
  } else {
    activeMediaElement.pause();
    isPlaying = false;
    if (btn) btn.textContent = "▶ Play";
  }
}

function seekToTime(seconds) {
  if (activeMediaElement) {
    activeMediaElement.currentTime = seconds;
    if (activeMediaElement.paused) {
      activeMediaElement.play().catch(() => {});
      const btn = document.getElementById("playPauseBtn");
      if (btn) btn.textContent = "⏸ Pause";
    }
  }
}

// --- Transcript Rendering ---

function renderTranscript(segments) {
  const list = document.getElementById("segmentsList");
  if (!list) return;
  list.innerHTML = "";

  if (!segments.length) {
    list.innerHTML = '<p class="text-xs text-slate-500 py-6 text-center">No transcript available for this recording.</p>';
    return;
  }

  segments.forEach((seg, idx) => {
    const row = document.createElement("div");
    row.className = "transcript-segment-row p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-all mb-2 cursor-pointer flex gap-3";
    row.dataset.start = seg.start || 0;
    row.dataset.end = seg.end || 0;

    const speakerColor = idx % 2 === 0 ? "bg-purple-100 text-purple-700" : "bg-pink-100 text-pink-700";

    row.innerHTML = `
      <div class="shrink-0 flex flex-col items-center">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${speakerColor}">${escapeHtml(seg.speaker || "Speaker")}</span>
        <span class="text-[10px] font-mono text-slate-400 mt-1 hover:text-[#795ebd]">${formatDuration(seg.start)}</span>
      </div>
      <div class="flex-1 text-xs text-slate-700 leading-relaxed font-sans">
        ${escapeHtml(seg.text || "")}
      </div>
    `;

    row.addEventListener("click", () => {
      seekToTime(seg.start || 0);
    });

    list.appendChild(row);
  });
}

function filterTranscript() {
  const q = document.getElementById("transcriptSearch")?.value.toLowerCase().trim() || "";
  const rows = document.querySelectorAll(".transcript-segment-row");

  rows.forEach((row) => {
    const text = row.textContent.toLowerCase();
    if (!q || text.includes(q)) {
      row.style.display = "flex";
    } else {
      row.style.display = "none";
    }
  });
}

function copyTranscript() {
  if (!currentAnalysis?.segments) return;
  const fullText = currentAnalysis.segments
    .map((s) => `[${formatDuration(s.start)}] ${s.speaker || "Speaker"}: ${s.text}`)
    .join("\n");

  navigator.clipboard.writeText(fullText).then(() => {
    showToast("Full transcript copied to clipboard!", "success");
  });
}

// --- Summary & Action Items ---

function renderSummarySection(summary) {
  const overviewEl = document.getElementById("summaryOverview");
  if (overviewEl) overviewEl.textContent = summary.overview || "No executive summary available.";

  const pointsList = document.getElementById("keyPointsList");
  if (pointsList) {
    pointsList.innerHTML = "";
    (summary.keyPoints || []).forEach((kp) => {
      const li = document.createElement("li");
      li.className = "mb-2 pl-1 leading-relaxed";
      li.textContent = kp;
      pointsList.appendChild(li);
    });
  }

  const actionList = document.getElementById("actionItemsList");
  if (actionList) {
    actionList.innerHTML = "";
    (summary.actionItems || []).forEach((item) => {
      const div = document.createElement("div");
      div.className = "flex items-start gap-2.5 p-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 shadow-sm";
      div.innerHTML = `<span class="text-purple-600 mt-0.5">✔</span> <span>${escapeHtml(item)}</span>`;
      actionList.appendChild(div);
    });
    if (!summary.actionItems || !summary.actionItems.length) {
      actionList.innerHTML = '<p class="text-xs text-slate-400">No specific action items detected.</p>';
    }
  }

  const chList = document.getElementById("chaptersList");
  if (chList) {
    chList.innerHTML = "";
    (summary.chapters || []).forEach((ch) => {
      const row = document.createElement("div");
      row.className = "flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg text-xs cursor-pointer hover:border-purple-300 transition-all shadow-sm";
      row.innerHTML = `
        <b class="text-slate-700">${escapeHtml(ch.title || "Chapter")}</b>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-50 text-purple-700 border border-purple-200">${escapeHtml(ch.start || "00:00")}</span>
      `;
      row.onclick = () => {
        const parts = (ch.start || "0:0").split(":");
        const secs = parseInt(parts[0] || 0) * 60 + parseInt(parts[1] || 0);
        seekToTime(secs);
      };
      chList.appendChild(row);
    });
  }
}

function renderTopicsAndSentiment(summary) {
  if (!summary) return;
  const sentiment = summary.sentiment || {};
  const tag = document.getElementById("sentimentTag");
  const conf = document.getElementById("sentimentConfidence");
  const expl = document.getElementById("sentimentExplanation");

  if (tag) tag.textContent = sentiment.label || "Positive";
  if (conf) conf.textContent = `Confidence: ${Math.round((sentiment.confidence || 0.85) * 100)}%`;
  if (expl) expl.textContent = sentiment.explanation || "Conversational tone is balanced.";

  const cloud = document.getElementById("keywordsCloud");
  if (cloud) {
    cloud.innerHTML = "";
    (summary.keywords || []).forEach((kw) => {
      const chip = document.createElement("span");
      chip.className = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 cursor-pointer transition-colors";
      chip.textContent = kw;
      chip.onclick = () => {
        switchTab("transcriptTab", document.querySelectorAll(".tab-btn")[0]);
        const searchInput = document.getElementById("transcriptSearch");
        if (searchInput) {
          searchInput.value = kw;
          filterTranscript();
        }
      };
      cloud.appendChild(chip);
    });
  }
}

// --- Gemini Interactive Q&A Chat ---

function renderChatHistory(messages) {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  container.innerHTML = `
    <div class="chat-bubble assistant p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 text-xs text-slate-800 max-w-lg leading-relaxed shadow-sm">
      <p>👋 Hello! I have analyzed the entire recording for <strong>${escapeHtml(currentAnalysis?.title || "this file")}</strong>. What would you like to know?</p>
    </div>
  `;

  messages.forEach((msg) => {
    appendChatMessage(msg.role, msg.message);
  });
}

function appendChatMessage(role, text) {
  const container = document.getElementById("chatMessages");
  if (!container) return null;
  const bubble = document.createElement("div");
  const isUser = role === "user";

  bubble.className = isUser
    ? "chat-bubble user p-3 rounded-2xl bg-[#20233d] text-white text-xs max-w-lg ml-auto leading-relaxed shadow-sm"
    : "chat-bubble assistant p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-800 max-w-lg leading-relaxed shadow-sm";

  bubble.innerHTML = renderSimpleMarkdown(text);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function sendQuickPrompt(promptText) {
  switchTab("chatTab", document.querySelectorAll(".tab-btn")[2]);
  const input = document.getElementById("chatQuestionInput");
  if (input) {
    input.value = promptText;
    handleSendQuestion();
  }
}

async function handleSendQuestion(e) {
  if (e) e.preventDefault();
  const input = document.getElementById("chatQuestionInput");
  const question = input ? input.value.trim() : "";
  if (!question || !currentAnalysis) return;

  if (input) input.value = "";
  appendChatMessage("user", question);

  const container = document.getElementById("chatMessages");
  const thinkingBubble = document.createElement("div");
  thinkingBubble.className = "chat-bubble assistant p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 max-w-xs flex items-center gap-2";
  thinkingBubble.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-purple-500 animate-ping"></span><span>Analyzing recording with Gemini AI...</span>';
  if (container) {
    container.appendChild(thinkingBubble);
    container.scrollTop = container.scrollHeight;
  }

  const sendBtn = document.getElementById("chatSendBtn");
  if (sendBtn) sendBtn.disabled = true;

  try {
    const res = await askFollowUpQuestion(currentAnalysis._id, question);
    thinkingBubble.remove();
    appendChatMessage("assistant", res.answer || "No response generated.");
  } catch (err) {
    thinkingBubble.remove();
    appendChatMessage("assistant", `⚠️ ${err.message}`);
    showToast(err.message, "error");
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

// --- Export Analysis ---

function exportAnalysis(format) {
  if (!currentAnalysis) return;
  let content = "";
  let mime = "text/plain";
  let ext = "txt";

  if (format === "json") {
    content = JSON.stringify(currentAnalysis, null, 2);
    mime = "application/json";
    ext = "json";
  } else {
    content = `AUDIOLENS AI REPORT: ${currentAnalysis.title}\n`;
    content += `File: ${currentAnalysis.originalFileName}\n`;
    content += `Duration: ${formatDuration(currentAnalysis.duration)}\n`;
    content += `Sentiment: ${currentAnalysis.summary?.sentiment?.label || "Positive"}\n\n`;
    content += `--- EXECUTIVE OVERVIEW ---\n${currentAnalysis.summary?.overview || ""}\n\n`;
    content += `--- KEY POINTS ---\n${(currentAnalysis.summary?.keyPoints || []).join("\n• ")}\n\n`;
    content += `--- ACTION ITEMS ---\n${(currentAnalysis.summary?.actionItems || []).join("\n[ ] ")}\n\n`;
    content += `--- FULL TRANSCRIPT ---\n`;
    (currentAnalysis.segments || []).forEach((s) => {
      content += `[${formatDuration(s.start)}] ${s.speaker || "Speaker"}: ${s.text}\n`;
    });
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audiolens-${(currentAnalysis.title || "report").toLowerCase().replace(/\\s+/g, "-")}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported report as .${ext}`, "success");
}

// Expose globals
window.initResults = initResults;
window.togglePlayPause = togglePlayPause;
window.seekToTime = seekToTime;
window.filterTranscript = filterTranscript;
window.copyTranscript = copyTranscript;
window.sendQuickPrompt = sendQuickPrompt;
window.handleSendQuestion = handleSendQuestion;
window.exportAnalysis = exportAnalysis;

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("analysisTitle")) {
    initResults();
  }
});
