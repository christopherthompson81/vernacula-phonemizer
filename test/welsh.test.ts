import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { normalizeWelsh, ordinalWords, soften } from "../src/languages/welsh/normalize.ts";
import { phonemizeWord } from "../src/languages/welsh/welsh.ts";

// Canonical-IPA goldens for Welsh (cy) — espeak-independent, Northern-leaning (u/clear-y → ɨ). Welsh spelling is
// highly phonemic: the g2p resolves digraphs (ch→χ dd→ð ll→ɬ rh→r̥ th→θ) and vowel clusters (diphthongs carry a
// superscript offglide) then applies PENULTIMATE stress and the vowel-LENGTH rule. Bootstrapped from the
// espeak-ng-portable cy canonical phonemize() output over the 50k corpus (its ə/ɨ y-vowel relabel, NOT the raw
// --ipa ʌ/ø); every golden below matches that reference. See docs/investigations/cy_bringup_investigation.md.
describe("welsh canonical IPA", () => {
    test("consonant digraphs (ch→χ dd→ð ff→f ll→ɬ rh→r̥ th→θ) + always-hard c/g", () => {
        expect(phonemizeWord("chwech")).toBe("χwˈeːχ"); // ch → χ
        expect(phonemizeWord("oedd")).toBe("ˈoːᶤð"); // dd → ð
        expect(phonemizeWord("llaw")).toBe("ɬˈaːᶷ"); // ll → ɬ (voiceless lateral)
        expect(phonemizeWord("rhaid")).toBe("r̥ˈaᶦd"); // rh → r̥ (voiceless r)
        expect(phonemizeWord("traeth")).toBe("trˈaːᶤθ"); // th → θ
        expect(phonemizeWord("gwlad")).toBe("ɡwlˈaːd"); // c/g always hard; gw- onset w stays consonant
    });

    test("diphthongs carry a superscript offglide (ae/au→aᶤ, ai/ei→aᶦ/eᶦ, aw/ew→aᶷ/ɛᶷ, oe→ɔᶤ, wy→ʊᶤ)", () => {
        expect(phonemizeWord("gwaith")).toBe("ɡwˈaᶦθ"); // ai → aᶦ
        expect(phonemizeWord("traeth")).toBe("trˈaːᶤθ"); // ae → aᶤ
        expect(phonemizeWord("mewn")).toBe("mˈɛᶷn"); // ew → ɛᶷ (short; referee: mɛun)
        expect(phonemizeWord("llaw")).toBe("ɬˈaːᶷ"); // aw → aᶷ
        expect(phonemizeWord("oedd")).toBe("ˈoːᶤð"); // oe → ɔᶤ
        expect(phonemizeWord("eglwys")).toBe("ˈɛɡlʊᶤs"); // wy diphthong → ʊᶤ (referee: ɛɡlʊɨs)
        expect(phonemizeWord("cymdeithas")).toBe("kəmdˈeᶦθas"); // ei → eᶦ (referee-backed)
    });

    test("the y-vowel: obscure ə (non-final) vs clear ɨ (final syllable); unstressed i → ɨ", () => {
        expect(phonemizeWord("cymru")).toBe("kˈəmrɨ"); // 1st y (non-final) → ə, u → ɨ
        expect(phonemizeWord("ysgol")).toBe("ˈəsɡɔl"); // obscure y → ə
        expect(phonemizeWord("blwyddyn")).toBe("blˈʊᶤðɨn"); // wy → ʊᶤ; final y → clear ɨ (referee: blʊɨðɨn)
        expect(phonemizeWord("lladin")).toBe("ɬˈadin"); // unstressed i stays FRONT (referee-backed; N Welsh centralizes only u/y)
        expect(phonemizeWord("dim")).toBe("dˈɪm"); // stressed short i stays front (referee: dɪm, not the oracle ɨ)
        expect(phonemizeWord("dinas")).toBe("dˈɪnas"); // stressed short i in an OPEN syllable stays front
    });

    test("penultimate stress + secondary stress on a long word's first syllable", () => {
        expect(phonemizeWord("cymru")).toBe("kˈəmrɨ"); // penult
        expect(phonemizeWord("prifysgol")).toBe("privˈəsɡɔl"); // penult (3 syllables, no secondary)
        expect(phonemizeWord("gorffennaf")).toBe("ɡɔrfˈɛnav"); // nn degeminates → n (referee: ɡɔrfɛna); penult
        expect(phonemizeWord("llywodraeth")).toBe("ɬəwˈɔdraᶤθ"); // penult
    });

    test("vowel length: long in a monosyllable open/before a single voiced coda; tense-quality-only in penults", () => {
        expect(phonemizeWord("mis")).toBe("mˈiːs"); // long before s
        expect(phonemizeWord("tad")).toBe("tˈaːd"); // long before d
        expect(phonemizeWord("nos")).toBe("nˈoːs"); // long before s
        expect(phonemizeWord("braf")).toBe("brˈaːv"); // long before f→v
        expect(phonemizeWord("nesaf")).toBe("nˈɛsav"); // penult stays LAX ɛ (referee-backed; not espeak-tensed e)
        expect(phonemizeWord("pobol")).toBe("pˈɔbɔl"); // penult stays LAX ɔ (referee: pɔbɔl)
        expect(phonemizeWord("bore")).toBe("bˈɔrɛ"); // lax ɔ before r (a deferred n/r/l lengthener)
        expect(phonemizeWord("papur")).toBe("pˈapɨr"); // lax a before p (voiceless)
    });

    test("Run 2 — word-initial nasal mutation, irregular function words, apostrophe enclitics", () => {
        expect(phonemizeWord("nhw")).toBe("n̥ˈuː"); // word-initial nh → n̥ (nasal mutation)
        expect(phonemizeWord("nghymru")).toBe("ŋ̥ˈəmrɨ"); // ngh → ŋ̥
        expect(phonemizeWord("enghraifft")).toBe("ˈɛŋ̊raᶦfd"); // MEDIAL ngh is ŋ+h, not the mutation
        expect(phonemizeWord("dechrau")).toBe("dˈɛχra"); // NW final unstressed -au → [a] (referee: dɛχra)
        expect(phonemizeWord("i")).toBe("ˈiː"); // the word ⟨i⟩ → front iː (referee-backed; the Run-2 oracle ɨ was an artifact)
        expect(phonemizeWord("bod")).toBe("bˈɔd"); // irregular: short ɔ, not the regular oː
        expect(phonemizeWord("heb")).toBe("hˈɛb"); // irregular: lax ɛ
        expect(phonemizeWord("un")).toBe("ˈɨːn"); // irregular: long ɨː before n
        expect(phonemizeWord("o'r")).toBe("ˈoːr"); // enclitic: stem ⟨o⟩ stays open (oː) + r
        expect(phonemizeWord("hi'n")).toBe("hˈiːn"); // enclitic: stem ⟨hi⟩ open (hiː) + n
    });

    test("w/i as consonants before a vowel; ⟨si⟩+V → ʃ; ⟨w⟩ as vowel (ʊ) otherwise", () => {
        expect(phonemizeWord("wal")).toBe("wˈal"); // word-initial w + vowel → consonant /w/ (not vowel ʊ)
        expect(phonemizeWord("teithio")).toBe("tˈeᶦθjɔ"); // ei → eᶦ (referee-backed); i+vowel → /j/
        expect(phonemizeWord("bara")).toBe("bˈara"); // plain
    });
});

// TEXT NORMALIZATION (src/languages/welsh/normalize.ts) — the pre-tokenizer pass behind #562. The defining
// rules are the VIGESIMAL ordinal (settled by audio: 60fed reads trigainfed, not chwe degfed), the
// comma-thousands (Welsh groups with commas; the dot is a decimal "pwynt"), the era markers O.C./C.C.,
// the p.m./a.m. clocks, the -au decades, and the letter-spelled initialisms.
describe("Welsh text normalization", () => {
    const ph = (s: string): string => phonemize(s, "cy").trim();

    test("the Nfed/Ned/Neg ordinal reads the VIGESIMAL form (trap-13 branch pins)", () => {
        // table
        expect(normalizeWelsh("7fed")).toBe("seithfed");
        expect(normalizeWelsh("6ed")).toBe("chweched");
        expect(normalizeWelsh("1af")).toBe("cyntaf");
        // the 20s composition: 37 = 17 on 20
        expect(normalizeWelsh("37fed")).toBe("ail ar bymtheg ar hugain");
        expect(ph("37fed")).toBe("ˈaᶦl ˈar bˈəmθɛɡ ˈar hˈɪɡaᶦn");
        // the round tens, and the corpus's only >100 ordinal
        expect(normalizeWelsh("60fed")).toBe("trigainfed");
        expect(normalizeWelsh("190fed")).toBe("degfed a naw ugain");
        expect(normalizeWelsh("1,000fed")).toBe("milfed");
    });

    test("comma-thousands stay grouped; the dot is a decimal (pwynt) or a version", () => {
        expect(ph("1,400 o bobl")).toBe("mˈiːl pˈɛdwar kˈant ˈoː bˈɔbl");
        expect(ph("400,000")).toBe("pˈɛdwar kˈant mˈiːl");
        expect(ph("2.4Ghz")).toBe("dˈaᶤ pˈuːᶤnt pˈɛdwar ɡiɡˈahɛrtz");
        expect(ph("1.5 miliwn")).toBe("ˈɨːn pˈuːᶤnt pˈɨmp mˈɪljʊn");
        expect(ph("802.11n")).toBe("ˈuːᶤθ kˈant dˈaᶤ pˈuːᶤnt ˈɨːn ˈɨːn n"); // version letter spelled
        expect(ph("1.234")).toBe("ˈɨːn pˈuːᶤnt dˈaᶤ trˈiː pˈɛdwar"); // digit-by-digit fraction
        // a comma-decimal (European notation, corpus-absent) reads pwynt, not a comma pause
        expect(ph("12,5")).toBe("ˈɨːn dˈeːɡ dˈaᶤ pˈuːᶤnt pˈɨmp");
        // but a 3-digit comma group stays thousands
        expect(ph("1,400")).toBe("mˈiːl pˈɛdwar kˈant");
    });

    test("a clock's a.m. marker needs a boundary, and the 20 ordinal exists", () => {
        expect(normalizeWelsh("11:00 amser")).toBe("un deg un amser"); // was *un deg un y bore ser*
        expect(normalizeWelsh("10:00am")).toBe("deg y bore"); // the glued undotted form still reads
        expect(normalizeWelsh("07:19 a.m.")).toBe("saith un deg naw y bore");
        expect(ordinalWords(20)).toBe("ugeinfed"); // the branch boundary: `low` is 0 in the 21-39 arm
    });

    test("ranges and scores read with 'i' (to); a leading minus stays minws", () => {
        expect(ph("6-6")).toBe("χwˈeːχ ˈiː χwˈeːχ");
        // `i` MUTATES what follows it: mil → fil, tri → dri, dau → ddau. chwech does not mutate (ch).
        expect(ph("1894-1895")).toBe("mˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ pˈɛdwar ˈiː vˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ pˈɨmp");
        expect(ph("5-3 Washington")).toBe("pˈɨmp ˈiː drˈiː washˈiŋtɔn");
        expect(ph("100-200 milltir")).toBe("kˈant ˈiː ðˈaᶤ ɡˈant mˈiɬtir");
        expect(ph("2-3 km o iâ")).toBe("dˈaᶤ ˈiː drˈiː kilˈɔmɛtr ˈoː jˈaː"); // the unit survives the rewrite
        expect(soften("chwech")).toBe("chwech"); // the digraph does not mutate
        expect(soften("llath")).toBe("lath");
        // the operand must END in a digit: `[\d,]*` also matches a trailing CLAUSE comma, and re-emitting
        // the operand as words then ate it — the corpus's `ers 1995-96, pan …` lost its pause.
        expect(normalizeWelsh("ers 1995-96, pan gyrhaeddodd")).toBe("ers 1995 i naw deg chwech, pan gyrhaeddodd");
        expect(normalizeWelsh("1,400-1,500 o bobl")).toBe("1,400 i fil pum cant o bobl");
        expect(ph("10:00-11:00 yr hwyr")).toBe("dˈeːɡ ˈiː ˈɨːn dˈeːɡ ˈɨːn ˈər hˈuːᶤr");
        expect(ph("-5 gradd")).toBe("mˈinʊs pˈɨmp ɡrˈaːð");
    });

    test("clocks read hour [minute] with p.m./a.m. as y prynhawn / y bore", () => {
        expect(ph("11:35 p.m.")).toBe("ˈɨːn dˈeːɡ ˈɨːn trˈiː dˈeːɡ pˈɨmp ˈə prˈənhaᶷn");
        expect(ph("07:19 a.m.")).toBe("sˈaᶦθ ˈɨːn dˈeːɡ nˈaːᶷ ˈə bˈɔrɛ");
        expect(ph("15.00 UTC")).toBe("ˈɨːn dˈeːɡ pˈɨmp ˈɨː tˈiː ˈɛk");
    });

    test("era markers expand; decades drop the -au; fractions use the noun/ordinal", () => {
        expect(ph("400 O.C.")).toBe("pˈɛdwar kˈant ˈoːᶤd krˈist");
        expect(ph("1000 C.C.")).toBe("mˈiːl kˈɨn krˈist");
        expect(ph("1970au")).toBe("mˈiːl nˈaːᶷ kˈant sˈaᶦθ dˈeːɡ");
        expect(ph("1/5 modfedd")).toBe("ˈɨːn pˈɨmɛd mˈɔdvɛð"); // un pumed
        // trap-13 branch pins: 3 and 4 are NOUNS (traean/chwarter), not the ordinals trydydd/pedwerydd.
        expect(ph("2/3")).toBe("dˈaᶤ trˈeᶤan"); // dau draean
        expect(ph("3/4")).toBe("trˈiː χwˈartar"); // tri chwarter
    });

    test("the clock range hyphen is 'i' (to), and p.m./a.m. do not glue the following word", () => {
        expect(ph("10:00-11:00 yr hwyr")).toBe("dˈeːɡ ˈiː ˈɨːn dˈeːɡ ˈɨːn ˈər hˈuːᶤr");
        expect(ph("8:30 p.m. amser")).toBe("ˈuːᶤθ trˈiː dˈeːɡ ˈə prˈənhaᶷn ˈamsar");
    });

    test("rates, units and degrees read their Welsh words", () => {
        expect(ph("480 cilomedr/awr")).toBe("pˈɛdwar kˈant ˈuːᶤθ dˈeːɡ kilˈɔmɛdr ˈər ˈaᶷr");
        expect(ph("100 llath/metr")).toBe("kˈant ɬˈaːθ nˈeᶤ vˈɛtr");
        expect(ph("4892 m")).toBe("pˈɛdaᶦr mˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ dˈaᶤ mˈɛtr");
        expect(ph("+30°C")).toBe("plˈuːs trˈiː dˈeːɡ ɡrˈaːð kˈɛlʃɨs");
    });

    test("currency prefixes, abbreviations and initialisms read their words or letters", () => {
        expect(ph("AUD$45 miliwn")).toBe("dˈɔlɛr aᶷstrˈalja pˈɛdwar dˈeːɡ pˈɨmp mˈɪljʊn");
        expect(ph("US$11,000")).toBe("dˈɔlɛr ˈər ˈɨnɔl dalˈeᶦθja ˈɨːn dˈeːɡ ˈɨːn mˈiːl");
        expect(ph("y DU")).toBe("ˈə dˈeᶤrnas ɨnˈɛdɪɡ"); // the UK, not "du"
        expect(ph("y Môr Du")).toBe("ˈə mˈoːr dˈɨː"); // the Black Sea keeps "du"
        expect(ph("ayb.")).toBe("ˈak ˈən ˈə blˈaːᶤn ."); // ac yn y blaen
        expect(ph("George W. Bush")).toBe("ɡɛˈɔrɡɛ ˈuː bˈɨsh");
        expect(ph("NHK")).toBe("ˈɛn ˈaᶦtsh ˈɛk"); // en aitsh ec
        expect(ph("UCLA")).toBe("ˈɨː ˈɛk ˈɛl ˈa");
    });
});
