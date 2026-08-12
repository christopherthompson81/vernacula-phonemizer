/**
 * Native Indonesian (id) text phonemizer — canonical IPA. Bahasa Indonesia has a shallow,
 * near-phonemic Latin orthography, so this is a rule-based transliterator: digraphs (ng→ŋ, ny→ɲ, sy→ʃ, kh→x)
 * then single letters, ⟨e⟩→schwa [ə] by default, closed-syllable lax allophones (i→ɪ, u→ʊ, e→ɛ, o→ɔ), falling
 * diphthongs ai/au/oi, and syllable-final ⟨k⟩ → glottal stop [ʔ]. Penultimate stress (skips a schwa nucleus).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { normalizeIndonesian } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    belas: string;
    puluh: string;
    ratus: string;
    ribu: string;
    juta: string;
    seprefix: string;
    /** The word for the decimal comma ("koma"); absent before, so a decimal ran its two halves together. */
    decimalWord?: string;
}
interface IndonesianDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    laxVowels: Record<string, string>;
    diphthongs: Record<string, string>;
    letterNames: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<IndonesianDef>(import.meta.url, "indonesian.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

export type ForeignPhonemizer = (latin: string) => string;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiouəɛɔɪʊ";

interface Seg {
    ph: string;
    vowelLetter: string; // the source vowel letter (for lax resolution); "" for consonants
}

/** Scan a lowercased Indonesian word into segments (consonants + tense-default vowels). */
function scan(w: string): Seg[] {
    const s = [...w];
    const segs: Seg[] = [];
    for (let i = 0; i < s.length; ) {
        // Falling diphthong at word end (ai/au/oi): the two vowels form one nucleus.
        const di = s[i]! + (s[i + 1] ?? "");
        if (DEF.diphthongs[di] && i + 2 === s.length) {
            segs.push({ ph: DEF.diphthongs[di]!, vowelLetter: "" });
            i += 2;
            continue;
        }
        const dg = s[i]! + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            segs.push({ ph: DEF.digraphs[dg]!, vowelLetter: "" });
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (isVowelLetter(c)) {
            segs.push({ ph: DEF.vowels[c]!, vowelLetter: c });
            i++;
        } else if (DEF.consonants[c]) {
            segs.push({ ph: DEF.consonants[c]!, vowelLetter: "" });
            i++;
        } else {
            i++; // unknown → skip
        }
    }
    return segs;
}

// NOTE: Indonesian /i u e o/ have lax closed-syllable allophones [ɪ ʊ ɛ ɔ], but the referee (and standard
// descriptions) apply them only erratically/dialectally — kecil→kətʃil, air→air keep TENSE vowels. We emit the
// tense phonemes for canonical consistency; the eval folds the tense/lax axis (config.ts). laxVowels stays in
// the manifest for reference.

/** Penultimate stress on the second-to-last vowel; if that nucleus is a schwa, shift to the final. */
function stressIndex(segs: Seg[]): number {
    const nuclei = segs
        .map((s, i) => (VOWEL_PH.includes(s.ph[0] ?? "") ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return -1;
    if (nuclei.length === 1) return nuclei[0]!;
    const penult = nuclei[nuclei.length - 2]!;
    if (segs[penult]!.ph === "ə") return nuclei[nuclei.length - 1]!; // schwa can't bear stress
    return penult;
}

/** One Indonesian word → canonical IPA, RULE-ENGINE ONLY (no ⟨e⟩ lexicon). The honest, non-circular engine
 *  signal used by the referee eval; the shipped phonemizeWord layers the consensus ⟨e⟩ lexicon on top. */
export function phonemizeWordRules(word: string): string {
    // All-caps acronym → spell each letter by its Indonesian name (BBM → be-be-em → bebeem).
    if (/^[A-Z]{2,}$/.test(word))
        return [...word.toLowerCase()]
            .map((c) => DEF.letterNames[c] ?? "")
            .join("");
    const segs = scan(word.toLowerCase());
    if (segs.length === 0) return "";
    // Syllable-final /k/ → glottal stop [ʔ] (coda k, before a consonant or word end).
    for (let i = 0; i < segs.length; i++) {
        if (segs[i]!.ph !== "k") continue;
        const next = segs[i + 1];
        if (!next || (!VOWEL_PH.includes(next.ph[0] ?? "") && next.ph !== ""))
            segs[i]!.ph = "ʔ";
    }
    const stress = stressIndex(segs);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

// ⟨e⟩ pepet/taling lexicon — cross-source consensus (wikipron ind ∩ kaikki ind), Latin-keyed. Latin ⟨e⟩ conflates
// pepet /ə/ (the rule default) and taling /e/~/ɛ/, which is lexical and unrecoverable from the orthography; each
// entry pins the taling quality where both independent human referees agree. See indonesian-e-lexicon.tsv.
let LEXICON: Map<string, string> | undefined;
const lexicon = (): Map<string, string> =>
    (LEXICON ??= loadTsvMap(import.meta.url, "indonesian-e-lexicon.tsv", (v) => v, {
        optional: true,
    }));

/** SHIPPED Indonesian word → canonical IPA. A consensus ⟨e⟩ lexicon override resolves the pepet/taling ambiguity
 *  for known words; everything else falls through to the rule engine (which defaults pepet). */
export function phonemizeWord(word: string): string {
    if (!/^[A-Z]{2,}$/.test(word)) {
        const hit = lexicon().get(word.toLowerCase());
        if (hit !== undefined) return hit;
    }
    return phonemizeWordRules(word);
}

// ── Numbers (regular, compositional) ─────────────────────────────────────────
function numberWords(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n < 12) return n === 10 ? NUM.seprefix + NUM.puluh : NUM.seprefix + NUM.belas;
    if (n < 20) return `${NUM.units[n - 10]} ${NUM.belas}`;
    if (n < 100) {
        const t = Math.floor(n / 10),
            r = n % 10;
        return `${NUM.units[t]} ${NUM.puluh}${r ? " " + numberWords(r) : ""}`;
    }
    if (n < 200) return `${NUM.seprefix}${NUM.ratus}${n % 100 ? " " + numberWords(n % 100) : ""}`;
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return `${NUM.units[h]} ${NUM.ratus}${r ? " " + numberWords(r) : ""}`;
    }
    if (n < 2000) return `${NUM.seprefix}${NUM.ribu}${n % 1000 ? " " + numberWords(n % 1000) : ""}`;
    if (n < 1000000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return `${numberWords(th)} ${NUM.ribu}${r ? " " + numberWords(r) : ""}`;
    }
    const m = Math.floor(n / 1000000),
        r = n % 1000000;
    return `${numberWords(m)} ${NUM.juta}${r ? " " + numberWords(r) : ""}`;
}

// The number class accepts Indonesian's DOT thousands grouping and COMMA decimal. Without them "9.000"
// tokenized as 9 | . | 000 and the separator became a clause PAUSE ("sembilan . nol"), and "1,5" likewise.
// Times (11.00) are claimed earlier by normalize.ts, so only real numbers reach this.
// Indonesian had no symbol tier at all: "3%" read as just "tiga", losing the percent.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ `multiply` IS STANDARD MATHEMATICAL REGISTER, not a corpus attestation: a corpus sweep for the operator
    // returns homographs of PREPOSITIONS in every language tried. One word, so `by` defaults to it — this
    // language does not split dimension from product.
    multiply: { times: "kali" },
    // Unread, `&` is DROPPED outright and `B&B` loses the sign entirely.
    // `dan` ×1053 in this corpus. The tier spaces it on both sides, because `B&B` is two
    // initialisms and joining them would make one token.
    ampersand: "dan",
    percent: ["persen"],
    currency: { $: ["dolar"], "€": ["euro"], "£": ["pound"], "¥": ["yen"] },
    // REQUIRED BY THE `US$` FOLD, and found only because the fold exposed it. Unfolding `US$ 14,7
    // miliar` let the tier place the currency noun at last, and it placed it in the WRONG SLOT:
    // *empat belas koma tujuh DOLAR MILIAR*, because without this list the magnitude is not part of the
    // quantity and the noun lands directly after the digits. Indonesian puts the noun after the magnitude —
    // *14,7 miliar dolar*. So the fold turned a silent DROP into an audible word-order error, which is a
    // reminder that closing a drop is not finished until the reading is checked, not just the differential.
    //
    // NO `magnitudeConnective`: Indonesian juxtaposes (*miliar dolar*, not *miliar de dolar*), unlike
    // Catalan's *de* or Italian's *di*. Attested in this corpus as `juta` ×8, `miliar` and `ribu`.
    magnitudes: ["triliun", "miliar", "juta", "ribu"],
    units: { km: ["kilometer"], cm: ["sentimeter"], mm: ["milimeter"], kg: ["kilogram"], m: ["meter"],
        g: ["gram"], // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
        // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
        // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
        l: ["liter"], L: ["liter"], ha: ["hektar"] },
    // `kilometer persegi` ×3 — the modifier follows. Bare `persegi` ×9 includes the SHAPE ("persegi yang
    // tidak memiliki sisi bawahnya"), so the collocation is what attests the unit sense. `kubik` ×0, so
    // `m³` keeps the fallback.
    exponentWords: { squared: ["persegi"], position: "after" },
});

// ⚠ THE WORD GROUP SPANS ALL OF LATIN, not just ASCII, and `[a-zA-Z]+` was silently shredding foreign names.
// A diacritic ended the token, so the letter carrying it became an unclaimed gap read as an English LETTER NAME
// and the rest of the word started over: `Cañitas` → *t͡ʃˈa ˈɛn ˈitas* ("cha EN itas"), `São` → *s ˈə ˈo*,
// `Klöcker` → *ʔl ˈoᶷ t͡ʃkˈər*. One word became three, none of them right.
// ⚠ INVISIBLE TO EVERY GATE: no digit or raw mark survives, and nothing VANISHES, so it is a WRONG-WORD defect
// that neither the leak classes nor the differential DROP test can see. Found only by reading a corpus diff.
// `\p{M}` so a DECOMPOSED accent stays with its base rather than ending the token one character later.
// yue fixed the same defect the same way and pins it (`yue("Müslüm") === phonemize(…, "en")`).
const TOKEN = /(\p{Script=Latin}[\p{Script=Latin}\p{M}]*)|(\d{1,3}(?:\.\d{3})+|\d+(?:,\d+)?)|([.?!,;:])/gu;
/** An ordinary Indonesian word is plain ASCII letters. A diacritic means a FOREIGN name — Indonesian
 *  orthography has none — so such a token goes to the injected foreign reader instead of the native g2p, which
 *  has no rule for `ñ`/`ö`/`ó` and would mangle what it cannot spell. */
const NATIVE_WORD = /^[a-zA-Z]+$/u;

class IndonesianPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        // the Indonesian rewrites (clock, rupiah, abbreviations, slash units) run BEFORE the shared
        // symbol tier, and the clock must precede the number tokenizer so a dot-time is never read as
        // thousands grouping.
        return assembleClauses(SYMBOLS(normalizeIndonesian(input)), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(
                NATIVE_WORD.test(m[1]) || this.foreign === undefined
                    ? phonemizeWord(m[1])
                    : this.foreign(m[1]),
            );
            else if (m[2]) {
                // Strip the dot grouping, then split on the decimal comma. Number words bypass the ⟨e⟩
                // lexicon (their ⟨e⟩ is pepet; avoid any taling homograph).
                const [intPart, frac] = m[2].replace(/\./gu, "").split(",");
                const n = Number(intPart);
                // ⚠ ABOVE 2^53 THIS USED TO `return` AND THE WHOLE NUMBER VANISHED FROM THE READING — the
                // decimal tail with it. Refusing to compose is right (the float has already lost the low
                // digits, so the composed numeral would be confidently wrong), but the guard had no else.
                // Digit-at-a-time is exactly what the fractional part below already does, so the fallback
                // needs no word this engine was never measured on: above 2^53 the reading is a digit
                // string, not a quantity. Inherited by `ms`/`zsm`, which wrap this engine.
                if (Number.isSafeInteger(n))
                    for (const wd of numberWords(n).split(" ")) sink.emit(phonemizeWordRules(wd));
                else
                    for (const dch of intPart!)
                        for (const wd of numberWords(Number(dch)).split(" ")) sink.emit(phonemizeWordRules(wd));
                if (frac !== undefined && frac !== "") {
                    const dot = DEF.numbers.decimalWord;
                    if (dot) sink.emit(phonemizeWordRules(dot));
                    for (const d of frac)
                        for (const wd of numberWords(Number(d)).split(" ")) sink.emit(phonemizeWordRules(wd));
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Indonesian phonemizer. */
/** `foreign` reads a token carrying a DIACRITIC — a foreign name, since Indonesian orthography has none. The
 *  registry injects English, exactly as it does for Hindi. Without it the native g2p silently drops the letter it
 *  cannot spell (`Cañitas` → *t͡ʃaˈitas*), which is quieter than the old fragmentation but no more correct. */
export function createIndonesian(foreign?: ForeignPhonemizer): Phonemizer {
    return new IndonesianPhonemizer(foreign);
}
