/**
 * Zhuang (za) TEXT NORMALIZATION — the pre-tokenizer layer, asserted through the real phonemizer wherever
 * the reading is the point, and on `normalizeZhuang` directly where the text→text rewrite is.
 *
 * ⚠ THE CASES ARE THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). za's corpus writes
 * exactly one ASCII fraction and one percent-to-percent span, so pinning what it happens to contain would
 * leave the compositional half of both rules unexercised. Where a case is NOT in the corpus the comment
 * says so.
 *
 * ⚠ AND THE EVIDENCE BEHIND EVERY WORD USED HERE IS IN `src/languages/zhuang/normalize.ts`'s header, not
 * here: `faenh cih` (×2, two articles), `daengz` (×310), `goengleix` (×162), `gunghyenz` (×2 in the era
 * sense, ×2 as a PARK), `caeuq` (×1636).
 */
import { describe, expect, test } from "vitest";

import { getPhonemizer } from "../src/registry.ts";
import { normalizeZhuang } from "../src/languages/zhuang/normalize.ts";

const za = getPhonemizer("za");
const n = normalizeZhuang;

describe("za normalization — text→text", () => {
    test("CJK punctuation folds to the marks clausePunctuation knows", () => {
        // The single biggest defect in the language: ~5,200 marks that were entirely silent.
        expect(n("ndeu。Gijgvangj")).toBe("ndeu.Gijgvangj");
        expect(n("Vahraeuz、Vahyaej daengj")).toBe("Vahraeuz,Vahyaej daengj");
        expect(n("de miz 10；hoeng")).toBe("de miz 10;hoeng");
        expect(n("neix？dwg")).toBe("neix?dwg");
        // ⚠ `’` IS A SYLLABLE BOUNDARY INSIDE A WORD, not a quote — it must survive as ASCII `'`, which the
        // g2p reads as an explicit break. Deleting it would fuse the syllables.
        expect(n("fueng’yiengq")).toBe("fueng'yiengq");
        expect(za.text("daih’iek")).toBe(za.text("daih'iek"));
        // …while the curly DOUBLE quotes are real quotation marks and go.
        expect(n("naeuz “ndei” lo")).toBe("naeuz  ndei  lo");
    });

    test("a bracketed foreign-script gloss is dropped, labelled or not", () => {
        // `Sawgun` is literally "Han writing", so the text itself says the run is CHINESE; reading it
        // through the Sawndip dictionary emitted an unrelated Zhuang syllable.
        expect(n("Cungzcoj Si (Sawgun: 崇左市) dieg")).toBe("Cungzcoj Si   dieg");
        expect(n("Si（Sawgun:凭祥市; 拼音: Píngxiáng Shì）gvi")).toBe("Si Píngxiáng Shì gvi");
        // ⚠ AND AN UNBRACKETED HAN RUN IS LEFT ALONE — the stated limit, and what keeps the Sawndip
        // front-end reachable. `za.text("gou 佲")` is a pinned behaviour in zhuang-sawndip.test.ts.
        expect(n("gou 佲")).toBe("gou 佲");
    });

    test("digit de-grouping: the comma only, plus the space", () => {
        expect(n("dwg 1,130.81 bingzfueng")).toBe("dwg 1130 8 1 bingzfueng");
        expect(n("miz 5,047 fanh")).toBe("miz 5047 fanh");
        expect(n("dwg 357 021 bingzfueng")).toBe("dwg 357021 bingzfueng");
        // ⚠ THE DOT IS ZHUANG'S DECIMAL SEPARATOR AND IS NEVER DE-GROUPED. In the Zhuang subset the comma
        // groups ×73 and decimalises ×1; in the same wiki's GERMAN paragraphs the comma decimalises ×25.
        // A rule written from the unfiltered artifact would have got this backwards.
        expect(n("dwg 468.484 bingzfueng")).toBe("dwg 468 4 8 4 bingzfueng");
        // A number followed by its own sentence comma must not lose its tail to the de-grouper.
        expect(n("miz 24,000, caeuq")).toBe("miz 24000, caeuq");
    });

    test("percent — the composed `bak faenh cih`, preposed, with its decimal attached", () => {
        expect(n("Haeujvunz 83.5% dwg")).toBe("Haeujvunz bak faenh cih 83 5 dwg");
        expect(n("Haeujvunz 82% dwg")).toBe("Haeujvunz bak faenh cih 82 dwg");
        expect(n("21％yangjgi")).toBe("bak faenh cih 21yangjgi"); // full-width ％ folds first
        // The percent-to-percent span, which RANGE cannot reach because a `%` stands between the digits
        // and the dash. ×1 in the corpus, with a full-width dash.
        expect(n("beijlwd youq 0.5％－5.0％,")).toBe("beijlwd youq bak faenh cih 0 5 daengz bak faenh cih 5 0,");
    });

    test("fractions swap the operands — Zhuang states the DENOMINATOR first", () => {
        expect(n("ciemq 5/6 gijgvangj")).toBe("ciemq 6 faenh cih 5 gijgvangj"); // the corpus's only one
        // ⚠ THE UNEXERCISED BRANCH: the rule COMPOSES, so these read correctly although the corpus writes
        // neither. This is the case a table-driven rule would have got wrong.
        expect(n("3/4")).toBe("4 faenh cih 3");
        expect(n("1/2")).toBe("2 faenh cih 1");
        // …and the cap is what keeps it off everything else a slash does here.
        expect(n("300g/L")).toBe("300g/L");
        // ⚠ THE CAP IS 100 AND THIS IS WHAT IT COSTS: an ascending pair under a hundred is read as a
        // fraction whatever it meant, so a vision ratio or a chronology span would be claimed. The Zhuang
        // subset contains exactly ONE `\d{1,3}/\d{1,3}` instance — `ciemq 5/6 gijgvangj` — and nothing
        // else the cap could take wrongly, which is the whole of the evidence for keeping it wide.
        expect(n("miz 20/60 lo")).toBe("miz 60 faenh cih 20 lo");
        expect(n("60/20")).toBe("60/20"); // descending → left alone
        expect(n("12/04/2014")).toBe("12/04/2014"); // a third field rejects a date before the cap has to
    });

    test("ranges take `daengz`, ascending only, and the DATE arm is the commoner shape", () => {
        expect(n("Goethe(1749-1832) dwg")).toBe("Goethe(1749 daengz 1832) dwg");
        expect(n("daih 7-11 geiz")).toBe("daih 7 daengz 11 geiz");
        // ⚠ ×95 spans hang off a DATE NOUN rather than a digit — searching only for digit-dash-digit finds
        // 28 and misses these. Full-width `－` and en/em dashes all fold to `-` at step 2 first.
        expect(n("78 nienz－139 nienz")).toBe("78 nienz daengz 139 nienz");
        expect(n("12 hauh-1882 nienz")).toBe("12 hauh daengz 1882 nienz");
        // NON-ASCENDING is left as the bare juxtaposition it was — a descending pair reads with a
        // different connective, so claiming it would be confidently wrong.
        expect(n("1832-1749")).toBe("1832-1749");
        // A hyphen CHAIN is an identifier, not a range: the pair must be the whole thing.
        expect(n("ISBN 3-7637-5988-3")).toBe("ISBN 3-7637-5988-3");
    });

    test("era markers — preposed `gunghyenz gonq`, spanned, and without eating a sentence period", () => {
        expect(n("259BC-210BC")).toBe("gunghyenz gonq 259 daengz gunghyenz gonq 210");
        expect(n("273 BC daengz 232BC")).toBe("gunghyenz gonq 273 daengz gunghyenz gonq 232");
        // ⚠ THE TRAILING DOT OF `B.C.` IS NOT CONSUMED — the corpus's one instance ends a sentence, and
        // swallowing that period would delete the pause.
        expect(n("Coengz 420 daengz 361 B.C.")).toBe("Coengz 420 daengz gunghyenz gonq 361.");
    });

    test("units postpose, longest key first, and a magnitude word may stand in between", () => {
        expect(n("dwg 41285 km², haeujvunz")).toBe("dwg 41285 bingzfueng goengleix, haeujvunz");
        expect(n("miz 810km2.")).toBe("miz 810 bingzfueng goengleix.");
        // ⚠ the decimal is left WRITTEN by the unit rule and spoken by step 10, which is the coupling
        // that keeps `1.4 ik km²` from being cut in half at its own point.
        expect(n("na cijbingz de 1.6km.")).toBe("na cijbingz de 1 6 goengleix.");
        // ⚠ THE MAGNITUDE ARM: `ik` is 10⁸ and stands between the number and its unit. Without it the unit
        // is orphaned and reaches the IPA raw.
        expect(n("dwg 1.4 ik km²")).toBe("dwg 1 4 ik bingzfueng goengleix");
        // ⚠ THE ONE-LETTER KEY, and the guards trap 46 says it needs. The corpus has no dotted designation,
        // so this arm is robustness for plausible input — and it is exactly the case that broke four
        // languages that declared `m` on a clean count.
        expect(n("dwg -422m,")).toBe("dwg -422 meix,");
        expect(n("802.11m")).toBe("802.11m");
        expect(n("meix")).toBe("meix"); // no bare-letter misfire without a digit
    });

    test("degrees are CONSUMED, not read — a silence replacing a wrong consonant", () => {
        // No Zhuang degree or scale word is attested; what this replaces is the scale letter reaching the
        // IPA as a bare [ɕ]. Recorded in ACCEPTED_SIGN_SILENCE.za.degrees.
        expect(n("gyang 35 °C daengz 39 °C")).toBe("gyang 35 daengz 39");
        expect(za.text("gyang 20 °C")).toBe(za.text("gyang 20"));
        expect(za.text("20℃")).toBe(za.text("20"));
    });

    test("the ampersand is `caeuq`, spaced on both sides", () => {
        // ⚠ SPACED DELIBERATELY: `A&B` deletes to `AB`, one token instead of two (traps 18/26), so the
        // replacement has to supply the boundary the sign was.
        expect(n("Baekging & Cukgiuz")).toBe("Baekging caeuq Cukgiuz");
        expect(n("Bd 1&2")).toBe("Bd 1 caeuq 2");
        // …and an HTML entity is stripped BEFORE the ampersand rule, or `&nbsp;` reads as "and n b s p".
        expect(n("108&nbsp;aen")).toBe("108 aen");
    });
});

describe("za normalization — the readings, through the phonemizer", () => {
    test("a percentage reads as one quantity with no sentence break inside it", () => {
        // Before this layer: `peːt ɕiːp θaːm . haː tɯk` — the decimal dot was a full stop and `%` silent.
        const ipa = za.text("Haeujvunz 83.5% dwg Bouxcuengh.");
        expect(ipa).toContain(za.text("bak faenh cih"));
        expect(ipa.slice(0, ipa.lastIndexOf("."))).not.toContain("."); // only the sentence period remains
    });

    test("a CJK full stop now produces the pause it always should have", () => {
        expect(za.text("ndeu。Gijgvangj dwg")).toContain(".");
        expect(za.text("Vahraeuz、Vahyaej")).toContain(",");
    });

    test("a Chinese gloss no longer emits a Zhuang syllable", () => {
        // `佈` resolved through the Sawndip dictionary to *boh* inside a Chinese gloss; 崇左市 resolved to
        // nothing at all. Both are wrong, and both are now simply absent.
        expect(za.text("Cungzcoj Si (Sawgun: 崇左市) dieg")).toBe(za.text("Cungzcoj Si dieg"));
        // ⚠ THE SAWNDIP FRONT-END IS UNAFFECTED — the pinned behaviour, re-asserted here because this
        // layer is the thing that could break it.
        expect(za.text("gou 佲")).toBe("koːuː˨˦ mɯŋ˨˦");
    });

    test("no unit or scale letter survives as its own token in the reading", () => {
        // ⚠ NOT A `[a-zA-Z]` TEST — this engine's IPA is full of ASCII letters (`k`, `p`, `m`, `l`), so
        // that assertion passes and fails for the wrong reasons. What the defect looked like was a raw
        // ABBREVIATION standing as a token of its own: `kʰm`, a bare `m`, a bare `ɕ` for the `C`.
        // ⚠ AND NOT `ŋeːiː˧` EITHER, tempting though it is as a proxy for the stray `2` of `km2`: it is
        // also the ordinary numeral TWO, which 41285 legitimately contains. The `kʰm` token is what
        // catches that case, and it catches it without a false positive.
        const raw = new Set(["kʰm", "m", "ɕ", "k"]);
        for (const s of ["dwg 41285 km²", "miz 810km2", "dwg -422m", "gyang 35 °C"]) {
            const last = za.text(s).split(" ").filter((t) => t !== "");
            expect(last.filter((t) => raw.has(t))).toEqual([]);
        }
    });

    test("⚠ ROMAN NUMERALS ARE RESOLVED UPSTREAM, and this pins the ORDER, not this layer", () => {
        // za is not in ROMAN_NATIVE, so registry.ts converts them before text() runs. The operand is a
        // vowel-less numeral that would be unreadable if the order were ever reversed.
        expect(za.text("Elizabeth II")).toBe(za.text("Elizabeth 2"));
        expect(za.text("baez XV")).toBe(za.text("baez 15"));
    });
});
