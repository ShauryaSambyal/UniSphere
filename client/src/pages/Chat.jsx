import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, BookOpen, Trash2, Bot, User, Loader2, CornerDownLeft } from 'lucide-react';
import { API_BASE } from '../services/api';
import { EASE } from '../lib/motion';

const CONTENT_MARKER = '\n[CONTENT_START]\n';
const STREAM_TIMEOUT_MS = 60000;

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hello! I am your AI College Assistant. I can help you search fees, compare placements, and look up details on RVCE, BMSCE, Christ, IIIT Bangalore, and IIT Bombay. Ask me anything!',
  sources: []
};

export default function Chat() {
  // Chats are session-only on purpose: every refresh starts a brand new
  // conversation, so no history is persisted anywhere.
  const [messages, setMessages] = useState(() => [{ ...WELCOME_MESSAGE }]);
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

  // Purge history saved by older builds, then keep the view pinned to the latest message.
  useEffect(() => {
    localStorage.removeItem('chat_history');
  }, []);

  useEffect(() => {
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
    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-subtle p-3 rounded-lg font-mono text-xs my-2 overflow-x-auto border border-line">$1</pre>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="bg-subtle px-1 py-0.5 rounded font-mono text-xs text-foreground">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Bullet points
    html = html.replace(/^\s*[-*]\s+(.+)$/gm, '<li class="ml-4 list-disc my-1">$1</li>');

    // Newlines
    html = html.replace(/\n/g, '<br />');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="space-y-1 text-sm leading-relaxed text-foreground" />;
  };

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMsg = { id: `${Date.now()}-user`, role: 'user', content: text };
    const assistantMsgId = `${Date.now()}-assistant`;
    setMessages(prev => [...prev, userMsg, { id: assistantMsgId, role: 'assistant', content: '', sources: [] }]);

    const patchAssistant = (patch) =>
      setMessages(prev => prev.map(m => (m.id === assistantMsgId ? { ...m, ...patch } : m)));

    // Abort the request if the server goes silent, so the typing indicator can
    // never spin forever the way it did when the backend was unreachable.
    const controller = new AbortController();
    let watchdog = null;
    let content = '';

    const armWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);
    };
    armWatchdog();

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
        signal: controller.signal
      });

      if (!response.ok) {
        let detail = '';
        try {
          detail = (await response.json())?.message || '';
        } catch {
          // Response was not JSON — the status code is all we have.
        }

        // A gateway status from the dev proxy almost always means the API
        // process is not running; say so instead of leaking a bare HTTP code.
        if (!detail && [502, 503, 504].includes(response.status)) {
          detail = 'The assistant API is not reachable. Start the backend with "npm run server" (or "npm run dev" from the project root), then try again.';
        }

        throw new Error(detail || `The server responded with status ${response.status}`);
      }

      if (!response.body) {
        throw new Error('The server returned no response stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let parsedSources = [];
      let contentStarted = false;

      for (;;) {
        const { value, done } = await reader.read();
        armWatchdog();

        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

        if (!contentStarted) {
          const markerIndex = buffer.indexOf(CONTENT_MARKER);
          if (markerIndex === -1) {
            if (!done) continue; // metadata header not fully received yet
            content = buffer;
            contentStarted = true;
          } else {
            try {
              parsedSources = JSON.parse(buffer.slice(0, markerIndex)).sources || [];
            } catch {
              parsedSources = [];
            }
            buffer = buffer.slice(markerIndex + CONTENT_MARKER.length);
            contentStarted = true;
          }
        }

        content = buffer;
        patchAssistant({ content, sources: parsedSources });

        if (done) break;
      }

      if (!content.trim()) {
        patchAssistant({ content: 'The assistant returned an empty response. Please try again.' });
      }
    } catch (error) {
      console.error('Streaming failure:', error);
      const failureMessage = error.name === 'AbortError'
        ? 'The assistant took too long to respond. The backend may be offline or busy — please try again.'
        : error instanceof TypeError
          ? 'Could not reach the AI backend. Start the server with "npm run server" (or "npm run dev" from the project root), then try again.'
          : `Error: ${error.message || 'Failed to fetch a reply from the assistant.'}`;
      // Keep any text that already streamed in; otherwise show the error itself.
      patchAssistant({ content: content.trim() ? `${content}\n\n— ${failureMessage}` : failureMessage });
    } finally {
      clearTimeout(watchdog);
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear all chat messages?')) {
      setMessages([{ ...WELCOME_MESSAGE }]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* Top Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
            <Bot size={14} className="text-background" />
          </span>
          <div>
            <h1 className="text-sm font-medium text-foreground">AI search chat</h1>
            <p className="font-mono text-[10px] uppercase tracking-wider text-faint">RAG · ChromaDB + Gemini</p>
          </div>
        </div>
        <button
          onClick={clearHistory}
          aria-label="Clear chat history"
          className="cursor-pointer rounded-lg border border-line p-2 text-faint transition-colors duration-150 hover:border-red-300 hover:text-red-500"
          title="Clear chat history"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE }}
                className={`flex gap-4 p-5 border rounded-2xl transition-colors duration-200 ${
                  msg.role === 'assistant'
                    ? 'border-line bg-card'
                    : 'border-line bg-subtle'
                }`}
              >
                {/* Avatar Icon */}
                <div className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg ${
                  msg.role === 'assistant' ? 'bg-foreground text-background' : 'border border-line bg-card text-muted'
                }`}>
                  {msg.role === 'assistant' ? <Bot size={15} /> : <User size={15} />}
                </div>

                {/* Body Content */}
                <div className="flex-1 space-y-3 overflow-hidden">
                  {renderMarkdown(msg.content)}

                  {/* Typing Indicator */}
                  {msg.role === 'assistant' && msg.content === '' && (
                    <div className="flex items-center gap-1.5 py-1.5">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  )}

                  {/* Sources display */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="space-y-2 border-t border-line pt-3">
                      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-faint">
                        <BookOpen size={11} />
                        <span>Sources used</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, sIdx) => (
                          <div
                            key={sIdx}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-background px-2.5 py-1 text-xs font-normal text-muted"
                          >
                            <span className="font-mono text-[10px] font-medium text-foreground">[{sIdx + 1}]</span>
                            <span>{src.shortName || src.name}</span>
                            <span className="text-[10px] text-faint">({src.city})</span>
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
      <div className="shrink-0 border-t border-line p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          {/* Quick Prompts list (Only show if loading is false) */}
          {!loading && messages.length <= 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {suggestedPrompts.map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  onClick={() => handleSend(prompt)}
                  className="flex cursor-pointer items-center gap-1 rounded-full border border-line bg-card px-3.5 py-1.5 text-xs font-normal text-muted transition-all duration-150 hover:border-line-strong hover:text-foreground"
                >
                  {prompt}
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
            className="relative flex items-center rounded-2xl border border-line bg-card transition-colors duration-150 focus-within:border-line-strong"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about fees, placement records, locations, or hostels…"
              disabled={loading}
              className="w-full rounded-2xl bg-transparent py-4 pl-4 pr-24 text-sm font-normal text-foreground outline-none placeholder:text-faint"
            />
            <div className="absolute right-3 flex items-center gap-2">
              <span className="hidden items-center gap-1 rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline-flex">
                <CornerDownLeft size={10} /> Enter
              </span>
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-foreground text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:opacity-40"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
