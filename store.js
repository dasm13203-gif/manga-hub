/* واجهة المتجر: الكتالوج، السلة، الطلب الخاص */
(function () {
  'use strict';
  const { sb, $, esc, fmt, EGP, ls, IC, LANGS, GOVS, mapSettings, mapProduct, coverStyle, coverInner, toast, okPhone, waLink, copyText } = MH;
  const app = $('#app'), ov = $('#overlay');
  const LOGO = 'logo.jpg';
  let S = mapSettings(null), P = [];
  const F = { q: '', lang: 'all', genre: 'all', sort: 'new' };
  let cart = ls.get('mh-cart', {});
  let co = ls.get('mh-co', { name: '', phone: '', gov: '', addr: '', note: '' });
  let drawer = false, step = 'edit', sentText = '', cerr = '', sending = false;
  let rq = { title: '', lang: 'ar', notes: '', name: '', phone: '' }, rqErr = '', rqSent = '', rqBusy = false;

  const prod = id => P.find(p => p.id === id);
  const maxQty = p => p.preorder ? 20 : Math.max(0, p.stock | 0);

  function totals() {
    const L = Object.keys(cart).map(id => ({ p: prod(id), q: cart[id] })).filter(l => l.p && l.q > 0)
      .map(l => ({ p: l.p, q: Math.min(l.q, maxQty(l.p)) })).filter(l => l.q > 0);
    const sub = L.reduce((a, l) => a + l.q * l.p.price, 0);
    const fee = Number(S.shipFee) || 0, fo = Number(S.freeOver) || 0;
    const free = fo > 0 && sub >= fo;
    const ship = sub === 0 ? 0 : (free ? 0 : fee);
    return { L, sub, ship, free, total: sub + ship, count: L.reduce((a, l) => a + l.q, 0) };
  }
  function saveCart() { ls.set('mh-cart', cart); const b = $('#cbadge'); if (b) b.textContent = totals().count; }
  function addToCart(id) {
    const p = prod(id); if (!p) return;
    const cur = cart[id] || 0;
    if (cur >= maxQty(p)) { toast('وصلت للكمية المتاحة من هذا المجلد'); return; }
    cart[id] = cur + 1; saveCart(); toast('تمت الإضافة للسلة');
  }

  /* ---------- الصفحة ---------- */
  const feat = (i, t, s) => '<div class="feat">' + i + '<div><b>' + t + '</b><span>' + s + '</span></div></div>';
  function render() {
    const words = String(S.heroTitle || '').trim().split(/\s+/); const last = words.pop() || '';
    const h1 = esc(words.join(' ')) + (words.length ? ' ' : '') + '<em>' + esc(last) + '</em>';
    app.innerHTML =
      (S.announcement ? '<div class="ann"><div class="wrap">' + esc(S.announcement) + '</div></div>' : '') +
      '<header class="hdr"><div class="wrap">' +
      '<a class="brand" href="#top"><img src="' + LOGO + '" alt=""><b>مانجا <i>هب</i></b></a>' +
      '<nav class="nav"><a href="#catalog">المجلدات</a><a href="#request">طلب خاص</a><a href="#contact">تواصل</a></nav><span class="sp"></span>' +
      '<button class="btn cartbtn" data-act="cart" type="button">' + IC.cart + '<span>السلة</span><span class="badge num" id="cbadge">0</span></button>' +
      '</div></header>' +
      '<section class="hero" id="top"><div class="wrap"><div>' +
      '<div class="eyebrow">MANGA HUB · مانجا هب</div><h1>' + h1 + '</h1>' +
      '<p class="lead">' + esc(S.heroSub || '') + '</p>' +
      '<div class="cta"><a class="btn primary" href="#catalog">تصفح المجلدات</a><a class="btn" href="#request">اطلب أي مانجا</a></div>' +
      '<div class="langs"><span>عربي</span><span>ENGLISH</span><span>FRANÇAIS</span></div>' +
      '</div><div class="emblem"><img src="' + LOGO + '" alt="شعار مانجا هب"><div class="jp" aria-hidden="true">漫画</div><div class="jp2" aria-hidden="true">オタク</div></div></div></section>' +
      '<section class="feats"><div class="wrap">' +
      feat(IC.truck, 'شحن سريع', 'جميع المحافظات') + feat(IC.shield, 'تغليف آمن', 'حماية كاملة') + feat(IC.badge, 'منتجات أصلية', '100% جودة') + feat(IC.bag, 'طلبات خاصة', 'متاح بالطلب') +
      '</div></section>' +
      '<section class="sec" id="catalog"><div class="wrap"><div class="sec-head"><h2>المجلدات</h2><span class="muted" id="rescount"></span></div></div>' +
      '<div class="filters"><div class="wrap">' +
      '<div class="frow top"><input type="search" id="q" placeholder="ابحث باسم المانجا أو المؤلف" aria-label="بحث" value="' + esc(F.q) + '"><select id="sort" aria-label="الترتيب"><option value="new">الأحدث</option><option value="pa">السعر: الأقل أولاً</option><option value="pd">السعر: الأعلى أولاً</option></select></div>' +
      '<div class="frow" id="langchips"></div><div class="frow" id="genrechips"></div>' +
      '</div></div><div class="wrap"><div class="products" id="grid"></div></div></section>' +
      '<section class="sec req" id="request"><div class="wrap box"><div>' +
      '<div class="eyebrow">SPECIAL ORDER</div><h2>اطلب أي مانجا</h2>' +
      '<p class="muted" style="margin-top:.8rem">مش لاقي العنوان اللي بتدور عليه؟ ابعتلنا اسمه ونرد عليك بالسعر وموعد التوفير.</p>' +
      '<ul><li>أي عنوان وأي مجلد، بالعربي أو الإنجليزي أو الفرنسي</li><li>بنأكد معاك السعر قبل ما نبدأ</li><li>التواصل كله على واتساب</li></ul>' +
      '</div><form class="panel" id="rqform" novalidate>' + rqFormHTML() + '</form></div></section>' +
      '<footer class="foot" id="contact"><div class="wrap"><div class="copy"><b>مانجا هب</b><span>· وجهتك لعالم المانجا</span></div>' +
      '<div class="copy"><span>واتساب:</span><a class="num" dir="ltr" href="' + esc(waLink(S, 'أهلاً مانجا هب')) + '" target="_blank" rel="noopener">' + esc(S.whatsapp || '') + '</a><span>·</span><span class="num" dir="ltr">' + esc(S.site || '') + '</span></div></div></footer>';
    renderChips(); renderGrid(); saveCart();
    const so = $('#sort'); if (so) so.value = F.sort;
  }
  function renderChips() {
    const lc = $('#langchips'), gc = $('#genrechips'); if (!lc) return;
    const langs = [['all', 'كل اللغات']].concat(Object.keys(LANGS).filter(k => P.some(p => p.lang === k)).map(k => [k, LANGS[k]]));
    lc.innerHTML = langs.map(l => '<button type="button" class="chip" data-act="lang" data-v="' + l[0] + '" aria-pressed="' + (F.lang === l[0]) + '">' + l[1] + '</button>').join('');
    const gs = [...new Set(P.map(p => p.genre).filter(Boolean))];
    gc.innerHTML = ['all'].concat(gs).map(g => '<button type="button" class="chip" data-act="genre" data-v="' + esc(g) + '" aria-pressed="' + (F.genre === g) + '">' + (g === 'all' ? 'كل الأنواع' : esc(g)) + '</button>').join('');
  }
  function renderGrid() {
    const g = $('#grid'); if (!g) return;
    let L = P.filter(p => (F.lang === 'all' || p.lang === F.lang) && (F.genre === 'all' || p.genre === F.genre));
    const q = F.q.trim().toLowerCase();
    if (q) L = L.filter(p => (p.title + ' ' + (p.author || '')).toLowerCase().includes(q));
    if (F.sort === 'pa') L = L.slice().sort((a, b) => a.price - b.price);
    if (F.sort === 'pd') L = L.slice().sort((a, b) => b.price - a.price);
    const rc = $('#rescount'); if (rc) rc.textContent = L.length + ' مجلد';
    g.innerHTML = L.length ? L.map(card).join('') : '<div class="empty">' + (P.length ? 'مفيش نتائج بالبحث ده. جرّب كلمة تانية أو اطلب العنوان من قسم الطلب الخاص.' : 'الكتالوج هيتحدّث قريب. تقدر تطلب أي عنوان من قسم الطلب الخاص.') + '</div>';
  }
  function card(p) {
    const out = !p.preorder && (p.stock | 0) <= 0;
    const tags = (p.preorder ? '<span class="tag">متاح بالطلب</span>' : '') + (out ? '<span class="tag out">نفد</span>' : '') +
      (p.oldPrice > p.price ? '<span class="tag sale">خصم ' + Math.round((1 - p.price / p.oldPrice) * 100) + '%</span>' : '') +
      (!out && !p.preorder && p.stock > 0 && p.stock <= 3 ? '<span class="tag">آخر ' + p.stock + '</span>' : '');
    return '<article class="card"><div class="cover" style="' + coverStyle(p) + '">' + coverInner(p) + '<div class="tags">' + tags + '</div></div>' +
      '<div class="cinfo"><h3>' + esc(p.title) + (p.vol ? ' <span class="muted num" style="font-weight:600">#' + esc(p.vol) + '</span>' : '') + '</h3>' +
      '<div class="au">' + esc(p.author || '') + (p.lang ? ' · ' + LANGS[p.lang] : '') + '</div><div></div>' +
      '<div><div class="price"><b>' + EGP(p.price) + '</b>' + (p.oldPrice > p.price ? '<s>' + fmt(p.oldPrice) + '</s>' : '') + '</div>' +
      '<button type="button" class="btn primary" data-act="add" data-id="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + (out ? 'غير متوفر' : (p.preorder ? 'اطلبه الآن' : 'أضف للسلة')) + '</button></div></div></article>';
  }

  /* ---------- الطلب الخاص ---------- */
  function rqFormHTML() {
    if (rqSent) return '<div class="sent"><div class="ok">' + IC.check + '</div><h3>وصلنا طلبك</h3><p class="muted">هنرد عليك بالسعر وموعد التوفير. تقدر تسرّع الرد بإرسال نفس الطلب على واتساب.</p>' +
      '<a class="btn primary" href="' + esc(waLink(S, rqSent)) + '" target="_blank" rel="noopener">إرسال على واتساب</a>' +
      '<button type="button" class="btn ghost" data-act="rqnew">طلب عنوان آخر</button></div>';
    return '<label class="f">اسم المانجا<input id="rq-title" data-rq="title" value="' + esc(rq.title) + '" placeholder="مثال: Vinland Saga" maxlength="150"></label>' +
      '<div class="grid2"><label class="f">اللغة<select id="rq-lang" data-rq="lang">' + Object.keys(LANGS).map(k => '<option value="' + k + '"' + (rq.lang === k ? ' selected' : '') + '>' + LANGS[k] + '</option>').join('') + '</select></label>' +
      '<label class="f">رقم المجلد أو ملاحظات<input id="rq-notes" data-rq="notes" value="' + esc(rq.notes) + '" placeholder="المجلد 1 إلى 5" maxlength="300"></label></div>' +
      '<div class="grid2"><label class="f">اسمك<input id="rq-name" data-rq="name" value="' + esc(rq.name) + '" autocomplete="name" maxlength="100"></label>' +
      '<label class="f">رقم الموبايل<input id="rq-phone" data-rq="phone" value="' + esc(rq.phone) + '" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx"></label></div>' +
      (rqErr ? '<div class="err">' + esc(rqErr) + '</div>' : '') +
      '<button class="btn primary" type="submit"' + (rqBusy ? ' disabled' : '') + '>' + (rqBusy ? 'جاري الإرسال…' : 'إرسال الطلب') + '</button>';
  }
  function rqFail(m) { rqErr = m; rqBusy = false; $('#rqform').innerHTML = rqFormHTML(); }
  async function rqSubmit() {
    if (rqBusy) return;
    if (!rq.title.trim()) return rqFail('اكتب اسم المانجا');
    if (!rq.name.trim()) return rqFail('اكتب اسمك');
    if (!okPhone(rq.phone)) return rqFail('رقم الموبايل غير صحيح');
    rqErr = ''; rqBusy = true; $('#rqform').innerHTML = rqFormHTML();
    const { error } = await sb.rpc('place_request', { p_title: rq.title.trim(), p_lang: rq.lang, p_notes: rq.notes.trim(), p_customer: rq.name.trim(), p_phone: rq.phone.trim() });
    if (error) return rqFail('تعذر إرسال الطلب. جرّب تاني أو كلمنا على واتساب');
    rqBusy = false;
    rqSent = 'طلب مانجا خاص\nالعنوان: ' + rq.title.trim() + '\nاللغة: ' + LANGS[rq.lang] + (rq.notes.trim() ? '\nالمجلد/ملاحظات: ' + rq.notes.trim() : '') + '\nالاسم: ' + rq.name.trim() + '\nالموبايل: ' + rq.phone.trim();
    $('#rqform').innerHTML = rqFormHTML();
  }

  /* ---------- السلة ---------- */
  function renderDrawer() {
    if (!drawer) { ov.innerHTML = ''; return; }
    const T = totals(); let body = '', foot = '';
    if (step === 'sent') {
      body = '<div class="sent"><div class="ok">' + IC.check + '</div><h3>تم تسجيل طلبك رقم ' + esc(sentText.id) + '</h3><p class="muted">الدفع عند الاستلام. ابعت تفاصيل الطلب على واتساب عشان نأكد معاك الشحن والمواعيد.</p>' +
        '<a class="btn primary" href="' + esc(waLink(S, sentText.msg)) + '" target="_blank" rel="noopener">تأكيد الطلب على واتساب</a>' +
        '<button type="button" class="btn ghost" data-act="close">إغلاق</button></div>';
    } else if (!T.L.length) {
      body = '<div class="empty" style="grid-column:auto">السلة فاضية. ضيف مجلدات من الكتالوج.</div>';
    } else {
      body = T.L.map(l => '<div class="line"><div class="th" style="' + coverStyle(l.p) + '">' + coverInner(l.p) + '</div><div style="min-width:0"><b>' + esc(l.p.title) + (l.p.vol ? ' #' + esc(l.p.vol) : '') + '</b><div class="muted num" style="font-size:.85rem">' + EGP(l.p.price) + (l.p.preorder ? ' · بالطلب' : '') + '</div>' +
        '<div class="qty" style="margin-top:.3rem"><button type="button" data-act="dec" data-id="' + esc(l.p.id) + '" aria-label="إنقاص">−</button><span>' + l.q + '</span><button type="button" data-act="inc" data-id="' + esc(l.p.id) + '" aria-label="زيادة">+</button></div></div>' +
        '<button type="button" class="btn sm ghost" data-act="rm" data-id="' + esc(l.p.id) + '">حذف</button></div>').join('') +
        '<div class="panel" style="padding:.9rem">' +
        '<label class="f">الاسم<input id="c-name" data-co="name" value="' + esc(co.name) + '" autocomplete="name" maxlength="100"></label>' +
        '<label class="f">رقم الموبايل<input id="c-phone" data-co="phone" value="' + esc(co.phone) + '" inputmode="tel" dir="ltr" autocomplete="tel" placeholder="01xxxxxxxxx"></label>' +
        '<label class="f">المحافظة<select id="c-gov" data-co="gov"><option value="">اختر المحافظة</option>' + GOVS.map(g => '<option' + (co.gov === g ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></label>' +
        '<label class="f">العنوان بالتفصيل<textarea id="c-addr" data-co="addr" rows="2" maxlength="300">' + esc(co.addr) + '</textarea></label>' +
        '<label class="f">ملاحظات (اختياري)<input id="c-note" data-co="note" value="' + esc(co.note) + '" maxlength="300"></label></div>';
      foot = '<div class="sum"><span>المجموع الفرعي</span><span class="num">' + EGP(T.sub) + '</span></div>' +
        '<div class="sum"><span>الشحن' + (T.free ? ' (مجاني)' : '') + '</span><span class="num">' + (T.free ? '0 ج.م' : EGP(T.ship)) + '</span></div>' +
        (!T.free && Number(S.freeOver) > 0 ? '<div class="hint">الشحن مجاني للطلبات من ' + EGP(S.freeOver) + '</div>' : '') +
        '<div class="sum tot"><span>الإجمالي (الدفع عند الاستلام)</span><span class="num">' + EGP(T.total) + '</span></div>' +
        (cerr ? '<div class="err">' + esc(cerr) + '</div>' : '') +
        '<button type="button" class="btn primary" data-act="checkout"' + (sending ? ' disabled' : '') + '>' + (sending ? 'جاري إرسال الطلب…' : 'تأكيد الطلب') + '</button>';
    }
    ov.innerHTML = '<div class="scrim on" data-act="close"></div><aside class="drawer on" role="dialog" aria-modal="true" aria-label="سلة الطلبات"><header><h3>سلة الطلبات</h3><button type="button" class="btn sm ghost" data-act="close">إغلاق</button></header><div class="dbody">' + body + '</div>' + (foot ? '<div class="dfoot">' + foot + '</div>' : '') + '</aside>';
  }
  async function loadProducts() {
    const r = await sb.from('products').select('*').eq('active', true).order('created_at', { ascending: false });
    if (!r.error) P = (r.data || []).map(mapProduct);
  }
  async function checkout() {
    if (sending) return;
    const T = totals();
    if (!T.L.length) { cerr = 'السلة فاضية'; return renderDrawer(); }
    if (!co.name.trim()) cerr = 'اكتب اسمك';
    else if (!okPhone(co.phone)) cerr = 'رقم الموبايل غير صحيح';
    else if (!co.gov) cerr = 'اختر المحافظة';
    else if (!co.addr.trim()) cerr = 'اكتب العنوان بالتفصيل';
    else cerr = '';
    if (cerr) return renderDrawer();
    ls.set('mh-co', co);
    sending = true; renderDrawer();
    const { data, error } = await sb.rpc('place_order', {
      p_customer: co.name.trim(), p_phone: co.phone.trim(), p_gov: co.gov, p_address: co.addr.trim(), p_note: co.note.trim(),
      p_items: T.L.map(l => ({ id: l.p.id, qty: l.q }))
    });
    sending = false;
    if (error) {
      const m = String(error.message || '');
      if (m.includes('out_of_stock')) { cerr = 'الكمية المتاحة من «' + m.split('out_of_stock:')[1].trim() + '» أقل من المطلوب. اتحدّث المخزون، راجع السلة.'; await loadProducts(); renderGrid(); }
      else if (m.includes('unavailable')) { cerr = 'في كتاب في السلة بقى غير متاح. راجع السلة.'; await loadProducts(); renderGrid(); }
      else cerr = 'تعذر إرسال الطلب. جرّب تاني أو كلمنا على واتساب';
      return renderDrawer();
    }
    const items = data.items.map(i => '- ' + i.title + ' × ' + i.qty + ' = ' + fmt(i.qty * i.price) + ' ج.م' + (i.preorder ? ' (بالطلب)' : '')).join('\n');
    const msg = 'طلب جديد من مانجا هب رقم ' + data.id + '\n\nالاسم: ' + co.name.trim() + '\nالموبايل: ' + co.phone.trim() + '\nالمحافظة: ' + co.gov + '\nالعنوان: ' + co.addr.trim() +
      '\n\nالطلب:\n' + items + '\n\nالمجموع الفرعي: ' + fmt(data.subtotal) + ' ج.م\nالشحن: ' + (Number(data.shipping) === 0 ? 'مجاني' : fmt(data.shipping) + ' ج.م') + '\nالإجمالي: ' + fmt(data.total) + ' ج.م\nالدفع عند الاستلام' + (co.note.trim() ? '\n\nملاحظات: ' + co.note.trim() : '');
    sentText = { id: data.id, msg }; cart = {}; saveCart(); step = 'sent'; await loadProducts(); renderGrid(); renderChips(); renderDrawer();
  }

  /* ---------- الأحداث ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const a = el.dataset.act, id = el.dataset.id, v = el.dataset.v;
    if (a === 'cart') { drawer = true; step = 'edit'; cerr = ''; renderDrawer(); }
    else if (a === 'close') { drawer = false; renderDrawer(); }
    else if (a === 'add') addToCart(id);
    else if (a === 'inc') { const p = prod(id); if (p && (cart[id] || 0) < maxQty(p)) { cart[id] = (cart[id] || 0) + 1; saveCart(); renderDrawer(); } else toast('وصلت للكمية المتاحة'); }
    else if (a === 'dec') { cart[id] = Math.max(0, (cart[id] || 0) - 1); if (!cart[id]) delete cart[id]; saveCart(); renderDrawer(); }
    else if (a === 'rm') { delete cart[id]; saveCart(); renderDrawer(); }
    else if (a === 'checkout') checkout();
    else if (a === 'rqnew') { rqSent = ''; rq = { title: '', lang: 'ar', notes: '', name: rq.name, phone: rq.phone }; $('#rqform').innerHTML = rqFormHTML(); }
    else if (a === 'lang') { F.lang = v; renderChips(); renderGrid(); }
    else if (a === 'genre') { F.genre = v; renderChips(); renderGrid(); }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'q') { F.q = t.value; renderGrid(); }
    else if (t.dataset.co != null) co[t.dataset.co] = t.value;
    else if (t.dataset.rq != null) rq[t.dataset.rq] = t.value;
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'sort') { F.sort = t.value; renderGrid(); }
    else if (t.dataset.co != null) co[t.dataset.co] = t.value;
    else if (t.dataset.rq != null) rq[t.dataset.rq] = t.value;
  });
  document.addEventListener('submit', e => { if (e.target.id === 'rqform') { e.preventDefault(); rqSubmit(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer) { drawer = false; renderDrawer(); } });

  /* ---------- التشغيل ---------- */
  (async function boot() {
    if (!sb) { app.innerHTML = MH.notConfigured(); return; }
    const [pr, st] = await Promise.all([
      sb.from('products').select('*').eq('active', true).order('created_at', { ascending: false }),
      sb.from('settings').select('*').eq('id', 1).maybeSingle()
    ]);
    if (!pr.error) P = (pr.data || []).map(mapProduct);
    S = mapSettings(st.data);
    render();
    const h = location.hash.replace('#', ''); if (h) { const t = document.getElementById(h); if (t) t.scrollIntoView(); }
  })();
})();
