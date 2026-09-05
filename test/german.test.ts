import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/german/german.ts";

// Canonical-IPA goldens for Standard German (de). Rule-based g2p (long/short vowels from
// spelling, diphthongs aɪ̯/aʊ̯/ɔʏ̯, ch ich-/ach-laut, sch, sp-/st-→ʃ, final devoicing, r-vocalization ɐ̯,
// schwa in weak endings) + mostly-Germanic stress (first syllable, or after an unstressed prefix) with a
// kaikki stress lexicon for loanwords. Stress mark is placed before the stressed VOWEL (repo convention).
describe("german canonical IPA", () => {
    test("vowel length + schwa endings + r-vocalization", () => {
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // long aː (single C), -er → ɐ
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // short a (double s → single), -er → ɐ
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // -en → ə
        expect(phonemizeWord("über")).toBe("ˈyːbɐ");
        expect(phonemizeWord("lieben")).toBe("lˈiːbən"); // ie → iː
        expect(phonemizeWord("sehen")).toBe("zˈeːən"); // silent h, s → z
        expect(phonemizeWord("Hamburg")).toBe("hˈambʊɐ̯k"); // coda r → ɐ̯, final g → k
        expect(phonemizeWord("das")).toBe("das"); // short function-word monosyllable
    });

    test("ch split, sch, sp/st, diphthongs, devoicing", () => {
        expect(phonemizeWord("ich")).toBe("ɪç"); // ich-laut
        expect(phonemizeWord("Buch")).toBe("buːx"); // ach-laut, long u
        expect(phonemizeWord("König")).toBe("kˈøːnɪç"); // -ig → ɪç
        expect(phonemizeWord("Straße")).toBe("ʃtʁˈaːsə"); // st- → ʃt, ß → s
        expect(phonemizeWord("Zeit")).toBe("t͡saɪ̯t"); // z → t͡s, ei → aɪ̯
        expect(phonemizeWord("Deutschland")).toBe("dˈɔʏ̯t͡ʃlant"); // eu → ɔʏ̯, tsch → t͡ʃ, final d → t
        expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ"); // äu → ɔʏ̯
        expect(phonemizeWord("müssen")).toBe("mˈʏsən"); // short ü → ʏ (the census primitive)
        expect(phonemizeWord("Tag")).toBe("taːk"); // final devoicing g → k
        expect(phonemizeWord("Hund")).toBe("hʊnt");
    });

    test("prefix reduction, sp/st after prefix", () => {
        expect(phonemizeWord("gemacht")).toBe("ɡəmˈaxt"); // ge- prefix → ə
        expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // be- → ə, st after prefix → ʃt
        expect(phonemizeWord("gehen")).toBe("ɡˈeːən"); // ge- ROOT not reduced (stress on first)
    });

    test("morphology: compound + affix boundary phonology", () => {
        // Compound seams reset element-initial context (sp/st→ʃ), devoice the preceding stem, and block assimilation.
        expect(phonemizeWord("Laubsturm")).toBe("lˈaʊ̯pʃtʊɐ̯m"); // st→ʃt at seam, b→p devoiced
        expect(phonemizeWord("Warenkorb")).toBe("vˈaːʁənkɔɐ̯p"); // n·k NOT assimilated to ŋ
        expect(phonemizeWord("aufstehen")).toBe("ˈaʊ̯fʃteːən"); // separable prefix stressed, st→ʃt
        expect(phonemizeWord("verstehen")).toBe("fəɐ̯ʃtˈeːən"); // ver- → fə here (kaikki reduction lexicon; cf. vergessen fɛɐ̯ — per-word)
        expect(phonemizeWord("freundlich")).toBe("fʁˈɔʏ̯ntlɪç"); // -lich suffix, d→t devoiced at boundary
        expect(phonemizeWord("Zeitung")).toBe("t͡sˈaɪ̯tʊŋ"); // -ung
        // Vowel-initial inflection resyllabifies (no boundary): lieben not lieb·en, Häuser not häus·er.
        expect(phonemizeWord("lieben")).toBe("lˈiːbən"); // b stays (not devoiced)
        expect(phonemizeWord("Häuser")).toBe("hˈɔʏ̯zɐ"); // s → z (onset), not final s
    });

    test("flag-driven decomposition: linking-s, false-prefix guards", () => {
        expect(phonemizeWord("Zeitungsartikel")).toBe("t͡sˈaɪ̯tʊŋsaɐ̯tiːkəl"); // Fugen-s via the s flag
        expect(phonemizeWord("Geburtstag")).toBe("ɡəbˈuːɐ̯tstaːk"); // geburts·tag; ge- reduces to ə (kaikki ɡəˈbuːɐ̯tstaːk)
        expect(phonemizeWord("beiden")).toBe("bˈaɪ̯dən"); // NOT be·iden (iden isn't a word)
        expect(phonemizeWord("beten")).toBe("bˈeːtən"); // be- ROOT, dict-stressed on first
        expect(phonemizeWord("bestimmt")).toBe("bəʃtˈɪmt"); // real be- prefix (dict stress ord 1)
        // splittability test: a consonant-initial suffix is only stripped if the stem resolves.
        expect(phonemizeWord("Möglichkeit")).toBe("mˈøːɡlɪçkaɪ̯t"); // möglich·keit (möglich is a word)
        expect(phonemizeWord("endlich")).toBe("ˈɛndlɪç"); // NOT end·lich (end isn't a word)
    });

    test("the ⟨hör⟩ root keeps its h after a prefix (gehör, behörde)", () => {
        expect(phonemizeWord("gehör")).toBe("ɡəhˈøːɐ̯"); // ge+hör: h is a real onset (was dropped)
        expect(phonemizeWord("Behörde")).toBe("bəhˈøːɐ̯də");
        expect(phonemizeWord("gehen")).toBe("ɡˈeːən"); // control: silent lengthening h stays silent
        expect(phonemizeWord("fröhlich")).toBe("fʁˈøːlɪç"); // control: öh (not hö) stays silent
    });

    test("\"mit\" prefix needs a real-word stem (mittel not mit·tel)", () => {
        expect(phonemizeWord("mittelmäßig")).toBe("mˈɪtəlmɛsɪç"); // mittel·mäßig: tt collapses (was mit·telmäßig → ɪttəl)
        expect(phonemizeWord("mitteilen")).toBe("mˈɪttaɪ̯lən"); // control: real mit·teilen (teilen is a word)
    });

    test("negation un- before a prefix blocks the ng→ŋ merge (ungefähr)", () => {
        expect(phonemizeWord("ungefähr")).toBe("ˈʊnɡəfɛːɐ̯"); // un·ge → nɡ (not ŋ), un → ʊn
        expect(phonemizeWord("Union")).toBe("uːni̯ˈoːn"); // control: un+ion NOT split (ion after un isn't a prefix)
        expect(phonemizeWord("Universität")).toBe("ʊnifɛʁzitˈɛːt"); // control: not un-prefixed
    });

    test("monomorphemic ge-/er-+st keeps alveolar st (gestern, erst)", () => {
        expect(phonemizeWord("gestern")).toBe("ɡˈɛstɐn"); // NOT ge·stern → ʃt
        expect(phonemizeWord("erst")).toBe("eːɐ̯st");
        expect(phonemizeWord("Gestein")).toBe("ɡəʃtˈaɪ̯n"); // control: real ge- prefix → ʃt
        expect(phonemizeWord("erstaunen")).toBe("ɛɐ̯ʃtˈaʊ̯nən"); // control: real er- prefix → ʃt
    });

    test("particle-verb seam splits (fest·stellen → st → ʃt)", () => {
        expect(phonemizeWord("feststellen")).toBe("fˈɛstʃtɛlən"); // fest·stellen: seam st → ʃt
        expect(phonemizeWord("klarstellen")).toBe("klˈaːɐ̯ʃtɛlən");
        expect(phonemizeWord("schreiben")).toBe("ʃʁˈaɪ̯bən"); // control: simplex verb stays whole (no seam)
        expect(phonemizeWord("Klarinette")).toBe("klaʁinˈɛtə"); // control: klar+inette NOT split (inette not a constituent)
    });

    test("doubled voiced obstruent collapses before devoicing (Krabbe → kʁabə)", () => {
        expect(phonemizeWord("Krabbe")).toBe("kʁˈabə"); // bb → b (was wrongly kʁapbə)
        expect(phonemizeWord("Widder")).toBe("vˈɪdɐ"); // dd → d
        expect(phonemizeWord("Smaragd")).toBe("smaʁˈakt"); // control: real coda cluster gd → kt still devoices
    });

    test("loanword full unstressed vowel (ə → ɛ/e), native schwa protected", () => {
        expect(phonemizeWord("Talent")).toBe("talˈɛnt"); // loanword -ent → ɛ (was ə)
        expect(phonemizeWord("Dokument")).toBe("dɔkumˈɛnt");
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // control: native weak-schwa stays ə
        expect(phonemizeWord("gemacht")).toBe("ɡəmˈaxt"); // control: native ge- prefix stays ə
    });

    test("word-final French -eur → øːɐ̯ (not the ɔʏ̯ diphthong)", () => {
        expect(phonemizeWord("Friseur")).toBe("fʁizˈøːɐ̯"); // -eur loan suffix → øːɐ̯
        expect(phonemizeWord("Amateur")).toBe("amatˈøːɐ̯");
        expect(phonemizeWord("Steuer")).toBe("ʃtˈɔʏ̯ɐ"); // control: -euer is eu+er → diphthong stays
    });

    test("unstressed uː/oː lax to ʊ/ɔ (Latinate -ium/-um)", () => {
        expect(phonemizeWord("Aluminium")).toBe("aːluːmˈiːni̯ʊm"); // -ium → ʊm (was uːm)
        expect(phonemizeWord("Zentrum")).toBe("t͡sˈɛntʁʊm"); // -um → ʊm
        expect(phonemizeWord("Buch")).toBe("buːx"); // control: STRESSED uː stays long (build skips stressed)
    });

    test("-nis suffix devoices a bound stem's final obstruent", () => {
        expect(phonemizeWord("Bündnis")).toBe("bˈʏntnɪs"); // bünd·nis: d → t at the boundary
        expect(phonemizeWord("Ergebnis")).toBe("ɛɐ̯ɡˈeːpnɪs"); // ergeb·nis: b → p
        expect(phonemizeWord("Tennis")).toBe("tˈɛnɪs"); // control: monomorphemic (sonorant stem) → NOT split
    });

    test("-er restore before consonant lexicon unblocks loanword v→v", () => {
        expect(phonemizeWord("universal")).toBe("univɛʁzˈaːl"); // v now lands (was f) — ʁ inserted before applyConsonant
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // control: native ⟨v⟩ → f unchanged
    });

    test("loanword -er restoration lexicon (unstressed ɐ → ɛʁ)", () => {
        expect(phonemizeWord("Adverb")).toBe("ˈatfɛʁp"); // loanword unstressed -er → ɛʁ (was ɐ)
        expect(phonemizeWord("Expertise")).toBe("ɛkspɛʁtˈiːzə");
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // control: native -er stays reduced ɐ
        expect(phonemizeWord("Wanderer")).toBe("vˈandəʁɐ"); // control: native medial -er (ə/ɐ), not restored
    });

    test("unstressed i in medial hiatus → glide i̯ (Latinate -iVC-)", () => {
        expect(phonemizeWord("Union")).toBe("uːni̯ˈoːn"); // -ion → i̯oːn
        expect(phonemizeWord("genial")).toBe("ɡeni̯ˈaːl"); // -ial → i̯aːl
        expect(phonemizeWord("Material")).toBe("maːteːʁi̯ˈaːl");
        expect(phonemizeWord("Liberia")).toBe("libˈeːʁia"); // control: word-final -iV# stays syllabic
    });

    test("recurse into a prefixed compound constituent (wahn·vor·stellung)", () => {
        expect(phonemizeWord("Wahnvorstellung")).toBe("vˈaːnfoːɐ̯ʃtɛlʊŋ"); // inner vor·stellung → st → ʃt
        expect(phonemizeWord("Vorstellung")).toBe("fˈoːɐ̯ʃtɛlʊŋ"); // control: standalone still correct
        expect(phonemizeWord("Donaudampfschiff")).toBe("dˈoːnaʊ̯dampfʃɪf"); // control: unaffected compound
    });

    test("a STRESSED bare ɐ is a wrongly-reduced -er → ɛʁ", () => {
        expect(phonemizeWord("Laterne")).toBe("latˈɛʁnə"); // stressed -er → ɛʁ (was ɐ)
        expect(phonemizeWord("Inferno")).toBe("ɪnfˈɛʁno");
        expect(phonemizeWord("Wasser")).toBe("vˈasɐ"); // control: UNSTRESSED -er stays reduced ɐ
    });

    test("vocalized coda-r ɐ̯ holds a consonant slot (unblocks the lexicon)", () => {
        expect(phonemizeWord("Marge")).toBe("mˈaɐ̯ʒə"); // ʒ correction now lands (was skew-blocked by the r)
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // control: native word, corrections unchanged
    });

    test("French -age/-ge loans: g → ʒ", () => {
        expect(phonemizeWord("Garage")).toBe("ɡaʁˈaːʒə"); // -age loan → ʒ
        expect(phonemizeWord("Etage")).toBe("etˈaːʒə");
        expect(phonemizeWord("Regen")).toBe("ʁˈeːɡən"); // control: native ⟨g⟩ stays ɡ
    });

    test("unstressed Latinate -ie/-ien suffix → i̯ə/i̯ən", () => {
        expect(phonemizeWord("Familie")).toBe("famˈiːli̯ə"); // unstressed -ie → i̯ə
        expect(phonemizeWord("Ferien")).toBe("fˈeːʁi̯ən"); // -ien → i̯ən
        expect(phonemizeWord("Melodie")).toBe("melodˈiː"); // final-STRESSED loan → iː (restore post-pass)
        expect(phonemizeWord("Knie")).toBe("kniː"); // control: monosyllable (no preceding vowel) → iː
    });

    test("voiced obstruent devoices before ç/x/ʃ", () => {
        expect(phonemizeWord("Mädchen")).toBe("mˈɛːtçən"); // d before ç (ch) → t
        expect(phonemizeWord("Bildchen")).toBe("bˈɪltçən"); // control: cross-boundary case still devoices
    });

    test("long ä is always ɛː (never eː)", () => {
        expect(phonemizeWord("Ärzte")).toBe("ˈɛːɐ̯t͡stə"); // cluster-preceded long ä → ɛː (not eː)
        expect(phonemizeWord("Gespräch")).toBe("ɡəʃpʁˈɛːç");
        expect(phonemizeWord("Hätte")).toBe("hˈɛtə"); // control: genuinely-short ä → ɛ (marker normalised)
        expect(phonemizeWord("Käse")).toBe("kˈɛːzə"); // control: open-syllable long ä unaffected
    });

    test("recurse into a known constituent (triple compound seam)", () => {
        expect(phonemizeWord("Waffenstillstand")).toBe("vˈafənʃtɪlʃtant"); // waffen·still·stand: inner st → ʃt
        expect(phonemizeWord("Landstraße")).toBe("lˈantʃtʁaːsə"); // control: 2-part still splits
    });

    test("-igkeit: ⟨g⟩ between i and k → ç", () => {
        expect(phonemizeWord("Geschwindigkeit")).toBe("ɡəʃvˈɪndɪçkaɪ̯t"); // -igk- → ɪçk
        expect(phonemizeWord("Iglu")).toBe("ˈiːɡlu"); // control: igl (not igk) → ɡl
    });

    test("unstressed -igen i → ɪ (stressed iː protected)", () => {
        expect(phonemizeWord("würdigen")).toBe("vˈʏɐ̯dɪɡən"); // -ig- unstressed → ɪ (was long iːɡ)
        expect(phonemizeWord("Liga")).toBe("lˈiːɡa"); // control: STRESSED iː stays long (build skips stressed)
    });

    test("mid-compound reduction recovered (kaikki syllabic n̩ expanded)", () => {
        expect(phonemizeWord("Christentum")).toBe("kʁˈɪstəntuːm"); // christen·tum: -en → ə (was ɛ)
        expect(phonemizeWord("Heidelbeere")).toBe("hˈaɪ̯dəlbeːʁə"); // heidel- -el → ə
    });

    test("split ordering: prefer the whole-word lexeme (schreib·en not schrei·ben)", () => {
        expect(phonemizeWord("schreiben")).toBe("ʃʁˈaɪ̯bən"); // known verb → schreib·en, not the schrei·ben compound
        expect(phonemizeWord("Waldsterben")).toBe("vˈaltʃtɛɐ̯bən"); // control: a non-lexeme compound still splits
    });

    test("loanword consonants (v→v, s→s), native unchanged", () => {
        expect(phonemizeWord("Vase")).toBe("vˈaːzə"); // LOANWORD ⟨v⟩ → v
        expect(phonemizeWord("Pseudonym")).toBe("psɔʏ̯donˈyːm"); // loanword initial ⟨s⟩ → s (not z)
        expect(phonemizeWord("Vater")).toBe("fˈaːtɐ"); // control: NATIVE ⟨v⟩ → f
        expect(phonemizeWord("Sonne")).toBe("zˈɔnə"); // control: native initial ⟨s⟩ → z
    });

    test("split ranking: don't shatter ⟨sch⟩ (…schen verb, not raus·chen)", () => {
        expect(phonemizeWord("rauschen")).toBe("ʁˈaʊ̯ʃən"); // rausch·en (sch = ʃ), NOT raus·chen (s+ç)
        expect(phonemizeWord("waschen")).toBe("vˈaʃən");
        expect(phonemizeWord("Tuch")).toBe("tuːx"); // control: ⟨ch⟩ unaffected
    });

    test("word-initial ch (ç/k) + coda-cluster final devoicing", () => {
        expect(phonemizeWord("China")).toBe("çˈiːna"); // initial ch + front vowel → ç
        expect(phonemizeWord("Christ")).toBe("kʁɪst"); // initial ch + consonant → k
        expect(phonemizeWord("Chaos")).toBe("kˈaːɔs"); // initial ch + back vowel → k
        expect(phonemizeWord("Milch")).toBe("mɪlç"); // control: mid/final ich-laut ç unaffected
        expect(phonemizeWord("Smaragd")).toBe("smaʁˈakt"); // coda cluster gd → kt (both devoice)
        expect(phonemizeWord("Adler")).toBe("ˈaːdlɐ"); // control: d before a sonorant stays voiced
    });

    test("compound-split retry after a suffix strip (fires the seam st→ʃt)", () => {
        expect(phonemizeWord("Waldsterben")).toBe("vˈaltʃtɛɐ̯bən"); // wald·sterben: seam st→ʃt (was waldsterb·en)
        expect(phonemizeWord("leben")).toBe("lˈeːbən"); // control: a simple -en word is NOT wrongly compound-split
    });

    test("unstressed loanword vowel tensing (lax → tense, kaikki-derived quality lexicon)", () => {
        expect(phonemizeWord("November")).toBe("nofˈɛmbɐ"); // ɔ → o
        expect(phonemizeWord("digital")).toBe("diɡitˈaːl"); // ɪ → i (×2)
        expect(phonemizeWord("Dezember")).toBe("det͡sˈɛmbɐ"); // ɛ → e
        expect(phonemizeWord("Plural")).toBe("pluʁˈaːl"); // ʊ → u
    });

    test("no stressed schwa (weak-schwa mis-fire on a stressed root → ɛ, lengthened where flagged)", () => {
        expect(phonemizeWord("gesetz")).toBe("ɡəzˈɛt͡s"); // setz is the stressed root, not a schwa ending
        expect(phonemizeWord("generell")).toBe("ɡenəʁˈɛl");
        expect(phonemizeWord("Problem")).toBe("pʁoblˈeːm"); // ɛ→eː (length 1L) + unstressed ɔ→o (quality lexicon)
        expect(phonemizeWord("machen")).toBe("mˈaxən"); // control: genuine unstressed -en schwa unaffected
    });

    test("unstressed e→ə reduction (lexical: native ə, loanword ɛ)", () => {
        expect(phonemizeWord("wesentlich")).toBe("vˈeːzəntlɪç"); // native: -ent- e → ə
        expect(phonemizeWord("anderen")).toBe("ˈandəʁən"); // native: -er- e → ə
        expect(phonemizeWord("helikopter")).toBe("helikˈɔptɐ"); // LOANWORD: unstressed e/i TENSE (quality lexicon), not reduced to ə
    });

    test("Latin -tion/-tial suffix (ti + o/a → t͡si̯), native -tie unaffected", () => {
        expect(phonemizeWord("Aktion")).toBe("akt͡si̯ˈoːn"); // ti + o → t͡si̯
        expect(phonemizeWord("Nation")).toBe("naːt͡si̯ˈoːn");
        expect(phonemizeWord("Garantie")).toBe("ɡaʁantˈiː"); // word-final -tie (ie digraph) → tiː, NOT t͡si̯
        expect(phonemizeWord("Studie")).toBe("ʃtˈuːdi̯ə"); // unstressed -ie suffix → i̯ə; ⟨di⟩ not ⟨ti⟩ — unaffected
    });

    test("numbers + text", () => {
        expect(phonemize("21", "de")).toBe("ˈaɪ̯nʊntt͡svant͡sɪç"); // einundzwanzig
        expect(phonemize("100", "de")).toBe("ˈaɪ̯nhʊndɐt"); // einhundert
        expect(phonemize("Ich wohne in Berlin.", "de")).toBe(
            "ɪç vˈoːnə ɪn bɛɐ̯lˈiːn .",
        );
    });

    // OOV compounds (absent from the whole-word kaikki dicts) fall back to MORPHEME-KEYED corrections that compose
    // per stem — each morpheme keeps its own loanword length/quality/consonant correction + prefix reduction, which
    // a no-correction fallback loses. Measured held-out at 81.3% against 68.5% raw on OOV compounds — that
    // A/B is why the extra machinery exists. Known words are unaffected: they take the exact whole-word path.
    test("OOV compound fallback: morpheme-keyed corrections compose", () => {
        expect(phonemizeWord("Musikverein")).toBe("muzˈiːkfɛʁaɪ̯n"); // musik: s→z, short u, iː; verein: ver-→fɛʁ
        expect(phonemizeWord("Musikschule")).toBe("muzˈiːkʃuːlə"); // musik loan-corrected + schule
        expect(phonemizeWord("Naturschutzgebiet")).toBe("natˈuːɐ̯ʃʊt͡sɡəbiːt"); // gebiet: ge-→ɡə reduction survives
    });
});

// Prefix destressing for words the 68k stress dict has never seen. ⚠ The dict stores LEMMAS, so inflected forms (bedeutet, genutzten) missed the be-/ge- reduction and
// came out with a stressed long prefix (bˈeːdɔʏ̯tət). Two extensions: inflection-aware lookup (suffix
// strip/swap to the lemma entry — which also PROTECTS roots: beiden → beide ord 0), and a guarded fallback
// for dict-missing prefix words (ablaut participles like gegangen, which no suffix trick can reach).
describe("German unstressed prefixes on dict-missing forms", () => {
    test("inflected forms reach the lemma's stress entry", () => {
        expect(phonemize("bedeutet", "de")).toBe("bədˈɔʏ̯tət"); // ← bedeuten (ord 1); was bˈeːdɔʏ̯tət
        expect(phonemize("genutzten", "de")).toBe("ɡənˈʊt͡stən"); // ← genutzt
        expect(phonemize("behörden", "de")).toBe("bəhˈœɐ̯dən"); // ← behörde
    });

    test("ablaut participles via the prefix fallback", () => {
        expect(phonemize("gegangen", "de")).toBe("ɡəɡˈaŋən");
        expect(phonemize("gebracht", "de")).toBe("ɡəbʁˈaxt");
    });

    test("ge-/be-/er- ROOTS keep first-syllable stress", () => {
        expect(phonemize("beiden", "de")).toBe("bˈaɪ̯dən"); // beide — inflected lookup protects it
        expect(phonemize("gestern", "de")).toBe("ɡˈɛstɐn");
        expect(phonemize("gegen", "de")).toBe("ɡˈɛɡən");
        expect(phonemize("erste", "de")).toBe("ˈeːɐ̯stə");
    });
});

// TEXT NORMALIZATION. ⚠ German writes an ORDINAL as a numeral plus a bare PERIOD, which is
// indistinguishable by shape from a numeral ending a sentence — the detector below is what separates them.
describe("german normalization", () => {
    test("ordinal N. is detected and DECLINED, without eating a sentence period", () => {
        // Every one of these previously read as a cardinal plus a PAUSE ("sechzehn . Jahrhundert"). The
        // detector fires on the FOLLOWING word (a month or Jahrhundert), or on a licensing article plus a
        // capitalised noun. The governing word picks the ending: am/im/des/dem take weak -en, das/der -e.
        expect(phonemize("im 16. Jahrhundert", "de")).toBe("ɪm zˈɛçt͡seːntən jaːɐ̯hˈʊndɐt");
        expect(phonemize("das 16. Jahrhundert", "de")).toBe("das zˈɛçt͡seːntə jaːɐ̯hˈʊndɐt"); // -e, not -en
        expect(phonemize("des 16. Jahrhunderts", "de")).toBe("dəs zˈɛçt͡seːntən jaːɐ̯hˈʊndɐts");
        expect(phonemize("am 1. Januar", "de")).toBe("am ˈɛɐ̯stən jˈanuaːɐ̯"); // suppletive stem erst-
        expect(phonemize("am 26. November", "de")).toBe("am zˈɛçzʊntt͡svant͡sɪkstən nofˈɛmbɐ"); // -st above 20
        // …and a sentence-final digit-period must stay a PAUSE. Verified across the corpus: 109 utterances
        // contain a digit-period and no sentence-final pause was lost.
        expect(phonemize("Er kam 1958. Der Rest", "de")).toContain(" . ");
        expect(phonemize("genau 500. Dann", "de")).toContain(" . ");
    });

    test("a BARE number before a month is still a date ordinal", () => {
        // Corpora that strip punctuation have no dot to key on, and the reader still says the ordinal:
        // the OmniVoice audit heard *vierundzwanzigsten september* where we read the cardinal.
        expect(phonemize("am 24 september 1759", "de")).toContain("fiːʁʊntt͡svˈant͡sɪçstən");
        expect(phonemize("der 3 mai", "de")).toContain("dʁˈɪtə");
        // A number NOT before a month stays a cardinal.
        expect(phonemize("es waren 24 stunden", "de")).toContain("fiːʁʊntt͡svˈant͡sɪç ʃt");
    });

    test("...and LOWERCASED input gets the same ordinal, because lowercased input is real input", () => {
        // FLEURS ships its German transcripts lowercased, so the month test — case-sensitive until now — matched
        // nothing and these read as a cardinal plus a leaked phrase break. 103 utterances in the OmniVoice de_de
        // corpus. Each of these must equal its capitalised sibling above.
        expect(phonemize("am 16. februar", "de")).toBe("am zˈɛçt͡seːntən fˈeːbʁuaːɐ̯");
        expect(phonemize("der 3. mai", "de")).toBe("deːɐ̯ dʁˈɪtə maɪ̯");
        expect(phonemize("des 16. jahrhunderts", "de")).toBe("dəs zˈɛçt͡seːntən jaːɐ̯hˈʊndɐts");
        // The relaxation must not reach a SENTENCE BOUNDARY. A German day/century ordinal is ≤ 31, so a bigger
        // number before a month is a year ending a sentence — and stays a pause. (True of the capitalised form
        // too: `1998. Mai` over-fired before the ≤ 31 guard.)
        expect(phonemize("im jahr 1998. mai war warm", "de")).toContain(" . ");
        expect(phonemize("im Jahr 1998. Mai war warm", "de")).toContain(" . ");
        expect(phonemize("es waren 16. dann kamen mehr", "de")).toContain(" . ");
    });

    test("the period is thousands grouping, the comma is the decimal", () => {
        // The number token accepted either as a DECIMAL, so "1.000" read as *eins komma null null null*.
        expect(phonemize("1.000 Menschen", "de")).toBe("ˈaɪ̯ntaʊ̯zənt mˈɛnʃən");
        expect(phonemize("22.500", "de")).toBe("t͡svaɪ̯ʊntt͡svˈant͡sɪçtaʊ̯zənt fˈʏnfhʊndɐt");
        expect(phonemize("1,5 Meter", "de")).toBe("aɪ̯ns kˈɔma fʏnf mˈeːtɐ"); // …and the comma still works
    });

    test("clock: both written forms, neither of which worked", () => {
        // The colon became a PAUSE with a spurious "null"; the dot form was read as a decimal.
        expect(phonemize("11:00 Uhr", "de")).toBe("ɛlf uːɐ̯");
        expect(phonemize("8:46", "de")).toBe("axt uːɐ̯ zˈɛçsʊntfɪɐ̯t͡sɪç");
    });

    test("abbreviations, which were consonant clusters plus pauses", () => {
        expect(phonemize("z. B. das", "de")).toBe("t͡suːm bˈaɪ̯ʃpiːl das"); // was [t͡s . p .]
        expect(phonemize("bzw. auch", "de")).toBe("bət͡sˈiːʊŋsvaɪ̯zə aʊ̯x"); // ×13, was [pt͡sf .]
        expect(phonemize("Dr. Meier", "de")).toBe("dˈɔktoːɐ̯ mˈaɪ̯ɐ");
        expect(phonemize("usw.", "de")).toBe("ʊnt zoː vˈaɪ̯tɐ ."); // sentence-final dot kept
        expect(phonemize("356 v. Chr.", "de")).toBe("dʁˈaɪ̯ʊndɐtzɛçzʊntfʏnft͡sɪç foːɐ̯ kʁˈɪstʊs");
    });

    // GERMAN READS A YEAR IN 1100–1999 IN THE HUNDREDS FORM and we emitted the plain cardinal for every
    // one. Found from FLEURS audio: two readers of `diesen trat er 1945 bei` both say
    // *neunzehnhundertfünfundvierzig*. Re-scored against the recognized phones over the 110 de_de
    // utterances carrying an 11xx–19xx number: 104 closer to what the reader said, 4 further, 2 unchanged;
    // mean distance 0.266 → 0.234.
    test("years read in the hundreds form, and only where German uses it", () => {
        expect(phonemize("im Jahr 1945", "de")).toBe("ɪm jaːɐ̯ nˈɔʏ̯nt͡seːnhʊndɐtfʏnfʊntfiːɐ̯t͡sɪç");
        expect(phonemize("1900", "de")).toBe("nˈɔʏ̯nt͡seːnhʊndɐt");   // no tens: bare …hundert
        expect(phonemize("1905", "de")).toBe("nˈɔʏ̯nt͡seːnhʊndɐtfʏnf"); // German inserts no "oh"
        expect(phonemize("die 1980er Jahre", "de")).toBe("diː nˈɔʏ̯nt͡seːnhʊndɐtaxt͡siːɡɐ jˈaːʁə");
        // ⚠ 20xx IS ALREADY CORRECT AND MUST NOT MOVE. German switched forms at the millennium — the audio
        //   is unanimous: over utterances with one 4-digit number and a recognisable reading, 11xx–19xx is
        //   37 hundreds / 6 tausend while 20xx is 0 hundreds / 67 tausend.
        expect(phonemize("im Jahr 2019", "de")).toBe("ɪm jaːɐ̯ t͡svˈaɪ̯taʊ̯zənt nˈɔʏ̯nt͡seːn");
        // ⚠ AND 10xx STAYS A CARDINAL: German says *tausendsechsundsechzig*, never *zehnhundert…*.
        expect(phonemize("1066", "de")).toBe("ˈaɪ̯ntaʊ̯zənt zˈɛçsʊntzɛçt͡sɪç");
        // COUNTS, not years. The rule defaults to the year reading because in this corpus only 2 of the 176
        // four-digit 1100–1999 numbers are count-like — so the guard carries the burden, and it is a
        // measure/quantity-noun list, deliberately case-insensitive.
        expect(phonemize("1200 Menschen", "de")).toBe("ˈaɪ̯ntaʊ̯zənt t͡svˈaɪ̯hʊndɐt mˈɛnʃən");
        expect(phonemize("1200 menschen", "de")).toBe("ˈaɪ̯ntaʊ̯zənt t͡svˈaɪ̯hʊndɐt mˈɛnʃən");
        expect(phonemize("1500 Euro", "de")).toBe("ˈaɪ̯ntaʊ̯zənt fˈʏnfhʊndɐt ˈɔʏ̯ʁo");
        // ⚠ A CURRENCY SYMBOL SITS TO THE LEFT, where the unit list cannot see it — `€1500` is an amount.
        //   The guard for it belongs in the leading lookbehind; written into YEAR_NOT_COUNT (a lookahead
        //   appended AFTER the digits) it would test the last digit instead.
        expect(phonemize("€1500", "de")).toBe("ˈaɪ̯ntaʊ̯zənt fˈʏnfhʊndɐt ˈɔʏ̯ʁo");
        // ⚠ ⟨er⟩/⟨ern⟩ ONLY. A figure glued to any other letter run stays a numeral, or the year rule takes
        //   the digits and strands the suffix as *neunzehnhundertachtzigers*.
        expect(phonemize("1980ers", "de")).toBe("ˈaɪ̯ntaʊ̯zənt nˈɔʏ̯nhʊndɐtaxtt͡sɪç eːɐ̯s");
    });

    test("initialisms, units, signs and fractions", () => {
        expect(phonemize("die USA", "de")).toBe("diː uː ɛs aː"); // was the word [ˈuːzaː]
        expect(phonemize("AOL", "de")).toBe("aː oː ɛl");
        expect(phonemize("120 km/h", "de")).toBe("ˈaɪ̯nhʊndɐtt͡svant͡sɪç kilomˈeːtɐ pʁoː ʃtˈʊndə"); // /h was a letter
        expect(phonemize("20 °C", "de")).toBe("t͡svˈant͡sɪç ɡʁaːt t͡sˈɛlzi̯ʊs");
        // ⚠ LOWERCASED text is the majority form, not an edge case: across the 102 FLEURS train splits
        //   `°c`/`°f` outnumber `°C`/`°F` 298 to 151. The scale rule was uppercase-only, so `32 °c` fell
        //   through to the bare-degree rule and left a loose `c` for the g2p (`c → k` context-free),
        //   reading *zweiunddreissig Grad k*. Caught by two readers of one FLEURS utterance saying
        //   "Grad Celsius" and "Grad Fahrenheit"; see docs/investigations/asr-align/asr_align_qc_investigation.md.
        expect(phonemize("32 °c", "de")).toBe("t͡svaɪ̯ʊndʁˈaɪ̯sɪç ɡʁaːt t͡sˈɛlzi̯ʊs");
        expect(phonemize("90 °f", "de")).toBe("nˈɔʏ̯nt͡sɪç ɡʁaːt fˈaːʁənhaɪ̯t");
    });

    // ⟨C⟩ BEFORE A FRONT VOWEL IS /t͡s/, and it is a LIST rather than a rule: only 98 of the 249 kaikki
    // words spelled with a bare ⟨c⟩ before a front vowel take /t͡s/, the rest being loans where /k/ or /s/
    // is right. So the known words sit in consonant.tsv (via tools/gen/de-consonant-curated.tsv) and /k/
    // stays the OOV default. 84 words changed, all 84 closer to the gold, none worse; the independent
    // wikipron deu referee moves 2313 → 2314 and the kaikki primary 3711 → 3717.
    test("⟨c⟩ before a front vowel is the affricate, by lexicon", () => {
        expect(phonemize("Celsius", "de")).toBe("t͡sˈɛlzi̯ʊs");
        expect(phonemize("circa", "de")).toBe("t͡sˈɪɐ̯ka");
        expect(phonemize("Mercedes", "de")).toBe("mɛɐ̯t͡sˈeːdəs");
        // ⚠ AND THE OOV DEFAULT MUST STAY /k/ — these are the 60% a rule would have broken. `Calcium` is
        //   the honest case: it is absent from the kaikki extract (only its compounds are there), so it
        //   is genuinely OOV and reads /k/, which is what a list-not-a-rule design is supposed to do.
        expect(phonemize("Cafe", "de")).toBe("kafˈeː");
        expect(phonemize("Computer", "de")).toBe("kɔmpˈuːtɐ");
        expect(phonemize("Calcium", "de")).toBe("kˈalki̯uːm");
        expect(phonemize("+3 Grad", "de")).toBe("plʊs dʁaɪ̯ ɡʁaːt");
        expect(phonemize("1/5", "de")).toBe("aɪ̯n fˈʏnftəl"); // ordinal stem + -el
    });

    // bare `m` was the RAW LETTER, so `5 m³` read as *fʏnf m* while `5 km³` read correctly: the
    // exponent branch resolves its head noun from `units` first, and `Kubik` had nothing to attach to.
    // Meter ×6, and every digit-adjacent bare `m` in the corpus is a metre.
    test("the bare metre, and the cube word it feeds", () => {
        expect(phonemize("4892 m", "de")).toContain("mˈeːtɐ");
        expect(phonemize("100 m und 200 m", "de")).toContain("mˈeːtɐ ʊnt");
        expect(phonemize("5 m³", "de")).toContain("kˈuːbɪkmeːtɐ"); // compound, one word
        expect(phonemize("BMW M3", "de")).toContain("m dʁaɪ̯");    // not a volume
    });

    // ⚠ THESE FOUR WERE NOT LEAKING, THEY WERE MIS-READING — the class tools/normalization/misread.ts
    // exists to see. `10 ha` read *t͡seːn haː*, a German interjection; `10 g` read as the letter's own
    // sound. Nothing in the tree could flag either: no ASCII survives into the IPA and nothing VANISHES,
    // so neither a leak class nor the differential DROP test can reach it.
    test("units that MIS-READ rather than leak — ⟨g⟩ ⟨ha⟩ ⟨l⟩ ⟨L⟩", () => {
        // Each word definitional on de.wikipedia, and each article names its own symbol.
        expect(phonemize("10 g", "de")).toBe("t͡seːn ɡʁam");
        expect(phonemize("10 ha", "de")).toBe("t͡seːn hˈɛktaːɐ̯");
        expect(phonemize("10 l", "de")).toBe("t͡seːn lˈɪtɐ");
        expect(phonemize("10 L", "de")).toBe("t͡seːn lˈɪtɐ"); // ⚠ both cases are official for the litre
        // ⚠ A DOTTED DESIGNATION IS NOT A QUANTITY — the artifact's only `<digit> g` is a Wi-Fi standard.
        expect(phonemize("802.11g", "de")).not.toContain("ɡʁam");
    });
});

/**
 * ⟨th⟩ AT A WORD EDGE — a loan digraph, and German has no [th] sequence at all. The h rule pronounces h
 * after any consonant, so *Thema* carried a spurious one: thˈeːma for [ˈteːma].
 *
 * ⚠ THE EDGE RESTRICTION IS THE WHOLE SAFETY ARGUMENT. Medially, ⟨th⟩ is as often a COMPOUND BOUNDARY
 * where the h is real. In the kaikki referee, word-initial ⟨th⟩ is 8/8 silent and word-final 3/3, while
 * medial is only 34/52. On the corpus the edge rule is 88 closer / 0 further; extending it medially is
 * 186/24, net positive and not taken — the 24 are ordinary compounds and English-in-German.
 */
describe("German — the word-edge ⟨th⟩ digraph", () => {
    test("initial and final ⟨th⟩ are [t], with no [h]", () => {
        expect(phonemizeWord("thema")).toBe("tˈeːma");
        expect(phonemizeWord("theater")).toBe("teˈaːtɐ");
        expect(phonemizeWord("theresa")).toBe("teʁˈeːza");
    });

    /**
     * ⚠ MEDIAL ⟨th⟩ KEEPS ITS h ON PURPOSE. These are the words the restriction protects — the second
     * element of a compound, and the productive `-heit` suffix on any -t adjective, both of which have a
     * real [h]. The loan words in the same position (Apotheke, Mathematik) are knowingly given up with it.
     */
    test("medial ⟨th⟩ is left alone, because it is as often a compound boundary", () => {
        expect(phonemizeWord("rathaus")).toContain("thaʊ̯s");
        expect(phonemizeWord("vertrautheit")).toContain("thaɪ̯t");
        expect(phonemizeWord("apotheke")).toContain("th"); // knowingly wrong; see the note above
    });

    /**
     * ⚠ ⟨rh⟩ AND ⟨gh⟩ ARE NOT THE SAME CASE, though they look identical. Only 3 of 47 kaikki ⟨rh⟩ words
     * drop the h — Jahrhundert, Mehrheit, verhandlung are the norm and Rhythmus the exception — and ⟨gh⟩
     * is 0 of 12. Both were checked before assuming, and both stay untouched.
     */
    test("⟨rh⟩ and ⟨gh⟩ keep their h, at a word edge too", () => {
        // ⚠ WORD-INITIAL examples, or this test cannot fail: the rule it guards is edge-only, so medial
        //   Jahrhundert/Mehrheit would pass against an ⟨rh⟩ fold that is actually wrong.
        expect(phonemizeWord("rhythmus")).toContain("h");
        expect(phonemizeWord("rhein")).toContain("h");
        expect(phonemizeWord("jahrhundert")).toContain("h");
        expect(phonemizeWord("mehrheit")).toContain("h");
        expect(phonemizeWord("flughafen")).toContain("h");
    });
});

/**
 * ⟨h⟩ AFTER A VOWEL AT A PREFIX BOUNDARY. The h rule treats a post-vowel h as a silent length marker
 * (sehen, Uhr, fahren) — correct, except where a prefix puts a real onset there. That exception existed but
 * was gated to ⟨hö⟩ alone (ge·hör, be·hörde), so be·haglich, vor·be·halten and ent·halten lost their h.
 * Widening ⟨ö⟩ to the full-vowel set is 39 rows closer to the audio and 0 further.
 */
describe("German — post-vowel ⟨h⟩ at a prefix boundary", () => {
    test("a prefix before h + a full vowel keeps the h", () => {
        expect(phonemizeWord("behaglich")).toBe("bəhˈaːɡlɪç");
        expect(phonemizeWord("vorbehalten")).toBe("fˈoːɐ̯bəhaltən");
        expect(phonemizeWord("enthalten")).toBe("ɛnthˈaltən");
        expect(phonemizeWord("gehör")).toBe("ɡəhˈøːɐ̯"); // the ⟨ö⟩ case this generalises from
    });

    /**
     * ⚠ THE PREFIX TEST IS WHAT MAKES IT SAFE, and dropping it is NET NEGATIVE — 80 rows closer against 138
     * further. The referee alone suggests otherwise (post-vowel h before a full vowel is pronounced 24 of
     * 28 times in kaikki), but real German is full of compounds where the h ENDS the first morpheme:
     * Dreh·arbeit, Roh·öl, Ein·weihung, Erzieh·ung. These must keep the silent h.
     */
    test("h ending a morpheme before a vowel stays silent", () => {
        expect(phonemizeWord("dreharbeit")).toBe("dʁˈeːaɐ̯baɪ̯t");
        expect(phonemizeWord("rohöl")).toBe("ʁˈoːøːl");
        expect(phonemizeWord("einweihung")).toBe("ˈaɪ̯nvaɪ̯ʊŋ");
    });

    test("the ordinary silent-h environments are untouched", () => {
        expect(phonemizeWord("gehen")).toBe("ɡˈeːən"); // prefix-shaped but h + ⟨e⟩, a length marker
        expect(phonemizeWord("sehen")).toBe("zˈeːən");
        expect(phonemizeWord("uhr")).toBe("uːɐ̯");
        expect(phonemizeWord("fahren")).toBe("fˈaːʁən");
        expect(phonemizeWord("ruhig")).toBe("ʁˈuːɪç");
    });
});

/**
 * ⚠ A COMPOUND THAT DECOMPOSES IS ALREADY SAFE FROM THE ⟨th⟩ QUESTION, and pinning that is what stops the
 * medial extension from being re-proposed as "just add a compound detector". `phonemizeWord` calls
 * `decompose()` and g2p's each morpheme SEPARATELY, so a word that splits never presents ⟨th⟩ as a unit:
 * Gasthaus is read as "gast" + "haus". The words that regress under a medial rule are the ones decompose
 * CANNOT split, and each is a lexicon-coverage gap (rat is under the ≥4 leading-constituent floor; trut,
 * balsa, gänse are absent; heit strips only when the remainder is a known word).
 */
describe("German — compound decomposition already protects the ⟨th⟩ seam", () => {
    test("a decomposing compound keeps its [h], because the halves are read separately", () => {
        expect(phonemizeWord("gasthaus")).toBe("ɡˈasthaʊ̯s");
        expect(phonemizeWord("kunsthändler")).toBe("kˈʊnsthɛndlɐ");
        expect(phonemizeWord("achthundert")).toBe("ˈaxthʊndɐt");
        expect(phonemizeWord("schönheit")).toBe("ʃˈøːnhaɪ̯t"); // ⟨heit⟩ strips: schön is a known word
    });

    test("the ones it cannot split are the ones a medial rule would break", () => {
        // Correct TODAY only because the base rule pronounces h after any consonant.
        expect(phonemizeWord("rathaus")).toContain("th"); // `rat` is 3 letters, under the split floor
        expect(phonemizeWord("truthahn")).toContain("th"); // `trut` absent from lexicon.tsv
        expect(phonemizeWord("vertrautheit")).toContain("th"); // `traut` absent, so ⟨heit⟩ cannot strip
    });
});

// The corpus is 100% case-folded (271,798 rows, 102 languages — see issue #871), so a rule keyed on a
// capital never fires on it. This is the same trap the degree-scale rule documents two lines below the
// clock rule in normalize.ts, and the clock rule had not been given the same treatment.
describe("german clock — case-folded Uhr", () => {
    test("a case-folded `uhr` does not double the noun", () => {
        // Was: *acht Uhr dreissig UHR* — the capital-only group never matched, so the rule inserted its
        // own " Uhr" and the literal one survived. 24 of 24 clock rows in the German corpus.
        expect(phonemize("um 8:30 uhr", "de")).toBe(phonemize("um 8:30 Uhr", "de"));
        expect(phonemize("um 8:30 UHR", "de")).toBe(phonemize("um 8:30 Uhr", "de"));
        expect(phonemize("um 11.00 uhr", "de")).toBe(phonemize("um 11.00 Uhr", "de"));
    });

    test("the noun is re-emitted, so the reading is the one properly-cased word", () => {
        expect(phonemize("um 11.00 uhr", "de")).toBe("ʊm ɛlf uːɐ̯");
        expect(phonemize("um 8:30", "de")).toBe("ʊm axt uːɐ̯ dʁˈaɪ̯sɪç");
    });
});
