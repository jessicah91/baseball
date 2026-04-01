const { htmlToLines, fetchHtml } = require('./_utils');

function pick(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function parseExtrasFromText(text = '') {
  const compact = String(text).replace(/\s+/g, ' ').trim();
  const holds = [
    ...compact.matchAll(/홀드투수\s*:?\s*([A-Za-z가-힣 .,'-]+)/gi),
    ...compact.matchAll(/Hold(?: Pitcher)?\s*:?\s*([A-Za-z가-힣 .,'-]+)/gi)
  ].map(match => match[1].trim()).filter(Boolean);
  return {
    winningPitcher: pick(compact, [/승리투수\s*:?\s*([A-Za-z가-힣 .,'-]+)/i, /Winning Pitcher\s*:?\s*([A-Za-z가-힣 .,'-]+)/i]),
    losingPitcher: pick(compact, [/패전투수\s*:?\s*([A-Za-z가-힣 .,'-]+)/i, /Losing Pitcher\s*:?\s*([A-Za-z가-힣 .,'-]+)/i]),
    savePitcher: pick(compact, [/세이브투수\s*:?\s*([A-Za-z가-힣 .,'-]+)/i, /Save Pitcher\s*:?\s*([A-Za-z가-힣 .,'-]+)/i]),
    holdPitchers: holds.length ? [...new Set(holds)].join(', ') : null,
    decisiveHitter: pick(compact, [/결승타(?:자)?\s*:?\s*([A-Za-z가-힣 .,'-]+)/i, /Decisive Hit(?:ter)?\s*:?\s*([A-Za-z가-힣 .,'-]+)/i])
  };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const date = String(req.query.date || '').trim();
  const awayKo = String(req.query.awayKo || req.query.away || '').trim();
  const homeKo = String(req.query.homeKo || req.query.home || '').trim();
  if (!date || !awayKo || !homeKo) {
    return res.status(200).json({ winningPitcher: null, losingPitcher: null, savePitcher: null, holdPitchers: null, decisiveHitter: null });
  }

  try {
    const query = encodeURIComponent(`${date.replace(/-/g, '.')} ${awayKo} ${homeKo} 승리투수 패전투수 세이브투수 홀드투수 결승타 네이버 스포츠 국내야구`);
    const html = await fetchHtml(`https://search.naver.com/search.naver?where=nexearch&query=${query}`);
    const extras = parseExtrasFromText(htmlToLines(html).join(' '));
    return res.status(200).json(extras);
  } catch (error) {
    return res.status(200).json({ winningPitcher: null, losingPitcher: null, savePitcher: null, holdPitchers: null, decisiveHitter: null });
  }
};
