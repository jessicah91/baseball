const {
  TEAM_MAP,
  TEAM_PATTERN,
  normalizeTeam,
  toKoreanTeam,
  koreaDateString,
  htmlToLines,
  htmlToText,
  fetchHtmlWithTimeout,
  inferOpponent
} = require('./_utils');

function parsePitcherMeta(line = '') {
  const result = {
    stadium: null,
    time: null,
    winningPitcher: null,
    losingPitcher: null,
    savePitcher: null
  };
  const timeMatch = line.match(/(\d{1,2}:\d{2})/);
  result.time = timeMatch?.[1] || null;
  result.stadium = line.replace(/\s+(\d{1,2}:\d{2}).*$/, '').trim() || null;
  const w = line.match(/W:\s*([A-Za-z가-힣 .'-]+)/i);
  const l = line.match(/L:\s*([A-Za-z가-힣 .'-]+)/i);
  const s = line.match(/S:\s*([A-Za-z가-힣 .'-]+)/i);
  result.winningPitcher = w?.[1]?.trim() || null;
  result.losingPitcher = l?.[1]?.trim() || null;
  result.savePitcher = s?.[1]?.trim() || null;
  return result;
}

function parseScoreboard(lines, searchDate) {
  const games = [];
  const scheduledRe = new RegExp(`^(${TEAM_PATTERN})\\s+(\\d{1,2}:\\d{2})\\s+(${TEAM_PATTERN})$`);
  const finalRe = new RegExp(`^(${TEAM_PATTERN})\\s+(\\d+)\\s+(FINAL|SUSPENDED|CALLED|GAME OVER)\\s+(\\d+)\\s+(${TEAM_PATTERN})$`);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    let match = line.match(finalRe);
    if (match) {
      const [, away, awayScore, status, homeScore, home] = match;
      const meta = parsePitcherMeta(lines[i + 1] || '');
      games.push({
        id: `${searchDate}-${away}-${home}`,
        date: searchDate,
        away,
        home,
        awayScore: Number(awayScore),
        homeScore: Number(homeScore),
        isFinal: true,
        statusLabel: status === 'FINAL' ? '경기 종료' : status,
        ...meta
      });
      continue;
    }

    match = line.match(scheduledRe);
    if (match) {
      const [, away, time, home] = match;
      const meta = parsePitcherMeta(lines[i + 1] || '');
      games.push({
        id: `${searchDate}-${away}-${home}`,
        date: searchDate,
        away,
        home,
        awayScore: null,
        homeScore: null,
        isFinal: false,
        statusLabel: '경기 예정',
        stadium: meta.stadium,
        time: meta.time || time,
        winningPitcher: null,
        losingPitcher: null,
        savePitcher: null
      });
    }
  }

  const unique = new Map();
  games.forEach(game => {
    if (!unique.has(game.id)) unique.set(game.id, game);
  });
  return [...unique.values()];
}

function parseDailyScheduleForDate(text, searchDate) {
  const date = new Date(`${searchDate}T00:00:00+09:00`);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const tag = `${mm}.${dd}(`;
  const normalized = text.replace(/\s+/g, ' ').trim();
  const start = normalized.indexOf(tag);
  if (start === -1) return [];
  const rest = normalized.slice(start);
  const nextMatch = rest.slice(1).match(/\b\d{2}\.\d{2}\([A-Z]{3}\)\s+REGULAR\b/);
  const block = nextMatch ? rest.slice(0, nextMatch.index + 1) : rest;
  const games = [];
  const re = new RegExp(`(\\d{1,2}:\\d{2})\\s+(${TEAM_PATTERN})\\s+(\\d+:\\d+|:)\\s+(${TEAM_PATTERN})\\s+((?:[A-Z0-9-]+\\s+)*)?([A-Z][A-Z0-9-]+)\\s+-`, 'g');
  let match;
  while ((match = re.exec(block)) !== null) {
    const [, time, away, scoreToken, home, , stadium] = match;
    let awayScore = null;
    let homeScore = null;
    let isFinal = false;
    if (scoreToken !== ':') {
      const parts = scoreToken.split(':').map(Number);
      awayScore = Number.isFinite(parts[0]) ? parts[0] : null;
      homeScore = Number.isFinite(parts[1]) ? parts[1] : null;
      isFinal = awayScore !== null && homeScore !== null;
    }
    games.push({
      id: `${searchDate}-${away}-${home}`,
      date: searchDate,
      away,
      home,
      awayScore,
      homeScore,
      isFinal,
      statusLabel: isFinal ? '경기 종료' : '경기 예정',
      stadium,
      time,
      winningPitcher: null,
      losingPitcher: null,
      savePitcher: null
    });
  }
  return games;
}

function parseStandingsKorean(lines) {
  const standings = [];
  let inTable = false;
  const rowRe = /^(\d+)\s+(KT|SSG|NC|한화|롯데|삼성|두산|LG|KIA|키움)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.\-]+)\s+(\d+승\d+무\d+패)\s+(\d+승|\d+패|\d+무|-)\s+([\d-]+)\s+([\d-]+)$/;

  for (const line of lines) {
    if (line.startsWith('순위 팀명 경기 승 패 무 승률 게임차 최근10경기 연속 홈 방문')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (line.startsWith('팀간 승패표')) break;
    const m = line.match(rowRe);
    if (!m) continue;
    const [, rank, teamKo, games, wins, losses, draws, pct, gb, recent10, streak, home, away] = m;
    const team = normalizeTeam(teamKo);
    standings.push({
      rank: Number(rank),
      team,
      teamKo,
      games: Number(games),
      wins: Number(wins),
      losses: Number(losses),
      draws: Number(draws),
      pct,
      gb,
      recent10,
      streak,
      home,
      away
    });
  }

  return standings;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=180');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const team = normalizeTeam(req.query.team || 'LG');
  const today = koreaDateString();

  const scoreboardPromise = fetchHtmlWithTimeout(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${today}`, 3500);
  const standingsPromise = fetchHtmlWithTimeout('https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx', 3500);
  const dailyPromise = fetchHtmlWithTimeout('https://eng.koreabaseball.com/Schedule/DailySchedule.aspx', 3500);

  const [scoreboardResult, standingsResult, dailyResult] = await Promise.allSettled([
    scoreboardPromise,
    standingsPromise,
    dailyPromise
  ]);

  let todayGames = scoreboardResult.status === 'fulfilled'
    ? parseScoreboard(htmlToLines(scoreboardResult.value), today)
    : [];

  if (!todayGames.length && dailyResult.status === 'fulfilled') {
    todayGames = parseDailyScheduleForDate(htmlToText(dailyResult.value), today);
  }

  const standings = standingsResult.status === 'fulfilled'
    ? parseStandingsKorean(htmlToLines(standingsResult.value))
    : [];

  const rawTodayGame = todayGames.find(game => game.home === team || game.away === team) || null;
  let myTodayGame = null;
  if (rawTodayGame) {
    const opponent = inferOpponent(rawTodayGame, team);
    const isHome = rawTodayGame.home === team;
    const myScore = isHome ? rawTodayGame.homeScore : rawTodayGame.awayScore;
    const oppScore = isHome ? rawTodayGame.awayScore : rawTodayGame.homeScore;
    const result = rawTodayGame.isFinal && myScore !== null && oppScore !== null
      ? (myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무')
      : null;
    myTodayGame = {
      ...rawTodayGame,
      awayKo: toKoreanTeam(rawTodayGame.away),
      homeKo: toKoreanTeam(rawTodayGame.home),
      opponentKo: toKoreanTeam(opponent),
      result
    };
  }

  return res.status(200).json({
    source: 'kbo-official',
    fetchedAt: new Date().toISOString(),
    today,
    team,
    teamKo: toKoreanTeam(team),
    themeColor: TEAM_MAP[team]?.color || '#B31F45',
    myTodayGame,
    standings,
    myStanding: standings.find(item => item.team === team) || null,
    recentGames: [],
    errors: {
      scoreboard: scoreboardResult.status === 'rejected' ? String(scoreboardResult.reason) : null,
      standings: standingsResult.status === 'rejected' ? String(standingsResult.reason) : null,
      dailySchedule: dailyResult.status === 'rejected' ? String(dailyResult.reason) : null
    }
  });
};
