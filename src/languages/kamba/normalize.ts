/**
 * Kamba / Kĩkamba (kam) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. FLEURS `kam_ke`, 4,505 rows → **1,992 unique cased utterances** (column 3, deduped — FLEURS
 * repeats each sentence per speaker). There is NO mined artifact and NO kam.wikipedia: `attest.ts --lang kam`
 * answers *"kam.wikipedia.org does not respond as a wiki"*, and `sources.ts --lang kam` reports
 * `letter-names [NONE] — espeak does not ship this language at all`. So the sourcing haystack for this
 * language is the corpus, the repo's own 5-word referee, and nothing else. ⚠ **EVERY WORD THIS FILE EMITS IS
 * A TOKEN OF THIS CORPUS, quoted at its rule.** Where the corpus is silent the sign is left unread and the
 * class is registered in `ACCEPTED_SIGN_SILENCE` — that is trap 51's floor, and here it is the whole
 * sourcing policy rather than one line of it.
 *
 * Corpus-wide counts for the classes claimed here: `.` 2,272 · `,` 1,941 · comma-grouped thousands 47 ·
 * decimal dot 31 · hyphen 105 (of which 14 are digit–digit) · colon 45 (14 between digits) · slash 20 ·
 * `$` 6 · `%` 3 · `+` 2 · `£` 1 · `°` 1 · `&` 1. ⚠ There is NO en-dash and NO em-dash anywhere in the
 * corpus, and `= < > × ÷ ± ‰ ¥ €` are all ×0 — the entire codepoint census is 23 non-alphanumeric characters.
 *
 * ── THE CONTACT-LANGUAGE QUESTION, ANSWERED WITH THE CORPUS ──────────────────────────────────────────
 *
 * Kamba is in daily contact with Swahili and English and `src/languages/swahili/normalize.ts` was read as a
 * HYPOTHESIS (trap 55). Three of its findings carry and three do not, and the ones that do not are the point:
 *
 * ⚠ **THE PERCENT WORD IS THE ENGLISH BORROWING, NOT SWAHILI'S.** `asilimia` — Swahili's word, and the one a
 *   ported layer would emit — is **×0** in this corpus, as is `pasenti`. What the corpus writes is
 *   `percenti`, once, in exactly the slot the sign occupies: *"munini wa kyama kya Florida Republican wakeli
 *   enda mbee wa **46 percenti** ya kula"*. ⚠ AND IT IS POSTPOSED, where Swahili PREFIXES (`asilimia 31`,
 *   `percentPrefix: true` in swahili.ts). So the neighbour is wrong about the word AND about the position.
 *
 * ⚠ **SWAHILI HAS NO ABBREVIATED UNIT SYMBOL IN 1,938 UTTERANCES AND KAMBA HAS FORTY.** That is the single
 *   line of swahili.ts that most invites copying — *"the shared `units` tier has nothing to match and is not
 *   declared"* — and it is false here: `km/h` ×4, `km2` ×2, `mm` ×4, `mi` ×3, `m` ×2, `sq mi` ×3, `cm` ×1,
 *   `mph` ×1, `m/s` ×1. Declining the tier on the sibling's evidence would leave every one of them in the
 *   IPA as raw Latin (`km`, `mm`, `sk mi`) — invisible to RAWMARK, which is 0 on both sides of this change.
 *
 * ⚠ **WHAT DOES CARRY IS THE WORD ORDER, AND IT IS THE BANTU FACT BEHIND BOTH LAYERS.** The measure noun
 *   HEADS its phrase: `kilomita 1,600`, `mita 250`, `milimita 35`, `maili 8`, `ndola 30`, `yeni 2,500`,
 *   `inzi 6.34`, `ndikilii 35`, `sendimita 6`. Hence `unitPrefix` and `currencyPrefix`, exactly as sw
 *   declares them. ⚠ AND THE MAGNITUDE HEADS IT TOO, which is why `magnitudes` is NOT declared: this corpus
 *   writes `milioni 45`, `milioni 1.5`, `mbilioni $2.3`, `milioni £27` — the magnitude BEFORE the number, so
 *   the tier's number-then-magnitude hop has nothing to match and declaring it would buy zero readings.
 *
 * ⚠ AND THE NOUN-CLASS AGREEMENT QUESTION HAS THE SAME ANSWER AS IN SWAHILI, for the same reason: the
 *   engine's `numberToWords` emits the CITATION series (ĩmwe, ĩlĩ, itatũ …) and the manual it is sourced from
 *   states that 1–5 take the prefix of the noun modified. Getting that right needs a noun→class lexicon for
 *   the whole language, which is the "do not bulk-invent language data" prohibition. No agreement rule.
 *
 * ── ⚠ THE ROUND'S LARGEST DEFECT IS A CONFUSABLE VOWEL, AND NO GATE CAN SEE IT ───────────────────────
 *
 * Kamba's tilde marks vowel QUALITY: ⟨ĩ⟩ = /e/ and ⟨ũ⟩ = /o/, against ⟨i⟩ = /i/ and ⟨u⟩ = /u/. This corpus
 * writes the tilde letters with a CIRCUMFLEX or an ACUTE **454 times**:
 *
 *     î U+00EE ×237   û U+00FB ×151   í U+00ED ×35   ú U+00FA ×31   ì U+00EC ×2
 *
 * against ĩ ×5,126 / ũ ×3,883 — a 4.5% substitution rate on the two letters that carry the ATR contrast.
 * 312 word tokens over **263 distinct words in 91 of 1,992 utterances (4.6%)**, and every one of the 263 is
 * an ordinary Kamba word, several of them among the commonest in the language:
 *
 *     nthî(7) îla(6) kîla(4) nûndû(3) maúú(3) kûu(3) îngî(3) nyûmba(2) íúlú(2) andû(2) mûno(2) twî(2) …
 *
 * The reading is silently wrong in every one, because ⟨î⟩ is in no grapheme rule and `latinPhone` returns the
 * plain vowel — a well-formed Kamba word with the wrong vowel, which is trap 56 in its purest form:
 *
 *     nthî  → ⁿð**i**    where nthĩ  → ⁿð**e**        andû  → aⁿd**u**   where andũ  → aⁿd**o**
 *     íúlú  → **iulu**   where ĩũlũ  → **eolo**       maúú  → **mauu**   where maũũ  → **maoː**  (length lost)
 *     wîyoo → **wijɔː**  where wĩoo  → **wɛɔː**       (and a spurious glide appears)
 *
 * ⚠ NOTHING IS DROPPED AND NO RAW CHARACTER SURVIVES, so DIGIT / SLOT-GAP / RAWMARK / ZERO-WIDTH / DROP are
 * all 0 before and after. This is trap 61 exactly — Chuvash ⟨ă ĕ ç ü⟩, Turkmen ⟨ñ⟩ for ⟨ň⟩ — and it is the
 * TURKMEN half of it: both letters are Latin, the token class is Latin, so nothing splits and there is not
 * even a stray letter name in the output to notice. Per that trap a same-script substitution stays LOCAL,
 * behind an "every other letter is one this alphabet uses" guard; see `foldTildeConfusables`.
 *
 * ── THE SEPARATORS, MEASURED ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠ THE COMMA ONLY GROUPS AND THE DOT MOSTLY DECIMATES — but the dot does BOTH, and the three-digit test is
 * what settles it. All 47 `d,ddd` runs are thousands (`1,600`, `783,562`, `5,000,000`); the comma NEVER
 * decimates here. The dot decimates 26 times (`12.8`, `6.34`, `2.2 km2`, `mita 3.50`) — and GROUPS exactly
 * once: *"Nguthu ila nene ya vinya wa aũme **2.400** yakĩlaa usi"*, Washington's 2,400 men crossing the
 * Delaware. Three digits after the dot, so the same test that reads the comma reads it.
 *
 * ⚠ AND THE DOT IS ALSO THE CLOCK SEPARATOR, four times — `saa 12.00 GMT`, `(15.00 UTC)`, `saa 9.30 sya
 * kwakya`, `saa 11.00 kũvĩka` — which needs NO extra rule: the decimal step spends the mark and leaves the
 * figures, which is byte-for-byte what the colon step does to `saa 11:00`. One rule, two notations.
 *
 * ── THE COLON IS A CLOCK BARELY HALF THE TIME ────────────────────────────────────────────────────────
 *
 * 14 colons sit between digits and only EIGHT are clocks (`saa 11:00`, `Saa 1:15 sya kioko`, `Saa 8:46 a.m`,
 * `saa 10:08`, `saa 11:35`, `Twi 11:20`, `09:19 p.m. GMT`, `10:00-11:000`). The other six are:
 *   · SPORTS TIMES ×3 — `ndatika 4:41.30`, `ndatika 2:41.60`, `ndatika 1:09.02` (a third field, downhill ski)
 *   · a RATIO ×1, self-glossed — *"ukwate namba ikwatene ya **ratio**) ila yailwe ithwa yi **3:2**"*
 *   · a DEGREE CLASSIFICATION ×2 — *"akwete **2:2** (ndikilii ya kilasi kya keli kya nthi)"*, a UK 2:2
 * The two-digit minute bound declines all six by construction (`3:2` and `2:2` have one digit after the
 * colon; the sports times have a trailing `.`), so no separate guard is needed — but a rule written to
 * accept `\d:\d` would have claimed six non-clocks against eight clocks.
 *
 * ── THE DASH: NO MINUS, AND THE ONE SHAPE NO GUARD CAN REJECT ────────────────────────────────────────
 *
 * The hyphen is the ONLY dash in the corpus (105; en-dash and em-dash are ×0, so Karakalpak's copula em-dash
 * cannot arise here). Fourteen sit between digits: NINE are ascending spans (`2-3`, `2-5`, `120-160`,
 * `100-200`, `1000-1300`, `1418-1450`, `1469-1539`, `1644-1912`, `1894-1895`), FOUR are scores or a truncated
 * season (`6-6`, `7-2`, `26 - 00`, `1955-96`) and one is a clock range. **Not one is a negative**, and the
 * corpus contains no negative quantity of any kind. ⚠ AND IT DOES CONTAIN THE ONE SHAPE NO GUARD CAN REJECT —
 * word, space, hyphen, digit: *"Russia … II **-76** yithiitwe"*, the Ilyushin. That is the test swahili.ts
 * states and passes and this corpus FAILS, so the minus is refused here where sw claims it: another sibling
 * rule that does not carry. Registered in `ACCEPTED_SIGN_SILENCE`.
 *
 * The remaining 20 are SPACED dashes standing for a parenthetical break, and they were dropped outright —
 * twenty clause boundaries with no pause at all (`"Kukuia angi - Ndukaatate muvuko waku"`).
 *
 * SOURCING — every emitted word with its corpus count and one quoted instance:
 *   `percenti` ×1  "mbee wa 46 percenti ya kula"            `ndola` ×8  "mbesa sya Amelika ndola 30"
 *   `kilomita` ×18 "kilomita 1,600 (1,000 mi)"              `mita` ×12  "mita 250", "ũasa wa mita 378"
 *   `milimita` ×5  "negative ya milimita 56 kwa 56"         `sendimita` ×1 "fomati ya sendimita 6 kwa 6"
 *   `maili` ×16    "kilomita 12.8 kana maili 8"             `isaa` ×9   "maili 105 kwa isaa"
 *   `sekondi` ×3   "kilomita 1.5 kwa sekondi"               `kwa` (per/by) ×29 after a digit
 *   `sikwea` ×4    "sikwea sya kilomita 755,688"            `kubik` ×1  "120-160 kubik mita"
 *   `ndikilii` ×7  "uvyuvu wa ndikilii +30°C"               `na` (and)  everywhere
 *   `kũthi` ×2     "kĩlomita 35 kũthi 40 kĩla ĩsaa"
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/** ⚠ NEVER `\b` — Kamba carries ⟨ĩ ũ⟩ and the ⟨ng'⟩ apostrophe, all of which `\b` treats as boundaries
 *  (trap 1/23). The apostrophe is a LETTER here and must stay inside a word. */
const NOT_BEFORE = "(?<![\\p{L}\\p{M}'’ʼ])";
const NOT_AFTER = "(?![\\p{L}\\p{M}'’ʼ])";

/**
 * ⚠ THE TILDE LETTERS, WRITTEN WITH A CIRCUMFLEX OR AN ACUTE — see the header. ⟨ĩ⟩ is /e/ and ⟨ũ⟩ is /o/;
 * ⟨î û í ú ì⟩ are in no grapheme rule, so `latinPhone` hands back the plain vowel and 312 ordinary Kamba
 * words read with the wrong ATR vowel. 263 distinct words, 91 of 1,992 utterances.
 *
 * ⚠ THE GUARD IS THE ALPHABET, NOT A FLAG (trap 61): a word is folded only if, AFTER folding, every letter
 * in it is one Kamba writes. That is what keeps the fold off `Gürses`, `Müslüm`, `São`, `Asámi`, `Erdoğan`
 * and `Erkoḉ` — this corpus's six foreign-diacritic words, none of which carries a confusable at all.
 *
 * ⚠ AND THE GUARD'S REACH IS FINITE AND SAID SO OUT LOUD, exactly as Turkmen's is. Kamba uses nearly the
 * whole ASCII alphabet, so a foreign name whose only non-ASCII letter is ⟨í⟩ or ⟨ú⟩ (a hypothetical `Perú`)
 * would fold. Measured cost in this corpus: ZERO — all 263 affected words are Kamba, and every capitalised
 * one of them (`Andû`, `Katî`, `Kîsio`, `Nûndû`, `Ûvoo`, `Ũkunîkîli`, …) is a Kamba word too.
 */
const CONFUSABLE = /[îíìûúùÎÍÌÛÚÙ]/u;
const KAMBA_WORD = /^[abcdefghijklmnoprstuvwyzĩũ'’ʼ]+$/iu;
function foldTildeConfusables(s: string): string {
    if (!CONFUSABLE.test(s)) return s;
    return s.replace(/[\p{L}\p{M}'’ʼ]+/gu, (w) => {
        if (!CONFUSABLE.test(w)) return w;
        const folded = w
            .replace(/[îíì]/gu, "ĩ")
            .replace(/[ûúù]/gu, "ũ")
            .replace(/[ÎÍÌ]/gu, "Ĩ")
            .replace(/[ÛÚÙ]/gu, "Ũ");
        return KAMBA_WORD.test(folded) ? folded : w;
    });
}

/**
 * The shared SYMBOL tier.
 *
 * ⚠ `unitPrefix` AND `currencyPrefix` BOTH, because the measure noun heads its phrase in Kamba — see the
 * header. ⚠ `magnitudes` IS DELIBERATELY NOT DECLARED: the magnitude heads the phrase too (`milioni 45`,
 * `mbilioni $2.3`), so the tier's number-then-magnitude hop matches nothing in this corpus and declaring it
 * would be robustness for a shape the language does not write.
 *
 * ⚠ `percent` IS ONE CORPUS TOKEN AND THAT IS STATED RATHER THAN HIDDEN — `percenti` in "mbee wa 46 percenti
 * ya kula", the corpus's own rendering of the slot the sign occupies, with NO competitor anywhere (`asilimia`
 * ×0, `pasenti` ×0, `pesenti` ×0) and no wiki to ask. The Ilocano `libra esterlina` shape: thin, unambiguous,
 * and the alternative is a dropped sign in all three instances.
 *
 * ⚠ THE ONE-LETTER KEY `m` IS DECLARED AND HERE IS WHAT IT COSTS (traps 28/46/52). Digit-adjacent bare `m` is
 * ×2 in this corpus and BOTH are genuine metres — `133 m/s` and `4892m.`. The residual hazard is a dotted
 * designation ending in `m`; this corpus writes `802.11a`, `802.11b`, `802.11g`, `802.11n` and never
 * `802.11m`, and the tier's `NOT_VERSION` guard still has its dot to see because THE TIER RUNS BEFORE THIS
 * FILE'S DECIMAL STEP (trap 39/46 — that ordering is why the key is safe at all).
 *
 * ⚠ AND `4892m.` IS THE CLAUSE-FINAL CASE (trap 58) — the tier reads it, verified: `mita 4892.`
 *
 * ⚠ `US$` AND `AUD$` ARE DECLARED AHEAD OF `$` (trap 64): the corpus writes `US$11,000 nginya US$22,500` and
 * `AUD$ milioni 45`, and the bare key cannot match a mark a letter runs into.
 *
 * ⚠ NO POUND WORD IS DECLARED. `£` ×1 (`ndĩvi ya milioni £27`) and the only candidate in the corpus is
 * `paondĩ` ×1 — which is the WEIGHT: "setilaiti … syaĩna ũĩto wa **paondĩ** 1,000", *a weight of 1,000
 * pounds*. That is Malay's `paun` and Ilocano's `libra` arriving a third time; the sign stays unread.
 *
 * ⚠ `multiply` IS `kwa` FOR BOTH READINGS, and the corpus supplies the dimension sense directly:
 * "fomati ya sendimita **6 kwa 6**", "negative ya milimita **56 kwa 56**", "milimita 35 ila ni 3136 sikwea
 * **kwa 864**". The only `x` between digits here is `4x4` ×2 (the vehicle), which the tier's unspaced-ASCII
 * arm reads as the `by` word — today it reads as the letter, *iɲa **z** iɲa*.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["percenti"],
    currency: { "US$": ["ndola"], "AUD$": ["ndola"], "$": ["ndola"] },
    currencyPrefix: true,
    units: {
        "km": ["kilomita"], "m": ["mita"], "mm": ["milimita"], "cm": ["sendimita"], "mi": ["maili"],
    },
    unitPrefix: true,
    // "maili 105 **kwa isaa** yĩmwe", "kilomita 1.5 **kwa sekondi**" — the corpus's own rate phrases. The
    // competitor `kĩla ĩsaa` ("kĩlomita 70 kĩla ĩsaa") is real and is attested for HOURS only, where `kwa`
    // is attested for both denominators; `kwa isaa` ×8 against `kĩla ĩsaa` ×3.
    unitPer: "kwa",
    rateDenominators: { "h": "isaa", "s": "sekondi" },
    exponentWords: { squared: ["sikwea"], cubed: ["kubik"], position: "before" },
    multiply: { times: "kwa" },
    ampersand: "na",
});

/** Normalize one Kamba input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeKamba(input: string): string {
    // ⚠ NFC FIRST (trap 11). This corpus writes ⟨ĩ ũ⟩ precomposed throughout (U+0129 / U+0169; there is not
    //   one combining mark in its whole codepoint census), but a decomposed input would slip past both the
    //   confusable fold below and every literal in this file.
    let s = input.normalize("NFC");

    // 1) THE CONFUSABLE TILDE VOWELS, BEFORE EVERYTHING — it changes which characters the tokenizer and every
    //    rule below can see at all, which is the same reason swahili.ts folds first. See the header: this is
    //    the round's largest change by a wide margin (91 of 1,992 utterances) and no gate can see it.
    s = foldTildeConfusables(s);

    // 2) `sq mi` — THE SQUARE MILE, WRITTEN AS TWO TOKENS, so the tier's exponent arm cannot reach it (there
    //    is no `²` anywhere). ×3, always the parenthetical gloss beside a square-kilometre figure:
    //    "sikwea wa kilomita 783,562 (300,948 sq mi)". ⚠ THE MEASURE WORDS ARE EMITTED DIRECTLY rather than
    //    rewritten to `mi²` — trap 54's single forbidden move, because an INVENTED superscript reaches the
    //    phoneme sink as a RAWMARK wherever the tier's digit-adjacency then declines. `sikwea sya kilomita`
    //    is the corpus's own order and concord.
    s = s.replace(new RegExp(`${NOT_BEFORE}(\\d[\\d,.]*)\\s?sq\\s?mi${NOT_AFTER}`, "gu"), "sikwea sya maili $1");

    // 3) `mph`, ×1 — "480 km/h (133 m/s; 300 mph)". Composed here rather than as a `units` key because
    //    `unitPrefix` would move a three-word reading wholesale in front of its number ("maili kwa isaa
    //    300"), where the corpus writes the noun first and the rate phrase last: "maili 105 kwa isaa".
    //    Before the tier, or its `mi` key would have to be kept off `mph` by a second guard.
    s = s.replace(new RegExp(`${NOT_BEFORE}(\\d[\\d,.]*)\\s?mph${NOT_AFTER}`, "gu"), "maili $1 kwa isaa");

    // 4) THE CURRENCY NOUN THE WRITER ALREADY WROTE — "mathangu ma mbesa meu ma Canada ma **ndola $5** na
    //    **ndola $100**". ⚠ CONSUMED HERE AND PUT BACK BY THE TIER (trap 10): the tier has an "already said
    //    it" suppression for PERCENT and none for currency, so left alone this reads *ndola ndola itanɔ*.
    //    Deleting the writer's word and letting `currencyPrefix` re-emit it in the same slot is the one move
    //    that keeps the reading at exactly one noun.
    s = s.replace(new RegExp(`${NOT_BEFORE}[Nn]dola\\s+((?:US|AUD)?\\$)\\s?(?=\\d)`, "gu"), "$1");

    // 5) THE SIGN BEFORE A MAGNITUDE WORD — "kwa kũnengane **AUD$ milioni 45** sya kwongeleela". The tier
    //    needs a digit adjacent to the mark and this shape puts the magnitude between them, so the sign
    //    would simply be dropped. ×1, and the reading it produces is the corpus's own order for the same
    //    quantity elsewhere ("mambilioni ma Ndola sya US").
    s = s.replace(
        new RegExp(`${NOT_BEFORE}(?:US|AUD)?\\$\\s?(?=(?:milioni|mbilioni|ngili)${NOT_AFTER})`, "gu"),
        "ndola ",
    );

    // 6) THE SHARED SYMBOL TIER, as Hawaiian and Karakalpak order it: its own numeral pattern reads
    //    `783,562` and `12.8` as ONE token, and steps 7–9 split precisely those. ⚠ AND IT MUST RUN BEFORE
    //    THE DECIMAL STEP or `NOT_VERSION` has no dot left to reject and the `m` key claims `802.11m`
    //    (traps 39/46).
    s = SYMBOLS(s);

    // 7) DE-GROUPING, BY THE THREE-DIGIT TEST ON BOTH MARKS — see the header. The comma groups 47 times and
    //    never decimates; the dot groups exactly once (`2.400`, Washington's 2,400 men) and decimates 26.
    //    Ungrouped, `1,600` read *ĩmwe , maːna ðaⁿðatũ* and `1,000 mi` read *ĩmwe , **nɔti*** — ONE, ZERO,
    //    with a false clause break between: the grouping mark reaching `clausePunctuation` is this corpus's
    //    single most common numeric defect and DROP is blind to all 47.
    //    ⚠ THE WHOLE NUMBER AT ONCE (trap 63) — `5,000,000` is three groups and a per-pass join reads it as
    //    two numbers. ⚠ AND THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (trap 58): `(?![\d.,])`
    //    would decline every clause-final figure, and this corpus ends a clause on a figure 152 times.
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    s = s.replace(/(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    // 8) RANGES → `kũthi`, ABOVE THE DECIMAL STEP and that ordering is a defect this layer would otherwise
    //    have INTRODUCED (trap 56, and hil's ceb ordering lesson). The corpus's `miaka 4.2- 3.9 tene muno` is
    //    a DESCENDING span of millions of years; spend its decimal points first and the rule sees an
    //    ascending `2- 3` and inserts a joiner the source never had. Run above them, the lookbehind's `.`
    //    declines the whole thing.
    //    ⚠ THE JOINER IS THE CORPUS'S OWN RENDERING OF A DASH, which is trap 45's technique on the sentence
    //    every FLEURS corpus shares: English "35-40 mph (56-64 km/h)" comes out here as
    //    "**kĩlomita 35 kũthi 40** kĩla ĩsaa (**kĩlomita 56 kũthi 64** kĩla ĩsaa)" — the translator wrote the
    //    span connective where the source wrote the hyphen, twice, as a bare infix between two bare numerals.
    //    ⚠ `nginya` (×55) WAS THE OBVIOUS CANDIDATE AND IS THE WRONG PART OF SPEECH FOR THIS SLOT — Fula's
    //    `hakkunde` again. Both of its numeric instances are governed by a preceding preposition
    //    ("meutewa **kuma** US$11,000 nginya US$22,500", "**kati wa** fiti 328 nginya fiti 820"); it is never
    //    a bare infix, and after a digit it means "up to" ("kiseve kya nginya 480 km/h").
    //    ⚠ ASCENDING ONLY, measured: the five non-ascending pairs are ice-hockey and tennis SCORES (`6-6`,
    //    `7-2`, `26 - 00`) and a truncated season (`1955-96`), which read as a juxtaposition and not a span.
    //    ⚠ AND `:` IS IN BOTH GUARDS, or `saa 10:00-11:000` matches at `00-11` and the clock is destroyed.
    //    ⚠ TWO MORE GUARDS EXIST FOR ONE AIRCRAFT, AND BOTH ARE REAL DEFECTS THIS RULE WOULD HAVE
    //    INTRODUCED (trap 56 again). The corpus writes the Ilyushin twice, `II-76s` and `II -76`, with
    //    ROMAN `II` — and `core/roman.ts` runs in registry.ts WRAPPING `text()` (the registry seam), so by
    //    the time this file sees them they are `2-76s` and `2 -76`: an ascending digit–hyphen–digit pair in
    //    both cases, which a plain rule reads as *ĩlĩ kũthi mĩongo mũonza na thanthatũ*.
    //      · a LETTER after the second operand rejects `2-76s`;
    //      · the SPACING BACKREFERENCE rejects `2 -76`, because a span is spaced symmetrically or not at all
    //        (`2-3`, `120-160`, `26 - 00`) and never on one side only.
    //    Neither guard costs a single corpus range.
    s = s.replace(/(?<![\d.,\-\/:])(\d+)([^\S\n]?)-\2(\d+)(?![\d\/:\p{L}\p{M}])(?!\s?-\s?\d)/gu,
        (whole: string, a: string, _sp: string, b: string) =>
            Number(a) < Number(b) ? `${a} kũthi ${b}` : whole);

    // 9) THE DECIMAL DOT, NEUTRALISED. ⚠ NO DECIMAL WORD IS SOURCEABLE AND THE FLOOR IS MEASURED, not
    //    assumed: espeak ships no Kamba at all (so there is no `_dpt` and no `_.`), there is no kam.wikipedia
    //    to probe, and the corpus spells no decimal point out — `nukta` (Swahili's word) and `ndoti` are both
    //    ×0. So the mark is SPENT rather than spoken; the defect being fixed is the false sentence break it
    //    produces mid-quantity (`12.8` read *ĩkũmi na ĩlĩ **.** ɲaɲa*), ×26.
    //    ⚠ THE GUARD DECLINES A DOTTED RUN OF THREE OR MORE GROUPS — an IP address or a `802.11.x` — because
    //    a decimal has exactly ONE dot; and it declines a match RESTARTING inside a number it already
    //    rejected (trap 52: a lookbehind rejects a POSITION, not the string).
    //    ⚠ AND THE TRAILING GUARD REJECTS A DOT ONLY WHEN A DIGIT FOLLOWS IT (trap 58). Written `(?![\d.])`
    //    it declines every CLAUSE-FINAL decimal, and this corpus writes four — `sĩsya ĩvĩsa ya 1.1.`,
    //    `uthui wa mbilioni $2.3.`, `ũthanthau wa mita 3.50.`, `kiwango kila kinenganitwe kya 6.5.` — each of
    //    which would keep a false sentence break in the middle of the figure, which is precisely the defect
    //    this step exists to remove. What has to be excluded is a dot CONTINUING the number.
    //    ⚠ AND IT IS ALSO THE CLOCK RULE FOR THE DOTTED NOTATION — `saa 12.00 GMT`, `(15.00 UTC)`,
    //    `saa 9.30 sya kwakya`, `saa 11.00 kũvĩka` — which comes out identical to what step 11 does to
    //    `saa 11:00`. The writer supplies `saa`, so only the mark is spent.
    s = s.replace(/(?<![\d.])(\d+)\.(\d+)(?!\d)(?!\.\d)/gu, "$1 $2");

    // 10) DEGREES. One instance, `uvyuvu wa ndikilii +30°C`, and ⚠ THE WRITER HAS ALREADY SAID IT (trap 12) —
    //     `ndikilii` stands immediately before the sign, so emitting the word again gives *ndikilii ndikilii*.
    //     Same shape as Karakalpak's `+15+20°С gradus`.
    //     ⚠ THE SCALE LETTER IS CONSUMED AND NOT READ, and that is a stated loss rather than an oversight: no
    //     Celsius or Fahrenheit name exists in any source for this language (`selsiasi` ×0, `Celsius` ×0,
    //     `Fahrenheit` ×0, no espeak, no wiki). Left alone the ⟨C⟩ reads as a bare affricate — *miɔᵑɡɔ etatũ
    //     **tʃ*** — which is the trap-56 half of the same decision: a stray phoneme, not a word.
    //     ⚠ AND `°` IS THE ONLY DEGREE CODEPOINT HERE. Three recent rounds each found a confusable in this
    //     slot (`˚` U+02DA in Hawaiian, `º` U+00BA in Swahili, a Cyrillic ⟨С⟩ in Karakalpak); this corpus's
    //     whole non-ASCII census is 21 characters and contains U+00B0 once and no relative of it. The
    //     confusable this round DID find is in the vowels instead (step 1).
    s = s.replace(new RegExp(`(\\d[\\d.,]*)\\s?°\\s?[CF]?${NOT_AFTER}`, "gui"),
        (_m: string, num: string, offset: number, full: string) =>
            /ndikilii\s*[+\-−]?\s*$/iu.test(full.slice(0, offset)) ? num : `ndikilii ${num}`);

    // 11) THE CLOCK. The colon is clause punctuation in kamba.ts, so `saa 11:00` read as *saː ĩkũmi na ĩmwe
    //     **,** nɔti* — a phrase break inside a time. The writer supplies `saa`/`Twi` in every instance, so
    //     the figures are left as FIGURES and only the colon is spent, the Hawaiian and Karakalpak choice.
    //     ⚠ THE TWO-DIGIT MINUTE BOUND IS THE WHOLE GUARD and it is what declines all six non-clocks — see
    //     the header: the ratio `3:2`, the degree class `2:2`, and the three ski times `4:41.30`, `2:41.60`,
    //     `1:09.02`, whose trailing `.` the right-hand guard rejects. `10:00-11:000` reads its first half and
    //     declines the typo'd second, which is the right answer for a figure that is not a time of day.
    s = s.replace(/(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])/gu, "$1 $2");

    // 12) A SPACED DASH is a parenthetical break and was being dropped entirely, so 20 clause boundaries
    //     carried no pause at all ("Kukuia angi - Ndukaatate muvuko waku ueke uwona", "wendo wa kusoma -
    //     kivindi kiu kyanengie syana vinya"). LAST, so step 8 has already claimed every dash between two
    //     numbers — the score "26 - 00" must keep its bare juxtaposition rather than gain a spurious pause.
    //     ⚠ THE DOUBLED FORM OCCURS TOO ("kulisa iima na kutulila -- indi yendaa"), ×1.
    s = s.replace(/(?<!\d)[^\S\n]+-{1,2}[^\S\n]+(?!\d)/gu, ", ");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return s.replace(/[^\S\n]{2,}/gu, " ");
}
