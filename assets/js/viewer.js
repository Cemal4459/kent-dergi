// ================= DEBUG =================
(function(){
  const d = document.createElement("div");
  d.style.cssText =
    "position:fixed;left:10px;bottom:10px;z-index:99999;background:#111;padding:8px 10px;border:1px solid #444;border-radius:10px;color:#fff;font:12px/1.2 Inter,system-ui;opacity:.9";
  d.textContent = "viewer.js LOADED ✅";
  document.body.appendChild(d);
})();

// ================= PDF.js =================
if (typeof pdfjsLib === "undefined") {
  alert("PDF.js yüklenemedi (pdf.min.js)");
}

pdfjsLib.GlobalWorkerOptions.workerSrc =
  new URL("assets/vendor/pdfjs/pdf.worker.min.js", window.location.href).toString();

// iOS + GitHub Pages uyumu
pdfjsLib.disableWorker = true;

const PDF_URL = new URL(
  "assets/pdf/tekir-sayi-1.pdf",
  window.location.href
).toString();

// ================= STATE =================
let pdfDoc = null;
let pageNum = 1;
let scale = 1.25;
let savedScale = null;
let rendering = false;

// ================= ELEMENTS =================
const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");
const canvasWrap = document.querySelector(".canvas-wrap");

const pageInput = document.getElementById("pageInput");
const pageCountEl = document.getElementById("pageCount");

const fsBtn = document.getElementById("fsBtn");
const fsPrev = document.getElementById("fsPrev");
const fsNext = document.getElementById("fsNext");

const goBtn = document.getElementById("goBtn");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResult = document.getElementById("searchResult");

const thumbList = document.getElementById("thumbList");

// ================= CORE =================
function clampPage(n){
  return Math.max(1, Math.min(n, pdfDoc.numPages));
}

async function renderPage(num){
  if (!pdfDoc || rendering) return;
  rendering = true;

  // 🔄 LOADING OVERLAY
  const loading = document.createElement("div");
  loading.className = "pdf-loading";
  loading.innerHTML = `<div class="spinner"></div>`;
  canvasWrap.appendChild(loading);

  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  // ✅ LOADING KALKAR
  loading.remove();

  pageNum = num;
  pageInput.value = num;
  rendering = false;
}

// ===== FIT TO SCREEN (ASIL OLAY) =====
function fitToScreen(num = pageNum){
  if (!pdfDoc || !canvasWrap) return;

  const rect = canvasWrap.getBoundingClientRect();

  pdfDoc.getPage(num).then(page => {
    const base = page.getViewport({ scale: 1 });
    const sx = (rect.width - 24) / base.width;
    const sy = (rect.height - 24) / base.height;

    scale = Math.max(0.6, Math.min(2.2, Math.min(sx, sy)));
    renderPage(num);
  });
}

// ================= INIT =================
async function init(){
  pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;

  pageCountEl.textContent = `/ ${pdfDoc.numPages}`;
  pageInput.max = pdfDoc.numPages;

  buildThumbs();
  renderPage(1);
}

// ================= THUMBS =================
function buildThumbs(){
  thumbList.innerHTML = "";
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const el = document.createElement("div");
    el.className = "thumb";
    el.innerHTML = `<div class="n">${i}</div><div class="t">Sayfa ${i}</div>`;
    el.addEventListener("click", () => renderPage(i));
    thumbList.appendChild(el);
  }
}

// ================= EVENTS =================
goBtn.onclick = () => renderPage(clampPage(+pageInput.value || 1));

zoomIn.onclick = () => {
  scale = Math.min(2.2, scale + 0.15);
  renderPage(pageNum);
};

zoomOut.onclick = () => {
  scale = Math.max(0.85, scale - 0.15);
  renderPage(pageNum);
};

fsPrev.onclick = () => renderPage(clampPage(pageNum - 1));
fsNext.onclick = () => renderPage(clampPage(pageNum + 1));

// ===== FULLSCREEN (TEK ve TEMİZ) =====
fsBtn.onclick = async () => {
  if (!canvasWrap) return;

  // AÇ
  if (!document.fullscreenElement) {
    savedScale = scale;
    document.body.classList.add("fullscreen-ui");

    try {
      await canvasWrap.requestFullscreen();
    } catch {
      // iOS / destek yok
      canvasWrap.classList.add("is-fullscreen");
    }

    canvasWrap.classList.add("is-fullscreen");

    // ⬅️ PC’de tam sığdıran kritik satır
    setTimeout(() => fitToScreen(pageNum), 120);
    return;
  }

  // KAPAT
  await document.exitFullscreen();
  canvasWrap.classList.remove("is-fullscreen");
  document.body.classList.remove("fullscreen-ui");

  if (savedScale !== null) {
    scale = savedScale;
    savedScale = null;
    renderPage(pageNum);
  }
};

// Pencere boyutu değişirse tekrar sığdır
window.addEventListener("resize", () => {
  if (canvasWrap.classList.contains("is-fullscreen")) {
    fitToScreen(pageNum);
  }
});

// ================= SEARCH =================
searchBtn.onclick = async () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) return;

  const hits = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const txt = (await page.getTextContent()).items.map(i => i.str).join(" ").toLowerCase();
    if (txt.includes(q)) hits.push(i);
  }

  searchResult.innerHTML = hits.length
    ? hits.map(p => `<button class="linklike" onclick="renderPage(${p})">${p}</button>`).join(" ")
    : "Bulunamadı";
};

// ================= START =================
init();

// PC'de Ctrl + Mouse Wheel ile tarayıcı zoomunu engelle
window.addEventListener(
  "wheel",
  (e) => {
    if (e.ctrlKey) e.preventDefault();
  },
  { passive: false }
);
window.addEventListener("resize", () => {
  if (canvasWrap?.classList.contains("is-fullscreen")) {
    fitToScreen(pageNum);
  }
});
// ================= SWIPE (Touch + Mouse) =================
let startX = 0;
let isDown = false;

const SWIPE_THRESHOLD = 60; // px

canvasWrap.addEventListener("touchstart", e => {
  startX = e.touches[0].clientX;
}, { passive: true });

canvasWrap.addEventListener("touchend", e => {
  const endX = e.changedTouches[0].clientX;
  const diff = endX - startX;

  if (Math.abs(diff) > SWIPE_THRESHOLD) {
    if (diff > 0) {
      renderPage(clampPage(pageNum - 1)); // sağa → önceki
    } else {
      renderPage(clampPage(pageNum + 1)); // sola → sonraki
    }
  }
});

// PC mouse desteği
canvasWrap.addEventListener("mousedown", e => {
  isDown = true;
  startX = e.clientX;
});

window.addEventListener("mouseup", e => {
  if (!isDown) return;
  isDown = false;

  const diff = e.clientX - startX;
  if (Math.abs(diff) > SWIPE_THRESHOLD) {
    if (diff > 0) {
      renderPage(clampPage(pageNum - 1));
    } else {
      renderPage(clampPage(pageNum + 1));
    }
  }
});

