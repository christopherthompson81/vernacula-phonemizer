/**
 * Tatar (tt) phonemizer — Татар теле, Kipchak Turkic, CYRILLIC script (official), canonical IPA.
 * Cyrillic grapheme scan with VOWEL-HARMONY backing: ⟨к⟩→[q]/[г]→[ʁ] next to a BACK vowel
 * (ак→ɑq, җомга→d͡ʒomʁɑ), but [k]/[ɡ] next to a FRONT vowel (көз→køz). 9 vowels with the special letters ⟨ә⟩→[æ],
 * ⟨ө⟩→[ø], ⟨ү⟩→[y], ⟨ы⟩→[ɨ]; the iotated ⟨я ю е ё⟩; the Kazan-standard fricatives ⟨җ⟩→[ʑ] / ⟨ч⟩→[ɕ], ⟨ң⟩→[ŋ], ⟨һ⟩→[h]. Word-final
 * (oxytone) stress, the Turkic default. THIN single-source (kaikki).
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface TatarDef {
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    iotated: Record<string, string>;
}
const DEF = loadManifest<TatarDef>(import.meta.url, "tatar.jsonc");
// Letter → IPA tables (tatar.jsonc). The harmony-conditioned ⟨к г а⟩ and iotating ⟨е⟩ are handled in the scan.
const CONS = DEF.consonants;
// Cyrillic vowel letters — for the word-initial/post-vocalic ⟨е⟩→[je] iotation.
const CYR_VOWEL = new Set(["а", "ә", "о", "ө", "у", "ү", "ы", "и", "е", "э", "я", "ю", "ё"]);
const STRESS_NASAL = new Set(["m", "n", "ŋ"]);
/** Sonority for maximal-onset stress: vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0. */
function sonority(seg: string): number {
    if ([...seg].some((c) => IPA_VOWEL.has(c))) return 6;
    if (seg === "j" || seg === "w") return 5;
    if (["l", "r"].includes(seg)) return 4;
    if (STRESS_NASAL.has(seg)) return 3;
    if (seg.includes("͡")) return 1;
    if (["f", "v", "s", "z", "ʃ", "ʒ", "ɕ", "ʑ", "x", "χ", "h", "ʁ", "ɣ"].includes(seg)) return 2;
    return 0;
}
const VOWEL = DEF.vowels;
const IOTATED = DEF.iotated;
// Backness for the к/г harmony: a nearby BACK vowel → [q]/[ʁ]; a FRONT vowel → [k]/[ɡ].
const BACK = new Set(["а", "о", "у", "ы", "я", "ю", "ё"]);
const FRONT = new Set(["ә", "ө", "ү", "е", "э", "и"]);
const IPA_VOWEL = new Set(["ɑ", "a", "æ", "o", "ø", "u", "y", "ɨ", "i", "e"]);

/** Is the nearest vowel to position `i` (scanning outward) a BACK vowel? Defaults to back (Turkic default). */
function nearBack(chars: string[], i: number): boolean {
    for (let d = 1; d < chars.length; d++) {
        for (const j of [i - d, i + d]) {
            const c = chars[j];
            if (c === "а") continue; // ⟨а⟩ is harmony-neutral for к/г backing — its own quality is decided by harmony
            if (c && BACK.has(c)) return true;
            if (c && FRONT.has(c)) return false;
        }
    }
    return true;
}

/** Phonemize one Tatar (Cyrillic) word → canonical IPA: harmony-aware grapheme scan + word-final stress. */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const chars = [...w];
    // Vowel harmony: a word with any FRONT vowel ⟨ә ө ү е и э⟩ fronts its ⟨а⟩ → [a] (else the back [ɑ]).
    const frontWord = /[әөүеиэ]/u.test(w);
    const segs: string[] = [];
    chars.forEach((ch, i) => {
        if (ch === "к") segs.push(nearBack(chars, i) ? "q" : "k");
        else if (ch === "г") segs.push(nearBack(chars, i) ? "ʁ" : "ɡ");
        else if (ch === "а") segs.push(frontWord ? "a" : "ɑ");
        else if (ch === "е") segs.push(i === 0 || CYR_VOWEL.has(chars[i - 1]!) ? "je" : "e"); // word-initial / post-vocalic ⟨е⟩ → [je]
        else if (CONS[ch] !== undefined) segs.push(CONS[ch]!);
        else if (IOTATED[ch] !== undefined) segs.push(IOTATED[ch]!);
        else if (VOWEL[ch] !== undefined) segs.push(VOWEL[ch]!);
        else if (ch === "ъ") segs.push("ʔ"); // hard sign — glottal / hiatus
        // ь (soft sign) and other marks: dropped
    });
    // Word-final (oxytone) stress — the Turkic default: ˈ before the MAXIMAL onset of the last vowel's syllable
    // (native Tatar has no onset clusters; loans do — спорт→ˈsport).
    const isV = (s: string): boolean => [...s].some((c) => IPA_VOWEL.has(c));
    const vidx = segs.map((s, idx) => (isV(s) ? idx : -1)).filter((x) => x >= 0);
    if (vidx.length) {
        const nucleus = vidx[vidx.length - 1]!;
        let at = nucleus;
        if (at > 0 && !isV(segs[at - 1]!)) at--; // the immediate onset consonant
        while (at > 0 && !isV(segs[at - 1]!)) {
            const p = segs[at - 1]!,
                l = segs[at]!;
            // obstruent + liquid/glide (loan pl/kr) or fricative + stop (sp/st) — Turkic has NO native onset clusters,
            // and no nasal+stop onsets (a medial nasal is a coda, e.g. якшәмбе's ⟨мб⟩), so those two suffice.
            const obstruentLiquid = sonority(p) <= 2 && sonority(l) >= 4;
            const sibilantStop = ["s", "ʃ", "ɕ"].includes(p) && sonority(l) <= 1; // the sC- onsets (спорт→sp), voiceless sibilant only
            if (!(obstruentLiquid || sibilantStop)) break;
            at--;
        }
        segs.splice(at, 0, "ˈ");
    }
    return segs.join("").normalize("NFC");
}

/** A digit run → spoken Tatar, phonemized through the same Cyrillic g2p (see numbers.ts for the data + provenance). */
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n)) return digits;
    return numberToWords(n).map(phonemizeWord).join(" ");
}

// A word (Tatar Cyrillic letters) / number / punctuation token.
const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class TatarPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(number(m[2]));
            else if (m[3]) sink.pause(m[3] === "." || m[3] === "!" || m[3] === "?" ? m[3] : ",");
        });
    }
}

/** Build the Tatar phonemizer (Cyrillic g2p + harmony-driven к/г backing + final stress). */
export function createTatar(): Phonemizer {
    return new TatarPhonemizer();
}
