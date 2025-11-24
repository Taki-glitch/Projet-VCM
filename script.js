/* script.js — Version A4 FINAL avec date modifiable */

const PLANNING_KEY = "planning_tpl_full_v2";
const weekSelect = document.getElementById("weekSelect");
const planningContainer = document.getElementById("planning");
const dateDisplay = document.getElementById("dateDisplay");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const pdfBtn = document.getElementById("pdfBtn");
const presidentInput = document.getElementById("presidentName");
const pdfPreviewContainer = document.getElementById("pdfPreviewContainer");
const pdfPreviewIframe = document.getElementById("pdfPreview");

let planningData = null;
let currentWeekIndex = 0;

/* -----------------------------
   UTILITAIRES
--------------------------------*/
function escapeHtml(str){
  return (str||"").toString()
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

// Convertit Date en mercredi russe
function formatRussianWednesday(date){
  const months = ["ЯНВАРЯ","ФЕВРАЛЯ","МАРТА","АПРЕЛЯ","МАЯ","ИЮНЯ",
                  "ИЮЛЯ","АВГУСТА","СЕНТЯБРЯ","ОКТЯБРЯ","НОЯБРЯ","ДЕКАБРЯ"];
  const d = new Date(date);
  return `СРЕДА, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} Г.`;
}

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

function saveLocal(){
  try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){ console.warn(e); }
}
function loadLocal(){
  try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){}
  return null;
}

/* -----------------------------
   LISTE DÉROULANTE
--------------------------------*/
function populateWeekSelect(){
  weekSelect.innerHTML = "";
  planningData.weeks.forEach((w,i)=>{
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = `${w.date} | ${w.scripture} | ${w.chairman || ""}`;
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

  // Affiche la date + info
  dateDisplay.textContent = week.date;

  // Champ président
  if(presidentInput) presidentInput.value = week.chairman || "";

  let html = "";
  week.sections.forEach((sec,sidx)=>{
    if(sec.title){
      html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location? " — "+escapeHtml(sec.location):""}</div>`;
    }
    html += sec.items.map((it,itidx)=>{
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
  week.sections.forEach(sec=> sec.items.forEach(it=> flat.push(it)));
  for(let i=1;i<flat.length;i++){
    const prev = flat[i-1];
    const cur = flat[i];
    let [h,m] = (prev.time||"00:00").split(":").map(Number);
    let total = h*60 + m + (Number(prev.duration)||0);
    cur.time = `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  }
}

/* -----------------------------
   BOUTONS
--------------------------------*/
saveBtn.addEventListener("click", ()=>{
  saveLocal();
  saveBtn.textContent = "Saved ✅";
  setTimeout(()=> saveBtn.textContent="Sauvegarder (local)",1200);
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

pdfBtn.addEventListener("click", exportPDF);

/* -----------------------------
   PRÉSIDENT
--------------------------------*/
if(presidentInput){
  presidentInput.addEventListener("input",(ev)=>{
    const val = ev.target.value.trim();
    if(planningData && planningData.weeks && planningData.weeks[currentWeekIndex]){
      planningData.weeks[currentWeekIndex].chairman = val;
      saveLocal();
    }
  });
}

/* -----------------------------
   SEMAINE / DATE
--------------------------------*/
weekSelect.addEventListener("change", e=>{
  currentWeekIndex = Number(e.target.value);
  renderWeek(currentWeekIndex);
});

// Bouton changement date
const dateBtn = document.createElement("button");
dateBtn.textContent = "Changer mercredi";
dateBtn.addEventListener("click", ()=>{
  const newDateStr = prompt("Entrez la nouvelle date du mercredi (jj.mm.aaaa) :");
  if(!newDateStr) return;
  const [day,month,year] = newDateStr.split(".").map(Number);
  const newDate = new Date(year,month-1,day);
  const russianDate = formatRussianWednesday(newDate);
  planningData.weeks[currentWeekIndex].date = russianDate;
  renderWeek(currentWeekIndex);
  populateWeekSelect();
  saveLocal();
});
document.querySelector(".header-left").appendChild(dateBtn);

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
