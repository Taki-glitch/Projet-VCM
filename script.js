/* script.js — Version avec Menu Action "+" pour Mobile */

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

  // Nouveaux éléments pour le menu mobile
  const fabToggle = document.getElementById("fabToggle");
  const buttonGroup = document.getElementById("buttonGroup");

  let planningData = null;
  let currentWeekIndex = 0;

  // Chemin local vers le fichier Roboto-Regular.ttf
  const ROBOTO_TTF_URL = "./Roboto-Regular.ttf"; 

  let ROBOTO_LOADED = false;
  let ROBOTO_BASE64 = null; 

  // --- GESTION DU MENU MOBILE "+" ---
  if (fabToggle && buttonGroup) {
    fabToggle.addEventListener("click", (e) => {
      e.stopPropagation(); // Empêche la fermeture immédiate via l'écouteur du document
      buttonGroup.classList.toggle("show");
      fabToggle.classList.toggle("active");
    });

    // Ferme le menu si on clique n'importe où ailleurs sur la page
    document.addEventListener("click", () => {
      buttonGroup.classList.remove("show");
      fabToggle.classList.remove("active");
    });
  }

  // --- Fonctions de base de données et chargement ---

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

  // --- Rendu et édition ---

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

      const isServingSkills = sec.title && sec.title.includes("ОТТАЧИВАЕМ"); 
      
      html += sec.items.map((it, itidx)=>{
        const fullTheme = it.part ? `${escapeHtml(it.part)} ${escapeHtml(it.theme)}` : escapeHtml(it.theme);
        let personContent = escapeHtml(it.person);
        let noteContent = escapeHtml(it.note||"");

        if (isServingSkills) {
            noteContent = noteContent.replace(/^Помощник :/, '').trim();
        }

        return `<div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
          <div class="time">${escapeHtml(it.time)}</div>
          <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">${fullTheme}</div>
          <div class="duration editable" contenteditable="true" data-field="duration" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.duration)}</div>
          <div class="personNoteContainer">
            <div class="person editable" contenteditable="true" data-field="person" data-section="${sidx}" data-item="${itidx}" data-role="${isServingSkills ? 'student' : ''}">${personContent}</div>
            <div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}" data-role="${isServingSkills ? 'assistant' : ''}">${noteContent}</div>
          </div>
        </div>`;
      }).join("");
    });

    planningContainer.innerHTML = html;

    planningContainer.querySelectorAll(".editable").forEach(el=>{
      el.addEventListener("input", onEdit);
      el.addEventListener("blur", saveLocal);
    });
    
    updateTimesInDOM(currentWeekIndex);
  }

  function onEdit(e){
    const el = e.target;
    const field = el.dataset.field;
    const sec = Number(el.dataset.section);
    const idx = Number(el.dataset.item);
    const item = planningData.weeks[currentWeekIndex].sections[sec].items[idx];
    let value = el.textContent.trim();

    if(field === "duration"){
      const num = value.match(/(\d+)/);
      item.duration = num ? Number(num[1]) : 0;
      recalcTimesForWeek(currentWeekIndex);
      updateTimesInDOM(currentWeekIndex);
      return;
    }
    
    const section = planningData.weeks[currentWeekIndex].sections[sec];
    const isServingSkills = section.title && section.title.includes("ОТТАЧИВАЕМ");

    if (field === "note" && isServingSkills) {
        item[field] = value ? `Помощник : ${value}` : "";
    } else {
        item[field] = value;
    }
  }
  
  function updateTimesInDOM(weekIndex){
    const week = planningData.weeks[weekIndex];
    if(!week) return;

    week.sections.forEach((sec, sidx) => {
        sec.items.forEach((item, itidx) => {
            const rowEl = planningContainer.querySelector(`.row[data-section="${sidx}"][data-item="${itidx}"]`);
            if (rowEl) {
                rowEl.querySelector(".time").textContent = escapeHtml(item.time);
            }
        });
    });
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

  // --- Sauvegarde et chargement local ---

  function saveLocal(){
    try{ localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData)); }catch(e){ console.warn(e); }
  }
  function loadLocal(){
    try{ let raw = localStorage.getItem(PLANNING_KEY); if(raw) return JSON.parse(raw); }catch(e){}
    return null;
  }

  saveBtn.addEventListener("click", ()=>{
    saveLocal();
    saveBtn.textContent = "Sauvegardé ✅";
    setTimeout(()=> saveBtn.textContent="Sauvegarder (local)", 1200);
  });

  resetBtn.addEventListener("click", async ()=>{
    const server = await loadServer();
    if(server){
      planningData = server;
      localStorage.removeItem(PLANNING_KEY);
      populateWeekSelect();
      currentWeekIndex = 0;
      recalcTimesForWeek(0); 
      renderWeek(0);
      alert("Planning réinitialisé depuis le serveur.");
    } else alert("Impossible de recharger planning.json");
  });

  weekSelect.addEventListener("change", e=>{
    currentWeekIndex = Number(e.target.value);
    recalcTimesForWeek(currentWeekIndex);
    renderWeek(currentWeekIndex);
  });

  changeChairmanBtn.addEventListener("click", ()=>{
    const week = planningData.weeks[currentWeekIndex];
    const newChair = prompt("Nom du Président :", week.chairman||"");
    if(newChair!==null){
      week.chairman = newChair;
      saveLocal();
      populateWeekSelect(); 
      renderWeek(currentWeekIndex);
    }
  });

  changeDateBtn.addEventListener("click", ()=>{
    const week = planningData.weeks[currentWeekIndex];
    const newDate = prompt("Nouvelle date :", week.date||"");
    if(newDate!==null){
      week.date = newDate;
      saveLocal();
      populateWeekSelect(); 
      renderWeek(currentWeekIndex);
    }
  });

  // --- Fonctions utilitaires ---
  
  function isMobileOrTablet() {
      return window.matchMedia("(max-width: 900px)").matches || 
             ('ontouchstart' in window) || 
             (navigator.maxTouchPoints > 0);
  }

  // --- PDF AVEC ROBOTO ---

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async function loadRobotoBase64(){ 
    if(ROBOTO_LOADED) return;
    ROBOTO_BASE64 = localStorage.getItem(FONT_KEY);
    if(!ROBOTO_BASE64){
      try {
        const resp = await fetch(ROBOTO_TTF_URL, {cache:"no-store"});
        if(!resp.ok) throw new Error("Erreur Roboto");
        const ab = await resp.arrayBuffer();
        ROBOTO_BASE64 = arrayBufferToBase64(ab);
        localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
      } catch(e){ throw e; }
    }
    ROBOTO_LOADED = true; 
  }
  
  pdfBtn.addEventListener("click", async () => {
      pdfBtn.textContent = "Génération PDF...";
      try {
          await loadRobotoBase64(); 
          exportPDF();
      } catch (e) {
          console.error(e);
          pdfBtn.textContent = "Erreur PDF";
      }
      pdfBtn.textContent = "Exporter PDF";
  });


  function exportPDF() {
    if (!planningData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    if(ROBOTO_LOADED && ROBOTO_BASE64){
        doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_BASE64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
    }

    const pageW = doc.internal.pageSize.getWidth();
    const marginLeft = 32, marginTop = 40;
    const midY = 450; 
    const lineY = midY - 12; 

    const timeWidth = 40, themeWidth = 260, roleWidth = 80, personWidth = 151;  
    const totalContentWidth = timeWidth + themeWidth + roleWidth + personWidth; 
    const lineHeight = 12; 
    const titleSpacing = 16, sectionSpacing = 12, itemSpacing = 2;
    const fontName = ROBOTO_LOADED ? "Roboto" : "helvetica";
    
    const SECTION_COLORS = [[220,237,245], [255,249,219], [255,224,230]];
    const MUTE_COLOR = [120, 120, 120];

    function renderWeekPDF(x, y, week, isSecondWeek) {
        let currentY = y;
        if (!isSecondWeek) {
            doc.setFont(fontName, "bold");
            doc.setFontSize(11);
            doc.text(planningData.title || "Planning TPL", x, currentY); 
            currentY += titleSpacing;
        } else { currentY += 4; }

        doc.setFont(fontName, "normal");
        doc.setFontSize(9);
        doc.text(`${week.date} | ${week.scripture}`, x, currentY); 
        
        doc.setFont(fontName, "bold");
        doc.text(`Председатель:`, x + timeWidth + themeWidth, currentY); 
        doc.text(week.chairman || "", x + totalContentWidth, currentY, {align: 'right'}); 
        currentY += 10;
        
        const introItems = week.sections[0] ? week.sections[0].items : [];
        if(introItems[0]) {
            const it = introItems[0];
            doc.setFont(fontName, "bold");
            doc.text(it.time, x, currentY);
            doc.setFont(fontName, "normal");
            doc.text(`${it.theme}`, x + timeWidth, currentY);
            if(it.person || it.role === "Молитва"){
                doc.text(it.role === "Молитва" ? "Молитва:" : "", x + timeWidth + themeWidth, currentY); 
                doc.setFont(fontName, "bold");
                doc.text(it.person || "", x + totalContentWidth, currentY, {align: 'right'}); 
            }
            currentY += lineHeight + 4;
        }
        
        if(introItems[1]) {
            const it = introItems[1];
            doc.setFont(fontName, "bold");
            doc.text(it.time, x, currentY);
            doc.setFont(fontName, "normal");
            doc.text(`${it.theme} (${it.duration} мин.)`, x + timeWidth, currentY);
            currentY += lineHeight + sectionSpacing;
        }

        week.sections.forEach((section, sIdx) => { 
            if (sIdx < 1) return; 
            if (section.title) {
                const color = SECTION_COLORS[(sIdx - 1) % SECTION_COLORS.length];
                doc.setFillColor(color[0], color[1], color[2]);
                doc.rect(x, currentY, totalContentWidth, 16, 'F');
                doc.setFont(fontName, "bold");
                doc.setFontSize(10);
                doc.text(section.title, x + timeWidth + 4, currentY + 11); 
                if(section.location) {
                    doc.setFont(fontName, "normal"); doc.setFontSize(8);
                    doc.text(`${section.location}`, x + totalContentWidth - 4, currentY + 11, {align: 'right'});
                }
                currentY += 16 + sectionSpacing;
            }
            
            section.items.forEach(item => {
                if (!item.person && !item.note) return;
                doc.setFontSize(9);
                let themeText = (item.theme || "") + (item.duration ? ` (${item.duration} мин.)` : "");
                let themeLines = doc.splitTextToSize(themeText, themeWidth);
                
                let primaryRole = item.role || "", primaryPerson = item.person || "";
                let secondaryRole = "", secondaryPerson = "", personLines = 1;
                let noteCleaned = item.note ? item.note.trim() : "";
                
                if (noteCleaned.includes("Помощник :")) {
                    primaryRole = "Учащийся:"; secondaryRole = "Помощник:";
                    secondaryPerson = noteCleaned.replace("Помощник :", "").trim();
                    personLines = 2;
                }

                const itemHeight = Math.max(lineHeight * themeLines.length, personLines * lineHeight);
                doc.setFont(fontName, "bold");
                doc.text(item.time || "", x, currentY); 
                doc.setFont(fontName, "normal");
                doc.text(themeLines, x + timeWidth, currentY);

                if (primaryRole || primaryPerson) {
                    doc.text(primaryRole, x + timeWidth + themeWidth, currentY);
                    doc.setFont(fontName, "bold");
                    doc.text(personLines === 1 && noteCleaned && !noteCleaned.includes("Учащийся") ? (primaryPerson + " — " + noteCleaned) : primaryPerson, x + totalContentWidth, currentY, {align:'right'});
                    if(secondaryRole){
                        doc.setFont(fontName, "normal");
                        doc.text(secondaryRole, x + timeWidth + themeWidth, currentY + lineHeight);
                        doc.setFont(fontName, "bold");
                        doc.text(secondaryPerson, x + totalContentWidth, currentY + lineHeight, {align:'right'});
                    }
                }
                currentY += itemHeight + itemSpacing; 
            });
            currentY += 4;
        });
        return currentY;
    }

    const weeks = planningData.weeks;
    for (let i = 0; i < weeks.length; i += 2) { 
        if (i > 0) doc.addPage();
        renderWeekPDF(marginLeft, marginTop, weeks[i], false); 
        if (weeks[i+1]) {
            doc.setLineWidth(0.5); doc.setDrawColor(180);
            doc.line(marginLeft, lineY, marginLeft + totalContentWidth, lineY); 
            renderWeekPDF(marginLeft, midY, weeks[i+1], true);
        }
    }

    const filename = `Planning_${planningData.title.replace(/\s/g, '_')}.pdf`;
    if (isMobileOrTablet()) {
        doc.save(filename);
    } else {
        const url = doc.output("bloburl");
        document.getElementById("pdfPreviewContainer").style.display = "block";
        document.getElementById("pdfPreview").src = url;
    }
  }

  /* ------------ INITIALISATION ------------ */
  planningData = loadLocal() || await loadServer();
  if(!planningData){ return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  planningData.weeks.forEach((w, i) => recalcTimesForWeek(i)); 
  populateWeekSelect();
  renderWeek(currentWeekIndex);

});
