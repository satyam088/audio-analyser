/**
 * AudioLens - Microphone Audio Recorder
 * Captures live speech from user's microphone with real-time timer callbacks.
 */

let mediaRecorder = null;
let audioChunks = [];
let recordStartTime = 0;
let recordInterval = null;

/**
 * Request microphone permissions and start recording
 * @param {Function} onTick - Callback receiving elapsed seconds
 */
async function startMicrophoneRecording(onTick) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("Microphone recording is not supported in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start();
  recordStartTime = Date.now();

  if (onTick) {
    recordInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
      onTick(elapsed);
    }, 500);
  }

  return mediaRecorder;
}

/**
 * Stop microphone recording and return File object
 * @returns {Promise<File|null>}
 */
function stopMicrophoneRecording() {
  return new Promise((resolve) => {
    if (!mediaRecorder) {
      resolve(null);
      return;
    }

    if (recordInterval) {
      clearInterval(recordInterval);
      recordInterval = null;
    }

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const file = new File([audioBlob], `recording-${Date.now()}.webm`, {
        type: "audio/webm",
      });
      // Stop all active microphone tracks
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      mediaRecorder = null;
      resolve(file);
    };

    mediaRecorder.stop();
  });
}

// Expose globals
window.startMicrophoneRecording = startMicrophoneRecording;
window.stopMicrophoneRecording = stopMicrophoneRecording;
