# TabPFN vs XGBoost: the runs behind the tabular article

Source for the "Our own run" section of `/blog-tabular-data-ml-vs-dl.html` and two LinkedIn posts (November 2026).

- `bench.py` — TabPFN v2 (no tuning) vs XGBoost default and tuned, on OpenML credit-g (31), churn (40701) and adult (1590). ROC AUC, fit and predict time. Run `python bench.py tabpfn` and `python bench.py xgb` as two processes: XGBoost and PyTorch both ship OpenMP and loading them in one process hung on macOS.
- `cost.py` — German credit scored on its 5:1 cost matrix, with the threshold chosen inside each training fold; adds a random forest and the same forest wrapped in `pdll`. Run `python cost.py trees` and `python cost.py tabpfn`.
- `results_*.json`, `cost_*.json` — raw output of the runs reported in the article (2026-11-06, Apple Silicon laptop, TabPFN on MPS, one seed).

Environment: Python 3.10, tabpfn 9.2.0 (v2 weights), xgboost 3.2.0, scikit-learn 1.7.2, pdll 1.0.0. Newer TabPFN models need a licence acceptance from Prior Labs and were not used.
