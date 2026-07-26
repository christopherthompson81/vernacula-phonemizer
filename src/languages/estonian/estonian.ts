/**
 * Estonian (et) phonemizer — eesti keel, Uralic (Finnic), Latin orthography, canonical IPA, espeak-independent.
 * Estonian is nearly as phonemically transparent as its sibling Finnish at the SEGMENT level, so this is a greedy
 * grapheme scan + gemination (a doubled letter → [Cː]/[Vː]) + FIXED first-syllable stress (predictable → emitted).
 * ⟨b d g⟩ are the voiceless-lenis stops → plain b/d/ɡ (the referee's devoicing ring is BACKBONE-stripped); the 9
 * vowels incl. ⟨õ⟩→ɤ; NO n→ŋ before a velar (king→kinɡ). Palatalization + the Q2/Q3 half-long quantity grade are
 * only partially orthographic → not emitted, folded in the referee eval. See docs/investigations/et_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teens: string[];
    tensSuffix: string;
    hundred: string;
    thousand: string;
    million: string;
    millions: string;
}
interface EstonianDef {
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<EstonianDef>(import.meta.url, "estonian.jsonc");
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const N = DEF.numbers;
const VOWEL_LETTERS = new Set([..."aeiouõäöüáéíóúy"]); // + accented loan vowels and loan ⟨y⟩ (→[i])

/** Phonemize a single Estonian word to canonical IPA (segmental + gemination + fixed first-syllable stress). */
export function phonemizeWord(word: string): string {
    const w = word.toLowerCase();
    const segs: { ph: string; vowel: boolean }[] = [];
    for (let i = 0; i < w.length; i++) {
        const c = w[i]!;
        const ph = G[c];
        if (ph === undefined) continue; // unknown char → skip
        const vowel = VOWEL_LETTERS.has(c);
        // A doubled letter → long: a double VOWEL is always long (aa→ɑː); a double CONSONANT is a geminate [Cː] only
        // after a vowel (a true geminate is intervocalic — a doubled consonant after another consonant is a compound
        // boundary CLUSTER, kesk+kool→keskkoːl, not a geminate).
        if (w[i + 1] === c && (vowel || segs[segs.length - 1]?.vowel)) {
            segs.push({ ph: ph + "ː", vowel });
            i += 1;
            continue;
        }
        segs.push({ ph, vowel });
    }
    // Fixed first-syllable primary stress: ˈ before the first vowel nucleus.
    const first = segs.findIndex((s) => s.vowel);
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === first) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out;
}

// ── Numbers (decimal; Estonian) ───────────────────────────────────────────────
/** 0–99 → Estonian text. Tens are unit+kümmend (kakskümmend); 10=kümme, 11–19=teens (üksteist). */
function sub100(n: number): string {
    if (n < 10) return N.units[n]!;
    if (n === 10) return N.ten;
    if (n < 20) return N.teens[n - 11]!;
    const t = N.units[Math.floor(n / 10)]! + N.tensSuffix, u = n % 10;
    return u ? `${t} ${N.units[u]}` : t;
}
/** 1–999 → Estonian text. Hundreds are (unit+)sada (sada / kakssada) + the sub-hundred remainder. */
function sub1000(n: number): string {
    const h = Math.floor(n / 100), r = n % 100;
    if (h === 0) return sub100(r);
    const hw = (h === 1 ? "" : N.units[h]) + N.hundred;
    return r ? `${hw} ${sub100(r)}` : hw;
}
/** Non-negative integer (< 1e9) → space-separated Estonian cardinal words. */
function numberToText(n: number): string {
    if (n === 0) return N.units[0]!;
    const parts: string[] = [];
    const mil = Math.floor(n / 1_000_000);
    n %= 1_000_000;
    if (mil) parts.push(mil === 1 ? `${N.units[1]} ${N.million}` : `${sub1000(mil)} ${N.millions}`); // üks miljon
    const th = Math.floor(n / 1000);
    n %= 1000;
    if (th) parts.push(th === 1 ? N.thousand : `${sub1000(th)} ${N.thousand}`);
    if (n) parts.push(sub1000(n));
    return parts.join(" ");
}
function number(digits: string): string {
    const n = Number(digits);
    if (!Number.isSafeInteger(n) || n >= 1e9)
        return [...digits].map((d) => phonemizeWord(N.units[Number(d)] ?? d)).join(" "); // read digit-by-digit
    return numberToText(n).split(" ").filter(Boolean).map(phonemizeWord).join(" ");
}

// A word (Estonian Latin letters incl. õ ä ö ü + loan š ž z) / number / punctuation token.
const TOKEN = /([a-zõäöüšžáéíóú]+)|(\d+)|([.!?…,;:])/giu;

class EstonianPhonemizer implements Phonemizer {
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

/** Build the Estonian phonemizer (greedy g2p + gemination + first-syllable stress + cardinal numbers). */
export function createEstonian(): Phonemizer {
    return new EstonianPhonemizer();
}
