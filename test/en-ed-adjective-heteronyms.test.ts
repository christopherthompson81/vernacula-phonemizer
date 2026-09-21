/**
 * THE `-ed` ADJECTIVE HETERONYMS (#1378 queue item 3).
 *
 * `blessed` is /blɛst/ as a participle and /ˈblɛsɪd/ as an adjective, and CMUdict carries only the
 * first. The `adj` slot in english.jsonc plus the attributive constraint in english.ts expresses it.
 *
 * ⚠ THE SLOT ALONE WAS NOT ENOUGH, WHICH IS THE WHOLE REASON THIS FILE EXISTS. The queue item recorded
 * the class as "expressible, the `adj` slot is live" — and it was, for `arithmetic`, whose tagger tag is
 * JJ. Measured over eight frames per word, this tagger calls every `-ed` adjective **VBN in attributive
 * position** and JJ only predicatively ("very blessed", "a truly blessed place"), which is the exact
 * complement of where `posExpectations` switches the slot on. So the entries were inert in the frames
 * that matter, and an `adj` value in the table is NOT evidence that the reading is reachable.
 * ⚠ HENCE THE NEGATIVE HALF BELOW. Each entry is pinned in BOTH readings, in a real sentence, because a
 * table row that resolves in neither direction still makes the file look finished.
 */
import { describe, expect, test } from "vitest";
import { phonemize } from "../src/index.ts";

describe("the -ed adjective is reachable in attributive position", () => {
    test("attributive → the syllabic adjective", async () => {
        expect(await phonemize("the blessed relief", "en")).toBe("ðə blˈɛsɪd ɹᵻlˈiːf");
        expect(await phonemize("the cursed thing", "en")).toBe("ðə kʰˈɝsɪd θˈɪŋ");
        expect(await phonemize("his dogged persistence", "en")).toBe("hɪz dˈɔːɡɪd pɚsˈɪstəns");
        expect(await phonemize("my beloved wife", "en")).toBe("maᶦ bᵻlˈʌvɪd wˈaᶦf");
        // ⚠ `beloved` NEEDS A `noun` SLOT TOO: the plural path builds from `verb ?? noun ?? past`
        // and never consults `adj`, so "my beloveds" took the participle as its base: bᵻlˈʌvdz.
        expect(await phonemize("My beloveds are here .", "en")).toBe("maᶦ bᵻlˈʌvɪdz ˈɑːɹ hˈɪɹ .");
        expect(await phonemize("my beloved", "en")).toBe("maᶦ bᵻlˈʌvɪd");

    });

    test("elsewhere → the participle, unchanged", async () => {
        expect(await phonemize("He blessed the crowd .", "en")).toBe("hiː blˈɛst ðə kɹˈaᶷd .");
        expect(await phonemize("He cursed loudly .", "en")).toBe("hiː kʰˈɝst lˈaᶷdli .");
        expect(await phonemize("The reporter dogged him .", "en")).toBe("ðə ɹᵻpʰˈɔːɹt̬ɚ dˈɔːɡd hˈɪm .");
    });

    // ⚠ A FOLLOWING NOUN IS NOT ENOUGH, AND THE FIRST VERSION OF THIS RULE SHIPPED WITHOUT THE REST.
    // A past-tense transitive verb with a BARE-NOUN object tags NN + VBN + NN — the attributive shape
    // minus its left edge — and all three of these read as the adjective. The negative test above
    // could not catch it: every case there puts a determiner after the verb, which is the one shape
    // the rule cannot fire on. What separates them is the LEFT tag, not the right one.
    test("a bare-noun object is not an attributive", async () => {
        expect(await phonemize("The priest blessed bread and wine .", "en")).toBe("ðə pɹˈiːst blˈɛst bɹˈɛd ənd wˈaᶦn .");
        expect(await phonemize("The captain cursed storms at sea .", "en")).toBe("ðə kʰˈæptn̩ kʰˈɝst stˈɔːɹmz æt sˈiː .");
        expect(await phonemize("The bishop blessed children yesterday .", "en")).toBe("ðə bˈɪʃəp blˈɛst t͡ʃˈɪɫdɹn̩ jˈɛstɚdˌeᶦ .");
    });

    // ⚠ SENTENCE-INITIAL HAS NO LEFT TAG AND STILL HEADS A NOUN PHRASE.
    test("sentence-initial attributive still resolves", async () => {
        expect(await phonemize("Blessed relief came .", "en")).toBe("blˈɛsɪd ɹᵻlˈiːf kʰˈeᶦm .");
    });

    // ⚠ THE PROMOTION MUST NOT REACH AN ORDINARY PARTICIPLE. It sets `adj` on any VBN before a noun,
    // which is only readable by a word that HAS an `adj` slot — this is what pins that.
    test("an ordinary participle before a noun is untouched", async () => {
        expect(await phonemize("the painted wall", "en")).toBe("ðə pʰˈeᶦntᵻd wˈɔːɫ");
        expect(await phonemize("a broken promise", "en")).toBe("ə bɹˈoᶷkən pɹˈɑːməs");
    });

    // ⚠ NOT A HETERONYM: there is no live verb "to accurse", so the word has only the adjective reading
    // and the dictionary row was simply the wrong one. Fixed in g2p-curated.tsv, not in the table.
    test("accursed has one reading, and it is the adjective", async () => {
        expect(await phonemize("an accursed fate", "en")).toBe("æn əkʰˈɝsɪd fˈeᶦt");
        expect(await phonemize("It was accursed .", "en")).toBe("ɪt wʌz əkʰˈɝsɪd .");
    });

    // ⚠ `moped` IS IN THE SAME BLOCK AND IS NOT AN `-ed` ADJECTIVE AT ALL — it is a NOUN the dictionary
    // could not reach, because CMUdict carries only the past tense of `mope`.
    test("moped is the vehicle by default and the verb when tagged one", async () => {
        expect(await phonemize("He rode a moped .", "en")).toBe("hiː ɹˈoᶷd ə mˈoᶷpɛd .");
        expect(await phonemize("He moped around .", "en")).toBe("hiː mˈoᶷpt ɚˈaᶷnd .");
        // ⚠ THE PROMOTION HAS TO CLEAR `verb`, OR AN ENTRY WITH A `verb` SLOT NEVER REACHES ITS
        // `adj`: VBN sets `verb` as well as `past`, and the resolver tests both first. Read mˈoᶷpt.
        expect(await phonemize("the moped rider", "en")).toBe("ðə mˈoᶷpɛd ɹˈaᶦd̬ɚ");
        // ⚠ AND THE VOWEL IS OUR OWN PLURAL ROW'S, NOT GOLD'S: the heteronym plural path runs BEFORE
        // the lexicon, so a stressed EH2 here would contradict the shipped `mopeds` for one lexeme.
        expect(await phonemize("The mopeds were parked outside .", "en")).toBe("ðə mˈoᶷpɛdz wˈɝ pʰˈɑːɹkt ˌaᶷtsˈaᶦd .");
    });

    // ⚠ DELIBERATELY ABSENT, AND THESE ARE THE TWO THE QUEUE NAMED FIRST. Attributive position does not
    // imply the adjective for them — "a learned professor" is /ˈlɜːnɪd/ but "learned behaviour" is
    // /lɜːnd/, "an aged man" is /ˈeɪdʒɪd/ but "aged cheese" is /eɪdʒd/ — so the one test this mechanism
    // has cannot separate their readings, and an entry would trade one error for another. Pinned so
    // that adding one is a decision rather than an oversight.
    test("learned and aged are left on their participle reading, on purpose", async () => {
        expect(await phonemize("a learned professor", "en")).toBe("ə lˈɝnd pɹəfˈɛsɚ");
        expect(await phonemize("an aged man", "en")).toBe("æn ˈeᶦd͡ʒd mˈæn");
    });
});
