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

let products = load("products", DEFAULT_PRODUCTS);
let sales = load("sales", []);
let cart = [];
let activeCategory = "Alle";

const categoryTabs = document.getElementById("categoryTabs");
const productGrid = document.getElementById("productGrid");
const cartItems = document.getElementById("cartItems");
const receiptBox = document.getElementById("receiptBox");

document.getElementById("checkoutBtn").addEventListener("click", checkout);
document.getElementById("clearCartBtn").addEventListener("click", clearCart);
document.getElementById("showAdminBtn").addEventListener("click", showAdmin);
document.getElementById("closeAdminBtn").addEventListener("click", closeAdmin);
document.getElementById("addProductBtn").addEventListener("click", addProduct);
document.getElementById("exportSalesBtn").addEventListener("click", exportSales);
document.getElementById("resetDataBtn").addEventListener("click", resetData);

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
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
      <small>${product.category} · ${product.tax}% MwSt</small>
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

  renderCart();
}

function changeQuantity(productId, change) {
  const item = cart.find(product => product.id === productId);
  if (!item) return;

  item.quantity += change;

  if (item.quantity <= 0) {
    cart = cart.filter(product => product.id !== productId);
  }

  renderCart();
}

function clearCart() {
  cart = [];
  receiptBox.style.display = "none";
  renderCart();
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

async function checkout() {
  if (cart.length === 0) {
    alert("Der Warenkorb ist leer.");
    return;
  }

  const order = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    tableNumber: document.getElementById("tableNumber").value.trim() || "-",
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

  showReceipt(sale);

  cart = [];
  renderCart();
}

async function startTseTransaction(order) {
  /*
    HIER kommt später die echte Swissbit-TSE-Anbindung.

    Der Browser kann normalerweise NICHT direkt mit USB/SD/microSD TSE sprechen.
    Darum brauchen wir später wahrscheinlich ein Backend oder eine Middleware.

    Spätere Idee:
    fetch("http://localhost:3000/api/tse/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order)
    })
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
  /*
    Später wird hier die echte Transaktion beendet.
    Die echte TSE gibt dann echte Signaturdaten zurück.
  */

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

  receiptBox.textContent = lines.join("\n");
  receiptBox.style.display = "block";
}

function showAdmin() {
  document.getElementById("adminModal").classList.remove("hidden");
}

function closeAdmin() {
  document.getElementById("adminModal").classList.add("hidden");
}

function addProduct() {
  const name = document.getElementById("newProductName").value.trim();
  const price = Number(document.getElementById("newProductPrice").value);
  const category = document.getElementById("newProductCategory").value.trim();
  const tax = Number(document.getElementById("newProductTax").value);

  if (!name || !price || !category) {
    alert("Bitte Produktname, Preis und Kategorie eingeben.");
    return;
  }

  products.push({
    id: Date.now(),
    name,
    price,
    category,
    tax
  });

  save("products", products);

  document.getElementById("newProductName").value = "";
  document.getElementById("newProductPrice").value = "";
  document.getElementById("newProductCategory").value = "";
  document.getElementById("newProductTax").value = "19";

  activeCategory = category;
  render();
}

function exportSales() {
  const blob = new Blob([JSON.stringify(sales, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "umsatz-export.json";
  link.click();

  URL.revokeObjectURL(url);
}

function resetData() {
  const ok = confirm("Wirklich alle Produkte und Umsätze löschen?");
  if (!ok) return;

  localStorage.removeItem("products");
  localStorage.removeItem("sales");

  products = structuredClone(DEFAULT_PRODUCTS);
  sales = [];
  cart = [];
  activeCategory = "Alle";

  render();
  closeAdmin();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderCategories();
renderProducts();
renderCart();
