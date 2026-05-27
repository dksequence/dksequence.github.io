// 고객전용 프라이빗 갤러리 — 프론트 (GAS 백엔드 + 다국어 ko/en/zh)
// ?c=resno&t=token. 우상단 언어버튼으로 전체 페이지 언어 전환(한 번에 한 언어).

const GAS_URL = "https://script.google.com/macros/s/AKfycby85mMvihHsSClT73x4rECt3DG4_sH_oNWJqifVclmfauh2eqsVUPgrTdzMaF6LJFMqcw/exec";
const params = new URLSearchParams(location.search);
const RESNO = (params.get("c") || "").trim();
const TOKEN = (params.get("t") || "").trim();
// preview=소유자 점검(열람시각 firstAccessAt 미기록).
//  preview=1 → 이 브라우저를 '소유자'로 영구 표시(localStorage). 이후 preview 없는 고객 raw링크를
//             눌러도 자동 소유자 취급 → 소유자가 실수로 고객링크를 눌러도 수신확인이 오염되지 않음.
//  preview=0 → 소유자 표시 해제(그 브라우저를 다시 일반 고객처럼 — 실제 열람 동작 테스트용).
//  고객 기기는 preview=1 링크를 받은 적이 없으므로 플래그가 없어 정상 기록(고객 동작 영향 0).
const OWNER_KEY = "dkgallery.owner";
const PREVIEW_PARAM = params.get("preview");
try {
  if (PREVIEW_PARAM === "1") localStorage.setItem(OWNER_KEY, "1");
  else if (PREVIEW_PARAM === "0") localStorage.removeItem(OWNER_KEY);
} catch (e) {}
let OWNER_FLAG = false;
try { OWNER_FLAG = localStorage.getItem(OWNER_KEY) === "1"; } catch (e) {}
const PREVIEW = PREVIEW_PARAM === "1" || OWNER_FLAG;

// 샘플(홍보) 모드: ?demo=1 → GAS 호출 없이 내장 샘플 사진으로 렌더(토큰 불필요).
// 상품페이지 "샘플 보기" 대상이자 디자인 다듬기용 미리보기. 실제 갤러리와 같은 코드/CSS를 공유.
const DEMO = params.get("demo") === "1";
const SAMPLE = (params.get("sample") || "").trim();       // ?demo=1&sample=별장화보 → 해당 화보 폴더 샘플(GAS getSampleGallery)
// 테마: 기본 'jeju'(밝은 제주 — 납품·샘플 공통 기본). 'lux'(럭셔리 다크)는 &theme=lux 로 명시할 때만.
const THEME = (params.get("theme") || "jeju").toLowerCase();

// 마무리 카드 링크 — 스튜디오가 실제 값으로 채우기(비면 해당 버튼 숨김).
const NAVER_REVIEW_URL = "https://m.place.naver.com/my/review";   // 사장님 지정(2026-05-27). ※my/review=본인 리뷰목록 페이지(업체 리뷰쓰기 아님) — 추후 중문별장 플레이스 리뷰URL로 교체 권장
const BOOKING_URL = "https://dksequence.github.io";       // 예약/문의(임시: 홈페이지)
const INSTAGRAM_HANDLE = "@dksequence";                   // TODO: 실제 인스타 핸들
// [edited, dk, letter] Drive 파일ID — 기존 테스트 갤러리(문희규 9999999001)의 실제 사진.
const DEMO_IDS = [
  ["1nBuVuKXS9EauskhPcRToaSV_OhNcJ5Vw", "1_C7VJ1CNgMT5xwCYwigF2dJbiN4nvNPV", "1Dw31n6c0ygP1o2wUX6RdV24HXl7rSRcQ"],
  ["1yhI0wzqcFegZwCzdtGkQbJzawt0WZXYm", "1wU-9AQKR3IkUIflKmPRrNDT0cRBJBey5", "1wTZPaMB-CdeY4bKLiUVg176QcEj3NXiQ"],
  ["1uJTGHofAHA3AV-kZeOU4l2jbkg05NiAU", "1ufqTB7-WMoxeOSnDuzvV75keAppS2JGE", "1njwLXg-b-FOqo3y4KQS9qJldsp72yM1H"],
  ["1ghgIn_TfUDns4SMVDn40dn7FlK2aYTBY", "1CrNbzK-qcyT5PFsk0cBZWkQA7oN-ObGz", "1uQ-eCzYM8J7lSSO4UN7KTIKvQZ4MctQG"],
  ["1zKpQnPwdxjXropL3babV7kcVWV_2sjVS", "1xStvLhDBeGNRXwUip40a99PIdBeQk9Ll", "11PA8gyGI0FWZVIkB-TLoq8i1YLCSA2kC"],
  ["1VkJcxSs3QVKX0dGAP4jsE6IzXLBZIull", "1Kkwacji37-zanKAMoLcgMoMcxee94pYD", "1h-9b-xRZU64m8Sr28UHFLTXL-ETDNIqI"],
  ["12tHcpMGveJHgoGIYZU7-FHXP-qddykZM", "1fI0smv93NpT737NY7Q3-Zmemz18yyKPW", "1VOWH9zyfKclqNpTtc8d4bc37F-NliVDa"],
  ["1NPVduUdFBc51t_-HuD010vg_TMwLx40z", "1YIuhUxX2ec5h36mCVDM1dCWmA6WtLxsb", "1w9UC_Q6iAd9R-9gw_t0Yh6KVtQg_6gAU"],
  ["100zq__C-zUyPufwnVBl7IDpNDDyzuKKM", "1lxxOI6RrXEBvS8DzX_hBsvHGBMR2rgnF", "1SKusRMqGwYHdElwO1VOd19jSmYXhKrrJ"],
  ["1NjZXczlrnqOobtqmdbFLtGRy2kPMRiMY", "1wOrYna_L1UUwGITGZkB-JZ8KZEQzBVqK", "15zJSbdTqrfxdEgDI6iSLps_hvY5F7x6R"],
  ["1Mo_fQNs8RXTKtc9OuRoBe2KFj6reu4yy", "1Mbb3gEBJBGNvh8Ye707cxnN2-mADIzzx", "1Llwm6Sz-ad0NOVjmH9BlA7JXaxNm9stF"],
  ["1a99iYuXJg7b6NtG7N3jK8f0F-evgTj5Q", "1vVsKlOXx_6dsitcSUkMCBA01yaZTN28g", "1u2XJ-9ZLDGogxWZxTWpA30egS30Ks_gQ"],
  ["18O1w4-pjwk5UJCnYnYn_1rQaO12uunIX", "1x3-UggppwnwBMzMNl1-7oEhS7HEsDFIM", "1wnK0rXV5ehIoru1sHiBTMDHIYp-35qFt"],
];
function demoImages() {
  const mk = (id) => ({ url: `https://drive.google.com/thumbnail?id=${id}&sz=w2000`, download: `https://drive.google.com/uc?export=download&id=${id}` });
  return DEMO_IDS.map((ids, i) => ({
    id: `demo_${i + 1}`, title: `sample_${i + 1}`, orientation: "portrait",
    variants: { edited: { label: "보정원본", ...mk(ids[0]) }, dk: { label: "DK Marked", ...mk(ids[1]) }, letter: { label: "Letter", ...mk(ids[2]) } },
  }));
}

const I18N = {
  ko: {
    titleSuffix: "님 화보 Gallery", titleGeneric: "화보 Gallery",
    subtitle: "오늘의 소중한 순간을 천천히 감상하고 자유롭게 내려받아 주세요.",
    titleJeju: "제주 추억 Gallery",
    poem: "소리 없이 쏟아지는\n귤빛 오후의 조각들\n나무들의 다정한 속삭임과\n건반 위로 내려앉은 윤슬\n기분 좋은 여행 속에서\n커피와 바람, 그리고 우리\n이 순간의 공기마저\n기억되기를",
    downloadAll: "전체 사진 다운로드",
    wifi: "⚠ 용량이 크니 와이파이 환경에서 다운로드를 권장드립니다.",
    letterLabel: "제주에서 보내는 편지",
    expiry: (d) => `이 갤러리는 ${d}까지<br>보관 후 자동 만료됩니다. 그 전에 받아주세요 :)`,
    expiryNoDate: "촬영일로부터 30일 후 자동 만료됩니다. 미리 받아주세요 :)",
    captions: [
      "소중한 순간이 예쁘게 담겼어요~", "오늘의 여행이 사진으로 남았어요", "이 순간, 오래 기억되길 바라요",
      "지금의 미소를 예쁘게 담았어요", "여행 속 가장 따뜻한 순간", "당신의 오늘이 사진이 되었어요",
      "제주에서 만난 특별한 한 장", "오늘의 기억을 곱게 담았어요", "오래 꺼내보고 싶은 순간",
      "이 장면이 좋은 기억으로 남길", "바람이 머문 자리, 당신의 순간", "여행의 온도가 사진에 담겼어요",
      "오늘의 빛이 당신을 기억해요", "잠시 멈춘 여행의 한 장면", "아무렇지 않은 듯, 가장 예쁜 순간",
      "그날의 공기까지 함께 담았어요", "제주가 건넨 작은 선물", "빛과 바람 사이에 남은 기억",
      "오늘의 당신이 가장 자연스럽게", "여행은 지나가도 사진은 남아요",
    ],
    download: "↓ 받기",
    sortHearts: "♥ 하트순으로 보기",
    closeTitle: "소중한 추억, 어떠셨나요?",
    closeSub: "체험의 기억이 좋으셨다면 후기와 공유 부탁드립니다 :)",
    closeReview: "⭐ 후기 작성 가기", closeShare: "🔗 갤러리 공유", closeBook: "DKsequence", closeSaveCard: "📥 스토리 카드 저장",
    myPhotos: { title: "📷 내가 찍은 사진", hint: (max) => `중문별장에서 촬영하신 사진을 갤러리에서 함께 감상할 수 있어요~`, add: "사진 올리기", uploading: "올리는 중…", full: "사진이 가득 찼어요 :)", err: "업로드에 실패했어요. 다시 시도해 주세요.", count: (n, max) => `${n} / ${max}` },
    variants: { letter: "Letter", dk: "DK", edited: "원본" },
    loading: "갤러리를 불러오는 중입니다...", notFound: "갤러리를 찾을 수 없습니다.",
    expired: "열람 기간이 만료되었습니다.", invalid: "잘못된 접근입니다.", empty: "아직 사진이 없습니다.",
    fmtDate: (y, m, d) => `${y}년 ${m}월 ${d}일`,
  },
  en: {
    titleSuffix: "'s Photo Gallery", titleGeneric: "Photo Gallery",
    subtitle: "Feel free to enjoy and download today's precious moments.",
    titleJeju: "Jeju Memories Gallery",
    poem: "Quietly pouring down,\nfragments of a tangerine afternoon —\nthe gentle whispers of the trees,\nand the shimmer alighting on the keys.\nWithin this happy journey:\ncoffee, the wind, and us.\nMay even the air of this moment\nbe remembered.",
    downloadAll: "Download All",
    wifi: "⚠ Files are large — downloading on Wi-Fi is recommended.",
    letterLabel: "A NOTE FROM JEJU",
    expiry: (d) => `Saved until ${d},<br>then auto-expires. Please download before then :)`,
    expiryNoDate: "Auto-expires 30 days after the shoot. Please download in time :)",
    captions: [
      "A precious moment, beautifully captured~", "Today's journey, saved in a photo", "May this moment be remembered for long",
      "Your smile, beautifully captured", "The warmest moment of the trip", "Your today became a photograph",
      "A special shot, taken in Jeju", "Today's memory, gently kept", "A moment you'll want to revisit",
      "May this scene stay a happy memory", "Where the wind paused — your moment", "The warmth of the journey, in one frame",
      "Today's light remembers you", "A still frame of a paused journey", "Effortless, yet the loveliest moment",
      "We captured the very air of that day", "A little gift from Jeju", "A memory left between light and wind",
      "You, at your most natural today", "Journeys pass, but photos remain",
    ],
    download: "↓ Save",
    sortHearts: "♥ Sort by favorites",
    closeTitle: "How were your memories?",
    closeSub: "If you enjoyed the experience, a review and a share would mean a lot :)",
    closeReview: "⭐ Write a review", closeShare: "🔗 Share gallery", closeBook: "DKsequence", closeSaveCard: "📥 Save story card",
    myPhotos: { title: "📷 Photos I took", hint: (max) => `Keep up to ${max} of your own trip photos here, too.`, add: "Add photo", uploading: "Uploading…", full: "That's the max :)", err: "Upload failed. Please try again.", count: (n, max) => `${n} / ${max}` },
    variants: { letter: "Letter", dk: "DK", edited: "Original" },
    loading: "Loading gallery...", notFound: "Gallery not found.",
    expired: "This gallery has expired.", invalid: "Invalid access.", empty: "No photos yet.",
    fmtDate: (y, m, d) => new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  },
  zh: {
    titleSuffix: " 的写真 Gallery", titleGeneric: "写真 Gallery",
    subtitle: "请慢慢欣赏并自由下载今天珍贵的瞬间。",
    titleJeju: "济州回忆 Gallery",
    poem: "无声倾洒而下\n橘色午后的碎片\n树木温柔的私语\n与落在琴键上的粼光\n在愉快的旅途中\n咖啡、风，还有我们\n愿这一刻的空气\n也被铭记",
    downloadAll: "全部下载",
    wifi: "⚠ 文件较大，建议在 Wi-Fi 环境下下载。",
    letterLabel: "来自济州的信",
    expiry: (d) => `本图库保存至 ${d}，<br>之后自动过期，请在此之前下载 :)`,
    expiryNoDate: "拍摄日起 30 天后自动过期，请尽早下载 :)",
    captions: [
      "珍贵的瞬间，被美好地记录下来~", "今天的旅程，留在了照片里", "愿这一刻，被长久记住",
      "此刻的微笑，被温柔定格", "旅途中最温暖的瞬间", "你的今天，成了一张照片",
      "在济州遇见的特别一张", "今日的记忆，被细细收藏", "一个想反复回味的瞬间",
      "愿这一幕成为美好的回忆", "风停留的地方，是你的瞬间", "旅行的温度，定格在照片里",
      "今天的光，记住了你", "旅途中静止的一帧", "不经意间，最美的瞬间",
      "连那天的空气也一同收录", "济州送来的小小礼物", "留在光与风之间的记忆",
      "今天的你，最自然的模样", "旅程会过去，照片会留下",
    ],
    download: "↓ 下载",
    sortHearts: "♥ 按喜爱排序",
    closeTitle: "这些回忆，您还喜欢吗？",
    closeSub: "如果您喜欢这次体验，欢迎留评与分享 :)",
    closeReview: "⭐ 写评价", closeShare: "🔗 分享相册", closeBook: "DKsequence", closeSaveCard: "📥 保存故事卡",
    myPhotos: { title: "📷 我拍的照片", hint: (max) => `最多可一并保存 ${max} 张您旅途中拍的照片。`, add: "上传照片", uploading: "上传中…", full: "已达上限 :)", err: "上传失败，请重试。", count: (n, max) => `${n} / ${max}` },
    variants: { letter: "Letter", dk: "DK", edited: "原图" },
    loading: "正在加载图库...", notFound: "找不到图库。",
    expired: "本图库已过期。", invalid: "无效访问。", empty: "暂无照片。",
    fmtDate: (y, m, d) => `${y}年${m}月${d}日`,
  },
};

let currentLang = localStorage.getItem("dkgallery.lang") || "ko";
if (!I18N[currentLang]) currentLang = "ko";

// 배경음악: 입장 확인박스의 [확인] 클릭이 재생을 트리거(브라우저 autoplay 정책 충족).
// 언어와 무관하게 동일 풀. 접속 때마다 랜덤 1곡. audio/1.mp3 ~ N.mp3 중 실제 존재하는 파일만 재생(없는 번호는 자동 건너뜀).
const BGM_MAX = 3;
let bgmStarted = false;
let bgmMuted = localStorage.getItem("dkgallery.muted") === "1";
let bgmIndex = 0;     // 현재 곡 번호(1..BGM_MAX). 0=시작 전
let bgmErrors = 0;    // 연속 누락 파일 가드

const state = { images: [], customerName: "", expY: 0, expM: 0, expD: 0, loaded: false, reelUrl: "", customerPhotos: [], customerMax: 5 };
const currentVariant = {};
const captionIdx = {}; // 사진별 감성문구 인덱스 고정 — 언어 전환 시 같은 문구의 번역본이 보이도록
const defaultVariant = {}; // 사진별 기본 변형(letter/WM 랜덤) 고정 — 재렌더(언어 전환) 때 안 바뀌도록
// 사진별 하트(0~5). 데모=localStorage / 실서비스=GAS galleryRatePhotos 로도 전송(상품개발 데이터)
const RATING_KEY = "dkgallery.hearts." + (DEMO ? "demo" : (RESNO || "x"));
let ratings = {};
try { ratings = JSON.parse(localStorage.getItem(RATING_KEY) || "{}") || {}; } catch (e) { ratings = {}; }
let ssTimer = null;   // 슬라이드쇼 자동전환 타이머(재렌더 시 정리)
let rateTimer = null; // 하트 입력 백엔드 전송 디바운스(연타 합치기)
let ssCapTimer = null; // 슬라이드쇼 거터 랜덤 문구 타이머
// 홍보용(?demo=1) = 쇼잉 전용: 다운로드 버튼은 보이되 동작 차단(안내만). 실제 납품 갤러리(?c=&t=)는 정상 다운로드.
const DEMO_TXT = {
  ko: { toast: "샘플(쇼잉용) 갤러리예요 :) 실제 촬영 후 받으시는 갤러리에선 원본·스토리카드를 모두 내려받으실 수 있어요.", introTitle: "✨ 샘플 갤러리입니다", introSub: "실제 촬영 결과물의 예시예요. 다운로드는 실제 갤러리에서 동작합니다 :)", badge: "SAMPLE · 샘플" },
  en: { toast: "This is a sample (showcase) gallery :) Your real gallery lets you download every original & story card.", introTitle: "✨ Sample Gallery", introSub: "A preview of your real results. Downloads work in your actual gallery :)", badge: "SAMPLE" },
  zh: { toast: "这是样品(展示用)图库 :) 正式图库可下载全部原图与故事卡。", introTitle: "✨ 样品图库", introSub: "这是成品预览。下载功能在正式图库中开放 :)", badge: "SAMPLE · 样品" },
};
function demoTxt() { return DEMO_TXT[currentLang] || DEMO_TXT.ko; }
function toast(msg) {                          // 공용 안내 토스트(하단 가운데 잠깐 표시)
  let el = document.getElementById("g-toast");
  if (!el) { el = document.createElement("div"); el.id = "g-toast"; el.className = "demo-toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3600);
}
function demoNotice() { toast(demoTxt().toast); }   // 홍보용: 다운로드 차단 안내
const REEL_TXT = {
  ko: { save: "동영상으로 저장", soon: "🎬 슬라이드쇼 영상은 준비되는 대로 여기서 받으실 수 있어요!" },
  en: { save: "Save as video", soon: "🎬 The slideshow video will be available here soon!" },
  zh: { save: "保存为视频", soon: "🎬 幻灯片视频准备好后可在此下载!" },
};
function reelTxt() { return REEL_TXT[currentLang] || REEL_TXT.ko; }
function setupDemoMode() {
  if (!DEMO) return;
  document.body.classList.add("is-demo");
  let b = document.getElementById("demo-badge");
  if (!b) { b = document.createElement("div"); b.id = "demo-badge"; b.className = "demo-badge"; document.body.appendChild(b); }
  applyDemoIntro();
}
function applyDemoIntro() {                    // 인트로 '용량 경고' → '샘플 안내'로 교체(BGM 시작 제스처는 유지) + 배지 갱신
  if (!DEMO) return;
  const txt = demoTxt();
  const b = document.getElementById("demo-badge"); if (b) b.textContent = txt.badge;
  const ov = document.getElementById("intro-overlay"); if (!ov) return;
  const ko = ov.querySelector(".intro-ko"); if (ko) ko.textContent = txt.introTitle;
  ov.querySelectorAll(".intro-sub").forEach((s, i) => { if (i === 0) s.textContent = txt.introSub; else s.remove(); });
}
const $ = (id) => document.getElementById(id);
const t = () => I18N[currentLang];

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => { applyLang(b.dataset.lang); applyDemoIntro(); }));
  setupJejuTheme();
  setupDemoMode();
  setupBgm();
  setupLightbox();
  setupPetals();
  setupHeartSort();
  applyLang(currentLang); // 정적 텍스트·버튼 즉시 반영
  loadGallery();
});

async function loadGallery() {
  if (DEMO) {                       // 샘플(홍보) 모드 — 쇼잉전용(다운로드 차단)
    if (SAMPLE) {                   // 폴더기반 상품 샘플: GAS getSampleGallery(최신 batch의 <화보> 폴더 사진)
      try {
        const res = await fetch(GAS_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "getSampleGallery", product: SAMPLE }) });
        const data = await res.json();
        state.images = (data && data.ok && data.images && data.images.length) ? data.images : demoImages();
      } catch (e) { state.images = demoImages(); }   // 실패 시 내장 데모 폴백
    } else {
      state.images = demoImages();  // sample 미지정 → 내장 데모 13장
    }
    state.customerName = "";        // 일반 제목(이름 없음)
    const exp = new Date(Date.now() + 30 * 864e5);   // 샘플 만료일 = 오늘+30
    state.expY = exp.getFullYear(); state.expM = exp.getMonth() + 1; state.expD = exp.getDate();
    state.loaded = true;
    applyLang(currentLang);
    setHero();
    return;
  }
  if (!RESNO || !TOKEN) { showMessage(t().invalid); return; }
  const loaderEl = $("gallery").querySelector(".loader");
  if (loaderEl) loaderEl.textContent = t().loading;
  try {
    const res = await fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getCustomerGallery", resno: RESNO, token: TOKEN, preview: PREVIEW ? "1" : "" }),
    });
    const data = await res.json();
    if (!data || data.ok === false) {
      showMessage(data && data.expired ? t().expired : t().notFound);
      return;
    }
    state.images = data.images || [];
    state.customerName = data.customer_name || "";
    state.reelUrl = data.reel_url || "";        // 릴스 mp4(있으면 슬라이드쇼 '동영상 저장'이 다운로드)
    state.customerPhotos = data.customer_photos || [];   // 고객이 올린 본인 사진(customer/ 하위)
    state.customerMax = data.customer_max || 5;
    parseExpire(data.expire_date || "");
    state.loaded = true;
    applyLang(currentLang);
    setHero();
  } catch (e) {
    console.error(e);
    showMessage(t().notFound);
  }
}

function parseExpire(s) {
  const m = String(s).match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (m) { state.expY = +m[1]; state.expM = +m[2]; state.expD = +m[3]; }
}

function showMessage(msg) {
  $("gallery").innerHTML = `<div class="loader error">${msg}</div>`;
}

function applyLang(lang) {
  if (!I18N[lang]) lang = "ko";
  currentLang = lang;
  localStorage.setItem("dkgallery.lang", lang);
  const tt = I18N[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll(".lang-btn").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
  const isJeju = THEME === "jeju";
  setText("subtitle", isJeju && tt.poem ? tt.poem : tt.subtitle);        // 제주 편지 = 시
  const titleEl = $("gallery-title");
  if (titleEl) titleEl.textContent = isJeju && tt.titleJeju ? tt.titleJeju
    : (state.customerName ? state.customerName + tt.titleSuffix : tt.titleGeneric);
  const labelEl = document.querySelector(".letter-label");
  if (labelEl && tt.letterLabel) labelEl.textContent = tt.letterLabel;   // 제주 편지 라벨 번역
  const expEl = $("expiry-note");
  if (expEl) expEl.innerHTML = state.expY ? tt.expiry(tt.fmtDate(state.expY, state.expM, state.expD)) : (tt.expiryNoDate || "");
  const hb = $("heart-sort"); if (hb && tt.sortHearts) hb.textContent = tt.sortHearts;
  if (state.loaded) renderItems();
}

function setText(id, txt) { const el = $(id); if (el) el.textContent = txt; }

function setupBgm() {
  const audio = $("bgm");
  const confirmBtn = $("intro-confirm");
  const toggle = $("bgm-toggle");
  if (audio) {
    audio.volume = 0.5;
    audio.addEventListener("ended", () => { bgmErrors = 0; playNextBgm(); });   // 곡 끝 → 다음 곡(순서대로)
    audio.addEventListener("playing", () => { bgmErrors = 0; });
    audio.addEventListener("error", () => {                                     // 없는 번호면 다음으로 건너뜀(전부 없으면 멈춤)
      if (!bgmStarted || bgmMuted) return;
      if (++bgmErrors <= BGM_MAX) playNextBgm();
    });
  }
  if (confirmBtn) confirmBtn.addEventListener("click", () => {
    const overlay = $("intro-overlay");
    if (overlay) overlay.classList.add("hidden");
    bgmStarted = true;
    if (toggle) toggle.classList.add("show");
    updateBgmIcon();
    if (!bgmMuted) startBgm();
  });
  if (toggle) toggle.addEventListener("click", () => {
    bgmMuted = !bgmMuted;
    localStorage.setItem("dkgallery.muted", bgmMuted ? "1" : "0");
    if (bgmMuted) { if (audio) audio.pause(); }
    else if (audio && audio.src) { audio.play().catch(() => {}); } // 같은 곡 이어재생
    else { startBgm(); }
    updateBgmIcon();
  });
}

function updateBgmIcon() { const toggle = $("bgm-toggle"); if (toggle) toggle.textContent = bgmMuted ? "🔇" : "♪"; }

function startBgm() { bgmIndex = 0; bgmErrors = 0; playNextBgm(); }   // 1번부터 순서대로

// 다음 곡(1→2→…→N→1 순환). 없는 번호는 error 리스너가 다시 호출해 건너뜀.
function playNextBgm() {
  const audio = $("bgm");
  if (!audio || bgmMuted) return;
  bgmIndex = (bgmIndex % BGM_MAX) + 1;
  audio.src = "audio/" + bgmIndex + ".mp3";
  audio.play().catch(() => {}); // play 정책 차단 등은 조용히 무시
}

function renderItems() {
  const container = $("gallery");
  if (ssTimer) { clearInterval(ssTimer); ssTimer = null; }   // 이전 슬라이드쇼 타이머 정리
  container.innerHTML = "";
  if (!state.images.length) { showMessage(t().empty); return; }
  window.galleryData = Object.fromEntries(state.images.map((img) => [img.id, img]));
  if (state.images.length >= 2) container.appendChild(createSlideshow());   // 첫 칸 = 슬라이드쇼
  state.images.forEach((image, i) => {
    const el = createGalleryItem(image);
    el.style.animationDelay = Math.min(i * 55, 550) + "ms";   // 살짝 시차 페이드인
    container.appendChild(el);
  });
  if (!DEMO && RESNO && TOKEN) container.appendChild(createCustomerSection());   // 실서비스: 고객 폰 업로드(내가 찍은 사진)
  container.appendChild(createClosingCard());   // 맨 끝 = 마무리 카드(리뷰·공유·재예약)
  const hb = $("heart-sort"); if (hb && state.images.length) hb.classList.add("show");   // 하트 정렬 버튼 노출
}

function pickDefaultVariant(image) {
  if (image.variants.letter && image.variants.letter.url) return "letter"; // 초기 선택 = letter 고정
  if (image.variants.dk && image.variants.dk.url) return "dk";
  return "edited";
}

function firstAvailableVariant(image) { // 다운로드 폴백용(결정적): letter→DK→원본
  if (image.variants.letter && image.variants.letter.url) return "letter";
  if (image.variants.dk && image.variants.dk.url) return "dk";
  if (image.variants.edited && image.variants.edited.url) return "edited";
  return "edited";
}

function createGalleryItem(image) {
  const tt = t();
  const item = document.createElement("article");
  item.className = `gallery-item ${image.orientation === "landscape" ? "landscape" : "portrait"}`;
  if (defaultVariant[image.id] === undefined) defaultVariant[image.id] = pickDefaultVariant(image);
  const def = defaultVariant[image.id];
  currentVariant[image.id] = def;
  if (captionIdx[image.id] === undefined) captionIdx[image.id] = Math.floor(Math.random() * tt.captions.length);
  const cap = tt.captions[captionIdx[image.id] % tt.captions.length];
  const defUrl = image.variants[def] ? thumbSize(image.variants[def].url, 1000) : "";
  const buttons = ["letter", "dk", "edited"]
    .filter((type) => image.variants[type] && image.variants[type].url)
    .map((type) => `<button class="variant-btn ${type === def ? "active" : ""}" type="button" data-type="${type}" data-id="${image.id}">${tt.variants[type]}</button>`)
    .join("");
  const heartBtns = [1, 2, 3, 4, 5]
    .map((n) => `<button class="heart" type="button" data-id="${image.id}" data-n="${n}" aria-label="${n}">♥</button>`)
    .join("");
  item.innerHTML = `
    <div class="image-frame"><img id="img-${image.id}" src="${defUrl}" alt="${image.id}" loading="lazy"></div>
    <div class="heart-rate" id="hr-${image.id}">${heartBtns}</div>
    <div class="item-overlay">
      <div class="overlay-copy"><span>${cap}</span></div>
      <div class="overlay-actions">
        <div class="variant-buttons" id="variants-${image.id}">${buttons}</div>
        <button class="download-icon-btn" type="button" onclick="downloadCurrent('${image.id}')"><span>${tt.download}</span></button>
      </div>
    </div>`;
  item.querySelectorAll(".variant-btn").forEach((b) => b.addEventListener("click", () => switchVariant(image.id, b.dataset.type)));
  item.querySelectorAll(".heart").forEach((h) => h.addEventListener("click", (e) => {
    e.stopPropagation();                          // 라이트박스 안 열리게
    const n = +h.dataset.n;
    ratings[image.id] = (ratings[image.id] === n) ? n - 1 : n;   // 같은 별 다시 누르면 한 칸 내림
    saveRatings();
    queueSubmitRatings();                          // 참여율 수집(디바운스): 정렬 안 눌러도 기록
    updateHearts(image.id, item);
    const b = $("heart-sort"); if (b) b.classList.add("show");
  }));
  updateHearts(image.id, item);
  const frame = item.querySelector(".image-frame");
  if (frame) frame.addEventListener("click", () => openLightbox(image.id));   // 사진 클릭 → 라이트박스
  return item;
}

function switchVariant(imageId, type) {
  const image = window.galleryData[imageId];
  const v = image && image.variants[type];
  if (!v || !v.url) return;
  currentVariant[imageId] = type;
  $(`img-${imageId}`).src = thumbSize(v.url, 1000);
  document.querySelectorAll(`#variants-${imageId} .variant-btn`).forEach((b) => b.classList.toggle("active", b.dataset.type === type));
}

window.downloadCurrent = function (imageId) {
  if (DEMO) { demoNotice(); return; }        // 홍보용(쇼잉): 다운로드 차단 — 안내만
  const image = window.galleryData[imageId];
  if (!image) return;
  const type = currentVariant[imageId] || firstAvailableVariant(image);
  const v = image.variants[type];
  if (v && v.download) triggerDownload(v.download);
};

// ── 사진 하트(점수) — 매기고 '하트순 정렬' 누르면 재배치, 실서비스는 백엔드 수집 ──
function saveRatings() { try { localStorage.setItem(RATING_KEY, JSON.stringify(ratings)); } catch (e) {} }
function updateHearts(id, scope) {
  const r = ratings[id] || 0;
  (scope || document).querySelectorAll(".heart").forEach((h) => {
    if (h.dataset.id === id) h.classList.toggle("on", +h.dataset.n <= r);
  });
}
function setupHeartSort() {
  if ($("heart-sort")) return;
  const btn = document.createElement("button");
  btn.id = "heart-sort";
  btn.type = "button";
  btn.className = "heart-sort-btn";
  btn.textContent = (t().sortHearts || "♥ 하트순으로 보기");
  btn.addEventListener("click", sortByHearts);
  document.body.appendChild(btn);
}
function sortByHearts() {
  state.images.sort((a, b) => (ratings[b.id] || 0) - (ratings[a.id] || 0));
  renderItems();
  submitRatings();
}
function queueSubmitRatings() {             // 하트 연타를 2.5초로 합쳐 1회만 전송(서버 부하·중복 방지)
  if (DEMO || !RESNO || !TOKEN) return;
  if (rateTimer) clearTimeout(rateTimer);
  rateTimer = setTimeout(submitRatings, 2500);
}
function submitRatings() {                 // 실서비스: 하트 데이터 백엔드 수집(상품개발)
  if (DEMO || !RESNO || !TOKEN) return;
  if (rateTimer) { clearTimeout(rateTimer); rateTimer = null; }
  try {
    fetch(GAS_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "galleryRatePhotos", resno: RESNO, token: TOKEN, ratings }),
    }).catch(() => {});
  } catch (e) {}
}

// ── 마무리 카드(갤러리 맨 끝): 리뷰 + 공유 + 재예약 CTA ──
function createClosingCard() {
  const tt = t();
  const card = document.createElement("article");
  card.className = "gallery-item closing-card";
  const review = `<a class="cc-btn primary" href="${NAVER_REVIEW_URL || "#"}" target="_blank" rel="noopener">${tt.closeReview}</a>`;   // 항상 노출(URL 비면 #)
  const book = BOOKING_URL ? `<a class="cc-btn" href="${BOOKING_URL}" target="_blank" rel="noopener">${tt.closeBook}</a>` : "";
  card.innerHTML = `<div class="cc-inner">
      <div class="cc-heart">♥</div>
      <h3>${tt.closeTitle}</h3>
      <p>${tt.closeSub}</p>
      <div class="cc-actions">${review}<button class="cc-btn" type="button" id="cc-savecard">${tt.closeSaveCard}</button><button class="cc-btn" type="button" id="cc-share">${tt.closeShare}</button>${book}</div>
      <div class="cc-handle">${INSTAGRAM_HANDLE}</div>
    </div>`;
  const sh = card.querySelector("#cc-share");
  if (sh) sh.addEventListener("click", shareGallery);
  const sv = card.querySelector("#cc-savecard");
  if (sv) sv.addEventListener("click", saveStoryCard);
  return card;
}

// ── 고객 폰 업로드: 여행 중 본인이 찍은 사진을 최대 customerMax장(기본5) 함께 보관 ──
function createCustomerSection() {
  const tt = t().myPhotos;
  const photos = state.customerPhotos || [];
  const max = state.customerMax || 5;
  const card = document.createElement("article");
  card.className = "gallery-item customer-section";
  const thumbs = photos.map((p) => `<div class="cust-thumb"><img src="${thumbSize(p.url, 600)}" alt="my photo" loading="lazy"></div>`).join("");
  const adder = (photos.length < max)
    ? `<label class="cust-add"><input type="file" id="cust-file" accept="image/*" multiple hidden><span class="cust-plus">＋</span><span>${tt.add}</span></label>`
    : `<div class="cust-add full">${tt.full}</div>`;
  card.innerHTML = `<div class="cust-inner">
      <h3>${tt.title} <span class="cust-count" id="cust-count">${tt.count(photos.length, max)}</span></h3>
      <p class="cust-hint">${tt.hint(max)}</p>
      <div class="cust-grid">${thumbs}${adder}</div>
      <div class="cust-status" id="cust-status"></div>
    </div>`;
  const file = card.querySelector("#cust-file");
  if (file) file.addEventListener("change", () => { if (file.files && file.files.length) uploadCustomerPhotos(file.files); });
  return card;
}

// 업로드 전 캔버스 리사이즈(최대변 maxDim) → JPEG base64(접두사 제거한 raw). 폰 원본 대용량 방지.
function resizeImageFile(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);   // 'data:...;base64,' 접두사 제거
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image load failed")); };
    img.src = url;
  });
}

function setCustStatus(msg) { const el = $("cust-status"); if (el) el.textContent = msg || ""; }

// 선택한 파일들을 남은 장수만큼만 순차 업로드(GAS galleryCustomerUpload) → state 반영 후 재렌더.
async function uploadCustomerPhotos(fileList) {
  if (DEMO || !RESNO || !TOKEN) return;
  const max = state.customerMax || 5;
  const remaining = max - (state.customerPhotos || []).length;
  if (remaining <= 0) { setCustStatus(t().myPhotos.full); return; }
  const files = Array.from(fileList).filter((f) => /^image\//.test(f.type)).slice(0, remaining);
  if (!files.length) return;
  let fail = 0;
  for (let i = 0; i < files.length; i++) {
    setCustStatus(`${t().myPhotos.uploading} (${i + 1}/${files.length})`);
    try {
      const base64 = await resizeImageFile(files[i], 1600);
      const res = await fetch(GAS_URL, {
        method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "galleryCustomerUpload", resno: RESNO, token: TOKEN, base64, filename: "upload_" + Date.now() + "_" + i + ".jpg", mimeType: "image/jpeg" }),
      });
      const data = await res.json();
      if (data && data.ok) { state.customerPhotos.push({ id: data.fileId, url: data.url }); }
      else { fail++; if (data && data.full) break; }
    } catch (e) { fail++; }
  }
  if (fail) toast(t().myPhotos.err);
  renderItems();   // 새 썸네일 + 카운트 갱신
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 1500);
}

// 인스타 스토리/릴스용 9:16(1080×1920) 카드 PNG 저장. 대표컷(하트1등 우선) + 타이틀 + @핸들.
// Drive 썸네일이 CORS 허용이면 사진 포함, 아니면(taint) 파스텔 배경으로 자동 폴백.
// 인스타 스토리 9:16(1080×1920) — 디자인 A(미니멀 풀프레임). 주인공 = 갤러리 #1(일러스트 A1 있으면 그것).
// 블러 커버 배경 + 일러스트 통째(가로폭 맞춤) + 위 여행감성 카피 + 아래 슬쩍 브랜드(위치·핸들만, 직접홍보 X).
function saveStoryCard() {
  if (DEMO) { demoNotice(); return; }          // 홍보용(쇼잉): 저장 차단 — 안내만
  if (!state.images.length) return;
  const hero = state.images[0];                // #1 = 일러스트(끝번호 001) 우선, 없으면 첫 컷
  const tp = ["edited", "dk", "letter"].find((k) => hero.variants[k] && hero.variants[k].url) || firstAvailableVariant(hero);
  const src = hero.variants[tp] ? driveCorsUrl(hero.variants[tp].url, 1280) : "";   // CORS 허용 URL(아니면 캔버스 taint→빈카드)
  const W = 1080, H = 1920;
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const cx = cv.getContext("2d");
  const SC = ({
    ko: { title: "제주, 우리의 어느 완벽한 하루", sub: "a perfect day in Jeju" },
    en: { title: "A perfect day in Jeju", sub: "the day we'll remember" },
    zh: { title: "济州，我们完美的一天", sub: "a perfect day in Jeju" },
  })[currentLang] || { title: "제주, 우리의 어느 완벽한 하루", sub: "a perfect day in Jeju" };
  function fitFont(weight, family, text, maxW, start) {
    let s = start; cx.font = `${weight} ${s}px ${family}`;
    while (s > 26 && cx.measureText(text).width > maxW) { s -= 2; cx.font = `${weight} ${s}px ${family}`; }
    return s;
  }
  function paintText() {
    cx.textAlign = "center";
    cx.shadowColor = "rgba(0,0,0,0.55)"; cx.shadowBlur = 16; cx.shadowOffsetY = 1;
    cx.fillStyle = "#fff";
    const ts = fitFont("700", "'Fraunces','Noto Serif KR',serif", SC.title, W - 130, 64);
    cx.font = `700 ${ts}px 'Fraunces','Noto Serif KR',serif`; cx.fillText(SC.title, W / 2, 146);
    cx.font = "500 50px 'Caveat',cursive"; cx.fillStyle = "rgba(255,255,255,0.92)"; cx.fillText(SC.sub, W / 2, 210);
    // 하단 2줄: 제주 추억 화보 / DKsequence X 중문별장
    cx.font = "500 40px Inter,'Noto Sans KR',sans-serif"; cx.fillStyle = "rgba(255,255,255,0.9)"; cx.fillText("제주 추억 화보", W / 2, H - 128);
    cx.font = "700 46px Inter,'Noto Sans KR',sans-serif"; cx.fillStyle = "#fff"; cx.fillText("DKsequence X 중문별장", W / 2, H - 70);
    cx.shadowBlur = 0; cx.shadowOffsetY = 0;
  }
  function paintBgFallback() { const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#cdb8e8"); g.addColorStop(0.5, "#f0c6d8"); g.addColorStop(1, "#f5e6c8"); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
  function done() { try { cv.toBlob((b) => { if (b) downloadBlob(b, "dk-story.png"); }, "image/png"); } catch (e) {} }

  const im = new Image(); im.crossOrigin = "anonymous";
  im.onload = () => {
    const rc = Math.max(W / im.width, H / im.height);            // 1) 블러 커버 배경(어둡게)
    cx.filter = "blur(34px)";
    cx.drawImage(im, (W - im.width * rc) / 2, (H - im.height * rc) / 2, im.width * rc, im.height * rc);
    cx.filter = "none";
    cx.fillStyle = "rgba(0,0,0,0.45)"; cx.fillRect(0, 0, W, H);
    // 2) 일러스트: 상단 카피(아래)와 하단 2줄(위) 사이 밴드에 맞춰 배치 — 글씨와 안 겹치게
    const bandTop = 280, bandH = H - 180 - bandTop;
    const r = Math.min(1000 / im.width, bandH / im.height), fw = im.width * r, fh = im.height * r;
    cx.drawImage(im, (W - fw) / 2, bandTop + (bandH - fh) / 2, fw, fh);
    paintText(); done();
  };
  im.onerror = () => { paintBgFallback(); paintText(); done(); };   // CORS 실패 → 파스텔 배경 폴백
  if (src) im.src = src; else { paintBgFallback(); paintText(); done(); }
}
function shareGallery() {                  // 모바일=네이티브 공유시트, 데스크톱=링크복사+토스트(무반응 방지)
  const url = location.href.replace(/([?&])preview=1\b&?/, "$1").replace(/[?&]$/, "");
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  if (isMobile && navigator.share) {
    navigator.share({ title: document.title, url }).catch((err) => { if (!err || err.name !== "AbortError") copyGalleryLink(url); });
  } else {
    copyGalleryLink(url);                   // 데스크톱(작업자/PC고객): 네이티브 공유 대신 확실히 복사
  }
}
function copyGalleryLink(url) {
  const done = () => toast(currentLang === "en" ? "Link copied!" : "갤러리 링크가 복사되었어요 :)");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done).catch(() => prompt("링크", url));
  else prompt("링크", url);
}

// ── 슬라이드쇼 양옆 손그림 라인 스케치(고급스럽게). currentColor=테마색 ──
const SS_SKETCH = {
  palm: '<svg viewBox="0 0 100 130" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M50 52 C49 74 48 100 45 126"/><path d="M50 52 C38 40 22 37 9 44"/><path d="M50 52 C45 35 46 18 53 5"/><path d="M50 52 C62 40 78 37 91 44"/><path d="M50 52 C39 45 24 47 13 58"/><path d="M50 52 C61 45 76 47 87 58"/><path d="M45 74q4 2 7 0M44 92q4 2 8 0M43 110q5 2 8 0"/></svg>',
  citrus: '<svg viewBox="0 0 100 115" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="64" r="33"/><path d="M50 31 C57 21 70 18 80 22 C77 32 66 35 56 32"/><path d="M62 24 C64 20 67 16 71 14"/><path d="M31 54 q7 -7 16 -5"/></svg>',
  star: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M50 8 C52 38 62 48 92 50 C62 52 52 62 50 92 C48 62 38 52 8 50 C38 48 48 38 50 8Z"/></svg>',
  sprig: '<svg viewBox="0 0 60 110" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M30 106 C30 78 30 42 31 8"/><path d="M30 76 C17 70 11 58 12 45 C25 47 31 58 30 70"/><path d="M31 60 C44 54 50 42 49 29 C36 31 30 42 31 54"/><path d="M30 42 C20 36 16 27 17 16 C27 18 31 27 30 36"/></svg>',
  twinkle: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 5V15M20 25V35M5 20H15M25 20H35"/></svg>',
  cloud: '<svg viewBox="0 0 120 78" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M30 64 C13 64 8 46 23 42 C22 27 44 22 52 34 C58 21 82 23 84 40 C100 39 105 62 88 64Z"/></svg>',
  sun: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="19"/><path d="M50 6V20M50 80V94M6 50H20M80 50H94M20 20l9 9M71 71l9 9M80 20l-9 9M29 71l-9 9"/></svg>',
  wave: '<svg viewBox="0 0 120 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 16q12-12 24 0t24 0t24 0t24 0"/><path d="M6 34q12-12 24 0t24 0t24 0t24 0"/></svg>',
  leaf: '<svg viewBox="0 0 70 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M35 96 C8 70 8 26 35 4 C62 26 62 70 35 96Z"/><path d="M35 16V88"/><path d="M35 32q12 4 18 14M35 50q-12 4 -18 16M35 60q12 4 18 16"/></svg>',
  shell: '<svg viewBox="0 0 100 96" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M50 90 C18 90 6 56 22 30 C30 16 46 10 50 10 C54 10 70 16 78 30 C94 56 82 90 50 90Z"/><path d="M50 90V12M34 86 C30 56 38 30 48 12M66 86 C70 56 62 30 52 12"/></svg>',
  bloom: '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="50" cy="50" r="9"/><path d="M50 41 C50 22 42 14 50 4 C58 14 50 22 50 41M59 50 C78 50 86 42 96 50 C86 58 78 50 59 50M50 59 C50 78 58 86 50 96 C42 86 50 78 50 59M41 50 C22 50 14 58 4 50 C14 42 22 50 41 50"/></svg>',
};
function ssDecor() {
  const D = [
    // 왼쪽 거터 — 빼곡히(그림처럼)
    ["citrus", "left:7%;top:5%", 54], ["twinkle", "left:19%;top:12%", 24], ["star", "left:3%;top:18%", 40],
    ["leaf", "left:13%;top:25%", 50], ["sprig", "left:4%;top:37%", 62], ["cloud", "left:15%;top:45%", 56],
    ["bloom", "left:6%;top:55%", 46], ["wave", "left:14%;top:64%", 56], ["sun", "left:7%;top:74%", 44],
    ["palm", "left:3%;bottom:11%", 86], ["shell", "left:17%;bottom:7%", 48], ["star", "left:19%;top:33%", 28], ["twinkle", "left:11%;bottom:24%", 22],
    // 오른쪽 거터
    ["citrus", "right:7%;top:6%", 52], ["star", "right:17%;top:13%", 34], ["sun", "right:4%;top:20%", 46],
    ["sprig", "right:13%;top:29%", 60], ["bloom", "right:5%;top:41%", 44], ["leaf", "right:16%;top:50%", 48],
    ["cloud", "right:6%;top:60%", 56], ["twinkle", "right:18%;top:68%", 24], ["wave", "right:14%;top:77%", 56],
    ["palm", "right:3%;bottom:11%", 86], ["shell", "right:8%;bottom:6%", 46], ["star", "right:19%;bottom:25%", 28], ["twinkle", "right:11%;top:19%", 22],
  ];
  return '<div class="ss-decor" aria-hidden="true">' + D.map(([k, pos, s], i) =>
    `<span class="ss-d" style="${pos};width:${s}px;animation-delay:${(i * 0.32).toFixed(2)}s">${SS_SKETCH[k]}</span>`).join("") + "</div>";
}

// ── 첫 칸 자동 슬라이드쇼(켄번즈 크로스페이드). 사진 2장 이상일 때만 ──
function createSlideshow() {
  clearInterval(ssTimer); clearInterval(ssCapTimer);
  const wrap = document.createElement("div");
  wrap.className = "gallery-item slideshow";
  const imgs = state.images.slice(0, 15);
  const slidesHtml = imgs.map((im, i) => {
    const tp = ["edited", "dk", "letter"].find((k) => im.variants[k] && im.variants[k].url) || firstAvailableVariant(im);
    const url = thumbSize(im.variants[tp].url, 1200);
    return `<div class="ss-slide${i === 0 ? " on" : ""}" style="background-image:url('${url}')"></div>`;
  }).join("");
  const signHtml = `<img class="ss-sign" src="sign.png?v=20260525p25" alt="" aria-hidden="true">`;   // DK 서명·중문별장 인장 워터마크(우하단)
  wrap.innerHTML = ssDecor()
    + `<div class="ss-stage">${slidesHtml}${signHtml}<div class="ss-captions" aria-hidden="true"></div><div class="ss-badge">▶ SLIDESHOW</div></div>`
    + `<button class="ss-dl-btn" type="button" id="ss-dl">🎬 ${reelTxt().save}</button>`;
  const dl = wrap.querySelector("#ss-dl"); if (dl) dl.addEventListener("click", handleReelDownload);
  const slides = wrap.querySelectorAll(".ss-slide");
  let idx = 0;
  if (slides.length > 1) {
    ssTimer = setInterval(() => {
      slides[idx].classList.remove("on");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("on");
    }, 4000);
  }
  startSsCaptions(wrap.querySelector(".ss-captions"));
  return wrap;
}

// 슬라이드쇼 동영상 저장: 홍보=차단안내 / 실서비스=릴스 mp4(준비되면 state.reelUrl) 다운로드, 아직이면 안내
function handleReelDownload() {
  if (DEMO) { demoNotice(); return; }
  if (state.reelUrl) { triggerDownload(state.reelUrl); return; }
  toast(reelTxt().soon);
}

// 슬라이드쇼 거터에 감성 문구가 랜덤하게 떴다 사라짐(다른 곳 작은 문구 재활용)
function startSsCaptions(box) {
  if (!box) return;
  const caps = (t().captions || []).slice();
  if (!caps.length) return;
  let i = Math.floor(Math.random() * caps.length);
  function pop() {
    const el = document.createElement("span");
    el.className = "ss-caption";              // 위치=CSS(카드 왼쪽 하단). 순서대로 떴다 사라짐.
    el.textContent = caps[i % caps.length]; i++;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => { try { el.remove(); } catch (e) {} }, 900); }, 2600);
  }
  pop();
  ssCapTimer = setInterval(pop, 3000);
}

function thumbSize(url, w) { return url ? url.replace(/([?&]sz=)w\d+/, "$1w" + w) : url; }
// 스토리카드(캔버스)용: drive thumbnail?id= → lh3 CDN(=wNNN, CORS 허용). id 없으면 원본 유지.
function driveCorsUrl(url, w) { const m = String(url || "").match(/[?&]id=([^&]+)/); return m ? ("https://lh3.googleusercontent.com/d/" + m[1] + "=w" + w) : (url || ""); }

// ── 제주 스크랩북 테마: body 클래스 + 매거진 커버 요소(스크립트/발행호/스티커/소인) 주입 ──
// 블링 글로시 아이콘(SVG). uid로 그라데이션 id 충돌 방지.
const JEJU_ICON = {
  tangerine: (u) => `<svg viewBox="0 0 100 100"><defs><radialGradient id="t${u}" cx="38%" cy="30%" r="78%"><stop offset="0%" stop-color="#ffdb8e"/><stop offset="44%" stop-color="#ff9e2e"/><stop offset="100%" stop-color="#e76e18"/></radialGradient></defs><path d="M58 24c8-5 17-3 17-3s-2 10-11 13z" fill="#56bf5a"/><circle cx="50" cy="58" r="36" fill="url(#t${u})"/><ellipse cx="38" cy="44" rx="12" ry="7" fill="#fff" opacity="0.5"/></svg>`,
  coffee: (u) => `<svg viewBox="0 0 100 100"><defs><linearGradient id="c${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#6f4a2e"/><stop offset="100%" stop-color="#412817"/></linearGradient></defs><rect x="50" y="14" width="5" height="24" rx="2" fill="#ec6f93"/><rect x="29" y="30" width="42" height="9" rx="4" fill="#cda881"/><path d="M32 38h36l-4 46a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4z" fill="url(#c${u})"/><ellipse cx="42" cy="52" rx="4" ry="10" fill="#fff" opacity="0.16"/></svg>`,
  flower: (u) => `<svg viewBox="0 0 100 100"><defs><radialGradient id="f${u}" cx="50%" cy="38%" r="62%"><stop offset="0%" stop-color="#ffd9ea"/><stop offset="100%" stop-color="#ff77b0"/></radialGradient></defs><g fill="url(#f${u})"><ellipse cx="50" cy="26" rx="11" ry="18"/><ellipse cx="50" cy="26" rx="11" ry="18" transform="rotate(72 50 50)"/><ellipse cx="50" cy="26" rx="11" ry="18" transform="rotate(144 50 50)"/><ellipse cx="50" cy="26" rx="11" ry="18" transform="rotate(216 50 50)"/><ellipse cx="50" cy="26" rx="11" ry="18" transform="rotate(288 50 50)"/></g><circle cx="50" cy="50" r="12" fill="#ffce3d"/><ellipse cx="46" cy="46" rx="4" ry="3" fill="#fff" opacity="0.6"/></svg>`,
  palm: (u) => `<svg viewBox="0 0 100 100"><defs><linearGradient id="p${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#56cf72"/><stop offset="100%" stop-color="#2e9a4d"/></linearGradient></defs><path d="M48 42h6l3 48h-12z" fill="#a9763f"/><g fill="url(#p${u})"><ellipse cx="50" cy="30" rx="8" ry="24"/><ellipse cx="50" cy="30" rx="8" ry="24" transform="rotate(58 50 44)"/><ellipse cx="50" cy="30" rx="8" ry="24" transform="rotate(-58 50 44)"/><ellipse cx="50" cy="30" rx="8" ry="24" transform="rotate(116 50 44)"/><ellipse cx="50" cy="30" rx="8" ry="24" transform="rotate(-116 50 44)"/></g><circle cx="50" cy="44" r="5" fill="#2e9a4d"/></svg>`,
  seagull: () => `<svg viewBox="0 0 100 100"><path d="M8 58C28 34 42 36 50 52 58 36 72 34 92 58 72 48 60 50 50 62 40 50 28 48 8 58Z" fill="#ffffff" stroke="#dcdce0" stroke-width="1.4"/></svg>`,
  harubang: (u) => `<svg viewBox="0 0 100 100"><defs><linearGradient id="h${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a4a4a0"/><stop offset="100%" stop-color="#6d6d69"/></linearGradient></defs><rect x="30" y="22" width="40" height="64" rx="18" fill="url(#h${u})"/><rect x="25" y="24" width="50" height="10" rx="5" fill="#83837c"/><ellipse cx="42" cy="50" rx="4.5" ry="5.5" fill="#46463f"/><ellipse cx="58" cy="50" rx="4.5" ry="5.5" fill="#46463f"/><path d="M50 54l-5 13h10z" fill="#5b5b54"/><ellipse cx="40" cy="38" rx="7" ry="4" fill="#fff" opacity="0.25"/></svg>`,
  heart: (u) => `<svg viewBox="0 0 100 100"><defs><radialGradient id="r${u}" cx="38%" cy="30%" r="80%"><stop offset="0%" stop-color="#ff9ec4"/><stop offset="52%" stop-color="#ff4f9a"/><stop offset="100%" stop-color="#df1d6c"/></radialGradient></defs><path d="M50 86C18 60 14 36 30 26 42 18 50 30 50 34 50 30 58 18 70 26 86 36 82 60 50 86Z" fill="url(#r${u})"/><ellipse cx="38" cy="38" rx="9" ry="6" fill="#fff" opacity="0.55"/></svg>`,
  sparkle: (u) => `<svg viewBox="0 0 100 100"><defs><radialGradient id="s${u}" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff3c4"/><stop offset="55%" stop-color="#ffce45"/><stop offset="100%" stop-color="#efa31e"/></radialGradient></defs><path d="M50 6C54 36 64 46 94 50 64 54 54 64 50 94 46 64 36 54 6 50 36 46 46 36 50 6Z" fill="url(#s${u})"/></svg>`,
};
function jejuFieldFlower(c) {
  return `<svg viewBox="0 0 40 48" width="100%" height="100%"><g fill="${c}"><ellipse cx="20" cy="9" rx="4.5" ry="8"/><ellipse cx="20" cy="9" rx="4.5" ry="8" transform="rotate(72 20 18)"/><ellipse cx="20" cy="9" rx="4.5" ry="8" transform="rotate(144 20 18)"/><ellipse cx="20" cy="9" rx="4.5" ry="8" transform="rotate(216 20 18)"/><ellipse cx="20" cy="9" rx="4.5" ry="8" transform="rotate(288 20 18)"/></g><circle cx="20" cy="18" r="3.6" fill="#ffce3d"/><path d="M20 23v23" stroke="#5aa86a" stroke-width="2" stroke-linecap="round"/></svg>`;
}
function buildJejuField(bg) {
  bg.classList.add("jeju-field");
  bg.innerHTML = "";
  // 하단 = 꽃밭+구름 이미지(bg-gallery-online.png, 50% 투명)
  const photo = document.createElement("div");
  photo.className = "jeju-bg-photo";
  bg.appendChild(photo);
  // 빛나는 하트 몇 개 (꽃밭 위에 둥실)
  const hearts = [["bottom:17%;left:14%", 60], ["bottom:29%;left:57%", 40], ["bottom:10%;left:73%", 64], ["bottom:32%;left:30%", 32]];
  let hu = 200;
  hearts.forEach(([pos, s], i) => {
    const h = document.createElement("span");
    h.className = "field-heart";
    h.style.cssText = `${pos};width:${s}px;height:${s}px;animation-delay:${(i * 0.6).toFixed(1)}s`;
    h.innerHTML = JEJU_ICON.heart(hu++);
    bg.appendChild(h);
  });
  bg.classList.add("loaded");
}

// 제주 배경에 '사진 한 줄'(가로 1줄, 연하게 20%) — 꽃밭 위에 은은한 띠
function buildJejuPhotoRow(bg) {
  const row = document.createElement("div");
  row.className = "jeju-photo-row";
  const track = document.createElement("div");
  track.className = "jeju-photo-track";
  const n = Math.min(state.images.length, 12);
  const cells = [];
  for (let i = 0; i < n; i++) {
    const img = state.images[i];
    const tp = ["edited", "dk", "letter"].find((k) => img.variants[k] && img.variants[k].url) || firstAvailableVariant(img);
    const v = img.variants[tp];
    if (!v || !v.url) continue;
    const cell = document.createElement("div");
    cell.className = "jeju-photo-cell";
    cell.style.backgroundImage = `url("${thumbSize(v.url, 600)}")`;
    track.appendChild(cell);
    cells.push(cell);
  }
  cells.forEach((c) => track.appendChild(c.cloneNode(true)));   // 무한 루프용 복제(좌→우 슬라이드)
  row.appendChild(track);
  bg.appendChild(row);
}

function setupJejuTheme() {
  if (THEME !== "jeju") return;
  document.body.classList.add("theme-jeju");
  const hero = document.querySelector(".gallery-hero");
  const inner = hero && hero.querySelector(".hero-inner");
  const bg = document.getElementById("hero-bg");
  if (bg) buildJejuField(bg);                    // 타일 → 몽환 꽃밭 배경
  if (hero && inner) {
    // 타이틀 = 봉투에서 나온 편지 (hero-inner = 편지지)
    inner.classList.add("letter");
    const env = document.createElement("div");
    env.className = "jeju-envelope";
    inner.parentNode.insertBefore(env, inner);
    env.appendChild(inner);
    const pocket = document.createElement("div");      // 봉투 앞주머니 — 중앙에 중문별장 로고
    pocket.className = "env-pocket";
    pocket.innerHTML = '<img class="env-mark" src="dk-logo.png?v=20260525p12" alt="중문별장">';
    env.appendChild(pocket);
    const label = document.createElement("p");
    label.className = "letter-label";
    label.textContent = "A NOTE FROM JEJU";            // applyLang가 언어별로 갱신
    inner.insertBefore(label, inner.firstChild);
    // 편지 하단 = DKsequence 서명만
    const foot = document.createElement("div");
    foot.className = "letter-foot";
    foot.innerHTML = '<span class="letter-name">DKsequence</span>';
    inner.appendChild(foot);
    // 만료 안내 = 편지봉투 '아래'로 이동(applyLang가 #expiry-note 갱신)
    const expEl = inner.querySelector("#expiry-note");
    if (expEl) { expEl.classList.add("jeju-expiry"); env.insertAdjacentElement("afterend", expEl); }
  }
  if (hero) {
    const layer = document.createElement("div");
    layer.className = "jeju-stickers";
    // 완전 랜덤 배치 + 크고 느린 드리프트(천천히 넓게 떠다님 — 잠깐 글을 가려도 곧 벗어남).
    // 귤·야자수·갈매기 비중을 높인 풀.
    const POOL = ["tangerine", "tangerine", "tangerine", "palm", "palm", "palm",
                  "seagull", "seagull", "seagull", "heart", "heart", "sparkle", "sparkle",
                  "coffee", "harubang", "flower"];
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
    let uid = 0;
    for (let i = 0; i < 18; i++) {
      const name = pickOf(POOL);
      const size = (name === "sparkle") ? rnd(22, 34) : rnd(40, 68);
      const dx = (Math.random() < 0.5 ? -1 : 1) * rnd(45, 115);   // 큰 드리프트 범위
      const dy = (Math.random() < 0.5 ? -1 : 1) * rnd(40, 100);
      const d = document.createElement("span");
      d.className = "jeju-sticker bling";
      d.style.cssText = `top:${rnd(2, 88).toFixed(1)}%;left:${rnd(1, 92).toFixed(1)}%;`
        + `width:${size.toFixed(0)}px;height:${size.toFixed(0)}px;`
        + `--dx:${dx.toFixed(0)}px;--dy:${dy.toFixed(0)}px;--r0:${rnd(-10, 10).toFixed(0)}deg;--r1:${rnd(-18, 18).toFixed(0)}deg;`
        + `animation-duration:${rnd(9, 18).toFixed(1)}s;animation-delay:${(-rnd(0, 12)).toFixed(1)}s`;
      d.innerHTML = JEJU_ICON[name](++uid);
      layer.appendChild(d);
    }
    const stamp = document.createElement("div");
    stamp.className = "jeju-stamp";
    stamp.innerHTML = "<span>MEMORIES OF JEJU</span><b>2026</b><span>DKSEQUENCE</span>";
    layer.appendChild(stamp);
    hero.appendChild(layer);
  }
}

// ── 꽃잎 살랑살랑(전면, 살짝). 20가지 꽃 모양(SVG). 클릭 방해 없음. 모션 줄임 설정이면 생략 ──
// 파라메트릭 꽃잎 path: w=벌어짐, tipW=끝 뭉툭함, tipY=끝 높이, notch>0=끝 갈라짐(벚꽃·코스모스)
function petalPath(w, tipW, tipY, notch) {
  const b = 97;
  if (notch > 0) {
    const nW = Math.max(tipW + 6, 9);
    return `M50 ${b} C${50 + w} 70,${50 + tipW} ${tipY + 6},${50 + nW} ${tipY} `
      + `C${50 + nW * 0.35} ${tipY + notch},${50 - nW * 0.35} ${tipY + notch},${50 - nW} ${tipY} `
      + `C${50 - tipW} ${tipY + 6},${50 - w} 70,50 ${b} Z`;
  }
  return `M50 ${b} C${50 + w} 70,${50 + tipW} ${tipY},50 ${tipY} `
    + `C${50 - tipW} ${tipY},${50 - w} 70,50 ${b} Z`;
}
const PETAL_PARAMS = [   // 20종 — 통통/날렵/뾰족/노치 다양
  [38, 6, 4, 0], [34, 4, 3, 0], [44, 10, 6, 0], [30, 3, 2, 0], [46, 14, 8, 0],
  [40, 8, 5, 12], [36, 6, 4, 14], [42, 5, 3, 0], [33, 9, 6, 0], [45, 7, 5, 10],
  [37, 12, 7, 0], [31, 4, 2, 0], [43, 9, 4, 16], [39, 5, 3, 0], [35, 11, 6, 0],
  [41, 6, 4, 0], [32, 8, 5, 12], [44, 4, 2, 0], [38, 13, 7, 0], [36, 7, 4, 9],
];
const PETAL_COLORS = ["#ffd4e0", "#ffe2cf", "#f3ddae", "#ead9f0", "#ffffff", "#ffd9e8", "#fff0d9", "#e7e0f2", "#ffe9b8", "#f7d2da"];

function setupPetals() {
  const wrap = $("petals");
  if (!wrap) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const SWAYS = ["", "sway2"];
  const pickOf = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  // 20종을 셔플해 한 개씩 — 화면에 20가지가 모두 보이도록
  const order = PETAL_PARAMS.map((_, i) => i).sort(() => Math.random() - 0.5);
  order.forEach((sIdx) => {
    const fall = document.createElement("div");      // 수직 낙하 담당
    fall.className = "petal-fall";
    fall.style.left = rnd(0, 100).toFixed(2) + "%";
    fall.style.animationDuration = rnd(10, 19).toFixed(1) + "s";
    fall.style.animationDelay = (-rnd(0, 19)).toFixed(1) + "s";   // 음수 지연 → 처음부터 흩뿌려진 상태
    const s = rnd(9, 28);                            // 크기 폭 넓게(랜덤)
    const h = s * rnd(1.05, 1.5);                    // 가로세로 비율도 다양
    const d = petalPath.apply(null, PETAL_PARAMS[sIdx]);
    fall.innerHTML = `<svg class="petal ${pickOf(SWAYS)}" viewBox="0 0 100 100" `
      + `style="width:${s.toFixed(1)}px;height:${h.toFixed(1)}px;opacity:${rnd(0.16, 0.42).toFixed(2)};`
      + `animation-duration:${rnd(2.6, 7).toFixed(1)}s"><path d="${d}" fill="${pickOf(PETAL_COLORS)}"/></svg>`;
    wrap.appendChild(fall);
  });
}

// ── 히어로 커버 = 사용된 사진들의 타일 모자이크(콜라주). 단일 인물 얼굴 잘림 방지 + 다양성 노출 ──
function setHero() {
  const bg = $("hero-bg");
  if (!bg) return;
  if (THEME === "jeju") { if (state.images.length) buildJejuPhotoRow(bg); return; }   // 제주 = 꽃밭 + 사진 한 줄(연하게)
  if (!state.images.length) return;
  bg.innerHTML = "";
  const pick = (img) => {
    const tp = ["edited", "dk", "letter"].find((k) => img.variants[k] && img.variants[k].url) || firstAvailableVariant(img);
    return img.variants[tp];
  };
  const TILES = THEME === "jeju" ? 40 : 30;          // 그리드보다 넉넉히 — 넘치는 타일은 overflow로 클립
  for (let i = 0; i < TILES; i++) {
    const img = state.images[i % state.images.length];
    const v = pick(img);
    if (!v || !v.url) continue;
    const tile = document.createElement("div");
    tile.className = "hero-tile";
    tile.style.backgroundImage = `url("${thumbSize(v.url, 500)}")`;
    if (THEME === "jeju") {                           // 흩뿌린 스크랩 느낌 — 살짝 회전 + 크기 랜덤
      const rot = (Math.random() * 6 - 3).toFixed(1);
      const sc = (0.84 + Math.random() * 0.16).toFixed(2);
      tile.style.transform = `rotate(${rot}deg) scale(${sc})`;
    }
    bg.appendChild(tile);
  }
  requestAnimationFrame(() => bg.classList.add("loaded"));
}

// ── 라이트박스: 사진 클릭 시 큰 화면으로 감상(현재 선택된 변형 기준). 좌우 이동·ESC·배경 클릭 닫기 ──
let lbIndex = -1;
function setupLightbox() {
  $("lb-close") && $("lb-close").addEventListener("click", closeLightbox);
  $("lb-prev") && $("lb-prev").addEventListener("click", (e) => { e.stopPropagation(); lbNav(-1); });
  $("lb-next") && $("lb-next").addEventListener("click", (e) => { e.stopPropagation(); lbNav(1); });
  const lb = $("lightbox");
  if (lb) lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); }); // 배경 클릭 닫기
  document.addEventListener("keydown", (e) => {
    if (lbIndex < 0) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") lbNav(-1);
    else if (e.key === "ArrowRight") lbNav(1);
  });
}
function openLightbox(imageId) {
  const idx = state.images.findIndex((im) => im.id === imageId);
  if (idx < 0) return;
  lbIndex = idx;
  renderLightbox();
  const lb = $("lightbox");
  if (lb) { lb.classList.add("show"); lb.setAttribute("aria-hidden", "false"); }
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  const lb = $("lightbox");
  if (lb) { lb.classList.remove("show"); lb.setAttribute("aria-hidden", "true"); }
  document.body.style.overflow = "";
  lbIndex = -1;
}
function lbNav(d) {
  if (lbIndex < 0 || !state.images.length) return;
  lbIndex = (lbIndex + d + state.images.length) % state.images.length;
  renderLightbox();
}
function renderLightbox() {
  const image = state.images[lbIndex];
  const img = $("lightbox-img");
  if (!image || !img) return;
  const type = currentVariant[image.id] || firstAvailableVariant(image);
  const v = image.variants[type];
  if (v) { img.classList.remove("ready"); img.src = thumbSize(v.url, 2000); img.onload = () => img.classList.add("ready"); }
}

// 숨김 iframe 다운로드 — https 페이지 컨텍스트 유지(새 탭/about:blank 안 띄움).
// 이전 target="_blank" 방식은 about:blank 새 탭에서 받아 ①팝업차단 ②"보안연결 다운로드 불가" 경고를 유발했음.
function triggerDownload(url) {
  if (!url) return;
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = url;
  document.body.appendChild(iframe);
  setTimeout(() => { try { iframe.remove(); } catch (e) {} }, 90000);
}

