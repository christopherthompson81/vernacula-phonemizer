/**
 * Malayalam (ml) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Measured over the ml_in FLEURS corpus (1,955 unique utterances, column 3 — the cased one):
 *   560 ZWNJ + 264 ZWJ · 722 bare numerals (227 one-digit · 83 teens · 51 round tens · 81 two-digit
 *   non-round · 75 three-digit · 189 in the 1000-9999 band · 10 in 10k-99k · 6 larger)
 *   133 hyphenated clitics on a numeral (ൽ ×46 · ന് ×23 · ലെ ×17 · ആം/ാം ×16 · നും ×6 · കളിൽ ×6 ·
 *   മത്തെ/ാമത്തെ ×5 · ന്റെ ×3 · ത്തിലെ ×2 · rest ×9) + 40 more written with a SPACE instead
 *   36 comma-grouped numbers · 25 decimals · 21 numeric ranges · 15 digit-colon-digit (13 of them
 *   clock times) · 5 currency signs · 4 percent · 3 Latin unit abbreviations (km2 ×2, m ×3, mm ×3)
 *   1 degree · ~43 Latin runs · ZERO Malayalam digits ൦-൯
 *
 * MALAYALAM DIGITS ൦-൯ DO NOT OCCUR — not once in 1,955 utterances. The lead that held for Marathi
 * (×597) fails here as it did for Persian, Tamil and Telugu; the digit inventory is ASCII. Step 2 folds
 * them anyway, because it costs nothing and malayalam.ts's own fold happens too late for any rule here.
 *
 * THE TWO LARGEST DEFECTS WERE ZERO-WIDTH CHARACTERS, and they are NOT the same defect — which is why
 * Kannada's blanket deletion would have been wrong here:
 *   · ZWNJ ×560 splits the word. The engine's word class is the Malayalam block, which excludes
 *     U+200C, so ഓസ്‌ട്രേലിയ tokenized as TWO words and came out [ˈoːsɨ ʈɾˈeːlija] — two primary
 *     stresses AND a spurious samvritokaram [ɨ] on a word-internal virama. Deleting it is correct.
 *   · ZWJ ×264 is Malayalam's LEGACY CHILLU ENCODING: ല് + ZWJ IS ൽ. Deleting it leaves a bare
 *     word-final virama, which malayalam.ts then reads as samvritokaram — വിസ്താരത്തില്‍ came out
 *     [ʋˈist̪aːɾat̪ːilɨ] where the chillu spelling gives [ʋˈist̪aːɾat̪ːil]. It must be MAPPED to the
 *     atomic chillu, not dropped. 257 of the 264 sit immediately after a virama (checked by printing
 *     the neighbours); the other 7 are stray and are deleted.
 *
 * THE NUMBER PATH WAS THE LARGEST DEFECT INSIDE THIS LAYER, and it was fixed where it lives — see
 * numbers.ts and the `numbers` block in malayalam.jsonc. `bareMagnitude` was confirmed to read
 * correctly at lakh and crore (100000 → ലക്ഷം, 10000000 → കോടി, no leading "one"), so that earlier
 * fix holds; everything else about the composition was wrong.
 *
 * NO `\b` ANYWHERE. `\b` is defined on ASCII word characters and finds no boundary at all against
 * Malayalam script. Every boundary here is an explicit `(?<![\p{L}\p{M}])` / `(?![\p{L}\p{M}])`.
 *
 * LATIN RUNS ARE LEFT TO THE EMBEDDED FOREIGN PHONEMIZER (~43 tokens: US, NSA, FBI, MRI, GMT, UTC,
 * DNA, GPS, COVID…). A Latin→Malayalam letter-name table would be invented data.
 */
import { foldNativeDigits } from "../../core/unicode.ts";
import { postposedSign } from "../../core/postposedSign.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import {
    cliticToWords,
    DECIMAL_WORD,
    numberToWords,
    obliqueStem,
    ordinalStem,
    ordinalToWords,
    pluralStem,
} from "./numbers.ts";

/** Malayalam letter+mark boundary. Never `\b`. */
const NA = "(?![\\p{L}\\p{M}])";

/**
 * ZWJ chillu ligatures — the legacy encoding of the six chillu letters as base + virama + ZWJ.
 * malayalam.ts already knows the atomic characters and expands them correctly; this only converts the
 * old spelling into the new one so that path is reached.
 */
const ZWJ_CHILLU: Readonly<Record<string, string>> = {
    "ണ": "ൺ", "ന": "ൻ", "ര": "ർ", "ല": "ൽ", "ള": "ൾ", "ക": "ൿ",
};

/**
 * The SHARED symbol tier (percent / currency / units / exponent). Kept in this file rather than in
 * malayalam.ts because its position in the ordering matters and the ordering is this file's job.
 *
 * percent: ശതമാനം, and as a SUFFIX. Two independent sources agree on both facts — espeak ml_list maps
 * `%` to S;at@ma:n@m inline (so, after the number), and this corpus writes ശതമാനം 14 times, always
 * postposed ("8 ശതമാനം വളർച്ച", "80 ശതമാനം സാധനങ്ങൾക്കും"). It does not inflect for count, so one form.
 * One of the four `%` occurrences is "93% ശതമാനം", where the text ALREADY writes the word; the tier's
 * `already` guard (core/normalizeSymbols.ts) is currency-only, so that one is handled at step 7.
 *
 * currency: only the dollar occurs (×5, as `$` and `US$`). ഡോളർ is written out six times in this
 * corpus and always AFTER the amount, which is the tier's default. The magnitudes are this corpus's own
 * running-text spellings (ദശലക്ഷം ×12, മില്യൺ ×4, ബില്യൺ ×2). The rupee sign never occurs — രൂപ appears
 * once as a noun, not as an amount — so no ₹ key is invented.
 *
 * units: `km` (for the two `km2`), `m` and `mm`. Everything else measured here is already written in
 * Malayalam words (കിലോമീറ്റർ ×19, മീറ്റർ ×8, മൈൽ, ഇഞ്ച്, അടി), so more Latin keys would earn nothing
 * and would be actively dangerous — this corpus contains M16, x4, JAS, Il and 802.11-style tokens that
 * a one-letter key is free to claim. `m`/`mm` are safe only because the tier requires a NUMBER
 * immediately before and rejects a following letter or apostrophe (the Dutch `Il-76s` guard).
 *
 * exponent: ചതുരശ്ര, position "before" with a space — the standard Malayalam square-measure adjective,
 * an invariant prefix like Kannada's ಚದರ. `cubed` is NOT declared: no ³ occurs and there is nothing
 * here to source it from, and the seam leaves an undeclared exponent untouched.
 *
 * RATE is deliberately NOT declared (`unitPer` unset): no rate unit occurs in this corpus at all, and
 * Malayalam's rate idiom is a prefix in the dative (മണിക്കൂറിൽ), which the shared postposed "A per B"
 * shape cannot express. Nothing to source, nothing to guess.
 */
const SYMBOLS = makeSymbolNormalizer({
    // #586 `multiply` — this language had NO word for the sign at all. ⚠ STANDARD MATHEMATICAL REGISTER, not a
    // corpus attestation: the sweep's plausible hits were homographs of PREPOSITIONS (es `por` ×23, it `per` ×25,
    // ru `на` ×31 are all the preposition), the same trap that defeated the exponent sourcing. One word, so `by`
    // defaults to it — this language does not split dimension from product.
    multiply: { times: "ഗുണം" },
    // #586 — `&` was DROPPED outright, losing the sign from `കോളേജ് ഓഫ് ആർട്സ് & സയൻസസ്`. `ആൻഡ്` is the
    // TRANSLITERATED English "and", and it is attested in exactly this construction rather than merely as a
    // word: every wiki hit is an English institution name rendered in Malayalam — `ഒബ്സ്റ്റട്രിക്ക്സ് ആൻഡ്
    // ഗൈനക്കോളജി`, `അമേരിക്കൻ ബോർഡ് ഓഫ് ഒബ്സ്റ്റട്രിക്സ് ആൻഡ് ഗൈനക്കോളജി`, `റോയൽ കോളേജ് ഓഫ് ഒബ്സ്റ്റട്രീഷ്യൻസ്
    // ആൻഡ് ഗൈനക്കോളജിസ്റ്റ്സ്` — and one of those sentences writes the sign itself, `ഒ& ജി`. 18 wiki tokens,
    // 8 in the corpus. Chosen over the native options because they do not fit the slot: `ഉം` is a BOUND
    // suffix (it attaches to both coordinands, so it cannot stand between two initialisms), and `ഒപ്പം` /
    // `കൂടാതെ` mean "along with" / "besides" — 1 and 2 tokens, and the wrong register for a proper name.
    // Trap 8, checked: EVERY `&` in all five corpora treated in this batch is the universal `B&B` /
    // `Arts & Sciences` pair — no `AT&T`, no URL query — so "and" is right in every attested context.
    ampersand: "ആൻഡ്",
    percent: ["ശതമാനം"],
    currency: { "US$": ["ഡോളർ"], "$": ["ഡോളർ"] },
    magnitudes: ["ദശലക്ഷം", "മില്യൺ", "ബില്യൺ", "ലക്ഷം", "കോടി"],
    units: { km: ["കിലോമീറ്റർ"], m: ["മീറ്റർ"], mm: ["മില്ലിമീറ്റർ"] },
    // `ചതുരശ്ര കിലോമീറ്റർ` ×2 and `ക്യൂബിക് മീറ്റർ` ×1, both word-first, both from the corpus's own prose.
    exponentWords: { squared: ["ചതുരശ്ര"], cubed: ["ക്യൂബിക്"], position: "before" },
});

/**
 * The clitics this corpus actually welds onto a numeral, each with the stem it selects. A CLOSED list,
 * closed to what is ATTESTED — an open "digits + any Malayalam run" rule would swallow ordinary nouns
 * that merely follow a number ("100 അടി", "56 വ്യത്യസ്ത"), which is trap #2.
 *
 * Longest first, so ത്തിലെ is not shadowed by ലെ. ത്തിൽ/ത്തിലെ carry their own -ത്തി- linker, which is
 * precisely the oblique stem of a ം-final magnitude, so they are folded to ൽ/ലെ and take the same path
 * (2000-ത്തിലെ → ആയിരത്തിലെ, one word, correctly linked).
 */
const ORDINAL_ENDINGS = ["ാമത്തേത്", "ാമത്തെ", "മത്തേത്", "ാമത്", "മത്തെ", "മത്", "ആം", "ാം"];
const OBLIQUE_CLITICS = ["ത്തിലെ", "ത്തിൽ", "ത്തില്", "ലാണ്", "ന്റെ", "ലോ", "നും", "ലെ", "ൽ", "ന്"];
const PLURAL_CLITICS = ["കളുടെ", "കളിലെ", "കളിൽ", "കൾ"];
const longestFirst = (a: string[]): string =>
    [...a].sort((x, y) => y.length - x.length).join("|");

/** ത്തിൽ/ത്തിലെ are the ം-final oblique already spelled out; fold them onto the plain clitic. */
const FOLD_CLITIC: Readonly<Record<string, string>> = {
    "ത്തിലെ": "ലെ", "ത്തിൽ": "ൽ", "ത്തില്": "ൽ",
};

/**
 * The Malayalam normalizer. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at each step
 * because a future reader cannot recover it from the code.
 */
export function normalizeMalayalam(input: string): string {
    // 1) ZERO-WIDTH characters — FIRST, because every later rule asserts letter/digit adjacency and an
    //    invisible character defeats all of them. The two classes are NOT treated alike; see the header.
    //    (a) virama + ZWJ is the legacy chillu spelling → the atomic chillu character.
    let s = input.replace(/([ണനരലളക])്‍/gu, (_m, base: string) => ZWJ_CHILLU[base]!);
    //    (b) everything else zero-width is a rendering hint with no phonetic content.
    s = s.replace(/[​‌‍﻿]/gu, "");

    // 2) MALAYALAM DIGITS ൦-൯ → ASCII. Zero occurrences here (see the header); folded before every
    //    numeric rule anyway so a native-digit numeral would be eligible for the same de-grouping,
    //    clitic, percent and unit handling as an ASCII one, rather than only for malayalam.ts's own
    //    late fold inside an already-classified digit token.
    s = foldNativeDigits(s);

    // 3) DIGIT DE-GROUPING (×36), before anything that reads punctuation. A grouping comma is otherwise
    //    clause punctuation: 1,234 was reading as ഒന്ന് <pause> ഇരുന്നൂറ്റി മുപ്പത്തിനാല് — a phrase
    //    break inside a number, and the leading digit spoken as a separate numeral. All 36 are Western
    //    3-digit blocks; no Indian 2-then-3 grouping occurs here.
    s = s.replace(/(?<=\d),(?=\d{3}(?:,\d|[^\d]|$))/gu, "");

    // 4) NUMERIC CLITICS (×133 hyphenated + ~40 spaced), AFTER de-grouping — this corpus writes a
    //    clitic on a grouped numeral ("1,000-മത്തെ" shape) which a `(?<![\d,])` guard would reject
    //    while the comma was still there. BEFORE the symbol tier and the time rule, because those match
    //    on a number and would otherwise consume the numeral out from under the clitic.
    //
    //    Malayalam welds the suffix onto the LAST cardinal word through an oblique/ordinal stem. Left
    //    apart, each of these reached the G2P as a stray stressed syllable: 1789-ൽ ended [… ˈompat̪ɨ l],
    //    a bare consonant; 18-ആം was [pˈad̪ineʈːɨ ˈaːm], two stresses; 150-നും was [… nˈum].
    //    The hyphen itself is optional because the corpus writes both "2010 ൽ" and "1789-ൽ".
    const clitic = (list: string[]): RegExp =>
        new RegExp(`(?<![\\d.,])(\\d+)\\s*[-–]?\\s*(${longestFirst(list)})${NA}`, "gu");
    //    (a) ORDINALS first: -ാമത്തെ must not be claimed by a shorter ending, and ordinal endings are
    //        not a subset of the oblique ones, so the two lists cannot be merged.
    s = s.replace(clitic(ORDINAL_ENDINGS), (whole, digits: string, end: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n === 0) return whole;
        // "ആം" is the standalone spelling of the ending "ാം"; "മത്തെ" of "ാമത്തെ".
        const ending = end === "ആം" ? "ാം" : end.startsWith("ാ") ? end : `ാ${end}`;
        const w = ordinalToWords(n, ending);
        return w === "" ? whole : w;
    });
    //    (b) PLURAL clitics before oblique ones: -കളിൽ ends in the oblique -ൽ and would otherwise be
    //        split, leaving a stranded കളി. The plural stem takes -ു, not -ി (ഇരുപതുകളിൽ, attested).
    s = s.replace(clitic(PLURAL_CLITICS), (whole, digits: string, c: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n === 0) return whole;
        const w = cliticToWords(n, c, pluralStem);
        return w === "" ? whole : w;
    });
    //    (c) OBLIQUE case clitics.
    s = s.replace(clitic(OBLIQUE_CLITICS), (whole, digits: string, c: string) => {
        const n = Number(digits);
        if (!Number.isSafeInteger(n) || n === 0) return whole;
        const w = cliticToWords(n, FOLD_CLITIC[c] ?? c, obliqueStem);
        return w === "" ? whole : w;
    });

    // 5) The SHARED symbol tier: percent, currency, units, exponent. UNITS BEFORE DECIMALS (step 7) —
    //    the tier matches a unit only when a NUMBER is adjacent, and rewriting 6.5 to "ആറ് ദശാംശം അഞ്ച്"
    //    first would destroy that adjacency. AFTER de-grouping, so "19,500 km2" is one number.
    s = SYMBOLS(s);

    // 6) TIMES BEFORE the decimal step: a bare-number rule must not claim 06:30, and this corpus writes
    //    the sports times 2:11.60, 1:09.02 and 4:41.30 where a restart inside the number would be
    //    exactly the Indonesian defect the playbook records.
    //    (a) :00 minutes are DROPPED, not read — "11:00 (യുടിസി" was giving പതിനൊന്ന് പൂജ്യം.
    //    (b) every remaining digit-colon-digit becomes a SPACE: `:` is clause punctuation in this
    //        engine (malayalam.jsonc maps it to ","), so it inserted a pause inside 8:30 and 9:30.
    //    NO മണി is added. The noun is already in the text where it belongs ("11:00 ന് കഴിഞ്ഞപ്പോൾ",
    //    "8:30 ന് ആരംഭിക്കും") — the same call Tamil, Telugu and Kannada made on the same evidence.
    s = s.replace(/(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])/gu, "$1");
    s = s.replace(/(?<=\d):\s?(?=\d)/gu, " ");

    // 7) PERCENT ALREADY SPELLED OUT. "93% ശതമാനം" (×1) — the tier's duplicate guard is currency-only,
    //    so step 5 turned this into "93 ശതമാനം ശതമാനം". Collapsed here rather than in core, because the
    //    guard's generalisation to percent is a shared-code change and #562 reports those instead.
    s = s.replace(/ശതമാനം(\s+ശതമാനം)+/gu, "ശതമാനം");

    // 8) DECIMALS (×25), after units and times have taken their share. Before this the separator read
    //    as a full stop: 6.5 came out ആറ് <pause> അഞ്ച്, a sentence break inside a number. ദശാംശം is
    //    espeak ml_list's `_dpt`; the fractional digits are read one at a time, as in ta/te/kn. No
    //    ml_in audio is cached under corpus/audio_cache/data/, so playbook step 5b could not arbitrate
    //    the digit-by-digit reading — it is sourced from the espeak voice and the sibling languages.
    s = s.replace(
        /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu,
        (_m, int: string, frac: string) => `${int} ${DECIMAL_WORD} ${[...frac].join(" ")}`,
    );

    // 9) DEGREES (×1), last, so a decimal temperature would keep its point. Only the bare sign is
    //    handled: ഡിഗ്രി is written out three times in this corpus, but no scale word (സെൽഷ്യസ്,
    //    ഫാരൻഹീറ്റ്) appears anywhere here and neither °C nor °F occurs, so none is invented.
    // THE PLUS → പ്ലസ്, from the corpus's own AUDIO (a PHONEME recognizer, no `+` in its vocabulary). Over
    // ml_in/train, and ml voices it in BOTH positions:
    //   UTC+1  →  `… n j uː l t i s iː p l a s o n n ə …` and `… y j uː l t i s i p l a s o n n …`  2 of 2
    //   +30°C  →  `… m a s a ŋ l i l p l a s v u p o d e d i ɡ …`  plus + മുപ്പതു, 1 of 1
    // ★ Like ta, gu and mi, and unlike en/hi/vi/te/xh/am/ne, ml says the MEASUREMENT plus. പ്ലസ് reads
    // plˈasɨ, matching the decode. BEFORE the degree rule — the ordering zu's `[+]?` taught.
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 പ്ലസ് ");
    s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1പ്ലസ് ");

    // THE DIVISION AND COMPARISON SIGNS (#654). The EQUALITY IS DELIBERATELY LEFT DROPPED — see the end.
    //
    // ⚠ THE PARALLEL-CORPUS FORM IS A SUBORDINATE CLAUSE, NOT A READING, and Malayalam is the clearest case of
    // why a hit in FLEURS's aspect-ratio sentence is a lead rather than an answer. That sentence gives
    // "പന്ത്രണ്ട് ഉപയോഗിച്ച് ഹരിക്കുമ്പോൾ", and both halves are inflected FOR THAT SENTENCE:
    //
    //   ഹരിക്കുമ്പോൾ = ഹരിക്ക്- (divide) + -ുമ്പോൾ, and -ുമ്പോൾ IS the word "when" (historically -ഉം + പോൾ
    //   "time"). So the form means "when dividing" — a temporal SUBORDINATOR, subordinated here to the main
    //   predicate ആണെന്ന് പറയാം ("can be said to be"). Between two operands there is no main clause for it to
    //   attach to, so `6 ÷ 3` would read "six when-divided three", a fragment awaiting a predicate.
    //
    //   ഉപയോഗിച്ച് ("using") is a converb, not the instrumental case -കൊണ്ട് that Malayalam puts on a divisor.
    //   The translator wrote a two-clause paraphrase of the operation, not a reading of the notation.
    //
    // What the sentence DOES establish, with certainty, is the ROOT: ഹരി-. The form comes from ml.wikipedia's
    // arithmetic article, which names the sign against the glyph in a section heading —
    //
    //     === ഹരണം (÷ or /) ===        then  "ഗുണനത്തിന്റെ വിപരീത ക്രിയയാണ് ഹരണം"
    //
    // — so ഹരണം (×12 token / 2 articles) is the sign's own NAME, and a sign name reads infix: `el` does exactly
    // this with ίσον, `ja` with イコール, and `ta`'s wiki writes the parallel Dravidian nominal out in the slot
    // ("a வகுத்தல் b"). ⚠ That last step is a fleet PATTERN rather than an attested "a ഹരണം b" string, and is
    // marked as such: the naming citation is the evidence, the infix placement is the inference.
    //
    // ⚠ AND ഹരണം'S SIX CORPUS HITS ARE ALL INSIDE അപഹരണം, "ABDUCTION" — the substring trap, and the funniest
    // instance of it so far. The corpus contributes the root and nothing else.
    //
    // ⚠ THE COMPARATIVE MORPHEME CANNOT BE TOKEN-COUNTED AT ALL. -എക്കാൾ ("than") is BOUND: it appears only
    // fused (കൾച്ചർ ഷോക്കിനെക്കാൾ, പരമ്പരാഗത ഭാഷകളെക്കാൾ), so its token count is ×0 by construction, not by
    // absence — the agglutinative counterpart of the ZWNJ false negative Persian produced. What IS countable is
    // the head it governs: കൂടുതൽ ×182 token, കുറവ് ×12. Postposed, so the comparison cannot read backwards.
    //
    // Emitted UNFUSED, as ta's accusative is, and for the same reason: fusing needs the numeral spelled here
    // plus its sandhi. The phones are unchanged; the tokenizer sees a boundary Malayalam would not write.
    s = postposedSign(s, "<", "എക്കാൾ കുറവ്");
    s = postposedSign(s, ">", "എക്കാൾ കൂടുതൽ");
    s = s.replace(/\s?÷\s?/gu, " ഹരണം ");
    // ⚠ `=` IS LEFT DROPPED, REPORTED RATHER THAN GUESSED. Every candidate for the equality word is ×0 in BOTH
    // the corpus and the wiki: സമം, തുല്യം, ഹരിച്ചാൽ. The root-plus-name route that settled the division sign
    // has no equivalent here — nothing names the `=` glyph in ml.wikipedia's arithmetic article. This is the
    // one reading in the batch with no source, so it stays silent until there is one.

    s = s.replace(/(\d)\s?°\s?/gu, "$1 ഡിഗ്രി ");

    return s;
}

/** Exposed for tests: the corrected cardinal/ordinal readings the engine now composes. */
export { numberToWords, obliqueStem, ordinalStem, ordinalToWords };
