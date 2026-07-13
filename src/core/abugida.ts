/**
 * GENERIC abugida grapheme-to-phoneme engine — the divestment path (NO espeak rules/tables/dict).
 *
 * All language-specifics live in a plain, self-describing JSONC definition (see
 * `data/native/<lang>.jsonc`); this file is a thin, DECLARATIVE-DRIVEN interpreter of it. That's
 * deliberate for portability: to reimplement in C# (or any environment) you port this ~80-line
 * algorithm and load the SAME data file — no per-language logic to re-translate.
 *
 * Covers the systematic core of a Brahmic abugida: consonant + inherent vowel, dependent vowel
 * signs (matras), virama (vowel suppression / clusters), independent vowels, nukta composition, and
 * the combining signs (anusvara → nasalized vowel + homorganic nasal; chandrabindu → nasalization;
 * visarga → [h]). Schwa deletion (the one non-trivial rule) is applied separately via the shared
 * `deleteMedialSchwa`, parameterised by the definition. Stress and numbers are layered on top.
 */

import type { Phonology } from "./phonology.ts";

export interface AbugidaDef {
    language: string;
    inherentVowel: string;
    consonants: Record<string, { ipa: string }>;
    independentVowels: Record<string, { ipa: string }>;
    vowelSigns: Record<string, { ipa: string }>;
    signs: {
        virama: { char: string };
        anusvara: { char: string };
        chandrabindu: { char: string };
        visarga: { char: string };
        nukta: { char: string };
    };
    nasalVowelsAreShort?: boolean;
}

/** Build a word→IPA function (inherent vowels intact; schwa deletion applied by the caller). */
export function makeAbugidaG2P(
    def: AbugidaDef,
    phon: Phonology,
): (word: string) => string {
    const C = def.consonants,
        IV = def.independentVowels,
        VS = def.vowelSigns;
    // Longest-prefix place lookup: sort keys so t͡ʃ / t̪ win over any shorter prefix. `""` (no match) →
    // homorganicNasal[""] is undefined, so no nasal is inserted (same as the old `place() === ""` path).
    const placeKeys = Object.keys(phon.placeOfArticulation).sort(
        (a, b) => b.length - a.length,
    );
    const place = (ipa: string): string => {
        for (const k of placeKeys)
            if (ipa.startsWith(k)) return phon.placeOfArticulation[k]!;
        return "";
    };
    const VIR = def.signs.virama.char,
        AN = def.signs.anusvara.char,
        CH = def.signs.chandrabindu.char;
    const VIS = def.signs.visarga.char,
        NK = def.signs.nukta.char;
    const inh = def.inherentVowel,
        nasalShort = def.nasalVowelsAreShort ?? true;

    return function g2p(word: string): string {
        const s = [...word.normalize("NFC")];
        let out = "",
            i = 0;
        const nasalize = () => {
            if (nasalShort) out = out.replace(/ː$/, "");
            if (!/̃/.test(out.slice(-2))) out += "̃";
        };
        const signs = () => {
            while (
                i < s.length &&
                (s[i] === AN || s[i] === CH || s[i] === VIS)
            ) {
                if (s[i] === VIS) out += "h";
                else {
                    nasalize();
                    if (s[i] === AN) {
                        // anusvara also emits the homorganic nasal before a stop
                        const nx = s[i + 1];
                        const nc =
                            nx &&
                            (nx in C
                                ? C[nx]!.ipa
                                : nx + NK in C
                                  ? C[nx + NK]!.ipa
                                  : "");
                        const hn = nc ? phon.homorganicNasal[place(nc)] : "";
                        if (hn) out += hn;
                    }
                }
                i++;
            }
        };
        while (i < s.length) {
            let ch = s[i]!;
            if (i + 1 < s.length && s[i + 1] === NK && ch + NK in C) {
                ch = ch + NK;
                i++;
            }
            if (ch in C) {
                out += C[ch]!.ipa;
                i++;
                if (s[i] === VIR) i++;
                else if (s[i]! in VS) {
                    out += VS[s[i]!]!.ipa;
                    i++;
                    signs();
                } else {
                    out += inh;
                    signs();
                }
            } else if (ch in IV) {
                out += IV[ch]!.ipa;
                i++;
                signs();
            } else i++;
        }
        return out;
    };
}
