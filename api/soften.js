const fallbackSoften = (text = '') => {
  let out = text;
  const replacements = [
    [/개새끼|개쉑|개색기|개색끼|개놈/gi, '정말 아쉬운 플레이'],
    [/씨발|시발|ㅅㅂ|ㅆㅂ/gi, '정말'],
    [/존나|겁나|개잘|개못/gi, '아주'],
    [/병신|븅신/gi, '너무 아쉬운 선택'],
    [/미친|미쳤네|돌았네/gi, '정말 강렬한'],
    [/빡치|열받/gi, '답답하'],
    [/꺼져|짜증나/gi, '아쉬움이 크다'],
    [/못하네|못하냐/gi, '오늘 경기력이 기대에 못 미친다'],
    [/왜 저래|뭐하냐/gi, '판단이 아쉽다'],
    [/망했네/gi, '흐름이 좋지 않다']
  ];

  replacements.forEach(([pattern, value]) => {
    out = out.replace(pattern, value);
  });

  return {
    softened: out.trim(),
    alternatives: [
      `감정은 컸지만, 경기 흐름으로 정리하면: ${out.trim()}`,
      `팬 시선 기록: 오늘은 ${out.trim()}고, 다음 경기에서 보완이 필요해 보인다.`,
      `짧게 정리하면 ${out.trim()}는 아쉬웠다.`
    ]
  };
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text = '', team = '' } = req.body || {};
    if (!text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ mode: 'fallback', ...fallbackSoften(text) });
    }

    const prompt = `너는 KBO 팬 기록 앱의 문장 정리 도우미야.
사용자가 감정적으로 쓴 문장을 받아서:
1) 욕설/비속어는 없애고
2) 감정은 죽이지 말고
3) 경기 기록처럼 읽히게 다듬고
4) 과장된 비난 대신 관찰/회고 톤으로 바꾸고
5) 한국어로 자연스럽게 써.

반드시 JSON만 반환:
{
  "softened": "...",
  "alternatives": ["...", "...", "..."]
}

마이팀: ${team || '미설정'}
원문: ${text}`;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'softened_baseball_note',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                softened: { type: 'string' },
                alternatives: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 3,
                  maxItems: 3
                }
              },
              required: ['softened', 'alternatives']
            }
          }
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(200).json({ mode: 'fallback', api_error: err, ...fallbackSoften(text) });
    }

    const data = await response.json();
    let parsed = null;

    try {
      parsed = JSON.parse(data.output_text || '{}');
    } catch (e) {
      parsed = null;
    }

    if (!parsed?.softened) {
      return res.status(200).json({ mode: 'fallback', ...fallbackSoften(text) });
    }

    return res.status(200).json({ mode: 'openai', ...parsed });
  } catch (error) {
    return res.status(200).json({ mode: 'fallback', error: String(error), ...fallbackSoften(req.body?.text || '') });
  }
};
