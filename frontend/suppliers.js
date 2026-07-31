let state = { page: 1, pageSize: 10 };

async function init() {
  await loadSuppliers();
  document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierForm());
}

async function loadSuppliers() {
  const container = document.getElementById('suppliers-table-container');
  const paginationContainer = document.getElementById('pagination-container');
  container.innerHTML = `<div class="state-block">Loading suppliers...</div>`;
  paginationContainer.style.display = 'none';

  try {
    const res = await api.get(`/suppliers?page=${state.page}&pageSize=${state.pageSize}`);
    renderTable(res.data);
    renderPagination(res.pagination);
  } catch (err) {
    container.innerHTML = `<div class="state-block error"><div class="state-title">Couldn't load suppliers</div>${escapeHtml(err.message)}</div>`;
  }
}

function renderTable(suppliers) {
  const container = document.getElementById('suppliers-table-container');

  if (suppliers.length === 0) {
    container.innerHTML = `
      <div class="state-block">
        <div class="state-title">No suppliers yet</div>
        Add your first supplier to start linking products to vendors.
      </div>`;
    return;
  }

  const rows = suppliers.map((s) => `
    <tr>
      <td style="font-weight:600;">${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.contact_email)}</td>
      <td class="text-muted">${escapeHtml(s.phone) || '—'}</td>
      <td class="text-muted">${escapeHtml(s.address) || '—'}</td>
      <td class="actions-cell">
        <div class="actions-inner">
          <button class="btn btn-sm" onclick="openSupplierForm(${s.id})">Edit</button>
          ${isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="confirmDeleteSupplier(${s.id}, '${escapeHtml(s.name)}')">Delete</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Address</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderPagination(pagination) {
  const el = document.getElementById('pagination-container');
  if (pagination.total === 0) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = buildPaginationHTML(pagination, 'goToPage');
}

function goToPage(page) {
  state.page = page;
  loadSuppliers();
}

async function openSupplierForm(id) {
  const isEdit = !!id;
  let supplier = { name: '', contact_email: '', phone: '', address: '' };

  if (isEdit) {
    try {
      const res = await api.get(`/suppliers/${id}`);
      supplier = res.data;
    } catch (err) {
      showToast(`Couldn't load supplier: ${err.message}`);
      return;
    }
  }

  openModal(`
    <div class="modal-header">
      <h2>${isEdit ? 'Edit supplier' : 'Add supplier'}</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <form id="supplier-form">
      <div class="modal-body">
        <div id="form-error"></div>
        <div class="form-group">
          <label for="f-name">Name</label>
          <input type="text" id="f-name" value="${escapeHtml(supplier.name)}" required>
        </div>
        <div class="form-group">
          <label for="f-email">Contact email</label>
          <input type="email" id="f-email" value="${escapeHtml(supplier.contact_email)}" required>
        </div>
        <div class="form-group">
          <label for="f-phone">Phone</label>
          <input type="text" id="f-phone" value="${escapeHtml(supplier.phone)}">
        </div>
        <div class="form-group">
          <label for="f-address">Address</label>
          <textarea id="f-address" rows="2">${escapeHtml(supplier.address)}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Create supplier'}</button>
      </div>
    </form>
  `);

  document.getElementById('supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.innerHTML = '';
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      contact_email: document.getElementById('f-email').value.trim(),
      phone: document.getElementById('f-phone').value.trim(),
      address: document.getElementById('f-address').value.trim(),
    };
    try {
      if (isEdit) {
        await api.put(`/suppliers/${id}`, payload);
        showToast('Supplier updated');
      } else {
        await api.post('/suppliers', payload);
        showToast('Supplier created');
      }
      closeModal();
      loadSuppliers();
    } catch (err) {
      errorEl.innerHTML = `<div class="banner-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function confirmDeleteSupplier(id, name) {
  openModal(`
    <div class="modal-header">
      <h2>Delete supplier</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <div class="modal-body">
      Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? This cannot be undone.
    </div>
    <div class="modal-footer">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="confirm-delete-btn">Delete</button>
    </div>
  `);

  document.getElementById('confirm-delete-btn').addEventListener('click', async () => {
    try {
      await api.del(`/suppliers/${id}`);
      closeModal();
      showToast('Supplier deleted');
      loadSuppliers();
    } catch (err) {
      closeModal();
      showToast(err.message);
    }
  });
}

init();
