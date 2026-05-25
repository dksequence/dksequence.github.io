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

const I18N = {
  ko: {
    titleSuffix: "님 화보 Gallery", titleGeneric: "화보 Gallery",
    subtitle: "오늘의 소중한 순간을 천천히 감상하고 자유롭게 내려받아 주세요.",
    downloadAll: "전체 사진 다운로드",
    wifi: "⚠ 용량이 크니 와이파이 환경에서 다운로드를 권장드립니다.",
    expiry: (d) => `이 갤러리는 ${d} 자동 만료되오니 그 전에 받아주세요 :D`,
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
    variants: { letter: "Letter", dk: "DK", edited: "원본" },
    loading: "갤러리를 불러오는 중입니다...", notFound: "갤러리를 찾을 수 없습니다.",
    expired: "열람 기간이 만료되었습니다.", invalid: "잘못된 접근입니다.", empty: "아직 사진이 없습니다.",
    fmtDate: (y, m, d) => `${y}년 ${m}월 ${d}일`,
  },
  en: {
    titleSuffix: "'s Photo Gallery", titleGeneric: "Photo Gallery",
    subtitle: "Feel free to enjoy and download today's precious moments.",
    downloadAll: "Download All",
    wifi: "⚠ Files are large — downloading on Wi-Fi is recommended.",
    expiry: (d) => `This gallery expires on ${d}. Please download before then :D`,
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
    variants: { letter: "Letter", dk: "DK", edited: "Original" },
    loading: "Loading gallery...", notFound: "Gallery not found.",
    expired: "This gallery has expired.", invalid: "Invalid access.", empty: "No photos yet.",
    fmtDate: (y, m, d) => new Date(y, m - 1, d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
  },
  zh: {
    titleSuffix: " 的写真 Gallery", titleGeneric: "写真 Gallery",
    subtitle: "请慢慢欣赏并自由下载今天珍贵的瞬间。",
    downloadAll: "全部下载",
    wifi: "⚠ 文件较大，建议在 Wi-Fi 环境下下载。",
    expiry: (d) => `本图库将于 ${d} 自动过期，请在此之前下载 :D`,
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
let bgmTried = [];

const state = { images: [], customerName: "", expY: 0, expM: 0, expD: 0, loaded: false };
const currentVariant = {};
const captionIdx = {}; // 사진별 감성문구 인덱스 고정 — 언어 전환 시 같은 문구의 번역본이 보이도록
const defaultVariant = {}; // 사진별 기본 변형(letter/WM 랜덤) 고정 — 재렌더(언어 전환) 때 안 바뀌도록
const $ = (id) => document.getElementById(id);
const t = () => I18N[currentLang];

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".lang-btn").forEach((b) => b.addEventListener("click", () => applyLang(b.dataset.lang)));
  setupBgm();
  applyLang(currentLang); // 정적 텍스트·버튼 즉시 반영
  loadGallery();
});

async function loadGallery() {
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
    parseExpire(data.expire_date || "");
    state.loaded = true;
    applyLang(currentLang);
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
  setText("subtitle", tt.subtitle);
  const titleEl = $("gallery-title");
  if (titleEl) titleEl.textContent = state.customerName ? state.customerName + tt.titleSuffix : tt.titleGeneric;
  const expEl = $("expiry-note");
  if (expEl && state.expY) expEl.textContent = tt.expiry(tt.fmtDate(state.expY, state.expM, state.expD));
  if (state.loaded) renderItems();
}

function setText(id, txt) { const el = $(id); if (el) el.textContent = txt; }

function setupBgm() {
  const audio = $("bgm");
  const confirmBtn = $("intro-confirm");
  const toggle = $("bgm-toggle");
  if (audio) {
    audio.volume = 0.5;
    audio.addEventListener("error", () => { if (bgmStarted && !bgmMuted) pickAndPlayBgm(); }); // 없는 번호면 다른 곡으로
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

function startBgm() { bgmTried = []; pickAndPlayBgm(); } // 접속 1회당 랜덤 1곡

function pickAndPlayBgm() {
  const audio = $("bgm");
  if (!audio) return;
  const pool = [];
  for (let i = 1; i <= BGM_MAX; i++) if (!bgmTried.includes(i)) pool.push(i);
  if (!pool.length) return; // 재생 가능한 음원 없음
  const n = pool[Math.floor(Math.random() * pool.length)];
  bgmTried.push(n);
  audio.src = "audio/" + n + ".mp3";
  audio.play().catch(() => {}); // play 정책 차단 등은 조용히 무시
}

function renderItems() {
  const container = $("gallery");
  container.innerHTML = "";
  if (!state.images.length) { showMessage(t().empty); return; }
  window.galleryData = Object.fromEntries(state.images.map((img) => [img.id, img]));
  state.images.forEach((image) => container.appendChild(createGalleryItem(image)));
}

function pickDefaultVariant(image) {
  const hasLetter = image.variants.letter && image.variants.letter.url;
  const hasDk = image.variants.dk && image.variants.dk.url;
  if (hasLetter && hasDk) return Math.random() < 0.5 ? "letter" : "dk"; // letter·WM 균등 랜덤
  if (hasLetter) return "letter";
  if (hasDk) return "dk";
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
  item.innerHTML = `
    <div class="image-frame"><img id="img-${image.id}" src="${defUrl}" alt="${image.id}" loading="lazy"></div>
    <div class="item-overlay">
      <div class="overlay-copy"><span>${cap}</span></div>
      <div class="overlay-actions">
        <div class="variant-buttons" id="variants-${image.id}">${buttons}</div>
        <button class="download-icon-btn" type="button" onclick="downloadCurrent('${image.id}')"><span>${tt.download}</span></button>
      </div>
    </div>`;
  item.querySelectorAll(".variant-btn").forEach((b) => b.addEventListener("click", () => switchVariant(image.id, b.dataset.type)));
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
  const image = window.galleryData[imageId];
  if (!image) return;
  const type = currentVariant[imageId] || firstAvailableVariant(image);
  const v = image.variants[type];
  if (v && v.download) triggerDownload(v.download);
};

function thumbSize(url, w) { return url ? url.replace(/([?&]sz=)w\d+/, "$1w" + w) : url; }

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

