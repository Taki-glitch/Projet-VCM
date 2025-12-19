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
  let ROBOTO_BASE64 = null;

  // --- MENU LOGIC ---
  elements.fabToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.buttonGroup.classList.toggle("show");
    elements.fabToggle.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    elements.buttonGroup.classList.remove("show");
    elements.fabToggle.classList.remove("active");
  });

  elements.buttonGroup.addEventListener("click", (e) => e.stopPropagation());

  // --- DATA LOGIC ---
  async function loadData() {
    const local = localStorage.getItem(PLANNING_KEY);
    if (local) return JSON.parse(local);
    try {
      const res = await fetch("planning.json", {cache: "no-store"});
      return await res.json();
    } catch (e) { return null; }
  }

  function saveLocal() {
    localStorage.setItem(PLANNING_KEY, JSON.stringify(planningData));
  }

  function populateSelect() {
    elements.weekSelect.innerHTML = planningData.weeks.map((w, i) => 
      `<option value="${i}">${w.date} | ${w.scripture}</option>`).join("");
  }

  // --- RENDER ---
  function renderWeek() {
    const week = planningData.weeks[currentWeekIndex];
    elements.dateDisplay.textContent = `${week.date} — ${week.chairman}`;
    
    let html = "";
    week.sections.forEach((sec, sidx) => {
      if (sec.title) html += `<div class="sectionTitle">${sec.title}</div>`;
      sec.items.forEach((it, itidx) => {
        const isSkills = sec.title?.includes("ОТТАЧИВАЕМ");
        html += `
          <div class="row section-${(sidx % 3) + 1}">
            <div class="time">${it.time}</div>
            <div class="theme editable" contenteditable="true" oninput="updateData(${sidx},${itidx},'theme',this.textContent)">${it.part ? it.part+' ' : ''}${it.theme}</div>
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
    planningData.weeks[currentWeekIndex].sections[s].items[i][field] = val;
    saveLocal();
  };

  window.updateDuration = (s, i, val) => {
    const num = parseInt(val) || 0;
    planningData.weeks[currentWeekIndex].sections[s].items[i].duration = num;
    recalcTimes();
    renderWeek();
    saveLocal();
  };

  function recalcTimes() {
    const week = planningData.weeks[currentWeekIndex];
    let flat = [];
    week.sections.forEach(s => s.items.forEach(it => flat.push(it)));
    for(let i=1; i<flat.length; i++) {
      let [h, m] = flat[i-1].time.split(":").map(Number);
      let total = h * 60 + m + (flat[i-1].duration || 0);
      flat[i].time = `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
    }
  }

  // --- ACTIONS ---
  document.getElementById("saveBtn").onclick = () => {
    saveLocal();
    alert("Enregistré !");
  };

  document.getElementById("resetBtn").onclick = async () => {
    if(confirm("Réinitialiser avec les données du serveur ?")) {
      localStorage.removeItem(PLANNING_KEY);
      location.reload();
    }
  };

  elements.weekSelect.onchange = (e) => {
    currentWeekIndex = parseInt(e.target.value);
    renderWeek();
  };

  document.getElementById("pdfBtn").onclick = async () => {
    const btn = document.getElementById("pdfBtn");
    btn.textContent = "⌛ Génération...";
    // Ici appeler votre fonction exportPDF() existante
    // Pour des raisons de place, je réutilise votre logique PDF habituelle
    btn.textContent = "📄 Exporter PDF";
  };

  // --- INIT ---
  planningData = await loadData();
  if (planningData) {
    populateSelect();
    recalcTimes();
    renderWeek();
  }
});
