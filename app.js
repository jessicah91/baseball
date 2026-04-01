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
  SAMSUNG: '#1D66D1',
  LOTTE: '#0E2E63',
  NC: '#375A97',
  KT: '#20242B',
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
  recentOpen: true
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

function shortDate(dateString) {
  const date = new Date(`${dateString}T00:00:00+09:00`);
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric' }).format(date);
}

function renderTodayGame(game) {
  if (!game) {
    els.todayGameCard.innerHTML = `<p class="muted">오늘은 ${els.heroTeam.textContent} 경기 정보가 아직 없어요.</p>`;
    return;
  }
  const score = game.isFinal ? `${game.awayScore} : ${game.homeScore}` : 'VS';
  const status = game.isFinal ? '경기 종료' : '경기 예정';
  els.todayStatus.textContent = status;
  els.todayGameCard.innerHTML = `
    <div class="matchup-line">
      <div class="team-mark"><span class="team-dot"></span>${game.awayKo}</div>
      <div class="score-chip">${score}</div>
      <div class="team-mark">${game.homeKo}<span class="team-dot"></span></div>
    </div>
    <div class="meta-row">
      <span class="meta-chip">${formatDate(game.date)}</span>
      <span class="meta-chip">${game.stadium || '구장 정보 없음'}</span>
      <span class="meta-chip">${game.time || '시간 미정'}</span>
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

function renderRecentGames(games) {
  if (!games.length) {
    els.recentGamesList.innerHTML = `<p class="muted">최근 경기 데이터를 가져오지 못했어요.</p>`;
    els.recentCalendar.innerHTML = '';
    return;
  }

  els.recentGamesList.innerHTML = games.map(game => {
    const cls = game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw';
    return `
      <article class="game-card" data-game-id="${game.id}">
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
        <div class="meta-row">
          <span class="meta-chip">${game.stadium || '구장 정보 없음'}</span>
          <span class="meta-chip">${game.time || '-'}</span>
          <span class="meta-chip">상대 ${game.opponentKo}</span>
        </div>
      </article>
    `;
  }).join('');

  els.recentCalendar.innerHTML = games.map(game => {
    const cls = game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw';
    const selected = state.selectedGameId === game.id ? 'selected' : '';
    return `
      <button class="calendar-day ${selected}" data-game-id="${game.id}">
        <span class="calendar-date">${shortDate(game.date)}</span>
        <span class="calendar-opponent">vs ${game.opponentKo}</span>
        <span class="calendar-result ${cls}">${game.result} · ${game.myScore}-${game.oppScore}</span>
      </button>
    `;
  }).join('');

  if (!state.selectedGameId) {
    state.selectedGameId = games[0].id;
  }
  renderSelectedGame();
}

function renderSelectedGame() {
  const games = state.dashboard?.recentGames || [];
  const game = games.find(item => item.id === state.selectedGameId) || games[0];
  if (!game) {
    els.selectedGameDetail.textContent = '날짜를 누르면 경기 상세가 보여요.';
    els.selectedGameDetail.classList.add('muted');
    return;
  }

  state.selectedGameId = game.id;
  document.querySelectorAll('.calendar-day').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.gameId === game.id);
  });

  els.selectedGameDetail.classList.remove('muted');
  els.selectedGameDetail.innerHTML = `
    <div class="game-top">
      <div>
        <p class="eyebrow">${formatDate(game.date)}</p>
        <strong>${game.scoreLabel}</strong>
      </div>
      <span class="result-chip ${game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw'}">${game.result}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item"><strong>승리투수</strong>${game.winningPitcher || '정보 없음'}</div>
      <div class="detail-item"><strong>패전투수</strong>${game.losingPitcher || '정보 없음'}</div>
      <div class="detail-item"><strong>세이브투수</strong>${game.savePitcher || '정보 없음'}</div>
      <div class="detail-item"><strong>홀드투수</strong>${game.holdPitchers || '정보 없음'}</div>
      <div class="detail-item full"><strong>결승타 선수</strong>${game.decisiveHitter || '정보 없음'}</div>
    </div>
  `;
}

function gatherCurrentText() {
  if (state.writeMode === 'free') {
    return document.getElementById('freeNote').value.trim();
  }
  const feeling = document.getElementById('feeling').value.trim();
  const oneLine = document.getElementById('oneLine').value.trim();
  const goodPoint = document.getElementById('goodPoint').value.trim();
  const badPoint = document.getElementById('badPoint').value.trim();
  const nextPoint = document.getElementById('nextPoint').value.trim();

  return [
    feeling ? `감정: ${feeling}` : '',
    oneLine ? `한 줄 요약: ${oneLine}` : '',
    goodPoint ? `좋았던 장면: ${goodPoint}` : '',
    badPoint ? `아쉬웠던 장면: ${badPoint}` : '',
    nextPoint ? `다음 경기 기대: ${nextPoint}` : ''
  ].filter(Boolean).join('\n');
}

function buildNarrative() {
  const text = gatherCurrentText();
  if (!text) {
    els.previewResult.textContent = '먼저 기록을 적어줘.';
    els.previewResult.classList.remove('muted');
    return;
  }

  if (state.writeMode === 'free') {
    els.previewResult.textContent = `${els.heroTeam.textContent} 경기를 본 뒤 남긴 기록이다. ${text.replace(/\n+/g, ' ')} 이 감정은 단순한 반응이 아니라 다음 경기를 더 잘 보기 위한 메모로 남겨둔다.`;
  } else {
    const feeling = document.getElementById('feeling').value.trim();
    const oneLine = document.getElementById('oneLine').value.trim();
    const goodPoint = document.getElementById('goodPoint').value.trim();
    const badPoint = document.getElementById('badPoint').value.trim();
    const nextPoint = document.getElementById('nextPoint').value.trim();
    els.previewResult.textContent = `오늘 ${els.heroTeam.textContent} 경기는 ${feeling}는 감정이 가장 크게 남았다. 전체 흐름은 ${oneLine || '조금 더 지켜봐야 할 경기'}로 정리된다. 좋았던 장면은 ${goodPoint || '아직 더 적어둘 부분이 있다'}였고, 아쉬운 장면은 ${badPoint || '좀 더 세밀한 복기가 필요했다'}였다. 다음 경기에서는 ${nextPoint || '운영과 집중력을 더 보고 싶다'}는 기대를 남긴다.`;
  }

  els.previewResult.classList.remove('muted');
}

async function softenText() {
  const text = gatherCurrentText();
  if (!text) {
    els.softenResult.textContent = '먼저 기록을 적어줘.';
    els.softenResult.classList.remove('muted');
    return;
  }
  els.softenBtn.disabled = true;
  els.softenBtn.textContent = '정리 중...';

  try {
    const response = await fetch('/api/soften', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, team: state.myTeam })
    });
    const data = await response.json();
    els.softenResult.textContent = data.softened || '정리 결과가 없어요.';
    els.softenResult.classList.remove('muted');
    els.softenAlternatives.innerHTML = (data.alternatives || []).map(item => `<span class="alt-chip">${item}</span>`).join('');
  } catch (error) {
    els.softenResult.textContent = '순화 도우미 연결에 실패했어.';
    els.softenAlternatives.innerHTML = '';
    els.softenResult.classList.remove('muted');
  } finally {
    els.softenBtn.disabled = false;
    els.softenBtn.textContent = 'GPT로 순화하기';
  }
}

async function fetchDashboard() {
  els.todayStatus.textContent = '불러오는 중';
  els.todayGameCard.className = 'game-focus skeleton-block';
  els.myStandingCard.className = 'standing-focus skeleton-block';
  els.recentGamesList.innerHTML = '';
  els.recentCalendar.innerHTML = '';
  els.selectedGameDetail.textContent = '불러오는 중';
  try {
    const response = await fetch(`/api/kbo-dashboard?team=${state.myTeam}&limit=${state.recentLimit}`);
    const data = await response.json();
    state.dashboard = data;
    state.selectedGameId = data.recentGames?.[0]?.id || null;

    setAccent(data.themeColor || TEAM_THEME[state.myTeam]);
    els.todayGameCard.className = 'game-focus';
    els.myStandingCard.className = 'standing-focus';

    renderTodayGame(data.myTodayGame);
    renderMyStanding(data.myStanding);
    renderRecentGames(data.recentGames || []);
    renderStandings(data.standings || []);
    els.todayStatus.textContent = data.source === 'official-kbo' ? 'KBO 연동' : '연동 실패';
  } catch (error) {
    els.todayStatus.textContent = '연동 실패';
    els.todayGameCard.className = 'game-focus';
    els.myStandingCard.className = 'standing-focus';
    els.todayGameCard.innerHTML = `<p class="muted">데이터를 불러오지 못했어.</p>`;
    els.myStandingCard.innerHTML = `<p class="muted">순위 정보를 불러오지 못했어.</p>`;
  }
}

function setStandingsOpen(next) {
  state.standingsOpen = next;
  els.fullStandingsWrap.classList.toggle('collapsed', !next);
  els.toggleStandingsBtn.setAttribute('aria-expanded', String(next));
  els.toggleStandingsBtn.textContent = next ? '▾' : '▸';
}

function setRecentOpen(next) {
  state.recentOpen = next;
  els.recentContent.classList.toggle('collapsed', !next);
  els.recentContent.classList.toggle('open', next);
  els.toggleRecentBtn.setAttribute('aria-expanded', String(next));
  els.toggleRecentBtn.textContent = next ? '▾' : '▸';
}

function bindEvents() {
  els.teamSelect.addEventListener('change', (event) => {
    state.myTeam = event.target.value;
    localStorage.setItem('myTeam', state.myTeam);
    applyTeamAccent();
    fetchDashboard();
  });

  els.themeToggle.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', state.theme);
    applyTheme();
  });

  document.querySelectorAll('#recentRangeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => setRecentLimit(Number(btn.dataset.limit)));
  });

  document.querySelectorAll('#writeModeTabs .segmented-btn').forEach(btn => {
    btn.addEventListener('click', () => setWriteMode(btn.dataset.mode));
  });

  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById(btn.dataset.scroll).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  els.softenBtn.addEventListener('click', softenText);
  els.previewBtn.addEventListener('click', buildNarrative);
  els.toggleStandingsBtn.addEventListener('click', () => setStandingsOpen(!state.standingsOpen));
  els.toggleRecentBtn.addEventListener('click', () => setRecentOpen(!state.recentOpen));

  els.recentCalendar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-game-id]');
    if (!button) return;
    state.selectedGameId = button.dataset.gameId;
    renderSelectedGame();
  });

  els.recentGamesList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-game-id]');
    if (!card) return;
    state.selectedGameId = card.dataset.gameId;
    renderSelectedGame();
    document.getElementById('recentSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function init() {
  populateTeams();
  applyTheme();
  applyTeamAccent();
  setWriteMode('template');
  setStandingsOpen(false);
  setRecentOpen(true);
  bindEvents();
  fetchDashboard();
}

init();
