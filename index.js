// Réglages
const QUARTER_MINUTES = 10;   // FIBA : 10 min, NBA : 12 min
const OVERTIME_MINUTES = 5;
const BONUS_FOULS = 5;        // à partir de 5 fautes d'équipe par quart-temps
const STORAGE_KEY = "basketball-scorecard";

const TEAMS = ["home", "away"];
const DEFAULT_NAMES = { home: "Domicile", away: "Visiteurs" };

let state = load() || newGame();
let history = [];             // copies de l'état pour « Annuler »
let timer = null;
let lastTick = 0;

function newGame() {
  return {
    period: 1,
    gameMs: QUARTER_MINUTES * 60000,
    shotMs: 24000,
    teams: Object.fromEntries(TEAMS.map((t) => [t, { name: DEFAULT_NAMES[t], score: 0, fouls: 0, timeouts: 0 }])),
    log: [],
  };
}

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// Garde une copie pour pouvoir annuler, puis applique le changement
function act(change, message) {
  history.push(JSON.stringify(state));
  if (history.length > 100) history.shift();
  change();
  if (message) state.log.unshift({ period: state.period, clock: formatGame(state.gameMs), message });
  save();
  render();
}

function undo() {
  if (!history.length) return;
  const previous = JSON.parse(history.pop());
  // Les chronos ne reviennent pas en arrière, sauf si on annule un changement de quart-temps
  if (previous.period === state.period) Object.assign(previous, { gameMs: state.gameMs, shotMs: state.shotMs });
  state = previous;
  save();
  render();
}

// ---- Affichage ----

const $ = (sel, root = document) => root.querySelector(sel);

function formatGame(ms) {
  const total = Math.ceil(ms / 1000);
  if (ms < 60000 && ms > 0) return (ms / 1000).toFixed(1);   // dixièmes sous la minute
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function periodLabel(p) {
  return p <= 4 ? `QT ${p}` : `Prol. ${p - 4}`;
}

function buildTeams() {
  const template = $("#teamTemplate");
  for (const team of TEAMS) {
    const card = $(`[data-team="${team}"]`);
    card.append(template.content.cloneNode(true));

    $(".name", card).addEventListener("change", (e) => {
      const name = e.target.value.trim() || DEFAULT_NAMES[team];
      act(() => (state.teams[team].name = name));
    });
    card.querySelectorAll("[data-points]").forEach((btn) =>
      btn.addEventListener("click", () => addPoints(team, Number(btn.dataset.points)))
    );
    card.querySelectorAll("[data-stat]").forEach((btn) =>
      btn.addEventListener("click", () => addStat(team, btn.dataset.stat))
    );
  }
}

function render() {
  $("#period").textContent = periodLabel(state.period);
  $("#gameClock").textContent = formatGame(state.gameMs);
  $("#gameClock").classList.toggle("running", !!timer);
  $("#shotClock").textContent = Math.ceil(state.shotMs / 1000);
  $("#shotClock").classList.toggle("expired", state.shotMs <= 0);
  $("#startStop").textContent = timer ? "⏸ Arrêter" : "▶ Lancer";

  for (const team of TEAMS) {
    const card = $(`[data-team="${team}"]`);
    const data = state.teams[team];
    if (document.activeElement !== $(".name", card)) $(".name", card).value = data.name;
    const score = $(".score", card);
    if (score.textContent !== String(data.score)) {
      score.textContent = data.score;
      score.classList.remove("bump");
      void score.offsetWidth;   // relance l'animation
      score.classList.add("bump");
    }
    $(".fouls", card).textContent = data.fouls;
    $(".timeouts", card).textContent = data.timeouts;
    $(".bonus", card).hidden = data.fouls < BONUS_FOULS;
  }

  $("#log").innerHTML = state.log
    .map((e) => `<li>${periodLabel(e.period)} · ${e.clock} — ${e.message}</li>`)
    .join("");
  $("#undo").disabled = !history.length;
}

// ---- Actions de match ----

const name = (team) => `<b>${escapeHtml(state.teams[team].name)}</b>`;

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function addPoints(team, points) {
  act(() => {
    state.teams[team].score += points;
    state.shotMs = 24000;
  }, `${name(team)} +${points} (${state.teams.home.score + (team === "home" ? points : 0)} – ${state.teams.away.score + (team === "away" ? points : 0)})`);
}

function addStat(team, stat) {
  const label = stat === "fouls" ? "faute" : "temps-mort";
  if (stat === "timeouts") stopClock();
  act(() => state.teams[team][stat]++, `${name(team)} ${label} n°${state.teams[team][stat] + 1}`);
}

function changePeriod(delta) {
  const next = state.period + delta;
  if (next < 1) return;
  stopClock();
  act(() => {
    state.period = next;
    state.gameMs = (next <= 4 ? QUARTER_MINUTES : OVERTIME_MINUTES) * 60000;
    state.shotMs = 24000;
    TEAMS.forEach((t) => (state.teams[t].fouls = 0));   // fautes d'équipe remises à zéro
  }, `Début ${periodLabel(next)}`);
}

// ---- Chronos ----

function startClock() {
  if (timer || state.gameMs <= 0) return;
  lastTick = performance.now();
  timer = setInterval(tick, 100);
  render();
}

function stopClock() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
  save();
  render();
}

function tick() {
  const now = performance.now();
  const elapsed = now - lastTick;
  lastTick = now;
  state.gameMs = Math.max(0, state.gameMs - elapsed);
  state.shotMs = Math.max(0, state.shotMs - elapsed);
  if (state.gameMs === 0) {
    stopClock();
    buzzer();
    state.log.unshift({ period: state.period, clock: "00:00", message: `Fin ${periodLabel(state.period)}` });
    save();
  } else if (state.shotMs === 0) {
    stopClock();
    buzzer();
  }
  render();
}

function resetShot(seconds) {
  state.shotMs = seconds * 1000;
  save();
  render();
}

function buzzer() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 220;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {}
}

// ---- Branchements ----

buildTeams();

$("#startStop").addEventListener("click", () => (timer ? stopClock() : startClock()));
$("#shot24").addEventListener("click", () => resetShot(24));
$("#shot14").addEventListener("click", () => resetShot(14));
$("#shotClock").addEventListener("click", () => resetShot(24));
$("#periodUp").addEventListener("click", () => changePeriod(1));
$("#periodDown").addEventListener("click", () => changePeriod(-1));
$("#undo").addEventListener("click", undo);
$("#reset").addEventListener("click", () => {
  if (!confirm("Effacer ce match et en commencer un nouveau ?")) return;
  stopClock();
  act(() => (state = newGame()));
  history = [];
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT") return;
  const keys = {
    " ": () => (timer ? stopClock() : startClock()),
    r: () => resetShot(24),
    z: undo,
    1: () => addPoints("home", 1), 2: () => addPoints("home", 2), 3: () => addPoints("home", 3),
    7: () => addPoints("away", 1), 8: () => addPoints("away", 2), 9: () => addPoints("away", 3),
  };
  const action = keys[e.key.toLowerCase()];
  if (action) { e.preventDefault(); action(); }
});

render();
