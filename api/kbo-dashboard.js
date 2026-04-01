export default async function handler(req, res) {
  // 여기는 실제 KBO 데이터 연동용 자리입니다.
  // 지금은 프론트 데모와 맞는 형태의 샘플 JSON만 반환합니다.

  return res.status(200).json({
    updatedAt: new Date().toISOString(),
    games: [
      {
        date: "2026-04-02",
        home: "LG 트윈스",
        away: "두산 베어스",
        status: "경기 종료",
        score: "5 : 3"
      },
      {
        date: "2026-04-02",
        home: "KIA 타이거즈",
        away: "삼성 라이온즈",
        status: "경기 예정",
        score: "-"
      }
    ],
    standings: [
      { rank: 1, team: "LG 트윈스", win: 8, lose: 3, draw: 0 },
      { rank: 2, team: "KIA 타이거즈", win: 7, lose: 4, draw: 0 },
      { rank: 3, team: "삼성 라이온즈", win: 6, lose: 5, draw: 0 }
    ]
  });
}
