/**
 * Ilocano / Iloko (ilo) text normalization — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE REFEREE IS A TRIPWIRE HERE, NOT A METER, and that was settled before any rule was written.
 * `tools/referee-eval/eval.ts` binds ilo to `phonemizeWordRules` — a WORD-level function, deliberately, so
 * the eval stays non-circular against the referee-derived lexicon. This layer runs inside the engine's
 * `text()`, which the eval never calls, so nothing below can move wikipron 766/926, kaikki 822/973 or
 * epitran 673/887. Byte-identical before/after is the CORRECT result; a moved number would mean the word
 * path had been touched by accident. The meters for this work are `corpus-diff` and `mine.ts scan`.
 *
 * EVIDENCE BASE. ilo.wikipedia is a real, human-written wiki (15,526 articles, 3.57M article-words) and NOT
 * a Lsjbot farm like ceb's, so the corpus is the full `ilowiki` dump: 38,655 paragraphs, 43,258 kept by
 * `filter-by-language.py --lang ilo`, 38,673 unique mined into `tools/corpus/mined/ilo.jsonc`
 * (covered 32/36 cells). Every count below is over that filtered text unless it says otherwise;
 * `attest.ts` against ilo.wikipedia is the second, weaker tier and is named where it was used.
 *
 * ⚠ THE CONTAMINANT IS ENGLISH, BY A FACTOR OF 17 OVER TAGALOG — 12,769 English-dominant paragraphs against
 * 730 Tagalog and 9 Cebuano, which is the reverse of the hil case and is why the `ilo` CONTRAST row is a
 * narrow supplement to the stock English list rather than a replacement for it. Writing that row surfaced
 * trap 37 six times over: `para` ×4,748 and `mula` ×4,112 are ORDINARY ILOCANO (the benefactive; a PLANT —
 * `mula` means "from" in Tagalog and "crop" here), `hindi` ×33 is the LANGUAGE Hindi, `wala` ×7 is a
 * language name, and `usa`/`mao`/`dili` are the USA, Mao Tse-tung and Dili. See filter-by-language.py.
 *
 * ── WHAT THE ENGINE DID BEFORE THIS FILE (probed, not assumed) ────────────────────────────────────────
 *
 *     adda aganay a 9,136,000 nga Ilokano  → sjˈam , saŋaɡˈasut … , sˈɛɾo      the value destroyed  ×2,272
 *     kalawa ti 1,497.70 kuadrado kilometro→ …kˈɛt pˈito . pitopˈulo…          a pause mid-number   ×1,492
 *     mangbukel iti 11.60% ti dagup        → …ʔinnˈɛm ʔˈa pˈulo tˈi dˈaɡup     the sign dropped     ×  911
 *     iti lugar ti 636 km².                → …tallopˈulo kˈɛt ʔinnˈɛm km .     raw Latin in the IPA ×  628
 *     Nakadisso iti 16°Am 26'              → …kˈɛt ʔinnˈɛm ʔˈam…               ° dropped            ×  954
 *     Dagiti 40-45 a rancheria             → ʔˈuppat ʔˈa pˈulo ʔˈuppat…        no connective at all ×1,842
 *     manipud iti 6:00 AM                  → ʔinnˈɛm , sˈɛɾo ʔˈam              pause + phantom sero ×   23
 *     nalako iti US$53.9 milion            → ʔˈus limapˈulo kˈɛt tˈallo…       the sign dropped     ×   98
 *     Luna & Balaoan itan                  → lˈuna balaʔˈoʔan                  the sign dropped     ×  281
 *     Bilin Blng. 1, 1972                  → bˈilin blŋ .                      a VOWEL-LESS token   ×  220
 *
 * ⚠ ILOCANO WRITES THE ENGLISH CONVENTION, like every treated Philippine language: the comma groups
 * thousands (×2,272) and the period marks the decimal (×1,492). Both were clause punctuation. Those two
 * rules plus the range and the percent carry ~6,500 of the ~7,000 instances this layer touches.
 *
 * ── WHAT DID NOT SURVIVE RE-MEASUREMENT FROM ceb AND hil, the two treated neighbours ──────────────────
 *
 * ⚠ THE RANGE WORD, FOR THE THIRD TIME IN THREE LANGUAGES. ceb reads `ngadto sa`, hil reads `hasta`; both
 *   are ×0 in Ilocano, which writes **`aginggana`** — and writes it BETWEEN DIGITS 220 times
 *   (`15 aginggana iti 64`, `1919 agingga 1925`, `10 aginggana ti 1,700 a metro`). See step 4.
 *
 * ⚠ THE CLOCK DISAMBIGUATOR IS NEITHER SIBLING'S, AND AN UNGUARDED RULE WOULD HAVE BEEN A DISASTER HERE.
 *   hil requires `alas` BEFORE the digits; `alas` is ×12 in Ilocano and **not one of them precedes a
 *   digit** — the one clock use spells its numeral out (`pagbaetan ti alas kuatro ken alas singko iti
 *   malem`) and the rest are place and language names (Alas-asin, Batak Alas, Severino de las Alas). ceb
 *   accepts a bare `\d{1,2}:\d{2}`; in this corpus that shape is ×205 and only ~23 are clocks. The other
 *   182 are **UTC offsets ×103** (`UTC+08:00`, `UTC−05:00`), **scripture references ×26** (`Juan 13:21`,
 *   `Ezek. 47:10`, `1 Macc. 14:34`, `Surah`) and flag ratios (`5:8`, `2:3`, `7:10`). A ceb-shaped rule
 *   would have fixed 23 and broken 182. See step 2 for the three arms that were measured instead.
 *
 * ⚠ THE MEASURE WORD'S POSITION IS INVERTED, AND ilo.wikipedia SAYS SO IN SO MANY WORDS. ceb and hil both
 *   postpose (`kilometro kwadrado`). The `km²` article on ilo.wikipedia is metalinguistic about it:
 *   *"Ti "km²" ket kayatna a sawen kuadrado kilometro, saan a kilometro kuadrado."* — «"km²" means
 *   *kuadrado kilometro*, NOT *kilometro kuadrado*». The corpus agrees 39:10, and the cube word the same
 *   way (`kubiko metro` ×15 : `metro kubiko` ×1). Hence `position: "before"`. Copying the sibling would
 *   have been wrong in the direction the language explicitly corrects.
 *
 * ⚠ `$` → THE DOLLAR WORD SURVIVES, BUT NONE OF THE THREE SPELLINGS I PROBED FIRST DID — trap 40, and the
 *   probe that "closed" it was lying. `attest.ts --words dolyar,dolar,dollar` returns `dolyar` 0, `dolar`
 *   0, and `dollar` **attested ×3 — every hit is *Million Dollar Baby*, the film** (the pcm `fut-bola`
 *   shape). On that evidence hil's refusal would have been copied. The word is **`doliar`**, ×26 in the
 *   corpus, with a definitional sentence that names the sign: *"Ti doliar ti Estados Unidos (senial: $;
 *   kodigo: USD)"*. A word-first probe cannot find a spelling you did not guess.
 *
 * ⚠ ceb's `dugang` FOR `+` DOES NOT TRANSFER, and neither does anything else. `dugang` is ×0 here; see the
 *   arithmetic refusals in defects.ts. hil's `sg`→`sang` rule has no analogue either: Ilocano's genitive is
 *   `ti`, and this corpus's `sg` (×38 after a digit) is the LINGUISTIC GLOSS `3sg`/`1sg` in articles about
 *   Papuan pronoun paradigms.
 *
 * ── THE RESIDUAL THE SCAN STILL REPORTS, ITEMISED (it will keep `review.ts --lang ilo` RED — trap 24) ──
 * `mine.ts scan` goes 8 defective classes → 4, and what remains is named here so nobody re-investigates it:
 *   · `DROP minus ×6` — the ONE that is known-wrong rather than acceptable, and deliberately not accepted.
 *     These are genuine negatives and no Ilocano word for one is attested; see defects.ts. The gate comes
 *     green the day the word is, not before (the ak/ln/bm stance).
 *   · `LEAK RAW-LATIN st ×5 · th ×2 · nd ×1` — ENGLISH ORDINAL SUFFIXES inside quoted US/Philippine army
 *     unit names (`1st Battalion`, `121st Infantry`, `4th Tank Regiment`, `2nd Battalion`). English
 *     citation residue, not a unit; they are not in `VOWELLESS_WORDS` because that table is a claim about
 *     Ilocano PHONOTACTICS and this is not one.
 *   · `LEAK RAW-LATIN km ×2` — TWO DIFFERENT CAUSES, and neither is a missing declaration. (a) `5 a riwriw
 *     km²`: the plain unit DOES compose across a magnitude (`3 a bilion km` reads *bilion kilometro*) but
 *     the EXPONENT branch does not, so the squared form leaks. ×8 corpus-wide, a shared-tier limit rather
 *     than an Ilocano one, and core is the reviewer's call. (b) `densidad 5,060 hab/km²`: a rate whose
 *     NUMERATOR is the Spanish `hab` (habitantes), which is not an Ilocano word and is not declared. ×1.
 *   · `LEAK RAW-LATIN kd ×1` — `676,578 km² (261,227 kd mi)`, one writer's ad-hoc contraction of
 *     `kuadrado`. One instance, one article; a key for it would be inventing an abbreviation.
 *   · `DROP exponent ×1` — `香港仔 hoeng¹ gong² zai²`, JYUTPING TONE NUMBERS in a Cantonese gloss. They are
 *     not exponents and no language reads them as powers, so silence is the correct output and the
 *     differential is reporting a true fact with a false label. It is NOT in `ACCEPTED_SILENT`: one
 *     foreign-citation instance does not earn a per-instance escape hatch, and ilo therefore stays out of
 *     the pinned list in test/accepted-silent.test.ts.
 *
 * ── FOUR MORE CLASSES DECLINED, EACH WITH ITS COUNT ──────────────────────────────────────────────────
 * ⚠ FRACTIONS: ×54, DECLINED. The denominators the corpus writes are 2, 3, 4, 5, 11, 12, 21 and 400, and
 *   Ilocano's fraction frame `apag-` + ordinal is attested for exactly two of them — `apagkatlo` ×6 (a
 *   third), `apagkapat` ×1 (a quarter). A fraction rule needs a SERIES (trap 13: the corpus's instances and
 *   the rule's branches are different sets), so a general rule would invent every denominator the corpus
 *   does not show, which is the Fula `tere` failure. `kagudua` ("half") ×176 is sourced and waiting.
 *   `sources.ts` agrees: `[NONE] fraction-series`.
 * ⚠ ERA MARKERS: ×563 (`BC` ×201, `AD` ×150, `SK` ×105, `CE` ×55, `BCE` ×52), DECLINED, and this one is a
 *   real gap rather than a comfortable one — `SK` reads as the vowel-less cluster [sk] and `BC` as [bk].
 *   `SK` is unmistakably Ilocano's own "before Christ" (`agarup a 713 SK`, `ti kalendario a Huliano … idi
 *   46 SK (708 AUC)`), and `K.K.P.` ×25 is the same era in another abbreviation. But the EXPANSION is
 *   unsourceable: `Sakbay ti Kristo` is ×0 in 38,673 paragraphs, ×0 on `attest.ts`, and a web search
 *   returns only English BC/AD explainers. Expanding it would be inventing a phrase, so it stays unread.
 * ⚠ ENGLISH ORDINAL SUFFIXES (`4th`, `121st`): ×37, DECLINED. Every instance is inside an English military
 *   unit name in a WWII article. Reading them would need English ordinals in an Ilocano engine.
 * ⚠ BARE EXPONENTS (`2²⁰`, `10⁶`, `2.5 × 10⁶ km³`): ×507 superscript runs, but `bareExponent` needs a
 *   TEMPLATE ("{n} to the power of {e}"), and no Ilocano phrase for a power is attested in the corpus or on
 *   ilo.wikipedia. The UNIT exponents — which are the bulk — are read; the bare ones are not.
 *
 * What DID survive from both siblings: the English-convention grouping/decimal split, `punto`, `kada`, the
 * closed dotted-abbreviation list keyed on words rather than on the shape, and the observation that the
 * native ordinal prefix already reads correctly (`maika-19 a siglo` → *maʔˈika saŋapˈulo kˈɛt sjˈam*,
 * ×4,561 with a digit — trap 16, a seam that already works, left alone).
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * The shared symbol tier. Ilocano marks plurality with `dagiti` and by reduplication, not on a borrowed
 * measure noun, so each CountForms is the single citation form.
 *
 * Sourced by whole-word count on the mined ilowiki corpus, digit-adjacency counted separately because that
 * is the slot (playbook 5e, trap 37):
 *   porsiento ×120 (×58 digit-adjacent) · punto ×550 · kuadrado ×119 · kubiko ×29 · kada ×120 ·
 *   metro ×369 (×204 digit-adjacent) · kilometro ×203 (×107) · sentimetro ×56 (×44) · milimetro ×10 (×7) ·
 *   kilogramo ×16 (×5) · milia ×71 (×28) · litro ×57 (×35) · mililitro ×2 (×2) · oras ×790 (×166) ·
 *   segundo ×83 (×28) · doliar ×26 · euro ×35 · ken ×46,555 · riwriw ×698 · bilion ×97 · ribo ×32.
 *
 * ⚠ THE PERCENT WORD IS `porsiento`, NOT ceb/hil's `porsyento`/`porsiyento`, and the corpus is unanimous:
 * `porsyento` ×0, `porsiyento` ×0, `pursiento` ×0. `attest.ts` confirms it independently — 28 tokens in 17
 * articles, in the slot (`92 a porsiento`, `9.4 porsiento iti rabaw ti Daga`). Three Philippine languages,
 * three spellings; the shared spelling is the thing that must not be assumed.
 *
 * ⚠ `$` IS DECLARED AND ITS SPELLING IS THE WHOLE STORY — see the header. `doliar` ×26, and the compound
 * key `US$` gets the fuller phrase because the corpus's own definitional sentence is *"Ti doliar ti Estados
 * Unidos (senial: $; kodigo: USD)"* and 15 of the 18 artifact currency instances write `US$`.
 *
 * ⚠ `₱` → `pisos`, AND `piso` IS A SENSE TRAP THAT `attest.ts` CAUGHT. Probing both: `piso` is attested ×3
 * and NOT ONE is money — two are the botanist **Willem Piso** and one is a Tagalog children's-story title.
 * `pisos` is attested ×7 and every hit is the currency IN A MONETARY AMOUNT — *"Lima pulo a Riwriw a Pisos
 * (P50,000,000.00)"*, *"800,000 a pisos"*, *"maysa a ribu a pisos a papel de banko ti Filipinas"* — plus
 * the definitional *"Ti pisos ti Filipinas (Ingles: Philippine peso)"*. So the plural-looking form is the
 * lemma this language spends, and the singular is a Dutch physician.
 *
 * ⚠ `£` → `libra esterlina` RESTS ON ONE ATTESTATION, AND THE BARE WORD WOULD HAVE BEEN WRONG (trap 37,
 * and it is ceb's `libra`/`pound` split arriving from the other side). Bare `libra` is ×4 and THREE are the
 * unit of WEIGHT — `12,546 a kilo (27,659 a libra)` of milk, `114 a libra (51 kg)`. The fourth is the
 * COLLOCATION, in a sentence listing the world's reserve currencies beside `doliar` and `euro`. That one
 * sentence is the whole of the evidence and the compound is unambiguous (`esterlina` occurs nowhere else),
 * so it is declared and the count is stated rather than hidden. `£` is ×5 in the corpus.
 *
 * ⚠ THE EXPONENT POSITION IS `before` FOR BOTH POWERS — see the header. `kuadrado kilometro` ×39 :
 * `kilometro kuadrado` ×10, `kubiko metro`/`kubiko sentimetro`/`kubiko desimetro` ×15 : `metro kubiko` ×1,
 * and ilo.wikipedia states the rule outright. This is the one place where ceb and hil are actively wrong
 * for Ilocano rather than merely unattested.
 *
 * ⚠ BARE `m` IS DECLARED (×300 digit-adjacent, every one a metre) AND TRAP 46 SAYS WHAT THAT COSTS: a
 * dotted designation like `802.11m` would read as eleven metres. The tier's `NOT_VERSION` guard rejects it
 * by seeing the DOT, and it can only do so because this file runs the tier at step 3, ABOVE the decimal
 * rule at step 5. The `version-dot` cell is ×8 here, so the exposure is real rather than theoretical.
 *
 * ⚠ `ft` → `pie` IS TRAP 40 A SECOND TIME IN THIS SAME RUN, and it was nearly written off. Probing the two
 * words a reference would give you — `piye` and `talampakan` — returns ×0 and ×0, and this file's first
 * draft therefore declined `ft` "for want of a foot word". The corpus has one, spelled the Spanish way:
 * `pie` ×17 and `pié` ×9, fourteen of them digit-adjacent in the parenthetical gloss beside a metric figure
 * (`14,000 a pié (4,300 m)`, `20,320 pié (6,194 m)`, `5,200 pie ti ngato ti lessaad ti baybay`) plus the
 * area form `43,560 a kuadrado a pie`. `ft` is ×36 and every instance is that same gloss. ⚠ The three
 * `pie` tokens that are NOT the unit are the uppercase `PIE`, Proto-Indo-European — a different case and
 * not a unit key, so they cannot collide.
 *
 * ⚠ THREE UNIT KEYS THE CORPUS WRITES ARE DELIBERATELY NOT DECLARED, each for a measured reason:
 *   · `in` ×22 after a digit is **not inches** — it is English prose inside this wiki (`617,996 in 2011`,
 *     `pp. 87–125 in Clifford Geertz`). Declaring it would read English sentences as measurements, which is
 *     confidently wrong replacing merely silent. `pulgada` ("inch") is attested ×34 and stays unused for
 *     want of a safe key.
 *   · `g` ×10: a one-letter key against a live `version-dot` cell (trap 28), for ten instances. `gramo`
 *     ×17 is attested and available the day a two-letter key needs it.
 *   · `l` (bare litre): the shape `\d\s?L` matches this corpus's FRENCH BOOK TITLES — `1939 L'imaginaire`,
 *     `1940 Les mouches` — so only the two-letter `ml` is declared. `litro` ×57 is attested and waiting.
 *
 * ⚠ `s` IS A RATE DENOMINATOR ONLY, never standalone: `segundo` is attested ×28 digit-adjacent but a bare
 * `76s` must not become seconds (the Dutch `Il-76s` lesson, encoded in `rateDenominators`).
 *
 * ⚠ NO `multiply` DECLARATION. `×` is ×19 and the senses do not agree: `17 × 2¹⁶` and `26 × 26 × 26` are
 * products, and `Musa × paradisiaca` / `Musa acuminata × M. balbisiana` are BOTANICAL HYBRID SIGNS, which
 * are read as neither "times" nor "by". No Ilocano word for the operator is attested — see defects.ts.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["porsiento"],
    currency: {
        "US$": ["doliar ti Estados Unidos"],
        $: ["doliar"],
        "€": ["euro"],
        "₱": ["pisos"],
        "£": ["libra esterlina"],
    },
    magnitudes: ["ribo", "riwriw", "milion", "bilion", "trilion"],
    units: {
        km: ["kilometro"], m: ["metro"], cm: ["sentimetro"], mm: ["milimetro"],
        kg: ["kilogramo"], mi: ["milia"], ml: ["mililitro"], ft: ["pie"],
        // ⚠ `mph` IS ITS OWN KEY, NOT THE COMPOSITION OF ITS PARTS — trap 44, the Māori `m/h` move. There
        // is no `p` denominator to compose through, so without this the whole abbreviation reaches the IPA
        // raw (`560 mph` → *mph*). The reading is COMPOSED FROM ATTESTED PIECES rather than borrowed:
        // `milia` ×71 (×28 digit-adjacent), `kada` ×120, `oras` ×790 (×166) — the same three words the
        // `mi` key and `unitPer`/`rateDenominators` already spend. ×2 in the corpus; small, and free.
        mph: ["milia kada oras"],
    },
    exponentWords: { squared: ["kuadrado"], cubed: ["kubiko"], position: "before" },
    unitPer: "kada",
    rateDenominators: { h: "oras", s: "segundo" },
    // `ken` ×46,555 is the corpus's second-commonest word and the language's ordinary conjunction, so the
    // ampersand needs no separate sourcing. ⚠ Every one of the corpus's 281 ampersands sits inside a NAME —
    // `Luna & Balaoan`, `AT&T`, `J&M Entertainment`, `Papua New Guinea & Solomon Islands`, `TLS & TL` — so
    // this closes a DROP rather than repairing Ilocano prose, and the tier spaces it on both sides so
    // `AT&T` stays three tokens (trap 18).
    ampersand: "ken",
});

/**
 * Dotted abbreviations, and the list is SHORT ON PURPOSE — trap 2 caught in the act for the third
 * Philippine language running. A first tabulation of `[A-Z][a-z]{0,4}\.` before a capital reported the
 * commonest "abbreviations" as `Ungto.` ×373, `Hapon.` ×301, `Asia.` ×220, `Daga.` ×213, `India.` ×170 —
 * every one a SENTENCE END (*Amianan nga Ungto.* is the North Pole). The genuine dotted forms are
 * `Blng.` ×220, `Jr.` ×103, `Dr.` ×55, `St.` ×41 and `Sr.` ×19, plus a 2,442-strong tail of single-letter
 * personal initials in author lists, which are left alone (they already read as a letter plus a pause).
 * So the rule is keyed on a CLOSED LIST and never on the shape, and the dot is KEPT out of the replacement
 * so a genuine sentence end is unaffected either way (trap 4).
 *
 * ⚠ `Blng.` IS THE BIG ONE AND IT IS NOT A SIBLING'S RULE — it is Ilocano's own contraction of `bilang`
 * ("number"), ×220 in legal citations (`Bilin Blng. 1`, `Tignay ti Republika Blng. 5446`, `Proklamasion
 * Blng. 3`). It has no vowel, so it can never be a word, and it reached the IPA as the bare cluster [blŋ].
 * The expansion is the corpus's own word, ×594. ⚠ No other gate in this repo can see this: `blng` is Latin
 * letters in a Latin-script language, which is why `mine.ts scan`'s RAW-LATIN class had to be added.
 *
 * ⚠ EVERY EXPANSION IS CORPUS-SOURCED: `bilang` ×594, `doktor` ×52, `santo` ×321, `junior` ×17,
 * `senior` ×6. Nothing here is translated from English.
 */
/**
 * A UNIT IN THE `per` SLOT HAS NO NUMBER BESIDE IT, SO THE SHARED TIER CANNOT REACH IT — and in this corpus
 * that is the THIRD-largest single defect, ×133.
 *
 * Ilocano states a population density as *`N a tattao tunggal maysa a km²`* ("N people per square km"): the
 * numeral belongs to `tattao`, and the unit sits after the per-phrase with nothing numeric adjacent to it.
 * `makeSymbolNormalizer` matches a unit only AFTER a number (deliberately — that adjacency is what stops a
 * short key biting into a word), so all 133 of these reached the IPA as a raw `km` with the exponent
 * dropped. This is the playbook's "local is right when the tier CANNOT say it" case, reason 2: the tier can
 * only postpose onto a quantity, and here there is no quantity.
 *
 * ⚠ THE KEY SET IS THE MEASURED ONE PLUS ITS ADVERSARIAL NEIGHBOURS (trap 8). The corpus writes `km²` in
 * this slot ×133 and nothing else at all; `km`, `m²` and `m` are the shapes the same template would produce
 * for a length or a smaller area, cost nothing, and stop the rule being correct only where I happened to
 * look. The nouns are the same ones the tier declares above — they are repeated rather than imported
 * because the tier's table is keyed for a different matcher, and the duplication is four entries.
 */
const PER_UNIT: Readonly<Record<string, string>> = {
    "km²": "kuadrado kilometro", "m²": "kuadrado metro", km: "kilometro", m: "metro",
};
const PER_UNIT_ALT = Object.keys(PER_UNIT).sort((a, b) => b.length - a.length).join("|");

const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    blng: "Bilang", dr: "Doktor", jr: "Junior", sr: "Senior", st: "Santo",
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Every rule emits DIGITS where a number is involved and lets the engine's own number path speak them. */
export function normalizeIlocano(input: string): string {
    let s = input;

    // ── 1. DE-GROUP THOUSANDS — FIRST, and the biggest defect this layer repairs ─────────────────────────
    // ×2,272, every one comma-grouped (`adda aganay a 9,136,000 nga Ilokano`, `populasion iti 822,352`).
    // `,` is clause punctuation and the TOKEN splits on `\d+`, so the value was read as two or three
    // numbers with pauses between them.
    // ⚠ EXACTLY THREE DIGITS PER GROUP, so the ×1,492 period-decimals survive and so does the corpus's
    // handful of comma-separated DIGIT LISTS — `aggibus iti 0,1,8,9` (phone-number prefixes) has one digit
    // per group and is left alone, which is the whole reason for the `{3}`.
    // ⚠ THE TRAILING GUARD REJECTS ONLY A FOLLOWING DIGIT, so a grouped number followed by its decimal
    // point still de-groups: `1,497.70 kuadrado kilometro`, `12,546 a kilo`, `676,578 km²`.
    // ⚠ AND THE PERIOD-THOUSANDS FORM IS NOT HANDLED, because it does not exist here: every
    // `\d{1,3}\.\d{3}` in this corpus is a three-decimal DECIMAL (`0.625`, `0.443`, `6.271 a riwriw`).
    // Step 5's two-digit cap leaves them untouched rather than reading them as a decimal it cannot cap.
    s = s.replace(/(?<![\d.,])(\d{1,3}(?:,\d{3})+)(?!\d)/gu, (m) => m.replaceAll(",", ""));

    // ── 2. CLOCK — BEFORE the tier and before the decimal rule ───────────────────────────────────────────
    // ⚠ THE GUARD IS THE RULE. `\d{1,2}:\d{2}` is ×205 in this corpus and only ~23 are clocks; see the
    // header for the 182 that are not. So the colon alone licenses nothing, and each arm below was counted:
    //   (a) a following AM / PM / a.m. / p.m. / GMT / UTC          ×15   `6:00 AM`, `10:30 UTC`, `8:45 GMT`
    //   (b) a following part-of-day                                 ×4   `8:16 ti agsapa`, `7:50 iti rabii`
    //   (c) a preceding `oras a` / `oras ti` ("at the hour of")     ×4   `oras a 6:30 aginggana iti 6:15`
    // Fixes ~23, breaks 0. ⚠ THE LEADING SIGN GUARD IS WHAT KEEPS ARM (a) OFF THE 103 UTC OFFSETS: `10:30
    // UTC` is a time and `UTC+08:00` is not, and the only difference between them is the sign in front —
    // so a `[+\-−]` immediately before the hour disqualifies the match. (Arms (b) and (c) cannot reach an
    // offset anyway, but the guard is on the shared pattern so nobody has to re-derive that.)
    // ⚠ THE MINUTES JOIN WITH `ket`, which is the manifest's own numeral CONNECTOR (`sangapulo ket lima`),
    // so it needs no separate sourcing. On the hour they drop out, which is what removed the phantom
    // *sero* from `6:00`.
    // ⚠ THE REGISTER IS A KNOWN, MEASURED RESIDUAL, the same one hil recorded. Ilocano's spoken clock idiom
    // takes the SPANISH numerals — the corpus's one spelled-out clock is `alas kuatro ken alas singko` —
    // so a reader says *alas sais*, not the native *innem* this emits. Reading it right needs a sourced
    // Spanish 1–12 set for ilo, which neither the corpus (which writes the digits) nor `attest.ts` supplies
    // as a paradigm. What this rule does fix is the false pause and the phantom zero.
    const clock = (_m: string, h: string, min: string): string =>
        Number(min) === 0 ? `${Number(h)}` : `${Number(h)} ket ${Number(min)}`;
    const HOUR = String.raw`(?<![\d.:+\-−])([01]?\d|2[0-3]):([0-5]\d)(?!\d)`;
    s = s.replace(new RegExp(`${HOUR}(?=\\s*(?:[ap]\\.?\\s?m\\.?(?![\\p{L}])|GMT|UTC))`, "giu"), clock);
    s = s.replace(
        new RegExp(`${HOUR}(?=\\s*(?:ti|iti)\\s+(?:agsapa|bigat|malem|rabii|sardam|aldaw))`, "giu"),
        clock,
    );
    s = s.replace(new RegExp(`(?<=oras\\s+(?:a|ti|nga)\\s+)${HOUR}`, "giu"), clock);

    // ── 3. THE SHARED TIER — percent, currency, units, the measure words, rates, `&` ─────────────────────
    // ⚠ AFTER DE-GROUPING, or `676,578 km²` is seen as `578 km²`. ⚠ BEFORE THE DECIMAL RULE — the
    // playbook's "units before decimals" coupling: the tier matches a unit only when a NUMBER is adjacent,
    // and rewriting `3.79` to `3 punto 7 9` destroys that adjacency. It is ALSO what keeps `NOT_VERSION`
    // armed for the one-letter `m` key (traps 39 and 46), since that guard works by seeing a dot the
    // decimal rule would otherwise have spent.
    // ── 2b. THE `Nh NNm NNs` TIME COORDINATE — BEFORE the tier, and it exists to disarm a false positive ──
    // ⚠ THIS IS WHAT BARE `m` COSTS, MEASURED AND THEN PAID OFF. Trap 28's own framing applies: bare `m` is
    // ×300 digit-adjacent in this corpus and **296 are genuine metres**, so declaring it is overwhelmingly
    // right — but the other FOUR are the astronomical / UTC-offset notation where `m` is a MINUTE, and the
    // tier would read them as metres, which is confidently wrong rather than merely silent:
    //     `panagpangato a 12 h 49 m`   ·  `GMT −0h 43m 08s`  ·  `GMT +0h 19 m 32.13s`  ·  `GMT +0h 20 m`
    // The shape is unambiguous — a digit-plus-`h` followed by a digit-plus-`m` — and it captures 4 of the
    // corpus's 4 `\dh` occurrences, i.e. perfect precision on the only evidence there is.
    // ⚠ EVERY WORD IS ATTESTED IN THE CORPUS: `oras` ×790 (×166 digit-adjacent), `minuto` ×45,
    // `segundo` ×83 (×28). So this reads the notation rather than merely silencing it.
    s = s.replace(
        /(?<![\p{L}\p{M}\p{Nd}])(\d{1,2})\s?h\s?(\d{1,2})\s?m(?:\s?(\d{1,2}(?:\.\d+)?)\s?s)?(?![\p{L}\p{M}\p{Nd}])/gu,
        (_m, h: string, min: string, sec: string | undefined) =>
            `${h} oras ${min} minuto${sec === undefined ? "" : ` ${sec} segundo`}`,
    );

    // ⚠ THE PER-SLOT UNIT MUST BE SPENT BEFORE THE TIER RUNS, not after: `6,632 tattao tunggal maysa a km²`
    // contains a number, and leaving the abbreviation for the tier to look at risks nothing today but
    // guarantees the two rules cannot disagree tomorrow. See PER_UNIT. ×133.
    s = s.replace(
        new RegExp(`(?<=tunggal\\s(?:maysa\\s(?:a|nga)\\s)?)(${PER_UNIT_ALT})(?![\\p{L}\\p{M}²³])`, "gu"),
        (_m, u: string) => PER_UNIT[u]!,
    );
    s = SYMBOLS(s);

    // ── 4. RANGES → `aginggana iti` — BEFORE the decimal rule ────────────────────────────────────────────
    // ×1,842 unwritten dashes, against ×220 where the corpus writes the connective out BETWEEN THE DIGITS
    // itself — the strongest attestation there is, and far more of it than either sibling had:
    //     aginggana iti ×127 · aginggana ti ×47 · agingga iti ×29 · agingga ×10 · aginggana ×6
    // (`15 aginggana iti 64`, `1919 agingga 1925`, `10 aginggana ti 1,700 a metro`, `5 agingga 20 a
    // sentimetro`). `aginggana iti` is the majority form and is what this emits. The dash was simply
    // dropped, leaving two numbers abutting with no connective — and for a YEAR SPAN (`(1899-1902)`,
    // `1934-1937`, `781–869`) that is by far the commonest shape here.
    // ⚠ THE THREE GUARDS THE su/so/ceb/hil RUNS PAID FOR, carried rather than re-earned: do not double a
    // connective the text already wrote, do not claim a HYPHEN CHAIN (an identifier, not a span), and
    // require digits on BOTH sides — which is also what keeps this rule off `maika-19`, where the hyphen
    // has a LETTER on its left.
    // ⚠ THE OPERANDS ACCEPT A DECIMAL, WHICH IS WHY THIS RUNS ABOVE STEP 5, exactly as in hil:
    // `0.25–0.33 pulgada` and `6.4–8.4 mm` are real corpus ranges, and with the decimal rule first this
    // would claim `25–0` and emit a backwards span from inside a number.
    s = s.replace(
        /(?<!\b(?:aginggana|agingga|inggana|manipud|manipud iti|manipud idi)\s(?:iti\s|ti\s)?)(?<![\d.,\p{L}-])(\d[\d,]*(?:\.\d+)?)\s?[-–]\s?(\d[\d,]*(?:\.\d+)?)(?![\d,-]|\.\d)/gu,
        "$1 aginggana iti $2",
    );

    // ── 5. DECIMALS → `punto` ───────────────────────────────────────────────────────────────────────────
    // ×1,492, every one previously a clause pause mid-number (`1,497.70 kuadrado kilometro` →
    // *…kˈɛt pˈito . pitopˈulo…*).
    // ⚠ THE WORD IS ATTESTED IN THE SLOT, NOT INFERRED FROM A SIBLING, and this is the one place a written
    // corpus can beat the playbook's own warning that "writers type 302.18, they never spell out how they
    // would say it". This corpus does spell it out, in a sentence about the Human Development Index:
    //     *"…ti pateg ti HDI iti maikanem a desimal a punto"*  — "to the sixth DECIMAL POINT"
    // `punto` is ×550 overall, and the rest are the geographic sense (`kaadaleman a punto`, the deepest
    // POINT). ⚠ `attest.ts` alone would have been the Gabon-district trap: its `punto` hits are 134 tokens
    // in 20 articles and the examples are all **Punto Batorampon**, a headland in Mindanao. The corpus
    // sentence is what closes this, and the wiki corroborates only that the word means "point".
    // ⚠ ONE OR TWO FRACTIONAL DIGITS ONLY, and the cap is measured: this corpus's three-digit fractional
    // parts are HDI figures (`0.625`, `0.443`, `0.856`) and `6.271 a riwriw`, i.e. genuine three-decimal
    // values that the digit-by-digit tail would read correctly anyway — but capping at two is what makes
    // the rule provably unable to eat a period-thousands group, and this corpus has none to eat.
    // ⚠ The fractional part is read DIGIT BY DIGIT, which is what a decimal is.
    s = s.replace(/(\d)\.(\d{1,2})(?![\d.,])/gu, (_m, a: string, b: string) => `${a} punto ${[...b].join(" ")}`);

    // ── 6. DEGREES → `grado`, with the two scale names ───────────────────────────────────────────────────
    // ×954 digit-adjacent `°`, the third-largest class here and one the shared tier does not own. The sign
    // was dropped outright and the scale letter reached the IPA as a bare consonant: `−224 °C` read
    // *…ʔˈuppat k*, `−129 °F` read *…p*.
    // ⚠ THE CLASS IS MOSTLY COORDINATES, NOT TEMPERATURES, which is why the bare arm matters most:
    //     coordinate (`16°Am 26'`, `116° 40'`, `126° 34' E`)   ×202     °C ×62     °F ×21
    //     bare angle  (`47.8°`, `23.4°`, `28.3° laeng`)        ×669
    // A coordinate IS degrees, so one word serves both and no second reading has to be sourced.
    // ⚠ BOTH SCALE NAMES ARE ATTESTED AND THE COLLOCATION IS THE EVIDENCE (trap 37). `grado` alone is ×162
    // and the polysemy is live — *aginggana iti maikanem a grado* is a SCHOOL GRADE, *Grado ti Doktor* is a
    // degree certificate. What licenses this rule is `grado Celsius` ×9, every one digit-adjacent
    // (`8 a grado Celsius`, `23 grado Celsius`, `6.3 grado Celsius`, `30.4 grado Celsius`). Fahrenheit is
    // attested the same way but in the mixed frame the corpus prefers — `82 Fahrenheit`, `200-800
    // Fahrenheit`, `−459.67 °F iti Fahrenheit a gantingan`, `maysa a grado ti Fahrenheit para iti tunggal
    // maysa a millibar` — ×7, which is thin but unambiguous and in the slot.
    // ⚠ AFTER THE TIER, so a temperature's number is not disturbed; BEFORE the decimals only for tidiness —
    // both orders give the same reading, since `47.8°` matches on its last digit either way.
    // ⚠ THE ARC-MINUTE `'` IS LEFT UNREAD. It is ×138 beside a degree sign and no Ilocano word for it is
    // attested anywhere; see defects.ts. It survives as the manifest's glottal, which is a residual, not a
    // reading — recorded rather than guessed.
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 grado Celsius");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gu, "$1 grado Fahrenheit");
    s = s.replace(/(\d)\s?°/gu, "$1 grado ");

    // ── 7. DOTTED ABBREVIATIONS — closed list, see DOTTED_ABBREV ─────────────────────────────────────────
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}`);

    // ── 8. `c.` / `ca.` BEFORE A YEAR → `agarup a` ───────────────────────────────────────────────────────
    // ×157 (`c.` ×130, `ca.` ×27), always Latin *circa* introducing a date: `(c. 371–287 BC)`,
    // `c. 450 SK`, `naipasngay c. 1480`, `c. 1306 kas fresco`. Unhandled it is two defects at once — the
    // dot is read as a CLAUSE BREAK in the middle of a date, and the bare `c` reaches the IPA as [k].
    // ⚠ THE REPLACEMENT IS THE CORPUS'S OWN WORD IN THE SAME FUNCTION, not a translation brought in from
    // outside: `agarup` ("approximately") is ×2,286 and its ordinary use is exactly this
    // — `agarup a 713 SK`, `agarup a 500 kilometro`, `agarup a 27,300 km²` — so the rule substitutes a
    // Latin abbreviation with the phrase this text already writes 2,286 times for the same idea.
    // ⚠ A FOLLOWING DIGIT IS REQUIRED, and that is what separates it from a personal INITIAL. This corpus
    // has 2,442 lone `X.` tokens in author lists (`Mathew, S. P. and C. R. Chitra`), so an unguarded `c\.`
    // would read every one of the `C.`s as "approximately".
    s = s.replace(/(?<![\p{L}\p{M}.])c(?:a)?\.\s*(?=\d)/giu, "agarup a ");

    return s;
}
