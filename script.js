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

  // --- LOGIQUE DU MENU FLOTTANT ---
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

  // --- RENDU ÉCRAN ---
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

  window.updateData = (s, i, field, val) => {
    planningData.weeks[currentWeekIndex].sections[s].items[i][field] = val.trim();
    saveLocal();
  };

  // --- LOGIQUE PDF AVANCÉE (STYLE & FILTRAGE) ---
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
      renderWeekPDF(doc, 40, weeks[i]); // Semaine du haut
      if (weeks[i + 1]) {
        doc.setDrawColor(200);
        doc.line(40, 418, 555, 418); // Ligne de séparation médiane
        renderWeekPDF(doc, 435, weeks[i + 1]); // Semaine du bas
      }
    }

    const blobUrl = doc.output("bloburl");
    document.getElementById("pdfPreviewContainer").style.display = "block";
    document.getElementById("pdfPreview").src = blobUrl;
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) doc.save("VCM_Program.pdf");
  }

  function renderWeekPDF(doc, startY, week) {
    let y = startY;

    // En-tête de la semaine
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(week.date, 40, y);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`${week.scripture}  |  Председатель: ${week.chairman}`, 40, y + 15);
    y += 30;

    const col = { time: 40, theme: 85, dur: 340, pers: 400 };
    const colors = [[230, 247, 245], [255, 247, 230], [255, 241, 242]]; // Sections colors

    week.sections.forEach((sec, sIdx) => {
      // Filtrer les items : on n'affiche que ceux qui ont un thème ou une personne
      const visibleItems = sec.items.filter(it => it.theme.trim() !== "" || (it.person && it.person.trim() !== ""));
      
      if (visibleItems.length === 0) return; // Saute la section si elle est vide

      // Fond de titre de section
      doc.setFillColor(245, 245, 245);
      doc.rect(40, y, 515, 14, 'F');
      doc.setFontSize(8);
      doc.setTextColor(60);
      if (sec.title) doc.text(sec.title.toUpperCase(), 45, y + 10);
      y += 14;

      visibleItems.forEach(it => {
        // Fond de ligne coloré selon la section
        doc.setFillColor(...colors[sIdx % 3]);
        doc.rect(40, y, 515, 18, 'F');
        
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(it.time, col.time + 2, y + 12);

        // Thème avec retour à la ligne
        let txt = (it.part ? it.part + " " : "") + it.theme;
        let splitTxt = doc.splitTextToSize(txt, 240);
        doc.text(splitTxt, col.theme, y + 12);

        // Durée
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`${it.duration} мин`, col.dur, y + 12);

        // Personne et Note
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.setFont(undefined, 'bold');
        doc.text(it.person || "", col.pers, y + 12);
        doc.setFont(undefined, 'normal');

        if (it.note) {
          doc.setFontSize(7);
          doc.setTextColor(100);
          doc.text(it.note, col.pers, y + 22);
        }

        let rowStep = splitTxt.length > 1 ? 28 : 22;
        y += rowStep;

        // Petite ligne de séparation
        doc.setDrawColor(220);
        doc.line(40, y, 555, y);
        y += 2;
      });
      y += 4; // Espace entre sections
    });
  }

  // --- BOUTONS ---
  document.getElementById("pdfBtn").onclick = async () => {
    await loadRoboto();
    exportPDF();
  };
  document.getElementById("saveBtn").onclick = () => { saveLocal(); alert("OK"); };

  // --- INIT ---
  planningData = await loadData();
  if (planningData) {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => `<option value="${i}">${w.date}</option>`).join("");
    elements.weekSelect.onchange = (e) => { currentWeekIndex = parseInt(e.target.value); renderWeek(); };
    renderWeek();
  }
});
