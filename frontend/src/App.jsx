import { useEffect, useMemo, useState } from 'react'

const API = 'http://127.0.0.1:8000'
const example = 'I ordered a laptop five days ago, but it has not arrived. I need it urgently.'
const darkThemeCss = `
body.dark-body{background:#080d18!important}.dark-mode{color:#e8eefc}.dark-mode nav a,.dark-mode .brand{color:#e8eefc}.dark-mode .composer,.dark-mode .queue-panel,.dark-mode .result,.dark-mode .blank,.dark-mode .metric{background:#111a2d;border-color:#273653;box-shadow:none}.dark-mode .panel-heading h2,.dark-mode .queue-panel h2,.dark-mode .metric strong,.dark-mode .blank h2,.dark-mode .reasoning h3,.dark-mode .evidence h3{color:#f3f6ff}.dark-mode .composer label,.dark-mode .reasoning li,.dark-mode .ticket p,.dark-mode .source b{color:#c2cee5}.dark-mode .composer textarea,.dark-mode input{background:#0c1424;color:#edf2ff;border-color:#344564}.dark-mode .result-banner{background:linear-gradient(90deg,#121d34,#172847)}.dark-mode .evidence{border-color:#2a3852}.dark-mode .evidence blockquote{background:#0c1527;border-color:#2f456c;color:#d6e2f8}.dark-mode .audit{background:#0d1423}.dark-mode .ticket{border-color:#2b3954}.dark-mode .ticket footer,.dark-mode .reasoning li,.dark-mode .source{border-color:#27344c}.dark-mode .bar{background:#24314a}.dark-mode .subtle{color:#aebbd2}.dark-mode footer{border-color:#2a3650}.theme-toggle{border:1px solid #b8c8e9;border-radius:99px;padding:6px 9px;background:#fff;color:#155eef;font-weight:800;cursor:pointer}.dark-mode .theme-toggle{background:#17243c;color:#ffe49a;border-color:#40577e}`
const themeToggleCss = `.theme-toggle{display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:5px 11px!important;box-shadow:0 2px 8px #1b3a6d14;transition:transform .18s ease,box-shadow .18s ease,background .18s ease}.theme-toggle:hover{transform:translateY(-1px);box-shadow:0 5px 13px #1b3a6d24}.theme-mark{position:relative;display:inline-block;width:16px;height:16px;flex:none}.theme-mark.moon{border-radius:50%;background:linear-gradient(135deg,#1f3c78,#587fca);box-shadow:inset -2px -2px 3px #0d24588c,0 0 5px #6d9dff57}.theme-mark.moon:after{content:'';position:absolute;width:14px;height:14px;right:-4px;top:-3px;border-radius:50%;background:#fff}.theme-mark.sun{border-radius:50%;background:#ffd166;box-shadow:0 0 8px #ffd16699}.theme-mark.sun:before{content:'';position:absolute;inset:-3px;border-radius:50%;border:1px dashed #ffd166}.dark-mode .theme-toggle{box-shadow:0 2px 10px #0005}.dark-mode .theme-mark.moon:after{background:#17243c}`

const labels = {
  critical: ['Critical', 'critical'], high: ['High', 'high'], medium: ['Medium', 'medium'], low: ['Low', 'low'],
}

function Badge({ priority }) {
  const [label, tone] = labels[priority] || [priority, 'medium']
  return <span className={`badge ${tone}`}><i />{label} priority</span>
}

function Metric({ label, value, muted }) {
  return <div className="metric"><span>{label}</span><strong className={muted ? 'muted' : ''}>{value}</strong></div>
}

function Entities({ entities }) {
  const labels = { order_ids: 'Order IDs', tracking_ids: 'Tracking IDs', transaction_ids: 'Transaction IDs', card_references: 'Payment references', amounts: 'Amounts', dates: 'Dates' }
  const found = Object.entries(entities || {}).filter(([, values]) => values?.length)
  return <div className="sources"><p className="eyebrow">Detected entities</p>{found.length ? found.map(([type, values]) => <div className="source" key={type}><span>{labels[type] || type}</span><b>{values.join(', ')}</b><small>extracted</small></div>) : <p className="subtle">No operational references detected in this message.</p>}</div>
}

function Verification({ verification }) {
  if (!verification || !verification.status) return null
  const status = verification.status === 'reference_not_found' ? 'not-found' : verification.status === 'record_found_ownership_required' ? 'ownership' : 'neutral'
  const icon = status === 'not-found' ? '!' : status === 'ownership' ? '✓' : '—'
  return <div className={`verification ${status}`}><span className="verification-label">Verification</span><span className="verification-status"><b>{icon}</b>{verification.label}</span></div>
}

function DuplicateCandidates({ candidates = [] }) {
  if (!candidates.length) return null
  return <div className="duplicate-candidates"><span>Possible duplicate{candidates.length > 1 ? 's' : ''}</span>{candidates.map(candidate => <b key={candidate.ticket_id}>{candidate.ticket_id.slice(0, 8)} · {Math.round(candidate.similarity * 100)}% similar</b>)}</div>
}

function Evaluation({ metrics }) {
  const score = value => typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'
  const cards = [
    { label: 'Query-type macro F1', value: metrics?.query_type?.macro_f1, detail: 'Six-class support routing' },
    { label: 'Fine-intent macro F1', value: metrics?.baseline?.macro_f1, detail: 'Running TF-IDF baseline' },
    { label: 'DistilBERT macro F1', value: metrics?.transformer?.macro_f1, detail: 'Optional comparison model' },
    { label: 'Policy Recall@5', value: metrics?.retrieval?.recall_at_5, detail: 'Relevant policy in top five' },
    { label: 'Escalation F1', value: metrics?.safety?.escalation_f1, detail: 'Authored safety scenarios' },
  ]
  return <section className="queue-panel quality-panel" id="evaluation">
    <div className="panel-heading"><div><p className="eyebrow">Evaluation results</p><h2>Held-out performance by component</h2></div><span className="live-dot">Agent view</span></div>
    <div className="quality-metrics">{cards.map(card => <div className="metric quality-metric" key={card.label}><span>{card.label}</span><strong>{score(card.value)}</strong><p>{card.detail}</p></div>)}</div>
    <p className="quality-method">{metrics?.baseline?.examples ? `Classification: ${metrics.baseline.examples.toLocaleString()} held-out examples.` : 'Classification: held-out test split.'} {metrics?.retrieval?.queries ? `Retrieval: ${metrics.retrieval.queries} labelled policy queries.` : 'Retrieval: labelled policy queries.'} {metrics?.safety?.examples ? `Escalation: ${metrics.safety.examples} authored safety cases.` : 'Escalation: authored safety cases.'}</p>
    <p className="quality-caveat">These are dataset-level evaluation scores, not the confidence or correctness of an individual ticket. A dash means that evaluation has not been run locally yet.</p>
    <div className="quality-challenge"><p className="eyebrow">Generalization check</p><h3>Natural-phrasing challenge set</h3><p>48 project-authored messages written after training, with no exact overlap with the train or test CSVs. This is a stress test, not an independent real-customer benchmark.</p>{metrics?.challenge ? <div className="quality-challenge-scores"><Metric label="Query-type macro F1" value={score(metrics.challenge.query_type?.macro_f1)} /><Metric label="Fine-intent macro F1" value={score(metrics.challenge.fine_intent?.macro_f1)} /></div> : <p className="subtle">Run <code>python scripts/evaluate_challenge_set.py</code> to generate these results.</p>}<p>Compare these scores with the main held-out results above; a large gap indicates that natural wording remains difficult for the models.</p></div>
  </section>
}

function Distribution({ title, values }) {
  const entries = Object.entries(values || {})
  const maximum = Math.max(1, ...entries.map(([, count]) => count))
  return <div className="reasoning"><p className="eyebrow">Operational distribution</p><h3>{title}</h3>{entries.length ? entries.map(([name, count]) => <div className="bar-row" key={name}><span>{name.replaceAll('_', ' ')}</span><div className="bar"><i style={{ width: `${(count / maximum) * 100}%` }} /></div><b>{count}</b></div>) : <p className="subtle">No ticket data yet.</p>}</div>
}

function Operations({ analytics }) {
  if (!analytics) return <section className="queue-panel"><p className="subtle">Loading operational analytics…</p></section>
  const percent = `${Math.round(analytics.feedback_coverage * 100)}%`
  return <section className="queue-panel" id="operations"><div className="panel-heading"><div><p className="eyebrow">Operations dashboard</p><h2>Support workload and feedback loop</h2></div><span className="live-dot">Agent only</span></div><div className="stat-strip"><Metric label="Tickets processed" value={analytics.total_tickets} /><Metric label="Open queue" value={analytics.open_tickets} /><Metric label="Resolved" value={analytics.resolved_tickets} /><Metric label="Human feedback" value={percent} /></div><div className="result-columns" style={{ marginTop: 20 }}><Distribution title="Tickets by query type" values={analytics.by_query_type} /><Distribution title="Tickets by priority" values={analytics.by_priority} /></div><p className="subtle" style={{ marginTop: 16 }}>Human-reviewed corrections are retained separately from original model predictions and can be exported as a retraining dataset.</p></section>
}

function CustomerReceipt({ result }) {
  const message = result.escalate_to_human
    ? 'Your request has been sent to a specialist for secure review.'
    : 'Your request has been received and routed to the appropriate support team.'
  return <section className="blank" aria-live="polite"><span>✓</span><p className="eyebrow">Ticket received</p><h2>{message}</h2><p>Reference: <code>{result.ticket?.id || 'processing'}</code></p>{result.attachment && <p>Attachment analysed: <b>{result.attachment.name}</b></p>}<p>Save this reference to check your ticket status later. Detailed internal routing and policy evidence remain visible only in the agent console.</p></section>
}

function TicketStatusTracker({ initialReference = '' }) {
  const [reference, setReference] = useState(initialReference)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => { if (initialReference) setReference(initialReference) }, [initialReference])
  const lookup = async event => { event.preventDefault(); if (!reference.trim()) return; setLoading(true); setError(''); try { const response = await fetch(`${API}/tickets/${reference.trim()}/status`); const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Ticket not found.'); setStatus(body) } catch (err) { setStatus(null); setError(err.message) } finally { setLoading(false) } }
  return <section className="queue-panel" style={{ marginTop: 24 }}><div className="panel-heading"><div><p className="eyebrow">Customer follow-up</p><h2>Track an existing ticket</h2></div><span className="live-dot">Private reference</span></div><form onSubmit={lookup} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><input value={reference} onChange={event => setReference(event.target.value)} placeholder="Paste ticket reference" aria-label="Ticket reference" style={{ flex: '1 1 280px', padding: 11, border: '1px solid #d0d5dd', borderRadius: 9 }} /><button type="submit" style={{ padding: '10px 16px', border: 0, borderRadius: 9, background: '#155eef', color: '#fff', fontWeight: 700, cursor: 'pointer' }} disabled={loading}>{loading ? 'Checking…' : 'Check status'}</button></form>{status && <><div className="success" style={{ marginTop: 14 }}><b>Status: {status.status.replaceAll('_', ' ')}</b><span> · {status.human_review ? 'A specialist is reviewing this request.' : 'Assigned to ' + status.assigned_queue + '.'}</span></div><div className="timeline">{status.timeline?.map(event => <div className="timeline-event" key={`${event.status}-${event.created_at}`}><i /><div><b>{event.status.replaceAll('_', ' ')}</b><p>{event.message}</p></div></div>)}</div></>}{error && <p className="error">{error}</p>}</section>
}

function CustomerComposer({ message, attachment, clarificationQuestion, loading, error, onMessageChange, onAttachmentChange, onUseExample, onSubmit }) {
  return <div className="composer"><div className="panel-heading"><div><p className="eyebrow">New support ticket</p><h2>{clarificationQuestion ? 'A quick follow-up' : 'How can we help?'}</h2></div><button className="text-button" type="button" onClick={onUseExample}>Use example</button></div>{clarificationQuestion && <div className="clarification"><b>To route this safely</b><span>{clarificationQuestion}</span></div>}<form onSubmit={onSubmit}><label htmlFor="message">{clarificationQuestion ? 'Your answer' : 'Your message'}</label><textarea id="message" value={message} onChange={event => onMessageChange(event.target.value)} placeholder={clarificationQuestion ? 'Add the requested detail…' : 'Describe your delivery, payment, refund, account, or technical issue…'} maxLength="5000" /><div className="attachment-row">{!clarificationQuestion && <><label className="attachment-button" htmlFor="attachment">Attach file</label><input id="attachment" className="file-input" type="file" accept=".txt,.pdf,.docx,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => onAttachmentChange(event.target.files?.[0] || null)} />{attachment ? <span className="attachment-name">{attachment.name} <button type="button" onClick={() => onAttachmentChange(null)} aria-label="Remove attachment">×</button></span> : <span className="attachment-hint">Optional TXT, PDF, or DOCX · 2 MB max</span>}</>}</div><div className="form-footer"><span>{attachment ? 'Attachment text will be analysed securely' : `${message.length}/5000 characters`}</span><button disabled={loading}>{loading ? 'Sending request…' : clarificationQuestion ? 'Continue' : 'Submit request'} <b>→</b></button></div></form>{error && <p className="error">{error}</p>}</div>
}

function AgentLoginForm({ onLogin, onBack }) {
  const [accessKey, setAccessKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const submit = async event => { event.preventDefault(); setLoading(true); setError(''); try { await onLogin(accessKey) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  return <section className="blank"><span>⌁</span><p className="eyebrow">Agent access</p><h2>Sign in to the Agent Console</h2><p>Customer requests and internal triage evidence are separated.</p><form onSubmit={submit} style={{ maxWidth: 420, margin: '22px auto 0' }}><input type="password" value={accessKey} onChange={event => setAccessKey(event.target.value)} placeholder="Agent access key" minLength="8" required style={{ width: '100%', padding: 12, border: '1px solid #d0d5dd', borderRadius: 10 }} /><button style={{ width: '100%', marginTop: 10, padding: 12, border: 0, borderRadius: 10, background: '#155eef', color: '#fff', fontWeight: 700, cursor: 'pointer' }} disabled={loading}>{loading ? 'Verifying…' : 'Sign in as agent'}</button></form>{error && <p className="error" style={{ maxWidth: 420, margin: '12px auto 0' }}>{error}</p>}<button className="text-button" type="button" style={{ marginTop: 16 }} onClick={onBack}>Return to Customer Portal</button></section>
}

function Queue({ title, eyebrow, emptyText, showExport = false, tickets, loading, onStart, updatingId, onResolve, resolvingId, outcomes, onOutcomeChange, reviews, onReviewChange, onInspect, onExport, drafts, draftingId, onDraftReply, onDraftChange }) {
  return <section className="queue-panel">
    <div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div><div>{showExport && <button className="text-button" type="button" onClick={onExport}>Export reviewed feedback</button>} <span className="live-dot">Live</span></div></div>
    {loading ? <p className="subtle">Loading tickets…</p> : tickets.length === 0 ? <div className="empty"><span>⌁</span><p>{emptyText}</p></div> :
      <div className="ticket-list">{tickets.slice(0, 5).map(ticket => {
        const review = reviews[ticket.id] || { query_type: ticket.review?.final_query_type || ticket.query_type, intent: ticket.review?.final_intent || ticket.intent }
        return <article className="ticket" key={ticket.id}><div className="ticket-top"><Badge priority={ticket.priority} /><small>{ticket.intent.replaceAll('_', ' ')}</small></div><p>{ticket.customer_message}</p><footer><span>{ticket.department}</span><span>{ticket.status.replace('_', ' ')}</span></footer><button className="text-button" type="button" style={{ marginTop: 10 }} onClick={() => onInspect(ticket)}>View ticket details</button>{ticket.status === 'open' && <button className="text-button" type="button" style={{ marginTop: 7 }} onClick={() => onStart(ticket)} disabled={updatingId === ticket.id}>{updatingId === ticket.id ? 'Updating…' : 'Mark in progress'}</button>}<button className="text-button" type="button" style={{ marginTop: 7 }} onClick={() => onDraftReply(ticket)} disabled={draftingId === ticket.id}>{draftingId === ticket.id ? 'Drafting…' : 'Draft policy reply'}</button>{drafts[ticket.id] && <textarea aria-label={`Policy-grounded reply for ticket ${ticket.id}`} value={drafts[ticket.id]} onChange={event => onDraftChange(ticket.id, event.target.value)} placeholder="Editable policy-grounded reply" maxLength="2000" style={{ width: '100%', minHeight: 70, marginTop: 7, padding: 7, border: '1px solid #bed1ff', borderRadius: 7, color: '#344054', fontSize: '.65rem', resize: 'vertical' }} />}<label className="subtle" style={{ display: 'block', marginTop: 10, fontSize: '.63rem' }}>Agent-reviewed query type</label><select value={review.query_type} onChange={event => onReviewChange(ticket.id, { ...review, query_type: event.target.value })} style={{ width: '100%', marginTop: 4, padding: 7, border: '1px solid #dbe3ef', borderRadius: 7, fontSize: '.65rem' }}><option value="payment">Payment</option><option value="delivery">Delivery</option><option value="refund">Refund</option><option value="account_access">Account access</option><option value="technical_support">Technical support</option><option value="other">Other</option></select><input aria-label={`Corrected fine intent for ticket ${ticket.id}`} value={review.intent} onChange={event => onReviewChange(ticket.id, { ...review, intent: event.target.value })} placeholder="Correct fine intent" style={{ width: '100%', marginTop: 7, padding: 7, border: '1px solid #dbe3ef', borderRadius: 7, fontSize: '.65rem' }} /><textarea aria-label={`Outcome note for ticket ${ticket.id}`} value={outcomes[ticket.id] || ''} onChange={event => onOutcomeChange(ticket.id, event.target.value)} placeholder="Agent outcome note (optional)" maxLength="3000" style={{ width: '100%', minHeight: 46, marginTop: 7, padding: 7, border: '1px solid #dbe3ef', borderRadius: 7, color: '#344054', fontSize: '.65rem', resize: 'vertical' }} /><button className="resolve-button" style={{ width: '100%', marginTop: 8, padding: '7px', border: '1px solid #bed1ff', borderRadius: 7, background: '#f4f8ff', color: '#155eef', fontSize: '.64rem', fontWeight: 700, cursor: 'pointer' }} onClick={() => onResolve(ticket, outcomes[ticket.id], review, drafts[ticket.id])} disabled={resolvingId === ticket.id}>{resolvingId === ticket.id ? 'Saving…' : 'Save review & resolve ✓'}</button></article>
      })}</div>}
  </section>
}

function TicketInspector({ ticket, onClose }) {
  const sources = ticket.retrieved_sources || []
  const language = ticket.language?.translated ? `${ticket.language.source_language} → English` : ticket.language?.source_language || 'English'
  return <section className="result" aria-live="polite"><div className="result-banner"><div><p className="eyebrow">Selected agent ticket</p><h2>Ticket details</h2></div><div><Badge priority={ticket.priority} /> <button className="text-button" type="button" style={{ marginLeft: 10 }} onClick={onClose}>Close</button></div></div><div className="metrics-grid"><Metric label="Query type" value={ticket.query_type?.replaceAll('_', ' ') || 'other'} /><Metric label="Fine intent" value={ticket.intent.replaceAll('_', ' ')} /><Metric label="Confidence" value={`${Math.round(ticket.confidence * 100)}%`} muted={ticket.confidence < .55} /><Metric label="Language" value={language} /></div>{ticket.escalated && <div className="alert"><b>Human review required</b><span>{ticket.escalation_reasons.join(' · ')}</span></div>}<Verification verification={ticket.verification} /><DuplicateCandidates candidates={ticket.duplicate_candidates} /><div className="result-columns"><div className="reasoning"><p className="eyebrow">Customer message</p><h3>Stored, masked ticket</h3><blockquote>{ticket.customer_message}</blockquote><Entities entities={ticket.entities} /></div><div className="evidence"><p className="eyebrow">Reference materials</p><h3>Policy sources</h3><div className="sources">{sources.length ? sources.map(source => <div className="source" key={source.id}><span>{source.id}</span><b>{source.title}</b><small>{Math.round(source.score * 100)}% match</small></div>) : <p className="subtle">No policy sources were stored.</p>}</div>{ticket.agent_reply && <><p className="eyebrow" style={{ marginTop: 22 }}>Saved agent reply</p><blockquote>{ticket.agent_reply}</blockquote></>}{ticket.agent_outcome && <><p className="eyebrow" style={{ marginTop: 22 }}>Agent outcome</p><blockquote>{ticket.agent_outcome}</blockquote></>}</div></div></section>
}

function Result({ result }) {
  const top = result.top_intents?.[0]
  const displayedSources = result.retrieved_sources || []
  return <section className="result" aria-live="polite">
    <div className="result-banner"><div><p className="eyebrow">Triage decision</p><h2>Ticket is ready for its next action.</h2></div><Badge priority={result.priority} /></div>
    <div className="metrics-grid">
      <Metric label="Query type" value={result.query_type?.replaceAll('_', ' ') || 'other'} />
      <Metric label="Routing confidence" value={result.query_type_confidence == null ? '—' : `${Math.round(result.query_type_confidence * 100)}%`} muted={result.query_type_confidence != null && result.query_type_confidence < .45} />
      <Metric label="Fine intent" value={result.intent.replaceAll('_', ' ')} />
      <Metric label="Route" value={result.department} />
      <Metric label="Fine-label probability" value={`${Math.round(result.confidence * 100)}%`} muted={result.confidence < .45} />
      <Metric label="Sentiment" value={`${result.sentiment} · ${result.sentiment_score.toFixed(2)}`} />
      <Metric label="Language" value={result.language?.translated ? `${result.language.source_language} → English` : result.language?.source_language || 'English'} />
    </div>
    {result.escalate_to_human ? <div className="alert"><b>Human review required</b><span>{result.escalation_reasons.join(' · ')}</span></div> : <div className="success">✓ Safe for automatic specialist routing</div>}
    {result.agent_handoff && <div className="success"><b>Structured agent handoff</b><span> {result.agent_handoff.summary}</span></div>}
    <Verification verification={result.verification} />
    <DuplicateCandidates candidates={result.duplicate_candidates} />
    <div className="result-columns">
      <div className="reasoning"><p className="eyebrow">Decision signals</p><h3>Why this route</h3><ul>{result.explanation.map((item, index) => <li key={index}>{item}</li>)}</ul>
        <p className="subtle" style={{ fontSize: '.76rem' }}>Routing confidence comes from the six-class query-type model. Fine-label probability is distributed across 26 detailed intents, so it can be lower when several sub-intents overlap.</p><div className="intent-bars"><p className="eyebrow">Fine-label probability distribution</p>{result.top_intents.map(item => <div className="bar-row" key={item.intent}><span>{item.intent.replaceAll('_', ' ')}</span><div className="bar"><i style={{ width: `${item.confidence * 100}%` }} /></div><b>{Math.round(item.confidence * 100)}%</b></div>)}</div><Entities entities={result.entities} />
      </div>
      <div className="evidence"><p className="eyebrow">Recommended next step</p><h3>Policy-backed response</h3><blockquote>{result.suggested_response.answer}</blockquote><div className="sources"><p className="eyebrow">Reference materials</p>{displayedSources.map(source => <div className="source" key={source.id}><span>{source.id}</span><b>{source.title}</b><small>{Math.round(source.score * 100)}% match</small></div>)}</div></div>
    </div>
    {result.ticket && <p className="audit">Ticket saved · <code>{result.ticket.id}</code></p>}
  </section>
}

export default function App() {
  const [message, setMessage] = useState('')
  const [result, setResult] = useState(null)
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  const [queueLoading, setQueueLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)
  const [outcomes, setOutcomes] = useState({})
  const [reviews, setReviews] = useState({})
  const [drafts, setDrafts] = useState({})
  const [draftingId, setDraftingId] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [view, setView] = useState('customer')
  const [agentKey, setAgentKey] = useState(() => sessionStorage.getItem('resolveai_agent_key') || '')
  const [darkTheme, setDarkTheme] = useState(() => sessionStorage.getItem('resolveai_theme') === 'dark')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [attachment, setAttachment] = useState(null)
  const [clarificationQuestion, setClarificationQuestion] = useState('')
  const [initialCustomerMessage, setInitialCustomerMessage] = useState('')
  const [error, setError] = useState('')

  const activeTickets = useMemo(() => tickets.filter(ticket => ticket.status !== 'resolved'), [tickets])
  const manualReviewTickets = useMemo(() => activeTickets.filter(ticket => ticket.escalated), [activeTickets])
  const specialistTickets = useMemo(() => activeTickets.filter(ticket => !ticket.escalated), [activeTickets])
  const stats = useMemo(() => ({ total: activeTickets.length, critical: activeTickets.filter(t => t.priority === 'critical').length, escalated: activeTickets.filter(t => t.escalated).length }), [activeTickets])
  const agentHeaders = () => ({ 'X-Agent-Key': agentKey })
  const loadTickets = async () => { if (!agentKey) { setQueueLoading(false); return } setQueueLoading(true); try { const response = await fetch(`${API}/tickets?limit=20`, { headers: agentHeaders() }); if (!response.ok) throw new Error(); setTickets(await response.json()) } catch { setError('Agent session could not load ticket data. Sign in again or check the API.') } finally { setQueueLoading(false) } }
  const loadMetrics = async () => { if (!agentKey) return; try { const response = await fetch(`${API}/metrics`, { headers: agentHeaders() }); if (response.ok) setMetrics(await response.json()) } catch { /* Metrics are optional to normal ticket analysis. */ } }
  const loadAnalytics = async () => { if (!agentKey) return; try { const response = await fetch(`${API}/analytics`, { headers: agentHeaders() }); if (response.ok) setAnalytics(await response.json()) } catch { /* Analytics are supplemental to ticket operations. */ } }
  useEffect(() => { if (agentKey) { loadTickets(); loadMetrics(); loadAnalytics() } else { setQueueLoading(false); setTickets([]); setMetrics(null); setAnalytics(null) } }, [agentKey])
  useEffect(() => { document.body.classList.toggle('dark-body', darkTheme); sessionStorage.setItem('resolveai_theme', darkTheme ? 'dark' : 'light') }, [darkTheme])
  const analyse = async event => { event.preventDefault(); if (!attachment && message.trim().length < 3) return setError('Enter a complete message or attach a supported file.'); setLoading(true); setError(''); try { if (!attachment && !clarificationQuestion) { const check = await fetch(`${API}/tickets/clarify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }); const clarification = await check.json(); if (!check.ok) throw new Error(clarification.detail || 'Could not review the request.'); if (!clarification.ready) { setInitialCustomerMessage(message); setClarificationQuestion(clarification.question); setMessage(''); return } } let response; if (attachment) { const form = new FormData(); form.append('file', attachment); form.append('save', 'true'); response = await fetch(`${API}/tickets/analyse-attachment`, { method: 'POST', body: form }) } else { const finalMessage = clarificationQuestion ? `${initialCustomerMessage}\nAdditional customer detail: ${message}` : message; response = await fetch(`${API}/tickets/analyse`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: finalMessage, save: true }) }) } const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Analysis failed.'); setResult(body); setAttachment(null); setClarificationQuestion(''); setInitialCustomerMessage(''); await loadTickets(); await loadAnalytics() } catch (err) { setError(err.message.includes('fetch') ? 'The FastAPI service is unavailable. Start it on port 8000.' : err.message) } finally { setLoading(false) } }
  const draftReply = async ticket => { setDraftingId(ticket.id); setError(''); try { const response = await fetch(`${API}/tickets/${ticket.id}/draft-reply`, { method: 'POST', headers: agentHeaders() }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Could not draft a reply.'); setDrafts(current => ({ ...current, [ticket.id]: body.draft })) } catch (err) { setError(err.message.includes('fetch') ? 'The FastAPI service is unavailable. Start it on port 8000.' : err.message) } finally { setDraftingId(null) } }
  const startTicket = async ticket => { setUpdatingId(ticket.id); setError(''); try { const response = await fetch(`${API}/tickets/${ticket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...agentHeaders() }, body: JSON.stringify({ status: 'in_progress' }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Could not update ticket status.'); await loadTickets(); await loadAnalytics() } catch (err) { setError(err.message.includes('fetch') ? 'The FastAPI service is unavailable. Start it on port 8000.' : err.message) } finally { setUpdatingId(null) } }
  const resolveTicket = async (ticket, outcome, review, draft) => { setResolvingId(ticket.id); setError(''); try { const response = await fetch(`${API}/tickets/${ticket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...agentHeaders() }, body: JSON.stringify({ status: 'resolved', agent_outcome: outcome?.trim() || 'Resolved from the agent workspace.', agent_reply: draft?.trim() || null, reviewer: 'Support agent', final_query_type: review?.query_type || ticket.query_type, final_intent: review?.intent?.trim() || ticket.intent }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Could not resolve ticket.'); setOutcomes(current => { const next = { ...current }; delete next[ticket.id]; return next }); setReviews(current => { const next = { ...current }; delete next[ticket.id]; return next }); setDrafts(current => { const next = { ...current }; delete next[ticket.id]; return next }); await loadTickets(); await loadAnalytics() } catch (err) { setError(err.message.includes('fetch') ? 'The FastAPI service is unavailable. Start it on port 8000.' : err.message) } finally { setResolvingId(null) } }
  const exportFeedback = async () => { setError(''); try { const response = await fetch(`${API}/feedback/export`, { headers: agentHeaders() }); if (!response.ok) throw new Error('Could not export reviewed feedback.'); const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a'); link.href = url; link.download = 'agent_feedback.csv'; link.click(); URL.revokeObjectURL(url) } catch (err) { setError(err.message.includes('fetch') ? 'The FastAPI service is unavailable. Start it on port 8000.' : err.message) } }
  const loginAgent = async accessKey => { const response = await fetch(`${API}/agent/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_key: accessKey }) }); const body = await response.json(); if (!response.ok) throw new Error(body.detail || 'Agent sign-in failed.'); sessionStorage.setItem('resolveai_agent_key', accessKey); setAgentKey(accessKey); setView('agent') }
  const openAgentView = target => setView(agentKey ? target : 'login')
  const logoutAgent = () => { sessionStorage.removeItem('resolveai_agent_key'); setAgentKey(''); setView('customer') }

  return <main className={darkTheme ? 'dark-mode' : ''}>
    <style>{darkThemeCss + themeToggleCss}</style><nav><a className="brand" href="#top" onClick={() => setView('customer')}><span>R</span> ResolveAI</a><div><a href="#customer" onClick={() => setView('customer')}>Customer portal</a><a href="#agent" onClick={() => openAgentView('agent')}>Agent console</a><a href="#operations" onClick={() => openAgentView('operations')}>Operations</a><a href="#evaluation" onClick={() => openAgentView('quality')}>Model quality</a>{agentKey && <a href="#customer" onClick={logoutAgent}>Sign out</a>}<button className="theme-toggle" type="button" onClick={() => setDarkTheme(current => !current)} aria-label={`Switch to ${darkTheme ? 'light' : 'dark'} theme`}><span className={`theme-mark ${darkTheme ? 'sun' : 'moon'}`} aria-hidden="true" /><span>{darkTheme ? 'Light' : 'Dark'}</span></button><span className="system">SYSTEM ONLINE</span></div></nav>
    {view === 'quality'
      ? <header className="quality-intro" id="top"><p className="eyebrow">Agent workspace · Model quality</p><h1>Model evaluation</h1><p>Held-out results for query classification, fine-intent classification, policy retrieval, and escalation.</p></header>
      : <header className="hero" id="top"><div><p className="eyebrow">{view === 'customer' ? 'Customer support portal' : view === 'agent' ? 'Restricted agent workspace' : 'Operations workspace'}</p><h1>{view === 'customer' ? <>Get help with<br /><em>confidence.</em></> : view === 'agent' ? <>Resolve every<br /><em>important signal.</em></> : <>See every<br /><em>support signal.</em></>}</h1><p className="lead">{view === 'customer' ? 'Submit a delivery, payment, refund, account, or technical request. Sensitive and uncertain cases are securely assigned to a specialist.' : view === 'agent' ? 'Review routed tickets, check ticket details, and record human outcomes.' : 'Monitor support workload, resolution progress, and the human-feedback data that improves the next model version.'}</p></div><div className="hero-orb"><span className="triage-mark" aria-hidden="true" /><small>TRIAGE<br />ENGINE</small></div></header>}
    {view === 'customer' && <><section className="workspace" id="customer"><CustomerComposer message={message} attachment={attachment} clarificationQuestion={clarificationQuestion} loading={loading} error={error} onMessageChange={setMessage} onAttachmentChange={setAttachment} onUseExample={() => { setMessage(example); setClarificationQuestion(''); setInitialCustomerMessage('') }} onSubmit={analyse} /><aside className="guardrail"><p className="eyebrow">Customer protection</p><h3>Helpful. Never speculative.</h3><p>We do not ask for passwords, one-time codes, or full payment details. Sensitive requests are reviewed by a human specialist.</p><ul><li>Suspected fraud → priority review</li><li>Uncertain request → human verification</li><li>Human request → agent assignment</li></ul></aside></section>{result ? <CustomerReceipt result={result} /> : <section className="blank"><span>R</span><p className="eyebrow">Secure support</p><h2>Tell us what you need help with.</h2><p>Your support request will be triaged and routed securely.</p></section>}<TicketStatusTracker initialReference={result?.ticket?.id || ''} /></>}
    {view === 'login' && <AgentLoginForm onLogin={loginAgent} onBack={() => setView('customer')} />}
    {view === 'agent' && <><section className="stat-strip"><Metric label="Active tickets" value={stats.total} /><Metric label="Critical risk" value={stats.critical} /><Metric label="Manual review required" value={stats.escalated} /><Metric label="Decision mode" value="Policy guided" /></section>{result && <Result result={result} />}{selectedTicket && <TicketInspector ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}<div id="agent"><Queue title="Manual review queue" eyebrow="Human escalation" emptyText="No tickets require manual verification." showExport tickets={manualReviewTickets} loading={queueLoading} onStart={startTicket} updatingId={updatingId} onResolve={resolveTicket} resolvingId={resolvingId} outcomes={outcomes} onOutcomeChange={(ticketId, note) => setOutcomes(current => ({ ...current, [ticketId]: note }))} reviews={reviews} onReviewChange={(ticketId, review) => setReviews(current => ({ ...current, [ticketId]: review }))} onInspect={setSelectedTicket} onExport={exportFeedback} drafts={drafts} draftingId={draftingId} onDraftReply={draftReply} onDraftChange={(ticketId, draft) => setDrafts(current => ({ ...current, [ticketId]: draft }))} /><Queue title="Specialist queue" eyebrow="Safely auto-routed" emptyText="No tickets are waiting for specialist handling." tickets={specialistTickets} loading={queueLoading} onStart={startTicket} updatingId={updatingId} onResolve={resolveTicket} resolvingId={resolvingId} outcomes={outcomes} onOutcomeChange={(ticketId, note) => setOutcomes(current => ({ ...current, [ticketId]: note }))} reviews={reviews} onReviewChange={(ticketId, review) => setReviews(current => ({ ...current, [ticketId]: review }))} onInspect={setSelectedTicket} onExport={exportFeedback} drafts={drafts} draftingId={draftingId} onDraftReply={draftReply} onDraftChange={(ticketId, draft) => setDrafts(current => ({ ...current, [ticketId]: draft }))} /></div>{error && <p className="error">{error}</p>}</>}
    {view === 'operations' && <Operations analytics={analytics} />}
    {view === 'quality' && <Evaluation metrics={metrics} />}
    <footer className="app-footer"><span>ResolveAI · Customer Support System</span><span>Academic prototype · Not connected to live customer accounts</span></footer>
  </main>
}
