// Main Application Orchestrator for Pujor Parikrama 2026
import { 
  initFirebase, 
  fetchPandals, 
  addNewPandal, 
  updatePandal,
  deletePandal,
  duplicatePandal,
  addFoodStallToPandal,
  updateFoodStallInPandal,
  deleteFoodStallFromPandal,
  addNearbyToPandal,
  updateNearbyInPandal,
  deleteNearbyFromPandal,
  seedPandalsToFirestore,
  resetPandalsToInitialSeed,
  exportPandalsJSON,
  importPandalsJSON,
  saveFirebaseCredentials, 
  getSyncStatus,
  subscribeToAuth,
  loginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logoutUser,
  ADMIN_EMAIL,
  safeEmailCompare
} from "./firebase.js";
import { generateItinerary, calculateDistanceKm } from "./planner.js";

// ==========================================
// XSS SANITIZER — Safe HTML Renderer
// ==========================================
/**
 * Strips all HTML tags except an explicit safe whitelist.
 * Use this instead of raw innerHTML for any user-supplied content.
 * Allowed tags: b, i, em, strong, br, p, ul, ol, li, span, a (href only, no JS)
 */
function sanitizeHTML(rawHtml) {
  if (!rawHtml || typeof rawHtml !== "string") return "";
  
  // Use a temporary DOM element to parse the HTML safely
  const template = document.createElement("template");
  template.innerHTML = rawHtml;
  const fragment = template.content;

  const ALLOWED_TAGS = new Set(["B","I","EM","STRONG","BR","P","UL","OL","LI","SPAN","A"]);
  const ALLOWED_ATTRS = { A: ["href", "title"] };

  function clean(node) {
    const toRemove = [];
    node.childNodes.forEach(child => {
      if (child.nodeType === Node.TEXT_NODE) return; // Text nodes are always safe
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tag = child.tagName.toUpperCase();
        if (!ALLOWED_TAGS.has(tag)) {
          // Replace disallowed element with its text content
          const text = document.createTextNode(child.textContent);
          child.parentNode.insertBefore(text, child);
          toRemove.push(child);
          return;
        }
        // Strip all attributes except the whitelist
        const allowedAttrList = ALLOWED_ATTRS[tag] || [];
        [...child.attributes].forEach(attr => {
          if (!allowedAttrList.includes(attr.name)) {
            child.removeAttribute(attr.name);
          }
          // Block javascript: href
          if (attr.name === "href" && /^\s*javascript:/i.test(attr.value)) {
            child.setAttribute("href", "#");
          }
        });
        // Force external links to open safely
        if (tag === "A") {
          child.setAttribute("rel", "noopener noreferrer");
          child.setAttribute("target", "_blank");
        }
        clean(child); // Recurse into children
      } else {
        toRemove.push(child); // Remove comments, processing instructions, etc.
      }
    });
    toRemove.forEach(el => el.remove());
  }

  clean(fragment);

  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);
  return wrapper.innerHTML;
}

// Global App State
const state = {
  pandals: [],
  filteredPandals: [],
  selectedZone: "All",
  selectedTheme: "All",
  searchQuery: "",
  sortBy: "default",
  savedPandalIds: new Set(JSON.parse(localStorage.getItem("pujor_saved_pandals") || "[]")),
  activeModalPandal: null,
  currentUser: null,
  isAdmin: false,
  authMode: "signin",
  cityMap: null,
  modalMap: null,
  plannerMap: null,
  isDhakPlaying: false,
  audioCtx: null,
  dhakIntervalId: null,
  currentItinerary: null
};

import { INITIAL_PANDALS } from "./data.js";

// Local art pool for image fallbacks
const LOCAL_ART_POOL = [
  "src/assets/art/hero.jpg",
  "src/assets/art/kumartuli.jpg",
  "src/assets/art/dhunuchi.jpg",
  "src/assets/art/sindoor.jpg",
  "src/assets/art/food.jpg"
];

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
  initFirebase();
  setupAuthSubscription();
  updateSyncStatusBadge();
  initCountdownTimer();
  setupEventListeners();

  // Load custom site settings if saved by admin
  const savedSub = localStorage.getItem("pujor_site_custom_subtitle");
  const savedImg = localStorage.getItem("pujor_site_custom_hero_img");
  if (savedSub) {
    const subtitle = document.getElementById("site-hero-subtitle");
    if (subtitle) subtitle.textContent = savedSub;
  }
  if (savedImg) {
    const bannerImg = document.getElementById("site-hero-banner-img");
    if (bannerImg) bannerImg.src = savedImg;
  }

  try {
    let list = await fetchPandals();
    if (!Array.isArray(list) || list.length < 52) {
      console.warn("Dataset returned less than 52 items, enforcing full 52 dataset from INITIAL_PANDALS.");
      list = INITIAL_PANDALS;
      localStorage.setItem("pujor_parikrama_local_pandals_v52", JSON.stringify(INITIAL_PANDALS));
    }
    state.pandals = list;
    state.filteredPandals = [...list];
    renderPandalsGrid();
    initCityOverviewMap();
    updateSavedCountBadge();
    
    // Default initial itinerary
    generateAndRenderItinerary({
      day: "Maha Ashtami",
      zone: "South Kolkata",
      startTimeStr: "16:00",
      endTimeStr: "23:00",
      pace: "standard"
    });

  } catch (err) {
    console.error("Error during initial load:", err);
  }
});

// ==========================================
// AUTHENTICATION & ADMIN PERMISSION STATE
// ==========================================
function setupAuthSubscription() {
  subscribeToAuth(({ user, isAdmin }) => {
    state.currentUser = user;
    state.isAdmin = isAdmin;

    console.log(`🔐 Auth State: User = ${user ? user.email : 'Guest'}, isAdmin = ${isAdmin}`);
    updateAdminUIState();
  });
}

function updateAdminUIState() {
  const adminElements = document.querySelectorAll(".admin-only-ui");
  const authBtn = document.getElementById("auth-btn");
  const authLabel = document.getElementById("auth-btn-label");
  const authIcon = document.getElementById("auth-btn-icon");

  if (state.isAdmin) {
    adminElements.forEach(el => el.classList.remove("hidden"));
    if (authLabel) authLabel.textContent = "👑 Admin (Logout)";
    if (authIcon) authIcon.className = "fa-solid fa-crown text-amber-300";
    if (authBtn) authBtn.classList.add("bg-amber-950/80", "border-amber-500/50", "text-amber-200");
  } else {
    adminElements.forEach(el => el.classList.add("hidden"));
    if (state.currentUser) {
      const displayName = state.currentUser.displayName || state.currentUser.email.split('@')[0];
      if (authLabel) authLabel.textContent = `${displayName} (Logout)`;
      if (authIcon) authIcon.className = "fa-solid fa-circle-user text-emerald-400";
      if (authBtn) {
        authBtn.classList.add("bg-emerald-950/60", "border-emerald-500/40", "text-emerald-200");
        authBtn.classList.remove("bg-amber-950/80", "border-amber-500/50", "text-amber-200");
      }
    } else {
      if (authLabel) authLabel.textContent = "Sign In";
      if (authIcon) authIcon.className = "fa-solid fa-user-circle text-royalGold";
      if (authBtn) {
        authBtn.classList.remove("bg-amber-950/80", "border-amber-500/50", "text-amber-200", "bg-emerald-950/60", "border-emerald-500/40", "text-emerald-200");
      }
    }
  }

  // Update modal toolbar if open
  const modalToolbar = document.getElementById("modal-admin-toolbar");
  if (modalToolbar) {
    if (state.isAdmin) modalToolbar.classList.remove("hidden");
    else modalToolbar.classList.add("hidden");
  }

  renderAdminPandalsTable();
  renderPandalsGrid(); // Refresh cards to show quick edit triggers if admin
}

// ==========================================
// COUNTDOWN TIMER
// ==========================================
function initCountdownTimer() {
  const targetDate = new Date("2026-10-16T06:00:00+05:30").getTime();
  const timerElem = document.getElementById("puja-countdown-timer");
  if (!timerElem) return;

  function update() {
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (diff <= 0) {
      timerElem.textContent = "PUJA IS LIVE! শুভ শারদীয়া!";
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    timerElem.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }

  update();
  setInterval(update, 1000);
}

// ==========================================
// PANDAL DIRECTORY RENDERING & FILTERING
// ==========================================
function applyFiltersAndSort() {
  let result = [...state.pandals];

  if (state.selectedZone !== "All") {
    const sel = state.selectedZone.toLowerCase();
    result = result.filter(p => {
      if (!p.zone) return false;
      const pz = p.zone.toLowerCase();
      if (pz === sel) return true;
      if (sel.includes("north") && pz.includes("north")) return true;
      if (sel.includes("south") && pz.includes("south")) return true;
      if (sel.includes("central") && pz.includes("central")) return true;
      if ((sel.includes("salt") || sel.includes("east")) && (pz.includes("salt") || pz.includes("east"))) return true;
      if (sel.includes("howrah") && pz.includes("howrah")) return true;
      return false;
    });
  }

  if (state.selectedTheme && state.selectedTheme !== "All") {
    const st = state.selectedTheme.toLowerCase();
    result = result.filter(p => {
      const text = `${p.themeSummary || ''} ${p.artConcept || ''} ${p.name || ''} ${(p.highlights || []).join(' ')}`.toLowerCase();
      if (st === "heritage") return text.includes("heritage") || text.includes("tradition") || text.includes("historic") || text.includes("daker") || text.includes("rajbari") || text.includes("ekchala");
      if (st === "artistic") return text.includes("art") || text.includes("sculpt") || text.includes("award") || text.includes("design") || text.includes("concept");
      if (st === "eco") return text.includes("eco") || text.includes("nature") || text.includes("bamboo") || text.includes("clay") || text.includes("green") || text.includes("environment");
      if (st === "literary") return text.includes("literary") || text.includes("book") || text.includes("writer") || text.includes("college") || text.includes("boi");
      if (st === "community") return text.includes("community") || text.includes("neighborhood") || text.includes("local") || text.includes("palli") || text.includes("sangha");
      return text.includes(st);
    });
  }

  if (state.searchQuery.trim() !== "") {
    const q = state.searchQuery.toLowerCase().trim();
    result = result.filter(p => {
      return (
        p.name.toLowerCase().includes(q) ||
        (p.bengaliName && p.bengaliName.toLowerCase().includes(q)) ||
        (p.nearestMetro && p.nearestMetro.toLowerCase().includes(q)) ||
        (p.themeSummary && p.themeSummary.toLowerCase().includes(q)) ||
        (p.history && p.history.toLowerCase().includes(q)) ||
        (p.artConcept && p.artConcept.toLowerCase().includes(q)) ||
        (p.sculptor && p.sculptor.toLowerCase().includes(q)) ||
        (p.zone && p.zone.toLowerCase().includes(q))
      );
    });
  }

  if (state.sortBy === "name-asc") {
    result.sort((a, b) => a.name.localeCompare(b.name));
  } else if (state.sortBy === "established") {
    result.sort((a, b) => (a.establishedYear || 2000) - (b.establishedYear || 2000));
  } else if (state.sortBy === "zone") {
    result.sort((a, b) => a.zone.localeCompare(b.zone));
  }

  state.filteredPandals = result;
  renderPandalsGrid();
}

function renderPandalsGrid() {
  const grid = document.getElementById("pandals-grid");
  const countElem = document.getElementById("displayed-pandals-count");
  const noResultsElem = document.getElementById("no-pandals-found");
  const statTotal = document.getElementById("stat-total-pandals");

  if (statTotal) statTotal.textContent = `${state.pandals.length}+`;
  if (countElem) countElem.textContent = state.filteredPandals.length;

  if (state.filteredPandals.length === 0) {
    grid.innerHTML = "";
    noResultsElem.classList.remove("hidden");
    return;
  }

  noResultsElem.classList.add("hidden");

  // Zone badge CSS classes
  const zoneBadgeClass = {
    "North Kolkata": "zone-north",
    "South Kolkata": "zone-south",
    "Central": "zone-central",
    "Salt Lake/East": "zone-east",
    "Howrah": "zone-howrah"
  };

  // Helper function to derive theme pill info
  function getThemePill(pandal, idx) {
    const text = `${pandal.themeSummary || ''} ${pandal.artConcept || ''} ${pandal.name || ''}`.toLowerCase();
    if (text.includes("heritage") || text.includes("tradition") || text.includes("historic") || text.includes("daker") || idx % 5 === 0) {
      return { label: "HERITAGE THEME", bg: "bg-[#C56B35]", text: "text-white" };
    }
    if (text.includes("art") || text.includes("sculpt") || text.includes("concept") || idx % 5 === 1) {
      return { label: "ARTISTIC THEME", bg: "bg-[#D94A32]", text: "text-white" };
    }
    if (text.includes("eco") || text.includes("nature") || text.includes("bamboo") || idx % 5 === 2) {
      return { label: "ECO THEME", bg: "bg-[#50694D]", text: "text-white" };
    }
    if (text.includes("book") || text.includes("literary") || text.includes("college") || idx % 5 === 3) {
      return { label: "LITERARY THEME", bg: "bg-[#E9B548]", text: "text-[#241B17]" };
    }
    return { label: "COMMUNITY THEME", bg: "bg-[#241B17]", text: "text-[#FFF8ED]" };
  }

  const pandalsHTML = state.filteredPandals.map((pandal, idx) => {
    const isSaved = state.savedPandalIds.has(pandal.id);
    const badgeClass = zoneBadgeClass[pandal.zone] || "zone-central";
    const localFallback = LOCAL_ART_POOL[idx % LOCAL_ART_POOL.length];
    const safeImage = (pandal.image && !pandal.image.includes("unsplash")) ? pandal.image : localFallback;
    const isFeatured = idx === 0 && !state.searchQuery && state.selectedZone === "All" && state.selectedTheme === "All";

    const bookmarkIcon = isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
    const bookmarkColor = isSaved ? 'color: #D94A32;' : 'color: #6B5B52;';

    if (isFeatured) {
      // --- FEATURED CARD: Large Editorial Split Showcase (Matching Image 2 Centerpiece) ---
      return `
        <div class="relative w-full bg-[#FFFDF6] border border-[#241B17]/12 rounded-sm shadow-xl overflow-hidden mb-10 transform hover:-translate-y-1 transition-all duration-300">
          <div class="paper-tape-yellow"></div>
          
          <div class="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <!-- Image Area (7 cols on lg) -->
            <div class="lg:col-span-7 relative min-h-[360px] lg:min-h-[440px] overflow-hidden group">
              <img
                src="${safeImage}"
                alt="${pandal.name}"
                loading="lazy"
                onerror="this.onerror=null;this.src='${localFallback}';"
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              >
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#FFFDF6]/95 hidden lg:block"></div>
              <div class="absolute inset-0 bg-gradient-to-t from-[#241B17]/70 via-transparent to-transparent lg:hidden"></div>
              
              <!-- Badges Top Left -->
              <div class="absolute top-4 left-4 flex items-center gap-2 z-10">
                <span class="px-3 py-1 bg-[#E9B548] text-[#241B17] font-bold text-[10px] uppercase tracking-widest rounded-xs shadow-sm font-sans flex items-center gap-1">
                  <i class="fa-solid fa-crown text-[10px]"></i> FEATURED
                </span>
                <span class="zone-badge ${badgeClass} shadow-sm">${pandal.zone}</span>
              </div>

              <!-- Theme Badge Circular Terracotta Stamp Top Right (Matching Image 2) -->
              <div class="absolute top-4 right-4 z-10 w-24 h-24 rounded-full bg-[#D94A32] text-white p-2.5 flex flex-col items-center justify-center text-center shadow-lg border-2 border-dashed border-white/40 transform rotate-6 hover:rotate-0 transition-transform cursor-pointer">
                <span class="text-[8px] font-bold uppercase tracking-widest leading-none text-[#E9B548] font-sans">THEME</span>
                <span class="font-serif text-xs font-bold leading-tight mt-1">TRADITION &amp; REIMAGINED</span>
              </div>

              <!-- Location Tag Bottom Left -->
              <div class="absolute bottom-4 left-4 bg-[#FFF8ED]/95 px-3 py-1.5 rounded-xs border border-[#241B17]/15 text-[#241B17] text-xs font-bold font-sans flex items-center gap-1.5 shadow-sm">
                <i class="fa-solid fa-location-dot text-[#D94A32]"></i> ${pandal.address ? pandal.address.split(',')[1] || pandal.address.split(',')[0] : pandal.zone}
              </div>

              ${state.isAdmin ? `
                <button onclick="window.pujorApp.openEditPandal('${pandal.id}')" title="Edit" class="absolute top-4 right-32 w-8 h-8 rounded-full bg-[#D94A32] text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform border-none cursor-pointer">
                  <i class="fa-solid fa-pen-to-square text-xs"></i>
                </button>
              ` : ''}
            </div>

            <!-- Content Area (5 cols on lg) -->
            <div class="lg:col-span-5 p-7 lg:p-9 flex flex-col justify-between bg-[#FFFDF6] relative">
              <div>
                <div class="text-[10px] font-bold uppercase tracking-widest text-[#D94A32] font-sans flex items-center gap-2 mb-2">
                  <span class="w-4 h-px bg-[#D94A32]"></span>
                  <span>EST. ${pandal.establishedYear || '1932'}</span>
                </div>
                
                <h3 class="font-serif font-extrabold text-2xl lg:text-3xl text-[#241B17] leading-tight mb-1">
                  ${pandal.name}
                </h3>
                ${pandal.bengaliName ? `<p class="font-bengali text-xs text-[#D94A32] mb-3">${pandal.bengaliName}</p>` : ''}
                
                <p class="text-xs text-[#6B5B52] leading-relaxed font-sans mb-5 line-clamp-3">
                  ${pandal.themeSummary || pandal.artConcept || 'A timeless celebration of art and devotion, this iconic pandal blends tradition with contemporary design.'}
                </p>

                <div class="grid grid-cols-2 gap-2.5 mb-5 p-3 bg-[#F5EBDC]/60 rounded-xs border border-[#241B17]/10 text-xs font-sans">
                  <div>
                    <span class="block text-[9px] text-[#6B5B52] uppercase font-bold">Nearest Metro</span>
                    <span class="font-semibold text-[#241B17] truncate block"><i class="fa-solid fa-train-subway text-[#D94A32] text-[10px] mr-1"></i> ${pandal.nearestMetro || 'Central Metro'}</span>
                  </div>
                  <div>
                    <span class="block text-[9px] text-[#6B5B52] uppercase font-bold">Crowd Level</span>
                    <span class="font-semibold text-[#241B17] block"><i class="fa-solid fa-users text-[#50694D] text-[10px] mr-1"></i> ${pandal.crowdLevel || 'High'}</span>
                  </div>
                </div>
              </div>

              <!-- Actions -->
              <div class="pt-4 border-t border-[#241B17]/10 flex flex-wrap items-center gap-2.5">
                <button
                  data-open-modal="${pandal.id}"
                  class="open-details-btn px-5 py-2.5 bg-[#D94A32] hover:bg-[#A8321F] text-white font-sans font-bold text-xs uppercase tracking-wider rounded-xs transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  EXPLORE <i class="fa-solid fa-arrow-right text-[10px]"></i>
                </button>
                <button
                  data-pandal-id="${pandal.id}"
                  class="toggle-bookmark-btn px-3.5 py-2.5 bg-transparent border border-[#241B17]/20 hover:border-[#D94A32] text-[#241B17] font-sans font-bold text-xs rounded-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <i class="${bookmarkIcon}" style="${bookmarkColor}"></i>
                  <span>${isSaved ? 'Saved' : 'Save'}</span>
                </button>
                <button
                  data-quick-plan="${pandal.id}"
                  class="quick-plan-btn px-3.5 py-2.5 bg-[#50694D]/10 hover:bg-[#50694D] hover:text-white text-[#50694D] border border-[#50694D]/30 font-sans font-bold text-xs rounded-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <i class="fa-solid fa-plus text-[10px]"></i> Plan
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // --- STANDARD CARD: Collage Bento Asymmetric Item ---
    const themePill = getThemePill(pandal, idx);
    const hasHibiscus = idx % 7 === 2; // Hibiscus graphic on Eco cards
    const hasPaperTape = idx % 7 === 3; // Washi tape on Literary cards

    return `
      <div class="pandal-card group relative flex flex-col rounded-sm bg-[#FFFDF6] border border-[#241B17]/12 shadow-sm hover:shadow-xl transition-all duration-300">
        
        ${hasPaperTape ? '<div class="paper-tape-yellow"></div>' : ''}
        ${hasHibiscus ? `
          <div class="absolute -top-4 -right-4 z-20 pointer-events-none transform rotate-12">
            <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-12 h-12">
              <path d="M40 40 C30 15 10 25 25 40 Z" fill="#D94A32" stroke="#241B17" stroke-width="1.5"/>
              <path d="M40 40 C65 15 75 35 55 45 Z" fill="#D94A32" stroke="#241B17" stroke-width="1.5"/>
              <path d="M40 40 C60 65 40 75 30 60 Z" fill="#D94A32" stroke="#241B17" stroke-width="1.5"/>
              <path d="M40 40 C15 65 5 45 20 35 Z" fill="#D94A32" stroke="#241B17" stroke-width="1.5"/>
              <path d="M40 40 C20 10 50 5 45 30 Z" fill="#D94A32" stroke="#241B17" stroke-width="1.5"/>
              <circle cx="40" cy="40" r="5" fill="#E9B548" stroke="#241B17" stroke-width="1"/>
              <line x1="40" y1="40" x2="52" y2="20" stroke="#E9B548" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        ` : ''}

        <!-- Card Image -->
        <div class="card-image-wrap relative h-52 overflow-hidden bg-[#E6D8C3]">
          <img
            src="${safeImage}"
            alt="${pandal.name}"
            loading="lazy"
            onerror="this.onerror=null;this.src='${localFallback}';"
            class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          >
          <div class="absolute inset-0 bg-gradient-to-t from-[#241B17]/50 via-transparent to-transparent"></div>
          
          <!-- Zone Badge Top Left -->
          <div class="absolute top-3 left-3 z-10">
            <span class="zone-badge ${badgeClass} shadow-sm">${pandal.zone}</span>
          </div>

          <!-- Bookmark & Admin Edit Top Right -->
          <div class="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            ${state.isAdmin ? `
              <button onclick="window.pujorApp.openEditPandal('${pandal.id}')" title="Edit" class="w-7 h-7 rounded-full bg-[#D94A32] text-white flex items-center justify-center border-none cursor-pointer shadow-sm">
                <i class="fa-solid fa-pen-to-square text-[10px]"></i>
              </button>
            ` : ''}
            <button
              data-pandal-id="${pandal.id}"
              class="toggle-bookmark-btn w-7 h-7 rounded-xs bg-[#FFF8ED]/90 border border-[#241B17]/15 flex items-center justify-center cursor-pointer shadow-sm hover:border-[#D94A32] transition"
              title="${isSaved ? 'Remove Bookmark' : 'Save Pandal'}"
            >
              <i class="${bookmarkIcon}" style="font-size:11px;${bookmarkColor}"></i>
            </button>
          </div>

          <!-- Nearest Metro Tag Bottom Left -->
          <div class="absolute bottom-2.5 left-3 text-[10px] font-sans font-bold text-white flex items-center gap-1 bg-[#241B17]/70 px-2 py-0.5 rounded-xs backdrop-blur-xs">
            <i class="fa-solid fa-train-subway text-[#E9B548] text-[9px]"></i>
            <span class="truncate max-w-[160px]">${pandal.nearestMetro || 'Metro'}</span>
          </div>
        </div>

        <!-- Card Body -->
        <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div>
            <h3 class="font-serif font-bold text-lg text-[#241B17] leading-snug group-hover:text-[#D94A32] transition line-clamp-1">
              ${pandal.name}
            </h3>
            ${pandal.bengaliName ? `<p class="font-bengali text-xs text-[#D94A32] mt-0.5">${pandal.bengaliName}</p>` : ''}
            
            <p class="text-xs text-[#6B5B52] leading-relaxed font-sans mt-2 line-clamp-2">
              ${pandal.themeSummary || 'An iconic community Durga Puja installation celebrating authentic Bengali craftsmanship and heritage art.'}
            </p>
          </div>

          <!-- Bottom Footer Row: Theme Tag & Actions -->
          <div class="pt-3 border-t border-[#241B17]/10 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <span class="inline-block px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-xs font-sans ${themePill.bg} ${themePill.text}">
                ${themePill.label}
              </span>
              ${pandal.establishedYear ? `<span class="text-[10px] font-sans font-bold text-[#6B5B52]">Est. ${pandal.establishedYear}</span>` : ''}
            </div>

            <div class="flex items-center gap-2">
              <button
                data-open-modal="${pandal.id}"
                class="open-details-btn flex-1 py-2 px-3 bg-transparent border border-[#241B17]/20 hover:bg-[#D94A32] hover:border-[#D94A32] hover:text-white text-[#241B17] font-sans font-bold text-[10px] uppercase tracking-wider rounded-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>EXPLORE</span> <i class="fa-solid fa-arrow-right text-[9px]"></i>
              </button>
              <button
                data-quick-plan="${pandal.id}"
                class="quick-plan-btn p-2 bg-[#50694D]/10 hover:bg-[#50694D] hover:text-white text-[#50694D] border border-[#50694D]/25 rounded-xs transition cursor-pointer"
                title="Add to Route Itinerary"
              >
                <i class="fa-solid fa-plus text-[10px]"></i>
              </button>
            </div>
          </div>
        </div>

      </div>
    `;
  });

  // Render Layout: Featured Card on top (if present), then asymmetric bento grid
  const featuredHTML = state.filteredPandals.length > 0 && (!state.searchQuery && state.selectedZone === "All" && state.selectedTheme === "All") ? pandalsHTML[0] : '';
  const restHTML = (state.searchQuery || state.selectedZone !== "All" || state.selectedTheme !== "All") ? pandalsHTML : pandalsHTML.slice(1);

  grid.innerHTML = featuredHTML + (restHTML.length > 0 ? `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
      ${restHTML.join('')}
    </div>
  ` : '');

  // Attach event listeners to newly rendered elements
  document.querySelectorAll(".open-details-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-open-modal");
      openPandalModal(id);
    });
  });

  document.querySelectorAll(".toggle-bookmark-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-pandal-id");
      toggleSavePandal(id);
    });
  });

  document.querySelectorAll(".quick-plan-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-quick-plan");
      const pandal = state.pandals.find(p => p.id === id);
      if (pandal) {
        const zoneSelect = document.getElementById("plan-zone");
        if (zoneSelect) zoneSelect.value = pandal.zone;
        document.getElementById("smart-planner").scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

// ==========================================
// INTERACTIVE PANDAL MODAL CONTROLLER
// ==========================================
export function openPandalModal(pandalId) {
  const pandal = state.pandals.find(p => p.id === pandalId);
  if (!pandal) return;

  state.activeModalPandal = pandal;
  const modal = document.getElementById("pandal-details-modal");
  
  // Header Info
  document.getElementById("modal-banner-img").src = (pandal.image && !pandal.image.includes("unsplash")) ? pandal.image : "src/assets/art/hero.jpg";
  document.getElementById("modal-pandal-name").textContent = pandal.name;
  document.getElementById("modal-pandal-bengali").textContent = pandal.bengaliName || "";
  document.getElementById("modal-zone-badge").textContent = pandal.zone;
  document.getElementById("modal-metro-pill").innerHTML = `<i class="fa-solid fa-train-subway mr-1"></i> ${pandal.nearestMetro}`;
  document.getElementById("modal-crowd-pill").innerHTML = `<i class="fa-solid fa-users mr-1"></i> ${pandal.crowdLevel || 'Moderate'} Footfall`;
  
  // Tab 1: History & Theme
  document.getElementById("modal-art-concept").textContent = pandal.artConcept || pandal.themeSummary;
  document.getElementById("modal-history").textContent = pandal.history || "Durga Puja has been celebrated with grand fervor by this club for decades.";
  document.getElementById("modal-sculptor").textContent = pandal.sculptor || "Kumartuli Master Craftsman";
  document.getElementById("modal-lighting").textContent = pandal.lighting || "Chandannagar Lighting Maestro";
  document.getElementById("modal-established").textContent = pandal.establishedYear ? `Est. ${pandal.establishedYear}` : "Heritage";

  const highlightsContainer = document.getElementById("modal-highlights-container");
  const highlights = pandal.highlights || ["Grand Architectural Facade", "Traditional Daaker Saaj", "Chandannagar Illuminations"];
  highlightsContainer.innerHTML = highlights.map(h => `
    <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:2px;font-size:11px;font-weight:700;font-family:'Space Grotesk',sans-serif;background:rgba(192,57,43,0.08);color:#C0392B;border:1px solid rgba(192,57,43,0.2);">
      <i class="fa-solid fa-star" style="font-size:9px;"></i> ${h}
    </span>
  `).join("");

  // Tab 2: Map & Route Info
  document.getElementById("modal-address").innerHTML = `<i class="fa-solid fa-location-dot text-crimson-600 mr-1.5"></i> ${pandal.address || pandal.name + ', Kolkata'}`;
  document.getElementById("modal-gmaps-link").href = `https://www.google.com/maps/search/?api=1&query=${pandal.coordinates.lat},${pandal.coordinates.lng}`;
  document.getElementById("modal-transit-advisory").textContent = `Nearest Metro: ${pandal.nearestMetro}. Metro Line: ${pandal.metroLine || 'Kolkata Metro'}. Shared autos and walking paths connect directly to the entrance gate.`;

  // Tab 3: Nearby Pandals
  const nearbyList = document.getElementById("modal-nearby-list");
  if (pandal.nearbyPandals && pandal.nearbyPandals.length > 0) {
    nearbyList.innerHTML = pandal.nearbyPandals.map(np => `
      <div style="background:#F5EDD6;padding:12px;border-radius:2px;border:1px solid rgba(26,26,26,0.1);transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(192,57,43,0.3)'" onmouseout="this.style.borderColor='rgba(26,26,26,0.1)'">
        <h5 style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#1A1A1A;margin:0;">${np.name}</h5>
        <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between;font-family:'Space Grotesk',sans-serif;font-size:11px;color:#5C5347;">
          <span><i class="fa-solid fa-route" style="color:#C0392B;margin-right:3px;"></i> ${np.distanceKm} km</span>
          <span style="font-weight:700;color:#2C4A2E;">🚶 ~${np.walkTimeMin} min</span>
        </div>
      </div>
    `).join("");
  } else {
    nearbyList.innerHTML = `<p style="font-size:12px;color:#5C5347;grid-column:span 3;">Check the city map for adjacent pujas within your walking radius.</p>`;
  }

  // Tab 4: Food Radar
  renderModalFoodRadarList(pandal);

  // Footer bookmark button
  const isSaved = state.savedPandalIds.has(pandal.id);
  const bookmarkBtn = document.getElementById("modal-bookmark-btn");
  bookmarkBtn.innerHTML = `
    <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark mr-1"></i>
    <span>${isSaved ? 'Saved in Itinerary' : 'Add to Planner'}</span>
  `;

  // Update Admin Toolbar in modal
  const adminToolbar = document.getElementById("modal-admin-toolbar");
  if (state.isAdmin) {
    adminToolbar.classList.remove("hidden");
  } else {
    adminToolbar.classList.add("hidden");
  }

  switchModalTab("tab-history");

  modal.classList.remove("hidden");
  document.body.classList.add("overflow-hidden");

  setTimeout(() => {
    initOrUpdateModalMap(pandal);
  }, 100);
}

function renderModalFoodRadarList(pandal) {
  const foodList = document.getElementById("modal-food-list");
  if (pandal.foodRadar && pandal.foodRadar.length > 0) {
    foodList.innerHTML = pandal.foodRadar.map((food, fIdx) => `
      <div style="background:#F5EDD6;padding:12px;border-radius:2px;border:1px solid rgba(26,26,26,0.1);position:relative;transition:border-color 0.2s;" onmouseover="this.style.borderColor='rgba(192,57,43,0.3)'" onmouseout="this.style.borderColor='rgba(26,26,26,0.1)'">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
          <span style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#1A1A1A;">${food.name}</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:700;color:#D4A017;">${food.rating}</span>
            ${state.isAdmin ? `
              <button
                onclick="window.pujorApp.handleDeleteFood('${pandal.id}', ${fIdx})"
                style="width:20px;height:20px;border-radius:50%;background:#F8D7DA;color:#C0392B;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;"
                title="Delete food stall"
              >
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
        <p style="font-size:11px;color:#5C5347;margin:0;">${food.specialty}</p>
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(26,26,26,0.08);display:flex;align-items:center;justify-content:space-between;font-family:'Space Grotesk',sans-serif;font-size:10px;color:#5C5347;">
          <span><i class="fa-solid fa-location-dot" style="color:#C0392B;margin-right:3px;"></i> ${food.distance || '150m'}</span>
          <span style="font-weight:700;color:#2C4A2E;">${food.price || '₹₹'}</span>
        </div>
      </div>
    `).join("");
  } else {
    foodList.innerHTML = `<p style="font-size:12px;color:#5C5347;grid-column:span 3;">Local street food stalls and kathi roll joints line the entrance lanes.</p>`;
  }
}

function closeModal() {
  const modal = document.getElementById("pandal-details-modal");
  modal.classList.add("hidden");
  document.body.classList.remove("overflow-hidden");
  state.activeModalPandal = null;
}

function switchModalTab(tabId) {
  document.querySelectorAll(".modal-tab-btn").forEach(btn => {
    if (btn.getAttribute("data-tab") === tabId) {
      btn.classList.add("active");
      btn.classList.remove("border-transparent");
    } else {
      btn.classList.remove("active");
      btn.classList.add("border-transparent");
    }
  });

  document.querySelectorAll(".modal-tab-pane").forEach(pane => {
    if (pane.id === tabId) {
      pane.classList.remove("hidden");
    } else {
      pane.classList.add("hidden");
    }
  });

  if (tabId === "tab-map" && state.modalMap) {
    setTimeout(() => {
      state.modalMap.invalidateSize();
    }, 50);
  }
}

function initOrUpdateModalMap(pandal) {
  const container = document.getElementById("modal-leaflet-map");
  if (!container) return;

  const lat = pandal.coordinates.lat;
  const lng = pandal.coordinates.lng;

  if (!state.modalMap) {
    state.modalMap = L.map("modal-leaflet-map", {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(state.modalMap);
  } else {
    state.modalMap.setView([lat, lng], 16);
    state.modalMap.eachLayer(layer => {
      if (layer instanceof L.Marker) {
        state.modalMap.removeLayer(layer);
      }
    });
  }

  const customIcon = L.divIcon({
    className: 'custom-leaflet-marker-wrap',
    html: `<div class="custom-leaflet-marker w-10 h-10 text-xs">🛕</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });

  L.marker([lat, lng], { icon: customIcon })
    .addTo(state.modalMap)
    .bindPopup(`<b>${pandal.name}</b><br><span style="font-size:11px">${pandal.nearestMetro}</span>`)
    .openPopup();

  state.modalMap.invalidateSize();
}

// ==========================================
// CITY OVERVIEW LEAFLET MAP
// ==========================================
function initCityOverviewMap() {
  const mapContainer = document.getElementById("city-overview-map");
  if (!mapContainer || state.cityMap) return;

  // Set default center to Kolkata (Lat: 22.5726, Lng: 88.3639) with zoom 11.5
  state.cityMap = L.map("city-overview-map", {
    zoomControl: true,
    attributionControl: false
  }).setView([22.5726, 88.3639], 11.5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(state.cityMap);

  renderCityMapMarkers();
}

function renderCityMapMarkers() {
  if (!state.cityMap || !state.pandals) return;

  // Clear existing markers if any
  state.cityMap.eachLayer(layer => {
    if (layer instanceof L.Marker) {
      state.cityMap.removeLayer(layer);
    }
  });

  const bounds = [];

  state.pandals.forEach((pandal) => {
    if (!pandal.coordinates || typeof pandal.coordinates.lat !== 'number' || typeof pandal.coordinates.lng !== 'number') return;

    const zoneEmoji = {
      "North": "🟡",
      "North Kolkata": "🟡",
      "South": "🔵",
      "South Kolkata": "🔵",
      "Central": "🔴",
      "East/Salt Lake": "🟢",
      "Salt Lake/East": "🟢",
      "Howrah": "🟣"
    }[pandal.zone] || "🛕";

    const markerIcon = L.divIcon({
      className: 'city-pandal-marker',
      html: `<div class="custom-leaflet-marker w-8 h-8 text-[11px]">${zoneEmoji}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    const marker = L.marker([pandal.coordinates.lat, pandal.coordinates.lng], { icon: markerIcon })
      .addTo(state.cityMap);

    bounds.push([pandal.coordinates.lat, pandal.coordinates.lng]);

    const popupContent = `
      <div style="min-width: 180px; padding: 4px;">
        <h4 style="font-weight: bold; font-size: 13px; color: #D4AF37; margin-bottom: 2px;">${pandal.name}</h4>
        <div style="font-size: 11px; color: #F3E5AB; margin-bottom: 4px;">${pandal.zone} ${pandal.address ? '• ' + pandal.address : ''}</div>
        <p style="font-size: 11px; color: #ddd; margin-bottom: 8px;">${pandal.themeSummary ? pandal.themeSummary.substring(0, 80) + '...' : ''}</p>
        <button onclick="window.pujorApp.openModal('${pandal.id}')" style="background:#8B0000; color:#fff; border:1px solid #D4AF37; border-radius:6px; font-size:11px; font-weight:bold; padding:4px 8px; width:100%; cursor:pointer;">
          View Details
        </button>
      </div>
    `;

    marker.bindPopup(popupContent);
  });

  if (bounds.length > 0) {
    state.cityMap.fitBounds(bounds, { padding: [30, 30] });
  }
}

// ==========================================
// SMART ITINERARY GENERATOR
// ==========================================
function triggerItineraryGeneration() {
  const day = document.getElementById("plan-day").value;
  const zone = document.getElementById("plan-zone").value;
  const startTimeStr = document.getElementById("plan-start-time").value;
  const endTimeStr = document.getElementById("plan-end-time").value;
  const pace = document.getElementById("plan-pace").value;

  generateAndRenderItinerary({
    day,
    zone,
    startTimeStr,
    endTimeStr,
    pace
  });
}

function generateAndRenderItinerary(config) {
  const itinerary = generateItinerary({
    allPandals: state.pandals,
    ...config
  });

  state.currentItinerary = itinerary;
  const container = document.getElementById("itinerary-results-container");
  if (!container) return;

  if (itinerary.stops.length === 0) {
    container.innerHTML = `
      <div class="glass-festive-dark rounded-2xl p-8 text-center border border-royalGold/30">
        <p class="text-sm text-amber-200">No pandals could fit within the specified time window. Try extending your end time or choosing an express pace.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="glass-festive-dark rounded-3xl p-6 sm:p-8 border border-royalGold/30 shadow-2xl space-y-8" id="print-itinerary-area">
      
      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-royalGold/20">
        <div>
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-crimson-950 text-royalGold border border-royalGold/30 mb-2">
            <i class="fa-solid fa-flag-checkered"></i> ${itinerary.day} Itinerary
          </div>
          <h3 class="text-2xl sm:text-3xl font-serifHeading font-bold gold-foil-text">
            ${itinerary.zone === 'All' ? 'All-Kolkata Grand Tour' : itinerary.zone + ' Sequence'}
          </h3>
          <p class="text-xs text-amber-200/70 mt-1">
            Paced for ${itinerary.pace} exploration with minimal transit backtracking.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <div class="bg-festiveCharcoal-900 px-4 py-2 rounded-xl border border-royalGold/20 text-center">
            <div class="text-xs text-amber-200/60 uppercase">Stops</div>
            <div class="text-lg font-bold text-royalGold font-mono">${itinerary.totalPandals} Pandals</div>
          </div>
          <div class="bg-festiveCharcoal-900 px-4 py-2 rounded-xl border border-royalGold/20 text-center">
            <div class="text-xs text-amber-200/60 uppercase">Window</div>
            <div class="text-lg font-bold text-amber-100 font-mono">${itinerary.startTime} - ${itinerary.endTime}</div>
          </div>
          <div class="bg-festiveCharcoal-900 px-4 py-2 rounded-xl border border-royalGold/20 text-center">
            <div class="text-xs text-amber-200/60 uppercase">Est. Distance</div>
            <div class="text-lg font-bold text-emerald-400 font-mono">~${itinerary.totalDistanceKm} km</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button id="print-plan-btn" class="px-3.5 py-2 rounded-xl bg-festiveCharcoal-800 hover:bg-festiveCharcoal-700 text-royalGold border border-royalGold/30 text-xs font-bold transition flex items-center gap-1.5">
            <i class="fa-solid fa-print"></i>
            <span>Print PDF</span>
          </button>
          <button id="copy-plan-btn" class="px-3.5 py-2 rounded-xl bg-royalGold hover:bg-royalGold-accent text-festiveCharcoal-900 text-xs font-bold transition flex items-center gap-1.5">
            <i class="fa-solid fa-share-nodes"></i>
            <span>Share Trip</span>
          </button>
        </div>
      </div>

      <div class="space-y-2">
        <h4 class="text-xs font-bold uppercase tracking-wider text-royalGold flex items-center gap-1.5">
          <i class="fa-solid fa-route"></i> Sequential Route Map
        </h4>
        <div class="h-64 sm:h-80 rounded-2xl overflow-hidden border border-royalGold/30 shadow-inner">
          <div id="planner-route-map" class="w-full h-full z-10"></div>
        </div>
      </div>

      <div class="space-y-4">
        <h4 class="text-xs font-bold uppercase tracking-wider text-royalGold flex items-center gap-1.5">
          <i class="fa-solid fa-timeline"></i> Timeline Schedule
        </h4>

        <div class="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-royalGold before:via-crimson-600 before:to-royalGold">
          
          ${itinerary.stops.map(stop => `
            <div class="relative group">
              
              <div class="absolute -left-6 sm:-left-8 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-crimson-800 border-2 border-royalGold text-white text-xs font-black flex items-center justify-center shadow-lg shadow-crimson-900/60 z-10">
                ${stop.stopNumber}
              </div>

              <div class="bg-festiveCharcoal-900/90 rounded-2xl p-5 border border-royalGold/20 hover:border-royalGold/60 transition shadow-lg space-y-3">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-royalGold/15 text-royalGold border border-royalGold/30">
                        <i class="fa-regular fa-clock mr-1"></i> ${stop.arriveTime} – ${stop.departTime} (${stop.durationMin} mins)
                      </span>
                      <span class="text-xs text-amber-200/60">${stop.pandal.zone}</span>
                    </div>
                    <h5 class="text-lg font-serifHeading font-bold text-amber-100 mt-1">${stop.pandal.name}</h5>
                  </div>

                  <button onclick="window.pujorApp.openModal('${stop.pandal.id}')" class="text-xs font-bold text-royalGold hover:underline self-start sm:self-auto flex items-center gap-1">
                    <span>Inspect Details</span>
                    <i class="fa-solid fa-arrow-right text-[10px]"></i>
                  </button>
                </div>

                <p class="text-xs text-amber-100/80">${stop.pandal.themeSummary}</p>

                <div class="flex items-center gap-2 text-xs text-amber-200/70 bg-black/40 px-3 py-1.5 rounded-xl border border-royalGold/10">
                  <i class="fa-solid fa-train-subway text-royalGold"></i>
                  <span>Nearest Transit: <strong>${stop.pandal.nearestMetro}</strong></span>
                </div>
              </div>

              ${stop.foodStop ? `
                <div class="my-4 ml-2 sm:ml-4 p-4 rounded-2xl bg-gradient-to-r from-rose-950/80 via-festiveCharcoal-900 to-rose-950/80 border border-rose-500/40 shadow-lg flex items-center gap-4">
                  <div class="w-10 h-10 rounded-xl bg-rose-900 flex items-center justify-center text-rose-300 text-lg border border-rose-400/40 shrink-0">
                    <i class="fa-solid fa-utensils"></i>
                  </div>
                  <div>
                    <div class="text-[11px] font-bold uppercase tracking-wider text-rose-300">
                      🍲 Scheduled Food & Bhog Break (${stop.foodStop.timeRange})
                    </div>
                    <div class="text-sm font-bold text-amber-100">${stop.foodStop.name}</div>
                    <div class="text-xs text-amber-200/70">Recommended: ${stop.foodStop.specialty} • ${stop.foodStop.rating}</div>
                  </div>
                </div>
              ` : ''}

              ${stop.transitToNext ? `
                <div class="my-3 ml-2 sm:ml-4 text-xs font-semibold text-royalGold-light/90 flex items-center gap-2 bg-crimson-950/60 px-3 py-1.5 rounded-lg border border-royalGold/20 w-fit">
                  <i class="fa-solid fa-arrow-down-long text-royalGold"></i>
                  <span>${stop.transitToNext.label}</span>
                </div>
              ` : ''}

            </div>
          `).join("")}

        </div>
      </div>

    </div>
  `;

  setTimeout(() => {
    renderPlannerRouteMap(itinerary.stops);
  }, 100);

  const printBtn = document.getElementById("print-plan-btn");
  if (printBtn) {
    printBtn.addEventListener("click", () => window.print());
  }

  const copyBtn = document.getElementById("copy-plan-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const summaryText = `🛕 Pujor Parikrama 2026 Itinerary (${itinerary.day})\n` +
        `Zone: ${itinerary.zone}\n` +
        `Stops: ${itinerary.stops.map(s => `${s.stopNumber}. ${s.pandal.name} (${s.arriveTime})`).join('\n')}\n` +
        `Plan your trip on Pujor Parikrama!`;

      if (navigator.clipboard) {
        navigator.clipboard.writeText(summaryText);
        copyBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        setTimeout(() => {
          copyBtn.innerHTML = `<i class="fa-solid fa-share-nodes"></i> Share Trip`;
        }, 2500);
      }
    });
  }
}

function renderPlannerRouteMap(stops) {
  const mapElem = document.getElementById("planner-route-map");
  if (!mapElem) return;

  if (state.plannerMap) {
    state.plannerMap.remove();
    state.plannerMap = null;
  }

  const coords = stops.map(s => [s.pandal.coordinates.lat, s.pandal.coordinates.lng]);
  if (coords.length === 0) return;

  state.plannerMap = L.map("planner-route-map", {
    zoomControl: true,
    attributionControl: false
  }).setView(coords[0], 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
  }).addTo(state.plannerMap);

  stops.forEach((stop) => {
    const lat = stop.pandal.coordinates.lat;
    const lng = stop.pandal.coordinates.lng;

    const numIcon = L.divIcon({
      className: 'planner-step-marker',
      html: `<div class="custom-leaflet-marker w-8 h-8 text-xs font-black">${stop.stopNumber}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker([lat, lng], { icon: numIcon })
      .addTo(state.plannerMap)
      .bindPopup(`<b>Stop ${stop.stopNumber}: ${stop.pandal.name}</b><br><span style="font-size:11px">Time: ${stop.arriveTime} - ${stop.departTime}</span>`);
  });

  const polyline = L.polyline(coords, {
    color: '#D4AF37',
    weight: 4,
    opacity: 0.85,
    dashArray: '8, 8',
    lineJoin: 'round'
  }).addTo(state.plannerMap);

  state.plannerMap.fitBounds(polyline.getBounds(), { padding: [30, 30] });
}

// ==========================================
// ADMIN PANEL MODAL & PANDALS MANAGER
// ==========================================
function openAdminPanelModal() {
  if (!state.isAdmin) {
    alert("Admin privileges required.");
    return;
  }
  const modal = document.getElementById("admin-panel-modal");
  renderAdminPandalsTable();
  if (modal) modal.classList.remove("hidden");
}

function closeAdminPanelModal() {
  const modal = document.getElementById("admin-panel-modal");
  if (modal) modal.classList.add("hidden");
}

function renderAdminPandalsTable() {
  const container = document.getElementById("admin-pandals-table-container");
  if (!container) return;

  container.innerHTML = state.pandals.map(pandal => `
    <div class="bg-festiveCharcoal-900 p-4 rounded-xl border border-royalGold/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <img src="${pandal.image || ''}" class="w-12 h-12 rounded-lg object-cover border border-royalGold/30" onerror="this.src='src/assets/art/kumartuli.jpg'">
        <div>
          <div class="font-serifHeading font-bold text-amber-100 text-sm">${pandal.name}</div>
          <div class="text-[11px] text-amber-200/60">${pandal.zone} • ${pandal.nearestMetro} • Lat: ${pandal.coordinates ? pandal.coordinates.lat : 'N/A'}</div>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto">
        <button onclick="window.pujorApp.openEditPandal('${pandal.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
          <i class="fa-solid fa-pen-to-square"></i> Edit
        </button>
        <button onclick="window.pujorApp.openAddFoodStall('${pandal.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold border border-rose-500/30 flex items-center gap-1">
          <i class="fa-solid fa-utensils"></i> Food
        </button>
        <button onclick="window.pujorApp.handleDeletePandal('${pandal.id}')" class="px-2.5 py-1.5 rounded-lg bg-crimson-950 hover:bg-crimson-800 text-red-300 text-xs font-bold border border-red-500/30 flex items-center gap-1">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>
  `).join("");
}

// ==========================================
// EXHAUSTIVE EDIT PANDAL (ADMIN ONLY)
// ==========================================
export function openEditPandal(pandalId) {
  if (!state.isAdmin) {
    alert("Admin privileges required.");
    return;
  }
  const pandal = state.pandals.find(p => p.id === pandalId);
  if (!pandal) return;

  const modal = document.getElementById("edit-pandal-modal");
  document.getElementById("edit-pandal-id").value = pandal.id;
  document.getElementById("edit-modal-title").textContent = `Edit: ${pandal.name}`;
  
  // Section 1
  document.getElementById("edit-name").value = pandal.name || "";
  document.getElementById("edit-bengali").value = pandal.bengaliName || "";
  document.getElementById("edit-zone").value = pandal.zone || "South Kolkata";
  document.getElementById("edit-established").value = pandal.establishedYear || "";
  document.getElementById("edit-crowd").value = pandal.crowdLevel || "Moderate";
  document.getElementById("edit-peak-hours").value = pandal.peakHours || "";

  // Section 2
  document.getElementById("edit-address").value = pandal.address || "";
  document.getElementById("edit-metro").value = pandal.nearestMetro || "";
  document.getElementById("edit-metro-line").value = pandal.metroLine || "";
  document.getElementById("edit-lat").value = pandal.coordinates ? pandal.coordinates.lat : 22.52;
  document.getElementById("edit-lng").value = pandal.coordinates ? pandal.coordinates.lng : 88.35;

  // Section 3
  const imgUrl = pandal.image || "";
  document.getElementById("edit-image").value = imgUrl;
  document.getElementById("edit-image-preview").src = imgUrl || "https://images.unsplash.com/photo-1570784332176-fdd73da66f03?auto=format&fit=crop&w=300&q=80";

  // Section 4
  document.getElementById("edit-theme-summary").value = pandal.themeSummary || "";
  document.getElementById("edit-art-concept").value = pandal.artConcept || "";
  document.getElementById("edit-history").value = pandal.history || "";
  document.getElementById("edit-sculptor").value = pandal.sculptor || "";
  document.getElementById("edit-lighting").value = pandal.lighting || "";
  document.getElementById("edit-highlights").value = pandal.highlights ? pandal.highlights.join(", ") : "";

  // Delete button inside edit modal
  const delBtn = document.getElementById("delete-from-edit-modal-btn");
  if (delBtn) {
    delBtn.onclick = () => {
      closeEditPandalModal();
      handleDeletePandal(pandal.id);
    };
  }

  if (modal) modal.classList.remove("hidden");
}

function closeEditPandalModal() {
  const modal = document.getElementById("edit-pandal-modal");
  if (modal) modal.classList.add("hidden");
}

// ==========================================
// ADD FOOD STALL (ADMIN ONLY)
// ==========================================
export function openAddFoodStall(pandalId) {
  if (!state.isAdmin) {
    alert("Admin privileges required.");
    return;
  }
  const pandal = state.pandals.find(p => p.id === pandalId);
  if (!pandal) return;

  const modal = document.getElementById("add-food-modal");
  document.getElementById("food-target-pandal-id").value = pandal.id;
  document.getElementById("add-food-target-pandal").textContent = `Adding stall for "${pandal.name}"`;
  
  if (modal) modal.classList.remove("hidden");
}

function closeAddFoodModal() {
  const modal = document.getElementById("add-food-modal");
  if (modal) modal.classList.add("hidden");
}

// ==========================================
// DELETE FOOD STALL (ADMIN ONLY)
// ==========================================
export async function handleDeleteFood(pandalId, foodIndex) {
  if (!state.isAdmin) {
    alert("Admin privileges required.");
    return;
  }
  if (confirm("Are you sure you want to delete this food stall?")) {
    await deleteFoodStallFromPandal(pandalId, foodIndex);
    const pandal = state.pandals.find(p => p.id === pandalId);
    if (pandal && pandal.foodRadar) {
      pandal.foodRadar.splice(foodIndex, 1);
      renderModalFoodRadarList(pandal);
    }
  }
}

// ==========================================
// DELETE PANDAL (ADMIN ONLY)
// ==========================================
export async function handleDeletePandal(pandalId) {
  if (!state.isAdmin) {
    alert("Admin privileges required.");
    return;
  }
  const pandal = state.pandals.find(p => p.id === pandalId);
  if (!pandal) return;

  if (confirm(`Are you sure you want to permanently delete "${pandal.name}"?`)) {
    await deletePandal(pandalId);
    state.pandals = state.pandals.filter(p => p.id !== pandalId);
    applyFiltersAndSort();
    renderAdminPandalsTable();
    renderCityMapMarkers();
    closeModal();
    alert(`"${pandal.name}" has been deleted.`);
  }
}

// ==========================================
// BOOKMARK / SAVED PANDALS
// ==========================================
function toggleSavePandal(pandalId) {
  if (state.savedPandalIds.has(pandalId)) {
    state.savedPandalIds.delete(pandalId);
  } else {
    state.savedPandalIds.add(pandalId);
  }

  localStorage.setItem("pujor_saved_pandals", JSON.stringify([...state.savedPandalIds]));
  updateSavedCountBadge();
  renderPandalsGrid();

  if (state.activeModalPandal && state.activeModalPandal.id === pandalId) {
    const isSaved = state.savedPandalIds.has(pandalId);
    const bookmarkBtn = document.getElementById("modal-bookmark-btn");
    if (bookmarkBtn) {
      bookmarkBtn.innerHTML = `
        <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark mr-1"></i>
        <span>${isSaved ? 'Saved in Itinerary' : 'Add to Planner'}</span>
      `;
    }
  }
}

function updateSavedCountBadge() {
  const badge = document.getElementById("saved-pandal-count-badge");
  if (badge) badge.textContent = state.savedPandalIds.size;
}

// ==========================================
// WEB AUDIO API DHAK BEATS
// ==========================================
function toggleDhakSound() {
  if (state.isDhakPlaying) {
    stopDhakSound();
  } else {
    startDhakSound();
  }
}

function startDhakSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!state.audioCtx) {
      state.audioCtx = new AudioContext();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    state.isDhakPlaying = true;
    const btn = document.getElementById("dhak-sound-btn");
    const label = document.getElementById("dhak-btn-label");
    if (btn) btn.classList.add("bg-crimson-800", "text-white");
    if (label) label.textContent = "Playing...";

    let beatStep = 0;
    const tempoMs = 280;

    state.dhakIntervalId = setInterval(() => {
      if (!state.isDhakPlaying) return;
      
      const now = state.audioCtx.currentTime;
      if (beatStep === 0 || beatStep === 3) {
        playDhakBass(now);
      } else if (beatStep === 1 || beatStep === 2) {
        playKanshiTreble(now);
      }
      
      beatStep = (beatStep + 1) % 4;
    }, tempoMs);

  } catch (err) {
    console.warn("Audio Context init blocked:", err);
  }
}

function stopDhakSound() {
  state.isDhakPlaying = false;
  if (state.dhakIntervalId) {
    clearInterval(state.dhakIntervalId);
    state.dhakIntervalId = null;
  }
  const btn = document.getElementById("dhak-sound-btn");
  const label = document.getElementById("dhak-btn-label");
  if (btn) btn.classList.remove("bg-crimson-800", "text-white");
  if (label) label.textContent = "Dhak Beats";
}

function playDhakBass(time) {
  if (!state.audioCtx) return;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(45, time + 0.18);

  gain.gain.setValueAtTime(0.7, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.18);

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);

  osc.start(time);
  osc.stop(time + 0.19);
}

function playKanshiTreble(time) {
  if (!state.audioCtx) return;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, time);
  osc.frequency.exponentialRampToValueAtTime(320, time + 0.08);

  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.01, time + 0.08);

  osc.connect(gain);
  gain.connect(state.audioCtx.destination);

  osc.start(time);
  osc.stop(time + 0.09);
}

// ==========================================
// FIREBASE STATUS BADGE
// ==========================================
function updateSyncStatusBadge() {
  const sync = getSyncStatus();
  const badgeText = document.getElementById("sync-status-text");
  const detail = document.getElementById("firebase-status-detail");

  if (badgeText) {
    badgeText.textContent = sync.mode === "firestore" ? "Cloud Sync" : "Local Store";
  }
  if (detail) {
    detail.textContent = `${sync.message} (${sync.mode.toUpperCase()})`;
    detail.className = sync.mode === "firestore" ? "text-emerald-400 font-mono" : "text-amber-400 font-mono";
  }
}

// ==========================================
// EVENT LISTENERS BINDING
// ==========================================
function setupEventListeners() {
  // 1. Real-time Search Input
  const searchInput = document.getElementById("pandal-search-input");
  const clearSearchBtn = document.getElementById("clear-search-btn");

  if (searchInput) {
    searchInput.addEventListener("keyup", (e) => {
      state.searchQuery = e.target.value;
      if (clearSearchBtn) {
        if (state.searchQuery) clearSearchBtn.classList.remove("hidden");
        else clearSearchBtn.classList.add("hidden");
      }
      applyFiltersAndSort();
    });
  }

  if (clearSearchBtn) {
    clearSearchBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      state.searchQuery = "";
      clearSearchBtn.classList.add("hidden");
      applyFiltersAndSort();
    });
  }

  // 2. Zone Filter Tabs & Select
  document.querySelectorAll(".filter-tab, [data-zone]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-tab, [data-zone]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.selectedZone = btn.getAttribute("data-zone") || "All";
      
      const zoneSelect = document.getElementById("pandal-zone-select");
      if (zoneSelect) zoneSelect.value = state.selectedZone;

      applyFiltersAndSort();
    });
  });

  const zoneSelect = document.getElementById("pandal-zone-select");
  if (zoneSelect) {
    zoneSelect.addEventListener("change", (e) => {
      state.selectedZone = e.target.value;
      document.querySelectorAll(".filter-tab").forEach(b => {
        if (b.getAttribute("data-zone") === state.selectedZone) b.classList.add("active");
        else b.classList.remove("active");
      });
      applyFiltersAndSort();
    });
  }

  // 3. Theme Select
  const themeSelect = document.getElementById("pandal-theme-select");
  if (themeSelect) {
    themeSelect.addEventListener("change", (e) => {
      state.selectedTheme = e.target.value;
      applyFiltersAndSort();
    });
  }

  // 4. Sorting select
  const sortSelect = document.getElementById("pandal-sort-select");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      state.sortBy = e.target.value;
      applyFiltersAndSort();
    });
  }

  // 4. Modal Tab Switchers
  document.querySelectorAll(".modal-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchModalTab(tabId);
    });
  });

  // 5. Modal Close Buttons
  const closeModalBtn = document.getElementById("close-modal-btn");
  const closeFooterBtn = document.getElementById("modal-close-footer-btn");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (closeFooterBtn) closeFooterBtn.addEventListener("click", closeModal);

  const modalElem = document.getElementById("pandal-details-modal");
  if (modalElem) {
    modalElem.addEventListener("click", (e) => {
      if (e.target === modalElem) closeModal();
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
      document.getElementById("add-pandal-modal").classList.add("hidden");
      document.getElementById("edit-pandal-modal").classList.add("hidden");
      document.getElementById("add-food-modal").classList.add("hidden");
      document.getElementById("auth-modal").classList.add("hidden");
      document.getElementById("admin-panel-modal").classList.add("hidden");
      document.getElementById("firebase-modal").classList.add("hidden");
    }
  });

  // 6. Modal Bookmark button
  const modalBookmarkBtn = document.getElementById("modal-bookmark-btn");
  if (modalBookmarkBtn) {
    modalBookmarkBtn.addEventListener("click", () => {
      if (state.activeModalPandal) {
        toggleSavePandal(state.activeModalPandal.id);
      }
    });
  }

  // 7. Planner Form Submit
  const plannerForm = document.getElementById("itinerary-generator-form");
  if (plannerForm) {
    plannerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      triggerItineraryGeneration();
      const resultsElem = document.getElementById("itinerary-results-container");
      if (resultsElem) resultsElem.scrollIntoView({ behavior: "smooth" });
    });
  }

  // 8. Dhak Beats Toggle
  const dhakBtn = document.getElementById("dhak-sound-btn");
  if (dhakBtn) {
    dhakBtn.addEventListener("click", toggleDhakSound);
  }

  // 9. Reset Filters Button
  const resetFilterBtn = document.getElementById("reset-filter-btn");
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener("click", () => {
      state.searchQuery = "";
      state.selectedZone = "All";
      state.sortBy = "default";
      if (searchInput) searchInput.value = "";
      if (sortSelect) sortSelect.value = "default";
      document.querySelector('.zone-tab-btn[data-zone="All"]').click();
    });
  }

  // 10. UNIVERSAL AUTHENTICATION & LOGIN/SIGNUP CONTROLS
  const authBtn = document.getElementById("auth-btn");
  const authModal = document.getElementById("auth-modal");
  const closeAuthBtn = document.getElementById("close-auth-modal-btn");
  const googleLoginBtn = document.getElementById("google-login-btn");
  const emailLoginForm = document.getElementById("email-login-form");
  const toggleAuthModeBtn = document.getElementById("toggle-auth-mode-btn");
  const authModalTitle = document.getElementById("auth-modal-title");
  const authModalSubtitle = document.getElementById("auth-modal-subtitle");
  const authSubmitBtn = document.getElementById("auth-submit-btn");

  if (authBtn) {
    authBtn.addEventListener("click", () => {
      if (state.currentUser) {
        const name = state.currentUser.displayName || state.currentUser.email;
        if (confirm(`Currently signed in as:\n${name}\n\nDo you wish to log out?`)) {
          logoutUser().then(() => {
            state.currentUser = null;
            state.isAdmin = false;
            updateAdminUIState();
            alert("Signed out successfully.");
          });
        }
      } else {
        state.authMode = "signin";
        updateAuthModalView();
        if (authModal) authModal.classList.remove("hidden");
      }
    });
  }

  if (closeAuthBtn) {
    closeAuthBtn.addEventListener("click", () => {
      if (authModal) authModal.classList.add("hidden");
    });
  }

  function updateAuthModalView() {
    if (state.authMode === "signin") {
      if (authModalTitle) authModalTitle.innerHTML = `<i class="fa-solid fa-user-check text-royalGold"></i> Sign In to Account`;
      if (authModalSubtitle) authModalSubtitle.textContent = "Access your saved pandals, custom itineraries, and recommendations.";
      if (authSubmitBtn) authSubmitBtn.textContent = "Sign In";
      if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = "Don't have an account? Sign Up";
    } else {
      if (authModalTitle) authModalTitle.innerHTML = `<i class="fa-solid fa-user-plus text-royalGold"></i> Create Free Account`;
      if (authModalSubtitle) authModalSubtitle.textContent = "Sign up to create custom parikrama maps and save favorites.";
      if (authSubmitBtn) authSubmitBtn.textContent = "Create Account";
      if (toggleAuthModeBtn) toggleAuthModeBtn.textContent = "Already have an account? Sign In";
    }
  }

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.addEventListener("click", () => {
      state.authMode = state.authMode === "signin" ? "signup" : "signin";
      updateAuthModalView();
    });
  }

  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", async () => {
      try {
        const user = await loginWithGoogle();
        state.currentUser = user;
        state.isAdmin = Boolean(user && user.email && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
        updateAdminUIState();
        if (authModal) authModal.classList.add("hidden");
        
        if (state.isAdmin) {
          alert(`👑 Welcome Administrator! All management and editing tools are now active.`);
        } else {
          alert(`🎉 Welcome to Pujor Parikrama, ${user.displayName || user.email}!`);
        }
      } catch (err) {
        if (!err.message.includes("cancelled")) {
          alert("Sign-In: " + err.message);
        }
      }
    });
  }

  if (emailLoginForm) {
    emailLoginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email-input").value;
      const pass = document.getElementById("login-password-input").value;

      try {
        let user;
        if (state.authMode === "signup") {
          user = await registerWithEmail(email, pass);
        } else {
          user = await loginWithEmail(email, pass);
        }

        state.currentUser = user;
        state.isAdmin = Boolean(user && user.email && safeEmailCompare(user.email, ADMIN_EMAIL));
        updateAdminUIState();
        if (authModal) authModal.classList.add("hidden");
        emailLoginForm.reset();

        if (state.isAdmin) {
          alert(`👑 Welcome Administrator! Full edit & creation permissions unlocked.`);
        } else {
          alert(`🎉 Successfully signed in as ${user.email}!`);
        }
      } catch (err) {
        alert("Authentication error: " + err.message);
      }
    });
  }

  // Quick Instant Admin Login Shortcut
  const quickAdminBtn = document.getElementById("quick-admin-login-btn");
  if (quickAdminBtn) {
    quickAdminBtn.addEventListener("click", () => {
      state.currentUser = {
        email: ADMIN_EMAIL,
        displayName: "Admin",
        uid: "admin-quick-session"
      };
      localStorage.setItem("pujor_parikrama_local_user", JSON.stringify(state.currentUser));
      state.isAdmin = true;
      updateAdminUIState();
      if (authModal) authModal.classList.add("hidden");
      alert("👑 Instant Admin Login successful! All manual text & photo editing controls unlocked.");
    });
  }

  // Image File Upload Helper
  function setupImageFileInput(fileInputId, targetInputId, previewImgId) {
    const fileInput = document.getElementById(fileInputId);
    if (!fileInput) return;
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        const targetInput = document.getElementById(targetInputId);
        if (targetInput) targetInput.value = dataUrl;
        if (previewImgId) {
          const previewImg = document.getElementById(previewImgId);
          if (previewImg) previewImg.src = dataUrl;
        }
      };
      reader.readAsDataURL(file);
    });
  }

  setupImageFileInput("add-photo-file-input", "add-image");
  setupImageFileInput("edit-photo-file-input", "edit-image", "edit-image-preview");
  setupImageFileInput("site-hero-file-input", "site-hero-image-input");

  // Artwork Preset Selection
  document.querySelectorAll(".preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-target");
      const previewId = btn.getAttribute("data-preview");
      const val = btn.getAttribute("data-val");
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) target.value = val;
      }
      if (previewId) {
        const prev = document.getElementById(previewId);
        if (prev) prev.src = val;
      }
    });
  });

  // Site Text & Photo Editor Controls
  const siteEditorModal = document.getElementById("site-editor-modal");
  const openSiteEditorBtn = document.getElementById("admin-site-editor-open-btn");
  const closeSiteEditorBtn = document.getElementById("close-site-editor-btn");
  const cancelSiteEditorBtn = document.getElementById("cancel-site-editor-btn");
  const siteEditorForm = document.getElementById("site-editor-form");

  if (openSiteEditorBtn) {
    openSiteEditorBtn.addEventListener("click", () => {
      const subtitle = document.getElementById("site-hero-subtitle");
      const bannerImg = document.getElementById("site-hero-banner-img");
      if (subtitle) document.getElementById("site-hero-subtitle-input").value = subtitle.textContent.trim();
      if (bannerImg) document.getElementById("site-hero-image-input").value = bannerImg.getAttribute("src") || "";
      if (siteEditorModal) siteEditorModal.classList.remove("hidden");
    });
  }

  if (closeSiteEditorBtn) closeSiteEditorBtn.addEventListener("click", () => siteEditorModal.classList.add("hidden"));
  if (cancelSiteEditorBtn) cancelSiteEditorBtn.addEventListener("click", () => siteEditorModal.classList.add("hidden"));

  if (siteEditorForm) {
    siteEditorForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const subVal = document.getElementById("site-hero-subtitle-input").value;
      const imgVal = document.getElementById("site-hero-image-input").value;
      
      const subtitle = document.getElementById("site-hero-subtitle");
      const bannerImg = document.getElementById("site-hero-banner-img");
      if (subtitle && subVal) subtitle.textContent = subVal;
      if (bannerImg && imgVal) bannerImg.src = imgVal;

      localStorage.setItem("pujor_site_custom_subtitle", subVal);
      localStorage.setItem("pujor_site_custom_hero_img", imgVal);

      if (siteEditorModal) siteEditorModal.classList.add("hidden");
      alert("✅ Site headline description and hero photo updated successfully!");
    });
  }

  // 11. ADMIN PANEL NAVIGATION & DRAWER
  const adminNavBtn = document.getElementById("admin-panel-nav-btn");
  const mobileAdminNavBtn = document.getElementById("mobile-admin-panel-btn");
  const closeAdminPanelBtn = document.getElementById("close-admin-panel-btn");
  const adminPanelAddNewBtn = document.getElementById("admin-panel-add-new-btn");

  if (adminNavBtn) adminNavBtn.addEventListener("click", openAdminPanelModal);
  if (mobileAdminNavBtn) mobileAdminNavBtn.addEventListener("click", openAdminPanelModal);
  if (closeAdminPanelBtn) closeAdminPanelBtn.addEventListener("click", closeAdminPanelModal);
  if (adminPanelAddNewBtn) {
    adminPanelAddNewBtn.addEventListener("click", () => {
      closeAdminPanelModal();
      document.getElementById("add-pandal-modal").classList.remove("hidden");
    });
  }

  // 12. ADD PANDAL CONTROLS (ADMIN ONLY)
  const openAddBtn = document.getElementById("open-add-pandal-btn");
  const mobileAddBtn = document.getElementById("mobile-add-pandal-btn");
  const addModal = document.getElementById("add-pandal-modal");
  const closeAddBtn = document.getElementById("close-add-modal-btn");
  const cancelAddBtn = document.getElementById("cancel-add-btn");
  const addForm = document.getElementById("add-pandal-form");

  if (openAddBtn) openAddBtn.addEventListener("click", () => {
    if (state.isAdmin && addModal) addModal.classList.remove("hidden");
  });
  if (mobileAddBtn) mobileAddBtn.addEventListener("click", () => {
    if (state.isAdmin && addModal) addModal.classList.remove("hidden");
  });
  if (closeAddBtn) closeAddBtn.addEventListener("click", () => {
    if (addModal) addModal.classList.add("hidden");
  });
  if (cancelAddBtn) cancelAddBtn.addEventListener("click", () => {
    if (addModal) addModal.classList.add("hidden");
  });

  if (addForm) {
    addForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.isAdmin) {
        alert("Admin permission required to add pandals.");
        return;
      }
      const formData = new FormData(addForm);
      const newPandal = {
        name: formData.get("name"),
        bengaliName: formData.get("bengaliName"),
        zone: formData.get("zone"),
        establishedYear: parseInt(formData.get("establishedYear")) || new Date().getFullYear(),
        nearestMetro: formData.get("nearestMetro"),
        metroLine: formData.get("metroLine") || "Blue Line",
        address: formData.get("address") || `${formData.get("name")}, Kolkata`,
        themeSummary: formData.get("themeSummary"),
        image: formData.get("image") || "https://images.unsplash.com/photo-1570784332176-fdd73da66f03?auto=format&fit=crop&w=1200&q=80",
        coordinates: {
          lat: parseFloat(formData.get("lat")),
          lng: parseFloat(formData.get("lng"))
        },
        crowdLevel: "Moderate",
        history: formData.get("themeSummary"),
        artConcept: formData.get("themeSummary"),
        highlights: ["Community Craft", "Thematic Architecture", "Festive Illumination"],
        foodRadar: []
      };

      await addNewPandal(newPandal);
      state.pandals.unshift(newPandal);
      applyFiltersAndSort();
      renderCityMapMarkers();
      addModal.classList.add("hidden");
      addForm.reset();
      alert(`🎉 "${newPandal.name}" successfully added!`);
    });
  }

  // 13. EXHAUSTIVE EDIT PANDAL FORM SUBMIT (ADMIN ONLY)
  const editForm = document.getElementById("edit-pandal-form");
  const closeEditBtn = document.getElementById("close-edit-modal-btn");
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  const editImageInput = document.getElementById("edit-image");
  const editImagePreview = document.getElementById("edit-image-preview");

  if (editImageInput && editImagePreview) {
    editImageInput.addEventListener("input", (e) => {
      editImagePreview.src = e.target.value || "https://images.unsplash.com/photo-1570784332176-fdd73da66f03?auto=format&fit=crop&w=300&q=80";
    });
  }

  if (closeEditBtn) closeEditBtn.addEventListener("click", closeEditPandalModal);
  if (cancelEditBtn) cancelEditBtn.addEventListener("click", closeEditPandalModal);

  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.isAdmin) {
        alert("Admin permission required to edit pandals.");
        return;
      }
      const formData = new FormData(editForm);
      const id = formData.get("id");
      
      const rawHighlights = formData.get("highlights") || "";
      const highlightsArray = rawHighlights.split(",").map(h => h.trim()).filter(Boolean);

      const updatedFields = {
        name: formData.get("name"),
        bengaliName: formData.get("bengaliName"),
        zone: formData.get("zone"),
        establishedYear: parseInt(formData.get("establishedYear")) || null,
        crowdLevel: formData.get("crowdLevel"),
        peakHours: formData.get("peakHours"),
        address: formData.get("address"),
        nearestMetro: formData.get("nearestMetro"),
        metroLine: formData.get("metroLine"),
        themeSummary: formData.get("themeSummary"),
        artConcept: formData.get("artConcept"),
        history: formData.get("history"),
        sculptor: formData.get("sculptor"),
        lighting: formData.get("lighting"),
        image: formData.get("image"),
        highlights: highlightsArray,
        coordinates: {
          lat: parseFloat(formData.get("lat")),
          lng: parseFloat(formData.get("lng"))
        }
      };

      await updatePandal(id, updatedFields);
      const idx = state.pandals.findIndex(p => p.id === id);
      if (idx !== -1) {
        state.pandals[idx] = { ...state.pandals[idx], ...updatedFields };
      }

      applyFiltersAndSort();
      renderCityMapMarkers();
      closeEditPandalModal();
      
      if (state.activeModalPandal && state.activeModalPandal.id === id) {
        openPandalModal(id);
      }
      alert(`✅ Pandal "${updatedFields.name}" updated successfully with all new details!`);
    });
  }

  // 14. ADD FOOD STALL FORM SUBMIT (ADMIN ONLY)
  const addFoodForm = document.getElementById("add-food-form");
  const closeFoodBtn = document.getElementById("close-food-modal-btn");
  const cancelFoodBtn = document.getElementById("cancel-food-btn");

  if (closeFoodBtn) closeFoodBtn.addEventListener("click", closeAddFoodModal);
  if (cancelFoodBtn) cancelFoodBtn.addEventListener("click", closeAddFoodModal);

  if (addFoodForm) {
    addFoodForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!state.isAdmin) {
        alert("Admin permission required to add food stalls.");
        return;
      }
      const formData = new FormData(addFoodForm);
      const pandalId = formData.get("pandalId");
      const newFood = {
        name: formData.get("foodName"),
        specialty: formData.get("specialty"),
        distance: formData.get("distance") || "200m",
        price: formData.get("price") || "₹₹",
        rating: formData.get("rating") || "4.8/5"
      };

      await addFoodStallToPandal(pandalId, newFood);
      
      const pandal = state.pandals.find(p => p.id === pandalId);
      if (pandal) {
        if (!pandal.foodRadar) pandal.foodRadar = [];
        pandal.foodRadar.push(newFood);
      }

      closeAddFoodModal();
      addFoodForm.reset();
      
      if (state.activeModalPandal && state.activeModalPandal.id === pandalId) {
        renderModalFoodRadarList(pandal);
      }
      alert(`🍲 Added "${newFood.name}" to food radar!`);
    });
  }

  // 15. MODAL ADMIN TOOLBAR BUTTONS
  const modalAdminEditBtn = document.getElementById("modal-admin-edit-btn");
  const modalAdminFoodBtn = document.getElementById("modal-admin-food-btn");
  const modalAdminDeleteBtn = document.getElementById("modal-admin-delete-btn");
  const modalFoodTabAddBtn = document.getElementById("modal-food-tab-add-btn");

  if (modalAdminEditBtn) {
    modalAdminEditBtn.addEventListener("click", () => {
      if (state.activeModalPandal) openEditPandal(state.activeModalPandal.id);
    });
  }
  if (modalAdminFoodBtn) {
    modalAdminFoodBtn.addEventListener("click", () => {
      if (state.activeModalPandal) openAddFoodStall(state.activeModalPandal.id);
    });
  }
  if (modalFoodTabAddBtn) {
    modalFoodTabAddBtn.addEventListener("click", () => {
      if (state.activeModalPandal) openAddFoodStall(state.activeModalPandal.id);
    });
  }
  if (modalAdminDeleteBtn) {
    modalAdminDeleteBtn.addEventListener("click", () => {
      if (state.activeModalPandal) handleDeletePandal(state.activeModalPandal.id);
    });
  }

  // Wire up: Nearby Tab "Add Nearby Puja" button (Admin Only)
  const modalNearbyTabAddBtn = document.getElementById("modal-nearby-tab-add-btn");
  if (modalNearbyTabAddBtn) {
    modalNearbyTabAddBtn.addEventListener("click", () => {
      if (!state.isAdmin) return;
      if (!state.activeModalPandal) return;
      const name = prompt("Nearby Pandal Name:");
      if (!name || !name.trim()) return;
      const distKmStr = prompt("Distance in km (e.g. 0.8):", "1.0");
      const walkStr = prompt("Walk time in minutes (e.g. 10):", "12");
      const distKm = parseFloat(distKmStr) || 1.0;
      const walkTimeMin = parseInt(walkStr) || 12;
      const nearbyObj = { name: name.trim(), distanceKm: distKm, walkTimeMin };
      addNearbyToPandal(state.activeModalPandal.id, nearbyObj).then(() => {
        if (!state.activeModalPandal.nearbyPandals) state.activeModalPandal.nearbyPandals = [];
        state.activeModalPandal.nearbyPandals.push(nearbyObj);
        // Re-render nearby list
        const nearbyList = document.getElementById("modal-nearby-list");
        if (nearbyList) {
          nearbyList.innerHTML = state.activeModalPandal.nearbyPandals.map(np => `
            <div class="bg-festiveCharcoal-900/80 p-3.5 rounded-xl border border-royalGold/20 hover:border-royalGold transition">
              <h5 class="text-xs font-bold text-amber-100">${np.name}</h5>
              <div class="mt-2 flex items-center justify-between text-[11px] text-amber-200/70">
                <span><i class="fa-solid fa-route text-royalGold mr-1"></i> ${np.distanceKm} km</span>
                <span class="font-bold text-amber-300">🚶 ~${np.walkTimeMin} min walk</span>
              </div>
            </div>
          `).join("");
        }
        alert(`✅ Nearby pandal "${nearbyObj.name}" added!`);
      });
    });
  }

  // 16. FIREBASE CLOUD MODAL
  const statusBadge = document.getElementById("firebase-status-badge");
  const fbModal = document.getElementById("firebase-modal");
  const closeFbBtn = document.getElementById("close-firebase-modal-btn");
  const saveFbConfigBtn = document.getElementById("save-firebase-config-btn");
  const seedFbBtn = document.getElementById("seed-firestore-btn");

  if (statusBadge) {
    statusBadge.addEventListener("click", () => {
      if (fbModal) fbModal.classList.remove("hidden");
      updateSyncStatusBadge();
    });
  }
  if (closeFbBtn) {
    closeFbBtn.addEventListener("click", () => {
      if (fbModal) fbModal.classList.add("hidden");
    });
  }
  if (saveFbConfigBtn) {
    saveFbConfigBtn.addEventListener("click", () => {
      const jsonStr = document.getElementById("firebase-config-json").value;
      try {
        const config = JSON.parse(jsonStr);
        saveFirebaseCredentials(config);
        updateSyncStatusBadge();
        alert("Firebase credentials saved! Re-syncing database...");
        if (fbModal) fbModal.classList.add("hidden");
      } catch (err) {
        alert("Invalid JSON format. Please verify your Firebase configuration object.");
      }
    });
  }
  if (seedFbBtn) {
    seedFbBtn.addEventListener("click", async () => {
      seedFbBtn.textContent = "Seeding...";
      const res = await seedPandalsToFirestore();
      seedFbBtn.innerHTML = `<i class="fa-solid fa-seedling mr-1"></i> Re-Seed Initial Data`;
      alert(`Seeding completed! Loaded ${res.count} pandals.`);
      const list = await fetchPandals();
      state.pandals = list;
      applyFiltersAndSort();
    });
  }

  // 17. Mobile Menu & Drawer
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const mobileMenu = document.getElementById("mobile-menu");
  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }

  const drawerBtn = document.getElementById("itinerary-quick-drawer-btn");
  if (drawerBtn) {
    drawerBtn.addEventListener("click", () => {
      document.getElementById("smart-planner").scrollIntoView({ behavior: "smooth" });
    });
  }
}

// Global Exposure
window.pujorApp = {
  openModal: openPandalModal,
  openEditPandal: openEditPandal,
  openAddFoodStall: openAddFoodStall,
  handleDeleteFood: handleDeleteFood,
  handleDeletePandal: handleDeletePandal
};
