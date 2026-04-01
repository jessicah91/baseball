const {
  TEAM_PATTERN,
  normalizeTeam,
  toKoreanTeam,
  koreaDateString,
  shiftDate,
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

function parseDailyScheduleMonth(text, year) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const dateBlockRe = /(\d{2})\.(\d{2})\([A-Z]{3}\)\s+REGULAR\s+([\s\S]*?)(?=(\d{2}\.\d{2}\([A-Z]{3}\)\s+REGULAR)|$)/g;
  const games = [];
  let block;
  while ((block = dateBlockRe.exec(normalized)) !== null) {
    const [, mm, dd, body] = block;
    const searchDate = `${year}-${mm}-${dd}`;
    const gameRe = new RegExp(`(\\d{1,2}:\\d{2})\\s+(${TEAM_PATTERN})\\s+(\\d+:\\d+|:)\\s+(${TEAM_PATTERN})\\s+((?:[A-Z0-9-]+\\s+)*)?([A-Z][A-Z0-9-]+)\\s+-`, 'g');
    let match;
    while ((match = gameRe.exec(body)) !== null) {
      const [, time, away, scoreToken, home, , stadium] = match;
      if (scoreToken === ':') continue;
      const [awayScore, homeScore] = scoreToken.split(':').map(Number);
      games.push({
        id: `${searchDate}-${away}-${home}`,
        date: searchDate,
        away,
        home,
        awayScore,
        homeScore,
        isFinal: true,
        statusLabel: '경기 종료',
        stadium,
        time,
        winningPitcher: null,
        losingPitcher: null,
        savePitcher: null
      });
    }
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
  const currentYear = today.slice(0, 4);
  const results = [];
  const seen = new Set();
  const errors = [];

  try {
    const monthHtml = await fetchHtmlWithTimeout('https://eng.koreabaseball.com/Schedule/DailySchedule.aspx', 3500);
    const monthGames = parseDailyScheduleMonth(htmlToText(monthHtml), currentYear)
      .filter(game => game.date < today && (game.away === team || game.home === team))
      .sort((a, b) => b.date.localeCompare(a.date));

    for (const game of monthGames) {
      if (seen.has(game.id)) continue;
      seen.add(game.id);
      results.push(decorateRecentGame(game, team));
      if (results.length >= limit) break;
    }
  } catch (error) {
    errors.push(`daily-schedule:${String(error)}`);
  }

  if (results.length < limit) {
    const maxLookback = limit === 10 ? 12 : 7;
    for (let offset = 1; offset <= maxLookback && results.length < limit; offset += 1) {
      const date = shiftDate(today, -offset);
      try {
        const html = await fetchHtmlWithTimeout(`https://eng.koreabaseball.com/Schedule/Scoreboard.aspx?searchDate=${date}`, 2200);
        const games = parseScoreboard(htmlToLines(html), date)
          .filter(game => game.isFinal && (game.away === team || game.home === team));
        for (const game of games) {
          if (seen.has(game.id)) continue;
          seen.add(game.id);
          results.push(decorateRecentGame(game, team));
          if (results.length >= limit) break;
        }
      } catch (error) {
        errors.push(`scoreboard:${date}:${String(error)}`);
      }
    }
  }

  return res.status(200).json({
    source: 'kbo-official',
    team,
    limit,
    recentGames: results.slice(0, limit),
    errors
  });
};
