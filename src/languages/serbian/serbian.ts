/**
 * Serbian (sr, српски) phonemizer — South Slavic, DUAL SCRIPT (Cyrillic + Gaj's Latin), fully phonemic, espeak-
 * independent. A digraph-aware left-to-right scan (g2p reads serbian.jsonc): the Latin digraphs ⟨dž lj nj dj⟩
 * first, then the single Cyrillic OR Latin letters — every grapheme is one phoneme, no vowel reduction. Serbian's
 * lexical PITCH ACCENT (4-way) + length are unwritten and DEFERRED — no stress/tone mark is emitted (the referee
 * eval folds them). text() tokenizes words / numbers / punctuation. See docs/investigations/sr_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeSerbian } from "./normalize.ts";
import { MANIFEST } from "./manifest.ts";

const DIGRAPHS = MANIFEST.digraphs;
const LETTERS = MANIFEST.letters;
const CLAUSE_MARK = MANIFEST.clausePunctuation;

/** Phonemize a single Serbian word (either script) to canonical IPA. Digraphs are longest-match; every other
 *  grapheme is a one-letter lookup. No accent/length is emitted (deferred). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    let out = "";
    for (let i = 0; i < w.length; ) {
        const two = w.slice(i, i + 2);
        if (DIGRAPHS[two]) {
            out += DIGRAPHS[two];
            i += 2;
            continue;
        }
        const c = w[i]!;
        if (LETTERS[c] !== undefined) out += LETTERS[c];
        i++; // unknown char (punctuation) → skip
    }
    return out;
}

// A word (Serbian Cyrillic + Latin incl. diacritics) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "а-шђјљњћџ")})|(\\d+)|([.!?…,;:])`, "giu");
/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted verbatim, so
 * nothing about the orthography is invented here. A token this REJECTS carries a letter the language does not
 * use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it is no longer also
 * deciding where the script boundary falls (#657).
 *
 * ⚠ `й` IS EXCLUDED, and it is the one part of this that is not a straight lift. The old class used the coarse
 * range `а-ш`, which sweeps up `й` — a RUSSIAN letter that Serbian/Bosnian Cyrillic does not have (this
 * orthography writes `ј`, U+0458, which sits outside the range entirely and is listed separately). The g2p has no
 * rule for `й` and dropped it. Excluding it from the inventory hands it to the fold instead, and `й` DOES
 * decompose — и + combining breve — so `Толстой` now reads with a final /i/ rather than losing the letter.
 * The TOKEN above deliberately stays wide: claiming the whole Cyrillic run is the SCRIPT question, and getting
 * that right is what puts the letter in front of the fold at all (#657).
 */
const NATIVE_CLASS = "[а-ик-шђјљњћџa-zčćšžđ]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class SerbianPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 order: normalize.ts owns the whole sequence, INCLUDING the shared symbol tier — its step 9
        // has to sit between the clock (which needs the colon) and the decimal fold (which destroys the
        // number the tier's count agreement reads), so the tier cannot be applied around this call the
        // way most engines do it. See the ordering comments there.
        return assembleClauses(normalizeSerbian(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Serbian phonemizer (phonemic dual-script g2p; pitch accent deferred). */
export function createSerbian(): Phonemizer {
    return new SerbianPhonemizer();
}
