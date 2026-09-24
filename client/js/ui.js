/**
 * AudioLens - UI Helpers & Utilities
 * Provides formatting, markdown rendering, toast notifications, and tab controls.
 */

// --- Escaping and Formatting Helpers ---

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes) {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${mb.toFixed(1)} MB`;
}

function formatDate(dateStr) {
  if (!dateStr) return "Recent";
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffHours < 48) {
    return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function renderSimpleMarkdown(text) {
  if (!text) return "";
  let html = escapeHtml(text);
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code class=\"px-1.5 py-0.5 bg-slate-100 rounded text-purple-700 font-mono text-xs\">$1</code>");
  // Bullet lists
  html = html.replace(/^[*-]\s+(.+)$/gm, "<li class=\"ml-4 list-disc\">$1</li>");
  html = html.replace(/(<li.*<\/li>)/s, "<ul class=\"my-2 space-y-1\">$1</ul>");
  // Line breaks
  html = html.replace(/\n\n/g, "<p class=\"my-2\"></p>").replace(/\n/g, "<br>");
  return html;
}

// --- Toast Notifications ---

function showToast(message, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  const typeStyles = {
    error: "bg-red-50 border-red-200 text-red-800 shadow-red-100/50",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-emerald-100/50",
    info: "bg-slate-900 border-slate-800 text-white shadow-slate-900/20",
    warning: "bg-amber-50 border-amber-200 text-amber-800 shadow-amber-100/50",
  };
  const iconMap = {
    error: "⚠️",
    success: "✓",
    info: "ℹ️",
    warning: "⚡",
  };

  const currentStyle = typeStyles[type] || typeStyles.info;
  const currentIcon = iconMap[type] || iconMap.info;

  toast.className = `pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border text-xs font-medium shadow-lg transition-all duration-300 transform translate-x-0 opacity-100 ${currentStyle}`;
  toast.innerHTML = `
    <span class="text-sm shrink-0 mt-0.5">${currentIcon}</span>
    <span class="flex-1 leading-snug break-words">${escapeHtml(message)}</span>
    <button type="button" class="shrink-0 text-current opacity-60 hover:opacity-100 transition-opacity ml-1" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// --- Tab Controls ---

function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.classList.remove("active", "border-[#795ebd]", "text-[#795ebd]", "bg-purple-50/60");
    b.classList.add("border-transparent", "text-slate-600");
  });
  document.querySelectorAll(".tab-content").forEach((c) => {
    c.classList.remove("active");
    c.classList.add("hidden");
  });

  if (btn) {
    btn.classList.add("active", "border-[#795ebd]", "text-[#795ebd]", "bg-purple-50/60");
    btn.classList.remove("border-transparent", "text-slate-600");
  }
  const target = document.getElementById(tabId);
  if (target) {
    target.classList.add("active");
    target.classList.remove("hidden");
  }
}

// --- Mobile Hamburger Menu Controller ---

function toggleMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const burgerBtn = document.getElementById("mobileMenuBtn");
  if (!menu) return;

  const isHidden = menu.classList.contains("hidden");
  if (isHidden) {
    menu.classList.remove("hidden");
    if (burgerBtn) {
      burgerBtn.setAttribute("aria-expanded", "true");
      burgerBtn.innerHTML = `
        <svg class="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      `;
    }
  } else {
    closeMobileMenu();
  }
}

function closeMobileMenu() {
  const menu = document.getElementById("mobileMenu");
  const burgerBtn = document.getElementById("mobileMenuBtn");
  if (!menu) return;

  menu.classList.add("hidden");
  if (burgerBtn) {
    burgerBtn.setAttribute("aria-expanded", "false");
    burgerBtn.innerHTML = `
      <svg class="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    `;
  }
}

// Auto close on window resize above md (768px) and when clicking outside
window.addEventListener("resize", () => {
  if (window.innerWidth >= 768) {
    closeMobileMenu();
  }
});

document.addEventListener("click", (e) => {
  const menu = document.getElementById("mobileMenu");
  const burgerBtn = document.getElementById("mobileMenuBtn");
  if (menu && !menu.classList.contains("hidden") && burgerBtn) {
    if (!menu.contains(e.target) && !burgerBtn.contains(e.target)) {
      closeMobileMenu();
    }
  }
});

// Expose globals for window
window.escapeHtml = escapeHtml;
window.formatDuration = formatDuration;
window.formatFileSize = formatFileSize;
window.formatDate = formatDate;
window.renderSimpleMarkdown = renderSimpleMarkdown;
window.showToast = showToast;
window.switchTab = switchTab;
window.toggleMobileMenu = toggleMobileMenu;
window.closeMobileMenu = closeMobileMenu;
