/**
 * AudioLens - Recording History Controller
 * Manages fetching, searching, status filtering, table display, and deletion of past analyses.
 */

let allAnalyses = [];

async function loadHistory() {
  const loading = document.getElementById("loadingState");
  const empty = document.getElementById("emptyState");
  const table = document.getElementById("historyTable");

  try {
    const list = await fetchAllAnalyses();
    allAnalyses = list || [];
    if (loading) loading.classList.add("hidden");

    if (!allAnalyses.length) {
      if (empty) empty.classList.remove("hidden");
      if (table) table.classList.add("hidden");
    } else {
      if (empty) empty.classList.add("hidden");
      if (table) table.classList.remove("hidden");
      renderTableRows(allAnalyses);
    }
  } catch (err) {
    if (loading) loading.textContent = `Error loading history: ${err.message}`;
    showToast(err.message, "error");
  }
}

function renderTableRows(items) {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-slate-500 py-8 text-xs font-medium">No matching recordings found.</td></tr>';
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-slate-100 hover:bg-slate-50/70 transition-colors";
    const isVideo = item.mediaType === "video" || /\.(mp4|mov|avi|mkv|webm)$/i.test(item.originalFileName || "");
    const icon = isVideo ? "🎬" : "🎵";

    let statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed</span>`;
    if (item.status === "processing" || item.status === "pending") {
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">Processing</span>`;
    } else if (item.status === "failed") {
      statusBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">Failed</span>`;
    }

    tr.innerHTML = `
      <td class="py-3 px-4">
        <div class="flex items-center gap-3">
          <span class="text-xl shrink-0">${icon}</span>
          <div class="min-w-0 max-w-xs sm:max-w-md">
            <b class="text-xs font-semibold text-slate-800 block truncate">${escapeHtml(item.title || "Untitled Recording")}</b>
            <span class="text-[10px] text-slate-400 block truncate">${escapeHtml(item.originalFileName || "")}</span>
          </div>
        </div>
      </td>
      <td class="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">${formatDuration(item.duration || 0)}</td>
      <td class="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">${formatDate(item.createdAt)}</td>
      <td class="py-3 px-4 whitespace-nowrap">${statusBadge}</td>
      <td class="py-3 px-4 text-right whitespace-nowrap">
        <a href="results.html?id=${item._id}" class="text-xs font-bold text-[#795ebd] hover:text-[#58418f] mr-3 transition-colors">Open →</a>
        <button type="button" class="px-2 py-1 text-[10px] font-medium text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 transition-colors" onclick="handleDelete('${item._id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSearch() {
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const q = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const status = statusFilter ? statusFilter.value : "all";

  const filtered = allAnalyses.filter((item) => {
    const matchesQuery =
      !q ||
      (item.title && item.title.toLowerCase().includes(q)) ||
      (item.originalFileName && item.originalFileName.toLowerCase().includes(q));

    const matchesStatus =
      status === "all" || item.status === status;

    return matchesQuery && matchesStatus;
  });

  renderTableRows(filtered);
}

async function handleDelete(id) {
  if (!confirm("Are you sure you want to delete this recording and all its intelligence data?")) {
    return;
  }

  try {
    await deleteAnalysisById(id);
    showToast("Recording deleted successfully.", "success");
    allAnalyses = allAnalyses.filter((a) => a._id !== id);
    handleSearch();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Expose globals
window.loadHistory = loadHistory;
window.renderTableRows = renderTableRows;
window.handleSearch = handleSearch;
window.handleDelete = handleDelete;

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("historyTable")) {
    loadHistory();
  }
});
