# DKphotobox GitHub Console

이 폴더는 GitHub Pages에서 여는 DKphotobox 콘솔 화면을 담는다.

- 메인 콘솔: `consoleindex.html`
- 폴더 기본 진입: `index.html` -> `consoleindex.html`
- 로컬 데이터 API: `http://127.0.0.1:8020`

GitHub Pages의 화면은 정적 HTML로 동작하고, 예약/고객/작업 데이터는 현장 PC에서 실행 중인 DKphotobox 로컬 API를 통해 읽는다.

로컬 API가 꺼져 있거나 Google Drive/Sheets 권한이 부족하면 실제 데이터는 표시하지 않고 다음 안내를 보여준다.

> 권한이 없을 때는 표시 안되고 권한 획득을 진행해야 표시됩니다.
