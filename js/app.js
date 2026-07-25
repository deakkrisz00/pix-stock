// js/app.js – Pix Készletkezelő PWA

const SUPABASE_URL      = "https://bxfohkmjsvdptijzaydi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4Zm9oa21qc3ZkcHRpanpheWRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MDI0ODYsImV4cCI6MjEwMDI3ODQ4Nn0.WL95IKk6ETM7Ukn3gCRn88XqM9GqqmWfA4YPS9gfUQ0";

let supabaseClient = null;
let currentRole    = "worker"; // "admin" | "worker"
let currentUser    = "";

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
  // ── FELHASZNÁLÓVÁLASZTÓ ─────────────────────────────────────
  const userSelectModal = document.getElementById("user-select-modal");
  const userBadge = document.getElementById("current-user-badge");

  function selectUser(name, role = "worker") {
    currentUser = name;
    currentRole = role;
    userSelectModal.classList.add("hidden");
    adminModal.classList.add("hidden");
    userBadge.textContent = (role === "admin" ? "🔐 " : "👤 ") + name;
    userBadge.style.display = "inline-block";
    // Megjegyezzük az eszközön
    localStorage.setItem("pix_user", name);
    localStorage.setItem("pix_role", role);
    applyRoleVisibility();
    loadAndRenderNames();
    loadShortageNames();
    loadOrderNames();
  }

  document.querySelectorAll(".user-select-btn").forEach(btn => {
    btn.addEventListener("pointerup", e => {
      e.preventDefault();
      selectUser(btn.dataset.user, "worker");
    });
  });

  document.getElementById("user-select-admin")?.addEventListener("pointerup", e => {
    e.preventDefault();
    userSelectModal.classList.add("hidden");
    adminModal.classList.remove("hidden");
  });

  function showSection(id) {
    sections.forEach(s => s.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
    const fab = document.getElementById("shortage-fab");
    if (fab) fab.style.display = (id === "shortage-section") ? "block" : "none";
    if (id === "stats-section") loadStats();
    if (id === "admin-log-section") loadAdminLog();
  }
  navItems.forEach(item => {
    item.addEventListener("pointerup", (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      if (item.dataset.section) showSection(item.dataset.section);
    });
  });

  // Duplicate applyRoleVisibility removed – defined later with admin sections

  // ── SZEREPKÖR ────────────────────────────────────────────────
  function applyRoleVisibility() {
    document.querySelectorAll("[data-role='admin']").forEach(el => {
      el.style.display = currentRole === "admin" ? "" : "none";
    });
    document.querySelectorAll("[data-role='worker']").forEach(el => {
      el.style.display = currentRole === "worker" ? "" : "none";
    });
    
    // Reset view to inventory tab based on role
    const activeNavs = Array.from(document.querySelectorAll(".nav-item")).filter(n => n.style.display !== "none");
    const defaultNav = activeNavs.find(n => n.dataset.section === "inventory-section");
    
    if (defaultNav) {
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      defaultNav.classList.add("active");
      showSection("inventory-section");
    }
  }

  // ── ADMIN PIN LOGIKA ────────────────────────────────────────
  const adminBtn = document.getElementById("admin-btn");
  const adminModal = document.getElementById("admin-pin-modal");
  const adminPinInput = document.getElementById("admin-pin-input");
  const adminPinSubmit = document.getElementById("admin-pin-submit");
  const adminPinCancel = document.getElementById("admin-pin-cancel");
  const adminPinClose = document.getElementById("admin-pin-close");
  const adminLogoutBtn = document.getElementById("admin-logout");

  const verifyPin = () => {
    const pin = adminPinInput.value.trim();
    if (pin === "246135" || Number(pin) === 246135) {
      selectUser("Admin", "admin");
      adminModal.classList.add("hidden");
      adminPinInput.value = "";
    } else {
      alert("Hibás PIN!");
    }
  };
  adminBtn?.addEventListener("pointerup", e => {
    e.preventDefault();
    userSelectModal.classList.remove("hidden");
  });
  adminPinSubmit?.addEventListener("pointerup", e => { e.preventDefault(); verifyPin(); });
  adminPinCancel?.addEventListener("pointerup", e => { e.preventDefault(); adminModal.classList.add("hidden"); userSelectModal.classList.remove("hidden"); });
  adminPinClose?.addEventListener("pointerup",  e => { e.preventDefault(); adminModal.classList.add("hidden"); userSelectModal.classList.remove("hidden"); });
  adminLogoutBtn?.addEventListener("pointerup", e => {
    e.preventDefault();
    currentRole = "worker";
    currentUser = "";
    userBadge.textContent = "";
    userBadge.style.display = "none";
    localStorage.removeItem("pix_user");
    localStorage.removeItem("pix_role");
    userSelectModal.classList.remove("hidden");
    applyRoleVisibility();
  });

  // ── SHORTAGE SECTION LOGIKA ───────────────────────────────────
  const boothSelect = document.getElementById("booth-select");
  const shortageTableBody = document.querySelector("#shortage-table tbody");
  const submitShortageBtn = document.getElementById("submit-shortage");

  async function loadShortageNames() {
    const names = await fetchNames();
    shortageTableBody.innerHTML = "";
    const currentBooth = boothSelect ? boothSelect.value : 'bazar';
    const boothField = currentBooth === 'bazar' ? 'bazar_stock' : 'fenti_stock';

    names.forEach(item => {
      const tr = document.createElement("tr");
      tr.dataset.name = item.name;
      tr.dataset.central = item.central_stock || 0;
      
      const pendingShortage = item[boothField] || 0;
      tr.dataset.pending = pendingShortage;

      let fulfillBtnHtml = '';
      if (pendingShortage > 0 && (item.central_stock || 0) > 0) {
        const fulfillAmount = Math.min(pendingShortage, item.central_stock);
        fulfillBtnHtml = `<button class="cta-button secondary fulfill-btn" data-name="${item.name}" data-amount="${fulfillAmount}" style="margin-left: 8px; padding: 0.2rem 0.5rem; font-size: 0.8rem;">Pótlás (${fulfillAmount})</button>`;
      }

      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.central_stock || 0}</td>
        <td>
          <span style="font-weight: bold; color: ${pendingShortage > 0 ? '#f87171' : 'var(--color-text)'}">${pendingShortage} db</span>
          ${fulfillBtnHtml}
        </td>
        <td>
          <div class="qty-wrap">
            <!-- Gyors gombok -->
            <div class="qty-quick-btns">
              <button class="qty-quick-btn" data-add="1" aria-label="+1">+1</button>
              <button class="qty-quick-btn" data-add="2" aria-label="+2">+2</button>
              <button class="qty-quick-btn" data-add="3" aria-label="+3">+3</button>
              <button class="qty-quick-btn" data-add="5" aria-label="+5">+5</button>
              <button class="qty-quick-btn qty-reset" data-reset="1" aria-label="Törlés">✕</button>
            </div>
            <!-- Pontos bevitel -->
            <div class="qty-control">
              <button class="qty-btn" aria-label="Kivonás">−</button>
              <input type="number" class="styled-input shortage-qty-input" value="0" min="-9999" max="9999"
                style="width:64px; text-align:center; padding:0.4rem 0.2rem;" />
              <button class="qty-btn" aria-label="Hozzáadás">+</button>
            </div>
          </div>
        </td>
      `;

      const input = tr.querySelector(".shortage-qty-input");

      function updateInputStyle() {
        const v = parseInt(input.value, 10) || 0;
        input.classList.toggle("qty-input-active", v !== 0);
      }

      // Gyors gombok
      tr.querySelectorAll(".qty-quick-btn[data-add]").forEach(btn => {
        btn.addEventListener("pointerup", e => {
          e.preventDefault();
          const add = parseInt(btn.dataset.add, 10);
          input.value = (parseInt(input.value, 10) || 0) + add;
          updateInputStyle();
        });
      });

      // Reset gomb
      tr.querySelector(".qty-quick-btn[data-reset]")?.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = 0;
        updateInputStyle();
      });

      // +/- gombok
      const [minusBtn, plusBtn] = tr.querySelectorAll(".qty-btn");
      minusBtn.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = (parseInt(input.value, 10) || 0) - 1;
        updateInputStyle();
      });
      plusBtn.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = (parseInt(input.value, 10) || 0) + 1;
        updateInputStyle();
      });

      // Kézi bevitel
      input.addEventListener("input", updateInputStyle);

      // Kézi pótlás (Fulfill Backorder) gomb
      const fulfillBtn = tr.querySelector('.fulfill-btn');
      if (fulfillBtn) {
        fulfillBtn.addEventListener('pointerup', async (e) => {
          e.preventDefault();
          const name = fulfillBtn.dataset.name;
          const amount = parseInt(fulfillBtn.dataset.amount, 10);
          
          if (confirm(`Biztosan kiviszel ${amount} db-ot a raktárból a ${currentBooth === 'bazar' ? 'Bazárba' : 'Krisztiánhoz'}?`)) {
            fulfillBtn.disabled = true;
            fulfillBtn.textContent = '⏳...';
            await fulfillBackorder(name, currentBooth, amount);
          }
        });
      }

      shortageTableBody.appendChild(tr);
    });
  }

  async function fulfillBackorder(name, booth, amount) {
    const boothField = booth === 'bazar' ? 'bazar_stock' : 'fenti_stock';
    
    // Lekérjük a legfrissebb adatokat
    const { data: item, error: fetchErr } = await supabaseClient
      .from('names')
      .select(`id, central_stock, ${boothField}`)
      .eq('name', name)
      .single();
      
    if (fetchErr) { console.error(fetchErr); alert('Hiba!'); return; }

    const central = item.central_stock || 0;
    const pending = item[boothField] || 0;

    if (central < amount || pending < amount) {
      alert('Közben megváltozott a készlet, frissítem az oldalt!');
      loadShortageNames();
      return;
    }

    // Frissítjük a készleteket
    const newCentral = central - amount;
    const newPending = pending - amount;
    const updatePayload = { central_stock: newCentral };
    updatePayload[boothField] = newPending;

    const { error: updErr } = await supabaseClient
      .from('names')
      .update(updatePayload)
      .eq('id', item.id);

    if (updErr) { console.error(updErr); alert('Hiba mentéskor!'); return; }

    // Naplózás
    await supabaseClient.from('transactions').insert({
      type: 'kivisz',
      booth: booth,
      user_name: currentUser || currentRole,
      items: [{ name, qty: amount }],
      notes: 'Kézi pótlás (Várólistáról)'
    });

    alert('Sikeres pótlás!');
    loadShortageNames();
    loadAndRenderNames();
  }

  boothSelect?.addEventListener("change", loadShortageNames);

  // ── ORDER SECTION LOGIKA (Admin only) ────────────────────────
  const orderTableBody = document.querySelector("#order-table tbody");
  const exportOrderBtn = document.getElementById("export-order-btn");

  async function loadOrderNames() {
    const names = await fetchNames();
    if (!orderTableBody) return;
    orderTableBody.innerHTML = "";
    names.forEach(item => {
      const tr = document.createElement("tr");
      tr.dataset.name = item.name;
      tr.innerHTML = `
        <td>${item.name}</td>
        <td>${item.central_stock || 0}</td>
        <td>
          <div class="qty-wrap">
            <div class="qty-quick-btns">
              <button class="qty-quick-btn" data-add="1" aria-label="+1">+1</button>
              <button class="qty-quick-btn" data-add="2" aria-label="+2">+2</button>
              <button class="qty-quick-btn" data-add="3" aria-label="+3">+3</button>
              <button class="qty-quick-btn" data-add="5" aria-label="+5">+5</button>
              <button class="qty-quick-btn qty-reset" data-reset="1" aria-label="Törlés">✕</button>
            </div>
            <div class="qty-control">
              <button class="qty-btn" aria-label="Kivonás">−</button>
              <input type="number" class="styled-input order-qty-input" value="0" min="-9999" max="9999"
                style="width:64px; text-align:center; padding:0.4rem 0.2rem;" />
              <button class="qty-btn" aria-label="Hozzáadás">+</button>
            </div>
          </div>
        </td>
      `;

      const input = tr.querySelector(".order-qty-input");

      function updateInputStyle() {
        const v = parseInt(input.value, 10) || 0;
        input.classList.toggle("qty-input-active", v !== 0);
      }

      tr.querySelectorAll(".qty-quick-btn[data-add]").forEach(btn => {
        btn.addEventListener("pointerup", e => {
          e.preventDefault();
          const add = parseInt(btn.dataset.add, 10);
          input.value = (parseInt(input.value, 10) || 0) + add;
          updateInputStyle();
        });
      });

      tr.querySelector(".qty-quick-btn[data-reset]")?.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = 0;
        updateInputStyle();
      });

      const [minusBtn, plusBtn] = tr.querySelectorAll(".qty-btn");
      minusBtn.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = (parseInt(input.value, 10) || 0) - 1;
        updateInputStyle();
      });
      plusBtn.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = (parseInt(input.value, 10) || 0) + 1;
        updateInputStyle();
      });

      input.addEventListener("input", updateInputStyle);

      orderTableBody.appendChild(tr);
    });
  }

  exportOrderBtn?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    if (typeof XLSX === "undefined") {
      alert("A SheetJS még töltődik be, kérlek várj...");
      return;
    }

    const rows = orderTableBody.querySelectorAll("tr");
    const dataList = [];
    const orderedItems = []; // Ezt mentjük az adatbázisba
    
    // Szűrés és összeszedés
    for (const row of rows) {
      const name = row.dataset.name;
      const qtyStr = row.querySelector('.order-qty-input').value;
      const qty = parseInt(qtyStr, 10) || 0;
      dataList.push({ name, orderStr: qty === 0 ? "" : String(qty) });
      if (qty > 0) {
        orderedItems.push({ name, qty });
      }
    }

    if (orderedItems.length === 0) {
      alert("Nincs mit exportálni! Kérlek adj meg legalább egy rendelési mennyiséget.");
      return;
    }

    // Mátrix generálás (30 sor / oszlop páros)
    const ROWS_PER_COL = 30;
    const matrix = [];
    
    // Először legeneráljuk a 30 üres sort
    for (let i = 0; i < ROWS_PER_COL; i++) {
      matrix.push([]);
    }

    // Beletöltjük az adatokat oszloponként
    for (let i = 0; i < dataList.length; i++) {
      const rowIdx = i % ROWS_PER_COL;
      const colGroupIdx = Math.floor(i / ROWS_PER_COL);
      
      const item = dataList[i];
      
      // Padolni kell a sort, ha még nincs elég oszlop benne
      while (matrix[rowIdx].length < colGroupIdx * 2) {
        matrix[rowIdx].push("");
      }
      
      matrix[rowIdx].push(item.name);
      matrix[rowIdx].push(item.orderStr);
    }

    // Worksheet létrehozás (fejléc nélkül)
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rendelés");
    
    // Fájl mentés
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Rendeles_Export_${dateStr}.xlsx`);

    // ── ADATBÁZIS MENTÉS ───────────────────────────────────────
    try {
      const { error: logErr } = await supabaseClient
        .from('transactions')
        .insert([{
          type: 'rendeles',
          booth: 'admin',
          user_name: currentUser || 'Admin',
          items: orderedItems
        }]);

      if (logErr) {
        console.error("Hiba a rendelés mentésekor:", logErr);
      } else {
        // Töröljük a beírt adatokat a sikeres export után
        rows.forEach(row => {
          const input = row.querySelector('.order-qty-input');
          if (input) {
            input.value = 0;
            input.classList.remove('qty-input-active');
          }
        });
        loadAdminLog(); // frissítsük a naplót a háttérben
      }
    } catch (err) {
      console.error(err);
    }
  });


  // Summary Modal Elements
  const summaryModal = document.getElementById("summary-modal");
  const summaryList = document.getElementById("summary-list");
  const summaryConfirm = document.getElementById("summary-confirm");
  const summaryCancel = document.getElementById("summary-cancel");
  const summaryClose = document.getElementById("summary-close");

  let pendingShortageUpdates = [];
  let selectedBooth = "bazar";

  function openSummaryModal() {
    selectedBooth = boothSelect.value;
    const boothName = selectedBooth === 'bazar' ? 'Bazár' : 'Krisztián';
    const boothLabel = document.getElementById('summary-booth-label');
    if (boothLabel) boothLabel.textContent = `Bódé: ${boothName}`;

    const rows = shortageTableBody.querySelectorAll("tr");
    pendingShortageUpdates = [];
    summaryList.innerHTML = "";

    let hasChanges = false;
    for (const row of rows) {
      const name = row.dataset.name;
      const centralStock = parseInt(row.dataset.central, 10) || 0;
      const pendingShortage = parseInt(row.dataset.pending, 10) || 0;
      const newShortageReq = parseInt(row.querySelector('.shortage-qty-input').value, 10) || 0;
      
      if (newShortageReq === 0) continue;
      hasChanges = true;

      // Hány darabot tudunk egyből pótolni a raktárból?
      const fulfillAmount = Math.min(newShortageReq, centralStock);
      // Mennyi megy a várólistára (függő hiány)?
      const backorderAmount = newShortageReq - fulfillAmount;

      const newCentralStock = centralStock - fulfillAmount;
      const newPendingShortage = pendingShortage + backorderAmount;

      pendingShortageUpdates.push({ 
        name, 
        newShortageReq, 
        fulfillAmount, 
        backorderAmount, 
        newCentralStock, 
        newPendingShortage 
      });

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${name}</td>
        <td><strong>${newShortageReq} db</strong></td>
        <td style="color:${fulfillAmount > 0 ? '#34d399' : 'var(--color-subtext)'}">${fulfillAmount} db</td>
        <td>${newCentralStock}</td>
        <td style="color:${newPendingShortage > 0 ? '#f87171' : 'var(--color-text)'}"><strong>${newPendingShortage} db</strong></td>
      `;
      summaryList.appendChild(tr);
    }

    if (!hasChanges) {
      alert("Nincs kitöltve mennyiség egyetlen tolnál sem.");
      return;
    }

    summaryModal.classList.remove("hidden");
  }

  function closeSummaryModal() {
    summaryModal.classList.add("hidden");
  }

  summaryCancel?.addEventListener("pointerup", e => { e.preventDefault(); closeSummaryModal(); });
  summaryClose?.addEventListener("click", e => { e.preventDefault(); closeSummaryModal(); });
  summaryClose?.addEventListener("pointerup", e => { e.stopPropagation(); e.preventDefault(); closeSummaryModal(); });
  summaryModal?.addEventListener("pointerup", e => { if (e.target === summaryModal) closeSummaryModal(); });

  async function confirmShortage() {
    if (pendingShortageUpdates.length === 0) return;
    
    summaryConfirm.disabled = true;
    summaryConfirm.textContent = "⏳ Mentés...";

    const kiviszItems = [];
    const boothField = selectedBooth === 'bazar' ? 'bazar_stock' : 'fenti_stock';

    for (const update of pendingShortageUpdates) {
      const { name, fulfillAmount, backorderAmount, newCentralStock, newPendingShortage } = update;
      
      if (fulfillAmount > 0) {
        kiviszItems.push({ name, qty: fulfillAmount });
      }
      
      // Update DB with exact calculated states
      const updatePayload = { central_stock: newCentralStock };
      updatePayload[boothField] = newPendingShortage;

      await supabaseClient
        .from('names')
        .update(updatePayload)
        .eq('name', name);
    }

    if (kiviszItems.length > 0) {
      await supabaseClient.from('transactions').insert({
        type: 'kivisz',
        booth: selectedBooth,
        user_name: currentUser || currentRole,
        items: kiviszItems,
        notes: 'Hiány pótlása (Készletről)'
      });
    }
    
    summaryConfirm.disabled = false;
    summaryConfirm.textContent = "✅ Mentés az adatbázisba";
    closeSummaryModal();
    alert('Sikeresen elmentve!');
    
    loadShortageNames();
    loadAndRenderNames();
  }

  summaryConfirm?.addEventListener("pointerup", e => { e.preventDefault(); confirmShortage(); });
  submitShortageBtn?.addEventListener("pointerup", e => { e.preventDefault(); openSummaryModal(); });

  // ── ADMIN LOG SECTION ───────────────────────────────────────
  const refreshLogBtn = document.getElementById("refresh-log");
  const adminLogTableBody = document.querySelector("#admin-log-table tbody");

  async function deleteTransaction(rec) {
    const isConfirmed = confirm(`Biztosan törlöd ezt a tranzakciót (${rec.type})?\nEz visszavonja a készletváltozásokat is!`);
    if (!isConfirmed) return;

    try {
      // Ha kivisz vagy visszahoz, akkor visszaállítjuk a készletet
      if (rec.type === 'kivisz' || rec.type === 'visszahoz') {
        const items = Array.isArray(rec.items) ? rec.items : [];
        for (const item of items) {
          // Kivitel esetén (qty pozitív) -> levonódott a raktárból -> negatívval hívjuk hogy visszategye
          // Visszahoz esetén (qty pozitív a logban) -> hozzáadódott -> pozitívval hívjuk hogy levegye
          const reverseQty = rec.type === 'kivisz' ? -Math.abs(item.qty) : Math.abs(item.qty);
          await updateStock(item.name, rec.booth, reverseQty);
        }
      }

      // Törlés az adatbázisból
      const { error } = await supabaseClient.from('transactions').delete().eq('id', rec.id);
      if (error) throw error;

      alert("Tranzakció sikeresen törölve, készlet visszaállítva!");
      loadAdminLog();
      loadAndRenderNames();
    } catch (err) {
      console.error(err);
      alert("Hiba történt a törlés során: " + err.message);
    }
  }

  async function loadAdminLog() {
    adminLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-subtext);">⏳ Betöltés...</td></tr>`;
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      adminLogTableBody.innerHTML = `<tr><td colspan="5" style="color:#f87171;">Hiba: ${error.message}</td></tr>`;
      console.error(error);
      return;
    }
    adminLogTableBody.innerHTML = "";
    if (!data || data.length === 0) {
      adminLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-subtext);">Nincs bejegyzés</td></tr>`;
      return;
    }
    data.forEach(rec => {
      let typeLabel = rec.type;
      if (rec.type === 'kivisz') typeLabel = '⬆️ Kivitt';
      else if (rec.type === 'visszahoz') typeLabel = '⬇️ Visszahozott';
      else if (rec.type === 'rendeles') typeLabel = '🛒 Rendelés';

      let boothLabel = rec.booth;
      if (rec.booth === 'bazar') boothLabel = 'Bazár';
      else if (rec.booth === 'fenti') boothLabel = 'Krisztián';
      else if (rec.booth === 'admin') boothLabel = 'Export';
      else if (!boothLabel) boothLabel = '–';

      const items = Array.isArray(rec.items) ? rec.items : [];
      const totalItems = items.reduce((sum, item) => sum + Math.abs(item.qty), 0);
      const uniqueItems = items.length;

      // Fő sor (kattintható)
      const mainTr = document.createElement('tr');
      mainTr.className = 'log-main-row';
      mainTr.innerHTML = `
        <td>${new Date(rec.created_at).toLocaleString('hu-HU')}</td>
        <td>${rec.user_name || '–'}</td>
        <td>${boothLabel}</td>
        <td>${typeLabel}</td>
        <td><strong>${totalItems} db</strong> (${uniqueItems} fajta) <span style="float:right; font-size:0.8rem;">▼</span></td>
      `;

      // Részletek sor (rejtett)
      const detailsTr = document.createElement('tr');
      detailsTr.className = 'log-details-row';
      
      const itemsHtml = items.map(item => `
        <li>
          <span>${item.name}</span>
          <span class="log-qty-badge">${item.qty} db</span>
        </li>
      `).join('');

      detailsTr.innerHTML = `
        <td colspan="5" style="padding: 0;">
          <div class="log-details-content">
            <ul>${itemsHtml}</ul>
            <div style="margin-top: 1rem; text-align: right;">
              <button class="cta-button del-transaction-btn" style="background:#ef4444; padding:0.4rem 1rem; font-size:0.85rem;">🗑️ Tranzakció Törlése</button>
            </div>
          </div>
        </td>
      `;

      const delBtn = detailsTr.querySelector('.del-transaction-btn');
      delBtn.addEventListener('pointerup', (e) => {
        e.stopPropagation();
        deleteTransaction(rec);
      });

      // Kattintás esemény
      mainTr.addEventListener("pointerup", (e) => {
        e.preventDefault();
        const isOpen = detailsTr.classList.contains("open");
        // Bezárunk minden mást (opcionális, de átláthatóbb)
        document.querySelectorAll('.log-details-row.open').forEach(row => row.classList.remove('open'));
        if (!isOpen) {
          detailsTr.classList.add("open");
        }
      });

      adminLogTableBody.appendChild(mainTr);
      adminLogTableBody.appendChild(detailsTr);
    });
  }

  refreshLogBtn?.addEventListener('pointerup', e => { e.preventDefault(); loadAdminLog(); });

  // ── STATISZTIKA ───────────────────────────────────────────────
  const statsPeriod = document.getElementById("stats-period");
  const refreshStatsBtn = document.getElementById("refresh-stats");
  const statsCards = document.getElementById("stats-cards");
  const statsTableBody = document.querySelector("#stats-table tbody");

  async function loadStats() {
    const days = parseInt(statsPeriod?.value || "7", 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    statsCards.innerHTML = `<p style="color:var(--color-subtext);">⏳ Betöltés...</p>`;
    statsTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--color-subtext);">⏳ Betöltés...</td></tr>`;

    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .gte('created_at', since.toISOString())
      .in('type', ['kivisz', 'visszahoz']);

    if (error) {
      statsCards.innerHTML = `<p style="color:#f87171;">Hiba: ${error.message}</p>`;
      console.error(error);
      return;
    }

    // Count by pen and type
    const byPen = {};
    let totalKivisz = 0, totalVissza = 0, totalPen = 0;
    (data || []).forEach(rec => {
      const items = Array.isArray(rec.items) ? rec.items : [];
      items.forEach(item => {
        if (!byPen[item.name]) byPen[item.name] = { kivisz: 0, vissza: 0, last: null };
        if (rec.type === 'kivisz') { byPen[item.name].kivisz += item.qty; totalKivisz += item.qty; }
        if (rec.type === 'visszahoz') { byPen[item.name].vissza += item.qty; totalVissza += item.qty; }
        const d = new Date(rec.created_at);
        if (!byPen[item.name].last || d > byPen[item.name].last) byPen[item.name].last = d;
      });
    });
    totalPen = Object.keys(byPen).length;

    // Stat cards
    const makeCard = (icon, label, value, sub) => `
      <div style="background:var(--color-surface); border:1px solid var(--color-border); border-radius:12px; padding:1.2rem; text-align:center;">
        <div style="font-size:2rem;">${icon}</div>
        <div style="font-size:1.8rem; font-weight:700; color:var(--color-accent);">${value}</div>
        <div style="font-size:0.85rem; color:var(--color-text);">${label}</div>
        ${sub ? `<div style="font-size:0.75rem; color:var(--color-subtext);">${sub}</div>` : ''}
      </div>
    `;
    statsCards.innerHTML = [
      makeCard('📦', 'Kivitt összesen', totalKivisz + ' db', `utolsó ${days} napban`),
      makeCard('🔙', 'Visszahozatal', totalVissza + ' db', `utolsó ${days} napban`),
      makeCard('🖊️', 'Aktivitásban levő tollak', totalPen + ' féle', `utolsó ${days} napban`),
    ].join('');

    // Table
    statsTableBody.innerHTML = "";
    const sorted = Object.entries(byPen).sort((a, b) => b[1].kivisz - a[1].kivisz);
    if (sorted.length === 0) {
      statsTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--color-subtext);">Nincs adat az időszakra</td></tr>`;
      return;
    }
    sorted.forEach(([name, d]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${name}</td>
        <td><strong>${d.kivisz} db</strong>${d.vissza ? ` <span style="color:var(--color-subtext); font-size:0.8rem;">(-${d.vissza})</span>` : ''}</td>
        <td>${d.last ? d.last.toLocaleString('hu-HU') : '–'}</td>
      `;
      statsTableBody.appendChild(tr);
    });
  }

  refreshStatsBtn?.addEventListener('pointerup', e => { e.preventDefault(); loadStats(); });
  statsPeriod?.addEventListener('change', loadStats);

  // ── NEVEK / KÉSZLET (names tábla) ────────────────────────────
  async function fetchNames() {
    const { data, error } = await supabaseClient
      .from("names")
      .select("id, name, central_stock, bazar_stock, fenti_stock, is_active")
      .order("name", { ascending: true });
    if (error) { console.error("fetchNames:", error); return []; }
    return data;
  }

  // ── STOCK UPDATE LOGIC ────────────────────────────────────────
  async function updateStock(name, booth, qty) {
    // qty > 0 => shortage: take from raktár (central_stock)
    // qty < 0 => fill-in: add back to raktár
    const { data: item, error: fetchErr } = await supabaseClient
      .from('names')
      .select('id, central_stock')
      .eq('name', name)
      .single();
    if (fetchErr) { console.error('updateStock fetch error', fetchErr); return; }

    let { central_stock } = item;
    central_stock = central_stock || 0;

    if (qty > 0) {
      central_stock -= qty; // may go negative if not enough
    } else {
      central_stock += Math.abs(qty); // return/overage adds back
    }

    const { error: updErr } = await supabaseClient
      .from('names')
      .update({ central_stock })
      .eq('id', item.id);
    if (updErr) console.error('updateStock error', updErr);
  }

  function renderNameRow(item) {
    const tr = document.createElement("tr");
    tr.dataset.id = item.id;
    const stock = item.central_stock ?? 0;
    const incoming = item.incoming_stock ?? 0;
    const totalExpected = stock + incoming;
    
    const classIfNeg = stock < 0 ? 'class="negative-stock"' : '';
    
    tr.innerHTML = `
      <td>${item.name}</td>
      <td ${classIfNeg}>${stock}</td>
      <td data-role="admin">${incoming}</td>
      <td data-role="admin"><strong>${totalExpected}</strong></td>
      <td>
        <button class="edit-btn" aria-label="Szerkesztés">✏️</button>
        <button class="del-btn"  aria-label="Törlés">🗑️</button>
      </td>`;
      
    // Re-apply role visibility for the new cells
    if (currentRole !== 'admin') {
      tr.querySelectorAll('[data-role="admin"]').forEach(el => el.style.display = 'none');
    }

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
    const newName = prompt("Toll neve:", item.name);
    if (newName === null) return;
    const stock = parseInt(prompt("Raktárkészlet (db):", item.central_stock ?? 0), 10) || 0;
    const incoming = parseInt(prompt("Úton lévő készlet (db):", item.incoming_stock ?? 0), 10) || 0;
    
    supabaseClient.from("names")
      .update({ name: newName, central_stock: stock, incoming_stock: incoming })
      .eq("id", item.id)
      .then(({ error }) => { if (error) { alert("Hiba: " + error.message); console.error(error); } else loadAndRenderNames(); });
  }

  function deleteName(id) {
    if (!confirm("Biztos törölnéd ezt a tolt?")) return;
    supabaseClient.from("names").delete().eq("id", id)
      .then(({ data, error }) => {
        if (error) {
          alert("Törlés sikertelen: " + error.message);
          console.error("delete error:", error);
        } else {
          loadAndRenderNames();
        }
      });
  }

  addItemBtn?.addEventListener("pointerup", (e) => { e.preventDefault(); addName(); });

  // ── MINDEN TÖRLÉSE (admin) ────────────────────────────────
  document.getElementById("delete-all-names")?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    if (!confirm("⚠️ FIGYELEM!\nEz TÖRLI az összes nevet és készlet adatot!\n\nBiztos vagy benne?")) return;
    if (!confirm("Utolsó esély: TÉNYLEG töröljünk MINDENT?")) return;

    const { error } = await supabaseClient.from("names").delete().not("id", "is", null);
    if (error) {
      alert("Hiba a törlés során: " + error.message);
      console.error(error);
    } else {
      alert("✅ Minden név törölve! Most importálhatsz tiszta lappal.");
      loadAndRenderNames();
      loadShortageNames();
    }
  });

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
  let parsedRecords = [];
  let sheetHeaders = [];
  let currentStockData = {};

  const importIncomingBtn = document.getElementById("import-incoming-btn");
  const importIncomingFile = document.getElementById("import-incoming-file");

  async function fetchCurrentStockForImport() {
    currentStockData = {};
    const names = await fetchNames();
    names.forEach(n => {
      // Store full object for both central_stock and incoming_stock
      currentStockData[n.name.toLowerCase()] = n;
    });
  }

  const confirmIncomingBtn = document.getElementById("confirm-incoming-btn");
  confirmIncomingBtn?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    if (!confirm("Biztosan megérkezett az úton lévő áru?\nEz hozzáadja az úton lévő mennyiségeket a valós raktárkészlethez, majd lenullázza az úton lévőket.")) return;

    confirmIncomingBtn.disabled = true;
    confirmIncomingBtn.textContent = "⏳ Feldolgozás...";

    try {
      const names = await fetchNames();
      const itemsToUpdate = names.filter(n => (n.incoming_stock || 0) > 0);

      if (itemsToUpdate.length === 0) {
        alert("Nincs úton lévő áru, amit be lehetne fogadni!");
        confirmIncomingBtn.disabled = false;
        confirmIncomingBtn.textContent = "✅ Áru beérkezett";
        return;
      }

      const updates = itemsToUpdate.map(n => {
        return {
          id: n.id,
          name: n.name,
          central_stock: (n.central_stock || 0) + n.incoming_stock,
          incoming_stock: 0
        };
      });

      // Update in Supabase
      const { error } = await supabaseClient.from("names").upsert(updates);
      if (error) throw error;

      // Log transaction
      const logItems = itemsToUpdate.map(n => ({ name: n.name, qty: n.incoming_stock }));
      await supabaseClient.from('transactions').insert({
        type: 'feltoltes',
        booth: 'kozponti',
        user_name: currentUser || currentRole,
        items: logItems,
        notes: 'Úton lévő áru beérkezett'
      });

      alert(`Sikeresen befogadva ${itemsToUpdate.length} féle toll!`);
      loadAndRenderNames();
      loadShortageNames(); // Refresh shortage table as well
      if (currentRole === 'admin') loadAdminLog();
    } catch (err) {
      console.error(err);
      alert("Hiba történt: " + err.message);
    }
    confirmIncomingBtn.disabled = false;
    confirmIncomingBtn.textContent = "✅ Áru beérkezett";
  });

  importInventoryBtn?.addEventListener("pointerup", (e) => {
    e.preventDefault(); importTarget = "names"; importInventoryFile.value = ""; importInventoryFile.click();
  });
  importPensBtn?.addEventListener("pointerup", (e) => {
    e.preventDefault(); importTarget = "pens"; importPensFile.value = ""; importPensFile.click();
  });
  importIncomingBtn?.addEventListener("pointerup", (e) => {
    e.preventDefault(); importTarget = "incoming"; importIncomingFile.value = ""; importIncomingFile.click();
  });

  importInventoryFile.addEventListener("change", (e) => handleFileSelected(e, "names"));
  importPensFile.addEventListener("change",      (e) => handleFileSelected(e, "pens"));
  importIncomingFile?.addEventListener("change", (e) => handleFileSelected(e, "incoming"));

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

  function openImportModal() {
    modalTitle.textContent = importTarget === "names" ? "Excel Import – Készlet" : "Excel Import – Tollak";
    sheetSelect.innerHTML = "";
    workbookData.SheetNames.forEach(name => {
      const opt = document.createElement("option");
      opt.value = opt.textContent = name;
      sheetSelect.appendChild(opt);
    });
    
    if (importTarget === "names") {
      document.getElementById("import-mode-row").style.display = "flex";
      fetchCurrentStockForImport().then(() => {
        updateSheetSelection();
      });
    } else {
      document.getElementById("import-mode-row").style.display = "none";
      updateSheetSelection();
    }
    
    sheetSelect.onchange = updateSheetSelection;
    document.querySelectorAll('input[name="import_mode"]').forEach(r => r.addEventListener('change', updateImportPreview));
    
    modal.classList.remove("hidden");
  }

  function updateSheetSelection() {
    const sheetName = sheetSelect.value;
    const ws = workbookData.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    
    let maxCols = 0;
    rawData.slice(0, 5).forEach(row => { if (row.length > maxCols) maxCols = row.length; });
    
    sheetHeaders = [];
    for (let i = 0; i < maxCols; i++) {
      let hint = "";
      for (let r = 0; r < Math.min(3, rawData.length); r++) {
         if (rawData[r][i] !== undefined && rawData[r][i] !== "") {
           hint = String(rawData[r][i]).trim();
           break;
         }
      }
      if (hint.length > 15) hint = hint.substring(0, 15) + "...";
      sheetHeaders.push(`${i + 1}. oszlop${hint ? ` (pl. ${hint})` : ''}`);
    }
    
    renderColumnMapping(rawData);
    updateImportPreview();
  }

  function renderColumnMapping(rawData) {
    colMapFields.innerHTML = "";
    if (sheetHeaders.length === 0) {
      colMapFields.innerHTML = "<span>Nincsenek oszlopok a lapon.</span>";
      return;
    }

    const skipDiv = document.createElement("div");
    skipDiv.style.marginBottom = "1rem";
    skipDiv.innerHTML = `<label style="display:flex; align-items:center; gap:0.5rem; font-weight:normal; cursor:pointer; color:var(--color-text);">
      <input type="checkbox" id="skip-header" /> 
      Az első sor csak fejléc (ne importálja)
    </label>`;
    skipDiv.querySelector("input").onchange = updateImportPreview;
    colMapFields.appendChild(skipDiv);

    // Alapértelmezetten NEM pipáljuk be – a felhasználó dönti el, hogy fejléc-e az első sor.
    // (A korábbi auto-detektálás tévesen kihagyta az első adatsort, pl. ha A1-ben volt a név.)

    const createSelect = (id, label) => {
      const div = document.createElement("div");
      div.className = "col-map-item";
      div.innerHTML = `<label>${label}</label><select id="${id}" class="styled-select"><option value="">-- Ne importálja --</option></select>`;
      const sel = div.querySelector("select");
      sheetHeaders.forEach((h, i) => {
        const opt = document.createElement("option");
        opt.value = i;
        opt.textContent = h;
        sel.appendChild(opt);
      });
      sel.onchange = updateImportPreview;
      colMapFields.appendChild(div);
      return sel;
    };

    const nameSelect = createSelect("col-name", "Toll Neve (Oszlop)");
    nameSelect.innerHTML = `<option value="auto">✨ Automatikus felismerés (Bárhol a lapon)</option>` + nameSelect.innerHTML;
    nameSelect.value = "auto";

    if (importTarget === "names") {
      const stockSelect = createSelect("col-stock", "Készlet Oszlop (Raktár)");
      stockSelect.innerHTML = `<option value="auto">✨ Automatikus felismerés (A név mellett)</option>` + stockSelect.innerHTML;
      stockSelect.value = "auto";
    }
  }

  function updateImportPreview() {
    const sheetName = sheetSelect.value;
    const ws = workbookData.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    
    const nameColIdx = document.getElementById("col-name")?.value;
    const stockColIdx = document.getElementById("col-stock")?.value;
    const skipHeader = document.getElementById("skip-header")?.checked;
    
    parsedRecords = [];
    // Map: name.toLowerCase() → index a parsedRecords tömbben
    // Ha egy nevet kétszer látunk (egyszer szám nélkül, egyszer számmal),
    // a számmal rendelkező bejegyzés felülírja a 0-ás verziót.
    const seenIdx = new Map();
    
    const startIndex = skipHeader ? 1 : 0;
    
    for (let i = startIndex; i < rawData.length; i++) {
      const row = rawData[i];
      
      if (nameColIdx === "auto") {
        // Auto-detect pairs anywhere in the row
        for (let c = 0; c < row.length; c++) {
          let cellStr = String(row[c] ?? "").trim();
          if (cellStr && !/^\d+$/.test(cellStr) && cellStr.length >= 2) {
            const key = cellStr.toLowerCase();
            let s = NaN;
            let hasNumber = false;
            if (stockColIdx === "auto" && c + 1 < row.length) {
              const parsed = parseInt(row[c + 1], 10);
              if (!isNaN(parsed)) {
                s = parsed;
                hasNumber = true;
                c++; // Consume the number cell so we don't process it as a name
              }
            }

            if (importTarget === "names" || importTarget === "incoming") {
              const mode = document.querySelector('input[name="import_mode"]:checked')?.value || "add";
              const currentObj = currentStockData[key] || {};
              const currentStock = importTarget === "names" ? (currentObj.central_stock || 0) : (currentObj.incoming_stock || 0);

              if (!hasNumber && mode === "add" && (key in currentStockData)) {
                // Add módban: ha nincs szám ÉS már létezik → kihagyjuk, nem bántjuk a meglévő készletet
                if (!seenIdx.has(key)) {
                  seenIdx.set(key, parsedRecords.length);
                  parsedRecords.push({ name: cellStr, old_stock: currentStock, new_stock: currentStock, _noChange: true });
                }
              } else {
                const newStock = hasNumber ? (mode === "add" ? currentStock + s : s) : 0;
                if (seenIdx.has(key)) {
                  // Már láttuk – csak akkor frissítjük, ha most van mellette explicit szám
                  if (hasNumber) {
                    const idx = seenIdx.get(key);
                    parsedRecords[idx].new_stock = newStock;
                    parsedRecords[idx].old_stock = currentStock;
                    delete parsedRecords[idx]._noChange;
                  }
                } else {
                  seenIdx.set(key, parsedRecords.length);
                  parsedRecords.push({ name: cellStr, old_stock: currentStock, new_stock: newStock });
                }
              }
            } else {
              // pens target
              if (!seenIdx.has(key)) {
                seenIdx.set(key, parsedRecords.length);
                parsedRecords.push({ name: cellStr, type: null });
              }
            }
          }
        }
      } else {
        // Specific column mapping
        let name = "";
        if (nameColIdx !== "" && nameColIdx !== undefined) name = String(row[nameColIdx] || "").trim();
        const key = name.toLowerCase();
        
        if (name && name.length >= 2) {
          if ((importTarget === "names" || importTarget === "incoming") && stockColIdx !== "" && stockColIdx !== undefined && stockColIdx !== "auto") {
            const rawS = parseInt(row[stockColIdx], 10);
            const hasNumber = !isNaN(rawS);
            const s = hasNumber ? rawS : 0;
            const mode = document.querySelector('input[name="import_mode"]:checked')?.value || "add";
            const currentObj = currentStockData[key] || {};
            const currentStock = importTarget === "names" ? (currentObj.central_stock || 0) : (currentObj.incoming_stock || 0);

            if (!hasNumber && mode === "add" && (key in currentStockData)) {
              if (!seenIdx.has(key)) {
                seenIdx.set(key, parsedRecords.length);
                parsedRecords.push({ name, old_stock: currentStock, new_stock: currentStock, _noChange: true });
              }
            } else {
              const newStock = hasNumber ? (mode === "add" ? currentStock + s : s) : 0;
              if (seenIdx.has(key)) {
                if (hasNumber) {
                  const idx = seenIdx.get(key);
                  parsedRecords[idx].new_stock = newStock;
                  parsedRecords[idx].old_stock = currentStock;
                  delete parsedRecords[idx]._noChange;
                }
              } else {
                seenIdx.set(key, parsedRecords.length);
                parsedRecords.push({ name, old_stock: currentStock, new_stock: newStock });
              }
            }
          } else if (!seenIdx.has(key)) {
            const rec = { name };
            if (importTarget === "pens") rec.type = null;
            seenIdx.set(key, parsedRecords.length);
            parsedRecords.push(rec);
          }
        }
      }
    }

    const showStock = (importTarget === "names" || importTarget === "incoming") && stockColIdx !== "";
    previewThead.innerHTML = `<tr><th>#</th><th>Toll neve</th>${showStock ? '<th>Készlet (Régi ➔ Új)</th>' : ''}</tr>`;
    
    previewTbody.innerHTML = parsedRecords.slice(0, 10)
      .map((rec, i) => `<tr><td>${i + 1}</td><td>${rec.name}</td>${showStock ? `<td>${rec.old_stock ?? ''} ➔ <b>${rec.new_stock ?? ''}</b></td>` : ''}</tr>`).join("");
      
    previewCount.textContent = parsedRecords.length > 0
      ? `Összesen ${parsedRecords.length} egyedi sort találtam${parsedRecords.length > 10 ? " (előnézet: első 10)" : ""}.`
      : "Válassz ki egy oszlopot a nevekhez az importáláshoz!";
  }

  function closeModal() {
    modal.classList.add("hidden"); workbookData = null; parsedRecords = []; importTarget = null; currentStockData = {};
  }
  modalClose?.addEventListener("pointerup",  (e) => { e.preventDefault(); closeModal(); });
  modalCancel?.addEventListener("pointerup", (e) => { e.preventDefault(); closeModal(); });
  modal?.addEventListener("pointerup", (e) => { if (e.target === modal) closeModal(); });

  modalImport?.addEventListener("pointerup", async (e) => { e.preventDefault(); await runImport(); });

  async function runImport() {
    const nameColIdx = document.getElementById("col-name")?.value;
    if (nameColIdx === "" || nameColIdx === undefined) {
      alert("Kérlek válassz ki egy oszlopot a toll nevének!");
      return;
    }
    if (!parsedRecords.length) { alert("Nincs importálható adat."); return; }

    modalImport.disabled = true;
    modalImport.textContent = `⏳ Importálás (${parsedRecords.length} sor)...`;

    // For names, ignoreDup is false so it updates central_stock. For pens, ignoreDup is true.
    const ignoreDup = importTarget === "pens";

    const finalRecords = parsedRecords
      .filter(r => !r._noChange) // Add módban szám nélküli nevek → nem módosítjuk
      .map(r => {
        const copy = { ...r };
        delete copy.old_stock;  // Ideiglenes UI prop
        delete copy._noChange;  // Ideiglenes jelölő
        return copy;
      });

    if (!finalRecords.length) { alert("Nincs importálható adat (minden sor változatlan marad)."); modalImport.disabled = false; modalImport.textContent = "✅ Importálás"; return; }

    const { error } = await supabaseClient
      .from(importTarget)
      .upsert(finalRecords, { onConflict: "name", ignoreDuplicates: ignoreDup });
      
    if (error) {
      alert("Hiba az importálás során:\n" + error.message);
      console.error(error);
    } else {
      closeModal();
      if (importTarget === "names") {
        loadAndRenderNames();
        loadShortageNames(); // Refresh shortage table as well
      } else {
        loadAndRenderPens();
      }
      alert(`✅ Sikeresen importálva: ${parsedRecords.length} rekord.`);
    }
    modalImport.disabled = false;
    modalImport.textContent = "✅ Importálás";
  }

  // ── REAL-TIME ────────────────────────────────────────────────
  let realtimeTimer = null;
  function debouncedReload() {
    clearTimeout(realtimeTimer);
    realtimeTimer = setTimeout(() => {
      loadAndRenderNames();
      loadShortageNames();
      loadOrderNames();
    }, 300);
  }

  function subscribeRealtime() {
    supabaseClient.channel("public:names")
      .on("postgres_changes", { event: "*", schema: "public", table: "names" }, debouncedReload)
      .subscribe();
  }

  // ── INDÍTÁS ──────────────────────────────────────────────────
  function initApp() {
    // Ha korábban belépett ezen az eszközön → automatikus bejelentkezés
    const savedUser = localStorage.getItem("pix_user");
    const savedRole = localStorage.getItem("pix_role");
    if (savedUser && savedRole) {
      selectUser(savedUser, savedRole);
    } else {
      applyRoleVisibility();
      loadAndRenderNames();
      loadShortageNames();
      loadOrderNames();
    }
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
