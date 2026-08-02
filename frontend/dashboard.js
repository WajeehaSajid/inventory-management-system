let trendChart = null;
let categoryChart = null;
let currentTrendDays = 7;

function themeColor(varName) {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// Animates a number counting up from 0 to its target — small touch that
// makes the dashboard feel alive on load instead of just appearing.
function animateNumber(el, target, { prefix = '', decimals = 0 } = {}) {
  const duration = 700;
  const start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = target * eased;
    el.textContent = prefix + value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function loadSummary() {
  try {
    const res = await api.get('/dashboard/summary');
    const d = res.data;
    animateNumber(document.getElementById('stat-total-products'), d.products.total);
    animateNumber(document.getElementById('stat-out-of-stock'), d.products.out_of_stock);
    animateNumber(document.getElementById('stat-low-stock'), d.products.low_stock);
    animateNumber(document.getElementById('stat-inventory-value'), d.inventory_value, { prefix: 'Rs ', decimals: 0 });
  } catch (err) {
    showToast(`Couldn't load summary: ${err.message}`);
  }
}

async function loadTrendChart(days) {
  currentTrendDays = days;
  try {
    const res = await api.get(`/dashboard/stock-trend?days=${days}`);
    const labels = res.data.map((row) => {
      const d = new Date(row.date);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    });
    const stockIn = res.data.map((row) => row.stock_in);
    const stockOut = res.data.map((row) => row.stock_out);

    if (trendChart) trendChart.destroy();
    const ctx = document.getElementById('trend-chart').getContext('2d');
    trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Stock IN',
            data: stockIn,
            borderColor: themeColor('--success'),
            backgroundColor: themeColor('--success-soft'),
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          },
          {
            label: 'Stock OUT',
            data: stockOut,
            borderColor: themeColor('--danger'),
            backgroundColor: themeColor('--danger-soft'),
            tension: 0.35,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: {
          legend: { position: 'bottom', labels: { color: themeColor('--text-muted'), usePointStyle: true, boxWidth: 8 } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: themeColor('--text-muted') } },
          y: { beginAtZero: true, grid: { color: themeColor('--border') }, ticks: { color: themeColor('--text-muted') } },
        },
      },
    });
  } catch (err) {
    showToast(`Couldn't load trend chart: ${err.message}`);
  }
}

async function loadCategoryChart() {
  try {
    const res = await api.get('/dashboard/category-breakdown');
    const labels = res.data.map((row) => row.name);
    const counts = res.data.map((row) => row.count);
    const palette = [
      themeColor('--primary'),
      '#6366F1', // indigo
      themeColor('--warning'),
      themeColor('--success'),
      themeColor('--danger'),
      '#EC4899', // extra: pink (only used past 5 categories)
      '#8B5CF6', // extra: violet
    ];

    if (categoryChart) categoryChart.destroy();
    const ctx = document.getElementById('category-chart').getContext('2d');
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{ data: counts, backgroundColor: palette, borderWidth: 0 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        animation: { duration: 700, animateRotate: true },
        plugins: {
          legend: { position: 'bottom', labels: { color: themeColor('--text-muted'), usePointStyle: true, boxWidth: 8 } },
        },
      },
    });
  } catch (err) {
    showToast(`Couldn't load category chart: ${err.message}`);
  }
}

async function loadTopProducts() {
  const container = document.getElementById('top-products-container');
  try {
    const res = await api.get('/dashboard/top-products?limit=5');
    if (res.data.length === 0) {
      container.innerHTML = `<div class="state-block">No products yet.</div>`;
      return;
    }
    const maxValue = Math.max(...res.data.map((p) => p.inventory_value));
    container.innerHTML = `
      <div class="top-products-list">
        ${res.data.map((p) => `
          <div class="top-product-row">
            <div class="top-product-info">
              <div class="top-product-name">${escapeHtml(p.name)}</div>
              <div class="sku-tag">${escapeHtml(p.sku)}</div>
            </div>
            <div class="top-product-bar-wrap">
              <div class="top-product-bar" style="width:${(p.inventory_value / maxValue * 100).toFixed(1)}%"></div>
            </div>
            <div class="top-product-value">Rs ${Number(p.inventory_value).toLocaleString()}</div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="state-block error">${escapeHtml(err.message)}</div>`;
  }
}

function initTrendTabs() {
  document.querySelectorAll('.dash-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      loadTrendChart(parseInt(tab.dataset.days));
    });
  });
}

// Redraw charts with the new theme's colors when the user toggles dark mode.
document.addEventListener('themechange', () => {
  loadTrendChart(currentTrendDays);
  loadCategoryChart();
});

function init() {
  initTrendTabs();
  loadSummary();
  loadTrendChart(7);
  loadCategoryChart();
  loadTopProducts();
}

init();
