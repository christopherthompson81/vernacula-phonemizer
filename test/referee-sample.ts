/**
 * The stride-sample caps the referee floors are measured against — SHARED, because the floors were
 * chosen for these exact numbers and two files now use them.
 *
 * ⚠ THESE ARE NOT A PERFORMANCE KNOB, they are part of what the gate measures. `evaluate()` takes a
 * deterministic stride sample, so a different cap is a different measurement: en-GB's floor of 0.44
 * is documented against the SAMPLED 45.4%, about 1pp of margin, where the full-referee number is
 * 46.4%. Raising or lowering the cap moves the number the floor was picked for.
 *
 * ⚠ AND THAT IS WHY THEY LIVE HERE RATHER THAN AS A LITERAL IN EACH FILE. `en` and `en-GB` were
 * split into referee-eval-english.test.ts for wall time (see its header), so the cap is now read in
 * two places; a comment saying "keep them in step" is not a gate, and an import is.
 */

/** Languages whose eval runs through a NEURAL tier, and so take the smaller sample. */
export const NEURAL = new Set(["en", "en-GB", "ar"]);

/** Sample cap for a NEURAL language — the BiLSTM is ~9ms a word. */
export const NEURAL_CAP = 3000;

/** Sample cap for everything else. */
export const CAP = 5000;

/** The cap a given language's floor was measured against. */
export const capFor = (lang: string): number => (NEURAL.has(lang) ? NEURAL_CAP : CAP);
