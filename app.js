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
  dashboard: null,
  selectedGameId: null,
  standingsOpen: false,
  recentOpen: true,
  recordOpen: true
};

const els = {
  themeToggle: document.getElementById('themeToggle'),
  heroTeam: document.getElementById('heroTeam'),
  teamSelect: document.getElementById('myTeamSelect'),
  todayStatus: document.getElementById('todayStatus'),
  todayGameCard: document.getElementById('todayGameCard'),
  myStandingCard: document.getElementById('myStandingCard'),
  standingsTable: document.getElementById('standingsTable'),
  fullStandingsWrap: document.getElementById('fullStandingsWrap'),
  toggleStandingsBtn: document.getElementById('toggleStandingsBtn'),
  recentGamesList: document.getElementById('recentGamesList'),
  recentCalendar: document.getElementById('recentCalendar'),
  selectedGameDetail: document.getElementById('selectedGameDetail'),
  toggleRecentBtn: document.getElementById('toggleRecentBtn'),
  recentContent: document.getElementById('recentContent'),
  toggleRecordBtn: document.getElementById('toggleRecordBtn'),
  recordContent: document.getElementById('recordContent'),
  softenBtn: document.getElementById('softenBtn'),
  softenResult: document.getElementById('softenResult'),
  softenAlternatives: document.getElementById('softenAlternatives'),
  previewBtn: document.getElementById('previewBtn'),
  previewResult: document.getElementById('previewResult'),
  templateFields: document.getElementById('templateFields'),
  freeFields: document.getElementById('freeFields')
};

function setAccent(color) {
  const hex = color || TEAM_THEME[state.myTeam] || '#B31F45';
  document.documentElement.style.setProperty('--accent', hex);
  const rgb = hex.replace('#', '');
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', state.theme === 'dark' ? '#0d1117' : '#f5f7fb');
}

function applyTheme() {
  document.body.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
  els.themeToggle.textContent = state.theme === 'dark' ? '화이트' : '나이트';
}

function applyTeamAccent() {
  setAccent(TEAM_THEME[state.myTeam]);
  els.heroTeam.textContent = TEAM_OPTIONS.find(team => team.value === state.myTeam)?.label?.split(' ')[0] || state.myTeam;
}

function populateTeams() {
  els.teamSelect.innerHTML = TEAM_OPTIONS.map(team => `<option value="${team.value}">${team.label}</option>`).join('');
  els.teamSelect.value = state.myTeam;
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
  document.querySelectorAll('#recentRangeTabs .segmented-btn').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.limit) === state.recentLimit);
  });
  fetchDashboard();
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' }).format(date);
}

function calendarDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' }).format(date);
}

function renderTodayGame(game) {
  if (!game) {
    els.todayStatus.textContent = '경기 없음';
    els.todayGameCard.innerHTML = `<p class="muted">오늘은 ${els.heroTeam.textContent} 경기 정보가 아직 없어요.</p>`;
    return;
  }

  const score = game.isFinal ? `${game.awayScore} : ${game.homeScore}` : 'VS';
  const status = game.statusLabel || (game.isFinal ? '경기 종료' : '경기 예정');
  els.todayStatus.textContent = status;
  els.todayGameCard.innerHTML = `
    <div class="game-top">
      <div>
        <p class="eyebrow">${formatDate(game.date)}</p>
        <strong>${game.awayKo} vs ${game.homeKo}</strong>
      </div>
      <span class="pill">${game.stadium || '구장 정보 없음'}</span>
    </div>
    <div class="matchup-line">
      <div class="team-mark"><span class="team-dot"></span>${game.awayKo}</div>
      <div class="score-chip">${score}</div>
      <div class="team-mark">${game.homeKo}<span class="team-dot"></span></div>
    </div>
    <div class="meta-row" style="margin-top:12px">
      <span class="meta-chip">${game.time || '시간 미정'}</span>
      <span class="meta-chip">${game.isFinal ? (game.result || '종료') : '예정 경기'}</span>
      <span class="meta-chip">상대 ${game.opponentKo || '-'}</span>
    </div>
  `;
}

function renderMyStanding(standing) {
  if (!standing) {
    els.myStandingCard.innerHTML = `<p class="muted">순위 정보를 아직 가져오지 못했어요.</p>`;
    return;
  }
  els.myStandingCard.innerHTML = `
    <div class="standing-row mine">
      <div>
        <div class="team-mark"><span class="rank-badge">${standing.rank}</span>${standing.teamKo}</div>
        <div class="standing-meta">${standing.wins}승 ${standing.losses}패 ${standing.draws}무 · 승률 ${standing.pct}</div>
      </div>
      <div class="standing-meta">${standing.streak || ''}</div>
    </div>
  `;
}

function renderStandings(standings) {
  if (!standings.length) {
    els.standingsTable.innerHTML = `<p class="muted">전체 순위 정보를 불러오지 못했어요.</p>`;
    return;
  }
  els.standingsTable.innerHTML = standings.map(item => `
    <div class="standing-row ${item.team === state.myTeam ? 'mine' : ''}">
      <div>
        <div class="team-mark"><span class="rank-badge">${item.rank}</span>${item.teamKo}</div>
        <div class="standing-meta">${item.wins}승 ${item.losses}패 ${item.draws}무</div>
      </div>
      <div class="standing-meta">${item.pct}</div>
    </div>
  `).join('');
}

function getChronologicalGames() {
  const games = [...(state.dashboard?.recentGames || [])];
  return games.sort((a, b) => a.date.localeCompare(b.date));
}

function renderRecentGames(games) {
  if (!games.length) {
    els.recentGamesList.innerHTML = `<p class="muted">최근 경기 데이터를 가져오지 못했어요.</p>`;
    els.recentCalendar.innerHTML = '';
    els.selectedGameDetail.textContent = '상세 데이터를 불러오지 못했어요.';
    return;
  }

  const chronological = [...games].sort((a, b) => a.date.localeCompare(b.date));
  const listDescending = [...games].sort((a, b) => b.date.localeCompare(a.date));

  els.recentGamesList.innerHTML = listDescending.map(game => {
    const cls = game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw';
    return `
      <article class="game-card ${state.selectedGameId === game.id ? 'selected' : ''}" data-game-id="${game.id}">
        <div class="game-top">
          <div>
            <p class="eyebrow">${formatDate(game.date)}</p>
            <strong>${game.homeKo} vs ${game.awayKo}</strong>
          </div>
          <span class="result-chip ${cls}">${game.result}</span>
        </div>
        <div class="matchup-line">
          <div class="team-mark"><span class="team-dot"></span>${game.awayKo}</div>
          <div class="score-chip">${game.awayScore} : ${game.homeScore}</div>
          <div class="team-mark">${game.homeKo}<span class="team-dot"></span></div>
        </div>
        <div class="meta-row" style="margin-top:12px">
          <span class="meta-chip">${game.stadium || '구장 정보 없음'}</span>
          <span class="meta-chip">상대 ${game.opponentKo}</span>
        </div>
      </article>
    `;
  }).join('');

  els.recentCalendar.innerHTML = chronological.map(game => {
    const cls = game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw';
    const selected = state.selectedGameId === game.id ? 'selected' : '';
    return `
      <button class="calendar-day ${selected}" data-game-id="${game.id}">
        <span class="calendar-date">${calendarDate(game.date)}</span>
        <span class="calendar-opponent">vs ${game.opponentKo}</span>
        <span class="calendar-result ${cls}">${game.result} · ${game.myScore}-${game.oppScore}</span>
      </button>
    `;
  }).join('');

  if (!state.selectedGameId) {
    state.selectedGameId = chronological[chronological.length - 1].id;
  }
  renderSelectedGame();
}

function detailValue(value) {
  return value && String(value).trim() ? value : '정보 없음';
}

function renderSelectedGame() {
  const game = (state.dashboard?.recentGames || []).find(item => item.id === state.selectedGameId);
  if (!game) {
    els.selectedGameDetail.textContent = '날짜를 누르면 경기 상세가 보여요.';
    return;
  }

  els.selectedGameDetail.classList.remove('muted');
  els.selectedGameDetail.innerHTML = `
    <div class="game-top">
      <div>
        <p class="eyebrow">${formatDate(game.date)}</p>
        <strong>${game.scoreLabel}</strong>
      </div>
      <span class="pill">${game.stadium || '구장 정보 없음'}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">승리투수</span><span class="detail-value">${detailValue(game.winningPitcher)}</span></div>
      <div class="detail-item"><span class="detail-label">패전투수</span><span class="detail-value">${detailValue(game.losingPitcher)}</span></div>
      <div class="detail-item"><span class="detail-label">세이브투수</span><span class="detail-value">${detailValue(game.savePitcher)}</span></div>
      <div class="detail-item"><span class="detail-label">홀드투수</span><span class="detail-value">${detailValue(game.holdPitchers)}</span></div>
      <div class="detail-item" style="grid-column:1/-1"><span class="detail-label">결승타 선수</span><span class="detail-value">${detailValue(game.decisiveHitter)}</span></div>
    </div>
  `;
}

function collectRawInput() {
  if (state.writeMode === 'free') {
    return document.getElementById('freeNote').value.trim();
  }

  const parts = [
    `감정: ${document.getElementById('feeling').value}`,
    `한 줄 요약: ${document.getElementById('oneLine').value}`,
    `좋았던 장면: ${document.getElementById('goodPoint').value}`,
    `아쉬웠던 장면: ${document.getElementById('badPoint').value}`,
    `다음 경기 기대: ${document.getElementById('nextPoint').value}`
  ].filter(item => !item.endsWith(': '));

  return parts.join('\n');
}

function makePreviewText() {
  if (state.writeMode === 'free') {
    const note = document.getElementById('freeNote').value.trim();
    return note ? `오늘은 ${els.heroTeam.textContent} 경기를 보며 ${note}` : '';
  }

  const feeling = document.getElementById('feeling').value.trim();
  const oneLine = document.getElementById('oneLine').value.trim();
  const goodPoint = document.getElementById('goodPoint').value.trim();
  const badPoint = document.getElementById('badPoint').value.trim();
  const nextPoint = document.getElementById('nextPoint').value.trim();
  const segments = [];
  if (oneLine) segments.push(oneLine);
  if (goodPoint) segments.push(`좋았던 장면은 ${goodPoint}`);
  if (badPoint) segments.push(`아쉬웠던 장면은 ${badPoint}`);
  if (nextPoint) segments.push(`다음 경기에서는 ${nextPoint}를 기대한다`);
  if (!segments.length) return '';
  return `${els.heroTeam.textContent} 팬 기록. 오늘은 ${feeling}. ${segments.join('. ')}.`;
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

function toggleCollapsible(open, wrap, btn) {
  wrap.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
  btn.textContent = open ? '▾' : '▸';
}

async function fetchDashboard() {
  els.todayStatus.textContent = '불러오는 중';
  els.todayGameCard.innerHTML = '';
  els.myStandingCard.innerHTML = '';
  els.standingsTable.innerHTML = '';
  els.recentCalendar.innerHTML = '';
  els.recentGamesList.innerHTML = '';
  els.selectedGameDetail.textContent = '불러오는 중…';

  try {
    const response = await fetch(`/api/kbo-dashboard?team=${state.myTeam}&limit=${state.recentLimit}`);
    const data = await response.json();
    state.dashboard = data;
    if (!state.selectedGameId || !(data.recentGames || []).some(item => item.id === state.selectedGameId)) {
      const chronological = [...(data.recentGames || [])].sort((a, b) => a.date.localeCompare(b.date));
      state.selectedGameId = chronological[chronological.length - 1]?.id || null;
    }
    renderTodayGame(data.myTodayGame);
    renderMyStanding(data.myStanding);
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
    setAccent(TEAM_THEME[state.myTeam]);
  });

  els.teamSelect.addEventListener('change', (event) => {
    state.myTeam = event.target.value;
    localStorage.setItem('myTeam', state.myTeam);
    applyTeamAccent();
    fetchDashboard();
  });

  document.querySelectorAll('#recentRangeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => setRecentLimit(Number(btn.dataset.limit)));
  });

  document.querySelectorAll('#writeModeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => setWriteMode(btn.dataset.mode));
  });

  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.scroll);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  els.toggleStandingsBtn.addEventListener('click', () => {
    state.standingsOpen = !state.standingsOpen;
    els.fullStandingsWrap.classList.toggle('collapsed', !state.standingsOpen);
    els.toggleStandingsBtn.setAttribute('aria-expanded', String(state.standingsOpen));
    els.toggleStandingsBtn.textContent = state.standingsOpen ? '▾' : '▸';
  });

  els.toggleRecentBtn.addEventListener('click', () => {
    state.recentOpen = !state.recentOpen;
    toggleCollapsible(state.recentOpen, els.recentContent, els.toggleRecentBtn);
  });

  els.toggleRecordBtn.addEventListener('click', () => {
    state.recordOpen = !state.recordOpen;
    toggleCollapsible(state.recordOpen, els.recordContent, els.toggleRecordBtn);
  });

  els.recentCalendar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-game-id]');
    if (!button) return;
    state.selectedGameId = button.dataset.gameId;
    renderRecentGames(state.dashboard?.recentGames || []);
  });

  els.recentGamesList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-game-id]');
    if (!card) return;
    state.selectedGameId = card.dataset.gameId;
    renderRecentGames(state.dashboard?.recentGames || []);
  });

  els.softenBtn.addEventListener('click', softenText);
  els.previewBtn.addEventListener('click', renderPreview);
}

function init() {
  populateTeams();
  applyTheme();
  applyTeamAccent();
  setRecentLimit(state.recentLimit);
  setWriteMode('template');
  toggleCollapsible(true, els.recentContent, els.toggleRecentBtn);
  toggleCollapsible(true, els.recordContent, els.toggleRecordBtn);
  bindEvents();
}

init();
