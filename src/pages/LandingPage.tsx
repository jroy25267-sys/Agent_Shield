import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Shield,
  ShieldCheck,
  Terminal,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200/80 bg-[#FFFFFF]/95 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link
            to="/"
            className="text-lg font-display font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <Shield className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <span>AgentShield</span>
          </Link>

          {/* Zone 2: 4 concise single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#architecture"
              className="hover:text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#capabilities"
              className="hover:text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <Link
              to="/simulator"
              className="hover:text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Attack Lab
            </Link>
            <Link
              to="/policies"
              className="hover:text-slate-700 transition-colors whitespace-nowrap shrink-0"
            >
              Governance
            </Link>
          </nav>

          {/* Zone 3: Actions */}
          <div className="shrink-0 flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              Google Sign In
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              Open Console
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="text-xs font-medium text-sky-600 tracking-wide flex items-center gap-2">
                <span>AI Agent Runtime Security</span>
                <span aria-hidden="true">·</span>
                <span>Zero-Trust Execution Gateway</span>
              </div>

              <h1
                className="font-display font-bold tracking-tight text-slate-900 leading-[1.08]"
                style={{
                  fontSize: 'clamp(2.25rem, 4vw, 3.65rem)',
                  textWrap: 'balance',
                }}
              >
                Your AI can think. AgentShield decides what it is allowed to do.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Autonomous agents interact with payment rails, databases, and external APIs.
                AgentShield sits between the model and protected tools—evaluating cryptographic
                identity, deterministic policies, prompt injection, DLP, and behavioral risk before
                any execution occurs.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Open Security Console
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/simulator"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 bg-[#FFFFFF] hover:bg-slate-100 text-slate-900 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                >
                  Run Attack Lab
                </Link>
              </div>
            </div>

            <div className="lg:col-span-6 flex">
              <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-[#F8FAFC] relative flex items-center justify-center min-h-[300px]">
                <img
                  src="/src/assets/images/hero_agentshield_gateway_1795103372188.jpg"
                  alt="Isometric architecture of AgentShield zero-trust runtime security gateway intercepting AI agent tool conduits"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Proof Strip */}
          <div className="mt-14 pt-10 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <div className="font-mono text-lg xl:text-xl font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                APPROVE · BLOCK · PAUSE
              </div>
              <div className="mt-1.5 text-sm text-slate-600">
                Deterministic enforcement before any protected tool runs
              </div>
            </div>
            <div>
              <div className="font-mono text-lg xl:text-xl font-bold text-sky-600 tabular-nums whitespace-nowrap">
                0–100 Risk Engine
              </div>
              <div className="mt-1.5 text-sm text-slate-600">
                Explainable scoring across injection, DLP, limits, and anomalies
              </div>
            </div>
            <div>
              <div className="font-mono text-lg xl:text-xl font-bold text-amber-400 tabular-nums whitespace-nowrap">
                Human Approval Gate
              </div>
              <div className="mt-1.5 text-sm text-slate-600">
                Pauses risky actions with policy revalidation and expiry
              </div>
            </div>
            <div>
              <div className="font-mono text-lg xl:text-xl font-bold text-slate-900 tabular-nums whitespace-nowrap">
                Zero Secret Exposure
              </div>
              <div className="mt-1.5 text-sm text-slate-600">
                LLM never touches protected tool credentials or database handles
              </div>
            </div>
          </div>
        </section>

        {/* Architecture Flow */}
        <section
          id="architecture"
          className="border-t border-slate-200/80 bg-[#F8FAFC]/60 py-16 lg:py-20"
        >
          <div className="max-w-7xl mx-auto px-6 space-y-10">
            <div className="max-w-2xl space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Zero-Trust Runtime Enforcement Pipeline
              </h2>
              <p className="text-slate-600 text-sm sm:text-base">
                Prompt guardrails alone cannot secure tool execution. AgentShield enforces
                server-side authorization independently of the language model.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  num: '01',
                  title: 'Cryptographic Identity & Permissions',
                  desc: 'Every agent authenticates with an HMAC-SHA256 hashed API key. Actions outside granted tool permissions are rejected immediately.',
                  icon: Lock,
                },
                {
                  num: '02',
                  title: 'Security Intelligence Engine',
                  desc: 'Inspects payloads for prompt injection, PCI/secret exfiltration (DLP), rate-limit bursts, and statistical baseline anomalies.',
                  icon: ShieldCheck,
                },
                {
                  num: '03',
                  title: 'Deterministic Policy & Risk Gate',
                  desc: 'Enforces transaction caps, daily spending limits, allowlisted recipients, and high-risk approval thresholds into APPROVE, BLOCK, or PAUSE.',
                  icon: CheckCircle2,
                },
                {
                  num: '04',
                  title: 'Controlled Executor & Audit Trail',
                  desc: 'Only approved actions reach simulated external tools with idempotency keys. Every check and decision is logged without raw secrets.',
                  icon: Terminal,
                },
              ].map((step) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.num}
                    className="p-6 rounded-xl bg-[#FFFFFF] border border-slate-200 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                        <span>{step.num}</span>
                        <Icon className="w-4 h-4 text-sky-600" aria-hidden="true" />
                      </div>
                      <h3 className="font-display text-lg font-semibold text-slate-900">
                        {step.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Capabilities & Interactive Lab Preview */}
        <section id="capabilities" className="max-w-7xl mx-auto px-6 py-16 lg:py-20">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Built for Live Security Verification
              </h2>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Test FinanceBot against eight realistic adversarial and governance security tests in the
                Attack Simulation Lab—each backed by live API execution, policy evaluation, and
                persistent SQLite audit records.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <Link
                  to="/simulator"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  Launch Attack Simulation Lab
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
              {[
                {
                  name: '01. Normal Payment (₹2,000)',
                  outcome: 'APPROVE · Risk 10',
                  detail: 'Trusted vendor_01 within daily & transaction limits.',
                },
                {
                  name: '02. Excessive Payment (₹1,00,000)',
                  outcome: 'BLOCK · Policy Cap',
                  detail: 'Exceeds configured ₹10,000 single-transaction threshold.',
                },
                {
                  name: '03. Unknown Recipient',
                  outcome: 'PAUSE · Human Review',
                  detail: 'Pauses execution until administrator verifies vendor.',
                },
                {
                  name: '04. Prompt Injection Invoice',
                  outcome: 'BLOCK · Threat Detected',
                  detail: 'Detects instruction override & blocks hijacked transfer.',
                },
                {
                  name: '05. Sensitive Data Exfiltration',
                  outcome: 'BLOCK · DLP Triggered',
                  detail: 'Catches credit card & API key patterns outbound.',
                },
                {
                  name: '06. Emergency Kill Switch',
                  outcome: 'BLOCK · Immediate Revocation',
                  detail: 'Instantly denies all future calls from revoked agents.',
                },
              ].map((item) => (
                <div
                  key={item.name}
                  className="p-4 rounded-xl bg-[#FFFFFF] border border-slate-200 space-y-1.5"
                >
                  <div className="text-sm font-semibold text-slate-900">{item.name}</div>
                  <div className="text-xs font-mono text-sky-600">{item.outcome}</div>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/80 py-8 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-sky-600" aria-hidden="true" />
            <span className="font-medium text-slate-700">AgentShield</span>
            <span aria-hidden="true">·</span>
            <span>Autonomous AI Agent Runtime Security & Governance</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="hover:text-slate-700 transition-colors">
              Dashboard
            </Link>
            <Link to="/simulator" className="hover:text-slate-700 transition-colors">
              Attack Lab
            </Link>
            <Link to="/audit" className="hover:text-slate-700 transition-colors">
              Audit Logs
            </Link>
            <Link to="/settings" className="hover:text-slate-700 transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
