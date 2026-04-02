# Dugout Note KBO rebuild

이 버전은 데이터 로직을 다시 나눈 버전입니다.

- 순위: `TeamRankDaily.aspx` 텍스트 표 파싱
- 오늘 경기 / 최근 경기: 영문 `Scoreboard.aspx` 텍스트 파싱
- 경기 상세: KBO `GameCenter/Main.aspx`를 브라우저 자동화로 열어서 `리뷰` 탭 + `투수 기록` 표를 읽기

## 파일 적용

1. 압축을 풉니다.
2. GitHub 저장소에 같은 위치로 덮어씁니다.
3. `fonts/` 폴더에 아래 3개 파일이 있어야 합니다.
   - `KBO Dia Gothic_bold.ttf`
   - `KBO Dia Gothic_medium.ttf`
   - `KBO Dia Gothic_light.ttf`
4. push 후 Vercel 재배포합니다.

## 참고

`/api/game-detail`은 브라우저 자동화를 쓰기 때문에,
대시보드 API보다 느릴 수 있습니다.
