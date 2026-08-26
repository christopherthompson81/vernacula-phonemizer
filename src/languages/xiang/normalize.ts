/**
 * Xiang Chinese / 湘语 (hsn, Changsha) text normalization — the pre-tokenizer pass that rewrites what is not
 * yet a pronounceable word into Han the dict already speaks. Pure text→text, no IPA.
 *
 * ⚠ THERE IS NO hsn.wikipedia, AND THAT BOUNDS EVERY RULE BELOW. gan, hak, wuu and cdo have one; cjy and hsn
 * do not, and there is no FLEURS. The only Xiang text that exists is the Wikimedia Incubator's `Wp/hsn` —
 * 153 pages, **30,640 characters of which 20,906 are Han**. Mined to `tools/corpus/mined/hsn.jsonc` anyway:
 * **covered 16/35 cells**, with fractions, units, currency, abbrev, roman, ampersand and thirteen more
 * EMPTY. The playbook says an empty cell is a query to run; here the query has been run and the text does
 * not exist. There is also **no referee at all** — the engine's own header records that.
 *
 * So this layer cannot be sized by frequency the way a dump-backed one can, and it rests on two tiers,
 * saying which is which at every rule. It follows the Jin (cjy) layer, which is the same situation.
 *
 * ⚠ TIER 1, A HARD GATE: THE SHIPPED DICT DECIDES WHETHER A WORD SPEAKS AT ALL. The shared engine
 * (`sinitic/hanDictIpa.ts`) segments by greedy longest match and **skips an uncovered character SILENTLY**,
 * so an unsourced word does not mispronounce — it VANISHES, which is worse than leaving the symbol unread.
 * Every word below was checked through the engine:
 *
 *     SPEAKS   百分之 · 分之 · 點 · 到 · 跟 · 和 · 公里 · 公斤 · 公尺 · 平方 · 立方 · 元 · 第 · 零 一 二 …
 *     SILENT   度 · 正 · 減 · 乘
 *     HALF     攝氏 → sz̩˦˥ (1 of 2 — it would say "shì" and drop "shè") · 等於 → tən˦˩ (drops 於)
 *
 * That decides four refusals on FACT rather than taste.
 *
 * ⚠ TIER 2 — the incubator text, thin but Xiang's own, and it settles the choices that are genuinely
 * dialectal rather than pan-Chinese. The important one DISAGREES WITH JIN:
 *
 *     跟 ×136  coordinating — `皇冠假日跟喜來登`, `法語、德語跟西班牙語`, `台灣跟福建`, `一隻文化跟地理亇概念`
 *     和  ×63  also present, but half as common
 *     到  ×65  "up to" — the range connective
 *
 * cjy chose 和 on its own corpus (和 ×16 against 跟 ×5); Xiang is the mirror image, so this layer takes 跟.
 * Two lects, two corpora, opposite answers — which is exactly why the connective is not shared code.
 *
 * ── WHAT IS DELIBERATELY NOT DONE ─────────────────────────────────────────────────────────────────────
 *
 * ⚠ NO BARE EXPONENT, AND THIS IS THE LOCAL FINDING THAT MATTERS MOST. Of the 24 superscript runs in this
 * corpus, **23 are ROMANIZATION TONE NUMBERS** from the 湘語羅馬字 tables the incubator carries —
 * `/ʃɘ̃⁴⁵/`, `/ye²⁴/`, `/mɔ⁴²/`, `/tɕiɑʌ⁴⁵/`, `/n̩⁴²/`. Exactly ONE is an exponent (`5.9742×10²⁴公斤`).
 * Reading superscripts as powers would turn a pronunciation table into arithmetic. ⚠ hsn is the FIFTH
 * Sinitic corpus to produce this hazard from a fifth source — wuu from its own phonology sections, nan from
 * jyutping quoted in a Hong Kong article, cjy from its romanization, hak from glossing other varieties —
 * and `test/accepted-silent.test.ts` predicted it here by name. A squared/cubed UNIT is still read, because
 * that composes with a unit noun and cannot match a bare tone number.
 *
 * ⚠ THE REFUSAL IS NARROWER THAN IT WAS, AND STILL HOLDS. `bareExponent` remains undeclared, but the shared
 * tier no longer DELETES an undeclared power: since #1041 it spaces a DIGIT-base run out to its digits
 * (`10²⁴` → `10 24`), which the tone-number hazard above cannot reach — every tone run here sits on a LETTER
 * base, and letter bases are declined outright.
 *
 * ⚠ NO DEGREE. ⟨度⟩ is SILENT in this dict, so `20°C` would lose the WORD as well as the sign — strictly
 * worse than the raw sign, which at least survives as a RAWMARK the scan can see. ⟨攝氏⟩ is HALF. And the
 * corpus's only two `°` are coordinates anyway (`東經111°53'－114°5'`, `北緯27°51'－28°40'`), where the
 * primes have no reading either.
 *
 * ⚠ NO `×`, NO `=`. ⟨乘⟩ is SILENT and ⟨等於⟩ emits one syllable of two. The single `×` in the corpus is
 * scientific notation (`5.9742×10²⁴`), which this layer reads for no language.
 *
 * ⚠ NO CURRENCY. ⟨元⟩ speaks and occurs ×33, but every instance is a spelled-out amount already
 * (`可支配收入12434元`) — the WORD, not a sign. No currency SIGN occurs in the corpus at all, so there is
 * nothing to rewrite; declaring one would be robustness for input this language has never been seen to write.
 *
 * ⚠ THE ONE WORD SHIPPED WITHOUT AN ATTESTED SENSE is the decimal ⟨點⟩. Its 11 instances here are all the
 * NOUN or the adverb — 一點一線 (a slogan), 特點 "characteristic", 有點噶子 "a bit", 試點 "pilot", 點子
 * "idea" — never a separator. That is the same trap wuu's 点, jv's `koma`, nan's `tiám` and cjy's 點 hit,
 * and it ships for the same reason: a written corpus is the weakest evidence there is about how a SYMBOL is
 * spoken, and the alternative is 29 decimals read with a clause pause where the point was.
 * ⚠ 百分之 IS THE SAME SHAPE AND WEAKER STILL — it is ×0 here, where cjy could at least not contradict it.
 * It is the pan-Sinitic form, it speaks in this dict, and the corpus has 12 `%` currently reading as
 * silence. Shipped as an inference from the family, labelled as one.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, readDecimals, reorderFraction, spellYears } from "../../core/sinitic.ts";

/**
 * ⚠ `unspacedScript`, because a sign in Han prose is flanked by Han and the tier's letter-boundary guard
 * would otherwise refuse the ORDINARY case (playbook trap 27). `percentPrefix` because 百分之 PRECEDES its
 * number in every Sinitic variety.
 *
 * ⚠ NO `currency` AND NO `degree` — both would emit silence; see the header.
 * ⚠ `m` IS ABSENT for the reason yue, wuu and cjy give: 米 is a one-character unit and in an unspaced script
 * that is inseparable from any name containing it. 公尺 is declared instead — two characters, and it speaks.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "跟",
    percent: ["百分之"],
    percentPrefix: true,
    units: { km: ["公里"], kg: ["公斤"] },
    exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
    unspacedScript: true,
});

/** Normalize one Xiang string. The steps are ORDER-DEPENDENT and each says what breaks if it moves. */
export function normalizeXiang(input: string): string {
    let s = input;

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and it is the most destructive thing the engine does to a number: the tokenizer splits on
    // `\d+`, so a grouping comma becomes a clause PAUSE and the value is destroyed. ×7 here.
    s = degroupThousands(s);

    // ── 2. years ─────────────────────────────────────────────────────────────────────────────────
    // ⚠ THE BIGGEST CLASS IN THIS CORPUS BY FAR — `\d{4}年` ×116, against 29 decimals and 12 percents. All
    // three arms and their order live in `core/sinitic.ts` (range, then both-endpoints, then single), an
    // order rediscovered the hard way in yue, wuu and cjy.
    // ⚠ Digit-by-digit is the pan-Chinese convention, corpus-verified in cmn and wuu; this corpus writes
    // every year in digits (`到噠1990年代`, `從1998年`) and never spells one out, so it cannot confirm the
    // reading — inference from the family, flagged as one, exactly as cjy flagged it.
    // ⚠ `N年前` IS "N YEARS AGO", A QUANTITY — NOT THE YEAR N. The corpus diff caught it: `2400年前亇春秋戰國`
    // ("2400 years ago, in the Spring and Autumn period") came out as 二四零零年前, the year 2400 read digit
    // by digit, when the reading wanted a cardinal. The `多` forms are already safe (`7000多年前`, `2000多
    // 年前` — the 多 breaks the adjacency spellYears needs); the bare form is not.
    // ⚠ FIXED LOCALLY RATHER THAN IN `core/sinitic.ts`, on a measurement: `\d{4}年前` is ×1 here and ×0 in
    // every other Sinitic corpus (cjy, hak, nan, wuu, yue, cmn), so a shared change would be carried by six
    // languages to fix one instance in a seventh. The sentinel is a PUA code point, which cannot occur in
    // the text, swapped back immediately after.
    const AGO = "";
    s = s.replace(/(\d{4})年(?=前)/gu, `$1${AGO}`);
    s = spellYears(s, { rangeWord: "到" });
    s = s.replaceAll(AGO, "年");

    // ── 3. the fraction, in the Chinese order ────────────────────────────────────────────────────
    // ⚠ ZERO INSTANCES IN THIS CORPUS — `a/b` is ×0. Kept because it COMPOSES from 分之, which speaks, and
    // because the shared rule carries the guard three corpora paid for: four digits on both sides is a YEAR
    // PAIR (`2020/2021`), not a fraction. Robustness for plausible input, and labelled as such rather than
    // presented as a measured repair.
    s = reorderFraction(s, "分之");

    // ── 4. percent, units, exponents and the ampersand, via the shared tier ──────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule: the tier matches
    // ASCII digits beside the sign, and step 5 puts 點 between them, which would break that adjacency for a
    // decimal percentage — and this corpus HAS one (`多噶12.8%`).
    s = SYMBOLS(s);

    // ── 5. decimals ─────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules, for the adjacency reason above. The fractional part is read DIGIT BY DIGIT —
    // 六點三四, never 六點三十四 — and the shared rule carries the dotted-designation guard (`1.2.3`) that
    // the jv layer earned. ×29, currently reading as a clause pause.
    s = readDecimals(s, "點");

    // ── 6. ranges ───────────────────────────────────────────────────────────────────────────────
    // LAST, so every rule that owns a dash has already consumed it. ⟨到⟩ is the corpus's own connective
    // (×65). ⚠ Only 3 bare `d-d` instances exist here, and the guard is deliberately tighter than the
    // corpus-backed layers': digits only, both sides, nothing else touching, and NOT after a Latin run at
    // all — which a one-character lookbehind cannot express, because `ISO 8859-1` puts a SPACE between the
    // identifier and the digits and the guard would read the designation as "8859 到 1". cjy paid for that
    // one; it is copied here rather than re-earned.
    s = s.replace(
        /(?<![\d.,/\-\p{sc=Latn}])(\d+)\s*[-–~〜－]\s*(\d+)(?![\d.,/\-\p{sc=Latn}])/gu,
        (m, a: string, b: string, off: number, full: string) =>
            /\p{sc=Latn}[\s\p{sc=Latn}]*$/u.test(full.slice(Math.max(0, off - 12), off)) ? m : `${a}到${b}`,
    );

    return s;
}
