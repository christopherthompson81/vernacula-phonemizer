# Karakalpak (kaa) native bring-up investigation

Target: **Karakalpak** (qaraqalpaq tili) — KIPCHAK Turkic, closely related to Kazakh, ~600k
speakers (Karakalpakstan, an autonomous republic in NW Uzbekistan). Since the 2016 reform the
official script is a LATIN alphabet (highly phonemic). Canonical IPA, espeak-independent. Joins
the Turkic family (sibling of Kazakh/Tatar/Bashkir).

## Run 1 — referee landscape (2026-07-27)

- **wikipron**: NO kaa (kaa_latn / kaa_cyrl both 404).
- **kaikki**: NO Karakalpak dictionary (404).
- **epitran**: NO kaa datafile.
- **English Wiktionary category** "Karakalpak terms with IPA pronunciation": 15 members, but 4 are
  junk (Arabic-letter ⟨ڴ ݣ⟩→ŋaf artifacts, one Cyrillic туўыў) → **~11 usable Latin IPA pairs**
  (the K'iche'/Chuvash MediaWiki-API avenue; literal human `{{IPA|kaa|…}}`).

🔷 **THIN single-source.** The % will be on a tiny sample and is NOT a strong quality signal (the
Tatar situation). BUT the 2016 Latin orthography is highly phonemic → the g2p is well-defined, and
the 11 pairs calibrate every vowel + the uvular series.

## Run 2 — the phonology (from the 11 pairs + the 2016 alphabet)

The 2016 Latin alphabet, with the uvular/velar choice WRITTEN (no harmony inference, unlike Kazakh):
- **Vowels**: ⟨a⟩→[ɑ] (back) vs the acute FRONT ⟨á⟩→[æ]; ⟨o⟩→[o] vs ⟨ó⟩→[ø]; ⟨u⟩→[u] vs ⟨ú⟩→[y];
  the DOTLESS ⟨ı⟩→[ɯ] vs dotted ⟨i⟩→[i]; ⟨e⟩→[e]. (basqa→bɑsˈqɑ, ásir→æˈsir, ózbek→øzˈbek, úsh→ˈyʃ,
  juldız→ʒulˈdɯz, qosıq→qoˈsɯq.)
- **Consonants**: uvular ⟨q⟩→[q] vs velar ⟨k⟩→[k]; uvular ⟨x⟩→[χ] vs ⟨h⟩→[h]; the back voiced fricative
  ⟨ǵ⟩→[ʁ] vs ⟨g⟩→[ɡ]; ⟨ń⟩→[ŋ]; ⟨j⟩→[ʒ] (joq→ˈʒoq); ⟨w⟩→[w], ⟨y⟩→[j]; digraphs ⟨sh⟩→[ʃ], ⟨ch⟩→[t͡ʃ].
- **Stress**: word-final (oxytone), backing up over one onset consonant (basqa→bɑsˈqɑ, qudaysızlıq→…ˈlɯq).

★ **The Turkish-I casing subtlety:** the dotless capital ⟨I⟩ is [ɯ] and must lowercase to ⟨ı⟩, but
JS `"I".toLowerCase()` gives the dotted ⟨i⟩=[i]. Handled explicitly (İ→i, I→ı before lowercasing) so
capitalized back-vowel words (proper nouns) keep [ɯ]: Ishan→[ɯˈʃɑn].

## Run 3 — build + validate

Self-contained greedy digraph+letter scan (karakalpak.ts). **100% folded / 100% symbol on the 12-word
referee** — but that is a TINY sample (thin single-source), so it confirms the vowel + uvular mappings
rather than proving broad accuracy. The g2p is verified on goldens (qaraqalpaq→qɑrɑqɑlˈpɑq,
ǵárezsizlik→ʁærezsizˈlik, xalıq→χɑˈlɯq, sózlik→søzˈlik). Fold: the referee's syllable-boundary dots.

## Run 4 — 2-agent review (2026-07-27)

**Phonology reviewer — engine SOUND.** Confirmed all vowels (á→æ, ó→ø, ú→y, ı→ɯ) against Kazakh
norms, the written uvular/velar series, j→ʒ (literary default), w→w, and ń+g→[ŋɡ] (no reduction).
★ Endorsed **ǵ→[ʁ]** (unverified by the referee but the standard analysis = Kazakh ғ, uvular, harmonic
with q/χ — keep). One fix: **⟨c⟩→[d͡ʒ] is a fabrication** (⟨c⟩ isn't in the 2016 alphabet — only in the
⟨ch⟩ digraph) → REMOVED. Noted-not-fixed: word-initial ⟨e⟩→[je] is a plausible Kazakh-style onglide
but allophonic + non-canonical (2016 writes plain ⟨e⟩) and unverified → left as plain [e]; and the
pre-stressing suffix classes (verbal -ma/-pa, predicative endings) can't be caught morphology-free →
the oxytone default is the standard approximation (honest residual).

**Code/wiring reviewer — 1 real bug + 1 minor.** ★ **BUG: ⟨İ⟩ (U+0130, the dotted capital of ⟨i⟩) was
missing from the TOKEN class** → `text()` dropped it and split the word (İshan keldi→"ˈʃɑn kelˈdi",
the /i/ lost). Invisible to the goldens because they call `phonemizeWord` (which handles İ), not
`text()`. FIX: added İ to the class + a `text()`-level golden. Minor: ⟨ç⟩ was in TOKEN but not the
alphabet → removed (Karakalpak uses ⟨ch⟩). Everything else (Turkish-I casing order, digraph loop, NFC,
stress guard, wiring) verified correct.

**Final: 100% folded / 100% symbol** on the 12-word referee (thin — confirms the mappings, not broad
accuracy). Floor 0.90. Goldens (4 tests incl. the text() İ/I path), the 151-test referee floor, and
typecheck all green.
