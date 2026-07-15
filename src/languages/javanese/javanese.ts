/**
 * Native Javanese / Basa Jawa (jv) text phonemizer — canonical IPA, espeak-independent. Austronesian, Latin
 * script. Ported from the espeak-ng-portable authored bring-up. A rule-based g2p (like id/tl) plus the three
 * signature Javanese processes: (1) the ⟨a⟩→[ɔ] rule — /a/ in a word-final OPEN syllable becomes [ɔ] and spreads
 * regressively through open penults (apa→ɔpɔ, sanga→sɔŋɔ, Jawa→d͡ʒɔwɔ); a closed final syllable blocks it
 * (mangan→maŋan); (2) the DENTAL vs RETROFLEX contrast (⟨t d⟩→t̪ d̪, ⟨th dh⟩→ʈ ɖ); (3) closed-syllable laxing
 * (i→ɪ u→ʊ o→ɔ) + word-final ⟨k⟩→ʔ (pitik→pitɪʔ). Bare ⟨e⟩ defaults to pepet /ə/. Penultimate stress. The
 * ngoko NUMBER system is irregular (-likur/-welas, seket/sewidak). See docs/jv_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface NumbersDef {
    units: string[];
    teens: string[];
    likur: string[];
    mult: string[];
    tens: Record<string, string>;
    magnitudes: { thousand: string[]; million: string[]; billion: string[] };
    hundredOne: string;
    hundred: string;
}
interface JavaneseDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<JavaneseDef>(import.meta.url, "javanese.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

const VOWEL_LETTERS = "aiueoéèê";
const LAX: Record<string, string> = { i: "ɪ", u: "ʊ", o: "ɔ" }; // closed-syllable laxing (keyed by SOURCE letter)

interface Seg {
    ph: string;
    v: string; // source vowel letter for a nucleus; "" for a consonant
}

/** Scan a lowercased Javanese word into segments (digraphs first, then single letters). */
function scan(w: string): Seg[] {
    const s = [...w];
    const segs: Seg[] = [];
    for (let i = 0; i < s.length; ) {
        const dg = (s[i] ?? "") + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            segs.push({ ph: DEF.digraphs[dg]!, v: "" });
            i += 2;
            continue;
        }
        const c = s[i]!;
        if (VOWEL_LETTERS.includes(c)) segs.push({ ph: DEF.vowels[c] ?? c, v: c });
        else if (c in DEF.consonants) segs.push({ ph: DEF.consonants[c]!, v: "" });
        // else: unknown → skip
        i++;
    }
    return segs;
}

const isVowelSeg = (sg: Seg): boolean => sg.v !== "";

/** Consonants between segment i (exclusive) and the next vowel — the coda+onset run. Returns [count, nextVowelIdx]. */
function consonantsAfter(segs: Seg[], i: number): [number, number] {
    let j = i + 1;
    while (j < segs.length && !isVowelSeg(segs[j]!)) j++;
    return [j - i - 1, j];
}

/** One Javanese word → canonical IPA. */
export function phonemizeWord(word: string): string {
    const segs = scan(word.toLowerCase());
    if (segs.length === 0) return "";

    // Word-final ⟨k⟩ → glottal stop ʔ.
    const last = segs[segs.length - 1]!;
    if (last.ph === "k") last.ph = "ʔ";

    // Closed-syllable laxing (i→ɪ u→ʊ o→ɔ): a vowel is CLOSED when a coda follows — i.e. ≥2 consonants before the
    // next vowel (first is a coda), or ≥1 trailing consonant at word end.
    for (let i = 0; i < segs.length; i++) {
        const sg = segs[i]!;
        const lax = LAX[sg.v];
        if (lax === undefined) continue;
        const [cons, next] = consonantsAfter(segs, i);
        const closed = next >= segs.length ? cons >= 1 : cons >= 2;
        if (closed) sg.ph = lax;
    }

    // The a→ɔ rule: /a/ in a word-final OPEN syllable → [ɔ], and the harmony reaches back exactly ONE syllable —
    // a penultimate /a/ also → [ɔ] (regardless of its coda: bangsa→bɔŋsɔ, bandha→bɔndɔ). It does NOT spread to the
    // antepenult (wahana→wahɔnɔ, not *wɔhɔnɔ). Trigger only from a final open /a/ (not other final vowels).
    const vowelIdx = segs.map((sg, i) => (isVowelSeg(sg) ? i : -1)).filter((i) => i >= 0);
    if (
        vowelIdx.length &&
        segs[vowelIdx[vowelIdx.length - 1]!]!.v === "a" &&
        vowelIdx[vowelIdx.length - 1]! === segs.length - 1 // final syllable open
    ) {
        const lastV = vowelIdx[vowelIdx.length - 1]!;
        segs[lastV]!.ph = "ɔ";
        // Reach back ONE syllable: a penult /a/ separated from the final by exactly one consonant unit (a single
        // letter or a digraph) → [ɔ]. No antepenult spread; a heavier penult coda (bangsa) is left to the referee.
        const penult = vowelIdx[vowelIdx.length - 2];
        if (penult !== undefined && segs[penult]!.v === "a" && lastV - penult === 2)
            segs[penult]!.ph = "ɔ";
    }

    // Penultimate stress (weak, non-distinctive); the schwa can bear it in Javanese, so no schwa-skip.
    const stress =
        vowelIdx.length >= 2 ? vowelIdx[vowelIdx.length - 2]! : vowelIdx[0] ?? -1;
    let out = "";
    for (let i = 0; i < segs.length; i++) {
        if (i === stress) out += "ˈ";
        out += segs[i]!.ph;
    }
    return out.normalize("NFC");
}

// ── Numbers (ngoko; irregular) — ported from the espeak-ng-portable compositor ────────────────────────────────
/** n in [1,99] → ngoko spelling. */
function belowHundred(n: number): string {
    if (n < 10) return NUM.units[n]!;
    if (n < 20) return NUM.teens[n - 10]!;
    if (n >= 21 && n <= 29) return NUM.likur[n - 20]!;
    const t = Math.floor(n / 10),
        u = n % 10;
    return u > 0 ? `${NUM.tens[String(t)]} ${NUM.units[u]}` : NUM.tens[String(t)]!;
}
/** n in [1,999] → spelling (1→satus; 2–9→[mult] atus). */
function belowThousand(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return belowHundred(n);
    const hw = h === 1 ? NUM.hundredOne : `${NUM.mult[h]} ${NUM.hundred}`;
    return r > 0 ? `${hw} ${belowHundred(r)}` : hw;
}
/** `[count] <magnitude>`: 1 fuses to the suppletive word, 2–9 use the combining multiplier, ≥10 a full count. */
function magnitude(count: number, [fused, word]: string[]): string {
    if (count === 1) return fused!;
    if (count <= 9) return `${NUM.mult[count]} ${word}`;
    return `${belowThousand(count)} ${word}`;
}
/** Non-negative integer → standard Javanese ngoko numeral spelling. */
function numberToText(n: number): string {
    if (n === 0) return NUM.units[0]!;
    const parts: string[] = [];
    if (n >= 1_000_000_000) {
        parts.push(magnitude(Math.floor(n / 1_000_000_000), NUM.magnitudes.billion));
        n %= 1_000_000_000;
    }
    if (n >= 1_000_000) {
        parts.push(magnitude(Math.floor(n / 1_000_000), NUM.magnitudes.million));
        n %= 1_000_000;
    }
    if (n >= 1_000) {
        parts.push(magnitude(Math.floor(n / 1_000), NUM.magnitudes.thousand));
        n %= 1_000;
    }
    if (n > 0) parts.push(belowThousand(n));
    return parts.join(" ");
}

const TOKEN = /([a-zA-ZéèêÉÈÊ]+)|(\d+)|([.?!,;:])/gu;

class JavanesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                // Each numeral word is emitted separately so word-final laxing / a→ɔ apply per word.
                if (Number.isSafeInteger(n))
                    for (const wd of numberToText(n).split(" "))
                        sink.emit(phonemizeWord(wd));
                else sink.emit(m[2]);
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Javanese phonemizer (no data files beyond the manifest — the engine is rule-based). */
export function createJavanese(): Phonemizer {
    return new JavanesePhonemizer();
}
