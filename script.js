/* script.js — Version A4 FINAL avec boutons Président & Date + PDF Roboto (cached offline)
   --- Roboto est téléchargée la première fois, convertie en base64, et stockée dans localStorage.
   --- Les exports PDF suivants utilisent la police depuis localStorage, même offline.
*/

document.addEventListener("DOMContentLoaded", async () => {

  const PLANNING_KEY = "planning_tpl_full_v1";
  const FONT_KEY = "roboto_base64_v1";
  const weekSelect = document.getElementById("weekSelect");
  const planningContainer = document.getElementById("planning");
  const dateDisplay = document.getElementById("dateDisplay");
  const saveBtn = document.getElementById("saveBtn");
  const resetBtn = document.getElementById("resetBtn");
  const pdfBtn = document.getElementById("pdfBtn");
  const changeChairmanBtn = document.getElementById("changeChairmanBtn");
  const changeDateBtn = document.getElementById("changeDateBtn");

  let planningData = null;
  let currentWeekIndex = 0;

  const ROBOTO_TTF_URL = "https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf";

  let ROBOTO_LOADED = false;

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

  function saveLocal(){
    try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){ console.warn(e); }
  }
  function loadLocal(){
    try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return null;
  }

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

  weekSelect.addEventListener("change", e=>{
    currentWeekIndex = Number(e.target.value);
    renderWeek(currentWeekIndex);
  });

  changeChairmanBtn.addEventListener("click", ()=>{
    const week = planningData.weeks[currentWeekIndex];
    const newChair = prompt("Nom du Président :", week.chairman||"");
    if(newChair!==null){
      week.chairman = newChair;
      saveLocal();
      renderWeek(currentWeekIndex);
    }
  });

  changeDateBtn.addEventListener("click", ()=>{
    const week = planningData.weeks[currentWeekIndex];
    const newDate = prompt("Nouvelle date :", week.date||"");
    if(newDate!==null){
      week.date = newDate;
      saveLocal();
      renderWeek(currentWeekIndex);
    }
  });

  /* ------------------------------ PDF AVEC ROBOTO (cached) ------------------------------ */

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let result = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      result += String.fromCharCode.apply(null, chunk);
    }
    return btoa(result);
  }

  async function ensureRobotoLoaded(docInstance){
    if(ROBOTO_LOADED) return;

    let base64 = localStorage.getItem(FONT_KEY);
    if(!base64){
      try {
        const resp = await fetch(ROBOTO_TTF_URL, {cache:"no-store"});
        if(!resp.ok) throw new Error("Impossible de télécharger Roboto");
        const ab = await resp.arrayBuffer();
        base64 = arrayBufferToBase64(ab);
        localStorage.setItem(FONT_KEY, base64);
      } catch(e){
        console.error("Echec téléchargement Roboto:", e);
        throw e;
      }
    }

    docInstance.addFileToVFS("Roboto-Regular.ttf", base64);
    docInstance.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    ROBOTO_LOADED = true;
  }

  function exportPDF() {
  if (!planningData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginLeft = 32, marginTop = 40, colGap = 18, lineHeight = 12;
  const columnWidth = (doc.internal.pageSize.getWidth() - marginLeft * 2 - colGap) / 2;
  const timeWidth = 50, themeWidth = 230, durWidth = 40;
  const titleSpacing = 16, sectionSpacing = 12;

  // Charge la police Roboto (via vfs) pour jsPDF
  doc.addFileToVFS("Roboto-Regular.ttf", window.RobotoRegularBase64);
  doc.addFileToVFS("Roboto-Bold.ttf", window.RobotoBoldBase64);
  doc.addFileToVFS("Roboto-Italic.ttf", window.RobotoItalicBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
  doc.addFont("Roboto-Italic.ttf", "Roboto", "italic");

  function renderWeekPDF(x, y, week) {
    doc.setFont("Roboto", "bold");
    doc.setFontSize(11);
    doc.text(planningData.title || "Planning TPL", x, y); y += titleSpacing;

    doc.setFont("Roboto", "normal");
    doc.setFontSize(10);
    doc.text(`${week.date} | ${week.scripture}`, x, y); y += titleSpacing;
    doc.text(`Председатель : ${week.chairman || ""}`, x, y); y += titleSpacing;

    week.sections.forEach(section => {
      if (section.title) {
        doc.setFont("Roboto", "bold");
        doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(section.title + (section.location ? " — " + section.location : ""), x, y);
        y += sectionSpacing;
        doc.setTextColor(0);
      }

      section.items.forEach(item => {
        doc.setFont("Roboto", "bold");
        doc.setFontSize(9);
        doc.text(item.time || "", x, y);

        const part = item.part ? item.part + " " : "";
        const theme = part + (item.theme || "");
        doc.setFont("Roboto", "normal");
        doc.text(theme, x + timeWidth, y);

        const durText = item.duration ? item.duration + " мин." : "";
        doc.text(durText, x + timeWidth + themeWidth, y);

        y += lineHeight;

        if (item.person || item.note) {
          doc.setFont("Roboto", "italic");
          let line = item.person || "";
          if (item.note) line += (line ? " — " : "") + item.note;
          doc.text(line, x + timeWidth + 12, y);
          y += lineHeight;
        }

        y += 2;
      });
      y += 4;
    });
    return y;
  }

  const weeks = planningData.weeks;
  let yPos = marginTop;

  for (let i = 0; i < weeks.length; i += 2) {
    if (i > 0) doc.addPage();
    renderWeekPDF(marginLeft, yPos, weeks[i]);
    if (weeks[i + 1]) renderWeekPDF(marginLeft + columnWidth + colGap, yPos, weeks[i + 1]);
  }

  // Affichage dans l'iframe
  const url = doc.output("bloburl");
  const previewContainer = document.getElementById("pdfPreviewContainer");
  const previewIframe = document.getElementById("pdfPreview");
  previewContainer.style.display = "block";
  previewIframe.src = url;

  // Téléchargement direct
  doc.save(`Planning_${planningData.title || "TPL"}.pdf`);
}

  /* ------------ INITIALISATION ------------ */
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
