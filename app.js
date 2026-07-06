const DEFAULT_PRODUCTS = [
  { id: 1, name: "Pizza Margherita", price: 8.50, category: "Pizza", tax: 19 },
  { id: 2, name: "Pizza Salami", price: 9.90, category: "Pizza", tax: 19 },
  { id: 3, name: "Pizza Funghi", price: 9.50, category: "Pizza", tax: 19 },
  { id: 4, name: "Pasta Napoli", price: 8.90, category: "Pasta", tax: 19 },
  { id: 5, name: "Pasta Bolognese", price: 10.50, category: "Pasta", tax: 19 },
  { id: 6, name: "Salat Mista", price: 6.90, category: "Salat", tax: 19 },
  { id: 7, name: "Cola 0,33l", price: 2.80, category: "Getränke", tax: 19 },
  { id: 8, name: "Wasser 0,5l", price: 2.50, category: "Getränke", tax: 19 },
  { id: 9, name: "Espresso", price: 2.20, category: "Kaffee", tax: 19 },
  { id: 10, name: "Cappuccino", price: 3.20, category: "Kaffee", tax: 19 }
];

let products = load("products", structuredClone(DEFAULT_PRODUCTS));
let sales = load("sales", []);
let openTablesData = load("openTables", {});
let cart = [];
let currentTable = "-";
let activeCategory = "Alle";
let lastReceiptText = "";

const categoryTabs = document.getElementById("categoryTabs");
const productGrid = document.getElementById("productGrid");
const cartItems = document.getElementById("cartItems");
const receiptBox = document.getElementById("receiptBox");

document.getElementById("checkoutBtn").addEventListener("click", checkout);
document.getElementById("clearCartBtn").addEventListener("click", clearCart);
document.getElementById("showAdminBtn").addEventListener("click", showAdmin);
document.getElementById("closeAdminBtn").addEventListener("click", closeAdmin);
document.getElementById("addProductBtn").addEventListener("click", saveProductFromAdmin);
document.getElementById("cancelEditBtn").addEventListener("click", clearProductForm);
document.getElementById("exportSalesBtn").addEventListener("click", exportSales);
document.getElementById("exportTablesBtn").addEventListener("click", exportTables);
document.getElementById("resetDataBtn").addEventListener("click", resetData);
document.getElementById("loadTableBtn").addEventListener("click", loadTableFromInput);
document.getElementById("saveTableBtn").addEventListener("click", saveCurrentTable);
document.getElementById("printReceiptBtn").addEventListener("click", printReceipt);

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

function money(value) {
  return Number(value).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR"
  });
}

function getCategories() {
  return ["Alle", ...new Set(products.map(product => product.category))];
}

function renderCategories() {
  categoryTabs.innerHTML = "";

  getCategories().forEach(category => {
    const button = document.createElement("button");
    button.className = "category-btn";
    button.textContent = category;

    if (category === activeCategory) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      activeCategory = category;
      render();
    });

    categoryTabs.appendChild(button);
  });
}

function renderProducts() {
  productGrid.innerHTML = "";

  const shownProducts =
    activeCategory === "Alle"
      ? products
      : products.filter(product => product.category === activeCategory);

  shownProducts.forEach(product => {
    const button = document.createElement("button");
    button.className = "product-card";
    button.innerHTML = `
      <strong>${escapeHtml(product.name)}</strong>
      <span>${money(product.price)}</span><br>
      <small>${escapeHtml(product.category)} · ${product.tax}% MwSt</small>
    `;

    button.addEventListener("click", () => addToCart(product.id));
    productGrid.appendChild(button);
  });
}

function addToCart(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;

  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }

  autoSaveTable();
  renderCart();
}

function changeQuantity(productId, change) {
  const item = cart.find(product => product.id === productId);
  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(product => product.id !== productId);
  }

  autoSaveTable();
  renderCart();
}

function clearCart() {
  const ok = confirm("Warenkorb wirklich leeren?");
  if (!ok) return;

  cart = [];
  delete openTablesData[currentTable];
  save("openTables", openTablesData);

  receiptBox.style.display = "none";
  renderAll();
}

function calculateTotals() {
  let gross19 = 0;
  let gross7 = 0;

  cart.forEach(item => {
    const gross = item.price * item.quantity;

    if (Number(item.tax) === 7) {
      gross7 += gross;
    } else {
      gross19 += gross;
    }
  });

  const net19 = gross19 / 1.19;
  const tax19 = gross19 - net19;

  const net7 = gross7 / 1.07;
  const tax7 = gross7 - net7;

  return {
    gross19,
    gross7,
    net19,
    tax19,
    net7,
    tax7,
    total: gross19 + gross7
  };
}

function renderCart() {
  cartItems.innerHTML = "";

  document.getElementById("currentTableText").textContent = currentTable;

  if (cart.length === 0) {
    cartItems.innerHTML = `<p class="empty-cart">Noch keine Produkte gewählt.</p>`;
  }

  cart.forEach(item => {
    const row = document.createElement("div");
    row.className = "cart-item";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.name)}</strong><br>
        <small>${item.quantity} × ${money(item.price)}</small>
      </div>
      <div class="cart-actions">
        <button class="small-btn" data-action="minus">−</button>
        <strong>${item.quantity}</strong>
        <button class="small-btn" data-action="plus">+</button>
      </div>
    `;

    row.querySelector('[data-action="minus"]').addEventListener("click", () => changeQuantity(item.id, -1));
    row.querySelector('[data-action="plus"]').addEventListener("click", () => changeQuantity(item.id, 1));

    cartItems.appendChild(row);
  });

  const totals = calculateTotals();

  document.getElementById("net19").textContent = money(totals.net19);
  document.getElementById("tax19").textContent = money(totals.tax19);
  document.getElementById("net7").textContent = money(totals.net7);
  document.getElementById("tax7").textContent = money(totals.tax7);
  document.getElementById("total").textContent = money(totals.total);
}

function loadTableFromInput() {
  const table = document.getElementById("activeTable").value.trim();

  if (!table) {
    alert("Bitte Tisch eingeben, z. B. Tisch 5.");
    return;
  }

  loadTable(table);
}

function loadTable(table) {
  if (cart.length > 0 && currentTable !== table) {
    autoSaveTable();
  }

  currentTable = table;
  document.getElementById("activeTable").value = table;
  cart = openTablesData[table] ? structuredClone(openTablesData[table].items) : [];

  receiptBox.style.display = "none";
  renderAll();
}

function saveCurrentTable() {
  const tableInput = document.getElementById("activeTable").value.trim();

  if (tableInput) {
    currentTable = tableInput;
  }

  if (currentTable === "-") {
    alert("Bitte zuerst Tisch eingeben.");
    return;
  }

  if (cart.length === 0) {
    alert("Der Tisch ist leer.");
    return;
  }

  openTablesData[currentTable] = {
    table: currentTable,
    items: structuredClone(cart),
    savedAt: new Date().toISOString()
  };

  save("openTables", openTablesData);
  renderOpenTables();

  alert("Tisch wurde gespeichert.");
}

function autoSaveTable() {
  if (currentTable === "-" || cart.length === 0) return;

  openTablesData[currentTable] = {
    table: currentTable,
    items: structuredClone(cart),
    savedAt: new Date().toISOString()
  };

  save("openTables", openTablesData);
  renderOpenTables();
}

function renderOpenTables() {
  const box = document.getElementById("openTables");
  const tableNames = Object.keys(openTablesData);

  if (tableNames.length === 0) {
    box.innerHTML = "<small>Keine offenen Tische.</small>";
    return;
  }

  box.innerHTML = "";

  tableNames.forEach(table => {
    const button = document.createElement("button");
    button.className = "open-table-btn";
    button.textContent = table;
    button.addEventListener("click", () => loadTable(table));
    box.appendChild(button);
  });
}

async function checkout() {
  if (cart.length === 0) {
    alert("Der Warenkorb ist leer.");
    return;
  }

  if (currentTable === "-") {
    const tableInput = document.getElementById("activeTable").value.trim();
    currentTable = tableInput || "-";
  }

  const order = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    tableNumber: currentTable,
    paymentMethod: document.getElementById("paymentMethod").value,
    items: structuredClone(cart),
    totals: calculateTotals()
  };

  const tseStart = await startTseTransaction(order);
  const tseFinish = await finishTseTransaction(order, tseStart);

  const sale = {
    ...order,
    tse: {
      ...tseStart,
      ...tseFinish
    }
  };

  sales.push(sale);
  save("sales", sales);

  delete openTablesData[currentTable];
  save("openTables", openTablesData);

  showReceipt(sale);

  cart = [];
  currentTable = "-";
  document.getElementById("activeTable").value = "";

  renderAll();
}

async function startTseTransaction(order) {
  /*
    HIER kommt später die echte Swissbit-TSE-Anbindung.

    GitHub Pages allein kann nicht direkt mit Swissbit USB/SD/microSD sprechen.
    Dafür brauchen wir später:
    - lokales Backend
    - Middleware
    - oder eine passende Swissbit/Fiskal-Lösung

    Beispiel später:
    fetch("http://localhost:3000/api/tse/start", ...)
  */

  return {
    tseStatus: "DEMO_NICHT_ECHT",
    transactionNumber: "DEMO-" + Date.now(),
    signatureCounter: Math.floor(Math.random() * 1000000),
    signature: "DEMO-SIGNATUR-KEINE-ECHTE-TSE",
    tseSerialNumber: "DEMO-SWISSBIT-PLATZHALTER",
    startedAt: new Date().toISOString()
  };
}

async function finishTseTransaction(order, tseStart) {
  return {
    finishedAt: new Date().toISOString()
  };
}

function showReceipt(sale) {
  const lines = [];

  lines.push("GASTRO KASSE");
  lines.push("Musterstraße 1");
  lines.push("69100 Heidelberg");
  lines.push("--------------------------------");
  lines.push("Bon-ID: " + sale.id);
  lines.push("Datum: " + new Date(sale.createdAt).toLocaleString("de-DE"));
  lines.push("Tisch: " + sale.tableNumber);
  lines.push("Zahlart: " + sale.paymentMethod);
  lines.push("--------------------------------");

  sale.items.forEach(item => {
    lines.push(`${item.quantity} x ${item.name}`);
    lines.push(`   ${money(item.price * item.quantity)} inkl. ${item.tax}% MwSt`);
  });

  lines.push("--------------------------------");
  lines.push("Netto 19%: " + money(sale.totals.net19));
  lines.push("MwSt 19%:  " + money(sale.totals.tax19));
  lines.push("Netto 7%:  " + money(sale.totals.net7));
  lines.push("MwSt 7%:   " + money(sale.totals.tax7));
  lines.push("GESAMT:    " + money(sale.totals.total));
  lines.push("--------------------------------");
  lines.push("TSE Status: " + sale.tse.tseStatus);
  lines.push("TSE Transaktion: " + sale.tse.transactionNumber);
  lines.push("Signaturzähler: " + sale.tse.signatureCounter);
  lines.push("TSE Seriennummer: " + sale.tse.tseSerialNumber);
  lines.push("Signatur: " + sale.tse.signature);
  lines.push("--------------------------------");
  lines.push("Danke für Ihren Besuch!");

  lastReceiptText = lines.join("\n");
  receiptBox.textContent = lastReceiptText;
  receiptBox.style.display = "block";
}

function printReceipt() {
  if (!lastReceiptText && receiptBox.textContent.trim() === "") {
    alert("Es gibt noch keinen Bon zum Drucken.");
    return;
  }

  window.print();
}

function showAdmin() {
  renderAdminProductList();
  document.getElementById("adminModal").classList.remove("hidden");
}

function closeAdmin() {
  document.getElementById("adminModal").classList.add("hidden");
}

function saveProductFromAdmin() {
  const editId = document.getElementById("editProductId").value;
  const name = document.getElementById("newProductName").value.trim();
  const price = Number(document.getElementById("newProductPrice").value);
  const category = document.getElementById("newProductCategory").value.trim();
  const tax = Number(document.getElementById("newProductTax").value);

  if (!name || !price || !category) {
    alert("Bitte Produktname, Preis und Kategorie eingeben.");
    return;
  }

  if (editId) {
    const product = products.find(item => String(item.id) === String(editId));

    if (product) {
      product.name = name;
      product.price = price;
      product.category = category;
      product.tax = tax;
    }
  } else {
    products.push({
      id: Date.now(),
      name,
      price,
      category,
      tax
    });
  }

  save("products", products);
  clearProductForm();
  renderAll();
  renderAdminProductList();
}

function editProduct(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;

  document.getElementById("editProductId").value = product.id;
  document.getElementById("newProductName").value = product.name;
  document.getElementById("newProductPrice").value = product.price;
  document.getElementById("newProductCategory").value = product.category;
  document.getElementById("newProductTax").value = product.tax;
}

function deleteProduct(productId) {
  const product = products.find(item => item.id === productId);
  if (!product) return;

  const ok = confirm(`Produkt löschen: ${product.name}?`);
  if (!ok) return;

  products = products.filter(item => item.id !== productId);
  save("products", products);

  renderAll();
  renderAdminProductList();
}

function clearProductForm() {
  document.getElementById("editProductId").value = "";
  document.getElementById("newProductName").value = "";
  document.getElementById("newProductPrice").value = "";
  document.getElementById("newProductCategory").value = "";
  document.getElementById("newProductTax").value = "19";
}

function renderAdminProductList() {
  const list = document.getElementById("adminProductList");
  list.innerHTML = "";

  products.forEach(product => {
    const row = document.createElement("div");
    row.className = "admin-product-row";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(product.name)}</strong><br>
        <small>${money(product.price)} · ${escapeHtml(product.category)} · ${product.tax}% MwSt</small>
      </div>
      <button class="edit-btn">Bearbeiten</button>
      <button class="delete-btn">Löschen</button>
    `;

    row.querySelector(".edit-btn").addEventListener("click", () => editProduct(product.id));
    row.querySelector(".delete-btn").addEventListener("click", () => deleteProduct(product.id));

    list.appendChild(row);
  });
}

function exportSales() {
  downloadJson("umsatz-export.json", sales);
}

function exportTables() {
  downloadJson("offene-tische.json", openTablesData);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function resetData() {
  const ok = confirm("Wirklich alle Produkte, Tische und Umsätze löschen?");
  if (!ok) return;

  localStorage.removeItem("products");
  localStorage.removeItem("sales");
  localStorage.removeItem("openTables");

  products = structuredClone(DEFAULT_PRODUCTS);
  sales = [];
  openTablesData = {};
  cart = [];
  currentTable = "-";
  activeCategory = "Alle";

  clearProductForm();
  renderAll();
  closeAdmin();
}

function renderAll() {
  renderCategories();
  renderProducts();
  renderOpenTables();
  renderCart();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderAll();
