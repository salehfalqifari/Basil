/* =========================================================================
   Super Basil: Daily Quest — UI layer (talks to the engine via window.__DAILY_QUEST__)
   ========================================================================= */

let E = null; // engine API, set in onEngineReady()
let screen = 'dashboard'; // 'dashboard' | 'quiz' | 'dayResults' | 'importConfirm'
let quiz = null; // { day, ids, idx, selected, locked, correctCount }
let pendingImportFile = null;
let justEarnedTrophy = false;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escKeepHtml(s) { return s; } // question/option HTML is our own trusted template output

function fmtPct(x) { return Math.round(x * 100) + '%'; }

function app() { return document.getElementById('app'); }

function render() {
  window.quiz = quiz; // exposed for debugging/testing; not used by production logic itself
  const root = app();
  if (screen === 'dashboard') root.innerHTML = renderDashboard();
  else if (screen === 'quiz') root.innerHTML = renderQuiz();
  else if (screen === 'dayResults') root.innerHTML = renderDayResults();
  else if (screen === 'importConfirm') root.innerHTML = renderImportConfirm();
  window.scrollTo(0, 0);
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const day = E.todayStr();
  const setForDay = E.STATE.dailySets[day];
  const willBuild = !setForDay;
  const previewSet = willBuild ? E.getOrCreateDailySet(day) : setForDay;
  const total = previewSet.ids.length;
  const answeredCount = Object.keys(previewSet.answered).length;
  const todayComplete = answeredCount >= total && total > 0;

  const mastery = E.computeMasteryStats();
  const masteryPct = mastery.total ? mastery.mastered / mastery.total : 0;
  const accuracy = E.computeOverallAccuracy();
  const trophyEarned = E.STATE.trophy.earned;

  const daysToDeadline = E.daysBetween(day, E.TROPHY_DEADLINE);
  let deadlineLine;
  if (trophyEarned) {
    deadlineLine = E.STATE.trophy.earnedOnTime
      ? `🏆 Trophy earned on ${E.STATE.trophy.earnedOn}!`
      : `🏆 Trophy earned on ${E.STATE.trophy.earnedOn} (after the Dec 16 goal date — still counts!)`;
  } else if (daysToDeadline > 0) {
    deadlineLine = `${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} until the Dec 16 goal date`;
  } else if (daysToDeadline === 0) {
    deadlineLine = `Today is the goal date!`;
  } else {
    deadlineLine = `${Math.abs(daysToDeadline)} day${Math.abs(daysToDeadline) === 1 ? '' : 's'} past the goal date — keep going, the trophy is still there to earn!`;
  }

  const domainCards = E.DOMAIN_ORDER.map((d) => {
    const meta = E.WORLD_META[d];
    const dm = mastery.byDomain[d];
    const pct = dm.total ? dm.mastered / dm.total : 0;
    return `
      <div class="domain-mini" style="border-color:${meta.color};">
        <div class="domain-mini-head"><span>${meta.icon}</span><span>${esc(meta.name)}</span></div>
        <div class="mini-bar-track"><div class="mini-bar-fill" style="width:${Math.round(pct * 100)}%;background:${meta.color};"></div></div>
        <div class="domain-mini-sub">${dm.mastered}/${dm.total} mastered</div>
      </div>`;
  }).join('');

  const startLabel = todayComplete ? "Today's Quest ✓ Done" : (answeredCount > 0 ? 'Continue Today’s Quest' : "Start Today’s Quest");
  const startDisabled = todayComplete ? 'disabled' : '';

  return `
  <div class="dash">
    <div class="hero-row">
      <div class="streak-pill">🔥 <span>${E.STATE.streak.count}</span> day streak</div>
      <div class="trophy-pill ${trophyEarned ? 'earned' : ''}">${trophyEarned ? '🏆 Trophy Earned!' : '🏅 Trophy Goal'}</div>
    </div>

    <div class="card today-card">
      <h2>Today's Quest</h2>
      <p class="muted">${total} questions today, mixed across all 4 worlds${answeredCount > 0 && !todayComplete ? ` — ${answeredCount}/${total} done so far` : ''}.</p>
      <button class="btn-primary" ${startDisabled} onclick="startTodayQuiz()">${startLabel}</button>
      ${todayComplete ? `<p class="muted small">Great job — come back tomorrow for a fresh set!</p>` : ''}
    </div>

    <div class="card trophy-card">
      <h2>🏆 Trophy Progress</h2>
      <div class="trophy-row">
        <div class="trophy-stat">
          <div class="trophy-stat-label">Question bank mastered</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(masteryPct * 100)}%;background:var(--brand);"></div></div>
          <div class="trophy-stat-value">${mastery.mastered} / ${mastery.total} (${fmtPct(masteryPct)})</div>
        </div>
        <div class="trophy-stat">
          <div class="trophy-stat-label">Overall accuracy (need 80%+)</div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(accuracy * 100)}%;background:${accuracy >= 0.8 ? 'var(--brand)' : '#D9A23B'};"></div></div>
          <div class="trophy-stat-value">${fmtPct(accuracy)} ${accuracy >= 0.8 ? '✓' : ''}</div>
        </div>
      </div>
      <p class="muted small deadline-line">${deadlineLine}</p>
      <p class="muted small">Both bars need to be full to win the Trophy — mastering every question AND keeping accuracy at 80% or higher.</p>
    </div>

    <div class="card">
      <h2>By World</h2>
      <div class="domain-grid">${domainCards}</div>
    </div>

    <div class="card backup-card">
      <h2>Save Backup</h2>
      <p class="muted small">Progress saves automatically on this device/browser. Use these buttons to make a backup file, or restore one, as a safety net.</p>
      <div class="backup-btn-row">
        <button class="btn-secondary" onclick="E.exportState()">⬇️ Export Backup</button>
        <label class="btn-secondary file-btn">⬆️ Import Backup
          <input type="file" accept="application/json" onchange="onImportFileChosen(event)" />
        </label>
      </div>
    </div>
  </div>`;
}

/* ---------- Quiz ---------- */
function startTodayQuiz() {
  const day = E.todayStr();
  const setForDay = E.getOrCreateDailySet(day);
  quiz = {
    day,
    ids: setForDay.ids,
    idx: 0,
    selected: null,
    locked: false,
    correctCount: 0,
  };
  // resume at first unanswered item
  const answeredIds = setForDay.answered;
  let startIdx = 0;
  while (startIdx < quiz.ids.length && Object.prototype.hasOwnProperty.call(answeredIds, quiz.ids[startIdx])) {
    if (answeredIds[quiz.ids[startIdx]]) quiz.correctCount++;
    startIdx++;
  }
  quiz.idx = Math.min(startIdx, quiz.ids.length - 1);
  if (startIdx >= quiz.ids.length) {
    screen = 'dayResults';
  } else {
    screen = 'quiz';
  }
  render();
}

function renderQuiz() {
  const itemId = quiz.ids[quiz.idx];
  const item = E.ITEM_BY_ID[itemId];
  const meta = E.WORLD_META[item.domain];
  const qHtml = E.renderTemplate(item.q);
  const optsHtml = item.opts.map((o) => E.renderTemplate(o));
  const n = quiz.ids.length;

  const optionButtons = optsHtml.map((optHtml, i) => {
    let cls = 'opt';
    if (quiz.locked) {
      if (i === item.correct) cls += ' correct';
      else if (i === quiz.selected) cls += ' incorrect';
      else cls += ' locked';
    }
    return `<button class="${cls}" ${quiz.locked ? 'disabled' : ''} onclick="selectOption(${i})">${optHtml}</button>`;
  }).join('');

  const feedback = quiz.locked ? `
    <div class="feedback ${quiz.selected === item.correct ? 'good' : 'bad'}">
      <div class="feedback-title">${quiz.selected === item.correct ? '✅ Correct!'�:' '❌ Not quite.'}</div>
      <div class="feedback-explain">${esc(item.explain)}</div>
      <button class="btn-primary" onclick="nextQuestion()">${quiz.idx === n - 1 ? 'See Today’s Results' : 'Next Question'}</button>
    </div>` : '';

  return `
  <div class="quiz" style="--world-color:${meta.color};">
    <div class="quiz-head">
      <button class="btn-link" onclick="backToDashboard()">← Dashboard</button>
      <div class="quiz-progress">Question ${quiz.idx + 1} of ${n}</div>
    </div>
    <div class="world-tag" style="background:${meta.color};">${meta.icon} ${esc(meta.name)}</div>
    <div class="qcard">
      <div class="qtext">${qHtml}</div>
      <div class="opts">${optionButtons}</div>
    </div>
    ${feedback}
  </div>`;
}

function selectOption(i) {
  if (quiz.locked) return;
  const itemId = quiz.ids[quiz.idx];
  const item = E.ITEM_BY_ID[itemId];
  quiz.selected = i;
  quiz.locked = true;
  const isCorrect = i === item.correct;
  if (isCorrect) quiz.correctCount++;
  E.recordAnswer(quiz.day, itemId, isCorrect);
  render();
}

function nextQuestion() {
  if (quiz.idx < quiz.ids.length - 1) {
    quiz.idx++;
    quiz.selected = null;
    quiz.locked = false;
    render();
  } else {
    justEarnedTrophy = E.registerDayCompletionIfNeeded(quiz.day) === true;
    screen = 'dayResults';
    render();
  }
}

function backToDashboard() {
  screen = 'dashboard';
  quiz = null;
  render();
}

/* ---------- Day results ---------- */
function renderDayResults() {
  const n = quiz.ids.length;
  const pct = n ? Math.round((quiz.correctCount / n) * 100) : 0;
  const mastery = E.computeMasteryStats();
  const trophyBanner = justEarnedTrophy ? `
    <div class="trophy-banner">
      <div class="trophy-banner-emoji">🏆🎉</div>
      <div class="trophy-banner-title">TROPHY EARNED!</div>
      <div class="trophy-banner-sub">Basil mastered the whole question bank with ${fmtPct(E.computeOverallAccuracy())} overall accuracy. Amazing work!</div>
    </div>` : '';

  return `
  <div class="results">
    ${trophyBanner}
    <div class="card">
      <h2>Nice work today! 🎉</h2>
      <p class="big-score">${quiz.correctCount} / ${n} correct (${pct}%)</p>
      <p class="muted">🔥 Streak: ${E.STATE.streak.count} day${E.STATE.streak.count === 1 ? '' : 's'}</p>
      <p class="muted">Question bank mastered so far: ${mastery.mastered} / ${mastery.total}</p>
      <button class="btn-primary" onclick="backToDashboard()">Back to Dashboard</button>
    </div>
  </div>`;
}

/* ---------- Import flow ---------- */
function onImportFileChosen(ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  pendingImportFile = file;
  screen = 'importConfirm';
  render();
}
function renderImportConfirm() {
  return `
  <div class="card modal-card">
    <h2>Restore this backup?</h2>
    <p class="muted">This will replace everything currently saved on this device with the backup file <strong>${esc(pendingImportFile ? pendingImportFile.name : '')}</strong>. This can't be undone.</p>
    <div class="backup-btn-row">
      <button class="btn-secondary" onclick="cancelImport()">Cancel</button>
      <button class="btn-primary" onclick="confirmImport()">Yes, Restore It</button>
    </div>
  </div>`;
}
function cancelImport() {
  pendingImportFile = null;
  screen = 'dashboard';
  render();
}
function confirmImport() {
  E.importStateFromFile(pendingImportFile, (ok, msg) => {
    pendingImportFile = null;
    if (ok) {
      // reload engine state references after import
      E = window.__DAILY_QUEST__;
      screen = 'dashboard';
      render();
      setTimeout(() => alert(msg), 50);
    } else {
      screen = 'dashboard';
      render();
      setTimeout(() => alert(msg), 50);
    }
  });
}

/* ---------- Boot ---------- */
function onEngineReady() {
  E = window.__DAILY_QUEST__;
  render();
}
