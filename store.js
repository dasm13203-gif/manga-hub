/* واجهة المتجر: الكتالوج، السلة، الطلب الخاص */
(function () {
  'use strict';
  const { sb, $, esc, fmt, EGP, ls, IC, LANGS, GOVS, mapSettings, mapProduct, coverStyle, coverInner, toast, okPhone, waLink, copyText } = MH;
  const app = $('#app'), ov = $('#overlay');
  const LOGO = 'logo.jpg';
  let S = mapSettings(null), P = [], R = {};
  const F = { q: '', lang: 'all', genre: 'all', sort: 'feat' };
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
    const fo = Number(S.freeOver) || 0;
    const free = fo > 0 && sub >= fo;
    const rate = co.gov ? R[co.gov] : null;
    const base = rate ? Number(rate.fee) : (Number(S.shipFee) || 0);
    const ship = sub === 0 ? 0 : (free ? 0 : (co.gov ? base : 0));
    return { L, sub, ship, free, pending: sub > 0 && !free && !co.gov, total: sub + ship, count: L.reduce((a, l) => a + l.q, 0) };
  }
  function saveCart() {
    ls.set('mh-cart', cart);
    const T = totals();
    const b = $('#cbadge'); if (b) b.textContent = T.count;
    const bar = $('#cartbar'); if (bar) { bar.hidden = !T.count; $('#cbcount').textContent = T.count; $('#cbtotal').textContent = EGP(T.sub); }
    document.body.classList.toggle('hascart', T.count > 0);
  }
  function addToCart(id) {
    const p = prod(id); if (!p) return;
    const cur = cart[id] || 0;
    if (cur >= maxQty(p)) { toast('وصلت للكمية المتاحة من هذا المجلد'); return; }
    cart[id] = cur + 1; saveCart(); toast('تمت الإضافة للسلة');
  }

  /* ---------- الصفحة ---------- */
  const trust = (i, t) => '<li>' + i + '<span>' + t + '</span></li>';
  function render() {
    const words = String(S.heroTitle || '').trim().split(/\s+/); const last = words.pop() || '';
    const h1 = esc(words.join(' ')) + (words.length ? ' ' : '') + '<em>' + esc(last) + '</em>';
    app.innerHTML =
      (S.announcement ? '<div class="ann"><div class="wrap">' + esc(S.announcement) + '</div></div>' : '') +
      '<header class="hdr"><div class="wrap">' +
      '<a class="brand" href="#top"><img src="' + LOGO + '" alt=""><b>مانجا <i>هب</i></b></a>' +
      '<nav class="nav"><a href="#catalog">المجلدات</a><a href="#request">طلب خاص</a><a href="#faq">أسئلة</a><a href="#contact">تواصل</a></nav><span class="sp"></span>' +
      '<button class="btn cartbtn" data-act="cart" type="button">' + IC.cart + '<span>السلة</span><span class="badge num" id="cbadge">0</span></button>' +
      '</div></header>' +
      '<section class="hero" id="top"><div class="wrap heroin"><div class="herotxt">' +
      '<div class="eyebrow">MANGA HUB</div><h1>' + h1 + '</h1>' +
      '<p class="lead">' + esc(S.heroSub || '') + '</p>' +
      '<div class="cta"><a class="btn primary" href="#catalog">تصفح المجلدات</a><a class="btn ghost" href="#request">اطلب أي مانجا</a></div>' +
      '</div><div class="emblem"><img src="' + LOGO + '" alt="شعار مانجا هب"></div></div></section>' +
      '<div class="wrap"><ul class="trust">' + trust(IC.truck, 'شحن ' + S.carrier + ' لجميع المحافظات') + trust(IC.shield, 'تغليف آمن') + trust(IC.badge, 'منتجات أصلية 100%') + trust(IC.bag, 'اطلب أي مانجا بالطلب') + '</ul></div>' +
      '<section class="sec catalog" id="catalog"><div class="wrap">' +
      '<div class="sec-head"><h2>المجلدات</h2><span class="muted" id="rescount"></span></div>' +
      '<div class="toolbar"><input type="search" id="q" placeholder="ابحث باسم المانجا أو المؤلف" aria-label="بحث" value="' + esc(F.q) + '">' +
      '<div class="chips" id="langchips"></div><select id="genre" aria-label="النوع"></select>' +
      '<select id="sort" aria-label="الترتيب"><option value="feat">الأبرز</option><option value="new">الأحدث</option><option value="pa">السعر: الأقل أولاً</option><option value="pd">السعر: الأعلى أولاً</option></select></div>' +
      '<div class="products" id="grid"></div></div></section>' +
      '<section class="sec req" id="request"><div class="wrap box"><div>' +
      '<div class="eyebrow">SPECIAL ORDER</div><h2>اطلب أي مانجا</h2>' +
      '<p class="muted" style="margin-top:.8rem;max-width:30rem">مش لاقي العنوان اللي بتدور عليه؟ ابعتلنا اسمه ونرد عليك بالسعر وموعد التوفير، بالعربي أو الإنجليزي أو الفرنسي.</p>' +
      '</div><form class="panel" id="rqform" novalidate>' + rqFormHTML() + '</form></div></section>' +
      faqHTML() + footerHTML() +
      '<a class="fab" href="' + esc(waLink(S, 'أهلاً مانجا هب')) + '" target="_blank" rel="noopener" aria-label="تواصل على واتساب">' + IC.wa + '</a>' +
      '<div class="cartbar" id="cartbar" hidden><button type="button" data-act="cart"><span>' + IC.cart + ' <b id="cbcount">0</b> مجلد في السلة</span><span class="num" id="cbtotal"></span></button></div>';
    renderChips(); renderGrid(); saveCart();
    const so = $('#sort'); if (so) so.value = F.sort;
  }
  function renderChips() {
    const lc = $('#langchips'), gs = $('#genre'); if (!lc) return;
    const langs = [['all', 'الكل']].concat(Object.keys(LANGS).filter(k => P.some(p => p.lang === k)).map(k => [k, LANGS[k]]));
    lc.innerHTML = langs.map(l => '<button type="button" class="chip" data-act="lang" data-v="' + l[0] + '" aria-pressed="' + (F.lang === l[0]) + '">' + l[1] + '</button>').join('');
    const genres = [...new Set(P.map(p => p.genre).filter(Boolean))];
    gs.innerHTML = '<option value="all">كل الأنواع</option>' + genres.map(g => '<option value="' + esc(g) + '">' + esc(g) + '</option>').join('');
    gs.value = genres.includes(F.genre) ? F.genre : 'all';
  }
  function renderGrid() {
    const g = $('#grid'); if (!g) return;
    let L = P.filter(p => (F.lang === 'all' || p.lang === F.lang) && (F.genre === 'all' || p.genre === F.genre));
    const q = F.q.trim().toLowerCase();
    if (q) L = L.filter(p => (p.title + ' ' + (p.author || '')).toLowerCase().includes(q));
    if (F.sort === 'feat') L = L.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
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
    return '<article class="card"><div class="cover" data-act="view" data-id="' + esc(p.id) + '" style="' + coverStyle(p) + '">' + coverInner(p) + '<div class="tags">' + tags + '</div><button type="button" class="qv" data-act="view" data-id="' + esc(p.id) + '">عرض سريع</button></div>' +
      '<div class="cinfo"><h3 data-act="view" data-id="' + esc(p.id) + '">' + esc(p.title) + (p.vol ? ' <span class="muted num" style="font-weight:600">#' + esc(p.vol) + '</span>' : '') + '</h3>' +
      '<div class="au">' + esc(p.author || '') + (p.lang ? ' · ' + LANGS[p.lang] : '') + '</div><div></div>' +
      '<div><div class="price"><b>' + EGP(p.price) + '</b>' + (p.oldPrice > p.price ? '<s>' + fmt(p.oldPrice) + '</s>' : '') + '</div>' +
      '<button type="button" class="btn primary" data-act="add" data-id="' + esc(p.id) + '"' + (out ? ' disabled' : '') + '>' + (out ? 'غير متوفر' : (p.preorder ? 'اطلبه الآن' : 'أضف للسلة')) + '</button></div></div></article>';
  }

  /* ---------- الطلب الخاص ---------- */
  function rqFormHTML() {
    if (rqSent) return '<div class="sent"><div class="ok">' + IC.check + '</div><h3>وصلنا طلبك</h3><p class="muted">هنرد عليك بالسعر وموعد التوفير. تقدر تسرّع الرد بإرسال نفس الطلب على واتساب.</p>' +
      '<a class="btn primary" href="' + esc(waLink(S, rqSent)) + '" target="_blank" rel="noopener">إرسال على واتساب</a>' +
      '<button type="button" class="btn ghost" data-act="rqnew">طلب عنوان آخر</button></div>';
    return '<label class="f">اسم المانجا<input id="rq-title" data-rq="title" value="' + esc(rq.title) + '" placeholder="Vinland Saga" maxlength="150"></label>' +
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


  /* ---------- أقسام إضافية ---------- */
  function hotHTML() {
    const L = P.filter(p => p.featured);
    if (!L.length) return '';
    return '<section class="sec hot" id="hot"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">TOP PICKS</div><h2>الأكثر طلبًا</h2></div></div></div>' +
      '<div class="wrap"><div class="hotrow">' + L.map(card).join('') + '</div></div></section>';
  }
  function stepsHTML() {
    const st = [['اختار مجلداتك', 'تصفح الكتالوج وضيف اللي عجبك للسلة.'], ['أكّد الطلب', 'اكتب بياناتك وعنوانك، والطلب بيتسجل عندنا فورًا.'], ['نأكد على واتساب', 'بنكلمك نأكد الشحن، وبتدفع عند الاستلام.']];
    return '<section class="sec steps" id="how"><div class="wrap"><div class="sec-head"><div><div class="eyebrow">HOW IT WORKS</div><h2>إزاي تطلب</h2></div></div>' +
      '<ol class="stepgrid">' + st.map((x, i) => '<li><span class="sn num">' + (i + 1) + '</span><div><b>' + x[0] + '</b><p class="muted">' + x[1] + '</p></div></li>').join('') + '</ol></div></section>';
  }
  function faqHTML() {
    const fo = Number(S.freeOver) || 0;
    const q = [
      ['بتشحنوا لأنهي محافظات؟', 'بنشحن لجميع محافظات مصر عن طريق ' + S.carrier + '. سعر الشحن بيختلف حسب المحافظة وبيظهر في السلة قبل ما تأكد الطلب' + (fo > 0 ? '، والشحن مجاني للطلبات من ' + EGP(fo) + '.' : '.')],
      ['الدفع إزاي؟', 'الدفع عند الاستلام.'],
      ['المنتجات أصلية؟', 'أيوه، كل منتجاتنا أصلية 100% جودة وبتتغلّف بحماية كاملة قبل الشحن.'],
      ['مش لاقي العنوان اللي بدور عليه؟', 'اطلبه من قسم «اطلب أي مانجا». بنرد عليك بالسعر وموعد التوفير قبل ما نبدأ.']
    ];
    return '<section class="sec faq" id="faq"><div class="wrap narrow"><div class="sec-head"><div><div class="eyebrow">FAQ</div><h2>أسئلة شائعة</h2></div></div>' +
      q.map(x => '<details><summary>' + esc(x[0]) + '</summary><p class="muted">' + esc(x[1]) + '</p></details>').join('') + '</div></section>';
  }
  function footerHTML() {
    return '<footer class="foot" id="contact"><div class="wrap fmin">' +
      '<a class="brand" href="#top"><img src="' + LOGO + '" alt=""><b>مانجا <i>هب</i></b></a>' +
      '<nav class="flinks inline"><a href="#catalog">المجلدات</a><a href="#request">طلب خاص</a><a href="#faq">أسئلة شائعة</a></nav>' +
      '<a class="btn sm" href="' + esc(waLink(S, 'أهلاً مانجا هب')) + '" target="_blank" rel="noopener">' + IC.wa + 'واتساب</a></div>' +
      '<div class="wrap fbottom"><span>© ' + new Date().getFullYear() + ' مانجا هب · وجهتك لعالم المانجا</span><span class="num" dir="ltr">' + esc(S.whatsapp || '') + (S.site ? ' · ' + esc(S.site) : '') + '</span></div></footer>';
  }

  /* ---------- عرض سريع للمنتج ---------- */
  let qv = null;
  const mo = document.createElement('div'); mo.id = 'modal'; document.body.appendChild(mo);
  function renderModal() {
    if (!qv) { mo.innerHTML = ''; return; }
    const p = prod(qv.id); if (!p) { qv = null; mo.innerHTML = ''; return; }
    const out = !p.preorder && (p.stock | 0) <= 0, max = maxQty(p);
    const stock = p.preorder ? '<span class="pill info">متاح بالطلب</span>' : (out ? '<span class="pill bad">نفد</span>' : (p.stock <= 3 ? '<span class="pill warn">آخر ' + p.stock + ' نسخ</span>' : '<span class="pill ok">متوفر</span>'));
    mo.innerHTML = '<div class="scrim on" data-act="vclose"></div><div class="qmodal" role="dialog" aria-modal="true" aria-label="' + esc(p.title) + '">' +
      '<button type="button" class="btn sm ghost qx" data-act="vclose" aria-label="إغلاق">إغلاق</button>' +
      '<div class="qcover cover" style="' + coverStyle(p) + '">' + coverInner(p) + '</div>' +
      '<div class="qinfo"><div class="eyebrow">' + esc(LANGS[p.lang] || '') + (p.genre ? ' · ' + esc(p.genre) : '') + '</div>' +
      '<h2>' + esc(p.title) + '</h2><p class="muted">' + esc(p.author || '') + (p.vol ? ' · المجلد ' + esc(p.vol) : '') + '</p>' +
      '<div class="price big"><b>' + EGP(p.price) + '</b>' + (p.oldPrice > p.price ? '<s>' + fmt(p.oldPrice) + '</s>' : '') + '</div>' + '<div>' + stock + '</div>' +
      '<div class="qrow"><div class="qty"><button type="button" data-act="vq-" aria-label="إنقاص">−</button><span>' + qv.q + '</span><button type="button" data-act="vq+" aria-label="زيادة">+</button></div>' +
      '<button type="button" class="btn primary" data-act="vadd"' + (out ? ' disabled' : '') + '>' + (out ? 'غير متوفر' : 'أضف للسلة') + '</button></div>' +
      '<a class="btn ghost" href="' + esc(waLink(S, 'أهلاً مانجا هب، عايز أسأل عن: ' + p.title + (p.vol ? ' المجلد ' + p.vol : ''))) + '" target="_blank" rel="noopener">' + IC.wa + 'اسأل عن المجلد على واتساب</a></div></div>';
  }

  /* ---------- السلة ---------- */
  function govList() {
    if (Object.keys(R).length) return Object.values(R).filter(r => r.active).sort((a, b) => a.sort - b.sort);
    return GOVS.map(g => ({ gov: g, fee: Number(S.shipFee) || 0, sort: 0 }));
  }
  function renderDrawer() {
    if (!drawer) { ov.innerHTML = ''; return; }
    if (co.gov && Object.keys(R).length && !(R[co.gov] && R[co.gov].active)) co.gov = '';
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
        '<label class="f">المحافظة<select id="c-gov" data-co="gov"><option value="">اختر المحافظة</option>' + govList().map(g => '<option value="' + esc(g.gov) + '"' + (co.gov === g.gov ? ' selected' : '') + '>' + esc(g.gov) + ' · ' + fmt(g.fee) + ' ج.م</option>').join('') + '</select></label>' +
        '<label class="f">العنوان بالتفصيل<textarea id="c-addr" data-co="addr" rows="2" maxlength="300">' + esc(co.addr) + '</textarea></label>' +
        '<label class="f">ملاحظات (اختياري)<input id="c-note" data-co="note" value="' + esc(co.note) + '" maxlength="300"></label></div>';
      foot = '<div class="sum"><span>المجموع الفرعي</span><span class="num">' + EGP(T.sub) + '</span></div>' +
        '<div class="sum"><span>الشحن (' + esc(S.carrier) + ')' + (T.free ? ' · مجاني' : '') + '</span><span class="num">' + (T.free ? '0 ج.م' : (T.pending ? 'يتحدد بالمحافظة' : EGP(T.ship))) + '</span></div>' +
        (!T.free && Number(S.freeOver) > 0 ? '<div class="hint">الشحن مجاني للطلبات من ' + EGP(S.freeOver) + '</div>' : '') +
        (T.pending ? '<div class="hint">اختار المحافظة عشان يتحسب سعر الشحن.</div>' : '') + '<div class="sum tot"><span>' + (T.pending ? 'الإجمالي بدون الشحن' : 'الإجمالي (الدفع عند الاستلام)') + '</span><span class="num">' + EGP(T.total) + '</span></div>' +
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
      else if (m.includes('gov_unavailable')) { cerr = 'الشحن غير متاح لهذه المحافظة حاليًا. كلمنا على واتساب.'; }
      else if (m.includes('unavailable')) { cerr = 'في كتاب في السلة بقى غير متاح. راجع السلة.'; await loadProducts(); renderGrid(); }
      else cerr = 'تعذر إرسال الطلب. جرّب تاني أو كلمنا على واتساب';
      return renderDrawer();
    }
    const items = data.items.map(i => '- ' + i.title + ' × ' + i.qty + ' = ' + fmt(i.qty * i.price) + ' ج.م' + (i.preorder ? ' (بالطلب)' : '')).join('\n');
    const msg = 'طلب جديد من مانجا هب رقم ' + data.id + '\n\nالاسم: ' + co.name.trim() + '\nالموبايل: ' + co.phone.trim() + '\nالمحافظة: ' + co.gov + '\nالعنوان: ' + co.addr.trim() +
      '\n\nالطلب:\n' + items + '\n\nالمجموع الفرعي: ' + fmt(data.subtotal) + ' ج.م\nالشحن (' + S.carrier + '): ' + (Number(data.shipping) === 0 ? 'مجاني' : fmt(data.shipping) + ' ج.م') + '\nالإجمالي: ' + fmt(data.total) + ' ج.م\nالدفع عند الاستلام' + (co.note.trim() ? '\n\nملاحظات: ' + co.note.trim() : '');
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
    else if (a === 'view') { qv = { id, q: 1 }; renderModal(); }
    else if (a === 'vclose') { qv = null; renderModal(); }
    else if (a === 'vq+') { const p = prod(qv.id); if (p && qv.q < Math.min(maxQty(p) || 1, 20)) qv.q++; renderModal(); }
    else if (a === 'vq-') { if (qv.q > 1) qv.q--; renderModal(); }
    else if (a === 'vadd') { const p = prod(qv.id); if (p) { const cur = cart[p.id] || 0; cart[p.id] = Math.min(cur + qv.q, maxQty(p)); saveCart(); toast('تمت الإضافة للسلة'); qv = null; renderModal(); } }
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
    else if (t.id === 'genre') { F.genre = t.value; renderGrid(); }
    else if (t.dataset.co != null) { co[t.dataset.co] = t.value; if (t.dataset.co === 'gov') { ls.set('mh-co', co); renderDrawer(); } }
    else if (t.dataset.rq != null) rq[t.dataset.rq] = t.value;
  });
  document.addEventListener('submit', e => { if (e.target.id === 'rqform') { e.preventDefault(); rqSubmit(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (qv) { qv = null; renderModal(); } else if (drawer) { drawer = false; renderDrawer(); } } });

  /* ---------- التشغيل ---------- */
  (async function boot() {
    if (!sb) { app.innerHTML = MH.notConfigured(); return; }
    const [pr, st, rt] = await Promise.all([
      sb.from('products').select('*').eq('active', true).order('created_at', { ascending: false }),
      sb.from('settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('shipping_rates').select('*').order('sort')
    ]);
    if (!rt.error) (rt.data || []).forEach(r => { R[r.gov] = { gov: r.gov, fee: Number(r.fee), active: r.active !== false, sort: r.sort | 0 }; });
    if (!pr.error) P = (pr.data || []).map(mapProduct);
    S = mapSettings(st.data);
    render();
    const h = location.hash.replace('#', ''); if (h) { const t = document.getElementById(h); if (t) t.scrollIntoView(); }
  })();
})();
