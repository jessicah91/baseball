const {
  htmlToLines,
  fetchHtmlWithTimeout,
  buildKboGameIds,
  toCompactDate,
  normalizeTeam
} = require('./_utils');

function cleanName(value) {
  return String(value || '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^[\s:,-]+|[\s:,-]+$/g, '')
    .trim() || null;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanName(match[1]);
  }
  return null;
}

function parseHolds(text) {
  const values = [];
  const patterns = [
    /홀드투수\s*:?\s*([^\n]+)/gi,
    /홀드\s*:?\s*([^\n]+)/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1]
        .split(/[·;]|\/|,/)
        .map(cleanName)
        .filter(Boolean);
      values.push(...raw);
    }
  }
  return [...new Set(values)].join(', ') || null;
}

function parseExtrasFromKboText(lines = []) {
  const joined = lines.join('\n');
  return {
    winningPitcher: firstMatch(joined, [/승리투수\s*:?\s*([^\n]+)/i, /승\s*리\s*투\s*수\s*:?\s*([^\n]+)/i]),
    losingPitcher: firstMatch(joined, [/패전투수\s*:?\s*([^\n]+)/i]),
    savePitcher: firstMatch(joined, [/세이브투수\s*:?\s*([^\n]+)/i]),
    holdPitchers: parseHolds(joined),
    decisiveHitter: firstMatch(joined, [/결승타(?:자|\s선수)?\s*:?\s*([^\n]+)/i])
  };
}

function hasUsefulDetail(detail) {
  return Boolean(detail.winningPitcher || detail.losingPitcher || detail.savePitcher || detail.holdPitchers || detail.decisiveHitter);
}

async function tryFetchOfficialDetail(date, away, home) {
  const gameIds = buildKboGameIds(date, away, home);
  const compactDate = toCompactDate(date);
  const urls = [];
  for (const gameId of gameIds) {
    urls.push(`https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}&gameId=${gameId}`);
    urls.push(`https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}&gameId=${gameId}&section=REVIEW`);
  }

  for (const url of urls) {
    try {
      const html = await fetchHtmlWithTimeout(url, 3200);
      const detail = parseExtrasFromKboText(htmlToLines(html));
      if (hasUsefulDetail(detail)) {
        return { ...detail, sourceUrl: url };
      }
    } catch (error) {
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
