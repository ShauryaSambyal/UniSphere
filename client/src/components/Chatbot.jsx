import { useState, useRef, useEffect } from 'react';
import { Send, Bot, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

    try {
      // Create a message history excluding the initial system greeting if we prefer
      // Or just send the latest query. The backend chatController expects { message: string }.
      const res = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage })
      });

      if (!res.ok) throw new Error('Network response was not ok');

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response || "Sorry, I couldn't understand." }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'There was an error communicating with the AI. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 p-4 rounded-full bg-primary text-gray-950 shadow-xl shadow-brand-light/20 hover:scale-105 transition-transform z-40 cursor-pointer ${isOpen ? 'hidden' : ''}`}
      >
        <MessageSquare className="h-6 w-6" />
      </button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] rounded-2xl overflow-hidden shadow-2xl bg-white/95 dark:bg-darkbg-card/90 backdrop-blur-[20px] border border-gray-200/80 dark:border-white/10 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(0,245,255,0.08)] flex flex-col z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-gray-200/80 dark:border-white/10 bg-gray-50/50 dark:bg-black/20 flex justify-between items-center">
              <div className="flex items-center gap-2 text-foreground font-semibold font-sans text-sm">
                <Bot className="text-primary h-5 w-5 animate-pulse" />
                AI Counselor
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-foreground cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 text-sm transition-all duration-200 ${
                    msg.role === 'user' 
                      ? 'bg-primary text-gray-950 rounded-2xl rounded-tr-sm font-semibold shadow-sm shadow-brand-light/5' 
                      : 'bg-gray-100 dark:bg-darkbg-base/80 border border-gray-200/50 dark:border-brand-light/10 text-foreground rounded-lg ai-glow'
                  }`}>
                    {msg.role === 'assistant' || msg.role === 'system' ? (
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-black/30 dark:prose-code:text-brand-light"
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 dark:bg-darkbg-base/80 border border-gray-200/50 dark:border-brand-light/10 p-3 rounded-lg flex gap-1 items-center typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-200/80 dark:border-white/10 bg-gray-50/50 dark:bg-black/20">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything..."
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-[#131313] border border-gray-200 dark:border-white/10 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-light/50 focus:border-transparent text-foreground placeholder-gray-400 text-xs"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="p-2.5 rounded-full bg-primary text-gray-950 hover:bg-primary/95 disabled:opacity-50 transition-colors shadow shadow-brand-light/10 cursor-pointer flex items-center justify-center"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
