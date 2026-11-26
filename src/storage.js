/**
 * Pure Client-Side localStorage Store for LinguaBridge
 * Handles User Registration, Login, Demo Quick Login, Profile Updates,
 * Saved Words (Bookmarks), XP points, and Quiz Score History per user.
 */

import { DAILY_GOALS, LANGUAGE_MAP } from "./data.js";

const USERS_KEY = "linguabridge_users_v1";
const SESSION_KEY = "linguabridge_active_user_id_v1";

function formatNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

async function hashPassword(rawPassword) {
  const salted = `lb_v1::${rawPassword}`;
  if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
    const data = new TextEncoder().encode(salted);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Deterministic fallback hash for non-secure HTTP contexts without subtle crypto
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < salted.length; i += 1) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `fb_${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

function readUsers() {
  try {
    const raw = window.localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeUsers(users) {
  window.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getActiveUser() {
  const activeId = window.localStorage.getItem(SESSION_KEY);
  if (!activeId) return null;
  const users = readUsers();
  return users.find((u) => u.id === activeId) || null;
}

export function logoutUser() {
  window.localStorage.removeItem(SESSION_KEY);
}

export async function registerUser({ fullName, email, preferredLanguage, dailyGoal, password }) {
  const cleanName = String(fullName || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanLang = LANGUAGE_MAP[preferredLanguage] ? preferredLanguage : "Spanish";
  const cleanGoal = DAILY_GOALS.includes(dailyGoal) ? dailyGoal : "15 mins/day";

  if (cleanName.length < 2 || cleanName.length > 80) {
    return { ok: false, error: "Full name must be between 2 and 80 characters." };
  }
  if (!cleanEmail.includes("@") || !cleanEmail.split("@")[1]?.includes(".")) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters long." };
  }

  const users = readUsers();
  if (users.some((u) => u.email === cleanEmail)) {
    return { ok: false, error: "An account with this email already exists. Please log in instead." };
  }

  const passwordHash = await hashPassword(password);
  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    fullName: cleanName,
    email: cleanEmail,
    preferredLanguage: cleanLang,
    dailyGoal: cleanGoal,
    passwordHash,
    xp: 0,
    bookmarks: [],
    quizHistory: [],
    createdAt: formatNow(),
  };

  users.push(newUser);
  writeUsers(users);
  window.localStorage.setItem(SESSION_KEY, newUser.id);
  return { ok: true, user: newUser };
}

export async function loginUser({ email, password }) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, error: "Please enter both your email address and password." };
  }

  const users = readUsers();
  const found = users.find((u) => u.email === cleanEmail);
  if (!found) {
    return { ok: false, error: "Invalid email or password. Try registering or use Demo Quick Login." };
  }

  const candidateHash = await hashPassword(password);
  if (candidateHash !== found.passwordHash) {
    return { ok: false, error: "Invalid email or password. Please double-check your credentials." };
  }

  window.localStorage.setItem(SESSION_KEY, found.id);
  return { ok: true, user: found };
}

export async function demoQuickLogin() {
  const demoEmail = "demo@linguabridge.app";
  const users = readUsers();
  let demoUser = users.find((u) => u.email === demoEmail);

  if (!demoUser) {
    const passwordHash = await hashPassword("demo1234");
    demoUser = {
      id: "usr_demo_linguabridge",
      fullName: "Aarav Kulkarni",
      email: demoEmail,
      preferredLanguage: "Spanish",
      dailyGoal: "20 mins/day",
      passwordHash,
      xp: 235,
      bookmarks: ["es-1", "es-3", "mr-1", "ja-3"],
      quizHistory: [
        {
          id: "qz_seed_2",
          language: "Marathi",
          score: 6,
          total: 6,
          xpEarned: 135,
          createdAt: formatNow(),
        },
        {
          id: "qz_seed_1",
          language: "Spanish",
          score: 5,
          total: 6,
          xpEarned: 100,
          createdAt: formatNow(),
        },
      ],
      createdAt: formatNow(),
    };
    users.push(demoUser);
    writeUsers(users);
  }

  window.localStorage.setItem(SESSION_KEY, demoUser.id);
  return { ok: true, user: demoUser };
}

export async function updateUserProfile(userId, { fullName, preferredLanguage, dailyGoal, newPassword }) {
  const cleanName = String(fullName || "").trim();
  const cleanLang = LANGUAGE_MAP[preferredLanguage] ? preferredLanguage : "Spanish";
  const cleanGoal = DAILY_GOALS.includes(dailyGoal) ? dailyGoal : "15 mins/day";

  if (cleanName.length < 2 || cleanName.length > 80) {
    return { ok: false, error: "Full name must be between 2 and 80 characters." };
  }
  if (newPassword && newPassword.length < 6) {
    return { ok: false, error: "New password must be at least 6 characters long." };
  }

  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) {
    return { ok: false, error: "Account not found." };
  }

  const updated = {
    ...users[idx],
    fullName: cleanName,
    preferredLanguage: cleanLang,
    dailyGoal: cleanGoal,
  };

  if (newPassword) {
    updated.passwordHash = await hashPassword(newPassword);
  }

  users[idx] = updated;
  writeUsers(users);
  return { ok: true, user: updated };
}

export function toggleUserBookmark(userId, lessonId) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  const current = Array.isArray(users[idx].bookmarks) ? [...users[idx].bookmarks] : [];
  const existingIdx = current.indexOf(lessonId);
  let bookmarked = false;

  if (existingIdx >= 0) {
    current.splice(existingIdx, 1);
    bookmarked = false;
  } else {
    current.push(lessonId);
    bookmarked = true;
  }

  users[idx] = { ...users[idx], bookmarks: current };
  writeUsers(users);
  return { bookmarked, user: users[idx] };
}

export function recordQuizResult(userId, { language, score, total }) {
  const users = readUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  const xpEarned = score * 20 + (score === total ? 15 : 0);
  const entry = {
    id: `qz_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    language,
    score,
    total,
    xpEarned,
    createdAt: formatNow(),
  };

  const history = Array.isArray(users[idx].quizHistory) ? [entry, ...users[idx].quizHistory] : [entry];
  const nextXp = Number(users[idx].xp || 0) + xpEarned;

  users[idx] = {
    ...users[idx],
    xp: nextXp,
    quizHistory: history,
  };
  writeUsers(users);
  return { entry, user: users[idx] };
}
