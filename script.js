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

  // --- MENU ACTIONS ---
  elements.fabToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.buttonGroup.classList.toggle("show");
    elements.fabToggle.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    elements.buttonGroup.classList.remove("show");
    elements.fabToggle.classList.remove("active");
  });

  // --- GESTION DES DONNÉES ---
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

  // --- RECALCUL ET RENDU ---
  function recalcTimes() {
    planningData.weeks.forEach((week, wIdx) => {
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
    const week = planningData.weeks[currentWeekIndex];
    week.sections[s].items[i][field] = val;
    saveLocal();
  };

  window.updateDuration = (s, i, val) => {
    const num = parseInt(val) || 0;
    planningData.weeks[currentWeekIndex].sections[s].items[i].duration = num;
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

  // --- LOGIQUE PDF ---
  async function loadRoboto() {
    if (ROBOTO_BASE64) return;
    try {
      const resp = await fetch(ROBOTO_TTF_URL);
      const ab = await resp.arrayBuffer();
      const binary = String.fromCharCode(...new Uint8Array(ab));
      ROBOTO_BASE64 = btoa(binary);
      localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
    } catch (e) { console.error("Erreur police Roboto", e); }
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
      drawWeekPDF(doc, weeks[i], 40);
      if (weeks[i + 1]) {
        doc.setDrawColor(200);
        doc.line(40, 420, 550, 420);
        drawWeekPDF(doc, weeks[i + 1], 440);
      }
    }
    
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
        doc.save("planning.pdf");
    } else {
        document.getElementById("pdfPreviewContainer").style.display = "block";
        document.getElementById("pdfPreview").src = doc.output("bloburl");
    }
  }

  function drawWeekPDF(doc, week, y) {
    doc.setFontSize(12); doc.text(week.date, 40, y);
    doc.setFontSize(10); doc.text(week.scripture + " | Председатель: " + week.chairman, 40, y + 15);
    let currentY = y + 35;
    week.sections.forEach(sec => {
      sec.items.forEach(it => {
        if(currentY > y + 360) return; 
        doc.setFontSize(9);
        doc.text(it.time, 40, currentY);
        let txt = (it.part ? it.part + " " : "") + it.theme + " (" + it.duration + " мин)";
        doc.text(doc.splitTextToSize(txt, 300), 80, currentY);
        doc.text(it.person || "", 400, currentY);
        currentY += 15;
      });
      currentY += 5;
    });
  }

  // --- BOUTONS ---
  document.getElementById("pdfBtn").onclick = async () => {
    document.getElementById("pdfBtn").textContent = "⌛ Génération...";
    await loadRoboto();
    exportPDF();
    document.getElementById("pdfBtn").textContent = "📄 Exporter PDF";
  };

  document.getElementById("changeChairmanBtn").onclick = () => {
    const val = prompt("Nom du Président :", planningData.weeks[currentWeekIndex].chairman);
    if(val !== null) { planningData.weeks[currentWeekIndex].chairman = val; saveLocal(); renderWeek(); }
  };

  document.getElementById("changeDateBtn").onclick = () => {
    const val = prompt("Date :", planningData.weeks[currentWeekIndex].date);
    if(val !== null) { planningData.weeks[currentWeekIndex].date = val; saveLocal(); renderWeek(); }
  };

  document.getElementById("changeScriptureBtn").onclick = () => {
    const val = prompt("Lecture :", planningData.weeks[currentWeekIndex].scripture);
    if(val !== null) { planningData.weeks[currentWeekIndex].scripture = val; saveLocal(); renderWeek(); }
  };

  // --- INITIALISATION ---
  planningData = await loadData();
  if (planningData) {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => `<option value="${i}">${w.date}</option>`).join("");
    elements.weekSelect.onchange = (e) => { currentWeekIndex = parseInt(e.target.value); renderWeek(); };
    recalcTimes();
    renderWeek();
  }
});
