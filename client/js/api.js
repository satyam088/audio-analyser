/**
 * AudioLens - Core API Client
 * Manages all HTTP and XMLHttpRequest calls to the Node.js backend.
 */

const API_BASE =
  window.location.protocol === "file:" || !window.location.origin.includes("5001")
    ? "http://localhost:5001"
    : window.location.origin;

/**
 * Get current JWT auth token
 */
function getAuthHeader() {
  const token = localStorage.getItem("audiolens_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ════════════════════════════════════════════
// AUTHENTICATION API CALLS
// ════════════════════════════════════════════

/**
 * Step 1: Register new account (sends OTP email)
 */
async function apiRegister({ name, email, password, mobileNumber = "" }) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, mobileNumber }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Registration failed (Status ${res.status})`);
  }
  return data;
}

/**
 * Step 2: Verify registration OTP and activate user account
 */
async function apiVerifyOtp({ email, otp }) {
  const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "OTP verification failed");
  }
  return data;
}

/**
 * Resend registration OTP
 */
async function apiResendOtp({ email }) {
  const res = await fetch(`${API_BASE}/api/auth/resend-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to resend OTP");
  }
  return data;
}

/**
 * Sign in existing verified user
 */
async function apiLogin({ email, password }) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Invalid credentials");
    if (data.needsVerification) {
      err.needsVerification = true;
      err.email = data.email || email;
    }
    throw err;
  }
  return data;
}

/**
 * Request password reset OTP email
 */
async function apiForgotPassword({ email }) {
  const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Failed to send reset code");
  }
  return data;
}

/**
 * Submit password reset with OTP
 */
async function apiResetPassword({ email, otp, newPassword }) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Password reset failed");
  }
  return data;
}

// ════════════════════════════════════════════
// AUDIO / VIDEO ANALYSIS API CALLS
// ════════════════════════════════════════════

/**
 * Upload an Audio or Video file with live upload progress tracking
 */
function uploadMedia(file, title = "", onProgress = null) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title && title.trim()) {
      formData.append("title", title.trim());
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/api/analyses/upload`);

    const token = localStorage.getItem("audiolens_token");
    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    if (onProgress && xhr.upload) {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      });
    }

    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(res);
        } else {
          reject(new Error(res.error || res.message || `Upload failed (Status ${xhr.status})`));
        }
      } catch (err) {
        reject(new Error(`Invalid response from server: ${xhr.responseText.substring(0, 100)}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network connection error. Is the backend server running on port 5001?"));
    };

    xhr.timeout = 360000; // 6 minute timeout
    xhr.ontimeout = () => {
      reject(new Error("Upload timed out. File processing took longer than expected."));
    };

    xhr.send(formData);
  });
}

/**
 * Fetch details of a single analysis by ID
 */
async function fetchAnalysisById(id) {
  const headers = { ...getAuthHeader() };
  const res = await fetch(`${API_BASE}/api/analyses/${id}`, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to load analysis");
  }
  const data = await res.json();
  return data.analysis;
}

/**
 * Fetch all analyses list
 */
async function fetchAllAnalyses() {
  const headers = { ...getAuthHeader() };
  const res = await fetch(`${API_BASE}/api/analyses`, { headers });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to load history");
  }
  const data = await res.json();
  return data.analyses || [];
}

/**
 * Delete an analysis by ID
 */
async function deleteAnalysisById(id) {
  const headers = { ...getAuthHeader() };
  const res = await fetch(`${API_BASE}/api/analyses/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to delete recording");
  }
  return await res.json();
}

/**
 * Ask follow-up question powered by Google Gemini API
 */
async function askFollowUpQuestion(id, question) {
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
  };

  const res = await fetch(`${API_BASE}/api/analyses/${id}/ask`, {
    method: "POST",
    headers,
    body: JSON.stringify({ question }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.detail || "Failed to get AI answer");
  }
  return await res.json();
}

// Expose on window object
window.API_BASE = API_BASE;
window.apiRegister = apiRegister;
window.apiVerifyOtp = apiVerifyOtp;
window.apiResendOtp = apiResendOtp;
window.apiLogin = apiLogin;
window.apiForgotPassword = apiForgotPassword;
window.apiResetPassword = apiResetPassword;
window.uploadMedia = uploadMedia;
window.fetchAnalysisById = fetchAnalysisById;
window.fetchAllAnalyses = fetchAllAnalyses;
window.deleteAnalysisById = deleteAnalysisById;
window.askFollowUpQuestion = askFollowUpQuestion;
