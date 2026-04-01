const cheerio = require('cheerio');

const TEAM_MAP = {
  LG: { ko: 'LG', color: '#B31F45' },
  KIA: { ko: 'KIA', color: '#D91F36' },
  DOOSAN: { ko: '두산', color: '#1B1F48' },
  SAMSUNG: { ko: '삼성', color: '#1D66D1' },
  LOTTE: { ko: '롯데', color: '#0E2E63' },
  NC: { ko: 'NC', color: '#375A97' },
  KT: { ko: 'KT', color: '#20242B' },
  HANWHA: { ko: '한화', color: '#F36B21' },
  SSG: { ko: 'SSG', color: '#C01E37' },
  KIWOOM: { ko: '키움', color: '#6B1830' }
};

const TEAM_CODES = Object.keys(TEAM_MAP).join('|');
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
      'Accept-Language': 'en-US,en;q=0.9,ko-KR;q=0.8'
    },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

function cleanText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  return $('body').text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseScoreboardText(text, searchDate) {
  const games = [];
  const finalRegex = new RegExp(`(${TEAM_CODES})\\s+(\\d+)\\s+(FINAL|SUSPENDED|CALLED)\\s+(\\d+)\\s+(${TEAM_CODES})\\s+([A-Z]+)\\s+(\\d{2}:\\d{2})`, 'g');
  const upcomingRegex = new RegExp(`(${TEAM_CODES})\\s+VS\\s+(${TEAM_CODES})\\s+([A-Z]+)\\s+(\\d{2}:\\d{2})`, 'g');

  let match;
  while ((match = finalRegex.exec(text)) !== null) {
    const [, away, awayScore, status, homeScore, home, stadium, time] = match;
    games.push({ date: searchDate, away, home, awayScore: Number(awayScore), homeScore: Number(homeScore), stadium, time, status, isFinal: true });
  }

  while ((match = upcomingRegex.exec(text)) !== null) {
    const [, away, home, stadium, time] = match;
    const key = `${searchDate}-${away}-${home}`;
    if (!games.find(g => `${g.date}-${g.away}-${g.home}` === key)) {
      games.push({ date: searchDate, away, home, awayScore: null, homeScore: null, stadium, time, status: 'SCHEDULED', isFinal: false });
    }
  }

  return games.map(game => ({ ...game, id: `${game.date}-${game.away}-${game.home}` }));
}

function parseStandingsText(text) {
  const standings = [];
  const regex = new RegExp(`(\\d+)\\s+(${TEAM_CODES})\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+([\\d.]+)\\s+([\\d.-]+)\\s+([WLD]\\d+)\\s+(\\d+-\\d+-\\d+)\\s+(\\d+-\\d+-\\d+)`, 'g');
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, rank, team, games, wins, losses, draws, pct, gb, streak, home, away] = match;
    standings.push({ rank: Number(rank), team, teamKo: toKoreanTeam(team), games: Number(games), wins: Number(wins), losses: Number(losses), draws: Number(draws), pct, gb, streak, home, away });
  }
  return standings;
}

function parseGameExtras(text = '') {
  const patterns = {
    winningPitcher: /Winning Pitcher\s*:?\s*([A-Za-z가-힣 .'-]+)/i,
    losingPitcher: /Losing Pitcher\s*:?\s*([A-Za-z가-힣 .'-]+)/i,
    savePitcher: /Save Pitcher\s*:?\s*([A-Za-z가-힣 .'-]+)/i,
    decisiveHitter: /Decisive Hit(?:ter)?\s*:?\s*([A-Za-z가-힣 .'-]+)/i
  };
  const extras = {};
  Object.entries(patterns).forEach(([key, regex]) => {
    const match = text.match(regex);
    extras[key] = match?.[1]?.trim() || null;
  });
  const holdMatches = [...text.matchAll(/Hold(?: Pitcher)?\s*:?\s*([A-Za-z가-힣 .'-]+)/gi)].map(item => item[1]?.trim()).filter(Boolean);
  extras.holdPitchers = holdMatches.length ? holdMatches.join(', ') : null;
  return extras;
}

async function tryFetchGameDetailByGuess(game) {
  try {
    const compactDate = game.date.replace(/-/g, '');
    const url = `https://eng.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${compactDate}`;
    const html = await fetchHtml(url);
    const text = cleanText(html);
    const extras = parseGameExtras(text);
    return extras;
  } catch {
    return {
      winningPitcher: null,
      losingPitcher: null,
      savePitcher: null,
      holdPitchers: null,
      decisiveHitter: null
    };
  }
}

async function getRecentGames(team, limit) {
  const results = [];
  let cursor = koreaDateString();
  let attempts = 0;

  while (results.length < limit && attempts < 45) {
    const url = `https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${cursor}`;
    const text = cleanText(await fetchHtml(url));
    const games = parseScoreboardText(text, cursor).filter(game => game.isFinal && (game.away === team || game.home === team));

    for (const game of games) {
      if (!results.find(item => item.id === game.id)) {
        const isHome = game.home === team;
        const myScore = isHome ? game.homeScore : game.awayScore;
        const oppScore = isHome ? game.awayScore : game.homeScore;
        const extras = await tryFetchGameDetailByGuess(game);
        results.push({
          ...game,
          ...extras,
          myTeam: team,
          opponent: isHome ? game.away : game.home,
          result: myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무',
          myScore,
          oppScore,
          scoreLabel: `${toKoreanTeam(team)} ${myScore} : ${oppScore} ${toKoreanTeam(isHome ? game.away : game.home)}`
        });
      }
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

    const todayGames = parseScoreboardText(cleanText(scoreboardHtml), today);
    const myTodayGame = todayGames.find(game => game.away === team || game.home === team) || null;
    const standings = parseStandingsText(cleanText(standingsHtml));
    const myStanding = standings.find(item => item.team === team) || null;

    return res.status(200).json({
      source: 'official-kbo',
      fetchedAt: new Date().toISOString(),
      today,
      team,
      teamKo: toKoreanTeam(team),
      themeColor: TEAM_MAP[team]?.color || '#B31F45',
      limit,
      myTodayGame: myTodayGame ? { ...myTodayGame, awayKo: toKoreanTeam(myTodayGame.away), homeKo: toKoreanTeam(myTodayGame.home) } : null,
      recentGames: recentGames.map(game => ({ ...game, awayKo: toKoreanTeam(game.away), homeKo: toKoreanTeam(game.home), opponentKo: toKoreanTeam(game.opponent) })),
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
