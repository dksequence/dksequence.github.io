// ════════════════════════════════════════════════════════════
// 운영 통계 API
// 호출: ?action=getStats&mode=daily&target=2026-04-14
//        ?action=getStats&mode=weekly&target=2026-04-07   (해당 주 월요일)
//        ?action=getStats&mode=monthly&target=2026-04
// ════════════════════════════════════════════════════════════

// ── 컬럼 인덱스 (MASTER_HEADERS 고정) ─────────────────────
var C_IDX = {
  use_date: 0, use_time: 1, reservation_no: 2,
  real_name: 3, masked_name: 4, product: 5,
  people: 6, email: 7, phone: 8, memo: 9,
  customer_source: 10, checkin_at: 11, folder_url: 12,
  edit_status: 13, result_url: 14, delivery_status: 15,
  delivery_sent_at: 16, privacy_consent: 17, sns_consent: 18, type: 19,
  payment_amount: 20,
  cancel_status: 21
};

// ── reservations 시트에서 결제금액 맵 생성 ──────────────────
// 예약번호 → 결제금액 (숫자)
// Naver 예약 시트의 헤더를 자동 탐지하여 결제금액 컬럼을 찾음
function buildPaymentMap() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME_1ST);
    if (!sheet) return {};

    var allData = sheet.getDataRange().getValues();
    if (allData.length < 2) return {};

    // 헤더 행에서 결제금액 컬럼 자동 탐지
    var headers = allData[0].map(function(h) { return String(h).trim(); });

    // 예약번호 컬럼 탐지
    var resnoIdx = -1;
    var priceIdx = -1;
    var priceKeywords = ['결제금액', '예약금액', '총금액', '금액', 'payment_amount', 'amount', 'price'];
    var resnoKeywords  = ['예약번호', 'reservation_no', 'resno', '예약 번호'];

    headers.forEach(function(h, i) {
      var lower = h.toLowerCase();
      if (resnoIdx === -1) {
        resnoKeywords.forEach(function(kw) {
          if (h.indexOf(kw) !== -1 || lower.indexOf(kw.toLowerCase()) !== -1) resnoIdx = i;
        });
      }
      if (priceIdx === -1) {
        priceKeywords.forEach(function(kw) {
          if (h.indexOf(kw) !== -1 || lower.indexOf(kw.toLowerCase()) !== -1) priceIdx = i;
        });
      }
    });

    // 헤더가 없는 경우 Naver 시트 기본 구조 사용 (예약번호=4, 결제금액=?)
    // 헤더 미발견 시 Code.js 기준 인덱스로 fallback
    if (resnoIdx === -1) resnoIdx = 4; // Code.js row[4] = resno

    if (priceIdx === -1) {
      // 헤더 없거나 키워드 불일치 → reservations 시트 고정 구조 fallback (index 9 = payment_amount)
      priceIdx = 9;
    }

    var map = { _priceColFound: true };
    for (var i = 1; i < allData.length; i++) {
      var row = allData[i];
      var resno = String(row[resnoIdx] || '').trim();
      if (!resno) continue;
      var raw = String(row[priceIdx] || '').replace(/[^0-9]/g, '');
      var amount = raw ? parseInt(raw) : 0;
      if (resno && amount > 0) map[resno] = amount;
    }
    return map;

  } catch(e) {
    return { _priceColFound: false };
  }
}

// ── 링크 클릭 맵 생성 ─────────────────────────────────────────
// 예약번호 → 최초/최근 클릭 시각 (yyyy-MM-dd HH:mm)
function buildClickMap() {
  try {
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var sheet = ss.getSheetByName('링크클릭로그');
    if (!sheet || sheet.getLastRow() < 2) return {};
    var data = sheet.getDataRange().getValues();
    var map = {};
    for (var i = 1; i < data.length; i++) {
      var resno = String(data[i][0] || '').trim();
      if (!resno) continue;
      var clickedAtVal = data[i][1];
      var clickedAt = clickedAtVal instanceof Date
        ? Utilities.formatDate(clickedAtVal, 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
        : String(clickedAtVal || '').substring(0, 16);
      // 가장 최근 클릭 시각 저장
      if (!map[resno] || clickedAt > map[resno]) map[resno] = clickedAt;
    }
    return map;
  } catch(e) {
    return {};
  }
}

function getStats(mode, target) {
  try {
    var ss    = SpreadsheetApp.openById(MASTER_SS_ID);
    var sheet = ss.getSheetByName(MASTER_SHEET_NAME);
    if (!sheet) return { ok: false, error: '시트를 찾을 수 없습니다.' };

    var allData = sheet.getDataRange().getValues();
    if (allData.length < 2) return { ok: false, error: '데이터가 없습니다.' };

    var firstCell = String(allData[0][0]).trim().toLowerCase();
    var hasHeader = (firstCell === 'use_date' || firstCell === 'date' || firstCell === '이용일');
    var rows = hasHeader ? allData.slice(1) : allData;

    var tz  = 'Asia/Seoul';
    var now = new Date();

    mode   = mode   || 'monthly';
    target = target || Utilities.formatDate(now, tz, 'yyyy-MM');

    // ── 결제금액 맵 로드 ──────────────────────────────────────
    var paymentMap = buildPaymentMap();
    var hasPrices  = !!paymentMap._priceColFound;

    // ── 링크 클릭 맵 로드 ─────────────────────────────────────
    var clickMap = buildClickMap();

    // ── 네이버 취소 맵 로드 ─────────────────────────────────────
    var cancelledMap = {};
    try {
      var resSS = SpreadsheetApp.openById(SHEET_ID);
      var resSheet = resSS.getSheetByName(SHEET_NAME_1ST);
      if (resSheet && resSheet.getLastRow() > 1) {
        var resData = resSheet.getDataRange().getValues();
        for (var ri = 1; ri < resData.length; ri++) {
          var rResno = String(resData[ri][4] || '').trim();
          var rCancelled = String(resData[ri][15] || '').trim().indexOf('취소') !== -1;
          if (rResno && rCancelled) cancelledMap[rResno] = true;
        }
      }
    } catch(e) { /* 무시 */ }

    // ── 날짜 범위 & 바 차트 설정 ──────────────────────────
    var rangeStart, rangeEnd, periodLabel, barLabels, getBarIdx;

    if (mode === 'daily') {
      rangeStart  = target;
      rangeEnd    = target;
      periodLabel = target;
      barLabels   = [];
      for (var h = 0; h < 24; h++) barLabels.push(h + '시');
      getBarIdx = function(row) {
        var t = String(row[C_IDX.use_time] || '');
        var m = t.match(/(\d{1,2})\s*[:시]/);
        return m ? Math.min(parseInt(m[1]), 23) : -1;
      };

    } else if (mode === 'weekly') {
      var mon = new Date(target);
      var sun = new Date(target); sun.setDate(sun.getDate() + 6);
      rangeStart  = Utilities.formatDate(mon, tz, 'yyyy-MM-dd');
      rangeEnd    = Utilities.formatDate(sun, tz, 'yyyy-MM-dd');
      periodLabel = rangeStart + ' ~ ' + rangeEnd;
      barLabels   = ['월', '화', '수', '목', '금', '토', '일'];
      getBarIdx = function(row, dateStr) {
        var day = new Date(dateStr).getDay();
        return (day + 6) % 7; // Mon=0 ~ Sun=6
      };

    } else { // monthly
      var yr  = parseInt(target.substring(0, 4));
      var mo  = parseInt(target.substring(5, 7));
      var dim = new Date(yr, mo, 0).getDate();
      rangeStart  = target + '-01';
      rangeEnd    = target + '-' + (dim < 10 ? '0' + dim : '' + dim);
      periodLabel = target;
      barLabels   = [];
      for (var day = 1; day <= dim; day++) barLabels.push(day + '');
      getBarIdx = function(row, dateStr) {
        return parseInt(dateStr.substring(8, 10)) - 1;
      };
    }

    // ── 집계 ──────────────────────────────────────────────
    var count = 0, totalPeople = 0, revenue = 0;
    var barData   = new Array(barLabels.length).fill(0);
    var products  = {}, sources = {};
    var editDone = 0, editPend = 0;
    var sentDone = 0, sentPend = 0;
    var snsYes   = 0, snsNo   = 0;
    var chkDone  = 0, chkPend = 0;
    var customers = [];

    rows.forEach(function(row) {
      var isCancelled = String(row[C_IDX.cancel_status] || '').trim().indexOf('취소') !== -1;
      if (!isCancelled && resno && cancelledMap[resno]) {
        isCancelled = true;
      }
      var dateVal = row[C_IDX.use_date];
      if (!dateVal) return;

      var dateStr;
      if (dateVal instanceof Date) {
        dateStr = Utilities.formatDate(dateVal, tz, 'yyyy-MM-dd');
      } else {
        var s = String(dateVal).trim().substring(0, 10)
                  .replace(/\./g, '-').replace(/\//g, '-');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return;
        dateStr = s;
      }

      if (dateStr < rangeStart || dateStr > rangeEnd) return;

      var resno   = String(row[C_IDX.reservation_no]  || '').trim();
      var product = String(row[C_IDX.product]         || '').trim() || '기타';
      var source  = String(row[C_IDX.customer_source] || '').trim() || '기타';
      var editSt  = String(row[C_IDX.edit_status]     || '').trim();
      var delivSt = String(row[C_IDX.delivery_status] || '').trim();
      var sns     = String(row[C_IDX.sns_consent]     || '').trim().toUpperCase();
      var checkin = row[C_IDX.checkin_at];
      var ppl     = parseInt(row[C_IDX.people]) || 0;

      var timeVal = row[C_IDX.use_time];
      var timeStr;
      if (timeVal instanceof Date) {
        timeStr = Utilities.formatDate(timeVal, tz, 'HH:mm');
      } else {
        var ts = String(timeVal || '').trim();
        var tm = ts.match(/(\d{1,2}:\d{2})/);
        timeStr = tm ? tm[1] : ts;
      }

      var delivAtVal = row[C_IDX.delivery_sent_at];
      var delivAt;
      if (delivAtVal instanceof Date) {
        delivAt = Utilities.formatDate(delivAtVal, tz, 'yyyy-MM-dd HH:mm');
      } else {
        delivAt = String(delivAtVal || '').trim().substring(0, 16);
      }

      var masterPayment = parseInt(String(row[C_IDX.payment_amount] || '').replace(/[^0-9]/g, '')) || 0;
      var price = masterPayment > 0 ? masterPayment :
                  (hasPrices && resno && paymentMap[resno]) ? paymentMap[resno] : 0;

      // 취소 건: 고객 리스트에는 표시, 수익/건수/통계 집계에서는 제외
      if (!isCancelled) {
        count++;
        totalPeople += ppl;
        revenue     += price;
        products[product] = (products[product] || 0) + 1;
        sources[source]   = (sources[source]   || 0) + 1;

        var idx = getBarIdx(row, dateStr);
        if (idx >= 0 && idx < barData.length) barData[idx]++;

        var isSent   = delivSt.indexOf('발송완료') === 0;
        var isEdited = editSt !== '미완료' && editSt.indexOf('완료') !== -1;
        if (isEdited) editDone++; else editPend++;
        if (isSent)      sentDone++; else sentPend++;
        if (sns === 'Y') snsYes++;   else snsNo++;
        if (checkin)     chkDone++;  else chkPend++;
      }

      customers.push({
        name:       String(row[C_IDX.real_name]  || row[C_IDX.masked_name] || '').trim(),
        product:    product,
        date:       dateStr,
        time:       timeStr,
        resno:      resno,
        email:      String(row[C_IDX.email]      || '').trim(),
        editSt:     editSt || '미완료',
        delivSt:    delivSt || '미발송',
        delivAt:    delivAt,
        resultUrl:  String(row[C_IDX.result_url] || '').trim(),
        sns:        sns,
        clickedAt:  (resno && clickMap[resno]) ? clickMap[resno] : '',
        revenue:    isCancelled ? 0 : price,
        dk:         isCancelled ? 0 : Math.round(price / 2),
        cancelled:  isCancelled
      });
    });

    // ── 체크인 전 네이버 예약 병합 (마스터로그에 없는 건) ──────────
    // getStats()는 마스터로그만 읽으므로 체크인 전 예약이 누락됨.
    // reservations 시트에서 해당 기간 예약 중 마스터로그에 없는 건을 추가.
    try {
      var resSS = SpreadsheetApp.openById(SHEET_ID);
      var resSheet = resSS.getSheetByName(SHEET_NAME_1ST);
      if (resSheet && resSheet.getLastRow() > 1) {
        var resData = resSheet.getDataRange().getValues();
        // 이미 마스터로그에 있는 예약번호
        var checkedInNos = {};
        customers.forEach(function(c) { if (c.resno) checkedInNos[c.resno] = true; });

        for (var ri = 1; ri < resData.length; ri++) {
          var rRow = resData[ri];
          var rDateRaw = String(rRow[12] || '').trim();
          var rDate = rDateRaw.replace(/\./g, '-').replace(/\//g, '-').substring(0, 10);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(rDate)) continue;
          if (rDate < rangeStart || rDate > rangeEnd) continue;

          var rResno = String(rRow[4] || '').trim();
          if (!rResno || checkedInNos[rResno]) continue;
          var rCancelled = String(rRow[15] || '').trim().indexOf('취소') !== -1;

          var rProduct = String(rRow[5] || '').trim() || '기타';
          var rTimeVal = rRow[13];
          var rTime = rTimeVal instanceof Date
            ? Utilities.formatDate(rTimeVal, tz, 'HH:mm')
            : (String(rTimeVal || '').match(/(\d{1,2}:\d{2})/) || ['',''])[1] || String(rTimeVal || '').trim();
          var rPeople  = parseInt(String(rRow[14] || '').replace(/[^0-9]/g, '')) || 0;
          var rPrice   = (!rCancelled && hasPrices && paymentMap[rResno]) ? paymentMap[rResno] : 0;
          var rName    = String(rRow[2] || '').trim();

          if (!rCancelled) {
            count++;
            totalPeople += rPeople;
            revenue     += rPrice;
            products[rProduct] = (products[rProduct] || 0) + 1;
            sources['N']       = (sources['N']       || 0) + 1;

            var fakeRow = new Array(21).fill('');
            fakeRow[C_IDX.use_time] = rTime;
            var bidx = getBarIdx(fakeRow, rDate);
            if (bidx >= 0 && bidx < barData.length) barData[bidx]++;

            editPend++;
            sentPend++;
            snsNo++;
            chkPend++;
          }

          customers.push({
            name: rName, product: rProduct, date: rDate, time: rTime, resno: rResno,
            email: '',
            editSt: rCancelled ? '취소' : '대기', delivSt: '미발송', delivAt: '',
            resultUrl: '', sns: 'N', clickedAt: '',
            revenue: rPrice, dk: Math.round(rPrice / 2),
            cancelled: rCancelled
          });
        }
      }
    } catch(e) { /* 예약 시트 읽기 실패는 무시 */ }

    return {
      ok:          true,
      mode:        mode,
      target:      target,
      periodLabel: periodLabel,
      updatedAt:   Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm:ss'),
      hasPrices:   hasPrices,
      summary: {
        count:        count,
        people:       totalPeople,
        revenue:      revenue,
        checkinRate:  count ? Math.round(chkDone  / count * 100) : 0,
        editRate:     count ? Math.round(editDone  / count * 100) : 0,
        deliveryRate: count ? Math.round(sentDone  / count * 100) : 0,
        snsRate:      count ? Math.round(snsYes    / count * 100) : 0
      },
      barChart:  { labels: barLabels, data: barData },
      products:  products,
      sources:   sources,
      editStatus:{ done: editDone, pending: editPend },
      delivery:  { done: sentDone, pending: sentPend },
      sns:       { yes:  snsYes,   no: snsNo },
      checkin:   { done: chkDone,  pending: chkPend },
      customers: customers
    };

  } catch(err) {
    return { ok: false, error: err.toString() };
  }
}
