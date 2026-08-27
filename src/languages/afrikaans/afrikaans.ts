/**
 * Afrikaans (af) phonemizer — Indo-European (West Germanic), Latin script, Standard Afrikaans.
 *
 * A greedy longest-match scan over the fixed graphemes (digraphs/consonants, length-desc) PLUS two
 * code rules the table can't express: the Germanic OPEN/CLOSED-SYLLABLE vowel-length rule (a bare vowel is long/tense
 * in an open syllable V.CV, short/lax in a closed one VC#/VCC — via lookahead) and obstruent DEVOICING
 * (b→p, d→t; g→χ and v→f are unconditional). The long mid vowels are centering diphthongs (ee/open-e = iə, oo/open-o
 * = uə). Stress + schwa-reduction of unstressed vowels are not modelled (folded).
 *
 * DEVOICING HAS THREE PARTS, and the second and third are about the MORPHEME SEAM — a compound is phonemized element
 * by element, so every seam is a decision the joiner has to make:
 *   1. POSITIONAL — a voiced obstruent devoices at the end of a word or of a compound element (hond→ɦɔnt).
 *   2. REGRESSIVE — and before a voiceless one, wherever it sits (advies→atfis). The trigger is DERIVED from the
 *      grapheme table (VOICELESS_NEXT), because ⟨v⟩ is [f] and ⟨q⟩ is [k] and a hand-written letter list forgot both.
 *      Derivation is not a full guarantee — `voicelessPhones` is still hand-written — so the set is pinned in the tests.
 *   3. RESYLLABIFICATION BLOCKS #1 — a vowel-initial SUFFIX takes the stem's final consonant as its onset, and a
 *      coda rule cannot apply to a segment that is no longer a coda: send·ing→sɛndəŋ, not *sɛntəŋ. A vowel-initial
 *      compound ELEMENT is a separate prosodic word and does NOT block it, so the list is closed (afrikaans.jsonc).
 * The seam also DEGEMINATES a ⟨d⟩ against a following /t/ or /d/ (veld·tog→fɛltɔχ) — see joinSeams.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { MANIFEST, FIXED_KEYS } from "./manifest.ts";
import { numberToWords } from "./numbers.ts";
import { decompose } from "./morphology.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Proper-noun / opaque-loan lexicon (af-lexicon.tsv), lazily loaded like tagalog's stress lexicon.
let LEXICON: ReadonlyMap<string, string> | undefined;
const lexicon = (): ReadonlyMap<string, string> => (LEXICON ??= loadTsvMap(import.meta.url, "af-lexicon.tsv"));
// The 25,112-entry RCRL pronunciation lexicon — the primary SHIPPED path, as for da/nb/fr/en. Optional: absent
// → the rules serve every word, which is exactly the pre-lexicon behaviour.
let RCRL: ReadonlyMap<string, string> | undefined;
const rcrl = (): ReadonlyMap<string, string> =>
    (RCRL ??= loadTsvMap(import.meta.url, "af-rcrl-lexicon.tsv", undefined, { optional: true }));
import { normalizeAfrikaans, normalizeAfrikaansInitialisms } from "./normalize.ts";

const FIXED = MANIFEST.fixed;
const LONG = MANIFEST.vowelsLong;
const SHORT = MANIFEST.vowelsShort;
const DIA = MANIFEST.diacriticVowels;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const DEVOICE = MANIFEST.voicedFinal; // word-final devoicing (g→χ, v→f already fixed)
// The REGRESSIVE trigger: the letters whose grapheme begins with a voiceless obstruent. ⚠ DERIVED FROM THE
// GRAPHEME TABLE, not spelled out — the literal "ptksfcgx" it replaces was a spelling-level restatement of
// "voiceless" that had already drifted from the table it was meant to mirror (⟨v⟩ is [f] and ⟨q⟩ is [k], so
// neither devoiced a preceding ⟨d⟩: advies read [adfis]). ⟨c⟩ is added by hand because it has no `fixed`
// entry at all — the code rule below picks [s] or [k], and both are voiceless.
// ⚠ DERIVED IS NOT THE SAME AS SAFE: this reads `fixed` ∩ `voicelessPhones`, and the latter is hand-written, so
// a new single-letter grapheme whose phone nobody added there drops out of the trigger with no error. The set's
// CONTENTS are asserted in test/afrikaans.test.ts; that assertion, not the derivation, is the actual guard.
// Single-letter lookup is enough: every multi-letter grapheme headed by one of these letters is voiceless
// too (⟨tj⟩ [c], ⟨tz⟩ [ts], ⟨sj⟩ [ʃ], ⟨sch⟩ [sk]), and the caller only has one following letter to test.
const VOICELESS = new Set(MANIFEST.voicelessPhones);
const VOICELESS_NEXT = new Set([
    "c",
    ...Object.keys(MANIFEST.fixed).filter((k) => k.length === 1 && VOICELESS.has([...MANIFEST.fixed[k]!][0]!)),
]);
// Letter environments (afrikaans.jsonc): the vowels routed through the length rule, and every letter that
// heads a nucleus — the latter bounds the consonant run in the open/closed lookahead below.
const BARE_VOWELS = new Set(MANIFEST.bareVowels);
const VOWEL_LETTER = new Set(MANIFEST.vowelLetters);

/** Every single character the scan below has a rule for: the grapheme table, the diacritic vowels, the bare
 *  vowels, and the two letters handled by code rules (⟨c⟩ soft/hard, the apostrophe of 'n). */
const KNOWN_LETTERS = new Set([
    ...Object.keys(FIXED).filter((k) => [...k].length === 1),
    ...Object.keys(DIA),
    ...MANIFEST.bareVowels,
    "c",
    "'",
]);

/**
 * ⚠ AN ACCENT AFRIKAANS DOES NOT WRITE IS READ AS THE LETTER UNDER IT, NOT DELETED.
 *
 * Afrikaans has its own diacritics (ê î ô û ë ï, plus the é è á à ó ú ü ö of its loans) and every one of them
 * is in `diacriticVowels`. What is left over is someone else's orthography arriving inside a name, and the
 * scan's closing `i += 1` used to drop it: `bâton` → *btɔn, a nucleus short with the onset welded to the coda.
 *
 * Folding to the base BEFORE the scan — rather than emitting a phone at the fall-through — is what keeps
 * `countNuclei` and `phonemizeMorpheme` in agreement: both walk this same string, and a vowel that appeared in
 * one walk but not the other would put primary stress on the wrong syllable. One character for one character,
 * so every index and lookahead is unmoved.
 *
 * ⚠ ⟨ñ⟩ AND ⟨ç⟩ ARE NOT FOLDED — they are in the grapheme table (see afrikaans.jsonc) because af.wikipedia
 * writes them in words it uses as its own (`piñata` ×4, `garçon` ×15, `Provençaalse` ×3), and the base letter
 * would be wrong for both: /n/ throws away the palatal, /k/ is not what ⟨ç⟩ ever says.
 */
function foldForeignLetters(w: string): string {
    if ([...w].every((c) => KNOWN_LETTERS.has(c))) return w; // the common case, and it allocates nothing
    return [...w]
        .map((c) => {
            if (KNOWN_LETTERS.has(c)) return c;
            const b = c.normalize("NFD").replace(/\p{M}+/gu, "");
            return b.length === 1 && KNOWN_LETTERS.has(b) ? b : c;
        })
        .join("");
}

/** Is the bare vowel at index `i` in an OPEN syllable (→ long/tense)? V ends a syllable when ≤1 consonant separates
 *  it from the next vowel: V# / V.V / V.CV are open; VC# and VCC are closed. */
function isOpen(w: string, i: number): boolean {
    let j = i + 1;
    while (j < w.length && !VOWEL_LETTER.has(w[j]!)) j++;
    const cons = j - (i + 1);
    if (cons === 0) return true; // vowel at word end, or a following vowel (hiatus)
    return cons === 1 && j < w.length; // exactly one consonant before another vowel → open
}

const REDUCE = MANIFEST.unstressedReduction; // unstressed bare vowels (afrikaans.jsonc)
// An unstressed but OPEN syllable keeps the TENSE quality, short (afrikaans.jsonc `unstressedOpen`). Sparse: only
// the cells that differ from REDUCE, so a missing key falls through to it.
const REDUCE_OPEN = MANIFEST.unstressedOpen;
const C_SOFT = new Set(MANIFEST.cSoftBefore); // ⟨c⟩ → [s] before one of these, else [k]
const W_GLIDE_AFTER = new Set(MANIFEST.wGlideAfter); // morpheme-initial ⟨Cw⟩ → the glide [w] (afrikaans.jsonc)

// ⚠ BUILT FROM THE MANIFEST, NOT SPELLED OUT. This class was once written inline and had already DRIFTED from
// `vowelLetters` — it was missing ⟨ö⟩, which the diacritic table maps to [ø]. Derived, it cannot drift again.
// ⚠ THERE USED TO BE A `VOWEL_GROUP` REGEX HERE TOO, counting maximal runs of vowel letters, and
// `stressedNucleus` used it as a syllable count. It is gone because that was wrong: a vowel run is not a
// nucleus (⟨io⟩, ⟨ia⟩ are one run and two nuclei). Counting is `countNuclei`, which walks the word the way
// the emitter does — see its note.
const V = MANIFEST.vowelLetters.join("");
// Longest-first is cosmetic here, NOT load-bearing: both patterns are $-anchored and used only through
// .test(), so alternation order cannot change the boolean. Sorted anyway so the source reads in the same
// order as the manifest lists them, and so it stays correct if either is ever used to CAPTURE.
const byLen = (xs: readonly string[]): string => [...xs].sort((a, b) => b.length - a.length).join("|");
const STRESS_FROM_END = MANIFEST.stressFromEnd; // derived suffix → syllables-from-end (afrikaans.jsonc)
const STRESS_FROM_END_KEYS = Object.keys(STRESS_FROM_END).sort((a, b) => b.length - a.length);
const STRESS_FINAL = new RegExp(`(${byLen(MANIFEST.stressFinalSuffixes)})$`, "u");
const STRESS_PENULT = new RegExp(`(${byLen(MANIFEST.stressPenultSuffixes)})$`, "u");
// Unstressed one-syllable prefixes: stress falls on the following syllable (begín, gemáák, verstáán).
// ⚠ THE SAME SIX PREFIXES LIVED IN THREE PLACES — this regex, PREFIX_IPA below, and the manifest's
// morphology.prefixUnstressed (read by the shared Germanic compound engine). One source now, asserted below.
const UNSTRESSED_PREFIX = new RegExp(`^(${MANIFEST.morphology.prefixUnstressed.join("|")})[^${V}]*[${V}]`, "u");

/**
 * How many NUCLEI the grapheme scan will emit for `w` — walked with the SAME decisions phonemizeMorpheme makes.
 *
 * ⚠ IT MUST NOT BE A VOWEL-LETTER-GROUP COUNT, which is what `stressedNucleus` used to use. A maximal run of
 * vowel letters is not a nucleus: ⟨io⟩, ⟨ia⟩, ⟨eo⟩ are ONE group but TWO nuclei, so every position counted from
 * the END landed a syllable early and put the stressed long vowel in the wrong place —
 * argeologiese *arχəuəluχisə for RCRL ar.xi.u.ˈluə.xi.sə, biologiese *biuəluχisə, nasionalisme *nasiunɑːləsmə
 * with a spurious [ɑː]. Harmless while the only counted-from-the-end rules were final and penult; audible once
 * `stressFromEnd` reaches depth 3.
 * ⚠ THE DERIVATION IS BLIND TO THIS CLASS BY CONSTRUCTION — it keeps only rows whose referee syllable count
 * equals the spelling's vowel-group count, i.e. exactly the words where the two counts cannot disagree. It could
 * never have surfaced the bug, and a golden could not either; it took reading the emitter beside the counter.
 */
function countNuclei(w: string): number {
    let n = 0;
    for (let i = 0; i < w.length; ) {
        const c = w[i]!;
        if (DIA[c]) { n += 1; i += 1; continue; }
        if (!VOWEL_LETTER.has(c) && w[i + 1] === c && c !== "'") { i += 1; continue; } // doubled consonant
        if (c === "c" && w[i + 1] !== "h") { i += 1; continue; } // the ⟨c⟩ code rule, never a nucleus
        const key = FIXED_KEYS.find((k) => w.startsWith(k, i));
        if (key !== undefined) { if (VOWEL_LETTER.has(key[0]!)) n += 1; i += key.length; continue; }
        if (BARE_VOWELS.has(c)) { n += 1; i += 1; continue; }
        i += 1;
    }
    return n;
}

/** The (0-based) nucleus that carries primary stress. Native default = the first syllable (past an unstressed
 *  prefix); loan suffixes shift it: -ie/-sie/-asie → penultimate (aborsie→a·BOR·sie), -eer/-eur/-teit → final. */
function stressedNucleus(w: string): number {
    const n = countNuclei(w); // ⚠ NOT a vowel-letter-group count — see countNuclei
    if (n <= 1) return 0;
    // The DERIVED suffix table first, longest-first — it subsumes most of the two hand-authored lists below.
    // A match that would place stress outside the word is ignored rather than clamped: the suffix was derived
    // from longer words, and clamping would invent a position no evidence supports.
    for (const s of STRESS_FROM_END_KEYS) {
        if (!w.endsWith(s)) continue;
        const fromEnd = STRESS_FROM_END[s]!;
        if (fromEnd < n) return n - 1 - fromEnd;
        break; // longest match wins; a shorter one is not a better guess for the same word
    }
    if (STRESS_FINAL.test(w)) return n - 1; // stress-final loan suffixes (afrikaans.jsonc)
    if (STRESS_PENULT.test(w)) return n - 2; // -ie / -sie / -asie / -osie → penultimate
    return UNSTRESSED_PREFIX.test(w) ? 1 : 0;
}

/** Phonemize a single MORPHEME (a whole non-compound word, or one element of a compound) — its own first-syllable
 *  stress, open/closed length, and word-/morpheme-final devoicing.
 *
 *  `finalDevoice = false` suppresses only the FINAL (positional) half of the devoicing rule, for a stem whose last
 *  consonant is resyllabified as the onset of a following suffix (send·ing → sɛndəŋ). The REGRESSIVE half — a voiced
 *  obstruent before a voiceless one — is unaffected, since it depends on what follows, not on where the morpheme ends. */
function phonemizeMorpheme(word: string, finalDevoice = true, emitStress = true): string {
    const w = foldForeignLetters(word.normalize("NFC").toLowerCase());
    const stressNucleus = stressedNucleus(w); // primary-stress nucleus (native first-syllable + loan-suffix overrides)
    let out = "";
    let i = 0;
    let nucleus = 0; // count of vowel nuclei emitted so far
    // ⚠ ONE INSERTION POINT, NOT THREE. A nucleus is emitted from three different branches (diacritic,
    // digraph table, bare vowel), so marking stress inside each would be three copies of one rule — the
    // shape this file already warns about for prefixIpa. Record the OUTPUT OFFSET at which the stressed
    // nucleus starts and splice the mark in once at the end.
    let stressAt = -1;
    while (i < w.length) {
        const c = w[i]!;
        if (DIA[c]) { if (nucleus === stressNucleus && stressAt < 0) stressAt = out.length; out += DIA[c]; i += 1; nucleus += 1; continue; } // diacritic vowel (single char)
        // Code rules that must beat the fixed table:
        if (!VOWEL_LETTER.has(c) && w[i + 1] === c && c !== "'") { i += 1; continue; } // doubled consonant = single phoneme (appel→ˈapəl)
        if (c === "c") {
            // ⟨c⟩ is SOFT [s] BEFORE a front vowel and [k] elsewhere — so word-finally it is [k], because
            // there is no following letter for the soft condition to be met by.
            // ⚠ IT USED TO BE [s], from `"eiyêéè".includes(w[i + 1] ?? "")` — `includes("")` is TRUE, so a
            // ⟨c⟩ with nothing after it fell into the soft branch. franc→frans, arc→ars. #756 preserved
            // that verbatim (a data move must not change output) and #757 decided it: the rule's own
            // statement is "before a front vowel", and word-final has no following vowel at all, so the
            // accident inverted the rule rather than extending it.
            // ⚠ NOT REFEREE-DECIDED: the corpus's only word-final ⟨c⟩ is the letter name C→sɪə, which this
            // branch does reach and misses BOTH ways, so the score is unmoved either way (#761).
            // ⚠ …EXCEPT ⟨ch⟩, WHICH IS A DIGRAPH IN THE FIXED TABLE. This code rule runs BEFORE that table
            // so it can beat the single-letter entries, and that made it shadow ⟨ch⟩ entirely: chemie came
            // out kɦiəmi, an onset Afrikaans does not have (#758). Yielding on a following ⟨h⟩ lets the
            // table's ⟨chr⟩/⟨ch⟩ entries match.
            if (w[i + 1] !== "h") {
                out += C_SOFT.has(w[i + 1] ?? "") ? "s" : "k";
                i += 1;
                continue;
            }
        }
        // ⟨w⟩ IS THE GLIDE [w] IN A MORPHEME-INITIAL OBSTRUENT CLUSTER (swaar, twee, kwaad, dwaal) and [v]
        // everywhere else. ⚠ ANCHORED AT INDEX 1, i.e. the cluster must OPEN the morpheme, which is what keeps
        // it an onset: `antwoord` is ant.woord with the ⟨tw⟩ across a syllable boundary and stays [v], while a
        // prefixed stem reaches this correctly because each morpheme is phonemized on its own (ver·dwyn → dwyn).
        // ⚠ ADJUDICATED BY THE SECOND REFEREE, not the first — see the manifest note. en.wiktionary splits 10:9
        // here and made this rule look worthless; RCRL is 260:1 for the glide.
        // ⚠ THE MIRAGE THIS RULE MUST NOT FALL FOR is the linking ⟨-s-⟩: if the splitter hands the Fugen-s to the
        // FOLLOWING element, voeding·swaarde looks like an ⟨sw⟩ onset when it is voedings + waarde — a coda ⟨s⟩ and
        // a ⟨w⟩ opening the next syllable (RCRL ˈfu.dəŋs.vɑːr.də). That is fixed in the SPLITTER, by trying the
        // linking elements longest-first (afrikaans.jsonc `linkingElements`), not by a guard here: the boundary is
        // what was wrong, and a guard keyed on prefix-vs-stem was measured and rejected — it also denied the
        // GENUINE compound onsets berg·kwaggas, drie·kwart, hoof·sweep (−13).
        if (c === "w" && i === 1 && W_GLIDE_AFTER.has(w[0]!)) { out += "w"; i += 1; continue; }
        let matched = false;
        for (const key of FIXED_KEYS) {
            if (w.startsWith(key, i)) {
                const next = w[i + key.length];
                // devoicing: a voiced obstruent devoices word-finally OR before a VOICELESS consonant (aandklok→ɑnt);
                // it stays voiced before a vowel or a voiced consonant.
                const devoiceHere = next === undefined ? finalDevoice : VOICELESS_NEXT.has(next);
                if (VOWEL_LETTER.has(key[0]!) && nucleus === stressNucleus && stressAt < 0) stressAt = out.length;
                out += (devoiceHere && DEVOICE[key]) ? DEVOICE[key]! : FIXED[key]!;
                if (VOWEL_LETTER.has(key[0]!)) nucleus += 1; // a vowel digraph is a nucleus
                i += key.length;
                matched = true;
                break;
            }
        }
        if (matched) continue;
        if (BARE_VOWELS.has(c)) {
            const stressed = nucleus === stressNucleus;
            if (stressed && stressAt < 0) stressAt = out.length;
            if (c === "e" && i === w.length - 1) out += "ə"; // final unstressed ⟨e⟩ → schwa
            // ⚠ ⟨i⟩ is tense [i] / lax [ə] BY SYLLABLE, not by stress — kept as its own rule after the data sweep
            // (Run 12) rejected folding it into the tables: RCRL prefers [ə] unstressed-open, but that costs 9
            // words on the independent primary. See the `unstressedOpen` note in afrikaans.jsonc.
            else if (c === "i") out += isOpen(w, i) ? "i" : "ə";
            else if (stressed) out += isOpen(w, i) ? LONG[c]! : SHORT[c]!; // length rule in the stressed syllable
            else out += (isOpen(w, i) ? REDUCE_OPEN[c] : undefined) ?? REDUCE[c]!;
            i += 1;
            nucleus += 1;
            continue;
        }
        i += 1; // unknown char → skip
    }
    // ⚠ ONE PRIMARY MARK PER WORD, NOT PER ELEMENT. A compound is phonemized element by element, so
    // emitting unconditionally gave `handomkeer` THREE primary marks (ɦˈantˈɔmkˈiər). `decompose`
    // already knows which element carries the word's stress (`stressPart`); the caller passes that in
    // and every other element emits none.
    return emitStress && stressAt >= 0 ? out.slice(0, stressAt) + "ˈ" + out.slice(stressAt) : out;
}

// Reduced IPA per unstressed prefix (afrikaans.jsonc). Separable prefixes (aan/af…) carry stress and take
// the normal morpheme path.
const PREFIX_IPA = MANIFEST.prefixIpa;
const RESYLLABIFY = new Set(MANIFEST.morphology.resyllabifyingSuffixes); // vowel-initial suffixes that block final devoicing

// ⚠ SEAM DEGEMINATION of the coronal stops. A compound seam that brings /t/ or /d/ against /t/ or /d/ surfaces as
// ONE consonant, and it is the ONSET that survives: veld·tog [fɛltɔχ] not *[fɛlttɔχ], wild·tuin [vəltœin],
// be·stand·deel [bəstandiəl], land·dros [landrɔs]. Deleting the CODA rather than merging the two is what leaves the
// survivor with the ONSET's voicing — land·dros keeps its [d], it does not become [t].
// ⚠ THE TWO SIDES ARE TESTED DIFFERENTLY, on purpose:
//   · the CODA on its SPELLING (⟨d⟩), because the condition is UNDERLYING voicing and the phone no longer shows it —
//     Auslautverhärtung has already turned it into [t]. Only that neutralized stop is absorbed: a true /t/ against
//     /t/ is a GEMINATE this referee writes out (groot·toon [χruət.tuən]), and it is the one word an unconditional
//     coronal-stop rule lost. Measured 5 for / 0 against; unconditional was 5 for / 1 against.
//   · the ONSET on its PHONE, because the grapheme decides what a ⟨d⟩ actually is — lied·jie opens on [k] (the
//     ⟨jie⟩ entry), not [d], and must not trigger a rule about coronal stops meeting.
const CORONAL_STOP = /[td]/u;
/** Join the phonemized morphemes, resolving what happens AT the seam. `src` is each part's SPELLING — the
 *  degemination rule keys on the coda's underlying voicing, which only the spelling still shows. */
function joinSeams(parts: readonly { ipa: string; src: string }[]): string {
    let out = "";
    let prevSrc = "";
    for (const { ipa, src } of parts) {
        const last = out.at(-1);
        if (last !== undefined && prevSrc.endsWith("d") && CORONAL_STOP.test(last) && CORONAL_STOP.test(ipa[0] ?? ""))
            out = out.slice(0, -1);
        out += ipa;
        prevSrc = src;
    }
    return out;
}
const LETTER_NAME = MANIFEST.letterNames; // a bare single letter is SPELLED (see phonemizeWord)
// ⚠ THE TWO LISTS MUST AGREE — the same six prefixes, read by two consumers (this file's stress + IPA,
// and the shared compound engine's decomposition). Asserted in test/afrikaans.test.ts rather than here:
// registry.ts imports this module STATICALLY, so a throw at module init would make one typo in the
// Afrikaans manifest break every other language's import too.

/** Is this word served by either shipped lexicon? Read by the async neural path (afrikaansNeural.ts) so a
 *  lexicon-covered word is served by the exact dictionary reading rather than by the tagger. */
export function afrikaansLexiconHas(word: string): boolean {
    const w = word.normalize("NFC").toLowerCase();
    return lexicon().has(w) || rcrl().has(w);
}

/** Phonemize one Afrikaans word to canonical IPA. Compounds/affixed words are DECOMPOSED (shared morphology) and
 *  each morpheme phonemized independently — so each element keeps its OWN stressed vowel (no cross-element reduction:
 *  huis·deur → ɦœys·døːr) and devoices at its own boundary; an unstressed prefix reduces. Single morpheme → direct.
 *  What happens AT the seam (blocked devoicing, degemination) is joinSeams's job, not the morpheme's. */
export type OovResolver = (word: string) => string | undefined;

/**
 * Words `phonemizeWordRules` handles with a SPECIAL CASE, which no outside tier may claim: the indefinite
 * article ⟨'n⟩ = [ə], and a bare single letter, which is SPELLED as its NAME rather than sounded (⟨C⟩ is
 * "see" [siə], #761).
 *
 * ⚠ THIS IS THE THIRD TIME THIS TRAP HAS BEEN SPRUNG IN THIS LANGUAGE, and the first two fixes were both
 * local to whatever tier was being added: #770 caught stray `j`/`q` rows in af-lexicon.tsv making ⟨J⟩ read
 * [jɛ]; #776 caught RCRL's `n`→ə row and fixed it with a BUILD-TIME filter in the lexicon builder. Then the
 * neural tier arrived with no builder and no filter, and claimed both classes again — ⟨'n⟩, the most
 * frequent word in Afrikaans running text, read [n] instead of [ə] in essentially every sentence.
 * So the guard now lives at the SEAM, where it protects any tier that is ever injected, rather than being
 * re-implemented (or forgotten) once per tier.
 */
export function afrikaansRuleReserved(word: string): boolean {
    const w = word.normalize("NFC").toLowerCase();
    return w === "'n" || w === "’n" || [...w].length === 1;
}


/**
 * ⚠ EVERY TIER MUST CARRY THE MARK, OR THE TIERS DISAGREE WITH EACH OTHER. `phonemizeWord` serves a
 * reading from four places — the curated lexicon, the RCRL lexicon, the neural OOV tagger, and the
 * rules — and only the rules compute stress. Leaving the others unmarked made the async/neural path
 * byte-DIFFERENT from the sync path, which afNeural.test.ts and phonemizeAsync.test.ts assert against.
 *
 * So any reading that arrives without a primary mark gets one at the position the rule computes. The
 * RCRL lexicon supplies its own (re-anchored at build time) and is left alone; the curated 44-entry
 * tier and the tagger do not, and are filled in here.
 */
function withStress(ipa: string, word: string): string {
    if (ipa === "" || ipa.includes("\u02c8")) return ipa;
    const target = stressedNucleus(foldForeignLetters(word.normalize("NFC").toLowerCase()));
    let seen = -1;
    for (let i = 0; i < ipa.length; i += 1) {
        const isVowel = IPA_NUCLEUS.test(ipa[i]!);
        if (!isVowel) continue;
        seen += 1;
        if (seen === target) return ipa.slice(0, i) + "\u02c8" + ipa.slice(i);
        while (i + 1 < ipa.length && IPA_NUCLEUS.test(ipa[i + 1]!)) i += 1; // one nucleus, not per letter
    }
    return ipa;
}

/** Vowel symbols the Afrikaans engine emits — the nucleus test for `withStress`. */
const IPA_NUCLEUS = /[aeiouyɑɛɔœəøæɪʊ]/u;

export function phonemizeWord(word: string, oovOverride?: OovResolver): string {
    const w = word.normalize("NFC").toLowerCase();
    // ⚠ PROPER NOUNS AND OPAQUE LOANS (af-lexicon.tsv — referee-sourced: Botha→buəta, Blignault-class
    // French/anglicised spellings, Afrikaans→afrikɑ̃ːs with its nasal): words where NO spelling rule can
    // win, because the orthography is Dutch/French/English-era and the pronunciation is lexical.
    // ⚠ THE LEXICONS RUN BEFORE phonemizeWordRules, SO THEY CAN STILL SHADOW ITS SPECIAL CASES. An earlier
    // comment here claimed the ordering made a stray row "harmless rather than silent"; it does not — ⟨'n⟩
    // and the single-letter NAME rule of #761 both live inside phonemizeWordRules and a lexicon hit reaches
    // them first. That is why af-lexicon.tsv's stray j/q rows made ⟨J⟩ read [jɛ] (#770), and why the RCRL
    // builder drops single-letter rows at BUILD time. The safety is the build-time filter, not this order.
    // ⚠ NOT ON THE EVAL PATH: the entries come from the referee this language is scored against, so
    // phonemizeWordRules below (what the eval calls) skips them — house pattern, same as en-GB/tl/ilo.
    // Provenance + the single-source circularity note: af-lexicon.PROVENANCE.md.
    const pinned = lexicon().get(w);
    if (pinned !== undefined) return withStress(pinned, w);
    // ⚠ THEN THE 27k RCRL LEXICON, AND ONLY THEN THE RULES. Order matters against the tier above: RCRL writes
    // `afrikaans` afrikɑːns, while the curated file carries the nasal afrikɑ̃ːs — the hand-adjudicated entry has
    // to win, so the small curated tier is consulted first and this one fills in behind it.
    // ⚠ WHY A LEXICON AT ALL, when the rules score 79.5%: that number is DICTIONARY-shaped. On running text the
    // rules are ~87% exact, but RCRL covers ~86% of running-text TOKENS, so serving those authoritatively fixes
    // ≈10pp of everything read aloud — the largest single lever left, and the same tiering da/nb/fr/en use.
    const dict = rcrl().get(w);
    if (dict !== undefined) return withStress(dict, w);
    // ⚠ THE NEURAL TIER'S SEAM — after both dictionaries, before the rules. Supplied only by the async path
    // (afrikaansNeural.ts); the sync engine never sets it, so `phonemize(text, "af")` is unchanged.
    // ⚠ AND IT MAY NOT CLAIM THE RULE PATH'S SPECIAL CASES — see afrikaansRuleReserved.
    const oov = afrikaansRuleReserved(w) ? undefined : oovOverride?.(w);
    if (oov !== undefined && oov !== "") return withStress(oov, w);
    return phonemizeWordRules(w);
}

/**
 * The RULE ENGINE ALONE — no proper-noun lexicon. This is the non-circular signal the referee eval scores:
 * af is SINGLE-SOURCE (langs/af.jsonc `secondaryGap`), and af-lexicon.tsv is built from that same referee,
 * so scoring the shipped path would credit the engine for rows copied out of the answer key.
 */
export function phonemizeWordRules(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    if (w === "'n" || w === "’n") return "ə"; // the indefinite article ⟨'n⟩ = [ə]
    // ⚠ A BARE SINGLE LETTER IS SPELLED, NOT SOUNDED — ⟨C⟩ is "see" [siə], not [k] (#761). The initialism
    // normalizer already does this for runs of TWO or more (VSA → vee-es-aa) but never fires on one letter,
    // so a lone letter fell through to the ordinary word path and came out as its phone. It has to live
    // HERE rather than in normalize.ts because the referee scores `af` through phonemizeWord directly, and
    // because a letter reached this way (Vitamien C) is a word of the sentence, not an initialism.
    // ⚠ Afrikaans has no one-letter words — ⟨'n⟩ is two characters and is handled above — so there is no
    // real word for this to swallow. Letters with no name (⟨ê⟩, and anything outside the alphabet) fall
    // through unchanged.
    const spelled = [...w].length === 1 ? LETTER_NAME[w] : undefined;
    if (spelled !== undefined) return phonemizeMorpheme(spelled);
    const d = decompose(w);
    if (d.parts.length <= 1) return phonemizeMorpheme(w);
    const parts = d.parts.map((p, idx) => ({
        src: p,
        ipa:
            d.kinds[idx] === "prefix" && idx < d.stressPart
                ? (PREFIX_IPA[p] ?? phonemizeMorpheme(p, true, false))
                // A RESYLLABIFYING SUFFIX blocks this element's final devoicing — its coda is the suffix's onset.
                : phonemizeMorpheme(p, !RESYLLABIFY.has(d.parts[idx + 1] ?? ""), idx === d.stressPart),
    }));
    return joinSeams(parts);
}

// ⚠ AFRIKAANS USES THE ENGLISH SEPARATORS — a PERIOD decimal point, a COMMA thousands grouping. With a bare
// `(\d+)` number group BOTH fall through to clausePunctuation: "12.8" reads *twaalf . agt* and "17,500"
// *sewentien , vyf honderd*. Clocks and the version-dot are claimed by normalize.ts first, so a period reaching
// here is a decimal and a comma a thousands grouping.
// ⚠ THE WORD GROUP IS BOUNDED TO LATIN SCRIPT, and `[\p{L}\p{M}]` here was silent content loss. `\p{L}` matches
// EVERY script, so this token claimed embedded Greek, Cyrillic, Thai and Devanagari as though they were words of
// this language — and because they were CLAIMED they never became a gap, so `emitUnclaimed` never ran and the
// script router (core/scripts.ts) never saw them. The engine's own word path then returned empty for a script it
// cannot read, and the run vanished with nothing in the IPA to flag it.
// Bounding the group is what makes the run UNCLAIMED, which is the state the router is built to handle. `\p{M}` is
// kept alongside so a decomposed accent or tone mark stays attached to its Latin base.
//
// ⚠ AND THE GROUP MUST BEGIN WITH A LATIN LETTER, not merely contain Latin-or-mark. `[\p{Script=Latin}\p{M}]+`
// still matches a BARE COMBINING MARK, because `\p{M}` is script-neutral — so scanning `เด็ก` skipped the two
// Thai letters, claimed the lone U+0E47 as a "word", and split the gap into `เด` + `ก`. The router then read two
// syllables where Thai reads one: `dˈeː˧ kˈa˨˩ʔ` for what should be `dˈe˨˩k`. Anchoring on a Latin letter means a
// mark can only ever be claimed as part of a Latin word, which is the only thing it should attach to here.
const TOKEN = /(['’]?\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*)|(\d+\.\d+|[1-9]\d{0,2}(?:,\d{3})+|\d+)|([.!?…,;:])/gu;

// Afrikaans measure and currency nouns are INVARIANT after a numeral ("drie persent", "480 kilometer per uur").
const SYMBOLS = makeSymbolNormalizer({
    multiply: { times: MANIFEST.signWords.times },
    percent: MANIFEST.symbolTier.percent,
    currency: MANIFEST.symbolTier.currency,
    units: MANIFEST.symbolTier.units,
    rateDenominators: MANIFEST.symbolTier.rateDenominators,
    unitPer: MANIFEST.symbolTier.unitPer,
    exponentWords: MANIFEST.symbolTier.exponentWords,
    magnitudes: MANIFEST.symbolTier.magnitudes,
});

class AfrikaansPhonemizer implements Phonemizer {
    text(input: string, oovOverride?: OovResolver): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/clock/decimal steps need
        // the number and its separator still adjacent, which the tier would break. The initialism pass is
        // re-applied to the tier's output because its currency nouns carry caps (VS-dollar from U$/VS$).
        return assembleClauses(normalizeAfrikaansInitialisms(SYMBOLS(normalizeAfrikaans(input))), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1], oovOverride));
            else if (m[2]) {
                // A PERIOD is the decimal point (12.8) and a COMMA groups thousands (17,500) — see TOKEN.
                const [intPart, frac] = m[2].replace(/,/gu, "").split(".");
                for (const wd of numberToWords(Number(intPart), intPart).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord(MANIFEST.decimalWord));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" ")) sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Afrikaans phonemizer (greedy g2p + open/closed vowel length + final devoicing). */
export function createAfrikaans(): Phonemizer & { text(input: string, oovOverride?: OovResolver): string } {
    return new AfrikaansPhonemizer();
}
