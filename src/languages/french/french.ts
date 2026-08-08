/**
 * French (fr) phonemizer — canonical IPA (standard/Parisian). Primary path is a
 * pronunciation LEXICON (Lexique 3.83, ~125k forms) that carries every irregular as data; the rule-based
 * g2p (g2p.ts) is the out-of-vocabulary fallback for unseen words. text() tokenizes words / numbers /
 * punctuation; French has no lexical stress, so a single phrase-final accent marks each rhythmic group.
 */
import type { Phonemizer } from "../../registry.ts";
import { readForeignRun } from "../../core/foreign.ts";
import { FOREIGN_RUN } from "../../core/clauses.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { toIpa } from "./g2p.ts";
import { numberToWords } from "./numbers.ts";
import { normalizeFrenchOrdinalDigits, normalizeFrenchOrdinalRomans } from "./ordinals.ts";
import { normalizeFrench, normalizeFrenchInitialisms } from "./normalize.ts";
import { normalizeRomans } from "../../core/roman.ts";
import { MANIFEST } from "./manifest.ts";
import { loadTsvMap } from "../../core/loadTsv.ts";

// Lexique 3.83 pronunciation lexicon: word → IPA for ~125k attested forms, loaded once (lazily).
let LEXICON: Map<string, string> | undefined;
function lexicon(): Map<string, string> {
    if (LEXICON === undefined) LEXICON = loadTsvMap(import.meta.url, "lexicon.tsv");
    return LEXICON;
}

/**
 * SUPPLEMENT — our own cleanroom pronunciations for words Lexique 3.83 does not contain and the rule g2p
 * gets wrong. Kept as a SEPARATE file from lexicon.tsv on purpose: that file is provenanced Lexique data,
 * and editing it would muddy both its provenance and any future re-import. This one is additive only —
 * every key here is absent from Lexique, so the two can never disagree and Lexique stays authoritative
 * for everything it covers.
 *
 * ⚠ THE ENTRIES EXIST BECAUSE normalize.ts EMITS WORDS ORDINARY TEXT NEVER CONTAINS, so a word that was
 * previously unreachable is suddenly on the hot path: `20 °C` → "degrés celsius", where the g2p drops the
 * final ⟨s⟩ that French sounds in this Latin loan ([sɛlsjys], not [sɛlsjy]).
 *
 * Audited rather than guessed: every word the normalizer can emit was checked against Lexique, and only the
 * ones actually wrong are listed — which is why this is three lines and not twenty-two.
 *
 * ⚠ DELIBERATE NON-ENTRY: `Jésus-Christ`. The g2p gives [ʒezykʁist] and the traditional dictionary form is
 * [ʒezykʁi], but both are current in speech, so the existing reading is a legitimate variant rather than a
 * defect and is left alone.
 */
let SUPPLEMENT: Map<string, string> | undefined;
function supplement(): Map<string, string> {
    if (SUPPLEMENT === undefined) SUPPLEMENT = loadTsvMap(import.meta.url, "supplement.tsv");
    return SUPPLEMENT;
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
    const direct = lexicon().get(lower) ?? supplement().get(lower) ?? oovOverride?.(lower);
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

// ── Heteronyms ──────────────────────────────────────────────────────────────────────────────────────
/**
 * One spelling with two readings, selected by the NEIGHBOURING words. French has no POS tagger, and
 * Lexique carries a single reading per spelling, so the alternate lives in french.jsonc together with the
 * context that picks it. Resolution runs in text(), which is the only place with neighbours — a bare
 * phonemizeWord() call has no context and keeps returning the Lexique reading.
 */
const HETERONYMS = MANIFEST.heteronyms;

/** Clitics that can sit between a subject pronoun and its verb ("ils NE content pas", "ils SE couvent"),
 *  so the pronoun test looks one word further back when it finds one. Without this, the -ent verb rule
 *  would miss every negated or reflexive clause. */
const CLITIC = new Set(["ne", "se", "me", "te", "nous", "vous", "le", "la", "les", "lui", "leur", "y", "en"]);

const NUMBER_WORD = new Set([
    "zéro", "un", "une", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
    "onze", "douze", "treize", "quatorze", "quinze", "seize", "vingt", "trente", "quarante",
    "cinquante", "soixante", "cent", "mille", "million", "milliard",
]);

/** The heteronym reading for `word` given its neighbours, or undefined to fall through to the lexicon. */
function heteronymIpa(word: string, prev: string | undefined, prev2: string | undefined, next: string | undefined): string | undefined {
    const entry = HETERONYMS[word];
    if (entry === undefined) return undefined;
    for (const c of entry.cases) {
        if (c.nextIsNumber === true && next !== undefined && NUMBER_WORD.has(next)) return c.ipa;
        if (c.next !== undefined && next !== undefined && c.next.includes(next)) return c.ipa;
        if (c.prev !== undefined && prev !== undefined) {
            // Look past one clitic so a negated or reflexive 3rd-person-plural clause still matches.
            if (c.prev.includes(prev)) return c.ipa;
            if (CLITIC.has(prev) && prev2 !== undefined && c.prev.includes(prev2)) return c.ipa;
        }
    }
    // No case matched: fall through so the LEXICON supplies the reading. `default` is recorded in the
    // data as documentation of what that reading is, and is deliberately not re-asserted here.
    return undefined;
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
// ⚠ THE WORD CLASS ADMITS AN INTERNAL HYPHEN as well as an apostrophe, so a hyphenated compound arrives as
// ONE token and resolves against Lexique's attested compounds (dix-septième → [disɛtjɛm], peut-être →
// [pøtɛtʁ]). Splitting at the hyphen phonemizes each half in isolation and loses exactly the
// compound-internal liaison the hyphen marks. The hyphen must sit BETWEEN letters, so a dash between words
// ("Paris — Lyon") and a digit range ("1918-1939") are unaffected.
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

// French words for %, currency signs, and unit abbreviations.
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ THE AMPERSAND IS A LATIN-SCRIPT PRINTING LIGATURE, so what it takes is a READING and not a
    // translation. For a language written in Latin script that is its own conjunction; for one that is not,
    // the symbol only ever arrives inside a Latin run. Either way the tier substitutes the conjunction, SPACED —
    // see the tier, where the spacing exists because `B&B` is two initialisms.
    ampersand: "et",
    // `multiply` — this language DROPPED the sign outright. ⚠ STANDARD MATHEMATICAL REGISTER, not a corpus
    // attestation: the sweep failed exactly as the exponent sweep did, because the plausible hits are homographs
    // of PREPOSITIONS — es `por` ×23, it `per` ×25, ru `на` ×31 are all the preposition, never the operator.
    // One word, so `by` defaults to it; this language does not split dimension from product.
    multiply: { times: "fois" },
    percent: ["pour cent"],
    currency: { "€": ["euro", "euros"], "$": ["dollar", "dollars"], "£": ["livre", "livres"], "¥": ["yen", "yens"] },
    // Longest keys match first (the builder sorts by length), so km/h beats km and °c beats c.
    units: { km: ["kilomètre", "kilomètres"], cm: ["centimètre", "centimètres"], mm: ["millimètre", "millimètres"],
        kg: ["kilogramme", "kilogrammes"], mg: ["milligramme", "milligrammes"], g: ["gramme", "grammes"],
        t: ["tonne", "tonnes"], m: ["mètre", "mètres"], // ⚠ ⟨L⟩ AND ⟨l⟩ ARE BOTH OFFICIAL for the litre (⟨L⟩ is the dominant printed form), so BOTH are
        // declared — the one exception to the one-letter case rule in core/normalizeSymbols.ts, which
        // exists for symbols whose two cases are DIFFERENT units. Here they are the same unit.
        l: ["litre", "litres"], L: ["litre", "litres"], ml: ["millilitre", "millilitres"],
        cl: ["centilitre", "centilitres"], dl: ["décilitre", "décilitres"], ha: ["hectare", "hectares"],
        "km/h": ["kilomètre par heure", "kilomètres par heure"], "m/s": ["mètre par seconde", "mètres par seconde"],
        "°c": ["degré Celsius", "degrés Celsius"], "°f": ["degré Fahrenheit", "degrés Fahrenheit"],
        // ⚠ ⟨W⟩ capital (named after Watt) — a one-letter symbol resolves case-SENSITIVELY since #763. The
        // multi-letter kw/hz/khz/mhz still fold, so their sloppy spellings keep reading.
        kw: ["kilowatt", "kilowatts"], W: ["watt", "watts"], hz: ["hertz"], khz: ["kilohertz"], mhz: ["mégahertz"],
        go: ["gigaoctet", "gigaoctets"], mo: ["mégaoctet", "mégaoctets"], ko: ["kilooctet", "kilooctets"],
        min: ["minute", "minutes"] },
    // `kilomètres carrés` ×9 and `mètres cubes` ×2. The adjective agrees, so both numbers are listed; only
    // the PLURAL is corpus-attested (no `1 km²` occurs) and the singular is regular agreement, stated here
    // rather than left to look like an attested form.
    // ⚠ Bare `carré` ×2 is the SHAPE ("un carré dont le côté inférieur est manquant") — the collocation
    // with the unit noun is the attestation, never the bare word.
    exponentWords: { squared: ["carré", "carrés"], cubed: ["cube", "cubes"], position: "after" },
    // BARE EXPONENT — the reading for a power with NO unit to modify (`20²`, `mc²`), which every language
    // in the fleet was dropping silently. See `bareExponent` in core/normalizeSymbols.ts for why this cannot
    // reuse `exponentWords` above: that is the unit MODIFIER and this is the PREDICATE, and in most languages
    // they are different words (kilomètres carrés but vingt au carré).
    // ⚠ PROVENANCE, stated because it is weaker than most data in this repo: these are STANDARD MATHEMATICAL
    // REGISTER, not corpus attestations. The power words are ×0 in this language's artifact, and the apparent
    // hits for other languages were substring traps of exactly the kind tools/normalization/attest.ts warns
    // about — th `กำลัง` matched the progressive-aspect marker, fa `توان` and ar `أس` matched inside unrelated
    // words. FLEURS is news and encyclopedia prose and simply does not contain spoken arithmetic.
    // The cardinal is used for the generic power, never the ordinal — see core for that argument.
    bareExponent: { squared: "{n} au carré", cubed: "{n} au cube", power: "{n} puissance {e}" , negative: "moins" },
    magnitudes: ["millions", "million", "milliards", "milliard"],
    magnitudeConnective: "de", // cinq millions DE dollars
});


/**
 * numeral normalization, run before tokenization. Three passes, in this order:
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
        const isWord = (w: string): boolean => lexicon().has(w);
        // NORMALIZATION ORDER: general text normalization (abbreviations, era markers, numéro,
        // digit degrouping) → NUMERALS (roman ordinals, digit ordinals, bare romans) → INITIALISMS, which
        // must see the all-caps runs the numeral pass declined → SYMBOLS (%, currency, units) last, since
        // the time rule upstream has already claimed the hour marker.
        input = SYMBOLS(normalizeFrenchInitialisms(normalizeFrenchNumerals(normalizeFrench(input, isWord)), isWord));
        // Flatten to a sequence of word strings / pause marks (numbers expand to their spelled words), so liaison
        // can look one word ahead across the whole stream (incl. spelled numbers: "2 ans" → deux → dø zˈɑ̃).
        // An `ipa` item is a run in a script French does not own, ALREADY resolved by whichever engine
        // owns that script (core/scripts.ts). It carries phonemes, not text, because there is no French
        // pronunciation of Владимир to look up — and critically it must stay OUT of the liaison
        // machinery, which is why it is a third variant rather than a `word` holding IPA.
        type Item = { word: string } | { pause: string } | { ipa: string };
        const items: Item[] = [];
        // GAPS between tokens carry embedded foreign text. French's word class is Latin-1 only, so a
        // Greek or Cyrillic run matched nothing and was dropped outright. French cannot use
        // `assembleClauses` — liaison needs to look one word AHEAD across the whole flattened stream, so
        // the items list must exist before any phonemes are produced — but the gap pass is separable from
        // the clause model, as it is in english.ts and burmese.ts.
        let gapCursor = 0;
        const claimGap = (upto: number): void => {
            if (upto > gapCursor)
                for (const g of input.slice(gapCursor, upto).matchAll(FOREIGN_RUN)) {
                    const ipa = readForeignRun(g[0]);
                    if (ipa !== undefined && ipa !== "") items.push({ ipa });
                }
            gapCursor = upto;
        };
        for (const m of input.matchAll(TOKEN)) {
            claimGap(m.index ?? gapCursor);
            gapCursor = (m.index ?? gapCursor) + m[0].length;
            if (m[1]) items.push({ word: m[1] });
            else if (m[2]) {
                const [intPart, frac] = m[2].split(/[.,]/);
                for (const w of numberToWords(Number(intPart)).split(" "))
                    items.push({ word: w });
                if (frac !== undefined) {
                    // Decimal: "virgule" + the fractional part. French reads that part as a NUMBER
                    // (1,75 → un virgule soixante-quinze), not digit by digit, so long as doing so is
                    // unambiguous. A LEADING ZERO makes it ambiguous — reading "05" as a number would
                    // say 1,5 for 1,05 — and past three digits the number reading stops being useful,
                    // so both of those fall back to digit-by-digit.
                    items.push({ word: MANIFEST.numbers.decimalSeparator });
                    const asNumber = frac.length <= 3 && !frac.startsWith("0");
                    const parts = asNumber
                        ? numberToWords(Number(frac)).split(" ")
                        : [...frac].flatMap((d) => numberToWords(Number(d)).split(" "));
                    for (const w of parts) items.push({ word: w });
                }
            } else if (m[3]) {
                const mk = CLAUSE_MARK[m[3]];
                if (mk) items.push({ pause: mk });
            }
        }
        claimGap(input.length);

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
            if ("ipa" in it) {
                // A foreign run neither RECEIVES a liaison consonant nor DONATES one: it is not a French
                // word, so `liaisonOnto` has no lexicon entry to reason about and any carry would be
                // spliced onto foreign phonemes. The `"word" in next` guard below already prevents the
                // PREVIOUS word from setting a carry onto this item, so nothing is lost by clearing here.
                carry = "";
                group.push(it.ipa);
                continue;
            }
            // Heteronym first: it is the only reading that depends on context, so it must pre-empt the
            // lexicon (which has exactly one reading per spelling).
            const wLower = it.word.toLowerCase();
            const neighbour = (j: number): string | undefined => {
                const n = items[j];
                return n !== undefined && "word" in n ? n.word.toLowerCase() : undefined;
            };
            const het = heteronymIpa(wLower, neighbour(k - 1), neighbour(k - 2), neighbour(k + 1));
            let ipa = carry + (het ?? phonemizeWord(it.word, oovOverride));
            carry = "";
            const next = items[k + 1]; // liaison only onto an immediately adjacent word
            // A context-selected HETERONYM reading does not participate in liaison as the left member. Its
            // final consonant is SOUNDED, not latent, so the liaison machinery would both move it onto the
            // next word and strip it here: the operator reading of "plus" ([plys]) came out as
            // "utc ply zœ̃" instead of "utc plys œ̃", which is the ordinary [ply] "more" reading plus a
            // liaison that arithmetic "plus un" does not have.
            if (next && "word" in next && het === undefined) {
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
