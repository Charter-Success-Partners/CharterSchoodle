import crypto from 'node:crypto';

function stableFraction(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return Number.parseInt(hash.slice(0, 12), 16) / 0xffffffffffff;
}

function revealedNameToken(text) {
  const match = text.match(/^(?:One distinctive word in its official name is|Its official name begins with the word) ["“](.+?)["”]\.?$/i);
  return match ? match[1].toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() : null;
}

/**
 * Select five curated clues from the caller's already-filtered pool, then the letter hint.
 * @param {{schoolId: string, officialName: string, usablePool: Array<object>, date: string,
 * config: {seed: string, requiredCuratedClues: number, targetClueDifficulties: number[]},
 * categoryWeights: Record<string, number>}} input
 * @returns {{clues: Array<{text: string, difficulty: number}>, diagnostics: Array<{schoolId: string, date: string, reason: string}>}}
 */
export function selectClues({ schoolId, officialName, usablePool, date, config, categoryWeights }) {
  if (usablePool.length < config.requiredCuratedClues) return { clues: [], diagnostics: [] };

  const weight = category => categoryWeights[category] || 4;
  const remaining = usablePool.map(clue => {
    const randomness = stableFraction(`${config.seed}:${schoolId}:${date}:${clue.category}:${clue.text}`);
    return { clue, randomness, token: revealedNameToken(clue.text),
      baseScore: weight(clue.category) * 100 + Number(clue.difficulty || 0) * 10 + randomness };
  });
  const chosen = [];
  const chosenCategories = new Map();
  const chosenTokens = new Set();
  let redundant = false;
  const stableTie = (left, right) => right.baseScore - left.baseScore ||
    right.randomness - left.randomness || left.clue.text.localeCompare(right.clue.text);

  for (const targetDifficulty of config.targetClueDifficulties.slice(0, config.requiredCuratedClues)) {
    const slotScore = entry => weight(entry.clue.category) * 3 + Number(entry.clue.difficulty || 0) * 2.2 -
      Math.abs(Number(entry.clue.difficulty || 0) - targetDifficulty) * 2.6 -
      (chosenCategories.get(entry.clue.category) || 0) * 1.4 + entry.randomness;
    remaining.sort((left, right) => slotScore(right) - slotScore(left) || stableTie(left, right));

    let nextIndex = 0;
    if (remaining[0].token && chosenTokens.has(remaining[0].token)) {
      const alternativeIndex = remaining.findIndex(entry =>
        (!entry.token || !chosenTokens.has(entry.token)) && entry.clue.sourceRefs?.some(Boolean));
      if (alternativeIndex !== -1) nextIndex = alternativeIndex;
    }
    const [next] = remaining.splice(nextIndex, 1);
    if (next.token && chosenTokens.has(next.token)) redundant = true;
    if (next.token) chosenTokens.add(next.token);
    chosen.push(next);
    chosenCategories.set(next.clue.category, (chosenCategories.get(next.clue.category) || 0) + 1);
  }

  chosen.sort((left, right) => Number(right.clue.difficulty || 0) - Number(left.clue.difficulty || 0) || stableTie(left, right));
  const clues = chosen.map(({ clue }) => ({ text: clue.text, difficulty: clue.difficulty }));
  const initial = officialName.trim().charAt(0).toUpperCase();
  clues.push({ difficulty: 1, text: `The answer begins with the letter ${initial}.` });
  return { clues, diagnostics: redundant ? [{ schoolId, date, reason: 'repeated-name-token' }] : [] };
}

/** Preserve complete published objects and replace the future draft by date. */
export function mergePublishedCalendar(existing, generated, today) {
  const byDate = new Map(existing.filter(puzzle => puzzle.date <= today).map(puzzle => [puzzle.date, puzzle]));
  for (const puzzle of generated) {
    if (puzzle.date > today) byDate.set(puzzle.date, puzzle);
  }
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}
