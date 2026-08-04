/**
 * Aragonese (an) phonemizer — aragonés, Ibero-Romance (Pyrenean, ~25k, Aragon/NE Spain), Latin, canonical IPA,
 * espeak-independent. A Spanish-shaped shallow greedy scan (the Asturian/Galician pattern) with the Aragonese
 * hallmarks:
 *   ★ ⟨ch⟩→[t͡ʃ] (Aragonese writes ⟨ch⟩ where Spanish has [x]: Chesús→t͡ʃesus), ⟨ny⟩→[ɲ] (the Catalan-style digraph:
 *     Espanya→espaɲa), ⟨x⟩→[ʃ] (baxo→baʃo), ⟨v⟩→[b] (betacism);
 *   ★ DISTINCIÓN (standard Aragonese, per the Academia): ⟨z⟩ / ⟨c⟩ before e/i → [θ] (seseo [s] is the marked
 *     Benasquese/Ribagorçan minority → we emit [θ] and fold the axis); ⟨j⟩ / ⟨g⟩ before e/i → [x];
 *   ★ WORD-FINAL ⟨-r⟩ after a vowel is DROPPED (the Aragonese apocope: abanzar→abansa, cantar→canta).
 * Single ⟨r⟩→[ɾ] tap vs ⟨rr⟩/word-initial → [r] trill; the rising glides ⟨i⟩→[j]/⟨u⟩→[w] before a vowel; ⟨qu gu⟩→
 * [k ɡ] before a front vowel (⟨u⟩ silent) / [kw ɡw] before a back vowel. Stress (written accents + the Ibero rule)
 * and SPIRANTIZATION (intervocalic b/d/g→β/ð/ɣ) are folded/deferred. Referee: wikipron arg_latn_broad (human,
 * 1320). See docs/investigations/an_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";

interface AragoneseDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<AragoneseDef>(import.meta.url, "aragonese.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);
const VOWEL_LETTER = new Set([..."aeiouáéíóúü"]);
const FRONT_LETTER = new Set([..."eiéí"]); // ⟨c⟩/⟨g⟩ soften and ⟨qu gu⟩ drop the [w] before these
const IPA_VOWEL = new Set([..."aeiou"]);

/** Scan a lowercased Aragonese word into IPA phone tokens. */
function scan(word: string): string[] {
    const w = word.normalize("NFC").toLowerCase();
    const out: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        const c = w[i]!, next = w[i + 1] ?? "";
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { out.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // ⟨qu gu⟩ → [k ɡ] before a front vowel (⟨u⟩ silent); ⟨gu gü / qu⟩ → [kw ɡw] before a back vowel.
        if ((c === "q" || c === "g") && (next === "u" || next === "ü") && VOWEL_LETTER.has(w[i + 2] ?? "")) {
            const base = c === "q" ? "k" : "ɡ";
            out.push(next === "ü" || !FRONT_LETTER.has(w[i + 2]!) ? base + "w" : base);
            i += 2;
            continue;
        }
        if (c === "c") { out.push(FRONT_LETTER.has(next) ? "θ" : "k"); i += 1; continue; } // distinción: c+e/i → [θ]
        if (c === "g") { out.push(FRONT_LETTER.has(next) ? "x" : "ɡ"); i += 1; continue; } // g+e/i → [x] (jota)
        // the RISING glides: ⟨i⟩→[j], ⟨u⟩→[w] before another vowel.
        if (c === "i" && VOWEL_LETTER.has(next)) { out.push("j"); i += 1; continue; }
        if (c === "u" && VOWEL_LETTER.has(next)) { out.push("w"); i += 1; continue; }
        // ⟨y⟩ → [ʝ] as an onset (before a vowel), [i] as a coda offglide (rey→rei).
        if (c === "y") { out.push(VOWEL_LETTER.has(next) ? "ʝ" : "i"); i += 1; continue; }
        // word-initial ⟨r⟩ → [r] trill (single ⟨r⟩ is the tap [ɾ] via the table; ⟨rr⟩ is the digraph above).
        if (c === "r" && i === 0) { out.push("r"); i += 1; continue; }
        // ⚠ A letter with no rule here still denotes a sound; dropping it deletes what the writer typed.
        // Consulted AFTER every digraph and single-letter rule, so it cannot override this language (#663).
        const ph = G[c] ?? latinPhone(c);
        if (ph !== undefined && ph !== "") out.push(ph);
        i += 1;
    }
    // WORD-FINAL ⟨-r⟩ APOCOPE: a final tap [ɾ] after a vowel is dropped (the documented Aragonese trait, shared
    // with Catalan/Occitan: cantar→[kanˈta], banyar→[baˈɲa]). The referee attests BOTH the dropped and the
    // spelling-pronunciation form (dialect-variable) → the dropped form is the phonetically-accurate default.
    if (out.length >= 2 && out[out.length - 1] === "ɾ" && IPA_VOWEL.has(out[out.length - 2]!)) out.pop();
    return out;
}

/** ⟨n⟩ → [m] before a labial [b p m] (⟨v⟩ is already [b]). */
function labialNasal(toks: string[]): void {
    for (let i = 0; i < toks.length - 1; i++) {
        if (toks[i] === "n" && (toks[i + 1] === "b" || toks[i + 1] === "p" || toks[i + 1] === "m")) toks[i] = "m";
    }
}

/** Phonemize a single Aragonese word to canonical IPA (segmental; stress + spirantization folded/deferred). */
export function phonemizeWord(word: string): string {
    const toks = scan(word);
    labialNasal(toks);
    return toks.join("");
}

// A word (Aragonese Latin letters incl. ñ, accents, ü) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'·")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zñáéíóúüïA-ZÑÁÉÍÓÚÜÏ'·]";
const nat = makeNativiser(NATIVE_CLASS, "u");

class AragonesePhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
            // A digit run reads as Aragonese number WORDS, each phonemized like any other word.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) { const mk = CLAUSE_MARK[m[3]]; if (mk) sink.pause(mk); }
        });
    }
}

/** Build the Aragonese phonemizer (Spanish-shaped Ibero-Romance g2p + ch/ny/x deltas + seseo + final-r drop). */
export function createAragonese(): Phonemizer {
    return new AragonesePhonemizer();
}
