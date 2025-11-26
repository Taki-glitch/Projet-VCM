/* script.js — Version Révisée FINALE */

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

  // L'URL de la police Roboto-Regular pour le caching
  const ROBOTO_TTF_URL = "https://raw.githubusercontent.com/google/fonts/main/apache/roboto/Roboto-Regular.ttf";

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

    // Mise à jour de l'affichage en haut
    dateDisplay.textContent =
      `${week.date} — ${week.scripture} — Председатель : ${week.chairman}`;

    let html = "";

    week.sections.forEach((sec, sidx)=>{
      if(sec.title){
        html += `<div class="sectionTitle">${escapeHtml(sec.title)}${sec.location? " — "+escapeHtml(sec.location):""}</div>`;
      }

      html += sec.items.map((it, itidx)=>{
        const part = it.part ? `<span class="part">${escapeHtml(it.part)} </span>` : "";
        
        // CORRECTION: Séparation claire des champs "person" et "note" dans la structure HTML
        return `<div class="row section-${(sidx%4)+1}" data-section="${sidx}" data-item="${itidx}">
          <div class="time">${escapeHtml(it.time)}</div>
          <div class="theme editable" contenteditable="true" data-field="theme" data-section="${sidx}" data-item="${itidx}">${part}${escapeHtml(it.theme)}</div>
          <div class="duration editable" contenteditable="true" data-field="duration" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.duration)}</div>
          <div class="personNoteContainer">
            <div class="person editable" contenteditable="true" data-field="person" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.person)}</div>
            <div class="note editable" contenteditable="true" data-field="note" data-section="${sidx}" data-item="${itidx}">${escapeHtml(it.note||"")}</div>
          </div>
        </div>`;
      }).join("");
    });

    planningContainer.innerHTML = html;

    planningContainer.querySelectorAll(".editable").forEach(el=>{
      el.addEventListener("input", onEdit);
      el.addEventListener("blur", saveLocal);
    });
    
    // Rendu spécifique de l'heure après recalcul pour éviter le flash
    updateTimesInDOM(currentWeekIndex);
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
      // Mise à jour du modèle et du DOM uniquement pour les heures affectées
      recalcTimesForWeek(currentWeekIndex);
      updateTimesInDOM(currentWeekIndex);
      // On ne fait PAS de renderWeek pour préserver le focus
      return;
    }

    // CORRECTION: Si le champ édité est 'person' ou 'note', on le met à jour
    item[field] = value;
  }

  function updateTimesInDOM(weekIndex){
    const week = planningData.weeks[weekIndex];
    if(!week) return;

    // Itérer sur tous les éléments et mettre à jour leur affichage d'heure
    week.sections.forEach((sec, sidx) => {
        sec.items.forEach((item, itidx) => {
            const timeEl = planningContainer.querySelector(`.row[data-section="${sidx}"][data-item="${itidx}"] .time`);
            if (timeEl) {
                timeEl.textContent = escapeHtml(item.time);
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
      recalcTimesForWeek(0); // Recalcule les heures après le reset
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

  async function ensureRobotoLoaded(docInstance){
    if(ROBOTO_LOADED) return;
    if(ROBOTO_BASE64 === null) ROBOTO_BASE64 = localStorage.getItem(FONT_KEY);

    if(!ROBOTO_BASE64){
      try {
        console.log("Téléchargement de Roboto...");
        const resp = await fetch(ROBOTO_TTF_URL, {cache:"no-store"});
        if(!resp.ok) throw new Error("Impossible de télécharger Roboto");
        const ab = await resp.arrayBuffer();
        ROBOTO_BASE64 = arrayBufferToBase64(ab);
        localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
        console.log("Roboto téléchargée et mise en cache.");
      } catch(e){
        console.error("Échec téléchargement Roboto. Utilisation de la police par défaut.", e);
        // Lance une erreur pour bloquer le PDF si la police n'est pas disponible (cause de l'alerte)
        throw e; 
      }
    }
    
    // Ajoutez uniquement Roboto-Regular (pas Bold ni Italic car pas gérés)
    docInstance.addFileToVFS("Roboto-Regular.ttf", ROBOTO_BASE64);
    docInstance.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    ROBOTO_LOADED = true;
  }
  
  pdfBtn.addEventListener("click", async () => {
      pdfBtn.textContent = "Génération PDF...";
      try {
          // ÉTAPE 1: Assurer le chargement de la police (ou provoquer une erreur si échec)
          await ensureRobotoLoaded(window.jspdf.jsPDF.prototype);
          // ÉTAPE 2: Générer le PDF
          exportPDF();
      } catch (e) {
          // L'alerte se produit si ensureRobotoLoaded échoue
          console.error("Erreur lors de la génération PDF:", e);
          alert("Erreur lors de la préparation du PDF. Réessayez, ou vérifiez la connexion pour le téléchargement de la police.");
      }
      pdfBtn.textContent = "Exporter PDF";
  });


  function exportPDF() {
    if (!planningData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Paramètres de mise en page (A4: 595 x 842 pt)
    const pageW = doc.internal.pageSize.getWidth(); // 595
    const marginLeft = 32, marginTop = 40, colGap = 16;
    const columnWidth = (pageW - marginLeft * 2 - colGap) / 2; // 254.5
    const timeWidth = 40, durWidth = 36;
    const themeWidth = columnWidth - timeWidth - durWidth - 6; 
    const lineHeight = 12; 
    const titleSpacing = 16, sectionSpacing = 12, itemSpacing = 2;
    
    // Si Roboto est chargé, on l'utilise
    const fontName = ROBOTO_LOADED ? "Roboto" : "helvetica";
    
    // CORRECTION: Supprimer les lignes qui référencent des variables non définies (Bold/Italic)
    // doc.addFileToVFS("Roboto-Bold.ttf", window.RobotoBoldBase64); // SUPPRIMÉ
    // doc.addFileToVFS("Roboto-Italic.ttf", window.RobotoItalicBase64); // SUPPRIMÉ
    // doc.addFont("Roboto-Bold.ttf", "Roboto", "bold"); // SUPPRIMÉ
    // doc.addFont("Roboto-Italic.ttf", "Roboto", "italic"); // SUPPRIMÉ

    // Fonction d'affichage d'une seule semaine
    function renderWeekPDF(x, y, week) {
        let currentY = y;
        
        // --- Entête de la semaine ---
        
        // Titre de l'assemblée (en haut)
        doc.setFont(fontName, "bold");
        doc.setFontSize(11);
        doc.setTextColor(0); // Noir
        doc.text(planningData.title || "Planning TPL", x, currentY); 
        currentY += titleSpacing;

        // Date et Écriture
        doc.setFont(fontName, "normal");
        doc.setFontSize(9);
        doc.setTextColor(50); // Gris foncé
        doc.text(`${week.date} | ${week.scripture}`, x, currentY); 
        currentY += 10;
        
        // Président
        doc.setFont(fontName, "bold");
        doc.setTextColor(0);
        doc.text(`Председатель: ${week.chairman || ""}`, x, currentY); 
        currentY += 10;
        
        // --- Prière/Chant/Intro (Première section) ---
        // On traite les deux premiers éléments de la première section comme dans le PDF source

        if(week.sections[0] && week.sections[0].items[0]) {
            const item = week.sections[0].items[0];
            doc.setFont(fontName, "bold");
            doc.setFontSize(9);
            doc.text(item.time, x, currentY);
            
            doc.setFont(fontName, "normal");
            doc.text(`${item.theme} (${item.duration} мин.)`, x + timeWidth, currentY);
            currentY += lineHeight;
            
            // Personne/Rôle (au lieu de la note dans le PDF)
            doc.setFont(fontName, "normal");
            doc.text(item.role === "Молитва" ? "Молитва:" : "", x, currentY);
            doc.setFont(fontName, "bold");
            doc.text(item.person || "", x + timeWidth, currentY);
            currentY += lineHeight;
            currentY += 4; // Espace entre prière et intro
        }
        
        if(week.sections[0] && week.sections[0].items[1]) {
            const item = week.sections[0].items[1];
            doc.setFont(fontName, "bold");
            doc.setFontSize(9);
            doc.text(item.time, x, currentY);
            
            doc.setFont(fontName, "normal");
            doc.text(`${item.theme} (${item.duration} мин.)`, x + timeWidth, currentY);
            currentY += lineHeight;
            currentY += sectionSpacing;
        }

        // --- Sections suivantes ---
        
        week.sections.forEach((section, sIdx) => {
            if (sIdx < 2) return; // On a déjà géré la première section (et la deuxième est la première section titrée)
            
            // Titre de la section
            if (section.title) {
                doc.setFont(fontName, "bold");
                doc.setFontSize(10);
                doc.setTextColor(60); 
                doc.text(section.title + (section.location ? ` — ${section.location}` : ""), x, currentY);
                currentY += sectionSpacing;
                doc.setTextColor(0);
            }
            
            section.items.forEach(item => {
                // Vérifie si on a besoin de passer à la page suivante (pour éviter que la ligne soit coupée en bas)
                if (currentY + lineHeight * 3 > doc.internal.pageSize.getHeight() - 20) {
                    doc.addPage();
                    currentY = marginTop;
                }
                
                // Heure
                doc.setFont(fontName, "bold");
                doc.setFontSize(9);
                doc.text(item.time || "", x, currentY);

                // Thème
                doc.setFont(fontName, "normal");
                const part = item.part ? item.part + " " : "";
                let themeText = part + (item.theme || "");
                
                // Si le thème est trop long, on utilise splitTextToSize pour gérer la rupture de ligne
                let themeLines = doc.splitTextToSize(themeText, themeWidth);
                doc.text(themeLines, x + timeWidth, currentY);
                
                // Durée (à droite du thème, seule la première ligne si le thème est multiligne)
                const durText = item.duration ? `(${item.duration} мин.)` : "";
                doc.setFont(fontName, "bold"); 
                doc.text(durText, x + timeWidth + themeWidth + 4, currentY, {align: 'right'});
                
                currentY += lineHeight * themeLines.length;

                // Personne et Note (en italique ou juste personne)
                if (item.person || item.note) {
                    doc.setFont(fontName, "italic");
                    doc.setFontSize(9);
                    
                    let personText = item.person || "";
                    let roleText = "";
                    
                    if (item.note) {
                        // Logique pour extraire les rôles ou la note
                        if (item.note.includes("Помощник :")) {
                            roleText = "Помощник:";
                            personText = item.note.replace("Помощник :", "").trim();
                            // Si la personne est vide dans le modèle, elle était l'élève
                            if (item.person === "") {
                                roleText = "Учащийся \nПомощник:"; // comme dans le PDF source
                            }
                        } else if (item.note.includes("Ведущий/Чтец :")) {
                             roleText = "Ведущий/Чтец:";
                             personText = item.note.replace("Ведущий/Чтец :", "").trim();
                        } else if (item.note.includes("Учащийся")) {
                            roleText = "Учащийся:";
                        } else {
                            personText += (personText ? " — " : "") + item.note; // Note simple
                        }
                    } else if (item.role === "Молитва") {
                        roleText = "Молитва:";
                    }
                    
                    if(roleText) doc.text(roleText, x, currentY);
                    doc.text(personText, x + timeWidth, currentY); // Affiche la personne
                    
                    currentY += lineHeight;
                }
                currentY += itemSpacing;
            });
            currentY += 4; // Espacement fin de section
        });
        return currentY; // Retourne la position Y finale
    }

    const weeks = planningData.weeks;
    let yPos = marginTop;

    for (let i = 0; i < weeks.length; i += 2) {
        if (i > 0) doc.addPage();
        
        // Rendu de la semaine 1 (colonne de gauche)
        renderWeekPDF(marginLeft, yPos, weeks[i]);
        
        // Rendu de la semaine 2 (colonne de droite)
        if (weeks[i + 1]) {
            renderWeekPDF(marginLeft + columnWidth + colGap, yPos, weeks[i + 1]);
        }
    }

    // Affichage dans l'iframe
    const url = doc.output("bloburl");
    const previewContainer = document.getElementById("pdfPreviewContainer");
    const previewIframe = document.getElementById("pdfPreview");
    previewContainer.style.display = "block";
    previewIframe.src = url;

    // Téléchargement direct
    doc.save(`Planning_${planningData.title.replace(/\s/g, '_') || "TPL"}.pdf`);
  }

  /* ------------ INITIALISATION ------------ */
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  
  // Recalcule les heures au chargement pour s'assurer que les données locales sont cohérentes
  planningData.weeks.forEach((w, i) => recalcTimesForWeek(i)); 
  
  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
