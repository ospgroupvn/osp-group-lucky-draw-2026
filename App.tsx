import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HistorySidebar } from './components/HistorySidebar';
import { SlotMachine, SlotMachineRef } from './components/SlotMachine';
import { SettingsModal } from './components/SettingsModal';
import { Confetti } from './components/Confetti';
import { DEFAULT_PRIZES, DEFAULT_SETTINGS } from './constants';
import { Prize, Winner, GlobalSettings, RandomSource, SpinMode, ManualRevealMode, AutoStopMode } from './types';
import { Settings, Play, FastForward, RotateCcw, Volume2, VolumeX, AlertCircle, Trophy, PanelLeftClose, PanelLeftOpen, Sparkles, Eye } from 'lucide-react';
import { soundManager } from './utils/SoundManager';

const App: React.FC = () => {
  // --- State ---
  const [prizes, setPrizes] = useState<Prize[]>(() => {
    const saved = localStorage.getItem('osp_prizes');
    return saved ? JSON.parse(saved) : DEFAULT_PRIZES;
  });

  const [settings, setSettings] = useState<GlobalSettings>(() => {
    const saved = localStorage.getItem('osp_settings');
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  const [winners, setWinners] = useState<Winner[]>(() => {
    const saved = localStorage.getItem('osp_winners');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentPrizeId, setCurrentPrizeId] = useState<string>(() => {
     // Start from the last prize (consolation prize) and spin upwards
     const saved = localStorage.getItem('osp_current_prize_id');
     if (saved) return saved;
     return prizes.length > 0 ? prizes[prizes.length - 1].id : '';
  });

  // Ensure currentPrizeId is valid if prizes changed
  useEffect(() => {
     if (prizes.length > 0 && !prizes.find(p => p.id === currentPrizeId)) {
         setCurrentPrizeId(prizes[prizes.length - 1].id); // Default to last prize
     }
  }, [prizes, currentPrizeId]);

  const [isSpinning, setIsSpinning] = useState(false);
  const [targetNumber, setTargetNumber] = useState<string | null>(null);
  const [isManualSpinning, setIsManualSpinning] = useState(false); // Track if any digits are spinning in MANUAL mode
  const [isManualSpinActive, setIsManualSpinActive] = useState(false); // Track if a MANUAL spin session is active (from start until all digits revealed)
  const [showSettings, setShowSettings] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showSidebar, setShowSidebar] = useState(() => {
    const saved = localStorage.getItem('osp_show_sidebar');
    return saved ? JSON.parse(saved) : true;
  });
  const [showFinalResults, setShowFinalResults] = useState(false);
  const [currentWinnerIndex, setCurrentWinnerIndex] = useState(0);

  // Audio refs
  const spinOscillatorRef = useRef<HTMLAudioElement | null>(null);
  const wasCompleteOnMount = useRef(false);

  // SlotMachine ref for manual reveal
  const slotMachineRef = useRef<SlotMachineRef>(null);

  // Ref to always have latest winners (to avoid stale closure in generateRandomNumber)
  const winnersRef = useRef<Winner[]>(winners);
  useEffect(() => {
    winnersRef.current = winners;
  }, [winners]);

  // --- Derived State ---
  const currentPrize = useMemo(() => 
    prizes.find(p => p.id === currentPrizeId) || prizes[0], 
  [prizes, currentPrizeId]);
  
  const currentWinners = useMemo(() => 
    winners.filter(w => w.prizeId === currentPrizeId),
  [winners, currentPrizeId]);

  const isPrizeComplete = currentWinners.length >= (currentPrize?.quantity || 0);

  // Check if all prizes are complete
  const allPrizesComplete = useMemo(() => {
    return prizes.every(prize => {
      const prizeWinners = winners.filter(w => w.prizeId === prize.id);
      return prizeWinners.length >= prize.quantity;
    });
  }, [prizes, winners]);

  // Check if already complete on mount (for immediate show on refresh)
  useEffect(() => {
    wasCompleteOnMount.current = allPrizesComplete && prizes.length > 0 && winners.length > 0;
  }, []);

  // Auto-show final results when all prizes complete (with 10s delay, or immediately if already complete)
  useEffect(() => {
    if (allPrizesComplete && prizes.length > 0 && winners.length > 0) {
      if (wasCompleteOnMount.current) {
        // Already complete on load - show immediately
        setShowFinalResults(true);
      } else {
        // Just completed - wait 10 seconds for confetti display
        const timer = setTimeout(() => {
          setShowFinalResults(true);
        }, 10000);

        return () => clearTimeout(timer);
      }
    }
  }, [allPrizesComplete, prizes.length, winners.length]);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('osp_prizes', JSON.stringify(prizes));
  }, [prizes]);

  useEffect(() => {
    localStorage.setItem('osp_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('osp_winners', JSON.stringify(winners));
  }, [winners]);

  useEffect(() => {
    soundManager.setMute(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('osp_show_sidebar', JSON.stringify(showSidebar));
  }, [showSidebar]);

  useEffect(() => {
    localStorage.setItem('osp_current_prize_id', currentPrizeId);
  }, [currentPrizeId]);

  // Display winner's number when switching to a prize with winners
  useEffect(() => {
    // Reset to first winner when switching prizes
    setCurrentWinnerIndex(0);
  }, [currentPrizeId]);

  // Update target number based on current winner index
  useEffect(() => {
    if (currentWinners.length > 0 && currentWinnerIndex < currentWinners.length) {
      setTargetNumber(currentWinners[currentWinnerIndex].number);
    } else if (currentWinners.length === 0) {
      setTargetNumber(null);
    }
  }, [currentWinnerIndex, currentWinners]);

  // --- Logic ---

  /**
   * Get true random number from Random.org API or local crypto
   * Falls back to crypto.getRandomValues() on failure
   */
  const getRandomNumber = async (min: number, max: number, taken: Set<number>): Promise<number> => {
    const range = max - min + 1;

    // Helper: Local crypto fallback
    const getLocalRandom = (): number => {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return (array[0] % range) + min;
    };

    // Check if user selected Random.org AND has API key
    const useRandomOrg = settings.randomSource === RandomSource.RANDOM_ORG && settings.randomOrgApiKey?.trim();

    if (!useRandomOrg) {
      // Use local crypto (default)
      return getLocalRandom();
    }

    try {
      // Random.org API with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

      const response = await fetch('https://api.random.org/json-rpc/4/invoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'generateIntegers',
          params: {
            apiKey: settings.randomOrgApiKey,
            n: 10, // Request 10 numbers to have choices
            min: min,
            max: max,
            replacement: true,
          },
          id: Date.now(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.error) {
        console.warn('Random.org API error:', data.error);
        return getLocalRandom();
      }

      // Find a number not in taken set
      const numbers = data.result?.random?.data;
      if (numbers && Array.isArray(numbers)) {
        for (const num of numbers) {
          if (!taken.has(num)) {
            return num;
          }
        }
      }

      return getLocalRandom();
    } catch (err) {
      // Network error, timeout, rate limit, etc. → fallback
      console.warn('Random.org fetch failed, using local crypto:', err);
      return getLocalRandom();
    }
  };

  const generateRandomNumber = async (): Promise<string | null> => {
    const { minNumber, maxNumber, excludePreviousWinners } = settings;
    // Use winnersRef to always get the latest winners (avoid stale closure)
    const takenNumbers: Set<number> = new Set(winnersRef.current.map((w: Winner) => parseInt(w.number, 10)));

    // Safety check to avoid infinite loops
    let attempts = 0;
    const maxAttempts = (maxNumber - minNumber) * 5;

    let result: number;
    let found = false;

    // Fallback if full
    if ((maxNumber - minNumber + 1) <= takenNumbers.size && excludePreviousWinners) {
        return null;
    }

    do {
      result = await getRandomNumber(minNumber, maxNumber, takenNumbers);
      attempts++;
      if (!excludePreviousWinners || !takenNumbers.has(result)) {
        found = true;
      }
      if (attempts > maxAttempts) return null;
    } while (!found);

    return result.toString();
  };

  const handleStartSpin = async () => {
    // Resume context on user interaction
    soundManager.resume();

    // Prevent multiple spins at the same time
    if (isSpinning || isManualSpinning || isManualSpinActive) {
       return;
    }

    if (isPrizeComplete) {
       setErrorMsg("Đã đủ số lượng người trúng giải này! Vui lòng chuyển giải khác.");
       return;
    }

    setErrorMsg(null);
    setShowConfetti(false);

    const num = await generateRandomNumber();
    if (!num) {
        setErrorMsg("Đã hết số may mắn trong phạm vi này!");
        return;
    }

    setTargetNumber(num);
    setIsSpinning(true);

    // Mark manual spin session as active
    if (currentPrize.spinMode === SpinMode.MANUAL) {
      setIsManualSpinActive(true);
    }

    // Start Spin Sound (only for AUTO modes - MANUAL mode plays sound in handleDigitSpinStart)
    if (currentPrize.spinMode !== SpinMode.MANUAL) {
      const osc = soundManager.playSpinSound();
      if (osc) {
          spinOscillatorRef.current = osc;
      }
    }
  };

  const handleStopDigit = () => {
    soundManager.playTick();
  };

  // Called when a digit starts spinning in MANUAL mode
  const handleDigitSpinStart = () => {
    setIsManualSpinning(true);
    // Play spin sound when digit starts spinning
    const osc = soundManager.playSpinSound();
    if (osc) {
      spinOscillatorRef.current = osc;
    }
  };

  // Called when a digit stops spinning in MANUAL mode
  const handleDigitSpinStop = (stillSpinning: boolean) => {
    setIsManualSpinning(stillSpinning);
    // Stop spin sound only when no digits are spinning
    if (!stillSpinning) {
      soundManager.stopSpinSound();
    }
  };

  const handleSpinFinished = () => {
    setIsSpinning(false);
    setIsManualSpinActive(false); // End manual spin session

    // Stop spin sound (if not already stopped by MANUAL mode)
    if (!isManualSpinning && spinOscillatorRef.current) {
        try {
            spinOscillatorRef.current.pause();
            spinOscillatorRef.current.currentTime = 0;
        } catch(e) {}
        spinOscillatorRef.current = null;
    }

    // Play win sound
    soundManager.playWin();

    setShowConfetti(true);

    if (targetNumber) {
        const newWinner: Winner = {
            id: Date.now().toString(),
            prizeId: currentPrize.id,
            prizeName: currentPrize.name,
            number: targetNumber.padStart(currentPrize.digitCount, '0'),
            timestamp: Date.now()
        };
        // CRITICAL: Update winnersRef synchronously BEFORE setWinners
        // This prevents duplicate numbers when user clicks "Quay số tiếp theo" quickly
        // (effect that updates winnersRef runs after render, but generateRandomNumber
        // may be called before that)
        winnersRef.current = [newWinner, ...winnersRef.current];
        setWinners(prev => [newWinner, ...prev]); // Add to top
    }

    // Clear targetNumber to reset SlotMachine state for next spin
    // (The winner's number will be shown via currentWinnerIndex)
    setTargetNumber(null);

    // Auto hide confetti after 5s
    setTimeout(() => setShowConfetti(false), 5000);
  };

  const handleResetData = () => {
    setWinners([]);
    setSettings(DEFAULT_SETTINGS);
    setPrizes(DEFAULT_PRIZES);
    setCurrentPrizeId(DEFAULT_PRIZES[DEFAULT_PRIZES.length - 1].id); // Start from last prize
    setShowSettings(false);
  };

  const handleNextPrize = () => {
    const idx = prizes.findIndex(p => p.id === currentPrizeId);
    if (idx > 0) {
        setCurrentPrizeId(prizes[idx - 1].id);
        setTargetNumber(null);
        setShowConfetti(false);
        setErrorMsg(null);
    }
  };

  const handlePrevPrize = () => {
    const idx = prizes.findIndex(p => p.id === currentPrizeId);
    if (idx < prizes.length - 1) {
        setCurrentPrizeId(prizes[idx + 1].id);
        setTargetNumber(null);
        setShowConfetti(false);
        setErrorMsg(null);
    }
  };

  if (!currentPrize) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      {/* --- Sidebar (History) --- */}
      {showSidebar && !showFinalResults && (
        <div className="w-80 md:w-96 flex-shrink-0 hidden md:block h-full">
          <HistorySidebar
              prizes={prizes}
              currentPrizeId={currentPrizeId}
              winners={winners}
              onSelectPrize={setCurrentPrizeId}
          />
        </div>
      )}

      {/* --- Main Content --- */}
      <main className="flex-1 flex flex-col relative">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4"></div>
        </div>

        {/* Top Bar */}
        <header className="px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center z-10 bg-white/80 backdrop-blur-sm shadow-sm gap-2">
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                {/* Sidebar Toggle Button */}
                <button
                  onClick={() => setShowSidebar(!showSidebar)}
                  className="hidden md:flex p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0"
                  title={showSidebar ? "Ẩn kết quả" : "Hiện kết quả"}
                >
                  {showSidebar ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                </button>
                {/* Logo Section */}
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <div className="relative h-8 sm:h-12 flex-shrink-0">
                        <img
                          src="/logo.png"
                          alt="OSP Group Logo"
                          className="h-full w-auto object-contain"
                          onError={(e) => {
                             e.currentTarget.style.display = 'none';
                             const fallback = document.getElementById('logo-fallback');
                             if(fallback) fallback.style.display = 'flex';
                          }}
                        />
                        <div id="logo-fallback" style={{display: 'none'}} className="h-full items-center gap-2 sm:gap-3">
                             <div className="w-8 h-8 sm:w-12 sm:h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg sm:text-2xl shadow-lg shadow-cyan-200 flex-shrink-0">
                                <span className="font-serif italic">a</span>
                             </div>
                             <div className="flex flex-col justify-center">
                                <h1 className="text-lg sm:text-2xl font-black text-slate-700 tracking-tight leading-none">OSP <span className="text-cyan-600">GROUP</span></h1>
                                <span className="text-[8px] sm:text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase hidden sm:block">Your Solid Partner</span>
                             </div>
                        </div>
                    </div>
                    <div className="h-6 sm:h-8 w-px bg-slate-200 flex-shrink-0"></div>
                    <span className="text-[10px] sm:text-sm font-bold text-cyan-700 uppercase tracking-widest bg-cyan-50 px-2 sm:px-3 py-1 rounded-full border border-cyan-100 whitespace-nowrap overflow-hidden text-ellipsis">
                        YEP 2026
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                 <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-1.5 sm:p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors" title={soundEnabled ? "Tắt âm" : "Bật âm"}>
                    {soundEnabled ? <Volume2 size={18}/> : <VolumeX size={18} />}
                 </button>
                 <button
                    onClick={() => setShowSettings(true)}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm text-xs sm:text-sm"
                 >
                    <Settings size={14} /> <span className="hidden sm:inline">Cài đặt</span>
                 </button>
            </div>
        </header>

        {/* Game Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-0">
            {showConfetti && <Confetti />}

            {/* Final Results View - Show when all prizes complete */}
            {showFinalResults && allPrizesComplete ? (
              <div className="w-full h-full max-w-7xl mx-auto px-2 sm:px-4 py-2 animate-fade-in overflow-hidden flex flex-col">
                <div className="text-center mb-2 sm:mb-3 px-2">
                  <div className="inline-flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-white rounded-full shadow-lg mb-2">
                    <Sparkles size={14} className="animate-pulse hidden sm:block" />
                    <span className="text-sm sm:text-lg font-bold uppercase tracking-wider">Tổng Kết Kết Quả</span>
                    <Sparkles size={14} className="animate-pulse hidden sm:block" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-700 mb-1">
                    Chúc Mừng!
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-600">Year End Party 2026</p>
                </div>

                {/* Final Results Grid - Shows all prizes in a compact grid */}
                <div className="flex-1 overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 pb-2">
                    {[...prizes].sort((a, b) => {
                      // Put special prize first
                      if (a.name === 'Giải Đặc Biệt') return -1;
                      if (b.name === 'Giải Đặc Biệt') return 1;
                      return 0;
                    }).map((prize, prizeIndex) => {
                      const prizeWinners = winners.filter(w => w.prizeId === prize.id);
                      const isSpecialPrize = prize.name === 'Giải Đặc Biệt';
                      return (
                        <div
                          key={prize.id}
                          className={`bg-white rounded-lg shadow-lg overflow-hidden border-2 ${isSpecialPrize ? 'col-span-full' : ''}`}
                          style={{
                            borderColor: isSpecialPrize ? '#f59e0b' : prizeIndex === 1 ? '#9ca3af' : prizeIndex === 2 ? '#cd7f32' : '#06b6d4',
                            borderWidth: isSpecialPrize || prizeIndex < 3 ? '2px' : '1px'
                          }}
                        >
                          <div className="p-2 sm:p-3 text-white bg-gradient-to-r from-cyan-500 to-blue-600">
                            <div className="flex items-center justify-between gap-2">
                              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold uppercase">{prize.name}</h2>
                              <Trophy size={24} className="text-yellow-300 flex-shrink-0" />
                            </div>
                          </div>
                          <div className="p-2 bg-gradient-to-br from-slate-50 to-white">
                            <div className={`grid gap-1 ${prizeWinners.length > 3 ? 'grid-cols-3' : 'grid-cols-1'}`}>
                              {prizeWinners.map((winner) => (
                                <div
                                  key={winner.id}
                                  className={`bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg shadow-sm border border-cyan-100 flex items-center justify-center ${prizeWinners.length > 3 ? 'p-2 sm:p-3 min-h-[50px] sm:min-h-[60px]' : 'p-3 sm:p-4 min-h-[60px] sm:min-h-[80px]'}`}
                                >
                                  <span className={`font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-700 text-center block w-full ${prizeWinners.length > 3 ? 'text-xl sm:text-2xl md:text-3xl' : 'text-3xl sm:text-4xl md:text-5xl'}`}>
                                    {winner.number}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {prizeWinners.length === 0 && (
                              <div className="text-center text-slate-400 italic text-xs py-2">
                                Chưa có người trúng
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Button to exit final results view */}
                <div className="mt-2 text-center px-2">
                  <button
                    onClick={() => setShowFinalResults(false)}
                    className="px-4 sm:px-6 py-2 bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg font-bold text-xs sm:text-sm hover:from-slate-500 hover:to-slate-600 transition-all shadow-lg hover:shadow-xl"
                  >
                    Quay lại màn hình quay thưởng
                  </button>
                </div>
              </div>
            ) : (
              <>
            {/* Normal Game View */}
            {/* Current Prize Info */}

            {/* Current Prize Info */}
            <div className="mb-6 sm:mb-8 md:mb-12 text-center animate-fade-in-down px-2">
                <div className="mb-3 sm:mb-4 flex items-center justify-center">
                   {isPrizeComplete ? (
                     <span className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider shadow-inner">
                        <Trophy size={12} /> <span className="hidden sm:inline">Đã hoàn thành</span><span className="sm:hidden">Hoàn thành</span>
                     </span>
                   ) : (
                     <span className="inline-block px-2 sm:px-3 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider shadow-inner">
                        Đang quay thưởng
                     </span>
                   )}
                </div>

                <h2 className="text-4xl sm:text-5xl md:text-7xl lg:text-9xl font-black text-slate-800 drop-shadow-sm mb-2 sm:mb-3 break-words px-1">
                    {currentPrize.name}
                </h2>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-slate-500 font-medium text-xs sm:text-sm">
                    <span className="flex items-center gap-1 bg-white px-2 sm:px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                       <FastForward size={12}/> {currentPrize.spinMode === 'ALL_AT_ONCE' ? 'Quay nhanh' : 'Quay từng số'}
                    </span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <span className="flex items-center gap-1">
                        Còn lại: <strong className={`text-base sm:text-xl ${isPrizeComplete ? 'text-green-600' : 'text-cyan-600'}`}>{Math.max(0, currentPrize.quantity - currentWinners.length)}</strong> giải
                    </span>
                </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
                <div className="absolute top-20 sm:top-24 left-2 right-2 sm:left-auto sm:right-auto bg-red-100 text-red-700 px-3 sm:px-6 py-2 sm:py-3 rounded-lg border border-red-200 shadow-xl animate-bounce z-50 flex items-center gap-2 text-xs sm:text-sm max-w-md mx-auto">
                    <AlertCircle size={16} />
                    <span className="flex-1 line-clamp-2">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="ml-2 font-bold hover:text-red-900 bg-red-200 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0">X</button>
                </div>
            )}

            {/* Slot Machine */}
            <div className="mb-12 w-full max-w-[95vw] md:max-w-[90vw] transition-transform">
                {/* Winner Navigation (when viewing past winners) */}
                {currentWinners.length > 1 && !isSpinning && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <button
                      onClick={() => setCurrentWinnerIndex((prev: number) => prev > 0 ? prev - 1 : currentWinners.length - 1)}
                      className="p-2 rounded-full bg-white text-slate-600 hover:text-cyan-600 hover:bg-slate-100 shadow-md border border-slate-200 transition-all disabled:opacity-30"
                      disabled={isSpinning}
                    >
                      <FastForward size={18} className="rotate-180" />
                    </button>
                    <span className="text-sm font-medium text-slate-600 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                      {currentWinnerIndex + 1} / {currentWinners.length}
                    </span>
                    <button
                      onClick={() => setCurrentWinnerIndex((prev: number) => prev < currentWinners.length - 1 ? prev + 1 : 0)}
                      className="p-2 rounded-full bg-white text-slate-600 hover:text-cyan-600 hover:bg-slate-100 shadow-md border border-slate-200 transition-all disabled:opacity-30"
                      disabled={isSpinning}
                    >
                      <FastForward size={18} />
                    </button>
                  </div>
                )}
                <SlotMachine
                    ref={slotMachineRef}
                    targetNumber={targetNumber}
                    isSpinning={isSpinning}
                    digitCount={currentPrize.digitCount}
                    spinMode={currentPrize.spinMode}
                    spinDuration={currentPrize.spinDuration}
                    manualRevealMode={currentPrize.manualRevealMode}
                    autoStopMode={currentPrize.autoStopMode}
                    onFinished={handleSpinFinished}
                    onStopDigit={handleStopDigit}
                    onStartedSpin={handleStartSpin}
                    onDigitSpinStart={handleDigitSpinStart}
                    onDigitSpinStop={handleDigitSpinStop}
                    isManualSpinActive={isManualSpinActive}
                />
            </div>

            {/* Controls */}
            <div className="flex flex-row md:flex-row items-center gap-3 sm:gap-6 md:gap-10 z-10 px-2">
                <button
                    onClick={handleNextPrize}
                    disabled={isSpinning || prizes.findIndex(p=>p.id===currentPrizeId) === 0}
                    className="p-2 sm:p-3 md:p-4 rounded-full bg-white text-slate-400 hover:text-cyan-600 hover:shadow-lg hover:-translate-x-0.5 sm:hover:-translate-x-1 transition-all disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:shadow-none shadow-md border border-slate-100 flex-shrink-0"
                    title="Giải cao hơn"
                >
                   <FastForward size={20} className="rotate-180" />
                </button>

                {/* Spin Button - Hidden/Different if complete or MANUAL mode */}
                {isPrizeComplete ? (
                   prizes.findIndex(p=>p.id===currentPrizeId) === 0 ? (
                     // Last prize (highest) - show summary button
                     <button
                        onClick={() => setShowFinalResults(true)}
                        className="group relative px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg md:text-xl uppercase tracking-widest text-white shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 shadow-amber-500/40"
                     >
                        <span className="flex items-center gap-2 sm:gap-3">
                            <Trophy size={16} /> <span className="hidden sm:inline">Tổng kết kết quả</span><span className="sm:hidden">Tổng kết</span>
                        </span>
                     </button>
                   ) : (
                     // Not last prize - show next prize button
                     <button
                        onClick={handleNextPrize}
                        className="group relative px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg md:text-xl uppercase tracking-widest text-white shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-green-500/40"
                     >
                        <span className="flex items-center gap-2 sm:gap-3">
                            <span className="hidden sm:inline">Chuyển giải tiếp theo</span><span className="sm:hidden">Tiếp theo</span> <FastForward size={16} />
                        </span>
                     </button>
                   )
                ) : currentPrize.spinMode === SpinMode.MANUAL ? (
                    /* MANUAL mode - show button when ready, message when spinning */
                    isManualSpinActive ? (
                        <div className="px-6 sm:px-8 py-3 sm:py-4 text-center">
                            <p className="text-sm sm:text-base font-medium text-cyan-700 bg-cyan-50 px-4 py-2 rounded-full border border-cyan-200">
                                {(currentPrize.manualRevealMode || ManualRevealMode.CLICK) === ManualRevealMode.CLICK
                                  ? 'Bấm vào từng ô số để mở'
                                  : 'Đang mở số...'}
                            </p>
                        </div>
                    ) : (
                        <button
                            onClick={handleStartSpin}
                            className="group relative px-6 sm:px-8 md:px-12 py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-2xl font-black text-sm sm:text-lg md:text-xl uppercase tracking-widest text-white shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/40"
                        >
                            <span className="flex items-center gap-2 sm:gap-3">
                                <Play className="fill-current w-5 h-5 sm:w-6 sm:h-6" />
                                {currentWinners.length > 0 ? (
                                    <><span className="hidden sm:inline">Quay số tiếp theo</span><span className="sm:hidden">Tiếp theo</span></>
                                ) : (
                                    <><span className="hidden sm:inline">Bắt đầu quay</span><span className="sm:hidden">Bắt đầu</span></>
                                )}
                            </span>
                        </button>
                    )
                ) : currentPrize.spinMode === SpinMode.ALL_AT_ONCE && currentPrize.autoStopMode === AutoStopMode.MANUAL ? (
                    /* ALL_AT_ONCE + MANUAL stop mode */
                    isSpinning ? (
                        <button
                            onClick={() => slotMachineRef.current?.revealResult()}
                            className="group relative px-8 sm:px-12 md:px-16 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl md:text-3xl uppercase tracking-widest text-white shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 shadow-orange-500/40 animate-pulse"
                        >
                            <span className="flex items-center gap-2 sm:gap-3">
                                <Eye className="w-6 h-6 sm:w-8 sm:h-8" /> <span className="hidden sm:inline">Hiện Kết Quả</span><span className="sm:hidden">Hiện</span>
                            </span>
                        </button>
                    ) : (
                        <button
                            onClick={handleStartSpin}
                            className="group relative px-8 sm:px-12 md:px-16 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl md:text-3xl uppercase tracking-widest text-white shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/40"
                        >
                            <span className="flex items-center gap-2 sm:gap-3">
                                <Play className="fill-current w-6 h-6 sm:w-8 sm:h-8" /> Quay Số
                            </span>
                        </button>
                    )
                ) : (
                    /* ALL_AT_ONCE + TIMER mode or SEQUENTIAL mode */
                    <button
                        onClick={handleStartSpin}
                        disabled={isSpinning}
                        className={`
                            group relative px-8 sm:px-12 md:px-16 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl font-black text-xl sm:text-2xl md:text-3xl uppercase tracking-widest text-white shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0
                            ${isSpinning
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/40'
                            }
                        `}
                    >
                        {isSpinning ? (
                            <span className="flex items-center gap-2 sm:gap-3">
                                <RotateCcw className="animate-spin w-5 h-5 sm:w-6 sm:h-6" /> <span className="hidden sm:inline">Đang quay...</span><span className="sm:hidden">Quay...</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-2 sm:gap-3">
                                <Play className="fill-current w-6 h-6 sm:w-8 sm:h-8" /> Quay Số
                            </span>
                        )}
                    </button>
                )}

                <button
                    onClick={handlePrevPrize}
                    disabled={isSpinning || prizes.findIndex(p=>p.id===currentPrizeId) === prizes.length - 1}
                    className="p-2 sm:p-3 md:p-4 rounded-full bg-white text-slate-400 hover:text-cyan-600 hover:shadow-lg hover:translate-x-0.5 sm:hover:translate-x-1 transition-all disabled:opacity-30 disabled:hover:translate-x-0 disabled:hover:shadow-none shadow-md border border-slate-100 flex-shrink-0"
                    title="Giải thấp hơn"
                >
                   <FastForward size={20} />
                </button>
            </div>
              </>
            )}
        </div>
      </main>

      {/* Modals */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        prizes={prizes}
        setPrizes={setPrizes}
        settings={settings}
        setSettings={setSettings}
        onResetData={handleResetData}
      />
    </div>
  );
};

export default App;
