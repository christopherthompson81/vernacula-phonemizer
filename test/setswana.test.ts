import { describe, expect, test } from "vitest";

import { phonemizeWord, createSetswana } from "../src/languages/setswana/setswana.ts";

// Canonical-IPA goldens for Setswana / Tswana (tn) — Bantu (Sotho-Tswana, S31), Latin orthography, non-click.
// Phonology from the modern sources: Matlhaku (2020, MUN OPL), Zerbian & Kügler (2021, JIPA), Wikipedia, + Cole
// (1955) via Mistry. The greedy longest-match g2p scores 100% folded vs epitran tsn-Latn (tools/referee-eval,
// 1592 words). Vowels are the standard 7-vowel system /i ɪ ɛ a ɔ ʊ u/ (⟨e⟩→ɪ, ⟨o⟩→ʊ, ⟨ê ô⟩→ɛ ɔ). Tone (H/L,
// lexical + unwritten) and the ejective realization (post-nasal/dialectal) are deferred.
describe("Setswana canonical IPA — greedy g2p", () => {
    test("digraph signatures: dorsal aspirates, lateral affricates, sibilants, palatals", () => {
        expect(phonemizeWord("kgomo")).toBe("k͡χʰʊmʊ"); // "cow" — ⟨kg⟩ → k͡χʰ (uvular)
        expect(phonemizeWord("kgosi")).toBe("k͡χʰʊsi"); // "chief" — ⟨kg⟩
        expect(phonemizeWord("tlhogo")).toBe("t͡ɬʰʊχʊ"); // "head" — ⟨tlh⟩ → t͡ɬʰ (+ ⟨g⟩→χ)
        expect(phonemizeWord("tshaba")).toBe("t͡sʰaba"); // "tribe" — ⟨tsh⟩ → t͡sʰ
        expect(phonemizeWord("batswana")).toBe("bat͡swana"); // ⟨ts⟩ → t͡s
        expect(phonemizeWord("motho")).toBe("mʊtʰʊ"); // "person" — ⟨th⟩ → tʰ, ⟨o⟩→ʊ
        expect(phonemizeWord("dijo")).toBe("did͡ʒʊ"); // "food" — ⟨j⟩ → d͡ʒ
    });

    test("the ⟨g⟩ → [χ] uvular divergence (Setswana has no /g/ phoneme; epitran's plain [g] is wrong)", () => {
        expect(phonemizeWord("legodimo")).toBe("lɪχʊdimʊ"); // "sky/heaven" — ⟨g⟩ → χ
        expect(phonemizeWord("segolo")).toBe("sɪχʊlʊ"); // ⟨g⟩ → χ
        expect(phonemizeWord("nyaga")).toBe("ɲaχa"); // ⟨ny⟩ → ɲ AND ⟨g⟩ → χ
    });

    test("palatal/velar nasals; ⟨ny⟩ → ɲ (vs epitran's naive n+glide)", () => {
        expect(phonemizeWord("ngwana")).toBe("ŋwana"); // "child" — ⟨ng⟩ → ŋ
        expect(phonemizeWord("senya")).toBe("sɪɲa"); // ⟨ny⟩ → ɲ
    });

    test("the standard 7-vowel system /i ɪ ɛ a ɔ ʊ u/ (⟨e⟩→ɪ, ⟨o⟩→ʊ; ê/ô → open-mid ɛ/ɔ)", () => {
        expect(phonemizeWord("dumela")).toBe("dumɪla"); // "hello" — ⟨e⟩ → ɪ (near-close)
        expect(phonemizeWord("tsela")).toBe("t͡sɪla"); // "road" — ⟨e⟩ → ɪ
        expect(phonemizeWord("bola")).toBe("bʊla"); // "dice" — plain ⟨o⟩ → ʊ
        expect(phonemizeWord("bôla")).toBe("bɔla"); // "to rot" — ⟨ô⟩ → ɔ (open-mid), minimal pair vs bola
        expect(phonemizeWord("mmele")).toBe("mmɪlɪ"); // "body" — syllabic ⟨m⟩ onset
        expect(phonemizeWord("ntlha")).toBe("nt͡ɬʰa"); // "point" — nasal + ⟨tlh⟩
    });
});

describe("Setswana cardinal numbers (bo-counting series)", () => {
    const tn = createSetswana();
    const say = (s: string) => tn.text(s).replace(/\s+/g, " ").trim();
    test("units, teens, tens, hundreds, thousands compose descending with ⟨le⟩", () => {
        expect(say("1")).toBe("bʊŋwɪ"); // bongwe
        expect(say("8")).toBe("bʊfɪra bʊbɪdi"); // bofera bobedi (two-word)
        expect(say("10")).toBe("lɪsʊmɪ"); // lesome
        expect(say("15")).toBe("lɪsʊmɪ lɪ bʊt͡ɬʰanʊ"); // lesome le botlhano
        expect(say("20")).toBe("masʊmɪ a mabɪdi"); // masome a mabedi
        expect(say("21")).toBe("masʊmɪ a mabɪdi lɪ bʊŋwɪ"); // + le bongwe
        expect(say("100")).toBe("lɪk͡χʰʊlʊ"); // lekgolo
        expect(say("1000")).toBe("sɪkɪtɪ"); // sekete
        expect(say("2025")).toBe("dikɪtɪ t͡sɪ pɪdi lɪ masʊmɪ a mabɪdi lɪ bʊt͡ɬʰanʊ"); // dikete tse pedi …
    });
});

// ── TEXT NORMALIZATION (src/languages/setswana/normalize.ts + the shared symbol tier) ──────────────
//
// ⚠ THESE PIN THE RULES' BRANCHES, NOT THE CORPUS'S INSTANCES (playbook trap 13). Where a rule has a
// lookup and a fallback, or a guard and the shape it must decline, both sides are asserted — including
// shapes tn.wikipedia does not happen to contain, because a table is correct exactly where you looked.
// Every word form asserted here is sourced at its declaration in normalize.ts / setswana.ts; the trail is
// in docs/investigations/tn_normalization_investigation.md.
import { normalizeSetswanaPre, normalizeSetswanaPost } from "../src/languages/setswana/normalize.ts";

describe("Setswana normalization — the symbols a reader says aloud", () => {
    const tn = createSetswana();
    const say = (s: string) => tn.text(s).replace(/\s+/g, " ").trim();
    // The text→text layer, tier included, so an assertion reads as the words a reader would say.
    const words = (s: string) => normalizeSetswanaPost(s);

    test("percent is postposed `mo lekgolong`, the form the corpus glosses against the digits", () => {
        expect(say("77%")).toBe("masʊmɪ a supaŋ lɪ bʊsupa mʊ lɪk͡χʰʊlʊŋ"); // …mo lekgolong
        // the sign on either side of the number, and a decimal operand
        expect(say("2%")).toBe("bʊbɪdi mʊ lɪk͡χʰʊlʊŋ");
        expect(say("88.5%")).toContain("nt͡ɬʰa bʊt͡ɬʰanʊ mʊ lɪk͡χʰʊlʊŋ"); // …ntlha botlhano mo lekgolong
    });

    test("currency: four signs read, the euro deliberately silent", () => {
        expect(say("$5")).toBe("didʊlara di lɪ bʊt͡ɬʰanʊ"); // didolara di le botlhano
        expect(say("US$5")).toBe("didʊlara di lɪ bʊt͡ɬʰanʊ"); // the compound key, or `US` reads as a word
        expect(say("£6")).toBe("dipʊntʊ di lɪ bʊratarʊ"); // diponto di le borataro
        expect(say("P10")).toBe("dipula di lɪ lɪsʊmɪ"); // dipula di le lesome — Botswana
        expect(say("R1 billion")).toContain("diranta di lɪ bʊŋwɪ"); // diranta — South Africa
        // ⚠ THE RAND GUARD, and this branch has no corpus instance on the true side of it: an amount with a
        // separator is money, a bare 1–3 digit integer after `R` is a SOUTH AFRICAN ROAD NUMBER.
        expect(say("R268.26")).toContain("diranta di lɪ"); // separator ⇒ money
        expect(say("tsela ya R59")).not.toContain("diranta"); // bare integer ⇒ the R59 road, left alone
        // €: `diyuro` is ×0 and 5 of 6 `yuro` hits are the UEFA tournament. Silent by decision.
        expect(say("€10")).toBe("lɪsʊmɪ");
    });

    test("units read with the measure noun FIRST and its concord copula", () => {
        expect(say("15 km")).toBe("dikilʊmɪtara di lɪ lɪsʊmɪ lɪ bʊt͡ɬʰanʊ");
        expect(say("650 mm")).toContain("dimilimɪtara di lɪ");
        expect(say("100 m")).toBe("dimɪtara di lɪ lɪk͡χʰʊlʊ");
        expect(say("50 kg")).toContain("dikilʊχɪrama di lɪ");
        // the glued form the corpus writes far more often than the spaced one
        expect(say("200km")).toBe("dikilʊmɪtara di lɪ mak͡χʰʊlʊ a mabɪdi");
        // ⚠ THE BARE CITATION BRANCH — index 0, which the corpus never exercises: a standalone symbol is a
        // citation, not a count, and a dangling copula would be ungrammatical.
        expect(say("km")).toBe("dikilʊmɪtara"); // dikilometara, no copula
    });

    test("the one-letter key `m` does not claim a dotted designation (traps 28/46/52)", () => {
        // The tier's NOT_VERSION guard works by SEEING THE DOT, so this only holds because the decimal rule
        // runs AFTER the tier. Asserted through the real phonemizer, on the shape the guard must reject.
        expect(say("802.11m")).not.toContain("dimɪtara");
        // …and the guard must not cost the ordinary glued decimal measurement
        expect(say("6.5m")).toContain("dimɪtara di lɪ");
    });

    test("squared is preposed `sekwere sa`; cubed is the fused compound, on its own key", () => {
        expect(say("604 km2")).toBe("sɪkwɪrɪ sa dikilʊmɪtara di lɪ mak͡χʰʊlʊ a maratarʊ lɪ bʊnɪ");
        expect(say("1400 km²")).toContain("sɪkwɪrɪ sa dikilʊmɪtara"); // superscript and ASCII both
        // ⚠ THE CUBE IS NOT `exponentWords` — `dikhubikimitara` is *di-khubiki-mitara*, a fused compound
        // whose class prefix migrates to the front, which no ExponentPosition produces.
        expect(say("13 m3")).toBe("dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ");
        expect(say("13 m³")).toBe("dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ");
    });

    test("a rate composes with `ka`, and a denominator is never a standalone unit", () => {
        expect(say("97 km/h")).toBe("dikilʊmɪtara di lɪ masʊmɪ a fɪraŋ bʊŋwɪ lɪ bʊsupa ka ura");
        expect(say("5 m/s")).toBe("dimɪtara di lɪ bʊt͡ɬʰanʊ ka mʊt͡sʊt͡swana");
        expect(say("76s")).not.toContain("mʊt͡sʊt͡swana"); // `Il-76s`, not seventy-six seconds
    });

    test("degrees: the scale letter no longer reaches the g2p as a phoneme", () => {
        // ⚠ BEFORE THIS LAYER, `40 °C` read *masʊmɪ a manɪ K* — the ° dropped and ⟨C⟩ read as [k].
        expect(say("40 °C")).toBe("dikirii t͡sa kɪlkius di lɪ masʊmɪ a manɪ");
        expect(say("5 °F")).toBe("dikirii t͡sa fahrɪnhɪit di lɪ bʊt͡ɬʰanʊ");
        expect(say("26°")).toBe("dikirii di lɪ masʊmɪ a mabɪdi lɪ bʊratarʊ"); // bare/coordinate branch
        // the negative arm — omitting a minus INVERTS, and this is the one context a reading is sourced for
        expect(say("−6 °C")).toBe("dikirii t͡sa kɪlkius t͡sɪ di kwa t͡ɬasɪ χa lɪfɪla di lɪ bʊratarʊ");
        expect(say("-6°C")).toContain("kwa t͡ɬasɪ χa lɪfɪla"); // ASCII hyphen, unspaced — same reading
        // ⚠ AND A RANGE'S SECOND OPERAND IS NOT A NEGATIVE (trap 52: rejected there, the engine starts later)
        expect(say("10-15 °C")).not.toContain("kwa t͡ɬasɪ χa lɪfɪla");
    });

    test("separators: three grouping conventions de-grouped, two decimal marks spelled with `ntlha`", () => {
        expect(say("231,626")).toBe("dikɪtɪ t͡sɪ mak͡χʰʊlʊ a mabɪdi lɪ masʊmɪ a mararʊ lɪ bʊŋwɪ lɪ mak͡χʰʊlʊ a maratarʊ lɪ masʊmɪ a mabɪdi lɪ bʊratarʊ");
        expect(words("1.766")).toBe("1766"); // period grouping
        expect(words("18 443")).toBe("18443"); // space grouping
        expect(words("604.3")).toBe("604 ntlha 3");
        expect(words("3,4")).toBe("3 ntlha 4"); // the comma decimal, 4 instances in the corpus
        // ⚠ THE HEAD-MUST-START-1–9 GUARD is the whole discriminator between the two period roles, and its
        // one corpus counter-example is a LEADING-ZERO decimal, which the third arm then claims.
        expect(words("0.001")).toBe("0 ntlha 0 0 1");
        // ⚠ A FRACTIONAL PART IS READ DIGIT BY DIGIT — reading `75` as a number is a different quantity.
        expect(words("9.75")).toBe("9 ntlha 7 5");
    });

    test("ranges take `go ya go`, ascending only", () => {
        expect(say("15–49")).toBe("lɪsʊmɪ lɪ bʊt͡ɬʰanʊ χʊ ja χʊ masʊmɪ a manɪ lɪ bʊfɪra bʊŋwɪ");
        expect(words("457 - 474")).toBe("457 go ya go 474");
        expect(words("2016-17")).toBe("2016-17"); // a SEASON is descending by construction — declined
        expect(words("40-0")).toBe("40-0"); // a football score — declined
        expect(words("ISBN 1-58479-341-4")).toBe("ISBN 1-58479-341-4"); // a hyphen CHAIN — declined
    });

    test("the clock needs a marker; a sports time never has one", () => {
        expect(words("7:00 p.m.")).toBe("diura di le 7 thapama");
        expect(words("6:19 p.m.")).toBe("diura di le 6 le metsotso e le 19 thapama");
        expect(words("7:00 a.m.")).toBe("diura di le 7 mo mosong");
        expect(words("1:30 mo mosong")).toBe("diura di le 1 le metsotso e le 30 mo mosong"); // re-emitted, not consumed
        // ⚠ 20 of the artifact's 39 colon shapes are SPORTS TIMES and not one carries a marker. A two-digit
        // minute field is not enough to tell them apart — `11:51` passes any `[0-5]\d` shape guard.
        expect(words("11:51")).toBe("11:51");
        expect(words("2:54.47")).toBe("2:54 ntlha 4 7"); // the colon stays a pause; only the decimal reads
        expect(words("01:04:02")).toBe("01:04:02");
        expect(words("UTC+02:00")).toBe("UTC+02:00");
    });

    test("entities are folded before anything else, and `&` is the manifest's own conjunction", () => {
        // ⚠ THE FOLD IS LOAD-BEARING FOR THE UNIT PATH, not just for the ampersand: the entity sits between
        // the number and the thing that has to be adjacent to it.
        expect(say("1400&nbsp;km²")).toContain("sɪkwɪrɪ sa dikilʊmɪtara");
        expect(normalizeSetswanaPre("A&nbsp;B")).toBe("A B");
        expect(say("Food & Agriculture")).toContain(" lɪ "); // ndi/le — spaced both sides
        // ⚠ SPACED, ALWAYS: `B&B` is two initialisms and gluing the word in fuses them into one token.
        expect(words("B&B")).not.toContain("BleB");
    });

    test("the English ordinal suffix is stripped rather than read as a phoneme", () => {
        expect(say("20th")).toBe("masʊmɪ a mabɪdi"); // was *masʊmɪ a mabɪdi TH*
        expect(words("3rd")).toBe("3");
        expect(words("11De")).toBe("11De"); // not an English ordinal — untouched
    });

    test("ordinary Setswana text is untouched", () => {
        const plain = "Lefatshe la Botswana le kwa borwa jwa Aforika, ke lefatshe le le dikaganyeditsweng.";
        expect(normalizeSetswanaPost(normalizeSetswanaPre(plain))).toBe(plain);
        // and a sentence end survives the layer
        expect(say("Ke motse. Ke motse.")).toContain(".");
    });
});
