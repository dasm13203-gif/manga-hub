/* لوحة التحكم: منتجات، طلبات، طلبات خاصة، إعدادات */
(function () {
  'use strict';
  const { sb, $, esc, fmt, EGP, PAL, GENRES, LANGS, ORDER_ST, REQ_ST, stLabel, mapProduct, coverStyle, coverInner, toast, imgUrl } = MH;
  const app = $('#app'), ov = $('#overlay');
  let tab = 'overview', pq = '', ost = 'all', sheet = null, loading = false, loadErr = '';
  let products = [], orders = [], reqs = [], settings = {};
  const armed = {};
  function armDel(key, fn) {
    if (armed[key]) { clearTimeout(armed[key]); delete armed[key]; fn(); return; }
    armed[key] = setTimeout(() => { delete armed[key]; renderDash(); }, 3000); renderDash();
  }

  /* ---------- الدخول ---------- */
  function renderLogin(msg) {
    app.innerHTML = '<div class="wrap"><form class="panel login" id="loginform"><h1>دخول لوحة التحكم</h1><p class="muted">للمالك فقط.</p>' +
      '<label class="f">البريد الإلكتروني<input id="l-email" type="email" autocomplete="email" dir="ltr" required></label>' +
      '<label class="f">كلمة المرور<input id="l-pass" type="password" autocomplete="current-password" dir="ltr" required></label>' +
      (msg ? '<div class="err">' + esc(msg) + '</div>' : '') +
      '<button class="btn primary" type="submit">دخول</button><a class="btn ghost" href="index.html">العودة للمتجر</a></form></div>';
  }
  function renderDenied() {
    app.innerHTML = '<div class="wrap"><div class="panel login"><h1>مفيش صلاحية</h1><p class="muted">الحساب ده مش مضاف كمدير. أضفه في جدول admins حسب خطوات README.</p><button class="btn" data-act="logout" type="button">تسجيل الخروج</button></div></div>';
  }
  async function boot() {
    if (!sb) { app.innerHTML = MH.notConfigured(); return; }
    const { data } = await sb.auth.getSession();
    if (!data.session) return renderLogin();
    const a = await sb.from('admins').select('user_id').eq('user_id', data.session.user.id).maybeSingle();
    if (!a.data) return renderDenied();
    await loadAll(); renderDash();
  }
  async function loadAll() {
    loading = true; loadErr = '';
    const [p, o, r, s] = await Promise.all([
      sb.from('products').select('*').order('created_at', { ascending: false }),
      sb.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('requests').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('settings').select('*').eq('id', 1).maybeSingle()
    ]);
    if (p.error || o.error || r.error || s.error) loadErr = 'تعذر تحميل بعض البيانات. تأكد إنك شغّلت supabase.sql بالكامل.';
    products = (p.data || []).map(mapProduct); orders = o.data || []; reqs = r.data || [];
    settings = MH.mapSettings(s.data); loading = false;
  }

  /* ---------- الواجهة ---------- */
  function renderDash() {
    const tabs = [['overview', 'نظرة عامة'], ['products', 'المنتجات'], ['orders', 'الطلبات'], ['requests', 'الطلبات الخاصة'], ['settings', 'الإعدادات']];
    const inner = tab === 'overview' ? dOverview() : tab === 'products' ? dProducts() : tab === 'orders' ? dOrders() : tab === 'requests' ? dReqs() : dSettings();
    app.innerHTML = '<div class="wrap dash"><div class="dtop"><h1>لوحة تحكم مانجا هب</h1><span style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn sm" type="button" data-act="reload">تحديث</button><a class="btn sm" href="index.html">عرض المتجر</a><button class="btn sm ghost" type="button" data-act="logout">خروج</button></span></div>' +
      (loadErr ? '<div class="notice">' + esc(loadErr) + '</div>' : '') +
      '<div class="tabs" role="tablist">' + tabs.map(t => '<button type="button" role="tab" data-act="tab" data-v="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + (t[0] === 'orders' && orders.some(o => o.status === 'new') ? ' <span class="pill info">' + orders.filter(o => o.status === 'new').length + '</span>' : '') + '</button>').join('') + '</div>' + inner + '</div>';
  }
  function dOverview() {
    const live = orders.filter(o => o.status !== 'cancelled');
    const rev = live.reduce((a, o) => a + Number(o.total || 0), 0);
    const fresh = orders.filter(o => o.status === 'new').length;
    const low = products.filter(p => p.active && !p.preorder && p.stock <= 2);
    const days = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push(d.getTime()); }
    const counts = days.map((t, i) => orders.filter(o => { const c = new Date(o.created_at).getTime(); return c >= t && c < (days[i + 1] || Infinity); }).length);
    const mx = Math.max(1, ...counts);
    return '<div class="stats"><div class="stat"><span>طلبات جديدة</span><b>' + fresh + '</b></div><div class="stat"><span>إجمالي الطلبات</span><b>' + orders.length + '</b></div><div class="stat"><span>الإيرادات</span><b>' + fmt(rev) + ' <small>ج.م</small></b></div><div class="stat"><span>مخزون منخفض</span><b>' + low.length + '</b></div></div>' +
      '<div class="panel"><h3>الطلبات آخر 7 أيام</h3><div class="bars">' + counts.map((c, i) => '<div class="bar"><i class="' + (c ? '' : 'z') + '" style="height:' + Math.max(3, Math.round(c / mx * 100)) + '%"></i><div><u class="num">' + c + '</u><br><em>' + new Date(days[i]).toLocaleDateString('ar-EG', { weekday: 'short' }) + '</em></div></div>').join('') + '</div></div>' +
      (low.length ? '<div class="panel" style="margin-top:1rem"><h3>محتاج تجديد مخزون</h3><div class="rows">' + low.map(p => '<div class="row"><div class="th" style="' + coverStyle(p) + '">' + coverInner(p) + '</div><div><h4>' + esc(p.title) + (p.vol ? ' #' + esc(p.vol) : '') + '</h4><div class="meta"><span class="pill ' + (p.stock <= 0 ? 'bad' : 'warn') + '">' + (p.stock <= 0 ? 'نفد' : 'باقي ' + p.stock) + '</span></div></div><div class="acts"><button type="button" class="btn sm" data-act="p-edit" data-id="' + esc(p.id) + '">تعديل</button></div></div>').join('') + '</div></div>' : '');
  }
  function pRows() {
    const q = pq.trim().toLowerCase();
    const L = products.filter(p => !q || (p.title + ' ' + (p.author || '')).toLowerCase().includes(q));
    if (!L.length) return '<div class="empty" style="grid-column:auto">' + (products.length ? 'مفيش نتائج.' : 'لسه مفيش منتجات. اضغط «إضافة كتاب».') + '</div>';
    return L.map(p => {
      const out = !p.preorder && p.stock <= 0;
      return '<div class="row"><div class="th" style="' + coverStyle(p) + '">' + coverInner(p) + '</div><div style="min-width:0"><h4>' + esc(p.title) + (p.vol ? ' #' + esc(p.vol) : '') + (p.active ? '' : ' <span class="pill mute">مخفي</span>') + '</h4>' +
        '<div class="meta"><span class="num">' + EGP(p.price) + '</span><span>' + (LANGS[p.lang] || '') + '</span><span>' + esc(p.genre || '') + '</span><span class="pill ' + (out ? 'bad' : (p.stock <= 2 && !p.preorder ? 'warn' : 'ok')) + '">' + (p.preorder ? 'بالطلب' : (out ? 'نفد' : 'المخزون ' + p.stock)) + '</span>' + (p.featured ? '<span class="pill info">مميز</span>' : '') + '</div></div>' +
        '<div class="acts"><button type="button" class="btn sm" data-act="p-edit" data-id="' + esc(p.id) + '">تعديل</button><button type="button" class="btn sm danger" data-act="p-del" data-id="' + esc(p.id) + '">' + (armed['p' + p.id] ? 'تأكيد الحذف' : 'حذف') + '</button></div></div>';
    }).join('');
  }
  function dProducts() {
    return '<div class="tools"><input type="search" id="psearch" placeholder="بحث في المنتجات" value="' + esc(pq) + '"><button type="button" class="btn primary" data-act="p-new">إضافة كتاب</button></div><div class="rows" id="prows">' + pRows() + '</div>';
  }
  function dOrders() {
    const L = orders.filter(o => ost === 'all' || o.status === ost);
    return '<div class="tools"><select id="ostf" aria-label="تصفية الحالة"><option value="all">كل الحالات</option>' + ORDER_ST.map(s => '<option value="' + s[0] + '"' + (ost === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select></div>' +
      (L.length ? '<div class="rows">' + L.map(oRow).join('') + '</div>' : '<div class="empty" style="grid-column:auto">مفيش طلبات.</div>') +
      '<p class="hint" style="margin-top:1rem">لما تلغي طلب الكميات بترجع للمخزون تلقائي.</p>';
  }
  function oRow(o) {
    const st = stLabel(ORDER_ST, o.status);
    return '<div class="orow"><div class="top"><b>#' + o.id + ' · ' + esc(o.customer) + '</b><span class="pill ' + st[2] + '">' + st[1] + '</span></div>' +
      '<div class="muted" style="font-size:.88rem"><a class="num" dir="ltr" href="https://wa.me/' + esc(waDigits(o.phone)) + '" target="_blank" rel="noopener">' + esc(o.phone) + '</a> · ' + esc(o.gov) + ' · ' + esc(o.address) + ' · <span class="num">' + new Date(o.created_at).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) + '</span></div>' +
      '<ul>' + (o.items || []).map(i => '<li>' + esc(i.title) + ' × ' + i.qty + (i.preorder ? ' (بالطلب)' : '') + '</li>').join('') + '</ul>' + (o.note ? '<div class="hint">ملاحظة: ' + esc(o.note) + '</div>' : '') +
      '<div class="bot"><span><b class="num">' + EGP(o.total) + '</b> <span class="hint">شحن ' + EGP(o.shipping) + '</span></span><span style="display:flex;gap:.5rem;align-items:center"><select data-ost="' + o.id + '" aria-label="الحالة">' + ORDER_ST.map(s => '<option value="' + s[0] + '"' + (o.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select><button type="button" class="btn sm danger" data-act="o-del" data-id="' + o.id + '">' + (armed['o' + o.id] ? 'تأكيد الحذف' : 'حذف') + '</button></span></div></div>';
  }
  function waDigits(p) { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '20' + d.slice(1); return d; }
  function dReqs() {
    return (reqs.length ? '<div class="rows">' + reqs.map(r => {
      const st = stLabel(REQ_ST, r.status);
      return '<div class="orow"><div class="top"><b>' + esc(r.title) + '</b><span class="pill ' + st[2] + '">' + st[1] + '</span></div><div class="muted" style="font-size:.88rem">' + esc(r.customer || '') + ' · <a class="num" dir="ltr" href="https://wa.me/' + esc(waDigits(r.phone)) + '" target="_blank" rel="noopener">' + esc(r.phone || '') + '</a> · ' + (LANGS[r.lang] || '') + (r.notes ? ' · ' + esc(r.notes) : '') + ' · <span class="num">' + new Date(r.created_at).toLocaleDateString('en-GB') + '</span></div>' +
        '<div class="bot"><label class="f" style="grid-auto-flow:column;align-items:center;gap:.5rem">السعر المتفق عليه<input type="number" min="0" style="width:110px" data-rprice="' + r.id + '" value="' + esc(r.price || '') + '"></label><span style="display:flex;gap:.5rem;align-items:center"><select data-rst="' + r.id + '" aria-label="الحالة">' + REQ_ST.map(s => '<option value="' + s[0] + '"' + (r.status === s[0] ? ' selected' : '') + '>' + s[1] + '</option>').join('') + '</select><button type="button" class="btn sm danger" data-act="r-del" data-id="' + r.id + '">' + (armed['r' + r.id] ? 'تأكيد الحذف' : 'حذف') + '</button></span></div></div>';
    }).join('') + '</div>' : '<div class="empty" style="grid-column:auto">مفيش طلبات خاصة.</div>');
  }
  let sd = null;
  function dSettings() {
    sd = sd || Object.assign({}, settings); const s = sd;
    const f = (k, l, n, ex) => '<label class="f">' + l + '<input id="s-' + k + '" data-s="' + k + '" ' + (n ? 'type="number" min="0" inputmode="numeric" data-num="1"' : 'type="text"') + ' value="' + esc(s[k] == null ? '' : s[k]) + '" ' + (ex || '') + '></label>';
    return '<div class="panel" style="max-width:720px">' + f('heroTitle', 'عنوان الصفحة الرئيسي') + f('heroSub', 'الوصف تحت العنوان') + f('announcement', 'شريط الإعلان العلوي (سيبه فاضي لو مش عايزه)') +
      '<div class="grid2">' + f('whatsapp', 'رقم واتساب الطلبات', 0, 'dir="ltr" inputmode="tel"') + f('site', 'عنوان الموقع', 0, 'dir="ltr"') + '</div>' +
      '<div class="grid2">' + f('shipFee', 'سعر الشحن (ج.م)', 1) + f('freeOver', 'شحن مجاني للطلبات من (ج.م، 0 لإلغائه)', 1) + '</div>' +
      '<div><button type="button" class="btn primary" data-act="s-save">حفظ الإعدادات</button></div></div>';
  }

  /* ---------- النافذة (إضافة وتعديل كتاب) ---------- */
  function sheetHTML() {
    const o = sheet.obj;
    const fld = (k, l, n, ex) => '<label class="f">' + l + '<input data-f="' + k + '" ' + (n ? 'type="number" min="0" inputmode="numeric" data-num="1"' : 'type="text"') + ' value="' + esc(o[k] == null ? '' : o[k]) + '" ' + (ex || '') + '></label>';
    return '<div class="sheet-wrap"><div class="sheet" role="dialog" aria-modal="true"><h3>' + (sheet.isNew ? 'إضافة كتاب' : 'تعديل الكتاب') + '</h3>' +
      fld('title', 'اسم المانجا') + fld('author', 'المؤلف') +
      '<div class="grid3">' + fld('vol', 'رقم المجلد', 1) + '<label class="f">النوع<select data-f="genre">' + GENRES.map(g => '<option' + (o.genre === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label><label class="f">اللغة<select data-f="lang">' + Object.keys(LANGS).map(k => '<option value="' + k + '"' + (o.lang === k ? ' selected' : '') + '>' + LANGS[k] + '</option>').join('') + '</select></label></div>' +
      '<div class="grid3">' + fld('price', 'السعر (ج.م)', 1) + fld('oldPrice', 'السعر قبل الخصم', 1) + fld('stock', 'الكمية في المخزون', 1) + '</div>' +
      '<div style="display:flex;gap:1.4rem;flex-wrap:wrap"><label class="check"><input type="checkbox" data-f="preorder"' + (o.preorder ? ' checked' : '') + '>متاح بالطلب</label><label class="check"><input type="checkbox" data-f="featured"' + (o.featured ? ' checked' : '') + '>مميز</label><label class="check"><input type="checkbox" data-f="active"' + (o.active ? ' checked' : '') + '>ظاهر في المتجر</label></div>' +
      '<div class="f">لون الغلاف المولّد<div class="swatches">' + PAL.map((c, i) => '<button type="button" class="sw" style="--c1:' + c[0] + ';--c2:' + c[1] + '" data-act="pal" data-i="' + i + '" aria-pressed="' + (Number(o.pal) === i) + '" aria-label="لون ' + (i + 1) + '"></button>').join('') + '</div></div>' +
      '<div class="f">صورة الغلاف' + (o.img ? ' (مرفوعة)' : '') + '<input type="file" id="coverfile" accept="image/png,image/jpeg,image/webp">' + (o.img ? '<button type="button" class="btn sm ghost" data-act="rm-img" style="justify-self:start">إزالة الصورة</button>' : '') + '</div>' +
      (sheet.err ? '<div class="err">' + esc(sheet.err) + '</div>' : '') +
      '<div style="display:flex;gap:.6rem;justify-content:flex-end"><button type="button" class="btn ghost" data-act="sheet-close">إلغاء</button><button type="button" class="btn primary" data-act="p-save"' + (sheet.busy ? ' disabled' : '') + '>' + (sheet.busy ? 'جاري الحفظ…' : 'حفظ') + '</button></div></div></div>';
  }
  function renderSheet() { const sc = $('.sheet', ov); const t = sc ? sc.scrollTop : 0; ov.innerHTML = sheet ? sheetHTML() : ''; const n = $('.sheet', ov); if (n) n.scrollTop = t; }
  function closeSheet() { sheet = null; ov.innerHTML = ''; renderDash(); }

  async function saveProduct() {
    const o = sheet.obj;
    if (!String(o.title).trim()) { sheet.err = 'اكتب اسم المانجا'; return renderSheet(); }
    if (!(Number(o.price) > 0)) { sheet.err = 'اكتب السعر'; return renderSheet(); }
    const row = { title: String(o.title).trim(), author: String(o.author || '').trim(), vol: Number(o.vol) || 0, genre: o.genre, lang: o.lang, price: Number(o.price), old_price: Number(o.oldPrice) || 0, stock: Math.max(0, Number(o.stock) || 0), preorder: !!o.preorder, featured: !!o.featured, active: !!o.active, pal: Number(o.pal) || 0, img_path: o.img || null };
    sheet.busy = true; sheet.err = ''; renderSheet();
    const r = sheet.isNew ? await sb.from('products').insert(row) : await sb.from('products').update(row).eq('id', o.id);
    if (r.error) { sheet.busy = false; sheet.err = 'تعذر الحفظ: ' + r.error.message; return renderSheet(); }
    toast('تم الحفظ. التعديل ظاهر في المتجر فورًا');
    await loadAll(); closeSheet();
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
    if (a === 'logout') { await sb.auth.signOut(); renderLogin(); }
    else if (a === 'reload') { await loadAll(); renderDash(); toast('تم التحديث'); }
    else if (a === 'tab') { tab = v; pq = ''; renderDash(); }
    else if (a === 'p-new') { sheet = { isNew: true, err: '', obj: { title: '', author: '', vol: 1, genre: GENRES[0], lang: 'ar', price: 0, oldPrice: 0, stock: 0, preorder: false, featured: false, active: true, pal: products.length % PAL.length, img: '' } }; renderSheet(); }
    else if (a === 'p-edit') { const p = products.find(x => x.id === id); if (p) { sheet = { isNew: false, err: '', obj: Object.assign({}, p) }; renderSheet(); } }
    else if (a === 'p-del') armDel('p' + id, async () => { const p = products.find(x => x.id === id); const r = await sb.from('products').delete().eq('id', id); if (r.error) toast('تعذر الحذف'); else { if (p && p.img) sb.storage.from('covers').remove([p.img]); await loadAll(); renderDash(); } });
    else if (a === 'pal') { sheet.obj.pal = Number(el.dataset.i); renderSheet(); }
    else if (a === 'rm-img') { sheet.obj.img = ''; renderSheet(); }
    else if (a === 'sheet-close') closeSheet();
    else if (a === 'p-save') saveProduct();
    else if (a === 'o-del') armDel('o' + id, async () => { const r = await sb.from('orders').delete().eq('id', id); if (r.error) toast('تعذر الحذف'); else { await loadAll(); renderDash(); } });
    else if (a === 'r-del') armDel('r' + id, async () => { const r = await sb.from('requests').delete().eq('id', id); if (r.error) toast('تعذر الحذف'); else { await loadAll(); renderDash(); } });
    else if (a === 's-save') {
      const s = sd; const row = { id: 1, announcement: s.announcement || '', whatsapp: s.whatsapp || '', site: s.site || '', ship_fee: Number(s.shipFee) || 0, free_over: Number(s.freeOver) || 0, hero_title: s.heroTitle || '', hero_sub: s.heroSub || '' };
      const r = await sb.from('settings').upsert(row);
      if (r.error) toast('تعذر حفظ الإعدادات'); else { settings = Object.assign({}, s); toast('تم حفظ الإعدادات'); }
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'psearch') { pq = t.value; const r = $('#prows'); if (r) r.innerHTML = pRows(); }
    else if (t.dataset.s != null && sd) sd[t.dataset.s] = t.dataset.num != null ? (t.value === '' ? 0 : Number(t.value)) : t.value;
    else if (t.dataset.f && sheet) { const k = t.dataset.f; sheet.obj[k] = t.type === 'checkbox' ? t.checked : (t.dataset.num != null ? (t.value === '' ? '' : Number(t.value)) : t.value); }
  });
  document.addEventListener('change', async e => {
    const t = e.target;
    if (t.id === 'ostf') { ost = t.value; renderDash(); }
    else if (t.dataset.ost) {
      const r = await sb.rpc('set_order_status', { p_id: Number(t.dataset.ost), p_status: t.value });
      if (r.error) toast('تعذر تحديث الحالة'); else { await loadAll(); renderDash(); }
    }
    else if (t.dataset.rst) { const r = await sb.from('requests').update({ status: t.value }).eq('id', t.dataset.rst); if (r.error) toast('تعذر تحديث الحالة'); else { const x = reqs.find(q => String(q.id) === t.dataset.rst); if (x) x.status = t.value; renderDash(); } }
    else if (t.dataset.rprice) { const r = await sb.from('requests').update({ price: Number(t.value) || 0 }).eq('id', t.dataset.rprice); toast(r.error ? 'تعذر حفظ السعر' : 'تم حفظ السعر'); }
    else if (t.dataset.f && sheet && (t.tagName === 'SELECT' || t.type === 'checkbox')) sheet.obj[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value;
    else if (t.id === 'coverfile' && t.files && t.files[0] && sheet) {
      const f = t.files[0];
      if (f.size > 5 * 1024 * 1024) { toast('الصورة أكبر من 5 ميجا'); return; }
      const ext = (f.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const path = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())) + '.' + ext;
      toast('جاري رفع الصورة…');
      const r = await sb.storage.from('covers').upload(path, f, { contentType: f.type, cacheControl: '31536000' });
      if (r.error) { toast('تعذر رفع الصورة'); return; }
      sheet.obj.img = path; toast('تم رفع الصورة'); renderSheet();
    }
  });
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'loginform') return;
    e.preventDefault();
    const r = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-pass').value });
    if (r.error) return renderLogin('البريد أو كلمة المرور غير صحيحة');
    boot();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet) closeSheet(); });
  boot();
})();
