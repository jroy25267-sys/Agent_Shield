import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import {
  Activity,
  Bot,
  CheckSquare,
  FileText,
  Flame,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  PowerOff,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  danger?: boolean;
}

export function ShellLayout({
  title,
  subtitle,
  primaryAction,
  children,
}: {
  title: string;
  subtitle?: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, globalLockdown, pendingApprovals, llmMode, logout } = useAuth();
  const location = useLocation();

  const navGroups: Array<{ heading: string; items: NavItem[] }> = [
    {
      heading: 'Operations',
      items: [
        { to: '/dashboard', label: 'Security Dashboard', icon: LayoutDashboard },
        { to: '/simulator', label: 'Attack Simulator', icon: Flame },
        { to: '/monitoring', label: 'Live Monitoring', icon: Activity },
      ],
    },
    {
      heading: 'Governance',
      items: [
        { to: '/agents', label: 'Agent Management', icon: Bot },
        { to: '/policies', label: 'Policy Engine', icon: Sliders },
        {
          to: '/approvals',
          label: 'Approval Center',
          icon: CheckSquare,
          badge: pendingApprovals > 0 ? pendingApprovals : undefined,
        },
      ],
    },
    {
      heading: 'Intelligence & Audit',
      items: [
        { to: '/threats', label: 'Threat Intelligence', icon: ShieldAlert },
        { to: '/audit', label: 'Audit Logs', icon: FileText },
        { to: '/kill-switch', label: 'Kill Switch', icon: PowerOff, danger: true },
        { to: '/settings', label: 'Settings', icon: Settings },
        { to: '/login', label: 'Google Sign In', icon: LogIn },
      ],
    },
  ];

  const renderNavLinks = (onSelect?: () => void) => (
    <nav aria-label="Security console navigation" className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
      {navGroups.map((group) => (
        <div key={group.heading}>
          <div className="px-3 mb-2 text-xs font-medium text-slate-500">
            {group.heading}
          </div>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    onClick={onSelect}
                    className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${isActive
                        ? 'bg-sky-500/15 text-sky-700 border border-sky-500/30'
                        : item.danger
                          ? 'text-red-300 hover:bg-red-500/10 border border-transparent'
                          : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-700 border border-transparent'
                      }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="font-mono text-xs tabular-nums px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-r border-slate-200/80 bg-[#F8FAFC]">
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200/80">
          <Link to="/" className="flex items-center gap-2.5 text-slate-900 font-display font-bold text-lg tracking-tight whitespace-nowrap shrink-0">
            <Shield className="w-5 h-5 text-sky-600" aria-hidden="true" />
            <span>AgentShield</span>
          </Link>
        </div>

        {renderNavLinks()}

        <div className="p-4 border-t border-slate-200/80 space-y-2 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Agent LLM Engine</span>
            <span className="font-mono text-slate-700">
              {llmMode === 'gemini' ? 'Gemini 4' : 'Mock Mode'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Gateway Mode</span>
            <span className={`font-mono ${globalLockdown ? 'text-red-400' : 'text-emerald-400'}`}>
              {globalLockdown ? 'LOCKDOWN' : 'ENFORCING'}
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-64 max-w-[80vw] bg-[#F8FAFC] border-r border-slate-200 flex flex-col h-full">
            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
              <Link to="/" className="flex items-center gap-2 text-slate-900 font-display font-bold text-lg whitespace-nowrap">
                <Shield className="w-5 h-5 text-sky-600" aria-hidden="true" />
                <span>AgentShield</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-slate-500 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks(() => setMobileOpen(false))}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-4 sm:px-6 border-b border-slate-200/80 bg-[#F8FAFC]/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 text-slate-600 hover:text-slate-700 rounded-lg border border-slate-200"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500 truncate">
                <Link to="/" className="hover:text-slate-700 transition-colors">
                  AgentShield
                </Link>
                <span aria-hidden="true">/</span>
                <span className="text-slate-700 truncate">{title}</span>
              </div>
              {subtitle && (
                <p className="hidden sm:block text-xs text-slate-500 truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {globalLockdown && (
              <Link
                to="/kill-switch"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-medium whitespace-nowrap shrink-0"
              >
                <PowerOff className="w-3.5 h-3.5" aria-hidden="true" />
                Lockdown Active
              </Link>
            )}

            {primaryAction}

            {user ? (
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <Link
                  to="/login"
                  className="hidden md:flex items-center gap-2 hover:opacity-90 transition-opacity"
                  title="Manage Google Session"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover shrink-0 border border-slate-200"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-semibold text-slate-800 whitespace-nowrap">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono truncate max-w-[130px]">
                      {user.email}
                    </div>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                </svg>
                Google Sign In
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
