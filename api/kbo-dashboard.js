const {
  TEAM_MAP,
  TEAM_PATTERN,
  normalizeTeam,
  toKoreanTeam,
  koreaDateString,
  shiftDate,
  htmlToLines,
  fetchHtml,
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

function parseStandings(lines) {
  const re = new RegExp(`^(\\d+)\\s+(${TEAM_PATTERN})\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+(\\d+)\\s+([\\d.]+)\\s+([\\d.-]+)\\s+([WLD]\\d+)\\s+(\\d+-\\d+-\\d+)\\s+(\\d+-\\d+-\\d+)$`);
  const list = [];
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const [, rank, team, games, wins, losses, draws, pct, gb, streak, home, away] = m;
    list.push({
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
      away
    });
  }
  return list.slice(0, 10);
}

function decorateRecentGame(game, team) {
  const isHome = game.home === team;
  const myScore = isHome ? game.homeScore : game.awayScore;
  const oppScore = isHome ? game.awayScore : game.homeScore;
  const opponent = inferOpponent(game, team);
  return {
    ...game,
    myTeam: team,
    myTeamKo: toKoreanTeam(team),
    opponent,
    opponentKo: toKoreanTeam(opponent),
    awayKo: toKoreanTeam(game.away),
    homeKo: toKoreanTeam(game.home),
    result: myScore > oppScore ? '승' : myScore < oppScore ? '패' : '무',
    myScore,
    oppScore,
    scoreLabel: `${toKoreanTeam(team)} ${myScore} : ${oppScore} ${toKoreanTeam(opponent)}`,
    holdPitchers: null,
    decisiveHitter: null
  };
}

async function getRecentGames(team, limit, today, todayGames = []) {
  const results = [];
  const seen = new Set();

  for (const game of todayGames.filter(item => item.isFinal && (item.away === team || item.home === team))) {
    if (seen.has(game.id)) continue;
    seen.add(game.id);
    results.push(decorateRecentGame(game, team));
  }

  const lookbackDays = limit === 10 ? 14 : 8;
  const dates = Array.from({ length: lookbackDays }, (_, index) => shiftDate(today, -(index + 1)));
  const settled = await Promise.allSettled(
    dates.map(date => fetchHtml(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${date}`))
  );

  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    if (result.status !== 'fulfilled') continue;
    const date = dates[index];
    const games = parseScoreboard(htmlToLines(result.value), date)
      .filter(game => game.isFinal && (game.away === team || game.home === team));
    for (const game of games) {
      if (seen.has(game.id)) continue;
      seen.add(game.id);
      results.push(decorateRecentGame(game, team));
      if (results.length >= limit) return results.slice(0, limit);
    }
  }

  return results.slice(0, limit);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const team = normalizeTeam(req.query.team || 'LG');
  const limit = Number(req.query.limit || 5) === 10 ? 10 : 5;
  const today = koreaDateString();

  const scoreboardPromise = fetchHtml(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${today}`);
  const standingsPromise = fetchHtml('https://eng.koreabaseball.com/Standings/TeamStandings.aspx');

  const [scoreboardResult, standingsResult] = await Promise.allSettled([scoreboardPromise, standingsPromise]);

  const todayGames = scoreboardResult.status === 'fulfilled'
    ? parseScoreboard(htmlToLines(scoreboardResult.value), today)
    : [];

  const recentGames = await getRecentGames(team, limit, today, todayGames);
  const standings = standingsResult.status === 'fulfilled'
    ? parseStandings(htmlToLines(standingsResult.value))
    : [];

  const rawTodayGame = todayGames.find(game => game.home === team || game.away === team) || null;
  let myTodayGame = null;
  if (rawTodayGame) {
    const opponent = inferOpponent(rawTodayGame, team);
    const isHome = rawTodayGame.home === team;
    const result = rawTodayGame.isFinal
      ? ((isHome ? rawTodayGame.homeScore : rawTodayGame.awayScore) > (isHome ? rawTodayGame.awayScore : rawTodayGame.homeScore) ? '승' : '패')
      : null;
    myTodayGame = {
      ...rawTodayGame,
      awayKo: toKoreanTeam(rawTodayGame.away),
      homeKo: toKoreanTeam(rawTodayGame.home),
      opponentKo: toKoreanTeam(opponent),
      result
    };
  }

  const sourceBits = [];
  if (scoreboardResult.status === 'fulfilled') sourceBits.push('kbo-scoreboard');
  if (standingsResult.status === 'fulfilled') sourceBits.push('kbo-standings');
  if (recentGames.length) sourceBits.push('recent-games');

  return res.status(200).json({
    source: sourceBits.length ? sourceBits.join('+') : 'fallback',
    errors: {
      scoreboard: scoreboardResult.status === 'rejected' ? String(scoreboardResult.reason) : null,
      standings: standingsResult.status === 'rejected' ? String(standingsResult.reason) : null
    },
    fetchedAt: new Date().toISOString(),
    today,
    team,
    teamKo: toKoreanTeam(team),
    themeColor: TEAM_MAP[team]?.color || '#B31F45',
    limit,
    myTodayGame,
    standings,
    myStanding: standings.find(item => item.team === team) || null,
    recentGames
  });
};
