/**
 * Kurmanji / Northern Kurdish (kmr) text normalization — the pre-tokenizer pass that rewrites everything
 * which is not already a pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * Corpus: `tools/corpus/mined/kmr.jsonc`, a kmr.wikipedia dump of **182,432 paragraphs** (451 mined
 * segments, 251 hard + 200 sample), `covered 33/35`. There is no FLEURS corpus for Kurmanji and espeak does
 * not ship the language, so the artifact and ku.wikipedia are the only haystacks; counts below say which.
 *
 * ⚠ THE WIKI IS FILED UNDER `ku`, NOT `kmr` — `attest.ts --lang kmr` answers *"kmr.wikipedia.org does not
 * respond as a wiki"*, which reads exactly like a language with no wiki at all. It has 60k+ articles under
 * `ku`. Every probe below was run with `--wiki ku`; trap 43's shape (a code, not an engine).
 *
 * ⚠⚠ THE DEFINING RULE IS THE BOUND SUFFIX ON A NUMERAL, and it is the densest thing in the corpus:
 * **287 instances in 451 segments** — `an` ×177, `ê` ×70, `î` ×14, `yê` ×5, `a` ×3, `em` ×3, `yan`/`emîn` ×1.
 * Kurmanji writes its oblique/ezafe and its ordinal after the DIGITS (`sala 2015an`, `di 1949an de`,
 * `roja 25ê`, `salên 1990î`, `sedsala 5em`, `Çapa 1emîn`), and the tokenizer read each one as its own word
 * with its own primary stress: `sala 2015an` → *sɑːlˈɑː dˈʊ hɛzˈɑːr ˈuː pɑːnzdˈɛh **ˈɑːn***. This is trap 14
 * in a language the trap's own note predicted it for, and the fix is trap 14's fix shape — convert the
 * operand to WORDS inside the rule and attach the suffix there.
 *
 * ⚠ AND THE WRITTEN GLIDE MUST BE RE-DERIVED, NOT COPIED, because the writer chose it from the DIGITS while
 * it belongs to the SPOKEN form. `2ê sibata 1963an` is *duyê* — `du` ends in a vowel — but the text has no
 * `y`, because `2` does not look like it ends in one. Conversely `1980yî` and `2003yan` DO carry the glide,
 * and correctly: *heştê*+*yî*, *sê*+*yan*. So the rule strips any written `y` and re-inserts it from the
 * cardinal's own last letter, which gets all four cases right from one test.
 *
 * ⚠ KURMANJI IS EUROPEAN-CONVENTION, MOSTLY, AND THE CORPUS CARRIES BOTH. Measured over the mined segments
 * by group size, which is the only thing that separates them:
 *
 *     period + 3 digits   ×75   THOUSANDS   15.354 km² · 300.000 · 1.000.000.000
 *     period + 1 digit    ×12   decimal     %65.5 · 1.5 Mbit/s · Magnitude 7.6 · 7.1ê erdhejek
 *     period + 2 digits    ×6   NEITHER     27.10-6.11.2003 (a date), Ubuntu 6.10/6.06, saet 11.00an
 *     comma  + 1 digit    ×55   decimal     37,0% · 30,6% · 3,5 km²
 *     comma  + 2 digits    ×3   decimal     18,85 · 1,64 m
 *     comma  + 3 digits    ×8   THOUSANDS   10,000 · 500,000 · 71,553
 *
 * Both marks were `clausePunctuation`, so `15.354 km²` read *pɑːnzdˈɛh **.** sˈeː sˈɛd…* — "15. 354" — and
 * `37,0%` read "37 **,** zero". `decimals` is 8,615 in the dump and `grouped` 6,578.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { numberToWords } from "./numbers.ts";

/**
 * The shared symbol tier. Every word is attested IN ITS SLOT, and three of the six candidates probed had to
 * be thrown away on sense — read the examples, not the counts (playbook 5e).
 *
 *   ji sedî   percent — ×93 across 17 ku.wikipedia articles in exactly this frame (`(ji sedî 19 DV)`,
 *             a nutrition table) and ×2 in the corpus (`ji sedî 30 ji şervanên jin`). PREFIX in all of them.
 *             ⚠ The BARE word is a trap: `sedî` ×113 is the Persian poet **Sa'di Shirazi** in every one of
 *             the top hits. Only the collocation attests (trap 37, and trap 41's phrase probe is what
 *             makes it checkable at all).
 *   çargoşe   squared — and this is the one the wiki GLOSSES AGAINST THE SYMBOL: *"Kîlometre çargoşe ya bi
 *             kurtî km² dibêjin"* ("kilometre çargoşe, abbreviated km²") and *"Metre çargoşe ya m² dibêjin"*,
 *             plus `9,679 kîlometre çargoşe (3,737 mîl çargoşe)`. ⚠ `çarçik` ×21 is the attested COMPETITOR
 *             and is recorded rather than dropped — it is the geometric SHAPE (*"Çarçik di nav çargoşeyan de
 *             ya herî hêsan e"*, "the square is the simplest of the quadrilaterals") but is also used as the
 *             area unit in three Norway articles (`22.000 kîlomêtre çarçik e`). The definitional gloss wins.
 *             ⚠ `kare` ×41 is NOT the square word at all — it is the verb "can/is able" (*kare bişewte*,
 *             *kare bibe*). The single `23 km kare ye` that looks right is that verb. Trap 37 exactly.
 *   dolar     currency — corpus-attested with the magnitude between: `50 bilyon dolaran`,
 *             `817 milyar dolarê amerîkî`, `100 bilyon dolarên Emrîkî`. POSTPOSED, which is the tier default.
 *   û         ampersand — the ordinary Kurmanji conjunction, on every line of the corpus.
 *   kîlometre / metre / mîlîmetre / santîmetre / kîlogram — all attested whole-word on ku.wikipedia, and
 *             `metre` is the spelling the km²-defining article uses. (`mêtre` ×29 is the same word with the
 *             circumflex and is equally attested; the corpus writes both. One spelling had to be picked.)
 *
 * ⚠ `£` AND `¥` ARE LEFT UNREAD. Both occur (`230.000 £`, `20,023 ¥`) and neither has a Kurmanji name in
 * either haystack. Naming one would be the Fula `tere` failure; they are listed per instance in
 * `defects.ts` instead, so the moment a Kurmanji pound-word appears beside one the scan reports it again.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["ji sedî"],
    percentPrefix: true,
    currency: { $: ["dolar"], "US$": ["dolarên Emrîkî"], "€": ["ewro"] },
    magnitudes: ["hezar", "mîlyon", "milyon", "milyar", "bilyon"],
    units: {
        km: ["kîlometre"], m: ["metre"], mm: ["mîlîmetre"], cm: ["santîmetre"], kg: ["kîlogram"],
    },
    // `after`, spaced — `kîlometre çargoşe`, exactly as the defining article writes it. The corpus's one
    // FUSED spelling (`kîlometreçarçik`) is the competitor word, not a different position.
    // Both powers are glossed AGAINST THE SYMBOL by ku.wikipedia's own unit articles — *"Kîlometre çargoşe
    // ya bi kurtî km² dibêjin"* and *"Milîmetre kûp ya mm³ dibêjin"* — and both are then used in the slot
    // (`22.000 kîlomêtre çarçik`-style area figures; `20,9 kîlomêtre kûp`, `42,7 kîlomêtre kûp` ×5).
    // ⚠ `kûp` carries the circumflex: `kup` ×1 without it is the geometric CUBE ("Tabletên çargoşe û kup").
    exponentWords: { squared: ["çargoşe"], cubed: ["kûp"], position: "after" },
    // ⚠ THE RATE IS A CIRCUMFIX, AND THE TIER COMPOSES IT EXACTLY. Kurmanji says `kîlometre di saetê de`
    // ("kilometres in the hour"), attested ×4 on ku.wikipedia and three of the four GLOSSED AGAINST THE
    // SYMBOL in the same sentence: `120 kîlometre di saetê de (190 km/h)`, `122 … (196 km/s)`,
    // `172 … (107 mph)`. Splitting it as unitPer `di` + denominator `saetê de` reproduces the phrase.
    // Only `h` is declared: no Kurmanji reading of a per-SECOND rate is attested.
    unitPer: "di",
    rateDenominators: { h: "saetê de" },
    ampersand: "û",
});

/** Kurmanji vowels, for the glide test at step 4. ⟨y⟩ is a consonant here and deliberately excluded. */
const VOWEL = /[aeêiîouû]$/iu;

/**
 * The closed list of suffixes a numeral takes, longest first so `emîn` beats `em` and `yê` beats `ê`.
 *
 * ⚠ CLOSED ON PURPOSE. An open `[a-z]{1,4}` shape also matches this corpus's URL-encoded library-catalogue
 * string (`$002f$002fSD_ILS…$0026rw$003d0$0026ic$003dtrue$0026dt$003d$0026sm$003dfalse`), the version
 * numbers `2.6e` and `Ubuntu 6.10`, and the complement proteins `C3a`/`C3b`. Every one of those matched on
 * the first draft; none is a suffix.
 */
const SUFFIX_ALT = ["yemîn", "emîn", "yem", "em", "yan", "an", "yê", "ê", "yî", "î", "ya", "a"].join("|");

/**
 * A numeral plus its bound suffix, as ONE word.
 *
 * `n` is spoken first, then the suffix is glued to the LAST word with the glide re-derived (see the header).
 * Returns the cardinal alone when the suffix is empty.
 */
function suffixed(n: number, written: string): string {
    const words = numberToWords(n).split(" ");
    const last = words.pop()!;
    const bare = written.replace(/^y/iu, ""); // the written glide is re-derived, never trusted
    const glide = VOWEL.test(last) && VOWEL.test(bare[0]!) ? "y" : "";
    return [...words, last + glide + bare].join(" ");
}

/** Every rule emits Kurmanji WORDS or ASCII digits; nothing reaches the phoneme sink as a spelling. */
export function normalizeKurmanji(input: string): string {
    let s = input;

    // 1) HTML ENTITIES — the dump carries `&nbsp;` between a number and its unit (`8.196&nbsp;km²`,
    //    `-24,0&nbsp;°C`, `1000&nbsp;mm`), which is a LETTER run to every guard below and blocks both the
    //    unit tier and the degree rule. ×20 in the mined segments.
    s = s.replace(/&nbsp;/gu, " ");

    // 2) ERA MARKERS — before generic abbreviations (playbook step 4). `b.z.` ×13 in the mined segments and
    //    364 in the dump, written lowercase with dots (`484 b.z.`, `b.z. 550`, `558 b.z.- 530 b.z.`) and
    //    bare (`sala 4000 BZ`). Expansion `berî zayînê` ×79 across 20 ku.wikipedia articles, and the corpus
    //    itself spells it out once: *"8.000 salên berê zayînê"*. Position is free — the corpus writes the
    //    marker on both sides of its year — so the rule replaces in place and moves nothing.
    s = s.replace(/(?<![\p{L}])b\s?\.\s?z\s?\.?(?![\p{L}])/giu, "berî zayînê");
    s = s.replace(/(?<![\p{L}])BZ(?![\p{L}])/gu, "berî zayînê");

    // 3) THE SEPARATORS, BY GROUP SIZE — the only thing that tells them apart in a corpus that carries both
    //    conventions (the table in the header). Three digits after the mark is a THOUSANDS group, whichever
    //    mark it is, so `15.354` and `10,000` both de-group and `1.000.000.000` de-groups throughout.
    //    Must run before the suffix rule at step 4, which needs a bare integer to speak.
    const group = /(?<![\p{Nd}.,])(\p{Nd}{1,3}(?:([.,])\p{Nd}{3})+)(?![\p{Nd}.,])/gu;
    s = s.replace(group, (m, _g, sep: string) => m.replaceAll(sep, ""));

    // 4) PERCENT — `ji sedî` is a PHRASE whose first word the corpus already writes before the sign, and
    //    dropping the duplicate is the trap-12 move applied to a word rather than a symbol. The corpus
    //    writes `ji %71 çiya, ji %10 deşt, ji %3 zozan, ji %16 jî plato` — eight of them in one paragraph —
    //    and without this the reading is *ji ji sedî 71*. The sign also appears on the right (`37,0%`,
    //    `95%´ê`) and spaced (`% 38,2`); `percentPrefix` normalises all three to one order.
    s = s.replace(/(?<![\p{L}])ji\s+(?=%\s?\p{Nd})/giu, "");

    // 5) THE SHARED TIER — percent, currency, units, the squared/cubed modifier and `&`. Runs ABOVE step 7 because
    //    the tier matches a unit only when a NUMBER is adjacent and the decimal rewrite destroys that
    //    adjacency (the playbook's "units before decimals" coupling).
    //    ⚠ ONE GUARD RUNS FIRST. This corpus carries a URL-encoded library-catalogue string whose escapes
    //    are `$` + four hex digits (`$002f$002f…$0026sm$003dfalse`, ×17), and the tier read `$002f` as a
    //    dollar amount — *002 dolar f*, confidently wrong where the old behaviour was merely silent. The
    //    `$` there introduces a percent-style escape, not a price, so it is spent here.
    s = s.replace(/\$(?=00[0-9a-fA-F]{2})/gu, "");
    s = SYMBOLS(s);

    // 6) DEGREES, AND THE NEGATIVE SIGN RIDES WITH THEM — because in this corpus the two are the same rule.
    //    `pile` is the degree word, corpus-attested in the slot (*"di navbera 25 û 30 pile de"*, *"heta -24 û
    //    -30 pileyan dadikeve"*) and confirmed definitionally on the wiki for the ANGULAR sense too
    //    (*"Hoke bi yekeyên wekî radyan, pile an jî grad tê pîvandin"*). `degrees` is 148 in the dump and
    //    every mined instance is a COORDINATE (`37° 30´ û 38° 43´ bakûr`) or a temperature.
    //
    //    ⚠ THE MINUS IS UNAMBIGUOUS HERE AND NOWHERE ELSE, which is why it is claimed inside this rule
    //    instead of by a general one — Hindi's trap-24 shape, with the degree arm. Measured over the mined
    //    segments: a dash before a digit that is NOT preceded by a digit occurs ~22 times, and **all ten
    //    genuine negatives are temperatures** (`-52,6℃`, `-24,2 °C`, `-17,5 °C`, `-24,0 °C`, `-12,4 °C`,
    //    `-10 °C`, `-22,2 °C`, `-24 û -30 pileyan`). Every other one is a range (`558 b.z.- 530 b.z.`,
    //    `2700 – 2300ê`), a coordinate span (`42°-20´`), an ordinal range (`7.-8. Piştî sedsalan`), a book
    //    title (`Komkujiya Ermenîyan -1915`) or EasyTimeline markup (`start:-1500`, `shift:(-10,5)`).
    //    A general minus rule would therefore be wrong far more often than right.
    //
    //    ⚠ THE WORD IS THE REGISTER CAVEAT. `negatîf` comes from the integers article, applied to the sign's
    //    own operand — *"Mezintirîn tamjimara negatîf **-1** e"* — which is the best citation available and
    //    is still what the number is CALLED rather than a record of what a reader says. Kurmanji has no
    //    FLEURS corpus, so the audio tier that refuted Hindi's `धन` cannot be run. `mînûs` probes ×0;
    //    `neyînî` ×35 is the abstract sense (*paşragihandina neyînî*, negative feedback); `kêm` is the
    //    comparative "less" and takes a whole clause (*"273.15 pileyan ji sifira Selsiyusî kêm"*) — a real
    //    word in the wrong slot, the Fula `hakkunde` failure. Omitting a minus INVERTS the value, so it is
    //    read rather than dropped, and the caveat is recorded rather than hidden.
    // ⚠ U+2212 JOINS THE HYPHEN IN THE SIGN SLOT, AND THE NARROW TRIGGER IS UNCHANGED. The minus is claimed
    // only inside the temperature arm here, for the measured reason above; widening the CHARACTER class does
    // not widen that claim. U+2212's sole Unicode meaning is the arithmetic operator and no keyboard types it
    // by accident, so a `−` before a degree figure is a negative temperature on the same evidence a `-` is.
    const TEMP = String.raw`([-−]?)(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°\s*`;
    const neg = (sg: string): string => (sg ? "negatîf " : "");
    // ⚠ The scale NAME is separate from the degree word and only `Selsiyus` is sourced — the wiki's own
    // article title is *"Pileya Celsius an jî selsiyus … / ºC"*. No Fahrenheit spelling is attested beyond
    // the same article's `Farinhayt`, which is a transliteration inside a comparison, so `°F` gets the
    // degree word and no scale.
    s = s.replace(new RegExp(TEMP + "C(?![\\p{L}])", "giu"),
        (_m, sg: string, n: string) => `${neg(sg)}${n} pile Selsiyus`);
    s = s.replace(new RegExp(TEMP + "F(?![\\p{L}])", "giu"),
        (_m, sg: string, n: string) => `${neg(sg)}${n} pile`);
    // A bare degree — every mined instance is a coordinate, where the direction word (`bakûr`, `rojhilat`)
    // is already spelled out beside it, so only the sign needs a reading.
    // ⚠ The two scale arms are case-INSENSITIVE and this arm refuses a following LETTER, which are the same
    // fix twice. `°c` is ×0 in this corpus, but with a case-sensitive `C` the bare arm claimed `20 °c` and
    // emitted `20 pilec` — a letter FUSED onto the degree word, which is a nonsense token reaching the g2p
    // rather than a merely dropped sign. Trap 7: a class that is not case-insensitive misses half of what
    // it is aimed at, and here the miss was worse than the gap. ⚠ The refusal is ONE letter only, not any
    // letter: the corpus's `carna 40° germ dibe` ("becomes 40 degrees hot") is a degree followed by a WORD
    // and must still read, so only an unhandled SCALE letter (`°K`, `°R`) is left visible.
    s = s.replace(new RegExp(String.raw`([-−]?)(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°(?!\s*\p{L}(?!\p{L}))`, "gu"),
        (_m, sg: string, n: string) => `${neg(sg)}${n} pile`);
    // …and a negative that has already lost its `°` to the two rules above, or that leads a `pile` phrase
    // the corpus wrote out itself (`heta -24 û -30 pileyan`).
    //    ⚠ AND IT MUST REACH BOTH OPERANDS OF A COORDINATED PAIR. `heta -24 û -30 pileyan` writes the
    //    degree word ONCE, after the second number, so a lookahead tight enough to be safe reached only
    //    that one — the first `-24` read as a bare positive, i.e. the sign silently inverted on half the
    //    phrase. The window now allows one intervening `û -N`.
    s = s.replace(
        /(?<![\p{L}\p{Nd}])[-−](\p{Nd}+(?:[.,]\p{Nd}+)?)(?=(?:\s*û\s*[-−]?\p{Nd}+(?:[.,]\p{Nd}+)?)?[^.,\p{Nd}]{0,4}\s?pile)/giu,
        "negatîf $1",
    );
    //    ⚠ ONE MORE ARM, AND IT IS STRING-START ONLY — deliberately narrower than the Hindi shape it copies.
    //    A string that BEGINS `-5` is a negative and the corpus has no counter-example, but the bracket arm
    //    Hindi could take is unavailable here: this corpus's `(`-opening dashes are EasyTimeline label
    //    offsets (`shift:(-10,5)` ×3), which are pixel coordinates in chart markup, not numbers in prose.
    //    ⚠ U+2212 IS IN ALL FOUR ARMS. Every one of them was written with an ASCII hyphen, so the real MINUS
    //    SIGN — the one code point that can only mean the operator — was the single spelling this language
    //    refused. The trigger is unchanged in each: string-start here, a degree figure above, a `pile` phrase
    //    before that. Widening the character class does not widen any claim.
    s = s.replace(/^[-−](?=\p{Nd})/u, "negatîf ");

    // 7) THE DECIMAL SEPARATOR IS REMOVED AND NOT REPLACED, and this is a sourced REFUSAL rather than an
    //    oversight. **No Kurmanji decimal-separator word is attested anywhere this repo can reach**, and it
    //    was looked for properly: `vîrgul` ×1 is a MAGAZINE TITLE (*"Weşanên mîna, Vîrgul, Varlik…"*),
    //    `virgul` ×0, `xal` ×34 is the geometric point — and, in its first hit, the MATERNAL UNCLE
    //    (*"Xal, ji birayê dê re tê gotin"*) — `nuqte` ×1 is that same definition's synonym, `dehî` ×6 is a
    //    hamlet name and "to dedicate", `dehik`/`xala dehiyî`/`hejmarên dehiyî` ×0, `kesr` ×2 is an Arabic
    //    book title. That is a definitive negative (trap 48), and `sources.ts` prescribes this exact
    //    fallback for it: *"no _dpt, no _., no manifest word — read the fraction digit-by-digit"*.
    //
    //    What it buys is the removal of a FALSE CLAUSE BREAK, which is the actual defect: `1,64 m` read
    //    *jˈɛk **,** ʃˈɛʃ ˈuː ʃˈeːst* — a pause inside a number, and the fraction spoken as "sixty-four".
    //    Now it reads "yek şeş çar". The separator's own reading is missing; the number is no longer broken.
    //    ⚠ THE TWO MARKS TAKE DIFFERENT WIDTHS, straight off the table in the header. A COMMA with one or
    //    two digits is a decimal ×58 with no counter-example. A PERIOD is a decimal at one digit (×12,
    //    9 of them genuine) and is NOT one at two (×6: `Ubuntu 6.10`/`6.06` are versions, `27.10-6.11.2003`
    //    is a date, `saet 11.00an` a clock, `36.25–29` a page span — 1 decimal in 6). Using one width for
    //    both read `Ubuntu 6.10` as "six one zero".
    const spell = (whole: string, frac: string): string => `${whole} ${[...frac].join(" ")}`;
    s = s.replace(/(?<![\p{Nd}.,])(\p{Nd}+),(\p{Nd}{1,2})(?![\p{Nd}.,])/gu, (_m, w: string, f: string) => spell(w, f));
    s = s.replace(/(?<![\p{Nd}.,])(\p{Nd}+)\.(\p{Nd})(?![\p{Nd}.,])/gu, (_m, w: string, f: string) => spell(w, f));

    // 8) THE DOTTED ORDINAL — `1. rêbaza kevin … 2. rêbaza Êzidiyan … 3. Rêbaza Botanê`, the German-style
    //    `N.`. `ordinal-latin` is 1,484 in the dump and the period was a CLAUSE PAUSE in every one, so a
    //    numbered list read as a sequence of sentences.
    //
    //    ⚠ THE TRAP-4 TABULATION, because a bare `N.` is also every sentence that ends in a year. All 30
    //    mined `N.` followed by whitespace, split at 31:
    //      N > 31  ×12  ALL sentence-final — `Duhok, 2006.` `Köln 2012.` `Barselona, 1951.` `pp. 67–78.`
    //      N ≤ 31  ×18  fourteen ordinals (`1./2./3./4. rêbaza|helbesta` ×10, `17. Gulan`, `19. Heya`,
    //                   `2. Peyva`, `7.-8. Piştî sedsalan`), three dates (`Di 16. 11. 2006'an de`,
    //                   `14.-15. Oktober`), and ONE sentence end — `r. 24-31. Statuya…`
    //    So the threshold is 31 and the single counter-example inside it is excluded by its own shape: it
    //    is the END OF A RANGE. Requiring whitespace-then-a-LETTER after the dot additionally leaves the
    //    D.M.Y date alone (`16.` is followed by a digit), which is the conservative outcome — Kurmanji
    //    writes a spoken date with the suffix (`2ê sibata`), not with a dot, and step 8 already reads that.
    //    Net: fires ~13 times on the mined evidence with zero counter-examples.
    //
    //    ⚠ IT MUST RUN ABOVE THE SUFFIX RULE, and this is trap 39 pointing the other way — that rule
    //    CREATES letters where digits were. Below it, `Di 16. 11. 2006'an de` had already become
    //    `16. 11. du hezar û şeşan`, so `11.` now saw "whitespace then a letter" and the date's month was
    //    read as an ordinal. Above it, the lookahead sees the original `2006` and declines.
    //
    //    ⚠ Capitalisation is NOT the discriminator, though it looks like one. Both classes take either:
    //    `3. Rêbaza`, `17. Gulan`, `19. Heya` are ordinals before a capital; `1. rêbaza`, `2. rêbaza` are
    //    ordinals before a lowercase; and the sentence ends are followed by capitals too. Only the number's
    //    MAGNITUDE separates them, which is why it was tabulated rather than guessed.
    s = s.replace(
        /(?<![\p{Nd}.,\-–—])(\p{Nd}{1,2})\.(?=\s+\p{L})/gu,
        (whole, digits: string) => (Number(digits) <= 31 ? suffixed(Number(digits), "em") : whole),
    );

    // 9) THE BOUND SUFFIX — and it runs LAST among the number rules, which is a trap-39 ordering and was
    //    found by the artifact scan rather than by reasoning. Placed before the tier (its first position),
    //    it spent the very digit the percent path matches on: `%72yê` became `% heftê û duyê` and the sign
    //    was then orphaned with no numeral beside it, reported as `DROP percent`. A guard's evidence has a
    //    lifetime, and every rule above needs DIGITS while this one destroys them. — the language's defining rule; see the header for the count and the glide.
    //    ⚠ The digit run must not begin inside a word (`C3a`, `C3b` are complement proteins) and the number
    //    is bounded, because `numberToWords` is a compositor and a 12-digit run is not a numeral anybody
    //    speaks — the corpus's longest genuine one is `2456293` (a Julian day).
    s = s.replace(
        new RegExp(String.raw`(?<![\p{L}\p{Nd}.,])(\p{Nd}{1,9})(${SUFFIX_ALT})(?![\p{L}\p{Nd}])`, "gu"),
        (whole, digits: string, suf: string) => {
            const n = Number(digits);
            return Number.isSafeInteger(n) ? suffixed(n, suf) : whole;
        },
    );

    // 10) FOUR CLASSES DECLINED, each with the count that justifies it:
    //    · RANGES (`ranges` ×6,893; 71 digit-dash-digit in the mined segments). Kurmanji writes its own
    //      connective when it means one — `ji 300 mêtre heta 500 mêtreyê`, `di navbera 25 û 30 pile de` —
    //      and the bare dashes are dates (`27.10-6.11.2003`), page spans (`36.25–29`), coordinate spans
    //      (`42°-20´`) and season labels (`2016-2017`). `heta` ×53 is attested as "to" but as a
    //      PREPOSITION taking `ji` (the Fula `hakkunde` shape), so `N heta M` is not the same construction.
    //    · THE CLOCK (`clock` ×725). The corpus's times are written with a PERIOD and a suffix
    //      (`li dora saet 11.00an`), which is character-identical to a decimal and to a version string
    //      (`Ubuntu 6.10`, `Ubuntu 6.06`) and to a date (`27.10-6.11.2003`) — four readings, one shape, and
    //      the two-digit period form is 1 decimal in 6. Left as written; step 8's guard excludes it.
    //    · `=` and `×` (`arithmetic` ×348). The mined `=` are a formula (`E=mc²`, `Formula teoriya
    //      Rolativt jî E=mc² a`) and URL-encoded catalogue parameters (`$003d`); the mined `×` is
    //      scientific notation (`7.2×109 m3`). No Kurmanji reading of either is attested.
    //    · `bareExponent` — `E=mc²` is the only mined superscript with no unit under it, and no Kurmanji
    //      power phrase is attested. The UNIT exponent (`km²` ×28) is read and is what keeps this honest.

    return s;
}
