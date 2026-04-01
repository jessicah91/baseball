const cheerio = require('cheerio');

const TEAM_MAP = {
  LG: { ko: 'LG', color: '#B31F45' },
  KIA: { ko: 'KIA', color: '#D91F36' },
  DOOSAN: { ko: '두산', color: '#1B1F48' },
  SAMSUNG: { ko: '삼성', color: '#006DFF' },
  LOTTE: { ko: '롯데', color: '#0E2E63' },
  NC: { ko: 'NC', color: '#315D9A' },
  KT: { ko: 'KT', color: '#232733' },
  HANWHA: { ko: '한화', color: '#F36B21' },
  SSG: { ko: 'SSG', color: '#C01E37' },
  KIWOOM: { ko: '키움', color: '#6B1830' }
};

const TEAM_CODES = Object.keys(TEAM_MAP);
const TEAM_PATTERN = TEAM_CODES.join('|');
const TEAM_SET = new Set(TEAM_CODES);
const KOR_TO_ENG = Object.fromEntries(Object.entries(TEAM_MAP).map(([eng, info]) => [info.ko, eng]));
Object.assign(KOR_TO_ENG, {
  '한화 이글스': 'HANWHA',
  '롯데 자이언츠': 'LOTTE',
  '삼성 라이온즈': 'SAMSUNG',
  '두산 베어스': 'DOOSAN',
  '키움 히어로즈': 'KIWOOM',
  'KT 위즈': 'KT',
  'KIA 타이거즈': 'KIA',
  'SSG 랜더스': 'SSG',
  'NC 다이노스': 'NC',
  'LG 트윈스': 'LG'
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

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function textLines(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  const text = $('body').text();
  return text
    .split('\n')
    .map(line => line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseScoreboard(html, searchDate) {
  const lines = textLines(html);
  const games = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    let match = line.match(new RegExp(`^(${TEAM_PATTERN})\s+(\d{1,2}:\d{2})\s+(${TEAM_PATTERN})$`));
    if (match) {
      const [, away, time, home] = match;
      const next = lines[i + 1] || '';
      const meta = next.match(/^([A-Z ]+?)\s+(\d{1,2}:\d{2})$/);
      games.push({
        id: `${searchDate}-${away}-${home}`,
        date: searchDate,
        away,
        home,
        awayScore: null,
        homeScore: null,
        stadium: meta?.[1]?.trim() || null,
        time: meta?.[2] || time,
        isFinal: false,
        statusLabel: '경기 예정',
        result: null
      });
      continue;
    }

    match = line.match(new RegExp(`^(${TEAM_PATTERN})\s+(\d+)\s+(FINAL|SUSPENDED|CALLED|GAME OVER)\s+(\d+)\s+(${TEAM_PATTERN})$`));
    if (match) {
      const [, away, awayScore, status, homeScore, home] = match;
      const next = lines[i + 1] || '';
      const meta = next.match(/^([A-Z ]+?)\s+(\d{1,2}:\d{2})$/);
      games.push({
        id: `${searchDate}-${away}-${home}`,
        date: searchDate,
        away,
        home,
        awayScore: Number(awayScore),
        homeScore: Number(homeScore),
        stadium: meta?.[1]?.trim() || null,
        time: meta?.[2] || null,
        isFinal: true,
        statusLabel: status === 'FINAL' ? '경기 종료' : status,
        result: null
      });
      continue;
    }

    match = line.match(new RegExp(`^(${TEAM_PATTERN})\s+(\d+)\s+(${TEAM_PATTERN})\s+(\d+)$`));
    if (match) {
      const [, away, awayScore, home, homeScore] = match;
      games.push({
        id: `${searchDate}-${away}-${home}`,
        date: searchDate,
        away,
        home,
        awayScore: Number(awayScore),
        homeScore: Number(homeScore),
        stadium: null,
        time: null,
        isFinal: true,
        statusLabel: '경기 종료',
        result: null
      });
    }
  }

  const dedup = new Map();
  games.forEach(game => {
    if (!dedup.has(game.id)) dedup.set(game.id, game);
    else {
      const prev = dedup.get(game.id);
      dedup.set(game.id, { ...prev, ...game, stadium: game.stadium || prev.stadium, time: game.time || prev.time });
    }
  });
  return [...dedup.values()];
}

function parseStandings(html) {
  const lines = textLines(html);
  const standings = [];
  const regex = new RegExp(`^(\d+)\s+(${TEAM_PATTERN})\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.-]+)\s+([WLD]\d+)\s+(\d+-\d+-\d+)\s+(\d+-\d+-\d+)$`);

  for (const line of lines) {
    const match = line.match(regex);
    if (!match) continue;
    const [, rank, team, games, wins, losses, draws, pct, gb, streak, home, away] = match;
    standings.push({
      rank: Number(rank), team, teamKo: toKoreanTeam(team), games: Number(games), wins: Number(wins), losses: Number(losses), draws: Number(draws), pct, gb, streak, home, away
    });
  }

  return standings;
}

function parseExtrasFromText(text = '') {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const patterns = {
    winningPitcher: [/Winning Pitcher\s*:?\s*([A-Za-z가-힣 .'-]+)/i, /승리투수\s*:?\s*([A-Za-z가-힣 .'-]+)/i],
    losingPitcher: [/Losing Pitcher\s*:?\s*([A-Za-z가-힣 .'-]+)/i, /패전투수\s*:?\s*([A-Za-z가-힣 .'-]+)/i],
    savePitcher: [/Save Pitcher\s*:?\s*([A-Za-z가-힣 .'-]+)/i, /세이브투수\s*:?\s*([A-Za-z가-힣 .'-]+)/i],
    decisiveHitter: [/Decisive Hit(?:ter)?\s*:?\s*([A-Za-z가-힣 .'-]+)/i, /결승타(?:자)?\s*:?\s*([A-Za-z가-힣 .'-]+)/i]
  };

  const extras = { winningPitcher: null, losingPitcher: null, savePitcher: null, holdPitchers: null, decisiveHitter: null };
  for (const [key, regexes] of Object.entries(patterns)) {
    for (const regex of regexes) {
      const match = cleaned.match(regex);
      if (match?.[1]) {
        extras[key] = match[1].trim();
        break;
      }
    }
  }

  const holdMatches = [
    ...cleaned.matchAll(/Hold(?: Pitcher)?\s*:?\s*([A-Za-z가-힣 .'-]+)/gi),
    ...cleaned.matchAll(/홀드투수\s*:?\s*([A-Za-z가-힣 .'-]+)/gi)
  ].map(match => match[1]?.trim()).filter(Boolean);
  if (holdMatches.length) extras.holdPitchers = [...new Set(holdMatches)].join(', ');

  return extras;
}

function inferOpp(game, team) {
  return game.home === team ? game.away : game.home;
}

async function tryKboGameCenter(game) {
  try {
    const compactDate = game.date.replace(/-/g, '');
    const html = await fetchHtml(`https://eng.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}`);
    const extras = parseExtrasFromText(textLines(html).join(' '));
    if (Object.values(extras).some(Boolean)) return extras;
  } catch {}
  return null;
}

async function tryNaverFallback(game) {
  try {
    const query = encodeURIComponent(`${game.date.replace(/-/g, '.')} ${toKoreanTeam(game.away)} ${toKoreanTeam(game.home)} 승리투수 패전투수 세이브 결승타`);
    const html = await fetchHtml(`https://search.naver.com/search.naver?where=nexearch&query=${query}`);
    const extras = parseExtrasFromText(textLines(html).join(' '));
    if (Object.values(extras).some(Boolean)) return extras;
  } catch {}
  return null;
}

async function enrichGame(game) {
  const fromKbo = await tryKboGameCenter(game);
  if (fromKbo) return fromKbo;
  const fromNaver = await tryNaverFallback(game);
  if (fromNaver) return fromNaver;
  return { winningPitcher: null, losingPitcher: null, savePitcher: null, holdPitchers: null, decisiveHitter: null };
}

async function getRecentGames(team, limit) {
  const results = [];
  let cursor = koreaDateString();
  let attempts = 0;

  while (results.length < limit && attempts < 45) {
    const html = await fetchHtml(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${cursor}`);
    const games = parseScoreboard(html, cursor).filter(game => game.isFinal && (game.away === team || game.home === team));

    for (const game of games) {
      if (results.some(item => item.id === game.id)) continue;
      const isHome = game.home === team;
      const myScore = isHome ? game.homeScore : game.awayScore;
      const oppScore = isHome ? game.awayScore : game.homeScore;
      const extras = await enrichGame(game);
      results.push({
        ...game,
        ...extras,
        myTeam: team,
        opponent: inferOpp(game, team),
        result: myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무',
        myScore,
        oppScore,
        scoreLabel: `${toKoreanTeam(team)} ${myScore} : ${oppScore} ${toKoreanTeam(inferOpp(game, team))}`
      });
      if (results.length >= limit) break;
    }

    cursor = shiftDate(cursor, -1);
    attempts += 1;
  }

  return results.slice(0, limit);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const team = normalizeTeam(req.query.team || 'LG');
  const limit = Number(req.query.limit || 5) === 10 ? 10 : 5;
  const today = koreaDateString();

  try {
    const [scoreboardHtml, standingsHtml, recentGames] = await Promise.all([
      fetchHtml(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${today}`),
      fetchHtml('https://eng.koreabaseball.com/Standings/TeamStandings.aspx'),
      getRecentGames(team, limit)
    ]);

    const todayGames = parseScoreboard(scoreboardHtml, today);
    const myTodayGameRaw = todayGames.find(game => game.away === team || game.home === team) || null;
    const standings = parseStandings(standingsHtml);
    const myStanding = standings.find(item => item.team === team) || null;

    let myTodayGame = null;
    if (myTodayGameRaw) {
      const isHome = myTodayGameRaw.home === team;
      myTodayGame = {
        ...myTodayGameRaw,
        awayKo: toKoreanTeam(myTodayGameRaw.away),
        homeKo: toKoreanTeam(myTodayGameRaw.home),
        opponentKo: toKoreanTeam(inferOpp(myTodayGameRaw, team)),
        result: myTodayGameRaw.isFinal
          ? ((isHome ? myTodayGameRaw.homeScore : myTodayGameRaw.awayScore) > (isHome ? myTodayGameRaw.awayScore : myTodayGameRaw.homeScore) ? '승' : '패')
          : null
      };
    }

    return res.status(200).json({
      source: 'kbo-with-fallback',
      fetchedAt: new Date().toISOString(),
      today,
      team,
      teamKo: toKoreanTeam(team),
      themeColor: TEAM_MAP[team]?.color || '#B31F45',
      limit,
      myTodayGame,
      recentGames: recentGames.map(game => ({
        ...game,
        awayKo: toKoreanTeam(game.away),
        homeKo: toKoreanTeam(game.home),
        opponentKo: toKoreanTeam(game.opponent)
      })),
      standings,
      myStanding
    });
  } catch (error) {
    return res.status(200).json({
      source: 'fallback',
      error: String(error),
      today,
      team,
      teamKo: toKoreanTeam(team),
      themeColor: TEAM_MAP[team]?.color || '#B31F45',
      limit,
      myTodayGame: null,
      recentGames: [],
      standings: [],
      myStanding: null
    });
  }
};
