const TEAM_OPTIONS = [
  { value: 'LG', label: 'LG' },
  { value: 'KIA', label: 'KIA' },
  { value: 'DOOSAN', label: '두산' },
  { value: 'SAMSUNG', label: '삼성' },
  { value: 'LOTTE', label: '롯데' },
  { value: 'NC', label: 'NC' },
  { value: 'KT', label: 'KT' },
  { value: 'HANWHA', label: '한화' },
  { value: 'SSG', label: 'SSG' },
  { value: 'KIWOOM', label: '키움' }
];

const TEAM_THEME = {
  LG: '#A50034',
  KIA: '#EA0029',
  DOOSAN: '#131230',
  SAMSUNG: '#074CA1',
  LOTTE: '#041E42',
  NC: '#315288',
  KT: '#111111',
  HANWHA: '#FF6600',
  SSG: '#CE0E2D',
  KIWOOM: '#570514'
};

const state = {
  myTeam: localStorage.getItem('myTeam') || 'LG',
  theme: localStorage.getItem('theme') || 'light',
  recentLimit: Number(localStorage.getItem('recentLimit') || 5),
  writeMode: 'template',
  dashboard: null
};

const els = {
  teamSelect: document.getElementById('myTeamSelect'),
  heroTeam: document.getElementById('heroTeam'),
  themeToggle: document.getElementById('themeToggle'),
  todayStatus: document.getElementById('todayStatus'),
  todayGameCard: document.getElementById('todayGameCard'),
  myStandingCard: document.getElementById('myStandingCard'),
  recentGamesList: document.getElementById('recentGamesList'),
  standingsTable: document.getElementById('standingsTable'),
  softenResult: document.getElementById('softenResult'),
  previewResult: document.getElementById('previewResult'),
  softenBtn: document.getElementById('softenBtn'),
  previewBtn: document.getElementById('previewBtn'),
  templateFields: document.getElementById('templateFields'),
  freeFields: document.getElementById('freeFields')
};

function applyTheme() {
  document.body.dataset.theme = state.theme === 'dark' ? 'dark' : 'light';
  els.themeToggle.textContent = state.theme === 'dark' ? '화이트' : '나이트';
}

function applyTeamAccent() {
  const accent = TEAM_THEME[state.myTeam] || '#111111';
  document.documentElement.style.setProperty('--accent', accent);
  els.heroTeam.textContent = TEAM_OPTIONS.find(team => team.value === state.myTeam)?.label || state.myTeam;
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
      <span class="meta-chip">${game.stadium}</span>
      <span class="meta-chip">${game.time}</span>
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
      <div class="standing-meta">${standing.streak}</div>
    </div>
  `;
}

function renderRecentGames(games) {
  if (!games.length) {
    els.recentGamesList.innerHTML = `<p class="muted">최근 경기 데이터를 가져오지 못했어요.</p>`;
    return;
  }

  els.recentGamesList.innerHTML = games.map(game => {
    const cls = game.result === '승' ? 'win' : game.result === '패' ? 'lose' : 'draw';
    return `
      <article class="game-card">
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
          <span class="meta-chip">${game.stadium}</span>
          <span class="meta-chip">${game.time}</span>
          <span class="meta-chip">상대 ${game.opponentKo}</span>
        </div>
      </article>
    `;
  }).join('');
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
        <div class="standing-meta">${item.wins}승 ${item.losses}패 ${item.draws}무 · 승률 ${item.pct}</div>
      </div>
      <div class="standing-meta">${item.streak}</div>
    </div>
  `).join('');
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
    els.previewResult.textContent = `${els.heroTeam.textContent} 경기를 보고 남긴 오늘의 기록이다. ${text.replace(/\n+/g, ' ')} 이 감정은 단순한 반응이 아니라 다음 경기를 더 잘 보기 위한 관찰로 남겨두고 싶다.`;
  } else {
    const feeling = document.getElementById('feeling').value.trim();
    const oneLine = document.getElementById('oneLine').value.trim();
    const goodPoint = document.getElementById('goodPoint').value.trim();
    const badPoint = document.getElementById('badPoint').value.trim();
    const nextPoint = document.getElementById('nextPoint').value.trim();

    els.previewResult.textContent = `오늘 ${els.heroTeam.textContent} 경기를 보며 전체적으로 ${feeling}는 감정이 강했다. 한 줄로 정리하면 ${oneLine || '흐름을 더 지켜볼 필요가 있는 경기'}였다. 특히 ${goodPoint || '좋은 장면은 아직 더 적어둘 부분이 있다'}. 반대로 ${badPoint || '아쉬운 장면도 더 세밀하게 기록할 필요가 있다'}. 다음 경기에서는 ${nextPoint || '경기 운영과 집중력을 조금 더 보고 싶다'}는 기대를 남긴다.`;
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
    const alternatives = (data.alternatives || []).map(item => `• ${item}`).join('\n');
    els.softenResult.textContent = `${data.softened || '정리 결과가 없어요.'}\n\n${alternatives}`;
    els.softenResult.classList.remove('muted');
  } catch (error) {
    els.softenResult.textContent = '순화 도우미 연결에 실패했어.';
    els.softenResult.classList.remove('muted');
  } finally {
    els.softenBtn.disabled = false;
    els.softenBtn.textContent = 'GPT로 욕 순화하기';
  }
}

async function fetchDashboard() {
  els.todayStatus.textContent = '불러오는 중';
  els.todayGameCard.className = 'game-focus skeleton-block';
  els.myStandingCard.className = 'standing-focus skeleton-block';
  els.recentGamesList.innerHTML = '';
  els.standingsTable.innerHTML = '';

  try {
    const response = await fetch(`/api/kbo-dashboard?team=${state.myTeam}&limit=${state.recentLimit}`);
    const data = await response.json();
    state.dashboard = data;
    if (data.themeColor) {
      document.documentElement.style.setProperty('--accent', data.themeColor);
    } else {
      applyTeamAccent();
    }
    els.todayGameCard.className = 'game-focus';
    els.myStandingCard.className = 'standing-focus';
    renderTodayGame(data.myTodayGame);
    renderMyStanding(data.myStanding);
    renderRecentGames(data.recentGames || []);
    renderStandings(data.standings || []);
    els.todayStatus.textContent = data.source === 'official-kbo' ? '공식 KBO 연동' : '연동 실패';
  } catch (error) {
    els.todayStatus.textContent = '연동 실패';
    els.todayGameCard.className = 'game-focus';
    els.myStandingCard.className = 'standing-focus';
    els.todayGameCard.innerHTML = `<p class="muted">데이터를 불러오지 못했어.</p>`;
    els.myStandingCard.innerHTML = `<p class="muted">순위 정보를 불러오지 못했어.</p>`;
  }
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
}

function init() {
  populateTeams();
  applyTheme();
  applyTeamAccent();
  bindEvents();
  setWriteMode('template');
  setRecentLimit(state.recentLimit);
}

init();
