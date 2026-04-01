const BASE_REWRITES = [
  [/개같이|존나|좆|시발|씨발|ㅅㅂ|염병|미친/gi, '많이'],
  [/못하네|못하냐|못하냐고/gi, '아쉬웠다'],
  [/답답하네|답답하다/gi, '답답했다'],
  [/왜 이래|왜저래|왜 저래/gi, '운영이 아쉬웠다'],
  [/개빡치|빡치/gi, '아쉬움이 컸다']
];

function clamp(text, max = 34) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trim()}…` : cleaned;
}

function localSoften(text = '') {
  let softened = String(text || '');
  BASE_REWRITES.forEach(([pattern, replacement]) => {
    softened = softened.replace(pattern, replacement);
  });
  softened = softened
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[!]{2,}/g, '!')
    .trim();

  const short = clamp(softened || '오늘 경기는 전체적으로 아쉬움이 남았다.', 38);
  const alternatives = [
    clamp('운영과 흐름이 아쉬웠다.', 20),
    clamp('감정은 컸지만 기록으로 남기고 싶다.', 24)
  ];
  return { softened: short, alternatives };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = req.body?.text || '';
  const team = req.body?.team || '';
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(200).json({ mode: 'fallback', ...localSoften(text) });

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: '한국어 야구 팬 기록을 위한 순화 도우미다. 욕설과 거친 표현을 짧고 자연스럽고 기록용 문장으로 바꿔라. 길게 쓰지 말고 softened는 1문장 38자 이내, alternatives는 2개만 24자 이내로 만들어라. 팀 감정은 남기되 모욕 표현은 없애라. JSON만 출력하라.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              { type: 'input_text', text: `팀: ${team}\n원문: ${text}` }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'softened_note',
            schema: {
              type: 'object',
              properties: {
                softened: { type: 'string' },
                alternatives: {
                  type: 'array',
                  minItems: 2,
                  maxItems: 2,
                  items: { type: 'string' }
                }
              },
              required: ['softened', 'alternatives']
            }
          }
        }
      })
    });

    if (!response.ok) {
      return res.status(200).json({ mode: 'fallback', ...localSoften(text) });
    }

    const data = await response.json();
    let parsed = null;
    try {
      parsed = JSON.parse(data.output_text || '{}');
    } catch {
      parsed = null;
    }
    if (!parsed?.softened) return res.status(200).json({ mode: 'fallback', ...localSoften(text) });
    return res.status(200).json({
      mode: 'openai',
      softened: clamp(parsed.softened, 38),
      alternatives: (parsed.alternatives || []).slice(0, 2).map(item => clamp(item, 24))
    });
  } catch (error) {
    return res.status(200).json({ mode: 'fallback', ...localSoften(text) });
  }
};
