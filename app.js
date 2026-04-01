const KBO_TEAMS = [
  'KIA 타이거즈', '삼성 라이온즈', 'LG 트윈스', '두산 베어스', 'KT 위즈',
  'SSG 랜더스', '롯데 자이언츠', '한화 이글스', 'NC 다이노스', '키움 히어로즈'
];

const STORAGE_KEY = 'baseball_note_entries_v2';
const SETTINGS_KEY = 'baseball_note_settings_v1';

const state = {
  mode: 'template',
  softenMode: 'gpt',
  selectedVariant: '',
  currentVariants: [],
  dashboard: { games: [], standings: [], updatedAt: null },
  myTeam: '',
  nickname: ''
};

const demoDashboard = {
  updatedAt: new Date().toISOString(),
  games: [
    { date: '2026-04-02', home: 'LG 트윈스', away: '두산 베어스', status: '경기 종료', score: '5 : 3' },
    { date: '2026-04-02', home: 'KIA 타이거즈', away: '삼성 라이온즈', status: '경기 종료', score: '4 : 6' },
    { date: '2026-04-02', home: 'KT 위즈', away: '롯데 자이언츠', status: '경기 예정', score: '-' },
    { date: '2026-04-02', home: '한화 이글스', away: 'SSG 랜더스', status: '경기 종료', score: '2 : 1' },
    { date: '2026-04-02', home: 'NC 다이노스', away: '키움 히어로즈', status: '경기 종료', score: '7 : 7' }
  ],
  standings: [
    { rank: 1, team: 'LG 트윈스', win: 8, lose: 3, draw: 0, pct: '0.727', gb: '-' },
    { rank: 2, team: 'KIA 타이거즈', win: 7, lose: 4, draw: 0, pct: '0.636', gb: '1.0' },
    { rank: 3, team: '한화 이글스', win: 7, lose: 4, draw: 0, pct: '0.636', gb: '1.0' },
    { rank: 4, team: '삼성 라이온즈', win: 6, lose: 5, draw: 0, pct: '0.545', gb: '2.0' },
    { rank: 5, team: '롯데 자이언츠', win: 5, lose: 5, draw: 1, pct: '0.500', gb: '2.5' },
    { rank: 6, team: '두산 베어스', win: 5, lose: 6, draw: 0, pct: '0.455', gb: '3.0' },
    { rank: 7, team: 'SSG 랜더스', win: 4, lose: 6, draw: 1, pct: '0.400', gb: '3.5' },
    { rank: 8, team: 'KT 위즈', win: 4, lose: 7, draw: 0, pct: '0.364', gb: '4.0' },
    { rank: 9, team: 'NC 다이노스', win: 3, lose: 7, draw: 1, pct: '0.300', gb: '4.5' },
    { rank: 10, team: '키움 히어로즈', win: 2, lose: 8, draw: 1, pct: '0.200', gb: '5.5' }
  ]
};

const el = (id) => document.getElementById(id);

function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function populateTeamSelects() {
  const myTeamSelect = el('myTeamSelect');
  const teamSelect = el('team');
  [myTeamSelect, teamSelect].forEach((select) => {
    select.innerHTML = '<option value="">팀 선택</option>' + KBO_TEAMS.map((team) => `<option value="${team}">${team}</option>`).join('');
  });
  updateOpponentOptions(state.myTeam || teamSelect.value || '');
}

function updateOpponentOptions(selectedTeam) {
  const opponent = el('opponent');
  const options = KBO_TEAMS.filter((team) => team !== selectedTeam);
  opponent.innerHTML = '<option value="">상대 팀 선택</option>' + options.map((team) => `<option value="${team}">${team}</option>`).join('');
}

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function applySettingsToUI() {
  el('myTeamSelect').value = state.myTeam;
  el('myNickname').value = state.nickname;
  el('team').value = state.myTeam;
  updateOpponentOptions(state.myTeam);
  renderMyTeamSummary();
}

function renderMyTeamSummary() {
  const summary = el('myTeamSummary');
  if (!state.myTeam) {
    summary.textContent = '아직 마이팀이 설정되지 않았어요.';
    return;
  }
  summary.textContent = `${state.nickname || '기록자'}님의 마이팀은 ${state.myTeam}입니다. 아래 경기와 기록 화면이 이 팀 기준으로 맞춰집니다.`;
}

function selectedEmotion() {
  const active = document.querySelector('.emotion.active');
  return active ? active.textContent.trim() : '감정 미선택';
}

function bindEmotionButtons() {
  document.querySelectorAll('.emotion').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.emotion').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
    });
  });
}

function bindModeButtons() {
  document.querySelectorAll('.mode-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.mode-toggle').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.mode = button.dataset.mode;
      el('templateFields').classList.toggle('hidden', state.mode !== 'template');
      el('freeformField').classList.toggle('hidden', state.mode !== 'freeform');
    });
  });
}

function bindSoftenTabs() {
  document.querySelectorAll('#softenTabs button').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#softenTabs button').forEach((b) => b.classList.remove('active'));
      button.classList.add('active');
      state.softenMode = button.dataset.soften;
      el('softenModeNote').textContent = state.softenMode === 'gpt'
        ? 'GPT 순화가 먼저 시도되고, 서버 설정이 없거나 실패하면 자동으로 로컬 순화 결과로 넘어가요.'
        : '로컬 순화는 API 없이 바로 동작해요.';
    });
  });
}

function formatDateLabel(dateString) {
  if (!dateString) return '날짜 미정';
  return dateString;
}

function parseScore(score) {
  if (!score || !score.includes(':')) return null;
  const [left, right] = score.split(':').map((v) => Number(v.trim()));
  if (Number.isNaN(left) || Number.isNaN(right)) return null;
  return [left, right];
}

function getGamePerspective(game, myTeam) {
  const isHome = game.home === myTeam;
  const opponent = isHome ? game.away : game.home;
  const rawScore = parseScore(game.score);
  let result = '예정';
  if (rawScore && game.status.includes('종료')) {
    const [homeScore, awayScore] = rawScore;
    const myScore = isHome ? homeScore : awayScore;
    const oppScore = isHome ? awayScore : homeScore;
    result = myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무';
  }
  return { opponent, result };
}

function renderStandings(standings) {
  const body = el('standingsBody');
  body.innerHTML = standings.map((row) => `
    <tr class="${row.team === state.myTeam ? 'table-highlight' : ''}">
      <td>${row.rank}</td>
      <td>${escapeHtml(row.team)}</td>
      <td>${row.win}</td>
      <td>${row.lose}</td>
      <td>${row.draw}</td>
      <td>${escapeHtml(row.pct || '-')}</td>
      <td>${escapeHtml(row.gb || '-')}</td>
    </tr>
  `).join('');
}

function renderMyTeamGames() {
  const list = el('myTeamGamesList');
  const quick = el('gameQuickSelect');
  if (!state.myTeam) {
    list.innerHTML = '<div class="result-line">마이팀을 먼저 설정해 주세요.</div>';
    quick.innerHTML = '<option value="">마이팀 설정 후 선택 가능</option>';
    return;
  }

  const filtered = state.dashboard.games.filter((game) => game.home === state.myTeam || game.away === state.myTeam);
  if (!filtered.length) {
    list.innerHTML = `<div class="result-line">${escapeHtml(state.myTeam)} 경기 데이터가 아직 없어요.</div>`;
    quick.innerHTML = '<option value="">선택 가능한 경기가 없어요</option>';
    return;
  }

  list.innerHTML = filtered.map((game, index) => {
    const info = getGamePerspective(game, state.myTeam);
    const badgeClass = info.result === '승' ? 'win' : info.result === '패' ? 'loss' : info.result === '무' ? 'draw' : '';
    return `
      <article class="game-item ${index === 0 ? 'active' : ''}" data-game-index="${index}">
        <div class="game-top">
          <div class="game-title">${escapeHtml(state.myTeam)} vs ${escapeHtml(info.opponent)}</div>
          <div class="result-badge ${badgeClass}">${escapeHtml(info.result)}</div>
        </div>
        <div class="game-sub">${escapeHtml(formatDateLabel(game.date))} · ${escapeHtml(game.status)} · ${escapeHtml(game.score)}</div>
      </article>
    `;
  }).join('');

  quick.innerHTML = '<option value="">내 팀 경기 선택</option>' + filtered.map((game, index) => {
    const info = getGamePerspective(game, state.myTeam);
    return `<option value="${index}">${game.date} · ${state.myTeam} vs ${info.opponent} · ${info.result} (${game.score})</option>`;
  }).join('');

  quick.onchange = () => applyQuickGame(filtered[quick.value]);
  const firstGame = filtered[0];
  if (firstGame) {
    applyQuickGame(firstGame, false);
  }
}

function applyQuickGame(game, scroll = false) {
  if (!game || !state.myTeam) return;
  const info = getGamePerspective(game, state.myTeam);
  el('team').value = state.myTeam;
  updateOpponentOptions(state.myTeam);
  el('opponent').value = info.opponent;
  el('gameDate').value = game.date;
  el('gameResultMemo').value = `${state.myTeam} ${game.score} ${info.opponent} / ${info.result === '예정' ? '경기 전' : info.result}`;
  if (scroll) {
    document.getElementById('record').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadDashboard() {
  const modeTag = el('dataModeTag');
  const lastUpdated = el('lastUpdatedTag');
  const status = el('dashboardStatus');
  try {
    const response = await fetch('/api/kbo-dashboard');
    if (!response.ok) throw new Error('API not ready');
    const data = await response.json();
    state.dashboard = { games: data.games || [], standings: data.standings || [], updatedAt: data.updatedAt || null };
    modeTag.textContent = 'API 연결';
    status.textContent = '실제 API 응답을 불러왔어요. 마이팀 기준으로 경기만 필터링해서 보여줘요.';
  } catch {
    state.dashboard = demoDashboard;
    modeTag.textContent = '데모 모드';
    status.textContent = 'API가 없거나 실패해서 데모 데이터로 보여주고 있어요.';
  }
  lastUpdated.textContent = state.dashboard.updatedAt ? `업데이트 ${String(state.dashboard.updatedAt).slice(0, 16).replace('T', ' ')}` : '업데이트 정보 없음';
  renderStandings(state.dashboard.standings);
  renderMyTeamGames();
}

function buildTemplateParagraphs() {
  const segments = [];
  const summary = el('summary').value.trim();
  const best = el('bestScene').value.trim();
  const sad = el('sadScene').value.trim();
  const rule = el('confusingRule').value.trim();
  const next = el('nextGame').value.trim();
  const resultMemo = el('gameResultMemo').value.trim();
  const team = el('team').value || '응원 팀';
  const opponent = el('opponent').value || '상대 팀';
  const emotion = selectedEmotion();

  const opener = summary || `${team}의 오늘 경기는 ${emotion}이라는 감정이 가장 크게 남는 경기였다.`;
  segments.push(opener);
  if (resultMemo) segments.push(`경기 결과를 한 줄로 정리하면 ${resultMemo}였다.`);
  if (best) segments.push(`가장 좋았던 장면은 ${best.replace(/[.。]$/,'')}였다.`);
  if (sad) segments.push(`반대로 가장 아쉬웠던 장면은 ${sad.replace(/[.。]$/,'')} 쪽이었다.`);
  if (rule) segments.push(`중간에 ${rule.replace(/[.。]$/,'')} 부분은 다시 확인해보고 싶은 포인트로 남았다.`);
  if (next) segments.push(`다음 ${team} vs ${opponent} 경기에서는 ${next.replace(/[.。]$/,'')} 부분을 더 기대하게 된다.`);
  return segments.join(' ');
}

function buildFreeformParagraph() {
  const free = el('freeText').value.trim();
  const resultMemo = el('gameResultMemo').value.trim();
  const team = el('team').value || '응원 팀';
  const opponent = el('opponent').value || '상대 팀';
  const emotion = selectedEmotion();
  const intro = `${team}와 ${opponent}의 경기를 본 뒤 느낀 감정은 ${emotion} 쪽에 가까웠다.`;
  const resultLine = resultMemo ? `경기 결과를 먼저 적어두면 ${resultMemo}였다.` : '';
  return [intro, resultLine, free].filter(Boolean).join(' ');
}

function buildPreviewData() {
  const team = el('team').value || '팀 미선택';
  const date = el('gameDate').value || '날짜 미입력';
  const opponent = el('opponent').value || '상대 팀 미입력';
  const visibility = el('visibility').value;
  const emotion = selectedEmotion();
  const nickname = state.nickname || '기록자';
  const title = `${team} vs ${opponent}`;
  const paragraph = state.mode === 'template' ? buildTemplateParagraphs() : buildFreeformParagraph();
  return { team, date, opponent, visibility, emotion, nickname, title, paragraph };
}

function renderPreview() {
  const preview = buildPreviewData();
  el('previewArea').innerHTML = `
    <div class="preview-meta">
      <span class="tag">${escapeHtml(preview.nickname)}</span>
      <span class="tag">${escapeHtml(preview.team)}</span>
      <span class="tag">${escapeHtml(preview.date)}</span>
      <span class="tag">${escapeHtml(preview.emotion)}</span>
      <span class="tag">${escapeHtml(preview.visibility)}</span>
    </div>
    <h5>${escapeHtml(preview.title)}</h5>
    <div class="content">${escapeHtml(preview.paragraph || '아직 작성된 내용이 부족해요.')}</div>
  `;
}

function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function renderSavedItems() {
  const container = el('savedItems');
  const entries = getEntries();
  if (!entries.length) {
    container.innerHTML = '<div class="result-line">아직 저장된 기록이 없습니다.</div>';
    return;
  }
  container.innerHTML = entries.slice().reverse().map((entry) => `
    <article class="saved-item">
      <strong>${escapeHtml(entry.title)}</strong>
      <div class="preview-meta" style="margin: 8px 0;">
        <span class="tag">${escapeHtml(entry.date)}</span>
        <span class="tag">${escapeHtml(entry.emotion)}</span>
        <span class="tag">${escapeHtml(entry.visibility)}</span>
      </div>
      <div class="muted-note">${escapeHtml(entry.paragraph)}</div>
    </article>
  `).join('');
}

const harshPatterns = [
  [/씨발+|시발+|ㅅㅂ+|병신+|ㅂㅅ+|좆같+|존나+|개같+|개빡+|개열받+|꺼져+|미친놈+|돌았냐+|미쳤냐+/gi, ''],
  [/개답답|개노답|노답|답없네|답이 없네/gi, '많이 답답했다'],
  [/열받|빡치|빡침|화남|환장/gi, '감정이 크게 올라왔다'],
  [/망했|말아먹|터졌네/gi, '흐름이 무너졌다'],
  [/못하네|못하냐|왜 이래/gi, '경기력이 아쉬웠다'],
  [/최악/gi, '많이 아쉬웠다'],
  [/어이없|황당/gi, '이해하기 어려웠다'],
  [/ㅋㅋ+|ㅎ+/g, ' ']
];

const topicMap = [
  { keys: ['감독', '교체', '라인업', '작전'], subject: '작전 선택', detail: '운영 타이밍' },
  { keys: ['불펜', '투수', '볼배합', '제구', '사사구'], subject: '투수 운영', detail: '볼배합과 제구' },
  { keys: ['수비', '실책', '송구', '포구'], subject: '수비 집중력', detail: '수비 처리' },
  { keys: ['타선', '타격', '삼진', '득점권', '찬스'], subject: '타선 연결', detail: '득점 기회 처리' },
  { keys: ['주루', '도루', '베이스러닝'], subject: '주루 판단', detail: '베이스러닝 선택' },
  { keys: ['심판', '판정', '비디오판독'], subject: '판정 이해', detail: '판정 기준' }
];

function detectTopic(text) {
  return topicMap.find((topic) => topic.keys.some((key) => text.includes(key))) || { subject: '경기 흐름', detail: '흐름 관리' };
}

function normalizeSentence(text) {
  let result = text.trim();
  harshPatterns.forEach(([pattern, replacement]) => {
    result = result.replace(pattern, replacement);
  });
  return result.replace(/\s{2,}/g, ' ').replace(/[!~]+/g, '').trim();
}

function buildLocalVariants(text) {
  const original = text.trim();
  if (!original) return [];
  const topic = detectTopic(original);
  const cleaned = normalizeSentence(original);
  return [
    {
      label: '차분하게',
      text: `오늘 ${topic.subject} 부분에서 아쉬움이 크게 남았다. ${cleaned || `${topic.detail} 쪽에서 보완이 필요해 보였다.`}`.trim()
    },
    {
      label: '기록형',
      text: `경기 기록으로 남기면 ${topic.subject}에서 흐름을 내준 장면이 가장 먼저 떠오른다. ${cleaned || `${topic.detail} 장면이 특히 크게 남았다.`}`.trim()
    },
    {
      label: '분석형',
      text: `정리하면 ${topic.subject} 쪽에서 개선이 필요해 보였다. ${cleaned || `${topic.detail} 판단이 다음 경기의 포인트가 될 것 같다.`}`.trim()
    }
  ];
}

async function buildGPTVariants(text) {
  const response = await fetch('/api/soften', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, variants: ['차분하게', '기록형', '분석형'] })
  });
  if (!response.ok) throw new Error('GPT 순화 실패');
  const data = await response.json();
  if (!Array.isArray(data.variants)) throw new Error('응답 형식 오류');
  return data.variants;
}

function renderVariants(original, variants, sourceLabel) {
  const helper = el('helperResult');
  if (!original.trim()) {
    helper.innerHTML = '<div class="result-line">문장을 먼저 입력해 주세요.</div>';
    state.currentVariants = [];
    state.selectedVariant = '';
    return;
  }
  state.currentVariants = variants;
  state.selectedVariant = variants[0]?.text || '';
  helper.innerHTML = `
    <div class="result-line">
      <strong>원문</strong>
      <div style="margin-top: 6px;">${escapeHtml(original)}</div>
      <div class="small-note" style="margin-top: 8px;">${escapeHtml(sourceLabel)}</div>
    </div>
  ` + variants.map((variant, index) => `
    <article class="variant-card ${index === 0 ? 'selected' : ''}" data-variant-index="${index}">
      <div class="variant-meta">${escapeHtml(variant.label)}</div>
      <div style="margin-top: 8px; line-height: 1.7;">${escapeHtml(variant.text)}</div>
      <button type="button">이 문장 선택</button>
    </article>
  `).join('');

  helper.querySelectorAll('.variant-card').forEach((card) => {
    card.addEventListener('click', () => {
      helper.querySelectorAll('.variant-card').forEach((item) => item.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedVariant = state.currentVariants[Number(card.dataset.variantIndex)]?.text || '';
    });
  });
}

async function runSoften() {
  const original = el('toneInput').value.trim();
  if (!original) {
    renderVariants('', [], '');
    return;
  }

  if (state.softenMode === 'local') {
    renderVariants(original, buildLocalVariants(original), '로컬 순화 결과');
    return;
  }

  try {
    const variants = await buildGPTVariants(original);
    renderVariants(original, variants, 'GPT 순화 결과');
  } catch {
    renderVariants(original, buildLocalVariants(original), 'GPT 연결에 실패해 로컬 순화로 대신 보여줘요');
  }
}

function useSelectedVariant() {
  if (!state.selectedVariant) return;
  if (state.mode === 'template') {
    const current = el('sadScene').value.trim();
    el('sadScene').value = current ? `${current}\n${state.selectedVariant}` : state.selectedVariant;
  } else {
    const current = el('freeText').value.trim();
    el('freeText').value = current ? `${current}\n${state.selectedVariant}` : state.selectedVariant;
  }
}

function saveRecord() {
  const preview = buildPreviewData();
  const entries = getEntries();
  entries.push(preview);
  saveEntries(entries);
  renderSavedItems();
  renderPreview();
  alert('기록이 현재 기기에 저장되었어요.');
}

function initMyTeamEvents() {
  el('myTeamSelect').addEventListener('change', (e) => {
    const team = e.target.value;
    el('team').value = team;
    updateOpponentOptions(team);
  });

  el('saveMyTeamBtn').addEventListener('click', () => {
    state.myTeam = el('myTeamSelect').value;
    state.nickname = el('myNickname').value.trim();
    saveSettings({ myTeam: state.myTeam, nickname: state.nickname });
    applySettingsToUI();
    renderStandings(state.dashboard.standings);
    renderMyTeamGames();
  });

  el('resetMyTeamBtn').addEventListener('click', () => {
    state.myTeam = '';
    state.nickname = '';
    saveSettings({});
    applySettingsToUI();
    renderStandings(state.dashboard.standings);
    renderMyTeamGames();
  });
}

function initCoreEvents() {
  el('team').addEventListener('change', (e) => updateOpponentOptions(e.target.value));
  el('refreshDashboardBtn').addEventListener('click', loadDashboard);
  el('previewBtn').addEventListener('click', renderPreview);
  el('saveBtn').addEventListener('click', saveRecord);
  el('softenBtn').addEventListener('click', runSoften);
  el('useSoftenedBtn').addEventListener('click', useSelectedVariant);
}

function init() {
  const settings = getSettings();
  state.myTeam = settings.myTeam || '';
  state.nickname = settings.nickname || '';
  populateTeamSelects();
  applySettingsToUI();
  bindEmotionButtons();
  bindModeButtons();
  bindSoftenTabs();
  initMyTeamEvents();
  initCoreEvents();
  renderSavedItems();
  loadDashboard();
}

init();
