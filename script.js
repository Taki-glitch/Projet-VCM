/* script.js — Version avec Style PDF Restauré et Menu Flottant */

document.addEventListener("DOMContentLoaded", async () => {
  const PLANNING_KEY = "planning_tpl_full_v1";
  const FONT_KEY = "roboto_base64_v1";
  const ROBOTO_TTF_URL = "./Roboto-Regular.ttf";

  const elements = {
    weekSelect: document.getElementById("weekSelect"),
    planning: document.getElementById("planning"),
    dateDisplay: document.getElementById("dateDisplay"),
    fabToggle: document.getElementById("fabToggle"),
    buttonGroup: document.getElementById("buttonGroup")
  };

  let planningData = null;
  let currentWeekIndex = 0;
  let ROBOTO_BASE64 = localStorage.getItem(FONT_KEY);

  // --- LOGIQUE DU MENU ---
  elements.fabToggle.onclick = (e) => {
    e.stopPropagation();
    elements.buttonGroup.classList.toggle("show");
    elements.fabToggle.classList.toggle("active");
  };

  document.onclick = () => {
    elements.buttonGroup.classList.remove("show");
    elements.fabToggle.classList.remove("active");
  };

  // --- CHARGEMENT ---
  async function loadData() {
    const local = localStorage.getItem(PLANNING_KEY);
    if (local) return JSON.parse(local);
    try {
      const res = await fetch("planning.json", { cache: "no-store" });
      return await res.json();
    } catch (e) { return null; }
  }

  function saveLocal() {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData));
  }

  // --- RENDU ET CALCULS ---
  function recalcTimes() {
    planningData.weeks.forEach((week) => {
      let flat = [];
      week.sections.forEach(s => s.items.forEach(it => flat.push(it)));
      for (let i = 1; i < flat.length; i++) {
        let [h, m] = flat[i - 1].time.split(":").map(Number);
        let total = h * 60 + m + (parseInt(flat[i - 1].duration) || 0);
        flat[i].time = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
      }
    });
  }

  window.updateData = (s, i, field, val) => {
    planningData.weeks[currentWeekIndex].sections[s].items[i][field] = val;
    saveLocal();
  };

  window.updateDuration = (s, i, val) => {
    planningData.weeks[currentWeekIndex].sections[s].items[i].duration = parseInt(val) || 0;
    recalcTimes();
    renderWeek();
    saveLocal();
  };

  function renderWeek() {
    const week = planningData.weeks[currentWeekIndex];
    elements.dateDisplay.textContent = `${week.date} — Председатель: ${week.chairman}`;
    let html = "";
    week.sections.forEach((sec, sidx) => {
      if (sec.title) html += `<div class="sectionTitle">${sec.title}</div>`;
      sec.items.forEach((it, itidx) => {
        html += `
          <div class="row section-${(sidx % 3) + 1}">
            <div class="time">${it.time}</div>
            <div class="theme editable" contenteditable="true" oninput="updateData(${sidx},${itidx},'theme',this.textContent)">${it.part ? it.part + ' ' : ''}${it.theme}</div>
            <div class="duration editable" contenteditable="true" oninput="updateDuration(${sidx},${itidx},this.textContent)">${it.duration}</div>
            <div class="personNoteContainer">
              <div class="person editable" contenteditable="true" oninput="updateData(${sidx},${itidx},'person',this.textContent)">${it.person || ''}</div>
              <div class="note editable" contenteditable="true" oninput="updateData(${sidx},${itidx},'note',this.textContent)">${it.note || ''}</div>
            </div>
          </div>`;
      });
    });
    elements.planning.innerHTML = html;
  }

  // --- LOGIQUE PDF (STYLE RESTAURÉ) ---
  async function loadRoboto() {
    if (ROBOTO_BASE64) return;
    const resp = await fetch(ROBOTO_TTF_URL);
    const ab = await resp.arrayBuffer();
    ROBOTO_BASE64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
    localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
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
      drawWeekPDF(doc, weeks[i], 40); // Première semaine en haut
      if (weeks[i + 1]) {
        doc.setDrawColor(200);
        doc.line(40, 415, 555, 415); // Ligne de séparation
        drawWeekPDF(doc, weeks[i + 1], 435); // Deuxième semaine en bas
      }
    }

    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      doc.save("planning_vcm.pdf");
    } else {
      document.getElementById("pdfPreviewContainer").style.display = "block";
      document.getElementById("pdfPreview").src = doc.output("bloburl");
    }
  }

  function drawWeekPDF(doc, week, startY) {
    let y = startY;
    
    // Titre et En-tête
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(week.date, 40, y);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`${week.scripture}  |  Председатель: ${week.chairman}`, 40, y + 15);
    
    y += 30;

    // Tableau
    week.sections.forEach((sec, sIdx) => {
      // Titre de section (optionnel)
      if (sec.title) {
        doc.setFillColor(240);
        doc.rect(40, y, 515, 15, 'F');
        doc.setFontSize(8);
        doc.setTextColor(50);
        doc.text(sec.title.toUpperCase(), 45, y + 10);
        y += 15;
      }

      sec.items.forEach(it => {
        doc.setFontSize(9);
        doc.setTextColor(0);
        
        // Colonne Temps
        doc.text(it.time, 40, y + 10);
        
        // Colonne Thème (avec retour à la ligne automatique)
        let themeText = (it.part ? it.part + " " : "") + it.theme;
        let splitTheme = doc.splitTextToSize(themeText, 250);
        doc.text(splitTheme, 85, y + 10);
        
        // Colonne Durée
        doc.text(`${it.duration} мин`, 345, y + 10);
        
        // Colonne Personne
        doc.setFont(undefined, 'bold');
        doc.text(it.person || "", 400, y + 10);
        doc.setFont(undefined, 'normal');
        
        // Note en dessous du nom
        if (it.note) {
          doc.setFontSize(7);
          doc.setTextColor(120);
          doc.text(it.note, 400, y + 18);
        }

        // Ligne de séparation horizontale fine
        doc.setDrawColor(235);
        let rowHeight = splitTheme.length > 1 ? 25 : 20;
        y += rowHeight;
        doc.line(40, y, 555, y);
      });
      y += 5; // Espace entre sections
    });
  }

  // --- BRANCHEMENT BOUTONS ---
  document.getElementById("pdfBtn").onclick = async () => {
    const b = document.getElementById("pdfBtn");
    b.textContent = "⌛...";
    await loadRoboto();
    exportPDF();
    b.textContent = "📄 Exporter PDF";
  };

  document.getElementById("saveBtn").onclick = () => {
    saveLocal();
    alert("Enregistré !");
  };

  document.getElementById("resetBtn").onclick = async () => {
    if (confirm("Réinitialiser ?")) {
      localStorage.removeItem(PLANNING_KEY);
      location.reload();
    }
  };

  document.getElementById("changeChairmanBtn").onclick = () => {
    const val = prompt("Président :", planningData.weeks[currentWeekIndex].chairman);
    if (val) { planningData.weeks[currentWeekIndex].chairman = val; renderWeek(); saveLocal(); }
  };

  document.getElementById("changeDateBtn").onclick = () => {
    const val = prompt("Date :", planningData.weeks[currentWeekIndex].date);
    if (val) { planningData.weeks[currentWeekIndex].date = val; renderWeek(); saveLocal(); }
  };

  // --- INIT ---
  planningData = await loadData();
  if (planningData) {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => `<option value="${i}">${w.date}</option>`).join("");
    elements.weekSelect.onchange = (e) => { currentWeekIndex = parseInt(e.target.value); renderWeek(); };
    recalcTimes();
    renderWeek();
  }
});
