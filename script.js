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

  // --- CHARGEMENT DES DONNÉES ---
  async function loadData() {
    const local = localStorage.getItem(PLANNING_KEY);
    if (local) return JSON.parse(local);
    try {
      const res = await fetch("planning.json", { cache: "no-store" });
      const data = await res.json();
      return data;
    } catch (e) { 
      console.error("Erreur de chargement", e);
      return null; 
    }
  }

  function saveLocal() {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData));
  }

  // --- CALCUL AUTOMATIQUE DES HORAIRES ---
  function recalcTimesForWeek(week) {
    let startTime = "19:00";
    let [h, m] = startTime.split(":").map(Number);

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

  // --- RENDU ÉCRAN ---
  window.renderWeek = () => {
    const week = planningData.weeks[currentWeekIndex];
    recalcTimesForWeek(week);
    
    elements.dateDisplay.innerHTML = `
      <div>${week.date}</div>
      <div style="font-size:0.9rem; color:#666;">📖 ${week.scripture} | 👤 Président: ${week.chairman}</div>
    `;

    let html = "";
    week.sections.forEach((sec, sidx) => {
      if (sec.title) html += `<div class="sectionTitle">${sec.title}</div>`;
      sec.items.forEach((it, itidx) => {
        html += `
          <div class="row section-${(sidx % 3) + 1}">
            <div class="time">${it.time}</div>
            <div class="theme editable" contenteditable="true" onblur="updateData(${sidx},${itidx},'theme',this.textContent)">${it.part ? it.part + ' ' : ''}${it.theme}</div>
            <div class="duration editable" contenteditable="true" onblur="updateDuration(${sidx},${itidx},this.textContent)">${it.duration || 0}</div>
            <div class="personNoteContainer">
              <div class="person editable" contenteditable="true" onblur="updateData(${sidx},${itidx},'person',this.textContent)">${it.person || ''}</div>
              <div class="note editable" contenteditable="true" onblur="updateData(${sidx},${itidx},'note',this.textContent)">${it.note || ''}</div>
            </div>
          </div>`;
      });
    });
    elements.planning.innerHTML = html;
  };

  window.updateData = (s, i, field, val) => {
    planningData.weeks[currentWeekIndex].sections[s].items[i][field] = val.trim();
    saveLocal();
  };

  window.updateDuration = (s, i, val) => {
    planningData.weeks[currentWeekIndex].sections[s].items[i].duration = parseInt(val) || 0;
    saveLocal();
    renderWeek(); // Relance le calcul des horaires
  };

  // --- ACTIONS DES BOUTONS DU MENU ---
  document.getElementById("changeChairmanBtn").onclick = () => {
    const name = prompt("Nom du Président :", planningData.weeks[currentWeekIndex].chairman);
    if (name !== null) {
      planningData.weeks[currentWeekIndex].chairman = name;
      saveLocal();
      renderWeek();
    }
  };

  document.getElementById("changeScriptureBtn").onclick = () => {
    const scrip = prompt("Lecture de la semaine :", planningData.weeks[currentWeekIndex].scripture);
    if (scrip !== null) {
      planningData.weeks[currentWeekIndex].scripture = scrip;
      saveLocal();
      renderWeek();
    }
  };

  document.getElementById("changeDateBtn").onclick = () => {
    const d = prompt("Modifier la date de la semaine :", planningData.weeks[currentWeekIndex].date);
    if (d !== null) {
      planningData.weeks[currentWeekIndex].date = d;
      saveLocal();
      renderWeek();
    }
  };

  document.getElementById("resetBtn").onclick = async () => {
    if(confirm("Effacer vos modifs locales et recharger depuis le serveur ?")) {
      localStorage.removeItem(PLANNING_KEY);
      location.reload();
    }
  };

  // --- EXPORT PDF ---
  async function loadRoboto() {
    if (ROBOTO_BASE64) return;
    try {
      const resp = await fetch(ROBOTO_TTF_URL);
      const ab = await resp.arrayBuffer();
      ROBOTO_BASE64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      localStorage.setItem(FONT_KEY, ROBOTO_BASE64);
    } catch(e) { alert("Erreur chargement police Roboto.ttf"); }
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
      renderWeekPDF(doc, 40, weeks[i]);
      if (weeks[i + 1]) {
        doc.setDrawColor(200);
        doc.line(40, 418, 555, 418);
        renderWeekPDF(doc, 435, weeks[i + 1]);
      }
    }
    const blobUrl = doc.output("bloburl");
    document.getElementById("pdfPreviewContainer").style.display = "block";
    document.getElementById("pdfPreview").src = blobUrl;
  }

  function renderWeekPDF(doc, startY, week) {
    let y = startY;
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(week.date, 40, y);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`${week.scripture}  |  Председатель: ${week.chairman}`, 40, y + 15);
    y += 30;

    const col = { time: 40, theme: 85, dur: 340, pers: 400 };
    const colors = [[230, 247, 245], [255, 247, 230], [255, 241, 242]];

    week.sections.forEach((sec, sIdx) => {
      const visibleItems = sec.items.filter(it => it.theme.trim() !== "" || (it.person && it.person.trim() !== ""));
      if (visibleItems.length === 0) return;

      doc.setFillColor(245, 245, 245);
      doc.rect(40, y, 515, 14, 'F');
      doc.setFontSize(8);
      doc.setTextColor(60);
      if (sec.title) doc.text(sec.title.toUpperCase(), 45, y + 10);
      y += 14;

      visibleItems.forEach(it => {
        doc.setFillColor(...colors[sIdx % 3]);
        doc.rect(40, y, 515, 18, 'F');
        doc.setFontSize(9);
        doc.setTextColor(0);
        doc.text(it.time, col.time + 2, y + 12);

        let txt = (it.part ? it.part + " " : "") + it.theme;
        let splitTxt = doc.splitTextToSize(txt, 240);
        doc.text(splitTxt, col.theme, y + 12);

        doc.setFontSize(8);
        doc.text(`${it.duration || 0} мин`, col.dur, y + 12);
        doc.text(it.person || "", col.pers, y + 12);

        y += (splitTxt.length > 1 ? 28 : 22);
      });
      y += 5;
    });
  }

  document.getElementById("pdfBtn").onclick = async () => {
    await loadRoboto();
    exportPDF();
  };
  
  document.getElementById("saveBtn").onclick = () => { 
    saveLocal(); 
    alert("Enregistré dans le navigateur !"); 
  };

  // --- INITIALISATION ---
  planningData = await loadData();
  if (planningData) {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => `<option value="${i}">${w.date}</option>`).join("");
    elements.weekSelect.onchange = (e) => { 
      currentWeekIndex = parseInt(e.target.value); 
      renderWeek(); 
    };
    renderWeek();
  }
});
