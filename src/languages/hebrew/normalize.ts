import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
/**
 * Hebrew / עברית (he) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not
 * already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THERE IS NO FLEURS FOR HEBREW. The evidence is `tools/corpus/mined/he.jsonc` — he.wikipedia, 5,141
 * paragraphs, 380 mined segments (180 hard + 200 sample), `covered 29/35` — plus `attest.ts` and targeted
 * `insource:` searches against he.wikipedia, the en.wiktionary vocalized→Modern-Israeli referee (2,561
 * words), and the engine's own `hebrew.jsonc`. **espeak ships no Hebrew at all**, so `sources.ts` reports
 * `[NONE] letter-names` and there is no dictsource tier. Full log:
 * `docs/investigations/he_normalization_investigation.md`.
 *
 * ⚠ THE ENGINE READS VOCALIZED HEBREW. `phonemize(x, "he")` is the Phase-1 rule g2p, so an UNVOCALIZED word
 * comes out as its bare consonants; the neural nakdan (`hebrewNeural.ts`) is the Phase-2 path that supplies
 * the niqqud. That is why every word this file emits is written WITH NIQQUD — a rewrite that emitted a bare
 * skeleton would be read as a consonant cluster on the sync path and would be re-guessed on the neural one.
 * The words themselves still go through the g2p (trap 6); this file emits TEXT and never IPA.
 *
 * ── WHAT THE ENGINE DID BEFORE THIS LAYER, on real corpus shapes ──────────────────────────────────────
 *
 *     ב-106            → v meʔa veʃeʃ            THE PROCLITIC IS A BARE CONSONANT     (×311 + ×36 maqaf)
 *     ה-19             → tʃa ʔesʁe               the definite article reads as ""      (×41 of those)
 *     ב-Google Drive   → v … (English fallback)  same defect before a Latin run        (×26)
 *     1,234            → ʔaχat , matajim …       the grouping comma is a CLAUSE PAUSE  (×76)
 *     $200,000         → matajim , ʔefes         …and the sign is silent               (×10)
 *     8%               → ʃmone                   the sign is silent                    (×78)
 *     2°C  /  18°C-    → ʃtajim sˈiː             ° silent, C = the ENGLISH LETTER NAME (×14)
 *                                                and the MINUS is on the FAR SIDE      (×5)
 *     8²               → ʃmone                   the exponent is silent                (×11)
 *     15 km³           → ˈʊkm kjˈuːbd            the whole unit leaks to English       (×2)
 *     12:30 / 00:00:00 → ʃtem ʔesʁe , ʃloʃim     the colon is a clause pause           (×5)
 *     ד"ר / צה"ל / ק"מ → d ʁ  /  t͡s l  /  k m   an acronym is TWO VOWEL-LESS FRAGMENTS (×146)
 *     ו"העיר           → v … (same shape)        …and 32 of those 146 are a QUOTE      (see step 5)
 *     לפנה"ס           → lfn s                   the era marker, ×10
 *     ג'יימס           → ɡ jjms                  the geresh SPLIT the word — fixed in hebrew.ts (×183)
 *
 * ⚠ THE EMPTY-READING PROBE THE `ug` RUN ASKS FOR: **0 of 380 segments read as the empty string.** Hebrew's
 * token class is `[א-ת]`+`[֑-ׇ]`, the corpus contains no Hebrew presentation forms (×0) and no zero-width
 * characters (×0), and a Latin run reaches the registry's English fallback rather than being dropped. The
 * class does exist one level down — bare `ה` reads as `""` (silent word-final he), which is why `ה-19` was
 * the worst of the six proclitics and why `hebrew.ts` now guards the furtive patach on a one-letter word.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the check that refused it ────────────────────────────────
 *
 * ⚠ NO LEADING-MINUS RULE, and this is `hi`'s refusal (trap 24) reproduced exactly. `(^|[\s([])-\s?\d` is
 *   ×7 in the corpus and **not one is a negative number**: five are a date RANGE dash inside a birth–death
 *   parenthetical (`9 בדצמבר 1942 - 7 בדצמבר 1997`), one is a clause dash (`בעולם - 783.84 קילומטר רבוע`)
 *   and one is an aircraft designation (`-700W`). The negative Hebrew actually writes is the TRAILING one
 *   at step 10, which has zero counter-examples. Re-checking this costs one grep.
 *
 * ⚠ NO RANGE CONNECTIVE. `digit–digit` is ×38 (en-dash) + ×16 (hyphen) and the engine already reads the two
 *   operands as a juxtaposition with no spurious pause, so there is no defect to repair — only a word to
 *   add. The word exists and is attested as an INFIX, unlike `ff hakkunde`: `עד` is ×42 whole-word and ×7
 *   between two numerals (`כ-25 עד 30 מיליון`, `כ-30 עד 40 סנטימטרים`, `מ-1997 עד 2001`). But five of those
 *   seven are the circumfix `מ… עד…` ("from … to"), the corpus's bare dashes include a football SCORE
 *   (`ברצלונה ניצחה 2–0`), a percentage span already carrying its own signs (`10%–30%`) and a season
 *   (`2010/11`), and nothing attests how a BARE dash is read. Recorded as a lead, not shipped.
 *
 * ⚠ NO FRACTION RULE. `sources.ts` reports `[NONE] fraction-series`, and reading all 11 `D/D` instances says
 *   the same from the other end: five are football SEASONS (`2010/11`, `2012/2013`), three are Israeli court
 *   docket numbers (`ע"א 136/71`, `513/89`, `41/92`), one is `793/1080` of an hour and one is `1/3`. Two
 *   real fractions in 380 segments, against a denominator series this repo does not carry.
 *
 * ⚠ NO `+`, `=`, `×` OR `&`. Trap 48's finding, in a corpus small enough to read entire. `+` ×6: `date +%s`
 *   (a shell command), `דיסני+` (the brand Disney+), `+1.9%` (a growth figure) and `מבני +65`/`+75`/`+20`
 *   — age brackets, which an RTL renderer displays as `65+`. `=` ×5 and `²`-heavy: `8² = 64` and one line
 *   of `2030 = 27² + 26² + 25²`. `&` ×12: ten are inside English titles the Latin fallback owns
 *   (`AT&T`, `Key & Peele`, `Safe & Sound`), two are a Hebrew list joiner (`שירי הרוק & האלטרנטיביים`) whose
 *   reading is the proclitic ו־ and would need the word welded onto the next token. No arithmetic Hebrew to
 *   source a reading from.
 *
 * ⚠ NO INITIALISMS. `letter-name` is ×196 in the artifact (`NYC`, `UTC`, `BBC`, `ABC`, `CGA`, `TT$`) and
 *   `core/initialisms.ts` is a NO-OP without a letter-name table. `sources.ts`: `[NONE] letter-names —
 *   espeak does not ship this language at all`. That is the true blocker, measured rather than assumed
 *   (trap 16). Note these runs are LATIN and currently reach the English fallback, which spells them out
 *   with English letter names — wrong-language, but not silent.
 *
 * ⚠ NO ORDINAL/GENDER AGREEMENT ON `ה-N`. `המאה ה-19` is read *hame'a ha-tsha esre* and the engine's
 *   feminine citation forms give exactly that; `ההר ה-232` wants the masculine and gets the feminine. That
 *   is `numbers.ts`'s standing register choice (its own header says so) and applying it here is trap 14 —
 *   the digits are not words until the tokenizer runs, so this rule has nothing to agree with. Step 6 emits
 *   the article and leaves the numeral to the engine.
 *
 * ⚠ NO ₪ RULE. The shekel SIGN is ×0 in the corpus, so the playbook's own calibration applies — a currency
 *   name is checked only if its sign occurs — and no `₪` arm is written. The ABBREVIATION ש"ח is ×2 and is
 *   a different question, answered at step 4: he.wikipedia's `שקל חדש` article names it outright.
 */

/** "not inside a word", the trap-1/23 form: `\p{M}` beside `\p{L}`, never `\b`. */
/** A number with an optional decimal tail — the operand every symbol rule takes. Anchored to END in a digit
 *  so the class cannot eat a trailing clause comma (trap 14's second hazard). Written `[0-9]` rather than
 *  `\d` for the trap-1 reason, and to agree with the ENGINE's own number token, which is `\d+(\.\d+)?`. */
const NUM = "[0-9]+(?:\\.[0-9]+)?";
/** Every dash the corpus writes between a proclitic and what it governs. The MAQAF ־ U+05BE is Hebrew's own
 *  and is ×36; the ASCII hyphen is ×311. Both mean the same thing here. */
const DASH = "[-‐‑־]";
/** The GERESH and the two characters a corpus writes in its place — U+05F3 is ×0 here, ASCII `'` is ×276. */
const GERESH = "['׳’]";
/** The GERSHAYIM and its stand-in — U+05F4 is ×2, ASCII `"` is ×677 (×146 of them letter-flanked). */
const GERSHAYIM = "[\"״]";

/**
 * ⚠ THE ONE-LETTER PROCLITICS, VOCALIZED. This is the layer's biggest class by a factor of three — 311
 * hyphen instances plus 36 maqaf ones plus 32 before an opening quote — and no DROP class reports any of
 * it, because the hyphen does not SURVIVE into the IPA. It is a tokenization defect, which the leak classes
 * are blind to by construction.
 *
 * `hebrew.jsonc` already declares five of these six and the rule that reads them: `proclitics` is
 * ⟨ו ל ב כ מ⟩ with "a word-initial sheva under one of these is a SHEVA-NA and is realised [e] in spoken
 * Modern Israeli Hebrew — veʁaʔa, leʔeveʁ, bejisʁaʔel — which two independent audio-grounded referees
 * (Phonikud, ReNikud) agree on". So the spelling below is not new data; it is the manifest's own rule
 * applied to the one-letter word the corpus writes.
 *
 *     ב־  בְּ  [be]     כ־  כְּ  [ke]  ("approximately", ×55 before a digit)
 *     ל־  לְ  [le]      ו־  וְ  [ve]
 *     ה־  הַ  [ha]  — the definite article, patach not sheva, and the ONE that read as `""`
 *     ש־  שֶׁ  [ʃe]  — segol not sheva; ×1, and only in the quote arm (it never precedes a digit here)
 *
 * ⚠ מ־ IS THE ONE SIMPLIFICATION, AND IT IS STATED. Hebrew's "from" prefix is מִ before a doubled consonant
 * and מֵ before a guttural, a distinction that depends on the first letter of the SPOKEN numeral and
 * therefore does not exist at this point in the pipeline (trap 14 again). מֵ is chosen because the numerals
 * that open the corpus's `מ-` instances are overwhelmingly guttural-initial — אֶלֶף, אַלְפַּיִם, אַרְבַּע, אַחַת,
 * עֶשְׂרִים, עֶשֶׂר — and because it is the form the manifest's own note about unmodelled morphophonology
 * ("the u-/va- morphophonology before labials is not modelled") already licenses as this file's register.
 */
const PROCLITIC: Record<string, string> = {
    "ב": "בְּ", "כ": "כְּ", "ל": "לְ", "ו": "וְ", "מ": "מֵ", "ה": "הַ", "ש": "שֶׁ",
};
/** The six that the corpus writes before a DIGIT or a Latin run. ש is absent from that position (×0) and is
 *  admitted only by the quote arm, where it is attested once (`ש"אפיין`) — trap 9, a guard alternative with
 *  no attested instance is a misfire generator. */
const PRO_DASH = "[בכלמוה]";
/** …and all seven before an opening quote. */
const PRO_QUOTE = "[בכלמוהש]";
const vocalize = (run: string): string => [...run].map((ch) => PROCLITIC[ch] ?? ch).join(" ");

/**
 * ⚠ THE ABBREVIATIONS THE CORPUS GLOSSES ITSELF, longest key first. Every expansion below is attested in
 * the SAME corpus (or, where marked, on he.wikipedia) — the strongest attestation there is, and the one
 * `ug`'s era table rests on. These run BEFORE the generic acronym join at step 5, or the join would weld
 * them into skeletons no reader speaks (`ק"מ` → *קמ*, `לפנה"ס` → *לפנהס*).
 *
 *   לפנה"ס  ×10  →  לִפְנֵי הַסְּפִירָה   the ERA MARKER, and the corpus writes the full phrase itself:
 *                                    `ב־538 לפני הספירה` sits in the same artifact as the ten abbreviations.
 *                                    `attest.ts`: ×48 tokens / 19 articles, and he.wikipedia's own article
 *                                    glosses BOTH forms — "כותבים בעברית 'לפני הספירה', ובקיצור לפנה"ס
 *                                    (או לפסה"נ = לפני ספירת הנוצרים)".
 *   לפסה"נ  ×1   →  לִפְנֵי סְפִירַת הַנּוֹצְרִים   from that same sentence — its own phrase, not folded onto
 *                                    לפני הספירה, because the wiki distinguishes them.
 *   ש"ח     ×2   →  שֶׁקֶל חָדָשׁ        `שקל חדש` ×23 / 11 articles, and its article opens
 *                                    "שקל חדש … (בראשי תיבות: ש"ח, סמל: ₪)" — it names this abbreviation.
 *   ק"מ     ×7   →  קִילוֹמֶטֶר         `קילומטר` ×3 tokens / 10 segments (`אורכו של חצי האי 7 קילומטרים`)
 *   קמ"ר    ×6   →  קִילוֹמֶטֶר רָבוּעַ   the COLLOCATION, not the bare modifier (trap 37): the corpus writes
 *                                    `783.84 קילומטר רבוע` ×2, gloss and symbol in one article
 *   מ"מ     ×3   →  מִילִימֶטֶר         `מילימטרים` ×1 (`כמות המשקעים … מ"מ לשנה`, the same sentence class)
 *   סמ"ק    ×2   →  סֶנְטִימֶטֶר מְעֻקָּב  `מעוקב` ×3, always postposed to its noun (`קילומטר מעוקב`,
 *                                    `למטר מעוקב`, `גרם למטר מעוקב`); `סנטימטרים` ×2
 *   ד"ר     ×4   →  דּוֹקְטוֹר          `דוקטור` ×258 tokens / 16 articles, and its article opens
 *                                    "דוקטור (בקיצור, ד"ר; PhD)" — it names this abbreviation too
 *   וכו׳    ×2   →  וְכוּלֵי           see the note below — `attest.ts` and a direct `insource:` search
 *                                    disagree, and the disagreement is recorded rather than resolved away
 *   פרופ׳   ×1   →  פְּרוֹפֶסוֹר        `פרופסור` ×2 tokens in the corpus
 *
 * ⚠ THE ONE SPLIT VERDICT, AND BOTH NUMBERS ARE HERE. `attest.ts --words וכולי` returns **absent, 0 token /
 * 0 substring** — but a direct `insource:"וכולי"` search of the same wiki reports **471 articles**, with
 * snippets using it as the list-closing "etc." (`טובה, חקסיה, אויגוריה וכולי`, `חדר בענייני משחקים … וכולי`).
 * The probe's article SAMPLE simply did not overlap; a 0/0 with no substring hits either is the shape of a
 * query that found nothing to look in, not of a word that is absent. The expansion is kept on the direct
 * evidence, at ×2 instances, and the discrepancy is written down so nobody re-derives it as a refusal.
 *
 * ⚠ NOT DECLARED: מ"ר. It is ×0 here, and a key that buys nothing is pure exposure (traps 28/46) — the
 * two-letter LHS `מ` would have to compete with the `מ"מ` key for the same first letter. (he.wikipedia's
 * own קילומטר רבוע article shows a second spelling for the squared unit, `ק"מ²`; also ×0 here.)
 *
 * ⚠ THE PROCLITIC PREFIX RIDES ALONG, and it must. The corpus writes `לסמ"ק`, `לקמ"ר`, `לרק"ם`, `בצה"ל`
 * — a proclitic GLUED to the acronym with no hyphen, which is ordinary orthography and not this file's
 * hyphen case. The capture re-emits it (trap 10) welded to the expansion's first word, so `לקמ"ר` becomes
 * `לְקִילוֹמֶטֶר רָבוּעַ` ("per square kilometre") and keeps its own vowel rather than becoming a bare [l].
 */
const ABBREV: readonly (readonly [string, string, string])[] = [
    // [ body (regex, no anchors), vocalized expansion, the glued-proclitic-friendly first word ]
    ["לפנה" + GERSHAYIM + "ס", "לִפְנֵי הַסְּפִירָה", "לִפְנֵי"],
    ["לפסה" + GERSHAYIM + "נ", "לִפְנֵי סְפִירַת הַנּוֹצְרִים", "לִפְנֵי"],
    ["קמ" + GERSHAYIM + "ר", "קִילוֹמֶטֶר רָבוּעַ", "קִילוֹמֶטֶר"],
    ["סמ" + GERSHAYIM + "ק", "סֶנְטִימֶטֶר מְעֻקָּב", "סֶנְטִימֶטֶר"],
    ["ק" + GERSHAYIM + "מ", "קִילוֹמֶטֶר", "קִילוֹמֶטֶר"],
    ["מ" + GERSHAYIM + "מ", "מִילִימֶטֶר", "מִילִימֶטֶר"],
    ["ד" + GERSHAYIM + "ר", "דּוֹקְטוֹר", "דּוֹקְטוֹר"],
    ["ש" + GERSHAYIM + "ח", "שֶׁקֶל חָדָשׁ", "שֶׁקֶל"],
    ["וכו" + GERESH, "וְכוּלֵי", "וְכוּלֵי"],
    ["פרופ" + GERESH, "פְּרוֹפֶסוֹר", "פְּרוֹפֶסוֹר"],
];

/** Build the Hebrew text normalizer. */
export function normalizeHebrew(input: string): string {
    // 1) NFC at the entry. Hebrew letters have composition exclusions (the precomposed U+FB2A–FB4F forms, and
    //    every pointed letter is decomposed by NFC), so a rule keyed on a literal would otherwise match a
    //    fraction of its instances — trap 11. The g2p NFCs again downstream, so this costs nothing.
    let s = input.normalize("NFC");

    // 1b) ⚠ THE SOF PASUQ IS A CLAUSE MARK AND MUST NOT BE GLUED TO THE WORD. `׃` is declared in
    //     `clausePunctuation` (→ "."), but the word tokenizer admits it inside a word — it sits in the
    //     [U+0591–U+05C7] mark class the token pattern uses — so `עולם׃` matches as ONE word and the
    //     punctuation alternative never sees it. The declared pause was silently dropped, and the mark
    //     rode into the g2p. Separating it lets the existing rule do what it already says it does.
    s = s.replace(/\u05C3/gu, " \u05C3 ");

    // 2) ⚠ BIDI FORMAT CONTROLS — ×27, and this is the concrete form of the RTL hazard. Every one is
    //    U+200F RLM, dropped by a Hebrew author to stop a Latin gloss from reordering:
    //        `Terry Andrew Davis;‏ 15 בדצמבר 1969`   `Elle Chapman; ‏26 במאי 1999`   `Borduas‏: 1 בנובמבר`
    //    Note `‏26` — the mark sits DIRECTLY against the digit with no space. The characters are inert to the
    //    engine (its token class ignores them) but they are not inert to a REGEX: a guard written
    //    `(^|\s)` fails against them and a guard written `(?<![\p{L}\p{M}])` does not. Stripping them once
    //    here is cheaper and safer than remembering that in fifteen places.
    //    ⚠ DELETED RATHER THAN SPACED, which is the one place trap 26 does not apply: these are zero-width
    //    by definition, so they never separated two tokens that a space now has to keep apart.
    s = s.replace(/[‎‏‪-‮⁦-⁩​-‍﻿]/gu, "");
    s = s.replace(/&nbsp;|&#(?:x[0-9a-f]+|\d+);/giu, " ");

    // 3) DIGIT DE-GROUPING, FIRST among the numeric rules — a grouping comma is otherwise read as CLAUSE
    //    PUNCTUATION and the tail as a number in its own right (`1,234` → "one, two hundred thirty-four";
    //    `$200,000` → "two hundred, ZERO"). It must also precede the currency and percent rules, or their
    //    operand stops at the first comma.
    //    ⚠ THE TWO MARKS DO NOT OVERLAP AT ALL. Measured over the 380 segments:
    //        `,` with 3-digit groups ×76      `,` with a 1–2 digit tail ×0
    //        `.` as a decimal        ×53      `.` with a 3-digit tail   ×1
    //    …and that one dotted case is `1.139 מיליארד דולר` — 1.139 BILLION, i.e. a decimal too. So Hebrew
    //    groups with a comma and points with a dot, cleanly, and there is no dot arm. The engine's own
    //    number token already reads `\d+(\.\d+)?`, so decimals need nothing from this file (`11.4%` →
    //    *ʔaχat ʔesʁe nkuda ʔaʁba*, with נְקֻדָּה from the manifest).
    //    ⚠ THE TRAILING GUARD EXCLUDES A FOLLOWING SEPARATOR+DIGIT, not a clause mark, or a number followed
    //    by its own sentence comma would lose its last group and speak it as zero.
    s = s.replace(/(?<![0-9.,])[0-9]{1,3}(?:,[0-9]{3})+(?![0-9]|,[0-9])/gu, (w) => w.replace(/,/gu, ""));

    // 4) THE GLOSSED ABBREVIATIONS, before the generic acronym join at step 5 (which would otherwise weld
    //    them) and before the proclitic rule at step 6 (whose `PRO_DASH` never sees these — they are glued,
    //    not hyphenated — but whose vocabulary the expansions' own prefixes reuse). See ABBREV for the
    //    per-key attestation.
    //    ⚠ THE ANCHORS ARE LETTER-CLASS LOOKAROUNDS, never `\b` (trap 1) — `\b` is ASCII-defined and would
    //    match nothing at all against a Hebrew literal.
    //    ⚠ AND THE PREFIX MUST BE VOCALIZED WHERE IT IS WELDED, not merely carried over. Re-emitting the
    //    captured letter verbatim gives `לסֶנְטִימֶטֶר` — a bare ל on the front of a pointed word, which the
    //    g2p reads as the cluster *lsentimeter* because a sheva-less proclitic has no vowel to realise. The
    //    prefix is exactly one letter here (the corpus writes no glued pair), so its pointed form welds
    //    straight onto the expansion's head word: `לְ` + `סֶנְטִימֶטֶר` → *lesentimeter*.
    for (const [body, expansion, head] of ABBREV) {
        const tail = expansion.slice(head.length);
        s = s.replace(
            new RegExp(`${NOT_LETTER_BEFORE}(${PRO_DASH}?)${body}${NOT_LETTER_AFTER}`, "gu"),
            (_m: string, pre: string) => `${pre === "" ? expansion : (PROCLITIC[pre] ?? pre) + head + tail} `,
        );
    }

    // 5) ⚠ THE GERSHAYIM, AND THE TRAP-39 COMPETITION IT SETS UP — ×146 letter-flanked instances, of which
    //    110 are an ACRONYM and 32 are an OPENING QUOTATION MARK, and the two rules want opposite things
    //    from the same three characters. The engine reads both as two vowel-less fragments today
    //    (`ד"ר` → *d ʁ*, `צה"ל` → *t͡s l*, `ו"העיר` → *v* + the word).
    //
    //    ⚠ THE DISCRIMINATOR IS SHAPE, NOT VOCABULARY, and it partitions the corpus 146/146:
    //        an acronym's mark sits BEFORE THE LAST LETTER — צה"ל · ד"ר · האו"ם · נדל"ן · יו"ר · תשפ"ד
    //        a quote's LEFT side is a bare PROCLITIC RUN and its right side is a whole word —
    //            ו"העיר · כ"סילוף · ה"אוטומטיס · ל"התקפות · ב"סקאם · ש"אפיין · ול"אלבום
    //    So the QUOTE arm runs FIRST and is the narrow one: a run of 1–2 PROCLITIC letters, word-initial,
    //    followed by the mark and by TWO OR MORE Hebrew letters. Everything the acronym arm then sees is an
    //    acronym. Verified against every one of the 146: the quote arm takes exactly 32 and the acronym arm
    //    the other 114.
    //    ⚠ THE "TWO OR MORE" AND THE PROCLITIC CLASS ARE BOTH LOAD-BEARING, and each was added after
    //    counting. Without the length test the quote arm would eat `מ"מ`, `ש"ח`, `כ"ו` and `ה"נ`, all of
    //    which are acronyms with a one-letter tail. Without the class test it would eat `כמנכ"לית` and
    //    `ומנכ"לית` (the feminine of מנכ"ל — an inflectional suffix appended AFTER the mark) and `להט"בים`,
    //    which are the only three genuine acronyms in the corpus with a multi-letter tail; the class rejects
    //    them because `כמנכ` contains נ and `להט` contains ט, while `ול` is proclitic all through.
    //
    //    ⚠ AND THE HEBREW YEAR IS THE SAME OPERATION, WHICH IS WHY THE THIRD RULE DOES NOT COMPETE. The
    //    task's warning is that an abbreviation rule and a NUMERAL (gematria) rule will fight over this
    //    character. In Hebrew they do not, because a year is READ AS THE JOINED LETTERS PRONOUNCED AS A
    //    WORD — תשפ"ד is *tashpad*, not "five thousand seven hundred eighty-four" — so the numeral wants
    //    exactly what the acronym wants. The corpus's five gematria instances (תשפ"ד, תשס"ג, תשמ"ג, י"ב,
    //    כ"ו) all take the acronym arm and all are right for it. A gematria→cardinal rule would have been
    //    the confidently-wrong reading here, and it is not written.
    //
    //    ⚠ THE ACRONYM ARM JOINS RATHER THAN EXPANDS, and that is what the layer is for. `צה"ל` is not a
    //    word the pipeline speaks; `צהל` is a skeleton it does — the neural nakdan vocalizes it, and the
    //    sync path stops emitting a spurious word boundary. The acronyms that are NOT read as a word are
    //    the eight at step 4, which is why step 4 runs first.
    s = s.replace(
        new RegExp(`${NOT_LETTER_BEFORE}(${PRO_QUOTE}{1,2})${GERSHAYIM}(?=[א-ת]{2,})`, "gu"),
        (_m: string, run: string) => `${vocalize(run)} "`,
    );
    s = s.replace(
        new RegExp(`${NOT_LETTER_BEFORE}([א-ת]{1,6})${GERSHAYIM}([א-ת]{1,8})${NOT_LETTER_AFTER}`, "gu"),
        "$1$2",
    );

    // 6) ⚠ THE PROCLITIC BEFORE A DIGIT OR A LATIN RUN — the layer's largest class: ×311 hyphen, ×36 maqaf,
    //    ×26 before Latin. `ב-106` read *v meʔa veʃeʃ* and `ה-19` read *tʃa ʔesʁe*, the article silent.
    //    See PROCLITIC for the vocalizations and for the one simplification (מ־).
    //
    //    ⚠ THE LOOKAHEAD IS DIGITS AND LATIN ONLY, BECAUSE A HYPHEN BEFORE A HEBREW WORD IS A COMPOUND.
    //    Tabulated: all 29 `letter-dash-Hebrew` instances are compounds or names — `על-פני`, `בן-נון`,
    //    `דו-קוטבית`, `תת-הלהקה`, `אל-אסד`, `צפון-מזרחית`, `דרום-קוריאני` — and none is a proclitic. Trap 9:
    //    an arm with no attested instance is a misfire generator, and this one would have claimed the first
    //    letter of every hyphenated compound in the language.
    //    ⚠ THE LEFT GUARD IS WHAT MAKES THAT SAFE FROM THE OTHER SIDE. Without `(?<![\p{L}\p{M}])` the two
    //    letters before the hyphen of `הים-תיכוני` are ⟨ים⟩, which is a legal-looking proclitic run.
    //    ⚠ RUNS OF ONE OR TWO, and both are attested: `בכ-6` ×6, `וכ-3` ×3, `וב-2` ×2, `לכ-2`, `וה-1`.
    //    Each letter is vocalized separately (`וְ כְּ`) rather than fused, because the fused forms are exactly
    //    the u-/va- morphophonology `hebrew.jsonc` records as unmodelled. Zero non-proclitic letters occur
    //    in this position in the corpus, so the class is closed by measurement rather than by assumption.
    s = s.replace(
        new RegExp(`${NOT_LETTER_BEFORE}(${PRO_DASH}{1,2})${DASH}(?=[0-9A-Za-z])`, "gu"),
        (_m: string, run: string) => `${vocalize(run)} `,
    );

    // 7) PERCENT — ×78 signs, every one silent today, and the sign is POSTFIX in all of them (`%`-before-a
    //    -digit is ×0 here, unlike the Arabic-script languages). The word is אָחוּז and it is SINGULAR after
    //    any number: the corpus spells it out three times, all digit-adjacent and all singular —
    //    `נתח של 20 אחוז`, `אפשטיין קיבל 10 אחוז`, `דיק ג'יימס מיוזיק 50 אחוז` — which is both the
    //    attestation and the agreement check the playbook asks for on a counted noun. (The plural אחוזים is
    //    ×0; the corpus's other four hits are the construct אחוזי־, `אחוזי ההצלחה`, a different slot.)
    //    ⚠ AND THE WORD MAY ALREADY BE THERE (trap 12) — `20 אחוז` ×3 carries no sign at all, so the two
    //    forms cannot collide, but the guard is written anyway because it costs one alternation.
    s = s.replace(
        new RegExp(`(${NUM})\\s?%\\s?(אחוז\\S*)?`, "gu"),
        (_m: string, n: string, named: string | undefined) => `${n} ${named ?? "אָחוּז"} `,
    );

    // 8) CURRENCY. `$` is the only sign the corpus writes — `₪` is ×0, so the shekel word is not declared
    //    (the playbook's own calibration: a currency name is checked only if its SIGN occurs).
    //    ⚠ BOTH ORDERS, AND THAT IS BIDI RATHER THAN INCONSISTENCY. `$200,000` and `בסך $100` (×3, sign
    //    first) sit in the same corpus as `(60,134$)`, `(35,362$)`, `($674)`, `(2,674$)` (×7, sign last) —
    //    a table of GDP-per-capita figures where the author typed the sign after the number because an RTL
    //    renderer puts it on the correct side either way. A postfix-only rule would miss 70% of the class.
    //    ⚠ דּוֹלָר IS POSTPOSED AND SINGULAR, from the corpus's own eight spelled-out instances:
    //    `3 מיליון דולר`, `10,000 דולר`, `כ-1.27 מיליארד דולר`, `40 אלף דולר`, `576,000 דולר טרינידדי`.
    //    Note the last: the corpus also names a non-US dollar, so the word is the right one for a bare `$`.
    //    ⚠ THE MAGNITUDE WORD SITS INSIDE THE QUANTITY, NOT AFTER THE UNIT — five of those eight are
    //    `N מיליון/מיליארד/אלף דולר`. Those instances carry no sign, so no arm is needed; recorded because
    //    the id lesson (`empat belas koma tujuh DOLAR MILIAR`) is what a naive sign rule produces here.
    //    ⚠ A MAGNITUDE WORD MAY SIT BETWEEN THE NUMBER AND ITS SIGN, and without an arm for it the sign is
    //    adjacent to nothing. `(815,272 מיליון $)`, `(833,541 מיליון $)`, `(481,591 מיליון $)` — three of
    //    the corpus's ten dollar signs, a GDP table that puts the sign after the magnitude. The magnitude is
    //    re-emitted where it stands, because it belongs INSIDE the quantity and not after the currency noun
    //    (the id lesson: `empat belas koma tujuh DOLAR MILIAR`). Postfix only — the corpus writes no
    //    `$ N מיליון`, and trap 9 says do not widen a guard for a shape with no instance.
    const MAG = "(?:\\s(?:אלף|מיליון|מיליארד|טריליון))?";
    s = s.replace(new RegExp(`\\$\\s?(${NUM})`, "gu"), "$1 דּוֹלָר ");
    s = s.replace(new RegExp(`(${NUM}${MAG})\\s?\\$`, "gu"), "$1 דּוֹלָר ");

    // 9) ⚠ THE MINUS, WRITTEN AFTER THE UNIT — and this is the bidi hazard as a READING rather than as a
    //    regex problem. Hebrew's own corpus writes a negative temperature with the sign LAST, because in
    //    RTL display a trailing hyphen renders to the left of the quantity, which is where a minus belongs:
    //        `הטמפרטורה … הממוצעת היא 18°C- בשולי היבשת ו-45°C- בתוך היבשת`   `נמוכות מ-60°C-.`   `89.2°C-.`
    //    ×5, and he.wikipedia does it again independently (`273- מעלות צלזיוס`, absolute zero). The LEADING
    //    minus is ×7 and never a negative — see the header's refusal.
    //    ⚠ IT MUST RUN ABOVE STEP 10, WHICH SPENDS THE `°C` THIS GUARD READS. Trap 39, and it is ug's
    //    coupling in the same class: the discriminator is the temperature on the right, and step 10 turns
    //    that into words. (`℃` is already `°C` by now — `registry.ts` folds it for every language.)
    //    ⚠ מִינוּס IS PREPOSED, AND THE SOURCING SETTLES THE POSITION AS WELL AS THE WORD. ×213 articles on
    //    he.wikipedia and every quoted instance is in front of its quantity: `מינוס 80 צלזיוס`,
    //    `מינוס 273.15 מעלות צלזיוס`, `מינוס 38 מעלות`, `מינוס 4 מעלות צלזיוס`, `מינוס 14.2 מעלות`. It is
    //    ×0 in the mined corpus, which is the ordinary shape for a SIGN's word (a writer types the glyph).
    s = s.replace(
        new RegExp(`(?<![0-9.,])(${NUM})(\\s?°\\s?[CF])\\s?[-−–]`, "gui"),
        "מִינוּס $1$2",
    );

    // 10) DEGREES. `°C` BEFORE the bare `°`, or the scale letter is stranded and read as the ENGLISH letter
    //     name — which is what happens today (`2°C` → *ʃtajim sˈiː*).
    //     ⚠ מַעֲלוֹת צֶלְזִיוּס, and unlike every other word in this file it had to come from outside the corpus:
    //     `מעלות` is ×0 here and `מעלה` is ×11 SUBSTRING-ONLY inside `למעלה מ-` ("more than") — trap 37 in
    //     its purest form, a bare modifier that is a different word entirely. he.wikipedia settles it: the
    //     collocation `מעלות צלזיוס` is **×2,865 articles**, postposed, in exactly this slot —
    //     `18.7 מעלות צלזיוס`, `38.5 מעלות צלזיוס`, `15–30 מעלות צלזיוס` — and the wiki has an article of
    //     that title which opens `מעלות צלזיוס, שסימנן C°`, i.e. it names the symbol this rule reads.
    //     ⚠ THE BARE `°` TAKES THE SAME NOUN WITHOUT THE SCALE NAME. Its ×7 are coordinates
    //     (`קו הרוחב 78° דרום`, `קו רוחב 40°`, `זווית קשר של 104.5°`), where מעלות is the same word. The
    //     ARC-MINUTE is left unread: `36°30′` is ×2 and no minutes word is attested — the same partial ug
    //     and ps both shipped, stated rather than guessed at.
    s = s.replace(new RegExp(`(?<![0-9.,])(${NUM})\\s?°\\s?[CF]${NOT_LETTER_AFTER}`, "gui"), "$1 מַעֲלוֹת צֶלְזִיוּס ");
    s = s.replace(new RegExp(`(?<![0-9.,])(${NUM})\\s?°`, "gu"), "$1 מַעֲלוֹת ");

    // 11) THE EXPONENT, and the corpus glosses its own symbol TWICE — the strongest attestation available
    //     and the same shape trap 45 uses. `"שמונה בריבוע" (כי 8² = 64)` writes the word and the symbol in
    //     one sentence; `c² מהירות האור בריבוע` does it again for the speed of light. בריבוע is ×3, always
    //     POSTPOSED, and always with its own ב prefix (the word is adverbial: "in square").
    //     ⚠ THE LATIN UNIT ARM RUNS FIRST, or `km³` loses its unit and keeps only the exponent. ×2
    //     (`בנפח של כ-15 km³`, `טפרה בנפח של 0.91 km³`) and both leak to the English fallback today
    //     (*ˈʊkm kjˈuːbd*). `מְעֻקָּב` is the corpus's own cube word, ×3, and the corpus writes the whole
    //     collocation for this very quantity: `כ-25 עד 30 מיליון קילומטר מעוקב`.
    //     ⚠ ONLY MULTI-LETTER LATIN KEYS (traps 28/46). A bare `m` key would claim `802.11m`-shaped
    //     designations and the corpus's heavy Latin residue; `version-dot` is ×4 here, so the exposure is
    //     real, and neither `m²` nor `m³` occurs at all.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}0-9.])(${NUM})\\s?km³${NOT_LETTER_AFTER}`, "gu"), "$1 קִילוֹמֶטֶר מְעֻקָּב ");
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}0-9.])(${NUM})\\s?km²${NOT_LETTER_AFTER}`, "gu"), "$1 קִילוֹמֶטֶר רָבוּעַ ");
    s = s.replace(new RegExp(`(?<![0-9.,])(${NUM})\\s?²`, "gu"), "$1 בְּרִיבּוּעַ ");

    // 12) THE CLOCK COLON → A SPACE, and this is `ug`'s decimal refusal in another class: the defect is a
    //     spurious CLAUSE PAUSE, and removing it costs no vocabulary. `:` is declared clause punctuation, so
    //     `12:30` reads *ʃtem ʔesʁe , ʃloʃim* — a sentence break inside a quantity.
    //     ⚠ AND NO CLOCK WORDS, BECAUSE FOUR OF THE FIVE INSTANCES ARE NOT CLOCKS. Read entire:
    //     `64:78` is a BASKETBALL SCORE (`גברה ריאל מדריד על ורונה בתוצאה 64:78`), `1:13:13`, `01:10:12`
    //     and `01:29` are YouTube durations, and only `בשעה 00:00:00 לפי הזמן האוניברסלי` is a time of day.
    //     A rule emitting שעות/דקות would be right once and wrong four times.
    //     ⚠ SUBSTITUTE, NEVER DELETE (trap 26) — deleting the colon makes `12:30` the number 1230.
    s = s.replace(/(?<=[0-9])\s?:\s?(?=[0-9]{2})/gu, " ");

    return s;
}
