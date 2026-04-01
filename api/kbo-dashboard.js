const {
  TEAM_MAP,
  TEAM_PATTERN,
  normalizeTeam,
  toKoreanTeam,
  koreaDateString,
  htmlToLines,
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

  return [...new Map(games.map(game => [game.id, game])).values()];
}

function parseStandingsDaily(lines) {
  const standings = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('순위 팀명 경기 승 패 무 승률 게임차 최근10경기 연속 홈 방문')) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (line.startsWith('팀간 승패표')) break;

    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 12) continue;
    const [rank, teamKo, games, wins, losses, draws, pct, gb, recent10, streak, home, away] = tokens;
    if (!/^\d+$/.test(rank) || !/^\d+$/.test(games)) continue;
    standings.push({
      rank: Number(rank),
      team: normalizeTeam(teamKo),
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

  const [scoreboardResult, standingsResult] = await Promise.allSettled([
    fetchHtmlWithTimeout(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${today}`, 5000),
    fetchHtmlWithTimeout('https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx', 6000)
  ]);

  const todayGames = scoreboardResult.status === 'fulfilled'
    ? parseScoreboard(htmlToLines(scoreboardResult.value), today)
    : [];

  const standings = standingsResult.status === 'fulfilled'
    ? parseStandingsDaily(htmlToLines(standingsResult.value))
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
      standings: standingsResult.status === 'rejected' ? String(standingsResult.reason) : null
    }
  });
};
