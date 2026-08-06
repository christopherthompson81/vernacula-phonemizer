/**
 * THE PATTERN INVENTORY — the cells every language's artifact is measured against.
 *
 * EXTRACTED FROM `mine.ts` so the other tools can read it without running it. `coverage.ts` already imported
 * `CELLS` from there, and because `mine.ts` is a CLI that dispatches on `process.argv` at module scope, that
 * import ALSO executed its usage banner — a side effect on every coverage run. Same reasoning as `defects.ts`:
 * the inventory is a shared FACT about the fleet, not a setting belonging to one tool.
 */
/**
 * THE PATTERN INVENTORY. `langs` is the count of treated languages that authored a rule in that category —
 * the mining priority, since a cell 22 languages needed is one the next language probably needs too.
 *
 * `search` is the CirrusSearch `insource:` regex used to FILL the cell when random sampling misses it.
 * CirrusSearch regex is a restricted dialect: no `\p{...}`, no lookaround, no `\b`. `{D}` is substituted
 * with the language's digit range (`--digits`), which is how the fill stays script-correct — the exact
 * thing `\d` gets wrong. A cell with no `search` cannot be filled by pattern (see `calendar`).
 */
export interface Cell {
    key: string;
    langs: number;
    re: RegExp;
    search?: string;
    /** Matched against the language's own term list (`--terms`) rather than by shape. */
    lexical?: boolean;
}

export const CELLS: Cell[] = [
    { key: "degrees", langs: 22, re: /\p{Nd}\s*(?:°|℃|℉)/u, search: "[{D}]+ ?°" },
    { key: "digit-run", langs: 19, re: /\p{Nd}{4,}/u, search: "[{D}]{4,}" },
    { key: "fractions", langs: 18, re: /\p{Nd}\s*[\/⁄]\s*\p{Nd}|[½¼¾⅓⅔⅛]/u, search: "[{D}]+/[{D}]+" },
    { key: "clock", langs: 18, re: /\p{Nd}{1,2}\s*[:.]\s*\p{Nd}{2}(?!\p{Nd})/u, search: "[{D}]{1,2}:[{D}]{2}" },
    { key: "signs", langs: 17, re: /[%‰+±×÷=<>]|\p{Sc}/u, search: "[{D}] ?[+±×÷]" },
    { key: "dotted", langs: 16, re: /\p{L}\.\s*\p{L}\./u, search: "[A-Za-z]\\.[A-Za-z]\\." },
    // Split from `year` deliberately: in the treated languages ERA is a DOTTED marker (kn ಕ್ರಿ.ಪೂ,
    // te క్రీ.శ, tr M.Ö., ta கி.மு.) that must be claimed BEFORE the abbreviation rule, which is a
    // different rule and a different ordering constraint from reading a bare 4-digit year.
    { key: "era-marker", langs: 14, re: /(?:\p{L}\.\s?\p{L}\.)\s*\p{Nd}|\p{Nd}+\s*(?:\p{L}\.\s?\p{L}\.)/u, search: "[A-Za-z]\\.[A-Za-z]\\. ?[{D}]" },
    { key: "year", langs: 14, re: /(?<!\p{Nd})\p{Nd}{4}(?!\p{Nd})/u, search: "[{D}]{4}" },
    { key: "decimals", langs: 12, re: /\p{Nd}[.,]\p{Nd}/u, search: "[{D}][.,][{D}]" },
    // ORDINALS, SPLIT IN TWO because one regex cannot do both and pretending otherwise hid a blind spot
    // in each direction.
    //
    // The first version listed LATIN suffixes only (st|nd|rd|th|er|ème|º|ª), so it matched `21st` and
    // found NOTHING in ၂၁ ကြိမ်မြောက် / २१वीं / 21е / 21. — it looked correct because it worked for
    // English. That is the `\d`-is-ASCII trap one level up, in a cell written AFTER that trap was
    // documented, and 32 treated languages have an ordinal rule.
    //
    // Widening it to "digit followed by letters in any script" then over-corrected: Burmese writes
    // numbers directly against words (၂၀၂၄ခုနှစ်), so the count went 462 -> 35,504 and the cell stopped
    // meaning anything. A cell that matches 8% of all text cannot answer "does this language have
    // ordinals". So: the Latin shape stays a SHAPE, and the native shape is LEXICAL — the suffix is a
    // word (वीं, е, မြောက်, ที่) exactly as month names are, and belongs in the term list.
    { key: "ordinal-latin", langs: 11, re: /\p{Nd}+(?:st|nd|rd|th|er|re|ème|º|ª|:e)(?![\p{L}\p{Nd}])|\p{Nd}+\.(?=\s+\p{Lu})/u, search: "[{D}]+(st|nd|rd|th|º|ª)" },
    { key: "ordinal-native", langs: 21, re: /$^/u, lexical: true },
    { key: "units", langs: 9, re: /\p{Nd}\s*(?:km|kg|cm|mm|ml|mg|GB|MB|kHz|MHz|GHz|kW|m²|km²|m³)(?![\p{L}])/iu, search: "[{D}] ?(km|kg|cm|mm|MB|GB)" },
    { key: "ranges", langs: 7, re: /\p{Nd}\s*[–—]\s*\p{Nd}|\p{Nd}-\p{Nd}/u, search: "[{D}] ?[–—-] ?[{D}]" },
    { key: "currency", langs: 6, re: /\p{Sc}\s*\p{Nd}|\p{Nd}\s*\p{Sc}/u, search: "[$€£¥₹₩฿] ?[{D}]" },
    { key: "abbrev", langs: 6, re: /(?<![\p{L}\p{M}])\p{L}{1,4}\.(?=\s+\p{L})/u, search: "[A-Za-z]{2,4}\\. [A-Za-z]" },
    { key: "latin-in-native", langs: 6, re: /[A-Za-z]{2,}/u, search: "[A-Za-z]{4,}" },
    { key: "percent", langs: 5, re: /\p{Nd}\s*[%‰]/u, search: "[{D}]+ ?%" },
    { key: "rate", langs: 4, re: /\p{Nd}\s*\p{L}+\s*\/\s*\p{L}+/u, search: "[{D}] ?[A-Za-z]+/[A-Za-z]+" },
    { key: "zero-width", langs: 4, re: /[​-‍⁠﻿]/u },
    // Roman numerals: the token must be ENTIRELY roman letters, else every capitalised English word with
    // the right letters (MIX, DIM, CIVIL) is a hit. Still a candidate selector rather than a rule — a
    // false positive costs one reviewed sentence.
    { key: "roman", langs: 3, re: /(?<![\p{L}\p{M}])M{0,4}(?:C[MD]|D?C{0,3})(?:X[CL]|L?X{0,3})(?:I[XV]|V?I{0,3})(?![\p{L}\p{M}])(?<=[MDCLXVI]{2,})/u, search: "[IVXLCDM]{2,} " },
    { key: "initialism", langs: 3, re: /(?<![\p{L}\p{M}])\p{Lu}{2,}(?![\p{L}\p{M}])/u, search: "[A-Z]{3,}" },
    { key: "grouped", langs: 3, re: /\p{Nd}{1,3}(?:[,.  ]\p{Nd}{3})+(?!\p{Nd})/u, search: "[{D}]{1,3},[{D}]{3}" },
    // NEGATIVES. One treated language (fr) authored this, and it is worth its own cell because it is the
    // AMBIGUOUS half of `ranges` — the same character, and the two rules compete for it. Requires a
    // boundary before the sign so a hyphenated compound is not read as a minus.
    // SIGNED NUMBERS. Was `negative` and matched only the minus; the PLUS half is the same phenomenon and
    // is measurably more common — `+` before a number occurs in nb 5, de 5, en 5, ru 3, fr 3, as positive
    // temperatures (`+30°C`) and timezone offsets (`UTC +1`), while a bare minus is rarer. A cell that
    // covered one sign and not the other reported the category as handled when half of it was invisible.
    { key: "signed-number", langs: 2, re: /(?<![\p{L}\p{Nd}])[-−–+]\p{Nd}/u, search: "[ (][-−+][{D}]" },
    // ORDINAL RANGES — `10.–11. århundre`, a range whose ENDS are ordinals rather than cardinals. Neither
    // the `ranges` cell nor an ordinal cell claims it: the dash sits between two ordinal dots, so a range
    // rule sees `10.` and `11.` as malformed numbers and an ordinal rule sees a dash where it wants a
    // word. Attested in every ordinal-dot orthography checked — nb 2, da 2, de 1, cs 1 — small counts but
    // four independent languages, which is what makes it a category rather than a Norwegian quirk.
    { key: "ordinal-range", langs: 1, re: /\p{Nd}{1,2}\.\s*[-–—]\s*\p{Nd}{1,2}\./u, search: "[{D}]{1,2}\\. ?[-–] ?[{D}]{1,2}\\." },
    // LETTER NAMES: a LONE Latin capital, which the initialism pass cannot claim (it needs two) and which
    // reached the g2p as an unpronounceable consonant. Distinct from `initialism`, and the reason
    // `letterName` exists per language in core/initialisms.ts.
    { key: "letter-name", langs: 3, re: /(?<![\p{L}\p{M}.])[A-Z](?![\p{L}\p{M}])/u, search: "[A-Z] [{D}]" },
    // EXPONENTS and SCIENTIFIC NOTATION. 24 languages declare `exponentWords` in their DATA — a harder
    // signal than a comment grep, and it would rank second in this table — yet the miner had no cell, so
    // no mined corpus could ever exercise them. Covers the superscript forms (km², m³) and the ×10ⁿ shape
    // whose negative exponent the Burmese run surfaced as an unexplained DROP:minus residue
    // (`9.1093837 × 10 -31 kg`).
    { key: "exponent", langs: 24, re: /\p{Nd}\s*\p{L}*[²³⁰¹⁴-⁹]|\p{L}[²³]|[\p{Nd}]\s*[×x]\s*10\s*[-−–]?\s*\p{Nd}/u, search: "[{D}] ?(km|m|cm)?[²³]" },
    // ARITHMETIC and RELATIONAL signs standing between operands. Deliberately NOT merged into `signs`:
    // that cell is a catch-all which any currency or percent already satisfies, so an equation never
    // surfaced separately. The Burmese run left `DROP math-sign ×10` unexplained for exactly this reason.
    { key: "arithmetic", langs: 2, re: /\p{Nd}\s*[+×÷=<>≤≥≈]\s*\p{Nd}|\s[=≈]\s/u, search: "[{D}] ?[+×÷=] ?[{D}]" },
    // AMPERSAND — a word in every language and never a letter, but the shared initialism pass sees `P&R`
    // as two one-letter runs. Dutch authored the only rule so far (`&` → *en*).
    { key: "ampersand", langs: 1, re: /&|＆/u, search: "&" },
    // ITERATION / REPETITION marks: Thai ๆ, Japanese 々 and the kana repeats, Khmer ៗ. Only one treated
    // language has the rule, but there it was the LARGEST single defect in the language (ๆ, 351
    // occurrences in 16.7% of th_th utterances, silently dropped). A low language-count cell that is
    // decisive where it applies, and invisible to every other cell because the mark is script-specific.
    { key: "iteration", langs: 1, re: /[ๆ々〃ヽヾゝゞៗ]/u, search: "ๆ" },
    // CALENDAR: month names and non-Gregorian era words. LEXICAL, so it has no shape to match and no
    // regex can find it — Thai พ.ศ. (Buddhist), Ethiopian, Hijri and every set of month names are words,
    // not patterns. Supply them with --terms; the fill search then queries the terms directly, which is
    // both cheaper and more accurate than a regex. Same principle as acronymLetters in core/initialisms.ts:
    // a lexical fact belongs in data, not in logic.
    { key: "calendar", langs: 6, re: /$^/u, lexical: true },
    // ─── CELLS ADDED FROM THE REVIEW PASSES (#590 uz, #591 af, #592 as). Each exists because a shipped
    // layer read one of these wrong and NO existing cell would have surfaced it. Round two is the
    // reason to add them here rather than fix one language and move on.
    //
    // A SPORTS TIME is not a clock, and the clock cell cannot tell them apart: it matches the `4:41` in
    // `4:41.30` and stops. Afrikaans claimed exactly that and stranded `.30` as a phrase break plus a bare
    // number; Assamese, Russian and Indonesian each shipped a variant of the same defect. The third field
    // is what distinguishes them, so match it explicitly.
    { key: "sports-time", langs: 3, re: /(?<!\p{Nd})\p{Nd}{1,2}:\p{Nd}{2}[.:]\p{Nd}{1,2}(?!\p{Nd})/u, search: "[{D}]{1,2}:[{D}]{2}[.:][{D}]{2}" },
    // A VERSION DOT looks exactly like a decimal (`802.11n` vs `12.8`), and three languages read one as the
    // other. The discriminator is the trailing letter — but a decimal glued to its UNIT (`12.5km`, `6.5তকৈ`)
    // has one too, which is how af and as both over-claimed. Collect both shapes; the rule has to separate
    // them per language.
    // The letter must be GLUED to the digits: with a space allowed, `12.8 km` matched and the cell was
    // covered by every ordinary decimal, which tells you nothing.
    { key: "version-dot", langs: 3, re: /(?<![\p{Nd}.,])\p{Nd}+\.\p{Nd}+\p{L}/u, search: "[{D}]+\\.[{D}]+[a-z]" },
    // A QUOTE CHARACTER BOUND INTO A WORD is a LETTER, not punctuation: the Afrikaans article `'n` [ə],
    // Uzbek's tutuq belgisi, the Hawaiian ʻokina, ejective marks. It earns a cell because the encodings
    // multiply — af writes its article 588× as `‘n` (U+2018), 137× as `'n`, 4× as `’n`, 3× as `ń` — and the
    // engine recognised two of the four, so the commonest word in the language read as a bare consonant.
    { key: "quote-letter", langs: 4, re: /(?<![\p{L}\p{M}])['’‘ʼʻ`´]\p{L}(?![\p{L}\p{M}]{4})|\p{L}['’‘ʼʻ]\p{L}/u, search: "[‘’'] ?n " },
    // A CURRENCY WITH A SCALE WORD — `$14.7 billion American dollars`, `AUD$45 million`. Three separate
    // defects live here and none is visible to the plain `currency` cell: the magnitude stranded after the
    // noun (*45 dollars million*), the noun on the wrong side of the number (*dollar thirty*), and the sign
    // DOUBLING a currency the sentence already spells out (*14.7 dollar billion American dollar*).
    { key: "scaled-currency", langs: 3, re: /\p{Sc}\s?\p{Nd}[\p{Nd}.,]*\s+\p{L}{4,}|\p{L}{2,3}\p{Sc}\s?\p{Nd}/u, search: "[$€£¥] ?[{D}]+ [a-z]{4,}" },
    // AN ORDINAL SUFFIX IN CAPS. `ordinal-latin` lists lowercase suffixes only, so a capitalized head
    // (`11De`, `16-Noyabr`, a title-cased date) fell through to the CARDINAL reading with the suffix
    // stranded — the exact defect those rules exist to fix, in af and uz both. The suffix is orthography,
    // not a lowercase convention.
    { key: "ordinal-caps", langs: 2, re: /\p{Nd}+(?:ST|ND|RD|TH|DE|STE|De|Ste|Nd|Th)(?![\p{L}\p{Nd}])|\p{Nd}+-\p{Lu}\p{Ll}+/u, search: "[{D}]+(ST|ND|TH|De)" },
];

/**
 * IS AN ARTIFACT MEASURED AGAINST TODAY'S INVENTORY?
 *
 * The inventory GROWS as the sweep proceeds — five cells came out of the uz/af/as review passes alone — and an
 * artifact records the count it was mined against. Nothing compared the two, so a language could report
 * `covered 24/29` while the inventory had moved to 35 and five cells had never been evaluated for it at all.
 * Measured across the tree when this was written: **64 of 67 artifacts stale**, and
 * `sports-time`, `version-dot`, `quote-letter`, `scaled-currency` and `ordinal-caps` never evaluated for any
 * of those 64.
 *
 * A RENAME IS WORSE THAN AN ADDITION, because it is silent in both directions: `negative` became
 * `signed-number`, so 35 artifacts carry a count under a key that no longer exists AND report nothing for the
 * key that replaced it. `fetch --fill negative` answers `unknown cell: negative`, which is the only place the
 * fleet ever said so.
 */
export interface Staleness {
    /** Cells in today's inventory that this artifact has no count for — never evaluated. */
    missing: string[];
    /** Keys the artifact carries that the inventory no longer has — renamed or removed. */
    unknown: string[];
    /** The inventory size the artifact was mined against, if it recorded one. */
    minedAgainst: number | undefined;
}

export function staleness(artifactSource: string): Staleness {
    const tot = /"cellsTotal"\s*:\s*(\d+)/u.exec(artifactSource);
    const block = /"counts"\s*:\s*\{([\s\S]*?)\}/u.exec(artifactSource);
    const have = new Set(block === null ? [] : [...block[1]!.matchAll(/"([\w-]+)"\s*:\s*\d+/gu)].map((m) => m[1]!));
    const keys = new Set(CELLS.map((c) => c.key));
    return {
        missing: CELLS.map((c) => c.key).filter((k) => !have.has(k)),
        unknown: [...have].filter((k) => !keys.has(k)).sort(),
        minedAgainst: tot === null ? undefined : Number(tot[1]),
    };
}
