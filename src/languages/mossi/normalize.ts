/**
 * Mooré / Mossi (mos) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR MOORÉ, NO KAIKKI AND NO WIKIPRON, AND espeak DOES NOT SHIP THE LANGUAGE. The
 * referee that does exist (`mos.wiktionary-mos.tsv`) is 39 ordinary lexical words with no digit, no symbol
 * and no punctuation in it, so it is a TRIPWIRE for the word path and cannot arbitrate one line of this
 * file. The evidence is therefore `tools/corpus/mined/mos.jsonc` (dump-sourced) plus a fresh
 * mos.wikipedia dump — 2,088 pages / 12,650 paragraphs through `wikidump-to-text.py`, which is the WHOLE
 * of the Mooré wiki. Full log: `docs/investigations/mos_normalization_investigation.md`.
 *
 * ⚠ AND 11.6% OF THAT WIKI IS NOT MOORÉ, SO EVERY COUNT BELOW IS OVER THE FILTERED TEXT
 * (`filter-by-language.py --lang mos`, a row added by this work). Burkina Faso is francophone and the
 * expectation was French; measured, the contaminant is ENGLISH — `of` ×4,460 and `the` ×2,658, from
 * bibliographic citation blocks and from this wiki's large body of Ghana/Anglophone-topic articles, against
 * `de` ×774 whole-corpus for French. It does not spread evenly, which is the su lesson (playbook §0b):
 *
 *     era-marker 24% Mooré · ampersand 44% · ranges 47% · ordinal-latin 54% · fractions 56%
 *     …against percent 99.8% · abbrev 94% · clock 92% · currency 89% · decimals 84% · grouped 89%
 *
 * `fractions` reproduces the su finding almost verbatim: the artifact's hard-set for that cell is JSTOR/DOI
 * bibliography lines (`56: 153–173. doi:10.2307/1291860`), which are English citation furniture and not
 * Mooré fractions at all. No rule here rests on a cell below 80%.
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — the defect list, not an assumption:
 *
 *     vote 21,552          → vote pisi la a je , kobs a nu …    grouping comma → a PAUSE, wrong number
 *     koees 15.043         → piːɡ la a nu . pis naːse …         grouping dot → a SENTENCE BREAK
 *     doolaar 100 000      → doːlaːɾ koabɡa zaːlem              space grouping → "hundred zero"
 *     €10,000              → the sign SILENT, then the comma pause
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO PERCENT WORD, AND IT IS THIS LAYER'S LARGEST DECLINED CLASS BY AN ORDER OF MAGNITUDE — `\d ?%` is
 *   ×1,328 in the filtered corpus, in the one cell whose evidence is 99.8% Mooré. The corpus writes the
 *   GLYPH every time and never spells the reading, which is exactly the case the playbook warns is the
 *   weakest evidence there is about how a symbol is spoken — so the silence alone would not settle it and a
 *   dictionary check was owed (the Igbo lesson). Every route was run:
 *     · `sources.ts` → `[chk?] percent-word`; espeak ships no Mooré, so there is no phonetic fallback.
 *     · `concept.ts --items Q11229,Q137985650 --langs mos` → NO Wikidata label and NO article, in either
 *       item. The inversion of trap 35 has nothing to invert.
 *     · the French loan: `pourcent` ×0, `pursã` ×0, `poursã` ×0, `pursaã` ×0 on the wiki and in the corpus.
 *       Glosbe fr→mos answers "nous n'avons pas de traductions pour pour cent".
 *     · the composed native form, which is the one that nearly shipped. `koabg pʋgẽ` ("in a hundred", from
 *       `pʋgẽ` ×6,707 and the combining form of 100 that the corpus itself glosses — `kilometr ramba
 *       koabga (62 mi)(Ãnglindi: 100 kilometres)`) comes back ATTESTED ×4. Read the four: TWO are the
 *       CENTURY sense, `yʋʋm koabg pʋgẽ` "within a hundred years". The other two are the percent sense and
 *       ⚠ THEY ARE THE SAME SENTENCE OF ONE ARTICLE — `Yʋʋm 2006, koabg pʋgẽ gɛɛlga 50,28 da ya pagba …
 *       3,7 koabg pʋgẽ gɛɛlga`, the Ouahigouya demographics paragraph, in a visibly non-standard register
 *       (`ya` for `yaa`, `ni` for `ne`). Two hits in one article is a LEAD, not a finding.
 *     · ⚠ AND THE POSITION IS WRONG EVEN IN THAT LEAD, which is what finally settles it. The one
 *       attestation PRECEDES its figure (`koabg pʋgẽ gɛɛlga 50,28`); a normalizer emits `50,28 koabg
 *       pʋgẽ`. Nothing attests the postposed order. That is the Fula `hakkunde` failure exactly — a word
 *       being real is not the same as a word fitting the slot — and this is why the composition was
 *       refused where Fula's `e teemedere` was accepted. Recorded so the measurement is re-runnable.
 *
 * ⚠ NO DECIMAL-POINT WORD, so the separator stays a pause and this layer does not touch it. `sources.ts`
 *   reports `[NONE] decimal-point — no _dpt, no _., no manifest word`, espeak ships nothing, and no
 *   candidate survived. The corpus writes BOTH conventions — `29.6` ×1,050 and `53,6` ×365 — so the
 *   fractional reading is a real class (×1,415) and it is left exactly where it was rather than guessed at.
 *
 * ⚠ NO CLOCK, AND THE REFUSAL IS ON SENSE RATHER THAN SILENCE, which makes it a stronger one. `\d{1,2}:\d{2}`
 *   is ×68 in the filtered corpus and reading the instances says it is mostly NOT a clock: BIBLE VERSE
 *   references (`a Luke 2:22-40 pʋgẽ`, `Leviticus 12 soabã`), a vote ratio (`vot wʋsg sẽn yɩɩd a 80:35`), a
 *   chat timestamp pasted into an article (`[2:54 PM, 10/14/2023] Hassan:`) and a page-footer UTC stamp
 *   (`rasem 2 daar n tãag 13:13 (UTC)`), beside a genuine opening-hours run (`08:30 n tɩ tãag 17:00`). A
 *   rule keyed on the shape would claim scripture citations. `wakato` is glossed "heure" in the Lexique
 *   français-mooré, but that is the bare noun "time/hour" and nothing attests it in a spoken clock — trap
 *   37. So the `:` keeps its current reading and the class is recorded rather than claimed.
 *
 * ⚠ NO RANGE JOINER. `\d+ ?[-–] ?\d+` is ×852 but the cell is only 47% Mooré, and what survives the filter
 *   is dominated by football scores (`3-1`, `4-3`) and season spans (`2019-20`) in Ghana league articles.
 *   No Mooré connective is attested between two figures; the engine already reads the pair as two bare
 *   cardinals, which is the Swahili/Lingala precedent for exactly this state. Nothing is lost by leaving it.
 *
 * ⚠ NO `£`, WHICH IS THE MOST FREQUENT CURRENCY SIGN IN THE CORPUS (×18, against `€` ×3 and a real `$` ×0).
 *   Every one is a genuine monetary amount (`£1,500`, `£50,000`, `£88 milyõ`) and NO Mooré word for the
 *   pound is attested anywhere — the wiki never glosses it, unlike the euro. Leaving the sign unread is the
 *   choice this tree ranks above a confidently wrong word; step 4 reads the two signs it can source and no
 *   more.
 *
 * ⚠ THE SQUARED READING IS REFUSED WHILE THE UNIT NOUN IS ACCEPTED, and the two decisions are independent.
 *   Step 5 emits `kilometr` for `km²`/`km2`/`km^2` and lets the SQUARE fall silent, because Mooré has no
 *   settled square-word and the corpus offers three rivals that do not agree with each other — on the count
 *   OR on the position:
 *     · `kars`        ×1, one article — `A ziiga yalem taa kilometr kars 923.769` (Nigeria's area). One hit.
 *     · `zem-taas`    ×3, three articles, and READING them is what refuses it. One is a SQUARE MILE
 *       (`2,000 zem-taas yaremde mile (5,200 km²)`), and the other two put it on OPPOSITE SIDES of the unit
 *       noun — `24,389 kilometrẽ zem-taas yalem` against `(8,842) zem-taas ya remde kilometrē (square
 *       kilometer)`. A word whose slot flips between its own two attestations cannot be emitted into a slot.
 *     · `men-yɩlende` ×2 — `9826 kilometr men-yɩlende`, `6,000 mètr men-yɩlende`. The most consistent of the
 *       three and still two hits.
 *   Three candidates at ×1–3 with no agreement is a LEAD, not a finding (the `koabg pʋgẽ` shape again). ⚠ AND
 *   THIS IS STILL A STRICT IMPROVEMENT ON WHAT IT REPLACES, which is the only reason it ships: `km2 77.0`
 *   read as *km* RAW followed by the `2` claimed by the number path as the CARDINAL TWO (the `za` `810km2`
 *   bug, reproduced here), and now reads *kilometɾ … *. A dropped modifier beats a raw symbol plus an
 *   invented number. ⚠ mos is deliberately NOT added to `ACCEPTED_SIGN_SILENCE` for `exponent` — the drop is
 *   a real loss of meaning, so `review.ts --lang mos` stays RED on it (trap 24).
 *
 * ⚠ NO `°`/`°C`/`=`/`×`/`>`/`&`/`−`. Counted in the filtered corpus: `°` ×41, `²`/`³` ×24, the whole
 *   math-sign class ×75, `&` ×111. `sources.ts` reports `[NONE] scale-names — ° occurs, neither scale name
 *   in corpus/referee/espeak`, and the ampersand cell is only 44% Mooré (its instances are English
 *   publisher names in citations — `Room, Adrian (2008). African placenames …`). Nothing to source, and
 *   the classes are too small to justify a guess.
 *
 * ⚠ NO ABBREVIATION RULE, AND THE CELL THAT SUGGESTS ONE IS A FALSE POSITIVE — the same finding the
 *   Bambara layer made independently. `abbrev` is the artifact's second-largest cell (×6,148, 94% Mooré),
 *   and its selector is a short word plus a period. Tabulating what actually precedes those dots:
 *   `wã.` ×4,316, `ye.` ×2,660, `pʋgẽ.` ×1,962, `soaba.` ×1,165 — the definite article, the negation
 *   particle, the locative, the ordinal noun. They are SENTENCE-FINAL PERIODS, every one. Claiming any of
 *   them deletes a real pause (trap 4 from the other direction), on roughly six thousand instances. The
 *   same applies to `letter-name` (×9,373: the personal particle `a` and the pronoun `b`) and to
 *   `latin-in-native` (×14,908: Mooré is written in Latin, so the cell matches every paragraph).
 *
 * ⚠ NO ORDINAL RULE, BECAUSE THE ENGINE ALREADY READS IT. Mooré's ordinal is the postposed noun `soaba`
 *   and the corpus writes it after DIGITS — `\d+ ?-?soab` ×1,958, `Leviticus 12 soabã`, `parlament a nii
 *   soabã`. The tokenizer splits the digit run from the word already, so `12 soabã` reads *piːɡ la a ji
 *   soabã* today, which is correct. `pipi` "first" ×1,388 is suppletive and is likewise already a word.
 *   The English `4th`/`8th` suffixes (×~100) live in the 54%-Mooré `ordinal-latin` cell and are parenthetical
 *   glosses beside the Mooré ordinal (`parlament a nii soabã (8th)`) — foreign text, and redundant (trap 12).
 *
 * ⚠ NO INITIALISMS. `core/initialisms.ts` exists and ~30 languages wire it, but it is a NO-OP without a
 *   `letterName` table and `sources.ts` reports `[NONE] letter-names — espeak does not ship this language
 *   at all`. That is the fleet-wide 94-language sourcing block, not a coding one (trap 16 checked: the seam
 *   exists, the DATA does not).
 */

/** ⚠ THE THOUSANDS SEPARATOR IS THREE DIFFERENT CHARACTERS IN THIS CORPUS AND TWO OF THEM ALSO WRITE THE
 *  DECIMAL POINT. What separates the two roles is the DIGIT COUNT after the mark, and that was measured
 *  rather than assumed — over the filtered wiki:
 *
 *      separator + exactly 3 digits          separator + 1–2 digits
 *      comma   ×698  (678 one group, 20 more) comma  ×365   1,5 · 0,5 · 3,5 · 50,28   ← DECIMAL (French)
 *      period  ×61   (61 one group, 0 more)   period ×1,050 0.2 · 0.4 · 3.5 · 58.4    ← DECIMAL (English)
 *      space   ×224                           —
 *
 *  Read back to the instances, the 3-digit column is thousands: `A paama vote 21,552 tɩ … paam vote
 *  14,158`, `a paama Hemang Lower Denkyira sullã vot ne koees 15.043, sẽn yaa koeesã fãa 58.4%` (15,043
 *  votes = 58.4% — the same sentence carries both roles and settles both), `yɩɩl-gʋlsdb sẽn ta 30.000`,
 *  `ligd sẽn ta doolaar 100 000`. Every one is a vote count, a population or a sum of money.
 *
 *  ⚠ THE PERIOD ARM HAS ONE KNOWN FALSE POSITIVE AND THE RATIO IS THE WHOLE ARGUMENT (trap 28): 60 of the
 *  61 period+3-digit instances are thousands, and the one that is not is `358.5 (1.384 km2)` — 358.5
 *  hectares given as 1.384 km², a genuine three-place decimal. It reads as 1,384 after this rule. Stated
 *  rather than hidden, because 60:1 is the cost and it is small; no lookahead separates them (its
 *  neighbour `225.000 km2 (87.000 sq mi)` is thousands before the SAME unit).
 *
 *  ⚠ EXACTLY THREE DIGITS, ANCHORED BOTH SIDES, is what keeps this off everything else. The corpus writes a
 *  comma-separated LIST of small numbers (`nu ni piig la a tãambo (1,5,13)`) — one and two digits, so it
 *  cannot match; DOI and JSTOR strings (`doi:10.2307/1291860`) have four; version dots (`802.11n`) have two.
 *  The `(?<![\d.,])` / `(?![\d.,])` guards stop a match beginning or ending inside a longer run, which is
 *  the lookbehind-AND-lookahead pair trap 28 says a lookahead alone cannot replace. */
import { makeBareUnitNormalizer } from "../../core/normalizeSymbols.ts";
import { renormalize, rewrite } from "../../core/provenance.ts";
// ⚠ THE TRAILING GUARD IS `(?!\d)`, NOT `(?![\d.,])`, AND THAT ONE CHARACTER IS TWO SEPARATE CASES. It
// rejected every CLAUSE-FINAL grouped figure — `50 000.` came back untouched and read *pis nu zaːlem .*,
// losing the thousand word at exactly a sentence end (playbook trap 58, reported by `review.ts`'s
// `clause-final` check) — and it also rejected the MIXED-CONVENTION number the Sundanese layer documents,
// where a period-group is followed by the decimal comma (`764.387,59`). Rejecting only a following DIGIT is
// what the lookbehind-plus-lookahead pair above actually needs: a further `\d{3}` group is already consumed
// by the `+`, so a match can still neither begin nor end inside a longer run.
// (The space arm additionally carried a duplicated `\d` inside its class — inert, and gone with it.)
const GROUPED_SPACE = /(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)/gu;  // space, NBSP, NNBSP, thin space
const GROUPED_COMMA = /(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)/gu;
const GROUPED_DOT = /(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)/gu;

/** ⚠ THE CURRENCY NOUN COMES BEFORE THE FIGURE IN MOORÉ, so this rule REORDERS rather than postposing, and
 *  the shared tier could not have said it (playbook §47 reason 2, the Oromo case). The position is not a
 *  guess: every attestation of a currency word in the corpus puts it first — `a yõod yaa doolaar 100 000`,
 *  `ligd sẽn ta doolaar 4000`, `ligd sẽn yaa doolaar 217,464.00`, `paam ligd sẽn ta doolaar 300`,
 *  `dolaar milyaar a 9`, `Ero wã milyo a naase`.
 *
 *  SOURCING, one word at a time:
 *  · `Ero` = EURO. Attested ×3 and — the reason it is here — the wiki glosses it against the sign in its own
 *    text: `b da yaooda Ero wã milyo a naase(€4 million)`. A sign↔word gloss in one sentence is the
 *    strongest currency evidence this corpus offers, and it is the only one.
 *  · `doolaar` = DOLLAR. Attested ×8 across 7 independent articles, every one a monetary amount in the
 *    slot above; the variant `dolaar` ×2 alongside. ⚠ BUT `$` ITSELF IS ×0 AS CURRENCY IN THIS CORPUS —
 *    its two occurrences are markup residue in one sentence about a chieftaincy title. So this arm is
 *    ROBUSTNESS FOR PLAUSIBLE INPUT, not a measured-defect repair (trap 22: say which kind it is). It costs
 *    nothing and the word is the best-attested one in the file.
 *  · `£` IS DECLINED — see the header. It is the corpus's most frequent sign and no Mooré word for it is
 *    attested. A sign this layer cannot source stays unread.
 *
 *  The figure is re-emitted as DIGITS and the engine's own number path speaks it (trap 10: a rule that
 *  consumes an operand must put it back). A magnitude word may stand between the sign and the noun in the
 *  source (`€4 million`) — it is left in place, already an ordinary word the tokenizer reads. */
const CURRENCY: readonly (readonly [string, string])[] = [
    ["€", "Ero"],
    ["$", "doolaar"],
];

/** ⚠ THE KILOMETRE, AND THE UNIT NOUN COMES BEFORE THE FIGURE — the same head-initial order the currency
 *  rule above already found, arrived at independently and by a different route.
 *
 *  SOURCING. `kilometr` is `attested ×31 across 20 articles` (`attest.ts --lang mos --words kilometr`), and
 *  the sense is not inferred from the count — the corpus GLOSSES THE WORD AGAINST THE SYMBOL, twice, in two
 *  unrelated articles:
 *
 *      Woglem: kilometr a yiibu (2 km)   Yaadem: kilometr yéndé la pʋsʋka (1.5 km)      (Lake Tengrela)
 *      … kilometr ramba koabga (62 mi)(Ãnglindi: 100 kilometres)                        (Acacus Mountains)
 *      … n na ta kilometr kobga 100km (62mi)                                            (same article, body)
 *
 *  A word written beside the symbol it reads, in one sentence, is the strongest evidence this corpus offers —
 *  it is what settled `Ero` for the euro, and it is available here twice over. The spelling is decided by the
 *  same probe: `kilometr` ×31/20 against `kilomɛtre` ×2/1 (one table of protected-area sizes) and
 *  `kilometre`/`kilomeetre` ×0. The stray `kilometres`/`kilometrē`/`kilometrẽ` forms in the wiki sit inside
 *  English parentheticals or carry a nasal that the ×31 majority does not.
 *
 *  ⚠ THE POSITION IS MEASURED, NOT ASSUMED, AND THE CORPUS WRITES BOTH ORDERS — so a count of raw hits would
 *  have settled nothing. `insource:/kilometr/` over mos.wikipedia (50 articles) splits roughly 17 preposed to
 *  11 postposed, which on its own is a lead. What settles it is restricting to the instances where the
 *  numeral is SPELLED OUT IN MOORÉ — i.e. the SPOKEN form, which is the only form this layer's output has to
 *  match, since the digits it re-emits become Mooré numerals downstream:
 *
 *      PREPOSED, numeral spelled out  ×11   kilometr a yiibu · kilometr yéndé la pʋsʋka · kilometr kobga ·
 *                                           kilometr pis-naase (40) · kilometr tus-pis-nii (8000km) ·
 *                                           kilometr piso-poe la a nu (75km) · kilometr a nii 8km ·
 *                                           kilometr a tãab 3km · kilometr a yi · kilometr ramba koabga ·
 *                                           kilometres koabg la pis-naas la a yopoe
 *      POSTPOSED, numeral spelled out  ×1   … pis-yoopoe la yoobe kilometr (18,476km)     (Upper West Region)
 *
 *  11:1 on the form that matters, against a near-even split on the raw shapes. ⚠ THE POSTPOSED HITS ARE THE
 *  DIGIT ONES — `85 kilometr (53 ml)`, `4,596 kilometr`, `219 kilometr`, `182 kilometr (113 ml)` — i.e. the
 *  figure copied across from a source wiki with its Anglo-French order intact, which is exactly the
 *  contamination this language's run had to filter for in the first place. And the corpus corroborates the
 *  native order with the SYMBOL too, writing it in front of its own figure: `km 2,04`, `km 3,245`, `km 179.0`,
 *  `km2 77.0`, `km2 199.4`, and the marathon splits `zoe km 10 … km 15 … km 30`. Writers who reach for the
 *  symbol still put the unit where Mooré puts the noun. That is why this rule REORDERS (playbook §47 reason 2)
 *  rather than postposing, and why the shared tier could not have expressed it.
 *
 *  ⚠ THE PARTICLE `a` IS NOT EMITTED. The corpus writes `kilometr a yiibu`, `kilometr a 5`, `kilometr a nii`,
 *  `kilometr a tãab`, `kilometr a yi` — the enumerative particle before a small numeral — but it also writes
 *  `kilometr kobga` and `kilometr pis-naase` without it. Whether `a` appears is a fact about the NUMBER path
 *  (`numbers.ts`), not about this noun, and the currency rule above already emits `doolaar 300` / `doolaar
 *  4000` bare on the same reasoning. Inserting it here would be this layer legislating for a file it does not
 *  own (trap 10's neighbour: put the operand back, do not re-spell it).
 *
 *  ⚠ TWO ARMS, BECAUSE THE SYMBOL IS WRITTEN ON BOTH SIDES, and both converge on ONE output order.
 *  `KM_PRE` handles the already-native `km 2,04` shape — the symbol is simply swapped for the word and the
 *  figure never moves. It requires WHITESPACE before the figure, which is what keeps it off `20.4 km2`
 *  (whose `2` is the exponent, not an operand) while still consuming the exponent on `km2 77.0`.
 *  `KM_POST` handles `140 km`, `100km`, `18,476km`, `225.67km^2` and reorders.
 *
 *  ⚠ `KM_POST` SPANS A RANGE DELIBERATELY. `20--40 km (12-25 mi)` is in the corpus, and mos has NO range
 *  joiner (see the header — 47%-Mooré cell, football scores). Matching only the right endpoint would emit
 *  `20--kilometr 40` and drop the unit noun into the middle of the span; because Mooré is head-initial the
 *  whole span can keep its shape behind one noun instead — `kilometr 20--40` — which reads as the two bare
 *  cardinals it already read as, now with the unit attached. This is a shape the postposing languages in this
 *  tree cannot have, and it is free here.
 *
 *  ⚠ BOTH LOOKAROUNDS ON EVERY ARM. `km` is two ASCII letters in a Latin-script language, so an unguarded key
 *  bites into ordinary words (trap 6: a Latin residue in a Latin script is invisible to every leak class). */
/** The bare-token pass for the same word — see the step that applies it. */
const BARE_UNITS = makeBareUnitNormalizer([["km", "kilometr"]]);

const KM_PRE = /(?<![\p{L}\p{M}\d])km(?:\^?2|²)?\s+(?=\d)/gu;
const KM_POST = /(?<![\d.,\p{L}\p{M}])(\d+(?:[.,]\d+)?(?:\s?-{1,2}\s?\d+(?:[.,]\d+)?)?)\s?km(?:\^?2|²)?(?![\p{L}\p{M}\d²³/])/gu;

/** Mooré normalization. A numbered, order-dependent sequence; the coupling is stated at each step. */
export function normalizeMossi(input: string): string {
    // 1) NFC at the entry, so a literal in this file matches whichever normalization the dump used. Mooré's
    //    own letters ⟨ɛ ɩ ʋ ŋ⟩ do not decompose, but its NASAL vowels are written with a combining tilde
    //    that has precomposed equivalents for ⟨ã ẽ ĩ õ ũ⟩ and none for ⟨ɛ̃ ɩ̃ ʋ̃⟩, so one wiki paragraph
    //    carries both forms and they render identically. Trap 11 in a Latin script. The g2p NFCs
    //    downstream, so this costs nothing there.
    let s = renormalize(input, "NFC");

    // 2) HTML ENTITIES AND ZERO-WIDTH MARKS, before anything that counts characters — a dump carries
    //    `&nbsp;` and numeric entities, and `&nbsp;` inside a grouped figure would otherwise hide the space
    //    that step 3 matches on. The artifact's `zero-width` cell is ×2; a rendering hint is not speech.
    s = rewrite(rewrite(s, /&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " "), /[​‌‍⁠﻿]/gu, "");

    // 3) DIGIT DE-GROUPING — FIRST among the number rules, and the playbook's own ordering rule says why: a
    //    grouping comma or period is otherwise read as CLAUSE PUNCTUATION, which is precisely the defect
    //    here (`vote 21,552` → *vote pisi la a je , kobs a nu la pis nu la a ji*, a pause dropped into the
    //    middle of one figure). ~983 instances in the filtered corpus, the largest thing this layer fixes
    //    and the only one that needs no vocabulary at all.
    //
    //    ⚠ SPACE FIRST, then comma, then dot. The three arms cannot feed each other — each is anchored on
    //    both sides against `[\d.,]` — but the space arm must run before any rule that inserts a space
    //    between a figure and a following word, and step 4 is one.
    s = rewrite(s, GROUPED_SPACE, (_m, head: string, rest: string) => head + rest.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space
    s = rewrite(s, GROUPED_COMMA, (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));
    s = rewrite(s, GROUPED_DOT, (_m, head: string, rest: string) => head + rest.replace(/\./gu, ""));

    // 4) CURRENCY, AFTER de-grouping — the sign is written against the figure's FIRST digit (`€10,000`), so
    //    matching the whole figure here means matching what step 3 has already joined up. Run the other way
    //    round, this rule would consume `€10` and leave `,000` behind as a clause pause plus a bare zero.
    //    The noun is emitted BEFORE the figure (see CURRENCY): Mooré puts it there.
    for (const [sign, word] of CURRENCY) {
        const rx = new RegExp(`${sign.replace(/[$]/gu, "\\$&")}\\s?(\\d)`, "gu");
        s = rewrite(s, rx, `${word} $1`);
    }

    // 5) THE KILOMETRE, LAST — and AFTER step 3 for the same reason step 4 is: the symbol is written against
    //    a grouped figure (`18,476km`, `km 3,245`), so the operand this rule re-emits has to be the one
    //    de-grouping has already joined up. Run before step 3 it would emit `kilometr 18` and leave `,476`
    //    behind as a clause pause. It does not interact with step 4 — no corpus instance carries a currency
    //    sign and a unit on the same figure — and is placed after it only so the two reordering rules read in
    //    one direction.
    //
    //    ⚠ PRE-ARM FIRST. The two arms are disjoint by construction (`KM_PRE` demands whitespace-then-digit
    //    after the symbol, `KM_POST` demands a digit before it), so the order is documentation rather than
    //    load-bearing — but running the native-order arm first keeps the reordering arm from ever seeing a
    //    figure that was already correctly placed.
    //
    //    ⚠ THE EXPONENT IS CONSUMED AND UNREAD, and that is a stated loss, not a fix — see the header. What
    //    it replaces is worse than a silence: `km2 77.0` read as *km* raw plus the CARDINAL TWO.
    s = rewrite(s, KM_PRE, "kilometr ");
    s = rewrite(s, KM_POST, "kilometr $1");
    //    …and the same symbol with no figure at all — a caption, a table header, or a figure a bracket put
    //    out of reach. Both arms above require a digit, so those went to the sink as raw Latin. Shared
    //    guards (core/normalizeSymbols.ts): multi-letter vowel-free keys, exact case, never beside a
    //    numeral, a rate slash or an exponent — so the `km²` refusal above is untouched.
    s = BARE_UNITS(s);

    return s;
}
