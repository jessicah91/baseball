export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const text = String(body.text || "").trim();

  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY is not set",
      fallback: "환경변수 설정 전이라 GPT 순화를 사용할 수 없어요."
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: "너는 한국어 야구 팬 기록 사이트의 표현 순화 도우미다. 사용자의 감정은 지우지 말고, 욕설/쌍욕/과격한 표현만 기록형 문장으로 자연스럽게 바꿔라. 비꼼은 줄이고, 경기 회고 문체로 바꿔라. 응답은 JSON만 반환한다."
              }
            ]
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `다음 문장을 순화해줘: ${text}`
              }
            ]
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "softened_text",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                original: { type: "string" },
                softened: { type: "string" }
              },
              required: ["original", "softened"]
            }
          }
        }
      })
    });

    const data = await response.json();

    const parsed =
      data?.output?.[0]?.content?.find?.((item) => item.type === "output_text")?.text ||
      data?.output_text ||
      "";

    if (!parsed) {
      return res.status(502).json({ error: "No model output", raw: data });
    }

    return res.status(200).json(JSON.parse(parsed));
  } catch (error) {
    return res.status(500).json({
      error: "Failed to soften text",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}
