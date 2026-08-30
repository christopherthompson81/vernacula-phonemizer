/**
 * SENTINEL MARKERS — the characters a pass inserts to hold a place, named once so no site has to spell an
 * invisible character inline (#1175).
 *
 * ⚠ THE RAW SPELLING IS A REVIEW HAZARD, NOT A STYLE PREFERENCE, and it has two distinct failure modes.
 *
 * A raw **NUL** makes `file(1)` classify the source as `data`, and **`grep` then skips it in silence** — no
 * match, no error, no exit code. Every mechanical pass this repo's port reviews depend on — the
 * regex-by-codepoint diff, the table-membership diff, the missing-constant sweep — is a grep or a read over
 * the source. On a file in that state they all return zero findings and the reviewer reports it clean.
 * Three files were in exactly that state when this module was written, and the sweep that found them had to
 * be a Python scan, because the grep looking for them came back empty.
 *
 * A raw **PUA** character is arguably worse, because nothing flags it at all. `file` is happy, `grep`
 * works, and `const AGO = "…"` READS AS THE EMPTY STRING. A reviewer diffing a TS `const AGO = ""` against
 * a C# `const string AGO = ""` calls them equal — even if one of them genuinely were empty. That is a hole
 * in precisely the method used to catch transcription defects between the two engines.
 *
 * ⚠ AND THE IRONY WAS ON THE LINE BELOW SEVERAL OF THEM: "⚠ ESCAPED: the sentinel is a PUA code point
 * today, but a regex built from an unescaped literal would silently change meaning if it ever became a
 * metacharacter." The USE was carefully escaped; the DECLARATION was a raw invisible character.
 *
 * `test/no-raw-sentinels.test.ts` pins the absence so the class cannot come back.
 */

/**
 * A private-use sentinel: cannot occur in real text, and is swapped back immediately after the pass that
 * needs it. Used where a rule must mark a position and then reason about the string without the mark
 * colliding with anything a writer could have typed.
 */
export const PUA_SENTINEL = "\u{E000}";

/** A second PUA slot, for a pass that must nest two markers without collision (bengali's ⟨æ⟩). */
export const PUA_SENTINEL_2 = "\u{E001}";

/**
 * A sentinel that can never be a case ending or a lexicon key.
 *
 * ⚠ PREFER `PUA_SENTINEL` FOR NEW CODE. This one is here because three files already used it and one of
 * them cost a review its instruments; NUL earns nothing over a PUA code point and costs `grep`.
 */
export const NUL_SENTINEL = "\u0000";
