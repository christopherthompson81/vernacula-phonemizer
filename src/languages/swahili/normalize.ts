/**
 * Swahili / Kiswahili (sw) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * FIRST BANTU LANGUAGE in this fan-out, and the thing that was expected to be hard — NOUN-CLASS
 * AGREEMENT on the numeral (watu wawili / vitabu viwili / miaka miwili) — turned out, when measured, not
 * to arise. Counting every `<word> <digit>` pair in the sw_ke corpus: 495 pairs, of which only 40 use a
 * numeral that agrees at all (1, 2, 3, 4, 5, 8 — every other Swahili numeral is invariant). Of those 40,
 * every counted noun is a class 9/10 N-class loanword (saa, dakika, asilimia, maili, milimita, dola,
 * peni, aunsi, nambari, mara, aina, abiria, milioni), a month/date word, or a preposition — and the
 * N-class agreeing form IS the citation form the engine's `numberToText` already emits (moja, mbili,
 * tatu, nne, tano, nane). Widening the search to the ma-/wa-/mi-/vi- class nouns that do occur with
 * digits (miaka ×17, watu ×6, magari, miezi, vituo, wanafunzi) finds every one of them paired with an
 * INVARIANT numeral (6, 9, 10, 13, 15, 16, 20, 21, …) except a single instance:
 *
 *     "hotuba yake ya masaa 2"   — class 6, wants *mawili*, engine says *mbili*.   ×1 / 1938
 *
 * One instance. Getting it right in general needs a noun→class lexicon for the whole language, which is
 * exactly the "do not bulk-invent language data" prohibition, and the shared `CountForms`/`countForm(n)`
 * seam could not express it anyway — it keys on the NUMBER, and a Bantu class keys on the NOUN. So no
 * agreement rule is written here, deliberately, and the one miss is recorded instead of guessed at.
 *
 * THE OTHER THING THE CORPUS SETTLED: Swahili writes its measure nouns as WORDS, BEFORE the numeral —
 * "kilomita 70 kwa saa", "mita 200", "futi 500", "milimita 35", "asilimia 31", "dola 30". There is not
 * one abbreviated unit symbol (km, kg, m, mm) in 1,938 utterances, so the shared `units` tier has nothing
 * to match and is not declared. `percentPrefix` in the shared tier is exactly the Swahili order, so
 * percent DOES use it (see swahili.ts).
 *
 * THE CLOCK, left alone on purpose. Swahili runs a six-hour offset (saa moja = 7 o'clock), and the corpus
 * writes that form spelled out — "saa 7 dakika 19 asubuhi", "Saa 11 dakika 20", "saa 4 na dakika 8 usiku"
 * — where the engine already reads it correctly. Exactly ONE colon-clock in digits occurs, "masaa ya 9:30
 * asubuhi", and it is European-style: nothing in the corpus says whether the reader converted it, and
 * three of the four other colon-numerals are sports times (4:41.30, 2:11.60, 1:09.02) that any clock rule
 * would have to dodge. One instance is not enough to build a six-hour clock on, so none is built.
 *
 * Measured over the sw_ke corpus (1,938 unique cased utterances, column 3): comma-grouped thousands ×44,
 * decimals ×28, numeric ranges ×18 (13 ascending spans + 4 sports scores + 1 season), spaced dashes as
 * clause breaks ×22, all-caps initialisms ×120 tokens, accented Latin letters ×14, percent ×2, era
 * markers ×6 (BCE ×4, BC ×1, A.D. ×1), n.k. ×2, degrees ×1, currency signs ×0.
 */
import { MANIFEST as DEF } from "./manifest.ts";

/** Ascending pairs are SPANS, non-ascending ones are scores or seasons. Measured, not assumed: of the 18
 *  `N-N` shapes in the corpus, all 13 ascending ones are genuine spans (1469-1539, 1000-1300, 10-15,
 *  120-160, 35-40, 56-64, 100-200, 2-3, 2-5, 10-11, 1644-1912, 1894-1895, 1418 – 1450), and the 5 that
 *  are not ascending are ice-hockey/tennis scores (5-3, 7-2, 6-6, "26 - 00") plus the season "1995-96".
 *  A score reads "tano kwa tatu" rather than "tano hadi tatu", so claiming them would be confidently
 *  wrong; they are left as the bare juxtaposition the engine already produced. */
const RANGE = /(?<![\d.,\p{L}])(\d+)\s?[-–]\s?(\d+)(?![\d.,\p{L}])/gu;

/**
 * Expand an abbreviation whose OWN trailing dot is ambiguous with the sentence period.
 *
 * This shape is not optional, and the corpus diff proved it: a first version matched `A\.D\.` and
 * `B\.?C\.?E\.?` in one go, which swallowed the sentence period of "…hadi karibu 1100 A.D." and
 * "…mwaka wa 10,000 BCE." and silently DELETED three sentence-final pauses. So the dot is consumed only
 * when the sentence visibly continues, and kept when what follows is the end of the input or a capital
 * letter starting the next sentence. `body` is the abbreviation WITHOUT its final dot.
 */
function expandDotted(s: string, body: string, word: string): string {
    const atEnd = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.(?=[ \u00a0]*(?:$|\\p{Lu}))`, "gu");  // space, NBSP
    const inline = new RegExp(`(?<![\\p{L}\\p{M}])${body}\\.`, "gu");
    return s.replace(atEnd, `${word}.`).replace(inline, word);
}

/** Era markers. `Baada ya Kristo` is attested in the corpus itself ("1000-1300 Baada ya Kristo"); its
 *  counterpart `Kabla ya Kristo` is the standard Swahili for BC/BCE. The DOTTED spellings are expanded
 *  first (⚠ a multi-dot abbreviation must be consumed before anything reads its interior
 *  dot as a phrase break), and bare `BC` is required to follow a NUMBER — unlike `BCE`, two bare capitals
 *  are otherwise a perfectly ordinary initialism, and the corpus's one instance is "Takribani 1000 BC". */
const BCE_WORD = DEF.eraWords.bce;
const AD_WORD = DEF.eraWords.ad;
const BARE_ERA: readonly (readonly [RegExp, string])[] = [
    [/(?<![\p{L}\p{M}])BCE(?![\p{L}\p{M}])/gu, BCE_WORD],
    [/(?<=\d[ \u00a0])BC(?![\p{L}\p{M}])/gu, BCE_WORD],  // space, NBSP
];

/** Dotted abbreviations, as `[body-without-final-dot, words]`. Only one shape occurs: `n.k.` ×2 =
 *  *na kadhalika* ("and so on"). `St.` ×3 is deliberately NOT listed — all three are English place names
 *  (St. Louis / St. Petersburg / St. Heliers) and Swahili has no settled reading for them, so inventing
 *  one would be worse than leaving the raw letters. */
const DOTTED: readonly (readonly [string, string])[] = [
    ["B\\.C\\.E", BCE_WORD], ["A\\.D", AD_WORD], ["B\\.C", BCE_WORD], ["n\\.k", "na kadhalika"],
];

/* Currency moved to the SHARED tier (currencyPrefix in swahili.ts) — see the note there. */

/** Fold Latin diacritics to their base letter. Swahili's orthography has none, so `á ü õ ç` are always
 *  foreign spellings — and without this they are not matched by the engine's ASCII tokenizer, fall into
 *  the clause assembler's foreign-run handler, and are read as ENGLISH LETTER NAMES inside a Swahili
 *  word: `Sámi` → [s ˈə mi], `Gürses` → the letter U [juː], `São` → [s ˈə ˈɔ]. Restricted to Latin so an
 *  embedded non-Latin run is untouched. */
function foldLatinDiacritics(s: string): string {
    if (!/[^\p{ASCII}]/u.test(s)) return s;
    return s.replace(/\p{Script=Latin}/gu, (ch) => {
        const base = ch.normalize("NFD").replace(/\p{Mn}+/gu, "");
        return base === "" ? ch : base;
    });
}

/** Every rule here emits DIGITS wherever a number is involved and lets the engine's own number path speak
 *  them, so this layer carries no number words of its own. */
export function normalizeSwahili(input: string): string {
    let s = input;

    // 1) DIACRITIC FOLDING, first — it changes which characters the tokenizer can see at all, so every
    //    later rule (and the tokenizer itself) should be looking at the folded text.
    s = foldLatinDiacritics(s);

    // 2) U+00BA MASCULINE ORDINAL → U+00B0 DEGREE. The corpus's one temperature is written `+30ºC` with
    //    the ordinal indicator, which is neither punctuation nor a letter, so it survived TOKEN untouched
    //    and was EMITTED RAW into the phoneme stream ("thelathini º k"). Must precede step 5.
    s = s.replace(/º/gu, "°");

    // 3) THOUSANDS DE-GROUPING, before anything else numeric: ⚠ the grouping
    //    comma is otherwise read as clause punctuation and the tail as a separate number — `1,000` came
    //    out *moja , sifuri* and `755,688` as two numbers with a pause between them. ×44.
    //    Exactly three digits per block, so a decimal comma (none occur here, but Swahili permits it)
    //    could never be swallowed.
    //    ⚠ THE TRAILING GUARD MUST EXCLUDE A DECIMAL, NOT A CLAUSE MARK. A plain `(?![\d.,])` refuses to
    //    de-group a number followed by its own sentence comma or period, so `24,000, na wengine` reads
    //    *ishirini na nne , SIFURI ,* — the group splits off and `000` is spoken as zero. The mark is only a
    //    separator when a DIGIT follows it: `(?![\d]|,\d)`.
    s = s.replace(/(?<![\d.,])(\d{1,3})(,\d{3})+(?![\d]|,\d)/gu, (whole) => whole.replace(/,/gu, ""));

    // 4) CURRENCY is the SHARED tier's now (`currencyPrefix` in swahili.ts). Safe to move because
    //    swahili.ts runs SYMBOLS *before* this pass, so the tier still sees the sign adjacent to its
    //    number — the decimal rewrite at step 6 has not happened yet. Verified byte-identical on the
    //    whole corpus.

    // 5) DEGREES. `nyuzi joto` precedes the number and the scale name follows it — the form Swahili
    //    Wikipedia uses throughout ("nyuzi joto 45°C", "nyuzi joto +4 Selsiasi", "nyuzi joto 2.9 za
    //    Selsiasi"), and the same measure-noun-first order the corpus uses for every other unit.
    //    BEFORE decimals, for the number-adjacency reason above.
    // ⚠ THE PLUS, CLAIMED BEFORE THE DEGREE RULE BELOW — which captured `([+-]?)` and then DISCARDED it,
    //   emitting only `$2`, so the corpus's `+30°C` read *nyuzi joto thelathini Selsiasi* with the sign gone.
    //   Exactly the shape zu's `[+]?` had: a rule that consumes the sign's operand and drops the sign.
    //   The word is from the corpus's own AUDIO (a PHONEME recognizer, no `+` in its 392-token vocabulary):
    //     UTC+1  →  `… j u t i s i  p l a s w a n  k a t i k a …`   1 of 1 speaker of that sentence
    //   ⚠ The TEMPERATURE speakers do NOT say it: `… z aɪ i d i a  ɲ u z i  t a l a t i n i …` reads *zaidi ya
    //   NYUZI thelathini* — the reader supplies the DEGREE word where the sign is, not a plus (2 of 2, the
    //   second decoding the same slot as `dʒ u m l a`). So sw patterns with en/hi/vi/te/xh/am/ne, not with
    //   ta/gu/ml/mi. Voiced anyway, per the standing choice that an explicitly typed character is content.
    //   `plas` reads plˈas, matching the decode; ⚠ the conventional Swahili spelling of the loan is UNSOURCED,
    //   and this spelling is chosen to reproduce the attested phones.
    // THE MINUS AND ±. ⚠ THE CORPUS CONTAINS NO TRUE NEGATIVE and no unguardable shape either — measured:
    //    every `-<digit>` here is a range, a score or a closed designation, and there are ZERO instances of the
    //    one shape no guard can reject, `word · space · hyphen · digit`. That test is what decides this class:
    //    mr, nl, ta, gu, kn and yue all have such an instance and all decline the rule
    //    (ACCEPTED_SIGN_SILENCE); this corpus does not, so a guarded rule is safe HERE — a fact about the
    //    corpus, not about the guard.
    //
    //    THREE GUARDS: a digit immediately after the sign (rejects `- 2`), a letter or digit immediately before
    //    (rejects closed designations), and a digit ANYWHERE to the left (rejects a SPACED range or score, which
    //    the fleet's usual guard misses — the gap that cost a real defect in th).
    //
    //    SOURCED: sw.wikipedia's negative-number article — "Namba hasi katika hisabati ni namba halisi ambayo ni
    //    pungufu ya namba 0. Namba hasi huwakilisha kinyume" (a NEGATIVE number is a real number less than 0).
    //    `hasi` x27 / 8 articles, and it is the polarity word rather than the subtraction verb, which is what the
    //    sign position needs.
    //
    //    ± is then this language's own two words juxtaposed, both lifted from rules in this file.
    s = s.replace(/±/gu, " plas hasi ");
    s = s.replace(/(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)/gu, (m0: string, off: number, whole: string) =>
        /\d\s*$/u.test(whole.slice(0, off)) ? m0 : "hasi ");
    s = s.replace(/(\S)\+\s?(?=\d)/gu, "$1 plas ");
    s = s.replace(/(^|\s)\+\s?(?=\d)/gu, "$1plas ");
    s = s.replace(/(\d[\d.,]*)\s?°\s?C(?![\p{L}\p{M}])/gui, "nyuzi joto $1 Selsiasi");
    s = s.replace(/([+-]?)(\d[\d.,]*)\s?°\s?F(?![\p{L}\p{M}])/gui, "nyuzi joto $2 Fahrenheit");
    s = s.replace(/([+-]?)(\d[\d.,]*)\s?°/gu, "nyuzi joto $2");

    // 6) RANGES → `hadi` ("until/up to"), which the corpus itself uses for spans written in words
    //    ("asilimia 3 hadi 5 ya watoto", "futi 328 hadi …", "hadi kilomita 480"). Ascending only; see
    //    RANGE above for why. After de-grouping, so a grouped endpoint is already one token.
    s = s.replace(RANGE, (whole, a: string, b: string) =>
        Number(a) < Number(b) ? `${a} hadi ${b}` : whole);

    // 7) DECIMALS. The dot was reaching `clausePunctuation` and becoming a SENTENCE BREAK in the middle of
    //    a number — `1.5` → *moja . tano*, `6.34` → *sita . thelathini na nne* (which also mis-reads the
    //    fraction as "thirty-four"). `nukta` is the Swahili name of the decimal point ("matumizi ya ama
    //    nukta au koma kuwa alama ya desimali"), and the fractional digits are spaced apart so the number
    //    path speaks them one at a time. ×28.
    //    The trailing letter guard is what keeps the 802.11a/b/g/n Wi-Fi designations (×5) out — with it,
    //    none of them match at all. Must come after steps 4–6, all of which need the number intact.
    s = s.replace(/(?<![\d.,])(\d+)\.(\d+)(?![\d\p{L}])/gu, (_m, int: string, frac: string) =>
        `${int} nukta ${[...frac].join(" ")}`);

    // 8) DOTTED abbreviations before BARE ones (⚠ multi-dot before single-dot, era
    //    markers before generic abbreviations) — `B.C.E.` must be claimed before `BC` can bite into it.
    for (const [body, word] of DOTTED) s = expandDotted(s, body, word);
    for (const [re, word] of BARE_ERA) s = s.replace(re, word);

    // 9) A SPACED DASH is a parenthetical break and was being dropped entirely, so 22 clause boundaries
    //    carried no pause at all ("kwa usahihi - pia jaribu", "ni Mungu mmoja - Dini ya Kiyahudi").
    //    LAST, so that step 6 has already claimed every dash that sits between two numbers — a sports
    //    score like "26 - 00" must keep its bare juxtaposition rather than gain a spurious pause.
    s = s.replace(/(?<![\d])\s+[-–—]+\s+(?![\d])/gu, ", ");

    // THE RELATIONAL AND DIVISION SIGNS. Swahili is SVO, so all four read infix.
    //
    // ⚠ THE REGISTER SOURCE SHOWS THE ÷ GLYPH ITSELF: sw.wikipedia writes "hesabu ya kugawanya namba moja kwa
    // nyingine. Kama swali ni 6 ÷ 3 basi hisa yake…" — the operation of dividing one number BY another, with
    // the notation in the sentence. That also gives the construction: kugawanya X **kwa** Y.
    //
    // ⚠ AND THE CORPUS'S OWN DIVISION HITS ARE THE PARTITION SENSE, which per the Ukrainian correction is
    // neither evidence for nor against: `kugawanya nyuklia` is nuclear FISSION and `inayogawanya picha kwa
    // thuluthi` is dividing a picture into thirds. Same lemma, sense carried by the argument. The register
    // quote is what puts it on a numeric operand.
    //
    // The other three come from sw_ke, where they are strongly attested with quantities:
    //   `sawa na`   ×27  "ni sawa na au takribani sawa na uwiano huu" — EQUAL TO this ratio
    //   `chini ya`  ×70  "huenda chini ya kiwango cha kugandisha" — goes BELOW freezing point
    //   `zaidi ya`  ×107
    // ⚠ `chini ya`'s two WIKI hits are the wrong sense ("Chini ya Elimu kwa wote" — UNDER the programme), so
    // here the corpus is the better source and the register tier the weaker one — the reverse of the usual
    // order in this issue, and a reminder that the tiers rank haystacks, not individual findings.
    s = s.replace(/\s?=\s?/gu, " sawa na ");
    s = s.replace(/\s?<\s?/gu, " chini ya ");
    s = s.replace(/\s?>\s?/gu, " zaidi ya ");
    s = s.replace(/\s?÷\s?/gu, " kugawanya kwa ");

    return s;
}
