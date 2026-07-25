/**
 * Native Kyrgyz / кыргызча (ky) text phonemizer — canonical IPA, espeak-independent. Turkic (Kipchak), Cyrillic.
 * Kyrgyz Cyrillic is a shallow near-1:1 orthography with STRICT, SPELLED vowel harmony, so this is a left-to-right
 * scan (kyrgyz.jsonc = the letter tables) with three code rules: (1) VELAR/UVULAR harmony — ⟨к⟩→[q]/⟨г⟩→[ʁ] next to a
 * BACK vowel (а о у ы), [k]/[ɡ] next to a FRONT vowel (Kyrgyz does not spell this, unlike Kazakh қ/ғ); (2) dark ⟨л⟩→[ɫ]
 * by the same back-harmony, clear [l] by front; (3) LONG vowels — a doubled vowel is [Vː] (тоо→toː, Айсулуу→ɑjsuluː).
 * The governing vowel for (1)/(2) is the NEAREST vowel (the following one if any, else the preceding: Баткен→batken —
 * к is [k] before front е though the word also has back а). Signatures: ⟨ж⟩→[d͡ʒ], ⟨ң⟩→[ŋ], ⟨а⟩=ɑ, ⟨ы⟩=ɯ, ⟨ө⟩=ø, ⟨ү⟩=y.
 * Stress is final-syllable (Turkic default; unmarked in the referee → folded). See docs/investigations/ky_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { renderNumber, type NumbersDef } from "../../core/numbers.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface KyrgyzDef {
    vowels: Record<string, string>;
    backVowels: string;
    iotated: Record<string, string>;
    consonants: Record<string, string>;
    numbers: NumbersDef & { tens: string[]; hundred: string; thousand: string; million: string };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<KyrgyzDef>(import.meta.url, "kyrgyz.jsonc");
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

/** Turkic decimal composition: tens + units + hundred/thousand/million, all SPACE-separated (жыйырма бир = 21). */
function kyrgyzNumberWords(n: number, d: KyrgyzDef["numbers"]): (string | null)[] {
    if (n < 10) return [d.units[n]!];
    if (n < 100) {
        const t = Math.floor(n / 10);
        const u = n % 10;
        return [d.tens[t]!, ...(u ? [d.units[u]!] : [])];
    }
    if (n < 1000) {
        const h = Math.floor(n / 100);
        const r = n % 100;
        return [...(h > 1 ? [d.units[h]!] : []), d.hundred, ...(r ? kyrgyzNumberWords(r, d) : [])];
    }
    if (n < 1_000_000) {
        const th = Math.floor(n / 1000);
        const r = n % 1000;
        return [...(th > 1 ? kyrgyzNumberWords(th, d) : []), d.thousand, ...(r ? kyrgyzNumberWords(r, d) : [])];
    }
    const m = Math.floor(n / 1_000_000);
    const r = n % 1_000_000;
    return [...kyrgyzNumberWords(m, d), d.million, ...(r ? kyrgyzNumberWords(r, d) : [])];
}

function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return renderNumber(n, DEF.numbers, phonemizeWord, (m) => kyrgyzNumberWords(m, DEF.numbers));
}

const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.?!,;:…—])/gu;

class KyrgyzPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
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
