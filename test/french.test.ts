import { describe, expect, test } from "vitest";

import { phonemize } from "../src/index.ts";
import { phonemizeWord } from "../src/languages/french/french.ts";
import { toIpa } from "../src/languages/french/g2p.ts";
import { isUnreadableFrench } from "../src/languages/french/normalize.ts";

// Canonical-IPA goldens for French (fr) — standard/Parisian. Primary path is the Lexique 3.83 pronunciation
// LEXICON (~125k forms, carries every irregular); the rule-based g2p (toIpa) is the OOV fallback. Convention:
// nasals ɑ̃ɔ̃ɛ̃œ̃, r→ʁ, gn→ɲ, glides j/ɥ/w, eu→ø/œ, silent finals, -ille→ij. French has no lexical stress →
// one phrase-final accent per rhythmic group in text().
describe("french canonical IPA", () => {
    // g2p engine (the OOV fallback), tested directly via toIpa.
    test("g2p: vowel digraphs, nasals, glides", () => {
        expect(toIpa("beau")).toBe("bo"); // eau → o
        expect(toIpa("chien")).toBe("ʃjɛ̃"); // ch → ʃ, ien → jɛ̃
        expect(toIpa("temps")).toBe("tɑ̃"); // em → ɑ̃, silent ps
        expect(toIpa("oiseau")).toBe("wazo"); // oi → wa, s → z, eau → o
        expect(toIpa("lui")).toBe("lɥi"); // u before vowel → glide ɥ (census gap)
        expect(toIpa("gagner")).toBe("ɡaɲe"); // gn → ɲ, -er → e
    });

    test("g2p: eu/œu open vs closed, silent finals, geminates", () => {
        expect(toIpa("deux")).toBe("dø"); // open eu → ø
        expect(toIpa("peur")).toBe("pœʁ"); // closed eu → œ, r → ʁ
        expect(toIpa("corps")).toBe("kɔʁ"); // r sounded, ps silent
        expect(toIpa("homme")).toBe("ɔm"); // geminate mm → m
        expect(toIpa("fille")).toBe("fij"); // -ille → ij
        expect(toIpa("parc")).toBe("paʁk"); // word-final c not softened
        expect(toIpa("mer")).toBe("mɛʁ"); // monosyllable -er → ɛʁ
        expect(toIpa("laine")).toBe("lɛn"); // ai before nasal coda → ɛ
    });

    // Lexicon (Lexique) — irregulars resolved as data, not rules.
    test("lexicon: irregular pronunciations", () => {
        expect(phonemizeWord("monsieur")).toBe("məsjø");
        expect(phonemizeWord("femme")).toBe("fam");
        expect(phonemizeWord("oignon")).toBe("ɔɲɔ̃");
        expect(phonemizeWord("choline")).toBe("kɔlin"); // Greek ch → k
        expect(phonemizeWord("aujourd'hui")).toBe("oʒuʁdɥi");
    });

    test("numbers (vigesimal 70/80/90)", () => {
        // ⚠ The sub-100 group must stay ONE hyphenated word, so it resolves against the Lexique compounds
        // and the compound-internal liaison survives. Split on the hyphen, each piece phonemizes in
        // isolation and the liaison is lost.
        expect(phonemize("21", "fr")).toBe("vɛ̃teˈœ̃"); // vingt-et-un — the t liaison, per Lexique vɛ̃teœ̃
        expect(phonemize("342", "fr")).toBe("tʁwa sɑ̃ kaʁɑ̃tdˈø"); // trois cent quarante-deux
    });

    test("compound numerals join as Lexique attests them", () => {
        // 17/18/19 were the clearest defect: as "dix sept" the pieces gave [dis sɛt] with a doubled s,
        // and 18/19 came out VOICELESS where French voices the compound-internal x.
        expect(phonemize("17", "fr")).toBe("disˈɛt"); // dix-sept    disɛt
        expect(phonemize("18", "fr")).toBe("dizɥˈit"); // dix-huit   dizɥit — z, not s
        expect(phonemize("19", "fr")).toBe("diznˈœf"); // dix-neuf   diznœf
        expect(phonemize("90", "fr")).toBe("katʁəvɛ̃dˈis"); // quatre-vingt-dix katʁəvɛ̃dis
        expect(phonemize("97", "fr")).toBe("katʁəvɛ̃disˈɛt"); // quatre-vingt-dix-sept
        // A compound Lexique does NOT attest falls to per-part concatenation, which gives the same shape
        // as the attested trente-et-un (tʁɑ̃teœ̃) — a hyphen is not a word boundary for pronunciation.
        expect(phonemize("41", "fr")).toBe("kaʁɑ̃teˈœ̃"); // quarante-et-un
        // ...and the same tokenizer change makes ordinary hyphenated words resolve as one word.
        expect(phonemize("peut-être", "fr")).toBe("pøtˈɛtʁ"); // the t liaison, lost when split
    });

    test("ordinals from digit notation", () => {
        // What the corpus actually contains: 1er, 37e, 190e, 60e, 5e, 3e, 11e, 15e. Each of these used to
        // read the bare suffix as a stray word ("37e" → [tʁɑ̃t sɛt ø], "thirty-seven uh").
        expect(phonemize("le 1er janvier", "fr")).toBe("lə pʁømje ʒɑ̃vjˈe"); // premier
        expect(phonemize("la 1re fois", "fr")).toBe("la pʁømjɛʁ fwˈa"); // première — feminine indicator
        expect(phonemize("les 1ers jours", "fr")).toBe("le pʁømje ʒˈuʁ"); // premiers
        expect(phonemize("le 2e jour", "fr")).toBe("lə døzjɛm ʒˈuʁ"); // deuxième
        expect(phonemize("le 2ème jour", "fr")).toBe("lə døzjɛm ʒˈuʁ"); // the -ème spelling
        // Unbounded: the old table stopped at 20, so anything past it fell through entirely.
        expect(phonemize("le 37e", "fr")).toBe("lə tʁɑ̃tsɛtjˈɛm"); // trente-septième
        expect(phonemize("le 21e siècle", "fr")).toBe("lə vɛ̃teynjɛm sjˈɛkl"); // vingt-et-unième (unième, not premier)
        expect(phonemize("le 190e", "fr")).toBe("lə sɑ̃ katʁəvɛ̃dizjˈɛm"); // cent quatre-vingt-dixième
        // second/seconde is licensed only at 2 — "3d" is 3-D and must stay a cardinal + letter.
        expect(phonemize("le 2d violon", "fr")).toBe("lə səɡɔ̃ vjɔlˈɔ̃");
        expect(phonemize("le 3d", "fr")).not.toContain("tʁwazjɛm");
    });

    test("ordinal notation does not fire on homographs", () => {
        // "Roman letters + ordinal suffix" matches de/les/le/des/ce/vie/dire/lire thousands of times in
        // the corpus; the veto is Lexique membership, so each of these stays an ordinary word.
        expect(phonemize("la vie", "fr")).toBe("la vˈi"); // not VI = 6
        expect(phonemize("de la mie de pain", "fr")).toBe("də la mi də pˈɛ̃"); // not DI / MI
        expect(phonemize("un vieux livre", "fr")).toBe("œ̃ vjø lˈivʁ");
        // ...and an accented word must not be split at the accent: siècle parses as siè + cle (CL = 150)
        // for any pattern that trusts \b, which is defined on ASCII word characters.
        expect(phonemize("le siècle", "fr")).toBe("lə sjˈɛkl");
    });

    // TEXT NORMALIZATION (normalize.ts) — the ordered pipeline that rewrites everything which is not
    // already a pronounceable word. Grouped by the class of thing being normalized.
    test("times: the hour marker is spoken, with feminine agreement", () => {
        // "11 h 20" previously read as "onze vingt" — the h vanished entirely — and the colon form turned
        // into a pause mark. heure/minute are feminine, so 1 and anything ending in 1 take *une*.
        expect(phonemize("il est 11 h 20", "fr")).toBe("il e ɔ̃z œʁ vˈɛ̃"); // onze heures vingt
        expect(phonemize("à 1 h 15", "fr")).toBe("a yn œʁ kˈɛ̃z"); // UNE heure quinze, not un
        expect(phonemize("à 21 h", "fr")).toBe("a vɛ̃teyn ˈœʁ"); // vingt-et-une heures
        expect(phonemize("le train de 4:41", "fr")).toBe("lə tʁɛ̃ də katʁ œʁ kaʁɑ̃teˈyn"); // …quarante et UNE
    });

    test("digit grouping: a space-grouped thousand is one number", () => {
        // The tokenizer's number class does not span a space, so these read as two numbers with the
        // thousand lost — "5 000 ans" was "cinq zéro ans". Both forms occur in the corpus.
        expect(phonemize("5 000 ans", "fr")).toBe("sɛ̃k mil ˈɑ̃"); // ASCII space U+0020
        expect(phonemize("5 000 ans", "fr")).toBe("sɛ̃k mil ˈɑ̃"); // ⚠ NBSP U+00A0 — looks identical above; FLEURS writes this one
        expect(phonemize("1 040 km", "fr")).toBe("mil kaʁɑ̃t kilɔmˈɛtʁ");
    });

    test("dates: day 1 is the only ordinal day", () => {
        expect(phonemize("le 1 janvier", "fr")).toBe("lə pʁømje ʒɑ̃vjˈe"); // premier, not un
        expect(phonemize("le 17 septembre", "fr")).toBe("lə disɛt sɛptˈɑ̃bʁ"); // every other day is a cardinal
        expect(phonemize("le 14/07/1789", "fr")).toBe("lə katɔʁz ʒɥijɛ mil sɛt sɑ̃ katʁəvɛ̃nˈœf");
        // French reads a year as a plain cardinal, so there is no pair-wise rule to apply.
        expect(phonemize("en 1988", "fr")).toBe("ɑ̃ mil nœf sɑ̃ katʁəvɛ̃ɥˈit");
    });

    test("abbreviations: expanded, and the dot never becomes a pause", () => {
        expect(phonemize("M. Dupont", "fr")).toBe("məsjø dypˈɔ̃"); // was "m . dypɔ̃" — a letter and a pause
        expect(phonemize("MM. les députés", "fr")).toBe("mesjø le depytˈe"); // was millimètre + a pause
        expect(phonemize("le Dr Martin", "fr")).toBe("lə dɔktœʁ maʁtˈɛ̃"); // undotted, as French writes it
        expect(phonemize("st. louis", "fr")).toBe("sɛ̃ lwˈi"); // saint
        expect(phonemize("avant j.-c.", "fr")).toBe("avɑ̃ ʒezykʁˈist"); // was "avɑ̃ ʒ . s ." — two pauses
        expect(phonemize("au n° 11", "fr")).toBe("o nymeʁo ˈɔ̃z"); // numéro
        // etc. is left as a TOKEN because Lexique already pronounces it; expanding it to "et cetera" made
        // the g2p read cetera with a schwa. Only the dot is managed — kept here, as the sentence ends.
        expect(phonemize("etc.", "fr")).toBe("ɛtseteʁˈa .");
    });

    test("initialisms: spelled out or said as a word, per convention then phonotactics", () => {
        expect(phonemize("la SNCF", "fr")).toBe("la ɛs ɛn se ˈɛf"); // was the cluster [snkf]
        expect(phonemize("le TGV", "fr")).toBe("lə te ʒe vˈe"); // was DROPPED from the output entirely
        expect(phonemize("les USA", "fr")).toBe("le zy ɛs ˈa"); // readable, but conventionally spelled out
        // ⚠ Lexicalized acronyms stay WORDS — an initialism rule with no exception list spells these out.
        expect(phonemize("l'ONU", "fr")).toBe("lɔnˈy");
        expect(phonemize("l'UNESCO", "fr")).toBe("lynɛskˈo");
        // An all-caps ordinary word is not an initialism, and a Roman numeral gets first refusal.
        expect(phonemize("PARIS est belle", "fr")).toContain("paʁi");
        expect(phonemize("Louis XIV", "fr")).toBe("lwi katˈɔʁz"); // not IXE-I-VÉ
    });

    test("fractions, decimals, negatives, units", () => {
        expect(phonemize("1/2", "fr")).toBe("œ̃ dəmˈi");
        expect(phonemize("les 3/4 du total", "fr")).toBe("le tʁwa kaʁ dy tɔtˈal"); // quarts
        expect(phonemize("1/5", "fr")).toBe("œ̃ sɛ̃kjˈɛm"); // no suppletive name → the ordinal
        // The fractional part reads as a NUMBER (1,75 → soixante-quinze), which is the French convention…
        expect(phonemize("3,14", "fr")).toBe("tʁwa viʁɡyl katˈɔʁz"); // …quatorze, not "un quatre"
        // …except with a leading zero, where a number reading would say 1,5 for 1,05.
        expect(phonemize("1,05", "fr")).toBe("œ̃ viʁɡyl zeʁo sˈɛ̃k");
        expect(phonemize("-5 degrés", "fr")).toBe("mwɛ̃ sɛ̃k dəɡʁˈe"); // the minus was silently dropped
        expect(phonemize("160 km/h", "fr")).toBe("sɑ̃ swasɑ̃t kilɔmɛtʁ paʁ ˈœʁ"); // the /h was dropped
        expect(phonemize("3 Go", "fr")).toBe("tʁwa ʒiɡaɔktˈɛ"); // read as the word "go"
    });

    test("money, plus sign, and alphanumeric codes", () => {
        // A price read as a decimal is wrong in a way listeners notice.
        expect(phonemize("il coûte 2,50 €", "fr")).toBe("il kut dø zøʁo sɛ̃kˈɑ̃t"); // deux euros cinquante
        expect(phonemize("5,99 €", "fr")).toBe("sɛ̃k øʁo katʁəvɛ̃diznˈœf");
        // The plus is spelled "plusse" deliberately: `plus` is a heteronym ([ply] "more" vs [plys] the
        // operator) and Lexique carries only the [ply] reading.
        expect(phonemize("un +5", "fr")).toBe("œ̃ plys sˈɛ̃k");
        expect(phonemize("utc+1", "fr")).toBe("ytk plys ˈœ̃");
        // Letters attached to digits are a code; French previously DROPPED the G of CG entirely.
        expect(phonemize("le vol CG4684", "fr")).toContain("se ʒe");
    });

    // HETERONYMS (french.jsonc + the resolver in french.ts): one spelling, two readings, selected by the
    // neighbouring words. French has no POS tagger and Lexique carries a single reading per spelling.
    test("heteronyms: latent final consonant", () => {
        // The case that motivated the map: the arithmetic operator sounds its s, "more" does not.
        expect(phonemize("un +5", "fr")).toBe("œ̃ plys sˈɛ̃k");
        expect(phonemize("il n'y en a plus", "fr")).toBe("il ni ɑ̃ na plˈy");
        // ...and a word with no case matching keeps its liaison, which the operator reading suppresses.
        expect(phonemize("de plus en plus", "fr")).toBe("də ply zɑ̃ plˈy");
        expect(phonemize("tous les jours", "fr")).toBe("tu le ʒˈuʁ"); // determiner
        expect(phonemize("ils sont tous venus", "fr")).toBe("il sɔ̃ tus vənˈy"); // pronoun
        expect(phonemize("un os", "fr")).toBe("œ̃ nˈɔs"); // singular
        expect(phonemize("des os", "fr")).toBe("de zˈo"); // plural — the s goes silent
        expect(phonemize("un as", "fr")).toBe("œ̃ nˈɑs"); // the noun
        expect(phonemize("tu as vu", "fr")).toBe("ty a vˈy"); // the verb
        expect(phonemize("le sens du mot", "fr")).toBe("lə sɑ̃s dy mˈo");
        expect(phonemize("je sens", "fr")).toBe("ʒə sˈɑ̃");
        expect(phonemize("une vis", "fr")).toBe("yn vˈis");
        expect(phonemize("je vis ici", "fr")).toBe("ʒə vi isˈi");
        expect(phonemize("nous portions", "fr")).toBe("nu pɔʁtjˈɔ̃"); // verb
        expect(phonemize("des portions", "fr")).toBe("de pɔʁsjˈɔ̃"); // noun
    });

    test("heteronyms: the silent 3rd-person-plural -ent", () => {
        // Every -ent noun/adjective is a homograph of a verb, because the 3pl ending is silent. Gated on
        // ils/elles only — high precision on purpose, since reading "le président" as a verb is far worse
        // than missing a full-NP subject.
        expect(phonemize("ils content les points", "fr")).toBe("il kɔ̃t le pwˈɛ̃");
        expect(phonemize("il est content", "fr")).toBe("il e kɔ̃tˈɑ̃");
        expect(phonemize("ils ne content pas", "fr")).toBe("il nə kɔ̃t pˈa"); // past an intervening clitic
        expect(phonemize("ils président la séance", "fr")).toBe("il pʁezid la seˈɑ̃s");
        expect(phonemize("le président", "fr")).toBe("lə pʁezidˈɑ̃");
        expect(phonemize("ils couvent les œufs", "fr")).toBe("il kuv le zˈœf");
        expect(phonemize("le couvent", "fr")).toBe("lə kuvˈɑ̃");
        expect(phonemize("ils violent la loi", "fr")).toBe("il vjɔl la lwˈa");
        expect(phonemize("un homme violent", "fr")).toBe("œ̃ nɔm vjɔlˈɑ̃");
        // The -ent set is GENERATED by tools/french/heteronym-candidates.ts. Two rows it settled:
        // `excellent` had a hand-written [eksɛl], copying the noun's first vowel, where Lexique's own 3sg
        // `excelle` is [ɛksɛl] — the 3sg wins, being an actual verb form.
        expect(phonemize("ils excellent en maths", "fr")).toBe("il zɛksɛl ɑ̃ mˈat");
        expect(phonemize("un excellent repas", "fr")).toBe("œ̃ neksɛlɑ̃ ʁəpˈa");
        // ...and `pressent` is a real double, disambiguated by NUMBER: "ils pressent" (they press) vs
        // "il pressent" (he senses, from pressentir).
        expect(phonemize("ils pressent le bouton", "fr")).toBe("il pʁɛs lə butˈɔ̃");
        expect(phonemize("il pressent un danger", "fr")).toBe("il pʁesɑ̃ œ̃ dɑ̃ʒˈe");
        expect(phonemize("ils influent sur le vote", "fr")).toBe("il zɛ̃fly syʁ lə vˈɔt");
        expect(phonemize("un homme influent", "fr")).toBe("œ̃ nɔm ɛ̃flyˈɑ̃");
    });

    test("supplement.tsv covers the words Lexique lacks", () => {
        // normalize.ts emits words the corpus never contained, so words that were previously unreachable
        // are now on the hot path. These three are absent from Lexique and the rule g2p got them wrong.
        // They live in a separate file from lexicon.tsv, which is CC-BY-SA Lexique data.
        expect(phonemize("20 °C", "fr")).toBe("vɛ̃ dəɡʁe sɛlsjˈys"); // final s sounded, was [sɛlsjy]
        expect(phonemize("50 kW", "fr")).toBe("sɛ̃kɑ̃t kilowˈat"); // was [kilɔva] — w voiced, tt dropped
        expect(phonemize("cf. page 12", "fr")).toBe("kɔ̃fɛʁ paʒ dˈuz"); // confer, was [kɔ̃fe]
        expect(phonemize("68 °F", "fr")).toBe("swasɑ̃tɥit dəɡʁe faʁɛnˈajt"); // fahrenheit IS in Lexique
    });

    test("isUnreadableFrench decides the unrecorded acronyms", () => {
        // The signal it exists for: no vowel means nothing can be syllabified, which is exactly the case
        // that produced an unpronounceable cluster or an empty reading.
        for (const w of ["SNCF", "TGV", "PDG", "HLM", "CD"]) expect(isUnreadableFrench(w)).toBe(true);
        // Illegal initial (/tv/) and final (/tp/, /df/) clusters, which French cannot realise.
        for (const w of ["TVA", "RATP", "EDF"]) expect(isUnreadableFrench(w)).toBe(true);
        // Readable strings are left readable, so a lexicalized acronym is said as a word.
        for (const w of ["ONU", "OTAN", "UNESCO", "SMIC", "SIDA", "NASA", "PACS"])
            expect(isUnreadableFrench(w)).toBe(false);
    });

    test("text: phrase-final stress + punctuation, monosyllable le → lə", () => {
        expect(phonemize("Bonjour le monde.", "fr")).toBe("bɔ̃ʒuʁ lə mˈɔ̃d .");
        expect(phonemize("Je mange une pomme.", "fr")).toBe("ʒə mɑ̃ʒ yn pˈɔm .");
    });

    // Liaison: a latent final consonant surfaces as the onset of a following vowel-initial word (z/n/t);
    // h aspiré blocks it. Elision (l', c') is handled by the tokenizer + lexicon.
    test("liaison across words, h aspiré blocks", () => {
        expect(phonemize("les amis", "fr")).toBe("le zamˈi"); // z-liaison
        expect(phonemize("un ami", "fr")).toBe("œ̃ namˈi"); // n-liaison (nasal)
        expect(phonemize("petit ami", "fr")).toBe("pəti tamˈi"); // t-liaison
        expect(phonemize("c'est ici", "fr")).toBe("sɛ tisˈi"); // elided c'est → s, t-liaison
        expect(phonemize("deux ans", "fr")).toBe("dø zˈɑ̃"); // number liaison
        expect(phonemize("les héros", "fr")).toBe("le eʁˈo"); // h aspiré → NO liaison
        expect(phonemize("les homards", "fr")).toBe("le ɔmˈaʁ"); // h aspiré, no liaison; standard ⟨o⟩→ɔ (homard=ɔmaʁ)
        expect(phonemize("les hommes", "fr")).toBe("le zˈɔm"); // h muet → liaison DOES fire
        expect(phonemize("les chats", "fr")).toBe("le ʃˈa"); // consonant-initial → no liaison
        expect(phonemize("cet homme", "fr")).toBe("sɛ tˈɔm"); // latent t not doubled (cet→sɛt)
        expect(phonemize("six ans", "fr")).toBe("si zˈɑ̃"); // latent s→z not doubled (six→sis)
    });

    // g2p OOV convention aligned to the lexicon (Lexique): o open/closed, citation schwa, obstruent+liquid onset.
    test("g2p OOV o/ɔ loi de position (standard: ⟨o⟩→ɔ by default; [o] only final-open/before-z)", () => {
        expect(toIpa("comment")).toBe("kɔmɑ̃"); // geminate closes → ɔ (standard, not Lexique's [o])
        expect(toIpa("problème")).toBe("pʁɔblɛm"); // bare ⟨o⟩ → ɔ even in an open onset syllable
        expect(toIpa("hommes")).toBe("ɔm"); // geminate coda → closed ɔ
        expect(toIpa("choses")).toBe("ʃoz"); // before z (-ses→z) → [o]
        expect(toIpa("croire")).toBe("kʁwaʁ"); // wa nucleus recognised → final e silent (not schwa)
    });

    // `km²` read as a bare *kilomètre* with the power dropped. `kilomètres carrés` ×9 and
    // `mètres cubes` ×2 in the corpus; the adjective agrees, so both count forms are declared.
    test("the squared/cubed measure word", () => {
        expect(phonemize("783 562 km²", "fr")).toContain("kilɔmɛtʁ kaʁˈe");
        expect(phonemize("120 m³", "fr")).toContain("mɛtʁ kˈyb");
    });
});
