/**
 * Web Speech API Pronunciation Engine for LinguaBridge
 * Supports es-ES, fr-FR, de-DE, en-US, hi-IN, ja-JP, mr-IN with Normal (1.0x) and Slow (0.65x) rates,
 * plus graceful fallback notifications when a specific OS voice pack is unavailable.
 */

let cachedVoices = [];

function loadVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  cachedVoices = window.speechSynthesis.getVoices() || [];
  return cachedVoices;
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  loadVoices();
  if (typeof window.speechSynthesis.onvoiceschanged !== "undefined") {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
}

function findBestVoice(locale) {
  const voices = cachedVoices.length ? cachedVoices : loadVoices();
  if (!voices.length) return { voice: null, exactMatch: false, fallbackNote: "" };

  const target = locale.toLowerCase();
  const baseLang = target.split("-")[0];

  const exact = voices.find((v) => v.lang && v.lang.toLowerCase() === target);
  if (exact) return { voice: exact, exactMatch: true, fallbackNote: "" };

  const prefix = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(baseLang));
  if (prefix) return { voice: prefix, exactMatch: true, fallbackNote: "" };

  if (baseLang === "mr") {
    const hiFallback = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("hi"));
    if (hiFallback) {
      return { voice: hiFallback, exactMatch: false, fallbackNote: "Hindi Devanagari voice fallback" };
    }
  }

  return { voice: null, exactMatch: false, fallbackNote: "" };
}

function showNotice(noticeEl, message) {
  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.classList.remove("d-none");
}

function hideNotice(noticeEl) {
  if (!noticeEl) return;
  noticeEl.classList.add("d-none");
}

export function speakPronunciation({ text, locale, rate = 1.0, buttonEl = null, noticeEl = null, languageName = "" }) {
  hideNotice(noticeEl);

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    showNotice(
      noticeEl,
      "Your browser does not support Web Speech audio playback. Use the Romanized phonetic guide shown on each card."
    );
    return;
  }

  try {
    window.speechSynthesis.cancel();
  } catch (_) {
    // Ignore cancel errors
  }

  const { voice, exactMatch, fallbackNote } = findBestVoice(locale);
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = rate;

  if (voice) {
    utterance.voice = voice;
  }

  if (!exactMatch) {
    const label = languageName || locale;
    if (fallbackNote) {
      showNotice(
        noticeEl,
        `Native ${label} (${locale}) voice pack is not installed on this device; playing with ${fallbackNote}. Follow the phonetic guide for exact pronunciation.`
      );
    } else {
      showNotice(
        noticeEl,
        `No dedicated ${label} (${locale}) voice pack was detected on this browser/OS. Attempting default speech playback—refer to the phonetic pronunciation guide for accuracy.`
      );
    }
  }

  if (buttonEl) {
    document.querySelectorAll(".lb-listen-btn.speaking").forEach((el) => el.classList.remove("speaking"));
    buttonEl.classList.add("speaking");
    const clearState = () => buttonEl.classList.remove("speaking");
    utterance.onend = clearState;
    utterance.onerror = () => {
      clearState();
      showNotice(
        noticeEl,
        `Audio playback could not start for ${languageName || locale} on this device. Refer to the phonetic pronunciation guide.`
      );
    };
  }

  try {
    window.speechSynthesis.speak(utterance);
  } catch (_) {
    if (buttonEl) buttonEl.classList.remove("speaking");
    showNotice(
      noticeEl,
      `Audio playback is unavailable in this browser environment for ${languageName || locale}. Refer to the phonetic pronunciation guide.`
    );
  }
}
