/* script.js — Version A4 FINAL — PDF identique au modèle */

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

function escapeHtml(str){
  return (str||"").toString()
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
  weekSelect.value = currentWeekIndex;
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

  week.sections.forEach((sec,sidx)=>{
    if(sec.title){
      html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location? " — "+escapeHtml(sec.location):""}</div>`;
    }

    html += sec.items.map((it, itidx)=>{
      const noteHtml = `<div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.note||"")}</div>`;

      return `
      <div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
        <div class="time">${escapeHtml(it.time)}</div>
        <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">
          ${it.part ? `<span class="part">${escapeHtml(it.part)} </span>` : ""}${escapeHtml(it.theme)}
        </div>
        <div class="duration editable" contenteditable="true" data-field="duration" data-section="${sidx}" data-item="${itidx}">
          ${escapeHtml(it.duration)}
        </div>
        <div class="person editable" contenteditable="true" data-field="person" data-section="${sidx}" data-item="${itidx}">
          ${escapeHtml(it.person)}${noteHtml}
        </div>
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
   EDITION
--------------------------------*/
function onEdit(e){
  const el = e.target;
  const week = planningData.weeks[currentWeekIndex];
  const section = Number(el.dataset.section);
  const item = Number(el.dataset.item);
  const field = el.dataset.field;

  let value = el.textContent.trim();

  if(field === "duration"){
    const num = value.match(/(\d+)/);
    week.sections[section].items[item].duration = num ? Number(num[1]) : 0;
    recalcTimesForWeek(currentWeekIndex);
    renderWeek(currentWeekIndex);
    return;
  }

  week.sections[section].items[item][field] = value;
}

/* -----------------------------
   RECALCUL HEURES
--------------------------------*/
function recalcTimesForWeek(weekIndex){
  const week = planningData.weeks[weekIndex];
  if(!week) return;

  let flat = [];
  week.sections.forEach((sec,s)=>{
    sec.items.forEach((it,i)=> flat.push(it));
  });

  for(let i=1; i<flat.length; i++){
    const prev = flat[i-1];
    const cur  = flat[i];

    let [h,m] = (prev.time||"00:00").split(":").map(Number);
    let dur = Number(prev.duration)||0;

    let total = h*60 + m + dur;
    cur.time = `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  }
}

/* -----------------------------
   LOCAL STORAGE
--------------------------------*/
function saveLocal(){
  try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){}
}
function loadLocal(){
  try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return null;
}

/* -----------------------------
   EXPORT JSON
--------------------------------*/
exportBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(planningData,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "planning.json";
  a.click();
});

/* -----------------------------
   IMPORT JSON
--------------------------------*/
importBtn.addEventListener("click", ()=> importFile.click());
importFile.addEventListener("change", async ev=>{
  const f = ev.target.files[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const obj = JSON.parse(txt);
    if(!obj.weeks) throw new Error("Format invalide");
    planningData = obj;
    populateWeekSelect();
    renderWeek(0);
    saveLocal();
  }catch(e){ alert(e.message); }
});

/* -----------------------------
   EXPORT PDF (CORRIGÉ)
--------------------------------*/
function exportPDF(){
  if(!planningData) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});

  // --- VARIABLES PDF CORRECTEMENT DÉFINIES AVANT USAGE ---
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginLeft = 32;
  const marginTop = 40;
  const colGap = 18;

  const colWidth = (pageWidth - marginLeft*2 - colGap)/2;
  const lineHeight = 12;

  const timeWidth = 50;
  const durWidth = 40;
  const themeWidth = colWidth - timeWidth - durWidth - 12;  // <- **ICI définie**

  const sectionColors = ["#e6f7f5","#fff7e6","#fff1f2"];

  function renderWeek(xStart, yStart, week){
    let y = yStart;

    doc.setFont("Helvetica","bold"); doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(planningData.title||"", colWidth);
    doc.text(titleLines, xStart, y);
    y += lineHeight*titleLines.length + 4;

    doc.setFont("Helvetica","normal"); doc.setFontSize(10);
    doc.text(`${week.date} | ${week.scripture}`, xStart, y); y+=lineHeight;
    doc.text(`Председатель : ${week.chairman||""}`, xStart, y); y+=lineHeight+4;

    week.sections.forEach((section,sidx)=>{
      if(section.title){
        doc.setFont("Helvetica","bold").setFontSize(10);
        doc.text(section.title + (section.location? " — "+section.location:""), xStart, y);
        y += lineHeight;
      }

      section.items.forEach(item=>{
        doc.setFillColor(sectionColors[sidx % sectionColors.length]);
        doc.rect(xStart-2, y-2, colWidth, lineHeight, "F");

        doc.setFont("Helvetica","bold").setFontSize(9);
        doc.text(item.time||"", xStart, y);

        const themeText = (item.part? item.part+" " : "") + (item.theme||"");
        const themeLines = doc.splitTextToSize(themeText, themeWidth);

        doc.setFont("Helvetica","normal");
        doc.text(themeLines, xStart + timeWidth, y);

        const dtext = item.duration ? item.duration+" мин." : "";
        doc.text(dtext, xStart + timeWidth + themeWidth, y);

        if(item.person || item.note){
          doc.setFont("Helvetica","italic");
          const pn = [item.person||"", item.note||""].filter(Boolean).join(" — ");
          const pnLines = doc.splitTextToSize(pn, themeWidth+durWidth);
          doc.text(pnLines, xStart + timeWidth, y + lineHeight);
          y += lineHeight * pnLines.length;
        }

        y += lineHeight;
        if(y > pageHeight - marginTop){
          doc.addPage();
          y = marginTop;
        }
      });

      y += 6;
    });

    return y;
  }

  const weeks = planningData.weeks;
  for(let i=0;i<weeks.length;i+=2){
    if(i>0) doc.addPage();
    renderWeek(marginLeft, marginTop, weeks[i]);
    if(weeks[i+1]) renderWeek(marginLeft + colWidth + colGap, marginTop, weeks[i+1]);
  }

  window.open(doc.output("bloburl"), "_blank");
}

pdfBtn.addEventListener("click", exportPDF);

/* -----------------------------
   CHANGEMENT DE SEMAINE
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
