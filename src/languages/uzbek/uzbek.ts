/**
 * Native Uzbek / oʻzbekcha (uz) text phonemizer — canonical IPA. Turkic, modern LATIN
 * orthography. Uzbek is the Turkic outlier that LOST vowel harmony (Persian/Tajik contact), so the g2p is a flat
 * left-to-right scan with fixed letter values — no harmony machinery. The signature is the vowel split ⟨o⟩→[ɒ]
 * vs ⟨oʻ⟩→[o]. Handles the digraphs sh/ch/ng and the two comma-letters oʻ/gʻ, distinguishing the comma (which
 * forms oʻ/gʻ) from the tutuq belgisi (a standalone apostrophe → glottal stop [ʔ]). Final-syllable (weak) stress.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, spellDigits } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { IPA_VOWEL } from "../../core/ipa.ts";
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
const VOWEL_IPA = IPA_VOWEL;

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
            // ⚠ WORD-INTERIOR ONLY. The tutuq belgisi separates two letters (sanʼat, isʼhoq) and is never
            // word-initial or word-final in Uzbek; at an edge the mark is a QUOTATION mark, which the
            // tokenizer's lead-legal apostrophe class hands over with the word. Unguarded, `'soʻz'` read
            // *ʔsˈozʔ* — a glottal stop on each side of a quoted word, in every quoted word. This is the
            // same guard Oromo's scanner states for the same character and the same reason.
            if (i > 0 && i + 1 < chars.length) out.push(DEF.glottal);
            i++;
            continue;
        }
        if (DEF.vowels[c] !== undefined) out.push(DEF.vowels[c]!);
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language.
        else if (DEF.consonants[c] !== undefined) out.push(DEF.consonants[c]!);
        else { const p = latinPhone(c, { initial: i === 0 }); if (p !== undefined) out.push(p); }
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
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(n)) return spellDigits(digits, DEF.numbers, phonemizeWord);
    return renderNumber(n, DEF.numbers, phonemizeWord, turkicNumberWords);
}

/** The decimal-comma word (manifest `numbers.decimalWord`) as IPA — read between integer and fraction. */
const DECIMAL_IPA = phonemizeWord(DEF.numbers.decimalWord!);

// symbol normalization — Uzbek. The corpus's own prose fixes the conventions: percent is POSTPOSED
// ("8 foizga" — foiz = percent), rates are PREFIXED ("soatiga 240 kilometr"), and squared units are a
// PREFIX adjective ("kvadrat kilometr"). km/mm/sm/m are claimed here so the tier's "only after a number"
// guard applies; the m/s and km/s compounds are consumed earlier, in normalize.ts step 10.
// ⚠ THE UZBEK ABBREVIATION IS `sm`, NOT `cm` — santimetr, and the corpus writes `sm` ×4 against `cm` ×0.
// Two comments here used to say `cm` (one of them working its example on `6x6 cm`) while the table said
// `sm`, so the docstring and the code disagreed about which key existed. The table was right.
const SYMBOLS = makeSymbolNormalizer({
    // `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 sm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "karra" },
    percent: ["foiz"],
    currency: { "$": ["dollar"], "¥": ["iyena"] },
    // ⚠ `cm` IS THE SAME WORD BY ITS INTERNATIONAL SPELLING, not a new claim. The attestation above is for
    //   the WORD (santimetr ×4), which is already declared; `cm` ×0 here only says this corpus writes the
    //   Uzbek abbreviation. Unclaimed, a digit-adjacent `cm` reached the g2p raw and `5 cm` read *bˈeʃ km* —
    //   ⟨c⟩ has no Uzbek value so it folds to [k], giving a vowel-less cluster Uzbek phonotactics do not
    //   permit. An audible nonsense reading is worse than the second key.
    units: { km: ["kilometr"], mm: ["millimetr"], sm: ["santimetr"], cm: ["santimetr"], m: ["metr"] },
    // `bortida 120–160 kubometr yonilg'i` — FUSED, and fused the other way round from `kvadrat`, which the
    // same corpus writes spaced (`783 562 kvadrat kilometerni`). Hence the per-power position record: one
    // value could not spell both. `kub`/`kubik` are ×0 here; the closed `kubometr` is what this corpus has.
    exponentWords: { squared: ["kvadrat"], cubed: ["kubo"], position: { squared: "before", cubed: "compound" } },
});

const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "ʻ'’‘`ʼ′")})|(\\d+(?:,\\d+)?)|([.!?…,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zʻ'’‘`ʼ′]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

export type ForeignPhonemizer = (latin: string) => string;

class UzbekPhonemizer implements Phonemizer {
    text(input: string): string {
        // normalize.ts FIRST, then the shared symbol tier — normalize's ordinal/rate/clock steps need the
        // number and its suffix still adjacent, which the tier would break (1978-yildagi → 1978 … yildagi).
        return assembleClauses(SYMBOLS(normalizeUzbek(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
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
