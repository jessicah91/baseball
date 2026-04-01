const TEAM_OPTIONS = [
  { value: 'LG', label: 'LG 트윈스' },
  { value: 'KIA', label: 'KIA 타이거즈' },
  { value: 'DOOSAN', label: '두산 베어스' },
  { value: 'SAMSUNG', label: '삼성 라이온즈' },
  { value: 'LOTTE', label: '롯데 자이언츠' },
  { value: 'NC', label: 'NC 다이노스' },
  { value: 'KT', label: 'KT 위즈' },
  { value: 'HANWHA', label: '한화 이글스' },
  { value: 'SSG', label: 'SSG 랜더스' },
  { value: 'KIWOOM', label: '키움 히어로즈' }
];

const TEAM_THEME = {
  LG: '#B31F45',
  KIA: '#D91F36',
  DOOSAN: '#1B1F48',
  SAMSUNG: '#006DFF',
  LOTTE: '#0E2E63',
  NC: '#315D9A',
  KT: '#232733',
  HANWHA: '#F36B21',
  SSG: '#C01E37',
  KIWOOM: '#6B1830'
};

const state = {
  myTeam: localStorage.getItem('myTeam') || 'LG',
  theme: localStorage.getItem('theme') || 'dark',
  recentLimit: Number(localStorage.getItem('recentLimit') || 5) === 10 ? 10 : 5,
  writeMode: 'template',
  standingsOpen: localStorage.getItem('standingsOpen') === 'true',
  recentOpen: localStorage.getItem('recentOpen') !== 'false',
  recordOpen: localStorage.getItem('recordOpen') !== 'false',
  dashboard: null,
  selectedGameId: null,
  gameDetails: {}
};

const els = {
  heroTeam: document.getElementById('heroTeam'),
  heroModeLabel: document.getElementById('heroModeLabel'),
  heroRangeLabel: document.getElementById('heroRangeLabel'),
  teamSelect: document.getElementById('myTeamSelect'),
  themeToggle: document.getElementById('themeToggle'),
  todayStatus: document.getElementById('todayStatus'),
  todayGameCard: document.getElementById('todayGameCard'),
  myStandingCard: document.getElementById('myStandingCard'),
  standingsTable: document.getElementById('standingsTable'),
  fullStandingsWrap: document.getElementById('fullStandingsWrap'),
  toggleStandingsBtn: document.getElementById('toggleStandingsBtn'),
  recentCalendar: document.getElementById('recentCalendar'),
  selectedGameDetail: document.getElementById('selectedGameDetail'),
  toggleRecentBtn: document.getElementById('toggleRecentBtn'),
  recentContent: document.getElementById('recentContent'),
  toggleRecordBtn: document.getElementById('toggleRecordBtn'),
  recordContent: document.getElementById('recordContent'),
  templateFields: document.getElementById('templateFields'),
  freeFields: document.getElementById('freeFields'),
  softenBtn: document.getElementById('softenBtn'),
  softenResult: document.getElementById('softenResult'),
  softenAlternatives: document.getElementById('softenAlternatives'),
  previewBtn: document.getElementById('previewBtn'),
  previewResult: document.getElementById('previewResult')
};

function setAccent(hex) {
  const color = hex || TEAM_THEME[state.myTeam] || '#B31F45';
  const rgb = color.replace('#', '');
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.theme === 'dark' ? '#0b1017' : '#f4f5f7');
}

function applyTheme() {
  document.body.dataset.theme = state.theme;
  els.themeToggle.textContent = state.theme === 'dark' ? '화이트' : '나이트';
  els.heroModeLabel.textContent = state.theme === 'dark' ? 'NIGHT' : 'DAY';
  setAccent(TEAM_THEME[state.myTeam]);
}

function applyTeam() {
  const selected = TEAM_OPTIONS.find(item => item.value === state.myTeam);
  els.heroTeam.textContent = selected ? selected.label.split(' ')[0] : state.myTeam;
  setAccent(TEAM_THEME[state.myTeam]);
}

function populateTeams() {
  els.teamSelect.innerHTML = TEAM_OPTIONS.map(team => `<option value="${team.value}">${team.label}</option>`).join('');
  els.teamSelect.value = state.myTeam;
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
}

function setWriteMode(mode) {
  state.writeMode = mode;
  document.querySelectorAll('#writeModeTabs .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  els.templateFields.classList.toggle('hidden', mode !== 'template');
  els.freeFields.classList.toggle('hidden', mode !== 'free');
}

function setRecentLimit(limit) {
  state.recentLimit = limit === 10 ? 10 : 5;
  localStorage.setItem('recentLimit', String(state.recentLimit));
  els.heroRangeLabel.textContent = `${state.recentLimit} GAMES`;
  document.querySelectorAll('#recentRangeTabs .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.limit) === state.recentLimit);
  });
  fetchDashboard();
}

function setCollapsible(targetEl, buttonEl, open) {
  targetEl.classList.toggle('open', open);
  buttonEl.textContent = open ? '▾' : '▸';
  buttonEl.setAttribute('aria-expanded', String(open));
}

function renderTodayGame(game) {
  if (!game) {
    els.todayStatus.textContent = '경기 없음';
    els.todayGameCard.classList.remove('loading');
    els.todayGameCard.innerHTML = `<p class="muted">오늘은 ${els.heroTeam.textContent} 경기 일정이 확인되지 않아요.</p>`;
    return;
  }

  const scoreText = game.isFinal ? `${game.awayScore} : ${game.homeScore}` : 'VS';
  const resultText = game.isFinal ? (game.result || '종료') : '예정 경기';
  els.todayStatus.textContent = game.statusLabel || (game.isFinal ? '경기 종료' : '경기 예정');
  els.todayGameCard.classList.remove('loading');
  els.todayGameCard.innerHTML = `
    <div class="game-head">
      <div>
        <p class="eyebrow">${formatDate(game.date)}</p>
        <strong>${game.awayKo} vs ${game.homeKo}</strong>
      </div>
      <span class="pill">${game.stadium || '구장 정보 없음'}</span>
    </div>
    <div class="matchup">
      <div class="team-name"><span class="team-dot"></span>${game.awayKo}</div>
      <div class="score-box">${scoreText}</div>
      <div class="team-name" style="justify-self:end">${game.homeKo}<span class="team-dot"></span></div>
    </div>
    <div class="meta-row" style="margin-top:12px">
      <span class="meta-chip">${game.time || '시간 미정'}</span>
      <span class="meta-chip">${resultText}</span>
      <span class="meta-chip">상대 ${game.opponentKo || '-'}</span>
    </div>
  `;
}

function renderMyStanding(standing) {
  if (!standing) {
    els.myStandingCard.classList.remove('loading');
    els.myStandingCard.innerHTML = '<p class="muted">마이팀 순위 정보를 아직 가져오지 못했어요.</p>';
    return;
  }
  els.myStandingCard.classList.remove('loading');
  els.myStandingCard.innerHTML = `
    <div class="standing-row mine">
      <div>
        <div class="team-rank"><span class="rank-badge">${standing.rank}</span><strong>${standing.teamKo}</strong></div>
        <div class="standing-meta">${standing.wins}승 ${standing.losses}패 ${standing.draws}무 · 승률 ${standing.pct}</div>
      </div>
      <div class="standing-meta">${standing.streak || ''}</div>
    </div>
  `;
}

function renderStandings(standings) {
  if (!standings || !standings.length) {
    els.standingsTable.innerHTML = '<p class="muted">전체 순위 정보를 아직 가져오지 못했어요.</p>';
    return;
  }
  els.standingsTable.innerHTML = standings.map(item => `
    <div class="standing-row ${item.team === state.myTeam ? 'mine' : ''}">
      <div>
        <div class="team-rank"><span class="rank-badge">${item.rank}</span><strong>${item.teamKo}</strong></div>
        <div class="standing-meta">${item.wins}승 ${item.losses}패 ${item.draws}무</div>
      </div>
      <div class="standing-meta">${item.pct}</div>
    </div>
  `).join('');
}

function getGamesChronological() {
  const games = [...(state.dashboard?.recentGames || [])];
  return games.sort((a, b) => a.date.localeCompare(b.date));
}

function renderRecentGames(games) {
  if (!games || !games.length) {
    els.recentCalendar.classList.remove('loading');
    els.recentCalendar.innerHTML = '<p class="muted">최근 경기 기록을 가져오지 못했어요.</p>';
    els.selectedGameDetail.textContent = '날짜를 누르면 상세 정보가 보여요.';
    return;
  }

  const chronological = [...games].sort((a, b) => a.date.localeCompare(b.date));
  if (!state.selectedGameId || !chronological.some(game => game.id === state.selectedGameId)) {
    state.selectedGameId = chronological[chronological.length - 1].id;
  }

  els.recentCalendar.classList.remove('loading');
  els.recentCalendar.innerHTML = chronological.map(game => {
    const resultClass = game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw';
    return `
      <button class="calendar-day ${state.selectedGameId === game.id ? 'selected' : ''}" data-game-id="${game.id}">
        <div class="calendar-top">
          <span class="calendar-date">${formatDate(game.date)}</span>
          <span class="calendar-result ${resultClass}">${game.result}</span>
        </div>
        <strong class="calendar-opponent">vs ${game.opponentKo}</strong>
        <div class="standing-meta">${game.myTeamKo} ${game.myScore} : ${game.oppScore} ${game.opponentKo}</div>
      </button>
    `;
  }).join('');

  renderSelectedGame();
}

function detailCell(label, value, wide = false) {
  return `
    <div class="detail-item ${wide ? 'wide' : ''}">
      <span class="detail-label">${label}</span>
      <span class="detail-value">${value && String(value).trim() ? value : '정보 없음'}</span>
    </div>
  `;
}

async function renderSelectedGame() {
  const game = (state.dashboard?.recentGames || []).find(item => item.id === state.selectedGameId);
  if (!game) {
    els.selectedGameDetail.classList.add('muted');
    els.selectedGameDetail.textContent = '날짜를 누르면 상세 정보가 보여요.';
    return;
  }

  const cached = state.gameDetails[game.id];
  const detail = cached || {
    winningPitcher: game.winningPitcher || null,
    losingPitcher: game.losingPitcher || null,
    savePitcher: game.savePitcher || null,
    holdPitchers: game.holdPitchers || null,
    decisiveHitter: game.decisiveHitter || null
  };

  els.selectedGameDetail.classList.remove('muted');
  els.selectedGameDetail.innerHTML = `
    <div class="game-head">
      <div>
        <p class="eyebrow">${formatDate(game.date)}</p>
        <strong>${game.scoreLabel}</strong>
      </div>
      <span class="pill">${game.stadium || '구장 정보 없음'}</span>
    </div>
    <div class="detail-grid">
      ${detailCell('승리투수', detail.winningPitcher)}
      ${detailCell('패전투수', detail.losingPitcher)}
      ${detailCell('세이브투수', detail.savePitcher)}
      ${detailCell('홀드투수', detail.holdPitchers)}
      ${detailCell('결승타 선수', detail.decisiveHitter, true)}
    </div>
  `;

  if (!cached) {
    try {
      const url = `/api/game-detail?date=${encodeURIComponent(game.date)}&away=${encodeURIComponent(game.away)}&home=${encodeURIComponent(game.home)}&awayKo=${encodeURIComponent(game.awayKo)}&homeKo=${encodeURIComponent(game.homeKo)}`;
      const response = await fetch(url);
      const extra = await response.json();
      state.gameDetails[game.id] = {
        winningPitcher: extra.winningPitcher || detail.winningPitcher,
        losingPitcher: extra.losingPitcher || detail.losingPitcher,
        savePitcher: extra.savePitcher || detail.savePitcher,
        holdPitchers: extra.holdPitchers || detail.holdPitchers,
        decisiveHitter: extra.decisiveHitter || detail.decisiveHitter
      };
      if (state.selectedGameId === game.id) renderSelectedGame();
    } catch (error) {
      // keep scoreboard values only
    }
  }
}

function collectRawInput() {
  if (state.writeMode === 'free') {
    return document.getElementById('freeNote').value.trim();
  }
  return [
    `감정: ${document.getElementById('feeling').value}`,
    `한 줄 요약: ${document.getElementById('oneLine').value}`,
    `좋았던 장면: ${document.getElementById('goodPoint').value}`,
    `아쉬웠던 장면: ${document.getElementById('badPoint').value}`,
    `다음 경기 기대: ${document.getElementById('nextPoint').value}`
  ].filter(item => !item.endsWith(': ')).join('\n');
}

function makePreviewText() {
  if (state.writeMode === 'free') {
    const text = document.getElementById('freeNote').value.trim();
    return text ? `오늘 ${els.heroTeam.textContent} 경기를 보며 ${text}` : '';
  }
  const feeling = document.getElementById('feeling').value.trim();
  const oneLine = document.getElementById('oneLine').value.trim();
  const goodPoint = document.getElementById('goodPoint').value.trim();
  const badPoint = document.getElementById('badPoint').value.trim();
  const nextPoint = document.getElementById('nextPoint').value.trim();
  const pieces = [];
  if (oneLine) pieces.push(oneLine);
  if (goodPoint) pieces.push(`좋았던 장면은 ${goodPoint}`);
  if (badPoint) pieces.push(`아쉬웠던 장면은 ${badPoint}`);
  if (nextPoint) pieces.push(`다음 경기에서는 ${nextPoint}를 기대한다`);
  return pieces.length ? `${els.heroTeam.textContent} 팬 기록. 오늘은 ${feeling}. ${pieces.join('. ')}.` : '';
}

async function softenText() {
  const text = collectRawInput();
  if (!text) {
    els.softenResult.textContent = '먼저 기록을 입력해줘.';
    els.softenAlternatives.innerHTML = '';
    return;
  }
  els.softenResult.textContent = '정리 중…';
  els.softenAlternatives.innerHTML = '';
  try {
    const response = await fetch('/api/soften', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, team: state.myTeam })
    });
    const data = await response.json();
    els.softenResult.textContent = data.softened || '오늘 경기는 아쉬움이 크게 남았다.';
    els.softenAlternatives.innerHTML = (data.alternatives || []).map(item => `<span class="alt-chip">${item}</span>`).join('');
  } catch (error) {
    els.softenResult.textContent = '순화 결과를 불러오지 못했어.';
    els.softenAlternatives.innerHTML = '';
  }
}

function renderPreview() {
  const preview = makePreviewText();
  els.previewResult.textContent = preview || '먼저 기록을 입력해줘.';
}

async function fetchDashboard() {
  els.todayStatus.textContent = '불러오는 중';
  els.todayGameCard.classList.add('loading');
  els.myStandingCard.classList.add('loading');
  els.recentCalendar.classList.add('loading');
  els.todayGameCard.textContent = '오늘 경기 정보를 불러오는 중이에요.';
  els.myStandingCard.textContent = '순위 정보를 불러오는 중이에요.';
  els.recentCalendar.textContent = '최근 경기 데이터를 불러오는 중이에요.';
  els.standingsTable.innerHTML = '';
  els.selectedGameDetail.textContent = '상세 데이터를 불러오는 중이에요.';

  try {
    const response = await fetch(`/api/kbo-dashboard?team=${state.myTeam}&limit=${state.recentLimit}`);
    const data = await response.json();
    state.dashboard = data;
    renderTodayGame(data.myTodayGame || null);
    renderMyStanding(data.myStanding || null);
    renderStandings(data.standings || []);
    renderRecentGames(data.recentGames || []);
  } catch (error) {
    state.dashboard = null;
    renderTodayGame(null);
    renderMyStanding(null);
    renderStandings([]);
    renderRecentGames([]);
  }
}

function bindEvents() {
  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
  });

  els.teamSelect.addEventListener('change', (event) => {
    state.myTeam = event.target.value;
    localStorage.setItem('myTeam', state.myTeam);
    state.gameDetails = {};
    applyTeam();
    fetchDashboard();
  });

  document.querySelectorAll('#recentRangeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => setRecentLimit(Number(btn.dataset.limit)));
  });

  document.querySelectorAll('#writeModeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => setWriteMode(btn.dataset.mode));
  });

  els.toggleStandingsBtn.addEventListener('click', () => {
    state.standingsOpen = !state.standingsOpen;
    localStorage.setItem('standingsOpen', String(state.standingsOpen));
    els.fullStandingsWrap.classList.toggle('collapsed', !state.standingsOpen);
    els.toggleStandingsBtn.textContent = state.standingsOpen ? '▾' : '▸';
    els.toggleStandingsBtn.setAttribute('aria-expanded', String(state.standingsOpen));
  });

  els.toggleRecentBtn.addEventListener('click', () => {
    state.recentOpen = !state.recentOpen;
    localStorage.setItem('recentOpen', String(state.recentOpen));
    setCollapsible(els.recentContent, els.toggleRecentBtn, state.recentOpen);
  });

  els.toggleRecordBtn.addEventListener('click', () => {
    state.recordOpen = !state.recordOpen;
    localStorage.setItem('recordOpen', String(state.recordOpen));
    setCollapsible(els.recordContent, els.toggleRecordBtn, state.recordOpen);
  });

  els.recentCalendar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-game-id]');
    if (!button) return;
    state.selectedGameId = button.dataset.gameId;
    renderRecentGames(state.dashboard?.recentGames || []);
  });

  els.softenBtn.addEventListener('click', softenText);
  els.previewBtn.addEventListener('click', renderPreview);
}

function init() {
  populateTeams();
  applyTheme();
  applyTeam();
  setWriteMode('template');
  setCollapsible(els.recentContent, els.toggleRecentBtn, state.recentOpen);
  setCollapsible(els.recordContent, els.toggleRecordBtn, state.recordOpen);
  els.fullStandingsWrap.classList.toggle('collapsed', !state.standingsOpen);
  els.toggleStandingsBtn.textContent = state.standingsOpen ? '▾' : '▸';
  els.toggleStandingsBtn.setAttribute('aria-expanded', String(state.standingsOpen));
  els.heroRangeLabel.textContent = `${state.recentLimit} GAMES`;
  bindEvents();
  setRecentLimit(state.recentLimit);
}

init();
