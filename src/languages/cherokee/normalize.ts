import { rewrite } from "../../core/provenance.ts";
/**
 * Cherokee (chr) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already
 * a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * EVIDENCE. `tools/corpus/mined/chr.jsonc` — chr.wikipedia dump, 734 paragraph segments, 315 retained
 * (115 hard + 200 sample). ⚠ THIS IS THE SMALLEST CORPUS IN THE FLEET, and the round's governing finding is
 * trap 51's floor: almost every vocabulary class this layer could have read is UNSOURCEABLE, and the counts
 * below are the argument for refusing them rather than an apology for it. Corpus-wide cell counts:
 * `initialism` 687 · `abbrev` 292 · `latin-in-native` 275 · `digit-run` 106 · `year` 106 · `decimals` 24 ·
 * `ordinal-latin` 22 · `ranges` 22 · `letter-name` 22 · `grouped` 20 · `dotted` 9 · `units` 7 · `roman` 7 ·
 * `signs` 5 · `percent` 4 · `exponent` 4 · `ampersand` 3 · `clock` 2 · `fractions` 2 · `signed-number` 2 ·
 * `degrees` 0 · `currency` 0 · `era-marker` 0 · `rate` 0 · `arithmetic` 0.
 *
 * ⚠ THE THREE RULES THIS FILE SHIPS NEED NO VOCABULARY AT ALL, AND THAT IS WHY THEY SHIP. Every one is a
 * SEPARATOR being spent — a grouping comma, a decimal dot, a span dash — and none introduces a word this
 * wiki cannot attest. Everything that would have needed a word is refused below, with its count.
 *
 * ⚠ THE LATIN RUNS GO TO A DIFFERENT TOKEN ARM, AND ANY WORD THIS LAYER EMITTED IN LATIN WOULD BE READ AS
 * ENGLISH. `cherokee.ts`'s TOKEN is `([Ꭰ-Ᏽꭰ-ꮿ]+)|(\d+)|([.?!,;:…])` — a Latin run is never claimed, so
 * `assembleClauses` hands it to `emitUnclaimed`, i.e. to the Latin-to-English fallback. Measured on the
 * retained text: 6,410 Latin letters against 38,069 syllabary characters (14.4%), 1,075 Latin runs over 669
 * distinct forms, and 30 of the 315 segments carry MORE Latin than Cherokee. So a rule here may only ever
 * emit SYLLABARY, and it may only emit words `numbers.ts` or the corpus itself supplies.
 *
 * ⚠ THE DIGITS ARE ASCII, ALL OF THEM. 968 digits in the retained text and `\p{Nd}` minus `[0-9]` is exactly
 * zero — there is no Cherokee digit block and this wiki uses none.
 *
 * ⚠ THE COMMA GROUPS AND NEVER DECIMATES, WITH NO EXCEPTIONS — this is the round's largest defect by a wide
 * margin and the one that produced a WRONG NUMBER rather than a missing word. Every `\d,\d{3}` in the
 * retained text (50 match positions) is a thousands group; not one is a decimal separator. Before this
 * layer the tokenizer read the comma as CLAUSE PUNCTUATION and each group as its own numeral:
 *
 *     ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ   →  kalikʷatu , notʰi        "seventeen, ZERO"     — a silent 1000× error
 *     ᎾᏂᎥ ᏴᏫ 33,625,989. →  t͡sosko t͡soi , sutaliskohit͡sikʷa tʰalisko hiski , sonelaskohit͡sikʷa nelasko sonela
 *                            "thirty-three, six hundred twenty-five, nine hundred eighty-nine"
 *
 * — three numbers and two false sentence breaks where the writer wrote one population figure. Trap 56's
 * extreme case: every word emitted was well-formed Cherokee, no gate could see it, and `17,000` reading as
 * *seventeen zero* is the tg defect in another script.
 *
 * ⚠ AND THE FOUR-GROUP CASE IS LIVE HERE, so trap 63's whole-number match is not theoretical: `ᎾᏂᎥ ᏴᏫ
 * 1,028,737,436.` (India's population) is the artifact's one four-group figure, and the fleet's old
 * one-join-per-pass idiom would have de-grouped it into a DIFFERENT NUMBER.
 *
 * ⚠ THE DOT DECIMATES AND DOES NOTHING ELSE BETWEEN DIGITS. `\d.\d` is ×6 in the retained text and all six
 * are decimals — `29.53 ᎯᎸᏍᎩ ᎢᎦ` (the synodic month), `4.5 ᎢᏳᏆᏗᏅᏓ`, `0.8-4 cm`, `3.5" 4.25" ᏩᏍᏗ`. There is
 * no date, no IP address and no version string with an interior dot anywhere in this corpus, so the guard
 * needs only to require a digit on each side. The dot was reaching `[.?!,;:…]` as a FULL STOP: `29.53` read
 * *tʰalisko sonela . hiskisko t͡soi*, a sentence boundary inside a quantity.
 *
 * ⚠ NO DECIMAL WORD IS SOURCEABLE, so the mark is NEUTRALISED rather than spoken — the Karakalpak and
 * Punjabi choice, for the same reason. `attest.ts --after` on six Cherokee numerals returns four followers
 * across the whole of chr.wikipedia, none of them a measure or separator word (see the floor note below).
 * The defect being fixed is the false sentence break, not the unread mark.
 *
 * ⚠ THE ASCII HYPHEN IS A CHEROKEE WORD-JOINER AND IS DELIBERATELY UNTOUCHED — ×101, and reading it as a
 * range or a minus would be wrong in the overwhelming majority. What it actually does here:
 *
 *     -Ꭿ / -Ꮒ enclitic     ᏧᏴᏢ ᎠᎹᏰᎵ-Ꭿ · ᎡᎶᎯ-Ꮒ · ᏳᎳᏛ-Ꭿ · ᎢᏅᏗᎾ-Ꭿ · ᏧᏁᏍᏓᎸ-Ꭿ        the commonest sense
 *     compound numeral     ᏦᏍᎪᎯ-ᏐᏁᎳ (39) · ᏔᎳᏍᎪᎯ-ᏌᏊ · ᏁᎳᏚ-ᏐᏁᎳ                    ⚠ glossed by its own digits
 *     Cherokee compound    ᎦᎸᎳᏗᏢ-ᎦᏙᎯ · ᎩᏄᏙᏗ-ᎩᎬ · ᎬᏂᎨᏒ ᏄᏍᏛᎢ-ᎤᏍᏗ ᎦᏅᏅ
 *     an ISBN              0-7167-2438-3 · 1-884655-63-7 · 0-937207-43-8            ×9 hyphens, 3 citations
 *     an English compound  Baskin-Robbins · Cross-Cultural · KJRH-TV · Babel-X
 *     a real span          1-6 cm · 0.8-4 cm · 3-3 ½ ᎢᏯᎳᏏᏗ                          ×3, the whole class
 *
 * Three real spans against nine ISBN hyphens and a productive enclitic: the ratio is the argument. ⚠ AND
 * `ᏦᏍᎪᎯ-ᏐᏁᎳ (39)` IS THE ROUND'S BEST SINGLE PIECE OF EVIDENCE — the writer spells thirty-nine as a
 * hyphen-joined compound and then repeats it in digits in the same clause, which is a Cherokee reader
 * telling us the hyphen is INSIDE a word.
 *
 * ⚠ THE EN- AND EM-DASH ARE A DIFFERENT MARK AND THEY ARE CLAIMED. `–` ×16 and `—` ×4, and digit-flanked
 * they are the BIRTH–DEATH SPAN of a biographical parenthetical, without exception: `(1923–2008)`,
 * `(1976–1990)`, `(1944–2010)`, `(1101–1131)`, `(1277–1320)`, `(1852—1892)` and the percent spans
 * `20–25%`, `10–15%`. The dash was dropped outright, so two years ran together with no pause at all.
 * ⚠ THE DASH IS SPENT ON A PAUSE, NOT A CONNECTIVE — this corpus writes its spans out in full where it
 * means them (`ᎠᏰᎵ 1760 ᎠᎴ 1776`, "between 1760 and 1776"; `ᏂᏛᎴᏅᏓ 1-6 cm`, "from 1-6 cm"), so imposing a
 * joiner on a bare dash would double a word the writer already chose or did not.
 *
 * ⚠ `&ndash;` SURVIVES UNEXPANDED IN THIS WIKI'S TEXT, ×2, and it is a SILENT drop: `(1914&ndash;1972)` and
 * `(1961&ndash;1989)` read as two fused years with the entity contributing nothing at all (the Latin run
 * `ndash` returns empty from the English fallback). Folded to the dash it takes the span rule above. This is
 * markup residue rather than a Cherokee orthographic fact and is labelled as such.
 *
 * ─── WHAT IS REFUSED, AND THE COUNT THAT REFUSES IT ─────────────────────────────────────────────────────
 *
 * ⚠ NO SHARED SYMBOL TIER IS DECLARED AT ALL. `makeSymbolNormalizer` needs a percent word, a currency name,
 * a unit table, an exponent word or an ampersand word, and chr.wikipedia attests NONE of them. Declaring the
 * tier with an invented word is the one thing this round must not do (trap 51, and the standing rule on
 * inventing data), so the tier is absent rather than half-filled. Every class below is registered in
 * `ACCEPTED_SIGN_SILENCE` under `chr` with these counts.
 *
 * ⚠ THE SOURCING FLOOR IS MEASURED, NOT ASSUMED, AND IT IS THE ROUND'S REAL RESULT.
 *   · `espeak-ng/dictsource/chr_list` IS ZERO LINES LONG. espeak ships a Cherokee voice with 324 lines of
 *     `chr_rules` — phonetic rules over a ROMANIZATION — and not one dictionary entry. The usual fallback
 *     tier does not exist for this language.
 *   · `attest.ts --after ᏍᎪᎯ,ᎯᏍᎩ,ᏔᎵᏍᎪᎯ,ᏑᏓᎵ,ᎢᏳᏟᎶᏛ,ᏍᎪᎯᏥᏆ` over the whole wiki returns FOUR followers
 *     (ꭴꮺꮨ ×1, ꭲᏼ ×1, ᏹꮷꮥꮨᏼꮣ ×1, ꭽꮻꮎꮧꮲ ×1) and none is a measure word. This wiki essentially never spells
 *     a numeral out next to a unit, so the slot probe of trap 40 has nothing to find. That is a floor.
 *
 * ⚠ PERCENT — REFUSED, ×6. `95%`, `3%`, `65%`, `20–25%`, `10–15%`, `98%`, every one a genuine percentage in
 * Cherokee prose (`ᏂᎪᎯᎸ ᎤᏁᏍᏓᎳ 98% ᎦᏙᎯ ᏗᏚᏝᎢ`). There is no candidate word: `ᏍᎪᎯᏥᏆ` (100) is attested ×1/1
 * article and its one example is a COUNT OF PEOPLE in a narrative, not a proportion; `ᏍᎪᎯᏥᏆ ᎢᏳᏓᎵ` ("per
 * hundred") is ×0. Composing one from `ᏍᎪᎯᏥᏆ` plus a preposition would be sourced arithmetic in Fula's
 * sense only if the preposition were attested in that frame, and it is not. The sign stays silent.
 *
 * ⚠ CURRENCY — REFUSED, ×1, AND IT IS A TRAP-12 REDUNDANT DROP. The corpus's only currency sign is
 * `ᎤᎾᏤᎵ ᎠᏕᎳ ᏣᏆᏂ ᎠᏕᎳ (¥)` — "their money, Japan money (¥)". The Cherokee word `ᎠᏕᎳ` (money, ×16/8 articles
 * on the wiki, and ×2 in that clause alone) is ALREADY WRITTEN twice beside the sign, so saying it a third
 * time is what would be wrong. `attest.ts` confirms the sense independently: `ᏳᎳᏛ (€) ᎠᏕᎳ ᎾᎿ European
 * Union`, the same gloss shape for the euro. No yen name is attested in any source.
 *
 * ⚠ UNITS — REFUSED, ×9 (`km` ×7, `cm` ×2), AND THE REFUSAL COSTS SOMETHING, WHICH IS STATED RATHER THAN
 * HIDDEN. Both abbreviations are Latin, so both reach the English fallback, and trap 56 is live:
 *
 *     5 km  →  hiski ˈʊkm          5 cm  →  hiski km
 *
 * — `cm` comes out as the raw string `km`, i.e. the magnitude-confusable collision this repo has measured in
 * nya and tl. It is refused anyway because the alternative is worse. The only Cherokee unit word this wiki
 * offers is `ᏑᏟᎶᏛ`, ×1 token in ×1 article, in a sentence that glosses it "(ᏅᎩ ᏧᏅᏏᏯ kilometer)" while using
 * the near-identical `ᎢᏳᏟᎶᏛ` for MILES two clauses later — and `ᎢᏳᏟᎶᏛ` is unambiguously the mile in the
 * mined corpus, which converts it against km twice (`1,200 ᎢᏳᏟᎶᏛ (1,900 km)`, `2,200 ᎢᏳᏟᎶᏛ (3,540 km)`).
 * Declaring `km` from that one sentence is Māori's `m/h` in reverse (trap 44): a confidently wrong unit
 * replacing a merely raw one.
 *
 * ⚠ EXPONENT — REFUSED, ×5, ALL `km²`, AND THE SQUARE WORD IS THE SHAPE WORD (trap 37 exactly). `ᏅᎩ ᏧᏅᏏᏯ`
 * ("four sides") is attested ×5 over 3 articles, and THREE of the five are geometry: `ᎦᏅᎯᏓ ᏅᎩ ᏧᏅᏏᏯ
 * (ganvhida nvgi tsunvsiya)` is a dictionary entry for the RECTANGLE, `ᏦᎢ ᏧᏅᏏᏯ ᎤᏃᏴᎩ` beside it is the
 * TRIANGLE, and a third is in a list of woven patterns (`ᎦᏅᎯᏓ ᏅᎩ ᏧᏅᏏᏯ, ᏗᎦᏐᏆᎸ, ᎦᎸᏉᏗ ᏃᏈᏏ` — rectangle,
 * diamond, star). The two measure-slot hits are the SAME clause of the SAME landform article, the one that
 * also mis-glosses its unit. One sentence in one article is a lead, not a finding (trap 51). ⚠ AND THE
 * REFUSAL IS WHOLE, NOT HALF (trap 53): no unit key is declared either, so `km²` reads exactly as it did
 * before instead of becoming "kilometres two".
 *
 * ⚠ AMPERSAND — REFUSED, ×3, AND NOT ONE IS A CHEROKEE CONJUNCTION. Two are the `&ndash;` entity handled in
 * step 1; the third is `Ben & Jerry's ᎤᏛᏁᎢ ᎤᎦᎾᏍᏗ Holdings Inc.`, an English brand name inside a Cherokee
 * sentence. The word would have been easy — `ᎠᎴ` ("and") is ×255 over 20 articles and is the corpus's
 * ordinary conjunction — and it is refused because inserting a Cherokee word into an English trade name is a
 * defect this layer would have INTRODUCED. Zero Cherokee ampersands.
 *
 * ⚠ MINUS — REFUSED, AND THE HYPHEN SECTION ABOVE IS THE WHOLE ARGUMENT. `mine.ts scan` reports
 * `DROP minus ×1`; reading it, the instance is `ᎹᏱᎩᎵ I ᎳᏂᎦᏇ (????-844)` — a reign span whose start year is
 * unknown, written as four question marks. Not a negative. Across the retained text there is not one
 * negative number.
 *
 * ⚠ `= < > × ÷ ± +` — ALL SIX ×0. Trap 62 says print every instance of the sign before writing a rule for
 * it; here there is nothing to print. This is the definitive-negative result of trap 48, and it means the
 * arithmetic, comparison and signed-number cells are closed for chr rather than deferred.
 *
 * ⚠ THE COLON IS NEVER A CLOCK, ×31, AND NO CLOCK RULE IS WRITTEN. Read in full: it introduces a list or a
 * quotation in Cherokee prose (`ᏄᏍᏛ ᏗᎧᏃᏗ:`, `ᏣᎳᎩ ᎤᏅᏔᏂᏓᏍᏗ:`, `ᎤᏪᏡᏁ: “Ᏻ! ᎥᎩᎵᏏ…`), separates a city from a
 * publisher in an English citation (`Tulsa: Cherokee Language and Culture`), marks a PARALLEL TITLE
 * (`(ᏣᎳᎩ: Tatiyana Bulanowa; ᏲᏂᎢ: Татьяна…)`), or sits in a page reference (`(1897/98: pt.1)`). Zero
 * `\d:\d`. `cherokee.ts` already maps the colon to a `,` pause, which is right for all thirty-one.
 *
 * ⚠ AND FOUR MORE MARKS ARE LEFT ALONE, EACH WITH ITS COUNT AND ITS REASON:
 *   `~` ×5    circa, always before a birth year in a regnal parenthetical (`(~1096–1154)`, `(~965–1038)`).
 *             `ᎬᏩᏚᏫᏛ` ("about") is attested ×7/3 and every example approximates a QUANTITY
 *             (`ᎬᏩᏚᏫᏛ 290,000,000 ᎠᏂᎤᏁᎦ`, `ᎬᏩᏚᏫᏛ 17,000 ᏣᎳᎩ`) — a different register from circa-a-date,
 *             and five instances do not buy a register guess.
 *   `½` ×2    the SAME sentence twice (`3-3 ½ ᎢᏯᎳᏏᏗ ᎢᎦᏘ`). No half word is attested; `ᎠᏰᎵ` ×134 is
 *             "central/government" in every example, never a fraction.
 *   `'` `"`   feet and inches (`135' ᎢᏂ ᎢᏗᎦᏘ`, `3.5" 4.25" ᏩᏍᏗ`, `18" 35"`) — but `"` is ALSO the ordinary
 *             quotation mark ×103, so a rule keyed on it would claim a hundred quotes to read seven
 *             measurements, and no Cherokee foot or inch word is attested next to a numeral either.
 *   `[` `]`   ×5, unclosed wiki markup (`… ᎭᏫᎾᏗᏢ 1828.]]`). Corpus residue, silent, harmless.
 *
 * SOURCING — this layer emits NO WORD. Every rule spends a separator or restores a pause, so there is
 * nothing to source and nothing in `tools/corpus/attest/chr.jsonc` is load-bearing for a reading. The
 * probes recorded there are the evidence for the REFUSALS above.
 */

/**
 * ⚠ NEVER `\b` — it is ASCII-defined and finds NOTHING against the Cherokee syllabary (trap 1/23), which is
 * the single most likely way to write a rule here that silently matches nothing at all. The syllabary is
 * U+13A0–U+13F5 (main block), U+13F8–U+13FD (the lowercase tail of the main block) and U+AB70–U+ABBF (the
 * Cherokee Supplement lowercase), and `cherokee.ts` folds the Supplement onto the main block with
 * `toUpperCase()`. Written out explicitly so a guard here cannot inherit a Latin assumption.
 *
 * Unused by the three rules below — every one of them is anchored on DIGITS, which is what makes them safe
 * in a script whose word boundaries no ASCII class can see. Kept and exported for the next rule that needs
 * a letter guard, so that rule does not reach for `\b`.
 */
export const CHEROKEE = "\\u13A0-\\u13F5\\u13F8-\\u13FD\\uAB70-\\uABBF";

/** Normalize one Cherokee input string. Pure text→text. Steps are ORDER-DEPENDENT. */
export function normalizeCherokee(input: string): string {
    let s = input;

    // 1) THE UNEXPANDED HTML ENTITY, FIRST — see the header. `1914&ndash;1972` and `1961&ndash;1989` are the
    //    artifact's two instances, and today the entity is SILENT: `ndash` is a Latin run, the English
    //    fallback returns nothing for it, and the two years fuse. Folded to the real dash here so step 4 can
    //    claim it; running before step 4 is the whole point of its position. This is dump/markup residue,
    //    not a Cherokee orthographic convention, and is deliberately narrow — only the two dash entities.
    s = rewrite(s, /&(ndash|mdash);/gu, (_m, which: string) => (which === "ndash" ? "\u2013" : "\u2014"));

    // 2) DE-GROUPING THE COMMA — the round's largest defect. The three-digit test is the WHOLE guard,
    //    because every `\d,\d{3}` in this corpus is a thousands group and there is no decimal comma to
    //    disambiguate against (header). `11,000` · `2,000` · `250,000` · `9,984,670` · `33,625,989` ·
    //    `1,028,737,436` · `108,000,000` · `243,610` · `7,800`.
    //    ⚠ THE WHOLE NUMBER AT ONCE (trap 63) — and this corpus contains the four-group figure that makes
    //    the old one-join-per-pass idiom produce a DIFFERENT NUMBER, so this is measured rather than
    //    prophylactic.
    //    ⚠ THE TRAILING GUARD REJECTS A DIGIT AND NOTHING ELSE (trap 58). Writing `(?![\d.,])` would decline
    //    `ᎾᏂᎥ ᏴᏫ 33,625,989.` and `1,028,737,436.` — both clause-final in this corpus, i.e. it would decline
    //    the two largest figures the rule exists for.
    //    ⚠ THE LEADING GUARD REJECTS A NUMBER ALREADY IN PROGRESS, so a comma sitting behind a decimal point
    //    or another digit cannot start a match here.
    //    ⚠ AND THE DATE COMMA IS DECLINED BY THE SAME THREE-DIGIT TEST, not by a separate rule:
    //    `ᏀᎾ ᎦᎶᏂ 28, 1838,` is `\d{1,2}, \d{4}` — a space after the comma and four digits after it, so
    //    neither `,\d{3}` nor the no-digit-follows guard can be satisfied. ×8 dates, all safe.
    s = rewrite(s, /(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)/gu,
        (_m, head: string, rest: string) => head + rest.replace(/,/gu, ""));

    // 3) THE DECIMAL DOT, NEUTRALISED. ⚠ NO DECIMAL WORD IS SOURCEABLE (header), so the mark is spent rather
    //    than spoken; the defect being fixed is the FALSE SENTENCE BREAK it produces mid-quantity, because
    //    `.` is clause punctuation in `cherokee.ts` and `29.53` read *tʰalisko sonela . hiskisko t͡soi*.
    //    ⚠ MUST RUN AFTER STEP 2, or a de-grouped `1,028.5` would no longer be reachable as one number —
    //    and after, not before, step 4 would make no difference since the dash rule never touches a dot.
    //    ⚠ `(?<![\d.])…(?![\d.])` REQUIRES THE RUN TO CARRY EXACTLY ONE DOT. Nothing in this corpus needs
    //    that (there is no IP address, date or version string with an interior dot — `\d.\d` is ×6 and all
    //    six are decimals), but it is what keeps a fleet-standard shape from being claimed if one appears,
    //    and it costs nothing measured: 0 further utterances change with or without it.
    //    ⚠ AND IT DECLINES THE ABBREVIATING DOT BY REQUIRING A DIGIT ON THE LEFT: `pt.1` in the Smithsonian
    //    citation, `D.C.`, `Ꭴ..` and the sentence period of `ᎭᏫᎾᏗᏢ 1907.` are all untouched.
    s = rewrite(s, /(?<![\d.])(\d+)\.(\d+)(?![\d.])/gu, "$1 $2");

    // 4) THE SPAN DASH, SPENT ON A PAUSE. Digit-flanked `–`/`—` is the birth–death parenthetical of a
    //    biography or a percent span, without exception in this corpus (header): `(1923–2008)`,
    //    `(1101–1131)`, `(1852—1892)`, `20–25%`, `10–15%`. The mark was DROPPED, so the two years ran
    //    together with no pause at all.
    //    ⚠ THE ASCII HYPHEN IS NOT IN THE CLASS AND MUST NOT BE ADDED "for symmetry" — it is the Cherokee
    //    enclitic joiner (`ᎠᎹᏰᎵ-Ꭿ`), a compound-numeral joiner (`ᏦᏍᎪᎯ-ᏐᏁᎳ (39)`) and an ISBN separator
    //    ×9, against three genuine spans. This is the Karakalpak em-dash finding in mirror image: there the
    //    fleet class was already right and widening it would have been wrong; here the same class is right
    //    and NARROWING to the two dashes is what makes it safe.
    //    ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (trap 58) — the lookahead is `(?=\d)` and the
    //    rule re-emits nothing beyond its own separator, so `(1961–1989),` keeps its clause comma.
    s = rewrite(s, /(\d)\s?[\u2013\u2014]\s?(?=\d)/gu, "$1, ");

    //    …and the SPACED dash between words, which is the same mark doing the same job outside a number and
    //    which also vanished: `ᎢᎾᎨ ᎡᏯ ᏒᎩ — Allium canadense`, `ᎩᎦᎨ ᎤᏆᎫᏫᏂᏗᏧ (…) – Polystichum
    //    acrostichoides` (the species glosses), `"ᏣᎳᎩ" (ᏣᎳᎩ) – ᎪᎯ ᎾᎯᏳᎢ` and `TONMO.COM – The Octopus News
    //    Magazine Online`. A dash with a space on BOTH sides is never a word-internal joiner in any of the
    //    three scripts this text mixes, which is what makes the shape safe where the bare hyphen is not.
    s = rewrite(s, /[^\S\n][\u2013\u2014][^\S\n]/gu, ", ");

    // A padded replacement doubles a space that was already there. Harmless downstream because
    // assembleClauses collapses runs, but SLOT-GAP is a defect class and this pass should not be the one
    // producing candidates for it.
    return rewrite(s, /[^\S\n]{2,}/gu, " ");
}
