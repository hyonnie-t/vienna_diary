# vienna_diary — 1815~1848 역할 일기

2학년 세계사 수업용 개별 웹앱(정적 파일). 카드를 뽑아 인물이 되어 일기를 쓴다. 패들렛 버튼 방식의 기준 구현이다.
배포: https://hyonnie-t.github.io/vienna_diary/ (GitHub Pages). 저장소는 public이다.

## 구조
- `index.html` / `app.js` / `data.js`(카드·자료) / `glossary.js` / `style.css`
- `draft_guard.js`(임시저장), `focus_guard.js`
- 활동 id: `CONFIG.GAME_NAME` = `30차시_역할일기_1815_1848`

## 규칙
- 다른 글쓰기 웹앱의 패들렛 버튼(`padletBtn`, `padlet-box`)은 이 앱 방식을 따른다.
- 카드 다시 뽑기는 1번만 허용한다. 일기장은 칸마다 1~2문장으로 부담을 줄인다.
- 임시저장에서 되살아난 안내 문구는 비우고 제출 때 막는다. 교과서 문장 그대로 제출은 막는다.
- 백엔드는 `history26_backend`. URL·ID·토큰을 새로 적지 않는다.
- 태블릿 대응이 기본이다. 푸시는 작업 브랜치에만, `main` 병합은 효니가 한다.
- 수정·배포 뒤에는 배포 주소를 내장 브라우저로 직접 열어 확인한 다음 보고한다.
