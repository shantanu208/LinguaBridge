/**
 * LinguaBridge Pure Client-Side Application Controller
 * Vanilla JavaScript + Bootstrap 5 + localStorage + Web Speech API + Liquid Glass Dark/Light Mode
 */

import {
  DAILY_GOALS,
  LANGUAGE_MAP,
  LESSONS_DATA,
  QUIZ_BANK,
  SUPPORTED_LANGUAGES,
  getWordOfTheDay,
} from "./data.js";
import { speakPronunciation } from "./speech.js";
import {
  demoQuickLogin,
  getActiveUser,
  loginUser,
  logoutUser,
  recordQuizResult,
  registerUser,
  toggleUserBookmark,
  updateUserProfile,
} from "./storage.js";

const THEME_KEY = "linguabridge_theme_v1";

const state = {
  route: "home",
  user: getActiveUser(),
  theme: document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light",
  homePreviewLang: SUPPORTED_LANGUAGES[0].code,
  dashLang: "Spanish",
  dashMode: "lessons", // 'lessons' | 'quiz'
  dashCategory: "All",
  slowAudio: false,
  hidePhonetics: false,
  bookmarkedOnly: false,
  quiz: {
    questions: [],
    index: 0,
    score: 0,
    sessionXp: 0,
    answered: false,
  },
};

const views = {
  home: document.getElementById("homeView"),
  register: document.getElementById("registerView"),
  login: document.getElementById("loginView"),
  dashboard: document.getElementById("dashboardView"),
  profile: document.getElementById("profileView"),
};

// ==================== DARK / LIGHT THEME SWITCH ====================
const themeModeToggle = document.getElementById("themeModeToggle");

function applyTheme(nextTheme) {
  const mode = nextTheme === "dark" ? "dark" : "light";
  state.theme = mode;
  document.documentElement.setAttribute("data-theme", mode);
  document.documentElement.setAttribute("data-bs-theme", mode);
  themeModeToggle.checked = mode === "dark";
  try {
    window.localStorage.setItem(THEME_KEY, mode);
  } catch (_) {
    // Ignore storage errors
  }
}

themeModeToggle.addEventListener("change", () => {
  applyTheme(themeModeToggle.checked ? "dark" : "light");
});

// ==================== GLOBAL ALERT BANNER ====================
const alertWrap = document.getElementById("globalAlertWrap");
const alertBox = document.getElementById("globalAlertBox");
const alertIcon = document.getElementById("globalAlertIcon");
const alertText = document.getElementById("globalAlertText");
const alertClose = document.getElementById("globalAlertClose");

function showAlert(message, type = "info") {
  const iconMap = {
    success: "bi-check-circle-fill",
    danger: "bi-exclamation-octagon-fill",
    warning: "bi-exclamation-triangle-fill",
    info: "bi-info-circle-fill",
  };
  alertBox.className = `alert alert-${type} lb-alert-banner d-flex align-items-center justify-content-between gap-2 mb-0`;
  alertIcon.className = `bi ${iconMap[type] || iconMap.info} flex-shrink-0`;
  alertText.textContent = message;
  alertWrap.classList.remove("d-none");
}

function hideAlert() {
  alertWrap.classList.add("d-none");
}

alertClose.addEventListener("click", hideAlert);

// ==================== HELPERS ====================
function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function populateSelectOptions() {
  const langSelectIds = ["regPreferredLang", "editPreferredLang"];
  langSelectIds.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.replaceChildren();
    SUPPORTED_LANGUAGES.forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang.code;
      opt.textContent = `${lang.code} (${lang.nativeName})`;
      select.appendChild(opt);
    });
  });

  const goalSelectIds = ["regDailyGoal", "editDailyGoal"];
  goalSelectIds.forEach((id) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.replaceChildren();
    DAILY_GOALS.forEach((goal) => {
      const opt = document.createElement("option");
      opt.value = goal;
      opt.textContent = goal;
      select.appendChild(opt);
    });
    select.value = "15 mins/day";
  });
}

function closeMobileNav() {
  const navCollapse = document.getElementById("mainNav");
  if (navCollapse && navCollapse.classList.contains("show") && window.bootstrap) {
    const instance = window.bootstrap.Collapse.getOrCreateInstance(navCollapse);
    instance.hide();
  }
}

function renderNavbar() {
  const isLoggedIn = Boolean(state.user);

  document.getElementById("navGuestLinks").classList.toggle("d-none", isLoggedIn);
  document.getElementById("navGuestActions").classList.toggle("d-none", isLoggedIn);
  document.getElementById("navAuthLinks").classList.toggle("d-none", !isLoggedIn);
  document.getElementById("navAuthActions").classList.toggle("d-none", !isLoggedIn);

  document.getElementById("homeGuestCtas").classList.toggle("d-none", isLoggedIn);
  document.getElementById("homeAuthCtas").classList.toggle("d-none", !isLoggedIn);

  if (isLoggedIn) {
    const name = state.user.fullName || "Learner";
    document.getElementById("navUserName").textContent = name;
    document.getElementById("navUserInitial").textContent = name.charAt(0).toUpperCase();
  }

  document.querySelectorAll(".lb-nav-link[data-route]").forEach((link) => {
    link.classList.toggle("active", link.dataset.route === state.route);
  });
}

function navigateTo(routeName, options = {}) {
  let target = views[routeName] ? routeName : "home";
  state.user = getActiveUser();

  if ((target === "dashboard" || target === "profile") && !state.user) {
    showAlert("Please log in or use Demo Quick Login to access your learning studio and profile.", "warning");
    target = "login";
  }

  if ((target === "login" || target === "register") && state.user) {
    target = "dashboard";
  }

  if (!options.keepAlert) {
    hideAlert();
  }

  state.route = target;
  if (window.location.hash !== `#${target}`) {
    window.history.replaceState(null, "", `#${target}`);
  }

  Object.entries(views).forEach(([key, sectionEl]) => {
    sectionEl.classList.toggle("d-none", key !== target);
  });

  renderNavbar();
  closeMobileNav();

  if (target === "home") {
    renderHomePreview();
  } else if (target === "register" && options.prefillLang && LANGUAGE_MAP[options.prefillLang]) {
    document.getElementById("regPreferredLang").value = options.prefillLang;
  } else if (target === "dashboard") {
    if (options.lang && LANGUAGE_MAP[options.lang]) {
      state.dashLang = options.lang;
    } else if (!options.preserveLang && state.user?.preferredLanguage) {
      state.dashLang = state.user.preferredLanguage;
    }
    renderDashboard();
  } else if (target === "profile") {
    renderProfile();
  }

  window.scrollTo({ top: 0, behavior: "instant" });
}

// ==================== HOME VIEW ====================
function buildHomePills() {
  const container = document.getElementById("homeLangPills");
  container.replaceChildren();

  SUPPORTED_LANGUAGES.forEach((lang) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lb-lang-pill";
    btn.dataset.langCode = lang.code;
    btn.setAttribute("role", "tab");

    const codeSpan = document.createElement("span");
    codeSpan.textContent = lang.code;

    const nativeSpan = document.createElement("span");
    nativeSpan.className = "native-sub";
    nativeSpan.textContent = lang.nativeName;

    btn.appendChild(codeSpan);
    btn.appendChild(nativeSpan);
    btn.addEventListener("click", () => {
      state.homePreviewLang = lang.code;
      renderHomePreview();
    });

    container.appendChild(btn);
  });
}

function renderHomePreview() {
  const lang = LANGUAGE_MAP[state.homePreviewLang] || SUPPORTED_LANGUAGES[0];

  document.querySelectorAll("#homeLangPills .lb-lang-pill").forEach((btn) => {
    const isActive = btn.dataset.langCode === lang.code;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  document.getElementById("previewScript").textContent = lang.script;
  document.getElementById("previewLangTitle").textContent = `${lang.code} · ${lang.nativeName}`;
  document.getElementById("previewLocale").textContent = lang.locale;
  document.getElementById("previewTagline").textContent = lang.tagline;
  document.getElementById("previewNative").textContent = lang.sampleNative;
  document.getElementById("previewPhonetic").textContent = lang.samplePhonetic;
  document.getElementById("previewMeaning").textContent = `Meaning: ${lang.sampleMeaning}`;
  document.getElementById("homeSpeechNotice").classList.add("d-none");

  const startBtn = document.getElementById("homePreviewStartBtn");
  startBtn.textContent = state.user ? `Open ${lang.code} lessons →` : `Start with ${lang.code} →`;
}

document.getElementById("homePreviewListenBtn").addEventListener("click", (e) => {
  const lang = LANGUAGE_MAP[state.homePreviewLang] || SUPPORTED_LANGUAGES[0];
  speakPronunciation({
    text: lang.sampleNative,
    locale: lang.locale,
    rate: 1.0,
    buttonEl: e.currentTarget,
    noticeEl: document.getElementById("homeSpeechNotice"),
    languageName: lang.code,
  });
});

document.getElementById("homePreviewStartBtn").addEventListener("click", () => {
  if (state.user) {
    navigateTo("dashboard", { lang: state.homePreviewLang });
  } else {
    navigateTo("register", { prefillLang: state.homePreviewLang });
  }
});

// ==================== AUTH HANDLERS ====================
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("regFullName").value;
  const email = document.getElementById("regEmail").value;
  const preferredLanguage = document.getElementById("regPreferredLang").value;
  const dailyGoal = document.getElementById("regDailyGoal").value;
  const password = document.getElementById("regPassword").value;
  const confirmPassword = document.getElementById("regConfirmPassword").value;

  if (password !== confirmPassword) {
    showAlert("Passwords do not match. Please re-enter them.", "danger");
    return;
  }

  const res = await registerUser({ fullName, email, preferredLanguage, dailyGoal, password });
  if (!res.ok) {
    showAlert(res.error, "danger");
    return;
  }

  state.user = res.user;
  state.dashLang = res.user.preferredLanguage;
  state.dashMode = "lessons";
  state.dashCategory = "All";
  state.bookmarkedOnly = false;
  e.target.reset();
  document.getElementById("regDailyGoal").value = "15 mins/day";
  showAlert(`Welcome to LinguaBridge, ${res.user.fullName}! Your account is ready.`, "success");
  navigateTo("dashboard", { lang: res.user.preferredLanguage, keepAlert: true });
});

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  const res = await loginUser({ email, password });
  if (!res.ok) {
    showAlert(res.error, "danger");
    return;
  }

  state.user = res.user;
  state.dashLang = res.user.preferredLanguage;
  state.dashMode = "lessons";
  state.dashCategory = "All";
  state.bookmarkedOnly = false;
  e.target.reset();
  showAlert(`Welcome back, ${res.user.fullName}!`, "success");
  navigateTo("dashboard", { lang: res.user.preferredLanguage, keepAlert: true });
});

async function handleDemoLogin() {
  const res = await demoQuickLogin();
  if (!res.ok) return;
  state.user = res.user;
  state.dashLang = res.user.preferredLanguage;
  state.dashMode = "lessons";
  state.dashCategory = "All";
  state.bookmarkedOnly = false;
  showAlert(`Signed in with Demo Learner (${res.user.fullName})! Explore all 7 languages and quizzes.`, "success");
  navigateTo("dashboard", { lang: res.user.preferredLanguage, keepAlert: true });
}

document.querySelectorAll('[data-action="demo-login"]').forEach((btn) => {
  btn.addEventListener("click", handleDemoLogin);
});

document.getElementById("navLogoutBtn").addEventListener("click", () => {
  logoutUser();
  state.user = null;
  showAlert("You have been logged out safely. Your saved progress remains stored in this browser.", "info");
  navigateTo("home", { keepAlert: true });
});

// ==================== DASHBOARD VIEW ====================
function buildDashboardLangTabs() {
  const switcher = document.getElementById("dashboardLangSwitcher");
  switcher.replaceChildren();

  SUPPORTED_LANGUAGES.forEach((lang) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lb-lang-tab";
    btn.dataset.lang = lang.code;
    btn.setAttribute("role", "tab");

    const nameSpan = document.createElement("span");
    nameSpan.textContent = lang.code;

    const nativeSpan = document.createElement("span");
    nativeSpan.className = "lang-native";
    nativeSpan.textContent = lang.nativeName;

    btn.appendChild(nameSpan);
    btn.appendChild(nativeSpan);
    btn.addEventListener("click", () => {
      state.dashLang = lang.code;
      document.getElementById("dashboardSpeechNotice").classList.add("d-none");
      renderDashboard();
    });

    switcher.appendChild(btn);
  });
}

function getSpeechRate() {
  return state.slowAudio ? 0.65 : 1.0;
}

function speakDashText(text, buttonEl) {
  const meta = LANGUAGE_MAP[state.dashLang];
  if (!meta) return;
  speakPronunciation({
    text,
    locale: meta.locale,
    rate: getSpeechRate(),
    buttonEl,
    noticeEl: document.getElementById("dashboardSpeechNotice"),
    languageName: meta.code,
  });
}

function renderWordOfDay() {
  const wotd = getWordOfTheDay(state.dashLang);
  document.getElementById("wotdCategory").textContent = `${state.dashLang} · ${wotd.category}`;
  document.getElementById("wotdNative").textContent = wotd.native;

  const wotdPhonetic = document.getElementById("wotdPhonetic");
  wotdPhonetic.textContent = wotd.phonetic;
  wotdPhonetic.classList.toggle("d-none", state.hidePhonetics);

  document.getElementById("wotdMeaning").textContent = wotd.meaning;
  document.getElementById("wotdListenText").textContent = state.slowAudio ? "Listen (0.65x)" : "Listen";
  document.getElementById("wotdListenBtn").onclick = (e) => speakDashText(wotd.native, e.currentTarget);
}

function renderLessonsGrid() {
  const allItems = LESSONS_DATA[state.dashLang] || [];
  const meta = LANGUAGE_MAP[state.dashLang] || SUPPORTED_LANGUAGES[0];
  const savedSet = new Set(state.user?.bookmarks || []);

  const savedCountInLang = allItems.filter((item) => savedSet.has(item.id)).length;
  document.getElementById("bookmarkCountBadge").textContent = String(savedCountInLang);

  let filtered = allItems;
  if (state.dashCategory !== "All") {
    filtered = filtered.filter((item) => item.category === state.dashCategory);
  }
  if (state.bookmarkedOnly) {
    filtered = filtered.filter((item) => savedSet.has(item.id));
  }

  const grid = document.getElementById("lessonsGrid");
  const emptyState = document.getElementById("emptyLessonsState");
  grid.replaceChildren();

  if (!filtered.length) {
    emptyState.classList.remove("d-none");
    return;
  }
  emptyState.classList.add("d-none");

  filtered.forEach((item) => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-xl-4";

    const card = document.createElement("article");
    card.className = "lb-lesson-card";

    // Top row: category + bookmark star
    const topRow = document.createElement("div");
    topRow.className = "d-flex justify-content-between align-items-center gap-2 mb-3";

    const catLabel = document.createElement("span");
    let catClass = "lb-category-label";
    if (item.category === "Daily Phrases") catClass += " cat-phrases";
    else if (item.category === "Grammar") catClass += " cat-grammar";
    catLabel.className = catClass;
    catLabel.textContent = item.category;

    const isBookmarked = savedSet.has(item.id);
    const starBtn = document.createElement("button");
    starBtn.type = "button";
    starBtn.className = `lb-bookmark-btn ${isBookmarked ? "bookmarked" : ""}`;
    starBtn.setAttribute("aria-label", isBookmarked ? "Remove bookmark" : "Bookmark word");
    starBtn.setAttribute("aria-pressed", isBookmarked ? "true" : "false");
    starBtn.title = isBookmarked ? "Bookmarked" : "Bookmark this card";

    const starIcon = document.createElement("i");
    starIcon.className = isBookmarked ? "bi bi-star-fill" : "bi bi-star";
    starIcon.setAttribute("aria-hidden", "true");
    starBtn.appendChild(starIcon);

    starBtn.addEventListener("click", () => {
      if (!state.user) return;
      const result = toggleUserBookmark(state.user.id, item.id);
      if (result) {
        state.user = result.user;
        renderLessonsGrid();
      }
    });

    topRow.appendChild(catLabel);
    topRow.appendChild(starBtn);

    const nativeEl = document.createElement("h3");
    nativeEl.className = "lb-lesson-native mb-2";
    nativeEl.textContent = item.native;

    card.appendChild(topRow);
    card.appendChild(nativeEl);

    if (!state.hidePhonetics) {
      const phoneticEl = document.createElement("div");
      phoneticEl.className = "lb-phonetic-text mb-2";
      phoneticEl.textContent = item.phonetic;
      card.appendChild(phoneticEl);
    }

    const meaningEl = document.createElement("div");
    meaningEl.className = "fw-semibold lb-text-primary mb-2";
    meaningEl.textContent = item.meaning;

    const usageEl = document.createElement("p");
    usageEl.className = "small lb-text-muted mb-4 flex-grow-1";
    usageEl.textContent = item.usage;

    const footerRow = document.createElement("div");
    footerRow.className = "d-flex justify-content-between align-items-center gap-2 pt-3 lb-divider-top";

    const listenBtn = document.createElement("button");
    listenBtn.type = "button";
    listenBtn.className = "lb-listen-btn";
    const volIcon = document.createElement("i");
    volIcon.className = "bi bi-volume-up-fill";
    volIcon.setAttribute("aria-hidden", "true");
    const listenText = document.createElement("span");
    listenText.textContent = state.slowAudio ? "Listen (0.65x)" : "Listen";
    listenBtn.appendChild(volIcon);
    listenBtn.appendChild(listenText);
    listenBtn.addEventListener("click", () => speakDashText(item.native, listenBtn));

    const localeTag = document.createElement("span");
    localeTag.className = "small lb-text-subtle font-mono-tabular";
    localeTag.textContent = meta.locale;

    footerRow.appendChild(listenBtn);
    footerRow.appendChild(localeTag);

    card.appendChild(meaningEl);
    card.appendChild(usageEl);
    card.appendChild(footerRow);
    col.appendChild(card);
    grid.appendChild(col);
  });
}

function renderRecentQuizSidebar() {
  const listEl = document.getElementById("recentQuizList");
  const emptyEl = document.getElementById("recentQuizEmpty");
  const history = state.user?.quizHistory || [];

  listEl.replaceChildren();
  if (!history.length) {
    emptyEl.classList.remove("d-none");
    return;
  }
  emptyEl.classList.add("d-none");

  history.slice(0, 8).forEach((entry) => {
    const row = document.createElement("div");
    row.className = "d-flex justify-content-between align-items-center lb-glass-inset";
    row.style.padding = "0.65rem 0.85rem";

    const left = document.createElement("div");
    const langEl = document.createElement("div");
    langEl.className = "fw-semibold small lb-text-primary";
    langEl.textContent = entry.language;

    const dateEl = document.createElement("div");
    dateEl.className = "lb-text-subtle font-mono-tabular";
    dateEl.style.fontSize = "0.75rem";
    dateEl.textContent = entry.createdAt;

    left.appendChild(langEl);
    left.appendChild(dateEl);

    const right = document.createElement("div");
    right.className = "text-end font-mono-tabular";
    const pct = entry.total ? Math.round((entry.score / entry.total) * 100) : 0;

    const scoreEl = document.createElement("div");
    scoreEl.className = "fw-bold small";
    scoreEl.style.color = pct >= 70 ? "var(--lb-success-ink)" : "var(--lb-amber-ink)";
    scoreEl.textContent = `${entry.score}/${entry.total} (${pct}%)`;

    const xpEl = document.createElement("div");
    xpEl.className = "lb-text-subtle";
    xpEl.style.fontSize = "0.75rem";
    xpEl.textContent = `+${entry.xpEarned || 0} XP`;

    right.appendChild(scoreEl);
    right.appendChild(xpEl);

    row.appendChild(left);
    row.appendChild(right);
    listEl.appendChild(row);
  });
}

// ==================== PRACTICE QUIZ ENGINE ====================
function startQuizForActiveLang() {
  const bank = QUIZ_BANK[state.dashLang] || [];
  state.quiz = {
    questions: shuffleArray(bank).map((q) => ({
      ...q,
      options: shuffleArray(q.options),
    })),
    index: 0,
    score: 0,
    sessionXp: 0,
    answered: false,
  };

  document.getElementById("quizSummaryView").classList.add("d-none");
  document.getElementById("quizActiveView").classList.remove("d-none");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const { questions, index, score, sessionXp } = state.quiz;
  const total = questions.length;
  const current = questions[index];
  if (!current) return;

  document.getElementById("quizLangLabel").textContent = `${state.dashLang} Practice Quiz`;
  document.getElementById("quizProgressText").textContent = `Question ${index + 1} of ${total}`;
  document.getElementById("quizLiveScore").textContent = String(score);
  document.getElementById("quizTotalQuestions").textContent = String(total);
  document.getElementById("quizSessionXp").textContent = String(sessionXp);

  const pct = Math.round((index / total) * 100);
  const progressBar = document.getElementById("quizProgressBar");
  progressBar.style.width = `${pct}%`;
  progressBar.setAttribute("aria-valuenow", String(pct));

  document.getElementById("quizQuestionText").textContent = current.question;

  const promptBox = document.getElementById("quizNativePromptBox");
  if (current.promptNative) {
    promptBox.classList.remove("d-none");
    promptBox.classList.add("d-flex");
    document.getElementById("quizNativePromptText").textContent = current.promptNative;
    document.getElementById("quizPromptListenBtn").onclick = (e) =>
      speakDashText(current.promptNative, e.currentTarget);
  } else {
    promptBox.classList.add("d-none");
    promptBox.classList.remove("d-flex");
  }

  document.getElementById("quizFeedbackBox").classList.add("d-none");
  document.getElementById("quizNextBtn").classList.add("d-none");

  const optionsContainer = document.getElementById("quizOptionsContainer");
  optionsContainer.replaceChildren();
  const letters = ["A", "B", "C", "D"];

  current.options.forEach((optionText, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lb-quiz-option";
    btn.dataset.option = optionText;

    const leftWrap = document.createElement("span");
    leftWrap.className = "d-flex align-items-center gap-3";

    const letterBox = document.createElement("span");
    letterBox.className = "lb-option-letter";
    letterBox.textContent = letters[idx] || String(idx + 1);

    const textSpan = document.createElement("span");
    textSpan.textContent = optionText;

    leftWrap.appendChild(letterBox);
    leftWrap.appendChild(textSpan);

    const statusSlot = document.createElement("span");
    statusSlot.className = "option-status-icon small fw-bold";

    btn.appendChild(leftWrap);
    btn.appendChild(statusSlot);
    btn.addEventListener("click", () => handleQuizAnswer(optionText, btn));
    optionsContainer.appendChild(btn);
  });
}

function handleQuizAnswer(selectedOption, clickedBtn) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;

  const current = state.quiz.questions[state.quiz.index];
  const isCorrect = selectedOption === current.answer;

  if (isCorrect) {
    state.quiz.score += 1;
    state.quiz.sessionXp += 20;
  }

  document.getElementById("quizLiveScore").textContent = String(state.quiz.score);
  document.getElementById("quizSessionXp").textContent = String(state.quiz.sessionXp);

  document.querySelectorAll("#quizOptionsContainer .lb-quiz-option").forEach((btn) => {
    btn.disabled = true;
    const optVal = btn.dataset.option;
    const statusSlot = btn.querySelector(".option-status-icon");

    if (optVal === current.answer) {
      btn.classList.add("option-correct");
      const icon = document.createElement("i");
      icon.className = "bi bi-check-circle-fill me-1";
      icon.setAttribute("aria-hidden", "true");
      statusSlot.replaceChildren(icon, document.createTextNode("Correct"));
    } else if (btn === clickedBtn && !isCorrect) {
      btn.classList.add("option-wrong");
      const icon = document.createElement("i");
      icon.className = "bi bi-x-circle-fill me-1";
      icon.setAttribute("aria-hidden", "true");
      statusSlot.replaceChildren(icon, document.createTextNode("Incorrect"));
    }
  });

  const feedbackBox = document.getElementById("quizFeedbackBox");
  const feedbackIcon = document.getElementById("quizFeedbackIcon");
  const feedbackTitle = document.getElementById("quizFeedbackTitle");
  const feedbackExplanation = document.getElementById("quizFeedbackExplanation");

  feedbackBox.classList.remove("d-none");
  if (isCorrect) {
    feedbackBox.style.backgroundColor = "var(--lb-success-soft)";
    feedbackBox.style.border = "1px solid var(--lb-success)";
    feedbackBox.style.color = "var(--lb-success-ink)";
    feedbackIcon.className = "bi bi-check-circle-fill fs-5 flex-shrink-0";
    feedbackTitle.textContent = "Correct! +20 XP";
  } else {
    feedbackBox.style.backgroundColor = "var(--lb-danger-soft)";
    feedbackBox.style.border = "1px solid var(--lb-danger)";
    feedbackBox.style.color = "var(--lb-danger-ink)";
    feedbackIcon.className = "bi bi-x-circle-fill fs-5 flex-shrink-0";
    feedbackTitle.textContent = `Incorrect — Correct answer: ${current.answer}`;
  }
  feedbackExplanation.textContent = current.explanation;

  const isLast = state.quiz.index === state.quiz.questions.length - 1;
  const nextBtn = document.getElementById("quizNextBtn");
  nextBtn.textContent = isLast ? "Finish & Save Score" : "Next Question →";
  nextBtn.classList.remove("d-none");
}

function finishQuiz() {
  const total = state.quiz.questions.length;
  const score = state.quiz.score;
  const accuracy = total ? Math.round((score / total) * 100) : 0;

  const progressBar = document.getElementById("quizProgressBar");
  progressBar.style.width = "100%";
  progressBar.setAttribute("aria-valuenow", "100");

  document.getElementById("quizActiveView").classList.add("d-none");
  document.getElementById("quizSummaryView").classList.remove("d-none");

  const saved = state.user ? recordQuizResult(state.user.id, { language: state.dashLang, score, total }) : null;
  if (saved) {
    state.user = saved.user;
    document.getElementById("totalXpValue").textContent = String(state.user.xp);
    renderRecentQuizSidebar();
  }

  const xpEarned = saved ? saved.entry.xpEarned : score * 20;
  document.getElementById("summaryScoreVal").textContent = `${score}/${total}`;
  document.getElementById("summaryAccuracyVal").textContent = `${accuracy}%`;
  document.getElementById("summaryXpVal").textContent = `+${xpEarned}`;

  const headline = document.getElementById("quizSummaryHeadline");
  const subtext = document.getElementById("quizSummarySubtext");
  if (accuracy === 100) {
    headline.textContent = `Perfect ${state.dashLang} score!`;
    subtext.textContent = "Outstanding mastery—you earned a +15 XP perfect round bonus.";
  } else if (accuracy >= 70) {
    headline.textContent = `Great progress in ${state.dashLang}!`;
    subtext.textContent = "Your score and XP have been saved to your profile history.";
  } else {
    headline.textContent = `Keep practicing ${state.dashLang}!`;
    subtext.textContent = "Review the Daily Lessons tab and retake this quiz anytime.";
  }

  document.getElementById("quizSaveStatus").textContent = saved
    ? `Saved to browser history (${saved.entry.createdAt}). Total XP: ${state.user.xp}.`
    : "Quiz completed!";
}

function renderDashboard() {
  if (!state.user) return;

  document.getElementById("dashDailyGoal").textContent = state.user.dailyGoal || "15 mins/day";
  document.getElementById("dashPreferredLang").textContent = state.user.preferredLanguage || "Spanish";
  document.getElementById("totalXpValue").textContent = String(state.user.xp || 0);

  const meta = LANGUAGE_MAP[state.dashLang] || SUPPORTED_LANGUAGES[0];
  document.getElementById("activeLocaleMeta").textContent = `${meta.script} · Locale ${meta.locale}`;

  document.querySelectorAll("#dashboardLangSwitcher .lb-lang-tab").forEach((btn) => {
    const isActive = btn.dataset.lang === state.dashLang;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const isLessons = state.dashMode === "lessons";
  document.getElementById("modeLessonsBtn").classList.toggle("active", isLessons);
  document.getElementById("modeLessonsBtn").setAttribute("aria-selected", isLessons ? "true" : "false");
  document.getElementById("modeQuizBtn").classList.toggle("active", !isLessons);
  document.getElementById("modeQuizBtn").setAttribute("aria-selected", !isLessons ? "true" : "false");

  document.getElementById("lessonsPanel").classList.toggle("d-none", !isLessons);
  document.getElementById("quizPanel").classList.toggle("d-none", isLessons);

  document.querySelectorAll("#categoryFilterBar .lb-segmented-btn").forEach((btn) => {
    const isActive = btn.dataset.category === state.dashCategory;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  // Sync iOS toggle switches
  document.getElementById("toggleSlowAudio").checked = state.slowAudio;
  document.getElementById("toggleHidePhonetics").checked = state.hidePhonetics;
  document.getElementById("toggleBookmarkedOnly").checked = state.bookmarkedOnly;

  renderWordOfDay();
  renderLessonsGrid();
  renderRecentQuizSidebar();

  if (!isLessons) {
    startQuizForActiveLang();
  }
}

// Dashboard listeners
document.getElementById("modeLessonsBtn").addEventListener("click", () => {
  state.dashMode = "lessons";
  document.getElementById("dashboardSpeechNotice").classList.add("d-none");
  renderDashboard();
});

document.getElementById("modeQuizBtn").addEventListener("click", () => {
  state.dashMode = "quiz";
  document.getElementById("dashboardSpeechNotice").classList.add("d-none");
  renderDashboard();
});

document.querySelectorAll("#categoryFilterBar .lb-segmented-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.dashCategory = btn.dataset.category;
    renderDashboard();
  });
});

document.getElementById("toggleSlowAudio").addEventListener("change", (e) => {
  state.slowAudio = e.target.checked;
  renderWordOfDay();
  renderLessonsGrid();
});

document.getElementById("toggleHidePhonetics").addEventListener("change", (e) => {
  state.hidePhonetics = e.target.checked;
  renderWordOfDay();
  renderLessonsGrid();
});

document.getElementById("toggleBookmarkedOnly").addEventListener("change", (e) => {
  state.bookmarkedOnly = e.target.checked;
  renderLessonsGrid();
});

document.getElementById("resetCategoryBtn").addEventListener("click", () => {
  state.dashCategory = "All";
  state.bookmarkedOnly = false;
  renderDashboard();
});

document.getElementById("quizNextBtn").addEventListener("click", () => {
  if (state.quiz.index < state.quiz.questions.length - 1) {
    state.quiz.index += 1;
    state.quiz.answered = false;
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
});

document.getElementById("restartQuizBtn").addEventListener("click", startQuizForActiveLang);
document.getElementById("playAgainBtn").addEventListener("click", startQuizForActiveLang);

// ==================== PROFILE VIEW ====================
function renderProfile() {
  state.user = getActiveUser();
  if (!state.user) return;

  const user = state.user;
  const history = user.quizHistory || [];
  const totalQuizzes = history.length;

  let avgAccuracy = 0;
  let favLang = user.preferredLanguage;
  if (totalQuizzes > 0) {
    const totalCorrect = history.reduce((sum, r) => sum + Number(r.score || 0), 0);
    const totalPossible = history.reduce((sum, r) => sum + Number(r.total || 0), 0);
    avgAccuracy = totalPossible ? Math.round((totalCorrect / totalPossible) * 1000) / 10 : 0;

    const counts = {};
    history.forEach((r) => {
      counts[r.language] = (counts[r.language] || 0) + 1;
    });
    favLang = Object.keys(counts).reduce((a, b) => (counts[a] >= counts[b] ? a : b));
  }

  document.getElementById("profTotalQuizzes").textContent = String(totalQuizzes);
  document.getElementById("profAvgAccuracy").textContent = `${avgAccuracy}%`;
  document.getElementById("profFavLang").textContent = favLang;
  document.getElementById("profSavedCount").textContent = String((user.bookmarks || []).length);
  document.getElementById("profTotalXp").textContent = String(user.xp || 0);

  document.getElementById("profAvatarInitial").textContent = (user.fullName || "L").charAt(0).toUpperCase();
  document.getElementById("profDisplayName").textContent = user.fullName;
  document.getElementById("profDisplayEmail").textContent = user.email;
  document.getElementById("profDetailName").textContent = user.fullName;
  document.getElementById("profDetailEmail").textContent = user.email;
  document.getElementById("profDetailLang").textContent = user.preferredLanguage;
  document.getElementById("profDetailGoal").textContent = user.dailyGoal;
  document.getElementById("profDetailSince").textContent = user.createdAt;

  document.getElementById("editFullName").value = user.fullName;
  document.getElementById("editPreferredLang").value = user.preferredLanguage;
  document.getElementById("editDailyGoal").value = user.dailyGoal;
  document.getElementById("editNewPassword").value = "";

  document.getElementById("profHistoryCount").textContent =
    `${totalQuizzes} ${totalQuizzes === 1 ? "record" : "records"}`;
  const tableWrap = document.getElementById("profHistoryTableWrap");
  const emptyWrap = document.getElementById("profHistoryEmpty");
  const tbody = document.getElementById("profHistoryTbody");
  tbody.replaceChildren();

  if (!totalQuizzes) {
    tableWrap.classList.add("d-none");
    emptyWrap.classList.remove("d-none");
  } else {
    tableWrap.classList.remove("d-none");
    emptyWrap.classList.add("d-none");

    history.forEach((row, index) => {
      const pct = row.total ? Math.round((row.score / row.total) * 1000) / 10 : 0;
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.className = "font-mono-tabular lb-text-subtle";
      tdIdx.textContent = String(index + 1);

      const tdLang = document.createElement("td");
      tdLang.className = "fw-semibold";
      tdLang.textContent = row.language;

      const tdScore = document.createElement("td");
      tdScore.className = "font-mono-tabular fw-semibold";
      tdScore.textContent = `${row.score} / ${row.total}`;

      const tdAcc = document.createElement("td");
      tdAcc.className = "font-mono-tabular fw-semibold";
      tdAcc.style.color = pct >= 70 ? "var(--lb-success-ink)" : "var(--lb-amber-ink)";
      tdAcc.textContent = `${pct}%`;

      const tdXp = document.createElement("td");
      tdXp.className = "font-mono-tabular fw-semibold";
      tdXp.style.color = "var(--lb-amber-ink)";
      tdXp.textContent = `+${row.xpEarned || 0} XP`;

      const tdDate = document.createElement("td");
      tdDate.className = "font-mono-tabular lb-text-subtle";
      tdDate.textContent = row.createdAt;

      tr.append(tdIdx, tdLang, tdScore, tdAcc, tdXp, tdDate);
      tbody.appendChild(tr);
    });
  }
}

document.getElementById("editProfileForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.user) return;

  const fullName = document.getElementById("editFullName").value;
  const preferredLanguage = document.getElementById("editPreferredLang").value;
  const dailyGoal = document.getElementById("editDailyGoal").value;
  const newPassword = document.getElementById("editNewPassword").value;

  const res = await updateUserProfile(state.user.id, {
    fullName,
    preferredLanguage,
    dailyGoal,
    newPassword,
  });

  if (!res.ok) {
    showAlert(res.error, "danger");
    return;
  }

  state.user = res.user;
  state.dashLang = res.user.preferredLanguage;
  renderNavbar();
  renderProfile();
  showAlert("Your profile details have been updated successfully.", "success");
});

// ==================== GLOBAL ROUTE LINKS & BOOT ====================
document.querySelectorAll("[data-route]").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    navigateTo(el.dataset.route);
  });
});

window.addEventListener("hashchange", () => {
  const hashRoute = window.location.hash.replace(/^#/, "") || "home";
  if (hashRoute !== state.route && views[hashRoute]) {
    navigateTo(hashRoute, { preserveLang: true });
  }
});

// Initialize Application
applyTheme(state.theme);
populateSelectOptions();
buildHomePills();
buildDashboardLangTabs();

const initialHash = window.location.hash.replace(/^#/, "");
if (initialHash && views[initialHash]) {
  navigateTo(initialHash);
} else {
  navigateTo(state.user ? "dashboard" : "home");
}
