/**
 * Kirundi / Ikirundi (rn) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * Evidence: `tools/corpus/mined/rn.jsonc` (4,125 paragraph segments from an rn.wikipedia dump; the 374-line
 * hard+sample artifact is what every count below is measured over) and `tools/corpus/attest/rn.jsonc`. rn has
 * no FLEURS corpus and espeak ships no Kirundi at all, so the artifact, the referee word list and `attest.ts`
 * against rn.wikipedia are the whole haystack.
 *
 * ⚠⚠ KINYARWANDA (`rw`) IS NOT A SOURCE FOR KIRUNDI, AND THIS FILE IS THE PROOF. The two are mutually
 * intelligible and rn borrows rw's number COMPOSITOR (`composeRwandaRundi`), so rw's layer — written one day
 * earlier — was the obvious template. Every rule in it was re-measured against rn's own corpus instead, and
 * the results diverge in seven places, one of which would have shipped a confidently wrong reading:
 *
 *   SQUARED     rw `kare`          rn **`kwadarato`**   corpus 36:1, wiki 29/20, slot probe ×3 no competitor.
 *                                                       In Kirundi `kare` is the ADVERB "early" (`hakiri
 *                                                       kare`, 20 wiki hits / 15 articles). Burundi's
 *                                                       francophone borrowing (*quadrat*), and porting rw's
 *                                                       table would have read every area figure as "early".
 *   CLOCK       rw `saa`+durations rn **none**          `saa`/`isaha`/`amasaha`/`iminota`/`amasegonda` are
 *                                                       ×0 in rn's corpus and all 6 colon runs are BIBLE
 *                                                       VERSES. rw had 9 race durations and 2 marked clocks.
 *   RANGE       rw `kugeza kuri`   rn **`gushika`**      and all 14 rn spans are YEAR/reign spans; rn has no
 *                                                       measurement span at all, so rw's unit-hoisting arm
 *                                                       has zero instances here and is not written.
 *   COMMA       rw 15 grp : 14 dec rn **27 grp : 2 dec** and rn also writes the ANGLO `1,964.54` (×9) beside
 *                                                       the French `12.100.000` (×23) and space grouping (×7).
 *   ONE-LETTER  rw declares m,g,l  rn **declares none**  rn writes the locative elision `50 m’ubumwe` — the
 *   UNIT KEYS                                           very Chichewa hazard rw checked and found ×0 in
 *                                                       Kinyarwanda. In rn it is ×1 and metre is ×0.
 *   COORD GUARD rw needs NOT_COORD rn **none needed**    rw's `1.867 ° S` decimal coordinates are ×0 in rn,
 *                                                       which writes `9°55'` — degree and arcminute.
 *   MINUS       rw reads a NEGATIVE rn **reads none**    see the refusal list; rn's one negative temperature
 *               TEMPERATURE                              is already glossed by `munsi ya` in its own sentence.
 *
 * What the engine did before this file existed (probed, not assumed — playbook step 2):
 *
 *     30%            → miɾoŋo itatu                the % DROPPED                         15 in the corpus
 *     12.100.000     → it͡ʃumi na kabiɾi . id͡ʒana … grouping periods = TWO SENTENCE BREAKS  138 grouped
 *     1,964.54       → ɾimwe , … . miɾoŋo itanu …  comma = clause pause, dot = full stop  145 decimals
 *     606km²         → amad͡ʒana atandatu … km      ² dropped, `km` reaches the IPA RAW      24 exponent
 *     3.287.263 km2  → … km kabiɾi                 the ASCII exponent read as "two"
 *     km² 517        → km amad͡ʒana atanu …         unit before the number — invisible to the tier
 *     (233/km²)      → amad͡ʒana abiɾi … km         a bare denominator, exponent dropped
 *     0,6 ° C        → zeɾu , ɡatandatu t͡ʃ         ° dropped, the scale letter read as [t͡ʃ]  7 degrees
 *     dogere 22/25   → doɡeɾe … miɾoŋo ibiɾi …     the `/` span joiner silently dropped
 *     1884-1885      → two bare cardinals          the span joiner dropped                 49 ranges
 *     26.08.1940     → … . umunani . iɡihumbi …    a DOTTED DATE = two sentence breaks
 *     11:22          → it͡ʃumi na ɾimwe , …         `:` is clausePunctuation → a pause in a verse reference
 *     U.S.A.         → u . s . a .                 three sentence breaks in one token     262 abbrev
 *     R & D          → ɾ d                         the & DROPPED                           10 ampersand
 *     US $ 4,000     → us kane , zeɾu              sign dropped, grouping comma = a pause    3 currency
 *
 * ⚠ THIS FILE OWNS THE SHARED-TIER CALL, because rn needs rules on BOTH SIDES of it and no fixed order works:
 *   · DE-GROUPING must run BEFORE the tier. rn's whole `version-dot` cell — 12 instances — is grouped
 *     thousands glued to an abbreviation (`357.588km²`, `17.600hab`, `83.497.147hab`), and the tier's
 *     `NOT_VERSION` guard (`802.11g` is not eleven grams) rejects exactly `\d+[.,]\d+[a-zA-Z]`, so those
 *     kilometres are refused. De-grouped first, `357588km²` reads. Same coupling rw records, at 6× the count.
 *   · THE DECIMAL SPELL-OUT must run AFTER the tier, or the tier sees `196 7 km²` and there is no number
 *     beside the sign.
 * Neither the Xhosa order (`SYMBOLS(normalize(x))`) nor the Chichewa one (`normalize(SYMBOLS(x))`) satisfies
 * both, so the sequence is written out here — the shape 34 other languages now use.
 *
 * ⚠ TRAP 14/15 DOES NOT ARISE, measured rather than assumed. `digit + space + short token` in the artifact is
 * `z'` ×4, `na` ×4, `hab` ×4, `n'` ×3, `kw'` ×2, `y'` ×2, `m'` ×1 — ordinary particles and elisions standing
 * as WORDS, never a detached bound morpheme, and `digit-hyphen-letter` is ×0. So every rule below may leave
 * its operand as DIGITS, which is also what keeps the tier's number↔unit adjacency alive.
 *
 * ⚠ AND THE CONCORD-INSIDE-A-NUMERAL QUESTION IS SETTLED ELSEWHERE, checked rather than re-opened. rn's
 * per-magnitude multiplier series (`mirongo ibiri` / `amajana atanu` / `ibihumbi bibiri`) lives in
 * `numbers.ts` + `kinyarwanda/numbers.ts`'s `composeRwandaRundi`, is committed and tested, and is the ONE
 * thing rn shares with Kinyarwanda. Nothing here touches it.
 *
 * Deliberately not done, each with its measurement:
 *   · NO CLOCK AND NO DURATION RULE. rw's step 6 does NOT survive re-measurement. `saa` ×0, `isaha` ×0,
 *     `amasaha` ×0, `iminota` ×0, `amasegonda` ×0 in rn's corpus; all 6 colon runs are BIBLE VERSE references
 *     (`11:22`, `9:31`, `12:22/24`, `16:16`, `19:3\7`, `2:38\41`) plus one wiki-signature timestamp
 *     (`19:09, 27 Ruhuhuma 2023 (UTC)`). Zero clocks, zero race durations. `amasaha`/`iminota` ARE attested on
 *     rn.wikipedia (`amasaha mirongo ibiri n'ane`, `iminota 15`) but never against a colon shape, and the
 *     playbook's `sports-time` class has no attested Kirundi reading. Step 6 spends the colon on a space so a
 *     verse reference stops being two clauses, and invents nothing.
 *   · NO DECIMAL-SEPARATOR WORD. `sources.ts` reports `[NONE] decimal-point` for rn — no espeak (Kirundi is
 *     not shipped at all), no `_dpt`, no manifest word. The separator is removed and the fractional digits are
 *     read one at a time.
 *   · NO FAHRENHEIT NAME. `farenheti` is 0 tokens / 0 articles on rn.wikipedia and `°F` is ×0 in the corpus.
 *     Nothing to read; nothing invented.
 *   · NO EURO, NO BURUNDIAN-FRANC KEY. `€` is ×0 and `FBu`/`BIF` are ×0 in the corpus, so neither sign is
 *     written and neither name is needed (the playbook's rule: a currency name is checked only if its SIGN is
 *     in the corpus). For the record the franc IS sourceable if a sign ever turns up — Kirundi running text
 *     distinguishes `ifaranga ry'Uburundi` (the currency as an institution) from `amafaranga y'amarundi` (an
 *     amount beside a figure) — but declaring an unused key is exposure for nothing.
 *   · NO `amafaranga` FOR THE DOLLAR, though it is the best-attested money word in the corpus (14 hits / 11
 *     articles). It means money/fee GENERICALLY, and its own example sits BESIDE a dollar amount rather than
 *     translating it: `amafaranga yagenwe ya US $ 4,000`, "the fee set at US$4,000". That is the Fula
 *     `hakkunde` shape — a real word that does not fit the slot.
 *   · NO GENERAL MINUS, AND NO NEGATIVE-TEMPERATURE ARM EITHER — this is where rn parts from rw. rw reads
 *     `−27.2 °C` as "… munsi ya zeru" on the strength of two rw.wikipedia attestations of that phrase. Those
 *     are KINYARWANDA citations and are not usable here. rn's corpus has exactly one negative number,
 *     `hakaba hakonje cane (nko munsi ya -39°C)` — and its sentence ALREADY carries `munsi ya` ("below"), so
 *     the rw reading would emit the phrase twice. The other minus is `(Kindergaten –2ème année)`, a FRENCH
 *     grade range. No Kirundi word for the sign is attested in the corpus, the referee list or on
 *     rn.wikipedia. ⚠ THIS LEAVES `review.ts --lang rn` RED ON THE MINUS ON PURPOSE (trap 24): omitting a
 *     minus INVERTS where omitting a plus is lossless, so a permanently visible defect is the honest state.
 *   · NO `+` RULE (×2). Both are Wikipedia PORTAL SIZE MARKERS — `+1 000 000 : English · Deutsch · Français`
 *     and `+100 000 : Nederlands · Polski` — i.e. "wikis with over a million articles". Not arithmetic, and
 *     the playbook's fleet-wide finding is that no language attests a spoken plus in running text.
 *   · NO `=` `×` `÷` `±` `<` `>` RULE. All six are **×0** in the artifact, and no Kirundi word for any of them
 *     is attested anywhere. Recorded so the absence is a measurement rather than an oversight (trap 25).
 *   · NO `hab` UNIT. The French abbreviation *habitants* is glued to digits ×9 (`20.764hab`, `3372 hab/km²`)
 *     and already reaches the g2p as a readable word. It is also REDUNDANT: every instance sits under the
 *     infobox label `Abanyagihugu:` ("inhabitants"), which says it in Kirundi already — trap 12. Translating a
 *     French abbreviation into a Kirundi noun is not this layer's job.
 *   · NO FRACTION RULE. `sources.ts` reports `[NONE] fraction-series` — no denominator series to compose from.
 *     The `fractions` cell's 12 instances are the six dd/mm/yyyy dates and the rate denominators, not fractions.
 *   · NO LETTER NAMES, so no initialisms (224 in the corpus). `core/initialisms.ts` needs a `letterName`
 *     table; espeak ships no Kirundi and no in-repo source carries one, so wiring the pass would be a NO-OP.
 *     A sourcing gap, not a seam gap (trap 16 checked, and the answer here really is "no data").
 *   · NO MONTH TABLE FOR THE DOTTED DATE. Kirundi writes dates with a month NAME (`itariki 10 nzero 1932`,
 *     `Ku wa 1 Mukakaro 1962`), so `26.08.1940` could in principle become one. Step 2 only spends the dots.
 *     The corpus GLOSSES its own numeric date — `Ku wa mbere Mukakaro 1962 (01/07/1962)` — and the slash form
 *     already reads as three numbers, so reading the dotted form the same way is consistent rather than
 *     inventive. Authoring a twelve-month table off infobox text is exactly the bulk data invention the
 *     playbook forbids.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";

/** The manifest's own conjunction — the number joiner (*icumi NA umunani*, ×178 in the artifact), reused for
 *  `&`. Read from the manifest so the two can never drift apart. */
const AND = MANIFEST.numbers.and;

/**
 * THE MEASURE NOUNS, one table shared by the tier (step 7, number-then-unit) and by step 4 (unit-then-number,
 * which the tier cannot see). Both words are rn.wikipedia tokens read in the number slot, and both PRECEDE
 * their figure.
 *
 *   ibirometero  20 hits / 20 articles   ★ THE CORPUS GLOSSES ITS OWN ABBREVIATION IN A PARALLEL SENTENCE.
 *                                        Two commune infoboxes write the identical clause, one with the
 *                                        symbol and one with the word: `ikaba ifise km 1,965 kandi ituwemwo
 *                                        nabantu 172,477` (Cankuzo) against `ikaba ifise ibirometero 1,960
 *                                        kandi ituwemwo n'abantu 430,899` (Bubanza). That is an in-corpus
 *                                        translation of `km`, not an inference.
 *   milimetero    4 / 4                  `milimetero 1.086`, `(milimetero 154)`, `(milimetero 3)`,
 *                                        `milimetero 800` — every one PREFIXED; and the corpus writes the
 *                                        symbol form `mm 1.000` and `mm 1,200 / 1,400 mm`.
 *
 * ⚠ NO ONE-LETTER KEY IS DECLARED, and this is where rn takes the OPPOSITE decision from Kinyarwanda. rw
 * declares `m`, `g`, `l` and records that "rw writes NO word-internal apostrophe after a digit (`\dm['’]` is
 * ×0, unlike Chichewa's locative `m'` which cost nya this very key)". **In Kirundi the elision IS there** —
 * `N’izihe ntara zibiri zigira 49 na 50 m’ubumwe bwa Leta Zunze Ubumwe bwa Amerika`, where `m'` is the
 * locative and not a metre. Digit-adjacent `m` in rn is ×1 and that is the one; meanwhile `metero` is spelled
 * OUT in all six of its wiki attestations (`metero 1214`, `Metero 1 539`, `metero 1330`, `Metero 1 566`,
 * `Metero 1 265`, `Metero 1 543`). So the key would buy zero true positives and risk one false one. Trap 46's
 * "withdraw the key where it buys nothing", decided by rn's own corpus rather than by rw's.
 * ⚠ `cm` `kg` `g` `l` `ha` `t` ARE NOT DECLARED EITHER: each is digit-adjacent ×0 in rn AND its Kirundi noun
 * is ×0 in both the corpus and the wiki probe. Nothing to gain, and a wrong unit is worse than a silent one.
 * ⚠ THE RESIDUAL COST rw RECORDS DOES NOT APPLY HERE. `NOT_VERSION`'s inner `(?![a-zA-Z\d])` only fires on a
 * ONE-letter trailing key, so rn's genuine decimal-plus-unit `196.7km²` reads correctly — precisely because
 * `km` is two letters and because no one-letter key is declared.
 */
const UNIT: Readonly<Record<string, string>> = {
    km: "ibirometero",
    mm: "milimetero",
};

/**
 * ⚠ THE SINGULAR OF THE KILOMETRE NOUN, for DENOMINATOR position only — and the noun class is the whole
 * point. Kirundi puts the class-8 plural on a quantity (`Ibirometero kwadarato 1,089`, ×31) and the class-7
 * singular after the per-unit connective (`Abantu 542 ku kirometero kwadarato`, `102 personnes ku kirometero
 * kwadarato`, `abantu … ku kirometero kwadarato (3372 hab/km²)`, wiki 20/20). Step 8 uses this one; the tier
 * uses the plural above. Both forms are attested in their own slot, which is why the table is not one entry.
 */
const UNIT_SG: Readonly<Record<string, string>> = {
    km: "kirometero",
    mm: "milimetero",
};

/**
 * SQUARED — `kwadarato`, and it is the single most important finding of this run.
 *  · corpus: `(i)birometero|kirometero + kwadarato` ×36 against `+ kare` ×1.
 *  · rn.wikipedia: `kwadarato` 29 hits / 20 articles, every one the area line of a place article —
 *    `Ibirometero kwadarato 695.52`, `Ibirometero kwadarato 61,19`, `ku kirometero kwadarato ( 1km²)`.
 *  · the SLOT probe closes it from the other side: `attest.ts --after ibirometero,kirometero` returns
 *    `kwadarato ×3` and NO competitor at all (trap 40's instrument).
 * ⚠ TRAP 37 IS LIVE, AND IT IS rw's OWN WORD THAT FAILS IT. Kinyarwanda's `kare` scores 20 hits / 15 articles
 * on rn.wikipedia and every one of them is the ADVERB "early" — `hakiri kare`, `kuyifata kare`, `kwivuza
 * hakiri kare`. The single `kilometero kare` hit is the CANADA article: one hit, one article, a lead and not
 * a finding. Porting rw's table unmeasured would have read every Kirundi area figure as "early kilometres".
 * ⚠ NO CUBE WORD IS DECLARED. `m³` and `km³` are ×0 in rn and no Kirundi cube word is attested — the trap 51
 * floor, recorded rather than guessed.
 */
const SQUARED = "kwadarato";

/**
 * DEGREE VOCABULARY.
 * · `dogere` — corpus ×2 beside the sign itself (`ni ukuvuga nka dogere 22/25 ku mutaga`, `ubushuhe ntarengwa
 *   buri hagati ya dogere 29`); rn.wikipedia 9 hits / 4 articles — `dogere 20`, `(dogere 25)`, `(dogere 18)`,
 *   `dogere zigera kuri 35 zubushuhe`. PREFIXED in every attestation.
 *
 * ⚠⚠ NO SCALE NAME IS EMITTED FOR EITHER `°C` OR `°F`, AND THIS IS THE SECOND rw RULE THAT DID NOT SURVIVE
 * RE-MEASUREMENT. rw reads `°C` as `dogere selisiyusi`. Four independent measurements say Kirundi should not:
 *   · `selisiyusi` is **×0 in rn's corpus**, and `sources.ts` reports `[NONE] scale-names` for rn.
 *   · On rn.wikipedia it is 2 hits in ONE article — a LEAD, not a finding — against **bare `dogere` in 6**
 *     temperature instances across 4 articles (`dogere 20`, `(dogere 25)`, `(dogere 18)`, `dogere zigera kuri
 *     35`, `dogere 29`, `dogere 22/25`). rn's own writing reads a Celsius temperature as bare `dogere` 6
 *     times out of 8.
 *   · Independent Kirundi running text (VOA *Radiyo Yacu*, Burundi desk) writes **`degre Celsius`** —
 *     "igipimo ca degre Celsius 40", "iri mu bushuhe buri ku rugero rwa degre Celsius 43" — and NOT
 *     `selisiyusi`. ⚠ Every `dogere selisiyusi` article in that corpus is KINYARWANDA, identified by
 *     `ubushyuhe` / `cyangwa` / `kugeza` against Kirundi `ubushuhe` / `canke` / `gushika`. So the word this
 *     layer would have inherited is, on the best available evidence, the Rwandan form.
 *   · And the Burundian alternative CANNOT BE EMITTED ANYWAY: this g2p reads ⟨c⟩ as [t͡ʃ], so writing the
 *     Latin `Celsius` into the text would produce [t͡ʃelsius] — replacing a dropped sign with a mangled
 *     spelling, which is a new defect rather than a fix (trap 6's family).
 * So the scale LETTER is claimed — it cannot reach the g2p as a phoneme, which is the defect that mattered
 * ([t͡ʃ] for `C`) — the degree is spoken, and the scale is left unsaid rather than borrowed. Exactly the
 * stance rw takes for Fahrenheit, applied here to both scales because rn's evidence points the same way for
 * both.
 */
const DEGREE = "dogere";

/**
 * THE DOLLAR — `amadorari` (class 6 plural; singular `idorari`), and it is this run's cleanest instance of
 * TRAP 40: **a word-first probe cannot find a spelling you did not guess.**
 *
 * The first pass probed `amadolari` — Kinyarwanda's spelling, with ⟨l⟩ — got **0 tokens / 0 articles** on
 * rn.wikipedia, checked `idolari`, `amayero` and `ifaranga` for good measure (all 0/0), and wrote the sign
 * off as unsourceable. That refusal rested on SILENCE, which the playbook says needs a dictionary check
 * first (the Igbo `ǹtụ̀kpọ` lesson). The check overturned it, and the reason is orthographic:
 *
 *   ★ **KIRUNDI HAS NO ⟨l⟩.** rn.wikipedia's own `Ikirundi` article reproduces the resolutions of the third
 *     Kirundi teachers' orthography conference (Bujumbura, 29 Myandagaro – 2 Nyakanga 1983, Kaminuza
 *     y'Uburundi + Bureau d'Éducation Rurale). Its l/r table rules on THIS EXACT WORD:
 *     *INGORANE l/r · UTURORERO: Amadolari/Amadorari · IRYAPFUNDITSWE: **Amadorari** · IMVO: "Mu kirundi iryo
 *     jwi ryegereye r gusumba l"* — "in Kirundi that sound is closer to r than to l". The phoneme inventory
 *     printed above it contains no `l` at all.
 *   · A published bilingual dictionary (NSW Dept. of Education, *English–Kirundi*) gives `dollar` →
 *     `amahera y'idorari`, with the example sentences `nivy'amadorari atanu` ("it's five dollars") and
 *     `kuva ku madorari cumi` ("from ten dollars").
 *   · Kirundi running text: VOA *Radiyo Yacu*'s Burundi desk writes `idorari ry'Abanyamerika rirushirije
 *     kuduga agaciro` and `ingabire y'imiliyoni 6 z'amadorari` — 29 tokens over 16 Kirundi-classified
 *     documents for the plural, 15/5 for the singular.
 *
 * ⚠ AND THE IN-REPO PROBE IS STILL NEARLY SILENT, WHICH IS SAID RATHER THAN HIDDEN. `attest.ts --lang rn
 * --words amadorari` returns exactly **1 hit in 1 article**, and reading it disqualifies it: *"binjije
 * amadorari ibihumbi 50 **cyangwa** arenga"* — `cyangwa` is Kinyarwanda (Kirundi is `canke`), so that
 * sentence is Rwandan text inside rn.wikipedia. Trap 34, caught by reading the example rather than the count.
 * The word stands on the orthography ruling, the dictionary and the Burundi-desk text, not on that hit.
 * ⚠ POSITION IS PREFIX, like every other measure noun in this language: `amadorari atanu`, `ku madorari
 * cumi`, `amafaranga y'Amarundi 3,300` — the noun heads its figure.
 * ⚠ THE SIGN IS ONLY ×4 IN THIS CORPUS AND TWO ARE ENGLISH (`Croatia's GDP is 104 000 000 000 $`), so this
 * rule is worth little on rn's own text; it is declared because the word is sourced, not because the count
 * demanded it.
 */
const DOLLAR = "amadorari";

/**
 * THE SPAN JOINER — `gushika` ("until"), and it takes TWO SHAPES depending on what is being spanned.
 *
 * ⚠ THIS IS A PART-OF-SPEECH QUESTION, NOT A WORD-EXISTENCE ONE — the Fula `hakkunde` lesson, where a real
 * word turned out not to fit the slot. `gushika` is ×20 in rn's artifact and 38/20 on rn.wikipedia, but every
 * digit-flanked instance in BOTH sits inside a `kuva …` frame, which left the bare-infix question open. It
 * was settled against a ~370-document Kirundi corpus built from VOA *Radiyo Yacu*'s Burundi desk (each
 * document language-classified by Kirundi `canke / cane / vy- / ico` against Kinyarwanda `cyangwa / cyane /
 * by- / icyo`, because that service is joint and its markup claims `lang="rw"`):
 *
 *   · **BARE `N gushika M` IS THE MAJORITY USE** — 354 `gushika` tokens, only ~58 with a `kuva` in the
 *     preceding 90 characters. Attested between figures with no "from" word at all: `ku matariki ya 15
 *     gushika 17`, `ibilometero 26 gushika kuri 28`, `iminsi 7 gushika ku ndwi zitatu`, `gushika kuri 33`.
 *     So the connective IS infix-capable, and `kuri` is the form that precedes a bare cardinal.
 *   · **BUT A FOUR-DIGIT YEAR SPAN IS UNANIMOUS THE OTHER WAY** — 14 of 14 carry `kuva`, and there are ZERO
 *     instances of `1987 gushika 1993` standing alone. The corpus's own sentence is literally this run's
 *     example: `kuva mu mwaka w'1987 gushika mu mwaka w'1993, ubwa kabiri hari kuva mu mwaka w'1996 gushika
 *     mu mwaka w'2003`. The second member may drop its `mu`; the first never drops its `kuva`.
 *
 * Hence two joiners, chosen by whether both operands are four-digit years. This matters here because ALL 14
 * of rn's hyphen spans are year or reign spans and all 5 of its slash spans are measurements — the corpus
 * puts each shape in exactly the frame its own idiom wants.
 * ★ AND THE SOURCES GLOSS EACH OTHER. rn's corpus writes `umukuru w'igihugu c'Uburundi (1987—1993 na
 * 1996—2003)`; the VOA sentence above states the same two Buyoya terms in prose with `kuva … gushika`. The
 * dash and the words are the same fact in one language, which is the strongest attestation this run found.
 */
const FROM = "kuva";
const UNTIL = "gushika";
/** The bare-infix form, for a span that is NOT a pair of years — `ibilometero 26 gushika kuri 28`. */
const UNTIL_AT = "gushika kuri";
/** The connective between two TEMPERATURES, which Kirundi does not span with `gushika`: the corpus writes
 *  `hagati ya 17°C na 29°C` and rn.wikipedia `dogere selisiyusi 20 na 25` — both put the plain conjunction
 *  between the two figures under one degree noun. Read from the manifest so it cannot drift from the
 *  numeral joiner. */
const DEGREE_AND = MANIFEST.numbers.and;

/** The per-unit connective — `kuri`/`ku`, ×25 in the artifact and the word the corpus itself puts in front of
 *  a bare denominator: `Abantu 542 ku kirometero kwadarato`, `Abantu ijana na babiri (102 personnes) ku
 *  kirometero kwadarato ( 1km²)`, `abantu … ku kirometero kwadarato (3372 hab/km²)`. */
const PER = "kuri";

/**
 * The shared symbol tier. Sourcing for every word is in the tables above; what follows is why each FIELD is
 * set the way it is.
 *
 * · `percent` / no `percentPrefix` — `kw'ijana`, POSTPOSED. Corpus ×7, rn.wikipedia 11 hits / 8 articles.
 *   ★ ATTESTED IN THE BARE NUMBER SLOT, not merely after the noun `ibice`: `Aho yashitse mu kibanza ca 2
 *   anaronka amajwi 24,4 kw'ijana` and `Evariste Ndayishimiye, yaronse 68,7 kw'ijana` — a DECIMAL followed
 *   directly by the word, which is exactly the shape this rule emits. The corpus's own redundant pairs
 *   corroborate the position: `ibice mirongo icenda kw'ijana (90%)`, `ibice bitatu kw'ijana (3%)`, `bane
 *   kw’ijana (4%)`, `ibice mirongo ine kw'ijana (40%)`.
 *   ⚠ rw's spelling `ku ijana` is **×0** in rn. Kirundi writes the elided form in 7 of 7 corpus instances and
 *   11 of 11 wiki ones; the engine's TOKEN splits on the apostrophe, so it reads as the two-token elision the
 *   orthography intends.
 * · `currency` / `currencyPrefix` — `amadorari`, PREFIXED; see DOLLAR above for the 1983 orthography ruling
 *   that sourced it and for why the first probe returned a false negative. Both the bare `$` and the compound
 *   `US$` key are declared, because the corpus writes `US $ 4,000`, `US $ 7.34` and `US $ 0.18` with the
 *   country prefix and `27 664 $` without it.
 * · `magnitudes` IS DELIBERATELY WITHHELD, and rn's corpus decided it independently of rw's. `miliyoni` /
 *   `imiliyoni` / `imiriyoni` is ×17 and EVERY ONE is MAGNITUDE + NUMBER — `miliyoni zirenga 406`,
 *   `miliyoni 180`, `imiliyoni 4`, `imiriyoni icumi`, `miliyoni 3.8`. The tier's `magAlt` matches
 *   NUMBER-then-magnitude, so the hop can never fire; zero counter-examples.
 *   ⚠ THE PLAYBOOK'S "one declaration, two consumers" WARNING WAS CHECKED, NOT ASSUMED: the field also gates
 *   `magAltU`, the UNIT path's connective hop (`2,2 miliyoni km²`). That shape is ×0 here for the same
 *   reason, so the second consumer loses nothing either.
 * · `units` / `unitPrefix` — see UNIT above for the words, the in-corpus gloss, and the one-letter-key audit.
 * · `unitPer` IS NOT DECLARED. A composed rate (`km/h`) is ×0 in rn; the only slashed units are DENOMINATORS
 *   with no numerator unit (`hab/km²`, `personnes/km²`, `233/km²`, `613 hab/km`), which the tier cannot see
 *   and step 8 claims locally. Declaring it would buy nothing and widen the match surface for nothing.
 * · `exponentWords` position `after` — `ibirometero kwadarato`, `kirometero kwadarato`; the modifier follows
 *   its noun in all 36 corpus attestations and all 29 wiki ones, and `unitPrefix` puts the number after both.
 * · `ampersand` — `na`, the manifest's own conjunction. ⚠ ALL 10 INSTANCES ARE INSIDE ENGLISH OR CITATION
 *   TEXT (`R & D`, `R&B`, `Bousta, M. & Dewitte, O.`, `coffee & vegetables`, `fertilizers & pesticides`) —
 *   trap 34, so they are NOT evidence about Kirundi. The word is not sourced from them: `na` is the engine's
 *   own conjunction, already spent by the number path in *icumi na umunani*, and reading a conjunction sign
 *   as the conjunction cannot be the wrong word. Recorded because the count looks like evidence and is not.
 *   ⚠ NO LOCAL ENTITY STEP IS NEEDED: `&nbsp;` and `&ndash;` are decoded UPSTREAM by `core/markup.ts` before
 *   this layer runs — checked by probe rather than copied from a sibling.
 * · `bareExponent` / `multiply` / `€` are NOT declared — see the header for each refusal and its count.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["kw'ijana"],
    currency: { "US$": [DOLLAR], "$": [DOLLAR] },
    currencyPrefix: true,
    // Derived from the ONE table above, so the tier and step 4 can never name different words for one key.
    units: Object.fromEntries(Object.entries(UNIT).map(([k, w]) => [k, [w]])),
    unitPrefix: true,
    exponentWords: { squared: [SQUARED], position: "after" },
    ampersand: AND,
});

/** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `54` in
 *  `1,964.54` as a NUMBER would say *mirongo itanu na kane* — "fifty-four" — which is a different quantity
 *  from "five four". */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/** Is `word` written within ~45 characters either side of this offset? The redundancy guard for `dogere`
 *  (trap 12: a text that writes both the sign and its word must say it ONCE). BOTH SIDES, because Kirundi
 *  puts the noun BEFORE its figure — `hagati ya dogere 29 … bugera kuri 30/31 ° C` writes the noun once for
 *  two quantities — while a parenthetical gloss would put it after. */
function saidNear(full: string, offset: number, end: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 45), end + 45).includes(word);
}

/** Normalize one Kirundi input string. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeKirundi(input: string): string {
    let s = input;

    // 1) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase break
    //    (multi-dot abbreviations before single-dot). The corpus writes `B.E.R.`, `E.P.E.L`, `S.A.`,
    //    `L. L. Zamenhof`, `A. I.`, `F. M.` — each currently emitting one SENTENCE PAUSE per dot in the
    //    middle of a Kirundi sentence.
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or a run at a sentence end loses its break.
    //    Three cases, told apart by what follows: a letter with NO space is a glued word; a space then a
    //    capital, or end of input, is a sentence end (keep the dot); anything else is mid-sentence.
    //    ⚠ A DOT IS ONLY EVER KEPT, NEVER ADDED. This is rw's correction to the Chichewa rule and it is
    //    re-earned here rather than inherited: rn's `( E.P.E.L )` is the same DOTLESS-FINAL shape as rw's
    //    `R.R.A`, and the nya condition ("a space then a capital follows") would manufacture a sentence break
    //    inside an institution's own name. The optional trailing capital is what makes `E.P.E.L` come out
    //    `EPEL` rather than `EPE L`; it is bounded by `(?![\p{L}\p{M}])` so it cannot reach into the next word.
    //    ⚠ `J.-C.` (French *Jésus-Christ*, ×1) is deliberately NOT matched — the hyphen breaks the run, so the
    //    `{2,}` never fires. One instance of French date-marker debris is not worth widening the class for.
    s = s.replace(/(?<![\p{L}\p{M}])(?:\p{Lu}\.[  ]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?/gu, (run: string, off: number, full: string) => {
        const letters = run.replace(/[.  ]/gu, "");
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `;
        if (!run.endsWith(".")) return letters;
        return rest === "" || /^[  ]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;
    });

    // 2) A DOTTED NUMERIC DATE — `d.m.yyyy`. rn-ONLY: rw's corpus contains none of these, and rn's has TEN,
    //    all in the `(* birth — † death)` biography frame: `2.2.1946`, `24.11.1949`, `17.12.2020`,
    //    `26.08.1940`, `16.07.1983`, `2.05.1953`, `6.03.1955`, `6.04.1994`, `11.3.1933`, `1.12.2018`.
    //    Each currently emits TWO spurious sentence breaks inside one date.
    //    ⚠ ONLY THE DOTS ARE SPENT — no month name is emitted. Kirundi writes dates with a month NAME
    //    (`itariki 10 nzero 1932`), but the corpus GLOSSES its own numeric date as three numbers
    //    (`Ku wa mbere Mukakaro 1962 (01/07/1962)`) and the slash form already reads that way because the
    //    slash is silently dropped. Reading the dotted form identically is consistency; authoring a
    //    twelve-month table off infobox text would be the bulk data invention the playbook forbids.
    //    ⚠ BEFORE step 3, so a de-grouping arm can never see a date's `dd.mm` as the head of a grouped run.
    //    The year is 4 digits and the day/month 1–2, which is what keeps `12.100.000` (grouping) out.
    s = s.replace(/(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d.,])/gu, "$1 $2 $3");

    // 3) THOUSANDS DE-GROUPING, before every remaining numeric rule AND before the tier. A grouping comma
    //    reads as a clause pause and a grouping period as a full stop, so `12.100.000` came out as three
    //    sentences and `1,964.54` as a clause break plus a sentence break inside one area figure.
    //
    //    ⚠ KIRUNDI WRITES THREE CONVENTIONS AT ONCE, and this is a real divergence from Kinyarwanda.
    //    Measured over the artifact's 374 lines:
    //
    //        `,` + exactly 3 digits   27   ALL grouping        1,089 · 172,477 · 725,223 · 9,984,670 · 56,594
    //        `,` + 1–2 digits          2   ALL decimal         0,6 ° C · 232,1 km²
    //        `.` + exactly 3 digits   23   ALL grouping        12.100.000 · 357.588km² · 17.600hab · 1.086
    //        `.` + 1–2 digits         17   7 decimal + 10 the dotted DATES step 2 has already spent
    //        ` ` + 3-digit blocks      7   ALL grouping        104 000 000 000 · 756 102 · 2 780 400 · 27 664
    //
    //    ⚠ AND THE ANGLO FORM `1,964.54` (×9, every one an `Ibirometero kwadarato` area) mixes the two: comma
    //    grouping AND dot decimal in ONE number. Burundi's francophone typography (`12.100.000`, space
    //    grouping) and the Anglo convention coexist in this corpus, so all three arms are load-bearing —
    //    where rw's space arm was near-idle. The comma is 27:2 for grouping here against rw's 15:14 tie.
    //    ⚠ NO `NOT_COORD` GUARD, and its absence is a MEASUREMENT. rw needs one because `1.867 ° S` and
    //    `30.367 ° E` are three-place decimal COORDINATES. rn writes coordinates as degree-and-arcminute —
    //    `9°55'`, `10°40'`, `1°05'`, `0°15'` — and `\d+[.,]\d{3}\s*°` is ×0 in rn. A guard with no instance
    //    is a misfire generator (trap 9), so it is not copied over.
    //    ⚠ THE HEAD MUST START 1–9: a grouped number never opens with a leading zero, and without this the
    //    space arm would eat the neighbours of any `0 620`-shaped identifier.
    //    ⚠ THE TWO ARMS TAKE DIFFERENT TRAILING GUARDS, AND THE ASYMMETRY IS THE ANGLO FORM. The dot arm uses
    //    `(?!\d|[.,]\d)`, which is rw's shape: a dot-grouped run followed by any separator-plus-digit is a
    //    dotted chain, not a number. The COMMA arm must not reject a following DOT, because `1,964.54` — nine
    //    instances, every one an `Ibirometero kwadarato` area — is precisely comma-grouping followed by a dot
    //    decimal. With rw's guard copied over, all nine failed to de-group and kept a clause pause inside the
    //    figure; this was caught by probing the written layer, not by reading it. So the comma arm rejects only
    //    a following digit or a following COMMA-decimal (`(?!\d|,\d)`), which still declines `Ukuboza 26,2008`
    //    (a four-digit tail, excluded by `\d{3}` anyway) and still de-groups `172,477.` at a sentence end.
    //    ⚠ AND THIS IS WHY THE STEP RUNS BEFORE THE TIER. rn's entire `version-dot` cell is 12 grouped
    //    thousands glued to an abbreviation (`357.588km²`, `783.356km²`, `505.911km²`, `17.600hab` ×2,
    //    `20.764hab`, `3.265hab`, `1.097hab`, `83.497.147hab`, `5.748.769hab`, `83.307.674hab`,
    //    `46.934.632hab`) and the tier's `NOT_VERSION` guard rejects exactly `\d+[.,]\d+[a-zA-Z]`. De-grouped
    //    first, the kilometres read; left alone the unit leaks raw. Six times rw's evidence for the same
    //    ordering.
    s = s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?!\d|,\d)/gu, (w) => w.replace(/,/gu, ""));
    s = s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?!\d|[.,]\d)/gu, (w) => w.replace(/\./gu, ""));
    s = s.replace(/(?<![\d.,])[1-9]\d{0,2}(?:[  ]\d{3})+(?!\d)/gu, (w) => w.replace(/[  ]/gu, ""));

    // 4) A UNIT ABBREVIATION WRITTEN BEFORE ITS NUMBER — `km 1,965`, `km² 517`, `mm 1.000`, `mm 1,200`. The
    //    shared tier matches ONLY number-then-unit, so these 4 instances are structurally invisible to it:
    //    trap 47 reason 2, the Oromo case, and the reason this rule is local rather than a tier setting.
    //    The output is the SAME SHAPE the tier's `unitPrefix` produces for the other 15, from the same table
    //    — `ibirometero kwadarato 517` — so the two orders converge on one reading and neither can drift.
    //    ⚠ AFTER step 3, so a grouped operand (`km 1,965`) is already one digit run.
    //    ⚠ THE KEY IS BOUNDED ON BOTH SIDES and the SPACE IS MANDATORY: `(?<![\p{L}\p{M}\d])` stops `km`
    //    matching inside a word, and `(?=[  ]\d)` is what identifies the abbreviation at all. The unspaced
    //    shape means something else entirely — `km2` is `km²` with an ASCII exponent — and an optional space
    //    would let this rule read that `2` as the unit's NUMBER. Trap 28's family; all 4 corpus instances are
    //    spaced. Case-insensitive because the corpus writes `Km`/`KM` alongside `km` (trap 7).
    const PRE_UNIT = Object.keys(UNIT).sort((a, b) => b.length - a.length).join("|");
    s = s.replace(
        new RegExp(`(?<![\\p{L}\\p{M}\\d])(${PRE_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?(?=[  ]\\d)`, "giu"),
        (_m, key: string, exp?: string) => {
            const noun = UNIT[key.toLowerCase()]!;
            return exp === undefined ? noun : `${noun} ${SQUARED}`;
        },
    );

    // 5) SPANS. Two shapes, and BOTH are claimed here — before the tier, so a span's operands are still bare
    //    digits, and before step 6 so a `12:22/24` verse reference has already been excluded by the guard
    //    rather than by luck.
    //
    //    ⚠ THE JOINER IS CHOSEN BY WHAT IS SPANNED — see UNTIL / UNTIL_AT above for the measurement that
    //    settled it. A pair of FOUR-DIGIT YEARS takes the full `kuva A gushika B` frame (14/14 in Kirundi
    //    running text, and zero bare instances); anything else takes the bare infix `A gushika kuri B`
    //    (`ibilometero 26 gushika kuri 28`). `kuva` is additionally SUPPRESSED when the text already supplies
    //    one within ~12 characters to the left, which rn's corpus needs three times (`kuva 2005 – 2007`,
    //    `kuva 2008 - 2009`, `kuva muri 2010 – 2012`).
    //    ⚠ ASCENDING ONLY, measured: the descending direction is what declines the date span
    //    `24 11 1949 - 17 12 2020` that step 2 has just un-dotted, since `1949 - 17` runs backwards.
    //    ⚠ A FOUR-DIGIT COUNT ALONE DOES NOT IDENTIFY A YEAR, and the tests caught this: `metero 1.500 /
    //    1.800` is a pair of ALTITUDES whose operands look exactly like 1500 and 1800 AD, and it was taking
    //    the year frame. The SEPARATOR is the second discriminator and in this corpus it is a clean split —
    //    all 14 dash spans are years or reigns, all 5 slash spans are measurements — so the frame needs BOTH
    //    a dash and two four-digit operands. Anything else takes the bare infix, which also keeps a future
    //    `35-40 cm` out of the year idiom without widening a guard for a shape rn has ×0 of (trap 9).
    //    ⚠ THE SUPPRESSION LOOK-BACK MUST END IN OPTIONAL SPACE, and the clause-final repair below is what
    //    exposed that it did not. `\S{0,10}$` can only reach the figure when `kuva` is IMMEDIATELY before it,
    //    because an intervening word leaves a SPACE at the end of the slice that `\S` cannot absorb — so
    //    `kuva muri 2010 – 2012` emitted the joiner's own `kuva` on top of the text's, *kuva muri **kuva**
    //    2010 gushika 2012*, doubling a word the text already wrote (trap 12). That shape is one of the three
    //    this suppression was written for and it never fired, because the general arm's old right guard
    //    declined the span for its sentence period before the suppression was ever reached.
    const isYear = (a: string, b: string): boolean => /^\d{4}$/u.test(a) && /^\d{4}$/u.test(b);
    const join = (a: string, b: string, full: string, off: number, dash: boolean): string =>
        dash && isYear(a, b)
            ? `${/(?:kuva|guhera)\s\S{0,10}\s*$/iu.test(full.slice(Math.max(0, off - 14), off)) ? "" : `${FROM} `}${a} ${UNTIL} ${b}`
            : `${a} ${UNTIL_AT} ${b}`;

    //    5a) A SPAN OF DEGREES, CLAIMED FIRST — `27/28 ° C`, `30/31 ° C`, `dogere 22/25`. ⚠ THIS ARM EXISTS
    //    BECAUSE THE PROBE FOUND ITS ABSENCE, and it is trap 14's ordering half: order by who needs the words
    //    first. Left to the general arms below, `27/28 ° C` becomes `27 gushika kuri 28 ° C` and step 6 then
    //    attaches the noun to the SECOND operand only — the operands split around the noun.
    //    ⚠ AND A TEMPERATURE SPAN TAKES `na`, NOT `gushika`. Both of rn's sources put the plain conjunction
    //    between two degree figures under one noun — the corpus's `hagati ya 17°C na 29°C` and the wiki's
    //    `dogere selisiyusi 20 na 25` — and the independent Kirundi corpus consulted for the joiner says the
    //    same (temperature ranges use `hagati ya X na Y`, not the `gushika` frame). So this arm is not the
    //    general span rule with a unit bolted on; it is a different idiom, and using one for the other was
    //    the mistake the first draft made.
    //    TWO SHAPES, because the noun and the sign each identify a temperature on their own: the sign-bearing
    //    `27/28 ° C`, and `dogere 22/25` where the corpus's own noun stands in front. The second emits no
    //    noun — it is already there — and the first suppresses it via the same `saidNear` redundancy guard.
    const spanDeg = (a: string, b: string): string => `${a} ${DEGREE_AND} ${b}`;
    s = s.replace(/(?<![\p{L}\p{M}\d.,:/-])(\d+)[  ]?[-–—/][  ]?(\d+)[  ]?°[  ]?[CF]?(?![\p{L}\p{M}])/gui,
        (w, a: string, b: string, off: number, full: string) =>
            Number(a) < Number(b)
                ? `${saidNear(full, off, off + w.length, DEGREE) ? "" : `${DEGREE} `}${spanDeg(a, b)}`
                : w);
    s = s.replace(new RegExp(`(?<=${DEGREE}[  ])(\\d+)[  ]?[-–—/][  ]?(\\d+)(?![\\d.,:/])`, "giu"),
        (w, a: string, b: string) => (Number(a) < Number(b) ? spanDeg(a, b) : w));

    //    5b) A `/` SPAN — an rn shape rw's corpus does not contain. 5 instances, all measurements and all
    //    ascending: `dogere 22/25`, `hafi ya 27/28 ° C`, `kuri 30/31 ° C`, `metero 1.500 / 1.800`,
    //    `mm 1,200 / 1,400 mm`. Against them the same character is 6 dd/mm/yyyy DATES (`01/07/1962`,
    //    `2/2/1946`, `13/07/1982`, `27/01/2013`, `4/12/ 2015`, `13/12/ 2016`), one VERSE reference
    //    (`12:22/24`) and 4 rate denominators (`hab/km²`, `personnes/km²`, `233/km²`, `hab/km`).
    //    ⚠ THE GUARD IS WHAT MAKES THIS SAFE, and it was verified by running the pattern over the corpus
    //    before the rule was written: 5 wanted, 0 false positives. `(?<![\d.,:/])` rejects a second or third
    //    date field and the `22` of `12:22/24`; `(?![\d.,]*[/:])` rejects a FIRST date field by looking ahead
    //    for the next separator; and a denominator is excluded because the character after the slash must be
    //    a digit. AFTER step 3, so `1.500 / 1.800` is `1500 / 1800` by now and the operands are single runs.
    s = s.replace(/(?<![\d.,:/])(\d+)[  ]?\/[  ]?(\d+)(?![\d.,]*[/:])/gu,
        (whole, a: string, b: string, off: number, full: string) =>
            Number(a) < Number(b) ? join(a, b, full, off, false) : whole);

    //    5c) A HYPHEN OR DASH SPAN. 14 of the corpus's 15 are YEAR or REIGN spans — `(1884-1885)`,
    //    `(1522-1588)`, `1997–2005`, `(1911-2004)`, `(1981-1989)`, `2005 – 2007`, `(1987—1993`, `1996—2003)`,
    //    `(1966—1976)`, `(2003—2005)` — which is why there is NO unit-hoisting arm here: rn has no
    //    measurement span at all, so rw's first arm has zero instances and writing it would be trap 9.
    //    ⚠ THE GUARD EXCLUDES A HYPHEN ON EITHER SIDE, which declines a hyphen CHAIN, and a trailing letter,
    //    which is what keeps a designation like `COVID-19` and the French `Kindergaten –2ème année` out.
    //    ⚠ AND ITS TRAILING SEPARATOR TEST IS `[.,]\d`, NOT A BARE `[.,]` — CHECKED AGAINST rn's OWN CORPUS
    //    rather than inherited from rw, because this file diverges from its sibling deliberately (trap 55).
    //    A separator with no digit after it is not a decimal here either; it is the end of the clause, and
    //    the bare class declined all three of rn's clause-final spans — `Tübingen 1997–2005.`, `kuva 2005 –
    //    2007.` and `kuva muri 2010 – 2012.` — which read as two juxtaposed cardinals with no joiner at the
    //    exact position a sentence ends (playbook trap 58, `review.ts`'s `clause-final` check). All three are
    //    four-digit year pairs, so they take the `kuva A gushika B` frame, and two of them supply their own
    //    `kuva` for the suppression above to find.
    //    ⚠ THE SEPARATOR-PLUS-DIGIT HALF STAYS because rn writes BOTH separators inside a figure
    //    (`metero 1.500 / 1.800`, `mm 1,200 / 1,400 mm`): a right operand that continues is still refused.
    s = s.replace(/(?<![-\d.,\p{L}\p{M}])(\d+)[  ]?[-–—][  ]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)/gu,
        (whole, a: string, b: string, off: number, full: string) =>
            Number(a) < Number(b) ? join(a, b, full, off, true) : whole);

    // 6) DEGREES — the sign was dropped outright and the scale letter reached the g2p as a PHONEME, `C` as
    //    [t͡ʃ]. 7 in the corpus, plus 4 coordinate degrees.
    //    ⚠ THE ARMS ARE ORDERED LONGEST-FIRST so `°C` is not claimed by the bare arm.
    //    ⚠ THE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT (`hagati ya dogere 29 … kuri 30/31 ° C`
    //    writes it once for two quantities), and the guard looks BOTH WAYS because Kirundi prefixes the noun
    //    while a gloss would postpose it.
    //    BEFORE step 9, which would otherwise turn `0,6 ° C` into `0 6 ° C` and break the adjacency.
    //    ⚠ AFTER step 5, not before: `dogere 22/25 ku mutaga` and `hafi ya 27/28 ° C` are SPANS whose second
    //    operand carries the sign, and Kirundi heads the whole span with one `dogere`. Claiming the span first
    //    means the degree arm then attaches the noun to the front of the finished phrase; the other order
    //    would give `22 … dogere 25`, the operands split around the noun. Trap 14's ordering half — order by
    //    who needs the words first — arriving here through a joiner rather than through agreement.
    const spellDec = (n: string): string => {
        const m = /^(\d+)[.,](\d+)$/u.exec(n);
        return m ? spell(m[1]!, m[2]!) : n;
    };
    //    ⚠ THE NOUN GOES OUTSIDE A LEADING SIGN, not between it and its digits. `-39°C` was coming out
    //    `-dogere 39` — the minus stranded in front of a word — because the arms matched from the first digit.
    //    The sign is captured and re-emitted after the noun so the text stays `dogere -39`; the minus is still
    //    unread (see 8c) and still VISIBLE to the scan, which is the point of leaving it there at all.
    const degreeBody = (sign: string, n: string, off: number, end: number, full: string): string =>
        `${saidNear(full, off, end, DEGREE) ? "" : `${DEGREE} `}${sign}${spellDec(n)}`;

    //    6a) A SCALE TEMPERATURE — `30 ° C`, `17°C`, `0,6 ° C`, `16 °C`. The `F` letter is CLAIMED so it
    //    cannot reach the phoneme stream raw, but NO Fahrenheit name is emitted: `farenheti` is 0/0 on
    //    rn.wikipedia and `°F` is ×0 in this corpus, so there is nothing to say and nothing is invented.
    s = s.replace(/(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[  ]?°[  ]?[CF](?![\p{L}\p{M}])/gui,
        (w, sg: string, n: string, off: number, full: string) => degreeBody(sg, n, off, off + w.length, full));
    //    6b) A COORDINATE — `9°55'`, `10°40'`, `1°05'`, `0°15'`. ⚠ NO COMPASS TABLE, and that is another rw
    //    divergence: Kinyarwanda writes the bare letter (`1.867 ° S`) and needs one, while Kirundi SPELLS THE
    //    DIRECTION OUT as an ordinary word — `hagati ya 9°55' na 10°40' mu buraruko`, `na 1°05' mu burengero
    //    na 0°15' mu buseruko`. `[NSEW]` after a degree is ×0 in rn. The arcminute mark carries no reading
    //    this repo has sourced for Kirundi, so it is left as written and only the degree is spoken.
    s = s.replace(/(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[  ]?°(?=[  ]?\d+[′'])/gu,
        (w, sg: string, n: string, off: number, full: string) => `${degreeBody(sg, n, off, off + w.length, full)} `);
    //    6c) A BARE DEGREE.
    s = s.replace(/(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[  ]?[°º](?![\p{L}\p{M}])/gu,
        (w, sg: string, n: string, off: number, full: string) => degreeBody(sg, n, off, off + w.length, full));

    // 6d) A REDUNDANT PERCENT SIGN — the clause already SPELLS the word, so the reading must say it ONCE
    //     (trap 12). Kirundi's corpus writes the pair five times, always word-then-parenthesised-sign:
    //     `Ibice mirongo icenda kw'ijana (90%)` ×2, `ibice bitatu kw'ijana (3%)`, `bane kw’ijana (4%)`,
    //     `Hafi y'ibice mirongo ine kw'ijana (40%)`. Without this the tier adds a second `kw'ijana` and the
    //     sentence says "four percent percent" — found by probing the written layer.
    //     ⚠ THE SIGN IS DROPPED AND THE WORDS ARE KEPT, which is the language-idiomatic position and the
    //     playbook's rule for a redundant symbol. The differential DROP test cannot see the difference here by
    //     construction; the note is what tells the next reader why.
    //     ⚠ BOTH APOSTROPHES, because the corpus writes `kw'ijana` (U+0027) and `kw’ijana` (U+2019) and the
    //     two render identically — the same class of invisible split trap 11 records for Bengali nukta.
    //     BEFORE step 7, so the tier never sees a sign that has already been spoken.
    s = s.replace(/(\d)[  ]?%/gu, (w, d: string, off: number, full: string) =>
        /kw['’]ijana/iu.test(full.slice(Math.max(0, off - 45), off + w.length + 45)) ? d : w);

    // 7) THE SHARED SYMBOL TIER — percent, units, exponent, ampersand. See SYMBOLS above.
    //    ⚠ BETWEEN steps 3 and 9 BY NECESSITY, and both directions are load-bearing: it must see a de-grouped
    //    `357588km²` (or `NOT_VERSION` refuses the unit) and it must see an intact `196.7km²` and `24,4%` (or
    //    there is no number beside the sign). That is the whole reason this file owns the call.
    s = SYMBOLS(s);

    // 8) A UNIT USED AS A BARE DENOMINATOR, with no numeral of its own — `(233/km²)`, `3372 hab/km²`,
    //    `93 personnes/km² `, `613 hab/km `, i.e. "…per square kilometre". The tier's rate path composes
    //    NUMERATOR + `/` + denominator and cannot see a denominator standing alone, so those units reached the
    //    IPA raw with the exponent dropped. That is the tier limitation Pashto records for `هر km²`.
    //    ⚠ THE SINGULAR NOUN IS USED HERE — `kuri kirometero kwadarato`, not the plural the tier emits — and
    //    that is Kirundi noun class, not a typo: the corpus and the wiki write `Abantu 542 ku kirometero
    //    kwadarato` and `abantu … ku kirometero kwadarato (3372 hab/km²)` in exactly this slot, class 7, while
    //    a quantity takes the class-8 plural (`Ibirometero kwadarato 1,089`). Both are attested in their own
    //    position, which is why UNIT_SG exists.
    //    ⚠ AFTER THE TIER, not before: run first, this would steal any real rate from the rate path. By this
    //    point a composed rate has already been consumed, so a surviving `/unit` is one that had no numerator.
    //    Trap 39 in its ordinary direction — a fallback runs after the rule whose leftovers it exists to catch.
    //    ⚠ MULTI-LETTER KEYS ONLY, which is what buys the `i` flag safely. A one-letter key here would read a
    //    URL PATH SEGMENT as a unit, and the numeral guard that protects the other positions does not exist in
    //    denominator position (trap 46 through a third door). rn declares no one-letter key anyway.
    const DENOM_UNIT = Object.keys(UNIT_SG).sort((a, b) => b.length - a.length).join("|");
    s = s.replace(
        new RegExp(`/[  ]?(${DENOM_UNIT})(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{L}]))?(?![\\p{L}\\p{M}\\d'’])`, "giu"),
        (_w, key: string, exp?: string) => {
            const noun = UNIT_SG[key.toLowerCase()]!;
            return ` ${PER} ${exp === undefined ? noun : `${noun} ${SQUARED}`}`;
        },
    );

    // 8b) COLONS. rn has NO clock and NO race duration — see the header for the measurement — so there is
    //     nothing to compose and the only job is to stop `:` becoming a clause pause inside a single
    //     reference. All 6 instances are Bible verses (`11:22`, `16:16`, `12:22/24`) plus one wiki-signature
    //     timestamp. The colon is spent on a space and nothing is invented; the playbook's `sports-time`
    //     class has no attested Kirundi reading, and inventing one from Kinyarwanda's would be exactly the
    //     borrowing this file exists to refuse.
    //     ⚠ AFTER step 5a, whose guard already declined `12:22/24` on the colon it can still see.
    s = s.replace(/(?<![\d:])(\d{1,2}):[  ]?(\d{2})(?![:\d])/gu, "$1 $2");

    // 8c) A LONE `+`, `=` or `×` IS LEFT UNREAD, deliberately — the `+` ×2 are Wikipedia PORTAL SIZE MARKERS
    //     (`+1 000 000 : English · Deutsch`) and the other four signs are ×0 in the artifact. Recorded in
    //     tools/normalization/defects.ts rather than guessed at.
    //     ⚠ AND SO IS THE MINUS, which is the one place this layer leaves a real defect standing. See the
    //     header: rn's single negative number is a temperature whose sentence already says `munsi ya`
    //     ("below"), the other is a French grade range, and no Kirundi word for the sign is attested
    //     anywhere. `review.ts --lang rn` stays RED on it on purpose — trap 24, because omitting a minus
    //     INVERTS the value and a permanently visible defect is more honest than a borrowed reading.

    // 9) DECIMALS, LAST of the numeric rules — steps 2 to 8 all need their number intact, and the tier needs
    //    the digit adjacent to its sign. The separator was reaching `clausePunctuation` and becoming a
    //    SENTENCE OR CLAUSE BREAK inside a number, 145 times in the corpus. NO separator word is emitted; see
    //    the header for why.
    //    ⚠ BOTH SEPARATORS, both restricted to a 1–2 digit tail — the same discipline step 3 uses from the
    //    other side. rn's decimals are `0.8`, `3.8`, `7.34`, `0.18`, `196.7`, `695.52`, `61,19`, `0,6`,
    //    `232,1`, `24,4`, `68,7` and the fractional halves of the nine ANGLO areas (`…64.54`, `…35.52`).
    //    ⚠ THE TRAILING GUARD IS `(?!\d|[.,]\d)`, NOT `(?!\d)`, and in rn its evidence is the DOTTED DATE
    //    rather than rw's fertiliser grade: without it `26.08.1940` would match its first pair (the following
    //    character is a `.`, not a digit) and read a birth date as "twenty-six point zero eight". Step 2 has
    //    already spent those ten dates, so this is belt and braces — but the guard also keeps a decimal at a
    //    sentence END readable (`Ibirometero kwadarato 1,457.40.`), which `(?![\d.,])` would have broken.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d{1,2})(?!\d|[.,]\d)/gu, (_m, i: string, f: string) => spell(i, f));
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?!\d|[.,]\d)/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` ${PER} `, `letters `) doubles a space that was already there and can leave one
    // at an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return s.replace(/[^\S\n]{2,}/gu, " ").replace(/^[^\S\n]+|[^\S\n]+$/gu, "");
}
