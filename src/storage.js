import { validateProgress } from './game.js';

/** @typedef {import('./game.js').Progress} Progress */
/** @typedef {import('./game.js').ScoreEntry} ScoreEntry */
/** @typedef {{date: string, answerSchoolId: string, guessedSchoolIds: string[], status: 'attempted'|'solved'|'lost'}} DailyResult */
/**
 * @typedef {object} SafeStorage
 * @property {(key: string) => string|null} getItem
 * @property {(key: string, value: string) => void} setItem
 * @property {(key: string) => void} removeItem
 * @property {boolean} persistent Read-only; false after the first storage failure.
 */
/**
 * @typedef {object} GameStore
 * @property {string} subject Read-only; the store never follows later account changes.
 * @property {(date: string) => Progress|null} readProgress
 * @property {(date: string, progress: Progress) => void} writeProgress
 * @property {() => ScoreEntry[]} readResults
 * @property {(entry: ScoreEntry) => void} writeResult
 * @property {() => DailyResult[]} readPending
 * @property {(result: DailyResult) => void} queueResult
 * @property {(date: string) => void} acknowledgeResult
 * @property {(date: string) => boolean} hasGuestImport
 * @property {(date: string) => void} markGuestImport
 */

/**
 * Read through healthy browser storage, caching observed values for fallback.
 * A null memory value is a tombstone: failed removals cannot resurrect disk data.
 * @param {() => Storage} getStorage
 * @returns {SafeStorage}
 */
export function createSafeStorage(getStorage) {
  const memory = new Map();
  let storage;
  let persistent = false;
  try {
    storage = getStorage();
    persistent = Boolean(storage && ['getItem', 'setItem', 'removeItem'].every((method) => typeof storage[method] === 'function'));
  } catch { /* Browser policies can throw even when accessing localStorage. */ }

  return {
    get persistent() { return persistent; },
    getItem(key) {
      if (persistent) {
        try {
          const value = storage.getItem(key);
          memory.set(key, value);
          return value;
        } catch { persistent = false; }
      }
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      const text = String(value);
      memory.set(key, text);
      if (persistent) {
        try { storage.setItem(key, text); } catch { persistent = false; }
      }
    },
    removeItem(key) {
      memory.set(key, null);
      if (persistent) {
        try { storage.removeItem(key); } catch { persistent = false; }
      }
    },
  };
}

/** Storage and JSON failures both mean unavailable data, never a broken game. */
function readRaw(kv, key) {
  try { return kv.getItem(key); } catch { return null; }
}
function parse(raw) {
  try { return raw === null ? null : JSON.parse(raw); } catch { return null; }
}
function write(kv, key, value) {
  try { kv.setItem(key, JSON.stringify(value)); } catch { /* SafeStorage normally retains the write in memory. */ }
}
function boundedText(value, maximum) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text.length <= maximum ? text : '';
}

/** Return display prefill only; a legacy name or anonymous ID never owns an account.
 * @param {SafeStorage} kv
 * @returns {{displayName: string, school: string}}
 */
export function loadLegacyProfile(kv) {
  const value = parse(readRaw(kv, 'charterschoodle-player:v1'));
  return {
    displayName: boundedText(value?.name, 60),
    school: boundedText(value?.school || value?.team, 80),
  };
}

/**
 * All keys and deferred writes close over this subject. Queue/receipt envelopes
 * also reject accidentally copied payloads from a different subject's key.
 * @param {{kv: SafeStorage, subject: string, schools: Array<{id: string}>, puzzles: Array<{date: string, answerSchoolId: string}>}} options
 * @returns {GameStore}
 */
export function createGameStore({ kv, subject, schools, puzzles }) {
  if (typeof subject !== 'string' || !subject || subject.includes(':')) {
    throw new TypeError('A guest or account subject is required');
  }
  const prefix = `charterschoodle:v2:${subject}:`;
  const guest = subject === 'guest';
  const schoolIds = new Set(schools.map((school) => school.id));
  const puzzleByDate = new Map(puzzles.map((puzzle) => [puzzle.date, puzzle]));
  const puzzleFor = (date) => typeof date === 'string' ? puzzleByDate.get(date) : undefined;

  function progressFor(date, value) {
    const puzzle = puzzleFor(date);
    if (!puzzle || !schoolIds.has(puzzle.answerSchoolId)) return null;
    try { return validateProgress(value, { schoolIds, answerId: puzzle.answerSchoolId }); } catch { return null; }
  }

  /** Remote candidates always need the actual ordered guesses, never guessed IDs. */
  function dailyResult(value) {
    try {
      const puzzle = puzzleFor(value?.date);
      if (!puzzle || value.answerSchoolId !== puzzle.answerSchoolId || !Array.isArray(value.guessedSchoolIds)) return null;
      const progress = progressFor(value.date, { guesses: value.guessedSchoolIds.map((schoolId) => ({ schoolId })) });
      if (!progress || !progress.guesses.length) return null;
      const status = progress.solved ? 'solved' : progress.lost ? 'lost' : 'attempted';
      if (value.status !== status) return null;
      return { date: value.date, answerSchoolId: puzzle.answerSchoolId, guessedSchoolIds: progress.guesses.map((guess) => guess.schoolId), status };
    } catch { return null; }
  }

  function scoreEntry(value) {
    try {
      const puzzle = puzzleFor(value?.date);
      if (!puzzle || !schoolIds.has(puzzle.answerSchoolId) || value.answerSchoolId !== puzzle.answerSchoolId) return null;
      let entry;
      if (value.guessedSchoolIds !== undefined) {
        const result = dailyResult(value);
        if (!result) return null;
        entry = { ...result, guesses: result.guessedSchoolIds.length };
      } else {
        // Counts from historical scorebooks can support local guest summaries,
        // but cannot establish the ordered guesses required by account results.
        if (!guest || !Number.isInteger(value.guesses) || value.guesses < 1 || value.guesses > 6) return null;
        if (!['attempted', 'solved', 'lost'].includes(value.status)) return null;
        if ((value.status === 'lost' && value.guesses !== 6) || (value.status === 'attempted' && value.guesses === 6)) return null;
        entry = { date: value.date, answerSchoolId: puzzle.answerSchoolId, status: value.status, guesses: value.guesses };
      }
      entry.points = entry.status === 'solved' ? 7 - entry.guesses : 0;
      if (typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))) entry.completedAt = value.completedAt;
      return entry;
    } catch { return null; }
  }

  function scores(values) {
    if (!Array.isArray(values)) return [];
    const byDate = new Map();
    for (const value of values) {
      const entry = scoreEntry(value);
      if (!entry) continue;
      const existing = byDate.get(entry.date);
      if (!existing || String(entry.completedAt || '') >= String(existing.completedAt || '')) byDate.set(entry.date, entry);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function readResults() {
    const key = `${prefix}results`;
    const raw = readRaw(kv, key);
    if (raw !== null || !guest) return scores(parse(raw));
    const legacy = parse(readRaw(kv, 'charterschoodle-scorebook:v1'));
    const results = scores(legacy?.results && typeof legacy.results === 'object' ? Object.values(legacy.results) : []);
    write(kv, key, results);
    return results;
  }

  function readBound(suffix) {
    const envelope = parse(readRaw(kv, `${prefix}${suffix}`));
    return envelope?.subject === subject && Array.isArray(envelope.values) ? envelope.values : [];
  }
  function writeBound(suffix, values) {
    write(kv, `${prefix}${suffix}`, { subject, values });
  }
  function readPending() {
    if (guest) return [];
    const byDate = new Map();
    for (const value of readBound('pending')) {
      const result = dailyResult(value);
      if (result) byDate.set(result.date, result);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  return {
    get subject() { return subject; },
    readProgress(date) {
      if (!puzzleFor(date)) return null;
      const key = `${prefix}progress:${date}`;
      const raw = readRaw(kv, key);
      if (raw !== null || !guest) return progressFor(date, parse(raw));
      const progress = progressFor(date, parse(readRaw(kv, `charterschoodle-progress:${date}`)));
      if (progress) write(kv, key, progress);
      return progress;
    },
    writeProgress(date, value) {
      const progress = progressFor(date, value);
      if (progress) write(kv, `${prefix}progress:${date}`, progress);
    },
    readResults,
    writeResult(value) {
      const entry = scoreEntry(value);
      if (!entry) return;
      const entries = readResults().filter((result) => result.date !== entry.date);
      write(kv, `${prefix}results`, scores([...entries, entry]));
    },
    readPending,
    queueResult(value) {
      if (guest) return;
      const result = dailyResult(value);
      if (result) writeBound('pending', [...readPending().filter((entry) => entry.date !== result.date), result]);
    },
    acknowledgeResult(date) {
      if (!guest && puzzleFor(date)) writeBound('pending', readPending().filter((entry) => entry.date !== date));
    },
    hasGuestImport(date) {
      return !guest && Boolean(puzzleFor(date)) && readBound('guest-imports').includes(date);
    },
    markGuestImport(date) {
      if (!guest && puzzleFor(date)) {
        const dates = readBound('guest-imports').filter((candidate) => Boolean(puzzleFor(candidate)));
        writeBound('guest-imports', [...new Set([...dates, date])]);
      }
    },
  };
}
