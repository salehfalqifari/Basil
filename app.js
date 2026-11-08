/* =========================================================================
   Super Basil: Daily Quest — engine + UI
   Daily Mawhiba (MMCAT) practice tool with spaced review and a Trophy goal.
   Data: see data.js (global ITEMS array, 440 items across 4 domains).
   ========================================================================= */

/* ---------- Config ---------- */
const STORAGE_KEY = 'basil_mawhiba_daily_v1';
const TROPHY_DEADLINE = '2026-12-16'; // YYYY-MM-DD, local-date comparison
const REQUIRED_ACCURACY = 0.80;
const DAILY_MIN = 30;
const DAILY_MAX = 45;
const APP_VERSION = 1;

const WORLD_META = {
  linguistic: { name: 'Mushroom Meadows', icon: '🍄', color: '#3457D5', colorDark: '#5C7FE0', label: 'Linguistic Reasoning' },
  math_spatial: { name: 'Number Castle', icon: '🏰', color: '#C6304F', colorDark: '#D93B5C', label: 'Math & Spatial Reasoning' },
  science_mechanical: { name: 'Gear Grotto', icon: '⚙️', color: '#7B4FA6', colorDark: '#A374C9', label: 'Science & Mechanical Reasoning' },
  creativity_flex: { name: 'Rainbow Summit', icon: '🌈', color: '#A87A1E', colorDark: '#B98A32', label: 'Creativity & Mental Flexibility' },
};
const DOMAIN_ORDER = ['linguistic', 'math_spatial', 'science_mechanical', 'creativity_flex'];

/* ---------- Visual helper functions (used by template-literal placeholders in data.js) ---------- */
function sq(px, color) { return `<span class="viz-shape" style="display:inline-block;width:${px}px;height:${px}px;background:${color};border-radius:4px;margin:4px;vertical-align:middle;"></span>`; }
function circ(px, color) { return `<span class="viz-shape" style="display:inline-block;width:${px}px;height:${px}px;background:${color};border-radius:50%;margin:4px;vertical-align:middle;"></span>`; }
function tris(px, color, count) {
  let out = '';
  for (let i = 0; i < count; i++) {
    out += `<span class="viz-shape" style="display:inline-block;width:0;height:0;border-left:${px / 2}px solid transparent;border-right:${px / 2}px solid transparent;border-bottom:${px}px solid ${color};margin:4px;vertical-align:middle;"></span>`;
  }
  return out;
}
function dots(rows, cols, filledIndices, px) {
  let out = `<div class="viz-shape" style="display:inline-grid;grid-template-columns:repeat(${cols}, ${px}px);gap:3px;vertical-align:middle;">`;
  for (let i = 0; i < rows * cols; i++) {
    const filled = filledIndices.includes(i);
    out += `<span style="width:${px}px;height:${px}px;border:2px solid #888;border-radius:3px;background:${filled ? '#333' : 'transparent'};display:inline-block;"></span>`;
  }
  out += `</div>`;
  return out;
}
function sqc(px, color) { return sq(px, color); }
const ARROW_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
function arrow(dir, size, color) {
  const deg = ARROW_DEG[dir] ?? 0;
  return `<span class="viz-shape" style="display:inline-block;transform:rotate(${deg}deg);font-size:${size}px;color:${color};line-height:1;vertical-align:middle;">&#8593;</span>`;
}
function flag(poleSide, color, size) {
  const pole = `<span style="display:inline-block;width:3px;height:${size}px;background:#555;"></span>`;
  const tri = poleSide === 'left'
    ? `<span style="display:inline-block;width:0;height:0;border-top:${size / 2}px solid transparent;border-bottom:${size / 2}px solid transparent;border-left:${size * 0.8}px solid ${color};"></span>`
    : `<span style="display:inline-block;width:0;height:0;border-top:${size / 2}px solid transparent;border-bottom:${size / 2}px solid transparent;border-right:${size * 0.8}px solid ${color};"></span>`;
  return `<span class="viz-shape" style="display:inline-flex;align-items:center;vertical-align:middle;">${poleSide === 'left' ? pole + tri : tri + pole}</span>`;
}
function renderTemplate(str) {
  if (!str || typeof str !== 'string' || !str.includes('${')) return str;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('sq', 'circ', 'tris', 'dots', 'sqc', 'arrow', 'flag', 'return `' + str.replace(/`/g, '\\`') + '`;');
    return fn(sq, circ, tris, dots, sqc, arrow, flag);
  } catch (e) {
    console.error('Template render error', e, str);
    return str;
  }
}

/* ---------- Date helpers (local date, not UTC) ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function dateToStr(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return dateToStr(new Date()); }
function strToDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDaysStr(s, days) { const d = strToDate(s); d.setDate(d.getDate() + days); return dateToStr(d); }
function yesterdayStr(s) { return addDaysStr(s, -1); }
function daysBetween(a, b) { return Math.round((strToDate(b) - strToDate(a)) / 86400000); }

/* ---------- Seeded PRNG (mulberry32), seeded per-day so a day's set is stable across reloads ---------- */
function mulberry32(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (Math.imul(h, 31) + str.charCodeAt(i)) | 0; }
  return h;
}
function shuffledCopy(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- State ---------- */
const ITEM_BY_ID = {};
ITEMS.forEach((it) => { ITEM_BY_ID[it.id] = it; });

function defaultState() {
  const itemStats = {};
  ITEMS.forEach((it) => {
    itemStats[it.id] = { status: 'new', timesCorrect: 0, timesWrong: 0, lastSeenDay: null, nextDueDay: null };
  });
  return {
    version: APP_VERSION,
    createdAt: todayStr(),
    itemStats,
    history: [], // { day, itemId, correct }
    dailySets: {}, // day -> { ids: [...], answered: {itemId: bool}, sizeTarget }
    streak: { count: 0, lastCompletedDay: null },
    trophy: { earned: false, earnedOn: null, earnedOnTime: null },
  };
}

let STATE = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== APP_VERSION || !parsed.itemStats) return defaultState();
    // Ensure every current item has a stats entry (in case the bank ever grows)
    ITEMS.forEach((it) => {
      if (!parsed.itemStats[it.id]) {
        parsed.itemStats[it.id] = { status: 'new', timesCorrect: 0, timesWrong: 0, lastSeenDay: null, nextDueDay: null };
      }
    });
    if (!parsed.streak) parsed.streak = { count: 0, lastCompletedDay: null };
    if (!parsed.trophy) parsed.trophy = { earned: false, earnedOn: null, earnedOnTime: null };
    if (!parsed.dailySets) parsed.dailySets = {};
    if (!parsed.history) parsed.history = [];
    return parsed;
  } catch (e) {
    console.error('Failed to load saved progress, starting fresh.', e);
    return defaultState();
  }
}
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
  } catch (e) {
    console.error('Could not save progress (storage may be full or unavailable).', e);
  }
}

/* ---------- Daily set generation ---------- */
function pickDailySize(day) {
  const rng = mulberry32(seedFromString('size-' + day));
  return DAILY_MIN + Math.floor(rng() * (DAILY_MAX - DAILY_MIN + 1));
}

function getPoolsByDomain(day) {
  const pools = {};
  DOMAIN_ORDER.forEach((d) => { pools[d] = { due: [], fresh: [], mastered: [] }; });
  ITEMS.forEach((it) => {
    const st = STATE.itemStats[it.id];
    if (st.status === 'review') {
      const due = !st.nextDueDay || st.nextDueDay <= day;
      if (due) pools[it.domain].due.push(it.id);
    } else if (st.status === 'new') {
      pools[it.domain].fresh.push(it.id);
    } else if (st.status === 'mastered') {
      pools[it.domain].mastered.push(it.id);
    }
  });
  return pools;
}

function buildDailySet(day, rng) {
  const size = pickDailySize(day);
  const perDomainBase = Math.floor(size / DOMAIN_ORDER.length);
  let remainder = size - perDomainBase * DOMAIN_ORDER.length;
  const targetPerDomain = {};
  DOMAIN_ORDER.forEach((d, i) => { targetPerDomain[d] = perDomainBase + (i < remainder ? 1 : 0); });

  const pools = getPoolsByDomain(day);
  const chosen = [];
  DOMAIN_ORDER.forEach((d) => {
    let need = targetPerDomain[d];
    const due = shuffledCopy(pools[d].due, rng);
    const fresh = shuffledCopy(pools[d].fresh, rng);
    const mastered = shuffledCopy(pools[d].mastered, rng);
    const take = [];
    for (const id of due) { if (take.length >= need) break; take.push(id); }
    for (const id of fresh) { if (take.length >= need) break; take.push(id); }
    for (const id of mastered) { if (take.length >= need) break; take.push(id); }
    chosen.push(...take);
  });

  // If pools were too small overall to fill `size` (late-game, bank mostly mastered),
  // top up from the full mastered pool across all domains rather than leaving the day short.
  if (chosen.length < size) {
    const already = new Set(chosen);
    const allMastered = shuffledCopy(
      ITEMS.filter((it) => STATE.itemStats[it.id].status === 'mastered' && !already.has(it.id)).map((it) => it.id),
      rng
    );
    for (const id of allMastered) { if (chosen.length >= size) break; chosen.push(id); }
  }

  return shuffledCopy(chosen, rng);
}

function setsAreIdentical(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function getOrCreateDailySet(day) {
  if (STATE.dailySets[day]) return STATE.dailySets[day];
  const rng = mulberry32(seedFromString('daily-' + day));
  let ids = buildDailySet(day, rng);

  // Guarantee it never exactly matches yesterday's set (soft guard; pool size makes an
  // exact match astronomically unlikely already, this just makes the guarantee explicit).
  const prevDay = yesterdayStr(day);
  const prevSet = STATE.dailySets[prevDay];
  if (prevSet && setsAreIdentical(ids, prevSet.ids)) {
    const rng2 = mulberry32(seedFromString('daily-retry-' + day));
    ids = shuffledCopy(ids, rng2);
    // swap one item for something else in the pool if still identical (extremely unlikely path)
    if (setsAreIdentical(ids, prevSet.ids) && ids.length > 1) {
      const altPool = ITEMS.map((it) => it.id).filter((id) => !ids.includes(id));
      if (altPool.length) ids[0] = shuffledCopy(altPool, rng2)[0];
    }
  }

  STATE.dailySets[day] = { ids, answered: {}, sizeTarget: ids.length };
  saveState();
  return STATE.dailySets[day];
}

/* ---------- Answering ---------- */
function recordAnswer(day, itemId, isCorrect) {
  STATE.history.push({ day, itemId, correct: isCorrect });
  const st = STATE.itemStats[itemId];
  st.lastSeenDay = day;
  if (isCorrect) {
    st.timesCorrect += 1;
    st.status = 'mastered';
    st.nextDueDay = null;
  } else {
    st.timesWrong += 1;
    st.status = 'review';
    const interval = Math.min(Math.pow(2, Math.max(0, st.timesWrong - 1)), 7); // 1,2,4,7,7,7...
    st.nextDueDay = addDaysStr(day, interval);
  }
  const setForDay = STATE.dailySets[day];
  if (setForDay) setForDay.answered[itemId] = isCorrect;
  saveState();
}

function isDayComplete(day) {
  const setForDay = STATE.dailySets[day];
  if (!setForDay) return false;
  return setForDay.ids.every((id) => Object.prototype.hasOwnProperty.call(setForDay.answered, id));
}

function registerDayCompletionIfNeeded(day) {
  if (!isDayComplete(day)) return false;
  if (STATE.streak.lastCompletedDay === day) return checkTrophy(day); // already counted today; still check trophy
  if (STATE.streak.lastCompletedDay === yesterdayStr(day)) {
    STATE.streak.count += 1;
  } else {
    STATE.streak.count = 1;
  }
  STATE.streak.lastCompletedDay = day;
  saveState();
  return checkTrophy(day); // returns true if newly earned
}

/* ---------- Progress stats ---------- */
function computeMasteryStats() {
  let mastered = 0;
  const byDomain = {};
  DOMAIN_ORDER.forEach((d) => { byDomain[d] = { total: 0, mastered: 0 }; });
  ITEMS.forEach((it) => {
    byDomain[it.domain].total += 1;
    if (STATE.itemStats[it.id].status === 'mastered') {
      mastered += 1;
      byDomain[it.domain].mastered += 1;
    }
  });
  return { mastered, total: ITEMS.length, byDomain };
}
function computeOverallAccuracy() {
  const total = STATE.history.length;
  if (total === 0) return 0;
  const correct = STATE.history.filter((h) => h.correct).length;
  return correct / total;
}
function checkTrophy(day) {
  if (STATE.trophy.earned) return false;
  const { mastered, total } = computeMasteryStats();
  const accuracy = computeOverallAccuracy();
  if (mastered === total && accuracy >= REQUIRED_ACCURACY) {
    STATE.trophy.earned = true;
    STATE.trophy.earnedOn = day;
    STATE.trophy.earnedOnTime = day <= TROPHY_DEADLINE;
    saveState();
    return true; // newly earned
  }
  return false;
}

/* ---------- Export / Import ---------- */
function exportState() {
  const blob = new Blob([JSON.stringify(STATE, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `basil-daily-quest-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function importStateFromFile(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !parsed.itemStats || !parsed.history) {
        onDone(false, 'That file does not look like a Daily Quest backup.');
        return;
      }
      // Mutate the existing STATE object IN PLACE (rather than reassigning the STATE
      // variable to a new object) so the reference already handed out via
      // window.__DAILY_QUEST__.STATE stays valid after an import.
      Object.keys(STATE).forEach((k) => { delete STATE[k]; });
      Object.assign(STATE, parsed);
      ITEMS.forEach((it) => {
        if (!STATE.itemStats[it.id]) {
          STATE.itemStats[it.id] = { status: 'new', timesCorrect: 0, timesWrong: 0, lastSeenDay: null, nextDueDay: null };
        }
      });
      if (!STATE.streak) STATE.streak = { count: 0, lastCompletedDay: null };
      if (!STATE.trophy) STATE.trophy = { earned: false, earnedOn: null, earnedOnTime: null };
      if (!STATE.dailySets) STATE.dailySets = {};
      STATE.version = APP_VERSION;
      saveState();
      onDone(true, 'Progress restored!');
    } catch (e) {
      onDone(false, 'Could not read that file: ' + e.message);
    }
  };
  reader.onerror = () => onDone(false, 'Could not read that file.');
  reader.readAsText(file);
}

/* ---------- Boot ---------- */
function initApp() {
  STATE = loadState();
  window.__DAILY_QUEST__ = {
    STATE, ITEM_BY_ID, todayStr, getOrCreateDailySet, recordAnswer, registerDayCompletionIfNeeded,
    computeMasteryStats, computeOverallAccuracy, checkTrophy, exportState, importStateFromFile,
    renderTemplate, WORLD_META, DOMAIN_ORDER, TROPHY_DEADLINE, REQUIRED_ACCURACY, daysBetween, saveState,
  };
  if (typeof onEngineReady === 'function') onEngineReady();
}
