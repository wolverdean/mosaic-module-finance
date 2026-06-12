;(function () {
  'use strict'

  // ─── State ─────────────────────────────────────────────────────────────────

  let container  = null
  let shell      = null
  let categories = []
  let currentMonth = new Date().toISOString().slice(0, 7)

  // ─── Helpers ───────────────────────────────────────────────────────────────

  const api = {
    get:    p    => shell.api.get(p),
    post:   (p,b) => shell.api.post(p, b),
    put:    (p,b) => shell.api.put(p, b),
    delete: p    => shell.api.delete(p),
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }

  function fmt(amount) { return '£' + Number(amount).toFixed(2) }

  function prevMonth(m) {
    const [y, mo] = m.split('-').map(Number)
    return mo === 1 ? `${y-1}-12` : `${y}-${String(mo-1).padStart(2,'0')}`
  }
  function nextMonth(m) {
    const [y, mo] = m.split('-').map(Number)
    return mo === 12 ? `${y+1}-01` : `${y}-${String(mo+1).padStart(2,'0')}`
  }
  function monthLabel(m) {
    const [y, mo] = m.split('-').map(Number)
    return new Date(y, mo-1, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
  }

  const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6','#f97316','#06b6d4']

  // ─── Main view ─────────────────────────────────────────────────────────────

  async function renderMain() {
    const [txns, summary, invIncome, cats] = await Promise.all([
      api.get(`/transactions?month=${currentMonth}`),
      api.get(`/summary?month=${currentMonth}`),
      api.get(`/inventory-income?month=${currentMonth}`),
      api.get('/categories'),
    ])
    categories = cats

    const allIncome = [
      ...txns.filter(t => t.type === 'income'),
      ...invIncome,
    ].sort((a,b) => b.date.localeCompare(a.date))

    const allExpenses = txns.filter(t => t.type === 'expense')
      .sort((a,b) => b.date.localeCompare(a.date))

    const totalIncome   = summary.income   + invIncome.reduce((s,i) => s + i.amount, 0)
    const net           = totalIncome - summary.expenses

    const catMap = Object.fromEntries(cats.map(c => [c.id, c]))

    container.innerHTML = `
      <div style="max-width:700px;margin:0 auto;padding:1rem">

        <!-- Month nav -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
          <button id="f-prev" style="background:none;border:none;color:#6366f1;font-size:1.3rem;cursor:pointer">‹</button>
          <h2 style="margin:0;color:#f1f5f9;font-size:1.1rem">${esc(monthLabel(currentMonth))}</h2>
          <button id="f-next" style="background:none;border:none;color:#6366f1;font-size:1.3rem;cursor:pointer">›</button>
        </div>

        <!-- Summary cards -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.5rem">
          <div style="background:#1e293b;border-radius:8px;padding:1rem;text-align:center">
            <div style="font-size:.75rem;color:#64748b;margin-bottom:.25rem">Income</div>
            <div style="font-size:1.2rem;font-weight:700;color:#10b981">${esc(fmt(totalIncome))}</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:1rem;text-align:center">
            <div style="font-size:.75rem;color:#64748b;margin-bottom:.25rem">Expenses</div>
            <div style="font-size:1.2rem;font-weight:700;color:#ef4444">${esc(fmt(summary.expenses))}</div>
          </div>
          <div style="background:#1e293b;border-radius:8px;padding:1rem;text-align:center">
            <div style="font-size:.75rem;color:#64748b;margin-bottom:.25rem">Net</div>
            <div style="font-size:1.2rem;font-weight:700;color:${net >= 0 ? '#10b981' : '#ef4444'}">${esc(fmt(net))}</div>
          </div>
        </div>

        <!-- Category breakdown -->
        ${summary.byCategory.length ? `
        <div style="background:#1e293b;border-radius:8px;padding:1rem;margin-bottom:1.5rem">
          <div style="font-size:.8rem;color:#64748b;margin-bottom:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em">By Category</div>
          ${summary.byCategory.map(b => {
            const cat = catMap[b.id] || { color: '#6366f1', emoji: '', name: b.name || 'Uncategorised' }
            const pct = summary.expenses > 0 && b.type === 'expense' ? Math.round(b.total / summary.expenses * 100) : 0
            return `<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem">
              <div style="width:.6rem;height:.6rem;border-radius:50%;background:${esc(cat.color)};flex-shrink:0"></div>
              <div style="flex:1;min-width:0;color:#94a3b8;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(cat.emoji ? cat.emoji+' '+cat.name : (b.name || 'Uncategorised'))}</div>
              ${pct ? `<div style="font-size:.75rem;color:#64748b;flex-shrink:0">${pct}%</div>` : ''}
              <div style="font-size:.85rem;font-weight:600;color:#f1f5f9;flex-shrink:0">${esc(fmt(b.total))}</div>
            </div>`
          }).join('')}
        </div>` : ''}

        <!-- Add transaction button -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
          <span style="color:#94a3b8;font-size:.85rem;font-weight:600">Transactions</span>
          <div style="display:flex;gap:.5rem">
            <button id="f-cats" style="padding:.3rem .7rem;background:#334155;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-size:.8rem">Categories</button>
            <button id="f-add-expense" style="padding:.3rem .7rem;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.8rem">− Expense</button>
            <button id="f-add-income"  style="padding:.3rem .7rem;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:.8rem">+ Income</button>
          </div>
        </div>

        <!-- Transaction list -->
        <div id="f-tx-list">
          ${renderTxList([...allIncome, ...allExpenses].sort((a,b) => b.date.localeCompare(a.date)), catMap)}
        </div>
      </div>`

    container.querySelector('#f-prev').onclick = () => { currentMonth = prevMonth(currentMonth); renderMain() }
    container.querySelector('#f-next').onclick = () => { currentMonth = nextMonth(currentMonth); renderMain() }
    container.querySelector('#f-add-expense').onclick = () => showForm('expense')
    container.querySelector('#f-add-income').onclick  = () => showForm('income')
    container.querySelector('#f-cats').onclick        = () => showCategories()

    container.querySelectorAll('.f-tx-edit').forEach(btn => {
      btn.onclick = (e) => { e.stopPropagation(); showForm(null, btn.dataset.id) }
    })
    container.querySelectorAll('.f-tx-del').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation()
        if (!confirm('Delete this transaction?')) return
        await api.delete(`/transactions/${btn.dataset.id}`)
        renderMain()
      }
    })
  }

  function renderTxList(txns, catMap) {
    if (!txns.length) return `<p style="color:#64748b;text-align:center;padding:1rem">No transactions this month.</p>`
    return txns.map(t => {
      const cat    = catMap[t.category_id] || null
      const isInv  = t.source === 'inventory'
      return `<div style="display:flex;align-items:center;gap:.75rem;padding:.75rem;background:#1e293b;border-radius:8px;margin-bottom:.4rem">
        <div style="width:.4rem;height:2rem;border-radius:2px;flex-shrink:0;background:${t.type==='income'?'#10b981':'#ef4444'}"></div>
        <div style="flex:1;min-width:0">
          <div style="color:#f1f5f9;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${esc(t.notes || (t.title ? t.title : (cat ? cat.emoji+' '+cat.name : 'Transaction')))}
          </div>
          <div style="font-size:.75rem;color:#64748b">${esc(t.date)}${cat ? ' · '+esc(cat.emoji+' '+cat.name) : ''}${isInv ? ' · 📦 Inventory' : ''}</div>
        </div>
        <div style="font-weight:700;color:${t.type==='income'?'#10b981':'#ef4444'};flex-shrink:0">${t.type==='expense'?'-':'+'} ${esc(fmt(t.amount))}</div>
        ${!isInv ? `
          <button class="f-tx-edit" data-id="${t.id}" style="background:none;border:none;color:#64748b;cursor:pointer;padding:.25rem;font-size:.8rem">✎</button>
          <button class="f-tx-del"  data-id="${t.id}" style="background:none;border:none;color:#64748b;cursor:pointer;padding:.25rem;font-size:.8rem">✕</button>` : ''}
      </div>`
    }).join('')
  }

  // ─── Add/edit transaction form ─────────────────────────────────────────────

  async function showForm(defaultType, editId) {
    let existing = null
    if (editId) {
      existing = await api.get(`/transactions/${editId}`)
    }
    const cats = categories.length ? categories : await api.get('/categories')
    const type = existing?.type || defaultType || 'expense'
    const today = new Date().toISOString().slice(0, 10)

    container.innerHTML = `
      <button id="f-back" style="background:none;border:none;color:#6366f1;cursor:pointer;padding:0;margin-bottom:1rem">← Back</button>
      <h2 style="margin:0 0 1.5rem;color:#f1f5f9">${existing ? 'Edit' : 'New'} ${type === 'income' ? 'Income' : 'Expense'}</h2>
      <label style="display:block;margin-bottom:1rem">
        <span style="color:#94a3b8;font-size:.85rem">Amount (£)</span>
        <input id="f-amount" type="number" step="0.01" min="0.01" value="${existing ? existing.amount : ''}"
          style="display:block;width:100%;margin-top:.25rem;padding:.5rem;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#f1f5f9;box-sizing:border-box">
      </label>
      <label style="display:block;margin-bottom:1rem">
        <span style="color:#94a3b8;font-size:.85rem">Date</span>
        <input id="f-date" type="date" value="${existing ? existing.date : today}"
          style="display:block;width:100%;margin-top:.25rem;padding:.5rem;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#f1f5f9;box-sizing:border-box">
      </label>
      <label style="display:block;margin-bottom:1rem">
        <span style="color:#94a3b8;font-size:.85rem">Category</span>
        <select id="f-cat" style="display:block;width:100%;margin-top:.25rem;padding:.5rem;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#f1f5f9">
          <option value="">— None —</option>
          ${cats.filter(c => c.type === type).map(c =>
            `<option value="${c.id}" ${existing?.category_id===c.id?'selected':''}>${esc(c.emoji+' '+c.name)}</option>`
          ).join('')}
        </select>
      </label>
      <label style="display:block;margin-bottom:1.5rem">
        <span style="color:#94a3b8;font-size:.85rem">Notes</span>
        <input id="f-notes" value="${esc(existing?.notes||'')}"
          style="display:block;width:100%;margin-top:.25rem;padding:.5rem;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#f1f5f9;box-sizing:border-box">
      </label>
      <button id="f-save" style="padding:.6rem 1.4rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:1rem">
        ${existing ? 'Save' : 'Add'}
      </button>`

    container.querySelector('#f-back').onclick = () => renderMain()
    container.querySelector('#f-save').onclick = async () => {
      const amount = parseFloat(container.querySelector('#f-amount').value)
      const date   = container.querySelector('#f-date').value
      const catId  = container.querySelector('#f-cat').value
      const notes  = container.querySelector('#f-notes').value
      if (!amount || amount <= 0) { alert('Enter a positive amount'); return }
      if (!date) { alert('Date is required'); return }
      try {
        const body = { amount, type, date, notes, categoryId: catId ? Number(catId) : undefined }
        if (existing) {
          await api.put(`/transactions/${existing.id}`, body)
        } else {
          await api.post('/transactions', body)
        }
        renderMain()
      } catch (err) { alert(err.message || 'Error') }
    }
  }

  // ─── Categories management ─────────────────────────────────────────────────

  async function showCategories() {
    const cats = await api.get('/categories')

    container.innerHTML = `
      <button id="f-back" style="background:none;border:none;color:#6366f1;cursor:pointer;padding:0;margin-bottom:1rem">← Back</button>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
        <h2 style="margin:0;color:#f1f5f9">Categories</h2>
        <button id="f-add-cat" style="padding:.35rem .8rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer">+ New</button>
      </div>
      ${cats.length === 0 ? '<p style="color:#64748b">No categories yet.</p>' :
        ['income','expense'].map(t => {
          const group = cats.filter(c => c.type === t)
          if (!group.length) return ''
          return `<div style="margin-bottom:1rem">
            <div style="font-size:.75rem;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">${t}</div>
            ${group.map(c => `
              <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem;background:#1e293b;border-radius:8px;margin-bottom:.35rem">
                <div style="width:.8rem;height:.8rem;border-radius:50%;background:${esc(c.color)};flex-shrink:0"></div>
                <span style="flex:1;color:#f1f5f9">${esc(c.emoji)} ${esc(c.name)}</span>
                <button class="f-del-cat" data-id="${c.id}" style="background:none;border:none;color:#64748b;cursor:pointer">✕</button>
              </div>`).join('')}
          </div>`
        }).join('')}
      <div id="f-cat-form" style="background:#1e293b;border-radius:8px;padding:1rem;margin-top:1rem;display:none">
        <label style="display:block;margin-bottom:.75rem">
          <span style="color:#94a3b8;font-size:.85rem">Name</span>
          <input id="f-cat-name" style="display:block;width:100%;margin-top:.25rem;padding:.5rem;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9;box-sizing:border-box">
        </label>
        <label style="display:block;margin-bottom:.75rem">
          <span style="color:#94a3b8;font-size:.85rem">Type</span>
          <select id="f-cat-type" style="display:block;width:100%;margin-top:.25rem;padding:.5rem;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
        <label style="display:block;margin-bottom:.75rem">
          <span style="color:#94a3b8;font-size:.85rem">Emoji</span>
          <input id="f-cat-emoji" maxlength="4" style="display:block;width:5rem;margin-top:.25rem;padding:.5rem;background:#0f172a;border:1px solid #334155;border-radius:6px;color:#f1f5f9">
        </label>
        <div style="margin-bottom:.75rem">
          <span style="color:#94a3b8;font-size:.85rem;display:block;margin-bottom:.4rem">Color</span>
          <div style="display:flex;gap:.4rem;flex-wrap:wrap" id="f-color-swatches">
            ${COLORS.map(c => `<div class="f-swatch" data-color="${c}" style="width:1.3rem;height:1.3rem;border-radius:50%;background:${c};cursor:pointer"></div>`).join('')}
          </div>
        </div>
        <button id="f-save-cat" style="padding:.4rem 1rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer">Save</button>
      </div>`

    let selectedColor = COLORS[0]
    container.querySelector('#f-add-cat').onclick = () => {
      container.querySelector('#f-cat-form').style.display = 'block'
    }
    container.querySelectorAll('.f-swatch').forEach(el => {
      el.onclick = () => {
        selectedColor = el.dataset.color
        container.querySelectorAll('.f-swatch').forEach(e => e.style.outline = 'none')
        el.style.outline = '3px solid #fff'; el.style.outlineOffset = '2px'
      }
    })
    container.querySelector('#f-save-cat').onclick = async () => {
      const name  = container.querySelector('#f-cat-name').value.trim()
      const type  = container.querySelector('#f-cat-type').value
      const emoji = container.querySelector('#f-cat-emoji').value
      if (!name) { alert('Name required'); return }
      await api.post('/categories', { name, type, emoji, color: selectedColor })
      showCategories()
    }
    container.querySelectorAll('.f-del-cat').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Delete category?')) return
        await api.delete(`/categories/${btn.dataset.id}`)
        showCategories()
      }
    })
    container.querySelector('#f-back').onclick = () => renderMain()
  }

  // ─── Module registration ───────────────────────────────────────────────────

  window.Mosaic.registerModule({
    slug: 'finance',

    init(s) { shell = s },

    async onActivate(el) {
      container = el
      container.style.padding = '1rem'
      try {
        await renderMain()
      } catch (err) {
        container.innerHTML = `<p style="color:#ef4444">Failed to load finance: ${esc(err.message)}</p>`
      }
    },

    onDeactivate() { container = null },
  })
})()
