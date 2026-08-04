/**
 * Māori (mi) phonemizer — te reo Māori, Eastern Polynesian, Latin script, canonical IPA, espeak-independent. One of
 * the simplest orthographies in the fleet: a near-1:1 phonemic grapheme map + the macron = LENGTH + two digraphs
 * (⟨wh⟩→[ɸ], ⟨ng⟩→[ŋ]). Strict CV syllables — no codas, no clusters, no glide formation, so a plain longest-match
 * scan suffices. Stress (mora-based, unwritten) is not emitted. Cardinal numbers: numbers.ts (the modern tekau mā series). See docs/investigations/mi_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { latinPhone } from "../../core/latinPhones.ts";
import { hostWordRun, makeNativiser } from "../../core/hostWord.ts";
import { loadManifest } from "../../core/loadManifest.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeMaori } from "./normalize.ts";

interface MaoriDef {
    digraphs: Record<string, string>;
    graphemes: Record<string, string>;
    clausePunctuation: Record<string, string>;
}
const DEF = loadManifest<MaoriDef>(import.meta.url, "maori.jsonc");
const DIGRAPHS = DEF.digraphs;
const G = DEF.graphemes;
const CLAUSE_MARK = DEF.clausePunctuation;
const ORDER = Object.keys(DIGRAPHS).sort((a, b) => b.length - a.length);

/** Phonemize a single Māori word to canonical IPA — a longest-match scan (the ⟨wh ng⟩ digraphs, then single graphemes). */
export function phonemizeWord(word: string): string {
    const w = word.normalize("NFC").toLowerCase();
    const out: string[] = [];
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) {
            if (w.startsWith(key, i)) { out.push(DIGRAPHS[key]!); i += key.length; continue outer; }
        }
        // ⚠ NOT SILENTLY: a letter this g2p has no rule for still denotes a sound, and dropping it deletes
        // content the writer typed. `latinPhone` is consulted HERE, after every digraph and single-letter rule
        // has been tried, so it can never override a reading this language has an opinion about (#663).
        const ph = G[w[i]!] ?? latinPhone(w[i]!);
        if (ph !== undefined) out.push(ph);
        i += 1;
    }
    return out.join("");
}

// A word (Māori Latin letters incl. the macron vowels ā ē ī ō ū) / number / punctuation token.
const TOKEN = new RegExp(`(${hostWordRun(["Latin"], "'ʻ-")})|(\\d+)|([.!?…,;:])`, "gu");

/**
 * This language's OWN inventory — the TOKEN word class as it stood before the widening above, lifted
 * verbatim, so nothing about the orthography is invented here. A token this REJECTS carries a letter the
 * language does not use, i.e. a foreign name. See core/hostWord.ts: this is the INVENTORY question, and it
 * is no longer also deciding where the script boundary falls (#657).
 */
const NATIVE_CLASS = "[a-zāēīōūA-ZĀĒĪŌŪ'ʻ-]";
const nat = makeNativiser(NATIVE_CLASS, "u");
/**
 * Can Māori spell this word at all? Decides ROUTING, and it is a different question from `NATIVE_CLASS`.
 *
 * ⚠ `NATIVE_CLASS` IS THE TOKEN CLASS, NOT THE ALPHABET — it spans `a-zA-Z`, because that is what the tokenizer
 * needs in order to claim a word at all. Using it to decide routing routes NOTHING: `Safari` is entirely ASCII, so
 * it tests as native and never reaches the reader. The two have been distinct all along and the names hid it; for
 * the #657 fold the difference was invisible, because that fold only ever fires on a NON-ASCII letter.
 *
 * ⚠ IT WALKS THE WORD THE WAY THE G2P DOES — longest digraph first, then a single grapheme — rather than testing
 * membership in a flat letter set. A flat set has to admit `g` for the sake of ⟨ng⟩, and then a standalone `g`
 * slips through: `heritage` tested as Māori-spellable and was read *heɾitaɡ* instead of being routed. Walking the
 * word means `g` is native only where ⟨ng⟩ actually claims it, which is the same rule the engine applies, so the
 * two cannot disagree.
 */
function isNativeWord(word: string): boolean {
    const w = word.normalize("NFC").toLowerCase();
    let i = 0;
    outer: while (i < w.length) {
        for (const key of ORDER) if (w.startsWith(key, i)) { i += key.length; continue outer; }
        if (G[w[i]!] !== undefined || "'ʻ-".includes(w[i]!)) { i += 1; continue; }
        return false;
    }
    return true;
}

/** Read a Latin run with another language's engine — injected from the registry (English). */
export type ForeignPhonemizer = (latin: string) => string;

class MaoriPhonemizer implements Phonemizer {
    constructor(private foreign?: ForeignPhonemizer) {}
    text(input: string): string {
        return assembleClauses(normalizeMaori(input), TOKEN, (m, sink) => {
            // ⚠ A NON-MĀORI WORD IS ROUTED, NOT NATIVISED (#663). Māori is strictly (C)V — no codas, no clusters
            // — and a letter-by-letter substitution cannot repair either, because it has no notion of syllable
            // structure. Giving each missing letter a phone stopped the DELETION (`Safari` had been reading
            // *aaɾi*, `United States` *unite tate*) and left the reading phonotactically illegal: `Xerox` →
            // *kseɾoks*, an initial cluster and a coda; `Christmas` → *khɾistmas*. Real Māori nativisation inserts
            // an echo vowel and resolves every cluster — Christmas → Kirihimete, Scotland → Kōtirana — which is
            // per-language loan phonology and genuinely sourced data, not a letter table.
            //
            // Until that exists, an English reading is the honest answer for a word Māori cannot spell: the wrong
            // voice, but legal phones and a recognisable name. THIRTEEN of twenty-six letters are outside this
            // alphabet, which makes Māori the fleet's most extreme case rather than a typical one — most of the 45
            // engines measured in #663 are missing one or two letters and need no routing.
            //
            // The floor stays underneath: `nat` still applies on the native branch, and `latinPhone` still backs
            // the g2p, for the case where no reader is injected (direct engine use, or a test).
            if (m[1]) sink.emit(
                isNativeWord(m[1]) || this.foreign === undefined
                    ? phonemizeWord(nat(m[1]))
                    : this.foreign(m[1]),
            );
            // Cardinal numbers (numbers.ts) — emitted one word at a time, as for ordinary text.
            else if (m[2]) for (const wd of numberToWords(Number(m[2])).split(" ")) sink.emit(phonemizeWord(wd));
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Māori phonemizer (direct phonemic g2p + macron length + the ⟨wh ng⟩ digraphs + cardinal numbers). */
export function createMaori(foreign?: ForeignPhonemizer): Phonemizer {
    return new MaoriPhonemizer(foreign);
}
