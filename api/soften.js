const clampSentence = (text = '', max = 44) => {
  const cleaned = String(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1).trim()}…`;
};

const cleanBaseballTone = (text = '') => {
  let out = String(text);
  const replacements = [
    [/개새끼|개쉑|개색기|개색끼|개놈|새끼야/gi, '선수가 많이 아쉬웠다'],
    [/씨발|시발|ㅆㅂ|ㅅㅂ|시바/gi, '정말'],
    [/존나|겁나|뒤지게/gi, '너무'],
    [/개잘했|개잘하|존잘하/gi, '정말 잘했'],
    [/개못했|개못하|존못하/gi, '많이 아쉬웠'],
    [/병신|븅신|멍청하네|돌대가리/gi, '판단이 아쉬웠다'],
    [/미친|돌았네|레전드네/gi, '강하게 느껴졌다'],
    [/빡치|열받|짜증나|짜치/gi, '답답하'],
    [/꺼져|망했네|왜 저래|뭐하냐|어이없네/gi, '흐름이 아쉬웠다'],
    [/못하네|못하냐|말이 되냐/gi, '경기력이 기대에 못 미쳤다'],
    [/개판|노답|답이 없네/gi, '운영이 많이 아쉬웠다']
  ];
  replacements.forEach(([pattern, value]) => { out = out.replace(pattern, value); });
  return out.replace(/\s+/g, ' ').trim();
};

const fallbackSoften = (text = '') => {
  const cleaned = cleanBaseballTone(text)
    .replace(/감정:\s*/g, '')
    .replace(/한 줄 요약:\s*/g, '')
    .replace(/좋았던 장면:\s*/g, '')
    .replace(/아쉬웠던 장면:\s*/g, '')
    .replace(/다음 경기 기대:\s*/g, '')
    .replace(/\n+/g, ' ');

  const softened = clampSentence(cleaned || '오늘 경기는 운영이 아쉬웠다.', 38);
  return {
    softened,
    alternatives: [
      clampSentence(`${softened} 그래도 볼 점은 있었다.`, 30),
      clampSentence('다음 경기 보완점이 더 선명해졌다.', 30)
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
    if (!String(text).trim()) return res.status(400).json({ error: 'text is required' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(200).json({ mode: 'fallback', ...fallbackSoften(text) });
    }

    const prompt = `너는 KBO 팬 기록 앱의 문장 정리 도우미야.
원문에는 쌍욕과 과격한 표현이 섞여 있을 수 있다.
반드시 해야 할 일:
1) 욕설과 비속어를 완전히 없앤다.
2) 경기 관찰 문장처럼 짧게 바꾼다.
3) softened는 한국어 한 문장, 38자 이내.
4) alternatives는 한국어 두 문장, 각 24자 이내.
5) 길게 설명하지 말고 감정만 과하지 않게 남긴다.
6) JSON만 반환한다.

출력 형식:
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
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
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
      softened: clampSentence(parsed.softened, 38),
      alternatives: (parsed.alternatives || []).slice(0, 2).map(item => clampSentence(item, 24))
    });
  } catch (error) {
    return res.status(200).json({ mode: 'fallback', error: String(error), ...fallbackSoften(req.body?.text || '') });
  }
};
