/**
 * Hakka Chinese / 客家話 (hak, Meixian 梅縣) text normalization — the pre-tokenizer pass that rewrites what is
 * not yet a pronounceable word into Han the dict already speaks. Pure text→text, no IPA.
 *
 * The SIXTH Sinitic layer, and the FIRST built ON `core/sinitic.ts` rather than extracted from its own
 * language. That was the point of the extraction: a module that only reproduces its own sources proves
 * nothing. Five of the eleven steps below are one call each, and every guard those calls carry — the
 * year-arm ordering, the slashed-year-pair, the dotted designation, `\s*` not `\s?`, `\p{sc=Latn}` not
 * `\p{L}` — arrived correct without being rediscovered here.
 *
 * ⚠⚠ READ THIS FIRST, BECAUSE IT BOUNDS EVERYTHING BELOW: **hak.wikipedia IS NOT WRITTEN IN HAN.** It is
 * written in **Pha̍k-fa-sṳ**, the missionary romanization — measured over the artifact's uniform-stride
 * sample tier, **93.5% of the characters are Latin** (26,173 Latin against 1,939 Han; 187 of 200 segments
 * Latin-dominant). And several of the Han-dominant segments are quoted CHINESE, not Hakka.
 *
 * The engine has no PFS front end. `registry.ts` routes every Latin run to ENGLISH, so
 * `Pak-khô-chhiòn-sû he tui Ngìn-lui…` currently reads *pʰˈæk khˈoᶷ kʃˈʌn sˈuː hˈiː t͡ʃˈʌwɪ nd͡ʒˈɪn lˈuːɪ…*
 * — the language's own encyclopedia, read as English. **That is an ENGINE gap, not a normalization gap**,
 * and it is deliberately NOT fixed here: it is a romanization front end (what `minnan.ts` has and this
 * language does not), sized and recorded in `docs/investigations/hak/hak_normalization_investigation.md`.
 *
 * ⚠ WHAT THAT MEANS FOR SCOPE, STATED ONCE AND APPLIED EVERYWHERE. This layer's job is the text that is not
 * a WORD in any orthography — digits, signs, marks. `ngie̍t` (月, ×1,126 after digits) and `ngit` (日, ×965)
 * ARE Hakka words; that this engine cannot read them is the engine's problem, so they are left alone. The
 * ONE exception is `ngièn` (年), and it is forced rather than chosen: **a year is read digit by digit and a
 * cardinal is not, so the rule must consume the 年 to know which it is looking at — and playbook trap 10
 * says a rule that consumes must put back.** The only form it can put back that SPEAKS is 年. Step 2.
 *
 * ⚠ AND IT MEANS THE PFS CORPUS IS AN UNUSUALLY GOOD SOURCING TIER, which is the compensation. A Han corpus
 * shows you the character; PFS shows you the SPOKEN SYLLABLE, so every word this file emits could be checked
 * against the dict reading AND against the corpus's own romanization of it. Four came out right:
 *
 *     摎  lau⁴⁴   ⟵ corpus `lâu` ×3,232      the conjunction — HAKKA'S OWN, not 和 (fo¹¹) and not wuu's 搭
 *     零下 laŋ¹¹ ha⁴⁴ ⟵ corpus `làng-hâ` ×2   the word for a NEGATIVE temperature, in the language's mouth
 *     攝氏 ŋiap̚¹ sz̩⁵³ ⟵ corpus `ngiap-shì`  Celsius, and it fixes the POSITION too (see step 5)
 *     公里 kʊŋ⁴⁴ li⁴⁴ ⟵ corpus `kûng-lî` ×2,051   the highest-traffic unit in the language
 *
 * ⚠ THE RANGE CONNECTIVE IS 至, AND HAK IS THE FIRST SINITIC LAYER WHERE IT IS. yue, wuu and cjy all ship 到.
 * Counted here: in the Han portion 至 ×19 against 到 ×4, and in PFS `chṳ` ×19 against `to` ×19 — a tie in
 * romanization broken decisively by the Han. Copying the sibling layers would have been wrong.
 *
 * ⚠ EVERY WORD THIS FILE EMITS MUST BE A `dict.tsv` KEY OR IT VANISHES — the shared Han engine skips an
 * uncovered character SILENTLY, so an unsourced word is not mispronounced, it is DELETED. All of them were
 * probed. One was missing and one only: ⟨度⟩, which is why `dict.PROVENANCE.md` now carries a derived-entries
 * section deriving it three ways. Still silent, and therefore still declined: ⟨減⟩, ⟨於/于⟩ (so 等於 emits one
 * syllable of two, exactly as in cjy), ⟨〇⟩.
 *
 * ⚠ `\b` IS NEVER USED — ASCII-defined, and finds no boundary against Han.
 *
 * Deliberately left alone, each with the measurement:
 *   · **LATIN INITIALISMS.** wuu and jv both rewrite `GDP` to Han letter names, on the argument that English
 *     letter names in English phonology inside a tonal utterance is nobody's reading. That argument does not
 *     transfer: here the SENTENCE AROUND the initialism is already being read as English, so spelling `GDP`
 *     in Han would fix three letters inside a paragraph of Anglicised Hakka. The 360 initialisms and 376
 *     letter-names are real and they are waiting on the PFS front end, not on this file. A validated refusal.
 *   · **THE CLOCK.** `clock: 794` is the cell's `[:.]` alternative, i.e. overwhelmingly decimals; a direct
 *     count of `\d{1,2}:\d{2}` over the whole dump gives **38**, and reading them shows most are BIBLE VERSE
 *     REFERENCES (`Pí-tet-chhièn-sû 5:13`, `Lie̍t-vòng-ki-song 11:26`, `Sṳ̂n-min-ki 14-Chông:7-8`) with the
 *     rest Japanese broadcast times (`21:00 - 21:54, JST`). Playbook trap 21: a filled cell is a lead. A
 *     colon rule would claim mostly what it must not.
 *   · **THE RELATIONAL AND ARITHMETIC SIGNS.** ⟨減⟩ is silent and ⟨於⟩ is silent, so 等於 can only say half of
 *     itself. And the signs would not repay it: the 19 `arithmetic` hits are LaTeX bodies and scientific
 *     notation whose superscript the dump stripped (`1.392×106`, `2×1030`, `5×1030`) — reading `×` there
 *     would say "times one hundred and six".
 *   · **`m` AS A UNIT KEY**, for the reason yue and wuu both give: a one-character unit in an unspaced script
 *     is inseparable from any name containing it. 公尺 is the word (corpus `kûng-chhak` ×26) and it is
 *     recorded here for whoever needs it; the SYMBOL stays unclaimed.
 *   · **CUBED.** ⟨立方⟩ speaks, and `li̍p-fông` occurs ZERO times in the corpus while `phiàng-fông` (平方)
 *     occurs 1,850. Squared is declared; cubed is not, on the same evidence that declares squared.
 *   · **⟨兩⟩ BEFORE A CLASSIFIER.** ⟨兩⟩ speaks here (unlike cjy, where it does not), but the classifier
 *     inventory that cmn/yue/wuu match on is a MANIFEST-level piece of language data this bring-up has not
 *     sourced, and guessing one is playbook trap 9.
 *
 * ⚠ A MEASURED RESIDUE, RECORDED RATHER THAN GUARDED. Of the 5,349 `NNNN-ngièn` in the dump, **5,344 are
 * ≤2100 and 5 are not** — `Sî-yèn-chhièn 5000 ngièn`, `8200-ngièn`, `8000-ngièn` — prehistoric spans that
 * Chinese reads as CARDINALS (五千年), not digit by digit. A `[12]\d{3}` guard would catch all five and cost
 * nothing measurable, and it is deliberately NOT added: `\d{4}年` in Han text has exactly the same 0.09%
 * exposure in yue, wuu and cjy, and forking the shared rule for one language would trade a uniform 0.09%
 * for four different rules. Stated so the next reader does not rediscover it as a bug.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, readDecimals, readDegrees, reorderFraction, spellYears } from "../../core/sinitic.ts";
import { rewrite } from "../../core/provenance.ts";

/**
 * ⚠ `unspacedScript`, because a sign in Han prose is flanked by Han and the tier's letter-boundary guard
 * would otherwise refuse it. It narrows the guard to `\p{sc=Latn}`, which is exactly right for a corpus that
 * is mostly Latin: a sign touching a PFS letter is still refused, a sign touching Han is not.
 * `percentPrefix` because 百分之 PRECEDES its number, as in every Sinitic variety — and here the corpus says
 * so in its own romanization: `pak-fûn-chṳ̂-sṳ̍p-ńg` for 15%, with 分之 (`fûn-chṳ̂`) attested ×39 in exactly
 * the reversed order the fraction rule needs (`sâm-fûn-chṳ̂-ngi` = 三分之二 = 2/3).
 *
 * `$` is the only currency sign the corpus writes (×5) and 美元 is its word (`mî-ngièn` ×52). Two of those
 * five instances are playbook trap 12 — `$600 Mî-ngièn`, `$78,154 Kâ-nâ-thai fo-pì` — the sign and its word
 * in the same phrase, where the correct reading says it once.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "摎",
    percent: ["百分之"],
    percentPrefix: true,
    units: { km: ["公里"], kg: ["公斤"] },
    exponentWords: { squared: ["平方"], position: "compound" },
    currency: { $: ["美元"] },
    unspacedScript: true,
});

/** The coordinate minute/second marks in every encoding the corpus writes — U+2032/U+2033 are canonical,
 *  the ASCII quotes are what wiki text mostly contains (`112°50'-114°45'`, `44°27'56″`, `27°58′38″`). */
const MINUTE = "[′´ˊ’']";
const SECOND = "[″〃”\"]";

/**
 * The right-hand context that licenses a numeric range. ⚠ THE GUARD IS THE WHOLE RULE — see step 7 — and it
 * is the one place this file must read PFS rather than only Han, because the unit that follows a Hakka range
 * is written in PFS 4 times out of 5. Reading a romanized word to make a DECISION is not the same as
 * emitting one; nothing below this line is ever produced.
 */
const RANGE_UNIT =
    "(?:%|‰|度|天|月|日|年|人|元|米|屆|亿|億|万|萬|公里|毫米|" +
    "k[ûu]ng-l[îi]|k[ûu]ng-chhak|k[ûu]ng-k[îi]n|m[íi]|ml|f[ûu]n-ch[ûu]ng|ng[ìi]n|[Cc]h[ôo]ng|ts[ôo]ng|chiet|tsiet)";

/**
 * Normalize one Hakka string. The steps are ORDER-DEPENDENT and each says what breaks if it moves.
 */
export function normalizeHakka(input: string): string {
    let s = input;

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and the most destructive number defect the engine has: the tokenizer splits `\d+`, so a
    // grouping comma is read as a clause PAUSE and the value is destroyed — `1,000人` read
    // *it̚˩ , laŋ˩˩ ŋin˩˩*, "one … zero people". `grouped: 1587` in the artifact, 2,211 over the whole dump.
    // Every later rule's "a digit is adjacent" test also needs the number to be one run.
    s = degroupThousands(s);

    // ── 2. the Pha̍k-fa-sṳ year morpheme → 年 ────────────────────────────────────────────────────
    // ⚠ THE LARGEST SINGLE SHAPE IN THE LANGUAGE, and it exists in no other Sinitic layer: **5,349
    // instances of `NNNN-ngièn`** over the dump, against 434 of the Han `NNNN年`. PFS writes the year with
    // the morpheme bound to the digits — `2005-ngièn`, `1996-ngièn 3-ngie̍t 28-ngit`.
    // ⚠ WHY THIS IS THIS LAYER'S BUSINESS AT ALL (see the header): a year is read DIGIT BY DIGIT and a
    // quantity is not, so the rule must consume the year morpheme to know which reading applies — and
    // trap 10 says a rule that consumes must put it back. 年 is the only form that speaks (ŋian¹¹, which is
    // exactly what PFS spells `ngièn`), so the put-back is also the fix: `2005-ngièn` was reading
    // *ŋi˥˧ t͡ɕʰiɛn˦˦ laŋ˩˩ n̩˧˩ nd͡ʒəˈiːn* — the cardinal 二千零五, then the morpheme in ENGLISH.
    // ⚠ THE SPACED FORM IS COUNTED TOO — playbook trap 15, and it is not hypothetical: `NNNN ngièn` ×169
    // (`1861-1865 ngièn`, `2017 ngièn`). Detaching a bound morpheme is a slip of the orthography.
    // ⚠ 1–3 DIGITS ARE FOLDED AS WELL (×1,344) AND THAT IS SAFE PRECISELY BECAUSE STEP 6 DECLINES THEM:
    // `30-ngièn nui` is a DURATION and `711-ngièn` a year, and nothing in the surface form separates them —
    // so both become `N年` and both get the CARDINAL, which is right for the duration and is the fleet's
    // standing refusal for the short year.
    // ⚠ THE LEFT GUARD IS WHAT KEEPS THE CURRENCY OUT. `mî-ngièn` is 美元, US dollars, ×52 — and it appears
    // right after four digits (`6210 mî-ngièn`, `20927 Mî-ngièn`). Requiring a DIGIT immediately before the
    // hyphen or space separates them, since those instances have `mî` there instead.
    // BEFORE step 6, which is the whole reason this runs: `spellYears` looks for 年, and until now there
    // was none to find.
    s = rewrite(s, /(?<![\p{L}\d])(\d{1,4})[-\s]ngi[eè]n(?=[^\p{L}]|$)/gu, "$1年");

    // ── 3. geographic coordinates ────────────────────────────────────────────────────────────────
    // ⚠ BEFORE EVERY OTHER ° RULE AND BEFORE THE RANGE RULE — the same ordering wuu earned. The corpus
    // writes `tûng-kîn 112°50'-114°45'`, `pet-vúi 23°5'-25°31'`, `27°58′38″ chṳ 29°31′42″`,
    // `44°27'56″`, `17°33′36″`: 21 U+2032 and 6 U+2033, plus the 285 ASCII apostrophes the wiki prefers.
    // Left to the bare-degree rule the minute and second marks drop silently; left to the range rule, a
    // 至 gets wedged between a minute mark and a degree sign.
    // 度/分/秒 all speak (tʰu⁵³ — see the derived entry — / pun⁴⁴ / miau³¹). Digits stay digits so the
    // cardinal path reads them, which is also what strips a written leading zero.
    s = rewrite(s,
        new RegExp(`(\\d+)\\s*°\\s*(\\d+)\\s*${MINUTE}\\s*(\\d+)\\s*${SECOND}`, "gu"),
        "$1度$2分$3秒",
    );
    s = rewrite(s, new RegExp(`(\\d+)\\s*°\\s*(\\d+)\\s*${MINUTE}`, "gu"), "$1度$2分");
    // ⚠ AND THE DASH BETWEEN TWO COORDINATES, here rather than in step 7, because by now the endpoints end
    // in 分/秒 and no digit-to-digit rule can ever see them.
    // ⚠ ⟨度⟩ IS DELIBERATELY NOT IN THIS CLASS. wuu shipped it and it was a live defect — a genuine negative
    // (`温度-5度`) rewritten as a range. Both of this corpus's coordinate ranges have 分 before the dash.
    s = rewrite(s, /([分秒])\s*[-–—－~～〜]\s*(?=\d)/gu, "$1至");

    // ── 4. temperature, then the bare degree ─────────────────────────────────────────────────────
    // ⚠ SHARED — the trio and its order live in `core/sinitic.ts`: temperature first, or the bare rule eats
    // the ° and leaves a lone ⟨C⟩ to be read as an ENGLISH LETTER NAME. That is what `20°C` did here before
    // this file existed: *ŋi˥˧ səp̚˥ sˈiː*. The two guards that rule carries — `\s*` not `\s?`, and
    // `\p{sc=Latn}` not `\p{L}` — both matter in this corpus, which writes `13.3 °C` and `34.2 °C` spaced
    // and puts Han on the other side of the letter.
    // ⚠ THE SCALE NAME IS PREPOSED, AND THAT IS SOURCED RATHER THAN COPIED. hak.wikipedia writes
    // `chui-ngie̍t ke hàng-sên (ngiap-shì 2040 thu)` — 攝氏, then the number, then 度. wuu POSTposes Celsius
    // and PREposes Fahrenheit; yue preposes both; the position is not guessable and was probed apart.
    // ⚠ FAHRENHEIT IS AN INFERENCE AND IS FLAGGED AS ONE: ⟨華氏⟩ speaks (fa¹¹ sz̩⁵³) but `°F` occurs ZERO
    // times, so the SHAPE is taken from Celsius, which is attested. Playbook trap 8 — probe the adversarial
    // neighbour — is why it is declared at all rather than left to drop the letter.
    // ⚠ THE BARE DEGREE IS THE BEST-ATTESTED OF THE THREE: `thu` after a number ×15, all of them
    // coordinates and angles (`Pet-vúi 42 thu`, `Tûng-kîn 60 thu`, `tén-yî 180 thu`, `1 thu tén-yî 60 kok
    // fûn`) — which is the shape step 3 hands it.
    s = readDegrees(s, {
        celsius: (n) => `攝氏${n}度`,
        fahrenheit: (n) => `華氏${n}度`,
        bare: (n) => `${n}度`,
    });

    // ── 5. a negative temperature ────────────────────────────────────────────────────────────────
    // ⚠ THE WORD IS THE CORPUS'S OWN, AND THAT IS WHY THIS RULE EXISTS AT ALL. Hakka says 零下 — the corpus
    // writes `Chhiòn chû-ngièn phìn-kiûn hi-vûn he làng-hâ 25℃`, and 零下 reads laŋ¹¹ ha⁴⁴, which is
    // `làng-hâ` exactly. ⟨負⟩ also speaks and is NOT used: it has no attested sense here and the language
    // supplied its own answer.
    // ⚠ AFTER STEP 4, NOT BEFORE IT, AND THE ORDER IS THE WORD ORDER. Run first, this rule produces
    // `零下4.5°C`, which step 4 then turns into `零下攝氏4點五度` — every word right and the phrase inside
    // out, because the scale name preposes too and would land between "below zero" and its number. Running
    // after lets the sign be replaced where the scale name already is: `攝氏零下4點五度`, which is the order
    // Chinese and Hakka both write.
    // ⚠ CLAIMED ONLY WHERE A DEGREE READING WAS ACTUALLY PRODUCED, which is the entire guard and is what
    // makes it safe in a corpus where every other word contains a hyphen. All 6 attested negatives are
    // temperatures (`-4.5℃`, `-218 °C`, `−224℃`, `-170°C` ×2, `-5 °C`); the other 28 leading hyphens before
    // digits are YEAR-RANGE separators (`303-ngièn -349-ngièn`), COORDINATE ranges (`112°50'-114°45'`,
    // already read as ranges by step 3) and CHEMICAL oxidation states (`-2, 0, +4, +6`). A looser rule would
    // read every one of them as a minus, and Pha̍k-fa-sṳ is the worst orthography there is to guess a hyphen
    // in — it joins every polysyllable with one.
    // ⚠ AND ONLY THE SCALED FORM IS CLAIMED — no bare `-5度` arm. Every attested negative carries the scale
    // letter, so a bare arm would be a guard alternative with no instance behind it (playbook trap 9).
    s = rewrite(s, /(?<![\d\p{L}])[-−](攝氏|華氏)/gu, "$1零下");

    // ── 6. years ─────────────────────────────────────────────────────────────────────────────────
    // ⚠ ALL THREE ARMS AND THEIR ORDER LIVE IN `core/sinitic.ts` — range, then both-endpoints, then single —
    // and this is the first language to receive that order instead of rediscovering it. Both shapes it
    // guards are here: `2008-2012` (bare range, right endpoint alone sees 年) and `1877-ngièn - 1919-ngièn`
    // (both endpoints carry it, so the dash is unreachable once the single rule has run). Step 2 has
    // already turned every PFS year into the Han form, so one call covers 5,783 instances in two
    // orthographies.
    // ⚠ 4 DIGITS ONLY, so a 3-digit `N年` keeps the CARDINAL — the fleet's standing refusal, and this corpus
    // is where it is easiest to see why: `30年 nui` ("within 30 years") and `711年` are the same surface.
    // AFTER step 2 (there was no 年 before it) and BEFORE step 7 (which must not re-claim a year range).
    s = spellYears(s, { rangeWord: "至" });

    // ── 7. quantity ranges, RIGHT-CONTEXT GUARDED ────────────────────────────────────────────────
    // ⚠ THE GUARD IS THE WHOLE RULE, and cjy's guard is exactly the wrong one to copy: it refuses a range
    // with a Latin run nearby, which in a 93.5%-Latin corpus refuses every range there is. wuu's shape —
    // claim the dash only where a unit, scale or magnitude follows — is the one that transfers, because it
    // keys on what makes the span a QUANTITY rather than on what script it is written in.
    // Of the 108 numeric dashes in the dump, the guard admits the genuine ranges (`90-120 fûn-chûng`,
    // `200—300 kûng-lî`, `2000-4000 mí`, `58-338 kûng-lî`, `30-34‰`, `2750-3300 ml`, `15-20亿元`,
    // `335～345天`, `10—19人`, and the verse spans `1-16 Chông`, `9-23 tsiet`) and refuses the codes that
    // share their shape: `ISO 639-1`, `ISO 3166-1`, `A340-500`, `777-200ER`, `GE90-115B`, `C6554-07E`,
    // `GB50352—2005`, `A/C/B 355~356`, and — for free, because none of them is followed by a unit — the
    // broadcast clocks `21:00 - 21:54, JST`, `0:12 - 0:50`, `23:40 - 24:05`.
    // ⚠ BEFORE the percent tier (step 9): once `7%` has become `百分之7` the endpoints are no longer adjacent
    // to the dash and this can never match. The `‰` sign may sit on an endpoint, so it is captured and
    // RE-EMITTED (trap 10) — `30-34‰` must still reach step 10 as a per-mille on both halves.
    // Digits are LEFT as digits so the cardinal path reads them.
    s = rewrite(s,
        new RegExp(
            `(?<![\\d.,:\\p{sc=Latn}])(\\d+(?:\\.\\d+)?)([%‰])?\\s*[-–—－~～〜]\\s*(\\d+(?:\\.\\d+)?)(?=\\s*${RANGE_UNIT})`,
            "gu",
        ),
        (_m, a: string, sign: string | undefined, b: string) => `${a}${sign ?? ""}至${b}`,
    );

    // ── 8. the fraction, in the Chinese order ────────────────────────────────────────────────────
    // ⚠ `a/b` IS `b分之a`, and the corpus states the convention in its own romanization ×39:
    // `sâm-fûn-chṳ̂-ngi` (三分之二) is 2/3, `si-fûn-chṳ̂-yit` (四分之一) is 1/4. Both characters speak.
    // ⚠ THE SHARED RULE CARRIES THE GUARD THREE CORPORA PAID FOR — four digits on both sides is a YEAR PAIR,
    // not a fraction — and it earns its keep here on the first run: the corpus writes `A/C/B351/352`,
    // `SP1900/1950` and `A/C/B359/360` (train set numbers), which the digit-adjacency guards refuse, and
    // `1/5` and `1⁄30`, which are the real thing.
    s = reorderFraction(s, "分之");

    // ── 9. percent, units, exponents, currency and the ampersand, via the shared tier ────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule: the tier matches
    // ASCII digits next to the sign, and step 11 replaces the "." with 點, which would break that adjacency
    // for a decimal percentage — of which this corpus has many (`3.5%`, `28.8%`, `19.2%`, `9.6%`).
    s = SYMBOLS(s);

    // ── 10. per-mille ────────────────────────────────────────────────────────────────────────────
    // The shared tier reads `%` in three encodings and does not read `‰` at all, so this is local — the same
    // gap wuu found. The word is 千分之, composed from the 分之 the corpus attests ×39 and the 千 it writes
    // as `chhiên` ×157; prefixed, like 百分之. `yàm thu 30-34‰`, `yàm thu 38-40‰` — salinity, both of them
    // ranges, which is why step 7 had to re-emit the sign.
    // ⚠ THE RULE CLAIMS THE WHOLE RANGE, not just the endpoint the sign touches. 千分之 is a PREFIX, so on
    // `30至34‰` the bare rule produces `30至千分之34` — "thirty to per-mille thirty-four", the scale word
    // wedged inside the span. Both of the corpus's per-mille instances are ranges, so this is the ONLY
    // shape the rule ever sees here; swallowing the optional `至N` puts the prefix where it belongs.
    s = rewrite(s, /(?<![\d.,])(\d+(?:\.\d+)?(?:至\d+(?:\.\d+)?)?)\s*‰/gu, "千分之$1");

    // ── 11. decimals ─────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules. `decimals: 1960` in the artifact, 1,253 over the dump, and every one was
    // leaking a raw `.` into the phoneme stream as a clause pause: `12.5` read *səp̚˥ ŋi˥˧ . n̩˧˩*.
    // ⚠ The separator is a word and the FRACTIONAL PART IS READ DIGIT BY DIGIT — 六點三四, never 六點三十四 —
    // and the shared rule carries the dotted-designation guard (`1.2.3`, `802.11n`) the jv layer earned and
    // the 3-digit cap that keeps a DOI out.
    // ⚠ ⟨點⟩ IS THE ONE WORD HERE SHIPPED WITHOUT AN ATTESTED SEPARATOR SENSE, and knowingly, for the fourth
    // time in this family. Of the 151 corpus `tiám`, all are the noun (`kôn-tiám` 觀點, `thi̍t-tiám` 特點,
    // `thi-tiám` 地點) except one, and that one is a CLOCK — `hâ-chu 4 tiám 51 fûn`, 4:51. That is the Igbo
    // lesson in the playbook: a written corpus is the weakest evidence there is about how a SYMBOL is
    // spoken, because writers type `3.5` and never spell out how they say it. It is in the dict (tiam³¹),
    // it is what cmn, yue, wuu, nan and cjy all read, and the alternative is 1,253 raw stops.
    s = readDecimals(s, "點");

    return s;
}
