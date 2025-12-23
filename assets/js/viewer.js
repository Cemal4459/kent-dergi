// DEBUG: Script çalışıyor mu?
(function(){
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:99999;background:#111;padding:8px 10px;border:1px solid #444;border-radius:10px;color:#fff;font:12px/1.2 Inter,system-ui;opacity:.9";
  d.id = "dbg";
  d.textContent = "viewer.js LOADED ✅";
  document.body.appendChild(d);
})();

// ===== PDF.js ayarı (Lokal + güvenli) =====

// pdf.min.js gerçekten yüklenmiş mi?
if (typeof pdfjsLib === "undefined") {
  console.error("pdfjsLib bulunamadı. dergi.html içinde pdf.min.js yolu yanlış olabilir.");
  alert("PDF sistemi yüklenemedi! (pdf.min.js bulunamadı)");
}

// Worker'ı lokalden göster (CDN yerine)
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "assets/vendor/pdfjs/pdf.worker.min.js",
    window.location.href
  ).toString();
} catch (e) {
  console.warn("Worker yolu ayarlanamadı:", e);
}

// Worker kaynaklı sorunlarda kesin açılması için fallback:
// (İstersen sorun çözülünce false yapabilirsin)
pdfjsLib.disableWorker = true;

// PDF yolu (GitHub Pages için güvenli)
const PDF_URL = new URL(
  "assets/pdf/tekir-sayi-1.pdf",
  window.location.href
).toString();

// ===== Viewer state =====
let pdfDoc = null;
let pageNum = 1;
let scale = 1.25;
let rendering = false;

const canvas = document.getElementById("pdfCanvas");
const ctx = canvas?.getContext("2d");

const pageInput = document.getElementById("pageInput");
const pageCountEl = document.getElementById("pageCount");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const goBtn = document.getElementById("goBtn");
const zoomIn = document.getElementById("zoomIn");
const zoomOut = document.getElementById("zoomOut");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const searchResult = document.getElementById("searchResult");

const thumbList = document.getElementById("thumbList");

function showErrorBox(msg) {
  const wrap = document.querySelector(".canvas-wrap");
  if (wrap) {
    wrap.innerHTML = `
      <div style="padding:16px; color:#fff;">
        <div style="font-weight:800; margin-bottom:6px;">PDF yüklenemedi</div>
        <div style="opacity:.85; font-size:.95rem;">${msg}</div>
        <div style="margin-top:10px; opacity:.7; font-size:.85rem;">
          F12 → Console hatasını bana atarsan hemen nokta atışı çözerim.
        </div>
      </div>
    `;
  }
}

async function renderPage(num) {
  if (!pdfDoc || rendering || !canvas || !ctx) return;
  rendering = true;

  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const renderContext = { canvasContext: ctx, viewport };
  await page.render(renderContext).promise;

  pageNum = num;
  if (pageInput) pageInput.value = pageNum;
  rendering = false;
}

function clampPage(n) {
  if (!pdfDoc) return 1;
  return Math.max(1, Math.min(n, pdfDoc.numPages));
}

async function buildThumbs() {
  if (!pdfDoc || !thumbList) return;

  thumbList.innerHTML = "";
  const max = pdfDoc.numPages;

  for (let i = 1; i <= max; i++) {
    const el = document.createElement("div");
    el.className = "thumb";
    el.innerHTML = `
      <div class="n">${i}</div>
      <div class="t">Sayfa ${i}</div>
    `;
    el.addEventListener("click", () => renderPage(i));
    thumbList.appendChild(el);
  }
}

async function init() {
  if (!canvas || !ctx) {
    showErrorBox("Canvas bulunamadı (#pdfCanvas). dergi.html içindeki id'leri kontrol et.");
    return;
  }

  // PDF'i yükle
  const loadingTask = pdfjsLib.getDocument({
    url: PDF_URL,
    // bazen CORS/encoding sorunlarında iş görür:
    withCredentials: false,
  });

  pdfDoc = await loadingTask.promise;

  if (pageCountEl) pageCountEl.textContent = `/ ${pdfDoc.numPages}`;
  if (pageInput) pageInput.max = pdfDoc.numPages;

  await buildThumbs();
  await renderPage(1);
}

// ===== Events =====
prevBtn?.addEventListener("click", () => renderPage(clampPage(pageNum - 1)));
nextBtn?.addEventListener("click", () => renderPage(clampPage(pageNum + 1)));

goBtn?.addEventListener("click", () => {
  const n = clampPage(parseInt(pageInput?.value || "1", 10));
  renderPage(n);
});

pageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const n = clampPage(parseInt(pageInput.value || "1", 10));
    renderPage(n);
  }
});

zoomIn?.addEventListener("click", () => {
  scale = Math.min(2.2, scale + 0.15);
  renderPage(pageNum);
});

zoomOut?.addEventListener("click", () => {
  scale = Math.max(0.85, scale - 0.15);
  renderPage(pageNum);
});

// ===== Search (basit metin arama) =====
async function searchInPdf(query) {
  if (!pdfDoc) return;

  const q = (query || "").trim().toLowerCase();
  if (!q) {
    if (searchResult) searchResult.textContent = "Aranacak kelime yaz.";
    return;
  }

  if (searchResult) searchResult.textContent = "Aranıyor…";
  const hits = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(it => it.str).join(" ").toLowerCase();
    if (text.includes(q)) hits.push(i);
  }

  if (!searchResult) return;

  if (hits.length === 0) {
    searchResult.textContent = `“${query}” bulunamadı.`;
    return;
  }

  searchResult.innerHTML = `Bulundu: ${hits
    .slice(0, 12)
    .map(p => `<button class="linklike" data-p="${p}">${p}</button>`)
    .join(" ")}${hits.length > 12 ? ` <span class="muted small">(+${hits.length - 12})</span>` : ""}`;

  searchResult.querySelectorAll("button[data-p]").forEach(btn => {
    btn.addEventListener("click", () => {
      const p = parseInt(btn.getAttribute("data-p"), 10);
      renderPage(p);
    });
  });
}

searchBtn?.addEventListener("click", () => searchInPdf(searchInput?.value));
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchInPdf(searchInput.value);
});

// ===== Init =====
init().catch(err => {
  console.error("PDF init error:", err);
  showErrorBox(
    `Hata: <span style="opacity:.9">${String(err?.message || err)}</span><br>
     <span style="opacity:.8">Kontrol: PDF_URL → ${PDF_URL}</span>`
  );
});

// küçük CSS helper (buton görünümü)
const style = document.createElement("style");
style.textContent = `
  .linklike{
    margin:0 4px 6px 0;
    padding:6px 10px;
    border-radius:999px;
    border:1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.06);
    color:#fff;
    cursor:pointer;
    font-weight:700;
  }
  .linklike:hover{
    border-color: rgba(255,255,255,.26);
    transform: translateY(-1px);
  }
`;
document.head.appendChild(style);
