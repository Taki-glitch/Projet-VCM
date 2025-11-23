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
   CONSTRUCTION LISTE DÉROULANTE
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
   AFFICHAGE D’UNE SEMAINE
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
      const noteHtml = `
        <div class="note editable"
             contenteditable="true"
             data-field="note"
             data-section="${sidx}"
             data-item="${itidx}">
          ${escapeHtml(it.note||"")}
        </div>`;

      return `
        <div class="row section-${(sidx%4)+1}"
             data-section="${sidx}"
             data-item="${itidx}">
             
          <div class="time">${escapeHtml(it.time)}</div>
          
          <div class="theme editable"
               contenteditable="true"
               data-field="theme"
               data-section="${sidx}"
               data-item="${itidx}">
               ${part}${escapeHtml(it.theme)}
          </div>
          
          <div class="duration editable"
               contenteditable="true"
               data-field="duration"
               data-section="${sidx}"
               data-item="${itidx}">
               ${escapeHtml(it.duration)}
          </div>

          <div class="person editable"
               contenteditable="true"
               data-field="person"
               data-section="${sidx}"
               data-item="${itidx}">
               ${escapeHtml(it.person)}
               ${noteHtml}
          </div>
        </div>
      `;
    }).join("");
  });

  planningContainer.innerHTML = html;

  planningContainer.querySelectorAll(".editable").forEach(el=>{
    el.addEventListener("input", onEdit);
    el.addEventListener("blur", saveLocal);
  });
}

/* -----------------------------
   MODIFICATION D’UN CHAMP
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
   CALCUL AUTOMATIQUE DES HEURES
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
  try{
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData));
  }catch(e){ console.warn(e); }
}

function loadLocal(){
  try{
    let raw = localStorage.getItem(PLANNING_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return null;
}

/* -----------------------------
   BOUTONS — SAUVEGARDE / RESET / IMPORT / EXPORT
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
  } else {
    alert("Impossible de recharger planning.json");
  }
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
   EXPORT PDF — VERSION FINALE
   (Helvetica, 3 colonnes, layout fixe)
--------------------------------*/
function exportPDF(){
  if(!planningData) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});

  // Paramètres confirmés
  const marginLeft = 32;
  const marginTop = 40;
  const colGap = 18;
  const lineHeight = 10.5;

  const columnWidth = (doc.internal.pageSize.getWidth() - marginLeft*2 - colGap) / 2;

  const timeWidth = 50;
  const themeWidth = 230;
  const durWidth = 40;

  const titleSpacing = 14;
  const sectionSpacing = 10;

  function renderWeek(x, y, week){
    // Titre principal
    doc.setFont("Helvetica","bold");
    doc.setFontSize(11);
    doc.text(planningData.title || "", x, y);
    y += titleSpacing;

    doc.setFont("Helvetica","normal");
    doc.setFontSize(10);
    doc.text(week.date + " | " + week.scripture, x, y);
    y += titleSpacing;

    doc.text("Председатель : " + (week.chairman||""), x, y);
    y += titleSpacing;

    // Sections
    week.sections.forEach(section=>{
      if(section.title){
        doc.setFont("Helvetica","bold");
        doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(section.title + (section.location ? " — "+section.location : ""), x, y);
        doc.setTextColor(0);
        y += sectionSpacing;
      }

      // Items
      section.items.forEach(item=>{
        // Ligne 1
        doc.setFont("Helvetica","bold");
        doc.setFontSize(9);
        doc.text(item.time || "", x, y);

        const part = item.part ? (item.part+" ") : "";
        const theme = part + (item.theme||"");

        doc.setFont("Helvetica","normal");
        doc.text(theme, x + timeWidth, y);

        const durText = item.duration ? (item.duration + " мин.") : "";
        doc.text(durText, x + timeWidth + themeWidth, y);

        y += lineHeight;

        // Ligne 2 : personne + note (indentée)
        if(item.person || item.note){
          doc.setFont("Helvetica","italic");
          let line = "";
          if(item.person) line += item.person;
          if(item.note) line += " — " + item.note;

          doc.text(line, x + timeWidth + 12, y);
          y += lineHeight;
        }

        y += 2; // micro-espace comme le modèle
      });

      y += 4;
    });

    return y;
  }

  const weeks = planningData.weeks;

  // 2 semaines par page
  for(let i=0; i<weeks.length; i += 2){
    if(i>0) doc.addPage();

    renderWeek(marginLeft, marginTop, weeks[i]);

    if(weeks[i+1]){
      renderWeek(marginLeft + columnWidth + colGap, marginTop, weeks[i+1]);
    }
  }

  const url = doc.output("bloburl");
  pdfPreviewIframe.src = url;
  pdfPreviewContainer.style.display = "block";

  doc.save("programme.pdf");
}

pdfBtn.addEventListener("click", exportPDF);

/* -----------------------------
   INITIALISATION
--------------------------------*/
weekSelect.addEventListener("change", ()=>{
  currentWeekIndex = Number(weekSelect.value);
  renderWeek(currentWeekIndex);
});

async function init(){
  const server = await loadServer();
  if(!server) return alert("Impossible de charger planning.json");

  const local = loadLocal();
  planningData = local || server;

  populateWeekSelect();
  renderWeek(currentWeekIndex);
}

init();
