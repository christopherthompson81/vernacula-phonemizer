/**
 * The en-GB LEXICAL-VARIANT table — the layer that exists because the other five are accent deltas and
 * some British/American differences are not accent at all.
 *
 * ⚠ THE INVARIANT THAT MATTERS IS THE ONE-WAY-NESS. This table may change what en-GB says and must never
 * change what `en` says: CMUdict's `aluminium AH0 L UW1 M IH0 N AH0 M` is a GenAm reference deliberately
 * reading the British SPELLING as the American WORD, which is correct for `en` and is what `en` ships. The
 * defect was that en-GB inherited it with nowhere to say otherwise.
 */
import { describe, expect, it } from "vitest";

import { phonemize } from "../src/index.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";
import { lexicalRows, lexicalVariants, phonemizeWord, phonemizeWordRules } from "../src/languages/english-gb/english-gb.ts";

describe("en-GB lexical variants", () => {
    it("reads aluminium as the British word, not the American one", () => {
        // Five syllables, stress on MIN. The GenAm reading is four with the stress on LU, and no accent
        // rule can travel between them — which is the whole reason this table exists.
        expect(phonemizeWord("aluminium")).toBe("ˌæljʊmˈɪniəm");
    });

    it("leaves the GenAm reading of the same spelling alone", () => {
        // The one-way-ness. `en` keeps CMUdict's row; only the accent variant overrides it.
        // ⚠ THIS ASSERTED A VALUE AGAINST ITSELF and could never fail, so the test named for the GenAm
        // reading pinned nothing about it. The literal is the point.
        expect(phonemize("aluminium", "en")).toBe("əlˈuːmɪnəm");
        expect(phonemize("aluminium", "en")).not.toBe(phonemizeWord("aluminium"));
        expect(phonemize("aluminium", "en")).not.toContain("æljʊ");
    });

    it("is off on the rule-only path, so the referee eval stays non-circular", () => {
        // Same contract the five lexical sets have: phonemizeWordRules is the honest signal, and a table
        // mined from the referee must not be able to flatter a score measured against it.
        expect(phonemizeWordRules("aluminium")).not.toBe(phonemizeWord("aluminium"));
    });

    it("still runs the full accent delta over the substituted citation", () => {
        // clerk is stored `klˈɑːɹk` in the PARENT's alphabet; START + non-rhoticity produce the British
        // form. If the table were storing finished SSBE the rule would be bypassed and this would drift
        // the first time any rhotic rule changed.
        expect(phonemizeWord("clerk")).toBe("klˈɑːk");
        expect(phonemizeWord("herb")).toBe("hˈɜːb");     // NURSE ɝ → ɜː, and Britain keeps the /h/
        expect(phonemizeWord("lever")).toBe("lˈiːvə");   // lettER ɚ → ə
    });

    it("is exempt from the lexical-SET layer, so no set edit runs over its citation", () => {
        // ⚠ THIS USED TO ASSERT THE OPPOSITE — that a variant "takes a lexical-set membership like any
        // other word" — and bought tomato's ɑː back with a hand-added row in en-gb-palm.tsv, a GENERATED
        // file. `build-en-gb-sets.ts` now skips table-owned words, so the next regeneration would have
        // deleted that row and silently regressed the word to təmˈɒtəᶷ. It was never claimable anyway:
        // the builder claims from the rules-only output, where tomato has no ɑː to preserve.
        // The citation is written with the target in mind; a set edit derived for a DIFFERENT word has no
        // business running over it. The PHONOLOGICAL rules still do — hence əᶷ, not oᶷ.
        expect(phonemizeWord("tomato")).toBe("təmˈɑːtʰəᶷ");
        expect(lexicalVariants().has("tomato")).toBe(true);
    });

    it("keeps the parent's allophony, which a hand-written citation has to carry itself", () => {
        // ⚠ THE ROWS REPLACE THE CITATION WHOLESALE, so any allophonic detail the parent emits must be
        // written into the row. Three of them dropped the aspiration diacritic and shipped an unaspirated
        // stop where every comparable word aspirates.
        expect(phonemizeWord("pasta")).toBe("pʰˈæstə");          // cf. passive pʰˈæsɪv
        expect(phonemizeWord("tomato")).toBe("təmˈɑːtʰəᶷ");      // cf. potato pətʰˈeᶦtʰəᶷ
        expect(phonemizeWord("lieutenant")).toBe("lɛftʰˈɛnənt"); // cf. tenant tʰˈɛnənt
    });

    it("owns a lemma's regular inflections, so one sentence cannot say both readings", () => {
        // ⚠ BEFORE THE TABLE, `clerk` AND `clerks` WERE BOTH WRONG AND CONSISTENT. Keying the override on
        // the exact surface word made one right and left the other wrong IN THE SAME SENTENCE, which is
        // more audible than the defect it fixed — `herb`/`herbs` had the /h/ appearing and disappearing.
        // ⚠ AN INFLECTION IS ENTAILED, NOT ATTESTED: the lemma's citation plus the suffix the PARENT
        // produced for that form, so the suffix's voicing is the parent's. The referee covers only
        // `clerks` and `figures` of the nine, and both agree with the entailment — a check, not a source.
        for (const [one, many] of [["clerk", "clerks"], ["herb", "herbs"], ["lever", "levers"],
            ["tomato", "tomatoes"], ["buoy", "buoys"], ["lieutenant", "lieutenants"],
            ["figure", "figures"], ["vitamin", "vitamins"]] as const) {
            expect([many, phonemizeWord(many)]).toEqual([many, `${phonemizeWord(one)}${phonemizeWord(many).slice(phonemizeWord(one).length)}`]);
            expect([many, phonemizeWord(many).startsWith(phonemizeWord(one))]).toEqual([many, true]);
        }
        expect(phonemizeWord("clerks")).toBe("klˈɑːks");   // referee: klɑːks
        expect(phonemizeWord("figures")).toBe("fˈɪɡəz");   // referee: fɪɡəz
    });

    it("swaps LOT for GOAT in process/progress, which no accent rule can do", () => {
        // British /ˈprəʊsɛs/ against GenAm /ˈprɑːsɛs/. The LOT rule turns ɑː into ɒ and there is no rule
        // anywhere that turns either into GOAT, so this is the aluminium case with a smaller footprint.
        // ⚠ THE CITATION IS THE PARENT'S OWN ROW WITH ONE VOWEL SWAPPED — stress, aspiration and the suffix
        // are all the parent's, never hand-invented; see the PROVENANCE file.
        expect(phonemizeWord("process")).toBe("pɹˈəᶷsˌɛs");
        expect(phonemizeWord("progress")).toBe("pɹˈəᶷɡɹɛs");
        expect(phonemize("process", "en")).toBe("pɹˈɑːsˌɛs");   // and `en` is untouched
        expect(phonemize("progress", "en")).toBe("pɹˈɑːɡɹɛs");
    });

    it("refuses progressed/progressing, because the parent already reads them as verbs", () => {
        // ⚠ ENTAILING THESE WOULD HAVE MANUFACTURED A DIFFERENCE RATHER THAN RECORDED ONE. CMUdict stresses
        // the noun on the first syllable and the participles on the second, so the syllable this row's
        // LOT/GOAT swap lives in does not exist in these forms — both varieties say pɹəɡɹˈɛst. The referee
        // has no row for either, which is the check agreeing rather than the reason.
        expect(lexicalVariants().has("progressed")).toBe(false);
        expect(lexicalVariants().has("progressing")).toBe(false);
        expect(phonemizeWord("progressed")).toBe("pɹəɡɹˈɛst");
        expect(phonemizeWord("progressed")).toBe(phonemizeWordRules("progressed"));
    });

    it("guards every row the parent resolves by POS, so a verb frame keeps its verb reading", () => {
        // ⚠ THE SUBSTITUTION IS POS-BLIND AND THE PARENT IS NOT. `progress` is pɹˈɑːɡɹɛs as a noun and
        // pɹəɡɹˈɛs as a verb, and the unguarded row put the NOUN's citation into "we progress quickly"
        // — wrong within one sentence, which is the failure the inflection rows exist to prevent, arriving
        // through the lemma instead. A row may name the GenAm reading it replaces and then applies only
        // when the parent produced it.
        //
        // ⚠ AND THIS SWEEPS RATHER THAN LISTING, because review found `progress` and the SWEEP found
        // `progresses`: english.ts resolves a heteronym's regular -s/-es plural through the SAME entry, so
        // the plural row had the identical defect one word away from the one that was reported.
        const het = MANIFEST.heteronyms;
        const marked = (w: string): boolean => {
            const e = het[w] ?? (w.endsWith("es") ? het[w.slice(0, -2)] : undefined) ?? (w.endsWith("s") ? het[w.slice(0, -1)] : undefined);
            return e !== undefined && (e.verb ?? e.noun ?? e.past ?? e.adj) !== undefined;
        };
        const unguarded = [...lexicalRows()].filter(([w, r]) => marked(w) && r.from === undefined).map(([w]) => w);
        expect(unguarded).toEqual([]);
        // ...and the guard is live, not merely present.
        expect(phonemize("we progress quickly", "en-GB")).toBe(phonemize("we progress quickly", "en"));
        expect(phonemize("she progresses well", "en-GB")).toBe(phonemize("she progresses well", "en"));
        expect(phonemize("the progress is good", "en-GB")).toContain("p\u0279\u02c8\u0259\u1db7\u0261\u0279\u025bs");
    });

    it("takes the three lemmas the SECOND source unblocked, and nothing the binary merely guessed", () => {
        // ⚠ espeak-ng's en-gb voice is admitted as a SECOND UK source, and the bar is a PER-WORD HUMAN
        // DECISION in its dictionary sources — an en_list entry, or a VARIANT-CONDITIONAL en_rules line —
        // not the bare output of the binary, which is a G2P guess of the kind this engine already makes.
        // `schedule`: en_rules:5871 `?3  sch (ed → sk`, marking GENERAL AMERICAN as the exception.
        expect(phonemizeWord("schedule")).toBe("ʃˈɛdjˌuːɫ");
        // `leisure` and `ballet` are PER-WORD PAIRS — en_list:2407/2408 and en_list:1044/1045 — and for
        // `ballet` the pair is the whole evidence: the base row carries NO stress mark, so only the `?3`
        // companion moving it to the second syllable makes it a decision about THIS word.
        expect(phonemizeWord("leisure")).toBe("lˈɛʒə");
        expect(phonemizeWord("leisurely")).toBe("lˈɛʒəli");
        expect(phonemizeWord("leisured")).toBe("lˈɛʒəd");
        expect(phonemizeWord("ballet")).toBe("bˈæleᶦ");
        expect(phonemizeWord("ballets")).toBe("bˈæleᶦz");   // and NOT espeak's bˈaleɪs: its
        // inflections are rule-derived, so the entailment rule outranks the second source on the suffix.
        // ...and `en` is untouched by all of it.
        expect(phonemize("schedule", "en")).toBe("skˈɛd͡ʒˌuːɫ");
        expect(phonemize("leisure", "en")).toBe("lˈiːʒɚ");
        expect(phonemize("ballet", "en")).toBe("bælˈeᶦ");
    });

    it("takes the whole sched- FAMILY, because the evidence is a spelling rule and not a headword", () => {
        // ⚠ `leisure`/`ballet` rest on en_list entries, which are per-word, so they stop at the lemma and
        // its inflections. `schedule` rests on a rule over ⟨sch⟩ before ⟨ed⟩, which fires wherever that
        // sequence appears — so the evidence covers these as fully as it covers the lemma, and stopping
        // short would put "the schedule" beside "the scheduler" with the /ʃ/~/sk/ contrast flipping.
        expect(phonemizeWord("scheduler")).toBe("ʃˈɛdjʊlə");
        expect(phonemizeWord("schedulers")).toBe("ʃˈɛdjʊləz");
        expect(phonemizeWord("unscheduled")).toBe("ənʃˈɛdjuːɫd");
        expect(phonemizeWord("reschedule")).toBe("ɹiʃˈɛdjuːɫ");
        expect(phonemizeWord("rescheduled")).toBe("ɹiʃˈɛdjuːɫd");
        expect(phonemizeWord("rescheduling")).toBe("ɹiʃˈɛdjuːlɪŋ");
        // ⚠ AND `scheduler` KEEPS THE WEAK VOWEL WHERE THE LEMMA HAS uː. Both sources say it really does
        // reduce there — espeak ʃˈɛdjʊlə, wikipron skɛdjələ — so normalising the family to one stem
        // vowel would have been a second wrong answer wearing the first one's clothes.
        expect(phonemizeWord("scheduler")).toContain("ʊ");
        expect(phonemizeWord("schedule")).toContain("uː");
    });

    it("keeps the parent's paradigm consistent rather than overriding it here", () => {
        // ⚠ THE SPLIT WAS OURS. g2p-curated.tsv carried `schedule UH0 → UW2` and left the three inflections
        // behind, so `en` ITSELF said skˈɛd͡ʒˌuːɫ beside skˈɛd͡ʒʊɫd — the wrong-within-one-sentence
        // failure this table exists to prevent, in the PARENT, hidden by an en-GB override. Fixed in the
        // curated layer, so every citation here is the parent's row with ONE rewrite and no stem override.
        for (const w of ["scheduled", "schedules", "scheduling"])
            expect([w, phonemize(w, "en").includes("uː")]).toEqual([w, true]);
        expect(phonemize("scheduled", "en")).toBe("skˈɛd͡ʒˌuːɫd");
        expect(phonemize("scheduling", "en")).toBe("skˈɛd͡ʒuːlɪŋ");
        // ⚠ AND THE PREFIX ENTAILMENT IS RUN OVER THE PARENT'S OWN SUFFIX-CONDITIONED ALLOPHONY, which is
        // now three separate things: FLAPPING (tomato/tomatoes, already documented), L-DARKNESS
        // (\`scheduling\` lightens the prevocalic lateral) and SECONDARY STRESS (\`scheduling\` drops the
        // lemma's ˌ as well). All three are the parent's, which is exactly what makes them not a
        // difference for this table — but a raw \`startsWith\` cannot see any of them.
        const bare = (s: string): string => s.replace(/ɫ/gu, "l").replace(/ˌ/gu, "");
        for (const many of ["schedules", "scheduled", "scheduling"])
            expect([many, bare(phonemizeWord(many)).startsWith(bare(phonemizeWord("schedule")))]).toEqual([many, true]);
        for (const [one, many] of [["leisure", "leisurely"], ["leisure", "leisured"], ["ballet", "ballets"]] as const)
            expect([many, phonemizeWord(many).startsWith(phonemizeWord(one))]).toEqual([many, true]);
    });

    it("owns every word it lists, so the set builder cannot claim one into an accent set", () => {
        // aluminium was in en-gb-yod.tsv: the builder's coronal-yod probe saw `luː` with no yod where the
        // referee attests one and filed it under yod-retention. An accent set claiming a lexical variant
        // is worse than not covering it, because the membership reads as though it had been handled.
        const owned = lexicalVariants();
        expect(owned.has("aluminium")).toBe(true);
        expect(owned.size).toBeGreaterThan(0);
    });

    it("produces a reading for every row it lists", () => {
        // A row whose key never matches — a stray capital, a trailing space — is silently inert, which is
        // exactly the failure this table is meant to fix.
        for (const word of lexicalVariants()) {
            expect(word, `"${word}" is not a bare lowercase headword`).toMatch(/^[a-z]+$/u);
            expect(phonemizeWord(word)).not.toBe(phonemizeWordRules(word));
        }
    });
});
