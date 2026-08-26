/**
 * Igbo text normalization — the symbols a reader voices, rewritten to words before the tokenizer sees them.
 *
 * ⚠ Igbo has no independent referee (wikipron, epitran and kaikki all 404), so readings here rest on corpus
 * evidence and dictionary lookup rather than on a transcription source.
 *
 * Deliberately absent, because no usable word was found and inventing one is worse than silence: DEGREES
 * (neither `dịgrii` nor `selsiọs` occurs at all), MULTIPLICATION (the candidate `mụba` is the verb "to
 * increase", not the operator), and `£` / `€` (the signs occur but the words are ambiguous with the weight
 * unit, or too thin).
 *
 * ── UNITS, and the one key that is refused ─────────────────────────────────────────────────────────────
 *
 * This layer shipped with NO `units` table at all — not a table with a hole in it — so every metric
 * abbreviation reached the phoneme sink verbatim: `10 km` → *iɾi km*, and `48 kg` → *iɾi anɔ na asatɔ kɡ*,
 * the worst of them, where the letters are not merely left alone but PRONOUNCED as a cluster.
 *
 * Four keys are declared, from the five words below. Each word is a token on ig.wikipedia with the
 * measurement sense read in its own examples, and four of the five also occur in the mined artifact:
 *
 *   km  kilomita   99 hits / 20 articles · artifact ×9   — *"kilomita 70 ruo 80 n'ogologo"* (a length)
 *   mm  milimita   47 / 20              · artifact ×1   — see the false friend below
 *   cm  sentimita  97 / 20              · artifact ×1   — *"nkata dị sentimita 18 na dayameta"*
 *   kg  kilogram   85 / 20              · artifact ×1   — *"ihe omume ụmụ nwoke 55 kilogram"*
 *
 * ⚠ `milimita`'S HIT COUNT IS A TRAP, and reading the examples is what caught it: the densest wiki passage
 * is a banknote list — *"5 milimita 10 milimita 20 milimita … dinar 1 dinar Dinar 2"* — which is the Tunisian
 * *millime*, a CURRENCY SUBUNIT, not the millimetre. The same shape as `bar`'s `Komma` (all verb) and `ht`'s
 * `pwen` (all sports points). What rescues `mm` is that the artifact GLOSSES ITS OWN ABBREVIATION in the
 * measurement frame: *"mmiri ozuzo kwa afọ nke 580 milimita (22.8 in)"*, and all NINE of the artifact's
 * after-a-digit `mm` instances are rainfall (*"ihe dika 1,287 mm nime otu afǫ"*). The sense is settled by the
 * corpus, not by the count.
 *
 * ⚠ `m` IS REFUSED THOUGH IT HAS THE HIGHEST EXPOSURE OF ANY ABBREVIATION (14 after a digit, against `mm`'s
 * 9 and `km`'s 7). Of those 14: two are genuine elevations, eleven are athletics event names calqued from
 * English (`4 × 200 m freestyle relay`), and ONE IS NOT A METRE — *"a $60 m big-screen adaptation"*, where
 * `m` is *million*. A rule that replaces text cannot be 1-in-14 confidently wrong. And Igbo makes the
 * one-letter-key trap sharper than the tier's own `Il-76s` example does: `m` is the Igbo FIRST-PERSON
 * SINGULAR PRONOUN, the commonest bound morpheme in the language. It stays unauthored, and 14 occurrences
 * stay unread — silently, since a stray `m` voices as `m`, unlike `kg`.
 *
 * The same reading of the exposure table refuses the rest. `ha` is 0 after a digit and 54 as a bare token,
 * because `ha` is *"they"*; `in` (1 / 30) and `s` (0 / 19) are the same story — for a short key the
 * bare-token column measures the LANGUAGE, not the unit. `mi` (3) and `in` (1) are imperial and appear only
 * as a parenthetical gloss of a metric figure the sentence already gave (*"kilomita 115 (71 mi)"*), so
 * reading them would say one measurement twice. No `unitPer`: there is no `km/h` in the artifact at all and
 * `h` is 0 after a digit, so a rate would need two more words sourced to serve nothing.
 *
 * ⚠ `ft` IS ALSO REFUSED, AND THE ORIGINAL REASON FOR REFUSING IT WAS FACTUALLY WRONG — corrected here
 * rather than quietly restated. This header said `ft` appears ONLY as a parenthetical gloss. The RAW-LATIN
 * scan (`rawLatinIn`) found three `ft` lines and one of them is not a gloss: *"Ọdịdị alo dịgasị iche ma ọ
 * nwere ike iru 6 ft"* — a bare imperial measurement in the alo/ogene article, no metric figure anywhere in
 * the sentence. The refusal stands on a DIFFERENT ground, measured after the fact:
 *
 *   `ụkwụ` (the foot) — 197 tokens / 20 articles on the wiki, and the unit sense is real: the *Ụkwụ bọọdụ*
 *   (board-foot) article writes *"olu bọọdụ dị otu ụkwụ (305 mm) n'ogologo"*, the imperial foot with its
 *   own metric gloss. But that is ONE ARTICLE — a lead, not a finding, in this file's own terms — and in
 *   the artifact all SEVEN instances are something else: the foot of an escarpment (*"dina n'ụkwụ
 *   escarpment"*), a footstep (*"nzọụkwụ"*), and the idioms *gbara ụkwụ* ("came second") and *gbadoro
 *   ụkwụ* ("is based on"). Zero unit uses in 460 lines. Trap 37's shape exactly — a real word, healthy
 *   count, wrong sense in the slot that matters — so the three `ft` lines stay REPORTED rather than read.
 *
 * ── THE ENGLISH ORDINAL TAIL ───────────────────────────────────────────────────────────────────────────
 *
 * `8th`, `32nd`, `21st` — 13 of the artifact's 31 raw-Latin hits, the single largest defect in this layer,
 * and invisible until RAW-LATIN existed because the digits were being read correctly and only the two
 * letters survived. Rule 1b, `nke` + the cardinal, with the corpus evidence and the word-order cost.
 *
 * ── WHAT REMAINS REPORTED, AND WHY ─────────────────────────────────────────────────────────────────────
 *
 * 18 raw-Latin hits are left visibly failing. None is an Igbo reading this layer can source:
 *
 *   `pp ×4`, `pg`, `hg`   English and German BIBLIOGRAPHIC convention inside reference lists — *"Grants,
 *                         26pp."*, *"(Home on Sunday, pg. 8)"*, *"na Therese Fuhrer (hg)"* (Hrsg., the
 *                         German editor abbreviation). The surrounding text is not Igbo either.
 *   `ft ×3`               see above.
 *   `wdg`                 ⚠ THE ONE GENUINELY IGBO ABBREVIATION HERE, and it is refused for lack of an
 *                         EXPANSION, not for lack of attestation: 78 tokens / 19 articles, used exactly as
 *                         *etc.* (*"à á ā a̍ à, à á wdg."*, *"Ochie mkpuchi (Ụlọ ọrụ, wdg)"*). No source
 *                         found spells out what the three letters stand for, and a reading would have to
 *                         invent the phrase — the Fula `tere` failure. Reported, with its count recorded.
 *   `st`                  `St.` the English saint title, ×4 in one hagiography line (*"St. Columba"*).
 *   `ll`, `mw`            English `I'll`, and HTML that survived extraction (*`rel="mw:WikiLink"`*).
 *   `gb`, `kp`            ⚠ NOT A DEFECT — the detector's own documented false-positive population: a
 *                         sentence LISTING THE IGBO DIGRAPHS (*"Ihe iji wee maa atụ bụ:, ch, gb, gw, kp,
 *                         kw, nw"*). A text talking about its own letters, left reported by design.
 *   `dwt`, `pm`, `fm`     deadweight tonnage (*"ụgbọ mmiri 37,557 dwt"*), a clock (*"elekere 2.30pm"*) and
 *                         a radio frequency (*"na 100.9fm"*). One instance each, no word sourced for any.
 *
 * ⚠ AND IGBO HAS NO REFEREE, so what these gates are is worth stating: `review.ts`'s artifact scan, the
 * corpus diff and RAW-LATIN are METERS — they measure this layer against the corpus and against its own
 * previous output. `test/igbo*.test.ts` are TRIPWIRES — adjudicated readings that fail if anything moves.
 * There is no external transcription that can score a reading here, so a new word is only ever as good as
 * the corpus sense it was read out of.
 *
 * ── SQUARED, and the word the obvious candidate was hiding ─────────────────────────────────────────────
 *
 * `km2` is 4 after a digit here (*"ngụkọta ala nke 923,768 km2 (356,669 sq mi)"*, *"mpaghara ala 198 km2"*),
 * always ASCII — the artifact contains no `km²` at all. Declaring `km` WITHOUT a measure word makes that
 * WORSE rather than better: the tier's documented fallback re-emits the exponent, and an ascii `2` is not a
 * visible leak the way `²` is — it is a NUMBER, so *790 km2* read *"naɾɪ asaa na iɾi itoolu kilomita abʊɔ"*,
 * "790 kilometres two". A wrong quantity, invented by this layer, where before there was only raw text.
 *
 * ⚠ THE FIRST CANDIDATE WAS THE WRONG WORD AND ITS COUNT SAID OTHERWISE. Both the artifact and the wiki
 * write *"square kilomita 469"*, and `square` attests ×154 / 20 articles — but the examples are `P-Square`
 * (a Nigerian duo), `Cabot Square` (a plaza), `Square Records`. English proper nouns, not a measure word.
 * The real one is `skwea`, ×44 / 19 articles, and every single example is this exact slot:
 *
 *   *"kilomita skwea 7,223 (maịl skwea 2,789)"* · *"kilomita skwea 900"* · *"kilomita skwea 49,800"*
 *
 * NOUN, then modifier, then number — so `position: "after"`, which `unitPrefix` then completes into the
 * attested three-part shape without any further arrangement. `cubed` stays undeclared: no `km³` anywhere in
 * the artifact and no candidate word found, so the fallback keeps the unit's reading and leaves the mark.
 *
 * `cm` is the one key with ZERO artifact exposure, declared on the word's own evidence rather than the
 * abbreviation's — said here rather than hidden.
 *
 * ⚠ All five words are UNDOTTED. `kilomịta` has zero attestations; only `mịta` exists as a thin minority
 * spelling (18 / 3). Shipped untoned like every other word this layer emits.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

/**
 * THE UNIT TABLE, with the gloss each word was sourced by. See the UNIT section of the header for every
 * attestation, its sense, the `milimita`/*millime* false friend, and why `m` is refused.
 */
const UNIT = {
    km: "kilomita", // *"kilomita 70 ruo 80 n'ogologo"* — a length
    mm: "milimita", // *"mmiri ozuzo kwa afọ nke 580 milimita (22.8 in)"* — rainfall, the artifact's own gloss
    cm: "sentimita", // *"nkata dị sentimita 18 na dayameta"* — a diameter
    kg: "kilogram", // *"ihe omume ụmụ nwoke 55 kilogram"* — a weight class
} as const;

const SYMBOLS = makeSymbolNormalizer({
    /**
     * ⚠ THE SIGN FOLLOWS THE NUMBER BUT THE WORD PRECEDES IT — the one thing here that assuming English order
     * gets wrong. Written Igbo puts the sign after (`9%`); spoken Igbo puts the word first (`pasent 60`). Same
     * shape as Turkish `yüzde 40`.
     */
    percent: ["pasent"],
    percentPrefix: true,
    /**
     * The word FOLLOWS the number here (`nde naira`, "million naira"), which is the tier's default.
     *
     * ⚠ `US$` IS ITS OWN KEY BECAUSE THE BARE `$` IS LETTER-BOUNDED ON THE LEFT (trap 64) and so can never
     * match inside a code prefix — the sign is not dropped, it is never seen, which is why no probe reported
     * it. ×1 in the artifact (`totalled approximately US$170,000`), and ⚠ THAT INSTANCE IS AN ENGLISH
     * SENTENCE the ig wiki left untranslated, so it is evidence that the NOTATION occurs in this artifact
     * rather than evidence about Igbo register. THE SAME WORD, not a new one: `$` already reads `dollar`
     * here and a US dollar is that dollar, so nothing is sourced that was not sourced before.
     */
    currency: { "₦": ["naira"], "US$": ["dollar"], $: ["dollar"] },
    /** Derived from the ONE table above, so the tier and rule 2b can never disagree about which keys exist. */
    units: Object.fromEntries(Object.entries(UNIT).map(([k, w]) => [k, [w]])),
    /**
     * ⚠ THE UNIT NOUN PRECEDES ITS NUMBER — the second place in this file where assuming English order is
     * wrong, and for the same reason as `percentPrefix`: Igbo writes the abbreviation after the digits and
     * SAYS the noun first, because an Igbo numeral follows the noun it counts (*ụlọ atọ*, "house three").
     *
     * Established from the spelled-out instances, which are the ones that show what a reader says — a writer
     * spelling the phrase out in words is no longer copying a numeric layout. On ig.wikipedia `kilomita`
     * (the one term with no substring contamination, since `mita` sits inside the other three) precedes a
     * spelled numeral 330 times and follows one 61 — 84% noun-first — and precedes DIGITS 773 against 284.
     * The artifact's own spelled cases agree: *"kilomita otu narị na iri isii na ise"*, *"kilomita iri abụo
     * na atọ"*, *"kilogram 25"*, *"sentimita 60-80"*, *"kilomita 115 (71 mi)"*.
     *
     * ⚠ The artifact's DIGIT+ABBREVIATION instances are uniformly number-first (*"773 km"*, *"1,287 mm"*,
     * *"124 kg"*) and that is NOT counter-evidence — it is the written layout of the abbreviation, the exact
     * split `percentPrefix` above already records for `%`. The minority spoken order is real (*"na-aga ihe
     * ruru iri kilomita kwa ụbọchị"*) and is the documented 16% cost of picking the majority.
     */
    unitPrefix: true,
    /**
     * `skwea`, position `after` — *kilomita skwea 7,223*. See SQUARED in the header: the modifier follows its
     * noun in every attestation and `unitPrefix` then puts the number after both, which is the attested
     * three-part shape exactly. `cubed` is deliberately absent — no `km³` in the artifact and no word found.
     */
    exponentWords: { squared: ["skwea"], position: "after" },
    /** `na` — the ordinary Igbo connective, and the same word the number compositor uses to join parts. */
    ampersand: "na",
});

/** The thousands separator is a COMMA and the decimal separator a PERIOD — the Nigerian/English convention. */
const GROUPED = /(?<=\d),(?=\d{3}(?!\d))/gu;
/** A decimal period. Voiced as `ntụkpọ` — see rule 4. */
const DECIMAL = /(\d)\.(\d+)/gu;
/** A digit-flanked dash. See rule 2 for why this is a RANGE and never a minus. */
const RANGE = /(\d)\s*[-–—]\s*(?=\d)/gu;

/**
 * THE ENGLISH ORDINAL TAIL — `8th`, `32nd`, `21st`, `3rd`. See rule 1b.
 *
 * ⚠ THE DIGITS ARE REQUIRED AND THE WORD BOUNDARY AFTER IS REQUIRED, because the two letters alone are
 * ordinary Igbo material: `nd` opens *ndị* (the commonest word in the corpus) and `st` sits inside *Kraịst*
 * — both of which the RAW-LATIN detector reports, since Igbo's dotted vowels ⟨ị ọ ụ⟩ are not ASCII and a
 * plain-ASCII run therefore falls out of the middle of an ordinary word. Anchoring on the DIGIT is what
 * separates the ordinal from the orthography; nothing about the letters can.
 */
const ORDINAL_TAIL = /\b(\d+)(?:st|nd|rd|th)\b/giu;

/**
 * A letter fused to the front of a QUANTITY — the space rule 2b restores. ⚠ Derived from `UNIT`, so a key
 * added there is covered here without a second edit; see rule 2b for what goes wrong without it.
 */
const FUSED_QUANTITY = new RegExp(
    String.raw`(\p{L})(?=\d[\d.,]*\s*(?:${Object.keys(UNIT).join("|")})(?:[²³23])?(?![\p{L}\p{M}\d]))`,
    "giu",
);

/** Normalize Igbo text: symbols the reader voices become words, before `igbo.ts`'s TOKEN ever sees them. */
export function normalizeIgbo(text: string): string {
    let s = text;

    // 1. De-group thousands FIRST: a grouping comma left in place makes the number two numbers with a pause
    //    between them (`1,500` → *otu , naɾɪ ise*, "one, five hundred").
    //    ⚠ EXACTLY THREE FOLLOWING DIGITS, so a decimal comma cannot be eaten. Applied repeatedly for numbers
    //    with several groups (1,234,567).
    s = s.replace(GROUPED, "");

    // 1b. THE ENGLISH ORDINAL TAIL — `8th` → `nke 8`, which the number path then reads as *nke asatọ*.
    //
    //     ⚠ THIS IS A LEAK, NOT A COSMETIC GAP, and it is the largest single one in the artifact. Igbo has no
    //     digit-ordinal orthography of its own, so ig.wikipedia writes the English suffix inside Igbo prose —
    //     *"Naijiria na 2007 bu 37th n'uwa"*, *"mba 32nd kachasị n'ụwa"*, *"Nigeria bụ mba 8th nke kacha
    //     emepụta mmanụ"*. The number was already read; only the two letters survived, and `igbo.ts` PRONOUNCES
    //     an unknown ASCII run rather than dropping it, so *32nd* came out *"iri atọ na abụọ nd"*. 13 of the
    //     artifact's 31 raw-Latin hits are this one shape (`th ×8`, `st ×3`, `nd ×2`).
    //
    //     THE READING IS `nke` + THE CARDINAL, and the corpus states it rather than implying it — 48 instances
    //     of `nke` before a numeral, in the ordinal sense every time it is checkable: *"ụbọchị nke iri na isii
    //     n'ọnwa Nọvemba"* (the 16th day), *"ọnwa nke atọ n'afọ, Machị"* (the third month, March), *"narị afọ
    //     nke iri na itoolu"* (the 19th century), *"ọgbọ nke atọ, MediaWiki"* (third generation). ⚠ `nke` is
    //     polysemous — it is also the relative/genitive particle — so the count alone would not settle it; what
    //     settles it is that in EVERY numeral example the phrase denotes a rank. One of them is in a sentence
    //     this rule fires on: *"Nigeria bụ mba 8th nke kacha emepụta mmanụ, na nke iri kachasị nwee mmanụ"*
    //     writes the English ordinal and the Igbo one in the same breath, so the substitution is attested from
    //     inside the defect itself.
    //
    //     ⚠ NO WORD IS INVENTED AND NO WORD IS EMITTED. The rule writes `nke` plus the ORIGINAL DIGITS and
    //     hands them to the existing compositor — one source of truth for the numeral, and the ordinal marker
    //     is a corpus word this file did not coin.
    //
    //     ⚠ THE STATED COST IS WORD ORDER. Igbo's ordinal FOLLOWS its noun (*ọnwa nke atọ*), and the corpus's
    //     Igbo-frame instances are postnominal too (*mba 32nd*, *narị afọ nke iri na itoolu*), so in-place
    //     substitution is the attested shape there. The English-frame instances in the artifact — *"200th
    //     anniversary"*, *"4th Quarter 2005"*, *"7th Annual Leadership Awards"*, *"69th Primetime Emmy Awards"*
    //     — are prenominal, and the reading keeps them prenominal, which is the minority Igbo order. That is
    //     the same trade `unitPrefix` documents above, and it replaces a PRONOUNCED `th` with a real Igbo
    //     ordinal in a line already being read as Igbo throughout.
    //
    //     ⚠ AFTER rule 1, so a grouped `1,000th` is one number by the time this sees it.
    s = s.replace(ORDINAL_TAIL, "nke $1");

    // 2. ⚠ A DIGIT-FLANKED DASH IN IGBO IS A RANGE, NOT A MINUS — overwhelmingly year-year (`1967-1970`) or
    //    page-page (`peeji 90-120`). A minus rule here would read every date range as arithmetic, which is why
    //    nl, mr, ta and yue all record their minus as an ACCEPTED silence. `ruo` is "to, until".
    s = s.replace(RANGE, "$1 ruo ");

    // 2b. ⚠ A LETTER FUSED TO A QUANTITY, SEPARATED — because `unitPrefix` MOVES THE UNIT NOUN LEFTWARD and a
    //     missing space in the source then swallows it. The artifact's *"mpaghara ala198 km2"* (no space, and
    //     the corpus is full of such joins) read *mpaɣaɾa ala otu naɾɪ …* before units existed, because the
    //     number path inserts its own boundary — but the unit rule rewrites `198 km2` to `kilomita skwea 198`
    //     starting AT the digit, so the noun lands against `ala` and the utterance gained a fused word,
    //     *alakilomita*. One utterance in 459, and a defect this layer introduced rather than found.
    //
    //     Deliberately NARROW: it fires only when a DECLARED UNIT follows the digits, which is what makes the
    //     digit run a quantity by construction. A general letter/digit split would break `Il-76`-shaped
    //     designations and every alphanumeric name in the corpus.
    //
    //     ⚠ BEFORE the tier, and after the range rule so `ala198-200 km` is already two numbers.
    s = s.replace(FUSED_QUANTITY, "$1 ");

    // 3. The shared symbol tier.
    s = SYMBOLS(s);

    // 4. The decimal separator, LAST — the order is load-bearing. Run before the tier, this splits `8.3%` into
    //    `8 3%` and the percent word lands BETWEEN the halves (*asatɔ pasent atɔ*, "eight percent three"); the
    //    tier's number pattern spans `8.3`, so it must see the number whole.
    //
    //    ⚠ Leaving it alone is not neutral either: `igbo.ts`'s TOKEN treats `.` as clause punctuation, so `2.5`
    //    reads *abʊɔ . ise* — a sentence break inside a number.
    //
    //    `ntụkpọ` comes from a dictionary, not the corpus, which contains no instance of it (the near-miss
    //    `ntụpọ` means a SPOT). Shipped UNTONED, matching the register of every other word here and the fact
    //    that `igbo.ts` reads tone only when written.
    //
    //    The FRACTION stays digit-by-digit after the word: `3.14159` is "three point one four one five nine".
    s = s.replace(
        DECIMAL,
        (_m, whole: string, frac: string) => `${whole} ${MANIFEST.numbers.decimalWord} ${[...frac].join(" ")}`,
    );

    // A sentence-final period is untouched: DECIMAL requires a digit on BOTH sides.
    return s;
}
