/**
 * Tajik / тоҷикӣ (tg) phonemizer — canonical IPA, espeak-independent. A variety of Persian (Iranian, SW) in the
 * CYRILLIC alphabet, which writes all its vowels → a near-phonemic left-to-right scan with NO short-vowel
 * restoration (the wall that keeps our Perso-Arabic `fa` at 🟡). The letter→IPA tables are DATA (tajik.jsonc);
 * the code here is the scan (word-initial / post-vowel е→je, iotated ё/ю/я, the six-vowel system, the special
 * Cyrillic letters ғ қ ҳ ҷ ӣ ӯ ъ), Persian FINAL stress, a cardinal-number compositor, and the tokenizer.
 * Validated against wikipron tgk_cyrl (broad + narrow, human) + epitran tgk-Cyrl.
 * See docs/investigations/tg_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface TajikDef {
    vowels: Record<string, string>;
    glides: Record<string, string>;
    consonants: Record<string, string>;
    numbers: {
        units: string[];
        teens: string[];
        tens: Record<string, string>;
        hundred: string;
        thousand: string;
        million: string;
        and: string;
    };
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<TajikDef>(import.meta.url, "tajik.jsonc");
const VOWEL = DEF.vowels;
const GLIDE = DEF.glides;
const CONS = DEF.consonants;
const CLAUSE_MARK = DEF.clausePunctuation;
const VOWEL_LETTERS = new Set(Object.keys(VOWEL));

interface Seg {
    ph: string;
    nucleus: boolean;
}

/** Tajik word → IPA segment list (nucleus flags drive final stress). */
function toSegments(word: string): Seg[] {
    const chars = [...word.toLowerCase()];
    const segs: Seg[] = [];
    let prevWasVowel = false; // for е→je after a vowel / word-initially
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i]!;
        if (VOWEL_LETTERS.has(c)) {
            // е (and э) → [je] word-initially or after another vowel (hiatus); → [e] after a consonant.
            if ((c === "е" || c === "э") && (i === 0 || prevWasVowel)) {
                segs.push({ ph: "j", nucleus: false });
            }
            // Hiatus glide: и/ӣ after another vowel takes a [j] onset (Саид→sajid, Душанбеи→duʃanbeji).
            else if ((c === "и" || c === "ӣ") && prevWasVowel) {
                segs.push({ ph: "j", nucleus: false });
            }
            segs.push({ ph: VOWEL[c]!, nucleus: true });
            prevWasVowel = true;
            continue;
        }
        if (c in GLIDE) {
            const ph = GLIDE[c]!;
            if (c === "й") {
                segs.push({ ph: "j", nucleus: false });
                prevWasVowel = false;
            } else {
                // ё/ю/я → j + vowel; the vowel is the nucleus.
                for (const p of [...ph])
                    segs.push({ ph: p, nucleus: /[aɔuiɵe]/u.test(p) });
                prevWasVowel = true;
            }
            continue;
        }
        const cons = CONS[c];
        if (cons !== undefined) {
            if (cons !== "") segs.push({ ph: cons, nucleus: false });
            prevWasVowel = false;
        }
        // unknown char (stray latin/punct inside a token) → skip
    }
    return segs;
}

/** One Tajik word → canonical IPA with a single primary-stress mark (Persian final stress). */
export function phonemizeWord(word: string): string {
    const segs = toSegments(word);
    if (segs.length === 0) return "";
    const nucIdx = segs.map((s, i) => (s.nucleus ? i : -1)).filter((i) => i >= 0);
    if (nucIdx.length === 0) return segs.map((s) => s.ph).join(""); // consonant-only (abbreviation)
    const stressIdx = nucIdx[nucIdx.length - 1]!; // FINAL stress
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stressIdx) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

// ── Cardinal numbers — Persian composition with the connector у (va) ─────────────────────────────────────────
const N = DEF.numbers;
/** Compose the Tajik SPELLING of a non-negative integer, then phonemize it (space-separated where appropriate). */
function numberWords(n: number): string {
    if (n === 0) return N.units[0]!;
    const parts: string[] = [];
    const three = (x: number): string[] => {
        const p: string[] = [];
        const h = Math.floor(x / 100);
        const rem = x % 100;
        if (h > 0) p.push(h === 1 ? N.hundred : N.units[h]! + N.hundred); // сад / дусад / сесад …
        if (rem >= 10 && rem < 20) p.push(N.teens[rem - 10]!);
        else {
            const t = Math.floor(rem / 10);
            const u = rem % 10;
            if (t > 0) p.push(N.tens[String(t * 10)]!);
            if (u > 0) p.push(N.units[u]!);
        }
        return p;
    };
    const million = Math.floor(n / 1_000_000);
    const thousand = Math.floor((n % 1_000_000) / 1000);
    const rest = n % 1000;
    if (million > 0) parts.push(...three(million), N.million);
    if (thousand > 0) parts.push(...(thousand === 1 ? [] : three(thousand)), N.thousand);
    if (rest > 0) parts.push(...three(rest));
    // The Persian connector -у (va) glues to the END of the preceding word (бисту як, сесаду чилу панҷ), EXCEPT
    // before a magnitude word, which just follows its multiplier with a space (ду ҳазор, not ду-у ҳазор).
    const MAG = new Set([N.thousand, N.million]);
    let out = parts[0]!;
    for (let i = 1; i < parts.length; i++) {
        out += (MAG.has(parts[i]!) ? " " : "у ") + parts[i]!;
    }
    return out; // space-separated tokens; "бисту" is one token, phonemized bistu
}

const TOKEN = /([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])/gu;

class TajikPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                for (const w of numberWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(w));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Tajik phonemizer (Cyrillic near-phonemic g2p; Persian final stress; cardinal numbers). */
export function createTajik(): Phonemizer {
    return new TajikPhonemizer();
}
