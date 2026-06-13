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

  function fmt(amount) { return '$' + Number(amount).toFixed(2) }

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
          <div style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:flex-end">
            <button id="f-cats"        style="padding:.3rem .7rem;background:#334155;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-size:.8rem">Categories</button>
            <button id="f-import"      style="padding:.3rem .7rem;background:#334155;color:#94a3b8;border:none;border-radius:6px;cursor:pointer;font-size:.8rem">↑ Import</button>
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
    container.querySelector('#f-import').onclick      = () => showImport()

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
        <span style="color:#94a3b8;font-size:.85rem">Amount ($)</span>
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

  // ─── CSV import ───────────────────────────────────────────────────────────

  const DATE_HEADERS    = ['date','transaction date','posted date','trans date']
  const AMOUNT_HEADERS  = ['amount']
  const DEBIT_HEADERS   = ['debit','debit amount']
  const CREDIT_HEADERS  = ['credit','credit amount']
  const NOTES_HEADERS   = ['description','notes','memo','payee','narrative']
  const TYPE_HEADERS    = ['type']
  const CAT_HEADERS     = ['category']

  function parseCSVText(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
    if (lines.length < 2) return { headers: [], rows: [] }
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
    const rows = lines.slice(1).map(line => {
      const cells = []
      let inQ = false, cell = ''
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { cells.push(cell.trim()); cell = '' }
        else { cell += ch }
      }
      cells.push(cell.trim())
      const obj = {}
      headers.forEach((h, i) => { obj[h] = (cells[i] || '').replace(/^"|"$/g, '').trim() })
      return obj
    }).filter(r => Object.values(r).some(v => v !== ''))
    return { headers, rows }
  }

  function csvToImportRows(headers, rows, catNames) {
    const find = (candidates) => candidates.find(c => headers.includes(c))
    const dateCol   = find(DATE_HEADERS)
    const amtCol    = find(AMOUNT_HEADERS)
    const debitCol  = find(DEBIT_HEADERS)
    const creditCol = find(CREDIT_HEADERS)
    const notesCol  = find(NOTES_HEADERS)
    const typeCol   = find(TYPE_HEADERS)
    const catCol    = find(CAT_HEADERS)

    const valid = [], errors = []
    rows.forEach((row, i) => {
      const dateRaw = dateCol ? row[dateCol] : ''
      // normalise MM/DD/YYYY → YYYY-MM-DD
      let date = dateRaw
      const slashMatch = dateRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (slashMatch) date = `${slashMatch[3]}-${slashMatch[1].padStart(2,'0')}-${slashMatch[2].padStart(2,'0')}`
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        errors.push({ row: i, reason: `invalid date "${dateRaw}"` }); return
      }

      let amount, type
      if (debitCol && creditCol) {
        const d = parseFloat(row[debitCol]  || '0')
        const c = parseFloat(row[creditCol] || '0')
        if (d > 0)      { amount = d; type = 'expense' }
        else if (c > 0) { amount = c; type = 'income'  }
        else { errors.push({ row: i, reason: 'no debit or credit value' }); return }
      } else if (amtCol) {
        const raw = parseFloat(row[amtCol].replace(/[^0-9.\-]/g, ''))
        if (isNaN(raw) || raw === 0) { errors.push({ row: i, reason: 'amount is zero or missing' }); return }
        amount = Math.abs(raw)
        type   = typeCol
          ? (['income','credit'].includes(row[typeCol].toLowerCase()) ? 'income' : 'expense')
          : (raw >= 0 ? 'income' : 'expense')
      } else {
        errors.push({ row: i, reason: 'no amount column found' }); return
      }

      const notes        = notesCol ? row[notesCol] : ''
      const categoryName = catCol   ? row[catCol]   : ''
      const catMatched   = categoryName
        ? (catNames.find(n => n.toLowerCase() === categoryName.toLowerCase()) || null)
        : null

      valid.push({ row: i, date, amount, type, notes, categoryName: catMatched || '', catDisplay: categoryName, catMatched: !!catMatched })
    })
    return { valid, errors }
  }

  function showImport() {
    const input = document.createElement('input')
    input.type   = 'file'
    input.accept = '.csv,text/csv'
    input.style.display = 'none'
    document.body.appendChild(input)

    input.onchange = async () => {
      const file = input.files[0]
      document.body.removeChild(input)
      if (!file) return

      const text = await file.text()
      const { headers, rows } = parseCSVText(text)
      if (!rows.length) { alert('No data rows found in CSV.'); return }

      const cats = categories.length ? categories : await api.get('/categories')
      categories = cats
      const catNames = cats.map(c => c.name)
      const { valid, errors } = csvToImportRows(headers, rows, catNames)

      showImportPreview(valid, errors, file.name)
    }
    input.click()
  }

  function showImportPreview(valid, errors, filename) {
    const allRows = [
      ...valid.map(r  => ({ ...r, _err: false })),
      ...errors.map(e => ({ row: e.row, _err: true, reason: e.reason })),
    ].sort((a, b) => a.row - b.row)

    container.innerHTML = `
      <button id="f-back" style="background:none;border:none;color:#6366f1;cursor:pointer;padding:0;margin-bottom:1rem">← Back</button>
      <h2 style="margin:0 0 .25rem;color:#f1f5f9">Import Preview</h2>
      <p style="color:#64748b;font-size:.85rem;margin:0 0 1rem">${esc(filename)} — ${valid.length} valid, ${errors.length} error${errors.length!==1?'s':''}</p>
      <div style="overflow-x:auto;margin-bottom:1rem">
        <table style="width:100%;border-collapse:collapse;font-size:.8rem">
          <thead>
            <tr style="color:#64748b;border-bottom:1px solid #334155">
              <th style="text-align:left;padding:.4rem .5rem">#</th>
              <th style="text-align:left;padding:.4rem .5rem">Date</th>
              <th style="text-align:right;padding:.4rem .5rem">Amount</th>
              <th style="text-align:left;padding:.4rem .5rem">Type</th>
              <th style="text-align:left;padding:.4rem .5rem">Category</th>
              <th style="text-align:left;padding:.4rem .5rem">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${allRows.map(r => r._err
              ? `<tr style="color:#ef4444;background:rgba(239,68,68,.07)">
                   <td style="padding:.35rem .5rem">${r.row+1}</td>
                   <td colspan="5" style="padding:.35rem .5rem">⚠ ${esc(r.reason)}</td>
                 </tr>`
              : `<tr style="border-bottom:1px solid #1e293b;color:#f1f5f9">
                   <td style="padding:.35rem .5rem;color:#64748b">${r.row+1}</td>
                   <td style="padding:.35rem .5rem">${esc(r.date)}</td>
                   <td style="padding:.35rem .5rem;text-align:right;color:${r.type==='income'?'#10b981':'#ef4444'}">${r.type==='expense'?'-':'+'} ${esc(fmt(r.amount))}</td>
                   <td style="padding:.35rem .5rem;color:#94a3b8">${r.type}</td>
                   <td style="padding:.35rem .5rem;color:${r.catMatched?'#f1f5f9':'#64748b'}">${r.catDisplay ? esc(r.catDisplay) + (r.catMatched?'':' <em>(no match)</em>') : '—'}</td>
                   <td style="padding:.35rem .5rem;color:#94a3b8;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.notes||'')}</td>
                 </tr>`
            ).join('')}
          </tbody>
        </table>
      </div>
      <div id="f-import-status" style="color:#ef4444;font-size:.85rem;margin-bottom:.75rem;display:none"></div>
      <button id="f-confirm-import" ${valid.length===0?'disabled':''} style="padding:.6rem 1.4rem;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:1rem;opacity:${valid.length===0?.5:1}">
        Import ${valid.length} row${valid.length!==1?'s':''}
      </button>`

    container.querySelector('#f-back').onclick = () => renderMain()
    container.querySelector('#f-confirm-import').onclick = async (btn) => {
      btn.target.disabled = true
      btn.target.textContent = 'Importing…'
      const statusEl = container.querySelector('#f-import-status')
      try {
        const rows = valid.map(r => ({
          date:         r.date,
          amount:       r.amount,
          type:         r.type,
          notes:        r.notes || '',
          categoryName: r.categoryName || undefined,
        }))
        const result = await api.post('/transactions/import', { rows })
        statusEl.style.display = 'none'
        alert(`Imported ${result.imported} transaction${result.imported!==1?'s':''}${result.errors.length ? `, ${result.errors.length} skipped` : ''}.`)
        renderMain()
      } catch (err) {
        statusEl.textContent = err.message || 'Import failed'
        statusEl.style.display = 'block'
        btn.target.disabled = false
        btn.target.textContent = `Import ${valid.length} row${valid.length!==1?'s':''}`
      }
    }
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
