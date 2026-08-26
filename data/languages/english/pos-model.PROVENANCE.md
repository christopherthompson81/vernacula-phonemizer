# `pos-model.json` provenance — English POS tagger

Averaged-perceptron part-of-speech model (drives heteronym selection + de-accenting;
`english.jsonc` posModel).

- **Training data:** Universal Dependencies **English Web Treebank (UD-EWT)** —
  **CC BY-SA 4.0**.
- **Posture (training-as-use):** the shipped artifact is learned feature weights; no
  sentence, token sequence, or annotation from the treebank survives in it, and the treebank's
  protectable selection/arrangement leaves no trace in the weights. The corpus text was
  functional scaffolding for learning POS regularities (linguistic facts). UD-EWT is credited in
  NOTICE with this statement.
- **Fallback** if the posture is revisited: retrain on a permissively-licensed treebank.
