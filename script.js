/* script.js
 - Chargement de planning.json (fichier serveur)
 - Edition inline (contentEditable)
 - Sauvegarde dans localStorage
 - Export / Import JSON
 - Export PDF
 - Reset depuis le fichier serveur
*/

const PLANNING_KEY = "planning_tpl_local_v1";
const planningContainer = document.getElementById("planning");
const dateDisplay = document.getElementById("dateDisplay");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

let currentPlanning = null;

// util : charger planning.json depuis serveur
async function fetchServerPlanning(){
  try{
    const res = await fetch("planning.json", {cache: "no-store"});
    if(!res.ok) throw new Error("planning.json non trouvé");
    const data = await res.json();
    return data;
  }catch(e){
    console.warn("Impossible de charger planning.json :", e);
    return null;
  }
}

// render
function render(pl){
  currentPlanning = pl || {date:"", items:[]};
  dateDisplay.textContent = pl.date || "";
  if(!Array.isArray(pl.items)) pl.items = [];

  const html = pl.items.map((it, idx) => {
    // section class optional — check for 0 too
    const sectionClass = (it.section !== undefined && it.section !== null) ? `section-${it.section}` : "";
    const theme = escapeHtml(it.theme || "");
    const person = escapeHtml(it.person || "");
    const time = escapeHtml(it.time || "");
    return `
      <div class="row ${sectionClass}" data-idx="${idx}">
        <div class="time">${time}</div>
        <div class="theme editable" contenteditable="true" data-field="theme" aria-label="Thème">${theme}</div>
        <div class="person editable" contenteditable="true" data-field="person" aria-label="Personne">${person}</div>
      </div>
    `;
  }).join("");
  planningContainer.innerHTML = html || "<div style='padding:12px;color:#666'>Aucun élément dans le planning.</div>";

  // add listeners for inline edits
  planningContainer.querySelectorAll(".editable").forEach(el => {
    el.addEventListener("input", handleEdit);
    el.addEventListener("blur", handleEdit); // save on blur
  });
}

// escape HTML small util
function escapeHtml(s){
  return (s||"").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

// handle edit
function handleEdit(e){
  const el = e.target;
  const row = el.closest(".row");
  if(!row) return;
  const idx = Number(row.getAttribute("data-idx"));
  const field = el.getAttribute("data-field");
  if(!currentPlanning || !Array.isArray(currentPlanning.items) || typeof idx !== "number") return;
  // store raw textContent (preserve simple text)
  currentPlanning.items[idx][field] = el.textContent.trim();
  // autosave to localStorage
  try {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));
  } catch(err) {
    console.warn("localStorage set error", err);
  }
}

// save button explicit (redundant because autosave)
if(saveBtn) {
  saveBtn.addEventListener("click", () => {
    if(!currentPlanning) return;
    try{
      localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));
      saveBtn.textContent = "Saved ✅";
      setTimeout(()=> saveBtn.textContent = "Sauvegarder (local)", 1500);
    }catch(e){
      alert("Impossible de sauvegarder localement : " + e.message);
    }
  });
}

// reset from server file
if(resetBtn){
  resetBtn.addEventListener("click", async () => {
    const server = await fetchServerPlanning();
    if(server){
      render(server);
      try{ localStorage.removeItem(PLANNING_KEY); }catch(e){}
      alert("Planning réinitialisé depuis le fichier serveur. Vos modifications locales ont été supprimées.");
    } else {
      alert("Impossible de recharger planning.json depuis le serveur.");
    }
  });
}

// export JSON
if(exportBtn){
  exportBtn.addEventListener("click", () => {
    if(!currentPlanning) return;
    const blob = new Blob([JSON.stringify(currentPlanning, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeDate = (currentPlanning.date||"planning").replace(/[^\w\d\-_.]/g,"_");
    a.download = `planning-export-${safeDate}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

// import JSON
if(importBtn && importFile){
  importBtn.addEventListener("click", ()=> importFile.click());
  importFile.addEventListener("change", (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      try{
        const obj = JSON.parse(e.target.result);
        // basic validation
        if(!Array.isArray(obj.items)) throw new Error("Format invalide : items manquant");
        render(obj);
        try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(obj)); }catch(e){}
        alert("Planning importé et enregistré localement.");
      }catch(err){
        alert("Fichier JSON invalide : "+err.message);
      }
    };
    reader.readAsText(f);
    // reset input
    importFile.value = "";
  });
}

// --- EXPORT PDF ---
const pdfBtn = document.getElementById("pdfBtn");

pdfBtn.addEventListener("click", () => {
  if (!currentPlanning) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Titre principal
  doc.setFont("Helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Программа встречи в будние дни", 14, 18);

  // Date
  doc.setFontSize(13);
  doc.setFont("Helvetica", "normal");
  doc.text(currentPlanning.date || "", 14, 28);

  // Construire tableau PDF
  const rows = currentPlanning.items.map(item => [
    item.time || "",
    item.theme || "",
    item.person || ""
  ]);

  doc.autoTable({
    startY: 40,
    head: [["Время", "Тема", "Назначенный"]],
    body: rows,
    styles: {
      font: "Helvetica",
      fontSize: 11,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [60, 60, 60],
      textColor: [255, 255, 255]
    },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // Télécharger
  doc.save(`programme-${(currentPlanning.date || "planning").replace(/\s+/g, "_")}.pdf`);
});


// init : load server planning then override with localStorage if present
(async function init(){
  const server = await fetchServerPlanning();
  let pl = server || {date:"", items:[]};

  // if user has local copy, use it
  const local = localStorage.getItem(PLANNING_KEY);
  if(local){
    try{
      const localObj = JSON.parse(local);
      if(localObj && Array.isArray(localObj.items)) {
        pl = localObj;
      }
    }catch(e){
      console.warn("localStorage parse error", e);
    }
  }

  render(pl);
})();
