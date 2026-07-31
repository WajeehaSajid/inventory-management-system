let state = { page: 1, pageSize: 10 };

async function init() {
  await loadCategories();
  document.getElementById('btn-add-category').addEventListener('click', () => openCategoryForm());
}

async function loadCategories() {
  const container = document.getElementById('categories-table-container');
  const paginationContainer = document.getElementById('pagination-container');
  container.innerHTML = `<div class="state-block">Loading categories...</div>`;
  paginationContainer.style.display = 'none';

  try {
    const res = await api.get(`/categories?page=${state.page}&pageSize=${state.pageSize}`);
    renderTable(res.data);
    renderPagination(res.pagination);
  } catch (err) {
    container.innerHTML = `<div class="state-block error"><div class="state-title">Couldn't load categories</div>${escapeHtml(err.message)}</div>`;
  }
}

function renderTable(categories) {
  const container = document.getElementById('categories-table-container');

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="state-block">
        <div class="state-title">No categories yet</div>
        Add your first category to start organizing products.
      </div>`;
    return;
  }

  const rows = categories.map((c) => `
    <tr>
      <td style="font-weight:600;">${escapeHtml(c.name)}</td>
      <td class="text-muted">${escapeHtml(c.description) || '—'}</td>
      <td class="actions-cell">
        <div class="actions-inner">
          <button class="btn btn-sm" onclick="openCategoryForm(${c.id})">Edit</button>
          ${isAdmin() ? `<button class="btn btn-sm btn-danger" onclick="confirmDeleteCategory(${c.id}, '${escapeHtml(c.name)}')">Delete</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table>
      <thead><tr><th>Name</th><th>Description</th><th>Actions</th></tr></thead>
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
  loadCategories();
}

async function openCategoryForm(id) {
  const isEdit = !!id;
  let category = { name: '', description: '' };

  if (isEdit) {
    try {
      const res = await api.get(`/categories/${id}`);
      category = res.data;
    } catch (err) {
      showToast(`Couldn't load category: ${err.message}`);
      return;
    }
  }

  openModal(`
    <div class="modal-header">
      <h2>${isEdit ? 'Edit category' : 'Add category'}</h2>
      <button class="modal-close" onclick="closeModal()">&times;</button>
    </div>
    <form id="category-form">
      <div class="modal-body">
        <div id="form-error"></div>
        <div class="form-group">
          <label for="f-name">Name</label>
          <input type="text" id="f-name" value="${escapeHtml(category.name)}" required>
        </div>
        <div class="form-group">
          <label for="f-description">Description</label>
          <textarea id="f-description" rows="3">${escapeHtml(category.description)}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn" onclick="closeModal()">Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Save changes' : 'Create category'}</button>
      </div>
    </form>
  `);

  document.getElementById('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('form-error');
    errorEl.innerHTML = '';
    const payload = {
      name: document.getElementById('f-name').value.trim(),
      description: document.getElementById('f-description').value.trim(),
    };
    try {
      if (isEdit) {
        await api.put(`/categories/${id}`, payload);
        showToast('Category updated');
      } else {
        await api.post('/categories', payload);
        showToast('Category created');
      }
      closeModal();
      loadCategories();
    } catch (err) {
      errorEl.innerHTML = `<div class="banner-error">${escapeHtml(err.message)}</div>`;
    }
  });
}

function confirmDeleteCategory(id, name) {
  openModal(`
    <div class="modal-header">
      <h2>Delete category</h2>
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
      await api.del(`/categories/${id}`);
      closeModal();
      showToast('Category deleted');
      loadCategories();
    } catch (err) {
      // e.g. CATEGORY_IN_USE -> show the backend's specific message
      closeModal();
      showToast(err.message);
    }
  });
}

init();
