# 🛕 Kolkata Puja Parikrama 2026 (পুজো পরিক্রমা)

[![Durga Puja 2026](https://img.shields.io/badge/Durga%20Puja-2026-D94A32?style=for-the-badge&logo=heritage&logoColor=white)](https://en.wikipedia.org/wiki/Durga_Puja_in_Kolkata)
[![JavaScript](https://img.shields.io/badge/JavaScript-ESM%20(Vanilla)-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Leaflet.js](https://img.shields.io/badge/Leaflet.js-Maps-199900?style=for-the-badge&logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Auth%20v10-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

> **An editorial digital magazine, interactive city map, and smart route optimizer celebrating Kolkata’s Durga Puja — inscribed on UNESCO's Representative List of the Intangible Cultural Heritage of Humanity.**

---

## 🌟 Highlights & Features

### 🗺️ 151+ Curated Pandals Directory
- Complete database of **151 pandals** covering **North Kolkata, South Kolkata, Central Kolkata, Salt Lake / East Kolkata, and Howrah**.
- Filters by **Zone**, **Crowd Level** (Low, Moderate, High, Very High), **Metro Connectivity**, and search by English or Bengali names.
- Detailed modal views featuring concept notes, idol artisan details, historical background, nearest metro stations, and transit tips.

### 🧭 Smart Route Planner & Itinerary Optimizer
- **Nearest-Neighbor Route Sequencer**: Computes shortest travel paths using the Haversine formula to eliminate backtracking.
- **Custom Pace & Timing**: Choose your touring style (*Relaxed*, *Standard*, *Express*) and your preferred parikrama window (including overnight routes).
- **Multi-Modal Transit Estimates**: Walking distances, metro/auto suggestions, and cab travel durations.
- **Automated Food Breaks**: Automatically schedules dinner or evening tea stops near top-rated Kolkata food haunts.
- **Export & Share**: Print or copy your complete time-stamped itinerary in one click.

### 📍 Interactive City Map (Leaflet.js)
- Responsive vector tile map embedded directly in the editorial layout.
- Custom color-coded zone pins with interactive popup cards and "Add to Route" shortcuts.
- Real-time geolocation support to pinpoint your current location in Kolkata.

### 🍲 Pandal Food Radar
- Hyper-local food guides pinned to individual pandals — from classic cabin bites (Mitra Cafe, Paramount) to iconic biryani spots (Arsalan, Aminia) and sweet shops (Nabin Chandra Das, Balaram Mullick).

### 🥁 Web Audio Dhak Experience
- Built-in authentic Bengali Dhak beat player synthesized using the Web Audio API (no external audio files required, zero latency).

### 🔒 Admin CMS & Cloud Firestore Sync
- **Dual Storage Engine**: Works 100% offline via browser `localStorage` out-of-the-box, or syncs seamlessly with Google Cloud Firestore.
- **Admin Dashboard**: Secure authentication via Firebase Auth (Google Sign-In & Email/Password) with strict Firestore Security Rules.
- **Full CRUD Capabilities**: Add, edit, duplicate, and delete pandals, manage food radar stalls, customize hero artwork, and import/export JSON backups.

---

## 🎨 Editorial Design Aesthetics

Inspired by vintage Bengali literary magazines, *Patachitra* folk art, and warm newsprint:
- **Palette**: Paper Cream (`#FFF8ED`), Deep Warm Ink (`#241B17`), Royal Vermilion (`#D94A32`), Mustard Gold (`#E9B548`), and Forest Pine (`#50694D`).
- **Typography**: Editorial pairings of *Playfair Display*, *Cormorant Garamond*, *Caveat* (handwritten notes), *Space Grotesk*, and *Noto Serif Bengali*.

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

## 🚀 Quick Start & Local Development

Because the project uses standard ECMAScript Modules (`<script type="module">`), it must be served over an HTTP server rather than loaded via `file:///`.

### Option A: Using Windows Batch Scripts (Recommended)

1. **Start the local server:**
   Double-click `start-server.bat` or run in terminal:
   ```cmd
   start-server.bat
   ```
   *This automatically frees port 8080, launches a local Python or Node server, and opens your default browser at `http://localhost:8080/`.*

2. **Stop the local server:**
   Double-click `stop-server.bat` or run:
   ```cmd
   stop-server.bat
   ```

### Option B: Using Python

```bash
# In the project directory
python -m http.server 8080 --bind 127.0.0.1
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

### Option C: Using Node.js

```bash
npx serve -p 8080
```
Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## ⚙️ Firebase Setup (Optional)

The application works **completely offline with full functionality** using browser local storage without any cloud setup.

To connect live Firebase Cloud Firestore:
1. Create a project in the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** and **Authentication** (Google & Email/Password).
3. Deploy the included security rules from `firestore.rules`.
4. In the web application, open the **Admin / Sync Settings** modal and paste your Firebase Web configuration:
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-app.firebaseapp.com",
     "projectId": "your-app",
     "storageBucket": "your-app.appspot.com",
     "messagingSenderId": "...",
     "appId": "..."
   }
   ```
5. Click **Save & Initialize**. The app will automatically sync your pandals to Cloud Firestore.

---

## 🛡️ Security Rules

The application includes production-ready Firestore rules ([firestore.rules](firestore.rules)):
- **Public Read Access**: Pandals, food radar, and puja tales are openly viewable by anyone.
- **Admin-Gated Writes**: Modifying, creating, or deleting pandals requires a verified administrator email token (`dipanjandhar2006@gmail.com`).
- **Data Validation**: Strict string length and type validations prevent malformed payloads.

---

## 📜 License

Created with devotion for Kolkata's Durga Puja. Distributed under the [MIT License](LICENSE).
