/**
 * ════════════════════════════════════════════════════════════
 * DK 운영통계 대시보드 생성 스크립트 v1.0
 * ════════════════════════════════════════════════════════════
 *
 * 실행 방법:
 *   1. clasp push 후 GAS 편집기 열기
 *   2. 함수 목록에서 [createStatsDashboard] 선택 → ▶ 실행
 *   3. 실행 로그(하단)에서 생성된 URL 복사
 *   4. URL 접속 → [📋 원본데이터] 탭 클릭 → [접근 허용] 클릭 (최초 1회)
 *   5. dk-hub-sample.html 운영통계시트 URL 업데이트
 *
 * ※ 단 한 번만 실행하면 됩니다. 이후 시트는 자동 업데이트됩니다.
 * ※ 재실행 시 새 스프레드시트가 추가로 생성됩니다 (기존 것은 유지).
 */

// ── 설정 ──────────────────────────────────────────────────────
var STATS_MASTER_SS_ID   = '1TVzwgFW5oaqL2e0LjCZl0ZPc_gxcr7cFESZ-sqOIjeU';
var STATS_MASTER_SHEET   = '통합마스터로그';
var STATS_MASTER_URL     = 'https://docs.google.com/spreadsheets/d/' + STATS_MASTER_SS_ID;
var STATS_RAW_SHEET_NAME = '📋 원본데이터';

// ── 컬럼 정의 (MASTER_HEADERS 기준, A=1) ──────────────────────
// A: use_date, B: use_time, C: reservation_no, D: real_name
// E: masked_name, F: product, G: people, H: email, I: phone
// J: memo, K: customer_source, L: checkin_at, M: folder_url
// N: edit_status, O: result_url, P: delivery_status
// Q: delivery_sent_at, R: privacy_consent, S: sns_consent, T: type

// ══════════════════════════════════════════════════════════════
// 메인 실행 함수
// ══════════════════════════════════════════════════════════════
function createStatsDashboard() {
  Logger.log('=== DK 운영통계 대시보드 생성 시작 ===');

  var ss          = SpreadsheetApp.create('📊 DK 운영통계 대시보드');
  var defaultSheet = ss.getActiveSheet();

  // 시트 생성 순서 = 탭 순서
  var rawSheet     = ss.insertSheet(STATS_RAW_SHEET_NAME);
  var dailySheet   = ss.insertSheet('📅 일간');
  var weeklySheet  = ss.insertSheet('📈 주간');
  var monthlySheet = ss.insertSheet('📊 월간');

  // 각 시트 구성
  _setupRawSheet(rawSheet);
  _setupDailySheet(dailySheet);
  _setupWeeklySheet(weeklySheet);
  _setupMonthlySheet(monthlySheet);

  // 기본 Sheet1 삭제, 일간 탭으로 포커스
  ss.deleteSheet(defaultSheet);
  ss.setActiveSheet(dailySheet);

  var url = ss.getUrl();
  var id  = ss.getId();

  Logger.log('');
  Logger.log('✅ 대시보드 생성 완료!');
  Logger.log('──────────────────────────────────────────');
  Logger.log('📎 URL : ' + url);
  Logger.log('🆔 ID  : ' + id);
  Logger.log('──────────────────────────────────────────');
  Logger.log('⚠️  필수 후속 작업:');
  Logger.log('   1. 위 URL로 접속');
  Logger.log('   2. [📋 원본데이터] 탭 클릭');
  Logger.log('   3. A1셀의 [접근 허용] 버튼 클릭 (최초 1회)');
  Logger.log('   4. dk-hub-sample.html 운영통계시트 URL 업데이트');
  Logger.log('');

  return { ok: true, url: url, id: id };
}

// ══════════════════════════════════════════════════════════════
// 원본데이터 시트
// ══════════════════════════════════════════════════════════════
function _setupRawSheet(sheet) {
  sheet.setTabColor('#607d8b');

  // IMPORTRANGE — 마스터 시트 전체 연결
  sheet.getRange('A1').setFormula(
    '=IMPORTRANGE("' + STATS_MASTER_URL + '","' + STATS_MASTER_SHEET + '!A:T")'
  );
  sheet.getRange('A1').setNote(
    '[최초 1회 설정 필요]\n' +
    '이 셀을 클릭하면 [접근 허용] 버튼이 나타납니다.\n' +
    '클릭 후 마스터 데이터가 자동으로 연동됩니다.\n\n' +
    '연결: ' + STATS_MASTER_URL
  );

  Logger.log('원본데이터 시트 완료');
}

// ══════════════════════════════════════════════════════════════
// 일간 대시보드
// ══════════════════════════════════════════════════════════════
function _setupDailySheet(sheet) {
  var R = STATS_RAW_SHEET_NAME; // 원본데이터 시트 참조용

  sheet.setTabColor('#1a73e8');
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 130);

  // ── 타이틀 ──
  _title(sheet, 'A1:F1', '📅  일간 운영 현황', '#1a73e8');

  // ── 날짜 입력 ──
  _sectionHeader(sheet, 'A3:B3', '날짜', '#e8f0fe');
  sheet.getRange('C3').setValue(new Date());
  sheet.getRange('C3').setNumberFormat('yyyy-MM-dd')
       .setBackground('#fff9c4').setFontWeight('bold').setFontSize(14)
       .setHorizontalAlignment('center');
  sheet.getRange('D3').setValue('← 날짜를 입력하면 전체 자동 갱신');
  sheet.getRange('D3').setFontColor('#9e9e9e').setFontStyle('italic').setFontSize(10);

  // ── 핵심 요약 카드 ──
  _sectionHeader(sheet, 'A5:F5', '📊  오늘 요약', '#e8f0fe');

  var cards1 = [
    ['총 예약',    _fDaily(R, 'COUNT', 'C', null, 'C3')],
    ['총 인원',    _fDaily(R, 'SUM',   'G', null, 'C3')],
    ['체크인 완료', _fDaily(R, 'COUNT', 'C', 'L<>""', 'C3')],
    ['미체크인',   '=C7-D7'],
    ['체크인율',   '=IFERROR(TEXT(D7/MAX(C7,1),"0%"),"—")'],
    ['현장결제',   _fDaily(R, 'COUNT', 'C', 'T="현장결제"', 'C3')]
  ];
  var cards2 = [
    ['편집 완료',  _fDaily(R, 'COUNT', 'C', 'N="완료"', 'C3')],
    ['편집 미완료', _fDaily(R, 'COUNT', 'C', 'N="미완료"', 'C3')],
    ['발송 완료',  _fDaily(R, 'COUNT', 'C', 'P="발송완료"', 'C3')],
    ['미발송',     _fDaily(R, 'COUNT', 'C', 'P="미발송"', 'C3')],
    ['SNS 동의',  _fDaily(R, 'COUNT', 'C', 'S="Y"', 'C3')],
    ['사전예약',   _fDaily(R, 'COUNT', 'C', 'T="사전예약"', 'C3')]
  ];

  _cardRow(sheet, 6, 7, cards1, '#e3f2fd');
  _cardRow(sheet, 9, 10, cards2, '#f3e5f5');

  // ── 상품별 현황 ──
  _sectionHeader(sheet, 'A12:C12', '📦  상품별 현황', '#e6f4ea');
  sheet.getRange('A13').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT F, COUNT(C), SUM(G) ' +
    'WHERE YEAR(A)=YEAR(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND MONTH(A)=MONTH(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND DAY(A)=DAY(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND F IS NOT NULL GROUP BY F ORDER BY COUNT(C) DESC ' +
    'LABEL F \'상품\', COUNT(C) \'예약수\', SUM(G) \'총인원\'" , 1),' +
    '{"상품","예약수","총인원"})'
  );

  // ── 유입경로별 ──
  _sectionHeader(sheet, 'E12:F12', '📡  유입경로', '#fce8e6');
  sheet.getRange('E13').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT K, COUNT(C), SUM(G) ' +
    'WHERE YEAR(A)=YEAR(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND MONTH(A)=MONTH(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND DAY(A)=DAY(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND K IS NOT NULL GROUP BY K ORDER BY COUNT(C) DESC ' +
    'LABEL K \'경로\', COUNT(C) \'건수\', SUM(G) \'인원\'" , 1),' +
    '{"경로","건수","인원"})'
  );
  sheet.getRange('E18').setValue('N=네이버  A=현장  V=체험')
       .setFontColor('#9e9e9e').setFontSize(9).setFontStyle('italic');

  // ── 시간대별 ──
  _sectionHeader(sheet, 'A20:C20', '🕐  시간대별 예약', '#f3e8fd');
  sheet.getRange('A21').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT B, COUNT(C), SUM(G) ' +
    'WHERE YEAR(A)=YEAR(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND MONTH(A)=MONTH(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'AND DAY(A)=DAY(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\"))) ' +
    'GROUP BY B ORDER BY B ' +
    'LABEL B \'시간\', COUNT(C) \'예약수\', SUM(G) \'인원\'" , 1),' +
    '{"시간","예약수","인원"})'
  );

  Logger.log('일간 시트 완료');
}

// ══════════════════════════════════════════════════════════════
// 주간 대시보드
// ══════════════════════════════════════════════════════════════
function _setupWeeklySheet(sheet) {
  var R = STATS_RAW_SHEET_NAME;

  sheet.setTabColor('#34a853');
  sheet.setColumnWidth(1, 160);
  for (var i = 2; i <= 10; i++) sheet.setColumnWidth(i, 110);

  // ── 타이틀 ──
  _title(sheet, 'A1:I1', '📈  주간 운영 현황', '#34a853');

  // ── 기준 날짜 입력 ──
  _sectionHeader(sheet, 'A3:B3', '기준 날짜', '#e6f4ea');
  sheet.getRange('C3').setValue(new Date());
  sheet.getRange('C3').setNumberFormat('yyyy-MM-dd')
       .setBackground('#fff9c4').setFontWeight('bold').setFontSize(14)
       .setHorizontalAlignment('center');
  sheet.getRange('D3').setValue('← 날짜 기준 해당 주 (월~일) 자동 계산');
  sheet.getRange('D3').setFontColor('#9e9e9e').setFontStyle('italic').setFontSize(10);

  // 주 범위 (월~일)
  sheet.getRange('A4').setValue('주 범위').setFontWeight('bold').setFontColor('#555');
  sheet.getRange('C4').setFormula('=C3-WEEKDAY(C3,2)+1').setNumberFormat('yyyy-MM-dd (ddd)');
  sheet.getRange('D4').setValue('~').setHorizontalAlignment('center').setFontWeight('bold');
  sheet.getRange('E4').setFormula('=C4+6').setNumberFormat('yyyy-MM-dd (ddd)');

  // ── 주간 요약 카드 ──
  _sectionHeader(sheet, 'A6:E6', '📊  이번 주 요약', '#e6f4ea');

  var wCards = [
    ['총 예약',   '=IFERROR(COUNTIFS(\'' + R + '\'!A:A,">="&C4,\'' + R + '\'!A:A,"<="&E4),0)'],
    ['총 인원',   '=IFERROR(SUMPRODUCT((\'' + R + '\'!A2:A5000>=C4)*(\'' + R + '\'!A2:A5000<=E4)*IFERROR(VALUE(\'' + R + '\'!G2:G5000),0)),0)'],
    ['체크인',    '=IFERROR(SUMPRODUCT((\'' + R + '\'!A2:A5000>=C4)*(\'' + R + '\'!A2:A5000<=E4)*(\'' + R + '\'!L2:L5000<>"")),0)'],
    ['편집완료',  '=IFERROR(SUMPRODUCT((\'' + R + '\'!A2:A5000>=C4)*(\'' + R + '\'!A2:A5000<=E4)*(\'' + R + '\'!N2:N5000="완료")),0)'],
    ['발송완료',  '=IFERROR(SUMPRODUCT((\'' + R + '\'!A2:A5000>=C4)*(\'' + R + '\'!A2:A5000<=E4)*(\'' + R + '\'!P2:P5000="발송완료")),0)']
  ];
  _cardRow(sheet, 7, 8, wCards, '#e3f2fd');

  // ── 요일별 현황 테이블 ──
  _sectionHeader(sheet, 'A10:I10', '📅  요일별 현황', '#e8f0fe');

  var headers = ['항목', '월', '화', '수', '목', '금', '토', '일', '합계'];
  var rowLabels = ['예약 건수', '방문 인원', '체크인 수'];
  var headerRange = sheet.getRange(11, 1, 1, 9);
  headerRange.setValues([headers]);
  headerRange.setBackground('#e8f0fe').setFontWeight('bold').setHorizontalAlignment('center');

  for (var d = 0; d < 7; d++) {
    // 날짜 헤더 (월=0 ~ 일=6)
    sheet.getRange(11, d + 2).setFormula('=TEXT(C4+' + d + ',"M/d")');

    // 예약 건수
    sheet.getRange(12, d + 2).setFormula(
      '=IFERROR(COUNTIF(\'' + R + '\'!A:A,C4+' + d + '),0)'
    );
    // 방문 인원
    sheet.getRange(13, d + 2).setFormula(
      '=IFERROR(SUMIF(\'' + R + '\'!A:A,C4+' + d + ',\'' + R + '\'!G:G),0)'
    );
    // 체크인 수
    sheet.getRange(14, d + 2).setFormula(
      '=IFERROR(SUMPRODUCT((\'' + R + '\'!A2:A5000=C4+' + d + ')*(\'' + R + '\'!L2:L5000<>"")),0)'
    );
  }

  // 행 레이블
  for (var r = 0; r < 3; r++) {
    sheet.getRange(12 + r, 1).setValue(rowLabels[r]).setFontWeight('bold');
  }

  // 합계 컬럼
  sheet.getRange('I11').setValue('합계').setBackground('#e8f0fe').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('I12').setFormula('=SUM(B12:H12)').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('I13').setFormula('=SUM(B13:H13)').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('I14').setFormula('=SUM(B14:H14)').setFontWeight('bold').setHorizontalAlignment('center');

  sheet.getRange('B12:H14').setHorizontalAlignment('center');

  // ── 상품별 주간 합계 ──
  _sectionHeader(sheet, 'A16:D16', '📦  상품별 주간 합계', '#f3e8fd');
  sheet.getRange('A17').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT F, COUNT(C), SUM(G) ' +
    'WHERE A>=\'"&TEXT(C4,"yyyy-MM-dd")&"\' AND A<=\'"&TEXT(E4,"yyyy-MM-dd")&"\' ' +
    'AND F IS NOT NULL GROUP BY F ORDER BY COUNT(C) DESC ' +
    'LABEL F \'상품\', COUNT(C) \'예약수\', SUM(G) \'총인원\'" , 1),' +
    '{"상품","예약수","총인원"})'
  );

  // ── 유입경로별 주간 ──
  _sectionHeader(sheet, 'F16:H16', '📡  유입경로 주간', '#fce8e6');
  sheet.getRange('F17').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT K, COUNT(C), SUM(G) ' +
    'WHERE A>=\'"&TEXT(C4,"yyyy-MM-dd")&"\' AND A<=\'"&TEXT(E4,"yyyy-MM-dd")&"\' ' +
    'AND K IS NOT NULL GROUP BY K ORDER BY COUNT(C) DESC ' +
    'LABEL K \'경로\', COUNT(C) \'건수\', SUM(G) \'인원\'" , 1),' +
    '{"경로","건수","인원"})'
  );

  Logger.log('주간 시트 완료');
}

// ══════════════════════════════════════════════════════════════
// 월간 대시보드
// ══════════════════════════════════════════════════════════════
function _setupMonthlySheet(sheet) {
  var R = STATS_RAW_SHEET_NAME;

  sheet.setTabColor('#ea4335');
  sheet.setColumnWidth(1, 160);
  for (var i = 2; i <= 8; i++) sheet.setColumnWidth(i, 120);

  // ── 타이틀 ──
  _title(sheet, 'A1:G1', '📊  월간 운영 현황', '#ea4335');

  // ── 기준 월 입력 ──
  _sectionHeader(sheet, 'A3:B3', '기준 월', '#fce8e6');
  sheet.getRange('C3').setValue(new Date());
  sheet.getRange('C3').setNumberFormat('yyyy-MM')
       .setBackground('#fff9c4').setFontWeight('bold').setFontSize(14)
       .setHorizontalAlignment('center');
  sheet.getRange('D3').setValue('← yyyy-MM 형식. 해당 월 전체 데이터 표시');
  sheet.getRange('D3').setFontColor('#9e9e9e').setFontStyle('italic').setFontSize(10);

  // 월 시작일/종료일 계산
  sheet.getRange('C4').setFormula('=EOMONTH(C3,0)').setNumberFormat('yyyy-MM-dd');
  sheet.getRange('B4').setValue('마지막 날').setFontColor('#9e9e9e').setFontSize(9);

  // ── 월간 요약 카드 ──
  _sectionHeader(sheet, 'A6:E6', '📊  이번 달 누계', '#fce8e6');

  var mCards = [
    ['총 예약',
     '=IFERROR(SUMPRODUCT((YEAR(\'' + R + '\'!A2:A5000)=YEAR(C3))*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(C3))),0)'],
    ['총 인원',
     '=IFERROR(SUMPRODUCT((YEAR(\'' + R + '\'!A2:A5000)=YEAR(C3))*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(C3))*IFERROR(VALUE(\'' + R + '\'!G2:G5000),0)),0)'],
    ['체크인율',
     '=IFERROR(TEXT(SUMPRODUCT((YEAR(\'' + R + '\'!A2:A5000)=YEAR(C3))*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(C3))*(\'' + R + '\'!L2:L5000<>""))/MAX(C7,1),"0.0%"),"—")'],
    ['편집완료율',
     '=IFERROR(TEXT(SUMPRODUCT((YEAR(\'' + R + '\'!A2:A5000)=YEAR(C3))*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(C3))*(\'' + R + '\'!N2:N5000="완료"))/MAX(C7,1),"0.0%"),"—")'],
    ['발송완료율',
     '=IFERROR(TEXT(SUMPRODUCT((YEAR(\'' + R + '\'!A2:A5000)=YEAR(C3))*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(C3))*(\'' + R + '\'!P2:P5000="발송완료"))/MAX(C7,1),"0.0%"),"—")']
  ];
  _cardRow(sheet, 7, 8, mCards, '#e3f2fd');

  // ── 최근 6개월 추이 ──
  _sectionHeader(sheet, 'A10:F10', '📈  최근 6개월 추이', '#e8f0fe');

  var trendHeaders = ['월', '예약', '인원', '체크인', '편집완료', '발송완료'];
  sheet.getRange(11, 1, 1, 6).setValues([trendHeaders])
       .setBackground('#e8f0fe').setFontWeight('bold').setHorizontalAlignment('center');

  for (var m = 0; m < 6; m++) {
    var offset = m - 5; // -5 to 0 (5개월 전 ~ 이번달)
    var isCurrentMonth = (m === 5);

    // 월 라벨
    sheet.getRange(12 + m, 1)
         .setFormula('=TEXT(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1),"yyyy-MM")')
         .setHorizontalAlignment('center');

    // 예약 건수
    sheet.getRange(12 + m, 2).setFormula(
      '=IFERROR(SUMPRODUCT(' +
      '(YEAR(\'' + R + '\'!A2:A5000)=YEAR(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '),0)'
    );
    // 인원
    sheet.getRange(12 + m, 3).setFormula(
      '=IFERROR(SUMPRODUCT(' +
      '(YEAR(\'' + R + '\'!A2:A5000)=YEAR(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*IFERROR(VALUE(\'' + R + '\'!G2:G5000),0)),0)'
    );
    // 체크인
    sheet.getRange(12 + m, 4).setFormula(
      '=IFERROR(SUMPRODUCT(' +
      '(YEAR(\'' + R + '\'!A2:A5000)=YEAR(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(\'' + R + '\'!L2:L5000<>"")),0)'
    );
    // 편집완료
    sheet.getRange(12 + m, 5).setFormula(
      '=IFERROR(SUMPRODUCT(' +
      '(YEAR(\'' + R + '\'!A2:A5000)=YEAR(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(\'' + R + '\'!N2:N5000="완료")),0)'
    );
    // 발송완료
    sheet.getRange(12 + m, 6).setFormula(
      '=IFERROR(SUMPRODUCT(' +
      '(YEAR(\'' + R + '\'!A2:A5000)=YEAR(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(MONTH(\'' + R + '\'!A2:A5000)=MONTH(DATE(YEAR(C3),MONTH(C3)+' + offset + ',1)))' +
      '*(\'' + R + '\'!P2:P5000="발송완료")),0)'
    );

    // 이번 달 강조
    var rowBg = isCurrentMonth ? '#fff8e1' : '#ffffff';
    var rowBold = isCurrentMonth ? 'bold' : 'normal';
    sheet.getRange(12 + m, 1, 1, 6)
         .setBackground(rowBg)
         .setFontWeight(rowBold)
         .setHorizontalAlignment('center');
  }

  // ── 상품별 월간 ──
  _sectionHeader(sheet, 'A19:D19', '📦  상품별 월간', '#e6f4ea');
  sheet.getRange('A20').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT F, COUNT(C), SUM(G) ' +
    'WHERE YEAR(A)=YEAR(DATEVALUE(TEXT(C3,\\"yyyy-MM-dd\\")+1-1)) ' +
    'AND MONTH(A)=MONTH(DATE(YEAR(C3),MONTH(C3),1)) ' +
    'AND F IS NOT NULL GROUP BY F ORDER BY COUNT(C) DESC ' +
    'LABEL F \'상품\', COUNT(C) \'예약수\', SUM(G) \'총인원\'" , 1),' +
    '{"상품","예약수","총인원"})'
  );

  // ── 유입경로별 월간 ──
  _sectionHeader(sheet, 'F19:H19', '📡  유입경로 월간', '#fce8e6');
  sheet.getRange('F20').setFormula(
    '=IFERROR(QUERY(\'' + R + '\'!A:T,' +
    '"SELECT K, COUNT(C), SUM(G) ' +
    'WHERE YEAR(A)=YEAR(DATE(YEAR(C3),MONTH(C3),1)) ' +
    'AND MONTH(A)=MONTH(DATE(YEAR(C3),MONTH(C3),1)) ' +
    'AND K IS NOT NULL GROUP BY K ORDER BY COUNT(C) DESC ' +
    'LABEL K \'경로\', COUNT(C) \'건수\', SUM(G) \'인원\'" , 1),' +
    '{"경로","건수","인원"})'
  );

  Logger.log('월간 시트 완료');
}

// ══════════════════════════════════════════════════════════════
// 유틸 헬퍼 함수들
// ══════════════════════════════════════════════════════════════

/** 일간 SUMPRODUCT 수식 생성 헬퍼 */
function _fDaily(rawSheet, aggType, valueCol, extraCondition, dateCellRef) {
  var R = rawSheet;
  var dateY = 'YEAR(\'' + R + '\'!A2:A5000)=YEAR(' + dateCellRef + ')';
  var dateM = 'MONTH(\'' + R + '\'!A2:A5000)=MONTH(' + dateCellRef + ')';
  var dateD = 'DAY(\'' + R + '\'!A2:A5000)=DAY(' + dateCellRef + ')';
  var baseCond = '(' + dateY + ')*(' + dateM + ')*(' + dateD + ')';

  if (extraCondition) {
    var col = extraCondition.match(/^([A-Z]+)/)[1];
    var op  = extraCondition.match(/([<>=!]+)/)[1];
    var val = extraCondition.match(/["'](.+?)["']/);
    if (val) {
      var colRef = '\'' + R + '\'!' + col + '2:' + col + '5000';
      var cond   = '(' + colRef + op + '"' + val[1] + '")';
      baseCond  += '*' + cond;
    } else {
      // <> "" (비어있지 않음)
      var colRef2 = '\'' + R + '\'!' + col + '2:' + col + '5000';
      baseCond += '*(' + colRef2 + '<>"")';
    }
  }

  if (aggType === 'COUNT') {
    return '=IFERROR(SUMPRODUCT(' + baseCond + '),0)';
  } else if (aggType === 'SUM') {
    return '=IFERROR(SUMPRODUCT(' + baseCond + '*IFERROR(VALUE(\'' + R + '\'!' + valueCol + '2:' + valueCol + '5000),0)),0)';
  }
  return '0';
}

/** 타이틀 행 설정 */
function _title(sheet, rangeA1, text, bgColor) {
  var range = sheet.getRange(rangeA1);
  range.merge()
       .setValue(text)
       .setFontSize(18).setFontWeight('bold')
       .setBackground(bgColor).setFontColor('#ffffff')
       .setVerticalAlignment('middle')
       .setHorizontalAlignment('left');
  sheet.setRowHeight(range.getRow(), 44);
}

/** 섹션 헤더 행 설정 */
function _sectionHeader(sheet, rangeA1, text, bgColor) {
  var range = sheet.getRange(rangeA1);
  range.merge()
       .setValue(text)
       .setFontSize(12).setFontWeight('bold')
       .setBackground(bgColor)
       .setVerticalAlignment('middle');
  sheet.setRowHeight(range.getRow(), 30);
}

/** 카드형 요약 행 설정 (라벨행 + 값행) */
function _cardRow(sheet, labelRow, valueRow, cards, valueBg) {
  for (var i = 0; i < cards.length; i++) {
    var col = i + 1;
    // 라벨
    sheet.getRange(labelRow, col)
         .setValue(cards[i][0])
         .setFontSize(10).setFontColor('#555555')
         .setHorizontalAlignment('center')
         .setBackground('#f5f5f5');
    // 값
    var cell = sheet.getRange(valueRow, col);
    if (cards[i][1].startsWith('=')) {
      cell.setFormula(cards[i][1]);
    } else {
      cell.setValue(cards[i][1]);
    }
    cell.setFontSize(22).setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setBackground(valueBg || '#ffffff');
    sheet.setRowHeight(valueRow, 50);
  }
}
