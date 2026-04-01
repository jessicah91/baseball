export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const text = String(body.text || '').trim();
  const requestedVariants = Array.isArray(body.variants) && body.variants.length
    ? body.variants.map((v) => String(v))
    : ['차분하게', '기록형', '분석형'];

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: '너는 한국어 야구 팬 기록 사이트의 표현 순화 도우미다. 사용자의 감정은 지우지 말고 욕설·쌍욕·과격한 표현만 차분한 경기 회고 문장으로 바꾼다. 반드시 자연스러운 한국어로 쓰고, JSON만 반환한다.'
              }
            ]
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `원문: ${text}\n\n다음 라벨에 맞춰 순화 문장 ${requestedVariants.length}개를 만들어줘: ${requestedVariants.join(', ')}\n각 문장은 서로 톤이 다르되 모두 기록용 문장이어야 한다.`
              }
            ]
          }
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'softened_variants',
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                variants: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string' },
                      text: { type: 'string' }
                    },
                    required: ['label', 'text']
                  }
                }
              },
              required: ['variants']
            }
          }
        }
      })
    });

    const data = await response.json();
    const parsedText = data?.output?.[0]?.content?.find?.((item) => item.type === 'output_text')?.text || data?.output_text || '';
    if (!parsedText) {
      return res.status(502).json({ error: 'No model output', raw: data });
    }

    const parsed = JSON.parse(parsedText);
    if (!Array.isArray(parsed.variants)) {
      return res.status(502).json({ error: 'Invalid model response', raw: parsed });
    }

    return res.status(200).json({ variants: parsed.variants });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to soften text',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
