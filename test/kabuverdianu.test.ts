import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { createKabuverdianu, phonemizeWord } from "../src/languages/kabuverdianu/kabuverdianu.ts";
import { numberToWords } from "../src/languages/kabuverdianu/numbers.ts";
import { normalizeKabuverdianu } from "../src/languages/kabuverdianu/normalize.ts";

// Kabuverdianu / kriolu (kea) — Cape Verdean Creole (Portuguese-lexified, ~870k), the ALUPEC/AK phonemic orthography,
// Santiago variety. No machine referee exists (wikipron has no
// kea; the kaikki dump carries IPA on only 7 words), so this is an AUTHORED bring-up (the Madurese/Luo pattern): a
// greedy ALUPEC scan (digraphs dj/tx/nh/lh/rr) + Portuguese-creole nasalization + accent/penult stress, ANCHORED on
// the 7 independent kaikki IPA words (this file is the falsifiable gold). Segments match all 7 (the kaikki's onset-ˈ
// notation and its loose ⟨r⟩~ɾ differ from our nucleus-ˈ + tap [ɾ] conventions). ⚠ Seven words is the whole
// of the independent evidence — thin, and single-source.
describe("Kabuverdianu canonical IPA — ALUPEC g2p + nasalization (anchored on the 7 kaikki words)", () => {
    const kea = createKabuverdianu();

    test("the 7 kaikki IPA anchor words (segments verified; ˈ at the nucleus per fleet convention)", () => {
        expect(phonemizeWord("kobra")).toBe("kˈobɾɐ"); // kaikki [ˈko.brɐ] — ⟨o⟩ close [o], single ⟨r⟩=[ɾ]
        expect(phonemizeWord("kóbra")).toBe("kˈɔbɾɐ"); // kaikki [ˈkɔ.brɐ] — ⟨ó⟩ open [ɔ]
        expect(phonemizeWord("diskabresta")).toBe("diskɐbɾˈestɐ"); // kaikki /diskɐˈbɾestɐ/ — penult stress
        expect(phonemizeWord("barkinu")).toBe("bɐɾkˈinu"); // kaikki /bɐɾˈkinu/
        expect(phonemizeWord("tabanka")).toBe("tɐbˈãŋkɐ"); // kaikki [tɐˈbãŋkɐ] — an→ãŋ (nasal [ã] + velar ŋ)
        expect(phonemizeWord("talóti")).toBe("tɐlˈɔti"); // kaikki [tɐˈlɔti] — ⟨ó⟩ accent → stress
        expect(phonemizeWord("sénpri")).toBe("sˈɛ̃pɾi"); // kaikki [ˈsɛ̃pɾi] — én→ɛ̃ (nasal, n absorbed before p)
    });

    test("ALUPEC digraphs: ⟨dj⟩→d͡ʒ, ⟨tx⟩→t͡ʃ, ⟨nh⟩→ɲ, ⟨lh⟩→ʎ; ⟨x⟩→ʃ, ⟨j⟩→ʒ", () => {
        expect(phonemizeWord("fidju")).toBe("fˈid͡ʒu"); // ⟨dj⟩ → d͡ʒ ("son")
        expect(phonemizeWord("txeu")).toBe("t͡ʃˈeu"); // ⟨tx⟩ → t͡ʃ ("much")
        expect(phonemizeWord("nha")).toBe("ɲˈɐ"); // ⟨nh⟩ → ɲ ("my")
        expect(phonemizeWord("palha")).toBe("pˈɐʎɐ"); // ⟨lh⟩ → ʎ
        expect(phonemizeWord("xinti")).toBe("ʃˈĩti"); // ⟨x⟩ → ʃ, ⟨in⟩ → ĩ nasal
    });

    test("nasalization: a coda ⟨n/m⟩ nasalizes the vowel (bon→bõ, un→ũ) and is absorbed word-finally", () => {
        expect(phonemizeWord("bon")).toBe("bˈõ"); // "good" — ⟨on⟩ → õ (n absorbed)
        expect(phonemizeWord("un")).toBe("ˈũ"); // "one/a" — ⟨un⟩ → ũ
    });

    test("stress: OXYTONE when a word ends in a consonant (Ibero default); penult when it ends in a vowel/-s", () => {
        expect(phonemizeWord("mudjer")).toBe("mud͡ʒˈeɾ"); // "woman" — consonant-final → final stress
        expect(phonemizeWord("amor")).toBe("ɐmˈoɾ"); // "love" — oxytone
        expect(phonemizeWord("algen")).toBe("ɐlɡˈẽ"); // "someone" — final stress on the nasal ẽ
        expect(phonemizeWord("mininu")).toBe("minˈinu"); // vowel-final → penult
    });

    test("falling diphthongs (oi/ou…): the offglide is not a stress-bearing nucleus", () => {
        expect(phonemizeWord("oitu")).toBe("ˈoitu"); // "eight" — stress on o, ⟨i⟩ offglide (not oˈitu)
        expect(phonemizeWord("noiti")).toBe("nˈoiti"); // "night"
    });

    test("clause assembly", () => {
        expect(kea.text("Bon dia, Kabu Verdi!").trim()).toBe("bˈõ dˈiɐ , kˈɐbu vˈeɾdi !");
    });

    // NUMBERS — Santiago/Badiu ALUPEC. Fully decimal; the tens JUXTAPOSE with their unit (the sources write the
    // link as a hyphen: vinti-un, sunkuénti-sax) so there is no ⟨i⟩ connector word; 16–19 are the analytic
    // Portuguese-style ⟨diza-⟩ series. Source: Wiktionary kea cardinals + omniglot (kabuverdianu.jsonc).
    test("numbers: units, the juxtaposed tens, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("seti");
        expect(numberToWords(16)).toBe("dizasais"); // the ⟨diza-⟩ series (Pt dezasseis, not Es dieciséis)
        expect(numberToWords(21)).toBe("vinti un"); // juxtaposed — no connector
        expect(numberToWords(31)).toBe("trinta un");
        expect(numberToWords(100)).toBe("sen");
        expect(numberToWords(555)).toBe("kinhentus sinkuenta sinku");
        expect(numberToWords(12345)).toBe("duzi mil trezentus korenta sinku");
        expect(numberToWords(1000000)).toBe("un milion");
        expect(numberToWords(1000000000)).toBe("mil milion"); // Pt-style "mil milhões"
    });

    test("numbers read through the g2p (nasalization + accent-or-penult stress)", () => {
        expect(kea.text("21").trim()).toBe("vˈĩti ˈũ"); // coda ⟨n⟩ nasalizes and is absorbed
        expect(kea.text("100").trim()).toBe("sˈẽ"); // sen
        expect(kea.text("0").trim()).toBe("zˈɛɾu"); // zéru — the acute marks the OPEN ⟨é⟩ [ɛ] + stress
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// TEXT NORMALIZATION — src/languages/kabuverdianu/normalize.ts.
//
// Every test below encodes a FINDING measured over the 1,931 unique utterances of FLEURS kea_cv (3,945
// rows; FLEURS repeats each sentence per speaker). There is no mined artifact for kea and no Kabuverdianu
// Wikipedia, so the corpus is the whole haystack — see
// docs/investigations/kea_normalization_investigation.md.
//
// ⚠ ASSERTED THROUGH `phonemize`, NOT THROUGH `normalizeKabuverdianu`, wherever an upstream pre-pass is
// part of the story: the vulgar-fraction fold in core/unicode.ts runs at the registry dispatch point, so a
// test that called the local function directly would pass over a rule that is dead in the real pipeline.
describe("Kabuverdianu text normalization", () => {
    const say = (s: string): string => phonemize(s, "kea").trim();

    test("the grouping DOT was read as a FULL STOP — the defect that motivates the layer, invisible to DROP", () => {
        // `1.000 libras` read as *ˈũ . zˈɛɾu lˈibɾɐs* — "one, zero pounds": the group's zeros go through the
        // number path as `000` and the dot becomes a clause break. 43 grouped dots in the corpus.
        expect(say("Kes satélitis ta peza más di 1.000 libras")).toContain("mˈil lˈibɾɐs");
        expect(say("ta okupa 783.562 kilómitrus"))
            .toContain("setisˈẽtus oitˈẽtɐ tɾˈes mˈil kiɲˈẽtus sɐsˈẽtɐ dˈos");
        // ⚠ THREE GROUPS AT ONCE (trap 63) — the per-join idiom re-anchors inside the remainder.
        expect(say("atrai 5.000.000 vizitantis")).toContain("sˈĩŋku miliˈõ");
    });

    test("BOTH marks group and BOTH decimate — the Papiamento finding reproduces, with the dominance inverted", () => {
        // pap resolved this with the three-digit test applied symmetrically; kea needs the same test for the
        // same reason, but here the split is not per-orthography — the American convention arrives on
        // figures carried untranslated from the shared FLEURS source set.
        expect(say("Ku 17,000 ilhas pa skodje")).toContain("dizɐsˈeti mˈil ˈiʎɐs"); // comma GROUPS
        expect(say("kintu y sestu ku 2,220 y 2,207 pontus")).toContain("dˈos mˈil duzˈẽtus vˈĩti");
        expect(say("un populason di serka di 3,7 milhon")).toContain("tɾˈes sˈeti miʎˈõ"); // comma DECIMATES
        expect(say("na frikuénsia di 2.4Ghz")).toContain("dˈos kuˈɐtu"); // dot DECIMATES
    });

    test("⚠ THE PRICE OF THE SYMMETRIC TEST, PINNED: the one three-digit DECIMAL comma is read as a group", () => {
        // `un staka di serka di 30 pes (9,114 m)` is 30 feet = 9.144 m. The symmetric test buys three correct
        // groupings for this one wrong decimal, which is why it ships — but the cost is real and is pinned so
        // that a future round changing the rule sees what it is trading away.
        expect(say("un staka di serka di 30 pes (9,114 m)")).toContain("nˈovi mˈil sˈẽ kɐtˈoɾzi mˈɛtɾu");
    });

    test("no decimal WORD is sourceable, so the mark is SPENT ON A SPACE rather than spoken", () => {
        // `vírgula` ×0; `pontu` ×11 is a point of view, a sports point, or the full stop of a sentence
        // (`pontu final des frazi`) — never the separator. ⚠ DIVERGENCE FROM THE LEXIFIER: Portuguese reads
        // `14,7` as *catorze VÍRGULA sete* through its own number tokenizer. Kabuverdianu has neither the
        // tokenizer support nor the word.
        expect(say("14,7 mil milhon di dóla")).toBe("kɐtˈoɾzi sˈeti mˈil miʎˈõ dˈi dˈɔlɐ");
        expect(say("14,7 mil milhon di dóla")).not.toContain(",");
    });

    test("the percent word is `pur sentu` — ×13 in the corpus, 8 of them digit-adjacent", () => {
        expect(say("subi 8% konparadu ku 2008")).toContain("ˈoitu pˈuɾ sˈẽtu");
        // the writer's own spelled-out form, which is what sources the sign's reading
        expect(say("34 pur sentu di partisipantis")).toContain("tɾˈĩtɐ kuˈɐtu pˈuɾ sˈẽtu");
    });

    test("⚠ `AUD$` NEEDS ITS OWN KEY (trap 64) — the bare `$` cannot match a composite mark", () => {
        // `na dá más di AUD$45 milhon`. The tier's left-hand letter guard, correctly there to keep a bare `$`
        // out of an identifier, declines every code-prefixed sign — and the failure is SILENCE: the sentence
        // simply loses its currency noun and no leak class sees it.
        expect(say("na dá más di AUD$45 milhon")).toContain("koɾˈẽtɐ sˈĩŋku miʎˈõ dˈi dˈɔlɐ");
        expect(say("nota Kanadianu di $5 y $100")).toContain("sˈĩŋku dˈɔlɐ");
        // `libra` ×2 is the CURRENCY (`un libra Britániku (GBP)`); `libras` ×5 is the pound WEIGHT.
        expect(say("pa un taxa di £27 milhon")).toContain("vˈĩti sˈeti miʎˈõ dˈi lˈibɾɐ");
    });

    test("⚠ DIVERGENCE FROM PAPIAMENTO: the colon is a CLOCK here, 17 of 20, and pap has no clock rule", () => {
        // pap's only digit-colon is the Curaçao flag's stripe ratio `5:1:2`, so a clock rule there would have
        // read a flag as a time (trap 9). kea inverts it: `11:20`, `9:30 óra lokal`, `06:30 y 07:30`,
        // `07:19 ora lokal (21:19 GMT)` — and every one of them broke its own sentence, because
        // kabuverdianu.jsonc maps `:` → `,`.
        expect(say("JAS 39C Gripen kai pur volta di 9:30 óra lokal")).toContain("nˈovi tɾˈĩtɐ ˈɔɾɐ lokˈɐl");
        expect(say("ta sai entri 06:30 y 07:30")).toContain("sˈɐis tɾˈĩtɐ ˈi sˈeti tɾˈĩtɐ");
        // ⚠ THE TWO-DIGIT MINUTE IS THE WHOLE GUARD and it needs no special case: both non-clocks have a
        // one-digit right operand — a British degree classification and a ratio.
        expect(say("el konsigi un 2:2")).toContain("dˈos , dˈos");
        expect(say("rifiridu komu 3:2.")).toContain("tɾˈes , dˈos");
    });

    test("⚠ TRAP 58, ON THE CLOCK: the fleet-standard trailing guard declines the corpus's FIRST clock", () => {
        // `(?![\d:.,])` rejects `11:20,` — an utterance-initial clock followed by a clause comma. What has to
        // be excluded is a THIRD field continuing the time, not a clause mark.
        expect(say("11:20, pulísia pidi manifestantis")).toContain("ˈõzi vˈĩti , pulˈisiɐ");
    });

    test("⚠ `º` U+00BA IS THE ORDINAL INDICATOR HERE — the opposite of the Aragonese/Asturian finding", () => {
        // an and ast found `º` standing in for the degree sign. Of kea's 9 `º`, seven are the genuine
        // masculine ordinal and exactly one is a temperature. Before this, `1º dia di mês` read *ˈũ dˈiɐ* —
        // "one day" — a plausible READING, which trap 56 ranks worse than garbage and no counter sees.
        expect(say("dispunivel na 1º dia di mês")).toContain("pɾimˈɛɾu dˈiɐ");
        expect(say("tinha 1º y 3º rijimentus")).toContain("pɾimˈɛɾu ˈi teɾsˈeɾu ɾiʒimˈẽtus");
        // …and the one that is a temperature is also the one NOT followed by a letter.
        expect(say("ku tenperatura na 90º.")).toContain("novˈẽtɐ ɡɾˈɐu");
    });

    test("⚠ THE ORDINAL REFUSALS, PINNED, because both leave the text exactly as it read before", () => {
        // Above 10 the series would need `trijésimu` / `sesajésimu` / `milésimu`, all ×0 — refused WHOLE
        // (trap 53's ak case), so the indicator stays silent rather than becoming a confidently wrong degree.
        expect(say("ta faze del 37º país más grandi")).toContain("tɾˈĩtɐ sˈeti pɐˈis");
        expect(say("ta faze del 37º país más grandi")).not.toContain("ɡɾˈɐu");
        expect(say("Se 1.000º selu foi magnífiku")).toContain("mˈil sˈelu");
        // ⚠ AND THE FEMININE IS A SEPARATE REFUSAL, not a creole-invariance claim: kea DOES inflect the low
        // ordinals (`Priméra Géra` ×6, `Sigunda Géra` ×8, `Terséra Klasi` ×1). But the corpus's two `ª` are
        // `7ª` and `5ª`, and `sétima`/`kinta` are ×0.
        expect(say("ta tornai Japon 7ª maior ilha")).toContain("sˈeti mɐiˈoɾ ˈiʎɐ");
    });

    test("the degree word is `grau`, and BOTH the scale letter and the compass letter are deliberately left", () => {
        // `grau` ×4, licensed by its two in-slot senses — `alguns grau a norti di ekuador` (latitude) and
        // `na 90(F)-grau di kalor` (temperature). `Celsius` ×0, `Fahrenheit` ×0, and kea west is `oesti` ×7
        // with the corpus never writing `W` for it, so a Hawaiian-style compass arm would assert an
        // abbreviation the language does not use (the Aragonese `ueste` case, trap 55).
        expect(say("tenperaturas riba di +30°C é kumun")).toContain("tɾˈĩtɐ ɡɾˈɐu");
        expect(say("gravadu na lesti di 35°W.")).toContain("tɾˈĩtɐ sˈĩŋku ɡɾˈɐu");
    });

    test("the era marker, composed from attested pieces, and `E.D.C.` deliberately untouched", () => {
        // `antis` ×49 and `dipôs` ×109 both take `di` + a noun in this corpus; `Kristu` ×1. The phrase itself
        // is not attested and is sourced arithmetic, not invention (the Fula `e teemedere` move).
        expect(say("kel ténplu rikonstruidu na 323 a.C.")).toContain("ˈãtis dˈi kɾˈistu");
        expect(say("kumesa na serka di 400 D.C. y dura")).toContain("dipˈos dˈi kɾˈistu");
        // ⚠ THE LEFT GUARD EXCLUDES A PRECEDING DOT, so this is left WHOLE rather than half-claimed as
        // "E. dipôs di Kristu" (trap 10) — no reading for `E.D.C.` is established.
        expect(say("ki txiga pur volta di 10.000 E.D.C.")).not.toContain("kɾˈistu");
    });

    test("units read through the shared tier, and the incomplete table is the point", () => {
        expect(say("Krosta ten serka di 70 km di grosura")).toContain("setˈẽtɐ kilˈɔmitɾu");
        expect(say("un piku di 4892 m na Monti Vinson")).toContain("mˈɛtɾu");
        expect(say("stima ma 6 sentímitru")).toContain("sˈɐis");
        expect(say("Kel parki ten 19.500 km²"))
            .toContain("dizɐnˈovi mˈil kiɲˈẽtus kilˈɔmitɾu kuɐdɾˈɐdu");
        expect(say("ten bentu di ti 480 km/h (133 m/s; 300 mph)"))
            .toContain("kuˈɐtusẽtus oitˈẽtɐ kilˈɔmitɾu pˈɐ ˈɔɾɐ");
        // ⚠ `mm` ×26 AND `kg` ×8 ARE REFUSED and this pins the refusal: `milímitru`, `kilograma`, `kilu` and
        // `quilo` are ×0 and there is no second source to ask (no kea.wikipedia, no espeak kea_list). The
        // corpus DOES attest the `-mitru` stem twice, so `milímitru` is a compositional near-certainty and is
        // still a word nobody has written. Undeclared is NEUTRAL — the abbreviation reads as it did before.
        expect(say("Kel formatu 35mm é meiu konfuzu")).toContain("tɾˈĩtɐ sˈĩŋku mm");
        expect(say("un pesoa ki ta peza 200 libras (90kg)")).toContain("novˈẽtɐ kɡ");
    });

    test("⚠ DIVERGENCE: the range mark is the ASCII hyphen and a DOUBLED one, never an en dash", () => {
        // `–` ×1 and `—` ×6 in this corpus are every time PARENTHETICAL (`penas — farpas y bárbula —`), so a
        // ported pap/haw en-dash arm matches nothing; the range marks are `-` ×14 and `--` ×4, and the
        // doubled form is what a ported rule would miss. The dash is spent on a PAUSE because kea writes the
        // span in full where it means it (`entri 06:30 y 07:30`, `100 a 250 métrus`, `3 a 5 pur sentu`).
        expect(say("kubertu pa 2-3 km di jélu")).toContain("dˈos , tɾˈes kilˈɔmitɾu");
        expect(say("Kel Luno tinha 120--160 métrus kúbikus")).toContain("sˈẽ vˈĩti , sˈẽ sɐsˈẽtɐ mˈɛtɾus");
        // trap 58: nothing may be required after the second number.
        expect(say("bai ku sonu poku ténpu dipôs (10-60 minotu).")).toContain("dˈɛs , sɐsˈẽtɐ minˈotu");
    });

    test("⚠ THE VULGAR FRACTION IS FOLDED UPSTREAM, so the rule is written on the ASCII shape (trap 39)", () => {
        // core/unicode.ts folds `¾` → ` 3/4` at the registry dispatch point, BEFORE any engine's text(). A
        // local `(\d)\s?¾` arm here would type-check, pass when the normalizer is called directly, and be
        // DEAD in the pipeline — which is why this asserts through `phonemize`. `29¾ polegada pa 24½
        // polegada` (the universal Magna Carta sentence) read as *vˈĩti nˈovi tɾˈes kuˈɐtu*, "twenty-nine
        // three four inches".
        expect(say("ta midi 29¾ polegada pa 24½ polegada")).toContain("tɾˈes kuˈɐɾtu");
        expect(say("ta midi 29¾ polegada pa 24½ polegada")).toContain("ˈũ mˈeiu");
        // the corpus's own slashed instance; denominators only where the corpus attests the FRACTION sense
        expect(say("5 mm (1/5 polegadas) ô más")).toContain("ˈũ kˈĩtu poleɡˈɐdɐs");
        // …and a word/word slash is not a fraction — 23 of the corpus's 24 slashes are this shape
        expect(say("bilheti di ida/volta")).toContain("ˈidɐ vˈoltɐ");
    });

    test("the ampersand spends the corpus's own conjunction; the number sign gets its own word", () => {
        // `B&Bs` ×1 — the canonical case. `y` ×1106 is the coordinator.
        expect(say("La di riba, B&Bs ta konpiti")).toContain("b ˈi bs");
        // `Nº 11` ×1, and `númeru` ×27 has one instance in exactly this slot (`riatoris Númeru 1 y 2`).
        // ⚠ Trap 36 records that № must NOT be folded to a Latin `No`: that substitutes an English word for
        // a dropped sign. kea has its own word.
        expect(say("konxedu pa kosmonauta Nº 11")).toContain("nˈumeɾu ˈõzi");
    });

    test("nothing bites an ordinary Kabuverdianu sentence", () => {
        // The invariant, not a schedule (trap 5): a sentence with no figure in it must be byte-identical
        // through the normalizer.
        const plain = "Agu di tornera é perfetamenti siguru pa bébe, mas agu engarafadu é fasil di atxa.";
        expect(normalizeKabuverdianu(plain)).toBe(plain);
        // the ALUPEC ⟨y⟩ coordinator must survive the ampersand rule untouched
        expect(say("dôs átumu di idrojéniu y un átumu di oksijéniu")).toContain("ˈi ˈũ");
    });
});
