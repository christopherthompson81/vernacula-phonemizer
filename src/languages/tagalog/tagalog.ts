/**
 * Native Tagalog / Filipino (tl) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Latin orthography → rule-based transliterator: digraphs (ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ, sy→ʃ) then single letters,
 * with a WORD-INITIAL glottal stop [ʔ] before a vowel and a hyphen → [ʔ] (pag-asa→paɡʔasa); whole-word
 * irregulars (mga→maŋa, ng→naŋ). Stress defaults to PENULTIMATE but is phonemic and unwritten, so the shipped path
 * pins the ~23% non-penultimate cases from a kaikki-sourced stress lexicon (magandá, ngayón); the rule engine keeps
 * the penult default (the referee eval folds stress). Intervocalic/word-final glottal stops are likewise phonemic
 * but unwritten (bata 'child' [ˈbataʔ] vs bata 'robe' [ˈbata]) — a lexical residual. See docs/tl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadLines, loadTsvMap } from "../../core/loadTsv.ts";

interface NumbersDef {
    units: string[];
    ten: string;
    teenPrefix: string;
    tensSuffix: string;
    hundred: string;
    thousand: string;
    million: string;
    and: string;
}
interface TagalogDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    specialWords: Record<string, string>;
    clausePunctuation: Record<string, string>;
    numbers: NumbersDef;
}
const DEF = loadManifest<TagalogDef>(import.meta.url, "tagalog.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;
const NUM = DEF.numbers;

export type ForeignPhonemizer = (latin: string) => string;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiou";

/** Scan a lowercased Tagalog word → IPA (digraphs, single letters, glottal stops). */
function scan(w: string): string[] {
    const s = [...w];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        // Hyphen → glottal stop (pag-asa → paɡʔasa).
        if (c === "-" || c === "‑") {
            out.push("ʔ");
            i++;
            continue;
        }
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out.push(DEF.digraphs[dg]!);
            i += 2;
            continue;
        }
        if (isVowelLetter(c)) {
            // Glottal stop: word-initial before a vowel (araw→ʔaɾaw), and between two vowels in hiatus
            // (tao→taʔo, maaari→maʔaʔaɾi) — the y/w glides are consonants, so ay/aw stay glides.
            const prev = out[out.length - 1];
            if (out.length === 0 || (prev && VOWEL_PH.includes(prev[0]!)))
                out.push("ʔ");
            out.push(DEF.vowels[c]!);
            i++;
        } else if (DEF.consonants[c]) {
            out.push(DEF.consonants[c]!);
            i++;
        } else i++; // unknown → skip
    }
    return out;
}

/** Stress the given vowel-nucleus (0-based `overrideVowelIdx`, from the stress lexicon) or the penultimate nucleus
 *  (default; phonemic stress is unmarked in spelling, and ~77% of words are penultimate). */
function stressed(units: string[], overrideVowelIdx?: number): string {
    const nuclei = units
        .map((u, i) => (VOWEL_PH.includes(u[0] ?? "") ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return units.join("");
    const vni =
        overrideVowelIdx !== undefined && overrideVowelIdx >= 0 && overrideVowelIdx < nuclei.length
            ? overrideVowelIdx
            : nuclei.length >= 2 ? nuclei.length - 2 : 0;
    const idx = nuclei[vni]!;
    let out = "";
    for (let i = 0; i < units.length; i++) {
        if (i === idx) out += "ˈ";
        out += units[i];
    }
    return out;
}

/** Scan + stress one word (shared core). `overrideVowelIdx` (from the stress lexicon) moves stress off the
 *  penultimate default; undefined keeps the default. */
function phonemizeCore(word: string, overrideVowelIdx?: number): string {
    const lw = word.toLowerCase();
    const special = DEF.specialWords[lw];
    const units = special !== undefined ? scan(special) : scan(lw);
    if (units.length === 0) return "";
    return stressed(units, overrideVowelIdx).normalize("NFC");
}

/** One Tagalog word → canonical IPA, RULE-ENGINE ONLY (no word-final-glottal or stress lexicon) — the honest,
 *  non-circular signal used by the referee eval (the final ʔ is unwritten/lexical, so a wikipron-sourced set would
 *  be circular; stress is folded by the eval backbone anyway, so the penult default is the honest rule signal). */
export function phonemizeWordRules(word: string): string {
    return phonemizeCore(word);
}

// The unwritten word-final glottal stop (bata child [bataʔ] vs bata robe [bata]) is phonemic but lexical. This SET
// (final-glottal.txt, wikipron-sourced: all readings end in ʔ and the rest already matches) closes it on the SHIPPED
// path only — homographs are abstained. See docs/tl_native_bringup_investigation.md.
let FINAL_GLOTTAL: ReadonlySet<string> | undefined;
const finalGlottal = (): ReadonlySet<string> =>
    (FINAL_GLOTTAL ??= new Set(loadLines(import.meta.url, "final-glottal.txt")));

// Phonemic stress is UNWRITTEN; the rule engine defaults to PENULTIMATE, but ~23% of words stress elsewhere (mostly
// FINAL: balik→balík). This MAP (stress-lexicon.tsv, kaikki-sourced: single confident stress position, vowel-count-
// aligned, only where it differs from the penult default) moves the stress mark on the SHIPPED path only — the eval
// backbone folds stress ˈˌ, so this is a TTS-quality closure invisible to the referee %. See the investigation doc.
let STRESS_LEX: ReadonlyMap<string, number> | undefined;
const stressLex = (): ReadonlyMap<string, number> =>
    (STRESS_LEX ??= loadTsvMap(import.meta.url, "stress-lexicon.tsv", (v) => {
        const n = Number(v);
        // reject empty/whitespace (Number("")===0 would else silently pin the first vowel) and non-integers
        return v.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : undefined;
    }));

/** One Tagalog word → canonical IPA (shipped): the rule engine + the stress lexicon + the word-final-glottal pin. */
export function phonemizeWord(word: string): string {
    const lw = word.toLowerCase();
    const ipa = phonemizeCore(word, stressLex().get(lw));
    if (ipa && !ipa.endsWith("ʔ") && finalGlottal().has(lw)) return ipa + "ʔ";
    return ipa;
}

// ── Numbers (compositional; native Tagalog) ──────────────────────────────────
function numberWords(n: number): string {
    if (n < 0) return "";
    if (n < 10) return NUM.units[n]!;
    if (n === 10) return NUM.ten;
    if (n < 20) return `${NUM.teenPrefix} ${NUM.units[n - 10]}`;
    if (n < 100) {
        const t = Math.floor(n / 10),
            r = n % 10;
        return `${NUM.units[t]}${NUM.tensSuffix}${r ? " " + NUM.and + " " + numberWords(r) : ""}`;
    }
    if (n < 1000) {
        const h = Math.floor(n / 100),
            r = n % 100;
        return `${h === 1 ? "isang" : NUM.units[h]} ${NUM.hundred}${r ? " " + numberWords(r) : ""}`;
    }
    if (n < 1000000) {
        const th = Math.floor(n / 1000),
            r = n % 1000;
        return `${numberWords(th)} ${NUM.thousand}${r ? " " + numberWords(r) : ""}`;
    }
    const m = Math.floor(n / 1000000),
        r = n % 1000000;
    return `${numberWords(m)} ${NUM.million}${r ? " " + numberWords(r) : ""}`;
}

const TOKEN = /([A-Za-zÑñ]+(?:[-‑][A-Za-zÑñ]+)*)|(\d+)|([.?!,;:])/gu;

class TagalogPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) {
                const n = Number(m[2]);
                if (Number.isSafeInteger(n))
                    // Number words take the STRESS lexicon (dalawá/tatló/waló are final-stressed — so "2" and the
                    // typed word "dalawa" agree) but bypass the final-glottal set, which fires inconsistently by
                    // incidental membership (sampu→sampuʔ but dalawampu not); keep the composed number system uniform.
                    for (const wd of numberWords(n).split(" "))
                        sink.emit(phonemizeCore(wd, stressLex().get(wd.toLowerCase())));
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Tagalog phonemizer. */
export function createTagalog(): Phonemizer {
    return new TagalogPhonemizer();
}
