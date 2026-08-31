import React from 'react';
import { 
  X, 
  Palette, 
  Check, 
  Sparkles, 
  Eye, 
  SunMedium, 
  Moon, 
  Layers, 
  Grid,
  CheckCheck
} from 'lucide-react';

export interface WallpaperTheme {
  id: string;
  name: string;
  category: 'Dark' | 'WhatsApp Classic' | 'Vibrant' | 'Minimalist';
  description: string;
  bgClass: string;
  patternClass: string;
  userBubbleClass: string;
  assistantBubbleClass: string;
  previewGradient: string;
  accentColor: string;
}

export const WALLPAPER_THEMES: WallpaperTheme[] = [
  {
    id: 'whatsapp-dark-doodle',
    name: 'WhatsApp Dark Doodle',
    category: 'WhatsApp Classic',
    description: 'Authentic WhatsApp dark theme with subtle iconic chat doodle background',
    bgClass: 'bg-[#0b141a]',
    patternClass: 'bg-[radial-gradient(#1f2c34_1.5px,transparent_1.5px)] [background-size:20px_20px]',
    userBubbleClass: 'bg-[#005c4b] text-white shadow-emerald-950/40',
    assistantBubbleClass: 'bg-[#202c33] border-white/10 text-slate-100 shadow-black/40',
    previewGradient: 'from-[#0b141a] via-[#111b21] to-[#005c4b]',
    accentColor: '#00a884'
  },
  {
    id: 'whatsapp-emerald',
    name: 'WhatsApp Emerald',
    category: 'WhatsApp Classic',
    description: 'Deep forest green luxury palette with refined emerald accents',
    bgClass: 'bg-[#061814]',
    patternClass: 'bg-[radial-gradient(#0f382c_1.5px,transparent_1.5px)] [background-size:24px_24px]',
    userBubbleClass: 'bg-[#047857] text-white shadow-emerald-950/50',
    assistantBubbleClass: 'bg-[#0e2c24] border-emerald-500/20 text-slate-100 shadow-emerald-950/30',
    previewGradient: 'from-[#061814] via-[#0b2b22] to-[#059669]',
    accentColor: '#10b981'
  },
  {
    id: 'midnight-navy',
    name: 'Midnight Blueprint',
    category: 'Dark',
    description: 'Deep celestial navy with subtle geometric coordinate grid',
    bgClass: 'bg-[#080d1a]',
    patternClass: 'bg-[linear-gradient(to_right,#131f37_1px,transparent_1px),linear-gradient(to_bottom,#131f37_1px,transparent_1px)] [background-size:24px_24px]',
    userBubbleClass: 'bg-[#1d4ed8] text-white shadow-blue-950/50',
    assistantBubbleClass: 'bg-[#131b2e] border-blue-500/20 text-slate-100 shadow-black/40',
    previewGradient: 'from-[#080d1a] via-[#0f172a] to-[#2563eb]',
    accentColor: '#3b82f6'
  },
  {
    id: 'obsidian-oled',
    name: 'Obsidian OLED Black',
    category: 'Minimalist',
    description: 'Ultra-clean pure black theme with high-contrast subtle borders',
    bgClass: 'bg-[#000000]',
    patternClass: 'bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px]',
    userBubbleClass: 'bg-[#18181b] border border-zinc-700 text-zinc-100 shadow-zinc-950/50',
    assistantBubbleClass: 'bg-[#09090b] border border-zinc-800 text-zinc-200 shadow-black/60',
    previewGradient: 'from-[#000000] via-[#09090b] to-[#27272a]',
    accentColor: '#e4e4e7'
  },
  {
    id: 'cyber-violet',
    name: 'Cyber Violet Nebula',
    category: 'Vibrant',
    description: 'Atmospheric deep purple with subtle violet stardust texture',
    bgClass: 'bg-[#0c0817]',
    patternClass: 'bg-[radial-gradient(#2d1b4e_1.5px,transparent_1.5px)] [background-size:22px_22px]',
    userBubbleClass: 'bg-[#7c3aed] text-white shadow-purple-950/50',
    assistantBubbleClass: 'bg-[#1c1230] border-purple-500/20 text-purple-100 shadow-black/40',
    previewGradient: 'from-[#0c0817] via-[#1e1035] to-[#9333ea]',
    accentColor: '#a855f7'
  },
  {
    id: 'warm-espresso',
    name: 'Warm Espresso & Amber',
    category: 'Dark',
    description: 'Cozy dark roasted coffee tone with golden amber accents',
    bgClass: 'bg-[#120d0a]',
    patternClass: 'bg-[radial-gradient(#2b1d14_1.5px,transparent_1.5px)] [background-size:20px_20px]',
    userBubbleClass: 'bg-[#b45309] text-white shadow-amber-950/50',
    assistantBubbleClass: 'bg-[#1f1610] border-amber-500/20 text-amber-100 shadow-black/40',
    previewGradient: 'from-[#120d0a] via-[#21160f] to-[#d97706]',
    accentColor: '#f59e0b'
  },
  {
    id: 'carbon-graphite',
    name: 'Carbon Industrial Slate',
    category: 'Minimalist',
    description: 'Modern developer slate with technical dot matrix pattern',
    bgClass: 'bg-[#0e1117]',
    patternClass: 'bg-[radial-gradient(#262f3d_1.5px,transparent_1.5px)] [background-size:18px_18px]',
    userBubbleClass: 'bg-[#0f766e] text-white shadow-teal-950/40',
    assistantBubbleClass: 'bg-[#18202c] border-slate-700/40 text-slate-100 shadow-black/40',
    previewGradient: 'from-[#0e1117] via-[#1a2332] to-[#0d9488]',
    accentColor: '#14b8a6'
  },
  {
    id: 'crimson-noir',
    name: 'Crimson Noir',
    category: 'Vibrant',
    description: 'Deep ruby dark aesthetic for high-alert operational command',
    bgClass: 'bg-[#14080b]',
    patternClass: 'bg-[radial-gradient(#38121a_1.5px,transparent_1.5px)] [background-size:22px_22px]',
    userBubbleClass: 'bg-[#be123c] text-white shadow-rose-950/50',
    assistantBubbleClass: 'bg-[#220d13] border-rose-500/20 text-rose-100 shadow-black/40',
    previewGradient: 'from-[#14080b] via-[#240c13] to-[#e11d48]',
    accentColor: '#f43f5e'
  }
];

interface WallpaperModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeThemeId: string;
  onSelectTheme: (themeId: string) => void;
}

export const WallpaperModal: React.FC<WallpaperModalProps> = ({
  isOpen,
  onClose,
  activeThemeId,
  onSelectTheme
}) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('All');
  const [previewThemeId, setPreviewThemeId] = React.useState<string>(activeThemeId);

  React.useEffect(() => {
    setPreviewThemeId(activeThemeId);
  }, [activeThemeId, isOpen]);

  if (!isOpen) return null;

  const categories = ['All', 'WhatsApp Classic', 'Dark', 'Minimalist', 'Vibrant'];

  const filteredThemes = selectedCategory === 'All' 
    ? WALLPAPER_THEMES 
    : WALLPAPER_THEMES.filter(t => t.category === selectedCategory);

  const previewTheme = WALLPAPER_THEMES.find(t => t.id === previewThemeId) || WALLPAPER_THEMES[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 select-none font-sans">
      <div className="bg-[#12141c] border border-white/15 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-[#161923] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Chat Wallpaper &amp; Theme Customization</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
                  WhatsApp Style
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Choose background textures, bubble colors, and contrast themes for your support console
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (TWO PANES: SELECTOR & LIVE PREVIEW) */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT: THEME CARDS LIST (7 COLS) */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* CATEGORY FILTER PILLS */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs font-mono">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full transition whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-sm'
                      : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* THEME GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredThemes.map((theme) => {
                const isActive = activeThemeId === theme.id;
                const isHoverPreview = previewThemeId === theme.id;

                return (
                  <div
                    key={theme.id}
                    onClick={() => {
                      setPreviewThemeId(theme.id);
                      onSelectTheme(theme.id);
                    }}
                    onMouseEnter={() => setPreviewThemeId(theme.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                      isActive
                        ? 'border-emerald-400 bg-[#1a1f2c] shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400'
                        : isHoverPreview
                          ? 'border-white/30 bg-[#161a24]'
                          : 'border-white/10 bg-[#141620] hover:border-white/20'
                    }`}
                  >
                    {/* COLOR GRADIENT PREVIEW BAR */}
                    <div className={`h-12 w-full rounded-xl bg-gradient-to-r ${theme.previewGradient} mb-2.5 flex items-center justify-between px-3 shadow-inner relative overflow-hidden`}>
                      <span className="text-[10px] font-mono uppercase font-bold text-white/90 drop-shadow">
                        {theme.category}
                      </span>
                      {isActive && (
                        <div className="w-5 h-5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-white flex items-center justify-between">
                        <span>{theme.name}</span>
                        <span 
                          className="w-2.5 h-2.5 rounded-full border border-white/20" 
                          style={{ backgroundColor: theme.accentColor }} 
                        />
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {theme.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: LIVE INTERACTIVE PREVIEW SCREEN (5 COLS) */}
          <div className="lg:col-span-5 flex flex-col">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-xs font-mono uppercase font-bold text-slate-400 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Interactive Preview</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                {previewTheme.name}
              </span>
            </div>

            {/* PHONE / CHAT PREVIEW CONTAINER */}
            <div className={`flex-1 rounded-3xl border border-white/20 overflow-hidden flex flex-col shadow-2xl relative min-h-[340px] ${previewTheme.bgClass} ${previewTheme.patternClass}`}>
              
              {/* TOP SLIM HEADER */}
              <div className="h-12 px-3 bg-black/40 backdrop-blur-md border-b border-white/10 flex items-center space-x-2 shrink-0">
                <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center text-xs text-slate-950 font-bold">
                  🤖
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white">ParcelPilot Support</span>
                  <span className="text-[9px] text-emerald-400 font-mono">online • 3-Tier Precedence</span>
                </div>
              </div>

              {/* CHAT MESSAGES PREVIEW */}
              <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs font-sans">
                
                {/* DATE SEPARATOR */}
                <div className="flex justify-center my-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-black/50 border border-white/10 text-[9px] font-mono text-slate-300">
                    TODAY • AUGUST 16, 2026
                  </span>
                </div>

                {/* USER BUBBLE */}
                <div className="flex flex-col items-end">
                  <div className={`rounded-2xl rounded-tr-xs p-3 text-xs leading-relaxed max-w-[85%] shadow-md ${previewTheme.userBubbleClass}`}>
                    <p>Audit delay for order ORD-1001 under Northstar Enterprise Agreement Clause 4.2.</p>
                    <div className="flex items-center justify-end space-x-1 text-[9px] pt-1 opacity-80 font-mono">
                      <span>11:00 AM</span>
                      <CheckCheck className="w-3 h-3 text-sky-300" />
                    </div>
                  </div>
                </div>

                {/* ASSISTANT BUBBLE */}
                <div className="flex flex-col items-start">
                  <div className={`rounded-2xl rounded-tl-xs p-3 text-xs leading-relaxed max-w-[85%] border shadow-md space-y-1.5 ${previewTheme.assistantBubbleClass}`}>
                    <div className="text-[10px] font-mono font-bold text-amber-300 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>ParcelPilot Engine</span>
                    </div>
                    <p>
                      Carrier delay is 2.5 hours ($\ge 2.0$h). Northstar **Clause 4.2 [Tier 1]** applies: 100% Service Credit staged.
                    </p>
                    <div className="text-[9px] opacity-70 font-mono text-right">
                      11:00 AM
                    </div>
                  </div>
                </div>

              </div>

              {/* BOTTOM SLIM INPUT PREVIEW */}
              <div className="p-2 bg-black/40 backdrop-blur-md border-t border-white/10 flex items-center space-x-2 shrink-0">
                <div className="flex-1 bg-white/10 rounded-full px-3 py-1.5 text-[10px] text-slate-400 font-sans">
                  Type a message...
                </div>
                <div 
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-slate-950 font-bold shadow"
                  style={{ backgroundColor: previewTheme.accentColor }}
                >
                  ➤
                </div>
              </div>

            </div>

            {/* CONFIRM / APPLY BUTTON */}
            <div className="pt-4 flex items-center space-x-2">
              <button
                onClick={() => {
                  onSelectTheme(previewTheme.id);
                  onClose();
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-mono font-bold uppercase transition shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Apply {previewTheme.name}</span>
              </button>
            </div>

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3 bg-[#161923] border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono shrink-0">
          <span>Theme settings are persistently saved to your local session</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
