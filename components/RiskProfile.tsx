
import React, { useState } from 'react';
import { ShieldCheck, BrainCircuit, Activity, ChevronRight, ArrowLeft, RefreshCw, BarChart3, PieChart, Info, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { FinanceState, RiskLevel, RiskProfile as RiskProfileType } from '../types';

const QUESTIONS = [
  {
    id: 1,
    text: "What is your primary goal for your investment portfolio?",
    options: [
      { text: "Preserving capital with zero risk of loss", score: 5 },
      { text: "Stable income with minimal fluctuations", score: 10 },
      { text: "Balanced growth and capital preservation", score: 20 },
      { text: "Maximum long-term wealth growth", score: 30 }
    ]
  },
  {
    id: 2,
    text: "When do you plan to start withdrawing significant funds?",
    options: [
      { text: "Within 1-2 years", score: 5 },
      { text: "In 3-7 years", score: 15 },
      { text: "In 7-12 years", score: 25 },
      { text: "15+ years from now", score: 35 }
    ]
  },
  {
    id: 3,
    text: "If your portfolio dropped by 20% in one month, how would you react?",
    options: [
      { text: "Sell everything immediately", score: 5 },
      { text: "Shift most funds to safer cash", score: 15 },
      { text: "Do nothing and wait for recovery", score: 25 },
      { text: "Invest more to buy the dip", score: 40 }
    ]
  },
  {
    id: 4,
    text: "Comfort level with fluctuations for higher returns?",
    options: [
      { text: "None. I prefer guaranteed returns.", score: 0 },
      { text: "Low. I can handle small, infrequent dips.", score: 15 },
      { text: "Moderate. Ups/downs are part of the game.", score: 30 },
      { text: "High. Volatility is an opportunity.", score: 45 }
    ]
  },
  {
    id: 5,
    text: "Monthly investable income after expenses?",
    options: [
      { text: "Less than 10%", score: 5 },
      { text: "10% to 25%", score: 15 },
      { text: "25% to 50%", score: 25 },
      { text: "More than 50%", score: 35 }
    ]
  }
];

const RiskProfile: React.FC<{ state: FinanceState, updateState: (data: Partial<FinanceState>) => void }> = ({ state, updateState }) => {
  const [currentStep, setCurrentStep] = useState(state.riskProfile ? 'result' : 'intro');
  const [answers, setAnswers] = useState<number[]>([]);
  const [activeQuestion, setActiveQuestion] = useState(0);

  const calculateResults = (finalAnswers: number[]): RiskProfileType => {
    const totalScore = finalAnswers.reduce((a, b) => a + b, 0);
    const maxPossible = 185; 
    const score = Math.min(100, Math.round((totalScore / maxPossible) * 100));
    
    let level: RiskLevel = 'Balanced';
    let recommendedAllocation = { equity: 50, debt: 35, gold: 10, liquid: 5 };

    if (score < 25) {
      level = 'Conservative';
      recommendedAllocation = { equity: 15, debt: 60, gold: 5, liquid: 20 };
    } else if (score < 45) {
      level = 'Moderate';
      recommendedAllocation = { equity: 35, debt: 45, gold: 10, liquid: 10 };
    } else if (score < 70) {
      level = 'Balanced';
      recommendedAllocation = { equity: 55, debt: 30, gold: 10, liquid: 5 };
    } else if (score < 90) {
      level = 'Aggressive';
      recommendedAllocation = { equity: 75, debt: 15, gold: 5, liquid: 5 };
    } else {
      level = 'Very Aggressive';
      recommendedAllocation = { equity: 90, debt: 5, gold: 5, liquid: 0 };
    }

    return { score, level, lastUpdated: new Date().toISOString(), recommendedAllocation };
  };

  const handleAnswer = (score: number) => {
    const newAnswers = [...answers, score];
    if (activeQuestion < QUESTIONS.length - 1) {
      setAnswers(newAnswers);
      setActiveQuestion(activeQuestion + 1);
    } else {
      const result = calculateResults(newAnswers);
      updateState({ riskProfile: result });
      setCurrentStep('result');
    }
  };

  const reset = () => {
    setAnswers([]);
    setActiveQuestion(0);
    setCurrentStep('quiz');
  };

  if (currentStep === 'intro') {
    return (
      <div className="max-w-4xl mx-auto py-8 md:py-12 px-4 md:px-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-white rounded-[2.5rem] md:rounded-[4rem] border border-slate-200 shadow-2xl overflow-hidden p-8 md:p-20 text-center space-y-8 md:space-y-10 relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 blur-[100px] -z-10 rounded-full translate-x-1/2 -translate-y-1/2" />
          <div className="mx-auto w-16 h-16 md:w-24 md:h-24 bg-indigo-600 text-white rounded-2xl md:rounded-[2.5rem] flex items-center justify-center shadow-2xl">
            <BrainCircuit size={32} md:size={48} />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl md:text-6xl font-black text-slate-900 leading-tight">Risk DNA</h1>
            <p className="text-sm md:text-lg text-slate-500 max-w-2xl mx-auto font-medium">A scientific assessment of capacity for volatility. Discover your ideal asset allocation.</p>
          </div>
          <button 
            onClick={() => setCurrentStep('quiz')}
            className="w-full md:w-auto px-10 md:px-12 py-5 md:py-6 bg-indigo-600 text-white rounded-[1.5rem] md:rounded-[2rem] font-black text-base md:text-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 mx-auto shadow-xl"
          >
            Start Assessment <ChevronRight />
          </button>
        </div>
      </div>
    );
  }

  if (currentStep === 'quiz') {
    const q = QUESTIONS[activeQuestion];
    const progress = ((activeQuestion + 1) / QUESTIONS.length) * 100;
    return (
      <div className="max-w-3xl mx-auto py-6 md:py-12 px-4 md:px-6 animate-in fade-in zoom-in-95">
        <div className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
             <button onClick={() => activeQuestion > 0 ? setActiveQuestion(activeQuestion - 1) : setCurrentStep('intro')} className="p-2 hover:bg-white rounded-full text-slate-400 transition-colors">
               <ArrowLeft size={20} md:size={24} />
             </button>
             <div className="flex-1 px-4 md:px-8">
                <div className="w-full h-1.5 md:h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
             </div>
             <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">{activeQuestion + 1}/{QUESTIONS.length}</span>
          </div>
          <div className="p-8 md:p-16 space-y-8 md:space-y-10">
            <h2 className="text-xl md:text-3xl font-black text-slate-900 leading-tight">{q.text}</h2>
            <div className="space-y-3 md:space-y-4">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(opt.score)} className="w-full p-5 md:p-6 text-left border-2 border-slate-100 rounded-2xl md:rounded-[1.5rem] hover:border-indigo-600 hover:bg-indigo-50/50 transition-all group flex items-center justify-between">
                  <span className="text-xs md:text-sm font-bold text-slate-700 group-hover:text-indigo-900">{opt.text}</span>
                  <div className="w-5 h-5 md:w-6 md:h-6 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-indigo-600 transition-colors shrink-0 ml-4"><div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-indigo-600 scale-0 group-hover:scale-100 transition-transform" /></div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const result = state.riskProfile!;
  const allocation = result.recommendedAllocation;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-700 pb-24">
      <div className="bg-slate-950 p-8 md:p-16 rounded-[2.5rem] md:rounded-[4rem] text-white flex flex-col md:flex-row items-center gap-8 md:gap-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/20 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2" />
        <div className="relative shrink-0">
          <svg className="w-40 h-40 md:w-64 md:h-64 transform -rotate-90">
             <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/10" />
             <circle cx="50%" cy="50%" r="45%" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray="450" strokeDashoffset={450 - (450 * result.score) / 100} className="text-indigo-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
             <span className="text-3xl md:text-6xl font-black">{result.score}</span>
             <span className="text-[8px] md:text-[10px] font-black text-indigo-400 uppercase tracking-widest">Score</span>
          </div>
        </div>
        <div className="flex-1 space-y-4 md:space-y-6 text-center md:text-left">
           <h2 className="text-3xl md:text-6xl font-black leading-none"><span className="text-indigo-500">{result.level}</span> Profile</h2>
           <p className="text-slate-400 font-medium text-sm md:text-lg max-w-xl">Healthy appetite for growth with strategic capital protection.</p>
           <button onClick={reset} className="flex items-center gap-2 text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-widest hover:text-white transition-colors mx-auto md:mx-0">
             <RefreshCw size={14} /> Retake Assessment
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <div className="lg:col-span-2 bg-white p-8 md:p-14 rounded-[2.5rem] md:rounded-[3.5rem] border border-slate-200 shadow-sm">
           <h3 className="text-xl md:text-2xl font-black text-slate-900 mb-8 md:mb-12 flex items-center gap-3"><PieChart className="text-indigo-600" size={24} md:size={28} /> Target Mix</h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { label: 'Equity', value: allocation.equity, color: 'indigo' },
                { label: 'Debt', value: allocation.debt, color: 'emerald' },
                { label: 'Gold', value: allocation.gold, color: 'amber' },
                { label: 'Liquid', value: allocation.liquid, color: 'slate' }
              ].map((item, i) => (
                <div key={i} className="p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-slate-100 bg-slate-50/30 text-center">
                   <p className="text-[8px] md:text-[10px] font-black uppercase text-slate-400 mb-1">{item.label}</p>
                   <h4 className={`text-2xl md:text-4xl font-black text-${item.color === 'slate' ? 'slate-900' : item.color + '-600'}`}>{item.value}%</h4>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default RiskProfile;
