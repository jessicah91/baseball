# 야구노트 웹앱

모바일 친화적인 야구 기록 사이트 기본 버전입니다.

## 들어있는 기능
- 경기 기록 작성
- 템플릿 / 자유양식 전환
- 욕 순화 도우미
- 경기/순위 데모 영역
- 기본/중급/심화 룰 안내
- 타구 낙하지점 애니메이션 예시
- 로컬 저장

## 파일 구조
- `index.html` : 화면 구조
- `styles.css` : 스타일
- `app.js` : 프론트 로직
- `api/soften.js` : GPT 욕 순화 API 예시
- `api/kbo-dashboard.js` : 경기/순위표 API 자리
- `vercel.json` : Vercel 배포 설정
- `.env.example` : 환경변수 예시

## GitHub에 올리는 순서
```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

## Vercel 연결
1. GitHub 저장소를 Vercel에 연결
2. 환경변수에 `OPENAI_API_KEY` 추가
3. 배포

## 로컬 실행
정적 파일이라서 그냥 열어도 되지만, API 테스트까지 하려면 간단 서버가 있으면 좋습니다.

예:
```bash
python3 -m http.server 8000
```

그 뒤 브라우저에서 `http://localhost:8000`

## API 메모

### 1) GPT 순화 API
프론트에서 `/api/soften` 으로 POST 요청을 보내도록 맞춰 쓰면 됩니다.

요청 예시:
```json
{ "text": "진짜 개빡친다" }
```

응답 예시:
```json
{
  "original": "진짜 개빡친다",
  "softened": "오늘 경기 운영이 많이 아쉬웠고 감정이 크게 올라왔다."
}
```

### 2) 경기 / 순위표 API
프론트에서 `/api/kbo-dashboard` 를 호출하면
- 오늘 경기 목록
- 순위표
를 JSON으로 받는 구조로 확장하면 됩니다.

## 다음 추천 작업
- 팀별 게시판
- 회원가입 / 로그인
- 공개 피드
- 좋아요 / 공감
- GPT 순화 품질 개선
- 실제 KBO 데이터 연동
