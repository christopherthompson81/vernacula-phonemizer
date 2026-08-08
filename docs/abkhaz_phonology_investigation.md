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
3. **kaikki notation fold, not a defect:** ʏ for ⟨ы⟩ after ɥˤ (аҩы → aɥˤʏ — rounding
   allophone of ə, kaikki-only) → one new CONTEXT-LIMITED fold, (?<=ɥˤ)ʏ. (An e̞ fold was
   drafted too and turned out DEAD: the eval's BACKBONE strips U+031E before language
   folds run, so e̞ already compares as e — review catch, removed.)
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
the ʏ fold).

## Run 2 — 2026-08-08

Command: applied ҩ→ɥˤ (manifest), the twin-glide fix (abkhaz.ts), the ʏ→ə fold
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

## Run 3 — 2026-08-08 (review of PR #768)

Eight findings survived the adversarial verify; all fixed:

1+2. The twin-glide patch was keyed on LETTER IDENTITY, so it fixed only ⟨уу⟩-after-
  consonant: ауу still read a[ww], and mixed runs stayed nucleus-free (адиуан → adjwan
  where the kaikki referee has adiwan). Replaced with the general rule — left context is
  the REALIZED previous phone (a fresh glide is a consonant), right context is a vowel
  letter that is not itself у/и. A run now alternates from its anchor: асууари→asuwari,
  адиуан→adiwan (=referee), ауу→awu, иаиууа→jajuwa, аиуит→ajujtʼ (the ajwjtʼ pin had no
  referee backing and no nucleus). Corpus: 187/404 rows changed, ALL of them wj→uj /
  jw→iw-ju nucleus repairs (уи "that" was [wj]; Хьиуитт "Hewitt" was χʲjwjtʼtʼ, now
  χʲiwitʼtʼ). kaikki 676 → 677.
3. ⟨ҩ'⟩ doubled the pharyngealizer (ɥˤˤ) — the generic modifier path now skips a mod the
  base already ends with.
4. The e̞→e fold was DEAD (the eval's BACKBONE strips U+031E before language folds run) —
  removed, doc claim corrected.
5. Test comments now quote the referee exactly (asuwarij — the final j is the phonemic
  i=əj tail) and mark the no-referee pins as invariant pins.
6. The manifest's vowelLetters comment still described the old "у/и count each other"
  rule — rewritten.
7. The referee-floor comment and the catalogue row still carried 82.5%/65.5% — updated
  to 80.6%/69.1% with the ҩ→ɥˤ cost/gain disclosed.
8. The ʏ→ə fold was documented as context-limited but written unconditional — now
  (?<=ɥˤ)ʏ (all 14 kaikki ʏ rows are post-ɥˤ).
