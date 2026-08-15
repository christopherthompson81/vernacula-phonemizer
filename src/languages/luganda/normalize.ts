/**
 * Luganda / Oluganda (lg) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ NO SHARED SYMBOL TIER IS WIRED, AND THAT IS A MEASUREMENT. Playbook trap 47's second case — "the tier can
 * only POSTPOSE" — is Luganda's ordinary order for every quantity noun it has. The MEASURE NOUN COMES FIRST,
 * without a single counter-example in either source: `mmita 800` ×9, `mmita 5000`, `kiromita 10`, `Kiromita 35`,
 * `kiromita nga 48`, `sentimita 25 ne 60`, `sentimita 150`, `milimita bbiri`, `Kilo 10 okutuuka ku kilo 12`,
 * `ddoola US$29`, `doola 100,000`, `yiika 45,000`, `ddakiika 2:02.38`. Only the PERCENT reading is postposed,
 * and one rule is not worth a second seam. So every unit and currency rule below is local, in the language's
 * own order — the `ki` position, reached independently on this language's own corpus (trap 55).
 *
 * ⚠ THE SOURCING SITUATION, STATED PLAINLY. There is no FLEURS corpus for Luganda; the evidence is
 * `tools/corpus/mined/lg.jsonc` (43,455 paragraphs of the lg.wikipedia dump, 447 retained) plus `attest.ts`
 * against lg.wikipedia — WHICH IS THE SAME WIKI THE ARTIFACT WAS MINED FROM, a bigger sample of one source and
 * never an independent one. espeak does not ship Luganda at all, so `sources.ts` reports `[NONE]` or `[chk?]`
 * for every class it checks. Every word below therefore carries its token/article count AND the sense that was
 * read; where no sense could be read the reading is declined rather than guessed.
 *
 * ⚠ WHAT RESCUES THAT: lg.wikipedia carries a Luganda MATHEMATICS TEXTBOOK, and it states the readings
 * DEFINITIONALLY rather than merely using them. `10/100 = 10% kisomwa ebitundu kumi KU KIKUMI` — *"is read as"* —
 * is a sentence about how the symbol is spoken, which is the thing a written corpus almost never contains
 * (playbook §5e's Igbo lesson). The same article names the degree sign (`Akabonero ka DIGIRI kalagibwa nga "°"`)
 * and glosses the squared word against English (`kiromiita eza KYEBIRIGA (square kilometers)`).
 *
 * ── WHAT WAS BROKEN, with the whole-corpus count from the artifact's own `counts` block ──────────────────────
 *
 *     1,208,544        → *emu , bikumi … , bikumi …*  ONE number read as three, with two pauses  grouped ×1035
 *     4.2              → *ɲːa . bːiɾi*   a SENTENCE BREAK inside a number                       decimals ×1831
 *     83%              → the sign silent                                                        percent ×301
 *     $2.15 · US$700   → the sign silent, and `US` read as the word *us*                        currency ×80
 *     1890–1906        → two cardinals juxtaposed, no connective                                 ranges ×2078
 *     10 cm · 1.5kg    → raw `cm`/`kg` in the phoneme stream                                     units ×129
 *     449 964 km²      → raw `km`, exponent silent                                               exponent ×87
 *     4th ed.          → a raw `th`                                                              ordinal-latin ×5464
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it ────────────────────────
 *
 *   · NO SCALE NAME, SO NO `°C`/`°F` RULE, AND THE WHOLE MATCH IS REFUSED RATHER THAN HALF OF IT (trap 53).
 *     `°C` ×8 and `°F` ×4 in the retained text. `digiri` IS sourced — ×59 tokens / 20 articles, and the
 *     textbook names the SIGN (*"Akabonero ka digiri kalagibwa nga ' ° '"*, "the degree symbol is written as
 *     °") — but `Selsiyasi` and `sentigureedi` are both ×0 on lg.wikipedia and in no other source. Emitting
 *     `digiri` alone would delete the scale while leaving its letter, and `C` is a REAL Luganda grapheme
 *     (⟨c⟩ → /c/, the palatal stop), so `20 °C` would read *digiri … c*: a plausible phoneme with no basis,
 *     which is trap 56 exactly. Nothing changes; `DROP degree ×9` stays red in `mine.ts scan` deliberately.
 *   · NO BARE-`°` RULE EITHER, and this is why the sourced `digiri` still buys nothing. EVERY bare degree sign
 *     in this corpus is a COORDINATE — `latitudi 5°N ne 5°S`, `longitudi 34° ne 42°E`, `02°49'50.0"N`,
 *     `0°29'19.0"N`. There is no angle figure with a plain number anywhere, so a rule would only cut a
 *     coordinate in half. Recorded with the word, for whoever adds coordinates.
 *   · NO CLOCK (`clock` ×450 whole-corpus), and reading the shapes settles it the way it settled `ilo` and
 *     `ki`. Every `N:NN` in the retained text is a SPORTS TIME with the duration noun already in front of it —
 *     `eddakiika 2:02.38`, `eddakiika 1:59.27`, `dakiika 1:45.0`, `(1:57.92)`, `Kiromita 10: 28:42` — plus one
 *     talk-page signature (`20:06, 20 Gwakkuminogumu 2016 (UTC)`) and one dotted date (`17.09.1968`). A
 *     genuine time-of-day is ×0. `ddakiika`/`dakiika` ×33 and `ssaawa` ×3 are attested as NOUNS, but attesting
 *     the noun is not attesting a clock reading. The colon keeps the pause it already was.
 *   · NO ERA PHRASE (`era-marker` ×21; `AD` ×6, `BC`/`B.C.` ×4, `BCE` ×2, `CE`/`C.E.` ×2, `A.D.` ×1). `Kristo`
 *     is attested ×27/19 and `okwa Kristo` is ×0; assembling "oluvannyuma lwa Kristo" from parts would be
 *     inventing a fixed phrase, not composing from an attested one (the Fula `e teemedere` bar is that the
 *     COLLOCATION is attested, and here it is not). Most instances are inside English bibliographic citations
 *     anyway.
 *   · NO INITIALISMS AND NO DOTTED-ABBREVIATION RULE (`initialism` ×9855, `letter-name` ×3695 whole-corpus;
 *     15 dotted runs in the retained text). `core/initialisms.ts` needs a `letterName` table and no in-repo
 *     source carries one for Luganda — espeak does not ship it, so this is a SOURCING gap, not a seam gap
 *     (trap 16 checked, and the seam genuinely cannot be fed). Every retained run is initials inside an
 *     English name — `M.G. Vassanji`, `Y.K. Museveni`, `A.M.K. Bendebule`, `S.R.B.`, `F.C.` — so collapsing
 *     `Y.K.` to `YK` would trade two spurious pauses for a vowel-less cluster.
 *   · NO SHILLING WORD, so `USh` ×4 and `UGX` ×3 are left alone. `siringi`, `ssiringi`, `silingi` are all ×0;
 *     `ssente` ×20 is "money" generally, not the unit. They are LETTERS rather than a `\p{Sc}` sign, so no
 *     gate reports them either way — recorded here so the next reader does not re-source it (ki's `KSh`).
 *   · NO `ha` / `ft` / `mi` / `sq mi` / `km/s`. `hekitaa` and `maili` are ×0 (`ha` ×2); every `ft`/`mi`
 *     instance is an ENGLISH parenthetical glossing a metric figure the sentence has already given —
 *     `3,540 feet (1,079 m)`, `kilometers 333 (207 mi)`, `580,367 km2 (224,081 sq mi)`. `mairo` ×10/7 IS
 *     attested for the mile, and the ×1 `km/s` carries its own Luganda gloss (`186,282 mairo/kasikonda`), but
 *     one instance does not buy a rate idiom and `unitPer` has no candidate here.
 *   · NO MAGNITUDE LETTER (`294M`, `UGX 466M`, `US$10.5M`, `4.5`+`million`). English abbreviation inside
 *     figures this wiki copies from English sources; the Luganda magnitude words (`obukadde`, `obuwumbi`) are
 *     spelled out wherever the language means them, usually in the same sentence.
 *   · NO AMPERSAND WORD (`ampersand` ×1007 whole-corpus). The cell is measuring ENTITIES, which
 *     `core/markup.ts` decodes above this layer (see the note at the top of the function); the BARE
 *     sign is ×3 in the retained text and two are English names (`Zero & Nil`, `Williams & Wilkins`). One is a
 *     Luganda sentence meaning "and" — a single instance is not a rule (ki and sn reached the same place).
 *   · NO `+`, `=`, `×`, `÷`, `<`, `>`, `±` — measured, and the measurements are in
 *     `defects.ts`'s `ACCEPTED_SIGN_SILENCE`. `+` ×7 and not one is an operator (`REDD+`, `CD4+ Tcells`,
 *     three phone country codes `+256…`, and an athletics wind reading `+1.4 m/s`); `plus` ×10/10 on the wiki
 *     is a proper noun every time (*Sauti Plus*, *Coco Plus*, *ASSM Elgeco Plus*), which is trap 37 exactly.
 *     `=` ×19 is 16 infobox parameters (`| abakulembeze = …`) and 3 EasyTimeline directives (`PlotArea =
 *     left:50`) against three real conversions (`9” = 23 cm`); the equals word IS attested — the textbook's
 *     *"25 % … KYENKANA 25/100 oba 0.25"* and the corpus's *"Obunene Buswedi YENKANA 449 964 km²"* — and it
 *     takes NOUN-CLASS CONCORD from its subject (kyenkana ~ yenkana ~ zeenkana), so there is no invariant
 *     infix to emit between two operands. Trap 14, arriving as a reason to decline rather than to convert.
 *     `<` `×` `÷` `±` are ×0 and `>` ×1 is inside a quoted wikitext fragment.
 *   · ⚠ NO MINUS, AND THAT ONE IS A RED GATE RATHER THAN AN ACCEPTED SILENCE — it is deliberately absent from
 *     `ACCEPTED_SIGN_SILENCE`, the ki/ak position. `signed-number` ×143 whole-corpus, and nearly every
 *     retained instance resolves to something else on reading: a RANGE step 3 claims or declines (`50 -60`,
 *     `90 -120`, `3 -4`, `10 cm -15 cm`), a designation (`HIV-1`), a bullet (`–1981 A.M.K. Bendebule`), a
 *     date (`ETAANO -1995`), a superscript exponent (`CCR5 - ^32`). But ONE is a genuine negative quantity —
 *     `(Latitude:-0.214709)`, a southern latitude, where dropping the sign puts the place in the wrong
 *     hemisphere. Omitting a plus is lossless and omitting a minus INVERTS, so this is a sourcing gap with a
 *     real defect behind it, and a class with a reading still to find is a TODO rather than an exemption.
 *     No Luganda negative-number word is attested in any source available here.
 *   · NO FRACTIONS (`fractions` ×280 whole-corpus). No denominator series exists to compose from
 *     (`sources.ts`: `[NONE] fraction-series`), and the retained `N/N` instances are overwhelmingly not
 *     fractions: `2019/2020` and `2015/16` are fiscal years, `4.2/10` and `HIV/AIDS` and `10.1186/1742-4690`
 *     are a score, a name and a DOI, `6/7-13/14` is an age pair. The textbook's own `10/100 = 10%` is claimed
 *     by step 5 through the PERCENT sign beside it, not by a fraction rule.
 */

/**
 * The PERCENT reading, and the best-attested word in this layer — a DEFINITIONAL attestation, which is the
 * strongest kind and the kind a written corpus almost never yields for a symbol.
 *
 * lg.wikipedia's mathematics article states how the sign is READ, three times in one sentence:
 *   *"okukozesa akabonero % : (i) 10/100 = 10% KISOMWA ebitundu kumi KU KIKUMI (ii) 25/100 = 25% kisomwa
 *   ebitundu abiri mu bitaano KU KIKUMI (iii) 50/100=50% kisomwa ebitundu ataano KU KIKUMI"*
 * — `kisomwa` is "is read as". The same article writes *"25 % (kisomwa ebitundu abiri mu bitaano ku kikumi)"*
 * and *"ng'ekitundu ku kikumi"*, and ordinary prose uses it in running text: *"Abantu 75% ku kikumi"*,
 * *"Abantu 15% ku kikumi be balwadde"*, *"Abantu 10% ku buli kikumi"*.
 * `attest.ts` → 38 tokens across 11 articles, `substringOnly` 0.
 *
 * ⚠ IT IS ALSO COMPOSED OF PIECES THIS ENGINE ALREADY OWNS, which is why it cannot be a mis-transcription:
 * `kikumi` is `luganda.jsonc`'s own number word for 100 and `ku` is the ordinary Luganda locative.
 *
 * ⚠ AND THE HEAD NOUN IS ALREADY IN THE TEXT. 28 of the retained corpus's 61 `%` instances are written
 * `ebitundu N%` (*"byaweebwa ebitundu 4.8%"*, *"yawangula n'ebitundu 50.51%"*), so emitting only the sign's
 * own words reproduces the attested sentence exactly — `ebitundu 4.8 ku kikumi` — rather than doubling
 * anything. The other 33 read as *"abantu nga 54.4 ku kikumi"*, which is the bare frame and equally attested.
 */
const PERCENT = "ku kikumi";

/**
 * The RANGE joiner. `okutuuka` ("to reach, up to") with the locative that follows it, and the allomorph is
 * chosen by what the operand IS — both halves attested, in this language, between BARE numerals:
 *   · a YEAR takes `mu` (the temporal locative): *"okutuuka mu 1884 A.D."*, *"bwaliwo okutuuka mu 1969"*,
 *     *"gye yakolera okutuuka mu 1973"*, and 13 instances of the full frame *"okuva mu 2003 okutuuka mu 2013"*.
 *   · a QUANTITY takes `ku`: *"Ku myaka 3 OKUTUUKA KU 5"*, *"Kilo 10 OKUTUUKA KU kilo 12"*, *"bikosa abantu
 *     2% OKUTUUKA KU 5%"*, *"okutuuka ku 2,341 mu 2016"*, *"okutuuka ku UGX 466M"*, *"okutuuka ku myaka 21"*.
 * `attest.ts` → `okutuuka ku` 87 tokens / 20 articles, `okutuuka mu` 104 / 16, `okutuusa` 88 / 20.
 *
 * ⚠ THE PART-OF-SPEECH CHECK THAT SANK FULA'S `hakkunde` PASSES, and it had to be run because the commonest
 * frame in the corpus is the CORRELATIVE `okuva … okutuuka …` ("from … to …"), which would make this the
 * second half of a pair rather than a free infix. Counted in the retained text: 50 instances of
 * `okutuuka`/`okutuusa`, of which 18 have `okuva` within the preceding 25 characters and **32 do not** — and
 * the two bare-numeral attestations above (`myaka 3 okutuuka ku 5`, `2% okutuuka ku 5%`) are both in the
 * second group. It is a free infix, and no `okuva` is invented.
 */
const YEAR_TO = "okutuuka mu";
const NUM_TO = "okutuuka ku";

/**
 * The DOLLAR noun, which this language's order puts BEFORE its amount. `ddoola` → 77 tokens / 20 articles,
 * `doola` → 74 / 20 — the same word, written with and without the class-9 initial geminate; `ddoola` is the
 * citation form and is what the corpus writes beside the sign (*"obukadde bwa ddoola US$29"*, *"obukadde bwa
 * ddoola za Amerika $1.16"*), so it is the one emitted. The sense is monetary in every example read:
 * *"yagabura aba Cranes doola 100,000"*, *"obukadde bwa doola 30 okugula ekisaawe"*, *"doola z'Amerika nga
 * 500,000"*.
 * ⚠ AND THE TRAP-12 GUARD IS DOING MOST OF THE WORK HERE, not the word. 18 of the retained corpus's 27 `$`
 * are `US$` and nearly all of those already have `ddoola` in front of them — the sentence names the currency
 * and then writes the sign, so the correct reading DROPS the sign rather than saying it twice.
 */
const DOLLAR = "ddoola";

/** The EURO noun. `euro` → 12 tokens / 9 articles, and the sense is the currency: every one of the country
 *  infoboxes writes it in the currency slot (*"| nsimbi = Euro | Erinnya lyazo = EUR"*), and running prose has
 *  *"abantu eziri mu Euro ekkumi bbiri mu bitaano mu emu"*. Both retained instances are the parenthetical
 *  conversion beside a dollar figure (`$178k oba €134k`). */
const EURO = "euro";

/** The POUND noun. `pawundi` ×2 in the corpus and BOTH are in this exact slot — *"n'asasulwa pawundi £30 buli
 *  wiiki"* (the sign, with the noun already in front of it) and *"obukade bwa pawundi 100"*. So the ×1 signed
 *  instance is a trap-12 REDUNDANCY, and what this arm buys is that instance NOT being read twice. */
const POUND = "pawundi";

/**
 * The UNIT nouns, all attested with a number after them, which is both the sense check and the order check.
 *   `kiromita`  61 tokens / 20 articles — *"Kiromita 2 okuva ku nkulungo"*, *"kiromita 9 mu buvanjuba"*,
 *               *"Kiromita zaayo 1,300 (mayiro 810) z'enyanja"*, *"kiromita nga 48 mu maserengeta ga Kampala"*.
 *   `mmita`    125 / 20 — *"mmita 5000"*, *"mmita 3000 ne mmita 5000"*, and ×9 in the corpus itself
 *               (*"misinde egya mmita 800"*), all sprint and swimming distances.
 *   `sentimita`  7 / 2 — *"obuwanvu bwa sentimita 25 ne 60"*, *"sentimita 150"*, *"nnyiriri eziri wakati wa
 *               sentimita 30"*. Two articles is thin and is said so; what supports it is that every hit is a
 *               LENGTH with the number in the slot, and the competing spellings `santimita`/`ssentimita` are ×0.
 *   `milimita`   3 / 3 — and one of them is a DIRECT GLOSS of the symbol, in the corpus: *"obuwanvu bwa [2mm]
 *               milimita bbiri"*.
 *   `kilo`      88 / 20 — likewise glossed against the symbol in the corpus: *"abaalina kilo eziri wansi wa
 *               KILO EMU N'EKITUNDU (1.5kg)"*, and used as a bare mass noun throughout a recipe article
 *               (*"Kilo 10 okutuuka ku kilo 12"*, *"Kilo 8"*, *"Omunnyo … Kilo bbiri n'ekitundu"*).
 */
const KILOMETRE = "kiromita";
const METRE = "mmita";
const CENTIMETRE = "sentimita";
const MILLIMETRE = "milimita";
const KILOGRAM = "kilo";

/**
 * The SQUARED modifier, postposed to its unit noun with the class-10 connective `eza`. `kyebiriga` → 93 tokens
 * / 20 articles, and the mathematics article glosses it against English four times in one passage, in exactly
 * this construction: *"(a) miita eza kyebiriga (square meters) (b) kiromiita EZA KYEBIRIGA (square kilometers)
 * (c) mayiro eza kyebiriga (square miles) (d) sentimiita eza kyebiriga (square centimeters)"*, under the
 * heading *"Namunigina za kyebiriga (Square units)"*.
 * ⚠ THE ARTICLE SPELLS THE UNIT NOUNS WITH A LONG VOWEL (`kiromiita`, `miita`, `sentimiita`) WHERE THE CORPUS
 * AND EVERY OTHER ARTICLE WRITE THE SHORT ONE (`kiromita` ×61, `mmita` ×125, `sentimita` ×7). That is one
 * author's orthography, not a different word; the modifier is what this citation is for, and the unit noun is
 * taken from the better-attested spelling. `eza` agrees with all four of those nouns identically (class 10),
 * so it is invariant for the only unit this rule claims.
 */
const SQUARED = "eza kyebiriga";

/**
 * Words this layer must not double when the sentence already carries them — playbook trap 12. Checked on BOTH
 * sides of the figure, because a Luganda measure or currency noun normally PRECEDES its number, so a
 * before-only window would miss nothing and an after-only one would miss everything.
 *
 * ⚠ THE NEEDLE IS WORD-BOUNDED AND CASE-INSENSITIVE, AND BOTH HALVES ARE REPAIRS RATHER THAN CAUTION. This
 * started as `String.includes` and failed in both directions on this corpus's own sentences:
 *   · SUBSTRING — `kilo` is four characters inside `kilometers`, which the header quotes from this corpus
 *     (`kiri ku kilometers 333 (207 mi)`). `kilometers 333 ne 5kg` matched the guard, so the `kg` was
 *     consumed and NO unit noun was emitted: the mass read as a bare number. Silently deleting a reading is
 *     worse than the raw key it was guarding against (playbook trap 10 — a rule that consumes must put back).
 *   · CASE — every one of these nouns is quoted sentence-initially in its own attestation block (`Kiromita 35`,
 *     `Kiromita 2 okuva ku nkulungo`, `Kilo 10 okutuuka ku kilo 12`, `| nsimbi = Euro`), so a case-sensitive
 *     needle misses exactly the capitalized half and doubles it: `Kiromita zaayo 1300 km` → *Kiromita zaayo
 *     KIROMITA 1300*. Trap 7 — a class narrower than the orthography — arriving in a guard rather than a rule.
 *
 * ⚠ AND THE SPELLING VARIANTS ARE PART OF THE NEEDLE, not a nicety. `kiromiita`/`miita`/`sentimiita` are the
 * maths textbook's long-vowel spellings (recorded at SQUARED above), and a guard that cannot see them doubles
 * the noun in exactly the article the readings were sourced from.
 */
function saidNear(full: string, offset: number, end: number, ...words: string[]): boolean {
    const alt = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(/ /gu, "\\s+")).join("|");
    return new RegExp(`(?<![\\p{L}\\p{M}])(?:${alt})(?![\\p{L}\\p{M}])`, "iu")
        .test(full.slice(Math.max(0, offset - 45), end + 45));
}

/** The spelling variants each trap-12 guard must recognise, beyond the word the rule emits. Every one is a
 *  form attested in this corpus or on lg.wikipedia for the SAME noun — see each declaration above. */
const ALSO_WRITTEN: Readonly<Record<string, readonly string[]>> = {
    [KILOMETRE]: ["kiromiita", "kilomita", "kilomiita"],
    [METRE]: ["mita", "miita"],
    [CENTIMETRE]: ["sentimiita", "ssentimita"],
    [MILLIMETRE]: ["milimiita"],
    [KILOGRAM]: ["kiro"],
};

/** The needle list for a unit noun: the emitted spelling plus every variant attested for it. */
const spellings = (noun: string): string[] => [noun, ...(ALSO_WRITTEN[noun] ?? [])];

/**
 * Luganda text normalization. A numbered, ORDER-DEPENDENT sequence; each step states its coupling.
 */
export function normalizeLuganda(input: string): string {
    let s = input;

    // ⚠ THERE IS NO ENTITY-FOLDING STEP HERE, AND THAT IS A MEASUREMENT RATHER THAN AN OVERSIGHT — a step
    //    was WRITTEN, and then deleted for doing nothing. This corpus carries `&#x2013;` ×1 (an EN DASH inside
    //    a year span, `1861&#x2013;1865`), `&#x5B;`/`&#x5D;` ×4 each (the bracketed *okujuliza kwetaagisa*,
    //    "citation needed") and `&nbsp;` ×4, and the `ampersand` cell is ×1007 whole-corpus — so an entity
    //    genuinely does sit between an operand and its dash, exactly where step 3 has to see one. But
    //    `stripMarkup` (`src/core/markup.ts`) decodes EVERY entity at the registry's single dispatch point,
    //    ABOVE this layer, so by the time any rule below runs there is no entity left. The sibling layers that
    //    carry their own fold predate that pass. Verified by deleting the step and re-running the corpus diff:
    //    0 lines moved. A local copy would have typechecked, run, and repaired nothing — and its comment would
    //    have claimed a fix that another file was already making.
    //    Format characters are the same story: `zero-width` ×117 whole-corpus, and `\p{Cf}` is already stripped
    //    upstream, so `kku<U+200B>mi` reaches the tokenizer as one word without help from here.

    // 1) THE ENGLISH ORDINAL SUFFIX (`10th` ×2, `4th` ×1 retained; `ordinal-latin` ×5464 whole-corpus). Luganda
    //    writes its own ordinals as WORDS with a class-agreeing prefix — this corpus has *ekyasa eky'ekkumi*,
    //    *omulundi ogwokusatu*, *Omwezi ogwokuna*, *ekifo ekyokubiri* — so a Latin suffix glued to a digit is
    //    always foreign orthography, and it was reaching the phoneme stream as a bare `th` (the artifact scan's
    //    `LEAK RAW-LATIN th ×2`, from *"(4th ed.)"*). Stripping it is the whole fix; no ordinal morphology is
    //    invented, because Luganda's is already spelled out wherever the language means it. Case-insensitive
    //    (trap 7: a capitalized head is ordinary in titles).
    //    ⚠ FIRST, because the range rule's right guard excludes a trailing letter and would otherwise decline
    //    `1990th-2000th`. A grouped ordinal is unaffected by running above the de-grouping step: `1,000th`
    //    loses its suffix here and its separators at step 3, in either order.
    s = s.replace(/(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 2) RANGES → `okutuuka mu` for a year pair, `okutuuka ku` otherwise (see the declaration for both
    //    attestations and for the part-of-speech check). `ranges` ×2078 whole-corpus; 14 four-digit year spans
    //    and ~20 quantity spans in the retained text. BEFORE steps 4–7, so neither operand has been rewritten
    //    by the time this pairs them.
    //    ⚠ THIS RUNS ABOVE THE DE-GROUPING STEP AND MATCHES A GROUPED OPERAND ITSELF, WHICH INVERTS THE ORDER
    //    EVERY SIBLING LAYER USES, so the reason is worth stating. The playbook's coupling — "digit
    //    de-grouping first, or a grouping comma is read as clause punctuation" — is about the rules that read
    //    a number; this rule reads the SEPARATOR ITSELF as evidence. Whether a four-digit run is a YEAR or a
    //    QUANTITY is exactly what the writer's grouping tells you: nobody writes `1,999` for a year and this
    //    wiki writes `abantu 1,500` for a population. De-grouping first destroys that evidence and leaves the
    //    length test to guess — `abantu 1,000-2,000` then read as *okutuuka MU*, the TEMPORAL locative, on a
    //    population span. So the operand alternation admits the grouped form, the year arm requires the
    //    absence of a separator, and step 3 cleans up whatever this rule emits.
    //    ⚠ ASCENDING ONLY, and in this corpus that guard is what declines three separate real hazards rather
    //    than being defensive habit:
    //      · FOOTBALL SCORES — `balemagana ne 0–0`, `negubeera 1–0`, `bawangula Aizawl F.C. 4-1`. A score is
    //        not a span, and all three are non-ascending.
    //      · THE ABBREVIATED SECOND YEAR — `mu 2008–09`, `(1997–98)`, `mu 1940–41`, `2019/2020`-style fiscal
    //        pairs written with a dash. `2008 > 9`, so they are left exactly as they were; claiming them would
    //        need a century-completion rule this corpus gives no evidence for.
    //      · BIRTH–DEATH LINES whose second operand is a DAY — the `ki` finding, and this corpus has
    //        *"(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)"*, where `1769-5` is descending.
    //    ⚠ `/` IS IN THE LEFT GUARD, which is not inherited from any sibling and is measured: without it the
    //    bibliography's DOI `doi:10.1186/1742-4690-3-72` matches at `1742-4690` — ascending, digit-dash-digit,
    //    with a slash rather than a digit in front. The trailing `-` guard also rejects it, so both halves are
    //    doing the job; the ISBN `978-0-7817-6299-1` is rejected by the leading one alone.
    //    ⚠ A DOT IS EXCLUDED ON THE LEFT ONLY, AND THAT ASYMMETRY IS THE WHOLE OF IT. The DECIMAL range this
    //    rule declines (`0.1–0.4 ha`, `77.0–87.8 °F`) is declined by the LOOKBEHIND — the right operand of
    //    each begins after a dot — so the trailing `.` bought nothing there, and what it cost was every range
    //    that ENDS A CLAUSE: `wakati wa 0–1.` came back untouched and read as two juxtaposed cardinals with
    //    `okutuuka` gone at exactly a sentence end (playbook trap 58, reported by `review.ts`'s `clause-final`
    //    check, and the same one-character guard as lt/mn/et/su/mos). A decimal RIGHT operand is now claimed
    //    and its tail still reaches step 7 whole (`5–13.7 ha` → `5 okutuuka ku 13 7 ha`, the reading step 7
    //    gives that figure anywhere else), so neither operand is damaged — which is the objection this note
    //    used to raise. Admitting a decimal LEFT operand would still mean re-implementing step 7 inside this
    //    rule, and that limit is unchanged.
    //    ⚠ THE COMMA STAYS ON BOTH SIDES. It is this rule's own grouping evidence (see above) and lg writes a
    //    decimal comma too (`7,2`, `5,3` in the artifact), so a trailing `,` can be the start of the right
    //    operand's fractional part. The dot is the character with no defence; the comma has two.
    const GROUPED = String.raw`[1-9]\d{0,2}(?:,\d{3})+|\d+`;
    s = s.replace(
        new RegExp(
            String.raw`(?<![-+−–—/\d.,\p{L}\p{M}])(${GROUPED})[ \u00A0]?[-–—][ \u00A0]?(${GROUPED})`
            + String.raw`(?![-+−/\d,\p{L}\p{M}])`,
            "gu",
        ),
        (whole: string, a: string, b: string) => {
            const na = Number(a.replace(/,/gu, "")), nb = Number(b.replace(/,/gu, ""));
            if (na >= nb) return whole;
            // A four-digit UNGROUPED pair in the era this wiki writes about is a YEAR span, and a year takes
            // the temporal locative `mu`; anything else is a quantity and takes `ku`. Both are attested — see
            // the header. The grouping test is the discriminator this step exists above de-grouping to keep.
            const year = !a.includes(",") && !b.includes(",") && a.length === 4 && b.length === 4 && na >= 1000;
            return `${a} ${year ? YEAR_TO : NUM_TO} ${b}`;
        },
    );

    // 3) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping comma reads as a CLAUSE PAUSE,
    //    so `1,208,544` came out *emu , bikumi bibiri mu munaana , bikumi bitaano …* — one number read as
    //    three, with two pauses. `grouped` ×1035 whole-corpus; 55 comma-grouped, 14 space-grouped and 6
    //    period-grouped figures in the retained text.
    //    ⚠ THIS LANGUAGE'S WIKI WRITES ALL THREE CONVENTIONS, which is Kirundi's finding (trap 55) and the
    //    reason each arm is measured separately here rather than inherited from a sibling.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK and a head starting 1–9, so a leading-zero run is never a grouped
    //    thousand and a digit LIST is never claimed — the maths article's *"digito satu (0,1, ne 2)"* and
    //    *"digito nnya(0,1,2 ne 3)"* are not numbers, and they are the whole of this corpus's `\d+,\d{1,2}`.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d)/gu, (w) => w.replace(/,/gu, ""));
    //    The space-grouped form: `449 964 km²`, `1 244.7 km²`, `570 074`, `429 600`, `154 000`. Same shape,
    //    and it must run before step 6, whose unit key sits immediately after the second block.
    //    ⚠ THE SECOND MEMBER OF EVERY `[ \u00A0]` CLASS IN THIS FILE IS A NO-BREAK SPACE, WRITTEN AS AN ESCAPE
    //    ON PURPOSE. It was originally typed as the literal character and had silently collapsed to a DUPLICATE
    //    ASCII SPACE — `[  ]`, a class that reads as two alternatives and is one. Nothing regressed, because
    //    `stripMarkup` decodes `&nbsp;` to ASCII above this layer (`core/markup.ts` documents that as a
    //    deliberate infidelity for exactly this hazard) and the retained text contains U+0020 and U+000A and no
    //    other whitespace at all — measured, 20,030 spaces, zero U+00A0. It is robustness for a dump that
    //    preserves the raw character, and an escape cannot degrade invisibly the way the literal did.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:[ \u00A0]\d{3})+(?!\d)/gu, (w) => w.replace(/[ \u00A0]/gu, ""));
    //    ⚠ THE PERIOD ARM IS THE RISKY ONE AND ITS EXPOSURE IS MEASURED RATHER THAN ASSERTED. A period-grouped
    //    thousand is indistinguishable from a decimal with exactly three fractional digits, and this rule runs
    //    ABOVE step 7, so a wrong call turns 0.628 into six hundred and twenty-eight. Counted over the retained
    //    text: the pattern matches 6 strings and ALL SIX are the numeral glossary's own entries —
    //    `200.000 Mitwalo abiri`, `300.000`, `600.000`, `700.000`, `900.000`, `1.000.000.000.000.000.000
    //    Kafukunya kamu` — against ZERO three-decimal-place quantities. The 1–9 head is what keeps `0.628`
    //    (an HDI figure in this corpus) out, and it is the guard doing the work: without it that arm would be
    //    a defect generator rather than a fix.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?!\d)/gu, (w) => w.replace(/\./gu, ""));

    // 4) PERCENT → `N ku kikumi`, the one POSTPOSED reading in this layer. `percent` ×301 whole-corpus, 61 in
    //    the retained text.
    //    ⚠ BEFORE step 7, because the reading's operand is the whole number including its decimal tail:
    //    `50.51%` must become `50.51 ku kikumi` and only then be spelled out, or the sign attaches to `51`.
    //    ⚠ AFTER step 3, so `4–5%` and `20–25%` reach this rule as a joined span and the sign lands on the
    //    second operand — which is the shape the wiki itself writes when it spells both out
    //    (*"abantu 2% okutuuka ku 5%"*).
    //    ⚠ THE TRAP-12 GUARD IS REQUIRED HERE AND WAS NEARLY NOT WRITTEN. The corpus never writes both the sign
    //    and the words, but the WIKI does, in the sentences that are this reading's own evidence:
    //    *"Abantu 75% ku kikumi"*, *"Abantu 10% ku buli kikumi"*, *"25 % (kisomwa ebitundu abiri mu bitaano ku
    //    kikumi)"*. Emitting into those would say "per hundred" twice.
    //    ⚠ THE LEFT GUARD IS `(?<![\p{L}\p{M}])` ON THE DIGIT so this cannot bite into a word ending in a digit.
    //    ⚠ THE NEEDLE IS THE COLLOCATION, NOT `kikumi` ALONE, AND THAT IS A REPAIR. `kikumi` is this engine's
    //    OWN cardinal for 100 (`luganda.jsonc`), so keying the guard on the bare word suppressed the reading
    //    whenever a hundred was spelled out anywhere in the window: `abantu kikumi mu ataano ne 25%` lost the
    //    sign outright. On a wiki that routinely writes a figure beside its spelled-out form that is not an
    //    edge case, and the failure is silent — trap 12's guard eating the very reading it exists to protect.
    s = s.replace(/(?<![\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00A0]?%/gu, (w, n: string, off: number, all: string) =>
        saidNear(all, off, off + w.length, PERCENT, "ku buli kikumi") ? n : `${n} ${PERCENT}`);

    // 5) CURRENCY — the noun BEFORE its amount, this language's order (see the header). `currency` ×80
    //    whole-corpus; 27 `$` (18 of them `US$`), 2 `€`, 1 `£` in the retained text.
    //    ⚠ `US$` IS CLAIMED BY ITS OWN ARM FIRST, so the two letters do not reach the g2p as a separate token
    //    reading *us* — the tier's compound-key reasoning (trap 44) applied locally.
    //    ⚠ THE TRAP-12 GUARD IS ON BOTH SIDES AND IT IS THE MAJORITY CASE, not an edge one. This wiki's house
    //    style is to name the currency in Luganda and then write the figure with the sign:
    //    *"obukadde bwa ddoola US$29"*, *"obukadde bwa ddoola za Amerika $1.16"*, *"Obukadde bwa Doola US$10.5M"*,
    //    *"n'asasulwa pawundi £30"*. In every one of those the correct reading DROPS the sign.
    const NAMED_DOLLAR = /d+oola|dolla|doola/iu;
    s = s.replace(/(?<![\p{L}\p{M}])US[ \u00A0]?\$[ \u00A0]?(?=\d)/giu, (w, off: number, all: string) =>
        NAMED_DOLLAR.test(all.slice(Math.max(0, off - 45), off + w.length + 45)) ? "" : `${DOLLAR} `);
    s = s.replace(/\$[ \u00A0]?(?=\d)/gu, (w, off: number, all: string) =>
        NAMED_DOLLAR.test(all.slice(Math.max(0, off - 45), off + w.length + 45)) ? "" : `${DOLLAR} `);
    s = s.replace(/€[ \u00A0]?(?=\d)/gu, (w, off: number, all: string) =>
        saidNear(all, off, off + w.length, EURO) ? "" : `${EURO} `);
    s = s.replace(/£[ \u00A0]?(?=\d)/gu, (w, off: number, all: string) =>
        saidNear(all, off, off + w.length, POUND) ? "" : `${POUND} `);

    // 6) UNITS — the measure noun FIRST, without exception in either source (see the header).
    //    AFTER the ranges (step 3) and BEFORE the decimals (step 7), which is what leaves `1244.7` intact to be
    //    this rule's operand. Longest key first, so `km²` is claimed before the bare `km` arm can see it.
    //    ⚠ `km²`/`km2` — `exponent` ×87 whole-corpus, ×10 retained, and every one is a district-area template
    //    (*"Obugazi: 1 244.7 km²"*) or a country area (*"580,367 km2 (224,081 sq mi)"*). Both spellings, because
    //    this corpus writes both and the ASCII `2` is the worse of the two: it is not a visible leak, it is a
    //    NUMBER, so `580,367 km2` read *"…musanvu km bbiri"* — trap 53's Igbo defect exactly.
    const km2 = (w: string, n: string, off: number, all: string): string =>
        saidNear(all, off, off + w.length, ...spellings(KILOMETRE)) ? n : `${KILOMETRE} ${SQUARED} ${n}`;
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00A0]?km[²2](?![\p{L}\p{M}\d])/gu, km2);
    //    ⚠ THE BARE `km` ARM IS ROBUSTNESS, AND THAT IS SAID RATHER THAN IMPLIED (trap 22). Digit-adjacent `km`
    //    with nothing after it is ×0 in the retained text — every occurrence is `km²`, `km2` or `km/s` — so this
    //    arm repairs no measured defect today. It is here because `kiromita` is the best-attested unit noun in
    //    the language (×61/20) and `km` is a two-letter key with no Luganda word to collide with. The `/` in the
    //    right guard is what keeps `299,792 km/s` out: there is no rate idiom (header).
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00A0]?km(?![\p{L}\p{M}\d²³/])/gu,
        (w, n: string, off: number, all: string) =>
            saidNear(all, off, off + w.length, ...spellings(KILOMETRE)) ? n : `${KILOMETRE} ${n}`);
    //    `cm` ×11 is the largest unit class in this corpus (*"obugulumivu bwa 10 cm"*, *"9” = 23 cm"*,
    //    *"mumabanga ga 30 ku 30 cm"*, *"ekinnya sima 30cm"*), and it was reaching the IPA as /cm/ — ⟨c⟩ is a
    //    REAL Luganda grapheme (the palatal stop), so this is trap 56's silent class rather than a visible leak.
    //    `mm` ×1 and `kg` ×1 are each glossed by their own word in the sentence that contains them, which is
    //    where those two readings come from.
    for (const [key, noun] of [["cm", CENTIMETRE], ["mm", MILLIMETRE], ["kg", KILOGRAM]] as const)
        s = s.replace(
            new RegExp(`(?<![\\d.,\\p{L}\\p{M}])(\\d+(?:\\.\\d+)?)[ \\u00A0]?${key}(?![\\p{L}\\p{M}\\d²³/])`, "gu"),
            (w, n: string, off: number, all: string) =>
                saidNear(all, off, off + w.length, ...spellings(noun)) ? n : `${noun} ${n}`);
    //    ⚠ THE ONE-LETTER `m` KEY IS SPLIT AND NARROWED, ON A COUNTER-EXAMPLE THIS CORPUS ACTUALLY CONTAINS —
    //    which is the strongest form of trap 46's warning, because it is not a hypothetical version string.
    //    All four digit-adjacent `m` in the retained text:
    //        1,079 m   an elevation gloss    ✓ metres
    //        50 m      a swimming style      ✓ metres
    //        100 m     a sprint record       ✓ metres
    //        (1.5m)    ONE AND A HALF MILLION — *"ebinyonyi ebiwerera ddala akakadde kamu n'ekitundu (1.5m)"*
    //    The counter-example is GLUED and DECIMAL and all three true positives are SPACED INTEGERS, so the arm
    //    requires both: a mandatory space and no fractional part. Written the obvious way — `(\d+(?:\.\d+)?)[
    //    ]?m` — it reads a million and a half birds as one and a half metres, a confidently wrong quantity
    //    replacing a merely stray consonant.
    //    ⚠ The same shape also gives the version guard for free: `802.11m` cannot match, because the operand
    //    must be an integer that does not begin inside a number (trap 52 — a lookbehind rejects a POSITION, so
    //    the engine would otherwise simply restart at `11m`).
    //    ⚠ AND ITS RIGHT GUARD MUST NOT CARRY `.` OR `,`, WHICH IS THE SAME MISTAKE STEP 7 DOCUMENTS ONE
    //    SCREEN DOWN. The operand is already an integer with a mandatory space, so `1.5m` and `802.11m` are
    //    excluded by the LEFT side alone; adding `.`/`,` to the right side bought nothing and declined every
    //    CLAUSE-FINAL metre figure instead — `misinde egya 800 m.` came back untouched, leaving a bare `m` in
    //    the phoneme stream, which is precisely the leak this step exists to close. The sibling `cm`/`mm`/`kg`
    //    arms above never carried it, so this arm was the odd one out and the corpus's sentence-final `30 cm.`
    //    read correctly throughout. A guard is only free when it rejects something.
    s = s.replace(/(?<![\d.,\p{L}\p{M}])(\d+)[ \u00A0]m(?![\p{L}\p{M}\d²³/])/gu,
        (w, n: string, off: number, all: string) =>
            saidNear(all, off, off + w.length, ...spellings(METRE)) ? n : `${METRE} ${n}`);

    // 7) DECIMALS, LAST of the numeric rules — steps 3 to 6 all need their number intact. The separator was
    //    reaching `clausePunctuation` and becoming a SENTENCE BREAK inside a number: `1 244.7 km²` read
    //    *… lukumi mu bikumi bibiri mu amakumi ana mu nnya . musanvu*. `decimals` ×1831 whole-corpus, 118 in
    //    the retained text — this layer's largest cell.
    //    ⚠ NO SEPARATOR WORD IS EMITTED, AND NONE IS SOURCEABLE. `sources.ts` reports `[NONE] decimal-point`;
    //    espeak does not ship Luganda; `poyinti`, `poyint`, `poyintu`, `pesenta`, `pesenti`, `persenti` are ALL
    //    ×0 on lg.wikipedia (probed, and recorded in `tools/corpus/attest/lg.jsonc` so the next reader does not
    //    repeat it). The mathematics article that names the percent sign and the degree sign does not name this
    //    one. So the fractional digits are read ONE AT A TIME with no separator — Lingala's and Kikuyu's
    //    resolution, and what `sources.ts` itself prescribes for this case. What is being fixed is the spurious
    //    PAUSE and the mis-read tail, not the missing word: reading `7` in `1244.7` as a NUMBER is right, but
    //    reading `15` in `2.15` as one would say *kkumi na ttaano*, a different quantity.
    //    ⚠ THERE IS NO COMMA ARM, and that is measured rather than inherited. The sibling Bantu layers have one
    //    because their corpora carry the SI decimal comma; this one does not. `\d+,\d{1,2}` occurs 4 times in
    //    the retained text and 3 are the maths article's DIGIT LISTS (`(0,1, ne 2)`, `(0,1,2 ne 3)`) against 55
    //    comma-GROUPED thousands. A comma arm here would claim the lists and almost nothing else; the comma
    //    keeps the pause it already was.
    //    ⚠ THE GUARDS EXCLUDE A MULTI-DOT RUN on both sides, which leaves the dotted DATE `17.09.1968` and the
    //    version-like `802.11a` alone, and a TRAILING LETTER, which leaves a dotted designation out.
    //    ⚠ BUT THE TRAILING DOT GUARD IS `\.\d`, NOT A BARE `\.`, AND THAT DISTINCTION IS THIS CORPUS'S
    //    COMMONEST DECIMAL. The eight district-area templates all end a sentence on the figure —
    //    `Obugazi: 1 244.7 km².`, `600.2 km².`, `2 455.3 km².` — so a bare `(?!\.)` reads the SENTENCE PERIOD as
    //    the start of a second dot run and declines the decimal it was written for. Only a dot followed by a
    //    DIGIT is a multi-dot run; a dot followed by anything else is punctuation, and the pause it makes is
    //    correct. Found by probing the corpus's own line rather than by a unit test on a bare number.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d,\p{L}\p{M}]|\.\d)/gu,
        (_m, int: string, frac: string) => `${int} ${[...frac].join(" ")}`);

    return tidy(s);
}

/** ⚠ A padded replacement doubles a space that was already there and can leave one at an edge. SLOT-GAP is a
 *  corpus-diff defect class; this pass may not feed it. */
function tidy(s: string): string {
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
