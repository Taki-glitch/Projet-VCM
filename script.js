/* script.js — Version Finale Optimisée : Export PDF Modèle Décembre & Calculs Automatiques */

document.addEventListener("DOMContentLoaded", async () => {
  const PLANNING_KEY = "vcm_planning_data_v2";
  const FONT_KEY = "roboto_base64_v1";
  const ROBOTO_TTF_URL = "./Roboto-Regular.ttf";

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

  /* --- 1. INITIALISATION ET CHARGEMENT --- */
  async function initApp() {
    const localData = localStorage.getItem(PLANNING_KEY);
    if (localData) {
      planningData = JSON.parse(localData);
    } else {
      try {
        const res = await fetch("planning.json", { cache: "no-store" });
        planningData = await res.json();
      } catch (e) {
        alert("Erreur de chargement des données. Vérifiez planning.json.");
        return;
      }
    }
    setupWeekSelect();
    renderWeek();
  }

  function setupWeekSelect() {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => 
      `<option value="${i}">${w.date}</option>`
    ).join("");

    elements.weekSelect.onchange = (e) => {
      currentWeekIndex = parseInt(e.target.value);
      renderWeek();
    };
  }

  /* --- 2. CALCULS ET RENDU --- */
  function recalcTimesForWeek(week) {
    let [h, m] = [19, 0]; // Début à 19h00 par défaut
    week.sections.forEach(sec => {
      sec.items.forEach(it => {
        it.time = `${h}:${m.toString().padStart(2, "0")}`;
        let d = parseInt(it.duration) || 0;
        m += d;
        h += Math.floor(m / 60);
        m %= 60;
      });
    });
  }

  window.renderWeek = () => {
    const week = planningData.weeks[currentWeekIndex];
    recalcTimesForWeek(week);
    
    elements.dateDisplay.innerHTML = `
      <div class="date-main">${week.date}</div>
      <div class="date-sub">📖 ${week.scripture} | 👤 Председатель: ${week.chairman}</div>
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
            <div class="theme editable" contenteditable="true" onblur="updateField(${sidx},${itidx},'theme',this.innerText)">
              ${it.part ? '<strong>'+it.part+'</strong> ' : ''}${it.theme}
            </div>
            <div class="duration editable" contenteditable="true" onblur="updateDuration(${sidx},${itidx},this.innerText)">
              ${it.duration}
            </div>
            <div class="personNoteContainer">
              <div class="person editable" contenteditable="true" onblur="updateField(${sidx},${itidx},'person',this.innerText)">${it.person || ''}</div>
              <div class="note editable" contenteditable="true" onblur="updateField(${sidx},${itidx},'note',this.innerText)">${it.note || ''}</div>
            </div>
          </div>`;
      });
    });
    elements.planning.innerHTML = html;
  };

  /* --- 3. GESTION DES MODIFICATIONS --- */
  window.updateField = (sidx, itidx, field, val) => {
    planningData.weeks[currentWeekIndex].sections[sidx].items[itidx][field] = val.trim();
    saveLocal();
  };

  window.updateDuration = (sidx, itidx, val) => {
    planningData.weeks[currentWeekIndex].sections[sidx].items[itidx].duration = parseInt(val) || 0;
    saveLocal();
    renderWeek(); // Recalcul immédiat des horaires
  };

  function saveLocal() {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData));
  }

  /* --- 4. EXPORT PDF (Modèle 2 semaines par page) --- */
  async function loadRoboto() {
    if (ROBOTO_BASE64) return;
    try {
      const resp = await fetch(ROBOTO_TTF_URL);
      const ab = await resp.arrayBuffer();
      ROBOTO_BASE64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
    } catch (e) {
      alert("Erreur: Fichier Roboto-Regular.ttf manquant.");
    }
  }

  function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    if (ROBOTO_BASE64) {
      doc.addFileToVFS("Roboto.ttf", ROBOTO_BASE64);
      doc.addFont("Roboto.ttf", "Roboto", "normal");
      doc.setFont("Roboto");
    }

    const weeks = planningData.weeks;
    for (let i = 0; i < weeks.length; i += 2) {
      if (i > 0) doc.addPage();
      
      // Semaine 1 (Haut de page)
      drawWeekPDF(doc, 40, weeks[i]);
      
      // Semaine 2 (Bas de page)
      if (weeks[i + 1]) {
        doc.setDrawColor(220);
        doc.setLineDashPattern([5, 5], 0);
        doc.line(40, 415, 555, 415); // Ligne pointillée centrale
        doc.setLineDashPattern([], 0);
        drawWeekPDF(doc, 440, weeks[i + 1]);
      }
    }

    elements.pdfPreviewContainer.style.display = "block";
    elements.pdfPreview.src = doc.output("bloburl");
  }

  function drawWeekPDF(doc, startY, week) {
    let y = startY;
    recalcTimesForWeek(week);

    // En-tête (Style Nantes Russe)
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("НАНТ РУССКОЕ", 40, y);
    
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text(`${week.date} | ${week.scripture}`, 40, y + 18);
    
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Председатель: ${week.chairman}`, 40, y + 32);

    y += 50;
    const col = { time: 40, theme: 80, dur: 320, pers: 380 };

    week.sections.forEach((sec, sIdx) => {
      if (sec.title) {
        doc.setFontSize(8);
        doc.setTextColor(150, 0, 0); // Titre de section en bordeaux/gris foncé
        doc.text(sec.title.toUpperCase(), 40, y);
        y += 12;
      }

      sec.items.forEach(it => {
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(it.time, col.time, y);

        let fullTheme = (it.part ? it.part + " " : "") + it.theme;
        let splitTheme = doc.splitTextToSize(fullTheme, 230);
        doc.text(splitTheme, col.theme, y);

        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`${it.duration} мин`, col.dur, y);

        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(it.person || "", col.pers, y);
        
        if (it.note) {
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(it.note, col.pers, y + 10);
        }

        y += (splitTheme.length > 1 ? 28 : 22);
      });
      y += 5;
    });
  }

  /* --- 5. LOGIQUE DU MENU ET BOUTONS --- */
  elements.fabToggle.onclick = (e) => {
    e.stopPropagation();
    elements.buttonGroup.classList.toggle("show");
    elements.fabToggle.classList.toggle("active");
  };

  document.onclick = () => {
    elements.buttonGroup.classList.remove("show");
    elements.fabToggle.classList.remove("active");
  };

  document.getElementById("changeChairmanBtn").onclick = () => {
    const val = prompt("Председатель :", planningData.weeks[currentWeekIndex].chairman);
    if (val !== null) { planningData.weeks[currentWeekIndex].chairman = val; saveLocal(); renderWeek(); }
  };

  document.getElementById("changeDateBtn").onclick = () => {
    const val = prompt("Дата :", planningData.weeks[currentWeekIndex].date);
    if (val !== null) { planningData.weeks[currentWeekIndex].date = val; saveLocal(); renderWeek(); }
  };

  document.getElementById("changeScriptureBtn").onclick = () => {
    const val = prompt("Чтение Библии :", planningData.weeks[currentWeekIndex].scripture);
    if (val !== null) { planningData.weeks[currentWeekIndex].scripture = val; saveLocal(); renderWeek(); }
  };

  document.getElementById("pdfBtn").onclick = async () => {
    await loadRoboto();
    exportPDF();
  };

  document.getElementById("saveBtn").onclick = () => {
    saveLocal();
    alert("Сохранено локально!");
  };

  document.getElementById("resetBtn").onclick = async () => {
    if (confirm("Сбросить все изменения?")) {
      localStorage.removeItem(PLANNING_KEY);
      location.reload();
    }
  };

  initApp();
});
