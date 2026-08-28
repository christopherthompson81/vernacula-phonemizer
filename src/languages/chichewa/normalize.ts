/**
 * Chichewa / Chinyanja (nya) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ IT RUNS *AFTER* THE SHARED SYMBOL TIER, not before — `normalizeChichewa(SYMBOLS(input))`, the Swahili
 * order rather than the Xhosa one, and the coupling is forced from both ends:
 *   · the DECIMAL spell-out (step 10) has to happen AFTER the percent/currency/unit word is attached, or
 *     the tier sees `66 7 %` and there is no number left beside the sign;
 *   · DE-GROUPING (step 4) works equally well on either side, because it keys on the DIGIT RUN alone and
 *     the tier leaves that run intact — `26.931 km²` → tier → `sikweya makilomita 26.931` → step 4 →
 *     `sikweya makilomita 26931`. That is the only reason the Swahili order is available at all; a
 *     de-grouping rule that needed the unit adjacency would have had to run first.
 *
 * ⚠ CHICHEWA WRITES BOTH SEPARATORS IN BOTH ROLES, so neither one identifies itself. Measured over the
 * mined artifact (424 lines):
 *
 *     separator + exactly 3 digits    33   ALL groupings   500,000 · 14,591 · 31,753 km² · 35.592 km²
 *                                                          · 26.931 km² · 2.289.780 · 10.180.000 · 30 890 000
 *     separator + 1–2 digits          43   ALL decimals    66.7% · 9,5 trillion · 0,60 oz · 104.0 °F
 *     separator + 4+ digits            0
 *
 * 33 against 0 counter-examples. That is why every grouping arm demands blocks of exactly `\d{3}` and the
 * decimal arms take a 1–2 digit tail: the corpus contains no three-place decimal at all.
 *
 * ⚠ TRAP 14/15 DOES NOT ARISE HERE, and that was worth measuring rather than assuming. Chichewa numerals
 * ARE bound stems taking noun-class concord, so the expectation was a Xhosa-style concord glued to the
 * digits. The corpus says otherwise: `letter-hyphen-digit` ×13 is entirely CSS and English designations
 * (`Under-20`, `AR-15`, `COVID-19`, `.reflist-columns-2`), `digit-hyphen-letter` ×2 is `23-karat` and
 * `1254-January`, and the 86 `digit + short word` pairs are ordinary Chichewa particles standing as WORDS
 * (`mipando 82 mwa`, `mipando 49 ya`, `7 pa 10`) — never a detached bound morpheme. So every rule below is
 * free to leave its operand as DIGITS, which is also what keeps the tier's number–unit adjacency alive.
 *
 * Deliberately not done, each with the measurement behind it:
 *   · NO DECIMAL-SEPARATOR WORD. `sources.ts` reports `[NONE] decimal-point` and espeak does not ship
 *     Chichewa at all, so there is no tier left to ask. The separator is removed and the fractional digits
 *     are read one at a time. The point is not spoken — and it was not spoken before either, it was a full
 *     stop in the middle of a number.
 *   · NO ERA PHRASE (21 markers). ny.wikipedia does gloss it — *"1ACN (kutanthauza kuti zaka za kumbuyo
 *     Yesu asanabadwe)"* — but a definitional gloss of an abbreviation is the WRONG REGISTER for what a
 *     reader says in "442 B.C.E", which is the trap that put `धन` into Hindi. What step 2 does instead is
 *     take the DOTS out, which were three sentence breaks per marker.
 *   · NO LETTER NAMES, so no initialisms (1163 in the corpus). `core/initialisms.ts` needs a `letterName`
 *     table; espeak ships no Chichewa, and no in-repo source carries one. Wiring the pass without it is a
 *     NO-OP. A sourcing gap, not a seam gap.
 *   · NO `€` READING. `yuro` is a real Chichewa token but scores 1 hit in 1 article on ny.wikipedia, and
 *     that article is the same machine-translated one the corpus carries. One hit in one article is a
 *     lead, not a finding, and a wrong currency word is confidently wrong where a silent sign is only
 *     missing.
 *   · NO `=` RULE. All 14 occurrences in the corpus are EasyTimeline chart directives
 *     (`ScaleMajor = unit:year increment:11000`); Chichewa prose contains none. `<` `>` `×` `÷` `±` are ×0.
 *   · NO FRACTION RULE. All 13 `N/N` shapes are seasons (`2005/2006`), review scores (`8.1 / 10`), date
 *     spans (`7/8 Marichi`, `1726/27`) or a catalogue number (`NGC 6992/5`) — not one is a fraction, and
 *     `sources.ts` reports no denominator series to compose from either.
 *   · NO `ft` / `in` / `oz` READING. Every instance sits inside an English parenthetical glossing a metric
 *     figure already given (`mamita 108 (354 ft)`, `25.5 g (0,60 mpaka 0,90 oz)`), and no Chichewa word for
 *     them is attested anywhere.
 */
import { MANIFEST } from "./manifest.ts";
import { rewrite } from "../../core/provenance.ts";

/** The manifest's own conjunction — the number joiner (*khumi NDI chimodzi*), reused for `&` and for the
 *  clock's hour/minute link. Read from the manifest so the two can never drift apart. */
const AND = MANIFEST.numbers.and;

/**
 * The metre word, for the ONE unit key the shared tier cannot safely carry.
 *
 * ⚠ THE WORD IS SOURCED; THE KEY IS THE PROBLEM. `mamita` is attested 16 times across 11 ny.wikipedia
 * articles in exactly this slot (*mamita 1,708*, *mamita 108*, *mamita 3*). What blocks the declaration is
 * Chichewa's LOCATIVE PREFIX `m'`: the tier's trailing guard is `(?![\p{L}\p{M}])`, and an apostrophe is
 * neither a letter nor a mark, so a declared `m` bites into it. Measured over the artifact:
 *
 *     digit + m + apostrophe   6    "…105 m'ma…" — the locative, would read as METRES
 *     digit + bare m           3    "107 m pansi pa nyanja", "10,000 m", "(18 m)" — genuine metres
 *
 * 6 false against 3 true. So `m` stays out of `units` and is claimed here instead, with an apostrophe-aware
 * lookahead that takes all 3 and none of the 6. This is trap 46 arriving through a new door — there the
 * one-letter key collided with a version dot, here with a noun-class prefix — and trap 47 reason 4: the
 * tier cannot express the guard, so the rule is local.
 */
const METRE = "mamita";

/** Degree noun. Attested on ny.wikipedia in the angular sense (*madigiri atatu*, *madigiri 6 a Capella*)
 *  and, decisively, beside the sign itself: *"kutentha kuyambira pakati pa 10 ° C 20 ° C madigiri"*.
 *  ⚠ TRAP 37 POLYSEMY, and it is live here: 2 of the 7 hits are ACADEMIC degrees (*madigiri a bachelor*).
 *  The collocation with a number or a ° is what attests it, not the bare token count. */
const DEGREE = "madigiri";

/** Compass points, for a bare degree that is a COORDINATE and not a temperature (`25 ° S`). Composed from
 *  the corpus's own directional nouns, each of which occurs dozens of times in exactly the geographic
 *  sense (*kumwera kwa dziko la Malawi*, *kumpoto*, *kum'mawa*, *kumadzulo*). */
const COMPASS: Readonly<Record<string, string>> = {
    N: "kumpoto", S: "kumwera", E: "kum'mawa", W: "kumadzulo",
};

/** Clock vocabulary, every piece attested in its own slot on ny.wikipedia:
 *  · `koloko` ×3 — o'clock, with the hour BEFORE it: *"8 koloko masana"*, *"3 koloko masana"*.
 *  · `mphindi` ×48 — minute, with the count AFTER it: *"mphindi 12"*, *"mphindi ziwiri"*.
 *  · `masana` (afternoon) comes from those same two sentences; `m'mawa` (morning) from the nya corpus's
 *    own clock, *"pa 1:30 mmawa"*.
 *  Nothing is composed that is not attested in that position — the a.m./p.m. words ARE the day-part words
 *  the language already writes beside a time. */
const HOUR_WORD = "koloko";
const MINUTE_WORD = "mphindi";
const AM = "m'mawa";
const PM = "masana";

/** Day-part words already written beside a clock. A time followed by one of these is a CLOCK even without
 *  a timezone or an a.m./p.m. marker — and the word must be RE-EMITTED, never consumed (trap 10). */
const DAYPART = "m['’]?mawa|masana|madzulo|usiku";

/** Timezone abbreviations attested after a clock in the corpus: UTC ×4, GMT, BST ×2, plus the North
 *  American forms the same articles use. Their presence is what MARKS a colon-number as a time — see the
 *  clock step. They are re-emitted unchanged; without a letter-name table there is nothing better to do
 *  with them than what the engine already does. */
const TZ = "UTC|GMT|BST|CET|EST|EDT|CST|CDT|PST|PDT";

/** The digits of a fractional part, spaced so the number path speaks them one at a time. ⚠ Reading `7` in
 *  `66.7` as a NUMBER would be right by accident; reading `25` in `1.25` as one would say *makumi awiri ndi
 *  zisanu* — "twenty-five" — which is a different quantity. */
const spell = (int: string, frac: string): string => `${int} ${[...frac].join(" ")}`;

/** Is `word` written within ~45 characters either side of this offset? The redundancy guard for `madigiri`
 *  (trap 12: a language that writes both the sign and its word must say it ONCE). BOTH SIDES, not just
 *  before: the corpus's one instance puts the noun AFTER — *"pakati pa 10 ° C 20 ° C madigiri"* — where
 *  Xhosa's before-only guard would have doubled it. */
function saidNear(full: string, offset: number, end: number, word: string): boolean {
    return full.slice(Math.max(0, offset - 45), end + 45).includes(word);
}

/** Normalize one Chichewa input string. Steps are ORDER-DEPENDENT; each states its coupling. */
export function normalizeChichewa(input: string): string {
    let s = input;

    // 1) HTML ENTITIES, then the bare ampersand → `ndi` ("and", the manifest's own conjunction, which the
    //    number path already uses for *khumi ndi chimodzi*).
    //    ⚠ THIS IS WHY `ampersand` IS NOT DECLARED ON THE SHARED TIER. The tier folds `&amp;` and then
    //    substitutes, which is right for a corpus of prose — but 6 of this corpus's 14 ampersands are
    //    `&nbsp;`, a non-breaking-space entity that is not a conjunction at all, and the tier would emit
    //    "ndi nbsp" for every one. The entity table has to be consulted BEFORE the sign is read, and only
    //    a local step can sequence that.
    s = rewrite(rewrite(s, /&nbsp;/giu, " "), /&amp;/giu, "&");
    //    ⚠ SPACED ON BOTH SIDES, always: `T&T` is two initialisms and gluing the word in fuses them into
    //    one token — the merge defect of trap 18.
    s = rewrite(s, /&/gu, ` ${AND} `);

    // 2) DOTTED CAPITAL RUNS → the bare letters, BEFORE anything reads an interior dot as a phrase break
    //    (multi-dot abbreviations before single-dot). 25 runs in the corpus (`U.S.`, `B.C.E`, `F.F.`,
    //    `S.P.C.K.`) plus 3 SPACED ones (`M. A. `, `D. H. `), each currently emitting one sentence pause
    //    per dot in the middle of a Chichewa sentence.
    //    ⚠ THE FINAL DOT IS KEPT WHEN THE SENTENCE VISIBLY ENDS, or `…yase U.S.` loses its sentence break.
    //    Three cases, told apart by what follows: a letter with NO space is a glued word; a space then a
    //    capital, or end of input, is a sentence end (keep the dot); anything else is mid-sentence.
    //    ⚠ THE OPTIONAL TRAILING CAPITAL is what makes `B.C.E` — the corpus's commonest era spelling, and
    //    dotless on its last letter — come out `BCE` rather than `BC E`. It is bounded by `(?![\p{L}])`,
    //    so it cannot reach into the next word: `U.S. Census` keeps its `Census` intact.
    s = rewrite(s, /(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?/gu, (run, off: number, full: string) => {  // space, NBSP
        const letters = run.replace(/[. \u00a0]/gu, "");  // NBSP
        const rest = full.slice(off + run.length);
        if (/^[\p{L}\p{M}]/u.test(rest)) return `${letters} `;
        return rest === "" || /^[ \u00a0]+\p{Lu}/u.test(rest) ? `${letters}.` : letters;  // space, NBSP
    });

    // 3) THE CLOCK — and the marker is what IDENTIFIES it, not the shape. Tabulating every `N:NN` in the
    //    corpus (playbook trap 4's move, the German bare-ordinal table):
    //
    //        12 TRUE clocks, and every one carries a right-hand marker
    //             `1:30 mmawa` · `6:23 p.m.` · `7:30 p.m.` · `7:48 p.m.` · `11:30 AM.`
    //             `15:39 UTC` · `15:50 UTC` · `21:00 UTC` · `21:05 UTC` · `18:30 BST` · `23:00 BST/GMT`
    //         5 FALSE, and NOT ONE carries a marker
    //             `Machitidwe 5:37` · `Machitidwe 13: 9` · `Marko 14:2` · `1 Akorinto 9: 19-23`  BIBLE VERSES
    //             `mphindi 64:51`                                                                a RACE TIME
    //
    //    ⚠ A TWO-DIGIT MINUTE FIELD IS NOT ENOUGH: `Machitidwe 5:37` passes any `[0-5]\d` shape guard. The
    //    marker requirement is what declines all five, at no cost to the twelve. 12/12 against 0/5.
    //    A sports time is declined twice over — no marker, and the trailing `(?![:.\d])` (a third field).
    //    ⚠ THIS IS THE ONE RULE THAT EMITS ITS OWN NOUNS, so it must claim the marker in the SAME match:
    //    afterwards nothing downstream can associate `p.m.` with the time it belongs to, and its two dots
    //    were two more sentence breaks. A DAY-PART word is RE-EMITTED rather than consumed (trap 10) — the
    //    text already said *mmawa* and deleting it would lose a word the writer typed.
    //    ⚠ BEFORE step 4 and step 10: de-grouping and the decimal rule must not see a colon operand, and
    //    `:` is `clausePunctuation`, so every one of these was reading as a comma pause mid-number.
    s = rewrite(s,
        new RegExp(
            `(?<![\\d:.,])([01]?\\d|2[0-3]):[ \u00a0]?([0-5]\\d)(?![:.\\d])` +  // NBSP
                `(?:[ \u00a0]*(?:([AaPp])\\.?[Mm]\\.?|(${TZ})(?![\\p{L}\\p{M}])|(${DAYPART})(?![\\p{L}\\p{M}])))`,  // space, NBSP
            "gu",
        ),
        (whole, h: string, m: string, ap?: string, tz?: string, part?: string) => {
            const hv = Number(h), mv = Number(m);
            if (hv > 23 || mv > 59) return whole;
            // `:00` emits the hour alone — the alternative is the manifest's zero word *ziro*, and
            // "21 koloko ziro" is not a reading of 21:00 in any language.
            const body = mv === 0 ? `${hv} ${HOUR_WORD}` : `${hv} ${HOUR_WORD} ${AND} ${MINUTE_WORD} ${mv}`;
            if (ap !== undefined) return `${body} ${ap.toLowerCase() === "p" ? PM : AM}`;
            return `${body} ${tz ?? part}`;
        },
    );

    // 4) THOUSANDS DE-GROUPING, before every remaining numeric rule: a grouping COMMA reads as a clause
    //    pause and a grouping PERIOD as a full stop, so `1,600,000` came out *chimodzi , mazana asanu ndi
    //    limodzi , ziro* ("one, six hundred, zero") and `2.289.780` broke one number into three sentences.
    //    54 comma-grouped, 13 period-grouped, 6 space-grouped.
    //    ⚠ EXACTLY THREE DIGITS PER BLOCK — see the header's 33-against-0 table. That is also what keeps a
    //    genuine decimal comma (`9,5 trillion`) and a decimal dot (`66.7`) out of this rule.
    //    ⚠ THE HEAD MUST START 1–9. Without it the space arm eats an ISBN: the corpus writes
    //    `ISBN 0 620 17697 0`, whose `0 620` is not a grouped thousand, and a grouped number never opens
    //    with a leading zero.
    //    ⚠ THE TRAILING GUARD IS `(?![\d]|[.,][\d])`, NOT `(?![\d.,])`: with the wider form a grouped number
    //    followed by a CLAUSE comma or a sentence period declines to de-group, and the leftover separator
    //    is then read as a decimal by step 10. It only needs to stop a PARTIAL match inside a longer run.
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/,/gu, ""));
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?![\d]|[.,]\d)/gu, (w) => w.replace(/\./gu, ""));
    s = rewrite(s, /(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])/gu, (w) => w.replace(/[ \u00a0\u202f\u2009]/gu, ""));  // space, NBSP, NNBSP, thin space

    // 5) DEGREES. `40 °C (104.0 °F)`, `25 ° S`, and a bare `30 °`. The sign was dropped outright and the
    //    scale letter reached the g2p as a phoneme — `C` as [k] and `F` as [f], because Chichewa has no
    //    ⟨c⟩ grapheme at all.
    //    ⚠ NO SCALE NAME IS EMITTED. `sources.ts` reports `[NONE] scale-names` — neither Celsius nor
    //    Fahrenheit is attested in any source this repo has for Chichewa, and espeak ships none. The letter
    //    is CLAIMED so it cannot reach the phoneme stream raw, and the scale is left unsaid rather than
    //    invented. `F` is claimed beside `C` even though only `C` occurs: without it `30°F` falls through
    //    every arm below (the bare-degree arm's trailing guard rejects a letter) and loses the ° while the
    //    F still reads.
    //    ⚠ THE NOUN IS SUPPRESSED WHEN THE CLAUSE ALREADY CARRIES IT — the corpus writes
    //    *"pakati pa 10 ° C 20 ° C madigiri"*, and emitting it again would say it three times.
    //    BEFORE step 10, which needs `104.0` intact to be recognised as the Fahrenheit reading's operand.
    const degreeBody = (n: string, off: number, end: number, full: string): string =>
        saidNear(full, off, end, DEGREE) ? n : `${DEGREE} ${n}`;
    s = rewrite(s, /(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?[CF](?![\p{L}\p{M}])/gui,  // space, NBSP
        (w, n: string, off: number, full: string) => degreeBody(n, off, off + w.length, full));
    s = rewrite(s, /(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([NSEW])(?![\p{L}\p{M}])/gu,  // space, NBSP
        (w, n: string, c: string, off: number, full: string) =>
            `${degreeBody(n, off, off + w.length, full)} ${COMPASS[c]!}`);
    s = rewrite(s, /(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])/gu,  // space, NBSP
        (w, n: string, off: number, full: string) => degreeBody(n, off, off + w.length, full));

    // 6) BARE `m` → *mamita*, the key the shared tier cannot hold — see METRE above for the 6-against-3
    //    measurement. AFTER step 4 (so `10,000 m` is one digit run by now) and BEFORE step 10.
    //    Prefix position, matching every other measure noun in the language (*mamita 1,708*).
    s = rewrite(s, /(?<![\d.,])(\d+)[ \u00a0]?m(?![\p{L}\p{M}'’ʼ0-9])/gu, `${METRE} $1`);  // space, NBSP

    // 7) THE ENGLISH ORDINAL SUFFIX (`20th century`, `3rd`, `2nd`). Chichewa writes its own ordinals as
    //    WORDS — *wachiwiri*, *lachisanu*, *zaka za zana la 16* — so a Latin suffix here is always foreign
    //    orthography sitting on a digit, and it was reaching the phoneme stream as a bare [tʰ]. Stripping
    //    it is the whole fix; no ordinal morphology is invented, because Chichewa's is already written out
    //    wherever the language means it. Case-insensitive (trap 7).
    s = rewrite(s, /(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])/giu, "$1");

    // 8) RANGES → `mpaka` ("until/up to"), the corpus's own span joiner: 31 digit-flanked instances
    //    (*masiku 10 mpaka 12*, *17 mpaka 25.5 g*, *kuyambira 1994 mpaka 2004*, *52% mpaka 48%*). Nothing
    //    needs inventing.
    //    ⚠ ASCENDING ONLY, measured: of the 35 `N-N` shapes, the 18 non-ascending ones are football scores
    //    (`3-1`, `2-2`, `3-2`), seasons (`2014-15`, `2018-19`, `2019-20`) or a birth–death pair whose
    //    second operand is a DAY (`1642 - 20 March 1726/27`, `1861 - 7/8 Marichi 1925`). Claiming them
    //    would be confidently wrong; they keep the bare juxtaposition the engine already produced.
    //    ⚠ THE GUARD EXCLUDES A HYPHEN ON EITHER SIDE, which is what declines a hyphen CHAIN: the corpus's
    //    `2-3-5 mawonekedwe` is a football formation, and without this the rule reads it "2 mpaka 3-5".
    //    ⚠ ONE KNOWN FALSE POSITIVE, recorded rather than guarded away: `ndege ya Boeing 737-800` is a
    //    model designation and reads *737 mpaka 800*. 1 against the 14 genuine ascending spans. Every one
    //    of those 14 is preceded by a lowercase word, an open paren or a comma and only the Boeing case by
    //    a capitalised name — but a "not after a capitalised word" guard would also decline a
    //    sentence-initial *Mu 2004-2009*, so the trade was refused and the instance is stated instead.
    //    AFTER step 4, so a grouped endpoint is already one run of digits, and AFTER step 3.
    //    ⚠ THE TRAILING GUARD REJECTS NEITHER A `.` NOR A `,`, AND THE LEADING ONE STILL REJECTS BOTH. A
    //    sentence period is not part of a number, so the symmetric guard declined every range that ENDS A
    //    CLAUSE — `19-23.`, `2003-2004.`, `2004 -2009.` — and those came back as two juxtaposed cardinals
    //    with nothing between them. Reported by `review.ts`'s `clause-final` check. Nor is the dot protecting
    //    an ordinal: a fleet-wide comparison of the numeral WORD for `5` against `5.` over the 47 languages
    //    whose range rule declined a clause-final dot found ZERO ordinal readings, and Chichewa writes its
    //    ordinal out in words anyway (see step 7).
    //    ⚠ THE COMMA GOES TOO, on Chichewa's own evidence. The language writes the DECIMAL POINT (step 10),
    //    so a following comma is a CLAUSE comma and never a decimal tail; step 4 has already de-grouped
    //    `30-40,000`; and the ASCENDING-ONLY test above is what declines the truncated second endpoints a
    //    comma would otherwise be guarding by accident (`2018-19,`, `2015–16,`, `2009-10,`, `2-0,`).
    //    +3 segments, all genuine spans, no regression.
    s = rewrite(s, /(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}])/gu,  // space, NBSP
        (whole, a: string, b: string) => (Number(a) < Number(b) ? `${a} mpaka ${b}` : whole));

    // 9) A LONE `+` BETWEEN OPERANDS IS LEFT UNREAD, deliberately — `(UTC + 7)`, `(GMT+1)`, 2 instances.
    //    Nothing in the corpus, on ny.wikipedia or in any referee here says what a Chichewa reader puts in
    //    that slot, and the playbook's fleet-wide finding is that the UTC-offset plus is the one contentful
    //    plus and the one nothing attests. Recorded in tools/normalization/defects.ts rather than guessed.

    // 10) DECIMALS, LAST of the numeric rules — steps 3 to 8 all need their number intact, and the shared
    //     tier (which runs BEFORE this whole pass) needs the digit adjacent to its sign. The dot was
    //     reaching `clausePunctuation` and becoming a SENTENCE BREAK inside a number. NO separator word is
    //     emitted; see the header.
    //     ⚠ BOTH SEPARATORS, both restricted to a 1–2 digit tail — the same discipline step 4 uses from the
    //     other side. Without the tail limit these two arms would swallow any grouped thousand step 4
    //     declined (a date comma, `Novembala 26,2008`, has a four-digit tail and is excluded by both).
    s = rewrite(s, /(?<![\d.,])(\d+)\.(\d{1,2})(?![\d])/gu, (_m, i: string, f: string) => spell(i, f));
    s = rewrite(s, /(?<![\d.,])(\d+),(\d{1,2})(?![\d,])/gu, (_m, i: string, f: string) => spell(i, f));

    // ⚠ A padded replacement (` ndi `, `letters `) doubles a space that was already there and can leave one
    // at an edge. SLOT-GAP is a corpus-diff defect class; this pass must not feed it.
    return rewrite(rewrite(s, /[^\S\n]{2,}/gu, " "), /^[^\S\n]+|[^\S\n]+$/gu, "");
}
