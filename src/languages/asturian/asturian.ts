/**
 * Asturian (ast) phonemizer — asturianu, Astur-Leonese (Ibero-Romance), Latin script, canonical IPA,
 * espeak-independent (beyond-espeak). Close to Spanish/Galician; distinción (c/z → [θ]). A greedy longest-match
 * grapheme scan + code rules:
 *   - the Asturian hallmark ⟨x⟩→[ʃ] (Asturian writes ⟨x⟩ for the fricative → ⟨g⟩ stays [ɡ], ⟨j⟩→[h]);
 *   - distinción ⟨c⟩ before e/i → [θ] (else [k]), ⟨z⟩→[θ]; ⟨ll⟩→[ʎ], ⟨ñ⟩→[ɲ], ⟨ch⟩→[t͡ʃ], ⟨y⟩→[ʝ], ⟨v⟩→[b];
 *   - ⟨qu gu⟩ before e/i → [k ɡ] (u silent), ⟨gu gü⟩ before a back vowel → [ɡw]; the RISING glides ⟨i⟩→[j] / ⟨u⟩→[w]
 *     before a vowel; single ⟨r⟩→[ɾ] tap vs ⟨rr⟩/word-initial → [r] trill.
 * There is NO final-consonant deletion. Stress (written accents + the Ibero rule) and SPIRANTIZATION (intervocalic
 * b/d/g→β/ð/ɣ) are folded/deferred. See docs/investigations/ast_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface AsturianDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<AsturianDef>(import.meta.url, "asturian.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL_LETTER = new Set([..."aeiouáéíóúü"]);
const FRONT_LETTER = new Set([..."eiéí"]); // ⟨c⟩ softens to [θ], ⟨qu gu⟩ drop the [w] before these

/** Scan a lowercased Asturian word into IPA phone tokens. */
function scan(word: string): string[] {
    const w = word.normalize("NFC").toLowerCase();
    const out: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        const c = w[i]!, next = w[i + 1] ?? "";
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { out.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // ⟨qu gu⟩ → [k ɡ] before a front vowel (⟨u⟩ silent); ⟨gu gü⟩ → [ɡw] before a back vowel.
        if ((c === "q" || c === "g") && (next === "u" || next === "ü") && VOWEL_LETTER.has(w[i + 2] ?? "")) {
            const base = c === "q" ? "k" : "ɡ";
            out.push(next === "ü" || !FRONT_LETTER.has(w[i + 2]!) ? base + "w" : base);
            i += 2;
            continue;
        }
        if (c === "c") { out.push(FRONT_LETTER.has(next) ? "θ" : "k"); i += 1; continue; } // distinción
        // the RISING glides: ⟨i⟩→[j], ⟨u⟩→[w] before another vowel.
        if (c === "i" && VOWEL_LETTER.has(next)) { out.push("j"); i += 1; continue; }
        if (c === "u" && VOWEL_LETTER.has(next)) { out.push("w"); i += 1; continue; }
        // ⟨y⟩ → [ʝ] as an onset (before a vowel), but [i] as a coda offglide (Olay→olai, güeyu→ɡweʝu).
        if (c === "y") { out.push(VOWEL_LETTER.has(next) ? "ʝ" : "i"); i += 1; continue; }
        // word-initial ⟨r⟩ → [r] trill (single ⟨r⟩ is the tap [ɾ] via the table; ⟨rr⟩ is the digraph above).
        if (c === "r" && i === 0) { out.push("r"); i += 1; continue; }
        const ph = G[c];
        if (ph !== undefined && ph !== "") out.push(ph);
        i += 1;
    }
    return out;
}

/** ⟨n⟩ → [m] before a labial [b p m] (bienvenida→bjembenida, convencíu→kombenθiu; ⟨v⟩ is already [b]). */
function labialNasal(toks: string[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i] === "n" && (toks[i + 1] === "b" || toks[i + 1] === "p" || toks[i + 1] === "m")) toks[i] = "m";
    }
}

/** Phonemize a single Asturian word to canonical IPA (segmental; stress + spirantization folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    labialNasal(toks);
    return toks.join("");
}

// A word (Asturian Latin letters incl. ñ, the accents, ü, and the ḷḷ/ḥ dialect marks) / number / punctuation token.
const TOKEN = /([a-zñáéíóúüïḥḷA-ZÑÁÉÍÓÚÜÏḤḶ'·]+)|(\d+)|([.!?…,;:])/gu;

class AsturianPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            // A digit run reads as Asturian number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Asturian phonemizer (Ibero-Romance g2p + x→ʃ + distinción; stress/spirantization folded). */
export function createAsturian(): Phonemizer {
    return new AsturianPhonemizer();
}
