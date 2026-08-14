import { describe, expect, test } from "vitest";

import { normalizeTashelhit as N } from "../src/languages/tashelhit/normalize.ts";
import { createTashelhit, phonemizeWord } from "../src/languages/tashelhit/tashelhit.ts";
import { getPhonemizer } from "../src/registry.ts";

// Tashelhit / Shilha (shi) — Taclḥit, a Berber (Amazigh) language of SW Morocco (~7–9M). A near-1:1 phonemic
// Berber-Latin → IPA converter: emphatics (dot-below) ḍ→dˤ etc., pharyngeals ḥ→ħ / ɛ→ʕ, uvulars ɣ/x→χ/q, c→ʃ;
// labialisation C+ʷ→Cʷ; gemination (doubling)→Cː. Referees: wikipron shi_latn + kaikki Tashelhit — ⚠ both
// Wiktionary, so they are not independent of each other.
describe("Tashelhit (Shilha) canonical IPA — Berber Latin → IPA converter", () => {
    const shi = createTashelhit();

    test("emphatics (pharyngealised, dot-below), pharyngeals, uvulars", () => {
        expect(phonemizeWord("aḍaṛ")).toBe("adˤarˤ"); // ⟨ḍ⟩→dˤ, ⟨ṛ⟩→rˤ ("foot/leg")
        expect(phonemizeWord("Taclḥit")).toBe("taʃlħit"); // ⟨c⟩→ʃ, ⟨ḥ⟩→ħ (the endonym)
        expect(phonemizeWord("amaziɣ")).toBe("amaziɣ"); // ⟨ɣ⟩→ɣ ("Amazigh/Berber")
        expect(phonemizeWord("aɣrum")).toBe("aɣrum"); // ("bread")
    });

    test("gemination (doubling) → a long consonant [Cː], incl. emphatic + labialised geminates", () => {
        expect(phonemizeWord("azz")).toBe("azː"); // ⟨zz⟩ → zː
        expect(phonemizeWord("abaṭṭaḥ")).toBe("abatˤːaħ"); // ⟨ṭṭ⟩ emphatic geminate → tˤː
        expect(phonemizeWord("aggʷrn")).toBe("aɡʷːrn"); // ⟨ggʷ⟩ labialised geminate → ɡʷː
        expect(phonemizeWord("akkʷ")).toBe("akʷː"); // ⟨kkʷ⟩ → kʷː
    });

    test("labialisation C+⟨ʷ⟩ → [Cʷ]; ⟨e⟩→schwa; ⟨y⟩→j", () => {
        expect(phonemizeWord("awal")).toBe("awal"); // ⟨w⟩→w ("word/speech")
        expect(phonemizeWord("tamdint")).toBe("tamdint"); // ("town/city")
    });

    test("clause assembly", () => {
        expect(createTashelhit().text("Taclḥit d awal amaziɣ.").replace(/\s+/g, " ").trim())
            .toBe("taʃlħit d awal amaziɣ ."); // "Tashelhit is an Amazigh language"
    });

    test("the text() path handles NFD input (combining dot-below U+0323 emphatics)", () => {
        // Regression: the tokenizer must NFC-normalize, else combining dot-below shatters the word + drops emphatics.
        const nfd = "aḍaṛ".normalize("NFD");
        expect(createTashelhit().text(nfd).trim()).toBe("adˤarˤ"); // not "ad ar"
    });

    test("Tifinagh (ⵜⵉⴼⵉⵏⴰⵖ) front-end — script auto-detected, IDENTICAL IPA to the Latin path", () => {
        // Neo-Tifinagh (Morocco's official IRCAM script) is a phonemic alphabet → same phonology, same IPA.
        expect(phonemizeWord("ⵜⴰⵛⵍⵃⵉⵜ")).toBe("taʃlħit"); // = Taclḥit (the endonym)
        expect(phonemizeWord("ⴰⴹⴰⵕ")).toBe("adˤarˤ"); // = aḍaṛ (emphatics ⴹ→dˤ, ⵕ→rˤ)
        expect(phonemizeWord("ⴰⵎⴰⵣⵉⵖ")).toBe("amaziɣ"); // = amaziɣ
        expect(phonemizeWord("ⵜⴰⵛⵍⵃⵉⵜ")).toBe(phonemizeWord("Taclḥit")); // Tifinagh ≡ Latin
        expect(createTashelhit().text("ⵜⴰⵛⵍⵃⵉⵜ ⴷ ⴰⵡⴰⵍ").trim()).toBe("taʃlħit d awal"); // mixed clause
    });

    // ═══ CARDINAL NUMBERS — MOROCCAN ARABIC loans with NATIVE Berber kept for 1–3. Tashelhit does preserve a full
    // native decade 1–10 and a native vigesimal 11–99 (Kossmann 2013:307–308), but it is recessive and even it
    // borrows at 100/1000; the Peace Corps Tashlheet Textbook (2011:37) states the rule outright: "In TashlHeet we
    // usually use Arabic numbers except for the numbers: one, two and three." Sources in numbers.ts.
    test("cardinals: native Berber 1–3, Moroccan Arabic from 4 up", () => {
        const shi = getPhonemizer("shi");
        expect(shi.text("1").trim()).toBe("jan"); // yan — NATIVE Berber (never `waḥd` standalone)
        expect(shi.text("3").trim()).toBe("kradˤ"); // kraḍ — NATIVE; the cut-off
        expect(shi.text("4").trim()).toBe("rbʕa"); // rbɛa — Arabic from here up
        expect(shi.text("11").trim()).toBe("ħdaʃ"); // ḥdac
        expect(shi.text("20").trim()).toBe("ʕʃrin"); // ɛcrin — a loan with NO native competitor at all
        // Inside a tens compound the sources give Arabic waḥd/tnayn for 1/2; 3 keeps native kraḍ because no free
        // Arabic form for 3 is attested (only bound tlt-/tlatin/tltac) and we decline to synthesize `tlata`.
        expect(shi.text("21").trim()).toBe("waħd u ʕʃrin"); // waḥd u ɛcrin — UNITS-FIRST
        expect(shi.text("33").trim()).toBe("kradˤ u tlatin"); // kraḍ u tlatin — the documented hybrid seam
        expect(shi.text("45").trim()).toBe("χmsa u rbʕin"); // xmsa u rbɛin
    });

    test("cardinals: Arabic DUAL hundreds/thousands + the count-triggered plural", () => {
        const shi = getPhonemizer("shi");
        expect(shi.text("0").trim()).toBe("sˤifr"); // ṣifr (the IRCAM neologism `amya` is NOT generated)
        expect(shi.text("100").trim()).toBe("mja"); // mya
        expect(shi.text("200").trim()).toBe("mjatajn"); // myatayn — the DUAL
        expect(shi.text("345").trim()).toBe("tlt mja u χmsa u rbʕin"); // tlt mya u xmsa u rbɛin — SHORT stem
        expect(shi.text("1000").trim()).toBe("alf"); // alf
        expect(shi.text("2000").trim()).toBe("alfajn"); // alfayn — the DUAL
        expect(shi.text("3000").trim()).toBe("tlt alaf"); // tlt alaf — 3–10 takes the PLURAL alaf
        expect(shi.text("12345").trim()).toBe("tnaʃ alf u tlt mja u χmsa u rbʕin"); // 11+ → SINGULAR alf again
        expect(shi.text("1000000").trim()).toBe("mljun"); // mlyun
    });

    test("cardinals: a tokenizer with no digit group DROPS every number", () => {
        // Arabic-Indic digits ٠-٩ are accepted too, since Moroccan text mixes them with 0-9.
        expect(getPhonemizer("shi").text("٤٥").trim()).toBe("χmsa u rbʕin");
    });
});

// ═══ TEXT NORMALIZATION — src/languages/tashelhit/normalize.ts ════════════════════════════════════════
// There is no FLEURS for Tashelhit; the evidence is tools/corpus/mined/shi.jsonc (43,733 paragraphs from a
// shi.wikipedia dump) plus attest.ts against shi.wikipedia. Sourcing, counts and every refusal are argued in
// normalize.ts's header; docs/investigations/shi_normalization_investigation.md is the log.
//
// ⚠ THESE PIN THE RULE'S BRANCHES, NOT THE CORPUS'S INSTANCES (trap 13). Where a branch the corpus does not
// exercise exists — `m³`, `km/h`, `802.11m`, an upper-case unit key — it is pinned with a case the corpus
// does NOT contain, because that is the half no corpus diff can reach.
describe("Tashelhit normalization — the pre-tokenizer pass", () => {
    const shi = () => getPhonemizer("shi");
    const say = (s: string) => shi().text(s).replace(/\s+/gu, " ").trim();

    test("de-grouping: all four separators, and the discriminator is a 3-digit block", () => {
        // The period is unambiguous in this corpus: 16/16 three-digit-block instances are GROUPING.
        expect(N("510.072.000 km²")).toBe("510072000 kilumitr amkkuẓ");
        expect(N("15.000 n ufgan")).toBe("15000 n ufgan");
        // The comma likewise, 29/32 — with the two known counter-examples stated in normalize.ts.
        expect(N("8,000 kilumitr (5,000 mil)")).toBe("8000 kilumitr (5000 mil)");
        expect(N("85,133,000 km2")).toBe("85133000 kilumitr amkkuẓ");
        // SPACE grouping — `1 470 m` used to read as TWO numbers with a raw `m`.
        expect(say("ɣ yat tattuyt n 1 470 m")).toBe("ɣ jat tatːujt n alf u rbʕ mja u sbʕin mitru");
        // U+066C, the Arabic thousands separator the corpus writes beside Arabic-Indic digits.
        expect(N("106٬710٬325")).toBe("106710325");
        // ⚠ AND A 1–2-DIGIT TAIL IS A DECIMAL, NOT A GROUP, on either mark — the other side of the same rule.
        expect(N("37.4")).toBe("37 4");
        expect(N("17,9")).toBe("17 9");
        // ⚠ THE `%` LOOKAHEAD IS THE ONE EXCEPTION, and it buys back the corpus's `99,854 %` (a decimal).
        expect(N("99,854 %")).toBe("99 8 5 4 %");
    });

    test("decimals: the separator is SPENT, not read as a pause — and the fraction is digit-by-digit", () => {
        // The defect being repaired is prosodic: `37.4%` read *sbʕa u tlatin **.** rbʕa*, a SENTENCE BREAK
        // inside a quantity. No decimal-point word is shipped — see normalize.ts: `tanqqiḍt` is attested
        // only in the geographic/melting/punctuation senses, so the fraction is read one digit at a time.
        expect(say("37.4")).toBe("sbʕa u tlatin rbʕa");
        expect(say("3,14")).toBe("kradˤ jan rbʕa");
        // ⚠ THE TRAILING GUARD MUST EXCLUDE A SEPARATOR+DIGIT, NOT A CLAUSE MARK. The corpus diff caught
        // this: `(π≈3,14, π≈22/7)` kept its spurious pause because the decimal is followed by the
        // sentence's own comma, while the identical `3,14` a line earlier was fixed.
        expect(N("π≈3,14, π≈22/7")).toBe("π≈3 1 4, π≈22/7");
    });

    test("units: every word attested in the digit-adjacent slot; km/kg were the raw-Latin leak", () => {
        expect(say("8665 km²")).toBe("tmn alaf u stː mja u χmsa u stːin kilumitr amkːuzˤ");
        expect(say("5 kg")).toBe("χmsa kiluɡram");
        expect(say("0.5 mm")).toBe("sˤifr χmsa milimitr");
        expect(N("24 cm")).toBe("24 santim");
        expect(N("450 gram")).toBe("450 gram"); // already a word — the rule must not double it
        // ⚠ BRANCHES THE CORPUS DOES NOT EXERCISE. `m³` and the rate keys each occur once or not at all,
        // and `kilumitr ɣ tasragt` / `mitr mukaɛɛab ɣ tsnat` are compound KEYS rather than compositions
        // (trap 44), because shi's "per" is the locative `ɣ` plus a time noun and not "A per B".
        expect(N("120 km/h")).toBe("120 kilumitr ɣ tasragt");
        expect(N("30 km/s")).toBe("30 kilumitr ɣ tsnat");
        expect(N("24.3 m³/s")).toBe("24 3 mitr mukaɛɛab ɣ tsnat");
        expect(N("60000 m²")).toBe("60000 mitr amkkuẓ");
        // ⚠ CASE-INSENSITIVE, measured: the corpus writes `91,982 Km²` and `180.000Km²` with a capital K.
        expect(N("91,982 Km²")).toBe("91982 kilumitr amkkuẓ");
        // ⚠ A MAGNITUDE MAY STAND BETWEEN THE FIGURE AND ITS UNIT and is hopped, not consumed.
        // (…and step 6 then spends the decimal point, which is why the figure comes out digit-by-digit.)
        expect(N("2.15 id mlyun km²")).toBe("2 1 5 id mlyun kilumitr amkkuẓ");
    });

    test("units: trap 46 — a one-letter key must not claim a dotted designation", () => {
        // `m` IS declared (4 genuine metres in the retained text) and therefore carries trap 46's cost.
        // A leading `(?<![\d.,])` alone does NOT stop this: rejected at `802`, the engine retries from the
        // FRACTIONAL part and matches `11m` on its own, which is what the first draft did.
        expect(N("802.11m")).toBe("802 1 1m"); // the letter stays raw — a designation, not a measurement
        expect(N("4000m")).toBe("4000 mitru"); // …while the glued genuine metre still reads
        expect(N("12.5 km")).toBe("12 5 kilumitr");
    });

    test("degrees: ⟨C⟩ was being read as the shi grapheme c = /ʃ/, which is worse than a drop", () => {
        expect(say("20°C")).toBe("ʕʃrin taskflt n silsjus");
        expect(say("19° d 23° ɣ uzal")).toBe("tsʕtaʃ n tskflt d kradˤ u ʕʃrin n tskflt ɣ uzal");
        // ⚠ TRAP 12: the corpus writes the scale name GLUED to the sign, so the word must not be doubled.
        expect(N("-45°Silsyus")).toBe("-45 taskflt n Silsyus");
        // ⚠ AND THE BARE `°` IS DECLINED WHERE IT IS A COORDINATE — the right context is the discriminator
        // (trap 24), since a coordinate degree is followed by its arc-minute and a bearing by a direction.
        expect(N("31° 57′ 51″ N")).toBe("31° 57′ 51″ N");
        expect(N("7° Ouest")).toBe("7° Ouest");
    });

    test("era markers: the corpus glosses its own abbreviation, and expands what the AUTHOR wrote", () => {
        // `250 dat tlalit n Yizus` is spelled out in the same corpus that abbreviates BC dates `D.T.`.
        expect(say("148 D.Ɛ.")).toBe("mja u tmnja u rbʕin dat ʕisa .");
        expect(N("1980 Ḍ.T. G izwar")).toBe("1980 ḍarat tlalit. G izwar");
        // ⚠ THE FINAL DOT SURVIVES ONLY WHEN THE SENTENCE ENDS — `179 D.T. yat tdri` continues in lower
        // case, so its dot was a spurious break and is spent.
        expect(N("179 D.T. yat tdri")).toBe("179 dat tlalit yat tdri");
        // ⚠ THE MARKER IS ALSO WRITTEN WITHOUT ITS FINAL DOT and looking for one form finds half the
        // instances (trap 15) — the corpus's own `Ilul ɣ 238 D.Ɛ immt ɣ 148 D.Ɛ.` has both in one sentence.
        expect(N("238 D.Ɛ immt")).toBe("238 dat Ɛisa immt");
        // ⚠ `b.ɛ` GETS NO ERA PHRASE (its initials compose from nothing attested), only the generic dotted
        // run's PAUSE repair.
        expect(N("632 b.ɛ.")).toBe("632 bɛ.");
    });

    test("currency: attested nouns, postposed, and never doubled", () => {
        expect(say("$47,203")).toBe("sbʕa u rbʕin alf u mjatajn u kradˤ dularˤ");
        expect(N("€ 638186")).toBe("638186 uṛu");
        // ⚠ TRAP 12: the corpus's own `€3 id mlyun n Wuṛu` already names the currency.
        expect(N("€3 id mlyun n Wuṛu")).toBe("3 id mlyun n Wuṛu");
        // ¥ and £ are one instance each with no attested shi word, so they stay unclaimed.
        expect(N("¥ 106710325")).toBe("¥ 106710325");
    });

    test("ordinary text and a real sentence end must survive", () => {
        expect(say("Taclḥit d awal amaziɣ.")).toBe("taʃlħit d awal amaziɣ .");
        // Nothing in this layer keys on a Tifinagh character, so the Tifinagh path is untouched.
        expect(say("ⵜⴰⵛⵍⵃⵉⵜ ⴷ ⴰⵡⴰⵍ")).toBe("taʃlħit d awal");
        // A run in a script the engine does not claim is routed by core/scripts.ts, not deleted — probed
        // over all 403 retained segments and ZERO read as the empty string.
        expect(say("(s tɛrabt: محمد)")).toBe("s tʕrabt , mħmd");
    });
});
