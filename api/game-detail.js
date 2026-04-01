const {
  htmlToLines,
  fetchHtmlWithTimeout,
  buildKboGameIds,
  toCompactDate,
  normalizeTeam,
  toKboGameCode
} = require('./_utils');

const RESULT_TOKENS = new Set(['승', '패', '홀드', '세이브']);

function cleanName(value) {
  return String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^[\s:,-]+|[\s:,-]+$/g, '')
    .trim() || null;
}

function extractNameFromDescription(text = '') {
  const cleaned = String(text).trim();
  const match = cleaned.match(/^([A-Za-z가-힣]+)/);
  return cleanName(match?.[1] || cleaned);
}

function parseDecisiveHitter(lines = []) {
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i] !== '결승타') continue;
    const next = lines[i + 1] || lines[i + 2] || '';
    return extractNameFromDescription(next);
  }
  const joined = lines.join(' ');
  const inline = joined.match(/결승타\s+([^\n]+)/);
  return inline ? extractNameFromDescription(inline[1]) : null;
}

function looksLikePitcherRow(tokens) {
  if (tokens.length < 5) return false;
  if (!/^[A-Za-z가-힣]+$/.test(tokens[0])) return false;
  const appearance = tokens[1];
  return appearance === '선발' || /^\d+(?:\.\d+)?$/.test(appearance);
}

function parsePitcherRows(lines = []) {
  const found = {
    winningPitcher: null,
    losingPitcher: null,
    savePitcher: null,
    holdPitchers: []
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (!/투수 기록$/.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j];
      if (/투수 기록$/.test(line) || /타자 기록$/.test(line) || line === 'TOTAL' || line.startsWith('개인정보 처리방침')) {
        if (j > i + 1 && (/투수 기록$/.test(line) || /타자 기록$/.test(line))) break;
        continue;
      }
      const tokens = line.split(/\s+/).filter(Boolean);
      if (!looksLikePitcherRow(tokens)) continue;
      const name = cleanName(tokens[0]);
      const maybeResult = tokens[2] && RESULT_TOKENS.has(tokens[2]) ? tokens[2] : null;
      if (!name || !maybeResult) continue;
      if (maybeResult === '승' && !found.winningPitcher) found.winningPitcher = name;
      if (maybeResult === '패' && !found.losingPitcher) found.losingPitcher = name;
      if (maybeResult === '세이브' && !found.savePitcher) found.savePitcher = name;
      if (maybeResult === '홀드') found.holdPitchers.push(name);
    }
  }

  found.holdPitchers = [...new Set(found.holdPitchers)];
  return found;
}

function parseExtrasFromKboText(lines = []) {
  const pitchers = parsePitcherRows(lines);
  return {
    winningPitcher: pitchers.winningPitcher || null,
    losingPitcher: pitchers.losingPitcher || null,
    savePitcher: pitchers.savePitcher || null,
    holdPitchers: pitchers.holdPitchers.length ? pitchers.holdPitchers.join(', ') : null,
    decisiveHitter: parseDecisiveHitter(lines)
  };
}

function hasUsefulDetail(detail) {
  return Boolean(detail.winningPitcher || detail.losingPitcher || detail.savePitcher || detail.holdPitchers || detail.decisiveHitter);
}

function extractGameIdsFromScheduleHtml(html = '', dateCompact, away, home) {
  const candidates = new Set();
  const regex = /GameCenter\/Main\.aspx\?gameDate=(\d{8})&amp;gameId=([A-Z0-9]+)/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const [, gameDate, gameId] = match;
    if (gameDate !== dateCompact) continue;
    if (gameId.includes(away) && gameId.includes(home)) candidates.add(gameId);
  }
  return [...candidates];
}

async function gatherCandidateUrls(date, away, home) {
  const compactDate = toCompactDate(date);
  const awayCode = toKboGameCode(normalizeTeam(away));
  const homeCode = toKboGameCode(normalizeTeam(home));
  const urls = [];
  const seen = new Set();

  const pushUrl = url => {
    if (seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  try {
    const scheduleHtml = await fetchHtmlWithTimeout('https://www.koreabaseball.com/Schedule/Schedule.aspx', 6000);
    extractGameIdsFromScheduleHtml(scheduleHtml, compactDate, awayCode, homeCode).forEach(gameId => {
      pushUrl(`https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}&gameId=${gameId}`);
    });
  } catch (_error) {
    // ignore schedule lookup failure
  }

  buildKboGameIds(date, away, home).forEach(gameId => {
    pushUrl(`https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}&gameId=${gameId}`);
  });

  pushUrl(`https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}`);
  return urls;
}

async function tryFetchOfficialDetail(date, away, home) {
  const urls = await gatherCandidateUrls(date, away, home);

  for (const url of urls) {
    try {
      const html = await fetchHtmlWithTimeout(url, 6000);
      const detail = parseExtrasFromKboText(htmlToLines(html));
      if (hasUsefulDetail(detail)) return { ...detail, sourceUrl: url };
    } catch (_error) {
      // try next candidate
    }
  }

  return {
    winningPitcher: null,
    losingPitcher: null,
    savePitcher: null,
    holdPitchers: null,
    decisiveHitter: null,
    sourceUrl: null
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const date = String(req.query.date || '').trim();
  const away = normalizeTeam(req.query.away || '');
  const home = normalizeTeam(req.query.home || '');

  if (!date || !away || !home) {
    return res.status(200).json({ winningPitcher: null, losingPitcher: null, savePitcher: null, holdPitchers: null, decisiveHitter: null, sourceUrl: null });
  }

  const detail = await tryFetchOfficialDetail(date, away, home);
  return res.status(200).json(detail);
};
