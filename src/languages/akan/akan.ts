/**
 * Native Akan / Akan kasa (ak) text phonemizer — canonical IPA, espeak-independent. Akan is a Kwa (Niger-Congo)
 * language of Ghana (~20M incl. L2) — the fleet's FIRST Kwa language. It has a shallow, well-standardised Latin
 * orthography (Bureau of Ghana Languages; the Asante/Akuapem Twi and Fante varieties share it), so a near
 * one-to-one rule g2p. The letter maps live in akan.jsonc; the contextual bits are here:
 *
 *   • CONSONANT DIGRAPHS (longest-match) — a palatal series ⟨ky gy hy ny⟩ → t͡ɕ d͡ʑ ɕ ɲ and a LABIALISED series
 *     ⟨tw dw kw gw hw nw⟩ → t͡ɕʷ d͡ʑʷ kʷ ɡʷ ɕʷ ŋʷ (the signature Akan labial-palatalisation), plus ⟨ng⟩ → ŋ.
 *   • GLIDE FORMATION (Paster 2010) — a round vowel ⟨o ɔ u⟩ before another vowel becomes the on-glide [w]
 *     (boa→bwa, uafɔn→wafɔ̃); front vowels stay in hiatus.
 *   • CODA nasal — a syllable-final ⟨n⟩ assimilates to the following consonant's PLACE (velar → ŋ, labial → m,
 *     else n); an onset ⟨n⟩ before a vowel stays n.
 *   • the combining tilde ⟨◌̃⟩ (rare, disambiguating) passes through as vowel nasalisation.
 *
 * TONE (H/L) is phonemic but NOT written in the standard Akan orthography → DEFERRED (no tone emitted). The
 * ATR-harmony allophones are likewise unwritten — the orthography merges [e]/[ɪ] into ⟨e⟩ and [o]/[ʊ] into ⟨o⟩
 * (Paster 2010, Dolphyne 1988), so ⟨e⟩/⟨o⟩ are rendered at their [+ATR] phonemic values [e]/[o]. Small kaikki
 * human gold (no wikipron/epitran Akan) → 🔷 single-source. See docs/investigations/ak_native_bringup_investigation.md.
 */
import type { Phonemizer } from "../../registry.ts";
import { assembleClauses } from "../../core/clauses.ts";
import { loadManifest } from "../../core/loadManifest.ts";

interface AkanDef {
    digraphs: Record<string, string>;
    consonants: Record<string, string>;
    vowels: Record<string, string>;
    clausePunctuation: Record<string, string>;
}

const DEF = loadManifest<AkanDef>(import.meta.url, "akan.jsonc");
const TILDE = "̃"; // combining nasalisation
const isVowel = (c: string | undefined): boolean => c !== undefined && c in DEF.vowels;

/** One Akan word → canonical IPA (segmental; tone deferred). */
export function phonemizeWord(word: string): string {
    const s = [...word.toLowerCase()];
    const n = s.length;
    const out: string[] = [];
    let i = 0;
    while (i < n) {
        const c = s[i]!;
        const nx = s[i + 1];
        const two = c + (nx ?? "");
        // consonant digraphs first (ky gy hy ny tw dw kw gw hw nw ng)
        if (two in DEF.digraphs) { out.push(DEF.digraphs[two]!); i += 2; continue; }
        if (c in DEF.vowels) {
            // GLIDE FORMATION (Paster 2010): a round vowel o/ɔ/u before a DIFFERENT vowel becomes [w] (boa→bwa,
            // uafɔn→wafɔ̃) — the round vowel's mora deletes. Not before the same vowel (uu/oo = length, not glide).
            if ("oɔu".includes(c) && isVowel(nx) && nx !== c) { out.push("w"); i += 1; continue; }
            out.push(DEF.vowels[c]!); i += 1; continue;
        }
        // ⟨n⟩: an onset before a vowel stays n; before a consonant it assimilates to that consonant's PLACE
        // (velar k/g → ŋ, labial p/b/f/m → m, else n; word-final stays n); a literal ⟨ŋ⟩ (kaikki) passes through.
        if (c === "n") {
            const p = isVowel(nx) ? "n" : nx === "k" || nx === "g" ? "ŋ" : nx === "p" || nx === "b" || nx === "f" || nx === "m" ? "m" : "n";
            out.push(p); i += 1; continue;
        }
        if (c === "ŋ") { out.push("ŋ"); i += 1; continue; }
        if (c in DEF.consonants) { out.push(DEF.consonants[c]!); i += 1; continue; }
        if (c === TILDE) { if (out.length) out[out.length - 1] += TILDE; i += 1; continue; } // nasalisation on the vowel
        i += 1; // unknown → skip
    }
    return out.join("").normalize("NFC");
}

const TOKEN = /([a-zɛɔ̃]+)|(\d+)|([.?!,;:])/gu;

/** Build the Akan phonemizer. `foreign` handles embedded Latin/other runs (none native — Akan IS Latin). */
export function createAkan(foreign?: (s: string) => string): Phonemizer {
    return {
        text(input: string): string {
            return assembleClauses(input, TOKEN, (m, sink) => {
                if (m[1]) sink.emit(phonemizeWord(m[1]));
                else if (m[2]) sink.emit(foreign ? foreign(m[2]) : m[2]);
                else if (m[3]) {
                    const mk = DEF.clausePunctuation[m[3]];
                    if (mk) sink.pause(mk);
                }
            });
        },
    };
}
