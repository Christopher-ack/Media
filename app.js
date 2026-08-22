/*
  APP.JS
  ------
  Handles loading data.json, filtering/sorting state, and all rendering
  and interaction logic for the Media Logbook page.

  Movie/show data itself lives in data.json (see that file's comments
  for the shape of each entry). This file fetches it once on load.
*/

let WATCHLIST = [];

const GENRE_COLORS = {
  "Action":        "#f97316", // orange
  "Adventure":     "#22d3ee", // cyan
  "Sci-Fi":        "#8b5cf6", // violet
  "Fantasy":       "#a78bfa", // light purple
  "Comedy":        "#fbbf24", // amber
  "Drama":         "#f472b6", // pink
  "Horror":        "#ef4444", // red
  "Thriller":      "#fb7185", // rose
  "Animation":     "#34d399", // green
  "Romance":       "#f43f5e", // ruby
  "Mystery":       "#60a5fa", // blue
  "Crime":         "#94a3b8", // slate
  "Documentary":   "#2dd4bf", // teal
  "Family":        "#facc15", // yellow
  "Musical":       "#e879f9", // fuchsia
  "War":           "#78716c", // stone
  "Biography":     "#38bdf8", // sky
  "History":       "#c084fc"  // purple
};

// Deterministic fallback color for any genre not in the map above.
function colorForGenre(genre) {
  if (GENRE_COLORS[genre]) return GENRE_COLORS[genre];
  let hash = 0;
  for (let i = 0; i < genre.length; i++) {
    hash = genre.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 60%)`;
}

/* ---------------------------------------------------------
   State
--------------------------------------------------------- */
const state = {
  type: "movie",           // "movie" | "tv"
  activeGenres: new Set(), // selected genre filters
  favoritesOnly: false,
  watchlistOnly: false,    // true = show only unwatched items
  minRating: 0,            // 0 = no rating filter, 1-5 = at least that many stars
  sortBy: "year",          // "year" | "title" | "rating"
  sortDir: "desc",         // "asc" | "desc"
  searchQuery: ""
};

/* ---------------------------------------------------------
   Derived data
--------------------------------------------------------- */
function allGenres() {
  const set = new Set();
  WATCHLIST.forEach(item => item.genres.forEach(g => set.add(g)));
  return Array.from(set).sort();
}

function sortItems(items) {
  const sorted = items.slice();
  const dir = state.sortDir === "asc" ? 1 : -1;

  if (state.sortBy === "title") {
    sorted.sort((a, b) => dir * a.title.localeCompare(b.title));
  } else if (state.sortBy === "rating") {
    sorted.sort((a, b) => dir * ((a.rating || 0) - (b.rating || 0)) || a.title.localeCompare(b.title));
  } else {
    sorted.sort((a, b) => dir * (a.year - b.year) || a.title.localeCompare(b.title));
  }
  return sorted;
}

function matchesSearch(item, query) {
  if (!query) return true;
  const haystack = [
    item.title,
    String(item.year),
    ...(item.genres || []),
    ...(item.keywords || [])
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function filteredItems() {
  const query = state.searchQuery.trim().toLowerCase();
  const items = WATCHLIST.filter(item => {
    if (item.type !== state.type) return false;
    if (state.favoritesOnly && !item.favorite) return false;
    if (state.watchlistOnly && item.watched) return false;
    if (state.minRating > 0 && (item.rating || 0) < state.minRating) return false;
    if (state.activeGenres.size > 0) {
      const hasGenre = item.genres.some(g => state.activeGenres.has(g));
      if (!hasGenre) return false;
    }
    if (!matchesSearch(item, query)) return false;
    return true;
  });
  return sortItems(items);
}

/* ---------------------------------------------------------
   Rendering
--------------------------------------------------------- */
const genreListEl = document.getElementById("genreList");
const rowsEl = document.getElementById("rows");
const emptyStateEl = document.getElementById("emptyState");
const genreBtnLabel = document.getElementById("genreBtnLabel");
const countLabel = document.getElementById("countLabel");

const rowMenuPanel = document.getElementById("rowMenuPanel");
const menuToggleWatchedBtn = document.getElementById("menuToggleWatched");
const menuAddTagsBtn = document.getElementById("menuAddTags");

const tagsModalOverlay = document.getElementById("tagsModalOverlay");
const tagsModalTitle = document.getElementById("tagsModalTitle");
const tagsModalYear = document.getElementById("tagsModalYear");
const tagsModalInput = document.getElementById("tagsModalInput");
const tagsModalCancel = document.getElementById("tagsModalCancel");
const tagsModalSave = document.getElementById("tagsModalSave");

const saveStatusEl = document.getElementById("saveStatus");
const saveStatusTextEl = document.getElementById("saveStatusText");
let saveStatusTimer = null;

let currentMenuItem = null;
let currentMenuBtn = null;
let tagsModalItem = null;

function renderGenreDropdown() {
  const genres = allGenres();
  genreListEl.innerHTML = "";
  genres.forEach(genre => {
    const color = colorForGenre(genre);
    const row = document.createElement("label");
    row.className = "genre-option";
    row.style.setProperty("--dot-color", color);

    const dot = document.createElement("span");
    dot.className = "dot";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.activeGenres.has(genre);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.activeGenres.add(genre);
      } else {
        state.activeGenres.delete(genre);
      }
      dot.classList.toggle("on", checkbox.checked);
      updateGenreButtonLabel();
      renderTable();
    });

    const text = document.createElement("span");
    text.className = "genre-label";
    text.textContent = genre;

    if (checkbox.checked) dot.classList.add("on");

    row.appendChild(checkbox);
    row.appendChild(dot);
    row.appendChild(text);
    genreListEl.appendChild(row);
  });
}

function updateGenreButtonLabel() {
  const n = state.activeGenres.size;
  genreBtnLabel.textContent = n === 0 ? "Genres" : `Genres · ${n}`;
  document.getElementById("genreFilterBtn").classList.toggle("active", n > 0);
}

function renderTable() {
  const items = filteredItems();
  rowsEl.innerHTML = "";

  items.forEach(item => {
    const tr = document.createElement("tr");

    const titleTd = document.createElement("td");
    titleTd.className = "col-title";

    const titleCell = document.createElement("div");
    titleCell.className = "title-cell";

    if (!item.watched) {
      const dot = document.createElement("span");
      dot.className = "unwatched-dot";
      dot.title = "Unwatched / on watchlist";
      titleCell.appendChild(dot);
    }

    const titleText = document.createElement("span");
    titleText.className = "title-text";
    titleText.textContent = item.title;
    titleCell.appendChild(titleText);

    if (item.rating) {
      const rating = document.createElement("span");
      rating.className = "rating-inline";
      rating.innerHTML = `${item.rating}/5 ${starIcon()}`;
      titleCell.appendChild(rating);
    }

    titleTd.appendChild(titleCell);

    const yearTd = document.createElement("td");
    yearTd.className = "col-year";
    yearTd.textContent = item.year;

    const tagsTd = document.createElement("td");
    tagsTd.className = "col-tags";
    item.genres.forEach(g => {
      const tag = document.createElement("span");
      tag.className = "tag";
      const c = colorForGenre(g);
      tag.style.setProperty("--tag-color", c);
      tag.textContent = g;
      tagsTd.appendChild(tag);
    });

    const serverTd = document.createElement("td");
    serverTd.className = "col-server";
    const check = document.createElement("button");
    check.className = "check-btn" + (item.onServer ? " on" : "");
    check.setAttribute("aria-label", "Toggle on media server");
    check.innerHTML = checkIcon();
    check.addEventListener("click", () => {
      item.onServer = !item.onServer;
      check.classList.toggle("on", item.onServer);
      saveData();
    });
    serverTd.appendChild(check);

    const favTd = document.createElement("td");
    favTd.className = "col-fav";
    const heart = document.createElement("button");
    heart.className = "heart-btn" + (item.favorite ? " on" : "");
    heart.setAttribute("aria-label", "Toggle favorite");
    heart.innerHTML = heartIcon();
    heart.addEventListener("click", () => {
      item.favorite = !item.favorite;
      heart.classList.toggle("on", item.favorite);
      if (state.favoritesOnly && !item.favorite) {
        renderTable();
      }
      saveData();
    });
    favTd.appendChild(heart);

    const menuTd = document.createElement("td");
    menuTd.className = "col-menu";
    const menuBtn = document.createElement("button");
    menuBtn.className = "menu-btn";
    menuBtn.setAttribute("aria-label", "More options");
    menuBtn.innerHTML = kebabIcon();
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (currentMenuItem === item && rowMenuPanel.classList.contains("open")) {
        closeRowMenu();
      } else {
        openRowMenu(item, menuBtn);
      }
    });
    menuTd.appendChild(menuBtn);

    tr.appendChild(titleTd);
    tr.appendChild(yearTd);
    tr.appendChild(tagsTd);
    tr.appendChild(serverTd);
    tr.appendChild(favTd);
    tr.appendChild(menuTd);
    rowsEl.appendChild(tr);
  });

  emptyStateEl.style.display = items.length === 0 ? "flex" : "none";
  const noun = state.type === "movie" ? "movie" : "show";
  countLabel.textContent = `${items.length} ${noun}${items.length === 1 ? "" : "s"}`;
}

function starIcon() {
  return `<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
    <path d="M12 2.5l2.9 6.53 7.1.62-5.4 4.73 1.63 6.98L12 17.77l-6.23 3.6 1.63-6.99-5.4-4.72 7.1-.62L12 2.5z"/>
  </svg>`;
}

function heartIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M12 21s-6.7-4.35-9.65-8.03C.6 10.9.5 7.9 2.5 6.02 4.4 4.24 7.3 4.5 9 6.5l3 3.3 3-3.3c1.7-2 4.6-2.26 6.5-.48 2 1.88 1.9 4.88.15 6.95C18.7 16.65 12 21 12 21z"/>
  </svg>`;
}

function checkIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="4 12 9 17 20 6"/>
  </svg>`;
}

function kebabIcon() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <circle cx="12" cy="5" r="1.8"/>
    <circle cx="12" cy="12" r="1.8"/>
    <circle cx="12" cy="19" r="1.8"/>
  </svg>`;
}

/* ---------------------------------------------------------
   Tabs (Movies / TV Shows)
--------------------------------------------------------- */
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    state.type = tab.dataset.type;
    renderTable();
  });
});

/* ---------------------------------------------------------
   Genre dropdown open/close
--------------------------------------------------------- */
const genreFilterBtn = document.getElementById("genreFilterBtn");
const genreDropdown = document.getElementById("genreDropdown");

genreFilterBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  genreDropdown.classList.toggle("open");
  genreFilterBtn.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (!genreDropdown.contains(e.target) && e.target !== genreFilterBtn) {
    genreDropdown.classList.remove("open");
    genreFilterBtn.classList.remove("open");
  }
});

/* ---------------------------------------------------------
   Favorites switch
--------------------------------------------------------- */
const favSwitch = document.getElementById("favSwitch");
favSwitch.addEventListener("click", () => {
  state.favoritesOnly = !state.favoritesOnly;
  favSwitch.classList.toggle("on", state.favoritesOnly);
  favSwitch.setAttribute("aria-checked", state.favoritesOnly);
  renderTable();
});

/* ---------------------------------------------------------
   Watchlist switch (shows only unwatched items)
--------------------------------------------------------- */
const watchlistSwitch = document.getElementById("watchlistSwitch");
watchlistSwitch.addEventListener("click", () => {
  state.watchlistOnly = !state.watchlistOnly;
  watchlistSwitch.classList.toggle("on", state.watchlistOnly);
  watchlistSwitch.setAttribute("aria-checked", state.watchlistOnly);
  renderTable();
});

/* ---------------------------------------------------------
   Search box (title, year, genre, hidden keywords)
--------------------------------------------------------- */
const searchInput = document.getElementById("searchInput");
searchInput.addEventListener("input", () => {
  state.searchQuery = searchInput.value;
  renderTable();
});

/* ---------------------------------------------------------
   Column header sorting
--------------------------------------------------------- */
const sortHeaders = document.querySelectorAll(".sort-header");

function updateSortHeaderUI() {
  sortHeaders.forEach(btn => {
    const isActive = btn.dataset.sort === state.sortBy;
    btn.classList.toggle("active", isActive);
    btn.classList.toggle("desc", isActive && state.sortDir === "desc");
  });
}

sortHeaders.forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.sort;
    if (state.sortBy === key) {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.sortBy = key;
      // sensible default direction per column
      state.sortDir = key === "title" ? "asc" : "desc";
    }
    updateSortHeaderUI();
    renderTable();
  });
});

/* ---------------------------------------------------------
   Rating filter (5 clickable stars, "at least N stars")
--------------------------------------------------------- */
const ratingFilterStarsEl = document.getElementById("ratingFilterStars");

function renderRatingFilter() {
  ratingFilterStarsEl.innerHTML = "";
  for (let i = 1; i <= 5; i++) {
    const btn = document.createElement("button");
    btn.className = "rating-star-btn" + (i <= state.minRating ? " lit" : "");
    btn.setAttribute("aria-label", `Show ${i} star and up`);
    btn.innerHTML = starIconLarge();
    btn.addEventListener("click", () => {
      // clicking the star that's already the active threshold clears the filter
      state.minRating = (state.minRating === i) ? 0 : i;
      renderRatingFilter();
      renderTable();
    });
    btn.addEventListener("mouseenter", () => previewRatingStars(i));
    btn.addEventListener("mouseleave", () => previewRatingStars(state.minRating));
    ratingFilterStarsEl.appendChild(btn);
  }
}

function previewRatingStars(n) {
  const btns = ratingFilterStarsEl.querySelectorAll(".rating-star-btn");
  btns.forEach((btn, idx) => {
    btn.classList.toggle("lit", idx < n);
  });
}

function starIconLarge() {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M12 2.5l2.9 6.53 7.1.62-5.4 4.73 1.63 6.98L12 17.77l-6.23 3.6 1.63-6.99-5.4-4.72 7.1-.62L12 2.5z"/>
  </svg>`;
}

/* ---------------------------------------------------------
   Row menu (⋮): mark as watched/unwatched, add tags
--------------------------------------------------------- */
function openRowMenu(item, btnEl) {
  currentMenuItem = item;
  currentMenuBtn = btnEl;

  menuToggleWatchedBtn.textContent = item.watched ? "Mark as unwatched" : "Mark as watched";

  const rect = btnEl.getBoundingClientRect();
  rowMenuPanel.style.top = (rect.bottom + 6) + "px";
  rowMenuPanel.style.left = "auto";
  rowMenuPanel.style.right = (window.innerWidth - rect.right) + "px";

  rowMenuPanel.classList.add("open");
  btnEl.classList.add("open");
}

function closeRowMenu() {
  rowMenuPanel.classList.remove("open");
  if (currentMenuBtn) currentMenuBtn.classList.remove("open");
  currentMenuItem = null;
  currentMenuBtn = null;
}

document.addEventListener("click", (e) => {
  if (rowMenuPanel.classList.contains("open") &&
      !rowMenuPanel.contains(e.target) &&
      !e.target.closest(".menu-btn")) {
    closeRowMenu();
  }
});

menuToggleWatchedBtn.addEventListener("click", () => {
  if (!currentMenuItem) return;
  currentMenuItem.watched = !currentMenuItem.watched;
  closeRowMenu();
  renderTable();
  saveData();
});

menuAddTagsBtn.addEventListener("click", () => {
  if (!currentMenuItem) return;
  openTagsModal(currentMenuItem);
  closeRowMenu();
});

/* ---------------------------------------------------------
   Tags modal
--------------------------------------------------------- */
function openTagsModal(item) {
  tagsModalItem = item;
  tagsModalTitle.textContent = item.title;
  tagsModalYear.textContent = item.year;
  tagsModalInput.value = (item.keywords || []).join(", ");
  tagsModalOverlay.classList.add("open");
  tagsModalInput.focus();
}

function closeTagsModal() {
  tagsModalOverlay.classList.remove("open");
  tagsModalItem = null;
}

function saveTagsModal() {
  if (!tagsModalItem) return;
  const tags = tagsModalInput.value
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  tagsModalItem.keywords = tags;
  closeTagsModal();
  saveData();
}

tagsModalCancel.addEventListener("click", closeTagsModal);
tagsModalSave.addEventListener("click", saveTagsModal);

tagsModalOverlay.addEventListener("click", (e) => {
  if (e.target === tagsModalOverlay) closeTagsModal();
});

tagsModalInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveTagsModal();
  if (e.key === "Escape") closeTagsModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeRowMenu();
  }
});

/* ---------------------------------------------------------
   Save to data.json
   Attempts a PUT request (the standard way a local server would
   accept "replace this file's contents"). If the server hosting
   this page doesn't support writes, changes still work for the
   current session, and a download link is offered as a fallback
   so the updated data.json can be saved manually.
--------------------------------------------------------- */
async function saveData() {
  setSaveStatus("saving", "Saving\u2026");
  try {
    const res = await fetch("data.json", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(WATCHLIST, null, 2)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    setSaveStatus("saved", "Saved to data.json");
  } catch (err) {
    console.error("Save failed:", err);
    setSaveStatusFallback();
  }
}

function setSaveStatus(status, text) {
  clearTimeout(saveStatusTimer);
  saveStatusEl.className = "save-status show status-" + status;
  saveStatusTextEl.textContent = text;
  if (status === "saved") {
    saveStatusTimer = setTimeout(() => saveStatusEl.classList.remove("show"), 2500);
  }
}

function setSaveStatusFallback() {
  clearTimeout(saveStatusTimer);
  saveStatusEl.className = "save-status show status-local";
  saveStatusTextEl.innerHTML = "Couldn't auto-save \u2014 <a href=\"#\" id=\"downloadDataLink\">download data.json</a>";
  document.getElementById("downloadDataLink").addEventListener("click", (e) => {
    e.preventDefault();
    downloadDataJson();
  });
}

function downloadDataJson() {
  const blob = new Blob([JSON.stringify(WATCHLIST, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "data.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


/* ---------------------------------------------------------
   Load data.json, then run the first render
--------------------------------------------------------- */
async function init() {
  try {
    const response = await fetch("data.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    WATCHLIST = await response.json();
  } catch (err) {
    console.error("Failed to load data.json:", err);
    rowsEl.innerHTML = "";
    emptyStateEl.style.display = "flex";
    emptyStateEl.querySelector("strong").textContent = "Couldn't load data.json";
    emptyStateEl.querySelector("span").textContent = "Make sure data.json is in the same folder as this page and you're viewing it through a local server (not opened directly as a file).";
    return;
  }

  renderGenreDropdown();
  updateGenreButtonLabel();
  renderRatingFilter();
  updateSortHeaderUI();
  renderTable();
}

init();
