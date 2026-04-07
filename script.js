// ── Paper Summary Master Page — Script ──

(function () {
  'use strict';

  // State
  let papers = [];
  let activeTags = new Set();
  let sortOrder = 'desc'; // desc = newest first
  let searchQuery = '';
  let tagsExpanded = false;
  const MAX_VISIBLE_TAGS = 8;

  // DOM refs
  const searchInput = document.getElementById('search-input');
  const sortBtn = document.getElementById('sort-btn');
  const sortLabel = document.getElementById('sort-label');
  const clearBtn = document.getElementById('clear-btn');
  const tagContainer = document.getElementById('tag-container');
  const paperList = document.getElementById('paper-list');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const paperCount = document.getElementById('paper-count');
  const activeFilters = document.getElementById('active-filters');
  const filterSummary = document.getElementById('filter-summary');

  // ── Tag → CSS class mapping ──
  function tagToClass(tag) {
    const slug = tag.toLowerCase().replace(/\s+/g, '-');
    const knownTags = [
      'aerodynamics', 'uvlm', 'flapping-wing', 'ornithopter',
      'fsi', 'multibody-dynamics', 'biorobotics', 'cfd',
      'simulation', 'aeroelasticity', 'methodology', 'optimization',
      'flight-dynamics', 'key-paper', 'review'
    ];
    return knownTags.includes(slug) ? `tag-${slug}` : 'tag-default';
  }

  // ── Importance stars ──
  function renderStars(importance) {
    const filled = importance || 0;
    const empty = 3 - filled;
    return '<span class="stars">' +
      '★'.repeat(filled) +
      '<span class="stars-dimmed">' + '★'.repeat(empty) + '</span>' +
      '</span>';
  }

  // ── Render a single paper card ──
  function renderPaperCard(paper) {
    const tagsHtml = paper.tags.map(tag =>
      `<span class="card-tag ${tagToClass(tag)}">${tag}</span>`
    ).join('');

    const doiHtml = paper.doi
      ? `<a href="https://doi.org/${paper.doi}" class="doi-link" target="_blank" rel="noopener" onclick="event.stopPropagation()">DOI: ${paper.doi}</a>`
      : '';

    return `
      <div class="paper-card" data-href="${paper.file}">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="year-badge">${paper.year}</span>
          ${renderStars(paper.importance)}
        </div>
        <h2 class="text-base font-semibold text-slate-900 leading-snug mb-1.5">${paper.title}</h2>
        <p class="text-sm text-slate-500 mb-2">${paper.authors} &mdash; <span class="italic">${paper.journal}</span></p>
        <p class="text-sm text-slate-600 leading-relaxed mb-3 line-clamp-2">${paper.abstract || ''}</p>
        <div class="flex flex-wrap items-center gap-1.5">
          ${tagsHtml}
          ${doiHtml ? `<span class="mx-1 text-slate-300">|</span>${doiHtml}` : ''}
        </div>
      </div>`;
  }

  // ── Collect tags sorted by frequency (descending), active tags always first ──
  function collectTagsByFrequency(papers) {
    const freq = {};
    papers.forEach(p => p.tags.forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }

  // ── Render tag filter buttons with toggle ──
  function renderTagButtons(tags) {
    // Active tags always visible at the top, then frequency-sorted rest
    const activeList = tags.filter(t => activeTags.has(t));
    const inactiveList = tags.filter(t => !activeTags.has(t));
    const ordered = [...activeList, ...inactiveList];

    const needsToggle = ordered.length > MAX_VISIBLE_TAGS;
    const visible = tagsExpanded ? ordered : ordered.slice(0, MAX_VISIBLE_TAGS);
    const hiddenCount = ordered.length - MAX_VISIBLE_TAGS;

    let html = visible.map(tag => {
      const isActive = activeTags.has(tag);
      return `<button class="tag-btn ${tagToClass(tag)} ${isActive ? 'active' : ''}" data-tag="${tag}">${tag}</button>`;
    }).join('');

    if (needsToggle) {
      if (tagsExpanded) {
        html += `<button class="tag-toggle-btn" id="tag-toggle">Show less</button>`;
      } else {
        html += `<button class="tag-toggle-btn" id="tag-toggle">+${hiddenCount} more</button>`;
      }
    }

    tagContainer.innerHTML = html;

    // Tag click handlers
    tagContainer.querySelectorAll('.tag-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tag = btn.dataset.tag;
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
        } else {
          activeTags.add(tag);
        }
        render();
      });
    });

    // Toggle handler
    const toggleBtn = document.getElementById('tag-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        tagsExpanded = !tagsExpanded;
        render();
      });
    }
  }

  // ── Filter & sort papers ──
  function getFilteredPapers() {
    let filtered = papers;

    // Text search (title + authors)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        (p.abstract && p.abstract.toLowerCase().includes(q)) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Tag filter (intersection — paper must have ALL selected tags)
    if (activeTags.size > 0) {
      filtered = filtered.filter(p =>
        Array.from(activeTags).every(tag => p.tags.includes(tag))
      );
    }

    // Sort
    filtered.sort((a, b) =>
      sortOrder === 'desc' ? b.year - a.year : a.year - b.year
    );

    return filtered;
  }

  // ── Main render ──
  function render() {
    const filtered = getFilteredPapers();
    const allTags = collectTagsByFrequency(papers);

    // Tag buttons
    renderTagButtons(allTags);

    // Paper list
    if (filtered.length > 0) {
      paperList.innerHTML = filtered.map(renderPaperCard).join('');
      paperList.querySelectorAll('.paper-card[data-href]').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.doi-link')) return; // let DOI link handle itself
          window.open(card.dataset.href, '_blank', 'noopener');
        });
      });
      paperList.classList.remove('hidden');
      emptyState.classList.add('hidden');
    } else {
      paperList.innerHTML = '';
      paperList.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }

    // Paper count
    const total = papers.length;
    const shown = filtered.length;
    paperCount.textContent = shown === total
      ? `${total} papers`
      : `${shown} / ${total} papers`;

    // Sort label
    sortLabel.textContent = sortOrder === 'desc' ? 'Newest first' : 'Oldest first';

    // Active filters indicator
    const hasFilters = searchQuery || activeTags.size > 0;
    if (hasFilters) {
      activeFilters.classList.remove('hidden');
      const parts = [];
      if (searchQuery) parts.push(`"${searchQuery}"`);
      if (activeTags.size > 0) parts.push(`tags: ${Array.from(activeTags).join(', ')}`);
      filterSummary.textContent = `Filtered by ${parts.join(' + ')} — ${shown} result${shown !== 1 ? 's' : ''}`;
      clearBtn.classList.remove('hidden');
      clearBtn.classList.add('flex');
    } else {
      activeFilters.classList.add('hidden');
      clearBtn.classList.add('hidden');
      clearBtn.classList.remove('flex');
    }
  }

  // ── Event listeners ──
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    render();
  });

  sortBtn.addEventListener('click', () => {
    sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    render();
  });

  clearBtn.addEventListener('click', () => {
    searchQuery = '';
    searchInput.value = '';
    activeTags.clear();
    render();
  });

  // ── Keyboard shortcut: "/" focuses search ──
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
    }
    if (e.key === 'Escape') {
      searchInput.blur();
    }
  });

  // ── Load data ──
  async function init() {
    try {
      const response = await fetch('papers.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      papers = await response.json();
      loadingState.classList.add('hidden');
      render();
    } catch (err) {
      loadingState.innerHTML = `
        <div class="text-center py-16">
          <svg class="w-16 h-16 mx-auto text-red-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
          <p class="text-slate-500 text-lg font-medium">Failed to load papers</p>
          <p class="text-slate-400 text-sm mt-1">${err.message}</p>
        </div>`;
    }
  }

  init();
})();
