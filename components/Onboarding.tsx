
import React, { useState, useMemo, useEffect } from 'react';
import { FinanceState, IncomeSource } from '../types';
import { 
  Phone, CheckCircle2, ArrowRight, Wallet, Shield, 
  Mail, User, MapPin, Calendar, ShieldCheck,
  TrendingUp, Map, ArrowLeft, Sparkles, Zap,
  Cpu, ChevronRight, BrainCircuit, Activity, Globe
} from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: Partial<FinanceState>) => void;
  onBackToLanding?: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onBackToLanding }) => {
  const [step, setStep] = useState(0);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '', 
    otp: '',
    firstName: '',
    lastName: '',
    dob: '',
    lifeExpectancy: 85,
    retirementAge: 60,
    pincode: '',
    city: '',
    state: '',
    country: 'India',
    incomeSource: 'salaried' as IncomeSource,
  });

  const stepConfig = [
    { title: 'Identity', icon: ShieldCheck },
    { title: 'Personal', icon: User },
    { title: 'Planning', icon: TrendingUp },
    { title: 'Location', icon: MapPin },
    { title: 'Intelligence', icon: BrainCircuit },
  ];

  const currentAge = useMemo(() => {
    if (!formData.dob) return 0;
    const today = new Date();
    const birthDate = new Date(formData.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return Math.max(0, age);
  }, [formData.dob]);

  const baselineIq = useMemo(() => {
    let score = 65; 
    if (formData.retirementAge - currentAge > 20) score += 10;
    if (formData.lifeExpectancy > 80) score += 5;
    if (formData.pincode.startsWith('4') || formData.pincode.startsWith('1')) score += 5; 
    return Math.min(98, score);
  }, [formData, currentAge]);

  const handleSendOtp = () => {
    if (!formData.identifier.trim()) return;
    setIsOtpSent(true);
  };

  const handleVerifyOtp = () => {
    if (formData.otp.length === 6) {
      setStep(1);
    }
  };

  const handleToFinal = () => {
    setIsCalculating(true);
    setTimeout(() => {
      setIsCalculating(false);
      setStep(4);
    }, 2500);
  };

  const handleFinish = () => {
    onComplete({
      isRegistered: true,
      profile: {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dob: formData.dob,
        mobile: formData.identifier.includes('@') ? '' : formData.identifier,
        email: formData.identifier.includes('@') ? formData.identifier : '',
        lifeExpectancy: Number(formData.lifeExpectancy),
        retirementAge: Number(formData.retirementAge),
        pincode: formData.pincode,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        incomeSource: formData.incomeSource,
        income: {
          salary: 0,
          bonus: 0,
          reimbursements: 0,
          business: 0,
          rental: 0,
          investment: 0,
          expectedIncrease: 6
        },
        monthlyExpenses: 0,
        iqScore: baselineIq
      }
    });
  };

  const handlePincodeChange = (val: string) => {
    setFormData({ ...formData, pincode: val });
    if (val.length === 6) {
      setFormData(prev => ({
        ...prev,
        pincode: val,
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India'
      }));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 md:p-6 selection:bg-indigo-100 overflow-x-hidden">
      
      {/* Progress Architecture - Improved for mobile (shows simple dots on small screens) */}
      <div className="max-w-xl w-full mb-8 md:mb-16 flex items-center justify-between px-4 md:px-10 relative">
        <div className="absolute top-1/2 md:top-6 left-10 right-10 h-[2px] bg-slate-200 -z-0 -translate-y-1/2 md:translate-y-0" />
        <div className="absolute top-1/2 md:top-6 left-10 h-[2px] bg-indigo-600 -z-0 transition-all duration-700 -translate-y-1/2 md:translate-y-0" style={{ width: `${(step / (stepConfig.length - 1)) * 100}%` }} />
        
        {stepConfig.map((s, i) => (
          <div key={i} className="flex flex-col items-center relative z-10">
            <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-[1.25rem] flex items-center justify-center transition-all duration-500 ${
              step >= i ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 ring-4 ring-white' : 'bg-white text-slate-300 border border-slate-200'
            }`}>
              <s.icon size={window.innerWidth < 768 ? 16 : 20} />
            </div>
            <span className={`hidden md:block text-[10px] font-black uppercase tracking-widest mt-4 transition-colors ${
              step >= i ? 'text-indigo-600' : 'text-slate-300'
            }`}>
              {s.title}
            </span>
          </div>
        ))}
      </div>

      <div className="max-w-2xl w-full bg-white rounded-3xl md:rounded-[4.5rem] shadow-2xl border border-slate-100 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-indigo-50/50 blur-[60px] md:blur-[80px] -z-0 translate-x-1/2 -translate-y-1/2" />
        
        {step < 4 && (
          <div className="absolute top-6 md:top-10 left-6 md:left-10 flex items-center gap-4 z-20">
            <button 
              onClick={step > 0 ? () => setStep(step - 1) : onBackToLanding}
              className="p-3 md:p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl md:rounded-3xl text-slate-400 hover:text-indigo-600 transition-all"
              aria-label="Back"
            >
              <ArrowLeft size={18} md:size={20} />
            </button>
          </div>
        )}

        <div className="p-6 md:p-16 pt-20 md:pt-28">
          
          {step === 0 && (
            <div className="space-y-6 md:space-y-10 animate-in fade-in duration-500">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 text-indigo-600 mb-2">
                   <ShieldCheck size={20} className="md:w-6 md:h-6"/>
                   <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">System Authorization</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none">Security Crossover.</h1>
                <p className="text-slate-500 font-medium text-sm md:text-lg">Verify your identity to boot your wealth terminal.</p>
              </div>

              <div className="space-y-6 md:space-y-8">
                <div className="space-y-3 md:space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Digital Identity (Email or Mobile)</label>
                  <div className="relative group">
                    <Mail className="absolute left-6 md:left-8 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors w-5 h-5 md:w-6 md:h-6" />
                    <input 
                      type="text" 
                      placeholder="e.g. ravindra@core.tech"
                      className="w-full pl-14 md:pl-20 pr-6 md:pr-10 py-5 md:py-7 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[2.5rem] focus:ring-8 focus:ring-indigo-600/5 focus:border-indigo-600 outline-none font-black text-lg md:text-2xl transition-all"
                      value={formData.identifier}
                      onChange={e => setFormData({...formData, identifier: e.target.value})}
                      disabled={isOtpSent}
                    />
                  </div>
                </div>

                {!isOtpSent ? (
                  <button 
                    onClick={handleSendOtp}
                    className="w-full bg-slate-950 text-white py-6 md:py-8 rounded-2xl md:rounded-[2.5rem] font-black text-lg md:text-xl hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-3 md:gap-4 group"
                  >
                    Send One-Time Key <ArrowRight size={20} className="md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
                  </button>
                ) : (
                  <div className="space-y-6 md:space-y-10 animate-in zoom-in-95">
                    <div className="space-y-3 md:space-y-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center block">Enter 6-Digit Alpha Key</label>
                      <input 
                        type="text" 
                        maxLength={6}
                        placeholder="• • • • • •"
                        className="w-full px-4 py-5 md:py-8 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[2.5rem] text-center text-3xl md:text-5xl font-black tracking-[0.2em] md:tracking-[0.5em] outline-none shadow-inner"
                        value={formData.otp}
                        onChange={e => setFormData({...formData, otp: e.target.value})}
                      />
                    </div>
                    <button 
                      onClick={handleVerifyOtp}
                      disabled={formData.otp.length !== 6}
                      className="w-full bg-indigo-600 text-white py-6 md:py-8 rounded-2xl md:rounded-[2.5rem] font-black text-lg md:text-xl hover:bg-indigo-700 transition-all shadow-[0_25px_50px_-15px_rgba(79,70,229,0.5)] disabled:opacity-30 disabled:shadow-none"
                    >
                      Authenticate Node
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 md:space-y-10 animate-in slide-in-from-right-8 duration-500">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 text-indigo-600">
                   <User size={20} className="md:w-6 md:h-6"/>
                   <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Node Identity</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none">Handle Profile.</h1>
                <p className="text-slate-500 font-medium text-sm md:text-lg">Initialize your tactical wealth identity.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2 md:space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">First Name</label>
                  <input type="text" placeholder="Ravindra" className="w-full px-6 py-4 md:px-8 md:py-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.75rem] font-black text-base md:text-lg outline-none" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="space-y-2 md:space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Last Name</label>
                  <input type="text" placeholder="Khudania" className="w-full px-6 py-4 md:px-8 md:py-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.75rem] font-black text-base md:text-lg outline-none" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2 md:space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Temporal Origin (DOB)</label>
                <input type="date" className="w-full px-6 py-4 md:px-8 md:py-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.75rem] font-black text-base md:text-lg outline-none" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
              </div>
              <button onClick={() => setStep(2)} className="w-full bg-slate-950 text-white py-5 md:py-7 rounded-2xl md:rounded-[2.25rem] font-black text-base md:text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">Proceed to Calibration <ChevronRight size={20} md:size={24} /></button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 md:space-y-10 animate-in slide-in-from-right-8 duration-500">
              <div className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-3 text-indigo-600">
                   <TrendingUp size={20} className="md:w-6 md:h-6"/>
                   <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Planning Horizon</span>
                </div>
                <h1 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none">Time Metrics.</h1>
                <p className="text-slate-500 font-medium text-sm md:text-lg">Define your accumulation and drawdown phases.</p>
              </div>

              <div className="space-y-8 md:space-y-10">
                <div className="space-y-4 md:space-y-5">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Life Expectancy</label><span className="text-2xl md:text-3xl font-black text-indigo-600">{formData.lifeExpectancy} <span className="text-xs">Yrs</span></span></div>
                  <input type="range" min={Math.max(currentAge + 1, 60)} max="100" className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-indigo-600" value={formData.lifeExpectancy} onChange={e => setFormData({...formData, lifeExpectancy: Number(e.target.value)})} />
                </div>
                <div className="space-y-4 md:space-y-5">
                  <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Retirement Age</label><span className="text-2xl md:text-3xl font-black text-emerald-500">{formData.retirementAge} <span className="text-xs">Yrs</span></span></div>
                  <input type="range" min={currentAge} max={formData.lifeExpectancy - 1} className="w-full h-2 bg-slate-100 rounded-full appearance-none accent-emerald-500" value={formData.retirementAge} onChange={e => setFormData({...formData, retirementAge: Number(e.target.value)})} />
                </div>
              </div>
              <button onClick={() => setStep(3)} className="w-full bg-slate-950 text-white py-5 md:py-7 rounded-2xl md:rounded-[2.25rem] font-black text-base md:text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 md:gap-4">Set Regional Node <ChevronRight size={20} md:size={24} /></button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 md:space-y-10 animate-in slide-in-from-right-8 duration-500">
              {isCalculating ? (
                <div className="py-12 md:py-20 flex flex-col items-center justify-center text-center space-y-6 md:space-y-8 animate-in zoom-in-95">
                   <div className="w-20 h-20 md:w-24 md:h-24 bg-indigo-50 text-indigo-600 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center animate-spin border-4 border-white shadow-xl">
                      <BrainCircuit size={32} md:size={40} />
                   </div>
                   <div className="space-y-2">
                      <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">Calculating Alpha Score...</h3>
                      <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Temporal Actuarial Audit In Progress</p>
                   </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center gap-3 text-indigo-600">
                       <MapPin size={20} className="md:w-6 md:h-6"/>
                       <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Context Calibration</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none">Global Node.</h1>
                    <p className="text-slate-500 font-medium text-sm md:text-lg">Context for tax jurisdictions and cost-of-living index.</p>
                  </div>

                  <div className="space-y-6 md:space-y-8">
                    <div className="space-y-2 md:space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Pin / Zip Code</label>
                      <input type="text" placeholder="400001" className="w-full px-6 py-4 md:px-8 md:py-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.75rem] font-black text-xl md:text-2xl outline-none" value={formData.pincode} onChange={e => handlePincodeChange(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-2 md:space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Base City</label>
                        <input type="text" className="w-full px-6 py-4 md:px-8 md:py-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.75rem] font-black text-base md:text-lg outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                      </div>
                      <div className="space-y-2 md:space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">State Node</label>
                        <input type="text" className="w-full px-6 py-4 md:px-8 md:py-5 bg-slate-50 border border-slate-200 rounded-xl md:rounded-[1.75rem] font-black text-base md:text-lg outline-none" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <button onClick={handleToFinal} className="w-full bg-slate-950 text-white py-6 md:py-8 rounded-2xl md:rounded-[2.5rem] font-black text-lg md:text-xl hover:bg-indigo-600 transition-all shadow-2xl flex items-center justify-center gap-3 md:gap-4">Compute Financial IQ <BrainCircuit size={20} md:size={24} /></button>
                </>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-8 md:space-y-12 animate-in zoom-in-95 duration-700">
              <div className="relative mx-auto w-36 h-36 md:w-56 md:h-56">
                 <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100" />
                    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="283" strokeDashoffset={283 - (283 * baselineIq) / 100} className="text-indigo-600 transition-all duration-1000 ease-out" strokeLinecap="round" />
                 </svg>
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl md:text-6xl font-black tracking-tighter text-slate-950">{baselineIq}</span>
                    <span className="text-[8px] md:text-[9px] font-black text-indigo-500 uppercase tracking-widest">Financial IQ</span>
                 </div>
              </div>
              
              <div className="space-y-3 md:space-y-4">
                <h3 className="text-2xl md:text-4xl font-black text-slate-950 tracking-tighter leading-none">Baseline Ready, {formData.firstName}.</h3>
                <p className="text-slate-500 font-medium text-sm md:text-lg leading-relaxed px-2 md:px-4">
                   Your temporal horizons are mapped. A baseline IQ of <span className="text-indigo-600 font-black">{baselineIq}</span> suggests strong compounding potential. Initialize your assets to activate live tracking.
                </p>
              </div>

              <div className="bg-slate-50 p-4 md:p-8 rounded-3xl md:rounded-[3.5rem] border border-slate-100 grid grid-cols-2 gap-3 md:gap-4">
                 <div className="p-3 md:p-5 bg-white rounded-2xl md:rounded-3xl text-left border border-slate-100 overflow-hidden">
                    <Globe size={14} className="md:w-[18px] md:h-[18px] text-slate-300 mb-1.5 md:mb-2" />
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Operational Node</p>
                    <p className="text-[10px] md:text-xs font-black text-slate-900 truncate">{formData.city}</p>
                 </div>
                 <div className="p-3 md:p-5 bg-white rounded-2xl md:rounded-3xl text-left border border-slate-100 overflow-hidden">
                    <Activity size={14} className="md:w-[18px] md:h-[18px] text-slate-300 mb-1.5 md:mb-2" />
                    <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">Wealth Horizon</p>
                    <p className="text-[10px] md:text-xs font-black text-indigo-600 truncate">{formData.retirementAge - currentAge}y Build Phase</p>
                 </div>
              </div>

              <button onClick={handleFinish} className="w-full bg-slate-950 text-white py-6 md:py-10 rounded-2xl md:rounded-[3rem] font-black text-lg md:text-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-4 md:gap-6 group shadow-2xl active:scale-[0.98]">Access Terminal <Zap size={24} md:size={32} /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
