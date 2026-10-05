"""Evaluate natural support phrasing kept separate from model training.

The examples are project-authored after the training split was established.
They are a useful challenge set, not an external or real-customer benchmark.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, f1_score

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from src.config import MODEL_PATH, QUERY_TYPE_MODEL_PATH  # noqa: E402
from src.preprocess import normalize_text  # noqa: E402
from src.taxonomy import FINE_INTENT_TO_QUERY_TYPE, QUERY_TYPES  # noqa: E402


def text_key(value: str) -> str:
    return normalize_text(value).casefold()


def validate_challenge_set(data: pd.DataFrame) -> None:
    required = {"text", "query_type", "intent", "scenario"}
    if not required.issubset(data.columns):
        raise ValueError(f"Challenge CSV needs columns: {sorted(required)}")
    if data[list(required)].isna().any().any():
        raise ValueError("Challenge CSV contains blank required fields.")
    if data.text.map(text_key).duplicated().any():
        raise ValueError("Challenge CSV contains duplicate messages.")
    if set(data.query_type) - set(QUERY_TYPES):
        raise ValueError("Challenge CSV contains an unknown query type.")
    if set(data.intent) - set(FINE_INTENT_TO_QUERY_TYPE):
        raise ValueError("Challenge CSV contains an unknown fine intent.")
    mismatched = data[data.apply(lambda row: FINE_INTENT_TO_QUERY_TYPE[row.intent] != row.query_type, axis=1)]
    if not mismatched.empty:
        raise ValueError("Some challenge fine intents do not match their query-type labels.")
    challenge_texts = set(data.text.map(text_key))
    for split in ("train", "test"):
        split_path = ROOT / "data" / "generic" / f"{split}.csv"
        reference_texts = set(pd.read_csv(split_path).text.map(text_key))
        if challenge_texts & reference_texts:
            raise ValueError(f"Challenge messages overlap with {split_path}.")


def confusion_pairs(expected: pd.Series, predicted: pd.Series) -> list[dict]:
    counts = Counter(
        (truth, guess)
        for truth, guess in zip(expected, predicted)
        if truth != guess
    )
    return [
        {"expected": truth, "predicted": guess, "count": count}
        for (truth, guess), count in counts.most_common(10)
    ]


def measure(expected: pd.Series, predicted: pd.Series) -> dict:
    return {
        "accuracy": float(accuracy_score(expected, predicted)),
        "macro_f1": float(f1_score(expected, predicted, average="macro", zero_division=0)),
        "per_class": classification_report(expected, predicted, zero_division=0, output_dict=True),
        "top_confusions": confusion_pairs(expected, predicted),
    }


def markdown_analysis(rows: pd.DataFrame, metrics: dict) -> str:
    lines = [
        "# Project-authored challenge-set error analysis",
        "",
        "This 48-message set was authored after model training and has no exact text overlap with the generic train or test CSVs. It is not an independent external or real-customer benchmark. Do not tune models on it and then present it as untouched evidence.",
        "",
        f"- Broad query-type accuracy: {metrics['query_type']['accuracy']:.1%}; macro F1: {metrics['query_type']['macro_f1']:.1%}.",
        f"- Fine-intent accuracy: {metrics['fine_intent']['accuracy']:.1%}; macro F1: {metrics['fine_intent']['macro_f1']:.1%}.",
        "",
        "## Broad query-type confusions",
        "",
    ]
    for item in metrics["query_type"]["top_confusions"]:
        lines.append(f"- {item['expected']} → {item['predicted']}: {item['count']} case(s)")
    if not metrics["query_type"]["top_confusions"]:
        lines.append("- None in this small set.")
    lines += ["", "## Fine-intent confusions", ""]
    for item in metrics["fine_intent"]["top_confusions"]:
        lines.append(f"- {item['expected']} → {item['predicted']}: {item['count']} case(s)")
    if not metrics["fine_intent"]["top_confusions"]:
        lines.append("- None in this small set.")
    lines += ["", "## Misclassified messages", ""]
    mistakes = rows[(~rows.query_type_correct) | (~rows.fine_intent_correct)]
    if mistakes.empty:
        lines.append("No errors observed in this small set; this does not establish real-world generalization.")
    else:
        for _, item in mistakes.iterrows():
            lines.append(
                f"- **{item.scenario}:** {item.text} "
                f"Broad: {item.query_type} → {item.predicted_query_type} ({item.query_type_confidence:.0%}); "
                f"fine: {item.intent} → {item.predicted_intent} ({item.fine_intent_confidence:.0%})."
            )
    lines += ["", "Review these errors qualitatively before proposing new features or training data.", ""]
    return "\n".join(lines)


def main(data_path: Path) -> None:
    data = pd.read_csv(data_path)
    validate_challenge_set(data)
    if not MODEL_PATH.exists() or not QUERY_TYPE_MODEL_PATH.exists():
        raise FileNotFoundError("Train both runtime classifiers before evaluating the challenge set.")
    broad_model = joblib.load(QUERY_TYPE_MODEL_PATH)
    fine_model = joblib.load(MODEL_PATH)
    texts = data.text.map(normalize_text)
    broad_predictions = broad_model.predict(texts)
    fine_predictions = fine_model.predict(texts)
    rows = data.copy()
    rows["predicted_query_type"] = broad_predictions
    rows["query_type_confidence"] = broad_model.predict_proba(texts).max(axis=1)
    rows["predicted_intent"] = fine_predictions
    rows["fine_intent_confidence"] = fine_model.predict_proba(texts).max(axis=1)
    rows["query_type_correct"] = rows.query_type == rows.predicted_query_type
    rows["fine_intent_correct"] = rows.intent == rows.predicted_intent
    metrics = {
        "dataset": str(data_path),
        "examples": len(data),
        "provenance": "Project-authored post-training challenge set; not an independent external benchmark",
        "exact_overlap_with_generic_train_or_test": 0,
        "query_type": measure(rows.query_type, rows.predicted_query_type),
        "fine_intent": measure(rows.intent, rows.predicted_intent),
    }
    output = ROOT / "outputs"
    output.mkdir(exist_ok=True)
    metrics_path = output / "challenge_eval_metrics.json"
    predictions_path = output / "challenge_eval_predictions.csv"
    analysis_path = output / "challenge_error_analysis.md"
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    rows.to_csv(predictions_path, index=False)
    analysis_path.write_text(markdown_analysis(rows, metrics), encoding="utf-8")
    print(f"Broad query-type macro F1: {metrics['query_type']['macro_f1']:.4f}")
    print(f"Fine-intent macro F1: {metrics['fine_intent']['macro_f1']:.4f}")
    print(f"Saved {metrics_path}, {predictions_path}, and {analysis_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", type=Path, default=ROOT / "data" / "challenge_eval.csv")
    main(parser.parse_args().data)
