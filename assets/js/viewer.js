// PDF.js ayarı
const PDF_URL = new URL("assets/pdf/tekir-sayi-1.pdf", window.location.href).toString();

const PDF_URL = new URL("assets/pdf/tekir-sayi-1.pdf", window.location.href).toString();

let pdfDoc = null;
let pageNum = 1;
let scale = 1.25;
let rendering = false;

const canvas = document.getElementById("pdfCanvas");
const ctx = canvas.getContext("2d");

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

async function renderPage(num) {
  if (!pdfDoc || rendering) return;
  rendering = true;

  const page = await pdfDoc.getPage(num);
  const viewport = page.getViewport({ scale });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const renderContext = { canvasContext: ctx, viewport };
  await page.render(renderContext).promise;

  pageNum = num;
  pageInput.value = pageNum;
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

  // Çok ağır olmasın diye sadece text tabanlı hızlı liste yapıyoruz
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
  const loadingTask = pdfjsLib.getDocument(PDF_URL);
  pdfDoc = await loadingTask.promise;

  pageCountEl.textContent = `/ ${pdfDoc.numPages}`;
  pageInput.max = pdfDoc.numPages;

  await buildThumbs();
  await renderPage(1);
}

prevBtn?.addEventListener("click", () => renderPage(clampPage(pageNum - 1)));
nextBtn?.addEventListener("click", () => renderPage(clampPage(pageNum + 1)));

goBtn?.addEventListener("click", () => {
  const n = clampPage(parseInt(pageInput.value || "1", 10));
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

// Basit arama: PDF içindeki metinlerde kelimeyi arar, eşleşen sayfaları listeler
async function searchInPdf(query) {
  if (!pdfDoc) return;
  const q = (query || "").trim().toLowerCase();
  if (!q) {
    searchResult.textContent = "Aranacak kelime yaz.";
    return;
  }

  searchResult.textContent = "Aranıyor…";
  const hits = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map(it => it.str).join(" ").toLowerCase();
    if (text.includes(q)) hits.push(i);
    // performans için çok uzun pdflerde burada break / throttle eklenebilir
  }

  if (hits.length === 0) {
    searchResult.textContent = `“${query}” bulunamadı.`;
    return;
  }

  // Sonuçları tıklanabilir yap
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

searchBtn?.addEventListener("click", () => searchInPdf(searchInput.value));
searchInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchInPdf(searchInput.value);
});

init().catch(err => {
  console.error("PDF init error:", err);

  const wrap = document.querySelector(".canvas-wrap");
  if (wrap) {
    wrap.innerHTML = `
      <div style="padding:16px; color:#fff;">
        <div style="font-weight:800; margin-bottom:6px;">PDF yüklenemedi</div>
        <div style="opacity:.8; font-size:.95rem;">
          Dosya yolu / worker / CDN hatası olabilir.
        </div>
        <div style="margin-top:10px; opacity:.7; font-size:.85rem;">
          Konsolu (F12) aç → Console’daki hatayı bana at.
        </div>
      </div>
    `;
  }
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
  .linklike:hover{border-color: rgba(255,255,255,.26); transform: translateY(-1px);}
`;
document.head.appendChild(style);
