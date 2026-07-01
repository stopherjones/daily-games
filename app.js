(function () {
  // ── Application State ──────────────────────────────────────────────────────
  let gamesData = []; // Populated asynchronously via fetch
  let currentSearch = '';
  let currentCategory = 'all';
  let currentMechanic = 'all';
  let currentDuration = 'all';
  let currentSortOption = 'auto';
  let currentEssentialOnly = false;
  let currentHideCompleted = false;

  // ── Core Engine Init ───────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    loadGamesDataset();
    setupFilterCollapse();
  });

  function setupFilterCollapse() {
    const details = document.querySelector('.filter-collapse');
    if (!details) return;

    const updateState = () => {
      details.open = window.innerWidth > 900;
    };

    updateState();
    window.addEventListener('resize', updateState);
  }

  // ── Asynchronous Data Loading ──────────────────────────────────────────────
  async function loadGamesDataset() {
    const grid = document.getElementById('games-grid');
    try {
      const response = await fetch('games.json');
      if (!response.ok) {
        throw new Error(`HTTP error status code: ${response.status}`);
      }
      gamesData = await response.json();
      
      // Initialise control filters and presentation layer once data arrives
      populateCategories();
      populateMechanics();
      populateDurations();
      initEventListeners();
      renderGrid();
    } catch (error) {
      console.error('Failed to load games data:', error);
      if (grid) {
        grid.innerHTML = `
          <div class="empty" style="color: #ff6b6b;">
            <p><strong>Initialization Error:</strong> Could not load games data matrix.</p>
            <p style="font-size: 0.8rem; margin-top: 8px; color: var(--muted);">
              Ensure you are running a local web server environment rather than double-clicking the raw HTML file.
            </p>
          </div>`;
      }
    }
  }

  // ── Populate Categories Dynamic Dropdown ──────────────────────────────────
  function populateCategories() {
    const select = document.getElementById('category-filter');
    if (!select) return;

    // Extract unique sorted categories from arrays or strings
    const categories = [...new Set(gamesData.flatMap(g => Array.isArray(g.category) ? g.category : [g.category]))].filter(Boolean).sort();
    
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      select.appendChild(opt);
    });
  }

  function populateMechanics() {
    const select = document.getElementById('mechanic-filter');
    if (!select) return;

    const mechanics = [...new Set(gamesData.map(g => g.mechanic))].sort();

    mechanics.forEach(mech => {
      const opt = document.createElement('option');
      opt.value = mech;
      opt.textContent = mech.charAt(0).toUpperCase() + mech.slice(1);
      select.appendChild(opt);
    });
  }

  function populateDurations() {
    const select = document.getElementById('duration-filter');
    if (!select) return;

    const durations = [...new Set(gamesData.map(g => g.duration))].sort();

    durations.forEach(duration => {
      const opt = document.createElement('option');
      opt.value = duration;
      opt.textContent = duration;
      select.appendChild(opt);
    });
  }

  // ── Setup Controls Event Binding ──────────────────────────────────────────
  function initEventListeners() {
    bindInput('sort-filter', (v) => currentSortOption = v, 'change');
    bindInput('game-search', (v) => currentSearch = v.trim().toLowerCase(), 'input');
    bindInput('category-filter', (v) => currentCategory = v, 'change');
    bindInput('mechanic-filter', (v) => currentMechanic = v, 'change');
    bindInput('duration-filter', (v) => currentDuration = v, 'change');
    bindCheckbox('essential-toggle', (v) => currentEssentialOnly = v);
    bindCheckbox('hide-completed-toggle', (v) => currentHideCompleted = v);

    const randomBtn = document.getElementById('random-game-btn');
    if (randomBtn) {
      randomBtn.addEventListener('click', selectRandomGame);
    }

    const resetDoneBtn = document.getElementById('reset-done-btn');
    if (resetDoneBtn) {
      resetDoneBtn.addEventListener('click', resetCompletedStatuses);
    }
  }

  function bindInput(id, updateFn, eventType) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(eventType, () => { updateFn(el.value); renderGrid(); });
  }

  function bindCheckbox(id, updateFn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => { updateFn(el.checked); renderGrid(); });
  }

  // ── Filtering Logic & Rendering ──────────────────────────────────────────
  function renderGrid() {
    const grid = document.getElementById('games-grid');
    if (!grid) return;

    const filteredGames = gamesData.filter(game => {
      const matchesSearch = game.name.toLowerCase().includes(currentSearch) || 
                            game.description.toLowerCase().includes(currentSearch);
      const matchesCategory = currentCategory === 'all' || (Array.isArray(game.category) ? game.category.includes(currentCategory) : game.category === currentCategory);
      const matchesMechanic = currentMechanic === 'all' || game.mechanic === currentMechanic;
      const matchesDuration = currentDuration === 'all' || game.duration === currentDuration;
      const matchesEssential = !currentEssentialOnly || game.daily_essential;
      
      const isCompleted = localStorage.getItem(`completed_${game.id}`) === 'true';
      const matchesCompleted = !currentHideCompleted || !isCompleted;

      return matchesSearch && matchesCategory && matchesMechanic && matchesDuration && matchesEssential && matchesCompleted;
    }).sort((a, b) => {
      const aPlays = parseInt(localStorage.getItem(`clicks_${a.id}`), 10) || 0;
      const bPlays = parseInt(localStorage.getItem(`clicks_${b.id}`), 10) || 0;
      const aLast = localStorage.getItem(`lastPlayed_${a.id}`);
      const bLast = localStorage.getItem(`lastPlayed_${b.id}`);
      const aTime = aLast ? Date.parse(aLast) : 0;
      const bTime = bLast ? Date.parse(bLast) : 0;

      switch (currentSortOption) {
        case 'plays-asc':
          if (aPlays !== bPlays) return aPlays - bPlays;
          return a.name.localeCompare(b.name);
        case 'name-asc':
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return bPlays - aPlays;
        case 'name-desc':
          if (a.name !== b.name) return b.name.localeCompare(a.name);
          return bPlays - aPlays;
        case 'lastplayed-asc':
          if (aTime !== bTime) return aTime - bTime;
          return a.name.localeCompare(b.name);
        case 'lastplayed-desc':
          if (aTime !== bTime) return bTime - aTime;
          return a.name.localeCompare(b.name);
        case 'plays-desc':
        case 'auto':
        default:
          if (aPlays !== bPlays) return bPlays - aPlays;
          return a.name.localeCompare(b.name);
      }
    });

    if (filteredGames.length === 0) {
      grid.innerHTML = `<div class="empty"><p>No games match your active layout criteria filters.</p></div>`;
      return;
    }

    grid.innerHTML = filteredGames.map(game => {
      const isCompleted = localStorage.getItem(`completed_${game.id}`) === 'true';
      const clickCount = localStorage.getItem(`clicks_${game.id}`) || 0;
      const lastPlayedValue = localStorage.getItem(`lastPlayed_${game.id}`);
      const lastPlayedText = lastPlayedValue ? formatLastPlayed(lastPlayedValue) : 'Never';
      
      return `
        <article class="game-card ${isCompleted ? 'state-completed' : ''}" 
                 id="card-${game.id}"
                 data-category="${escAttr(Array.isArray(game.category) ? game.category.join(' ') : game.category)}" 
                 data-duration="${escAttr(game.duration)}" 
                 data-essential="${game.daily_essential}">
          <div class="card-header">
            <div>
              <h3><a href="${escAttr(game.url)}" target="_blank" class="game-title-link">${escHtml(game.name)}</a> ${game.daily_essential ? '<span class="essential-star" title="Daily Essential">⭐</span>' : ''}</h3>
              <span class="meta-duration" style="font-size:0.78rem; color:var(--muted); display:block; margin-top:2px;">${escHtml(game.duration)}</span>
            </div>
            <div class="badge-list">
              ${Array.isArray(game.category)
                ? game.category.map(cat => `<span class="badge tag-${escAttr(normalizeTagClass(cat))}">${escHtml(cat)}</span>`).join(' ')
                : `<span class="badge tag-${escAttr(normalizeTagClass(game.category))}">${escHtml(game.category)}</span>`}
            </div>
          </div>
          <p class="card-desc">${escHtml(game.description)}</p>
          <div class="card-footer">
            <div class="card-stats">
              <div class="click-counter-badge">
                ⚡ Played: <span id="count-val-${game.id}">${clickCount}</span> times
              </div>
              <div class="click-counter-badge">
                🕒 Last played: ${escHtml(lastPlayedText)}
              </div>
            </div>
            <button class="btn-status-toggle ${isCompleted ? 'completed' : ''}" 
                    onclick="window.AppEngine.toggleComplete('${game.id}')">
              ${isCompleted ? 'Done ✓' : 'Mark Done'}
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function formatLastPlayed(value) {
    try {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (err) {
      return '—';
    }
  }

  // ── Surprise Me Interactivity ─────────────────────────────────────────────
  function selectRandomGame() {
    const cards = document.querySelectorAll('.game-card:not(.state-completed)');
    if (cards.length === 0) return;

    const randomIndex = Math.floor(Math.random() * cards.length);
    const targetCard = cards[randomIndex];

    document.querySelectorAll('.game-card').forEach(c => c.classList.remove('highlighted'));
    targetCard.classList.add('highlighted');
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetCompletedStatuses() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('completed_')) {
        localStorage.removeItem(key);
      }
    }

    renderGrid();
  }

  // ── Global Namespace Bridging ─────────────────────────────────────────────
  window.AppEngine = {
    toggleComplete: function(id) {
      const completedKey = `completed_${id}`;
      const clicksKey = `clicks_${id}`;
      const currentState = localStorage.getItem(completedKey) === 'true';
      localStorage.setItem(completedKey, !currentState);

      if (!currentState) {
        let currentClicks = parseInt(localStorage.getItem(clicksKey)) || 0;
        currentClicks++;
        localStorage.setItem(clicksKey, currentClicks);
        localStorage.setItem(`lastPlayed_${id}`, new Date().toISOString());
      }

      renderGrid();
    },
    trackClick: function(id) {
      // Keep the original click tracker available if needed,
      // but do not increment on link clicks by default.
      const key = `clicks_${id}`;
      let currentClicks = parseInt(localStorage.getItem(key)) || 0;
      currentClicks++;
      localStorage.setItem(key, currentClicks);
      
      const countEl = document.getElementById(`count-val-${id}`);
      if (countEl) countEl.textContent = currentClicks;
    }
  };

  // ── Utilities ─────────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Changed to correctly clean up single quotes if they show up in programmatic fields
  function escAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function normalizeTagClass(value) {
    if (!value) return '';
    return value.toString().toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '');
  }
})();
