# Unicode scripts vs. the fleet

Every script Unicode encodes, with a sample, the language it most represents, whether this project reads
it, and whether it is a plausible G2P target at all.

**Supported** — measured against `src/core/scripts.ts` (the cross-script routing table), not against wishes:

| Mark | Meaning |
| --- | --- |
| ✅ | Routed. `ScriptName` in [scripts.ts](src/core/scripts.ts) — a run in this script inside any host language is detected and handed to a reader. |
| ◐ | Engine-internal. One language's front-end transliterates it, but it is not in the cross-script routing table, so a run of it inside *another* language's text is not picked up. |
| ❌ | Not supported. |

**G2P suitability** — can an orthography→phoneme mapping be built for the language this script carries?

| Tier | Meaning |
| --- | --- |
| **High** | Living, standardized orthography whose sound values are derivable by rule (plus a lexicon for the residue). |
| **Medium** | Real orthography, but defective or deep — abjads needing vowel restoration, logographs needing a reading dictionary, deep historical spellings, or living scripts with no standard. |
| **Low** | Extinct, undeciphered, dormant, or so recent/small that no corpus and no attested phonology exist to validate against. |
| **N/A** | Not a language orthography at all — a transcription encoding or a notation system, orthogonal to any one language. |

34 of the entries below are routed (Hiragana and Katakana share one `Kana` route), covering the overwhelming
majority of living text; Mongolian is engine-internal.

---

## Scripts

| Version (Year) | Script | Sample | Representative language | Supported | G2P suitability |
| --- | --- | --- | --- | --- | --- |
| 9.0 (2016) | Adlam | 𞤀𞤁𞤂 | Fula (Pular) | ✅ | **High** — purpose-built phonemic alphabet |
| 8.0 (2015) | Ahom | 𑜀𑜁𑜂 | Ahom (liturgical Tai) | ❌ | **Low** — no speakers; readings reconstructed |
| 8.0 (2015) | Anatolian Hieroglyphs | 𔐀𔐁𔐂 | Luwian | ❌ | **Low** — extinct, decipherment partial |
| 1.1 (1993) | Arabic | ابجد | Arabic (also fa, ur, ps, sd, ug) | ✅ | **Medium** — abjad; short vowels unwritten and must be restored |
| 1.1 (1993) | Armenian | ԱԲԳԴ | Armenian | ✅ | **High** — near one-to-one |
| 5.2 (2009) | Avestan | 𐬀𐬁𐬂 | Avestan | ❌ | **Medium** — fully vocalized, phonetically explicit, but liturgical only |
| 5.0 (2006) | Balinese | ᬅᬆᬇ | Balinese | ❌ | **High** — living abugida; a real gap |
| 5.2 (2009) | Bamum | ꚠꚡꚢ | Bamum | ❌ | **Medium** — syllabary, living but small and tone unwritten |
| 7.0 (2014) | Bassa Vah | 𖫐𖫑𖫒 | Bassa | ❌ | **Medium** — alphabetic with tone marks; near-negligible corpus |
| 6.0 (2010) | Batak | ᯀᯁᯂ | Toba Batak | ❌ | **Medium** — abugida, now largely ceremonial |
| 1.1 (1993) | Bengali | অআই | Bengali (also Assamese) | ✅ | **High** |
| 17.0 (2025) | Beria Erfe | — | Zaghawa | ❌ | **Low** — very recent, no corpus |
| 9.0 (2016) | Bhaiksuki | 𑰀𑰁𑰂 | Sanskrit (Buddhist mss.) | ❌ | **Low** — extinct manuscript script |
| 1.1 (1993) | Bopomofo | ㄅㄆㄇㄈ | Mandarin (annotation) | ❌ | **N/A as an orthography** — but it *is* a phoneme stream; useful as a Han pronunciation source, not as input text |
| 6.0 (2010) | Brahmi | 𑀃𑀄𑀅 | Prakrit / Sanskrit | ❌ | **Low** — extinct ancestor of the Indic abugidas |
| 3.0 (1999) | Braille (patterns) | ⠁⠃⠉⠙ | none — any language | ❌ | **N/A** — a transcription encoding orthogonal to language; would need per-language back-transcription first |
| 4.1 (2005) | Buginese | ᨀᨁᨂ | Buginese | ❌ | **Medium** — badly defective abugida (finals and gemination unwritten) |
| 3.2 (2002) | Buhid | ᝀᝁᝂ | Buhid | ❌ | **Low** — a few thousand users, near-dormant |
| 3.0 (1999) | Canadian Syllabics | ᐁᐂᐃ | Inuktitut, Plains Cree | ❌ | **High** — regular syllabary, living and standardized; the biggest unclaimed win here |
| 5.1 (2008) | Carian | 𐊠𐊡𐊢 | Carian | ❌ | **Low** — extinct, partly deciphered |
| 7.0 (2014) | Caucasian Albanian | 𐔰𐔱𐔲 | Caucasian Albanian (Udi ancestor) | ❌ | **Low** — extinct |
| 6.1 (2012) | Chakma | 𑄃𑄄𑄅 | Chakma | ❌ | **Medium** — living abugida, small standardized corpus |
| 5.1 (2008) | Cham | ꨀꨁꨂ | Eastern Cham | ❌ | **Medium** — living but deep orthography |
| 3.0 (1999) | Cherokee | ᎠᎡᎢ | Cherokee | ✅ | **High** — syllabary, one glyph one syllable |
| 13.0 (2020) | Chorasmian | 𐾰𐾱𐾲 | Chorasmian | ❌ | **Low** — extinct Aramaic-derived abjad |
| 4.1 (2005) | Coptic | ⲀⲂⲄⲆ | Coptic | ❌ | **Medium** — alphabetic and vocalized, but liturgical and pronunciation reconstructed |
| 4.0 (2003) | Cypriot | 𐠀𐠁𐠂 | Arcadocypriot Greek | ❌ | **Low** — extinct syllabary, heavily ambiguous |
| 14.0 (2021) | Cypro-Minoan | 𒾐𒾑𒾒 | unknown | ❌ | **N/A** — undeciphered; the language is not even identified |
| 1.1 (1993) | Cyrillic | АБВГ | Russian (+ ~20 more) | ✅ | **High** |
| 3.1 (2001) | Deseret | 𐐀𐐁𐐂 | English (spelling reform) | ❌ | **High in principle** — designed phonemic; no corpus to serve |
| 1.1 (1993) | Devanagari | अआइ | Hindi (also mr, ne, and 6 more) | ✅ | **High** — with schwa deletion as the one hard rule |
| 13.0 (2020) | Dives Akuru | 𑤀𑤁𑤂 | Old Maldivian | ❌ | **Low** — historic; Dhivehi moved to Thaana |
| 11.0 (2018) | Dogra | 𑠀𑠁𑠂 | Dogri (historic) | ❌ | **Low** — Dogri is written in Devanagari now |
| 7.0 (2014) | Duployan (shorthand) | 𛰀𛰁𛰂 | French / English shorthand | ❌ | **N/A** — a stenographic notation, not an orthography |
| 5.2 (2009) | Egyptian Hieroglyphs | 𓀀𓀁𓀂 | Ancient Egyptian | ❌ | **Low** — consonantal skeleton only; vowels unrecoverable |
| 7.0 (2014) | Elbasan | 𐔀𐔁𐔂 | Albanian (historic) | ❌ | **Low** — 18th-c. manuscript script |
| 12.0 (2019) | Elymaic | 𐿠𐿡𐿢 | Elymaic Aramaic | ❌ | **Low** — extinct |
| 3.0 (1999) | Ethiopic | ሀሁሂ | Amharic (also Tigrinya) | ✅ | **High** — abugida; gemination and epenthetic ə are the residue |
| 16.0 (2024) | Garay | 𐵊𐵋𐵌 | Wolof | ❌ | **Medium** — phonemic alphabet, but Wolof text is overwhelmingly Latin |
| 1.1 (1993) | Georgian | აბგდ | Georgian | ✅ | **High** — essentially one-to-one |
| 4.1 (2005) | Glagolitic | ⰀⰁⰂ | Old Church Slavonic | ❌ | **Medium** — alphabetic and readable, but liturgical/extinct |
| 3.1 (2001) | Gothic | 𐌰𐌱𐌲 | Gothic | ❌ | **Low** — extinct; values reconstructed |
| 7.0 (2014) | Grantha | 𑌅𑌆𑌇 | Sanskrit (Tamil country) | ❌ | **Medium** — abugida, but liturgical use only |
| 1.1 (1993) | Greek | ΑΒΓΔ | Greek (also Ancient Greek) | ✅ | **High** |
| 1.1 (1993) | Gujarati | અઆઇ | Gujarati | ✅ | **High** |
| 11.0 (2018) | Gunjala Gondi | 𑵠𑵡𑵢 | Gondi | ❌ | **Low** — revival script, negligible corpus |
| 1.1 (1993) | Gurmukhi | ਅਆਇ | Punjabi | ✅ | **High** — tone derivable from the historic voiced-aspirate series |
| 16.0 (2024) | Gurung Khema | 𖄀𖄁𖄂 | Gurung | ❌ | **Low** — very recent encoding |
| 1.1 (1993) | Han | 漢字 | Mandarin (also yue, ja, ko, and Sawndip for za) | ✅ ◐ | **Medium** — logographic: readings are lexical, never derivable; needs a dictionary plus tone sandhi. Sawndip (Zhuang) is the ◐ half — engine-internal |
| 1.1 (1993) | Hangul | 한글 | Korean | ✅ | **High** — featural; deep morphophonology but fully rule-governed |
| 11.0 (2018) | Hanifi Rohingya | 𐴀𐴁𐴂 | Rohingya | ❌ | **High** — fully vocalized and tone-marked alphabet; a clean target |
| 3.2 (2002) | Hanunóo | ᜠᜡᜢ | Hanunoo | ❌ | **Low** — very small user base |
| 8.0 (2015) | Hatran | 𐣠𐣡𐣢 | Hatran Aramaic | ❌ | **Low** — extinct |
| 1.1 (1993) | Hebrew | אבגד | Hebrew (also Yiddish, Ladino) | ✅ | **Medium** — abjad; unpointed text needs vowel restoration |
| 1.1 (1993) | Hiragana | あいうえ | Japanese | ✅ (Kana) | **High** — moraic, near one-to-one; pitch accent is lexical |
| 5.2 (2009) | Imperial Aramaic | 𐡀𐡁𐡂 | Imperial Aramaic | ❌ | **Low** — extinct abjad |
| 5.2 (2009) | Inscriptional Pahlavi | 𐭠𐭡𐭢 | Middle Persian | ❌ | **Low** — heterograms make it write one language and read another |
| 5.2 (2009) | Inscriptional Parthian | 𐭀𐭁𐭂 | Parthian | ❌ | **Low** — same heterogram problem |
| 5.2 (2009) | Javanese | ꦄꦅꦆ | Javanese | ✅ | **High** — Aksara Jawa routes to the same `jv` engine as Latin |
| 5.2 (2009) | Kaithi | 𑂃𑂄𑂅 | Bhojpuri / Magahi (historic) | ❌ | **Medium** — readable abugida, but a historic administrative hand |
| 1.1 (1993) | Kannada | ಅಆಇ | Kannada | ✅ | **High** |
| 1.1 (1993) | Katakana | アイウエ | Japanese | ✅ (Kana) | **High** |
| 15.0 (2022) | Kawi | 𑼂𑼄𑼅 | Old Javanese | ❌ | **Low** — historic ancestor of Aksara Jawa |
| 5.1 (2008) | Kayah Li | ꤊꤋꤌ | Kayah (Karenni) | ❌ | **Medium** — living, alphabetic with tone diacritics, small |
| 4.1 (2005) | Kharoshthi | 𐨀𐨐𐨑 | Gandhari Prakrit | ❌ | **Low** — extinct |
| 13.0 (2020) | Khitan Small Script | 𘬀𘬁𘬂 | Khitan | ❌ | **Low** — only partly deciphered |
| 3.0 (1999) | Khmer | កខគ | Khmer | ✅ | **Medium** — abugida with a deep orthography: two vowel registers, silent finals |
| 7.0 (2014) | Khojki | 𑈀𑈁𑈂 | Sindhi (Ismaili) | ❌ | **Low** — devotional manuscript use |
| 7.0 (2014) | Khudawadi | 𑊰𑊱𑊲 | Sindhi (historic) | ❌ | **Low** — superseded by Perso-Arabic |
| 16.0 (2024) | Kirat Rai | 𖵀𖵁𖵂 | Bantawa | ❌ | **Low** — very recent encoding |
| 1.1 (1993) | Lao | ກຂຄ | Lao | ✅ | **High** — shallow; tone derivable from class + mark |
| 1.1 (1993) | Latin | ABCD | English (+ ~150 fleet languages) | ✅ | **Varies by language** — High for shallow orthographies (es, fi, tr), Medium for deep ones (en, fr, ga) |
| 5.1 (2008) | Lepcha | ᰀᰁᰂ | Lepcha | ❌ | **Medium** — living but very small |
| 4.0 (2003) | Limbu | ᤀᤁᤂ | Limbu | ❌ | **Medium** — living, standardized, small |
| 7.0 (2014) | Linear A | 𐘀𐘁𐘂 | unknown (Minoan) | ❌ | **N/A** — undeciphered |
| 4.0 (2003) | Linear B | 𐀀𐀁𐀂 | Mycenaean Greek | ❌ | **Low** — defective syllabary: clusters and finals unwritten |
| 5.2 (2009) | Lisu | ꓐꓑꓒ | Lisu | ❌ | **High** — fully phonemic with tone letters; a clean unclaimed target |
| 5.1 (2008) | Lycian | 𐊀𐊁𐊂 | Lycian | ❌ | **Low** — extinct |
| 5.1 (2008) | Lydian | 𐤠𐤡𐤢 | Lydian | ❌ | **Low** — extinct |
| 7.0 (2014) | Mahajani | 𑅐𑅑𑅒 | Marwari / Hindi (ledger hand) | ❌ | **Low** — vowel-defective merchant shorthand |
| 11.0 (2018) | Makasar | 𑻠𑻡𑻢 | Makasarese | ❌ | **Low** — extremely defective abugida |
| 1.1 (1993) | Malayalam | അആഇ | Malayalam | ✅ | **High** |
| 6.0 (2010) | Mandaic | ࡀࡁࡂ | Mandaic | ❌ | **Medium** — vowels are written; tiny living community plus liturgy |
| 7.0 (2014) | Manichaean | 𐫀𐫁𐫂 | Middle Persian / Sogdian | ❌ | **Low** — extinct |
| 9.0 (2016) | Marchen | 𑱲𑱳𑱴 | Zhang-Zhung | ❌ | **Low** — extinct, ritual |
| 10.0 (2017) | Masaram Gondi | 𑴀𑴁𑴂 | Gondi | ❌ | **Low** — revival script, negligible corpus |
| 11.0 (2018) | Medefaidrin | 𖹀𖹁𖹂 | Medefaidrin | ❌ | **Low** — constructed, near-dormant |
| 5.2 (2009) | Meetei Mayek | ꫠꫡꫢ | Meitei (Manipuri) | ❌ | **High** — official, living, regular abugida; the best-supported gap on this list |
| 7.0 (2014) | Mende Kikakui | 𞠀𞠁𞠂 | Mende | ❌ | **Low** — syllabary, near-dormant |
| 6.1 (2012) | Meroitic Cursive | 𐦠𐦡𐦢 | Meroitic | ❌ | **Low** — signs readable, language undeciphered |
| 6.1 (2012) | Meroitic Hieroglyphs | 𐦀𐦁𐦂 | Meroitic | ❌ | **Low** — same |
| 6.1 (2012) | Miao | 𖼀𖼁𖼂 | A-Hmao (Pollard) | ❌ | **High** — systematic; tone encoded by vowel placement |
| 7.0 (2014) | Modi | 𑘀𑘁𑘂 | Marathi (historic) | ❌ | **Low** — Marathi is Devanagari now |
| 3.0 (1999) | Mongolian | ᠠᠡᠢ | Mongolian | ◐ | **Medium** — deep historical orthography; [mongolBichig.ts](src/languages/mongolian/mongolBichig.ts) transliterates to Cyrillic and reuses the `mn` engine, but it is not in the routing table |
| 7.0 (2014) | Mro | 𖩀𖩁𖩂 | Mro | ❌ | **Low** — very small |
| 8.0 (2015) | Multani | 𑊀𑊁𑊂 | Saraiki (historic) | ❌ | **Low** — superseded by Perso-Arabic |
| 3.0 (1999) | Myanmar | ကခဂ | Burmese (also Shan, Mon) | ✅ | **Medium** — deep orthography, stacked finals, no word spacing |
| 5.0 (2006) | N'Ko | ߊߋߌ | Manding (Bambara, Maninka) | ✅ | **High** — alphabetic and tone-marked |
| 7.0 (2014) | Nabataean | 𐢀𐢁𐢂 | Nabataean Aramaic | ❌ | **Low** — extinct |
| 15.0 (2022) | Nag Mundari | 𞓐𞓑𞓒 | Mundari | ❌ | **Medium** — phonemic by design, but encoded only in 2022 |
| 12.0 (2019) | Nandinagari | 𑦠𑦡𑦢 | Sanskrit (historic) | ❌ | **Low** — manuscript script |
| 4.1 (2005) | New Tai Lue | ᦀᦁᦂ | Tai Lue | ❌ | **Medium** — living, standardized, small |
| 9.0 (2016) | Newa | 𑐀𑐁𑐂 | Newar | ❌ | **Medium** — revival alongside Devanagari |
| 10.0 (2017) | Nushu | 𛅰𛅱𛅲 | Xiangnan Tuhua | ❌ | **Low** — dormant syllabary, no living writers |
| 12.0 (2019) | Nyiakeng Puachue Hmong | 𞄀𞄁𞄂 | Hmong (White / Green) | ❌ | **High in principle** — phonemic with tone; the fleet's `hmn` engine reads RPA Latin instead |
| 3.0 (1999) | Ogham | ᚁᚂᚃ | Primitive Irish | ❌ | **Low** — extinct, inscriptional |
| 5.1 (2008) | Ol Chiki | ᱚᱛᱜ | Santali | ✅ | **High** — purpose-built phonemic alphabet |
| 16.0 (2024) | Ol Onal | 𞗐𞗑𞗒 | Ho | ❌ | **Low** — very recent encoding |
| 8.0 (2015) | Old Hungarian | 𐲀𐲁𐲂 | Old Hungarian | ❌ | **Medium** — revivalist use maps onto modern Hungarian phonology |
| 3.1 (2001) | Old Italic | 𐌀𐌁𐌂 | Etruscan, Oscan | ❌ | **Low** — extinct |
| 7.0 (2014) | Old North Arabian | 𐪀𐪁𐪂 | Ancient North Arabian | ❌ | **Low** — extinct abjad |
| 7.0 (2014) | Old Permic | 𐍐𐍑𐍒 | Old Komi | ❌ | **Low** — historic |
| 4.1 (2005) | Old Persian Cuneiform | 𐎠𐎡𐎢 | Old Persian | ❌ | **Medium** — semi-syllabic and largely readable, but extinct |
| 11.0 (2018) | Old Sogdian | 𐼀𐼁𐼂 | Sogdian | ❌ | **Low** — extinct |
| 5.2 (2009) | Old South Arabian | 𐩠𐩡𐩢 | Sabaean | ❌ | **Low** — extinct abjad |
| 5.2 (2009) | Old Turkic | 𐰀𐰁𐰂 | Old Turkic (Orkhon) | ❌ | **Low** — extinct, inscriptional |
| 14.0 (2021) | Old Uyghur | 𐽰𐽱𐽲 | Old Uyghur | ❌ | **Low** — extinct |
| 1.1 (1993) | Oriya | ଅଆଇ | Odia | ✅ | **High** |
| 9.0 (2016) | Osage | 𐒰𐒱𐒲 | Osage | ❌ | **High in principle** — modern phonemic alphabet; revitalization-scale corpus |
| 4.0 (2003) | Osmanya | 𐒀𐒁𐒂 | Somali | ❌ | **High in principle** — phonemic; Somali writes Latin in practice |
| 7.0 (2014) | Pahawh Hmong | 𖬀𖬁𖬂 | Hmong Daw | ❌ | **Medium** — semi-syllabic with rime-first ordering; phonemic and tone-marked |
| 7.0 (2014) | Palmyrene | 𐡠𐡡𐡢 | Palmyrene Aramaic | ❌ | **Low** — extinct |
| 7.0 (2014) | Pau Cin Hau | 𑫀𑫁𑫂 | Tedim Chin | ❌ | **Low** — near-dormant |
| 5.0 (2006) | Phags-pa | ꡀꡁꡂ | Mongolian, Chinese (Yuan) | ❌ | **Low** — historic, though phonetically explicit for its era |
| 5.0 (2006) | Phoenician | 𐤀𐤁𐤂 | Phoenician / Punic | ❌ | **Low** — extinct abjad, no vowels |
| 7.0 (2014) | Psalter Pahlavi | 𐮀𐮁𐮂 | Middle Persian | ❌ | **Low** — extinct |
| 5.1 (2008) | Rejang | ꤰꤱꤲ | Rejang | ❌ | **Low** — near-dormant |
| 3.0 (1999) | Runic | ᚠᚡᚢ | Old Norse, Old English | ❌ | **Medium** — alphabetic and readable, but extinct and reconstructed |
| 5.2 (2009) | Samaritan | ࠀࠁࠂ | Samaritan Hebrew / Aramaic | ❌ | **Low** — liturgical, a few hundred users |
| 5.1 (2008) | Saurashtra | ꢂꢃꢄ | Saurashtra | ❌ | **Medium** — living abugida, small |
| 6.1 (2012) | Sharada | 𑆃𑆄𑆅 | Kashmiri / Sanskrit (historic) | ❌ | **Low** — manuscript script |
| 4.0 (2003) | Shavian | 𐑐𐑑𐑒 | English (spelling reform) | ❌ | **High in principle** — one-to-one with RP phonemes by construction; no corpus |
| 7.0 (2014) | Siddham | 𑖀𑖁𑖂 | Sanskrit (Buddhist) | ❌ | **Low** — liturgical/ornamental |
| 17.0 (2025) | Sidetic | — | Sidetic | ❌ | **Low** — extinct, tiny inscription corpus |
| 3.0 (1999) | Sinhala | අආඇ | Sinhala | ✅ | **High** |
| 11.0 (2018) | Sogdian | 𐼰𐼱𐼲 | Sogdian | ❌ | **Low** — extinct |
| 6.1 (2012) | Sora Sompeng | 𑃐𑃑𑃒 | Sora | ❌ | **Low** — very small |
| 10.0 (2017) | Soyombo | 𑩐𑩜𑩝 | Mongolian / Tibetan / Sanskrit | ❌ | **Low** — historic, ornamental |
| 5.0 (2006) | Sumero-Akkadian Cuneiform | 𒀀𒀁𒀂 | Akkadian, Sumerian | ❌ | **Low** — polyvalent signs; readings reconstructed |
| 5.1 (2008) | Sundanese | ᮃᮄᮅ | Sundanese | ✅ | **High** — Aksara Sunda, shallow |
| 16.0 (2024) | Sunuwar | 𑯀𑯁𑯂 | Sunuwar | ❌ | **Low** — very recent encoding |
| 8.0 (2015) | Sutton SignWriting | 𝠀𝠁𝠂 | sign languages (ASL, LSF…) | ❌ | **N/A** — visual-gestural notation; there is no spoken phoneme stream to produce |
| 4.1 (2005) | Syloti Nagri | ꠀꠁꠃ | Sylheti | ✅ | **High** |
| 3.0 (1999) | Syriac | ܐܒܓ | Syriac, Neo-Aramaic | ❌ | **Medium** — abjad with optional pointing; liturgical plus a living Neo-Aramaic community |
| 3.2 (2002) | Tagalog | ᜀᜁᜂ | Tagalog (Baybayin) | ❌ | **Medium** — historic form drops final consonants; the modern revival adds a virama |
| 3.2 (2002) | Tagbanwa | ᝠᝡᝢ | Tagbanwa | ❌ | **Low** — near-dormant |
| 4.0 (2003) | Tai Le | ᥐᥑᥒ | Tai Nuea | ❌ | **Medium** — living, standardized, small |
| 5.2 (2009) | Tai Tham | ᨠᨡᨢ | Northern Thai (Lanna) | ❌ | **Medium** — living but deep and complex stacking |
| 5.2 (2009) | Tai Viet | ꪀꪁꪂ | Tai Dam | ❌ | **Medium** — living, small |
| 17.0 (2025) | Tai Yo | — | Tai Yo | ❌ | **Low** — just encoded, no corpus |
| 6.1 (2012) | Takri | 𑚀𑚁𑚂 | Chambeali, Dogri (historic) | ❌ | **Low** — historic |
| 1.1 (1993) | Tamil | அஆஇ | Tamil | ✅ | **High** — stop voicing is unwritten but rule-derivable from position |
| 14.0 (2021) | Tangsa | 𖩰𖩱𖩲 | Tangsa | ❌ | **Low** — very recent, multiple competing orthographies |
| 9.0 (2016) | Tangut | 𖿠𗀀𗀁 | Tangut | ❌ | **Low** — logographic, extinct, readings reconstructed |
| 1.1 (1993) | Telugu | అఆఇ | Telugu | ✅ | **High** |
| 3.0 (1999) | Thaana | ހށނ | Dhivehi | ❌ | **High** — every vowel obligatorily written; one of the cleanest G2P targets not in the fleet |
| 1.1 (1993) | Thai | กขฃ | Thai | ✅ | **Medium** — implicit vowels, tone by class + mark, and no word spacing (needs segmentation) |
| 2.0 (1996) | Tibetan | ཀཁག | Tibetan (also Dzongkha) | ✅ | **Medium** — very deep historical orthography; large prefix/suffix stacks are mostly silent |
| 4.1 (2005) | Tifinagh | ⴰⴱⴲ | Tashelhit, Central Atlas Tamazight | ✅ | **High** — alphabetic and phonemic |
| 7.0 (2014) | Tirhuta | 𑒀𑒁𑒂 | Maithili | ❌ | **Medium** — revival alongside Devanagari |
| 16.0 (2024) | Todhri | 𐗀𐗁𐗂 | Albanian (historic) | ❌ | **Low** — 18th-c. manuscript script |
| 17.0 (2025) | Tolong Siki | — | Kurukh | ❌ | **Low** — just encoded |
| 14.0 (2021) | Toto | 𞊐𞊑𞊒 | Toto | ❌ | **Low** — ~1,500 speakers |
| 16.0 (2024) | Tulu-Tigalari | 𑎀𑎁𑎂 | Tulu, Sanskrit | ❌ | **Medium** — revival for a living language, but Tulu mostly writes Kannada |
| 4.0 (2003) | Ugaritic | 𐎀𐎁𐎂 | Ugaritic | ❌ | **Low** — extinct cuneiform abjad |
| 5.1 (2008) | Vai | ꔀꔁꔂ | Vai | ❌ | **Medium** — living syllabary, but tone is unwritten |
| 14.0 (2021) | Vithkuqi | 𐕰𐕱𐕲 | Albanian (historic) | ❌ | **Low** — 19th-c. script |
| 12.0 (2019) | Wancho | 𞋀𞋁𞋂 | Wancho | ❌ | **Low** — very recent, small |
| 7.0 (2014) | Warang Citi | 𑢠𑢡𑢢 | Ho | ❌ | **Medium** — phonemic alphabet, small corpus |
| 13.0 (2020) | Yezidi | 𐺀𐺁𐺂 | Kurmanji (Yezidi religious) | ❌ | **Low** — religious manuscripts only |
| 3.0 (1999) | Yi | ꀀꀁꀂ | Nuosu (Sichuan Yi) | ❌ | **High** — standardized syllabary where one glyph is exactly one syllable *and* tone: deterministic G2P |
| 10.0 (2017) | Zanabazar Square | 𑨀𑨋𑨌 | Mongolian / Tibetan / Sanskrit | ❌ | **Low** — historic, ceremonial |

Samples for the Unicode 17.0 additions (Beria Erfe, Sidetic, Tai Yo, Tolong Siki) are shown as `—`: the
Unicode data in the local Node runtime predates 17.0, so no glyph could be pulled without guessing at
codepoints.

---

## Not scripts

Unicode's other blocks. These are not writing systems for a language, so "supported" means *does the
normalizer do something sensible with them*, not *can we phonemize them*.

| Block | Sample | Handling | Relevance to G2P |
| --- | --- | --- | --- |
| Numbers | 42, ٤٢, ४२, 一二 | ✅ | Verbalized per language by the `numbers.ts` engines — inflection, gender, and case included |
| General Diacritics | ́ ̈ ̃ | ✅ | Combining marks are normalized (NFC/NFD) before g2p; some carry phonemic weight, some don't |
| General Punctuation | , . ; — … | ✅ | Drives prosody: clause boundaries and pause insertion ([clauses.ts](src/core/clauses.ts)) |
| General Symbols | % ٪ ％ ° © | ◐ | The curated set is verbalized per language ([normalizeSymbols.ts](src/core/normalizeSymbols.ts) covers %, currency, degrees); anything outside it is unmapped |
| Mathematical Symbols | + − × ÷ = ≤ | ◐ | Only where a language has written a rule — e.g. the Latvian operator-vs-equation `=` distinction |
| Musical Symbols | 𝄞 𝅘𝅥 | ❌ | No spoken reading; unmapped |
| Technical Symbols | ⌘ ⏎ ⌫ | ❌ | Unmapped |
| Emoji | 😀 🎉 🇨🇦 | ❌ | No pictographic handling anywhere in `src/core` — these fall through unmapped. Naming them would be a translation decision, not a phonemization |
| Dingbats | ✂ ✈ ❤ | ❌ | Unmapped |
| Arrows, Blocks, Box Drawing, Geometric Shapes | → █ ▓ ● | ❌ | Layout artifacts; unmapped |
| Game Symbols | ♟ 🀄 🂡 | ❌ | Unmapped |
| Miscellaneous Symbols | ☀ ☂ ☭ | ❌ | Unmapped |
| Presentation Forms | ﷺ ﬁ ﻻ | ◐ | A **curated** subset is folded to base letters — deliberately not blanket NFKC, which [unicode.ts](src/core/unicode.ts) argues at length would corrupt decisions the engines already made (`№` → `No` breaks Bulgarian) |
| Kangxi and CJK radicals | ⼀ ⼁ 亻 | ❌ | Radicals are not characters in running text; not routed to the Han reader |
