// js/app.js
// Main JavaScript for Pix Készletkezelő PWA

// ==== Configuration ==== //
// Replace these placeholder values with your Supabase project details.
const SUPABASE_URL = "https://your-project.supabase.co";
const SUPABASE_ANON_KEY = "public-anon-key";

// Initialize Supabase client
let supabase = null;
if (typeof window !== "undefined") {
  // Load Supabase from CDN dynamically
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.1/dist/umd/supabase.js";
  script.onload = () => {
    supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    initApp();
  };
  document.head.appendChild(script);
}

// ==== UI Elements ==== //
const inventoryTableBody = document.querySelector("#inventory-table tbody");
const addItemBtn = document.getElementById("add-item");
const themeToggleBtn = document.getElementById("theme-toggle");
const sidebar = document.getElementById("sidebar");

// Simple role handling – in a real app this would come from auth
let currentRole = "admin"; // or "worker"

function applyRoleVisibility() {
  const adminItems = document.querySelectorAll("[data-role='admin']");
  const workerItems = document.querySelectorAll("[data-role='worker']");
  if (currentRole === "admin") {
    adminItems.forEach(el => el.style.display = "block");
    workerItems.forEach(el => el.style.display = "none");
  } else {
    adminItems.forEach(el => el.style.display = "none");
    workerItems.forEach(el => el.style.display = "block");
  }
}

// ==== Theme ==== //
function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const isDark = document.body.classList.contains("dark-theme");
  themeToggleBtn.textContent = isDark ? "☀️" : "🌙";
}

themeToggleBtn.addEventListener("click", toggleTheme);

// ==== Inventory Operations ==== //
async function fetchInventory() {
  const { data, error } = await supabase.from("inventory").select("id, name, quantity");
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
      <button class="edit-btn">✏️</button>
      <button class="del-btn">🗑️</button>
    </td>`;
  // Edit handler (simple prompt for demo)
  tr.querySelector(".edit-btn").addEventListener("click", () => editItem(item));
  tr.querySelector(".del-btn").addEventListener("click", () => deleteItem(item.id));
  inventoryTableBody.appendChild(tr);
}

async function loadAndRender() {
  inventoryTableBody.innerHTML = "";
  const items = await fetchInventory();
  items.forEach(renderRow);
}

function addItem() {
  const name = prompt("Toll név:");
  if (!name) return;
  const qtyStr = prompt("Mennyiség:");
  const quantity = parseInt(qtyStr, 10) || 0;
  supabase.from("inventory").insert({ name, quantity })
    .then(({ data, error }) => {
      if (error) return console.error(error);
      loadAndRender();
    });
}

function editItem(item) {
  const newName = prompt("Új toll név:", item.name);
  if (newName === null) return;
  const qtyStr = prompt("Új mennyiség:", item.quantity);
  const newQty = parseInt(qtyStr, 10);
  supabase.from("inventory").update({ name: newName, quantity: newQty })
    .eq("id", item.id)
    .then(({ error }) => {
      if (error) return console.error(error);
      loadAndRender();
    });
}

function deleteItem(id) {
  if (!confirm("Biztos törölni?")) return;
  supabase.from("inventory").delete().eq("id", id)
    .then(({ error }) => {
      if (error) return console.error(error);
      loadAndRender();
    });
}

addItemBtn.addEventListener("click", addItem);

// ==== Real‑time subscription ==== //
function subscribeRealtime() {
  supabase.channel("public:inventory")
    .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, payload => {
      console.log("Realtime update", payload);
      loadAndRender();
    })
    .subscribe();
}

// ==== Service Worker registration ==== //
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then(reg => {
    console.log("Service Worker registered", reg);
  });
}

// ==== Initialise app after Supabase is ready ==== //
function initApp() {
  applyRoleVisibility();
  loadAndRender();
  subscribeRealtime();
}

// Listen for background sync messages from the Service Worker
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data && event.data.type === "SYNC_NEEDED") {
      console.log("Background sync triggered – you could push pending changes here.");
    }
  });
}
