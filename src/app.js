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

const gradeBandOrder = [
  "Elementary",
  "Middle",
  "High",
  "Elementary+Middle",
  "Middle+High",
  "Elementary+High",
  "Elementary+Middle+High",
];

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

  for (let index = 0; index < GAME_CONFIG.maxGuesses; index += 1) {
    const clue = state.activePuzzle.clues[index];
    const guessRecord = state.progress.guesses[index];
    const guessedSchool = guessRecord ? state.schoolMap.get(guessRecord.schoolId) : null;
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
        <td>${guessRecord ? renderFeedbackIcon("enrollment", guessRecord.feedback.enrollment) : renderEmptyIcon()}</td>
        <td>${guessRecord ? renderFeedbackIcon("gradeBand", guessRecord.feedback.gradeBand) : renderEmptyIcon()}</td>
        <td>${guessRecord ? renderFeedbackIcon("direction", guessRecord.feedback.direction) : renderEmptyIcon()}</td>
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
    enrollment: compareEnrollmentBand(guessSchool.enrollmentBand, answerSchool.enrollmentBand, correct),
    gradeBand: compareGradeBand(guessSchool.gradeBand, answerSchool.gradeBand, correct),
    direction: compareDirection(guessSchool.coordinates, answerSchool.coordinates, correct),
  };
}

function compareEnrollmentBand(guessBand, answerBand, correct) {
  if (correct || guessBand === answerBand) {
    return { status: "match" };
  }

  const bandOrder = ["0-400", "401-800", "801+"];
  return {
    status: bandOrder.indexOf(guessBand) < bandOrder.indexOf(answerBand) ? "too-small" : "too-large",
  };
}

function compareGradeBand(guessBand, answerBand, correct) {
  if (correct || guessBand === answerBand) {
    return { status: "match" };
  }

  const guessIndex = gradeBandOrder.indexOf(guessBand);
  const answerIndex = gradeBandOrder.indexOf(answerBand);
  return { status: guessIndex < answerIndex ? "older" : "younger" };
}

function compareDirection(fromCoordinates, toCoordinates, correct) {
  if (correct) {
    return { status: "match", arrow: "◎", label: "Match" };
  }

  const latDelta = toCoordinates.lat - fromCoordinates.lat;
  const lngDelta = toCoordinates.lng - fromCoordinates.lng;
  const vertical = latDelta > 0.15 ? "N" : latDelta < -0.15 ? "S" : "";
  const horizontal = lngDelta > 0.15 ? "E" : lngDelta < -0.15 ? "W" : "";
  const label = `${vertical}${horizontal}` || "Nearby";
  const arrowMap = {
    N: "↑",
    S: "↓",
    E: "→",
    W: "←",
    NE: "↗",
    NW: "↖",
    SE: "↘",
    SW: "↙",
    Nearby: "◎",
  };

  return {
    status: label === "Nearby" ? "close" : "different",
    arrow: arrowMap[label],
    label,
  };
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

    return feedback.status === "too-small"
      ? '<span class="board-icon board-icon--warn" title="Answer is larger">↑</span>'
      : '<span class="board-icon board-icon--warn" title="Answer is smaller">↓</span>';
  }

  if (type === "gradeBand") {
    if (feedback.status === "match") {
      return '<span class="board-icon board-icon--neutral" title="Grade span match">＝</span>';
    }

    return feedback.status === "older"
      ? '<span class="board-icon board-icon--warn" title="Answer serves older grades">→</span>'
      : '<span class="board-icon board-icon--warn" title="Answer serves younger grades">←</span>';
  }

  return `<span class="board-icon board-icon--neutral" title="${feedback.label}">${feedback.arrow}</span>`;
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
