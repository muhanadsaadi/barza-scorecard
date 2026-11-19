/* =========================================================
   Barza Scorecard — scoring.js
   ---------------------------------------------------------
   The "brain" of the tool. It has NO knowledge of the page:
   it takes a plain `shop` object and returns a result object.
   Keeping it separate makes it easy to read, test and tweak.

   Total = 10 points, split across 6 checks:
     1. Google rating ................ 2.0
     2. Number of reviews ............ 2.0
     3. Photos ....................... 1.5
     4. Basic info (hours + menu) .... 1.5
     5. Direct order link ............ 1.5
     6. Engagement (replies + 2 langs) 1.5
   ========================================================= */

'use strict';

/** Find how many points a value earns from a list of [minimum, points] steps.
 *  Steps must be sorted from highest minimum to lowest. */
function stepScore(value, steps) {
  for (const [min, points] of steps) if (value >= min) return points;
  return 0;
}

/* Thresholds — change these numbers to make the scoring stricter or softer. */
const RATING_STEPS = [[4.5, 2], [4.2, 1.5], [3.8, 1], [0.1, 0.5]];
const REVIEW_STEPS = [[200, 2], [100, 1.5], [50, 1], [15, 0.5]];

/* When two fixes lose the same number of points, the one that appears first
   here wins (quick wins first). */
const FIX_PRIORITY = ['order', 'info', 'photos', 'reviews', 'rating', 'engagement'];

/**
 * Score one shop.
 * @param {object} shop  { name, area, category, rating, reviews,
 *                         photos, hours, menu, orderLink, replies, bilingual, notes }
 * @returns {{ total:number, grade:object, checks:Array, fixes:Array }}
 */
function scoreShop(shop) {
  const rating = Number(shop.rating) || 0;
  const reviews = Math.max(0, Math.floor(Number(shop.reviews) || 0));
  const checks = [];

  /* ---- 1) Google rating ---- */
  {
    const score = stepScore(rating, RATING_STEPS);
    checks.push({
      id: 'rating', max: 2, score,
      title_ar: 'تقييم Google', title_en: 'Google rating',
      value: rating ? `${rating.toFixed(1)} ★` : '—',
      fix: rating
        ? {
            ar: 'ارفع التقييم: اطلب التقييم من الزبائن الراضين مباشرة بعد الخدمة، وعالج سبب الشكاوى المتكررة في التقييمات المنخفضة.',
            en: 'Lift the rating: ask happy customers for a review right after service, and fix the root cause of repeated complaints.'
          }
        : {
            ar: 'لا يوجد تقييم ظاهر: أنشئ ملف Google Business Profile ووثّقه، ثم اطلب أول ١٠ تقييمات من زبائنك الدائمين.',
            en: 'No visible rating: create and verify a Google Business Profile, then ask regulars for the first 10 reviews.'
          }
    });
  }

  /* ---- 2) Number of reviews ---- */
  {
    const score = stepScore(reviews, REVIEW_STEPS);
    // Next target = the smallest threshold above the current count
    const next = [...REVIEW_STEPS].reverse().find(([min]) => reviews < min);
    const target = next ? next[0] : 200;
    checks.push({
      id: 'reviews', max: 2, score,
      title_ar: 'عدد المراجعات', title_en: 'Review count',
      value: String(reviews),
      fix: {
        ar: `اجمع مراجعات أكثر: ضع رمز QR للتقييم على الطاولة أو عند الكاشير — الهدف القادم ${target} مراجعة.`,
        en: `Get more reviews: place a review QR code on tables / at the till — next target: ${target} reviews.`
      }
    });
  }

  /* ---- 3) Photos ---- */
  checks.push({
    id: 'photos', max: 1.5, score: shop.photos ? 1.5 : 0,
    title_ar: 'الصور', title_en: 'Photos',
    value: shop.photos ? '✓' : '✕',
    fix: {
      ar: 'أضف ١٠ صور واضحة على الأقل: الواجهة (ليسهل الوصول)، المكان من الداخل، وأشهر ٥ منتجات بإضاءة طبيعية.',
      en: 'Add at least 10 clear photos: storefront (easy to find), interior, and your top 5 products in natural light.'
    }
  });

  /* ---- 4) Basic info: opening hours + menu / price list ---- */
  {
    const score = (shop.hours ? 0.75 : 0) + (shop.menu ? 0.75 : 0);
    let fix;
    if (!shop.hours && !shop.menu) {
      fix = {
        ar: 'أكمل المعلومات الأساسية: ساعات العمل الدقيقة، والقائمة أو قائمة الأسعار — قائمة QR رقمية ثنائية اللغة تحل الأمرين.',
        en: 'Complete the basics: exact opening hours and a menu / price list — a bilingual QR menu solves both.'
      };
    } else if (!shop.hours) {
      fix = {
        ar: 'أضف ساعات العمل الدقيقة، وحدّثها في رمضان والعطل حتى لا يصل زبون والمحل مغلق.',
        en: 'Add exact opening hours and update them for Ramadan and holidays so no one arrives to a closed door.'
      };
    } else {
      fix = {
        ar: 'ارفع القائمة والأسعار: قائمة QR رقمية ثنائية اللغة تُحدَّث في دقيقة وتظهر من Google وإنستغرام.',
        en: 'Publish your menu & prices: a bilingual QR menu updates in a minute and links from Google & Instagram.'
      };
    }
    checks.push({
      id: 'info', max: 1.5, score,
      title_ar: 'ساعات العمل والقائمة', title_en: 'Hours & menu',
      value: `${shop.hours ? '✓' : '✕'} / ${shop.menu ? '✓' : '✕'}`,
      fix
    });
  }

  /* ---- 5) Direct order / booking link ---- */
  checks.push({
    id: 'order', max: 1.5, score: shop.orderLink ? 1.5 : 0,
    title_ar: 'رابط طلب مباشر', title_en: 'Direct order link',
    value: shop.orderLink ? '✓' : '✕',
    fix: {
      ar: 'أضف رابط طلب مباشر (واتساب أو قائمة رقمية) في ملف Google وإنستغرام — كل نقرة أقل تعني طلبات أكثر.',
      en: 'Add a direct order link (WhatsApp or digital menu) on Google & Instagram — fewer taps means more orders.'
    }
  });

  /* ---- 6) Engagement: replies to reviews + bilingual info ---- */
  {
    const score = (shop.replies ? 1 : 0) + (shop.bilingual ? 0.5 : 0);
    let fix;
    if (!shop.replies && !shop.bilingual) {
      fix = {
        ar: 'تفاعل مع زبائنك: رد على كل مراجعة خلال ٤٨ ساعة، واكتب الوصف بالعربية والإنجليزية.',
        en: 'Engage: reply to every review within 48 hours, and write your description in Arabic and English.'
      };
    } else if (!shop.replies) {
      fix = {
        ar: 'رد على كل مراجعة خلال ٤٨ ساعة — بشكر الإيجابية وحل السلبية بهدوء؛ هذا يرفع الثقة والترتيب.',
        en: 'Reply to every review within 48 hours — thank the good, calmly resolve the bad; it builds trust and ranking.'
      };
    } else {
      fix = {
        ar: 'اكتب الوصف والقائمة بالعربية والإنجليزية للوصول إلى المقيمين والسياح.',
        en: 'Write your description and menu in both Arabic and English to reach residents and tourists.'
      };
    }
    checks.push({
      id: 'engagement', max: 1.5, score,
      title_ar: 'التفاعل واللغتان', title_en: 'Replies & bilingual',
      value: `${shop.replies ? '✓' : '✕'} / ${shop.bilingual ? '✓' : '✕'}`,
      fix
    });
  }

  /* ---- Status of each check: pass / partial / fail ---- */
  for (const c of checks) {
    c.lost = c.max - c.score;
    c.status = c.score === c.max ? 'pass' : c.score === 0 ? 'fail' : 'partial';
  }

  /* ---- Total + grade ---- */
  const total = checks.reduce((sum, c) => sum + c.score, 0);

  /* ---- Top 3 fixes: biggest points lost first, then quick wins ---- */
  const fixes = checks
    .filter((c) => c.lost > 0)
    .sort((a, b) => (b.lost - a.lost) || (FIX_PRIORITY.indexOf(a.id) - FIX_PRIORITY.indexOf(b.id)))
    .slice(0, 3)
    .map((c) => ({ id: c.id, gain: c.lost, ...c.fix }));

  return { total, grade: gradeFor(total), checks, fixes };
}

/** Turn a 0–10 score into a label + colour. */
function gradeFor(total) {
  if (total >= 8.5) return { ar: 'ممتاز', en: 'Excellent', color: '#1E7B4A' };
  if (total >= 6.5) return { ar: 'جيد', en: 'Good', color: '#3D7A2A' };
  if (total >= 4) return { ar: 'يحتاج تحسين', en: 'Needs work', color: '#C27A12' };
  return { ar: 'ضعيف', en: 'Weak', color: '#B23A3A' };
}

/* Allow `node` to import this file for quick tests (ignored in the browser). */
if (typeof module !== 'undefined') module.exports = { scoreShop, gradeFor };
