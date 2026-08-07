import { describe, expect, test } from "vitest";

import { phonemizeWord, createDutch } from "../src/languages/dutch/dutch.ts";

// Canonical-IPA goldens for Dutch / Nederlands (nl) — Northern Standard Dutch, West Germanic, Latin. Cleanroom
// rule-based g2p: open/closed-syllable vowel length, the Dutch diphthongs, g→ɣ (onset) / x (coda), w→ʋ, h→ɦ,
// final devoicing, unstressed ⟨e⟩→schwa. ⚠ Referees: kaikki nl + wikipron nld broad — BOTH Wiktionary-derived,
// so they are not independent of each other, and both are name/loanword-heavy.
describe("Dutch canonical IPA", () => {
    test("open/closed syllable vowel length (tense vs lax)", () => {
        expect(phonemizeWord("water")).toBe("ʋˈaːtər"); // open a → aː
        expect(phonemizeWord("dag")).toBe("dˈɑx"); // closed a → ɑ (+ final g → x)
        expect(phonemizeWord("man")).toBe("mˈɑn"); // closed → ɑ
        expect(phonemizeWord("maken")).toBe("mˈaːkən"); // open → aː
    });

    test("Dutch diphthongs (ij/ei→ɛi̯, ui→œy̯, ou/au→ɑu̯, eu→øː, oe→u)", () => {
        expect(phonemizeWord("tijd")).toBe("tˈɛi̯t"); // ij → ɛi̯ (+ final d → t)
        expect(phonemizeWord("huis")).toBe("ɦˈœy̯s"); // ui → œy̯
        expect(phonemizeWord("vrouw")).toBe("vrˈɑu̯"); // ouw → ɑu̯ (w absorbed)
        expect(phonemizeWord("deur")).toBe("dˈøːr"); // eu → øː
        expect(phonemizeWord("boek")).toBe("bˈuk"); // oe → u
        expect(phonemizeWord("mooi")).toBe("mˈoːi̯"); // ooi → oːi̯
        expect(phonemizeWord("nieuw")).toBe("nˈiu̯"); // ieuw → iu̯
    });

    test("g→ɣ (onset) / x (coda); ch→x; sch→sx; w→ʋ; h→ɦ", () => {
        expect(phonemizeWord("geven")).toBe("ɣˈeːvən"); // onset g → ɣ
        expect(phonemizeWord("groot")).toBe("ɣrˈoːt"); // onset cluster gr → ɣr
        expect(phonemizeWord("acht")).toBe("ˈɑxt"); // ch → x
        expect(phonemizeWord("school")).toBe("sxˈoːl"); // sch → sx
        expect(phonemizeWord("weg")).toBe("ʋˈɛx"); // w → ʋ, coda g → x
    });

    test("final devoicing (b/d/v/z/ɣ → p/t/f/s/x)", () => {
        expect(phonemizeWord("hond")).toBe("ɦˈɔnt"); // d → t
        expect(phonemizeWord("goed")).toBe("ɣˈut"); // d → t
        expect(phonemizeWord("huis")).toBe("ɦˈœy̯s"); // (s stays s)
    });

    test("unstressed ⟨e⟩ → schwa; ng/nk", () => {
        expect(phonemizeWord("zeven")).toBe("zˈeːvən"); // 2nd e → ə
        expect(phonemizeWord("over")).toBe("ˈoːvər"); // -er → ər
        expect(phonemizeWord("zingen")).toBe("zˈɪŋən"); // ng → ŋ
        expect(phonemizeWord("bank")).toBe("bˈɑŋk"); // nk → ŋk
    });

    test("native unstressed suffixes (-ig→əx, -lijk→lək, -isch→is)", () => {
        expect(phonemizeWord("twintig")).toBe("tʋˈɪntəx"); // -ig → əx
        expect(phonemizeWord("mogelijk")).toBe("mˈoːɣələk"); // -lijk → lək
        expect(phonemizeWord("typisch")).toBe("tˈipis"); // -isch → is (y → i)
        expect(phonemizeWord("big")).toBe("bˈɪx"); // monosyllable: NOT reduced (guard)
        expect(phonemizeWord("lijk")).toBe("lˈɛi̯k"); // word-initial lijk: NOT the suffix
    });

    test("unstressed prefix: stress shifts + ge-/be-/ver-/te- vowel reduces to schwa", () => {
        expect(phonemizeWord("verkopen")).toBe("vərkˈoːpən"); // ver → vər (reduced), stress → kopen
        expect(phonemizeWord("gemaakt")).toBe("ɣəmˈaːkt"); // ge- participle → ɣə
        expect(phonemizeWord("begin")).toBe("bəɣˈɪn"); // be- → bə
        expect(phonemizeWord("geven")).toBe("ɣˈeːvən"); // ge = ROOT here (nucleus2 is schwa) → stays ɣeː, stress first
        expect(phonemizeWord("geel")).toBe("ɣˈeːl"); // monosyllable → not a prefix
    });

    test("trema ⟨ë⟩ in the -ën plural → schwa (but stressed ë keeps quality)", () => {
        expect(phonemizeWord("knieën")).toBe("knˈiən"); // ie→i, ë→ə
        expect(phonemizeWord("tweeën")).toBe("tʋˈeːən"); // ee→eː, ë→ə
        expect(phonemizeWord("poëzie")).toBe("pˈoːeːzi"); // stressed ë keeps eː (more material after)
    });

    test("compound morphology: split at stem·stem, each element own stress + seam devoicing/degemination", () => {
        expect(phonemizeWord("voetbalveld")).toBe("vˈutbɑlvˈɛlt"); // voetbal·veld → each element stressed
        expect(phonemizeWord("huisdeur")).toBe("ɦˈœy̯sdˈøːr"); // huis·deur
        expect(phonemizeWord("knooppunt")).toBe("knˈoːpˈʏnt"); // knoop·punt → seam degemination p|p → p
        expect(phonemizeWord("voedingsstof")).toBe("vˈudɪŋstˈɔf"); // voedings·stof → linking-s + seam s|s → s
        expect(phonemizeWord("minister")).toBe("mˈinɪstər"); // NOT split (mini·ster rejected: known dictionary word)
        expect(phonemizeWord("drinken")).toBe("drˈɪŋkən"); // NOT split (drin·ken rejected: known word, -en verb)
    });

    test("function words + numbers", () => {
        const d = createDutch();
        expect(d.text("de kat").trim()).toBe("də kˈɑt"); // de → də (reduced clitic)
        expect(d.text("21").trim()).toBe("ˈeːnəntʋɪntəx"); // eenentwintig
        expect(d.text("100").trim()).toBe("ɦˈɔndərt"); // honderd
    });
});

// TEXT NORMALIZATION. Counts are over the 1,829 unique cased FLEURS nl_nl utterances; each assertion
// records what the engine produced BEFORE the layer existed. See src/languages/dutch/normalize.ts.
describe("Dutch text normalization", () => {
    const d = createDutch();
    const say = (s: string): string => d.text(s).trim();

    test("period groups thousands, comma is the decimal point", () => {
        // Both separators used to fall through to clausePunctuation: a phrase break plus a lost magnitude.
        expect(say("400.000")).toBe("vˈirɦˈɔndərtdˈœy̯zənt"); // was: vˈirɦˈɔndərt . nˈʏl
        expect(say("1.000")).toBe("dˈœy̯zənt"); // was: ˈeːn . nˈʏl
        expect(say("5.000.000")).toBe("vˈɛi̯f mˈɪljun"); // was: vˈɛi̯f . nˈʏl . nˈʏl
        expect(say("6,5")).toBe("zˈɛs kˈɔmaː vˈɛi̯f"); // was: zˈɛs , vˈɛi̯f (a spurious pause)
    });

    test("ordinals are written with a LETTER suffix in Dutch (18e / 15de / 60ste)", () => {
        expect(say("de 18e eeuw")).toBe("də ˈɑxtində ˈeːu̯"); // was: ˈɑxtin ˈeː
        expect(say("de 15de eeuw")).toBe("də vˈɛi̯ftində ˈeːu̯"); // was: vˈɛi̯ftin də
        expect(say("zijn 60ste")).toBe("zˈɛi̯n zˈɛstɪxstə"); // was: zˈɛstəx stˈeː
        expect(say("de 1e dag")).toBe("də ˈeːrstə dˈɑx"); // suppletive: eerste, not *eende
        expect(say("het 8e")).toBe("ɦət ˈɑxtstə"); // suppletive: achtste
    });

    test("a bare N. is a SENTENCE PERIOD in Dutch — German's ordinal detector is NOT ported", () => {
        // All 26 `N.` in nl_nl are sentence-final. Claiming them would have eaten 26 pauses.
        expect(say("Dat deed hij in 1979.")).toMatch(/nˈeːɣənənzˈeːvəntəx \.$/u);
        expect(say("de jaren 20.")).toMatch(/tʋˈɪntəx \.$/u);
    });

    test("clock: the dot form (×15) and the colon form (×5); sports times are NOT clocks", () => {
        expect(say("om 12.00 uur")).toBe("ˈɔm tʋˈaːlf ˈyr"); // was: tʋˈaːlf . nˈʏl ˈyr
        expect(say("om 11:35 uur")).toBe("ˈɔm ˈɛlf ˈyr vˈɛi̯fəndərtəx"); // was: ˈɛlf , vˈɛi̯fəndərtəx
        expect(say("om 8.46 uur")).toBe("ˈɔm ˈɑxt ˈyr zˈeːsənvˈeːrtəx"); // "uur" reused, never doubled
        // 4:41:30 is a race time. Without the (?![:\d]) guard the rule claims 4:41 and restarts inside.
        expect(say("een tijd van 4:41:30")).not.toMatch(/ˈyr/u);
        // Three-digit groups stay grouping, and a version/standard number is not an hour.
        expect(say("3.850 kilometer")).toBe("drˈidˈœy̯zənt ˈɑxtɔndərtvɛi̯ftəx kˈiloːmətər");
    });

    test("abbreviations: multi-dot before single-dot, and the dot survives at a phrase end", () => {
        expect(say("bijv. een satelliet")).toBe("bˈɛi̯voːrbeːlt ˈeːn sˈaːtəlit"); // was: bˈɛi̯f .
        expect(say("rond 10.000 v.Chr. was")).toBe("rˈɔnt tˈindœy̯zənt vˈoːr xrˈɪstʏs ʋˈɑs"); // was: f . xr .
        expect(say("uit 5000 v.Chr.")).toMatch(/vˈoːr xrˈɪstʏs \.$/u); // phrase-final: the period is kept
        expect(say("foto's e.d. van")).toBe("fˈoːtɔs ˈɛn dˈɛrɣələkə vˈɑn"); // was: ˈeː . t .
        expect(say("kosmonaut nr. 11")).toBe("kˈɔsmoːnɑu̯t nˈʏmər ˈɛlf"); // was: nr .
        expect(say("St. Petersburg")).toBe("sˈɪnt pˈeːtərsbˈʏrx"); // was: st .
    });

    test("initialisms: dotted capital runs collapse, then the shared pass spells them", () => {
        expect(say("de V.S. met")).toBe("də vˈeː ˈɛs mˈɛt"); // was: f . s . mˈɛt (and the space survives)
        expect(say("de VS en")).toBe("də vˈeː ˈɛs ˈɛn"); // was: fs
        expect(say("de FBI")).toBe("də ˈɛf bˈeː ˈi"); // OOV rule: /fb/ is no Dutch onset
        expect(say("de CEO")).toBe("də sˈeː ˈeː ˈoː"); // lexical: readable, but Dutch spells it
        expect(say("D. K. Arya")).toBe("dˈeː kˈaː ˈaːriaː"); // personal initials
    });

    test("percent, currency and units — Dutch measure nouns are invariant after a numeral", () => {
        expect(say("20% van")).toBe("tʋˈɪntəx prˈoːsənt vˈɑn"); // the sign was DROPPED
        expect(say("$ 1000")).toBe("dˈœy̯zənt dˈɔlɑr"); // the sign was DROPPED
        expect(say("£ 27 miljoen")).toBe("zˈeːvənəntʋˈɪntəx mˈɪljun pˈɔnt"); // magnitude hops
        expect(say("70 km")).toBe("zˈeːvəntəx kˈiloːmətər"); // was the cluster: km
        expect(say("83 km/u")).toBe("drˈiəntˈɑxtəx kˈiloːmətər pˈɛr ˈyr"); // ratio: local rule
        expect(say("3.850 km²")).toBe("drˈidˈœy̯zənt ˈɑxtɔndərtvɛi̯ftəx vˈirkˈɑntə kˈiloːmətər");
        expect(say("30 °C")).toBe("dˈɛrtəx ɣrˈaːdən sˈɛlsiʏs"); // was the bare consonant: s
        // "g" is deliberately NOT a unit — the corpus writes the Wi-Fi standard 802.11g.
        expect(say("802.11g")).not.toMatch(/ɣrˈɑm/u);
    });

    test("signs, ampersand and fractions", () => {
        expect(say("UTC+1")).toBe("ˈy tˈeː sˈeː plˈʏs ˈeːn"); // the + was dropped
        expect(say("Arts & Sciences")).toBe("ˈɑrts ˈɛn sˈinsəs"); // the & was dropped
        expect(say("de P&R")).toBe("də pˈeː ˈɛn ˈɛr"); // single letters: the shared pass cannot see them
        expect(say("1/5 inch")).toBe("ˈeːn vˈɛi̯fdə ˈɪnx"); // was: ˈeːn vˈɛi̯f
    });
});
