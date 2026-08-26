/**
 * Finnish (fi) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything the Finnish g2p cannot
 * already read into Finnish words the existing pipeline speaks. Pure text→text, no IPA. Runs inside
 * finnish.ts's `text()` BEFORE the shared symbol tier (`makeSymbolNormalizer`), so digits stay digits and
 * the tier can still see number–unit adjacency.
 *
 * MEASURED OVER `tools/corpus/mined/fi.jsonc` (fi.wikipedia, random 400 + `insource:` fill). Two figures
 * per class: the artifact's whole-corpus `counts` over 5,139 segments, and — where the rule needed a
 * context table that only retained text can give — the count over the 406 retained segments (hard+sample).
 *
 *   whole corpus:  digit-run 2839 · year 2837 · initialism 1007 · ordinal-latin 721 · ranges 636 ·
 *                  abbrev 630 · grouped 447 · decimals 430 · signs 157 · roman 152 · percent 133 ·
 *                  letter-name 328 · quote-letter 87 · units 67 · ampersand 67 · dotted 49 · clock 42 ·
 *                  signed-number 29 · exponent 27 · ordinal-range 21 · degrees 17 · fractions 16 ·
 *                  rate 8 · currency 4 · arithmetic 4 · sports-time 1 · version-dot 0 · ordinal-caps 0
 *   retained 406:  `N.` ordinal 333 contexts · decimal comma 152 · space-grouped 93 · colon suffix 78 ·
 *                  dotted date 19 · ordinal range 20 · clock 3
 *
 * WHAT THE ENGINE DID BEFORE, verbatim — the defect list this file is shaped by:
 *
 *   13. toukokuuta   → kolmetoi̯stɑ . tou̯kokuːtɑ    a CARDINAL and a spurious clause PAUSE mid-sentence
 *   1.11.2019        → yksi . yksitoi̯stɑ . kɑksi…   three cardinals and two pauses
 *   kello 21.01      → kelːo kɑksikymːentæy̯ksi . yksi
 *   50,7 %           → ʋiːsikymːentæ , sei̯tsemæn   the decimal comma is read as a PAUSE; % silent
 *   1 786            → yksi sei̯tsemænsɑtɑː…        the grouping space split one number into two
 *   13,6 cm          → …kuːsi km                     ⚠ ⟨cm⟩ READ AS ⟨km⟩ (trap 56)
 *   76,02 km²        → …kɑksi km                     ² silent, ⟨km⟩ raw
 *   120 km/h         → …km h                         raw letters
 *   −34,3 °C         → …kolme k                      minus and ° silent, ⟨C⟩ → /k/
 *   CIA:n            → kiɑ , n                       an initialism read as a WORD
 *   MM-kilpailuissa  → mː kilpɑi̯lui̯sːɑ            ⟨MM⟩ geminated into one long /mː/
 *   s. 21. helmikuuta→ s . …                          an abbreviation as a bare consonant plus a pause
 *   n. 259 km2       → n . …km kɑksi                 the ASCII exponent read as the NUMBER two (trap 53)
 *   Robinson & Cook  → robinson koːk                 & silent
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ THE BARE `N.` ORDINAL IS THIS LANGUAGE'S LARGEST RULE, AND IT IS TRAP 4's SHAPE — DETECTABLE ONLY BY
 * TABULATING WHAT SURROUNDS IT. Counted over the 406 retained segments, `\d{1,4}\.` + space + a token:
 *
 *     followed by a MONTH NAME          147   ordinal date — `13. toukokuuta`, `28. päivänä`
 *     followed by a CAPITAL             159   ⚠ SENTENCE ENDS — `… vuonna 1978. Jakokoski on kylä …`
 *     followed by a LOWERCASE word       20   ordinal attribute — `18. herttuatar`, `30. lento.`,
 *                                             `2. painos`, `15. sija`, `10. divisioona`, `17. ja`
 *     followed by a DIGIT / `(`           7   a date range's second element, and `2005/34. (PDF)`
 *     segment-final                      38   ⚠ SENTENCE ENDS
 *
 * So the discriminator is the following word's CASE, and the rule falls out of the table: claim `N.` only
 * before a month name or a lowercase word. **THE INVARIANT, STATED AND MEASURED: zero sentence-final
 * pauses are lost** — 159 capital-followed and 38 segment-final periods are outside every pattern in this
 * file, and the ordinal rule's lookahead requires a lowercase letter it cannot reach.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ THE COLON IS AN INFLECTIONAL JOINT, AND FINNISH NEVER SPACES IT (traps 14/15). 78 instances in the
 * retained text, in three kinds:
 *
 *     on an INITIALISM      ~54   `BKT:sta` `YK:n` `EU:n` `AHL:ssä` `CIA:n` `FIA:n` `V70:n`
 *     on DIGITS              18   ordinal `33:s` `27:s` `9:nnen` `11:nneksi` `1:sten` `30:nneksi` (8)
 *                                 cardinal case `172001:stä` `850:n` `60:n` `88:aan` `44:stä` (10)
 *     on a SYMBOL/UNIT        6   `%:lla` `kg:n` ×2 `°C:n` `km²:n` `km²:iin`
 *
 * The SPACED form trap 15 warns about was searched for and is ×0: `grep -oE '[0-9] (n|ssa|sta|lla|een|s)'`
 * over the retained text returns one hit and it is a stray `s`. Finnish glues, always — so the rule is
 * deliberately narrower than Oromo's and admits no spaced alternation (trap 9).
 *
 * ⚠ AND AGREEMENT CANNOT BE APPLIED TO DIGITS, which is what limits this rule rather than effort. A
 * Finnish numeral declines in EVERY component (`850:n` = *kahdeksansadanviidenkymmenen*, `11:nneksi` =
 * *yhdenneksitoista*, with the case marker INSIDE the compound), and no in-repo source carries those
 * forms: the referee is a LEMMA list (`kilometriä` ×0, `prosenttia` ×0, `asteen` ×0 — every inflected
 * probe returns nothing) and the corpus attests only the partitive/genitive of the unit NOUNS. So:
 *
 *     SHIPPED  the nominative ordinal `N:s` (4 instances) — the written `s` IS the nominative ending, so
 *              `33:s` is exactly `ordinal(33)` with nothing to inflect.
 *     REFUSED  every oblique colon suffix (14 on digits, 6 on a symbol). PRICED (trap 53): the refusal is
 *              not left neutral, because the `:` itself is read as a clause PAUSE by
 *              `clausePunctuation`, and a morpheme joint is not a pause. The colon is therefore DELETED
 *              and nothing else changes — same words as before, minus a sentence break that was never
 *              there. That invents no morphology and loses none it had.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * ⚠ RANGES ARE REFUSED, 636 instances, and this is the largest single refusal in the file. Finnish reads
 * a span with the ELATIVE–ILLATIVE pair on both operands — *vuosina 1994–1997* is
 * *tuhatyhdeksänsataayhdeksänkymmentäneljästä tuhatyhdeksänsataayhdeksänkymmentäseitsemään* — and there
 * is no free joiner word to insert. Trap 14 again: the operands are digits when this file runs, so no
 * agreement is possible; and there is nothing to put in the dash's place that Finnish would say. Emitting
 * a connective the language does not use would be confidently wrong where silence is merely incomplete,
 * so the dash stays dropped exactly as it is today. PRICED: 636 spans read as two bare cardinals, which
 * is what they already read as — the refusal costs nothing beyond the status quo and adds nothing wrong.
 * (The ORDINAL range is different and is claimed: `20.–24. toukokuuta` still gets its two ordinals, and
 * only the connective is refused.)
 *
 * ⚠ FRACTIONS ARE REFUSED, and the count is the argument: of the 16 `fractions` instances, the retained
 * text's `N/M` shapes are `1933/1938` (a Bible translation year pair), `5/8` (part 5 of 8), `228/450`
 * (a seat ratio), `2005/34` and `2005/32` (publication numbers), `7/2020` (a month), `24/7/365` and
 * `Su-7U/BM` (a designation). ONE is a genuine fraction — `1/131 euroa`. A denominator series would fire
 * on eight non-fractions to fix one, so the slash is left where it is.
 *
 * ⚠ NO ENGLISH-STYLE COMMA-GROUPING ARM, unlike the sv/nb siblings — measured, and it is the opposite
 * answer. Every `\d,\d{3}` in the retained text (`264,362`, `400,454`, `397,481`, `413,205` ×2) is a
 * genuine three-place DECIMAL in a km/h speed record. Finnish groups with a SPACE and only with a space,
 * so a comma before three digits is a decimal point here and a rule that de-grouped it would corrupt
 * five real numbers to fix none. Trap 55: the sibling's guard travels worse than its vocabulary.
 *
 * ⚠ THE DECADE COMPOUND `1900-luvulla` IS A MEASURED NON-DEFECT, recorded so it is not re-investigated.
 * It reads as two tokens (*tuhat yhdeksänsataa* + *luvulla*) where Finnish writes one word, and this
 * engine EMITS NO STRESS — the header of finnish.ts says so: word-initial primary stress is predictable
 * and unwritten, so it is not emitted. Gluing the compound therefore changes the phoneme string by
 * exactly one space and nothing else. The same holds for `13-vuotias` and `187-senttimetrinen`. Not
 * worth a rule, and worth knowing why.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────────────
 * SOURCING. Finnish is well resourced and every word below is a token somebody else wrote:
 *
 *   corpus (tools/corpus/mined/fi.jsonc, token-matched by corpus-words.ts)
 *       prosenttia ×3 · dollaria ×11 · dollarin ×4 · euroa ×4 · kilometriä ×18 · kilometrin ×10 ·
 *       metriä ×29 · millimetriä ×2 · astetta ×2 · neliökilometriä ×8 · kertaa ×6 · ja ×717 ·
 *       vuonna ×126 · noin ×70 · muun muassa ×20 · esimerkiksi ×13 · englanniksi ×4 · syntynyt ×2 ·
 *       kuollut ×1 · tunnin ×5 · tuntia ×2
 *   referee (tools/referee-eval/referees/fi.wikipron-fin-broad.tsv — Wiktionary, human, 173,449 lemmas)
 *       the WHOLE ordinal series as lemmas: ensimmäinen toinen kolmas neljäs viides kuudes seitsemäs
 *       kahdeksas yhdeksäs kymmenes yhdestoista…yhdeksästoista kahdeskymmenes…yhdeksäskymmenes
 *       kahdessadas kolmassadas sadas tuhannes miljoonas — every one ×1, none composed on faith;
 *       plus pilkku, miinus, plus, senttimetri, kilogramma, neliö, kuutio, prosentti, dollari, euro, aste
 *       — AND 59 spelled-out ACRONYMS with their IPA, which is where the letter names below come from.
 *   fi.wikipedia (attest.ts, cached in tools/corpus/attest/fi.jsonc — the WEAKER tier, senses READ)
 *       pilkku ×89/18 — the article is about the punctuation mark and states `3,141 (kolme ja
 *           sataneljäkymmentäyksi tuhannesosaa)` and "Englannin kielessä pilkku on tuhansien erotin";
 *           the decimal-separator sense, exactly the slot ⚠ (trap: zu's amaphuzu was sports points)
 *       miinus ×53/19 — "Miinus (−), vähennyslaskun merkki / negatiivisen luvun etumerkki", the SIGN
 *       tunnissa ×86/19 · sekunnissa ×57/16 ("kertaa sekunnissa", the per-second slot; the first hits
 *           are a band name *Tuhat kuolemaa sekunnissa* and were read past)
 *       senttimetriä ×122/20 ("45–58 senttimetriä") · kilogrammaa ×83/20 ("170–240 kilogrammaa")
 *       ennen ajanlaskun alkua ×31/19 ("vuodelta 450 ennen ajanlaskun alkua") and jälkeen ajanlaskun
 *           alun ×19/19 — one hit names the abbreviation beside the expansion: "vaihtoehtoina käytetään
 *           merkintöjä eaa. ja jaa. (ennen ja jälkeen ajanlaskun alun)"
 *       omaa sukua ×20/17 ("(omaa sukua Vahtola)", the née slot) · venäjäksi ×31/11 · japaniksi ×32/11 ·
 *           kreikaksi ×10/7 · arabiaksi ×9/7 — all in the "(kieli)" reference tag slot the corpus uses
 *       asukasta ×131/16 · vähintään ×96/20 · lyhenne ×51/15 ("Lyhenne (lyhenne lyh.)") ·
 *           ja niin edelleen ×17/5
 *
 * NOT SOURCED, therefore NOT SHIPPED: `ns.`/`nk.` (2 instances) — *niin sanottu* is attested ×40/20 but
 * the abbreviation stands for an AGREEING adjective (`nk. vihreäselkäiset dollarit` wants the plural
 * *niin sanotut*), and the number cannot be recovered from the abbreviation. Left alone, so ⟨ns⟩ keeps
 * reaching the g2p as a vowel-less cluster and `mine.ts scan` keeps reporting `LEAK RAW-LATIN ns ×1`.
 * That red line is deliberate and names a real gap.
 */

import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { MANIFEST } from "./manifest.ts";

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * ORDINALS 1–9 in FINAL position (the form a compound ends in), and the COMBINING form used everywhere
 * else. Finnish ordinalises EVERY component of a compound, and only 1 and 2 have two shapes:
 * *ensimmäinen* / *toinen* standing alone, *yhdes-* / *kahdes-* inside (`yhdestoista` = 11th,
 * `kahdeskymmenes` = 20th, but `kahdeskymmenesTOINEN` = 22nd). Every form here is a referee lemma.
 */
const ORD_FINAL: readonly string[] = [
    "", "ensimmäinen", "toinen", "kolmas", "neljäs", "viides", "kuudes", "seitsemäs", "kahdeksas",
    "yhdeksäs",
];
const ORD_COMB: readonly string[] = [
    "", "yhdes", "kahdes", "kolmas", "neljäs", "viides", "kuudes", "seitsemäs", "kahdeksas", "yhdeksäs",
];
const ORD_TEN = "kymmenes"; // 10th, and the tens formant (kahdes+kymmenes = 20th)
const ORD_TEEN = "toista"; // 11–19: combining unit + toista, mirroring the cardinal's teenSuffix
const ORD_HUNDRED = "sadas"; // 100th, and the hundreds formant (kahdes+sadas = 200th, a referee lemma)

/**
 * The Finnish ordinal for 1 … 999, or undefined outside it — an unclaimable number keeps its digits and
 * its period rather than getting a guessed ending.
 *
 * ⚠ FOUR BRANCHES, PINNED SEPARATELY IN THE TESTS (trap 13): the sub-ten table, the teens, the tens
 * (with and without a unit), and the hundreds. The corpus exercises only the first two and the tens —
 * its ordinals are days of the month plus `126.`, `150.`, `101.` — so the hundreds branch is pinned on a
 * case the corpus does NOT contain, which is the whole point of that trap.
 *
 * 999 is the ceiling because nothing above it is written as an ordinal in this corpus and the thousands
 * formant (*tuhannes*) would then be composing `kahdestuhannes`, which the referee does NOT carry —
 * `tuhannes` ×1 and `kahdessadas` ×1 do, and stopping where the evidence stops is cheaper than a rule
 * that is right exactly where nobody looked.
 */
export function ordinal(n: number): string | undefined {
    if (!Number.isInteger(n) || n < 1 || n > 999) return undefined;
    if (n < 10) return ORD_FINAL[n];
    if (n === 10) return ORD_TEN;
    if (n < 20) return `${ORD_COMB[n - 10]!}${ORD_TEEN}`; // 11 → yhdestoista
    if (n < 100) {
        const t = Math.floor(n / 10);
        const o = n % 10;
        return `${ORD_COMB[t]!}${ORD_TEN}${o ? ORD_FINAL[o]! : ""}`; // 21 → kahdeskymmenesensimmäinen
    }
    const h = Math.floor(n / 100);
    const r = n % 100;
    const hundreds = h === 1 ? ORD_HUNDRED : `${ORD_COMB[h]!}${ORD_HUNDRED}`; // 200 → kahdessadas
    return `${hundreds}${r ? ordinal(r)! : ""}`; // 126 → sadaskahdeskymmeneskuudes
}

/**
 * Month names in the PARTITIVE, which is the case a Finnish date takes (`13. toukokuuta`, not
 * *toukokuu*) — so a numeric date rewrites to exactly the form the corpus already writes in words. All
 * twelve are attested in the corpus's own spelled-out dates (147 of them), which is also what makes this
 * table a reading of the language rather than a translation of a month list.
 */
const MONTHS: readonly string[] = [
    "", "tammikuuta", "helmikuuta", "maaliskuuta", "huhtikuuta", "toukokuuta", "kesäkuuta", "heinäkuuta",
    "elokuuta", "syyskuuta", "lokakuuta", "marraskuuta", "joulukuuta",
];
/** The same names in every case the corpus writes them, for the `N.` ordinal rule's lookahead — a date's
 *  month may be partitive (`13. toukokuuta`) or nominative/genitive in a heading. */
const MONTH_LOOKAHEAD =
    "(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu\\p{L}*|päivä\\p{L}*";

/** The decimal separator's NAME. Finnish reads `3,14` as *kolme pilkku yksi neljä*; see the header for
 *  the two independent sources and the sense that was read. */
const DECIMAL_WORD = "pilkku";

/**
 * LETTER NAMES, and 21 of the 29 are corroborated by the referee's OWN IPA rather than asserted — it
 * carries 59 spelled-out acronyms:
 *
 *     ATK ɑː t eː k oː    a=aa t=tee k=koo      CD  s eː d eː       c=see d=dee
 *     EKG eː k oː ɡ eː    e=ee g=gee            HIFK h oː iː æ f k oː   h=hoo i=ii f=äf
 *     DJ  d eː j iː       j=jii                 LTK æ l t eː k oː   l=äl
 *     OY  oː yː           o=oo y=yy             CP  s eː p eː       p=pee
 *     DDR d eː d eː æ r   r=är                  SNTL e s e n t eː e l / æ s æ n t eː æ l   s=äs n=än
 *     UJ  uː j iː         u=uu                  CV  s eː ʋ eː       v=vee
 *     VMTL ʋ eː e m t eː e l                    m=äm
 *
 * ⚠ THE ä-FORMS AND THE e-FORMS ARE BOTH REAL AND BOTH ATTESTED — SNTL and VMTL each appear in the
 * referee with *es-en-tee-el* and *äs-än-tee-äl*, for the same word. The ä-series is taken because it is
 * the majority spelling across those 59 entries; picking either is a variant, not an error.
 * ⚠ AND THE SHORT FORM IS TAKEN, NOT THE GEMINATE. The referee writes `æ m`, `æ n`, `æ l` (single) in
 * SNTL/VMTL/LTK/DDR/HS/STTK/VR and `æ mː`, `æ nː` (geminate) only in NMKY/NNKY. Short is the majority,
 * and it is what these strings phonemise to through this engine's own gemination rule.
 * The eight the referee does not reach — b q w x z å ä ö — are the standard Finnish names.
 */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "aa", b: "bee", c: "see", d: "dee", e: "ee", f: "äf", g: "gee", h: "hoo", i: "ii", j: "jii",
    k: "koo", l: "äl", m: "äm", n: "än", o: "oo", p: "pee", q: "kuu", r: "är", s: "äs", t: "tee",
    u: "uu", v: "vee", w: "kaksoisvee", x: "äks", y: "yy", z: "tseta", å: "ruotsalainen oo", ä: "ää",
    ö: "öö",
};

/**
 * THE LONG (VOWEL-FINAL) FORM of the seven consonant-final letter names, used ONLY when a case suffix has
 * to attach to the last letter of an initialism. This is not a style choice, it is why the long forms
 * exist: `KTM:n` is *koo tee ÄMMÄN*, because gluing `n` to the short *äm* gives [æmn], a word-final
 * cluster Finnish does not have. The corpus diff is what surfaced it — the first draft emitted exactly
 * that ⟨ämn⟩ on `KTM:n`, and `AHL:ssä` came out ⟨älssä⟩.
 * Every one is a referee lemma with precisely the letter-name reading: ällä æ lː æ · ämmä æ mː æ ·
 * ännä æ nː æ · ärrä æ rː æ · ässä æ sː æ · äffä æ fː æ · äksä æ k s æ.
 * The SHORT form stays everywhere else, because that is the majority spelling in the referee's own
 * spelled acronyms (SNTL, VMTL, LTK, DDR, HS, STTK, VR all write `æ l` / `æ m` / `æ s`).
 */
const LETTER_NAME_LONG: Readonly<Record<string, string>> = {
    f: "äffä", l: "ällä", m: "ämmä", n: "ännä", r: "ärrä", s: "ässä", x: "äksä",
};

/**
 * Finnish phonotactics, for the OOV rule in core/initialisms.ts (can this letter run be a word at all?).
 *
 * ⚠ THE CODA SET IS THE LOAD-BEARING ONE HERE, because a Finnish word ends in a vowel or in a single
 * ⟨n s t r l⟩ — no native word ends in a cluster at all. Left empty it would spell out `SARS`, which the
 * referee records as a WORD (s ɑ r s), so the loan codas Finnish does tolerate are listed and nothing
 * more: that keeps `AMK` (mk), `HIFK` (fk), `UTC` (tc), `AHL` (hl) and `UKK` (kk) spelled, which is what
 * the referee says of every one of them it carries.
 * Onsets are the loan clusters only, for the same reason — Finnish has no native initial cluster, so
 * `SNU` and `SNTL` are spelled rather than read.
 */
export const isUnreadableFinnish = makeUnreadableTest({
    vowels: /[aeiouyäöå]/u,
    legalOnsets: new Set([
        "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk", "sp", "st",
        "tr", "tv",
    ]),
    legalCodas: new Set(["ks", "ls", "ns", "nt", "rs", "rt", "st", "lt"]),
});

/**
 * LEXICAL: letter runs that ARE readable as Finnish words and are nevertheless spelled out — the fact no
 * phonotactic test can derive. Kept to what this corpus writes, each corroborated:
 *   eu  — `EU:n` ×4; the referee has EU as `eː uː`, i.e. *ee-uu*, not the diphthong word "eu"
 *   yk  — `YK:n` ×4; the referee has YK as `yː k oː`, *yy-koo*
 *   cia — `CIA:n` ×2; readable as the word "kia", which is what it currently comes out as
 *   em  — `EM-kilpailuissa` ×3 · ep — `EP:n` ×5; both compose from letter names above, and both would
 *         otherwise be read as the words "em" / "ep"
 * ⚠ `usa` and `ivy` are deliberately ABSENT: the referee records USA as `u s ɑ` and IVY as `i ʋ y`,
 * i.e. Finnish reads those two AS WORDS. Adding them "for consistency" would break two real readings.
 */
const ACRONYM_LETTERS: ReadonlySet<string> = new Set(["eu", "yk", "cia", "em", "ep"]);

/**
 * DOTTED ABBREVIATIONS. `[pattern, replacement, keepFinal]` — `keepFinal` marks the ones that can end a
 * sentence, where the period must survive as a pause.
 *
 * ⚠ EVERY DIGIT-SENSITIVE ONE CARRIES A LEFT GUARD, because the same two letters are a UNIT here
 * (trap 2). `mm.` is *muun muassa* ×3 and the MILLIMETRE ×2 in the same 406 segments (`944 mm.`), and
 * `s.` is *syntynyt* ×~10 and the SECOND in `10,3 s.`; both are separated by whether a digit precedes.
 * ⚠ AND EVERY ONE IS LEFT-BOUNDED WITH `(?<![\p{L}\p{M}])` RATHER THAN `\b` (trap 1) — the first draft
 * of the era arm matched inside `MM-hopeaa.`, which is not an era marker.
 */
const ABBREV: readonly (readonly [RegExp, string, boolean])[] = [
    // Multi-dot BEFORE single-dot, or the interior dot survives as a phrase break (playbook step 4).
    [/(?<![\p{L}\p{M}])o\.\s?s\.(?=\s)/gu, "omaa sukua", false],
    // Era markers before the generic abbreviations, for the same ordering reason.
    [/(?<![\p{L}\p{M}])eaa\./gu, "ennen ajanlaskun alkua", true],
    [/(?<![\p{L}\p{M}])jaa\./gu, "jälkeen ajanlaskun alun", true],
    // `s.` / `k.` = syntynyt / kuollut, ONLY before a figure and never after one (see above).
    [/(?<![\p{L}\p{M}])(?<!\d )s\.(?=\s+\d)/gu, "syntynyt", false],
    [/(?<![\p{L}\p{M}])(?<!\d )k\.(?=\s+\d)/gu, "kuollut", false],
    [/(?<![\p{L}\p{M}])(?<!\d )mm\.(?=\s)/gu, "muun muassa", false],
    // ⚠ THE DIGIT AND COLON GUARDS ARE NOT DECORATION. `n.` is *noin* ×2 in the retained text and a
    // FALSE POSITIVE ×1: `korvasi Volvo 850:n. Rinnakkaismallina…` is a case suffix plus a sentence
    // period, and without `\d:` in the lookbehind it read as "Volvo 850 noin".
    [/(?<![\p{L}\p{M}\d:])n\.(?=\s)/gu, "noin", false],
    [/(?<![\p{L}\p{M}])[Vv]\.(?=\s+\d)/gu, "vuonna", false],
    [/(?<![\p{L}\p{M}])esim\./gu, "esimerkiksi", true],
    [/(?<![\p{L}\p{M}])jne\./gu, "ja niin edelleen", true],
    [/(?<![\p{L}\p{M}])väh\./gu, "vähintään", true],
    [/(?<![\p{L}\p{M}])milj\./gu, "miljoonaa", true],
    [/(?<![\p{L}\p{M}])lyh\./gu, "lyhenne", true],
    [/(?<![\p{L}\p{M}])(?<=\d )as\./gu, "asukasta", true],
    // Parenthesised LANGUAGE tags (26 instances) — `(engl. Algic languages)`, `(ven. Малюта Скуратов)`.
    // The translative is what the corpus itself writes when it spells them out: `(englanniksi)`,
    // `(saksaksi, ranskaksi, italiaksi)`. Only the tags this corpus contains are listed (trap 9).
    // ⚠ `keepFinal` is FALSE for all of them, unlike the era markers: a language tag always INTRODUCES
    // the foreign name, so it is never sentence-final, and the shared heuristic ("a capital follows ⇒ it
    // was a sentence end") reads exactly backwards here — `(engl. Algic languages)` came out with a
    // spurious pause before *Algic*, which is the only word the tag exists to introduce.
    [/(?<![\p{L}\p{M}])engl\./gu, "englanniksi", false],
    [/(?<![\p{L}\p{M}])ven\./gu, "venäjäksi", false],
    [/(?<![\p{L}\p{M}])saks\./gu, "saksaksi", false],
    [/(?<![\p{L}\p{M}])arab\./gu, "arabiaksi", false],
    [/(?<![\p{L}\p{M}])jap\./gu, "japaniksi", false],
    [/(?<![\p{L}\p{M}])kreik\./gu, "kreikaksi", false],
    [/(?<![\p{L}\p{M}])ital\./gu, "italiaksi", false],
    [/(?<![\p{L}\p{M}])kiin\./gu, "kiinaksi", false],
    [/(?<![\p{L}\p{M}])kor\./gu, "koreaksi", false],
    [/(?<![\p{L}\p{M}])ukr\./gu, "ukrainaksi", false],
    [/(?<![\p{L}\p{M}])puol\./gu, "puolaksi", false],
    [/(?<![\p{L}\p{M}])mong\./gu, "mongoliaksi", false],
    [/(?<![\p{L}\p{M}])arm\./gu, "armeniaksi", false],
    [/(?<![\p{L}\p{M}])esp\./gu, "espanjaksi", false],
];

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// THE PASS
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

const isDay = (d: number): boolean => d >= 1 && d <= 31;
const isMonth = (m: number): boolean => m >= 1 && m <= 12;

/** A clock's minute field. `01` is *nolla yksi* and `00` is *nolla nolla*; a bare `Number("01")` would
 *  lose the zero, which is a syllable Finnish says. */
function minutes(mm: string): string {
    const zero = MANIFEST.numbers.zero;
    if (mm === "00") return `${zero} ${zero}`;
    if (mm.startsWith("0")) return `${zero} ${mm.slice(1)}`;
    return mm;
}

export function normalizeFinnish(input: string): string {
    let t = input;
    let prev: string;

    // 1) SPACE-GROUPED THOUSANDS (447; 93 in the retained text), FIRST — a space is a token boundary, so
    //    `1 786 henkilölle` reached the number path as TWO numerals (*yksi seitsemänsataakahdeksan…*) and
    //    `1 600 000` as three. Includes NBSP and the narrow NBSP, which is what a typesetter emits.
    //    It must precede every rule that reads a digit run — the date, ordinal and decimal rules all do.
    //    Exactly three digits per block, so `30 9` cannot fuse two separate numbers (that guard is why
    //    `4 096 × 2 304` stays two numbers around its multiplication sign).
    do {
        prev = t;
        t = t.replace(/(?<=\d)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))/gu, "");  // space, NBSP, NNBSP, thin space
    } while (t !== prev);

    // 2) DOTTED ABBREVIATIONS (630) — multi-dot before single-dot (playbook step 4), era markers before
    //    the generic ones, and all of them BEFORE the initialism pass or `V.` is spelled VEE.
    //
    //    ⚠ AND BEFORE THE DATE AND ORDINAL RULES, WHICH IS THE COUPLING THAT COST A DRAFT. Three of these
    //    arms are gated on a FOLLOWING FIGURE — `s. 21. helmikuuta` is *syntynyt*, `10,3 s.` is the
    //    second — and steps 3–5 turn that figure into a word. With abbreviations last, `s. 21.` had no
    //    digit left to look at by the time it ran and the corpus's commonest abbreviation (×~10) stayed a
    //    bare consonant plus a spurious pause. A guard's evidence has a lifetime (trap 39).
    //
    //    The `keepFinal` arm re-emits the period when the abbreviation ends a sentence, which is the only
    //    place in this file a period is consumed at all: `noin 2100 eaa. Urissa asui…` keeps its break.
    for (const [re, word, keepFinal] of ABBREV)
        t = t.replace(re, (m: string, ...rest: unknown[]) => {
            if (!keepFinal || !m.endsWith(".")) return word;
            const at = rest[rest.length - 2] as number;
            const whole = rest[rest.length - 1] as string;
            const after = whole.slice(at + m.length).replace(/^["”'’)\]]+/u, "");
            return after.trim() === "" || /^\s+["“(]?\p{Lu}/u.test(after) ? `${word}.` : word;
        });

    // 3) DOTTED DATES `D.M.YYYY` (17) and `D.M.` (2), BEFORE the ordinal rule (step 5) — otherwise the
    //    ordinal rule's month/lowercase lookahead never fires on `1.11.2019` and the three fields read as
    //    three cardinals separated by two clause pauses. Gated on a legal day AND month, which is what
    //    keeps a version string or a figure number out: `H.264` has one dot, and nothing in this corpus
    //    writes `d.d.d` with a field above 31/12. The YEAR stays as DIGITS so the cardinal compositor
    //    reads it (trap 20 — and here the engine's own rules do the right thing with it).
    t = t.replace(
        /(?<![\d.,:])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/gu,
        (m, d: string, mo: string, y: string) =>
            isDay(Number(d)) && isMonth(Number(mo)) && ordinal(Number(d)) !== undefined
                ? `${ordinal(Number(d))!} ${MONTHS[Number(mo)]!} ${y}`
                : m,
    );
    t = t.replace(/(?<![\d.,:])(\d{1,2})\.(\d{1,2})\.(?!\d)/gu, (m, d: string, mo: string) =>
        isDay(Number(d)) && isMonth(Number(mo)) && ordinal(Number(d)) !== undefined
            ? `${ordinal(Number(d))!} ${MONTHS[Number(mo)]!}`
            : m);

    // 4) CLOCK `kello|klo HH.MM` (3), GATED ON THE MARKER WORD — and the gate is the measurement, not a
    //    precaution. The retained text writes exactly five `\d{1,2}\.\d{2}` shapes: `21.01`, `18.39` and
    //    `10.00`, all three preceded by `kello`, and `9.29`, `9.18`, which are the fractional part of the
    //    SPORTS times `9.29,43` / `9.18,54` and must not be claimed. A bare-colon/bare-period clock rule
    //    would have fixed 3 and broken 2 — the ilo-vs-ceb shape of trap 55.
    //    AFTER step 2, so a date's dots are already spent and cannot look like an hour.
    t = t.replace(
        /(?<=(?:kello|klo\.?)\s)(\d{1,2})[.:](\d{2})(?![\d.,])/giu,
        (m, h: string, mm: string) => (Number(h) < 24 && Number(mm) < 60 ? `${h} ${minutes(mm)}` : m),
    );

    // 5) THE BARE `N.` ORDINAL — the largest rule in the file. See the header for the 333-context table
    //    and for the sentence-period invariant. THE ORDINAL RANGE IS CLAIMED FIRST (20 instances,
    //    `20.–24. toukokuuta`, `101.–150. maailmassa`): its LEFT operand is followed by a dash rather than
    //    by a month or a lowercase word, so the single rule would strand it and read it as a cardinal.
    //    Only the connective is refused (see the header); both ordinals are still read.
    const ordTail = `(?=\\s+(?:${MONTH_LOOKAHEAD}|\\p{Ll}))`;
    t = t.replace(
        new RegExp(`(?<![\\d.,:\\p{L}])(\\d{1,3})\\.\\s*[–—-]\\s*(\\d{1,3})\\.${ordTail}`, "gu"),
        (m, a: string, b: string) => {
            const x = ordinal(Number(a)), y = ordinal(Number(b));
            return x !== undefined && y !== undefined ? `${x} ${y}` : m;
        },
    );
    t = t.replace(
        new RegExp(`(?<![\\d.,:\\p{L}])(\\d{1,3})\\.${ordTail}`, "gu"),
        (m, n: string) => ordinal(Number(n)) ?? m,
    );

    // 6) THE ORDINAL COLON SUFFIX `N:s` (4) — `33:s`, `27:s`. The written `s` IS the nominative ordinal
    //    ending, so there is nothing to inflect and the table answers exactly. Restricted to `:s` on
    //    purpose: `9:nnen`, `11:nneksi`, `1:sten`, `30:nneksi` are oblique and Finnish puts the case
    //    marker INSIDE the compound (`yhdenneksitoista`), which no in-repo source carries — see the
    //    header. Those fall through to step 6.
    t = t.replace(/(?<![\d.,:])(\d{1,3}):s(?![\p{L}\p{M}])/gu, (m, n: string) => ordinal(Number(n)) ?? m);

    // 7) THE REMAINING COLON SUFFIXES — the PRICED REFUSAL (header). The colon is a morpheme joint and
    //    `clausePunctuation` reads it as a clause pause, so `172001:stä` came out with a sentence break
    //    inside one word. Deleting the colon leaves the same words and removes a break that was never
    //    there; it neither invents an inflection nor loses one. Covers the digit forms and the symbol
    //    ⚠ THE TWO ARMS DIFFER, AND THE SECOND HAD TO GO FURTHER THAN THE FIRST — measured, not assumed.
    //    After DIGITS the suffix survives as its own token and nothing fuses (`172001stä` tokenises as a
    //    number and `stä`), so only the colon goes and the reading is unchanged but for the lost pause.
    //    After a SYMBOL it cannot: `%lla` and `kgn` are what the first draft produced, and the shared
    //    tier's key guard is `(?![\p{L}\p{M}])`, so a trailing letter makes it DECLINE the whole match —
    //    `55 kg:n` came out as a raw ⟨kgn⟩ and `53 %:lla` as the fabricated single word *prosenttialla*,
    //    both WORSE than the status quo. So the symbol arm drops the suffix with the colon.
    //    PRICED (trap 53): six instances lose one case morpheme each and gain their unit noun —
    //    `55 kilogrammaa` for `55 kilogramman`, against a raw ⟨kg⟩ or an invented word. Refusing the
    //    inflection is not a licence to half-refuse the match.
    //    ⚠ INITIALISMS ARE NOT TOUCHED HERE. `resolveColonInflection` below owns those, because there the
    //    suffix has to be glued to the last LETTER NAME (`CIA:n` → *see ii aan*), which does not exist
    //    until the letters have been spelled.
    t = t.replace(/(?<=\d)\s*:(?=[a-zåäö])/gu, "");
    // ⚠ `[a-zåäö]` is the Finnish case suffix and is lowercase-only; `i` folds it, so the lowercase
    //    scale letters go in the lookbehind's class instead of into the flags.
    t = t.replace(/(?<=[%²³]|°[CFcf])\s*:[a-zåäö]+(?![\p{L}\p{M}])/gu, "");
    t = t.replace(/(?<=\d\s?(?:kg|km|cm|mm|m))\s*:[a-zåäö]+(?![\p{L}\p{M}])/gu, "");

    // 8) THE APOSTROPHE GENITIVE (4 in the retained text; the `quote-letter` cell is 87). Finnish joins a
    //    case ending to a foreign name with an apostrophe — `Perrault’n`, `Renault'lla`, `Illinois’n` —
    //    and the apostrophe broke the token, leaving a bare stray consonant in the IPA (*perːɑu̯lt n*).
    //    ⚠ GUARDED ON A CONSONANT BEFORE IT, because Finnish uses the SAME mark for its own vowel-hiatus
    //    boundary — `raa'asti`, `vaa'an` — where gluing would create a spurious long vowel. Every corpus
    //    instance of the genitive joint follows a consonant and every hiatus mark sits between two
    //    identical vowels, so the guard is exact on this corpus and errs toward doing nothing.
    t = t.replace(/(?<=[bcdfghjklmnpqrstvwxz])['’](?=[a-zåäö]{1,4}(?![\p{L}\p{M}]))/giu, "");

    // 9) THE DECIMAL COMMA (430; 152 in the retained text) — the second-largest defect. `clausePunctuation`
    //    maps `,` to a pause, so `50,7 %` read *viisikymmentä [PAUSE] seitsemän*: a sentence break inside
    //    one number and no separator word at all.
    //
    //    ⚠ THE FRACTION KEEPS ITS DIGITS AND SO DOES THE INTEGER — the rule inserts ONE word and nothing
    //    else. That is what preserves the number–unit ADJACENCY the shared tier matches on (playbook step
    //    4's "units before decimals" coupling, and trap 14's last clause): `13,6 cm` becomes `13 pilkku
    //    6 cm`, so the tier still sees a digit against `cm` and reads *senttimetriä*. Wording the operand
    //    here would have silently dropped every unit after a decimal, which is the sv regression.
    //    The fraction is spaced digit-by-digit because that is how Finnish reads it — *kolme pilkku yksi
    //    neljä* — and because the corpus's places are 1×110, 2×36, 3×5, 4×1: nothing here wants a
    //    composed *sataneljäkymmentäyksi*.
    //
    //    AFTER steps 2–5, every one of which needs to see an unbroken digit run, and BEFORE the tier.
    t = t.replace(/(\d),(\d+)(?!\d)/gu, (_m, int: string, frac: string) =>
        `${int} ${DECIMAL_WORD} ${[...frac].join(" ")}`);

    // 10) DEGREES (17), BEFORE any rule that could claim the scale letter — `−34,3 °C` read the sign and
    //     the ring as silence and the ⟨C⟩ as a bare /k/. `astetta` is the corpus's own word (×2, in the
    //     climate sentences that also write `°C`), and it is right for the angle sense too: the corpus's
    //     bare `°` is a cylinder angle (`75°`), a solar elevation (`53,3°`) and a latitude (`60° ja 70°`),
    //     all of which Finnish calls *astetta*.
    //     ⚠ THE ARC-MINUTE `′` IS LEFT ALONE — 4 instances, all inside coordinates (`45°28′N`,
    //     `71° 8′ N`), where the direction letter is also unread. Reading the ring without the tick
    //     improves the degree and leaves that pre-existing gap exactly as it was rather than half-closing
    //     it (trap 53: refuse the whole match, never half of it).
    t = t.replace(/℃/gu, "°C").replace(/℉/gu, "°F");
    t = t.replace(/(\d)\s*°\s*C(?![\p{L}\p{M}])/gui, "$1 astetta");
    t = t.replace(/(\d)\s*°\s*F(?![\p{L}\p{M}])/gui, "$1 astetta fahrenheitia");
    t = t.replace(/(\d)\s*°/gu, "$1 astetta");

    // 11) THE MINUS AND PLUS SIGNS. The FLEET SHAPE, and the width is a MEASUREMENT rather than a habit
    //     (trap 24, run in the direction that BREAKS a refusal). A first draft required a following
    //     degree word, on the reasoning that every corpus negative is a temperature. Re-measured, the
    //     plain `(^|[\s(])[-−+](\d)` shape over the retained text scores:
    //
    //         minus   3 matches — ` −2 °C`, ` −34,3 °C`, ` –6 °C`   3 TRUE, 0 FALSE
    //         plus    1 match   — ` +33,2 °C`                       1 TRUE, 0 FALSE
    //
    //     Zero false positives, because a Finnish RANGE always has a digit immediately left of its dash
    //     (`1994–1997`, `(175–11)`, `20.–24.`) and the clause dash is always followed by a space and a
    //     capital (`2. joulukuuta – Pohjois-Korea`). The narrow guard bought nothing and cost a bare
    //     `-5`, so the wider rule stands. Both words are referee lemmas and `miinus` is attested ×53/19
    //     on the wiki as the SIGN ("Miinus (−), vähennyslaskun merkki").
    //
    //     ⚠ THE PLUS IS ARGUED SEPARATELY AND NEVER ON THE MINUS'S CITATION (the hi mistake). Omitting a
    //     plus is lossless and omitting a minus INVERTS, so the minus is the one that MUST be read; the
    //     plus is read because Finnish weather register says it aloud (*plus kolmekymmentäkolme*) and
    //     because `UTC+1` is contentful, not because the minus needed it.
    //     The third arm is the INFIX plus — `paikkamääräänsä (156+27)`, a seat gain, ×1.
    t = t.replace(/(?<![\p{L}\p{M}\d])[-−–](?=\d)/gu, "miinus ");
    t = t.replace(/(?<![\p{L}\p{M}\d])\+(?=\d)/gu, "plus ");
    t = t.replace(/(?<=\d)\s*\+\s*(?=\d)/gu, " plus ");

    // 11b) THE RELATIONAL SIGNS — ×0 in this corpus, read anyway, because a DROPPED sign is inaudible and
    //     inaudible is the one outcome that cannot be right for arbitrary input. None can misfire: none
    //     of these characters is a Finnish letter. Both words come from the same fi.wikipedia article,
    //     which NAMES THE SIGN BESIDE THE WORD — "Merkintä a < b tarkoittaa a on pienempi kuin b ja
    //     merkintä a > b tarkoittaa…" (`pienempi kuin` ×21/12, `suurempi kuin` ×24/14), and
    //     `yhtä suuri kuin` ×50/20 comes from the equality and inequality articles ("a on pienempi tai
    //     yhtä suuri kuin b"). Sense read in every case.
    //
    //     ⚠ TWO SIGNS ARE REFUSED HERE, and both refusals are findings rather than gaps:
    //     `÷` — Finnish puts the divisor in the ADESSIVE, and the attestation itself shows it: every
    //           `jaettuna` hit in the maths sense is *jaettuna yhdellä*, *jaettuna itsellään*, *jaettuna
    //           2π:llä*. `6 ÷ 3` would have to be *kuusi jaettuna kolmella*, and this file's operands are
    //           DIGITS (trap 14) — the case cannot be applied. Emitting *jaettuna kolme* would be
    //           ungrammatical, so the sign stays silent and `review.ts` stays red on `divide`.
    //     `±` — `plusmiinus` reports "attested ×3/3" and ALL THREE are the ICE-HOCKEY statistic
    //           (`plusmiinus-tilasto`, `plusmiinus-sarakkeen näyttäessä nollaa`), a column name rather
    //           than a reading of the sign. Trap 37 / the Fula lesson, with a healthy count on the wrong
    //           slot; ± is ×0 in this corpus, so there is nothing pressing the question either.
    t = t.replace(/=/gu, " yhtä suuri kuin ").replace(/</gu, " pienempi kuin ").replace(/>/gu, " suurempi kuin ");

    // 12) THE AMPERSAND (67) — dropped outright today, so `Robinson & Cook` ran the two names together
    //     with no separation at all. Spaced on both sides, always, or `B&B` fuses into one token (the
    //     merge defect of traps 18/26). `ja` is the language's conjunction, ×717 in the corpus.
    t = t.replace(/&amp;/gu, "&").replace(/\s*[&＆]\s*/gu, " ja ");

    // The insertions above pad with spaces so a word never fuses with its neighbours; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}

/**
 * THE INITIALISM PASS (1,007 instances — the third-largest class, and the one that produced the worst
 * readings): `CIA:n` → *kiɑ , n*, `BKT:sta` → *bkt , stɑ*, `IUCN` → *iu̯kn*, and `MM-kilpailuissa` →
 * *mː kilpɑi̯lui̯sːɑ*, where this engine's gemination rule turned two letters into one long /mː/.
 *
 * ⚠ ORDERING, VERIFIED END-TO-END RATHER THAN ASSERTED (trap 16). It runs AFTER `normalizeFinnish`, so
 * the abbreviation dots are already spent (`V.` is *vuonna*, not VEE) — and after the shared ROMAN pass,
 * which is not in this file at all: Finnish is NOT in `registry.ts`'s `ROMAN_NATIVE`, so `normalizeRomans`
 * wraps `engine.text()` and `Filipp II:n` is `2:n` by the time anything here sees it. A test pins that
 * through the real phonemizer with `XV`, whose letters would be spelled if the order were wrong.
 */
export function normalizeFinnishInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => LETTER_NAME[l],
        acronymLetters: ACRONYM_LETTERS,
        // Finnish has no in-engine pronunciation dictionary — the grapheme table is context-free and the
        // referee is an evaluation set, not a lookup — so, as in sv/de/nl, every lexical fact lives in
        // ACRONYM_LETTERS above.
        isRecorded: () => false,
        isUnreadable: isUnreadableFinnish,
    })(resolveColonInflection(text));
}

/**
 * THE COLON ON AN INITIALISM (~54 of the 78 colon instances) — `BKT:sta`, `YK:n`, `EU:n`, `AHL:ssä`,
 * `CIA:n`, `V70:n`. Unlike the digit and symbol forms (step 6), this one is fully resolvable and needs no
 * morphology at all: the suffix attaches to the SPOKEN form, whose last word is a letter name, so
 * `CIA:n` is *see ii aan* and `BKT:sta` is *bee koo teesta*. Gluing the written suffix verbatim is
 * deliberate — Finnish standard puts the ending's vowel harmony on the pronounced form and writers vary,
 * so reproducing what was typed is the honest reading rather than a harmony the text did not choose.
 *
 * A head that is NOT spelled out (a readable acronym like `Nasa:n`, or a mixed-case name) simply loses
 * its colon and keeps its word, which is the same repair step 6 makes for the digit forms.
 */
function resolveColonInflection(text: string): string {
    return text.replace(
        /(?<![\p{L}\p{M}])(\p{Lu}[\p{L}\p{M}\d]*):([a-zåäö]+)(?![\p{L}\p{M}])/gu,
        (_m, head: string, suf: string) => {
            const glued = `${head}${suf}`;
            if (!/^\p{Lu}{2,}$/u.test(head)) return glued;
            const lower = head.toLowerCase();
            if (!ACRONYM_LETTERS.has(lower) && !isUnreadableFinnish(lower)) return glued;
            const letters = [...lower];
            const names = letters.map((l, i) =>
                // The LAST letter takes the suffix, so it must end in a vowel — see LETTER_NAME_LONG.
                i === letters.length - 1 ? (LETTER_NAME_LONG[l] ?? LETTER_NAME[l]) : LETTER_NAME[l]);
            return names.every((n) => n !== undefined) ? `${names.join(" ")}${suf}` : glued;
        },
    );
}
