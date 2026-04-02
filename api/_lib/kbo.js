const https = require('https');
const zlib = require('zlib');
const iconv = require('iconv-lite');

const TEAM_META = {
  LG: { code: 'LG', koShort: 'LG', koFull: 'LG 트윈스', en: 'LG', color: '#C30452' },
  HANWHA: { code: 'HANWHA', koShort: '한화', koFull: '한화 이글스', en: 'HANWHA', color: '#F37321' },
  SSG: { code: 'SSG', koShort: 'SSG', koFull: 'SSG 랜더스', en: 'SSG', color: '#CE0E2D' },
  SAMSUNG: { code: 'SAMSUNG', koShort: '삼성', koFull: '삼성 라이온즈', en: 'SAMSUNG', color: '#0066B3' },
  NC: { code: 'NC', koShort: 'NC', koFull: 'NC 다이노스', en: 'NC', color: '#315288' },
  KT: { code: 'KT', koShort: 'KT', koFull: 'KT 위즈', en: 'KT', color: '#222222' },
  LOTTE: { code: 'LOTTE', koShort: '롯데', koFull: '롯데 자이언츠', en: 'LOTTE', color: '#0E2E63' },
  KIA: { code: 'KIA', koShort: 'KIA', koFull: 'KIA 타이거즈', en: 'KIA', color: '#E4002B' },
  DOOSAN: { code: 'DOOSAN', koShort: '두산', koFull: '두산 베어스', en: 'DOOSAN', color: '#131230' },
  KIWOOM: { code: 'KIWOOM', koShort: '키움', koFull: '키움 히어로즈', en: 'KIWOOM', color: '#570514' }
};

const TEAM_ALIAS_TO_CODE = Object.fromEntries(
  Object.values(TEAM_META).flatMap((team) => [
    [team.code, team.code],
    [team.en, team.code],
    [team.koShort, team.code],
    [team.koFull, team.code],
    [team.koFull.replace(/\s+/g, ''), team.code],
    [team.koShort.replace(/\s+/g, ''), team.code]
  ])
);

function getTeam(codeOrName = 'LOTTE') {
  const normalized = String(codeOrName || '').trim().toUpperCase();
  if (TEAM_META[normalized]) return TEAM_META[normalized];
  const byAlias = TEAM_ALIAS_TO_CODE[String(codeOrName || '').trim()] || TEAM_ALIAS_TO_CODE[normalized];
  return TEAM_META[byAlias || 'LOTTE'];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatKboDotDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

function formatEngScoreDate(date) {
  return formatDate(date);
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[\t\r]+/g, ' ')
      .replace(/\u00a0/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/[ ]{2,}/g, ' ')
  ).trim();
}

async function requestBuffer(url, extraHeaders = {}) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    ...extraHeaders
  };

  return new Promise((resolve, reject) => {
    https.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        const done = (buf) => resolve({ statusCode: res.statusCode || 0, headers: res.headers, body: buf });
        if (encoding.includes('gzip')) {
          zlib.gunzip(body, (err, buf) => err ? reject(err) : done(buf));
          return;
        }
        if (encoding.includes('deflate')) {
          zlib.inflate(body, (err, buf) => err ? reject(err) : done(buf));
          return;
        }
        if (encoding.includes('br')) {
          zlib.brotliDecompress(body, (err, buf) => err ? reject(err) : done(buf));
          return;
        }
        done(body);
      });
    }).on('error', reject);
  });
}

async function fetchHtml(url, options = {}) {
  const { decode = 'utf8', retries = 1 } = options;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await requestBuffer(url);
      const charset = String(response.headers['content-type'] || '').match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
      const decoder = charset && charset !== 'utf-8' ? charset : decode;
      const html = iconv.decode(response.body, decoder === 'utf8' ? 'utf-8' : decoder);
      return html;
    } catch (error) {
      lastError = error;
      await sleep(200 * (attempt + 1));
    }
  }
  throw lastError;
}

function parseStandingsFromDailyText(text) {
  const rows = [];
  const re = /(?:^|\n)(\d+)\s+([A-Z가-힣]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([0-9승패무]+)\s+([0-9승패무]+)\s+([0-9-]+)\s+([0-9-]+)(?=\n|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const [, rank, teamName, games, wins, losses, draws, pct, gb, last10, streak, home, away] = m;
    const code = getTeam(teamName).code;
    rows.push({
      rank: Number(rank),
      teamCode: code,
      teamName: getTeam(code).koShort,
      games: Number(games),
      wins: Number(wins),
      losses: Number(losses),
      draws: Number(draws),
      pct,
      gb,
      last10,
      streak,
      home,
      away
    });
  }
  return rows;
}

function parsePitcherField(rest, label) {
  const m = rest.match(new RegExp(`${label}:\s*([^\n]+?)(?=\s+[WSL]:|$)`));
  return m ? m[1].trim() : null;
}

function parseScoreboardGames(text, targetDate) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const games = [];
  for (let i = 0; i < lines.length; i += 1) {
    const headline = lines[i];
    const finalMatch = headline.match(/^([A-Z]+)\s+(\d+)\s+FINAL\s+(\d+)\s+([A-Z]+)$/);
    const scheduledMatch = headline.match(/^([A-Z]+)\s+(\d{1,2}:\d{2})\s+([A-Z]+)$/);
    if (!finalMatch && !scheduledMatch) continue;

    if (finalMatch) {
      const [, away, awayScore, homeScore, home] = finalMatch;
      const infoLine = lines[i + 1] || '';
      const infoMatch = infoLine.match(/^([A-Z]+)\s+(\d{1,2}:\d{2})(.*)$/);
      const venue = infoMatch?.[1] || '';
      const time = infoMatch?.[2] || '';
      const rest = infoMatch?.[3] || '';
      games.push({
        date: targetDate,
        status: 'final',
        venue,
        time,
        awayCode: getTeam(away).code,
        homeCode: getTeam(home).code,
        awayTeam: getTeam(away).koShort,
        homeTeam: getTeam(home).koShort,
        awayScore: Number(awayScore),
        homeScore: Number(homeScore),
        winningPitcher: parsePitcherField(rest, 'W') || null,
        savePitcher: parsePitcherField(rest, 'S') || null,
        losingPitcher: parsePitcherField(rest, 'L') || null
      });
      continue;
    }

    const [, away, time, home] = scheduledMatch;
    const venueLine = lines[i + 1] || '';
    const venueMatch = venueLine.match(/^([A-Z]+)\s+(\d{1,2}:\d{2})/);
    const venue = venueMatch?.[1] || venueLine.split(' ')[0] || '';
    games.push({
      date: targetDate,
      status: 'scheduled',
      venue,
      time,
      awayCode: getTeam(away).code,
      homeCode: getTeam(home).code,
      awayTeam: getTeam(away).koShort,
      homeTeam: getTeam(home).koShort,
      awayScore: null,
      homeScore: null,
      winningPitcher: null,
      savePitcher: null,
      losingPitcher: null
    });
  }
  return games;
}

async function fetchDailyStandings() {
  const html = await fetchHtml('https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx', { decode: 'euc-kr', retries: 1 });
  const text = htmlToText(html);
  return parseStandingsFromDailyText(text);
}

async function fetchScoreboardForDate(dateString) {
  const html = await fetchHtml(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${dateString}`, { decode: 'utf8', retries: 1 });
  const text = htmlToText(html);
  return parseScoreboardGames(text, dateString);
}

async function fetchRecentGames(teamCode, limit = 5) {
  const results = [];
  const seen = new Set();
  const base = new Date();
  for (let offset = 1; offset <= 45 && results.length < limit; offset += 1) {
    const day = new Date(base);
    day.setDate(base.getDate() - offset);
    const dateString = formatEngScoreDate(day);
    let games = [];
    try {
      games = await fetchScoreboardForDate(dateString);
    } catch (error) {
      continue;
    }
    for (const game of games) {
      if (game.status !== 'final') continue;
      if (![game.homeCode, game.awayCode].includes(teamCode)) continue;
      const key = `${game.date}-${game.awayCode}-${game.homeCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        ...game,
        resultForMyTeam: game.homeCode === teamCode
          ? (game.homeScore > game.awayScore ? 'win' : 'loss')
          : (game.awayScore > game.homeScore ? 'win' : 'loss')
      });
      if (results.length >= limit) break;
    }
  }
  return results;
}

function findTodayGame(games, teamCode) {
  return games.find((game) => game.homeCode === teamCode || game.awayCode === teamCode) || null;
}

function getMyStanding(standings, teamCode) {
  return standings.find((row) => row.teamCode === teamCode) || null;
}

module.exports = {
  TEAM_META,
  getTeam,
  formatDate,
  formatKboDotDate,
  formatEngScoreDate,
  htmlToText,
  fetchHtml,
  fetchDailyStandings,
  fetchScoreboardForDate,
  fetchRecentGames,
  findTodayGame,
  getMyStanding
};
