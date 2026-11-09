

C![Render](https://img.shields.io/badge/Render-Live%20Demo-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://bonediparikrama.onrender.com/)
[![Durga Puja 2026](https://img.shields.io/badge/Durga%20Puja-2026-D94A32?style=for-the-badge&logo=heritage&logoColor=white)](https://en.wikipedia.org/wiki/Durga_Puja_in_Kolkata)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM%20(Vanilla)-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Leaflet.js](https://img.shields.io/badge/Leaflet.js-Maps-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth%20v10-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

---

## 🌐 Live Demo

Explore the live application here:
👉 **[Kolkata Puja Parikrama — Durga Puja 2026 | পুজো পরিক্রমা](https://bonediparikrama.onrender.com/)**

> ℹ️ **Note:** Since this app is hosted on Render's free tier, the initial page load may take 30–50 seconds if the server is waking up.

---

## 📖 Overview

**Kolkata Puja Parikrama 2026** is a vintage-editorial digital magazine, interactive city map, and intelligent route optimizer designed to celebrate Kolkata’s Durga Puja — inscribed on UNESCO's Representative List of the Intangible Cultural Heritage of Humanity.

The application serves as an all-in-one companion for pandal hoppers, culture enthusiasts, and tourists navigating Kolkata during Durga Puja. Users can explore a curated directory of 151+ iconic pandals across five city zones, uncover historic Bonedi Bari traditions, locate nearby authentic food haunts, synthesize traditional Bengali Dhak rhythms directly in the browser, and compute optimal, backtrack-free itineraries tailored to their touring pace.

---

## 🛠️ Tech Stack & Architecture

This application is built with a zero-compilation, modern vanilla web architecture utilizing standard browser features and cloud APIs:

| Layer | Technologies & Libraries | Description |
| :--- | :--- | :--- |
| **Frontend UI** | HTML5, Tailwind CSS 3.x (CDN) | Single-page editorial layout inspired by vintage Bengali literary journals (*Patachitra* tones, newsprint aesthetics, serif typography). |
| **Client Logic** | Vanilla JavaScript (ESM) | Native ECMAScript Modules (`import`/`export`), strictly modular without the overhead of heavy SPA frameworks or build steps. |
| **Interactive Maps** | Leaflet.js 1.9.4 & OpenStreetMap CartoDB | Responsive vector tile maps with custom color-coded zone pins, popups, and real-time browser geolocation. |
| **Audio Synthesis** | Web Audio API | Zero-dependency, real-time synthesized Bengali Dhak percussion engine (no external audio files needed). |
| **Database & Cloud** | Google Firebase Cloud Firestore (Web SDK v10) | Cloud database for real-time pandal synchronization, puja tales, and food radar updates. |
| **Local Fallback** | HTML5 `localStorage` Engine | Dual-engine data tier that functions 100% offline out-of-the-box if Firestore is not connected. |
| **Authentication** | Firebase Auth | Secure Admin authentication supporting Google Sign-In and Email/Password with granular Firestore security rules. |
| **Algorithms** | Haversine Formula & Greedy TSP Heuristic | Graph traversal route planning that eliminates backtracking and calculates multi-modal transit times (walking, metro/auto, cab). |
| **Deployment** | Render (Static Site) | Continuous deployment connected directly to the GitHub repository. |

---

## 🌟 Key Features

* **🗺️ 151+ Curated Pandals Directory:** Complete coverage of North Kolkata, South Kolkata, Central Kolkata, Salt Lake / East Kolkata, and Howrah with crowd levels, artisan profiles, transit guides, and English/Bengali search.
* **🧭 Smart Route Planner & Itinerary Optimizer:** Generates efficient pandal-hopping schedules using the Traveling Salesperson Problem (TSP) nearest-neighbor heuristic and Haversine distance calculations.
* **📍 Interactive Leaflet Map:** Pandal markers color-coded by zone, quick "Add to Route" actions, and live GPS user positioning.
* **🍲 Hyper-Local Food Radar:** Pinned recommendations for legendary cabins (Mitra Cafe, Paramount), biryani joints, and sweet shops close to each pandal.
* **🥁 Web Audio Dhak Engine:** Authentic festive drum rhythm player generated mathematically in real-time.
* **🔒 Admin CMS:** Live CRUD management for pandals, tales, and food radar with Firebase Auth protection and Firestore database sync.

---

## 📁 Project Structure

```text
parikrama/
├── index.html            # Main single-page application & editorial layout
├── firestore.rules       # Firebase Cloud Firestore security rules
├── start-server.bat      # Windows one-click local server launcher
├── stop-server.bat       # Windows one-click server terminator
├── stop-server.ps1       # PowerShell server terminator
├── js/
│   ├── app.js            # Main application orchestrator & UI handlers
│   ├── data.js           # Master dataset of 151 Durga Puja pandals
│   ├── firebase.js       # Firebase SDK v10 integration & localStorage fallback
│   └── planner.js        # Haversine distance, TSP route optimizer, schedule engine
└── src/
    ├── assets/
    │   └── art/          # High-resolution heritage artwork & photographs
    │       ├── hero.jpg
    │       ├── botanical.jpg
    │       ├── dhunuchi.jpg
    │       ├── food.jpg
    │       ├── kumartuli.jpg
    │       └── sindoor.jpg
    └── data/
        └── pandals.json  # Raw JSON reference data
```

---

## 🚀 Step-by-Step Local Setup

Because the project uses standard ECMAScript Modules (`<script type="module">`), browsers require it to be served over an HTTP/HTTPS server rather than opened directly via `file:///`.

### 1. Clone the Repository
```bash
git clone https://github.com/Dipanjan-works/parikrama.git
cd parikrama
```

### 2. Install Dependencies
**None required!** The project relies entirely on browser-native ES Modules and CDN-delivered libraries (Tailwind CSS, Leaflet, Firebase SDK). There is no `npm install` or compilation step.

### 3. Environment Variables
**No `.env` file is required to run locally.**
* The app automatically initializes using browser `localStorage` and bundled dataset defaults.
* Connecting to Google Cloud Firestore is optional and can be configured through the web UI (see [Firebase Configuration](#-optional-firebase-configuration) below).

### 4. Start the Local Server

Choose any of the following methods:

#### Method A: Windows One-Click Script (Recommended for Windows)
Double-click `start-server.bat` or run:
```cmd
start-server.bat
```
*Automatically finds an available port (default 8080), starts a local server, and opens your browser.*

To stop the server:
```cmd
stop-server.bat
```

#### Method B: Python 3
```bash
python -m http.server 8080 --bind 127.0.0.1
```
Then visit [http://localhost:8080](http://localhost:8080) in your browser.

#### Method C: Node.js (npx)
```bash
npx serve . -p 8080
```
Then visit [http://localhost:8080](http://localhost:8080) in your browser.

#### Method D: VS Code Live Server
Right-click `index.html` in VS Code and select **"Open with Live Server"**.

---

## ⚙️ Optional Firebase Configuration

The application operates seamlessly offline without any cloud accounts. To enable cloud database synchronization and the Admin CMS:

1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Cloud Firestore** and **Authentication** (Google Sign-In and Email/Password).
3. Apply the security rules defined in [`firestore.rules`](firestore.rules).
4. Launch the web application, open **Admin / Sync Settings**, and input your Firebase configuration object:
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-app.firebaseapp.com",
     "projectId": "your-app-id",
     "storageBucket": "your-app.appspot.com",
     "messagingSenderId": "...",
     "appId": "..."
   }
   ```
5. Click **Save & Initialize** to begin live syncing.

---

## 🛡️ Security Rules

The repository includes pre-configured Firestore rules ([`firestore.rules`](firestore.rules)):
* **Public Read Access**: Pandals, food radar, and puja tales are openly readable by all visitors.
* **Admin-Gated Writes**: Modifying, creating, or deleting records requires administrator authentication (`dipanjandhar2006@gmail.com`).
* **Validation**: Enforces strict payload verification to prevent invalid data injection.

---

## 📜 License

Created with devotion for Kolkata's Durga Puja. Distributed under the [MIT License](LICENSE).
