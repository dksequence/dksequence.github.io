// ════════════════════════════════════════════════════════════
// DKsequence × 중문별장 Photography Studio Management System
// Code.gs - Backend Logic (FINAL VERSION)
// ════════════════════════════════════════════════════════════

// ── 설정 ──────────────────────────────────────────────────
var SHEET_ID = '1llMx1e7JYdGG5l1OOJiGvFoi4TvdlL9LEaZo9GiBUN4';
var SHEET_NAME_1ST = 'reservations';
var SHEET_NAME_2ND = '2차_체크인';
var MASTER_SS_ID = '1TVzwgFW5oaqL2e0LjCZl0ZPc_gxcr7cFESZ-sqOIjeU';
var MASTER_SHEET_NAME = '통합마스터로그';
var ROOT_FOLDER_ID = '1MJlGEFWKN4ipSQp5e-cEmPSFJ7gyGvMN';
var CALENDAR_ID = 'b80af760ccd9b450a8bdea35f6fd6a43fb8e2eba5f0be964af5043ef9d30ca2e@group.calendar.google.com';
var DELIVERY_FROM_EMAIL = 'dkseq4@gmail.com';

// ── 필드 정의 (순서 고정) ──────────────────────────────────────
var MASTER_HEADERS = [
  'use_date', 'use_time', 'reservation_no', 'real_name', 'masked_name', 
  'product', 'people', 'email', 'phone', 'memo', 
  'customer_source', 'checkin_at', 'folder_url', 'edit_status', 'result_url', 
  'delivery_status', 'delivery_sent_at', 'privacy_consent', 'sns_consent', 'type'
];

// ── 메인 진입점 ─────────────────────────────────────────────
function doGet(e) {
  // GitHub Pages에서 GET 쿼리스트링으로 API 호출 시 처리
  if (e && e.parameter && e.parameter.action) {
    try {
      var payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : e.parameter;
      var result = processRequest(JSON.stringify(payload));
      var out = JSON.stringify(result);
      if (e.parameter.callback) {
        out = e.parameter.callback + "(" + out + ")";
        return ContentService.createTextOutput(out)
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(out)
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        ok: false,
        error: err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // 일반 웹 접속 시 HTML 페이지 반환 (캐시 방지를 위해 v2 파일명 사용)
  return HtmlService.createHtmlOutputFromFile('index_v2')
    .setTitle('DKsequence 현장 운영 v2.0')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result = processRequest(JSON.stringify(payload));
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function processRequest(jsonString) {
  try {
    var req = JSON.parse(jsonString);
    var action = req.action;

    if (action === 'getReservations') {
      return getReservations(req.date, req.time);
    } else if (action === 'checkin') {
      return checkin(req);
    } else if (action === 'checkinExperience') {
      return checkinExperience(req);
    } else if (action === 'savePhotoPost') {
      return savePhotoPost(req);
    } else if (action === 'getWalkInCode') {
      return getWalkInCode(req.date);
    } else if (action === 'parseEmail') {
      return parseReservationEmail(req.emailBody);
    } else if (action === 'getDeliveryList') {
      return getDeliveryList(req.date);
    } else if (action === 'markEditDone') {
      return markEditDone(req.resno);
    } else if (action === 'sendDeliveryEmail') {
      return sendDeliveryEmail(req.resno);
    } else if (action === 'runMigration') {
      return { ok: true, result: migrateDataToMaster() };
    } else {
      return { ok: false, error: 'Unknown action: ' + action };
    }
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── 예약 목록 조회 ────────────────────────────────────────────
function getReservations(dateStr, timeReq) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet1 = ss.getSheetByName(SHEET_NAME_1ST);
    var data1 = sheet1 ? sheet1.getDataRange().getValues() : [];
    
    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
    var dataM = masterSheet ? masterSheet.getDataRange().getValues() : [];
    
    // 날짜 포맷 표준화 (dateStr: "20260413" -> "2026-04-13")
    var targetDate = dateStr.substring(0,4) + '-' + dateStr.substring(4,6) + '-' + dateStr.substring(6,8);
    var targetDateDot = dateStr.substring(0,4) + '.' + dateStr.substring(4,6) + '.' + dateStr.substring(6,8);
    
    var combined = {}; // Key: resno
    var dailyTotal = 0;
    var dailyDone = 0;

    // 1. 네이버 예약 시트(sheet1) 데이터 선행 분석
    for (var i = 1; i < data1.length; i++) {
      var row = data1[i];
      var rawDateTime = String(row[6] || '').trim(); // "2026.04.13(월) 오후 2:00"
      if (rawDateTime.indexOf(targetDateDot) === -1) continue;
      
      var resno = String(row[4] || '').trim();
      if (!resno) continue;
      
      var timeMatch = rawDateTime.match(/(오전|오후)\s*(\d{1,2}):(\d{2})/);
      var time = '';
      if (timeMatch) {
        var ampm = timeMatch[1], hour = parseInt(timeMatch[2]), min = timeMatch[3];
        if (ampm === '오후' && hour < 12) hour += 12;
        if (ampm === '오전' && hour === 12) hour = 0;
        time = String(hour).padStart(2,'0') + ':' + min;
      }

      combined[resno] = {
        resno: resno,
        name: String(row[2] || '이름없음').trim(),
        product: String(row[5] || '').trim(),
        people: (rawDateTime.match(/(\d+)명/) || [null,'1'])[1],
        time: time,
        source: 'N',
        checkedIn: false
      };
    }

    // 2. 마스터 시트 데이터 분석 및 병합 (체크인 상태 및 현장 고객 추가)
    for (var i = 1; i < dataM.length; i++) {
      var row = dataM[i];
      var rowDateVal = row[0];
      var rowDateStr = (rowDateVal instanceof Date) 
        ? Utilities.formatDate(rowDateVal, 'Asia/Seoul', 'yyyy-MM-dd') 
        : String(rowDateVal || '').trim();
      
      if (rowDateStr !== targetDate) continue;
      
      var resno = String(row[2] || '').trim();
      var checkinAt = String(row[11] || '').trim();
      
      if (combined[resno]) {
        // 이미 네이버 시트에 있는 경우 업데이트
        if (checkinAt) combined[resno].checkedIn = true;
        // 현장에서 확인된 실명이 마스터 로그에 있다면 해당 이름으로 표시
        var masterRealName = String(row[3] || '').trim();
        if (masterRealName) combined[resno].name = masterRealName;
      } else {
        // 마스터에만 있는 경우 (현장/체험 등)
        combined[resno] = {
          resno: resno,
          name: String(row[3] || '이름없음').trim(),
          product: String(row[5] || '').trim(),
          people: String(row[6] || '1'),
          time: String(row[1] || '').trim(),
          source: String(row[10] || 'A').toUpperCase(),
          checkedIn: !!checkinAt
        };
      }

    }

    // 3. 일일 통계 집계 및 리스트 필터링
    var reservations = [];
    Object.keys(combined).forEach(function(key) {
      var item = combined[key];
      dailyTotal++;
      if (item.checkedIn) dailyDone++;
      
      if (item.time === timeReq) {
        reservations.push(item);
      }
    });

    // 시간/번호순 정렬
    reservations.sort(function(a,b){ return a.resno.localeCompare(b.resno); });
    
    return { 
      ok: true, 
      reservations: reservations,
      dailyStats: {
        total: dailyTotal,
        done: dailyDone,
        wait: dailyTotal - dailyDone
      }
    };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}



// ── 워크인 코드 생성 ────────────────────────────────────────
function getWalkInCode(dateStr) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet2 = ss.getSheetByName(SHEET_NAME_2ND);
    if (!sheet2) {
      return { ok: true, code: dateStr + '-W1' };
    }
    
    var data = sheet2.getDataRange().getValues();
    var maxNum = 0;
    for (var i = 1; i < data.length; i++) {
      var resno = String(data[i][3] || '');
      var pattern = dateStr + '-W';
      if (resno.indexOf(pattern) === 0) {
        var numPart = resno.replace(pattern, '');
        var num = parseInt(numPart);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    
    return { ok: true, code: dateStr + '-W' + (maxNum + 1) };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── 체크인 처리 ─────────────────────────────────────────────
function checkin(req) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000); // 동시성 방지: 최대 15초 대기
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet2 = ss.getSheetByName(SHEET_NAME_2ND);
    if (!sheet2) {
      sheet2 = ss.insertSheet(SHEET_NAME_2ND);
      sheet2.appendRow(['checkin_at','date','time','reservation_no','masked_name','real_name','product','people','email','phone','privacy_consent','sns_consent','memo','type','photo_path','folder_url','delivery_status','edit_status','result_url','delivery_sent_at']);
    }
    
    var finalResno = req.resno;
    
    // 워크인 접수건의 Race Condition (채번 중복) 방어 및 치유 로직
    if (req.isNew) {
      var data = sheet2.getDataRange().getValues();
      var maxNum = 0;
      var collision = false;
      var pattern = req.date + '-W'; // e.g. 20260412-W
      
      for (var i = 1; i < data.length; i++) {
        var existing = String(data[i][3] || '');
        if (existing === req.resno) {
          collision = true;
        }
        if (existing.indexOf(pattern) === 0) {
          var num = parseInt(existing.replace(pattern, ''));
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      
      if (collision) {
        finalResno = pattern + (maxNum + 1);
        if (req.folderId) {
          try {
            // 이미 초기 resno로 생성된 드라이브 폴더의 이름을 실제 새 번호로 교체
            DriveApp.getFolderById(req.folderId).setName(finalResno + '_' + req.realName);
          } catch(e) {}
        }
      }
    }
    
    var now = new Date();
    var checkinAt = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    var date = req.date.substring(0,4) + '-' + req.date.substring(4,6) + '-' + req.date.substring(6,8);
    
    // result 빈 폴더 자동 생성 (편집자용)
    if (req.folderId) {
      try {
        var custFolder = DriveApp.getFolderById(req.folderId);
        getOrCreateFolder(custFolder, 'result');
      } catch(e) {
        Logger.log('result 폴더 생성 실패: ' + e.toString());
      }
    }
    
    // 마스터 시트에 기록 (기존 예약 찾기 또는 신규)
    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
    if (!masterSheet) {
      masterSheet = masterSS.insertSheet(MASTER_SHEET_NAME);
      masterSheet.appendRow(MASTER_HEADERS);
    }
    
    var rowIndex = findRowInMasterByResno(masterSheet, finalResno);
    
    if (rowIndex === -1) {
      // 신규 행 추가 (Walk-in 또는 누락된 예약)
      masterSheet.appendRow([
        date,             // Col 0: use_date ("2026-04-13")
        req.time,         // Col 1: use_time
        finalResno,       // Col 2: reservation_no
        req.realName,     // Col 3: real_name
        req.maskedName || '', // Col 4: masked_name
        req.product,      // Col 5: product
        req.people,       // Col 6: people
        req.email || '',  // Col 7: email
        req.phone || '',  // Col 8: phone
        req.memo || '',   // Col 9: memo
        req.source || 'A',// Col 10: customer_source
        checkinAt,        // Col 11: checkin_at
        req.folderId ? 'https://drive.google.com/drive/folders/' + req.folderId : '',
        '미완료',         // edit_status
        '',               // result_url
        '미발송',         // delivery_status
        '',               // delivery_sent_at
        req.privacyConsent ? 'Y' : 'N',
        req.snsConsent ? 'Y' : 'N',
        req.isNew ? '현장결제' : '사전예약'
      ]);
    } else {
      // 기존 예약 행 업데이트
      masterSheet.getRange(rowIndex, 4).setValue(req.realName);   // real_name 업데이트
      masterSheet.getRange(rowIndex, 12).setValue(checkinAt);     // checkin_at
      masterSheet.getRange(rowIndex, 13).setValue(req.folderId ? 'https://drive.google.com/drive/folders/' + req.folderId : '');
      masterSheet.getRange(rowIndex, 18).setValue(req.privacyConsent ? 'Y' : 'N');
      masterSheet.getRange(rowIndex, 19).setValue(req.snsConsent ? 'Y' : 'N');
      if (req.memo) masterSheet.getRange(rowIndex, 10).setValue(req.memo);
      if (req.email) masterSheet.getRange(rowIndex, 8).setValue(req.email);
      if (req.phone) masterSheet.getRange(rowIndex, 9).setValue(req.phone);
    }

    
    return { ok: true, resno: finalResno };
  } catch (err) {
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ── 체험 고객 추가 (Source 'V') ──────────────────────────────────
function checkinExperience(req) {
  req.source = 'V';
  req.memo = '[체험/테스트] ' + (req.memo || '');
  return checkin(req);
}

// ── 사진 저장 ─────────────────────────────────────────────
function savePhotoPost(req) {
  try {
    var rootFolder = DriveApp.getFolderById(ROOT_FOLDER_ID);
    var brandFolder = getOrCreateFolder(rootFolder, 'DKsequence_중문별장');
    
    var year = req.date.substring(0, 4);
    var yearFolder = getOrCreateFolder(brandFolder, year);
    var dateFolder = getOrCreateFolder(yearFolder, req.date);
    var timeFolder = getOrCreateFolder(dateFolder, req.time);
    
    var customerFolderName = req.resno + '_' + req.realName;
    var customerFolder = getOrCreateFolder(timeFolder, customerFolderName);
    
    var blob = Utilities.newBlob(
      Utilities.base64Decode(req.base64),
      req.mimeType || 'image/jpeg',
      req.filename
    );
    
    var file = customerFolder.createFile(blob);
    var fileUrl = file.getUrl();
    
    return {
      ok: true,
      folderId: customerFolder.getId(),
      fileUrl: fileUrl
    };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function getOrCreateFolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parent.createFolder(name);
}

// ── 이메일 파싱 ────────────────────────────────────────────
function parseReservationEmail(body) {
  try {
    var data = {};
    
    var nameMatch = body.match(/예약자명[:\s]+(.+?)[\r\n]/);
    data.reservation_name = nameMatch ? nameMatch[1].trim() : '';
    
    var noMatch = body.match(/예약번호[:\s]+(\d+)/);
    data.reservation_no = noMatch ? noMatch[1] : '';
    
    var productMatch = body.match(/예약상품[:\s]+(.+?)[\r\n]/);
    data.product_name = productMatch ? productMatch[1].trim() : '';
    
    var dateMatch = body.match(/이용일시[:\s]+(\d{4})\.(\d{2})\.(\d{2})[^,]+,?\s*(오전|오후)\s*(\d{1,2}):(\d{2})[^,]*,?\s*(\d+)명/);
    
    if (dateMatch) {
      var year = dateMatch[1];
      var month = dateMatch[2];
      var day = dateMatch[3];
      var ampm = dateMatch[4];
      var hour = parseInt(dateMatch[5]);
      var minute = dateMatch[6];
      var people = dateMatch[7];
      
      if (ampm === '오후' && hour < 12) {
        hour += 12;
      }
      if (ampm === '오전' && hour === 12) {
        hour = 0;
      }
      
      data.use_date = year + month + day;
      data.use_time = String(hour).padStart(2, '0') + ':' + minute;
      data.people_count = people;
    }
    
    var paymentMatch = body.match(/결제상태[:\s]+(.+?)[\r\n]/);
    data.booking_status = paymentMatch ? paymentMatch[1].trim() : '';
    
    return { ok: true, data: data };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── Naver 예약 처리 ──────────────────────────────────────────
function processNaverReservation(emailBody) {
  try {
    var parseResult = parseReservationEmail(emailBody);
    if (!parseResult.ok) {
      return { ok: false, error: 'Email parsing failed: ' + parseResult.error };
    }
    
    var data = parseResult.data;
    
    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
    if (!masterSheet) {
      masterSheet = masterSS.insertSheet(MASTER_SHEET_NAME);
      masterSheet.appendRow(MASTER_HEADERS);
    }
    
    var dateFormatted = data.use_date.substring(0,4) + '-' + 
                        data.use_date.substring(4,6) + '-' + 
                        data.use_date.substring(6,8);
    
    // 마스터 시트에 예약 정보 추가 (Source 'N')
    masterSheet.appendRow([
      dateFormatted,
      data.use_time,
      data.reservation_no,
      data.reservation_name,
      '', // masked_name
      data.product_name,
      data.people_count,
      '', // email (파싱된 이메일이 있으면 추후 확장)
      '', // phone
      '', // memo
      'N', // customer_source
      '', // checkin_at
      '', // folder_url
      '미완료', // edit_status
      '', // result_url
      '미발송', // delivery_status
      '', // delivery_sent_at
      '', // privacy
      '', // sns
      '사전예약' // type
    ]);
    
    createCalendarEvent(data);
    
    return { ok: true, message: 'Reservation saved to Master Log' };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── 캘린더 이벤트 생성 ────────────────────────────────────────
function createCalendarEvent(data) {
  try {
    var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) {
      Logger.log('Calendar not found: ' + CALENDAR_ID);
      return;
    }
    
    var year = parseInt(data.use_date.substring(0, 4));
    var month = parseInt(data.use_date.substring(4, 6)) - 1;
    var day = parseInt(data.use_date.substring(6, 8));
    
    var timeParts = data.use_time.split(':');
    var hour = parseInt(timeParts[0]);
    var minute = parseInt(timeParts[1]);
    
    var startTime = new Date(year, month, day, hour, minute);
    var endTime = new Date(year, month, day, hour + 1, minute);
    
    var title = '[예약] ' + data.reservation_name + ' · ' + data.product_name;
    
    var description = '예약번호: ' + data.reservation_no + '\n' +
                     '상품: ' + data.product_name + '\n' +
                     '인원: ' + data.people_count + '명\n' +
                     '상태: ' + data.booking_status;
    
    calendar.createEvent(title, startTime, endTime, {
      description: description,
      location: 'DKsequence × 중문별장'
    });
    
    Logger.log('Calendar event created: ' + title);
  } catch (err) {
    Logger.log('Calendar event creation failed: ' + err.toString());
  }
}

// ════════════════════════════════════════════════════════════
// 3차 개발: 후반작업 자동 납품 시스템
// ════════════════════════════════════════════════════════════

// ── 납품 관리 목록 조회 ────────────────────────────────────────
function getDeliveryList(dateStr) {
  try {
    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var sheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
    if (!sheet) return { ok: true, items: [] };
    
    var data = sheet.getDataRange().getValues();
    var items = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowDateVal = row[0];
      var rowDateStr = '';
      
      if (rowDateVal instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDateVal, 'Asia/Seoul', 'yyyyMMdd');
      } else {
        rowDateStr = String(rowDateVal || '').replace(/-/g, '');
      }
      
      if (rowDateStr !== dateStr) continue;
      
      items.push({
        rowIndex: i + 1,
        resno: String(row[2] || ''),
        realName: String(row[3] || ''),
        maskedName: String(row[4] || ''),
        product: String(row[5] || ''),
        people: String(row[6] || ''),
        email: String(row[7] || ''),
        phone: String(row[8] || ''),
        time: String(row[1] || ''),
        source: String(row[10] || 'A'),
        checkinAt: String(row[11] || ''),
        folderUrl: String(row[12] || ''),
        editStatus: String(row[13] || '미완료'),
        resultUrl: String(row[14] || ''),
        deliveryStatus: String(row[15] || '미발송'),
        deliverySentAt: String(row[16] || '')
      });
    }
    
    return { ok: true, items: items };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ── 보정완료 체크 + 링크 공유 자동화 ──────────────────────────
function markEditDone(resno) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var sheet = ss.getSheetByName(MASTER_SHEET_NAME);
    if (!sheet) return { ok: false, error: 'Master sheet not found' };
    
    var targetRow = findRowInMasterByResno(sheet, resno);
    if (targetRow === -1) return { ok: false, error: 'Row not found in Master' };
    
    var folderUrl = sheet.getRange(targetRow, 13).getValue(); // folder_url (Column M)
    var resultUrl = '';
    
    if (folderUrl) {
      var folderIdMatch = folderUrl.match(/folders\/([^?&\/]+)/);
      if (folderIdMatch) {
        var custFolder = DriveApp.getFolderById(folderIdMatch[1]);
        var resultFolder = getOrCreateFolder(custFolder, 'result');
        resultFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        resultUrl = 'https://drive.google.com/drive/folders/' + resultFolder.getId();
      }
    }
    
    sheet.getRange(targetRow, 14).setValue('보정완료'); // edit_status (Column N)
    sheet.getRange(targetRow, 15).setValue(resultUrl);    // result_url (Column O)
    
    return { ok: true, resultUrl: resultUrl };
  } catch (err) {
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ── 납품 이메일 발송 ────────────────────────────────────────
function sendDeliveryEmail(resno) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = SpreadsheetApp.openById(MASTER_SS_ID);
    var sheet = ss.getSheetByName(MASTER_SHEET_NAME);
    if (!sheet) return { ok: false, error: 'Master sheet not found' };
    
    var targetRow = findRowInMasterByResno(sheet, resno);
    if (targetRow === -1) return { ok: false, error: 'Row not found in Master' };
    
    var rowData = sheet.getRange(targetRow, 1, 1, 20).getValues()[0];
    
    var email = String(rowData[7] || '').trim(); // email (Column H)
    if (!email) return { ok: false, error: '이메일 주소가 없습니다.' };
    
    var customerName = String(rowData[3] || '고객'); // real_name (Column D)
    var product = String(rowData[5] || '');        // product (Column F)
    var people = String(rowData[6] || '');         // people (Column G)
    var date = String(rowData[0] || '');           // use_date (Column A)
    var resultUrl = String(rowData[14] || '');     // result_url (Column O)
    
    if (!resultUrl) return { ok: false, error: '보정완료 처리가 필요합니다.' };
    
    var htmlBody = buildDeliveryEmailHtml(customerName, product, people, date, resultUrl);
    
    GmailApp.sendEmail(email, 
      'DKsequence × 중문별장 — ' + customerName + '님의 촬영 결과물이 준비되었습니다',
      '촬영 결과물 확인: ' + resultUrl,
      {
        htmlBody: htmlBody,
        name: 'DKsequence × 중문별장'
      }
    );
    
    var now = new Date();
    var sentAt = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
    sheet.getRange(targetRow, 16).setValue('발송완료 (' + sentAt.split(' ')[0] + ')'); // delivery_status (Column P)
    sheet.getRange(targetRow, 17).setValue(sentAt); // sent_at (Column Q)
    
    return { ok: true, sentAt: sentAt };
  } catch (err) {
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

// ── 납품 이메일 HTML 템플릿 ───────────────────────────────────
function buildDeliveryEmailHtml(name, product, people, date, resultUrl) {
  return '<!DOCTYPE html>' +
    '<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#000;">' +
      '<tr><td style="padding:40px 32px 20px;text-align:center;">' +
        '<div style="font-size:22px;font-weight:700;color:#fff;letter-spacing:0.04em;">DKsequence × 중문별장</div>' +
        '<div style="width:60px;height:2px;background:linear-gradient(90deg,#abc7ff,#0071e3);margin:16px auto 0;"></div>' +
      '</td></tr>' +
      '<tr><td style="padding:24px 32px;">' +
        '<div style="font-size:28px;font-weight:700;color:#fff;margin-bottom:8px;">' + name + ' 님,</div>' +
        '<div style="font-size:16px;color:#b0b0b0;line-height:1.7;">촬영해 주셔서 진심으로 감사드립니다.<br>보정 완료된 사진이 준비되었습니다.</div>' +
      '</td></tr>' +
      '<tr><td style="padding:0 32px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid rgba(255,255,255,0.1);border-radius:12px;">' +
          '<tr><td style="padding:20px 24px;">' +
            '<div style="font-size:11px;color:#888;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:14px;">촬영 정보</div>' +
            '<table cellpadding="0" cellspacing="0" style="width:100%;">' +
              '<tr><td style="padding:6px 0;font-size:14px;color:#888;width:80px;">📅 날짜</td><td style="padding:6px 0;font-size:15px;color:#fff;font-weight:600;">' + date + '</td></tr>' +
              '<tr><td style="padding:6px 0;font-size:14px;color:#888;">📷 상품</td><td style="padding:6px 0;font-size:15px;color:#fff;font-weight:600;">' + product + '</td></tr>' +
              '<tr><td style="padding:6px 0;font-size:14px;color:#888;">👥 인원</td><td style="padding:6px 0;font-size:15px;color:#fff;font-weight:600;">' + people + '명</td></tr>' +
            '</table>' +
          '</td></tr>' +
        '</table>' +
      '</td></tr>' +
      '<tr><td style="padding:28px 32px;text-align:center;">' +
        '<a href="' + resultUrl + '" target="_blank" style="display:inline-block;padding:18px 48px;background:linear-gradient(135deg,#abc7ff,#0071e3);color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:12px;letter-spacing:0.03em;">📁 사진 확인하기</a>' +
        '<div style="font-size:12px;color:#666;margin-top:14px;">버튼이 작동하지 않으면 아래 링크를 복사해 주세요</div>' +
        '<div style="font-size:11px;color:#555;margin-top:6px;word-break:break-all;">' + resultUrl + '</div>' +
      '</td></tr>' +
      '<tr><td style="padding:20px 32px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">' +
        '<div style="font-size:12px;color:#555;line-height:1.8;">문의: hello@dksequence.com<br>ⓒ DKsequence. All rights reserved.</div>' +
      '</td></tr>' +
    '</table>' +
    '</body></html>';
}

// ════════════════════════════════════════════════════════════
// 통합 마스터 시스템: 데이터 마이그레이션 및 초기화
// ════════════════════════════════════════════════════════════

/**
 * 기존 '2차_체크인' 시트의 데이터를 신규 마스터 시트로 이전 (1회성)
 */
function migrateDataToMaster() {
  try {
    var oldSS = SpreadsheetApp.openById(SHEET_ID);
    var oldSheet = oldSS.getSheetByName(SHEET_NAME_2ND);
    if (!oldSheet) return "No old data found.";
    
    var masterSS = SpreadsheetApp.openById(MASTER_SS_ID);
    var masterSheet = masterSS.getSheetByName(MASTER_SHEET_NAME);
    if (!masterSheet) {
      masterSheet = masterSS.insertSheet(MASTER_SHEET_NAME);
      masterSheet.appendRow(MASTER_HEADERS);
    }
    
    var oldData = oldSheet.getDataRange().getValues();
    if (oldData.length <= 1) return "No rows to migrate.";
    
    var count = 0;
    for (var i = 1; i < oldData.length; i++) {
      var r = oldData[i];
      // 기존 날짜 포맷 (예: "2026-04-12") 유지
      var dateVal = (r[1] instanceof Date) ? Utilities.formatDate(r[1], 'Asia/Seoul', 'yyyy-MM-dd') : String(r[1]);
      
      var newRow = [
        dateVal, // use_date
        r[2],    // use_time
        r[3],    // resno
        r[5],    // real_name
        r[4],    // masked_name
        r[6],    // product
        r[7],    // people
        r[8],    // email
        r[9],    // phone
        r[12],   // memo
        'A',     // customer_source (기존 데이터는 현장용 'A'로 간주)
        (r[0] instanceof Date) ? Utilities.formatDate(r[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(r[0]), // checkin_at
        r[15],   // folder_url
        r[17] || '미완료', // edit_status
        r[18] || '',      // result_url
        r[16] || '미발송', // delivery_status
        (r[19] instanceof Date) ? Utilities.formatDate(r[19], 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(r[19]), // delivery_sent_at
        r[10],   // privacy
        r[11],   // sns
        r[13]    // type
      ];
      masterSheet.appendRow(newRow);
      count++;
    }
    
    return "SUCCESS: Migrated " + count + " rows to " + MASTER_SHEET_NAME;
  } catch (err) {
    return "ERROR: " + err.toString();
  }
}

/**
 * 마스터 시트에서 특정 예약번호의 행 번호 찾기 (헤더 제외 1-indexed)
 */
function findRowInMasterByResno(sheet, resno) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2] || '').trim() === String(resno).trim()) {
      return i + 1;
    }
  }
  return -1;
}


