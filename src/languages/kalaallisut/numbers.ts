/**
 * Kalaallisut / West Greenlandic (kl) cardinal number → words. **SYSTEM: SPLIT AT 12 — NATIVE Greenlandic 0–12,
 * DANISH LOAN NUMERALS (in Danish orthography) from 13 up.** This is the native-vs-borrowed decision for kl, and
 * it is the one in this batch with genuinely hard empirical backing rather than a judgement call.
 *
 * ⚠ WHY NOT THE TRADITIONAL VIGESIMAL SYSTEM. Greenlandic's inherited system is base-20 and beautifully
 *   transparent — `arfineq` 'other hand' builds 6–10, `aqqaneq` 'going down' (to the feet) builds 11–15,
 *   `arfersaneq`/`isikkaneq` 'other foot' builds 16–20, and 20 is `inuk naallugu` 'a whole person'. But:
 *     - **it stops at 20.** In Oqaasileriffik's own reference analyser (the normative Greenlandic FST) there is NO
 *       native numeral above 20 at all — no inuk-based multiples, no native 40/60/100. `inuk` occurs only as an
 *       ordinary noun and `naallugu` only as the verb naallup-.
 *     - **16–20 are already tagged `+Orth/Arch`** (archaic) in that analyser, and Wikipedia's table (citing Dorais
 *       2010) stops at 12.
 *     - Rasmussen's 1887 grammar, describing the base-20 "second person" system (inuup aappassaani qulit = 30),
 *       calls it impractical and notes that Greenlanders "for numbers over 20 almost always use Danish numbers."
 *   So generating native forms above 12 would mean **inventing** them. We do not. We stop the native series at 12,
 *   which is exactly where the modern descriptive sources stop it.
 *
 * ⚠ WHY DANISH, AND WHY IN DANISH SPELLING — the empirical test. Greenlandic selects its suffix allomorph by
 *   whether the host word ends in a vowel or a consonant (absolutive plural `-t` after V, `-it` after C). So the
 *   suffix attached to a *digit* in real text reveals how that digit is being READ ALOUD. Over the 833 980-word
 *   GiellaLT/Oqaasileriffik speller corpus (news, literature, official prose):
 *     4 → `-t` (Danish *fire*, V) · 6 → `-it` (*seks*, C) · 8 → `-t` (*otte*, V) · 12 → `-it` (*tolv*, C, 5×) ·
 *     14–19 → `-it` (*-ten*, C) · **20/30/40 → `-t` (*tyve/tredive/fyrre*, V — 18/16/18 occurrences)** ·
 *     **50–90 → `-it` (*halvtreds/tres/halvfjerds/firs/halvfems*, C)** · 100 → `-t` (*hundrede*, V, 15×).
 *   The 20/30/40-vowel vs 50–90-consonant shape is a Danish signature and matches **no other language**. A second,
 *   independent test on the date allomorph `-ani`/`-iani` (13–19 take `-iani`, 20–31 take `-ani`) gives the same
 *   split. Spelled-out corpus tokens confirm it directly: `syvogtrediveniit`, `trettenimut`, `hundredenik`,
 *   "boks nummer **syvhundrede tretten**".
 *   And the spelling is **standard Danish**: Oqaasileriffik's `nouns.lexc` lists en/et, to, tre, fire … tyve,
 *   tredive, fyrre, halvtreds, tres, halvfjerds, firs, halvfems, hundrede, tusind, million, milliard as CORRECT,
 *   while marking every Greenlandicised respelling (`traajua`, `foorut`, `haltrissi`, `untriti`, `tuusinti`,
 *   `tiivi`, `fiarsi` …) as a speller ERROR (`+OLang/DAN+Err/Sub`). Those nativised loans are not dead, but in the
 *   corpus they are almost all DERIVATIONAL (`untritillit` 'hundreds', `tuusintilippassuit` 'many thousands'),
 *   not bare cardinals — so they are the wrong thing to generate for a bare digit.
 *
 * ⚠ SOURCES
 *   - **Oqaasileriffik / GiellaLT `lang-kal`** — `src/fst/morphology/stems/nouns.lexc`, the "### Talmaskine ###"
 *     block (the native 0–20 series with its `+Orth/Alt`, `+Orth/Arch` and `+OLang/DAN+Err/Sub` tags), plus the
 *     repo's 46 462-line speller corpus used for the allomorph tests above.
 *   - Rasmussen, *Grønlandsk Sproglære* (1887), on the base-20 system's impracticality (via a secondary account).
 *   - Dorais 2010 via the Wikipedia "Greenlandic language" numerals table.
 *   - Danish numeral morphology itself (the `og`-compounding and the regular plurals millioner / milliarder) is
 *     ordinary standard Danish; only the lemmas come from the lexc.
 *   - NOT obtained, so nothing is quoted from them: Fortescue, *West Greenlandic* (1984); Bjørnum, *Grønlandsk
 *     grammatik*. `en.wiktionary.org/wiki/Appendix:Greenlandic_numerals` **404s**.
 *   - DEAD END, checked off: `lang-kal`'s own `transcriptor-numbers-digit2text.lexc` is an **unedited Plains Cree
 *     template** (its CARDINAL lexicon reads peyak/nîso/nisto…, with stray Sámi leftovers, and its Root lexicon is
 *     commented out). It must not be used, despite being the obvious-looking file.
 *
 * ⚠ ZERO. There is no native Greenlandic zero; the corpus has bare Danish `nul` (3× in 834k words — every
 *   `nule-` hit is the unrelated verb *nuleer-* 'to take a wife'), and the FST routes the digit 0 to the
 *   CONSONANT-final host class, which is correct for `nul` and wrong for any vowel-final alternative. So 0 = `nul`.
 *   NOTE FOR THE PROBE: `nul` is correct Greenlandic-text data, not a failed table lookup — a sentinel check
 *   matching /null/ would false-positive on it.
 *
 * ⚠ COMPOSITION (Danish, from 13 up)
 *   - 21–99: unit + `og` + ten, written **SOLID**: femogtyve 25, otteoghalvfems 98, syvogtredive 37 (attested).
 *   - hundreds/thousands also solid, and they nest: 713 = `syvhundredetretten`, 12 345 =
 *     `tolvtusindtrehundredefemogfyrre` (both attested shapes).
 *   - `million`/`milliard` are separate words and are `en`-words, so 1 000 000 = `en million` (not *et million).
 *   - Inside a larger number EVERYTHING is Danish, including 1–12: 12 000 is `tolvtusind`, not *aqqaneq-marluk
 *     tusind. The native series applies only when the whole figure is ≤12. That is what the corpus shows.
 *
 * SIMPLIFICATIONS / DELIBERATE OMISSIONS:
 *   - Native 7, 8 and 12 are written SPACED (`arfineq marluk`), which is the lexc's base spelling; the hyphenated
 *     variant is tagged `+Orth/Alt` there and is not generated.
 *   - 9 is `qulingiluat`; the lexc also lists `qulaaluat` and `arfineq-sisamat`, and 6 has the variant
 *     `arfineq-ataaseq` and 11 `isikkanillit`. One form each is generated; the rest are accept-only.
 *   - **YEARS ARE NOT SPECIAL-CASED.** Greenlandic reads a 4-digit year as hundred-pairs
 *     (1998 → `nittenhundredeotteoghalvfems`, licensed by the FST's `nitten NumHundreder`), but nothing in a bare
 *     digit string says "year", so the unambiguous cardinal is emitted instead — the same call the Irish engine
 *     makes for the same reason.
 *   - Out of scope here but worth knowing for the wider normalisation layer: modern Greenlandic writes a digit
 *     with a hyphenated Greenlandic case suffix as ONE mixed-language token (`25-inik`, `1998-imi`, `12.000-it`,
 *     3 413 such corpus tokens); that suffix is already correct and must never be regenerated; `.` is the
 *     thousands separator while `,` is the decimal point; and `-ani` on a day number marks an ordinal date.
 *   - ATTESTED RANGE / FALLBACK: 0 … 10¹²−1. At 10¹² and above, and for any non-safe integer, this falls back to
 *     DIGIT-BY-DIGIT over the Danish units (the lexc lists no Danish scale word above `milliard`).
 */
import { MANIFEST } from "./manifest.ts";

/**
 * THE NUMERAL LEXICON, from the manifest. ⚠ NATIVE 0–12, DANISH FROM 13, and that is a necessity rather
 * than a shortcut — the traditional system is a body-part tally (`arfinillit` 6 = "other hand"+1,
 * `aqqanillit` 11 = "going down" to the feet +1) and has nowhere to put a thousand, so speakers borrow
 * Danish above the small counts. The words are data; the arithmetic below is not.
 */
const NATIVE = MANIFEST.numbers.native;
const DK = MANIFEST.numbers.danish;
const DK_UNITS = DK.units;
const DK_10_19 = DK.teens;
const DK_TENS = DK.tens;
const DK_AND = DK.and;
const DK_HUNDRED = DK.hundred;
const DK_THOUSAND = DK.thousand;

/** Danish 1 ≤ n < 100, solid (femogtyve). */
function dkBelow100(n: number): string {
    if (n < 10) return DK_UNITS[n]!;
    if (n < 20) return DK_10_19[n - 10]!;
    const t = Math.floor(n / 10) * 10,
        u = n % 10;
    const ten = DK_TENS[String(t)]!;
    return u === 0 ? ten : `${DK_UNITS[u]}${DK_AND}${ten}`; // enogtyve, otteoghalvfems
}

/** Danish 1 ≤ n < 1000, solid (syvhundredetretten; bare `hundrede` for exactly 100). */
function dkBelow1000(n: number): string {
    const h = Math.floor(n / 100),
        r = n % 100;
    if (h === 0) return dkBelow100(n);
    const head = (h === 1 ? "" : DK_UNITS[h]!) + DK_HUNDRED;
    return r === 0 ? head : head + dkBelow100(r);
}

/** Danish 1 ≤ n < 10⁶, solid (tolvtusindtrehundredefemogfyrre). */
function dkBelow1e6(n: number): string {
    const th = Math.floor(n / 1000),
        r = n % 1000;
    if (th === 0) return dkBelow1000(n);
    const head = (th === 1 ? "" : dkBelow1000(th)) + DK_THOUSAND;
    return r === 0 ? head : head + dkBelow1000(r);
}

/** Read a digit string one digit at a time (the ≥10¹² / unsafe-integer fallback; Danish units). */
export function readDigits(digits: string): string {
    return [...digits].map((d) => (d === "0" ? NATIVE[0]! : DK_UNITS[Number(d)] || d)).join(" ");
}

/**
 * Non-negative integer → Kalaallisut cardinal words. **0–12 native Greenlandic, 13+ Danish** (see the header for
 * the corpus evidence). `million`/`milliard` are separate words; everything below 10⁶ is one solid Danish word.
 * ≥10¹² or non-safe → digit-by-digit.
 */
export function numberToWords(n: number, raw?: string): string {
    if (!Number.isSafeInteger(n) || n < 0 || n >= 1e12) return readDigits(raw ?? String(n));
    if (n <= 12) return NATIVE[n]!; // the native series — only when the WHOLE figure is ≤12
    if (n < 1e6) return dkBelow1e6(n);
    if (n < 1e9) {
        const m = Math.floor(n / 1e6),
            r = n % 1e6;
        // million is an en-word: "en million", and the regular Danish plural "millioner" with a count.
        const head = m === 1 ? DK.million.singular : `${dkBelow1000(m)} ${DK.million.plural}`;
        return r === 0 ? head : `${head} ${dkBelow1e6(r)}`;
    }
    const b = Math.floor(n / 1e9),
        r = n % 1e9;
    const head = b === 1 ? DK.milliard.singular : `${dkBelow1000(b)} ${DK.milliard.plural}`;
    return r === 0 ? head : `${head} ${numberToWords(r)}`;
}
