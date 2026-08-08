/**
 * Afrikaans (af) phonemizer — Indo-European (West Germanic), Latin script, Standard Afrikaans.
 *
 * A greedy longest-match scan over the fixed graphemes (digraphs/consonants, length-desc) PLUS two
 * code rules the table can't express: the Germanic OPEN/CLOSED-SYLLABLE vowel-length rule (a bare vowel is long/tense
 * in an open syllable V.CV, short/lax in a closed one VC#/VCC — via lookahead) and word-final obstruent DEVOICING
 * (b→p, d→t; g→χ and v→f are unconditional). The long mid vowels are centering diphthongs (ee/open-e = iə, oo/open-o
 * = uə). Stress + schwa-reduction of unstressed vowels are not modelled (folded).
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
import { normalizeAfrikaans, normalizeAfrikaansInitialisms } from "./normalize.ts";

const FIXED = MANIFEST.fixed;
const LONG = MANIFEST.vowelsLong;
const SHORT = MANIFEST.vowelsShort;
const DIA = MANIFEST.diacriticVowels;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

const DEVOICE = MANIFEST.voicedFinal; // word-final devoicing (g→χ, v→f already fixed)
// Letter environments (afrikaans.jsonc): the vowels routed through the length rule, and every letter that
// heads a nucleus — the latter bounds the consonant run in the open/closed lookahead below.
const BARE_VOWELS = new Set(MANIFEST.bareVowels);
const VOWEL_LETTER = new Set(MANIFEST.vowelLetters);

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
const C_SOFT = new Set(MANIFEST.cSoftBefore); // ⟨c⟩ → [s] before one of these, else [k]

// ⚠ THESE REGEXES ARE BUILT FROM THE MANIFEST, NOT SPELLED OUT. Both classes were written inline, and the
// vowel one had already DRIFTED from `vowelLetters` — it was missing ⟨ö⟩, which the diacritic table maps to
// [ø]. Inert so far (Afrikaans does not emit stress, and ⟨ö⟩ only occurs beside another vowel, so the group
// regex merged it either way), but it is one edit away from mattering. Derived, it cannot drift again.
const V = MANIFEST.vowelLetters.join("");
const VOWEL_GROUP = new RegExp(`[${V}]+`, "gu");
// Longest-first is cosmetic here, NOT load-bearing: both patterns are $-anchored and used only through
// .test(), so alternation order cannot change the boolean. Sorted anyway so the source reads in the same
// order as the manifest lists them, and so it stays correct if either is ever used to CAPTURE.
const byLen = (xs: readonly string[]): string => [...xs].sort((a, b) => b.length - a.length).join("|");
const STRESS_FINAL = new RegExp(`(${byLen(MANIFEST.stressFinalSuffixes)})$`, "u");
const STRESS_PENULT = new RegExp(`(${byLen(MANIFEST.stressPenultSuffixes)})$`, "u");
// Unstressed one-syllable prefixes: stress falls on the following syllable (begín, gemáák, verstáán).
// ⚠ THE SAME SIX PREFIXES LIVED IN THREE PLACES — this regex, PREFIX_IPA below, and the manifest's
// morphology.prefixUnstressed (read by the shared Germanic compound engine). One source now, asserted below.
const UNSTRESSED_PREFIX = new RegExp(`^(${MANIFEST.morphology.prefixUnstressed.join("|")})[^${V}]*[${V}]`, "u");

/** The (0-based) nucleus that carries primary stress. Native default = the first syllable (past an unstressed
 *  prefix); loan suffixes shift it: -ie/-sie/-asie → penultimate (aborsie→a·BOR·sie), -eer/-eur/-teit → final. */
function stressedNucleus(w: string): number {
    const n = (w.match(VOWEL_GROUP) ?? []).length;
    if (n <= 1) return 0;
    if (STRESS_FINAL.test(w)) return n - 1; // stress-final loan suffixes (afrikaans.jsonc)
    if (STRESS_PENULT.test(w)) return n - 2; // -ie / -sie / -asie / -osie → penultimate
    return UNSTRESSED_PREFIX.test(w) ? 1 : 0;
}

/** Phonemize a single MORPHEME (a whole non-compound word, or one element of a compound) — its own first-syllable
 *  stress, open/closed length, and word-/morpheme-final devoicing. */
function phonemizeMorpheme(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const stressNucleus = stressedNucleus(w); // primary-stress nucleus (native first-syllable + loan-suffix overrides)
    let out = "";
    let i = 0;
    let nucleus = 0; // count of vowel nuclei emitted so far
    while (i < w.length) {
        const c = w[i]!;
        if (DIA[c]) { out += DIA[c]; i += 1; nucleus += 1; continue; } // diacritic vowel (single char)
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
        let matched = false;
        for (const key of FIXED_KEYS) {
            if (w.startsWith(key, i)) {
                const next = w[i + key.length];
                // devoicing: a voiced obstruent devoices word-finally OR before a VOICELESS consonant (aandklok→ɑnt);
                // it stays voiced before a vowel or a voiced consonant.
                const devoiceHere = next === undefined || "ptksfcgx".includes(next);
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
            if (c === "e" && i === w.length - 1) out += "ə"; // final unstressed ⟨e⟩ → schwa
            else if (c === "i") out += isOpen(w, i) ? "i" : "ə"; // ⟨i⟩ is tense [i]/lax [ə] by syllable, not by stress
            else if (stressed) out += isOpen(w, i) ? LONG[c]! : SHORT[c]!; // length rule in the stressed syllable
            else out += REDUCE[c]!; // other unstressed vowels → short / schwa
            i += 1;
            nucleus += 1;
            continue;
        }
        i += 1; // unknown char → skip
    }
    return out;
}

// Reduced IPA per unstressed prefix (afrikaans.jsonc). Separable prefixes (aan/af…) carry stress and take
// the normal morpheme path.
const PREFIX_IPA = MANIFEST.prefixIpa;
const LETTER_NAME = MANIFEST.letterNames; // a bare single letter is SPELLED (see phonemizeWord)
// ⚠ THE TWO LISTS MUST AGREE — the same six prefixes, read by two consumers (this file's stress + IPA,
// and the shared compound engine's decomposition). Asserted in test/afrikaans.test.ts rather than here:
// registry.ts imports this module STATICALLY, so a throw at module init would make one typo in the
// Afrikaans manifest break every other language's import too.

/** Phonemize one Afrikaans word to canonical IPA. Compounds/affixed words are DECOMPOSED (shared morphology) and
 *  each morpheme phonemized independently — so each element keeps its OWN stressed vowel (no cross-element reduction:
 *  aand·ete → ɑnt·iətə) and devoices at its own boundary; an unstressed prefix reduces. Single morpheme → direct. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    if (w === "'n" || w === "’n") return "ə"; // the indefinite article ⟨'n⟩ = [ə]
    // ⚠ PROPER NOUNS AND OPAQUE LOANS FIRST (af-lexicon.tsv — ~50 referee-sourced entries: Botha→buəta,
    // Blignault→ˈblɨxnœut-class French/anglicised spellings, Afrikaans→afrikɑ̃ːs with its nasal). These are
    // words where NO spelling rule can win: the orthography is Dutch/French/English-era and the received
    // pronunciation is lexical. Provenance + the single-source circularity note: af-lexicon.PROVENANCE.md.
    const pinned = lexicon().get(w);
    if (pinned !== undefined) return pinned;
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
    return d.parts
        .map((p, idx) => (d.kinds[idx] === "prefix" && idx < d.stressPart ? (PREFIX_IPA[p] ?? phonemizeMorpheme(p)) : phonemizeMorpheme(p)))
        .join("");
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
const TOKEN = /(['’]?\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*)|(\d+\.\d+|\d{1,3}(?:,\d{3})+|\d+)|([.!?…,;:])/gu;

// Afrikaans measure and currency nouns are INVARIANT after a numeral ("drie persent", "480 kilometer per uur").
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ Declaring `multiply` HERE is what makes ASCII `x` read like `×`: otherwise `6x6 cm` reads the `x` as a
    // LETTER NAME, and `NxN` is the commoner written form. One word, so `by` defaults to it — Afrikaans does not
    // split dimension from product.
    // ⚠ ONE SOURCE with signWords.times — `6 × 6` goes through normalize.ts and `6x6 cm` through this
    // tier, and they must read the same word.
    multiply: { times: MANIFEST.signWords.times },
    percent: ["persent"],
    currency: { "€": ["euro"], "$": ["dollar"], "£": ["pond"], "¥": ["jen"], "U$": ["VS-dollar"], "VS$": ["VS-dollar"] },
    units: {
        km: ["kilometer"], cm: ["sentimeter"], mm: ["millimeter"], kg: ["kilogram"],
        mi: ["myl"], mph: ["myl per uur"],
        // `m` is declared because `kubieke`/`vierkante` below cannot reach a bare metre without it.
        // ⚠ THE HAZARD IS `40 m.p.u` (myl per uur, the Afrikaans spelling), which a letter-guard does NOT reject
        // because a dot is not a letter — but normalize.ts rewrites the dotted abbreviation to words BEFORE the
        // tier runs, so no bare `m` survives to be misread.
        // ⚠ RESIDUAL EXPOSURE, stated rather than left to be discovered: normalize.ts step 7 rewrites a version
        // dot to the WORD "punt" before the tier runs, so the tier's `NOT_VERSION` guard has no dot left to see
        // and `802.11m` reads as "…elf METER". Bounded and unattested: that rule fires only on THREE-or-more
        // integer digits plus one trailing letter, so `6.5m` is untouched, and 802.11 comes as a/b/g/n.
        m: ["meter"],
        // ⚠ THE ONE-LETTER UNITS, declared because #762 made their absence AUDIBLE: a bare letter is now
        // spelled as its name, so an undeclared `3 g suiker` read "drie GEE suiker" — a confident wrong
        // WORD where it used to be a wrong phone. Only these three, all of which follow a numeral in
        // ordinary text; anything rarer stays undeclared rather than guessed at.
        // ⚠ ⟨V⟩ AND ⟨W⟩ ARE CAPITAL BECAUSE THEY ARE NAMED AFTER PEOPLE (Volta, Watt), and the resolver
        // is case-sensitive for one-letter symbols (#763), so a lower-case ⟨v⟩/⟨w⟩ is correctly NOT read
        // as a unit. ⟨t⟩ is the tonne; ⟨T⟩ would be the tesla and is deliberately not declared.
        g: ["gram"], // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
        // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
        // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
        l: ["liter"], L: ["liter"], t: ["ton"], V: ["volt"], W: ["watt"],
    },
    rateDenominators: { h: "uur", u: "uur", s: "sekonde" },
    unitPer: "per",
    exponentWords: { squared: ["vierkante"], cubed: ["kubieke"], position: "before" },
    magnitudes: ["miljoen", "miljard", "biljoen"],
});

class AfrikaansPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/clock/decimal steps need
        // the number and its separator still adjacent, which the tier would break. The initialism pass is
        // re-applied to the tier's output because its currency nouns carry caps (VS-dollar from U$/VS$).
        return assembleClauses(normalizeAfrikaansInitialisms(SYMBOLS(normalizeAfrikaans(input))), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                // A PERIOD is the decimal point (12.8) and a COMMA groups thousands (17,500) — see TOKEN.
                const [intPart, frac] = m[2].replace(/,/gu, "").split(".");
                for (const wd of numberToWords(Number(intPart)).split(" ")) sink.emit(phonemizeWord(wd));
                if (frac !== undefined) {
                    sink.emit(phonemizeWord("komma"));
                    for (const d of frac)
                        for (const wd of numberToWords(Number(d)).split(" ")) sink.emit(phonemizeWord(wd));
                }
            } else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Afrikaans phonemizer (greedy g2p + open/closed vowel length + final devoicing). */
export function createAfrikaans(): Phonemizer {
    return new AfrikaansPhonemizer();
}
