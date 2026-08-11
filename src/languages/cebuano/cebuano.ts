/**
 * Native Cebuano / Sinugboanon (ceb) text phonemizer — canonical IPA. A shallow near-phonemic
 * Philippine (Central Bisayan) Latin orthography → rule transliterator, the Tagalog pattern: the digraph ⟨ng⟩→ŋ
 * (+ nativized loan digraphs) then single letters, with a WORD-INITIAL glottal stop [ʔ] before a vowel, a HIATUS
 * glottal between two vowels (kaon→kaʔon, maayo→maʔajo), and a hyphen → [ʔ]. Stress defaults to PENULTIMATE (it is
 * phonemic but unwritten, and the referee eval folds stress). The unwritten word-final glottal (bata child [bataʔ]
 * vs bata robe [bata]) is phonemic but lexical → a deferred residual.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeCebuano } from "./normalize.ts";

interface CebuanoDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    specialWords: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<CebuanoDef>(import.meta.url, "cebuano.jsonc");
const CLAUSE_MARK = DEF.clausePunctuation;

const isVowelLetter = (c: string): boolean => "aeiou".includes(c);
const VOWEL_PH = "aeiou";

/** Scan a lowercased Cebuano word → IPA units (digraphs, single letters, glottal stops). */
function scan(w: string): string[] {
    const s = [...w];
    const out: string[] = [];
    for (let i = 0; i < s.length; ) {
        const c = s[i]!;
        if (c === "-" || c === "‑") {
            // Intra-word hyphen → glottal stop (pag-asa→paɡʔasa), but ONLY when it joins two parts — a standalone
            // or word-edge dash (a range/punctuation dash) must not inject a spurious [ʔ].
            if (out.length > 0 && i + 1 < s.length) out.push("ʔ");
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
            // Glottal stop: word-initial before a vowel (adlaw→ʔadlaw), and between two vowels in hiatus
            // (kaon→kaʔon, maayo→maʔajo). The y/w glides are consonants, so ⟨ay⟩/⟨aw⟩ stay glides.
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

/** Stress the PENULTIMATE vowel nucleus (default; phonemic stress is unwritten, ~majority is penultimate). */
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

/** One Cebuano word → canonical IPA (penultimate stress). */
export function phonemizeWord(word: string): string {
    const lw = word.toLowerCase();
    const special = DEF.specialWords[lw];
    const units = scan(special !== undefined ? special : lw);
    if (units.length === 0) return "";
    return stressed(units).normalize("NFC");
}

// A word (Cebuano letters + hyphen + apostrophe glottal) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'ʼ-")})|(\\d+)|([.?!,;:])`, "giu");

/**
 * This language's OWN inventory. ⚠ TWO DIFFERENT QUESTIONS, KEPT APART: the TOKEN class above decides where
 * the SCRIPT boundary falls (routing), while this one decides whether the g2p has rules for these letters. A
 * token this class REJECTS carries a letter the language does not use — i.e. a foreign name. See
 * core/hostWord.ts.
 */
const NATIVE_CLASS = "[a-zñ'ʼ-]";
const nat = makeNativiser(NATIVE_CLASS, "iu");

class CebuanoPhonemizer implements Phonemizer {
    text(input: string): string {
        // NORMALIZATION runs first — pure text→text, so everything it emits is then read by the ordinary word,
        // number and clause paths below. It must see the text BEFORE tokenization, because most of what it
        // repairs (a grouping `,`, a decimal `.`, a clock `:`) is a character `TOKEN` would otherwise hand to
        // `clausePunctuation` as a pause.
        return assembleClauses(normalizeCebuano(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            else if (m[2])
                for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Cebuano phonemizer (rule g2p + penultimate stress; final-glottal deferred). */
export function createCebuano(): Phonemizer {
    return new CebuanoPhonemizer();
}
