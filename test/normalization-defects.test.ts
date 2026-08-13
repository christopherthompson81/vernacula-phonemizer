/**
 * The two discriminators that decide whether a dropped symbol is THIS language's defect.
 *
 * ⚠ WHY THEY EXIST. The artifact scan reported a hard failure for two things that were not Khmer reading gaps: a
 * currency sign inside the ENGLISH half of a bilingual cell (`SGD$8.5 million to build`, with 0 Khmer letters
 * either side), and an `=` whose silence is a refusal argued at length in the language's own file. The first is a
 * fact about English; the second was already recorded in `ACCEPTED_SIGN_SILENCE`, which this scan did not consult —
 * the same inconsistency once present between `coverage.ts` and `review.ts`, one level up.
 *
 * Both are easy to get wrong in the direction of HIDING real defects, so what is pinned here is mostly the
 * negative cases: a sign in the native half of a bilingual line, a line mixing an accepted sign with a read one,
 * a Latin-script language (where the foreign test must be inert), and a missing script (which must fail toward
 * reporting).
 */
import { describe, expect, test } from "vitest";

import { CITED_WORDS, DROPPABLE, LEAK_CLASSES, VOWELLESS_WORDS, acceptedSignClass, allOccurrencesForeign, inForeignSpan, rawLatinIn } from "../tools/normalization/defects.ts";

describe("a symbol in a FOREIGN-language span is not this language's defect", () => {
    // Mined artifacts contain BILINGUAL lines — legitimately, since most of such a line IS the language — and a
    // symbol sitting in the English half of one tests English. km's gate failed on `SGD$8.5 million to build`
    // inside a cell with 0 Khmer letters either side of the sign, which asked the author to source a Khmer reading
    // for English prose. This is the sub-sentence analogue of scripts.ts's whole-segment native filter.
    const KHMER = /\p{Script=Khmer}/u;
    const bilingual = "ឧទ្យាន ប៊ីសេន សាងសង់នៅ។ It was also envisioned as a leisure destination, costing SGD$8.5 million to build";

    test("the English half of a bilingual line is recognised as foreign", () => {
        expect(inForeignSpan(bilingual, bilingual.indexOf("$"), KHMER)).toBe(true);
    });

    test("⚠ a sign in the NATIVE half is NOT foreign, even in the same bilingual line", () => {
        // The discrimination has to be local, or one English clause would excuse every drop in the line. km's
        // `CN¥117,500` sits in a Khmer sentence and remains a genuine, reported gap.
        const khmerSpan = "ជាមួយនឹងចំនួនប្រជាជន ៤១.៥ លាននាក់ ហ្វូជៀន គិតត្រឹមឆ្នាំ២០២១ជីឌីភី របស់ហ្វូជៀននៅ CN¥117,500 (ប្រហាក់ប្រហែល";
        expect(inForeignSpan(khmerSpan, khmerSpan.indexOf("¥"), KHMER)).toBe(false);
    });

    test("ALL occurrences must be foreign — one native-context instance keeps it a defect", () => {
        const mixed = `${bilingual} និងតម្លៃ ១០០$ ក្នុងមួយខែបូកតម្លៃ`;
        expect(allOccurrencesForeign(mixed, /[$]/gu, KHMER)).toBe(false);
        expect(allOccurrencesForeign(bilingual, /[$]/gu, KHMER)).toBe(true);
    });

    test("⚠ it is INERT for a Latin-script language, and must be", () => {
        // There the native script IS Latin, so Latin can never outnumber it — the test cannot fire and a Latin
        // language's drops are all reported, as they must be.
        const en = "The park, costing SGD$8.5 million to build, is one of the largest";
        expect(inForeignSpan(en, en.indexOf("$"), /\p{sc=Latn}/u)).toBe(false);
    });

    test("no native script (thin evidence or a two-script mix) fails toward REPORTING", () => {
        expect(allOccurrencesForeign(bilingual, /[$]/gu, undefined)).toBe(false);
    });
});

describe("a CLASS-level refusal is not a per-line defect either", () => {
    // DROPPABLE is coarse — `math-sign` covers + ± × ÷ = < > — while ACCEPTED_SIGN_SILENCE is per SIGN. The scan
    // consulted the per-instance table but not the per-class one, so km's `=` was simultaneously a documented
    // refusal (1,348 glosses and 1,057 code-shaped against 109 real arithmetic) and a hard scan failure.
    test("km's documented `=` refusal covers a math-sign drop on a line containing only `=`", () => {
        expect(acceptedSignClass("km", "math-sign", "រណបភព(ចក្រវាឡរណប=satellite)របស់វា")).toBe(true);
    });

    test("⚠ a line mixing an accepted sign with a READ one is still a defect", () => {
        // km reads × (គុណ, 46 corpus instances). A line with both must keep reporting, because the × may be the
        // one being dropped — accepting it would hide a real gap behind an unrelated refusal.
        expect(acceptedSignClass("km", "math-sign", "៣×៥ ហើយ ៤=៤")).toBe(false);
    });

    test("a language with no declared class refusal is unaffected", () => {
        expect(acceptedSignClass("cs", "math-sign", "4 = 4")).toBe(false);
    });
});

describe("a citation is sourcing, but only if a reader could go and check it", () => {
    // CITED_WORDS is the `sourcing` gate's only escape hatch, and it exists because a corpus cannot attest how a
    // SYMBOL is spoken: writers type `2.5` and never write out how they say it, so Igbo's `ntụkpọ` scores 0 in a
    // 559k-line dump and is still the right word. The risk is that the hatch becomes a way to quiet the gate, so
    // these tests pin the properties that keep it narrow.
    const entries = Object.entries(CITED_WORDS).flatMap(([lang, ws]) => Object.entries(ws).map(([w, c]) => [lang, w, c] as const));

    test("every citation NAMES ITS SOURCE — a vague one is a TODO in a citation's clothes", () => {
        // "a dictionary" or "standard usage" is not checkable and must not pass review. The test is deliberately
        // crude (length + a named work) because the real check is human; what it forbids is a one-word placeholder.
        for (const [lang, word, cite] of entries) {
            expect(cite.length, `${lang}/${word}`).toBeGreaterThan(80);
            expect(cite, `${lang}/${word}`).toMatch(/\p{Lu}/u);   // a proper noun: the work, the author, or the site
        }
    });

    test("⚠ the cited word is the word, not a description of it", () => {
        // A key here is matched against the needle `review.ts` extracts from the manifest, so a mismatch would
        // silently do nothing — the gate would report the word unattested and the entry would look applied.
        for (const [lang, word] of entries) {
            expect(word.trim(), `${lang}: keys must be bare words`).toBe(word);
            expect(word, `${lang}/${word}`).toMatch(/^[\p{L}\p{M}][\p{L}\p{M}'’ʻ·-]*$/u);
        }
    });

    test("igbo's decimal word is cited, and the citation records that the corpus says nothing", () => {
        const cite = CITED_WORDS["ig"]?.["ntụkpọ"];
        expect(cite).toBeDefined();
        expect(cite).toMatch(/Nkọwa okwu/u);
        // The zero is part of the claim, not an omission from it — see the corpus-silence trap.
        expect(cite).toMatch(/ZERO/u);
    });
});

describe("⚠ a superscript with nothing before it is not an exponent", () => {
    const RE = new Map(DROPPABLE).get("exponent")!;
    const hits = (s: string): string[] => { RE.lastIndex = 0; return [...s.matchAll(new RegExp(RE.source, RE.flags))].map((m) => m[0]); };

    test("isotope notation is not flagged — the superscript is a MASS NUMBER before the element", () => {
        // Yoruba's residual gate failure was one English sentence about carbon isotopes. `normalizeSymbols.ts`
        // is right not to read `⁸C`: its own BARE_EXPONENT requires a base. The class was looser than the reader.
        expect(hits("the shortest-lived of these is ⁸C which decays")).toEqual([]);
        expect(hits("³He and ¹⁴C dating")).toEqual([]);
    });

    test("a real exponent IS flagged, run and all", () => {
        // ⚠ THE WHOLE RUN. A superscript digit is \p{No}, not \p{Nd}, so a per-character pattern anchored on a
        // base matched only the first character of `10¹⁵` and shortened the sign's extent, which changes what the
        // differential drop test compares.
        expect(hits("10¹⁵ formigues")).toEqual(["¹⁵"]);
        expect(hits("250 km²")).toEqual(["²"]);
        // Spaced, as corpora write it — and the negative exponent's run begins with the superscript minus.
        expect(hits("16000km ² of land")).toEqual(["²"]);
        expect(hits("6.67 × 10 −11 N m² kg⁻²")).toEqual(["²", "⁻²"]);
    });

    test("a bare footnote marker with no base is not flagged", () => {
        expect(hits("¹¹ ཚུནི་ཡིས")).toEqual([]);
    });
});

/**
 * RAW ASCII LATIN SURVIVING INTO THE IPA — pinned in BOTH directions, because this class has two ways to be
 * worthless and only one of them is loud.
 *
 * The loud failure is a miss: `km` reaching the IPA in 97 engines with every gate green. The quiet one is the
 * opposite — IPA is written in ASCII Latin, so a detector that is even slightly too eager flags every
 * utterance in the fleet and teaches its reader to skip the line, which is exactly how the scale-names row in
 * `sources.ts` became worthless. Half the tests below are therefore NEGATIVE: strings that contain ASCII
 * letters in the output and MUST NOT fire.
 */
describe("raw ASCII Latin that survived into the IPA", () => {
    test("the defect that started this: a unit abbreviation echoed verbatim", () => {
        // cdo's `baseToIpa` returned its own input and appended a tone letter. The tone letter is why the
        // output token must be stripped of suprasegmentals before it is compared with the source run.
        expect(rawLatinIn("cdo", "2,133 km² gì", "nê˨˦ 2,133 km˥˥ gì˨˦").map((h) => h.run)).toEqual(["km"]);
    });

    test("⚠ ASCII `g` is folded to IPA ɡ, or the class misses the defect in its own brief", () => {
        // ig PRONOUNCED `48 kg` as `iɾi anɔ na asatɔ kɡ`: the engine mapped the ASCII g (U+0067) to the IPA
        // one (U+0261) and left the k alone. `g` is the only ASCII letter that is not itself an IPA symbol,
        // and without the fold a byte-identical comparison reads this line clean.
        expect(rawLatinIn("ig", "48 kg", "iɾi anɔ na asatɔ kɡ").map((h) => h.run)).toEqual(["kg"]);
    });

    test("an English ordinal suffix surviving out of a numeral", () => {
        expect(rawLatinIn("ig", "Nigeria bụ mba 8th nke", "niɡeɾia bu mba 8th nke").map((h) => h.run)).toEqual(["th"]);
    });

    // ── the negative half ──────────────────────────────────────────────────────────────────────────────────

    test("⚠ ordinary IPA full of ASCII letters does NOT fire", () => {
        // The naive `/[A-Za-z]/` test fires on 460 of ig's 460 lines. Every letter here is a genuine IPA
        // symbol and nothing was echoed.
        expect(rawLatinIn("ig", "Enugu dị na Naijiria", "enuɡu di na naid͡ʒiɾia")).toEqual([]);
    });

    test("⚠ a real word that phonemizes to ITSELF does NOT fire", () => {
        // This is why a bare source↔output token differential is useless in a Latin-script language: Igbo
        // `na` (and), `nke` (of) read as themselves, and that rule fires on 96.1% of the ig corpus. The vowel
        // test is what rejects them.
        expect(rawLatinIn("ig", "nke a na ya maka", "nke a na ja maka")).toEqual([]);
    });

    test("⚠ a SYLLABIC-CONSONANT word does NOT fire, and that is the differential's job", () => {
        // Czech `vlk`, Serbian `krv` are vowelless words. A bare "output token with no vowel" rule reports
        // them. Requiring byte-identity with the source rejects them first, because a syllabic reading is
        // never its own spelling. Measured over the fleet: cs, ru, sr all fire zero.
        expect(rawLatinIn("cs", "vlk a krk", "vl̩k a kr̩k")).toEqual([]);
        expect(rawLatinIn("sr", "krv", "kr̩ʋ")).toEqual([]);
    });

    test("a single ASCII letter is never reported", () => {
        // One letter is almost always a genuine phone, and a `k` in the output is not evidence of anything.
        expect(rawLatinIn("ig", "a k na", "a k na")).toEqual([]);
    });

    test("a run the engine actually READ is not a leak, however vowelless the spelling", () => {
        // The differential, not the vowel test, is what says so: the output is not the input.
        expect(rawLatinIn("en", "the km mark", "ðə kɪlˈɑmitɚ mˈɑɹk")).toEqual([]);
    });

    describe("the phonotactic exemption, and the two things it must not do", () => {
        test("a language's own vowelless word is excused — but REPORTED, not dropped", () => {
            // Maltese `fl-` is fi + l- (in the), ×266 in the artifact. `phonotactic: true` makes mine.ts
            // print it under ACCEPTED-, which keeps it visible: a silent exemption is indistinguishable from
            // a clean scan, and that is how this whole class stayed invisible.
            expect(rawLatinIn("mt", "fl-1091 segwita", "fl-1091 seɡwita")).toEqual([{ run: "fl", phonotactic: true }]);
            // Rundi/Kinyarwanda noun-class concords elided before a vowel.
            expect(rawLatinIn("rn", "bw'u Rwanda", "bw u rwanda")).toEqual([{ run: "bw", phonotactic: true }]);
        });

        test("⚠ AN EXEMPT LANGUAGE IS NOT AN EXEMPT LANGUAGE FOR EVERYTHING", () => {
            // mt is both the largest false-positive source in the fleet and a real defect site: `km ×76` sits
            // in the same corpus as `fl ×266`. Conflating the two is how a class becomes worthless.
            expect(rawLatinIn("mt", "620 km mill-fruntiera", "620 km mill-fruntiera").map((h) => h.run)).toContain("km");
            expect(rawLatinIn("mt", "620 km", "620 km").every((h) => !h.phonotactic)).toBe(true);
        });

        test("⚠ a WILDCARD language still reports the metric abbreviations", () => {
            // Berber admits vowelless syllables, so shi's vowelless words are not a closed list and the
            // language is exempted wholesale. That would blind the class to shi's own `km ×32` / `kg ×7`,
            // which is why ALWAYS_REPORTED overrides the wildcard — and only the wildcard.
            expect(rawLatinIn("shi", "gr ungigt", "gr ungigt")).toEqual([{ run: "gr", phonotactic: true }]);
            expect(rawLatinIn("shi", "tjumma nns 8665 km²", "tjumma nns 8665 km").filter((h) => !h.phonotactic).map((h) => h.run)).toEqual(["km"]);
        });

        test("⚠ an explicit word entry OUTRANKS the metric list, and the asymmetry is deliberate", () => {
            // rn's `mw` is the concord mw', stated with its reason. `mw` is also "megawatt". A grammatical
            // fact about a named language beats a general claim about an abbreviation; a wildcard, which says
            // nothing about any particular string, does not.
            expect(rawLatinIn("rn", "mw'ijoro", "mw ijoɾo")).toEqual([{ run: "mw", phonotactic: true }]);
        });

        test("⚠ no entry may name a unit abbreviation — that would be a defect being silenced", () => {
            const listed = Object.values(VOWELLESS_WORDS).flatMap((v) => (v === "*" ? [] : [...v]));
            for (const w of listed) expect(["km", "kg", "mm", "cm", "ml", "kb", "mb", "gb", "ft", "lb", "hz"]).not.toContain(w);
        });
    });

    describe("RAW-CAPS, the half decidable from the output alone", () => {
        const caps = new Map(LEAK_CLASSES).get("RAW-CAPS")!;
        const fires = (ipa: string): boolean => { caps.lastIndex = 0; return caps.test(ipa); };

        test("an uppercase ASCII letter in the IPA is always a leak", () => {
            // hmn passes unreadable words straight through: `Crocodile Dundee`, `United Nations`, `BBC`.
            expect(fires("ʈau̯˧ hau̯˧˦ Hemisphere lu˥")).toBe(true);
        });

        test("⚠ the IPA small capitals are NOT ASCII uppercase and must not fire", () => {
            // ⟨ʀ ɢ ɪ ʏ ʟ ɴ ʙ⟩ are U+0280, U+0262, U+026A, U+028F, U+029F, U+0274, U+0299 — the one reason
            // this class can be a bare regex over the output at all.
            expect(fires("ʀɢɪʏʟɴʙ")).toBe(false);
            expect(fires("paʀi ʁɛɡa")).toBe(false);
        });

        test("ordinary lowercase IPA does not fire", () => {
            expect(fires("enuɡu di na naid͡ʒiɾia")).toBe(false);
        });
    });
});
