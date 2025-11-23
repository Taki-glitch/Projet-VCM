/* script.js — Version A4 FINAL — PDF identique au modèle
   - Édition complète par semaine
   - Sauvegarde localStorage
   - Recalcul automatique des horaires
   - Import / export JSON
   - Export PDF 2 semaines par page (layout identique au PDF modèle)
*/

const PLANNING_KEY = "planning_tpl_full_v1";
const weekSelect = document.getElementById("weekSelect");
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

let planningData = null;
let currentWeekIndex = 0;

/* -----------------------------
   CHARGEMENT DU PLANNING.JSON
--------------------------------*/
async function loadServer(){
  try {
    const res = await fetch("planning.json",{cache:"no-store"});
    if(!res.ok) throw new Error("planning.json non trouvé");
    return await res.json();
  } catch(e) {
    console.warn(e);
    return null;
  }
}

function escapeHtml(s){
  return (s||"").toString()
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

/* -----------------------------
   LISTE DÉROULANTE
--------------------------------*/
function populateWeekSelect(){
  weekSelect.innerHTML = "";
  planningData.weeks.forEach((w,i)=>{
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${w.date} | ${w.scripture} | ${w.chairman}`;
    weekSelect.appendChild(opt);
  });
  weekSelect.value = currentWeekIndex || 0;
}

/* -----------------------------
   AFFICHAGE SEMAINE
--------------------------------*/
function renderWeek(idx){
  const week = planningData.weeks[idx];
  if(!week) return;

  dateDisplay.textContent =
    `${week.date} — ${week.scripture} — Председатель : ${week.chairman}`;

  let html = "";

  week.sections.forEach((sec, sidx)=>{
    if(sec.title){
      html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location? " — "+escapeHtml(sec.location):""}</div>`;
    }

    html += sec.items.map((it, itidx)=>{
      const part = it.part ? `<span class="part">${escapeHtml(it.part)} </span>` : "";
      const noteHtml = `<div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.note||"")}</div>`;

      return `<div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
        <div class="time">${escapeHtml(it.time)}</div>
        <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">${part}${escapeHtml(it.theme)}</div>
        <div class="duration editable" contenteditable="true" data-field="duration" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.duration)}</div>
        <div class="person editable" contenteditable="true" data-field="person" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.person)}${noteHtml}</div>
      </div>`;
    }).join("");
  });

  planningContainer.innerHTML = html;

  planningContainer.querySelectorAll(".editable").forEach(el=>{
    el.addEventListener("input", onEdit);
    el.addEventListener("blur", saveLocal);
  });
}

/* -----------------------------
   MODIFICATION CHAMP
--------------------------------*/
function onEdit(e){
  const el = e.target;
  const field = el.dataset.field;
  const sec = Number(el.dataset.section);
  const idx = Number(el.dataset.item);

  const week = planningData.weeks[currentWeekIndex];
  const item = week.sections[sec].items[idx];

  let value = el.textContent.trim();

  if(field === "duration"){
    const num = value.match(/(\d+)/);
    item.duration = num ? Number(num[1]) : 0;
    recalcTimesForWeek(currentWeekIndex);
    renderWeek(currentWeekIndex);
    return;
  }

  item[field] = value;
}

/* -----------------------------
   RECALCUL DES HEURES
--------------------------------*/
function recalcTimesForWeek(weekIndex){
  const week = planningData.weeks[weekIndex];
  if(!week) return;

  let flat = [];
  week.sections.forEach((sec,s)=>{
    sec.items.forEach((it,i)=> flat.push({sec:s, idx:i, it}));
  });

  for(let i=1; i<flat.length; i++){
    const prev = flat[i-1].it;
    const cur  = flat[i].it;

    let [h,m] = (prev.time||"00:00").split(":").map(Number);
    let dur = Number(prev.duration)||0;

    let total = h*60 + m + dur;
    let nh = String(Math.floor(total/60)).padStart(2,"0");
    let nm = String(total%60).padStart(2,"0");

    cur.time = `${nh}:${nm}`;
  }
}

/* -----------------------------
   LOCAL STORAGE
--------------------------------*/
function saveLocal(){
  try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){ console.warn(e); }
}
function loadLocal(){
  try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return null;
}

/* -----------------------------
   BOUTONS
--------------------------------*/
saveBtn.addEventListener("click", ()=>{
  saveLocal();
  saveBtn.textContent = "Saved ✅";
  setTimeout(()=> saveBtn.textContent="Sauvegarder (local)", 1200);
});

resetBtn.addEventListener("click", async ()=>{
  const server = await loadServer();
  if(server){
    planningData = server;
    localStorage.removeItem(PLANNING_KEY);
    populateWeekSelect();
    currentWeekIndex = 0;
    renderWeek(0);
    alert("Planning réinitialisé depuis le serveur.");
  } else alert("Impossible de recharger planning.json");
});

exportBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(planningData,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planning-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", ()=> importFile.click());
importFile.addEventListener("change", async (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  try{
    const text = await f.text();
    const obj = JSON.parse(text);
    if(!obj.weeks) throw new Error("Format JSON invalide");
    planningData = obj;
    populateWeekSelect();
    currentWeekIndex = 0;
    renderWeek(0);
    saveLocal();
    alert("Planning importé.");
  }catch(e){
    alert("Erreur : " + e.message);
  }
});

/* -----------------------------
   EXPORT PDF
--------------------------------*/
function exportPDF(){
  if(!planningData) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 32;
  const marginTop = 40;
  const colGap = 18;

  const colWidth = (pageWidth - marginLeft*2 - colGap)/2;
  const lineHeight = 12;

  const timeWidth = 50;
  const durWidth = 40;
  const themeWidth = colWidth - timeWidth - durWidth - 12; // 12pt padding

  const sectionColors = ["#e6f7f5","#fff7e6","#fff1f2"];

  function renderWeek(xStart, yStart, week, colIndex){
    let y = yStart;

    // Titre
    doc.setFont("Helvetica","bold"); doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(planningData.title||"", colWidth);
    doc.text(titleLines, xStart, y); y += lineHeight*titleLines.length + 4;

    // Date / Scripture / Chairman
    doc.setFont("Helvetica","normal"); doc.setFontSize(10);
    doc.text(`${week.date} | ${week.scripture}`, xStart, y); y += lineHeight;
    doc.text(`Председатель : ${week.chairman||""}`, xStart, y); y += lineHeight + 4;

    week.sections.forEach((section,sidx)=>{
      // Section title
      if(section.title){
        doc.setFont("Helvetica","bold"); doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(section.title + (section.location ? " — "+section.location : ""), xStart, y);
        doc.setTextColor(0);
        y += lineHeight;
      }

      // Items
      section.items.forEach(item=>{
        // Fond alterné
        doc.setFillColor(sectionColors[sidx % sectionColors.length]);
        doc.rect(xStart-2, y-2, colWidth, lineHeight, 'F');

        // Time
        doc.setFont("Helvetica","bold"); doc.setFontSize(9);
        doc.text(item.time||"", xStart, y);

        // Theme
        const themeText = (item.part ? item.part + " " : "") + (item.theme||"");
        doc.setFont("Helvetica","normal");
        const themeLines = doc.splitTextToSize(themeText, themeWidth);
        doc.text(themeLines, xStart + timeWidth, y);

        // Duration
        const durText = item.duration ? item.duration + " мин." : "";
        doc.text(durText, xStart + timeWidth + themeWidth, y);

        // Person + note
        if(item.person || item.note){
          doc.setFont("Helvetica","italic");
          const personNote = [item.person || "", item.note || ""].filter(Boolean).join(" — ");
          const pnLines = doc.splitTextToSize(personNote, themeWidth + durWidth);
          doc.text(pnLines, xStart + timeWidth, y + lineHeight);
          y += lineHeight * pnLines.length;
        }

        y += lineHeight;
        // Vérifier si on dépasse la page
        if(y > pageHeight - marginTop){
          doc.addPage();
          y = marginTop;
        }
      });

      y += 6; // espace après section
    });

    return y;
  }

  // Parcours 2 semaines par page
  const weeks = planningData.weeks;
  for(let i=0; i<weeks.length; i+=2){
    if(i>0) doc.addPage();
    const y1 = renderWeek(marginLeft, marginTop, weeks[i], 0);
    if(weeks[i+1]) renderWeek(marginLeft + colWidth + colGap, marginTop, weeks[i+1], 1);
  }

  const url = doc.output("bloburl");
  pdfPreviewContainer.style.display = "block";
  pdfPreviewIframe.src = url;
}

/* -----------------------------
   SÉLECTION SEMAINE
--------------------------------*/
weekSelect.addEventListener("change", e=>{
  currentWeekIndex = Number(e.target.value);
  renderWeek(currentWeekIndex);
});

/* -----------------------------
   INITIALISATION
--------------------------------*/
(async function init(){
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }

  if(!planningData.title) planningData.title = "Planning TPL";
  populateWeekSelect();
  renderWeek(currentWeekIndex);
})();
