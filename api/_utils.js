const TEAM_MAP = {
  LG: { ko: 'LG', color: '#B31F45', kboCode: 'LG', aliases: ['LG'] },
  KIA: { ko: 'KIA', color: '#D91F36', kboCode: 'HT', aliases: ['HT', 'KIA'] },
  DOOSAN: { ko: '두산', color: '#1B1F48', kboCode: 'OB', aliases: ['OB', 'DOOSAN'] },
  SAMSUNG: { ko: '삼성', color: '#006DFF', kboCode: 'SS', aliases: ['SS', 'SAMSUNG'] },
  LOTTE: { ko: '롯데', color: '#0E2E63', kboCode: 'LT', aliases: ['LT', 'LOTTE'] },
  NC: { ko: 'NC', color: '#315D9A', kboCode: 'NC', aliases: ['NC'] },
  KT: { ko: 'KT', color: '#232733', kboCode: 'KT', aliases: ['KT'] },
  HANWHA: { ko: '한화', color: '#F36B21', kboCode: 'HH', aliases: ['HH', 'HANWHA'] },
  SSG: { ko: 'SSG', color: '#C01E37', kboCode: 'SK', aliases: ['SK', 'SSG'] },
  KIWOOM: { ko: '키움', color: '#6B1830', kboCode: 'WO', aliases: ['WO', 'KIWOOM', 'KW'] }
};
const TEAM_CODES = Object.keys(TEAM_MAP);
const TEAM_PATTERN = TEAM_CODES.join('|');
const KOR_TO_ENG = Object.fromEntries(Object.entries(TEAM_MAP).map(([eng, info]) => [info.ko, eng]));
Object.assign(KOR_TO_ENG, {
  '한화 이글스': 'HANWHA', '롯데 자이언츠': 'LOTTE', '삼성 라이온즈': 'SAMSUNG', '두산 베어스': 'DOOSAN',
  '키움 히어로즈': 'KIWOOM', 'KT 위즈': 'KT', 'KIA 타이거즈': 'KIA', 'SSG 랜더스': 'SSG',
  'NC 다이노스': 'NC', 'LG 트윈스': 'LG'
});

function normalizeTeam(input = '') {
  const trimmed = String(input).trim();
  if (TEAM_MAP[trimmed]) return trimmed;
  if (KOR_TO_ENG[trimmed]) return KOR_TO_ENG[trimmed];
  return 'LG';
}

function toKoreanTeam(eng) {
  return TEAM_MAP[eng]?.ko || eng;
}

function koreaDateString(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function shiftDate(dateString, delta) {
  const [y, m, d] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function decodeEntities(text = '') {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function htmlToLines(html = '') {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, '\n')
  )
    .split('\n')
    .map(line => line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function htmlToText(html = '') {
  return htmlToLines(html).join(' ');
}

async function fetchHtmlWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      cache: 'no-store',
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function inferOpponent(game, team) {
  return game.home === team ? game.away : game.home;
}

function toKboGameCode(eng) {
  return TEAM_MAP[eng]?.kboCode || eng;
}

function toCompactDate(dateString = '') {
  return String(dateString).replace(/-/g, '');
}

function buildKboGameIds(dateString, awayTeam, homeTeam) {
  const dateCompact = toCompactDate(dateString);
  const awayAliases = TEAM_MAP[normalizeTeam(awayTeam)]?.aliases || [toKboGameCode(awayTeam)];
  const homeAliases = TEAM_MAP[normalizeTeam(homeTeam)]?.aliases || [toKboGameCode(homeTeam)];
  const ids = new Set();
  for (const away of awayAliases) {
    for (const home of homeAliases) {
      const core = `${dateCompact}${away}${home}`;
      ['', '0', '1', '2', '3', '4', '5'].forEach(suffix => ids.add(`${core}${suffix}`));
    }
  }
  return [...ids];
}

function chunk(array, size) {
  const output = [];
  for (let i = 0; i < array.length; i += size) output.push(array.slice(i, i + size));
  return output;
}

module.exports = {
  TEAM_MAP,
  TEAM_CODES,
  TEAM_PATTERN,
  KOR_TO_ENG,
  normalizeTeam,
  toKoreanTeam,
  koreaDateString,
  shiftDate,
  htmlToLines,
  htmlToText,
  fetchHtmlWithTimeout,
  inferOpponent,
  toKboGameCode,
  toCompactDate,
  buildKboGameIds,
  chunk
};
