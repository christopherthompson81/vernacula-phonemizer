/**
 * Native Macedonian / македонски (mk) text phonemizer — canonical IPA, espeak-independent. South Slavic, Cyrillic.
 * Macedonian is fully phonemic with NO vowel reduction, so a left-to-right grapheme scan + the shared South-Slavic
 * phonotactics recovers the pronunciation. Macedonian specifics vs Bulgarian: the palatals are DISTINCT LETTERS
 * (ѓ ќ љ њ ѕ џ ј → ɟ c ʎ ɲ d͡z d͡ʒ j — no ь/я/ю palatalization), and STRESS is FIXED on the ANTEPENULT syllable
 * (predictable → emitted). Rules: dark-l (⟨л⟩→[l] before е/и/ј, [ɫ] else), syllabic ⟨р⟩→[r̩], n→ŋ before a velar,
 * word-final devoicing, regressive voicing assimilation. See docs/investigations/mk_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToText } from "./numbers.ts";
import { normalizeMacedonian, normalizeMacedonianInitialisms } from "./normalize.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teens: string[];
    tens: Record<string, string>;
    hundreds: Record<string, string>;
    thousand: string;
    thousands: string;
    million: string;
    millions: string;
    and: string;
}
interface MacedonianDef {
    letters: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<MacedonianDef>(import.meta.url, "macedonian.jsonc");
const L = DEF.letters;
const CLAUSE_MARK = DEF.clausePunctuation;

/**
 * Macedonian count form: SINGULAR when the number's last digit is 1 (not 11), else PLURAL. Macedonian has
 * no paucal — 2 километри and 5 километри are the same form — so it is two-way, unlike Russian's three.
 * This differs from the default countForm (n===1) on compounds: 21 километар, 22 километри, 11 километри.
 */
const mkCountForm = (n: number): number => {
    const m = Math.abs(n) % 100;
    return m % 10 === 1 && m !== 11 ? 0 : 1;
};

// #562 symbol normalization — Macedonian. Percent/currency/units/rates carry the count form above
// (1 процент, 2 проценти; 1 километар, 2 километри). Units are written BOTH ways — Cyrillic кm and Latin
// km are equally common in the corpus — so both scripts are declared. The rate denominator is "на час"
// (per hour) but "во секунда" (per second), which the keyed unitPer expresses.
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — the word is this language's OWN, harvested from its existing `×` rule, so nothing new
    // is sourced. Declaring it HERE is what makes ASCII `x` read like `×`: `6x6 cm` was reading the `x` as a
    // LETTER NAME, and `NxN` forms outnumber `×` roughly 85 to 20 across the corpora. One word, so `by` is
    // omitted and defaults to it — this language does not split dimension from product.
    multiply: { times: "пати" },
    percent: ["процент", "проценти"],
    currency: {
        "$": ["долар", "долари"],
        "¥": ["јен", "јени"],
        "€": ["евро", "евра"],
        "£": ["фунта", "фунти"],
    },
    magnitudes: ["милијарди", "милиони"],
    units: {
        км: ["километар", "километри"], km: ["километар", "километри"],
        м: ["метар", "метри"], m: ["метар", "метри"],
        см: ["сантиметар", "сантиметри"], cm: ["сантиметар", "сантиметри"],
        мм: ["милиметар", "милиметри"], mm: ["милиметар", "милиметри"],
    },
    exponentWords: {
        squared: ["квадратен", "квадратни"],
        cubed: ["кубен", "кубни"],
        position: "before",
    },
    unitPer: { h: "на", ч: "на", s: "во", с: "во" },
    rateDenominators: { h: "час", ч: "час", s: "секунда", с: "секунда" },
    countForm: mkCountForm,
});

const VOWELS = new Set([..."aɛiɔu"]);
const FRONT_L = new Set(["е", "и", "ј"]); // ⟨л⟩ is light [l] before these, dark [ɫ] elsewhere
// Voiced obstruent → voiceless (final devoicing + regressive assimilation before a voiceless obstruent).
const DEVOICE: Record<string, string> = { b: "p", v: "f", ɡ: "k", d: "t", ʒ: "ʃ", z: "s", "d͡ʒ": "t͡ʃ", "d͡z": "t͡s", ɟ: "c" };
const VOICE: Record<string, string> = Object.fromEntries(Object.entries(DEVOICE).map(([k, v]) => [v, k]));
const VOICELESS = new Set([...Object.values(DEVOICE), "x"]); // the voiceless obstruents (DEVOICE values) + ⟨х⟩

const isVowel = (t: string): boolean => t !== "" && VOWELS.has(t);
const isNucleus = (t: string): boolean => isVowel(t) || t === "r̩"; // the syllabic р counts as a nucleus for stress

/** Scan a lowercased Macedonian word into IPA phoneme tokens (dark-l in code, every other letter from the table). */
function scan(word: string): string[] {
    const chars = [...word.toLowerCase()];
    const toks: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        if (c === "л") {
            toks.push(FRONT_L.has(chars[i + 1] ?? "") ? "l" : "ɫ");
        } else {
            const ph = L[c];
            if (ph !== undefined) toks.push(ph);
        }
    }
    return toks;
}

/** Syllabic ⟨р⟩: an [r] with no vowel-token neighbour becomes [r̩] (прст→pr̩st, Грк→ɡr̩k). */
function syllabicR(toks: string[]): void {
    for (let k = 0; k < toks.length; k++) {
        if (toks[k] !== "r") continue;
        const left = k > 0 && isVowel(toks[k - 1]!);
        const right = k + 1 < toks.length && isVowel(toks[k + 1]!);
        if (!left && !right) toks[k] = "r̩";
    }
}

/** The shared South-Slavic consonant post-rules: n→ŋ before a velar, word-final devoicing, regressive voicing. */
function applyPhonotactics(toks: string[]): void {
    // н → ŋ before a velar stop к/ɡ.
    for (let k = 0; k < toks.length - 1; k++)
        if (toks[k] === "n" && (toks[k + 1] === "k" || toks[k + 1] === "ɡ")) toks[k] = "ŋ";
    // Word-final devoicing (град→ɡrat, нож→nɔʃ, ѕид→d͡zit).
    const last = toks.length - 1;
    if (last >= 0 && toks[last]! in DEVOICE) toks[last] = DEVOICE[toks[last]!]!;
    // Regressive voicing assimilation (right-to-left). /v/ is voicing-transparent as [v] (does not trigger), but once
    // it devoices to [f] before a voiceless obstruent that [f] triggers the preceding one.
    for (let k = toks.length - 2; k >= 0; k--) {
        const b = toks[k]!, nb = toks[k + 1]!;
        if (nb === "v") continue;
        if (b in DEVOICE && VOICELESS.has(nb)) toks[k] = DEVOICE[b]!;
        else if (b in VOICE && nb in DEVOICE) toks[k] = VOICE[b]!;
    }
    // Sibilant assimilation: с/з → ʃ before a postalveolar ʃ/t͡ʃ.
    for (let k = 0; k < toks.length - 1; k++)
        if ((toks[k] === "s" || toks[k] === "z") && (toks[k + 1] === "ʃ" || toks[k + 1] === "t͡ʃ")) toks[k] = "ʃ";
}

/** Assemble the tokens with the fixed ANTEPENULT stress: ˈ before the 3rd-from-last nucleus (penult in disyllables,
 *  the sole nucleus in monosyllables). */
function withStress(toks: string[]): string {
    const nuclei = toks.map((t, i) => (isNucleus(t) ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return toks.join("");
    const stressIdx = nuclei[Math.max(0, nuclei.length - 3)]!;
    let out = "";
    for (let i = 0; i < toks.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += toks[i]!;
    }
    return out;
}

/** Phonemize a single Macedonian word to canonical IPA with antepenultimate stress. */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    syllabicR(toks);
    applyPhonotactics(toks);
    return withStress(toks);
}

// ── Numbers (decimal; Macedonian) ─────────────────────────────────────────────
/** One number token → its words, phonemized. The composer lives in numbers.ts (shared with normalize.ts). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToText(n).split(" ").filter(Boolean).map(phonemizeWord).join(" ");
}

// A word (Macedonian Cyrillic) / number / punctuation token. The number carries its DECIMAL COMMA
// (Macedonian's decimal mark) so the comma is not read as clause punctuation — `6,5` was coming out as a
// phrase break between "шест" and "пет". A 3-digit block after the comma is GROUPING, not a fraction (the
// corpus's "1,400 луѓе" is fourteen hundred), so it is read as one number; 1–2 digits are a decimal.
const TOKEN = /([а-шА-ШѓѕјљњќџЃЅЈЉЊЌЏѐѝЀЍ]+)|(\d+(?:,\d+)?)|([.!?…,;:—])/gu;

class MacedonianPhonemizer implements Phonemizer {
    text(input: string): string {
        // #562 order: Macedonian rewrites (grouping, ordinals, century/date, clock, ranges, signs) →
        // INITIALISMS (after abbreviations, so `Д-р` is not spelled DE-ER) → the shared symbol tier last
        // (it needs the number still adjacent to its unit/sign). Roman numerals arrive already converted
        // at the registry seam, so regnal "Лиалофи III" is "3" by the time normalize runs.
        const normalized = SYMBOLS(normalizeMacedonianInitialisms(normalizeMacedonian(input)));
        return assembleClauses(normalized, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const [intPart, frac] = m[2].split(",");
                if (frac !== undefined && frac.length === 3) {
                    // "1,400" is 1400 — a grouped thousand, read as one number.
                    for (const wd of numberToText(Number(`${intPart}${frac}`)).split(" "))
                        sink.emit(phonemizeWord(wd));
                } else {
                    for (const wd of numberToText(Number(intPart)).split(" "))
                        sink.emit(phonemizeWord(wd));
                    if (frac !== undefined) {
                        sink.emit(phonemizeWord("запирка")); // the Macedonian name of the decimal comma
                        for (const d of frac)
                            for (const wd of numberToText(Number(d)).split(" "))
                                sink.emit(phonemizeWord(wd));
                    }
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Macedonian phonemizer (phonemic g2p + antepenultimate stress + composed numbers). */
export function createMacedonian(): Phonemizer {
    return new MacedonianPhonemizer();
}
