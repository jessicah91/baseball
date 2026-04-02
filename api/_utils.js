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

const https = require('https');

function buildBrowserHeaders(url) {
  const origin = url.startsWith('https://eng.koreabaseball.com') ? 'https://eng.koreabaseball.com' : 'https://www.koreabaseball.com';
  return {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': origin + '/',
    'Origin': origin,
    'Connection': 'close',
    'Upgrade-Insecure-Requests': '1'
  };
}

function httpsGetText(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: buildBrowserHeaders(url) }, (res) => {
      const status = res.statusCode || 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        const target = new URL(res.headers.location, url).toString();
        res.resume();
        return resolve(httpsGetText(target, timeoutMs));
      }
      if (status < 200 || status >= 300) {
        res.resume();
        return reject(new Error(`HTTPS ${status} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer.toString('utf8'));
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function fetchHtmlWithTimeout(url, timeoutMs = 5000) {
  const attempts = [url];
  if (url.includes('www.koreabaseball.com')) attempts.push(url.replace('www.koreabaseball.com', 'koreabaseball.com'));
  if (url.includes('koreabaseball.com') && !url.includes('www.koreabaseball.com') && !url.includes('eng.koreabaseball.com')) attempts.push(url.replace('https://koreabaseball.com', 'https://www.koreabaseball.com'));

  let lastError = null;
  for (const target of [...new Set(attempts)]) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);
    try {
      const response = await fetch(target, {
        headers: buildBrowserHeaders(target),
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Fetch ${response.status} for ${target}`);
      const text = await response.text();
      if (text && text.length > 100) return text;
      throw new Error(`Empty response for ${target}`);
    } catch (error) {
      lastError = error;
      try {
        const text = await httpsGetText(target, timeoutMs + 1000);
        if (text && text.length > 100) return text;
      } catch (httpsError) {
        lastError = httpsError;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`Failed to fetch ${url}`);
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
