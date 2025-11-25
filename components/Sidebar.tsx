
import React from 'react';
import { AppView } from '../types';
import { 
  Wand2, 
  Mic, 
  Sparkles,
  Aperture,
  MessageSquare
} from 'lucide-react';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange }) => {
  
  const navItems = [
    { 
      id: AppView.CHAT, 
      label: 'AI Chat Assistant', 
      icon: <MessageSquare size={20} />,
      desc: 'Ask, Search, Analyze'
    },
    { 
      id: AppView.IMAGE_EDITOR, 
      label: 'Magic Editor', 
      icon: <Wand2 size={20} />,
      desc: 'Edit, Upscale, Remove BG'
    },
    { 
      id: AppView.TEXT_TO_SPEECH, 
      label: 'AI Voice Clone', 
      icon: <Mic size={20} />,
      desc: 'Realistic TTS'
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full hidden md:flex shrink-0">
      <div className="p-6 border-b border-slate-700 flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Aperture className="text-white" />
        </div>
        <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Talha AI</h1>
            <span className="text-xs text-brand-500 font-medium bg-brand-500/10 px-2 py-0.5 rounded-full">ULTIMATE</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 text-left group ${
              currentView === item.id 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-900/50' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <div className={`${currentView === item.id ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>
                {item.icon}
            </div>
            <div>
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-[10px] opacity-70">{item.desc}</div>
            </div>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="bg-slate-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2 text-yellow-400">
                <Sparkles size={16} />
                <span className="text-xs font-bold uppercase">Free to use</span>
            </div>
            <p className="text-xs text-slate-400">Powered by Gemini 2.5 Flash, 3 Pro</p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
