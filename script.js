/* script.js — Version Complète avec Calculs, PDF A4 et Menu Flottant */

document.addEventListener("DOMContentLoaded", async () => {
  const PLANNING_KEY = "planning_vcm_full_v1";
  const FONT_KEY = "roboto_base64_v1";
  const ROBOTO_TTF_URL = "./Roboto-Regular.ttf";

  // Références aux éléments du DOM
  const elements = {
    weekSelect: document.getElementById("weekSelect"),
    planning: document.getElementById("planning"),
    dateDisplay: document.getElementById("dateDisplay"),
    fabToggle: document.getElementById("fabToggle"),
    buttonGroup: document.getElementById("buttonGroup"),
    pdfPreviewContainer: document.getElementById("pdfPreviewContainer"),
    pdfPreview: document.getElementById("pdfPreview")
  };

  let planningData = null;
  let currentWeekIndex = 0;
  let ROBOTO_BASE64 = localStorage.getItem(FONT_KEY);

  /* --- 1. GESTION DU MENU FLOTTANT --- */
  elements.fabToggle.onclick = (e) => {
    e.stopPropagation();
    elements.buttonGroup.classList.toggle("show");
    elements.fabToggle.classList.toggle("active");
  };

  // Ferme le menu si on clique ailleurs
  document.addEventListener("click", () => {
    elements.buttonGroup.classList.remove("show");
    elements.fabToggle.classList.remove("active");
  });

  /* --- 2. CHARGEMENT ET SAUVEGARDE --- */
  async function initApp() {
    const localData = localStorage.getItem(PLANNING_KEY);
    if (localData) {
      planningData = JSON.parse(localData);
    } else {
      try {
        const res = await fetch("planning.json", { cache: "no-store" });
        planningData = await res.json();
      } catch (e) {
        console.error("Erreur de chargement du fichier JSON", e);
        return;
      }
    }
    setupWeekSelect();
    renderWeek();
  }

  function saveLocal() {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData));
  }

  /* --- 3. LOGIQUE DE CALCUL DES HORAIRES --- */
  function recalcTimesForWeek(week) {
    let startTime = "19:00"; // Heure de début par défaut
    let [h, m] = startTime.split(":").map(Number);

    week.sections.forEach(sec => {
      sec.items.forEach(it => {
        // Assigner l'heure calculée à l'item
        it.time = `${h}:${m.toString().padStart(2, "0")}`;
        
        // Ajouter la durée pour l'item suivant
        let d = parseInt(it.duration) || 0;
        m += d;
        if (m >= 60) {
          h += Math.floor(m / 60);
          m %= 60;
        }
      });
    });
  }

  /* --- 4. RENDU DE L'INTERFACE --- */
  function setupWeekSelect() {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => 
      `<option value="${i}">${w.date}</option>`
    ).join("");

    elements.weekSelect.onchange = (e) => {
      currentWeekIndex = parseInt(e.target.value);
      renderWeek();
    };
  }

  window.renderWeek = () => {
    const week = planningData.weeks[currentWeekIndex];
    recalcTimesForWeek(week);
    
    // Mise à jour de l'en-tête de la semaine
    elements.dateDisplay.innerHTML = `
      <div class="main-date">${week.date}</div>
      <div class="sub-info">📖 ${week.scripture} | 👤 Président: ${week.chairman}</div>
    `;

    let html = "";
    week.sections.forEach((sec, sidx) => {
      if (sec.title) {
        html += `<div class="sectionTitle">${sec.title}</div>`;
      }
      sec.items.forEach((it, itidx) => {
        html += `
          <div class="row section-${(sidx % 3) + 1}">
            <div class="time">${it.time}</div>
            <div class="theme editable" contenteditable="true" onblur="updateField(${sidx},${itidx},'theme',this.textContent)">
              ${it.part ? '<strong>'+it.part+'</strong> ' : ''}${it.theme}
            </div>
            <div class="duration editable" contenteditable="true" onblur="updateDuration(${sidx},${itidx},this.textContent)">
              ${it.duration}
            </div>
            <div class="personNoteContainer">
              <div class="person editable" contenteditable="true" onblur="updateField(${sidx},${itidx},'person',this.textContent)">${it.person || ''}</div>
              <div class="note editable" contenteditable="true" onblur="updateField(${sidx},${itidx},'note',this.textContent)">${it.note || ''}</div>
            </div>
          </div>`;
      });
    });
    elements.planning.innerHTML = html;
  };

  /* --- 5. MISES À JOUR DES DONNÉES --- */
  window.updateField = (sidx, itidx, field, val) => {
    planningData.weeks[currentWeekIndex].sections[sidx].items[itidx][field] = val.trim();
    saveLocal();
  };

  window.updateDuration = (sidx, itidx, val) => {
    const num = parseInt(val) || 0;
    planningData.weeks[currentWeekIndex].sections[sidx].items[itidx].duration = num;
    saveLocal();
    renderWeek(); // On relance le rendu pour recalculer tous les horaires de la liste
  };

  /* --- 6. ACTIONS DU MENU --- */
  document.getElementById("changeChairmanBtn").onclick = () => {
    const val = prompt("Nom du Président :", planningData.weeks[currentWeekIndex].chairman);
    if (val !== null) {
      planningData.weeks[currentWeekIndex].chairman = val;
      saveLocal(); renderWeek();
    }
  };

  document.getElementById("changeScriptureBtn").onclick = () => {
    const val = prompt("Lecture de la semaine :", planningData.weeks[currentWeekIndex].scripture);
    if (val !== null) {
      planningData.weeks[currentWeekIndex].scripture = val;
      saveLocal(); renderWeek();
    }
  };

  document.getElementById("changeDateBtn").onclick = () => {
    const val = prompt("Date de la semaine :", planningData.weeks[currentWeekIndex].date);
    if (val !== null) {
      planningData.weeks[currentWeekIndex].date = val;
      saveLocal(); renderWeek();
    }
  };

  document.getElementById("saveBtn").onclick = () => {
    saveLocal();
    alert("Données sauvegardées localement !");
  };

  document.getElementById("resetBtn").onclick = async () => {
    if (confirm("Voulez-vous effacer vos modifications et recharger les données du serveur ?")) {
      localStorage.removeItem(PLANNING_KEY);
      location.reload();
    }
  };

  /* --- 7. LOGIQUE PDF --- */
  async function loadRoboto() {
    if (ROBOTO_BASE64) return;
    try {
      const resp = await fetch(ROBOTO_TTF_URL);
      const ab = await resp.arrayBuffer();
      const binary = String.fromCharCode(...new Uint8Array(ab));
      ROBOTO_BASE64 = btoa(binary);
      localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
    } catch (e) {
      alert("Erreur : Impossible de charger le fichier Roboto-Regular.ttf pour le PDF.");
    }
  }

  function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    if (ROBOTO_BASE64) {
      doc.addFileToVFS("Roboto.ttf", ROBOTO_BASE64);
      doc.addFont("Roboto.ttf", "Roboto", "normal");
      doc.setFont("Roboto");
    }

    const weeks = planningData.weeks;
    // On boucle par groupe de 2 semaines pour tenir sur une page A4
    for (let i = 0; i < weeks.length; i += 2) {
      if (i > 0) doc.addPage();
      
      // Semaine du haut
      renderWeekOnPDF(doc, 40, weeks[i]);
      
      // Semaine du bas (si elle existe)
      if (weeks[i + 1]) {
        doc.setDrawColor(200);
        doc.line(40, 415, 555, 415); // Ligne de séparation au milieu
        renderWeekOnPDF(doc, 430, weeks[i + 1]);
      }
    }

    const blobUrl = doc.output("bloburl");
    elements.pdfPreviewContainer.style.display = "block";
    elements.pdfPreview.src = blobUrl;
  }

  function renderWeekOnPDF(doc, startY, week) {
    let y = startY;
    recalcTimesForWeek(week);

    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text(week.date, 40, y);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`📖 ${week.scripture}  |  Председатель: ${week.chairman}`, 40, y + 15);
    
    y += 35;
    const col = { time: 40, theme: 85, dur: 340, pers: 400 };

    week.sections.forEach((sec, sIdx) => {
      const colors = [[230, 247, 245], [255, 247, 230], [255, 241, 242]];
      
      // Titre de section
      if (sec.title) {
        doc.setFillColor(240, 240, 240);
        doc.rect(40, y, 515, 15, 'F');
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text(sec.title.toUpperCase(), 45, y + 11);
        y += 15;
      }

      sec.items.forEach(it => {
        doc.setFillColor(...colors[sIdx % 3]);
        doc.rect(40, y, 515, 20, 'F');
        
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(it.time, col.time + 2, y + 13);
        
        let themeText = (it.part ? it.part + " " : "") + it.theme;
        let splitTheme = doc.splitTextToSize(themeText, 240);
        doc.text(splitTheme, col.theme, y + 13);
        
        doc.setFontSize(8);
        doc.text(`${it.duration} мин`, col.dur, y + 13);
        
        doc.setFontSize(9);
        doc.text(it.person || "", col.pers, y + 13);
        if (it.note) {
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(it.note, col.pers, y + 23);
        }

        y += (splitTheme.length > 1 ? 30 : 24);
      });
      y += 5;
    });
  }

  document.getElementById("pdfBtn").onclick = async () => {
    await loadRoboto();
    generatePDF();
  };

  // Lancement de l'application
  initApp();
});
