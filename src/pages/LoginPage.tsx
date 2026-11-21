import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Shield,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react';
import { AgentShieldApi, extractApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/dashboard';
  const { user, login, loginWithGoogle, loginWithGoogleDemo, logout } = useAuth();

  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleClientId, setGoogleClientId] = useState<string | null>(
    import.meta.env.VITE_GOOGLE_CLIENT_ID || null
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign-in step flow: 'choose_account' | 'enter_email' | 'enter_password'
  const [step, setStep] = useState<'choose_account' | 'enter_email' | 'enter_password'>('choose_account');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Fallback Master Admin form
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('admin@agentshield.io');
  const [adminPassword, setAdminPassword] = useState('ShieldAdmin2026!');

  // Pre-configured Google Enterprise profiles
  const enterpriseAccounts = [
    {
      name: 'Jyoti Roy',
      email: 'jroy25267@gmail.com',
      title: 'Google Cloud SecOps Lead',
      avatarBg: 'bg-[#4285F4] text-white',
    },
    {
      name: 'Debnandan Kar',
      email: 'debnandankar610@gmail.com',
      title: 'Banking Security Principal',
      avatarBg: 'bg-[#0F9D58] text-white',
    },
  ];

  // Fetch server-configured Google Client ID if available
  useEffect(() => {
    AgentShieldApi.getGoogleClientId()
      .then((id) => {
        if (id) setGoogleClientId(id);
      })
      .catch(() => {});
  }, []);

  // Initialize official Google Identity Services SDK button if client ID is configured
  useEffect(() => {
    if (!googleClientId || !googleButtonRef.current) return;

    const initGsi = () => {
      if (!window.google?.accounts.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async ({ credential }) => {
          setLoading(true);
          setError(null);
          try {
            await loginWithGoogle(credential);
            setSuccessMsg('Google Identity authenticated successfully!');
            setTimeout(() => navigate(returnTo), 600);
          } catch (err) {
            setError(extractApiError(err));
          } finally {
            setLoading(false);
          }
        },
      });

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        width: 320,
      });
    };

    const scriptId = 'google-identity-services-login';
    const existingScript = document.getElementById(scriptId);

    if (window.google?.accounts.id) {
      initGsi();
    } else if (existingScript) {
      existingScript.addEventListener('load', initGsi, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    }
  }, [googleClientId, loginWithGoogle, navigate, returnTo]);

  // Execute Google Authentication with selected account
  const executeGoogleAuth = async (targetEmail: string, targetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const resolvedName = targetName || targetEmail.split('@')[0];
      await loginWithGoogleDemo(targetEmail, resolvedName);
      setSuccessMsg(`Signed in as ${targetEmail}`);
      setTimeout(() => navigate(returnTo), 500);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Enter an email or phone number');
      return;
    }
    setError(null);
    setStep('enter_password');
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeGoogleAuth(email.trim());
  };

  const handleAdminFallback = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(adminEmail, adminPassword);
      setSuccessMsg('Master Administrator authenticated.');
      setTimeout(() => navigate(returnTo), 500);
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F4F9] text-[#1F1F1F] flex flex-col justify-between font-sans selection:bg-[#C2E7FF] selection:text-[#001D35]">
      {/* Discreet Header */}
      <header className="px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-slate-800 hover:text-slate-900 transition-colors">
          <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-xs">
            <Shield className="w-4 h-4" />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-800">AgentShield</span>
        </Link>
        <Link
          to="/dashboard"
          className="text-xs font-medium text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full hover:bg-white/60 transition-colors"
        >
          Security Console →
        </Link>
      </header>

      {/* Main Centered Google Sign-In Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[450px] bg-white rounded-[28px] border border-slate-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-8 sm:p-10 transition-all">
          {/* Google 4-Color Logo */}
          <div className="flex items-center justify-between mb-4">
            <svg className="w-9 h-9" viewBox="0 0 24 24" aria-label="Google logo">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>AgentShield Gateway</span>
            </div>
          </div>

          {/* Error & Success Messages */}
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Condition 1: Currently Signed In Profile View */}
          {user ? (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-normal text-[#1F1F1F]">Google Account</h1>
                <p className="text-sm text-[#444746] mt-1">
                  You are currently authenticated in AgentShield
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3">
                <div className="flex items-center gap-3">
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt={user.name}
                      className="w-12 h-12 rounded-full object-cover shadow-sm border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#0B57D0] text-white flex items-center justify-center font-bold text-base shadow-sm">
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{user.name}</div>
                    <div className="text-xs text-slate-600 truncate">{user.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-mono font-semibold uppercase text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                        Role: {user.role}
                      </span>
                      {user.google_id && (
                        <span className="text-[10px] font-mono text-slate-500 truncate">
                          ID: {user.google_id.slice(0, 10)}...
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate(returnTo)}
                  className="w-full py-2.5 px-4 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] text-white font-medium text-sm shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  Continue to Security Console
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2.5 px-4 rounded-full border border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-700 font-medium text-sm transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out of this account
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Condition 2: Step 1 - Choose Google Account */}
              {step === 'choose_account' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-normal text-[#1F1F1F]">Choose an account</h1>
                    <p className="text-sm text-[#444746] mt-1">to continue to AgentShield</p>
                  </div>

                  {/* Real Google GSI Button Container if Client ID is configured */}
                  {googleClientId && (
                    <div className="flex justify-center py-1">
                      <div ref={googleButtonRef} className="min-h-[44px]" />
                    </div>
                  )}

                  {/* Google Workspace Enterprise Account Selector */}
                  <div className="divide-y divide-slate-100 border-y border-slate-100">
                    {enterpriseAccounts.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        disabled={loading}
                        onClick={() => executeGoogleAuth(account.email, account.name)}
                        className="w-full py-3.5 px-2 text-left hover:bg-slate-50 transition-colors flex items-center gap-3.5 group rounded-xl"
                      >
                        <div
                          className={`w-9 h-9 rounded-full ${account.avatarBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}
                        >
                          {account.name.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#1F1F1F] group-hover:text-[#0B57D0] truncate">
                            {account.name}
                          </div>
                          <div className="text-xs text-[#444746] truncate">{account.email}</div>
                          <div className="text-[10px] text-slate-400 truncate">{account.title}</div>
                        </div>
                      </button>
                    ))}

                    {/* Use Another Account Button */}
                    <button
                      type="button"
                      onClick={() => setStep('enter_email')}
                      className="w-full py-3.5 px-2 text-left hover:bg-slate-50 transition-colors flex items-center gap-3.5 group rounded-xl"
                    >
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="text-sm font-medium text-[#1F1F1F] group-hover:text-[#0B57D0]">
                        Use another account
                      </div>
                    </button>
                  </div>

                  {/* Guest mode privacy notice */}
                  <p className="text-xs text-[#444746] leading-relaxed pt-1">
                    To continue, Google will share your name, email address, and profile picture with
                    AgentShield. Review AgentShield's privacy policy and terms of service.
                  </p>
                </div>
              )}

              {/* Condition 3: Step 1.5 - Enter Google Email / Phone */}
              {step === 'enter_email' && (
                <form onSubmit={handleEmailSubmit} className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-normal text-[#1F1F1F]">Sign in</h1>
                    <p className="text-sm text-[#444746] mt-1">to continue to AgentShield</p>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type="email"
                        id="google-email-input"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email or phone"
                        className="w-full px-4 py-3.5 rounded-lg border border-[#747775] text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition-colors"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep('choose_account')}
                      className="text-xs font-medium text-[#0B57D0] hover:underline"
                    >
                      Choose from saved Google accounts
                    </button>
                  </div>

                  <p className="text-xs text-[#444746] leading-relaxed">
                    Not your computer? Use Guest mode to sign in privately.{' '}
                    <span className="text-[#0B57D0] hover:underline cursor-pointer">Learn more</span>
                  </p>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('choose_account')}
                      className="text-sm font-medium text-[#0B57D0] hover:text-[#0842A0]"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      className="py-2.5 px-6 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-xs"
                    >
                      Next
                    </button>
                  </div>
                </form>
              )}

              {/* Condition 4: Step 2 - Enter Google Password */}
              {step === 'enter_password' && (
                <form onSubmit={handlePasswordSubmit} className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-normal text-[#1F1F1F]">Welcome</h1>
                    {/* User Account Chip */}
                    <button
                      type="button"
                      onClick={() => setStep('enter_email')}
                      className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full border border-slate-300 bg-white text-xs text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span className="font-medium">{email}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="google-password-input"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-4 py-3.5 rounded-lg border border-[#747775] text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] transition-colors pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPassword}
                        onChange={(e) => setShowPassword(e.target.checked)}
                        className="rounded border-slate-300 text-[#0B57D0] focus:ring-[#0B57D0]"
                      />
                      Show password
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setStep('enter_email')}
                      className="text-sm font-medium text-[#0B57D0] hover:text-[#0842A0]"
                    >
                      Try another way
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="py-2.5 px-6 rounded-full bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-50 text-white font-medium text-sm transition-colors shadow-xs"
                    >
                      {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                  </div>
                </form>
              )}

              {/* Master Admin Fallback Trigger */}
              <div className="border-t border-slate-100 pt-4 mt-6">
                {!showAdminLogin ? (
                  <button
                    type="button"
                    onClick={() => setShowAdminLogin(true)}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Master Administrator Access
                  </button>
                ) : (
                  <form onSubmit={handleAdminFallback} className="space-y-3 pt-1">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      Administrator Credentials
                    </div>
                    <input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@agentshield.io"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                      >
                        Sign In as Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAdminLogin(false)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2"
                      >
                        Hide
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Google-Style Footer */}
      <footer className="w-full max-w-[450px] mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#444746] gap-2">
        <div className="flex items-center gap-1 cursor-pointer hover:text-slate-800">
          <span>English (United States)</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-6 text-xs text-[#444746]">
          <span className="cursor-pointer hover:underline">Help</span>
          <span className="cursor-pointer hover:underline">Privacy</span>
          <span className="cursor-pointer hover:underline">Terms</span>
        </div>
      </footer>
    </div>
  );
}
