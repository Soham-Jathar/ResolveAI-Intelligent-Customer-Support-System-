"""Exercise endpoint handlers without touching the local demo database."""
from __future__ import annotations

import csv
from io import StringIO

import pytest
from fastapi import HTTPException
from sqlalchemy import Column, MetaData, Table, create_engine, inspect, select
from sqlalchemy.orm import sessionmaker

from api import main as api_main
from src import database


@pytest.fixture
def isolated_database(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{(tmp_path / 'tickets.db').as_posix()}",
        connect_args={"check_same_thread": False},
    )
    database.Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(database, "SessionLocal", sessions)
    monkeypatch.setattr(api_main, "SessionLocal", sessions)
    monkeypatch.setenv("AGENT_ACCESS_KEY", "test-agent-key-only")
    # Deliberately disagree: the broad classifier says payment while the
    # fine-intent label maps to delivery. Persistence must not erase this.
    monkeypatch.setattr(api_main, "analyse_ticket", lambda _: {
        "query_type": "payment",
        "query_type_confidence": 0.82,
        "intent": "delivery_delay",
        "confidence": 0.31,
        "sentiment": "neutral",
        "priority": "medium",
        "department": "Payments Support",
        "escalate_to_human": False,
        "escalation_reasons": [],
        "entities": {},
        "verification": {},
        "language": {"source_language": "English"},
        "duplicate_candidates": [],
        "retrieved_sources": [],
    })
    yield sessions
    engine.dispose()


def test_customer_submission_agent_review_and_feedback(isolated_database):
    submitted = api_main.analyse(api_main.TicketRequest(message="Payment failed after checkout."))
    ticket = submitted["ticket"]
    assert ticket["query_type"] == "payment"
    assert ticket["query_type_confidence"] == pytest.approx(0.82)
    assert ticket["intent"] == "delivery_delay"
    ticket_id = ticket["id"]

    with pytest.raises(HTTPException) as denied:
        api_main.require_agent(x_agent_key="wrong-key")
    assert denied.value.status_code == 401
    api_main.require_agent(x_agent_key="test-agent-key-only")
    queue = api_main.list_tickets()
    assert queue[0]["query_type"] == "payment"
    assert queue[0]["query_type_confidence"] == pytest.approx(0.82)
    analytics = api_main.analytics()
    assert analytics["by_query_type"] == {"payment": 1}

    updated = api_main.resolve_ticket(
        ticket_id,
        api_main.TicketResolution(
            status="resolved", agent_outcome="Checked by the support team.",
            final_query_type="payment", final_intent="payment_failed",
        ),
    )
    assert updated["query_type"] == "payment"
    status = api_main.ticket_status(ticket_id)
    assert status["status"] == "resolved"
    assert [event["status"] for event in status["timeline"]] == ["received", "resolved"]
    export = api_main.export_feedback()
    rows = list(csv.DictReader(StringIO(export.body.decode("utf-8"))))
    assert rows[0]["predicted_query_type"] == "payment"
    assert rows[0]["final_intent"] == "payment_failed"


def test_legacy_ticket_without_broad_prediction_uses_intent_fallback(isolated_database):
    api_main.analyse(api_main.TicketRequest(message="Payment failed after checkout."))
    with isolated_database() as session:
        ticket = session.scalar(select(database.Ticket))
        ticket.query_type = None
        ticket.query_type_confidence = None
        session.commit()
    stored = api_main.list_tickets()[0]
    assert stored["query_type"] == "delivery"
    assert stored["query_type_confidence"] is None


def test_existing_sqlite_table_receives_broad_prediction_columns(tmp_path, monkeypatch):
    engine = create_engine(f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}")
    old_columns = [
        Column(column.name, column.type, primary_key=column.primary_key, nullable=column.nullable)
        for column in database.Ticket.__table__.columns
        if column.name not in {"query_type", "query_type_confidence"}
    ]
    Table("tickets", MetaData(), *old_columns).create(engine)
    monkeypatch.setattr(database, "engine", engine)
    database.initialise_database()
    names = {column["name"] for column in inspect(engine).get_columns("tickets")}
    assert {"query_type", "query_type_confidence"}.issubset(names)
    engine.dispose()
