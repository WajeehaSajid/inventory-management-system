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
          <button class="btn btn-sm" onclick="openStockMovementForm(${p.id}, '${escapeHtml(p.name)}', ${p.quantity_in_stock})">Adjust stock</button>
          <button class="btn btn-sm" onclick="openProductForm(${p.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteProduct(${p.id}, '${escapeHtml(p.name)}')">Delete</button>
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
