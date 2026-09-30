import { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { API_BASE } from '../services/api';

const CONTENT_MARKER = '\n[CONTENT_START]\n';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'system', content: 'Hello! I am your AI College Counselor. Ask me about college comparisons, fees, placements, or rankings.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // The user bubble is appended above, so the assistant bubble lands one slot later.
    const assistantIndex = messages.length + 1;
    const setAssistantContent = (content) =>
      setMessages(prev => prev.map((msg, idx) => (idx === assistantIndex ? { ...msg, content } : msg)));

    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      // POST /api/chat streams plain text framed as:
      //   {"sources":[...]}\n[CONTENT_START]\n<streamed answer>
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      if (!res.ok) {
        // A gateway status from the dev proxy almost always means the API
        // process is not running; say so instead of leaking a bare HTTP code.
        throw new Error([502, 503, 504].includes(res.status)
          ? 'The assistant API is not reachable. Start the backend with "npm run server" (or "npm run dev" from the project root), then try again.'
          : `The assistant responded with status ${res.status}. Please try again.`);
      }

      if (!res.body) throw new Error('The server returned no response stream. Please try again.');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      let content = '';
      let contentStarted = false;

      for (;;) {
        const { value, done } = await reader.read();

        if (done) {
          buffered += decoder.decode();
          if (!contentStarted) {
            const markerIndex = buffered.indexOf(CONTENT_MARKER);
            content = markerIndex === -1 ? buffered : buffered.slice(markerIndex + CONTENT_MARKER.length);
          } else {
            content = buffered;
          }
          setAssistantContent(content || "Sorry, I couldn't understand that.");
          break;
        }

        buffered += decoder.decode(value, { stream: true });

        if (!contentStarted) {
          const markerIndex = buffered.indexOf(CONTENT_MARKER);
          if (markerIndex === -1) continue; // metadata header not fully received yet
          buffered = buffered.slice(markerIndex + CONTENT_MARKER.length);
          contentStarted = true;
        }

        content = buffered;
        setAssistantContent(content);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const failureMessage = error instanceof TypeError
        ? 'Could not reach the AI backend. Start the server with "npm run server" (or "npm run dev" from the project root), then try again.'
        : error.message || 'There was an error communicating with the AI. Please try again later.';
      setMessages(prev => prev.map((msg, idx) =>
        idx === assistantIndex
          ? { ...msg, content: failureMessage }
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open AI counselor"
        className={`fixed bottom-6 right-6 z-40 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-foreground text-background shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)] transition-all duration-200 hover:scale-105 active:scale-95 ${isOpen ? 'hidden' : ''}`}
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-6 right-6 z-50 flex h-[600px] max-h-[80vh] w-96 flex-col overflow-hidden rounded-2xl border border-line bg-card-elevated shadow-[0_32px_80px_-24px_rgba(26,26,26,0.24)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-foreground">
                  <Bot size={14} className="text-background" />
                </span>
                AI Counselor
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                className="cursor-pointer text-faint transition-colors duration-150 hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-foreground font-normal text-background'
                      : 'rounded-bl-sm border border-line bg-card text-foreground'
                  }`}>
                    {msg.role === 'assistant' || msg.role === 'system' ? (
                      <div className="chat-markdown max-w-none text-[13px] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border border-line bg-card p-3">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-line p-3">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything…"
                  className="flex-1 rounded-full border border-line bg-background px-4 py-2.5 text-xs font-normal text-foreground outline-none transition-colors duration-150 placeholder:text-faint focus:border-line-strong"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  aria-label="Send message"
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-foreground text-background transition-all duration-200 hover:opacity-85 active:scale-95 disabled:opacity-40"
                >
                  <Send className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
