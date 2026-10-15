import { ncToday, archiveDates, scoreSummary, formatShareResult, validateProgress } from "./game.js";
import { createSafeStorage, createGameStore, loadLegacyProfile } from "./storage.js";
import { openDialog, closeDialog } from "./dialog.js";
import { createAuthController, loadLocalAuthClient } from "./auth.js?v=20261015-join";
import { createOnboardingController } from "./onboarding.js?v=20261015-join";
import { createLeaderboardController } from "./leaderboard.js?v=20261015-join";

const GAME_CONFIG = {
  maxGuesses: 6,
  leaderboardPageSize: 5,
};

const elements = {
  accountRetry: document.getElementById("account-retry"),
  accountButton: document.getElementById("account-button"),
  signOut: document.getElementById("sign-out"),
  accountStatus: document.getElementById("account-status"),
  emailDialog: document.getElementById("email-dialog"),
  joinFields: document.getElementById("join-fields"),
  joinName: document.getElementById("join-name"),
  joinSchool: document.getElementById("join-school"),
  emailFields: document.getElementById("email-fields"),
  emailEdit: document.getElementById("email-edit"),
  emailMode: document.getElementById("email-mode"),
  emailTitle: document.getElementById("email-title"),
  emailIntro: document.getElementById("email-intro"),
  emailForm: document.getElementById("email-form"),
  emailInput: document.getElementById("account-email"),
  emailSubmit: document.getElementById("email-submit"),
  emailStatus: document.getElementById("email-status"),
  profileDialog: document.getElementById("profile-dialog"),
  profileForm: document.getElementById("profile-form"),
  profileName: document.getElementById("profile-name"),
  profileSchool: document.getElementById("profile-school"),
  profileListed: document.getElementById("profile-listed"),
  profileIncludeToday: document.getElementById("profile-include-today"),
  profileSubmit: document.getElementById("profile-submit"),
  profileStatus: document.getElementById("profile-status"),
  leaderboardRetry: document.getElementById("leaderboard-retry"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  archiveControls: document.getElementById("archive-controls"),
  archiveDate: document.getElementById("archive-date"),
  puzzleLabel: document.getElementById("puzzle-label"),
  puzzleHeading: document.getElementById("puzzle-date-heading"),
  statusTitle: document.getElementById("status-title"),
  statusMessage: document.getElementById("status-message"),
  clueProgress: document.getElementById("clue-progress"),
  boardPanel: document.getElementById("board-panel"),
  boardRounds: document.getElementById("board-rounds"),
  mapPanel: document.getElementById("map-panel"),
  mapSummary: document.getElementById("map-summary"),
  mapContainer: document.getElementById("school-map"),
  leaderboardPanel: document.getElementById("leaderboard-panel"),
  leaderboardSummary: document.getElementById("leaderboard-summary"),
  leaderboardRounds: document.getElementById("leaderboard-body"),
  leaderboardPagination: document.getElementById("leaderboard-pagination"),
  leaderboardPrev: document.getElementById("leaderboard-prev"),
  leaderboardNext: document.getElementById("leaderboard-next"),
  leaderboardPageStatus: document.getElementById("leaderboard-page-status"),
  leaderboardSyncStatus: document.getElementById("leaderboard-sync-status"),
  leaderboardSortButtons: [...document.querySelectorAll("[data-leaderboard-sort]")],
  scoreTotal: document.getElementById("score-total"),
  scoreWinStreak: document.getElementById("score-win-streak"),
  scoreAttemptStreak: document.getElementById("score-attempt-streak"),
  scoreAverage: document.getElementById("score-average"),
  scoreStatus: document.getElementById("score-status"),
  guessCounter: document.getElementById("guess-counter"),
  guessForm: document.getElementById("guess-form"),
  primaryPanel: document.querySelector(".panel--primary"),
  guessInput: document.getElementById("school-guess"),
  helpDialog: document.getElementById("how-to-play"),
  helpButton: document.querySelector(".help-button"),
  helpCloseButton: document.getElementById("help-close-button"),
  suggestionStatus: document.getElementById("suggestion-status"),
  autocompleteList: document.getElementById("autocomplete-list"),
  retryButton: document.getElementById("retry-data"),
  newDailyNotice: document.getElementById("new-daily-notice"),
  newDailyButton: document.getElementById("new-daily-button"),
  winOverlay: document.getElementById("win-overlay"),
  resultButton: document.getElementById("result-button"),
  resultTitle: document.getElementById("win-title"),
  shareButton: document.getElementById("share-result"),
  copyButton: document.getElementById("copy-result"),
  resultArchiveButton: document.getElementById("result-archive"),
  shareStatus: document.getElementById("share-status"),
  shareFallback: document.getElementById("share-fallback"),
  shareText: document.getElementById("share-text"),
  winAnswer: document.getElementById("win-answer"),
  winSummary: document.getElementById("win-summary"),
  winCloseButton: document.getElementById("win-close-button"),
  confettiLayer: document.getElementById("confetti-layer"),
};

const state = {
  mode: "daily",
  metadata: null,
  schools: [],
  schoolMap: new Map(),
  activePuzzle: null,
  activePuzzleDate: null,
  progress: null,
  filteredSuggestions: [],
  selectedSuggestionIndex: -1,
  lastRoundOutcome: null,
  winOverlaySeen: false,
  subject: "guest",
  store: null,
  dailyDate: ncToday(),
  loading: false,
  leaderboard: {
    sort: "points",
    records: [],
    status: "local",
    message: "",
    syncInFlight: false,
    page: 1,
  },
  map: {
    selectedSchoolId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    drag: null,
    suppressClick: false,
  },
};

const EARTH_RADIUS_MILES = 3958.8;
const MAP_ZOOM_MIN = 1;
const MAP_ZOOM_MAX = 4;
const MAP_ZOOM_STEP = 0.35;
const NC_MAP_BOUNDS = {
  minLat: 33.845545,
  maxLat: 36.589492,
  minLng: -84.319594,
  maxLng: -75.715321,
};
const NC_MAP_PADDING = { x: 2.5, y: 5 };
const NC_MAP_OUTLINE = [
  { lat: 36.562108, lng: -80.978661 },
  { lat: 36.545677, lng: -80.294043 },
  { lat: 36.5402, lng: -79.510841 },
  { lat: 36.551154, lng: -75.868676 },
  { lat: 36.151337, lng: -75.75366 },
  { lat: 36.189676, lng: -76.032984 },
  { lat: 36.140383, lng: -76.071322 },
  { lat: 36.080137, lng: -76.410893 },
  { lat: 36.025367, lng: -76.460185 },
  { lat: 36.008937, lng: -76.68474 },
  { lat: 35.937736, lng: -76.673786 },
  { lat: 35.987029, lng: -76.399939 },
  { lat: 35.943213, lng: -76.3616 },
  { lat: 35.992506, lng: -76.060368 },
  { lat: 35.899398, lng: -75.961783 },
  { lat: 35.937736, lng: -75.781044 },
  { lat: 35.696751, lng: -75.715321 },
  { lat: 35.581735, lng: -75.775568 },
  { lat: 35.570781, lng: -75.89606 },
  { lat: 35.324319, lng: -76.147999 },
  { lat: 35.313365, lng: -76.482093 },
  { lat: 35.14358, lng: -76.536862 },
  { lat: 34.973795, lng: -76.394462 },
  { lat: 34.940933, lng: -76.279446 },
  { lat: 34.661609, lng: -76.493047 },
  { lat: 34.694471, lng: -76.673786 },
  { lat: 34.667086, lng: -76.991448 },
  { lat: 34.60684, lng: -77.210526 },
  { lat: 34.415147, lng: -77.555573 },
  { lat: 34.163208, lng: -77.82942 },
  { lat: 33.845545, lng: -77.971821 },
  { lat: 33.916745, lng: -78.179944 },
  { lat: 33.851022, lng: -78.541422 },
  { lat: 34.80401, lng: -79.675149 },
  { lat: 34.820441, lng: -80.797922 },
  { lat: 34.935456, lng: -80.781491 },
  { lat: 35.105241, lng: -80.934845 },
  { lat: 35.044995, lng: -81.038907 },
  { lat: 35.149057, lng: -81.044384 },
  { lat: 35.198349, lng: -82.276696 },
  { lat: 35.160011, lng: -82.550543 },
  { lat: 35.066903, lng: -82.764143 },
  { lat: 35.00118, lng: -83.109191 },
  { lat: 34.984749, lng: -83.618546 },
  { lat: 34.990226, lng: -84.319594 },
  { lat: 35.225734, lng: -84.29221 },
  { lat: 35.247642, lng: -84.09504 },
  { lat: 35.41195, lng: -84.018363 },
  { lat: 35.559827, lng: -83.7719 },
  { lat: 35.565304, lng: -83.498053 },
  { lat: 35.718659, lng: -83.251591 },
  { lat: 35.773428, lng: -82.994175 },
  { lat: 35.997983, lng: -82.775097 },
  { lat: 36.063706, lng: -82.638174 },
  { lat: 35.965121, lng: -82.610789 },
  { lat: 36.156814, lng: -82.216449 },
  { lat: 36.118475, lng: -82.03571 },
  { lat: 36.304691, lng: -81.909741 },
  { lat: 36.353984, lng: -81.723525 },
  { lat: 36.589492, lng: -81.679709 },
  { lat: 36.562108, lng: -80.978661 },
];

const safeStorage = createSafeStorage(() => window.localStorage);
const stores = new Map();
const dailySessions = new Map();
let activeResult = null;
let auth = null;
let publicClient = null;
let leaderboard = null;
let accountProfile = null;
let onboarding = null;
let accountProblem = false;
let accountBusy = false;
let joinMode = "join";
let emailEditing = false;
let joinFeedback = "";
let accountRevision = 0;
let profilePresentation = 0;
let syncing = false;
let syncAgain = false;

function storeFor(subject) {
  if (!stores.has(subject)) {
    stores.set(subject, createGameStore({ kv: safeStorage, subject, schools: state.schools, puzzles: state.metadata.puzzles }));
  }
  return stores.get(subject);
}

async function loadData() {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const [metadata, schools] = await Promise.all(["puzzles", "schools"].map(async (name) => {
      const response = await fetch(`./data/${name}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Could not load ${name}`);
      return response.json();
    }));
    if (!Array.isArray(schools) || !schools.length || schools.some((school) => !school?.id || !school.officialName)) {
      throw new Error("Invalid school data");
    }
    const schoolIds = new Set(schools.map((school) => school.id));
    if (schoolIds.size !== schools.length || !Array.isArray(metadata?.puzzles) || metadata.puzzles.some((puzzle) =>
      !/^\d{4}-\d{2}-\d{2}$/.test(puzzle?.date) || !schoolIds.has(puzzle.answerSchoolId) ||
      !Array.isArray(puzzle.clues) || puzzle.clues.length !== 6 || puzzle.clues.some((clue) => typeof clue?.text !== "string"))) {
      throw new Error("Invalid puzzle data");
    }
    state.metadata = metadata;
    state.schools = schools;
    state.schoolMap = new Map(schools.map((school) => [school.id, school]));
    stores.clear();
    state.store = storeFor(state.subject);
  } finally {
    window.clearTimeout(timeout);
    controller.abort();
  }
}

function initializeArchiveBounds() {
  const dates = archiveDates(state.metadata.puzzles, ncToday());
  elements.archiveDate.disabled = dates.length === 0;
  elements.archiveDate.min = dates[0] || "";
  elements.archiveDate.max = dates.at(-1) || "";
  if (!dates.includes(elements.archiveDate.value)) elements.archiveDate.value = dates.at(-1) || "";
}

function checkForNewDaily() {
  if (!state.metadata) return;
  initializeArchiveBounds();
  elements.newDailyNotice.classList.toggle("is-hidden", state.dailyDate === ncToday());
}

async function retryData() {
  if (state.loading) return;
  state.loading = true;
  elements.retryButton.disabled = true;
  showUnavailable("Loading puzzles", "Loading school and puzzle data. Past Puzzles and the map will be available when loading finishes.");
  elements.retryButton.classList.add("is-hidden");
  try {
    await loadData();
    initializeArchiveBounds();
    if (!auth) initializeAccounts();
    setMode(state.mode);
    checkForNewDaily();
  } catch {
    showUnavailable("Could not load puzzles", "Check your connection and choose Retry to load the game.");
  } finally {
    state.loading = false;
    elements.retryButton.disabled = false;
  }
}

function showUnavailable(title, message, retry = true) {
  state.activePuzzle = null;
  state.activePuzzleDate = null;
  state.progress = null;
  state.filteredSuggestions = [];
  state.selectedSuggestionIndex = -1;
  elements.boardRounds.innerHTML = "";
  elements.guessInput.value = "";
  elements.guessCounter.textContent = "0 / 6";
  elements.clueProgress.textContent = "No clues available";
  elements.puzzleHeading.textContent = state.mode === "archive" ? "Past Puzzles" : "Daily Puzzle";
  elements.puzzleLabel.textContent = state.mode === "archive" ? "Archive puzzle" : "Daily puzzle";
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
  elements.retryButton.classList.toggle("is-hidden", !retry);
  elements.boardPanel.classList.remove("is-hidden");
  elements.guessForm.classList.remove("is-hidden");
  elements.leaderboardPanel.classList.add("is-hidden");
  elements.mapPanel.classList.add("is-hidden");
  elements.resultButton.classList.add("is-hidden");
  closeDialog(elements.winOverlay);
  renderSuggestionList();
  syncInputLock();
  renderScoreSummary();
}

function setMode(mode) {
  if (!state.metadata) return;
  state.mode = mode;
  elements.modeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.mode === mode);
  });

  elements.archiveControls.classList.toggle("is-hidden", mode !== "archive");
  if (mode === "leaderboard") {
    state.leaderboard.page = 1;
    state.filteredSuggestions = [];
    state.selectedSuggestionIndex = -1;
    render();
    refreshRankings();
    return;
  }

  if (mode === "map") {
    state.filteredSuggestions = [];
    state.selectedSuggestionIndex = -1;
    render();
    return;
  }

  initializeArchiveBounds();
  const date = mode === "daily" ? state.dailyDate : elements.archiveDate.value;
  loadPuzzleForDate(date);
}

function getPuzzleByDate(date) {
  return state.metadata.puzzles.find((candidate) => candidate.date === date) || null;
}

function createFreshProgress() {
  return {
    guesses: [],
    revealedClues: 1,
    solved: false,
    lost: false,
  };
}

function loadSavedProgress(date) {
  if (state.mode !== "daily") return state.store.readProgress(date) || createFreshProgress();

  // An open daily game must retain its own guesses when midnight also makes
  // this date playable in the archive. Archive reads return separate objects.
  const key = `${state.subject}:${date}`;
  if (!dailySessions.has(key)) {
    dailySessions.set(key, state.store.readProgress(date) || createFreshProgress());
  }
  return dailySessions.get(key);
}

function saveProgress() {
  if (state.activePuzzleDate && state.progress) state.store.writeProgress(state.activePuzzleDate, state.progress);
}

function loadPuzzleForDate(date) {
  if (state.mode === "archive" && !archiveDates(state.metadata.puzzles, ncToday()).includes(date)) {
    const hasPast = archiveDates(state.metadata.puzzles, ncToday()).length > 0;
    showUnavailable(hasPast ? "Choose a past puzzle" : "No past puzzles yet", hasPast
      ? "Choose an available date before today to play a past puzzle."
      : "Past puzzles will appear here after the first daily puzzle. Choose Daily Puzzle to play.", false);
    return;
  }
  const puzzle = getPuzzleByDate(date);
  if (!puzzle) {
    showUnavailable("Daily puzzle unavailable", "Today’s puzzle is not available yet. Choose Retry or play Past Puzzles.");
    return;
  }

  elements.retryButton.classList.add("is-hidden");
  state.activePuzzle = puzzle;
  state.activePuzzleDate = date;
  state.progress = loadSavedProgress(date);
  state.filteredSuggestions = [];
  state.selectedSuggestionIndex = -1;
  state.lastRoundOutcome = null;
  state.winOverlaySeen = state.progress.solved || state.progress.lost;
  recordDailyAttempt();
  render();
}

function revealNextClueIfNeeded() {
  const minimumVisible = Math.min(state.progress.guesses.length + 1, state.activePuzzle.clues.length);
  state.progress.revealedClues = Math.max(state.progress.revealedClues, minimumVisible);
}

function render() {
  elements.resultButton.classList.toggle("is-hidden", !["daily", "archive"].includes(state.mode) ||
    !(state.progress?.solved || state.progress?.lost));
  if (state.mode === "leaderboard") {
    renderLeaderboardView();
    renderSuggestionList();
    syncInputLock();
    return;
  }

  if (state.mode === "map") {
    renderMapView();
    renderSuggestionList();
    syncInputLock();
    return;
  }

  revealNextClueIfNeeded();
  elements.boardPanel.classList.remove("is-hidden");
  elements.guessForm.classList.remove("is-hidden");
  elements.leaderboardPanel.classList.add("is-hidden");
  elements.mapPanel.classList.add("is-hidden");
  renderHeader();
  renderBoard();
  renderStatus();
  renderScoreSummary();
  renderWinOverlay();
  renderSuggestionList();
  syncInputLock();
}

function renderHeader() {
  if (state.mode === "leaderboard") {
    const summary = buildScoreSummary();
    elements.puzzleLabel.textContent = "Company score";
    elements.puzzleHeading.textContent = "Leaderboard";
    elements.guessCounter.textContent = `${summary.points} pts`;
    elements.clueProgress.textContent = `${summary.winStreak} win · ${summary.attemptStreak} attempt`;
    return;
  }

  if (state.mode === "map") {
    const schoolCount = getMappableSchools().length;
    elements.puzzleLabel.textContent = "Reference map";
    elements.puzzleHeading.textContent = "NC Charter Schools";
    elements.guessCounter.textContent = `${schoolCount} pins`;
    elements.clueProgress.textContent = `${schoolCount} mapped schools`;
    return;
  }

  const headingDate = new Date(`${state.activePuzzleDate}T12:00:00`);
  const dateLabel = headingDate.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  elements.puzzleLabel.textContent = state.mode === "daily" ? "Daily puzzle" : "Archive puzzle";
  elements.puzzleHeading.textContent = dateLabel;
  elements.guessCounter.textContent = `${state.progress.guesses.length} / ${GAME_CONFIG.maxGuesses}`;
  elements.clueProgress.textContent = `${state.progress.revealedClues} clue${state.progress.revealedClues === 1 ? "" : "s"} visible`;
}

function renderBoard() {
  const rows = [];
  const answerSchool = state.schoolMap.get(state.activePuzzle.answerSchoolId);

  for (let index = 0; index < GAME_CONFIG.maxGuesses; index += 1) {
    const clue = state.activePuzzle.clues[index];
    const guessRecord = state.progress.guesses[index];
    const guessedSchool = guessRecord ? state.schoolMap.get(guessRecord.schoolId) : null;
    const feedback =
      guessRecord && guessedSchool && answerSchool
        ? buildFeedback(guessedSchool, answerSchool, guessRecord.correct)
        : guessRecord?.feedback;
    const clueVisible = index < state.progress.revealedClues;

    rows.push(`
      <li class="board-round ${guessRecord ? "board-row--played" : ""}">
        <h4 class="board-round__heading">Round ${index + 1}</h4>
        <div class="board-clue">${clueVisible ? escapeHtml(clue.text) : "Clue locked until the next round."}</div>
        <div class="board-guess"><span class="round-label">Guess</span> ${guessedSchool ? escapeHtml(guessedSchool.officialName) : "Not played yet"}</div>
        <div class="round-feedback" role="group" aria-label="Round ${index + 1} feedback">
          <div><span class="round-label">Result</span>${guessRecord ? renderResultIcon(guessRecord.correct) : renderEmptyIcon()}</div>
          <div><span class="round-label">Size</span>${feedback ? renderFeedbackIcon("enrollment", feedback.enrollment) : renderEmptyIcon()}</div>
          <div><span class="round-label">Grades</span>${feedback ? renderFeedbackIcon("gradeBand", feedback.gradeBand) : renderEmptyIcon()}</div>
          <div><span class="round-label">Direction</span>${feedback ? renderFeedbackIcon("direction", feedback.direction) : renderEmptyIcon()}</div>
        </div>
      </li>
    `);
  }

  elements.boardRounds.innerHTML = rows.join("");
}

function renderStatus() {
  if (state.progress.solved) {
    const answer = state.schoolMap.get(state.activePuzzle.answerSchoolId);
    elements.statusTitle.textContent = "Solved";
    elements.statusMessage.textContent = `You found ${answer.officialName} in ${state.progress.guesses.length} guesses.`;
    return;
  }

  if (state.progress.lost) {
    const answer = state.schoolMap.get(state.activePuzzle.answerSchoolId);
    elements.statusTitle.textContent = "Out of guesses";
    elements.statusMessage.textContent = `The answer was ${answer.officialName}.`;
    return;
  }

  elements.statusTitle.textContent = "Puzzle in progress";
  const lastGuess = state.progress.guesses.at(-1);
  const lastSchool = lastGuess ? state.schoolMap.get(lastGuess.schoolId) : null;
  elements.statusMessage.textContent = lastSchool
    ? `${lastSchool.officialName} is not the answer. Clue ${state.progress.revealedClues} is now visible. Compare the size, grades, and direction feedback.`
    : "Use the latest clue and the feedback from prior guesses to narrow it down.";
}

function renderWinOverlay() {
  if (!(state.progress.solved || state.progress.lost) || state.winOverlaySeen) {
    closeDialog(elements.winOverlay);
    return;
  }
  if (!elements.winOverlay.open) showResult(undefined, state.progress.solved);
}

function showResult(opener = elements.modeButtons.find((button) => button.dataset.mode === state.mode), celebrate = false) {
  if (!state.progress || !(state.progress.solved || state.progress.lost)) return;
  const answer = state.schoolMap.get(state.activePuzzle.answerSchoolId);
  elements.resultTitle.textContent = state.progress.solved ? "Congrats!" : "Out of guesses";
  elements.winAnswer.textContent = answer.officialName;
  const count = state.progress.guesses.length;
  elements.winSummary.textContent = state.progress.solved
    ? `You solved the ${state.activePuzzleDate} puzzle in ${count} ${count === 1 ? "guess" : "guesses"}.`
    : `You used all six guesses for the ${state.activePuzzleDate} puzzle. Try another past puzzle.`;
  if (state.mode === "daily") elements.winSummary.textContent += ` Daily points: ${state.progress.solved ? 7 - count : 0}.`;
  activeResult = { text: formatShareResult({
    date: state.activePuzzleDate,
    mode: state.mode,
    progress: state.progress,
    publicUrl: window.CHARTERSCHOOLDLE_SUPABASE?.publicUrl,
  }) };
  elements.shareText.value = activeResult.text;
  elements.shareFallback.classList.add("is-hidden");
  elements.shareStatus.textContent = "";
  elements.shareButton.disabled = false;
  elements.copyButton.disabled = false;
  openDialog(elements.winOverlay, opener);
  if (celebrate) launchConfetti();
}

async function shareResult(copy = false) {
  const presentation = activeResult;
  if (!presentation || !elements.winOverlay.open) return;
  const current = () => activeResult === presentation && elements.winOverlay.open;
  const button = copy ? elements.copyButton : elements.shareButton;
  elements.shareButton.disabled = true;
  elements.copyButton.disabled = true;
  elements.shareStatus.textContent = "";
  let selectText = false;
  try {
    if (copy) {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(presentation.text);
      if (current()) elements.shareStatus.textContent = "Result copied.";
    } else if (typeof navigator.share === "function") {
      await navigator.share({ text: presentation.text });
      if (current()) elements.shareStatus.textContent = "Result shared.";
    } else {
      elements.shareStatus.textContent = "Sharing is unavailable in this browser. Choose Copy result.";
    }
  } catch (error) {
    if (!current()) return;
    if (!copy && error.name === "AbortError") return;
    if (copy) {
      elements.shareStatus.textContent = "Could not copy the result. Select the text below and copy it yourself.";
      elements.shareFallback.classList.remove("is-hidden");
      selectText = true;
    } else {
      elements.shareStatus.textContent = "Could not share the result. Choose Copy result to copy it yourself.";
    }
  } finally {
    if (current()) {
      elements.shareButton.disabled = false;
      elements.copyButton.disabled = false;
      if (selectText) {
        elements.shareText.focus();
        elements.shareText.select();
      } else {
        button.focus();
      }
    }
  }
}

function launchConfetti() {
  const colors = ["#8fd169", "#708f96", "#e8e6a6", "#ffffff", "#b5b1a9"];
  elements.confettiLayer.replaceChildren();
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  for (let index = 0; index < 28; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 240}ms`;
    piece.style.animationDuration = `${1400 + Math.random() * 1200}ms`;
    elements.confettiLayer.appendChild(piece);
  }
}

function shakePanel() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  elements.primaryPanel.classList.remove("is-shaking");
  void elements.primaryPanel.offsetWidth;
  elements.primaryPanel.classList.add("is-shaking");
}

function syncInputLock() {
  if (state.mode === "leaderboard" || state.mode === "map") {
    elements.guessInput.disabled = true;
    elements.guessForm.querySelector("button[type='submit']").disabled = true;
    return;
  }

  const gameOver = !state.progress || state.progress.solved || state.progress.lost;
  elements.guessInput.disabled = gameOver;
  elements.guessForm.querySelector("button[type='submit']").disabled = gameOver;
}

function getGuessedSchoolIds() {
  return new Set((state.progress?.guesses || []).map((guess) => guess.schoolId));
}

function hasAlreadyGuessedSchool(schoolId) {
  return getGuessedSchoolIds().has(schoolId);
}

function handleGuessSubmission(event) {
  event.preventDefault();

  if (!state.progress || state.progress.solved || state.progress.lost) {
    return;
  }

  const value = elements.guessInput.value.trim();
  const school = state.schools.find((candidate) => candidate.officialName === value);
  if (!school) {
    elements.statusTitle.textContent = "Pick an official school";
    elements.statusMessage.textContent = "Choose one of the autocomplete options before submitting.";
    return;
  }

  if (hasAlreadyGuessedSchool(school.id)) {
    elements.statusTitle.textContent = "Already guessed";
    elements.statusMessage.textContent = "That school is already on the board. Pick another remaining school.";
    state.filteredSuggestions = [];
    state.selectedSuggestionIndex = -1;
    renderSuggestionList();
    return;
  }

  const answer = state.schoolMap.get(state.activePuzzle.answerSchoolId);
  const correct = school.id === answer.id;
  const feedback = buildFeedback(school, answer, correct);

  state.progress.guesses.push({
    schoolId: school.id,
    correct,
    feedback,
  });

  if (correct) {
    state.progress.solved = true;
    state.lastRoundOutcome = "right";
  } else if (state.progress.guesses.length >= GAME_CONFIG.maxGuesses) {
    state.progress.lost = true;
    state.lastRoundOutcome = "wrong";
  } else {
    state.progress.revealedClues = Math.min(
      state.progress.guesses.length + 1,
      state.activePuzzle.clues.length,
    );
    state.lastRoundOutcome = "wrong";
  }

  if (!correct) {
    shakePanel();
  }

  elements.guessInput.value = "";
  state.filteredSuggestions = [];
  state.selectedSuggestionIndex = -1;
  recordDailyAttempt();
  saveProgress();
  syncScores();
  render();
  if (!elements.guessInput.disabled) elements.guessInput.focus();
}

function recordDailyAttempt() {
  if (state.mode !== "daily" || !state.progress?.guesses.length) return;
  const status = state.progress.solved ? "solved" : state.progress.lost ? "lost" : "attempted";
  const existing = state.store.readResults().find((entry) => entry.date === state.activePuzzleDate);
  state.store.writeResult({
    date: state.activePuzzleDate,
    answerSchoolId: state.activePuzzle.answerSchoolId,
    status,
    guesses: state.progress.guesses.length,
    guessedSchoolIds: state.progress.guesses.map((guess) => guess.schoolId),
    completedAt: existing?.status === status && existing?.guesses === state.progress.guesses.length
      ? existing.completedAt : new Date().toISOString(),
  });
  leaderboard?.queueDailyResult({ date: state.activePuzzleDate, progress: state.progress, answerSchoolId: state.activePuzzle.answerSchoolId, mode: state.mode });
}

function buildScoreSummary() {
  return scoreSummary(state.store?.readResults() || [], ncToday());
}

function renderScoreSummary() {
  const summary = buildScoreSummary();
  const persistence = safeStorage.persistent ? (state.subject === "guest" ? "Guest progress stays in this browser" : "Account scores saved on this device") : "Progress lasts for this session only";
  elements.scoreStatus.textContent = `${summary.played === 0 ? "Daily results only" : `${summary.points} pts · ${summary.solved}/${summary.played} solved`} · ${persistence}`;
}

function renderMapView() {
  elements.retryButton.classList.add("is-hidden");
  elements.boardPanel.classList.add("is-hidden");
  elements.guessForm.classList.add("is-hidden");
  elements.leaderboardPanel.classList.add("is-hidden");
  elements.mapPanel.classList.remove("is-hidden");
  closeDialog(elements.winOverlay);
  elements.statusTitle.textContent = "School map";
  elements.statusMessage.textContent = "Use the North Carolina pin map with the direction feedback to narrow down the answer.";
  renderHeader();
  renderScoreSummary();
  renderSchoolMap();
}

function getMappableSchools() {
  return state.schools.filter(
    (school) =>
      Number.isFinite(school.coordinates?.lat) &&
      Number.isFinite(school.coordinates?.lng),
  );
}

function renderSchoolMap() {
  const mappableSchools = getMappableSchools();
  elements.mapSummary.textContent = `${mappableSchools.length} mapped schools in North Carolina`;

  if (!mappableSchools.length) {
    elements.mapContainer.innerHTML =
      '<div class="map-fallback">No mapped schools are available yet.</div>';
    return;
  }

  elements.mapContainer.innerHTML = `
    <div class="map-zoom-controls" aria-label="Map zoom controls">
      <button class="map-zoom-button" type="button" data-map-zoom="out" aria-label="Zoom out" title="Zoom out">−</button>
      <span class="map-zoom-status" data-map-zoom-status>${Math.round(state.map.zoom * 100)}%</span>
      <button class="map-zoom-button" type="button" data-map-zoom="in" aria-label="Zoom in" title="Zoom in">+</button>
      <button class="map-zoom-button" type="button" data-map-zoom="reset" aria-label="Reset map view" title="Reset map view">↺</button>
    </div>
    <div class="nc-map-frame" aria-label="North Carolina charter school locations">
      <div class="nc-map-canvas">
        <svg class="nc-map-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <polygon class="nc-map-outline__state" points="${renderNorthCarolinaOutlinePoints()}" />
        </svg>
        <div class="nc-map-pins">
          ${mappableSchools.map(renderMapPin).join("")}
        </div>
      </div>
    </div>
  `;

  elements.mapContainer.onclick = handleMapClick;
  elements.mapContainer.onkeydown = handleMapKeydown;
  elements.mapContainer.onwheel = handleMapWheel;
  elements.mapContainer.onpointerdown = handleMapPointerDown;
  elements.mapContainer.onpointermove = handleMapPointerMove;
  elements.mapContainer.onpointerup = handleMapPointerEnd;
  elements.mapContainer.onpointercancel = handleMapPointerEnd;
  syncMapTransform();
}

function renderNorthCarolinaOutlinePoints() {
  return NC_MAP_OUTLINE.map((point) => {
    const projected = projectCoordinateToMap(point);
    return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
  }).join(" ");
}

function renderMapPin(school) {
  const position = projectCoordinateToMap(school.coordinates);
  const cityState = [school.city, school.county ? `${school.county} County` : ""]
    .filter(Boolean)
    .join(" · ");
  const placementClasses = getMapPinPlacementClasses(position);
  const isSelected = state.map.selectedSchoolId === school.id;

  return `
    <button
      class="nc-map-pin ${placementClasses} ${isSelected ? "is-selected" : ""}"
      type="button"
      style="left: ${position.x.toFixed(3)}%; top: ${position.y.toFixed(3)}%;"
      data-map-school-id="${escapeHtml(school.id)}"
      aria-label="${escapeHtml(school.officialName)}"
      aria-pressed="${isSelected ? "true" : "false"}"
    >
      <span class="nc-map-pin__dot" aria-hidden="true"></span>
      <span class="nc-map-tooltip" role="tooltip">
        <strong>${escapeHtml(school.officialName)}</strong>
        ${cityState ? `<span>${escapeHtml(cityState)}</span>` : ""}
      </span>
    </button>
  `;
}

function projectCoordinateToMap(coordinates) {
  const longitudeRange = NC_MAP_BOUNDS.maxLng - NC_MAP_BOUNDS.minLng;
  const latitudeRange = NC_MAP_BOUNDS.maxLat - NC_MAP_BOUNDS.minLat;
  const rawX = ((coordinates.lng - NC_MAP_BOUNDS.minLng) / longitudeRange) * 100;
  const rawY = ((NC_MAP_BOUNDS.maxLat - coordinates.lat) / latitudeRange) * 100;
  const paddedX = NC_MAP_PADDING.x + (rawX / 100) * (100 - NC_MAP_PADDING.x * 2);
  const paddedY = NC_MAP_PADDING.y + (rawY / 100) * (100 - NC_MAP_PADDING.y * 2);

  return {
    x: Math.min(100 - NC_MAP_PADDING.x, Math.max(NC_MAP_PADDING.x, paddedX)),
    y: Math.min(100 - NC_MAP_PADDING.y, Math.max(NC_MAP_PADDING.y, paddedY)),
  };
}

function getMapPinPlacementClasses(position) {
  const classes = [];
  if (position.x > 74) {
    classes.push("nc-map-pin--west");
  } else if (position.x < 26) {
    classes.push("nc-map-pin--east");
  }

  if (position.y < 24) {
    classes.push("nc-map-pin--south");
  }

  return classes.join(" ");
}

function handleMapClick(event) {
  if (state.map.suppressClick) {
    state.map.suppressClick = false;
    return;
  }

  const zoomButton = getClosestEventTarget(event, "[data-map-zoom]");
  if (zoomButton) {
    handleMapZoomAction(zoomButton.dataset.mapZoom);
    return;
  }

  const pin = getClosestEventTarget(event, "[data-map-school-id]");
  if (!pin) {
    clearSelectedMapPin();
    return;
  }

  const nextSchoolId = pin.dataset.mapSchoolId;
  state.map.selectedSchoolId = state.map.selectedSchoolId === nextSchoolId ? null : nextSchoolId;
  syncSelectedMapPin();
}

function handleMapKeydown(event) {
  if (event.key === "Escape") {
    state.map.selectedSchoolId = null;
    syncSelectedMapPin();
  }
}

function handleMapWheel(event) {
  if (!getClosestEventTarget(event, ".nc-map-frame")) {
    return;
  }

  event.preventDefault();
  zoomMapBy(event.deltaY < 0 ? MAP_ZOOM_STEP : -MAP_ZOOM_STEP);
}

function handleMapPointerDown(event) {
  if (
    event.button !== 0 ||
    state.map.zoom <= MAP_ZOOM_MIN ||
    !getClosestEventTarget(event, ".nc-map-frame") ||
    getClosestEventTarget(event, "[data-map-school-id], [data-map-zoom]")
  ) {
    return;
  }

  const frame = getMapFrameElement();
  if (!frame) {
    return;
  }

  state.map.drag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: state.map.panX,
    originY: state.map.panY,
    moved: false,
  };

  frame.setPointerCapture(event.pointerId);
  frame.classList.add("is-dragging");
  event.preventDefault();
}

function handleMapPointerMove(event) {
  const drag = state.map.drag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }

  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
    drag.moved = true;
  }

  state.map.panX = drag.originX + deltaX;
  state.map.panY = drag.originY + deltaY;
  clampMapPan();
  syncMapTransform();
}

function handleMapPointerEnd(event) {
  const drag = state.map.drag;
  if (!drag || event.pointerId !== drag.pointerId) {
    return;
  }

  const frame = getMapFrameElement();
  if (frame) {
    frame.classList.remove("is-dragging");
    if (frame.hasPointerCapture(event.pointerId)) {
      frame.releasePointerCapture(event.pointerId);
    }
  }

  if (drag.moved) {
    state.map.suppressClick = true;
    window.setTimeout(() => {
      state.map.suppressClick = false;
    }, 120);
  }

  state.map.drag = null;
}

function handleMapZoomAction(action) {
  if (action === "in") {
    zoomMapBy(MAP_ZOOM_STEP);
    return;
  }

  if (action === "out") {
    zoomMapBy(-MAP_ZOOM_STEP);
    return;
  }

  resetMapView();
}

function zoomMapBy(delta) {
  setMapZoom(state.map.zoom + delta);
}

function setMapZoom(nextZoom) {
  state.map.zoom = clampNumber(nextZoom, MAP_ZOOM_MIN, MAP_ZOOM_MAX);
  if (state.map.zoom === MAP_ZOOM_MIN) {
    state.map.panX = 0;
    state.map.panY = 0;
  }

  clampMapPan();
  syncMapTransform();
}

function resetMapView() {
  state.map.zoom = MAP_ZOOM_MIN;
  state.map.panX = 0;
  state.map.panY = 0;
  syncMapTransform();
}

function syncMapTransform() {
  const canvas = elements.mapContainer.querySelector(".nc-map-canvas");
  const frame = getMapFrameElement();
  if (!canvas || !frame) {
    return;
  }

  const zoom = state.map.zoom;
  const isZoomed = zoom > MAP_ZOOM_MIN;
  canvas.style.transform = `translate(${state.map.panX}px, ${state.map.panY}px) scale(${zoom})`;
  canvas.style.setProperty("--map-pin-scale", String(1 / zoom));
  frame.classList.toggle("is-zoomed", isZoomed);

  const status = elements.mapContainer.querySelector("[data-map-zoom-status]");
  if (status) {
    status.textContent = `${Math.round(zoom * 100)}%`;
  }

  elements.mapContainer.querySelectorAll("[data-map-zoom]").forEach((button) => {
    const action = button.dataset.mapZoom;
    button.disabled =
      (action === "out" && zoom === MAP_ZOOM_MIN) ||
      (action === "in" && zoom === MAP_ZOOM_MAX) ||
      (action === "reset" && !isZoomed);
  });
}

function clampMapPan() {
  if (state.map.zoom <= MAP_ZOOM_MIN) {
    state.map.panX = 0;
    state.map.panY = 0;
    return;
  }

  const frame = getMapFrameElement();
  if (!frame) {
    return;
  }

  const rect = frame.getBoundingClientRect();
  const maxPanX = ((state.map.zoom - 1) * rect.width) / 2;
  const maxPanY = ((state.map.zoom - 1) * rect.height) / 2;
  state.map.panX = clampNumber(state.map.panX, -maxPanX, maxPanX);
  state.map.panY = clampNumber(state.map.panY, -maxPanY, maxPanY);
}

function getMapFrameElement() {
  return elements.mapContainer.querySelector(".nc-map-frame");
}

function getClosestEventTarget(event, selector) {
  if (event.target instanceof Element) {
    return event.target.closest(selector);
  }

  return event.target?.parentElement?.closest(selector) || null;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clearSelectedMapPin() {
  state.map.selectedSchoolId = null;
  syncSelectedMapPin();
}

function syncSelectedMapPin() {
  elements.mapContainer.querySelectorAll("[data-map-school-id]").forEach((pin) => {
    const isSelected = pin.dataset.mapSchoolId === state.map.selectedSchoolId;
    pin.classList.toggle("is-selected", isSelected);
    pin.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });
}

function renderLeaderboardView() {
  const summary = buildScoreSummary();
  elements.boardPanel.classList.add("is-hidden");
  elements.guessForm.classList.add("is-hidden");
  elements.leaderboardPanel.classList.remove("is-hidden");
  elements.mapPanel.classList.add("is-hidden");
  elements.retryButton.classList.add("is-hidden");
  closeDialog(elements.winOverlay);
  elements.statusTitle.textContent = "Daily leaderboard";
  elements.statusMessage.textContent = "Public participation is optional. Your personal totals include all saved daily scores.";
  elements.scoreTotal.textContent = String(summary.points);
  elements.scoreWinStreak.textContent = String(summary.winStreak);
  elements.scoreAttemptStreak.textContent = String(summary.attemptStreak);
  elements.scoreAverage.textContent = summary.average === null ? "—" : summary.average.toFixed(1);
  elements.leaderboardSummary.textContent = "Your daily puzzle scores";
  const board = state.leaderboard;
  const available = Boolean(auth?.getClient() || publicClient);
  elements.leaderboardSortButtons.forEach((button) => {
    button.disabled = !available;
    button.classList.toggle("is-active", button.dataset.leaderboardSort === board.sort);
    button.setAttribute("aria-pressed", String(button.dataset.leaderboardSort === board.sort));
  });
  const pages = Math.max(1, Math.ceil((board.total || 0) / 5));
  elements.leaderboardPagination.classList.toggle("is-hidden", board.status !== "ready" || pages <= 1);
  elements.leaderboardPrev.disabled = board.page <= 1;
  elements.leaderboardNext.disabled = board.page >= pages;
  elements.leaderboardPageStatus.textContent = `Page ${board.page} of ${pages}`;
  elements.leaderboardSyncStatus.textContent = board.message || "The public leaderboard is unavailable. Guest play remains available.";
  elements.leaderboardRetry.classList.toggle("is-hidden", board.status !== "error" || !available);
  elements.leaderboardRounds.innerHTML = board.status === "ready" && board.records.length
    ? board.records.map(row => `<tr><td>${escapeHtml(row.rank)}</td><td>${escapeHtml(row.displayName)}</td><td>${escapeHtml(row.school || "—")}</td><td>${escapeHtml(row.points)}</td><td>${escapeHtml(row.solved)} / ${escapeHtml(row.played)}</td><td>${escapeHtml(row.winStreak)}</td><td>${escapeHtml(row.attemptStreak)}</td><td>${typeof row.average === "number" ? row.average.toFixed(1) : "—"}</td></tr>`).join("")
    : `<tr><td class="leaderboard-empty" colspan="8">${board.status === "loading" ? "Loading public rankings…" : board.status === "ready" ? "No public scores yet. Play a daily puzzle and choose to show your profile to join." : "Public rankings are unavailable. You can keep playing."}</td></tr>`;
  renderHeader();
  renderScoreSummary();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function buildFeedback(guessSchool, answerSchool, correct) {
  return {
    enrollment: compareEnrollment(guessSchool, answerSchool, correct),
    gradeBand: compareGradeSpan(guessSchool, answerSchool, correct),
    direction: compareDirection(guessSchool.coordinates, answerSchool.coordinates, correct),
  };
}

function parseEnrollmentCount(school) {
  const count = Number.parseFloat(school.adm2024);
  return Number.isFinite(count) ? count : null;
}

function compareEnrollment(guessSchool, answerSchool, correct) {
  if (correct) {
    return { status: "match" };
  }

  if (
    guessSchool.enrollmentBand &&
    answerSchool.enrollmentBand &&
    guessSchool.enrollmentBand === answerSchool.enrollmentBand
  ) {
    return { status: "match" };
  }

  const bandOrder = ["0-400", "401-800", "801+"];
  const guessIndex = bandOrder.indexOf(guessSchool.enrollmentBand);
  const answerIndex = bandOrder.indexOf(answerSchool.enrollmentBand);
  if (guessIndex !== -1 && answerIndex !== -1) {
    return {
      status: guessIndex < answerIndex ? "too-small" : "too-large",
    };
  }

  const guessCount = parseEnrollmentCount(guessSchool);
  const answerCount = parseEnrollmentCount(answerSchool);
  if (guessCount === null || answerCount === null) {
    return { status: "unknown" };
  }

  return {
    status: guessCount < answerCount ? "too-small" : "too-large",
  };
}

function parseGradeSpan(raw) {
  if (!raw) {
    return [];
  }

  const parsed = [];
  raw.split(":").forEach((token) => {
    const normalized = token.trim().toUpperCase();
    if (!normalized || normalized === "XG") {
      return;
    }
    if (["PK", "0K", "KG", "K"].includes(normalized)) {
      parsed.push(0);
      return;
    }
    if (/^\d+$/.test(normalized)) {
      parsed.push(Number.parseInt(normalized, 10));
    }
  });

  if (parsed.length >= 2) {
    const min = Math.min(...parsed);
    const max = Math.max(...parsed);
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }

  return [...new Set(parsed)].sort((left, right) => left - right);
}

function gradeRange(school) {
  const grades = parseGradeSpan(school.gradeSpanRaw);
  if (!grades.length) {
    return null;
  }

  return {
    min: grades[0],
    max: grades[grades.length - 1],
  };
}

function compareGradeSpan(guessSchool, answerSchool, correct) {
  const guessRange = gradeRange(guessSchool);
  const answerRange = gradeRange(answerSchool);

  if (correct || guessSchool.gradeSpanRaw === answerSchool.gradeSpanRaw) {
    return { status: "match" };
  }

  if (!guessRange || !answerRange) {
    return { status: "unknown" };
  }

  if (guessRange.min === answerRange.min && guessRange.max === answerRange.max) {
    return { status: "match" };
  }

  if (answerRange.min <= guessRange.min && answerRange.max >= guessRange.max) {
    return { status: "wider" };
  }

  if (answerRange.min >= guessRange.min && answerRange.max <= guessRange.max) {
    return { status: "narrower" };
  }

  return { status: answerRange.max > guessRange.max ? "older" : "younger" };
}

function compareDirection(fromCoordinates, toCoordinates, correct) {
  if (correct) {
    return { status: "match", arrow: "◎", label: "Match" };
  }

  if (
    !fromCoordinates ||
    !toCoordinates ||
    !Number.isFinite(fromCoordinates.lat) ||
    !Number.isFinite(fromCoordinates.lng) ||
    !Number.isFinite(toCoordinates.lat) ||
    !Number.isFinite(toCoordinates.lng)
  ) {
    return { status: "unknown", arrow: "?", label: "Direction unavailable" };
  }

  const distanceMiles = distanceBetweenCoordinates(fromCoordinates, toCoordinates);
  if (distanceMiles < 0.1) {
    return { status: "close", arrow: "◎", label: "Same location", distanceMiles };
  }

  const label = compassDirection(fromCoordinates, toCoordinates);
  const arrowMap = {
    N: "↑",
    S: "↓",
    E: "→",
    W: "←",
    NE: "↗",
    NW: "↖",
    SE: "↘",
    SW: "↙",
  };

  return {
    status: "different",
    arrow: arrowMap[label],
    label,
    distanceMiles,
  };
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceBetweenCoordinates(fromCoordinates, toCoordinates) {
  const lat1 = toRadians(fromCoordinates.lat);
  const lat2 = toRadians(toCoordinates.lat);
  const latDelta = toRadians(toCoordinates.lat - fromCoordinates.lat);
  const lngDelta = toRadians(toCoordinates.lng - fromCoordinates.lng);

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

function compassDirection(fromCoordinates, toCoordinates) {
  const lat1 = toRadians(fromCoordinates.lat);
  const lat2 = toRadians(toCoordinates.lat);
  const lngDelta = toRadians(toCoordinates.lng - fromCoordinates.lng);
  const y = Math.sin(lngDelta) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lngDelta);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(bearing / 45) % directions.length];
}

function feedbackIcon(symbol, variant, label) {
  return `<span class="board-icon board-icon--${variant}" aria-hidden="true">${escapeHtml(symbol)}</span><span>${escapeHtml(label)}</span>`;
}

function renderResultIcon(correct) {
  return correct
    ? feedbackIcon("✓", "good", "Correct school")
    : feedbackIcon("✕", "bad", "Wrong school");
}

function renderFeedbackIcon(type, feedback) {
  if (type === "enrollment") {
    if (feedback.status === "match") {
      return feedbackIcon("＝", "neutral", "Enrollment match");
    }
    if (feedback.status === "unknown") {
      return feedbackIcon("?", "muted", "Enrollment unavailable");
    }

    return feedback.status === "too-small"
      ? feedbackIcon("↑", "warn", "Answer is larger")
      : feedbackIcon("↓", "warn", "Answer is smaller");
  }

  if (type === "gradeBand") {
    if (feedback.status === "match") {
      return feedbackIcon("＝", "neutral", "Grade span match");
    }
    if (feedback.status === "unknown") {
      return feedbackIcon("?", "muted", "Grade span unavailable");
    }
    if (feedback.status === "wider") {
      return feedbackIcon("↔", "warn", "Answer spans younger and older grades");
    }
    if (feedback.status === "narrower") {
      return feedbackIcon("↔", "warn", "Answer has a narrower grade span");
    }

    return feedback.status === "older"
      ? feedbackIcon("→", "warn", "Answer serves older grades")
      : feedbackIcon("←", "warn", "Answer serves younger grades");
  }

  const distance =
    typeof feedback.distanceMiles === "number" ? `, ${Math.round(feedback.distanceMiles)} mi away` : "";
  return feedbackIcon(feedback.arrow, "neutral", `${feedback.label}${distance}`);
}

function renderEmptyIcon() {
  return feedbackIcon("•", "muted", "Not played");
}

function updateSuggestions() {
  const query = elements.guessInput.value.trim().toLowerCase();
  if (!query) {
    state.filteredSuggestions = [];
    state.selectedSuggestionIndex = -1;
    renderSuggestionList();
    return;
  }

  const guessedSchoolIds = getGuessedSchoolIds();
  state.filteredSuggestions = state.schools
    .filter(
      (school) =>
        school.officialName.toLowerCase().includes(query) &&
        !guessedSchoolIds.has(school.id),
    )
    .slice(0, 10);
  state.selectedSuggestionIndex = state.filteredSuggestions.length ? 0 : -1;
  renderSuggestionList();
  if (!state.filteredSuggestions.length) elements.suggestionStatus.textContent = "No matching schools. Try another school name.";
}

function renderSuggestionList() {
  const expanded = state.filteredSuggestions.length > 0;
  elements.guessInput.setAttribute("aria-expanded", String(expanded));
  elements.guessInput.removeAttribute("aria-activedescendant");
  elements.autocompleteList.classList.toggle("is-hidden", !expanded);
  elements.autocompleteList.replaceChildren();
  state.filteredSuggestions.forEach((school, index) => {
    const item = document.createElement("li");
    item.id = `school-option-${index}`;
    item.className = `autocomplete-item ${index === state.selectedSuggestionIndex ? "is-active" : ""}`;
    item.dataset.schoolId = school.id;
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", String(index === state.selectedSuggestionIndex));
    item.textContent = school.officialName;
    elements.autocompleteList.appendChild(item);
    if (index === state.selectedSuggestionIndex) {
      elements.guessInput.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    }
  });
  elements.suggestionStatus.textContent = expanded
    ? `${state.filteredSuggestions.length} matching schools. Use the arrow keys to choose, then Enter to select.`
    : "";
}

function handleSuggestionSelection(schoolId) {
  const school = state.schoolMap.get(schoolId);
  if (!school) {
    return;
  }

  elements.guessInput.value = school.officialName;
  state.filteredSuggestions = [];
  state.selectedSuggestionIndex = -1;
  renderSuggestionList();
  elements.suggestionStatus.textContent = `${school.officialName} selected. Submit your guess.`;
  elements.guessInput.focus();
}

function handleGuessInputKeydown(event) {
  if (!state.filteredSuggestions.length) {
    return;
  }

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.selectedSuggestionIndex =
      (state.selectedSuggestionIndex + 1) % state.filteredSuggestions.length;
    renderSuggestionList();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    state.selectedSuggestionIndex =
      (state.selectedSuggestionIndex - 1 + state.filteredSuggestions.length) %
      state.filteredSuggestions.length;
    renderSuggestionList();
  } else if (event.key === "Enter" && state.selectedSuggestionIndex >= 0) {
    event.preventDefault();
    handleSuggestionSelection(state.filteredSuggestions[state.selectedSuggestionIndex].id);
  } else if (event.key === "Escape") {
    state.filteredSuggestions = [];
    state.selectedSuggestionIndex = -1;
    renderSuggestionList();
  }
}

function renderEmail() {
  if (!auth) return;
  const current = auth.state;
  const active = Boolean(current.userId);
  const sent = !active && current.phase === "sent" && !emailEditing;
  const joining = joinMode === "join";
  const pending = onboarding?.pending;
  const seconds = Math.max(0, Math.ceil((current.resendAt - Date.now()) / 1000));
  elements.emailTitle.textContent = sent ? "Check your email" : joining ? "Join the leaderboard" : "Sign in";
  elements.emailIntro.textContent = sent ? "Open the confirmation link in this browser to continue." : joining ? "Choose your public name, then confirm your email to finish joining." : "Restore your saved profile, privacy choices, and daily scores.";
  if (active && joining) elements.emailIntro.textContent = "Your email is confirmed. Choose your public name to finish joining.";
  elements.joinFields.hidden = !joining || sent;
  elements.joinName.disabled = !joining || sent;
  elements.joinSchool.disabled = !joining || sent;
  elements.emailFields.hidden = active || sent;
  elements.emailInput.disabled = active || sent;
  elements.emailEdit.hidden = !sent;
  elements.emailMode.hidden = active || sent;
  elements.emailMode.textContent = joining ? "Already joined? Sign in" : "New here? Join leaderboard";
  elements.emailSubmit.disabled = accountBusy || current.phase === "sending" || (!active && seconds > 0);
  elements.emailSubmit.textContent = accountBusy ? "Finishing setup…" : current.phase === "sending" ? "Requesting link…" : sent ? (seconds ? `Resend link in ${seconds}s` : "Resend confirmation link") : joining ? "Join leaderboard" : "Send sign-in link";
  if (sent) {
    const address = joining ? pending?.email || elements.emailInput.value.trim() : elements.emailInput.value.trim();
    elements.emailStatus.textContent = `Check your email at ${address}. ${joining ? "Your profile details are retained. Confirmation finishes joining automatically." : "Confirmation restores your account."} Open the link in this browser. ${seconds ? `You can request another link in ${seconds} seconds.` : "You can request another link now."}`;
  } else if (joinFeedback) elements.emailStatus.textContent = joinFeedback;
  else elements.emailStatus.textContent = current.message;
}

function renderAccount() {
  if (!auth) return;
  const current = auth.state;
  elements.accountButton.textContent = current.userId && accountProfile ? "Edit profile" : "Join leaderboard";
  elements.accountButton.disabled = current.phase === "unavailable" || accountBusy;
  elements.signOut.classList.toggle("is-hidden", !current.userId);
  elements.accountRetry.classList.toggle("is-hidden", !current.userId || !accountProblem);
  renderEmail();
  elements.accountStatus.textContent = joinFeedback || (accountBusy ? "Finishing account setup…" : "") || current.message || (current.userId ? (accountProfile?.listed ? "Your profile is public." : accountProfile ? "Your scores are private." : "Choose a public name to join the leaderboard.") : "Play as a guest, or join to save daily scores across devices.");
}

function showJoin(mode = "join") {
  joinMode = mode;
  emailEditing = false;
  joinFeedback = "";
  const pending = onboarding.pending;
  const prefill = pending || loadLegacyProfile(safeStorage);
  elements.joinName.value = prefill.displayName || "";
  elements.joinSchool.value = prefill.school || "";
  if (pending) elements.emailInput.value = pending.email;
  renderEmail();
  openDialog(elements.emailDialog, elements.accountButton);
}

async function finishJoin(revision) {
  if (!onboarding.pending) return null;
  accountBusy = true;
  renderAccount();
  try {
    const result = await onboarding.finish();
    if (revision !== accountRevision) return null;
    if (result.status === "none") return null;
    accountProfile = result.profile;
    accountProblem = false;
    joinFeedback = result.status === "joined" ? "You’re joined and ready. Your daily scores are saved; your profile is public." : "Welcome back. Your existing profile and privacy choices are restored.";
    closeDialog(elements.emailDialog);
    return result;
  } catch (error) {
    if (revision === accountRevision && error.name !== "AbortError") {
      accountProblem = true;
      joinFeedback = "Could not finish account setup. Your details are retained. Use Retry account sync to finish without another email link.";
    }
    throw error;
  } finally {
    if (revision === accountRevision) { accountBusy = false; renderAccount(); }
  }
}

// Rebuild only authoritative daily entries, never archive progress sharing a date.
function refreshOwnerSessions() {
  if (state.subject === "guest") return;
  for (const entry of state.store.readResults()) {
    if (!entry.guessedSchoolIds) continue;
    const progress = validateProgress({ guesses: entry.guessedSchoolIds.map(schoolId => ({ schoolId })) }, { schoolIds: new Set(state.schoolMap.keys()), answerId: entry.answerSchoolId });
    if (progress) dailySessions.set(`${state.subject}:${entry.date}`, progress);
  }
  if (state.mode === "daily" && state.activePuzzle) {
    const previousIds = state.progress?.guesses.map(guess => guess.schoolId);
    state.progress = loadSavedProgress(state.activePuzzleDate);
    const restoredIds = state.progress.guesses.map(guess => guess.schoolId);
    if (JSON.stringify(previousIds) !== JSON.stringify(restoredIds)) {
      state.winOverlaySeen = state.progress.solved || state.progress.lost;
    }
  }
  if (state.progress || ["leaderboard", "map"].includes(state.mode)) render();
}

async function selectAccount(current, retry = false) {
  renderAccount();
  const next = current.userId || "guest";
  if (next === state.subject && !retry) return;
  const revision = ++accountRevision;
  state.subject = next;
  state.store = storeFor(next);
  accountProfile = null;
  accountProblem = false;
  accountBusy = false;
  joinFeedback = "";
  leaderboard.setSubject(next);
  closeDialog(elements.profileDialog);
  closeDialog(elements.winOverlay);
  if (state.activePuzzle && ["daily", "archive"].includes(state.mode)) {
    state.progress = loadSavedProgress(state.activePuzzleDate);
    state.winOverlaySeen = state.progress.solved || state.progress.lost;
  }
  if (state.progress || ["leaderboard", "map"].includes(state.mode)) render();
  renderAccount();
  if (state.mode === "leaderboard") refreshRankings();
  if (next === "guest") return;
  try {
    // Bind a verified intent before any owner read can fail. The join lock also
    // lets another confirmation tab finish before this tab restores its profile.
    const joined = await finishJoin(revision);
    if (revision !== accountRevision) return;
    const profile = joined?.profile || await leaderboard.readProfile();
    if (revision !== accountRevision) return;
    accountProfile = profile;
    if (profile && !joined && state.mode === "daily") recordDailyAttempt();
    await leaderboard.readOwnerResults();
    if (revision !== accountRevision) return;
    refreshOwnerSessions();
    renderAccount();
    if (elements.emailDialog.open) {
      closeDialog(elements.emailDialog);
      if (!accountProfile) showJoin();
    }
    await syncScores();
    if (joined && revision === accountRevision) renderAccount();
  } catch (error) {
    if (revision === accountRevision && error.name !== "AbortError") {
      accountProblem = true;
      joinFeedback = joinFeedback || "Could not load account scores. Your progress stays on this device. Use Retry account sync to try again.";
      renderAccount();
    }
  }
}

async function syncScores() {
  if (!leaderboard || state.subject === "guest" || !accountProfile) return;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  const revision = accountRevision;
  try {
    await leaderboard.flush();
    if (revision !== accountRevision) return;
    refreshOwnerSessions();
    accountProblem = false;
    elements.accountRetry.classList.add("is-hidden");
    elements.accountStatus.textContent = state.store.readPending().length
      ? "A saved result differs from this device. Showing the saved game; this device’s pending guesses are retained."
      : accountProfile.listed ? "Daily scores saved. Your profile is public." : "Daily scores saved privately.";
  } catch (error) {
    if (revision === accountRevision && error.name !== "AbortError") {
      accountProblem = true;
      elements.accountRetry.classList.remove("is-hidden");
      elements.accountStatus.textContent = "Scores could not sync. Pending scores stay on this device. Use Retry account sync to try again.";
    }
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; void syncScores(); }
  }
}

async function refreshRankings() {
  if (!leaderboard) return;
  state.leaderboard.status = "loading";
  state.leaderboard.message = "Loading public rankings…";
  if (state.mode === "leaderboard") renderLeaderboardView();
  try {
    const page = await leaderboard.refresh({ sort: state.leaderboard.sort, page: state.leaderboard.page });
    Object.assign(state.leaderboard, { records: page.rows, total: page.total, page: page.page, status: "ready", message: "Only players who choose to be public appear here." });
  } catch (error) {
    if (error.name === "AbortError") return;
    Object.assign(state.leaderboard, { records: [], status: "error", message: "Public rankings are unavailable. Your game and personal scores remain available." });
  }
  if (state.mode === "leaderboard") renderLeaderboardView();
}

function showProfile() {
  profilePresentation++;
  elements.profileSubmit.disabled = false;
  const prefill = accountProfile || loadLegacyProfile(safeStorage);
  elements.profileName.value = prefill.displayName || "";
  elements.profileSchool.value = prefill.school || "";
  elements.profileListed.checked = accountProfile?.listed === true;
  elements.profileIncludeToday.checked = false;
  elements.profileStatus.textContent = "";
  openDialog(elements.profileDialog, elements.accountButton);
}

function initializeAccounts() {
  const config = window.CHARTERSCHOOLDLE_SUPABASE;
  let createClient = null;
  auth = createAuthController({ config, storage: safeStorage, loadClient: async () => {
    createClient = await loadLocalAuthClient();
    return createClient;
  } });
  leaderboard = createLeaderboardController({
    getClient: () => auth.getClient() || (state.subject === "guest" ? publicClient : null),
    storeFor, getPuzzle: getPuzzleByDate, schoolIds: new Set(state.schoolMap.keys()),
  });
  onboarding = createOnboardingController({ storage: safeStorage, auth, leaderboard, guestStore: storeFor("guest"), ownerStore: () => state.store });
  auth.subscribe(current => { void selectAccount(current); });
  void auth.ready.then(() => {
    // Auth validates configuration before loading the factory. This separate
    // client survives sign-out and never carries a session or owner operation.
    if (createClient) {
      try {
        publicClient = createClient(config.url, config.anonKey, {
          auth: { storageKey: "charterschoodle-public:v2", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: async (input, options = {}) => {
            const controller = new AbortController();
            const timer = window.setTimeout(() => controller.abort(), 10_000);
            try { return await fetch(input, { ...options, signal: controller.signal }); }
            finally { window.clearTimeout(timer); }
          } },
        });
      } catch { /* Public rankings can fail independently of the game. */ }
    }
    renderAccount();
    if (state.mode === "leaderboard") refreshRankings();
  });
  elements.accountButton.addEventListener("click", () => accountProfile ? showProfile() : showJoin());
  elements.accountRetry.addEventListener("click", () => { void selectAccount(auth.state, true); });
  elements.signOut.addEventListener("click", async () => { onboarding.cancel(); try { await auth.signOut(); } catch { renderAccount(); } });
  document.getElementById("email-close").addEventListener("click", () => closeDialog(elements.emailDialog));
  document.getElementById("profile-close").addEventListener("click", () => closeDialog(elements.profileDialog));
  elements.emailMode.addEventListener("click", () => {
    onboarding.cancel();
    showJoin(joinMode === "join" ? "signin" : "join");
  });
  elements.emailEdit.addEventListener("click", () => {
    onboarding.cancel();
    emailEditing = true;
    joinFeedback = "Update your details, then request a new link when the countdown ends.";
    renderEmail();
    elements.emailInput.focus();
  });
  elements.emailForm.addEventListener("submit", async event => {
    event.preventDefault();
    joinFeedback = "";
    try {
      if (auth.state.userId) {
        if (onboarding.pending?.owner !== auth.state.userId || onboarding.pending?.displayName !== elements.joinName.value.trim() || onboarding.pending?.school !== elements.joinSchool.value.trim()) onboarding.prepare({ displayName: elements.joinName.value, school: elements.joinSchool.value }, { active: true });
        await finishJoin(accountRevision);
        refreshOwnerSessions();
      } else if (joinMode === "join") {
        // Resends keep the same consent and request identity; edits replace them.
        if (auth.state.phase === "sent" && !emailEditing && onboarding.pending) {
          const pending = onboarding.pending;
          await auth.sendLink(pending.email, { requestId: pending.id });
        } else await onboarding.request({ email: elements.emailInput.value, displayName: elements.joinName.value, school: elements.joinSchool.value });
        emailEditing = false;
      } else {
        onboarding.cancel();
        await auth.sendLink(elements.emailInput.value);
        emailEditing = false;
      }
    } catch (error) {
      if (error.name !== "AbortError") joinFeedback = joinFeedback || error.message;
    }
    renderAccount();
  });
  elements.profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    const revision = accountRevision;
    const presentation = profilePresentation;
    const ownsDialog = () => revision === accountRevision && presentation === profilePresentation && elements.profileDialog.open;
    // The submitted choice remains authorized even if this dialog is dismissed.
    // A reopened presentation owns its own fields, status, controls, and focus.
    const submission = {
      profile: { displayName: elements.profileName.value, school: elements.profileSchool.value, listed: elements.profileListed.checked },
      include: elements.profileIncludeToday.checked,
      date: ncToday(),
      joining: !accountProfile,
    };
    elements.profileSubmit.disabled = true;
    elements.profileStatus.textContent = "Saving profile…";
    try {
      const profile = await leaderboard.saveProfile(submission.profile);
      if (revision !== accountRevision) return;
      accountProfile = profile;
      if (submission.joining) {
        // Account score entries are daily-only; archive progress and guest
        // scorebooks are separate and never become implicit import sources.
        for (const entry of state.store.readResults()) {
          if (!entry.guessedSchoolIds) continue;
          const progress = validateProgress({ guesses: entry.guessedSchoolIds.map(schoolId => ({ schoolId })) }, { schoolIds: new Set(state.schoolMap.keys()), answerId: entry.answerSchoolId });
          if (progress) leaderboard.queueDailyResult({ date: entry.date, progress, answerSchoolId: entry.answerSchoolId, mode: "daily" });
        }
      }
      const imported = await leaderboard.adoptTodayGuest({ confirmed: submission.include, guestStore: storeFor("guest"), date: submission.date });
      if (revision !== accountRevision) return;
      refreshOwnerSessions();
      renderAccount();
      if (ownsDialog()) closeDialog(elements.profileDialog);
      await syncScores();
      if (revision !== accountRevision) return;
      if (submission.include && !imported) elements.accountStatus.textContent = "Profile saved. Today’s guest result was not added: it is empty, already imported, or your account already has a result.";
      if (state.mode === "leaderboard") refreshRankings();
    } catch (error) {
      if (ownsDialog() && error.name !== "AbortError") elements.profileStatus.textContent = "Could not save the profile or add the guest result. Your entries are still here; try Save profile again.";
    } finally {
      if (revision === accountRevision && presentation === profilePresentation) elements.profileSubmit.disabled = false;
    }
  });
  elements.leaderboardRetry.addEventListener("click", refreshRankings);
  window.addEventListener("online", () => { void syncScores(); });
  window.setInterval(renderEmail, 1000);
  renderAccount();
}

async function init() {

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  elements.leaderboardSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.leaderboard.sort = button.dataset.leaderboardSort;
      state.leaderboard.page = 1;
      refreshRankings();
    });
  });
  elements.leaderboardPrev.addEventListener("click", () => {
    state.leaderboard.page = Math.max(1, state.leaderboard.page - 1);
    refreshRankings();
  });
  elements.leaderboardNext.addEventListener("click", () => {
    state.leaderboard.page += 1;
    refreshRankings();
  });
  window.addEventListener("resize", () => {
    if (state.mode === "map") {
      clampMapPan();
      syncMapTransform();
    }
  });

  elements.archiveDate.addEventListener("change", () => {
    if (state.mode === "archive") {
      loadPuzzleForDate(elements.archiveDate.value);
    }
  });

  elements.guessForm.addEventListener("submit", handleGuessSubmission);
  elements.guessInput.addEventListener("input", updateSuggestions);
  elements.guessInput.addEventListener("keydown", handleGuessInputKeydown);
  elements.autocompleteList.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") event.preventDefault();
  });
  elements.autocompleteList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-school-id]");
    if (item) {
      handleSuggestionSelection(item.dataset.schoolId);
    }
  });
  elements.helpButton.addEventListener("click", () => openDialog(elements.helpDialog));
  elements.helpCloseButton.addEventListener("click", () => closeDialog(elements.helpDialog));
  elements.winOverlay.addEventListener("close", () => {
    state.winOverlaySeen = true;
    activeResult = null;
  });
  elements.resultButton.addEventListener("click", () => showResult(elements.resultButton));
  elements.shareButton.addEventListener("click", () => shareResult());
  elements.copyButton.addEventListener("click", () => shareResult(true));
  elements.resultArchiveButton.addEventListener("click", () => {
    closeDialog(elements.winOverlay);
    setMode("archive");
  });
  elements.winCloseButton.addEventListener("click", () => {
    state.winOverlaySeen = true;
    renderWinOverlay();
  });
  elements.retryButton.addEventListener("click", retryData);
  elements.newDailyButton.addEventListener("click", () => {
    state.dailyDate = ncToday();
    setMode("daily");
    checkForNewDaily();
  });
  document.addEventListener("visibilitychange", checkForNewDaily);
  window.setInterval(checkForNewDaily, 30_000);
  await retryData();
}

init().catch((error) => {
  elements.statusTitle.textContent = "App failed to load";
  elements.statusMessage.textContent = error.message;
});
