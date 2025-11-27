/* script.js — Version Définitive : PDF 2 semaines/page, toutes les semaines, style VCM */

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

      html += sec.items.map((it, itidx)=>{
        const part = it.part ? `<span class="part">${escapeHtml(it.part)} </span>` : "";
        
        // Nouvelle structure HTML pour le conteneur Personne/Note
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

    item[field] = value;
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
    
    // Marque la police comme chargée (la Base64 est prête à être utilisée)
    ROBOTO_LOADED = true; 
  }
  
  pdfBtn.addEventListener("click", async () => {
      pdfBtn.textContent = "Génération PDF...";
      try {
          // Étape 1 : S'assurer que les données Base64 de la police sont chargées ou en cache
          await loadRobotoBase64(); 

          // Étape 2 : Générer le PDF
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
        // Ajout de Roboto-Regular
        doc.addFileToVFS("Roboto-Regular.ttf", ROBOTO_BASE64);
        doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
        
        // Ajout d'alias pour les styles Bold et Italic pointant vers la police Regular
        doc.addFont("Roboto-Regular.ttf", "Roboto", "bold");
        doc.addFont("Roboto-Regular.ttf", "Roboto", "italic");
    }

    // Paramètres de mise en page (A4: 595 x 842 pt)
    const pageW = doc.internal.pageSize.getWidth(); // 595
    const marginLeft = 32, marginTop = 40;
    
    // Utilise la largeur de la page entière (simple colonne) pour correspondre au modèle aéré
    const columnWidth = (pageW - marginLeft * 2); // Largeur de colonne (~531) 
    
    // Découpage interne de la zone de texte du planning
    const timeWidth = 40, durWidth = 36;
    const themeWidth = columnWidth - timeWidth - durWidth - 6; 
    const lineHeight = 12; 
    const titleSpacing = 16, sectionSpacing = 12, itemSpacing = 2;
    
    const fontName = ROBOTO_LOADED ? "Roboto" : "helvetica";
    
    // Couleurs pour les sections (basé sur le modèle)
    const SECTION_COLORS = [
        [230, 247, 245], // Section 1: СОКРОВИЩА (Light Cyan/Green) - COULEURS DU MODÈLE
        [255, 247, 230], // Section 2: ОТТАЧИВАЕМ (Light Yellow/Orange) - COULEURS DU MODÈLE
        [255, 241, 242]  // Section 3: ХРИСТИАНСКАЯ ЖИЗНЬ (Light Pink/Red) - COULEURS DU MODÈLE
    ];
    const MUTE_COLOR = [120, 120, 120]; // Gris foncé pour les sous-textes
    
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
        currentY += 10;
        
        // Président (Aligné à droite de la colonne)
        doc.setFont(fontName, "bold");
        doc.setTextColor(0);
        doc.text(`Председатель:`, x, currentY);
        doc.text(week.chairman || "", x + columnWidth, currentY, {align: 'right'}); 
        currentY += 10;
        
        // --- Prière/Chant/Intro (Première section) ---

        const introItems = week.sections[0] ? week.sections[0].items : [];
        if(introItems[0] && introItems[0].time && introItems[0].theme) {
            const item = introItems[0];
            doc.setFont(fontName, "bold");
            doc.setFontSize(9);
            doc.text(item.time, x, currentY);
            
            doc.setFont(fontName, "normal");
            // CHANGEMENT: Retirer la durée du thème du Chant pour correspondre au modèle PDF
            doc.text(`${item.theme}`, x + timeWidth, currentY);
            
            // Rôle et Personne (aligné à droite) - Affiché sur la ligne suivante pour la prière
            if(item.person || item.role === "Молитва"){
                currentY += lineHeight; // Nouvelle ligne pour la personne
                doc.setFont(fontName, "normal");
                doc.text(item.role === "Молитва" ? "Молитва:" : "", x, currentY);
                doc.setFont(fontName, "bold");
                doc.text(item.person || "", x + columnWidth, currentY, {align: 'right'});
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
        
        // On commence à la section 1 
        week.sections.forEach((section, sIdx) => { 
            if (sIdx < 1) return; 
            
            // Titre de la section
            if (section.title) {
                // Définir la couleur de fond
                const colorIndex = (sIdx - 1) % SECTION_COLORS.length;
                const bgColor = SECTION_COLORS[colorIndex];
                
                // Dessiner le fond coloré (COUPE LA ZONE DE TEXTE)
                const boxHeight = 16; 
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(x, currentY, columnWidth, boxHeight, 'F');
                
                // Afficher le titre
                doc.setFont(fontName, "bold");
                doc.setFontSize(10);
                doc.setTextColor(60); 
                doc.text(section.title, x + 4, currentY + 11); // Légère indentation et ajustement Y
                
                // Afficher la localisation (petit, aligné à droite de la zone)
                if(section.location) {
                    doc.setFont(fontName, "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(MUTE_COLOR[0], MUTE_COLOR[1], MUTE_COLOR[2]);
                    doc.text(`${section.location}`, x + columnWidth - 4, currentY + 11, {align: 'right'});
                }
                
                currentY += boxHeight;
                currentY += sectionSpacing;
                doc.setTextColor(0); // Reset couleur texte principal
            }
            
            section.items.forEach(item => {
                
                // Heure
                doc.setFont(fontName, "bold");
                doc.setFontSize(9);
                doc.text(item.time || "", x, currentY);

                // Thème
                doc.setFont(fontName, "normal");
                const part = item.part ? item.part + " " : "";
                let themeText = part + (item.theme || "");
                
                let themeLines = doc.splitTextToSize(themeText, themeWidth);
                doc.text(themeLines, x + timeWidth, currentY);
                
                // Durée (Alignée à droite de la colonne de durée)
                const durText = item.duration ? `(${item.duration} мин.)` : "";
                doc.setFont(fontName, "normal"); 
                doc.text(durText, x + timeWidth + themeWidth + durWidth - 6, currentY, {align: 'right'});
                
                currentY += lineHeight * themeLines.length;
                
                let lineY = currentY; // Position Y de la ligne Rôle/Personne
                
                // NOUVELLE LOGIQUE POUR GÉRER LES RÔLES/ASSISTANTS (pour correspondre au modèle)
                if (item.person || item.note || item.role) {
                    doc.setFontSize(9);
                    
                    let primaryRole = item.role || "";
                    let primaryPerson = item.person || "";
                    let secondaryRole = "";
                    let secondaryPerson = "";

                    if (item.note) {
                        const noteCleaned = item.note.trim();
                        
                        if (noteCleaned.includes("Помощник :")) {
                            // Case 1: Serving Skills talk with an assistant (2 lines output)
                            primaryRole = "Учащийся:"; 
                            primaryPerson = item.person; 
                            secondaryRole = "Помощник:";
                            secondaryPerson = noteCleaned.replace("Помощник :", "").trim();
                            
                        } else if (noteCleaned.includes("Ведущий/Чтец :")) {
                            // Case 2: Congregation Bible Study (1 combined line output)
                            primaryRole = "Ведущий/Чтец:"; 
                            primaryPerson = noteCleaned.replace("Ведущий/Чтец :", "").trim(); 
                            
                        } else if (item.role === "Молитва" || noteCleaned.includes("Молитва :")) {
                            // Case 3: Prayer (1 line output)
                            primaryRole = "Молитва:";
                            primaryPerson = item.person || noteCleaned.replace("Молитва :", "").trim();
                            
                        } else if (noteCleaned.includes("Учащийся")) {
                            primaryRole = "Учащийся:";
                        } else {
                            // Simple note: combine it with person for right alignment (1 line output)
                            primaryPerson = (item.person || "") + (item.note ? ` — ${item.note}` : "");
                        }
                    } else if (primaryRole) {
                         primaryRole = primaryRole + ":";
                    }
                    
                    // --- RENDER PRIMARY LINE (Student/Conductor/Main Person) ---
                    if(primaryRole || primaryPerson) {
                        // Rendu du Rôle (aligné à gauche)
                        if(primaryRole) {
                            doc.setFont(fontName, "normal"); 
                            doc.text(primaryRole, x, lineY); 
                        }
                        
                        // Rendu de la Personne (aligné à droite de la colonne)
                        if (primaryPerson) {
                            doc.setFont(fontName, "bold"); 
                            doc.text(primaryPerson, x + columnWidth, lineY, {align: 'right'}); 
                        }
                        lineY += lineHeight;
                    }
                    
                    // --- RENDER SECONDARY LINE (Assistant) ---
                    if(secondaryRole === "Помощник:"){
                         doc.setFont(fontName, "normal");
                         doc.text(secondaryRole, x, lineY); 
                         doc.setFont(fontName, "bold"); 
                         doc.text(secondaryPerson, x + columnWidth, lineY, {align: 'right'}); 
                         lineY += lineHeight;
                    }

                    currentY = lineY; 
                }
                currentY += itemSpacing;
            });
            currentY += 4; // Espacement fin de section
        });
        return currentY; // Retourne la position Y finale
    }

    // --- LOGIQUE DE GÉNÉRATION PDF : 2 SEMAINES PAR PAGE (selon le modèle PDF) ---
    const weeks = planningData.weeks;
    const pageX = marginLeft; 
    const secondWeekY = 430; // Position Y pour la deuxième semaine (pour A4)

    // Cette boucle va parcourir *toutes* les semaines disponibles par paires
    for (let i = 0; i < weeks.length; i += 2) { 
        
        // Ajoute une nouvelle page si ce n'est PAS la toute première itération
        if (i > 0) doc.addPage();
        
        // Rendu de la PREMIÈRE semaine (Haut de page, y=marginTop)
        renderWeekPDF(pageX, marginTop, weeks[i]); 
        
        // Rendu de la DEUXIÈME semaine (Bas de page, y=secondWeekY) si elle existe
        if (weeks[i + 1]) {
            renderWeekPDF(pageX, secondWeekY, weeks[i + 1]); 
        }
    }

    // Affichage dans l'iframe
    const url = doc.output("bloburl");
    const previewContainer = document.getElementById("pdfPreviewContainer");
    const previewIframe = document.getElementById("pdfPreview");
    previewContainer.style.display = "block";
    previewIframe.src = url;

    // Téléchargement direct (COMMENTÉ POUR NE FAIRE QUE LA PRÉVISUALISATION)
    // doc.save(`Planning_${planningData.title.replace(/\s/g, '_') || "TPL"}.pdf`);
  }

  /* ------------ INITIALISATION ------------ */
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  
  planningData.weeks.forEach((w, i) => recalcTimesForWeek(i)); 
  
  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
