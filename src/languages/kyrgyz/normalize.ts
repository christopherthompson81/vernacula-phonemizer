/**
 * Kyrgyz (ky) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ THE HYPHENATED ORDINAL IS THIS LANGUAGE'S DEFINING FORM, and it is the playbook's trap-14 prediction for
 * the Turkic corpora arriving in its HYPHENATED half rather than the glued half Azerbaijani and Kazakh were
 * measured on. Kyrgyz writes an ordinal as digits + HYPHEN + the head noun — `1991-жылы`, `19-кылымда`,
 * `9-май`, `31-декабрь` — where the hyphen stands in for the ordinal suffix -ынчы/-инчи/-унчу/-үнчү. Measured
 * on the mined artifact (ky.wikipedia dump, 233,521 paragraphs; 256 hard + 200 sample segments retained):
 *
 *     \d+-<Cyrillic>   354 total, and 101 in the 200-segment SAMPLE tier — HALF of representative Kyrgyz
 *     \d+<Cyrillic>     44 total,  10 in the sample (the glued case suffix: 150дөн, 1000ге, 97ден, 40тан)
 *     \d,\d decimal    208        \d ?[-–] ?\d range 119        %  80        \d{1,2}:\d{2}  18, none in sample
 *
 * Unclaimed, all 354 read as CARDINALS: `19-кылымда` was *on toʁuz qɯɫɯmdɑ*, "nineteen century-in". The rule
 * is trap 14's fix shape — convert the operand to WORDS inside the rule, apply the morphology there, then
 * claim anything the shared tier can no longer see.
 *
 * ⚠ THE ORDINAL READING OF A BARE YEAR IS SOURCED, not assumed. ky.wikipedia's own year articles gloss the
 * digits with the spelled form: «1989 (бир миң тогуз жүз сексен тогузунчу) жыл», «1914 (бир миң тогуз жүз он
 * төртүнчү) жыл», «1958 (бир миң тогуз жүз элүү сегизинчи) жыл» — three independent articles, and they also
 * settled the `бир миң` cardinal defect in kyrgyz.ts.
 *
 * ⚠ THE ORDINAL SERIES IS COMPOSED, NOT TABULATED (playbook trap 8/13), and the composition was validated
 * OUT OF SAMPLE. The harmony rule was fitted on the five forms the mined corpus attests — биринчи, экинчи,
 * үчүнчү, төртүнчү, сегизинчи — and then PREDICTED fifteen more, every one of which `attest.ts` finds on
 * ky.wikipedia independently: онунчу ×17, жыйырманчы ×20, отузунчу ×16, кыркынчы ×8, элүүнчү ×12,
 * алтымышынчы ×6, жетимишинчи ×4, сексенинчи ×3, токсонунчу ×2, жүзүнчү ×8, миңинчи ×16, алтынчы ×22,
 * жетинчи ×25, бешинчи ×22, тогузунчу ×18. 20/20. That is a real out-of-sample check, not the Odia
 * calibration trap: the answers were not in the set the rule was fitted on.
 *
 * ⚠ Every boundary in this file is an explicit lookaround, never `\b` — `\b` is ASCII-defined and finds no
 * boundary against Cyrillic (playbook trap 1). Character classes carry `iu` or spell both cases out, because
 * a capitalised head is ORDINARY here (`9-Май`, `8-Март`, `16-Февралда`) — trap 7.
 *
 * ⚠ WHAT IS DELIBERATELY NOT READ, with the count that makes each a decision rather than an oversight, is at
 * the foot of this file. The RANGE JOINER is the largest, and the MINUS is the one that started
 * there and came back — a refusal is a measurement, and it is re-runnable (trap 24).
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { MANIFEST } from "./manifest.ts";
import { numberWords } from "./kyrgyz.ts";

// ---------------------------------------------------------------------------------------------------
// KYRGYZ SUFFIX MORPHOLOGY — the machinery trap 14 says every rule here needs
// ---------------------------------------------------------------------------------------------------

/**
 * Kyrgyz vowel harmony is FOUR-WAY on the last vowel of the stem, and a suffix carries either a HIGH vowel
 * (ы/и/у/ү) or a LOW one (а/е/о/ө) depending on which suffix it is. One table, both series.
 */
const HARMONY: Readonly<Record<string, { hi: string; lo: string }>> = {
    а: { hi: "ы", lo: "а" }, ы: { hi: "ы", lo: "а" },
    о: { hi: "у", lo: "о" },
    // ⚠ BACK /у/ IS THE ASYMMETRIC ONE, and getting it wrong is the difference between *градуска* (what this
    // corpus writes) and *градуско*. Kyrgyz rounding harmony is complete for the HIGH series (у → у) but the
    // LOW series is rounded only after a MID round vowel: жол→жол**дор**, көл→көл**дөр**, күн→күн**дөр** —
    // yet кул→кул**дар**, тогуз→тогуз**дан**, градус→градус**ка**. Front /ү/ does trigger ө; back /у/ does
    // not trigger о. Verified against every glued instance the mined corpus writes and against the corpus's
    // own «11 градуска чейин».
    у: { hi: "у", lo: "а" },
    е: { hi: "и", lo: "е" }, и: { hi: "и", lo: "е" }, э: { hi: "и", lo: "е" },
    ө: { hi: "ү", lo: "ө" }, ү: { hi: "ү", lo: "ө" },
};
const VOWELS = "аоуыеэиөүяюё";
/** Kyrgyz voiceless consonants — they select the т-/к- series of every suffix below. */
const VOICELESS = new Set([..."пфктсшчхцщ"]);

/** The harmony class of a word, read off its LAST vowel letter; defaults to the back-unrounded series. */
function harmonyOf(word: string): { hi: string; lo: string } {
    for (let i = word.length - 1; i >= 0; i--) {
        const h = HARMONY[word[i]!];
        if (h !== undefined) return h;
    }
    return { hi: "ы", lo: "а" };
}
const endsInVowel = (w: string): boolean => VOWELS.includes(w[w.length - 1] ?? "");
const endsVoiceless = (w: string): boolean => VOICELESS.has(w[w.length - 1] ?? "");

/**
 * The grammatical categories that actually occur bound to a numeral, a percent sign or a unit in ky's corpus.
 *
 * ⚠ NUMBERS BEHIND NAMED KEYS, NOT A STRING UNION, AND THE REASON IS A GATE. `review.ts`'s sourcing check
 * hops from the percent rule into every function that rule calls and treats each STRING LITERAL it finds
 * there as a word to attest. With `type Case = "abl" | "dat" | …` and a switch on those literals, it reported
 * nine grammatical tags as unsourced vocabulary — and пайыз, доллар and евро, the words the line exists to
 * check, were buried in the noise. Unquoted object keys are invisible to that extractor, so the names survive
 * here and the check reads what it is for. (Trap 57's lesson from the other side: a gate that cries wolf is a
 * gate that gets switched off.)
 */
const CASE = {
    abl: 0, dat: 1, loc: 2, acc: 3, gen: 4, equ: 5, poss: 6, possAcc: 7, possDat: 8,
} as const;
type Case = (typeof CASE)[keyof typeof CASE];

/**
 * Build the CORRECT written form of a bound suffix for a given spoken stem.
 *
 * ⚠ THIS RE-DERIVES RATHER THAN COPYING, and that is the whole point of trap 14. The suffix in the text was
 * harmonised by a writer looking at the DIGITS, and the corpus proves it does not always agree with the
 * words: `1923гө` is *үч*, so the dative is `үчкө` and not `-гө`; `25ге` is *беш*, so it is `бешке`; `10.00до`
 * is *нөл*, so it is `нөлдө`. Ten of the corpus's glued instances agree with the derivation and three do not,
 * and the three that do not are the ones a verbatim copy would get wrong.
 *
 * The consonant series is the standard Kyrgyz assimilation: т-/к- after a voiceless stem, д-/г- otherwise,
 * and н- for the accusative/genitive after a vowel. Cross-checked against every attested form in the mined
 * corpus — сомдон, ммге, августка, 16дан, 150дөн, 97ден, 20дан, 21ден, 65тен, 40тан, 85тен, 11де.
 */
function suffix(stem: string, kind: Case): string {
    const { hi, lo } = harmonyOf(stem);
    const vowel = endsInVowel(stem);
    const voiceless = endsVoiceless(stem);
    const d = voiceless ? "т" : "д";
    switch (kind) {
        case CASE.abl: return `${d}${lo}н`;                             // -дан/-ден/-дон/-дөн, -тан/…
        case CASE.dat: return `${voiceless ? "к" : "г"}${lo}`;          // -га/-ге/-го/-гө, -ка/…
        case CASE.loc: return `${d}${lo}`;                              // -да/-де/-до/-дө, -та/…
        case CASE.acc: return `${vowel ? "н" : d}${hi}`;                // -ны/-ди/-ту/-дү
        case CASE.gen: return `${vowel ? "н" : d}${hi}н`;               // -нын/-дин/-түн
        case CASE.equ: return `${d}${lo}й`;                             // -дай/-дей/-дой/-дөй
        case CASE.poss: return vowel ? `с${hi}` : hi;                   // 3sg possessive: -ы/-и/-у/-ү, -сы/…
        case CASE.possAcc: return `${vowel ? `с${hi}` : hi}н`;          // possessive + accusative
        case CASE.possDat: return `${vowel ? `с${hi}` : hi}н${lo}`;     // possessive + dative
    }
}

/**
 * Recognise a WRITTEN bound suffix and say which category it is. Longest form first, or `-дай` is read as
 * `-да` and `-дын` as `-ды`. Every alternation listed is one the corpus writes after a digit or a `%`.
 *
 * ⚠ THE SPACED/HYPHENATED ALTERNATION IS NARROWER THAN THE GLUED ONE (playbook trap 9/15). This table is
 * consulted for both `150дөн` and `150-дөн`, but ONLY as a whole-token tail; a Cyrillic word that merely
 * BEGINS with these letters (жылы, декабрь, кылымда) is not a suffix and falls through to the ordinal rule.
 */
const SUFFIX_TABLE: ReadonlyArray<readonly [RegExp, Case]> = [
    [/^(?:[дтн][ыиуү]н)$/u, CASE.gen],
    [/^(?:[дт][аеоө]н)$/u, CASE.abl],
    [/^(?:[дт][аеоө]й)$/u, CASE.equ],
    [/^(?:[ыиуү]|с[ыиуү])н[аеоө]$/u, CASE.possDat],
    [/^(?:[ыиуү]|с[ыиуү])н$/u, CASE.possAcc],
    [/^(?:[гк][аеоө])$/u, CASE.dat],
    [/^(?:[дт][аеоө])$/u, CASE.loc],
    [/^(?:[дтн][ыиуү])$/u, CASE.acc],
    [/^(?:[ыиуү]|с[ыиуү])$/u, CASE.poss],
];
/** The written tail → its category, or undefined if it is not a bound suffix at all (i.e. it is a NOUN). */
function suffixKind(tail: string): Case | undefined {
    for (const [re, kind] of SUFFIX_TABLE) if (re.test(tail)) return kind;
    return undefined;
}
/** One alternation matching every written form the table above recognises — for use inside a bigger pattern. */
const SUFFIX_RE = "(?:[дтн][ыиуү]н|[дт][аеоө][нй]|(?:с?[ыиуү])н[аеоө]|(?:с?[ыиуү])н|[гк][аеоө]|[дт][аеоө]|[дтн][ыиуү]|с?[ыиуү])";

/** Attach a bound suffix to the LAST WORD of a spoken numeral — the agreement trap 14 says digits cannot carry. */
function glue(words: string, kind: Case): string {
    const parts = words.split(" ");
    const last = parts[parts.length - 1]!;
    parts[parts.length - 1] = `${last}${suffix(last, kind)}`;
    return parts.join(" ");
}

/**
 * Integer → the Kyrgyz ORDINAL, i.e. the cardinal with -ынчы/-инчи/-унчу/-үнчү on its LAST word only:
 * 19 → *он тогузунчу*, 1991 → *бир миң тогуз жүз токсон биринчи*, 45 → *кырк бешинчи*.
 *
 * The linking vowel is dropped after a vowel-final stem (эки → эки**нчи**, жыйырма → жыйырма**нчы**,
 * элүү → элүү**нчү**), which is the same shape every other Kyrgyz suffix takes. ky.wikipedia's orthography
 * article §49 is the direct citation for the "last word only" half — it lists «он беш, бир миң тогуз жүз
 * токсон беш … кырк бешинчи» — and the 20/20 attestation in the header is the citation for the forms.
 */
export function kyrgyzOrdinal(n: number): string | undefined {
    const words = numberWords(n);
    if (words === undefined || words === "") return undefined;
    const parts = words.split(" ");
    const last = parts[parts.length - 1]!;
    const { hi } = harmonyOf(last);
    parts[parts.length - 1] = endsInVowel(last) ? `${last}нч${hi}` : `${last}${hi}нч${hi}`;
    return parts.join(" ");
}

// ---------------------------------------------------------------------------------------------------
// INITIALISMS — the seam already exists (playbook trap 16), and this is ky's largest untreated class
// ---------------------------------------------------------------------------------------------------

/**
 * Kyrgyz phonotactics for the OOV half of `core/initialisms.ts`.
 *
 * Kyrgyz, like every Kipchak Turkic language, has NO native initial cluster — a word begins C-V or V. The
 * onsets listed are the RUSSIAN-LOAN inventory the written language has absorbed (план, трактор, станция,
 * класс), and listing them is what stops an ordinary caps-set headword being spelled letter by letter. The
 * coda set is the native one: Kyrgyz ends a word in two consonants routinely (төрт, тарт, тынч, көрк).
 */
export const isUnreadableKyrgyz = makeUnreadableTest({
    vowels: /[аеёиоөуүыэюя]/u,
    legalOnsets: new Set([
        "бл", "бр", "гл", "гр", "др", "кл", "кр", "пл", "пр", "сл", "см", "сп", "ст", "тр",
        "фл", "фр", "хл", "хр", "зв", "св", "тв", "дв", "сн", "шт",
    ]),
    legalCodas: new Set([
        "рт", "рк", "рд", "рм", "рн", "рс", "рп", "рг", "рз", "рш", "рч",
        "нт", "нд", "нч", "нң", "нс", "нк",
        "лт", "лк", "лд", "лп", "лм",
        "ст", "шт", "фт", "кт", "пт", "йт", "йл", "йн", "йм", "йк",
    ]),
});

const LETTER_NAME = MANIFEST.letterNames;
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(MANIFEST.acronymLetters);

/**
 * Spell an unreadable all-caps run with Kyrgyz letter names. `СССР` → *эс эс эс эр*, `КМШ` → *ка эм ша*,
 * `АКШ` → *а ка ша*, `УДК` → *у де ка*. Before this each reached the g2p as a vowel-less or illegal cluster
 * ([ssːr], [qmʃ], [ɑqʃ]), which is exactly what that seam exists to prevent — and `initialism` is the
 * corpus's third-largest cell at 39,075 occurrences.
 *
 * `isRecorded` is `false`: this tree has no Kyrgyz pronunciation dictionary, so the decision rests on the
 * empty lexical list plus the OOV test alone — the same position Tajik and Russian are in. ГЭС ×3 and БУУ ×4
 * are correctly left as words by that test.
 */
export function normalizeKyrgyzInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        isRecorded: () => false,
        isUnreadable: isUnreadableKyrgyz,
    })(text);
}

// ---------------------------------------------------------------------------------------------------
// UNITS — one table, read by BOTH the shared tier and the local suffixed-unit rule
// ---------------------------------------------------------------------------------------------------

/**
 * Unit abbreviation → its Kyrgyz word. Cyrillic keys are what the corpus writes (км ×55, м ×13, мм ×10,
 * га ×5 after a number); the Latin keys are declared beside them because the same corpus writes `cm ×5`,
 * `mg ×4` and `4км` and an undeclared Latin run reaches the ENGLISH foreign fallback ([ˈʊkm], trap 38).
 *
 * SOURCED: espeak-ng `ky_list` names four of them in its own abbreviation block (км kiL,ometr, см sant,imetr,
 * кг kil,ogram, мм mil,imetr, мл mil,litr), and ky.wikipedia corroborates each in the slot — километр ×23/20,
 * гектар ×39/16 («19675,1 миң гектар»), метр ×13 in the mined corpus, литр, градус ×43/19.
 *
 * ⚠ THE SQUARED AND CUBED KEYS ARE DECLARED EXPLICITLY, in both the superscript and the ASCII encoding. The
 * corpus writes `1090 км²`, `0.8 км²`, `650 км³` AND `мкг/м3`, `1 л = 1дм3`, and an undeclared `м3` leaves
 * the `3` to be read as a SEPARATE NUMBER — the `mm2` defect trap 37 found in fr/id/ne.
 * ⚠ `г` AND `т` WERE DECLARED, MEASURED, AND WITHDRAWN — trap 46, found by reading the corpus diff rather
 * than by a probe. Digit-adjacent `г` is three instances: `40 г.` (a mouse's weight, a real gram), `3,037
 * г/см3` (a rate the tier declines whole for want of `unitPer`, so the key bought nothing there) and
 * **`1945 г.`** — the RUSSIAN year abbreviation, which read as *бир миң тогуз жүз кырк беш ГРАММ*. One real
 * reading against one confidently-wrong quantity, and a silent unit beats a year read as a mass. `т` is
 * digit-adjacent ×0 and has the same exposure from the other side: this corpus's `т. ж.`, `т. п-нан` and
 * `2-том` are all live dotted abbreviations. Both keys are OUT. `л` and `м` stay — `м` is ×13 as a genuine
 * metre and neither has a dotted homograph after a digit anywhere in the corpus.
 * ⚠ NO BARE ONE-LETTER LATIN KEY (`m`, `g`), deliberately — trap 46. `802.11n`-shaped version strings are 46
 * occurrences in this corpus and a one-letter Latin key is exactly what turns one into a measurement. The
 * Cyrillic `м` is safe from that because a version's trailing letter is never Cyrillic.
 */
const UNIT_WORD: Readonly<Record<string, string>> = {
    "км²": "чарчы километр", "м²": "чарчы метр", "см²": "чарчы сантиметр", "мм²": "чарчы миллиметр",
    "км2": "чарчы километр", "м2": "чарчы метр", "см2": "чарчы сантиметр",
    "км³": "куб километр", "м³": "куб метр", "см³": "куб сантиметр", "дм³": "куб дециметр",
    "км3": "куб километр", "м3": "куб метр", "см3": "куб сантиметр", "дм3": "куб дециметр",
    "км": "километр", "мм": "миллиметр", "см": "сантиметр", "дм": "дециметр", "м": "метр",
    "кг": "килограмм", "мг": "миллиграмм", "мкг": "микрограмм",
    "га": "гектар", "мл": "миллилитр", "л": "литр",
    "km²": "чарчы километр", "km2": "чарчы километр", "km": "километр",
    "cm": "сантиметр", "mm": "миллиметр", "kg": "килограмм", "mg": "миллиграмм", "ha": "гектар",
};

/**
 * THE SHARED SYMBOL TIER — %, currency, units, exponents, ampersand, multiplication.
 *
 * ⚠ DECLARED HERE AND CALLED FROM INSIDE `normalizeKyrgyz`, because the ordering is not free (trap 39). The
 * tier matches a number ADJACENT to its sign, and three steps below destroy that adjacency: the decimal comma
 * becomes words, the percent rule spends its own sign, and the ordinal rule turns digits into text. So the
 * tier sits at step 11 — after everything that must see the raw text, before everything that rewrites it.
 *
 * ⚠ `пайыз`, NOT `процент`, AND ESPEAK CARRIES THE LOSER. `ky_list` declares `% pratsent`; ky.wikipedia's own
 * пайыз article defines the SIGN — «Пайыз 1) сандын жүздөн бир үлүшү, «%» белгиси менен белгиленет» — and
 * writes it postposed in running text («82 пайыз», «7,22 пайыз», «Жердин 71 пайызга жакынын»). Every one of
 * процент's ×14 hits is the BANKING sense, interest: «Банк ссудасы … Ал процент менен төлөнөт», «процент
 * түрүндө алынуучу комиссиялык төлөмакы», and the noun sits in a list beside рента and пенсия. пайыз is also
 * the only one of the two the mined corpus contains (×3, one of them digit-adjacent: «5 пайыздык квота»).
 * That is trap 37's shape — an attested word, a healthy count, and the wrong register.
 *
 * ⚠ CURRENCY: `$` and `€` are the only signs in the corpus (×19 and ×4), so they are the only ones declared —
 * the tier only spends a currency word when its sign is present. `сом` ×9 is the national currency and is
 * well attested («8591,6 млн сомду», «23 000 сомдон 28 000 сомго чейин») but has NO sign anywhere, so it is
 * not declared, exactly as tg withheld сомонӣ.
 *
 * ⚠ THE MEASURE WORDS ARE PREPOSED, and ky.wikipedia names both abbreviations itself: «Көлөм чендери куб
 * метр (м3)» for the cube, and `чарчы километр` ×13/13 in the slot («361 миллион чарчы километр», «Жалпы
 * аянты 1 729 742 чарчы километр»). `position: "before"` — a spaced modifier, NOT `compound`, which would
 * fuse it into one unreadable token.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["пайыз"],
    currency: { "$": ["доллар"], "€": ["евро"] },
    units: Object.fromEntries(Object.entries(UNIT_WORD).map(([k, w]) => [k, [w]])),
    // ⚠ NO `unitPer`, AND THE RATE IS REFUSED WHOLE (trap 47 reason 1, trap 53's "refuse the whole match").
    // `unitPer` is ONE INVARIANT STRING and Kyrgyz's per-relation is not a word — it is a DATIVE on the
    // denominator, which the corpus writes out itself: «1000ге 6,6» (6.6 per 1000), «1 км² жерге 22,3».
    // Declaring "саатына" would have made it say PER HOUR, and the corpus's rates are all mass-per-volume:
    // мкг/м3 ×6, мкг/дм3 ×2, мг/л, мг/кг, г/см3, бирдик/л, and not one км/ч in 456 segments. With the field
    // absent the tier declines the whole match, so both units stay as they were rather than one of them
    // becoming a confidently wrong "per hour" — measured: `100 мкг/м3дан` read *жүз микрограмм САATЫНА метр
    // үч дан* with the field set.
    magnitudes: ["миллиард", "миллион", "триллион", "миң"],
    // `жана` is the Kyrgyz conjunction, ×140 in the mined corpus. Spaced on both sides, always: `B&B` is two
    // initialisms and joining them would make one token (the merge defect of trap 18/26).
    ampersand: "жана",
});

// ---------------------------------------------------------------------------------------------------
// THE RULES
// ---------------------------------------------------------------------------------------------------

/** A Cyrillic letter, spelled out rather than left to `\p{L}` — the guards must not admit Latin. */
const CYR = "\\p{Script=Cyrillic}";
/** "not inside a word": `\p{M}` beside `\p{L}`, per trap 23. */
const NOT_WORD = `(?![\\p{L}\\p{M}])`;
const NOT_WORD_BEFORE = `(?<![\\p{L}\\p{M}])`;

/** Normalize one Kyrgyz input string. Pure text→text. */
export function normalizeKyrgyz(input: string): string {
    let s = input;

    // 0) INVISIBLE CHARACTERS, FIRST, because every later rule matches literals. U+00AD (×2) and the
    //    zero-width block (×14 in 456 segments; the artifact's `zero-width` cell is 143 corpus-wide) are not
    //    in the engine's `[Ѐ-ӿ]` token class, so they TERMINATE A WORD and split it into two stressed halves.
    //    The `&nbsp;` entity goes with them: the artifact carries it as literal text, and the ampersand arm
    //    of the tier would otherwise read it as *жана nbsp*.
    s = s.replace(/[­​-‏﻿]/gu, "").replace(/&nbsp;?/gu, " ");

    // 1) SPACE-GROUPED THOUSANDS — `67 848 156`, `199 951 км²`, `1 729 742`, `23 000 сомдон`. The Russian
    //    convention and the one Kyrgyz uses; 34 occurrences in the hard tier and 7 in the sample. The
    //    engine's `\d+` splits on the space, so `1 000 000` read *bir nøl nøl* — "one zero zero".
    //    FIRST after the invisible fold, because a surviving grouping space is later seen as two operands.
    for (let i = 0; i < 4; i++) s = s.replace(/(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?![\d]))/gu, "");  // space, NBSP, NNBSP, thin space

    // 2) THE COMMA AS A THOUSANDS SEPARATOR, but ONLY when it groups more than once — `2,774,460`,
    //    `5,294,000`, `17,840,000`. Multi-group is unambiguous; a SINGLE `\d,\d{3}` is not, and is refused at
    //    the foot of this file with its 50/50 count. Above the decimal rule, which owns the same character.
    s = s.replace(/(?<![\d.,])([1-9]\d{0,2})(?:,\d{3}){2,}(?![\d.,])/gu, (m0) => m0.replace(/,/gu, ""));

    // 3) MULTI-DOT ABBREVIATIONS, before any single-dot handling, or the interior dot survives as a phrase
    //    break. All three are corroborated by the same corpus spelling the phrase out beside them:
    //      `б.з.ч.` / `б.э.ч.` (×5 incl. spaced `Б. э. ч.`) — «биздин заманга чейинки VIII-VII кылым» ×2
    //      `ж.б.`   (×13)                                   — «жана башка» ×8 in the same 456 segments
    //      `б.а.`   (×2)                                    — «башкача айтканда» ×40/20 on ky.wikipedia
    //    The era marker is claimed BEFORE the ordinal rule so `б.з.ч. 4-к.` is not read as a dotted date.
    //    ⚠ CASE-INSENSITIVE, AND THE FINAL DOT IS OPTIONAL — trap 7, caught by the corpus diff. Written
    //    `[Бб]\.\s?[зэ]\.\s?ч\.` the rule missed `Б.З.Ч 276–194` (the Eratosthenes dates): the interior
    //    letters are CAPITALS there and there is no closing dot, so it fell through to the initialism pass
    //    and read *бе зе че*. The lowercase-only class was narrower than the orthography, again.
    s = s.replace(/(?<![\p{L}\p{M}])б\.\s?[зэ]\.\s?ч\.?(?![\p{L}\p{M}])/giu, "биздин заманга чейин")
        .replace(/(?<![\p{L}\p{M}])ж\.\s?б\./gu, "жана башка")
        .replace(/(?<![\p{L}\p{M}])б\.\s?а\./gu, "башкача айтканда");

    // 4) MAGNITUDE ABBREVIATIONS after a number — `1,5 млн`, `$3,745 трлн`, `161.9 млн доллар`, `19,2 млрд`.
    //    млн ×20, млрд ×4, трлн ×1 in 456 segments. Every one is a vowel-less Cyrillic run, so it reached the
    //    g2p as the cluster [mln] / [mlrd] — audible garbage that no leak class can see (trap 56). The full
    //    words are what the same corpus writes: миллион ×9, миллиард, and «19,2 миллиард АКШ долларга» on the
    //    wiki. Claimed only AFTER a digit, which is where all 25 occurrences sit.
    s = s.replace(/(?<=\d\s?)млрд\.?(?![\p{L}\p{M}])/gu, "миллиард")
        .replace(/(?<=\d\s?)трлн\.?(?![\p{L}\p{M}])/gu, "триллион")
        .replace(/(?<=\d\s?)млн\.?(?![\p{L}\p{M}])/gu, "миллион");

    // 5) THE HYPHENATED HEAD-NOUN ABBREVIATIONS, expanded so step 6 can ordinalise them like any other head.
    //    `1991-ж.` ×24, `1928–1933-жж.` ×3, `20-к.` ×12, `83-б.` ×2 in 456 segments — and each is a single
    //    Cyrillic consonant, so `1991-ж.` read as a bare [d͡ʒ] followed by a sentence break.
    //    THE EXPANSIONS ARE THE CORPUS'S OWN, written out beside the abbreviation in the same text:
    //      ж.  → жылы    `2001-ж. а. ч-нын…` is "in 2001"; жылы ×78 against жыл ×13 and жылдын ×49
    //      жж. → жылдары `1928 – 1933-жж.`  is "in the years…";  жылдары ×3
    //      к.  → кылым   `19-к.` ×2 beside `19-кылымда` ×2 — the SAME construction, both spellings present
    //      б.  → бет     `83-б.` beside `83-бет`, both in the same bibliography line
    //    ⚠ `ж.` IS AMBIGUOUS BETWEEN жыл / жылы / жылдын AND THE CHOICE IS PRICED: жылы is the adverbial
    //    "in the year N" that the abbreviation almost always abbreviates and outnumbers the bare noun 6:1.
    //    The residual cost is the genitive contexts (`1991-ж. жарлыгы менен`), which want жылдын.
    s = s.replace(/(?<=\d)-жж\.?(?![\p{L}\p{M}])/gu, "-жылдары")
        .replace(/(?<=\d)-ж\.?(?![\p{L}\p{M}])/gu, "-жылы")
        .replace(/(?<=\d)-к\.?(?![\p{L}\p{M}])/gu, "-кылым")
        .replace(/(?<=\d)-б\.?(?![\p{L}\p{M}])/gu, "-бет");

    // 6) THE ORDINAL HYPHEN — the language's defining rule, 354 occurrences and 101 of 200 sample segments.
    //    `1991-жылы` → *бир миң тогуз жүз токсон биринчи жылы*, `19-кылымда` → *он тогузунчу кылымда*,
    //    `9-май` → *тогузунчу май*. The head noun is RE-EMITTED verbatim (trap 10), so its own case suffix —
    //    жылдын, январына, кылымдагы, августта — is never lost.
    //
    //    ⚠ THE DISCRIMINATOR IS `suffixKind`, AND IT IS WHAT SEPARATES THIS RULE FROM STEP 7. A hyphen after
    //    digits marks an ordinal when a NOUN follows (`19-кылым`) and a plain case when a bare SUFFIX follows
    //    (`150-дөн` is *жүз элүүдөн*, an ablative on the cardinal, not "one hundred fiftieth"). Testing the
    //    tail against the suffix table is the only thing that tells them apart, and it is exact-match: a noun
    //    that merely BEGINS with those letters (декабрь, дай…) is not a suffix.
    //
    //    ⚠ CASE-INSENSITIVE ON THE HEAD (trap 7). `9-Май`, `8-Март`, `16-Февралда`, `1-Бүткүлдүйнөлүк` are
    //    ordinary in this corpus — the capitalised head is the holiday/title form, and a lowercase-only class
    //    would drop exactly those into the cardinal reading the rule exists to fix.
    //
    //    ⚠ A PAIR OF NUMBERS BOTH TAKE THE ORDINAL, claimed first because the general form would otherwise
    //    read the left operand as a bare cardinal: `10-12-кылымдагы`, `1919-1921-жылдардагы`,
    //    `1880-90-жылдардан` — 6 occurrences. Kyrgyz marks both ends of an ordinal span.
    const ordinalHead = new RegExp(`(?<![\\d.,])(\\d{1,12})-(\\d{1,12})-(${CYR}+)`, "giu");
    s = s.replace(ordinalHead, (m0, a: string, b: string, head: string) => {
        if (suffixKind(head.toLowerCase()) !== undefined) return m0;
        const oa = kyrgyzOrdinal(Number(a)), ob = kyrgyzOrdinal(Number(b));
        return oa === undefined || ob === undefined ? m0 : `${oa} ${ob} ${head}`;
    });
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d{1,12})-(${CYR}+)`, "giu"), (m0, d: string, head: string) => {
        if (suffixKind(head.toLowerCase()) !== undefined) return m0;
        const ord = kyrgyzOrdinal(Number(d));
        return ord === undefined ? m0 : `${ord} ${head}`;
    });
    //    ⚠ THE SPACED CENTURY IS THE ROMAN PASS'S OUTPUT, NOT A KYRGYZ SPELLING, and that is exactly why it is
    //    safe to claim. `registry.ts` rewrites Roman numerals to DIGITS before `text()` for every language
    //    outside `ROMAN_NATIVE` (ky is), so `XIX кылым` reaches this file as `19 кылым` — with a SPACE, which
    //    step 6's hyphen rule cannot see. 28 Roman-numeral centuries in 456 segments (`XVIII кылым`,
    //    `X кылымдын`, `биздин заманга чейинки VIII-VII кылым`), every one of them read as a cardinal.
    //    `grep -c '[0-9]+ кылым'` over the raw corpus is **0**, so this shape has no native source at all and
    //    the rule has no possible false positive from written Kyrgyz.
    //    ⚠ THE SPACED YEAR IS NOT CLAIMED, on the same evidence read the other way — see the foot of the file.
    s = s.replace(/(?<![\d.,])(\d{1,4})\s+(кылым[\p{Script=Cyrillic}]*)/giu, (m0, d: string, head: string) => {
        const ord = kyrgyzOrdinal(Number(d));
        return ord === undefined ? m0 : `${ord} ${head}`;
    });

    // 7) THE CASE SUFFIX BOUND TO A NUMERAL — trap 14 in its measured Kyrgyz form, and trap 15's other half.
    //    GLUED: `150дөн`, `1000ге`, `97ден`, `85тен`, `40тан`, `20дан`, `25ге`, `16дан`, `11де`, `1923гө`,
    //    `530дай` — 23 occurrences. HYPHENATED: `150-дөн` and friends, counted with the same grep because the
    //    morpheme is the same; the hyphen is optional in this orthography and the reading is identical.
    //    Unclaimed the tail was its own token — `150дөн` read *d͡ʒyz elyː døn*, a bare word-initial [d] cluster
    //    where the language has one word.
    //    ⚠ THE SUFFIX IS RE-DERIVED FROM THE SPOKEN LAST WORD, never copied: see `suffix()` for the three
    //    corpus instances where the written form disagrees with the words it will be spoken against.
    //    ⚠ THE DIGIT RUN IS ANCHORED AT BOTH ENDS (trap 52): a lookbehind alone does not reject a string, it
    //    only moves where the engine starts, so `802.11ге` would match `11ге` without the leading guard.
    s = s.replace(new RegExp(`(?<![\\d.,\\p{L}\\p{M}])(\\d{1,12})-?(${SUFFIX_RE})${NOT_WORD}`, "gu"),
        (m0, d: string, tail: string) => {
            const kind = suffixKind(tail);
            const w = numberWords(Number(d));
            return kind === undefined || w === undefined ? m0 : glue(w, kind);
        });

    // 8) PERCENT, WITH ITS BOUND SUFFIX — `63,8%`, `92 %`, `80,0%ке`, `40%ына`, `25,0%ин`, `90%и`, `8,8%ын`,
    //    `7,7%ды`, `%тен`. 80 occurrences in 456 segments and 24 of them (30%) carry a suffix.
    //    ⚠ THIS ARM MUST RUN BEFORE THE TIER (step 11). The tier emits `пайыз` and cannot see past the
    //    trailing letters, so `80,0%ке` would leave `ке` stranded as its own token — the Azerbaijani `faizni`
    //    defect exactly. Reading the sign here and deriving the suffix on the emitted noun is trap 14's fix
    //    shape applied to a word this rule knows statically (пайыз: back-unrounded harmony, voiced coda з, so
    //    the dative is *пайызга* and never the written *пайызке*).
    s = s.replace(new RegExp(`(\\d)\\s?%\\s?-?(${SUFFIX_RE})${NOT_WORD}`, "gu"),
        (m0, d: string, tail: string) => {
            const kind = suffixKind(tail);
            return kind === undefined ? m0 : `${d} пайыз${suffix("пайыз", kind)}`;
        });

    // 8b) THE MINUS, AND THE REFUSAL BROKE ON A NARROWER RULE (playbook trap 24 — including your own
    //     refusal). This layer's first pass declined the sign because every dash-before-a-digit in the corpus
    //     looked like a range: 285 of them, `2750-3800 метр`, `25-35 см`, `20-23 күндү`, `6-16 °C`.
    //     Re-measured with a guard instead of a feeling, the two populations separate CLEANLY:
    //
    //         a dash NOT preceded by a digit, °, a prime or a letter, whose number is followed by a DEGREE
    //           → 14 hits, and a second arm for the first endpoint of an ellipsis span (`-5...-8 °C`) → 4
    //           → 18 hits, 0 FALSE POSITIVES over all 456 segments
    //
    //     Every one is a genuine negative temperature: `-38°С`, `−10 °Cга`, `-18°Сден`, `-3°Сге`, `-50°Сге`,
    //     `-1°Сден`, `—5°Сден`, `—40°С`, `-23...-29 °C`, `-52...-54 °C`. Every range is rejected by the
    //     digit-before test (`6-16 °C`, `26—31°С`, `28-30°Сге`, `20-26°С`) and every coordinate by the prime
    //     test (`39°11′–43°16′`). This is exactly hi's discriminator — the RIGHT context settles it when the
    //     left one cannot — and it is worth the effort because omitting a plus is lossless while omitting a
    //     minus INVERTS: `-38°С` was reading as *отуз сегиз градус*, thirty-eight degrees ABOVE zero.
    //     ⚠ THE WORD IS SIGN-NAMING, NOT REGISTER-GUESSED. ky.wikipedia's минус article defines it —
    //     «Минус (латынча minus – кем) – кемитүү амалын, ошондой эле терс санды…» — and names the whole set
    //     in one line: «белгилер [+ (плюс), — (минус), . (чекит)]». espeak's `ky_list` does NOT carry a minus
    //     word at all (its `_-` is `сызыкча`, the HYPHEN), so the wiki is the only source and it is a good one.
    //     ⚠ ABOVE STEP 9, WHICH SPENDS THE DEGREE MARK. Both arms look ahead for `°`; once the degree rule has
    //     rewritten it to `градус` there is nothing left to look at (trap 39 — a guard's evidence has a
    //     lifetime). ⚠ The em dash is in the alternation because this corpus writes the minus as one twice
    //     (`—5°Сден`, `—40°С`) — same character it uses for apposition, told apart by the same guard.
    const NO_SIGN_LEFT = `(?<![\\d°′'\u2032\\p{L}\\p{M}])`;
    s = s.replace(new RegExp(`${NO_SIGN_LEFT}[-−–—]\\s?(\\d+(?:,\\d+)?)(?=\\s?[.…]{2,3}\\s?[-−–—]\\s?\\d+\\s?°)`, "gui"), "минус $1");
    s = s.replace(new RegExp(`${NO_SIGN_LEFT}[-−–—]\\s?(\\d+(?:,\\d+)?)(?=\\s?°)`, "gui"), "минус $1");

    // 9) DEGREES. `+4 °Cдан`, `−10 °Cга`, `-18°Сден`, `26°Сге`, `20-26°С`, `39°11′–43°16′`, `990оС`.
    //    44 degree signs in 456 segments, and 21 of them carry a bound case suffix — nearly half.
    //    ⚠ BOTH ENCODINGS OF THE SCALE LETTER (trap 11 in Cyrillic): the corpus writes `°С` with CYRILLIC С
    //    (U+0421) ×21 and `°C` with Latin C ×15. They render identically and took different paths — the
    //    Cyrillic one read as a bare [s], the Latin one as the ENGLISH letter name *sˈiː*.
    //    ⚠ THE WORD IS THE BARE `градус`, NOT the scale name, and that is the corpus's own choice: it writes
    //    «абанын жылдык орточо температурасы + 13,4 градус жылуу (июлда + 26,7 градус, январда - 2,7 градус)»
    //    — the spelled twin of exactly this notation — and «-3,5 градус», «11 градуска чейин» in the mined
    //    text. ky.wikipedia's градус article defines the sign («Градус (°) белгиси менен белгиленет») and
    //    names the formal unit «Цельсий градусу (°С)» in the Celsius article; the formal name is the right
    //    citation for what the unit is CALLED and the wrong register for what a reader says (trap 37's
    //    deeper form). The scale letter is therefore CONSUMED and not spoken — a redundancy the corpus's own
    //    prose also drops (trap 12).
    const suffixArm = `(?:-?(${SUFFIX_RE}))?${NOT_WORD}`;
    // ⚠ THE LOWERCASE SCALE LETTERS GO IN THE CLASS, NOT IN AN `i` FLAG. `suffixArm` embeds SUFFIX_RE,
    //    which is lowercase Cyrillic only; under `i` it captures an UPPERCASE suffix, `suffixKind` then
    //    fails to recognise it and the `?? CASE.loc` fallback substitutes the wrong case in silence —
    //    `30 °C-ДАН` (ablative) read as the locative *градуста*.
    s = s.replace(new RegExp(`(\\d)\\s?°\\s?[CСFcсf]${suffixArm}`, "gu"), (_m, d: string, tail: string | undefined) =>
        `${d} градус${tail === undefined ? "" : suffix("градус", suffixKind(tail) ?? CASE.loc)}`);
    //    A COORDINATE's arc-minute and arc-second, whose words come from the same градус article defining
    //    them: «1°=60'=3600", мында 1'— минут … 1" — секунда». Without this `39°11′` lost the degree and left
    //    the prime mark to be dropped. Claimed BEFORE the bare-degree arm, which would eat the `°` alone.
    //     ⚠ THE TRAILING `\s?` LIVES INSIDE THE OPTIONAL ARC-SECOND GROUP, NOT OUTSIDE IT. Written outside,
    //     the rule ATE THE SPACE after the prime whenever no arc-second followed, and `43°16′ жана` came out
    //     as *…он алты минутжана* — two words fused into one token. Found by reading the corpus diff, not by
    //     any probe: the reading was otherwise correct and no leak class can see two real words joined.
    s = s.replace(/(\d)\s?°\s?(\d{1,2})\s?[′'](?:\s?(\d{1,2})\s?[″"])?/gu,
        (_m, d: string, mi: string, se: string | undefined) =>
            `${d} градус ${mi} минут${se === undefined ? "" : ` ${se} секунд`}`);
    //    ⚠ CYRILLIC ⟨о⟩ STANDING IN FOR THE DEGREE SIGN — `990оС`, `350оС`, `2607оС`, `1340оС`, `250оС`. Five
    //    occurrences, every one a melting/boiling point in a minerals article, i.e. a typographic
    //    substitution of the same shape as the `º` U+00BA the Hindi run found. Digits + о + С is not a Kyrgyz
    //    word shape, so the claim is unambiguous; unclaimed it read as *…нөл о эс*.
    s = s.replace(/(\d)о\s?[CС](?![\p{L}\p{M}])/gu, "$1 градус");
    //    Bare degree, LAST, so the scale, coordinate and mojibake arms all get first refusal.
    s = s.replace(new RegExp(`(\\d)\\s?°${suffixArm}`, "gu"), (_m, d: string, tail: string | undefined) =>
        `${d} градус${tail === undefined ? "" : suffix("градус", suffixKind(tail) ?? CASE.loc)}`);

    // 10) THE COLON BETWEEN DIGITS IS NEVER A CLAUSE BREAK, AND NO CLOCK READING IS INVENTED. `12:30` read as
    //     *on eki , otuz* — a timestamp delivered as two sentences. 18 occurrences in 456 segments and, as
    //     trap 55 warns about ceb→ilo, THEY ARE MOSTLY NOT CLOCKS: `UTC+5:45`, `UTC-08:00`, `GMT−00:43:08`,
    //     `GMT-0:44`, `UTC+0:19:32` are OFFSETS ×6, `2:52:46`, `5:41:16`, `61:03` are SPORTS TIMES ×5, and
    //     `Mатай 14:33` is a SCRIPTURE reference. ZERO instances in the 200-segment representative sample.
    //     A `саат`-guarded clock rule would fix at most three and the bare-colon rule ceb uses would claim all
    //     eighteen. The defect here is the PAUSE, and every one of those senses reads correctly as
    //     consecutive numbers, so the colon becomes a plain separator and nothing is invented.
    s = s.replace(/(?<=\d):(?=\d)/gu, " ");

    // 11) THE SHARED SYMBOL TIER — the number must still be adjacent to its sign and must still carry its
    //     decimal comma (`26,5 %`, `$3,745 трлн`), so this runs above step 13.
    //     A UNIT WITH A BOUND CASE SUFFIX FIRST, because the tier's trailing guard `(?![\p{L}\p{M}])` rejects
    //     one outright — the ug `180kmئېگىزلىكتە` shape of trap 54. `85тен 116 ммге чейин`, `21ден 26 ммге`,
    //     `170 ммден 400 ммге`, `720 км²ден ашкан` — 9 occurrences, all of them a range endpoint, and all of
    //     them silently dropping the unit before this rule existed.
    const unitKeys = Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"));
    //     ⚠ THE OPERAND MUST ADMIT A DECIMAL, and this was wrong until the corpus diff showed it: written
    //     `(\d+)` the rule declined `чогонун калыңдыгы 2,8 мден 15 мге чейин` — the leading guard rejected the
    //     match at `2`, the engine restarted at `8`, and `(?<![\d.,])` then rejected THAT because a comma
    //     precedes it, so `мден` stayed a bare token while the spaced `15 мге` beside it read correctly.
    //     Trap 52 from the other side: anchor the whole operand instead of one edge of the key.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d[\\d.,]*\\d|\\d)\\s?(${unitKeys.join("|")})(${SUFFIX_RE})${NOT_WORD}`, "gu"),
        (m0, d: string, key: string, tail: string) => {
            const kind = suffixKind(tail);
            const word = UNIT_WORD[key];
            if (kind === undefined || word === undefined) return m0;
            const parts = word.split(" ");
            parts[parts.length - 1] = `${parts[parts.length - 1]}${suffix(parts[parts.length - 1]!, kind)}`;
            return `${d} ${parts.join(" ")}`;
        });
    s = SYMBOLS(s);

    // 11b) EQUALS, AND IT IS POSTPOSED. `1 теңге = 100 тыйынга`, `бир + ынчы = биринчи`, `lg(f2/f1)=1`.
    //     14 occurrences in 456 segments. `барабар` is ×56 over 20 ky.wikipedia articles and every one of them
    //     is this relation, with the SECOND operand in the DATIVE and the word LAST: «атомдогу жалпы
    //     заряддардын суммасы нөлгө барабар», «электрондун зарядына барабар», «Тик бурч 90°ка … барабар»,
    //     «Бир доллар жалпысынан 100 центке барабар». espeak's `ky_list` independently gives `= barab'ar`.
    //     So the rule emits `A B барабар`, not `A барабар B` — the Fula `hakkunde` lesson: a real word in the
    //     wrong syntactic slot is still wrong. Where the text already carries the dative (`100 тыйынга`) the
    //     result is exactly the corpus's own sentence.
    //     ⚠ GUARDED TO A CYRILLIC OR DIGIT OPERAND ON BOTH SIDES, which is what excludes the corpus's
    //     BIBLIOGRAPHIC `=`: «…энциклопедии, 2002. = Стр. 499» has a full stop on the left, and «Модернизация
    //     и ремонт ПК = Upgrading and Repairing» has Latin on the right. Both are title separators, not
    //     statements about quantities, and both are rejected.
    //     ⚠ THE SECOND OPERAND RUNS TO THE CLAUSE EDGE, not to the next space, because the word goes AFTER it:
    //     `= 100 тыйынга` is *жүз тыйынга барабар*, and a single-token capture produced *жүз барабар тыйынга*
    //     — the right word in the wrong place, which is the failure this rule was written to avoid.
    s = s.replace(/([\d\p{Script=Cyrillic}])\s*=\s*([\d\p{Script=Cyrillic}][^=.,;:!?()]{0,40})/gu,
        (_m, a: string, b: string) => `${a} ${b.trimEnd()} барабар`);

    // 11c) THE NUMERO SIGN — `Инв. № 222`, `№1057`, `№ 7`, `№ 222-инвертарынан`. 8 occurrences, every one a
    //     bibliographic or inventory reference, and the sign was dropped outright. `номер` is espeak's own
    //     reading (`№ nom'er`) and is ×30/18 on ky.wikipedia as the ordinary noun («Атомдук номер (катар
    //     номер)», «Инвентардык номер»). ⚠ This is trap 36's stated exception: `№` looks foldable and NFKC
    //     gives the English `No`, which would put an English word into a Kyrgyz g2p — it needs a per-language
    //     WORD, and this is that word.
    s = s.replace(/№\s?(?=\d)/gu, "номер ");

    // 12) FRACTIONS — `3/4` ×2, `2/3` ×2, `1/4` ×2, `9/10`. Kyrgyz builds these exactly as it builds a
    //     decimal: DENOMINATOR IN THE ABLATIVE, then the numerator — *төрттөн үч*, "three from four". The
    //     construction is directly attested rather than composed by analogy: ky.wikipedia's Zakat article
    //     glosses the tithe as «ондон бир үлүш» (a one-tenth share) ×10/10, and its пайыз article defines the
    //     percent as «сандын жүздөн бир үлүшү». No new vocabulary — the ablative comes from `suffix()`.
    //     ⚠ GUARDED TO numerator < denominator ≤ 12, which accepts every real fraction in the corpus and
    //     rejects the three things that share its shape: `7/268` and `013/201` (catalogue numbers), `001/02`
    //     (a reference) and `4.1: 1900-1945` (a volume). `36/10` is also rejected, and is a ratio.
    s = s.replace(/(?<![\p{L}\p{M}\d./,])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d./,])/gu, (m0, a: string, b: string) => {
        const n = Number(a), den = Number(b);
        if (!(n >= 1 && n < den && den <= 12)) return m0;
        const dw = numberWords(den), nw = numberWords(n);
        return dw === undefined || nw === undefined ? m0 : `${glue(dw, CASE.abl)} ${nw}`;
    });

    // 13) THE DECIMAL COMMA — 208 occurrences in 456 segments, the layer's densest defect after the ordinal,
    //     and the comma is in `clausePunctuation`, so `2,5` read *eki , beʃ*: a sentence break inside a
    //     quantity.
    //     ⚠ THE READING IS SOURCED AND IT IS NOT A SEPARATOR WORD. Kyrgyz says «бүтүн» ("whole") and then the
    //     fraction as DENOMINATOR-ABLATIVE + numerator, the same construction as step 12. ky.wikipedia's
    //     article on repeating decimals states the reading directly, as a reading: «Тиешелүү түрдө 2 бүтүн
    //     мезгилинде 71; 1 бүтүн ондон үч мезгилинде 18 деп окулат» — *деп окулат*, "is read as", with
    //     `1 бүтүн ондон үч` glossing 1,3. `ондон` ×21/20 and `жүздөн` ×16/15 are independently attested in
    //     exactly that ablative slot, and «Бүтүн сандар» is the integer article.
    //     ⚠ THE MINED CORPUS'S OWN `бүтүн` ×3 ARE ALL THE PLAIN ADJECTIVE — «бир бүтүн илим», "one whole
    //     science". That is why the wiki probe was run: a count is a lead, never a finding, and corpus silence
    //     about how a SYMBOL is spoken is the weakest evidence there is (the Igbo lesson).
    //     ⚠ ONE AND TWO FRACTIONAL DIGITS ONLY — 177 + 23 of the corpus's 208, i.e. 96%. Three digits is the
    //     ambiguous zone and is refused at the foot of this file.
    //     AFTER the tier, which needs `26,5 %` intact; AFTER degrees, which needs `+13,4 °C` intact.
    s = s.replace(/(?<![\d.,])(\d+),(\d{1,2})(?![\d.,])/gu, (m0, whole: string, frac: string) => {
        const w = numberWords(Number(whole)), f = numberWords(Number(frac));
        const den = numberWords(frac.length === 1 ? 10 : 100);
        return w === undefined || f === undefined || den === undefined ? m0 : `${w} бүтүн ${glue(den, CASE.abl)} ${f}`;
    });

    // 14) THE DOT BETWEEN DIGITS — `198.5 миң км²`, `6.4км`, `$7.5 миллиардга`, `0.8 км²`, `161.9 млн`. 28
    //     occurrences, and unlike the comma they are NOT mostly decimals: `01.04.1776`, `24.09.1981` and
    //     `07.02.2020` are dates, `07.00.07` is a Russian dissertation-speciality code, `12.00дө` and
    //     `10.00до` are clocks and `1979.83-бет` is a sentence period followed by a page number. So the dot
    //     gets the PAUSE removed and no decimal word — the comma is Kyrgyz's own separator at 208 against 28,
    //     and inventing a reading here would be confidently wrong more often than right.
    //     Guarded to a single unspaced dot between digits, so `01.04.1776` is rejected at both ends (trap 52:
    //     the trailing guard is what stops the engine restarting inside it and matching `04.1776`) and a
    //     sentence period is never eaten.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d.,])/gu, "$1 $2");

    // 15) INITIALISMS, LAST, so every abbreviation rule above has already spent its capitals.
    //     ⚠ AN INITIALISM WITH A BOUND CASE SUFFIX FIRST — `СССРдин` ×3, `СССРде` ×2, `АКШнын` ×2, `АКШда`
    //     ×2, `ОСФСРдин` ×2, `КМУнун` ×2, `ЮНЕСКОго`, `ФПИнин`, `КПССтин` — about 25 in 456 segments. The
    //     shared pass's trailing guard is `(?![\p{L}\p{M}])`, so a glued suffix makes it decline the whole
    //     run and the acronym reaches the g2p raw. Spelling the run and gluing the suffix to the LAST LETTER
    //     NAME keeps it one word: `СССРдин` → *эс эс эс эрдин*, where эр is front-unrounded so the genitive
    //     is -дин, which is also what the writer wrote.
    s = s.replace(new RegExp(`${NOT_WORD_BEFORE}(\\p{Lu}{2,})(${SUFFIX_RE})${NOT_WORD}`, "gu"),
        (m0, run: string, tail: string) => {
            const kind = suffixKind(tail);
            const spelled = normalizeKyrgyzInitialisms(run);
            if (kind === undefined || spelled === run) return m0; // left a word by the phonotactic test
            return glue(spelled, kind);
        });
    s = normalizeKyrgyzInitialisms(s);

    return s;
}

/**
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 * DELIBERATELY NOT READ, with the count that makes each a decision rather than an oversight.
 *
 * ⚠ THE RANGE JOINER — 119 hyphen ranges in 456 segments (`2750-3800 метр`, `25-35 см`, `1919-1921`,
 *   `20-26°С`), the largest single refusal here. Kyrgyz HAS the construction and the corpus writes it out:
 *   «6-августан - 18-августка чейин», «23 000 сомдон 28 000 сомго чейин», «85тен 116 ммге чейин», «16дан 19
 *   ммге чейин». It is a POSTPOSITION frame, not an infix — `чейин` demands the ABLATIVE on the first operand
 *   and the DATIVE on the second — which is the Fula `hakkunde` shape (a real word that does not fit the
 *   slot as an infix), and worse: in three of those four attestations THE DATIVE IS ON THE FOLLOWING UNIT,
 *   not on the number (`19 ммге`, not *«он тогузга мм»*). So a correct rule would have to move an affix onto
 *   a noun it has not yet claimed, and every wrong version reads a measurement backwards. PRICED (trap 53):
 *   the refusal is NEUTRAL rather than half-declared — an unclaimed hyphen leaves two consecutive cardinals,
 *   which is merely missing a connective, not a wrong quantity. Compare what a half-rule would produce.
 *
 * ⚠ THE SPACED YEAR — `2012 жылдын`, `2007 жылы`, `1219-1221 жылдары` beside `4 жылда`, `20 жылдык согуш`,
 *   `5 жылдык мөөнөт`, `15 жылдан кем эмес`, `100-120 жыл ичинде`. 21 occurrences and the shape is genuinely
 *   two constructions: a YEAR (ordinal) and a DURATION in years (cardinal). The obvious discriminator —
 *   4 digits is a year, 1–3 is a duration — splits all 21 correctly here and is a coincidence of this sample,
 *   because `1000 жыл` ("a thousand years") is a duration with four digits and `миң жыл мурда` is in this very
 *   corpus spelled out. The hyphen is the Kyrgyz convention and 354 instances take it; a spaced one is a
 *   typo for it about half the time, so the cardinal reading is wrong about half the time either way. Left
 *   alone, which is the reading it already had. Contrast the spaced CENTURY in step 6, where the count of
 *   native instances is ZERO and the only producer is this repo's own Roman pass.
 *
 * ⚠ A SINGLE 3-DIGIT COMMA GROUP — `45,200 км²`, `548,247 (2021)`, `$45,000`, `0,697`, `3,037 г/см3`,
 *   `$3,745 трлн`. 8 occurrences and the evidence is an EXACT 50/50: three are English-style thousands
 *   separators imported with the figure, three are genuine decimals, and two are multi-group and therefore
 *   already claimed by step 2. Both readings change the magnitude in the case they get wrong, so neither
 *   choice dominates, and there is no discriminator in the right context (a unit follows both). Left with
 *   its clause pause, which is the only outcome that is merely wrong about the PAUSE rather than about the
 *   number. Re-check by re-running the count if the artifact is re-mined.
 *
 * ⚠ THE PLUS, AND ONLY THE PLUS — the minus was refused here on the first pass and the refusal BROKE on a
 *   narrower rule, which is step 8b (18 hits, 0 false positives). They do not share an argument and the
 *   playbook is explicit about why: omitting a plus is LOSSLESS while omitting a minus INVERTS. All 20 plus
 *   instances are `+4 °Cдан`, `+22 °C`, `+8...+10 °C` — a temperature where the sign is redundant with the
 *   degree word this layer now emits (trap 12) — or an offset, `UTC+5:45`. espeak's `ky_list` gives
 *   `+ qoS'u:` = кошуу, but that is the NOUN "addition", the same nominal register ky.wikipedia uses for the
 *   operation (`кемитүү амалы`), and trap 37 warns a correctly-sourced word from the wrong register is the
 *   hard one to catch. `×` ×1, `±`/`÷`/`<`/`>` ×0 go the same way; see ACCEPTED_SIGN_SILENCE for each count.
 *
 * ⚠ THE SPACED BOUND SUFFIX (trap 15), AND THE MEASUREMENT IS WHAT FORBIDS IT. Trap 15 says to grep for the
 *   MORPHEME rather than the shape and to count the detached form beside the glued one. Done:
 *
 *       grep -oE '[0-9] (дан|ден|га|ге|да|де|дай|…)([^а-яёңөү]|$)'   →  6 hits
 *       …of which FIVE are `га` and every one is the UNIT HECTARE — `25060 га`, `6000 га`,
 *          `1 476 121,6 га`, `2 780 453 га` — already read correctly by the tier
 *       …leaving exactly ONE genuine detached suffix: `2012 ден бери` ("since 2012")
 *
 *   So the spaced alternation is not merely NARROWER than the glued one (trap 9), it is a trap: admitting
 *   `digits + space + short token` would break five hectares to fix one ablative, and `га` is both a dative
 *   suffix and a unit abbreviation with nothing but the space to tell them apart. Oromo's version of this
 *   went the other way and was right to; Kyrgyz's count says the opposite. One instance, recorded and left.
 *
 * ⚠ THE CLOCK — see step 10. 18 colon-times, 6 UTC offsets, 5 sports times, 1 scripture reference, 0 in the
 *   representative sample, and `саат 12.00дө` / `саат 10.00до` (the dotted form) ×2. A clock reading needs
 *   `саат` plus the hour in a case Kyrgyz spells three ways depending on the noun, on evidence of two
 *   instances. Step 10 removes the false pause and stops there.
 *
 * ⚠ THE RUSSIAN BIBLIOGRAPHIC BLOCK — `А.` ×25, `Б.` ×24, `С.` ×15, `И.` ×14, `К.` ×12, `п.л.`, `т.д.`,
 *   `изд.`, `канд. ист. наук`. The `dotted` cell is 25,536 corpus occurrences and it is the richest
 *   abbreviation evidence ky.wikipedia has; it is also mostly RUSSIAN, concentrated in the citation blocks
 *   that end an article (`М.: ВЛАДОС, 2001`, `Симферополь: Таврия-Плюс, 1999`). A Kyrgyz expansion for any of
 *   them would be a Russian word wearing a Kyrgyz layer, which is tg's finding on the identical cell. Only
 *   the four abbreviations the corpus itself spells out in Kyrgyz (steps 3 and 5) are claimed.
 *
 * ⚠ THE RATE DENOMINATORS BEYOND `саат` — `мкг/м3` ×6, `мкг/дм3` ×2, `мг/л`, `мг/кг`, `г/см3`, `бирдик/л`.
 *   Declared through `rateDenominators` only for the hour; a mass-per-volume rate needs the connective in a
 *   case Kyrgyz does not take from `unitPer`'s single invariant string (trap 47 reason 1), and `1000ге 6,6`
 *   shows the language writing the per-relation as a bare dative instead. `symb/s` ×2 is a Latin telecom
 *   spec, not a Kyrgyz rate.
 *
 * ⚠ THE FOUR RESIDUAL `DROP` LINES THE ARTIFACT SCAN STILL REPORTS, each read rather than assumed:
 *     · `minus ×9` — the RANGE dashes, i.e. the refusal above, and the one that is a real gap. Left RED
 *       deliberately rather than entered per-instance: silencing it would hide the range decision.
 *     · `degree ×1` — `11 Na²⁴→ 1 e°+ 12 Mg²⁴`, a nuclear-reaction formula where `e°` is a positron, not a
 *       temperature. The bare-degree arm requires a DIGIT before the sign and correctly declines a letter.
 *     · `percent ×1` — `басылмалардын үлүшү (%)`, a bare sign in parentheses as a column header. The tier
 *       matches only a digit-adjacent sign, which is right: a `%` in prose is being NAMED, not read.
 *     · `exponent ×1` — `(2 млн 724,9 мин км²)`, where `мин` is a TYPO for `миң` (thousand). The magnitude
 *       hop needs a declared magnitude between the number and the unit, so the `км²` loses its adjacency and
 *       the exponent goes with it. A real lost reading, caused by a corpus typo; the fix would be putting a
 *       misspelling into the magnitude list, which is worse.
 *
 * ⚠ `%` WITHOUT A NUMBER — `(%тин ондон бир үлүшүндө)` on the wiki, `%` as a wildcard in a query string. The
 *   tier only matches a digit-adjacent sign, which is correct: a bare `%` in prose is being NAMED, and the
 *   sentence that names it already contains the word.
 * ───────────────────────────────────────────────────────────────────────────────────────────────────
 */
