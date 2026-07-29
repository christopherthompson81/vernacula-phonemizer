/**
 * French (fr) phonemizer — canonical IPA (standard/Parisian), espeak-independent. Primary path is a
 * pronunciation LEXICON (Lexique 3.83, ~125k forms) that carries every irregular as data; the rule-based
 * g2p (g2p.ts) is the out-of-vocabulary fallback for unseen words. text() tokenizes words / numbers /
 * punctuation; French has no lexical stress, so a single phrase-final accent marks each rhythmic group.
 */
import type { Phonemizer } from "../../registry.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { toIpa } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Lexique 3.83 pronunciation lexicon: word → IPA for ~125k attested forms, loaded once (lazily).
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEXICON === undefined) LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv");
    return LEXICON;
}

/** The Lexique pronunciation lexicon (lowercased word → IPA). Exposed so the async neural path (frNeural.ts) can skip
 *  lexicon-covered words — they are served authoritatively by the sync lexicon path. */
export function frenchLexicon(): Map<string, string> {
    return lexicon();
}

const VOWEL_IPA = /[aeiouyɛɔøœəɑ]/;

/** Per-call OOV resolver: lowercased word → IPA, or undefined to defer to the rule engine. Consulted BETWEEN the
 *  lexicon and the rule g2p (lexicon → oovOverride → toIpa); used only by the async neural path (frNeural.ts). */
export type OovResolver = (lowerWord: string) => string | undefined;

/** One French word → IPA: lexicon lookup first, then the neural tagger (oovOverride, async path only), then the g2p
 *  engine for out-of-vocabulary words. */
export function phonemizeWord(word: string, oovOverride?: OovResolver): string {
    const lower = word.toLowerCase();
    return lexicon().get(lower) ?? oovOverride?.(lower) ?? toIpa(word);
}

/** Add a phrase-final accent: ˈ before the last vowel of the last IPA token (rhythmic-group stress). */
function accentFinal(tokens: string[]): void {
    for (let k = tokens.length - 1; k >= 0; k--) {
        const t = tokens[k]!;
        if (!VOWEL_IPA.test(t)) continue;
        const m = [...t.matchAll(/[aeiouyɛɔøœəɑ]/g)];
        const last = m[m.length - 1]!;
        tokens[k] = t.slice(0, last.index) + "ˈ" + t.slice(last.index);
        return;
    }
}

const CLAUSE_MARK = MANIFEST.clausePunctuation;
const TOKEN =
    /([a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/giu;

// Obligatory liaison: a normally-silent final consonant of a function word / number is pronounced as the
// onset of a following vowel-initial word. z after plural determiners/pronouns & the -x/-s numbers; n after
// nasal monosyllables; t after est/sont/tout/petit… (grand/quand: d→t). Attached to the next word (re-syllabified).
const LIAISON = MANIFEST.liaison;
// h aspiré (and vowel-initial words that block liaison, e.g. huit/onze/y-): the following word looks
// vowel-initial but forbids liaison — les héros → le eʁo, not le zeʁo.
const H_ASPIRE = new Set(MANIFEST.hAspire);
const STARTS_VOWEL = /^[aeiouyàâäéèêëîïôöûüùœæh]/i; // h → treat as mute unless the word is in H_ASPIRE
function liaisonOnto(prev: string, next: string): string {
    const c = LIAISON[prev.toLowerCase()];
    if (!c) return "";
    const nx = next.toLowerCase();
    const aspire = H_ASPIRE.has(nx) || H_ASPIRE.has(nx.replace(/s$/, "")); // plural: homards, haricots
    return STARTS_VOWEL.test(nx) && !aspire ? c : "";
}
// The liaison consonant re-syllabifies as the next word's onset; if the citation form already realises that
// latent consonant (cet→sɛt, six→sis, dix→dis), strip it here so it isn't doubled. z↔final s/z, t↔t/d, n↔n.
const LATENT: Record<string, RegExp> = { z: /[sz]$/, t: /[td]$/, n: /n$/ };
function stripLatent(ipa: string, c: string): string {
    return LATENT[c]?.test(ipa) ? ipa.slice(0, -1) : ipa;
}

// #562 symbol normalization — French words for %, currency signs, and unit abbreviations.
const SYMBOLS = makeSymbolNormalizer({
    percent: ["pour cent"],
    currency: { "€": ["euro", "euros"], "$": ["dollar", "dollars"], "£": ["livre", "livres"], "¥": ["yen", "yens"] },
    units: { km: ["kilomètre", "kilomètres"], cm: ["centimètre", "centimètres"], mm: ["millimètre", "millimètres"],
        kg: ["kilogramme", "kilogrammes"], mg: ["milligramme", "milligrammes"] },
    magnitudes: ["millions", "million", "milliards", "milliard"],
});


// #562 roman numerals, French — the corpus pattern is the CENTURY ordinal (xviie siècle → dix-septième
// siècle, written with an -e/-ème suffix); a BARE roman (louis xiv) is read as a cardinal, which is how
// French speaks name-attached numerals (louis quatorze) — no context wordlist needed, unlike English.
// Same closed 2–20 set as English, same exclusions (vi/xi and single letters are words/too ambiguous).
const FR_ROMAN: Record<string, number> = {
    ii: 2, iii: 3, iv: 4, vii: 7, viii: 8, ix: 9, xii: 12, xiii: 13, xiv: 14,
    xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
};
const FR_ORDINAL: Record<number, string> = {
    2: "deuxième", 3: "troisième", 4: "quatrième", 7: "septième", 8: "huitième", 9: "neuvième",
    12: "douzième", 13: "treizième", 14: "quatorzième", 15: "quinzième", 16: "seizième",
    17: "dix septième", 18: "dix huitième", 19: "dix neuvième", 20: "vingtième",
};
function normalizeFrenchRomans(text: string): string {
    // suffixed → ordinal word (xviie / xviième / xviieme siècle)
    let s = text.replace(/\b(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)(e|ème|eme|è)\b/gi,
        (_m, rom: string) => FR_ORDINAL[FR_ROMAN[rom.toLowerCase()]!]!);
    // bare → cardinal digits (louis xiv → louis 14), spoken by the existing number path
    s = s.replace(/\b(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\b/gi,
        (_m, rom: string) => String(FR_ROMAN[rom.toLowerCase()]!));
    return s;
}

class FrenchPhonemizer implements Phonemizer {
    constructor(private readonly foreign?: (latin: string) => string) {}

    // `oovOverride` (neural path only, frNeural.ts) resolves OOV words between the lexicon and the rule g2p; the sync
    // path omits it, so tokenizer / numbers / liaison / accentuation are byte-identical to phonemize(text, "fr").
    text(input: string, oovOverride?: OovResolver): string {
        input = normalizeFrenchRomans(SYMBOLS(input)); // #562
        // Flatten to a sequence of word strings / pause marks (numbers expand to their spelled words), so liaison
        // can look one word ahead across the whole stream (incl. spelled numbers: "2 ans" → deux → dø zˈɑ̃).
        type Item = { word: string } | { pause: string };
        const items: Item[] = [];
        for (const m of input.matchAll(TOKEN)) {
            if (m[1]) items.push({ word: m[1] });
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const w of numberToWords(Number(intPart)).split(" "))
                    items.push({ word: w });
                if (frac !== undefined) {
                    // decimal: "virgule" + digit-by-digit
                    items.push({ word: MANIFEST.numbers.decimalSeparator });
                    for (const d of frac)
                        for (const w of numberToWords(Number(d)).split(" "))
                            items.push({ word: w });
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) items.push({ pause: mk });
            }
        }

        let group: string[] = []; // IPA tokens of the current rhythmic group (until a pause)
        let out = "";
        let carry = ""; // liaison consonant to prepend to the next word (its new onset)
        const flush = (pause: string | null): void => {
            if (group.length) {
                accentFinal(group);
                out += (out ? " " : "") + group.join(" ");
                group = [];
            }
            if (pause) out += ` ${pause}`;
        };
        for (let k = 0; k < items.length; k++) {
            const it = items[k]!;
            if ("pause" in it) {
                carry = "";
                if (group.length || out) flush(it.pause);
                continue;
            } // liaison never crosses a pause
            let ipa = carry + phonemizeWord(it.word, oovOverride);
            carry = "";
            const next = items[k + 1]; // liaison only onto an immediately adjacent word
            if (next && "word" in next) {
                carry = liaisonOnto(it.word, next.word);
                if (carry) ipa = stripLatent(ipa, carry); // avoid doubling a citation-realised final consonant
            }
            if (ipa) group.push(ipa);
        }
        flush(null);
        return out;
    }
}

/** Build the French phonemizer. `foreign` handles embedded non-French (unused for now). No data files. The returned
 *  `text` takes an optional per-call `oovOverride` (neural path only) injecting tagger readings for OOV words
 *  (lexicon → oovOverride → rule g2p); still assignable to Phonemizer. */
export function createFrench(
    foreign?: (latin: string) => string,
): { text(input: string, oovOverride?: OovResolver): string } {
    return new FrenchPhonemizer(foreign);
}
