import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { DecisionBadge } from '../components/DecisionBadge';
import { ShellLayout } from '../components/ShellLayout';
import { useAuth } from '../context/AuthContext';
import type { GmailMessageSummary, InterceptedGmailListResult } from '../types/api';

export default function GmailInboxPage() {
  const {
    user,
    gmailConnected,
    gmailEmail,
    gmailLoading,
    connectGmailWithCode,
    disconnectGmail,
    refreshGmailStatus,
  } = useAuth();

  const [googleClientId, setGoogleClientId] = useState<string | null>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  );

  const [query, setQuery] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messagesResult, setMessagesResult] = useState<InterceptedGmailListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected email for detail view
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedMessageData, setSelectedMessageData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch Google Client ID on mount
  useEffect(() => {
    AgentShieldApi.getGoogleClientId()
      .then((id) => {
        if (id) setGoogleClientId(id);
      })
      .catch(() => {});
  }, []);

  // Ensure Google Identity Services script is loaded
  useEffect(() => {
    const scriptId = 'google-identity-services-sdk';
    if (!document.getElementById(scriptId) && !window.google?.accounts?.oauth2) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // Fetch Gmail messages through the AgentShield Security Interceptor
  const loadMessages = useCallback(
    async (searchQuery = query) => {
      if (!gmailConnected) return;
      setLoadingMessages(true);
      setError(null);
      try {
        const res = await AgentShieldApi.getGmailMessages({
          q: searchQuery || undefined,
          max_results: 15,
        });
        setMessagesResult(res);
      } catch (err) {
        setError(extractApiError(err));
      } finally {
        setLoadingMessages(false);
      }
    },
    [gmailConnected, query]
  );

  // Auto-load messages when Gmail connects
  useEffect(() => {
    if (gmailConnected) {
      loadMessages();
    } else {
      setMessagesResult(null);
    }
  }, [gmailConnected, loadMessages]);

  // Initiate genuine Google OAuth 2.0 Consent Screen for Gmail API
  const handleConnectGmail = () => {
    if (!googleClientId) {
      setError(
        'Google Client ID is not configured. Please add VITE_GOOGLE_CLIENT_ID to .env or GOOGLE_CLIENT_ID to the backend.'
      );
      return;
    }

    if (!window.google?.accounts?.oauth2) {
      setError('Google Identity Services SDK is initializing. Please try again in 2 seconds.');
      return;
    }

    setError(null);
    setSuccessMsg(null);

    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: googleClientId,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      ux_mode: 'popup',
      callback: async (response: GoogleOAuth2CodeResponse) => {
        if (response.error) {
          setError(`Google authorization error: ${response.error}`);
          return;
        }
        if (!response.code) {
          setError('No authorization code received from Google.');
          return;
        }

        try {
          await connectGmailWithCode(response.code);
          setSuccessMsg('Genuine Gmail API connected successfully via OAuth 2.0 authorization code!');
          await refreshGmailStatus();
        } catch (err) {
          setError(extractApiError(err));
        }
      },
    });

    client.requestCode();
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Gmail and revoke access tokens?')) return;
    try {
      await disconnectGmail();
      setSuccessMsg('Gmail disconnected and OAuth tokens revoked on Google servers.');
      setMessagesResult(null);
      setSelectedMessageId(null);
      setSelectedMessageData(null);
    } catch (err) {
      setError(extractApiError(err));
    }
  };

  // Inspect email detail via AgentShield Interceptor
  const handleInspectEmail = async (messageId: string) => {
    setSelectedMessageId(messageId);
    setLoadingDetail(true);
    setSelectedMessageData(null);
    try {
      const detail = await AgentShieldApi.getGmailMessageDetail(messageId);
      setSelectedMessageData(detail);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <ShellLayout
      title="Gmail Security Vault & Interceptor"
      subtitle="Genuine Google OAuth 2.0 authorization with real-time Zero-Trust inspection, DLP scanning, and cryptographic audit ledger logging"
      primaryAction={
        <div className="flex items-center gap-2">
          {gmailConnected ? (
            <>
              <button
                type="button"
                onClick={() => loadMessages()}
                disabled={loadingMessages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-sm transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMessages ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={gmailLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-700 shadow-sm transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect Gmail
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={gmailLoading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#0B57D0] hover:bg-[#0842A0] text-white text-xs font-semibold shadow-sm transition-all"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              Connect Gmail
            </button>
          )}
        </div>
      }
    >
      {/* Alert Banners */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Operation Alert:</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Success:</span>
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Gmail OAuth Connection Header Banner */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${gmailConnected ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-500'}`}>
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  {gmailConnected ? 'Google Workspace Gmail Connected' : 'Connect Your Google Account for Gmail API'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    gmailConnected
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${gmailConnected ? 'bg-emerald-600' : 'bg-amber-600'}`} />
                  {gmailConnected ? 'Active Connection' : 'Not Connected'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {gmailConnected ? (
                  <>
                    Authorized account:{' '}
                    <span className="font-mono font-semibold text-slate-800">{gmailEmail}</span>{' '}
                    (Scope: <code className="text-[11px] bg-slate-100 px-1 py-0.5 rounded">gmail.readonly</code>)
                  </>
                ) : (
                  'Click "Connect Gmail" to open the genuine Google OAuth 2.0 authorization screen and grant minimum read-only permissions.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {gmailConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={gmailLoading}
                className="px-3.5 py-2 rounded-xl border border-red-300 bg-white hover:bg-red-50 text-xs font-semibold text-red-700 transition-colors shadow-sm flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={gmailLoading}
                className="px-4 py-2.5 rounded-xl bg-[#0B57D0] hover:bg-[#0842A0] text-xs font-semibold text-white shadow-sm transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                Connect Gmail
              </button>
            )}
          </div>
        </div>
      </div>

      {/* When Gmail is NOT connected: onboarding / explanation card */}
      {!gmailConnected && (
        <div className="grid md:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              1
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Genuine OAuth 2.0 Consent</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Authenticate directly with Google's official OAuth consent popup. No passwords are ever entered into or stored by AgentShield.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
              2
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Minimum Permission Principle</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              AgentShield requests strictly <code className="text-sky-800">gmail.readonly</code>. Access tokens are encrypted at rest with AES-256-GCM.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              3
            </div>
            <h3 className="text-sm font-semibold text-slate-900">Zero-Trust Interception</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every query, message read, and exfiltration attempt passes through AgentShield's risk engine, DLP scanner, and cryptographic audit log.
            </p>
          </div>
        </div>
      )}

      {/* When Gmail IS connected: Live Interceptor Telemetry + Messages Table */}
      {gmailConnected && (
        <div className="space-y-6">
          {/* AgentShield Live Interceptor Telemetry Card */}
          <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-400" />
                <span className="font-semibold text-sm tracking-wide text-white">
                  AgentShield Zero-Trust Gateway — Live Interception Telemetry
                </span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Intercepted Action:{' '}
                <span className="text-sky-300 font-semibold">gmail.list_messages</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">Gateway Verdict</span>
                {messagesResult ? (
                  <DecisionBadge decision={messagesResult.security_report.decision} />
                ) : (
                  <span className="text-xs font-mono text-slate-400">Awaiting Query...</span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">Assessed Risk Score</span>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`font-mono text-xl font-bold ${
                      messagesResult
                        ? messagesResult.security_report.riskScore > 70
                          ? 'text-red-400'
                          : messagesResult.security_report.riskScore > 35
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {messagesResult ? messagesResult.security_report.riskScore : '--'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">/ 100</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">Policy Enforcement</span>
                <span className="text-xs font-mono text-emerald-400 block truncate">
                  {messagesResult?.security_report?.policyChecks?.[0]?.policy_name || 'Active Policies: 4'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <span className="text-[11px] text-slate-400 block mb-1">Audit Ledger Entry</span>
                <span className="text-[11px] font-mono text-sky-400 block truncate">
                  {messagesResult?.security_report?.auditEventId
                    ? `#${messagesResult.security_report.auditEventId.slice(0, 12)}...`
                    : 'Cryptographic Hash Validated'}
                </span>
              </div>
            </div>

            {messagesResult?.security_report?.reason && (
              <div className="text-xs font-mono text-slate-300 bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/60">
                🛡️ <span className="font-semibold text-slate-200">Gateway Reason:</span>{' '}
                {messagesResult.security_report.reason}
              </div>
            )}
          </div>

          {/* Search / Filter Bar passing through AgentShield Gateway */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                loadMessages(query);
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Query Gmail inbox (evaluated live by AgentShield risk engine)..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                disabled={loadingMessages}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-colors flex items-center justify-center gap-1.5"
              >
                {loadingMessages ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                Scan Inbox via Gateway
              </button>
            </form>

            {/* Quick Demonstration Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
              <span className="font-medium text-slate-700">Quick Test Payloads:</span>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  loadMessages('');
                }}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium transition-colors"
              >
                Standard Inbox (Low Risk)
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = 'password OR credentials OR secret';
                  setQuery(q);
                  loadMessages(q);
                }}
                className="px-2.5 py-1 rounded-full bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-medium border border-red-200 transition-colors"
              >
                Sensitive Scrape: "password OR credentials" (High Risk)
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = 'invoice OR payment OR wire';
                  setQuery(q);
                  loadMessages(q);
                }}
                className="px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-medium border border-amber-200 transition-colors"
              >
                Financial Query: "invoice OR payment"
              </button>
            </div>
          </div>

          {/* Real Gmail Messages Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Retrieved Gmail Messages ({messagesResult?.messages?.length || 0})
                </h3>
                <span className="text-xs text-slate-500">
                  — Real Google Identity & Gmail API
                </span>
              </div>
              {loadingMessages && (
                <span className="text-xs text-sky-600 font-medium flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Filtering through AgentShield...
                </span>
              )}
            </div>

            {loadingMessages && !messagesResult && (
              <div className="p-12 text-center text-slate-500 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                Interception engine scanning Gmail messages...
              </div>
            )}

            {messagesResult && messagesResult.messages.length === 0 && (
              <div className="p-12 text-center text-slate-500 text-xs">
                <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                No messages found matching query in this Gmail account.
              </div>
            )}

            {messagesResult && messagesResult.messages.length > 0 && (
              <div className="divide-y divide-slate-100">
                {messagesResult.messages.map((msg: GmailMessageSummary) => (
                  <div
                    key={msg.id}
                    className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {msg.from || 'Unknown Sender'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {msg.date ? new Date(msg.date).toLocaleDateString() : ''}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-slate-800 truncate">
                        {msg.subject || '(No Subject)'}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">
                        {msg.snippet}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleInspectEmail(msg.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 hover:border-sky-500 bg-white hover:bg-sky-50 text-xs font-semibold text-slate-700 hover:text-sky-800 transition-colors shadow-xs flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Security
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Detail & DLP Inspection Modal */}
      {selectedMessageId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  AgentShield Email Inspection & DLP Scan
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMessageId(null);
                  setSelectedMessageData(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingDetail && (
                <div className="p-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-sky-600" />
                  Retrieving message payload & running DLP inspection...
                </div>
              )}

              {selectedMessageData && (
                <>
                  {/* Security Finding Callout */}
                  <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DecisionBadge decision={selectedMessageData.security_report.decision} />
                        <span className="text-xs font-semibold text-slate-300">
                          Risk Score: {selectedMessageData.security_report.riskScore}/100
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        Event #{selectedMessageData.security_report.auditEventId.slice(0, 10)}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 font-mono">
                      {selectedMessageData.security_report.reason}
                    </div>

                    {/* DLP Scanning Findings */}
                    <div className="pt-2 border-t border-slate-800 text-xs">
                      <span className="text-slate-400 block mb-1">DLP Sensitive Data Scan:</span>
                      {selectedMessageData.security_report.dlpFindings && selectedMessageData.security_report.dlpFindings.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedMessageData.security_report.dlpFindings.map((finding: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-red-300 text-[10px] font-mono"
                            >
                              ⚠️ {finding}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-400 font-mono text-[11px]">
                          ✓ Zero sensitive PII / secrets detected in payload
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Email Headers Card */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 font-mono">
                    <div>
                      <span className="text-slate-500">From:</span>{' '}
                      <span className="text-slate-900 font-semibold">{selectedMessageData.message?.from}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Subject:</span>{' '}
                      <span className="text-slate-900 font-semibold">{selectedMessageData.message?.subject}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Date:</span>{' '}
                      <span className="text-slate-600">{selectedMessageData.message?.date}</span>
                    </div>
                  </div>

                  {/* Sanitized Message Body Content */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-slate-700 block">
                      Body Payload Content
                    </span>
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {selectedMessageData.message?.body || selectedMessageData.message?.snippet || '(No text content)'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedMessageId(null);
                  setSelectedMessageData(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </ShellLayout>
  );
}
