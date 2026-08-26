/**
 * Finnish (fi) phonemizer — Standard Finnish (yleiskieli), the Latin orthography, canonical IPA.
 * The national language of Finland (~5.4M). Finnish is one of the most PHONEMICALLY TRANSPARENT orthographies in the
 * world (very nearly one grapheme ↔ one phoneme), so this is a greedy longest-match scan over the grapheme table
 * (manifest.ts) with three code rules: CONSONANT GEMINATION — a doubled consonant → geminate [Cː] (kukka→kukːɑ,
 * tullut→tulːut) — and the velar-nasal rules ⟨ng⟩→ŋː (a LONG velar nasal: kengät→keŋːæt, rengas→reŋːɑs) and ⟨nk⟩→ŋk
 * (⟨n⟩→ŋ before k: sänky→sæŋky). Signatures: 8 vowels with ⟨a⟩=ɑ (BACK); DOUBLING = LENGTH (aa→ɑː …); the 18
 * diphthongs mark the 2nd vowel as the non-syllabic offglide (au→ɑu̯, uo→uo̯) in the table; ⟨v⟩=ʋ (approximant),
 * ⟨r⟩=r (trill), ⟨j⟩=j. Consonant GRADATION is already spelled out in the orthography → no gradation logic needed.
 * Fixed word-initial primary stress is predictable + unwritten → not emitted (folded in the referee eval).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { LATIN_RUN, makeNativiser } from "../../core/hostWord.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST, GRAPHEME_KEYS } from "./manifest.ts";
import { numberToWords, readDigits } from "./numbers.ts";
import { normalizeFinnish, normalizeFinnishInitialisms } from "./normalize.ts";

const G = MANIFEST.graphemes;
const CLAUSE_MARK = MANIFEST.clausePunctuation;
const VOWEL_LETTERS = new Set(MANIFEST.vowelLetters);

/** Phonemize a single Finnish word to canonical IPA (segmental; gemination + velar-nasal rules; length + diphthong
 *  offglides emitted). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    let i = 0;
    while (i < w.length) {
        const c = w[i]!;
        const next = w[i + 1] ?? "";
        // ⟨ng⟩ → ŋː (a long velar nasal), consuming both letters — before gemination so the ⟨n⟩ isn't mishandled.
        if (c === "n" && next === "g") { out += "ŋː"; i += 2; continue; }
        // ⟨nk⟩ → ŋk (⟨n⟩ → ŋ before a velar k); emit ŋ and let the k be scanned next (so kk-gemination still holds).
        if (c === "n" && next === "k") { out += "ŋ"; i += 1; continue; }
        // consonant gemination: a doubled consonant letter → geminate [Cː].
        if (!VOWEL_LETTERS.has(c) && next === c && G[c]) { out += G[c]! + "ː"; i += 2; continue; }
        let matched = false;
        for (const key of GRAPHEME_KEYS) {
            if (w.startsWith(key, i)) { out += G[key]!; i += key.length; matched = true; break; }
        }
        // ⚠ NOT SILENTLY: a letter with no grapheme rule here still denotes a sound, and dropping it deletes
        // what the writer typed. Consulted only on the MISS branch, after every grapheme (including every
        // digraph) has been tried, so it can never override a reading this language has an opinion about.
        if (!matched) {
            out += latinPhone(w[i]!, { initial: i === 0, includeH: true }) ?? "";
            i += 1;
        }
    }
    return out;
}

// A word (Finnish Latin letters incl. ä ö å + loan š ž) / number / punctuation token.
const TOKEN = new RegExp(`(${LATIN_RUN})|(\\d+)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zäöåšž]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

/**
 * The shared symbol tier (core/normalizeSymbols.ts), which composes number + sign / unit / rate /
 * exponent in one pass. Runs AFTER normalize.ts, which is what lets that file keep its rewrites in
 * DIGITS: `13,6 cm` leaves normalize.ts as `13 pilkku 6 cm`, so the number–unit adjacency this tier
 * matches on is still intact.
 *
 * COUNT FORMS ARE `[singular, partitive]` AND THE DEFAULT SELECTOR IS EXACTLY RIGHT FOR FINNISH — a
 * counted noun is nominative after 1 and PARTITIVE after everything else (*1 kilometri*, *10
 * kilometriä*), which is the tier's `n === 1 ? 0 : 1` without an override.
 *
 * ⚠ `km/h` AND `m/s` ARE COMPOUND KEYS, NOT `unitPer` (trap 44 / trap 47 reason 1). The Finnish rate
 * idiom is not "A per B": the denominator takes the INESSIVE and there is no joining word at all —
 * *kilometriä tunnissa*, *metriä sekunnissa*. `unitPer` is one invariant string and none of these is one.
 * `unitAlt` is sorted longest-first, so the 4-character key is tried before the bare `km`.
 *
 * ⚠ BARE `m` IS DECLARED, AND THE ONE-LETTER-KEY HAZARD (traps 28/46) WAS MEASURED FIRST: digit-adjacent
 * `m` is ×1 in the retained corpus (`jopa 10 m korkeita`, a genuine metre) and the `version-dot` cell is
 * ×0. The residual exposure is a dotted designation ending in ⟨m⟩ (`802.11m`), which the tier's
 * `NOT_VERSION` guard rejects by SEEING THE DOT — and unlike fa/ckb/af/ca, this language's normalize.ts
 * never spends a decimal POINT (Finnish decimals use a comma), so the dot is still there when the tier
 * runs. The guard's evidence outlives the pass, which is what makes the key safe here (trap 39).
 *
 * ⚠ `°C` IS NOT ON THE TIER — normalize.ts step 10 owns it, because it also has to read the BARE `°` of
 * a latitude and an angle, which is the same word (*astetta*) and no scale name.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["prosentti", "prosenttia"],
    currency: { $: ["dollari", "dollaria"], "€": ["euro", "euroa"] },
    units: {
        // Longest-first inside the tier; both rate keys compose the inessive denominator themselves.
        "km/h": ["kilometri tunnissa", "kilometriä tunnissa"],
        "m/s": ["metri sekunnissa", "metriä sekunnissa"],
        km: ["kilometri", "kilometriä"],
        cm: ["senttimetri", "senttimetriä"],
        mm: ["millimetri", "millimetriä"],
        kg: ["kilogramma", "kilogrammaa"],
        m: ["metri", "metriä"],
    },
    // Finnish welds the measure word onto the FRONT as one compound — *neliökilometriä*, *kuutiometriä* —
    // which is `compound`, never `before` (that would give *neliö kilometriä*, two tokens).
    // `neliökilometriä` is corpus-attested ×8 and `neliökilometrin` ×20/12 on the wiki; `kuutio` is a
    // referee lemma and the cube has ×0 corpus instances, so it is declared for the shape rather than for
    // a measured defect and is labelled as such.
    exponentWords: { squared: ["neliö"], cubed: ["kuutio"], position: "compound" },
    // The magnitude hop, for `1 850 miljardia dollaria` — and the field gates the UNIT path's connective
    // hop too, which is the "one declaration, two consumers" note at the end of the playbook. Finnish
    // takes NO connective (*viisi miljoonaa dollaria*), so `magnitudeConnective` stays undefined.
    magnitudes: ["miljoona", "miljoonaa", "miljardi", "miljardia", "biljoona", "biljoonaa"],
    ampersand: "ja",
    // The corpus's `×` is a dimension cross (`4 096 × 2 304`, `7680×4320`) and a multiplier
    // (`2×15 minuuttia`); Finnish says *kertaa* for both, so `by` defaults to `times`.
    multiply: { times: "kertaa" },
});

class FinnishPhonemizer implements Phonemizer {
    text(rawInput: string): string {
        const input = SYMBOLS(normalizeFinnishInitialisms(normalizeFinnish(rawInput)));
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2]) {
                // ≤9 digits fits a safe integer (<1e9) → compose; longer → read the raw string digit-by-digit so the
                // float conversion can't lose precision or go exponential (1e21 → "1e+21").
                const words = m[2].length <= 9 ? numberToWords(Number(m[2]), m[2]) : readDigits(m[2]);
                for (const wd of words.split(" ")) sink.emit(phonemizeWord(wd));
            }
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Finnish phonemizer (greedy g2p + gemination + velar-nasal rules + cardinal numbers). */
export function createFinnish(): Phonemizer {
    return new FinnishPhonemizer();
}
