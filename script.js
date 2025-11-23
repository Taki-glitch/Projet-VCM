console.log("✅ script.js chargé correctement !");

/**************************************************************
 * 🌍 CONFIGURATION
 **************************************************************/
const GAS_URL = "https://script.google.com/macros/s/AKfycbxtWnKvuNhaawyd_0z8J_YVl5ZyX4qk8LVNP8oNXNCDMKWtgdzwm-oavdFrzEAufRVz/exec";
const PROXY_URL = ""; // Si tu utilises un proxy pour Google Script

/**************************************************************
 * 🌓 THÈME SOMBRE/CLAIR AUTOMATIQUE
 **************************************************************/
function applyTheme() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}
applyTheme();

/**************************************************************
 * 📅 INITIALISATION FULLCALENDAR
 **************************************************************/
document.addEventListener('DOMContentLoaded', function () {
  const calendarEl = document.getElementById('calendar');
  const calendar = new FullCalendar.Calendar(calendarEl, {
    locale: 'fr',
    initialView: 'timeGridWeek',
    editable: true,
    selectable: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'timeGridWeek,timeGridDay,listWeek'
    },
    events: [], // Charger depuis Google Sheet ou localStorage si nécessaire
  });
  calendar.render();
});

/**************************************************************
 * ✏️ ÉDITION ET SAUVEGARDE LOCALE
 **************************************************************/
function savePlanningLocal(data) {
  localStorage.setItem('planningTPL', JSON.stringify(data));
}

function loadPlanningLocal() {
  const data = localStorage.getItem('planningTPL');
  return data ? JSON.parse(data) : [];
}

/**************************************************************
 * 🌟 EXPORT PDF DU PLANNING
 **************************************************************/
async function exportPlanningPDF() {
  const doc = new jsPDF('p', 'mm', 'a4'); // Portrait A4
  const planningElement = document.getElementById('planning'); // Conteneur HTML du planning

  if (!planningElement) {
    alert("Le planning n'a pas été trouvé !");
    return;
  }

  const options = {
    callback: function (doc) {
      doc.save('planning.pdf'); // Téléchargement PDF
    },
    margin: [10, 10, 10, 10], // marges top, left, bottom, right
    autoPaging: 'text', // pagination automatique si contenu > page
    html2canvas: {
      scale: 0.9, // meilleure qualité
      logging: true,
      useCORS: true,
      backgroundColor: null // conserver couleurs/fonds
    },
    x: 0,
    y: 0
  };

  await doc.html(planningElement, options);
}

// Bouton export PDF
const btnExportPDF = document.getElementById('btnExportPDF');
if (btnExportPDF) {
  btnExportPDF.addEventListener('click', exportPlanningPDF);
}

/**************************************************************
 * ⚙️ AUTRES INTERACTIONS
 **************************************************************/
// Exemple de fonction pour charger planning depuis Google Sheet
async function fetchPlanningGoogleSheet() {
  try {
    const response = await fetch(GAS_URL);
    const data = await response.json();
    console.log("Planning chargé depuis Google Sheet :", data);
    return data;
  } catch (err) {
    console.error("Erreur lors du chargement du planning :", err);
    return [];
  }
}

/**************************************************************
 * 🖌️ INITIALISATION
 **************************************************************/
document.addEventListener('DOMContentLoaded', async () => {
  const localData = loadPlanningLocal();
  if (localData.length) {
    console.log("Planning chargé depuis localStorage :", localData);
  } else {
    const sheetData = await fetchPlanningGoogleSheet();
    savePlanningLocal(sheetData);
  }
});
