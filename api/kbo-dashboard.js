export default async function handler(req, res) {
  return res.status(200).json({
    updatedAt: new Date().toISOString(),
    games: [
      { date: '2026-04-02', home: 'LG 트윈스', away: '두산 베어스', status: '경기 종료', score: '5 : 3' },
      { date: '2026-04-02', home: 'KIA 타이거즈', away: '삼성 라이온즈', status: '경기 종료', score: '4 : 6' },
      { date: '2026-04-02', home: 'KT 위즈', away: '롯데 자이언츠', status: '경기 예정', score: '-' },
      { date: '2026-04-02', home: '한화 이글스', away: 'SSG 랜더스', status: '경기 종료', score: '2 : 1' },
      { date: '2026-04-02', home: 'NC 다이노스', away: '키움 히어로즈', status: '경기 종료', score: '7 : 7' }
    ],
    standings: [
      { rank: 1, team: 'LG 트윈스', win: 8, lose: 3, draw: 0, pct: '0.727', gb: '-' },
      { rank: 2, team: 'KIA 타이거즈', win: 7, lose: 4, draw: 0, pct: '0.636', gb: '1.0' },
      { rank: 3, team: '한화 이글스', win: 7, lose: 4, draw: 0, pct: '0.636', gb: '1.0' },
      { rank: 4, team: '삼성 라이온즈', win: 6, lose: 5, draw: 0, pct: '0.545', gb: '2.0' },
      { rank: 5, team: '롯데 자이언츠', win: 5, lose: 5, draw: 1, pct: '0.500', gb: '2.5' },
      { rank: 6, team: '두산 베어스', win: 5, lose: 6, draw: 0, pct: '0.455', gb: '3.0' },
      { rank: 7, team: 'SSG 랜더스', win: 4, lose: 6, draw: 1, pct: '0.400', gb: '3.5' },
      { rank: 8, team: 'KT 위즈', win: 4, lose: 7, draw: 0, pct: '0.364', gb: '4.0' },
      { rank: 9, team: 'NC 다이노스', win: 3, lose: 7, draw: 1, pct: '0.300', gb: '4.5' },
      { rank: 10, team: '키움 히어로즈', win: 2, lose: 8, draw: 1, pct: '0.200', gb: '5.5' }
    ]
  });
}
