# Baseball Note Mobile

모바일 우선으로 만든 KBO 팬 기록 웹앱입니다.

## 포함 기능
- 마이팀 설정
- 마이팀 경기만 표시
- 최근 5경기 / 최근 10경기 전환
- KBO 공식 사이트(영문 공식 페이지 포함) 기준 경기/순위 불러오기
- GPT 욕 순화 도우미
- 템플릿 / 자유 기록 작성
- 기록 미리보기 줄글 생성
- 라이트 / 나이트 모드
- 구단별 키 컬러 적용

## 실행
```bash
npm install
```

로컬 정적 실행은 아무 서버로 가능하지만, API 라우트 때문에 Vercel 배포를 권장합니다.

## Vercel 환경변수
- `OPENAI_API_KEY`

## 배포
1. GitHub 저장소에 업로드
2. Vercel에서 저장소 import
3. Environment Variables에 `OPENAI_API_KEY` 추가
4. Redeploy

## 참고
- KBO 폰트는 공식 페이지에서 배포되는 `KBO 다이아고딕`을 기준으로 `local()` 우선 적용했습니다.
- 실제 렌더링은 사용자 환경에 폰트가 설치되어 있거나, 추후 직접 웹폰트 파일을 연결하면 가장 안정적입니다.
