/* script.js — Version finale avec date synchronisée et PDF A4 */

const PLANNING_KEY = "planning_tpl_full_v1";
const weekSelect = document.getElementById("weekSelect");
const planningContainer = document.getElementById("planning");
const dateDisplay = document.getElementById("dateDisplay");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const pdfBtn = document.getElementById("pdfBtn");
const presidentInput = document.getElementById("presidentName");
const weekDateInput = document.getElementById("weekDate");

let planningData = null;
let currentWeekIndex = 0;

/* -----------------------------
   UTILITAIRES
--------------------------------*/
async function loadServer(){
  try {
    const res = await fetch("planning.json",{cache:"no-store"});
    if(!res.ok) throw new Error("planning.json non trouvé");
    return await res.json();
  } catch(e) { console.warn(e); return null; }
}

function escapeHtml(str){
  return (str||"").toString()
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;");
}

function saveLocal(){ try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){ console.warn(e); } }
function loadLocal(){ try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){} return null; }

/* -----------------------------
   DATE RUSSE
--------------------------------*/
function formatDateRussian(inputDate){
  if(!inputDate) return "";
  const months = ["января","февраля","марта","апреля","мая","июня",
                  "июля","августа","сентября","октября","ноября","декабря"];
  const d = new Date(inputDate);
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `СРЕДА, ${day} ${month} ${year} Г.`;
}

/* -----------------------------
   SEMAINE
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

function renderWeek(idx){
  const week = planningData.weeks[idx];
  if(!week) return;

  dateDisplay.textContent =
    `${week.date} — ${week.scripture} — Председатель : ${week.chairman || ""}`;

  if(presidentInput) presidentInput.value = week.chairman || "";

  if(weekDateInput){
    const parts = week.date.match(/СРЕДА, (\d+) (\w+) (\d+) Г\./);
    if(parts){
      const [_, day, monthName, year] = parts;
      const months = ["января","февраля","марта","апреля","мая","июня",
                      "июля","августа","сентября","октября","ноября","декабря"];
      const monthIndex = months.indexOf(monthName);
      if(monthIndex>=0) weekDateInput.value = `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }
  }

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

  const opt = weekSelect.querySelector(`option[value="${idx}"]`);
  if(opt) opt.textContent = `${week.date} | ${week.scripture} | ${week.chairman || ""}`;
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

  if(field==="duration"){
    const num = value.match(/(\d+)/);
    week.sections[section].items[item].duration = num ? Number(num[1]) : 0;
    recalcTimesForWeek(currentWeekIndex);
    renderWeek(currentWeekIndex);
    return;
  }
  week.sections[section].items[item][field] = value;
}

function recalcTimesForWeek(weekIndex){
  const week = planningData.weeks[weekIndex];
  if(!week) return;

  let flat = [];
  week.sections.forEach(sec=>{ sec.items.forEach(it=>flat.push(it)); });

  for(let i=1;i<flat.length;i++){
    const prev = flat[i-1], cur = flat[i];
    let [h,m] = (prev.time||"00:00").split(":").map(Number);
    let total = h*60+m+Number(prev.duration||0);
    cur.time = `${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  }
}

/* -----------------------------
   BOUTONS / PDF
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

/* -----------------------------
   PRÉSIDENT
--------------------------------*/
if(presidentInput){
  presidentInput.addEventListener("input",(ev)=>{
    const val = ev.target.value.trim();
    planningData.weeks[currentWeekIndex].chairman = val;
    dateDisplay.textContent = `${planningData.weeks[currentWeekIndex].date} — ${planningData.weeks[currentWeekIndex].scripture} — Председатель : ${val}`;
    const opt = weekSelect.querySelector(`option[value="${currentWeekIndex}"]`);
    if(opt) opt.textContent = `${planningData.weeks[currentWeekIndex].date} | ${planningData.weeks[currentWeekIndex].scripture} | ${val}`;
    saveLocal();
  });
}

/* -----------------------------
   CHANGEMENT DE SEMAINE
--------------------------------*/
weekSelect.addEventListener("change", e=>{
  currentWeekIndex = Number(e.target.value);
  renderWeek(currentWeekIndex);
});

/* -----------------------------
   CHANGEMENT DE DATE
--------------------------------*/
if(weekDateInput){
  weekDateInput.addEventListener("input", ()=>{
    const newDate = formatDateRussian(weekDateInput.value);
    planningData.weeks[currentWeekIndex].date = newDate;
    renderWeek(currentWeekIndex);
    saveLocal();
  });
}

/* -----------------------------
   EXPORT PDF
--------------------------------*/
pdfBtn.addEventListener("click", exportPDF);

function exportPDF(){
  if(!planningData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 32, marginTop = 40, colGap = 18;
  const colWidth = (pageWidth - marginLeft*2 - colGap)/2;
  const lineHeight = 12;
  const timeWidth = 50, durWidth = 40, themeWidth = colWidth - timeWidth - durWidth - 12;
  const sectionColors = ["#e6f7f5","#fff7e6","#fff1f2"];

  function renderWeekPDF(xStart, yStart, week){
    let y = yStart;
    doc.setFont("Helvetica","bold").setFontSize(11);
    const titleLines = doc.splitTextToSize(planningData.title||"", colWidth);
    doc.text(titleLines, xStart, y); y += lineHeight*titleLines.length+4;
    doc.setFont("Helvetica","normal").setFontSize(10);
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
          doc.addPage(); y = marginTop;
        }
      });
      y += 6;
    });
    return y;
  }

  const weeks = planningData.weeks;
  for(let i=0;i<weeks.length;i+=2){
    if(i>0) doc.addPage();
    renderWeekPDF(marginLeft, marginTop, weeks[i]);
    if(weeks[i+1]) renderWeekPDF(marginLeft + colWidth + colGap, marginTop, weeks[i+1]);
  }

  const pdfUrl = doc.output("bloburl");
  window.open(pdfUrl, "_blank");
}

/* -----------------------------
   INIT
--------------------------------*/
(async function init(){
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  populateWeekSelect();
  renderWeek(currentWeekIndex);
})();
