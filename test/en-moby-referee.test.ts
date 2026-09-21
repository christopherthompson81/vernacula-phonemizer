/**
 * THE DERIVED MOBY REFEREE — what it folds, and what it MUST NOT.
 *
 * ⚠ A REFEREE NORMALISED TOWARD THE THING IT JUDGES IS A MIRROR. This corpus is only usable because the
 * generator draws a line: transcription CONVENTION is folded (Moby spells out what this engine writes as
 * one phone), and PHONOLOGY is not — except in the one case where this engine provably cannot regress.
 * The line is the artifact's entire claim to independence, so it is pinned here rather than left to the
 * generator's comments.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";

const read = (f: string): Map<string, string> => {
    const m = new Map<string, string>();
    for (const l of readFileSync(`tools/referee-eval/referees/${f}`, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, ipa] = l.split("\t");
        m.set(w!, ipa!);
    }
    return m;
};
const lex = read("en.moby-lexicon.tsv");
const oov = read("en.moby-oov.tsv");

describe("the Moby referee corpora", () => {
    test("they are large, disjoint, and one reading per headword", () => {
        expect(lex.size).toBeGreaterThan(30_000);
        // ⚠ 39,485, NOT THE ORIGINAL 57,503: #1344 imported 16,227 of these headwords into the dictionary
        // and the generator now EXCLUDES every imported word from both corpora, because scoring ourselves
        // against Moby on a word whose reading we took from Moby is a mirror. The remainder is the harder
        // residue — gold has no reading for most of it — so its score is not comparable to the pre-import
        // number and the config says so.
        expect(oov.size).toBeGreaterThan(38_000);
        // ⚠ DISJOINT BY CONSTRUCTION: the split IS "does g2p-dict.tsv carry this word", which is what makes
        // the second file a referee for the OOV tier rather than a second opinion on the lexicon.
        expect([...lex.keys()].filter((w) => oov.has(w))).toEqual([]);
    });

    // ⚠ THE NON-RHOTIC EXCLUSION IS PINNED HERE BECAUSE A REGEX EDIT MOVES HUNDREDS OF ROWS SILENTLY,
    // and because the line it draws is the subtle one in this file: RP is dropped, a LOANWORD is not.
    // Moby writes `afterwards` as æftəwədz because the transcription is BRITISH — we say the /r/. It
    // writes `dossier` as dɑsieɪ because the ⟨r⟩ is silent in GenAm too, we read it r-less as well, and
    // the row passes. The discriminator is OUR OWN reading, not the spelling: a spelling test exempted
    // `pliers` (ours `P L AY1 ER0 Z`) and `messier` — where Moby has the ASTRONOMER and our headword is
    // the comparative of `messy`.
    test("RP rows are dropped and GenAm-silent loanwords are kept", () => {
        for (const w of ["afterwards", "backwards", "bifurcate", "binoculars", "comfortable",
            // ⚠ THE `-ered` FAMILY IS THE LARGEST CLASS AND THE FIRST RULE ALONE MISSES IT: the ⟨e⟩
            // after the ⟨r⟩ is a vowel LETTER even when silent, so the coda lookahead rejects the word.
            "battered", "coloured", "chambered", "unanswered", "tattered",
            // ⚠ AND AN ONSET /ɹ/ SHIELDS A NON-RHOTIC CODA unless the test looks at the TAIL only.
            "particolored"])
            expect([lex.has(w), oov.has(w)]).toEqual([false, false]);
        // Kept: we are r-less here too, so these are not RP and they score.
        expect(lex.get("dossier")).toBe("dɑsieɪ");
        expect(lex.get("boucher")).toBe("buʃeɪ");
        // ⚠ AND THESE WERE EXEMPTED BY A SPELLING RULE AND SHOULD NOT HAVE BEEN — our reading is rhotic,
        // so the row can never pass and is RP readmitted by hand.
        for (const w of ["pliers", "messier", "tourniquet", "angers"])
            expect([lex.has(w), oov.has(w)]).toEqual([false, false]);
    });

    // ⚠ THE THIRD NON-RHOTIC RULE, MISSING UNTIL #1370. The first two ask whether a reading holds a
    // rhotic AT ALL, or holds one in its last three symbols; neither reaches a word whose only rhotic
    // is some other syllable's ONSET. 50 rows of RP survived on that, every one a permanent false
    // disagreement where the REFEREE was wrong.
    test("RP masked by an onset r elsewhere in the word is dropped too", () => {
        for (const w of ["crackers", "overdrive", "adversarial", "weatherproof", "perchlorate",
            "rubberneck", "superscript", "rightward", "afterwards"])
            expect([w, lex.has(w), oov.has(w)]).toEqual([w, false, false]);
    });

    // ⚠ THE MIXED PROFILE, WHICH THIS TEST PINNED AS UNREACHABLE UNTIL #1378 ITEM 5. Rules 1–3 ask
    // whether a reading holds a rhotic ANYWHERE, so a word Moby transcribes with one ⟨r⟩ dropped and
    // another kept survived all of them. The old comment here said the class "needs a POSITIONAL test,
    // which nothing here can do because no alignment exists between the spelling's ⟨r⟩ and the
    // reading's phones" — and that was the wrong shape of answer. **It needs a COUNT, not an
    // alignment**: two coda ⟨r⟩ in the spelling against one coda rhotic in the reading means one was
    // dropped, and which one does not matter. 26 rows left the corpus.
    test("a mixed rhotic profile is now reached", () => {
        for (const w of ["undercover", "northern", "hindquarters", "starboard", "overcharge", "surveyor"])
            expect([w, lex.has(w), oov.has(w)]).toEqual([w, false, false]);
    });

    // ⚠ AND THE COUNT ALONE OVER-FIRES, WHICH IS WHY IT IS GATED ON OUR OWN READING. `Worcester` is
    // "Wooster" — its first ⟨r⟩ is silent in GenAm too, so our `W UH1 S T ER0` carries one coda rhotic
    // for two spelled ⟨r⟩ and Moby agreeing with us is not RP. `catercorner` is "cati-corner" the same
    // way. Both match the count and both must survive; this is the discriminator the file's French note
    // already named, used for a second purpose.
    test("a spelled r that is silent in GenAm too is not RP", () => {
        // ⚠ BOTH CASES MUST BE IN THE *LEXICON* CORPUS. `catercorner` was here first and proved nothing:
        // it lives in the OOV file, where `ourArpabet.get(w)` is `undefined` by construction and rule 4
        // never fires at all — so that assertion passed with the discriminator deleted. A test of a gate
        // has to be a row the gate can actually reach.
        expect(lex.get("worcester")).toBe("wʊstɚ");
        expect(lex.has("worcester")).toBe(true);
    });

    // ⚠ AND ONE ROW THE COUNT WOULD HAVE DROPPED FOR THE WRONG REASON. `thermometer`'s only Moby body
    // spells THERMOMETRIC; dropping it as RP would be the right outcome on a false premise, and a later
    // change to the rhotic rule would hand it back. Declared in MOBY_DEFECTIVE instead.
    test("a displaced body is declared, not left to the rhotic count", () => {
        expect([lex.has("thermometer"), oov.has("thermometer")]).toEqual([false, false]);
    });

    // ⚠ AND A SILENT ⟨w⟩ AFTER THE ⟨r⟩ IS NOT A CODA. `Berwick`, `Norwich` and `bladderwrack` spell
    // ⟨rw⟩/⟨wr⟩ with the ⟨w⟩ silent, so the ⟨r⟩ onsets the next syllable and the readings are ordinary
    // GenAm. The first version of the rule above dropped all three.
    // ⚠ THE CARVE-OUT IS ON THE READING, NOT THE SPELLING, and that distinction is the whole rule: 205
    // headwords spell ⟨rw⟩ and a blanket spelling exemption would readmit `afterwards`, `airway` and
    // `bitterweed` — the largest RP class in the corpus. If no reading has a /w/, the ⟨w⟩ is silent.
    test("a silent w does not make an onset r look like a missing coda", () => {
        expect(lex.get("berwick") ?? oov.get("berwick")).toBe("bɛɹɪk");
        expect(lex.get("norwich") ?? oov.get("norwich")).toBe("nɔɹɪt͡ʃ");
        expect(oov.get("bladderwrack") ?? lex.get("bladderwrack")).toBe("blædəɹæk");
        // the ⟨w⟩ IS pronounced here, so these stay subject to the rule
        expect(lex.get("airway") ?? oov.get("airway")).toBe("ɛɹweɪ");
        expect([lex.has("afterwards"), oov.has("afterwards")]).toEqual([false, false]);
    });

    // ⚠ A ROW WHOSE BODY IS A DIFFERENT WORD CANNOT ARBITRATE ANYTHING, so MOBY_DEFECTIVE drops it from
    // both corpora. Pinned because the list is hand-curated and silence is how it would rot.
    test("defective rows reach neither corpus", () => {
        for (const w of ["gorbachev", "carr", "pathology", "workbasket", "sleipnir", "monosaccharide",
            "thermometer"])
            expect([lex.has(w), oov.has(w)]).toEqual([false, false]);
    });

    // ⚠ A CORRUPT READING BESIDE A CORRECT ONE IS INVISIBLE TO EVERY OTHER TEST IN THIS FILE, because
    // the row goes on passing on its good reading. `corporation` shipped `kɔɹpɚeɪʃən` AND `bʊŋɡi` for
    // four blocks with nothing noticing. These assertions are the only thing standing between that
    // class and a silent return.
    test("a headword's corrupt reading is dropped and its sound one kept", () => {
        for (const [w, keep, gone] of [
            // ⚠ `kɔɹpəɹeɪʃən`, NOT `kɔɹpɚeɪʃən`. Moby writes `,k/O/rp/@/'r/eI//S//@/n` — its own stress
            // mark puts the `r` at the head of the stressed syllable, so it is that syllable's onset
            // and not a rhotic nucleus. This read `ɚ` until the rhotic join was guarded; see the
            // JOIN comment in build-en-moby-referee.mts.
            ["corporation", "kɔɹpəɹeɪʃən", "bʊŋɡi"],     // body is 'Bungee'
            ["city", "sɪti", "boʊʒɚ"],                    // body is 'Bougère'
            ["county", "kaʊnti", "bəlɑhi"],               // Moby's own `Bellaghy`, byte-identical
            ["rouse", "ɹaʊz", "ɹɔss"],                    // Moby's own `Ross` with a doubled ⟨s⟩
            ["soufriere", "sufɹiɛɹ", "saʊ"],              // Moby's own `Sau`, byte-identical
            ["cahill", "kɑhɪl", "keɪl"],                  // Moby's own `kale`/`kail`
            ["peak", "pik", "kɔɹkoʊvɑdoʊ"],               // body is 'Corcovado'
            ["plateau", "plætoʊ", "bəloʊvɛns"],           // body is 'Bellovens'
            ["vineyard", "vɪnjɚd", "d͡ʒumɑɹɑ"],            // body is 'Jumara'
            ["wellington", "wɛlɪŋtən", "wiɡjɪn"],
            ["college", "kɑlɪd͡ʒ", "kjukʊ"],
            ["junta", "hʊntə", "huntæn"],
            ["zed", "zɛd", "zɛdəkaɪə"],                   // body is 'Zedekiah'
            ["bey", "beɪ", "ɑzzəddinbeɪ"],                // 'Azzeddin Bey', space lost
            ["luce", "lus", "dəlus"],                     // 'De Luce', space lost
            ["quoin", "kɔɪn", "dukoʊjn"],                 // 'Du Coyne', space lost
            ["somali", "səmɑli", "soʊmæi"],               // the /l/ dropped
            ["began", "bɪɡæn", "biæn"],                   // the /ɡ/ dropped
            ["crises", "kɹaɪsiz", "kɹiz"],
            ["messieurs", "mɛsɚz", "mɛsjɚɹ"],             // a doubled ⟨rr⟩ coda
            // ⚠ `swəɹɑd͡ʒ` for the same reason as `corporation`: Moby's `sw/@/'r/A//dZ/` marks the `r`
            // as the stressed syllable's onset. The dropped reading `sw/@/'r/A/r/dZ/` has a SECOND,
            // intrusive /r/ after the vowel, which is what makes it the corrupt one.
            ["swaraj", "swəɹɑd͡ʒ", "swəɹɑɹd͡ʒ"],
            ["duralumin", "dʊɹæljəmɪn", "dd͡ʒʊɚæljʊmɪn"],  // a stray `d/dZ/` onset
        ] as const) {
            const row = lex.get(w) ?? oov.get(w);
            expect([w, row]).toEqual([w, keep]);
            expect(row).not.toContain(gone);
        }
    });

    // ⚠ CASE DOES NOT SAY WHICH READING IS THE BAD ONE, and an earlier version of this test said it did
    // — it listed `rouse` here, where the corrupt row is the CAPITALISED `Rouse r/O/ss`. The assertion
    // passed and the heading was wrong, which is the worse of the two failures. For these the
    // lower-case row really is the corrupt one and the capital is right, so no case rule can work.
    test("the corrupt reading is not always the capitalised one", () => {
        expect(lex.get("toy") ?? oov.get("toy")).toBe("tɔɪ");                 // not `toʊj`
        expect(lex.get("whitehead") ?? oov.get("whitehead")).toBe("waɪthɛd"); // not `waɪθɛd`
        expect(lex.get("early") ?? oov.get("early")).toBe("ɚli");             // not `iɹli`
    });

    // ⚠ A WORD WHOSE EVERY READING IS DEFECTIVE LEAVES THE CORPUS, and that is the right outcome rather
    // than a loss. Moby's `Watergate 'w/A/t/@/,g/eI/t` is non-rhotic RP and its `watergate
    // 'w/oU/rt/@/,g/eI/t` metathesises the /r/ to before the ⟨t⟩; with the second declared, the first
    // is all that is left and the non-rhotic filter takes it. Neither could arbitrate a GenAm reading.
    test("a headword with no sound reading left is dropped entirely", () => {
        expect([lex.has("watergate"), oov.has("watergate")]).toEqual([false, false]);
    });

    // ⚠ MOBY WRITES THE AFFRICATE TWO WAYS AND THE REFEREE USED TO PRESERVE BOTH — `/tS/` 7,519 times
    // and a bare `t`+`/S/` 257 more, which reached the corpus as `t͡ʃ` and `tʃ`: the same Moby sound
    // rendered two different ways depending on which notation the row happened to use. That is an
    // internal inconsistency in the artifact whether or not the backbone fold currently hides it.
    // ⚠ AND THE SEAMS MUST SURVIVE IT. Unlike bare `sh`, the adjacent side is MIXED — 14 real /t/+/ʃ/
    // boundaries are written adjacent, so folding on adjacency alone would destroy them.
    test("Moby's two spellings of the affricate agree, and a /t/+/ʃ/ seam is not one of them", () => {
        for (const w of ["aquaculture", "belcher", "bicultural", "cheesy", "beechmast", "cesarevitch"])
            expect([w, (lex.get(w) ?? oov.get(w))?.includes("t͡ʃ")]).toEqual([w, true]);
        // a seam keeps two phones — spelled ⟨tsh⟩, ⟨tesh⟩, or separated in the body
        for (const [w, ipa] of [["courtship", "kɔɹtʃɪp"], ["nutshell", "nʌtʃɛl"],
            ["sweatshirt", "swɛtʃɚt"], ["wiltshire", "wɪltʃiɹ"], ["mateship", "meɪtʃɪp"],
            ["associateship", "əsoʊʃiətʃɪp"], ["buteshire", "bjutʃiɹ"],
            ["nightshade", "naɪtʃeɪd"], ["hotshot", "hɑtʃɑt"], ["outshine", "aʊtʃaɪn"]] as const)
            expect([w, lex.get(w) ?? oov.get(w)]).toEqual([w, ipa]);
        // ⚠ THE ONES AN `sh`-ANYWHERE TEST GETS WRONG. `pushchair` and `shakuhachi` spell ⟨sh⟩ somewhere
        // ELSE while their `t/S/` is an ordinary affricate; they are why the rule requires the ⟨t⟩ WITH
        // the ⟨sh⟩ rather than ⟨sh⟩ alone. (`chafing-dish` is the third and is not asserted here — its
        // Moby body is truncated to just `chafing`, so it is a defective row, not a clean example.)
        for (const [w, ipa] of [["pushchair", "pʊʃt͡ʃɛɹ"], ["shakuhachi", "ʃʌkʊhʌt͡ʃi"]] as const)
            expect([w, lex.get(w) ?? oov.get(w)]).toEqual([w, ipa]);
        // ⚠ AND THE GERMAN SEAM NEITHER THE SEPARATOR NOR ⟨sh⟩ CAN SEE. German ⟨St⟩ is /ʃt/, so
        // `Altstoetter` is Alt+Stötter — a /t/+/ʃ/ boundary spelled with no ⟨h⟩ anywhere. Its siblings
        // `Jugendstil`, `Landsturm`, `Waldstein` are written separated and were already safe; this is
        // the one Moby wrote adjacent, and the first version of this rule folded it to an affricate.
        expect(lex.get("altstoetter") ?? oov.get("altstoetter")).toBe("ɑltʃtɛtɚ");
        // ⚠ BUT ⟨ts⟩ + ANY LETTER WOULD BE TOO WIDE: these spell ⟨ts⟩ and are affricates.
        for (const [w, ipa] of [["putsch", "pʊt͡ʃ"], ["tsarevich", "zɑɹivɪt͡ʃ"]] as const)
            expect([w, lex.get(w) ?? oov.get(w)]).toEqual([w, ipa]);
    });

    test("NOTATION is folded — Moby's two symbols become this engine's one", () => {
        expect(lex.get("general")).toBe("d͡ʒɛnɚəl");    // ə + r  → ɚ
        expect(lex.get("history")).toBe("hɪstɚi");
        expect(lex.get("download")).toBe("daʊnloʊd");   // æ + ʊ  → aʊ
    });

    // ⚠ Moby writes ONE symbol for STRUT and schwa and separates them by STRESS, exactly as CMUdict does.
    // Stripping stress before the IPA map wrote every unstressed schwa in the corpus as ʌ — `general` came
    // out `dʒɛnɚʌl` and `carolina` `kæɹʌlaɪnʌ`.
    test("schwa and STRUT are separated by stress, not collapsed", () => {
        expect(lex.get("about")).toBe("əbaʊt");
        expect(lex.get("carolina")).toBe("kæɹəlaɪnə");
    });

    // ⚠ SAFE ONLY BECAUSE CMUdict HAS NO SUCH DISTINCTION — `more` and `nor` are both AO R — so this engine
    // has no FORCE to regress into and the fold can hide nothing.
    test("FORCE→NORTH is folded", () => {
        expect(lex.get("more")).toBe("mɔɹ");
        expect(lex.get("nor")).toBe("nɔɹ");
    });

    // ⚠ AND IT IS GATED ON THE SPELLING, because the phone shape cannot tell a FORCE coda from a compound
    // seam: `chorus` is also `AO R` before a vowel and DOES merge. Without the `owr` exemption the builder
    // wrote `ʃɔɹum`/`tɔɹoʊp` and scored our correct GOAT readings wrong, with the damage baked into the
    // artifact where no config fold could reach it.
    test("FORCE→NORTH does NOT fire across a compound seam", () => {
        expect(lex.get("showroom")).toBe("ʃoʊɹum");
        expect(lex.get("elbowroom")).toBe("ɛlboʊɹum");
        expect(oov.get("towrope")).toBe("toʊɹoʊp");
        // `bowring` is NOT one of these — Moby writes it with a source `/O/`, not an OW the fold collapsed.
        expect(lex.get("bowring")).toBe("bɔɹɪŋ");
    });

    // ⚠ THE LOAD-BEARING NEGATIVE. 402 dictionary rows moved on the marry–merry axis in #1336 and this
    // engine writes BOTH æɹ and ɛɹ, so folding Moby's unmerged reading would blind the referee to exactly
    // the class most recently changed. `carol` MUST stay æ here while the engine says ɛ.
    test("marry–merry is NOT folded, so a regression there is still scoreable", () => {
        expect(lex.get("carol")).toBe("kæɹəl");
        expect(lex.get("carat")).toBe("kæɹət");
    });

    test("every reading is plain broad IPA — none of the engine's narrow detail leaked in", () => {
        // aspiration, dark l, flapped t and the superscript offglides are the ENGINE's notation; a referee
        // written in them reads as a mirror even where the folds would score it the same.
        const narrow = /[ʰɫ̬ᶦᶷ]/u;
        const bad = [...lex.entries()].filter(([, ipa]) => narrow.test(ipa)).slice(0, 5);
        expect(bad).toEqual([]);
    });
});
