/**
 * Māori (mi) phonemizer — te reo Māori, Eastern Polynesian, Latin script, canonical IPA, espeak-independent. One of
 * the simplest orthographies in the fleet: a near-1:1 phonemic grapheme map + the macron = LENGTH + two digraphs
 * (⟨wh⟩→[ɸ], ⟨ng⟩→[ŋ]). Strict CV syllables — no codas, no clusters, no glide formation, so a plain longest-match
 * scan suffices. Stress (mora-based, unwritten) is not emitted. See docs/investigations/mi_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

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
        const ph = G[w[i]!];
        if (ph !== undefined) out.push(ph);
        i += 1;
    }
    return out.join("");
}

// A word (Māori Latin letters incl. the macron vowels ā ē ī ō ū) / number / punctuation token. Numbers deferred.
const TOKEN = /([a-zāēīōūA-ZĀĒĪŌŪ'ʻ-]+)|(\d+)|([.!?…,;:])/gu;

class MaoriPhonemizer implements Phonemizer {
    text(input: string): string {
        return assembleClauses(input, TOKEN, (m, sink) => {
            if (m[1]) sink.emit(phonemizeWord(m[1]));
            else if (m[2]) sink.emit(m[2]); // numbers deferred (digits passed through)
            else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) sink.pause(mk);
            }
        });
    }
}

/** Build the Māori phonemizer (direct phonemic g2p + macron length + the ⟨wh ng⟩ digraphs). */
export function createMaori(): Phonemizer {
    return new MaoriPhonemizer();
}
