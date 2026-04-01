const STORAGE_KEY = 'baseball-note-entries-v2';
    const KBO_TEAMS = ['LG 트윈스', 'KIA 타이거즈', '삼성 라이온즈', '두산 베어스', 'SSG 랜더스', 'KT 위즈', '한화 이글스', '롯데 자이언츠', 'NC 다이노스', '키움 히어로즈'];

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;
    document.getElementById('gameDate').value = todayStr;

    const demoDashboard = {
      source: 'demo',
      lastUpdated: '샘플 데이터',
      games: [
        { date: todayStr, away: 'KIA 타이거즈', awayScore: 2, home: 'LG 트윈스', homeScore: 7, state: 'FINAL', stadium: '잠실' },
        { date: todayStr, away: 'KT 위즈', awayScore: 14, home: '한화 이글스', homeScore: 11, state: 'FINAL', stadium: '대전' },
        { date: todayStr, away: '롯데 자이언츠', awayScore: 4, home: 'NC 다이노스', homeScore: 5, state: 'FINAL', stadium: '창원' },
        { date: todayStr, away: '두산 베어스', awayScore: 3, home: '삼성 라이온즈', homeScore: 13, state: 'FINAL', stadium: '대구' },
        { date: todayStr, away: '키움 히어로즈', awayScore: 11, home: 'SSG 랜더스', homeScore: 2, state: 'FINAL', stadium: '문학' }
      ],
      standings: [
        { rank: 1, team: 'KT 위즈', w: 4, l: 0, d: 0, pct: '1.000', gb: '0.0' },
        { rank: 2, team: 'SSG 랜더스', w: 3, l: 1, d: 0, pct: '.750', gb: '1.0' },
        { rank: 2, team: 'NC 다이노스', w: 3, l: 1, d: 0, pct: '.750', gb: '1.0' },
        { rank: 4, team: '한화 이글스', w: 2, l: 2, d: 0, pct: '.500', gb: '2.0' },
        { rank: 4, team: '롯데 자이언츠', w: 2, l: 2, d: 0, pct: '.500', gb: '2.0' },
        { rank: 6, team: '두산 베어스', w: 1, l: 2, d: 1, pct: '.333', gb: '2.5' },
        { rank: 6, team: '삼성 라이온즈', w: 1, l: 2, d: 1, pct: '.333', gb: '2.5' },
        { rank: 8, team: 'KIA 타이거즈', w: 1, l: 3, d: 0, pct: '.250', gb: '3.0' },
        { rank: 8, team: 'LG 트윈스', w: 1, l: 3, d: 0, pct: '.250', gb: '3.0' },
        { rank: 8, team: '키움 히어로즈', w: 1, l: 3, d: 0, pct: '.250', gb: '3.0' }
      ]
    };

    let currentDashboard = demoDashboard;
    let currentMode = 'template';
    let softenMode = 'local';
    let currentVariants = [];
    let selectedVariant = '';
    let animationFrame = null;

    function escapeHtml(text = '') {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function populateTeams() {
      const teamSelect = document.getElementById('team');
      const opponentSelect = document.getElementById('opponent');
      teamSelect.innerHTML = KBO_TEAMS.map((team) => `<option>${team}</option>`).join('');

      function renderOpponents() {
        const teamValue = teamSelect.value;
        const others = KBO_TEAMS.filter((team) => team !== teamValue);
        opponentSelect.innerHTML = others.map((team) => `<option>${team}</option>`).join('');
      }

      teamSelect.addEventListener('change', renderOpponents);
      renderOpponents();
    }

    populateTeams();

    const modeButtons = document.querySelectorAll('.mode-toggle');
    const templateFields = document.getElementById('templateFields');
    const freeformField = document.getElementById('freeformField');
    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        modeButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        currentMode = button.dataset.mode;
        templateFields.classList.toggle('hidden', currentMode !== 'template');
        freeformField.classList.toggle('hidden', currentMode !== 'freeform');
      });
    });

    const emotionButtons = document.querySelectorAll('.emotion');
    emotionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        emotionButtons.forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
      });
    });

    document.querySelectorAll('#softenTabs button').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('#softenTabs button').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        softenMode = button.dataset.soften;
        document.getElementById('softenModeNote').innerHTML = softenMode === 'local'
          ? '로컬 순화는 파일만으로 바로 작동합니다. 욕설, 팀/감독/수비/불펜 같은 키워드를 보고 기록용 문장으로 바꿉니다.'
          : 'GPT 순화는 같은 도메인에 <code>/api/soften</code>가 있을 때 사용됩니다. 연결이 없으면 자동으로 로컬 순화로 대체됩니다.';
      });
    });

    function renderDashboard(data) {
      currentDashboard = data;
      const gamesList = document.getElementById('gamesList');
      const standingsBody = document.getElementById('standingsBody');
      const quickSelect = document.getElementById('gameQuickSelect');
      document.getElementById('dataModeTag').textContent = data.source === 'api' ? '실데이터' : '데모 모드';
      document.getElementById('dataModeTag').className = `tag ${data.source === 'api' ? 'good' : 'info'}`;
      document.getElementById('lastUpdatedTag').textContent = data.lastUpdated || '업데이트 정보 없음';
      document.getElementById('dashboardStatus').textContent = data.source === 'api'
        ? '연결된 백엔드에서 실제 경기 데이터와 순위표를 불러왔습니다.'
        : '현재는 샘플 데이터가 보이고 있습니다. 나중에 백엔드를 붙이면 이 자리에 실제 경기 결과와 순위가 들어옵니다.';

      gamesList.innerHTML = data.games.map((game, index) => `
        <article class="game-card">
          <div class="game-head">
            <strong>${escapeHtml(game.date || todayStr)} · ${escapeHtml(game.stadium || '-')}</strong>
            <span class="tag ${game.state === 'FINAL' ? 'good' : 'warn'}">${escapeHtml(game.state || '예정')}</span>
          </div>
          <div class="scoreline">
            <div class="team-side">${escapeHtml(game.away)}</div>
            <div class="score">${game.awayScore ?? '-'} : ${game.homeScore ?? '-'}</div>
            <div class="team-side">${escapeHtml(game.home)}</div>
          </div>
          <div class="small-note" style="margin-top:10px;">기록에 넣기용 번호: ${index + 1}</div>
        </article>
      `).join('');

      standingsBody.innerHTML = data.standings.map((row) => `
        <tr>
          <td>${escapeHtml(String(row.rank))}</td>
          <td>${escapeHtml(row.team)}</td>
          <td>${escapeHtml(String(row.w))}</td>
          <td>${escapeHtml(String(row.l))}</td>
          <td>${escapeHtml(String(row.d))}</td>
          <td>${escapeHtml(String(row.pct))}</td>
          <td>${escapeHtml(String(row.gb))}</td>
        </tr>
      `).join('');

      quickSelect.innerHTML = '<option value="">오늘 경기 선택</option>' + data.games.map((game, index) => `
        <option value="${index}">${escapeHtml(game.away)} vs ${escapeHtml(game.home)} · ${escapeHtml(game.state || '')}</option>
      `).join('');
    }

    async function loadDashboard() {
      try {
        const response = await fetch(`/api/kbo/dashboard?date=${todayStr}`, { headers: { 'Accept': 'application/json' } });
        if (!response.ok) throw new Error('API 응답 실패');
        const data = await response.json();
        renderDashboard({ ...data, source: 'api' });
      } catch (error) {
        renderDashboard(demoDashboard);
      }
    }

    document.getElementById('refreshDashboardBtn').addEventListener('click', loadDashboard);

    document.getElementById('gameQuickSelect').addEventListener('change', (event) => {
      const idx = Number(event.target.value);
      if (Number.isNaN(idx) || !currentDashboard.games[idx]) return;
      const game = currentDashboard.games[idx];
      const teamSelect = document.getElementById('team');
      const opponentSelect = document.getElementById('opponent');

      if (KBO_TEAMS.includes(game.home)) {
        teamSelect.value = game.home;
      }
      teamSelect.dispatchEvent(new Event('change'));
      if (game.home === teamSelect.value && KBO_TEAMS.includes(game.away)) {
        opponentSelect.value = game.away;
      } else if (KBO_TEAMS.includes(game.home)) {
        opponentSelect.value = game.home;
      }
      document.getElementById('gameDate').value = game.date || todayStr;
      document.getElementById('gameResultMemo').value = `${game.away} ${game.awayScore ?? '-'} : ${game.homeScore ?? '-'} ${game.home} / ${game.state || ''}`;
      window.location.hash = '#record';
    });

    function selectedEmotion() {
      return document.querySelector('.emotion.active')?.textContent || '감정 미선택';
    }

    function buildTemplateContent() {
      return [
        `경기 결과 / 메모: ${document.getElementById('gameResultMemo').value || '미입력'}`,
        `\n한줄 요약\n${document.getElementById('summary').value || '미입력'}`,
        `\n좋았던 장면\n${document.getElementById('bestScene').value || '미입력'}`,
        `\n아쉬웠던 장면\n${document.getElementById('sadScene').value || '미입력'}`,
        `\n이해 안 갔던 룰 / 판정\n${document.getElementById('confusingRule').value || '미입력'}`,
        `\n다음 경기에서 보고 싶은 점\n${document.getElementById('nextGame').value || '미입력'}`
      ].join('\n');
    }

    function buildPreviewData() {
      const team = document.getElementById('team').value;
      const date = document.getElementById('gameDate').value;
      const opponent = document.getElementById('opponent').value || '상대팀 미입력';
      const visibility = document.getElementById('visibility').value;
      const title = `${team} vs ${opponent}`;
      const content = currentMode === 'template'
        ? buildTemplateContent()
        : `경기 결과 / 메모: ${document.getElementById('gameResultMemo').value || '미입력'}\n\n${document.getElementById('freeText').value || '내용 없음'}`;
      return { team, date, opponent, visibility, emotion: selectedEmotion(), title, content };
    }

    function renderPreview() {
      const previewArea = document.getElementById('previewArea');
      const data = buildPreviewData();
      previewArea.innerHTML = `
        <div class="preview-meta">
          <span class="tag">${escapeHtml(data.team)}</span>
          <span class="tag">${escapeHtml(data.date || '날짜 미입력')}</span>
          <span class="tag">${escapeHtml(data.emotion)}</span>
          <span class="tag">${escapeHtml(data.visibility)}</span>
        </div>
        <h5>${escapeHtml(data.title)}</h5>
        <div class="content">${escapeHtml(data.content)}</div>
      `;
    }

    document.getElementById('previewBtn').addEventListener('click', renderPreview);

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
      const container = document.getElementById('savedItems');
      const entries = getEntries();
      if (!entries.length) {
        container.innerHTML = '<div class="result-line muted-note">아직 저장된 기록이 없습니다.</div>';
        return;
      }
      container.innerHTML = entries.slice().reverse().map((entry) => `
        <article class="saved-item">
          <strong>${escapeHtml(entry.title)}</strong>
          <div class="preview-meta" style="margin:0 0 8px;">
            <span class="tag">${escapeHtml(entry.date)}</span>
            <span class="tag">${escapeHtml(entry.emotion)}</span>
            <span class="tag">${escapeHtml(entry.visibility)}</span>
          </div>
          <div class="muted-note" style="white-space:pre-wrap;">${escapeHtml(entry.content.slice(0, 180))}${entry.content.length > 180 ? '...' : ''}</div>
        </article>
      `).join('');
    }

    document.getElementById('saveBtn').addEventListener('click', () => {
      const data = buildPreviewData();
      const entries = getEntries();
      entries.push(data);
      saveEntries(entries);
      renderSavedItems();
      renderPreview();
      alert('기록이 현재 기기에 저장되었어요.');
    });

    const harshPatterns = [
      [/씨발+|시발+|ㅅㅂ+|ㅂㅅ+|병신+|좆같+|존나+|개같+|개빡+|개열받+|꺼져+|미친놈+|미쳤냐+|돌았냐+/gi, ''],
      [/개답답|개노답|답이 없네|답없네/gi, '많이 답답했다'],
      [/열받|빡치|빡침|화남|환장/gi, '감정이 크게 올라왔다'],
      [/망했|말아먹|터졌네/gi, '흐름이 무너졌다'],
      [/못하네|못하냐|못하냐고|왜 이래/gi, '경기력이 아쉬웠다'],
      [/최악/gi, '많이 아쉬운 경기였다'],
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
      const found = topicMap.find((topic) => topic.keys.some((key) => text.includes(key)));
      return found || { subject: '경기 흐름', detail: '흐름 관리' };
    }

    function normalizeSentence(text) {
      let result = text.trim();
      harshPatterns.forEach(([pattern, replacement]) => {
        result = result.replace(pattern, replacement);
      });
      result = result
        .replace(/\s{2,}/g, ' ')
        .replace(/[!~]+/g, '')
        .replace(/[?]{2,}/g, '?')
        .trim();
      return result;
    }

    function buildLocalVariants(originalText) {
      const raw = originalText.trim();
      if (!raw) return [];
      const clean = normalizeSentence(raw);
      const topic = detectTopic(raw);
      const hasStrongEmotion = /씨발|시발|개|열받|빡치|존나|좆|병신|노답/i.test(raw);
      const detailLine = clean && clean !== raw ? clean : `${topic.detail} 부분이 특히 아쉬웠다`;

      const variants = [
        {
          label: '차분하게',
          text: `오늘 ${topic.subject} 부분이 많이 아쉬웠고, 감정이 크게 올라온 경기였다. ${detailLine.endsWith('.') ? detailLine : detailLine + '.'}`
        },
        {
          label: '기록형',
          text: `오늘 경기를 기록해두면 ${topic.subject}에서 흐름을 내준 장면이 크게 남는다. ${detailLine.endsWith('.') ? detailLine : detailLine + '.'}`
        },
        {
          label: '분석형',
          text: `정리하면 ${topic.subject} 쪽에서 개선이 필요해 보였다. ${hasStrongEmotion ? '순간적으로 감정이 올라올 만한 장면이었다.' : '아쉬움이 남는 장면이었다.'}`
        }
      ];

      return variants.map((item) => ({ ...item, text: item.text.replace(/\s{2,}/g, ' ').trim() }));
    }

    async function buildAIVariants(originalText) {
      const response = await fetch('/api/soften', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: originalText,
          tone: 'baseball_journal',
          variants: ['차분하게', '기록형', '분석형']
        })
      });
      if (!response.ok) throw new Error('AI 순화 실패');
      const data = await response.json();
      if (!Array.isArray(data.variants)) throw new Error('AI 응답 형식 오류');
      return data.variants;
    }

    function renderVariants(original, variants, sourceLabel) {
      const helperResult = document.getElementById('helperResult');
      if (!original.trim()) {
        helperResult.innerHTML = '<div class="result-line">문장을 먼저 입력해 주세요.</div>';
        currentVariants = [];
        selectedVariant = '';
        return;
      }
      currentVariants = variants;
      selectedVariant = variants[0]?.text || '';
      helperResult.innerHTML = `
        <div class="result-line">
          <strong>원문</strong>
          <div>${escapeHtml(original)}</div>
          <div class="small-note" style="margin-top:8px;">${escapeHtml(sourceLabel)}</div>
        </div>
      ` + variants.map((variant, index) => `
        <button class="variant-card" type="button" data-variant-index="${index}" style="text-align:left; cursor:pointer; ${index === 0 ? 'border-color: rgba(89,195,255,0.34); background: rgba(89,195,255,0.08);' : ''}">
          <strong>${escapeHtml(variant.label)}</strong>
          <div>${escapeHtml(variant.text)}</div>
        </button>
      `).join('');

      helperResult.querySelectorAll('[data-variant-index]').forEach((button) => {
        button.addEventListener('click', () => {
          helperResult.querySelectorAll('[data-variant-index]').forEach((item) => {
            item.style.borderColor = 'rgba(255,255,255,0.08)';
            item.style.background = 'rgba(255,255,255,0.045)';
          });
          button.style.borderColor = 'rgba(89,195,255,0.34)';
          button.style.background = 'rgba(89,195,255,0.08)';
          const idx = Number(button.dataset.variantIndex);
          selectedVariant = currentVariants[idx]?.text || '';
        });
      });
    }

    document.getElementById('softenBtn').addEventListener('click', async () => {
      const input = document.getElementById('toneInput').value;
      if (!input.trim()) {
        renderVariants('', []);
        return;
      }
      if (softenMode === 'ai') {
        try {
          const variants = await buildAIVariants(input);
          renderVariants(input, variants, 'GPT 순화 결과');
          return;
        } catch (error) {
          const variants = buildLocalVariants(input);
          renderVariants(input, variants, 'GPT 연동이 없어 로컬 순화로 대체됨');
          return;
        }
      }
      const variants = buildLocalVariants(input);
      renderVariants(input, variants, '로컬 순화 결과');
    });

    document.getElementById('useSoftenedBtn').addEventListener('click', () => {
      if (!selectedVariant) return;
      if (currentMode === 'freeform') {
        const freeText = document.getElementById('freeText');
        freeText.value = `${freeText.value.trim()}${freeText.value.trim() ? '\n\n' : ''}${selectedVariant}`;
      } else {
        const sadScene = document.getElementById('sadScene');
        sadScene.value = `${sadScene.value.trim()}${sadScene.value.trim() ? '\n\n' : ''}${selectedVariant}`;
      }
    });

    const ruleData = {
      basic: {
        title: '기본 룰',
        lead: '기본은 타구가 어디에 떨어졌는지를 먼저 보면 돼요. 선 안쪽인지, 내야인지, 담장을 넘는지가 핵심입니다.',
        cards: [
          { title: '페어볼', desc: '1루선과 3루선 안쪽, 또는 선 위에 떨어지면 페어예요. 선 위는 파울이 아니라 페어로 봅니다.' },
          { title: '파울볼', desc: '타구가 파울선 바깥쪽에 떨어지거나 바깥으로 굴러가면 파울이에요. 그 순간 공은 살아 있지 않아요.' },
          { title: '내야땅볼', desc: '타구가 땅에 먼저 닿고 내야에서 처리되는 형태예요. 빠르면 내야안타가 될 수도 있고, 병살로 이어질 수도 있어요.' },
          { title: '홈런', desc: '페어 지역으로 날아간 타구가 담장을 넘어가면 홈런이에요. 파울 폴 안쪽을 지나가야 인정됩니다.' }
        ]
      },
      intermediate: {
        title: '중급 룰',
        lead: '기본 위치 감각이 잡히면, 주자 상황과 아웃 방식도 같이 이해하면 경기가 훨씬 재밌어져요.',
        cards: [
          { title: '포스아웃', desc: '다음 베이스로 반드시 가야 하는 주자는 베이스만 밟아도 아웃이 됩니다.' },
          { title: '태그아웃', desc: '의무 진루가 없는 주자는 수비가 공을 든 채 직접 태그해야 아웃이 돼요.' },
          { title: '희생플라이', desc: '외야 플라이 아웃 뒤 주자가 태그업해서 홈에 들어오면 득점이 인정됩니다.' },
          { title: '병살', desc: '한 플레이에서 아웃 두 개를 잡는 수비예요. 내야땅볼에서 자주 나옵니다.' }
        ]
      },
      advanced: {
        title: '심화 룰 / 기록',
        lead: '야구를 조금 더 깊게 보려면 판정, 운영, 기록 지표까지 같이 보는 게 좋아요.',
        cards: [
          { title: '인필드 플라이', desc: '주자를 속이는 고의 낙구를 막기 위해 특정 상황에서 자동 아웃을 선언하는 규정이에요.' },
          { title: '보크', desc: '투수가 주자를 속이는 부정 동작을 하면 주자가 한 베이스씩 진루합니다.' },
          { title: 'OPS', desc: '출루율과 장타율을 더한 값으로 타자의 공격 기여를 빠르게 보는 대표 지표예요.' },
          { title: 'WHIP', desc: '투수 1이닝당 허용한 주자 수를 보는 지표로, 투수 안정감을 확인할 때 자주 봅니다.' }
        ]
      }
    };

    function renderRules(tab) {
      const data = ruleData[tab];
      document.getElementById('ruleTitle').textContent = data.title;
      document.getElementById('ruleLead').textContent = data.lead;
      document.getElementById('ruleCards').innerHTML = data.cards.map((card) => `
        <article class="rule-card">
          <strong>${escapeHtml(card.title)}</strong>
          <span>${escapeHtml(card.desc)}</span>
        </article>
      `).join('');
    }

    document.querySelectorAll('#ruleTabs button').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('#ruleTabs button').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        renderRules(button.dataset.tab);
      });
    });

    const scenarios = {
      fair: {
        label: '페어볼',
        landing: { x: 228, y: 175 },
        curve1: { x: 200, y: 255 },
        curve2: { x: 215, y: 215 },
        badge: '페어',
        legend: [
          ['판정', '파울선 안쪽으로 떨어지면 페어예요.'],
          ['보는 포인트', '선 안쪽 / 선 위 / 외야 페어 지역'],
          ['왜 중요한지', '안타, 장타, 수비 처리 모두 이어질 수 있어요.']
        ]
      },
      foul: {
        label: '파울볼',
        landing: { x: 88, y: 206 },
        curve1: { x: 142, y: 248 },
        curve2: { x: 112, y: 220 },
        badge: '파울',
        legend: [
          ['판정', '파울선 바깥쪽으로 떨어지면 파울이에요.'],
          ['보는 포인트', '선 바깥 낙하지점'],
          ['왜 중요한지', '공이 살아 있지 않아서 주자 진루나 수비 플레이가 이어지지 않아요.']
        ]
      },
      grounder: {
        label: '내야땅볼',
        landing: { x: 190, y: 250 },
        curve1: { x: 184, y: 278 },
        curve2: { x: 188, y: 264 },
        badge: '내야',
        legend: [
          ['판정', '공이 내야 쪽 땅에 먼저 닿고 굴러가면 내야땅볼로 이해하면 쉬워요.'],
          ['보는 포인트', '낙하지점이 내야 흙 근처인지'],
          ['왜 중요한지', '송구 속도에 따라 내야안타, 포스아웃, 병살이 갈립니다.']
        ]
      },
      homerun: {
        label: '홈런',
        landing: { x: 190, y: 72 },
        curve1: { x: 206, y: 220 },
        curve2: { x: 212, y: 120 },
        badge: '홈런',
        legend: [
          ['판정', '페어 지역으로 날아가 담장을 넘어가면 홈런이에요.'],
          ['보는 포인트', '파울 폴 안쪽 + 담장 너머'],
          ['왜 중요한지', '땅에 떨어지기 전에 담장을 넘으면 가장 강한 타구 결과가 됩니다.']
        ]
      }
    };

    const movingBall = document.getElementById('movingBall');
    const ballShadow = document.getElementById('ballShadow');
    const flightPath = document.getElementById('flightPath');
    const landingPoint = document.getElementById('landingPoint');
    const landingLabel = document.getElementById('landingLabel');

    function cubicBezierPoint(t, p0, p1, p2, p3) {
      const mt = 1 - t;
      const x = (mt ** 3) * p0.x + 3 * (mt ** 2) * t * p1.x + 3 * mt * (t ** 2) * p2.x + (t ** 3) * p3.x;
      const y = (mt ** 3) * p0.y + 3 * (mt ** 2) * t * p1.y + 3 * mt * (t ** 2) * p2.y + (t ** 3) * p3.y;
      return { x, y };
    }

    function animateScenario(key) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      const scenario = scenarios[key];
      const start = { x: 180, y: 300 };
      const p1 = scenario.curve1;
      const p2 = scenario.curve2;
      const end = scenario.landing;
      flightPath.setAttribute('d', `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`);
      landingPoint.setAttribute('cx', end.x);
      landingPoint.setAttribute('cy', end.y);
      landingLabel.setAttribute('x', end.x + 8);
      landingLabel.setAttribute('y', end.y - 8);
      landingLabel.textContent = scenario.badge;
      document.getElementById('fieldLegend').innerHTML = scenario.legend.map(([label, value]) => `
        <div class="mini-stat"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>
      `).join('');

      const duration = 1800;
      const startTime = performance.now();
      function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const point = cubicBezierPoint(eased, start, p1, p2, end);
        movingBall.setAttribute('cx', point.x);
        movingBall.setAttribute('cy', point.y);
        ballShadow.setAttribute('cx', point.x);
        ballShadow.setAttribute('cy', point.y + 2);
        if (t < 1) {
          animationFrame = requestAnimationFrame(step);
        }
      }
      animationFrame = requestAnimationFrame(step);
    }

    document.querySelectorAll('.scenario-btn').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.scenario-btn').forEach((btn) => btn.classList.remove('active'));
        button.classList.add('active');
        animateScenario(button.dataset.scenario);
      });
    });

    renderRules('basic');
    renderSavedItems();
    renderDashboard(demoDashboard);
    loadDashboard();
    animateScenario('fair');
