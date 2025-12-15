import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  ConnectionState, 
  ChatMessage, 
  MessageRole, 
} from './types';
import { MODEL_NAME, getSystemInstruction } from './constants';
import { 
  createAudioBlob, 
  decodeAudioData, 
  base64ToUint8Array 
} from './utils/audioUtils';
import AudioVisualizer from './components/AudioVisualizer';
import LanguageSelector from './components/LanguageSelector';
import ChatMessageBubble from './components/ChatMessageBubble';

const App: React.FC = () => {
  // --- State ---
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourceLang, setSourceLang] = useState('vi');
  const [targetLang, setTargetLang] = useState('en');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false); // Controls "Voice" output
  const [error, setError] = useState<string | null>(null);

  // --- Refs ---
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Audio Contexts & Processing
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Transcription Buffers
  const currentInputTransRef = useRef<string>('');
  const currentOutputTransRef = useRef<string>('');

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- Audio Setup ---
  const setupAudioContexts = () => {
    if (!inputContextRef.current) {
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!outputContextRef.current) {
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  };

  const stopAudio = useCallback(() => {
    // Stop all playing sources
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    // Disconnect Mic
    if (mediaStreamSourceRef.current) {
      mediaStreamSourceRef.current.disconnect();
      mediaStreamSourceRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    
    // Close Input Context (to release mic)
    if (inputContextRef.current?.state !== 'closed') {
      inputContextRef.current?.close();
      inputContextRef.current = null;
    }
    
    // Reset output timing
    if (outputContextRef.current) {
      nextStartTimeRef.current = outputContextRef.current.currentTime;
    }
  }, []);

  // --- Logic ---
  const swapLanguages = () => {
    if (connectionState !== 'disconnected') return;
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  const connect = async () => {
    if (!process.env.API_KEY) {
      setError("Missing API Key in environment variables.");
      return;
    }

    setConnectionState('connecting');
    setError(null);
    setupAudioContexts();

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      // Get User Media
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const config = {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
        },
        systemInstruction: getSystemInstruction(
          sourceLang, 
          targetLang
        ),
        inputAudioTranscription: { model: MODEL_NAME }, 
        outputAudioTranscription: { model: MODEL_NAME }, 
      };

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: config,
        callbacks: {
          onopen: async () => {
            setConnectionState('connected');
            
            // Connect Mic Stream to Processor
            if (inputContextRef.current) {
              await inputContextRef.current.resume();
              
              const source = inputContextRef.current.createMediaStreamSource(stream);
              mediaStreamSourceRef.current = source;
              
              const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current = processor;

              processor.onaudioprocess = (e) => {
                if (isMicMuted) return; 

                const inputData = e.inputBuffer.getChannelData(0);
                const blob = createAudioBlob(inputData);
                
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: blob });
                });
              };

              source.connect(processor);
              processor.connect(inputContextRef.current.destination);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            const { serverContent } = msg;

            // Handle Streaming Transcription updates
            if (serverContent?.inputTranscription) {
               const text = serverContent.inputTranscription.text;
               if (text) {
                 currentInputTransRef.current += text;
                 updateLastMessage(MessageRole.USER, currentInputTransRef.current, false);
               }
            }

            if (serverContent?.outputTranscription) {
               const text = serverContent.outputTranscription.text;
               if (text) {
                 currentOutputTransRef.current += text;
                 updateLastMessage(MessageRole.MODEL, currentOutputTransRef.current, false);
               }
            }

            // Turn Complete
            if (serverContent?.turnComplete) {
              if (currentInputTransRef.current) {
                 updateLastMessage(MessageRole.USER, currentInputTransRef.current, true);
                 currentInputTransRef.current = '';
              }
              if (currentOutputTransRef.current) {
                 updateLastMessage(MessageRole.MODEL, currentOutputTransRef.current, true);
                 currentOutputTransRef.current = '';
              }
            }

            // Handle Audio Output
            // Only play if speaker is NOT muted
            const audioData = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && outputContextRef.current && !isSpeakerMuted) {
              try {
                const uint8Data = base64ToUint8Array(audioData);
                const audioBuffer = await decodeAudioData(uint8Data, outputContextRef.current);
                
                nextStartTimeRef.current = Math.max(
                  nextStartTimeRef.current,
                  outputContextRef.current.currentTime
                );

                const source = outputContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputContextRef.current.destination);
                
                source.addEventListener('ended', () => {
                  audioSourcesRef.current.delete(source);
                });

                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);

              } catch (e) {
                console.error("Error decoding audio", e);
              }
            }

            // Handle Interruptions
            if (serverContent?.interrupted) {
               audioSourcesRef.current.forEach(s => s.stop());
               audioSourcesRef.current.clear();
               nextStartTimeRef.current = outputContextRef.current?.currentTime || 0;
               
               if (currentOutputTransRef.current) {
                 updateLastMessage(MessageRole.MODEL, currentOutputTransRef.current + " [Interrupted]", true);
                 currentOutputTransRef.current = '';
               }
            }
          },
          onclose: () => {
            setConnectionState('disconnected');
            stopAudio();
          },
          onerror: (err) => {
            console.error(err);
            setConnectionState('error');
            setError("Connection error occurred.");
            stopAudio();
          }
        }
      });

      await sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to start session.");
      setConnectionState('disconnected');
      stopAudio();
    }
  };

  const disconnect = () => {
    stopAudio();
    setConnectionState('disconnected');
    window.location.reload(); 
  };

  const updateLastMessage = (role: MessageRole, text: string, isFinal: boolean) => {
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg && lastMsg.role === role && !lastMsg.isFinal) {
        return [...prev.slice(0, -1), { ...lastMsg, text, isFinal }];
      } 
      if (text.trim().length > 0) {
        return [...prev, {
          id: Date.now().toString(),
          role,
          text,
          isFinal,
          timestamp: Date.now()
        }];
      }
      return prev;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden font-sans">
      
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shadow-lg z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            Gemini Live Translate
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 ${
            connectionState === 'connected' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
            connectionState === 'connecting' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500 animate-pulse' :
              connectionState === 'connecting' ? 'bg-yellow-500 animate-bounce' :
              'bg-red-500'
            }`}></span>
            {connectionState.toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Settings Sidebar */}
        <aside className="w-full md:w-80 bg-gray-900 border-r border-gray-800 p-6 flex flex-col gap-6 z-20 shadow-xl">
            <div>
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <span className="text-blue-400">⚙️</span> Configuration
              </h2>
              
              <div className="flex flex-col gap-2">
                <LanguageSelector 
                  label="Language A (Source)" 
                  selectedCode={sourceLang} 
                  onSelect={setSourceLang}
                  disabled={connectionState === 'connected'}
                />
                
                <div className="flex items-center justify-center -my-2 z-10">
                  <button 
                    onClick={swapLanguages}
                    disabled={connectionState === 'connected'}
                    className="p-2 rounded-full bg-gray-800 border border-gray-700 text-blue-400 hover:bg-gray-700 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Swap Languages"
                  >
                    <svg className="w-5 h-5 rotate-90 md:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>

                <LanguageSelector 
                  label="Language B (Target)" 
                  selectedCode={targetLang} 
                  onSelect={setTargetLang}
                  disabled={connectionState === 'connected'}
                />
              </div>

              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                <p className="text-xs text-blue-200">
                  <span className="font-bold">✨ AI Enhanced:</span> Optimized for robustness against background noise and varied accents.
                </p>
              </div>
            </div>

            <div className="mt-auto pt-6 border-t border-gray-800">
               <div className="mb-4">
                 <p className="text-sm text-gray-400 mb-2">Audio Visualizer</p>
                 <AudioVisualizer isActive={connectionState === 'connected' && !isMicMuted} />
               </div>
               
               {error && (
                 <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm mb-4">
                   {error}
                 </div>
               )}

               {connectionState === 'disconnected' || connectionState === 'error' ? (
                 <button
                   onClick={connect}
                   className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg hover:shadow-blue-500/25 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center justify-center gap-2"
                 >
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                   Start Live Session
                 </button>
               ) : (
                 <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsMicMuted(!isMicMuted)}
                      className={`py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${isMicMuted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-gray-800 hover:bg-gray-700 text-white border border-gray-700'}`}
                    >
                      {isMicMuted ? (
                         <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" /></svg> Mic Off</>
                      ) : (
                         <><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg> Mic On</>
                      )}
                    </button>
                    <button
                      onClick={disconnect}
                      className="py-3 bg-gray-800 hover:bg-red-900/50 hover:text-red-400 border border-gray-700 hover:border-red-800 text-gray-300 rounded-lg font-medium transition-colors"
                    >
                      End
                    </button>
                 </div>
               )}
            </div>
        </aside>

        {/* Chat Area */}
        <section className="flex-1 flex flex-col h-full relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950 via-gray-900/90 to-gray-950 pointer-events-none"></div>
          
          <div className="flex-1 overflow-y-auto p-6 md:p-10 z-0 space-y-6 scroll-smooth">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 opacity-60">
                <div className="w-24 h-24 mb-6 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg className="w-12 h-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-xl font-light">Conversation history will appear here.</p>
                <p className="text-sm mt-2">Press 'Start Live Session' to begin.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatMessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Controls Overlay (Output Mode) */}
          {connectionState === 'connected' && (
             <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10">
               <div className="flex items-center gap-1 bg-gray-900/90 backdrop-blur-md p-1.5 rounded-full border border-gray-700 shadow-2xl">
                  <button 
                    onClick={() => setIsSpeakerMuted(false)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${!isSpeakerMuted ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    </svg>
                    Speech & Text
                  </button>
                  <button 
                    onClick={() => setIsSpeakerMuted(true)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${isSpeakerMuted ? 'bg-gray-700 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                    Text Only
                  </button>
               </div>
             </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;
