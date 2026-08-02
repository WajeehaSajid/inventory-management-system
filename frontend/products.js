// State for the current view of the products list.
let state = {
  page: 1,
  pageSize: 10,
  search: '',
  category: '',
  supplier: '',
  status: '',
};

let categoriesCache = [];
let suppliersCache = [];

// -----------------------------------------------------
// Initial load
// -----------------------------------------------------
async function init() {
  await loadFilterOptions();
  await loadProducts();
  loadStats();

  document.getElementById('search-input').addEventListener(
    'input',
    debounce((e) => {
      state.search = e.target.value.trim();
      state.page = 1;
      loadProducts();
    })
  );

  document.getElementById('filter-category').addEventListener('change', (e) => {
    state.category = e.target.value;
    state.page = 1;
    loadProducts();
  });

  document.getElementById('filter-supplier').addEventListener('change', (e) => {
    state.supplier = e.target.value;
    state.page = 1;
    loadProducts();
  });

  document.getElementById('filter-status').addEventListener('change', (e) => {
    state.status = e.target.value;
    state.page = 1;
    loadProducts();
  });

  document.getElementById('btn-add-product').addEventListener('click', () => openProductForm());

  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);

  const importBtn = document.getElementById('btn-import-csv');
  if (isAdmin()) {
    importBtn.addEventListener('click', () => document.getElementById('csv-file-input').click());
    document.getElementById('csv-file-input').addEventListener('change', handleCsvImport);
  } else {
    // Import is admin-only server-side too; hide it for staff rather
    // than let them pick a file and hit a 403.
    importBtn.remove();
  }
}

// -----------------------------------------------------
// CSV export — fetch() so the auth token can be attached; a plain
// <a href> link wouldn't carry the Authorization header.
// -----------------------------------------------------
async function exportCsv() {
  const token = localStorage.getItem('authToken');
  try {
    const res = await fetch(`${API_BASE}/products/export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast('CSV downloaded');
  } catch (err) {
    showToast(`Couldn't export: ${err.message}`);
  }
}

// -----------------------------------------------------
// CSV import — upload the chosen file, then show a summary of what
// was created/updated, and any per-row errors.
// -----------------------------------------------------
async function handleCsvImport(e) {
  const file = e.target.files[0];
  e.target.value = ''; // reset so choosing the same file again still fires "change"
  if (!file) return;

  const token = localStorage.getItem('authToken');
  const formData = new FormData();
  formData.append('file', file);

  showToast('Importing CSV...');
  try {
    const res = await fetch(`${API_BASE}/products/import`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error?.message || 'Import failed');

    const { created, updated, errors, totalRows } = body.data;
    openModal(`
      <div class="modal-header">
        <h2>Import complete</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <p>Processed <strong>${totalRows}</strong> row(s): <strong>${created}</strong> created, <strong>${updated}</strong> updated${errors.length ? `, <strong>${errors.length}</strong> skipped` : ''}.</p>
        ${errors.length ? `
          <div class="hint" style="margin-bottom:6px;">Rows with errors:</div>
          <div style="max-height:220px; overflow-y:auto; border:1px solid var(--border); border-radius:var(--radius); padding:10px 12px;">
            ${errors.map((e) => `<div style="font-size:12.5px; margin-bottom:6px;"><strong>Row ${e.row}</strong>${e.sku ? ` (${escapeHtml(e.sku)})` : ''}: ${escapeHtml(e.message)}</div>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" onclick="closeModal()">Done</button>
      </div>
    `);
    loadProducts();
    loadStats();
  } catch (err) {
    showToast(`Import failed: ${err.message}`);
  }
}

async function loadFilterOptions() {
  try {
    const [catRes, supRes] = await Promise.all([
      api.get('/categories?pageSize=100'),
      api.get('/suppliers?pageSize=100'),
    ]);
    categoriesCache = catRes.data;
    suppliersCache = supRes.data;

    const catSelect = document.getElementById('filter-category');
    categoriesCache.forEach((c) => {
      catSelect.insertAdjacentHTML('beforeend', `<option value="${c.id}">${escapeHtml(c.name)}</option>`);
    });

    const supSelect = document.getElementById('filter-supplier');
    suppliersCache.forEach((s) => {
      supSelect.insertAdjacentHTML('beforeend', `<option value="${s.id}">${escapeHtml(s.name)}</option>`);
    });
  } catch (err) {
    console.error('Failed to load filter options', err);
  }
}

// -----------------------------------------------------
// Load + render product list
// -----------------------------------------------------
async function loadProducts() {
  const container = document.getElementById('products-table-container');
  const paginationContainer = document.getElementById('pagination-container');
  container.innerHTML = `<div class="state-block">Loading products...</div>`;
  paginationContainer.style.display = 'none';

  const params = new URLSearchParams();
  params.set('page', state.page);
  params.set('pageSize', state.pageSize);
  if (state.search) params.set('search', state.search);
  if (state.category) params.set('category', state.category);
  if (state.supplier) params.set('supplier', state.supplier);
  if (state.status) params.set('status', state.status);

  try {
    const res = await api.get(`/products?${params.toString()}`);
    renderTable(res.data);
    renderPagination(res.pagination);
  } catch (err) {
    container.innerHTML = `<div class="state-block error"><div class="state-title">Couldn't load products</div>${escapeHtml(err.message)}</div>`;
  }
}

function renderTable(products) {
  const container = document.getElementById('products-table-container');

  if (products.length === 0) {
    container.innerHTML = `
      <div class="state-block">
        <div class="state-title">No products found</div>
        Try adjusting your search or filters, or add a new product.
      </div>`;
    return;
  }

  const rows = products.map((p) => `
    <tr>
      <td>
        <div style="font-weight:600;">${escapeHtml(p.name)}</div>
        <div class="sku-tag">${escapeHtml(p.sku)}</div>
      </td>
      <td>${escapeHtml(p.category_name) || '<span class="text-muted">—</span>'}</td>
      <td>${escapeHtml(p.supplier_name) || '<span class="text-muted">—</span>'}</td>
      <td>Rs ${Number(p.unit_price).toLocaleString()}</td>
      <td><span class="qty">${p.quantity_in_stock}</span></td>
      <td>${stockBadge(p.quantity_in_stock)}</td>
      <td class="actions-cell">
        <div class="actions-inner">
          <button class="btn-icon" title="Adjust stock" aria-label="Adjust stock" onclick="openStockMovementForm(${p.id}, '${escapeHtml(p.name)}', ${p.quantity_in_stock})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          </button>
          <button class="btn-icon" title="Edit" aria-label="Edit" onclick="openProductForm(${p.id})">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          ${isAdmin() ? `<button class="btn-icon btn-icon-danger" title="Delete" aria-label="Delete" onclick="confirmDeleteProduct(${p.id}, '${escapeHtml(p.name)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Category</th>
          <th>Supplier</th>
          <th>Price</th>
          <th>Qty</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPagination(pagination) {
  const el = document.getElementById('pagination-container');
  if (pagination.total === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = 'flex';
  el.innerHTML = buildPaginationHTML(pagination, 'goToPage');
}

// -----------------------------------------------------
// Stat cards — total / in stock / low stock / out of stock
// Reuses the paginated endpoint with pageSize=1, since the
// response's pagination.total gives us the count for that filter
// without pulling every row down.
// -----------------------------------------------------
async function loadStats() {
  try {
    const [all, low, out] = await Promise.all([
      api.get('/products?page=1&pageSize=1'),
      api.get('/products?page=1&pageSize=1&status=low_stock'),
      api.get('/products?page=1&pageSize=1&status=out_of_stock'),
    ]);
    const total = all.pagination.total;
    const lowCount = low.pagination.total;
    const outCount = out.pagination.total;
    const inStockCount = total - lowCount - outCount;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-in-stock').textContent = inStockCount;
    document.getElementById('stat-low-stock').textContent = lowCount;
    document.getElementById('stat-out-of-stock').textContent = outCount;
  } catch (err) {
    console.error('Failed to load stats', err);
  }
}

function goToPage(page) {
  state.page = page;
  loadProducts();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -----------------------------------------------------
// Add / Edit product modal
// -----------------------------------------------------
async function openProductForm(productId) {
  const isEdit = !!productId;
  let product = { name: '', sku: '', description: '', unit_price: '', quantity_in_stock: 0, category_id: '', supplier_id: '' };

  if (isEdit) {
    try {
      const res = await api.get(`/products/${productId}`);
      product = res.data;
    } catch (err) {
      showToast(`Couldn't load product: ${err.message}`);
      return;
    }
  }

  const categoryOptions = categoriesCache.map((c) =>
    `<option value="${c.id}" ${product.category_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');
  const supplierOptions = suppliersCache.map((s) =>
    `<option value="${s.id}" ${product.supplier_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
  ).join('');

  openModal(`
    <div class="modal-header">
      <h2>${isEdit ? 'Edit product' : 'Add product'}</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <form id="product-form">
      <div class="modal-body">
        <div id="form-error"></div>
        <div class="form-group">
          <label for="f-name">Name</label>
          <input type="text" id="f-name" value="${escapeHtml(product.name)}" required>
        </div>
        <div class="form-group">
          <label for="f-sku">SKU</label>
          <input type="text" id="f-sku" value="${escapeHtml(product.sku)}" required>
        </div>
        <div class="form-group">
          <label for="f-description">Description</label>
          <textarea id="f-description" rows="2">${escapeHtml(product.description)}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="f-price">Unit price</label>
            <input type="number" id="f-price" step="0.01" min="0" value="${product.unit_price}" required>
          </div>
          <div class="form-group">
            <label for="f-qty">Quantity in stock</label>
            <input type="number" id="f-qty" min="0" step="1" value="${product.quantity_in_stock}" ${isEdit ? '' : ''}>
            <div class="hint">${isEdit ? 'To change stock after creation, use "Adjust stock" instead.' : 'Starting quantity'}</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="f-category">Category</label>
            <select class="select" id="f-category"><option value="">— None —</option>${categoryOptions}</select>
          </div>
          <div class="form-group">
            <label for="f-supplier">Supplier</label>
            <select class="select" id="f-supplier"><option value="">— None —</option>${supplierOptions}</select>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Create product'}</button>
      </div>
    </form>
  `);

  document.getElementById('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.innerHTML = '';

    const payload = {
      name: document.getElementById('f-name').value.trim(),
      sku: document.getElementById('f-sku').value.trim(),
      description: document.getElementById('f-description').value.trim(),
      unit_price: parseFloat(document.getElementById('f-price').value),
      quantity_in_stock: parseInt(document.getElementById('f-qty').value) || 0,
      category_id: document.getElementById('f-category').value || null,
      supplier_id: document.getElementById('f-supplier').value || null,
    };

    try {
      if (isEdit) {
        await api.put(`/products/${productId}`, payload);
        showToast('Product updated');
      } else {
        await api.post('/products', payload);
        showToast('Product created');
      }
      closeModal();
      loadProducts();
      loadStats();
    } catch (err) {
      errorEl.innerHTML = `<div class="banner-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

// -----------------------------------------------------
// Delete confirmation
// -----------------------------------------------------
function confirmDeleteProduct(id, name) {
  openModal(`
    <div class="modal-header">
      <h2>Delete product</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? This also removes its stock movement history. This cannot be undone.
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
    </div>
  `);

  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await api.del(`/products/${id}`);
      closeModal();
      showToast('Product deleted');
      loadProducts();
      loadStats();
    } catch (err) {
      showToast(`Couldn't delete: ${err.message}`);
    }
  });
}

// -----------------------------------------------------
// Stock movement (Adjust stock) modal
// -----------------------------------------------------
function openStockMovementForm(productId, productName, currentQty) {
  openModal(`
    <div class="modal-header">
      <h2>Adjust stock — ${escapeHtml(productName)}</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <form id="stock-form">
      <div class="modal-body">
        <div id="stock-form-error"></div>
        <p class="text-muted" style="margin-top:0;">Current quantity: <strong>${currentQty}</strong></p>
        <div class="form-group">
          <label for="s-type">Movement type</label>
          <select class="select" id="s-type">
            <option value="IN">Stock IN (received)</option>
            <option value="OUT">Stock OUT (sold / used)</option>
          </select>
        </div>
        <div class="form-group">
          <label for="s-qty">Quantity</label>
          <input type="number" id="s-qty" min="1" step="1" required>
        </div>
        <div class="form-group">
          <label for="s-reason">Reason (optional)</label>
          <input type="text" id="s-reason" placeholder="e.g. Customer order #123">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">Record movement</button>
      </div>
    </form>
  `);

  document.getElementById('stock-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('stock-form-error');
    errorEl.innerHTML = '';

    const payload = {
      type: document.getElementById('s-type').value,
      quantity: parseInt(document.getElementById('s-qty').value),
      reason: document.getElementById('s-reason').value.trim() || undefined,
    };

    try {
      await api.post(`/products/${productId}/stock-movements`, payload);
      closeModal();
      showToast('Stock updated');
      loadProducts();
      loadStats();
    } catch (err) {
      errorEl.innerHTML = `<div class="banner-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

init();
