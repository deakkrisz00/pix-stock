// js/app.js – Pix Készletkezelő PWA

const SUPABASE_URL      = "https://pixkeszlet.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_B1yokVgw57vEv-iOuSH3IQ_yxEwO3Yi";

let supabaseClient = null;
let currentRole    = "admin"; // "admin" | "worker"

document.addEventListener("DOMContentLoaded", () => {

  // ── Elemek ──────────────────────────────────────────────────
  const themeToggleBtn = document.getElementById("theme-toggle");
  const namesTableBody = document.querySelector("#inventory-table tbody");
  const pensTableBody  = document.querySelector("#pens-table tbody");
  const addItemBtn     = document.getElementById("add-item");
  const addPenBtn      = document.getElementById("add-pen");
  const navItems       = document.querySelectorAll(".nav-item");
  const sections       = document.querySelectorAll(".section");

  const importInventoryBtn  = document.getElementById("import-inventory-btn");
  const importInventoryFile = document.getElementById("import-inventory-file");
  const importPensBtn       = document.getElementById("import-pens-btn");
  const importPensFile      = document.getElementById("import-pens-file");

  const modal        = document.getElementById("import-modal");
  const modalTitle   = document.getElementById("modal-title");
  const modalClose   = document.getElementById("modal-close");
  const modalCancel  = document.getElementById("modal-cancel");
  const modalImport  = document.getElementById("modal-import");
  const sheetSelect  = document.getElementById("sheet-select");
  const colMapFields = document.getElementById("col-map-fields");
  const previewThead = document.getElementById("preview-thead");
  const previewTbody = document.getElementById("preview-tbody");
  const previewCount = document.getElementById("preview-count");

  // ── TÉMA ────────────────────────────────────────────────────
  function applyTheme(isDark) {
    document.body.classList.toggle("light-theme", !isDark);
    themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }
  function toggleTheme() { applyTheme(document.body.classList.contains("light-theme")); }
  applyTheme(localStorage.getItem("theme") !== "light");
  themeToggleBtn.addEventListener("pointerup", (e) => { e.preventDefault(); toggleTheme(); });

  // ── NAVIGÁCIÓ ───────────────────────────────────────────────
  function showSection(id) {
    sections.forEach(s => s.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
  }
  navItems.forEach(item => {
    item.addEventListener("pointerup", (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      if (item.dataset.section) showSection(item.dataset.section);
    });
  });

  // ── SZEREPKÖR ────────────────────────────────────────────────
  function applyRoleVisibility() {
    document.querySelectorAll("[data-role='admin']").forEach(el => {
      el.style.display = currentRole === "admin" ? "" : "none";
    });
    document.querySelectorAll("[data-role='worker']").forEach(el => {
      el.style.display = currentRole === "worker" ? "" : "none";
    });
  }

  // ── NEVEK / KÉSZLET (names tábla) ────────────────────────────
  async function fetchNames() {
    const { data, error } = await supabaseClient
      .from("names")
      .select("id, name, central_stock, bazar_stock, fenti_stock, is_active")
      .order("name", { ascending: true });
    if (error) { console.error("fetchNames:", error); return []; }
    return data;
  }

  function renderNameRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    const total = (item.central_stock || 0) + (item.bazar_stock || 0) + (item.fenti_stock || 0);
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.central_stock ?? 0}</td>
      <td>${item.bazar_stock ?? 0}</td>
      <td>${item.fenti_stock ?? 0}</td>
      <td><strong>${total}</strong></td>
      <td>
        <button class="edit-btn" aria-label="Szerkesztés">✏️</button>
        <button class="del-btn"  aria-label="Törlés">🗑️</button>
      </td>`;
    tr.querySelector(".edit-btn").addEventListener("pointerup", (e) => { e.preventDefault(); editName(item); });
    tr.querySelector(".del-btn").addEventListener("pointerup",  (e) => { e.preventDefault(); deleteName(item.id); });
    namesTableBody.appendChild(tr);
  }

  async function loadAndRenderNames() {
    namesTableBody.innerHTML = "";
    (await fetchNames()).forEach(renderNameRow);
  }

  function addName() {
    const name = prompt("Toll neve:");
    if (!name) return;
    supabaseClient.from("names").insert({ name })
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderNames(); });
  }

  function editName(item) {
    const newName = prompt("Új toll neve:", item.name);
    if (newName === null) return;
    const central = parseInt(prompt("Központi készlet:", item.central_stock ?? 0), 10) || 0;
    const bazar   = parseInt(prompt("Bazár készlet:",   item.bazar_stock   ?? 0), 10) || 0;
    const fenti   = parseInt(prompt("Fenti készlet:",   item.fenti_stock   ?? 0), 10) || 0;
    supabaseClient.from("names")
      .update({ name: newName, central_stock: central, bazar_stock: bazar, fenti_stock: fenti })
      .eq("id", item.id)
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderNames(); });
  }

  function deleteName(id) {
    if (!confirm("Biztos törölni?")) return;
    supabaseClient.from("names").delete().eq("id", id)
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderNames(); });
  }

  addItemBtn?.addEventListener("pointerup", (e) => { e.preventDefault(); addName(); });

  // ── TOLLAK (pens tábla – ha létezik) ─────────────────────────
  async function fetchPens() {
    const { data, error } = await supabaseClient
      .from("pens").select("id, name, type").order("name", { ascending: true });
    if (error) { console.error("fetchPens:", error); return []; }
    return data;
  }

  function renderPenRow(pen) {
    const tr = document.createElement("tr");
    tr.dataset.id = pen.id;
    tr.innerHTML = `
      <td>${pen.name}</td>
      <td>${pen.type ?? "–"}</td>
      <td>
        <button class="edit-btn" aria-label="Szerkesztés">✏️</button>
        <button class="del-btn"  aria-label="Törlés">🗑️</button>
      </td>`;
    tr.querySelector(".edit-btn").addEventListener("pointerup", (e) => { e.preventDefault(); editPen(pen); });
    tr.querySelector(".del-btn").addEventListener("pointerup",  (e) => { e.preventDefault(); deletePen(pen.id); });
    pensTableBody.appendChild(tr);
  }

  async function loadAndRenderPens() {
    pensTableBody.innerHTML = "";
    (await fetchPens()).forEach(renderPenRow);
  }

  function addPen() {
    const name = prompt("Toll neve:");
    if (!name) return;
    const type = prompt("Típus (pl. golyóstoll):") || null;
    supabaseClient.from("pens").insert({ name, type })
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderPens(); });
  }

  function editPen(pen) {
    const newName = prompt("Új toll neve:", pen.name);
    if (newName === null) return;
    const newType = prompt("Új típus:", pen.type ?? "") || null;
    supabaseClient.from("pens").update({ name: newName, type: newType }).eq("id", pen.id)
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderPens(); });
  }

  function deletePen(id) {
    if (!confirm("Biztos törölni?")) return;
    supabaseClient.from("pens").delete().eq("id", id)
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderPens(); });
  }

  addPenBtn?.addEventListener("pointerup", (e) => { e.preventDefault(); addPen(); });

  // ── EXCEL IMPORT ─────────────────────────────────────────────
  let importTarget = null;
  let workbookData = null;
  let parsedNames  = [];

  importInventoryBtn?.addEventListener("pointerup", (e) => {
    e.preventDefault(); importTarget = "names"; importInventoryFile.value = ""; importInventoryFile.click();
  });
  importPensBtn?.addEventListener("pointerup", (e) => {
    e.preventDefault(); importTarget = "pens"; importPensFile.value = ""; importPensFile.click();
  });

  importInventoryFile.addEventListener("change", (e) => handleFileSelected(e, "names"));
  importPensFile.addEventListener("change",      (e) => handleFileSelected(e, "pens"));

  function handleFileSelected(event, target) {
    const file = event.target.files[0];
    if (!file) return;
    importTarget = target;
    if (typeof XLSX === "undefined") {
      alert("A SheetJS könyvtár még töltődik be, kérlek próbáld újra.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        workbookData = XLSX.read(ev.target.result, { type: "binary" });
        openImportModal();
      } catch (err) {
        alert("Nem sikerült olvasni a fájlt.");
      }
    };
    reader.readAsBinaryString(file);
  }

  function extractNames(sheetName) {
    const ws   = workbookData.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const seen = new Set();
    const out  = [];
    rows.forEach(row => row.forEach(cell => {
      const v = String(cell ?? "").trim();
      if (v && !/^\d+$/.test(v) && v.length >= 2 && !seen.has(v.toLowerCase())) {
        seen.add(v.toLowerCase()); out.push(v);
      }
    }));
    return out.sort((a, b) => a.localeCompare(b, "hu"));
  }

  function openImportModal() {
    modalTitle.textContent = importTarget === "names" ? "Excel Import – Készlet" : "Excel Import – Tollak";
    sheetSelect.innerHTML = "";
    workbookData.SheetNames.forEach(name => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = name;
      sheetSelect.appendChild(opt);
    });
    colMapFields.innerHTML = "";
    updateImportPreview();
    sheetSelect.onchange = updateImportPreview;
    modal.classList.remove("hidden");
  }

  function updateImportPreview() {
    parsedNames = extractNames(sheetSelect.value);
    previewThead.innerHTML = "<tr><th>#</th><th>Toll neve</th></tr>";
    previewTbody.innerHTML = parsedNames.slice(0, 10)
      .map((n, i) => `<tr><td>${i + 1}</td><td>${n}</td></tr>`).join("");
    previewCount.textContent = parsedNames.length > 0
      ? `Összesen ${parsedNames.length} egyedi nevet találtam${parsedNames.length > 10 ? " (előnézet: első 10)" : ""}.`
      : "Nem találtam adatot ebben a lapban.";
  }

  function closeModal() {
    modal.classList.add("hidden"); workbookData = null; parsedNames = []; importTarget = null;
  }
  modalClose?.addEventListener("pointerup",  (e) => { e.preventDefault(); closeModal(); });
  modalCancel?.addEventListener("pointerup", (e) => { e.preventDefault(); closeModal(); });
  modal?.addEventListener("pointerup", (e) => { if (e.target === modal) closeModal(); });

  modalImport?.addEventListener("pointerup", async (e) => { e.preventDefault(); await runImport(); });

  async function runImport() {
    if (!parsedNames.length) { alert("Nem találtam importálható nevet."); return; }

    const records = parsedNames.map(name => {
      if (importTarget === "names") return { name };
      if (importTarget === "pens")  return { name, type: null };
      return { name };
    });

    modalImport.disabled = true;
    modalImport.textContent = `⏳ Importálás (${records.length} sor)...`;

    const { error } = await supabaseClient.from(importTarget).insert(records);
    if (error) {
      alert("Hiba az importálás során:\n" + error.message);
      console.error(error);
    } else {
      closeModal();
      if (importTarget === "names") loadAndRenderNames(); else loadAndRenderPens();
      alert(`✅ Sikeresen importálva: ${records.length} toll neve.`);
    }
    modalImport.disabled = false;
    modalImport.textContent = "✅ Importálás";
  }

  // ── REAL-TIME ────────────────────────────────────────────────
  function subscribeRealtime() {
    supabaseClient.channel("public:names")
      .on("postgres_changes", { event: "*", schema: "public", table: "names" }, loadAndRenderNames)
      .subscribe();
  }

  // ── INDÍTÁS ──────────────────────────────────────────────────
  function initApp() {
    applyRoleVisibility();
    loadAndRenderNames();
    subscribeRealtime();
  }

  const xlsxScript = document.createElement("script");
  xlsxScript.src   = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
  document.head.appendChild(xlsxScript);

  const script  = document.createElement("script");
  script.src    = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.1/dist/umd/supabase.js";
  script.onload = () => {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initApp();
  };
  script.onerror = () => console.error("Supabase SDK betöltése sikertelen.");
  document.head.appendChild(script);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then(reg => console.log("SW regisztrálva:", reg.scope))
      .catch(err => console.warn("SW hiba:", err));
  }

});
