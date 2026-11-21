import { useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { ShellLayout } from '../components/ShellLayout';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, login, loginWithGoogle, loginDemoAdmin, logout } = useAuth();
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  );
  const [email, setEmail] = useState('admin@agentshield.io');
  const [password, setPassword] = useState('ShieldAdmin2026!');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (googleClientId) return;
    AgentShieldApi.getGoogleClientId()
      .then((clientId) => {
        if (clientId) setGoogleClientId(clientId);
      })
      .catch(() => {
        // The email and password sign-in remains available if Google is not configured.
      });
  }, [googleClientId]);

  useEffect(() => {
    if (user || !googleClientId || !googleButtonRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google?.accounts.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setBusy(true);
          setError(null);
          setMessage(null);
          try {
            await loginWithGoogle(credential);
            setMessage('Signed in with Google.');
          } catch (err) {
            setError(extractApiError(err));
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 280,
      });
    };

    const existingScript = document.getElementById('google-identity-services');
    if (window.google?.accounts.id) {
      renderGoogleButton();
    } else if (existingScript) {
      existingScript.addEventListener('load', renderGoogleButton, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = 'google-identity-services';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      document.head.appendChild(script);
    }
  }, [googleClientId, loginWithGoogle, user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await login(email, password);
      setMessage('Administrator session authenticated.');
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ShellLayout
      title="Settings"
      subtitle="Administrator RBAC session, LLM provider mode, and REST API contract"
    >
      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <div className="flex justify-center">
        {/* Administrator Authentication */}
        <div className="w-full max-w-xl p-6 rounded-xl bg-[#FFFFFF] border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Administrator Session (RBAC)
            </h2>
            {user && (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:text-slate-700"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                Sign Out
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-semibold text-sky-950 block">Dedicated Google Login Portal</span>
              <span className="text-slate-600 text-[11px] block">
                Sign in using your Google Workspace identity with OAuth 2.0 / OIDC.
              </span>
            </div>
            <a
              href="/login"
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold whitespace-nowrap shadow-sm text-xs"
            >
              Open Login Page →
            </a>
          </div>

          {user ? (
            <div className="p-4 rounded-lg bg-[#FFFFFF] border border-slate-200 flex items-center gap-3 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
              <div>
                <div className="text-sm font-medium text-slate-900">{user.name}</div>
                <div className="font-mono text-slate-500">
                  {user.email} · role: {user.role}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label htmlFor="admin-email" className="block text-xs text-slate-600 mb-1">
                  Email
                </label>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div>
                <label htmlFor="admin-password" className="block text-xs text-slate-600 mb-1">
                  Password
                </label>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#FFFFFF] border border-slate-300 text-xs text-slate-900"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-semibold"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => loginDemoAdmin()}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs text-slate-700"
                >
                  Quick Administrator Access
                </button>
              </div>
            </form>
          )}
          {!user && (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              <p className="text-xs font-medium text-slate-500">Or continue with Google</p>
              {googleClientId ? (
                <div ref={googleButtonRef} aria-label="Sign in with Google" />
              ) : (
                <p className="text-xs text-amber-700">
                  Configure VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID to enable Google sign-in.
                </p>
              )}
            </div>
          )}
        </div>

      </div>

    </ShellLayout>
  );
}
