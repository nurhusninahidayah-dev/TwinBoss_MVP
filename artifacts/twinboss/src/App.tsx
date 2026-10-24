import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Banknote, BookOpen,
  BriefcaseBusiness, Check, ChevronRight, CircleHelp, Clock3, Copy, FileCheck2,
  HandCoins, Lightbulb, ListChecks, LoaderCircle, MessageCircle, RefreshCw, ShieldCheck,
  Sparkles, Users, Wallet, X,
} from 'lucide-react';
import {
  getGetActivityQueryKey, getGetDashboardSummaryQueryKey, getGetRequestQueryKey,
  getGetRequestsQueryKey,
  useAnalyzeRequest, useCreateRequest, useDecideRequest, useGenerateCustomerMessage, useGetActivity,
  useGetCustomers, useGetDashboardSummary, useGetRequest, useGetRequests, useGetRules,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import './index.css';

const queryClient = new QueryClient();
type Role = 'boss' | 'staff';
type ToastState = { text: string; error?: boolean } | null;

function money(value?: number | null) {
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(value || 0);
}
function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kuala_Lumpur' }).format(date);
}
function dashboardGreeting() {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-MY', {
    hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur',
  }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const date = new Intl.DateTimeFormat('en-MY', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Asia/Kuala_Lumpur',
  }).format(now).toUpperCase();
  return { greeting, date };
}
function safeError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [toast, onClose]);
  return toast ? <div role="status" className={`toast-message${toast.error ? ' toast-error' : ''}`} data-testid="status-toast">{toast.text}</div> : null;
}
function LoadingRows() {
  return <div className="loading-block" aria-label="Loading"><div className="skeleton" /><div className="skeleton" style={{ width: '78%' }} /><div className="skeleton" style={{ width: '58%' }} /></div>;
}
function QueryError({ retry }: { retry: () => void }) {
  return <div className="error-box"><div className="empty-mark"><CircleHelp size={20} /></div><div className="empty-title">Couldn’t load this view</div><p className="subhead">Your data is still safe. Try connecting again.</p><button className="btn btn-quiet btn-sm" onClick={retry} data-testid="button-retry"><RefreshCw size={13} /> Try again</button></div>;
}
function AppShell({ children, role, setRole }: { children: ReactNode; role: Role; setRole: (role: Role) => void }) {
  const [location, setLocation] = useLocation();
  const [workflow, setWorkflow] = useState('refund');
  const navItems = [
    { href: '/', label: 'Boss dashboard', icon: BriefcaseBusiness },
    { href: '/staff', label: 'Staff request portal', icon: HandCoins },
    { href: '/activity', label: 'Decision receipts', icon: FileCheck2 },
    { href: '/customers', label: 'Customers', icon: Users },
    { href: '/rules', label: 'Business rules', icon: BookOpen },
  ];
  const updateRole = (next: Role) => {
    setRole(next);
    setLocation(next === 'staff' ? '/staff' : '/');
  };
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="TwinBoss home" data-testid="link-home">
        <div className="brand-mark"><span style={{ font: '800 16px Manrope' }}>tb</span></div>
        <div><div className="brand-name">twinboss</div><div className="brand-caption">Your business, in sync</div></div>
      </Link>
      <div className="nav-label">Workspace</div>
      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link href={href} key={href} className={`nav-link${location === href ? ' active' : ''}`} data-testid={`link-nav-${href === '/' ? 'dashboard' : href.slice(1)}`}>
          <Icon size={17} strokeWidth={1.8} /><span>{label}</span>{href === '/' ? <span className="nav-count">•</span> : null}
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="owner-card">
          <div className="owner-row"><div className="avatar">NR</div><div><div className="owner-name">Nadia Rahman</div><div className="owner-role">Owner · Orbyte Studio</div></div></div>
        </div>
        <div className="sidebar-foot">Built for the way you work.</div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div className="crumb">ORBYTE STUDIO <span style={{ padding: '0 7px', color: '#b5b4a6' }}>/</span> {location === '/' ? 'OVERVIEW' : location.slice(1).replace('-', ' ').toUpperCase()}</div>
        <div className="top-actions">
          <label className="workflow-picker"><span>WORKFLOW</span><select aria-label="Choose workflow" value={workflow} onChange={event => setWorkflow(event.target.value)} data-testid="select-workflow">
            <option value="refund">Refund exceptions</option>
            <option value="supplier" disabled>Supplier payments · Coming soon</option>
            <option value="einvoice" disabled>E-invoicing · Coming soon</option>
          </select></label>
          <div className="sync-mark"><span className="sync-dot" /> Demo data</div>
          <div className="view-toggle" aria-label="Demo role toggle">
            <button className={role === 'boss' ? 'selected' : ''} onClick={() => updateRole('boss')} data-testid="button-role-boss">Boss view</button>
            <button className={role === 'staff' ? 'selected' : ''} onClick={() => updateRole('staff')} data-testid="button-role-staff">Staff view</button>
          </div>
        </div>
      </header>
      {children}
    </main>
  </div>;
}
function PageHeading({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="subhead">{text}</p></div>{action}</div>;
}
function Metric({ label, value, foot, icon: Icon }: { label: string; value: string | number; foot: string; icon: typeof Activity }) {
  return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-foot"><Icon size={11} style={{ display: 'inline', marginRight: 4 }} />{foot}</div></div>;
}

function DashboardPage({ notify }: { notify: (text: string, error?: boolean) => void }) {
  const client = useQueryClient();
  const summaryQuery = useGetDashboardSummary();
  const requestsQuery = useGetRequests({ status: 'pending' });
  const requests = (requestsQuery.data ?? []).filter(item => item.type === 'refund');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedIdResolved = requests.some(item => item.id === selectedId) ? selectedId! : requests[0]?.id ?? 0;
  const detailQuery = useGetRequest(selectedIdResolved, { query: { enabled: selectedIdResolved > 0, queryKey: getGetRequestQueryKey(selectedIdResolved) } });
  const analyze = useAnalyzeRequest();
  const decide = useDecideRequest();
  const message = useGenerateCustomerMessage();
  const [receipt, setReceipt] = useState<{ receiptNumber: string; chosenAction: string; requestTitle: string } | null>(null);
  const [messageDraft, setMessageDraft] = useState('');
  const summary = summaryQuery.data;
  const detail = detailQuery.data;
  const heading = dashboardGreeting();
  const canDecide = detail?.status === 'pending' && Boolean(detail.recommendation);
  const invalidateDecisionData = async (id: number) => {
    await Promise.all([
      client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
      client.invalidateQueries({ queryKey: getGetRequestsQueryKey() }),
      client.invalidateQueries({ queryKey: getGetRequestsQueryKey({ status: 'pending' }) }),
      client.invalidateQueries({ queryKey: getGetRequestQueryKey(id) }),
      client.invalidateQueries({ queryKey: getGetActivityQueryKey() }),
    ]);
  };
  const runAnalyze = () => {
    if (!detail) return;
    analyze.mutate({ id: detail.id }, {
      onSuccess: async () => {
        await invalidateDecisionData(detail.id);
        notify('TwinBoss has refreshed its recommendation.');
      },
      onError: error => notify(safeError(error), true),
    });
  };
  const runDecision = (action: 'approve' | 'store_credit' | 'reject') => {
    if (!detail) return;
    const recommended = detail.recommendation;
    if (!recommended) {
      notify('Ask TwinBoss to analyze this request before recording a decision.', true);
      return;
    }
    const needsReason = action !== recommended;
    const reason = needsReason ? window.prompt(action === 'reject' ? 'Why are you rejecting this request?' : 'What is the reason for overriding TwinBoss’s recommendation?') : '';
    if (needsReason && (reason === null || !reason.trim())) {
      if (reason !== null) notify('Add a short reason to record this override.', true);
      return;
    }
    decide.mutate({ id: detail.id, data: { action, ...(reason?.trim() ? { reason: reason.trim() } : {}) } }, {
      onSuccess: async result => {
        setReceipt({ receiptNumber: result.receiptNumber, chosenAction: result.chosenAction, requestTitle: result.requestTitle });
        setMessageDraft('');
        await invalidateDecisionData(detail.id);
        notify('Decision recorded. Receipt added to your activity trail.');
        message.mutate({ id: detail.id }, {
          onSuccess: result => setMessageDraft(result.draft),
          onError: () => notify('Decision saved, but the WhatsApp draft could not be generated. Try again below.', true),
        });
      },
      onError: error => notify(safeError(error), true),
    });
  };
  const refresh = () => { void summaryQuery.refetch(); void requestsQuery.refetch(); };
  return <div className="page">
    <PageHeading eyebrow={`${heading.date} · KUALA LUMPUR`} title={`${heading.greeting}, Nadia.`} text="Your business is moving. Here’s what needs your call." action={<button className="btn btn-quiet" onClick={refresh} data-testid="button-refresh-dashboard"><RefreshCw size={14} /> Refresh view</button>} />
    {summaryQuery.isLoading ? <LoadingRows /> : summaryQuery.isError ? <QueryError retry={() => void summaryQuery.refetch()} /> : <div className="metrics" data-testid="dashboard-summary">
      <Metric label="Needs your call" value={summary?.waitingForDecision ?? 0} foot="Requests waiting" icon={ListChecks} />
      <Metric label="Handled today" value={summary?.handledToday ?? 0} foot="Decisions recorded" icon={BadgeCheck} />
      <Metric label="Average response" value={`${summary?.averageResponseMinutes ?? 0}m`} foot="Across recent requests" icon={Clock3} />
      <Metric label="Focus returned" value={`${summary?.timeSavedMinutes ?? 0}m`} foot="Estimated time returned" icon={ArrowUpRight} />
    </div>}
    <div className="content-grid">
      <section>
        <div className="section-head"><h2 className="section-title">Approval queue <span style={{ color: '#a4956f', font: '11px var(--app-font-mono)', marginLeft: 5 }}>{requests.length}</span></h2><span className="section-note">You stay in control of every decision</span></div>
        <div className="panel">
          <div className="panel-head"><div className="section-note">OPEN REQUESTS</div><span className="pill pending">{requests.length} to review</span></div>
          {requestsQuery.isLoading ? <LoadingRows /> : requestsQuery.isError ? <QueryError retry={() => void requestsQuery.refetch()} /> : requests.length === 0 ? <div className="empty-box"><div className="empty-mark"><Check size={20} /></div><div className="empty-title">You’re all caught up</div><p className="subhead">New requests from your team will appear here.</p></div> : <div className="queue-list">
            {requests.map(item => <button className={`queue-row${selectedIdResolved === item.id ? ' active' : ''}`} key={item.id} onClick={() => { setSelectedId(item.id); setReceipt(null); }} data-testid={`request-row-${item.id}`}>
              <span className="request-icon">{item.type === 'refund' ? <Wallet size={16} /> : item.type === 'discount' ? <ArrowDownRight size={16} /> : <Banknote size={16} />}</span>
              <span><span className="request-title">{item.title}</span><span className="request-meta">{item.customerName} · {item.staffName} · {shortDate(item.submittedAt)}</span></span>
              <span className="request-right"><span className="amount">{money(item.amount)}</span><span className="status-row"><span className={`pill ${item.riskLevel}`}>{item.riskLevel} risk</span></span></span>
            </button>)}
          </div>}
        </div>
      </section>
      <section>
        <div className="section-head"><h2 className="section-title">Decision desk</h2><span className="section-note">Owner approval required</span></div>
        <div className="panel detail-panel">
          {detailQuery.isLoading && selectedIdResolved > 0 ? <LoadingRows /> : detailQuery.isError ? <QueryError retry={() => void detailQuery.refetch()} /> : !detail ? <div className="empty-box"><div className="empty-mark"><ShieldCheck size={20} /></div><div className="empty-title">A clear desk</div><p className="subhead">Choose a request from the queue when one arrives.</p></div> : <>
            <div className="panel-head"><div><h3 className="detail-title">{detail.title}</h3><p className="detail-sub">{detail.customerName} · {detail.customerTier} customer</p></div><span className={`pill ${detail.riskLevel}`}>{detail.riskLevel} risk</span></div>
            <div className="panel-body">
              <div className="detail-amount">{money(detail.amount)}</div>
              <div className="detail-description">{detail.description}</div>
              <div className="detail-facts">
                <div className="fact"><div className="fact-label">Requested by</div><div className="fact-value">{detail.staffName} · {detail.staffRole}</div></div>
                <div className="fact"><div className="fact-label">Customer value</div><div className="fact-value">{money(detail.customerLifetimeValue)} lifetime</div></div>
                <div className="fact"><div className="fact-label">Request type</div><div className="fact-value">{detail.type.replace('_', ' ')}</div></div>
                <div className="fact"><div className="fact-label">Submitted</div><div className="fact-value">{shortDate(detail.submittedAt)}</div></div>
              </div>
              {detail.matchedRule && <div className="section-note" style={{ margin: '8px 0 12px' }}><BookOpen size={12} style={{ display: 'inline', marginRight: 5 }} />Rule matched: <strong>{detail.matchedRule}</strong></div>}
              <div className="ai-box">
                <div className="ai-kicker"><Sparkles size={13} /> TwinBoss recommendation <span style={{ marginLeft: 'auto' }}>{detail.confidence ?? 0}% confidence</span></div>
                {detail.recommendation ? <><div className="ai-recommend">{detail.recommendation.replace('_', ' ')}</div><div className="ai-copy">{detail.recommendationExplanation || 'Recommendation based on your business rules and customer context.'}</div><div className="confidence"><span style={{ width: `${Math.max(0, Math.min(100, detail.confidence ?? 0))}%` }} /></div></> : <div className="ai-copy" style={{ marginTop: 9 }}>No recommendation yet. Ask TwinBoss to review the context before you decide.</div>}
                {detail.recommendationSource && <div className="section-note" style={{ marginTop: 8 }}>Source: {detail.recommendationSource}</div>}
                {detail.alternatives?.length > 0 && <div className="alternatives">{detail.alternatives.map(alt => <div className="alt-line" key={alt.action}><span>{alt.label}</span><span>{alt.explanation}</span></div>)}</div>}
              </div>
              <button className="btn btn-quiet btn-sm" onClick={runAnalyze} disabled={analyze.isPending || decide.isPending} data-testid="button-analyze-request">
                {analyze.isPending ? <LoaderCircle size={13} className="spin" /> : <Sparkles size={13} />} {analyze.isPending ? 'Reviewing context…' : 'Ask TwinBoss to analyze'}
              </button>
              <div className="decision-actions">
                <button className="btn btn-primary" onClick={() => runDecision('approve')} disabled={decide.isPending || !canDecide} data-testid="button-approve-request"><Check size={14} /> Approve request</button>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                  <button className="btn btn-gold btn-sm" onClick={() => runDecision('store_credit')} disabled={decide.isPending || !canDecide} data-testid="button-store-credit"><Wallet size={13} /> Store credit</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => runDecision('reject')} disabled={decide.isPending || !canDecide} data-testid="button-reject-request"><X size={13} /> Reject request</button>
                </div>
              </div>
              {decide.isPending && <div className="section-note" style={{ textAlign: 'center', marginTop: 8 }}>Recording your decision…</div>}
              {receipt && <div className="receipt" role="status"><div className="receipt-num">RECEIPT {receipt.receiptNumber}</div><div className="receipt-title">{receipt.chosenAction.replace('_', ' ')} recorded</div><div className="section-note">{receipt.requestTitle} · decision saved to activity</div>
                <div className="whatsapp-draft">
                  <div className="ai-kicker"><MessageCircle size={13} /> Customer WhatsApp draft</div>
                  {message.isPending ? <div className="section-note" style={{ marginTop: 8 }}>Writing a polite customer update…</div> : messageDraft ? <><p>{messageDraft}</p><button className="btn btn-quiet btn-sm" onClick={() => { void navigator.clipboard.writeText(messageDraft).then(() => notify('WhatsApp message copied.')).catch(() => notify('Could not access the clipboard. Select and copy the draft manually.', true)); }} data-testid="button-copy-whatsapp"><Copy size={13} /> Copy message</button></> : <button className="btn btn-quiet btn-sm" onClick={() => message.mutate({ id: detail.id }, { onSuccess: result => setMessageDraft(result.draft), onError: error => notify(safeError(error), true) })} disabled={message.isPending} data-testid="button-retry-whatsapp">Generate customer message</button>}
                </div>
                <Link href="/activity" className="section-note" style={{ display: 'inline-block', marginTop: 8, color: '#35644d', textDecoration: 'none' }} data-testid="link-open-receipt">View decision trail <ChevronRight size={12} style={{ verticalAlign: 'middle' }} /></Link></div>}
            </div>
          </>}
        </div>
      </section>
    </div>
  </div>;
}

function StaffPage({ notify, setRole }: { notify: (text: string, error?: boolean) => void; setRole: (role: Role) => void }) {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const createRequest = useCreateRequest();
  const [customerName, setCustomerName] = useState('');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [staffName, setStaffName] = useState('');
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!customerName.trim() || !title.trim() || !staffName.trim() || !description.trim() || Number(amount) < 0 || amount === '') {
      notify('Please complete each field with valid details.', true);
      return;
    }
    createRequest.mutate({ data: { type: 'refund', customerName: customerName.trim(), title: title.trim(), amount: Number(amount), description: description.trim(), staffName: staffName.trim() } }, {
      onSuccess: async result => {
        setCustomerName(''); setTitle(''); setAmount(''); setDescription('');
        await Promise.all([
          client.invalidateQueries({ queryKey: getGetRequestsQueryKey() }),
          client.invalidateQueries({ queryKey: getGetRequestsQueryKey({ status: 'pending' }) }),
          client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }),
          client.invalidateQueries({ queryKey: getGetActivityQueryKey() }),
        ]);
        setRole('boss');
        setLocation('/');
        notify(`Request #${result.id} is now in Nadia’s approval queue.`);
      },
      onError: error => notify(safeError(error), true),
    });
  };
  return <div className="page">
    <PageHeading eyebrow="Team request portal" title="Hand off a small decision." text="Share the context. TwinBoss will organize the details so your owner can decide quickly." />
    <div className="form-layout">
      <form className="panel form-panel" onSubmit={onSubmit}>
        <div className="section-head"><h2 className="section-title">Request details</h2><span className="section-note">Usually takes under a minute</span></div>
        <div className="field-grid">
          <div className="field"><label htmlFor="requester">Your name</label><input className="input" id="requester" value={staffName} onChange={event => setStaffName(event.target.value)} placeholder="e.g. Aina" required data-testid="input-staff-name" /></div>
          <div className="field"><label htmlFor="request-type">Workflow</label><select className="select" id="request-type" value="refund" disabled data-testid="select-request-type"><option value="refund">Refund exception</option></select></div>
          <div className="field"><label htmlFor="customer">Customer name</label><input className="input" id="customer" value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Who is this for?" required data-testid="input-customer-name" /></div>
          <div className="field"><label htmlFor="amount">Amount (MYR)</label><input className="input" id="amount" type="number" min="0" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" required data-testid="input-request-amount" /></div>
          <div className="field full"><label htmlFor="title">A short title</label><input className="input" id="title" value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Replace damaged parcel" required data-testid="input-request-title" /></div>
          <div className="field full"><label htmlFor="description">What happened?</label><textarea className="textarea" id="description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Include what the customer asked for, what you’ve checked, and anything the owner should know." required data-testid="input-request-description" /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, gap: 12 }}>
          <span className="section-note">Your owner makes the final decision.</span>
          <button className="btn btn-primary" type="submit" disabled={createRequest.isPending} data-testid="button-submit-request">{createRequest.isPending ? <LoaderCircle size={14} /> : <ChevronRight size={14} />} {createRequest.isPending ? 'Sending request…' : 'Send for a decision'}</button>
        </div>
      </form>
      <aside className="form-aside">
        <div className="empty-mark" style={{ margin: '0 0 15px', background: '#dce8dc' }}><Lightbulb size={20} /></div>
        <div className="aside-title">Good context makes a good hand-off.</div>
        <p className="aside-copy">Say what the customer needs and what you’ve already tried. TwinBoss can use that context to help Nadia make a clear, consistent decision.</p>
        <div style={{ borderTop: '1px solid #d3dfd2', marginTop: 18, paddingTop: 14 }}>
          <div className="ai-kicker"><ShieldCheck size={13} /> Your owner stays in control</div>
          <p className="aside-copy" style={{ margin: '8px 0 0' }}>Nothing is approved, refunded, or purchased until the owner chooses an action.</p>
        </div>
      </aside>
    </div>
  </div>;
}

function ActivityPage({ notify }: { notify: (text: string, error?: boolean) => void }) {
  const activity = useGetActivity();
  const [filter, setFilter] = useState('all');
  const [expandedReceipts, setExpandedReceipts] = useState<number[]>([]);
  const items = activity.data ?? [];
  const shown = filter === 'all' ? items : items.filter(item => item.kind.toLowerCase().includes(filter));
  const reload = () => { void activity.refetch().then(result => notify(result.isError ? 'Could not refresh activity.' : 'Decision trail refreshed.', result.isError)); };
  const toggleReceipt = (id: number) => setExpandedReceipts(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  return <div className="page">
    <PageHeading eyebrow="A clear record, always" title="Decision trail." text="Every hand-off and owner decision, captured with its reasoning." action={<button className="btn btn-quiet" onClick={reload} data-testid="button-refresh-activity"><RefreshCw size={14} /> Refresh trail</button>} />
    <div className="panel">
      <div className="panel-head"><div><div className="section-title">Recent activity</div><div className="section-note" style={{ marginTop: 4 }}>Receipts and request updates from your workspace</div></div><div className="filter-row">{['all', 'decision', 'request'].map(value => <button className={`filter-chip${filter === value ? ' active' : ''}`} onClick={() => setFilter(value)} key={value} data-testid={`button-filter-${value}`}>{value === 'all' ? 'All activity' : `${value[0].toUpperCase()}${value.slice(1)}s`}</button>)}</div></div>
      {activity.isLoading ? <LoadingRows /> : activity.isError ? <QueryError retry={() => void activity.refetch()} /> : shown.length === 0 ? <div className="empty-box"><div className="empty-mark"><Activity size={20} /></div><div className="empty-title">Your trail starts here</div><p className="subhead">Request updates and decisions will be recorded as they happen.</p></div> : <div className="activity-list">
        {shown.map(item => {
          const hasReceipt = Boolean(item.receiptNumber);
          const isExpanded = expandedReceipts.includes(item.id);
          const receiptValue = (value: string | null | undefined) => value?.trim() || 'Not recorded';
          return <article className="activity-row" key={item.id} data-testid={`activity-item-${item.id}`}>
            <div className="activity-mark">{hasReceipt ? <FileCheck2 size={15} /> : <Activity size={15} />}</div>
            <div>
              <div className="activity-title">{item.title}</div>
              <div className="activity-description">{item.description}</div>
              <div className="section-note" style={{ marginTop: 7 }}>{item.actor}{item.requestId ? ` · Request #${item.requestId}` : ''}{item.action ? ` · ${item.action.replace('_', ' ')}` : ''}</div>
              {hasReceipt && <button
                type="button"
                className="receipt-toggle"
                onClick={() => toggleReceipt(item.id)}
                aria-expanded={isExpanded}
                aria-controls={`receipt-detail-${item.id}`}
                data-testid={`button-toggle-receipt-${item.id}`}
              >{isExpanded ? 'Hide decision receipt' : 'Read decision receipt'} <ChevronRight size={12} className={isExpanded ? 'receipt-chevron open' : 'receipt-chevron'} /></button>}
              {hasReceipt && isExpanded && <section className="activity-receipt" id={`receipt-detail-${item.id}`} aria-label={`Decision receipt ${receiptValue(item.receiptNumber)}`} data-testid={`receipt-detail-${item.id}`}>
                <div className="activity-receipt-head">
                  <div><div className="receipt-num">DECISION RECEIPT</div><h3>{receiptValue(item.receiptNumber)}</h3></div>
                  <span className={`pill ${item.syncStatus ? 'approved' : 'neutral'}`}>{receiptValue(item.syncStatus)}</span>
                </div>
                <div className="receipt-request">{receiptValue(item.requestTitle)}</div>
                <div className="receipt-data-grid">
                  <div className="receipt-data"><span>Customer</span><strong>{receiptValue(item.customerName)}</strong></div>
                  <div className="receipt-data"><span>Requested by</span><strong>{receiptValue(item.staffName)}</strong></div>
                  <div className="receipt-data"><span>Requested action</span><strong>{item.requestedAction ? item.requestedAction.replace('_', ' ') : 'Not recorded'}</strong></div>
                  <div className="receipt-data"><span>Chosen action</span><strong>{item.action ? item.action.replace('_', ' ') : 'Not recorded'}</strong></div>
                  <div className="receipt-data"><span>Decision by</span><strong>{receiptValue(item.decisionBy)}</strong></div>
                  <div className="receipt-data"><span>Recorded at</span><strong>{shortDate(item.createdAt)}</strong></div>
                  <div className="receipt-data receipt-wide"><span>Reason</span><strong>{receiptValue(item.reason)}</strong></div>
                  <div className="receipt-data receipt-wide"><span>Rule applied</span><strong>{receiptValue(item.ruleApplied)}</strong></div>
                  <div className="receipt-data receipt-wide"><span>Learning note</span><strong>{receiptValue(item.learningNote)}</strong></div>
                </div>
              </section>}
            </div>
            <div className="activity-time">{shortDate(item.createdAt)}{item.amount !== null ? <div className="amount" style={{ marginTop: 7 }}>{money(item.amount)}</div> : null}</div>
          </article>;
        })}
      </div>}
    </div>
  </div>;
}

function CustomersPage() {
  const customers = useGetCustomers();
  return <div className="page">
    <PageHeading eyebrow="Customer context · Orbyte" title="Know who’s on the other side." text="A shared view of customer history to make everyday decisions more thoughtful." action={<div className="sync-mark"><span className="sync-dot" /> Mock Orbyte data</div>} />
    {customers.isLoading ? <div className="customer-grid"><div className="panel"><LoadingRows /></div><div className="panel"><LoadingRows /></div></div> : customers.isError ? <div className="panel"><QueryError retry={() => void customers.refetch()} /></div> : (customers.data ?? []).length === 0 ? <div className="panel"><div className="empty-box"><div className="empty-mark"><Users size={20} /></div><div className="empty-title">No customer records yet</div><p className="subhead">Orbyte customer context will appear here when available.</p></div></div> : <div className="customer-grid">{customers.data!.map(customer => <article className="customer-card" key={customer.id} data-testid={`customer-card-${customer.id}`}>
      <div className="customer-top"><div><h2 className="customer-name">{customer.name}</h2><div className="customer-tier">{customer.tier} customer</div></div><div className="avatar" style={{ background: '#dce9dc' }}>{customer.name.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()}</div></div>
      <div className="customer-value">{money(customer.lifetimeValue)}</div><div className="customer-label">Lifetime value with Orbyte</div>
      <div className="customer-stats"><span><strong>{customer.orders}</strong> orders</span><span><strong>{customer.tier}</strong> tier</span></div>
      <p className="customer-notes">{customer.notes}</p>
    </article>)}</div>}
  </div>;
}

function RulesPage() {
  const rules = useGetRules();
  return <div className="page">
    <PageHeading eyebrow="Owner guidance + learned patterns" title="The way you do business." text="These rules help TwinBoss make recommendations that fit your standards. You remain the final authority." />
    <div className="panel" style={{ marginBottom: 18, background: '#e9efe7', borderColor: '#d7e2d6' }}><div className="panel-body" style={{ display: 'flex', gap: 13, alignItems: 'center' }}><div className="empty-mark" style={{ margin: 0, background: '#d9e6d8' }}><ShieldCheck size={20} /></div><div><div className="aside-title" style={{ margin: '0 0 3px' }}>Recommendations are guidance, not permission.</div><div className="aside-copy">TwinBoss uses the active rules below to explain its suggestions. Only the owner can approve a request.</div></div></div></div>
    {rules.isLoading ? <div className="panel"><LoadingRows /></div> : rules.isError ? <div className="panel"><QueryError retry={() => void rules.refetch()} /></div> : (rules.data ?? []).length === 0 ? <div className="panel"><div className="empty-box"><div className="empty-mark"><BookOpen size={20} /></div><div className="empty-title">No rules to show yet</div><p className="subhead">Owner guidance and learned patterns will appear here.</p></div></div> : <div className="rules-list">{rules.data!.map(rule => <article className="rule-card" key={rule.id} data-testid={`rule-card-${rule.id}`}>
      <div className="rule-icon">{rule.source.toLowerCase().includes('learn') ? <Sparkles size={17} /> : <BookOpen size={17} />}</div>
      <div><h2 className="rule-title">{rule.title}</h2><div className="rule-description">{rule.description}</div><div className="rule-meta">{rule.source} · Added {shortDate(rule.createdAt)}</div></div>
      <span className={`pill ${rule.enabled ? 'low' : 'neutral'}`}>{rule.enabled ? 'Active' : 'Paused'}</span>
    </article>)}</div>}
  </div>;
}

function RouterContent() {
  const [role, setRole] = useState<Role>('boss');
  const [toast, setToast] = useState<ToastState>(null);
  const notify = (text: string, error = false) => setToast({ text, error });
  return <>
    <AppShell role={role} setRole={setRole}>
      <ErrorBoundary>
        <Switch>
          <Route path="/"><DashboardPage notify={notify} /></Route>
          <Route path="/staff"><StaffPage notify={notify} setRole={setRole} /></Route>
          <Route path="/activity"><ActivityPage notify={notify} /></Route>
          <Route path="/customers"><CustomersPage /></Route>
          <Route path="/rules"><RulesPage /></Route>
          <Route component={NotFound} />
        </Switch>
      </ErrorBoundary>
    </AppShell>
    <Toast toast={toast} onClose={() => setToast(null)} />
  </>;
}

function App() {
  return <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <RouterContent />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  </QueryClientProvider>;
}

export default App;
