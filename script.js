const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxNgLYErXEeFx4dqw_aZZh6TkBN8ucG6BFExjrp0Du0tK9Jl-O_DB_GTqkjwFCvYjqF/exec";

const state = {
  items: [],
  isOwner: false,
  filterType: "all",
  searchTerm: "",
  openRowIdx: null,
};

const els = {
  heroCard: document.getElementById("heroCard"),
  allocCard: document.getElementById("allocCard"),
  allocChart: document.getElementById("allocChart"),
  allocLegend: document.getElementById("allocLegend"),
  filterTabs: document.getElementById("filterTabs"),
  searchInput: document.getElementById("searchInput"),
  statusMessage: document.getElementById("statusMessage"),
  listCount: document.getElementById("listCount"),
  assetList: document.getElementById("assetList"),
  emptyState: document.getElementById("emptyState"),
  ownerToggleBtn: document.getElementById("ownerToggleBtn"),
  ownerToggleLabel: document.getElementById("ownerToggleLabel"),
  modalOverlay: document.getElementById("modalOverlay"),
  modalClose: document.getElementById("modalClose"),
  loginForm: document.getElementById("loginForm"),
  ownerKeyInput: document.getElementById("ownerKeyInput"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),
  modalError: document.getElementById("modalError"),
};

const TYPE_ORDER = ["หุ้น", "ทอง", "คริปโต", "อื่นๆ"];
const TYPE_COLOR = { "หุ้น": "#2363A3", "ทอง": "#F0B94C", "คริปโต": "#37D6C4", "อื่นๆ": "#F472B6" };
const CURRENCY_LOCALE = { USD: "en-US", THB: "th-TH", EUR: "en-IE", GBP: "en-GB", JPY: "ja-JP" };
const CURRENCY_FLAG = { USD: "🇺🇸", THB: "🇹🇭", EUR: "🇪🇺", GBP: "🇬🇧", JPY: "🇯🇵" };

/* =========================================================
   FORMATTING HELPERS
   ========================================================= */
function formatMoney(n, currency, opts) {
  if (n === undefined || n === null || n === "") return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  const cur = (currency || "THB").toUpperCase();
  const locale = CURRENCY_LOCALE[cur] || "en-US";
  const plain = num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const showCode = !(opts && opts.noCode === true);
  return showCode ? `${plain} ${cur}` : plain;
}
function formatNumber(n) {
  if (n === undefined || n === null || n === "") return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString("th-TH", { maximumFractionDigits: 4 });
}
// แยกตัวเลขใหญ่เป็นส่วนจำนวนเต็ม/ทศนิยม เพื่อจัดขนาดตัวอักษรต่างกันแบบตัวเลขยอดรวมในการ์ด hero
function splitBigNumber(n) {
  const num = Number(n) || 0;
  const parts = Math.abs(num).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(".");
  return { sign: num < 0 ? "-" : "", int: parts[0], dec: "." + parts[1] };
}
function getTHB(it, field) {
  const raw = field === "cost" ? it.totalCostTHB : it.currentValueTHB;
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? null : num;
}
function thaiTimestamp() {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const now = new Date();
  const beYear = (now.getFullYear() + 543) % 100;
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${now.getDate()} ${months[now.getMonth()]} ${beYear} - ${hh}:${mm} น.`;
}
function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
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
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ key: ownerKey || "" }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
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
  els.assetList.innerHTML = "";
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
  els.ownerKeyInput.value = "";
  setTimeout(() => els.ownerKeyInput.focus(), 50);
}
function closeModal() {
  els.modalOverlay.hidden = true;
}

els.ownerToggleBtn.addEventListener("click", () => {
  if (state.isOwner) {
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
    state.items = data.items || [];
    state.isOwner = true;
    applyOwnerUI();
    renderAll();
    closeModal();
  } else if (data) {
    els.modalError.hidden = false;
  }
});

/* =========================================================
   FILTER / SEARCH
   ========================================================= */
els.filterTabs.addEventListener("click", (e) => {
  const btn = e.target.closest(".pill-tab");
  if (!btn) return;
  document.querySelectorAll(".pill-tab").forEach((t) => {
    t.classList.remove("is-active");
    t.setAttribute("aria-selected", "false");
  });
  btn.classList.add("is-active");
  btn.setAttribute("aria-selected", "true");
  state.filterType = btn.dataset.type;
  state.openRowIdx = null;
  renderList();
});

els.searchInput.addEventListener("input", (e) => {
  state.searchTerm = e.target.value.trim().toLowerCase();
  state.openRowIdx = null;
  renderList();
});

function getFilteredItems() {
  return state.items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => {
      const matchesType = state.filterType === "all" || it.type === state.filterType;
      const matchesSearch = !state.searchTerm || (it.name || "").toLowerCase().includes(state.searchTerm);
      return matchesType && matchesSearch;
    });
}

/* =========================================================
   PORTFOLIO TOTALS (native currency when uniform, THB when mixed)
   ========================================================= */
function computeTotals() {
  const currencies = new Set(state.items.map((it) => (it.currency || "THB").toUpperCase()));
  if (currencies.size <= 1) {
    const cur = currencies.size === 1 ? [...currencies][0] : "THB";
    let cost = 0, value = 0;
    state.items.forEach((it) => {
      const c = Number(it.totalCost) || 0;
      const v = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : c;
      cost += c;
      value += v;
    });
    // ถ้าเป็นสกุลเงินต่างประเทศและมีค่าแปลง THB ครบทุกรายการ ใช้คำนวณอัตราแลกเปลี่ยนเฉลี่ยแสดงเสริมได้
    let thbCost = null;
    if (cur !== "THB" && state.items.every((it) => getTHB(it, "cost") !== null)) {
      thbCost = state.items.reduce((s, it) => s + (getTHB(it, "cost") || 0), 0);
    }
    return { mode: "native", cur, cost, value, thbCost, rate: thbCost !== null && cost > 0 ? thbCost / cost : null };
  }

  const allConverted = state.items.every((it) => getTHB(it, "cost") !== null);
  if (allConverted) {
    let cost = 0, value = 0;
    state.items.forEach((it) => {
      const c = getTHB(it, "cost") || 0;
      const v = getTHB(it, "value") !== null ? getTHB(it, "value") : c;
      cost += c;
      value += v;
    });
    return { mode: "converted", cur: "THB", cost, value, thbCost: null, rate: null };
  }

  // หลายสกุลเงินและยังแปลงไม่ครบ — ถอยไปแสดงแยกตามสกุลเงิน
  const byCurrency = {};
  state.items.forEach((it) => {
    const cur = (it.currency || "THB").toUpperCase();
    if (!byCurrency[cur]) byCurrency[cur] = { cost: 0, value: 0 };
    const c = Number(it.totalCost) || 0;
    const v = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : c;
    byCurrency[cur].cost += c;
    byCurrency[cur].value += v;
  });
  return { mode: "grouped", byCurrency };
}

/* =========================================================
   RENDER: HERO CARD
   ========================================================= */
function renderHero() {
  const counts = {};
  TYPE_ORDER.forEach((t) => (counts[t] = 0));
  state.items.forEach((it) => { if (counts[it.type] !== undefined) counts[it.type]++; });

  if (!state.isOwner) {
    els.heroCard.innerHTML = `
      <p class="hero-label">พอร์ตการลงทุน</p>
      <div class="hero-locked">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="10" rx="1.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
        <span>ข้อมูลมูลค่าเป็นส่วนตัว — เข้าสู่ระบบเจ้าของเพื่อดูจำนวนเงิน</span>
      </div>
      <div class="hero-counts">
        ${TYPE_ORDER.map((t) => `<div class="hero-count"><span class="hero-count__n">${counts[t]}</span><span class="hero-count__label">${t}</span></div>`).join("")}
      </div>`;
    return;
  }

  if (state.items.length === 0) {
    els.heroCard.innerHTML = `<p class="hero-label">พอร์ตการลงทุน</p><p style="color:rgba(255,255,255,.75);font-size:14px;margin:0;">ยังไม่มีรายการ — เพิ่มข้อมูลใน Google Sheet ได้เลย</p>`;
    return;
  }

  const totals = computeTotals();

  if (totals.mode === "grouped") {
    const currencies = Object.keys(totals.byCurrency).sort((a, b) => (a === "USD" ? -1 : b === "USD" ? 1 : a.localeCompare(b)));
    let rowsHtml = "";
    currencies.forEach((cur) => {
      const { cost, value } = totals.byCurrency[cur];
      const pl = value - cost;
      const plPct = cost > 0 ? (pl / cost) * 100 : 0;
      const plClass = pl > 0 ? "is-gain" : pl < 0 ? "is-loss" : "";
      const arrow = pl >= 0 ? "↗" : "↘";
      const big = splitBigNumber(value);
      rowsHtml += `
        <div style="margin-bottom:14px;">
          <div class="hero-sub">${CURRENCY_FLAG[cur] || ""} ${cur}</div>
          <div class="hero-number">
            <span class="hero-number__int">${big.sign}${big.int}</span><span class="hero-number__dec">${big.dec}</span><span class="hero-number__cur">${cur}</span>
          </div>
          <div class="hero-stat-row"><span class="hero-stat-label">ต้นทุน ${formatMoney(cost, cur)}</span><span class="hero-stat-value ${plClass}">${arrow} ${Math.abs(plPct).toFixed(1)}% (${pl >= 0 ? "+" : ""}${formatMoney(pl, cur)})</span></div>
        </div>`;
    });
    els.heroCard.innerHTML = `<p class="hero-label">มูลค่าสินทรัพย์ทั้งหมด</p>${rowsHtml}`;
    return;
  }

  const { cur, cost, value, thbCost, rate } = totals;
  const pl = value - cost;
  const plPct = cost > 0 ? (pl / cost) * 100 : 0;
  const plClass = pl >= 0 ? "is-gain" : "is-loss";
  const arrow = pl >= 0 ? "↗" : "↘";
  const big = splitBigNumber(value);
  const modeLabel = totals.mode === "converted" ? " (แปลงเป็น THB)" : "";

  let subHtml = "";
  if (cur !== "THB" && rate !== null) {
    const valueTHB = value * rate;
    subHtml = `
      <p class="hero-sub">≈ ${formatMoney(valueTHB, "THB")}<span class="hero-fx">${CURRENCY_FLAG[cur] || ""} 1 ${cur} = ${rate.toFixed(2)} THB</span></p>`;
  }

  els.heroCard.innerHTML = `
    <p class="hero-label">มูลค่าสินทรัพย์ทั้งหมด${modeLabel} · ${thaiTimestamp()}</p>
    <div class="hero-number">
      <span class="hero-number__int">${big.sign}${big.int}</span><span class="hero-number__dec">${big.dec}</span><span class="hero-number__cur">${cur}</span>
    </div>
    ${subHtml}
    <p class="hero-cost">ต้นทุนรวม: ${formatMoney(cost, cur)}</p>
    <hr class="hero-divider">
    <div class="hero-stat-row">
      <span class="hero-stat-label">กำไร/ขาดทุนของสินทรัพย์ที่ถืออยู่</span>
      <span class="hero-stat-value ${plClass}">${arrow} ${Math.abs(plPct).toFixed(2)}% (${pl >= 0 ? "+" : ""}${formatMoney(pl, cur)})</span>
    </div>`;
}

/* =========================================================
   RENDER: ALLOCATION CARD (percentage-based, like the reference)
   ========================================================= */
function renderAllocation() {
  if (state.items.length === 0) {
    els.allocCard.hidden = true;
    return;
  }
  els.allocCard.hidden = false;

  const totals = state.isOwner ? computeTotals() : null;
  const useValue = totals && totals.mode !== "grouped";

  const segTotals = {};
  TYPE_ORDER.forEach((t) => (segTotals[t] = 0));

  if (useValue) {
    state.items.forEach((it) => {
      if (segTotals[it.type] === undefined) return;
      let v;
      if (totals.mode === "converted") {
        v = getTHB(it, "value") !== null ? getTHB(it, "value") : getTHB(it, "cost") || 0;
      } else {
        v = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : Number(it.totalCost) || 0;
      }
      segTotals[it.type] += v;
    });
  } else {
    state.items.forEach((it) => { if (segTotals[it.type] !== undefined) segTotals[it.type] += 1; });
  }

  const segments = TYPE_ORDER.map((t) => ({ type: t, value: segTotals[t] })).filter((s) => s.value > 0);
  const grandTotal = segments.reduce((s, x) => s + x.value, 0);
  drawDonut(els.allocChart, segments);

  els.allocLegend.innerHTML = segments
    .map((s) => {
      const pct = grandTotal > 0 ? (s.value / grandTotal) * 100 : 0;
      return `<li><span class="dot dot--${s.type}"></span><span class="legend-pct">${pct.toFixed(2)}%</span><span class="legend-label">${s.type}</span></li>`;
    })
    .join("");
}

function drawDonut(canvas, segments) {
  const ctx = canvas.getContext("2d");
  const size = canvas.width;
  const cx = size / 2, cy = size / 2;
  const outerR = size / 2 - 6;
  const innerR = outerR * 0.6;
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
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

/* =========================================================
   RENDER: ASSET LIST (row style, tap to expand detail)
   ========================================================= */
function renderList() {
  const filtered = getFilteredItems();
  els.listCount.textContent = `${filtered.length} สินทรัพย์`;
  els.emptyState.hidden = filtered.length !== 0;

  els.assetList.innerHTML = filtered
    .map(({ it, idx }) => {
      const isOpen = state.openRowIdx === idx;
      let figuresHtml = "";
      let chevronHtml = "";
      let detailHtml = "";

      if (state.isOwner) {
        const cur = it.currency || "THB";
        const cost = it.totalCost !== undefined && it.totalCost !== "" ? Number(it.totalCost) : null;
        const val = it.currentValue !== undefined && it.currentValue !== "" ? Number(it.currentValue) : null;
        const pl = cost !== null && val !== null ? val - cost : null;
        const plPct = pl !== null && cost > 0 ? (pl / cost) * 100 : null;
        const plClass = pl === null ? "" : pl >= 0 ? "is-gain" : "is-loss";
        const arrow = pl !== null && pl < 0 ? "↘" : "↗";
        const valTHB = getTHB(it, "value") !== null ? getTHB(it, "value") : getTHB(it, "cost");
        const showHint = cur.toUpperCase() !== "THB" && valTHB !== null;

        figuresHtml = `
          <div class="asset-row__figures">
            <div class="asset-row__value">${val !== null ? formatMoney(val, cur) : formatMoney(cost, cur)}</div>
            ${showHint ? `<div class="asset-row__hint">≈ ${formatMoney(valTHB, "THB")}</div>` : ""}
            ${plPct !== null ? `<div class="asset-row__change ${plClass}">${arrow} ${Math.abs(plPct).toFixed(2)}% (${pl >= 0 ? "+" : ""}${formatMoney(pl, cur)})</div>` : ""}
          </div>`;
        chevronHtml = `<svg class="asset-row__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>`;

        detailHtml = `
          <div class="asset-row__detail" ${isOpen ? "" : "hidden"}>
            <div class="detail-item"><div class="detail-item__label">จำนวนหุ้นคงเหลือ</div><div class="detail-item__value">${formatNumber(it.quantity)}</div></div>
            <div class="detail-item"><div class="detail-item__label">ราคาต่อหน่วย</div><div class="detail-item__value">${formatMoney(it.unitCost, cur)}</div></div>
            <div class="detail-item"><div class="detail-item__label">ต้นทุนรวม</div><div class="detail-item__value">${formatMoney(cost, cur)}</div></div>
            <div class="detail-item"><div class="detail-item__label">แหล่งที่ซื้อ</div><div class="detail-item__value">${escapeHtml(it.source) || "-"}</div></div>
            <div class="detail-item"><div class="detail-item__label">วันที่ซื้อ</div><div class="detail-item__value">${escapeHtml(it.date) || "-"}</div></div>
            ${it.notes ? `<div class="detail-item detail-item--full"><div class="detail-item__label">หมายเหตุ</div><div class="detail-item__value">${escapeHtml(it.notes)}</div></div>` : ""}
          </div>`;
      }

      return `
        <div class="asset-row ${isOpen ? "is-open" : ""}" data-idx="${idx}">
          <div class="asset-row__main" data-idx="${idx}">
            <div class="asset-avatar" data-type="${it.type}">${initials(it.name)}</div>
            <div class="asset-row__id">
              <div class="asset-row__name">${escapeHtml(it.name)}</div>
              <div class="asset-row__category">${escapeHtml(it.category || "")}</div>
            </div>
            ${figuresHtml}
            ${state.isOwner ? chevronHtml : ""}
          </div>
          ${detailHtml}
        </div>`;
    })
    .join("");
}

els.assetList.addEventListener("click", (e) => {
  if (!state.isOwner) return;
  const row = e.target.closest(".asset-row__main");
  if (!row) return;
  const idx = Number(row.dataset.idx);
  state.openRowIdx = state.openRowIdx === idx ? null : idx;
  renderList();
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

/* =========================================================
   MASTER RENDER
   ========================================================= */
function renderAll() {
  renderHero();
  renderAllocation();
  renderList();
}

/* =========================================================
   INIT
   ========================================================= */
(function init() {
  const savedKey = sessionStorage.getItem("ownerKey");
  loadData(savedKey || null);
})();