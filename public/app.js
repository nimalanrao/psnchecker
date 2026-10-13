/**
 * PlayStation® Network — Library & PS Plus Checker
 * Clean Minimal OLED Architecture
 * Strictly zero emojis.
 */

// Application State
const state = {
  library: null,
  currentToken: 'DydcDcBSYkHWCcXrRl7b3FB4SdRUX7rttokwz3rZ9FTXRn0lOWHeD3lKx9OekO2m',
  activeGameDetail: null,
  activeOledTab: 'ps4-owned',
  oledSearchQuery: ''
};

// DOM Cache
const dom = {
  // App Container
  minimalOledApp: document.getElementById('minimalOledApp'),

  // Header & Profile Preview
  oledTopRight: document.getElementById('oledTopRight'),
  oledAccountPreview: document.getElementById('oledAccountPreview'),
  oledAccountOnlineId: document.getElementById('oledAccountOnlineId'),
  oledAccountTierBadge: document.getElementById('oledAccountTierBadge'),
  btnOledLogout: document.getElementById('btnOledLogout'),

  // Token Control Section
  oledControlSection: document.getElementById('oledControlSection'),
  oledTokenInput: document.getElementById('oledTokenInput'),
  btnOledTogglePass: document.getElementById('btnOledTogglePass'),
  btnOledFetch: document.getElementById('btnOledFetch'),
  btnOledHowToReceive: document.getElementById('btnOledHowToReceive'),
  oledTutorialDrawer: document.getElementById('oledTutorialDrawer'),

  // Logs Accordion
  btnOledToggleLogs: document.getElementById('btnOledToggleLogs'),
  oledLogsDrawer: document.getElementById('oledLogsDrawer'),
  oledLogsStatusBadge: document.getElementById('oledLogsStatusBadge'),
  oledLogsEtaText: document.getElementById('oledLogsEtaText'),
  oledProgressBar: document.getElementById('oledProgressBar'),
  oledLogsStream: document.getElementById('oledLogsStream'),

  // Games & Tabs Section
  oledGamesSection: document.getElementById('oledGamesSection'),
  oledTabsNav: document.getElementById('oledTabsNav'),
  oledSearchContainer: document.getElementById('oledSearchContainer'),
  oledGameSearch: document.getElementById('oledGameSearch'),
  paneOledPsPlus: document.getElementById('paneOledPsPlus'),
  paneOledPs4Owned: document.getElementById('paneOledPs4Owned'),
  paneOledPs5Owned: document.getElementById('paneOledPs5Owned'),
  paneOledPs4Plus: document.getElementById('paneOledPs4Plus'),
  paneOledPs5Plus: document.getElementById('paneOledPs5Plus'),
  tabOledPsPlus: document.getElementById('tabOledPsPlus'),
  tabOledPs4Owned: document.getElementById('tabOledPs4Owned'),
  tabOledPs5Owned: document.getElementById('tabOledPs5Owned'),
  tabOledPs4Plus: document.getElementById('tabOledPs4Plus'),
  tabOledPs5Plus: document.getElementById('tabOledPs5Plus'),
  oledFooter: document.querySelector('.oled-footer'),

  // Tab Content & Counts
  oledPsPlusTier: document.getElementById('oledPsPlusTier'),
  oledPsPlusStatus: document.getElementById('oledPsPlusStatus'),
  oledPsPlusCount: document.getElementById('oledPsPlusCount'),
  oledPsPlusAccount: document.getElementById('oledPsPlusAccount'),
  oledPsPlusPerks: document.getElementById('oledPsPlusPerks'),
  oledPsPlusStatusTag: document.getElementById('oledPsPlusStatusTag'),
  oledCountPs4Owned: document.getElementById('oledCountPs4Owned'),
  oledCountPs5Owned: document.getElementById('oledCountPs5Owned'),
  oledCountPs4Plus: document.getElementById('oledCountPs4Plus'),
  oledCountPs5Plus: document.getElementById('oledCountPs5Plus'),
  listPs4Owned: document.getElementById('listPs4Owned'),
  listPs5Owned: document.getElementById('listPs5Owned'),
  listPs4Plus: document.getElementById('listPs4Plus'),
  listPs5Plus: document.getElementById('listPs5Plus'),

  // Game Detail Modal Inspector
  gameDetailModal: document.getElementById('gameDetailModal'),
  btnModalClose: document.getElementById('btnModalClose'),
  modalCoverImg: document.getElementById('modalCoverImg'),
  modalPlatformBadge: document.getElementById('modalPlatformBadge'),
  modalLicenseBadge: document.getElementById('modalLicenseBadge'),
  modalGameTitle: document.getElementById('modalGameTitle'),
  modalTitleId: document.getElementById('modalTitleId'),
  modalEntitlementId: document.getElementById('modalEntitlementId'),
  modalPlaytime: document.getElementById('modalPlaytime'),
  modalPlayCount: document.getElementById('modalPlayCount'),
  modalLastPlayed: document.getElementById('modalLastPlayed'),
  modalDownloadable: document.getElementById('modalDownloadable'),
  modalStoreLink: document.getElementById('modalStoreLink'),
  btnCopyDetails: document.getElementById('btnCopyDetails'),

  // Copy Simple List Modal
  btnOpenCopySimple: document.getElementById('btnOpenCopySimple'),
  copySimpleModal: document.getElementById('copySimpleModal'),
  btnCopyModalClose: document.getElementById('btnCopyModalClose'),
  btnCopyWithPlus: document.getElementById('btnCopyWithPlus'),
  btnCopyWithoutPlus: document.getElementById('btnCopyWithoutPlus'),
  copyWithPlusMeta: document.getElementById('copyWithPlusMeta'),
  copyWithoutPlusMeta: document.getElementById('copyWithoutPlusMeta'),

  // Toast
  toast: document.getElementById('toastNotification')
};

// SVG Placeholder generator for missing cover artwork (Clean, 0 emojis)
function getArtworkFallback(title, platform) {
  const initials = (title || 'PS')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] || '')
    .join('')
    .toUpperCase() || 'PS';
  const bgColor = '#111111';

  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="${encodeURIComponent(bgColor)}"/><text x="150" y="145" font-family="'Google Sans', sans-serif" font-size="34" font-weight="700" fill="white" text-anchor="middle">${encodeURIComponent(initials)}</text><text x="150" y="210" font-family="'Google Sans', sans-serif" font-size="16" font-weight="700" fill="rgba(255,255,255,0.7)" text-anchor="middle">${encodeURIComponent(platform)}</text></svg>`;
}

// Toast Notification
function showToast(msg) {
  if (!dom.toast) return;
  dom.toast.textContent = msg;
  dom.toast.classList.remove('hidden');
  setTimeout(() => {
    dom.toast.classList.add('hidden');
  }, 3200);
}

// Escape HTML utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Filter helper for subsearches
function filterGames(list, query) {
  if (!query || !query.trim()) return list;
  const q = query.toLowerCase().trim();
  return list.filter(g => 
    (g.name && g.name.toLowerCase().includes(q)) ||
    (g.titleId && g.titleId.toLowerCase().includes(q)) ||
    (g.entitlementId && g.entitlementId.toLowerCase().includes(q))
  );
}

// Logged-in / Logged-out State Handlers
function setOledLoggedInState() {
  localStorage.setItem('psn_session_active', 'true');
  if (dom.minimalOledApp) dom.minimalOledApp.classList.remove('is-centered');
  if (dom.oledControlSection) dom.oledControlSection.classList.add('hidden');
  if (dom.oledGamesSection) dom.oledGamesSection.classList.remove('hidden');
  if (dom.oledTopRight) dom.oledTopRight.classList.remove('hidden');
  if (dom.oledAccountPreview) dom.oledAccountPreview.classList.remove('hidden');
  if (dom.btnOledLogout) dom.btnOledLogout.classList.remove('hidden');
  if (dom.oledFooter) dom.oledFooter.classList.remove('hidden');
}

function setOledLoggedOutState() {
  localStorage.removeItem('psn_session_active');
  if (dom.minimalOledApp) dom.minimalOledApp.classList.add('is-centered');

  // Show Token Entering section
  if (dom.oledControlSection) dom.oledControlSection.classList.remove('hidden');

  // Hide Games section, Account preview, Logout button & Footer
  if (dom.oledGamesSection) dom.oledGamesSection.classList.add('hidden');
  if (dom.oledTopRight) dom.oledTopRight.classList.add('hidden');
  if (dom.oledAccountPreview) dom.oledAccountPreview.classList.add('hidden');
  if (dom.btnOledLogout) dom.btnOledLogout.classList.add('hidden');
  if (dom.oledFooter) dom.oledFooter.classList.add('hidden');

  // Clear token input
  if (dom.oledTokenInput) dom.oledTokenInput.value = '';

  // Collapse drawers smoothly
  if (dom.oledTutorialDrawer) dom.oledTutorialDrawer.classList.remove('open');
  if (dom.btnOledHowToReceive) {
    dom.btnOledHowToReceive.querySelector('.oled-chevron')?.classList.remove('open');
    dom.btnOledHowToReceive.setAttribute('aria-expanded', 'false');
  }
  if (dom.oledLogsDrawer) dom.oledLogsDrawer.classList.remove('open');
  if (dom.btnOledToggleLogs) {
    dom.btnOledToggleLogs.querySelector('.oled-chevron')?.classList.remove('open');
    dom.btnOledToggleLogs.setAttribute('aria-expanded', 'false');
  }

  // Reset progress and log badges
  if (dom.oledProgressBar) {
    dom.oledProgressBar.className = 'oled-progress-bar';
    dom.oledProgressBar.style.width = '0%';
  }
  if (dom.oledLogsStatusBadge) {
    dom.oledLogsStatusBadge.className = 'oled-mini-badge';
    dom.oledLogsStatusBadge.textContent = 'READY';
  }
  if (dom.oledLogsEtaText) dom.oledLogsEtaText.textContent = '';
  if (dom.oledLogsStream) {
    dom.oledLogsStream.innerHTML = '<div class="log-line">[SYSTEM] Ready. Connect token or view synced library below.</div>';
  }
}

function handleLogout() {
  // Animate panel blurring and fading away
  if (dom.oledGamesSection && !dom.oledGamesSection.classList.contains('hidden')) {
    dom.oledGamesSection.classList.remove('blur-fade-in');
    dom.oledGamesSection.classList.add('blur-fade-out');
  }
  if (dom.oledTopRight && !dom.oledTopRight.classList.contains('hidden')) {
    dom.oledTopRight.classList.remove('blur-fade-in');
    dom.oledTopRight.classList.add('blur-fade-out');
  }

  setTimeout(() => {
    setOledLoggedOutState();
    if (dom.oledGamesSection) dom.oledGamesSection.classList.remove('blur-fade-out');
    if (dom.oledTopRight) dom.oledTopRight.classList.remove('blur-fade-out');

    // Reveal token entering card with smooth blur-fade-in
    if (dom.oledControlSection) {
      dom.oledControlSection.classList.remove('hidden');
      dom.oledControlSection.classList.remove('blur-fade-out');
      dom.oledControlSection.classList.add('blur-fade-in');
    }

    showToast('Logged out. Returned to token entry.');
  }, 350);
}

// Minimal OLED Tabs & Games Rendering
function switchOledTab(targetTab) {
  state.activeOledTab = targetTab;

  // 1. Update Tab buttons
  document.querySelectorAll('.oled-tab-btn').forEach(btn => {
    if (btn.dataset.oledTab === targetTab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 2. Hide all tab panes
  if (dom.paneOledPsPlus) dom.paneOledPsPlus.classList.add('hidden');
  if (dom.paneOledPs4Owned) dom.paneOledPs4Owned.classList.add('hidden');
  if (dom.paneOledPs5Owned) dom.paneOledPs5Owned.classList.add('hidden');
  if (dom.paneOledPs4Plus) dom.paneOledPs4Plus.classList.add('hidden');
  if (dom.paneOledPs5Plus) dom.paneOledPs5Plus.classList.add('hidden');

  // 3. Show targeted pane & configure search
  if (targetTab === 'psplus') {
    if (dom.paneOledPsPlus) dom.paneOledPsPlus.classList.remove('hidden');
    if (dom.oledSearchContainer) dom.oledSearchContainer.style.display = 'none';
  } else if (targetTab === 'ps4-owned') {
    if (dom.paneOledPs4Owned) dom.paneOledPs4Owned.classList.remove('hidden');
    if (dom.oledSearchContainer) {
      dom.oledSearchContainer.style.display = 'block';
      if (dom.oledGameSearch) dom.oledGameSearch.placeholder = 'filter PS4 owned titles...';
    }
  } else if (targetTab === 'ps5-owned') {
    if (dom.paneOledPs5Owned) dom.paneOledPs5Owned.classList.remove('hidden');
    if (dom.oledSearchContainer) {
      dom.oledSearchContainer.style.display = 'block';
      if (dom.oledGameSearch) dom.oledGameSearch.placeholder = 'filter PS5 owned titles...';
    }
  } else if (targetTab === 'ps4-plus') {
    if (dom.paneOledPs4Plus) dom.paneOledPs4Plus.classList.remove('hidden');
    if (dom.oledSearchContainer) {
      dom.oledSearchContainer.style.display = 'block';
      if (dom.oledGameSearch) dom.oledGameSearch.placeholder = 'filter PS4 PS+ titles...';
    }
  } else if (targetTab === 'ps5-plus') {
    if (dom.paneOledPs5Plus) dom.paneOledPs5Plus.classList.remove('hidden');
    if (dom.oledSearchContainer) {
      dom.oledSearchContainer.style.display = 'block';
      if (dom.oledGameSearch) dom.oledGameSearch.placeholder = 'filter PS5 PS+ titles...';
    }
  }

  // 4. Render active tab's games with filter
  renderCurrentOledTabGames();
}

function renderCurrentOledTabGames() {
  if (!state.library) return;
  const { games } = state.library;
  const query = (dom.oledGameSearch?.value || state.oledSearchQuery || '').trim();

  const ownedPs4 = games.filter(g => !g.isPsPlus && g.platform === 'PS4');
  const ownedPs5 = games.filter(g => !g.isPsPlus && g.platform === 'PS5');
  const plusPs4 = games.filter(g => g.isPsPlus && g.platform === 'PS4');
  const plusPs5 = games.filter(g => g.isPsPlus && g.platform === 'PS5');

  if (state.activeOledTab === 'ps4-owned') {
    renderOledGameList(dom.listPs4Owned, filterGames(ownedPs4, query));
  } else if (state.activeOledTab === 'ps5-owned') {
    renderOledGameList(dom.listPs5Owned, filterGames(ownedPs5, query));
  } else if (state.activeOledTab === 'ps4-plus') {
    renderOledGameList(dom.listPs4Plus, filterGames(plusPs4, query));
  } else if (state.activeOledTab === 'ps5-plus') {
    renderOledGameList(dom.listPs5Plus, filterGames(plusPs5, query));
  }
}

function renderMinimalOled() {
  if (!state.library) return;
  const { account, summary, games } = state.library;

  // 1. Top Bar Preview
  if (dom.oledAccountOnlineId) {
    dom.oledAccountOnlineId.textContent = (account.onlineId || 'PLAYSTATION USER').toUpperCase();
  }
  if (dom.oledAccountTierBadge) {
    dom.oledAccountTierBadge.textContent = account.isPlusActive ? 'PS PLUS' : 'NO PLUS';
  }

  // 2. TAB PANE: PS+ Entitlements
  if (dom.oledPsPlusTier) {
    dom.oledPsPlusTier.textContent = account.isPlusActive ? 'PlayStation Plus' : 'No Active Membership';
  }
  if (dom.oledPsPlusStatus) {
    dom.oledPsPlusStatus.textContent = account.isPlusActive ? 'Active' : 'Inactive';
  }
  if (dom.oledPsPlusCount) {
    const plusCount = summary.psPlusEntitlements?.total || games.filter(g => g.isPsPlus).length;
    dom.oledPsPlusCount.textContent = `${plusCount} Titles`;
  }
  if (dom.oledPsPlusAccount) {
    dom.oledPsPlusAccount.textContent = account.onlineId || 'supposed-giant83';
  }
  if (dom.oledPsPlusPerks) {
    dom.oledPsPlusPerks.textContent = account.psPlusDescription || 'Monthly Games, Online Multiplayer, Exclusive Discounts & Cloud Storage';
  }
  if (dom.oledPsPlusStatusTag) {
    dom.oledPsPlusStatusTag.textContent = account.isPlusActive ? 'ACTIVE' : 'INACTIVE';
  }

  // 3. Tab Badge Counts
  const ownedPs4 = games.filter(g => !g.isPsPlus && g.platform === 'PS4');
  const ownedPs5 = games.filter(g => !g.isPsPlus && g.platform === 'PS5');
  const plusPs4 = games.filter(g => g.isPsPlus && g.platform === 'PS4');
  const plusPs5 = games.filter(g => g.isPsPlus && g.platform === 'PS5');

  if (dom.oledCountPs4Owned) dom.oledCountPs4Owned.textContent = ownedPs4.length;
  if (dom.oledCountPs5Owned) dom.oledCountPs5Owned.textContent = ownedPs5.length;
  if (dom.oledCountPs4Plus) dom.oledCountPs4Plus.textContent = plusPs4.length;
  if (dom.oledCountPs5Plus) dom.oledCountPs5Plus.textContent = plusPs5.length;

  // 4. Render all game lists
  renderOledGameList(dom.listPs4Owned, ownedPs4);
  renderOledGameList(dom.listPs5Owned, ownedPs5);
  renderOledGameList(dom.listPs4Plus, plusPs4);
  renderOledGameList(dom.listPs5Plus, plusPs5);

  // Switch to currently active tab
  switchOledTab(state.activeOledTab);
}

function renderOledGameList(container, gamesList) {
  if (!container) return;
  if (gamesList.length === 0) {
    container.innerHTML = '<div class="oled-empty-msg font-mono" style="padding: 12px; color: #555555; font-size: 0.78rem;">No matching titles found.</div>';
    return;
  }

  container.innerHTML = gamesList.map(g => {
    const fallback = getArtworkFallback(g.name, g.platform);
    const coverUrl = g.imageUrl || fallback;
    const playtimeStr = g.playtime ? `<span class="oled-game-playtime">${escapeHtml(g.playtime)}</span>` : '';

    return `
      <div class="oled-game-item" onclick="window.inspectGame('${escapeHtml(g.titleId)}')">
        <img 
          src="${escapeHtml(coverUrl)}" 
          alt="${escapeHtml(g.name)}" 
          class="oled-game-icon"
          loading="lazy"
          onerror="this.onerror=null; this.src='${escapeHtml(fallback)}';"
        >
        <div class="oled-game-main">
          <div class="oled-game-name" title="${escapeHtml(g.name)}">${escapeHtml(g.name)}</div>
          <div class="oled-game-sub font-mono">${escapeHtml(g.titleId || g.platform)} &bull; ${escapeHtml(g.platform)}</div>
        </div>
        ${playtimeStr}
      </div>
    `;
  }).join('');
}

// Modal Closers — animated dismiss
function closeModalAnimated(modalEl) {
  if (!modalEl || modalEl.classList.contains('hidden')) return;
  modalEl.classList.add('is-closing');
  setTimeout(() => {
    modalEl.classList.remove('is-closing');
    modalEl.classList.add('hidden');
  }, 240);
}

// Game Modal Inspector
window.inspectGame = function(titleId) {
  const game = state.library?.games?.find(g => g.titleId === titleId);
  if (!game) return;

  state.activeGameDetail = game;

  const fallbackUrl = getArtworkFallback(game.name, game.platform);
  dom.modalCoverImg.src = game.imageUrl || fallbackUrl;
  dom.modalCoverImg.onerror = () => { dom.modalCoverImg.src = fallbackUrl; };

  dom.modalGameTitle.textContent = game.name;
  dom.modalPlatformBadge.textContent = game.platform;
  dom.modalPlatformBadge.className = `ps-platform-tag ${game.platform === 'PS5' ? 'tag-ps5' : 'tag-ps4'}`;

  dom.modalLicenseBadge.textContent = game.isPsPlus ? '✦ PLAYSTATION PLUS CLAIM' : '✓ OWNED DIGITAL PURCHASE';
  dom.modalLicenseBadge.className = `ps-license-tag ${game.isPsPlus ? 'license-plus' : 'license-owned'}`;

  dom.modalTitleId.textContent = game.titleId || 'N/A';
  dom.modalEntitlementId.textContent = game.entitlementId || 'N/A';
  dom.modalPlaytime.textContent = game.playtime ? `${game.playtime} (${game.playCount || 1} sessions)` : 'Not recorded / Unplayed';
  dom.modalPlayCount.textContent = game.playCount ? `${game.playCount} launches` : '—';
  dom.modalLastPlayed.textContent = game.lastPlayed || 'Never / Not synced';
  dom.modalDownloadable.textContent = game.isDownloadable ? 'Active Digital Entitlement' : 'Inactive';

  if (game.productId) {
    dom.modalStoreLink.href = `https://store.playstation.com/en-us/product/${encodeURIComponent(game.productId)}`;
    dom.modalStoreLink.style.display = 'inline-flex';
  } else {
    dom.modalStoreLink.href = `https://store.playstation.com/en-us/search/${encodeURIComponent(game.name)}`;
    dom.modalStoreLink.style.display = 'inline-flex';
  }

  dom.gameDetailModal.classList.remove('hidden');
};

// Copy Simple List Generator (for Telegram / Messaging)
function generateSimpleList(withPlus = false) {
  if (!state.library?.games) return { text: '', count: 0 };
  const allGames = state.library.games;
  const filtered = withPlus ? allGames : allGames.filter(g => !g.isPsPlus);

  const seen = new Set();
  const lines = [];

  for (const g of filtered) {
    const title = (g.name || '').trim();
    if (!title) continue;
    const platform = (g.platform || 'PS4').trim().toUpperCase();
    const line = `${title} [${platform}]`;
    if (!seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  }

  // Sort alphabetically A-Z case-insensitively
  lines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  return {
    text: lines.join('\n'),
    count: lines.length
  };
}

async function copySimpleList(withPlus) {
  const { text, count } = generateSimpleList(withPlus);
  if (!count) {
    showToast('No matching games found in library.');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  const typeLabel = withPlus ? 'with PS+' : 'without PS+';
  showToast(`Copied ${count} games (${typeLabel}) to clipboard!`);
  closeModalAnimated(dom.copySimpleModal);
}

function openCopySimpleModal() {
  if (!state.library?.games || state.library.games.length === 0) {
    showToast('Please connect and fetch your library first.');
    return;
  }

  const withPlusCount = state.library.games.length;
  const withoutPlusCount = state.library.games.filter(g => !g.isPsPlus).length;
  const psPlusClaims = withPlusCount - withoutPlusCount;

  if (dom.copyWithPlusMeta) {
    dom.copyWithPlusMeta.textContent = `${withPlusCount} titles (includes ${psPlusClaims} PS+ claims)`;
  }
  if (dom.copyWithoutPlusMeta) {
    dom.copyWithoutPlusMeta.textContent = `${withoutPlusCount} owned purchases only`;
  }

  dom.copySimpleModal.classList.remove('hidden');
}

// Dedicated Error Logger
function logOledError(errorMessage, badgeLabel = 'ERROR') {
  // Ensure the OLED logs drawer is unfolded and accessible
  if (dom.oledLogsDrawer) dom.oledLogsDrawer.classList.add('open');
  if (dom.btnOledToggleLogs) {
    const chevron = dom.btnOledToggleLogs.querySelector('.oled-chevron');
    if (chevron) chevron.classList.add('open');
    dom.btnOledToggleLogs.setAttribute('aria-expanded', 'true');
  }

  // Set OLED Status Badge to ERROR (with red styling)
  if (dom.oledLogsStatusBadge) {
    dom.oledLogsStatusBadge.textContent = badgeLabel.toUpperCase();
    dom.oledLogsStatusBadge.className = 'oled-mini-badge badge-error';
  }
  if (dom.oledLogsEtaText) {
    dom.oledLogsEtaText.textContent = badgeLabel.toLowerCase();
    dom.oledLogsEtaText.style.color = '#ef4444';
  }

  // Set progress bar to red error state
  if (dom.oledProgressBar) {
    dom.oledProgressBar.className = 'oled-progress-bar bar-error';
    dom.oledProgressBar.style.width = '100%';
  }

  // Append clear red error line into OLED log stream
  if (dom.oledLogsStream) {
    const errLine = document.createElement('div');
    errLine.className = 'log-line text-red';
    errLine.style.color = '#ef4444';
    errLine.style.fontWeight = '600';
    errLine.textContent = `[ERROR] ${errorMessage}`;
    dom.oledLogsStream.appendChild(errLine);
    dom.oledLogsStream.scrollTop = dom.oledLogsStream.scrollHeight;
  }

  // Trigger error shake animation on token input
  if (dom.oledTokenInput) {
    dom.oledTokenInput.classList.remove('input-error');
    void dom.oledTokenInput.offsetWidth; // trigger reflow
    dom.oledTokenInput.classList.add('input-error');
    dom.oledTokenInput.focus();
  }

  // Toast feedback
  showToast(errorMessage);
}

// Streaming Sync Pipeline
async function runStreamingSync(rawToken) {
  // 1. Clean and normalize token (extract if pasted as JSON {"npsso": "..."})
  let token = (rawToken || '').trim().replace(/^["']|["']$/g, '').trim();
  if (token.startsWith('{') && token.includes('npsso')) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.npsso) token = parsed.npsso.trim();
    } catch {
      const match = token.match(/"npsso"\s*:\s*"([^"]+)"/);
      if (match) token = match[1].trim();
    }
  }

  // RULE 1: If empty -> report error immediately
  if (!token) {
    logOledError('Token is empty! Please paste your 64-character PlayStation NPSSO token.', 'token empty');
    return;
  }

  // RULE 2: If less than 64 characters -> wrong token
  if (token.length < 64) {
    logOledError(`Wrong token: NPSSO token must be 64 characters (entered ${token.length}).`, 'wrong token');
    return;
  }

  state.currentToken = token;

  // Reset progress and badges to active state
  if (dom.oledLogsStatusBadge) {
    dom.oledLogsStatusBadge.className = 'oled-mini-badge';
    dom.oledLogsStatusBadge.textContent = 'CONNECTING';
  }
  if (dom.oledLogsEtaText) {
    dom.oledLogsEtaText.style.color = '';
    dom.oledLogsEtaText.textContent = 'starting...';
  }
  if (dom.oledProgressBar) {
    dom.oledProgressBar.className = 'oled-progress-bar';
    dom.oledProgressBar.style.width = '6%';
  }
  if (dom.oledTokenInput) {
    dom.oledTokenInput.classList.remove('input-error');
  }

  // Minimal OLED Logs Box: automatically unfold drawer
  if (dom.oledLogsDrawer) dom.oledLogsDrawer.classList.add('open');
  if (dom.btnOledToggleLogs) {
    const chevron = dom.btnOledToggleLogs.querySelector('.oled-chevron');
    if (chevron) chevron.classList.add('open');
    dom.btnOledToggleLogs.setAttribute('aria-expanded', 'true');
  }
  if (dom.oledLogsStream) {
    dom.oledLogsStream.innerHTML = `<div class="log-line">[INITIALIZE] Connecting with NPSSO token...</div>`;
  }

  // Check if browser is offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    logOledError('No connection: You appear to be offline. Please check your internet connection.', 'no connection');
    return;
  }

  // RULE 3: If no connection for more than 3 seconds -> report error
  const abortController = new AbortController();
  let connectionTimeout = setTimeout(() => {
    abortController.abort(new Error('No connection: Connection timed out after 3 seconds.'));
  }, 3000);

  try {
    const response = await fetch('/api/fetch-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npsso: state.currentToken }),
      signal: abortController.signal
    });

    if (!response.ok) {
      clearTimeout(connectionTimeout);
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || `Server responded with ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let firstChunkReceived = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Clear the 3-second connection timer once connected & stream data arrives
      if (!firstChunkReceived) {
        firstChunkReceived = true;
        clearTimeout(connectionTimeout);
      }

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();

      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const rawJson = part.replace('data: ', '').trim();
        if (!rawJson) continue;

        let data;
        try {
          data = JSON.parse(rawJson);
        } catch (pe) {
          console.error('Failed to parse SSE payload:', pe);
          continue;
        }

        // CRITICAL: If server sent an error, throw it so outer catch handles it!
        if (data.error) {
          throw new Error(data.error);
        }

        // Update Minimal OLED Progress & Logs
        if (dom.oledProgressBar && data.percent !== undefined) {
          dom.oledProgressBar.style.width = `${data.percent}%`;
        }
        if (dom.oledLogsStatusBadge) {
          dom.oledLogsStatusBadge.textContent = `${data.percent || 0}%`;
        }
        if (dom.oledLogsEtaText && data.etaText) {
          dom.oledLogsEtaText.textContent = data.etaText;
        }
        if (dom.oledLogsStream && data.message) {
          const line = document.createElement('div');
          line.className = 'log-line';
          line.textContent = `[STEP ${data.step || 1}] ${data.message} ${data.etaText ? '(' + data.etaText + ')' : ''}`;
          dom.oledLogsStream.appendChild(line);
          dom.oledLogsStream.scrollTop = dom.oledLogsStream.scrollHeight;
        }

        if (data.completed && data.data) {
          state.library = data.data;
          showToast('PlayStation Library synced successfully!');

          if (dom.oledLogsStatusBadge) {
            dom.oledLogsStatusBadge.textContent = 'SYNCED';
            dom.oledLogsStatusBadge.className = 'oled-mini-badge badge-success';
          }
          if (dom.oledLogsEtaText) {
            dom.oledLogsEtaText.textContent = 'complete';
            dom.oledLogsEtaText.style.color = '#22c55e';
          }
          if (dom.oledProgressBar) {
            dom.oledProgressBar.className = 'oled-progress-bar';
            dom.oledProgressBar.style.width = '100%';
          }
          
          // Once all done, blur and fade away the token cards, then go to the panel!
          if (dom.oledControlSection && !dom.oledControlSection.classList.contains('hidden')) {
            dom.oledControlSection.classList.remove('blur-fade-in');
            dom.oledControlSection.classList.add('blur-fade-out');

            setTimeout(() => {
              dom.oledControlSection.classList.add('hidden');
              dom.oledControlSection.classList.remove('blur-fade-out');

              setOledLoggedInState();
              renderMinimalOled();

              if (dom.oledGamesSection) {
                dom.oledGamesSection.classList.remove('hidden');
                dom.oledGamesSection.classList.add('blur-fade-in');
              }
              if (dom.oledTopRight) {
                dom.oledTopRight.classList.remove('hidden');
                dom.oledTopRight.classList.add('blur-fade-in');
              }
            }, 380);
          } else {
            setOledLoggedInState();
            renderMinimalOled();
          }
        }
      }
    }
  } catch (err) {
    clearTimeout(connectionTimeout);
    let raw = err.message || String(err);
    let errMsg = raw;
    let badgeType = 'ERROR';

    const lower = raw.toLowerCase();
    if (
      abortController.signal.aborted ||
      err.name === 'AbortError' ||
      !navigator.onLine ||
      lower.includes('3 seconds') ||
      lower.includes('timed out') ||
      lower.includes('failed to fetch') ||
      lower.includes('networkerror') ||
      lower.includes('enotfound') ||
      lower.includes('econnrefused') ||
      lower.includes('no connection')
    ) {
      errMsg = 'No connection: Connection timed out after 3 seconds or offline.';
      badgeType = 'no connection';
    } else if (lower.includes('empty')) {
      errMsg = 'Token is empty! Please paste your 64-character PlayStation NPSSO token.';
      badgeType = 'token empty';
    } else if (lower.includes('64') || lower.includes('wrong') || lower.includes('expired') || lower.includes('unauthorized') || lower.includes('oauth') || lower.includes('400') || lower.includes('401') || lower.includes('403') || lower.includes('invalid') || lower.includes('rejected')) {
      errMsg = 'Wrong token: Authorization was rejected by Sony PlayStation. Please check your token and try again.';
      badgeType = 'wrong token';
    }

    logOledError(errMsg, badgeType);
  }
}

// Fetch cached library data
async function fetchCachedLibrary() {
  try {
    const res = await fetch('/api/library');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Event Listeners
function bindEventListeners() {
  // Minimal OLED: How to receive dropdown drawer
  if (dom.btnOledHowToReceive && dom.oledTutorialDrawer) {
    dom.btnOledHowToReceive.addEventListener('click', () => {
      const isOpen = dom.oledTutorialDrawer.classList.toggle('open');
      const chevron = dom.btnOledHowToReceive.querySelector('.oled-chevron');
      if (chevron) chevron.classList.toggle('open', isOpen);
      dom.btnOledHowToReceive.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Minimal OLED: Logs drawer toggle
  if (dom.btnOledToggleLogs && dom.oledLogsDrawer) {
    dom.btnOledToggleLogs.addEventListener('click', () => {
      const isOpen = dom.oledLogsDrawer.classList.toggle('open');
      const chevron = dom.btnOledToggleLogs.querySelector('.oled-chevron');
      if (chevron) chevron.classList.toggle('open', isOpen);
      dom.btnOledToggleLogs.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // Minimal OLED: Logout button (Top Right)
  if (dom.btnOledLogout) {
    dom.btnOledLogout.addEventListener('click', handleLogout);
  }

  // Minimal OLED: Tabs navigation
  if (dom.oledTabsNav) {
    dom.oledTabsNav.addEventListener('click', e => {
      const btn = e.target.closest('.oled-tab-btn');
      if (!btn) return;
      const tabKey = btn.dataset.oledTab;
      if (tabKey) switchOledTab(tabKey);
    });
  }

  // Minimal OLED: Real-time search filter for active tab
  if (dom.oledGameSearch) {
    dom.oledGameSearch.addEventListener('input', e => {
      state.oledSearchQuery = e.target.value;
      renderCurrentOledTabGames();
    });
  }

  // Minimal OLED: Password Visibility Toggle
  if (dom.btnOledTogglePass && dom.oledTokenInput) {
    dom.btnOledTogglePass.addEventListener('click', () => {
      const isPass = dom.oledTokenInput.type === 'password';
      dom.oledTokenInput.type = isPass ? 'text' : 'password';
    });
  }

  // Minimal OLED: Fetch Button
  if (dom.btnOledFetch && dom.oledTokenInput) {
    dom.btnOledFetch.addEventListener('click', () => {
      const raw = dom.oledTokenInput.value.trim();
      if (!raw) {
        logOledError('Token is empty! Please paste your 64-character PlayStation NPSSO token.', 'token empty');
        return;
      }
      if (raw.length < 64) {
        logOledError(`Wrong token: NPSSO token must be 64 characters (entered ${raw.length}).`, 'wrong token');
        return;
      }
      runStreamingSync(raw);
    });
  }

  // Minimal OLED: Token Input Enter key handler
  if (dom.oledTokenInput) {
    dom.oledTokenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const raw = dom.oledTokenInput.value.trim();
        if (!raw) {
          logOledError('Token is empty! Please paste your 64-character PlayStation NPSSO token.', 'token empty');
          return;
        }
        if (raw.length < 64) {
          logOledError(`Wrong token: NPSSO token must be 64 characters (entered ${raw.length}).`, 'wrong token');
          return;
        }
        runStreamingSync(raw);
      }
    });
  }

  // Modal Closers
  if (dom.btnModalClose && dom.gameDetailModal) {
    dom.btnModalClose.addEventListener('click', () => {
      closeModalAnimated(dom.gameDetailModal);
    });
  }

  if (dom.gameDetailModal) {
    dom.gameDetailModal.addEventListener('click', e => {
      if (e.target === dom.gameDetailModal) {
        closeModalAnimated(dom.gameDetailModal);
      }
    });
  }

  // Copy Simple List Modal Listeners
  if (dom.btnOpenCopySimple) {
    dom.btnOpenCopySimple.addEventListener('click', openCopySimpleModal);
  }

  if (dom.btnCopyModalClose && dom.copySimpleModal) {
    dom.btnCopyModalClose.addEventListener('click', () => {
      closeModalAnimated(dom.copySimpleModal);
    });
  }

  if (dom.copySimpleModal) {
    dom.copySimpleModal.addEventListener('click', e => {
      if (e.target === dom.copySimpleModal) {
        closeModalAnimated(dom.copySimpleModal);
      }
    });
  }

  if (dom.btnCopyWithPlus) {
    dom.btnCopyWithPlus.addEventListener('click', () => copySimpleList(true));
  }

  if (dom.btnCopyWithoutPlus) {
    dom.btnCopyWithoutPlus.addEventListener('click', () => copySimpleList(false));
  }

  // Copy Details Button
  if (dom.btnCopyDetails) {
    dom.btnCopyDetails.addEventListener('click', () => {
      if (!state.activeGameDetail) return;
      const g = state.activeGameDetail;
      const txt = `${g.name} [${g.platform}]\nTitle ID: ${g.titleId || 'N/A'}\nLicense: ${g.isPsPlus ? 'PlayStation Plus' : 'Owned Digital'}\nPlaytime: ${g.playtime || 'N/A'}`;
      navigator.clipboard.writeText(txt).then(() => {
        showToast('Game specs copied to clipboard!');
      });
    });
  }

  // Escape Key Closer
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (dom.gameDetailModal && !dom.gameDetailModal.classList.contains('hidden')) {
        closeModalAnimated(dom.gameDetailModal);
      }
      if (dom.copySimpleModal && !dom.copySimpleModal.classList.contains('hidden')) {
        closeModalAnimated(dom.copySimpleModal);
      }
    }
  });
}

// App Initialization
async function initApp() {
  bindEventListeners();

  // Fetch cached library data
  const cachedData = await fetchCachedLibrary();
  if (cachedData) {
    state.library = cachedData;
    renderMinimalOled();

    const hasVisited = localStorage.getItem('psn_session_active') === 'true';
    if (hasVisited) {
      setOledLoggedInState();
      if (dom.oledTokenInput) dom.oledTokenInput.value = state.currentToken;
    } else {
      setOledLoggedOutState();
    }
  } else {
    setOledLoggedOutState();
  }

  // Super clean website preloader dismiss
  const preloader = document.getElementById('sitePreloader');
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add('fade-out');
      setTimeout(() => {
        if (preloader.parentNode) preloader.remove();
      }, 550);
    }, 450);
  }
}

// Kickoff on DOM Ready
document.addEventListener('DOMContentLoaded', initApp);
