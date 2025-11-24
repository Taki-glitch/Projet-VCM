/* script.js — Version finale PDF fidèle au modèle */

const PLANNING_KEY = "planning_tpl_full_v1";
const weekSelect = document.getElementById("weekSelect");
const planningContainer = document.getElementById("planning");
const dateDisplay = document.getElementById("dateDisplay");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const pdfBtn = document.getElementById("pdfBtn");
const presidentInput = document.getElementById("presidentName");

let planningData = null;
let currentWeekIndex = 0;

/* -----------------------------
   CHARGEMENT
--------------------------------*/
async function loadServer(){
  try {
    const res = await fetch("planning.json",{cache:"no-store"});
    if(!res.ok) throw new Error("planning.json non trouvé");
    return await res.json();
  } catch(e) { console.warn(e); return null; }
}

function escapeHtml(str){ return (str||"").toString().replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

/* -----------------------------
   SEMAINE SELECT
--------------------------------*/
function populateWeekSelect(){
  weekSelect.innerHTML = "";
  planningData.weeks.forEach((w,i)=>{
    const opt = document.createElement("option");
    opt.value=i;
    opt.textContent = `${w.date} | ${w.scripture} | ${w.chairman||""}`;
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

  dateDisplay.textContent = `${week.date} — ${week.scripture} — Председатель : ${week.chairman||""}`;

  if(presidentInput) presidentInput.value = week.chairman || "";

  let html = "";
  week.sections.forEach((sec,sidx)=>{
    if(sec.title){
      html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location?" — "+escapeHtml(sec.location):""}</div>`;
    }

    html += sec.items.map((it,itidx)=>{
      const noteHtml = `<div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.note||"")}</div>`;
      return `<div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
        <div class="time">${escapeHtml(it.time)}</div>
        <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">${it.part? `<span class="part">${escapeHtml(it.part)} </span>` : ""}${escapeHtml(it.theme)}</div>
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

  const opt = weekSelect.querySelector(`option[value="${idx}"]`);
  if(opt) opt.textContent = `${week.date} | ${week.scripture} | ${week.chairman||""}`;
}

/* -----------------------------
   EDITION
--------------------------------*/
function onEdit(e){
  const el=e.target;
  const week=planningData.weeks[currentWeekIndex];
  const section=Number(el.dataset.section);
  const item=Number(el.dataset.item);
  const field=el.dataset.field;

  let value=el.textContent.trim();
  if(field==="duration"){
    const num=value.match(/(\d+)/);
    week.sections[section].items[item].duration=num? Number(num[1]):0;
    recalcTimesForWeek(currentWeekIndex);
    renderWeek(currentWeekIndex);
    return;
  }
  week.sections[section].items[item][field]=value;
}

/* -----------------------------
   RECALCUL HEURES
--------------------------------*/
function recalcTimesForWeek(weekIndex){
  const week=planningData.weeks[weekIndex];
  if(!week) return;

  let flat=[];
  week.sections.forEach(sec=>flat.push(...sec.items));

  for(let i=1;i<flat.length;i++){
    const prev=flat[i-1];
    const cur=flat[i];
    let [h,m]=(prev.time||"00:00").split(":").map(Number);
    let dur=Number(prev.duration)||0;
    let total=h*60+m+dur;
    cur.time=`${String(Math.floor(total/60)).padStart(2,"0")}:${String(total%60).padStart(2,"0")}`;
  }
}

/* -----------------------------
   LOCAL STORAGE
--------------------------------*/
function saveLocal(){ try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){console.warn(e);} }
function loadLocal(){ try{ let raw=localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){} return null; }

/* -----------------------------
   BOUTONS
--------------------------------*/
saveBtn.addEventListener("click", ()=>{
  saveLocal(); saveBtn.textContent="Saved ✅";
  setTimeout(()=>saveBtn.textContent="Sauvegarder (local)",1200);
});

resetBtn.addEventListener("click", async ()=>{
  const server=await loadServer();
  if(server){
    planningData=server;
    localStorage.removeItem(PLANNING_KEY);
    populateWeekSelect();
    currentWeekIndex=0;
    renderWeek(0);
    alert("Planning réinitialisé depuis le serveur.");
  } else alert("Impossible de recharger planning.json");
});

/* -----------------------------
   PRÉSIDENT
--------------------------------*/
if(presidentInput){
  presidentInput.addEventListener("input",(ev)=>{
    const val=ev.target.value.trim();
    if(planningData && planningData.weeks && planningData.weeks[currentWeekIndex]){
      planningData.weeks[currentWeekIndex].chairman=val;
      dateDisplay.textContent=`${planningData.weeks[currentWeekIndex].date} — ${planningData.weeks[currentWeekIndex].scripture} — Председатель : ${val}`;
      const opt=weekSelect.querySelector(`option[value="${currentWeekIndex}"]`);
      if(opt) opt.textContent=`${planningData.weeks[currentWeekIndex].date} | ${planningData.weeks[currentWeekIndex].scripture} | ${val}`;
      saveLocal();
    }
  });
}

/* -----------------------------
   EXPORT PDF
--------------------------------*/
function exportPDF(){
  if(!planningData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});
  const pageWidth=doc.internal.pageSize.getWidth();
  const pageHeight=doc.internal.pageSize.getHeight();
  const margin=32, gap=18, colWidth=(pageWidth-margin*2-gap)/2, lineH=12;
  const timeW=50, durW=40, themeW=colWidth-timeW-durW-12;
  const colors=["#e6f7f5","#fff7e6","#fff1f2"];

  function renderWeek(x,y,week){
    let curY=y;
    doc.setFont("Helvetica","bold").setFontSize(11);
    doc.text(doc.splitTextToSize(planningData.title||"", colWidth), x, curY);
    curY+=lineH*2;

    doc.setFont("Helvetica","normal").setFontSize(10);
    doc.text(`${week.date} | ${week.scripture}`, x, curY); curY+=lineH;
    doc.text(`Председатель : ${week.chairman||""}`, x, curY); curY+=lineH+4;

    week.sections.forEach((sec,sidx)=>{
      if(sec.title){
        doc.setFont("Helvetica","bold").setFontSize(10);
        doc.text(sec.title + (sec.location?" — "+sec.location:""), x, curY); curY+=lineH;
      }

      sec.items.forEach(it=>{
        doc.setFillColor(colors[sidx%colors.length]);
        doc.rect(x-2, curY-2, colWidth, lineH, "F");

        doc.setFont("Helvetica","bold").setFontSize(9);
        doc.text(it.time||"", x, curY);

        const themeText=(it.part? it.part+" ":"")+ (it.theme||"");
        doc.setFont("Helvetica","normal");
        doc.text(doc.splitTextToSize(themeText, themeW), x+timeW, curY);

        const durText=it.duration? it.duration+" мин.":"";
        doc.text(durText, x+timeW+themeW, curY);

        if(it.person||it.note){
          doc.setFont("Helvetica","italic");
          const pn=[it.person||"", it.note||""].filter(Boolean).join(" — ");
          const pnLines=doc.splitTextToSize(pn, themeW+durW);
          doc.text(pnLines, x+timeW, curY+lineH);
          curY+=lineH*pnLines.length;
        }

        curY+=lineH;
        if(curY>pageHeight-margin){ doc.addPage(); curY=margin; }
      });

      curY+=6;
    });

    return curY;
  }

  for(let i=0;i<planningData.weeks.length;i+=2){
    if(i>0) doc.addPage();
    renderWeek(margin, margin, planningData.weeks[i]);
    if(planningData.weeks[i+1]) renderWeek(margin+colWidth+gap, margin, planningData.weeks[i+1]);
  }

  const pdfUrl=doc.output("bloburl");
  window.open(pdfUrl, "_blank");
}

pdfBtn.addEventListener("click", exportPDF);

/* -----------------------------
   CHANGE WEEK
--------------------------------*/
weekSelect.addEventListener("change", e=>{
  currentWeekIndex=Number(e.target.value);
  renderWeek(currentWeekIndex);
});

/* -----------------------------
   INIT
--------------------------------*/
(async function init(){
  planningData=loadLocal()||await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title="Planning TPL";
  populateWeekSelect();
  renderWeek(currentWeekIndex);
})();
