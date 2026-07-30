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
import { normalizeFrenchOrdinalDigits, normalizeFrenchOrdinalRomans } from "./ordinals.ts";
import { normalizeRomans } from "../../core/roman.ts";
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
    const direct = lexicon().get(lower) ?? oovOverride?.(lower);
    if (direct !== undefined) return direct;
    // Hyphenated compound that Lexique does not attest: resolve each element and join WITHOUT a space.
    // A French hyphen is not a word boundary for pronunciation — quarante-et-un is [kaʁɑ̃teœ̃], one
    // phonological word — so concatenating the parts is right where a space would insert a break and
    // suppress the join. Parts contain no hyphen, so the recursion is one level deep.
    if (lower.includes("-")) {
        const parts = lower.split("-").filter((p) => p !== "");
        if (parts.length > 1) return parts.map((p) => phonemizeWord(p, oovOverride)).join("");
    }
    return toIpa(word);
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
// The word class admits an internal HYPHEN as well as an apostrophe, so a hyphenated compound arrives as
// one token and can resolve against Lexique's ~4.2k attested compounds (dix-septième → [disɛtjɛm],
// peut-être → [pøtɛtʁ]). Splitting at the hyphen phonemized each half in isolation, which lost exactly
// the compound-internal liaison the hyphen marks. The hyphen must sit BETWEEN letters, so a dash between
// words ("Paris — Lyon") and a digit range ("1918-1939") are unaffected.
const TOKEN =
    /([a-zà-ÿœæ]+(?:[-'’][a-zà-ÿœæ]+)*)|(\d+(?:[.,]\d+)?)|([.!?…,;:])/giu;

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


/**
 * #562 — numeral normalization, run before tokenization. Three passes, in this order:
 *   1. ROMAN ORDINALS (XVIIe siècle → dix-septième siècle). Must precede pass 3, or the bare-Roman pass
 *      would rewrite XVII to digits and leave a stranded "e" to be spoken as a word.
 *   2. DIGIT ORDINALS (1er → premier, 37e → trente-septième). This is what the corpus actually contains:
 *      no Roman ordinal occurs in fr FLEURS at all, while 1er/37e/190e/60e/5e/3e/11e/15e occur 48 times.
 *   3. BARE ROMANS → digits (louis XIV → louis 14), spoken by the cardinal path. French reads a
 *      name-attached numeral as a CARDINAL (louis quatorze), so no context wordlist is needed here,
 *      unlike English. Delegated to the shared pass, which supplies the case discipline and the
 *      cross-language homograph stoplist (dix, mi, di, ci, li, vi, xi, mm/cm/ml …).
 * Ordinal formation itself lives in ordinals.ts; it is unbounded, replacing a hardcoded 2–20 table.
 */
function normalizeFrenchNumerals(text: string): string {
    const s = normalizeFrenchOrdinalRomans(text, (w) => lexicon().has(w));
    return normalizeRomans(normalizeFrenchOrdinalDigits(s));
}

class FrenchPhonemizer implements Phonemizer {
    constructor(private readonly foreign?: (latin: string) => string) {}

    // `oovOverride` (neural path only, frNeural.ts) resolves OOV words between the lexicon and the rule g2p; the sync
    // path omits it, so tokenizer / numbers / liaison / accentuation are byte-identical to phonemize(text, "fr").
    text(input: string, oovOverride?: OovResolver): string {
        input = normalizeFrenchNumerals(SYMBOLS(input)); // #562
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
