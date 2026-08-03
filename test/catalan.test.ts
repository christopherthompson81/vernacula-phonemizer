import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeCatalan, ordinalWords } from "../src/languages/catalan/normalize.ts";
import { phonemizeWord } from "../src/languages/catalan/catalan.ts";
import { ROMAN_POLICY } from "../src/languages/catalan/romanOrdinals.ts";

// Canonical-IPA goldens for General Eastern/Central Catalan (Barcelona standard), espeak-independent. Rule-based
// g2p → 2R stress → UNSTRESSED VOWEL REDUCTION (a/e→ə, o→u) → regressive voicing assimilation → spirantization
// → nasal place assimilation → final devoicing + final-r deletion + coda-cluster simplification. Stressed
// open/close mid height (ɛ/e, ɔ/o) is LEXICAL and defaults to open (the documented ceiling — dona/dóna).
// See docs/investigations/ca_bringup_investigation.md.
describe("catalan canonical IPA", () => {
    test("vowel reduction (the Central signature) + dark l", () => {
        expect(phonemizeWord("casa")).toBe("kˈazə"); // final a → ə, intervocalic s → z
        expect(phonemizeWord("mira")).toBe("mˈiɾə"); // tap ɾ
        expect(phonemizeWord("carro")).toBe("kˈaru"); // rr → trill; final o → u
        expect(phonemizeWord("xocolata")).toBe("ʃukuɫˈatə"); // o→u ×2, dark ɫ, x → ʃ
        expect(phonemizeWord("dona")).toBe("dˈɔnə"); // stressed open ɔ (correct here)
    });

    test("Run 2 — lexical stressed mid-vowel height (open ɛ/ɔ default, close e/o from the espeak-derived lexicon)", () => {
        expect(phonemizeWord("pedra")).toBe("pˈeðɾə"); // close e (lexicon)
        expect(phonemizeWord("menja")).toBe("mˈeɲʒə"); // close e
        expect(phonemizeWord("por")).toBe("pˈoɾ"); // close o
        expect(phonemizeWord("Barcelona")).toBe("bəɾsəɫˈonə"); // close o
        expect(phonemizeWord("terra")).toBe("tˈɛrə"); // stays OPEN ɛ (not flagged)
        expect(phonemizeWord("cosa")).toBe("kˈɔzə"); // stays OPEN ɔ
    });

    test("palatals, affricates, digraphs (ny/ll/tx/tj/tg/ix)", () => {
        expect(phonemizeWord("any")).toBe("ˈaɲ"); // ny → ɲ
        expect(phonemizeWord("panxa")).toBe("pˈaɲʃə"); // n → ɲ before ʃ
        expect(phonemizeWord("caixa")).toBe("kˈaʃə"); // ix → ʃ (the i is a silent marker, not a glide)
        expect(phonemizeWord("peix")).toBe("pˈeʃ");
        expect(phonemizeWord("platja")).toBe("pɫˈad͡ʒə"); // tj → d͡ʒ
        expect(phonemizeWord("metge")).toBe("mˈed͡ʒə"); // tg(e) → d͡ʒ
        expect(phonemizeWord("cotxe")).toBe("kˈot͡ʃə"); // tx → t͡ʃ
        expect(phonemizeWord("col·legi")).toBe("kuɫːˈɛʒi"); // l·l → ɫː
    });

    test("soft c/g, j, betacism, spirantization", () => {
        expect(phonemizeWord("cel")).toBe("sˈɛɫ"); // c before e → s
        expect(phonemizeWord("gel")).toBe("ʒˈɛɫ"); // g before e → ʒ
        expect(phonemizeWord("jo")).toBe("ʒˈɔ");
        expect(phonemizeWord("abduïda")).toBe("əβðuˈiðə"); // b→β, d→ð spirantized; ï breaks the diphthong (hiatus)
    });

    test("diphthongs: falling offglides, Cia hiatus", () => {
        expect(phonemizeWord("peu")).toBe("pˈɛw"); // eu → ɛw
        expect(phonemizeWord("ciutat")).toBe("siwtˈat"); // iu → iw (falling); i is the nucleus
        expect(phonemizeWord("ciència")).toBe("siˈɛnsiə"); // Cia/Cie → HIATUS (not a rising glide, unlike Spanish)
        expect(phonemizeWord("llei")).toBe("ʎˈej"); // ll → ʎ, ei → ɛj
    });

    test("stress (2R + written accent) + final-r deletion", () => {
        expect(phonemizeWord("cantar")).toBe("kəntˈa"); // final -r silent (Central); penult reduces
        expect(phonemizeWord("ciutat")).toBe("siwtˈat"); // ends in a consonant → final stress
        expect(phonemizeWord("quinze")).toBe("kˈinzə"); // ends in vowel → penult stress
    });

    test("assimilation + final devoicing + coda-cluster simplification", () => {
        expect(phonemizeWord("absolta")).toBe("əpsˈɔɫtə"); // b → p before voiceless s (regressive)
        expect(phonemizeWord("esbós")).toBe("əzβˈos"); // s → z before voiced b (regressive)
        expect(phonemizeWord("actitud")).toBe("əktitˈut"); // final d → t
        expect(phonemizeWord("vint")).toBe("bˈin"); // v→b; final -nt → n (cluster simplification)
        expect(phonemizeWord("cent")).toBe("sˈen");
        expect(phonemizeWord("molt")).toBe("mˈoɫ"); // final -lt → l
    });

    test("review fixes: velar-nasal cluster, -ig affricate, spirant-after-lateral, diphthong-final stress", () => {
        expect(phonemizeWord("banc")).toBe("bˈaŋ"); // n→ŋ then final k drops
        expect(phonemizeWord("sang")).toBe("sˈaŋ"); // -ng → ŋ
        expect(phonemizeWord("maig")).toBe("mˈat͡ʃ"); // vowel-preceded -ig → t͡ʃ (i silent)
        expect(phonemizeWord("mig")).toBe("mˈit͡ʃ"); // consonant-preceded -ig → i + t͡ʃ (i is a nucleus)
        expect(phonemizeWord("alga")).toBe("ˈaɫɣə"); // ɡ DOES spirantize after a lateral (only d stays occlusive)
        expect(phonemizeWord("remei")).toBe("rəmˈɛj"); // falling-diphthong-final → OXYTONE (final stress)
        expect(phonemizeWord("correu")).toBe("kurˈɛw");
        expect(phonemizeWord("pausa")).toBe("pˈawzə"); // s → z after a glide too
    });

    test("Run 3 — ⟨x⟩ realization, -Cs cluster, bl/gl gemination", () => {
        expect(phonemizeWord("taxi")).toBe("tˈaksi"); // ⟨x⟩ after a vowel → ks
        expect(phonemizeWord("box")).toBe("bˈɔks"); // coda ⟨x⟩ → ks
        expect(phonemizeWord("panxa")).toBe("pˈaɲʃə"); // ⟨x⟩ after a consonant → ʃ
        expect(phonemizeWord("examen")).toBe("əɡzˈamən"); // ex- prefix → ɡz
        expect(phonemizeWord("forts")).toBe("fˈɔɾs"); // -rts → rs (but fort → fˈɔɾt keeps its t)
        expect(phonemizeWord("fort")).toBe("fˈɔɾt");
        expect(phonemizeWord("poble")).toBe("pˈɔbːɫə"); // bl → bː + l (geminate; popular word, lexicon)
        expect(phonemizeWord("regla")).toBe("rˈeɡːɫə"); // gl → ɡː + l
        expect(phonemizeWord("problema")).toBe("pɾuβɫˈemə"); // learned word: bl SPIRANTIZES (not in the geminate lexicon)
        expect(phonemizeWord("obligar")).toBe("uβɫiɣˈa");
    });

    test("review fixes: diphthong+coda oxytone stress, gua/guo glide", () => {
        expect(phonemizeWord("correus")).toBe("kurˈɛws"); // falling diphthong + plural -s → still OXYTONE (not penult)
        expect(phonemizeWord("dijous")).toBe("diʒˈɔws");
        expect(phonemizeWord("remeis")).toBe("rəmˈɛjs");
        expect(phonemizeWord("aigua")).toBe("ˈajɣwə"); // gua → ɡw (u is a glide, not a hiatus nucleus)
        expect(phonemizeWord("guardar")).toBe("ɡwəɾðˈa");
    });

    test("numbers", () => {
        expect(phonemize("2", "ca")).toBe("dˈos");
        expect(phonemize("21", "ca")).toBe("bˈin i un"); // vint-i-un
        expect(phonemize("31", "ca")).toBe("tɾˈɛntə un"); // trenta-un
        expect(phonemize("100", "ca")).toBe("sˈen"); // cent
        expect(phonemize("200", "ca")).toBe("dˈos sˈens"); // dos-cents → two words (hyphen split)
        expect(phonemize("2024", "ca")).toBe("dˈos mˈiɫ bˈin i kwˈatɾə");
    });

    test("text: reduction + function-word destressing + punctuation", () => {
        expect(phonemize("El gat menja peix.", "ca")).toBe("əɫ ɡˈat mˈeɲʒə pˈeʃ ."); // el reduces: proclitic [ə] (was ɛɫ before the Run-27 fix)
    });
});

// Proclitic vowel reduction (found by the FLEURS engine diff, Run 27). De-stressing a function word used to be
// a post-hoc ˈ strip, applied AFTER reduce() had run with the word's only nucleus at the stress index — the
// mark vanished but the vowel kept its stressed quality (el → ɛɫ). Central Catalan proclitics are [ə]; the
// human referee attests em → "ə m", and espeak agrees (əl). Now the whole word reduces (stress = -1).
describe("Catalan proclitic reduction", () => {
    test("clitics reduce in running text", () => {
        expect(phonemize("el gat", "ca")).toBe("əɫ ɡˈat");
        expect(phonemize("del mar", "ca")).toBe("dəɫ mˈaɾ");
        expect(phonemize("es posa", "ca")).toBe("əs pˈɔzə");
        expect(phonemize("que ve", "ca")).toBe("kə bˈe");
        expect(phonemize("ho fa", "ca")).toBe("u fˈa"); // ho — the famously [u] pronoun
    });

    test("keep-vowel function words lose only the mark", () => {
        // the conjunction "o" resists reduction (contrast with u; referee: o → "o"), as do no/com.
        expect(phonemize("blanc o negre", "ca")).toBe("bɫˈaŋ o nˈɛɣɾə");
        expect(phonemize("no ve", "ca")).toBe("no bˈe");
    });

    test("content monosyllables keep their stressed vowel", () => {
        expect(phonemize("mel", "ca")).toBe("mˈɛɫ");
        expect(phonemize("tren", "ca")).toBe("tɾˈɛn");
    });

    test("citation form (phonemizeWord) is unchanged — stress + full vowel", () => {
        expect(phonemizeWord("el")).toBe("ˈɛɫ");
    });
});

// ── Roman-numeral policy (src/languages/catalan/romanOrdinals.ts) ──
// A CENTURY IS A CARDINAL in Catalan (Optimot, «Ús i lectura de les xifres romanes»: after its noun a Roman numeral reads as a cardinal, el segle III = tres) — the shared Roman→digits pass is already right and the policy
// must not change that. What the policy adds is the PRENOMINAL ordinal of event names, which is ordinal at ANY
// value (XL/L aniversari·o → the -ésimo / -è series), where the cardinal would be the wrong register.
describe("Catalan Roman-numeral policy — centuries cardinal, prenominal events ordinal", () => {
    const ord = (n: number): string | undefined => ROMAN_POLICY.ordinal(n);

    test("a century stays a CARDINAL (the century noun is not a trigger)", () => {
        expect(ROMAN_POLICY.ordinalBefore).toBeUndefined();
        expect(ROMAN_POLICY.ordinalAfter?.test("segle")).toBe(false);
        expect(phonemize("segle xix", "ca")).toBe('sˈeɡːɫə dinˈɔw');
    });

    test("a bare numeral, with no ordinal context, stays a CARDINAL", () => {
        expect(phonemize("xix", "ca")).toBe('dinˈɔw');
    });

    test("prenominal event context is ordinal, and unbounded — XL / L / above L", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("aniversari")).toBe(true);
        expect(ord(40)).toBe('quarantè');
        expect(ord(50)).toBe('cinquantè');
        expect(ord(60)).toBe('seixantè');
        expect(phonemize('cinquantè aniversari', "ca")).toBe('siŋkwəntˈɛ əniβəɾsˈaɾi');
    });

    test("feminine heads are deliberately NOT triggered (the series is masculine)", () => {
        expect(ROMAN_POLICY.ordinalAfter?.test("edició")).toBe(false);
    });

    test("the -è series is built from the cardinal, incl. the orthographic irregulars", () => {
        expect(ord(10)).toBe("desè");
        expect(ord(19)).toBe("dinovè"); // nou → novè
        expect(ord(25)).toBe("vint i cinquè"); // cinc → cinquè; hyphens as spaces, per ./numbers.ts
        expect(ord(100)).toBe("centè");
        expect(phonemize("vint i cinquè festival", "ca")).toBe("bˈin i siŋkˈɛ fəstiβˈaɫ");
    });
});

// TEXT NORMALIZATION (src/languages/catalan/normalize.ts) — the pre-tokenizer pass behind #562. The
// defining rules are the `Nè`/`Na`/`Nr` ordinal (the Catalan written form), the era markers dC/aC, the
// dot-thousands vs dot-decimal/version disambiguation, clocks with AM/PM, fractions, and the initialism
// pass (EUA letter-spells, ONU stays a word).
describe("Catalan text normalization", () => {
    const ph = (s: string): string => phonemize(s, "ca").trim();

    test("text→text: the Nè/Na ordinal becomes the ordinal words", () => {
        expect(normalizeCatalan("7è de rugbi")).toBe("setè de rugbi");
        expect(normalizeCatalan("la 7a illa")).toBe("la setena illa");
        expect(normalizeCatalan("dC")).toBe("després de Crist");
        expect(normalizeCatalan("aC")).toBe("abans de Crist");
    });

    test("trap pins: 4t (quart), the s-decade, and the B&Bs plural", () => {
        // 4t is the quart series; 20t is NOT a Catalan form (20è) and must not fire.
        expect(normalizeCatalan("el 4t dia")).toBe("el quart dia");
        expect(ph("el 4t dia")).toBe("əɫ kwˈaɾt dˈiə");
        expect(ph("20t")).toBe("bˈin t");
        // the s-decade must not reach the tier's `s` unit (nineteen-twenty SECONDS).
        expect(normalizeCatalan("Durant els anys 1920s")).toBe("Durant els anys 1920");
        expect(ph("Durant els anys 1920s")).toBe("duɾˈan əɫs ˈaɲs mˈiɫ nˈɔw sˈens bˈin");
        // B&Bs — the plural s lands on the last letter name.
        expect(ph("els B&Bs")).toBe("əɫs bˈe i bˈes");
    });

    test("the Nè/Na/Nr ordinal reads the Catalan ordinal (masculine/feminine)", () => {
        expect(ph("7è de rugbi")).toBe("sətˈɛ də rˈuɣβi"); // setè
        expect(ph("la 7a illa")).toBe("ɫə sətˈɛnə ˈiʎə"); // setena (feminine)
        expect(ph("el 1r dia")).toBe("əɫ pɾimˈe dˈiə"); // primer
    });

    test("dot-thousands stay grouped; 1-2 digit fractions are decimals/versions (punt)", () => {
        expect(ph("1.400 persones")).toBe("mˈiɫ kwˈatɾə sˈens pəɾsˈonəs"); // 1400
        // The bare `m` was the RAW LETTER here until #586 declared `metre`/`metres` — this corpus's only
        // digit-adjacent bare `m`, and a genuine metre ("un màxim de 4.892 m del Mont Vinson").
        expect(ph("4.892 m")).toBe("kwˈatɾə mˈiɫ bˈujt sˈens nuɾˈantə dˈos mˈɛtɾəs"); // 4892 m
        expect(ph("1.5 milions")).toBe("un pˈun sˈiŋ miɫiˈons"); // 1.5 → punt
        expect(ph("2.4 Ghz")).toBe("dˈos pˈun kwˈatɾə ʒiɣəˈɛɾsis");
        expect(ph("802.11n")).toBe("bˈujt sˈens dˈos pˈun ˈonzə n");
    });

    test("clocks read hour [minute] with AM/PM letter-spelled", () => {
        expect(ph("11:35 PM")).toBe("ˈonzə tɾˈɛntə sˈiŋ pˈe ˈemə");
        expect(ph("06:30 i les 07:30")).toBe("sˈis tɾəntˈaj ɫəs sˈɛt tɾˈɛntə");
    });

    test("era markers expand (aC/dC) and fractions use the ordinal (un cinquè)", () => {
        expect(ph("segle III aC")).toBe("sˈeɡːɫə tɾˈɛs əβˈans də kɾˈist"); // abans de Crist
        expect(ph("1.300 dC")).toBe("mˈiɫ tɾˈɛs sˈens dəspɾˈes də kɾˈist"); // després de Crist
        expect(ph("1/5 polzades")).toBe("un siŋkˈɛ puɫzˈaðəs"); // un cinquè
        expect(ph("29¾ polzades")).toBe("bˈin i nˈɔw i tɾˈɛs kwˈaɾs puɫzˈaðəs");
    });

    test("degrees, currency (¥), abbreviations and dotted initials expand", () => {
        expect(ph("30 °C")).toBe("tɾˈɛntə ɡɾˈaws səɫsˈiws");
        expect(ph("2.500 ¥")).toBe("dˈos mˈiɫ sˈiŋ sˈens jˈɛns");
        expect(ph("Dr. Moll")).toBe("duktˈo mˈɔʎ");
        expect(ph("George W. Bush")).toBe("ʒəˈɔɾʒə w bˈus");
        expect(ph("etc.")).toBe("ətsˈɛtəɾə .");
    });

    // The tens ordinal drops its stem vowel — both of the corpus's tens instances (60è, 190a) read with it.
    test("a tens ordinal loses the stem vowel: seixantè, cent norantena", () => {
        expect(ordinalWords(40)).toBe("quarantè");
        expect(ordinalWords(60)).toBe("seixantè");
        expect(ordinalWords(90, true)).toBe("norantena");
        expect(ordinalWords(190, true)).toBe("cent norantena");
        // a PLURAL hundreds stem loses its -s (dos-centè), but a bare `dos` ending a compound keeps it
        expect(ordinalWords(200)).toBe("dos centè");
        expect(ordinalWords(900, true)).toBe("nou centena");
        expect(ordinalWords(102)).toBe("cent dosè");
        expect(ph("el 60è de la temporada")).toBe("əɫ səʃəntˈɛ də ɫə təmpuɾˈaðə"); // was *seixantaè*
        expect(ph("la 190a posició")).toBe("ɫə sˈen nuɾəntˈɛnə puzisiˈo"); // was *cent norantaena*
    });

    test("a fraction uses terç/quart and pluralises above one", () => {
        expect(normalizeCatalan("1/3")).toBe("un terç"); // not the ordinal *un tercer*
        expect(normalizeCatalan("2/3")).toBe("dos terços");
        expect(normalizeCatalan("3/4")).toBe("tres quarts"); // was *tres quart*
        expect(normalizeCatalan("2/5")).toBe("dos cinquens");
        expect(normalizeCatalan("1/5")).toBe("un cinquè");
    });

    test("only a DECADE loses its plural s; a unit keeps it", () => {
        expect(normalizeCatalan("els anys 1920s")).toBe("els anys 1920");
        expect(normalizeCatalan("els anys 90s")).toBe("els anys 90");
        expect(ph("45s de vídeo")).toBe("kwəɾˈantə sˈiŋ səɣˈons də bˈiðəu"); // seconds, not *quaranta-cinc*
    });

    test("the compass degree carries S too, and no rule leaves a double space", () => {
        expect(ph("35 ºS")).toBe("tɾˈɛntə sˈiŋ ɡɾˈaws sˈut"); // was a raw º plus a stray letter
        expect(normalizeCatalan("UTC +1")).toBe("u te ce més 1");
    });

    test("initialisms letter-spell (EUA); ONU stays the word; B&B reads be i be", () => {
        expect(ph("els EUA")).toBe("əɫs ˈɛ ˈu ə");
        expect(ph("l'ONU")).toBe("ɫ ˈɔnu");
        expect(ph("B&B")).toBe("bˈe i bˈe");
    });
});
