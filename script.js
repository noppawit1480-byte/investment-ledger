/* =========================================================
   CONFIG
   ⚠️ วางลิงก์ Google Apps Script Web App ของคุณตรงนี้
   (ดูวิธีสร้างใน README.md)
   ========================================================= */
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNgLYErXEeFx4dqw_aZZh6TkBN8ucG6BFExjrp0Du0tK9Jl-O_DB_GTqkjwFCvYjqF/exec";

const state = {
  items: [],
  isOwner: false,
  filterType: "all",
  searchTerm: "",
};

const els = {
  summaryStrip: document.getElementById("summaryStrip"),
  filterTabs: document.getElementById("filterTabs"),
  searchInput: document.getElementById("searchInput"),
  statusMessage: document.getElementById("statusMessage"),
  assetGrid: document.getElementById("assetGrid"),
  emptyState: document.getElementById("emptyState"),
  allocationSection: document.getElementById("allocationSection"),
  allocationNote: document.getElementById("allocationNote"),
  allocationChart: document.getElementById("allocationChart"),
  allocationLegend: document.getElementById("allocationLegend"),
  ownerToggleBtn: document.getElementById("ownerToggleBtn"),
  ownerToggleLabel: document.getElementById("ownerToggleLabel"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalClose: document.getElementById("modalClose"),
  loginForm: document.getElementById("loginForm"),
  ownerKeyInput: document.getElementById("ownerKeyInput"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  modalError: document.getElementById("modalError"),
  unlockStamp: document.getElementById("unlockStamp"),
};

const TYPE_ORDER = ["หุ้น", "ทอง", "คริปโต", "อื่นๆ"];
const TYPE_DOT_CLASS = { "หุ้น": "dot--stock", "ทอง": "dot--gold", "คริปโต": "dot--crypto", "อื่นๆ": "dot--other" };
const TYPE_COLOR = { "หุ้น": "#5B8DEF", "ทอง": "#C9A227", "คริปโต": "#2DD4BF", "อื่นๆ": "#B98BDB" };

/* =========================================================
   FORMATTING HELPERS
   ========================================================= */
const CURRENCY_SYMBOL = { USD: "$", THB: "฿", EUR: "€", GBP: "£", JPY: "¥" };
const CURRENCY_LOCALE = { USD: "en-US", THB: "th-TH", EUR: "en-IE", GBP: "en-GB", JPY: "ja-JP" };

// รองรับหลายสกุลเงิน — ค่าเริ่มต้นเป็น THB ถ้าไม่ได้ระบุ (เผื่อรายการเก่าที่ยังไม่มีคอลัมน์สกุลเงิน)
function formatMoney(n, currency) {
  if (n === undefined || n === null || n === "") return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  const cur = (currency || "THB").toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur] || cur + " ";
  const locale = CURRENCY_LOCALE[cur] || "en-US";
  return symbol + num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatNumber(n) {
  if (n === undefined || n === null || n === "") return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("th-TH", { maximumFractionDigits: 4 });
}

/* =========================================================
   DATA FETCH
   ========================================================= */
async function fetchData(ownerKey) {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes("PASTE_YOUR")) {
    showStatus("ยังไม่ได้ตั้งค่า Apps Script URL — แก้ไข APPS_SCRIPT_URL ใน script.js (ดูขั้นตอนใน README.md)", true);
    return null;
  }
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      // text/plain avoids a CORS preflight so Apps Script Web Apps work without extra config
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: ownerKey || "" }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
    showStatus("โหลดข้อมูลไม่สำเร็จ ตรวจสอบการเชื่อมต่อ Google Sheets", true);
    return null;
  }
}

function showStatus(msg, isError) {
  els.statusMessage.textContent = msg;
  els.statusMessage.hidden = false;
  els.statusMessage.classList.toggle("is-error", !!isError);
}
function clearStatus() {
  els.statusMessage.hidden = true;
}

async function loadData(ownerKey) {
  clearStatus();
  els.assetGrid.innerHTML = "";
  showStatus("กำลังโหลดข้อมูล...");
  const data = await fetchData(ownerKey);
  if (!data) return;
  clearStatus();
  state.items = data.items || [];
  state.isOwner = !!data.isOwner;
  applyOwnerUI();
  renderAll();
}

/* =========================================================
   OWNER MODE UI
   ========================================================= */
function applyOwnerUI() {
  document.body.classList.toggle("is-owner", state.isOwner);
  els.ownerToggleLabel.textContent = state.isOwner ? "ออกจากมุมมองเจ้าของ" : "เข้าสู่ระบบเจ้าของ";
}

function openModal() {
  els.modalOverlay.hidden = false;
  els.modalError.hidden = true;
  els.unlockStamp.hidden = true;
  els.ownerKeyInput.value = "";
  setTimeout(() => els.ownerKeyInput.focus(), 50);
}
function closeModal() {
  els.modalOverlay.hidden = true;
}

els.ownerToggleBtn.addEventListener("click", () => {
  if (state.isOwner) {
    // log out — clear session key, reload as public
    sessionStorage.removeItem("ownerKey");
    loadData(null);
  } else {
    openModal();
  }
});
els.modalClose.addEventListener("click", closeModal);
els.modalOverlay.addEventListener("click", (e) => { if (e.target === els.modalOverlay) closeModal(); });

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const key = els.ownerKeyInput.value.trim();
  if (!key) return;
  els.loginSubmitBtn.disabled = true;
  els.loginSubmitBtn.textContent = "กำลังตรวจสอบ...";
  const data = await fetchData(key);
  els.loginSubmitBtn.disabled = false;
  els.loginSubmitBtn.textContent = "ปลดล็อก";

  if (data && data.isOwner) {
    sessionStorage.setItem("ownerKey", key);
    els.modalError.hidden = true;
    els.unlockStamp.hidden = false;
    state.items = data.items || [];
    state.isOwner = true;
    applyOwnerUI();
    renderAll();
    setTimeout(closeModal, 700);
  } else if (data) {
    els.modalError.hidden = false;
  }
});

/* =========================================================
   FILTER / SEARCH
   ========================================================= */
els.filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".filter-tab");
  if (!btn) return;
  document.querySelectorAll(".filter-tab").forEach((t) => {
    t.classList.remove("is-active");
    t.setAttribute("aria-selected", "false");
  });
  btn.classList.add("is-active");
  btn.setAttribute("aria-selected", "true");
  state.filterType = btn.dataset.type;
  renderCards();
});

els.searchInput.addEventListener("input", (e) => {
  state.searchTerm = e.target.value.trim().toLowerCase();
  renderCards();
});

function getFilteredItems() {
  return state.items.filter((it) => {
    const matchesType = state.filterType === "all" || it.type === state.filterType;
    const matchesSearch = !state.searchTerm || (it.name || "").toLowerCase().includes(state.searchTerm);
    return matchesType && matchesSearch;
  });
}

/* =========================================================
   RENDER: SUMMARY STRIP
   ========================================================= */
function renderSummary() {
  const counts = {};
  TYPE_ORDER.forEach((t) => (counts[t] = 0));

  // รวมยอดแยกตามสกุลเงิน เพราะพอร์ตอาจมีทั้งหุ้น USD และทอง/กองทุน THB ปนกัน
  // การรวมข้ามสกุลเงินโดยไม่แปลงอัตราแลกเปลี่ยนจะให้ตัวเลขที่ผิด จึงแยกแสดงทีละสกุลเงิน
  const byCurrency = {}; // { USD: {cost, value}, THB: {cost, value} }

  state.items.forEach((it) => {
    if (counts[it.type] !== undefined) counts[it.type]++;
    if (state.isOwner) {
      const cur = (it.currency || "THB").toUpperCase();
      if (!byCurrency[cur]) byCurrency[cur] = { cost: 0, value: 0 };
      const cost = Number(it.totalCost) || 0;
      const val = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : cost;
      byCurrency[cur].cost += cost;
      byCurrency[cur].value += val;
    }
  });

  let html = "";
  TYPE_ORDER.forEach((t) => {
    html += `
      <div class="summary-item">
        <div class="summary-item__label"><span class="dot ${TYPE_DOT_CLASS[t]}"></span>${t}</div>
        <div class="summary-item__value">${counts[t]}</div>
      </div>`;
  });

  if (state.isOwner) {
    const currencies = Object.keys(byCurrency).sort((a, b) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));
    currencies.forEach((cur) => {
      const cost = byCurrency[cur].cost;
      const value = byCurrency[cur].value;
      const pl = value - cost;
      const plPct = cost > 0 ? (pl / cost) * 100 : 0;
      const plClass = pl > 0 ? "is-gain" : pl < 0 ? "is-loss" : "";
      html += `
        <div class="summary-item">
          <div class="summary-item__label">ลงทุนรวม (${cur})</div>
          <div class="summary-item__value">${formatMoney(cost, cur)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item__label">มูลค่าปัจจุบัน (${cur})</div>
          <div class="summary-item__value">${formatMoney(value, cur)}</div>
        </div>
        <div class="summary-item">
          <div class="summary-item__label">กำไร/ขาดทุน (${cur})</div>
          <div class="summary-item__value ${plClass}">${pl >= 0 ? "+" : ""}${formatMoney(pl, cur)} (${plPct >= 0 ? "+" : ""}${plPct.toFixed(1)}%)</div>
        </div>`;
    });
  }

  els.summaryStrip.innerHTML = html;
}

/* =========================================================
   RENDER: ASSET CARDS
   ========================================================= */
function renderCards() {
  const items = getFilteredItems();
  els.emptyState.hidden = items.length !== 0;
  els.assetGrid.innerHTML = items
    .map((it) => {
      let financialsHtml = "";
      if (state.isOwner) {
        const cur = it.currency || "THB";
        const cost = it.totalCost !== undefined && it.totalCost !== "" ? Number(it.totalCost) : null;
        const val = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : null;
        const pl = cost !== null && val !== null ? val - cost : null;
        const plClass = pl === null ? "" : pl > 0 ? "is-gain" : pl < 0 ? "is-loss" : "";
        financialsHtml = `
          <div class="asset-card__financials">
            <div class="fin-row"><span class="fin-row__label">จำนวน</span><span class="fin-row__value">${formatNumber(it.quantity)}</span></div>
            <div class="fin-row"><span class="fin-row__label">ราคาต่อหน่วย</span><span class="fin-row__value">${formatMoney(it.unitCost, cur)}</span></div>
            <div class="fin-row"><span class="fin-row__label">ต้นทุนรวม</span><span class="fin-row__value">${formatMoney(cost, cur)}</span></div>
            <div class="fin-row"><span class="fin-row__label">มูลค่าปัจจุบัน</span><span class="fin-row__value">${val !== null ? formatMoney(val, cur) : "-"}</span></div>
            ${pl !== null ? `<div class="fin-row"><span class="fin-row__label">กำไร/ขาดทุน</span><span class="fin-row__value ${plClass}">${pl >= 0 ? "+" : ""}${formatMoney(pl, cur)}</span></div>` : ""}
          </div>
          <div class="asset-card__meta">
            <span>${it.source || ""}</span>
            <span>${it.date || ""}</span>
          </div>`;
      }
      return `
        <article class="asset-card" data-type="${it.type}">
          <div class="asset-card__top">
            <span class="asset-card__name">${escapeHtml(it.name)}</span>
            <span class="asset-card__type-badge" data-type="${it.type}">${it.type}</span>
          </div>
          <p class="asset-card__category">${escapeHtml(it.category || "")}</p>
          ${financialsHtml}
        </article>`;
    })
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* =========================================================
   RENDER: ALLOCATION DONUT (hand-drawn canvas, no dependency)
   ========================================================= */
function renderAllocation() {
  if (state.items.length === 0) {
    els.allocationSection.hidden = true;
    return;
  }
  els.allocationSection.hidden = false;

  // ถ้ารายการทั้งหมดเป็นสกุลเงินเดียวกัน ใช้มูลค่ารวมได้ปลอดภัย
  // ถ้ามีหลายสกุลเงินปนกัน (เช่น หุ้น USD + ทอง THB) การรวมมูลค่าข้ามสกุลเงินจะผิด
  // จึงถอยไปแสดงตามจำนวนรายการแทน
  const currenciesUsed = new Set(state.items.map((it) => (it.currency || "THB").toUpperCase()));
  const canUseValue = state.isOwner && currenciesUsed.size <= 1;
  const soleCurrency = currenciesUsed.size === 1 ? [...currenciesUsed][0] : null;

  if (state.isOwner && !canUseValue) {
    els.allocationNote.textContent = "ตามจำนวนรายการ (มีหลายสกุลเงินในพอร์ต)";
  } else if (canUseValue) {
    els.allocationNote.textContent = `ตามมูลค่าปัจจุบัน (${soleCurrency})`;
  } else {
    els.allocationNote.textContent = "ตามจำนวนรายการ";
  }

  const totals = {};
  TYPE_ORDER.forEach((t) => (totals[t] = 0));
  state.items.forEach((it) => {
    if (totals[it.type] === undefined) return;
    if (canUseValue) {
      const val = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : Number(it.totalCost) || 0;
      totals[it.type] += val;
    } else {
      totals[it.type] += 1;
    }
  });

  const segments = TYPE_ORDER.map((t) => ({ type: t, value: totals[t] })).filter((s) => s.value > 0);
  drawDonut(els.allocationChart, segments);

  els.allocationLegend.innerHTML = segments
    .map((s) => {
      const display = canUseValue ? formatMoney(s.value, soleCurrency) : s.value + " รายการ";
      return `<li><span class="dot" style="background:${TYPE_COLOR[s.type]}"></span>${s.type}<span class="legend-value">${display}</span></li>`;
    })
    .join("");
}

function drawDonut(canvas, segments) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.62;
  ctx.clearRect(0, 0, size, size);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return;

  let startAngle = -Math.PI / 2;
  segments.forEach((s) => {
    const sliceAngle = (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = TYPE_COLOR[s.type];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // punch the hole to make it a donut
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

/* =========================================================
   MASTER RENDER
   ========================================================= */
function renderAll() {
  renderSummary();
  renderCards();
  renderAllocation();
}

/* =========================================================
   INIT
   ========================================================= */
(function init() {
  const savedKey = sessionStorage.getItem("ownerKey");
  loadData(savedKey || null);
})();