import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, BookOpen, Trash2, Bot, User, Loader2, ArrowRight, CornerDownLeft } from 'lucide-react';
import { API_BASE } from '../services/api';

export default function Chat() {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chat_history');
    return saved ? JSON.parse(saved) : [
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I am your AI College Assistant. I can help you search fees, compare placements, and look up details on RVCE, BMSCE, Christ, IIIT Bangalore, and IIT Bombay. Ask me anything!',
        sources: []
      }
    ];
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Suggested Prompts
  const suggestedPrompts = [
    'Compare RVCE and BMSCE placements',
    'What are the fees of Christ University?',
    'Tell me about IIIT Bangalore',
    'Which college has better placements?'
  ];

  // Save history
  useEffect(() => {
    localStorage.setItem('chat_history', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Simple custom markdown renderer helper
  const renderMarkdown = (text) => {
    if (!text) return '';
    // Escape HTML tags to prevent XSS
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-black/40 p-3 rounded-lg font-mono text-xs my-2 overflow-x-auto border border-gray-200/50 dark:border-white/5">$1</pre>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 dark:bg-black/30 px-1 py-0.5 rounded font-mono text-xs text-brand-accent">$1</code>');
    
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc my-1">$1</li>');
    
    // Newlines
    html = html.replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-sm leading-relaxed" />;
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text) return;

    setInput('');
    setLoading(true);

    const userMsg = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    const assistantMsgId = (Date.now() + 1).toString();
    // Add placeholder assistant response
    setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '', sources: [] }]);

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      if (!response.body) {
        throw new Error('No response body stream available');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = '';
      let parsedSources = [];
      let contentStarted = false;

      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        buffer += decoder.decode(value, { stream: !done });

        // Check if content marker is found
        if (!contentStarted && buffer.includes('\n[CONTENT_START]\n')) {
          const parts = buffer.split('\n[CONTENT_START]\n');
          const metaStr = parts[0];
          
          try {
            const parsedMeta = JSON.parse(metaStr);
            parsedSources = parsedMeta.sources || [];
          } catch (e) {
            console.error('Failed to parse sources metadata', e);
          }

          contentStarted = true;
          // Set streaming output to start with everything after CONTENT_START
          const contentText = parts.slice(1).join('\n[CONTENT_START]\n');
          
          setMessages(prev => prev.map(m => 
            m.id === assistantMsgId
              ? { ...m, content: contentText, sources: parsedSources }
              : m
          ));
          buffer = contentText;
        } else if (contentStarted) {
          // Streaming text chunks
          setMessages(prev => prev.map(m => 
            m.id === assistantMsgId
              ? { ...m, content: buffer }
              : m
          ));
        }
      }
    } catch (error) {
      console.error('Streaming failure:', error);
      setMessages(prev => prev.map(m => 
        m.id === assistantMsgId
          ? { ...m, content: 'Error: Failed to fetch reply from assistant. Make sure the backend server is running.' }
          : m
      ));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear all chat messages?')) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: 'Hello! I am your AI College Assistant. I can help you search fees, compare placements, and look up details on RVCE, BMSCE, Christ, IIIT Bangalore, and IIT Bombay. Ask me anything!',
          sources: []
        }
      ]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50 dark:bg-darkbg-base">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-gray-200/50 bg-white/50 px-6 py-4 dark:border-white/5 dark:bg-darkbg-card/30 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="text-brand-light dark:text-brand-accent animate-pulse" />
          <div>
            <h1 className="font-sans text-sm font-bold text-gray-900 dark:text-white">AI Search Chat</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">RAG (ChromaDB + Gemini v1.5)</p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          className="rounded-xl border border-gray-200 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:border-white/10 dark:hover:bg-red-500/10 transition-all"
          title="Clear chat history"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 p-5 border transition-all duration-200 ${
                  msg.role === 'assistant'
                    ? 'rounded-lg border-brand-light/10 bg-white dark:bg-darkbg-card/80 ai-glow dark:border-brand-light/10'
                    : 'rounded-3xl border-brand-light/15 bg-brand-light/5 dark:border-brand-accent/10 dark:bg-brand-accent/5'
                }`}
              >
                {/* Avatar Icon */}
                <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-xl text-gray-950 font-bold
                  ${msg.role === 'assistant' ? 'bg-gradient-to-r from-brand-light to-brand-accent' : 'bg-gray-300 dark:bg-gray-700 dark:text-white'}
                `}>
                  {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-hidden space-y-3 text-gray-800 dark:text-gray-200">
                  {renderMarkdown(msg.content)}

                  {/* Typing Indicator (Breathing dots) */}
                  {msg.role === 'assistant' && msg.content === '' && (
                    <div className="flex items-center gap-1.5 py-1.5 typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  )}

                  {/* Sources display */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="pt-3 border-t border-gray-100 dark:border-white/5 space-y-2">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <BookOpen size={12} />
                        <span>Sources Used</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200/80 bg-gray-50 px-2.5 py-1 text-xs text-gray-600 dark:border-white/5 dark:bg-darkbg-base dark:text-gray-400"
                          >
                            <span className="font-bold text-brand-light dark:text-brand-light">[{sIdx + 1}]</span>
                            <span>{src.shortName || src.name}</span>
                            <span className="text-[10px] text-gray-400">({src.city})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Prompts & Input Area */}
      <div className="border-t border-gray-200/50 bg-white/40 p-4 dark:border-white/5 dark:bg-darkbg-card/25 backdrop-blur-md shrink-0">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Quick Prompts list (Only show if loading is false) */}
          {!loading && messages.length <= 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSend(prompt)}
                  className="rounded-xl border border-gray-200/60 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-brand-light hover:text-brand-light dark:border-white/5 dark:bg-darkbg-card dark:text-gray-400 dark:hover:border-brand-accent dark:hover:text-white transition-all duration-150 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {prompt}
                  <ArrowRight size={10} />
                </button>
              ))}
            </div>
          )}

          {/* Form Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="relative flex items-center rounded-2xl border border-gray-200 bg-white shadow-lg focus-within:border-brand-light dark:border-white/10 dark:bg-darkbg-card dark:focus-within:border-brand-light focus-within:ring-2 focus-within:ring-brand-light/20 transition-all duration-200"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about fees, placement records, locations, or hostels..."
              disabled={loading}
              className="w-full rounded-2xl bg-transparent py-4.5 pl-4 pr-16 text-sm text-gray-900 outline-none dark:text-white"
            />
            <div className="absolute right-3 flex items-center gap-2">
              <span className="hidden sm:inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400 font-mono border border-gray-200/50 dark:bg-black/20 dark:border-white/5">
                <CornerDownLeft size={10} /> Enter
              </span>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="rounded-xl bg-gradient-to-r from-brand-light to-brand-accent p-2.5 text-gray-950 shadow hover:brightness-110 disabled:opacity-50 transition-all duration-200 cursor-pointer"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
