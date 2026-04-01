# 야구노트 웹앱

마이팀 중심으로 경기 결과를 보고, GPT 욕 순화 도우미와 줄글 기록 미리보기를 쓸 수 있는 모바일 친화 웹앱입니다.

## 포함 기능
- 마이팀 설정 및 브라우저 저장
- 마이팀 경기만 필터링해서 표시
- GPT 욕 순화 API (`/api/soften`)
- GPT 미연결 시 로컬 순화 fallback
- 템플릿 / 자유양식 기록 작성
- 기록 미리보기를 자연스러운 줄글 회고 형태로 생성

## 로컬 실행
정적 파일만 볼 때는 `index.html`을 열면 됩니다.

## Vercel 배포
1. GitHub에 업로드
2. Vercel에서 저장소 Import
3. 환경변수 추가
   - `OPENAI_API_KEY`
4. 재배포

## 파일 구조
- `index.html` : 메인 화면
- `styles.css` : 스타일
- `app.js` : 프론트 로직
- `api/soften.js` : GPT 욕 순화 API
- `api/kbo-dashboard.js` : 경기/순위 샘플 API
