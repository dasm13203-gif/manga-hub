/* أدوات مشتركة بين المتجر ولوحة التحكم */
(function () {
  'use strict';
  const CFG = window.MH_CONFIG || {};
  const configured = !!CFG.SUPABASE_URL && !/YOUR/.test(CFG.SUPABASE_URL) && !!CFG.SUPABASE_ANON_KEY && !/YOUR/.test(CFG.SUPABASE_ANON_KEY);
  const sb = configured && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => Number(n || 0).toLocaleString('en-US');
  const EGP = n => fmt(n) + ' ج.م';
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const IC = {
    bag: '<svg viewBox="0 0 24 24"><path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    badge: '<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="6"/><path d="M9 14l-1.5 7L12 18l4.5 3L15 14"/><path d="M9.5 9l2 2 3-3.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };
  const PAL = [['#6d28d9', '#1e0b44'], ['#be123c', '#2a0614'], ['#0e7490', '#06222b'], ['#15803d', '#05200f'], ['#c2410c', '#2b1303'], ['#be185d', '#2d0820'], ['#475569', '#0b1220'], ['#4338ca', '#0d0a2c']];
  const GENRES = ['أكشن', 'مغامرات', 'دراما', 'رعب', 'رومانسي', 'خيال علمي', 'كوميدي', 'أخرى'];
  const LANGS = { ar: 'العربية', en: 'English', fr: 'Français' };
  const GOVS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد', 'الإسماعيلية', 'السويس', 'شمال سيناء', 'جنوب سيناء', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد', 'مطروح'];
  const ORDER_ST = [['new', 'جديد', 'info'], ['confirmed', 'تم التأكيد', 'warn'], ['shipped', 'تم الشحن', 'info'], ['done', 'تم التسليم', 'ok'], ['cancelled', 'ملغي', 'bad']];
  const REQ_ST = [['new', 'جديد', 'info'], ['quoted', 'تم التسعير', 'warn'], ['agreed', 'تم الاتفاق', 'info'], ['arrived', 'وصل', 'ok'], ['cancelled', 'ملغي', 'bad']];
  const stLabel = (L, k) => L.find(x => x[0] === k) || L[0];
  const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

  const DEFAULT_SETTINGS = {
    announcement: 'شحن سريع لجميع المحافظات · الدفع عند الاستلام · اطلب أي مانجا متاح بالطلب',
    whatsapp: '01558647645', site: 'mangahub.eg', shipFee: 60, freeOver: 1000,
    heroTitle: 'وجهتك لعالم المانجا',
    heroSub: 'مجلدات أصلية بالعربية والإنجليزية والفرنسية، وأي عنوان مش موجود عندنا نجيبهولك بالطلب.'
  };
  function mapSettings(r) {
    const d = Object.assign({}, DEFAULT_SETTINGS);
    if (!r) return d;
    return {
      announcement: r.announcement == null ? d.announcement : r.announcement,
      whatsapp: r.whatsapp || d.whatsapp, site: r.site || d.site,
      shipFee: r.ship_fee == null ? d.shipFee : Number(r.ship_fee),
      freeOver: r.free_over == null ? d.freeOver : Number(r.free_over),
      heroTitle: r.hero_title || d.heroTitle, heroSub: r.hero_sub == null ? d.heroSub : r.hero_sub
    };
  }
  function mapProduct(r) {
    return {
      id: r.id, title: r.title, author: r.author || '', vol: r.vol || 0, genre: r.genre || '', lang: r.lang || 'ar',
      price: Number(r.price), oldPrice: Number(r.old_price) || 0, stock: r.stock | 0,
      preorder: !!r.preorder, featured: !!r.featured, pal: r.pal, img: r.img_path || '', active: r.active !== false
    };
  }
  const imgUrl = path => CFG.SUPABASE_URL + '/storage/v1/object/public/covers/' + encodeURIComponent(path).replace(/%2F/g, '/');
  const palOf = p => PAL[(p.pal != null ? Number(p.pal) : hash(String(p.id || p.title || 'x'))) % PAL.length];
  const coverStyle = p => { const c = palOf(p); return '--c1:' + c[0] + ';--c2:' + c[1]; };
  function coverInner(p) {
    const vol = p.vol ? String(p.vol).padStart(2, '0') : '';
    return '<div class="gen"><div class="vol num">' + (vol ? '<small>VOL</small>' + esc(vol) : '') + '</div><div class="tt">' + esc(p.title) + '</div></div>' +
      (p.img ? '<img class="photo" src="' + esc(imgUrl(p.img)) + '" alt="' + esc(p.title) + '" loading="lazy">' : '');
  }
  document.addEventListener('error', e => { const t = e.target; if (t && t.classList && t.classList.contains('photo')) t.remove(); }, true);

  function toast(msg) {
    const t = $('#toast'); if (!t) return;
    t.innerHTML = '<span>' + esc(msg) + '</span>';
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.innerHTML = ''; }, 3200);
  }
  const okPhone = v => /^(\+?20|0)?1[0125]\d{8}$/.test(String(v).replace(/[\s-]/g, ''));
  function waNum(S) { let d = String(S.whatsapp || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '20' + d.slice(1); return d; }
  const waLink = (S, t) => 'https://wa.me/' + waNum(S) + '?text=' + encodeURIComponent(t);
  const copyText = t => navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(t).then(() => true, () => false) : Promise.resolve(false);
  const notConfigured = () => '<div class="wrap cfgwarn"><div class="panel"><h2>الموقع محتاج ربط بقاعدة البيانات</h2><p class="muted">افتح ملف config.js وحط رابط مشروع Supabase والـ anon key، وبعدين شغّل ملف supabase.sql في SQL Editor. الخطوات كاملة في README.md.</p></div></div>';

  window.MH = { sb, configured, CFG, $, esc, fmt, EGP, ls, IC, PAL, GENRES, LANGS, GOVS, ORDER_ST, REQ_ST, stLabel, DEFAULT_SETTINGS, mapSettings, mapProduct, imgUrl, palOf, coverStyle, coverInner, toast, okPhone, waLink, copyText, notConfigured };
})();
