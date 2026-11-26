# LinguaBridge — Client-Side Multi-Language Learning Web App

A pure client-side, interactive language learning web application built with **HTML5**, **Bootstrap 5 (CDN)**, **Vanilla JavaScript**, **Web Speech API**, and browser **`localStorage`**, styled with a bright iOS frosted-glass interface (`backdrop-filter: blur(16px)` on `#F4F9F9` with `#0D9488` teal accents).

## Supported Languages (7)

| Language | Native Name | Script | Web Speech Locale |
| :--- | :--- | :--- | :--- |
| Spanish | Español | Latin | `es-ES` |
| French | Français | Latin | `fr-FR` |
| German | Deutsch | Latin | `de-DE` |
| English | English | Latin | `en-US` |
| Hindi | हिन्दी | Devanagari | `hi-IN` |
| Japanese | 日本語 | Kana & Kanji | `ja-JP` |
| Marathi | मराठी | Devanagari | `mr-IN` |

## Key Features

- **Pure Client-Side Authentication (`localStorage`)**:
  - Register with Full Name, Email, Preferred Target Language, Daily Learning Goal, and Password (hashed with Web Crypto SHA-256).
  - Login with clear success/error alerts, **Demo Quick Login** one-click account access, and Logout.
- **Interactive Learning & Quiz Studio**:
  - **7 Languages x 6 Rich Lesson Cards (42 total)** across **Vocabulary**, **Daily Phrases**, and **Grammar**, showing native script, phonetic Romanized pronunciation, English meaning, and usage notes.
  - **Word of the Day Banner** tailored per language with instant audio playback.
  - **Bookmark Star & "Saved Words" Filter** persisted per user in `localStorage`.
  - **Web Speech API Audio Pronunciation** with **Normal (1.0x)** and **Slow (0.65x)** speed toggle and graceful fallback notifications when an OS voice pack is unavailable.
  - **Randomized MCQ Practice Quiz Mode** with instant green/red feedback, explanations, live XP counter, and saved quiz history.
- **User Profile & Progress Analytics**:
  - Displays account details, Total Quizzes Taken, Average Quiz Accuracy (%), Most Practiced Language, Saved Words count, Total XP, full **My Quiz History** table, and an **Edit Profile Details** form.

## Project Structure

```text
.
├── index.html          # Semantic HTML5 multi-view shell (Bootstrap 5 CDN)
├── src/
│   ├── styles.css      # Bright iOS frosted-glass design system (#F4F9F9 + #0D9488)
│   ├── data.js         # 7 languages, 42 lessons, 42 quiz questions, Word of the Day
│   ├── speech.js       # Web Speech API pronunciation engine (1.0x / 0.65x)
│   ├── storage.js      # localStorage auth, Demo Quick Login, bookmarks, XP & quiz history
│   └── app.js          # Vanilla JS view router & interactive dashboard/profile controller
└── README.md
```

## Running Locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in your browser. Everything runs 100% client-side with zero backend server required.
