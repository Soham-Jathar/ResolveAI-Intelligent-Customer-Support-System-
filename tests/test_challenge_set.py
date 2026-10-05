import pandas as pd
import pytest

from scripts.evaluate_challenge_set import ROOT, validate_challenge_set


def test_challenge_set_is_taxonomy_consistent_and_separate():
    data = pd.read_csv(ROOT / "data" / "challenge_eval.csv")
    assert len(data) == 48
    validate_challenge_set(data)


def test_challenge_set_rejects_bad_labels():
    data = pd.read_csv(ROOT / "data" / "challenge_eval.csv")
    data.loc[0, "query_type"] = "unknown_queue"
    with pytest.raises(ValueError, match="unknown query type"):
        validate_challenge_set(data)
