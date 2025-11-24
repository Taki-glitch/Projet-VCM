/* script.js — Version A4 FINAL avec boutons Président & Date + PDF Roboto (chargée à la volée)
   --- Solution : fetch Roboto-Regular.ttf depuis le dépôt Google Fonts (raw github),
   convertir en base64 et l'ajouter au VFS de jsPDF avant génération du PDF.
   Avantage : pas de gros bloc base64 collé dans le fichier ; tout reste dans UN SEUL script.
*/

document.addEventListener("DOMContentLoaded", async () => {

  const PLANNING_KEY = "planning_tpl_full_v1";
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

  // --- Font loading cache
  let ROBOTO_LOADED = false;
  // URL to Roboto-Regular.ttf (raw GitHub google/fonts)
  const ROBOTO_TTF_URL = "https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf";

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

  /* ------------------------------ PDF AVEC ROBOTO (chargée dynamiquement) ------------------------------ */

  // util: convert ArrayBuffer -> base64 (chunked for large buffers)
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000; // 32KB
    let result = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      result += String.fromCharCode.apply(null, chunk);
    }
    return btoa(result);
  }

  // Charge Roboto TTF depuis ROBOTO_TTF_URL, convertit en base64 et l'ajoute au VFS de jsPDF
  async function ensureRobotoLoaded(docInstance){
    if(ROBOTO_LOADED) {
      // déjà chargé dans VFS
      try {
        // si la font n'existe pas encore parce qu'un autre doc a été utilisé, on tente d'ajouter quand même
        if(!docInstance.getFontList || !docInstance.getFontList().Roboto) {
          // si getFontList disponible, on vérifie et on tente d'ajouter à nouveau si besoin
          // (mais en pratique addFileToVFS est idempotent ici)
        }
      } catch(e){}
      return;
    }

    try {
      const resp = await fetch(ROBOTO_TTF_URL, {cache: "no-store"});
      if(!resp.ok) throw new Error("Impossible de télécharger Roboto depuis le serveur distant.");
      const ab = await resp.arrayBuffer();
      const base64 = arrayBufferToBase64(ab);
      // On ajoute la police au VFS
      docInstance.addFileToVFS("Roboto-Regular.ttf", base64);
      docInstance.addFont("Roboto-Regular.ttf", "Roboto", "normal");
      // On peut ajouter l'italic/ bold si nécessaire plus tard (avec les fichiers correspondants)
      ROBOTO_LOADED = true;
    } catch (err) {
      console.error("Echec chargement Roboto:", err);
      // On ne throw pas : on laisse jsPDF utiliser une police fallback (mais russe ne fonctionnera pas).
      throw err;
    }
  }

  // exportPDF devient async pour await la police
  async function exportPDF(){
    if(!planningData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({unit:"pt", format:"a4"});

    // Charger Roboto et l'enregistrer dans jsPDF VFS (s'il n'est pas déjà chargé)
    try {
      await ensureRobotoLoaded(doc);
      // définir la police
      doc.setFont("Roboto", "normal");
    } catch(e){
      // En cas d'erreur de téléchargement, on tombe sur une police par défaut.
      console.warn("Roboto non chargée — le PDF utilisera la police par défaut (risque de texte illisible pour cyrillique).");
    }

    const marginLeft = 32, marginTop = 40, colGap = 18, lineHeight = 10.5;
    const columnWidth = (doc.internal.pageSize.getWidth() - marginLeft*2 - colGap) / 2;
    const timeWidth = 50, themeWidth = 230, durWidth = 40;
    const titleSpacing = 14, sectionSpacing = 10;

    function renderWeekPDF(x, y, week){
      // Titre global
      try {
        doc.setFont("Roboto","bold");
      } catch(e){
        try { doc.setFont("Roboto","normal"); } catch(e){ doc.setFont("helvetica","bold"); }
      }
      doc.setFontSize(11);
      doc.text(planningData.title||"", x, y); y+=titleSpacing;

      // date / scripture / chairman
      try { doc.setFont("Roboto","normal"); } catch(e){ doc.setFont("helvetica","normal"); }
      doc.setFontSize(10);
      doc.text(`${week.date} | ${week.scripture}`, x, y); y+=titleSpacing;
      doc.text(`Председатель : ${week.chairman||""}`, x, y); y+=titleSpacing;

      week.sections.forEach(section=>{
        if(section.title){
          try { doc.setFont("Roboto","bold"); } catch(e){ doc.setFont("helvetica","bold"); }
          doc.setFontSize(10);
          doc.text(section.title + (section.location ? " — "+section.location : ""), x, y);
          y+=sectionSpacing;
        }
        section.items.forEach(item=>{
          try { doc.setFont("Roboto","bold"); } catch(e){ doc.setFont("helvetica","bold"); }
          doc.setFontSize(9);
          doc.text(item.time||"", x, y);

          const part = item.part ? item.part+" " : "";
          const theme = part + (item.theme||"");

          try { doc.setFont("Roboto","normal"); } catch(e){ doc.setFont("helvetica","normal"); }
          // text wrapping small helper (manual wrap if too long to fit column)
          const maxWidth = themeWidth;
          const splitTheme = doc.splitTextToSize(theme, maxWidth);
          doc.text(splitTheme, x + timeWidth, y);
          // splitTextToSize returns array; move y by number of lines * lineHeight
          y += lineHeight * splitTheme.length;

          const durText = item.duration ? (item.duration + " мин.") : "";
          doc.text(durText, x + timeWidth + maxWidth + 6, y - (lineHeight * splitTheme.length)); // align to first line of theme

          if(item.person || item.note){
            // writer for person/note on next line(s)
            let line = item.person || "";
            if(item.note) line += (line ? " — " : "") + item.note;
            try { doc.setFont("Roboto","italic"); } catch(e){ doc.setFont("helvetica","italic"); }
            const personLines = doc.splitTextToSize(line, columnWidth - timeWidth - 12);
            y += 4; // small gap
            doc.text(personLines, x + timeWidth + 12, y);
            y += lineHeight * personLines.length;
          }

          y += 4; // spacing after item
        });
        y += 6; // spacing after section
      });
      return y;
    }

    const weeks = planningData.weeks;
    for(let i=0; i<weeks.length; i+=2){
      if(i>0) doc.addPage();
      // left column
      renderWeekPDF(marginLeft, marginTop, weeks[i]);
      // right column if present - note: using same vertical start
      if(weeks[i+1]) renderWeekPDF(marginLeft + columnWidth + colGap, marginTop, weeks[i+1]);
    }

    const url = doc.output("bloburl");
    document.getElementById("pdfPreviewContainer").style.display = "block";
    document.getElementById("pdfPreview").src = url;
  }

  // bouton PDF : on attache la version async
  pdfBtn.addEventListener("click", ()=> {
    // appel non-blockant ; on gère erreurs à l'intérieur
    exportPDF().catch(e => {
      console.error("Erreur exportPDF:", e);
      alert("Erreur lors de la génération du PDF. Regarde la console pour plus de détails.");
    });
  });

  /* ------------ INITIALISATION ------------ */

  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";

  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
