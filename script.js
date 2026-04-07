// ── Paper Summary Master Page — Script ──

(function () {
  'use strict';

  // ══════════════════════════════════════════════
  //  Tag Taxonomy: 3 groups × subcategories
  // ══════════════════════════════════════════════
  const TAG_TAXONOMY = {
    'Main Category': {
      'Flapping Wing': ['Flapping Wing', 'Ornithopter', 'MAV', 'FWMAV', 'Folding Wing', 'Flexible Wing', 'Morphing Wing', 'Feathered Wing'],
      'Rotorcraft': ['Helicopter', 'Rotor'],
      'Fixed Wing & Other': ['UAV', 'Flexible Aircraft', 'Pitching Wing', 'Finite Wing'],
      'Bio & Nature': ['Insect Flight', 'Bio-Inspired', 'Bird-Inspired', 'Biohybrid', 'Hovering'],
    },
    'Study Field': {
      'Aerodynamics': ['Aerodynamics', 'Unsteady Aerodynamics', 'Flapping Wing Aerodynamics', 'Rotor Aerodynamics', 'Quasi-Steady Aerodynamics', 'Low Reynolds Number', 'Ground Effect'],
      'Aeroelasticity & FSI': ['Aeroelasticity', 'FSI', 'Multibody Dynamics', 'Flexible Multibody Dynamics', 'Wing Flexibility'],
      'Flow Physics': ['Leading-Edge Vortex', 'Tip Vortex', 'Wing Morphology', 'Wing Twist', 'Scaling Law'],
      'Dynamics & Control': ['Flight Dynamics', 'Flight Control', 'Control', 'Roll Control', 'Stability Analysis'],
      'Design & Mechanism': ['Mechanism Design', 'Four-Bar Linkage', 'Drive System Design', 'Biomimetic Mechanism', 'Tendon-Driven', 'Perching', 'Aerial Grasping'],
    },
    'Materials and Methods': {
      'Vortex-Based': ['UVLM', 'Free Wake', 'Vortex Method', 'Vortex-Lattice Method', 'Vortex Particle Method', 'Vortex Sheet', 'Discrete Vortex Method'],
      'CFD & High-Fidelity': ['CFD', 'Navier-Stokes', 'Lattice Boltzmann Method', 'Panel Method'],
      'Structural': ['FEM', 'Co-Rotational Framework', 'Radial Basis Function', 'Partitioned Coupling'],
      'Reduced-Order': ['Blade Element Theory', 'Biot-Savart Law', 'State-Space Model', 'LESP', 'Low-Order Model', 'Fast Multipole Method'],
      'AI & Data-Driven': ['Reinforcement Learning', 'Deep Learning', 'Optimization', 'Piezoelectric Sensing', 'Embodied Perception'],
      'Experimental': ['Experimental', 'Wind Tunnel', 'Flight Test', 'Force Measurement'],
      'General': ['Simulation', 'Methodology', 'Computational Acceleration', 'Flapping Frequency', 'Preliminary Design'],
    },
  };

  // Build reverse lookup: tag → group name (for uncategorized detection)
  const tagToGroup = {};
  for (const [group, subs] of Object.entries(TAG_TAXONOMY)) {
    for (const [, tags] of Object.entries(subs)) {
      tags.forEach(t => { tagToGroup[t] = group; });
    }
  }

  // ══════════════════════════════════════════════
  //  State
  // ══════════════════════════════════════════════
  let papers = [];
  let activeTags = new Set();
  let sortOrder = 'desc';
  let searchQuery = '';
  let activeTab = null; // null = all tabs closed

  // DOM refs
  const searchInput = document.getElementById('search-input');
  const sortBtn = document.getElementById('sort-btn');
  const sortLabel = document.getElementById('sort-label');
  const clearBtn = document.getElementById('clear-btn');
  const tabBar = document.getElementById('tab-bar');
  const tagContainer = document.getElementById('tag-container');
  const paperList = document.getElementById('paper-list');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const paperCount = document.getElementById('paper-count');
  const activeFilters = document.getElementById('active-filters');
  const filterSummary = document.getElementById('filter-summary');

  // ── Tag frequency from current papers ──
  function getTagFrequency() {
    const freq = {};
    papers.forEach(p => p.tags.forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    return freq;
  }

  // ── Importance stars ──
  function renderStars(importance) {
    const filled = importance || 0;
    const empty = 3 - filled;
    return '<span class="stars">' +
      '\u2605'.repeat(filled) +
      '<span class="stars-dimmed">' + '\u2605'.repeat(empty) + '</span>' +
      '</span>';
  }

  // ── Render a single paper card ──
  function renderPaperCard(paper) {
    const tagsHtml = paper.tags.map(tag =>
      `<span class="card-tag tag-default">${tag}</span>`
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

  // ── Render tab bar ──
  function renderTabs() {
    const groups = Object.keys(TAG_TAXONOMY);
    tabBar.innerHTML = groups.map(group => {
      const isActive = group === activeTab;
      return `<button class="tab-btn ${isActive ? 'tab-active' : ''}" data-group="${group}">${group}</button>`;
    }).join('');

    tabBar.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = activeTab === btn.dataset.group ? null : btn.dataset.group;
        renderTabs();
        renderTagPanel();
      });
    });
  }

  // ── Render tag panel (subcategories for active tab) ──
  function renderTagPanel() {
    if (!activeTab) {
      tagContainer.innerHTML = '';
      return;
    }
    const subcategories = TAG_TAXONOMY[activeTab];
    const freq = getTagFrequency();

    let html = '';
    for (const [subName, tags] of Object.entries(subcategories)) {
      // Only show tags that exist in current papers
      const existingTags = tags.filter(t => freq[t]);
      if (existingTags.length === 0) continue;

      // Sort by frequency within subcategory
      existingTags.sort((a, b) => (freq[b] || 0) - (freq[a] || 0));

      const tagsHtml = existingTags.map(tag => {
        const isActive = activeTags.has(tag);
        const count = freq[tag] || 0;
        return `<button class="tag-btn tag-default ${isActive ? 'active' : ''}" data-tag="${tag}">${tag}<span class="tag-count">${count}</span></button>`;
      }).join('');

      html += `
        <div class="subcategory-row">
          <span class="subcategory-label">${subName}</span>
          <div class="subcategory-tags">${tagsHtml}</div>
        </div>`;
    }

    // Uncategorized tags in this group (safety net for new tags)
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
  }

  // ── Filter & sort papers ──
  function getFilteredPapers() {
    let filtered = papers;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        (p.abstract && p.abstract.toLowerCase().includes(q)) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    if (activeTags.size > 0) {
      filtered = filtered.filter(p =>
        Array.from(activeTags).every(tag => p.tags.includes(tag))
      );
    }

    filtered.sort((a, b) =>
      sortOrder === 'desc' ? b.year - a.year : a.year - b.year
    );

    return filtered;
  }

  // ── Main render ──
  function render() {
    const filtered = getFilteredPapers();

    // Tabs + tag panel
    renderTabs();
    renderTagPanel();

    // Paper list
    if (filtered.length > 0) {
      paperList.innerHTML = filtered.map(renderPaperCard).join('');
      paperList.querySelectorAll('.paper-card[data-href]').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.doi-link')) return;
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
      filterSummary.textContent = `Filtered by ${parts.join(' + ')} \u2014 ${shown} result${shown !== 1 ? 's' : ''}`;
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
