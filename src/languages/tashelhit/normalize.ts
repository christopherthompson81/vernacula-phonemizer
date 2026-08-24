/**
 * Tashelhit / Shilha (shi) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR TASHELHIT. The evidence is `tools/corpus/mined/shi.jsonc` — 43,733 paragraphs
 * from a shi.wikipedia dump, so its `sample` tier IS the real distribution — read through its 403 retained
 * segments (203 hard + 200 sample), plus `attest.ts` against shi.wikipedia for anything the corpus does not
 * settle. Every count below says which of the two it is over. Full log:
 * `docs/investigations/shi_normalization_investigation.md`.
 *
 * ⚠ THE SCRIPT QUESTION FIRST, BECAUSE IT DECIDES EVERYTHING ELSE. shi is catalogued Latin/Tifinagh and is
 * also written in the Arabic manuscript script. The engine's token class is the two SCRIPTS —
 * `hostWordRun(["Latin", "Tifinagh"])` — not a letter list, so Neo-Tifinagh U+2D30–2D7F is INSIDE the class
 * and the "a letter outside the class is deleted, splitting its word" hazard does not arise for it. What the
 * corpus actually contains, counted over the 403 retained segments:
 *
 *     Berber LATIN            running text, everywhere
 *     Tifinagh                 6 segments (1.5%) — every one a GLOSS: `Tga Tafrawt (s tifinaɣ: ⵜⴰⴼⵔⴰⵡⵜ) yat …`
 *     Arabic                  51 segments (12.7%) — every one a GLOSS: `Iga Muḥammad (s tɛrabt: محمد) …`
 *
 * So this is a LATIN-SCRIPT job. Every rule below is written for the Berber Latin orthography and none keys
 * on a character Tifinagh uses, so the Tifinagh path passes through untouched.
 * ⚠ TWO HAZARDS PROBED AND BOTH NEGATIVE, kept so nobody re-runs them. (1) EMPTY READINGS: 0 of 403 segments
 * read as the empty string — the Arabic glosses are not dropped, because `assembleClauses` + `core/scripts.ts`
 * route a run in an unclaimed script to that script's own engine (`محمد` → `mħmd`). (2) One segment writes
 * `mṛṛakⵯc`, a Tifinagh Tamatart U+2D6F inside a LATIN word, and `phonemize()` picks its map with
 * `[...word].some(isTifinagh)` — but the Tamatart is consumed as the LABIAL MARKER before the map is
 * consulted, so `mṛṛakⵯc` → `mṛːakʷc` and the word does not flip tables.
 *
 * ⚠ THE REFEREE IS A TRIPWIRE HERE, NOT A METER. `tools/referee-eval/eval.ts:62` binds shi as
 * `phonemizeWord` — the WORD path — and this layer runs inside `text()`, so the referee cannot see it. The
 * correct after-value is byte-identical (wikipron 468/500 raw · 487/500 folded; kaikki 586/601 · 588/601).
 * Movement would mean the g2p had been touched.
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — the defect list, not an assumption:
 *
 *     8665 km²      → …u stːin km            exponent GONE, `km` raw in the IPA          (LEAK RAW-LATIN km ×25)
 *     5 kg          → χmsa kɡ                `kg` raw                                     (LEAK RAW-LATIN kg ×3)
 *     1 470 m       → jan  rbʕ mja u sbʕin  m   space grouping = TWO numbers, `m` raw
 *     510.072.000   → three SENTENCE BREAKS  period grouping read as clause punctuation
 *     8,000         → …  ,  …                comma grouping read as a pause
 *     37.4%         → sbʕa u tlatin . rbʕa   decimal period = a SENTENCE BREAK
 *     17,9%         → sbʕtaʃ , tsʕud         decimal comma = a pause
 *     20°C          → ʕʃrin ʃ                ° dropped AND ⟨C⟩ read as the shi grapheme c = ʃ
 *     148 D.Ɛ.      → …rbʕin d . ʕ .         TWO spurious sentence breaks + two bare consonants
 *     $47,203       → the sign silent
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO PERCENT WORD, AND IT IS THIS LANGUAGE'S LARGEST CLASS. `DROP percent ×136` in the artifact scan, 234
 *   number+% instances in the 403 retained segments, 24,338 in the whole-corpus cell count. Every tier was
 *   exhausted:
 *     · `tigmiḍi` is attested 120 tokens / 20 wiki articles and is NOT it — every instance is the section
 *       heading `Tigmiḍi n tagufi (…) : 17,9%`, i.e. the NOUN "percentage" standing BEFORE its figure, which
 *       the corpus writes BESIDE the sign. Emitting it after the number gives "17.9 percentage". This is the
 *       Fula `tere` shape: attested, real, wrong slot. `attay` (5 tokens) fails the same way.
 *     · every candidate SPELLING is absent from shi.wikipedia: `afmiḍi` `tamiḍi` `amiḍi` `ɣ mya` `f mya`
 *       `zɣ mya` `g mya` `ɣ timiḍi` `lmya` `lmiya` `almya` `pursan` `purṣan` — all 0 tokens.
 *     · `timiḍi` ×20 IS attested and is the literary numeral 100 (`100 nɣ Timiḍi`) plus a douar name
 *       (`trfiqt n timiḍi`, ×18 of the 20).
 *     · `concept.ts` on Q11229/Q137985650: no article in shi, kab, zgh OR ary. espeak does not ship shi.
 *     · web search offers only the Moroccan **Darija** form `f-lmya`, which is a fact about Darija.
 *   ⚠ AND THE REASON IS STRUCTURAL. `attest.ts --after ɛcrin,xmsin,tlatin,mya,sbɛin` returns *nothing* —
 *   shi.wikipedia never spells a numeral out at all, so the reading of this SIGN is absent from text by
 *   construction and no amount of extra corpus would find it. The escalation tier for that is the corpus's
 *   own AUDIO, and shi has none. A wrong percent word is worse than a dropped sign.
 *   ⚠ THE REDUNDANCY ESCAPE DOES NOT RESCUE IT EITHER: only 17 of the 234 instances have `tigmiḍi`/`attay`
 *   within 90 characters to the left, so 217 are contentful and the drop is real. NOT in `ACCEPTED_SILENT`.
 *
 * ⚠ THAT REFUSAL USED TO BE WHY THIS FILE WAS LOCAL, AND IT NO LONGER IS. `SymbolData.percent` was a
 *   REQUIRED field with an unconditional arm, so a language with no sourceable percent word could not
 *   declare the shared tier at all — even though shi's units, postposed exponent and invariant `unitPer`
 *   (`ɣ tasragt`) all fit it. This run reported that as a FIFTH candidate for playbook trap 47's list: not
 *   idiom, not ordering, but a mandatory data field the language cannot fill. The field is now OPTIONAL
 *   (its arm skipped, the sign left visible), so the reason is spent and shi's units, rates, exponents and
 *   currency are DATA on the shared tier at step 5 — see `SYMBOLS` below and
 *   `docs/investigations/tier_optional_fields_investigation.md`. The refusal itself is unchanged: shi still
 *   declares no percent word, and the `%` is still dropped visibly rather than read wrongly.
 *
 * ⚠ NO DECIMAL-POINT WORD. `sources.ts` reports `[NONE] decimal-point`. `tanqqiḍt` is attested ×4 and means
 *   "point" in the GEOGRAPHIC (`ittubna ɣ tanqqiḍt akkʷ yattuyn`, "built at the highest point"), MELTING
 *   (`Tanqqiḍt n ufsay n waṛẓan n ukalsyum tga 842 taskflt n Silsus`) and PUNCTUATION-MARK senses (in a list
 *   of grammar terms) — none of which is the spoken separator; `virgul`, `fasila`, `tanqqiṭ` are 0. So the
 *   fractional digits are read ONE AT A TIME with no separator word, which is what `sources.ts` itself
 *   prescribes for this case and what bm and ln already do. The defect being fixed is the spurious PAUSE.
 *
 * ⚠ NO MINUS WORD, AND THIS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE — omitting a plus is lossless,
 *   omitting a minus INVERTS. No shi word for a negative is attested anywhere. And the 15 leading minuses in
 *   the retained text split THREE ways, which is three readings and not one: a real negative temperature
 *   (`ingr -45°Silsyus ar 30°Silsyus`), NEGATIVE YEARS used as an era marker (`sg -945 armi ar -924`), and
 *   UTC-style offsets (`tlla gr -12 d +12`). Left unread, and NOT in `ACCEPTED_SILENT`.
 *
 * ⚠ NO FRACTIONS. `[NONE] fraction-series`, and the `\d+/\d+` shape in this corpus is dominated by
 *   NON-fractions: `14/15 abril` (a date span), `1989/1` (a journal issue), `(4/1)-(4/3)+(4/5)` (series
 *   terms in the π article). A rule would misfire more often than it fired.
 *
 * ⚠ NO CLOCK. The colon shape occurs TWICE in 403 segments (`2:00`, `00:30`) and once with a period
 *   (`ɣ tsragt 09.00 d 2:00 tmddit`). No shi reading of a digital time is attested, and two instances is not
 *   a rule. ⚠ The period one is exposed to step 6 below and is checked in the corpus diff rather than
 *   assumed away.
 *
 * ⚠ NO INITIALISMS AS LETTER NAMES. `core/initialisms.ts` exists and ~30 languages wire it, but it is a
 *   NO-OP without a `letterName` table and `sources.ts` reports `[NONE] letter-names — espeak does not ship
 *   this language at all`. Trap 16 checked: the seam is there, the DATA is not. Step 3 therefore only
 *   removes the spurious PAUSES from a dotted run and leaves the letters where they were.
 *
 * ⚠ NO `¥` OR `£`. One instance each, both inside the same gloss
 *   (`1 agndid n dulaṛ (¥ 106٬710٬325 nɣd € 638186 nɣd £ 504720)`), and no shi word for either is attested.
 *
 * ⚠ NO ERA PHRASE FOR `b.ɛ` (×2 — `571 b.ɛ`, `632 b.ɛ`, both AD dates). Unlike `D.`/`Ḍ.` its initials
 *   compose from nothing attested in shi — `b` is not a shi word for "after" — so the ERA arm declines it
 *   and no phrase is guessed. ⚠ IT IS STILL CLAIMED BY THE GENERIC DOTTED RUN at step 3, which removes its
 *   interior dot (`b . ʕ .` → `bʕ .`). That is a PAUSE repair and not a reading: the letters are left
 *   exactly where they were, which is the same treatment `H. E.` and `a.l.` get.
 *
 * ⚠ THE TWO RAW-LATIN LEAKS THAT SURVIVE ARE BOTH RATE DENOMINATORS, and both are correct refusals. `km ×1`
 *   is `24,448 ufgan/km amkkuẓ` ("persons per square km") and `kg ×1` is `> 295 mOsm/kg` (a plasma
 *   osmolality). In each the symbol is the DENOMINATOR of a rate whose NUMERATOR noun shi does not declare —
 *   `ufgan/` is a bare noun and `mOsm` is nothing this layer knows — so reading half of it would be half a
 *   reading. The shared bare-unit guard refuses a key preceded by `/` for exactly this reason, and the two
 *   keep leaking VISIBLY, which is the honest side to fail on.
 *
 * ⚠ THE `DROP degree ×5` THAT SURVIVES IS THE COORDINATE SET, declined at step 5 and listed there:
 *   `31° 57′ 51″ N`, `34°51'15" ataram`, `51°27'52" agmuḍ`, `37°21' agafa`, `7° Ouest`. `DROP exponent ×1`
 *   is `yan usalay³ ɣ Myunix` — a FOOTNOTE MARKER superscript glued to a word, not a power, and reading it
 *   as one would be an invention.
 *
 * ⚠ THE `MARKUP` SCAN LINES ARE NOT A DEFECT IN THIS LAYER. `MARKUP math-sign ×15` and `MARKUP ampersand ×8`
 *   are one class — raw TeX that survived extraction from the maths articles (`\ln(a^n) = n \ln(a)`,
 *   `n=2,& (x + y)^2 &= x^2 + 2xy + y^2,\\`). That is a mining artifact, not Tashelhit orthography, and no
 *   reading of it is correct.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";

/**
 * UNIT ABBREVIATION → the word to say, longest key first so `km²` is tried before `km`.
 *
 * Every reading below is a corpus or shi.wikipedia attestation READ IN CONTEXT, in the digit-adjacent slot,
 * not a bare token count (trap 37). Sources, with the quote that settles each:
 *
 *   km   `kilumitr`         corpus ×7 digit-adjacent (`illa uzaru n 8,000 kilumitr (5,000 mil)`,
 *                           `ar tṛwaḥ 6 kilumitr ɣ tasragt`); wiki 36 tokens / 20 articles.
 *   km²  `kilumitr amkkuẓ`  ⚠ THE COLLOCATION IS THE EVIDENCE, and it is ×5 across independent wiki
 *                           articles, TWICE glossed against the imperial equivalent in the same sentence:
 *                           `673 kilumitr amkkuẓ (260 mil amkkuẓ)`, `331,000 kilumitr amkkuẓ (128,000 sq
 *                           mi)`, `2,381,741 kilumitr amkkuẓ`. The corpus adds `20,755 umzdaɣ i yan
 *                           ukilumiṭṛ amkkuẓ` and `510.072.000 km² (yikilumitren imkuẓn)` — the second is
 *                           the wiki glossing the SYMBOL with the words, which is the strongest form there
 *                           is. That one measurement fixes the word AND its POSITION (postposed).
 *   m    `mitru`            wiki ×6 digit-adjacent (`ɣ yat tuttuyt n 1 627 mitru`, `g 3.6 d 9 mitru`,
 *                           `ɣazn ar 27 mitru`).
 *   m²   `mitr amkkuẓ`      `s yat tjumma n 60,000 id mitr amkkuẓ`.
 *   m³   `mitr mukaɛɛab`    `d acrcur nns 24.3 mitr mukaɛɛab ɣ tsnat` — and the same sentence supplies the
 *                           per-second rate below.
 *   kg   `kilugram`         corpus `astal ns 54 kilugram`; wiki `ilkkmn 200 kilugram`, `gr 1 ar 1,5 kilugram`.
 *   g    `gram`             wiki ×4 digit-adjacent (`gr 375 d 450 gram`, `500 gram n uggurn`, `ar 300 Gram`).
 *   cm   `santim`           wiki `ar tlkkem tiɣzi nns gr 24 ar 34 santim`; the corpus writes the longer
 *                           `130 santimitr` once, so both are real and the shorter is the digit-adjacent one.
 *   mm   `milimitr`         wiki `ar gis ittawḍ unẓaṛ 20 milimitr g usggʷas`, `nig n 2000 milimitr`.
 *
 * ⚠ THE RATE KEYS ARE THEIR OWN ENTRIES, not a composition (trap 44). shi's "per" is the locative `ɣ` plus
 * the time noun, and both are attested as whole phrases — `6 kilumitr ɣ tasragt` (per hour, corpus) and
 * `24.3 mitr mukaɛɛab ɣ tsnat` (per second, wiki). Declaring `h` and `s` as standalone denominators would be
 * the `Il-76s` hazard for nothing; the compound key is tried first because the list is longest-first.
 *
 * ⚠ ONE-LETTER KEYS: `m` IS DECLARED AND `s`/`n` ARE NOT, and the difference is measured. Digit-adjacent
 * bare `m` is ×4 in the retained text and ALL FOUR are genuine metres (`ɣ yat tattuyt n 1 351 m`, `uggar n
 * 4000m`, `tlkmd 2357 m`, `tiɣzi nns tlkm 1 470 m`). Bare `s` and `n` after a decimal, by contrast, are ×60+
 * and every one is a COORDINATE hemisphere letter in a table of latitudes (`28.1 n`, `60.45 s`, `27.16 n`,
 * `66.2 s`) — declaring either would read half a coordinate list as seconds and nouns.
 * ⚠ AND THE `m` KEY CARRIES TRAP 46's COST, WHICH THE FIRST DRAFT GOT WRONG. A leading `(?<![\d.,])` does
 * NOT stop `802.11m`: rejected at `802`, the engine retries from the FRACTIONAL part and matches `11m` on
 * its own — trap 28's exact finding — so the draft read it as "…eleven METRES". The tier's `NOT_VERSION`
 * lookahead is lifted verbatim at step 5. This corpus contains ZERO dotted designations, so that arm is
 * robustness for plausible input rather than a measured repair; stated, so it does not look free. It lives
 * HERE rather than being inherited because step 6 spends the decimal dot, and a guard that needs a character
 * cannot live downstream of the rule that rewrites it (trap 39).
 */
const SYMBOLS = makeSymbolNormalizer({
    // ⚠ NO `percent` KEY, AND THAT ABSENCE IS THE DECLARATION. See the header: the reading of this sign is
    // absent from shi text by construction. The tier now skips the arm rather than requiring a word, so the
    // `%` is left exactly where it was and the DROP gate keeps counting it.
    units: {
        km: ["kilumitr"], m: ["mitru"], cm: ["santim"], mm: ["milimitr"], kg: ["kilugram"], g: ["gram"],
        // ⚠ THE CUBED-METRE RATE IS ITS OWN KEY, because the tier composes an exponent on the DENOMINATOR
        // (`katao/km²`) but not on the HEAD: after `m` the alternation offers `/denominator` OR an exponent,
        // never both, so `24.3 m³/s` would read "24.3 mitr mukaɛɛab" and strand the `/s`. Declared whole, it
        // is matched first (keys are longest-first) and the corpus's own `24.3 mitr mukaɛɛab ɣ tsnat` is
        // preserved. The plain `km/h`/`km/s` rates need no such entry — they compose from `unitPer`.
        "m³/s": ["mitr mukaɛɛab ɣ tsnat"], "m3/s": ["mitr mukaɛɛab ɣ tsnat"],
        // ⚠ AND THE SQUARED/CUBED METRE IS ALSO ITS OWN KEY, FOR A REASON THAT IS THE LANGUAGE AND NOT THE
        // TIER: shi's metre LOSES ITS FINAL VOWEL under a measure word. The corpus writes `1 351 m` →
        // *mitru* standing alone but `60,000 id mitr amkkuẓ` and `24.3 mitr mukaɛɛab` — the annexed form —
        // when the modifier follows. `exponentWords` composes head + word and cannot change the head, so
        // composing would read *mitru amkkuẓ*, which is not the form the corpus writes. The kilometre has no
        // such alternation (`kilumitr` either way) and composes normally, which is why only this noun is
        // enumerated. Caught by test/tashelhit.test.ts, not by the corpus diff — the artifact's own
        // instances are all `km²`.
        "m²": ["mitr amkkuẓ"], m2: ["mitr amkkuẓ"], "m³": ["mitr mukaɛɛab"], m3: ["mitr mukaɛɛab"],
    },
    // shi's "per" is the locative `ɣ`, invariant across denominators — `6 kilumitr ɣ tasragt` (corpus),
    // `24.3 mitr mukaɛɛab ɣ tsnat` (wiki). ⚠ THE TIME NOUNS ARE DENOMINATOR-ONLY, never standalone units:
    // declaring `h`/`s` in `units` is the `Il-76s` hazard, and bare `s` after a decimal is ×60+ in this
    // corpus and every one is a COORDINATE hemisphere letter (`28.1 n`, `60.45 s`). This field is the seam
    // that was written for exactly that distinction.
    rateDenominators: { h: "tasragt", s: "tsnat" },
    unitPer: "ɣ",
    // ⚠ THE MEASURE WORD IS POSTPOSED, and one measurement fixes both the word and the position: the wiki
    // glosses its own symbol, `510.072.000 km² (yikilumitren imkuẓn)`, and writes `673 kilumitr amkkuẓ
    // (260 mil amkkuẓ)` ×5 across independent articles. The cube is `mitr mukaɛɛab`, same order. Declaring
    // them here generalises to `cm²`/`mm³`, which the local key list could only have got by enumeration.
    exponentWords: { squared: ["amkkuẓ"], cubed: ["mukaɛɛab"], position: "after" },
    // The corpus's own magnitude words, longest first handled by the tier. `id` is the Berber plural marker
    // that precedes one of them (`2.15 id mlyun`), so the pair is declared as one magnitude.
    magnitudes: ["id mlyun", "id mlyar", "mlyun", "mlyar", "mlayn", "mlayr", "milyar", "mlyaṛ"],
    // ⚠ NO `magnitudeConnective`, AND THAT IS MEASURED RATHER THAN AN OMISSION. shi writes the linker `n`
    // after the PLURAL magnitude and not after the singular one — `2 id mlyun n Uṛu` and `€3 id mlyun n
    // Wuṛu` against `40 mlyun dulaṛ`, `440 mlyun dulaṛ amirikani` and `18 mlyun Uṛu`. The field is ONE
    // string for every magnitude, so declaring it emits `n` in all four and reads `$440 mlyun` as
    // *440 mlyun N dulaṛ*, which is not what the wiki writes. Declined; the suppression that needed it is
    // handled by the extra `currency` spellings instead.
    //   `$` → `dulaṛ`   wiki `440 mlyun dulaṛ amirikani`, `40 mlyun dulaṛ`; corpus
    //                   `1 agndid n dulaṛ (¥ … nɣd € … nɣd £ …)` — monetary in every instance.
    //   `€` → `uṛu`     wiki `18 mlyun Uṛu`, `s 17.1 mlyun Uṛu`, `2 id mlyun n Uṛu`; corpus
    //                   `s watig n €3 id mlyun n Wuṛu`.
    // ⚠ THE `€` ENTRIES AFTER THE FIRST ARE SUPPRESSION SPELLINGS, NOT COUNT FORMS, and the tier's own
    // documentation is what licenses them: the "the text already says it" guard tests EVERY declared form
    // against the text immediately following the match, which is the only reason more than one is ever
    // useful for a language that does not inflect. shi's corpus writes the noun there as `n Wuṛu` — the
    // linker `n` plus the Berber construct-state `w-` — so the bare `uṛu` does not match it and the corpus's
    // one running-text `€` reads the currency TWICE (trap 12: `€3 id mlyun n Wuṛu` → *…n uṛu n Wuṛu*).
    // Declaring the whole following string is what shuts it up without emitting an `n` the `$` case does
    // not take. `countForm` below is what keeps these from ever being SAID; the guard is case-insensitive,
    // so `n Wuṛu` covers `n wuṛu` and `n Uṛu` covers `n uṛu`.
    // ⚠ `¥` AND `£` ARE NOT CLAIMED. See the header: one instance each and no attested word.
    currency: { $: ["dulaṛ"], "€": ["uṛu", "n Wuṛu", "n Uṛu"] },
    // ⚠ SHI DOES NOT INFLECT THESE NOUNS FOR COUNT in the quantified slot — the corpus writes `40 mlyun
    // dulaṛ` and `1 agndid n dulaṛ` with the same form — so the selector is pinned to the first entry. That
    // is also what makes the extra `€` spelling safe: it is reachable by the suppression guard and by
    // nothing else.
    countForm: () => 0,
});

/**
 * THE ERA MARKERS, and the corpus GLOSSES ITS OWN ABBREVIATION, which is the strongest attestation there is.
 *
 * shi.wikipedia writes four of them in the retained text — `D.Ɛ.` ×2, `Ḍ.Ɛ.` ×1, `D.T.` ×5, `Ḍ.T.` ×1
 * (`era-marker` ×25 over the whole corpus) — and each is the initials of a two-word phrase the same corpus
 * spells out elsewhere:
 *
 *     dat    "before"  ×2   `(Jurjya dat usggʷas 1989)` — "Georgia before the year 1989"
 *     ḍarat  "after"   ×2   `Ḍarat n yan umnɣi gzzuln d Ṛuma` — "after a short war with Rome"
 *     tlalit "birth"        `g 250 dat tlalit n Yizus` — 250 before the birth of Jesus, i.e. `250 D.T.`
 *     Ɛisa   "Jesus"        `ngr 118 d 112 ḍarat n ɛisa`
 *
 * The initials, the sense and the dates all agree: `D.T.` marks 250, 212, 206, 179, 148 and 112 — every one
 * BC — and `Ḍ.T.` marks 1980 and `Ḍ.Ɛ.` marks 170, both AD.
 *
 * ⚠ NEGATIVE RESULT KEPT, and it is the same shape as bm's `K.Ɲ.`: the SOURCE TEXT is itself inconsistent.
 * The one spelled-out `ḍarat n ɛisa` is applied to 118–112 BC, where `dat` is what the dates mean. This rule
 * EXPANDS THE ABBREVIATION THE AUTHOR WROTE; it does not adjudicate the century. That is the only defensible
 * behaviour when the distinction between the two markers is a single dot-below.
 *
 * ⚠ `b.ɛ` (×2) IS NOT HERE. See the header: its initials compose from nothing attested in shi.
 */
const ERA: readonly (readonly [string, string])[] = [
    ["Ḍ\\.\\s?T", "ḍarat tlalit"], ["D\\.\\s?T", "dat tlalit"],
    ["Ḍ\\.\\s?Ɛ", "ḍarat Ɛisa"], ["D\\.\\s?Ɛ", "dat Ɛisa"],
];

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period. `body` is a regex for
 * the abbreviation WITHOUT its final dot; the dot is consumed only when the sentence visibly continues, and
 * kept when what follows is the end of the input or a capital — so a real pause is never deleted. Taken
 * verbatim from the Bambara/Lingala layer.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[ \u00a0]*(?:$|\\p{Lu}))`, "gu");
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return s.replace(atEnd, `${word}.`).replace(inline, word);
}

/**
 * Every rule here emits DIGITS wherever a number is involved and lets the engine's own number path
 * (`numbers.ts`) speak them, so this layer carries no numeral of its own.
 */
export function normalizeTashelhit(input: string): string {
    // 1) NFC at the entry, so a literal in this file matches whichever normalization the corpus used.
    //    shi's emphatics are dot-below letters with precomposed forms (ḍ ṭ ṣ ẓ ṛ ḥ), so the ERA literals
    //    `Ḍ.T.`/`D.Ɛ.` and the unit word `amkkuẓ` are exactly trap 11 in a Latin script: the two encodings
    //    render identically and a decomposed one would match no rule here. `phonemize()` re-NFCs downstream
    //    (idempotent), so this costs nothing there.
    let s = input.normalize("NFC");

    // 2) HTML ENTITIES AND ZERO-WIDTH MARKS. A dump carries `&nbsp;` and numeric entities, and the artifact's
    //    `zero-width` cell is ×4 — the corpus writes `Taskflt n ​​trɣi` with two U+200B. A rendering hint is
    //    not speech, and a zero-width space between a figure and its unit would break every adjacency the
    //    steps below match on.
    s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ").replace(/[​‌‍⁠﻿]/gu, "");

    // 3) ERA MARKERS, then DOTTED RUNS — before anything can read an interior dot as a phrase break, and
    //    before step 6, the other rule in this file that inspects dots (trap 39: a guard's evidence has a
    //    lifetime). ⚠ Ḍ BEFORE D in both pairs, because the emphatic is not a prefix of the plain one here
    //    but the ORDER is what makes that obvious to the next reader; and `\s?` because the corpus writes
    //    `D.Ɛ` and `D. T` both. See ERA for the sourcing and for the source text's own inconsistency.
    for (const [body, word] of ERA) s = expandDotted(s, body, word);
    //    ⚠ AND THE MARKER IS ALSO WRITTEN WITHOUT ITS FINAL DOT, which the corpus diff caught: the very
    //    sentence that carries `148 D.Ɛ.` opens with `Ilul ɣ 238 D.Ɛ immt …` — no trailing dot, so
    //    `expandDotted` could not see it and the interior dot stayed a sentence break. Run AFTER the dotted
    //    pass, so what reaches here is only the dotless form (trap 15's shape: the same abbreviation written
    //    two ways, and looking for one of them finds half the instances).
    for (const [body, word] of ERA)
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${body}(?![\\p{L}\\p{M}.])`, "gu"), word);

    //    THE GENERIC DOTTED RUN ONLY REMOVES THE DOTS. `H. E. Butler` (×5, in the English bibliographies this
    //    wiki carries) and `a.l.` were each producing one spurious CLAUSE BREAK per interior dot. Reading the
    //    LETTERS is a different problem and is blocked at the data layer (see the header: no letterName table
    //    exists for shi), so this fixes the pause and leaves the letters exactly where they were.
    //    ⚠ CAPPED AT FOUR GROUPS WITH A LOOKAHEAD THAT REFUSES A LONGER RUN, and ⚠ THE FINAL DOT SURVIVES
    //    WHEN THE SENTENCE ENDS — both taken from the bm layer, same arguments.
    s = s.replace(/(?<![\p{L}\p{M}.])((?:\p{L}\.){2,4})(?!\p{L}\.)(?![\p{L}\p{M}])/gu,
        (whole: string, _g: string, off: number, all: string) => {
            const body = whole.replace(/\./gu, "");
            const rest = all.slice(off + whole.length);
            return /^[ \u00a0]*(?:$|\p{Lu})/u.test(rest) ? `${body}.` : body;
        });

    // 4) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number. shi.wikipedia uses all four separators, and BOTH the
    //    period and the comma are ALSO its decimal separators, so the discriminator is the whole rule.
    //    Counted over the 403 retained segments, every instance read back:
    //
    //                    ≥2 groups   1 group ×3 digits   fraction 1–2 digits   fraction 4+
    //        PERIOD          4            12                   346                  0
    //        COMMA           4            28                    23                  2
    //
    //    ⚠ THE PERIOD IS UNAMBIGUOUS: all 16 three-digit-block instances are GROUPING (`20.000 n tkklit`,
    //    `196.722 km²`, `190.000 d 90.000 q.ɛ`, `710.850 km²`, `510.072.000 km²`) and all 346 one-or-two
    //    digit ones are decimals. Zero counter-examples in either direction.
    //    ⚠ THE COMMA IS MIXED, 29 grouping against 3 decimal — and the 3 are `3,125` (a π approximation),
    //    `1,989` (the solar mass, `attayen n 1,989 1 × 1030 kg`) and `99,854 %`. The `%` lookahead below
    //    recovers the third for free (no grouping in this corpus is followed by a `%`), leaving TWO known
    //    wrong readings, both scientific values in the maths/astronomy articles. Stated rather than hidden:
    //    30/32, and the cost is two sentences.
    //    ⚠ A PER-SEGMENT CONSISTENCY HEURISTIC WAS TRIED AND IS WORSE — "if this segment writes an
    //    unambiguous comma-decimal, read its comma-3-digit blocks as decimals too" scores 26/32, losing four
    //    groupings (`20,755`, `20,770`, `22,072`, `8,804,180`) to win one decimal. Measured, not assumed.
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    would refuse to de-group a number followed by its own sentence comma and speak the last group as
    //    a separate figure.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:,\d{3})+)(?![\d]|,\d)(?!\s?%)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])(\d{1,3})((?:\.\d{3})+)(?![\d]|\.\d)/gu, (w) => w.replace(/\./gu, ""));
    //    ⚠ U+066C ARABIC THOUSANDS SEPARATOR, ×2 — `¥ 106٬710٬325`. Moroccan text mixes the digit sets and the
    //    engine's tokenizer already accepts ٠-٩, so the separator has to be de-grouped on the same terms.
    s = s.replace(/(?<![\d٬])([\d٠-٩]{1,3})((?:٬[\d٠-٩]{3})+)(?![\d٠-٩]|٬[\d٠-٩])/gu, (w) => w.replace(/٬/gu, ""));
    //    The SPACE form (×19: `1 351 m`, `gr 16 500 d 30 000`, `5 262 km`, `∼26 100 a.l.`) additionally has
    //    to reject a bare adjacency that is really two numbers. Requiring every group to be EXACTLY three
    //    digits does that: `wiss 11 d 57 n tusdadt` has no 3-digit group and `21 mars 2020` is not
    //    `\d{1,3}( \d{3})+` because 2020 is four digits with no separator before it.
    s = s.replace(/(?<![\d.,])(\d{1,3})((?: \d{3})+)(?![\d]| \d)/gu, (w) => w.replace(/ /gu, ""));

    // 5) UNITS AND DEGREES, before decimals — the number-unit adjacency these match on is destroyed the
    //    moment a decimal is rewritten into spaced digits (playbook step 4's standing coupling), and after
    //    de-grouping so `8,000 kilumitr` and `1 470 m` are already one token. Running here is also what
    //    keeps the version-dot lookbehind honest: step 6 has not yet spent the decimal point (trap 39/46).
    //
    //    ⚠ THE DEGREE ARM FIRST, because `°C` must not present a bare `C` to anything downstream — the
    //    engine reads ⟨c⟩ as the shi grapheme /ʃ/, so `20°C` came out *ʕʃrin ʃ*: a dropped sign AND a
    //    confidently wrong phoneme. Sourcing, all digit-adjacent and all read in context:
    //      `taskflt` = DEGREE — `Taskflt n trɣi … ger 21.2 n tskflt d 28°`, `18 n tskflt ɣ yiḍ`,
    //      `i ur izzrayn +25 n tskflt`, `Tanqqiḍt n ufsay n waṛẓan n ukalsyum tga 842 taskflt n Silsus`, and
    //      the gloss chain `tlla gr 12 d 26 tafsna (taskflt) silasyuz (°C)` which pins word and symbol
    //      together in one line. ⚠ THE BARE COUNT IS THE WRONG MEASURE (trap 37): `taskflt` also means RANK
    //      (`taskflt n ulyutnan`), LEVEL (`tskflt yattuyn ɣ twssna`), CLASS (`taskflt tugḍiḍt`) and PLACE
    //      (`tskflt tamzwarut ɣ umaḍal`). Five digit-adjacent temperature instances are what settle it.
    //      `Silsyus` = CELSIUS — the corpus writes it GLUED TO THE SIGN, `ingr -45°Silsyus ar 30°Silsyus`.
    //      `Fahrinhayt` is ×0 and `°F` does not occur, so there is no Fahrenheit arm.
    //    ⚠ TRAP 12: WHERE THE SCALE WORD IS ALREADY WRITTEN the sign must not add a second one — `°Silsyus`
    //    emits only the degree noun and leaves the author's word in place.
    s = s.replace(/°(?=[Ss]ils)/gu, " taskflt n ");
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gui, "$1 taskflt n Silsyus");
    //    ⚠ AND THE BARE `°` IS CLAIMED ONLY WHERE IT IS A TEMPERATURE. Of the 18 digit-adjacent degree signs,
    //    ~11 are temperatures (`19° d 23° ɣ uzal`, `28°`, `40°C`) and ~5 are COORDINATES
    //    (`31° 57′ 51″ N`, `34°51'15 anẓul`, `51°27'52" agmuḍ`, `37°21' agafa`) plus `7° Ouest`. The
    //    discriminator is the RIGHT context, which is trap 24's move: a coordinate degree is followed by its
    //    ARC-MINUTE, and a bearing by a direction word. Both are rejected; the temperature instances have
    //    neither. Zero counter-examples on this corpus in either direction.
    s = s.replace(
        /(\d)\s?°(?!\s*\d+\s*[′'’])(?!\s*(?:Ouest|Est|Nord|Sud|agafa|anẓul|iffus|ataram|agmuḍ)(?![\p{L}\p{M}]))/gu,
        "$1 n tskflt",
    );

    //    THE UNIT, RATE, EXPONENT AND CURRENCY ARMS — the SHARED TIER, `core/normalizeSymbols.ts`, with
    //    this language's readings as pure data. See `SYMBOLS` above for every word's attestation.
    //
    //    ⚠ THIS FILE USED TO HAND-WRITE ALL OF IT, and the reason was a single missing cell: `SymbolData`
    //    required a `percent` word, so a language that correctly refuses to invent one could not declare the
    //    tier at all. The field is optional now (see the tier's own header and
    //    `docs/investigations/tier_optional_fields_investigation.md`), so the ~25 lines of unit-matching,
    //    magnitude-hopping and currency-suppression machinery that were duplicated here are gone and shi
    //    inherits the measured guards instead of a copy of them that can drift:
    //      · `NOT_VERSION` — the `802.11m` lookbehind+lookahead pair, trap 46. It is INHERITED rather than
    //        re-declared, and the placement argument is unchanged: the tier runs HERE, before step 6 spends
    //        the decimal dot, so the guard still has the character its evidence depends on (trap 39).
    //      · case-insensitive matching with exact-then-folded resolution — `91,982 Km²`, `180.000Km²`.
    //      · the decimal tail inside the operand — `105,40 km²`, the Lingala `0,44 km²` lesson.
    //      · the magnitude hop between figure and unit, re-emitted in place — `14,000,000 kilumitr amkkuẓ`.
    //      · the standalone-symbol pass, which this file already called into (`makeBareUnitNormalizer`).
    //
    //    ⚠ AND IT RUNS BEFORE DECIMALS, WHICH MOVES CURRENCY EARLIER THAN IT WAS. The local layer ran its
    //    currency arm LAST, after step 6 had already split `$1.5` into `$1 5` — so a decimal amount read as
    //    "1 dulaṛ 5", the noun inside its own number. There is no such instance in this corpus, so nothing
    //    moves here; it is stated because the ordering is now the tier's and not this file's.
    s = SYMBOLS(s);

    // 6) DECIMALS, after units and after de-grouping. Both marks reach here only as genuine separators, by
    //    step 4's measurement. The integer part stays a number for the engine's own number path; the
    //    FRACTIONAL DIGITS ARE EMITTED ONE AT A TIME AND THE SEPARATOR IS SPENT — see the header for why no
    //    separator word is shipped. The defect being repaired is the PAUSE: `37.4%` was reading
    //    *sbʕa u tlatin **.** rbʕa*, a sentence break inside a quantity, and `17,9%` a comma pause.
    //    ⚠ THE DIGITS ARE SPACED, not concatenated, so `21.2` becomes `21 2` and reaches the tokenizer as two
    //    numerals rather than as `212`.
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK — the same correction
    //    step 4 carries, and the corpus diff is what caught it missing here. A plain `(?![\d.,])` refused the
    //    π article's `(π≈3,14, π≈22/7)`, because the decimal is followed by the sentence's own COMMA, so that
    //    instance kept its spurious pause while the identical `3,14` earlier in the same paragraph was fixed.
    s = s.replace(/(?<![\d.,])(\d+)[.,](\d+)(?![\d]|[.,]\d)/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].join(" ")}`);

    // 7) THE CURRENCY ARM IS NOW STEP 5's, not its own. It moved into `SYMBOLS` with everything else — see
    //    that declaration for the two signs, their attestation, the `Wuṛu` construct-state spelling that
    //    keeps trap 12's suppression working, and why `¥`/`£` are still declined. `currency` is ×4 over the
    //    whole corpus, so this was always a small class; it is read because a silent sign is inaudible.

    return s;
}
