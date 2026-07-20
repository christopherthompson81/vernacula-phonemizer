/**
 * Native Ilocano / Iloko (ilo) text phonemizer — canonical IPA, espeak-independent. Austronesian (Northern Luzon,
 * Ilocano subgroup — NOT Bisayan). A shallow near-phonemic Latin g2p (reads ilocano.jsonc): trigraphs
 * ⟨gui/gue/qui/que⟩ + digraph ⟨ng⟩→ŋ, then single letters, with a WORD-INITIAL glottal stop [ʔ] before a vowel and
 * PENULTIMATE stress (unwritten, folded by the eval). The Ilocano-distinctive HIATUS: a HIGH vowel ⟨i u⟩ before
 * another vowel GLIDES (dua→dwa, radio→ɾadjo) — unlike Bisayan's uniform glottal hiatus — while a non-high hiatus
 * keeps the glottal (tao→taʔo). ⟨e⟩→[ɛ] (the 6th vowel is [ɯ]~[ɛ], not spelling-predictable → default ɛ, folded);
 * ⟨ll⟩ is a native geminate [lː]. See docs/investigations/ilo_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

interface IlocanoDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<IlocanoDef>(import.meta.url, "ilocano.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiouɛ";

/** Scan a lowercased Ilocano word → IPA units. High-vowel gliding hiatus; else word-initial/non-high glottal. */
function scan(w: string): string[] {
    const s = [...w];
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
        const c = s[i]!;
        if (c === "-" || c === "‑") {
            if (out.length > 0 && i + 1 < s.length) out.push("ʔ");
            continue;
        }
        const tg = c + (s[i + 1] ?? "") + (s[i + 2] ?? "");
        if (DEF.digraphs[tg]) { out.push(DEF.digraphs[tg]!); i += 2; continue; }
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) { out.push(DEF.digraphs[dg]!); i += 1; continue; }
        if (isVowelLetter(c)) {
            const nextIsVowel = i + 1 < s.length && isVowelLetter(s[i + 1]!);
            const prev = out[out.length - 1];
            const prevIsVowel = prev !== undefined && VOWEL_PH.includes(prev[0]!);
            // A HIGH vowel ⟨i u⟩ directly before another vowel glides — i→[j], u→[w] (dua→dwa, radio→ɾadjo,
            // dies→djes) — unlike Bisayan's uniform glottal hiatus. A non-high hiatus keeps the glottal (tao→taʔo).
            if ((c === "i" || c === "u") && nextIsVowel && !prevIsVowel) {
                out.push(c === "i" ? "j" : "w");
                continue;
            }
            // Otherwise: glottal stop word-initially, or in a non-high hiatus (tao→taʔo, ao→aʔo).
            if (out.length === 0 || prevIsVowel) out.push("ʔ");
            out.push(DEF.vowels[c]!);
        } else if (DEF.consonants[c]) {
            out.push(DEF.consonants[c]!);
        } // unknown → skip
    }
    return out;
}

/** Stress the PENULTIMATE vowel nucleus (default; phonemic stress unwritten). */
function stressed(units: string[]): string {
    const nuclei = units.map((u, i) => (VOWEL_PH.includes(u[0] ?? "") ? i : -1)).filter((i) => i >= 0);
    if (nuclei.length === 0) return units.join("");
    const idx = nuclei[nuclei.length >= 2 ? nuclei.length - 2 : 0]!;
    let out = "";
    for (let i = 0; i < units.length; i++) {
        if (i === idx) out += "ˈ";
        out += units[i];
    }
    return out;
}

/** One Ilocano word → canonical IPA by the RULE g2p only (high-vowel gliding hiatus + penult stress). This is the
 *  NON-CIRCULAR path the referee eval measures — it does NOT consult the referee-derived lexicon. */
export function phonemizeWordRules(word: string): string {
    const units = scan(word.toLowerCase());
    if (units.length === 0) return "";
    return stressed(units).normalize("NFC");
}

// Pronunciation lexicon (word → IPA), mined from the stress-marked referees. Fixes the LEXICAL residual the rule
// cannot derive from spelling: gliding (garcia→ɡaɾsˈia stays, kua→kuˈa), the 6th vowel ⟨e⟩→[ɯ], and lexical stress.
let LEX: Map<string, string> | undefined;
const lexicon = (): Map<string, string> => (LEX ??= loadTsvMap(import.meta.url, "ilo-lexicon.tsv"));

/** One Ilocano word → canonical IPA. The shipped path: the pronunciation lexicon first (fixes the lexical
 *  gliding/stress/6th-vowel), then the rule g2p for OOV. */
export function phonemizeWord(word: string): string {
    return lexicon().get(word.toLowerCase().normalize("NFC")) ?? phonemizeWordRules(word);
}

// A word (Ilocano letters + hyphen + apostrophe glottal) / number / punctuation token.
const TOKEN = /([a-zñ'ʼ-]+)|(\d+)|([.?!,;:])/giu;

class IlocanoPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Ilocano phonemizer (rule g2p + penultimate stress; numbers deferred). */
export function createIlocano(): Phonemizer {
    return new IlocanoPhonemizer();
}
