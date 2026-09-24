/**
 * AudioLens - Authentication Controller & Modal Management
 * Handles login, registration with OTP verification, password reset, and session state.
 */

// --- Authentication State Management ---

function getAuthToken() {
  return localStorage.getItem("audiolens_token") || null;
}

function setAuth(token, user) {
  if (token) localStorage.setItem("audiolens_token", token);
  if (user) localStorage.setItem("audiolens_user", JSON.stringify(user));
  updateNavbarAuth();
}

function clearAuth() {
  localStorage.removeItem("audiolens_token");
  localStorage.removeItem("audiolens_user");
  updateNavbarAuth();
  showToast("You have been signed out.", "info");
}

function getCurrentUser() {
  const data = localStorage.getItem("audiolens_user");
  try {
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

function updateNavbarAuth() {
  const user = getCurrentUser();
  const navActions = document.querySelectorAll(".nav-actions");

  navActions.forEach((container) => {
    const isMobile = container.closest("#mobileMenu") !== null;
    let slot = container.querySelector(".auth-slot");

    if (!slot) {
      const signInLink = container.querySelector(".signin, a[href*='sign']");
      if (signInLink) {
        slot = document.createElement("div");
        slot.className = isMobile ? "auth-slot w-full" : "auth-slot flex items-center gap-2";
        signInLink.replaceWith(slot);
      } else {
        slot = document.createElement("div");
        slot.className = isMobile ? "auth-slot w-full" : "auth-slot flex items-center gap-2";
        container.prepend(slot);
      }
    }

    if (user) {
      if (isMobile) {
        slot.className = "auth-slot w-full";
        slot.innerHTML = `
          <div class="flex items-center justify-between p-2.5 bg-purple-50/80 border border-purple-200 rounded-xl mb-1">
            <div class="flex items-center gap-2 overflow-hidden pr-2">
              <span class="w-7 h-7 rounded-full bg-purple-200 text-purple-800 grid place-items-center text-xs shrink-0 font-bold">👤</span>
              <div class="overflow-hidden">
                <span class="block text-xs font-bold text-slate-800 truncate">${escapeHtml(user.name || user.email)}</span>
                <span class="block text-[10px] text-slate-500 truncate">${escapeHtml(user.email || "")}</span>
              </div>
            </div>
            <button
              type="button"
              class="px-2.5 py-1 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors shrink-0 shadow-sm"
              onclick="closeMobileMenu(); clearAuth()"
            >
              Logout
            </button>
          </div>
        `;
      } else {
        slot.className = "auth-slot flex items-center gap-2";
        slot.innerHTML = `
          <span class="inline-flex items-center gap-1.5 font-bold text-xs text-[#523e85] bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200 select-none cursor-default">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            👤 ${escapeHtml(user.name || user.email)}
          </span>
          <button
            type="button"
            title="Sign out of AudioLens"
            class="px-2.5 py-1 rounded-md text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors shadow-sm"
            onclick="clearAuth()"
          >
            Logout
          </button>
        `;
      }
    } else {
      if (isMobile) {
        slot.className = "auth-slot w-full";
        slot.innerHTML = `
          <a class="signin block w-full text-center px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors" href="javascript:void(0)" onclick="closeMobileMenu(); openAuthModal('login')">
            Sign In
          </a>
        `;
      } else {
        slot.className = "auth-slot flex items-center";
        slot.innerHTML = `
          <a class="signin text-[#34384d] hover:text-[#7965b7] font-medium text-xs transition-colors" href="javascript:void(0)" onclick="openAuthModal('login')">
            Sign In
          </a>
        `;
      }
    }
  });
}

// --- Auth Modal & Screen Controller ---

let pendingVerificationEmail = "";

function openAuthModal(initialTab = "login") {
  let modal = document.getElementById("authModal");
  if (!modal) {
    modal = createAuthModalElement();
    document.body.appendChild(modal);
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  showAuthTab(initialTab);
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

function showAuthTab(tabName) {
  const tabs = ["login", "register", "verify", "forgot"];
  tabs.forEach((t) => {
    const view = document.getElementById(`authView_${t}`);
    const navBtn = document.getElementById(`authNavBtn_${t}`);
    if (view) view.classList.add("hidden");
    if (navBtn) {
      navBtn.classList.remove("border-[#795ebd]", "text-[#795ebd]", "bg-purple-50");
      navBtn.classList.add("border-transparent", "text-slate-500");
    }
  });

  const activeView = document.getElementById(`authView_${tabName}`);
  const activeNavBtn = document.getElementById(`authNavBtn_${tabName}`);
  if (activeView) activeView.classList.remove("hidden");
  if (activeNavBtn) {
    activeNavBtn.classList.add("border-[#795ebd]", "text-[#795ebd]", "bg-purple-50");
    activeNavBtn.classList.remove("border-transparent", "text-slate-500");
  }

  // Clear any status / helper labels
  const hintEl = document.getElementById("authOtpNotice");
  if (hintEl && tabName !== "verify") {
    hintEl.classList.add("hidden");
    hintEl.textContent = "";
  }
}

function createAuthModalElement() {
  const modal = document.createElement("div");
  modal.id = "authModal";
  modal.className = "fixed inset-0 z-[1000] hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all";

  modal.innerHTML = `
    <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
      
      <!-- Top header bar -->
      <div class="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-md bg-[#eee7ff] text-[#6958a9] grid place-items-center font-bold text-xs">◉</div>
          <span class="font-display font-bold text-base text-[#20233d]">AudioLens <span class="text-[#856cc1]">Account</span></span>
        </div>
        <button type="button" class="w-8 h-8 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 grid place-items-center transition-colors text-sm" onclick="closeAuthModal()">✕</button>
      </div>

      <!-- Navigation tabs -->
      <div class="flex border-b border-slate-100 px-6 pt-2">
        <button id="authNavBtn_login" type="button" class="py-2.5 px-4 text-xs font-semibold border-b-2 transition-all" onclick="showAuthTab('login')">Sign In</button>
        <button id="authNavBtn_register" type="button" class="py-2.5 px-4 text-xs font-semibold border-b-2 transition-all" onclick="showAuthTab('register')">Register</button>
      </div>

      <!-- Modal Body -->
      <div class="p-6">
        
        <!-- ================= VIEW 1: SIGN IN ================= -->
        <form id="authView_login" onsubmit="handleLoginSubmit(event)" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
            <input id="loginEmail" type="email" required placeholder="you@example.com" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#856cc1] focus:border-transparent transition-all">
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-semibold text-slate-700">Password</label>
              <button type="button" class="text-[11px] font-medium text-[#795ebd] hover:underline" onclick="showAuthTab('forgot')">Forgot?</button>
            </div>
            <input id="loginPassword" type="password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#856cc1] focus:border-transparent transition-all">
          </div>

          <button id="loginSubmitBtn" type="submit" class="w-full py-2.5 px-4 rounded-lg bg-[#20233d] hover:bg-[#34384d] text-white text-xs font-semibold tracking-wide transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
            Sign In to AudioLens
          </button>
        </form>

        <!-- ================= VIEW 2: REGISTER ================= -->
        <form id="authView_register" onsubmit="handleRegisterSubmit(event)" class="hidden space-y-3.5">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input id="regName" type="text" required placeholder="Alex Mercer" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#856cc1] focus:border-transparent transition-all">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input id="regEmail" type="email" required placeholder="alex@example.com" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#856cc1] focus:border-transparent transition-all">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input id="regPassword" type="password" required minlength="6" placeholder="At least 6 characters" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#856cc1] focus:border-transparent transition-all">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (Optional)</label>
            <input id="regMobile" type="tel" placeholder="+1 (555) 000-0000" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#856cc1] focus:border-transparent transition-all">
          </div>

          <button id="regSubmitBtn" type="submit" class="w-full py-2.5 px-4 rounded-lg bg-[#795ebd] hover:bg-[#684fab] text-white text-xs font-semibold tracking-wide transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
            Create Account & Send OTP →
          </button>
        </form>

        <!-- ================= VIEW 3: VERIFY OTP ================= -->
        <form id="authView_verify" onsubmit="handleVerifyOtpSubmit(event)" class="hidden space-y-4 text-center">
          <div class="w-12 h-12 rounded-full bg-purple-100 text-[#795ebd] grid place-items-center mx-auto text-xl">
            ✉️
          </div>
          <div>
            <h3 class="font-display font-bold text-base text-slate-800">Verify Your Email</h3>
            <p class="text-xs text-slate-500 mt-1">
              We sent a 6-digit code to <strong id="verifyEmailDisplay" class="text-slate-800">your email</strong>.
            </p>
          </div>

          <!-- DEV NOTICE HELPER -->
          <div id="authOtpNotice" class="hidden p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] text-left leading-relaxed"></div>

          <div>
            <input id="verifyOtpInput" type="text" maxlength="6" pattern="\\d{6}" required placeholder="123456" class="w-48 mx-auto text-center tracking-[8px] font-mono text-xl py-2.5 rounded-lg border-2 border-purple-200 focus:border-[#795ebd] focus:outline-none transition-all">
          </div>

          <button id="verifySubmitBtn" type="submit" class="w-full py-2.5 px-4 rounded-lg bg-[#20233d] hover:bg-[#34384d] text-white text-xs font-semibold transition-all">
            Verify OTP & Complete Registration
          </button>

          <div class="flex items-center justify-center gap-4 text-xs text-slate-500 pt-2">
            <button type="button" class="text-[#795ebd] hover:underline font-medium" onclick="handleResendOtp()">Resend Code</button>
            <span>•</span>
            <button type="button" class="text-slate-500 hover:text-slate-800" onclick="showAuthTab('login')">Back to Sign In</button>
          </div>
        </form>

        <!-- ================= VIEW 4: FORGOT PASSWORD ================= -->
        <form id="authView_forgot" onsubmit="handleForgotSubmit(event)" class="hidden space-y-3.5">
          <div class="text-center mb-2">
            <h3 class="font-display font-bold text-base text-slate-800">Reset Password</h3>
            <p class="text-xs text-slate-500 mt-1">Enter your registered email to receive a password reset code.</p>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input id="forgotEmail" type="email" required placeholder="you@example.com" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#856cc1]">
          </div>

          <div id="forgotStep2" class="hidden space-y-3 pt-2 border-t border-slate-100">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Reset OTP Code</label>
              <input id="forgotOtp" type="text" maxlength="6" placeholder="6-digit OTP" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-mono">
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input id="forgotNewPassword" type="password" minlength="6" placeholder="New password" class="w-full px-3.5 py-2 rounded-lg border border-slate-200 text-xs">
            </div>
          </div>

          <button id="forgotSubmitBtn" type="submit" class="w-full py-2.5 px-4 rounded-lg bg-[#20233d] hover:bg-[#34384d] text-white text-xs font-semibold transition-all">
            Send Reset Code
          </button>

          <div class="text-center pt-1">
            <button type="button" class="text-xs text-slate-500 hover:text-slate-800" onclick="showAuthTab('login')">← Back to Sign In</button>
          </div>
        </form>

        <!-- Guest / Dismiss button -->
        <div class="mt-4 pt-3 border-t border-slate-100 text-center">
          <button type="button" class="text-xs text-slate-500 hover:text-slate-800 hover:underline" onclick="closeAuthModal()">Continue as Guest</button>
        </div>

      </div>
    </div>
  `;

  return modal;
}

// --- Submit Event Handlers ---

async function handleLoginSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("loginSubmitBtn");
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  btn.disabled = true;
  btn.textContent = "Signing In...";

  try {
    const data = await apiLogin({ email, password });
    setAuth(data.token, data.user);
    showToast(`Welcome back, ${data.user.name || data.user.email}!`, "success");
    closeAuthModal();
  } catch (err) {
    if (err.needsVerification) {
      pendingVerificationEmail = err.email || email;
      showToast("Please verify your email address to complete registration.", "warning");
      document.getElementById("verifyEmailDisplay").textContent = pendingVerificationEmail;
      showAuthTab("verify");
    } else {
      showToast(err.message, "error");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In to AudioLens";
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("regSubmitBtn");
  const name = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const mobileNumber = document.getElementById("regMobile")?.value.trim() || "";

  btn.disabled = true;
  btn.textContent = "Sending Verification Code...";

  try {
    const res = await apiRegister({ name, email, password, mobileNumber });
    pendingVerificationEmail = email;
    document.getElementById("verifyEmailDisplay").textContent = email;

    // Handle dev OTP helper if in sandbox
    const noticeEl = document.getElementById("authOtpNotice");
    if (res.devOtp) {
      noticeEl.innerHTML = `<strong>Developer Sandbox Active:</strong> Your registration OTP is <strong class="text-purple-700 font-mono text-sm">${res.devOtp}</strong> (Emails restricted to Resend owner on unverified domains).`;
      noticeEl.classList.remove("hidden");
    } else {
      noticeEl.classList.add("hidden");
    }

    showToast("Verification code sent to your email!", "success");
    showAuthTab("verify");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Account & Send OTP →";
  }
}

async function handleVerifyOtpSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("verifySubmitBtn");
  const otp = document.getElementById("verifyOtpInput").value.trim();
  const email = pendingVerificationEmail || document.getElementById("regEmail")?.value.trim() || document.getElementById("loginEmail")?.value.trim();

  if (!email) {
    showToast("Please enter your registration email.", "error");
    showAuthTab("register");
    return;
  }

  btn.disabled = true;
  btn.textContent = "Activating Account...";

  try {
    const res = await apiVerifyOtp({ email, otp });
    setAuth(res.token, res.user);
    showToast(`Account verified! Welcome to AudioLens, ${res.user.name || "Explorer"}!`, "success");
    closeAuthModal();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Verify OTP & Complete Registration";
  }
}

async function handleResendOtp() {
  const email = pendingVerificationEmail || document.getElementById("regEmail")?.value.trim();
  if (!email) {
    showToast("Email address is missing.", "error");
    return;
  }

  try {
    const res = await apiResendOtp({ email });
    showToast("New OTP sent to your email.", "info");
    if (res.devOtp) {
      const noticeEl = document.getElementById("authOtpNotice");
      noticeEl.innerHTML = `<strong>Developer Sandbox Active:</strong> New OTP is <strong class="text-purple-700 font-mono text-sm">${res.devOtp}</strong>`;
      noticeEl.classList.remove("hidden");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

let isForgotStep2 = false;
async function handleForgotSubmit(event) {
  event.preventDefault();
  const btn = document.getElementById("forgotSubmitBtn");
  const email = document.getElementById("forgotEmail").value.trim();
  const step2 = document.getElementById("forgotStep2");

  if (!isForgotStep2) {
    btn.disabled = true;
    btn.textContent = "Sending Code...";
    try {
      const res = await apiForgotPassword({ email });
      showToast("Password reset code sent to your email!", "info");
      step2.classList.remove("hidden");
      btn.textContent = "Reset Password & Login";
      isForgotStep2 = true;
      if (res.devOtp) {
        showToast(`Sandbox Dev OTP: ${res.devOtp}`, "warning");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  } else {
    const otp = document.getElementById("forgotOtp").value.trim();
    const newPassword = document.getElementById("forgotNewPassword").value;
    btn.disabled = true;
    btn.textContent = "Updating Password...";

    try {
      await apiResetPassword({ email, otp, newPassword });
      showToast("Password reset successfully! Please sign in with your new password.", "success");
      isForgotStep2 = false;
      step2.classList.add("hidden");
      document.getElementById("loginEmail").value = email;
      showAuthTab("login");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Reset Password";
    }
  }
}

// Initialize navbar on page load
document.addEventListener("DOMContentLoaded", () => {
  updateNavbarAuth();
});

// Expose globals
window.getAuthToken = getAuthToken;
window.setAuth = setAuth;
window.clearAuth = clearAuth;
window.getCurrentUser = getCurrentUser;
window.updateNavbarAuth = updateNavbarAuth;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.showAuthTab = showAuthTab;
window.handleLoginSubmit = handleLoginSubmit;
window.handleRegisterSubmit = handleRegisterSubmit;
window.handleVerifyOtpSubmit = handleVerifyOtpSubmit;
window.handleResendOtp = handleResendOtp;
window.handleForgotSubmit = handleForgotSubmit;
