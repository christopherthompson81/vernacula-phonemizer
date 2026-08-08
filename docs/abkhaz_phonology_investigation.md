# Abkhaz phonology residuals — investigation

Goal: sort the referee's residual divergence classes (170/206 primary, 641/979 kaikki
after folds) into engine defects vs referee inconsistencies, fix the former, document
the latter.

## Run 1 — 2026-08-08

Command: scratch probe listing every folded mismatch vs both referee TSVs, then targeted
greps of the TSVs per class.
Question: which residual classes are ours?

Classes, with verdicts:

1. **⟨ҩ⟩ = [ɥˤ], not [ɥ] — ENGINE DEFECT.** `grep -c ɥˤ`: kaikki writes ɥˤ **50×**
   against 4 bare ɥ, and wikipron's one non-definition ҩ-word (ахҩа) also writes ɥˤ.
   The 4 bare-ɥ rows are the letter-definition row itself plus the numerals (ҩба,
   жәаҩа, ҩажәа + one agent noun) — the same numeral series that also devoices б (see
   class 5), i.e. the inconsistent corner. The manifest's stated policy is "follow the
   corpus where the sources disagree", and the corpus is ~12:1 pharyngealized. This also
   matches the scholarship (Chirikba /ʕʷ/; Hewitt [ɥˤ]). → base ҩ: ɥ → ɥˤ.
2. **⟨уу⟩ → [ww] — ENGINE DEFECT.** асууари came out asWWari: the glide rule counts у/и
   as vowel context for each other, so identical twins BOTH become glides. Referee:
   asuwari(j) — first syllabic, second glide. Fix: an identical twin on the RIGHT does
   not count as vowel context (left twin still does), so уу → uw, ии → ij. The mixed
   pairs (⟨аиуит⟩ → ajwjtʼ) keep their behavior — only the identical-twin case changes.
3. **kaikki notation folds, not defects:** ʏ for ⟨ы⟩ after ɥˤ (аҩы → aɥˤʏ — rounding
   allophone of ə, kaikki-only), and e̞ for e. → two new folds in langs/ab.jsonc.
4. **Referee writes the PHONEMIC two-vowel analysis in scattered rows** — [e]=aj
   (жәеиза→ʒʷajza), [o]=aw, [i]=əj (Никарагуа→nəjkʼaraɡwa, жәибжь→ʒʷəjpʒ), [u]=əw
   (аӷу→aʁəw, аԥсуа→apʰsəwa) — while writing surface e/o/i/u in others (Џибути's final
   i, аиааира etc.). Our canonical-IPA policy is SURFACE. Not folded: əj↔i etc. are
   real contrasts elsewhere. Documented, left.
5. **The numeral series devoices б** in both referees (ҩба→ɥpa, фба→fpa, бжьба→pʒpa —
   even word-initially) while the letter rows define б=b. Internal inconsistency of the
   same Wiktionary family; devoicing is contrastive (three-way stops), no fold. Left.
6. **Referee drops contrastive articulation in single rows:** амц/ац lose the ʰ their
   own ⟨ц⟩ definition row carries; ахарҵәы loses the ejective ʼ; ақәыџьма loses қә's ʰ;
   аԥҳа simplifies pʰħ→pħ. Contrastive, no folds. Left.
7. **Letter-definition rows we deliberately reject:** Гь→c, Гә→kʷ, Ӷь→ʝ, Ӷә→ɣʷ (devoiced
   or place-shifted defs; ⟨г⟩ is voiced — #752-era decision), and bare ⟨ь⟩/⟨ә⟩ rows
   whose "pronunciation" is a lone combining diacritic. Left.

Expected effect: primary roughly flat (ахҩа fixed, the ҩ definition row now diverges —
the def row was the minority reading), kaikki up substantially (up to ~50 ɥˤ words plus
the ʏ/e̞ folds).

## Run 2 — 2026-08-08

Command: applied ҩ→ɥˤ (manifest), the twin-glide fix (abkhaz.ts), folds ʏ→ə and e̞→e
(langs/ab.jsonc); re-ran eval and a corpus emit/compare against the pre-change state.

- Referee: kaikki **641 → 676** (65.5% → 69.1%; raw 389 → 409). Primary 170 → 166 —
  the four losses are exactly the predicted inconsistent corner: the Ҩ/ҩ definition
  rows and the bare-ɥ numerals (жәаҩа, ҩажәа, анашанаҟаҵаҩ), while the word corpus
  agrees with the change. Net +31 across both.
- Corpus: 347/404 rows changed (⟨ҩ⟩ is everywhere). Verified mechanically that every
  change is one of the two intended classes: strip ˤ from the after-side and compare —
  the 47 residual rows are all ⟨ии⟩→[ij] (диит djjtʼ→dijtʼ; Russian -ии istʼorjj→
  istʼorij). No third class, DROP steady at 33, no leaks.
- Tests: goldens updated ɥ→ɥˤ wholesale (⟨ҩ⟩ is the only source of ɥ in this engine);
  new pins for асууари/диит/аиуит and аҩны/ахҩа. Shared IPA classes unaffected (ɥ is
  not in core vowel classes; fr/ht keep their plain ɥ).
