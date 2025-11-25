
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  AppView, 
  VoiceConfig 
} from './types';
import Sidebar from './components/Sidebar';
import { 
  editImage, 
  generateSpeech, 
  sendMessage,
  transcribeAudio
} from './services/geminiService';
import { 
  Download, 
  Loader2, 
  Upload, 
  Play, 
  Pause, 
  Wand2,
  Mic,
  Send,
  MapPin,
  Search,
  BrainCircuit,
  Zap,
  Paperclip,
  MessageSquare
} from 'lucide-react';

// Predefined voices mapping with creative aliases
const VOICES: VoiceConfig[] = [
  { name: 'Sam (Casual)', id: 'Puck', gender: 'Male' },
  { name: 'Dr. Scientist', id: 'Fenrir', gender: 'Male' },
  { name: 'Sarah (Soft)', id: 'Kore', gender: 'Female' },
  { name: 'Narrator (Deep)', id: 'Charon', gender: 'Male' },
  { name: 'Assistant (Clear)', id: 'Zephyr', gender: 'Female' },
];

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Chat State ---
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatModel, setChatModel] = useState('gemini-2.5-flash-lite');
  const [chatThinking, setChatThinking] = useState(false);
  const [chatSearch, setChatSearch] = useState(false);
  const [chatMaps, setChatMaps] = useState(false);
  const [chatImageAttachment, setChatImageAttachment] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Image Editor State ---
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editedImageUrl, setEditedImageUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<'upscale' | 'removeBg' | 'custom'>('custom');
  const [customEditPrompt, setCustomEditPrompt] = useState('');

  // --- TTS State ---
  const [ttsText, setTtsText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // --- Helpers ---
  const scrollToBottom = () => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [chatMessages]);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // --- Chat Handlers ---
  const handleSendMessage = async () => {
    if (!chatInput.trim() && !chatImageAttachment) return;

    const newUserMsg = { role: 'user', text: chatInput, image: chatImageAttachment };
    setChatMessages(prev => [...prev, newUserMsg]);
    setChatInput('');
    setChatImageAttachment(null);
    setIsLoading(true);

    try {
      const response = await sendMessage({
        message: newUserMsg.text,
        history: chatMessages.map(m => ({ 
            role: m.role, 
            parts: [{ text: m.text }] // Simplified history
        })),
        images: newUserMsg.image ? [newUserMsg.image] : [],
        model: chatModel,
        useSearch: chatSearch,
        useMaps: chatMaps,
        thinking: chatThinking
      });

      setChatMessages(prev => [...prev, { 
          role: 'model', 
          text: response.text, 
          grounding: response.grounding 
      }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranscribe = async () => {
    try {
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Audio recording is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: BlobPart[] = [];
        
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64 = (reader.result as string).split(',')[1];
                setIsLoading(true);
                try {
                    const text = await transcribeAudio(base64);
                    setChatInput(prev => prev + " " + text);
                } finally {
                    setIsLoading(false);
                }
            }
            stream.getTracks().forEach(t => t.stop());
        };

        mediaRecorder.start();
        setTimeout(() => mediaRecorder.stop(), 5000); // Record for 5 seconds
    } catch (e: any) {
        console.error(e);
        if (e.name === 'NotFoundError' || e.message?.includes('device not found')) {
            setError("No microphone found. Please connect a microphone.");
        } else if (e.name === 'NotAllowedError') {
            setError("Microphone access denied. Please allow permissions.");
        } else {
            setError("Microphone error: " + (e.message || "Unknown error"));
        }
    }
  };

  const handleChatImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
          const base64 = await fileToBase64(e.target.files[0]);
          setChatImageAttachment(base64);
      }
  }

  // --- Existing Handlers (Refined) ---

  const handleEditImage = async () => {
    if (!selectedFile) return;
    setEditedImageUrl(null); // Clear previous result
    setIsLoading(true);
    try {
      const base64 = await fileToBase64(selectedFile);
      let prompt = "";
      if (editMode === 'upscale') {
        prompt = "Upscale this image to high resolution 4K, sharpen details, improve quality.";
      } else if (editMode === 'removeBg') {
        prompt = "Remove the background from this image, make it transparent.";
      } else {
        prompt = customEditPrompt;
      }
      const url = await editImage(base64, selectedFile.type, prompt);
      setEditedImageUrl(url);
    } catch (err) {
      setError("Failed to edit image.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSpeech = async () => {
    if (!ttsText) return;
    setIsLoading(true);
    setAudioBuffer(null);
    setError(null);
    try {
      // Pass the voice ID (which maps to Gemini Voice Name)
      const buffer = await generateSpeech(ttsText, selectedVoice.id);
      setAudioBuffer(buffer);
    } catch (err) {
      console.error(err);
      setError("Failed to generate speech. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAudioPlayback = useCallback(() => {
    if (!audioBuffer) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (isPlaying) {
      sourceNodeRef.current?.stop();
      setIsPlaying(false);
    } else {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlaying(false);
      source.start();
      sourceNodeRef.current = source;
      setIsPlaying(true);
    }
  }, [audioBuffer, isPlaying]);

  // --- Renders ---

  const renderChat = () => (
      <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
              <h2 className="text-xl font-bold flex items-center gap-2">
                  <BrainCircuit className="text-brand-500"/> Gemini Intelligence
              </h2>
              <div className="flex gap-2">
                  <button 
                    onClick={() => { setChatModel('gemini-2.5-flash-lite'); setChatThinking(false); }}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${chatModel === 'gemini-2.5-flash-lite' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400' : 'border-slate-700 text-slate-500'}`}
                  >
                      <Zap size={12} className="inline mr-1"/> Flash Lite (Fast)
                  </button>
                  <button 
                    onClick={() => { setChatModel('gemini-3-pro-preview'); setChatThinking(false); }}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${chatModel === 'gemini-3-pro-preview' && !chatThinking ? 'bg-brand-500/20 border-brand-500 text-brand-400' : 'border-slate-700 text-slate-500'}`}
                  >
                      Pro
                  </button>
                   <button 
                    onClick={() => { setChatThinking(!chatThinking); setChatModel('gemini-3-pro-preview'); }}
                    className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${chatThinking ? 'bg-purple-500/20 border-purple-500 text-purple-400' : 'border-slate-700 text-slate-500'}`}
                  >
                      Thinking Mode
                  </button>
              </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
              {chatMessages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                      <MessageSquare size={48} className="mb-4"/>
                      <p>Ask anything. Use tools. Be creative.</p>
                  </div>
              )}
              {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
                          {msg.image && (
                              <img src={`data:image/png;base64,${msg.image}`} alt="attachment" className="w-48 rounded-lg mb-2 border border-white/20"/>
                          )}
                          <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                          {msg.grounding && (
                              <div className="mt-3 pt-3 border-t border-white/10 space-y-1">
                                  {msg.grounding.map((chunk: any, i: number) => {
                                      if (chunk.web?.uri) {
                                          return <a key={i} href={chunk.web.uri} target="_blank" rel="noreferrer" className="block text-xs text-blue-300 hover:underline truncate"><Search size={10} className="inline mr-1"/>{chunk.web.title}</a>
                                      }
                                      if (chunk.maps?.placeId) {
                                          return <div key={i} className="text-xs text-green-300"><MapPin size={10} className="inline mr-1"/> Map Result</div>
                                      }
                                      return null;
                                  })}
                              </div>
                          )}
                      </div>
                  </div>
              ))}
              <div ref={chatEndRef} />
          </div>

          <div className="bg-slate-800 p-2 rounded-xl border border-slate-700">
              {chatImageAttachment && (
                  <div className="px-4 py-2 flex items-center justify-between bg-slate-700/50 rounded-lg mb-2">
                      <span className="text-xs text-slate-300">Image attached</span>
                      <button onClick={() => setChatImageAttachment(null)} className="text-slate-400 hover:text-white">x</button>
                  </div>
              )}
              <div className="flex items-center gap-2 px-2">
                  <div className="flex gap-1">
                      <label className="p-2 hover:bg-slate-700 rounded-lg cursor-pointer text-slate-400 hover:text-white transition-colors">
                          <input type="file" accept="image/*" className="hidden" onChange={handleChatImageSelect}/>
                          <Paperclip size={20}/>
                      </label>
                      <button 
                        onClick={() => setChatSearch(!chatSearch)}
                        className={`p-2 rounded-lg transition-colors ${chatSearch ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:bg-slate-700'}`}
                      >
                          <Search size={20}/>
                      </button>
                      <button 
                        onClick={() => setChatMaps(!chatMaps)}
                        className={`p-2 rounded-lg transition-colors ${chatMaps ? 'bg-green-500/20 text-green-400' : 'text-slate-400 hover:bg-slate-700'}`}
                      >
                          <MapPin size={20}/>
                      </button>
                      <button 
                        onClick={handleTranscribe}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Hold to record (5s)"
                      >
                          <Mic size={20}/>
                      </button>
                  </div>
                  <input 
                      className="flex-1 bg-transparent border-0 focus:ring-0 text-white placeholder-slate-500"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <button 
                      onClick={handleSendMessage} 
                      disabled={isLoading || (!chatInput && !chatImageAttachment)}
                      className="p-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg disabled:opacity-50 transition-colors"
                  >
                      {isLoading ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>}
                  </button>
              </div>
          </div>
      </div>
  );

  const renderImageEditor = () => (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Magic Editor (Nano Banana)</h2>
        <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
          <button 
            onClick={() => setEditMode('custom')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editMode === 'custom' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Text Edit
          </button>
          <button 
            onClick={() => setEditMode('upscale')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editMode === 'upscale' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Upscale
          </button>
          <button 
            onClick={() => setEditMode('removeBg')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${editMode === 'removeBg' ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            BG Remover
          </button>
        </div>
      </div>

      {!selectedFile ? (
        <div className="border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-2xl p-12 text-center transition-colors bg-slate-800/20">
          <input 
            type="file" 
            accept="image/*" 
            onChange={(e) => {
                if (e.target.files?.[0]) {
                    setSelectedFile(e.target.files[0]);
                    setPreviewUrl(URL.createObjectURL(e.target.files[0]));
                    setEditedImageUrl(null);
                }
            }} 
            className="hidden" 
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 text-brand-500">
              <Upload size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload an image</h3>
            <p className="text-slate-400">PNG, JPG up to 10MB</p>
          </label>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
               <div className="flex justify-between">
                  <span className="text-sm text-slate-400 font-medium">Original</span>
                  <button onClick={() => { setSelectedFile(null); setPreviewUrl(null); setEditedImageUrl(null); }} className="text-xs text-red-400 hover:text-red-300">Remove</button>
               </div>
               <img src={previewUrl!} alt="Original" className="w-full h-64 object-contain bg-slate-800 rounded-xl" />
            </div>
            <div className="space-y-2">
               <span className="text-sm text-slate-400 font-medium">Result</span>
               <div className="w-full h-64 bg-slate-800 rounded-xl flex items-center justify-center relative group">
                  {editedImageUrl ? (
                    <>
                      <img src={editedImageUrl} alt="Edited" className="w-full h-full object-contain" />
                      <button 
                        onClick={() => handleDownload(editedImageUrl!, `talha-ai-edit-${Date.now()}.png`)}
                        className="absolute bottom-4 right-4 bg-brand-600 hover:bg-brand-500 text-white p-2 rounded-lg shadow-lg"
                      >
                        <Download size={20} />
                      </button>
                    </>
                  ) : (
                    <div className="text-slate-500 flex flex-col items-center">
                       {isLoading ? <Loader2 className="animate-spin mb-2" /> : <Wand2 className="mb-2" />}
                       <span>{isLoading ? 'Processing...' : 'AI Magic awaits'}</span>
                    </div>
                  )}
               </div>
            </div>
          </div>

          <div className="bg-slate-800 p-4 rounded-xl flex gap-3">
             {editMode === 'custom' && (
                <input 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                  placeholder="Describe how to change the image (e.g., 'Make it snowy', 'Add a cat')"
                  value={customEditPrompt}
                  onChange={(e) => setCustomEditPrompt(e.target.value)}
                />
             )}
             <button 
               onClick={handleEditImage}
               disabled={isLoading || (editMode === 'custom' && !customEditPrompt)}
               className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
             >
                {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
                Generate
             </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderTTS = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">AI Voice Clone & TTS</h2>
        <p className="text-slate-400">Convert text to lifelike speech with our premium voice engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="md:col-span-2 space-y-4">
            <textarea 
              className="w-full h-48 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none transition-all"
              placeholder="Enter text to generate speech..."
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
            />
            
            <button 
              onClick={handleGenerateSpeech}
              disabled={isLoading || !ttsText}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white py-3 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
               {isLoading ? <Loader2 className="animate-spin" /> : <Mic />}
               Generate Speech
            </button>
         </div>

         <div className="space-y-4">
            <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
               <h3 className="text-sm font-bold text-slate-300 mb-3 uppercase tracking-wider">Voice Selection</h3>
               <div className="space-y-2">
                  {VOICES.map(voice => (
                     <button
                       key={voice.id}
                       onClick={() => setSelectedVoice(voice)}
                       className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between transition-colors ${
                         selectedVoice.id === voice.id 
                           ? 'bg-brand-600 text-white shadow-md' 
                           : 'hover:bg-slate-700 text-slate-300'
                       }`}
                     >
                        <span>{voice.name}</span>
                        <span className="text-[10px] opacity-70 bg-black/20 px-1.5 py-0.5 rounded">{voice.gender}</span>
                     </button>
                  ))}
               </div>
            </div>

            {audioBuffer && (
               <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-4 flex flex-col items-center justify-center animate-in fade-in duration-500">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2 shadow-lg shadow-green-900/50">
                     <Mic className="text-white" size={24} />
                  </div>
                  <p className="text-green-400 font-medium text-sm mb-3">Audio Generated!</p>
                  <button 
                    onClick={toggleAudioPlayback}
                    className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-6 py-2 rounded-full font-bold transition-all hover:scale-105 active:scale-95"
                  >
                     {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                     {isPlaying ? 'Pause' : 'Play Audio'}
                  </button>
               </div>
            )}
         </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} />
      
      <main className="flex-1 flex flex-col h-full relative overflow-hidden">
        {/* Header mobile */}
        <header className="md:hidden h-16 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/50 backdrop-blur-sm z-10">
           <span className="font-bold text-lg text-white">Talha AI</span>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
           {currentView === AppView.CHAT && renderChat()}
           {currentView === AppView.IMAGE_EDITOR && renderImageEditor()}
           {currentView === AppView.TEXT_TO_SPEECH && renderTTS()}
        </div>

        {/* Global Error Toast */}
        {error && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50 backdrop-blur-md">
                <span>{error}</span>
                <button onClick={() => setError(null)} className="hover:bg-black/20 rounded-full p-1"><span className="sr-only">Close</span>x</button>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
