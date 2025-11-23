/* ------------------------------
   CONFIGURATION & VARIABLES
--------------------------------*/
const PLANNING_KEY = "planning_tpl_local_v2";

const planningContainer = document.getElementById("planning");
const dateDisplay = document.getElementById("dateDisplay");

const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const pdfBtn = document.getElementById("pdfBtn");

const pdfPreviewContainer = document.getElementById("pdfPreviewContainer");
const pdfPreviewIframe = document.getElementById("pdfPreview");

let currentPlanning = null;


/* ------------------------------
   UTILS
--------------------------------*/
async function fetchServerPlanning() {
  try {
    const res = await fetch("planning.json", { cache: "no-store" });
    if (!res.ok) throw new Error("planning.json non trouvé");
    return await res.json();
  } catch (e) {
    console.warn("Erreur chargement planning.json :", e);
    return null;
  }
}

function escapeHtml(s) {
  return (s || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


/* ------------------------------
   RENDER
--------------------------------*/
function render(pl) {
  currentPlanning = pl;

  dateDisplay.textContent = pl.date || "";

  const html = pl.items.map((it, idx) => `
    <div class="row section-${it.section}" data-idx="${idx}">
      <div class="time">${escapeHtml(it.time)}</div>

      <div class="theme editable" contenteditable="true" data-field="theme">
        ${escapeHtml(it.theme)}
      </div>

      <div class="duration editable" contenteditable="true" data-field="duration">
        ${escapeHtml(it.duration)}
      </div>

      <div class="person editable" contenteditable="true" data-field="person">
        ${escapeHtml(it.person)}
      </div>
    </div>
  `).join("");

  planningContainer.innerHTML = html;

  planningContainer.querySelectorAll(".editable").forEach(el => {
    el.addEventListener("input", handleEdit);
    el.addEventListener("blur", handleEdit);
  });
}


/* ------------------------------
   EDITING
--------------------------------*/
function handleEdit(e) {
  const el = e.target;
  const row = el.closest(".row");

  if (!row) return;

  const idx = Number(row.dataset.idx);
  const field = el.dataset.field;

  currentPlanning.items[idx][field] = el.textContent.trim();

  localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));

  if (field === "duration") recalcTimes();
}

function recalcTimes() {
  const items = currentPlanning.items;

  for (let i = 1; i < items.length; i++) {
    let prev = items[i - 1];
    let cur = items[i];

    const [h, m] = prev.time.split(":").map(Number);
    const dur = Number(prev.duration) || 0;

    let total = h * 60 + m + dur;
    let nh = String(Math.floor(total / 60)).padStart(2, "0");
    let nm = String(total % 60).padStart(2, "0");

    cur.time = `${nh}:${nm}`;
  }

  render(currentPlanning);
}


/* ------------------------------
   BOUTONS
--------------------------------*/
saveBtn.addEventListener("click", () => {
  localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));
  saveBtn.textContent = "Saved ✅";
  setTimeout(() => (saveBtn.textContent = "Sauvegarder (local)"), 1500);
});

resetBtn.addEventListener("click", async () => {
  const server = await fetchServerPlanning();
  if (!server) return alert("Impossible de recharger planning.json.");
  localStorage.removeItem(PLANNING_KEY);
  render(server);
  alert("Planning réinitialisé.");
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(currentPlanning, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planning-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async (ev) => {
  const file = ev.target.files[0];
  if (!file) return;

  const text = await file.text();

  try {
    const obj = JSON.parse(text);
    if (!Array.isArray(obj.items)) throw new Error("Format invalide.");
    currentPlanning = obj;
    render(obj);
    localStorage.setItem(PLANNING_KEY, JSON.stringify(obj));
    alert("Planning importé.");
  } catch (e) {
    alert("Erreur JSON : " + e.message);
  }

  importFile.value = "";
});


/* ------------------------------
   EXPORT PDF
--------------------------------*/
function previewPDF() {
  if (!currentPlanning) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Программа встречи в будние дни", 14, 36);

  doc.setFont("Helvetica", "normal");
  doc.setFontSize(12);
  doc.text(currentPlanning.date || "", 14, 56);

  const rows = currentPlanning.items.map(i => [
    i.time, i.theme, i.duration, i.person
  ]);

  doc.autoTable({
    startY: 70,
    head: [["Время", "Тема", "Длительность", "Назначенный"]],
    body: rows,
    styles: { font: "Helvetica", fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [50, 50, 50], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 230 },
      2: { cellWidth: 60 },
      3: { cellWidth: 120 }
    }
  });

  const blobUrl = doc.output("bloburl");

  pdfPreviewIframe.src = blobUrl;
  pdfPreviewContainer.style.display = "block";
}

pdfBtn.addEventListener("click", previewPDF);


/* ------------------------------
   INIT
--------------------------------*/
(async function init() {
  const server = await fetchServerPlanning();
  let data = server;

  const local = localStorage.getItem(PLANNING_KEY);
  if (local) {
    try {
      const obj = JSON.parse(local);
      if (obj.items) data = obj;
    } catch {}
  }

  render(data);
})();
