/* Карта района «Ясный берег» — перенесена с основного сайта («сайт новый/…/map.js»).
   Подложка assets/img/map.svg собрана из данных OpenStreetMap (исходники — «сайт новый/…/map-src»).
   Скрипт ставит метки по координатам, рисует дуги от дома к выбранным местам и связывает
   карту со списком и фильтрами. Внешних картографических сервисов и ключей нет. */
(() => {
'use strict';
const root = document.querySelector('.neighborhood');
const frame = root && root.querySelector('.map');
if (!frame) return;

// Проекция подложки. Должна совпадать с center и size_m в map-src/config.json.
const MAP = {center: [55.014853, 82.89263], size: [2400, 1700]};
const HOME = [55.014404, 82.891847];
// Координаты — карта инфраструктуры на groupmeta.ru (см. MEDIA-SOURCES.md основного сайта).
const places = [
 {id:'water',category:'walk',name:'Собственная набережная',short:'Набережная',icon:'water',time:'≈6 мин',mode:'пешком',coords:[55.016304,82.898687],copy:'Почти километр прогулок вдоль Оби: велодорожки, смотровая площадка и места для отдыха.'},
 {id:'park',category:'walk',name:'Парк в центре квартала',short:'Парк',icon:'tree',time:'≈3 мин',mode:'пешком',coords:[55.013686,82.890469],copy:'Зоны отдыха, спортивные и детские площадки. Зимой — каток, летом — кино во дворе.'},
 {id:'school',category:'education',name:'Образовательный парк',short:'Школа',icon:'school',time:'≈5 мин',mode:'пешком · строится',coords:[55.015893,82.893528],copy:'Школа на 850 мест и детский сад на 280 мест. Новый корпус лицея № 22 «Надежды Сибири», строительство до 2027 года.'},
 {id:'kindergarten',category:'education',name:'Детский сад рядом',short:'Детский сад',icon:'kinder',time:'≈3 мин',mode:'пешком',coords:[55.014309,82.889121],copy:'Детский сад рядом с жилыми домами квартала.'},
 {id:'fitness',category:'daily',name:'Тренажёрный зал',short:'Фитнес',icon:'gym',time:'≈3 мин',mode:'пешком',coords:[55.014647,82.893926],copy:'Занятия рядом с домом — тренажёрный зал на территории квартала.'},
 {id:'shops',category:'daily',name:'Гипермаркет «Лента»',short:'Лента',icon:'cart',time:'≈18 мин',mode:'пешком',coords:[55.00926,82.877505],copy:'Продукты и всё для дома — в гипермаркете рядом с кварталом.'},
 {id:'square',category:'walk',name:'Сквер «Зелёный остров»',short:'Зелёный остров',icon:'tree',time:'≈5 мин',mode:'пешком',coords:[55.013648,82.882921],copy:'Ещё одно место для прогулок и отдыха рядом с Ясным берегом.'},
 {id:'city',category:'city',name:'Площадь Ленина',short:'Центр города',icon:'city',time:'≈7 мин',mode:'на автомобиле',coords:[55.030403,82.920338],copy:'Центр Новосибирска на другом берегу Оби. Время на автомобиле зависит от дорожной ситуации.'}
];
const icons = {
 water:'<path d="M3 15c2 0 2-1.5 4.5-1.5S9.5 15 12 15s2-1.5 4.5-1.5S19 15 21 15M3 19c2 0 2-1.5 4.5-1.5S9.5 19 12 19s2-1.5 4.5-1.5S19 19 21 19M12 3c-2 3-3.5 5-3.5 7a3.5 3.5 0 0 0 7 0c0-2-1.5-4-3.5-7z"/>',
 tree:'<path d="M12 3a5 5 0 0 0-5 5 4 4 0 0 0 1 7h8a4 4 0 0 0 1-7 5 5 0 0 0-5-5zM12 15v6"/>',
 school:'<path d="M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/>',
 kinder:'<circle cx="12" cy="6" r="2.5"/><path d="M7 21v-6l-2-3 4-3h6l4 3-2 3v6M10 21v-5h4v5"/>',
 gym:'<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
 cart:'<path d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6.2"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
 city:'<path d="M3 21V9h7v12M10 21V3h11v18M6 12v2M6 17v1M14 6v2M18 6v2M14 12v2M18 12v2M2 21h20"/>',
 home:'<path d="m3 10.5 9-7 9 7V21h-6v-6.5H9V21H3Z"/>'
};
const icon = (k, cls) => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[k]}</svg>`;

const [VW, VH] = MAP.size;
const KX = Math.cos(MAP.center[0] * Math.PI / 180) * 111320;
const project = ([lat, lon]) => [(lon - MAP.center[1]) * KX + VW / 2, -(lat - MAP.center[0]) * 111320 + VH / 2];
const pct = (v, total) => (v / total * 100).toFixed(3) + '%';
const [HX, HY] = project(HOME);

const $ = s => root.querySelector(s);
const world = frame.querySelector('.map__world'), pinLayer = frame.querySelector('.map__pins'), routeLayer = frame.querySelector('.map__routes');
const labels = [...frame.querySelectorAll('.map__lbl')];
const list = $('#map-places'), panel = $('.map-selected'), panelLabel = $('.map-selected-label'), panelTitle = $('.map-selected h3'), panelCopy = $('.map-selected-copy');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) frame.classList.add('map--anim');

// Дом: центр раскрытия, зона пешей доступности и кнопка сброса.
const home = document.createElement('button');
home.type = 'button'; home.className = 'pin pin--home';
home.setAttribute('aria-label', 'Ясный берег. Сбросить выбор мест');
home.innerHTML = icon('home', 'pin__ico') + '<span class="pin__lbl">Ясный берег</span>';
home.style.left = pct(HX, VW); home.style.top = pct(HY, VH);
frame.style.setProperty('--cx', pct(HX, VW)); frame.style.setProperty('--cy', pct(HY, VH));
const zone = frame.querySelector('.map__zone');
zone?.setAttribute('cx', HX.toFixed(0)); zone?.setAttribute('cy', HY.toFixed(0));
labels.forEach(el => { el.style.left = pct(+el.dataset.x, VW); el.style.top = pct(+el.dataset.y, VH); if (el.dataset.r) el.style.setProperty('--r', el.dataset.r + 'deg'); });

places.forEach((p, i) => {
 p.xy = project(p.coords); p.at = p.xy;
 const aria = `${p.name}, ${p.time} ${p.mode}`;
 p.item = document.createElement('button');
 p.item.type = 'button'; p.item.className = 'map-place'; p.item.dataset.place = p.id;
 p.item.setAttribute('aria-pressed', 'false'); p.item.setAttribute('aria-label', aria + '. Выбрать на карте');
 p.item.innerHTML = `<span class="map-place-icon">${icon(p.icon, '')}</span><span class="map-place-name">${p.name}<small>${p.time} ${p.mode}</small></span><span class="map-check" aria-hidden="true"></span>`;
 p.pin = document.createElement('button');
 p.pin.type = 'button'; p.pin.className = 'pin'; p.pin.dataset.pin = p.id; p.pin.style.setProperty('--n', i);
 p.pin.setAttribute('aria-pressed', 'false'); p.pin.setAttribute('aria-label', aria);
 p.pin.innerHTML = icon(p.icon, 'pin__ico') + `<i class="pin__dir" aria-hidden="true"></i><span class="pin__lbl">${p.short} <b>${p.time}</b></span>`;
 p.item.addEventListener('click', () => choose(p.id));
 p.pin.addEventListener('click', () => choose(p.id));
 // Наведение на строку списка подсвечивает метку, но не меняет выбор.
 p.item.addEventListener('pointerenter', () => p.pin.classList.add('is-hover'));
 p.item.addEventListener('pointerleave', () => p.pin.classList.remove('is-hover'));
 list.append(p.item); pinLayer.append(p.pin);
});
pinLayer.append(home);

const selected = new Set(['water']);
let category = 'all', touched = false, ready = false, inView = false, timer = null, shownKey = '';
const routes = new Map();

/* ---------- раскладка: масштаб как object-fit: cover, метки у края, раздвижка соседей ---------- */
function layout() {
 const w = frame.clientWidth, h = frame.clientHeight;
 if (!w || !h) return;
 const cs = getComputedStyle(frame);
 const s = Math.max(w / VW, h / VH);
 const ox = (w - VW * s) * (parseFloat(cs.getPropertyValue('--map-fx')) || .5);
 const oy = (h - VH * s) * (parseFloat(cs.getPropertyValue('--map-fy')) || .5);
 world.style.width = VW * s + 'px'; world.style.height = VH * s + 'px';
 world.style.transform = `translate(${ox.toFixed(1)}px,${oy.toFixed(1)}px)`;
 const hx = ox + HX * s, hy = oy + HY * s;
 const r = (places.find(p => !p.pin.hidden)?.pin.offsetWidth || 40) / 2;
 const nodes = [{x: hx, y: hy, r: home.offsetWidth / 2, fixed: true}];
 const left = r + 8, right = w - r - 8, top = r + 8, bottom = h - r - 26;
 for (const p of places) {
  if (p.pin.hidden) continue;
  let x = ox + p.xy[0] * s, y = oy + p.xy[1] * s, edge = false;
  // Место за кадром — метка встаёт у края по направлению от дома, стрелка показывает куда.
  if (x < left || x > right || y < top || y > bottom) {
   const dx = x - hx, dy = y - hy; let t = 1;
   if (x < left) t = Math.min(t, (left - hx) / dx);
   if (x > right) t = Math.min(t, (right - hx) / dx);
   if (y < top) t = Math.min(t, (top - hy) / dy);
   if (y > bottom) t = Math.min(t, (bottom - hy) / dy);
   x = hx + dx * t; y = hy + dy * t; edge = true;
   p.pin.style.setProperty('--a', Math.atan2(dy, dx).toFixed(3) + 'rad');
  }
  p.pin.classList.toggle('pin--edge', edge);
  nodes.push({p, x, y, r, fixed: edge});
 }
 // Соседние места в квартале ближе 150 м: раздвигаем на несколько пикселей, чтобы метки не накрывали друг друга
 // и подпись дома (она — неподвижный прямоугольник под домом).
 const homeLbl = home.querySelector('.pin__lbl'), hw = homeLbl.offsetWidth, hh = homeLbl.offsetHeight;
 const plateTop = hy - nodes[0].r + home.clientTop + homeLbl.offsetTop;
 const plate = {left: hx - hw / 2, right: hx + hw / 2, top: plateTop, bottom: plateTop + hh};
 for (let k = 0; k < 40; k++) {
  let moved = false;
  for (const n of nodes) {
   if (n.fixed) continue;
   const cx = Math.min(plate.right, Math.max(plate.left, n.x)), cy = Math.min(plate.bottom, Math.max(plate.top, n.y));
   let dx = n.x - cx, dy = n.y - cy, d = Math.hypot(dx, dy);
   if (d >= n.r + 4) continue;
   if (d < .01) { dx = 0; dy = 1; d = 1; }
   n.x += dx / d * (n.r + 4 - d); n.y += dy / d * (n.r + 4 - d); moved = true;
  }
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
   const a = nodes[i], b = nodes[j];
   if (a.fixed && b.fixed) continue;
   let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
   const gap = a.r + b.r + 6 - d;
   if (gap <= 0) continue;
   if (d < .01) { dx = 1; dy = 0; d = 1; }
   const ka = a.fixed ? 0 : b.fixed ? 1 : .5, kb = 1 - ka;
   a.x -= dx / d * gap * ka; a.y -= dy / d * gap * ka;
   b.x += dx / d * gap * kb; b.y += dy / d * gap * kb;
   moved = true;
  }
  for (const n of nodes) if (!n.fixed) { n.x = Math.min(right, Math.max(left, n.x)); n.y = Math.min(bottom, Math.max(top, n.y)); }
  if (!moved) break;
 }
 // Размеры подписей читаем до записи стилей: offsetWidth не зависит от анимации появления.
 nodes.forEach(n => { if (n.p) n.lw = n.p.pin.querySelector('.pin__lbl').offsetWidth; });
 // Подписи меток у края видны всегда — их раскладываем первыми, остальные их обходят.
 const taken = [];
 [...nodes].sort((a, b) => b.fixed - a.fixed).forEach(n => {
  if (!n.p) return;
  const p = n.p, lbl = p.pin.querySelector('.pin__lbl'), half = n.lw / 2 + 10;
  p.at = [(n.x - ox) / s, (n.y - oy) / s];
  p.pin.style.left = pct(p.at[0], VW); p.pin.style.top = pct(p.at[1], VH);
  // Подпись: сверху/снизу (сначала — от дома), слева или справа; берём место, где она не выходит
  // за кадр и меньше всего накрывает подпись дома и соседние метки. По горизонтали не выходит за край.
  const shift = Math.min(w - half, Math.max(half, n.x)) - n.x, lw = n.lw;
  const box = side => side === 'left' ? {left: n.x - r - 8 - lw, right: n.x - r - 8, top: n.y - 16, bottom: n.y + 16}
   : side === 'right' ? {left: n.x + r + 8, right: n.x + r + 8 + lw, top: n.y - 16, bottom: n.y + 16}
   : {left: n.x + shift - half, right: n.x + shift + half, top: side === 'below' ? n.y + r : n.y - r - 40, bottom: side === 'below' ? n.y + r + 40 : n.y - r};
  const overlap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const cost = side => {
   const b = box(side);
   if (b.left < 4 || b.right > w - 4 || b.top < 0 || b.bottom > h - 22) return 1e9;
   return (overlap(b, plate) + taken.reduce((sum, t) => sum + overlap(b, t), 0)) * 4 + nodes.reduce((sum, o) => o === n ? sum : sum + overlap(b, {left: o.x - o.r, right: o.x + o.r, top: o.y - o.r, bottom: o.y + o.r}), 0);
  };
  const order = n.y > hy ? ['below', 'above', 'left', 'right'] : ['above', 'below', 'left', 'right'];
  const side = order.reduce((best, s) => cost(s) < cost(best) ? s : best);
  p.pin.classList.toggle('pin--below', side === 'below');
  p.pin.classList.toggle('pin--left', side === 'left');
  p.pin.classList.toggle('pin--right', side === 'right');
  if (Math.abs(shift) > .5 && (side === 'above' || side === 'below')) lbl.style.setProperty('--lx', shift.toFixed(0) + 'px'); else lbl.style.removeProperty('--lx');
  if (n.fixed) { n.lbl = box(side); taken.push(n.lbl); }
 });
 // Подписи карты: прячем те, что режет край кадра или накрывают метки, подпись дома и подписи меток у края.
 const boxes = nodes.map(n => ({left: n.x - n.r, right: n.x + n.r, top: n.y - n.r, bottom: n.y + n.r}));
 boxes.push(plate, ...nodes.filter(n => n.lbl).map(n => n.lbl));
 const hits = (a, b) => a.left < b.right + 4 && a.right > b.left - 4 && a.top < b.bottom + 4 && a.bottom > b.top - 4;
 labels.forEach(el => { el.hidden = false; });
 const fr = frame.getBoundingClientRect();
 const hide = labels.map(el => {
  const g = el.getBoundingClientRect(), b = {left: g.left - fr.left, right: g.right - fr.left, top: g.top - fr.top, bottom: g.bottom - fr.top};
  return b.left < 8 || b.right > w - 8 || b.top < 8 || b.bottom > h - 24 || boxes.some(x => hits(b, x));
 });
 labels.forEach((el, i) => { el.hidden = hide[i]; });
 frame.classList.add('is-laid');
 drawRoutes();
}

/* ---------- дуги от дома ---------- */
function arc(p) {
 const [tx, ty] = p.at, dx = tx - HX, dy = ty - HY, c = .2;
 return `M${HX.toFixed(0)} ${HY.toFixed(0)}Q${((HX + tx) / 2 - dy * c).toFixed(0)} ${((HY + ty) / 2 + dx * c).toFixed(0)} ${tx.toFixed(0)} ${ty.toFixed(0)}`;
}
function drawRoutes() {
 for (const p of places) {
  const on = ready && selected.has(p.id) && !p.pin.hidden;
  let path = routes.get(p.id);
  if (on && !path) {
   path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
   path.setAttribute('class', 'map__route'); path.setAttribute('pathLength', '1');
   path.setAttribute('d', arc(p)); routeLayer.append(path); routes.set(p.id, path);
   path.getBoundingClientRect();
   path.classList.add('is-drawn');
  } else if (on) path.setAttribute('d', arc(p));
  else if (path) { path.remove(); routes.delete(p.id); }
 }
}

/* ---------- состояние: список, метки, карточка выбранного места ---------- */
function render() {
 const key = places.filter(p => category === 'all' || p.category === category).map(p => p.id).join();
 for (const p of places) {
  const visible = category === 'all' || p.category === category, active = visible && selected.has(p.id);
  p.item.hidden = p.pin.hidden = !visible;
  p.item.setAttribute('aria-pressed', String(active)); p.pin.setAttribute('aria-pressed', String(active));
 }
 const current = places.find(p => p.id === [...selected].at(-1));
 panelLabel.textContent = selected.size > 1 ? `Выбрано мест: ${selected.size}` : current ? `${current.time} ${current.mode}` : 'Ваш дом у воды';
 panelTitle.textContent = selected.size > 1 ? 'Всё начинается дома' : current?.name || 'Ясный берег';
 panelCopy.textContent = selected.size > 1 ? places.filter(p => selected.has(p.id)).map(p => `${p.name} — ${p.time}`).join(' · ') : current?.copy || 'Выберите одно или несколько мест на схеме или в списке. Повторное нажатие снимает выбор.';
 if (key !== shownKey) { shownKey = key; layout(); } else drawRoutes();
}

/* ---------- автопоказ: пока посетитель ничего не трогает и карта на экране ---------- */
function stop() { clearInterval(timer); timer = null; }
function cycle() {
 stop();
 if (touched || !inView || !ready || reduced) return;
 panel.setAttribute('aria-live', 'off');
 timer = setInterval(() => {
  const shown = places.filter(p => !p.pin.hidden), last = [...selected].at(-1);
  const next = shown[(shown.findIndex(p => p.id === last) + 1) % shown.length];
  selected.clear(); selected.add(next.id); render();
 }, 3400);
}
function interact() {
 if (touched) return false;
 touched = true; stop(); panel.setAttribute('aria-live', 'polite');
 return true;
}
function choose(id) {
 // Первое нажатие выбирает место вместо автопоказа, дальше — множественный выбор.
 if (interact()) { selected.clear(); selected.add(id); }
 else if (selected.has(id)) selected.delete(id);
 else selected.add(id);
 render();
}
function reset() {
 interact(); category = 'all'; selected.clear();
 root.querySelectorAll('[data-map-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mapFilter === 'all')));
 render();
}
root.querySelectorAll('[data-map-filter]').forEach(b => b.addEventListener('click', () => {
 interact(); category = b.dataset.mapFilter;
 root.querySelectorAll('[data-map-filter]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
 for (const id of selected) if (category !== 'all' && places.find(p => p.id === id).category !== category) selected.delete(id);
 if (!selected.size && category !== 'all') selected.add(places.find(p => p.category === category).id);
 render();
}));
$('[data-map-home]').addEventListener('click', reset);
home.addEventListener('click', reset);

render();
new ResizeObserver(layout).observe(frame);
document.fonts?.ready.then(layout);

// Раскрытие кругом от дома при первом появлении; дуги — после раскрытия.
const start = () => {
 frame.classList.add('is-in');
 setTimeout(() => { frame.classList.add('is-ready'); ready = true; drawRoutes(); cycle(); }, reduced ? 0 : 1300);
};
if ('IntersectionObserver' in window) {
 let started = false;
 new IntersectionObserver(([entry]) => {
  inView = entry.isIntersecting; frame.classList.toggle('is-visible', inView);
  if (inView && !started) { started = true; start(); }
  else if (started) inView ? cycle() : stop();
 }, {threshold: .3}).observe(frame);
} else { inView = true; start(); }
})();
