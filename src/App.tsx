import { FormEvent, useEffect, useRef, useState } from 'react';
import { businessRule, customers } from './mockData';

type Role = 'staff' | 'boss' | 'customer' | null;
type Recommendation = 'Approve' | 'Offer Store Credit' | 'Reject';
type Decision = 'Approve Cash' | 'Offer Store Credit' | 'Reject';
type RequestStatus =
  | 'customer-pending'
  | 'boss-pending'
  | 'approved-pending-execution'
  | 'rejected'
  | 'executed';
type Language = 'English' | 'Malay';

interface AiAnalysis {
  customer_name: string;
  amount: number;
  reason: string;
  sentiment: 'Angry' | 'Neutral' | 'Polite';
  recommendation: Recommendation;
  reasoning: string;
  confidence: number;
}

interface RefundRequest {
  id: string;
  orderId: string;
  message: string;
  bankAccount: string;
  photoAttached: boolean;
  photoName: string;
  submittedAt: string;
  status: RequestStatus;
  analysis?: AiAnalysis;
  validityScore?: number;
  decision?: Decision;
  overrideReason?: string;
  autoApproved?: boolean;
  obId?: string;
  draft?: string;
  draftLanguage?: Language;
  messageSent?: boolean;
  paymentConfirmed?: boolean;
  transactionId?: string;
  receiptShared?: boolean;
}

const decisions: Decision[] = ['Approve Cash', 'Offer Store Credit', 'Reject'];
const languages: Language[] = ['English', 'Malay'];

function newId(prefix: string) {
  return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function validityFor(request: Pick<RefundRequest, 'message' | 'photoAttached' | 'bankAccount'>) {
  return (
    (request.photoAttached ? 45 : 0) +
    (request.bankAccount.trim() ? 35 : 0) +
    (request.message.trim().length >= 20 ? 20 : request.message.trim() ? 10 : 0)
  );
}

function toDecision(recommendation: Recommendation): Decision {
  return recommendation === 'Approve' ? 'Approve Cash' : recommendation;
}

function parseAnalysis(content: string): AiAnalysis {
  const cleaned = content.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('The AI response did not contain a JSON object.');
  const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object') throw new Error('The AI response was not a valid object.');
  const result = parsed as Record<string, unknown>;
  const recommendations: Recommendation[] = ['Approve', 'Offer Store Credit', 'Reject'];
  const sentiments = ['Angry', 'Neutral', 'Polite'];
  if (
    typeof result.customer_name !== 'string' ||
    typeof result.amount !== 'number' ||
    !Number.isFinite(result.amount) ||
    result.amount < 0 ||
    typeof result.reason !== 'string' ||
    !sentiments.includes(String(result.sentiment)) ||
    !recommendations.includes(result.recommendation as Recommendation) ||
    typeof result.reasoning !== 'string' ||
    typeof result.confidence !== 'number' ||
    !Number.isFinite(result.confidence)
  ) {
    throw new Error('The AI response is missing required refund analysis fields.');
  }
  return {
    customer_name: result.customer_name,
    amount: result.amount,
    reason: result.reason,
    sentiment: result.sentiment as AiAnalysis['sentiment'],
    recommendation: result.recommendation as Recommendation,
    reasoning: result.reasoning,
    confidence: Math.max(0, Math.min(100, result.confidence)),
  };
}

async function requestAiAnalysis(request: RefundRequest): Promise<AiAnalysis> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('AI is not configured. Add VITE_GROQ_API_KEY to your .env file.');
  const customerProfiles = customers.map(({ name, tier, lifetimeValue }) => ({
    name,
    tier,
    lifetimeValue,
  }));
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an SME operations manager. Return only a strict JSON object with exactly these fields: customer_name (string), amount (number), reason (string), sentiment ("Angry", "Neutral", or "Polite"), recommendation ("Approve", "Offer Store Credit", or "Reject"), reasoning (short string), confidence (number from 0 to 100). Extract facts from the customer message; do not invent missing details. Match the customer against this local Orbyte CRM preview: ${JSON.stringify(customerProfiles)}. If the customer is unknown, use "New Customer". Apply this business rule when relevant: ${businessRule.description}. Consider photo-attached and bank-details-provided flags as validity context, but do not request or repeat bank account numbers.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            order_id: request.orderId,
            customer_message: request.message,
            photo_attached: request.photoAttached,
            bank_details_provided: Boolean(request.bankAccount.trim()),
          }),
        },
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `Groq request failed (${response.status}).`,
    );
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Groq returned an empty analysis.');
  const analysis = parseAnalysis(content);
  const matchedCustomer = customers.find(
    (customer) => customer.name.toLowerCase() === analysis.customer_name.trim().toLowerCase(),
  );
  if (matchedCustomer?.tier === 'VIP' && analysis.amount < businessRule.amountLimit) {
    return {
      ...analysis,
      recommendation: 'Approve',
      reasoning: `${analysis.reasoning} ${matchedCustomer.name}'s VIP rule supports approval under RM${businessRule.amountLimit}.`,
    };
  }
  return analysis;
}

async function requestMessageDraft(
  request: RefundRequest,
  decision: Decision,
  language: Language,
): Promise<string> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) throw new Error('AI is not configured. Add VITE_GROQ_API_KEY to your .env file.');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: `Write one warm, polite WhatsApp message in ${language === 'Malay' ? 'conversational Malaysian Malay (Bahasa Melayu)' : 'English'}. State the decision clearly, keep it concise, and do not invent payment timing. Return only the message text.`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            customer_name: request.analysis?.customer_name ?? 'Customer',
            order_id: request.orderId,
            amount: request.analysis?.amount ?? 0,
            reason: request.analysis?.reason ?? 'refund request',
            decision,
          }),
        },
      ],
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof payload?.error?.message === 'string'
        ? payload.error.message
        : `Groq request failed (${response.status}).`,
    );
  }
  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Groq returned an empty message draft.');
  return text.trim().replace(/^```(?:text)?\s*|\s*```$/gi, '');
}

function App() {
  const [currentUser, setCurrentUser] = useState<Role>(null);
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [walletBalance, setWalletBalance] = useState(5000);
  const [autoPilot, setAutoPilot] = useState(false);
  const [activeStaffTab, setActiveStaffTab] = useState<'customer' | 'tasks'>('customer');
  const [activeBossTab, setActiveBossTab] = useState<'queue' | 'activity'>('queue');
  const [selectedStaffRequest, setSelectedStaffRequest] = useState<string | null>(null);
  const [selectedBossRequest, setSelectedBossRequest] = useState<string | null>(null);
  const [analysisLoadingId, setAnalysisLoadingId] = useState<string | null>(null);
  const [draftLanguage, setDraftLanguage] = useState<Language>('English');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [pendingDecision, setPendingDecision] = useState<{ requestId: string; decision: Decision } | null>(
    null,
  );
  const [paymentModalRequestId, setPaymentModalRequestId] = useState<string | null>(null);
  const [paymentModalAudience, setPaymentModalAudience] = useState<'staff' | 'boss' | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const autoProcessedIds = useRef(new Set<string>());
  const requestSequence = useRef(1);

  const updateRequest = (id: string, update: (request: RefundRequest) => RefundRequest) => {
    setRequests((items) => items.map((item) => (item.id === id ? update(item) : item)));
  };

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (!autoPilot) return;
    const candidate = requests.find(
      (request) =>
        request.status === 'boss-pending' &&
        request.analysis !== undefined &&
        request.validityScore !== undefined &&
        request.validityScore > 90 &&
        request.analysis.amount < 50 &&
        !autoProcessedIds.current.has(request.id),
    );
    if (!candidate) return;
    autoProcessedIds.current.add(candidate.id);
    const approvedRequest: RefundRequest = {
      ...candidate,
      status: 'approved-pending-execution',
      decision: 'Approve Cash',
      autoApproved: true,
      obId: newId('OB'),
      draftLanguage,
    };
    setRequests((items) =>
      items.map((item) => (item.id === candidate.id ? approvedRequest : item)),
    );
    setPaymentModalRequestId(candidate.id);
    setPaymentModalAudience('staff');
    setToast(`${candidate.orderId} met Auto-Pilot criteria and is in the activity log.`);
    void requestMessageDraft(approvedRequest, 'Approve Cash', draftLanguage)
      .then((draft) => updateRequest(candidate.id, (item) => ({ ...item, draft })))
      .catch((draftError: unknown) => {
        setError(draftError instanceof Error ? draftError.message : 'Could not generate the customer message.');
      });
  }, [autoPilot, requests, draftLanguage]);

  const analyzeRequest = async (request: RefundRequest) => {
    setError('');
    setAnalysisLoadingId(request.id);
    setSelectedStaffRequest(request.id);
    try {
      const analysis = await requestAiAnalysis(request);
      updateRequest(request.id, (item) => ({
        ...item,
        analysis,
        validityScore: validityFor(item),
      }));
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Could not analyze this request.');
    } finally {
      setAnalysisLoadingId(null);
    }
  };

  const handleBossReanalysis = async (request: RefundRequest) => {
    setError('');
    setAnalysisLoadingId(request.id);
    try {
      const analysis = await requestAiAnalysis(request);
      updateRequest(request.id, (item) => ({ ...item, analysis }));
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Could not analyze this request.');
    } finally {
      setAnalysisLoadingId(null);
    }
  };

  const submitToBoss = (request: RefundRequest) => {
    if (!request.analysis || request.validityScore === undefined) return;
    updateRequest(request.id, (item) => ({ ...item, status: 'boss-pending' }));
    setSelectedStaffRequest(null);
    setToast(`${request.orderId} sent to the Owner Approval Queue.`);
  };

  const applyDecision = async (
    request: RefundRequest,
    decision: Decision,
    overrideReason?: string,
  ) => {
    const nextRequest: RefundRequest = {
      ...request,
      status: decision === 'Reject' ? 'rejected' : 'approved-pending-execution',
      decision,
      overrideReason,
      autoApproved: false,
      obId: newId('OB'),
      draftLanguage,
    };
    updateRequest(request.id, () => nextRequest);
    setPendingDecision(null);
    if (decision === 'Approve Cash') {
      setPaymentModalRequestId(request.id);
      setPaymentModalAudience('boss');
    }
    setError('');
    try {
      const draft = await requestMessageDraft(nextRequest, decision, draftLanguage);
      updateRequest(request.id, (item) => ({ ...item, draft }));
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : 'Could not generate the customer message.');
    }
  };

  const chooseDecision = (request: RefundRequest, decision: Decision) => {
    const recommendedDecision = request.analysis ? toDecision(request.analysis.recommendation) : null;
    if (recommendedDecision && recommendedDecision !== decision) {
      setPendingDecision({ requestId: request.id, decision });
    } else {
      void applyDecision(request, decision);
    }
  };

  const confirmTransfer = async (request: RefundRequest) => {
    if (!request.analysis || request.transactionId || !request.bankAccount.trim()) return;
    if (request.analysis.amount > walletBalance) {
      setError('The available business cash is not enough for this transfer.');
      return;
    }
    setError('');
    setTransferLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 2000));
    const transactionId = newId('TXN');
    setWalletBalance((balance) => balance - request.analysis!.amount);
    updateRequest(request.id, (item) => ({
      ...item,
      paymentConfirmed: true,
      transactionId,
    }));
    setTransferLoading(false);
  };

  const sendMessage = (request: RefundRequest) => {
    updateRequest(request.id, (item) => ({ ...item, messageSent: true }));
    setToast(`Customer message marked as sent for ${request.orderId}.`);
  };

  const shareReceipt = (request: RefundRequest) => {
    updateRequest(request.id, (item) => ({
      ...item,
      receiptShared: true,
      status: item.status === 'rejected' ? 'rejected' : 'executed',
    }));
    setToast(`Receipt marked as shared for ${request.orderId}.`);
  };

  const handleCustomerSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get('damage-photo');
    const request: RefundRequest = {
      id: `REQ-${String(requestSequence.current++).padStart(4, '0')}`,
      orderId: String(form.get('order-id') ?? '').trim(),
      message: String(form.get('issue') ?? '').trim(),
      bankAccount: String(form.get('bank-account') ?? '').trim(),
      photoAttached: file instanceof File && file.size > 0,
      photoName: file instanceof File ? file.name : '',
      submittedAt: new Date().toISOString(),
      status: 'customer-pending',
    };
    setRequests((items) => [request, ...items]);
    event.currentTarget.reset();
    setToast(`Request ${request.orderId} was submitted.`);
  };

  const logout = () => {
    setCurrentUser(null);
    setSelectedStaffRequest(null);
    setSelectedBossRequest(null);
    setError('');
    setPaymentModalRequestId(null);
  };

  const selectedPaymentRequest = requests.find((request) => request.id === paymentModalRequestId);
  const canSeePaymentModal =
    currentUser !== null && currentUser === paymentModalAudience && selectedPaymentRequest !== undefined;

  return (
    <div className="min-h-screen bg-[#f5f7f4] text-[#17241f]">
      <header className="border-b border-[#e5ebe6] bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => setCurrentUser(null)}
            aria-label="TwinBoss home"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#173e32] text-sm font-bold text-white">
              TB
            </span>
            <span className="text-lg font-semibold tracking-tight">TwinBoss</span>
          </button>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-[#d9e9df] bg-[#f2f8f3] px-3 py-1.5 text-xs font-medium text-[#386b4d]"
            title="Orbyte-branded preview; no live Orbyte API is configured."
          >
            <span className="h-2 w-2 rounded-full bg-[#49a46a]" />
            Orbyte Hub · Preview
          </span>
          <div className="flex items-center gap-3">
            {currentUser === 'boss' && (
              <span className="rounded-lg bg-[#f3f6f3] px-3 py-2 text-sm font-medium text-[#365247]">
                Business Cash <span className="ml-1 font-semibold">RM {walletBalance.toLocaleString()}</span>
              </span>
            )}
            {currentUser && (
              <button className="button-secondary !px-3 !py-2 text-sm" onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="app-grid min-h-[calc(100vh-73px)] px-4 py-8 sm:px-8 sm:py-12">
        <div className="mx-auto max-w-7xl">
          {error && (
            <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')} className="font-semibold">
                ×
              </button>
            </div>
          )}

          {!currentUser && <LoginScreen onLogin={setCurrentUser} />}
          {currentUser === 'customer' && <CustomerPortal onSubmit={handleCustomerSubmit} />}
          {currentUser === 'staff' && (
            <StaffWorkspace
              requests={requests}
              activeTab={activeStaffTab}
              onTabChange={setActiveStaffTab}
              selectedId={selectedStaffRequest}
              onSelect={(request) => void analyzeRequest(request)}
              onRetryAnalyze={(request) => void analyzeRequest(request)}
              loadingId={analysisLoadingId}
              onSubmitToBoss={submitToBoss}
              onOpenPayment={(request) => {
                setPaymentModalRequestId(request.id);
                setPaymentModalAudience('staff');
              }}
              onSendMessage={sendMessage}
              onShareReceipt={shareReceipt}
            />
          )}
          {currentUser === 'boss' && (
            <BossWorkspace
              requests={requests}
              activeTab={activeBossTab}
              onTabChange={setActiveBossTab}
              selectedId={selectedBossRequest}
              onSelect={setSelectedBossRequest}
              autoPilot={autoPilot}
              onAutoPilotChange={setAutoPilot}
              onGenerate={handleBossReanalysis}
              loadingId={analysisLoadingId}
              onDecision={chooseDecision}
              language={draftLanguage}
              onLanguageChange={setDraftLanguage}
            />
          )}
        </div>
      </main>

      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-[#173e32] px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      {pendingDecision && (
        <OverrideModal
          onChoose={(reason) => {
            const request = requests.find((item) => item.id === pendingDecision.requestId);
            if (request) void applyDecision(request, pendingDecision.decision, reason);
          }}
          onCancel={() => setPendingDecision(null)}
        />
      )}

      {canSeePaymentModal && selectedPaymentRequest && (
        <PaymentModal
          request={selectedPaymentRequest}
          walletBalance={walletBalance}
          loading={transferLoading}
          onConfirm={() => void confirmTransfer(selectedPaymentRequest)}
          onClose={() => {
            setPaymentModalRequestId(null);
            setPaymentModalAudience(null);
          }}
        />
      )}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  return (
    <section className="animate-fade-up mx-auto max-w-4xl pt-8 sm:pt-14">
      <div className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Refund operations, in sync</span>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[#173e32] sm:text-5xl">
          A clearer path from request to resolution.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-[#68776f]">
          Customer requests, staff validation, and owner decisions: together in one workspace.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-3xl gap-4 md:grid-cols-3">
        <LoginCard title="Customer Portal" description="Open a refund request with your order details." button="Continue as Customer" onClick={() => onLogin('customer')} />
        <LoginCard title="Staff Portal" description="Review incoming requests and prepare them for approval." button="Login as Staff (Ahmad)" onClick={() => onLogin('staff')} />
        <LoginCard title="Owner Workspace" description="Review recommendations, decisions, and activity." button="Login as Owner (Boss)" onClick={() => onLogin('boss')} />
      </div>
      <p className="mt-8 text-center text-xs text-[#859189]">
        Orbyte CRM and activity references are shown as a workspace preview.
      </p>
    </section>
  );
}

function LoginCard({
  title,
  description,
  button,
  onClick,
}: {
  title: string;
  description: string;
  button: string;
  onClick: () => void;
}) {
  return (
    <article className="surface-card flex flex-col p-6">
      <div className="mb-5 h-10 w-10 rounded-xl bg-[#eaf2ec] p-2.5 text-[#286047]">
        <span className="block h-full rounded-md border-2 border-current" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[#718078]">{description}</p>
      <button className="button-primary mt-6 w-full" onClick={onClick}>
        {button}
      </button>
    </article>
  );
}

function CustomerPortal({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <section className="animate-fade-up mx-auto max-w-2xl">
      <PageHeading eyebrow="Customer Portal" title="Tell us what happened" subtitle="Share your order details and our team will review your request." />
      <form onSubmit={onSubmit} className="surface-card mt-7 space-y-5 p-6 sm:p-8">
        <Field label="Order ID">
          <input className="input" name="order-id" placeholder="#1234" required />
        </Field>
        <Field label="Describe the issue">
          <textarea className="input min-h-32 resize-y" name="issue" placeholder="Tell us what went wrong with your order..." required minLength={5} />
        </Field>
        <Field label="Upload photo of damage" hint="Optional · JPG, PNG, or another image file">
          <input className="file-input" type="file" name="damage-photo" accept="image/*" />
        </Field>
        <Field label="Bank name & account number" hint="Used only to prepare a refund destination in this workspace.">
          <input className="input" name="bank-account" placeholder="Maybank 1234" required />
        </Field>
        <button className="button-primary w-full" type="submit">
          Submit Refund Request
        </button>
      </form>
    </section>
  );
}

function StaffWorkspace({
  requests,
  activeTab,
  onTabChange,
  selectedId,
  onSelect,
  onRetryAnalyze,
  loadingId,
  onSubmitToBoss,
  onOpenPayment,
  onSendMessage,
  onShareReceipt,
}: {
  requests: RefundRequest[];
  activeTab: 'customer' | 'tasks';
  onTabChange: (tab: 'customer' | 'tasks') => void;
  selectedId: string | null;
  onSelect: (request: RefundRequest) => void;
  onRetryAnalyze: (request: RefundRequest) => void;
  loadingId: string | null;
  onSubmitToBoss: (request: RefundRequest) => void;
  onOpenPayment: (request: RefundRequest) => void;
  onSendMessage: (request: RefundRequest) => void;
  onShareReceipt: (request: RefundRequest) => void;
}) {
  const incoming = requests.filter((request) => request.status === 'customer-pending');
  const tasks = requests.filter(
    (request) =>
      (request.status === 'approved-pending-execution' || request.status === 'rejected') &&
      !request.receiptShared,
  );
  const selected = requests.find((request) => request.id === selectedId);
  return (
    <section className="animate-fade-up">
      <PageHeading eyebrow="Staff Portal · Ahmad" title="Request review" subtitle="Validate customer details before sending a request to the owner." />
      <Tabs
        tabs={[
          { id: 'customer', label: 'Customer Pending', count: incoming.length },
          { id: 'tasks', label: 'My Tasks', count: tasks.length },
        ]}
        active={activeTab}
        onChange={(tab) => onTabChange(tab as 'customer' | 'tasks')}
      />
      {activeTab === 'customer' ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
          <RequestList
            requests={incoming}
            selectedId={selectedId}
            empty="New customer requests will appear here."
            onSelect={onSelect}
          />
          {selected ? (
            <CustomerReview
              request={selected}
              loading={loadingId === selected.id}
              onAnalyze={() => onRetryAnalyze(selected)}
              onSubmit={() => onSubmitToBoss(selected)}
            />
          ) : (
            <EmptyPanel title="Select a request" description="Choose a customer request to run the AI and completeness review." />
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {tasks.length === 0 ? (
            <EmptyPanel title="You're all caught up" description="Owner decisions that need a customer message or receipt will show here." />
          ) : (
            tasks.map((request) => (
              <StaffTask
                key={request.id}
                request={request}
                onOpenPayment={() => onOpenPayment(request)}
                onSend={() => onSendMessage(request)}
                onShare={() => onShareReceipt(request)}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function CustomerReview({
  request,
  loading,
  onAnalyze,
  onSubmit,
}: {
  request: RefundRequest;
  loading: boolean;
  onAnalyze: () => void;
  onSubmit: () => void;
}) {
  const isKnown = customers.some((customer) => customer.name.toLowerCase() === request.analysis?.customer_name.toLowerCase());
  return (
    <article className="surface-card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Customer request</p>
          <h2 className="mt-1 text-xl font-semibold">{request.orderId}</h2>
        </div>
        <StatusBadge status="Customer Pending" />
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <InfoItem label="Issue" value={request.message} />
        <InfoItem label="Photo" value={request.photoAttached ? `Attached · ${request.photoName}` : 'Not attached'} />
        <InfoItem label="Destination details" value={maskBank(request.bankAccount)} />
        <InfoItem label="Submitted" value={new Date(request.submittedAt).toLocaleString()} />
      </div>
      {request.analysis ? (
        <div className="mt-6 rounded-2xl border border-[#e6ece7] bg-[#f8faf8] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">AI extraction & validity</h3>
            <span className="text-[11px] font-medium uppercase tracking-wide text-[#64806f]">Orbyte CRM · local profile</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoItem label="Customer" value={`${request.analysis.customer_name}${isKnown ? ' · VIP profile' : ' · New Customer'}`} />
            <InfoItem label="Amount" value={`RM ${request.analysis.amount.toFixed(2)}`} />
            <InfoItem label="Reason" value={request.analysis.reason} />
          </div>
          <div className="mt-5 flex items-center justify-between text-sm">
            <span className="font-medium">Validity score</span>
            <span className="font-semibold text-[#286047]">{request.validityScore}%</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e3ebe5]">
            <div className="h-full rounded-full bg-[#55a06f] transition-all" style={{ width: `${request.validityScore}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#758279]">
            Based on issue detail, photo attachment, and bank details provided.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`badge ${request.analysis.sentiment === 'Angry' ? 'badge-red' : request.analysis.sentiment === 'Polite' ? 'badge-green' : 'badge-neutral'}`}>
              {request.analysis.sentiment} sentiment
            </span>
            <span className="badge badge-neutral">{request.analysis.recommendation} · {request.analysis.confidence}%</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#66766d]">{request.analysis.reasoning}</p>
        </div>
      ) : (
        <div className="mt-6 rounded-xl bg-[#f3f7f3] p-4 text-sm text-[#617169]">
          {loading ? (
            <span className="inline-flex items-center gap-2"><span className="spinner" /> Querying Orbyte data & analyzing...</span>
          ) : (
            'Select this request from the queue to analyze the message and check required details.'
          )}
        </div>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        {!request.analysis && (
          <button className="button-secondary" onClick={onAnalyze} disabled={loading}>
            {loading ? 'Analyzing…' : 'Analyze Request'}
          </button>
        )}
        <button className="button-primary" onClick={onSubmit} disabled={!request.analysis || request.validityScore === undefined}>
          Verify &amp; Send to Boss
        </button>
      </div>
    </article>
  );
}

function StaffTask({
  request,
  onOpenPayment,
  onSend,
  onShare,
}: {
  request: RefundRequest;
  onOpenPayment: () => void;
  onSend: () => void;
  onShare: () => void;
}) {
  const canSend = !request.messageSent && (request.decision !== 'Approve Cash' || request.paymentConfirmed);
  const canShare = request.messageSent && !request.receiptShared && (request.decision !== 'Approve Cash' || request.paymentConfirmed);
  return (
    <article className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">My Task · {request.orderId}</p>
          <h3 className="mt-1 text-lg font-semibold">{request.analysis?.customer_name ?? 'Customer'}</h3>
        </div>
        <StatusBadge status={request.status === 'rejected' ? 'Rejected' : request.paymentConfirmed ? 'Transfer complete' : 'Approved · pending execution'} />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoItem label="Decision" value={request.decision ?? 'Awaiting decision'} />
        {request.transactionId && <InfoItem label="Transaction" value={request.transactionId} />}
      </div>
      {request.decision === 'Approve Cash' && !request.paymentConfirmed && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Cash transfer is awaiting confirmation in the payment workspace.
        </p>
      )}
      <div className="mt-5 rounded-xl border border-[#e7ece8] bg-[#fafcfb] p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#78867e]">WhatsApp message draft</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#44564c]">{request.draft || 'Preparing the customer message…'}</p>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-3">
        {request.decision === 'Approve Cash' && !request.paymentConfirmed && (
          <button className="button-secondary" onClick={onOpenPayment}>Open Payment Gateway</button>
        )}
        {canSend ? (
          <button className="button-primary" disabled={!request.draft} onClick={onSend}>Send Message to Customer</button>
        ) : canShare ? (
          <button className="button-primary" onClick={onShare}>Share Receipt with Customer</button>
        ) : (
          <span className="self-center text-sm text-[#748178]">
            {request.receiptShared ? 'Receipt shared' : 'Complete the required steps to share the receipt.'}
          </span>
        )}
      </div>
      {request.receiptShared && <OrbyteReceipt id={request.obId} />}
    </article>
  );
}

function BossWorkspace({
  requests,
  activeTab,
  onTabChange,
  selectedId,
  onSelect,
  autoPilot,
  onAutoPilotChange,
  onGenerate,
  loadingId,
  onDecision,
  language,
  onLanguageChange,
}: {
  requests: RefundRequest[];
  activeTab: 'queue' | 'activity';
  onTabChange: (tab: 'queue' | 'activity') => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  autoPilot: boolean;
  onAutoPilotChange: (enabled: boolean) => void;
  onGenerate: (request: RefundRequest) => void;
  loadingId: string | null;
  onDecision: (request: RefundRequest, decision: Decision) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const queue = requests.filter((request) => request.status === 'boss-pending');
  const activity = requests.filter((request) => request.status !== 'customer-pending');
  const selected = queue.find((request) => request.id === selectedId) ?? queue[0];
  return (
    <section className="animate-fade-up">
      <PageHeading eyebrow="Owner Workspace" title="Approval queue" subtitle="Review validated requests, apply judgment, and track every outcome." />
      <div className="surface-card mt-6 flex flex-wrap items-center justify-between gap-4 p-4 sm:px-5">
        <div>
          <p className="font-semibold">Auto-Pilot</p>
          <p className="mt-1 text-sm text-[#748178]">Auto-approve AI-approved requests under RM50 with validity above 90%.</p>
        </div>
        <button
          role="switch"
          aria-checked={autoPilot}
          aria-label="Auto-Pilot"
          onClick={() => onAutoPilotChange(!autoPilot)}
          className={`relative h-7 w-12 rounded-full transition ${autoPilot ? 'bg-[#347a54]' : 'bg-[#cbd4ce]'}`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${autoPilot ? 'left-6' : 'left-1'}`} />
        </button>
      </div>
      <Tabs
        tabs={[
          { id: 'queue', label: 'Approval Queue', count: queue.length },
          { id: 'activity', label: 'Activity Log', count: activity.length },
        ]}
        active={activeTab}
        onChange={(tab) => onTabChange(tab as 'queue' | 'activity')}
      />
      {activeTab === 'queue' ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(250px,0.8fr)_minmax(0,1.5fr)]">
          <RequestList
            requests={queue}
            selectedId={selected?.id ?? null}
            empty="Verified requests from Staff will appear here."
            onSelect={(request) => onSelect(request.id)}
          />
          {selected ? (
            <BossReview
              request={selected}
              loading={loadingId === selected.id}
              onGenerate={() => onGenerate(selected)}
              onDecision={(decision) => onDecision(selected, decision)}
              language={language}
              onLanguageChange={onLanguageChange}
            />
          ) : (
            <EmptyPanel title="No requests awaiting approval" description="Customer submissions will appear here after Staff review." />
          )}
        </div>
      ) : (
        <ActivityLog requests={activity} />
      )}
    </section>
  );
}

function BossReview({
  request,
  loading,
  onGenerate,
  onDecision,
  language,
  onLanguageChange,
}: {
  request: RefundRequest;
  loading: boolean;
  onGenerate: () => void;
  onDecision: (decision: Decision) => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}) {
  const analysis = request.analysis;
  const isKnown = customers.some((customer) => customer.name.toLowerCase() === analysis?.customer_name.toLowerCase());
  return (
    <article className="surface-card p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Request from Ahmad · {request.orderId}</p>
          <h2 className="mt-1 text-xl font-semibold">Refund review</h2>
        </div>
        <StatusBadge status="Pending approval" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <InfoItem label="Customer" value={analysis ? `${analysis.customer_name}${isKnown ? ' · VIP' : ' · New Customer'}` : 'Not analyzed'} />
        <InfoItem label="Amount" value={analysis ? `RM ${analysis.amount.toFixed(2)}` : 'Not analyzed'} />
        <InfoItem label="Reason" value={analysis?.reason ?? 'Not analyzed'} />
      </div>
      {analysis && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className={`badge ${analysis.sentiment === 'Angry' ? 'badge-red' : analysis.sentiment === 'Polite' ? 'badge-green' : 'badge-neutral'}`}>
            {analysis.sentiment} sentiment
          </span>
          <span className="badge badge-neutral">Validity {request.validityScore}%</span>
          <span className="badge badge-green">Orbyte CRM · local profile</span>
        </div>
      )}
      <div className="mt-5 rounded-xl border border-[#e4ebe5] bg-[#f8faf8] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">AI recommendation</p>
          {analysis && <span className="text-sm font-semibold text-[#286047]">{analysis.confidence}% confidence</span>}
        </div>
        {analysis ? (
          <>
            <p className="mt-2 text-lg font-semibold text-[#254d3a]">{analysis.recommendation}</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e1e9e3]">
              <div className="h-full rounded-full bg-[#53a06d]" style={{ width: `${analysis.confidence}%` }} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#66766d]">{analysis.reasoning}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-[#748178]">Generate a recommendation to review the customer message.</p>
        )}
        <button className="button-secondary mt-4" onClick={onGenerate} disabled={loading}>
          {loading ? <span className="inline-flex items-center gap-2"><span className="spinner" /> Querying Orbyte data &amp; analyzing...</span> : 'Generate AI Recommendation'}
        </button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <InfoItem label="Customer issue" value={request.message} />
        <InfoItem label="Photo" value={request.photoAttached ? `Attached · ${request.photoName}` : 'Not attached'} />
        <InfoItem label="Destination account" value={request.bankAccount || 'Not provided'} />
        <InfoItem label="AI validity checks" value={`${request.photoAttached ? 'Photo attached' : 'No photo'} · ${request.bankAccount ? 'Bank details provided' : 'Bank details missing'}`} />
      </div>
      <Field label="WhatsApp draft language">
        <select className="input mt-2" value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
          {languages.map((item) => <option key={item}>{item}</option>)}
        </select>
      </Field>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        {decisions.map((decision) => (
          <button key={decision} onClick={() => onDecision(decision)} disabled={!analysis} className={decision === 'Reject' ? 'button-danger' : 'button-primary'}>
            {decision}
          </button>
        ))}
      </div>
    </article>
  );
}

function ActivityLog({ requests }: { requests: RefundRequest[] }) {
  if (!requests.length) {
    return <div className="mt-5"><EmptyPanel title="No activity yet" description="Owner decisions and Auto-Pilot actions will be recorded here." /></div>;
  }
  return (
    <div className="surface-card mt-5 divide-y divide-[#e8ede9]">
      {requests.map((request) => (
        <article key={request.id} className="animate-fade-up p-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#758279]">{request.orderId} · {request.analysis?.customer_name ?? 'Customer'}</p>
              <h3 className="mt-1 font-semibold">{request.decision ?? 'Request update'}</h3>
            </div>
            <StatusBadge status={request.status === 'executed' ? 'Executed by Staff' : request.status === 'rejected' ? 'Rejected' : request.paymentConfirmed ? 'Transfer complete · pending Staff' : request.autoApproved ? 'Auto-approved · pending transfer' : 'Approved · pending Staff'} />
          </div>
          <p className="mt-2 text-sm text-[#68776f]">
            {request.autoApproved ? 'Auto-Pilot' : 'Owner'} → {request.status === 'executed' ? 'Staff completed the request' : request.status === 'rejected' ? 'Staff notification pending or complete' : 'Staff execution pending'}
            {request.overrideReason ? ` · Override: ${request.overrideReason}` : ''}
          </p>
          {request.transactionId && <p className="mt-1 text-xs text-[#68776f]">Transaction reference: {request.transactionId}</p>}
          {request.draft && <p className="mt-3 line-clamp-2 text-sm text-[#52645a]">{request.draft}</p>}
          {request.obId && <OrbyteReceipt id={request.obId} />}
        </article>
      ))}
    </div>
  );
}

function PaymentModal({
  request,
  walletBalance,
  loading,
  onConfirm,
  onClose,
}: {
  request: RefundRequest;
  walletBalance: number;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const paid = Boolean(request.transactionId);
  const amount = request.analysis?.amount ?? 0;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102219]/55 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        {paid ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f5eb] text-3xl text-[#32804d]">✓</div>
            <h2 id="payment-title" className="mt-5 text-2xl font-semibold">Transfer Successful</h2>
            <p className="mt-2 text-[#68776f]">RM {amount.toFixed(2)} refund prepared for {request.analysis?.customer_name}.</p>
            <div className="mt-5 rounded-xl bg-[#f4f7f4] p-4 text-sm">
              <p><span className="text-[#78867e]">Transaction</span> <strong className="ml-2">{request.transactionId}</strong></p>
              <p className="mt-2"><span className="text-[#78867e]">Remaining business cash</span> <strong className="ml-2">RM {walletBalance.toLocaleString()}</strong></p>
            </div>
            <p className="mt-4 text-xs text-[#859189]">Payment Gateway · Preview</p>
            <button className="button-primary mt-6 w-full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Payment Gateway · Preview</p>
                <h2 id="payment-title" className="mt-1 text-2xl font-semibold">Processing Refund</h2>
              </div>
              <button className="rounded-lg px-2 py-1 text-xl text-[#758279]" aria-label="Close payment window" onClick={onClose}>×</button>
            </div>
            <p className="mt-2 text-sm text-[#68776f]">Review the payout details before confirming this workspace action.</p>
            <div className="mt-6 space-y-4 rounded-2xl border border-[#e8ede9] p-4">
              <InfoItem label="Refund amount" value={`RM ${amount.toFixed(2)}`} />
              <InfoItem label="Customer" value={request.analysis?.customer_name ?? 'Customer'} />
              <InfoItem label="Destination account" value={maskBank(request.bankAccount)} />
              <InfoItem label="Order" value={request.orderId} />
            </div>
            <p className="mt-4 text-xs leading-5 text-[#859189]">No bank connection is configured. Confirming creates a local transaction reference only.</p>
            <button className="button-primary mt-5 w-full" disabled={loading || !request.bankAccount.trim()} onClick={onConfirm}>
              {loading ? <span className="inline-flex items-center gap-2"><span className="spinner" /> Connecting to Payment Gateway...</span> : 'Confirm Transfer'}
            </button>
            {!request.bankAccount.trim() && <p className="mt-2 text-center text-xs text-red-700">Bank destination details are required to continue.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function OverrideModal({
  onChoose,
  onCancel,
}: {
  onChoose: (reason: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102219]/50 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="override-title" className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <p className="eyebrow">Decision override</p>
        <h2 id="override-title" className="mt-2 text-xl font-semibold">Why are you changing the recommendation?</h2>
        <p className="mt-2 text-sm text-[#718078]">Choose a reason to add it to the activity record.</p>
        <div className="mt-5 grid gap-2">
          {['Policy Violation', 'Too Expensive', 'Other'].map((reason) => (
            <button key={reason} className="button-secondary w-full justify-start" onClick={() => onChoose(reason)}>{reason}</button>
          ))}
        </div>
        <button className="mt-4 w-full py-2 text-sm font-medium text-[#68776f]" onClick={onCancel}>Cancel</button>
      </section>
    </div>
  );
}

function RequestList({
  requests,
  selectedId,
  empty,
  onSelect,
}: {
  requests: RefundRequest[];
  selectedId: string | null;
  empty: string;
  onSelect: (request: RefundRequest) => void;
}) {
  return (
    <aside className="surface-card h-fit overflow-hidden">
      <div className="border-b border-[#e8ede9] px-5 py-4">
        <h2 className="font-semibold">Requests <span className="ml-1 text-sm font-normal text-[#859189]">{requests.length}</span></h2>
      </div>
      {requests.length === 0 ? (
        <p className="px-5 py-6 text-sm leading-6 text-[#78867e]">{empty}</p>
      ) : (
        <div className="divide-y divide-[#eef1ee]">
          {requests.map((request) => (
            <button key={request.id} onClick={() => onSelect(request)} className={`block w-full px-5 py-4 text-left transition hover:bg-[#f7faf7] ${request.id === selectedId ? 'bg-[#f0f6f1]' : ''}`}>
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">{request.orderId}</span>
                <span className="text-xs text-[#89958e]">{new Date(request.submittedAt).toLocaleDateString()}</span>
              </span>
              <span className="mt-1 block truncate text-sm text-[#718078]">{request.message}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}

function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; count: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mt-7 flex gap-1 border-b border-[#dfe6e0]">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onChange(tab.id)} className={`relative px-4 py-3 text-sm font-medium ${active === tab.id ? 'text-[#24533d]' : 'text-[#78867e] hover:text-[#344a3d]'}`}>
          {tab.label}
          <span className="ml-2 rounded-full bg-[#edf2ee] px-2 py-0.5 text-xs">{tab.count}</span>
          {active === tab.id && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#347a54]" />}
        </button>
      ))}
    </div>
  );
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#173e32] sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">{subtitle}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-[#34483d]">
      {label}
      {hint && <span className="mt-1 block text-xs font-normal text-[#859189]">{hint}</span>}
      {children}
    </label>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-[#87938c]">{label}</p>
      <p className="mt-1 break-words text-sm leading-5 text-[#34483d]">{value}</p>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="surface-card flex min-h-64 flex-col items-center justify-center p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf4ee] text-xl text-[#347a54]">✓</div>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#78867e]">{description}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isRejected = status.toLowerCase().includes('reject');
  const isDone = status.toLowerCase().includes('complete') || status.toLowerCase().includes('executed');
  return <span className={`badge ${isRejected ? 'badge-red' : isDone ? 'badge-green' : 'badge-neutral'}`}>{status}</span>;
}

function OrbyteReceipt({ id }: { id?: string }) {
  if (!id) return null;
  return (
    <p className="mt-4 border-t border-[#edf1ed] pt-3 text-xs font-medium text-[#438052]">
      Orbyte Activity reference · {id} <span className="font-normal text-[#829087]">(preview; not synced)</span>
    </p>
  );
}

function maskBank(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'Not provided';
  const digits = trimmed.replace(/\D/g, '');
  const bank = trimmed.replace(/\d/g, '').replace(/[•*]/g, '').trim();
  const masked = digits ? `•••• ${digits.slice(-4)}` : 'Account details provided';
  return bank ? `${bank} · ${masked}` : masked;
}

export default App;
