/**
 * Native Oromo / Afaan Oromoo (om) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Latin (Qubee) orthography → rule-based transliterator: digraphs (ch→t͡ʃ, dh→ᶑ, ny→ɲ, ph→pʼ, sh→ʃ) then single
 * letters, with DOUBLED VOWELS = long (aa→aː) and DOUBLED CONSONANTS = geminate (bb→bː); a geminate DIGRAPH doubles
 * its first letter (ddh→[ᶑː], cch→[t͡ʃː]). The apostrophe → glottal stop [ʔ] (buʼaa→buʔaː). Qubee is largely
 * phonemic → the g2p is deterministic. Oromo (Cushitic) fills a census gap: the EJECTIVES c/q/x/ph + implosive dh.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface OromoDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<OromoDef>(import.meta.url, "oromo.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

export type ForeignPhonemizer = (latin: string) => string;

const APOSTROPHE = new Set(["'", "ʼ", "’"]); // ' ʼ ’ → glottal stop

/** Scan a lowercased Oromo word → IPA units (digraphs, gemination, length, glottal stop). */
function scan(w: string): string[] {
    const s = [...w.toLowerCase()];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (APOSTROPHE.has(c)) {
            // The glottal stop is written with an apostrophe only INTERIOR (buʼaa, saʼa); a word-edge apostrophe is
            // a quotation mark, not a glottal (and ’ U+2019 doubles as a closing quote), so emit [ʔ] only between
            // letters — a letter before, and a non-apostrophe letter after.
            const next = s[i + 1];
            if (i > 0 && next !== undefined && !APOSTROPHE.has(next)) out.push("ʔ");
            i++;
            continue;
        }
        // Geminate DIGRAPH: a doubled first letter + a digraph (Qubee writes it ddh/cch/nny/ssh/pph → [ᶑː]/[t͡ʃː]…).
        if (s[i + 1] === c) {
            const dg2 = (s[i + 1] ?? "") + (s[i + 2] ?? "");
            if (DEF.digraphs[dg2]) {
                out.push(DEF.digraphs[dg2]! + "ː");
                i += 3;
                continue;
            }
        }
        // Plain digraph.
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) {
            out.push(DEF.digraphs[dg]!);
            i += 2;
            continue;
        }
        // Doubled letter → long vowel (aa→aː) or geminate consonant (bb→bː).
        if (s[i + 1] === c) {
            const single = DEF.vowels[c] ?? DEF.consonants[c];
            if (single !== undefined) {
                out.push(single + "ː");
                i += 2;
                continue;
            }
        }
        // Single letter.
        const single = DEF.vowels[c] ?? DEF.consonants[c];
        if (single !== undefined) out.push(single);
        i++;
    }
    return out;
}

/** One Oromo word → canonical IPA. */
export function phonemizeWord(word: string): string {
    return scan(word).join("").normalize("NFC");
}

const TOKEN = /([A-Za-zʼ’']+)|(\d+)|([.?!,;:])/gu;

class OromoPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(this.foreign ? this.foreign(m[2]) : "");
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Oromo phonemizer. */
export function createOromo(): Phonemizer {
    return new OromoPhonemizer();
}
