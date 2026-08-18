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
    if (id === "osszeiras-log-section") loadOsszeirasLog();
    if (id === "import-log-section") loadImportLog();
    if (id === "inventory-count-section") loadInventoryCount();
  }
  navItems.forEach(item => {
    item.addEventListener("pointerup", (e) => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      if (item.dataset.section) {
        if (item.dataset.section === "shortage-section") {
          document.getElementById("booth-prompt-modal")?.classList.remove("hidden");
        }
        showSection(item.dataset.section);
      }
    });
  });

  document.querySelectorAll(".booth-prompt-btn").forEach(btn => {
    btn.addEventListener("pointerup", e => {
      e.preventDefault();
      const booth = btn.dataset.booth;
      const boothSelect = document.getElementById("booth-select");
      if (boothSelect) boothSelect.value = booth;
      document.getElementById("booth-prompt-modal").classList.add("hidden");

      const draftStr = localStorage.getItem('pix_draft_shortage');
      if (draftStr && draftStr !== '{}') {
        if (!confirm("Korábban megkezdett összeírás található.\nSzeretnéd folytatni?\n(Ha a Mégsem/Cancel-re kattintasz, törlődik a piszkozat)")) {
          localStorage.removeItem('pix_draft_shortage');
        }
      }

      loadShortageNames();
    });
  });
  document.getElementById("booth-prompt-cancel")?.addEventListener("pointerup", e => {
    e.preventDefault();
    document.getElementById("booth-prompt-modal").classList.add("hidden");
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

  // ── CATEGORIES ────────────────────────────────────────────────
  let globalCategories = [];
  
  async function fetchCategories() {
    const { data, error } = await supabaseClient.from('categories').select('*').order('limit_stock', { ascending: false });
    if (error) { console.error('fetchCategories:', error); return; }
    globalCategories = data || [];
    populateCategoryDropdowns();
    renderCategoriesTable();
  }
  
  function getCategory(id) {
    return globalCategories.find(c => c.id === id) || { id, name: 'Ismeretlen', icon: '❓', limit_stock: 0 };
  }
  
  function populateCategoryDropdowns() {
    const filters = document.querySelectorAll('.category-filter-select');
    const editSelect = document.getElementById('edit-item-category');
    
    const filterOptionsHTML = `
      <option value="ALL">Minden kategória</option>
      <option value="CRITICAL">⚠️ Csak a kritikus készletűek</option>
      ${globalCategories.map(c => `<option value="${c.id}">${c.icon} ${c.name} (${c.id})</option>`).join('')}
    `;
    filters.forEach(f => {
      const currentVal = f.value;
      f.innerHTML = filterOptionsHTML;
      if (currentVal && currentVal !== '') f.value = currentVal;
    });

    if (editSelect) {
      editSelect.innerHTML = globalCategories.map(c => `<option value="${c.id}">${c.icon} ${c.name} (${c.id})</option>`).join('');
    }
  }

  // ── GLOBAL SEARCH ÉS SZŰRÉS ───────────────────────────────
  const globalSearchInput = document.getElementById("global-search-input");
  const categoryFilters = document.querySelectorAll(".category-filter-select");
  
  let currentFilterMode = "ALL";

  categoryFilters.forEach(select => {
    select.addEventListener("change", (e) => {
      currentFilterMode = e.target.value;
      // Szinkronizáljuk a többi legördülőt is
      categoryFilters.forEach(s => { if (s !== e.target) s.value = currentFilterMode; });
      applyGlobalSearchFilter();
    });
  });
  
  function matchPrefix(text, term) {
    if (!term) return true;
    const words = text.toLowerCase().split(/[\s,.\-_\(\)\[\]:;]+/);
    return words.some(w => w.startsWith(term));
  }

  function applyGlobalSearchFilter() {
    const term = globalSearchInput ? globalSearchInput.value.toLowerCase() : "";
    const filterMode = currentFilterMode;
    
    const tablesToFilter = ["#inventory-table", "#shortage-table", "#pens-table", "#order-table", "#stats-table", "#low-stock-table", "#inventory-count-table"];
    tablesToFilter.forEach(tableSelector => {
      const isStatsTable = tableSelector === "#stats-table" || tableSelector === "#low-stock-table";
      document.querySelectorAll(`${tableSelector} tbody tr`).forEach(tr => {
        const name = tr.dataset.name?.toLowerCase() || tr.firstElementChild?.textContent.trim().toLowerCase() || "";
        
        let showByName = matchPrefix(name, term);
        let showByCat = true;
        
        if (!isStatsTable) {
          const cat = tr.dataset.category || "C";
          const stock = parseInt(tr.dataset.stock, 10) || 0;
          if (filterMode === "CRITICAL") {
            const limit = getCategory(cat).limit_stock;
            if (stock >= limit) showByCat = false;
          } else if (filterMode !== "ALL") {
            if (cat !== filterMode) showByCat = false;
          }
        }
        
        if (showByName && showByCat) {
          tr.style.display = "";
        } else {
          tr.style.display = "none";
        }
      });
    });

    const filterLogTable = (tbodyId) => {
      const tbody = document.querySelector(tbodyId);
      if (!tbody) return;
      const rows = tbody.children;
      for (let i = 0; i < rows.length; i += 2) {
        const mainTr = rows[i];
        const detailsTr = rows[i+1];
        if (!mainTr || !detailsTr) continue;
        
        const text = (mainTr.textContent + " " + detailsTr.textContent).toLowerCase();
        if (matchPrefix(text, term)) {
          mainTr.style.display = "";
          detailsTr.style.display = "";
        } else {
          mainTr.style.display = "none";
          detailsTr.style.display = "none";
        }
      }
    };
    filterLogTable("#admin-log-table tbody");
    filterLogTable("#osszeiras-log-table tbody");
    filterLogTable("#import-log-table tbody");
  }

  globalSearchInput?.addEventListener("input", applyGlobalSearchFilter);
  
  const floatingSearchBtn = document.getElementById("floating-search-btn");
  const floatingSearchContainer = document.getElementById("floating-search-container");
  
  floatingSearchBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    floatingSearchContainer.classList.toggle("active");
    if (floatingSearchContainer.classList.contains("active")) {
      globalSearchInput.focus();
    } else {
      if (globalSearchInput.value !== "") {
        globalSearchInput.value = "";
        applyGlobalSearchFilter();
      }
    }
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
    
    // Update table header to explicitly show which booth we are looking at
    const shortageHeader = document.querySelector("#shortage-table th:nth-child(3)");
    if (shortageHeader) {
      shortageHeader.textContent = currentBooth === 'bazar' ? 'Bazár hiányzik' : 'Krisztián hiányzik';
    }

    names.forEach(item => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      tr.dataset.name = item.name;
      tr.dataset.central = item.central_stock || 0;
      tr.dataset.category = item.category || 'C';
      tr.dataset.stock = item.central_stock || 0;
      
      const pendingShortage = item[boothField] || 0;
      tr.dataset.pending = pendingShortage;

      let fulfillBtnHtml = '';
      if (pendingShortage > 0 && (item.central_stock || 0) > 0) {
        const fulfillAmount = Math.min(pendingShortage, item.central_stock);
        fulfillBtnHtml = `<button class="cta-button secondary fulfill-btn" data-name="${item.name}" data-amount="${fulfillAmount}" style="margin-left: 8px; padding: 0.2rem 0.5rem; font-size: 0.8rem;">Pótlás (${fulfillAmount})</button>`;
      }

      const stock = item.central_stock || 0;
      let stockStyle = '';
      if (stock === 0) stockStyle = 'style="color:#f87171; font-weight:bold;"';
      else if (stock < 0) stockStyle = 'class="negative-stock"';

      tr.innerHTML = `
        <td>
          <div style="font-weight: bold; font-size: 1.1rem; color: var(--color-accent);">${item.name}</div>
          <div style="margin-top: 0.4rem; font-size: 0.85rem; color: var(--color-subtext);">
            Jelenlegi hiány: <span style="font-weight: bold; color: ${pendingShortage > 0 ? '#f87171' : 'var(--color-text)'}">${pendingShortage} db</span>
            ${fulfillBtnHtml}
          </div>
        </td>
        <td ${stockStyle} style="text-align: center; font-size: 1.1rem;">${stock}</td>
        <td>
          <div class="qty-wrap" style="align-items: center; justify-content: center;">
            <div class="qty-quick-btns" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 100%;">
              <button class="qty-quick-btn" data-add="1" aria-label="+1">+1</button>
              <button class="qty-quick-btn" data-add="2" aria-label="+2">+2</button>
              <button class="qty-quick-btn" data-add="3" aria-label="+3">+3</button>
              <button class="qty-quick-btn" data-add="4" aria-label="+4">+4</button>
              <button class="qty-quick-btn" data-add="5" aria-label="+5">+5</button>
              <button class="qty-quick-btn qty-reset" data-reset="1" aria-label="Törlés" style="padding:0.4rem; font-size:1.1rem;">✕</button>
            </div>
            <div class="qty-control" style="margin-top: 4px; width: 100%;">
              <input type="number" inputmode="numeric" pattern="[0-9]*" class="styled-input shortage-qty-input" value="0" min="-9999" max="9999"
                style="width:100%; text-align:center; padding:0.4rem 0.2rem; font-weight: bold; font-size: 1.1rem;" />
            </div>
          </div>
        </td>
      `;

      const input = tr.querySelector(".shortage-qty-input");

      function updateInputStyle() {
        const v = parseInt(input.value, 10) || 0;
        input.classList.toggle("qty-input-active", v !== 0);
      }

      function saveDraftShortage() {
        const draft = {};
        document.querySelectorAll('#shortage-table tbody tr').forEach(row => {
          const inp = row.querySelector('.shortage-qty-input');
          if (inp) {
            const val = parseInt(inp.value, 10);
            if (val !== 0 && !isNaN(val)) {
              draft[row.dataset.name] = val;
            }
          }
        });
        localStorage.setItem('pix_draft_shortage', JSON.stringify(draft));
      }

      function loadDraftValue() {
        try {
          const draft = JSON.parse(localStorage.getItem('pix_draft_shortage') || '{}');
          if (draft[item.name]) {
            input.value = draft[item.name];
            updateInputStyle();
          }
        } catch (e) {}
      }
      loadDraftValue();

      // Gyors gombok
      tr.querySelectorAll(".qty-quick-btn[data-add]").forEach(btn => {
        btn.addEventListener("pointerup", e => {
          e.preventDefault();
          const add = parseInt(btn.dataset.add, 10);
          input.value = add;
          updateInputStyle();
          saveDraftShortage();
        });
      });

      // Reset gomb
      tr.querySelector(".qty-quick-btn[data-reset]")?.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = 0;
        updateInputStyle();
        saveDraftShortage();
      });

      // Kézi bevitel
      input.addEventListener("input", () => {
        updateInputStyle();
        saveDraftShortage();
      });

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
    applyGlobalSearchFilter();
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

  boothSelect?.addEventListener("change", (e) => {
    const draftStr = localStorage.getItem('pix_draft_shortage');
    if (draftStr && draftStr !== '{}') {
      if (!confirm("Bódét váltottál. A korábbi összeírási piszkozatod még megvan.\nSzeretnéd megtartani és folytatni?\n(Mégsem = Piszkozat törlése)")) {
        localStorage.removeItem('pix_draft_shortage');
      }
    }
    loadShortageNames();
  });

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
      const stock = item.central_stock || 0;
      tr.dataset.stock = stock;
      tr.dataset.category = item.category || 'C';
      const bazar = item.bazar_stock || 0;
      const fenti = item.fenti_stock || 0;
      
      let stockStyle = '';
      if (stock === 0) stockStyle = 'style="color:#f87171; font-weight:bold;"';
      else if (stock < 0) stockStyle = 'class="negative-stock"';

      const cat = item.category || 'C';
      const catObj = getCategory(cat);
      const catIcon = `${catObj.icon} (${catObj.id})`;

      tr.innerHTML = `
        <td>
          <div style="font-weight: bold; font-size: 1.1rem; color: var(--color-accent);">${item.name}</div>
          <div style="margin-top: 0.4rem; font-size: 0.85rem; color: var(--color-subtext);">
            Bazár: <span style="font-weight:${bazar > 0 ? 'bold' : 'normal'}; color:${bazar > 0 ? '#f87171' : 'inherit'}">${bazar > 0 ? bazar + ' db' : '0 db'}</span> |
            Krisztián: <span style="font-weight:${fenti > 0 ? 'bold' : 'normal'}; color:${fenti > 0 ? '#f87171' : 'inherit'}">${fenti > 0 ? fenti + ' db' : '0 db'}</span>
          </div>
        </td>
        <td style="font-size: 0.85rem; color: var(--color-subtext); text-align: center;">${catIcon}</td>
        <td ${stockStyle} style="text-align: center; font-size: 1.1rem;">${stock}</td>
        <td>
          <div class="qty-wrap" style="align-items: center; justify-content: center;">
            <div class="qty-quick-btns" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; width: 100%;">
              <button class="qty-quick-btn" data-add="1" aria-label="+1">+1</button>
              <button class="qty-quick-btn" data-add="2" aria-label="+2">+2</button>
              <button class="qty-quick-btn" data-add="3" aria-label="+3">+3</button>
              <button class="qty-quick-btn" data-add="4" aria-label="+4">+4</button>
              <button class="qty-quick-btn" data-add="5" aria-label="+5">+5</button>
              <button class="qty-quick-btn qty-reset" data-reset="1" aria-label="Törlés" style="padding:0.4rem; font-size:1.1rem;">✕</button>
            </div>
            <div class="qty-control" style="margin-top: 4px; width: 100%;">
              <input type="number" inputmode="numeric" pattern="[0-9]*" class="styled-input order-qty-input" value="0" min="-9999" max="9999"
                style="width:100%; text-align:center; padding:0.4rem 0.2rem; font-weight: bold; font-size: 1.1rem;" />
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
          const currentVal = parseInt(input.value, 10) || 0;
          input.value = currentVal + add;
          updateInputStyle();
        });
      });

      tr.querySelector(".qty-quick-btn[data-reset]")?.addEventListener("pointerup", e => {
        e.preventDefault();
        input.value = 0;
        updateInputStyle();
      });

      input.addEventListener("input", updateInputStyle);

      orderTableBody.appendChild(tr);
    });
    applyGlobalSearchFilter();
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
      dataList.push({ name, orderStr: qty === 0 ? "" : qty });
      if (qty > 0) {
        orderedItems.push({ name, qty });
      }
    }

    if (orderedItems.length === 0) {
      alert("Nincs mit exportálni! Kérlek adj meg legalább egy rendelési mennyiséget.");
      return;
    }

    // Excel export (just UI download, not saving to DB)
    const ROWS_PER_COL = 30;
    const matrix = [];
    for (let i = 0; i < ROWS_PER_COL; i++) matrix.push([]);
    for (let i = 0; i < dataList.length; i++) {
      const rowIdx = i % ROWS_PER_COL;
      const colGroupIdx = Math.floor(i / ROWS_PER_COL);
      const item = dataList[i];
      while (matrix[rowIdx].length < colGroupIdx * 2) {
        matrix[rowIdx].push("");
      }
      matrix[rowIdx].push(item.name);
      matrix[rowIdx].push(item.orderStr);
    }
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rendelés");
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Rendeles_Export_${dateStr}.xlsx`);
  });

  const saveOrderBtn = document.getElementById("save-order-btn");
  const saveOrderNote = document.getElementById("save-order-note");

  saveOrderBtn?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    const rows = orderTableBody.querySelectorAll("tr");
    const orderedItems = [];
    
    for (const row of rows) {
      const name = row.dataset.name;
      const qtyStr = row.querySelector('.order-qty-input').value;
      const qty = parseInt(qtyStr, 10) || 0;
      if (qty > 0) orderedItems.push({ name, qty });
    }

    if (orderedItems.length === 0) {
      alert("Nincs mit menteni! Kérlek adj meg legalább egy rendelési mennyiséget.");
      return;
    }

    const note = saveOrderNote.value.trim();
    saveOrderBtn.textContent = '⏳ Mentés...';
    
    try {
      const { error } = await supabaseClient.from('orders').insert([{
        note: note || null,
        items: orderedItems
      }]);

      if (error) {
        console.error("Hiba a rendelés mentésekor:", error);
        alert("Hiba a mentéskor!");
      } else {
        alert("Rendelés sikeresen mentve!");
        saveOrderNote.value = "";
        rows.forEach(row => {
          const input = row.querySelector('.order-qty-input');
          if (input) {
            input.value = 0;
            input.classList.remove('qty-input-active');
          }
        });
        loadSavedOrders();
      }
    } catch (err) {
      console.error(err);
    } finally {
      saveOrderBtn.innerHTML = '💾 Rendelés Mentése';
    }
  });

  // Saved orders UI logic
  const currentOrdersView = document.getElementById("current-orders-view");
  const savedOrdersView = document.getElementById("saved-orders-view");
  const savedOrdersTableBody = document.querySelector("#saved-orders-table tbody");

  document.querySelectorAll('.order-tab-btn').forEach(btn => {
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      document.querySelectorAll('.order-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      if (target === 'current-orders-view') {
        currentOrdersView.classList.remove('hidden');
        savedOrdersView.classList.add('hidden');
      } else {
        currentOrdersView.classList.add('hidden');
        savedOrdersView.classList.remove('hidden');
        loadSavedOrders();
      }
    });
  });

  async function loadSavedOrders() {
    if (!savedOrdersTableBody) return;
    savedOrdersTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">⏳ Betöltés...</td></tr>';
    
    const { data, error } = await supabaseClient.from('orders').select('*').order('created_at', { ascending: false });
    if (error) {
      savedOrdersTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#ef4444;">Hiba a betöltéskor!</td></tr>';
      return;
    }
    
    if (!data || data.length === 0) {
      savedOrdersTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--color-subtext);">Nincsenek mentett rendelések.</td></tr>';
      return;
    }

    savedOrdersTableBody.innerHTML = '';
    data.forEach(order => {
      const dateStr = new Date(order.created_at).toLocaleString('hu-HU');
      const nameStr = order.note ? `<br><span style="color:var(--color-accent); font-weight:bold;">${order.note}</span>` : '';
      const items = order.items || [];
      const itemsCount = items.length;
      
      const itemsListHtml = items.map(i => `<span style="display:inline-block; padding:0.2rem 0.5rem; margin:0.2rem; background:rgba(255,255,255,0.1); border-radius:12px; font-size:0.8rem;">${i.name}: <b style="color:var(--color-primary);">${i.qty} db</b></span>`).join('');

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${dateStr}${nameStr}</td>
        <td>
          <details style="font-size:0.85rem;">
            <summary style="cursor:pointer; color:var(--color-accent); outline:none; user-select:none;">${itemsCount} féle toll ▼</summary>
            <div style="margin-top:0.5rem; max-height:200px; overflow-y:auto; padding:0.5rem; background:rgba(0,0,0,0.2); border-radius:8px;" class="custom-scrollbar">
              ${itemsListHtml}
            </div>
          </details>
        </td>
        <td style="text-align:center;">
          <button class="cta-button export-saved-order-btn" style="background:#10b981; border:none; padding:0.4rem 0.8rem; font-size:0.85rem; margin-right:0.5rem; margin-bottom:0.2rem;">📥 Excel</button>
          <button class="cta-button del-order-btn" style="background:#ef4444; border:none; padding:0.4rem 0.8rem; font-size:0.85rem;">❌ Törlés</button>
        </td>
      `;

      tr.querySelector('.export-saved-order-btn').addEventListener('pointerup', async (e) => {
        e.preventDefault();
        if (typeof XLSX === "undefined") {
          alert("A SheetJS még töltődik be, kérlek várj...");
          return;
        }

        const allNames = await fetchNames();
        const orderQtyMap = {};
        (order.items || []).forEach(i => {
          orderQtyMap[i.name] = i.qty;
        });

        const dataList = [];
        for (const item of allNames) {
          const qty = orderQtyMap[item.name] || 0;
          dataList.push({ name: item.name, orderStr: qty === 0 ? "" : qty });
        }

        const ROWS_PER_COL = 30;
        const matrix = [];
        for (let i = 0; i < ROWS_PER_COL; i++) matrix.push([]);
        for (let i = 0; i < dataList.length; i++) {
          const rowIdx = i % ROWS_PER_COL;
          const colGroupIdx = Math.floor(i / ROWS_PER_COL);
          const dlItem = dataList[i];
          while (matrix[rowIdx].length < colGroupIdx * 2) {
            matrix[rowIdx].push("");
          }
          matrix[rowIdx].push(dlItem.name);
          matrix[rowIdx].push(dlItem.orderStr);
        }

        const ws = XLSX.utils.aoa_to_sheet(matrix);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Rendelés");
        
        // Extract timestamp from date string to ensure uniqueness if needed, or just use the local date format
        const d = new Date(order.created_at);
        const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`;
        XLSX.writeFile(wb, `Regi_Rendeles_${dateStr}.xlsx`);
      });

      tr.querySelector('.del-order-btn').addEventListener('pointerup', async (e) => {
        e.preventDefault();
        if (confirm('Biztosan törlöd ezt a mentett rendelést?')) {
          await supabaseClient.from('orders').delete().eq('id', order.id);
          loadSavedOrders();
        }
      });

      savedOrdersTableBody.appendChild(tr);
    });
  }


  // Summary Modal Elements
  const summaryModal = document.getElementById("summary-modal");
  const summaryList = document.getElementById("summary-list");
  const summaryConfirm = document.getElementById("summary-confirm");
  const summaryCancel = document.getElementById("summary-cancel");
  const summaryClose = document.getElementById("summary-close");

  let pendingShortageUpdates = [];
  let selectedBooth = "bazar";

  function renderSummaryList() {
    summaryList.innerHTML = "";
    pendingShortageUpdates.forEach((update, index) => {
      const { name, newShortageReq, currentCentralStock } = update;
      
      const fulfillAmount = Math.min(newShortageReq, currentCentralStock);
      const backorderAmount = newShortageReq - fulfillAmount;
      const newCentralStock = currentCentralStock - fulfillAmount;
      const newPendingShortage = backorderAmount;

      update.fulfillAmount = fulfillAmount;
      update.backorderAmount = backorderAmount;
      update.newCentralStock = newCentralStock;
      update.newPendingShortage = newPendingShortage;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight:bold; color:var(--color-accent);">${name}</div>
          <button class="cta-button secondary fix-stock-btn" data-index="${index}" style="margin-top:0.4rem; padding:0.2rem 0.5rem; font-size:0.75rem; background:rgba(239, 68, 68, 0.15); color:#ef4444; border:1px solid #ef4444; display:flex; align-items:center; gap:0.3rem;">⚠️ Hibás készlet?</button>
        </td>
        <td>
          <div style="font-size:1.1rem;"><strong>${newShortageReq} db</strong></div>
          ${newPendingShortage > 0 ? '<div style="font-size:0.8rem; color:#f87171; margin-top:0.2rem;">Új hiány: ' + newPendingShortage + ' db</div>' : ''}
        </td>
        <td>
          <div style="font-size:1.1rem;"><strong>${currentCentralStock} db</strong></div>
          <div style="font-size:0.8rem; color:var(--color-subtext); margin-top:0.2rem;">
            Kiadva: <span style="color:${fulfillAmount > 0 ? '#34d399' : 'inherit'}">${fulfillAmount}</span> | Marad: ${newCentralStock}
          </div>
        </td>
      `;
      summaryList.appendChild(tr);
    });

    document.querySelectorAll('.fix-stock-btn').forEach(btn => {
      btn.addEventListener('pointerup', e => {
        e.preventDefault();
        const idx = parseInt(btn.dataset.index, 10);
        const update = pendingShortageUpdates[idx];
        const valStr = prompt(`Add meg a valós raktárkészletet (A gép szerint jelenleg: ${update.currentCentralStock} db van raktáron)\n\nToll: ${update.name}`, update.currentCentralStock);
        if (valStr !== null && valStr.trim() !== '') {
          const newVal = parseInt(valStr, 10);
          if (!isNaN(newVal) && newVal >= 0) {
            const diff = newVal - update.originalCentralStock;
            update.currentCentralStock = newVal;
            update.correctionDiff = diff;
            renderSummaryList(); // Újrarajzoljuk az értékeket
          } else {
            alert('Érvénytelen szám!');
          }
        }
      });
    });
  }

  function openSummaryModal() {
    selectedBooth = boothSelect.value;
    const boothName = selectedBooth === 'bazar' ? 'Bazár' : 'Krisztián';
    const boothLabel = document.getElementById('summary-booth-label');
    if (boothLabel) boothLabel.textContent = `Bódé: ${boothName}`;

    const rows = shortageTableBody.querySelectorAll("tr");
    pendingShortageUpdates = [];

    let hasChanges = false;
    for (const row of rows) {
      const id = row.dataset.id;
      const name = row.dataset.name;
      const centralStock = parseInt(row.dataset.central, 10) || 0;
      const newShortageReq = parseInt(row.querySelector('.shortage-qty-input').value, 10) || 0;
      
      if (newShortageReq === 0) continue;
      hasChanges = true;

      pendingShortageUpdates.push({ 
        id,
        name, 
        newShortageReq, 
        originalCentralStock: centralStock,
        currentCentralStock: centralStock,
        correctionDiff: 0
      });
    }

    if (!hasChanges) {
      alert("Nincs kitöltve mennyiség egyetlen tolnál sem.");
      return;
    }

    renderSummaryList();
    summaryModal.classList.remove("hidden");
  }

  function closeSummaryModal() {
    summaryModal.classList.add("hidden");
  }

  summaryCancel?.addEventListener("pointerup", e => { e.preventDefault(); closeSummaryModal(); });
  summaryClose?.addEventListener("click", e => { e.preventDefault(); closeSummaryModal(); });
  summaryClose?.addEventListener("pointerup", e => { e.stopPropagation(); e.preventDefault(); closeSummaryModal(); });
  summaryModal?.addEventListener("pointerup", e => { if (e.target === summaryModal) closeSummaryModal(); });

  let isConfirmingShortage = false;
  async function confirmShortage() {
    if (pendingShortageUpdates.length === 0) return;
    if (isConfirmingShortage) return;
    
    if (!confirm("Biztos mented?")) return;
    
    isConfirmingShortage = true;
    
    try {
    summaryConfirm.disabled = true;
    summaryConfirm.textContent = "⏳ Mentés...";

    const kiviszItems = [];
    const osszeirasItems = [];
    const korrekcioItems = [];
    const boothField = selectedBooth === 'bazar' ? 'bazar_stock' : 'fenti_stock';

    for (const update of pendingShortageUpdates) {
      const { name, fulfillAmount, backorderAmount, newCentralStock, newPendingShortage, newShortageReq, correctionDiff } = update;
      
      if (newShortageReq > 0) {
        osszeirasItems.push({ name, qty: newShortageReq, fulfilled: fulfillAmount });
      }

      if (fulfillAmount > 0) {
        kiviszItems.push({ name, qty: fulfillAmount });
      }

      if (correctionDiff && correctionDiff !== 0) {
        korrekcioItems.push({ 
          id: update.id,
          name: name,
          qty: Math.abs(correctionDiff),
          delta_central: correctionDiff,
          delta_bazar: 0,
          delta_fenti: 0,
          old_central: update.originalCentralStock,
          new_central: update.currentCentralStock,
          old_bazar: 0,
          new_bazar: 0,
          old_fenti: 0,
          new_fenti: 0
        });
      }
      
      // Update DB with exact calculated states
      const updatePayload = { central_stock: newCentralStock };
      updatePayload[boothField] = newPendingShortage;

      await supabaseClient
        .from('names')
        .update(updatePayload)
        .eq('name', name);
    }

    if (korrekcioItems.length > 0) {
      await supabaseClient.from('transactions').insert({
        type: 'korrekcio',
        booth: 'mindketto', // CHECK constraint miatt: 'mindketto', 'kozponti', 'bazar', 'fenti'
        user_name: currentUser || currentRole,
        items: korrekcioItems,
        notes: 'Összeírás közben javított készlet'
      });
    }

    if (osszeirasItems.length > 0) {
      await supabaseClient.from('transactions').insert({
        type: 'osszeiras',
        booth: selectedBooth,
        user_name: currentUser || currentRole,
        items: osszeirasItems,
        notes: 'Összeírt hiánylista'
      });
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
    
    // Piszkozat törlése a sikeres mentés után
    localStorage.removeItem('pix_draft_shortage');
    
    summaryConfirm.disabled = false;
    summaryConfirm.textContent = "✅ Mentés az adatbázisba";
    closeSummaryModal();
    alert('Sikeresen elmentve!');
    
    loadShortageNames();
    loadAndRenderNames();
    } finally {
      isConfirmingShortage = false;
    }
  }

  summaryConfirm?.addEventListener("pointerup", e => { e.preventDefault(); confirmShortage(); });
  submitShortageBtn?.addEventListener("pointerup", e => { e.preventDefault(); openSummaryModal(); });

  // ── STATISZTIKA SECTION ───────────────────────────────────────
  const statsPeriodSelect = document.getElementById("stats-period");
  const refreshStatsBtn = document.getElementById("refresh-stats");
  const statsCardsContainer = document.getElementById("stats-cards");
  const lowStockTableBody = document.querySelector("#low-stock-table tbody");
  const statsTableBody = document.querySelector("#stats-table tbody");

  async function loadStats() {
    const days = parseInt(statsPeriodSelect?.value || "30", 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    if (statsCardsContainer) statsCardsContainer.innerHTML = `<div style="color:var(--color-subtext);">⏳ Adatok betöltése...</div>`;
    if (lowStockTableBody) lowStockTableBody.innerHTML = `<tr><td colspan="2" style="text-align:center;">⏳ Betöltés...</td></tr>`;
    if (statsTableBody) statsTableBody.innerHTML = `<tr><td colspan="2" style="text-align:center;">⏳ Betöltés...</td></tr>`;

    const { data: txData, error: txError } = await supabaseClient
      .from('transactions')
      .select('*')
      .in('type', ['kivisz', 'selejt'])
      .gte('created_at', fromDate.toISOString());

    let { data: namesData, error: namesError } = await supabaseClient
      .from('names')
      .select('name, central_stock, category, bazar_stock, fenti_stock');

    if (txError || namesError) {
      console.error(txError, namesError);
      if (statsCardsContainer) statsCardsContainer.innerHTML = `<div style="color:#f87171;">Hiba történt az adatok letöltésekor.</div>`;
      return;
    }

    // Szűrés a legördülő alapján
    const filterMode = currentFilterMode;
    if (filterMode === "CRITICAL") {
      namesData = namesData.filter(n => {
        const limit = getCategory(n.category || 'C').limit_stock;
        return (parseInt(n.central_stock, 10) || 0) < limit;
      });
    } else if (filterMode !== "ALL") {
      namesData = namesData.filter(n => (n.category || 'C') === filterMode);
    }

    let totalItemsTaken = 0;
    const penSales = {};

    // Alaphelyzetbe hozzuk a listát a szűrt nevekkel, hogy a 0 darabosak is megjelenjenek
    (namesData || []).forEach(n => {
      penSales[n.name] = 0;
    });

    (txData || []).forEach(tx => {
      const items = Array.isArray(tx.items) ? tx.items : [];
      items.forEach(item => {
        // Csak akkor számoljuk, ha a kategória szűrőn átment a toll
        if (penSales[item.name] !== undefined) {
          const qty = Math.abs(item.qty || 0);
          if (tx.type === 'kivisz') {
            totalItemsTaken += qty;
            penSales[item.name] += qty;
          } else if (tx.type === 'selejt' && (tx.booth === 'bazar' || tx.booth === 'fenti')) {
            totalItemsTaken = Math.max(0, totalItemsTaken - qty);
            penSales[item.name] -= qty;
          }
        }
      });
    });

    let topPenName = "Nincs adat";
    let topPenQty = 0;
    for (const [pName, pQty] of Object.entries(penSales)) {
      if (pQty > topPenQty) {
        topPenQty = pQty;
        topPenName = pName;
      }
    }

    let totalCentralStock = 0;
    const stockList = [];
    (namesData || []).forEach(n => {
      const s = parseInt(n.central_stock, 10) || 0;
      totalCentralStock += s;
      
      const cat = n.category || 'C';
      const limit = getCategory(cat).limit_stock;
      const rackShortage = (parseInt(n.bazar_stock, 10) || 0) + (parseInt(n.fenti_stock, 10) || 0);

      if (s < limit) {
        stockList.push({ name: n.name, stock: s, limit: limit, diff: s - limit, rackShortage: rackShortage });
      }
    });

    if (statsCardsContainer) {
      statsCardsContainer.innerHTML = `
        <div class="glass-card" style="padding:1.5rem; text-align:center; border-left: 4px solid var(--color-accent);">
          <div style="font-size:0.85rem; color:var(--color-subtext); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:1px;">Kivitt tollak (${days} nap)</div>
          <div style="font-size:2rem; font-weight:800; color:var(--color-text);">${totalItemsTaken} db</div>
        </div>
        <div class="glass-card" style="padding:1.5rem; text-align:center; border-left: 4px solid #34d399;">
          <div style="font-size:0.85rem; color:var(--color-subtext); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:1px;">Legnépszerűbb toll</div>
          <div style="font-size:1.4rem; font-weight:800; color:var(--color-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${topPenName}</div>
          <div style="font-size:0.85rem; color:var(--color-subtext); font-weight:600; margin-top:0.3rem;">${topPenQty > 0 ? topPenQty + ' db fogyott' : ''}</div>
        </div>
        <div class="glass-card" style="padding:1.5rem; text-align:center; border-left: 4px solid #6366f1;">
          <div style="font-size:0.85rem; color:var(--color-subtext); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:1px;">Teljes raktárkészlet</div>
          <div style="font-size:2rem; font-weight:800; color:var(--color-text);">${totalCentralStock} db</div>
        </div>
      `;
    }

    // Sort by how far below the limit they are (most critical first)
    // Ha ugyanannyira vannak a limit alatt, akkor az állvány hiány (rackShortage) alapján csökkenőbe
    stockList.sort((a, b) => {
      if (a.diff !== b.diff) return a.diff - b.diff;
      return b.rackShortage - a.rackShortage;
    });
    if (lowStockTableBody) {
      lowStockTableBody.innerHTML = "";
      const lowestStock = stockList; // Mutatjuk az összes kritikust, nem csak az első 15-öt
      if (lowestStock.length === 0) {
        lowStockTableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--color-subtext);">Nincs kritikus készletű tétel! 🎉</td></tr>`;
      } else {
        lowestStock.forEach(item => {
          let color = '#fbbf24';
          if (item.stock === 0) color = '#f87171';
          
          lowStockTableBody.innerHTML += `
            <tr>
              <td>${item.name}</td>
              <td style="text-align:center; font-weight:bold; color:${color};">${item.stock} / ${item.limit}</td>
            </tr>
          `;
        });
      }
    }

    if (statsTableBody) {
      statsTableBody.innerHTML = "";
      const sortedSales = Object.entries(penSales).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
      if (sortedSales.length === 0) {
        statsTableBody.innerHTML = `<tr><td colspan="2" style="text-align:center; color:var(--color-subtext);">Nincs kivitel az elmúlt ${days} napban</td></tr>`;
      } else {
        sortedSales.forEach(item => {
          statsTableBody.innerHTML += `
            <tr>
              <td>${item.name}</td>
              <td style="text-align:center; font-weight:bold;">${item.qty}</td>
            </tr>
          `;
        });
      }
    }
  }

  refreshStatsBtn?.addEventListener("pointerup", e => { e.preventDefault(); loadStats(); });
  statsPeriodSelect?.addEventListener("change", loadStats);

  // ── ADMIN LOG SECTION ───────────────────────────────────────
  const refreshLogBtn = document.getElementById("refresh-log");
  refreshLogBtn?.addEventListener('pointerup', () => {
    if (currentAdminLogTab === 'leltar') {
      loadOsszeirasLog();
    } else {
      loadAdminLog();
    }
  });
  const adminLogTableBody = document.querySelector("#admin-log-table tbody");

  async function deleteTransaction(rec) {
    const isConfirmed = confirm(`Biztosan törlöd ezt a tranzakciót (${rec.type})?\nEz visszavonja a készletváltozásokat is!`);
    if (!isConfirmed) return;

    try {
      if (rec.type === 'kivisz' || rec.type === 'visszahoz') {
        const items = Array.isArray(rec.items) ? rec.items : [];
        for (const item of items) {
          // Kivitel esetén (qty pozitív) -> levonódott a raktárból -> negatívval hívjuk hogy visszategye
          // Visszahoz esetén (qty pozitív a logban) -> hozzáadódott -> pozitívval hívjuk hogy levegye
          const reverseQty = rec.type === 'kivisz' ? -Math.abs(item.qty) : Math.abs(item.qty);
          await updateStock(item.name, rec.booth, reverseQty);
        }
      } else if (rec.type === 'selejt') {
        if (rec.booth === 'kozponti') {
          const items = Array.isArray(rec.items) ? rec.items : [];
          for (const item of items) {
             // Vissza kell tenni a központi raktárba
             await updateStock(item.name, rec.booth, -Math.abs(item.qty));
          }
        }
      } else if (rec.type === 'korrekcio') {
        const items = Array.isArray(rec.items) ? rec.items : [];
        for (const item of items) {
          const { data: currentStock, error: fetchErr } = await supabaseClient
            .from('names')
            .select('central_stock, bazar_stock, fenti_stock')
            .eq('id', item.id)
            .single();
          
          if (!fetchErr && currentStock) {
            const newCentral = (currentStock.central_stock || 0) - (item.delta_central || 0);
            const newBazar = (currentStock.bazar_stock || 0) - (item.delta_bazar || 0);
            const newFenti = (currentStock.fenti_stock || 0) - (item.delta_fenti || 0);
            
            await supabaseClient.from('names').update({
              central_stock: newCentral,
              bazar_stock: newBazar,
              fenti_stock: newFenti
            }).eq('id', item.id);
          }
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

  async function deleteSingleTransactionItem(rec, itemIndex) {
    const item = rec.items[itemIndex];
    const isConfirmed = confirm(`Biztosan törlöd ezt a tételt (${item.name}: ${item.qty} db)?\nEz visszavonja a készletváltozást erre az egy tételre!`);
    if (!isConfirmed) return;

    try {
      if (rec.type === 'kivisz' || rec.type === 'visszahoz') {
        const reverseQty = rec.type === 'kivisz' ? -Math.abs(item.qty) : Math.abs(item.qty);
        await updateStock(item.name, rec.booth, reverseQty);
      } else if (rec.type === 'selejt') {
        if (rec.booth === 'kozponti') {
           await updateStock(item.name, rec.booth, -Math.abs(item.qty));
        }
      } else if (rec.type === 'korrekcio') {
        const { data: currentStock, error: fetchErr } = await supabaseClient
          .from('names')
          .select('central_stock, bazar_stock, fenti_stock')
          .eq('id', item.id)
          .single();
          
        if (!fetchErr && currentStock) {
          const newCentral = (currentStock.central_stock || 0) - (item.delta_central || 0);
          const newBazar = (currentStock.bazar_stock || 0) - (item.delta_bazar || 0);
          const newFenti = (currentStock.fenti_stock || 0) - (item.delta_fenti || 0);
          
          await supabaseClient.from('names').update({
            central_stock: newCentral,
            bazar_stock: newBazar,
            fenti_stock: newFenti
          }).eq('id', item.id);
        }
      }

      const newItems = [...rec.items];
      newItems.splice(itemIndex, 1);

      if (newItems.length === 0) {
        const { error } = await supabaseClient.from('transactions').delete().eq('id', rec.id);
        if (error) throw error;
        alert("Utolsó tétel is törölve, így a teljes tranzakció törlődött.");
      } else {
        const { error } = await supabaseClient.from('transactions').update({ items: newItems }).eq('id', rec.id);
        if (error) throw error;
        alert("Tétel sikeresen törölve a listából, készlet visszaállítva!");
      }

      loadAdminLog();
      loadAndRenderNames();
    } catch (err) {
      console.error(err);
      alert("Hiba történt a törlés során: " + err.message);
    }
  }

  let currentAdminLogTab = 'kivitel';

  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('pointerup', (e) => {
      e.preventDefault();
      document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      currentAdminLogTab = btn.dataset.tab;
      
      const adminLogTable = document.getElementById('admin-log-table');
      const osszeirasLogTable = document.getElementById('osszeiras-log-table');
      
      if (currentAdminLogTab === 'leltar') {
        adminLogTable.classList.add('hidden');
        osszeirasLogTable.classList.remove('hidden');
        loadOsszeirasLog();
      } else {
        adminLogTable.classList.remove('hidden');
        osszeirasLogTable.classList.add('hidden');
        loadAdminLog();
      }
    });
  });

  async function loadAdminLog() {
    adminLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-subtext);">⏳ Betöltés...</td></tr>`;
    
    let query = supabaseClient
      .from('transactions')
      .select('*')
      .neq('type', 'osszeiras')
      .order('created_at', { ascending: false })
      .limit(200);

    const boothColTh = document.getElementById('admin-log-col-booth');
    const typeColTh = document.getElementById('admin-log-col-type');

    if (currentAdminLogTab === 'korrekcio') {
      query = query.in('type', ['korrekcio', 'selejt']);
      if (boothColTh) boothColTh.style.display = 'none';
      if (typeColTh) typeColTh.style.display = '';
    } else {
      query = query.not('type', 'in', '("korrekcio","selejt")');
      if (boothColTh) boothColTh.style.display = '';
      if (typeColTh) typeColTh.style.display = '';
    }

    const { data, error } = await query;
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
      else if (rec.type === 'korrekcio') typeLabel = '✏️ Kézi módosítás';
      else if (rec.type === 'selejt') typeLabel = '🗑️ Selejt';

      let boothLabel = rec.booth;
      if (rec.booth === 'bazar') boothLabel = 'Bazár';
      else if (rec.booth === 'fenti') boothLabel = 'Krisztián';
      else if (rec.booth === 'admin') boothLabel = 'Export';
      else if (rec.booth === 'mindketto') boothLabel = 'Több raktár';
      else if (!boothLabel) boothLabel = '–';

      const items = Array.isArray(rec.items) ? rec.items : [];
      const totalItems = items.reduce((sum, item) => {
        const q = item.qty !== undefined ? item.qty : (item.new_stock - item.old_stock) || 0;
        return sum + Math.abs(q);
      }, 0);
      const uniqueItems = items.length;

      // Fő sor (kattintható)
      const mainTr = document.createElement('tr');
      mainTr.className = 'log-main-row';
      
      const hideCols = (currentAdminLogTab === 'korrekcio');
      const boothTd = hideCols ? '' : `<td>${boothLabel}</td>`;
      const typeTd = `<td>${typeLabel}</td>`;
      
      const totalColContent = `<strong>${totalItems} db</strong> (${uniqueItems} fajta) <span class="cta-button secondary" style="float:right; padding:0.2rem 0.5rem; font-size:0.8rem; cursor:pointer;">Részletek ▼</span>`;

      mainTr.innerHTML = `
        <td>${new Date(rec.created_at).toLocaleString('hu-HU')}</td>
        <td>${rec.user_name || '–'}</td>
        ${boothTd}
        ${typeTd}
        <td>${totalColContent}</td>
      `;

      // Részletek sor (rejtett)
      const detailsTr = document.createElement('tr');
      detailsTr.className = 'log-details-row';
      
      const itemsHtml = items.map((item, index) => {
        if (rec.type === 'korrekcio') {
          let details = [];
          if (item.delta_central) details.push(`Raktár: ${item.old_central} ➔ ${item.new_central} (${item.delta_central > 0 ? '+' : ''}${item.delta_central})`);
          if (item.delta_bazar) details.push(`Bazár hiány: ${item.old_bazar} ➔ ${item.new_bazar} (${item.delta_bazar > 0 ? '+' : ''}${item.delta_bazar})`);
          if (item.delta_fenti) details.push(`Fenti hiány: ${item.old_fenti} ➔ ${item.new_fenti} (${item.delta_fenti > 0 ? '+' : ''}${item.delta_fenti})`);
          
          return `
            <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:0.3rem 0;">
              <div>
                <span>${item.name}</span>
                <div style="font-size:0.8rem; color:var(--color-subtext); margin-top:0.2rem;">${details.join(' | ')}</div>
              </div>
              <button class="cta-button del-single-item-btn" data-index="${index}" style="background:transparent; color:#ef4444; border:1px solid #ef4444; padding:0.1rem 0.4rem; font-size:0.75rem;">❌ Törlés</button>
            </li>
          `;
        } else if (rec.type === 'feltoltes') {
          const q = item.qty !== undefined ? item.qty : (item.new_stock - item.old_stock) || 0;
          return `
            <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:0.3rem 0;">
              <div>
                <span>${item.name}</span>
                <span class="log-qty-badge" style="margin-left:0.5rem; background:rgba(99, 102, 241, 0.15); color:var(--color-accent);">${item.old_stock ?? '?'} ➔ ${item.new_stock ?? '?'} db (${q > 0 ? '+' : ''}${q})</span>
              </div>
            </li>
          `;
        } else {
          const q = item.qty !== undefined ? item.qty : (item.new_stock - item.old_stock) || 0;
          return `
            <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:0.3rem 0;">
              <div>
                <span>${item.name}</span>
                <span class="log-qty-badge" style="margin-left:0.5rem;">${q} db</span>
              </div>
              <button class="cta-button del-single-item-btn" data-index="${index}" style="background:transparent; color:#ef4444; border:1px solid #ef4444; padding:0.1rem 0.4rem; font-size:0.75rem;">❌ Törlés</button>
            </li>
          `;
        }
      }).join('');

      detailsTr.innerHTML = `
        <td colspan="${hideCols ? '4' : '5'}" style="padding: 0;">
          <div class="log-details-content">
            <ul style="list-style:none; padding:0; margin:0;">${itemsHtml}</ul>
            <div style="margin-top: 1rem; text-align: right;">
              ${rec.type === 'feltoltes' ? '<span style="font-size:0.8rem; color:var(--color-subtext);">Feltöltést az Importálás menüpontban lehet visszavonni.</span>' : '<button class="cta-button del-transaction-btn" style="background:#ef4444; padding:0.4rem 1rem; font-size:0.85rem;">🗑️ Teljes Tranzakció Törlése</button>'}
            </div>
          </div>
        </td>
      `;

      const delBtn = detailsTr.querySelector('.del-transaction-btn');
      if (delBtn) {
        delBtn.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          deleteTransaction(rec);
        });
      }

      const delSingleBtns = detailsTr.querySelectorAll('.del-single-item-btn');
      delSingleBtns.forEach(btn => {
        btn.addEventListener('pointerup', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          deleteSingleTransactionItem(rec, idx);
        });
      });

      // Kattintás esemény
      mainTr.addEventListener("pointerup", (e) => {
        e.preventDefault();
        detailsTr.classList.toggle("open");
      });

      adminLogTableBody.appendChild(mainTr);
      adminLogTableBody.appendChild(detailsTr);
    });
    applyGlobalSearchFilter();
  }

  refreshLogBtn?.addEventListener('pointerup', e => { e.preventDefault(); loadAdminLog(); });

  // ── OSSZEIRAS LOG SECTION ─────────────────────────────────────
  const refreshOsszeirasLogBtn = document.getElementById("refresh-osszeiras-log");
  const osszeirasLogTableBody = document.querySelector("#osszeiras-log-table tbody");

  async function loadOsszeirasLog() {
    if (!osszeirasLogTableBody) return;
    osszeirasLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-subtext);">⏳ Betöltés...</td></tr>`;
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('type', 'osszeiras')
      .order('created_at', { ascending: false })
      .limit(200);
      
    if (error) {
      osszeirasLogTableBody.innerHTML = `<tr><td colspan="5" style="color:#f87171;">Hiba: ${error.message}</td></tr>`;
      console.error(error);
      return;
    }
    osszeirasLogTableBody.innerHTML = "";
    if (!data || data.length === 0) {
      osszeirasLogTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--color-subtext);">Nincs bejegyzés</td></tr>`;
      return;
    }
    
    data.forEach(rec => {
      let boothLabel = rec.booth;
      if (rec.booth === 'bazar') boothLabel = 'Bazár';
      else if (rec.booth === 'fenti') boothLabel = 'Krisztián';
      else if (!boothLabel) boothLabel = '–';

      const items = Array.isArray(rec.items) ? rec.items : [];
      const totalItems = items.reduce((sum, item) => sum + Math.abs(item.qty), 0);
      const uniqueItems = items.length;

      // Fő sor
      const mainTr = document.createElement('tr');
      mainTr.className = 'log-main-row';
      mainTr.innerHTML = `
        <td>${new Date(rec.created_at).toLocaleString('hu-HU')}</td>
        <td>${rec.user_name || '–'}</td>
        <td>${boothLabel}</td>
        <td>📝 Összeírás</td>
        <td><strong>${totalItems} db</strong> (${uniqueItems} fajta) <span class="cta-button secondary" style="float:right; padding:0.2rem 0.5rem; font-size:0.8rem; cursor:pointer;">Részletek ▼</span></td>
      `;

      // Részletek sor
      const detailsTr = document.createElement('tr');
      detailsTr.className = 'log-details-row';
      
      const itemsHtml = items.map((item) => {
        const isPartial = item.fulfilled !== undefined && item.fulfilled < item.qty;
        const qtyBadge = isPartial
          ? `<span class="log-qty-badge" style="margin-left:0.5rem; background:rgba(239, 68, 68, 0.15); color:#ef4444; font-size:0.8rem;">kért: ${item.qty} / kapott: ${item.fulfilled}</span>`
          : `<span class="log-qty-badge" style="margin-left:0.5rem; background:rgba(99, 102, 241, 0.15); color:var(--color-accent);">${item.qty} db</span>`;
        return `
          <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:0.3rem 0;">
            <div>
              <span>${item.name}</span>
              ${qtyBadge}
            </div>
          </li>
        `;
      }).join('');

      detailsTr.innerHTML = `
        <td colspan="5" style="padding: 0;">
          <div class="log-details-content">
            <ul style="list-style:none; padding:0; margin:0;">${itemsHtml}</ul>
            <div style="margin-top: 1rem; text-align: right;">
              <button class="cta-button del-transaction-btn" style="background:#ef4444; padding:0.4rem 1rem; font-size:0.85rem;">🗑️ Piszkozat Törlése</button>
            </div>
          </div>
        </td>
      `;

      const delBtn = detailsTr.querySelector('.del-transaction-btn');
      delBtn.addEventListener('pointerup', async (e) => {
        e.stopPropagation();
        if (!confirm("Biztosan törlöd ezt az összeírás listát?")) return;
        try {
          const { error } = await supabaseClient.from('transactions').delete().eq('id', rec.id);
          if (error) throw error;
          alert("Összeírás törölve.");
          loadOsszeirasLog();
        } catch(err) {
          alert("Hiba: " + err.message);
        }
      });

      // Kattintás esemény
      mainTr.addEventListener("pointerup", (e) => {
        e.preventDefault();
        detailsTr.classList.toggle("open");
      });

      osszeirasLogTableBody.appendChild(mainTr);
      osszeirasLogTableBody.appendChild(detailsTr);
    });
    applyGlobalSearchFilter();
  }

  refreshOsszeirasLogBtn?.addEventListener('pointerup', e => { e.preventDefault(); loadOsszeirasLog(); });


  // ── IMPORT LOG SECTION ─────────────────────────────────────
  const refreshImportLogBtn = document.getElementById("refresh-import-log");
  const importLogTableBody = document.querySelector("#import-log-table tbody");

  async function loadImportLog() {
    if (!importLogTableBody) return;
    importLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-subtext);">⏳ Betöltés...</td></tr>`;
    const { data, error } = await supabaseClient
      .from('transactions')
      .select('*')
      .eq('type', 'feltoltes')
      .order('created_at', { ascending: false })
      .limit(100);
      
    if (error) {
      importLogTableBody.innerHTML = `<tr><td colspan="4" style="color:#f87171;">Hiba: ${error.message}</td></tr>`;
      return;
    }
    importLogTableBody.innerHTML = "";
    if (!data || data.length === 0) {
      importLogTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--color-subtext);">Nincs bejegyzés</td></tr>`;
      return;
    }
    
    data.forEach(rec => {
      const items = Array.isArray(rec.items) ? rec.items : [];
      const totalItems = items.length;

      const mainTr = document.createElement('tr');
      mainTr.className = 'log-main-row';
      mainTr.innerHTML = `
        <td>${new Date(rec.created_at).toLocaleString('hu-HU')}</td>
        <td>${rec.user_name || '–'}</td>
        <td>${rec.booth || 'Excel'}</td>
        <td><strong>${totalItems} fajta</strong> <span class="cta-button secondary" style="float:right; padding:0.2rem 0.5rem; font-size:0.8rem; cursor:pointer;">Részletek ▼</span></td>
      `;

      const detailsTr = document.createElement('tr');
      detailsTr.className = 'log-details-row';
      
      const itemsHtml = items.map((item) => `
        <li style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding:0.3rem 0;">
          <div>
            <span>${item.name}</span>
            <span class="log-qty-badge" style="margin-left:0.5rem; background:rgba(99, 102, 241, 0.15); color:var(--color-accent);">${item.old_stock ?? '?'} ➔ ${item.new_stock ?? '?'} db</span>
          </div>
        </li>
      `).join('');

      detailsTr.innerHTML = `
        <td colspan="4" style="padding: 0;">
          <div class="log-details-content">
            <ul style="list-style:none; padding:0; margin:0;">${itemsHtml}</ul>
            <div style="margin-top: 1rem; text-align: right;">
              <button class="cta-button undo-import-btn" style="background:#ef4444; padding:0.4rem 1rem; font-size:0.85rem;">⏪ Import Visszavonása</button>
            </div>
          </div>
        </td>
      `;

      const undoBtn = detailsTr.querySelector('.undo-import-btn');
      undoBtn.addEventListener('pointerup', async (e) => {
        e.stopPropagation();
        if (!confirm("Biztosan visszavonod ezt az importálást?\\nA tételek készlete visszaáll az importálás előtti állapotra!")) return;
        
        try {
          // Revert stock for each item
          for (const item of items) {
            if (item.old_stock !== undefined) {
               const { error: updErr } = await supabaseClient.from('names').update({ central_stock: item.old_stock }).eq('name', item.name);
               if (updErr) throw updErr;
            }
          }
          // Delete transaction
          const { error: delErr } = await supabaseClient.from('transactions').delete().eq('id', rec.id);
          if (delErr) throw delErr;
          
          alert("Importálás sikeresen visszavonva!");
          loadImportLog();
          loadAndRenderNames();
        } catch(err) {
          alert("Hiba: " + err.message);
        }
      });

      mainTr.addEventListener("pointerup", (e) => {
        e.preventDefault();
        detailsTr.classList.toggle("open");
      });

      importLogTableBody.appendChild(mainTr);
      importLogTableBody.appendChild(detailsTr);
    });
    applyGlobalSearchFilter();
  }
  
  refreshImportLogBtn?.addEventListener('pointerup', e => { e.preventDefault(); loadImportLog(); });

  // ── NEVEK / KÉSZLET (names tábla) ────────────────────────────
  async function fetchNames() {
    const { data, error } = await supabaseClient
      .from("names")
      .select("id, name, central_stock, bazar_stock, fenti_stock, is_active, category")
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
    
    const bazar = item.bazar_stock ?? 0;
    const fenti = item.fenti_stock ?? 0;
    
    let stockStyle = '';
    if (stock === 0) stockStyle = 'style="color:#f87171; font-weight:bold;"';
    else if (stock < 0) stockStyle = 'class="negative-stock"';
    
    // Kategória ikon és kritikus szint jelzés
    const cat = item.category || 'C';
    const catObj = getCategory(cat);
    const catIcon = `${catObj.icon} (${catObj.id})`;
    
    // Szűrés támogatáshoz beállítjuk a data attribútumokat
    tr.dataset.name = item.name;
    tr.dataset.category = cat;
    tr.dataset.stock = stock;
    tr.dataset.bazar = bazar;
    tr.dataset.fenti = fenti;
    
    tr.innerHTML = `
      <td>
        <span class="item-name-cell" style="${currentRole === 'admin' ? 'cursor:pointer;' : ''}">${item.name}</span>
      </td>
      <td ${stockStyle}>${stock}</td>
      <td style="font-size: 0.85rem;">
        B: <span style="color:${bazar > 0 ? '#f87171' : 'var(--color-subtext)'}; font-weight:${bazar > 0 ? 'bold' : 'normal'};">${bazar > 0 ? bazar : '-'}</span> |
        K: <span style="color:${fenti > 0 ? '#f87171' : 'var(--color-subtext)'}; font-weight:${fenti > 0 ? 'bold' : 'normal'};">${fenti > 0 ? fenti : '-'}</span>
      </td>
      <td>
        <button class="scrap-btn" aria-label="Selejtezés" title="Selejt jelentése" style="display: ${currentRole === 'admin' ? 'inline-block' : 'none'}; background: transparent; border: none; cursor: pointer; font-size: 1.1rem; padding: 0.2rem;">⚠️</button>
        <button class="edit-btn" aria-label="Szerkesztés">✏️</button>
        <button class="del-btn"  aria-label="Törlés">🗑️</button>
      </td>`;

    // Admin: névkattintás → statisztika modal
    const nameCell = tr.querySelector('.item-name-cell');
    if (nameCell && currentRole === 'admin') {
      nameCell.addEventListener('pointerup', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openItemStatsModal(item);
      });
    }

    tr.querySelector(".scrap-btn")?.addEventListener("pointerup", (e) => { e.preventDefault(); openScrapModal(item); });
    tr.querySelector(".edit-btn").addEventListener("pointerup", (e) => { e.preventDefault(); editName(item); });
    tr.querySelector(".del-btn").addEventListener("pointerup",  (e) => { e.preventDefault(); deleteName(item.id); });
    namesTableBody.appendChild(tr);
  }

  // ── ITEM STATS MODAL ──────────────────────────────────────────
  const itemStatsModal = document.getElementById('item-stats-modal');

  function closeItemStatsModal() {
    itemStatsModal?.classList.add('hidden');
  }

  document.getElementById('item-stats-close')?.addEventListener('pointerup', (e) => { e.preventDefault(); closeItemStatsModal(); });
  document.getElementById('item-stats-close-btn')?.addEventListener('pointerup', (e) => { e.preventDefault(); closeItemStatsModal(); });
  itemStatsModal?.addEventListener('pointerup', (e) => { if (e.target === itemStatsModal) closeItemStatsModal(); });

  async function openItemStatsModal(item) {
    if (!itemStatsModal) return;

    const catObj = getCategory(item.category || 'C');
    document.getElementById('item-stats-title').textContent = `${catObj.icon} ${item.name}`;
    document.getElementById('item-stats-subtitle').textContent = `Kategória: ${catObj.name} (${catObj.id}) · ID: ${item.id.slice(0, 8)}…`;

    // Aktuális készlet kártyák
    const central = item.central_stock ?? 0;
    const bazar   = item.bazar_stock   ?? 0;
    const fenti   = item.fenti_stock   ?? 0;

    const centralEl = document.getElementById('stats-central-stock');
    const bazarEl   = document.getElementById('stats-bazar-stock');
    const fentiEl   = document.getElementById('stats-fenti-stock');

    centralEl.textContent = central;
    centralEl.style.color = central === 0 ? '#f87171' : central < 0 ? '#ef4444' : 'var(--color-text)';
    bazarEl.textContent   = bazar;
    bazarEl.style.color   = bazar > 0 ? '#f87171' : 'var(--color-text)';
    fentiEl.textContent   = fenti;
    fentiEl.style.color   = fenti > 0 ? '#f59e0b' : 'var(--color-text)';

    document.getElementById('item-stats-loading').classList.remove('hidden');
    document.getElementById('item-stats-content').classList.add('hidden');
    itemStatsModal.classList.remove('hidden');

    const { data: allTx, error } = await supabaseClient
      .from('transactions')
      .select('id, type, booth, user_name, items, notes, created_at')
      .order('created_at', { ascending: false });

    const { data: allOrders, error: ordersErr } = await supabaseClient
      .from('orders')
      .select('id, items, note, created_at');

    if (error) {
      document.getElementById('item-stats-loading').textContent = '❌ Hiba az adatok betöltésekor!';
      console.error('openItemStatsModal:', error);
      return;
    }

    const relevantTx = (allTx || []).filter(tx => {
      const txItems = Array.isArray(tx.items) ? tx.items : [];
      return txItems.some(i => i.name === item.name);
    });

    (allOrders || []).forEach(order => {
      const orderItems = Array.isArray(order.items) ? order.items : [];
      const matchItem = orderItems.find(i => i.name === item.name);
      if (matchItem) {
        relevantTx.push({
          id: order.id,
          type: 'rendeles',
          booth: '',
          user_name: 'Mentett rendelés',
          items: order.items,
          notes: order.note || 'Rendelés export',
          created_at: order.created_at
        });
      }
    });

    relevantTx.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    let totalKivisz    = 0;
    let kiviszBazar    = 0;
    let kiviszFenti    = 0;
    let lastKiviszDate = null;
    let osszeirasQty   = 0;
    let osszeirasCount = 0;
    let rendelesQty    = 0;
    let rendelesCount  = 0;

    const txTypeLabels = {
      kivisz:    { icon: '⬆️', label: 'Kivitt',           color: '#34d399' },
      visszahoz: { icon: '⬇️', label: 'Visszahozott',     color: '#60a5fa' },
      osszeiras: { icon: '📝', label: 'Összeírás', color: '#a78bfa' },
      rendeles:  { icon: '🛒', label: 'Rendelés',      color: '#38bdf8' },
      korrekcio: { icon: '✏️', label: 'Kézi mód.',    color: '#fbbf24' },
      feltoltes: { icon: '📥', label: 'Import',            color: '#6366f1' },
      selejt:    { icon: '🗑️', label: 'Selejt',      color: '#f87171' },
    };

    const boothLabels = {
      bazar: 'Bazár', fenti: 'Krisztián',
      kozponti: 'Központi', mindketto: 'Mindkettő'
    };

    relevantTx.forEach(tx => {
      const txItems = Array.isArray(tx.items) ? tx.items : [];
      const matchItem = txItems.find(i => i.name === item.name);
      if (!matchItem) return;
      const rawQty = matchItem.qty !== undefined ? matchItem.qty : (matchItem.new_stock - matchItem.old_stock);
      const qty = Math.abs(rawQty || 0);

      if (tx.type === 'kivisz') {
        totalKivisz += qty;
        if (tx.booth === 'bazar')  kiviszBazar += qty;
        if (tx.booth === 'fenti')  kiviszFenti += qty;
        if (!lastKiviszDate) lastKiviszDate = new Date(tx.created_at);
      } else if (tx.type === 'osszeiras') {
        osszeirasQty += matchItem.qty || 0;
        osszeirasCount++;
      } else if (tx.type === 'rendeles') {
        rendelesQty += qty;
        rendelesCount++;
      }
    });

    document.getElementById('stats-total-kivisz').textContent = totalKivisz;
    document.getElementById('stats-kivisz-bazar').textContent = kiviszBazar;
    document.getElementById('stats-kivisz-fenti').textContent = kiviszFenti;
    document.getElementById('stats-last-kivisz').textContent  = lastKiviszDate
      ? `Legutóbbi kivitel: ${lastKiviszDate.toLocaleString('hu-HU')}`
      : 'Még nem volt kivitel';

    document.getElementById('stats-osszeiras-qty').textContent   = osszeirasQty;
    document.getElementById('stats-osszeiras-count').textContent = osszeirasCount > 0
      ? `${osszeirasCount} összeírásban szerepelt`
      : 'Még nem szerepelt összeírásban';

    document.getElementById('stats-rendeles-qty').textContent   = rendelesQty;
    document.getElementById('stats-rendeles-count').textContent = rendelesCount > 0
      ? `${rendelesCount} rendelésben volt`
      : 'Még nem volt rendelésben';

    const txListEl = document.getElementById('item-stats-tx-list');
    txListEl.innerHTML = '';
    const recent = relevantTx.slice(0, 50);

    if (recent.length === 0) {
      txListEl.innerHTML = '<div style="color:var(--color-subtext); font-size:0.8rem; text-align:center; padding:0.5rem;">Nincs tranzakció ehhez a tollhoz.</div>';
    } else {
      recent.forEach(tx => {
        const txItems = Array.isArray(tx.items) ? tx.items : [];
        const matchItem = txItems.find(i => i.name === item.name);
        const qty = matchItem ? Math.abs(matchItem.qty || 0) : 0;
        const meta = txTypeLabels[tx.type] || { icon: '❓', label: tx.type, color: 'var(--color-subtext)' };
        const boothLabel = boothLabels[tx.booth] || tx.booth || '–';
        const dateStr = new Date(tx.created_at).toLocaleString('hu-HU', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let qtyDisplay = `${qty} db`;
        if (tx.type === 'osszeiras' && matchItem && matchItem.fulfilled !== undefined && matchItem.fulfilled < matchItem.qty) {
          qtyDisplay = `<span style="color:#f87171;">kért: ${matchItem.qty} / kapott: ${matchItem.fulfilled}</span>`;
        }

        const div = document.createElement('div');
        div.style.cssText = `display:flex; align-items:center; gap:0.6rem; padding:0.45rem 0.6rem; border-radius:8px; background:rgba(255,255,255,0.04); border-left:3px solid ${meta.color}; margin-bottom:0.4rem;`;
        div.innerHTML = `
          <span style="font-size:1rem;">${meta.icon}</span>
          <div style="flex:1; min-width:0;">
            <div style="font-size:0.8rem; font-weight:600; color:${meta.color};">${meta.label} · ${boothLabel}</div>
            <div style="font-size:0.72rem; color:var(--color-subtext); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${dateStr} · ${tx.user_name || '–'}${tx.notes ? ' · ' + tx.notes : ''}</div>
          </div>
          <span style="font-size:0.85rem; font-weight:700; color:var(--color-text); white-space:nowrap;">${qtyDisplay}</span>
        `;
        txListEl.appendChild(div);
      });
    }

    document.getElementById('item-stats-loading').classList.add('hidden');
    document.getElementById('item-stats-content').classList.remove('hidden');
  }

  async function loadAndRenderNames() {
    namesTableBody.innerHTML = "";
    (await fetchNames()).forEach(renderNameRow);
    applyGlobalSearchFilter();
  }

  // ── KÉSZLET TÁBLÁZAT RENDEZÉS ───────────────────────────────
  const inventoryHeaders = document.querySelectorAll("#inventory-table th[data-sort]");
  inventoryHeaders.forEach(th => {
    th.addEventListener("pointerup", () => {
      if (currentRole !== "admin") return;

      const type = th.dataset.sort;
      const isAsc = th.dataset.asc === "true";
      const span = th.querySelector("span[data-role='admin']");
      if (!span) return;
      
      // Reset all arrows
      inventoryHeaders.forEach(h => {
        h.dataset.asc = "";
        const s = h.querySelector("span[data-role='admin']");
        if (s) s.textContent = s.textContent.replace("⬇️", "↕️").replace("⬆️", "↕️");
      });

      // Set new direction
      th.dataset.asc = (!isAsc).toString();
      span.textContent = span.textContent.replace("↕️", !isAsc ? "⬆️" : "⬇️");

      const rows = Array.from(namesTableBody.querySelectorAll("tr"));
      
      rows.sort((a, b) => {
        let valA, valB;
        if (type === "string") {
          valA = a.firstElementChild.textContent.trim().toLowerCase();
          valB = b.firstElementChild.textContent.trim().toLowerCase();
          return !isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (type === "number") {
          // A 2. oszlop a raktárkészlet
          valA = parseInt(a.dataset.stock, 10) || 0;
          valB = parseInt(b.dataset.stock, 10) || 0;
          
          if (valA === valB) {
            // Másodlagos rendezés állvány hiány alapján
            const rackA = (parseInt(a.dataset.bazar, 10) || 0) + (parseInt(a.dataset.fenti, 10) || 0);
            const rackB = (parseInt(b.dataset.bazar, 10) || 0) + (parseInt(b.dataset.fenti, 10) || 0);
            return !isAsc ? rackB - rackA : rackB - rackA; // Hiány szerint mindig csökkenő a másodlagos!
          }
          
          return !isAsc ? valA - valB : valB - valA;
        }
      });

      namesTableBody.innerHTML = "";
      rows.forEach(row => namesTableBody.appendChild(row));
    });
  });

  function addName() {
    const name = prompt("Toll neve:");
    if (!name) return;
    supabaseClient.from("names").insert({ name })
      .then(({ error }) => { if (error) console.error(error); else loadAndRenderNames(); });
  }

  const editModal = document.getElementById("edit-item-modal");
  const editIdInput = document.getElementById("edit-item-id");
  const editNameInput = document.getElementById("edit-item-name");
  const editCentralInput = document.getElementById("edit-item-central");
  const editBazarInput = document.getElementById("edit-item-bazar");
  const editFentiInput = document.getElementById("edit-item-fenti");
  const editCategoryInput = document.getElementById("edit-item-category");

  document.getElementById("edit-item-close")?.addEventListener("pointerup", closeEditModal);
  document.getElementById("edit-item-cancel")?.addEventListener("pointerup", closeEditModal);
  document.getElementById("edit-item-save")?.addEventListener("pointerup", saveEditItem);

  function closeEditModal() {
    editModal.classList.add("hidden");
  }

  function editName(item) {
    editIdInput.value = item.id;
    editNameInput.value = item.name || "";
    editCentralInput.value = item.central_stock || 0;
    editBazarInput.value = item.bazar_stock || 0;
    editFentiInput.value = item.fenti_stock || 0;
    if (editCategoryInput) editCategoryInput.value = item.category || "C";
    
    editModal.classList.remove("hidden");
  }

  async function saveEditItem(e) {
    e.preventDefault();
    const id = editIdInput.value;
    if (!id) return;

    const newName = editNameInput.value.trim();
    if (!newName) { alert("A név nem lehet üres!"); return; }

    const stock = parseInt(editCentralInput.value, 10) || 0;
    const bazar = parseInt(editBazarInput.value, 10) || 0;
    const fenti = parseInt(editFentiInput.value, 10) || 0;
    const cat = editCategoryInput ? editCategoryInput.value : "C";

    // 1. Lekérdezzük a régi értékeket
    const { data: oldItem } = await supabaseClient.from("names").select("name, central_stock, bazar_stock, fenti_stock").eq("id", id).single();

    // 2. Frissítjük a készletet
    const { error } = await supabaseClient.from("names")
      .update({ 
        name: newName, 
        central_stock: stock, 
        bazar_stock: bazar,
        fenti_stock: fenti,
        category: cat
      })
      .eq("id", id);

    if (error) {
      alert("Hiba: " + error.message);
      console.error(error);
    } else {
      // 3. Ha sikeres, és volt számszerű változás, naplózzuk
      if (oldItem) {
        const deltaCentral = stock - (oldItem.central_stock || 0);
        const deltaBazar = bazar - (oldItem.bazar_stock || 0);
        const deltaFenti = fenti - (oldItem.fenti_stock || 0);

        if (deltaCentral !== 0 || deltaBazar !== 0 || deltaFenti !== 0) {
          await supabaseClient.from("transactions").insert({
            type: "korrekcio",
            booth: "mindketto", // mindketto-t használunk, mert több raktárt is érinthet
            user_name: currentUser || "Ismeretlen",
            items: [{
              id: id,
              name: oldItem.name,
              qty: Math.abs(deltaCentral) + Math.abs(deltaBazar) + Math.abs(deltaFenti), // pseudo qty
              delta_central: deltaCentral,
              delta_bazar: deltaBazar,
              delta_fenti: deltaFenti,
              old_central: oldItem.central_stock || 0,
              new_central: stock,
              old_bazar: oldItem.bazar_stock || 0,
              new_bazar: bazar,
              old_fenti: oldItem.fenti_stock || 0,
              new_fenti: fenti
            }]
          });
        }
      }

      closeEditModal();
      loadAndRenderNames();
    }
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

  // ── SELEJTEZÉS (SCRAP) LOGIKA ──────────────────────────────
  const scrapModal = document.getElementById("scrap-item-modal");
  const scrapIdInput = document.getElementById("scrap-item-id");
  const scrapNameInput = document.getElementById("scrap-item-name");
  const scrapQtyInput = document.getElementById("scrap-item-qty");
  const scrapBoothSelect = document.getElementById("scrap-item-booth");
  const scrapNotesInput = document.getElementById("scrap-item-notes");

  document.getElementById("scrap-item-close")?.addEventListener("pointerup", closeScrapModal);
  document.getElementById("scrap-item-cancel")?.addEventListener("pointerup", closeScrapModal);
  document.getElementById("scrap-item-save")?.addEventListener("pointerup", saveScrapItem);

  function closeScrapModal(e) {
    if (e) e.preventDefault();
    scrapModal.classList.add("hidden");
  }

  function openScrapModal(item) {
    scrapIdInput.value = item.id;
    scrapNameInput.value = item.name || "";
    scrapQtyInput.value = 1;
    scrapNotesInput.value = "";
    scrapModal.classList.remove("hidden");
  }

  async function saveScrapItem(e) {
    e.preventDefault();
    const id = scrapIdInput.value;
    if (!id) return;

    const qty = parseInt(scrapQtyInput.value, 10);
    if (isNaN(qty) || qty <= 0) {
      alert("Érvénytelen mennyiség!");
      return;
    }

    const booth = scrapBoothSelect.value;
    let note = scrapNotesInput.value.trim();
    if (!note) note = "Selejt / Hibás termék";

    // 1. Lekérdezzük a jelenlegi készletet
    const { data: oldItem, error: fetchErr } = await supabaseClient
      .from("names")
      .select("name, central_stock, bazar_stock, fenti_stock")
      .eq("id", id)
      .single();
    
    if (fetchErr || !oldItem) {
      alert("Hiba a készlet lekérdezésekor!");
      return;
    }

    // 2. Kiszámoljuk az új készletet (csak a központi raktárt módosítjuk, a hiányt nem piszkáljuk)
    let updatePayload = {};
    if (booth === "kozponti") {
      updatePayload.central_stock = (oldItem.central_stock || 0) - qty;
    }

    // 3. Frissítjük a készletet (ha van mit frissíteni)
    if (Object.keys(updatePayload).length > 0) {
      const { error: updateErr } = await supabaseClient
        .from("names")
        .update(updatePayload)
        .eq("id", id);
      
      if (updateErr) {
        alert("Hiba a készlet frissítésekor: " + updateErr.message);
        return;
      }
    }

    // 4. Naplózzuk a selejtet
    const { error: txErr } = await supabaseClient.from("transactions").insert({
      type: "selejt",
      booth: booth,
      user_name: currentUser || "Ismeretlen",
      items: [{ name: oldItem.name, qty: qty }],
      notes: note
    });

    if (txErr) {
      console.error("Selejt tranzakció mentése sikertelen:", txErr);
      alert("Figyelem: A készlet csökkent, de a naplózás sikertelen volt! (A tranzakció típusa lehet hogy hiányzik az adatbázisból)");
    } else {
      alert("Sikeresen selejtezve!");
    }

    closeScrapModal();
    loadAndRenderNames();
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
    applyGlobalSearchFilter();
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



  importInventoryBtn?.addEventListener("pointerup", (e) => {
    e.preventDefault(); importTarget = "names"; importInventoryFile.value = ""; importInventoryFile.click();
  });
  
  document.getElementById("export-inventory-btn")?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    if (typeof XLSX === "undefined") {
      alert("A SheetJS még töltődik be, kérlek várj...");
      return;
    }
    
    const { data: names, error } = await supabaseClient
      .from("names")
      .select("name, central_stock, bazar_stock, fenti_stock")
      .order("name", { ascending: true });
      
    if (error) {
      alert("Hiba a készlet letöltésekor: " + error.message);
      return;
    }
    
    if (!names || names.length === 0) {
      alert("A készlet üres, nincs mit exportálni!");
      return;
    }

    const dataMatrix = [
      ["Toll neve", "Központi készlet", "Bazár", "Krisztián"]
    ];

    names.forEach(item => {
      dataMatrix.push([
        item.name,
        Number(item.central_stock) || 0,
        Number(item.bazar_stock) || 0,
        Number(item.fenti_stock) || 0
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(dataMatrix);
    
    ws['!cols'] = [
      { wch: 30 },
      { wch: 20 },
      { wch: 15 },
      { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Készlet");
    
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `Keszlet_Export_${dateStr}.xlsx`);
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

    const logItems = [];
    const finalRecords = parsedRecords
      .filter(r => !r._noChange) // Add módban szám nélküli nevek → nem módosítjuk
      .map(r => {
        if (r.new_stock !== undefined) {
          logItems.push({ name: r.name, old_stock: r.old_stock, new_stock: r.new_stock });
        }
        const copy = { ...r };
        delete copy.old_stock;  // Ideiglenes UI prop
        delete copy._noChange;  // Ideiglenes jelölő
        if (copy.new_stock !== undefined) {
          copy.central_stock = copy.new_stock;
          delete copy.new_stock;
        }
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
      // Mentsük le a változókat mielőtt a closeModal() törölné őket!
      const target = importTarget;
      const count = parsedRecords.length;
      
      if (target === "names" && logItems.length > 0) {
        const mode = document.querySelector('input[name="import_mode"]:checked')?.value || "add";
        const { error: txErr } = await supabaseClient.from('transactions').insert({
          type: 'feltoltes',
          booth: 'kozponti',
          user_name: currentUser || currentRole,
          items: logItems,
          notes: mode === 'add' ? 'Excel import: Beérkező áru' : 'Excel import: Kezdő leltár'
        });
        if (txErr) {
          console.error("Hiba a tranzakció mentésekor:", txErr);
          alert("Figyelem: A készlet frissült, de a naplózás nem sikerült! Hiba: " + txErr.message);
        }
      }
      
      if (target === "names") {
        loadAndRenderNames();
        loadShortageNames(); // Refresh shortage table as well
      } else {
        loadAndRenderPens();
      }
      
      alert(`✅ Sikeresen importálva: ${count} rekord.`);
      closeModal();
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

  // ── CATEGORIES UI & AUTO-CATEGORIZE ───────────────────────────
  const categoriesTableBody = document.querySelector('#categories-table tbody');
  
  async function renderCategoriesTable() {
    if (!categoriesTableBody) return;
    categoriesTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">⏳ Betöltés...</td></tr>';

    const { data: allPens } = await supabaseClient.from('names').select('name, category').order('name');
    const pensByCategory = {};
    if (allPens) {
      allPens.forEach(p => {
        const cat = p.category || 'C';
        if (!pensByCategory[cat]) pensByCategory[cat] = [];
        pensByCategory[cat].push(p.name);
      });
    }

    categoriesTableBody.innerHTML = '';
    globalCategories.forEach(cat => {
      const pensInCat = pensByCategory[cat.id] || [];
      let pensHtml = `<div style="color:var(--color-subtext); font-size:0.85rem; text-align:center;">0 db toll</div>`;
      if (pensInCat.length > 0) {
        const badges = pensInCat.map(p => `<span style="display:inline-block; padding:0.25rem 0.6rem; margin:0.2rem; background:rgba(139, 92, 246, 0.15); border:1px solid rgba(139, 92, 246, 0.3); border-radius:12px; color:#ddd; font-size:0.75rem;">${p}</span>`).join('');
        pensHtml = `
          <details style="font-size:0.85rem;">
            <summary style="cursor:pointer; color:var(--color-accent); font-weight:bold; outline:none; user-select:none;">${pensInCat.length} db toll ▼</summary>
            <div style="margin-top:0.6rem; display:flex; flex-wrap:wrap; text-align:left; padding:0.5rem; background:rgba(0,0,0,0.2); border-radius:8px; border:1px solid rgba(255,255,255,0.05); max-height: 250px; overflow-y:auto;" class="custom-scrollbar">
              ${badges}
            </div>
          </details>
        `;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:bold;">${cat.id}</td>
        <td><input type="text" class="styled-input cat-icon" value="${cat.icon}" style="width:60px; text-align:center;"></td>
        <td><input type="text" class="styled-input cat-name" value="${cat.name}"></td>
        <td style="min-width:150px;">${pensHtml}</td>
        <td><input type="number" class="styled-input cat-limit" value="${cat.limit_stock}" style="width:80px; text-align:center;"></td>
        <td style="display:flex; gap:0.5rem; justify-content:center;">
          <button class="cta-button secondary save-cat-btn" style="padding:0.4rem 0.8rem; font-size:0.85rem;">💾 Mentés</button>
          <button class="cta-button del-cat-btn" style="background:#ef4444; border:none; padding:0.4rem 0.8rem; font-size:0.85rem;">❌ Törlés</button>
        </td>
      `;
      tr.querySelector('.save-cat-btn').addEventListener('pointerup', async (e) => {
        e.preventDefault();
        const nIcon = tr.querySelector('.cat-icon').value;
        const nName = tr.querySelector('.cat-name').value;
        const nLimit = parseInt(tr.querySelector('.cat-limit').value, 10) || 0;
        const { error } = await supabaseClient.from('categories').update({ name: nName, icon: nIcon, limit_stock: nLimit }).eq('id', cat.id);
        if (error) { alert('Hiba mentéskor!'); console.error(error); }
        else { 
          alert('Mentve!'); 
          await fetchCategories(); 
          applyGlobalSearchFilter(); 
          loadStats(); 
          loadAndRenderNames(); 
          loadOrderNames(); 
        }
      });

      tr.querySelector('.del-cat-btn').addEventListener('pointerup', async (e) => {
        e.preventDefault();
        
        // Ellenőrizzük, hogy használja-e valaki
        const { count } = await supabaseClient.from('names').select('*', { count: 'exact', head: true }).eq('category', cat.id);
        if (count > 0) {
          alert(`Nem törölheted, mert ${count} db toll jelenleg ebben a kategóriában van! Előbb tedd át őket máshova.`);
          return;
        }

        if (confirm(`Biztosan törlöd a(z) '${cat.id}' kategóriát?`)) {
          const { error } = await supabaseClient.from('categories').delete().eq('id', cat.id);
          if (error) { alert('Hiba a törléskor!'); console.error(error); }
          else {
            alert('Kategória törölve!');
            await fetchCategories();
            applyGlobalSearchFilter();
            loadStats();
          }
        }
      });
      categoriesTableBody.appendChild(tr);
    });
  }

  // Add Category Modal Logic
  const addCategoryModal = document.getElementById("add-category-modal");
  const addCatId = document.getElementById("add-cat-id");
  const addCatIcon = document.getElementById("add-cat-icon");
  const addCatName = document.getElementById("add-cat-name");
  const addCatLimit = document.getElementById("add-cat-limit");

  document.getElementById("add-category-btn")?.addEventListener("pointerup", (e) => {
    e.preventDefault();
    addCatId.value = "";
    addCatIcon.value = "";
    addCatName.value = "";
    addCatLimit.value = "0";
    addCategoryModal.classList.remove("hidden");
  });

  const closeAddCatModal = () => addCategoryModal.classList.add("hidden");
  document.getElementById("add-category-close")?.addEventListener("pointerup", (e) => { e.preventDefault(); closeAddCatModal(); });
  document.getElementById("add-category-cancel")?.addEventListener("pointerup", (e) => { e.preventDefault(); closeAddCatModal(); });

  document.getElementById("add-category-save")?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    const id = addCatId.value.trim().toUpperCase();
    const icon = addCatIcon.value.trim();
    const name = addCatName.value.trim();
    const limit = parseInt(addCatLimit.value, 10) || 0;

    if (!id || !name) { alert("Az azonosító és a név megadása kötelező!"); return; }
    if (globalCategories.find(c => c.id === id)) { alert("Ilyen azonosítójú kategória már létezik!"); return; }

    const { error } = await supabaseClient.from('categories').insert({ id, name, icon, limit_stock: limit });
    if (error) { alert("Hiba a mentéskor: " + error.message); console.error(error); }
    else {
      closeAddCatModal();
      await fetchCategories();
      alert("Új kategória sikeresen hozzáadva!");
    }
  });


  document.getElementById('auto-categorize-btn')?.addEventListener('pointerup', async (e) => {
    e.preventDefault();
    if (!confirm('Biztosan újra akarod kategorizálni a tollakat az elmúlt 30 nap eladásai alapján? (10%-20%-40%-20%-10% elosztás)')) return;
    
    document.getElementById('auto-categorize-btn').textContent = '⏳ Kis türelmet...';

    // 0. Biztosítjuk, hogy az A, B, C, D, E kategóriák létezzenek
    const requiredCats = ['A', 'B', 'C', 'D', 'E'];
    for (const reqId of requiredCats) {
      if (!globalCategories.find(c => c.id === reqId)) {
        await supabaseClient.from('categories').insert({ id: reqId, name: `Kategória ${reqId}`, icon: '🏷️', limit_stock: 0 });
      }
    }
    await fetchCategories(); // Újratöltjük a listát

    // 1. Lekérjük a tranzakciókat (kivisz és selejt is kell, hogy a selejt levonódjon a fogyásból)
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30);
    const { data: txData } = await supabaseClient.from('transactions').select('items, type, booth').in('type', ['kivisz', 'selejt']).gte('created_at', fromDate.toISOString());
    
    const sales = {};
    (txData || []).forEach(tx => {
      (tx.items || []).forEach(item => {
        const qty = Math.abs(item.qty || 0);
        if (tx.type === 'kivisz') {
          sales[item.name] = (sales[item.name] || 0) + qty;
        } else if (tx.type === 'selejt' && (tx.booth === 'bazar' || tx.booth === 'fenti')) {
          sales[item.name] = (sales[item.name] || 0) - qty;
        }
      });
    });

    // 2. Lekérjük a neveket
    const { data: names } = await supabaseClient.from('names').select('id, name, category');
    if (!names) return;

    // Minden névhez hozzárendeljük az eladást
    names.forEach(n => { n.sales = sales[n.name] || 0; });

    // Rendezzük csökkenő sorrendbe (legtöbb eladás elöl)
    names.sort((a, b) => b.sales - a.sales);

    const total = names.length;
    const aCount = Math.round(total * 0.10);
    const bCount = Math.round(total * 0.20);
    const cCount = Math.round(total * 0.40);
    const dCount = Math.round(total * 0.20);

    let updates = [];
    for (let i = 0; i < total; i++) {
      let newCat = 'E';
      if (i < aCount) newCat = 'A';
      else if (i < aCount + bCount) newCat = 'B';
      else if (i < aCount + bCount + cCount) newCat = 'C';
      else if (i < aCount + bCount + cCount + dCount) newCat = 'D';

      if (names[i].category !== newCat) {
        updates.push({ id: names[i].id, category: newCat });
      }
    }

    if (updates.length === 0) {
      alert('Nincs szükség változtatásra, minden a megfelelő kategóriában van!');
      document.getElementById('auto-categorize-btn').textContent = '✨ Automatikus Kategorizálás';
      return;
    }

    // Supabase update for each
    let errorCount = 0;
    for (const u of updates) {
      const { error } = await supabaseClient.from('names').update({ category: u.category }).eq('id', u.id);
      if (error) errorCount++;
    }

    alert(`${updates.length} toll kategóriája frissítve lett! (Hiba: ${errorCount})`);
    document.getElementById('auto-categorize-btn').innerHTML = '✨ Automatikus Kategorizálás';
    loadAndRenderNames();
    loadOrderNames();
    loadStats();
  });

  // ── LELTÁR RÖGZÍTÉSE ─────────────────────────────────────────
  async function loadInventoryCount() {
    const tableBody = document.querySelector("#inventory-count-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "<tr><td colspan='3' style='text-align:center;'>Betöltés...</td></tr>";

    const names = await fetchNames();
    tableBody.innerHTML = "";

    names.forEach(item => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      tr.dataset.name = item.name;
      tr.dataset.category = item.category || 'C';
      tr.dataset.stock = item.central_stock || 0;
      
      tr.innerHTML = `
        <td>${item.name}</td>
        <td style="font-weight: 500;">${item.central_stock || 0} db</td>
        <td>
          <input type="number" inputmode="numeric" pattern="[0-9]*" class="styled-input inventory-actual-input" placeholder="Valós db" min="0" style="max-width: 120px;" />
        </td>
      `;
      tableBody.appendChild(tr);
    });

    applyGlobalSearchFilter();
  }

  document.getElementById("save-inventory-count-btn")?.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    
    const tableBody = document.querySelector("#inventory-count-table tbody");
    const rows = tableBody.querySelectorAll("tr");
    const updates = [];
    const logItems = [];

    rows.forEach(tr => {
      const id = tr.dataset.id;
      const name = tr.dataset.name;
      const oldStock = parseInt(tr.dataset.stock, 10) || 0;
      const input = tr.querySelector(".inventory-actual-input");
      if (!input || input.value.trim() === "") return;

      const newStock = parseInt(input.value, 10);
      if (isNaN(newStock) || newStock < 0) return;

      if (oldStock !== newStock) {
        updates.push({ id, central_stock: newStock });
        const delta = newStock - oldStock;
        logItems.push({
          id, name,
          old_central: oldStock,
          new_central: newStock,
          delta_central: delta,
          delta_bazar: 0,
          delta_fenti: 0,
          old_bazar: 0, new_bazar: 0,
          old_fenti: 0, new_fenti: 0,
          qty: Math.abs(delta)
        });
      }
    });

    if (updates.length === 0) {
      alert("Nincs eltérés, vagy nem írtál be valós készletet!");
      return;
    }

    if (!confirm(`Biztosan mented a leltárt? ${updates.length} toll készlete fog módosulni!`)) return;

    let errorCount = 0;
    for (const u of updates) {
      const { error } = await supabaseClient.from('names').update({ central_stock: u.central_stock }).eq('id', u.id);
      if (error) {
        console.error("Hiba készlet frissítésnél:", error);
        errorCount++;
      }
    }

    if (logItems.length > 0) {
      const { error: txErr } = await supabaseClient.from("transactions").insert({
        type: "korrekcio",
        booth: "kozponti",
        user_name: currentUser || "Ismeretlen",
        items: logItems,
        notes: "Leltár (Valós vs Gép)"
      });
      if (txErr) console.error("Hiba naplózásnál:", txErr);
    }

    alert(`Leltár mentve! ${updates.length} tétel frissült. (Hiba: ${errorCount})`);
    
    loadInventoryCount(); 
    loadAndRenderNames();
    loadOrderNames();
  });

  // ── KÉNYELMI FUNKCIÓK ────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && (e.target.type === 'number' || e.target.inputMode === 'numeric')) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        const table = e.target.closest('table');
        if (table) {
          e.preventDefault();
          const inputs = Array.from(table.querySelectorAll('input[type="number"], input[inputmode="numeric"]'));
          const idx = inputs.indexOf(e.target);
          if (idx !== -1 && idx < inputs.length - 1) {
            inputs[idx + 1].focus();
            inputs[idx + 1].select();
          }
        }
      } else if (e.key === 'ArrowUp') {
        const table = e.target.closest('table');
        if (table) {
          e.preventDefault();
          const inputs = Array.from(table.querySelectorAll('input[type="number"], input[inputmode="numeric"]'));
          const idx = inputs.indexOf(e.target);
          if (idx > 0) {
            inputs[idx - 1].focus();
            inputs[idx - 1].select();
          }
        }
      }
    }
  });

  // ── INDÍTÁS ──────────────────────────────────────────────────
  async function initApp() {
    await fetchCategories(); // Fontos: Kategóriák betöltése minden más előtt

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
