/* script.js — Version A4 avec Noto Sans (cyrillique), boutons Président/Date, édition locale, PDF propre */

document.addEventListener("DOMContentLoaded", async () => {

  const PLANNING_KEY = "planning_tpl_full_v1";

  // Police Noto Sans (avec cyrillique)
  const NOTO_FONT_KEY = "noto_sans_base64_v1";
  const NOTO_TTF_URL = "https://fonts.gstatic.com/s/notosans/v27/o-0NIpQlx3QUlC5A4PNr4A.ttf";

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

  /* ------------------------------ FONCTIONS UTILITAIRES ------------------------------ */

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

  /* ------------------------------ RENDU DU PLANNING ------------------------------ */

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

  /* ------------------------------ ÉDITION ET CALCULS ------------------------------ */

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

  /* ------------------------------ SAUVEGARDE LOCALE ------------------------------ */

  function saveLocal(){
    try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){ console.warn(e); }
  }

  function loadLocal(){
    try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return null;
  }

  /* ------------------------------ BOUTONS ------------------------------ */

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

  /* ------------------------------ NOTO SANS (CYRILLIQUE) ------------------------------ */

  function arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function ensureNotoLoaded(doc){
    let base64 = localStorage.getItem(NOTO_FONT_KEY);

    if(!base64){
      try {
        const resp = await fetch(NOTO_TTF_URL,{cache:"no-store"});
        const ab = await resp.arrayBuffer();
        base64 = arrayBufferToBase64(ab);
        localStorage.setItem(NOTO_FONT_KEY, base64);
      } catch(e){
        console.error("Erreur chargement Noto Sans", e);
        alert("Impossible de charger la police Noto Sans.");
        return false;
      }
    }

    doc.addFileToVFS("NotoSans-Regular.ttf", base64);
    doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
    return true;
  }

  /* ------------------------------ PDF CYRILLIQUE ------------------------------ */

  async function generatePDF() {
    const { jsPDF } = window.jspdf;

    const doc = new jsPDF({
      unit: "pt",
      format: "a4"
    });

    const ok = await ensureNotoLoaded(doc);
    if(!ok) return;

    doc.setFont("NotoSans", "normal");

    const marginLeft = 40;
    let cursorY = 40;

    const week = planningData.weeks[weekSelect.value];

    doc.setFontSize(18);
    doc.text(week.date, marginLeft, cursorY);
    cursorY += 22;

    doc.setFontSize(12);
    doc.text("Чтение: " + week.scripture, marginLeft, cursorY);
    cursorY += 18;

    doc.text("Председатель: " + week.chairman, marginLeft, cursorY);
    cursorY += 20;

    week.sections.forEach(section => {

      if(section.title){
        doc.setFontSize(14);
        doc.text(section.title + (section.location?" — "+section.location:""), marginLeft, cursorY);
        cursorY += 18;
      }

      const rows = section.items.map(item => [
        item.time || "",
        item.part || "",
        item.theme || "",
        item.duration || "",
        item.person || "",
        item.note || ""
      ]);

      doc.autoTable({
        startY: cursorY,
        margin: { left: marginLeft, right: marginLeft },
        styles: {
          font: "NotoSans",
          fontSize: 10,
          cellPadding: 4,
        },
        head: [["Heure","№","Thème","Durée","Personne","Note"]],
        body: rows,
        theme: "grid",
        headStyles: {
          fillColor: [230,230,230],
          textColor: 20,
        }
      });

      cursorY = doc.lastAutoTable.finalY + 20;
    });

    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  }

  pdfBtn.addEventListener("click", generatePDF);

  /* ------------------------------ INITIALISATION ------------------------------ */

  planningData = loadLocal() || await loadServer();
  if(!planningData){
    alert("Impossible de charger le planning");
    return;
  }

  if(!planningData.title) planningData.title = "Planning TPL";

  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
