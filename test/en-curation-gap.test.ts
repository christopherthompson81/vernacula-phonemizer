/**
 * THE CURATED LAYER MUST NOT SILENTLY DIVERGE FROM THE OOV PATH.
 *
 * ⚠ `data/languages/english/g2p-model.json` is trained on UPSTREAM CMUdict, and `--emit` regenerates
 * `g2p-dict.tsv` from CMUdict too — so the ~20 hand corrections in `g2p-curated.tsv` reach the listed word
 * and, unless something propagates them, nothing else. Where they do not, the engine answers one way for a
 * recorded word and another for an unrecorded one IN THE SAME ENVIRONMENT, which is the defect
 * `tools/english/en_rebuild_lexicon.mts` exists to prevent on the lexicon side (#1295).
 *
 * ⚠ CURATION DOES PROPAGATE THROUGH MORPHOLOGY — `morphDecode` looks its stem up in the SHIPPED dict, not
 * in the model — so most curated rows are reproduced by the OOV path for free. This test pins WHICH ones
 * are not, so the list can only shrink by decision and never grow by accident.
 */
import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createEnglishG2p, type EnglishG2pModel } from "../src/languages/english/englishG2p.ts";
import { MANIFEST } from "../src/languages/english/manifest.ts";

const EN = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "languages", "english");

/**
 * ⚠ THE KNOWN GAPS ARE LISTED WITH A REASON, NOT WAIVED WHOLESALE, AND THE REASON DECIDES THE REMEDY.
 * A row leaving this list is progress; a row JOINING it is a regression that must be argued for.
 *
 * ⚠ THEY ARE NOT ALL THE SAME KIND. A first version of this comment said all three were pure-n-gram rows
 * that "only re-training or an overlay would close" — true of two of them and FALSE of `was`, which takes
 * the MORPH path. Saying so sent the next maintainer at the expensive fix for the cheap problem.
 */
const KNOWN_GAPS = new Map<string, string>([
    ["collaborative", "n-gram (source N): predicts the upstream EY2; -ative is a class morphology cannot reach"],
    ["research", "n-gram (source N): predicts upstream R IY0 S ER1 CH; the #1280 stress shift is lexical"],
    // ⚠ NOT AN N-GRAM ROW. `was` decodes through morphDecode on the two-letter dict stem `wa` (W AA1) plus
    // an `-s` allomorph — so a stem-side edit, or a floor on stem length, would close it without touching
    // the model. Left open deliberately: `wa` is a real dict row and raising the minimum stem length reaches
    // far past this word. Cheap to fix, not obviously right to fix.
    ["was", "morph (source M): `wa` + allomorph Z reconstructs the upstream W AA1 Z; see comment above"],
]);

/**
 * THE STRUCTURAL GAP, kept separate from the three per-word oddities above so neither list can hide the other.
 *
 * `g2p-model.json` is trained on UPSTREAM CMUdict. So for a corrected word with NO morphological handle — a
 * root, a proper noun, a loan — the OOV path has only the n-gram, and the n-gram learned the row we corrected.
 * It reproduces the upstream shape by construction, and no amount of curation can change that.
 *
 * ⚠ IT IS 179 WORDS AND THAT NUMBER IS THE POINT — it is a MEASURE of the train/ship gap, not a waiver pile.
 * Every entry is a curated row whose correction the model cannot reproduce because the model learned the row we
 * corrected. When the remedy below is taken, this list should COLLAPSE, and that collapse is the test that the
 * retrain worked. If it instead keeps growing while nobody retrains, the gate is telling you the curated layer
 * and the OOV path have drifted apart, which is exactly what it is for.
 *
 * ⚠ THIS SET GREW FROM 0 TO 14 IN ONE CHANGE and that is not a regression: the #1334 audit corrected 88 dict
 * rows where wikipron AND misaki gold agree against CMUdict, and the ones with a stem to decode through
 * (`annulled` ← `annul`, `writhed` ← `writhe`, `insularity` ← `insular`, `debriefing` ← `debrief`) closed
 * themselves as soon as the STEM was corrected too — which is how four of them left this list during that run.
 * What remains is the residue that has nowhere to propagate from.
 *
 * ⚠ AND A RULE IS NOT THE ANSWER EITHER — THAT WAS MEASURED. Most of this set is the unstressed `en-`/`em-`/
 * `ex-`/`es-` prefix, which looks productive enough to belong in the converter rather than in 187 dict rows.
 * It is not. Of the dict rows starting `EH0` that gold also carries, gold REDUCES 36 and keeps a full `ɛ` in
 * 36; restricting to the ones gold leaves unstressed only moves it to 36 reduce / 27 keep. `embark`, `employ`,
 * `enforce`, `encourage` reduce while `aesthetic`, `ecstatic`, `erroneous`, `endemic`, `estonia` do not, and
 * gold splits even within one stem (`employ` ɪmplˈY but `employee` ˌɛmplˌYˈi; `enclosed` but `enclosure`).
 * There is no phonological discriminator: it tracks how far the prefix has assimilated, which is lexis. A
 * converter rule would be wrong 43% of the time, so the dictionary is the right mechanism.
 *
 * ⚠ THE REMEDY IS NAMED AND IT IS NOT "ADD TO THIS LIST". Train the model on the CURATED dict rather than on
 * upstream CMUdict — `en_g2p_ngram.ts` reads $CMUDICT directly, so applying g2p-curated.tsv to its input
 * before the EM alignment would close this class outright, for these 14 and for every future correction.
 * That is a model regeneration with fleet-wide OOV consequences (held-out accuracy, the parity goldens and
 * the referee floors all move), so it is deliberately NOT bundled into a manual-correction PR.
 */
const STRUCTURAL_GAP = new Set([
    "allelic", "atman", "audible", "awe", "babka", "baile", "bellini", "benne", "bes", "blog", "bobble",
    "boche", "boff", "bog", "bridie", "calabria", "caliph", "cana", "cause", "causeway", "chomp",
    "coauthor", "conger", "conversely", "cost", "cutoff", "dacron", "dagenham", "dal", "debrief",
    "denomination", "denominational", "der", "discography", "discombobulate", "dogma", "drachma",
    "dramatize", "dubrovnik", "duce", "dulce", "eamon", "embargo", "embark", "embattle", "embitter",
    "embrace", "embroidery", "employ", "enable", "encase", "enchant", "encode", "encompass", "encourage",
    "encrypt", "encumber", "endorse", "endow", "enforce", "enhance", "enjoyment", "enliven", "enmesh",
    "enrage", "enrapture", "enrich", "enroll", "enshrine", "ensure", "entitle", "entreaty", "envisage",
    "envision", "escudo", "esse", "evolve", "excoriate", "extort", "extortion", "extortionate",
    "extortionist", "extraction", "extrapolate", "extravagance", "extravagant", "extreme", "extremist",
    "favela", "felonious", "fide", "foggy", "forensic", "foster", "frog", "gala", "genotype", "golf",
    "graben", "grana", "granum", "hadrian", "hamm", "hebron", "hematite", "hog", "homs", "hoss", "hulme",
    "hypertrophy", "ideal", "insular", "joseph", "kana", "kanji", "kersey", "kingsport", "knockoff",
    "lachlan", "loge", "loggerhead", "loggia", "masochist", "mende", "minke", "mulligatawny", "necrologist",
    "necrology", "nerine", "olde", "on", "onset", "pravda", "quahog", "rahway", "raj", "remunerative",
    "revolve", "rouse", "runoff", "saas", "salsa", "sandhog", "sauternes", "selene", "serologist", "soave",
    "sodom", "sodomize", "spawn", "splenic", "stanch", "stasi", "status", "stomp", "strata", "stratus",
    "swanky", "synagogue", "tawny", "taxol", "turnoff", "twangy", "ulm", "unencumbered", "unenforceable",
    "unwashed", "vegan", "vela", "virulence", "virulent", "wank", "wash", "washy", "wat", "watchdog",
    "williamsport", "writhe", "zaftig"
]);

function dict(path: string): Map<string, string[]> {
    const m = new Map<string, string[]>();
    for (const l of readFileSync(path, "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [w, ph] = l.split("\t");
        const wl = w!.toLowerCase();
        if (/^[a-z]+$/.test(wl)) m.set(wl, ph!.split(" "));
    }
    return m;
}

describe("the curated layer against the OOV path", () => {
    const full = dict(join(EN, "g2p-dict.tsv"));
    const model = JSON.parse(readFileSync(join(EN, "g2p-model.json"), "utf8")) as EnglishG2pModel;
    const common = new Set(
        readFileSync(join(EN, "g2p-common.txt"), "utf8").split("\n").map((s) => s.trim()).filter(Boolean),
    );
    const classes = { ...MANIFEST.g2pClasses, vowels: MANIFEST.arpabet.vowels };

    const curated: { word: string; upstream: string; want: string }[] = [];
    for (const l of readFileSync(join(EN, "g2p-curated.tsv"), "utf8").split("\n")) {
        if (l.startsWith("#") || !l.includes("\t")) continue;
        const [word, upstream, want] = l.split("\t");
        curated.push({ word: word!, upstream: upstream!, want: want! });
    }

    // ⚠ ONE ROW PER WORD, and this exists because #1334 broke it. A word corrected in two separate passes
    // (`chillicothe`, LOT/THOUGHT and then the loanword final `-e`) got TWO rows, whose `upstream` columns
    // chained: the second row's upstream was the first row's output. The test below reads the FIRST match, so
    // it compared the shipped dict against a superseded value and failed with a message about the wrong thing.
    // A duplicate also makes the file's central claim — "this is the record needed to re-apply after an
    // --emit" — false, because replaying the rows in order depends on which one you take.
    test("no word has two curated rows", () => {
        const seen = new Map<string, number>();
        for (const { word } of curated) seen.set(word, (seen.get(word) ?? 0) + 1);
        expect([...seen.entries()].filter(([, n]) => n > 1).map(([w]) => w)).toEqual([]);
    });

    test("every curated row is still applied in the shipped dict", () => {
        // ⚠ THE FIRST THING AN --emit WOULD BREAK. If this fails, the dict was regenerated from CMUdict and
        // the curated layer was dropped; re-apply g2p-curated.tsv before shipping.
        expect(curated.length).toBeGreaterThan(15);
        for (const { word, want } of curated) {
            expect(`${word}: ${full.get(word)?.join(" ")}`).toBe(`${word}: ${want}`);
        }
    });

    test("no curated row falls back to the upstream shape on the OOV path, beyond the known gaps", () => {
        const live: string[] = [];
        for (const { word, upstream } of curated) {
            const held = new Map(full);
            held.delete(word);
            const g2p = createEnglishG2p(model, held, common, (p: string[]) => p.join(" "), classes);
            if (g2p.decompose(word).phones.join(" ") === upstream) live.push(word);
        }
        expect(live.filter((w) => !KNOWN_GAPS.has(w) && !STRUCTURAL_GAP.has(w))).toEqual([]);
        // ⚠ AND NEITHER WAIVER LIST MAY ROT. A gap that closes should be deleted, not left behind to mask
        // the next one — which is exactly what caught the four stem-corrected words during #1334.
        expect([...KNOWN_GAPS.keys()].filter((w) => !live.includes(w))).toEqual([]);
        expect([...STRUCTURAL_GAP].filter((w) => !live.includes(w))).toEqual([]);
    });
});
