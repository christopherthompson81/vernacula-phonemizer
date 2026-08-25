import { describe, expect, test } from "vitest";

import { createIlocano, phonemizeWord, phonemizeWordRules } from "../src/languages/ilocano/ilocano.ts";
import { normalizeIlocano } from "../src/languages/ilocano/normalize.ts";

// Canonical-IPA goldens for Ilocano / Iloko (ilo) — Austronesian (Northern Luzon, NOT Bisayan), Latin. TWO paths:
// phonemizeWordRules = the non-circular RULE g2p (what the referee eval measures); phonemizeWord = the shipped
// path (a stress-marked-referee lexicon first, then the rule). The rule's Ilocano-distinctive HIATUS: a HIGH vowel
// ⟨i u⟩ before a vowel GLIDES (dua→dwa, radio→ɾadjo). Whether a high vowel glides vs stays syllabic is LEXICAL
// (garcia stays but radio glides — identical C-i-V, differ only in lexical stress); the lexicon carries that.
describe("Ilocano — the RULE g2p (phonemizeWordRules; the non-circular eval path)", () => {
    test("high-vowel GLIDING hiatus: i→j, u→w before a vowel (the split from Bisayan)", () => {
        expect(phonemizeWordRules("dua")).toBe("dwˈa"); // ⟨u⟩ before a → w
        expect(phonemizeWordRules("radio")).toBe("ɾˈadjo"); // ⟨i⟩ before o → j
        expect(phonemizeWordRules("dies")).toBe("djˈɛs"); // ⟨i⟩ before e → j; ⟨e⟩→ɛ
    });
    test("non-high hiatus keeps the glottal; word-initial glottal", () => {
        expect(phonemizeWordRules("tao")).toBe("tˈaʔo"); // a+o hiatus → glottal
        expect(phonemizeWordRules("naimbag")).toBe("naʔˈimbaɡ"); // a+i hiatus glottal
        expect(phonemizeWordRules("agtutubo")).toBe("ʔaɡtutˈubo"); // word-initial glottal
    });
});

describe("Ilocano — the shipped LEXICON path (phonemizeWord) fixes the lexical residual", () => {
    test("lexical gliding: the stressed high vowel STAYS syllabic (what the rule can't derive)", () => {
        expect(phonemizeWord("garcia")).toBe("ɡaɾsˈia"); // i STAYS (rule wrongly glides → ɡaɾkja)
        expect(phonemizeWord("kua")).toBe("kuˈa"); // u STAYS (rule → kwa)
        expect(phonemizeWord("biblioteka")).toBe("bibliotˈɛka"); // io STAYS (rule → bibljo…)
    });
    test("OOV falls back to the rule g2p", () => {
        expect(phonemizeWord("zzqx")).toBe(phonemizeWordRules("zzqx"));
    });
});

// Native Ilocano cardinal numbers (numbers.ts): composed MORPHOLOGICALLY — "sanga-" for a multiplier of 1
// (sangapulo, sangagasut, sangaribo, sangariwriw), a fused vowel-final digit (duapulo) vs. the "a" ligature after a
// consonant-final one (uppat a pulo), and the places chained by "ket". The NATIVE set, not the co-current Spanish
// loans (onse, beinte, mil), following the tagalog/cebuano precedent. Sources cited in ilocano.jsonc + numbers.ts.
describe("Ilocano cardinal numbers", () => {
    const ilo = createIlocano();
    const say = (n: number): string => ilo.text(String(n)).trim();

    test("units and the tens (fused vs. the 'a' ligature)", () => {
        expect(say(0)).toBe("sˈɛɾo"); // sero (Spanish loan; native "awan" is 'none', not a numeral)
        expect(say(5)).toBe("lˈima"); // lima
        expect(say(20)).toBe("dwapˈulo"); // duapulo — vowel-final dua FUSES (⟨u⟩ glides → dw)
        expect(say(40)).toBe("ʔˈuppat ʔˈa pˈulo"); // uppat a pulo — consonant-final → ligature
    });

    test("compounds 11-99 chain with ket", () => {
        expect(say(11)).toBe("saŋapˈulo kˈɛt mˈajsa"); // sangapulo ket maysa
        expect(say(25)).toBe("dwapˈulo kˈɛt lˈima"); // duapulo ket lima
        expect(say(99)).toBe("sjˈam ʔˈa pˈulo kˈɛt sjˈam"); // siam a pulo ket siam
    });

    test("hundreds / thousands / millions (sanga- for 1)", () => {
        expect(say(100)).toBe("saŋaɡˈasut"); // sangagasut
        expect(say(101)).toBe("saŋaɡˈasut kˈɛt mˈajsa"); // sangagasut ket maysa
        expect(say(555)).toBe("limaɡˈasut kˈɛt limapˈulo kˈɛt lˈima"); // limagasut ket limapulo ket lima
        expect(say(1000)).toBe("saŋaɾˈibo"); // sangaribo
        expect(say(1000000)).toBe("saŋaɾˈiwɾiw"); // sangariwriw
    });

    test("the native series tops out at riwriw → ≥10⁹ reads digit-by-digit", () => {
        expect(say(1000000000).split(" ")).toHaveLength(10); // maysa sero sero … (documented fallback)
    });
});

// ── TEXT NORMALIZATION (src/languages/ilocano/normalize.ts) ──────────────────────────────────────────────
// Evidence: the mined ilowiki artifact (tools/corpus/mined/ilo.jsonc, 38,673 paragraphs after
// filter-by-language.py --lang ilo), with attest.ts against ilo.wikipedia as the second tier. Counts are in
// normalize.ts beside each rule. ⚠ These pin the rule's BRANCHES, not the corpus's instances (trap 13) —
// several cases below are shapes the corpus does NOT contain, chosen for the branch it does not exercise.
describe("Ilocano text normalization", () => {
    const ilo = createIlocano();
    const say = (s: string): string => ilo.text(s).trim();

    // ⚠ A HANDFUL OF ASSERTIONS GO THROUGH `normalizeIlocano` DIRECTLY, because what they pin is the
    // TEXT→TEXT step and not the reading: an ordering coupling is invisible once the numbers are IPA.
    test("the numbered order is load-bearing — pinned as text, where the coupling is visible", () => {
        // ⚠ RANGES ABOVE DECIMALS. With the decimal rule first this reads `3 punto 5–3 punto 8`, and the
        // range rule then claims `5–3` — a backwards span from inside a number (the hil finding).
        expect(normalizeIlocano("3.5–3.8 bilion")).toBe("3 punto 5 aginggana iti 3 punto 8 bilion");
        // ⚠ DE-GROUPING FIRST, or the tier sees `578 km²` in `676,578 km²` and the range rule can match a
        // grouping comma.
        expect(normalizeIlocano("Iti 676,578 km²")).toBe("Iti 676578 kuadrado kilometro");
        // ⚠ THE TIER ABOVE THE DECIMAL RULE is what keeps `NOT_VERSION` armed for the one-letter `m` key
        // (traps 39 and 46): the guard rejects a dotted designation by SEEING THE DOT, which step 5 spends.
        // `802.11m` must therefore NOT become eleven metres, while `12.5 km` must still read.
        expect(normalizeIlocano("ti 12.5 km ken 802.11m")).toBe("ti 12 punto 5 kilometro ken 802 punto 1 1m");
    });

    test("de-grouping and the decimal point — the two rules that carry ~3,760 instances", () => {
        // ×2,272 comma-grouped. The comma was clause punctuation, so the value read as two numbers.
        expect(say("populasion iti 822,352")).toBe(
            "populˈasjon ʔˈiti waloɡˈasut kˈɛt dwapˈulo kˈɛt dwˈa ʔˈa ɾˈibo kˈɛt talloɡˈasut kˈɛt limapˈulo kˈɛt dwˈa");
        // ×1,492. `punto` is attested IN THE SLOT — `ti pateg ti HDI iti maikanem a desimal a punto`.
        expect(say("May 302.18 kilometro")).toBe(
            "mˈaj talloɡˈasut kˈɛt dwˈa pˈunto mˈajsa wˈalo kilomˈɛtɾo");
        // Both at once, in that order: the de-grouping guard must let a group through when its decimal
        // point follows (`1,497.70 kuadrado kilometro` is the corpus's own shape).
        expect(say("1,497.70 kuadrado kilometro")).toBe(
            "saŋaɾˈibo kˈɛt ʔˈuppat ʔˈa ɡasˈut kˈɛt sjˈam ʔˈa pˈulo kˈɛt pˈito pˈunto pˈito sˈɛɾo kwadɾˈado kilomˈɛtɾo");
        // ⚠ THE DIGIT-LIST MUST SURVIVE. `aggibus iti 0,1,8,9` is a phone-prefix list with ONE digit per
        // group; the `{3}` in the de-grouping rule is what refuses it. Pinned so a widening cannot pass.
        expect(say("aggibus iti 0,1,8,9")).toBe("ʔaɡɡˈibus ʔˈiti sˈɛɾo , mˈajsa , wˈalo , sjˈam");
        // ⚠ AND THE THREE-DIGIT FRACTIONAL PART IS NOT CLAIMED — the two-digit cap, pinned from the
        // opposite side, so a later widening of the decimal rule cannot silently claim a thousands group.
        expect(say("17.865")).not.toContain("pˈunto");
    });

    test("⚠ THE CLOCK'S GUARD IS THE RULE — 205 colon-numbers, ~23 clocks", () => {
        // Arm (a): a following AM/PM/GMT/UTC. ×15. The colon was a pause plus a phantom *sero*.
        expect(say("manipud iti 6:00 AM")).toBe("manˈipud ʔˈiti ʔinnˈɛm ʔˈam");
        // Arm (b): a following part-of-day. ×4. Minutes join with the manifest's own connector `ket`.
        expect(say("iti 8:16 ti agsapa")).toBe("ʔˈiti wˈalo kˈɛt saŋapˈulo kˈɛt ʔinnˈɛm tˈi ʔaɡsˈapa");
        // Arm (c): a preceding `oras a`. ×4.
        expect(say("iti oras a 6:30 aginggana")).toBe("ʔˈiti ʔˈoɾas ʔˈa ʔinnˈɛm kˈɛt tallopˈulo ʔaɡiŋɡˈana");
        // ⚠ THE 182 NON-CLOCKS, one per class, and this is why ceb's bare-colon rule was not copied:
        // a UTC OFFSET (×103) — the leading-sign guard is what refuses it,
        expect(say("Ti UTC+08:00 ket")).not.toContain("kˈɛt wˈalo kˈɛt");
        expect(say("Ti UTC+08:00 ket")).toBe("tˈi ʔˈutk wˈalo , sˈɛɾo kˈɛt");
        // a SCRIPTURE REFERENCE (×26),
        expect(say("naibasar iti Juan 13:21")).toBe(
            "naʔibˈasaɾ ʔˈiti hwˈan saŋapˈulo kˈɛt tˈallo , dwapˈulo kˈɛt mˈajsa");
        // and a RATIO (flag proportions).
        expect(say("ti ratio ket 5:8")).toBe("tˈi ɾˈatjo kˈɛt lˈima , wˈalo");
    });

    test("percent, and the currencies — including the two spellings that had to be measured", () => {
        // `porsiento` ×120 (×58 digit-adjacent). NOT ceb's `porsyento`/hil's `porsiyento`, both ×0 here.
        expect(say("mangbukel iti 11.60%")).toBe(
            "maŋbˈukɛl ʔˈiti saŋapˈulo kˈɛt mˈajsa pˈunto ʔinnˈɛm sˈɛɾo poɾsjˈɛnto");
        // ⚠ `doliar` ×26 — NOT `dolyar`/`dolar` (×0) and NOT `dollar`, whose 3 wiki hits are all the film
        // *Million Dollar Baby*. The compound `US$` key carries the corpus's own definitional phrase.
        expect(say("nalako iti US$53.9 milion")).toBe(
            "nalˈako ʔˈiti limapˈulo kˈɛt tˈallo pˈunto sjˈam mˈiljon dˈoljaɾ tˈi ʔɛstˈados ʔunˈidos");
        // ⚠ `pisos`, not `piso` — `piso` is attested ×3 and every hit is the botanist Willem Piso or a
        // Tagalog story title, while all 7 `pisos` are money in an amount.
        expect(say("bayad iti ₱50")).toBe("bˈajad ʔˈiti limapˈulo pˈisos");
        expect(say("ngem €890 bilion")).toBe("ŋˈɛm waloɡˈasut kˈɛt sjˈam ʔˈa pˈulo bˈiljon ʔɛʔˈuɾo");
        // ⚠ `£` rests on ONE attestation of the COLLOCATION; bare `libra` is 3-of-4 the unit of weight.
        expect(say("tangdan a £200")).toBe("tˈaŋdan ʔˈa dwaɡˈasut lˈibɾa ʔɛstɛɾlˈina");
    });

    test("⚠ THE MEASURE WORD GOES BEFORE ITS NOUN — where ceb and hil are wrong for Ilocano", () => {
        // ilo.wikipedia's km² article is metalinguistic about it: *Ti "km²" ket kayatna a sawen kuadrado
        // kilometro, saan a kilometro kuadrado.* The corpus agrees 39:10, and the cube word 15:1.
        expect(say("iti lugar ti 636 km²")).toBe(
            "ʔˈiti lˈuɡaɾ tˈi ʔinnˈɛm ʔˈa ɡasˈut kˈɛt tallopˈulo kˈɛt ʔinnˈɛm kwadɾˈado kilomˈɛtɾo");
        // The CUBE branch, which the corpus writes spelled-out and which the symbol path must also reach.
        expect(say("1,000 kubiko metro")).toBe("saŋaɾˈibo kubˈiko mˈɛtɾo");
    });

    test("units, rates and the ampersand", () => {
        expect(say("adda ti 250 ml ken 3 mi ken 5 kg ken 100 mm ken 20 cm")).toBe(
            "addˈa tˈi dwaɡˈasut kˈɛt limapˈulo mililˈitɾo kˈɛn tˈallo mˈilja kˈɛn lˈima kiloɡɾˈamo "
            + "kˈɛn saŋaɡˈasut milimˈɛtɾo kˈɛn dwapˈulo sɛntimˈɛtɾo");
        // ⚠ `ft` → `pie` is trap 40 a second time: `piye` and `talampakan` are ×0, and the corpus's foot
        // word is the Spanish spelling, ×26 and digit-adjacent in the gloss beside a metric figure.
        expect(say("20,320 pié ken 35,797 ft")).toContain("pjˈɛ kˈɛn");
        // `mph` is its own KEY, not the composition of its parts (trap 44) — there is no `p` denominator.
        expect(say("5 km/s ken 60 mph")).toBe(
            "lˈima kilomˈɛtɾo kˈada sɛɡˈundo kˈɛn ʔinnˈɛm ʔˈa pˈulo mˈilja kˈada ʔˈoɾas");
        // ⚠ Spaced on both sides, so `AT&T` stays three tokens (trap 18) rather than fusing.
        expect(say("Luna & Balaoan")).toBe("lˈuna kˈɛn balaʔˈoʔan");
    });

    test("⚠ A UNIT IN THE `per` SLOT HAS NO NUMBER BESIDE IT — the tier cannot reach it, ×133", () => {
        // The population-density template: the numeral belongs to `tattao`, and `km²` sits after the
        // per-phrase with nothing numeric adjacent, so all 133 reached the IPA as a raw `km`.
        expect(say("12.70 a tattao tunggal maysa a km²")).toBe(
            "saŋapˈulo kˈɛt dwˈa pˈunto pˈito sˈɛɾo ʔˈa tattˈaʔo tˈuŋɡal mˈajsa ʔˈa kwadɾˈado kilomˈɛtɾo");
        // ⚠ AND THE SPELLED-OUT FORM MUST NOT BE DOUBLED — the corpus writes both.
        expect(say("iti tunggal kuadrado kilometro")).toBe("ʔˈiti tˈuŋɡal kwadɾˈado kilomˈɛtɾo");
    });

    test("⚠ WHAT BARE `m` COSTS, AND THE FOUR INSTANCES THAT PAY IT (trap 28's arithmetic)", () => {
        // Bare `m` is ×300 digit-adjacent and 296 are genuine metres; the other four are the astronomical
        // / UTC-offset notation where `m` is a MINUTE. Step 2b claims that shape first, so it reads rather
        // than being silently mis-measured. All four of the corpus's `\dh` occurrences take this shape.
        expect(say("panagpangato a 12 h 49 m")).toBe(
            "panaɡpaŋˈato ʔˈa saŋapˈulo kˈɛt dwˈa ʔˈoɾas ʔˈuppat ʔˈa pˈulo kˈɛt sjˈam minˈuto");
        // …and an ordinary height must still be metres.
        expect(say("agsobra nga 3.7 m")).toContain("mˈɛtɾo");
    });

    test("ranges read `aginggana iti`, and the connective is not doubled", () => {
        // ×1,842 unwritten dashes; the word is written out BETWEEN DIGITS ×220 (`15 aginggana iti 64`).
        // ⚠ NOT ceb's `ngadto sa` and NOT hil's `hasta` — both ×0 in Ilocano. Third language, third word.
        expect(say("Dagiti 40-45 a rancheria")).toBe(
            "daɡˈiti ʔˈuppat ʔˈa pˈulo ʔaɡiŋɡˈana ʔˈiti ʔˈuppat ʔˈa pˈulo kˈɛt lˈima ʔˈa ɾankhˈɛɾja");
        // The guard the su/so/ceb/hil runs paid for: do not double a connective the text already wrote.
        expect(say("manipud 15 aginggana iti 64")).toBe(
            "manˈipud saŋapˈulo kˈɛt lˈima ʔaɡiŋɡˈana ʔˈiti ʔinnˈɛm ʔˈa pˈulo kˈɛt ʔˈuppat");
        // ⚠ THE ORDERING BRANCH (trap 13): ranges run ABOVE the decimal rule so the operands are still
        // whole. Reversed, `0.25–0.33` would read `25 aginggana iti 0` — a backwards span inside a number.
        expect(say("0.25–0.33 pulgada")).toBe(
            "sˈɛɾo pˈunto dwˈa lˈima ʔaɡiŋɡˈana ʔˈiti sˈɛɾo pˈunto tˈallo tˈallo pulɡˈada");
        // ⚠ AND IT MUST NOT CLAIM THE ORDINAL PREFIX, whose hyphen has a LETTER on its left. `maika-N`
        // already reads correctly (×4,561 with a digit) and is deliberately untouched — trap 16.
        expect(say("idi maika-19 a siglo")).toBe("ʔˈidi maʔˈika saŋapˈulo kˈɛt sjˈam ʔˈa sˈiɡlo");
    });

    test("degrees — one word serves the coordinate and the two scales", () => {
        // ×954 digit-adjacent `°`; the sign was dropped and the scale letter read as a bare consonant.
        // ⚠ THE SIGN IS NOW READ TOO, and this expectation used to PIN THE DEFECT: both rows are the same
        // corpus sentence, and the U+2212 in front of them was silent, so `−224 °C` read as +224 °C — a
        // temperature wrong by 448 degrees. See step 1b for the word and the caveat on it.
        expect(say("temperatura ti −224 °C")).toBe(
            "tɛmpɛɾatˈuɾa tˈi nɛɡatˈibo dwaɡˈasut kˈɛt dwapˈulo kˈɛt ʔˈuppat ɡɾˈado kˈɛlsjus");
        expect(say("−129 °F")).toBe("nɛɡatˈibo saŋaɡˈasut kˈɛt dwapˈulo kˈɛt sjˈam ɡɾˈado pahɾɛnhˈɛʔit");
        // ⚠ THE BARE ARM IS THE BIG ONE — coordinates and angles are ×871 of the ×954, and a coordinate IS
        // degrees, so no second reading has to be sourced.
        expect(say("iti 16°Am 26'")).toBe(
            "ʔˈiti saŋapˈulo kˈɛt ʔinnˈɛm ɡɾˈado ʔˈam dwapˈulo kˈɛt ʔinnˈɛm ʔ");
        expect(say("ti 47.8°")).toBe("tˈi ʔˈuppat ʔˈa pˈulo kˈɛt pˈito pˈunto wˈalo ɡɾˈado");
    });

    test("dotted abbreviations, and `c.` before a year", () => {
        // ⚠ `Blng.` ×220 is Ilocano's own contraction of `bilang` and has NO VOWEL, so it reached the IPA
        // as the cluster [blŋ]. No other gate in this repo can see that — it is Latin letters in a
        // Latin-script language, which is what `mine.ts scan`'s RAW-LATIN class was added for.
        expect(say("Bilin Blng. 1")).toBe("bˈilin bˈilaŋ mˈajsa");
        expect(say("Dr. Jose Rizal ken Ramon Mitra, Sr.")).toBe(
            "dˈoktoɾ hˈosɛ ɾˈisal kˈɛn ɾˈamon mˈitɾa , sˈɛnjoɾ");
        // ×157. Unhandled this is two defects: a clause break mid-date and a bare [k]. `agarup` ×2,286 is
        // the corpus's own word in the same function.
        expect(say("ni Theophrastus (c. 371 BC)")).toContain("ʔaɡˈaɾup ʔˈa talloɡˈasut");
        // ⚠ A FOLLOWING DIGIT IS REQUIRED — this corpus has 2,442 lone `X.` personal initials, and an
        // unguarded `c\.` would read every `C.` in an author list as "approximately".
        expect(say("Mathew, S. P. and C. R. Chitra")).toBe(
            "mˈathɛw , s . p . ʔˈand k . ɾ . khˈitɾa");
    });

    test("⚠ THE SOURCED REFUSALS — these stay silent on purpose (see defects.ts)", () => {
        // FRACTIONS: ×54, and no denominator series exists to compose from (`apagkatlo` ×6, `apagkapat`
        // ×1, and nothing else). `kagudua` ("half") ×176 is sourced and waiting.
        expect(say("iti 3/4 ti kalawa")).toBe("ʔˈiti tˈallo ʔˈuppat tˈi kalˈawa");
        // THE MAGNITUDE-PLUS-EXPONENT RESIDUAL, ×8 and stated rather than hidden: the plain unit composes
        // across a magnitude (`3 a bilion km` → kilometro) but the EXPONENT branch does not, so the
        // squared form still leaks. That is a shared-tier limit, not an Ilocano one, and core is the
        // reviewer's call — recorded here so the count is re-checkable in one command.
        expect(say("ti kaadayuna 3 a bilion km")).toContain("bˈiljon kilomˈɛtɾo");
    });
});
