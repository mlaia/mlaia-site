"""TabPFN v2 vs XGBoost (default and tuned) on three public OpenML tables.
Reports ROC AUC, fit time and predict time. Seeds fixed. See README in results.json 'protocol'."""
import json, sys, time, warnings, platform
import numpy as np, pandas as pd
from sklearn.datasets import fetch_openml
from sklearn.model_selection import StratifiedKFold, RandomizedSearchCV, train_test_split
from sklearn.metrics import roc_auc_score
from sklearn.preprocessing import OrdinalEncoder
import sklearn
FAMILY = sys.argv[1]  # "xgb" or "tabpfn": one library per process (both ship OpenMP; loading both can hang on macOS)
if FAMILY == "xgb":
    import xgboost
    from xgboost import XGBClassifier
else:
    import tabpfn, torch
    from tabpfn import TabPFNClassifier
    from tabpfn.constants import ModelVersion
warnings.filterwarnings("ignore")
SEED = 0
PARAMS = {
    "n_estimators": [200, 400, 800, 1200],
    "learning_rate": [0.01, 0.03, 0.05, 0.1, 0.2],
    "max_depth": [3, 4, 5, 6, 8],
    "min_child_weight": [1, 3, 5, 10],
    "subsample": [0.6, 0.8, 1.0],
    "colsample_bytree": [0.5, 0.7, 0.9, 1.0],
    "reg_lambda": [0.1, 1, 5, 10],
    "gamma": [0, 0.1, 1],
}

def load(data_id):
    d = fetch_openml(data_id=data_id, as_frame=True, parser="auto")
    X, y = d.data.copy(), d.target
    cat = [c for c in X.columns if not pd.api.types.is_numeric_dtype(X[c])]
    if cat:
        X[cat] = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1,
                                encoded_missing_value=np.nan).fit_transform(X[cat].astype("object"))
    y = pd.Series(pd.factorize(y, sort=True)[0], name="y")
    if y.mean() > 0.5:  # make the minority class the positive class
        y = 1 - y
    cat_idx = [X.columns.get_loc(c) for c in cat]
    return d.details.get("name", str(data_id)), X.astype(float).values, y.values, cat_idx

def xgb(**kw):
    return XGBClassifier(tree_method="hist", n_jobs=10, random_state=SEED, eval_metric="logloss", **kw)

def run_xgb_default(Xa, ya, Xb):
    t = time.time(); m = xgb().fit(Xa, ya); f = time.time() - t
    t = time.time(); p = m.predict_proba(Xb)[:, 1]; return p, f, time.time() - t

def run_xgb_tuned(Xa, ya, Xb, n_iter):
    t = time.time()
    s = RandomizedSearchCV(xgb(), PARAMS, n_iter=n_iter, scoring="roc_auc",
                           cv=StratifiedKFold(3, shuffle=True, random_state=SEED),
                           random_state=SEED, n_jobs=1, refit=True).fit(Xa, ya)
    f = time.time() - t
    t = time.time(); p = s.predict_proba(Xb)[:, 1]; return p, f, time.time() - t

def run_tabpfn(Xa, ya, Xb, cat_idx):
    t = time.time()
    m = TabPFNClassifier.create_default_for_version(ModelVersion.V2)
    m.set_params(random_state=SEED, categorical_features_indices=cat_idx or None)
    m.fit(Xa, ya); f = time.time() - t
    t = time.time(); p = m.predict_proba(Xb)[:, 1]; return p, f, time.time() - t

def summarise(rows):
    out = {}
    for k in rows[0]:
        v = np.array([r[k] for r in rows], dtype=float)
        out[k] = {"mean": float(v.mean()), "std": float(v.std())}
    return out

def cv_dataset(data_id, n_iter):
    name, X, y, cat_idx = load(data_id)
    res = {"xgb_default": [], "xgb_tuned": []} if FAMILY == "xgb" else {"tabpfn_v2": []}
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=SEED).split(X, y):
        jobs = [("xgb_default", lambda: run_xgb_default(X[tr], y[tr], X[te])),
                ("xgb_tuned", lambda: run_xgb_tuned(X[tr], y[tr], X[te], n_iter))] if FAMILY == "xgb" else \
               [("tabpfn_v2", lambda: run_tabpfn(X[tr], y[tr], X[te], cat_idx))]
        for key, fn in jobs:
            p, f, pr = fn()
            res[key].append({"auc": roc_auc_score(y[te], p), "fit_s": f, "predict_s": pr})
        print(name, "fold done", {k: round(v[-1]["auc"], 4) for k, v in res.items()}, flush=True)
    return {"dataset": name, "openml_id": data_id, "rows": int(len(y)), "features": int(X.shape[1]),
            "categorical_features": len(cat_idx), "positive_rate": float(y.mean()),
            "eval": "5-fold stratified CV, mean and std over folds",
            "test_rows_per_fold": int(len(y) // 5),
            "models": {k: summarise(v) for k, v in res.items()}}

def big_dataset(data_id, n_iter, cap=10000):
    name, X, y, cat_idx = load(data_id)
    Xa, Xb, ya, yb = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)
    Xs, _, ys, _ = train_test_split(Xa, ya, train_size=cap, random_state=SEED, stratify=ya)
    models = {}
    jobs = [("xgb_default_full", lambda: run_xgb_default(Xa, ya, Xb)),
            ("xgb_tuned_full", lambda: run_xgb_tuned(Xa, ya, Xb, n_iter)),
            ("xgb_tuned_10k", lambda: run_xgb_tuned(Xs, ys, Xb, n_iter))] if FAMILY == "xgb" else \
           [("tabpfn_v2_10k", lambda: run_tabpfn(Xs, ys, Xb, cat_idx))]
    for key, fn in jobs:
        p, f, pr = fn()
        models[key] = {"auc": float(roc_auc_score(yb, p)), "fit_s": f, "predict_s": pr}
        print(name, key, {k: round(v, 4) for k, v in models[key].items()}, flush=True)
    return {"dataset": name, "openml_id": data_id, "rows": int(len(y)), "features": int(X.shape[1]),
            "categorical_features": len(cat_idx), "positive_rate": float(y.mean()),
            "eval": "single stratified 80/20 split", "train_rows": int(len(ya)), "test_rows": int(len(yb)),
            "tabpfn_train_rows": cap, "models": models}

if __name__ == "__main__":
    out = {"protocol": {
        "seed": SEED, "metric": "ROC AUC, minority class as positive",
        "xgboost_default": "XGBClassifier defaults, tree_method=hist",
        "xgboost_tuned": "RandomizedSearchCV, 30 configurations (20 on the large table), 3-fold inner CV on the training fold, refit on the full training fold; fit time includes the search",
        "tabpfn": "TabPFN v2 classifier weights (openly licensed), default settings, no tuning; fit time is context loading, predict time is the forward passes",
        "preprocessing": "categorical columns ordinal-encoded; indices passed to TabPFN; no other preprocessing",
        "hardware": f"{platform.machine()} {platform.processor()}, 10 CPU cores; TabPFN on Apple MPS GPU; XGBoost on CPU; each library in its own process",
        "versions": dict({"scikit-learn": sklearn.__version__, "python": sys.version.split()[0]}, **({"xgboost": xgboost.__version__} if FAMILY == "xgb" else {"tabpfn": tabpfn.__version__, "torch": torch.__version__, "mps": bool(torch.backends.mps.is_available())}))},
        "results": []}
    for job in [lambda: cv_dataset(31, 30), lambda: cv_dataset(40701, 30), lambda: big_dataset(1590, 20)]:
        out["results"].append(job())
        json.dump(out, open(f"results_{FAMILY}.json", "w"), indent=1)
    print("DONE", flush=True)
