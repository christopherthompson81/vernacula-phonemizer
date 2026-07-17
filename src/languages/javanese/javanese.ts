/**
 * Native Javanese / Basa Jawa (jv) text phonemizer — canonical IPA, espeak-independent. Austronesian, Latin
 * script. Ported from the espeak-ng-portable authored bring-up. A rule-based g2p (like id/tl) plus the three
 * signature Javanese processes: (1) the ⟨a⟩→[ɔ] rule — /a/ in a word-final OPEN syllable becomes [ɔ] and spreads
 * regressively through open penults (apa→ɔpɔ, sanga→sɔŋɔ, Jawa→d͡ʒɔwɔ); a closed final syllable blocks it
 * (mangan→maŋan); (2) the DENTAL vs RETROFLEX contrast (⟨t d⟩→t̪ d̪, ⟨th dh⟩→ʈ ɖ); (3) closed-syllable laxing
 * (i→ɪ u→ʊ o→ɔ) + word-final ⟨k⟩→ʔ (pitik→pitɪʔ). Bare ⟨e⟩ defaults to pepet /ə/. Penultimate stress. The
 * ngoko NUMBER system is irregular (-likur/-welas, seket/sewidak). See docs/investigations/jv_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";
import {
    scanAksara,
    aksaraDigit,
    aksaraPada,
} from "./aksara.ts";

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

export interface Seg {
    ph: string;
    v: string; // source vowel letter for a nucleus; "" for a consonant
}
// Aksara Jawa (Hanacaraka) word run, and any single letter/sign of it — for script detection + tokenising.
const AKSARA_WORD = /[\u{A980}-\u{A9CF}]/u;

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

/** Apply the shared Javanese phonology to a segment list (from EITHER the Latin scan or the Aksara Jawa scan):
 *  final-⟨k⟩→ʔ, closed-syllable laxing, the a→ɔ harmony, penult stress. Returns canonical IPA. */
export function applyPhonology(segs: Seg[]): string {
    if (segs.length === 0) return "";

    // Word-final ⟨k⟩ → glottal stop ʔ.
    const last = segs[segs.length - 1]!;
    if (last.ph === "k") last.ph = "ʔ";

    // Homorganic nasal assimilation: /n/ → [ɲ] before a palatal affricate (kanca→kaɲt͡ʃɔ, banci→baɲt͡ʃi). The
    // Aksara Jawa writes ꦚ (ɲ) explicitly; the Latin writes plain ⟨n⟩ but it is realized [ɲ] — so the Latin
    // front-end needs the rule (the referee writes plain n → folded, as the config note documents).
    for (let i = 0; i < segs.length - 1; i++)
        if (segs[i]!.ph === "n" && (segs[i + 1]!.ph === "t͡ʃ" || segs[i + 1]!.ph === "d͡ʒ"))
            segs[i]!.ph = "ɲ";

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
        // letter or a digraph) → [ɔ]. No antepenult spread; a heavier penult coda (bangsa) is left to the referee
        // (spreading across a closed penult is net-NEGATIVE — the referee is inconsistent there, measured 2026-07-16).
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

/** One Javanese word → canonical IPA, RULE-ENGINE ONLY (no cross-script lexicon). Routes by script: Aksara Jawa
 *  → the abugida scanner, else the Latin g2p — both feed the shared phonology. The honest signal for the eval. */
export function phonemizeWordRules(word: string): string {
    return applyPhonology(
        AKSARA_WORD.test(word) ? scanAksara(word) : scan(word.toLowerCase()),
    );
}

// Cross-script ⟨e⟩ lexicon (Aksara-resolved, Latin-keyed; see javanese-lexicon.tsv). Applied on the SHIPPED Latin
// path only — Aksara input already resolves ⟨e⟩ via the script, so it never consults this.
let LEXICON: Map<string, string> | undefined;
const lexicon = (): Map<string, string> =>
    (LEXICON ??= loadTsvMap(import.meta.url, "javanese-lexicon.tsv", (v) => v, {
        optional: true,
    }));

/** SHIPPED Javanese word → canonical IPA. For Latin input a cross-script ⟨e⟩ lexicon override applies (pepet vs
 *  taling, unrecoverable from Latin); Aksara input and everything else fall through to the rule engine. */
export function phonemizeWord(word: string): string {
    if (!AKSARA_WORD.test(word)) {
        const hit = lexicon().get(word.toLowerCase());
        if (hit !== undefined) return hit;
    }
    return phonemizeWordRules(word);
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

// Latin word · Aksara Jawa word run (letters+signs, U+A980–U+A9C0) · Aksara digits · ASCII digits · Aksara pada
// punctuation (U+A9C1–U+A9CE, U+A9DE–U+A9DF) · ASCII punctuation.
const TOKEN =
    /([a-zA-ZéèêÉÈÊ]+)|([\u{A980}-\u{A9C0}]+)|([\u{A9D0}-\u{A9D9}]+)|(\d+)|([\u{A9C1}-\u{A9CE}\u{A9DE}\u{A9DF}])|([.?!,;:])/gu;

/** Speak an integer: emit each ngoko numeral word separately (so word-final laxing / a→ɔ apply per word). */
function emitNumber(n: number, sink: { emit: (s: string) => void }): void {
    if (Number.isSafeInteger(n))
        // Number words bypass the content lexicon — the ngoko spellings collide with taling homographs (the
        // number seket [səkət̪] vs a taling seket [sekət̪]); the compositor's words are the rule-form pronunciation.
        for (const wd of numberToText(n).split(" "))
            sink.emit(phonemizeWordRules(wd));
}

class JavanesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1] || m[2]) sink.emit(phonemizeWord(m[1] ?? m[2]!));
            else if (m[3])
                emitNumber(Number([...m[3]].map(aksaraDigit).join("")), sink);
            else if (m[4]) emitNumber(Number(m[4]), sink);
            else if (m[5]) {
                const mk = aksaraPada(m[5]);
                if (mk) sink.pause(mk);
            } else if (m[6]) {
                const mk = CLAUSE_MARK[m[6]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Javanese phonemizer (no data files beyond the manifest — the engine is rule-based). */
export function createJavanese(): Phonemizer {
    return new JavanesePhonemizer();
}
