/**
 * Jin Chinese / 晋语 (cjy, Taiyuan) text normalization — the pre-tokenizer pass that rewrites what is not yet
 * a pronounceable word into Han the dict already speaks. Pure text→text, no IPA.
 *
 * ⚠ THIS LANGUAGE HAS NO CORPUS, AND THAT BOUNDS EVERY RULE BELOW. There is no `cjy.wikipedia` (gan, hak and
 * cdo have one; cjy and hsn do not) and no FLEURS. The only Jin text that exists is the Wikimedia Incubator's
 * `Wp/cjy` — 159 pages, 15,088 characters of raw wikitext of which **3,060 are Han**, most of the rest CSS
 * and markup from the main page. It is mined to `tools/corpus/mined/cjy.jsonc` anyway, and the artifact's own
 * verdict is the finding: **covered 7/35 cells**, with degrees, fractions, units, ranges, currency, percent,
 * grouped, ampersand and twenty more EMPTY. The playbook says an empty cell is a query to run — here the
 * query has been run and the text does not exist.
 *
 * So this layer cannot be sized by frequency and its corpus diff cannot carry the usual weight. It rests on
 * two tiers instead, and says which is which at every rule.
 *
 * ⚠ TIER 1, AND IT IS A HARD GATE: THE SHIPPED DICT DECIDES WHETHER A WORD SPEAKS AT ALL. The shared engine
 * (`core/hanDictIpa.ts`) segments by greedy longest match and **skips an uncovered character SILENTLY** —
 * so an unsourced word is not mispronounced, it VANISHES, which is worse than leaving the symbol unread.
 * Every word this file emits was checked through the engine:
 *
 *     SPEAKS   百分之 · 分之 · 點 · 到 · 和 · 公里 · 公尺 · 公斤 · 平方 · 立方 · 零 一 二 …
 *     SILENT   度 · 摄氏/攝氏 · 两/兩 · 正 · 减
 *     HALF     等于 → təŋ˥˧ — ONE syllable, because 于 is silent: it would say "děng" and drop "yú"
 *
 * That decides four refusals on FACT rather than taste, and they are listed below rather than inferred.
 *
 * ⚠ TIER 2 — the incubator text, thin but the language's own, and it settles the two choices that are
 * genuinely dialectal rather than pan-Chinese:
 *     和 ×16, coordinating — `吳語、粵語和閩南語`, `并州話和呂梁話`, `河南省…大部和河北省西面`
 *     到 ×5, "up to"       — `到了1996年`, `到2007年`
 * (⟨跟⟩ ×5 is the colloquial alternative and 和 is three times commoner here. ⟨箇⟩ ×15 against ⟨个⟩ ×4 is a
 * real Jin orthographic fact, noted for whoever adds a classifier rule — this file needs none.)
 *
 * Deliberately left alone, each on the dict check rather than a feeling:
 *   · THE DEGREE. ⟨度⟩ is SILENT, so `20°C` would lose the word as well as the sign — strictly worse than
 *     the raw sign, which at least survives as a RAWMARK the scan can see. ⟨摄氏⟩ is silent too.
 *   · THE `2 + classifier → 两` RULE that cmn and yue both carry: ⟨两⟩ and ⟨兩⟩ are both SILENT.
 *   · THE RELATIONAL SIGNS. ⟨等于⟩ emits one syllable and drops the second.
 *   · CURRENCY. ⟨元⟩ speaks, but its four incubator instances are 維基元 (Meta-Wiki) and the names 元好問 /
 *     柳宗元 — never money. No Jin currency word is attested anywhere available, so the sign stays unread.
 *   · THE CLOCK, and every other class the artifact reports EMPTY. Nothing to measure means nothing to claim.
 *
 * ⚠ THE ONE WORD SHIPPED WITHOUT AN ATTESTED SENSE is the decimal ⟨點⟩: its three incubator instances are the
 * NOUN (特點 "characteristic", 點“寫動” "click"), never a separator. That is the same trap wuu's 点, jv's
 * `koma` and nan's `tiám` hit, and it is shipped for the same reason — a written corpus is the weakest
 * evidence there is about how a SYMBOL is spoken, and the alternative is a decimal point read as a clause
 * pause. Here the argument is thinner than in those languages, because there is no corpus to count against.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, readDecimals, reorderFraction, spellYears } from "../../core/sinitic.ts";
import { rewrite } from "../../core/provenance.ts";

/**
 * ⚠ `unspacedScript`, because a sign in Han prose is flanked by Han and the tier's letter-boundary guard
 * would otherwise refuse it. `percentPrefix` because 百分之 PRECEDES its number, as in every Sinitic variety.
 *
 * ⚠ NO `currency` AND NO `degree`, for the reasons in the header — both would emit silence.
 * ⚠ `m` IS ABSENT for the reason yue and wuu give: 米 is a one-character unit, and in an unspaced script that
 * is inseparable from any name containing it. 公尺 is declared instead, which is two characters and speaks.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "和",
    percent: ["百分之"],
    percentPrefix: true,
    units: { km: ["公里"], kg: ["公斤"] },
    exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
    unspacedScript: true,
});

/**
 * Normalize one Jin string. The steps are ORDER-DEPENDENT and each says what breaks if it moves.
 */
export function normalizeJin(input: string): string {
    let s = input;

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and this is the most destructive defect the engine has on numbers: the tokenizer splits
    // `\d+`, so a grouping comma is read as a clause pause AND the value is destroyed — `1,000` came out
    // *iəʔ˨ , liŋ˩˩*, "one … zero". Exactly-3-digit groups, which cannot touch a decimal.
    s = rewrite(s, /(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d,])/gu, (m) => m.replace(/,/gu, ""));

    // ── 2. years ─────────────────────────────────────────────────────────────────────────────────
    // ⚠ ALL THREE ARMS AND THEIR ORDER LIVE IN `core/sinitic.ts` — range, then both-endpoints, then single.
    // That order was rediscovered the hard way in yue, wuu and again here (`1996-2007年` read one span with
    // two different readings), which is why it is shared rather than copied a fourth time.
    // ⚠ INFERENCE, and flagged as one: the digit-by-digit year is the pan-Chinese convention, corpus-verified
    // in the cmn and wuu layers, applied to a language whose own corpus (7/35 cells) cannot confirm it. The
    // incubator writes `到了1996年` and `到2007年` in digits and never spells a year out.
    s = spellYears(s, { rangeWord: "到" });

    // ── 3. the fraction, in the Chinese order ────────────────────────────────────────────────────
    // ⚠ `a/b` IS `b分之a`, and the shared rule carries the guard three corpora paid for: FOUR DIGITS ON BOTH
    // SIDES IS A YEAR PAIR (`2020/2021`), not a fraction. Both 分 and 之 SPEAK in this dict.
    s = reorderFraction(s, "分之");

    // ── 4. percent, units, exponents and the ampersand, via the shared tier ──────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule: the tier matches
    // ASCII digits next to the sign, and step 5 replaces the "." with 點, which would break that adjacency
    // for a decimal percentage.
    s = SYMBOLS(s);

    // ── 5. decimals ─────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules: the tier matches ASCII digits next to a sign, and replacing the "." with 點
    // would break that adjacency for a decimal percentage. The separator is a word and the FRACTIONAL PART
    // IS READ DIGIT BY DIGIT — 六點三四, never 六點三十四 — and the shared rule carries the dotted-designation
    // guard (`1.2.3`) that the jv layer earned.
    s = readDecimals(s, "點");

    // ── 6. ranges ───────────────────────────────────────────────────────────────────────────────
    // LAST, so every rule that owns a dash has already consumed it. ⟨到⟩ is the incubator's own connective
    // (×5, `到了1996年`, `到2007年`) and the one this language demonstrably uses for "up to".
    // ⚠ NOT CLAIMED WHEN A LATIN LETTER OR ANOTHER DASH IS ADJACENT — that keeps a designation (`ISO 8859-1`)
    // and a chained identifier out. With no corpus to count the false-positive shapes, the guard is
    // deliberately tighter than the corpus-backed layers': digits only, both sides, nothing else touching.
    // ⚠ AND NOT AFTER A LATIN RUN AT ALL, which a one-character lookbehind cannot express: `ISO 8859-1` put
    // a SPACE between the identifier and the digits, so the guard saw the space and read the designation as
    // "8859 到 1". Checked over the preceding characters instead.
    s = rewrite(s,
        /(?<![\d.,/\-\p{sc=Latn}])(\d+)\s*[-–~〜]\s*(\d+)(?![\d.,/\-\p{sc=Latn}])/gu,
        (m, a: string, b: string, off: number, full: string) =>
            /\p{sc=Latn}[\s\p{sc=Latn}]*$/u.test(full.slice(Math.max(0, off - 12), off)) ? m : `${a}到${b}`,
    );

    return s;
}
