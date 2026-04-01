# 덕아웃 노트 / 픽셀 다이어리

모바일 우선 KBO 팬 기록 웹앱입니다.

## 이번 수정 포인트
- KBO 공식 영문 스코어보드 + 팀순위 기준으로 오늘 경기 / 최근 경기 / 순위 표시
- 최근 경기 수집 로직을 줄여 Vercel 타임아웃 가능성 완화
- 경기 상세는 KBO 값 우선, 부족한 값은 네이버 스포츠 검색 기반 fallback 시도
- KBO 다이아고딕 적용 준비
- 버튼과 패널을 더 눌리는 픽셀 게임 느낌으로 조정

## 꼭 같이 올릴 것
`fonts/` 폴더에 아래 파일을 직접 넣어 주세요.
- `KBO Dia Gothic_bold.ttf`
- `KBO Dia Gothic_medium.ttf`
- `KBO Dia Gothic_light.ttf`

이 저장소에는 폰트 파일을 넣지 않았고, `styles.css`가 위 경로를 참조합니다.

## Vercel 환경변수
- `OPENAI_API_KEY` : GPT 순화 기능용

## 배포 순서
1. 압축을 풀고 기존 저장소 파일과 교체
2. 위 폰트 3개를 `fonts/` 폴더에 넣기
3. GitHub push
4. Vercel 재배포


## Data fetching notes

- `/api/kbo-dashboard` now loads **today's game + standings** first so the main screen can render quickly.
- `/api/recent-games` loads the recent 5/10 games separately so a slow recent-games fetch does not blank the whole page.
- The site uses **KBO official English Daily Schedule / Scoreboard / Team Standings** pages as the main source.
