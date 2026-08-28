/**
 * Zhuang / Vahcuengh (za) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR ZHUANG. The evidence is `tools/corpus/mined/za.jsonc` plus a fresh
 * za.wikipedia dump — 7,328 paragraphs from `wikidump-to-text.py`, of which **2,929 are Zhuang** after a
 * function-word filter. Every count below is over that Zhuang-only subset unless it says otherwise. Full
 * log: `docs/investigations/za_normalization_investigation.md`.
 *
 * ⚠⚠ AND THE FILTER IS NOT OPTIONAL HERE — THE ARTIFACT'S HARD-SET IS MOSTLY NOT ZHUANG. za.wikipedia
 * carries whole imported GERMAN (the `Panzerkampfwagen IV` article) and ENGLISH (Perlmutter, Book of
 * Mormon) articles; `mine.ts` selects adversarially, so those pattern-rich paragraphs dominate exactly the
 * cells a rule would be written from. This is the su.wikipedia lesson (playbook §0b) reproduced almost
 * exactly. The filter validates itself on words that cannot cross the boundary:
 *
 *     nienz 907 / bi 115 / nyied 288 / hauh 251   in the Zhuang subset · ALL ZERO in the other 814
 *     ISBN 0 vs 11 · roman 11 vs 169 · `$` 0 vs 3 · comma-decimal 1 vs 25
 *
 * So `currency` is a cell about ENGLISH text sitting in za.wikipedia — the artifact's three `$` are
 * `$500,000`, `$179,113` and `$15,000`, all inside English sentences — and no currency rule is written
 * here. Likewise the comma is a GROUPING mark in Zhuang (×73) and a decimal mark only in the German
 * paragraphs (×25 there, ×1 here).
 *
 * WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes — the defect list, not an assumption:
 *
 *     …ndeu。Gijgvangj…  → NO PAUSE AT ALL              CJK punctuation is invisible (×4,700; see step 2)
 *     83.5%             → …peːt ɕiːp θaːm . haː tɯk    the sign SILENT and the dot a SENTENCE BREAK
 *     1,130.81          → ʔiːt , ʔiːt paːk θaːm ɕiːp . peːt…   "one, one hundred thirty. eighty-one"
 *     357 021           → sam bak haj cib caet · ngeih cib it   two numbers
 *     1749-1832         → two bare cardinals, no connective     (×28 digit pairs, ×95 `nienz-` spans)
 *     35 °C             → sam cib haj + a bare [ɕ]              the scale letter as a stray consonant
 *     1.4 ik km²        → …ʔiːk kʰm                             unit raw, exponent gone
 *     810km2            → …kʰm ŋeːiː                            unit raw, the `2` read as the NUMBER two
 *     -422m             → seiq bak ngeih cib ngeih + [m]        sign silent, unit raw
 *     5/6               → haj roek                              two bare cardinals
 *     259BC-210BC       → …koːuː [pɕ]…                          a VOWEL-LESS cluster, ×10
 *     (Sawgun: 崇左市)    → poː / nothing                         a CHINESE gloss read as Zhuang syllables
 *     A & B             → nothing at all
 *
 * ── HOW THE HIGH-TRAFFIC WORDS ARE SOURCED ────────────────────────────────────────────────────────────
 *
 * ⚠ THE FRACTION IDIOM IS THE KEYSTONE, AND IT IS ATTESTED TWICE, IN TWO ARTICLES, IN THE SLOT. Zhuang
 *   forms a fraction as DENOMINATOR + `faenh cih` + NUMERATOR — the 分之 construction:
 *
 *       Ninz ciemq le seizgan seiqvunz gaenh SAM FAENH CIH IT.       sleep takes nearly ONE THIRD of a life
 *       cijmiz digiuz geij cien ik FAEN CIH IT caemq                 only a few-thousand-billionth of Earth
 *
 *   Both are ordinary Zhuang prose that glosses itself; `attest.ts --lang za` re-finds both with the sense
 *   intact. That settles the fraction rule (step 8) outright, and it is what the percent word composes
 *   from (step 7) — `bak` (100) is the engine's own `numbers.hundred` and occurs ×368. See step 7 for the
 *   limit on that composition, which is stated rather than hidden.
 *
 * ⚠ THE RANGE CONNECTIVE IS THE CORPUS'S OWN, WRITTEN BETWEEN NUMBERS. `daengz` ×310, and ×6 of those sit
 *   between two numerals in exactly the slot the rule fills: `aen ndwen miz 28 daengz 31 aen ngoenz`,
 *   `85 daengz 90%`, `13 daengz 18 sigi`, `35 °C daengz 39 °C`, `Coengz 420 daengz 361 B.C.`. No invention,
 *   and `attest.ts` returns it ×40 across 19 articles.
 *
 * ⚠ THE UNIT WORDS ARE THE COMMONEST NOUNS IN THE CORPUS. `goengleix` (km) ×162, `bingzfueng goengleix`
 *   (km²) ×159 — the county-article boilerplate `Gijgvangj dwg 2159 bingzfueng goengleix` states an area in
 *   nearly every place article — `meix` (m) ×6, `leizmeix` (cm) ×1. Position is POSTPOSED (`2129 meix`,
 *   `345 goengleix`) and the squared word is a PREFIX ON THE NOUN, not a suffix on the number, which is why
 *   `km²` is spelled as its own key rather than composed (playbook trap 44).
 *
 * ⚠ THE ERA MARKER WAS ALMOST MISSED TO A HOMOGRAPH, AND THE SENSE CHECK IS WHAT SAVED IT. `gunghyenz` ×4:
 *   two are 公园 "PARK" (`gyaeundei lumj aen gunghyenz nei`, `Bwzhaij Gunghyenz`) and two are 公元 "common
 *   era" — `gaxgonq gunghyenz 12 sigij` in the dump and `Gunghyenz gonq 202 bi` from `attest.ts`, i.e. two
 *   independent hits, both PREPOSED before the figure, which is the order this rule emits. Trap 37 exactly:
 *   the bare token count is a lead and the sense is the finding.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO DECIMAL-POINT WORD, so the fractional digits are read one at a time with no separator. `sources.ts`
 *   finds no `_dpt`, no `_.` and no manifest word, and espeak does not ship Zhuang at all. The one plausible
 *   candidate is `diemj` (点) ×29 — and every instance is a different sense: "to light" a lamp
 *   (`diemj daeng`, `diemj feiz`), "point" of a plan (`haj diemj hozbingz giva`), and `diemj cung` ×14 =
 *   o'clock. None is the decimal point. A dropped point beats an invented one; the defect being fixed here
 *   is the spurious PAUSE and the mis-read tail, not the missing word.
 *
 * ⚠ NO MINUS WORD, AND THIS ONE IS KNOWN-WRONG RATHER THAN ACCEPTABLE — the Lingala precedent. Omitting a
 *   plus is lossless; omitting a minus INVERTS. The corpus's three true negatives are all one article's
 *   Dead Sea elevations (`dwg -422m`, `dwg -418m`, `gemj daengz -420m`), and no Zhuang word for a negative
 *   number is attested anywhere. ⚠ SO za IS NOT IN `ACCEPTED_SIGN_SILENCE` FOR `minus` and
 *   `review.ts --lang za` stays red on it. An accepted silence claims the drop is correct; this one is not.
 *
 * ⚠ NO DEGREE OR SCALE WORD. `doh` (度) ×33 and `attest.ts` returns five examples, none of them a degree:
 *   `faenbouh doh daengx siqgyaiq` ("throughout"), `cienz doh lajbiengz` ("spread everywhere"), and
 *   `Yaenq Doh` = INDIA. `dohraeuj` ×1 is the noun "temperature", not a unit. `Sesi`/`Sipsi` (摄氏) ×0.
 *   So step 6 CONSUMES `°C` without reading it — which is a deliberate downgrade from a wrong reading to a
 *   silence, because what it replaces is the scale letter reaching the IPA as a bare [ɕ]. Recorded in
 *   `ACCEPTED_SIGN_SILENCE`, class `degrees`, with this measurement.
 *
 * ⚠ NO `= × ÷ + < >`. Nine sign instances, and NOT ONE is arithmetic between two numbers. Three are
 *   METALINGUISTIC — the wiki's own stub articles about the operations, which name the symbol in quotes
 *   (`Swngzfap dwg cungj suenqsoq, fouzhauh dwg "×", gezgoj dwg "giz"`) — one is SCIENTIFIC NOTATION
 *   (`5.976×10(27)`), two join words (`insectum «Non» + caedo`, `laengconghndaeng+gwnz hoz`), and one is a
 *   stray `<`. Those stub articles do give the operation NOUNS (`Gemjfap`, `Swngzfap`, `Cawzfap`) and the
 *   RESULT nouns (`ca`, `giz`, `sieng`) — and neither is what a reader says BETWEEN two operands, which is
 *   trap 35's Hindi जोड़/धन distinction. Left unread.
 *
 * ⚠ NO CLOCK. Three colon-numerals in 2,929 paragraphs: `banringz 11:10` (one real clock), and the ratios
 *   `benjliz dwg 1:2982572220101` and `dancih caeuq yizsu dep 1:1`. Claiming the colon claims the ratios,
 *   and no Zhuang reading for a digital time is attested. The colon stays a pause.
 *
 * ⚠ NO INITIALISMS. `core/initialisms.ts` exists and ~30 languages wire it, but it is a NO-OP without a
 *   `letterName` table and espeak ships no Zhuang — `sources.ts` reports `letter-names [NONE] espeak does
 *   not ship this language at all`. This is the fleet-wide 94-language sourcing block, not a coding one
 *   (trap 16 checked: the seam exists, the DATA does not). `GDP` → [ktpʰ] stands.
 *
 * ⚠ ROMAN NUMERALS ARE ALREADY HANDLED UPSTREAM. za is not in `ROMAN_NATIVE`, so `registry.ts` converts
 *   them to digits before `text()` runs — verified end-to-end on an operand that would break if the order
 *   were wrong: `Elizabeth II` reads *ngeih* and `Panzerkampfwagen IV` reads *seiq*. No roman rule here.
 *
 * ⚠ ONLY BRACKETED HAN IS TREATED AS A GLOSS (step 1). 226 of the corpus's 1,439 Han runs are unbracketed
 *   — Chinese bibliographies (`廣西壯族自治區少數民族語言文字工作委員會編`) and bare county lists
 *   (`Daengx si guenj 青秀区, 兴宁区, 西乡塘区 caeuq Vujmingz`) — and they are Chinese too, but nothing in the
 *   text marks them as such, and the same shape is how genuine Sawndip prose reaches this engine
 *   (`za.text("gou 佲")` is a pinned behaviour). Stated as a limit rather than guessed at.
 *
 * ── AND THE FINDING THIS LAYER RAISED AND `numbers.ts` ANSWERED ───────────────────────────────────────
 *
 * ⚠ THE NUMBER DATA DISAGREED WITH THE CORPUS AND HAS SINCE BEEN FIXED — but not in the direction the
 *   count suggested, so the correction is worth keeping next to the count that raised it. za.wikipedia
 *   carries 172 natural-number stub articles that write the word and the digits side by side
 *   (`Bak lingz it(101) dwg aen swhyienzsoq`, `Ngeih cib loeg(26)`). They are ONE hand-typed series with
 *   copy errors in it — 110 and 111 carry the same title — and the whole of their apparent majority for
 *   `loeg`/`bat` lives inside them (`roek` 58 : `loeg` 9 and `bet` 26 : `bat` 4 once they are removed).
 *   What they did settle is the CONSTRUCTION: the `lingz` zero-filler, and `bak it cib` for 110. The
 *   words `roek`, `bet` and `it bak` stand. The whole argument is in `numbers.ts`'s header.
 *
 * ⚠ AND `numbers.million` WAS A MISLABEL OF 萬 — `fanh` is 10⁴, not 10⁶. The field is now `myriad`, with
 *   `hundredMillion: "ik"` (10⁸) above it, and `numberToWords` composes myriad groups like Chinese.
 *   This layer still emits DIGITS throughout, so nothing here is built on top of either.
 */
import { MANIFEST } from "./manifest.ts";
import { renormalize, rewrite } from "../../core/provenance.ts";

/** The CJK-ideograph blocks Sawndip draws on — the same set `sawndip.ts` recognises, as a class body.
 *  ⚠ KEEP IN STEP WITH `sawndip.ts`'s `isIdeograph` AND `zhuang.ts`'s TOKEN: the three are one set spelled
 *  three times, and when the ideograph bounds lagged the dictionary it was 24 unreachable readings. */
const HAN = "\\u{3007}\\u{3400}-\\u{4dbf}\\u{4e00}-\\u{9fff}\\u{f900}-\\u{faff}\\u{20000}-\\u{2ee5f}\\u{2f800}-\\u{2fa1f}\\u{30000}-\\u{3347f}";
const HAN_RUN = new RegExp(`[${HAN}]+`, "gu");
const HAS_HAN = new RegExp(`[${HAN}]`, "u");
/** A script/language LABEL the corpus itself writes in front of a foreign-script gloss. `Sawgun` is
 *  literally "Han writing" and `Vahgun` "Chinese language", so what follows is CHINESE by the text's own
 *  statement; `Sawndip` labels the Zhuang logographic spelling of the word just said. */
const GLOSS_LABEL = new RegExp(
    `(?:Sawgun|Vahgun|Sawndip|Sawdai|Binghyaem\\s+Vahgun|Ciqyaem\\s+Gaeuq|gyoepyaem|拼音)\\s*[:：]\\s*(?=[${HAN}])`,
    "giu",
);
/** A bracket group with no nesting — every gloss in this corpus is flat. */
const BRACKET = /[(（《「『][^()（）《》「」『』]*[)）》」』]/gu;

/**
 * ⚠ ASCENDING DIGIT PAIRS ONLY, and the guards are what make this survivable. `\d+ ?[-–] ?\d+` matches 69
 * times over the whole dump and a large share are not ranges: an ISRC (`CN-Z20-08-0003-0`), ISBNs in the
 * German paragraphs (`3-7637-5988-3`), and the descending halves of longer chains.
 *
 * · a hyphen-digit on EITHER side rejects the identifier chains — the pair must be the whole thing;
 * · a preceding `:` rejects the ratio `1:2982572220101`, which the colon rule deliberately does not claim;
 * · NON-ASCENDING is left as the bare juxtaposition it already was: a score or a descending pair reads with
 *   a different connective, so claiming it would be confidently wrong.
 *
 * What this leaves is what the corpus actually writes: BIRTH–DEATH year pairs (`Goethe(1749-1832)`,
 * `Cervantes(1547-1616)`, `Cu Heih(朱熹,1130-1200)` — 20 of the 28), dynastic spans
 * (`Cingciuz(清朝,1644-1911)`), issue and month spans (`daih 7-11 geiz, 2008 nienz 7-11 nyied`), an
 * elevation band (`haijbaz 1000-1500 m`) and a population span (`15-21 ik bouxyungjhu`). Every one is
 * ascending and every one is a genuine range.
 *
 * ⚠ THE TRAILING SEPARATOR TEST IS `[.,]\d`, NOT A BARE `[.,]`, and the difference is a whole defect class.
 * A dot or comma with NO digit after it is not part of a number — it is the END OF THE CLAUSE — and the
 * bare form declined every span that ends a sentence: the reference lists' `p. 137-157,` and `pp443-446.`
 * and `pp. 8-16.` came back untouched and read as two juxtaposed cardinals with no connective at all
 * (playbook trap 58, reported by `review.ts`'s `clause-final` check). What the exclusion exists for is a
 * CONTINUATION of the number, which is exactly what a following digit tests: a decimal `1000-1500.5` and a
 * grouped `1-1,000` are still refused, and so is the DOI `10.1080/…` that follows one of those spans.
 */
const RANGE = /(?<![\d.,:\p{L}\p{M}-])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}-]|[.,]\d)/gu;

/**
 * ⚠ THE DASH ALSO FOLLOWS A DATE NOUN, AND THAT IS THE COMMONER SHAPE — trap 15's lesson generalised from
 * a bound suffix to a bound connective. Searching only for digit-dash-digit finds 28 spans; searching for
 * the MORPHEME that ends the left operand finds 95 more, and they are the same construction:
 *
 *     Hanciuz(…gonq 202 nienz-220 nienz)          Dangzciuz(…618 nienz-907 nienz)
 *     Cangh Hwngz(…78 nienz－139 nienz)            Saehan (gonq 202 nienz–9 nienz)
 *     Charles Darwin(1809 nienz 2 nyied 12 hauh-1882 nienz 4 nyied 19 hauh)
 *
 * The left operand is a DATE, so the dash is a span connective and nothing else — a date noun is never
 * followed by a subtraction. The arm is deliberately NARROWER than the digit arm (trap 9): it requires the
 * three date nouns the corpus actually writes before a dash, and it cannot test ascending order because
 * `12 hauh-1882 nienz` compares a day against a year.
 */
const DATE_RANGE = /(?<=(?:nienz|nyied|hauh|ngoenz|sigij|geiz))\s?[-–—]\s?(?=\d)/gu;

/** ⚠ LONGEST KEY FIRST — `km²`/`km2` must be tried before `km`, or the exponent is orphaned as a NUMBER,
 *  which is exactly what `810km2` did (`…kʰm ŋeːiː`, the unit raw and the 2 read as *ngeih*). The squared
 *  word is a PREFIX on the unit noun in Zhuang (`2159 bingzfueng goengleix` ×159), so it is spelled into
 *  the key rather than composed — no `exponentWords` position could express it (trap 44). */
const UNITS: readonly (readonly [string, string])[] = [
    ["km²", "bingzfueng goengleix"], ["km2", "bingzfueng goengleix"],
    ["km", "goengleix"], ["cm", "leizmeix"],
    // ⚠ THE ONE-LETTER KEY, AND IT IS DECLARED WITH BOTH TRAP-28 GUARDS RATHER THAN ON A CLEAN COUNT.
    // Digit-adjacent bare `m` is ×8 and every instance is a genuine metre (`1m`, `-422m`, `1000-1500 m`,
    // `600－1400m`) — and trap 46 says that is not enough on its own, because what breaks a one-letter key
    // is a DOTTED DESIGNATION (`802.11m`), of which this corpus has zero. So the key ships with the
    // lookbehind AND the lookahead, and step 5 runs while the decimal point still EXISTS for them to
    // inspect (trap 39). The gain is real: without it `m` reaches the IPA as a bare [m].
    ["m", "meix"],
    // ⚠⚠ ⟨mm⟩ AND ⟨l⟩ ARE REFUSED, AND THIS IS THE SEARCH THAT REFUSED THEM — recorded because a bare
    // "no attested word" is exactly the note that turned out to be wrong for Māori's millimetre, and
    // because the corpus DOES write the millimetre: `Bi bingzyinz doekfwn noix gvaq 50mm` ("mean annual
    // rainfall under 50 mm"), so the key has an instance and only the WORD is missing.
    //
    //   ⟨mm⟩ — Zhuang borrows the metre in TWO shapes and this wiki writes both: `-meix` (`leizmeix` 厘米,
    //          ×1, `166.4 leizmeix sang`) and `-mij` (`bingzmij` 平方米 ×2 in one article, `namij`/`Nazmij`
    //          nanometre — the wiki has a NAZMIJ ARTICLE and writes `daj 630 namij daengz 750 namij` for a
    //          wavelength). Composing 毫米 from either would give `hauzmeix` or `hauzmij`, and BOTH ARE
    //          ABSENT EVERYWHERE PROBED: 0 hits on za.wikipedia (`insource:"hauz"` returns 0 for the bare
    //          morpheme too), no entry in the Zhuang lemma set of en.wiktionary (1,291 lemmas — it has
    //          `goengleix` "kilometre" but nothing below the centimetre), no translation on Glosbe zyb,
    //          and no 毫米 row in a 13,619-entry Chinese→Zhuang dictionary. What that dictionary DOES have
    //          is 毫 → `hauz` — the bare MODIFIER, which trap 37 says is never the attestation. This is the
    //          Fula `tere` shape precisely: a composable prefix, a composable head, and no evidence anyone
    //          composes them. 釐米 → `leizmeix, lizmij` in the same source is why the head is trusted and
    //          the compound is not.
    //   ⟨l⟩  — `swng` (升) is the obvious candidate and it is ATTESTED WITH THE WRONG SENSE, which is the
    //          `bar`/`ti`/`ht` failure. The Zhuang→Chinese dictionary glosses it "升; 提高" (to rise, to
    //          promote) and then, as a measure, 量米筒 — a rice-measuring TUBE holding about a catty, the
    //          traditional dry measure, not the litre; 公升 has no Zhuang row at all. Both za.wikipedia
    //          tokens are the wrong sense too (直升機 "helicopter", and 《頌》 of the Book of Odes), and in a
    //          4,944-sentence Zhuang–Chinese parallel corpus every `swng` is 升级 / 提升 / 上升, the verb.
    //          Declaring it would read "ten litres" as "ten rice-tubes".
    //
    // ⚠ AND `mij` IS WHY A ONE-LETTER-ADJACENT GUESS HERE WOULD HAVE BEEN WORSE THAN SILENCE: as a free
    // word `mij` is the NEGATOR "not" (dictionary: 不; `mij lae okbae`, `mij raen`, `mij rox`), ×6 on the
    // wiki and every one a negation. The metre reading only exists inside a compound.
    //
    // ⚠ THE `mm` REFUSAL WAS RE-OPENED AND STANDS, and re-reading the hits ALSO SHRINKS WHAT IT COSTS. The
    // raw-Latin scan reports `mm` ×4, which reads as four missing millimetre readings. It is not: THREE of
    // the four sit in wholly GERMAN sentences that reached this artifact as dump debris from the tank
    // articles — `Frontpanzerung von 80 mm und der 7,5-cm-KwK L/48`, `die bis zu 80 mm starke Panzerung des
    // schwerfälligen Matilda`, `Seine lange Kanone war der 75-mm-Kanone des Sherman weit überlegen`. Not one
    // Zhuang word is in any of them, and a millimetre inside a German sentence tests German. The GENUINE
    // Zhuang instance is the ONE already named above (`Bi bingzyinz doekfwn noix gvaq 50mm`), which is
    // exactly why that sentence and no other is what this refusal is argued against. No new evidence has
    // appeared for the word; the search above is unchanged and `hauzmij` is still absent from every tier.
    // ⚠ `pp` ×3 IS THE OTHER HALF OF za's RESIDUAL AND IS NOT A UNIT AT ALL — English bibliographic page
    // ranges in reference lists (`Vol. 14, pp443-446`, `Vol. 5, No. 2, pp. 8-16`, `(Bloomington, Indiana)
    // 1993 pp. 101–9`). Citation furniture in a foreign language, correctly left reported.
];

/** Expand a foreign-script gloss out of one bracket group, or drop the group if nothing else is in it. */
function stripGloss(group: string): string {
    if (!HAS_HAN.test(group)) return group;
    const open = group[0]!, close = group.slice(-1);
    const inner = group
        .slice(1, -1)
        .replace(GLOSS_LABEL, "")
        .replace(HAN_RUN, " ")
        // the CJK punctuation that GLUED the dropped runs together is now dangling: `(: ; : Píngxiáng)`
        .replace(/[,;:、，；：]\s*(?=[,;:、，；：]|$)/gu, " ")
        .replace(/^[\s,;:、，；：]+/u, "")
        .replace(/\s{2,}/gu, " ")
        .trim();
    return /[\p{L}\p{N}]/u.test(inner) ? `${open}${inner}${close}` : " ";
}

/**
 * Zhuang text normalization. A numbered sequence of ORDER-DEPENDENT steps; each comment states the
 * coupling, because a future reader cannot recover it from the code.
 */
export function normalizeZhuang(input: string): string {
    // 0) NFC at the entry, so a literal here matches whichever normalization the corpus used. Zhuang's own
    //    letters are unaccented ASCII, but the dump carries precomposed and decomposed forms of the
    //    embedded names, and `’` (U+2019) is folded at step 2 into the syllable-boundary `'` the g2p reads.
    let s = renormalize(input, "NFC");

    // 1) HTML ENTITIES, ZERO-WIDTH MARKS, AND THE FOREIGN-SCRIPT GLOSS — all before anything else looks at
    //    a bracket or a mark. The entity strip must precede the ampersand rule at step 9 or `&nbsp;` is
    //    read as "and" plus the letters n-b-s-p; the zero-width strip is ×8 (every one opens a paragraph).
    //
    //    ⚠ THE GLOSS PASS MUST RUN BEFORE STEP 2, because it keys on the FULL-WIDTH brackets `（）《》` that
    //    step 2 folds away. This is trap 39 in its plainest form: a guard's evidence has a lifetime.
    //
    //    ⚠ AND IT IS THE SECOND-LARGEST DEFECT IN THE LANGUAGE, measured rather than assumed. 1,439 Han
    //    runs occur in the 2,929 Zhuang paragraphs; 1,213 (84.3%) sit inside a bracket, and reading 25 of
    //    the rest at random found Chinese personal names, Chinese book titles, Chinese county lists and
    //    whole Chinese sentences — not one is Sawndip-as-running-text. Only 25 runs carry a `Sawndip:`
    //    label at all, against 226 explicitly labelled `Sawgun`/`Vahgun`/`拼音`, i.e. labelled CHINESE.
    //    Meanwhile `sawndip.ts`'s dictionary resolves 31.7% of those glyphs, so the status quo is not
    //    silence — it is a Chinese gloss emitting unrelated Zhuang syllables (`(Sawgun: 崇左市)` → *poː*).
    //    A parenthetical spelling gloss is not spoken in any case: the word it glosses was just said.
    s = rewrite(rewrite(s, /&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " "), /[​‌‍﻿]/gu, "");
    s = rewrite(s, BRACKET, stripGloss);

    // 2) CJK PUNCTUATION → ASCII. THE SINGLE BIGGEST DEFECT IN THE LANGUAGE, and it is pure data: the
    //    engine's `clausePunctuation` and its `TOKEN` both know only `[.!?…,;:]`, while Zhuang wiki prose
    //    is punctuated in the Chinese style. Counted over the Zhuang subset:
    //
    //        、 2253    ， 1500    。 789    ： 486    ； 118    ？ 24    ！ 8
    //
    //    Every one of those ~5,200 marks was SILENT — `…ndeu。Gijgvangj…` ran two sentences together with
    //    no break at all. This is trap 36's fold (one code point meaning exactly what an ASCII mark means)
    //    and trap 17's rule that a mark which should be a pause and instead vanishes is in scope.
    //
    //    ⚠ `’` FOLDS TO THE APOSTROPHE, NOT TO NOTHING, and the direction matters. U+2019 occurs ×250 and
    //    is overwhelmingly the Zhuang SYLLABLE-BOUNDARY mark inside a word (`fueng’yiengq`, `daih’iek`,
    //    `Tian’e`), which `zhuang.ts` reads as an explicit syllable break; deleting it would fuse the
    //    syllables. The curly DOUBLE quotes (×169/×175) and the rare `‘` (×5) are real quotation marks and
    //    are dropped, as ASCII `"` already is.
    //
    //    ⚠ THE DASHES FOLD TO `-` SO STEP 4 CAN SEE THEM. `－` (U+FF0D) ×32 and `—` ×33 are this corpus's
    //    ordinary range dash (`78 nienz－139 nienz`, `600－1400m`); leaving them unfolded would make the
    //    range rule silently miss a third of its instances. Folding is safe because a bare `-` is silent.
    //    ⚠ NOT A BLANKET `NFKC` (trap 36): that would turn `²` into `2` and erase the exponent readings
    //    step 5 depends on, and this corpus writes `²` for both a unit power AND a romanization tone.
    s = rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(rewrite(s
        , /[。｡]/gu, "."), /[、，]/gu, ","), /；/gu, ";"), /：/gu, ":")
        , /？/gu, "?"), /！/gu, "!"), /[‧·・]/gu, ",")
        , /’/gu, "'"), /[“”‘「」『』]/gu, " ")
        , /[—－～〜]/gu, "-"), /[（）《》〈〉【】\u3000]/gu, " ")  // ideographic space
        , /％/gu, "%"), /＆/gu, "&");

    // 2b) THE MINUS — U+2212 ONLY, PREPOSED, and BEFORE the era and range rules so a span cannot claim the
    //    sign's operand first. `lingzha` < Chinese 零下; see zhuang.jsonc for what is verified (`lingz` is
    //    the 零 loan that already carries Zhuang's own zero) and what is not (the word is ×0, and the second
    //    syllable's tone is a guess).
    //    ⚠ U+2212 ONLY. The ASCII hyphen here is the range mark this file's own step 4 reads (`259BC-210BC`,
    //    `551 BC – 479 BC`) and the corpus's Dead Sea elevations are written with it too — `sang daemq
    //    Haijdai dwg -418m … gemj daengz -420m`, which is exactly the population that WOULD be worth
    //    claiming and exactly the character that cannot be told from a span. U+2212 can only be the operator.
    //    ⚠ `(?<!\p{Nd}\s)` refuses the space-separated negative exponent, the fleet-wide guard.
    s = rewrite(s, /(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)\u2212(?=\p{Nd})/gu, `${MANIFEST.minus} `);

    // 3) ERA MARKERS, before de-grouping and before the range rule. `BC` ×10, written both glued and
    //    spaced and on BOTH sides of a span (`259BC-210BC`, `273 BC daengz 232BC`, `551 BC – 479 BC`,
    //    `3150 BC baedauq`). Two reasons this must be first among the numeric rules:
    //      · the engine read the marker as a WORD — `BC` → [pɕ], a vowel-less cluster, ×10; and
    //      · `259BC-210BC` is the exact shape RANGE looks for, so leaving the markers in place would let
    //        step 4 claim the span and strand the `BC` on either side of the connective.
    //    ⚠ THE PHRASE IS PREPOSED, which is what the two attestations show (`gaxgonq gunghyenz 12 sigij`
    //    in the dump, `Gunghyenz gonq 202 bi` from attest.ts), and it is the opposite of where the
    //    abbreviation sits. `gonq` ("before") is the corpus's own word, ×hundreds.
    //    ⚠ THE SPAN ARM MUST COME FIRST, and it is not reachable by step 8. Once each end is words there
    //    is no digit pair left for RANGE to match, and RANGE could never have matched `259BC-210BC` in the
    //    first place — its lookahead refuses a letter after the first operand. So the span is claimed here,
    //    with the same `daengz` connective step 8 uses. ×2 (`259BC-210BC`, `100BC-44BC`).
    //    ⚠ AND THE DOTTED FORM DOES NOT CONSUME ITS SECOND DOT. `Coengz 420 daengz 361 B.C.` ends a
    //    sentence, so swallowing the trailing period would delete the pause — the Swahili/Lingala
    //    `expandDotted` hazard, avoided here by simply not matching that dot.
    const BCE = "\\s?B\\.?C(?![\\p{L}\\p{M}])";
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d+)${BCE}\\s?[-–—]\\s?(\\d+)${BCE}`, "gu"),
        "gunghyenz gonq $1 daengz gunghyenz gonq $2");
    s = rewrite(s, new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d+)${BCE}`, "gu"), "gunghyenz gonq $1");

    // 4) DIGIT DE-GROUPING, before every other numeric rule — a grouping mark is otherwise read as clause
    //    punctuation and the tail as a separate number (`1,130.81` → *ʔiːt , ʔiːt paːk θaːm ɕiːp . …*).
    //
    //    ⚠ THE COMMA ONLY, PLUS THE SPACE. This is the one place the language filter changes the RULE and
    //    not merely the noise. In the Zhuang subset the comma is a grouping mark ×73 and a decimal mark
    //    ×1; in the German paragraphs of the same wiki it is a decimal mark ×25. Reading the artifact's
    //    hard-set alone would have produced a comma-decimal rule for Zhuang. The DOT is Zhuang's decimal
    //    separator (×125) and dot-grouping is ×0 — the two `\d{1,3}\.\d{3}` candidates are both decimals
    //    (`468.484 bingzfueng goengleix` is New York's area in square miles; `5.976×10(27)` is Earth's
    //    mass) — so there is no dot-degrouping arm at all, and adding one would break 125 decimals.
    //
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, NOT A CLAUSE MARK. A plain `(?![\d.,])`
    //    refuses to de-group a number followed by its own sentence comma.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)/gu, (w) => w.replace(/,/gu, ""));
    //    The SPACE form (×3: `357 021 bingzfueng`, `8 200 fanh`, `52 fanh 6 500 cih`) additionally has to
    //    reject a bare adjacency that is really two numbers in a list. Requiring every group to be exactly
    //    three digits does that: `2008 nienz 7-11 nyied` has no 3-digit group to join.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 5) UNITS, before decimals — the number-unit adjacency this rule matches on is destroyed the moment a
    //    decimal is rewritten into spaced digits (the playbook's standing "units before decimals"
    //    coupling), and after de-grouping so a grouped operand is already one token. Zhuang POSTPOSES its
    //    measure nouns (`2129 meix`, `345 goengleix`), so the rewrite keeps the written order.
    //
    //    ⚠ THE OPERAND MUST INCLUDE ITS OWN DECIMAL TAIL, `(\d+(?:\.\d+)?)`, or the rule matches the
    //    FRACTIONAL part and splits the number in half — measured on this corpus's own `1.4 ik km²`.
    //    ⚠ THE LEADING GUARD REJECTS A DOT AND THE TRAILING ONE A LETTER OR DIGIT: without the first, a
    //    dotted designation (`802.11m`) can start a match inside its fractional part, which a lookahead
    //    alone cannot prevent (trap 28); without the second, `km` bites into a longer word. This corpus
    //    contains ZERO dotted designations, so that half is robustness for plausible input rather than a
    //    measured repair — and it is exactly the exposure trap 46 says a one-letter key creates, which is
    //    why `m` is declared with both guards and nothing weaker.
    //    ⚠ A MAGNITUDE WORD MAY STAND BETWEEN THE NUMBER AND ITS UNIT, and without the arm the unit is
    //    orphaned. `Gijgvangq de dwg 1.4 ik km²` and `gij dijgiz dwg 10830 ik laebfueng goengleix` — `ik`
    //    is 10⁸ and `fanh` 10⁴, both ordinary post-numeral words here (`737 fanh` ×many). This is the
    //    fleet-wide `magAltU` gap (playbook trap 17's lb finding) closed LOCALLY: `magnitudes` is not
    //    declared for za and declaring it would change the number path, which is out of scope here. The
    //    magnitude is re-emitted, not consumed — trap 10.
    //    ⚠ `NOT_VERSION` IS LIFTED VERBATIM FROM `core/normalizeSymbols.ts`, AND IT CAUGHT A LIVE BUG HERE
    //    RATHER THAN GUARDING A HYPOTHETICAL ONE. The first version of this rule used only the leading
    //    `(?<![\p{L}\p{M}\d.,])`, which stops a match beginning INSIDE a number — and `802.11m` does not
    //    begin inside one, so the whole designation matched as an operand and read as *802 1 1 METRES*.
    //    That is trap 28's second half stated as an experiment: the lookbehind and the lookahead do
    //    different jobs and a one-letter key needs both. (Trap 46 adds that the corpus being clean is not
    //    evidence — this corpus has zero dotted designations and the bug was still there.)
    const NOT_VERSION = "(?<![\\d.,])(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";
    for (const [sym, word] of UNITS) {
        const key = sym.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        s = rewrite(s,
            new RegExp(
                `(?<![\\p{L}\\p{M}\\d.,])${NOT_VERSION}(\\d+(?:\\.\\d+)?)(\\s(?:fanh|ik))?\\s?${key}(?![\\p{L}\\p{M}\\d²³])`,
                "gu",
            ),
            (_m, n: string, mag: string | undefined) => `${n}${mag ?? ""} ${word}`,
        );
    }

    // 6) DEGREES — the sign and the scale letter are CONSUMED AND UNREAD, because no Zhuang degree or
    //    scale word is attested (see the header: `doh` is "throughout", `dohraeuj` is the noun
    //    "temperature", `Sesi` ×0). ×4, all one climate sentence: `gyang 35 °C daengz 39 °C`.
    //    ⚠ THIS IS A DOWNGRADE FROM A WRONG READING TO A SILENCE, NOT A FIX. What it replaces is the scale
    //    letter reaching the IPA as a bare [ɕ] — a consonant with no vowel, in a language where `c` is a
    //    real onset. `ACCEPTED_SIGN_SILENCE.za.degrees` records the refusal so the gate stays honest.
    //    ⚠ AFTER STEP 5, because `°C` is not a unit key and the unit rule's trailing guard would otherwise
    //    have to know about it; and the bare `°` is left alone — it has no instances here beyond these.
    s = rewrite(s, /(?<![\d.,])(\d+(?:\.\d+)?)\s?(?:°\s?[CF]|[℃℉])(?![\p{L}\p{M}])/gui, "$1");

    // 7) PERCENT — ×68, the layer's highest-traffic symbol rule and its THINNEST SOURCING, stated here
    //    rather than buried. The corpus never spells `%` out. What it does spell out is the FRACTION
    //    construction, twice, in two articles and with the sense visible (see the header): DENOMINATOR +
    //    `faenh cih` + NUMERATOR. A percent is that construction with the denominator fixed at a hundred,
    //    and `bak` = 100 is the engine's own `numbers.hundred`, ×368 in the corpus.
    //    ⚠ SO THIS IS COMPOSED FROM ATTESTED PIECES, NOT ASSERTED — the Fula `e teemedere` shape — and the
    //    limit is that the COMPOSITION itself (`bak faenh cih`) has zero direct hits. It ships because the
    //    alternative is 68 silent instances and because both pieces are sense-checked; a reader who finds
    //    a direct attestation should replace this comment with it rather than inherit the argument.
    //    ⚠ PREPOSED, which is what the fraction attestations fix: `sam faenh cih it` puts the whole
    //    denominator phrase in FRONT of the numerator, so `83.5%` is `bak faenh cih 83.5`.
    //    ⚠ AFTER STEP 4 (a grouped percentage must be one number) and BEFORE STEP 10 (the decimal tail has
    //    to still be attached, or the rule matches `5%` out of `83.5%`).
    //    ⚠ A PERCENT-TO-PERCENT SPAN IS CLAIMED FIRST, for the reason Lingala's is: `0.5%-5.0%` is not
    //    reachable by RANGE at all — a `%` stands between the digits and the dash — and once this rule has
    //    inserted a phrase between the operands there is no pair left to match. ×1 (`bingh dai beijlwd
    //    youq 0.5％－5.0％`), and the shape cannot be arithmetic, so it needs no ascending test beyond it.
    s = rewrite(s,
        /(?<![\d.,])(\d+(?:\.\d+)?)\s?%\s?-\s?(\d+(?:\.\d+)?)\s?%/gu,
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `bak faenh cih ${a} daengz bak faenh cih ${b}` : whole),
    );
    s = rewrite(s, /(?<![\d.,])(\d+(?:\.\d+)?)\s?%/gu, "bak faenh cih $1");

    // 8) RANGES. AFTER percent, because a percent span is claimed there and its operands are no longer
    //    bare digits; after de-grouping, so a grouped endpoint is one token; after step 3, so a `BC` span
    //    is already words. See RANGE and DATE_RANGE for the guards and for why non-ascending pairs are
    //    left alone. The connective `daengz` is the corpus's own, written between two numerals ×6.
    s = rewrite(s, DATE_RANGE, " daengz ");
    s = rewrite(s, RANGE, (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} daengz ${b}` : whole));

    // 9) FRACTIONS → the attested `faenh cih` idiom, WITH THE OPERANDS SWAPPED: Zhuang states the
    //    denominator first (`sam faenh cih it` = one third), so `5/6` is `6 faenh cih 5`.
    //    ⚠ THE CAP IS A RANGE, NOT A TABLE (trap 8): the rule COMPOSES, so `3/4` and `1/2` read correctly
    //    although the corpus writes neither — its single ASCII fraction is `ciemq 5/6 gijgvangj`. The
    //    numerator<denominator≤100 test is what keeps the rule off everything else a slash does here:
    //    `300g/L`, `ISRC …-0/V.G4`, and the URLs the dump leaves behind (`/www.cqvip.com`).
    //    ⚠ IT EMITS DIGITS and lets the engine's own number path speak them (trap 20 checked: the only
    //    numeral rule za has is the plain cardinal compositor, which has no context-sensitive branch a
    //    re-emitted digit could trip).
    s = rewrite(s, /(?<![\d\p{L}\p{M}/])(\d{1,3})\/(\d{1,3})(?![\d/])/gu, (whole, a: string, b: string) =>
        Number(a) < Number(b) && Number(b) <= 100 ? `${b} faenh cih ${a}` : whole);

    // 10) DECIMALS, after every rule that needs the number intact. The separator becomes NOTHING and the
    //     fractional digits are spaced apart so the number path speaks them one at a time — see the header
    //     for why there is no point word to insert. ×125, and what this fixes is the spurious SENTENCE
    //     BREAK: `83.5` was *peːt ɕiːp θaːm . haː*, a full stop in the middle of a quantity.
    //     ⚠ THE TRAILING LETTER GUARD keeps a dotted designation out (zero in this corpus; the same
    //     robustness argument as step 5), and the leading one keeps the rule from restarting inside a
    //     number it has already rewritten.
    s = rewrite(s, /(?<![\d.,])(\d+)\.(\d+)(?![\d\p{L}\p{M}])/gu, (_m, int: string, frac: string) =>
        `${int} ${[...frac].join(" ")}`);

    // 11) THE AMPERSAND — ×3 in the Zhuang subset and ×62 in the artifact (whose instances are mostly the
    //     German bibliographies), and every one read is a bibliographic or corporate "and": `Baekging &
    //     Cukgiuz`, `June Fourth Heritage & Culture Association`, `Bernard & Graefe`. `caeuq` is Zhuang's
    //     ordinary conjunction, ×1636, so this needs no sourcing argument at all.
    //     ⚠ SPACED ON BOTH SIDES DELIBERATELY. `A&B` deletes to `AB`, which is ONE token instead of two —
    //     traps 18/26 — so the replacement must insert the boundary the sign was supplying.
    s = rewrite(s, /\s?&\s?/gu, " caeuq ");

    return s;
}
