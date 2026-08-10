import React, { useState, useEffect } from 'react';
import { Terminal, X, Copy, Check, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { isFirebaseConfigured, firebaseConfig, debugLogs, auth, User } from '../firebase';

interface AuthDebugDrawerProps {
  currentUser: User | null;
  isAuthLoading: boolean;
  viewMode: string;
}

export const AuthDebugDrawer: React.FC<AuthDebugDrawerProps> = ({ currentUser, isAuthLoading, viewMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [, setLogTick] = useState(0);

  // Force re-render periodically when open to stream logs
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setLogTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const copyDiagnostics = () => {
    const diagnosticPayload = {
      timestamp: new Date().toISOString(),
      hostname: typeof window !== 'undefined' ? window.location.hostname : '',
      url: typeof window !== 'undefined' ? window.location.href : '',
      environment: {
        isFirebaseConfigured,
        apiKeySnippet: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 8)}... (${firebaseConfig.apiKey.length} chars)` : 'EMPTY',
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain,
        storageBucket: firebaseConfig.storageBucket
      },
      appState: {
        currentUser: currentUser ? { uid: currentUser.uid, email: currentUser.email } : null,
        isAuthLoading,
        viewMode,
        firebaseAuthCurrentUser: auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : null
      },
      logs: debugLogs
    };

    navigator.clipboard.writeText(JSON.stringify(diagnosticPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono no-print">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800 text-indigo-300 border border-indigo-500/40 px-3.5 py-2 rounded-xl shadow-2xl text-xs font-bold transition backdrop-blur-md group"
        >
          <Terminal className="w-4 h-4 text-indigo-400 group-hover:animate-pulse" />
          <span>🐛 Live Debug Diagnostics ({debugLogs.length})</span>
        </button>
      ) : (
        <div className="bg-slate-950 border-2 border-indigo-500/60 w-96 sm:w-[480px] max-h-[85vh] rounded-2xl p-4 shadow-2xl flex flex-col space-y-3 text-xs text-slate-200 animate-in fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              <h4 className="font-bold text-white text-xs">Production Auth & Environment Inspector</h4>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Config Grid */}
          <div className="bg-slate-900/90 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-1">
              <span className="text-slate-400 font-semibold">isFirebaseConfigured:</span>
              <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${isFirebaseConfigured ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-rose-950 text-rose-300 border border-rose-800'}`}>
                {isFirebaseConfigured ? '✓ TRUE' : '❌ FALSE'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">authDomain:</span>
              <span className="text-indigo-300 truncate max-w-[220px] font-mono">{firebaseConfig.authDomain}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">projectId:</span>
              <span className="text-indigo-300 truncate max-w-[220px] font-mono">{firebaseConfig.projectId}</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">apiKey (Length):</span>
              <span className="text-slate-300 font-mono">
                {firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 6)}... (${firebaseConfig.apiKey.length}c)` : 'EMPTY'}
              </span>
            </div>

            <div className="flex justify-between items-center border-t border-slate-800 pt-1">
              <span className="text-slate-400">currentUser:</span>
              <span className={`font-bold ${currentUser ? 'text-emerald-400' : 'text-amber-400'}`}>
                {currentUser ? (currentUser.email || currentUser.uid) : 'null (Unauthenticated)'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-400">viewMode:</span>
              <span className="text-purple-300 font-bold">{viewMode}</span>
            </div>
          </div>

          {/* Log Stream Header */}
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Event Trace Stream ({debugLogs.length})
            </span>
            <button
              onClick={copyDiagnostics}
              className="flex items-center space-x-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-[10px] font-bold px-2.5 py-1 rounded-lg transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Full Logs'}</span>
            </button>
          </div>

          {/* Log Items Scroll Container */}
          <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 max-h-56 overflow-y-auto space-y-1.5 font-mono text-[10px] leading-relaxed">
            {debugLogs.length === 0 ? (
              <div className="text-slate-500 italic p-2 text-center">No event logs recorded yet.</div>
            ) : (
              debugLogs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2 rounded border space-y-0.5 ${
                    log.type === 'error'
                      ? 'bg-rose-950/60 border-rose-800/80 text-rose-200'
                      : log.type === 'success'
                      ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                      : log.type === 'warn'
                      ? 'bg-amber-950/60 border-amber-800/80 text-amber-200'
                      : 'bg-slate-900/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-slate-950/80 border border-slate-700/50">
                      {log.type}
                    </span>
                    <span className="text-slate-400 text-[9px]">{log.time}</span>
                  </div>
                  <div className="break-words font-sans text-[11px] pt-0.5">{log.message}</div>
                  {log.data && (
                    <pre className="text-[9px] bg-slate-950 p-1.5 rounded border border-slate-800 overflow-x-auto text-slate-400 mt-1 max-h-24">
                      {log.data}
                    </pre>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
