const clampSentence = (text = '', max = 72) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
};

const compress = (text = '') => {
  return clampSentence(
    text
      .replace(/감정:\s*/g, '')
      .replace(/한 줄 요약:\s*/g, '')
      .replace(/좋았던 장면:\s*/g, '')
      .replace(/아쉬웠던 장면:\s*/g, '')
      .replace(/다음 경기 기대:\s*/g, '')
      .replace(/\n+/g, ' · ')
  );
};

const fallbackSoften = (text = '') => {
  let out = text;
  const replacements = [
    [/개새끼|개쉑|개색기|개색끼|개놈/gi, '플레이가 많이 아쉬웠다'],
    [/씨발|시발|ㅅㅂ|ㅆㅂ/gi, '정말'],
    [/존나|겁나/gi, '꽤'],
    [/개잘/gi, '정말 좋게'],
    [/개못/gi, '많이 아쉽게'],
    [/병신|븅신/gi, '판단이 아쉬웠다'],
    [/미친|미쳤네|돌았네/gi, '강하게 느껴졌다'],
    [/빡치|열받/gi, '답답하'],
    [/꺼져|짜증나/gi, '아쉬움이 크다'],
    [/못하네|못하냐/gi, '경기력이 기대에 못 미쳤다'],
    [/왜 저래|뭐하냐/gi, '판단이 아쉽다'],
    [/망했네/gi, '흐름이 좋지 않았다']
  ];

  replacements.forEach(([pattern, value]) => {
    out = out.replace(pattern, value);
  });

  const short = compress(out);
  return {
    softened: short || '오늘 경기는 아쉬움이 크게 남았다.',
    alternatives: [
      clampSentence(`${short} 경기 흐름을 다시 볼 필요가 있다.`),
      clampSentence(`${short} 다음 경기에서 보완점이 보였다.`)
    ]
  };
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text = '', team = '' } = req.body || {};
    if (!text.trim()) return res.status(400).json({ error: 'text is required' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ mode: 'fallback', ...fallbackSoften(text) });
    }

    const prompt = `너는 KBO 팬 기록 앱의 문장 정리 도우미야.
사용자 원문은 욕설이나 과격한 말이 섞여 있을 수 있다.
해야 할 일:
1) 욕설과 비속어를 자연스럽게 지운다.
2) 감정은 남기되 공격적 표현은 기록형 문장으로 바꾼다.
3) 결과는 반드시 짧고 간결해야 한다.
4) softened는 한 문장, 45자 이내.
5) alternatives는 각 28자 이내의 아주 짧은 대안 2개.
6) 한국어만 사용.

반드시 JSON만 반환:
{
  "softened": "...",
  "alternatives": ["...", "..."]
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
            name: 'softened_baseball_note_short',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                softened: { type: 'string' },
                alternatives: {
                  type: 'array',
                  items: { type: 'string' },
                  minItems: 2,
                  maxItems: 2
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
    } catch {
      parsed = null;
    }

    if (!parsed?.softened) {
      return res.status(200).json({ mode: 'fallback', ...fallbackSoften(text) });
    }

    return res.status(200).json({
      mode: 'openai',
      softened: clampSentence(parsed.softened, 72),
      alternatives: (parsed.alternatives || []).slice(0, 2).map(item => clampSentence(item, 40))
    });
  } catch (error) {
    return res.status(200).json({ mode: 'fallback', error: String(error), ...fallbackSoften(req.body?.text || '') });
  }
};
