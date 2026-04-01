const {
  TEAM_PATTERN,
  normalizeTeam,
  toKoreanTeam,
  koreaDateString,
  shiftDate,
  htmlToLines,
  fetchHtmlWithTimeout,
  inferOpponent,
  chunk
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
  const finalRe = new RegExp(`^(${TEAM_PATTERN})\\s+(\\d+)\\s+(FINAL|SUSPENDED|CALLED|GAME OVER)\\s+(\\d+)\\s+(${TEAM_PATTERN})$`);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = line.match(finalRe);
    if (!match) continue;
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
  }
  return games;
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

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=180');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const team = normalizeTeam(req.query.team || 'LG');
  const limit = Number(req.query.limit || 5) === 10 ? 10 : 5;
  const today = koreaDateString();
  const errors = [];
  const seen = new Set();
  const results = [];

  const lookbackDays = 35;
  const dates = [];
  for (let offset = 1; offset <= lookbackDays; offset += 1) {
    dates.push(shiftDate(today, -offset));
  }

  for (const batch of chunk(dates, 5)) {
    if (results.length >= limit) break;
    const settled = await Promise.allSettled(
      batch.map(date => fetchHtmlWithTimeout(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${date}`, 5000))
    );

    settled.forEach((item, index) => {
      const date = batch[index];
      if (item.status === 'rejected') {
        errors.push(`scoreboard:${date}:${String(item.reason)}`);
        return;
      }
      const games = parseScoreboard(htmlToLines(item.value), date)
        .filter(game => game.isFinal && (game.away === team || game.home === team));
      for (const game of games) {
        if (seen.has(game.id)) continue;
        seen.add(game.id);
        results.push(decorateRecentGame(game, team));
      }
    });
  }

  results.sort((a, b) => b.date.localeCompare(a.date));

  return res.status(200).json({
    source: 'kbo-official',
    team,
    limit,
    recentGames: results.slice(0, limit),
    errors
  });
};
