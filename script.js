/* script.js — version A3 (2 semaines/page PDF) */

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

function escapeHtml(s){ return (s||"").toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

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

function renderWeek(idx){
  const week = planningData.weeks[idx];
  if(!week) return;
  dateDisplay.textContent = `${week.date} | ${week.scripture} — Председатель : ${week.chairman}`;
  // Build HTML: sections with titles then rows
  let html = "";
  week.sections.forEach((sec, sidx)=>{
    if(sec.title) html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location? ' — '+escapeHtml(sec.location):''}</div>`;
    html += sec.items.map((it, itidx)=>{
      const part = it.part ? `<span class="part">${escapeHtml(it.part)} </span>` : "";
      const noteHtml = it.note ? `<div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.note)}</div>` : `<div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}"></div>`;
      return `
        <div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
          <div class="time">${escapeHtml(it.time)}</div>
          <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">${part}${escapeHtml(it.theme)}</div>
          <div class="duration editable" contenteditable="true" data-field="duration" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.duration)}</div>
          <div class="person editable" contenteditable="true" data-field="person" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.person)}${noteHtml}</div>
        </div>
      `;
    }).join("");
  });
  planningContainer.innerHTML = html || "<div style='padding:12px;color:#666'>Aucune donnée pour cette semaine.</div>";

  // Attach listeners
  planningContainer.querySelectorAll(".editable").forEach(el=>{
    el.removeEventListener("input", onEdit);
    el.addEventListener("input", onEdit);
    el.addEventListener("blur", ()=> saveLocal());
  });
}

function onEdit(e){
  const el = e.target;
  const field = el.dataset.field;
  const sidx = Number(el.dataset.section);
  const itidx = Number(el.dataset.item);
  const week = planningData.weeks[currentWeekIndex];
  if(!week || !week.sections[sidx] || !week.sections[sidx].items[itidx]) return;
  let value = el.textContent.trim();
  // For duration, keep numeric only
  if(field === "duration"){
    // allow formats like "3" or "3 мин" — extract number
    const m = value.match(/(\d+)/);
    value = m ? Number(m[1]) : 0;
    week.sections[sidx].items[itidx].duration = value;
    recalcTimesForWeek(currentWeekIndex);
    renderWeek(currentWeekIndex);
    return;
  }
  // note/theme/person
  week.sections[sidx].items[itidx][field] = value;
}

function recalcTimesForWeek(weekIndex){
  const week = planningData.weeks[weekIndex];
  if(!week) return;
  // flatten items in order to propagate durations
  let flat = [];
  week.sections.forEach((sec, sidx)=>{
    sec.items.forEach((it, itidx)=> flat.push({sec:sidx, idx:itidx, item:it}));
  });
  for(let i=1;i<flat.length;i++){
    const prev = flat[i-1].item;
    const cur = flat[i].item;
    const [h,m] = (prev.time||"00:00").split(":").map(Number);
    if(isNaN(h)||isNaN(m)) continue;
    const dur = Number(prev.duration)||0;
    const total = h*60 + m + dur;
    const nh = String(Math.floor(total/60)).padStart(2,"0");
    const nm = String(total%60).padStart(2,"0");
    cur.time = `${nh}:${nm}`;
  }
}

function saveLocal(){
  try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){console.warn(e);}
}

function loadLocal(){
  try{
    const raw = localStorage.getItem(PLANNING_KEY);
    if(raw) planningData = JSON.parse(raw);
  }catch(e){ console.warn(e); }
}

async function init(){
  const server = await loadServer();
  if(!server) return alert("Impossible de charger planning.json serveur — place planning.json à la racine.");
  planningData = server;
  // prefer local saved if present
  const local = localStorage.getItem(PLANNING_KEY);
  if(local){
    try{ const obj = JSON.parse(local); if(obj.weeks) planningData = obj; }catch(e){}
  }
  populateWeekSelect();
  renderWeek(currentWeekIndex);
}

weekSelect.addEventListener("change", (e)=>{
  currentWeekIndex = Number(e.target.value);
  renderWeek(currentWeekIndex);
});

// Buttons
saveBtn.addEventListener("click", ()=>{
  saveLocal();
  saveBtn.textContent = "Saved ✅";
  setTimeout(()=> saveBtn.textContent = "Sauvegarder (local)",1200);
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
  } else alert("Impossible de recharger planning.json.");
});

exportBtn.addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(planningData,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "planning-export.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importBtn.addEventListener("click", ()=> importFile.click());
importFile.addEventListener("change", async (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  const txt = await f.text();
  try{
    const obj = JSON.parse(txt);
    if(!obj.weeks) throw new Error("Format invalide");
    planningData = obj;
    populateWeekSelect();
    currentWeekIndex = 0;
    renderWeek(0);
    saveLocal();
    alert("Planning importé.");
  }catch(e){
    alert("Fichier JSON invalide : "+ e.message);
  }
  importFile.value = "";
});

// ---------------- PDF Export (2 semaines côte à côte)
function exportPDF(){
  if(!planningData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt",format:"a4"});
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 28;
  const colW = (pageW - margin*2 - 12) / 2; // two columns with small gap
  const gap = 12;

  const weeks = planningData.weeks;
  for(let i=0;i<weeks.length;i+=2){
    if(i>0) doc.addPage();
    const left = weeks[i];
    const right = weeks[i+1];

    // render column function
    const renderColumn = (x, yStart, week)=>{
      let y = yStart;
      doc.setFontSize(11);
      doc.setFont("Helvetica","bold");
      doc.text(planningData.title||"", x, y);
      y += 16;
      doc.setFontSize(10);
      doc.setFont("Helvetica","normal");
      doc.text(week.date + " | " + (week.scripture||""), x, y);
      y += 14;
      doc.text("Председатель : " + (week.chairman||""), x, y);
      y += 18;

      // sections
      week.sections.forEach(sec=>{
        if(sec.title){
          doc.setFont("Helvetica","bold");
          doc.setFontSize(10);
          doc.text(sec.title + (sec.location ? " — "+sec.location : ""), x, y);
          y += 14;
        }
        // table-like rows
        sec.items.forEach(it=>{
          // time
          doc.setFont("Helvetica","bold");
          doc.setFontSize(9);
          doc.text(it.time || "", x, y);
          // theme + part on same line
          const leftText = (it.part ? (it.part+" ") : "") + (it.theme || "");
          doc.setFont("Helvetica","normal");
          doc.setFontSize(9);
          // wrap theme within colW-120
          const themeX = x + 50;
          const themeW = colW - 50 - 60;
          const splitted = doc.splitTextToSize(leftText, themeW);
          doc.text(splitted, themeX, y);
          // duration on right of theme
          const durText = it.duration ? (String(it.duration) + " мин.") : "";
          doc.text(durText, x + colW - 60, y);
          y += (splitted.length * 11) + 6;
          // person and note below
          if(it.person || it.note){
            const personLine = (it.person ? it.person : "") + (it.note ? (" — " + it.note) : "");
            doc.setFontSize(9);
            doc.setFont("Helvetica","italic");
            const pSplit = doc.splitTextToSize(personLine, colW - 10);
            doc.text(pSplit, themeX, y);
            y += pSplit.length * 11 + 8;
          } else {
            y += 2;
          }
          // if y too low, nothing: columns handled per page pair
        });
      });
      return y;
    };

    // left column
    renderColumn(margin, 40, left);
    // right column, if exists
    if(right){
      renderColumn(margin + colW + gap, 40, right);
    }
  }

  // output preview
  const blobUrl = doc.output("bloburl");
  pdfPreviewIframe.src = blobUrl;
  pdfPreviewContainer.style.display = "block";

  // also trigger save dialog:
  doc.save("programme.pdf");
}

pdfBtn.addEventListener("click", exportPDF);

// INIT
init();
