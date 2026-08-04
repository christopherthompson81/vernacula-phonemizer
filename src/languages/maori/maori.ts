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

class MaoriPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(normalizeMaori(input), TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(nat(m[1])));
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
export function createMaori(): Phonemizer {
    return new MaoriPhonemizer();
}
