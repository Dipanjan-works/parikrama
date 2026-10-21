// Firebase Firestore & Authentication Module (Web SDK v10 CDN)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { INITIAL_PANDALS } from "./data.js";

// ==== PUJA TALES COLLECTION HELPERS ====
/**
 * Fetch all puja tales.
 * Returns an array of tale objects with id.
 */
export async function fetchPujaTales() {
  if (isFirestoreAvailable && db) {
    try {
      const coll = collection(db, "pujaTales");
      const snap = await getDocs(coll);
      const list = [];
      snap.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      return list;
    } catch (e) {
      console.warn("⚠️ Failed to fetch pujaTales, falling back to local storage:", e.message);
    }
  }
  // fallback to local storage
  const cached = localStorage.getItem("puja_tales_local");
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }
  return [];
}

/** Add a new puja tale (admin only) */
export async function addNewPujaTale(tale) {
  const taleToSave = { ...tale, id: tale.id || `tale-${Date.now()}` };
  let saved = false;
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "pujaTales", taleToSave.id);
      await setDoc(docRef, { ...taleToSave, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      saved = true;
    } catch (e) {
      console.warn("Could not save puja tale to Firestore:", e);
    }
  }
  // Update local cache
  const cached = localStorage.getItem("puja_tales_local");
  const list = cached ? JSON.parse(cached) : [];
  list.unshift(taleToSave);
  localStorage.setItem("puja_tales_local", JSON.stringify(list));
  return { success: true, tale: taleToSave, firestore: saved };
}

/** Update an existing puja tale */
export async function updatePujaTale(taleId, fields) {
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "pujaTales", taleId);
      await updateDoc(docRef, { ...fields, updatedAt: serverTimestamp() });
    } catch (e) {
      console.warn("Could not update puja tale in Firestore:", e);
    }
  }
  const cached = localStorage.getItem("puja_tales_local");
  const list = cached ? JSON.parse(cached) : [];
  const idx = list.findIndex(t => t.id === taleId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...fields };
    localStorage.setItem("puja_tales_local", JSON.stringify(list));
  }
  return { success: true };
}

/** Delete a puja tale */
export async function deletePujaTale(taleId) {
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "pujaTales", taleId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn("Could not delete puja tale from Firestore:", e);
    }
  }
  const cached = localStorage.getItem("puja_tales_local");
  const list = cached ? JSON.parse(cached) : [];
  const filtered = list.filter(t => t.id !== taleId);
  localStorage.setItem("puja_tales_local", JSON.stringify(filtered));
  return { success: true };
}



// STRICT ADMIN EMAIL — assembled at runtime from parts to avoid plaintext in source
// Parts: prefix + separator + domain  (do NOT log this value)
const _ap = ["dipanjandhar", "2006", "gmail.com"];
const ADMIN_EMAIL = `${_ap[0]}${_ap[1]}@${_ap[2]}`;
export { ADMIN_EMAIL };

/**
 * Timing-safe string comparison to prevent enumeration attacks.
 * Returns true only if both strings are identical in O(n) regardless of where they differ.
 */
function safeEmailCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const la = a.trim().toLowerCase();
  const lb = b.trim().toLowerCase();
  if (la.length !== lb.length) return false;
  let diff = 0;
  for (let i = 0; i < la.length; i++) {
    diff |= la.charCodeAt(i) ^ lb.charCodeAt(i);
  }
  return diff === 0;
}
export { safeEmailCompare };

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDummyKeyForPujorParikramaKolkata2026",
  authDomain: "pujor-parikrama-2026.firebaseapp.com",
  projectId: "pujor-parikrama-2026",
  storageBucket: "pujor-parikrama-2026.appspot.com",
  messagingSenderId: "109823478912",
  appId: "1:109823478912:web:a987d65ef4321cba"
};

const STORAGE_KEY_CONFIG = "pujor_parikrama_firebase_config";
const STORAGE_KEY_PANDALS = "pujor_parikrama_local_pandals_v52";
const STORAGE_KEY_LOCAL_USER = "pujor_parikrama_local_user";

let app = null;
let db = null;
let auth = null;
let isFirestoreAvailable = false;

let syncStatus = {
  mode: "local",
  message: "Initializing...",
  lastSync: null
};

// Initialize Firebase & Auth
export function initFirebase() {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG);
    const config = savedConfig ? JSON.parse(savedConfig) : DEFAULT_FIREBASE_CONFIG;

    if (config.apiKey && !config.apiKey.includes("DummyKey")) {
      app = initializeApp(config);
      db = getFirestore(app);
      auth = getAuth(app);
      isFirestoreAvailable = true;
      syncStatus = {
        mode: "firestore",
        message: "Connected to Cloud Firestore & Auth",
        lastSync: new Date().toISOString()
      };
      console.log("🔥 Firebase initialized with custom Firestore & Auth config.");
    } else {
      isFirestoreAvailable = false;
      syncStatus = {
        mode: "local",
        message: "Offline Local Store (Active)",
        lastSync: new Date().toISOString()
      };
      console.info("ℹ️ Running in Local Store mode with fallback. Real credentials can be set in settings.");
    }
  } catch (err) {
    console.warn("⚠️ Firebase init error:", err);
    isFirestoreAvailable = false;
    syncStatus = {
      mode: "local",
      message: "Local Store Mode (Fallback)",
      lastSync: new Date().toISOString()
    };
  }
}

// Subscribe to Auth State Changes
export function subscribeToAuth(callback) {
  if (auth) {
    return onAuthStateChanged(auth, (user) => {
      const isAdmin = checkIsAdmin(user);
      callback({ user, isAdmin, mode: "firebase" });
    });
  } else {
    // Check Local User session
    const localUserJson = localStorage.getItem(STORAGE_KEY_LOCAL_USER);
    if (localUserJson) {
      try {
        const user = JSON.parse(localUserJson);
        callback({ user, isAdmin: checkIsAdmin(user), mode: "local" });
      } catch (e) {
        callback({ user: null, isAdmin: false, mode: "local" });
      }
    } else {
      callback({ user: null, isAdmin: false, mode: "local" });
    }
    return () => {};
  }
}

// Check if user is the designated admin — uses timing-safe comparison
export function checkIsAdmin(user) {
  if (!user || !user.email) return false;
  return safeEmailCompare(user.email, ADMIN_EMAIL);
}

// Sign in with Google
export async function loginWithGoogle() {
  if (auth) {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } else {
    // Local / Demo Mode fallback — no default email pre-filled
    const emailPrompt = prompt("Enter your Gmail address to sign in (Demo Mode):", "");
    if (!emailPrompt || !emailPrompt.includes("@")) throw new Error("Sign-in cancelled or invalid email.");
    const sanitizedEmail = emailPrompt.trim().toLowerCase().replace(/[^a-z0-9@._+-]/g, "");
    const mockUser = {
      email: sanitizedEmail,
      displayName: sanitizedEmail.split("@")[0],
      uid: `local-google-${Date.now()}`
    };
    localStorage.setItem(STORAGE_KEY_LOCAL_USER, JSON.stringify(mockUser));
    return mockUser;
  }
}

// Sign in with Email & Password
export async function loginWithEmail(email, password) {
  if (auth) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } else {
    if (!email || !password) throw new Error("Please provide both email and password.");
    const mockUser = {
      email: email.trim(),
      displayName: email.split("@")[0],
      uid: `local-email-${Date.now()}`
    };
    localStorage.setItem(STORAGE_KEY_LOCAL_USER, JSON.stringify(mockUser));
    return mockUser;
  }
}

// Register with Email & Password
export async function registerWithEmail(email, password) {
  if (auth) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  } else {
    if (!email || !password) throw new Error("Please provide email and password.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error("Please provide a valid email address.");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error("Password must contain both letters and numbers.");
    const sanitizedEmail = email.trim().toLowerCase();
    const mockUser = {
      email: sanitizedEmail,
      displayName: sanitizedEmail.split("@")[0],
      uid: `local-reg-${Date.now()}`
    };
    localStorage.setItem(STORAGE_KEY_LOCAL_USER, JSON.stringify(mockUser));
    return mockUser;
  }
}

// Sign Out
export async function logoutUser() {
  localStorage.removeItem(STORAGE_KEY_LOCAL_USER);
  if (auth) {
    await signOut(auth);
  }
  return true;
}

// Fetch all pandals
export async function fetchPandals() {
  if (isFirestoreAvailable && db) {
    try {
      const pandalsCol = collection(db, "pandals");
      const snapshot = await getDocs(pandalsCol);

      if (!snapshot.empty) {
        const fetchedList = [];
        snapshot.forEach(docSnap => {
          fetchedList.push({ id: docSnap.id, ...docSnap.data() });
        });

        localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(fetchedList));
        syncStatus.mode = "firestore";
        syncStatus.message = `Loaded ${fetchedList.length} pandals from Firestore`;
        syncStatus.lastSync = new Date().toISOString();
        return fetchedList;
      }
    } catch (error) {
      console.warn("⚠️ Failed to fetch from Firestore, falling back to local dataset:", error.message);
      syncStatus.mode = "local";
      syncStatus.message = "Local Cache (Firestore fetch error)";
    }
  }

  // Primary local source: src/data/pandals.json
  try {
    const res = await fetch("./src/data/pandals.json");
    if (res.ok) {
      const jsonPandals = await res.json();
      if (Array.isArray(jsonPandals) && jsonPandals.length > 0) {
        localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(jsonPandals));
        return jsonPandals;
      }
    }
  } catch (err) {
    console.warn("Could not fetch ./src/data/pandals.json:", err);
  }

  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length >= 100) {
        return parsed;
      }
    } catch (e) {
      console.error("Error reading cached pandals", e);
    }
  }

  localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(INITIAL_PANDALS));
  return INITIAL_PANDALS;
}

// Seed all pandals to Firestore
export async function seedPandalsToFirestore() {
  if (!isFirestoreAvailable || !db) {
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(INITIAL_PANDALS));
    return { success: true, count: INITIAL_PANDALS.length, mode: "local" };
  }

  try {
    const promises = INITIAL_PANDALS.map(pandal => {
      const docRef = doc(db, "pandals", pandal.id);
      return setDoc(docRef, {
        ...pandal,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    await Promise.all(promises);
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(INITIAL_PANDALS));
    syncStatus.lastSync = new Date().toISOString();
    return { success: true, count: INITIAL_PANDALS.length, mode: "firestore" };
  } catch (error) {
    console.error("Error seeding pandals to Firestore:", error);
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(INITIAL_PANDALS));
    return { success: false, error: error.message, mode: "local" };
  }
}

// Add a new pandal (Admin Only)
export async function addNewPandal(newPandal) {
  const pandalToSave = {
    ...newPandal,
    id: newPandal.id || `pandal-${Date.now()}`
  };

  let firestoreSaved = false;

  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "pandals", pandalToSave.id);
      await setDoc(docRef, {
        ...pandalToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      firestoreSaved = true;
    } catch (error) {
      console.warn("Could not save to Firestore, saving to local store:", error);
    }
  }

  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  list.unshift(pandalToSave);
  localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));

  return { success: true, pandal: pandalToSave, firestore: firestoreSaved };
}

// Update existing pandal (Admin Only) - Full deep update of all fields
export async function updatePandal(pandalId, updatedFields) {
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "pandals", pandalId);
      await updateDoc(docRef, {
        ...updatedFields,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.warn("Could not update Firestore, updating local store:", error);
    }
  }

  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const idx = list.findIndex(p => p.id === pandalId);
  if (idx !== -1) {
    list[idx] = { ...list[idx], ...updatedFields };
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
  }

  return { success: true };
}

// Delete pandal (Admin Only)
export async function deletePandal(pandalId) {
  if (isFirestoreAvailable && db) {
    try {
      const docRef = doc(db, "pandals", pandalId);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn("Could not delete from Firestore, deleting from local store:", error);
    }
  }

  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  list = list.filter(p => p.id !== pandalId);
  localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));

  return { success: true };
}

// Duplicate a pandal (Admin Only)
export async function duplicatePandal(pandalId) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const original = list.find(p => p.id === pandalId);
  if (!original) return { success: false, error: "Pandal not found" };

  const cloned = {
    ...JSON.parse(JSON.stringify(original)),
    id: `pandal-${Date.now()}`,
    name: `${original.name} (Copy)`,
    bengaliName: original.bengaliName ? `${original.bengaliName} (কপি)` : ""
  };

  await addNewPandal(cloned);
  return { success: true, pandal: cloned };
}

// Add Food Stall to a pandal (Admin Only)
export async function addFoodStallToPandal(pandalId, foodStall) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const pandal = list.find(p => p.id === pandalId);
  
  if (pandal) {
    if (!pandal.foodRadar) pandal.foodRadar = [];
    pandal.foodRadar.push(foodStall);
    
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "pandals", pandalId);
        await updateDoc(docRef, {
          foodRadar: pandal.foodRadar,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not sync food stall to Firestore:", error);
      }
    }
    
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
    return { success: true, pandal };
  }
  
  return { success: false, error: "Pandal not found" };
}

// Update specific Food Stall in a pandal (Admin Only)
export async function updateFoodStallInPandal(pandalId, foodIndex, updatedFood) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const pandal = list.find(p => p.id === pandalId);
  
  if (pandal && pandal.foodRadar && pandal.foodRadar[foodIndex] !== undefined) {
    pandal.foodRadar[foodIndex] = { ...pandal.foodRadar[foodIndex], ...updatedFood };
    
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "pandals", pandalId);
        await updateDoc(docRef, {
          foodRadar: pandal.foodRadar,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not update food stall in Firestore:", error);
      }
    }
    
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
    return { success: true, pandal };
  }
  return { success: false, error: "Food item not found" };
}

// Delete specific Food Stall from a pandal (Admin Only)
export async function deleteFoodStallFromPandal(pandalId, foodIndex) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const pandal = list.find(p => p.id === pandalId);
  
  if (pandal && pandal.foodRadar && pandal.foodRadar[foodIndex] !== undefined) {
    pandal.foodRadar.splice(foodIndex, 1);
    
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "pandals", pandalId);
        await updateDoc(docRef, {
          foodRadar: pandal.foodRadar,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not delete food stall in Firestore:", error);
      }
    }
    
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
    return { success: true, pandal };
  }
  return { success: false, error: "Food item not found" };
}

// Add Nearby Pandal (Admin Only)
export async function addNearbyToPandal(pandalId, nearbyObj) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const pandal = list.find(p => p.id === pandalId);
  
  if (pandal) {
    if (!pandal.nearbyPandals) pandal.nearbyPandals = [];
    pandal.nearbyPandals.push(nearbyObj);
    
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "pandals", pandalId);
        await updateDoc(docRef, {
          nearbyPandals: pandal.nearbyPandals,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not sync nearby to Firestore:", error);
      }
    }
    
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
    return { success: true, pandal };
  }
  return { success: false, error: "Pandal not found" };
}

// Update Nearby Pandal (Admin Only)
export async function updateNearbyInPandal(pandalId, nearbyIndex, updatedNearby) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const pandal = list.find(p => p.id === pandalId);
  
  if (pandal && pandal.nearbyPandals && pandal.nearbyPandals[nearbyIndex] !== undefined) {
    pandal.nearbyPandals[nearbyIndex] = { ...pandal.nearbyPandals[nearbyIndex], ...updatedNearby };
    
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "pandals", pandalId);
        await updateDoc(docRef, {
          nearbyPandals: pandal.nearbyPandals,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not update nearby in Firestore:", error);
      }
    }
    
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
    return { success: true, pandal };
  }
  return { success: false, error: "Nearby item not found" };
}

// Delete Nearby Pandal (Admin Only)
export async function deleteNearbyFromPandal(pandalId, nearbyIndex) {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  let list = cached ? JSON.parse(cached) : [...INITIAL_PANDALS];
  const pandal = list.find(p => p.id === pandalId);
  
  if (pandal && pandal.nearbyPandals && pandal.nearbyPandals[nearbyIndex] !== undefined) {
    pandal.nearbyPandals.splice(nearbyIndex, 1);
    
    if (isFirestoreAvailable && db) {
      try {
        const docRef = doc(db, "pandals", pandalId);
        await updateDoc(docRef, {
          nearbyPandals: pandal.nearbyPandals,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.warn("Could not delete nearby in Firestore:", error);
      }
    }
    
    localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(list));
    return { success: true, pandal };
  }
  return { success: false, error: "Nearby item not found" };
}

// Reset pandals to default seed (Admin Only)
export async function resetPandalsToInitialSeed() {
  localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(INITIAL_PANDALS));
  if (isFirestoreAvailable && db) {
    await seedPandalsToFirestore();
  }
  return { success: true, list: INITIAL_PANDALS };
}

// Export full Pandals dataset as JSON
export function exportPandalsJSON() {
  const cached = localStorage.getItem(STORAGE_KEY_PANDALS);
  return cached || JSON.stringify(INITIAL_PANDALS, null, 2);
}

// Import custom JSON array of Pandals (Admin Only)
export async function importPandalsJSON(jsonArray) {
  if (!Array.isArray(jsonArray)) throw new Error("Imported data must be an array of pandals.");
  
  localStorage.setItem(STORAGE_KEY_PANDALS, JSON.stringify(jsonArray));
  
  if (isFirestoreAvailable && db) {
    try {
      const promises = jsonArray.map(p => {
        const docRef = doc(db, "pandals", p.id || `pandal-${Date.now()}`);
        return setDoc(docRef, {
          ...p,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await Promise.all(promises);
    } catch (e) {
      console.warn("Firestore sync during import had errors:", e);
    }
  }
  
  return { success: true, count: jsonArray.length };
}

// Save Custom Firebase Credentials
export function saveFirebaseCredentials(configObj) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(configObj));
    initFirebase();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Get current sync status
export function getSyncStatus() {
  return syncStatus;
}
