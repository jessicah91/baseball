const { getTeam, fetchRecentGames } = require('./_lib/kbo');

module.exports = async (req, res) => {
  const team = getTeam(req.query.team || 'LOTTE');
  const limit = Math.max(1, Math.min(10, Number(req.query.limit || 5)));

  const payload = {
    source: 'kbo-official',
    fetchedAt: new Date().toISOString(),
    team: team.code,
    limit,
    games: [],
    error: null
  };

  try {
    payload.games = await fetchRecentGames(team.code, limit);
    if (!payload.games.length) payload.error = '최근 경기 파싱 결과가 비어 있어요.';
  } catch (error) {
    payload.error = error.message;
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json(payload);
};
