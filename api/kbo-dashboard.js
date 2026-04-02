const { getTeam, fetchDailyStandings, fetchScoreboardForDate, formatEngScoreDate, findTodayGame, getMyStanding } = require('./_lib/kbo');

module.exports = async (req, res) => {
  const team = getTeam(req.query.team || 'LOTTE');
  const today = new Date();
  const todayString = formatEngScoreDate(today);

  const payload = {
    source: 'kbo-official',
    fetchedAt: new Date().toISOString(),
    today: todayString,
    team: team.code,
    teamKo: team.koShort,
    themeColor: team.color,
    myTodayGame: null,
    standings: [],
    myStanding: null,
    errors: {
      scoreboard: null,
      standings: null
    }
  };

  try {
    const scoreboard = await fetchScoreboardForDate(todayString);
    payload.myTodayGame = findTodayGame(scoreboard, team.code);
  } catch (error) {
    payload.errors.scoreboard = error.message;
  }

  try {
    const standings = await fetchDailyStandings();
    payload.standings = standings;
    payload.myStanding = getMyStanding(standings, team.code);
  } catch (error) {
    payload.errors.standings = error.message;
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json(payload);
};
