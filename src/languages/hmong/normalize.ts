/**
 * Hmong (hmn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ WHITE HMONG, AND SAID SO EXPLICITLY. `hmn` is a MACROLANGUAGE. Every word and every count below is
 * **White Hmong / Hmoob Dawb (Hmong Daw, `mww`)** — the variety `hmong.ts` targets and the only variety the
 * available text is written in. Green Hmong / Mong Njua (`hnj`) differs in its sibilants and laterals; no
 * source here is about it and nothing here should be read as covering it.
 *
 * ⚠ RPA, AND ONLY RPA. Hmong is written in three scripts — the Romanized Popular Alphabet, Pahawh Hmong
 * (U+16B00–16B8F) and Nyiakeng Puachue (U+1E100–1E14F). This engine's token class is `LATIN_RUN` and its
 * manifest declares `"script": ["Latin"]`, so only RPA reaches these rules. That is not merely the engine's
 * claim: measured over the corpus's 76,348 characters of prose, Pahawh is **3 characters**, Nyiakeng Puachue
 * **3**, Han **31**, ASCII letters **58,050** — and all six non-Latin characters sit inside the one article
 * that LISTS the scripts. (The `cdo` run's lesson, applied before designing rather than after.)
 *
 * ⚠ THE EVIDENCE, AND ITS CEILING. There is **no Hmong Wikipedia at any code** — `hmn`, `mww` and `hnj` all
 * fail to resolve, `Wp/hnj` does not exist on Wikimedia Incubator, and `Wp/hmn` is a single page, in English,
 * saying that `hmn` is a macrolanguage. The whole of the Hmong corpus that exists is Incubator **`Wp/mww`**:
 * 112 article pages, 190 paragraphs, ~14,700 tokens after `filter-by-language.py --lang hmn`. So an empty
 * cell here is a query that HAS been run (the `cjy` situation), and — the consequence that matters —
 * **`attest.ts` cannot be run for this language at all**: it probes `<lang>.wikipedia.org`, and the only wiki
 * that exists is already IN this corpus, so a probe would be the corpus answering itself. Full log:
 * `docs/investigations/hmn_normalization_investigation.md`.
 *
 * ⚠ THE PARAGRAPH-LEVEL CONTAMINATION CHECK CAME BACK NEGATIVE, which is worth stating because the fleet's
 * recent runs all came back positive (bal 37.4% Persian/Urdu, bar 24% German, ht 15.1% French, su 12.9%
 * English). `filter-by-language.py --lang hmn` drops **0 paragraphs** as English. Wp/mww is translated FROM
 * English rather than padded WITH it, so its contamination is at the WORD level — untranslated proper nouns
 * and stray adjectives (`occupying`, `romantic comedy`, `superseded`) inside otherwise Hmong sentences — and
 * no paragraph filter can see that. It is also why `21st`/`19th`/`13th` are in this corpus: they are English
 * ordinals the translator left behind, NOT Hmong morphology, and no ordinal rule is written for them.
 *
 * ── ⚠⚠ THE CENTRAL HAZARD: IN RPA THE FINAL CONSONANT LETTER IS THE TONE ───────────────────────────────
 *
 * White Hmong has NO coda consonants, so a word-final ⟨b j v s g m d⟩ is a TONE MARKER and not a consonant.
 * That is the manifest's own statement, and it is not a theoretical hazard here — **it is already live in the
 * converter**:
 *
 *     syllableToIpa("km")   → strips the `m` AS A TONE (creaky low), leaves onset `k` with an EMPTY rime,
 *                             fails the rime lookup and returns "km" RAW into the IPA
 *     syllableToIpa("th")   → onset ⟨th⟩, empty rime → "th" raw          (the tail of `19th`)
 *     syllableToIpa("st")   → onset `s`, rime "t" → "st" raw             (the tail of `21st`)
 *
 * So the engine does not merely fail to read a stray Latin abbreviation; it parses the abbreviation's second
 * letter as a TONE and then gives up. Three consequences, applied throughout this file:
 *
 * · **NO ONE-LETTER UNIT KEY, AT ALL.** Traps 28 and 46 say a one-letter key is unsafe even on a corpus that
 *   measures clean; in RPA the exposure is worse, because the letter such a key would claim is a tone and
 *   every word in the language ends in one. Measured here: digit-adjacent one-letter tokens are `n` ×1 (the
 *   `50 ° N. M.` coordinate) and nothing else — so a one-letter key would buy **zero** readings for the whole
 *   of that exposure. None is declared. This is the `za` precedent (commit 6cf98e9) with the trade going the
 *   other way, because `za` had 8 genuine metres to buy and hmn has none.
 * · **NO BOUND-SUFFIX RULE ON DIGITS (traps 14/15).** Hmong is isolating and writes no case suffix, glued or
 *   spaced; `grep -oE '[0-9] ?[a-z]{1,4}'` over the corpus returns measure phrases and magnitude words
 *   (`lab`, `vam`, `km`), never a morpheme. A digit-plus-short-token rule here would be a rule about English
 *   leftovers.
 * · **EVERY RULE THAT TOUCHES A LETTER CARRIES BOTH LOOKAROUNDS**, `(?<![\p{L}\p{M}])` and
 *   `(?![\p{L}\p{M}])`. Biting one letter off an RPA word does not produce a malformed word; it produces a
 *   DIFFERENT word, one tone over.
 *
 * ── WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes ───────────────────────────────────────
 *
 *     Pejxeem - 146.270.033 neeg.  → …pˡau̯˥ cau̯˧˩̤ ʈau̯˧ . ʔɒ˥ puə̯˩ ça˧ cau̯˩̰ . pe˥…  THREE numbers, two SENTENCE BREAKS
 *     23,822,747                   → nẽ˩ ᵑɡau̯˩̰ pe˥ , ʝi˩̰ puə̯˩ …                        three numbers, two comma PAUSES
 *     8,46 lab                     → ʝi˩̰ , pˡau̯˥ cau̯˧˩̤ ʈau̯˧ la˥                        a pause inside one quantity
 *     2.9 lab                      → ʔɒ˥ . cuə̯˥˧ la˥                                      a FULL STOP inside one quantity
 *     60%.                         → ʈau̯˧ cau̯˩̰ .                                         the % SILENT
 *     5-10%                        → t͡ʂi˥ kau̯˩̰                                           two bare cardinals, hyphen and % gone
 *     $10 lab                      → kau̯˩̰ la˥                                             the $ SILENT
 *     US $ 46,330                  → ʔu˩ pˡau̯˥ cau̯˧˩̤ ʈau̯˧ , …                          `US` read as the Hmong syllable *us*
 *     6 mus rau -50 ° C            → ʈau̯˧ mu˩ ʈau̯˧ t͡ʂi˥ cau̯˧˩̤ C                       sign silent, ° silent, `C` RAW IN THE IPA
 *     357.021 km2                  → pe˥ puə̯˩ … . nẽ˩ ᵑɡau̯˩̰ ʔi˥ km ʔɒ˥                 `km` raw AND the `2` read as the NUMBER *ob*
 *     1438-1806                    → two bare cardinals, no connective                      ×6
 *
 * ── HOW THE THREE WORDS THIS LAYER EMITS ARE SOURCED ───────────────────────────────────────────────────
 *
 * ⚠ `feem pua` (PERCENT) IS ATTESTED AS THE COLLOCATION, IN THE SLOT, THREE TIMES, IN THREE ARTICLES — which
 *   is trap 37's requirement rather than a bare token count. Each instance follows a SPELLED-OUT number, so
 *   it settles the POSITION as well as the word:
 *
 *       ntau tshaj rau FEEM PUA ntawm lub ntiaj teb          more than six percent of the world
 *       cuaj caum-xya FEEM PUA ntawm Nyiv lub teb chaws      ninety-seven percent of Japan's territory
 *       Ris peb caug xya FEEM PUA ntawm cov ntiaj teb no     thirty-seven percent of this world's
 *
 *   Corroborated outside this tree by the Minnesota Dept. of Education *English–Hmong Dictionary of Special
 *   Education*, which glosses `feem pua` as "percent". Literally "part of a hundred" — `feem` (part) ×93 and
 *   `pua` (hundred) are both ordinary corpus words, so this is also composed from attested pieces.
 *
 * ⚠ `duas` (DOLLAR) IS DEFINED BY THE CORPUS ITSELF, NAMING THE SIGN AND THE WORD IN ONE SENTENCE. This is
 *   stronger evidence than any count and stronger than anything `attest.ts` could have returned:
 *
 *       Lub cim rau DUAS yog ib daim ntawv loj S, pierced los ntawm ib los yog ob txoj kab ntsug: $.
 *       "the symbol for the DOLLAR is a large letter S, pierced by one or two vertical lines: $"
 *
 *   And `Ib duas yog ib hom txiaj` ("a dollar is a kind of currency") fixes the order: the numeral precedes
 *   the noun, so `$10 lab` is `10 lab duas`. ×4 tokens, all in the currency sense.
 *
 * ⚠ `mus rau` (THE RANGE CONNECTIVE) IS THE CORPUS'S OWN, WRITTEN BETWEEN TWO NUMERALS. Not a dictionary
 *   word pressed into a slot: `6 mus rau -50 ° C`, `Lub Xya hli ntuj 1 mus rau 25 ° C`, `5% mus rau 6%` —
 *   three instances of exactly the construction step 8 emits, plus `150 rau 2000 hli` with the bare
 *   preposition. ×29 in the artifact overall.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ─────────────────────────────────
 *
 * ⚠ NO KILOMETRE WORD, AND THE NEAR-MISS IS THE INSTRUCTIVE PART. `km` ×10, written as the symbol every
 *   time, and it reaches the IPA RAW (see the hazard section). Searching the slot rather than the word —
 *   trap 40 — turned up ONE candidate, `kis lus mev`, in `…rau Papua - Tshiab Guinea - tsuas yog 5 kis lus
 *   mev` (Boigu Island to PNG, which really is ~5 km, so the reading fits). It is still declined:
 *     · one hit, one article, in a machine-translated wiki — a lead, never a finding;
 *     · its two-word tail is attested TWICE IN THIS CORPUS IN AN UNRELATED SENSE — `lus Mev` is SPANISH
 *       (`Mev (español) yog ib hom lus Romance`, `cov lus Mev Netherlands`), and `Mev` ×4 is Spain/Spanish
 *       throughout. So `kis lus mev` decomposes into a phrase the corpus uses for something else, which is
 *       exactly the shape trap 37 says to distrust;
 *     · no dictionary, no phrasebook and no web search corroborates it; espeak ships no Hmong.
 *   What the corpus DOES attest is `mais` ×3 = MILE (`242,500 square mais`, `peb caug mais ib teev` — thirty
 *   miles an hour), and a mile cannot stand in for a kilometre. So `km` stays raw, and that is recorded as a
 *   known defect rather than papered over. ⚠ Note that NO LEAK CLASS CAN SEE IT: a Latin-letter residue in a
 *   Latin-script language looks exactly like a word (trap 6), which is why it needed a hand probe.
 *
 * ⚠ NO DEGREE OR SCALE WORD — so step 7 CONSUMES `° C` without reading it. `sources.ts` reports
 *   `scale-names [NONE] ° occurs, neither scale name in corpus/referee/espeak`, and nothing follows `°` in
 *   this corpus but a bare letter. ⚠ THIS IS A DOWNGRADE FROM A WRONG READING TO A SILENCE, NOT A FIX: what
 *   it replaces is the scale letter `C` reaching the IPA raw, ×5. Recorded in `ACCEPTED_SIGN_SILENCE`, class
 *   `degrees`, with this measurement — the `za` precedent exactly.
 *
 * ⚠ NO MINUS AND NO PLUS, AND THIS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE — the Lingala/Zhuang precedent.
 *   Omitting a plus is lossless; omitting a minus INVERTS. All three signed numbers in the corpus are
 *   temperatures (`6 mus rau -50 ° C`, `-71,2 ° C`, `+45,4 ° C`) and no Hmong word for a negative quantity is
 *   attested anywhere. ⚠ SO hmn IS NOT IN `ACCEPTED_SIGN_SILENCE` FOR `minus`, and `review.ts --lang hmn`
 *   stays RED on it. An accepted silence claims the drop is correct; this one is not (trap 24).
 *
 * ⚠ NO EXPONENT WORD, for the same reason as the unit — a squared word needs a head noun and there is no
 *   sourced unit noun to head. `km²`/`km2` ×2. Step 3 does the one repair that needs no vocabulary; the `²`
 *   itself stays dropped and hmn is NOT recorded as an accepted silence for `exponent`.
 *
 * ⚠ NO EQUALS, TIMES, DIVIDE OR RELATIONAL SIGNS. The only `+` and `=` in the corpus are METALINGUISTIC —
 *   one sentence NAMING the symbols (`qhov kos npe ntxiv (+)`, `qhov sib npaug sib npaug (=)`), which is the
 *   `za` stub-article shape. And the candidate word fails its sense check: `npaug` ×2 is both times
 *   *sib npaug* = "balance/equilibrium" (of the vestibular system), not arithmetic equality.
 *
 * ⚠ NO FRACTION AND NO CLOCK RULE. Zero instances of either in the corpus, and `sources.ts` finds no
 *   denominator series. The colon stays a pause.
 *
 * ⚠ NO INITIALISM RULE, and this is a SOURCING block rather than a coding one (trap 16 checked: the seam
 *   exists, ~30 languages wire it, the DATA does not exist). `core/initialisms.ts` is a NO-OP without a
 *   `letterName` table and `sources.ts` reports `letter-names [NONE] espeak does not ship this language at
 *   all`. So `GDP` → `GDP`, `OECD` → `OECD`, `U.S.` → `ʔu˧ . S .` stand — ×54, the largest untreated class
 *   in the language.
 *
 * ⚠ THE SPACED HYPHEN IS NOT MADE A PAUSE, and the counter-example is why. `\s-\s` ×53, and most are the
 *   apposition dash of a translated definition (`Aus-rab-lias - ib lub teb chaws…`, `Peev - Vienna`,
 *   `Txiaj - Euro`) where a pause would be right. But not all: **`Papua - Tshiab Guinea`** is ONE NAME with a
 *   spaced hyphen inside it, and `rau Papua - Tshiab Guinea - tsuas yog 5 kis lus mev` uses both senses in
 *   one clause. Trap 9 — a guard alternative with a live counter-example is a misfire generator — so the
 *   dash stays silent, as it already was, and the count is recorded rather than acted on.
 *
 * ⚠ ROMAN NUMERALS ARE ALREADY HANDLED UPSTREAM. hmn is not in `ROMAN_NATIVE`, so `registry.ts` converts
 *   them to digits before `text()` runs — verified end-to-end: `II` reads *ʔɒ˥* (`ob`, two), not as letters.
 *   No roman rule here.
 *
 * ⚠ NO ERA MARKER. `BC` ×2 and both are machine-translation debris carrying the Russian abbreviation with
 *   it — `Kuv century BC. e.` and `(nrhiav tau 15 BC. E.)`. `sources.ts` reports no era phrase. A corrupt
 *   instance is not evidence for a rule.
 */

/**
 * ⚠ THE SEPARATOR IS DECIDED BY THE TAIL'S LENGTH, NOT BY WHICH MARK IT IS — and this is the one place the
 * evidence changed the SHAPE of a rule rather than its counts. This corpus uses BOTH conventions, because
 * Wp/mww is translated from several wikis:
 *
 *     comma + exactly 3 digits (GROUPING)  ×11   23,822,747 · 46,330 · 10,000,000 · 260,000 · 242,500
 *     comma + 1–2 digits       (DECIMAL)    ×8   8,46 lab · 63,8 lab · 81,9 lab · 90,5 lab · 9,85 lab km2
 *                                                +45,4 ° C · -71,2 ° C · 116,6 ° C
 *     dot   + exactly 3 digits (GROUPING)   ×3   146.270.033 neeg · 17.125.187 km² · 357.021 km2
 *     dot   + 1–2 digits       (DECIMAL)    ×6   2.9 lab · 2.7 vam · 66.0 lab · 10.3 lab · 2.5 roob · 2.2
 *
 * The split is not noise. The European convention (dot-grouping, comma-decimal) is confined to the articles
 * translated from Russian and German — Russia's population 146,270,033 and area 17,125,187 km², Germany's
 * 357,021 km², Austria's 8.46 million, France's 63.8/81.9 million — and the Anglo convention to those
 * translated from English. All three dot-groupings check out against the outside world, which is what makes
 * the tail length a sound discriminator and the MARK a useless one. Assigning one mark to one job, as every
 * other layer in this tree does, would be wrong for a third of this corpus in whichever direction it was
 * written.
 *
 * COST, STATED: a genuine three-decimal-place number would be de-grouped. There are ZERO in this corpus, and
 * `802.11n`-shaped designations are excluded by the trailing letter guard on the DECIMAL rule (step 10), not
 * by these.
 */
const GROUP_COMMA = /(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d]|,\d)/gu;
const GROUP_DOT = /(?<![\d.,])(\d{1,3})((?:\.\d{3})+)(?![\d]|\.\d)/gu;

/**
 * ⚠ GLUED PAIRS ONLY — STRICTLY NARROWER THAN THE FLEET'S RANGE RULE, and the narrowing is measured. The
 * usual shape allows an optional space either side (`\d+\s?[-–—]\s?\d+`). Here that would be a disaster:
 * `\s-\s` occurs ×53 and NOT ONE of them is a numeric range — they are apposition dashes and, in
 * `Papua - Tshiab Guinea`, a hyphen inside a proper name. Counted over the corpus:
 *
 *     digit ␣-␣ digit   0        digit-digit   6        letter-hyphen-letter   124
 *
 * The 124 is the other reason: RPA transcribes foreign names with hyphens between SYLLABLES
 * (`Aus-rab-lias` = Australia, `Ee-dos-neb-xias` = Indonesia, `As-Meb-Zis-Khas`), so any range rule that can
 * see a hyphen between two letters is a rule that mangles the language's proper nouns. This one cannot: both
 * operands must be digit runs and neither side may touch a letter.
 *
 * All six glued pairs are ASCENDING and all six are genuine ranges — five birth/reign year spans
 * (`1438-1806`, `1358-1365`, `1740-1748`, `1867-1918`, `1859–1917`) and the percentage span `5-10%`. A
 * descending pair reads with a different connective, so it is left as the bare juxtaposition it already was.
 */
const RANGE = /(?<![\d.,:\p{L}\p{M}-])(\d+)[-–—](\d+)(?![\d.,\p{L}\p{M}-])/gu;

/**
 * Hmong (White Hmong, RPA) text normalization. A numbered sequence of ORDER-DEPENDENT steps; each comment
 * states the coupling, because a future reader cannot recover it from the code.
 */
export function normalizeHmong(input: string): string {
    // 1) NFC, HTML entities and zero-width marks, before anything else looks at a character. RPA is
    //    unaccented ASCII so NFC is identity for Hmong's own letters, but the corpus's embedded foreign
    //    names arrive in both compositions. Zero-width ×4, every one paragraph-initial. The entity strip
    //    must precede step 9 or `&nbsp;` reads as "and" plus the letters n-b-s-p.
    let s = input.normalize("NFC")
        .replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ")
        .replace(/[​‌‍⁠﻿]/gu, "");

    // 2) DASH FOLD, so step 8 can see the corpus's en dash. `–` (U+2013) ×3 and one of them is a real year
    //    span (`1859–1917`); leaving it unfolded would make the range rule miss a sixth of its instances.
    //    Folding is safe because a bare `-` is already silent in this engine. ⚠ NOT a blanket `NFKC`
    //    (trap 36): that would turn `²` into `2` and re-create precisely the defect step 3 exists to fix.
    //    The curly quotes (×4 each) are quotation marks around a metalinguistic label (`'Ch.'`) and are
    //    dropped, as ASCII `"` already is. ⚠ RPA HAS NO SYLLABLE-BOUNDARY APOSTROPHE — unlike Zhuang, where
    //    `’` had to be FOLDED rather than dropped or the syllables fused — so dropping is correct here.
    s = s.replace(/[—－−]/gu, "-").replace(/[‘’“”]/gu, " ");

    // 3) THE ASCII EXPONENT, folded onto the real one, BEFORE de-grouping can split the operand. This is the
    //    one exponent repair available without a unit word, and it is a real defect and not tidying:
    //    `357.021 km2` read as *…km OB* — the `2` claimed by the number path as the cardinal TWO, which is
    //    the `za` `810km2` finding reproduced. After this fold both spellings read identically (the `²` is
    //    dropped either way, see the header). ⚠ BOTH LOOKAROUNDS, per the tone-letter rule: without the
    //    trailing one this would bite the `km` out of a longer RPA word.
    s = s.replace(/(?<![\p{L}\p{M}])km2(?![\p{L}\p{M}\d])/gu, "km²");

    // 4) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number, which is the layer's single largest defect:
    //    `146.270.033` was three numbers separated by two FULL STOPS and `23,822,747` three separated by two
    //    comma pauses. See GROUP_COMMA/GROUP_DOT above for why BOTH marks get a grouping arm and why the
    //    discriminator is the tail's length.
    s = s.replace(GROUP_COMMA, (w) => w.replace(/,/gu, "")).replace(GROUP_DOT, (w) => w.replace(/\./gu, ""));

    // 5) PERCENT → `feem pua`, POSTPOSED. ×7, and the layer's best-sourced rule (see the header: attested as
    //    the collocation, in the slot, three times, plus an outside dictionary).
    //    ⚠ AFTER STEP 4, so a grouped percentage is one number, and BEFORE STEP 10, or the rule matches `5%`
    //    out of `83.5%` and splits the quantity in half.
    //    ⚠ AND BEFORE STEP 8, WHICH IS WHAT MAKES `5-10%` COME OUT RIGHT. The corpus writes the span with
    //    the sign on the RIGHT END ONLY, so claiming the percent first leaves `5-10 feem pua`, which step 8
    //    still matches as an ascending pair and reads *tsib mus rau kaum feem pua* — five to ten percent.
    //    Claiming the range first would strand the sign after a connective.
    s = s.replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s?%/gu, "$1 feem pua");

    // 6) CURRENCY → `duas`, POSTPOSED, with the magnitude word kept BETWEEN the number and the noun. `$10
    //    lab` is "ten million dollars", so the reading has to be `10 lab duas` and not `10 duas lab`; the
    //    magnitude is re-emitted rather than consumed (trap 10). The three magnitudes admitted are the ones
    //    this corpus writes after a digit — `lab` ×11, `vam` ×2, `roob` ×1 — and no others, because a wider
    //    alternation would start claiming ordinary nouns after a price.
    //    ⚠ `US` IS CONSUMED, AND THAT IS A STATED LIMIT RATHER THAN A FREE CHOICE. `US$30`, `US$40` and
    //    `US $ 46,330` are all in the corpus, and the alternatives are both worse: leaving `US` in place
    //    reads it as the Hmong syllable *us* (`ʔu˩` — the engine's current output), and composing an
    //    "American dollar" phrase would invent a collocation no source attests. `duas` alone is less
    //    specific than the source text and is not WRONG, which is the trade this tree prefers.
    //    ⚠ THE LEADING GUARD IS WHAT FORCES THE `US` ARM: starting a match at the bare `$` of `US$30` fails
    //    the lookbehind on the letter `S`, so the optional arm cannot be skipped where it is present.
    //    ⚠ AFTER STEP 4 (`46,330` must already be one token) and BEFORE STEP 10 (the operand keeps its
    //    decimal tail).
    s = s.replace(
        /(?<![\p{L}\p{M}\d])(?:US\s?)?\$\s?(\d+(?:[.,]\d+)?)(\s(?:lab|vam|roob)(?![\p{L}\p{M}]))?/gu,
        (_m, n: string, mag: string | undefined) => `${n}${mag ?? ""} duas`,
    );

    // 7) DEGREES — the sign AND the scale letter are CONSUMED AND UNREAD, because no Hmong degree or scale
    //    word is attested (see the header; `sources.ts` says `scale-names [NONE]`). ×5, all temperatures.
    //    ⚠ A DOWNGRADE FROM A WRONG READING TO A SILENCE, NOT A FIX: what it replaces is the letter `C`
    //    reaching the IPA raw — and `c` is a real Hmong onset, so a bare `C` is not even visibly foreign.
    //    `ACCEPTED_SIGN_SILENCE.hmn.degrees` records the refusal so the gate stays honest.
    //    ⚠ ONLY `C`/`F`. The corpus's sixth `°` is the coordinate `50 ° N. M.)`, and a compass direction is
    //    CONTENTFUL where a scale name beside `° C` is redundant with nothing — dropping it would be a real
    //    loss, so that instance is deliberately left alone (its `N` still reaches the IPA raw, ×1).
    //    ⚠ BEFORE STEP 10, so the operand still carries its decimal tail (`+45,4 ° C`, `116,6 ° C`).
    s = s.replace(/(?<![\d.,])(\d+(?:[.,]\d+)?)\s?°\s?[CF](?![\p{L}\p{M}])/gu, "$1");

    // 8) RANGES → `mus rau`, the connective the corpus itself writes between two numerals (header). AFTER
    //    step 5 so a percent span is already carrying its word, and AFTER step 4 so a grouped endpoint is one
    //    token. See RANGE above for why this is glued-only and for the 53 spaced dashes and 124 hyphenated
    //    proper nouns that forced it. ASCENDING only.
    s = s.replace(RANGE, (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} mus rau ${b}` : whole));

    // 9) THE AMPERSAND → `thiab`. ⚠ ×0 IN THE CORPUS — this is ROBUSTNESS FOR PLAUSIBLE INPUT, not a
    //    measured repair, and the comment says so rather than letting the rule look earned (trap 22's
    //    discipline). It needs no sourcing argument: `thiab` is Hmong's ordinary conjunction, ×355 here, and
    //    the ampersand has one reading everywhere it occurs.
    //    ⚠ SPACED ON BOTH SIDES DELIBERATELY. `A&B` deletes to `AB`, which is ONE token instead of two —
    //    traps 18/26 — so the replacement must insert the boundary the sign was supplying.
    s = s.replace(/\s?&\s?/gu, " thiab ");

    // 10) DECIMALS, LAST, after every rule that needs the number intact. BOTH marks, and a tail of one or two
    //     digits only — the other half of the tail-length discriminator documented above. The separator
    //     becomes NOTHING and the fractional digits are spaced apart so the number path speaks them one at a
    //     time: there is no Hmong decimal-point word (`sources.ts`: `decimal-point [NONE] no _dpt, no _., no
    //     manifest word`), and a dropped point beats an invented one. What this fixes is the spurious
    //     SENTENCE BREAK and comma PAUSE inside a quantity — `2.9 lab` was *ʔɒ˥ . cuə̯˥˧ la˥*, a full stop in
    //     the middle of "2.9 million".
    //     ⚠ THE TRAILING LETTER GUARD IS THE VERSION-DOT GUARD, EARNED FOR FREE. `802.11n` has a letter after
    //     its two-digit tail and is refused here, so no `NOT_VERSION` lookahead is needed anywhere in this
    //     file — which matters, because trap 39 says a guard that needs a character cannot live downstream of
    //     the rule that spends it, and this file spends the dot at exactly this step.
    //     ⚠ THE LEADING GUARD keeps the rule from restarting inside a number it has already rewritten.
    s = s.replace(/(?<![\d.,])(\d+)[.,](\d{1,2})(?![\d\p{L}\p{M}])/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].join(" ")}`);

    return s;
}
