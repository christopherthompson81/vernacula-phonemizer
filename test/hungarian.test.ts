import { describe, expect, test } from "vitest";

import { phonemizeWord, createHungarian } from "../src/languages/hungarian/hungarian.ts";
import { ROMAN_POLICY } from "../src/languages/hungarian/romanOrdinals.ts";
import { getPhonemizer } from "../src/registry.ts";
import { numberToWords } from "../src/languages/hungarian/numbers.ts";
import { loadManifest } from "../src/core/loadManifest.ts";

// Canonical-IPA goldens for Hungarian / magyar (hu) — Uralic, Latin. A regular longest-match g2p: digraphs +
// their geminate forms (ssz→sː, ggy→ɟː) before single letters, then doubled-consonant → Cː, then FIXED
// first-syllable stress. Signature: ⟨s⟩→ʃ / ⟨sz⟩→s (reversed), ⟨gy⟩→ɟ / ⟨ty⟩→c (palatal stops), ⟨a⟩→ɒ, the full
// long/short vowel system; plus REGRESSIVE voicing assimilation (biztat→ˈbistɒt), j-palatalization (feddj→ˈfɛɟː),
// and n→ŋ before k/ɡ. Referees: wikipron hun narrow + epitran.
describe("Hungarian canonical IPA", () => {
    test("the reversed sibilants + palatal stops + ⟨a⟩→ɒ, first-syllable stress", () => {
        expect(phonemizeWord("magyar")).toBe("ˈmɒɟɒr"); // gy → ɟ, a → ɒ, stress on σ1
        expect(phonemizeWord("ország")).toBe("ˈorsaːɡ"); // sz → s, á → aː
        expect(phonemizeWord("szív")).toBe("ˈsiːv"); // sz → s (not ʃ), í → iː
        expect(phonemizeWord("gyerek")).toBe("ˈɟɛrɛk"); // gy → ɟ
        expect(phonemizeWord("kutya")).toBe("ˈkucɒ"); // ty → c
        expect(phonemizeWord("könyv")).toBe("ˈkøɲv"); // ö → ø, ny → ɲ
    });

    test("geminate digraphs + doubled consonants → length", () => {
        expect(phonemizeWord("asszony")).toBe("ˈɒsːoɲ"); // ssz → sː
        expect(phonemizeWord("meggy")).toBe("ˈmɛɟː"); // ggy → ɟː
        expect(phonemizeWord("dzsungel")).toBe("ˈd͡ʒuŋɡɛl"); // dzs → d͡ʒ, n → ŋ before ɡ
    });

    test("assimilations: regressive voicing, j-palatalization, nasal place", () => {
        expect(phonemizeWord("biztat")).toBe("ˈbistɒt"); // z → s before voiceless t
        expect(phonemizeWord("feddj")).toBe("ˈfɛɟː"); // dd + j → ɟː (imperative)
        expect(phonemizeWord("hang")).toBe("ˈhɒŋɡ"); // n → ŋ before ɡ
    });

    test("numbers (one word; 2 → két before a scale)", () => {
        const d = createHungarian();
        expect(d.text("21").trim()).toBe("ˈhusonɛɟ"); // huszonegy
        expect(d.text("200").trim()).toBe("ˈkeːtsaːz"); // kétszáz (két, not kettő)
        expect(d.text("234").trim()).toBe("ˈkeːtsaːzhɒrmint͡sneːɟ"); // kétszázharmincnégy (one word)
        expect(d.text("2000").trim()).toBe("ˈkeːtɛzɛr"); // kétezer
    });
});

// Roman-numeral ORDINAL policy (src/languages/hungarian/romanOrdinals.ts). Hungarian writes the ordinal as a
// Roman numeral FOLLOWED BY A PERIOD (XIX. század) — the period is the ordinal marker, as "-th" is in English.
// No gender and no adjectival agreement, so one form is right in every context. The period itself survives into
// the output as a clause pause; that artefact is pre-existing (see the file header).
describe("Hungarian roman-numeral ordinals", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal?.(n);

    test("ordinal words: első is irregular, compounds are ONE word with the combining unit", () => {
        expect(ord(1)).toBe("első");
        expect(ord(2)).toBe("második");
        expect(ord(19)).toBe("tizenkilencedik");
        expect(ord(21)).toBe("huszonegyedik"); // huszon- + egyedik (not első)
        expect(ord(40)).toBe("negyvenedik");
        expect(ord(50)).toBe("ötvenedik");
        expect(ord(63)).toBe("hatvanharmadik"); // past 50 — anniversary / congress range
        expect(ord(100)).toBe("századik");
        // ⚠ NO RANGE CAP: ordinal formation lives in numbers.ts and is the cardinal with its final morph
        // replaced, so it reaches every value the cardinal compositor does. Asserting `undefined` above some
        // bound would pin a TABLE SIZE — preserving a limitation rather than a behaviour.
        expect(ord(101)).toBe("százegyedik");
        expect(ord(247)).toBe("kétszáznegyvenhetedik");
        expect(ord(1000)).toBe("ezredik");
        expect(ord(2000)).toBe("kétezredik");
    });

    test("context matches the agglutinated century forms (unanchored)", () => {
        for (const w of ["század", "században", "századi", "századtól", "századok", "évszázad", "évezred", "kerület", "évforduló"])
            expect(ROMAN_POLICY.ordinalAfter?.test(w)).toBe(true);
        expect(ROMAN_POLICY.ordinalAfter?.test("szazad")).toBe(false); // needs the á
    });

    test("the ordinal reading phonemizes in context", () => {
        expect(getPhonemizer("hu").text("tizenkilencedik század").trim()).toBe("ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒd");
        // …and through the whole pipeline, from the Roman numeral, with the ordinal period consumed.
        expect(getPhonemizer("hu").text("XIX. század").trim()).toBe("ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒd");
        expect(getPhonemizer("hu").text("ötvenedik évforduló").trim()).toBe("ˈøtvɛnɛdik ˈeːfːorduloː");
    });

    test("a bare roman numeral still reads as a CARDINAL", () => {
        expect(getPhonemizer("hu").text("xix").trim()).toBe("ˈtizɛŋkilɛnt͡s"); // tizenkilenc, not tizenkilencedik
    });
});

// ── Text normalization (src/languages/hungarian/normalize.ts) ──
// Counts in the comments are from the 1,995 unique hu_hu FLEURS utterances (column 3, the cased one).
// Each case below is a form the corpus actually writes; the "was" comment is the pre-change output.
describe("Hungarian text normalization", () => {
    const say = (s: string): string => getPhonemizer("hu").text(s).trim();

    test("bare `N.` is an ordinal before a lowercase word — and NEVER at a sentence end", () => {
        // ×59 lowercase-follows. Was: cardinal + a spurious phrase break (ˈtizɛŋkilɛnt͡s . ˈsaːzɒdbɒn).
        expect(say("a 19. században")).toBe("ˈɒ ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒdbɒn");
        expect(say("a 7. legnagyobb")).toBe("ˈɒ ˈhɛtɛdik ˈlɛɡnɒɟobː");
        expect(say("Az 1000. bélyege")).toBe("ˈɒz ˈɛzrɛdik ˈbeːjɛɡɛ"); // ezer → ezredik, well past any table
        expect(say("alkotmány 247. cikkelye")).toBe("ˈɒlkotmaːɲ ˈkeːtsaːznɛɟvɛnhɛtɛdik ˈt͡sikːɛjɛ");
        expect(say("a 11., 12. és 13. századokban")) // a comma also licenses it
            .toBe("ˈɒ ˈtizɛnɛɟɛdik , ˈtizɛŋkɛtːɛdik ˈeːʃ ˈtizɛnhɒrmɒdik ˈsaːzɒdoɡbɒn");
        // THE CHECK THAT MATTERS: both sentence-final `N.` in the corpus keep their period.
        expect(say("a görkorong és a Forma-1.")).toMatch(/ˈɛɟ \.$/u);
        expect(say("rekordja 7 - 2.")).toMatch(/ˈkɛtːøː \.$/u);
        // …as does a numeral before a capitalised continuation.
        expect(say("az 1. és 2. New Hampshire ezred")).toMatch(/ˈkɛtːøː \./u);
    });

    test("a YEAR before a month name is a cardinal and the period is silent", () => {
        // ×19. Was: ˈɛzɛrkilɛnd͡ʒzaːzhɒtvɒnøt . ˈmaːrt͡siuʃ — an ordinal reading here would be wrong.
        expect(say("1965. március 18-án")).toBe("ˈɛzɛrkilɛnt͡ssaːzhɒtvɒnøt ˈmaːrt͡siuʃ ˈtizɛɲːolt͡sɒdikaːn");
        expect(say("2017. szeptemberében")).toBe("ˈkeːtɛzɛrtizɛnheːt ˈsɛptɛmbɛreːbɛn");
        // …but `N. évi` IS an ordinal, so the month gate has to be a month gate.
        expect(say("a 2000. évi")).toBe("ˈɒ ˈkeːtɛzrɛdik ˈeːvi");
    });

    test("a day number takes the ORDINAL stem, not the cardinal", () => {
        // ×32 hyphen-suffixed dates. Was: ˈtizɛnheːt ˈeːn — *tizenhétén*, two stressed words.
        expect(say("szeptember 17-én")).toBe("ˈsɛptɛmbɛr ˈtizɛnhɛtɛdikeːn");
        expect(say("július 1-jén")).toBe("ˈjuːliuʃ ˈɛlʃɛjeːn"); // suppletive elsej-
        expect(say("január 1-én")).toBe("ˈjɒnuaːr ˈɛlʃɛjeːn");
        expect(say("szeptember 11-e")).toBe("ˈsɛptɛmbɛr ˈtizɛnɛɟɛdikɛ");
        // the bare date nominative computes its own harmony: back -a vs front -e
        expect(say("augusztus 24. és")).toBe("ˈɒuɡustuʃ ˈhusonːɛɟɛdikɛ ˈeːʃ");
        expect(say("március 3. és")).toBe("ˈmaːrt͡siuʃ ˈhɒrmɒdikɒ ˈeːʃ");
    });

    test("a hyphen-attached suffix joins the spoken numeral as ONE word", () => {
        // ×166. Was: ˈɛzɛrɲold͡ʒzaːznɛɟvɛɲːolt͡s ˈbɒn — the suffix as its own stressed word.
        expect(say("1848-ban")).toBe("ˈɛzɛrɲolt͡ssaːznɛɟvɛɲːold͡zbɒn");
        expect(say("1970-es")).toBe("ˈɛzɛrkilɛnt͡ssaːzhɛtvɛnɛʃ");
        expect(say("6500-an")).toBe("ˈhɒtɛzɛrøtsaːzɒn");
        // stem shortening before a vowel-initial suffix: kettő → kett-, hét → het-
        expect(say("2022-es")).toBe("ˈkeːtɛzɛrhusoŋkɛtːɛʃ");
        expect(say("1907-es")).toBe("ˈɛzɛrkilɛnt͡ssaːzhɛtɛʃ");
    });

    test("grouping separators and the decimal comma", () => {
        // Hungarian groups with a SPACE or a PERIOD and takes the COMMA as the decimal mark.
        expect(say("100.000 ember")).toBe("ˈsaːzɛzɛr ˈɛmbɛr"); // was: ˈsaːz . ˈnulːɒ
        expect(say("30 000 ember")).toBe("ˈhɒrmint͡sɛzɛr ˈɛmbɛr"); // was: ˈhɒrmint͡s ˈnulːɒ
        expect(say("3,5 méter")).toBe("ˈhaːrom ˈɛɡeːs ˈøt ˈmeːtɛr"); // was: ˈhaːrom , ˈøt
        // a comma before EXACTLY three digits is the English convention leaking through (3 of 3 in corpus)
        expect(say("100,000 ember")).toBe("ˈsaːzɛzɛr ˈɛmbɛr");
    });

    test("clock, units, rates, exponents, percent, degrees, signs", () => {
        expect(say("10:00 és 11:00 között")).toBe("ˈtiːz ˈeːʃ ˈtizɛnɛɟ ˈkøzøtː"); // zero minutes dropped
        expect(say("11: 20-kor")).toBe("ˈtizɛnɛɟ ˈhuːskor"); // the corpus's spaced colon form
        expect(say("120 km/h")).toBe("ˈsaːzhuːs ˈkilomeːtɛr ˈpɛr ˈoːrɒ"); // was: ˈkm ˈh
        expect(say("19500 km²")).toBe("ˈtizɛŋkilɛnt͡sɛzɛrøtsaːz ˈneːɟzɛtkilomeːtɛr"); // compound prefix
        expect(say("20 km-re")).toBe("ˈhuːs ˈkilomeːtɛrːɛ");
        expect(say("29%-a")).toBe("ˈhusoŋkilɛnt͡s ˈsaːzɒleːkɒ"); // was: the % dropped outright
        expect(say("30°C")).toBe("ˈhɒrmint͡s ˈt͡sɛlʃiuʃ ˈfok"); // was: ˈhɒrmint͡s ˈt͡s
        expect(say("35°-tól")).toBe("ˈhɒrmint͡søt ˈfoktoːl");
        expect(say("UTC+1")).toBe("ˈuː ˈteː ˈt͡seː ˈplus ˈɛɟ");
    });

    test("initialisms: spell the unreadable, leave the readable, glue the suffix", () => {
        expect(say("GPS")).toBe("ˈɡeː ˈpeː ˈɛʃ"); // was: ˈkpʃ
        expect(say("FBI")).toBe("ˈɛf ˈbeː ˈiː"); // was: ˈvbi — F voiced to [v] before B
        expect(say("a GDP-je")).toBe("ˈɒ ˈɡeː ˈdeː ˈpeːjɛ"); // suffix on the LAST letter name
        expect(say("az FBI-nak")).toBe("ˈɒz ˈɛf ˈbeː ˈiːnɒk");
        expect(say("ENSZ")).toBe("ˈɛns"); // readable as a word — the digraph fold is what saves it
        expect(say("USA")).toBe("ˈuʃɒ");
        expect(say("a WC-ben")).toBe("ˈɒ ˈveːt͡seːbɛn"); // lexical: vécé, not *dupla vé cé*
    });

    test("dotted abbreviations lose their interior dot", () => {
        expect(say("mint pl. vírus")).toBe("ˈmint ˈpeːldaːul ˈviːruʃ"); // was: ˈpl . — cluster + break
        expect(say("kb. 20 km-re")).toBe("ˈkørylbɛlyl ˈhuːs ˈkilomeːtɛrːɛ"); // a DIGIT continues too
        expect(say("Kr.e. 356")).toBe("ˈkristuʃ ˈɛløːtː ˈhaːromsaːzøtvɛnhɒt");
        expect(say("Dr. Moll")).toBe("ˈdoktor ˈmolː");
        expect(say("ételek stb.")).toMatch(/ˈʃɒtøbːi \.$/u); // at a phrase end the period is the sentence's
    });

    test("⟨csz⟩ is a morpheme boundary, not the ⟨cs⟩ digraph", () => {
        // 91 corpus numerals have 8 or 9 in a hundreds group. Was: ˈɲold͡ʒzaːz / ˈkilɛnd͡ʒzaːz — the
        // digraph scan took ⟨cs⟩ and voicing then turned the stranded ⟨z⟩ into [d͡ʒz].
        expect(phonemizeWord("nyolcszáz")).toBe("ˈɲolt͡ssaːz");
        expect(phonemizeWord("kilencszáz")).toBe("ˈkilɛnt͡ssaːz");
        expect(phonemizeWord("kilencszer")).toBe("ˈkilɛnt͡ssɛr");
    });

    test("the attributive két before a scale word, at every multiplier ending in 2", () => {
        expect(say("22500")).toBe("ˈhusoŋkeːtɛzɛrøtsaːz"); // was: *huszonkettőezer*
        expect(say("32000")).toBe("ˈhɒrmint͡skeːtɛzɛr");
    });
});

// ⚠ THE PREFIX TABLE HOLDS ONLY WHAT THE COMPOSITOR READS. `tensPrefix` carried a `"10": "tizen"` entry
// beside the twenties one, and nothing could reach it: the teens are authored in FULL in `numbers.teens`,
// which is the table `below100` consults, so replacing the prefix's value with nonsense left every reading
// identical. A mapped key is not a read one — the entry is gone, and this pins both halves.
describe("Hungarian — the teens come from the table, the twenties from the prefix", () => {
    const NUM = loadManifest<{ numbers: { tensPrefix: Record<string, string> } }>(
        new URL("../src/languages/hungarian/hungarian.ts", import.meta.url).href,
        "hungarian.jsonc",
    ).numbers;
    test("only the twenties prefix is declared", () => {
        expect(Object.keys(NUM.tensPrefix)).toEqual(["20"]);
    });
    test("the teens read from `teens`, and the twenties compose from `huszon-`", () => {
        expect(numberToWords(10)).toBe("tíz");
        expect(numberToWords(11)).toBe("tizenegy");
        expect(numberToWords(19)).toBe("tizenkilenc");
        expect(numberToWords(1015)).toBe("ezertizenöt");
        expect(numberToWords(20)).toBe("húsz");
        expect(numberToWords(21)).toBe("huszonegy");
        expect(numberToWords(2012)).toBe("kétezertizenkettő");
    });
});

describe("Hungarian — `mp`, the second, as a unit NUMERATOR", () => {
    const say = (s: string): string => getPhonemizer("hu").text(s).trim();

    test("`mp` reads másodperc, alone and as the head of a rate", () => {
        expect(say("10 mp")).toBe("ˈtiːz ˈmaːʃotpɛrt͡s");
        // The artifact's line: `300 mp/h`. The tier resolved NEITHER half, so the rate arm declined and
        // `ˈmp ˈh` reached the IPA as ASCII. `s` cannot be promoted to fix it — a standalone `s` bites
        // into the corpus's `802.11a`-shaped codes — and `mp` has no such second life.
        expect(say("300 mp/h")).toBe("ˈhaːromsaːz ˈmaːʃotpɛrt͡s ˈpɛr ˈoːrɒ");
    });

    test("the denominator-only keys still compose, and are still denominator-only", () => {
        expect(say("133 m/s")).toBe("ˈsaːzhɒrmint͡shaːrom ˈmeːtɛr ˈpɛr ˈmaːʃotpɛrt͡s");
        expect(say("480 km/h")).toBe("ˈneːcsaːzɲolt͡svɒn ˈkilomeːtɛr ˈpɛr ˈoːrɒ");
    });
});

/**
 * ⟨sch⟩ and ⟨ch⟩ — FOREIGN SPELLINGS Hungarian orthography has no rule for. The scan took ⟨c⟩→[t͡s] then a
 * bare ⟨h⟩, producing *t͡sh*, a sound no reading of these words yields (*charles* → ˈt͡shɒrlɛʃ). 173 tokens
 * across 66 distinct words in the hu_hu corpus, essentially all proper names.
 *
 * ⚠ [t͡ʃ] IS THE MEASURED DEFAULT, NOT THE OBVIOUS ONE. Hungarian's own learned vocabulary reads ⟨ch⟩ as [x]
 * (technológia, hierarchia, jacht), and against the audio that candidate is NET NEGATIVE — 103 rows closer
 * against 149 further. [t͡ʃ] scores 142 closer against 13 further on the 155 rows it changes, and the
 * wikipron referee independently gains 13 words.
 */
describe("Hungarian — the foreign ⟨sch⟩/⟨ch⟩ digraphs", () => {
    test("⟨ch⟩ is [t͡ʃ], not ⟨c⟩ plus a bare ⟨h⟩", () => {
        expect(phonemizeWord("charles")).toBe("ˈt͡ʃɒrlɛʃ");
        expect(phonemizeWord("zachary")).toBe("ˈzɒt͡ʃɒri");
        expect(phonemizeWord("nicholas")).toBe("ˈnit͡ʃolɒʃ");
        // ⚠ ⟨sch⟩ NEEDS ITS OWN ENTRY, ahead of ⟨ch⟩: otherwise the ⟨s⟩ matches alone and Schumacher comes
        //   out ʃt͡ʃ-, two sibilants where the German spelling has one.
        expect(phonemizeWord("schumacher")).toBe("ˈʃumɒt͡ʃɛr");
        expect(phonemizeWord("schneider")).toBe("ˈʃnɛidɛr");
    });

    /**
     * ⚠ THE MORPHEME BOUNDARY. Two native shapes put ⟨c⟩ next to ⟨h⟩, and the digraph must not swallow
     * either — the same failure the ⟨csz⟩ skip in hungarian.ts exists for, found the same way. Every one of
     * the 12 rows that regressed before this guard came from OUR OWN numeral compositor; the corpus text
     * contains no native c+h word at all.
     */
    test("a c-final stem before an h-initial one stays c + h", () => {
        // a numeral compound: harminc + hat, NOT harmin-csat
        expect(phonemizeWord("harminchat")).toBe("ˈhɒrmint͡shɒt");
        expect(phonemizeWord("harminchárom")).toBe("ˈhɒrmint͡shaːrom");
        // the productive allative -hoz/-hez on any c-final noun. Not attested in this corpus; guarded
        // anyway, because a silent regression on ordinary inflection outweighs what the names gain.
        expect(phonemizeWord("archoz")).toBe("ˈɒrt͡shoz");
        expect(phonemizeWord("tánchoz")).toBe("ˈtaːnt͡shoz");
        expect(phonemizeWord("perchez")).toBe("ˈpɛrt͡shɛz");
    });

    test("the native ⟨c⟩ and ⟨cs⟩ readings are untouched", () => {
        expect(phonemizeWord("cukor")).toBe("ˈt͡sukor");
        expect(phonemizeWord("kilenc")).toBe("ˈkilɛnt͡s");
        expect(phonemizeWord("csak")).toBe("ˈt͡ʃɒk");
        expect(phonemizeWord("meccs")).toBe("ˈmɛt͡ʃː");
        expect(phonemizeWord("kilencszáz")).toBe("ˈkilɛnt͡ssaːz"); // the ⟨csz⟩ skip still holds
    });
});
