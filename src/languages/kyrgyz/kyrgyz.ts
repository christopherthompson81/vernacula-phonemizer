/**
 * Native Kyrgyz / кыргызча (ky) text phonemizer — canonical IPA. Turkic (Kipchak), Cyrillic.
 * Kyrgyz Cyrillic is a shallow near-1:1 orthography with STRICT, SPELLED vowel harmony, so this is a left-to-right
 * scan (kyrgyz.jsonc = the letter tables) with three code rules: (1) VELAR/UVULAR harmony — ⟨к⟩→[q]/⟨г⟩→[ʁ] next to a
 * BACK vowel (а о у ы), [k]/[ɡ] next to a FRONT vowel (Kyrgyz does not spell this, unlike Kazakh қ/ғ); (2) dark ⟨л⟩→[ɫ]
 * by the same back-harmony, clear [l] by front; (3) LONG vowels — a doubled vowel is [Vː] (тоо→toː, Айсулуу→ɑjsuluː).
 * The governing vowel for (1)/(2) is the NEAREST vowel (the following one if any, else the preceding: Баткен→batken —
 * к is [k] before front е though the word also has back а). Signatures: ⟨ж⟩→[d͡ʒ], ⟨ң⟩→[ŋ], ⟨а⟩=ɑ, ⟨ы⟩=ɯ, ⟨ө⟩=ø, ⟨ү⟩=y.
 * Stress is final-syllable (Turkic default; unmarked in the referee → folded).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, spellDigits, type NumbersDef } from "../../core/numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { normalizeKyrgyz } from "./normalize.ts";

const DEF = MANIFEST;
const CLAUSE_MARK = DEF.clausePunctuation;
const V = DEF.vowels;
const BACK = new Set([...DEF.backVowels]);
const isVowelLetter = (c: string): boolean => c in V;

/** The backness of the vowel GOVERNING a к/г/л at index i. A CODA (a vowel directly before, none directly after) is
 *  governed by that PRECEDING vowel (ак→aq); otherwise (onset / intervocalic / cluster) by the nearest FOLLOWING vowel,
 *  else the nearest preceding (Баткен→batken: к is an onset before front е though the word also has back а). Returns
 *  true = back (uvular/dark), false = front (velar/clear); defaults to front if the word has no vowel. */
function backHarmony(chars: string[], i: number): boolean {
    if (isVowelLetter(chars[i - 1] ?? "") && !isVowelLetter(chars[i + 1] ?? "")) return BACK.has(chars[i - 1]!); // coda
    for (let k = i + 1; k < chars.length; k++) if (isVowelLetter(chars[k]!)) return BACK.has(chars[k]!);
    for (let k = i - 1; k >= 0; k--) if (isVowelLetter(chars[k]!)) return BACK.has(chars[k]!);
    return false;
}

/** One Kyrgyz word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const chars = [...word.toLowerCase()];
    const out: string[] = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        // LONG vowel: a doubled vowel letter → [Vː]
        if (isVowelLetter(c) && chars[i + 1] === c) { out.push(V[c]! + "ː"); i++; continue; }
        if (isVowelLetter(c)) { out.push(V[c]!); continue; }
        // velar/uvular harmony: ⟨к⟩→q/⟨г⟩→ʁ (back) vs k/ɡ (front)
        if (c === "к") { out.push(backHarmony(chars, i) ? "q" : "k"); continue; }
        if (c === "г") { out.push(backHarmony(chars, i) ? "ʁ" : "ɡ"); continue; }
        // dark-l harmony: ⟨л⟩→ɫ (back) vs l (front)
        if (c === "л") { out.push(backHarmony(chars, i) ? "ɫ" : "l"); continue; }
        // ⟨б⟩ lenites to the bilabial fricative [β] between two vowels (добулбас→doβulbas, обон→oβon)
        if (c === "б" && isVowelLetter(chars[i - 1] ?? "") && isVowelLetter(chars[i + 1] ?? "")) { out.push("β"); continue; }
        const io = DEF.iotated[c];
        if (io !== undefined) { out.push(...io); continue; }
        const cons = DEF.consonants[c];
        if (cons !== undefined) out.push(cons);
        // else: ъ/ь and unknown chars → skip
    }
    return out.join("");
}

/** Turkic decimal composition: tens + units + hundred/thousand/million/billion, all SPACE-separated
 *  (жыйырма бир = 21).
 *
 *  ⚠ THE HUNDRED-MULTIPLIER OMITS A LEADING 1 AND THE THOUSAND-MULTIPLIER DOES NOT — жүз, but **бир** миң.
 *  This used to omit both, so every year in the language read one word short. ky.wikipedia settles it in two
 *  independent places: its YEAR ARTICLES gloss the digits with the spelled ordinal — «1989 (бир миң тогуз жүз
 *  сексен тогузунчу) жыл», «1914 (бир миң тогуз жүз он төртүнчү) жыл» — and its orthography article's §49
 *  numeral list writes «он беш, бир миң тогуз жүз токсон беш» beside «жүз элүү эки», i.e. `бир` before миң
 *  and nothing before жүз, in one sentence. 6 articles carry `бир миң тогуз жүз`; the bare `миң тогуз жүз`
 *  is 7, and 6 of those 7 ARE these same articles. */
function kyrgyzNumberWords(n: number, d: NumbersDef): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10) * 10;
        const u = n % 10;
        return [d.tens[String(t)]!, ...(u ? [d.units[u]!] : [])]; // tens includes "10" (он)
    }
    if (n < 1000) {
        const h = Math.floor(n / 100);
        const r = n % 100;
        return [...(h > 1 ? [d.units[h]!] : []), d.magnitudes.hundred, ...(r ? kyrgyzNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000);
        const r = n % 1000;
        return [...kyrgyzNumberWords(th, d), d.magnitudes.thousand, ...(r ? kyrgyzNumberWords(r, d) : [])];
    }
    if (n < 1_000_000_000) {
        const m = Math.floor(n / 1_000_000);
        const r = n % 1_000_000;
        return [...kyrgyzNumberWords(m, d), d.magnitudes.million!, ...(r ? kyrgyzNumberWords(r, d) : [])];
    }
    const b = Math.floor(n / 1_000_000_000);
    const r = n % 1_000_000_000;
    return [...kyrgyzNumberWords(b, d), d.magnitudes.billion!, ...(r ? kyrgyzNumberWords(r, d) : [])];
}

/**
 * Integer → its Kyrgyz cardinal in ORTHOGRAPHY, space-separated. This is what `normalize.ts` needs and what
 * the tokenizer cannot give it: an ordinal suffix, a case suffix and a fraction denominator all attach to
 * the LAST WORD of a spoken numeral, and a digit run has no last word until it has been composed (playbook
 * trap 14). The words are emitted back as TEXT and phonemized by the ordinary word path, so nothing here
 * reaches the phoneme sink as a spelling (trap 6).
 *
 * Bounded at 10¹² because that is where `NumbersDef` stops carrying a magnitude; above it the caller must
 * fall back to leaving the digits alone rather than emitting a partial numeral.
 */
export function numberWords(n: number): string | undefined {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1_000_000_000_000) return undefined;
    return kyrgyzNumberWords(n, DEF.numbers).filter((w): w is string => w !== null && w !== "").join(" ");
}

function number(digits: string): string {
    const n = Number(digits);
    // ⚠ ABOVE 2^53 THE RAW ASCII DIGITS USED TO LEAK STRAIGHT INTO THE IPA. `isSafeInteger` is right to
    // refuse to COMPOSE — the float has already lost the low digits, so the numeral would be confidently
    // wrong — but the refusal returned the digit string, which no g2p in this fleet reads. Read it out
    // digit-at-a-time through this engine's own number words instead; see core/numbers.ts `spellDigits`
    // for the full account and the cost (above 2^53 the reading is a digit string, not a quantity).
    if (!Number.isSafeInteger(n)) return spellDigits(digits, DEF.numbers, phonemizeWord);
    return renderNumber(n, DEF.numbers, phonemizeWord, (m) => kyrgyzNumberWords(m, DEF.numbers));
}

const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.?!,;:…—])/gu;

class KyrgyzPhonemizer implements Phonemizer {
    text(input: string): string {
        // TEXT NORMALIZATION runs first and is pure text→text — see normalize.ts for the rules, their order
        // and the counts behind each. Everything below it sees only Cyrillic words, digits and clause marks.
        return assembleClauses(normalizeKyrgyz(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Kyrgyz phonemizer. */
export function createKyrgyz(): Phonemizer {
    return new KyrgyzPhonemizer();
}
