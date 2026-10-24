import { useEffect, useState } from 'react';
import { businessRule, customer, refundRequest } from './mockData';

type Role = 'staff' | 'boss';
type DecisionAction = 'Approve Cash' | 'Offer Store Credit' | 'Reject';

type Recommendation = {
  recommendation: string;
  reasoning: string;
  confidence: number;
};

type DecisionReceipt = {
  id: string;
  action: DecisionAction;
  timestamp: string;
  reasoning: string;
  confidence: number;
  message?: string;
  messageError?: string;
};

type GroqResponse = {
  error?: { message?: string };
  choices?: Array<{ message?: { content?: string | null } }>;
};

const decisionActions: DecisionAction[] = [
  'Approve Cash',
  'Offer Store Credit',
  'Reject',
];

async function groqChat(
  systemPrompt: string,
  userPrompt: string,
  jsonMode = false,
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'Add your Groq API key to .env as VITE_GROQ_API_KEY, then restart the dev server.',
    );
  }

  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        temperature: 0.2,
        max_tokens: jsonMode ? 180 : 180,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    },
  );

  const result = (await response.json()) as GroqResponse;
  if (!response.ok) {
    throw new Error(
      result.error?.message ??
        `Groq request failed (${response.status}). Check the key, model, and free-tier limits.`,
    );
  }

  const content = result.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Groq returned an empty response. Please try again.');
  }
  return content;
}

async function getRecommendation(): Promise<Recommendation> {
  const content = await groqChat(
    'You help a small Malaysian business owner review refund exceptions. Be concise and explain the strongest relevant factors. The owner always makes the final decision; do not claim the refund was automatically approved. Respond only with a JSON object containing exactly these fields: {"recommendation": "Approve", "reasoning": "Short reason", "confidence": 95}. recommendation must be one of "Approve", "Offer Store Credit", or "Reject". confidence must be an integer from 0 to 100.',
    `Review this synthetic refund request.
Customer: ${customer.name}, ${customer.tier}, lifetime value RM${customer.lifetimeValue}.
Request: RM${refundRequest.amount} ${refundRequest.type.toLowerCase()} for "${refundRequest.reason}".
Item tags returned: ${refundRequest.tagsReturned ? 'yes' : 'no'}.
Staff note: submitted by ${refundRequest.submittedBy}.
Business rule: ${businessRule.description}.
Consider both the matching rule and the missing tags. Recommend one option for the owner to consider; do not take action.`,
    true,
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Groq did not return valid JSON. Please generate the recommendation again.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('recommendation' in parsed) ||
    !('reasoning' in parsed) ||
    !('confidence' in parsed)
  ) {
    throw new Error('Groq returned an incomplete recommendation. Please try again.');
  }

  const recommendation = parsed as Record<string, unknown>;
  if (
    typeof recommendation.recommendation !== 'string' ||
    !decisionActions.includes(recommendation.recommendation as DecisionAction) ||
    typeof recommendation.reasoning !== 'string' ||
    !recommendation.reasoning.trim() ||
    typeof recommendation.confidence !== 'number' ||
    !Number.isFinite(recommendation.confidence) ||
    recommendation.confidence < 0 ||
    recommendation.confidence > 100
  ) {
    throw new Error('Groq returned a recommendation in an unexpected format. Please try again.');
  }

  return {
    recommendation: recommendation.recommendation,
    reasoning: recommendation.reasoning.trim(),
    confidence: Math.round(recommendation.confidence),
  };
}

async function getWhatsAppDraft(action: DecisionAction): Promise<string> {
  const content = await groqChat(
    'Write one warm, polite WhatsApp message for a Malaysian small-business customer. Keep it under 60 words, use a natural tone, and do not invent facts. Return only the message text, with no quotation marks or heading.',
    `Draft a message to ${customer.name} about her RM${refundRequest.amount} refund request for a ${refundRequest.reason.toLowerCase()}. The owner decided: ${action}. If approved, say the refund is approved. If store credit was offered, clearly describe it as store credit instead of cash. If rejected, apologize kindly and explain that the item tags were not returned. Do not say a message has already been sent.`,
  );
  return content.replace(/^["']|["']$/g, '').trim();
}

function formatRM(amount: number): string {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(timestamp: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

function App() {
  const [role, setRole] = useState<Role>('staff');
  const [submitted, setSubmitted] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationError, setRecommendationError] = useState('');
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activity, setActivity] = useState<DecisionReceipt[]>([]);
  const [draftLoadingId, setDraftLoadingId] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const isDecided = activity.length > 0;

  async function handleSubmitRequest() {
    setIsSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setSubmitted(true);
    setIsSubmitting(false);
    setToast('Request sent to the Boss review queue.');
  }

  async function handleGenerateRecommendation() {
    setIsGeneratingRecommendation(true);
    setRecommendationError('');
    try {
      setRecommendation(await getRecommendation());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate a recommendation.';
      setRecommendationError(message);
      setToast('Could not reach the AI. Check the setup and try again.');
    } finally {
      setIsGeneratingRecommendation(false);
    }
  }

  async function generateDraftForReceipt(receipt: DecisionReceipt) {
    setDraftLoadingId(receipt.id);
    setActivity((current) =>
      current.map((item) =>
        item.id === receipt.id ? { ...item, messageError: undefined } : item,
      ),
    );
    try {
      const message = await getWhatsAppDraft(receipt.action);
      setActivity((current) =>
        current.map((item) =>
          item.id === receipt.id
            ? { ...item, message, messageError: undefined }
            : item,
        ),
      );
      setToast('Decision saved. Customer message draft is ready to review.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not generate the message draft.';
      setActivity((current) =>
        current.map((item) =>
          item.id === receipt.id ? { ...item, messageError: message } : item,
        ),
      );
      setToast('Decision saved, but the message draft could not be generated.');
    } finally {
      setDraftLoadingId('');
    }
  }

  async function handleDecision(action: DecisionAction) {
    if (isDecided || !recommendation) return;

    const receipt: DecisionReceipt = {
      id: `TB-${Date.now().toString().slice(-6)}`,
      action,
      timestamp: new Date().toISOString(),
      reasoning: recommendation.reasoning,
      confidence: recommendation.confidence,
    };

    setActivity((current) => [receipt, ...current]);
    await generateDraftForReceipt(receipt);
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-line bg-white/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a className="flex items-center gap-3" href="#" aria-label="TwinBoss home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-lg font-black tracking-tight text-white shadow-sm">
              tb
            </span>
            <span>
              <span className="block text-lg font-bold leading-5 tracking-tight">TwinBoss</span>
              <span className="mt-1 block text-xs text-muted">Decisions, in sync</span>
            </span>
          </a>

          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="workflow">Workflow</label>
            <select
              id="workflow"
              value="supplier"
              disabled
              className="h-10 cursor-not-allowed rounded-lg border border-line bg-gray-50 px-3 text-sm text-muted opacity-80"
            >
              <option value="supplier">Supplier Payments (Coming Soon)</option>
            </select>

            <div
              className="flex rounded-xl border border-line bg-gray-50 p-1"
              aria-label="Choose demo role"
            >
              {(['staff', 'boss'] as const).map((nextRole) => (
                <button
                  key={nextRole}
                  type="button"
                  onClick={() => setRole(nextRole)}
                  aria-pressed={role === nextRole}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    role === nextRole
                      ? 'bg-white text-forest shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {nextRole === 'staff' ? 'Staff Mode' : 'Boss Mode'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="app-grid mx-auto min-h-[calc(100vh-73px)] max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="mb-8 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-semibold text-forest shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Refund exceptions
            </div>
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
              {role === 'staff' ? 'A small decision, moving forward.' : 'Your team, in sync.'}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted sm:text-base">
              {role === 'staff'
                ? 'Send the context to your boss. TwinBoss keeps the details and the decision together.'
                : 'Review the request, see why the AI recommends an option, then make the final call.'}
            </p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-full bg-white px-3 py-2 text-xs font-medium text-muted shadow-sm md:self-auto">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Demo workspace · Synthetic data
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3" aria-label="Decision insights">
          <MetricCard
            label="Customer lifetime value"
            value={formatRM(customer.lifetimeValue)}
            detail="Siti · VIP customer"
            icon={<span className="text-lg">↗</span>}
          />
          <MetricCard
            label="Owner rule"
            value={`Under ${formatRM(businessRule.amountLimit)}`}
            detail="VIP refund exception"
            icon={<span className="text-lg">✓</span>}
          />
          <MetricCard
            label="Time returned to the team"
            value={activity.length ? `${activity.length * 8} min` : '8 min'}
            detail={activity.length ? 'Estimated · decisions logged' : 'Estimated per review'}
            icon={<span className="text-lg">◷</span>}
          />
        </section>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-panel">
            <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Incoming request</p>
                <h2 className="mt-1 text-lg font-bold">Refund exception</h2>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isDecided
                    ? 'bg-slate-100 text-slate-600'
                    : submitted
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-gray-100 text-muted'
                }`}
              >
                {isDecided ? 'Resolved' : submitted ? 'Awaiting review' : 'Draft'}
              </span>
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-bold text-forest">
                  {customer.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold">{customer.name}</h3>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                      {customer.tier}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">Customer since 2021 · LTV {formatRM(customer.lifetimeValue)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted">Request amount</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{formatRM(refundRequest.amount)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DetailItem label="Request type" value={refundRequest.type} />
                <DetailItem label="Reason" value={refundRequest.reason} />
                <DetailItem label="Item tags" value={refundRequest.tagsReturned ? 'Returned' : 'Not returned'} />
                <DetailItem label="Submitted by" value={refundRequest.submittedBy} />
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-forest shadow-sm">✓</span>
                <div>
                  <p className="text-sm font-semibold text-ink">Relevant business rule</p>
                  <p className="mt-1 text-sm leading-5 text-muted">{businessRule.description}</p>
                  <p className="mt-2 text-xs font-medium text-forest">
                    Request is {formatRM(businessRule.amountLimit - refundRequest.amount)} below this rule&apos;s limit
                  </p>
                </div>
              </div>

              {role === 'staff' && (
                <div className="mt-6">
                  {submitted ? (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-forest" role="status">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-bold">✓</span>
                      <span><strong>Sent to the Boss.</strong> The request is ready for review.</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSubmitRequest}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-70"
                    >
                      {isSubmitting ? <span className="spinner" /> : null}
                      {isSubmitting ? 'Sending request…' : 'Submit to Boss'}
                      {!isSubmitting ? <span aria-hidden="true">→</span> : null}
                    </button>
                  )}
                  <p className="mt-3 text-center text-xs text-muted">
                    Local demo only · No real customer or payment data
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-panel">
            <div className="border-b border-line px-5 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Human-in-the-loop review</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold">Boss decision</h2>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                  <span aria-hidden="true">✦</span> AI assist
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {!submitted ? (
                <div className="rounded-xl border border-dashed border-line bg-gray-50 p-6 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl text-muted shadow-sm">⌁</div>
                  <h3 className="mt-3 text-sm font-bold">Waiting for the staff handoff</h3>
                  <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-muted">
                    Switch to Staff Mode and submit the request to start the review.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRole('staff')}
                    className="mt-4 text-sm font-semibold text-forest hover:underline"
                  >
                    Go to Staff Mode
                  </button>
                </div>
              ) : (
                <>
                  {recommendation ? (
                    <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.1em] text-violet-700">TwinBoss recommends</span>
                        <span className="text-sm font-bold text-violet-800">{recommendation.confidence}% confidence</span>
                      </div>
                      <h3 className="mt-2 text-2xl font-bold tracking-tight">{recommendation.recommendation}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted">{recommendation.reasoning}</p>
                      <div
                        className="mt-4 h-2 overflow-hidden rounded-full bg-violet-100"
                        role="meter"
                        aria-label="AI confidence"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={recommendation.confidence}
                      >
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all"
                          style={{ width: `${recommendation.confidence}%` }}
                        />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-muted">
                        Confidence reflects the model&apos;s estimate, not a guarantee. Your rule and the missing tags are shown above. You make the final decision.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-5">
                      <p className="text-sm font-semibold">Give the request a second opinion.</p>
                      <p className="mt-1 text-sm leading-5 text-muted">
                        TwinBoss weighs the VIP rule against the damaged item and missing tags. Nothing is approved automatically.
                      </p>
                    </div>
                  )}

                  {recommendationError && (
                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm leading-5 text-rose-700" role="alert">
                      {recommendationError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateRecommendation}
                    disabled={isGeneratingRecommendation || isDecided}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-800 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGeneratingRecommendation ? <span className="spinner" /> : <span aria-hidden="true">✦</span>}
                    {isGeneratingRecommendation
                      ? 'Reviewing the request…'
                      : recommendation
                        ? 'Generate AI recommendation again'
                        : 'Generate AI Recommendation'}
                  </button>

                  {recommendation && (
                    <div className="mt-5">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.1em] text-muted">Your decision · choose one</p>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <DecisionButton
                          action="Approve Cash"
                          onClick={handleDecision}
                          disabled={isDecided}
                          style="primary"
                        />
                        <DecisionButton
                          action="Offer Store Credit"
                          onClick={handleDecision}
                          disabled={isDecided}
                          style="secondary"
                        />
                        <DecisionButton
                          action="Reject"
                          onClick={handleDecision}
                          disabled={isDecided}
                          style="quiet"
                        />
                      </div>
                      {isDecided && (
                        <p className="mt-3 text-center text-xs text-muted" role="status">
                          Decision recorded for this demo request.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-line bg-white shadow-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">A clear audit trail</p>
              <h2 className="mt-1 text-lg font-bold">Decision receipts</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-muted">
              {activity.length} {activity.length === 1 ? 'decision' : 'decisions'}
            </span>
          </div>

          {activity.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-lg text-muted">⌖</div>
              <p className="mt-3 text-sm font-semibold">No decisions yet</p>
              <p className="mt-1 text-sm text-muted">Once the Boss chooses an option, the decision and message draft appear here.</p>
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {activity.map((receipt) => (
                <li key={receipt.id} className="px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 font-bold text-forest">✓</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{receipt.action}</h3>
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-muted">
                            {refundRequest.id}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {customer.name} · {formatRM(refundRequest.amount)} · {receipt.reasoning}
                        </p>
                      </div>
                    </div>
                    <time className="text-xs text-muted" dateTime={receipt.timestamp}>
                      {formatTime(receipt.timestamp)}
                    </time>
                  </div>

                  <div className="ml-12 mt-4 rounded-xl bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">WhatsApp message draft</p>
                      <span className="text-[11px] font-medium text-muted">Review before sharing · not sent</span>
                    </div>
                    {receipt.message ? (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{receipt.message}</p>
                    ) : draftLoadingId === receipt.id ? (
                      <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
                        <span className="spinner text-forest" /> Writing a polite customer update…
                      </p>
                    ) : receipt.messageError ? (
                      <div className="mt-3">
                        <p className="text-sm leading-5 text-rose-700" role="alert">{receipt.messageError}</p>
                        <button
                          type="button"
                          onClick={() => generateDraftForReceipt(receipt)}
                          className="mt-2 text-sm font-semibold text-forest hover:underline"
                        >
                          Try generating the draft again
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-muted">Message draft is being prepared.</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="mt-8 flex flex-col gap-2 border-t border-line/80 py-5 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Fictional demo data · Decisions stay in this browser session · No messages or payments are sent</p>
          <p>AI assists. People decide.</p>
        </footer>
      </main>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-ink px-5 py-3 text-sm font-medium text-white shadow-xl"
          role="status"
          aria-live="polite"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-panel sm:p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 font-bold text-forest">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-gray-50/70 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

function DecisionButton({
  action,
  onClick,
  disabled,
  style,
}: {
  action: DecisionAction;
  onClick: (action: DecisionAction) => void;
  disabled: boolean;
  style: 'primary' | 'secondary' | 'quiet';
}) {
  const styles = {
    primary: 'bg-forest text-white hover:bg-emerald-800',
    secondary: 'border border-emerald-200 bg-emerald-50 text-forest hover:bg-emerald-100',
    quiet: 'border border-line bg-white text-ink hover:bg-gray-50',
  };

  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={disabled}
      className={`min-h-11 rounded-xl px-3 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[style]}`}
    >
      {action}
    </button>
  );
}

export default App;
