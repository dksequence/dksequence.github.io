Ladder Draw — 사운드 자산 폴더
================================

이 폴더에 아래 파일명으로 "귀여운" 음원을 넣으면 자동 재생됩니다.
(코드는 audio/ladder_audio.dart 가 try/catch로 로드 — 파일이 없으면 조용히 무시,
 크래시 없음. 시스템 먼저 / 자산은 나중에 채우는 구조.)

필요 파일 (WAV 권장, 짧고 가벼운 캔디 톤):
  tap.wav      — 칩/슬롯 탭 (짧은 '뽕')
  shuffle.wav  — 랜덤 섞기 (사르륵/셔플)
  start.wav    — 시작 버튼 (경쾌한 업)
  trace.wav    — 라인 그려지는 동안 루프(또는 짧은 스윕)
  win.wav      — 승자 공개 팡파레 (귀여운 띠리링)
  bgm.mp3      — 배경음악 루프(선택, 경쾌·말랑)

placeholder_tones/gen_tones.py 로 임시 톤을 생성해 둘 수 있음(순수 파이썬 wave).
정식 음원으로 교체 권장(로열티프리: pixabay/freesound 등).
