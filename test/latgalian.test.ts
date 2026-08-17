import { describe, expect, test } from "vitest";

import { phonemizeWord, createLatgalian } from "../src/languages/latgalian/latgalian.ts";
import { normalizeLatgalian } from "../src/languages/latgalian/normalize.ts";
import { phonemize } from "../src/index.ts";

// Canonical-IPA goldens for Latgalian (ltg) — latgaļu volūda, an Eastern Baltic sibling of Latvian. The signature is
// the ⟨i⟩/⟨y⟩ soft/hard split: front ⟨i ī e ē⟩ palatalize the preceding consonant, but ⟨y⟩→[ɨ] (a hard central vowel
// Latvian lacks) does NOT. Plus macron length, háček sibilants, written palatals, and Baltic voicing assimilation.
// Referee: wikipron ltg narrow + kaikki.
describe("Latgalian (latgaļu volūda) canonical IPA", () => {
    test("the ⟨i⟩/⟨y⟩ SOFT/HARD split (the signature)", () => {
        expect(phonemizeWord("cylvāks")).toBe("t͡sɨlvaːks"); // 'human' — ⟨y⟩→[ɨ] HARD: ⟨c⟩ is NOT palatalized
        expect(phonemizeWord("byut")).toBe("bɨut"); // 'to be' — ⟨y⟩→[ɨ]
        expect(phonemizeWord("acis")).toBe("at͡sʲis"); // 'eye' — ⟨i⟩ SOFT: ⟨c⟩→[t͡sʲ] palatalized
        expect(phonemizeWord("bet")).toBe("bʲæt"); // 'but' — ⟨e⟩ palatalizes ⟨b⟩→[bʲ]; ⟨e⟩→[æ]
    });

    test("onset-cluster palatalization + written palatals", () => {
        expect(phonemizeWord("bazneica")).toBe("bazʲnʲæit͡sa"); // 'church' — the onset cluster ⟨zn⟩ softens before ⟨ei⟩
        expect(phonemizeWord("mute")).toBe("mutʲæ"); // 'mouth' — ⟨t⟩ palatalizes before ⟨e⟩; ⟨m⟩ before ⟨u⟩ stays hard
        expect(phonemizeWord("ķēneņš")).toBe("kʲæːnʲænʲt͡ʃ"); // ⟨ķ⟩→[kʲ], ⟨ē⟩→[æː], ⟨ņ⟩→[nʲ]; final ⟨-ņš⟩ → [nʲt͡ʃ] (t-epenthesis)
        expect(phonemizeWord("latgaļu")).toBe("ladɡalʲu"); // the endonym — ⟨ļ⟩→[lʲ]; ⟨tg⟩ voices to [dɡ]
    });

    test("review fixes — t-epenthesis, /r/-cluster opacity, final ⟨v⟩→[f]", () => {
        expect(phonemizeWord("sens")).toBe("sʲænt͡s"); // final ⟨-ns⟩ → [nt͡s] (epenthetic t) — the -ons nominative class
        expect(phonemizeWord("akmiņs")).toBe("akʲmʲinʲt͡sʲ"); // final ⟨-ņs⟩ → [nʲt͡sʲ]
        expect(phonemizeWord("treis")).toBe("træis"); // obstruent+⟨r⟩ cluster stays HARD (not tʲrʲ)
        expect(phonemizeWord("svareigs")).toBe("zvarʲæiks"); // a SIMPLE ⟨r⟩ onset still palatalizes before a front vowel
        expect(phonemizeWord("div")).toBe("dʲif"); // word-final ⟨v⟩ devoices to [f] (not the glide [w])
    });

    test("vowels + Baltic voicing assimilation", () => {
        expect(phonemizeWord("volūda")).toBe("vɔluːda"); // ⟨o⟩→[ɔ], macron ⟨ū⟩→[uː]
        expect(phonemizeWord("Latgola")).toBe("ladɡɔla"); // ⟨tg⟩→[dɡ] regressive voicing
        expect(phonemizeWord("atzeit")).toBe("ad͡zʲæit"); // ⟨tz⟩→[d͡z] affricate, palatalized before ⟨ei⟩
    });

    // Cardinal numbers (numbers.ts). East-Baltic concord as in Latvian — SINGULAR after a count ending in …1
    // (except …11), plural otherwise — but with the Latgalian twist that "tyukstūša" is FEMININE (Latvian's
    // tūkstotis is masculine), so the thousands multiplier takes the FEMININE unit series (sešys, vīna).
    test("cardinal numbers: -padsmit teens + the FEMININE tyukstūša multiplier", () => {
        const ltg = createLatgalian();
        expect(ltg.text("7").trim()).toBe("sʲæpʲtʲænʲi"); // septeni
        expect(ltg.text("15").trim()).toBe("pʲiːt͡spatʲsʲmʲit"); // pīcpadsmit (the -padsmit teen)
        expect(ltg.text("21").trim()).toBe("dʲiwʲdʲæsʲmʲit vʲiːnt͡s"); // divdesmit vīns (coda ⟨v⟩→w; final ⟨-ns⟩→[nt͡s])
        expect(ltg.text("101").trim()).toBe("sɨmts vʲiːnt͡s"); // symts vīns
        expect(ltg.text("555").trim()).toBe("pʲiːt͡sʲi sɨmʲtʲi pʲiːd͡zʲdʲæsʲmʲit pʲiːt͡sʲi"); // pīci symti pīcdesmit pīci
        expect(ltg.text("1000").trim()).toBe("tɨukstuːʃa"); // tyukstūša — the numeral is dropped
        expect(ltg.text("2000").trim()).toBe("dʲivʲi tɨukstuːʃɨs"); // divi tyukstūšys → plural
        expect(ltg.text("6000").trim()).toBe("sʲæʃɨs tɨukstuːʃɨs"); // sešys tyukstūšys — FEMININE multiplier
        expect(ltg.text("21000").trim()).toBe("dʲiwʲdʲæsʲmʲit vʲiːna tɨukstuːʃa"); // divdesmit vīna tyukstūša (fem sg)
        expect(ltg.text("100000").trim()).toBe("sɨmts tɨukstuːʃɨs"); // symts tyukstūšys (masc symts + fem noun)
        expect(ltg.text("12345").trim()).toBe(
            "dʲiwpatʲsʲmʲit tɨukstuːʃɨs træis sɨmʲtʲi t͡ʃʲætrudʲæsʲmʲit pʲiːt͡sʲi",
        ); // divpadsmit tyukstūšys treis symti četrudesmit pīci
        expect(ltg.text("1000000").trim()).toBe("vʲiːnt͡s mʲilʲjɔnt͡s"); // vīns miļjons (masculine, keeps the numeral)
        expect(ltg.text("1000000000").trim()).toBe("vʲiːnt͡s mʲilʲjarts"); // vīns miļjards
    });
});

// Text normalization (src/languages/latgalian/normalize.ts). Every case encodes a measurement over the
// retained text of tools/corpus/mined/ltg.jsonc (394 segments of a 3,444-paragraph ltg.wikipedia dump);
// the reason is in the comment beside it. See docs/investigations/ltg_normalization_investigation.md.
describe("Latgalian text normalization", () => {
    test("⟨g.⟩ is the YEAR, not the gram — the one key that must not be ported from Latvian", () => {
        // `\d[\s.]?g\.` is ×32 in the retained text (`1577 g.`, `1935 g. apreļa 22 d.`, `1983.g.`) against
        // ONE genuine gram, so `g` is deliberately absent from the unit table and the figure stays bare.
        expect(normalizeLatgalian("1577 g. — Ivana Borguo vodomi")).toBe("1577 g. — Ivana Borguo vodomi");
        expect(normalizeLatgalian("svors — 650—800 g.")).toBe("svors — 650, 800 g.");
        // …while the two-letter keys the corpus does write ARE read, in the count form the numeral takes.
        expect(normalizeLatgalian("Atostums da Rēzeknei — 80 km")).toBe("Atostums da Rēzeknei — 80 kilometri");
        expect(normalizeLatgalian("Ola irā 1 km iz DV")).toBe("Ola irā 1 kilometrs iz DV"); // …1 → SINGULAR
    });

    test("the comma is BOTH separators — three digits group, anything else decimates", () => {
        // grouping ×9: `1,500 solu`, `548,000 cylvāku`, `3,555 km2`, `450,295 km²` (Sweden)
        expect(normalizeLatgalian("vaira kai 1,500 solu")).toBe("vaira kai 1500 solu");
        expect(normalizeLatgalian("548,000 cylvāku")).toBe("548000 cylvāku");
        // decimal ×65 — the mark is NEUTRALISED, not spoken: `komats` is ×0 on ltg.wikipedia and `punkts`
        // ×18 is a FACILITY in every example (`feļčeru punkts`, `turizma informacejis punkts`).
        expect(normalizeLatgalian("Vydyskais dziļums 12,8 m.")).toBe("Vydyskais dziļums 12 8 metri.");
        // a fourth digit after the group means the comma was a decimal all along
        expect(normalizeLatgalian("apmāram 0,702804 latu")).toBe("apmāram 0 702804 latu");
    });

    test("the SPACE groups too, and the whole number at once (playbook trap 63)", () => {
        // `9 223 766 dzeivuotuojim` is three groups; joining one pair per pass reads it as two numbers.
        expect(normalizeLatgalian("mīsts ar 9 223 766 dzeivuotuojim")).toBe("mīsts ar 9223766 dzeivuotuojim");
        expect(normalizeLatgalian("joma 83 871 km².")).toBe("joma 83871 kvadratkilometrs.");
    });

    test("the DOT decimates but a two-dot run is a DATE", () => {
        // `16.3 °C`, `5.2 °C`, `1.8 milijoni` — the dot is a decimal in this corpus too
        expect(normalizeLatgalian("temperatura irā 5.2 °C")).toBe("temperatura irā 5 2 gradi pa Celseja skolai");
        // …but `07.02.1922`, `1858.07.01`, `17.12.1932` are dates: exactly ONE dot in the run is the guard
        expect(normalizeLatgalian("(, 17.12.1932 — 18.02.2004)")).toBe("(, 17.12.1932, 18.02.2004)");
    });

    test("the ordinal period is not a full stop — 139 sites, and the 14 exceptions are left alone", () => {
        // the figure stays CARDINAL (no ordinal series is attested for this language) but the spurious
        // sentence break inside the date goes
        expect(normalizeLatgalian("Nu 1964. da 1968. godam")).toBe("Nu 1964 da 1968 godam");
        // …the tight form too, and the gap is SUPPLIED or the figure fuses onto the noun (*1901godā*)
        expect(normalizeLatgalian("1901.godā īsuoca vuiceibys")).toBe("1901 godā īsuoca vuiceibys");
        // …before a DASH, which is why this arm must run above the range step
        expect(normalizeLatgalian("2009, 143.–153. lpp.")).toBe("2009, 143, 153 lpp.");
        // …and an UPPER-CASE follower or the end of input is an ordinary sentence boundary
        expect(normalizeLatgalian("mozuokais, 3000. Partū taidu")).toBe("mozuokais, 3000. Partū taidu");
        expect(normalizeLatgalian("Īstateišonys gods – 1957.")).toBe("Īstateišonys gods – 1957.");
    });

    test("the degree sign, its Celsius phrase, and the writer's own gloss", () => {
        // `gradi` ×4 corpus / ×6 wiki, every example a temperature; the scale is named POSTPOSITIONALLY on
        // ltg.wikipedia (`-9° pa Celseja skolai`), which is why it is spelled out locally and not declared
        // as a tier modifier — `Celsija` is ×0 and no `Celseja gradi` modifier is attested anywhere.
        expect(normalizeLatgalian("juļa mienesī +17°C.")).toBe("juļa mienesī +17 gradi pa Celseja skolai.");
        // ⚠ the corpus glosses its OWN sign in a parallel sentence, leaving a bare ⟨C⟩ that reads as
        // Latgalian /t͡s/ — a plausible syllable no leak class can see (playbook trap 56)
        expect(normalizeLatgalian("(–43 gradi C), i Daugpilī")).toBe("(–43 gradi pa Celseja skolai), i Daugpilī");
        // …and a bare degree is an angle or a coordinate: `56,4°`, `9,6° augšuok horizonta`
        expect(normalizeLatgalian("tik 9,6° augšuok horizonta")).toBe("tik 9 6 gradi augšuok horizonta");
    });

    test("the range dash is spent on a PAUSE, because `da` never appears without its `nu`", () => {
        // every one of this corpus's spelled-out spans is the full frame — `nu 535 da 727 mm`, `nu 1920 da
        // 1945 godam`, `nu 287 000 da 422 000` — so imposing `da` on a bare dash claims a frame the corpus
        // never writes (playbook trap 9). haw and kaa reached the same conclusion on the same evidence.
        expect(normalizeLatgalian("krytuļu daudzums ap 650—700 mm")).toBe("krytuļu daudzums ap 650, 700 mm");
        expect(normalizeLatgalian("Vuicejusēs pamatškolā (1966-1970)")).toBe("Vuicejusēs pamatškolā (1966, 1970)");
        // ⚠ NOTHING MAY BE REQUIRED AFTER THE SECOND NUMBER (playbook trap 58) — a clause-final range
        expect(normalizeLatgalian("XVI gs. vydā – jau 120-150.")).toBe("XVI gs. vydā – jau 120, 150.");
        // …and a slash means a season or a standard number, not a span
        expect(normalizeLatgalian("2003/2004 g. sezonā")).toBe("2003/2004 g. sezonā");
    });

    test("the era marker, sourced as a phrase and keeping a sentence's own period", () => {
        // `pyrma Krystus` is ltg.wikipedia's own words, in two independent articles ("pīdzims 7-2 godā
        // pyrma Krystus", "II godusymtā pyrma Krystus"). ⚠ `Kristus` ×4 — the spelling a word-first probe
        // would have taken — is a Siberian punk band's SONG TITLE in every one of its hits.
        expect(normalizeLatgalian("† ap 240 g. p. Kr.) – vīns nu")).toBe("† ap 240 g. pyrma Krystus) – vīns nu");
        expect(normalizeLatgalian("Ap 290 g. p. Kr.")).toBe("Ap 290 g. pyrma Krystus.");
    });

    test("the product sign is claimed and the BIRTH asterisk is not", () => {
        // `26*26=676` is the corpus's one product; `(; * ap 310—305 g. p. Kr.` is the biographical birth
        // mark. Digits on BOTH sides is the whole guard. `reiz` is attested in exactly this frame:
        // "diveju komandu kaitaunīkim 15 reiz 4 m pluota laukumeņā".
        expect(normalizeLatgalian("viņ 26*26=676 kombinacejis")).toBe("viņ 26 reiz 26=676 kombinacejis");
        expect(normalizeLatgalian("(; * ap 310—305 g.")).toBe("(; * ap 310, 305 g.");
    });

    test("percent, currency and the squared kilometre", () => {
        // `procents`/`procenti` ×3, both in the counted slot ("atsateikūši 42,3 i 41,7 procenti")
        expect(normalizeLatgalian("Inflaceja 2004 godā beja 3%.")).toBe("Inflaceja 2004 godā beja 3 procenti.");
        expect(normalizeLatgalian("dasnīdze 21%")).toBe("dasnīdze 21 procents"); // …1 → SINGULAR
        expect(normalizeLatgalian("15,3 % Igaunejis")).toBe("15 3 procenti Igaunejis"); // the spaced sign
        // `€` is the only currency sign in the corpus (×1); `$` is ×0 and is deliberately undeclared.
        expect(normalizeLatgalian("budžets tur €151 miljonu")).toBe("budžets tur 151 miljonu euru");
        // ⚠ the square word was found ONLY by the slot probe: `kvadratkilometri` is ×0 and
        // `kvadratkilometru` ×2 (playbook trap 40), so the measure word FUSES to the front.
        expect(normalizeLatgalian("aizjamūt 2,300 km² lelu pluotu")).toBe("aizjamūt 2300 kvadratkilometri lelu pluotu");
        expect(normalizeLatgalian("Peipuss — 3,555 km2 pluotā")).toBe("Peipuss — 3555 kvadratkilometri pluotā");
    });

    test("whole pipeline: the defects the layer was written to remove", () => {
        // `-7°C` used to read `sʲæpʲtʲænʲi t͡s` — the sign gone and ⟨C⟩ read as a Latgalian syllable
        expect(phonemize("mienesī -7°C", "ltg")).toContain("ɡradʲi pa t͡sʲælʲsʲæja skɔlai");
        // `1,500 solu` used to read as "vīns , pīci symti solu" — a clause break and the wrong quantity
        expect(phonemize("vaira kai 1,500 solu", "ltg").trim())
            .toBe("vaira kai tɨukstuːʃa pʲiːt͡sʲi sɨmʲtʲi sɔlu");
        // `&` is the taxonomic authority pair and reads as the Latgalian conjunction
        expect(phonemize("Thomas & Hinton", "ltg").trim()).toBe("txɔmas i xʲintɔn");
        // ⚠ the HTML entity is decoded upstream (core/markup.ts), so `7&nbsp;km` is number-adjacent by the
        // time this layer runs — asserted through the whole pipeline rather than assumed.
        expect(phonemize("7&nbsp;km nu centra", "ltg").trim())
            .toBe("sʲæpʲtʲænʲi kʲilɔmʲætri nu t͡sʲæntra");
        // ⚠ a trailing full stop must not decline the match (playbook trap 58)
        expect(phonemize("Viersa pluots 753 ha.", "ltg")).toContain("xʲæktarʲi");
    });
});
