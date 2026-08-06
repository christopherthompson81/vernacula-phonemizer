import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/swedish/swedish.ts";
import {
    hundredsYear, normalizeSwedish, normalizeSwedishInitialisms, ordinal,
} from "../src/languages/swedish/normalize.ts";

// Canonical-IPA goldens for Central Standard Swedish (rikssvenska). Phase 2 adds the NST
// pitch-accent + stress lexicon (accent-stress.tsv, CC0): word → accent 1|2 + the primary-stress nucleus. The
// accent-2 grave (combining U+0300) marks the primary-stressed vowel; accent 1 is unmarked. Stress can be
// non-initial (loanwords). OOV words fall to the rules (first-syllable stress; accent by shape). Segmental
// conventions: sje ɧ, tje ɕ, g→j before front, retroflex rt/rd/rn/rs/rl → ʈ/ɖ/ɳ/ʂ/ɭ, geminate → Cː + short V,
// complementary length on the stressed syllable. Monosyllables carry no ˈ / accent. Output is NFD.
describe("swedish canonical IPA", () => {
    test("sje-sound ɧ (sj/skj/stj/sch, sk+front)", () => {
        expect(phonemizeWord("sjö")).toBe("ɧøː");
        expect(phonemizeWord("skjorta")).toBe("ɧˈùːʈa"); // skj → ɧ, rt → ʈ, accent 2 (grave on u)
        expect(phonemizeWord("stjärna")).toBe("ɧˈæ̀ːɳa"); // stj → ɧ, ä-before-r → æː, rn → ɳ, accent 2
        expect(phonemizeWord("själ")).toBe("ɧɛːl");
        expect(phonemizeWord("skön")).toBe("ɧøːn"); // sk + front ö → ɧ
    });

    test("tje-sound ɕ (tj/kj, k+front) + g→j before front", () => {
        expect(phonemizeWord("kött")).toBe("ɕœtː"); // k+ö → ɕ, tt → tː, short ö (monosyllable)
        expect(phonemizeWord("kyrka")).toBe("ɕˈʏ̀rka");
        expect(phonemizeWord("känna")).toBe("ɕˈɛ̀nːa");
        expect(phonemizeWord("göra")).toBe("jˈœ̀ːra"); // g+ö → j, ö-before-r → œː
        expect(phonemizeWord("get")).toBe("jeːt");
        expect(phonemizeWord("gärna")).toBe("jˈæ̀ːɳa");
    });

    test("root keeps hard k/g before a front-vowel inflection (softening is a stressed-onset rule)", () => {
        expect(phonemizeWord("boken")).toBe("bˈuːkɛn"); // bok+en → k stays hard; accent 1 (definite of an A1 noun)
        expect(phonemizeWord("dragen")).toBe("drˈɑ̀ːɡɛn"); // drag+en → g stays hard; accent 2 (participle)
    });

    test("silent word-initial digraphs hj/lj/dj/gj → j (medial = C + j)", () => {
        expect(phonemizeWord("hjul")).toBe("jʉːl");
        expect(phonemizeWord("ljus")).toBe("jʉːs");
        expect(phonemizeWord("djur")).toBe("jʉːr");
        expect(phonemizeWord("miljon")).toBe("mɪljˈuːn"); // medial lj → l + j; stress on 2nd (loanword)
        expect(phonemizeWord("familj")).toBe("famˈɪlj");
    });

    test("retroflex assimilation + final -rg soften", () => {
        expect(phonemizeWord("barn")).toBe("bɑːɳ"); // rn → ɳ
        expect(phonemizeWord("berg")).toBe("bɛrj"); // r + g → r j
    });

    test("complementary length: long-V+short-C vs short-V+geminate-C", () => {
        expect(phonemizeWord("bok")).toBe("buːk"); // open syllable → long o = uː
        expect(phonemizeWord("fisk")).toBe("fɪsk"); // coda cluster → short i
        expect(phonemizeWord("egg")).toBe("ɛɡː"); // geminate gg → ɡː
        expect(phonemizeWord("ligga")).toBe("lˈɪɡːa"); // accent 1 (per NST)
        expect(phonemizeWord("flicka")).toBe("flˈɪ̀kːa"); // ck → kː (geminate, like tt/kk/gg); accent 2
    });

    test("Phase 2 — pitch accent (NST lexicon): accent-2 grave vs unmarked accent 1", () => {
        expect(phonemizeWord("tala")).toBe("tˈɑ̀ːla"); // accent 2 (grave on the stressed vowel)
        expect(phonemizeWord("flicka")).toBe("flˈɪ̀kːa"); // accent 2
        expect(phonemizeWord("bil")).toBe("biːl"); // monosyllable → accent 1, no mark
        expect(phonemizeWord("boken")).toBe("bˈuːkɛn"); // accent 1 polysyllable → no grave
    });

    test("Phase 3 — compound prosody (NST secondary stress): ˌ + boundary-safe length/quality + 2nd-onset softening", () => {
        // The element boundary (stor|stad) makes the first ⟨o⟩ an open syllable → long [uː], not the coda-rule's
        // short [ɔ]; the second element takes secondary stress ˌ and its own length. NST supplies both.
        expect(phonemizeWord("storstad")).toBe("stˈùːʂtˌɑːd"); // stor→uː (not ɔ), stad ˌɑː; rs→ʂ across boundary
        expect(phonemizeWord("storkök")).toBe("stˈùːrɕˌøːk"); // 2nd-onset softening k→ɕ + ö long
        expect(phonemizeWord("järnväg")).toBe("jˈæ̀ːɳvˌɛːɡ");
        expect(phonemizeWord("arbetsplats")).toBe("ˈàrbeːtsplˌats"); // unstressed-but-long ⟨e⟩ kept (NST length set)
        expect(phonemizeWord("barnbok")).toBe("bˈɑ̀ːɳbˌuːk"); // bok→uː secondary
        // vowel-initial second element (björk|ö): the preceding ⟨k⟩ is björk's CODA, stays hard (not ɕ); contrast
        // storkök where ⟨k⟩ is kök's onset and softens. NST's %V marks the vowel-initial second element.
        expect(phonemizeWord("björkö")).toBe("bjˈœ̀rkˌøː");
        expect(phonemizeWord("barnkör")).toBe("bˈɑ̀ːɳɕˌœːr"); // consonant-initial 2nd element → onset k→ɕ still fires
    });

    test("Phase 2 — stress lexicon fixes non-initial (loanword) stress + its vowel quality", () => {
        expect(phonemizeWord("polis")).toBe("pɔlˈiːs"); // stress 2nd → o unstressed short ɔ, i long
        expect(phonemizeWord("station")).toBe("staɧˈuːn"); // -tion stressed
        expect(phonemizeWord("student")).toBe("stɵdˈɛnt");
        expect(phonemizeWord("universitet")).toBe("ɵnɪvɛʂɪtˈeːt"); // stress on the 5th nucleus
        expect(phonemizeWord("europa")).toBe("ɛɵrˈuːpa"); // diphthong ⟨eu⟩ counts 2 nuclei → stress lands past it
    });

    test("Phase 3 — lexical o-quality (NST): stressed ⟨o⟩ is [oː] or [uː]", () => {
        expect(phonemizeWord("telefon")).toBe("tɛlɛfˈoːn"); // lexical [oː] override
        expect(phonemizeWord("kol")).toBe("koːl");
        expect(phonemizeWord("biolog")).toBe("bɪɔlˈoːɡ"); // stressed o → oː; unstressed o stays ɔ
        expect(phonemizeWord("monopol")).toBe("mɔnɔpˈoːl");
        expect(phonemizeWord("adobe")).toBe("adˈoːbɛ"); // loanword silent final ⟨e⟩ is POST-stress → oː still holds
        expect(phonemizeWord("bok")).toBe("buːk"); // default [uː] kept
        expect(phonemizeWord("son")).toBe("suːn");
        expect(phonemizeWord("stor")).toBe("stuːr");
        // Alignment guard: a PRE-stress vowel-count mismatch (NST consonantises ⟨eu⟩ → ne$vrU, shifting the
        // ordinal) withholds the override — conservative uː — rather than land oː on the wrong ⟨o⟩.
        expect(phonemizeWord("neurolog")).toBe("nɛɵrˈuːlɔɡ");
    });

    test("segmental edge cases (é, gn, x, ck geminate, ä-before-r)", () => {
        expect(phonemizeWord("idé")).toBe("ɪdˈeː"); // é → long eː (loanword vowel), stressed via lexicon
        expect(phonemizeWord("kafé")).toBe("kafˈeː");
        expect(phonemizeWord("gnista")).toBe("ɡnˈɪ̀sta"); // word-initial gn → ɡn (not ŋn)
        expect(phonemizeWord("regn")).toBe("rɛŋn"); // coda gn → ŋn
        expect(phonemizeWord("sex")).toBe("sɛks"); // ⟨x⟩ = /ks/ cluster → short vowel
        expect(phonemizeWord("dricka")).toBe("drˈɪ̀kːa"); // ck → kː geminate
        expect(phonemizeWord("tionde")).toBe("tˈìːɔndɛ"); // NOT the -tion suffix (word-initial stem tio-)
        expect(phonemizeWord("är")).toBe("æːr"); // ä-before-r lowering (not a hardcoded ɛːr)
    });

    test("irregular function words", () => {
        expect(phonemizeWord("jag")).toBe("jɑː"); // silent g
        expect(phonemizeWord("och")).toBe("ɔ");
    });

    test("numbers (tens-first compounds; split at thousand/million)", () => {
        expect(phonemize("2", "sv")).toBe("tvoː"); // två
        expect(phonemize("7", "sv")).toBe("ɧʉː"); // sju
        expect(phonemize("21", "sv")).toBe("ɕˈʉ̀ːɡɔɛtː"); // tjugoett
        expect(phonemize("100", "sv")).toBe("ɛtːhˈɵndra"); // etthundra
        expect(phonemize("1000", "sv")).toBe("ˈɛ̀tːɵsɛn"); // ettusen
        expect(phonemize("1000000", "sv")).toBe("ɛn mɪljˈuːn"); // en miljon (unstressed en → ɛn)
    });

    test("numeral tens are accent 2 (compound X+tio; corrects an NST accent-1 quirk)", () => {
        // wikipron ² confirms trettio…åttio are accent 2 like tio/tjugo/nittio; NST inconsistently marked 30–80
        // as accent 1 (fixed in build-sv-lexicon.mts). The grave sits on the stressed first vowel.
        expect(phonemize("30", "sv")).toBe("trˈɛ̀tːɪɔ"); // trettio
        expect(phonemize("50", "sv")).toBe("fˈɛ̀mtɪɔ"); // femtio
        expect(phonemize("80", "sv")).toBe("ˈɔ̀tːɪɔ"); // åttio
    });

    test("text: clause assembly + punctuation", () => {
        expect(phonemize("Jag talar svenska.", "sv")).toBe("jɑː tˈɑ̀ːlar svˈɛ̀nska .");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// #562 TEXT NORMALIZATION (src/languages/swedish/normalize.ts)
//
// These pin the RULE'S BRANCHES, not the corpus's instances (playbook trap 13 (pin the rule's BRANCHES)). The ordinal and the
// hundreds-year composers each have a table branch, a compositional branch and a boundary between them,
// and the corpus exercises only the first — every case below marked ⟨unattested⟩ is there precisely
// because the corpus never writes it.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("swedish text normalization (#562)", () => {
    test("ordinal(): all three branches, plus the unclaimed fallback", () => {
        expect(ordinal(1)).toBe("första"); //          table, suppletive
        expect(ordinal(3)).toBe("tredje"); //          table
        expect(ordinal(16)).toBe("sextonde"); //       table, composed cardinal+de ⟨unattested⟩
        expect(ordinal(19)).toBe("nittonde"); //       table, last entry ⟨unattested⟩
        expect(ordinal(20)).toBe("tjugonde"); //       round tens = cardinal + nde — the branch boundary
        expect(ordinal(37)).toBe("trettiosjunde"); //  tens + table unit (the corpus's largest, 37:e)
        expect(ordinal(40)).toBe("fyrtionde"); //      round tens, compositional only ⟨unattested⟩
        expect(ordinal(91)).toBe("nittioförsta"); //   tens + suppletive unit ⟨unattested⟩
        expect(ordinal(100)).toBe("hundrade"); //      the upper boundary ⟨unattested⟩
        expect(ordinal(137)).toBeUndefined(); //       above it: decline, do not guess an ending
        expect(ordinal(0)).toBeUndefined();
    });

    test("hundredsYear(): the hundreds branch, the tusen branch, and both boundaries", () => {
        expect(hundredsYear(800)).toBe("åttahundra"); //          3-digit: the plain cardinal already is it
        expect(hundredsYear(1000)).toBe("tusen"); //              NOT *tiohundra — the 11th c. is tusentalet
        expect(hundredsYear(1050)).toBe("tusenfemtio"); //        the tusen branch with a remainder ⟨unattested⟩
        expect(hundredsYear(1100)).toBe("elvahundra"); //         the 1100 boundary, hundreds branch begins
        expect(hundredsYear(1400)).toBe("fjortonhundra");
        expect(hundredsYear(1945)).toBe("nittonhundrafyrtiofem"); // hundreds + remainder, one compound
        expect(hundredsYear(1999)).toBe("nittonhundranittionio"); // the upper boundary ⟨unattested⟩
        expect(hundredsYear(2000)).toBeUndefined(); //            20xx keeps the cardinal, deliberately
        expect(hundredsYear(99)).toBeUndefined();
    });

    test("century / decade NNNN-tal — the largest defect (37 corpus instances)", () => {
        // Was: ˈɛ̀tːɵsɛn fˈỳːrahɵndra tˈɑːlɛt — full cardinal style, three words, hyphen dropped.
        expect(normalizeSwedish("1400-talet")).toBe("fjortonhundratalet");
        expect(normalizeSwedish("På 1500-talet.")).toBe("På femtonhundratalet.");
        expect(normalizeSwedish("1900-tal")).toBe("nittonhundratal"); //      the bare -tal form
        expect(normalizeSwedish("1700-talsmarknaden")).toBe("sjuttonhundratalsmarknaden"); // longer compound
        expect(normalizeSwedish("1000-talet")).toBe("tusentalet"); //         the tusen branch
        expect(normalizeSwedish("800-talet")).toBe("åttahundratalet"); //     3-digit branch
        expect(normalizeSwedish("1100-1200-talet")).toBe("elvahundra till tolvhundratalet"); // the range form
        expect(normalizeSwedish("2000-talet")).toBe("2000-talet"); //         declined, not guessed
    });

    test("bare four-digit year takes the hundreds reading — and only 1100–1999", () => {
        expect(normalizeSwedish("år 1945 och")).toBe("år nittonhundrafyrtiofem och");
        expect(normalizeSwedish("1956 flyttade")).toBe("nittonhundrafemtiosex flyttade"); // NO context marker
        expect(normalizeSwedish("norr om 1770. De")).toBe("norr om sjuttonhundrasjuttio. De"); // period KEPT
        expect(normalizeSwedish("år 1000 f.Kr.")).toBe("år 1000 före Kristus."); // 1000 is below the floor
        expect(normalizeSwedish("valet 2010 hade")).toBe("valet 2010 hade"); //  20xx untouched
        // TIER ADJACENCY: wording the numeral would strip the unit the shared symbol tier matches on.
        expect(normalizeSwedish("1300 km av")).toBe("1300 km av");
        expect(phonemize("1 300 km av", "sv")).toContain("ɕɪlɔmˈeːtɛr"); // …and the unit still speaks
        expect(normalizeSwedish("1300 %")).toBe("1300 %");
    });

    test("clock: the PERIOD form Swedish actually writes, and the shapes that are not clocks", () => {
        expect(normalizeSwedish("kl. 20.30")).toBe("klockan 20 30");
        expect(normalizeSwedish("kl.12.00")).toBe("klockan 12 0 0"); // no space; :00 spoken noll noll
        expect(normalizeSwedish("Klockan 01.15")).toBe("Klockan 01 15");
        expect(normalizeSwedish("Mellan 22.00–23.00 MDT")).toBe("Mellan 22 0 0 till 23 0 0 MDT");
        expect(normalizeSwedish("Standarden 802.11n")).toBe("Standarden 802.11n"); // 3 digits before the dot
        expect(normalizeSwedish("se figur 1.1.")).toBe("se figur 1.1."); //         1 digit after it
        expect(normalizeSwedish("priset 1.75")).toBe("priset 1.75"); //             75 is not a minute
    });

    test("clock: the COLON form, and the four other jobs of the Swedish colon", () => {
        expect(normalizeSwedish("klockan 12:00")).toBe("klockan 12 0 0");
        expect(normalizeSwedish("Cirka 11:29 rörde")).toBe("Cirka 11 29 rörde");
        expect(normalizeSwedish("tid på 4:41,30.")).toBe("tid på 4 41,30."); // sports time, not a clock
        expect(normalizeSwedish("och 1:09.02 minuter")).toBe("och 1 09,02 minuter"); // …nor 09.02 inside it
        expect(normalizeSwedish("vara 3:2.")).toBe("vara 3 2."); //                  score
        expect(normalizeSwedish("1:a januari")).toBe("första januari"); //           ordinal
        expect(normalizeSwedish("det 37:e största")).toBe("det trettiosjunde största");
        expect(normalizeSwedish("Elizabeth 2:s")).toBe("Elizabeth andras"); // regnal genitive (II→2 upstream)
        expect(normalizeSwedish("Il-76:or")).toBe("Il-sjuttiosexor"); //     cardinal + plural -or
        expect(normalizeSwedish("Se upp: småstadsbar")).toBe("Se upp: småstadsbar"); // clause colon untouched
    });

    test("no rule touches a digit before a bare period — zero sentence pauses lost", () => {
        // The corpus has 44 `N.` and NONE is an ordinal (39 utterance-final, 4 before a new sentence), which
        // is why the nb/da/de/lb ordinal-dot rule is absent. Pin that it stays absent.
        expect(normalizeSwedish("Cuddeback, 21. Cuddeback var")).toBe("Cuddeback, 21. Cuddeback var");
        expect(normalizeSwedish("5 september 2021. Vissa")).toBe("5 september 2021. Vissa");
        expect(phonemize("Han föddes 1770.", "sv").trimEnd().endsWith(".")).toBe(true);
    });

    test("abbreviation dots: consumed mid-sentence, KEPT where the dot is also the sentence end", () => {
        expect(normalizeSwedish("t.ex. visering")).toBe("till exempel visering");
        expect(normalizeSwedish("t.o.m. en kajak")).toBe("till och med en kajak");
        expect(normalizeSwedish("dvs. 0 eller 1")).toBe("det vill säga 0 eller 1");
        expect(normalizeSwedish("s.k. flikstup")).toBe("så kallad flikstup");
        expect(normalizeSwedish("Truex, Jr. är")).toBe("Truex, junior är");
        expect(normalizeSwedish("Six Flags St. Louis")).toBe("Six Flags Sankt Louis");
        // TERMINAL group: the dot is re-emitted at an utterance end or before a new capitalised sentence.
        expect(normalizeSwedish("templet 323 f.Kr.")).toBe("templet 323 före Kristus.");
        expect(normalizeSwedish("ens arm, etc.")).toBe("ens arm, etcetera.");
        expect(normalizeSwedish("storytelling, etc.)")).toBe("storytelling, etcetera.)"); // closer skipped
        expect(normalizeSwedish("omkring 10000 f.v.t.")).toBe("omkring 10000 före vår tidräkning.");
        expect(normalizeSwedish("år 400 e.Kr. och fortsatte")).toBe("år 400 efter Kristus och fortsatte");
        // INTRODUCER group must NOT gain one, though a capital follows — 4 corpus instances.
        expect(normalizeSwedish("t.ex. Camp David")).toBe("till exempel Camp David");
        expect(normalizeSwedish("dvs. Northern Rock")).toBe("det vill säga Northern Rock");
    });

    test("grouping: space (37) and English comma (9); the genuine decimal is untouched", () => {
        expect(normalizeSwedish("Av 1 400 människor")).toBe("Av fjortonhundra människor");
        expect(normalizeSwedish("5 000 000 unika")).toBe("5000000 unika");
        expect(normalizeSwedish("23,764 kvadratkilometer")).toBe("23764 kvadratkilometer");
        expect(normalizeSwedish("plats med 2,243.")).toBe("plats med 2243."); // NASCAR points, not 2.243
        expect(normalizeSwedish("12,8 km")).toBe("12,8 km"); //      two places: a real decimal, left alone
        expect(phonemize("3,50 meter", "sv")).toContain("kˈɔ̀mːa"); // …and the tokenizer still says komma
    });

    test("ranges (11) are claimed; the five hyphen SCORES are not", () => {
        expect(normalizeSwedish("2-3 km tjock")).toBe("2 till 3 km tjock");
        expect(normalizeSwedish("(1644-1912) styrkor")) //  ranges run BEFORE the year rule, so both ends
            .toBe("(sextonhundrafyrtiofyra till nittonhundratolv) styrkor"); // get the hundreds reading
        expect(normalizeSwedish("(1469 - 1539).")) //                        spaced dash
            .toBe("(fjortonhundrasextionio till femtonhundratrettionio).");
        expect(normalizeSwedish("från 4,2-3,9 miljoner")).toBe("från 4,2 till 3,9 miljoner"); // decimal ends
        expect(normalizeSwedish("Washingtons 5-3-seger")).toBe("Washingtons 5-3-seger"); // score, declined
        expect(normalizeSwedish("mot kanadensaren är 7–2.")).toBe("mot kanadensaren är 7–2.");
        expect(normalizeSwedish("blivit 6-6.")).toBe("blivit 6-6.");
        expect(normalizeSwedish("ett poäng, 21-20, vilket")).toBe("ett poäng, 21-20, vilket"); // comma intact
        // The right operand must not BACKTRACK to one digit and clear the comma test — see step 10.
        expect(normalizeSwedish("21-20,")).not.toContain("till");
        // A bare range with nothing after it IS claimed (the blacklist guard); the whitelist version was not.
        expect(normalizeSwedish("1990-1995")).toBe("nittonhundranittio till nittonhundranittiofem");
    });

    test("degrees, signs, ampersand, multiplication", () => {
        expect(normalizeSwedish("över +30°C")).toBe("över plus 30 grader celsius");
        expect(normalizeSwedish("öster om 35°V.")).toBe("öster om 35 grader väst."); // longitude, not a scale
        expect(normalizeSwedish("(UTC+1) på")).toBe("(UTC plus 1) på"); //            sign after a LETTER
        expect(normalizeSwedish("-5 grader")).toBe("minus 5 grader");
        expect(normalizeSwedish("3+1 gassturbiner")).toBe("3 plus 1 gassturbiner");
        expect(normalizeSwedish("bed & breakfasts")).toBe("bed och breakfasts");
        expect(normalizeSwedish("75,6 cm x 62,2")).toBe("75,6 cm gånger 62,2");
        expect(normalizeSwedish("A = B")).toBe("A lika med B"); // 0 corpus instances; a dropped sign is silent
    });

    test("initialisms: the vowel-less runs are spelled, the words are left to the g2p", () => {
        // The defect class core/initialisms.ts exists for. Before: TV→[tv] DVD→[dvd] BNP→[bnp] GPS→[ɡps].
        expect(phonemize("TV", "sv")).toBe("teː veː");
        expect(phonemize("DVD", "sv")).toBe("deː veː deː");
        expect(phonemize("BNP", "sv")).toBe("beː ɛnː peː");
        expect(phonemize("UTC", "sv")).toBe("ʉː teː seː");
        // G IS THE HARD-G LETTER NAME. `ge` would read [jeː] (the g2p softens ⟨g⟩ before a front vowel, and
        // the referee records `ge → j eː` for the VERB). `gé` gives [ɡeː] only because the manifest's
        // frontVowels excludes `é`; this assertion is what makes that coupling non-silent.
        expect(phonemize("GPS", "sv")).toBe("ɡeː peː ɛsː");
        // W is emitted as TWO tokens so the final `ve` keeps its long vowel.
        expect(phonemize("NSW", "sv")).toBe("ɛnː ɛsː dˈɵbːɛl veː");
        // LEXICAL
        expect(phonemize("USA", "sv")).toBe("ʉː ɛsː ɑː");
        // Pronounceable and unlisted → the OOV g2p reads it as a word, which is the seam's default.
        expect(phonemize("NASA", "sv")).toBe("nˈɑ̀ːsa");
        // …but "left to the OOV g2p" is only safe when the word it produces is a NON-word. `OS` read as
        // [uːs], byte-identical to the ordinary noun *os* ("fumes") — a different real word, which is the
        // confidently-wrong failure, not a bland one. A case-keyed collision between an acronym and a
        // common noun is exactly what `acronymLetters` is for (core/initialisms.ts: `US` vs `us`).
        // The input needs lowercase somewhere: the seam exempts an ALL-CAPS document, and a bare
        // "OS 2012" is indistinguishable from a headline. This is the corpus's own sentence shape.
        expect(phonemize("vid OS 2012 i London", "sv")).toBe("viːd uː ɛsː tvɔtˈʉːsɛn tɔlv iː lˈɔndɔn");
        expect(phonemize("AI", "sv")).toBe("ɑː iː");
        expect(phonemize("USOC", "sv")).toBe("ʉː ɛsː uː seː");
        // THE LOWERCASE NOUN MUST BE UNTOUCHED — the whole point of keying on case.
        expect(phonemize("det luktar os", "sv")).toBe("deː lˈɵ̀ktar uːs");
        // `EU` is deliberately NOT listed: it already reads as its letters, so an entry changes nothing.
        expect(phonemize("EU", "sv")).toBe("ˈèːˌʉː");
        // Letters ATTACHED to digits are an alphanumeric code, not a word.
        expect(phonemize("H5N1", "sv")).toBe("hoː feːm ɛnː ɛtː");
        // ROMAN NUMERALS ARE ALREADY DIGITS by the time this pass runs (registry.ts wraps text() with
        // normalizeRomans, and sv is not in ROMAN_NATIVE). `XV` is the operand that breaks if the order is
        // wrong: as letters it is vowel-less and would be spelled EKS-VE.
        expect(phonemize("Ludvig XV", "sv")).toBe("lˈɵdvɪɡ fˈɛ̀mtɔn");
    });

    test("the colon is an inflectional joint, and it respects the same lexical decision", () => {
        expect(phonemize("USA:s president", "sv")).toBe("ʉː ɛsː ɑːs prɛsɪdˈɛnt");
        expect(phonemize("FN:s", "sv")).toBe("ɛfː ɛnːs");
        expect(phonemize("TV:n", "sv")).toBe("teː veːn");
        // A WORD keeps its word reading and just loses the colon — the check the first draft skipped, which
        // spelled UNESCO:s out letter by letter.
        expect(normalizeSwedishInitialisms("UNESCO:s")).toBe("UNESCOs");
        expect(normalizeSwedishInitialisms("NASA:s chef")).toBe("NASAs chef");
        expect(normalizeSwedishInitialisms("Luno:n hade")).toBe("Lunon hade"); // mixed case
    });

    test("units: bare metre, and the rate denominators that are not standalone-matchable", () => {
        expect(phonemize("100 m och", "sv")).toContain("mˈeːtɛr");
        expect(phonemize("133 m/s", "sv")).toBe("ˈɛ̀tːhɵndratrɛtːɪɔtrɛ mˈeːtɛr peːr sɛkˈɵnd");
        expect(phonemize("160 km/t", "sv")).toContain("peːr tˈɪ̀mːɛ"); // the Swedish variant denominator
        // `s` must NOT match standalone — the Dutch `Il-76s` lesson, and this corpus writes `Il-76:or`.
        expect(phonemize("76 s", "sv")).not.toContain("sɛkˈɵnd");
    });

    // GHz and Mbit were declared, reverted, and restored in review. Undeclared they read as unpronounceable
    // clusters ([ɡhs], [mbiːt s]); declared they read as the right words with ⟨g⟩ softened before a front
    // vowel. That softening is a SYSTEMATIC g2p gap in loanwords — `gitarr` reads [jɪtˈarː] for /ɡɪˈtar/
    // with no tier involved — so the declaration is right and only the g2p is wrong, which also means a
    // later g2p fix repairs these for free. A recognisable word with one wrong segment beats a non-word.
    test("the frequency and bitrate units, and the g2p gap they expose", () => {
        expect(phonemize("2,4 GHz", "sv")).toBe("tvoː kˈɔ̀mːa fˈỳːra jˈìːɡahɛʈs");
        expect(phonemize("600 Mbit/s", "sv")).toBe("sˈɛ̀kshɵndra mˈèːɡabɪt peːr sɛkˈɵnd");
        // The gap, pinned so it is visible rather than folklore: fixing the g2p should change BOTH.
        expect(phonemize("gitarr", "sv")).toBe("jɪtˈarː");
        // `Il-76:or` must not be eaten by the new keys — the Dutch `Il-76s` hazard, in this corpus too.
        expect(phonemize("Il-76:or", "sv")).not.toContain("mˈèːɡabɪt");
    });
});
