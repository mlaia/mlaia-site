"""Follow-up on German credit (OpenML credit-g): cost-sensitive thresholds and a fourth contender.
Cost matrix shipped with the dataset: approving a bad borrower costs 5, rejecting a good one costs 1.
Positive class = bad borrower. For each outer fold the threshold is chosen on out-of-fold
predictions inside the training fold (never on the test fold), then applied to the test fold.
One library family per process: `python cost.py trees` and `python cost.py tabpfn`."""
import json, sys, time, warnings
import numpy as np, pandas as pd, sklearn
from sklearn.base import clone
from sklearn.datasets import fetch_openml
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, RandomizedSearchCV, cross_val_predict
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import OrdinalEncoder
warnings.filterwarnings("ignore")
FAMILY = sys.argv[1]
SEED, C_FN, C_FP = 0, 5.0, 1.0   # FN = bad borrower approved, FP = good borrower rejected
GRID = np.round(np.arange(0.01, 1.0, 0.01), 2)

def load():
    d = fetch_openml(data_id=31, as_frame=True, parser="auto")
    X, y = d.data.copy(), d.target
    cat = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]
    X[cat] = OrdinalEncoder().fit_transform(X[cat].astype("object"))
    yb = (y.astype(str) == "bad").astype(int).values
    return X.astype(float).values, yb, [X.columns.get_loc(c) for c in cat]

def cost(y, p, thr):
    rej = p >= thr
    return C_FN * np.sum((y == 1) & ~rej) + C_FP * np.sum((y == 0) & rej)

def best_thr(y, p):
    return float(GRID[int(np.argmin([cost(y, p, t) for t in GRID]))])

def models(cat_idx):
    if FAMILY == "trees":
        from xgboost import XGBClassifier
        from sklearn.ensemble import RandomForestClassifier
        from pdll import PairwiseDifferenceClassifier
        xgb = lambda **kw: XGBClassifier(tree_method="hist", n_jobs=10, random_state=SEED, eval_metric="logloss", **kw)
        rf = lambda: RandomForestClassifier(n_estimators=500, n_jobs=10, random_state=SEED)
        params = {"n_estimators": [200, 400, 800, 1200], "learning_rate": [0.01, 0.03, 0.05, 0.1, 0.2],
                  "max_depth": [3, 4, 5, 6, 8], "min_child_weight": [1, 3, 5, 10], "subsample": [0.6, 0.8, 1.0],
                  "colsample_bytree": [0.5, 0.7, 0.9, 1.0], "reg_lambda": [0.1, 1, 5, 10], "gamma": [0, 0.1, 1]}
        def tuned(Xa, ya):
            s = RandomizedSearchCV(xgb(), params, n_iter=30, scoring="roc_auc", random_state=SEED, n_jobs=1,
                                   cv=StratifiedKFold(3, shuffle=True, random_state=SEED), refit=False).fit(Xa, ya)
            return xgb(**s.best_params_)
        return {"xgb_default": lambda Xa, ya: xgb(), "xgb_tuned": tuned,
                "random_forest": lambda Xa, ya: rf(),
                "pdl_random_forest": lambda Xa, ya: PairwiseDifferenceClassifier(rf(), random_state=SEED)}
    from tabpfn import TabPFNClassifier
    from tabpfn.constants import ModelVersion
    def tp(Xa, ya):
        m = TabPFNClassifier.create_default_for_version(ModelVersion.V2)
        m.set_params(random_state=SEED, categorical_features_indices=cat_idx)
        return m
    return {"tabpfn_v2": tp}

if __name__ == "__main__":
    X, y, cat_idx = load()
    mk = models(cat_idx)
    rows = {k: [] for k in mk}
    splitter = RepeatedStratifiedKFold(n_splits=5, n_repeats=3, random_state=SEED)
    for i, (tr, te) in enumerate(splitter.split(X, y)):
        for name, make in mk.items():
            t = time.time()
            est = make(X[tr], y[tr])
            inner = cross_val_predict(clone(est), X[tr], y[tr], method="predict_proba",
                                      cv=StratifiedKFold(5, shuffle=True, random_state=SEED))[:, 1]
            thr = best_thr(y[tr], inner)
            p = clone(est).fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
            n = len(te)
            rows[name].append({"auc": roc_auc_score(y[te], p), "thr": thr, "n": n,
                               "cost_tuned": cost(y[te], p, thr) / n, "cost_050": cost(y[te], p, 0.5) / n,
                               "cost_theory_0167": cost(y[te], p, 1 / 6) / n,
                               "reject_rate_tuned": float(np.mean(p >= thr)), "seconds": time.time() - t})
        print(i, {k: (round(v[-1]["auc"], 3), round(v[-1]["cost_tuned"], 3), v[-1]["thr"]) for k, v in rows.items()}, flush=True)
        out = {"dataset": "credit-g (OpenML 31)", "rows": int(len(y)), "bad_rate": float(y.mean()),
               "cost_matrix": {"approve_bad": C_FN, "reject_good": C_FP},
               "baselines_cost_per_applicant": {"approve_everyone": float(C_FN * y.mean()), "reject_everyone": float(C_FP * (1 - y.mean()))},
               "eval": "5-fold stratified CV repeated 3 times (15 test folds); threshold chosen on inner 5-fold out-of-fold predictions of each training fold",
               "versions": {"scikit-learn": sklearn.__version__},
               "models": {k: {m: {"mean": float(np.mean([r[m] for r in v])), "std": float(np.std([r[m] for r in v]))}
                              for m in v[0] if m != "n"} for k, v in rows.items() if v}}
        json.dump(out, open(f"cost_{FAMILY}.json", "w"), indent=1)
    print("DONE", flush=True)
