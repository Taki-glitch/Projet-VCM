/* script.js
 - Chargement de planning.json
 - Edition inline
 - Sauvegarde localStorage
 - Export / Import JSON
 - Export et prévisualisation PDF
 - Reset depuis serveur
*/

const PLANNING_KEY = "planning_tpl_local_v1";
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

// Charger planning.json depuis serveur
async function fetchServerPlanning(){
  try{
    const res = await fetch("planning.json",{cache:"no-store"});
    if(!res.ok) throw new Error("planning.json non trouvé");
    return await res.json();
  }catch(e){
    console.warn("Impossible de charger planning.json :", e);
    return null;
  }
}

// Rendu planning
function render(pl){
  currentPlanning = pl || {date:"", items:[]};
  dateDisplay.textContent = pl.date || "";
  if(!Array.isArray(pl.items)) pl.items = [];

  const html = pl.items.map((it, idx) => {
    const sectionClass = it.section != null ? `section-${it.section}` : "";
    const theme = escapeHtml(it.theme||"");
    const person = escapeHtml(it.person||"");
    const time = escapeHtml(it.time||"");
    return `
      <div class="row ${sectionClass}" data-idx="${idx}">
        <div class="time">${time}</div>
        <div class="theme editable" contenteditable="true" data-field="theme" aria-label="Thème">${theme}</div>
        <div class="person editable" contenteditable="true" data-field="person" aria-label="Personne">${person}</div>
      </div>
    `;
  }).join("");
  planningContainer.innerHTML = html || "<div style='padding:12px;color:#666'>Aucun élément dans le planning.</div>";

  // Listeners edits
  planningContainer.querySelectorAll(".editable").forEach(el=>{
    el.addEventListener("input", handleEdit);
    el.addEventListener("blur", handleEdit);
  });
}

// Escape HTML
function escapeHtml(s){
  return (s||"").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

// Gestion edition inline
function handleEdit(e){
  const el = e.target;
  const row = el.closest(".row");
  if(!row) return;
  const idx = Number(row.getAttribute("data-idx"));
  const field = el.getAttribute("data-field");
  if(!currentPlanning || !Array.isArray(currentPlanning.items) || typeof idx!=="number") return;
  currentPlanning.items[idx][field] = el.textContent.trim();
  try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning)); }catch(err){console.warn(err);}
}

// Bouton save
if(saveBtn){
  saveBtn.addEventListener("click", ()=>{
    if(!currentPlanning) return;
    try{
      localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));
      saveBtn.textContent="Saved ✅";
      setTimeout(()=> saveBtn.textContent="Sauvegarder (local)",1500);
    }catch(e){ alert("Impossible de sauvegarder localement : "+e.message); }
  });
}

// Bouton reset
if(resetBtn){
  resetBtn.addEventListener("click", async ()=>{
    const server = await fetchServerPlanning();
    if(server){
      render(server);
      try{localStorage.removeItem(PLANNING_KEY);}catch(e){}
      alert("Planning réinitialisé depuis le serveur.");
    } else alert("Impossible de recharger planning.json.");
  });
}

// Export JSON
if(exportBtn){
  exportBtn.addEventListener("click", ()=>{
    if(!currentPlanning) return;
    const blob = new Blob([JSON.stringify(currentPlanning,null,2)],{type:"application/json"});
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

// Import JSON
if(importBtn && importFile){
  importBtn.addEventListener("click", ()=> importFile.click());
  importFile.addEventListener("change", ev=>{
    const f = ev.target.files && ev.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const obj = JSON.parse(e.target.result);
        if(!Array.isArray(obj.items)) throw new Error("Format invalide : items manquant");
        render(obj);
        try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(obj)); }catch(e){}
        alert("Planning importé et enregistré localement.");
      }catch(err){ alert("Fichier JSON invalide : "+err.message); }
    };
    reader.readAsText(f);
    importFile.value="";
  });
}

// --- PDF Preview ---
function previewPDF(){
  if(!currentPlanning) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt",format:"a4"});
  doc.setFont("Helvetica","bold");
  doc.setFontSize(18);
  doc.text("Программа встречи в будние дни",14,36);
  doc.setFont("Helvetica","normal");
  doc.setFontSize(12);
  doc.text(currentPlanning.date||"",14,56);

  const rows = currentPlanning.items.map(item=>[item.time||"",item.theme||"",item.person||""]);

  doc.autoTable({
    startY:70,
    head:[["Время","Тема","Назначенный"]],
    body:rows,
    styles:{font:"Helvetica",fontSize:10,cellPadding:4},
    headStyles:{fillColor:[60,60,60],textColor:[255,255,255]},
    alternateRowStyles:{fillColor:[245,245,245]},
    columnStyles:{0:{cellWidth:50},1:{cellWidth:320},2:{cellWidth:120}},
    tableWidth:"auto"
  });

  const pdfBlob = doc.output("bloburl");
  pdfPreviewIframe.src = pdfBlob;
  pdfPreviewContainer.style.display="block";
}

if(pdfBtn) pdfBtn.addEventListener("click", previewPDF);

// --- INIT ---
(async function init(){
  const server = await fetchServerPlanning();
  let pl = server||{date:"",items:[]};
  const local = localStorage.getItem(PLANNING_KEY);
  if(local){
    try{
      const obj = JSON.parse(local);
      if(obj && Array.isArray(obj.items)) pl=obj;
    }catch(e){console.warn(e);}
  }
  render(pl);
})();
