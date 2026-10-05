# Faculty project proposal

## Title

**Intelligent Customer Support System Using Explainable NLP and Grounded Retrieval**

## Problem statement

Customer-support teams receive large volumes of unstructured messages about payments, delayed deliveries, refunds, account access, and technical failures. Manually identifying the complaint type, urgency, responsible department, and appropriate policy is slow and can delay high-risk cases.

This project develops an explainable NLP-based customer-support triage system. It predicts a broad query type and a fine-grained intent, analyses sentiment, extracts operational references, applies a transparent priority and escalation policy, retrieves relevant support policies, and routes each ticket to the appropriate queue. Suspected fraud, low-confidence predictions, and explicit requests for an agent are escalated to a human with a structured handoff. Classification, retrieval, and escalation are evaluated separately.

## NLP contribution

1. Hierarchical supervised classification: six broad query types and fine-grained customer-support intents.
2. TF-IDF word/character n-gram + Logistic Regression baseline, compared with an optional fine-tuned DistilBERT model.
3. VADER sentiment analysis used as a contextual feature, not a replacement for urgency detection.
4. Explainable priority detection combining query type, classifier confidence, sentiment, and explicit safety rules.
5. Entity extraction for order, tracking, and transaction IDs, amounts, and dates.
6. Semantic policy retrieval using Sentence Transformers and FAISS, with an evaluated TF-IDF fallback.
7. FastAPI, React customer/agent separation, ticket persistence, and a human-resolution feedback workflow.

## Evaluation plan

The project makes an 80/20 per-intent split of the mapped source examples before adding training-only synthetic paraphrases. It reports accuracy, macro F1, weighted F1, per-intent results, and a confusion matrix. Query type, retrieval Recall@5, and safety escalation precision/recall/F1 are evaluated separately. A later, project-authored natural-phrasing challenge set tests how much performance changes outside the templated source style. The application exposes saved metrics in the restricted agent console.

## Current reproducible results

The generic held-out set contains 1,026 examples. The TF-IDF + Logistic Regression baseline was selected for the running prototype because it outperformed the fine-tuned DistilBERT comparison on the same split. The figures below match the current local evaluation files; rerun the scripts after any model or data change.

| Component | Measure | Result |
| --- | --- | ---: |
| TF-IDF + Logistic Regression | Accuracy / macro F1 | **0.9844 / 0.9770** |
| Fine-tuned DistilBERT | Accuracy / macro F1 | 0.9659 / 0.8981 |
| Broad query-type classifier | Accuracy / macro F1 | **0.9883 / 0.9865** |
| Policy retrieval | Recall@5 on 18 labelled queries | **1.0000** |
| Safety policy | Escalation F1 on 19 authored cases | **1.0000** |
| Challenge-set broad query type | Accuracy / macro F1 on 48 authored messages | 0.8125 / 0.8064 |
| Challenge-set fine intent | Accuracy / macro F1 on the same 48 messages | 0.4583 / 0.4165 |

The challenge set has no exact text overlap with the generic training or test CSVs, but it was authored within the project after training and is not independent external validation. Its lower scores expose a real natural-phrasing generalization gap, especially for fine intents. The retrieval and safety sets are also small and authored. These are prototype results, not claims about production customer traffic. The full confusion pairs and misclassified examples are generated in `outputs/challenge_error_analysis.md`.

## Ethical and safety constraints

The system must not invent delivery dates, order status, refund approvals, or account outcomes. It stores only the minimum routing data and masks common sensitive data before persistence. Security-sensitive, uncertain, and customer-requested human cases are deferred to people. The current dataset is English-focused and prototype-only; it must not be presented as production performance or as representative of every company.
