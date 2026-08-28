/**
 * Min Dong / Eastern Min (cdo, Fuzhou) text normalization — the pre-tokenizer pass that rewrites what is not
 * yet a pronounceable word into Bàng-uâ-cê the converter already speaks. Pure text→text, no IPA.
 *
 * ⚠⚠ THE ONE THING TO READ FIRST: **cdo IS SINITIC AND IS NOT WRITTEN IN HAN.** Six sibling layers — cmn yue
 * wuu nan cjy hak hsn gan — emit Han characters into a Han reading dict. This engine has NO Han front-end
 * (see `mindong.ts`: the only Han→reading source is Wiktionary, which is also the referee's source, so it
 * would be circular). It is a **Bàng-uâ-cê → IPA converter**, BUC is a hyphenated, space-separated LATIN
 * missionary orthography, and `cdo.wikipedia` — this corpus — is written in it (`latin-in-native` 8527 of
 * 9332 segments). So:
 *
 *   · **every word this file emits is BUC.** A `年`, a `到`, a `點` would be dropped on the floor.
 *   · **`unspacedScript` IS NOT SET, and that is deliberate.** Its six siblings all set it, because in Han a
 *     sign's neighbour is a Han character and the shared tier's letter-boundary guard would reject the
 *     ORDINARY case (playbook trap 27). Here the neighbour IS a Latin letter, so the ordinary guard is the
 *     one that is correct and the flag would DISARM it — `9.15 mī` must not match a bare `m` key, and it is
 *     the unmodified guard that stops it.
 *   · **trap 19 does not apply either.** BUC has word boundaries, so `attest.ts` returns real verdicts here
 *     rather than the `attested*` every other Sinitic corpus is limited to. The counts below mean what they
 *     say.
 *
 * `core/sinitic.ts` is still the right home for the SHAPES — its header promises that "every word here is a
 * PARAMETER", and cdo is the language that tests that promise. Four of its five rules are reused with BUC
 * parameters; the fifth (`spellYears`) is declined on evidence, see below.
 *
 * ⚠ TIER 1 — WHAT THE CONVERTER DOES WITH A WORD, and the failure mode is NOT the Han layers'. There is no
 * dict to be missing from: `baseToIpa` falls back to the raw base when it cannot parse a rime, and the tone
 * letters are appended anyway. So an unreadable string does not vanish, it **LEAKS INTO THE IPA** — which is
 * strictly worse. That is not hypothetical, it is the largest defect this layer repairs:
 *
 *     "2,133 km²"  → nɛi˨˦˨ , suoʔ˥ paiʔ˨˦ saŋ˥˥ sɛiʔ˨˦ saŋ˥˥ **km˥˥**
 *     "1400-2000 mm" → … **mm˥˥**      "4cm - 40cm" → … **cm˥˥**      "…×10 −31 kg" → … **kg˥˥**
 *     "20 °C"      → nɛi˨˦˨ sɛiʔ˨˦ **c˥˥**   — the scale letter as a bare Latin letter
 *
 * ⚠ AND NO GATE IN THIS TREE CAN SEE IT. `DIGIT` hunts a surviving digit, `RAWMARK` a surviving punctuation
 * mark, and a Latin-letter run inside a Latin-script language is indistinguishable from a word — playbook
 * trap 6's exact blind spot, arriving from the other side (this is not a spelling the layer emitted, it is
 * one the converter failed to consume). Every word below was run through `phonemizeWord` first and every one
 * of them speaks:
 *
 *     dô tou˨˦˨ · hŭng huŋ˥˥ · miēu mieu˧˧ · gáu kɑu˨˩˧ · diēng tieŋ˧˧ · báh pɑʔ˨˦ · cĭ t͡si˥˥
 *     gŭng-lī kuŋ˥˥ li˧˧ · hò̤-mī ho˥˧ mi˧˧ · lī-mī li˧˧ mi˧˧ · gŭng-gĭng kuŋ˥˥ kiŋ˥˥
 *     bìng-huŏng piŋ˥˧ huoŋ˥˥ · lĭk-huŏng liʔ˥ huoŋ˥˥ · mī mi˧˧
 *
 * ── TIER 2 — THE CORPUS, which is unusually generous about exactly the words that matter ─────────────────
 * Whole-corpus cell counts from the artifact: **digit-run 2442 · year 2421 · abbrev 2222 · latin-in-native
 * 8527 · decimals 147 · signs 124 · ranges 74 · percent 64 · grouped 62 · exponent 24 · arithmetic 19 ·
 * units 18 · dotted 18 · version-dot 16 · ordinal-latin 14 · degrees 13 · ampersand 12 · fractions 11 ·
 * signed-number 10 · rate 3 · currency 0 · clock 0 (see below)**.
 *
 * ⚠ THE DEGREE SIGN IS GLOSSED BY THE CORPUS ITSELF, which almost nothing about a sign ever is. `Dài-gĕ̤ng`
 * writes `Báe̤k-ūi 26 dô 05 miēu (26°05')` — the reading and the glyph in one sentence — and the temperature
 * prose of `Dâi-hàng Mìng-guók` writes `ŭng-dô sê 23~27 dô`, `dăk gáu -15 dô`, `11~19 dô`, `16~19 dô`: the
 * SAME corpus that writes `35℃`, `19.6℃`, `0-6℃` elsewhere, saying it in words. ⟨dô⟩ 度 it is.
 *
 * ⚠ AND A SECOND ARTICLE CORRECTS THE FIRST — the reason attestation is necessary and never sufficient.
 * `26 dô 05 miēu` uses ⟨miēu⟩ 秒, "SECOND", for the arc-MINUTE. `cdo.wikipedia`'s `Bìng-tàng` spells a whole
 * coordinate out and uses ⟨hŭng⟩ 分:
 *
 *     Bìng-tàng găh báe̤k-ūi **25 dô 16 hŭng gáu 25 dô 44 hŭng**, dĕ̤ng-gĭng **119 dô 32 hŭng gáu 120 dô 10
 *     hŭng** cĭ găng
 *
 * Two cdo articles, two words for `′`, and taking the first at face value would have shipped "26 degrees 05
 * SECONDS". ⟨hŭng⟩ 分 for `′` and ⟨miēu⟩ 秒 for `″` — and the same sentence independently confirms ⟨gáu⟩ as
 * the connective between two numeric endpoints, in the slot.
 *
 * ── THE RANGE WORD, and it is the one place cdo can simply be believed ───────────────────────────────────
 * ⟨gáu⟩ 到 ×96 whole-word in the corpus, coordinating two quantities over and over: `dăk gáu 35 dô`,
 * `bìng-gĭng ŭng-dô găh 10 gáu 16 dô cĭ-găng`, `3,500 gáu 9,500 nièng`, `1 é 5,000 uâng gáu 15 é`,
 * `1405 nièng gáu 1433 nièng`, `7 nguŏk gáu 9 nguŏk`, `siăh 15 gáu 20 gŭng-gĭng`. That makes **seven lects,
 * seven answers** for the family's connectives — wuu 搭, nan 佮, hak 摎, cjy 和, hsn 跟, gan 同到, cdo gáu —
 * which is why `core/sinitic.ts` shares the shapes and never the words.
 *
 * ── UNITS: THE WIKI GLOSSES THE ABBREVIATION, WHICH IS STRONGER THAN A SLOT HIT ─────────────────────────
 *     Hò̤-mī   "'''Hò̤-mī''' (毫米) sê siŏh cṳ̄ng dòng-dô dăng-ôi, **gé có̤ mm**."   ← "written as mm"
 *     Gŭng-lī  "'''Gŭng-lī''' (公里) sê hèng-liòng dòng-dô gì guók-cié dăng-ôi. Siŏh gŭng-lī dēng kó̤
 *              siŏh-chiĕng mī."
 * plus `gŭng-lī` ×6 corpus / ×47 wiki, `hò̤-mī` ×3 / ×8, `lī-mī` ×1 / ×2 (`siáng kuăng ng-sāi chiĕu guó 12
 * lī-mī`), `gŭng-gĭng` ×1 in the slot (`siăh 15 gáu 20 gŭng-gĭng gì dé̤ṳk`, a panda's daily bamboo).
 * ⟨bìng-huŏng⟩ is attested as the COLLOCATION, which is what trap 37 demands of a modifier: `bìng-huŏng
 * gŭng-lī` ×9 on the wiki and `1,300 bìng-huŏng-mī` / `27.5 bìng-huong gung-lī` in the corpus. ⟨lĭk-huŏng⟩
 * likewise sits in the volume slot: `bìng-gĭng làu-liông sê 1,980 lĭk-huŏng-mī/miēu`.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each on a measurement ─────────────────────────────────────────────────
 *
 * ⚠ NO YEAR RULE, AND IT IS THE BIGGEST REFUSAL IN THE FILE — `year` is the largest cell in this corpus
 * (2421). `2009年` → 二零零九年 is a fact about HAN orthography; whether a Fuzhou reader says the four digits
 * of `1749 nièng` one at a time is a separate question, and nothing answers it. The corpus writes every year
 * in ASCII digits and never spells one; the wiki has none either; espeak ships no Min Dong. Reading the
 * cardinal (`siŏh-chiĕng chék-báik sé-sék gāu`) is a DIFFERENT but pronounceable reading, not a dropped
 * symbol — so the choice is between a correct-shaped guess and a plausible status quo, and this tree ranks
 * silence above confidence. ⚠ The corpus also supplies the counter-pressure: `chiĕu-guó 2200 nièng`
 * ("more than 2200 YEARS"), `7,000 nièng sèng`, `15,000 nièng ī-sèng`, `2,000 nièng sèng`, `3,500 gáu 9,500
 * nièng`, `Ĭ sāi 23 nièng gì sì-găng`, `Huói-só chă-bók-dŏ̤ 930 nièng` — DURATIONS, which want the cardinal
 * and which gan and hsn each had to build a guard for. Adopting the rule means adopting that guard too, on
 * top of an unsourced reading. Re-open it with one grep (`\d{4}\s*nièng`, ×119 in the artifact text) the day
 * a Fuzhou reading source appears.
 *
 * ⚠ NO MINUS. ⟨負⟩ is `hô` (Wiktionary, Eastern Min), and that is the whole of the evidence: it is a bare
 * monosyllable, absent from this corpus in any mathematical sense, and gan — the one lect that DID ship this
 * rule — could do so only because its own corpus wrote 負 beside the glyphs it names (`負值(-1、-2、-3...)`).
 * cdo has no such sentence. Counted before deferring (trap 17): the artifact holds **2 real negatives**,
 * `dăk gáu -15 dô` and `-6~7dô`, both temperatures; the other 9 leading signs are the `−31`/`−27`/`−11` of
 * scientific notation and the `(3%-4%)` census-style parentheticals. A dropped minus INVERTS, so this is a
 * real defect left open — with a word, not a rule, missing.
 *
 * ⚠ NO SCALE NAME, AND `°C` / `°F` BOTH READ AS THE BARE DEGREE. ⟨攝氏⟩ has **no Eastern Min reading on
 * Wiktionary at all** (the entry gives Mandarin, Cantonese, Taishanese and Hokkien `Liap-sī` and omits
 * Eastern Min), and `sources.ts` independently reports `[NONE] scale-names`. But the corpus's own temperature
 * prose says `ŭng-dô sê 23~27 dô` with no scale name either, so `dô` is not a compromise here, it is what
 * this corpus writes. `°F` is ×0 and gets the same reading for one reason only: the alternative is to leave
 * the ⟨F⟩ stranded as a raw Latin letter, which is the very leak this file exists to close.
 *
 * ⚠ NO AMPERSAND, AND THIS IS A MEASURED DIVERGENCE FROM gan. Every other Sinitic layer declares the word.
 * Of the `&` that survive the registry's entity decoding and markup strip — the artifact's raw `&` are mostly
 * `&nbsp;` and `&#x3A;` and never reach this file — **all six remaining instances sit inside Latin proper
 * names**: `AT&T` ×3, `Fuchs & Chafetz`, `Thames & Hudson`, `Gáu-tuàng & THE Mìng-sĭng Rockets`. gan declared
 * it on the strength of one Han-flanked instance (`咸摩斯密史&實第線`); cdo has **zero** BUC-flanked instances,
 * so declaring ⟨gâe̤ng⟩ (×162, the language's ordinary "and") would only ever put a Fuzhou syllable inside an
 * English company name. Trap 18's merge hazard is the argument on the other side and it is inert here,
 * because cdo has no letter names: `AT&T` and `ATT` both leak raw either way.
 *
 * ⚠ NO ARITHMETIC OR RELATIONAL SIGNS. `arithmetic 19`, and read: the `×` are all scientific notation
 * (`9.10938356(11)×10 −31 kg`, `6.67 × 10 −11`, `1.672621898(21)×10 −27`) plus one relay leg (`4×100 mī`);
 * the `=`/`>` are a LaTeX body (`y^2=-2px \quad \left (p>0 \right)`); `≥10℃` is one comparison. No multiply,
 * equals, plus or greater-than word is sourceable for cdo from any tier this repo has.
 *
 * ⚠ NO BARE EXPONENT — cdo IS THE SEVENTH SINITIC CORPUS TO FORCE THIS REFUSAL, and `test/accepted-silent.
 * test.ts` predicted it. The superscript runs here are dominated by **romanization tone numbers from the
 * wiki's own pronunciation glosses**, in two different systems: jyutping (`hoeng¹ gong²`), Min Nan Pe̍h-ōe-jī
 * with Chao digits (`Choân-chiu-oē /t͡suan²⁴⁻²² t͡siu³³ ue⁴¹/`) and cdo's own IPA (`/y⁵³ y³⁵ touŋ³³/`,
 * `/touŋ⁵⁵ touŋ²¹³ t͡sʰiɑ²⁴²/`). Reading a superscript as a power would turn this engine's own phonology
 * glosses into arithmetic. A squared/cubed UNIT is still read, because it composes with a unit noun and so
 * cannot match a bare tone number. ⚠ The exemptions are listed BY INSTANCE above and never by class, so a
 * genuine `km²` regression stays visible — and `km²` is exactly what the tier still claims.
 *
 * ⚠ THE REFUSAL IS NARROWER THAN IT WAS, AND STILL HOLDS. `bareExponent` remains undeclared, but the shared
 * tier no longer DELETES an undeclared power: since #1041 it spaces a DIGIT-base run out to its digits
 * (`10¹⁹` → `10 19`), which the tone-number hazard above cannot reach — every tone run here sits on a LETTER
 * base, and letter bases are declined outright.
 *
 * ⚠ NO `unitPer`, WHICH IS WHY ⟨km⟩ STILL LEAKS ONCE — and the refusal is about WORD ORDER, not about a
 * missing word. The residual is `ìng-kēu mik dô dék gèng … dak gáu 5720 nè̤ng/km`, a population density.
 * ⟨km⟩ itself IS declared and reads everywhere else; here the slash makes it a RATE, and a rate is composed
 * only when the language supplies a connective. `mūi` 每 is the candidate and it is genuinely attested —
 * `attest.ts` 12 tokens / 9 articles, every example read and every one the distributive: `mūi bĭk dê-ciĕ`
 * (each planet), `mūi nièng`, `mūi gĕ̤ng cā-tàu` (every morning), `mūi siâ diē 1 giù`. ⚠ AND THAT IS
 * PRECISELY WHY IT CANNOT BE DECLARED HERE. In this family 每 is PRENOMINAL AND PRECEDES THE DENOMINATOR —
 * 每平方公里5720人, "per square kilometre, 5720 people" — while `unitPer` emits `<number> <head> PER <denom>`,
 * i.e. *5720 nè̤ng mūi gŭng-lī*, which puts the distributive where this language never puts it. The other
 * half is worse: the numerator `nè̤ng` is a HEAD NOUN ("person"), and declaring an ordinary noun as a unit
 * key to make a rate match is the shape bar's `Eihwohna/km²` refusal already names. A right word in the
 * wrong order is a confident mis-reading; the raw `km` is a visible gap. Re-open it if a cdo sentence turns
 * up that writes a density in words.
 * ⚠ NO CLOCK. `\d{1,2}:\d{2}` is ×4 in the artifact text and every one is a BIBLE VERSE — `«Mā-tái Hók-ĭng»
 * 22:37-40`, `«Chók Ăi-gĭk Gé» 20:2-17`, `«Sĕng-mêng Gé» 5:6-21`, `Sé̤ṳ-dù Hèng-duông 2:1-4`. The artifact's
 * `clock: 38` is the cell's `[:.]` alternative, i.e. decimals (trap 21: a filled cell is a lead, not a
 * finding). A colon rule here would claim only what it must not. ⟨diēng⟩ IS the clock word — `hī siŏh nĭk
 * màng-buŏ 8 diēng` — which is what makes the temptation worth writing down.
 *
 * ⚠ NO CURRENCY. `currency: 0`; no `$`, `€`, `£` or `¥` occurs anywhere in this corpus.
 * ⚠ NO RATE. `rate: 3`, and all three write the rate in WORDS already (`5720 nè̤ng/km`, `1,980
 * lĭk-huŏng-mī/miēu`, `m³/s` inside a Han paragraph) — there is no rate ABBREVIATION to compose.
 * ⚠ NO `magnitudes`. Measured: zero instances of a magnitude word touching a unit or a sign, so the hop the
 * field exists for cannot fire, and declaring it would be robustness for input this corpus has never written.
 * ⚠ NO PER MILLE. `‰` is ×0.
 *
 * ── FOUND AND NOT FIXED HERE, because it is the CONVERTER's, not this layer's ────────────────────────────
 * ⚠ `mindong.ts`'s number compositor reads 百 as **báik**, sourced from the Wikivoyage Fuzhou phrasebook. Two
 * independent sources say that is the wrong register for "hundred": Wiktionary's Eastern Min entry gives
 * "báh - vernacular ('hundred'); báik - literary ('numerous')", and `cdo.wikipedia`'s own BUC prose writes
 * `gūi báh nièng`, `siŏh báh gūi cṳ̄ng`, `báh nièng hâu-kéng` — ×20 whole-word, always the number. This
 * file therefore spells its percent word with ⟨báh⟩ and the engine keeps ⟨báik⟩, which is an inconsistency
 * inside one language. It is REPORTED rather than patched: changing the compositor changes every number cdo
 * speaks and rewrites a shipped golden, which is its own measurement and not a side effect of a text layer.
 *
 * ⚠ `\b` IS NEVER USED — ASCII-defined, and BUC is full of combining marks (playbook trap 1).
 * ⚠ ℃/℉ arrive already folded to `°C`/`°F`, HTML entities are already decoded and markup already stripped,
 * all at the registry's single dispatch point.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, readDecimals, readDegrees, reorderFraction } from "../../core/sinitic.ts";
import { tr } from "../../core/provenance.ts";

/**
 * ⚠ NO `unspacedScript` — see the header. This is the ONE Sinitic layer that must leave the tier's
 * letter-boundary guard alone, because BUC is Latin and the guard is doing exactly its intended job here.
 *
 * ⚠ THE PERCENT WORD IS COMPOSED FROM THREE ATTESTED PIECES, NOT ASSERTED. No BUC percent word exists
 * anywhere: `insource:/hŭng-cĭ/`, `/báh-hŭng/`, `/báh-hŭng-cĭ/`, `/báik-hŭng/`, `/báh-hŭng-bī/` are all ×0
 * on cdo.wikipedia, and `insource:/百分/` returns exactly one hit which is **quoted PRC labour law in
 * Mandarin** inside the `996工作制` article (trap 34, a contaminating passage in the one place a grep would
 * take it as evidence). What IS attested:
 *   · the construction 分之 — ×2 on cdo.wikipedia, in HAN, in the fraction slot (`四分之一` in 艦隊收藏,
 *     `七分之一弧秒` in 分點). The language writes it; only the BUC spelling is missing.
 *   · 分 = `hŭng` in a NUMERIC context, by cdo's own hand — `25 dô 16 hŭng`, the arc-minute (above).
 *     Wiktionary's Eastern Min entry: "buŏng - vernacular; hŭng - literary", and this is the literary slot.
 *   · 之 = `cĭ`, Wiktionary; and `cĭ` ×40 whole-word in the corpus (`cĭ-găng`, `cĭ-ék`, `cĭ-hâiu`).
 *   · 百 = `báh`, Wiktionary ("vernacular, 'hundred'") and ×20 on the wiki as the number.
 * That is sourced arithmetic in the sense the playbook means (the Fula `e teemedere` move), and it is stated
 * at this length because it is the weakest call in the file — the `%` is ×64 and currently silent outright.
 *
 * ⚠ `percentPrefix` because 百分之 PRECEDES its number in every Sinitic variety, and the tier emits it
 * space-separated (`báh-hŭng-cĭ 50`), which is what BUC needs and what Han does not.
 *
 * ⚠ EXPONENT POSITION IS `before`, NOT gan's `compound`. Han fuses (平方公里); BUC writes the words apart,
 * and the corpus proves it — `60,992 bìng-huŏng gŭng-lī`, `9 uâng 9 ciĕng bìng-huŏng gŭng-lī`. `compound`
 * would produce one unreadable token.
 *
 * ⚠ BARE `m` IS DECLARED, WHICH IS THE ONE-LETTER-KEY HAZARD (traps 28/46) — MEASURED. Digit-adjacent `m`
 * is ×3 in this corpus and every one is a genuine metre (`600 m²`, `600m²`, `1,980 m³/s`); a three-part
 * dotted version (`802.11n`) is **×0**, so the `NOT_VERSION` guard has nothing to be robbed of — and it
 * would still have its dot anyway, because this layer's decimal rule runs AFTER the tier. The guard that
 * actually earns its keep here is the ordinary trailing `(?![\p{L}\p{M}])`: BUC's own metre word is `mī`, so
 * `9.15 mī`, `172.4 mī`, `2,228 mī` all present as `<digits> m` + a letter and are correctly refused. That
 * is the guard `unspacedScript` would have disarmed.
 *
 * ⚠ THE REST OF THIS ENGINE'S RAW-LATIN RESIDUAL IS NOT LANGUAGE DATA AT ALL, and it is listed so that it
 * is not mistaken for a unit table with holes in it. ⟨ts⟩ ×2 is this wiki's own PHONETIC NOTATION — the
 * phonology article's `聲母/ts/, /tsʰ/ 共 /i/, /y/` and the pronunciation gloss `bék-cáe̤ /pitˀ˥ tsʰɔ˨˩˧/`,
 * i.e. IPA quoted inside slashes, which is the one string a phonemizer must NOT re-read. ⟨px⟩ is the `2px`
 * of a LaTeX body (`y^2=-2px \quad \left (p>0 \right)`, a parabola, `p` times `x`), ⟨pdf⟩ is a Commons
 * filename and ⟨html⟩ a mailing-list URL. Four hits, no missing word behind any of them.
 */
const SYMBOLS = makeSymbolNormalizer({
    percent: ["báh-hŭng-cĭ"],
    percentPrefix: true,
    units: {
        km: ["gŭng-lī"],
        cm: ["lī-mī"],
        mm: ["hò̤-mī"],
        kg: ["gŭng-gĭng"],
        m: ["mī"],
    },
    exponentWords: { squared: ["bìng-huŏng"], cubed: ["lĭk-huŏng"], position: "before" },
});

/** Normalize one Min Dong (Bàng-uâ-cê) string. The steps are ORDER-DEPENDENT and each says what breaks. */
export function normalizeMinDong(input: string): string {
    let s = input;

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and it is the most destructive thing this engine does to a number: the tokenizer splits on
    // `\d+`, so a grouping comma becomes a CLAUSE PAUSE and the value is destroyed — `1,000` reads
    // *ɛiʔ˨˦ , liŋ˥˧*, "one … zero". ×62 in this corpus (`2,133 km²`, `30,221,532 km²`, `15,000 nièng`,
    // `1 é 5,000 uâng`, `60,992 bìng-huŏng gŭng-lī`, `744,677 hô`).
    // ⚠ EXACTLY-3-DIGIT GROUPS; the shared rule carries the reasoning and the guards, including the one that
    // leaves the Chinese 萬-grouping alone. cdo writes its myriads as WORDS (`9 uâng 9 ciĕng`, `1 é 5,000
    // uâng`), so that guard is inert here — but the decimal/clock/DOI guards are not.
    s = degroupThousands(s);

    // ── 2. coordinates — degrees, arc-minutes, arc-seconds ───────────────────────────────────────
    // ⚠ BEFORE step 3, and the order is load-bearing in the same way step 3's own two arms are: the bare-°
    // rule would eat the ° and strand the primes as raw marks. wuu made the same ordering choice.
    // ⚠ THE WHOLE SHAPE IS CLAIMED AT ONCE, keyed on the `°`, because the prime characters cannot be trusted
    // on their own: ASCII `'` is an ordinary apostrophe in this corpus's Latin quotations (`Philosopher's
    // Stone`, `d'Ancona`, `L'insoutenable`, `Waring's problem`) and `"` is a quote mark. Anchored to a
    // degree sign there is no ambiguity left.
    // ⚠ THE WORDS ARE THE CORPUS'S AND THE WIKI'S, and the wiki corrects the corpus — see the header:
    // ⟨hŭng⟩ 分 for `′`, ⟨miēu⟩ 秒 for `″`, from `25 dô 16 hŭng gáu 25 dô 44 hŭng`.
    // Covers every coordinate the corpus writes: `118°08'`, `25° 47′`, `22° 11′ 47″`, `26°23'`, `119°7'`.
    s = tr(s, 
        /(\d+)\s*°\s*(\d+)\s*['′](?:\s*(\d+(?:\.\d+)?)\s*["″])?/gu,
        (_m, d: string, min: string, sec: string | undefined) =>
            `${d} dô ${min} hŭng${sec === undefined ? "" : ` ${sec} miēu`}`,
    );

    // ── 3. temperature, then the bare degree ─────────────────────────────────────────────────────
    // The shared rule runs `°C` → `°F` → bare `°` in that order, and the order is why `20°C` does not read
    // as twenty degrees plus the ENGLISH LETTER NAME — which is exactly what it did here before this layer
    // (`20 °C` → *nɛi˨˦˨ sɛiʔ˨˦ **c˥˥***). It also carries `\s*` rather than `\s?` (yue shipped that bug),
    // the `\p{sc=Latn}` trailing guard, and the optional decimal part that four Han layers shipped without —
    // and cdo needs that last one badly: `19.6℃`, `9.6℃`, `28.5℃`, `6957.8℃` are its ordinary form.
    // ⚠ BOTH SCALES READ AS THE BARE DEGREE, because cdo has no scale name in any source AND its own prose
    // writes temperatures that way (`ŭng-dô sê 23~27 dô`). See the header. ℃ arrives folded to `°C`.
    s = readDegrees(s, { celsius: (n) => `${n} dô`, fahrenheit: (n) => `${n} dô`, bare: (n) => `${n} dô` });

    // ── 4. a range whose endpoints are PERCENTAGES ───────────────────────────────────────────────
    // ⚠ BEFORE the tier, and it exists because after the tier it is impossible: step 5 claims each `%` and
    // puts a WORD between the digits and the dash, so no later rule can see two numbers. gan met the same
    // shape, counted ONE instance and declined; cdo writes it **five times** (`94–98%`, `50%~60%` ×2,
    // `(3%-4%)`, `(1%-2%)`) and the rule is one line — trap 17, count it before deferring.
    // ⚠ IT EMITS THE PERCENT WORD ONCE, IN FRONT, which is the Sinitic order (百分之94到98) and is what the
    // tier could never produce from two separate signs.
    s = tr(s, 
        /(?<![\d.,:/-])(\d+(?:\.\d+)?)\s*%?\s*[-–—~～〜]\s*(\d+(?:\.\d+)?)\s*%/gu,
        (_m, a: string, b: string) => `báh-hŭng-cĭ ${a} gáu ${b}`,
    );

    // ── 5. percent, units and exponents, via the shared tier ─────────────────────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule: the tier matches
    // ASCII digits beside the sign, and step 7 puts ⟨diēng⟩ between them, which would break that adjacency
    // for every decimal percentage — and this corpus is full of them (`99.68%`, `87.29%`, `8.1%`, `1.5%`).
    // ⚠ The `%` is ×64 and currently SILENT; `km`/`mm`/`cm`/`kg` currently LEAK RAW into the IPA.
    // ⚠ AFTER the degree rules too: `7-10 °C` must become `7-10 dô` while its digits are still contiguous,
    // and a bare `m` key must not be offered `°C` first.
    s = SYMBOLS(s);

    // ── 6. the fraction, in the Chinese order ────────────────────────────────────────────────────
    // ⚠ `a/b` IS `b分之a`, "of b parts, a". The construction is attested for cdo — ×2 on cdo.wikipedia, in
    // Han (`四分之一`, `七分之一弧秒`) — and the BUC spelling is composed from the same three pieces as the
    // percent word (see the SYMBOLS comment). The corpus's own fractions are `1/4` ×3, `1/5`, `1/3`, `1/10`
    // ×2, `1/1836`, `1/299792458`, all currently reading as two bare cardinals with the slash silent.
    // ⚠ The shared rule carries the guards three corpora paid for, and cdo needs both: FOUR DIGITS ON BOTH
    // SIDES IS A YEAR PAIR, and a Latin letter immediately before the numerator makes it a CODE. The second
    // is the one that matters here — this is a Latin-script corpus, so `ISBN 3-88053-113-7` and `ISO 639-3`
    // sit in ordinary running text. A SPACE before the numerator is not a Latin letter, so `chiĕu-guó 1/4`
    // and `gì 1/10` still read; verified against every fraction the corpus contains.
    // ⚠ The word is spaced, because BUC needs a token boundary where Han needs none.
    s = reorderFraction(s, " hŭng-cĭ ");

    // ── 7. decimals ─────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules, for the adjacency reason step 5 gives. ×147, currently reading the point as
    // a CLAUSE PAUSE and the fractional part as a CARDINAL: `3.14` → *saŋ˥˥ . sɛiʔ˨˦ sɛi˨˩˧*, "three,
    // fourteen". The fractional part must be read DIGIT BY DIGIT.
    // ⚠ THE DIGIT TABLE IS " 0".." 9" — SPACE-SEPARATED ASCII, and that is the whole cdo adaptation of the
    // shared rule. The Han layers pass a table of CHARACTERS and `spellHanDigits` joins them with nothing,
    // which is correct in a script with no word boundaries and produces one unreadable fused syllable in
    // BUC. Emitting the digits as separate ASCII tokens hands each one back to the engine's own number path,
    // where a single digit is exactly one BUC numeral (`6 8` → *løyʔ˥ paiʔ˨˦*) — the playbook's preferred
    // shape, since no orthography is authored here at all. It also keeps this layer downstream-safe under
    // trap 20: a lone digit cannot reach any multi-digit branch of the compositor.
    // ⚠ The shared rule's dotted-designation guard (`1.2.3`) and its 3-digit cap (which keeps a DOI out) are
    // both live: this corpus writes `CC BY-SA 3.0`, `M.C. White` and `ISBN 3-88053-113-7`.
    // ⚠ ⟨diēng⟩ 點 is attested in this corpus as the CLOCK word (`màng-buŏ 8 diēng`) and as the noun
    // (`gău-chă diēng ôi uòng-sĭng`), and Wiktionary's Eastern Min entry gives "dēng - vernacular; diēng -
    // literary" — the same evidential position cjy, hsn, wuu, nan and jv each recorded for their own
    // separator word, stated here so the family's open question stays visible rather than being re-derived.
    s = readDecimals(s, " diēng", SPACED_DIGITS);

    // ── 8. ranges ───────────────────────────────────────────────────────────────────────────────
    // LAST, so every rule that owns a dash has already consumed it. ⟨gáu⟩ is the corpus's own numeric
    // connective, ×96 — see the header.
    // ⚠ THE gan/cjy/hsn GUARD CANNOT BE COPIED, and this is the sharpest place cdo diverges. Those layers
    // reject a range preceded by a LATIN RUN within twelve characters, because in a Han corpus Latin before
    // a number means an identifier. **In BUC every number in the language is preceded by Latin**, so that
    // check would refuse every real range cdo has. What replaces it is measured: over the artifact text the
    // digit-both-sides guard alone yields 23 matches, 22 of them genuine (`4-6`, `7-8`, `7-10 °C`,
    // `1400-2000 mm`, `1200~2100 hò̤-mī`, `100 - 700 km`, `94–98%`, `2,000-3,000`, `(1894 - 1895 nièng)`,
    // `(916-1125 nièng)`, `23~27 dô` …). The `:` in the lookbehind is what rejects the Bible verses
    // (`22:37-40`, `20:2-17`, `5:6-21`, `2:1-4`) and the chained-dash rejection is what rejects the ISBNs
    // (`3-88053-113-7`). The single residual false positive is `ISO 639-3`, so the ONE extra guard is an
    // ALL-CAPS acronym immediately before the number — narrow, one instance, and nothing in BUC ends in a
    // capital, so it cannot bite a real range.
    // ⚠ THE RIGHT-HAND GUARD REJECTS NEITHER `.` NOR `,`, AND ITS LEFT-HAND TWIN STILL REJECTS BOTH. The
    // symmetric form declined every range that ENDS A CLAUSE (playbook trap 58, reported by `review.ts`'s
    // `clause-final` check): `1990-1995.` came back untouched and read as two juxtaposed cardinals with the
    // connective gone at exactly a sentence end. All three of this corpus's clause-final spans are in one
    // paragraph — `200-300,` and `300-800,` (a COMMA, mid-sentence) and `2,000-3,000.` — so the comma had to
    // go with the dot, and in cdo it can: **the comma is a GROUPING separator here and never a decimal**
    // (`\d,\d{1,2}` is ×0 in the artifact against ×34 three-digit groups), step 1 has already de-grouped
    // every one of them, and step 7 has already spent every decimal point. What remains beside a digit at
    // this step is punctuation. The LEFT guard keeps both, because a match must still not BEGIN inside a
    // number, and `:` / `/` / the dash chain — the Bible-verse, DOI and ISBN rejections above — are untouched.
    s = tr(s, 
        /(?<![\d.,:/\-–—])(\d+)\s*[-–—~～〜]\s*(\d+)(?![\d:/\-–—])/gu,
        (m, a: string, b: string, off: number, full: string) =>
            /(?:^|[^\p{L}\p{M}])[A-Z]{2,}[\s.]*$/u.test(full.slice(Math.max(0, off - 12), off)) ? m : `${a} gáu ${b}`,
    );

    return s;
}

/**
 * The digit table handed to `readDecimals` — a SPACE plus the ASCII digit, so the fractional part comes out
 * as separate tokens the engine's own number path reads one at a time. See step 7 for why the shared Han
 * table (bare characters, joined with nothing) cannot be used in a space-separated orthography.
 */
const SPACED_DIGITS: readonly string[] = [...Array(10)].map((_, i) => ` ${i}`);
