const GAME_CONFIG = {
  maxGuesses: 6,
  storageKeyPrefix: "charterschoodle-progress",
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
  boardBody: document.getElementById("board-body"),
  guessCounter: document.getElementById("guess-counter"),
  guessForm: document.getElementById("guess-form"),
  primaryPanel: document.querySelector(".panel--primary"),
  guessInput: document.getElementById("school-guess"),
  autocompleteList: document.getElementById("autocomplete-list"),
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
};

const EARTH_RADIUS_MILES = 3958.8;

async function loadData() {
  const [metadataResponse, schoolsResponse] = await Promise.all([
    fetch("./data/puzzles.json"),
    fetch("./data/schools.json"),
  ]);

  state.metadata = await metadataResponse.json();
  state.schools = await schoolsResponse.json();
  state.schoolMap = new Map(state.schools.map((school) => [school.id, school]));
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
  render();
}

function revealNextClueIfNeeded() {
  const minimumVisible = Math.min(state.progress.guesses.length + 1, state.activePuzzle.clues.length);
  state.progress.revealedClues = Math.max(state.progress.revealedClues, minimumVisible);
}

function render() {
  revealNextClueIfNeeded();
  renderHeader();
  renderBoard();
  renderStatus();
  renderWinOverlay();
  renderSuggestionList();
  syncInputLock();
}

function renderHeader() {
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
  const gameOver = state.progress.solved || state.progress.lost;
  elements.guessInput.disabled = gameOver;
  elements.guessForm.querySelector("button[type='submit']").disabled = gameOver;
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
  saveProgress();
  render();
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

  state.filteredSuggestions = state.schools
    .filter((school) => school.officialName.toLowerCase().includes(query))
    .slice(0, 10);
  state.selectedSuggestionIndex = 0;
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
          ${school.officialName}
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

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  elements.archiveDate.addEventListener("change", () => {
    if (state.mode === "archive") {
      loadPuzzleForDate(elements.archiveDate.value);
    }
  });

  elements.guessForm.addEventListener("submit", handleGuessSubmission);
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
}

init().catch((error) => {
  elements.statusTitle.textContent = "App failed to load";
  elements.statusMessage.textContent = error.message;
});
