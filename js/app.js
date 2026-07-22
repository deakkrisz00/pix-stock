// js/app.js
// Main JavaScript for Pix Készletkezelő PWA

// ==== Configuration ==== //
const SUPABASE_URL = "https://your-project.supabase.co"; // TODO: replace
const SUPABASE_ANON_KEY = "public-anon-key";             // TODO: replace

let supabaseClient = null;
let currentRole = "admin"; // "admin" | "worker"

// ==== Bootstrap ==== //
// Wait for the DOM to be fully ready before touching any elements
document.addEventListener("DOMContentLoaded", () => {

  // ==== UI Element references (safe – DOM is ready) ==== //
  const inventoryTableBody = document.querySelector("#inventory-table tbody");
  const addItemBtn         = document.getElementById("add-item");
  const themeToggleBtn     = document.getElementById("theme-toggle");

  // ==== Theme ==== //
  function toggleTheme() {
    document.body.classList.toggle("dark-theme");
    const isDark = document.body.classList.contains("dark-theme");
    themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }

  // Restore saved theme
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-theme");
    if (themeToggleBtn) themeToggleBtn.textContent = "☀️";
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
    themeToggleBtn.addEventListener("touchend", (e) => {
      e.preventDefault(); // prevent ghost click on mobile
      toggleTheme();
    });
  }

  // ==== Role visibility ==== //
  function applyRoleVisibility() {
    document.querySelectorAll("[data-role='admin']").forEach(el => {
      el.style.display = currentRole === "admin" ? "" : "none";
    });
    document.querySelectorAll("[data-role='worker']").forEach(el => {
      el.style.display = currentRole === "worker" ? "" : "none";
    });
  }

  // ==== Inventory rendering ==== //
  async function fetchInventory() {
    const { data, error } = await supabaseClient
      .from("inventory")
      .select("id, name, quantity");
    if (error) {
      console.error("Error fetching inventory:", error);
      return [];
    }
    return data;
  }

  function renderRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>
        <button class="edit-btn" aria-label="Szerkesztés">✏️</button>
        <button class="del-btn"  aria-label="Törlés">🗑️</button>
      </td>`;

    const editBtn = tr.querySelector(".edit-btn");
    const delBtn  = tr.querySelector(".del-btn");

    // Both click (PC) and touchend (mobile) are handled
    function handleEdit(e) { e.preventDefault(); editItem(item); }
    function handleDel(e)  { e.preventDefault(); deleteItem(item.id); }

    editBtn.addEventListener("click",    handleEdit);
    editBtn.addEventListener("touchend", handleEdit);
    delBtn.addEventListener("click",     handleDel);
    delBtn.addEventListener("touchend",  handleDel);

    inventoryTableBody.appendChild(tr);
  }

  async function loadAndRender() {
    inventoryTableBody.innerHTML = "";
    const items = await fetchInventory();
    items.forEach(renderRow);
  }

  // ==== CRUD ==== //
  function addItem() {
    const name = prompt("Toll név:");
    if (!name) return;
    const quantity = parseInt(prompt("Mennyiség:"), 10) || 0;
    supabaseClient.from("inventory").insert({ name, quantity })
      .then(({ error }) => {
        if (error) return console.error(error);
        loadAndRender();
      });
  }

  function editItem(item) {
    const newName = prompt("Új toll név:", item.name);
    if (newName === null) return;
    const newQty = parseInt(prompt("Új mennyiség:", item.quantity), 10) || 0;
    supabaseClient.from("inventory").update({ name: newName, quantity: newQty })
      .eq("id", item.id)
      .then(({ error }) => {
        if (error) return console.error(error);
        loadAndRender();
      });
  }

  function deleteItem(id) {
    if (!confirm("Biztos törölni?")) return;
    supabaseClient.from("inventory").delete().eq("id", id)
      .then(({ error }) => {
        if (error) return console.error(error);
        loadAndRender();
      });
  }

  // Wire up "Új tétel" button
  if (addItemBtn) {
    addItemBtn.addEventListener("click", addItem);
    addItemBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      addItem();
    });
  }

  // ==== Real-time subscription ==== //
  function subscribeRealtime() {
    supabaseClient.channel("public:inventory")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => {
        loadAndRender();
      })
      .subscribe();
  }

  // ==== Initialise app after Supabase is ready ==== //
  function initApp() {
    applyRoleVisibility();
    loadAndRender();
    subscribeRealtime();
  }

  // ==== Load Supabase from CDN, then start the app ==== //
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.1/dist/umd/supabase.js";
  script.onload = () => {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initApp();
  };
  script.onerror = () => {
    console.error("Nem sikerült betölteni a Supabase SDK-t. Ellenőrizd az internet-kapcsolatot.");
  };
  document.head.appendChild(script);

  // ==== Service Worker ==== //
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js")
      .then(reg => console.log("Service Worker registered", reg))
      .catch(err => console.warn("SW registration failed", err));

    navigator.serviceWorker.addEventListener("message", event => {
      if (event.data?.type === "SYNC_NEEDED") {
        console.log("Background sync triggered.");
      }
    });
  }

}); // end DOMContentLoaded
