/**
 * Luo / Dholuo (luo) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. ⚠ THERE IS NO MINED ARTIFACT for this language and `mine.ts scan` cannot run; every count here
 * was taken by hand over column 3 of `$FLEURS/luo_ke/{train,dev,test}.tsv`, deduplicated — **2,742 rows →
 * 1,660 unique cased utterances**. Corpus-wide counts for the classes named below: grouped thousands ×35 ·
 * decimals ×21 · numeric ranges ×17 · spaced clause dashes ×19 · colon figures ×14 (11 clocks) ·
 * dot clocks ×3 · dotted designations (`802.11a/b/g/n`) ×5 · currency signs ×8 (`$`×4, `¥`×3, `£`×1) ·
 * degrees ×2 · percent ×2 · plus ×2 · era markers ×3 · ampersand ×1.
 *
 * ⚠ AND THE SIGNS THAT ARE **×0**, each read individually: `= < > × ÷ ± ² ³` — every one of them, and
 * **there is no negative number in the corpus at all**. All 17 digit-flanked hyphens are spans, scores or a
 * season; the two `°` are the only degrees; the two `+` are a redundant temperature sign and one UTC offset.
 *
 * ⚠ THE CONTACT-LANGUAGE QUESTION, MEASURED — AND SWAHILI IS THE WRONG ANSWER 13 TIMES OUT OF 14. Dholuo
 * is in daily contact with English and Swahili, and `sw` is already treated here, so its layer was taken as
 * a HYPOTHESIS (trap 55). Counting every measure/quantity noun, whole-word, over the 1,660 utterances:
 *
 *     ATTESTED IN luo_ke                      SWAHILI'S OWN FORM, IN luo_ke
 *       mail ×16 / mails ×7                     maili    ×0
 *       paund ×5   ·  ounce ×1  ·  galons ×1    pauni ×0 · aunsi ×0 · galoni ×0
 *       squeya ×1  ·  senchari ×22              mraba ×0 · karne ×0
 *       milion ×2  ·  bilion ×3                 milioni ×0 · bilioni ×0
 *       tara ×23 (million)  ·  gana ×17 (1000)  elfu ×0
 *       nyaka (range joiner)                    hadi ×0
 *       — nothing for the percent —             asilimia ×0
 *
 * Porting the sibling would have shipped `hadi`, `asilimia`, `mraba`, `nyuzi joto`, `Selsiasi`, `plas` and
 * `hasi` — seven confidently wrong readings. ⚠ AND THE SHAPE OF THE DIVERGENCE IS THE USABLE PART: where
 * the two agree the word is a settled Swahili-mediated loan (`saa` ×58, `dakika` ×13, `kilomita` ×23,
 * `mita` ×13); **where they differ, Dholuo takes the ENGLISH word directly.** The clincher is
 * `Amazon nikod bor maromo kilomita 6,387 (mails 3,980)` — an ENGLISH plural `-s`, which no Swahili noun
 * class does. `nukta` is the ONE Swahili word in the list that is also in this corpus, and it is the one
 * this layer emits.
 *
 * ⚠ THE MEASURE NOUN PRECEDES ITS NUMERAL, WITHOUT EXCEPTION — `kilomita 1,600 (mail 1,000)`, `mita 40`,
 * `paund 17`, `saa 9:30`, `dakika 1:09.02`, `galons tara 23`, and in words too: `higni tara ariyo` is
 * "years million two", i.e. two million years. That is trap 47 reason 2, and it is half of why this layer
 * declares **no shared symbol tier at all**; the other half is the currency, below.
 *
 * ⚠ THE SHARED TIER SAYS `dola` TWICE, IN EVERY CONFIGURATION, AND THAT IS WHY THE CURRENCY IS LOCAL.
 * Dholuo writes currency-noun · magnitude · sign · figure — `mwandu ma dirom dola bilion $2.3` — so the
 * noun is already there, two tokens to the LEFT with a magnitude word in between, and the tier's
 * "already said it" suppression is adjacency-based and cannot see across `bilion`. Measured, all three
 * configurations:
 *
 *     currencyPrefix:true          → "mwandu ma dirom dola bilion DOLA 2.3."
 *     currencyPrefix + magnitudes  → "(dola bilion DOLA 14.7 mag Amerka)"
 *     default (postposed)          → "maromo dola 1000 DOLA kuom keth ka keth."
 *
 * Read one at a time, **every `$` in this corpus is a trap-12 permissible drop**: three have `dola` in the
 * clause and the fourth is `AUD$45 milion`, whose ISO code is itself spoken. Exactly one currency sign
 * needs reading — `nengo molandi mar tara £27` — and the rule that expresses that is a left-context
 * redundancy guard, which the tier has no field for.
 *
 * ⚠ THE DOT DECIMATES **AND CLOCKS**, and the writer's own noun is the discriminator. `saa 12.00 GMT`,
 * `kar saa 11.00 saa ma aluora no (UTC+1)` and `(15.00 UTC)` are times of day written with a dot; `saa 1.5
 * kowuok Vancouver` is a decimal number of HOURS after the same noun. Two fractional digits plus `saa`
 * before or `UTC`/`GMT` after takes the three clocks and leaves the decimal, which has one.
 *
 * ⚠ THE CONFUSABLE HUNT CAME BACK EMPTY, AND THAT IS THE FINDING. Three recent rounds each found a
 * confusable in the degree slot. Both degrees here are `°` U+00B0 and the scale letter is ASCII `C` U+0043
 * (`+30°C` is `0x30 0xb0 0x43 0x2e`) — no `º`, no `˚`, no `℃`, no Cyrillic `С`. **The one confusable-shaped
 * thing in the corpus is a UNIT:** the gigahertz is written `Ghz` (`22.4Ghz`, `5.0Ghz`) with a LOWERCASE
 * h, so a rule keyed on the SI `GHz` would match neither instance.
 *
 * SOURCING — ⚠ AND THE HAYSTACK HERE IS THREE THINGS, NOT SIX. espeak-ng ships **no Luo at all**
 * (`sources.ts`: "espeak does not ship this language"), so there is no letter-name table and
 * `core/initialisms.ts` is structurally a no-op; and **`luo.wikipedia.org` does not exist** —
 * `attest.ts` refuses to probe it. The Incubator project `Wp/luo` was probed by hand and is below any
 * useful floor: a CONTROL on the commonest words in the language returns `piny` 10 articles, `dhano` 4,
 * `higa` 5, `nyaka` 3, while `dola`, `nukta`, `pasent`, `asilimia` and `digri` all return **0**. That is
 * trap 51 with the floor removed: those zeros are UNKNOWN, not negative. The whole haystack is the FLEURS
 * corpus, a 17-word referee and the engine's own number data.
 *
 * So the two words this layer emits are corpus TOKEN attestations whose sense was read:
 *
 *   `nukta` ×1 — the decimal point, and ⚠ THE CORPUS GLOSSES ITS OWN NOTATION (trap 45's shape):
 *       "chiegni kilomita squeya tara ariyo NUKTA ariyo ei nam" — about 2**.**2 million square kilometres.
 *       There is no second reading of *tara ariyo nukta ariyo*. One instance is thin and is all there is.
 *   `nyaka` ×6 between numerals, in BOTH directions: `1977 nyaka 1981`, `jii 10 nyaka 15`,
 *       `mails 100 nyaka 200`, `mita ma dirom 100 nyaka 250 (fut 328 nyaka fut 820)`,
 *       `3 nyaka 5 kuom nyithindo`, and for the scores `okang' achiel mar locho, 21 nyaka 20`.
 *   `paund` ×2 in the monetary sense (`Paund mar Britain`, `paund achiel mar Britain (GBP)`); ⚠ it is
 *       ALSO the WEIGHT ×3 (`ratil maromo paund 17`), which is harmless because the `£` selects the sense.
 *   `dola` ×6 monetary, declared for the same rule though no corpus instance needs it (see the guard).
 *
 * REFUSED, each priced rather than declared safe (trap 53) — all registered in `ACCEPTED_SIGN_SILENCE`:
 *
 *   percent ×2   no word in any source. ⚠ A CANDIDATE EXISTS AND IS DELIBERATELY NOT SHIPPED:
 *                `kuom mia achiel` ("out of one hundred") is composable from attested pieces, the Fula
 *                `e teemedere` move — `kuom` is this corpus's own partitive in a numeric ratio
 *                ("ondik nyinge e thuolo mar 190 kuom ji 400") and `mia achiel` is 100 in numbers.ts. Two
 *                instances do not buy a phrase nobody has been observed writing, and there is no wiki to
 *                check it against. Price: `oriwo 3% mar pinyno` reads *adek*, the sign silent.
 *   `¥` ×3       no yen word in corpus, referee or engine data; no wiki. Price: three bare amounts.
 *   degrees ×2   ⚠ THE ONE `digri` IN THE CORPUS IS THE ACADEMIC DEGREE — `moyudo 2:2 (digri man piny,
 *                clas mar ariyo)`, a lower-second-class honours degree. That is the `ki digirii ×4` trap
 *                arriving again, and it is what refuses the temperature word. No Celsius or Fahrenheit
 *                name anywhere. Price: `+30°C` keeps reading its scale letter through the Dholuo ⟨c⟩ →
 *                t͡ʃ rule (trap 56) — pre-existing, and NOT made worse here.
 *   `+` ×2       trap 48 exactly: `moloyo +30°C` puts the sign after the comparative "more than", so it is
 *                REDUNDANT and dropping it is lossless; `(UTC+1)` is the contentful one and nothing
 *                attests how Dholuo says it.
 *   minus ×0     the corpus contains no negative number. Not a guard question — there is nothing to read.
 *   `&` ×1       `kod` is "and", but `B kod Bs` is not how anyone reads `B&Bs`.
 *   era ×3       `Kristo` ×5 is `Jo-Kristo` / `kwom Kristo` every time, never an era phrase. Price: `BCE`
 *                keeps reading as the pronounceable non-word *bt͡ʃe* (trap 56, pre-existing).
 *   units ×8     no Luo word for `mm` or `Ghz`. ⚠ AND THE REFUSAL IS WHOLE, NEVER HALF (trap 53): nothing
 *                touches `3136 mm2`, so its `2` reads exactly as it did rather than becoming a quantity.
 */

/** ⚠ NEVER `\b` (trap 1/23) — and in Dholuo the word-continuation class must include the ⟨ng'⟩ APOSTROPHE
 *  in all three encodings the corpus and this engine accept (ASCII `'`, U+2019, U+02BC). It is a LETTER
 *  here, exactly as the Hawaiian ʻokina is, and a guard that treats it as a boundary would let a rule bite
 *  into `ng'wech`, `chieng'`, `maduong'`. */
const WORD_CHAR = "\\p{L}\\p{M}'\\u2019\\u02bc";
const NOT_BEFORE = `(?<![${WORD_CHAR}])`;

/** The magnitude words this corpus writes BETWEEN a currency noun and its figure — `dola bilion $2.3`,
 *  `mar tara £27`. `tara` ×23 and `gana` ×17 are the NATIVE million/thousand and outnumber the borrowed
 *  `milion` ×2 / `bilion` ×3 here; all four are listed because all four occur. (`elfu`, which numbers.ts
 *  composes with, is ×0 in this corpus — see the investigation's backlog.) */
const MAGNITUDE = "(?:tara|gana|milion|bilion|elfu)";

/** A currency noun or ISO code ALREADY in the clause makes the sign redundant — trap 12. The window is the
 *  30 characters before the match, which covers every attested instance (`mwandu ma dirom dola bilion $`,
 *  `maromo dola $`) and cannot reach across a sentence. */
const ALREADY_NAMED = new RegExp(`(?<![${WORD_CHAR}])(dola|paund|yuro|aud|usd|gbp|eur|kes)(?![${WORD_CHAR}])`, "iu");

/** Currency sign → the corpus's own noun. ⚠ `AUD$` is deliberately NOT given a composite key (trap 64 in
 *  mirror image): the tier's letter-lookbehind would decline `AUD$45` and here that is RIGHT, because the
 *  ISO code is present and spoken, which is trap 12's own ISO clause. `¥` is absent from this table on
 *  purpose — see the header. */
const CURRENCY: Readonly<Record<string, string>> = { "$": "dola", "£": "paund" };

/** Normalize one Dholuo input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeLuo(input: string): string {
    let s = input;

    // 1) DE-GROUPING THE COMMA, FIRST — otherwise the grouping comma is read as clause punctuation and the
    //    tail as a separate number: `¥2,500` came out *ariyo , mia abich* ("two , five hundred") and
    //    `¥130,000` as *mia achiel gi piero adek , NONO* — a hundred and thirty, then ZERO. ×35, and every
    //    one of them is three digits: `9,000` ×3, `1,000` ×3, `100,000` ×2, `6,387`, `5,000,000`,
    //    `800,000`, `4,892`, `2,207`, `17,500`, `55,000`. Nothing in this corpus uses the comma as a
    //    decimal separator.
    //    ⚠ THE WHOLE NUMBER AT ONCE (trap 63) — the deepest here is `5,000,000`, two joins, so the
    //    four-group failure cannot arise; the idiom is used anyway because the shape is what is rare, not
    //    the bug. ⚠ AND THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (trap 58): the corpus writes
    //    `manyalo ting'o pipni 55,000. (galons tara 23)`, clause-final, and a `(?![\d.,])` guard would
    //    decline it and lose the whole grouping.
    //    ⚠ AND IT MUST NOT CLAIM THE DATE COMMA. `tok tarik mar Septemba 11,2001` and `manonyuol e
    //    Septemba 17,2007` write the American date with no space; both are declined by `\d{3}`, which is
    //    the same test that identifies the grouping, so no extra guard is needed — recorded because the
    //    shape is invisible until you look for it.
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));

    // 2) THE DOTTED DESIGNATION, BEFORE THE DECIMAL RULE — trap 39, a guard's evidence has a lifetime: the
    //    decimal step below spends the dot, so anything that needs to SEE the dot has to run above it.
    //    `802.11a`, `802.11b`, `802.11g` (one sentence) and `802.11n` (two) read as
    //    *mia aboro gariyo . apar gachiel a* — a full stop inside a Wi-Fi standard's name. ×5.
    //    ⚠ THE DISCRIMINATOR IS THAT THE TRAILING RUN IS ONE LETTER. `22.4Ghz` and `5.0Ghz` are a genuine
    //    decimal glued to a unit and their letter run is three, so the lookahead declines them and step 4
    //    reads them as decimals. The dot is spent SILENTLY here — no word and no pause — because a
    //    designation is not a quantity and *802 nukta 1 1 a* would be a reading, not a repair.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?=\p{L}(?![\p{L}\p{M}]))/gu, "$1 $2");

    // 3) CURRENCY. ⚠ CLAIMED ONLY WHERE THE WRITER HAS NOT ALREADY SAID THE WORD — see the header for the
    //    three tier configurations that all say *dola* twice. Every `$` in this corpus is a permissible
    //    drop (trap 12) and the rule reaches that verdict by MEASUREMENT rather than by omission, so an
    //    unglossed `$5` in some future text still reads.
    //    ⚠ AND THE NOUN HOPS THE MAGNITUDE, because that is the order the corpus itself writes:
    //    `dola bilion $2.3` is *dollars · billion · 2.3*, so `mar tara £27` must become
    //    `mar paund tara 27` and not `mar tara paund 27`. `tara` is the million here, ×23.
    //    Runs above step 4 because it needs the figure still adjacent to the sign.
    s = s.replace(new RegExp(`${NOT_BEFORE}(${MAGNITUDE}\\s+)?([$£])\\s?(?=\\d)`, "giu"),
        (whole: string, mag: string | undefined, sign: string, offset: number, full: string) => {
            const before = full.slice(Math.max(0, offset - 30), offset);
            if (ALREADY_NAMED.test(before)) return mag ?? "";
            return `${CURRENCY[sign]!} ${mag ?? ""}`;
        });

    // 4) THE CLOCK RANGE, BEFORE THE GENERIC RANGE AND BEFORE THE CLOCK — `E kind seche mag 10:00-11:00
    //    otieno MDT`. Ordered here for two reasons at once: the generic range rule below correctly refuses
    //    it (its operands are colon-flanked), and if the clock step ran first the colons would be gone and
    //    the range rule would then read `00-11` as a span. One instance, written as its own arm rather
    //    than by loosening a guard (trap 9).
    s = s.replace(/(?<![\d:.,])(\d{1,2}:\d{2})\s?-\s?(\d{1,2}:\d{2})(?![\d:.,])/gu, "$1 nyaka $2");

    // 5) RANGES → `nyaka`, ABOVE THE DECIMAL STEP. ×17 hyphen-flanked figures, and the engine was fusing
    //    both endpoints with no boundary at all: `(1644-1912)` read *…gang'wen elfu achiel gi mia ochiko…*,
    //    two years running together. `nyaka` is the corpus's own joiner between numerals, ×6, and — unlike
    //    every fleet layer that has to choose between a pause and a connective — it is attested in BOTH
    //    directions here, so the scores get it too: `okang' achiel mar locho, 21 nyaka 20`.
    //    ⚠ THE OPERANDS ADMIT A DECIMAL, which is why this runs ABOVE step 6 rather than below it. The
    //    corpus writes `higni tara 4.2-3.9 mokalo`; run after the decimal rule, the range would match the
    //    `2-3` INSIDE it and produce *4 nukta 2 nyaka 3 nukta 9* — a defect this layer would have
    //    INTRODUCED (trap 56).
    //    ⚠ AND THE GUARD IS A DIGIT-COUNT TEST, NOT AN ASCENDING ONE. The fleet's usual ascending test
    //    would refuse `21 nyaka 20`'s written twin `26-00`, `7-2` and `5-3` — all attested score shapes —
    //    and would also refuse the genuine descending span `4.2-3.9` (4.2 to 3.9 million years ago). What
    //    actually needs refusing is the TRUNCATED second endpoint: `higa mar 1995-96` is a season, and it
    //    is the only shape in the corpus whose right operand has fewer digits than its left.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58); a following slash would mean a
    //    citation rather than a span.
    //    ⚠ AND A LETTER GLUED TO THE SECOND OPERAND MEANS A DESIGNATION, NOT A SPAN — this is the one
    //    defect the first draft INTRODUCED (trap 56), found by reading the corpus diff and not by any
    //    counter. `Russia ne ochngo ndege mar II-76s bang' masirano` is the Ilyushin Il-76, mistyped with
    //    two capital I's; `registry.ts` resolves Roman numerals to digits BEFORE `text()` runs for every
    //    language outside `ROMAN_NATIVE`, so by the time this rule sees it the string is `2-76s` and it
    //    read as *ariyo NYAKA piero abiriyo gauchiel s*. All 17 genuine ranges in this corpus are followed
    //    by a space, a comma, a bracket or a full stop — **not one by a letter** — so the guard is free.
    s = s.replace(/(?<![\d.,:\-\/])(\d+(?:\.\d+)?)\s?-\s?(\d+(?:\.\d+)?)(?![\d\/\p{L}\p{M}])(?!\s?-\s?\d)/gu,
        (whole: string, a: string, b: string) =>
            b.replace(/\D/gu, "").length < a.replace(/\D/gu, "").length ? whole : `${a} nyaka ${b}`);

    // 6) THE DOT CLOCK, BEFORE THE DECIMAL RULE — see the header. Three instances, and the writer's own
    //    noun is the whole discriminator: `e saa 12.00 GMT kawuono`, `kar saa 11.00 saa ma aluora no
    //    (UTC+1)`, `(15.00 UTC)`. ⚠ `saa 1.5 kowuok Vancouver` is a decimal number of hours after the SAME
    //    noun and is refused by the two-digit fraction. The dot is spent, not spoken, exactly as the colon
    //    is at step 7 — `saa 11.00` becomes `saa 11 00`.
    s = s.replace(/(?<=(?:saa|Saa)\s)(?<![\d.,:])(\d{1,2})\.(\d{2})(?![\d.,:])/gu, "$1 $2");
    s = s.replace(/(?<![\d.,:])(\d{1,2})\.(\d{2})(?![\d.,:])(?=\s?(?:UTC|GMT))/gu, "$1 $2");

    // 7) THE CLOCK. The colon is `clausePunctuation` in luo.jsonc, so `e saa 9:30 okinyi` read as
    //    *e saa ochiko , piero adek okinyi* — a phrase break inside a time. ELEVEN of the corpus's
    //    fourteen colon figures are clocks and every one of them is introduced by the writer's own `saa`
    //    ("hour"), so the figures are left as FIGURES and only the colon is spent.
    //    ⚠ NO SIX-HOUR CONVERSION IS ATTEMPTED. Dholuo, like Swahili, has a traditional offset clock; the
    //    corpus writes European digits and nothing in it says whether the reader converted. Spending the
    //    colon leaves that question open, which emitting an hour word would not.
    //    ⚠ THE THREE NON-CLOCKS ARE DECLINED FOR THREE INDEPENDENT REASONS. `moyudo 2:2 (digri man piny,
    //    clas mar ariyo)` — a lower-second-class DEGREE, not a time — fails `[0-5]\d`; and both sports
    //    times, `e saa 4:41.30,2:11.60 minutes` and `gi dakika 1:09.02 mos`, fail the trailing guard on
    //    their `.`, at every starting position the engine retries from (trap 52).
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu, "$1 $2");

    // 8) DECIMALS → `nukta`. ×21, and the dot was reaching `clausePunctuation` and becoming a SENTENCE
    //    BREAK in the middle of a number: `kilomita 12.8 kata mail 8` read *kilomita apar gariyo . aboro*.
    //    The fractional digits are SPACED APART so the number path speaks them one at a time — `$14.7` is
    //    *apar gang'wen nukta abiriyo*, and `mita 3.50` is *adek nukta abich nono*, never "fifty".
    //    ⚠ THE GUARD IS "EXACTLY ONE DOT IN THE RUN", AND THE TRAILING HALF OF IT IS TRAP 58 IN PERSON.
    //    Written `(?![\d.])` — which is what "exactly one dot" reads like — it declines every CLAUSE-FINAL
    //    decimal, and this corpus's largest money figure is one: `mwandu ma dirom dola bilion $2.3.` came
    //    out *dola bilion ariyo . adek .*, the sentence period defeating the rule that exists to stop the
    //    false break. What has to be excluded is a separator CONTINUING the number, so the guard is
    //    `(?!\d)(?!\.\d)` — which still refuses the second dot of an IP address or a three-dot date
    //    (neither occurs here) and costs nothing.
    //    `nukta` is corpus-sourced ×1 and the corpus glosses its own notation with it — see the header.
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?!\d)(?!\.\d)/gu,
        (_m, int: string, frac: string) => `${int} nukta ${[...frac].join(" ")}`);

    // 9) THE SPACED DASH IS A PARENTHETICAL BREAK AND WAS BEING DROPPED ENTIRELY — 19 clause boundaries
    //    with no pause at all ("buge mane nyalo riaso kuom weche manyien - to gi lando weche manyien -",
    //    "onge piny moro amora mopuodhi - kata mana Armenia - mane oyange kaka piny"), plus the one em
    //    dash ("Wach kier e wi baraf nochakore chon — pichni mag jokier mogor e kor rogni").
    //    ⚠ LAST, so step 5 has already claimed the one spaced RANGE, `e kinde loch mar Ruoth Sejon
    //    (1418 - 1450)`. ⚠ AND IT MUST NOT REQUIRE A NON-DIGIT ON BOTH SIDES, which is the fleet's usual
    //    shape: `kuonde 26 - mang'eny moloyo jolos wer duto` is a clause dash after a NUMBER and would
    //    lose its pause.
    //    ⚠ SPACES ARE REQUIRED ON BOTH SIDES, and that is what protects the one en dash that is a NAME
    //    JOINER: `Aora mokuny mar White Sea–Baltic Canal` must stay one phrase, not gain a break.
    //    ⚠ AND ONE SPURIOUS PAUSE IS KNOWINGLY SHIPPED, WITH THE COUNT. `Lweny Mokuongo mar Sino - Japan
    //    (1894-1895)` is a NAME written with a spaced hyphen and now takes a comma: 18 real pauses gained,
    //    1 wrong one created. The obvious guard — decline when both sides are capitalised — was tested and
    //    rejected, because it also declines `Ting'o ne ji ma moko - Kik iwe bagni lal e wang'i`, a genuine
    //    clause dash whose right side is a capital. One for one, so the simple rule stands.
    s = s.replace(/\s+[-–—]+\s+/gu, ", ");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
