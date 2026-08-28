/**
 * Lithuanian / lietuvių (lt) TEXT NORMALIZATION — the pre-tokenizer pass that rewrites everything which is
 * not already a pronounceable word into words the existing pipeline speaks. Pure text→text; no IPA.
 *
 * ⚠ NO SHARED SYMBOL TIER IS WIRED, AND THE REASON IS PLAYBOOK TRAP 14 IN ITS PUREST FORM. Lithuanian is a
 * seven-case language whose EVERY counted noun takes the Baltic three-way concord — `1 procentas`,
 * `2 procentai`, `10 procentų` — and `core/normalizeSymbols.ts` holds ONE invariant string per unit. It
 * cannot say any of them. A digit becomes words in the TOKENIZER, downstream of this whole layer, so a rule
 * that emits `$1 <noun> $2` on digits can never make the noun agree, because at that moment there is no word
 * to agree WITH. Every rule below therefore words-ifies its own operand through `numberToWords()` and calls
 * the engine's own `agree()` — the same function the magnitude nouns already use — and then claims the unit
 * the tier can no longer see. That is trap 47's reason 1 (the idiom is not "A per B", it is "A agreeing-B")
 * reached from this corpus rather than copied.
 *
 * ⚠ THERE IS NO TREATED BALTIC SIBLING. Latvian and Latgalian are both untreated, so there was no layer to
 * read and — the other half of trap 55 — no table to be tempted by. Every reading below is sourced from
 * Lithuanian's own evidence and carries its count and the SENSE that was read.
 *
 * ⚠ THE SOURCING SITUATION, STATED PLAINLY — IT IS TWO TIERS AND THEY ARE NOT INDEPENDENT.
 *   1. `tools/corpus/mined/lt.jsonc` — 464 retained segments (264 hard + 200 sample) of a 1,193,488-paragraph
 *      lt.wikipedia dump. `mine.ts scan` reports 19 defect classes / 214 instances, the highest instance
 *      count of any untreated language in this repository.
 *   2. `attest.ts` against lt.wikipedia — WHICH IS THE SAME WIKI THE ARTIFACT WAS MINED FROM. A bigger
 *      sample of ONE source, never a second one. There is no FLEURS corpus for Lithuanian.
 * ⚠ AND THAT SENTENCE IS NOW FALSE (#1102): `lt_lt` landed later, 1,966 unique transcript texts, and it is a
 * genuinely INDEPENDENT read-aloud corpus rather than a second sample of the wiki. ⚠ AND THE RE-MEASUREMENT HAS NOW BEEN
 * DONE FOR THE CLOCK, which is the class it changed — see the clock note below. Every OTHER "only N
 * times" in this file is still a count over the mined artifact alone: the sweep was per CLASS, not per
 * file, and the rest of #1102's expensive half is still open.
 *   3. What genuinely IS independent, and what rescues this language: espeak ships Lithuanian, and
 *      `$ESPEAK_NG/dictsource/lt_list` carries a CHARACTER-NAME block and an ABBREVIATION block. Those
 *      state how a SYMBOL is READ rather than merely using it — the register a written corpus lacks by
 *      construction (playbook §5e's Igbo lesson) — and they supplied `_dpt kablelis`, `% procentai`,
 *      `_- minus`, `+ plius`, `° laipsnis`, `$ doleris`, `€ euras`, `nr numeris`, `mln milijonai`,
 *      `tūkst tūkstančiai`. espeak is PHONETIC, so every spelling was round-tripped through this repo's own
 *      g2p and compared back against espeak's mnemonic (playbook §5c). The sources are recorded per entry in
 *      lithuanian.jsonc; the readings are not repeated here.
 *
 * ── WHAT WAS BROKEN, with the whole-corpus count from the artifact's own `counts` block ──────────────────
 *
 *     1802 m.        → *… dʊ  m  .*   a bare consonant AND A SENTENCE PERIOD mid-clause   abbrev ×530,349
 *     1,9 %          → *ʋʲiɛnɐs , dʲɛʋʲiːnʲɪ*  a PAUSE inside the number, sign silent      decimals ×48,304
 *     50 %           → the sign silent                                                    percent ×13,537
 *     17 °C          → *sʲɛpʲtʲiːnʲoːlʲɪkɐ t͡s*  ⚠ the degree DROPPED and ⟨C⟩ read as the
 *                      Lithuanian grapheme /t͡s/ — trap 56, a READING and not a leak       degrees ×2,846
 *     0,5 kg         → *nʊlʲɪs , pʲɛŋʲkʲɪ ɡɡ*  ⟨kg⟩ voiced-assimilated into a doubled /ɡɡ/  units ×67,428
 *     3870 km        → raw `km` in the phoneme stream                                      (LEAK ×36)
 *     65 300 km²     → ONE number read as TWO, `km` raw, the exponent silent               grouped ×19,047
 *     64 000 Lt      → *…kʲɛtʊrʲɪ nʊlʲɪs*  — the grouped `000` read as the word NULIS,
 *                      i.e. a silent 1000× error of trap 56's tg class                     exponent ×9,816
 *     1890–1906      → two cardinals juxtaposed, no connective at all                      ranges ×158,499
 *     -5 °C          → the sign silent; omitting a minus INVERTS                          signed-number ×4,490
 *     €151 mln.      → the sign silent, `mln` raw, plus a spurious sentence break          currency ×596
 *     XIX a.         → *dʲɛʋʲiːnʲoːlʲɪkɐ ɐ .*  a bare vowel and a spurious break           roman ×93,344
 *     IV a. pr. m. e. → *kʲɛtʊrʲɪ ɐ . pr . m . ɛ .*  FIVE spurious sentence breaks         era-marker ×7,572
 *     TSRS · BVP     → *tsrs* · *bʋp*  vowel-less clusters                                initialism ×268,062
 *
 * ── THE ONE MEASUREMENT THIS LAYER TURNS ON, AND ITS TWO RESIDUALS ───────────────────────────────────────
 *
 * `sources.ts` reports that this corpus writes `m` after a number ×365, which reads as an overwhelming case
 * for declaring the metre. IT IS NOT. Tabulated by the following character, and then by SENSE:
 *
 *       `m.` WITH a dot   ×347   346 the YEAR abbreviation *metai* (`1802 m.`, `1930 m. balandžio`)
 *                                  1 a METRE — `kurios vidutinis aukštis 174 m. Liūčių laikotarpio metu`
 *       `m`  no dot       ×18     17 a genuine METRE (`8850 m`, `1620 m`, `-400 m`, `5000 m bėgimo`)
 *                                  1 a YEAR — `2002 ir 2003 m, atitinkamai 1 % ir 0,5 %`
 *
 * ⚠ AN EARLIER VERSION OF THIS PARAGRAPH SAID "ZERO OVERLAP", AND THE CORPUS CONTAINS A COUNTER-EXAMPLE
 * EACH WAY. The dot is the best discriminator there is here and it is not a perfect one. What the split
 * honestly buys, and what it costs:
 *   · The `m.` = year arm is right 346/347. The one metre is a sentence-final measurement whose following
 *     word happens to be capitalised, and NOTHING in the string separates it from a year — not the operand
 *     length (three-digit `m.` is 6 years to 1 metre), not the following token. It reads as *metais*.
 *   · The bare-`m` = metre arm is right 17/18. The one year is a `m,` where the writer used a comma for the
 *     abbreviation dot. Adding `,` to that rule's right guard would fix it and would decline `8850 m,` and
 *     `5000 m,` — two genuine metres for one — so the guard is NOT added and the misread is carried.
 * Declaring a bare one-letter `m` key on the whole ×365 figure would still have read 346 YEARS as METRES,
 * which is trap 46 with the counter-example outnumbering the true positive nineteen to one; the split is
 * worth having at 363/365 correct. It is stated this way so the next reader inherits the exposure and not a
 * claim of purity: the `m.` rule is the highest-traffic rule in this file, and one in 347 of it is wrong.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each with the count and the check that refused it ─────────────────────
 *
 *   · NO ORDINALS, ANYWHERE, AND THIS IS THE LAYER'S LARGEST KNOWN GAP — stated first because it makes three
 *     rules below half-right. Lithuanian reads a year, a century and a decade with an ORDINAL numeral in a
 *     definite (pronominal) case form: `1970 m.` is *tūkstantis devyni šimtai septyniasdešimtaisiais metais*,
 *     `XIX a.` is *devyniolikto amžiaus*. This layer emits the sourced NOUN and leaves the numeral CARDINAL.
 *     ⚠ THE ORDINAL SERIES WAS ATTEMPTED AND MEASURED, AND THE MEASUREMENT REFUSED IT — recorded so nobody
 *     repeats the attempt (the Punjabi/Odia precedent). Probing the century collocation on lt.wikipedia:
 *     `dvidešimto amžiaus` ×17/16, `devyniolikto amžiaus` ×11/11, `penkiolikto amžiaus` ×2/2, `antro
 *     amžiaus` ×2/2, `ketvirto amžiaus` ×1/1 — but `pirmo`, `penkto` and `šešto amžiaus` are ×0 and
 *     `dešimto amžiaus` is substring-only, i.e. 5 of 11 attested. AND ONE OF THE FIVE IS THE WRONG SENSE:
 *     `trečio amžiaus` ×1 is *Medardo Čoboto trečio amžiaus universitetas*, the University of the THIRD AGE,
 *     a seniors' college and not a century (the ki `digirii` shape). A paradigm that is 45% attested with a
 *     sense trap inside the attested half is not shippable, and the definite instrumental the year frame
 *     actually needs (*-aisiais*) was not probed at all. So the numeral stays cardinal, deliberately.
 *     Priced against the refusal (trap 53): what the half-fix DOES buy is the sourced noun and, far more
 *     importantly, the removal of ~470 spurious SENTENCE BREAKS — the abbreviation dot is the single most
 *     pervasive defect in this corpus, and it is orthogonal to the ordinal.
 *   · NO BARE-`°` RULE, so `DROP degree` stays partly red on purpose. 16 bare degree signs in the retained
 *     text and 14 are COORDINATES — `54° 54′ šiaurės platumos`, `26° 51′ rytų ilgumos`, `81° 20´ v. ilg.`,
 *     `12° 28´ š. pl.` — with two angles (`104,5° kampui`). Reading the degree while the arcminute `′`
 *     stayed silent would FUSE the two numbers into one reading (*penkiasdešimt keturi laipsniai
 *     penkiasdešimt keturi*), which is worse than the current uniform silence. Refuse the whole match, never
 *     half of it (trap 53). ⚠ The `°C` arm is unaffected and does fire; the compass letters and `′`/`´` are
 *     the missing half, and they are a separate rule with its own sourcing.
 *   · NO CLOCK. 11 `N:NN` in the retained text and NOT ONE is a time of day: `2:15:16` and `5:48:45.98` are
 *     sports/astronomical durations, `23:59:60`, `00:58:53 UTC` and `19:14:07 GMT` are timestamps, `19:11
 *     val.` already carries its hour noun, and `8:00 - 19:00 val.` is an opening-hours span that does too.
 *     The ilo finding exactly — a `ceb`-shaped bare-colon clock would have fixed nothing and broken these.
 *     The colon keeps the pause it already had.
 *     ⚠ AND FOR ONE COMMIT THIS REFUSAL WAS A COMMENT AND NOT A GUARD, WHICH IS THE WORST OF BOTH. No rule
 *     read the colon, and two rules read straight THROUGH it: the operand anchor did not reject a colon on
 *     either edge, so the hour rule took the MINUTE field of `(19:11 val. UTC)` as a count of hours
 *     (*19:vienuolika valandų*) and the range rule spanned `8:00 - 19:00 val.` as *8:nuo 00 iki 19:nulis*.
 *     A declined class has to be declined by the anchors, or the other rules claim it piecemeal. `NUM` and
 *     the range now reject an adjacent `:` on both edges; the `val.` abbreviation is still expanded, since
 *     refusing the numeral is not a reason to hand a vowel-less cluster back to the g2p.
 *   · NO FRACTIONS. 14 `N/N`, and they split four ways: real fractions (`2/3`, `3/4`, `1/8`, `1/25`), RATES
 *     (`8,6/1000 gyventojų`, `10,8/1000`), a DOCUMENT NUMBER (`OGPU įsakymu Nr. 130/63`) and a modulation
 *     ratio (`santykiu 2/3`). Reading them needs the feminine ordinal series (*dvi trečiosios*), which is
 *     the same series the century probe above just failed to source. Declined with it, not separately.
 *   · NO EQUALS WORD, although espeak supplies one (`=  l;'i:gu`). 39 instances and reading them finds no
 *     arithmetic: LaTeX dumps (`\mathbb{N}^0 = \mathbb{N}_0`), ETYMOLOGY GLOSSES where `=` means "means"
 *     (`γράφω = graphō 'rašau'`, `φιλο – 'myliu' + σοφία = išmintis`), a bilingual title separator
 *     (`Baltu valodu atlants: prospekts = Baltų kalbų atlasas`), and raw formula text. *Lygu* in a gloss
 *     would say "equals" about a translation. The gn conclusion, reached on this language's own instances.
 *   · NO DIMENSION CROSS. `110 x 46 x 21 mm` is the only instance and it reads "by", not "times" — the th
 *     finding. One instance is not grounds for a multiplication word. ⚠ BUT THE REFUSAL HAS TO BE SPELLED
 *     BOTH WAYS THE CORPUS SPELLS THE SYMBOL: `×` (U+00D7) was silent and the ASCII `x` stand-in was being
 *     READ, as /z/, because ⟨x⟩ falls through the g2p — a plausible Lithuanian phoneme with no basis
 *     (trap 56). A digit-flanked ASCII `x` is now folded to the same silence the sign has. `x1, x2, x3`
 *     (a lap-multiplier prefix) and `x86` are not digit-flanked and are untouched.
 *   · NO SPORTS SCORE. 3 in the retained text — `Rezultatas buvo lygus (1-1)`, `pergalę rezultatu 2-1.`,
 *     `pralaimėjo … komandai 155–157.` — and a score is a PAIR, not a span: *nuo vienas iki vienas* is a
 *     confident misreading, not a rough one. They are refused WHOLE by the range rule on a closed list of
 *     the words this corpus puts in front of them, and read as two juxtaposed cardinals, which is what
 *     they were before this layer existed.
 *   · NO TILDE. `~5000 km`, `~75 %`, `~3/4` — espeak names the character (`_~ t'Ildee`) but naming a
 *     character is not a reading of it, and *apie* ("about") is unattested in that slot. It stays silent.
 *   · NO `kcal`, `Mbit`, `MB/s`, `kV`, `Lt`-as-a-rate. `140–160 kcal/cm²` is declined WHOLE rather than
 *     half — the `cm²` arm requires a digit before the key, so the `/` blocks it and the exponent is not
 *     invented onto a numerator this layer cannot name (trap 54's `si`/`so` case).
 *   · NO `plg.` (×1, *palygink*), `pab.` (×1, *pabaiga*), `vad.` (×2, *vadinamasis*) OR A BARE `pr.` (×1,
 *     `XIX a. pr.` = *pradžioje*). Four single-dot abbreviations at ×1–2 each, none of them sourced by
 *     espeak's abbreviation block, and each ambiguous on its own — `pr.` in particular is *pradžioje* here
 *     and *prieš* in the era phrase this file claims two lines up. Listed with their counts so the gap is
 *     an inventory rather than an oversight; they are what `mine.ts scan` still reports beside the FOREIGN
 *     abbreviations `lpp` ×5 (Latvian "lappuses", in a Latvian bibliography) and the domain names
 *     `žūklė.lt`, `balsas.lt`, `Amazon.jp` — none of which is Lithuanian and none of which this layer
 *     should claim.
 *   · NO ENGLISH DECIMAL DOT. `\d.\d` ×35 and reading them shows why: versions (`4.4BSD`, `3.11`), an IP
 *     address (`44.111.333.12`), formula text (`0.03`, `10^3`), and English-format figures inside imported
 *     tables. A Lithuanian decimal is written with a COMMA; a dot-decimal rule here would claim four
 *     designations for every real number.
 */

import { makeInitialismNormalizer, makeUnreadableTest } from "../../core/initialisms.ts";
import { NOT_LETTER_AFTER, NOT_LETTER_BEFORE } from "../../core/boundaries.ts";
import { MANIFEST, type LithuanianAgreement } from "./manifest.ts";
import { agree, numberToWords } from "./numbers.ts";
import { tr } from "../../core/provenance.ts";

const NRM = MANIFEST.normalization;
const N = NRM.countedNouns;
const W = NRM.words;

/** ASCII space or NO-BREAK space. Written as an ESCAPE, never as a literal — a literal U+00A0 collapses
 *  invisibly to a duplicate ASCII space under an editor or a copy-paste and the class silently becomes one
 *  alternative instead of two (the defect found reviewing the Luganda layer). */
const SP = "[ \\u00a0\\u202f\\u2009]";  // space, NBSP, NNBSP, thin space
/** Not inside a word. `\p{M}` beside `\p{L}` per trap 23 — Lithuanian is alphabetic, but the guard is
 *  written once and copied, and a decomposed ⟨ž⟩ is `z` + U+030C, a mark. */
/** A digit run with optional space/nbsp grouping and an optional decimal comma, ANCHORED so it cannot start
 *  or end inside a longer number. ⚠ Both edges, not one (trap 52): a lookbehind rejects a starting POSITION
 *  and the engine simply retries one character later, which is how `802.11m` matched `11m` in three
 *  unrelated layers. */
// ⚠ NEITHER SEPARATOR IS REJECTED UNCONDITIONALLY — A SEPARATOR ONLY BELONGS TO THE NUMBER WHEN A DIGIT
// FOLLOWS IT. Written as `(?![\d.,])` the right edge declined every figure that ENDS A CLAUSE, because a
// following `,` looks like the start of a decimal: the corpus's own `prizinis fondas buvo $4000,
// nugalėtojui…` came back with the sign unread. The comma was fixed and THE DOT WAS LEFT UNCONDITIONAL,
// which repeated the same defect one punctuation mark over — `pardavė savo akcijas už $800.` came back
// untouched and THE DOLLAR WAS SILENT. `[.,]\d` covers both: `12,367.7` (an English-format figure in an
// imported table) and `4.4BSD` are still declined outright, because in those a digit does follow.
// ⚠ AND A COLON IS REJECTED ON BOTH EDGES, WHICH IS WHERE THE HEADER'S "NO CLOCK" REFUSAL IS ACTUALLY
// IMPLEMENTED. It was stated as a refusal and was not one: with the colon absent from these guards the
// hour rule read the MINUTE field of the corpus's own `(19:11 val. UTC)` as a count of hours —
// *19:vienuolika valandų* — and the range rule reached straight across the colon in `8:00 - 19:00 val.`,
// giving *8:nuo 00 iki 19:nulis valandų*. A refusal that no guard enforces is a comment, not a refusal.
const NUM = `(?<![\\d.,:])(\\d+(?:,\\d+)?)(?!\\d|[.,]\\d|:)`;

/**
 * GENDER. Lithuanian's 1–9 inflect for gender and the engine's `numberToWords` emits the MASCULINE citation
 * form, which is correct for a bare numeral (it has no noun to agree with) and wrong the moment this layer
 * supplies one: `4 val.` is *keturios valandos*, never *keturi valandos*. Only the FINAL unit word of a
 * composed numeral carries it — *dvidešimt keturios* — so the swap is on the last token, and only 1–9
 * differ at all. Applies to the two feminine nouns this layer declares, *valanda* and *tona*.
 */
function feminise(words: string): string {
    const parts = words.split(" ");
    const i = MANIFEST.numbers.units.indexOf(parts.at(-1) ?? "");
    if (i < 0) return words; // ends in a teen, a ten or a magnitude noun — all gender-invariant
    parts[parts.length - 1] = MANIFEST.numbers.unitsFem[i]!;
    return parts.join(" ");
}

/** Parse an operand the rules captured. Returns the words and the concord form for a counted noun. */
function quantity(raw: string, forms: LithuanianAgreement): string {
    const [intPart, frac] = raw.split(",");
    const n = Number(intPart);
    if (!Number.isFinite(n)) return raw;
    // A DECIMAL takes the GENITIVE. Lithuanian puts a fractional quantity's noun in the genitive
    // ("16,27 mlrd. eurų", "45,7 laipsnių Celsijaus" — both attested), and the alternative would be to
    // agree with a whole-number part the speaker never says on its own.
    const noun = frac === undefined ? agree(n, forms) : forms.gen;
    const num = bare(raw);
    return `${forms.fem === true ? feminise(num) : num} ${noun}`;
}

/** The magnitude noun for an abbreviation standing between a figure and its unit or currency, agreeing
 *  with the figure — or the empty string when there is none. */
function magWords(num: string, mag: string | undefined): string {
    if (mag === undefined) return "";
    const forms = MAGS.find(([re]) => re.test(mag))?.[1];
    if (forms === undefined) return "";
    return ` ${num.includes(",") ? forms.gen : agree(Number(num.split(",")[0]), forms)}`;
}

/** Just the words for an operand, with no noun — for the range and sign rules. */
function bare(raw: string): string {
    const [intPart, frac] = raw.split(",");
    const n = Number(intPart);
    if (!Number.isFinite(n)) return raw;
    return frac === undefined
        ? numberToWords(n)
        : `${numberToWords(n)} ${W.decimalPoint} ${frac.split("").map((d) => numberToWords(Number(d))).join(" ")}`;
}

/**
 * IS ONE OF THESE WORDS ALREADY IN THE TEXT NEAR HERE? The trap-12 "do not say it twice" guard, written the
 * way the Luganda review had to rewrite it after it failed in both directions:
 *   · WORD-BOUNDED, never a bare `String.includes` — `eur` is four characters inside *Europos*, which this
 *     corpus writes constantly, and a substring needle would suppress the euro reading across the continent.
 *   · CASE-INSENSITIVE — this corpus capitalises a noun sentence-initially and inside a title, so a
 *     case-sensitive needle misses exactly that half and DOUBLES the reading instead of suppressing it.
 * Only full attested forms are listed; no stem is truncated to make it match more.
 */
function saidNear(text: string, forms: readonly string[]): boolean {
    return forms.some((f) => new RegExp(`${NOT_LETTER_BEFORE}${f}${NOT_LETTER_AFTER}`, "iu").test(text));
}

/**
 * THE FIRST `n` WORDS AFTER A MATCH — the window `saidNear` searches, and the reason it is a word count
 * and not a character count. It was 30 CHARACTERS, which is long enough to reach a currency noun that
 * belongs to a DIFFERENT figure: `kaina 5 $ ir dešimt dolerių` ("price 5 $ and ten dollars") suppressed
 * the `$` reading because *dolerių* was 12 characters away, and the sign went silent. The two shapes the
 * guard exists for put the noun immediately after — `$90 milijonų DOLERIŲ` (next word) and `9 986 mlrd.
 * JAV DOLERIŲ` (one acronym in between) — so two words is the whole attested reach.
 */
function nextWords(after: string, n: number): string {
    return new RegExp(`^(?:[^\\p{L}\\p{M}]*[\\p{L}\\p{M}]+){0,${n}}`, "u").exec(after)?.[0] ?? "";
}
const DOLLAR_FORMS = ["doleris", "dolerio", "doleriai", "dolerių", "dolerius", "dolerį"];
const EURO_FORMS = ["euras", "euro", "eurai", "eurų", "eurus", "eurą"];
const POUND_FORMS = ["svaras", "svaro", "svarai", "svarų", "svarus", "svarą"];
const LITAS_FORMS = ["litas", "lito", "litai", "litų", "litus", "litą"];

/** The FIRST WORD of either era phrase this layer inserts (`prieš mūsų erą` / `mūsų eros`), as a lookahead.
 *  Step 9's "a letter follows ⇒ this magnitude governs a noun" test must not fire on it — see there. */
const ERA_HEAD = new RegExp(
    `^${SP}*(?:${[W.eraBefore, W.eraOur].map((w) => w.split(" ")[0]).join("|")})${NOT_LETTER_AFTER}`,
    "u",
);

/** The magnitude abbreviations, and the noun each expands to. */
const MAGS: readonly [RegExp, LithuanianAgreement][] = [
    [/mlrd/u, MANIFEST.numbers.magnitudes.billion],
    [/mln/u, MANIFEST.numbers.magnitudes.million],
    [/tūkst/u, MANIFEST.numbers.magnitudes.thousand],
];

/**
 * Text→text normalization for Lithuanian. A numbered, ORDER-DEPENDENT sequence; the coupling is stated at
 * each step because a future reader cannot recover it from the code.
 */
/**
 * A CLOCK'S SEPARATOR LOSES ITS PAUSE BEHIND `val.` / `a.m.` / `p.m.` — and nothing else happens (#1102).
 *
 * ⚠ THE REFUSAL BELOW WAS PRICED ON ONE CORPUS AND FLEURS INVERTS IT. It reads "11 `N:NN` in the retained
 * text and NOT ONE is a time of day", which is true of the mined artifact. Over `lt_lt` there are **16
 * true clocks**, and 14 of them carry `val.` (the hour noun) or `a.m.`/`p.m.`: `11:20 val.`, `8.46 val.`,
 * `12.00 val`, `07:19 a.m.`, `09:19 p.m.` …
 * ⚠ AND THE REFUSAL HAD ALREADY SEEN THE DISCRIMINATOR AND READ IT BACKWARDS — it cites `19:11 val.` as a
 * reason NOT to read, because the hour noun "is already there". It is: which is exactly what makes it a
 * marker no counter-example carries.
 * ⚠ NO WORD IS EMITTED. `val.` is written, so nothing needs sourcing; what this removes is the CLAUSE
 * PAUSE the colon was, and the full stop `8.46` was taking mid-figure.
 * ⚠ EVERY COUNTER-EXAMPLE THE REFUSAL NAMES IS STILL DECLINED, because none carries the marker: the
 * timestamps `00:58:53 UTC` / `19:14:07 GMT`, the durations `2:15:16` and `5:48:45.98`, the FLEURS sports
 * times `4:41.30` / `2:11.60` / `1:09.02`, and the Wi-Fi designations `802.11a/b/g/n`.
 * ⚠ `a.m.`/`p.m.` ARE **NOT** IN THE MARKER SET, AND THAT IS A MEASURED RETREAT RATHER THAN AN OVERSIGHT.
 * FLEURS carries two (`07:19 a.m.`, `09:19 p.m.`) and adding them fixed both — while BREAKING them, because
 * removing the colon puts the minute field next to the `a.`, and step 6's century abbreviation then reads
 * `19 a.` as *devyniolika amžiaus* ("nineteenth century"). Trading a pause for a wrong WORD is the wrong
 * side of trap 53, so the two instances keep their pause and the collision is left to whoever widens the
 * abbreviation rule. `val.` reaches 12 of the 16 with no such interaction.
 * ⚠ THE TRAILING GUARD REJECTS A DIGIT OR A SEPARATOR THAT CONTINUES THE NUMBER, NOT A CLAUSE MARK. Written
 * as `(?![\d.,:])` it declined every clock that ENDS A CLAUSE — `kusaawa 11:29,` and `ssaawa 11:00,` came
 * back untouched, which is trap 58 and is how half the marked instances were being missed.
 */
const CLOCK_MARKED = /(?<![\d.,:])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)(?=\s*val\b)/gu;
/**
 * ⚠ A SPAN'S FIRST OPERAND IS **NOT** CLAIMED, AND THAT IS A REVERSAL RECORDED RATHER THAN HIDDEN.
 * `8:00 - 19:00 val.` is the refusal's own opening-hours example, and the marker plainly licenses both
 * halves — so an arm was written to take them, and it made the reading WORSE. With both colons gone the
 * range rule below sees a bare `00 - 19` and claims it: *8 nuo 00 iki 19 nulis valandų*, "8 from 00 to 19
 * zero hours". Exactly tn's known-loss shape (#1104) from the other side — a rule that turns a separator
 * into a boundary changes what the NEXT rule can see.
 * So only the operand the marker touches is claimed, and `8:00 - 19 nulis valandų` is where this stops:
 * one pause removed, one left, and no new wrong word. Fixing it properly means the range rule learning to
 * see an already-rewritten operand, which is a new pattern shape rather than a move.
 */

export function normalizeLithuanian(input: string): string {
    // NFC. Lithuanian's ⟨ą č ę ė į š ų ū ž⟩ all have a decomposed encoding, and every literal below —
    // the month names, `tūkst`, `mūsų` — is written precomposed. `core/hostWord.ts` NFCs per TOKEN, which
    // is downstream of this whole file, so a decomposed input would silently miss half these rules
    // (trap 11). ⚠ ROBUSTNESS, NOT A MEASURED DEFECT REPAIR: the retained text is entirely NFC already and
    // this line changes zero corpus readings. Said so rather than implying a fix (trap 22).
    let t = input.normalize("NFC");

    // 0) THE MARKED CLOCK loses the separator's pause — see CLOCK_MARKED. First, because the ordinal and
    //    decimal rules below both read a dot and would spend `8.46`'s before this could see it.
    t = tr(t, CLOCK_MARKED, "$1 $2");

    // 1) FIXED MULTI-DOT PHRASES, ABOVE EVERY SINGLE-DOT RULE. Two separate reasons, and both bite:
    //    · The playbook's standing coupling — a multi-dot abbreviation must be claimed before a single-dot
    //      one, or the interior dot survives as a phrase break.
    //    · ⚠ AND THE ERA PHRASE CONTAINS THE VERY LETTER THE YEAR RULE CLAIMS. In `pr. m. e.` the `m.` is
    //      *mūsų* ("our"), not *metai* ("year"). Step 10 running first would read `IV a. pr. m. e.` as
    //      "…pr. METAIS e." — confidently wrong, in the 33 instances of the commonest era marker there is.
    //      This is the one ordering constraint in the file that produces a wrong WORD rather than a wrong
    //      pause, so it is first.
    //    `pr. m. e.` ×33, `p. m. e.` ×1, `m. e.` ×35 (the 33 + 2 standalone).
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}p(?:r)?\\.${SP}*m\\.${SP}*e\\.`, "gu"), ` ${W.eraBefore} `);
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}m\\.${SP}*e\\.`, "gu"), ` ${W.eraOur} `);
    //    `t. y.` ×7 — *tai yra*, "that is". Currently two bare consonants and two sentence breaks.
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}t\\.${SP}*y\\.`, "gu"), ` ${W.thatIs} `);
    //    COORDINATE DIRECTION SUFFIXES, and this corpus SPELLS THEM OUT beside the abbreviated form, which
    //    is as good as sourcing gets: "(54° 54′ ŠIAURĖS PLATUMOS ir 25° 19′ RYTŲ ILGUMOS)". `p. pl.` ×5,
    //    `š. pl.` ×2, `v. ilg.` ×2, `r. ilg.` ×1. The bare `°` before them is still declined (see header) —
    //    these expansions only stop `pl.` and `ilg.` reaching the g2p as vowel-less clusters plus breaks.
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}p\\.${SP}*pl\\.`, "gu"), " pietų platumos ");
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}š\\.${SP}*pl\\.`, "gu"), " šiaurės platumos ");
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}v\\.${SP}*ilg\\.`, "gu"), " vakarų ilgumos ");
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}r\\.${SP}*ilg\\.`, "gu"), " rytų ilgumos ");
    //    `t-metis` — the MILLENNIUM, *tūkstantmetis*, and the reason the one-letter `t` key below is not
    //    the tonne here. 4 instances, written four ways (`III-II t-metis`, `III t - mečio`, `II t - metis`,
    //    `II-I t - metyje`), and the corpus SPELLS IT OUT itself two paragraphs over: "X TŪKSTANTMEČIO
    //    pr. m. e. II pusėje". Only the `t-` prefix is replaced; the suffix is the writer's and carries the
    //    case, so it is re-emitted verbatim (trap 10) rather than normalised to a citation form.
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}t${SP}*-${SP}*(?=me[tč])`, "gu"), "tūkstant");

    // 2) DE-GROUP THE THOUSANDS SEPARATOR — ABOVE ranges and above every rule that reads a number, because
    //    otherwise the group boundary is read as clause punctuation or, worse, as a NUMBER: `64 000 Lt`
    //    currently reads *šešiasdešimt keturi NULIS* — the trailing `000` becomes the word "nulis", a silent
    //    1000× error of trap 56's `tg` class.
    //    ⚠ LITHUANIAN GROUPS WITH A SPACE, NOT A COMMA, WHICH INVERTS THE USUAL HAZARD. The comma is this
    //    language's DECIMAL separator (step 11), so the ordinary "de-group commas first" move would be
    //    catastrophic here — `3,628 mlrd.` is 3.628 billion and de-grouping it would report 3,628 billion.
    //    Measured: 24 space-group sites in the retained text and ALL 24 ARE GENUINE — `5 230 330`,
    //    `40 460 135`, `76 800 km`, `11 777 mm`, `15 000-20 000`, `1 385 000 000`. Zero false positives, so
    //    the guard below (left edge ends a digit run, right edge is exactly three digits) is not merely
    //    plausible, it is exhaustive over this corpus.
    //    Iterated to a FIXED POINT, because `5 230 330` has two separators and one pass consumes only the
    //    first of a pair. It used to be a `for` capped at four passes, which is a silent ceiling rather
    //    than a reason — the corpus's longest figure `1 385 000 000` needs three and the fourth was the
    //    only margin. A loop that stops when nothing changed cannot be outgrown, and terminates because
    //    every pass that does anything deletes a character.
    //    ⚠ THE RIGHT EDGE REJECTS A FOLLOWING DIGIT AND MUST NOT REJECT A FOLLOWING COMMA. It did, and the
    //    corpus's own `18 550,72 €` was the counter-example: the group `550` is followed by the DECIMAL
    //    comma, so a `(?![\d,])` guard declined it and the figure read as "18" and "550,72" — two numbers
    //    where the writer wrote one. The comma is Lithuanian's decimal point, so it is exactly what a final
    //    group is allowed to be followed by. Only a fourth digit disqualifies the group.
    const DEGROUP = new RegExp(`(?<=\\d)(?<!(?<![\\d\\.,])0)${SP}(?=\\d{3}(?!\\d))`, "gu");
    for (let prev = ""; prev !== t; ) {
        prev = t;
        t = tr(t, DEGROUP, "");
    }

    //    THE DIMENSION CROSS, FOLDED TO THE SILENCE THE `×` SIGN ALREADY HAS. The header declines to read a
    //    dimension cross — 3 instances, all "by" and not "times", with no word sourced — and `×` (U+00D7)
    //    is duly silent. The ASCII stand-in was NOT: ⟨x⟩ is not a letter of the Lithuanian alphabet, and
    //    the g2p's fallback read `110 x 46 x 21 mm` as *šimtas dešimt Z keturiasdešimt šeši Z …*, a
    //    plausible Lithuanian phoneme with no basis (trap 56, the same class as the `°C`→/t͡s/ defect this
    //    file exists to close). ONE refusal has to be spelled two ways when the corpus spells the symbol
    //    two ways; this makes the ASCII form silent exactly as the sign is, and reads nothing new.
    //    Digit-flanked only, so the ×3 multiplier prefixes `x1, x2, x3` and `x86` are untouched.
    t = tr(t, new RegExp(`(?<=\\d)${SP}*x${SP}*(?=\\d)`, "gu"), " ");

    // 3) RANGES — above the sign rules, because a spaced dash between two numbers is a SPAN and the minus
    //    rule would otherwise claim it. `prieš 50 –65 tūkst. metų` is the shape: a space before the dash and
    //    a digit after it, which is byte-identical to a negative number. Running ranges first consumes it,
    //    which is why every layer in this tree puts the range rule above the sign rule.
    //    ⚠ THE JOINER PASSES THE PART-OF-SPEECH TEST THAT SANK FULA'S `hakkunde`, AND IT HAD TO BE RUN.
    //    `iki` is a PREPOSITION governing the genitive, not an infix. Of the 15 ` iki ` in the retained text,
    //    all six that sit between two numerals have `nuo` in front of them — "nuo 0 iki 1 °C", "nuo 1 iki 6",
    //    "nuo 467 000 iki 114 000", "nuo 10 iki 1", "Nuo 1952 iki 1967 metų". Not ONE bare `N iki M`. So the
    //    rule emits BOTH halves of the correlative, which is what this corpus writes verbatim.
    //    112 ranges in the retained text (68 en-dash, 44 hyphen).
    //    ⚠ THE EDGE GUARDS WERE BOTH WRONG, IN OPPOSITE DIRECTIONS, AND THE FIX IS TO SWAP WHICH EDGE
    //    CARRIES WHICH JOB. The left edge admitted a preceding LETTER or HYPHEN and the right edge rejected
    //    a following DOT or COMMA, which is exactly backwards for this corpus:
    //      · A CATALOGUE NUMBER IS A CHAIN OF HYPHEN-JOINED DIGIT GROUPS, and with a hyphen allowed on both
    //        sides the rule asserted a `nuo`/`iki` span over one — `ISBN 978-83-01-14342-8` came back as
    //        *ISBN nuo 978 iki 83-nuo 01 iki 14342-8*, and `ISBN 84-87863-63-9` chained twice. 9 ISBNs in
    //        the retained text plus `x86-64` and `A300-600ST`. Rejecting an ADJACENT hyphen on either side
    //        declines every one of them WHOLE (the retry starts inside the chain and is rejected in turn),
    //        and rejecting an adjacent letter declines the two designations for the same structural reason.
    //      · The `(?![\d.,])` right edge meanwhile declined 8 GENUINE clause-final spans — `1962-1982.`,
    //        `1996-2005.`, `1906–1921.`, `1891–1893.`, `82-84,`, `143–145,`, `155–157.`, `2-1.` — for the
    //        one true rejection `x86-64,`, which the left edge now makes for a real reason. Same shape as
    //        the operand's own comma guard above: a separator belongs to the number only before a DIGIT.
    //    ⚠ AND A SPORTS SCORE IS NOT A SPAN — the sense split the wide rule was hiding. `Rezultatas buvo
    //    lygus (1-1)` read as *nuo vienas iki vienas*, and relaxing the right edge would have added
    //    `pergalę rezultatu 2-1.` and `pralaimėjo … komandai 155–157.` to it. A score is a PAIR, never a
    //    range, and no correlative belongs on it. The refusal keys on the words this corpus itself puts in
    //    front of its three scores — a closed list, checked only in the 50 characters before the match, and
    //    it REFUSES the whole match rather than reading half of it.
    //    ⚠ THE LIST IS SCORE-SPECIFIC VOCABULARY AND NOT MERELY SPORTS VOCABULARY, which the corpus diff
    //    had to teach: `komandai` was on it and it appears in `paskolintas Notts County KOMANDAI. 1997–1998
    //    metais`, a perfectly ordinary year span 25 characters later. A word that names the RESULT
    //    (`rezultatas`, `pergalė`, `pralaimėjo`, `lygus`) is what marks a score; a word that names a TEAM
    //    is not. Corpus-checked: these four fire on the three scores and on nothing else in 463 segments.
    //    ⚠ ANYWHERE IN THE WINDOW, NOT ONLY IMMEDIATELY BEFORE THE MATCH. `pralaimėjo LeBrono Džeimso
    //    komandai 155–157` puts three words between the verb and the score, so an end-anchored needle
    //    missed it — which is why `komandai` was on the list at all: it was doing the ANCHORING rather than
    //    the identifying. Widening the reach is what let the over-broad word come off it.
    const SCORE = new RegExp(`${NOT_LETTER_BEFORE}(?:rezultat|pergal|pralaimėj|lygus)`, "iu");
    t = tr(t,
        new RegExp(
            `(?<![\\d.,:/\\p{L}\\p{M}–—-])(\\d+(?:,\\d+)?)${SP}*[–—-]${SP}*(\\d+(?:,\\d+)?)` +
                `(?!\\d|[.,]\\d|:|[–—-])`,
            "gu",
        ),
        (m, a: string, b: string, off: number, whole: string) => {
            if (SCORE.test(whole.slice(Math.max(0, off - 50), off))) return m;
            // ⚠ DO NOT SAY `nuo` TWICE. Word-bounded and case-insensitive, for both reasons the Luganda
            // review found: `nuo` is a substring of nothing dangerous here, but it opens a sentence
            // ("Nuo 1952 iki 1967") as often as it sits mid-clause, and a case-sensitive needle would
            // double exactly those.
            // ⚠ AND NOT AFTER ANY OTHER PREPOSITION EITHER. `prieš 50 –65 tūkst. metų` ("50–65 thousand
            // years ago") already has its preposition, and prefixing the correlative gave *prieš NUO 50
            // iki 65* — a preposition stacked on a preposition. The list is closed and taken from what
            // this corpus actually writes in front of a span: nuo, iki, apie, prieš, per, tarp.
            const before = whole.slice(Math.max(0, off - 14), off);
            const hasNuo = new RegExp(`${NOT_LETTER_BEFORE}(?:nuo|iki|apie|prieš|per|tarp)${NOT_LETTER_AFTER}${SP}*$`, "iu").test(before);
            // ⚠ AND A PRECEDING `iki` SUPPRESSES THE JOINER TOO, NOT ONLY `nuo`. Suppressing half of the
            // correlative is not enough when the preposition already standing there IS the other half:
            // the corpus's `Iki VII–VIII, o vietomis iki XII` came out *iki septyni IKI aštuoni*, the
            // joiner said twice. In that frame the dash is an alternation inside one bound ("up to the
            // 7th–8th"), not a span, so the whole match is refused and the two cardinals juxtapose.
            if (new RegExp(`${NOT_LETTER_BEFORE}iki${NOT_LETTER_AFTER}${SP}*$`, "iu").test(before)) return m;
            // ⚠ A TEMPORAL SPAN DOES NOT TAKE THE CORRELATIVE. `1997–1998 metais`, `1928–1929 m.`,
            // `1969 m. vasario 8–11 d.` — the corpus writes these as a bare span with the noun after, and
            // "nuo 1997 iki 1998 metais" would put a genitive-governing preposition in front of an
            // instrumental. The joiner alone keeps the relation audible without inventing the frame.
            // ⚠ THE CENTURY IS A TEMPORAL SPAN TOO AND WAS NOT IN THIS LIST, so `XIV–XIII a.` — which
            // reaches this layer as `14–13 a.` — got the correlative that `1997–1998 m.` is denied, on the
            // identical objection: *nuo keturiolika … amžiaus* is a genitive-governing preposition in front
            // of a nominative cardinal. `a\.` and `amž` join `m\.`/`d\.`; 66 `a.` in the retained text.
            // ⚠ STATED PLAINLY RATHER THAN IMPLIED: the joiner `iki` that the temporal branch DOES emit
            // governs the genitive as well, so `1997 iki 1998 metais` carries the same case approximation
            // one word further in. It is not fixable here — the definite/ordinal year forms the frame
            // really needs are the series the header records as measured and refused — and it is kept
            // because a connective is what makes the span audible at all. What the fix above removes is the
            // SECOND, avoidable clash, not the first.
            const after = whole.slice(off + m.length, off + m.length + 10);
            const temporal = new RegExp(`^${SP}*(m\\.|d\\.|a\\.|met|dien|amž|tūkstantme)`, "u").test(after);
            const from = hasNuo || temporal ? "" : `${W.rangeFrom} `;
            // ⚠ THE LEFT OPERAND IS RE-EMITTED AS DIGITS, so the tokenizer words-ifies it downstream and no
            // rule in this file can make it AGREE. That is harmless for a masculine noun, which is the
            // citation form `numberToWords` already emits, and audible for a feminine one: `truko 2–3 val.`
            // came out *du iki trys valandos* where *dvi* is required. Only the LEFT operand is affected —
            // the unit rule claims the right one and feminises it there — so this words-ifies the left
            // operand exactly when a feminine counted noun closes the span, and leaves it as digits
            // otherwise. Zero instances in the retained text; `val.`/`t` are the only feminine keys.
            const femUnit = new RegExp(`^${SP}*(?:val\\.|min\\.|t${NOT_LETTER_AFTER})`, "u").test(after);
            return `${from}${femUnit ? feminise(bare(a)) : a} ${W.rangeTo} ${b}`;
        },
    );

    // 4) THE SIGNS, above every rule that words-ifies an operand — `-5 °C` must still have its digit when
    //    the sign rule looks, and step 5 would have turned it into *penki laipsniai* by then.
    //    ⚠ THE SIGN MUST OPEN THE TOKEN (start of string, whitespace or an opening bracket), which is what
    //    keeps it off a compound hyphen and off the ranges step 3 has already consumed. 17 signed numbers in
    //    the retained text and reading them shows they are GENUINE NEGATIVES, not ranges in disguise:
    //    `apie -5 °C`, `iki -20 °C`, `žemiau –40 °C`, `(-1,1 %)`, `(-9,73 %)` (negative population growth),
    //    `altitudė -400 m` (the Dead Sea). Omitting a plus is lossless; omitting a MINUS inverts, and this
    //    corpus contains both a `-20 °C` and a `+40 °C` in temperature articles.
    t = tr(t, new RegExp(`(^|[\\s(\\[])[-−–](?=\\d)`, "gu"), `$1${W.minus} `);
    //    The plus is read on the same guard. 3 instances — `+10,3%` (a growth rate, where the sign is
    //    contentful and contrasts with the `-1,1 %` above), `iki +40 °C` and `+54 °C`. The playbook's
    //    convention is that a measurement plus is often omitted; here `iki` means "up to", not "above", so
    //    it is not the redundant-with-a-comparative case that licenses dropping it.
    t = tr(t, new RegExp(`(^|[\\s(\\[])\\+(?=\\d)`, "gu"), `$1${W.plus} `);

    // 5) PERCENT — the operand becomes WORDS here and the noun agrees with it, which is the trap-14 fix
    //    shape and the reason this cannot go through the shared tier.
    //    ⚠ THE CORPUS DEMONSTRATES THE CONCORD ITSELF, which is what makes `agree()` sourced rather than
    //    asserted: lt.wikipedia writes "(2 procentai)", "(5 procentai)", "(17 procentų)", "5 procentai, bet
    //    ne daugiau kaip 10 procentų" — nom pl after 2 and 5, gen pl after 10 and after the teen 17, exactly
    //    the split `agree()` implements for the magnitude nouns.
    //    ⚠ THE SPACE BEFORE `%` IS THE NORMAL LITHUANIAN FORM, not an edge case: this corpus writes `50 %`,
    //    `99 %`, `1,9 %`, `76,5 %` with the SI space far more often than glued. A rule requiring adjacency
    //    would have missed almost all of them. 119 signs + `proc.` ×11 in the retained text.
    t = tr(t, new RegExp(`${NUM}${SP}*%`, "gu"), (_m, num: string) => quantity(num, N.percent));
    //    ⚠ THE DOT AFTER `proc` IS OPTIONAL AND THE WORD BOUNDARY IS WHAT IDENTIFIES IT. Requiring the dot
    //    lost the percent entirely on `21,2 proc;` and left `proc` to be read as a word. `procentai`,
    //    `procesas` and `procesorius` — all frequent in this corpus — are excluded by `NOT_LETTER_AFTER`, not by the dot.
    t = tr(t,
        new RegExp(`${NUM}${SP}*proc${NOT_LETTER_AFTER}\\.?`, "gu"),
        (_m, num: string) => quantity(num, N.percent),
    );

    // 6) DEGREES — `°C` / `°F` only; the bare `°` is declined whole (see the header). POSTPOSED scale name,
    //    which is this corpus's own order: `laipsnių Celsijaus` ×13/11 against `Celsijaus laipsnių` ×3/3.
    //    ⚠ AND THE SCALE LETTER IS WHY THE WHOLE MATCH MATTERS. ⟨C⟩ is a real Lithuanian grapheme reading
    //    /t͡s/, so today `17 °C` comes out *septyniolika t͡s* — a plausible Lithuanian phoneme with no basis,
    //    which is trap 56 rather than a visible leak, and no DROP class can see it. 31 instances.
    //    ℃ (U+2103) is folded to `°C` at the registry's dispatch point, above this layer (trap 36).
    t = tr(t,
        new RegExp(`${NUM}${SP}*°${SP}*C${NOT_LETTER_AFTER}`, "gui"),
        (_m, num: string) => `${quantity(num, N.degree)} ${W.celsius}`,
    );
    t = tr(t,
        new RegExp(`${NUM}${SP}*°${SP}*F${NOT_LETTER_AFTER}`, "gui"),
        (_m, num: string) => `${quantity(num, N.degree)} ${W.fahrenheit}`,
    );

    // 7) UNITS. Local, agreeing, and ordered longest-key-first so `km` is tried before `m` and `km²` before
    //    `km`. Every operand is anchored on both edges (trap 52).
    //    ⚠ THE SQUARED MODIFIER AGREES TOO, and it PRECEDES its noun: `kvadratinių kilometrų` ×19/18, every
    //    hit an area ("Šalies plotas – 1 267 000 kvadratinių kilometrų"). The ASCII `km2` form is claimed
    //    beside `km²`, because leaving it would let the tier-less path read the `2` as a NUMBER — trap 53's
    //    Igbo defect, "790 kilometres two", which is invisible to every leak class.
    //    ⚠ A `/` ON EITHER SIDE BLOCKS THE MATCH, AND BOTH HALVES OF THAT GUARD WERE EARNED. A LEADING
    //    slash: `140–160 kcal/cm²` is refused whole rather than half, because `kcal` is not a declared
    //    numerator and emitting the denominator alone would leave it raw beside a reading that implies it
    //    was understood. A TRAILING slash: the first cut of this rule had no such guard and read
    //    `500 m/s` as *penki šimtai METRŲ/s* — it claimed the numerator of a RATE and left the denominator
    //    raw, which is strictly worse than the two raw letters it replaced. 8 rates in the retained text
    //    (`500 m/s`, `90 m/s`, `16 m/s`, `515,3 km/val.`, `1,5 Mbit/s` ×3, `1,32 MB/s`) and no rate word is
    //    declared, so all 8 are refused WHOLE. Trap 54's `si` case in both directions.
    //    ⚠ A MAGNITUDE MAY STAND BETWEEN THE FIGURE AND ITS UNIT, AND THIS STEP MUST CLAIM IT — the
    //    playbook's "One declaration, two consumers" note, found by the corpus diff rather than reasoned
    //    to. `Lietuva plotu (65,3 TŪKST. km²)` is the shape, ×6 in one Baltic-geography paragraph
    //    (`30,5 tūkst. km²`, `43,1 tūkst. km²`, `83,9 tūkst. km²`, `78,9 tūkst. km²`, `64,6 tūkst. km²`).
    //    Step 9 below words-ifies `65,3 tūkst.` and thereby destroys the number–unit adjacency this step
    //    matches on, so the `km²` was orphaned and reached the IPA raw — the unit step declining, and the
    //    magnitude step having no idea a unit was behind it. Claiming both here is the fix trap 14
    //    prescribes: once a rule stops re-emitting its operand verbatim it owns whatever the later steps
    //    can no longer see. After a magnitude the unit is always the GENITIVE plural.
    const MAG_MID = `(?:${SP}*(mlrd|mln|tūkst)\\.?)?`;
    const UNITS: readonly [string, LithuanianAgreement, boolean][] = [
        ["km", N.kilometre, true], ["mm", N.millimetre, true], ["cm", N.centimetre, true],
        ["kg", N.kilogram, true], ["ha", N.hectare, true],
        // `mg` was in neither this list nor the header's declined list, so it was simply MISSING: the scan
        // reported it as a live `LEAK RAW-LATIN mg` on `100 g produkto būna 25-100 mg sorbatų`. The rate
        // `12,5 mg/kg` in the same sentence stays refused whole by the slash guard.
        ["mg", N.milligram, false],
    ];
    for (const [key, forms, squarable] of UNITS) {
        if (squarable) {
            t = tr(t,
                new RegExp(`(?<![/\\p{L}])${NUM}${MAG_MID}${SP}*${key}${SP}*[²2]${NOT_LETTER_AFTER}`, "gu"),
                (_m, num: string, mag: string | undefined) => {
                    const forced = mag !== undefined || num.includes(",");
                    const q = forced ? `${bare(num)}${magWords(num, mag)} ${forms.gen}` : quantity(num, forms);
                    const sq = forced ? N.squared.gen : agree(Number(num.split(",")[0]), N.squared);
                    const words = q.split(" ");
                    // The modifier goes immediately before the noun it agrees with, which is the last word.
                    return `${words.slice(0, -1).join(" ")} ${sq} ${words.at(-1)}`;
                },
            );
        }
        // ⚠ THE RIGHT GUARD REJECTS `/` AND NOTHING ELSE — IT MUST NOT CARRY THE DOT. It briefly did, and
        // the corpus diff caught it declining every CLAUSE-FINAL figure: `plotis siekia ~5000 km.` and
        // `neviršija 600 km.` came back untouched, leaving a raw `km` in the phoneme stream, which is
        // precisely what this step exists to close. 7 `km.` in the retained text. The dot is load-bearing
        // only for the ONE-LETTER `m` key below, where it is the year/metre discriminator; for a
        // two-letter key it rejects real readings and buys nothing. A guard is only free when it rejects
        // something (the same mistake the Luganda review had to undo, at the other end of its file).
        t = tr(t,
            new RegExp(`(?<![/\\p{L}])${NUM}${MAG_MID}${SP}*${key}${NOT_LETTER_AFTER}(?!/)`, "gu"),
            (_m, num: string, mag: string | undefined) =>
                mag === undefined
                    ? quantity(num, forms)
                    : `${bare(num)}${magWords(num, mag)} ${forms.gen}`,
        );
    }
    //    ⚠ THE ONE-LETTER `m`, `t` AND `g` KEYS, AND THE DOT IS THE DISCRIMINATOR THAT DOES MOST OF THE
    //    WORK WITHOUT DOING ALL OF IT. `m.` with a dot is the YEAR ×346 against ×1 metre, and bare `m` is
    //    the METRE ×17 against ×1 year; the header tabulates both residuals and neither is closable from
    //    this evidence. So `m` is the metre only when NO dot follows, it must be SPACED from its number —
    //    every one of the 17 genuine metres is (`8850 m`, `1620 m`, `-400 m`, `250–300×150 m`), which makes
    //    the version shape `802.11m` unreachable for free — and the dot in the right guard is LOAD-BEARING
    //    rather than the free-looking guard the Luganda review deleted.
    //    ⚠ THE KNOWN COST, MEASURED RATHER THAN ASSUMED UNREACHABLE: `kurios vidutinis aukštis 174 m.
    //    Liūčių laikotarpio metu` IS in the retained text and DOES read as a year. The header carries the
    //    count; it is one instance in 347 and no feature of the string separates it.
    //    ⚠ `g` IS THE GRAM ON THE SAME SHAPE AND THE SAME GUARDS. ×1 in the retained text (`Jis sveria
    //    90 g,`), where it reached the g2p as a bare *ɡ* — a consonant, not even a letter name. Requiring
    //    the space is also what keeps `mg` and `kg` off this key, and `802.11g` is declined by the
    //    operand's own anchor. The `(?![/.])` right guard is carried across from `m` for the rate case and
    //    because `g.` before a figure is *gimė* ("born") in this corpus's biography lines.
    //    ⚠ AND `t` HAD A COUNTER-EXAMPLE THAT OUTNUMBERS ITS TRUE POSITIVE 3:1, WHICH THE CORPUS ONLY
    //    SHOWS AFTER THE ROMAN PASS: `III t - mečio pr. m. e.`, `II t - metis`, `III-II t-metis` and
    //    `II-I t - metyje` are *tūkstantmetis*, the MILLENNIUM, and they arrive here as `3 t - mečio`.
    //    They were being read as TONNES — *trys tonos mečio* — against a single genuine `20 000 t durpių`.
    //    A HYPHEN AFTER THE KEY, spaced or not, is the whole discriminator and it rejects all four; this is
    //    trap 46 again, found by reading the leak list rather than by suspecting the key.
    const ONE_LETTER: readonly [string, LithuanianAgreement, string][] =
        [["m", N.metre, ""], ["t", N.tonne, `|${SP}*[-–—]`], ["g", N.gram, ""]];
    for (const [key, forms, extra] of ONE_LETTER) {
        //    ⚠ A MAGNITUDE MAY STAND HERE TOO — `20 tūkst. t durpių` is the shape, and without `MAG_MID`
        //    the two-letter keys above claimed it and these three did not, which is a difference with no
        //    reason behind it. After a magnitude the unit is the genitive plural, as everywhere else.
        t = tr(t,
            new RegExp(`(?<![/\\p{L}])${NUM}${MAG_MID}${SP}${key}${NOT_LETTER_AFTER}(?![/.]${extra})`, "gu"),
            (_m, num: string, mag: string | undefined) =>
                mag === undefined
                    ? quantity(num, forms)
                    : `${bare(num)}${magWords(num, mag)} ${forms.gen}`,
        );
    }

    // 8) CURRENCY — POSTPOSED, which is this corpus's own order in every spelled-out instance it has:
    //    "9 986 mlrd. JAV dolerių", "16,27 mlrd. eurų veikusiomis kainomis", "251 eurų pajamos",
    //    "50 000 JAV dolerių bauda". The SIGN however is written on both sides (`€151 mln.`, `€ 500`,
    //    `£600 000`, `$1300` before; `5713 $`, `18 550,72 €`, `61,40 mlrd €` after), so both are claimed and
    //    both emit the noun after the number.
    //    ⚠ THE MAGNITUDE SITS BETWEEN THE FIGURE AND THE CURRENCY and must be claimed by this rule, because
    //    once the number is words the later magnitude step can no longer see it (the playbook's "One
    //    declaration, two consumers" note, and trap 14's "then expand anything the shared tier can no longer
    //    see"). With a magnitude the currency is always the genitive plural.
    //    ⚠ AND THE CURRENCY IS OFTEN ALREADY SPELLED OUT BESIDE ITS SIGN — trap 12. `$90 milijonų dolerių`
    //    and `9 986 mlrd. JAV dolerių` say it once already, so `saidNear` suppresses the word and keeps the
    //    sign silent, which is the language-idiomatic position rather than a drop.
    const CURRENCIES: readonly [string, LithuanianAgreement, readonly string[]][] = [
        ["€", N.euro, EURO_FORMS], ["\\$", N.dollar, DOLLAR_FORMS],
        ["£", N.pound, POUND_FORMS], ["Lt", N.litas, LITAS_FORMS],
    ];
    //    ⚠ AND THE MAGNITUDE IS SOMETIMES SPELLED OUT RATHER THAN ABBREVIATED, WHICH PUTS THE CURRENCY IN
    //    THE WRONG SLOT IF THE RULE ONLY KNOWS THE ABBREVIATION. `$24 MILIJONUS kasmet` came out
    //    *dvidešimt keturi DOLERIAI milijonus* — the currency noun wedged between the count and its
    //    magnitude, which is the Indonesian `US$` defect in this playbook's closing section
    //    (*empat belas koma tujuh DOLAR MILIAR*). A spelled magnitude is RE-EMITTED VERBATIM (trap 10: a
    //    rule that consumes a word must put it back — and its case was chosen by the writer, not by us)
    //    and the currency follows it in the genitive.
    const MAG_SPELLED = "milijon\\p{L}*|milijard\\p{L}*|tūkstan\\p{L}*";
    for (const [sign, forms, spelled] of CURRENCIES) {
        const money = (num: string, mag: string | undefined, tail: string): string => {
            const abbrev = mag !== undefined && /^[\s\u00a0]*(?:mlrd|mln|tūkst)/u.test(mag);  // NBSP
            const n = Number(num.split(",")[0]);
            const numWords = bare(num);
            const magPart = mag === undefined ? "" : abbrev ? magWords(num, mag) : ` ${mag.trim()}`;
            // Don't say it twice — and when the noun is already there, the whole reading is the tail's.
            if (saidNear(tail, spelled)) return `${numWords}${magPart} `;
            const noun = mag !== undefined || num.includes(",") ? forms.gen : agree(n, forms);
            return `${numWords}${magPart} ${noun} `;
        };
        // Sign BEFORE the figure. `US$` / `JAV $` keep their letters; only the sign is claimed.
        t = tr(t,
            new RegExp(`${sign}${SP}*${NUM}(${SP}*(?:(?:mlrd|mln|tūkst)\\.?|${MAG_SPELLED})${NOT_LETTER_AFTER})?`, "gu"),
            (m, num: string, mag: string | undefined, off: number, whole: string) =>
                money(num, mag, nextWords(whole.slice(off + m.length), 2)),
        );
        // Sign AFTER the figure.
        t = tr(t,
            new RegExp(`${NUM}(${SP}*(?:(?:mlrd|mln|tūkst)\\.?|${MAG_SPELLED})${NOT_LETTER_AFTER})?${SP}*${sign}${NOT_LETTER_AFTER}`, "gu"),
            (m, num: string, mag: string | undefined, off: number, whole: string) =>
                money(num, mag, nextWords(whole.slice(off + m.length), 2)),
        );
    }

    // 9) THE REMAINING MAGNITUDE ABBREVIATIONS — `mln.` ×18, `mlrd.` ×8, `tūkst.` ×27, whatever the currency
    //    step did not already claim. espeak supplies both (`mln  m;il;ij'o:nai_`, `tūkst  t'u:kstantS;ei_`)
    //    and the nouns are the engine's OWN magnitude table, so nothing new is authored here.
    //    ⚠ A MAGNITUDE GOVERNING A FOLLOWING NOUN TAKES THE GENITIVE, and the corpus writes both frames
    //    within one article: "37 TŪKSTANČIŲ hektarų" and "19 tūkst. hektarų" against a bare "20 tūkst."
    //    with nothing after it. So the concord is `agree()` normally and the genitive when a lowercase noun
    //    follows — which also gets "2,048 mln. keleivių" and "9 986 mlrd. JAV dolerių" right.
    for (const [re, forms] of MAGS) {
        t = tr(t,
            // ⚠ THE KEY NEEDS A WORD BOUNDARY AFTER IT, WHICH IT DID NOT HAVE. `tūkst` is five characters
            // inside *tūkstantmetis* and inside the spelled-out *tūkstančių* itself, so `2 tūkstantmetis`
            // was consumed as `2 tūkst` + a leftover `antmetis` (*du tūkstančių ANTMETIS*) and the corpus's
            // own `37 tūkstančių hektarų` was rewritten on top of a word that was already correct. Trap 12's
            // other half: a needle that matches inside a longer word.
            new RegExp(`${NUM}${SP}*(${re.source})${NOT_LETTER_AFTER}\\.?`, "gu"),
            (m, num: string, _k: string, off: number, whole: string) => {
                const n = Number(num.split(",")[0]);
                // A magnitude GOVERNING a following noun takes the genitive. Any letter, not only a
                // lowercase one: `9 986 mlrd. JAV dolerių` puts an ACRONYM in the slot and a
                // lowercase-only test read it as a bare magnitude (*milijardai JAV dolerių*).
                // ⚠ BUT "ANY LETTER" ALSO MATCHED TEXT THIS LAYER ITSELF INSERTED, WHICH IS A COUPLING THE
                // LAYER CREATED AND THEN TRIPPED OVER. Step 1 rewrites `pr. m. e.` to *prieš mūsų erą*, so
                // by the time this rule looks at `IV tūkst. pr. m. e. pabaigoje` the slot holds a
                // PREPOSITION, not a noun — and the genitive fired, giving *keturi tūkstančių* where
                // `agree(4)` gives *tūkstančiai*. 5 instances in the retained text, all `N tūkst. pr. m. e.`
                // The exclusion is the era words themselves, taken from the manifest rather than spelled
                // again here, so the two rules cannot drift apart.
                const tail = whole.slice(off + m.length, off + m.length + 8);
                const governs = new RegExp(`^${SP}*\\p{L}`, "u").test(tail) && !ERA_HEAD.test(tail);
                const noun = num.includes(",") || governs ? forms.gen : agree(n, forms);
                return `${bare(num)} ${noun} `;
            },
        );
    }

    //    ⚠ AND A MAGNITUDE WHOSE FIGURE THIS LAYER DECLINED IS STILL EXPANDED, for the reason the `val.`
    //    mop-up below gives. `55.89 mlrd €` is an English-format decimal, which the operand anchor refuses
    //    outright and correctly — and that left `mlrd` alone in the phoneme stream as a raw four-consonant
    //    cluster (the scan's `LEAK RAW-LATIN mlrd`). Refusing to read the NUMBER is not a reason to hand
    //    the abbreviation back to the g2p. With no count to agree with, the genitive plural (trap 14).
    for (const [re, forms] of MAGS)
        t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}(?:${re.source})${NOT_LETTER_AFTER}\\.?`, "gu"), ` ${forms.gen} `);

    // 10) THE DATE ABBREVIATIONS — the single biggest class in this corpus, and the one whose defect is a
    //     spurious SENTENCE BREAK rather than a bad word. `abbrev` is ×530,349 whole-corpus.
    //     ⚠ `m.` ×347. Which form of *metai* is not a guess — the corpus SPELLS OUT both frames beside the
    //     abbreviated one, which is the trap-4 tabulation done on the language's own text:
    //       · before a MONTH NAME → the genitive: "1936 METŲ liepos 24 dieną", "1999 METŲ sausio mėnesį",
    //         "2000 metų vasario mėnesį". 12 month names, ~50 of the 347 instances.
    //       · otherwise → the instrumental: "1997 METAIS", "1990 metais", "2006 metais", "1997–1998 metais".
    //         `metais` ×21 directly after a numeral in the retained text.
    //       · AND A SMALL OPERAND IS A QUANTITY OF YEARS, NOT A DATE — the 1–2 digit and decimal cases are
    //         life expectancies and ages: "Šveicarijoje – 83,4 m.", "Lietuvoje – 73,6 m.", "Jogailos 13 m.
    //         sūnų". Those take the genitive too ("83,4 metų"), so the operand length is a real branch and
    //         not a heuristic: 11 one-digit, 3 two-digit, 7 three-digit, 326 four-digit.
    //     ⚠ AND THIS RULE IS DELIBERATELY CASE-SENSITIVE, WHICH INVERTS TRAP 7. A capital `M.` is not a
    //     year in this corpus — all 6 are a PERSONAL INITIAL (`M. Jakobas Šlaidenas`, `K. Miramas`) — so
    //     admitting the capitalised variant, which trap 7 normally demands, would read a person's initial
    //     as *metais*. The initialism pass claims those instead. Probed: `2000 M.` is left alone.
    const MONTHS = NRM.monthsGen.join("|");
    t = tr(t,
        new RegExp(`${NUM}${SP}*m\\.(${SP}*(?:${MONTHS})${NOT_LETTER_AFTER})?`, "gu"),
        (_m, num: string, month: string | undefined) => {
            const small = !num.includes(",") && num.length <= 2;
            const noun = month !== undefined || num.includes(",") || small ? W.yearGen : W.yearInstr;
            return `${bare(num)} ${noun}${month ?? ""} `;
        },
    );
    //     `d.` ×57 — every one a day of the month, and the corpus spells the exact shape it abbreviates:
    //     "1936 metų liepos 24 DIENĄ" against "1930 m. balandžio 7 d.".
    //     ⚠ *diena* IS FEMININE AND THE NUMERAL WAS NOT. `balandžio 7 d.` came out *septyni dieną* and
    //     `sausio 1 d.` *vienas dieną*, the masculine citation form `numberToWords` emits standing in front
    //     of a feminine noun — the same defect `feminise()` was written for and was wired only to *valanda*
    //     and *tona*. 40 of the 57 instances end in a gender-marked 1–9, so it is audible in most of them.
    //     ⚠ WHAT THIS DOES NOT FIX, SAID PLAINLY: the day of a date is an ORDINAL in the ACCUSATIVE
    //     (*septintą dieną*), and the ordinal series is the one the header records as measured and refused.
    //     The gender is now right and the case and the ordinal are still wrong; this is the closable half.
    t = tr(t,
        new RegExp(`${NUM}${SP}*d\\.`, "gu"),
        (_m, num: string) => `${feminise(bare(num))} ${W.day} `,
    );
    //     `a.` ×66 — the century, and it arrives here as DIGITS. ⚠ THE ROMAN NUMERAL IS ALREADY GONE:
    //     Lithuanian is not in `registry.ts`'s `ROMAN_NATIVE`, so `normalizeRomans` wraps `engine.text()`
    //     and `XIX a.` is `19 a.` before anything in this file runs. Verified end-to-end with a test through
    //     the real phonemizer on `XV`, whose letters would be spelled if the order were wrong (trap 16).
    //     The GENITIVE is the majority frame, tabulated on what follows: attributive nouns and the
    //     part-of-century words — `XIX a. biologai`, `XIV a. pabaigos`, `XVII a. pradžioje`, `XX a. antros
    //     pusės`, `XX a. 6-ojo dešimtmečio` — outnumber the adverbial-locative frame (`X a. buvo`,
    //     `V a. prasidėjo`) about two to one. The numeral stays cardinal; see the header.
    t = tr(t, new RegExp(`${NUM}${SP}*a\\.`, "gu"), (_m, num: string) => `${bare(num)} ${W.centuryGen} `);
    //     `val.` ×5 (hours), `min.` ×1 and `mėn.` ×3 (month), each after a numeral or a month name.
    t = tr(t, new RegExp(`${NUM}${SP}*val\\.`, "gu"), (_m, num: string) => quantity(num, N.hour));
    //     `min.` ×1 — "ilgiausia Lietuvoje pūga, kuri truko 78 val. 25 MIN." It was in neither this step
    //     nor the header's declined list, so it simply reached the g2p as *mʲɪn* plus a sentence break.
    //     Feminine like *valanda*; the sourcing is in lithuanian.jsonc and is wiki-only, not espeak.
    t = tr(t, new RegExp(`${NUM}${SP}*min\\.`, "gu"), (_m, num: string) => quantity(num, N.minute));
    //     ⚠ AND THE ABBREVIATION IS EXPANDED EVEN WHEN ITS FIGURE IS A CLOCK FIELD THIS LAYER REFUSES.
    //     `(19:11 val. UTC)` and `8:00 - 19:00 val.` are the corpus's two of these: the colon guards above
    //     now correctly decline the numeral, and without this line the `val.` they leave behind would go
    //     back to being a vowel-less cluster plus a spurious sentence break — the defect the whole step
    //     exists to close, reintroduced by the refusal. The GENITIVE PLURAL is the form used when the
    //     numeral is not claimed, because there is no count for the noun to agree with (trap 14 again).
    //     A LEADING `/` still blocks it: `515,3 km/val.` is a RATE with no rate word declared, and it is
    //     refused whole by the unit step — expanding its denominator here would be exactly the half-read
    //     that guard exists to prevent (trap 53).
    t = tr(t, new RegExp(`(?<![/\\p{L}\\p{M}])val\\.`, "gu"), ` ${N.hour.gen} `);
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}[Mm]ėn\\.`, "gu"), ` ${W.month} `);

    // 11) THE REMAINING SINGLE-DOT ABBREVIATIONS. Each currently reaches the g2p as a vowel-less cluster
    //     PLUS a spurious sentence break. `pvz.` ×10 (*pavyzdžiui*), `kt.` ×6 (in the frozen `ir kt.`),
    //     `Nr.` ×3 (espeak `nr  n'um;er;is`), `psl.` ×1 and `gyv.` ×2 (`BVP/1 gyv.`).
    //     ⚠ THESE KEYS WERE WRITTEN CASE- AND SPELLING-NARROW AND THE CORPUS DOES NOT COOPERATE — trap 7 in
    //     the ordinary direction, unlike the `m.`/`M.` rule above where the capital genuinely means
    //     something else. `Nr.` was already written `[Nn]r\.`, so the convention was known when the rest
    //     were written; what the narrow ones cost, measured:
    //       · `pvz.` — the corpus's SENTENCE-INITIAL `Pvz., vanduo yra junginys` was declined and read
    //         *pʋz* plus a break. A sentence-initial capital is not a different word.
    //       · `psl.` — the corpus's ONLY instance is `Psl 47`, capitalised AND with no dot, so the rule as
    //         written matched nothing at all in this corpus while looking like it covered the class.
    //       · `proc.` (step 5) — `21,2 proc;` loses the percent AND reads `proc` as a word. The dot is one
    //         of several marks a writer ends the abbreviation with; the WORD BOUNDARY is what identifies
    //         it, and `procentai`/`procesas`/`procesorius` are all excluded by that boundary, not by the
    //         dot. Made optional there for the same reason it is made optional here.
    //     A capital `D.`, `A.` or `M.` really is a personal initial in this corpus, so those three rules
    //     stay case-sensitive — but each of them also requires a NUMERAL in front, which is the guard doing
    //     the actual work. These five require no numeral, so the case tolerance costs nothing.
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}[Pp]vz\\.`, "gu"), ` ${W.forExample} `);
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}ir${SP}+kt\\.`, "giu"), ` ${W.etCetera} `);
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}[Nn]r\\.`, "gu"), ` ${W.number} `);
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}[Pp]sl${NOT_LETTER_AFTER}\\.?`, "gu"), ` ${W.page} `);
    t = tr(t, new RegExp(`${NOT_LETTER_BEFORE}[Gg]yv\\.`, "gu"), ` ${W.inhabitants} `);

    // 12) THE DECIMAL COMMA — LAST of the number rules, because every rule above reads its operand as
    //     DIGITS and this one destroys them. That inverts the fleet's usual "de-group first" ordering for a
    //     specific reason: in Lithuanian the comma IS the decimal separator, so there is no grouping comma
    //     to clear out of the way, and the units/percent/degree steps need the number-unit adjacency the
    //     playbook's step-4 coupling protects. 185 decimal commas in the retained text; today every one is
    //     read as a CLAUSE PAUSE inside the number.
    //     ⚠ THE KNOWN COST, MEASURED — AND THE OPERAND ANCHOR ABSORBS MOST OF IT. This wiki carries an
    //     Australian-states area table in ENGLISH number format, which is trap 34's contamination arriving
    //     inside one paragraph rather than one article. Two shapes, and they fare differently:
    //       · `12,367.7 km²`, `6,417.9`, `3,259.8`, `4,698,672` — a second comma or a dot decimal. The
    //         `(?<![\d.,])…(?![\d.,])` anchor (trap 52) rejects these OUTRIGHT, so they are left exactly
    //         as they were rather than misread. That is a side benefit of anchoring the operand, not a
    //         guard written for this, and it is recorded because it is easy to assume otherwise.
    //       · A single comma with no dot — `9,993 km²`, `15,842 km²`, `1,334 km²`, `1,252 km²`, `2,291`,
    //         `319,922`, `252,217` — is indistinguishable from a Lithuanian decimal and IS read as one.
    //         7 instances, against 185 genuine decimal commas and against `3,628 mlrd.` / `2,048 mln.` /
    //         `0,025` / `0,100`, which have the identical shape and ARE decimals. The comma is this
    //         language's decimal separator; de-grouping it would turn 3.628 billion into 3,628 billion, a
    //         silent 1000× error (trap 56's `tg` class). 7 misreads is the correct price for not risking
    //         that, and it is stated rather than hidden.
    t = tr(t,
        new RegExp(`(?<![\\d.,])(\\d+),(\\d+)(?![\\d.,])`, "gu"),
        (_m, a: string, b: string) => `${a} ${W.decimalPoint} ${b.split("").join(" ")}`,
    );

    // 13) THE AMPERSAND — dropped outright today, which FUSES its neighbours: `Stafecka, A. & Mikuleniene`
    //     runs the two names together with no separation at all (traps 18/26, the merge defect). Spaced on
    //     both sides, always. ×4, all inside bibliographic citations, and `ir` is the language's ordinary
    //     conjunction. `&amp;` is decoded above this layer but is folded here for a raw-text caller.
    t = tr(tr(t, /&amp;/gu, "&"), /\s*&\s*/gu, ` ${W.and} `);

    // The insertions above pad with spaces so a word never fuses with its neighbour; collapse the runs.
    return t.replace(/[ \t]{2,}/gu, " ");
}

/**
 * THE INITIALISM PASS — `initialism` ×268,062 and `letter-name` ×144,444 whole-corpus, the largest untreated
 * class this language had. Today `TSRS` → *tsrs*, `BVP` → *bʋp*, `DVB`, `LDK`, `FC`, `TV` — vowel-less
 * clusters, exactly what `core/initialisms.ts` exists to prevent.
 *
 * ⚠ TRAP 16 CHECKED AND THE SEAM GENUINELY CAN BE FED, which is why this is wired rather than deferred:
 * `sources.ts --lang lt` reports "espeak 35 letters — WIREABLE", and the letter block of
 * `dictsource/lt_list` is a real orthographic fact rather than a guess. Being PHONETIC it cannot hand over
 * spellings, so each was written from the mnemonic and round-tripped through this repo's own g2p
 * (playbook §5c). 26 of 29 reproduce espeak exactly; the three that differ are:
 *   · `g` — espeak writes `gee` with no palatalization mark, ours gives ɡʲeː. This engine's velar rule is
 *     validated against the wikipron referee and espeak's own `k`/`c` entries carry the mark, so the
 *     omission is espeak's. The letter is unaffected either way.
 *   · `e` — espeak `ea` against our ɛ, which is espeak's notation for the stressed variant; this manifest
 *     folds stress-conditioned quality by design (see lithuanian.jsonc's header).
 *   · `y` — espeak `i:gr;ek` has a LONG initial vowel, so the spelling is `ygrek` (⟨y⟩ = iː) rather than
 *     `igrek` (⟨i⟩ = ɪ). Chosen to match espeak, which is the only source there is.
 *
 * ⚠ ORDERING, VERIFIED END-TO-END RATHER THAN ASSERTED. It runs AFTER `normalizeLithuanian`, so the
 * abbreviation dots are already spent — `1802 m.` is *metais* by now and not EM, and `IV a. pr. m. e.` is
 * the era phrase and not four letter names. And it runs after the shared ROMAN pass, which is not in this
 * file at all: Lithuanian is not in `registry.ts`'s `ROMAN_NATIVE`, so `XIX`, `XV` and `II` are digits
 * before anything here sees them. A test pins that through the real phonemizer with `XV`, an operand whose
 * letters would be spelled out if the order were wrong.
 */
export function normalizeLithuanianInitialisms(text: string): string {
    return makeInitialismNormalizer({
        letterName: (l) => NRM.letterNames[l],
        acronymLetters: new Set(NRM.acronymLetters),
        // Lithuanian has no in-engine pronunciation dictionary — the g2p is a context-free rule scan and
        // the wikipron referee is an evaluation set, not a lookup — so, as in fi/sv/de/nl, every lexical
        // fact lives in `acronymLetters` instead.
        isRecorded: () => false,
        isUnreadable: isUnreadableLithuanian,
    })(text);
}

/**
 * Can this letter run be read as a Lithuanian word at all? Deliberately conservative — the load-bearing
 * signal is the absence of a vowel, which is what every acronym this corpus leaks has in common (`TSRS`,
 * `BVP`, `DVB`, `LDK`, `JT`, `TV`, `BSD`, `FC`). Anything with a vowel is left to the OOV g2p unless
 * `acronymLetters` records that convention spells it out.
 *
 * ⚠ NO DIGRAPH FOLD IS NEEDED HERE, unlike Hungarian's `ENSZ`: Lithuanian's digraphs ⟨ch dz dž⟩ are
 * marginal and none of them appears in an acronym in this corpus. Said explicitly because the shared
 * helper's header warns about exactly that omission.
 */
const isUnreadableLithuanian = makeUnreadableTest({
    vowels: /[aeiouyąęėįųū]/u,
    // Lithuanian permits a wide range of initial clusters; these are the two-consonant onsets its own
    // vocabulary writes (pr-, kr-, sl-, šv-, žm-, kn-, dv-, tv-, kv-, gv- …).
    legalOnsets: new Set([
        "pr", "br", "tr", "dr", "kr", "gr", "pl", "bl", "kl", "gl", "sl", "sm", "sn", "sp", "st", "sk",
        "sv", "kv", "gv", "dv", "tv", "šv", "šm", "šn", "šp", "št", "šk", "žm", "žv", "žl", "zn", "kn",
        "gn", "mn", "vl", "vr", "ml", "mr", "ps", "pt", "kt", "cv", "čr",
    ]),
    legalCodas: new Set([
        "rs", "rt", "rd", "rk", "rg", "rn", "rm", "rb", "ls", "lt", "ld", "lk", "lg", "lb", "ns", "nt",
        "nd", "nk", "ng", "st", "sk", "ts", "ms", "mt", "mb", "ks", "ps", "pt", "št", "žt", "kt", "nč",
    ]),
});
