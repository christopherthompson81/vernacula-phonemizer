/**
 * Native Uzbek / oʻzbekcha (uz) text phonemizer — canonical IPA, espeak-independent. Turkic, modern LATIN
 * orthography. Uzbek is the Turkic outlier that LOST vowel harmony (Persian/Tajik contact), so the g2p is a flat
 * left-to-right scan with fixed letter values — no harmony machinery. The signature is the vowel split ⟨o⟩→[ɒ]
 * vs ⟨oʻ⟩→[o]. Handles the digraphs sh/ch/ng and the two comma-letters oʻ/gʻ, distinguishing the comma (which
 * forms oʻ/gʻ) from the tutuq belgisi (a standalone apostrophe → glottal stop [ʔ]). Final-syllable (weak) stress.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { turkicNumberWords, type UzbekNumberWords } from "./numbers.ts";
import { normalizeUzbek } from "./normalize.ts";

interface UzbekDef {
    vowels: Record<string, string>;
    consonants: Record<string, string>;
    digraphs: Record<string, string>;
    glottal: string;
    numbers: UzbekNumberWords;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<UzbekDef>(import.meta.url, "uzbek.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

// Any apostrophe variant used for the comma-letters oʻ/gʻ OR the tutuq belgisi → one canonical mark ʻ (U+02BB):
// straight ' , curly ' ' , backtick ` , the modifier turned-comma ʻ , the modifier apostrophe ʼ .
const APOS = /['’‘`ʻʼ′]/gu;
const APOS_C = "ʻ";
const VOWEL_IPA = new Set(["a", "e", "i", "o", "u", "ɒ"]);

/** One Uzbek (Latin) word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const s = word.toLowerCase().normalize("NFC").replace(APOS, APOS_C);
    const chars = [...s];
    const out: string[] = [];
    for (let i = 0; i < chars.length; ) {
        // Digraphs first (oʻ, gʻ, sh, ch, ng) — two-char lookahead. GUARD: don't let a greedy "ng" swallow the g
        // of a following gʻ (toʻngʻiz = to + ngʻ... is n + gʻ, → tonʁiz, NOT toŋ + ʔ) — if an apostrophe follows
        // the g, this is n + gʻ, so emit the single n and let the gʻ digraph fire next.
        const two = chars[i]! + (chars[i + 1] ?? "");
        if (DEF.digraphs[two] !== undefined && !(two === "ng" && chars[i + 2] === APOS_C)) {
            out.push(DEF.digraphs[two]!);
            i += 2;
            continue;
        }
        const c = chars[i]!;
        if (c === APOS_C) {
            // A comma not consumed by an oʻ/gʻ digraph is the tutuq belgisi → glottal stop.
            out.push(DEF.glottal);
            i++;
            continue;
        }
        if (DEF.vowels[c] !== undefined) out.push(DEF.vowels[c]!);
        else if (DEF.consonants[c] !== undefined) out.push(DEF.consonants[c]!);
        // else: unknown char (stray punctuation inside a token) → skip
        i++;
    }
    let x = out.join("");
    // Final-syllable (weak) stress: mark the LAST vowel nucleus.
    const vowels = [...x].map((c, idx) => ({ c, idx })).filter((o) => VOWEL_IPA.has(o.c));
    if (vowels.length) {
        const at = vowels[vowels.length - 1]!.idx;
        x = x.slice(0, at) + "ˈ" + x.slice(at);
    }
    return x.normalize("NFC");
}

function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, turkicNumberWords);
}

/** The decimal-comma word (manifest `numbers.decimalWord`) as IPA — read between integer and fraction. */
const DECIMAL_IPA = phonemizeWord(DEF.numbers.decimalWord!);

// #562 symbol normalization — Uzbek. The corpus's own prose fixes the conventions: percent is POSTPOSED
// ("8 foizga" — foiz = percent), rates are PREFIXED ("soatiga 240 kilometr"), and squared units are a
// PREFIX adjective ("kvadrat kilometr"). km/mm/cm are claimed here so the tier's "only after a number"
// guard applies; the m/s and km/s compounds are consumed earlier, in normalize.ts step 10.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["foiz"],
    currency: { "$": ["dollar"], "¥": ["iyena"] },
    units: { km: ["kilometr"], mm: ["millimetr"], sm: ["santimetr"], m: ["metr"] },
    exponentWords: { squared: ["kvadrat"], position: "before" },
});

const TOKEN = /([a-zʻ'’‘`ʼ′]+)|(\d+(?:,\d+)?)|([.!?…,;:])/giu;

export type ForeignPhonemizer = (latin: string) => string;

class UzbekPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/rate/clock steps need the
        // number and its suffix still adjacent, which the tier would break (1978-yildagi → 1978 … yildagi).
        return assembleClauses(SYMBOLS(normalizeUzbek(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intRaw, frac] = m[2].split(",");
                for (const wd of number(intRaw!).split(" ")) sink.emit(wd);
                if (frac !== undefined) {
                    // The decimal comma reads "vergul" (then digit-by-digit). It goes through the g2p like
                    // any other number word — emitting the SPELLING here leaked "vergul" into the IPA.
                    sink.emit(DECIMAL_IPA);
                    for (const d of frac) for (const wd of number(d).split(" ")) sink.emit(wd);
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Uzbek phonemizer. */
export function createUzbek(): Phonemizer {
    return new UzbekPhonemizer();
}
