/**
 * Hungarian (hu) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is not already a
 * pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * MEASURED OVER THE 1,995 UNIQUE hu_hu FLEURS UTTERANCES (column 3, the cased one):
 *   hyphen-attached case suffix on a NUMERAL  ×166  (1848-ban, 1970-es, szeptember 17-én, 11:35-re, 12-kor)
 *   bare `N.`                                 ×80   (see the tabulation below — 60 of them ordinals)
 *   hyphen-attached suffix on an ACRONYM      ×18   (GPS-hez, FBI-nak, GDP-je, DNS-ét, ENSZ-tagország)
 *   all-caps initialisms                      ×~90 types (USA ×6, ENSZ ×6, UNESCO/MRI/GPS/FBI/DNS ×3 …)
 *   `/` compound units                        ×20 of 29 slashes (83 km/h, 133 m/s, 600Mbit/s, 105 mérföld/óra)
 *   ranges / scores                           ×27   (1644-1912, 35–40, 6-6, 5-3-as) — deliberately left
 *   unit abbreviations                        km ×26, mm ×8, m ×3, kg ×2, km² ×2, cm ×1
 *   space-grouped thousands ×14, dot-grouped ×7 (+1 written `400. 000`), comma-grouped ×3 (an English leak)
 *   comma decimals ×16, clock ×17, `%` ×8 (every one of them `N%-suffix`), `°` ×3, `+` ×3, `×` ×1
 *   dotted abbreviations  pl. ×7, Dr. ×6, stb. ×5, kb. ×5, Kr.e. ×3, i.sz. ×2, Kr. u. ×1, d.e. ×1, ld. ×1
 *
 * WHAT WAS BROKEN, verbatim from the pre-change engine:
 *   `A 19. században`  → `ˈtizɛŋkilɛnt͡s . ˈsaːzɒdbɒn`   cardinal + a spurious PHRASE BREAK
 *   `1848-ban`         → `ˈɛzɛrɲold͡ʒzaːz… ˈbɒn`         the suffix split off as its own STRESSED word
 *   `100.000 taínó`    → `ˈsaːz . ˈnulːɒ ˈtɒiːnoː`       grouping dot → a pause, and `000` → *nulla*
 *   `30 000 ember`     → `ˈhɒrmint͡s ˈnulːɒ ˈɛmbɛr`      space grouping → *harminc nulla*
 *   `10:00 és 11:00`   → `ˈtiːz , ˈnulːɒ ˈeːʃ …`         the colon became a COMMA PAUSE
 *   `3,5 méter`        → `ˈhaːrom , ˈøt`                 the decimal comma became a COMMA PAUSE
 *   `a 25 %-a`         → `ˈɒ ˈhusonøt ˈɒ`                the `%` DROPPED outright
 *   `120 km/h`         → `ˈsaːzhuːs ˈkm ˈh`              unit + rate read as raw consonant clusters
 *   `25 °C`            → `ˈhusonøt ˈt͡s`                  ° dropped, C read as Hungarian ⟨c⟩
 *   `a GPS-hez`        → `ˈɒ ˈkpʃ ˈhɛz`                  a vowelless cluster (and G devoiced before P)
 *   `az FBI-nak`       → `ˈɒz ˈvbi ˈnɒk`                 F VOICED to [v] before B — a nonsense word
 *   `a GDP-je`         → `ˈɒ ˈktp ˈjɛ`
 *   `pl. édesség`      → `ˈpl . ˈeːdɛʃːeːɡ`              unreadable cluster + a phrase break
 *
 * THE ORDINAL DETECTOR IS BUILT FROM THE CORPUS. Hungarian writes the ordinal as a numeral plus a PERIOD
 * (`19. század`), and a regex cannot tell that from a sentence-final digit. Tabulating ALL 80 bare `N.`:
 *   LOWERCASE WORD AFTER ×59 — and every one is an ordinal or a date. 40 are ordinals proper (`század*`
 *     ×18, `évi` ×4, `helyet/helyezett`, `cikkelye`, `napján`, `bélyege`, `legnagyobb` ×2, `erősségű`,
 *     `huszárezred`, `számú`, `reaktorának`, `ábra`, `és`/`között` in a date range …); 19 are a YEAR
 *     followed by a month name, where Hungarian reads the year as a plain CARDINAL and the period is
 *     silent (`1759. szeptember 24-én` = *ezerhétszázötvenkilenc szeptember huszonnegyedikén*).
 *   COMMA AFTER ×1 — `a 11., 12. és 13. századokban`, an ordinal.
 *   DIGIT AFTER ×16 — dot-grouped thousands (`100.000`, `5.000.000`) and version/frequency codes
 *     (`802.11n`, `2.4Ghz`, `1.1. ábra`). Never an ordinal; step 2 de-groups the first kind and the
 *     lookarounds in step 9 refuse the rest.
 *   UPPERCASE WORD AFTER ×1 — `1. és 2. New Hampshire ezred`, which is ALSO an ordinal, so the corpus
 *     offers no counter-example to license claiming it; it is left alone anyway (see below).
 *   NOTHING AFTER ×2 — `…a görkorong és a Forma-1.` and `…rekordja 7 - 2.`. These are the sentence-final
 *     periods that must NOT be claimed.
 * So the rule is: `N.` is an ordinal when it is followed by whitespace and a LOWERCASE letter, or by a
 * comma. ZERO SENTENCE-FINAL PAUSES ARE LOST — both sentence-final instances (2 of 2) fail the lookahead,
 * as does every uppercase-initial continuation. Unlike German this needs no licensing article, and unlike
 * Turkish it needs more than "another token follows": Hungarian starts sentences with a capital, so
 * "lowercase follows" is a *stronger* signal than "anything follows", and it is what makes the rule safe
 * for the 1 uppercase case as well — that one ordinal is knowingly given up so that a numeral ending a
 * sentence before a capitalised next sentence can never be swallowed.
 *
 * MEASURED OVER THE WHOLE CORPUS AFTER THE CHANGE: 355 of 1,995 utterances differ. Periods went from
 * 2,373 to 2,254 — **119 removed, every one of them interior**, and the count of periods that end a
 * sentence (end of input, or before a capitalised word) is UNCHANGED except for 11 abbreviation dots that
 * are meant to go (`Dr.` ×6 and the personal initials `W.`/`F.`/`B.`/`N.`). ZERO SENTENCE-FINAL PAUSES
 * LOST. Spurious *nulla* from a grouping separator went from 19 to 4, and the 4 survivors are one real
 * *nulla* plus the dot-decimal `5.0Ghz` case below.
 *
 * VOWEL HARMONY COSTS NOTHING HERE, and that is worth stating because it looks like it should. Hungarian
 * chooses `-ban`/`-ben`, `-án`/`-én`, `-ra`/`-re` by the harmony of the SPOKEN numeral, and the
 * orthography already writes the chosen form after the hyphen (`1848-ban`, `1970-es`, `március 18-án`).
 * Plain concatenation onto the spoken numeral is therefore correct and no harmony is computed — the same
 * result Turkish reached from its apostrophe suffixes. The one place harmony IS computed is the bare
 * date nominative (`augusztus 24.` → *huszonnegyedike* but `március 3.` → *harmadika*), where nothing is
 * written to copy; see `dateNominative`.
 *
 * DELIBERATELY LEFT (see the commit message):
 *   ranges / scores ×27 — `1644-1912`, `35–40`, `6-6`, `26-00`. The dash is dropped today, which is
 *     harmless; Hungarian reads a range with `-tól …-ig` and a score with a bare juxtaposition, and
 *     nothing in the corpus distinguishes them. A wrong connective is worse than no connective.
 *   `×` ×1 — `56 × 56 mm`. The Hungarian reading attaches `-szor/-szer/-ször` under three-way harmony to
 *     the first numeral; building that machinery for a single instance is not worth the surface it adds.
 *   `2` → *kettő* before a counted noun, where Hungarian wants the attributive *két* (`32%-kal` =
 *     *harminckét százalékkal*). Fixing it needs a noun test this layer has no business owning; the
 *     lexeme is right and only its attributive form is not. Reported, not worked around.
 *   the DOT decimal `2.4Ghz` / `5.0Ghz` ×2 (one utterance) and the ratio `3:2-re` ×1 — an English-style
 *     decimal point and a colon ratio. Both keep a pause today. Claiming `\d\.\d` as a decimal would
 *     collide with the version codes `802.11a/b/g/n` in the very same corpus, and `Ghz`/`Mhz` are not in
 *     `units` because only the one utterance attests them.
 *   the REGNAL Roman numeral (`II. Erzsébet`, `XVI. Lajos` — 3 instances). See romanOrdinals.ts: the
 *     licence that fixes them also makes core/roman.ts read the `C` of `39C` as a numeral.
 *   `-al`/`-el` written after a numeral ×2 (`2.243-al`, `4x4-el`) — the standard forms are `-mal`/`-tel`
 *     with assimilation, so concatenation gives *hárommal* → *háromal*. The orthography is the writer's
 *     shorthand and the alternation would have to guess which it meant.
 *   currency — the corpus contains NO currency sign at all (dollár/font/euró are always spelled out), so
 *     no currency data is declared. Inventing signs I have no corpus evidence for is exactly the
 *     "confidently wrong" failure the playbook warns about.
 *   readable-but-letter-spelled acronyms — AOL ×3, CEP ×3, HIV, SUV, IP, UCLA, USOC, USAF. The
 *     phonotactic OOV test lets them through as words because they ARE syllabifiable; whether Hungarian
 *     spells each of them out is a lexical fact I could not source per token, and `acronymLetters` is
 *     where it would go if I could. `WC` is the one exception, because *vécé* is a dictionary word.
 *
 * ⚠ THE MULTIPLICATION SIGN IS A VOWEL-HARMONIC SUFFIX HERE, NOT A WORD, and #586 leaves it UNSHIPPED for that
 * reason rather than for want of evidence. The corpus writes `6 x 6 cm-es formátumot, egészen pontosan 56 × 56
 * mm-es` — note BOTH spellings in one sentence, the ASCII `x` and U+00D7 — and the sign is dropped, so the
 * dimensions read as bare numbers.
 * The reading is settled: facebook/wav2vec2-xlsr-53-espeak-cv-ft over hu_hu/train gives
 *     `… f iː l m k ɔ m ɛ r ɔ  h ɔ t s oː r  h ɔ t  ts ɛ n t i m eː ɾ t ə …`      hatszor hat centiméter
 *     `… ɔ n y t v ɛ n  h ɔ t s oː r  y t v ɛ n h ɔ t  m i l i m eː t ə r …`      ötvenhatszor ötvenhat milliméter
 * So `×` is the multiplicative -szor/-szer/-ször FUSED ONTO THE FIRST NUMERAL, and which allomorph appears
 * depends on that numeral's vowels (hat→hatszor, öt→ötször, kettő→kétszer). That needs the number words plus
 * harmony, not a string substitution — the same shape `attachSuffix` handles for apostrophe suffixes — so it is
 * a separate change and is recorded here so the next pass does not re-derive the sourcing.
 */
import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { multiplicativeWords, numberToWords, ordinalWords, stemForSuffix } from "./numbers.ts";

const LOWER = "a-záéíóöőúüű";

/** The twelve month names, matched case-insensitively and UNANCHORED at the end — Hungarian agglutinates
 *  onto them (`szeptemberében`, `augusztusban`). Used by three rules; see steps 9a/9b/10a. */
const MONTH =
    "(?:janu[áa]r|febru[áa]r|m[áa]rcius|[áa]prilis|m[áa]jus|j[úu]nius|j[úu]lius|augusztus|szeptember|okt[óo]ber|november|december)";

/** Dotted abbreviations → the spoken words. Counts are corpus counts. Every one of these previously left
 *  its interior dot behind as a phrase break, and `pl.`/`kb.`/`stb.` additionally reached the g2p as an
 *  unreadable consonant cluster. `stb.` is given as *satöbbi*, the dictionary-recorded single-word
 *  reading, so it carries one stress rather than three. */
const DOTTED_ABBREV: Readonly<Record<string, string>> = {
    "pl": "például", // ×7
    "kb": "körülbelül", // ×5
    "stb": "satöbbi", // ×5
    "ld": "lásd", // ×1
    "dr": "doktor", // ×6 (written `Dr.`)
};
const ABBREV_ALT = Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|");

/** Hungarian letter names (the traditional alphabet naming used when spelling an acronym: *gé-pé-es*,
 *  *ef-bé-í*, *á-bé-cé*). Vowels take their LONG name, which is what `USA`→*u-es-á* and `ABC`→*ábécé*
 *  show. `q/w/x/y` are the "foreign" letters but do have established names, so they are included. */
const LETTER_NAME: Readonly<Record<string, string>> = {
    a: "á", "á": "á", b: "bé", c: "cé", d: "dé", e: "é", "é": "é", f: "ef", g: "gé", h: "há",
    i: "í", "í": "í", j: "jé", k: "ká", l: "el", m: "em", n: "en", o: "ó", "ó": "ó", "ö": "ő",
    "ő": "ő", p: "pé", q: "kú", r: "er", s: "es", t: "té", u: "ú", "ú": "ú", "ü": "ű", "ű": "ű",
    v: "vé", w: "dupla vé", x: "iksz", y: "ipszilon", z: "zé",
};

/**
 * Hungarian DIGRAPHS folded to one stand-in letter before the phonotactic test. Without this the test
 * counts letters where the orthography spells single consonants, and `ENSZ` (letters e-n-s-z) looks like
 * a three-consonant run and would be spelled out — where Hungarian reads it as the word *ensz*. The fold
 * models exactly what the g2p will do with the same string, which is what makes it the right input to a
 * "could this be read as a word" question.
 */
const DIGRAPH = /dzs|sz|zs|cs|gy|ny|ty|ly|dz/gu;
const DIGRAPH_FOLD: Readonly<Record<string, string>> = {
    dzs: "z", sz: "s", zs: "z", cs: "c", gy: "g", ny: "n", ty: "t", ly: "j", dz: "z",
};
const fold = (w: string): string => w.replace(DIGRAPH, (d) => DIGRAPH_FOLD[d]!);

/** Hungarian phonotactics, for the OOV rule in core/initialisms.ts. Native Hungarian words admit NO
 *  initial cluster; the onsets listed are the ones loanwords brought in. Applied to the digraph-folded
 *  form (see `fold`). */
const unreadableFolded = makeUnreadableTest({
    vowels: /[aáeéiíoóöőuúüű]/u,
    legalOnsets: new Set([
        "bl", "br", "cl", "cr", "dr", "dv", "fl", "fr", "gl", "gn", "gr", "hr", "kl", "kn", "kr",
        "kv", "kw", "pl", "pn", "pr", "ps", "sc", "sf", "sk", "sl", "sm", "sn", "sp", "sr", "st",
        "sv", "sw", "tr", "tv", "tw", "vl", "vr", "zl", "zn", "zv",
    ]),
    legalCodas: new Set([
        "ct", "ft", "js", "jt", "kk", "ks", "kt", "lb", "lc", "ld", "lf", "lg", "lj", "lk", "lm",
        "ln", "lp", "ls", "lt", "lz", "mb", "mp", "ms", "nc", "nd", "ng", "nj", "nk", "ns", "nt",
        "nz", "ps", "pt", "rb", "rc", "rd", "rf", "rg", "rj", "rk", "rl", "rm", "rn", "rp", "rs",
        "rt", "rz", "sk", "sp", "st",
    ]),
});
export const isUnreadableHungarian = (word: string): boolean => unreadableFolded(fold(word.toLowerCase()));

/** Letter-by-letter reading, or undefined if any character has no Hungarian letter name — the caller then
 *  leaves the token alone rather than emitting a partial reading. Mirrors core/initialisms.ts's own
 *  `spellOut`, which is private to it. */
function spellOut(acr: string): string | undefined {
    const names = [...acr.toLowerCase()].map((c) => LETTER_NAME[c]);
    return names.every((n) => n !== undefined) ? names.join(" ") : undefined;
}

/** LEXICAL overrides: acronyms whose Hungarian reading is neither "spell the letters" nor "read as a
 *  word". `WC` is *vécé*, a dictionary-recorded Hungarian word — the letter names would give the
 *  three-word *dupla vé cé*. Sourced, not guessed; nothing else in the corpus needed an entry. */
const ACRONYM_WORD: Readonly<Record<string, string>> = { WC: "vécé" };

/** Hungarian has no pronunciation dictionary here (the g2p is rule-based), so nothing is "recorded" and
 *  the decision rests on the phonotactic OOV test alone. `acronymLetters` is empty on purpose — see the
 *  header on AOL/CEP/HIV/SUV. */
const normalizeInitialisms = makeInitialismNormalizer({
    letterName: (l) => LETTER_NAME[l],
    acronymLetters: new Set<string>(),
    isRecorded: () => false,
    isUnreadable: isUnreadableHungarian,
});

/**
 * Unit and percent words. NO count agreement: a Hungarian numeral takes the SINGULAR noun (*öt
 * kilométer*, *nyolc százalék*), so every `CountForms` here is a one-element array and the default
 * `countForm` collapses onto it.
 *
 * `unitPer: "per"` is the ordinary Hungarian rate idiom (*kilométer per óra*). The exponent is a
 * COMPOUND PREFIX — *négyzetkilométer*, *köbméter*, one word — which is the `compound` position the
 * Swedish/Japanese case introduced; `after` would give the non-word *kilométer négyzet*.
 *
 * `h`/`s`/`ó`/`óra`/`órás` are rate DENOMINATORS only. `s` in particular must never match standalone:
 * the corpus writes `802.11a`, `802.11b`, `802.11g` and a bare `s` unit would start biting into codes
 * like these — the hazard `rateDenominators` exists for.
 */
const normalizeSymbols = makeSymbolNormalizer({
    percent: ["százalék"],
    /**
     * CURRENCY (#584). `$5` read as bare *ˈøt* — the sign contributed nothing, which is worse than a wrong
     * word because nothing in the output marks the loss. hu_hu contains ZERO `$` against 57 `%`, so the
     * corpus-driven gate that caught the percent could not see this; the WORDS are nonetheless in that same
     * corpus, spelled out:
     *
     *   dollár  ×6   "11,000 és 22,500 amerikai dollár közötti áron"
     *   font    ×10  "hivatalos pénzneme a falklandi font (FKP)"
     *
     * ONE FORM EACH, because Hungarian takes the SINGULAR after a numeral (öt dollár, not *öt dollárok).
     *
     * `euró` and `jen` are DELIBERATELY ABSENT: both are 0 in the corpus under a token test, and espeak's
     * apparent hits are substring noise (`jen` inside *érjen*, `font` inside *fontos* — the latter is why the
     * first substring count read 211 for a word that occurs 10 times). An unsourced currency word is left
     * unread rather than guessed.
     */
    currency: { $: ["dollár"], "£": ["font"] },
    units: {
        km: ["kilométer"], m: ["méter"], cm: ["centiméter"], mm: ["milliméter"],
        kg: ["kilogramm"], "mérföld": ["mérföld"], mbit: ["megabit"],
    },
    unitPer: "per",
    rateDenominators: { h: "óra", s: "másodperc", "ó": "óra", "óra": "óra", "órás": "órás" },
    exponentWords: { squared: ["négyzet"], cubed: ["köb"], position: "compound" },
});

/** Unit abbreviations that may carry a hyphen-attached suffix directly (`km-re`, `mm-es`, `km²-en`).
 *  `g` is deliberately ABSENT: the corpus's only `g-vel` is `802.11g-vel`, the WiFi standard, and
 *  reading it as *grammal* would be confidently wrong. */
const SUFFIXABLE_UNIT: Readonly<Record<string, string>> = {
    km: "kilométer", mm: "milliméter", cm: "centiméter", kg: "kilogramm", "mérföld": "mérföld",
};
const UNIT_ALT = Object.keys(SUFFIXABLE_UNIT).sort((a, b) => b.length - a.length).join("|");

/** Attach a suffix to the LAST word of a spoken numeral, applying the stem shortening a vowel-initial
 *  suffix triggers (`2022-es` → *kétezerhuszonkettes*, `1907-es` → *…hetes*; see numbers.ts). The split
 *  matters only at the millió/milliárd boundary, the one place `numberToWords` emits a space. */
function attachSuffix(words: string, suffix: string): string {
    const parts = words.split(" ");
    parts[parts.length - 1] = stemForSuffix(parts[parts.length - 1]!, suffix) + suffix;
    return parts.join(" ");
}

/**
 * The bare DATE NOMINATIVE — `augusztus 24.` → *huszonnegyedike*, `március 3.` → *harmadika*. This is the
 * one place the layer must compute vowel harmony itself, because nothing is written after the numeral to
 * copy from. The linking vowel is chosen by the vowel immediately before the ordinal's `-dik`: a BACK
 * vowel there takes `-a` (harmad·ik → harmadika, hatod·ik → hatodika, husza·dik → huszadika), a FRONT
 * one takes `-e` (ötöd·ik → ötödike, hetedik → hetedike, tizenkilencedik → tizenkilencedike). Day 1 is
 * suppletive: *elseje*, not *elsőe*.
 */
const BACK_VOWEL = /[aáoóuú]/u;
function dateStem(n: number): string | undefined {
    if (n === 1) return "elsej"; // elseje, elsején, elseji
    const ord = ordinalWords(n);
    return ord === undefined ? undefined : ord;
}
function dateNominative(n: number): string | undefined {
    const stem = dateStem(n);
    if (stem === undefined) return undefined;
    if (n === 1) return "elseje";
    const link = BACK_VOWEL.test(stem.slice(0, -3).slice(-1)) ? "a" : "e"; // the vowel before -dik
    return stem + link;
}

/** Date suffixes written after the hyphen on a day number (`17-én`, `1-jén`, `11-e`, `4-i`). They attach
 *  to the ORDINAL stem, not the cardinal: `szeptember 17-én` is *szeptember tizenhetedikén*, never
 *  *tizenhétén*. The `j-` forms belong to day 1's suppletive stem *elsej-* and are folded onto it. */
const DATE_SUFFIX = /^(j?[áé]n|je|jei|ei|e|i)$/u;

/**
 * Normalize one Hungarian input string. Pure text→text; the numbered steps are ORDER-DEPENDENT and each
 * coupling is stated where it applies.
 */
export function normalizeHungarian(input: string): string {
    let s = input;

    // 1) DOTTED ABBREVIATIONS, multi-dot before single-dot so an interior dot cannot survive as a phrase
    //    break, and before the initialism pass (step 11) which would otherwise spell `Kr` as *ká er*.
    //    Boundaries are explicit lookarounds, never `\b` — `\b` is ASCII-defined and finds no boundary
    //    against á/é/í/ó/ö/ő/ú/ü/ű.
    // THE DIMENSION `×` → THE MULTIPLICATIVE, sourced from the corpus's own audio. The corpus writes
    // `6 x 6 cm-es formátumot, egészen pontosan 56 × 56 mm-es` — ⚠ BOTH SPELLINGS IN ONE SENTENCE, the ASCII
    // `x` and U+00D7, which is an internal control rather than a typo — and the sign was DROPPED, so the
    // dimensions read as two bare numbers.
    // facebook/wav2vec2-xlsr-53-espeak-cv-ft (a PHONEME recognizer: no `×` and no digits in its vocabulary)
    // over hu_hu/train:
    //   `… f iː l m k ɔ m ɛ r ɔ  h ɔ t s oː r  h ɔ t  ts ɛ n t i m eː ɾ t ə …`   hatszor hat centiméter
    //   `… ɔ n y t v ɛ n  h ɔ t s oː r  y t v ɛ n h ɔ t  m i l i m eː t ə r …`   ötvenhatszor ötvenhat milliméter
    // So the sign is not a WORD here but a SUFFIX on the FIRST operand, which is why this emits the first
    // number as words and leaves the second as digits for the tokenizer. See `multiplicativeWords` for why the
    // allomorph is a table and not a harmony rule (`harminc` → harmincszor is anti-harmonic).
    // Digit-flanked on both sides, which keeps an ordinary letter `x` and any algebraic use out of it.
    // ⚠ THREE THINGS THE LOOKBEHINDS EXCLUDE, all found by probing the rule's neighbours rather than by
    //   inspection. `(?<![\d.,])` alone was not enough:
    //     `1 000 x 2`  Hungarian groups thousands with a SPACE, so the bare guard matched `000 x` and gave
    //                  *1 nullaszor 2* — the thousand split apart. Hence `(?<!\d[ .,])`, which rejects a
    //                  digit-then-separator while still allowing the ordinary leading space in `kamera 6 x 6`.
    //     `6-8 x 10`   a RANGE's second operand became the base: *hatnyolcszor 10*. Hence `-` in the class.
    //   `{1,6}` caps the operand so a 15-digit run falls through untouched rather than through numberToWords.
    s = s.replace(/(?<![\d.,\-])(?<!\d[ .,])(\d{1,6})\s?[x×]\s?(?=\d)/gu, (m0, n: string) => {
        const w = multiplicativeWords(Number(n));
        return w === undefined ? m0 : `${w} `;
    });

    s = s.replace(/(?<![\p{L}\p{M}])Kr\.\s?e\./giu, "Krisztus előtt"); // ×3
    s = s.replace(/(?<![\p{L}\p{M}])Kr\.\s?u\./giu, "Krisztus után"); // ×1
    s = s.replace(/(?<![\p{L}\p{M}])i\.\s?sz\./giu, "időszámításunk szerint"); // ×2
    s = s.replace(/(?<![\p{L}\p{M}])i\.\s?e\./giu, "időszámításunk előtt"); // 0 in corpus; the pair of i.sz.
    s = s.replace(/(?<![\p{L}\p{M}])d\.\s?e\./giu, "délelőtt"); // ×1
    s = s.replace(/(?<![\p{L}\p{M}])d\.\s?u\./giu, "délután"); // 0 in corpus; the pair of d.e.
    //    The dot is consumed when the sentence continues, and kept at a phrase end where it really is the
    //    sentence period (`…, stb.`).
    //    A DIGIT counts as a continuation as well as a letter: `kb. 20 km-re` and `kb. 1000 körül` are the
    //    commonest shape of all, and a `(?=\p{L})` lookahead alone left them as the cluster [ɡb] + a pause.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(\\s+)(?=[\\p{L}\\d])`, "giu"),
        (_m, ab: string, sp: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}${sp}`);
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${ABBREV_ALT})\\.(?=\\s*(?:[.,;:!?»)\\]]|$))`, "giu"),
        (_m, ab: string) => `${DOTTED_ABBREV[ab.toLowerCase()]!}.`);

    // 2) DIGIT DE-GROUPING, FIRST among the number rules: a grouping period is otherwise read as clause
    //    punctuation AND the trailing `000` becomes its own numeral *nulla* (`100.000` → *száz . nulla*),
    //    and a grouping space fuses nothing at all (`30 000` → *harminc nulla*). Run before the ordinal
    //    detector in step 9, which would otherwise see `100.` as an ordinal.
    //    Hungarian groups with a SPACE or a PERIOD and takes the COMMA as its decimal mark — the opposite
    //    of the German/Dutch bug, and verified here rather than assumed: the corpus has 14 space-grouped
    //    and 7 dot-grouped thousands against 16 comma decimals.
    //    A COMMA followed by exactly three digits is the English convention leaking through the FLEURS
    //    translations (`100,000 ember`, `11,000 és 22,500 amerikai dollár` — 3 of 3 in the corpus are
    //    thousands, none is a decimal), so it is de-grouped too rather than read as *száz egész nulla*.
    for (let i = 0; i < 3; i++) { // repeat: 5.000.000 has two separators
        // THE TRAILING GUARD EXCLUDES A DECIMAL, NOT A CLAUSE MARK. `(?![\d.,])` refused to de-group a number
        // followed by its own sentence comma, so `24.000, és mások` read *huszonnégy . NULLA ,* — the group
        // split off, `000` spoken as zero, AND a spurious full stop. Hungarian marks the decimal with a
        // comma, so the mark is only a separator when a digit follows: `(?![\d]|,\d)`. Same defect the zu
        // and xh runs found in swahili/normalize.ts, which is where this guard shape came from.
        s = s.replace(/(\d)[.  ](\d{3})(?![\d]|,\d)/gu, "$1$2");
        s = s.replace(/(\d)\.[  ](\d{3})(?![\d]|,\d)/gu, "$1$2"); // the corpus's one `400. 000`
        s = s.replace(/(\d),(\d{3})(?![\d]|,\d)/gu, "$1$2");
    }

    // 3) CLOCK, before any rule can read the separator: the colon is clause punctuation and became a
    //    COMMA PAUSE inside `10:00`. The corpus writes the space form too (`11: 20-kor`, `8: 46-kor`), so
    //    the separator absorbs it. Zero minutes are dropped — Hungarian says *tizenegy óra*, not
    //    *tizenegy nulla nulla*. Output stays DIGITS so the number path expands them, and so step 10's
    //    suffix rule can still attach (`11:35-re` → `11 35-re` → *harmincötre*).
    //    Two-digit minutes are REQUIRED, which is what keeps the score `3:2-re` out of this rule.
    s = s.replace(/(?<![\d.,:])([01]?\d|2[0-3]):[  ]?([0-5]\d)(?![\d:])/gu,
        (_m, h: string, min: string) => (Number(min) === 0 ? h : `${h} ${min}`));

    // 4) UNIT ABBREVIATION + HYPHEN SUFFIX, BEFORE the shared symbol tier (step 6). The tier would
    //    otherwise claim `20 km-re` and leave `-re` stranded behind the substituted word, where the
    //    tokenizer drops the hyphen and *re* becomes its own stressed word.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(${UNIT_ALT})([²³23])?-([${LOWER}]+)`, "giu"),
        (whole, u: string, exp: string | undefined, suf: string) => {
            const head = SUFFIXABLE_UNIT[u.toLowerCase()];
            if (head === undefined) return whole;
            const pre = exp === undefined ? "" : exp === "³" || exp === "3" ? "köb" : "négyzet";
            return `${pre}${head}${suf}`;
        });
    //    The single-letter `m` needs a preceding NUMBER to be a unit at all (`2m-es`); bare `m-` is far
    //    likelier to be an initial or a typo than a metre.
    s = s.replace(new RegExp(`(\\d)\\s?m([²³23])?-([${LOWER}]+)`, "gu"),
        (_m, d: string, exp: string | undefined, suf: string) => {
            const pre = exp === undefined ? "" : exp === "³" || exp === "3" ? "köb" : "négyzet";
            return `${d} ${pre}méter${suf}`;
        });

    // 5) PERCENT + HYPHEN SUFFIX. Every one of the corpus's 8 percent signs carries a suffix (`29%-a`,
    //    `93%-ával`, `8%-kal`), so this must run before the shared tier in step 6 — the tier emits the
    //    bare noun and would strand the suffix exactly as step 4's units would.
    s = s.replace(new RegExp(`(\\d)\\s?[%٪％]-([${LOWER}]+)`, "gu"), "$1 százalék$2");

    // 6) SHARED SYMBOL TIER — %, units, rates (`km/h`), exponents (`km²`). Runs BEFORE the decimal
    //    rewrite in step 8: the tier matches a unit only when a NUMBER is adjacent, and turning `3,5` into
    //    *három egész öt* destroys that adjacency.
    s = normalizeSymbols(s);

    // 7) DEGREES and SIGNS. `°` was dropped outright and a trailing C was read as Hungarian ⟨c⟩ → [t͡s].
    //    The suffixed form (`35°-tól`, a longitude) is claimed FIRST, for the reason step 4 exists: the
    //    plain rule would emit *fok* and leave `-tól` to become its own stressed word.
    s = s.replace(new RegExp(`(\\d)\\s?°\\s?([CF])?-([${LOWER}]+)`, "gu"),
        (_m, d: string, scale: string | undefined, suf: string) =>
            `${d} ${scale === "C" ? "Celsius-" : scale === "F" ? "Fahrenheit-" : ""}fok${suf}`);
    s = s.replace(/(\d)\s?°\s?C(?![\p{L}\p{M}])/gu, "$1 Celsius-fok");
    s = s.replace(/(\d)\s?°\s?F(?![\p{L}\p{M}])/gu, "$1 Fahrenheit-fok");
    s = s.replace(/(\d)\s?°/gu, "$1 fok");
    s = s.replace(/(\S)\+\s?(\d)/gu, "$1 plusz $2"); // UTC+1
    s = s.replace(/(^|\s)\+\s?(\d)/gu, "$1plusz $2"); // "a + 30°C"

    // 8) DECIMALS. The comma was reaching `clausePunctuation` as a COMMA PAUSE mid-number. Hungarian says
    //    *egész* between the parts (*három egész öt*). The digits are LEFT AS DIGITS so the existing
    //    number path pronounces them — this layer has no reason to duplicate the compositor here.
    //    After step 2, any comma still sitting between digits is a decimal mark.
    s = s.replace(/(\d),(?=\d)/gu, "$1 egész ");

    // 9) ORDINALS. All three sub-rules license on "whitespace + a LOWERCASE letter" (or a comma); see the
    //    file header for the 80-instance tabulation and the zero-sentence-final-pauses-lost check.
    // 9a) YEAR + MONTH: the year is a plain CARDINAL and the period is silent — `1759. szeptember` is
    //     *ezerhétszázötvenkilenc szeptember*, NOT *ezerhétszázötvenkilencedik*. This must precede 9c,
    //     which would otherwise claim the same period as an ordinal marker. ×19.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d{1,4})\\.(\\s+)(?=${MONTH})`, "giu"), "$1$2");
    // 9b) MONTH + DAY: the bare date nominative — `augusztus 24. és` is *augusztus huszonnegyedike és*.
    //     ×2. Licensed by a following lowercase word so a date ending a sentence keeps its period.
    s = s.replace(new RegExp(`(${MONTH}\\p{L}*\\s+)(\\d{1,2})\\.(?=\\s+[${LOWER}])`, "giu"),
        (whole, pre: string, d: string) => {
            const w = dateNominative(Number(d));
            return w === undefined ? whole : `${pre}${w}`;
        });
    // 9c) THE GENERAL ORDINAL. The left lookbehind refuses a numeral that is itself preceded by a digit or
    //     a dot (`1.1. ábra`, `802.11a`); the lookahead refuses a digit, an uppercase continuation and the
    //     end of input. The period is CONSUMED — removing the spurious phrase break is half the fix.
    s = s.replace(new RegExp(`(?<![\\d.,])(\\d{1,4})\\.(?=\\s+[${LOWER}]|,)`, "gu"),
        (whole, d: string) => ordinalWords(Number(d)) ?? whole);
    // 9d) The period after a Roman-numeral ORDINAL WORD. `XIX. század` has already become
    //     `tizenkilencedik. század` by the time this runs (the shared roman pass in registry.ts rewrites
    //     before `text()`), and that period was surviving as a phrase break — the artefact
    //     romanOrdinals.ts records as needing "a Hungarian-side pre-pass that swallows the ordinal
    //     period". This is that pre-pass. Every Hungarian ordinal ends in `-dik` except *első*, and the
    //     same lowercase-continuation licence applies, so a sentence-final ordinal keeps its period.
    s = s.replace(new RegExp(`(?<=dik|első)\\.(?=\\s+[${LOWER}])`, "gu"), "");
    //     NOT extended to a CAPITALISED follower, though the regnal shape wants it: `II. Erzsébet`
    //     becomes *második. Erzsébet* and that period survives as a phrase break. Tried, and reverted.
    //     The guard would have to distinguish a regnal ordinal from a sentence that merely ENDS in an
    //     ordinal, and "something precedes it on the same line" does not: `Ez a második. Erzsébet jött`
    //     has exactly that shape and lost its sentence boundary.
    //
    //     THE CORPUS CANNOT SETTLE THIS, which is the point. Its census reported 0 terminal marks lost,
    //     but only 12% of hu_hu utterances contain a sentence boundary at all — FLEURS is largely one
    //     sentence per utterance — so the shape needs a boundary the corpus mostly does not have. And it
    //     is not contrived: Hungarian uses ordinals PREDICATIVELY (*a csapat lett a harmadik* — "the team
    //     came third"), so an ordinal-final sentence is ordinary prose. A spurious pause is not worth
    //     gambling a sentence boundary on evidence this corpus is structurally unable to provide.

    // 10) NUMERAL + HYPHEN SUFFIX → WORDS. LAST of the number rules, because it is the only one that
    //     leaves digits behind: steps 3–9 all need digits still present to match on. `1848-ban` was
    //     splitting into two stressed words; concatenation onto the spoken numeral gives one.
    //     The leading lookbehind refuses a digit glued to LETTERS (`802.11g-vel`, `4x4-el`, `km2-re`),
    //     which are codes and units, not numerals.
    // 10a) DATES take the ORDINAL stem: `szeptember 17-én` is *tizenhetedikén*, not *tizenhétén*. Gated on
    //      a preceding month name — all 32 date-suffixed numerals in the corpus have one, and the gate is
    //      what keeps an ordinary superessive on a cardinal out of the ordinal path.
    s = s.replace(new RegExp(`(?<=${MONTH}\\p{L}*\\s)(\\d{1,2})-([${LOWER}]+)(?![\\p{L}\\p{M}])`, "giu"),
        (whole, d: string, suf: string) => {
            if (!DATE_SUFFIX.test(suf)) return whole;
            const stem = dateStem(Number(d));
            if (stem === undefined) return whole;
            // day 1's stem is *elsej-*, so the written `j` of `1-jén` is already in the stem.
            return stem + (Number(d) === 1 ? suf.replace(/^j/u, "") : suf);
        });
    // 10b) Everything else concatenates onto the cardinal, which is correct because the orthography
    //      already wrote the harmonically-chosen form (`1848-ban`, `1970-es`, `36-an`, `1945-ig`).
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}\\d])(\\d+)-([${LOWER}]+)(?![\\p{L}\\p{M}])`, "gu"),
        (whole, d: string, suf: string) => {
            const n = Number(d);
            if (!Number.isSafeInteger(n)) return whole;
            const words = numberToWords(n);
            return /\d/u.test(words) ? whole : attachSuffix(words, suf);
        });

    // 11) ACRONYMS, LAST of the letter rules: after step 1 (else `Kr`/`ld` are spelled) and after the
    //     roman pass, which has already run in registry.ts — so `II. Erzsébet` is a numeral by now and
    //     can never be spelled EM-EM. Roman numerals need no sequencing here for that reason.
    // 11a) ACRONYM + HYPHEN SUFFIX (`GPS-hez`, `FBI-nak`, `GDP-je`) — the suffix belongs to the LAST
    //      letter name (*gé pé eshez*), so it is glued here rather than left for the tokenizer to drop
    //      the hyphen and emit it as its own stressed word. The word-vs-letters decision mirrors the
    //      shared pass's: spell only what could not be read as a word at all.
    s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])(\\p{Lu}{2,})-([${LOWER}]+)`, "gu"),
        (whole, acr: string, suf: string) => {
            const lexical = ACRONYM_WORD[acr];
            if (lexical !== undefined) return lexical + suf;
            if (!isUnreadableHungarian(acr)) return acr.toLowerCase() + suf;
            const spelled = spellOut(acr);
            return spelled === undefined ? whole : spelled + suf;
        });
    // 11b) The lexical overrides, before the shared pass can spell them out letter by letter.
    for (const [acr, word] of Object.entries(ACRONYM_WORD))
        s = s.replace(new RegExp(`(?<![\\p{L}\\p{M}])${acr}(?![\\p{L}\\p{M}])`, "gu"), word);
    s = normalizeInitialisms(s);

    return s;
}
