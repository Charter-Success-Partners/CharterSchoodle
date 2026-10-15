/**
 * @typedef {{schoolId: string, correct: boolean}} Guess
 * @typedef {{guesses: Guess[], revealedClues: number, solved: boolean, lost: boolean}} Progress
 * @typedef {{date: string, answerSchoolId: string, status: 'attempted'|'solved'|'lost', guesses: number, points: number, completedAt?: string, guessedSchoolIds?: string[]}} ScoreEntry
 * @typedef {{points: number, played: number, solved: number, winStreak: number, attemptStreak: number, bestWinStreak: number, bestAttemptStreak: number, average: number|null}} Summary
 */

const MAX_GUESSES = 6;
const ncDateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** @param {Date} [now] @returns {string} */
export function ncToday(now = new Date()) {
  const parts = Object.fromEntries(ncDateFormat.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Accept exact, real calendar dates; Date.parse alone accepts rolled-over dates. */
function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dayNumber(date) {
  return new Date(`${date}T00:00:00Z`).getTime() / 86400000;
}

/** @param {Array<{date: string}>} puzzles @param {string} today @returns {string[]} */
export function archiveDates(puzzles, today) {
  if (!isDate(today)) return [];
  return [...new Set(puzzles.map((puzzle) => puzzle?.date).filter((date) => isDate(date) && date < today))].sort();
}

/**
 * @param {unknown} value
 * @param {{schoolIds: Set<string>, answerId: string}} context
 * @returns {Progress|null}
 */
export function validateProgress(value, { schoolIds, answerId }) {
  if (!value || !Array.isArray(value.guesses) || value.guesses.length > MAX_GUESSES) return null;
  const guesses = [];
  const seen = new Set();
  let solved = false;
  for (const record of value.guesses) {
    const schoolId = record?.schoolId;
    if (solved || typeof schoolId !== 'string' || !schoolIds.has(schoolId) || seen.has(schoolId)) return null;
    seen.add(schoolId);
    solved = schoolId === answerId;
    guesses.push({ schoolId, correct: solved });
  }
  const minimumRevealed = Math.min(guesses.length + 1, MAX_GUESSES);
  const savedRevealed = Number.isInteger(value.revealedClues) ? value.revealedClues : minimumRevealed;
  return {
    guesses,
    revealedClues: Math.min(MAX_GUESSES, Math.max(minimumRevealed, savedRevealed)),
    solved,
    lost: !solved && guesses.length === MAX_GUESSES,
  };
}

/** @param {ScoreEntry[]} results @param {string} today @returns {Summary} */
export function scoreSummary(results, today) {
  const byDate = new Map();
  for (const result of results) {
    if (!isDate(result?.date) || result.date > today) continue;
    const existing = byDate.get(result.date);
    // Preserve legacy last-completion-wins deduplication, including ties.
    if (!existing || String(result.completedAt || '') >= String(existing.completedAt || '')) {
      byDate.set(result.date, result);
    }
  }
  const entries = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  const solved = entries.filter((entry) => entry.status === 'solved');
  const attempts = streaks(entries, () => true, today);
  // Only today's unfinished game is neutral. Past unfinished games break wins.
  const wins = streaks(entries.filter((entry) => !(entry.date === today && entry.status === 'attempted')),
    (entry) => entry.status === 'solved', today);
  return {
    points: solved.reduce((sum, entry) => sum + MAX_GUESSES + 1 - entry.guesses, 0),
    played: entries.length,
    solved: solved.length,
    winStreak: wins.current,
    attemptStreak: attempts.current,
    bestWinStreak: wins.best,
    bestAttemptStreak: attempts.best,
    average: solved.length ? solved.reduce((sum, entry) => sum + entry.guesses, 0) / solved.length : null,
  };
}

function streaks(entries, qualifies, today) {
  let run = 0;
  let best = 0;
  let previousDay = null;
  for (const entry of entries) {
    const day = dayNumber(entry.date);
    run = qualifies(entry) ? (previousDay !== null && day - previousDay === 1 ? run + 1 : 1) : 0;
    best = Math.max(best, run);
    previousDay = day;
  }
  const age = dayNumber(today) - previousDay;
  return { current: age === 0 || age === 1 ? run : 0, best };
}

/**
 * @param {{date: string, mode: 'daily'|'archive', progress: Progress, publicUrl: string}} result
 * @returns {string}
 */
export function formatShareResult({ date, mode, progress, publicUrl }) {
  // Sharing remains available when optional backend configuration is absent or
  // malformed. Never derive this fallback from a callback-bearing location.
  const canonicalUrl = 'https://charterschoodle.chartersuccesspartners.com/';
  let url;
  try {
    url = new URL(publicUrl);
    if (!['https:', 'http:'].includes(url.protocol)) throw new TypeError('Invalid public URL protocol');
  } catch {
    url = new URL(canonicalUrl);
  }
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  const grid = Array.from({ length: MAX_GUESSES }, (_, index) => {
    const guess = progress.guesses[index];
    return guess ? (guess.correct ? '🟩' : '🟥') : '⬜';
  }).join('');
  const count = progress.solved ? progress.guesses.length : 'X';
  return `CharterSchoodle ${mode === 'archive' ? 'Archive' : 'Daily'} ${date}\n${grid} ${count}/6\n${url.href}`;
}
