/**
 * Gan Chinese / 贛語 (gan, Nanchang) text normalization — the pre-tokenizer pass that rewrites what is not yet
 * a pronounceable word into Han the dict already speaks. Pure text→text, no IPA.
 *
 * ⚠ THE EVIDENCE IS A REAL DUMP, WHICH cjy AND hsn DID NOT HAVE. `tools/corpus/mined/gan.jsonc` is
 * dump-sourced (gan.wikipedia pages-articles, paragraphs), 3,020 segments, **covered 29/35 cells** — so its
 * `sample` tier is the language's actual distribution and the counts below mean what they say. The classes,
 * over the whole corpus: **year 1102 · digit-run 1119 · decimals 207 · signs 153 · percent 104 · grouped 89 ·
 * ranges 58 · exponent 24 · degrees 15 · ampersand 15 · fractions 11 · signed-number 9 · units 2 ·
 * currency 1**. This is the hak situation, not the cjy one.
 *
 * ⚠ TIER 1, AND IT IS A HARD GATE: THE SHIPPED DICT DECIDES WHETHER A WORD SPEAKS AT ALL. The shared engine
 * (`core/hanDictIpa.ts`) segments by greedy longest match and **skips an uncovered character SILENTLY** —
 * so an unsourced word is not mispronounced, it VANISHES, which is worse than leaving the symbol unread.
 * Every word this file emits was run through `phonemizeWord` first:
 *
 *     SPEAKS   百分之 · 分之 · 點 · 到 · 同到 · 公里 · 公斤 · 平方 · 負 · 元 · 第 · 零 一 二 … 萬 億
 *     SILENT   度 · 溫度 · 兩/两 · 正 · 加 · 減 · 乘 · 噸
 *     HALF     攝氏 → sz̩˩˩ (1 of 2, drops 攝) · 攝氏度 (1 of 3) · 等於 → tɛn˨˩˧ (drops 於) · 公頃 · 厘米
 *
 * That decides the refusals below on FACT rather than taste. ⚠ And it exposes something that is NOT this
 * layer's to fix: ⟨度⟩ is silent, ×82 in the artifact text, **including inside 溫度** — a dict gap, recorded
 * here because it is the reason the degree rules are declined and not because a rule could close it.
 *
 * ⚠ TIER 2 — the corpus, and it settles the choices that are genuinely dialectal rather than pan-Chinese.
 *
 * ── THE CONJUNCTION, AND ⟨和⟩ IS A TRAP HERE ──────────────────────────────────────────────────────────
 *     同到 ×59   ALL coordinating — 水星同到地球 · 手銬、腳鐐同到鎖鏈 · 兩隻鄉同到一隻大型水庫管理局
 *     同得 ×32   also all coordinating — 長三角同得珠三角 · 香水同得別嗰滴子奢侈產品
 *     跟   ×42   (bare 30) 綿水跟湘水 · 豐城跟南昌 · 部分領土跟周邊國家
 *     和   ×49   — but ×20 are 共和國 "Republic", a BOUND COMPOUND, and several of the rest sit in the
 *                corpus's Standard-Mandarin paragraphs (`北接万载、上高和湖南省浏阳市`). Playbook trap 2/37:
 *                the only competitive-looking count is mostly a different morpheme.
 * ⟨同到⟩ it is. That makes **six lects, six answers** — wuu 搭, nan 佮, hak 摎, cjy 和, hsn 跟, gan 同到 —
 * which is the whole argument for the connective living in each layer and never in `core/sinitic.ts`.
 * ⚠ AND THIS IS THE WEAKEST CALL IN THE FILE, stated so nobody has to re-derive it. Of the `&` that survive
 * the registry's markup strip, **one is Han-flanked** (`咸摩斯密史&實第線`, the Hammersmith & City line) and
 * about eleven sit inside Latin runs — `W. W. Norton & Company`, `Smith, Elder & Co.`, `Dolce & Gabbana`,
 * `Tiffany & Co.`, `R&B`. Declaring the word puts a Gan syllable inside an English name; NOT declaring it
 * merges `R&B` into one token, which is playbook trap 18's exact hazard. Every other Sinitic layer declares
 * it, the tier cannot condition on the surrounding script, and a tier change is out of one language's
 * scope — so it is declared, with the ratio on record.
 *
 * ── THE DECIMAL POINT: gan IS THE FIRST SINITIC LECT IN THIS SWEEP WHOSE CORPUS ATTESTS IT ────────────
 * cjy, hsn, wuu, nan and jv all shipped their separator word with only the NOUN sense attested, and each
 * header says so. gan's ⟨點⟩ ×13 splits: the noun ×6 (熔點 特點 景點 重點 觀點 終結點), a clock ×2
 * (十七點, 七點五十五分) — and **`有三點八億`, "3.8 hundred-million", the SEPARATOR ITSELF written out in
 * running Gan prose**. That closes the open question those five headers flagged, for the family.
 *
 * ── THE NEGATIVE SIGN IS ALSO ATTESTED, WHICH IS RARE FOR A SIGN (playbook traps 35/48) ───────────────
 * ⟨負⟩ speaks, and its corpus instances are the mathematical sense in gan's own integer article:
 * `佢個哩嗰負值(-1、-2、-3...)` and `向數線嗰正負兩頭延伸`. The word sits beside the glyphs it names.
 *
 * ── WHAT IS DELIBERATELY NOT DONE, each on a measurement ──────────────────────────────────────────────
 *
 * ⚠ NO DEGREE, NO TEMPERATURE. ⟨度⟩ is SILENT and ⟨攝氏⟩ is HALF, so `20°C` would lose the WORD as well as
 * the sign — strictly worse than the raw sign, which at least survives as a RAWMARK the scan can see. The
 * corpus agrees it would not repay much: its ° are coordinates (`東經116°57′--117°42′`) and compass angles
 * (`090°`, `47.8°`), plus exactly ONE real temperature (`熔點380℃`). The cjy and hsn answer, on the same
 * dict fact. ⚠ Note the corpus writes `係090度，符號090°` — the WORD, and the word is silent too.
 *
 * ⚠ NO BARE EXPONENT, AND gan IS THE SIXTH SINITIC CORPUS TO FORCE THIS REFUSAL — `test/accepted-silent.
 * test.ts` predicted it here BY NAME. The large majority of this corpus's superscript runs are NANCHANG
 * TONE NUMBERS from the wiki's own pronunciation glosses — `（南昌話：/ŋa²¹³ ɕi³⁵ ŋa…/）`, `/tʰi¹¹ tɕʰiu²⁴/`,
 * `[kɔŋ⁴⁴ tsʰik⁵…]` — against about five genuine exponents (`10⁻¹⁹`, `c²`, `10⁻²⁷`, `cm³`, `10¹⁹`). Reading
 * superscripts as powers would turn this very engine's phonology glosses into arithmetic. wuu, nan, cjy,
 * hak and hsn each hit the same hazard from a different source. A squared UNIT is still read: it composes
 * with a unit noun and so cannot match a bare tone number.
 *
 * ⚠ THE REFUSAL IS NARROWER THAN IT WAS, AND STILL HOLDS. `bareExponent` remains undeclared, but the shared
 * tier no longer DELETES an undeclared power: since #1041 it spaces a DIGIT-base run out to its digits
 * (`10¹⁹` → `10 19`, one of the five genuine exponents listed above), which the tone-number hazard above cannot reach — every tone run here sits on a LETTER
 * base, and letter bases are declined outright.
 *
 * ⚠ CUBED WAS DECLINED ON THE CORPUS AND RESTORED BY THE WIKI. ⟨立方⟩ is ×0 in the artifact against ⟨平方⟩'s
 * ×29, which is exactly the evidence hak used to decline its cognate — but `attest.ts` finds it ×3 on
 * gan.wikipedia in the volume slot, once onto this layer's own unit (`3210平方公里，含水量係25.2立方公里`).
 * Declared, and labelled at the declaration as robustness on the weaker tier rather than a measured repair.
 *
 * ⚠ NO CLOCK. `\d{1,2}:\d{2}` is ×3 in the artifact text and all three are `ISO 8601:2000`,
 * `ISO/IEC 14882:1998` and `:2003` — standard numbers, not times. The artifact's `clock: 58` is the cell's
 * `[:.]` alternative, i.e. decimals (playbook trap 21: a filled cell is a lead, not a finding). A colon
 * rule here would claim only what it must not.
 *
 * ⚠ THE DOLLAR WAS DECLINED ON THE CORPUS AND RESTORED BY THE WIKI, and the two-step is worth keeping. The
 * corpus's `$` ×4 are all in ONE article — a film's box office, labelled UK takings — and the only money
 * word it attests is 美金 ×1 in a fine, so on corpus evidence alone a currency word would have been a guess
 * of exactly the kind the Fula `tere` lesson forbids. `attest.ts` settled it: gan.wikipedia writes 美元 ×5
 * in monetary amounts AND states the sign outright — `美金（United States dollar），又叫美圓、美元，符號USD
 * 或者US$`. See the declaration for the third leg. ⟨元⟩ ×77 also speaks and is attested (`起步2元6公里`) —
 * but as the WORD, never as a reading for a sign, which is why it is not the key.
 *
 * ⚠ NO ARITHMETIC OR RELATIONAL SIGNS. ⟨加⟩ ⟨減⟩ ⟨乘⟩ are all SILENT and ⟨等於⟩ emits one syllable of two.
 * And the signs would not repay it anyway: the corpus's `=` and `+` are set theory (`0=0/1`,
 * `2'=0' ' '={0,1,2}`) and a LaTeX body (`e\,^{i \pi} + 1 = 0\;`).
 *
 * ⚠ NO LATIN INITIALISMS. gan's `dict.tsv` has **0 Latin keys**, espeak ships no Gan at all, and
 * `sources.ts` reports `[NONE] letter-names`. Structurally blocked for want of a letter table, not deferred
 * for want of effort — the hak answer, and playbook trap 16 checked rather than assumed.
 *
 * ⚠ NO PERCENT RANGE. `3%-4%` ×1 comes out `百分之 3-百分之 4`: step 4 claims each `%`, which puts Han on
 * both sides of the dash, so step 7 can no longer see two digits and the dash stays silent — as it was
 * before this layer existed. Re-ordering does not help (the `%` sits between the digit and the dash either
 * way); it would need a percent-range rule of its own, for one instance. Counted and declined.
 *
 * ⚠ FOUND HERE, FIXED IN `src/core` SINCE, AND THE NOTE IS KEPT BECAUSE THIS LAYER IS WHAT EXPOSED IT: the
 * shared number path used to SILENTLY EMIT NOTHING above `Number.MAX_SAFE_INTEGER`. Bisected exactly —
 * `9007199254740991` read, `9007199254740992` was the empty string. De-grouping (step 1) is what exposes
 * it: this corpus's `9,460,730,472,580,800 米` (a light-year in metres) used to read as six comma-separated
 * fragments, and then as silence. `core/hanDictIpa.ts` now falls back to DIGIT-AT-A-TIME above 2^53 rather
 * than composing a numeral the float has already corrupted, so the magnitude survives as a digit string —
 * the ×1 here and the corpus's only other ≥16-digit run (a 59-digit expansion of π) both read.
 * `test/sinitic-core.test.ts` pins it across every engine that shared the defect.
 *
 * ⚠ `\b` IS NEVER USED — ASCII-defined, and it finds no boundary against Han (playbook trap 1/19).
 * ⚠ ℃/℉ arrive already folded to `°C`/`°F`, HTML entities are already decoded and markup already stripped,
 * all at the registry's single dispatch point — which matters here, because the artifact's raw `&` are
 * mostly `&nbsp;` and they never reach this file.
 */
import { makeSymbolNormalizer } from "../../core/normalizeSymbols.ts";
import { degroupThousands, readDecimals, reorderFraction, spellYears } from "../../core/sinitic.ts";
import { rewrite } from "../../core/provenance.ts";

/**
 * ⚠ `unspacedScript`, because a sign in Gan prose is normally flanked by Han and the tier's letter-boundary
 * guard would otherwise refuse the ORDINARY case (playbook trap 27). `percentPrefix` because 百分之 PRECEDES
 * its number, as in every Sinitic variety — and here it is attested doing exactly that, in words:
 * `地球超過百分之七十表面拕水覆蓋`.
 *
 * ⚠ NO `currency` AND NO `degree` — both would emit silence or the wrong money; see the header.
 * ⚠ `m` IS ABSENT for the reason yue, wuu, cjy, hsn and hak all give: ⟨米⟩ is a one-character unit and in an
 * unspaced script that is inseparable from any name containing it. ⟨公尺⟩ speaks and is recorded here for
 * whoever needs it, but the corpus writes ⟨米⟩ ×35 as a WORD and no bare `m` symbol at all, so nothing is
 * declared. ⟨公里⟩ ×37 and ⟨平方公里⟩ ×29 are what this corpus actually says.
 * ⚠ `cubed` IS ABSENT — see the header; ⟨立方⟩ is ×0 here.
 */
const SYMBOLS = makeSymbolNormalizer({
    ampersand: "同到",
    percent: ["百分之"],
    percentPrefix: true,
    units: { km: ["公里"], kg: ["公斤"] },
    // ⚠ `magnitudes` IS DECLARED FOR A MEASURED DEFECT, not for robustness. Chinese writes its magnitude
    // between the number and the unit — `面積係750萬 km²` — which breaks the number-unit adjacency the tier
    // matches on, so that km² was DROPPED outright: the exponent AND the unit noun, not merely the sign.
    // ×1 in this corpus, and it is the only genuine `km²` the corpus contains (every other superscript run
    // is a tone number). `magAlt` also gates the currency path, and this layer declares no currency, so the
    // "one declaration, two consumers" hazard is inert here. Verified: `第750萬名` and `收入750億元` are
    // untouched — the hop only fires when a unit or sign follows the magnitude.
    magnitudes: ["萬", "億", "万", "亿"],
    // ⚠ THE DOLLAR, AND IT WAS DECLINED UNTIL `attest.ts` SETTLED THE SENSE. The corpus alone could not:
    // its 4 `$` are all in ONE article, a film's box office (`$116,089,678`, `$363,889,678`, `$0.27億`,
    // `$0.15億`), described as UK takings, and the only money word the corpus attests is 美金 ×1 in a fine.
    // On that evidence a currency word would have been a guess. gan.wikipedia closes it three ways:
    //   · 美元 ×5 tokens / 4 articles, every one a MONETARY AMOUNT — `註冊資金有11095萬美元，總投資近3億
    //     美元`, `身價達38.5億美元`. The sense is checked, not assumed (the Fula `tere` lesson).
    //   · THE WIKI GLOSSES THE SIGN ITSELF: `美金（United States dollar），又叫美圓、美元，符號USD或者US$`.
    //     That is the language's own statement that `$`/`US$` denotes this currency.
    //   · And the corpus's own figure `$363,889,678` is the film's WORLDWIDE gross, which is quoted in US
    //     dollars by convention — so the article's "UK" label is loose and the currency is not.
    // ⚠ 美元 rather than the corpus's 美金: both speak, both are attested, and 美元 is what wuu and yue
    // already declare for `$` — the neutral term, where 美金 is the wiki's own headword for the colloquial
    // one. Only `$` is declared; `€`, `£` and `¥` are ×0 in this corpus and stay unread.
    currency: { $: ["美元"] },
    // ⚠ `cubed` IS DECLARED ON THE WIKI TIER, NOT THE CORPUS — and it is labelled as robustness rather than
    // a measured repair. ⟨立方⟩ is ×0 in the artifact (which is why hak declined its cognate), but
    // gan.wikipedia writes it ×3 in exactly the volume slot, including onto the unit this layer declares:
    // `鄱陽湖嗰面積係3210平方公里，含水量係25.2立方公里` — square and cube, one sentence, same noun. It
    // speaks (lit̚˥ fɔŋ˦˨). No corpus line changes; a `km³` would otherwise lose the unit as well as the sign.
    exponentWords: { squared: ["平方"], cubed: ["立方"], position: "compound" },
    unspacedScript: true,
});

/** Normalize one Gan string. The steps are ORDER-DEPENDENT and each says what breaks if it moves. */
export function normalizeGan(input: string): string {
    let s = input;

    // ── 0. the superscript ordinal indicators, folded to their base letters ──────────────────────
    // ⚠ THE ONLY LEAK THE ARTIFACT SCAN REPORTS, and it is a compatibility character rather than a sign:
    // `ª` (U+00AA) reaches the IPA RAW in `ישׁעיהו（Yəšaʻªyāhû）`, a transliterated Hebrew name in the
    // article on Hebrew name affixes. U+00AA is the superscript letter a, so `a` is exactly its reading —
    // this is playbook trap 36's move (fold the compatibility character; never reach for blanket NFKC).
    // ⚠ SAFE HERE PRECISELY BECAUSE IT IS LOCAL. `º` is in the RAWMARK class because Italian writes
    // `dell'11º` as an ORDINAL, where folding to `o` would be wrong. Gan writes neither as an ordinal — its
    // ordinals are 第N, `º` is ×0 in the corpus and `ª` is ×1, the transliteration above. `core/unicode.ts`
    // folds neither, and widening the shared fold list is a fleet change with its own measurement, so the
    // repair stays in the one language that has been measured to need it.
    s = rewrite(rewrite(s, /ª/gu, "a"), /º/gu, "o");

    // ── 1. de-group thousands ────────────────────────────────────────────────────────────────────
    // ⚠ FIRST, and it is the most destructive thing this engine does to a number: the tokenizer splits on
    // `\d+`, so a grouping comma becomes a CLAUSE PAUSE and the value is destroyed — `1,000人` reads
    // *it̚˥ , lin˧˥ n̠ʲin˧˥*, "one … zero … person". ×89 in this corpus (`36,192.8155平方公里`,
    // `2,095km2`, `$116,089,678`, `299,792,458`).
    // ⚠ EXACTLY-3-DIGIT GROUPS, which is what leaves the Chinese 万-grouping alone; the shared rule carries
    // the reasoning and the guards.
    s = degroupThousands(s);

    // ── 2. years ─────────────────────────────────────────────────────────────────────────────────
    // ⚠ THE BIGGEST CLASS IN THIS CORPUS BY FAR — `year 1102`, against 207 decimals and 104 percents. All
    // three arms and their order (range → both-endpoints → single) live in `core/sinitic.ts`; that order
    // was rediscovered the hard way in yue, wuu, cjy and hsn, and this corpus writes both shapes
    // (`(2009-2016年)`, `《2014-2020》`).
    // ⚠ Digit-by-digit is the pan-Chinese convention, corpus-verified in the cmn and wuu layers. gan's own
    // corpus writes every year in digits and never spells one out, so it cannot confirm the reading —
    // inference from the family, flagged as one, exactly as cjy and hsn flagged it.
    // ⚠ AND `\d{4}年` IS NOT ALWAYS A YEAR — see step 2b, which must run BEFORE this and does.
    s = protectDurations(s);
    s = spellYears(s, { rangeWord: "到" });
    s = s.replaceAll(AGO, "年");

    // ── 3. the fraction, in the Chinese order ────────────────────────────────────────────────────
    // ⚠ `a/b` IS `b分之a`, "of b parts, a" — and ⟨分之⟩ is ATTESTED here in that exact construction, ×5:
    // 四分之一 · 千分之35 · 千分之31至38 · 八分之一 · `(…299,792,458) 分之一秒`. Not an inference for once.
    // The corpus's own fractions are `22/7`, `355/113`, `1/3`, `2/3`, `7/9`, `1/120`, `1/20`, `1/5`, `1/2`,
    // `1/10` — a maths article on π and one on rational numbers.
    // ⚠ The shared rule carries the guards three corpora paid for: FOUR DIGITS ON BOTH SIDES IS A YEAR PAIR
    // (`2020/2021`), and a Latin letter before the numerator makes it a CODE (hak's rolling stock). Both
    // matter here — this corpus writes `[ … ] 한국일보 2007/01/22일자` and `GB/T 7408-2005`.
    // ⚠ AND A CHAINED SLASH IS LEFT ALONE by the same rule: `每加一元就加6/8/10公里` is a fare table, not a
    // fraction, and the trailing `(?![\d/])` plus the leading `(?<![…/])` reject every arm of it.
    s = reorderFraction(s, "分之");

    // ── 4. percent, units, exponents and the ampersand, via the shared tier ──────────────────────
    // AFTER de-grouping (the tier needs the number contiguous) and BEFORE the decimal rule: the tier matches
    // ASCII digits beside the sign, and step 5 puts 點 between them, which would break that adjacency for a
    // decimal percentage — and this corpus is full of them (`87.4%`, `47.5%`, `46.9%`, `58.2%`, `99.8%`).
    // ⚠ The `%` is ×104 and currently SILENT; ⟨百分之⟩ is attested in prose here (`超過百分之七十`).
    // ⚠ `2,095km2` is why the ASCII-2 exponent matters and not only `km²` — that is the bug the ja layer
    // shipped by matching only the superscript.
    s = SYMBOLS(s);

    // ── 4b. per mille ───────────────────────────────────────────────────────────────────────────
    // ⚠ ONE INSTANCE (`人口自然增長率 9.8‰`), and it is here because the WORD IS ATTESTED IN EXACTLY THIS
    // SLOT, twice, which almost nothing about a sign ever is: `千分之35(3.5%)` and `千分之31至38之間` —
    // ⟨千分之⟩ prefixing a number, in the corpus's own article on the oceans. ⟨千分之⟩ speaks (3 syllables).
    // The `‰` is currently dropped outright, so this closes a real silence with a sourced word rather than
    // adding robustness for input the language has never been seen to write (playbook trap 17: count it
    // before deferring it — the count is 1, and the rule is one line).
    // ⚠ The shared tier has no per-mille slot, so this is LOCAL by architecture, not by idiom (trap 47.4).
    // ⚠ BEFORE the decimal rule, for the same adjacency reason step 4 gives: `9.8‰` must still be a
    // contiguous digit run when this matches, and step 5 then turns it into 千分之9點八.
    s = rewrite(s, /(?<![\d.,])(\d+(?:\.\d+)?)\s*‰/gu, (_m, n: string) => `千分之${n}`);

    // ── 5. decimals ─────────────────────────────────────────────────────────────────────────────
    // LAST of the number rules, for the adjacency reason in step 4. ×207, currently reading the point as a
    // CLAUSE PAUSE and the fractional part as a cardinal: `3.14` → *san˦˨ . sɨt̚˨ sz̩˧˥*, "three, fourteen".
    // The fractional part is read DIGIT BY DIGIT — 三點一四, never 三點十四 — and ⟨點⟩ is attested as the
    // separator in this corpus (`有三點八億`), which no other Sinitic layer could say.
    // ⚠ The shared rule carries the dotted-designation guard (`1.2.3`) the jv layer earned, which this
    // corpus needs: `Build係5.1.2600`, `Windows NT 5.1`, `ISO 8601:2000`.
    s = readDecimals(s, "點");

    // ── 6. the negative sign ────────────────────────────────────────────────────────────────────
    // ⚠ gan IS THE ONE LECT IN THIS FAMILY THAT CAN AFFORD THIS RULE, because ⟨負⟩ both SPEAKS and is
    // attested IN SENSE: `佢個哩嗰負值(-1、-2、-3...)` and `向數線嗰正負兩頭延伸`, in the corpus's own
    // article on the integers. Six real negatives: ` -4.6` and `-2.0` (stellar magnitudes), `, -1` (a list
    // of rationals), `(-1`, `、-2`, `、-3`, and the ` −15` of `1.7×10 −15 m`.
    // ⚠ THE GUARD IS A POSITIVE LIST, NOT A NEGATIVE ONE, and that is playbook trap 24 (hi's minus). Every
    // counter-example in this corpus is a RANGE or a DESIGNATION with the dash BETWEEN two characters —
    // `ISBN 1-55849-175-9`, `113°54′-114°37′` (the ′ is not a digit, so a "not preceded by a digit" guard
    // would have claimed it), `1887年10月31號-1975年4月5號`, `(2009-2016年)`, `5-12米`, `70-20萬年前`,
    // `6-10號綫`. Requiring the sign to OPEN a string, a bracket or a list item excludes all of them.
    // ⚠ `到-2.0` IS THEREFORE NOT CLAIMED — one real negative given up to keep the guard provably clean.
    // ⚠ AFTER the decimal rule, so `-4.6` is already `-4點六` and the sign is still the character it needs.
    s = rewrite(s, /(^|[\s(（、,，])[-−](\d)/gu, (_m, pre: string, d: string) => `${pre}負${d}`);

    // ── 7. ranges ───────────────────────────────────────────────────────────────────────────────
    // LAST, so every rule that owns a dash has already consumed it. ⟨到⟩ is the corpus's own numeric
    // connective — `4.8到5.5米許高`, `葉長 10 到 25 厘米`, `一束有 3 到 12 朵` — and it is the pan-Sinitic
    // choice yue, wuu, cjy and hsn all made. (⟨至⟩ ×1, `千分之31至38之間`, is the minority form.)
    // ⚠ THE GUARD IS THE TIGHT cjy/hsn ONE — digits both sides, nothing else touching, and NOT after a
    // Latin run at all, which a one-character lookbehind cannot express because `ISO 8859-1` puts a SPACE
    // between the identifier and the digits. That is not theoretical here: `ranges 58` in this corpus is
    // dominated by ISBNs (`ISBN 1-55849-175-9`, `ISBN 7-5060-1052-6`, `ISBN 978-0-393-924…`), where the
    // adjacent-dash rejection does most of the work and the Latin-run check finishes it.
    s = rewrite(s,
        /(?<![\d.,/\-\p{sc=Latn}])(\d+)\s*[-–~〜－]\s*(\d+)(?![\d.,/\-\p{sc=Latn}])/gu,
        (m, a: string, b: string, off: number, full: string) =>
            /\p{sc=Latn}[\s\p{sc=Latn}]*$/u.test(full.slice(Math.max(0, off - 12), off)) ? m : `${a}到${b}`,
    );

    return s;
}

/**
 * ── 2b. `\d{4}年` THAT IS A DURATION, NOT A YEAR ─────────────────────────────────────────────────
 *
 * ⚠ FOUND BY READING THE CORPUS AND CONFIRMED BY THE DIFF. `年` after four digits
 * is a year almost everywhere and reads digit-by-digit; but `約西元前5000年到3000年前` is "5,000 to 3,000
 * years ago" and `（4000年到5000年前）` is "4,000 to 5,000 years ago" — QUANTITIES, which want the cardinal
 * 五千 and not 五零零零. hsn met the same shape and fixed it the same way.
 *
 * ⚠ AND THE hsn RULE IS TOO BLUNT FOR gan. hsn protects every `\d{4}年前`; this corpus also writes
 * `5條綫路在2014年前得批准` — "approved BEFORE 2014", where 2014 IS a year and the digit-by-digit reading is
 * the right one. What separates them is not the 前: it is that a duration is one END OF A SPAN whose other
 * end also carries 年. So the protection is keyed on the PAIR `\d{4}年 到|至|-… \d{4}年前`, which claims both
 * endpoints of the two real durations and leaves the lone `2014年前` to spell. Counted in the artifact text:
 * 2 pairs protected, 1 lone year still spelled, 0 other matches.
 *
 * ⚠ FIXED LOCALLY RATHER THAN IN `core/sinitic.ts`, on the same measurement hsn used: this is a handful of
 * instances in one corpus, and a shared change would be carried by six languages to fix them. The sentinel
 * is a PUA code point, which cannot occur in the text, and is swapped back immediately after `spellYears`.
 */
const AGO = "";
function protectDurations(s: string): string {
    return rewrite(s, /(\d{4})年(\s*(?:到|至|[-–~〜－])\s*)(\d{4})年(?=前)/gu, (_m, a: string, mid: string, b: string) => `${a}${AGO}${mid}${b}${AGO}`);
}
