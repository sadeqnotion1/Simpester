// Global state variables
let scenes = [];
let stats = {};
let activeSection = 'library';
let filteredScenes = [];

// DOM Elements
const sections = {
  library: document.getElementById('library-section'),
  dashboard: document.getElementById('dashboard-section'),
  sync: document.getElementById('sync-section')
};

const navButtons = {
  library: document.getElementById('btn-library'),
  dashboard: document.getElementById('btn-dashboard'),
  sync: document.getElementById('btn-sync')
};

// Nav buttons click events
Object.keys(navButtons).forEach(key => {
  navButtons[key].addEventListener('click', () => {
    switchSection(key);
  });
});

function switchSection(sectionId) {
  activeSection = sectionId;
  
  // Update nav active classes
  Object.keys(navButtons).forEach(k => {
    if (k === sectionId) {
      navButtons[k].classList.add('active');
    } else {
      navButtons[k].classList.remove('active');
    }
  });

  // Update section visibility
  Object.keys(sections).forEach(k => {
    if (k === sectionId) {
      sections[k].style.display = 'flex';
    } else {
      sections[k].style.display = 'none';
    }
  });

  if (sectionId === 'dashboard') {
    loadDashboardStats();
  }
}

// Fetch Initial Data
async function loadData() {
  try {
    const res = await fetch('/api/scenes');
    scenes = await res.json();
    filteredScenes = [...scenes];
    
    populateFilters();
    renderLibrary();
    renderSpotlight();
    
    // If empty library, redirect to sync
    if (scenes.length === 0) {
      switchSection('sync');
    }
  } catch (err) {
    console.error("Failed to load scenes:", err);
  }
}

// Render Spotlight Section (with random backdrop scene)
function renderSpotlight() {
  const spotlightCard = document.getElementById('spotlight-card');
  
  // Find a scene that has a background image and description
  const matchedScenes = scenes.filter(s => s.metadata && s.metadata.matched && s.metadata.background);
  if (matchedScenes.length === 0) {
    spotlightCard.style.display = 'none';
    return;
  }
  
  // Pick random scene
  const randomScene = matchedScenes[Math.floor(Math.random() * matchedScenes.length)];
  
  document.getElementById('spotlight-backdrop').style.backgroundImage = `url(${randomScene.metadata.background})`;
  document.getElementById('spotlight-title').textContent = randomScene.metadata.title;
  document.getElementById('spotlight-site').innerHTML = `<i class="fa-solid fa-video"></i> ${randomScene.metadata.site.name}`;
  
  const relDate = randomScene.metadata.date ? randomScene.metadata.date.substring(0, 4) : 'Unknown';
  document.getElementById('spotlight-date').innerHTML = `<i class="fa-regular fa-calendar"></i> ${relDate}`;
  
  const partCount = randomScene.files.length;
  document.getElementById('spotlight-parts').innerHTML = `<i class="fa-solid fa-file-video"></i> ${partCount} ${partCount > 1 ? 'Parts' : 'Part'}`;
  
  document.getElementById('spotlight-description').textContent = randomScene.metadata.description || 'No description available for this scene.';
  
  // Button handlers
  const viewBtn = document.getElementById('spotlight-btn-view');
  viewBtn.onclick = () => openModal(randomScene);
  
  const trailerBtn = document.getElementById('spotlight-btn-trailer');
  if (randomScene.metadata.trailer) {
    trailerBtn.style.display = 'flex';
    trailerBtn.onclick = () => window.open(randomScene.metadata.trailer, '_blank');
  } else {
    trailerBtn.style.display = 'none';
  }
  
  spotlightCard.style.display = 'flex';
}

// Populate Dropdown Filters dynamically
function populateFilters() {
  const sites = new Set();
  const tags = new Set();
  const years = new Set();
  
  scenes.forEach(s => {
    if (s.metadata.site?.name) sites.add(s.metadata.site.name);
    if (s.metadata.date) {
      const year = s.metadata.date.split('-')[0];
      if (/^\d{4}$/.test(year)) years.add(year);
    }
    if (s.metadata.tags) {
      s.metadata.tags.forEach(t => tags.add(t));
    }
  });

  // Populate Site Select
  const siteSelect = document.getElementById('filter-site');
  siteSelect.innerHTML = '<option value="all">All Studios</option>';
  Array.from(sites).sort().forEach(site => {
    siteSelect.innerHTML += `<option value="${site}">${site}</option>`;
  });

  // Populate Year Select
  const yearSelect = document.getElementById('filter-year');
  yearSelect.innerHTML = '<option value="all">All Years</option>';
  Array.from(years).sort((a,b) => b-a).forEach(year => {
    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
  });

  // Populate Tag Select
  const tagSelect = document.getElementById('filter-tag');
  tagSelect.innerHTML = '<option value="all">All Tags</option>';
  Array.from(tags).sort().forEach(tag => {
    tagSelect.innerHTML += `<option value="${tag}">${tag}</option>`;
  });
}

// Filter and Sort Handler
function applyFilters() {
  const searchQuery = document.getElementById('search-input').value.toLowerCase().trim();
  const selectedSite = document.getElementById('filter-site').value;
  const selectedYear = document.getElementById('filter-year').value;
  const selectedTag = document.getElementById('filter-tag').value;
  const splitsOnly = document.getElementById('filter-splits').checked;
  const selectedStatus = document.getElementById('filter-status').value;
  const sortBy = document.getElementById('sort-select').value;

  filteredScenes = scenes.filter(s => {
    // 1. Search Query
    if (searchQuery) {
      const titleMatch = s.metadata.title?.toLowerCase().includes(searchQuery);
      const siteMatch = s.metadata.site?.name?.toLowerCase().includes(searchQuery);
      const fileMatch = s.files.some(f => f.toLowerCase().includes(searchQuery));
      const performerMatch = s.metadata.performers?.some(p => p.name.toLowerCase().includes(searchQuery));
      const tagMatch = s.metadata.tags?.some(t => t.toLowerCase().includes(searchQuery));
      
      if (!titleMatch && !siteMatch && !fileMatch && !performerMatch && !tagMatch) {
        return false;
      }
    }

    // 2. Site
    if (selectedSite !== 'all' && s.metadata.site?.name !== selectedSite) {
      return false;
    }

    // 3. Year
    if (selectedYear !== 'all') {
      const year = s.metadata.date?.split('-')[0];
      if (year !== selectedYear) return false;
    }

    // 4. Tag
    if (selectedTag !== 'all') {
      if (!s.metadata.tags?.includes(selectedTag)) return false;
    }

    // 5. Splits Only
    if (splitsOnly && s.files.length <= 1) {
      return false;
    }

    // 6. Match Status
    if (selectedStatus !== 'all') {
      if (selectedStatus === 'matched' && !s.metadata.matched) return false;
      if (selectedStatus === 'local' && s.metadata.matched) return false;
    }

    return true;
  });

  // Sort Results
  if (sortBy === 'date-desc') {
    filteredScenes.sort((a, b) => new Date(b.metadata.date || 0) - new Date(a.metadata.date || 0));
  } else if (sortBy === 'date-asc') {
    filteredScenes.sort((a, b) => new Date(a.metadata.date || 0) - new Date(b.metadata.date || 0));
  } else if (sortBy === 'title-asc') {
    filteredScenes.sort((a, b) => (a.metadata.title || '').localeCompare(b.metadata.title || ''));
  } else if (sortBy === 'parts-desc') {
    filteredScenes.sort((a, b) => b.files.length - a.files.length);
  }

  renderLibraryGrid();
}

// Add Event Listeners for Filters
document.getElementById('search-input').addEventListener('input', applyFilters);
document.getElementById('filter-site').addEventListener('change', applyFilters);
document.getElementById('filter-year').addEventListener('change', applyFilters);
document.getElementById('filter-tag').addEventListener('change', applyFilters);
document.getElementById('filter-splits').addEventListener('change', applyFilters);
document.getElementById('filter-status').addEventListener('change', applyFilters);
document.getElementById('sort-select').addEventListener('change', applyFilters);

// Render Library Header and Grid
function renderLibrary() {
  applyFilters();
}

function renderLibraryGrid() {
  const grid = document.getElementById('scenes-grid');
  document.getElementById('results-count').textContent = filteredScenes.length;
  
  if (filteredScenes.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-film"></i>
        <h3>No matching scenes found</h3>
        <p>Try clearing your search query or adjusting filters.</p>
        <button class="btn btn-secondary" onclick="clearFilters()">Clear Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = '';
  filteredScenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.onclick = () => openModal(scene);

    const partsCount = scene.files.length;
    const isMatched = scene.metadata.matched;
    
    // Image fallback
    let posterImg = scene.metadata.poster;
    if (!posterImg) {
      posterImg = `https://placehold.co/400x600/17181c/dba506?text=${encodeURIComponent(scene.metadata.title.substring(0, 15))}`;
    }

    card.innerHTML = `
      <div class="card-poster-area">
        ${partsCount > 1 ? `<span class="card-badge-parts">${partsCount} Parts</span>` : ''}
        <span class="card-badge-status ${isMatched ? 'matched' : ''}">${isMatched ? 'Matched' : 'Local'}</span>
        <img class="card-poster" src="${posterImg}" alt="Poster" loading="lazy" onerror="this.src='https://placehold.co/400x600/17181c/dba506?text=No+Poster'">
        <div class="card-overlay">
          <div class="card-play-icon">
            <i class="fa-solid fa-play"></i>
          </div>
        </div>
      </div>
      <div class="card-details">
        <span class="card-studio">${scene.metadata.site.name || 'Studio'}</span>
        <h4 class="card-title">${scene.metadata.title}</h4>
        <div class="card-meta">
          <span>${scene.metadata.date ? scene.metadata.date.split('-')[0] : 'N/A'}</span>
          <span><i class="fa-solid fa-user"></i> ${scene.metadata.performers?.[0]?.name || 'Unknown'}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function clearFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('filter-site').value = 'all';
  document.getElementById('filter-year').value = 'all';
  document.getElementById('filter-tag').value = 'all';
  document.getElementById('filter-splits').checked = false;
  document.getElementById('filter-status').value = 'all';
  document.getElementById('sort-select').value = 'date-desc';
  applyFilters();
}

// Modal management
const modal = document.getElementById('detail-modal');
const closeBtn = document.getElementById('modal-close-btn');

closeBtn.onclick = closeModal;
modal.onclick = (e) => {
  if (e.target === modal) closeModal();
};

function closeModal() {
  modal.style.display = 'none';
  document.body.style.overflow = 'auto';
}

function openLightbox(src) {
  const lightbox = document.getElementById('lightbox-modal');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  lightbox.style.display = 'flex';
}

function closeLightbox() {
  document.getElementById('lightbox-modal').style.display = 'none';
}

function openModal(scene) {
  // Set background blur
  const blurBg = document.getElementById('modal-backdrop-blur');
  if (scene.metadata.background) {
    blurBg.style.backgroundImage = `url(${scene.metadata.background})`;
    blurBg.style.display = 'block';
  } else {
    blurBg.style.display = 'none';
  }

  // Set poster
  const poster = document.getElementById('modal-poster');
  poster.src = scene.metadata.poster || `https://placehold.co/400x600/17181c/dba506?text=${encodeURIComponent(scene.metadata.title.substring(0, 15))}`;

  // Title, site, date
  document.getElementById('modal-title').textContent = scene.metadata.title;
  document.getElementById('modal-studio').textContent = scene.metadata.site.name;
  
  const network = document.getElementById('modal-network');
  if (scene.metadata.site.network) {
    network.textContent = scene.metadata.site.network;
    network.style.display = 'inline-block';
  } else {
    network.style.display = 'none';
  }
  
  // Set metadata source
  const source = document.getElementById('modal-source');
  if (scene.metadata.source) {
    source.textContent = scene.metadata.source === 'theporndb' ? 'ThePornDB' : (scene.metadata.source === 'eporner' ? 'Eporner' : 'Local');
    source.className = `modal-source ${scene.metadata.source}`;
    source.style.display = 'inline-block';
  } else {
    source.style.display = 'none';
  }
  
  document.getElementById('modal-date').innerHTML = `<i class="fa-regular fa-calendar"></i> ${scene.metadata.date || 'Unknown Date'}`;

  // Description
  document.getElementById('modal-description').textContent = scene.metadata.description || 'No description available for this scene.';

  // Buttons
  const urlBtn = document.getElementById('modal-btn-url');
  if (scene.metadata.url) {
    urlBtn.style.display = 'flex';
    urlBtn.innerHTML = `<i class="fa-solid fa-up-right-from-square"></i> View on ${scene.metadata.source === 'eporner' ? 'Eporner' : 'ThePornDB'}`;
    urlBtn.onclick = () => window.open(scene.metadata.url, '_blank');
  } else {
    urlBtn.style.display = 'none';
  }

  const studioUrlBtn = document.getElementById('modal-btn-studio-url');
  if (scene.metadata.studio_url && scene.metadata.studio_url !== scene.metadata.url) {
    studioUrlBtn.style.display = 'flex';
    studioUrlBtn.onclick = () => window.open(scene.metadata.studio_url, '_blank');
  } else {
    studioUrlBtn.style.display = 'none';
  }

  const trailerBtn = document.getElementById('modal-btn-trailer');
  if (scene.metadata.trailer) {
    trailerBtn.style.display = 'flex';
    trailerBtn.onclick = () => window.open(scene.metadata.trailer, '_blank');
  } else {
    trailerBtn.style.display = 'none';
  }

  const rescanBtn = document.getElementById('modal-btn-rescan');
  rescanBtn.disabled = false;
  rescanBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Re-scan Scene`;
  rescanBtn.onclick = async () => {
    rescanBtn.disabled = true;
    rescanBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Re-scanning...`;
    
    try {
      const res = await fetch('/api/scenes/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clean_key: scene.clean_key })
      });
      
      if (!res.ok) {
        throw new Error("Failed to re-scan scene");
      }
      
      const updatedScene = await res.json();
      
      // Update global scenes array
      const idx = scenes.findIndex(s => s.clean_key === scene.clean_key);
      if (idx !== -1) {
        scenes[idx] = updatedScene;
      }
      
      // Re-apply filters and render grid
      applyFilters();
      
      // Update the current open modal with new data!
      openModal(updatedScene);
    } catch (err) {
      alert("Error re-scanning scene: " + err.message);
      rescanBtn.disabled = false;
      rescanBtn.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Re-scan Scene`;
    }
  };

  // Render Performers
  const performersList = document.getElementById('modal-performers');
  performersList.innerHTML = '';
  if (scene.metadata.performers && scene.metadata.performers.length > 0) {
    scene.metadata.performers.forEach(p => {
      const pCard = document.createElement('div');
      pCard.className = 'performer-avatar-card';
      pCard.onclick = () => {
        closeModal();
        document.getElementById('search-input').value = p.name;
        applyFilters();
      };
      
      const avatarSrc = p.image || p.thumbnail || `https://placehold.co/100x100/17181c/dba506?text=${p.name[0]}`;
      
      pCard.innerHTML = `
        <div class="performer-img-wrapper">
          <img src="${avatarSrc}" alt="${p.name}" onerror="this.src='https://placehold.co/100x100/17181c/dba506?text=${p.name[0]}'">
        </div>
        <span class="performer-name">${p.name}</span>
      `;
      performersList.appendChild(pCard);
    });
  } else {
    performersList.innerHTML = '<p style="color: var(--text-dark); font-size: 0.9rem;">No performers listed.</p>';
  }

  // Render Screenshots Gallery
  const screenshotsBox = document.getElementById('modal-screenshots-box');
  const screenshotsList = document.getElementById('modal-screenshots');
  screenshotsList.innerHTML = '';
  
  if (scene.metadata.screenshots && scene.metadata.screenshots.length > 0) {
    scene.metadata.screenshots.forEach(src => {
      const wrapper = document.createElement('div');
      wrapper.className = 'screenshot-img-wrapper';
      wrapper.onclick = () => openLightbox(src);
      wrapper.innerHTML = `<img src="${src}" alt="Screenshot" loading="lazy" onerror="this.parentElement.style.display='none'">`;
      screenshotsList.appendChild(wrapper);
    });
    screenshotsBox.style.display = 'block';
  } else {
    screenshotsBox.style.display = 'none';
  }

  // Render Files
  document.getElementById('modal-files-count').textContent = scene.files.length;
  const filesList = document.getElementById('modal-files-list');
  filesList.innerHTML = '';
  scene.files.forEach(f => {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <span><i class="fa-solid fa-file-video"></i> ${f}</span>
    `;
    filesList.appendChild(fileItem);
  });

  // Render Tags
  const tagsList = document.getElementById('modal-tags');
  tagsList.innerHTML = '';
  if (scene.metadata.tags && scene.metadata.tags.length > 0) {
    scene.metadata.tags.forEach(t => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = t;
      pill.onclick = () => {
        closeModal();
        document.getElementById('filter-tag').value = t;
        applyFilters();
      };
      tagsList.appendChild(pill);
    });
  } else {
    tagsList.innerHTML = '<span style="color: var(--text-dark); font-size: 0.9rem;">No tags listed.</span>';
  }

  // Open modal
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Load Dashboard & Metrics
async function loadDashboardStats() {
  try {
    const res = await fetch('/api/stats');
    stats = await res.json();

    // Fill counters
    document.getElementById('stat-total-scenes').textContent = stats.totalScenes;
    document.getElementById('stat-total-files').textContent = stats.totalFiles;
    document.getElementById('stat-total-studios').textContent = stats.uniqueSites;
    document.getElementById('stat-total-performers').textContent = stats.uniquePerformers;
    
    document.getElementById('stat-matched-count').textContent = stats.matchedCount;
    const localCount = stats.totalScenes - stats.matchedCount;
    document.getElementById('stat-local-count').textContent = localCount;

    // Calculate Match Percent
    const matchPercent = stats.totalScenes > 0 ? Math.round((stats.matchedCount / stats.totalScenes) * 100) : 0;
    document.getElementById('stat-match-percent').textContent = `${matchPercent}%`;

    // SVG Circle offset animation
    const circle = document.getElementById('stat-match-circle');
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (matchPercent / 100) * circumference;
    circle.style.strokeDashoffset = offset;

    // Populate Studio Bar Chart
    calculateStudioChart();
  } catch (err) {
    console.error("Failed to load dashboard stats:", err);
  }
}

function calculateStudioChart() {
  const chartContainer = document.getElementById('bar-chart-studios');
  chartContainer.innerHTML = '';
  
  // Count frequency of studios
  const studioCounts = {};
  scenes.forEach(s => {
    const sName = s.metadata.site?.name || 'Unknown Studio';
    studioCounts[sName] = (studioCounts[sName] || 0) + 1;
  });

  // Sort and pick top 5
  const sortedStudios = Object.entries(studioCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const maxVal = sortedStudios.length > 0 ? sortedStudios[0][1] : 0;

  sortedStudios.forEach(([name, val]) => {
    const pct = maxVal > 0 ? Math.round((val / maxVal) * 100) : 0;
    const barRow = document.createElement('div');
    barRow.className = 'chart-bar-row';
    barRow.innerHTML = `
      <div class="chart-bar-labels">
        <span class="chart-bar-name">${name}</span>
        <span class="chart-bar-value">${val} scenes</span>
      </div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill" style="width: ${pct}%"></div>
      </div>
    `;
    chartContainer.appendChild(barRow);
  });
}

// Sync Scrape logic
const btnStartSync = document.getElementById('btn-start-sync');
const pathInput = document.getElementById('sync-file-path');
const progressArea = document.getElementById('scan-progress-area');
const progressBar = document.getElementById('progress-bar-fill');
const progressTitle = document.getElementById('progress-status-title');
const progressRatio = document.getElementById('progress-status-ratio');
const progressScene = document.getElementById('progress-current-scene');

let eventSource = null;

btnStartSync.addEventListener('click', async () => {
  const filepath = pathInput.value.trim();
  const force = document.getElementById('sync-force-recheck').checked;
  if (!filepath) {
    alert("Please enter a valid text file path.");
    return;
  }

  btnStartSync.disabled = true;
  progressArea.style.display = 'block';
  
  // Reset progress bar
  progressBar.style.width = '0%';
  progressTitle.textContent = "Scanning text log...";
  progressRatio.textContent = "Initializing...";
  progressScene.textContent = "Connecting to progress stream...";
  
  // Show global indicator
  const topIndicator = document.getElementById('scan-status-indicator');
  topIndicator.style.display = 'flex';
  
  // Start EventSource first
  eventSource = new EventSource('/api/scan-progress');
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.status === 'scanning') {
      progressTitle.textContent = "Analyzing list file...";
      progressScene.textContent = data.scene;
    } else if (data.status === 'fetching') {
      progressTitle.textContent = "Scraping scene metadata...";
      progressRatio.textContent = `${data.current}/${data.total} (${Math.round((data.current / data.total) * 100)}%)`;
      progressBar.style.width = `${(data.current / data.total) * 100}%`;
      progressScene.textContent = `Scene: ${data.scene}`;
      document.getElementById('scan-status-text').textContent = `Scraping: ${data.current}/${data.total}`;
    } else if (data.status === 'complete') {
      progressTitle.textContent = "Scan complete!";
      progressRatio.textContent = "100%";
      progressBar.style.width = '100%';
      progressScene.textContent = "All scenes updated and cached successfully.";
      document.getElementById('scan-status-text').textContent = "Scan complete";
      
      setTimeout(() => {
        topIndicator.style.display = 'none';
      }, 3000);
      
      eventSource.close();
      btnStartSync.disabled = false;
      
      // Reload library data
      loadData();
    } else if (data.status === 'error') {
      progressTitle.textContent = "Error during scan";
      progressScene.textContent = data.error;
      eventSource.close();
      btnStartSync.disabled = false;
      topIndicator.style.display = 'none';
    }
  };

  try {
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filepath, force: force })
    });
    
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to trigger scan");
    }
  } catch (err) {
    progressTitle.textContent = "Connection Error";
    progressScene.textContent = err.message;
    btnStartSync.disabled = false;
    topIndicator.style.display = 'none';
    if (eventSource) eventSource.close();
  }
});

// Load everything on startup
window.onload = loadData;
