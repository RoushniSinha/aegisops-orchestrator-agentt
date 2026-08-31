import React, { useState, useEffect, useRef } from 'react';
import { 
  ChatMessage, 
  UserRole, 
  AccountId, 
  Currency, 
  ToolCall,
  CommittedExecutionLog
} from '../types';
import { ACCOUNTS, SYSTEM_REFERENCE_TIME } from '../data/mockData';
import { 
  Send, 
  CheckCheck, 
  Sparkles, 
  Terminal, 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Clock, 
  ShieldCheck,
  Building,
  Info,
  Maximize2,
  Paperclip,
  Smile,
  Mic,
  Zap,
  Palette,
  Download,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';
import { WALLPAPER_THEMES, WallpaperModal } from './WallpaperModal';
import { exportChatAndLedgerToCSV } from '../utils/csvExport';
import { exportLedgerToPDF } from '../utils/pdfExport';
import { RbacErrorCard } from './RbacErrorCard';

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isThinking: boolean;
  currency: Currency;
  activeAccountId: AccountId;
  role: UserRole;
  committedLogs?: CommittedExecutionLog[];
  onOpenPolicyModal?: () => void;
  onSwitchRole?: (newRole: UserRole) => void;
  wallpaperThemeId?: string;
  onSelectWallpaperTheme?: (themeId: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  onSendMessage,
  isThinking,
  currency,
  activeAccountId,
  role,
  committedLogs = [],
  onOpenPolicyModal,
  onSwitchRole,
  wallpaperThemeId,
  onSelectWallpaperTheme
}) => {
  const [inputValue, setInputValue] = useState('');
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [isWallpaperModalOpen, setIsWallpaperModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  
  // Theme state with localStorage fallback
  const [localThemeId, setLocalThemeId] = useState<string>(() => {
    return wallpaperThemeId || localStorage.getItem('parcelpilot_chat_wallpaper') || 'whatsapp-dark-doodle';
  });

  useEffect(() => {
    if (wallpaperThemeId) {
      setLocalThemeId(wallpaperThemeId);
    }
  }, [wallpaperThemeId]);

  const currentTheme = WALLPAPER_THEMES.find(t => t.id === localThemeId) || WALLPAPER_THEMES[0];

  const handleThemeChange = (newThemeId: string) => {
    setLocalThemeId(newThemeId);
    localStorage.setItem('parcelpilot_chat_wallpaper', newThemeId);
    if (onSelectWallpaperTheme) {
      onSelectWallpaperTheme(newThemeId);
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking]);

  const toggleToolExpand = (id: string) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadCSV = () => {
    try {
      setIsExporting(true);
      exportChatAndLedgerToCSV({
        messages,
        committedLogs,
        activeAccountId,
        role,
        currency
      });
      setTimeout(() => {
        setIsExporting(false);
      }, 700);
    } catch (err: any) {
      setIsExporting(false);
      alert(`Failed to export CSV report: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleDownloadPDF = () => {
    try {
      setIsExportingPDF(true);
      exportLedgerToPDF({
        logs: committedLogs,
        activeAccountId,
        role,
        currency,
        filterAccount: 'ALL',
        filterActionType: 'ALL'
      });
      setTimeout(() => {
        setIsExportingPDF(false);
      }, 700);
    } catch (err: any) {
      setIsExportingPDF(false);
      alert(`Failed to export PDF report: ${err?.message || 'Unknown error'}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isThinking) return;
    onSendMessage(inputValue);
    setInputValue('');
  };

  // WhatsApp-style message grouping by date/time periods
  const formatGroupHeader = (timestampStr: string): string => {
    try {
      if (!timestampStr) return 'MARCH 1, 2026 (REFERENCE CLOCK)';
      
      if (timestampStr.includes(':') && !timestampStr.includes('-') && !timestampStr.includes('T')) {
        return 'SNAPSHOT REF: 2026-03-01T00:00:00Z';
      }

      const d = new Date(timestampStr);
      if (isNaN(d.getTime())) return 'SNAPSHOT REF: 2026-03-01T00:00:00Z';

      return d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).toUpperCase();
    } catch {
      return 'MARCH 1, 2026 (REFERENCE CLOCK)';
    }
  };

  // Group messages chronologically with date separators
  interface MessageGroup {
    dateLabel: string;
    items: ChatMessage[];
  }

  const messageGroups: MessageGroup[] = [];
  messages.forEach((msg) => {
    const label = formatGroupHeader(msg.timestamp);
    const lastGroup = messageGroups[messageGroups.length - 1];
    if (lastGroup && lastGroup.dateLabel === label) {
      lastGroup.items.push(msg);
    } else {
      messageGroups.push({ dateLabel: label, items: [msg] });
    }
  });

  // Preset operational quick prompts for AegisOps
  const quickChips = [
    { 
      label: '⚡ 1. Cancel ORD-1001 (Notice -0.5h -> ₹4,200)', 
      text: 'We need to execute an emergency cancellation for consignment ORD-1001 on behalf of Northstar. Will this trigger a financial penalty under our enterprise terms?' 
    },
    { 
      label: '⚡ 2. Audit ORD-2002 (LumenWorks 4.5h -> 50% Credit)', 
      text: 'RoadRunner delayed shipment ORD-2002 significantly past the agreed dispatch window. Check carrier fault liability for LumenWorks and stage the contractual SLA reimbursement.' 
    },
    { 
      label: '⚡ 3. Anti-Snoop (LumenWorks querying ORD-1001)', 
      text: 'Pull up the bill of lading, route logs, and billing breakdown for freight record ORD-1001.' 
    },
    { 
      label: '⚡ 4. Defend ORD-3001 (Quarantine Policy v2)', 
      text: 'A customer support rep told Beacon Retail that historical Policy v2 grants a 60-minute grace window for zero-cost cancellations. Can we apply that waiver to order ORD-3001?' 
    },
    { 
      label: '⚡ 5. Ops Anomaly Radar (Carrier & SEV Outages)', 
      text: 'Execute a network-wide carrier performance audit. Highlight systemic bottleneck clusters and flag critical SEV-0/SEV-1 security and webhook outages across all tenant feeds.' 
    }
  ];

  const currentAccount = ACCOUNTS[activeAccountId];

  return (
    <div className={`flex-1 flex flex-col ${currentTheme.bgClass} ${currentTheme.patternClass} overflow-hidden relative font-sans transition-colors duration-300`}>
      
      {/* WALLPAPER & THEME CUSTOMIZATION MODAL */}
      <WallpaperModal
        isOpen={isWallpaperModalOpen}
        onClose={() => setIsWallpaperModalOpen(false)}
        activeThemeId={localThemeId}
        onSelectTheme={handleThemeChange}
      />

      {/* ACTIVE CHAT TOP BAR */}
      <div className="h-15 px-4 sm:px-6 bg-[#14161f]/95 backdrop-blur-md border-b border-white/10 flex items-center justify-between shrink-0 z-10 select-none">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600"
            >
              AO
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#14161f]" />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-white text-sm truncate">
                AegisOps Autonomous Engine
              </span>
              <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-mono uppercase font-bold shrink-0">
                Gemini 3.5 Flash
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono truncate">
              <span>Tenant: <strong className="text-amber-300">{currentAccount?.name || activeAccountId}</strong></span>
              <span>•</span>
              <span>Snapshot: <code className="text-amber-400 font-semibold">2026-08-16 11:00 IST</code></span>
            </div>
          </div>
        </div>

        {/* TOP RIGHT CONTEXT BUTTONS */}
        <div className="flex items-center space-x-2 text-slate-400">
          {/* DOWNLOAD PDF AUDIT REPORT */}
          <button
            onClick={handleDownloadPDF}
            id="btn-download-pdf"
            disabled={isExportingPDF}
            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 text-[11px] text-rose-300 hover:text-rose-200 font-mono flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
            title="Download formatted PDF report of committed ledger actions"
          >
            {isExportingPDF ? (
              <span className="w-3.5 h-3.5 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="font-semibold">{isExportingPDF ? 'PDF...' : 'PDF Report'}</span>
          </button>

          {/* DOWNLOAD CSV AUDIT REPORT */}
          <button
            onClick={handleDownloadCSV}
            id="btn-download-csv"
            disabled={isExporting}
            className="hidden sm:flex px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 text-[11px] text-emerald-300 hover:text-emerald-200 font-mono items-center gap-1.5 transition cursor-pointer disabled:opacity-50 shadow-sm"
            title="Download CSV report of current chat conversation and committed ledger actions"
          >
            {isExporting ? (
              <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="font-semibold">{isExporting ? 'Exporting...' : 'CSV'}</span>
          </button>

          {/* THEME & WALLPAPER SELECTOR TRIGGER */}
          <button
            onClick={() => setIsWallpaperModalOpen(true)}
            id="btn-chat-wallpaper"
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white font-mono flex items-center gap-1.5 transition cursor-pointer"
            title="Change Chat Wallpaper & Theme"
          >
            <Palette className="w-3.5 h-3.5" style={{ color: currentTheme.accentColor }} />
            <span className="hidden sm:inline">Wallpaper ({currentTheme.name.split(' ')[0]})</span>
          </button>

          {onOpenPolicyModal && (
            <button
              onClick={onOpenPolicyModal}
              id="btn-chat-policies"
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] text-slate-300 hover:text-white font-mono flex items-center gap-1 transition cursor-pointer"
              title="Inspect 3-Tier Governing Documents"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Policies</span>
            </button>
          )}
        </div>
      </div>

      {/* CHAT MESSAGES SCROLL CONTAINER WITH DATE GROUPING & SLIDE-IN ANIMATION */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {messageGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-4">
            
            {/* WHATSAPP STICKY DATE SEPARATOR PILL */}
            <div className="flex items-center justify-center my-2 select-none">
              <span className="px-3.5 py-1 rounded-full bg-[#1c202d]/95 border border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 shadow-md">
                {group.dateLabel}
              </span>
            </div>

            {/* MESSAGES IN GROUP */}
            {group.items.map((msg) => {
              const isUser = msg.sender === 'user';
              const isWarning = msg.isWarning;
              const isSuccess = msg.isSuccess;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300`}
                >
                  {/* MESSAGE BUBBLE */}
                  <div
                    className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed max-w-2xl shadow-lg relative ${
                      isUser
                        ? `${currentTheme.userBubbleClass} rounded-tr-xs`
                        : isWarning
                          ? 'bg-rose-950/50 border border-rose-500/40 text-rose-200 rounded-tl-xs space-y-2'
                          : isSuccess
                            ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200 rounded-tl-xs space-y-3'
                            : `${currentTheme.assistantBubbleClass} border rounded-tl-xs space-y-3`
                    }`}
                  >
                    {/* ASSISTANT HEADER BADGE IN COMPACT BUBBLE */}
                    {!isUser && (
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] font-mono font-semibold">
                        <span className="flex items-center gap-1.5 text-cyan-400">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>AegisOps Engine</span>
                          <span className="text-[9px] bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 px-1 py-0.2 rounded font-sans font-bold">
                            Gemini 3.5 Flash
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {msg.timestamp}
                        </span>
                      </div>
                    )}

                    {/* MESSAGE TEXT CONTENT */}
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {msg.text}
                    </div>

                    {/* RBAC SECURITY BOUNDARY INTERCEPT CARD */}
                    {msg.rbacError && (
                      <RbacErrorCard
                        targetId={msg.rbacError.requestedId}
                        sessionAccountId={msg.rbacError.sessionAccountId}
                        errorCode={msg.rbacError.errorCode}
                        message={msg.rbacError.message}
                        onSwitchToInternalOps={onSwitchRole ? () => onSwitchRole('internal_ops') : undefined}
                      />
                    )}

                    {/* USER MESSAGE TIME & DOUBLE BLUE TICKS */}
                    {isUser && (
                      <div className="flex items-center justify-end space-x-1 text-[10px] pt-1 font-mono text-emerald-200/80 select-none">
                        <span>{msg.timestamp}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
                      </div>
                    )}

                    {/* EXPANDABLE TOOL EXECUTION BADGES / OPERATION LOGS */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="pt-2 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold flex items-center gap-1">
                            <Terminal className="w-3 h-3 text-cyan-400" />
                            <span>Tool Execution ({msg.toolCalls.length} calls)</span>
                          </span>
                          <button
                            onClick={() => toggleToolExpand(msg.id)}
                            className="text-[10px] font-mono text-cyan-300 hover:text-white flex items-center space-x-1 cursor-pointer bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 px-2 py-0.5 rounded transition"
                          >
                            <span>{expandedTools[msg.id] ? 'Hide Tool JSON' : 'Show Tool JSON'}</span>
                            {expandedTools[msg.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>

                        {expandedTools[msg.id] && (
                          <div className="space-y-2 pt-1 font-mono text-[11px] animate-in fade-in duration-200">
                            {msg.toolCalls.map((tool, idx) => (
                              <div key={idx} className="p-3 rounded-lg bg-black/80 border border-cyan-500/20 space-y-2">
                                <div className="flex items-center justify-between text-cyan-300 font-bold">
                                  <span className="flex items-center gap-1.5">
                                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>{tool.name}</span>
                                    {tool.executionTimeMs !== undefined && (
                                      <span className="text-[9px] text-slate-500 font-normal">
                                        ({tool.executionTimeMs}ms)
                                      </span>
                                    )}
                                  </span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${
                                    tool.status === 'completed' 
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                                      : tool.status === 'failed'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  }`}>
                                    {tool.status}
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                                    Inputs (Parameters):
                                  </div>
                                  <pre className="text-[10px] text-slate-300 bg-slate-950/80 p-2 rounded border border-white/5 overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(tool.params, null, 2)}
                                  </pre>
                                </div>
                                {tool.result && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                                      Output (JSON):
                                    </div>
                                    <pre className="text-[10px] text-emerald-300 bg-emerald-950/30 p-2 rounded border border-emerald-500/20 overflow-x-auto whitespace-pre-wrap">
                                      {JSON.stringify(tool.result, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {tool.error && (
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider">
                                      Security / Execution Error:
                                    </div>
                                    <pre className="text-[10px] text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-500/20 overflow-x-auto whitespace-pre-wrap">
                                      {tool.error}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}

        {/* TYPING / THINKING INDICATOR */}
        {isThinking && (
          <div className="flex items-start space-x-2 max-w-3xl mx-auto animate-in fade-in duration-200">
            <div className="rounded-2xl rounded-tl-xs p-3.5 bg-[#202430] border border-cyan-500/30 shadow-lg flex items-center space-x-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
              <span className="text-xs font-mono text-cyan-300">Gemini 3.5 Flash Tool Execution &amp; Precedence Audit</span>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK PRESET PROMPT CHIPS */}
      <div className="px-4 py-2 bg-[#12141c]/90 border-t border-white/5 overflow-x-auto shrink-0 flex items-center space-x-2 z-10 select-none">
        <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 shrink-0 font-bold flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Quick:</span>
        </span>
        <div className="flex items-center space-x-2 whitespace-nowrap">
          {quickChips.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(chip.text)}
              disabled={isThinking}
              className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 text-[11px] text-slate-300 hover:text-emerald-300 font-mono transition cursor-pointer disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* WHATSAPP BOTTOM INPUT FORM */}
      <div className="p-3 sm:px-6 bg-[#181a24] border-t border-white/10 shrink-0 z-10">
        <form
          onSubmit={handleSubmit}
          className="max-w-4xl mx-auto flex items-center space-x-2.5"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type an order ID, cancellation notice, or policy dispute..."
              disabled={isThinking}
              className="w-full bg-[#242735] border border-white/10 focus:border-emerald-500/80 rounded-2xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-400 outline-none transition font-sans"
            />
          </div>

          <button
            type="submit"
            disabled={!inputValue.trim() || isThinking}
            className="w-11 h-11 rounded-full text-slate-950 font-bold transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center shrink-0"
            style={{ backgroundColor: currentTheme.accentColor }}
            title="Send Query"
          >
            {isThinking ? (
              <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
      </div>

    </div>
  );
};
