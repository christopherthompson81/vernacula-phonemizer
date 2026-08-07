import { describe, expect, test } from "vitest";

import { phonemizeWord } from "../src/languages/kalaallisut/kalaallisut.ts";
import { getPhonemizer } from "../src/registry.ts";

// Canonical-IPA goldens for Kalaallisut / West Greenlandic (kl) — Eskimo-Aleut (Inuit).
// The 1973 orthography is highly phonemic → a near-1:1 scan: the THREE-vowel system
// /a i u/ (⟨e o⟩ = the uvular-lowered allophones → [i]/[u]), the uvular ⟨q⟩→[q]/⟨r⟩→[ʁ], ⟨ng⟩→[ŋ]/⟨nng⟩→[ŋː],
// doubled letter → length, loan ⟨b d⟩→[p t]. Referee: wikipron kal_latn_broad (human).
describe("Kalaallisut (Greenlandic) canonical IPA", () => {
    test("three-vowel /a i u/ + ⟨e o⟩ → [i u] (uvular-lowered allophones)", () => {
        expect(phonemizeWord("nanoq")).toBe("nanuq"); // ⟨o⟩ before ⟨q⟩ → [u] (the phonemic level); ⟨q⟩→[q]
        expect(phonemizeWord("qajaq")).toBe("qajaq"); // uvular ⟨q⟩→[q]; ⟨j⟩→[j]
        expect(phonemizeWord("inuk")).toBe("inuk"); // /a i u/ direct (person/human)
        expect(phonemizeWord("aanaa")).toBe("aːnaː"); // doubled vowel → length [aː]
    });

    test("uvular ⟨r⟩→[ʁ], ⟨ng⟩/⟨nng⟩, gemination, loan ⟨b d⟩→[p t]", () => {
        expect(phonemizeWord("illu")).toBe("ilːu"); // ⟨ll⟩ → long [lː] (house)
        expect(phonemizeWord("angakkoq")).toBe("aŋakːuq"); // ⟨ng⟩→[ŋ]; ⟨kk⟩→[kː]; ⟨o⟩→[u]
        expect(phonemizeWord("Kalaallisut")).toBe("kalaːlːisut"); // the endonym: ⟨aa⟩→[aː], ⟨ll⟩→[lː]
        expect(phonemizeWord("Bolatta")).toBe("pulatːa"); // loan ⟨b⟩→[p], ⟨o⟩→[u], ⟨tt⟩→[tː]
        expect(phonemizeWord("isigak")).toBe("isiɣak"); // ⟨g⟩ → the voiced velar FRICATIVE [ɣ] (parallel to r→ʁ)
    });

    test("registry wiring", () => {
        expect(getPhonemizer("kl").text("nuna").trim()).toBe("nuna");
    });

    // ═══ CARDINAL NUMBERS — SPLIT AT 12: native Greenlandic 0–12, DANISH loan numerals (in Danish orthography)
    // from 13 up. Not a guess: Oqaasileriffik's reference analyser has NO native numeral above 20, tags 16–20
    // archaic, and the suffix-allomorph distribution over an 834k-word corpus matches Danish and only Danish
    // (20/30/40 vowel-final → -t; 50–90 consonant-final → -it). Full evidence in numbers.ts.
    test("cardinals: the NATIVE hand/foot series, 0–12 only", () => {
        const kl = getPhonemizer("kl");
        expect(kl.text("1").trim()).toBe("ataːsiq"); // ataaseq
        expect(kl.text("7").trim()).toBe("aʁfiniq maʁluk"); // arfineq marluk — 'other hand' + two
        expect(kl.text("12").trim()).toBe("aqːaniq maʁluk"); // aqqaneq marluk — 'going down' (to the feet) + two
        // 0 has no native form; the corpus has bare Danish `nul`, and the FST routes digit 0 to the
        // CONSONANT-final host class — which is correct for nul. This is real data, not a failed lookup.
        expect(kl.text("0").trim()).toBe("nul");
    });

    test("cardinals: DANISH from 13 up — unit-og-ten, written SOLID", () => {
        const kl = getPhonemizer("kl");
        expect(kl.text("13").trim()).toBe("tʁitːin"); // tretten — the native series STOPS at 12
        expect(kl.text("25").trim()).toBe("fimuɣtyvi"); // femogtyve — units-first with `og`, solid
        expect(kl.text("37").trim()).toBe("syvuɣtʁitivi"); // syvogtredive (corpus: syvogtrediveniit)
        expect(kl.text("100").trim()).toBe("huntʁiti"); // hundrede (corpus: hundredenik)
        expect(kl.text("713").trim()).toBe("syvhuntʁititʁitːin"); // syvhundredetretten — attested shape
        expect(kl.text("1000").trim()).toBe("tusint"); // tusind
        // Inside a larger figure EVERYTHING is Danish, including 1–12: 12 000 is tolvtusind, not *aqqaneq-marluk.
        expect(kl.text("12345").trim()).toBe("tulvtusinttʁihuntʁitifimuɣfyʁːi"); // tolvtusindtrehundredefemogfyrre
        expect(kl.text("1000000").trim()).toBe("in milːiun"); // en million — million is an en-word
        expect(kl.text("2000000").trim()).toBe("tu milːiuniʁ"); // to millioner
    });
});
