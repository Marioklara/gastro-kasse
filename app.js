const DEFAULT_PRODUCTS = [
  { id: 1, name: "Pizza Margherita", price: 8.5, category: "Pizza", tax: 19 },
  { id: 2, name: "Pizza Salami", price: 9.9, category: "Pizza", tax: 19 },
  { id: 3, name: "Pasta Napoli", price: 8.9, category: "Pasta", tax: 19 },
  { id: 4, name: "Lasagne", price: 11.5, category: "Pasta", tax: 19 },
  { id: 5, name: "Salat Mista", price: 6.9, category: "Salat", tax: 19 },
  { id: 6, name: "Bruschetta", price: 5.9, category: "Vorspeisen", tax: 19 },
  { id: 7, name: "Cola 0,33 l", price: 2.8, category: "Getränke", tax: 19 },
  { id: 8, name: "Wasser 0,5 l", price: 2.5, category: "Getränke", tax: 19 },
  { id: 9, name: "Espresso", price: 2.2, category: "Kaffee", tax: 19 },
  { id: 10, name: "Cappuccino", price: 3.2, category: "Kaffee", tax: 19 },
  { id: 11, name: "Hausbrot", price: 3.5, category: "Außer Haus", tax: 7 }
];

const DEFAULT_SETTINGS = {
  businessName: "Gastro Kasse Pro",
  businessAddress: "Musterstraße 1, 69100 Heidelberg",
  receiptFooter: "Danke für Ihren Besuch!"
};

const storage = {
  products: load("gkp_products", structuredClone(DEFAULT_PRODUCTS)),
  sales: load("gkp_sales", []),
  tables: load("gkp_tables", {}),
  settings: load("gkp_settings", structuredClone(DEFAULT_SETTINGS)),
  tse: load("gkp_tse", { mode: "demo", status: "Demo", serial: "DEMO-TSE" })
};

let cart = [];
let currentTable = "Außer Haus";
let activeCategory = "Alle";
let paymentMethod = "Bar";
let lastReceiptText = "";
let deferredInstallPrompt = null;

const $ = (id) => document.getElementById(id);

const tseAdapters = {
  async demoStart(order) {
    await wait(120);
    return {
      mode: "DEMO",
      status: "DEMO_NICHT_FISKAL",
      transactionNumber: `DEMO-${Date.now()}`,
      signatureCounter: storage.sales.length + 1,
      signature: `DEMO-${hash(JSON.stringify(order)).slice(0, 24)}`,
      serialNumber: "DEMO-TSE",
      startedAt: new Date().toISOString()
    };
  },
  async demoFinish() {
    await wait(80);
    return { finishedAt: new Date().toISOString() };
  },
  async middlewareStart(order) {
    return postTse("/transaction/start", order);
  },
  async middlewareFinish(order, startData) {
    return postTse("/transaction/finish", { order, transaction: startData });
  },
  async usbStart() {
    throw new Error("USB-TSE verbunden, aber kein zertifiziertes Geräteprotokoll hinterlegt. Bitte Hersteller-Middleware nutzen.");
  },
  async usbFinish() {
    throw new Error("USB-TSE verbunden, aber kein zertifiziertes Geräteprotokoll hinterlegt. Bitte Hersteller-Middleware nutzen.");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  fillSettingsForm();
  renderAll();
});

function bindEvents() {
  $("openTableBtn").addEventListener("click", openTableFromInput);
  $("saveTableBtn").addEventListener("click", parkCurrentTable);
  $("clearCartBtn").addEventListener("click", clearCart);
  $("checkoutBtn").addEventListener("click", checkout);
  $("printReceiptBtn").addEventListener("click", printReceipt);
  $("adminBtn").addEventListener("click", openAdmin);
  $("searchInput").addEventListener("input", renderProducts);
  $("saveProductBtn").addEventListener("click", saveProduct);
  $("cancelProductBtn").addEventListener("click", clearProductForm);
  $("connectMiddlewareBtn").addEventListener("click", connectMiddleware);
  $("connectUsbBtn").addEventListener("click", connectUsbTse);
  $("demoTseBtn").addEventListener("click", useDemoTse);
  $("exportSalesBtn").addEventListener("click", () => downloadJson("umsatz-export.json", storage.sales));
  $("exportTablesBtn").addEventListener("click", () => downloadJson("offene-tische.json", storage.tables));
  $("exportDsfinkBtn").addEventListener("click", exportDsfink);
  $("resetBtn").addEventListener("click", resetData);
  $("saveSettingsBtn").addEventListener("click", saveSettings);

  document.querySelectorAll(".pay-method").forEach((button) => {
    button.addEventListener("click", () => {
      paymentMethod = button.dataset.payment;
      document.querySelectorAll(".pay-method").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
    });
  });

  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.addEventListener("click", () => switchAdminTab(button.dataset.adminTab));
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $("installBtn").hidden = false;
  });

  $("installBtn").addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $("installBtn").hidden = true;
  });
}

function load(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function persist() {
  save("gkp_products", storage.products);
  save("gkp_sales", storage.sales);
  save("gkp_tables", storage.tables);
  save("gkp_settings", storage.settings);
  save("gkp_tse", storage.tse);
}

function money(value) {
  return Number(value || 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hash(text) {
  let result = 0;
  for (let index = 0; index < text.length; index++) {
    result = Math.imul(31, result) + text.charCodeAt(index) | 0;
  }
  return Math.abs(result).toString(16).padStart(8, "0");
}

function getCategories() {
  return ["Alle", ...new Set(storage.products.map((product) => product.category).filter(Boolean))];
}

function renderAll() {
  renderTseStatus();
  renderCategories();
  renderProducts();
  renderOpenTables();
  renderCart();
  renderAdminProducts();
  renderSales();
}

function renderCategories() {
  const tabs = $("categoryTabs");
  tabs.innerHTML = "";

  getCategories().forEach((category) => {
    const button = document.createElement("button");
    button.className = `category-tab${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategories();
      renderProducts();
    });
    tabs.appendChild(button);
  });
}

function renderProducts() {
  const grid = $("productGrid");
  const query = $("searchInput").value.trim().toLowerCase();
  const products = storage.products.filter((product) => {
    const matchesCategory = activeCategory === "Alle" || product.category === activeCategory;
    const matchesSearch = !query || `${product.name} ${product.category}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = "";
  products.forEach((product) => {
    const button = document.createElement("button");
    button.className = "product-card";
    button.innerHTML = `
      <strong>${escapeHtml(product.name)}</strong>
      <span>${money(product.price)}</span>
      <div class="product-meta">${escapeHtml(product.category)} · ${product.tax}% MwSt</div>
    `;
    button.addEventListener("click", () => addToCart(product.id));
    grid.appendChild(button);
  });
}

function addToCart(productId) {
  const product = storage.products.find((item) => item.id === productId);
  if (!product) return;

  const existing = cart.find((item) => item.id === productId);
  if (existing) existing.quantity += 1;
  else cart.push({ ...product, quantity: 1 });

  autoParkTable();
  renderCart();
}

function changeQuantity(productId, delta) {
  const item = cart.find((entry) => entry.id === productId);
  if (!item) return;

  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter((entry) => entry.id !== productId);
  }

  autoParkTable();
  renderCart();
}

function renderCart() {
  $("currentTableLabel").textContent = currentTable;
  $("cartTitle").textContent = currentTable === "Außer Haus" ? "Außer Haus" : currentTable;
  const list = $("cartItems");
  list.innerHTML = "";

  if (cart.length === 0) {
    list.innerHTML = '<div class="cart-empty">Noch keine Artikel im Bon.</div>';
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <strong class="cart-item-title">${escapeHtml(item.name)}</strong>
        <small>${item.quantity} × ${money(item.price)} · ${money(item.price * item.quantity)}</small>
      </div>
      <div class="qty-control">
        <button type="button" data-action="minus">−</button>
        <strong>${item.quantity}</strong>
        <button type="button" data-action="plus">+</button>
      </div>
    `;
    row.querySelector('[data-action="minus"]').addEventListener("click", () => changeQuantity(item.id, -1));
    row.querySelector('[data-action="plus"]').addEventListener("click", () => changeQuantity(item.id, 1));
    list.appendChild(row);
  });

  const totals = calculateTotals(cart);
  $("net19").textContent = money(totals.net19);
  $("tax19").textContent = money(totals.tax19);
  $("net7").textContent = money(totals.net7);
  $("tax7").textContent = money(totals.tax7);
  $("total").textContent = money(totals.total);
}

function calculateTotals(items) {
  const gross = items.reduce((sum, item) => {
    const rate = Number(item.tax) === 7 ? "7" : "19";
    sum[rate] += Number(item.price) * Number(item.quantity);
    return sum;
  }, { "7": 0, "19": 0 });

  const net19 = gross["19"] / 1.19;
  const net7 = gross["7"] / 1.07;
  return {
    gross19: gross["19"],
    gross7: gross["7"],
    net19,
    tax19: gross["19"] - net19,
    net7,
    tax7: gross["7"] - net7,
    total: gross["19"] + gross["7"]
  };
}

function openTableFromInput() {
  const value = $("tableInput").value.trim() || "Außer Haus";
  openTable(value);
}

function openTable(table) {
  if (cart.length > 0 && currentTable !== table) autoParkTable();
  currentTable = table;
  $("tableInput").value = table === "Außer Haus" ? "" : table;
  cart = storage.tables[table] ? structuredClone(storage.tables[table].items) : [];
  $("receiptBox").style.display = "none";
  renderAll();
}

function parkCurrentTable() {
  const value = $("tableInput").value.trim();
  if (value) currentTable = value;
  if (cart.length === 0) {
    alert("Dieser Bon ist leer.");
    return;
  }
  autoParkTable(true);
}

function autoParkTable(showMessage = false) {
  if (cart.length === 0) return;
  storage.tables[currentTable] = {
    table: currentTable,
    items: structuredClone(cart),
    updatedAt: new Date().toISOString(),
    total: calculateTotals(cart).total
  };
  persist();
  renderOpenTables();
  if (showMessage) alert("Tisch wurde geparkt.");
}

function renderOpenTables() {
  const list = $("openTableList");
  const tables = Object.values(storage.tables);
  $("openTablesCount").textContent = String(tables.length);
  list.innerHTML = "";

  if (tables.length === 0) {
    const empty = document.createElement("span");
    empty.className = "hint";
    empty.textContent = "Keine offenen Tische.";
    list.appendChild(empty);
    return;
  }

  tables.sort((a, b) => a.table.localeCompare(b.table, "de")).forEach((table) => {
    const button = document.createElement("button");
    button.className = `open-table-chip${table.table === currentTable ? " active" : ""}`;
    button.textContent = `${table.table} · ${money(table.total)}`;
    button.addEventListener("click", () => openTable(table.table));
    list.appendChild(button);
  });
}

function clearCart() {
  if (cart.length === 0) return;
  if (!confirm("Aktuellen Bon wirklich leeren?")) return;
  cart = [];
  delete storage.tables[currentTable];
  persist();
  renderAll();
}

async function checkout() {
  if (cart.length === 0) {
    alert("Der Bon ist leer.");
    return;
  }

  $("checkoutBtn").disabled = true;
  $("checkoutBtn").textContent = "TSE signiert...";

  try {
    const order = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      table: currentTable,
      paymentMethod,
      items: structuredClone(cart),
      totals: calculateTotals(cart)
    };

    const start = await startTseTransaction(order);
    const finish = await finishTseTransaction(order, start);
    const sale = { ...order, tse: { ...start, ...finish } };

    storage.sales.push(sale);
    delete storage.tables[currentTable];
    persist();
    showReceipt(sale);

    cart = [];
    currentTable = "Außer Haus";
    $("tableInput").value = "";
    renderAll();
  } catch (error) {
    alert(`Kassieren abgebrochen: ${error.message}`);
  } finally {
    $("checkoutBtn").disabled = false;
    $("checkoutBtn").textContent = "Kassieren";
  }
}

async function startTseTransaction(order) {
  if (storage.tse.mode === "middleware") return tseAdapters.middlewareStart(order);
  if (storage.tse.mode === "usb") return tseAdapters.usbStart(order);
  return tseAdapters.demoStart(order);
}

async function finishTseTransaction(order, startData) {
  if (storage.tse.mode === "middleware") return tseAdapters.middlewareFinish(order, startData);
  if (storage.tse.mode === "usb") return tseAdapters.usbFinish(order, startData);
  return tseAdapters.demoFinish(order, startData);
}

async function postTse(path, payload) {
  const baseUrl = ($("middlewareUrl").value || "http://127.0.0.1:8080").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`TSE-Middleware meldet HTTP ${response.status}`);
  return response.json();
}

async function connectMiddleware() {
  const baseUrl = ($("middlewareUrl").value || "http://127.0.0.1:8080").replace(/\/$/, "");
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json().catch(() => ({}));
    storage.tse = {
      mode: "middleware",
      status: "Verbunden",
      serial: info.serialNumber || info.serial || "Middleware",
      endpoint: baseUrl
    };
    persist();
    renderTseStatus();
  } catch (error) {
    alert(`Keine TSE-Middleware erreichbar: ${error.message}`);
  }
}

async function connectUsbTse() {
  if (!("usb" in navigator)) {
    alert("Dieser Browser unterstützt WebUSB nicht. Für USB-TSE bitte Chrome/Edge über HTTPS oder eine lokale Middleware nutzen.");
    return;
  }

  try {
    const device = await navigator.usb.requestDevice({ filters: [] });
    storage.tse = {
      mode: "usb",
      status: "USB erkannt",
      serial: device.serialNumber || `${device.vendorId}:${device.productId}`
    };
    persist();
    renderTseStatus();
    alert("USB-Gerät erkannt. Für echte Fiskalisierung muss jetzt das zertifizierte Herstellerprotokoll oder eine Middleware angebunden werden.");
  } catch (error) {
    if (error.name !== "NotFoundError") alert(`USB-Verbindung fehlgeschlagen: ${error.message}`);
  }
}

function useDemoTse() {
  storage.tse = { mode: "demo", status: "Demo", serial: "DEMO-TSE" };
  persist();
  renderTseStatus();
}

function renderTseStatus() {
  const label = storage.tse.mode === "demo" ? "Demo" : storage.tse.status;
  $("tseStatusLabel").textContent = label;
  $("tseModeBadge").textContent = storage.tse.mode.toUpperCase();
  $("tseModeBadge").classList.toggle("connected", storage.tse.mode !== "demo");
  $("tseHeadline").textContent = storage.tse.mode === "demo" ? "TSE Demo-Modus" : `TSE ${storage.tse.status}`;
  $("tseDetail").textContent = storage.tse.mode === "demo"
    ? "Demo-Bons sind nicht für den produktiven Einsatz geeignet."
    : `Seriennummer/Quelle: ${storage.tse.serial}`;
  if (storage.tse.endpoint) $("middlewareUrl").value = storage.tse.endpoint;
}

function showReceipt(sale) {
  const lines = [
    storage.settings.businessName,
    storage.settings.businessAddress,
    "--------------------------------",
    `Bon-ID: ${sale.id}`,
    `Datum: ${new Date(sale.createdAt).toLocaleString("de-DE")}`,
    `Tisch: ${sale.table}`,
    `Zahlart: ${sale.paymentMethod}`,
    "--------------------------------"
  ];

  sale.items.forEach((item) => {
    lines.push(`${item.quantity} x ${item.name}`);
    lines.push(`   ${money(item.price * item.quantity)} inkl. ${item.tax}% MwSt`);
  });

  lines.push("--------------------------------");
  lines.push(`Netto 19%: ${money(sale.totals.net19)}`);
  lines.push(`MwSt 19%:  ${money(sale.totals.tax19)}`);
  lines.push(`Netto 7%:  ${money(sale.totals.net7)}`);
  lines.push(`MwSt 7%:   ${money(sale.totals.tax7)}`);
  lines.push(`GESAMT:    ${money(sale.totals.total)}`);
  lines.push("--------------------------------");
  lines.push(`TSE Status: ${sale.tse.status || sale.tse.tseStatus || sale.tse.mode}`);
  lines.push(`TSE Transaktion: ${sale.tse.transactionNumber || sale.tse.transactionId || "-"}`);
  lines.push(`Signaturzähler: ${sale.tse.signatureCounter || "-"}`);
  lines.push(`TSE Seriennummer: ${sale.tse.serialNumber || sale.tse.tseSerialNumber || storage.tse.serial}`);
  lines.push(`Signatur: ${sale.tse.signature || "-"}`);
  lines.push("--------------------------------");
  lines.push(storage.settings.receiptFooter);

  lastReceiptText = lines.join("\n");
  $("receiptBox").textContent = lastReceiptText;
  $("receiptBox").style.display = "block";
}

function printReceipt() {
  if (!lastReceiptText && !$("receiptBox").textContent.trim()) {
    alert("Es gibt noch keinen Bon.");
    return;
  }
  window.print();
}

function openAdmin() {
  renderAdminProducts();
  renderSales();
  fillSettingsForm();
  $("adminDialog").showModal();
}

function switchAdminTab(tab) {
  document.querySelectorAll(".admin-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.adminTab === tab);
  });
  document.querySelectorAll(".admin-pane").forEach((pane) => pane.classList.remove("active"));
  $(`${tab}Pane`).classList.add("active");
}

function saveProduct() {
  const id = $("productId").value;
  const name = $("productName").value.trim();
  const price = Number($("productPrice").value);
  const category = $("productCategory").value.trim();
  const tax = Number($("productTax").value);

  if (!name || !category || !Number.isFinite(price) || price <= 0) {
    alert("Bitte Name, Kategorie und Preis korrekt eintragen.");
    return;
  }

  if (id) {
    const product = storage.products.find((item) => String(item.id) === id);
    if (product) Object.assign(product, { name, price, category, tax });
  } else {
    storage.products.push({ id: Date.now(), name, price, category, tax });
  }

  clearProductForm();
  persist();
  renderAll();
}

function clearProductForm() {
  $("productId").value = "";
  $("productName").value = "";
  $("productPrice").value = "";
  $("productCategory").value = "";
  $("productTax").value = "19";
}

function renderAdminProducts() {
  const list = $("productAdminList");
  list.innerHTML = "";

  storage.products.forEach((product) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.name)}</strong><br>
        <small>${money(product.price)} · ${escapeHtml(product.category)} · ${product.tax}%</small>
      </div>
      <button type="button" class="secondary-btn" data-edit>Bearbeiten</button>
      <button type="button" class="danger-btn" data-delete>Löschen</button>
    `;
    row.querySelector("[data-edit]").addEventListener("click", () => editProduct(product));
    row.querySelector("[data-delete]").addEventListener("click", () => deleteProduct(product.id));
    list.appendChild(row);
  });
}

function editProduct(product) {
  $("productId").value = product.id;
  $("productName").value = product.name;
  $("productPrice").value = product.price;
  $("productCategory").value = product.category;
  $("productTax").value = product.tax;
  switchAdminTab("products");
}

function deleteProduct(id) {
  const product = storage.products.find((item) => item.id === id);
  if (!product || !confirm(`Artikel löschen: ${product.name}?`)) return;
  storage.products = storage.products.filter((item) => item.id !== id);
  persist();
  renderAll();
}

function renderSales() {
  const list = $("salesList");
  list.innerHTML = "";

  if (storage.sales.length === 0) {
    list.innerHTML = '<p class="hint">Noch keine Umsätze gespeichert.</p>';
    return;
  }

  storage.sales.slice().reverse().forEach((sale) => {
    const row = document.createElement("div");
    row.className = "sale-row";
    row.innerHTML = `
      <div>
        <strong>${money(sale.totals.total)}</strong><br>
        <small>${new Date(sale.createdAt).toLocaleString("de-DE")} · ${escapeHtml(sale.table)} · ${escapeHtml(sale.paymentMethod)}</small>
      </div>
      <button type="button" class="secondary-btn" data-receipt>Bon</button>
    `;
    row.querySelector("[data-receipt]").addEventListener("click", () => showReceipt(sale));
    list.appendChild(row);
  });
}

function exportDsfink() {
  const exportData = {
    createdAt: new Date().toISOString(),
    note: "Vorbereiteter Export. Für produktive DSFinV-K muss das Format mit Steuerberatung/Kassenhersteller final validiert werden.",
    cashPoint: storage.settings,
    tse: storage.tse,
    transactions: storage.sales.map((sale) => ({
      bon_id: sale.id,
      timestamp: sale.createdAt,
      table: sale.table,
      payment: sale.paymentMethod,
      total_gross: sale.totals.total,
      vat_19: sale.totals.tax19,
      vat_7: sale.totals.tax7,
      tse_transaction: sale.tse.transactionNumber || sale.tse.transactionId,
      tse_signature: sale.tse.signature,
      items: sale.items
    }))
  };
  downloadJson("dsfinvk-vorbereitung.json", exportData);
}

function saveSettings() {
  storage.settings = {
    businessName: $("businessName").value.trim() || DEFAULT_SETTINGS.businessName,
    businessAddress: $("businessAddress").value.trim() || DEFAULT_SETTINGS.businessAddress,
    receiptFooter: $("receiptFooter").value.trim() || DEFAULT_SETTINGS.receiptFooter
  };
  persist();
  alert("Einstellungen gespeichert.");
}

function fillSettingsForm() {
  $("businessName").value = storage.settings.businessName;
  $("businessAddress").value = storage.settings.businessAddress;
  $("receiptFooter").value = storage.settings.receiptFooter;
}

function resetData() {
  if (!confirm("Wirklich alle lokalen Daten löschen?")) return;
  localStorage.removeItem("gkp_products");
  localStorage.removeItem("gkp_sales");
  localStorage.removeItem("gkp_tables");
  localStorage.removeItem("gkp_settings");
  localStorage.removeItem("gkp_tse");
  location.reload();
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
