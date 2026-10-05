# ResolveAI — Intelligent Customer Support System Using NLP

ResolveAI turns an unstructured customer message into a support ticket with a predicted query type, a more specific intent, a priority, and an assigned queue. It retrieves relevant policy text for the support team and sends uncertain, sensitive, or explicitly human-requested cases for human review.

This is an **NLP engineering project**, not a chat interface wrapped around a pretrained LLM. The running classifiers are trained and evaluated in this repository; retrieval, routing rules, and escalation are evaluated separately. The React interface makes those decisions usable by customers and support agents.

> **Prototype scope:** The included policies and operational records are demonstration data. ResolveAI cannot verify customer identity, check a real order or payment, approve a refund, or promise a delivery date. It is not ready to handle real customer data without stronger authentication, privacy controls, and company-system integrations.

## What it does

| Stage | Implementation | Result |
| --- | --- | --- |
| Understand the request | TF-IDF word/character n-grams + calibrated Logistic Regression | Six broad query types and a fine-grained intent, with model probabilities |
| Add context | VADER sentiment and pattern-based reference extraction | Sentiment, order/tracking/transaction references, amounts, and dates |
| Decide where it goes | Explicit priority, confidence, fraud, and human-request rules | Low/medium/high/critical priority and a specialist or human-review queue |
| Find guidance | Sentence Transformers + FAISS, with TF-IDF fallback | Relevant policy excerpts and source IDs |
| Support a resolution | Customer/agent views, editable draft, status timeline, feedback export | Agent-reviewed outcome and labels for future retraining |

The optional fine-tuned DistilBERT model is a **comparison**, not the model silently substituted into the live pipeline. Optional Ollama generation can draft from retrieved policies; the default response path is policy-based and does not require an LLM.

```text
Customer message or attachment
          ↓
Language check → one clarification question when needed
          ↓
Query-type + fine-intent classifiers → sentiment + entity extraction
          ↓
Priority and escalation rules → specialist queue or human review
          ↓
Policy retrieval → agent-facing evidence and editable reply draft
          ↓
Ticket status updates + reviewed-label feedback
```

## Run locally

You need Python, Node.js/npm, and internet access for the initial Python install. Run the following commands in **PowerShell**. Model files are deliberately not committed, so a fresh clone must train the two baseline classifiers before starting the API.

1. Clone and set up the backend:

   ```powershell
   git clone https://github.com/Soham-Jathar/Customer-support-system.git
   cd Customer-support-system
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   python -m nltk.downloader vader_lexicon
   Copy-Item .env.example .env
   ```

   Open `.env` and replace `AGENT_ACCESS_KEY` with a long, private value. Do not commit `.env` or share the key. The supplied `data/generic/train.csv` and `data/generic/test.csv` are already in the repository.

2. Train the runtime models and start FastAPI:

   ```powershell
   python -m src.train --data data/generic/train.csv
   python scripts/train_query_type.py --data data/generic/train.csv
   python -m uvicorn api.main:app --reload --port 8000
   ```

3. Open a **second PowerShell terminal in the project root** and start the frontend:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

Open [the customer portal](http://localhost:5173). The [API documentation](http://127.0.0.1:8000/docs) and [health check](http://127.0.0.1:8000/health) are on port 8000. Sign in to the Agent Console with the key from `.env`.

The default database is a local SQLite file, `support_generic.db`. FastAPI creates it on startup. PostgreSQL is optional; `docker-compose.yml` provides a development database, and `.env.example` shows the `DATABASE_URL` format.

### Try the workflow

Submit a message such as:

> I ordered a laptop five days ago, but it has not arrived. I need it urgently.

The customer receives a ticket reference and can use it to view a status timeline. In the Agent Console, an agent can inspect the predicted query type and intent, priority, extracted details, route, and policy evidence; mark the ticket in progress; edit a policy-based reply draft; correct the labels; and record a resolution. Those actions are **manual**—routing to a specialist queue does not mean an automated agent resolved the complaint.

Other prototype flows include TXT/PDF/DOCX text intake (up to 2 MB; original files are not retained), possible duplicate detection, and a focused clarification question when important details are missing. A reference lookup checks only the included mock records; even a match does **not** establish that the requester owns the account or order.

## Reproduce the NLP work

The versioned training split combines mapped public Bitext examples with clearly identified project-authored and synthetic extensions. The technical-support and natural-language paraphrase examples are synthetic; the paraphrases are added to training only, not to the held-out test set. See the [data card](docs/DATA_CARD.md) for provenance and limitations.

To rebuild the data instead of using the committed CSVs, run from the project root:

```powershell
python scripts/prepare_bitext_data.py
python scripts/create_technical_extension.py
python scripts/create_realistic_paraphrases.py
python scripts/build_training_set.py
```

The first command downloads Bitext, so it needs internet access. Then train as shown above and evaluate each component independently:

```powershell
python scripts/evaluate.py --data data/generic/test.csv
python scripts/evaluate_query_type.py --test data/generic/test.csv
python scripts/evaluate_retrieval.py
python scripts/evaluate_safety.py
python scripts/evaluate_challenge_set.py
python -m pytest -q
```

These scripts write reports and plots to the ignored `outputs/` directory. Classifier evaluation includes accuracy, macro/weighted F1, per-class results, and a confusion matrix; retrieval reports Recall@1/3/5; the authored safety set checks priority and escalation. The 48-message challenge set additionally produces an error-analysis report and exposes how much natural wording can lower the scores. It is project-authored after training, not independent external validation. None of these figures are a claim about live support traffic. See [data and evaluation](docs/DATA_AND_EVALUATION.md).

For the optional DistilBERT comparison, install `requirements-advanced.txt`, then run:

```powershell
python -m pip install -r requirements-advanced.txt
python scripts/train_transformer.py --data data/generic/train.csv --output models/distilbert-generic-intent
python scripts/evaluate_transformer.py --model models/distilbert-generic-intent --test data/generic/test.csv
python scripts/compare_models.py
```

The advanced dependencies also enable Sentence Transformers + FAISS retrieval. Without them, policy search uses the explicit TF-IDF fallback.

## Safety and current limitations

- **Human review:** suspected fraud, unclear routing, unmatched mock references, explicit requests for a person, and untranslated non-English messages are escalated. Sentiment alone does not determine priority.
- **Languages:** the system detects many Indian regional languages but does **not** currently translate them. Its classifiers are English-trained; non-English tickets go to a person rather than receiving a trusted automated decision.
- **Grounding:** retrieved policies support guidance, not live facts. The system must not invent a shipment status, refund approval, account outcome, or delivery promise.
- **Access and privacy:** agent pages use a shared local access key, not production identity management. The customer status endpoint uses an opaque ticket reference. Common sensitive patterns are masked before storage, but this is not a substitute for a security and privacy review.
- **Training data:** the public-data mapping and synthetic extensions cannot represent every company, customer population, or real-world complaint.

## Repository guide

```text
api/              FastAPI endpoints
frontend/         React + Vite customer portal and agent console
src/              NLP pipeline, routing, retrieval, persistence, and safety logic
scripts/          Data preparation, training, evaluation, and feedback preparation
data/             Versioned prototype datasets and mock operational records
knowledge_base/   Demonstration support policies
tests/            Unit tests for core preprocessing and routing rules
docs/             Proposal, architecture, data card, and evaluation notes
```

For more detail, read the [architecture](docs/ARCHITECTURE.md) and [project proposal](docs/PROJECT_PROPOSAL.md). Agent-reviewed corrections can be exported from the Operations view and validated before retraining; they never overwrite the held-out test split.
