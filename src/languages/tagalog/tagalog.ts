/**
 * Native Tagalog / Filipino (tl) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Latin orthography → rule-based transliterator: digraphs (ng→ŋ, ch→t͡ʃ, ny/ñ→ɲ, sy→ʃ) then single letters,
 * with a WORD-INITIAL glottal stop [ʔ] before a vowel and a hyphen → [ʔ] (pag-asa→paɡʔasa); whole-word
 * irregulars (mga→maŋa, ng→naŋ); penultimate stress. Intervocalic/word-final glottal stops are phonemic but
 * unwritten (bata 'child' [ˈbataʔ] vs bata 'robe' [ˈbata]) — a lexical residual. See docs/tl_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadLines } from "../../core/loadTsv.ts";

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

/** Penultimate stress on the second-to-last vowel nucleus (default; phonemic stress is unmarked in spelling). */
function stressed(units: string[]): string {
    const nuclei = units
        .map((u, i) => (VOWEL_PH.includes(u[0] ?? "") ? i : -1))
        .filter((i) => i >= 0);
    if (nuclei.length === 0) return units.join("");
    const idx =
        nuclei.length >= 2 ? nuclei[nuclei.length - 2]! : nuclei[0]!;
    let out = "";
    for (let i = 0; i < units.length; i++) {
        if (i === idx) out += "ˈ";
        out += units[i];
    }
    return out;
}

/** One Tagalog word → canonical IPA, RULE-ENGINE ONLY (no word-final-glottal lexicon) — the honest, non-circular
 *  signal used by the referee eval (the final ʔ is unwritten/lexical, so a wikipron-sourced set would be circular). */
export function phonemizeWordRules(word: string): string {
    const lw = word.toLowerCase();
    const special = DEF.specialWords[lw];
    if (special !== undefined) return stressed(scan(special));
    const units = scan(lw);
    if (units.length === 0) return "";
    return stressed(units).normalize("NFC");
}

// The unwritten word-final glottal stop (bata child [bataʔ] vs bata robe [bata]) is phonemic but lexical. This SET
// (final-glottal.txt, wikipron-sourced: all readings end in ʔ and the rest already matches) closes it on the SHIPPED
// path only — homographs are abstained. See docs/tl_native_bringup_investigation.md.
let FINAL_GLOTTAL: ReadonlySet<string> | undefined;
const finalGlottal = (): ReadonlySet<string> =>
    (FINAL_GLOTTAL ??= new Set(loadLines(import.meta.url, "final-glottal.txt")));

/** One Tagalog word → canonical IPA (shipped): the rule engine + the word-final-glottal lexical pin. */
export function phonemizeWord(word: string): string {
    const ipa = phonemizeWordRules(word);
    if (ipa && !ipa.endsWith("ʔ") && finalGlottal().has(word.toLowerCase())) return ipa + "ʔ";
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
                    for (const wd of numberWords(n).split(" "))
                        sink.emit(phonemizeWord(wd));
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
