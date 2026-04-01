const cheerio = require('cheerio');

const TEAM_MAP = {
  LG: { ko: 'LG', color: '#C30452' },
  KIA: { ko: 'KIA', color: '#EA0029' },
  DOOSAN: { ko: '두산', color: '#131230' },
  SAMSUNG: { ko: '삼성', color: '#074CA1' },
  LOTTE: { ko: '롯데', color: '#041E42' },
  NC: { ko: 'NC', color: '#315288' },
  KT: { ko: 'KT', color: '#111111' },
  HANWHA: { ko: '한화', color: '#FF6600' },
  SSG: { ko: 'SSG', color: '#CE0E2D' },
  KIWOOM: { ko: '키움', color: '#570514' }
};

const KOR_TO_ENG = Object.fromEntries(
  Object.entries(TEAM_MAP).map(([eng, info]) => [info.ko, eng])
);
KOR_TO_ENG['한화 이글스'] = 'HANWHA';
KOR_TO_ENG['롯데 자이언츠'] = 'LOTTE';
KOR_TO_ENG['삼성 라이온즈'] = 'SAMSUNG';
KOR_TO_ENG['두산 베어스'] = 'DOOSAN';
KOR_TO_ENG['키움 히어로즈'] = 'KIWOOM';
KOR_TO_ENG['KT 위즈'] = 'KT';
KOR_TO_ENG['KIA 타이거즈'] = 'KIA';
KOR_TO_ENG['SSG 랜더스'] = 'SSG';
KOR_TO_ENG['NC 다이노스'] = 'NC';
KOR_TO_ENG['LG 트윈스'] = 'LG';

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

function cleanText(html) {
  const $ = cheerio.load(html);
  $('script, style, noscript').remove();
  return $('body').text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseScoreboardText(text, searchDate) {
  const games = [];
  const finalRegex = /(KIA|LG|DOOSAN|SAMSUNG|LOTTE|NC|KT|HANWHA|SSG|KIWOOM)\s+(\d+)\s+(FINAL|SUSPENDED|CALLED)\s+(\d+)\s+(KIA|LG|DOOSAN|SAMSUNG|LOTTE|NC|KT|HANWHA|SSG|KIWOOM)\s+([A-Z]+)\s+(\d{2}:\d{2})/g;
  const upcomingRegex = /(KIA|LG|DOOSAN|SAMSUNG|LOTTE|NC|KT|HANWHA|SSG|KIWOOM)\s+VS\s+(KIA|LG|DOOSAN|SAMSUNG|LOTTE|NC|KT|HANWHA|SSG|KIWOOM)\s+([A-Z]+)\s+(\d{2}:\d{2})/g;

  let match;
  while ((match = finalRegex.exec(text)) !== null) {
    const [, away, awayScore, status, homeScore, home, stadium, time] = match;
    games.push({
      date: searchDate,
      away,
      home,
      awayScore: Number(awayScore),
      homeScore: Number(homeScore),
      stadium,
      time,
      status,
      isFinal: true
    });
  }

  while ((match = upcomingRegex.exec(text)) !== null) {
    const [, away, home, stadium, time] = match;
    const key = `${searchDate}-${away}-${home}`;
    if (!games.find(g => `${g.date}-${g.away}-${g.home}` === key)) {
      games.push({
        date: searchDate,
        away,
        home,
        awayScore: null,
        homeScore: null,
        stadium,
        time,
        status: 'SCHEDULED',
        isFinal: false
      });
    }
  }

  return games;
}

function parseStandingsText(text) {
  const standings = [];
  const regex = /(\d+)\s+(KIA|LG|DOOSAN|SAMSUNG|LOTTE|NC|KT|HANWHA|SSG|KIWOOM)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.-]+)\s+([WLD]\d+)\s+(\d+-\d+-\d+)\s+(\d+-\d+-\d+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const [, rank, team, games, wins, losses, draws, pct, gb, streak, home, away] = match;
    standings.push({
      rank: Number(rank),
      team,
      teamKo: toKoreanTeam(team),
      games: Number(games),
      wins: Number(wins),
      losses: Number(losses),
      draws: Number(draws),
      pct,
      gb,
      streak,
      home,
      away,
      recent10: `${wins + losses + draws >= 10 ? '최근10' : '시즌초'} · ${streak}`
    });
  }
  return standings;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept-Language': 'en-US,en;q=0.9,ko-KR;q=0.8'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  return cleanText(html);
}

async function getRecentGames(team, limit) {
  const results = [];
  let cursor = koreaDateString();
  let attempts = 0;

  while (results.length < limit && attempts < 45) {
    const url = `https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${cursor}`;
    const text = await fetchText(url);
    const games = parseScoreboardText(text, cursor).filter(
      game => game.isFinal && (game.away === team || game.home === team)
    );

    for (const game of games) {
      if (!results.find(item => item.date === game.date && item.away === game.away && item.home === game.home)) {
        const isHome = game.home === team;
        const myScore = isHome ? game.homeScore : game.awayScore;
        const oppScore = isHome ? game.awayScore : game.homeScore;
        results.push({
          ...game,
          myTeam: team,
          opponent: isHome ? game.away : game.home,
          result: myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무',
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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const team = normalizeTeam(req.query.team || 'LG');
  const limitRaw = Number(req.query.limit || 5);
  const limit = limitRaw === 10 ? 10 : 5;
  const today = koreaDateString();

  try {
    const [scoreboardText, standingsText, recentGames] = await Promise.all([
      fetchText(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${today}`),
      fetchText('https://eng.koreabaseball.com/Standings/TeamStandings.aspx'),
      getRecentGames(team, limit)
    ]);

    const todayGames = parseScoreboardText(scoreboardText, today);
    const myTodayGame = todayGames.find(game => game.away === team || game.home === team) || null;
    const standings = parseStandingsText(standingsText);
    const myStanding = standings.find(item => item.team === team) || null;

    return res.status(200).json({
      source: 'official-kbo',
      fetchedAt: new Date().toISOString(),
      today,
      team,
      teamKo: toKoreanTeam(team),
      themeColor: TEAM_MAP[team]?.color || '#111111',
      limit,
      myTodayGame: myTodayGame
        ? {
            ...myTodayGame,
            awayKo: toKoreanTeam(myTodayGame.away),
            homeKo: toKoreanTeam(myTodayGame.home)
          }
        : null,
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
      themeColor: TEAM_MAP[team]?.color || '#111111',
      limit,
      myTodayGame: null,
      recentGames: [],
      standings: [],
      myStanding: null
    });
  }
};
