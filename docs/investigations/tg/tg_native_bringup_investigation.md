# Tajik (tg) native bring-up — ✅ verified (Persian variety, Cyrillic)

Tajik / тоҷикӣ — Iranian (SW), a variety of Persian spoken in Tajikistan (~8M L1 / 4M L2), written in a
**Cyrillic** alphabet. The headline: unlike our `fa` (Perso-Arabic *abjad* → the short-vowel-restoration wall
that pins it at 🟡), **Tajik Cyrillic writes all its vowels**, so this is a near-phonemic left-to-right g2p with
NO restoration — the Kurmanji-vs-Persian advantage.

## Referees — three independent, two human

- **wikipron `tgk_cyrl` broad** (HUMAN, Wiktionary, 3245 types) — PRIMARY.
- **wikipron `tgk_cyrl` narrow** (HUMAN, 3243) — corroborating; very fine (ʔ onset, ä, kʰ aspiration, d̪ dental,
  w for в, ɦ intervocalic ҳ, tap ɾ, acute stress).
- **epitran `tgk-Cyrl`** (programmatic, 3245) — corroborating.

## Engine (tajik.ts + tajik.jsonc)

Greedy Cyrillic scan. Six-vowel system и e а о у ӯ → i e a ɔ u ɵ (о is the Tajik reflex of Persian ā = [ɔ]; ӯ is
the mid central rounded [ɵ]). Iotated ё/ю/я → jɔ/ju/ja; е (and э) → [je] word-initially or in hiatus, else [e];
**и/ӣ in hiatus → [ji]** (Саид→sajid — matches the human broad referee, which epitran misses). Special letters
ғ→ʁ, қ→q, ҳ→h, ҷ→d͡ʒ, х→χ, ъ→ʔ. Persian **final stress**. Cardinal numbers with the enclitic **-у (va) connector**
(бисту як, сесаду чилу панҷ, ду ҳазору бист).

## Results

| referee | folded |
|---|---|
| wikipron broad (human, PRIMARY) | **98.1%** (3183/3245) |
| wikipron narrow (human) | 91.4% (2965/3243) |
| epitran (programmatic) | 84.5% (2741/3245) |

Folds are NOTATION only: the low vowel а (our a ~ broad a ~ narrow ä ~ epitran æ), о (our ɔ ~ broad o), р (tap ɾ ~
r), ғ (ʁ ~ ɣ), в (v ~ narrow w), ҳ (h ~ narrow ɦ), х (χ~x), narrow aspiration kʰ/pʰ/tʰ and its automatic glottal
onset ʔ; length/dental/acute-stress/tie stripped by the shared backbone.

**Two fixes took broad 92.7%→98.1%:** the ғ ʁ→ɣ notation fold, and the и-hiatus glide (Саид→sajid). The
remaining epitran gap (84.5%) is **epitran's own bugs** — it leaves я/ю untransliterated (`Австралия→avstraliя`),
botches ё (`Ёқуб→equb`), and omits the hiatus glide the *human* referee has (`Абдуллоев→abdullojev`, which we
match). So the honest measure is the human primary at **98.1%**, human-corroborated at 91.4%.

## Verdict — ✅ verified

Near-ceiling on the primary human referee, independently corroborated by a second human referee; residuals are
referee noise (epitran bugs, narrow allophony), not engine errors. Comparable to kmr (97.4% ✅). Numbers are
Persian-style cardinals. Deferred: izofat/enclitic unstressing (final stress is the baseline), dialectal ӯ~u
merger (kept distinct).
