/* script.js — Version Définitive : PDF 1 semaine/page, toutes les semaines, style VCM (Alignement Tableur - Champs séparés pour Учащийся/Помощник) */

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
  const changeScriptureBtn = document.getElementById("changeScriptureBtn");

  let planningData = null;
  let currentWeekIndex = 0;

  // Chemin local vers le fichier Roboto-Regular.ttf
  const ROBOTO_TTF_URL = "./Roboto-Regular.ttf"; 

  let ROBOTO_LOADED = false;
  let ROBOTO_BASE64 = null; // Variable pour stocker la base64

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

  function loadLocal() {
    try { 
      let raw = localStorage.getItem(PLANNING_KEY); 
      if(raw) return JSON.parse(raw); 
    } catch(e){}
    return null;
  }
  
  function populateWeekSelect(){
    weekSelect.innerHTML = "";
    planningData.weeks.forEach((w,i)=>{
      const opt = document.createElement("option");
      opt.value = i;
      // Affichage complet dans la liste déroulante
      opt.textContent = `${w.date} | ${w.scripture} | ${w.chairman}`; 
      weekSelect.appendChild(opt);
    });
    weekSelect.value = currentWeekIndex || 0;
  }

  // --- Rendu et édition ---

  function renderWeek(idx){
    currentWeekIndex = idx;
    const week = planningData.weeks[idx];
    if(!week) return;

    // Mise à jour de l'affichage du titre avec un formatage HTML plus riche
    let dateHtml = `<span style="font-size: 1.2em;">${escapeHtml(week.date)}</span><br>`;
    dateHtml += `<span style="font-weight: bold;">${escapeHtml(week.scripture || 'N/D')}</span> — Председатель: <span style="font-weight: bold;">${escapeHtml(week.chairman || 'N/D')}</span>`;
    dateDisplay.innerHTML = dateHtml;


    let html = "";

    week.sections.forEach((sec, sidx)=>{
      if(sec.title){
        html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location? " — "+escapeHtml(sec.location):""}</div>`;
      }

      // Détecter si c'est la section "ОТТАЧИВАЕМ НАВЫКИ СЛУЖЕНИЯ"
      const isServingSkills = sec.title && sec.title.includes("ОТТАЧИВАЕМ"); 
      
      html += sec.items.map((it, itidx)=>{
        const part = it.part ? `<span class="part">${escapeHtml(it.part)} </span>` : "";
        
        let personContent = escapeHtml(it.person);
        let noteContent = escapeHtml(it.note||"");

        // Gérer le rôle CSS pour l'assistant
        let noteRole = '';
        if (isServingSkills) {
            if (noteContent.includes("Помощник :")) {
                noteContent = noteContent.replace(/^Помощник :/, '').trim();
                noteRole = 'assistant';
            }
        }
        
        return `<div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
          <div class="time">${escapeHtml(it.time)}</div>
          <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">${part}${escapeHtml(it.theme)}</div>
          <div class="duration editable" contenteditable="true" data-field="duration" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.duration)}</div>
          <div class="personNoteContainer">
            <div class="person editable" contenteditable="true" data-field="person" data-section="${sidx}" data-item="${itidx}" data-role="${isServingSkills ? 'student' : ''}">${personContent}</div>
            <div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}" data-role="${noteRole}">${noteContent}</div>
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
    
    // Vérifier si la section est "ОТТАЧИВАЕМ" pour la gestion du champ "note" (Помощник)
    const section = planningData.weeks[currentWeekIndex].sections[sec];
    const isServingSkills = section.title && section.title.includes("ОТТАЧИВАЕМ");

    if (field === "note" && isServingSkills) {
        // Ajout du préfixe requis pour la logique PDF
        item[field] = value ? `Помощник : ${value}` : "";
        // Mise à jour immédiate du data-role pour le CSS
        el.dataset.role = value ? 'assistant' : ''; 
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
  
  // LOGIQUE DE MODIFICATION DE LA LECTURE DE LA BIBLE
  if (changeScriptureBtn) {
      changeScriptureBtn.addEventListener("click", () => {
        const week = planningData.weeks[currentWeekIndex];
        const newScripture = prompt("Nouvelle lecture (ex: ИСАЙЯ 3—5) :", week.scripture || "");
        
        if (newScripture !== null) {
          week.scripture = newScripture;
          saveLocal();              // Sauvegarde locale
          populateWeekSelect();     // Met à jour la liste déroulante
          renderWeek(currentWeekIndex); // Met à jour l'affichage principal
        }
      });
  }


  // --- PDF AVEC ROBOTO (cached) ---

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  async function loadRobotoBase64(){ 
    if(ROBOTO_LOADED) return;
    if(ROBOTO_BASE64 === null) ROBOTO_BASE64 = localStorage.getItem(FONT_KEY);

    if(!ROBOTO_BASE64){
      try {
        console.log("Téléchargement de Roboto...");
        const resp = await fetch(ROBOTO_TTF_URL, {cache:"no-store"});
        if(!resp.ok) throw new Error("Impossible de télécharger Roboto (Vérifiez la présence du fichier Roboto-Regular.ttf sur GitHub)");
        const ab = await resp.arrayBuffer();
        ROBOTO_BASE64 = arrayBufferToBase64(ab);
        localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
        console.log("Roboto téléchargée et mise en cache.");
      } catch(e){
        console.error("Échec téléchargement Roboto. Utilisation de la police par défaut.", e);
        throw e; 
      }
    }
    
    ROBOTO_LOADED = true; 
  }
  
  pdfBtn.addEventListener("click", async () => {
      pdfBtn.textContent = "Génération PDF...";
      try {
          await loadRobotoBase64(); 
          exportPDF();
      } catch (e) {
          console.error("Erreur lors de la préparation du PDF:", e);
          pdfBtn.textContent = "Erreur PDF";
          alert("Erreur lors de la préparation du PDF. Si le problème persiste, videz le cache Local Storage: (F12 > Application > Local Storage > Effacer l'entrée 'roboto_base64_v1').");
      }
      pdfBtn.textContent = "Exporter PDF";
  });


  function exportPDF() {
    if (!planningData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Enregistrement de la police sur l'instance 'doc' (si la Base64 est disponible)
    if(ROBOTO_LOADED && ROBOTO_BASE64){
        doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_BASE64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
        doc.addFont("Roboto-Regular.ttf", "Roboto", "italic");
    }

    const pageW = doc.internal.pageSize.getWidth(); // 595
    const marginLeft = 32, marginTop = 40;
    
    // Largeurs de colonnes
    const timeWidth = 40;     
    const themeWidth = 260;   
    const roleWidth = 80;     
    const personWidth = 151;  
    const totalContentWidth = timeWidth + themeWidth + roleWidth + personWidth; 

    const lineHeight = 12; 
    const titleSpacing = 16, sectionSpacing = 12, itemSpacing = 2;
    
    const fontName = ROBOTO_LOADED ? "Roboto" : "helvetica";
    
    // Couleurs pour les sections
    const SECTION_COLORS = [
        [230, 247, 245], 
        [255, 247, 230], 
        [255, 241, 242]  
    ];
    const MUTE_COLOR = [120, 120, 120]; 
    
    // Fonction d'affichage d'une seule semaine
    function renderWeekPDF(x, y, week) {
        let currentY = y;
        
        // --- Entête de la semaine ---
        
        // Titre de l'assemblée
        doc.setFont(fontName, "bold");
        doc.setFontSize(11);
        doc.setTextColor(0); 
        doc.text(planningData.title || "Planning TPL", x, currentY); 
        currentY += titleSpacing;

        // Date et Écriture
        doc.setFont(fontName, "normal");
        doc.setFontSize(9);
        doc.setTextColor(50); 
        doc.text(`${week.date} | ${week.scripture}`, x, currentY);
        
        // Président 
        doc.setFont(fontName, "bold");
        doc.setTextColor(0);
        doc.text(`Председатель:`, x + timeWidth + themeWidth, currentY); 
        doc.text(week.chairman || "", x + totalContentWidth, currentY, {align: 'right'}); 
        currentY += 10;
        
        // --- Prière/Chant/Intro ---

        const introItems = week.sections[0] ? week.sections[0].items : [];
        if(introItems[0] && introItems[0].time && introItems[0].theme) {
            const item = introItems[0];
            doc.setFont(fontName, "bold");
            doc.setFontSize(9);
            doc.text(item.time, x, currentY);
            
            doc.setFont(fontName, "normal");
            doc.text(`${item.theme}`, x + timeWidth, currentY);
            
            if(item.person || item.role === "Молитва"){
                doc.setFont(fontName, "normal");
                doc.text(item.role === "Молитва" ? "Молитва:" : "", x + timeWidth + themeWidth, currentY); 
                doc.setFont(fontName, "bold");
                doc.text(item.person || "", x + totalContentWidth, currentY, {align: 'right'}); 
                currentY += lineHeight;
                currentY += 4; 
            } else {
                currentY += lineHeight;
                currentY += 4;
            }
        }
        
        if(introItems[1] && introItems[1].time && introItems[1].theme) {
            const item = introItems[1];
            doc.setFont(fontName, "bold");
            doc.setFontSize(9);
            doc.text(item.time, x, currentY);
            
            doc.setFont(fontName, "normal");
            doc.text(`${item.theme} (${item.duration} мин.)`, x + timeWidth, currentY);
            currentY += lineHeight;
            currentY += sectionSpacing;
        }

        // --- Sections suivantes (avec fond coloré) ---
        
        week.sections.forEach((section, sIdx) => { 
            if (sIdx < 1) return; 
            
            // Titre de la section
            if (section.title) {
                const colorIndex = (sIdx - 1) % SECTION_COLORS.length;
                const bgColor = SECTION_COLORS[colorIndex];
                
                const boxHeight = 16; 
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(x, currentY, totalContentWidth, boxHeight, 'F');
                
                doc.setFont(fontName, "bold");
                doc.setFontSize(10);
                doc.setTextColor(60); 
                doc.text(section.title, x + timeWidth + 4, currentY + 11); 
                
                if(section.location) {
                    doc.setFont(fontName, "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(MUTE_COLOR[0], MUTE_COLOR[1], MUTE_COLOR[2]);
                    doc.text(`${section.location}`, x + totalContentWidth - 4, currentY + 11, {align: 'right'});
                }
                
                currentY += boxHeight;
                currentY += sectionSpacing;
                doc.setTextColor(0); 
            }
            
            section.items.forEach((item, itemIdx) => {
                
                // >>> DÉBUT DE LA LOGIQUE DE MASQUAGE CONDITIONNEL <<<
                // La section "ХРИСТИАНСКАЯ ЖИЗНЬ" est la 3e (index 2) ou la 4e (index 3) selon votre structure.
                // Basé sur votre planning.json (index 3), je cible l'index 3 (ХРИСТИАНСКАЯ ЖИЗНЬ)
                // et les items 1 ("8. Дополнительный доклад") et 2 ("10. Дополнительный разбор").

                // Vérifier si c'est la section "ХРИСТИАНСКАЯ ЖИЗНЬ" (index 3) et si l'item a un thème vide (ou seulement des espaces)
                if (sIdx === 3 && (itemIdx === 1 || itemIdx === 2) && !item.theme.trim()) {
                    // Si le thème est vide pour ces deux discours facultatifs, on ne dessine rien et on passe à l'élément suivant.
                    return; 
                }
                // >>> FIN DE LA LOGIQUE DE MASQUAGE CONDITIONNEL <<<

                // Heure
                doc.setFont(fontName, "bold");
                doc.setFontSize(9);
                doc.text(item.time || "", x, currentY);

                // Thème
                doc.setFont(fontName, "normal");
                const part = item.part ? item.part + " " : "";
                let themeText = part + (item.theme || "") + (item.duration ? ` (${item.duration} мин.)` : "");
                
                let themeLines = doc.splitTextToSize(themeText, themeWidth);
                doc.text(themeLines, x + timeWidth, currentY);
                
                currentY += lineHeight * themeLines.length;
                
                let lineY = currentY; 
                
                // LOGIQUE POUR GÉRER LES RÔLES/ASSISTANTS
                if (item.person || item.note || item.role) {
                    doc.setFontSize(9);
                    
                    let primaryRole = item.role || "";
                    let primaryPerson = item.person || "";
                    let secondaryRole = "";
                    let secondaryPerson = "";
                    let singleNote = "";

                    if (item.note) {
                        const noteCleaned = item.note.trim();
                        
                        if (noteCleaned.includes("Помощник :")) {
                            primaryRole = "Учащийся:"; 
                            primaryPerson = item.person; 
                            secondaryRole = "Помощник:";
                            secondaryPerson = noteCleaned.replace("Помощник :", "").trim();
                            
                        } else if (noteCleaned.includes("Ведущий/Чтец :")) {
                            primaryRole = "Ведущий/Чтец:"; 
                            primaryPerson = noteCleaned.replace("Ведущий/Чтец :", "").trim(); 
                            
                        } else if (noteCleaned.includes("Молитва :")) {
                            primaryRole = "Молитва:";
                            primaryPerson = item.person || noteCleaned.replace("Молитва :", "").trim();
                            
                        } else if (noteCleaned.includes("Учащийся")) {
                            primaryRole = "Учащийся:";
                        } else {
                            singleNote = (item.person || "") + (item.note ? ` — ${item.note}` : "");
                        }
                    } else if (primaryRole) {
                         primaryRole = primaryRole + ":";
                    } else if (item.person) {
                        singleNote = item.person; 
                    }
                    
                    // --- RENDU DE LA LIGNE PRIMAIRE ---
                    if(primaryRole || primaryPerson || singleNote) {
                        
                        if(singleNote) {
                            doc.setFont(fontName, "bold"); 
                            doc.text(singleNote, x + totalContentWidth, lineY, {align: 'right'});
                        } else {
                            if(primaryRole) {
                                doc.setFont(fontName, "normal"); 
                                doc.text(primaryRole, x + timeWidth + themeWidth, lineY); 
                            }
                            
                            if (primaryPerson) {
                                doc.setFont(fontName, "bold"); 
                                doc.text(primaryPerson, x + totalContentWidth, lineY, {align: 'right'}); 
                            }
                        }
                        lineY += lineHeight;
                    }
                    
                    // --- RENDU DE LA LIGNE SECONDAIRE (Assistant) ---
                    if(secondaryRole === "Помощник:"){
                         doc.setFont(fontName, "normal");
                         doc.text(secondaryRole, x + timeWidth + themeWidth, lineY); 
                         doc.setFont(fontName, "bold"); 
                         doc.text(secondaryPerson, x + totalContentWidth, lineY, {align: 'right'}); 
                         lineY += lineHeight;
                    }

                    currentY = lineY; 
                }
                currentY += itemSpacing;
            });
            currentY += 4; 
        });
        return currentY; 
    }

    // --- LOGIQUE DE GÉNÉRATION PDF : 1 SEMAINE PAR PAGE ---
    const weeks = planningData.weeks;
    const pageX = marginLeft; 

    for (let i = 0; i < weeks.length; i++) { 
        if (i > 0) doc.addPage();
        renderWeekPDF(pageX, marginTop, weeks[i]); 
    }

    // Affichage dans l'iframe
    const url = doc.output("bloburl");
    const previewContainer = document.getElementById("pdfPreviewContainer");
    const previewIframe = document.getElementById("pdfPreview");
    previewContainer.style.display = "block";
    previewIframe.src = url;
  }

  /* ------------ INITIALISATION ------------ */
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  
  planningData.weeks.forEach((w, i) => recalcTimesForWeek(i)); 
  
  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
