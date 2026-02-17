
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Loader2, Calculator, Car, Home, TrendingUp, Laptop, Clock } from 'lucide-react';
import { getFinancialAdvice } from '../services/geminiService';
import { FinanceState } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIAdvisorProps {
  state: FinanceState;
}

const AIAdvisor: React.FC<AIAdvisorProps> = ({ state }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Welcome to the Strategy Lab. I have your detailed household income data. Ask me about your 10-year path or whether a specific purchase is sustainable." 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (customInput?: string) => {
    const messageToSend = customInput || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage = messageToSend.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await getFinancialAdvice(state, userMessage);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I encountered an error. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const SimulationChip = ({ label, icon: Icon, query }: { label: string, icon: any, query: string }) => (
    <button 
      onClick={() => handleSend(query)}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all whitespace-nowrap shrink-0"
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] max-w-4xl mx-auto bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 bg-slate-950 text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/20">
            <Bot size={22} />
          </div>
          <div>
            <h3 className="font-black text-lg">Strategy Terminal</h3>
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Household Intelligence</p>
          </div>
        </div>
        <div className="bg-white/10 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/5">
          <Sparkles size={12} className="text-indigo-400" />
          Live Simulator
        </div>
      </div>

      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scroll-smooth no-scrollbar"
      >
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-4 max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center border ${
                msg.role === 'assistant' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-900 text-white border-slate-800 shadow-xl shadow-slate-900/10'
              }`}>
                {msg.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
              </div>
              <div className={`p-6 rounded-[2rem] text-sm leading-relaxed font-medium ${
                msg.role === 'assistant' 
                  ? 'bg-slate-50 text-slate-800 rounded-tl-none border border-slate-100' 
                  : 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-600/10'
              }`}>
                {msg.content.split('\n').map((line, idx) => (
                  <p key={idx} className={idx > 0 ? 'mt-3' : ''}>
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex gap-4 max-w-[80%]">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div className="p-6 rounded-[2rem] bg-slate-50 text-slate-400 text-sm animate-pulse rounded-tl-none border border-slate-100">
                Projecting 10-year cash flow...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Chips */}
      <div className="px-6 py-4 bg-white border-t border-slate-50 flex gap-3 overflow-x-auto no-scrollbar">
        <SimulationChip label="10yr Car Impact" icon={Car} query="Project my 10-year cash flow if I buy a $50k car today. Will it delay my retirement? Show me the math." />
        <SimulationChip label="Can I retire in 10yrs?" icon={Clock} query="Can I retire in exactly 10 years given my current surplus, assets, and income growth? Show me a sustainability score." />
        <SimulationChip label="Laptop Affordability" icon={Laptop} query="I want a $3000 laptop. Can I afford this without dipping into my 'Home Downpayment' fund?" />
        <SimulationChip label="Household ROI" icon={TrendingUp} query="If my spouse increases their income by 15%, how much closer does our retirement goal move?" />
      </div>

      {/* Input Area */}
      <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50">
        <div className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="E.g. What happens if I move to a $4000/mo apartment in 2 years?"
            className="w-full bg-white border border-slate-200 rounded-[1.5rem] pl-6 pr-14 py-4 md:py-5 font-bold outline-none shadow-xl shadow-slate-200/50 focus:ring-4 focus:ring-indigo-600/5 transition-all"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-2xl transition-all ${
              input.trim() && !isLoading ? 'bg-indigo-600 text-white hover:scale-110 shadow-lg shadow-indigo-600/20' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAdvisor;
