/* سهام — اللوحات المخفية
 * كل لوحة مرسومة بأشكال (دوائر، قطوع، مضلعات، خطوط) ضمن مساحة 100×100،
 * وتُحوَّل لبكسل آرت بأي دقة نريدها، مع تظليل تلقائي (إضاءة من الأعلى-يسار) وحدود داكنة.
 * لوحات التعليم الصغيرة فقط مرسومة يدوياً بالبكسل (art).
 */
(function (root) {
  'use strict';

  const PALETTE = {
    K: '#2b2d42', // كحلي داكن
    W: '#ffffff',
    R: '#e5383b', // أحمر
    r: '#a4161a', // أحمر غامق
    P: '#ff8fab', // وردي
    C: '#ffb3a7', // خدود
    O: '#fb8500', // برتقالي
    Q: '#c2410c', // برتقالي غامق
    Y: '#ffc93c', // أصفر
    G: '#40a35a', // أخضر
    g: '#2d6a4f', // أخضر غامق
    L: '#a7d977', // أخضر فاتح
    B: '#3a86ff', // أزرق
    b: '#8ecae6', // أزرق فاتح
    D: '#1d4e89', // أزرق غامق
    V: '#8338ec', // بنفسجي
    v: '#c8a2f0', // لافندر
    N: '#8b5a2b', // بني
    M: '#5c3a1e', // بني غامق
    n: '#d4a373', // بيج
    S: '#ffe8d6', // كريمي
    T: '#e07a5f', // فخاري
    E: '#c9ced6', // رمادي فاتح
    e: '#6c757d', // رمادي
  };

  // ——— أدوات بناء الأشكال ———
  const C = (x, y, r, c, o) => Object.assign({ t: 'c', x, y, r, c }, o);
  const E = (x, y, rx, ry, a, c, o) => Object.assign({ t: 'e', x, y, rx, ry, a: a || 0, c }, o);
  const Rr = (x, y, w, h, r, c, o) => Object.assign({ t: 'r', x, y, w, h, r: r || 0, c }, o);
  const P = (p, c, o) => Object.assign({ t: 'p', p, c }, o);
  const Ln = (p, w, c, o) => Object.assign({ t: 'l', p, w, c }, o);
  const CUT = s => Object.assign(s, { cut: true });
  const D = { sh: 'n' };              // بدون تظليل (للتفاصيل)
  const DET = { sh: 'n', pri: 4 };    // تفصيل مهم: يظهر حتى لو صغير
  function star(cx, cy, R, r, n, rot) {
    n = n || 5; rot = rot == null ? -90 : rot;
    const p = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (rot + i * 180 / n) * Math.PI / 180, rr = i % 2 ? r : R;
      p.push(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    return p;
  }
  function petals(cx, cy, dist, n, rx, ry, c, off, g) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const ang = (off || 0) + i * 360 / n;
      const a = ang * Math.PI / 180;
      out.push(E(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, rx, ry, ang - 90, c, { g }));
    }
    return out;
  }

  const PICTURES = [
    // ——— لوحات التعليم (بكسل يدوي) ———
    { id: 'gem', tutorial: true, name: { ar: 'جوهرة', en: 'Gem' }, art: [
      '.BB.',
      'BbbB',
      'BbbB',
      '.BB.',
    ] },
    { id: 'leaf', tutorial: true, name: { ar: 'ورقة', en: 'Leaf' }, art: [
      '..GG.',
      '.GGGG',
      'GGgGG',
      'GgGG.',
      'gGG..',
    ] },
    { id: 'smile', tutorial: true, name: { ar: 'ابتسامة', en: 'Smile' }, art: [
      '.YYYYY.',
      'YYYYYYY',
      'YKYYYKY',
      'YYYYYYY',
      'YKYYYKY',
      'YYKKKYY',
      '.YYYYY.',
    ] },

    // ——— اللوحات الرئيسية (بالترتيب من الأبسط للأغنى بالتفاصيل) ———
    { id: 'heart', name: { ar: 'قلب', en: 'Heart' }, view: [100, 90], shapes: [
      C(30, 32, 22, 'R', { g: 'h' }), C(70, 32, 22, 'R', { g: 'h' }), P([9, 38, 91, 38, 50, 87], 'R', { g: 'h' }),
      E(29, 25, 8, 4.5, -35, 'W', D), C(18, 37, 2.6, 'W', DET),
    ] },
    { id: 'apple', name: { ar: 'تفاحة', en: 'Apple' }, shapes: [
      Ln([50, 40, 53, 12], 5, 'N', D),
      C(35, 58, 28, 'R', { g: 'a' }), C(65, 58, 28, 'R', { g: 'a' }), E(50, 72, 30, 25, 0, 'R', { g: 'a' }),
      E(67, 19, 14, 7, -28, 'G'), Ln([57, 24, 76, 15], 1.6, 'g', D),
      E(28, 50, 5, 10, 20, 'W', D),
    ] },
    { id: 'watermelon', name: { ar: 'بطيخ', en: 'Watermelon' }, view: [100, 50], shapes: [
      C(50, 0, 48, 'G'), C(50, 0, 43, 'L', D), C(50, 0, 39, 'R'),
      E(28, 12, 2.2, 3.6, -25, 'K', DET), E(50, 22, 2.2, 3.6, 0, 'K', DET), E(72, 12, 2.2, 3.6, 25, 'K', DET),
      E(39, 30, 2.2, 3.6, -12, 'K', DET), E(61, 30, 2.2, 3.6, 12, 'K', DET), E(18, 4, 2, 3, -35, 'K', DET), E(82, 4, 2, 3, 35, 'K', DET),
      E(40, 8, 2, 3, -10, 'K', DET), E(60, 8, 2, 3, 10, 'K', DET),
    ] },
    { id: 'mushroom', name: { ar: 'فطر', en: 'Mushroom' }, shapes: [
      E(50, 46, 46, 36, 0, 'R'), CUT(Rr(0, 59, 100, 41, 0)),
      E(50, 59, 38, 7, 0, 'n', D),
      Rr(34, 56, 32, 38, 12, 'S'),
      C(30, 34, 7, 'W', D), C(56, 22, 6, 'W', D), C(73, 42, 7, 'W', D), C(46, 48, 4.5, 'W', D), C(16, 49, 4, 'W', D), C(84, 30, 3.5, 'W', D),
      C(43, 72, 2.6, 'K', DET), C(57, 72, 2.6, 'K', DET),
      E(38, 79, 3.5, 2.2, 0, 'C', { sh: 'n', pri: 2 }), E(62, 79, 3.5, 2.2, 0, 'C', { sh: 'n', pri: 2 }),
      Ln([46, 79, 50, 81.5, 54, 79], 1.8, 'K', { sh: 'n', pri: 2 }),
    ] },
    { id: 'strawberry', name: { ar: 'فراولة', en: 'Strawberry' }, shapes: [
      E(50, 56, 36, 30, 0, 'R', { g: 's' }), P([15, 52, 85, 52, 50, 98], 'R', { g: 's' }),
      ...[[32, 44], [50, 40], [68, 44], [40, 56], [60, 56], [26, 60], [74, 60], [50, 70], [38, 74], [62, 74], [50, 86], [44, 62]]
        .map(([x, y]) => E(x, y, 1.7, 2.7, 0, 'Y', DET)),
      P([50, 34, 40, 40, 42, 30, 26, 31, 38, 24, 32, 14, 46, 20, 50, 10, 54, 20, 68, 14, 62, 24, 74, 31, 58, 30, 60, 40], 'G'),
      Ln([50, 20, 55, 3], 5, 'g', D),
      E(31, 46, 4, 8, 25, 'W', D),
    ] },
    { id: 'fish', name: { ar: 'سمكة المهرج', en: 'Clownfish' }, view: [100, 70], shapes: [
      P([34, 14, 50, 3, 58, 16], 'Y'), P([40, 54, 50, 67, 56, 54], 'Y'),
      P([72, 35, 97, 11, 90, 35, 97, 59], 'O'),
      E(44, 35, 34, 22, 0, 'O'),
      E(42, 44, 22, 9, 0, 'Y', D),
      E(53, 35, 4, 20, 0, 'W', D), E(68, 35, 3.2, 14, 0, 'W', D),
      Ln([30, 20, 34, 35, 30, 50], 2.4, 'Q', D),
      C(20, 30, 6.5, 'W', D), C(19, 30, 3.4, 'K', DET), C(18, 28.6, 1.2, 'W', { sh: 'n', pri: 6 }),
      Ln([10, 40, 15, 40], 1.8, 'Q', D),
    ] },
    { id: 'house', name: { ar: 'بيت', en: 'House' }, shapes: [
      Rr(66, 10, 10, 26, 0, 'N'),
      Rr(14, 44, 72, 50, 0, 'S'),
      P([6, 48, 50, 8, 94, 48], 'R', { ol: 1 }),
      Rr(4, 44, 92, 6, 2, 'r', D),
      C(50, 30, 6.5, 'W', D), C(50, 30, 4.2, 'b', D),
      Rr(42, 63, 16, 31, 3, 'N'), C(54, 80, 1.6, 'Y', DET),
      Rr(19, 57, 18, 18, 1, 'W', D), Rr(21.5, 59.5, 13, 13, 0, 'b'), Ln([28, 59, 28, 73], 1.6, 'W', D), Ln([21, 66, 35, 66], 1.6, 'W', D),
      Rr(63, 57, 18, 18, 1, 'W', D), Rr(65.5, 59.5, 13, 13, 0, 'b'), Ln([72, 59, 72, 73], 1.6, 'W', D), Ln([65, 66, 79, 66], 1.6, 'W', D),
      Rr(0, 92, 100, 8, 0, 'G'),
    ] },
    { id: 'tree', name: { ar: 'شجرة الصنوبر', en: 'Pine Tree' }, shapes: [
      Rr(44, 80, 12, 16, 1, 'N'),
      P([50, 40, 92, 84, 8, 84], 'G', { ol: 1, g: 't1' }),
      P([50, 22, 82, 64, 18, 64], 'G', { ol: 1, g: 't2' }),
      P([50, 8, 72, 44, 28, 44], 'G', { ol: 1, g: 't3' }),
      C(40, 57, 3.6, 'R', DET), C(63, 73, 3.6, 'Y', DET), C(33, 76, 3.6, 'b', DET), C(58, 38, 3.2, 'R', DET), C(45, 31, 3, 'Y', DET), C(66, 55, 3.2, 'b', DET), C(50, 70, 3.4, 'P', DET),
      P(star(50, 9, 10, 4.2), 'Y', D),
    ] },
    { id: 'icecream', name: { ar: 'آيس كريم', en: 'Ice Cream' }, shapes: [
      P([30, 52, 70, 52, 50, 99], 'n'),
      Ln([36, 55, 50, 76], 1.6, 'N', D), Ln([50, 55, 60, 68], 1.6, 'N', D), Ln([64, 55, 50, 76], 1.6, 'N', D), Ln([50, 55, 40, 68], 1.6, 'N', D),
      C(50, 38, 24, 'P', { g: 's' }), C(32, 52, 6, 'P', { g: 's' }), C(46, 56, 5, 'P', { g: 's' }), C(63, 54, 6, 'P', { g: 's' }),
      Ln([40, 28, 44, 26], 2.4, 'Y', DET), Ln([56, 24, 60, 27], 2.4, 'B', DET), Ln([36, 42, 39, 45], 2.4, 'G', DET),
      Ln([60, 40, 64, 38], 2.4, 'W', DET), Ln([50, 46, 53, 48], 2.4, 'Y', DET), Ln([47, 33, 50, 31], 2.4, 'V', DET),
      C(52, 12, 7, 'R'), Ln([53, 6, 60, 0], 2, 'g', D), C(49.5, 9.5, 1.8, 'W', DET),
    ] },
    { id: 'crown', name: { ar: 'تاج', en: 'Crown' }, view: [100, 80], shapes: [
      P([10, 72, 10, 26, 30, 48, 50, 16, 70, 48, 90, 26, 90, 72], 'Y'),
      Rr(10, 58, 80, 14, 0, 'O'),
      C(28, 65, 4.5, 'R', DET), C(50, 65, 5, 'B', DET), C(72, 65, 4.5, 'G', DET),
      C(10, 24, 5.5, 'Y'), C(50, 14, 5.5, 'Y'), C(90, 24, 5.5, 'Y'),
      E(50, 41, 5, 7, 0, 'V', DET), C(49, 39, 1.5, 'W', { sh: 'n', pri: 6 }),
    ] },
    { id: 'moon', name: { ar: 'هلال ونجوم', en: 'Crescent' }, shapes: [
      C(44, 54, 40, 'Y'), CUT(C(66, 40, 33)),
      Ln([20, 52, 25, 55, 30, 52], 2, 'Q', { sh: 'n', pri: 3 }), C(21, 63, 4, 'C', { sh: 'n', pri: 2 }),
      P(star(78, 76, 13, 5.5), 'Y'), P(star(84, 24, 10, 4.2), 'Y'),
    ] },
    { id: 'cactus', name: { ar: 'صبّارة', en: 'Cactus' }, shapes: [
      Rr(14, 32, 14, 30, 7, 'G', { g: 'al' }), Rr(14, 50, 30, 12, 6, 'G', { g: 'al' }),
      Rr(72, 26, 14, 28, 7, 'G', { g: 'ar' }), Rr(56, 44, 30, 12, 6, 'G', { g: 'ar' }),
      Rr(38, 18, 24, 58, 12, 'G', { ol: 1 }),
      Ln([45, 26, 45, 68], 1.5, 'g', D), Ln([55, 26, 55, 68], 1.5, 'g', D),
      C(50, 16, 7, 'P'), C(50, 16, 3, 'Y', DET),
      C(44, 40, 2.4, 'K', DET), C(56, 40, 2.4, 'K', DET), Ln([46, 46, 50, 48, 54, 46], 1.6, 'K', { sh: 'n', pri: 2 }),
      C(40, 45, 2.5, 'C', { sh: 'n', pri: 2 }), C(60, 45, 2.5, 'C', { sh: 'n', pri: 2 }),
      P([28, 78, 72, 78, 66, 99, 34, 99], 'T'), Rr(24, 70, 52, 9, 2, 'T', { ol: 1 }),
    ] },
    { id: 'balloon', name: { ar: 'منطاد', en: 'Hot-Air Balloon' }, shapes: [
      Ln([36, 64, 42, 84], 1.6, 'N', D), Ln([64, 64, 58, 84], 1.6, 'N', D),
      C(50, 36, 34, 'R', { g: 'e' }), P([18, 46, 82, 46, 60, 75, 40, 75], 'R', { g: 'e' }),
      E(50, 40, 13, 34, 0, 'Y', { g: 'e' }), E(24, 36, 5, 26, 8, 'Y', { g: 'e' }), E(76, 36, 5, 26, -8, 'Y', { g: 'e' }),
      Rr(40, 82, 20, 15, 2, 'N'), Ln([40, 88, 60, 88], 1.4, 'M', D),
      E(30, 22, 4, 9, 30, 'W', D),
    ] },
    { id: 'turtle', name: { ar: 'سلحفاة', en: 'Turtle' }, view: [100, 70], shapes: [
      E(48, 42, 34, 28, 0, 'G'), CUT(Rr(0, 47, 100, 30, 0)),
      Rr(12, 42, 72, 7, 3, 'g'),
      E(30, 56, 8, 7, 0, 'L'), E(66, 56, 8, 7, 0, 'L'), P([14, 44, 3, 49, 14, 52], 'L'),
      C(86, 40, 10, 'L'), C(89, 37, 2.4, 'K', DET), Ln([87, 44, 93, 43], 1.4, 'K', D),
      C(48, 28, 7, 'L', D), C(32, 36, 5.5, 'L', D), C(64, 36, 5.5, 'L', D), C(36, 22, 4, 'L', D), C(60, 22, 4, 'L', D),
    ] },
    { id: 'whale', name: { ar: 'حوت', en: 'Whale' }, view: [100, 72], shapes: [
      P([74, 42, 95, 16, 100, 30, 88, 46], 'B', { g: 'w' }),
      E(44, 46, 40, 24, 0, 'B', { g: 'w' }),
      Ln([34, 22, 34, 9], 3, 'b', D), C(28, 6, 4, 'b'), C(40, 6, 4, 'b'),
      E(40, 59, 30, 9, 0, 'b', D),
      Ln([22, 58, 52, 58], 1.2, 'B', D), Ln([26, 63, 48, 63], 1.2, 'B', D),
      C(22, 44, 3, 'K', DET), C(21, 43, 1.1, 'W', { sh: 'n', pri: 6 }),
      Ln([11, 51, 20, 55], 1.8, 'K', { sh: 'n', pri: 2 }), C(28, 52, 3, 'C', { sh: 'n', pri: 2 }),
      E(52, 64, 10, 5, 30, 'D'),
    ] },
    { id: 'rocket', name: { ar: 'صاروخ', en: 'Rocket' }, shapes: [
      P([38, 76, 62, 76, 50, 99], 'O'), P([44, 76, 56, 76, 50, 90], 'Y', D),
      P([34, 52, 15, 82, 34, 73], 'R'), P([66, 52, 85, 82, 66, 73], 'R'),
      Rr(34, 26, 32, 52, 6, 'W'),
      P([50, 2, 62, 13, 67, 28, 33, 28, 38, 13], 'R'),
      Rr(34, 62, 32, 5, 0, 'R', D),
      C(50, 44, 10, 'e'), C(50, 44, 7, 'b'), C(47, 41, 2, 'W', DET),
      Rr(40, 76, 20, 5, 1, 'e'),
    ] },
    { id: 'cat', name: { ar: 'قطة', en: 'Cat' }, view: [100, 90], shapes: [
      P([12, 44, 18, 4, 44, 26], 'O', { g: 'h' }), P([88, 44, 82, 4, 56, 26], 'O', { g: 'h' }),
      E(50, 54, 42, 34, 0, 'O', { g: 'h' }),
      P([20, 33, 22, 13, 36, 26], 'P', D), P([80, 33, 78, 13, 64, 26], 'P', D),
      Ln([50, 22, 50, 32], 3, 'Q', D), Ln([42, 24, 44, 32], 2.6, 'Q', D), Ln([58, 24, 56, 32], 2.6, 'Q', D),
      E(42, 69, 10, 8, 0, 'S', { g: 'm' }), E(58, 69, 10, 8, 0, 'S', { g: 'm' }),
      E(34, 52, 6.5, 8, 0, 'G', { sh: 'n', pri: 2 }), E(66, 52, 6.5, 8, 0, 'G', { sh: 'n', pri: 2 }),
      E(34, 53, 2.4, 6, 0, 'K', DET), E(66, 53, 2.4, 6, 0, 'K', DET),
      C(36, 49, 1.6, 'W', { sh: 'n', pri: 6 }), C(68, 49, 1.6, 'W', { sh: 'n', pri: 6 }),
      P([45, 61, 55, 61, 50, 67], 'P', DET),
      Ln([30, 66, 12, 62], 1.5, 'K', { sh: 'n', pri: 2 }), Ln([30, 71, 13, 74], 1.5, 'K', { sh: 'n', pri: 2 }),
      Ln([70, 66, 88, 62], 1.5, 'K', { sh: 'n', pri: 2 }), Ln([70, 71, 87, 74], 1.5, 'K', { sh: 'n', pri: 2 }),
      C(24, 62, 4, 'C', { sh: 'n', pri: 2 }), C(76, 62, 4, 'C', { sh: 'n', pri: 2 }),
    ] },
    { id: 'panda', name: { ar: 'باندا', en: 'Panda' }, view: [100, 92], shapes: [
      C(18, 22, 13, 'K'), C(82, 22, 13, 'K'),
      E(50, 54, 42, 36, 0, 'W'),
      E(33, 52, 10, 13, 35, 'K', D), E(67, 52, 10, 13, -35, 'K', D),
      C(34, 50, 4, 'W', DET), C(66, 50, 4, 'W', DET), C(35, 51, 2.2, 'K', { sh: 'n', pri: 6 }), C(65, 51, 2.2, 'K', { sh: 'n', pri: 6 }),
      E(50, 69, 14, 10, 0, 'S', D),
      E(50, 63, 5, 3.5, 0, 'K', DET),
      Ln([45, 71, 50, 73, 55, 71], 1.6, 'K', { sh: 'n', pri: 2 }),
      C(25, 66, 5, 'P', { sh: 'n', pri: 2 }), C(75, 66, 5, 'P', { sh: 'n', pri: 2 }),
    ] },
    { id: 'owl', name: { ar: 'بومة', en: 'Owl' }, shapes: [
      P([16, 30, 22, 3, 40, 24], 'N', { g: 'o' }), P([84, 30, 78, 3, 60, 24], 'N', { g: 'o' }),
      E(50, 58, 36, 38, 0, 'N', { g: 'o' }),
      E(16, 62, 9, 22, 10, 'M'), E(84, 62, 9, 22, -10, 'M'),
      E(50, 72, 22, 21, 0, 'n'),
      Ln([42, 66, 45, 69, 48, 66], 1.6, 'N', { sh: 'n', pri: 2 }), Ln([52, 66, 55, 69, 58, 66], 1.6, 'N', { sh: 'n', pri: 2 }), Ln([47, 77, 50, 80, 53, 77], 1.6, 'N', { sh: 'n', pri: 2 }),
      C(35, 42, 13, 'Y'), C(65, 42, 13, 'Y'),
      C(35, 42, 9.5, 'W', D), C(65, 42, 9.5, 'W', D),
      C(36, 43, 5, 'K', DET), C(64, 43, 5, 'K', DET), C(38, 41, 1.7, 'W', { sh: 'n', pri: 6 }), C(66, 41, 1.7, 'W', { sh: 'n', pri: 6 }),
      P([45, 52, 55, 52, 50, 62], 'O', DET),
      Rr(4, 93, 92, 7, 3, 'M'),
      C(40, 94, 4, 'O'), C(60, 94, 4, 'O'),
    ] },
    { id: 'butterfly', name: { ar: 'فراشة', en: 'Butterfly' }, view: [100, 90], shapes: [
      E(34, 64, 17, 15, 25, 'v'), E(66, 64, 17, 15, -25, 'v'),
      E(30, 32, 26, 22, -25, 'V', { ol: 1 }), E(70, 32, 26, 22, 25, 'V', { ol: 1 }),
      C(24, 30, 9, 'P', D), C(76, 30, 9, 'P', D), C(23, 29, 4, 'W', D), C(77, 29, 4, 'W', D),
      C(36, 66, 6, 'Y', D), C(64, 66, 6, 'Y', D), C(13, 44, 2.6, 'W', DET), C(87, 44, 2.6, 'W', DET),
      E(50, 50, 4.5, 26, 0, 'K', { pri: 2 }), C(50, 22, 6, 'K'),
      Ln([48, 18, 40, 4], 1.8, 'K', { sh: 'n', pri: 2 }), Ln([52, 18, 60, 4], 1.8, 'K', { sh: 'n', pri: 2 }),
      C(40, 4, 3, 'K'), C(60, 4, 3, 'K'),
    ] },
    { id: 'sunflower', name: { ar: 'دوّار الشمس', en: 'Sunflower' }, shapes: [
      Ln([50, 58, 50, 99], 6, 'g'),
      E(36, 82, 13, 6, -30, 'G'), E(64, 76, 13, 6, 30, 'G'),
      ...petals(50, 40, 22, 14, 6, 11, 'O', 360 / 28, 'p2'),
      ...petals(50, 40, 27, 14, 7, 14, 'Y', 0, 'p1'),
      C(50, 40, 16, 'N'), C(50, 40, 11, 'M', D),
      ...[[46, 36], [54, 36], [50, 44], [44, 43], [56, 43], [50, 32]].map(([x, y]) => C(x, y, 1.6, 'n', DET)),
    ] },
  ];

  // ——— حزمة "حيوانات من أسهم": رسومات كيوت بألوان مسطّحة وحدود، الأسهم الملوّنة ترسمها ———
  const AP = {
    K: '#3b2f2f', W: '#ffffff', A: '#b9bfcc', S: '#a3b18a', O: '#f0a04b', N: '#b5793f', n: '#f3d4ab',
    P: '#ffa3b5', C: '#ff9db0', G: '#6cc070', L: '#bfe6a8', Y: '#ffd23f', y: '#f4b23a', D: '#344563',
    R: '#ff7f2a', E: '#fff1d6', M: '#f7e6cc', F: '#f28c38', Q: '#d9772e', H: '#d9a46c',
  };
  const SH = { sh: 'n', pri: 6 }, B2 = { sh: 'n', pri: 2 }, OL = { ol: 1 };
  // عين كيوت: الكبيرة فيها لمعة، والصغيرة مربّع مدوّر واضح بدقة البكسل
  const eye = (x, y, rx, ry) => rx >= 4.5
    ? [E(x, y, rx, ry, 0, 'K', DET), C(x + rx * 0.35, y - ry * 0.4, Math.max(1.2, rx * 0.38), 'W', SH)]
    : [Rr(x - rx - 0.4, y - ry, rx * 2 + 0.8, ry * 2, rx * 0.45, 'K', DET)];
  const blush = (x, y, rx) => E(x, y, rx || 4.2, (rx || 4.2) * 0.62, 0, 'C', B2);
  const happy = (x, y, w) => Ln([x - w, y + w * 0.4, x, y - w * 0.6, x + w, y + w * 0.4], 2.2, 'K', DET);
  const ANIMALS = [
    { id: 'cats3', pack: 'animals', flat: 1, palette: AP, ratio: 1.8, w: 24, name: { ar: 'برج القطط', en: 'Cat Tower' }, view: [100, 172], shapes: [
      // القطة السفلى (كاليكو، تضحك)
      P([18, 132, 20, 104, 42, 118], 'O'), P([82, 132, 80, 104, 58, 118], 'W'),
      E(50, 140, 36, 27, 0, 'W'),
      E(31, 129, 13, 10, -20, 'O', D), E(74, 147, 9, 8, 0, 'N', D),
      Ln([33, 135, 40, 139, 33, 143], 2.2, 'K', DET), Ln([67, 135, 60, 139, 67, 143], 2.2, 'K', DET),
      E(50, 150, 6.5, 6, 0, 'K', DET), E(50, 153.5, 3.8, 2.4, 0, 'P', DET),
      blush(29, 147), blush(71, 147),
      E(28, 161, 7, 8, 0, 'W', OL), E(72, 161, 7, 8, 0, 'W', OL),
      // القطة الوسطى (خضراء، تلوّح)
      P([18, 84, 22, 56, 42, 72], 'S'), P([82, 84, 78, 56, 58, 72], 'S'),
      P([24, 78, 26, 63, 36, 72], 'P', D), P([76, 78, 74, 63, 64, 72], 'P', D),
      E(50, 92, 34, 25, 0, 'S', OL),
      happy(38, 91, 5), happy(62, 91, 5),
      Ln([44, 99, 47, 102, 50, 99, 53, 102, 56, 99], 1.8, 'K', DET),
      blush(29, 99), blush(71, 99),
      E(12, 72, 7, 9, -15, 'S', OL),
      E(36, 116, 8, 6, 0, 'S', OL), E(64, 116, 8, 6, 0, 'S', OL),
      // القطة العليا (بيضاء ورمادية، مندهشة)
      P([20, 38, 24, 10, 42, 26], 'A'), P([80, 38, 76, 10, 58, 26], 'A'),
      P([26, 32, 28, 18, 37, 26], 'P', D), P([74, 32, 72, 18, 63, 26], 'P', D),
      E(50, 46, 32, 24, 0, 'W', OL),
      E(67, 33, 11, 7, 20, 'A', D),
      ...eye(38, 47, 4.2, 5), ...eye(62, 47, 4.2, 5),
      P([47.5, 53, 52.5, 53, 50, 55.5], 'P', DET),
      E(50, 59.5, 2.8, 3, 0, 'P', DET),
      blush(30, 55), blush(70, 55),
      E(38, 68, 7, 5, 0, 'W', OL), E(62, 68, 7, 5, 0, 'W', OL),
    ] },
    // مرسومة بـ Gemini ومحوّلة بـ tools/img2map.js (art-src/bunny.png)
    { id: 'bunny', pack: 'animals', hd: 'img/hd/bunny.webp', w: 17, name: { ar: 'أرنوب', en: 'Bunny' }, grid: {"W": 17, "H": 26, "pal": "261314fffffffd9cade88b8ff3e7d2", "data": "AAAAgYEAAAAAAAAAgYEAAAAAAIECAoEAAAAAAIECAoEAAAAAgQICgQAAAAAAgQICgQAAAACBAgIDgQAAAIEEAgKBAAAAAIEDAwOBAAAAgQQDA4EAAAAAgQMDBIEAAACBBAMDgQAAAACBAwMEgQAAAIEEAwOBAAAAAIEDAwSBAAAAgQQDA4EAAAAAgQMDBIEAAACBBAMDgQAAAAAAgQMEgQAAAIEEAwOBAAAAAACBAwSBAAAAgQQDgQAAAAAAAIECBAKBgYECBAKBAAAAAAAAgQICAgICAgICAoEAAAAAAIECAgICAgICAgICAoEAAACBAgICAgICAgICAgICAoEAAIECAgICAgICAgICAgICgQCBAgICAoECAgICAoECAgICgYECAgKBgoECAgKBgoECAgKBgQICAoGBgQICAoGBgQICAoGBAgIDA4ECAgICAoEDAwICgQCBAwMDAgKBgQICAgMDA4EAAIECAgICAgICAgICAgICgQAAAIECAgICAgICAgIFBYEAAAAAAIEFBQUCAgUFBQWBAAAAAAAAAIEFBYGBgQUFgQAAAAAAAAAAAIGBAAAAgYEAAAAAAA"} },
    { id: 'bear', pack: 'animals', flat: 1, palette: AP, w: 22, name: { ar: 'دبدوب', en: 'Teddy' }, view: [100, 92], shapes: [
      C(20, 24, 13, 'N'), C(80, 24, 13, 'N'), C(20, 24, 7, 'n', D), C(80, 24, 7, 'n', D),
      E(50, 54, 42, 36, 0, 'N', OL),
      E(50, 67, 16, 12, 0, 'n', D),
      E(50, 62, 5.5, 4, 0, 'K', DET), Ln([50, 65, 50, 70], 1.6, 'K', DET), Ln([44, 70, 47, 72.5, 50, 70, 53, 72.5, 56, 70], 1.7, 'K', DET),
      ...eye(33, 50, 4, 4.6), ...eye(67, 50, 4, 4.6),
      blush(24, 64, 5), blush(76, 64, 5),
    ] },
    { id: 'fox', pack: 'animals', flat: 1, palette: AP, w: 22, name: { ar: 'ثعلوب', en: 'Fox' }, view: [100, 88], shapes: [
      P([10, 46, 16, 4, 44, 28], 'F'), P([90, 46, 84, 4, 56, 28], 'F'),
      P([19, 38, 21, 15, 36, 28], 'K', D), P([81, 38, 79, 15, 64, 28], 'K', D),
      E(50, 54, 40, 30, 0, 'F', OL),
      E(32, 67, 18, 13, 18, 'W', D), E(68, 67, 18, 13, -18, 'W', D), E(50, 75, 12, 8, 0, 'W', D),
      ...eye(35, 53, 3.6, 4.6), ...eye(65, 53, 3.6, 4.6),
      E(50, 67, 4.5, 3.4, 0, 'K', DET), Ln([45, 72, 48, 74, 50, 72, 52, 74, 55, 72], 1.6, 'K', DET),
      blush(24, 64), blush(76, 64),
    ] },
    { id: 'frog', pack: 'animals', flat: 1, palette: AP, w: 24, name: { ar: 'ضفدوع', en: 'Froggy' }, view: [100, 82], shapes: [
      C(28, 24, 15, 'G'), C(72, 24, 15, 'G'),
      E(50, 52, 46, 28, 0, 'G', OL),
      C(28, 24, 10, 'W', D), C(72, 24, 10, 'W', D),
      ...eye(30, 25, 4.6, 5.4), ...eye(74, 25, 4.6, 5.4),
      E(50, 64, 30, 12, 0, 'L', D),
      Ln([30, 52, 40, 58, 50, 60, 60, 58, 70, 52], 2.4, 'K', DET),
      blush(18, 55, 5.5), blush(82, 55, 5.5),
    ] },
    { id: 'penguin', pack: 'animals', flat: 1, palette: AP, ratio: 1.45, w: 22, name: { ar: 'بطريق', en: 'Penguin' }, view: [100, 122], shapes: [
      E(13, 74, 8, 20, 22, 'D'), E(87, 74, 8, 20, -22, 'D'),
      E(36, 116, 11, 5, 0, 'R'), E(64, 116, 11, 5, 0, 'R'),
      E(50, 64, 38, 50, 0, 'D', OL),
      C(38, 46, 15, 'W', D), C(62, 46, 15, 'W', D), E(50, 84, 26, 28, 0, 'W', D),
      ...eye(39, 46, 3.6, 4.4), ...eye(61, 46, 3.6, 4.4),
      P([44, 53, 56, 53, 50, 61], 'R', DET),
      blush(29, 56), blush(71, 56),
    ] },
    { id: 'chick', pack: 'animals', flat: 1, palette: AP, w: 22, name: { ar: 'صوص', en: 'Chick' }, view: [100, 104], shapes: [
      E(45, 9, 4, 9, -20, 'Y'), E(55, 9, 4, 9, 20, 'Y'),
      E(14, 56, 9, 13, 30, 'y'), E(86, 56, 9, 13, -30, 'y'),
      C(50, 48, 36, 'Y', OL),
      ...eye(38, 42, 3.8, 4.6), ...eye(62, 42, 3.8, 4.6),
      P([45, 50, 55, 50, 50, 57], 'R', DET),
      blush(29, 52), blush(71, 52),
      P([10, 64, 21, 55, 31, 66, 41, 55, 50, 66, 59, 55, 69, 66, 79, 55, 90, 64, 86, 88, 72, 100, 28, 100, 14, 88], 'E', OL),
    ] },
    { id: 'puppy', pack: 'animals', flat: 1, palette: AP, w: 22, name: { ar: 'جرو', en: 'Puppy' }, view: [100, 88], shapes: [
      E(15, 46, 11, 24, 15, 'N'), E(85, 46, 11, 24, -15, 'N'),
      E(50, 46, 35, 34, 0, 'M', OL),
      E(64, 40, 10, 9, 0, 'H', D),
      ...eye(37, 44, 3.8, 4.6), ...eye(63, 44, 3.8, 4.6),
      E(50, 62, 13, 10, 0, 'W', D),
      E(50, 57, 5, 3.6, 0, 'K', DET), Ln([44, 63, 47, 65, 50, 62, 53, 65, 56, 63], 1.6, 'K', DET), E(50, 69, 3.5, 4, 0, 'P', DET),
      blush(30, 58), blush(70, 58),
    ] },
    { id: 'lion', pack: 'animals', flat: 1, palette: AP, w: 24, name: { ar: 'أسد', en: 'Lion' }, view: [100, 100], shapes: [
      C(50, 50, 42, 'Q'), ...petals(50, 50, 40, 12, 10, 8, 'Q'),
      C(27, 25, 8, 'Y'), C(73, 25, 8, 'Y'), C(27, 25, 4, 'y', D), C(73, 25, 4, 'y', D),
      C(50, 54, 29, 'Y', OL),
      E(42, 66, 9, 7, 0, 'M', D), E(58, 66, 9, 7, 0, 'M', D),
      P([45, 58, 55, 58, 50, 63.5], 'N', DET),
      ...eye(39, 48, 3.6, 4.4), ...eye(61, 48, 3.6, 4.4),
      Ln([46, 71, 50, 73, 54, 71], 1.6, 'K', DET),
      blush(31, 58), blush(69, 58),
    ] },
    { id: 'friends3', pack: 'animals', flat: 1, palette: AP, ratio: 1.9, w: 22, name: { ar: 'برج الأصحاب', en: 'Friends Tower' }, view: [100, 180], shapes: [
      // الدب في الأسفل
      C(20, 130, 11, 'N'), C(80, 130, 11, 'N'), C(20, 130, 5.5, 'n', D), C(80, 130, 5.5, 'n', D),
      E(50, 152, 38, 27, 0, 'N'),
      E(50, 162, 13, 9, 0, 'n', D), E(50, 158, 4.5, 3.2, 0, 'K', DET), Ln([45, 165, 50, 167.5, 55, 165], 1.6, 'K', DET),
      happy(35, 150, 4.5), happy(65, 150, 4.5),
      blush(26, 160), blush(74, 160),
      // الأرنب في الوسط (آذان متدلية)
      E(17, 104, 8, 18, 25, 'W'), E(83, 104, 8, 18, -25, 'W'), E(17, 105, 4, 12, 25, 'P', D), E(83, 105, 4, 12, -25, 'P', D),
      E(50, 100, 32, 24, 0, 'W', OL),
      ...eye(39, 100, 3.4, 4.2), ...eye(61, 100, 3.4, 4.2),
      P([47, 106, 53, 106, 50, 109], 'P', DET), Ln([45, 112, 50, 110, 55, 112], 1.6, 'K', DET),
      blush(30, 108), blush(70, 108),
      E(36, 124, 8, 6, 0, 'W', OL), E(64, 124, 8, 6, 0, 'W', OL),
      // الصوص فوق
      E(46, 42, 3.5, 7, -20, 'Y'), E(54, 42, 3.5, 7, 20, 'Y'),
      E(30, 66, 6, 9, 30, 'y'), E(70, 66, 6, 9, -30, 'y'),
      C(50, 62, 18, 'Y', OL),
      ...eye(43, 59, 2.8, 3.4), ...eye(57, 59, 2.8, 3.4),
      P([46.5, 64, 53.5, 64, 50, 69], 'R', DET),
    ] },
    // ——— حزم جديدة: رسومات Higgsfield (Nano Banana 2) محوّلة بـ tools/img2map.js ———
    { id: 'octopus', pack: 'sea', hd: 'img/hd/octopus.webp', w: 20, name: { ar: 'أخطبوط', en: 'Octopus' }, grid: {"W": 20, "H": 18, "pal": "3302509b05fcb25bfad7a4fffcfcfdb576fd", "data": "AAAAAAAAAIGBgYGBgQAAAAAAAAAAAAAAAACBAgICAgMDgQAAAAAAAAAAAACBgQICAgICAwQEgYEAAAAAAAAAAIECAgICAgICAgQEgQAAAAAAAACBAgICAgICAgICAgICgQAAAAAAAIECAgICAgICAgICAgKBAAAAAAAAgQKBhYECAgICgYWBAoEAAAAAAACBAoGBgQICAgKBgYECgQAAAAAAAIGCgYGBAgICAoGBgQKBAAAAAIEAgYGCgYKBAgKBgoECAoEAgQCBgoEAgQICAgKBgQICAgKBAIGCgYECgQCBgYECAgICAgKBgYEAgQaBgQICgYGBgYECgYECgYGBgYEGBoEAgYaBgQKCgQKBgQKBggKBgYaBAACBgYECAoGBAoGBAoGBAgKBgYEAAIGCAgKBgQICgYECAoGBAgKCgQAAAIGBgYGBgoGBAIGCgYGBgYEAAAAAAAAAAIGBAAAAAIGBAAAAAAAA"} },
    { id: 'seahorse', pack: 'sea', hd: 'img/hd/seahorse.webp', w: 20, name: { ar: 'حصان البحر', en: 'Seahorse' }, grid: {"W": 20, "H": 30, "pal": "361202fc7f039d4806fdac59fdfcfcd25c03", "data": "AAAAAAAAAACBgYEAAAAAAAAAAAAAAAAAAIGBgYGBgYEAAAAAAAAAAAAAAAAAgYGBgYGBgYEAAAAAAAAAAAAAgYGBAgICAgICAoEAAAAAAAAAAIGDgYEEBAQEAgICAoEAAAAAAAAAAIGBAgQEAgICAgICgQAAAAAAAACBgYECBAICAgKBAgKBAAAAAAAAAIGDgQICAgICgYWBAgKBAAAAAAAAgYOBAgICAgKBgYECAgKBgYGBAACBgYECAgICAgICAgICAgQEBIEAAACBgYECAgICAgKBAgICAgICgQAAAIGBgQICgQICAoKBgYGBgYEAAAAAAIGBAgICgYGBgQAAAAAAAAAAAIEAAIECAgICAgKBAAAAAAAAAACBgoEAgQYCAgICBASBAAAAAAAAgYGBgoGBBgICAgIEBASBAAAAAACBhoKBgoEGAgICAgIEBIEAAAAAAACBgYaBgQICAgICAgQEgQAAAAAAAACBgYGBAgICAgICBASBAAAAAAAAAAAAAIECAgICAgQEgQAAAAAAAAAAAACBAgICAgIEBIEAAAAAAAAAAAAAAIECAgICgYGBAAAAAAAAAAAAAACBBgICAoGBgYGBAAAAAAAAAAAAAIEGAgICgYWBgoKBAAAAAAAAAAAAgQYCAoGBgYKBhYKBAAAAAAAAAAAAgQICgYGFgYKBAoEAAAAAAAAAAACBAgICgYWBgYGCgQAAAAAAAAAAAACBAgICgYGBgoEAAAAAAAAAAAAAAACBgQYGBoaBAAAAAAAAAAAAAAAAAAAAgYGBgQAAAAAAAAAA"} },
    { id: 'crab', pack: 'sea', hd: 'img/hd/crab.webp', w: 22, name: { ar: 'سلطعون', en: 'Crab' }, grid: {"W": 22, "H": 20, "pal": "3c0715f62d21f2f2f4", "data": "AAAAAIGBgQAAAAAAAAAAgYGBAAAAAAAAAIGCgYEAAAAAAAAAAIGBgoEAAAAAAIECAoEAAAAAAAAAAAAAgQICgYEAAIECAoEAAIGBAAAAAIGBAACBAgKBAIECAgKBAIGCgQAAAACBgoEAgQICAoGBAgICgYGCgYEAAAAAgYGCgYECAgKBgQICAgKBgoEAAAAAAACBgoECAgICgYGBAgICgoGBAAAAAAAAgYGCAgICgYEAgYGBgYEAAAAAAAAAAAAAgYGBgYEAAIGBgYEAAIGBgYGBgYGBAACBgYGBAACBgYGBAIECAgICAgICAoEAgYGBgQAAAIGBgYECAoGDAgKBgwICgYGBgQAAAAAAgYECAoGBgQICgYGBAgKBgQAAAAAAAACBAgICgQICAgKBAgICgoEAAAAAAACBgQICAgICgYECAgICAoGBAAAAAAAAgYGBAgICAgICAgICAoGBgQAAAAAAgYGBgYECAgICAgICAoGBgYGBAAAAAIGBgYGBgYECAgICgYGBgYGBgQAAAACBAIGBAIGBgYGBgYGBAIGBAIEAAAAAAAAAgQAAAIGBgYEAAACBAAAAAAA"} },
    { id: 'dolphin', pack: 'sea', hd: 'img/hd/dolphin.webp', w: 20, name: { ar: 'دلفين', en: 'Dolphin' }, grid: {"W": 20, "H": 19, "pal": "010c330f67cd298ce5fefeffdae5eb", "data": "AAAAgYGBgYEAAIGBgYGBgQAAAAAAAAAAgYIDg4GBAwMDAwMDgQAAAAAAAAAAgYGBAwMDAwMDAwMDgQAAAAAAAACBAwMDAwMDA4GBAwOBgQAAAAAAgQMDAwMDAwMDAwMDAwODgQAAAACBAwMDAwMDAwQEBIGBgYGBAAAAgQMDAwMDAwMEBAQEBASEgQAAAACBAwMDAwMDgQQEBAQEgYEAAAAAgQMDAwOBAwOBBAUFBYEAAAAAAACBAwMDgYMDgYUFBYGBgQAAAAAAAIEDAwQEgYGFgYGBgYEAAAAAAAAAgQMDBASFgYEAAACBgQAAAAAAAACBAwQEgYEAAAAAAAAAAAAAAAAAAIEDBIGBAAAAAAAAAAAAAAAAAAAAgQMEgQAAAAAAAAAAAAAAAAAAAACBA4GBAAAAAAAAAAAAAAAAAAAAgQQEBASBAAAAAAAAAAAAAAAAAIGEBIGBBISBAAAAAAAAAAAAAAAAgYGBAACBgYEAAAAAAAAAAAAAAAA"} },
    { id: 'jellyfish', pack: 'sea', hd: 'img/hd/jellyfish.webp', w: 18, name: { ar: 'قنديل البحر', en: 'Jellyfish' }, grid: {"W": 18, "H": 21, "pal": "1a041cf876a6fdcde2ffffffcd3166", "data": "AAAAAAAAgYGBgYGBAAAAAAAAAAAAAIGBgQICAgKBgYEAAAAAAAAAgYEDAgICAgICAoGBAAAAAACBAwMDAgICAgICAgICgQAAAIGBAwMCAgICAgICAgICgYEAAIECAwICAgICAgICAgICAoEAgYECAgICgQICAgICgQICAoGBgQICAgKBhIECAgKBhAICAgWBgQICAgKBgYECAoGBgQICAgWBgQICAgICAoGBgoECAgICBQWBgQICAgICAgKBgQICAgIFBQWBAIGBBQUFBQUFBQUFBQUFgYEAAACBgYGBgYGBgYGBgYGBgQAAAAAAgYWBgYGEgYGBgYWBAAAAAAAAgQKBgYGBgYGBgQKBAAAAgYEAgYKBgYKBgYGBgYKBAIGBgYGBgYGBgYKBgYWBgYGBgYGBAIGChYGEgYEAgQKBAIGFAoWBAACBgQCBgYEAgYKBAACBgYEAAAAAAACBgoEAgYGBgQAAAAAAAAAAAACBgYEAAACBgQAAAAAA"} },
    { id: 'pufferfish', pack: 'sea', hd: 'img/hd/pufferfish.webp', w: 20, name: { ar: 'سمكة منفوخة', en: 'Pufferfish' }, grid: {"W": 20, "H": 19, "pal": "161719f9d611fdfdfdc24c05", "data": "AAAAAAAAAAAAgYEAAAAAAAAAAAAAAAAAAAAAAIGBgYEAAAAAAAAAAAAAAAAAgYGBAgICAoGBgQAAAAAAAAAAAIECAgICAgICAgICgQAAAAAAAACBAgICAgICAgICAgICgQAAAAAAgYECAgICAgICAgICAgKBgQAAAACBAgICAgICAgICAgICAgKBAAAAAIECgYOBgQICAgKBg4GBAoEAAIGBAgKBgYGBAgICAoGBgYECAoGBgYQCAoGBgYECAgICgYGBgQIChIGBgQICAoGBgQICAgKBgYECAgKBgQAAgQICAgICgQICgQICAgICgQAAAACBAgICAgICAgICAgICAgKBAAAAAIGBAgICAgICAgICAgICgYEAAAAAAIECAgICAgICAgICAgKBAAAAAAAAgYECAgICAgICAgICgYEAAAAAAAAAAIGBgQICAgKBgYEAAAAAAAAAAAAAAIEAgYGBgQCBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"} },
    { id: 'starfish', pack: 'sea', hd: 'img/hd/starfish.webp', w: 20, name: { ar: 'نجمة البحر', en: 'Starfish' }, grid: {"W": 20, "H": 19, "pal": "0d172cfe7543d64514ffbb88", "data": "AAAAAAAAAAAAgYEAAAAAAAAAAAAAAAAAAAAAAIECAoEAAAAAAAAAAAAAAAAAAAAAgQICgQAAAAAAAAAAAAAAAAAAAIECAgICgQAAAAAAAAAAAAAAAAAAgQICAgKBAAAAAAAAAAAAAIGBgYECAgICAgKBgYGBAAAAAIGBAgICAgICAgICAgMDAwOBgQCBAgICBAQEAgICAgICAgICAgICgYECAgICAgICAgICAoECAgICAgKBAIECAgICAoGBAgKBgQICAgICgQAAAIECAgICAgICAgICAgICAoEAAAAAAIECAgICAoGBAgICAwOBAAAAAAAAAIEEAgICAgICAgIDgQAAAAAAAAAAgQQCAgICAgICAgKBAAAAAAAAAACBBAICAgICAgICAoEAAAAAAAAAgQICAgICgYECAgICA4EAAAAAAACBAgICAoEAAIECAgIDgQAAAAAAAIECAgKBAAAAAIEDAwOBAAAAAAAAgYGBgQAAAAAAAIGBgYEAAAA"} },
    { id: 'whalesub', pack: 'sea', hd: 'img/hd/whalesub.webp', w: 22, name: { ar: 'غواصة صفراء', en: 'Submarine' }, grid: {"W": 22, "H": 18, "pal": "0c1732fbde01d1a701e3e4e71c52b1", "data": "AAAAAAAAAAAAAAAAgYGBgQAAAAAAAAAAAAAAAAAAAAAAgQICg4EAAAAAAAAAAAAAAAAAAAAAAIGCgYGBAAAAAAAAAAAAAAAAAAAAAACBgYEAAAAAAAAAAAAAAAAAAAAAgYGBgYGBgQAAAAAAAAAAAAAAAAAAgQICAgICAgKBAAAAAAAAAAAAAAAAAIECAgICAgICgYEAAAAAAACBgQAAgYECAgICAgICAgKBgYGBAAAAgYKBgQICAgICAgICAgICAgIDA4EAgYGBgQICgYECAoGBAgICgYQCAwOBAIGBgQICgQUFgYGBhYECgYWBgQMCAoEAgQICAoQFBYGBhQWEAoQFhYEDAgKBgYECAgKBgYGBgoGBgQKBgYECAwICgYGBgQMCAgICAgICAgICAgICAgMCAoGBg4EDAwICAgICAgICAgICAgICAoEAAIGBgYEDAwMCAgICAgICAgICAwOBAAAAAAAAgYEDAwMDAwMDAwMDAwOBAAAAAAAAAAAAgYGBgYGBgYGBgYGBAAAA"} },
    { id: 'shark', pack: 'sea', hd: 'img/hd/shark.webp', w: 22, name: { ar: 'قرش لطيف', en: 'Shark' }, grid: {"W": 22, "H": 15, "pal": "091a49718c9dfcfdfd7dc7c047667c", "data": "AAAAAAAAAAAAAACBgYEAAAAAAAAAAAAAAAAAAAAAAACBAoKBAAAAAAAAAAAAAAAAAAAAgYGBAgKBAAAAAAAAAAAAAAAAAIGBgQICAgICAoEAAAAAAAAAgQAAAIECAgICAgICAgKBgQAAAACBgYEAgYECAgKBAgICAgICAgKBAACBAoKBgQICAgKBgYECAgICAgICAoGBgQKBAIEDAwICAoECAoGDAgICAgICgQICgQAAgQMDAwOBAwKBgQICAgICAgICgQAAAIGBgYGBgQMCAgICAgICAgKBgYKBAAAAgYGBgQMDAwMCAgICAgKBAACBgQAAAACBgYMDAwMDgQICgYGBAAAAAIEAAAAAAACBgQQEBIECAoEAAAAAAAAAAAAAAAAAAIGFgYGBgYGBAAAAAAAAAAAAAAAAAAAAgYEAAAAAgQAAAAAAAAAA"} },
    { id: 'donut', pack: 'sweets', hd: 'img/hd/donut.webp', w: 20, name: { ar: 'دونات', en: 'Donut' }, grid: {"W": 20, "H": 18, "pal": "030208f859a9ec8a33fdd2ebf3a64f", "data": "AAAAAAAAAIGBgYGBgQAAAAAAAAAAAAAAAIGBAgICAgICgYEAAAAAAAAAAACBAgICAgICAgICAoEAAAAAAAAAgQICAgICAgICAgICAoEAAAAAAIECAgICAgICAgICAgICAoEAAACBAgICAgICAwMDAwICAgICAoEAAIECAgICAgMDAwMDAwICAgICgQCBAgICAgICA4GBgYEDAgICAgICgYECAgICAgKBBAQEBIECAgICAgKBgQICAgIFBYEEBAQEgQUCAgICAoGBAgUFBQUFBYEEBIEFBQUFBQUCgQCBBQUFBQUFBYGBBQUFBQUFBYEAAIEDBQUFBQUFBQUFBQUFBQUDgQAAgQMDBQUFBQUFBQUFBQUFAwOBAAAAgQMDBQUFBQUFBQUFBQMDgQAAAAAAgQMDAwUFBQUFBQMDA4EAAAAAAAAAgYGBAwMDAwMDgYGBAAAAAAAAAAAAAACBgYGBgYEAAAAAAAAA"} },
    { id: 'cupcake', pack: 'sweets', hd: 'img/hd/cupcake.webp', w: 18, name: { ar: 'كب كيك', en: 'Cupcake' }, grid: {"W": 18, "H": 22, "pal": "251813de2120fdc4cdfe70ace74e90a74a0cc76018", "data": "AAAAAAAAAAAAAIEAAAAAAAAAAAAAAAAAAAAAgQAAAAAAAAAAAAAAAAAAAIGBgYEAAAAAAAAAAAAAAAAAAIECAoEAAAAAAAAAAAAAAIGBgYECAoGBgYEAAAAAAAAAgQMDgYGBgYGBBASBAAAAAACBAwMDBIGBgYEEBAQFgQAAAACBAwQEBAQEBAQEBAQFgQAAAIEEBAQEBAQEBAQEBAQFBYEAgQQEBAQEBAQEBAQEBQUFBAWBgQQEBAQEBAQEBAUFBQUEBAWBgQQEBAQEBAQEBAQEBAQEBQWBAIEEBAQEBAQEBAQEBAUFBYEAAIGBBAQEBAQEBAQFBQUFgYEAAIGBgYGBgYGBgYGBgYGBgYEAAACBBgaBgYGBgYGBgQYGgQAAAACBBgYHBwcHBgcHBwYHgQAAAACBgQYHBwcHBgcHBwYHgQAAAACBgQYHBwcHBgcHBwcHgQAAAAAAgQYHBwcHBgcHBweBAAAAAAAAgYGBBgYGBgYGgYGBAAAAAAAAAAAAgYGBgYGBAAAAAAAA"} },
    { id: 'lollipop', pack: 'sweets', hd: 'img/hd/lollipop.webp', w: 18, name: { ar: 'مصاصة', en: 'Lollipop' }, grid: {"W": 18, "H": 24, "pal": "121842ec342cf68026f8f6f7fae33166b84e15a1df8543a38d5931", "data": "AAAAAAAAgYGBgYGBAAAAAAAAAAAAAACBgYICAoKBgQAAAAAAAAAAgYGDg4GEgYGDBIGBAAAAAACBBYOBgQUFBYGBBAQEgQAAAACBg4EFBQUFBQUFgQQEgQAAAIGFgQUFgYGBgYEFhYEEBIEAgYGGgYWBgQcHh4GBgYWBg4GBgYeBhYGBhgeBgYGHgYGFgYKBgQeBBYGCgYGBgYOBh4EGgQKBgQeBBYGCgYGGgQKBh4EGgQKBgYiBBQWBgoGBAgKBgYGGgYKBAIGBgYWBAgICAoGBgYeBgYEAAIGIgYGHgYGBgYGBgYaBgoEAAACBiIGBh4GBgYGBhoGBgQAAAAAAgYiBgYGBgYiBgYGBAAAAAAAAAIGBiAgIiIGBgYEAAAAAAAAAAAAAgYGBgYGBAAAAAAAAAAAAAAAAAIEJCYEAAAAAAAAAAAAAAAAAAIEJCYEAAAAAAAAAAAAAAAAAAIEJCYEAAAAAAAAAAAAAAAAAAIEJCYEAAAAAAAAAAAAAAAAAAIEJCYEAAAAAAAAAAAAAAAAAAIEJCYEAAAAAAAAAAAAAAAAAAACBgQAAAAAAAAAA"} },
    { id: 'cake', pack: 'sweets', hd: 'img/hd/cake.webp', w: 22, name: { ar: 'قطعة كيك', en: 'Cake Slice' }, grid: {"W": 22, "H": 22, "pal": "3c1f115eb570e33731fceedafcb647fd6884", "data": "AAAAAAAAAAAAAAAAgYGBgQAAAAAAAAAAAAAAAAAAAACBgYECAoEAAAAAAAAAAAAAAAAAAACBAwMDAwKBgQAAAAAAAAAAAAAAAACBAwMDAwOBgYGBgQAAAAAAAAAAAACBgQMDAwMDgYEEBIGBAAAAAAAAAACBhIEDAwMDA4EEBAQEgYEAAAAAAACBBASBAwMDA4EEBAQEBASBgQAAAIGBBAQEBIGBgYEEBAQEBAQEBIEAAIEEBAQEBAQEBAQEBAQEBAQFBQSBAIEEBAQEBAQEBAQEBAUFBQUFBQUEgYEEBAQEBAQEBQUFBQUFBQUFBQUFBIGBBAQEBQUFBQUFBQUFBQUFBQUFBQSBgQUFBQUFBQUFBQUFBQUGBgYGBgYEgYEFBQUFBQUFBQUGBgYGBgYEBAQEBIGBBQUGBgYGBgYGBgYEBAQEBAQEBASBgQQGBgYGBAQEBAQEBAQEBAYGBgYEgYEEBAQEBAQEBgYGBgYGBQUFBQUFBIGBBAYEBgYGBgYFBgUFBQUFBQUFBQSBgQYGBgYFBQUFBQUFBQUFBYGBgYGBAIEFBQYFBQUFBQUFBYGBgYGBAAAAAACBBQUFBQUFgYGBgYEAAAAAAAAAAAAAAIGBgYGBgQAAAAAAAAAAAAAAAAAAAA"} },
    { id: 'macaron', pack: 'sweets', hd: 'img/hd/macaron.webp', w: 16, name: { ar: 'ماكرون', en: 'Macarons' }, grid: {"W": 16, "H": 23, "pal": "242323fcb5c0f092a0fcfafca3f7a483ce93b67dc9dba0dc", "data": "AAAAAACBgYGBgYEAAAAAAAAAAIGBAgICAgICgYEAAAAAAACBAgICAgICAgKBAAAAAACBgwMCAgICAgIDg4EAAAAAAIEDAwMDAwMDA4EAAAAAAIEEBAQEBAQEBAQEgQAAAACBBAQDAwMDAwMEBIEAAAAAAIEEAgICAgICBIEAAAAAAIGFgYGBgYGBgYGFgQAAAIEFBQUFBQUFBQUFBQWBAACBBQUFBQUFBQUFBQUFgQAAgQYGBgYGBgYGBgYGBoEAAIEEBAQEBAQEBAQEBAaBAACBBAYGBgYGBgYGBgYGgQAAgYEGBgUFBQUFBQUGgYEAAIGHgYGBgYGBgYGBgYeBAIEICAgICAgICAgICAgICIGBCAgICAgICAgICAgICAiBgQcHCAgICAgICAgIBwcHgYEHBAQEBAQEBAQEBAQEB4GBBwcHBwcHBwcHBwcHBweBAIEICAgICAgICAgICAiBAACBgYGBgYGBgYGBgYGBgQA"} },
    { id: 'candy', pack: 'sweets', hd: 'img/hd/candy.webp', w: 22, name: { ar: 'سكاكر', en: 'Candy' }, grid: {"W": 22, "H": 21, "pal": "0611428bd3f7fe458cfaf8f5b71b58", "data": "AAAAAAAAAAAAAAAAAAAAAIGBAAAAAAAAAAAAAAAAAAAAAAAAAIGBgoEAAAAAAAAAAAAAAAAAAAAAAACBAgICgQAAAAAAAAAAAACBgYGBgYEAgQICAoEAAAAAAAAAAIGBAwMEBAQEgYECAgICgQAAAAAAAIGBAwMDBAQEBAOBgQICAoKBAAAAAIGBAwMDBAQEAwMDA4GBAgKBgQAAAACBBAMDAwQEBAMDAwMDgYGBAAAAAACBgQQEAwMDBAMDAwMDA4GBAAAAAAAAgYEEBAQDAwQDBAQEBASBgQAAAAAAAIGBBAQEBAQDAwMEBAQEgYEAAAAAAACBgQQEBAQEAwQDAwMEBIGBAAAAAAAAgYEDAwMDAwMEAwMDAwSBgQAAAAAAAACBAwMDAwMEBAQDAwMEgQAAAAAAgYGBgQMDAwMEBAQEAwMFBYEAAAAAgYICAgKBAwMEBAQEAwMFBYEAAAAAAIGBAgICAoGBBAQEBAMDgYEAAAAAAAAAAIECAgKBgYGBgYGBgYEAAAAAAAAAAACBAgICgQAAgYGBgQAAAAAAAAAAAAAAAIGBgYEAAAAAAAAAAAAAAAAAAAAAAAAAgYEAAAAAAAAAAAAAAAAAAAAA"} },
    { id: 'cookie', pack: 'sweets', hd: 'img/hd/cookie.webp', w: 20, name: { ar: 'كوكيز', en: 'Cookie' }, grid: {"W": 20, "H": 19, "pal": "32180adb9632f1c86ad2c8c4a8611a", "data": "AAAAAAAAAIGBgYGBAAAAAAAAAAAAAAAAgYGBAgICgoEAAAAAAAAAAAAAAIGBgwICAgKBgQAAAAAAAAAAAACBgYOBhAICAoGBgQAAAAAAAAAAAIECAoGBgQICAoGFgQAAAAAAAACBAgICgYGBAgICAgICgQAAAAAAAIECAgKBgQICAgKBhAICgYEAgQCBAgICAgICAgICgYGBgQICAoGFgYECgYSBAgICAgICgYECAgICAgKBgQKBgYECAoGEgQICAgICgYSBAoGBAgKBAgICgYGBAgICAgKBgYECgYECAgICAgICgYECAgICAoGBAgKBAIECAgICAgICAgICAgICAgICgQAAgQICgYSBAgICAgICgYSBAgKBAAAAgQKBgYECAgICAgKBgYECgQAAAACBhYGBAgICgYECAoGBAgKBAAAAAACBhQICAoGBgQICAgICgQAAAAAAAACBgQICgoGBAgICgYEAAAAAAAAAAAAAgYGBgYGBgYEAAAAAAAA"} },
    { id: 'gummy', pack: 'sweets', hd: 'img/hd/gummy.webp', w: 16, name: { ar: 'دب جيلي', en: 'Gummy Bear' }, grid: {"W": 16, "H": 22, "pal": "041f05267c3460ba61d8fbcf75cc6c", "data": "AACBgYEAAAAAAIGBgYEAAACBAgICgYGBgYECAgKBAAAAgQICAgMDAwMDAwICgQAAAACBAwMDAwMDAwMDA4EAAAAAgQMDA4GBAwMDgQOBAAAAAIEDAwOBAwOBhIEDgQAAAACBAwMDAwMDgYMDA4EAAAAAgQMDAwMDgYGBAwOBAAAAAIEDAwMDAwMDAwOBAAAAAACBAwMDAwMDAwICgYEAAACBBQUDAwMCAgICAgICgQCBBQUFBQMDAwMDAwMCAgKBgQUFBQUDAwMDAwMDAgICgYEFBQUFAwMDAwMDAwICgYGBAwMDAwMDAwMDAwMCAoEAgQMDAwMDAwMDAwMDAgKBAIEDAwMDAwMDAwMDAgICgQCBAwMDAwMDAwMDAgICgQAAAIEDAwMDAgICAgKBgYEAAACBAwMDAwOBgYGBgYKBAAAAAIEDAwOBAACBgoKBAAAAAAAAgYGBgQAAAIGBAAAAAA"} },
  ];
  PICTURES.push(...ANIMALS);

  // ===================== التحويل لبكسل =====================
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const x = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + x(f(0)) + x(f(8)) + x(f(4));
  }
  const hueToward = (h, target, amt) => { let d = ((target - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };
  const toneCache = {};
  /** 0 حدود، 1 ظل، 2 أساس، 3 إضاءة */
  function tone(hex, t) {
    const k = hex + t;
    if (toneCache[k]) return toneCache[k];
    let [h, s, l] = hexToHsl(hex);
    let out = hex;
    if (t === 3) out = hslToHex(hueToward(h, 55, s > 0.1 ? 6 : 0), s, l + (1 - l) * 0.38);
    else if (t === 1) out = hslToHex(hueToward(h, 235, s > 0.1 ? 10 : 0), Math.min(1, s + 0.06), l * 0.8 - 0.02);
    else if (t === 0) out = hslToHex(hueToward(h, 235, s > 0.1 ? 14 : 0), s * 0.75, Math.max(0.1, l * 0.42));
    toneCache[k] = out;
    return out;
  }

  function colorOf(pic, ch) {
    return (pic.palette && pic.palette[ch]) || PALETTE[ch] || '#999999';
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy;
    let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + t * dx - px, qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function prep(s) {
    if (s._ok) return s;
    if (s.t === 'e') { const a = s.a * Math.PI / 180; s._c = Math.cos(a); s._s = Math.sin(a); }
    // صندوق الإحاطة
    let x0, y0, x1, y1;
    if (s.t === 'c') { x0 = s.x - s.r; x1 = s.x + s.r; y0 = s.y - s.r; y1 = s.y + s.r; }
    else if (s.t === 'e') {
      const hx = Math.sqrt(Math.pow(s.rx * s._c, 2) + Math.pow(s.ry * s._s, 2));
      const hy = Math.sqrt(Math.pow(s.rx * s._s, 2) + Math.pow(s.ry * s._c, 2));
      x0 = s.x - hx; x1 = s.x + hx; y0 = s.y - hy; y1 = s.y + hy;
    } else if (s.t === 'r') { x0 = s.x; y0 = s.y; x1 = s.x + s.w; y1 = s.y + s.h; }
    else {
      const xs = s.p.filter((_, i) => i % 2 === 0), ys = s.p.filter((_, i) => i % 2 === 1);
      const pad = s.t === 'l' ? s.w / 2 : 0;
      x0 = Math.min.apply(null, xs) - pad; x1 = Math.max.apply(null, xs) + pad;
      y0 = Math.min.apply(null, ys) - pad; y1 = Math.max.apply(null, ys) + pad;
    }
    s._b = [x0, y0, x1, y1];
    s._ok = true;
    return s;
  }
  function hit(s, x, y) {
    const b = s._b;
    if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) return false;
    switch (s.t) {
      case 'c': return (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y) <= s.r * s.r;
      case 'e': {
        const dx = x - s.x, dy = y - s.y;
        const u = dx * s._c + dy * s._s, v = -dx * s._s + dy * s._c;
        return (u * u) / (s.rx * s.rx) + (v * v) / (s.ry * s.ry) <= 1;
      }
      case 'r': {
        const r = s.r;
        if (!r) return true;
        const qx = Math.max(s.x + r, Math.min(x, s.x + s.w - r)), qy = Math.max(s.y + r, Math.min(y, s.y + s.h - r));
        return (x - qx) * (x - qx) + (y - qy) * (y - qy) <= r * r;
      }
      case 'p': {
        const p = s.p; let inside = false;
        for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
          const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        return inside;
      }
      case 'l': {
        const p = s.p, hw = s.w / 2;
        for (let i = 0; i < p.length - 2; i += 2) if (segDist(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= hw) return true;
        return false;
      }
    }
    return false;
  }

  const rasterCache = {};
  /** رقعة جاهزة (من صورة محوّلة): نفس ترميز روابط الهدايا — كل بايت = رقم اللون+1، والبت 128 = خانة ثابتة */
  function fromGrid(g, mirror) {
    const W = g.W, H = g.H, cols = g.pal.match(/[0-9a-f]{6}/gi).map(c => '#' + c.toLowerCase());
    const b64 = g.data.replace(/-/g, '+').replace(/_/g, '/');
    const bin = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const mask = new Uint8Array(W * H), color = new Array(W * H).fill(null), fixed = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = bin.charCodeAt(y * W + x), k = v & 127, j = y * W + (mirror ? W - 1 - x : x);
      if (k && cols[k - 1]) { mask[j] = 1; color[j] = cols[k - 1]; fixed[j] = v & 128 ? 1 : 0; }
    }
    return { W, H, mask, color, fixed };
  }
  /** يحوّل لوحة أشكال إلى رقعة: العرض ≤ size والارتفاع ≤ size×1.4 (يناسب شاشة الجوال الطولية) */
  function rasterize(pic, size, mirror, soft) {
    const key = pic.id + '|' + size + '|' + (mirror ? 1 : 0) + (soft ? '|s' : '');
    if (rasterCache[key]) return rasterCache[key];
    if (pic.grid) return (rasterCache[key] = fromGrid(pic.grid, mirror));
    const [VW0, VH0] = pic.view || [100, 100];
    const shapes = pic.shapes.map(prep);
    // حدود الرسمة الفعلية
    let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
    for (const s of shapes) {
      if (s.cut) continue;
      bx0 = Math.min(bx0, s._b[0]); by0 = Math.min(by0, s._b[1]); bx1 = Math.max(bx1, s._b[2]); by1 = Math.max(by1, s._b[3]);
    }
    bx0 = Math.max(0, bx0); by0 = Math.max(0, by0); bx1 = Math.min(VW0, bx1); by1 = Math.min(VH0, by1);
    const VW = bx1 - bx0, VH = by1 - by0;
    const cs = Math.max(VW / size, VH / (size * (pic.ratio || 1.4)));
    const W = Math.max(1, Math.ceil(VW / cs - 0.01)), H = Math.max(1, Math.ceil(VH / cs - 0.01));
    const ox = bx0 + (VW - W * cs) / 2, oy = by0 + (VH - H * cs) / 2;
    const N = 4, NN = N * N;
    // صناديق المجموعات للتظليل
    const gbox = {};
    shapes.forEach((s, i) => {
      if (s.cut) return;
      const g = s.g || ('#' + i), b = s._b;
      const o = gbox[g] || (gbox[g] = [Infinity, Infinity, -Infinity, -Infinity]);
      o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]);
    });
    const owner = new Int16Array(W * H).fill(-1);
    const cnt = new Float32Array(shapes.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        cnt.fill(0);
        let bg = 0;
        for (let sy = 0; sy < N; sy++) for (let sx = 0; sx < N; sx++) {
          let px = ox + (x + (sx + 0.5) / N) * cs;
          const py = oy + (y + (sy + 0.5) / N) * cs;
          if (mirror) px = bx0 + bx1 - px;
          let idx = -1;
          for (let i = shapes.length - 1; i >= 0; i--) { if (hit(shapes[i], px, py)) { idx = shapes[i].cut ? -1 : i; break; } }
          if (idx < 0) bg++; else cnt[idx] += shapes[idx].pri || 1;
        }
        if (bg > NN * 0.55) continue;
        let best = -1, bv = 0;
        for (let i = 0; i < shapes.length; i++) if (cnt[i] > bv || (cnt[i] === bv && bv > 0)) { bv = cnt[i]; best = i; }
        owner[y * W + x] = best;
      }
    }
    // قص الأطراف الفارغة
    let minX = W, minY = H, maxX = -1, maxY = -1;
    for (let i = 0; i < W * H; i++) if (owner[i] >= 0) {
      const x = i % W, y = (i / W) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const W2 = maxX - minX + 1, H2 = maxY - minY + 1;
    const mask = new Uint8Array(W2 * H2), color = new Array(W2 * H2).fill(null), own = new Int16Array(W2 * H2).fill(-1);
    // خانات ثابتة (الحدود والتفاصيل الدقيقة): في وضع الرسم بالأسهم تبقى مرسومة مثل خطوط كتاب التلوين
    const fixed = new Uint8Array(W2 * H2);
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) own[y * W2 + x] = owner[(y + minY) * W + x + minX];
    // الضوء من الأعلى-يسار على الشاشة
    const Lx = mirror ? -0.55 : 0.55, Ly = 0.83;
    const outline = W2 >= 13 && !soft;   // soft: بدون حدود داكنة (لوحة كلها أسهم لامعة)
    for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
      const i = y * W2 + x, o = own[i];
      if (o < 0) continue;
      mask[i] = 1;
      const s = shapes[o];
      const base = colorOf(pic, s.c);
      const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].map(([nx, ny]) => (nx < 0 || ny < 0 || nx >= W2 || ny >= H2) ? -1 : own[ny * W2 + nx]);
      let t = 2;
      if (s.sh !== 'n' && !pic.flat) {
        const b = gbox[s.g || ('#' + o)];
        let px = ox + (x + minX + 0.5) * cs; if (mirror) px = bx0 + bx1 - px;
        const py = oy + (y + minY + 0.5) * cs;
        const hw = Math.max(1e-3, (b[2] - b[0]) / 2), hh = Math.max(1e-3, (b[3] - b[1]) / 2);
        const dx = (px - (b[0] + b[2]) / 2) / hw, dy = (py - (b[1] + b[3]) / 2) / hh;
        const l = dx * Lx + dy * Ly;
        if (l > 0.42) t = 1;
        else if (l < -0.62 && dx * dx + dy * dy < 0.95) t = 3;
      }
      if (outline && nb.some(v => v < 0)) t = 0;
      else if (!soft && s.ol && nb.some(v => v >= 0 && v < o && (shapes[v].g || v) !== (s.g || o) && shapes[v].c !== s.c)) t = 0;
      color[i] = tone(base, t);
      if (t === 0 || (s.pri || 1) >= 4) fixed[i] = 1;
    }
    const out = { W: W2, H: H2, mask, color, fixed, vt: { ox, oy, cs, minX, minY, bx0, bx1 } };
    rasterCache[key] = out;
    return out;
  }

  // ——— نسخة ناعمة عالية الدقة من اللوحة (تظهر بعد الفوز وبالمعرض بدل البكسل) ———
  // تترسم بنفس محاذاة الرقعة: كل خانة = k بكسل، فتنطبق فوق البكسلات تماماً
  const hdCache = {}, hdImgs = {};
  function shapePath(g, s) {
    g.beginPath();
    if (s.t === 'c') g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    else if (s.t === 'e') g.ellipse(s.x, s.y, s.rx, s.ry, s.a * Math.PI / 180, 0, Math.PI * 2);
    else if (s.t === 'r') { if (g.roundRect) g.roundRect(s.x, s.y, s.w, s.h, s.r || 0); else g.rect(s.x, s.y, s.w, s.h); }
    else { g.moveTo(s.p[0], s.p[1]); for (let i = 2; i < s.p.length; i += 2) g.lineTo(s.p[i], s.p[i + 1]); if (s.t === 'p') g.closePath(); }
  }
  function mkCanvas(w, h) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c;
  }
  /**
   * hdCanvas(pic, size, mirror, k, soft, onReady) → canvas بحجم W*k × H*k (أو null إذا ما في نسخة HD)
   * لوحات الأشكال: رسم متجهي مع تظليل وحدود ملوّنة. لوحات الصور (grid): الصورة الأصلية من img/hd/<id>.webp
   */
  function hdCanvas(pic, size, mirror, k, soft, onReady) {
    const r = rasterize(pic, size, mirror, soft);
    const key = pic.id + '|' + size + '|' + (mirror ? 1 : 0) + '|' + k + (soft ? 's' : '');
    if (hdCache[key]) { const c = hdCache[key]; if (!c._ready && onReady) c._cbs.push(onReady); return c; }
    const cv = mkCanvas(r.W * k, r.H * k);
    if (!cv) return null;
    const g = cv.getContext('2d');
    cv._cbs = onReady ? [onReady] : [];
    if (pic.grid) {
      if (!pic.hd) return null;
      const draw = im => {
        g.save(); if (mirror) { g.translate(cv.width, 0); g.scale(-1, 1); }
        g.imageSmoothingQuality = 'high'; g.drawImage(im, 0, 0, cv.width, cv.height); g.restore();
        cv._ready = true; cv._cbs.forEach(f => f(cv)); cv._cbs = [];
      };
      hdCache[key] = cv;
      let im = hdImgs[pic.id];
      if (!im) { im = hdImgs[pic.id] = new Image(); im._cbs = []; im.onload = () => { im._ok = true; im._cbs.forEach(f => f()); im._cbs = []; }; im.src = pic.hd; }
      if (im._ok) draw(im); else im._cbs.push(() => draw(im));
      return cv;
    }
    const vt = r.vt, sc = k / vt.cs, pad = Math.max(1.4, 0.12 * k);   // pad: سماكة الحدود (بكسل)
    // طبقة الألوان
    const lay = mkCanvas(cv.width, cv.height), L = lay.getContext('2d');
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.scale(sc, sc); L.translate(-(vt.ox + vt.minX * vt.cs), -(vt.oy + vt.minY * vt.cs));
    if (mirror) { L.translate(vt.bx0 + vt.bx1, 0); L.scale(-1, 1); }
    L.lineCap = 'round'; L.lineJoin = 'round';
    const shapes = pic.shapes.map(prep);
    const gbox = {};
    shapes.forEach((s, i) => {
      if (s.cut) return;
      const gk = s.g || ('#' + i), b = s._b, o = gbox[gk] || (gbox[gk] = [Infinity, Infinity, -Infinity, -Infinity]);
      o[0] = Math.min(o[0], b[0]); o[1] = Math.min(o[1], b[1]); o[2] = Math.max(o[2], b[2]); o[3] = Math.max(o[3], b[3]);
    });
    shapes.forEach((s, i) => {
      shapePath(L, s);
      if (s.cut) { L.save(); L.globalCompositeOperation = 'destination-out'; L.fillStyle = '#000'; L.fill(); L.restore(); return; }
      const base = colorOf(pic, s.c);
      let fill = base;
      if (s.sh !== 'n' && !pic.flat && s.t !== 'l') {
        const b = gbox[s.g || ('#' + i)], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, R = Math.max(b[2] - b[0], b[3] - b[1]) * 0.62;
        const lx = mirror ? cx + R * 0.32 : cx - R * 0.32;
        const gr = L.createRadialGradient(lx, cy - R * 0.38, R * 0.05, cx, cy, R * 1.12);
        gr.addColorStop(0, tone(base, 3)); gr.addColorStop(0.42, base); gr.addColorStop(0.8, base); gr.addColorStop(1, tone(base, 1));
        fill = gr;
      }
      if (s.t === 'l') { L.strokeStyle = base; L.lineWidth = s.w; L.stroke(); }
      else { L.fillStyle = fill; L.fill(); }
      if (s.ol && !soft && s.t !== 'l') { L.strokeStyle = tone(base, 0); L.lineWidth = Math.max(1.1, 1.6 * vt.cs / 2.2); L.stroke(); }
    });
    // لمعة صغيرة أعلى يسار كل مجموعة مظللة كبيرة
    if (!pic.flat) for (const gk in gbox) {
      const b = gbox[gk], w = b[2] - b[0], h = b[3] - b[1];
      if (w < 18 || h < 18) continue;
      const s0 = shapes.find((s, i) => !s.cut && (s.g || ('#' + i)) === gk);
      if (!s0 || s0.sh === 'n' || s0.t === 'l') continue;
      L.save(); shapePath(L, s0); L.clip();
      L.globalAlpha = 0.35; L.fillStyle = '#fff';
      const hx = mirror ? b[2] - w * 0.3 : b[0] + w * 0.3;
      L.beginPath(); L.ellipse(hx, b[1] + h * 0.24, w * 0.12, h * 0.07, mirror ? 0.6 : -0.6, 0, Math.PI * 2); L.fill();
      L.restore();
    }
    // الحدود الخارجية: نسخة داكنة من الرسمة نفسها مزاحة بكل الاتجاهات
    if (!soft) {
      const dk = mkCanvas(cv.width, cv.height), D = dk.getContext('2d');
      D.drawImage(lay, 0, 0);
      D.globalCompositeOperation = 'source-atop'; D.fillStyle = 'rgba(30,22,48,.82)'; D.fillRect(0, 0, dk.width, dk.height);
      for (let a = 0; a < 16; a++) { const an = a * Math.PI / 8; g.drawImage(dk, Math.cos(an) * pad, Math.sin(an) * pad); }
    }
    g.drawImage(lay, 0, 0);
    cv._ready = true; cv._cbs = [];
    hdCache[key] = cv;
    if (onReady) onReady(cv);
    return cv;
  }

  function mainPics() { return PICTURES.filter(p => !p.tutorial && !p.pack); }
  function packPics(pack) { return PICTURES.filter(p => p.pack === pack); }

  const api = { PALETTE, PICTURES, colorOf, rasterize, hdCanvas, tone, mainPics, packPics, C, E, Rr, P, Ln, CUT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
