/* script.js
 - Chargement de planning.json (fichier serveur)
 - Edition inline (contentEditable)
 - Sauvegarde dans localStorage
 - Export / Import JSON
 - Reset depuis le fichier serveur
*/

const PLANNING_KEY = "planning_tpl_local_v1";
const planningContainer = document.getElementById("planning");
const dateDisplay = document.getElementById("dateDisplay");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");

let currentPlanning = null;

// util : charger planning.json depuis serveur
async function fetchServerPlanning(){
  try{
    const res = await fetch("planning.json", {cache: "no-store"});
    if(!res.ok) throw new Error("planning.json non trouvé");
    const data = await res.json();
    return data;
  }catch(e){
    console.warn("Impossible de charger planning.json :", e);
    return null;
  }
}

// render
function render(pl){
  currentPlanning = pl;
  dateDisplay.textContent = pl.date || "";
  const html = pl.items.map((it, idx) => {
    // section class optional
    const sectionClass = it.section ? `section-${it.section}` : "";
    return `
      <div class="row ${sectionClass}" data-idx="${idx}">
        <div class="time">${escapeHtml(it.time || "")}</div>
        <div class="theme editable" contenteditable="true" data-field="theme">${escapeHtml(it.theme || "")}</div>
        <div class="person editable" contenteditable="true" data-field="person">${escapeHtml(it.person || "")}</div>
      </div>
    `;
  }).join("");
  planningContainer.innerHTML = html;

  // add listeners for inline edits
  planningContainer.querySelectorAll(".editable").forEach(el => {
    el.addEventListener("input", handleEdit);
    el.addEventListener("blur", handleEdit); // save on blur
  });
}

// escape HTML small util
function escapeHtml(s){
  return (s||"").toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

// handle edit
function handleEdit(e){
  const el = e.target;
  const row = el.closest(".row");
  const idx = Number(row.getAttribute("data-idx"));
  const field = el.getAttribute("data-field");
  // store raw textContent (preserve simple text)
  currentPlanning.items[idx][field] = el.textContent.trim();
  // autosave to localStorage
  localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));
}

// save button explicit (redundant because autosave)
saveBtn.addEventListener("click", () => {
  if(!currentPlanning) return;
  localStorage.setItem(PLANNING_KEY, JSON.stringify(currentPlanning));
  saveBtn.textContent = "Saved ✅";
  setTimeout(()=> saveBtn.textContent = "Sauvegarder (local)", 1500);
});

// reset from server file
resetBtn.addEventListener("click", async () => {
  const server = await fetchServerPlanning();
  if(server){
    render(server);
    localStorage.removeItem(PLANNING_KEY);
    alert("Planning réinitialisé depuis le fichier serveur. Vos modifications locales ont été supprimées.");
  } else {
    alert("Impossible de recharger planning.json depuis le serveur.");
  }
});

// export JSON
exportBtn.addEventListener("click", () => {
  if(!currentPlanning) return;
  const blob = new Blob([JSON.stringify(currentPlanning, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `planning-export-${(currentPlanning.date||"planning").replace(/\s+/g,"_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// import JSON
importBtn.addEventListener("click", ()=> importFile.click());
importFile.addEventListener("change", (ev)=>{
  const f = ev.target.files && ev.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    try{
      const obj = JSON.parse(e.target.result);
      // basic validation
      if(!Array.isArray(obj.items)) throw new Error("Format invalide");
      render(obj);
      localStorage.setItem(PLANNING_KEY, JSON.stringify(obj));
      alert("Planning importé et enregistré localement.");
    }catch(err){
      alert("Fichier JSON invalide : "+err.message);
    }
  };
  reader.readAsText(f);
  // reset input
  importFile.value = "";
});

// init : load server planning then override with localStorage if present
(async function init(){
  const server = await fetchServerPlanning();
  let pl = server || {date:"", items:[]};

  // if user has local copy, use it
  const local = localStorage.getItem(PLANNING_KEY);
  if(local){
    try{
      const localObj = JSON.parse(local);
      if(localObj && Array.isArray(localObj.items)) {
        pl = localObj;
      }
    }catch(e){
      console.warn("localStorage parse error", e);
    }
  }

  render(pl);
})();
