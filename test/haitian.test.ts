import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

import { createHaitian, phonemizeWord } from "../src/languages/haitian/haitian.ts";
import { normalizeHaitian } from "../src/languages/haitian/normalize.ts";
import { numberToWords } from "../src/languages/haitian/numbers.ts";

// Haitian Creole (ht) — kreyòl ayisyen, a French-lexified creole of Haiti (~12M). The IPN orthography is
// phonemic, so a greedy scan + the nasal-vowel rule covers it. Referee: wikipron hat_latn_broad (human).
// ⚠ The eval backbone STRIPS the nasal tilde, so the nasal comparison is on the base vowel only — the engine
// does emit ã ɛ̃ ɔ̃, and the referee score says nothing about whether they are right. It is also the only
// referee for ht, so there is no independent second opinion.
describe("Haitian Creole canonical IPA — phonemic IPN g2p + the nasal-vowel rule", () => {
    const ht = createHaitian();

    test("the digraphs + signature consonants: ⟨ou⟩→u, ⟨r⟩→ɣ, ⟨j⟩→ʒ, ⟨ch⟩→ʃ, ⟨y⟩→j", () => {
        expect(phonemizeWord("jou")).toBe("ʒu"); // ⟨j⟩→ʒ, ⟨ou⟩→u ("day")
        expect(phonemizeWord("diri")).toBe("diɣi"); // ⟨r⟩ → ɣ (velar fricative) ("rice")
        expect(phonemizeWord("chwal")).toBe("ʃwal"); // ⟨ch⟩→ʃ, ⟨w⟩→w ("horse")
        expect(phonemizeWord("kreyòl")).toBe("kɣejɔl"); // ⟨r⟩→ɣ, ⟨y⟩→j, ⟨ò⟩→ɔ ("Creole")
    });

    test("the NASAL VOWELS ⟨an en on⟩→[ã ɛ̃ ɔ̃] syllable-finally; oral before a true vowel", () => {
        expect(phonemizeWord("san")).toBe("sã"); // ⟨an⟩ word-final → ã ("blood/without")
        expect(phonemizeWord("bonjou")).toBe("bɔ̃ʒu"); // ⟨on⟩ before [ʒ] → ɔ̃ ("hello")
        expect(phonemizeWord("lang")).toBe("lãɡ"); // ⟨an⟩ before [ɡ] → ã ("tongue/language")
        expect(phonemizeWord("Dominik")).toBe("dominik"); // ⟨n⟩ before a true vowel → oral (no nasal)
        expect(phonemizeWord("machin")).toBe("maʃin"); // ⟨in⟩ does NOT nasalize (only a/e/o) ("machine/car")
    });

    test("nasalization before a GLIDE ⟨y w⟩; the doubled ⟨nn⟩ → nasal + [n]", () => {
        expect(phonemizeWord("anyen")).toBe("ãjɛ̃"); // ⟨an⟩ before glide ⟨y⟩ still nasalizes ("nothing")
        expect(phonemizeWord("anwo")).toBe("ãwo"); // ⟨an⟩ before glide ⟨w⟩ → ã ("up/above")
    });

    test("⟨ou⟩→[u] (not nasal even before ⟨n⟩); ⟨r⟩→[w] before a rounded vowel; geminate collapse", () => {
        expect(phonemizeWord("moun")).toBe("mun"); // ⟨oun⟩ → un (⟨ou⟩ digraph, not nasal) ("person")
        expect(phonemizeWord("granmoun")).toBe("ɡɣãmun"); // ⟨an⟩→ã, ⟨oun⟩→un ("adult/elder")
        expect(phonemizeWord("ayeropò")).toBe("ajewopɔ"); // ⟨r⟩ → w before rounded [o] ("airport")
        expect(phonemizeWord("accoma")).toBe("akoma"); // doubled ⟨cc⟩ → single [k] (a loan)
    });

    test("clause assembly", () => {
        expect(ht.text("Mwen pale kreyòl.").trim()).toBe("mwɛ̃ pale kɣejɔl .");
    });

    // ⚠ THE ELISION IS ONE WORD WHICHEVER APOSTROPHE THE SOURCE TYPES, and the typographic one used to split
    // it. The mined + attested artifacts carry 73 intra-word U+0027 and 13 intra-word U+2019, and two parity
    // rows carry U+2019 (`d’Haïti`, `L’autoportrait`). Both characters are in the word arm now, and the
    // reading must be IDENTICAL across the pair — a stranded [l] or [d] in front of the noun is what the
    // split produced. The intra-word HYPHEN is pinned in the same test because it is the same class of
    // mark and Haitian writes it inside words too (`ki-sa`, `pa-t`).
    test("the elision is ONE token for BOTH apostrophes, and so is a hyphenated word", () => {
        for (const [ascii, typographic] of [
            ["Li l'ap ale", "Li l’ap ale"],
            ["Nou n'ap ale", "Nou n’ap ale"],
            ["Se sa m'ap di", "Se sa m’ap di"],
            ["Mòn Lopital (Morne l'Hôpital)", "Mòn Lopital (Morne l’Hôpital)"],
        ] as const) {
            expect(ht.text(typographic)).toBe(ht.text(ascii));
        }
        expect(ht.text("Li l'ap ale").trim()).toBe("li lap ale"); // one word, not *li l ap ale
        expect(ht.text("Mòn Lopital (Morne l’Hôpital)").trim()).toBe("mɔn lopital moɣne lhopital");
        expect(ht.text("Se pa-t sa l'ap di").trim()).toBe("se pat sa lap di"); // ⟨ki-sa⟩/⟨pa-t⟩ stay whole
        expect(ht.text("Nou n’ap ale nan ki-sa a").trim()).toBe("nu nap ale nã kisa a");
        // A quote mark that is NOT an elision is still dropped rather than read, either way round.
        expect(ht.text("’moun yo").trim()).toBe("mun jo");
        expect(ht.text("moun’ yo").trim()).toBe("mun jo");
    });

    // NUMBERS — the FRENCH VIGESIMAL RESIDUE is kept: 70 swasanndis (60+10), 80 katreven (4×20), 90 katrevendis
    // (4×20+10). The Belgian/Swiss decimal ⟨septante/octante/nonante⟩ forms are NOT Haitian. Source: LDC2017S03
    // "Haitian Creole LSP" §8.1–8.2 (citing Valdman et al. 2007). See haitian.jsonc.
    test("numbers: units, the decade stem alternation, hundreds, thousands, millions", () => {
        expect(numberToWords(7)).toBe("sèt");
        expect(numberToWords(16)).toBe("sèz");
        expect(numberToWords(21)).toBe("venteyen"); // the ⟨t⟩ stem + ⟨eyen⟩ (< French et-un)
        expect(numberToWords(22)).toBe("vennde"); // the ⟨nn⟩ stem before units 2–7
        expect(numberToWords(29)).toBe("ventnèf"); // the ⟨t⟩ stem before units 8–9
        expect(numberToWords(31)).toBe("tranteyen");
        expect(numberToWords(555)).toBe("senk san senkannsenk");
        expect(numberToWords(12345)).toBe("douz mil twa san karannsenk");
        expect(numberToWords(1000000)).toBe("en milyon");
        expect(numberToWords(1000000000)).toBe("en milya");
    });

    test("numbers: the vigesimal 70/80/90 band (NOT septante/octante/nonante)", () => {
        expect(numberToWords(70)).toBe("swasanndis"); // 60 + 10
        expect(numberToWords(71)).toBe("swasannonz"); // 60 + 11
        expect(numberToWords(79)).toBe("swasanndiznèf"); // 60 + 19
        expect(numberToWords(80)).toBe("katreven"); // kat × ven = four twenties
        expect(numberToWords(81)).toBe("katrevenen"); // irregular ⟨en⟩, not *katreveneyen
        expect(numberToWords(90)).toBe("katrevendis"); // 4×20 + 10
        expect(numberToWords(91)).toBe("katrevenonz"); // 4×20 + 11
        expect(numberToWords(99)).toBe("katrevendiznèf"); // 4×20 + 19
    });

    test("numbers: ⟨dis⟩ elides before a magnitude noun (LSP 'di mil', 'di milyon')", () => {
        expect(numberToWords(10000)).toBe("di mil");
        expect(numberToWords(100000)).toBe("san mil");
        expect(numberToWords(10000000)).toBe("di milyon");
    });

    test("numbers read through the g2p", () => {
        expect(ht.text("70").trim()).toBe("swasãndis"); // ⟨ann⟩ → nasal vowel + [n]
        expect(ht.text("99").trim()).toBe("katɣevɛ̃diznɛf"); // ⟨r⟩→ɣ, ⟨en⟩→ɛ̃
        expect(ht.text("22").trim()).toBe("vɛ̃nde"); // ⟨enn⟩ → [ɛ̃n] (contrast a bare ⟨en⟩ → [ɛ̃])
    });
});

// ── TEXT NORMALIZATION (src/languages/haitian/normalize.ts) ────────────────────────────────────────────
// Evidence: tools/corpus/mined/ht.jsonc plus an ht.wikipedia dump (800,158 paragraphs, of which 154,110 are
// Creole — this wiki is 15.1% FRENCH, and every count in normalize.ts is quoted over the Creole subset).
// Full log: docs/investigations/ht/ht_normalization_investigation.md.
describe("Haitian Creole text normalization", () => {
    const ht = createHaitian();

    test("percent, the layer's largest class — `pousan`, postposed", () => {
        // `pousan` x82 in exactly this slot (`Plis pase 90 pousan nan bidje gouvenman an`). ⚠ `pousantaj`
        // x138 is the NOUN "percentage" and is a different word, not an inflection of this one.
        expect(normalizeHaitian("Plis pase 90% nan bidjè")).toBe("Plis pase 90 pousan nan bidjè");
        expect(ht.text("25%").trim()).toBe("vɛ̃nsɛ̃k pusã");
    });

    test("the degree sign does FIVE jobs, and only two of them are a degree", () => {
        // Measured over the 276 `°` in Creole text: coordinate 80, angle 59, scale 57, numero 45, birth 28.
        expect(normalizeHaitian("26 °C")).toBe("26 degre Sèlsiyis"); // the corpus glosses `25 °C (25 degre Sèlsiyis)`
        expect(normalizeHaitian("23°")).toBe("23 degre"); // an angle — `degre latitid` is attested
        expect(normalizeHaitian("Symphonie n°1")).toBe("Symphonie nimewo 1"); // the NUMERO sign, `nimewo` x381
        expect(normalizeHaitian("wout nasyonal N ° 1")).toBe("wout nasyonal nimewo 1"); // spaced variant
        // ⚠ THE BIRTH MARKER of an anniversary list is NOT a degree, and the guard that stops it is the
        // requirement of a DIGIT before the sign — this wiki writes `(° )` x28 for "born".
        expect(normalizeHaitian("aktè fransè (° )")).toBe("aktè fransè (° )");
        expect(normalizeHaitian("(° 1657)")).toBe("(° 1657)");
    });

    test("digit de-grouping in all three conventions the corpus mixes", () => {
        expect(normalizeHaitian("26,338 km2")).toBe("26338 kilomèt kare"); // American comma
        expect(normalizeHaitian("2 470 762 moun")).toBe("2470762 moun"); // French space
        expect(normalizeHaitian("5.002,50")).toBe("5002 vigil 50"); // BOTH in one number, as the corpus writes it
    });

    test("decimals — `vigil`, and a SHORT tail is a number while a long one is spelled out", () => {
        // `vigil` is attested in the decimal sense in four articles, and one of them settles the tail too:
        // `yon rezilta ki gen senkant (,50) apre yon vigil` calls the `,50` *senkant*, i.e. a NUMBER.
        expect(normalizeHaitian("2,50")).toBe("2 vigil 50");
        // Three digits or more has no such citation, so those go one at a time.
        expect(normalizeHaitian("3,14159")).toBe("3 vigil 1 4 1 5 9");
        expect(normalizeHaitian("0.03 pousan")).toBe("0 vigil 0 3 pousan"); // a leading zero is never a number
    });

    test("units are POSTPOSED (Haitian, not Lingala) and hop a magnitude word", () => {
        expect(normalizeHaitian("1 250 257,6 km²")).toBe("1250257 vigil 6 kilomèt kare");
        expect(normalizeHaitian("10.4 milyon km 2")).toBe("10 vigil 4 milyon kilomèt kare"); // magnitude + spaced exponent
        // ⚠ THIS EXPECTATION USED TO BE `9 km/h` UNCHANGED, on the grounds that the per-hour idiom had no
        // Haitian attestation. It has one, in the same meteorological register as every corpus instance:
        // `van ki ap soufle omwen a 120 kilomèt pa èdtan` and `ki sikile a 185 kilomèt pa èdtan` on
        // ht.wikipedia. The half-reading the old comment feared — `9 kilomèt` with a stranded `/h` — is
        // still forbidden, and the way it is forbidden is that the RATE arm claims the whole phrase before
        // any arm that could take the unit on its own.
        expect(normalizeHaitian("9 km/h")).toBe("9 kilomèt pa èdtan");
        expect(normalizeHaitian("(118 km/h)")).toBe("(118 kilomèt pa èdtan)");
    });

    // The template lost every figure in `yon sifas tè km² … pou chak km²`, so the unit stood alone with an
    // exponent on it — invisible to the shared bare-unit pass, whose guard excludes `²³` outright.
    test("a bare exponent unit with no numeral at all", () => {
        expect(normalizeHaitian("yon dansite de abitan pou chak km²")).toBe("yon dansite de abitan pou chak kilomèt kare");
        expect(normalizeHaitian("m³")).toBe("mèt kib");
        // …but a COUNTED one still belongs to the counted arm, number and all.
        expect(normalizeHaitian("605 km ²")).toBe("605 kilomèt kare");
    });

    test("ranges take `a`, ascending only, and a percent span keeps both signs", () => {
        expect(normalizeHaitian("François Duvalier (1907-1971)")).toBe("François Duvalier (1907 a 1971)");
        expect(normalizeHaitian("70-80% Afriken")).toBe("70 a 80 pousan Afriken");
        expect(normalizeHaitian("10%-15% nan salè")).toBe("10 pousan a 15 pousan nan salè");
        // NON-ASCENDING is left alone: `1403-04` is a truncated year span and reads with a different
        // connective, so claiming it would be confidently wrong.
        expect(normalizeHaitian("1403-04")).toBe("1403-04");
    });

    // ⚠ TRAP 58 — a rule that is right in isolation gave up at a full stop. The trailing guard carried a
    // bare `.`, so the rule declined at exactly a sentence end and `1950-1960.` came back untouched: two
    // cardinals with nothing between them. The dot must reject a CONTINUATION of the number, not a clause
    // mark. The COMMA stays rejected outright — this corpus writes the decimal comma (`1 a 1,5m`).
    test("⚠ a clause-final range still takes its joiner (trap 58)", () => {
        expect(normalizeHaitian("1950-1960.")).toBe("1950 a 1960.");
        expect(normalizeHaitian("p. 347–368.")).toBe("paj 347 a 368.");
        expect(normalizeHaitian("788–818!")).toBe("788 a 818!");
        // …and the reasons the dot was there are all kept: a decimal right operand, and a DOI's inner pair,
        // which the lookbehind cannot decline because a `/` precedes it.
        expect(normalizeHaitian("5-13.7")).not.toContain(" a "); // the decimal step reads the tail, not RANGE
        expect(normalizeHaitian("doi:10.1111/1469-8219.00039")).toContain("1469-8219");
        // the comma guard, kept: a decimal right operand written the French way
        expect(normalizeHaitian("1-1,5")).not.toContain(" a ");
    });

    test("currency — `dola`, and the sign is DROPPED when the word is already there (trap 12)", () => {
        expect(normalizeHaitian("$1,800")).toBe("1800 dola");
        expect(normalizeHaitian("$ 120 milyon dola")).toBe("120 milyon dola"); // named twice → say it once
        // ⚠ THE `US` CODE IS RE-EMITTED, not spent with the sign: an earlier version deleted it and
        // `US$200.000` came out as a bare *de san mil* (trap 10).
        expect(normalizeHaitian("US$200.000")).toBe("US 200000");
    });

    test("ORDINAL BRANCHES — the table, the composition, and the boundary between them (trap 13)", () => {
        // The table branch, all corpus-attested spellings:
        expect(normalizeHaitian("1yèm")).toBe("premye"); // suppletive, x6723 — never *enyèm
        expect(normalizeHaitian("4yèm")).toBe("katriyèm");
        expect(normalizeHaitian("17yèm")).toBe("disetyèm"); // x9 attested, and the tail rule reproduces it
        expect(normalizeHaitian("20yèm syèk")).toBe("ventyèm syèk"); // was *ven* + a bare *yèm*
        // The COMPOSITION branch, which the corpus writes only in digits — this is the half a table misses:
        expect(normalizeHaitian("28yèm")).toBe("ventwityèm"); // the attested dizuit→dizwityèm shift, inside a compound
        expect(normalizeHaitian("70yèm")).toBe("swasanndizyèm"); // the vigesimal band: 60+10
        expect(normalizeHaitian("90yèm")).toBe("katrevendizyèm"); // x1 attested — the check on the composition
        expect(normalizeHaitian("145yèm")).toBe("san karannsenkyèm");
        // ⚠ AND THE REFUSAL, which falls out of the same mechanism: `venteyen` ends in `-en`, no attested
        // tail matches, and the rule returns its input rather than inventing *venteyenyèm*.
        expect(normalizeHaitian("21yèm syèk")).toBe("21yèm syèk");
        expect(normalizeHaitian("81yèm")).toBe("81yèm");
        // All three written suffixes, including the French `ème` of this wiki's French half:
        expect(normalizeHaitian("13èm")).toBe("trèzyèm");
        expect(normalizeHaitian("klas 4em")).toBe("klas katriyèm");
        expect(normalizeHaitian("329 èm jou")).toBe("twa san ventnevyèm jou"); // the suffix may be spaced
        expect(ht.text("20yèm").trim()).toBe("vɛ̃tjɛm");
    });

    test("fractions compose through the ordinal, and the cap is what makes the rule safe", () => {
        expect(normalizeHaitian("1/5 lè atmosferik")).toBe("yon senkyèm lè atmosferik"); // `yon senkyèm` attested
        expect(normalizeHaitian("2/3 nan moun")).toBe("2 twazyèm nan moun");
        expect(normalizeHaitian("3/4")).toBe("3 katriyèm"); // the corpus writes this only in words (`twa ka`)
        expect(normalizeHaitian("14/16")).toBe("14/16"); // a chess score — denominator over ten
        expect(normalizeHaitian("Paris, 10/18")).toBe("Paris, 10/18"); // a publisher's collection
    });

    test("identifiers, era markers, page abbreviations and the ampersand", () => {
        // An ISBN is read digit by digit; a 13-digit run used to exceed the engine's number guard and LEAK.
        expect(normalizeHaitian("ISBN 1-58432-005-2")).toBe("ISBN 1 5 8 4 3 2 0 0 5 2");
        expect(ht.text("ISBN 9780829703962").trim()).toBe("isbn nɛf sɛt ɥit zewo ɥit de nɛf sɛt zewo twa nɛf sis de");
        // The era phrase is the corpus's own gloss of its own abbreviation: `anvan Jezi Kris (av. J.-K.)`.
        expect(normalizeHaitian("500 av. J.-C. santèn")).toBe("500 anvan Jezi Kris santèn");
        // ⚠ A SENTENCE-FINAL abbreviation keeps its period, so the pause is not deleted.
        expect(normalizeHaitian("8000 av. J.-C. Des Sit")).toBe("8000 anvan Jezi Kris. Des Sit");
        expect(normalizeHaitian("1976, p. 157-177")).toBe("1976, paj 157 a 177");
        // ⚠ SPACED ON BOTH SIDES: `A&B` deletes to `AB`, one token instead of two (traps 18/26).
        expect(normalizeHaitian("Arends, Muysken & Smith")).toBe("Arends, Muysken ak Smith");
    });

    test("ordinary text survives the layer untouched", () => {
        expect(normalizeHaitian("Mwen pale kreyòl.")).toBe("Mwen pale kreyòl.");
        expect(ht.text("Mwen pale kreyòl.").trim()).toBe("mwɛ̃ pale kɣejɔl .");
        // The clock is deliberately NOT claimed: the majority of colon-numerals here are SCRIPTURE
        // references (`Travay 11:25-26`, `Matye 16:18`), not times.
        expect(normalizeHaitian("Travay 11:25-26")).toBe("Travay 11:25-26");
    });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// A decimal with a letter against it. ⚠ DECLINING IS NOT NEUTRAL — the guard that refused these left the
// separator in place, and the tokenizer then read it as CLAUSE PUNCTUATION. So the "safe" branch emitted a
// full stop in the middle of a phrase AND lost the fractional part's leading zero.
// ⚠ ×0 in the parity golden; the evidence is the mined + attest corpora, where twelve runs put a letter
// against a decimal — six real, six DOI/URL fragments, and all six of the latter already refused by the
// LEADING guard because they sit inside a dotted chain.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
describe("a decimal is still a decimal when a letter touches it", () => {
    const say = (s: string): string => phonemize(s, "ht").trim();

    test("the six the corpus actually writes", () => {
        expect(say("17.09m.")).toBe("disɛt viɡil zewo nɛf m ."); //  was `disɛt . nɛf m .` — and the 0 was gone
        expect(say("1.00mm")).toBe("ɛ̃ viɡil zewo zewo milimɛt");
        expect(say("7.5cm")).toBe("sɛt viɡil sɛ̃k sãtimɛt");
        expect(say("442.7k")).toBe("kat sã kaɣãnde viɡil sɛt k");
        expect(say("1.9pwen")).toBe("ɛ̃ viɡil nɛf pwɛ̃");
        // ⚠ TWO OF THE TWELVE ARE normalize.ts's OWN QUOTED ATTESTATIONS — the file cited these lines as
        // evidence for other rules while they were reading a spurious full stop.
        expect(say("1 a 1,5m")).toBe("ɛ̃ a ɛ̃ viɡil sɛ̃k m");
        expect(say("50cm a 1,80m")).toBe("sɛ̃kãt sãtimɛt a ɛ̃ viɡil katɣevɛ̃ m");
    });

    test("a dotted CHAIN still declines, from either direction", () => {
        expect(say("1.2.3")).toBe("ɛ̃ . de . twa");
        expect(say("jpcl.16.1.07par")).toBe("ʒpkl . sɛz . ɛ̃ . sɛt paɣ"); // a DOI segment — the real shape
    });

    test("a spaced decimal is unmoved, and so is the leading-zero rule", () => {
        expect(say("17.09 m")).toBe("disɛt viɡil zewo nɛf m");
        expect(say("0,4 rebon")).toBe("zewo viɡil kat ɣebɔ̃");
    });
});
