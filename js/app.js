/* =========================================================
   Barza Scorecard — app.js (page logic)
   ---------------------------------------------------------
   Flow:  form input  →  readForm()  →  scoreShop()  →  renderCard()
   Everything re-renders on every keystroke, so the A4 preview
   is always live. scoreShop() lives in scoring.js.
   ========================================================= */

'use strict';

/* ---------- Settings you may want to change ---------- */
const BARZA_WHATSAPP = '96876632622';
const STORAGE_KEY = 'barza-scorecard:last';

/* Fictional example shop (clearly marked as fictional) */
const EXAMPLE_SHOP = {
  name: 'مخبز السنبلة الذهبية (مثال خيالي)',
  area: 'مسقط',
  category: 'bakery',
  rating: 4.3,
  reviews: 64,
  photos: true,
  hours: true,
  menu: false,
  orderLink: false,
  replies: false,
  bilingual: false,
  notes: 'مثال توضيحي ببيانات خيالية — Fictional example data.'
};

/* Category labels shown on the card */
const CATEGORIES = {
  cafe: ['مقهى', 'Café'],
  restaurant: ['مطعم', 'Restaurant'],
  bakery: ['مخبز وحلويات', 'Bakery'],
  salon: ['صالون', 'Salon'],
  retail: ['متجر', 'Retail'],
  other: ['نشاط تجاري', 'Business']
};

const form = document.getElementById('shopForm');
const $ = (id) => document.getElementById(id);

/* Save/load the last entry so a refresh doesn't wipe your work.
   Wrapped in try/catch because storage can be blocked (private mode). */
const storage = {
  get() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } },
  set(v) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ } }
};

/* ---------------------------------------------------------
   Form <-> object
   --------------------------------------------------------- */

/** Read every field of the form into a plain object. */
function readForm() {
  const f = form.elements;
  return {
    name: f.name.value.trim(),
    area: f.area.value.trim(),
    category: f.category.value,
    rating: f.rating.value === '' ? '' : Math.min(5, Math.max(0, Number(f.rating.value))),
    reviews: f.reviews.value === '' ? '' : Math.max(0, Math.floor(Number(f.reviews.value))),
    photos: f.photos.checked,
    hours: f.hours.checked,
    menu: f.menu.checked,
    orderLink: f.orderLink.checked,
    replies: f.replies.checked,
    bilingual: f.bilingual.checked,
    notes: f.notes.value.trim()
  };
}

/** Put an object's values into the form (used by "Example" and on load). */
function fillForm(shop) {
  const f = form.elements;
  for (const [key, value] of Object.entries(shop)) {
    const field = f[key];
    if (!field) continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value;
  }
}

/* ---------------------------------------------------------
   Rendering the A4 card
   --------------------------------------------------------- */

/** Show 7 as "7" and 7.25 as "7.3" — one decimal at most. */
const fmt = (n) => String(Math.round(n * 10) / 10);

function renderCard() {
  const shop = readForm();
  const result = scoreShop(shop);
  storage.set(shop);

  // --- Shop info ---
  $('cName').textContent = shop.name || 'اسم المحل · Shop name';
  const [catAr, catEn] = CATEGORIES[shop.category] || CATEGORIES.other;
  $('cMeta').textContent = [shop.area, `${catAr} · ${catEn}`].filter(Boolean).join(' — ');
  $('cRating').textContent = shop.rating !== '' && shop.rating > 0 ? `★ ${Number(shop.rating).toFixed(1)} Google` : '★ — Google';
  $('cReviews').textContent = `${shop.reviews || 0} مراجعة · reviews`;
  $('cDate').textContent = new Date().toLocaleDateString('ar-OM-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });

  // --- Score ring: stroke-dasharray trick draws a partial circle ---
  const circumference = 2 * Math.PI * 52;          // r = 52 in the SVG
  const ring = $('cRingFg');
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference * (1 - result.total / 10);
  $('cRing').style.setProperty('--grade', result.grade.color);
  $('cScore').textContent = fmt(result.total);
  $('cGrade').textContent = `${result.grade.ar}\n${result.grade.en}`;   // two lines (CSS: white-space: pre-line)

  // --- 6 checks ---
  const icons = { pass: '✓', partial: '!', fail: '✕' };
  const checksList = $('cChecks');
  checksList.innerHTML = '';
  for (const c of result.checks) {
    const li = document.createElement('li');
    li.className = c.status;

    const icon = document.createElement('span');
    icon.className = 'icon';
    icon.textContent = icons[c.status];

    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = c.title_ar;
    const en = document.createElement('small');
    en.lang = 'en';
    en.textContent = c.title_en;
    const val = document.createElement('em');
    val.textContent = `(${c.value})`;
    label.append(en, val);

    const bar = document.createElement('span');
    bar.className = 'bar';
    const fill = document.createElement('i');
    fill.style.width = `${(c.score / c.max) * 100}%`;
    bar.append(fill);

    const pts = document.createElement('span');
    pts.className = 'pts';
    pts.textContent = `${fmt(c.score)} / ${fmt(c.max)}`;

    li.append(icon, label, bar, pts);
    checksList.append(li);
  }

  // --- Top 3 fixes ---
  const fixList = $('cFixes');
  fixList.innerHTML = '';
  if (!result.fixes.length) {
    const li = document.createElement('li');
    li.className = 'none';
    li.innerHTML = '<p>ممتاز! الملف مكتمل — حافظ على تحديث الصور والرد على المراجعات.</p><p lang="en">Excellent! The listing is complete — keep photos fresh and keep replying to reviews.</p>';
    fixList.append(li);
  }
  for (const fix of result.fixes) {
    const li = document.createElement('li');
    const gain = document.createElement('span');
    gain.className = 'gain';
    gain.textContent = `+${fmt(fix.gain)} pts`;
    const ar = document.createElement('p');
    ar.textContent = fix.ar;
    const en = document.createElement('p');
    en.lang = 'en';
    en.textContent = fix.en;
    li.append(gain, ar, en);
    fixList.append(li);
  }

  // --- Notes (hidden when empty) ---
  $('cNotesBlock').hidden = !shop.notes;
  $('cNotes').textContent = shop.notes;

  renderQr(shop.name);
}

/* ---------------------------------------------------------
   WhatsApp QR code (generated in the browser, no internet API)
   --------------------------------------------------------- */
let lastQrText = '';
function renderQr(shopName) {
  const message = `مرحباً برزة، أريد تحسين الحضور الرقمي لـ ${shopName || 'محلي'}`;
  const url = `https://wa.me/${BARZA_WHATSAPP}?text=${encodeURIComponent(message)}`;
  if (url === lastQrText) return;     // skip work if nothing changed
  lastQrText = url;

  // qrcode(typeNumber, errorCorrection): 0 = pick the smallest size automatically
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  $('cQr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

/* ---------------------------------------------------------
   Fit the 210mm-wide sheet into the preview column
   --------------------------------------------------------- */
function fitSheet() {
  const box = $('sheetFit');
  const sheet = $('sheet');
  sheet.style.transform = 'none';
  const available = box.clientWidth;
  const scale = Math.min(1, available / sheet.offsetWidth);
  sheet.style.transform = `scale(${scale})`;
  // Center the scaled sheet and give the wrapper the scaled height
  const offset = (available - sheet.offsetWidth * scale) / 2;
  sheet.style.marginInlineStart = `${Math.max(0, offset)}px`;
  sheet.style.transformOrigin = document.dir === 'rtl' ? 'top right' : 'top left';
  box.style.height = `${sheet.offsetHeight * scale}px`;
}

/* ---------------------------------------------------------
   Events
   --------------------------------------------------------- */
form.addEventListener('input', renderCard);
form.addEventListener('change', renderCard);
form.addEventListener('submit', (e) => e.preventDefault());

$('exampleBtn').addEventListener('click', () => { fillForm(EXAMPLE_SHOP); renderCard(); });

$('clearBtn').addEventListener('click', () => {
  form.reset();
  renderCard();
  form.elements.name.focus();
});

$('printBtn').addEventListener('click', () => {
  // The PDF file name comes from the page title
  const original = document.title;
  const name = readForm().name || 'shop';
  document.title = `Barza-Scorecard - ${name}`;
  window.print();
  document.title = original;
});

window.addEventListener('resize', fitSheet);

/* ---------------------------------------------------------
   Start: restore the last entry, or show the example shop
   --------------------------------------------------------- */
fillForm(storage.get() || EXAMPLE_SHOP);
renderCard();
fitSheet();
