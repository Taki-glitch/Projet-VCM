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

      // Détecter si c'est la section "ОТТАЧИВАЕМ НАВЫКИ СЛУЖЕНИЯ"
      const isServingSkills = sec.title && sec.title.includes("ОТТАЧИВАЕМ"); 
      
      html += sec.items.map((it, itidx)=>{
        // --- MODIFICATION 1 (Numéro de discours dans le thème) ---
        // Si 'it.part' existe, on l'ajoute au thème pour qu'il soit éditable.
        const fullTheme = it.part ? `${escapeHtml(it.part)} ${escapeHtml(it.theme)}` : escapeHtml(it.theme);
        
        let personContent = escapeHtml(it.person);
        let noteContent = escapeHtml(it.note||"");

        // Si c'est la section "ОТТАЧИВАЕМ", on retire le préfixe "Помощник :" pour l'affichage,
        // car on le gère à la sauvegarde.
        if (isServingSkills) {
            noteContent = noteContent.replace(/^Помощник :/, '').trim();
        }

        // Nouvelle structure HTML pour le conteneur Personne/Note
        // Ajout de l'attribut data-role pour identifier les champs dans cette section
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
    
    // Vérifier si la section est "ОТТАЧИВАЕМ" pour la gestion du champ "note" (Помощник)
    const section = planningData.weeks[currentWeekIndex].sections[sec];
    const isServingSkills = section.title && section.title.includes("ОТТАЧИВАЕМ");

    if (field === "note" && isServingSkills) {
        // Si c'est le champ du Помощник et qu'il y a une valeur, on ajoute le préfixe 
        // requis par la logique PDF. Sinon, on enregistre une chaîne vide ("").
        item[field] = value ? `Помощник : ${value}` : "";
    } else {
        // Pour tous les autres champs (theme, duration, person), on enregistre la valeur telle quelle.
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
      // MODIFICATION 3 : Détection Mobile/Tablette pour adapter la sortie PDF
      // Basé sur la largeur d'écran ou la détection tactile
      return window.matchMedia("(max-width: 900px)").matches || 
             ('ontouchstart' in window) || 
             (navigator.maxTouchPoints > 0) || 
             (navigator.msMaxTouchPoints > 0);
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
    
    // NOUVELLES LARGEURS DE COLONNES pour calquer l'alignement du tableur:
    // Largeur totale utilisable: 531pt (Approximation des colonnes A->H)
    const timeWidth = 40;     // Colonne A (Heure)
    const themeWidth = 260;   // Colonne C (Thème/Part)
    const roleWidth = 80;     // Colonne F/G (Rôle/Sous-rôle)
    const personWidth = 151;  // Colonne G/H (Personne)
    const totalContentWidth = timeWidth + themeWidth + roleWidth + personWidth; // 531

    const lineHeight = 12; 
    const titleSpacing = 16, sectionSpacing = 12, itemSpacing = 2;
    
    const fontName = ROBOTO_LOADED ? "Roboto" : "helvetica";
    
    // Couleurs pour les sections (basé sur le modèle)
    const SECTION_COLORS = [
        [230, 247, 245], // Section 1: СОКРОВИЩА (Light Cyan/Green) 
        [255, 247, 230], // Section 2: ОТТАЧИВАЕМ (Light Yellow/Orange)
        [255, 241, 242]  // Section 3: ХРИСТИАНСКАЯ ЖИЗНЬ (Light Pink/Red)
    ];
    const MUTE_COLOR = [120, 120, 120]; // Gris foncé pour les sous-textes
    
    // Fonction d'affichage d'une seule semaine
    function renderWeekPDF(x, y, week) {
        let currentY = y;
        
        // --- Entête de la semaine (Aligné avec les colonnes du tableur) ---
        
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
        
        // Président (Aligné à droite de la ligne du titre, sur la colonne Rôle/Personne)
        doc.setFont(fontName, "bold");
        doc.setTextColor(0);
        doc.text(`Председатель:`, x + timeWidth + themeWidth, currentY); 
        doc.text(week.chairman || "", x + totalContentWidth, currentY, {align: 'right'}); 
        currentY += 10;
        
        // --- Prière/Chant/Intro (Première section) ---

        const introItems = week.sections[0] ? week.sections[0].items : [];
        if(introItems[0] && introItems[0].time && introItems[0].theme) {
            const item = introItems[0];
            doc.setFont(fontName, "bold");
            doc.setFontSize(9);
            // Colonne Heure
            doc.text(item.time, x, currentY);
            
            // Colonne Thème
            doc.setFont(fontName, "normal");
            // Retirer la durée du Chant (première ligne) pour correspondre au modèle tableur
            doc.text(`${item.theme}`, x + timeWidth, currentY);
            
            // Rôle et Personne (Priére, aligné sur les colonnes Rôle/Personne)
            if(item.person || item.role === "Молитва"){
                doc.setFont(fontName, "normal");
                // Colonne Rôle
                doc.text(item.role === "Молитва" ? "Молитва:" : "", x + timeWidth + themeWidth, currentY); 
                // Colonne Personne
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
            // Colonne Heure
            doc.text(item.time, x, currentY);
            
            // Colonne Thème + Durée
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
                
                // Dessiner le fond coloré
                const boxHeight = 16; 
                doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
                doc.rect(x, currentY, totalContentWidth, boxHeight, 'F');
                
                // Afficher le titre
                doc.setFont(fontName, "bold");
                doc.setFontSize(10);
                doc.setTextColor(60); 
                // Aligné avec la colonne Thème
                doc.text(section.title, x + timeWidth + 4, currentY + 11); 
                
                // Afficher la localisation (petit, aligné à droite de la zone)
                if(section.location) {
                    doc.setFont(fontName, "normal");
                    doc.setFontSize(8);
                    doc.setTextColor(MUTE_COLOR[0], MUTE_COLOR[1], MUTE_COLOR[2]);
                    doc.text(`${section.location}`, x + totalContentWidth - 4, currentY + 11, {align: 'right'});
                }
                
                currentY += boxHeight;
                currentY += sectionSpacing;
                doc.setTextColor(0); // Reset couleur texte principal
            }
            
            section.items.forEach(item => {
                
                // 🚨 LOGIQUE : SAUTER L'ÉLÉMENT SI AUCUNE PERSONNE N'EST ASSIGNÉE (pour 3 ou 4 discours)
                if (!item.person && !item.note) {
                    return; // Saute l'affichage de cet élément dans le PDF.
                }

                // Heure (Colonne A)
                doc.setFont(fontName, "bold");
                doc.setFontSize(9);
                doc.text(item.time || "", x, currentY);

                // Thème (Colonne C)
                doc.setFont(fontName, "normal");
                // Le thème est complet (avec le numéro tapé manuellement)
                let themeText = (item.theme || "") + (item.duration ? ` (${item.duration} мин.)` : "");

                let themeLines = doc.splitTextToSize(themeText, themeWidth);
                // Le texte du thème ne doit pas déborder sur la colonne Rôle/Personne
                doc.text(themeLines, x + timeWidth, currentY);
                
                currentY += lineHeight * themeLines.length;
                
                let lineY = currentY; // Position Y de la ligne Rôle/Personne
                
                // LOGIQUE POUR GÉRER LES RÔLES/ASSISTANTS (Aligné sur les colonnes F, G, H)
                if (item.person || item.note || item.role) {
                    doc.setFontSize(9);
                    
                    let primaryRole = item.role || "";
                    let primaryPerson = item.person || "";
                    let secondaryRole = "";
                    let secondaryPerson = "";

                    if (item.note) {
                        const noteCleaned = item.note.trim();
                        
                        if (noteCleaned.includes("Помощник :")) {
                            // Cas 1: Discours élève avec assistant (2 lignes)
                            primaryRole = "Учащийся:"; 
                            primaryPerson = item.person; 
                            secondaryRole = "Помощник:";
                            secondaryPerson = noteCleaned.replace("Помощник :", "").trim();
                            
                        } else if (noteCleaned.includes("Ведущий/Чтец :")) {
                            // Cas 2: Étude biblique de l'assemblée (1 ligne combinée)
                            primaryRole = "Ведущий/Чтец:"; 
                            primaryPerson = noteCleaned.replace("Ведущий/Чтец :", "").trim(); 
                            
                        } else if (item.role === "Молитва" || noteCleaned.includes("Молитва :")) {
                            // Cas 3: Prière (1 ligne)
                            primaryRole = "Молитва:";
                            primaryPerson = item.person || noteCleaned.replace("Молитва :", "").trim();
                            
                        } else if (noteCleaned.includes("Учащийся")) {
                            primaryRole = "Учащийся:";
                        } else {
                            // Simple note: combinée avec la personne pour alignement à droite (1 ligne)
                            primaryPerson = (item.person || "") + (item.note ? ` — ${item.note}` : "");
                        }
                    } else if (primaryRole) {
                         primaryRole = primaryRole + ":";
                    }
                    
                    // --- RENDU DE LA LIGNE PRIMAIRE (Élève/Conducteur/Personne principale) ---
                    if(primaryRole || primaryPerson) {
                        // Rendu du Rôle (Aligné sur la colonne F/G)
                        if(primaryRole) {
                            doc.setFont(fontName, "normal"); 
                            doc.text(primaryRole, x + timeWidth + themeWidth, lineY); 
                        }
                        
                        // Rendu de la Personne (Aligné sur la colonne H)
                        if (primaryPerson) {
                            doc.setFont(fontName, "bold"); 
                            doc.text(primaryPerson, x + totalContentWidth, lineY, {align: 'right'}); 
                        }
                        lineY += lineHeight;
                    }
                    
                    // --- RENDU DE LA LIGNE SECONDAIRE (Assistant) ---
                    if(secondaryRole === "Помощник:"){
                         // Rendu du Rôle Secondaire (Aligné sur la colonne F/G)
                         doc.setFont(fontName, "normal");
                         doc.text(secondaryRole, x + timeWidth + themeWidth, lineY); 
                         // Rendu de la Personne Secondaire (Aligné sur la colonne H)
                         doc.setFont(fontName, "bold"); 
                         doc.text(secondaryPerson, x + totalContentWidth, lineY, {align: 'right'}); 
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

    // --- LOGIQUE DE GÉNÉRATION PDF : 1 SEMAINE PAR PAGE ---
    const weeks = planningData.weeks;
    const pageX = marginLeft; 

    // Cette boucle va parcourir *toutes* les semaines disponibles, une par page
    for (let i = 0; i < weeks.length; i++) { 
        
        // Ajoute une nouvelle page si ce n'est PAS la toute première itération
        if (i > 0) doc.addPage();
        
        // Rendu de la semaine courante (en haut de la page, y=marginTop)
        renderWeekPDF(pageX, marginTop, weeks[i]); 
    }

    // --- MODIFICATION 4 : Gestion de la sortie PDF (Mobile vs Desktop) ---
    const filename = `Planning_${planningData.title.replace(/\s/g, '_') || "TPL"}.pdf`;
    const previewContainer = document.getElementById("pdfPreviewContainer");
    
    if (isMobileOrTablet()) {
        // SUR MOBILE/TABLETTE: Tenter le téléchargement direct
        doc.save(filename);
        
        // Cacher la prévisualisation (qui cause des problèmes sur mobile)
        previewContainer.style.display = "none";
        
    } else {
        // SUR ORDINATEUR (Desktop): Utiliser l'iFrame pour la prévisualisation
        const url = doc.output("bloburl");
        const previewIframe = document.getElementById("pdfPreview");
        
        previewContainer.style.display = "block";
        previewIframe.src = url;

        // Optionnel: Pour avoir un bouton de téléchargement séparé sur Desktop si la prévisualisation ne suffit pas.
        // doc.save(filename); 
    }
  }

  /* ------------ INITIALISATION ------------ */
  planningData = loadLocal() || await loadServer();
  if(!planningData){ alert("Impossible de charger le planning"); return; }
  if(!planningData.title) planningData.title = "Planning TPL";
  
  planningData.weeks.forEach((w, i) => recalcTimesForWeek(i)); 
  
  populateWeekSelect();
  renderWeek(currentWeekIndex);

}); // DOMContentLoaded
