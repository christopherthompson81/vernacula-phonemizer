/**
 * Native Hiligaynon / Ilonggo (hil) text phonemizer — canonical IPA, espeak-independent. A shallow near-phonemic
 * Philippine (Western Bisayan) Latin orthography → rule transliterator, the Cebuano/Tagalog pattern: the trigraphs
 * ⟨gui/gue/qui/que⟩ and digraph ⟨ng⟩→ŋ first, then single letters, with a WORD-INITIAL glottal stop [ʔ] before a
 * vowel, a HIATUS glottal between two vowels (daan→daʔan), and a hyphen → [ʔ]. Stress defaults to PENULTIMATE
 * (phonemic but unwritten, folded by the referee eval). Shares the Bisayan core with Cebuano; the deltas are the
 * Spanish-loan letters ⟨j⟩→[h] and ⟨f⟩→[p] (see hiligaynon.jsonc). The unwritten word-final glottal (mango→[maŋoʔ])
 * is phonemic but lexical → a deferred residual. Cardinal numbers use the NATIVE Austronesian set (numbers.ts). See docs/investigations/hil_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface HiligaynonDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    specialWords: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<HiligaynonDef>(import.meta.url, "hiligaynon.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiou";

/** Scan a lowercased Hiligaynon word → IPA units (trigraphs/digraphs, single letters, glottal stops). */
function scan(w: string): string[] {
    const s = [...w];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (c === "-" || c === "‑") {
            if (out.length > 0 && i + 1 < s.length) out.push("ʔ"); // intra-word hyphen → glottal (pag-abot→paɡʔabot)
            i++;
            continue;
        }
        const tg = c + (s[i + 1] ?? "") + (s[i + 2] ?? "");
        if (DEF.digraphs[tg]) { out.push(DEF.digraphs[tg]!); i += 3; continue; } // ⟨gui gue qui que⟩
        const dg = c + (s[i + 1] ?? "");
        if (DEF.digraphs[dg]) { out.push(DEF.digraphs[dg]!); i += 2; continue; } // ⟨ng ch ny ts ll rr⟩
        if (isVowelLetter(c)) {
            // Glottal stop: word-initial before a vowel (anak→ʔanak), and between two vowels in hiatus (daan→daʔan).
            const prev = out[out.length - 1];
            if (out.length === 0 || (prev && VOWEL_PH.includes(prev[0]!))) out.push("ʔ");
            out.push(DEF.vowels[c]!);
            i++;
        } else if (DEF.consonants[c]) {
            out.push(DEF.consonants[c]!);
            i++;
        } else i++; // unknown → skip
    }
    return out;
}

/** Stress the PENULTIMATE vowel nucleus (default; phonemic stress is unwritten, ~majority penultimate). */
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

/** One Hiligaynon word → canonical IPA (penultimate stress; final-glottal deferred). */
export function phonemizeWord(word: string): string {
    const lw = word.toLowerCase();
    const special = DEF.specialWords[lw];
    const units = scan(special !== undefined ? special : lw);
    if (units.length === 0) return "";
    return stressed(units).normalize("NFC");
}

// A word (Hiligaynon letters + hyphen + apostrophe glottal) / number / punctuation token.
const TOKEN = /([a-zñ'ʼ-]+)|(\d+)|([.?!,;:])/giu;

class HiligaynonPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // Native cardinal numbers (numbers.ts): one word per emitted token so each takes its own penult stress.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Hiligaynon phonemizer (rule g2p + penultimate stress + native cardinal numbers; final-glottal deferred). */
export function createHiligaynon(): Phonemizer {
    return new HiligaynonPhonemizer();
}
