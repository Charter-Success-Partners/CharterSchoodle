const GAME_CONFIG = {
  maxGuesses: 6,
  storageKeyPrefix: "charterschoodle-progress",
  scoreStorageKey: "charterschoodle-scorebook:v1",
  playerStorageKey: "charterschoodle-player:v1",
  defaultSupabaseTable: "charterschoodle_results",
  leaderboardFetchLimit: 5000,
  leaderboardPageSize: 5,
};

const elements = {
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  archiveControls: document.getElementById("archive-controls"),
  archiveDate: document.getElementById("archive-date"),
  puzzleLabel: document.getElementById("puzzle-label"),
  puzzleHeading: document.getElementById("puzzle-date-heading"),
  statusTitle: document.getElementById("status-title"),
  statusMessage: document.getElementById("status-message"),
  clueProgress: document.getElementById("clue-progress"),
  boardPanel: document.getElementById("board-panel"),
  boardBody: document.getElementById("board-body"),
  mapPanel: document.getElementById("map-panel"),
  mapSummary: document.getElementById("map-summary"),
  mapContainer: document.getElementById("school-map"),
  leaderboardPanel: document.getElementById("leaderboard-panel"),
  leaderboardSummary: document.getElementById("leaderboard-summary"),
  leaderboardBody: document.getElementById("leaderboard-body"),
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
  autocompleteList: document.getElementById("autocomplete-list"),
  playerForm: document.getElementById("player-form"),
  playerName: document.getElementById("player-name"),
  playerSchool: document.getElementById("player-school"),
  profileOverlay: document.getElementById("profile-overlay"),
  profileModalForm: document.getElementById("profile-modal-form"),
  profileName: document.getElementById("profile-name"),
  profileSchool: document.getElementById("profile-school"),
  profileModalStatus: document.getElementById("profile-modal-status"),
  winOverlay: document.getElementById("win-overlay"),
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
  player: null,
  scorebook: null,
  supabase: null,
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
  },
};

const EARTH_RADIUS_MILES = 3958.8;
const NC_MAP_BOUNDS = {
  minLat: 33.75,
  maxLat: 36.7,
  minLng: -84.45,
  maxLng: -75.25,
};
const NC_MAP_OUTLINE = [
  { lat: 34.99, lng: -84.32 },
  { lat: 35.18, lng: -84.05 },
  { lat: 35.38, lng: -83.8 },
  { lat: 35.54, lng: -83.48 },
  { lat: 35.74, lng: -83.18 },
  { lat: 35.94, lng: -82.86 },
  { lat: 36.12, lng: -82.52 },
  { lat: 36.34, lng: -82.2 },
  { lat: 36.58, lng: -81.72 },
  { lat: 36.58, lng: -79.52 },
  { lat: 36.56, lng: -77.9 },
  { lat: 36.55, lng: -76.45 },
  { lat: 36.35, lng: -75.84 },
  { lat: 36.07, lng: -75.72 },
  { lat: 35.74, lng: -75.48 },
  { lat: 35.29, lng: -75.54 },
  { lat: 35.0, lng: -75.78 },
  { lat: 34.86, lng: -76.26 },
  { lat: 34.73, lng: -76.72 },
  { lat: 34.5, lng: -77.14 },
  { lat: 34.26, lng: -77.62 },
  { lat: 33.96, lng: -78.05 },
  { lat: 33.85, lng: -78.58 },
  { lat: 34.05, lng: -79.08 },
  { lat: 34.34, lng: -79.48 },
  { lat: 34.81, lng: -80.78 },
  { lat: 34.96, lng: -81.04 },
  { lat: 35.14, lng: -81.38 },
  { lat: 35.19, lng: -81.76 },
  { lat: 35.08, lng: -82.12 },
  { lat: 35.05, lng: -82.62 },
  { lat: 35.0, lng: -83.18 },
  { lat: 34.99, lng: -84.32 },
];

async function loadData() {
  const [metadataResponse, schoolsResponse] = await Promise.all([
    fetch("./data/puzzles.json"),
    fetch("./data/schools.json"),
  ]);

  state.metadata = await metadataResponse.json();
  state.schools = await schoolsResponse.json();
  state.schoolMap = new Map(state.schools.map((school) => [school.id, school]));
  state.player = loadPlayerProfile();
  state.scorebook = loadScorebook();
  state.supabase = loadSupabaseConfig();
  savePlayerProfile();
}

function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initializeArchiveBounds() {
  const dates = state.metadata.puzzles.map((puzzle) => puzzle.date).sort();
  elements.archiveDate.min = dates[0];
  elements.archiveDate.max = dates[dates.length - 1];
  elements.archiveDate.value = dates[dates.length - 1];
}

function setMode(mode) {
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
    refreshLeaderboard({ silent: true });
    return;
  }

  if (mode === "map") {
    state.filteredSuggestions = [];
    state.selectedSuggestionIndex = -1;
    render();
    return;
  }

  const date = mode === "daily" ? getTodayIso() : elements.archiveDate.value;
  loadPuzzleForDate(date);
}

function getPuzzleByDate(date) {
  return state.metadata.puzzles.find((candidate) => candidate.date === date) || null;
}

function getProgressKey(date) {
  return `${GAME_CONFIG.storageKeyPrefix}:${date}`;
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
  const raw = localStorage.getItem(getProgressKey(date));
  if (!raw) {
    return createFreshProgress();
  }

  try {
    return { ...createFreshProgress(), ...JSON.parse(raw) };
  } catch {
    return createFreshProgress();
  }
}

function saveProgress() {
  if (!state.activePuzzleDate || !state.progress) {
    return;
  }

  localStorage.setItem(getProgressKey(state.activePuzzleDate), JSON.stringify(state.progress));
}

function loadPlayerProfile() {
  const fallback = { id: createPlayerId(), name: "", school: "" };
  const raw = localStorage.getItem(GAME_CONFIG.playerStorageKey);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return buildPlayerProfile(parsed.name || "", parsed.school || parsed.team || "", parsed.id || fallback.id);
  } catch {
    return fallback;
  }
}

function savePlayerProfile() {
  state.player = buildPlayerProfile(state.player?.name || "", state.player?.school || "", state.player?.id);
  localStorage.setItem(GAME_CONFIG.playerStorageKey, JSON.stringify(state.player));
}

function createPlayerId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeProfileValue(value) {
  return String(value).trim().replace(/\s+/g, " ").slice(0, 80);
}

function normalizeIdentityValue(value) {
  return normalizeProfileValue(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildPlayerProfile(name, school, fallbackId = createPlayerId()) {
  const profile = {
    id: fallbackId,
    name: normalizeProfileValue(name),
    school: normalizeProfileValue(school),
  };

  if (profile.name && profile.school) {
    profile.id = profileIdForNameSchool(profile.name, profile.school);
  }

  return profile;
}

function profileKeyForNameSchool(name, school) {
  const normalizedName = normalizeIdentityValue(name);
  const normalizedSchool = normalizeIdentityValue(school);
  return normalizedName && normalizedSchool ? `${normalizedName}|${normalizedSchool}` : "";
}

function profileKeyForRecord(record) {
  return profileKeyForNameSchool(record.playerName, record.schoolName);
}

function currentProfileKey() {
  return profileKeyForNameSchool(state.player?.name, state.player?.school);
}

function profileIdForNameSchool(name, school) {
  return `profile-${hashProfileKey(profileKeyForNameSchool(name, school))}`;
}

function hashProfileKey(value) {
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }

  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
  return `${(second >>> 0).toString(36)}${(first >>> 0).toString(36)}`;
}

function hasCompletePlayerProfile() {
  return Boolean(state.player?.name?.trim() && state.player?.school?.trim());
}

function loadSupabaseConfig() {
  const config = window.CHARTERSCHOOLDLE_SUPABASE || {};
  const rawUrl = typeof config.url === "string" ? config.url.trim() : "";
  const rawAnonKey = typeof config.anonKey === "string" ? config.anonKey.trim() : "";
  const table =
    typeof config.table === "string" && /^[A-Za-z0-9_]+$/.test(config.table)
      ? config.table
      : GAME_CONFIG.defaultSupabaseTable;

  if (
    !rawUrl ||
    !rawAnonKey ||
    rawUrl.includes("YOUR_") ||
    rawAnonKey.includes("YOUR_")
  ) {
    return null;
  }

  return {
    url: rawUrl.replace(/\/+$/, ""),
    anonKey: rawAnonKey,
    table,
  };
}

function loadScorebook() {
  const raw = localStorage.getItem(GAME_CONFIG.scoreStorageKey);
  if (!raw) {
    return { results: {} };
  }

  try {
    return { results: {}, ...JSON.parse(raw) };
  } catch {
    return { results: {} };
  }
}

function saveScorebook() {
  localStorage.setItem(GAME_CONFIG.scoreStorageKey, JSON.stringify(state.scorebook));
}

function loadPuzzleForDate(date) {
  const puzzle = getPuzzleByDate(date);
  if (!puzzle) {
    elements.statusTitle.textContent = "Puzzle not found";
    elements.statusMessage.textContent = "That date does not have a puzzle yet.";
    return;
  }

  state.activePuzzle = puzzle;
  state.activePuzzleDate = date;
  state.progress = loadSavedProgress(date);
  state.filteredSuggestions = [];
  state.selectedSuggestionIndex = -1;
  state.lastRoundOutcome = null;
  state.winOverlaySeen = !!state.progress.solved;
  recordDailyAttempt();
  render();
}

function revealNextClueIfNeeded() {
  const minimumVisible = Math.min(state.progress.guesses.length + 1, state.activePuzzle.clues.length);
  state.progress.revealedClues = Math.max(state.progress.revealedClues, minimumVisible);
}

function render() {
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
      <tr class="${guessRecord ? "board-row--played" : ""}">
        <td class="board-round">${index + 1}</td>
        <td class="board-clue">
          ${
            clueVisible
              ? `<div class="board-clue__text">${clue.text}</div>`
              : `<span class="board-icon board-icon--muted">•</span>`
          }
        </td>
        <td class="board-guess">${guessedSchool ? guessedSchool.officialName : "—"}</td>
        <td>${guessRecord ? renderResultIcon(guessRecord.correct) : renderEmptyIcon()}</td>
        <td>${feedback ? renderFeedbackIcon("enrollment", feedback.enrollment) : renderEmptyIcon()}</td>
        <td>${feedback ? renderFeedbackIcon("gradeBand", feedback.gradeBand) : renderEmptyIcon()}</td>
        <td>${feedback ? renderFeedbackIcon("direction", feedback.direction) : renderEmptyIcon()}</td>
      </tr>
    `);
  }

  elements.boardBody.innerHTML = rows.join("");
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
  elements.statusMessage.textContent = "Use the latest clue and the feedback from prior guesses to narrow it down.";
}

function renderWinOverlay() {
  if (!state.progress.solved || state.winOverlaySeen) {
    elements.winOverlay.classList.add("is-hidden");
    elements.winOverlay.setAttribute("aria-hidden", "true");
    return;
  }

  const answer = state.schoolMap.get(state.activePuzzle.answerSchoolId);
  elements.winAnswer.textContent = answer.officialName;
  elements.winSummary.textContent = `You solved the ${state.activePuzzleDate} puzzle in ${state.progress.guesses.length} guesses.`;
  elements.winOverlay.classList.remove("is-hidden");
  elements.winOverlay.setAttribute("aria-hidden", "false");
  launchConfetti();
}

function launchConfetti() {
  const colors = ["#8fd169", "#708f96", "#e8e6a6", "#ffffff", "#b5b1a9"];
  elements.confettiLayer.innerHTML = "";

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

  const gameOver = state.progress.solved || state.progress.lost;
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

  if (state.progress.solved || state.progress.lost) {
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
  render();
}

function recordDailyAttempt() {
  if (state.mode !== "daily" || state.progress.guesses.length === 0) {
    return;
  }

  const status = state.progress.solved ? "solved" : state.progress.lost ? "lost" : "attempted";
  const guessCount = state.progress.guesses.length;
  const existing = state.scorebook.results[state.activePuzzleDate];
  const hasSameResult = existing?.status === status && existing?.guesses === guessCount;

  state.scorebook.results[state.activePuzzleDate] = {
    date: state.activePuzzleDate,
    answerSchoolId: state.activePuzzle.answerSchoolId,
    status,
    guesses: guessCount,
    points: status === "solved" ? GAME_CONFIG.maxGuesses + 1 - guessCount : 0,
    completedAt: hasSameResult && existing?.completedAt ? existing.completedAt : new Date().toISOString(),
  };
  saveScorebook();
  syncLocalScoresToRemote();
}

function buildScoreSummary(records = getCurrentPlayerRecords()) {
  const results = dedupeResultsByDate(records).sort((left, right) => left.date.localeCompare(right.date));
  const solved = results.filter((result) => result.status === "solved");
  const points = results.reduce((sum, result) => sum + Number(result.points || 0), 0);
  const average =
    solved.length > 0
      ? solved.reduce((sum, result) => sum + result.guesses, 0) / solved.length
      : null;
  const attemptStreaks = calculateStreaks(results, () => true);
  const winStreaks = calculateStreaks(dropTrailingAttemptedResults(results), (result) => result.status === "solved");

  return {
    points,
    played: results.length,
    solved: solved.length,
    attemptStreak: attemptStreaks.current,
    winStreak: winStreaks.current,
    bestAttemptStreak: attemptStreaks.best,
    bestWinStreak: winStreaks.best,
    average,
  };
}

function getCurrentPlayerRecords() {
  const localRecords = buildLocalLeaderboardRecords();
  const profileKey = currentProfileKey();

  if (!profileKey || !state.leaderboard.records.length) {
    return localRecords;
  }

  const remoteProfileRecords = state.leaderboard.records.filter(
    (record) => profileKeyForRecord(record) === profileKey,
  );
  return [...remoteProfileRecords, ...localRecords];
}

function dropTrailingAttemptedResults(results) {
  const trimmed = [...results];
  while (trimmed[trimmed.length - 1]?.status === "attempted") {
    trimmed.pop();
  }
  return trimmed;
}

function dedupeResultsByDate(records) {
  const byDate = new Map();
  records.forEach((record) => {
    if (!record?.date) {
      return;
    }

    const existing = byDate.get(record.date);
    if (!existing || String(record.completedAt || "").localeCompare(String(existing.completedAt || "")) >= 0) {
      byDate.set(record.date, record);
    }
  });
  return [...byDate.values()];
}

function calculateStreaks(results, qualifies) {
  let best = 0;
  let currentRun = 0;
  let previousDate = null;

  results.forEach((result) => {
    if (!qualifies(result)) {
      currentRun = 0;
      previousDate = result.date;
      return;
    }

    currentRun = previousDate && areConsecutivePuzzleDates(previousDate, result.date) ? currentRun + 1 : 1;
    best = Math.max(best, currentRun);
    previousDate = result.date;
  });

  return { current: currentRun, best };
}

function areConsecutivePuzzleDates(previousDate, currentDate) {
  const puzzleDates = state.metadata?.puzzles?.map((puzzle) => puzzle.date).sort() || [];
  const previousIndex = puzzleDates.indexOf(previousDate);
  const currentIndex = puzzleDates.indexOf(currentDate);

  if (previousIndex !== -1 && currentIndex !== -1) {
    return currentIndex === previousIndex + 1;
  }

  return dayNumber(currentDate) - dayNumber(previousDate) === 1;
}

function dayNumber(date) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 86400000);
}

function renderScoreSummary() {
  const summary = buildScoreSummary();
  const profilePrompt = hasCompletePlayerProfile() ? "" : " · add name and school";
  elements.scoreStatus.textContent =
    summary.played === 0
      ? `Daily results only${profilePrompt}`
      : `${summary.points} pts · ${summary.solved}/${summary.played} solved${profilePrompt}`;
  elements.playerName.value = state.player.name;
  elements.playerSchool.value = state.player.school;
}

function openProfilePrompt() {
  elements.profileName.value = state.player.name;
  elements.profileSchool.value = state.player.school;
  elements.profileModalStatus.textContent = "";
  elements.profileOverlay.classList.remove("is-hidden");
  elements.profileOverlay.setAttribute("aria-hidden", "false");
  window.setTimeout(() => elements.profileName.focus(), 0);
}

function closeProfilePrompt() {
  elements.profileOverlay.classList.add("is-hidden");
  elements.profileOverlay.setAttribute("aria-hidden", "true");
}

function showProfilePromptIfNeeded() {
  if (!hasCompletePlayerProfile()) {
    openProfilePrompt();
  }
}

function savePlayerFromFields(name, school) {
  const nextProfile = buildPlayerProfile(name, school, state.player?.id);

  if (!nextProfile.name || !nextProfile.school) {
    return false;
  }

  state.player = nextProfile;
  savePlayerProfile();
  renderScoreSummary();
  if (state.mode === "leaderboard") {
    renderLeaderboardView();
  }
  syncLocalScoresToRemote();
  return true;
}

function renderMapView() {
  elements.boardPanel.classList.add("is-hidden");
  elements.guessForm.classList.add("is-hidden");
  elements.leaderboardPanel.classList.add("is-hidden");
  elements.mapPanel.classList.remove("is-hidden");
  elements.winOverlay.classList.add("is-hidden");
  elements.winOverlay.setAttribute("aria-hidden", "true");
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
    <div class="nc-map-frame" aria-label="North Carolina charter school locations">
      <svg class="nc-map-outline" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <polygon class="nc-map-outline__state" points="${renderNorthCarolinaOutlinePoints()}" />
        <polyline class="nc-map-outline__coast" points="${renderNorthCarolinaCoastPoints()}" />
      </svg>
      <div class="nc-map-pins">
        ${mappableSchools.map(renderMapPin).join("")}
      </div>
    </div>
  `;

  elements.mapContainer.onclick = handleMapClick;
  elements.mapContainer.onkeydown = handleMapKeydown;
}

function renderNorthCarolinaOutlinePoints() {
  return NC_MAP_OUTLINE.map((point) => {
    const projected = projectCoordinateToMap(point);
    return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
  }).join(" ");
}

function renderNorthCarolinaCoastPoints() {
  return NC_MAP_OUTLINE.slice(13, 24)
    .map((point) => {
      const projected = projectCoordinateToMap(point);
      return `${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
    })
    .join(" ");
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

  return {
    x: Math.min(98, Math.max(2, rawX)),
    y: Math.min(96, Math.max(4, rawY)),
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
  const pin = event.target.closest("[data-map-school-id]");
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
  const rows = buildLeaderboardRows();
  const pageSize = GAME_CONFIG.leaderboardPageSize;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  state.leaderboard.page = Math.min(Math.max(1, state.leaderboard.page), totalPages);
  const pageStart = (state.leaderboard.page - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const visibleRows = rows.slice(pageStart, pageEnd);
  const playerName = state.player.name.trim() || "You";
  const averageLabel = summary.average === null ? "—" : summary.average.toFixed(1);
  const scoreVerb = playerName === "You" ? "have" : "has";
  const profileKey = currentProfileKey();

  elements.boardPanel.classList.add("is-hidden");
  elements.guessForm.classList.add("is-hidden");
  elements.leaderboardPanel.classList.remove("is-hidden");
  elements.mapPanel.classList.add("is-hidden");
  elements.winOverlay.classList.add("is-hidden");
  elements.winOverlay.setAttribute("aria-hidden", "true");
  elements.statusTitle.textContent = "Leaderboard";
  elements.statusMessage.textContent = `${playerName} ${scoreVerb} ${summary.points} points across ${summary.played} daily puzzle${summary.played === 1 ? "" : "s"}.`;
  elements.scoreTotal.textContent = String(summary.points);
  elements.scoreWinStreak.textContent = String(summary.winStreak);
  elements.scoreAttemptStreak.textContent = String(summary.attemptStreak);
  elements.scoreAverage.textContent = averageLabel;
  elements.leaderboardSortButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.leaderboardSort === state.leaderboard.sort);
  });
  elements.leaderboardSummary.textContent =
    rows.length === 0
      ? "No scored daily puzzles yet"
      : `Showing ${pageStart + 1}-${Math.min(pageEnd, rows.length)} of ${rows.length} player${rows.length === 1 ? "" : "s"}`;
  elements.leaderboardPagination.classList.toggle("is-hidden", rows.length <= pageSize);
  elements.leaderboardPrev.disabled = state.leaderboard.page <= 1;
  elements.leaderboardNext.disabled = state.leaderboard.page >= totalPages;
  elements.leaderboardPageStatus.textContent = `Page ${state.leaderboard.page} of ${totalPages}`;
  elements.leaderboardSyncStatus.textContent = getLeaderboardStatusMessage();
  elements.leaderboardBody.innerHTML = visibleRows.length
    ? visibleRows
        .map(
          (row, index) => `
            <tr class="${profileKey && row.profileKey === profileKey ? "leaderboard-row--you" : ""}">
              <td>${pageStart + index + 1}</td>
              <td>${escapeHtml(row.playerName)}</td>
              <td>${escapeHtml(row.schoolName)}</td>
              <td>${row.points}</td>
              <td>${row.solved}/${row.played}</td>
              <td>${row.winStreak}</td>
              <td>${row.attemptStreak}</td>
              <td>${row.average === null ? "—" : row.average.toFixed(1)}</td>
            </tr>
          `,
        )
        .join("")
    : '<tr><td class="leaderboard-empty" colspan="8">No daily scores recorded yet.</td></tr>';
  renderHeader();
  renderScoreSummary();
}

function buildLeaderboardRows() {
  const records = getLeaderboardRecords();
  const players = new Map();

  records.forEach((record) => {
    const recordProfileKey = profileKeyForRecord(record);
    const key = recordProfileKey || record.clientPlayerId || `${record.playerName}:${record.schoolName}`;
    if (!players.has(key)) {
      players.set(key, {
        profileKey: recordProfileKey,
        clientPlayerId: record.clientPlayerId,
        playerName: record.playerName || "Unknown Player",
        schoolName: record.schoolName || "School not set",
        records: [],
        latestRecord: null,
      });
    }

    const player = players.get(key);
    player.records.push(record);
    if (
      !player.latestRecord ||
      String(record.completedAt || record.date).localeCompare(
        String(player.latestRecord.completedAt || player.latestRecord.date),
      ) >= 0
    ) {
      player.latestRecord = record;
      player.playerName = record.playerName || player.playerName;
      player.schoolName = record.schoolName || player.schoolName;
    }
  });

  const rows = [...players.values()].map((player) => ({
    profileKey: player.profileKey,
    clientPlayerId: player.clientPlayerId,
    playerName: player.playerName,
    schoolName: player.schoolName,
    ...buildScoreSummary(player.records),
  }));
  const sortGetters = {
    points: (row) => row.points,
    winStreak: (row) => row.winStreak,
    attemptStreak: (row) => row.attemptStreak,
    bestWinStreak: (row) => row.bestWinStreak,
  };
  const primaryGetter = sortGetters[state.leaderboard.sort] || sortGetters.points;

  return rows.sort((left, right) => {
    const primary = primaryGetter(right) - primaryGetter(left);
    if (primary) {
      return primary;
    }

    return (
      right.points - left.points ||
      right.solved - left.solved ||
      averageSortValue(left.average) - averageSortValue(right.average) ||
      left.playerName.localeCompare(right.playerName)
    );
  });
}

function averageSortValue(value) {
  return value === null ? Number.POSITIVE_INFINITY : value;
}

function getLeaderboardRecords() {
  const localRecords = buildLocalLeaderboardRecords();

  if (!state.supabase || state.leaderboard.status === "error" || !state.leaderboard.records.length) {
    return localRecords;
  }

  return [...state.leaderboard.records, ...localRecords];
}

function buildLocalLeaderboardRecords() {
  const playerName = state.player.name.trim() || "You";
  const schoolName = state.player.school.trim() || "School not set";

  return Object.values(state.scorebook?.results || {}).map((result) => ({
    clientPlayerId: state.player.id,
    playerName,
    schoolName,
    date: result.date,
    answerSchoolId: result.answerSchoolId,
    status: result.status || "attempted",
    guesses: Number(result.guesses),
    points: Number(result.points || 0),
    completedAt: result.completedAt,
  }));
}

function getLeaderboardStatusMessage() {
  if (!state.supabase) {
    return "Company leaderboard is not connected yet. Scores are saved on this device.";
  }

  if (!hasCompletePlayerProfile()) {
    return "Add your name and school to publish your daily scores.";
  }

  if (state.leaderboard.status === "syncing") {
    return "Syncing your daily scores...";
  }

  if (state.leaderboard.status === "loading") {
    return "Loading company leaderboard...";
  }

  if (state.leaderboard.status === "error") {
    return state.leaderboard.message || "Could not load the company leaderboard. Showing saved scores.";
  }

  return "Company leaderboard is connected.";
}

async function refreshLeaderboard({ silent = false } = {}) {
  if (!state.supabase) {
    state.leaderboard.status = "local";
    state.leaderboard.records = [];
    return;
  }

  state.leaderboard.status = silent ? state.leaderboard.status : "loading";
  if (state.mode === "leaderboard") {
    renderLeaderboardView();
  }

  try {
    state.leaderboard.records = await fetchRemoteLeaderboardRecords();
    state.leaderboard.status = "ready";
    state.leaderboard.message = "";
  } catch (error) {
    state.leaderboard.status = "error";
    state.leaderboard.message = "Could not load the company leaderboard. Showing saved scores.";
    console.warn(error);
  }

  if (state.mode === "leaderboard") {
    renderLeaderboardView();
  } else {
    renderScoreSummary();
  }
}

async function syncLocalScoresToRemote() {
  if (!state.supabase || state.leaderboard.syncInFlight || !hasCompletePlayerProfile()) {
    return;
  }

  const records = buildLocalLeaderboardRecords();
  if (!records.length) {
    await refreshLeaderboard({ silent: true });
    return;
  }

  state.leaderboard.syncInFlight = true;
  state.leaderboard.status = "syncing";
  if (state.mode === "leaderboard") {
    renderLeaderboardView();
  }

  try {
    await upsertRemoteLeaderboardRecords(records);
    await refreshLeaderboard({ silent: true });
  } catch (error) {
    state.leaderboard.status = "error";
    state.leaderboard.message = "Could not sync your daily scores. They are still saved on this device.";
    console.warn(error);
    if (state.mode === "leaderboard") {
      renderLeaderboardView();
    }
  } finally {
    state.leaderboard.syncInFlight = false;
  }
}

async function fetchRemoteLeaderboardRecords() {
  const params = new URLSearchParams({
    select:
      "client_player_id,player_name,school_name,puzzle_date,answer_school_id,status,guesses,points,completed_at",
    order: "puzzle_date.asc",
    limit: String(GAME_CONFIG.leaderboardFetchLimit),
  });
  const rows = await supabaseRequest(`${state.supabase.table}?${params.toString()}`);
  return Array.isArray(rows) ? rows.map(normalizeRemoteRecord).filter(Boolean) : [];
}

async function upsertRemoteLeaderboardRecords(records) {
  const payload = records.map((record) => ({
    client_player_id: record.clientPlayerId,
    player_name: record.playerName,
    school_name: record.schoolName,
    puzzle_date: record.date,
    answer_school_id: record.answerSchoolId,
    status: record.status,
    guesses: record.guesses,
    points: record.points,
    completed_at: record.completedAt,
  }));

  await supabaseRequest(`${state.supabase.table}?on_conflict=client_player_id,puzzle_date`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(payload),
  });
}

async function supabaseRequest(path, options = {}) {
  const headers = {
    apikey: state.supabase.anonKey,
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.supabase.anonKey.startsWith("ey")) {
    headers.Authorization = `Bearer ${state.supabase.anonKey}`;
  }

  const response = await fetch(`${state.supabase.url}/rest/v1/${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${message}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function normalizeRemoteRecord(row) {
  if (!row?.client_player_id || !row?.puzzle_date) {
    return null;
  }

  return {
    clientPlayerId: row.client_player_id,
    playerName: normalizeProfileValue(row.player_name || "Unknown Player"),
    schoolName: normalizeProfileValue(row.school_name || "School not set"),
    date: row.puzzle_date,
    answerSchoolId: row.answer_school_id,
    status: ["attempted", "solved", "lost"].includes(row.status) ? row.status : "attempted",
    guesses: Number(row.guesses || 0),
    points: Number(row.points || 0),
    completedAt: row.completed_at || row.puzzle_date,
  };
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

function renderResultIcon(correct) {
  return correct
    ? '<span class="board-icon board-icon--good" title="Correct">✓</span>'
    : '<span class="board-icon board-icon--bad" title="Wrong">✕</span>';
}

function renderFeedbackIcon(type, feedback) {
  if (type === "enrollment") {
    if (feedback.status === "match") {
      return '<span class="board-icon board-icon--neutral" title="Enrollment match">＝</span>';
    }
    if (feedback.status === "unknown") {
      return '<span class="board-icon board-icon--muted" title="Enrollment unavailable">?</span>';
    }

    return feedback.status === "too-small"
      ? '<span class="board-icon board-icon--warn" title="Answer is larger">↑</span>'
      : '<span class="board-icon board-icon--warn" title="Answer is smaller">↓</span>';
  }

  if (type === "gradeBand") {
    if (feedback.status === "match") {
      return '<span class="board-icon board-icon--neutral" title="Grade span match">＝</span>';
    }
    if (feedback.status === "unknown") {
      return '<span class="board-icon board-icon--muted" title="Grade span unavailable">?</span>';
    }
    if (feedback.status === "wider") {
      return '<span class="board-icon board-icon--warn" title="Answer spans younger and older grades">↔</span>';
    }
    if (feedback.status === "narrower") {
      return '<span class="board-icon board-icon--warn" title="Answer has a narrower grade span">↔</span>';
    }

    return feedback.status === "older"
      ? '<span class="board-icon board-icon--warn" title="Answer serves older grades">→</span>'
      : '<span class="board-icon board-icon--warn" title="Answer serves younger grades">←</span>';
  }

  const distance =
    typeof feedback.distanceMiles === "number" ? `, ${Math.round(feedback.distanceMiles)} mi away` : "";
  return `<span class="board-icon board-icon--neutral" title="${feedback.label}${distance}">${feedback.arrow}</span>`;
}

function renderEmptyIcon() {
  return '<span class="board-icon board-icon--muted" title="Not played">•</span>';
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
}

function renderSuggestionList() {
  if (!state.filteredSuggestions.length) {
    elements.autocompleteList.classList.add("is-hidden");
    elements.autocompleteList.innerHTML = "";
    return;
  }

  elements.autocompleteList.classList.remove("is-hidden");
  elements.autocompleteList.innerHTML = state.filteredSuggestions
    .map(
      (school, index) => `
        <li
          class="autocomplete-item ${index === state.selectedSuggestionIndex ? "is-active" : ""}"
          data-school-id="${school.id}"
        >
          ${escapeHtml(school.officialName)}
        </li>
      `,
    )
    .join("");
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

async function init() {
  await loadData();
  initializeArchiveBounds();
  setMode("daily");
  refreshLeaderboard({ silent: true });
  syncLocalScoresToRemote();

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });
  elements.leaderboardSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.leaderboard.sort = button.dataset.leaderboardSort;
      state.leaderboard.page = 1;
      renderLeaderboardView();
    });
  });
  elements.leaderboardPrev.addEventListener("click", () => {
    state.leaderboard.page = Math.max(1, state.leaderboard.page - 1);
    renderLeaderboardView();
  });
  elements.leaderboardNext.addEventListener("click", () => {
    state.leaderboard.page += 1;
    renderLeaderboardView();
  });

  elements.archiveDate.addEventListener("change", () => {
    if (state.mode === "archive") {
      loadPuzzleForDate(elements.archiveDate.value);
    }
  });

  elements.guessForm.addEventListener("submit", handleGuessSubmission);
  elements.playerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    savePlayerFromFields(elements.playerName.value, elements.playerSchool.value);
  });
  elements.profileModalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (savePlayerFromFields(elements.profileName.value, elements.profileSchool.value)) {
      closeProfilePrompt();
      return;
    }

    elements.profileModalStatus.textContent = "Name and school are required.";
  });
  elements.guessInput.addEventListener("input", updateSuggestions);
  elements.guessInput.addEventListener("keydown", handleGuessInputKeydown);
  elements.autocompleteList.addEventListener("mousedown", (event) => {
    const item = event.target.closest("[data-school-id]");
    if (item) {
      handleSuggestionSelection(item.dataset.schoolId);
    }
  });
  elements.winCloseButton.addEventListener("click", () => {
    state.winOverlaySeen = true;
    renderWinOverlay();
  });
  showProfilePromptIfNeeded();
}

init().catch((error) => {
  elements.statusTitle.textContent = "App failed to load";
  elements.statusMessage.textContent = error.message;
});
