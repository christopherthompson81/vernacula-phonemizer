/**
 * Lao (lo) text normalization — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Corpus: `tools/corpus/mined/lo.jsonc`, a lo.wikipedia dump of **20,994 paragraphs** (432 mined segments,
 * 232 hard + 200 sample), `covered 32/35`. A SMALL wiki — a tenth of the si or kmr dumps — so the counts
 * below are small and are quoted as they are rather than inflated. No FLEURS corpus; espeak does not ship
 * Lao. The artifact and lo.wikipedia are the only haystacks.
 *
 * ⚠⚠ TWO INVISIBLE CHARACTERS, AND THEY NEED OPPOSITE TREATMENT — which is the whole reason this file
 * opens the way it does. Lao is written WITHOUT spaces between words, and this corpus separates them with
 * **U+200B ZERO WIDTH SPACE ×1,503**. `lao.ts`'s token is `[຀-໿]+`, which U+200B is outside, so the joiner
 * is doing the WORD SEGMENTATION the language needs and stripping it would fuse whole phrases into one
 * token. It is left alone. **U+00AD SOFT HYPHEN ×73 is the opposite**: it sits INSIDE a word
 * (`ຊະ­ນິດ`, `ສັດ­ປ່າ`, `ລະ­ດັບ`), so it splits one word into two tokens and two stress domains. It is
 * stripped.
 *
 * This is the Sinhala joiner finding with the sign reversed, and the pair is worth stating together: an
 * invisible character is not junk or not-junk by its class, it is junk or not by **what the tokenizer does
 * with it in this language**. Neither is visible to any gate here — the leak classes hunt a character that
 * SURVIVES into the IPA and the DROP test hunts a symbol that says nothing.
 *
 * ⚠ THE ERA MARKER IS THIS LANGUAGE'S BIGGEST CLASS — `era-marker` is **1,648 in a 20,994-paragraph dump**,
 * i.e. ~8% of paragraphs. `ຄ.ສ.` (×51 in the mined segments) and `ພ.ສ.` (×10) read as bare letters plus TWO
 * clause pauses: `ຄ.ສ. 1990` → *kʰa **.** sa **.** nɯŋ pʰan…*. Both expansions are corpus- and
 * wiki-attested, and one wiki sentence writes the long form and the abbreviation together —
 * *"300 ປີກ່ອນ**ຄຣິດສັກກະລາດ**ເຖິງ **ຄ.ສ.** 300"* — which settles the identification outright.
 *
 * ⚠ THE CORPUS CARRIES BOTH SEPARATOR CONVENTIONS, told apart by GROUP SIZE, as Kurmanji's does:
 *
 *     comma  + 3 digits  ×86  THOUSANDS   512,115 · 300,000 · 236,800 · 406,990
 *     comma  + 1 digit    ×6  decimal     2,1 · 92,6 · 4,2
 *     period + 3 digits  ×25  THOUSANDS   52.201 ກິໂລແມ້ດ · 62.722 ຄອບຄົວ · 215.000 ເຮັກຕາ · 660.000 ໂຕນ
 *     period + 1–2       ×68  decimal     4.01% · 0.34% · 0.75 · 95.3
 *     period + 4 or more  ×5  decimal     21.2967 · 77.0088651 · 0.09290304
 *
 * Both were read as a CLAUSE PAUSE (`.`) or as two separate numbers (`,` produces no pause in this engine,
 * so `49,600` simply read as "49" then "600" — the value destroyed silently, with nothing for a gate to
 * see). `decimals` is 1,150 in the dump and `grouped` 805.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { tr } from "../../core/provenance.ts";

/**
 * The shared symbol tier. Every word is attested IN ITS SLOT — and in an unspaced script that check is
 * harder than usual, because `attest.ts` can only return a SUBSTRING count (trap 19), so the printed
 * examples are the whole of the evidence and each one below was read.
 *
 *   ຮ້ອຍລະ  percent — the native "per hundred", ×3 in the corpus and **prefix in 3 of 3**
 *            (`ຮ້ອຍລະ 8.7 ຂອງຜິວໂລກ`, `ຮ້ອຍລະ 30`, `ຮ້ອຍລະ 60`) plus ×21 on the wiki. The loan `ເປີເຊັນ`
 *            occurs twice and is written on BOTH sides, so the native word is the consistent one.
 *   ໂດລາ     currency — `5.395 ຕື້ໂດລາສະຫະລັດ` ("5.395 billion US dollars"), number then magnitude then
 *            noun, which is the tier's default order.
 *   ກິໂລແມັດ / ແມັດ — the corpus spells both out beside its figures (`52.201 ກິໂລແມ້ດ`, `3.640 ກິໂລແມັດ`);
 *            ×49 and ×86 on the wiki.
 *   ແລະ      ampersand — the ordinary Lao conjunction, on nearly every line of the corpus.
 *
 * ⚠ `unspacedScript` IS SET, and Lao is exactly the case trap 27 describes: a sign or unit is NORMALLY
 * flanked by Lao script rather than by a space, so the tier's "not inside a word" guard rejects the
 * ORDINARY case. This corpus writes `$95.3ລ້ານ`, `£72ລ້ານ`, `€180 ລ້ານ` and `Us$ 549ຂື້ນໄປ` — the amount
 * glued straight to a Lao word every time.
 *
 * ⚠ THE EURO HAS TWO SPELLINGS AND ONLY ONE OF THEM IS SAFE. lo.wikipedia's own first line glosses both
 * against the symbol — *"ຢູໂຣ ຫຼື ເອີໂຣ (euro, €; ລະຫັດທະນາຄານ EUR) ແມ່ນສະກຸນເງິນ…"* — but `ຢູໂຣ` ×14 is
 * mostly **ຢູໂຣປາລີກ** (the Europa League) and **ຢູຟາ ຢູໂຣ** (the UEFA tournament), i.e. "Euro-" as in
 * Europe, while `ເອີໂຣ` ×25 additionally has the quantity-slot citation *"1 ເອີໂຣແບ່ງອອກເປັນ 100 ຊັງ"*
 * ("one euro divides into 100 cents"). In an unspaced script a count is a substring count (trap 19), so
 * the tournament swallows the shorter spelling; `ເອີໂຣ` is declared.
 *
 * ⚠ `£` AND `€` ARE DECLARED AND `¥` IS NOT. The pound and euro appear in exactly one sentence each with
 * a figure attached, and Lao spells both as ordinary loans; the yen does not occur at all, and its one
 * near-instance (`ໜຶ່ງພັນລ້ານເຢນ`, "one billion yen") is the WORD ເຢນ already spelled out, so nothing is
 * missing there.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ຮ້ອຍລະ"],
    percentPrefix: true,
    currency: { "US$": ["ໂດລາສະຫະລັດ"], $: ["ໂດລາ"], "€": ["ເອີໂຣ"], "£": ["ປອນ"] },
    magnitudes: ["ພັນ", "ລ້ານ", "ຕື້"],
    units: { km: ["ກິໂລແມັດ"], m: ["ແມັດ"], cm: ["ຊັງຕີແມັດ"], kg: ["ກິໂລກຼາມ"] },
    // ⚠ THE TWO POWERS SIT ON OPPOSITE SIDES OF THE NOUN, which is why `position` takes a per-power record
    // (trap 37, the Amharic case). The square is a FUSED PREFIX — `ຕາລາງກິໂລແມັດ` ×38, `ຕາລາງແມັດ` ×7,
    // always beside an area figure (`9,572,900 ຕາລາງກິໂລແມັດ`, `424,000 ຕາລາງແມັດ`) and always ONE word,
    // so `compound` rather than `before`. The cube is a FUSED SUFFIX — `ແມັດກ້ອນ`, attested in two
    // independent volume figures (`7,000 ລ້ານແມັດກ້ອນ` a reservoir, `5 ລ້ານ ແມັດກ້ອນ` of oil).
    // ⚠ `ລູກບາດ` ×2 is the geometric CUBE, not the unit — *"ລູກບາດ ແມ່ນຮູບຊົງສາມມິຕິທີ່ມີ 6 ໜ້າ"*, "a cube
    // is a three-dimensional shape with 6 faces" — the shape-vs-unit split this sweep keeps meeting, and
    // `ລູກບາດແມັດ` (the Thai-style compound) probes ×0.
    exponentWords: {
        squared: ["ຕາລາງ"], cubed: ["ກ້ອນ"],
        position: { squared: "compound", cubed: "suffix" },
    },
    ampersand: "ແລະ",
    unspacedScript: true,
});

/**
 * The era markers, as a CLOSED LIST and BOUNDED ON BOTH SIDES.
 *
 * ⚠ THE BOUNDS ARE NOT DECORATION. This corpus writes a sentence period with no space after it as often as
 * any other wiki dump — `າຊິກ.ຈຸດປ`, `ໜຶ່ງ.ຕົວວ`, `ຂ.ແຕ່`, `ປີ.ຄ.ສ.` are all in the mined segments — and
 * ⟨ຄ⟩ and ⟨ສ⟩ are ordinary Lao letters that begin ordinary Lao words. Unbounded, `ຄ.ສ` would fire across
 * any sentence boundary whose next word starts with ⟨ສ⟩. (This is the guard the Sinhala pass shipped
 * without and had to add in review; it is here from the start.)
 *
 * The trailing dot is optional because the corpus writes `ຄ.ສ.` ×44 and `ຄ.ສ` ×7.
 */
const ERA: readonly (readonly [RegExp, string])[] = [
    [/(?<![຀-໿])ຄ\s?\.\s?ສ\s?\.?(?![຀-໿])/gu, "ຄຣິດສັກກະລາດ "],
    [/(?<![຀-໿])ພ\s?\.\s?ສ\s?\.?(?![຀-໿])/gu, "ພຸດທະສັກກະລາດ "],
];

/** Every rule emits Lao WORDS or ASCII digits; nothing reaches the phoneme sink as a spelling. */
export function normalizeLao(input: string): string {
    let s = input;

    // 1) THE SOFT HYPHEN GOES AND THE ZERO WIDTH SPACE STAYS — see the file header. `&nbsp;` becomes a real
    //    space for the same reason it does everywhere: it is a LETTER run to every guard below, and this
    //    corpus writes `€180&nbsp;ລ້ານ` and `(5,&nbsp;2πk)`.
    s = tr(s, /&nbsp;/gu, " ").replace(/[­‌﻿]/gu, "");
    //    …and one corpus spelling of the dollar code, which is written `Us$` once (`ແຕ Us$ 549ຂື້ນໄປ`).
    //    The tier's keys are literal, so the mixed case reached it as no key at all and the sign dropped.
    s = tr(s, /(?<![\p{L}])Us\$/gu, "US$");

    // 2) ERA MARKERS — before anything that reads a dot (playbook step 4), and the largest single class in
    //    the language. Each replacement re-emits a space so the expansion cannot glue itself to the year;
    //    the collapse below tidies the pair where the source already had one.
    for (const [rx, word] of ERA) s = tr(s, rx, word);
    s = tr(s, /  +/gu, " ");

    // 3) THE SEPARATORS, BY GROUP SIZE — three digits after the mark is a THOUSANDS group whichever mark
    //    carries it (86 commas and 25 periods against 6 and 68 decimals; the table is in the header).
    //    ⚠ THE COMMA CASE HAD NO SYMPTOM A GATE COULD SEE. `lao.ts` deliberately emits no pause for `,`,
    //    so `US$49,600` read as *…si˧˥p̚ ka˥˨w ho˧˥k̚ hɔː˥˨j* — "forty-nine, six hundred", two numbers where
    //    the text has one, with no leaked character and no dropped symbol to report.
    // ⚠ AND A GROUP MAY NOT FOLLOW A LONE `0` — no convention groups from zero, so `0,001` joining to
    //    `0001` is a 1000× error rather than a reading of it.
    const group = /(?<![\p{Nd}.,])([1-9]\p{Nd}{0,2}(?:([.,])\p{Nd}{3})+)(?![\p{Nd}.,])/gu;
    s = tr(s, group, (m, _g, sep: string) => m.replaceAll(sep, ""));

    // 4) NEGATIVE NUMBERS — U+2212 anywhere, and the ASCII hyphen only where it opens a string or a bracket.
    //    Measured over the mined segments: **U+2212 is ×5 and all five are genuine** — `(−1, −2, −3, ...)`
    //    in the integers article, `i ² = −1`, `(−5, (2k+1)π)` — while a bare ASCII dash before a digit is a
    //    RANGE in four of its six instances (`1642 -1647`, `30 - 33 c°`, `0 - 2 c°`, a date range). The two
    //    genuine ASCII ones are `(-4) - (0) c°`, which opens a bracket, and a quoted coordinate.
    //
    //    ⚠ THE WORD IS CORPUS-GLOSSED, which is better evidence than this class usually gets: the same
    //    sentence that carries the signs names them — *"ຈຳນວນທຳມະຊາດ**ລົບ** (−1, −2, −3, ...)"*, "negative
    //    natural numbers (−1, −2, −3, …)". ⚠ And the bare word is a trap in the usual way: `ລົບ` probes ×21
    //    on the wiki and every top hit is a PLACE NAME (ຈັງຫວັດ**ລົບ**ບຸລີ = Lopburi, ດອນ**ລົບ**ປາດີ) — in
    //    an unspaced script a "word count" is a substring count (trap 19), so only the corpus's gloss
    //    attests it.
    //    ⚠ THE ASCII ARM'S GUARD IS "NOT AFTER A NUMBER", not "at a bracket", because in Lao the range and
    //    the negative share both of their obvious contexts. `ໄປທາງຕາເວັນຕົກ -180 ອົງສາ` (west longitude
    //    −180) and `ໃນປີ 1642 -1647` (a year span) are both space-then-dash-then-digit; what separates them
    //    is what precedes the SPACE — a letter in the first, a digit in the second. And a degree context
    //    cannot discriminate here the way it does in Kurmanji, because two of the ranges are temperature
    //    spans (`30 - 33 c°`, `0 - 2 c°`) — those are excluded instead by the space AFTER the dash.
    //    `{` is excluded for the subscript markup `p^e_{-1}`.
    s = tr(s, /−(?=\p{Nd})/gu, "ລົບ ");
    s = tr(s, /(?<!\p{Nd}\s?)(?<![{_])-(?=\p{Nd})/gu, "ລົບ ");

    // 5) DEGREES — `ອົງສາ`, POSTPOSED, which is how the corpus writes it: `51 ອົງສາ 50 ລິບດາ`, `0 ອົງສາ`,
    //    `21 ອົງສາ 17 ລິບດາ`, `-180 ອົງສາ`. Every mined instance of the SIGN is a coordinate or a
    //    temperature, and `degrees` is only 28 in the dump.
    //
    //    ⚠ LAO WRITES THE SCALE LETTER FIRST — `30 - 33 c°`, `0 - 2 c°`, `(-4) - (0) c°` — which is the
    //    reverse of the `°C` every other language in this tree has needed, and a rule written for `°C`
    //    alone would have matched none of this corpus's temperatures. Both orders are claimed.
    //    ⚠ No scale NAME is emitted: `ເຊວຊຽສ` and `ຟາເຣນໄຮ` are ×0 in both haystacks, and the corpus's own
    //    temperatures carry no scale word either. The letter is consumed rather than left to be read as an
    //    English letter name — `20 °C` was reading as *saːw **sˈiː***.
    s = tr(s, /(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*(?:°\s*[CF]|[cf]\s*°)(?![\p{L}])/giu, "$1 ອົງສາ");
    s = tr(s, /(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°/gu, "$1 ອົງສາ");

    // 5b) A PERCENT WORD ALREADY IN THE TEXT SPENDS THE SIGN — trap 12 applied to a word, and the only
    //     way to find it was to READ the reading. The corpus writes `ຜູ້ທີ່ຊະນະຈະໄດ້ເປີເຊັນ 10%` ("the
    //     winner gets 10 percent") with the LOAN word before the figure and the sign after it, so the tier
    //     added `ຮ້ອຍລະ` on top and the reading said percent twice. The scan cannot see this — the sign
    //     DOES contribute, so there is no DROP to report. Both the loan and the native word are spent.
    //     ⚠ The loan is not declared as a second CountForm instead, because the tier picks a form by COUNT
    //     (n===1 → first, else last), which would emit `ເປີເຊັນ` for every plural figure.
    //     ⚠ The word can sit on EITHER side of the figure, and the corpus's instance has it on the far
    //     side: `ເປີເຊັນ 10%` is word-number-sign, so a pattern matching word-then-sign misses it entirely.
    s = tr(s, /(ເປີເຊັນ|ຮ້ອຍລະ)(\s*\p{Nd}[\p{Nd}.,]*)\s*%/gu, "$1$2");
    s = tr(s, /(ເປີເຊັນ|ຮ້ອຍລະ)\s*%(?=\s?\p{Nd})/gu, "$1");

    // 6) THE SHARED TIER — percent, currency, units and `&`. Runs ABOVE step 7, because the tier matches a
    //    unit only when a NUMBER is adjacent and the decimal rewrite destroys that adjacency (the
    //    playbook's "units before decimals" coupling).
    s = SYMBOLS(s);

    // 7) THE DECIMAL POINT — `ຈຸດ`, and unlike the last two languages treated this one IS sourceable.
    //    lo.wikipedia's own text defines it: *"ຄ່າສ່ວນໃຫຍ່ຖືກປັດເປັນເລກຫຼັງ**ຈຸດທົດສະນິຍົມ**ສາມຫຼັກ"* —
    //    "values are mostly rounded to three digits after the DECIMAL POINT" — and the article on rational
    //    numbers writes `ເລກທົດສະນິຍົມ` beside `3/4 = 0.75`. The fractional digits are emitted ONE AT A
    //    TIME, as they are said.
    //
    //    ⚠ The guard is "not part of a longer dotted run", which keeps a version string and a dotted date
    //    out from either end; the thousands case is already gone at step 3.
    s = tr(s, /(?<![\p{Nd}.,])(\p{Nd}+)[.,](\p{Nd}+)(?![\p{Nd}.,])/gu,
        (_m, whole: string, frac: string) => `${whole} ຈຸດ ${[...frac].join(" ")}`);

    // 8) FOUR CLASSES DECLINED, each with the count that justifies it:
    //    · `=` and `+` (`arithmetic` ×79). Every mined instance is a FORMULA or a worked example — an
    //      economics illustration (`ລົດຈັກ x1/100 ຄັນ + ເຂົ້າ x2/50 ໂຕນ`), a coordinate conversion
    //      (`(D + M/60 + S/3600)`), matrix notation (`C_{2,1}=8`) and unit equivalences. In the last of
    //      those the corpus writes the reading ITSELF in the next bracket — `1,000 Hz = 1 KHz (1 ພັນແຮັກ
    //      ເທົ່າກັບ 1 …)` — so voicing the sign would say it twice.
    //    · `×` — `ຄູນ` is genuinely glossed against the symbol on the wiki (*"ການຄູນ (ມັກຈະສະແດງດ້ວຍ
    //      ສັນຍາລັກຂ້າມ ×, …)"*), but the sign itself is ×0 in the mined segments: there is nothing to read.
    //      Recorded rather than declared, so the word is on file if a later corpus produces the sign.
    //    · RANGES (`ranges` ×878). Lao writes `ຫາ` ("to") when it means one — `7000 ຫາ 5000 ກ່ອນ…` — and
    //      the bare dashes are a date range (`1883 – 21 ເມສາ 1946`), a year span (`1642 -1647`) and two
    //      temperature spans that the degree rule already reads on both operands.
    //    · THE CLOCK (`clock` ×208). `:` produces no pause in this engine, so `10:30` already reads as
    //      "ten thirty" with the colon silent — which is the right reading often enough that a rule
    //      claiming the shape would have to beat it, and the mined instances include a coordinate
    //      (`ຄວາມຊັນ:51 ອົງສາ`) and DMS notation rather than times.
    return s;
}
