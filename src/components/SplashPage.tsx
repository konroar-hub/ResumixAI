import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  Layers,
  Wrench,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  User as UserIcon,
  LogOut,
  ChevronRight,
  Star,
  Download,
  Terminal,
  Cpu
} from 'lucide-react';
import {
  auth,
  googleProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  isFirebaseConfigured,
  User
} from '../firebase';

interface SplashPageProps {
  onEnterApp: () => void;
  currentUser: User | null;
}

export const SplashPage: React.FC<SplashPageProps> = ({ onEnterApp, currentUser }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [activeDemoTab, setActiveDemoTab] = useState<'architect' | 'ai' | 'frontend'>('architect');

  // Handle redirect result if popup was blocked and app fell back to full-page redirect
  React.useEffect(() => {
    if (isFirebaseConfigured) {
      getRedirectResult(auth).then((result) => {
        if (result?.user) {
          onEnterApp();
        }
      }).catch(err => {
        console.warn('Redirect authentication notice:', err);
      });
    }
  }, [onEnterApp]);

  const handleGoogleSignIn = () => {
    if (!isFirebaseConfigured) {
      // Fallback for local demo when Firebase keys are omitted
      onEnterApp();
      return;
    }
    setAuthError('');
    setIsAuthLoading(true);

    // Call signInWithPopup synchronously within the exact user click event loop
    signInWithPopup(auth, googleProvider)
      .then(() => {
        setIsAuthModalOpen(false);
        onEnterApp();
      })
      .catch((err: any) => {
        console.warn('Google Sign-in popup notice:', err?.code, err?.message);
        if (
          err?.code === 'auth/popup-blocked' ||
          err?.code === 'auth/popup-closed-by-user' ||
          err?.code === 'auth/cancelled-popup-request' ||
          err?.message?.includes('popup')
        ) {
          signInWithRedirect(auth, googleProvider).catch((redirectErr: any) => {
            setAuthError(redirectErr?.message || 'Failed to redirect for Google Sign-in');
          });
        } else {
          setAuthError(err?.message || 'Failed to sign in with Google');
        }
      })
      .finally(() => {
        setIsAuthLoading(false);
      });
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);

    if (!email || !password) {
      setAuthError('Please enter both email and password.');
      setIsAuthLoading(false);
      return;
    }

    try {
      if (!isFirebaseConfigured) {
        onEnterApp();
        return;
      }

      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      setIsAuthModalOpen(false);
      onEnterApp();
    } catch (err: any) {
      setAuthError(err?.message || `Failed to ${authMode}`);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (isFirebaseConfigured) {
      await signOut(auth);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col font-sans">
      {/* Dynamic Background Glow Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl"></div>
      </div>

      {/* Navigation Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-0.5 shadow-lg shadow-indigo-950/50">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                Resumix AI
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  v2.0
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {currentUser ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                  <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-slate-200 font-medium truncate max-w-[140px]">{currentUser.email || 'Authenticated User'}</span>
                </div>
                <button
                  onClick={onEnterApp}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-lg shadow-indigo-950/50 transition flex items-center space-x-1.5"
                >
                  <span>Go to App</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 rounded-lg transition"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-3">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-lg shadow-indigo-950/50 transition flex items-center space-x-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In / Register</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center space-x-2 bg-indigo-950/80 border border-indigo-500/30 px-3.5 py-1.5 rounded-full text-xs font-medium text-indigo-300 mb-8 backdrop-blur-sm self-center shadow-lg">
          <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span>Powered by Google Gemini 2.5 Flash & Firebase</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          Tailor Every Resume.{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
            Win Every Interview.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Maintain a master repository of your career experiences. Assemble targeted, high-impact ATS resume variants in seconds using modular cards and Gemini AI keyword matching.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm px-8 py-3.5 rounded-xl shadow-xl shadow-indigo-950/80 transition flex items-center justify-center space-x-2 group"
          >
            <Lock className="w-4 h-4" />
            <span>Sign In to Access Studio</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Feature Badges */}
        <div className="mt-12 pt-8 border-t border-slate-800/60 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Layers className="w-4 h-4" />
              <span>Modular Cards</span>
            </div>
            <p className="text-xs text-slate-400">Reuse experience bullet cards across targeted resumes.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Cpu className="w-4 h-4" />
              <span>Gemini AI Engine</span>
            </div>
            <p className="text-xs text-slate-400">Match resume bullet points to job posting requirements.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>ATS Compliant</span>
            </div>
            <p className="text-xs text-slate-400">Single-column print layout tested against major ATS parsers.</p>
          </div>
          <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl backdrop-blur-sm">
            <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Briefcase className="w-4 h-4" />
              <span>Job Tracker</span>
            </div>
            <p className="text-xs text-slate-400">Track target applications, match scores, and resume links.</p>
          </div>
        </div>
      </section>

      {/* Interactive Live Demo Preview Section */}
      <section className="relative z-10 py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              One Master Profile. Unlimited Tailored Resumes.
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              See how modular card selection composes specialized resume variants for different technical roles.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-6">
            {/* Demo Selector Tabs */}
            <div className="flex border-b border-slate-800 pb-3 gap-2 overflow-x-auto">
              <button
                onClick={() => setActiveDemoTab('architect')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  activeDemoTab === 'architect'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Senior Architect Variant</span>
              </button>
              <button
                onClick={() => setActiveDemoTab('ai')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  activeDemoTab === 'ai'
                    ? 'bg-purple-600 text-white shadow-lg'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Systems Lead Variant</span>
              </button>
              <button
                onClick={() => setActiveDemoTab('frontend')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center space-x-2 whitespace-nowrap ${
                  activeDemoTab === 'frontend'
                    ? 'bg-cyan-600 text-white shadow-lg'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Frontend Specialist Variant</span>
              </button>
            </div>

            {/* Simulated Live ATS Document */}
            <div className="bg-white text-slate-900 p-6 rounded-xl shadow-inner font-serif text-xs leading-relaxed space-y-4 max-h-96 overflow-y-auto">
              <div className="border-b border-slate-300 pb-3 text-center">
                <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide">
                  {activeDemoTab === 'architect' ? 'Alex Rivera — Senior Systems Architect' :
                   activeDemoTab === 'ai' ? 'Alex Rivera — Lead AI Engineer' :
                   'Alex Rivera — Staff Frontend Engineer'}
                </h3>
                <p className="text-[11px] text-slate-600 font-sans mt-0.5">
                  San Francisco, CA • alex@example.com • +1 (555) 019-2831
                </p>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-0.5 font-sans">
                  Technical Skills & Core Competencies
                </h4>
                <p className="text-[11px] text-slate-700 font-sans mt-1">
                  {activeDemoTab === 'architect' ? 'Distributed Systems, Microservices, Kubernetes, Go, Python, AWS, PostgreSQL' :
                   activeDemoTab === 'ai' ? 'PyTorch, Gemini 2.5 Flash, LLM Fine-Tuning, Python, Vector DBs, RAG Architectures' :
                   'React, TypeScript, Next.js, Tailwind CSS, Web Vitals Optimization, State Management'}
                </p>
              </div>

              <div>
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-800 border-b border-slate-300 pb-0.5 font-sans">
                  Professional Experience
                </h4>
                <div className="mt-2 space-y-3 font-sans">
                  {activeDemoTab === 'architect' && (
                    <div>
                      <div className="flex justify-between font-bold text-[11px]">
                        <span>Staff Infrastructure Architect</span>
                        <span>Stripe • 2022 - Present</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-slate-700 mt-1 space-y-0.5">
                        <li>Architected high-throughput payment transaction pipelines handling 40,000+ RPS with 99.999% availability.</li>
                        <li>Reduced cloud infrastructure costs by 28% through custom Kubernetes autoscaling controllers.</li>
                      </ul>
                    </div>
                  )}

                  {activeDemoTab === 'ai' && (
                    <div>
                      <div className="flex justify-between font-bold text-[11px]">
                        <span>Lead Generative AI Engineer</span>
                        <span>OpenAI Partner Team • 2023 - Present</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-slate-700 mt-1 space-y-0.5">
                        <li>Integrated Google Gemini 2.5 Flash API for streaming document analysis with sub-100ms first token latency.</li>
                        <li>Implemented RAG semantic retrieval indexing across 5,000,000+ technical resume documents.</li>
                      </ul>
                    </div>
                  )}

                  {activeDemoTab === 'frontend' && (
                    <div>
                      <div className="flex justify-between font-bold text-[11px]">
                        <span>Principal Frontend Engineer</span>
                        <span>Vercel Ecosystem • 2021 - Present</span>
                      </div>
                      <ul className="list-disc list-inside text-[11px] text-slate-700 mt-1 space-y-0.5">
                        <li>Engineered micro-frontend design system utilized by 120+ internal engineering teams.</li>
                        <li>Optimized Core Web Vitals resulting in a 42% increase in mobile applicant completion rate.</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800 bg-slate-950 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-400">Resumix AI</span>
            <span>—</span>
            <span>Deployable on Vercel with Firebase & Gemini AI</span>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={onEnterApp} className="hover:text-slate-300 transition">Studio</button>
            <button onClick={() => setIsAuthModalOpen(true)} className="hover:text-slate-300 transition">Cloud Account</button>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">
                  {authMode === 'login' ? 'Sign In to Resumix AI' : 'Create New Account'}
                </h3>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-sm"
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-3 rounded-lg">
                {authError}
              </div>
            )}

            {!isFirebaseConfigured && (
              <div className="bg-indigo-950/60 border border-indigo-800 text-indigo-300 text-xs p-3 rounded-lg">
                💡 Sign in to create your authenticated session and access your master profile.
              </div>
            )}

            <button
              onClick={handleGoogleSignIn}
              disabled={isAuthLoading}
              className="w-full bg-slate-950 hover:bg-slate-850 text-slate-100 border border-slate-800 font-semibold text-xs py-2.5 rounded-xl transition flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.3 9 5 12 5z" />
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
                <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z" />
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.3-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-slate-800 w-full"></div>
              <span className="bg-slate-900 px-3 text-[11px] text-slate-500 font-mono uppercase">Or Email</span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs py-2.5 rounded-xl shadow-lg transition"
              >
                {isAuthLoading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="flex items-center justify-center text-xs pt-2 border-t border-slate-800">
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-indigo-400 hover:underline font-medium text-center"
              >
                {authMode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
