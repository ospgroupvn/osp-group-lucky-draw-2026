import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { SpinMode, ManualRevealMode, AutoStopMode } from '../types';

interface SlotMachineProps {
  targetNumber: string | null; // The result to land on. Null if just spinning randomly.
  isSpinning: boolean;
  digitCount: number;
  spinMode: SpinMode;
  spinDuration: number; // Time in ms
  manualRevealMode?: ManualRevealMode; // Only used when spinMode is MANUAL - CLICK or TIMER
  autoStopMode?: AutoStopMode; // Only used when spinMode is ALL_AT_ONCE - TIMER or MANUAL
  onFinished: () => void;
  onStopDigit?: () => void; // Trigger sound
  onStartedSpin?: () => void; // Called when spin starts (for MANUAL mode)
  onDigitSpinStart?: () => void; // Called when a digit starts spinning (for MANUAL mode)
  onDigitSpinStop?: (stillSpinning: boolean) => void; // Called when a digit stops spinning (for MANUAL mode). stillSpinning = true if other digits are still spinning
  isManualSpinActive?: boolean; // Track if a MANUAL spin session is active (from parent)
}

// Expose methods to parent via ref
export interface SlotMachineRef {
  revealResult: () => void; // Stop all digits and reveal result (for ALL_AT_ONCE + MANUAL mode)
}

interface SlotDigitProps {
  value: string;
  isSpinning: boolean;
  isStopped: boolean;
  onStop?: () => void;
  onClick?: () => void; // For MANUAL mode - user clicks to stop this digit
  isClickable?: boolean; // Show visual feedback for clickable digits
  showQuestionMark?: boolean; // Show "?" instead of number before spinning (MANUAL mode)
}

const SlotDigit: React.FC<SlotDigitProps> = ({
  value,
  isSpinning,
  isStopped,
  onStop,
  onClick,
  isClickable,
  showQuestionMark
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const intervalRef = useRef<number | null>(null);
  const hasStoppedRef = useRef(isStopped);

  useEffect(() => {
    if (isSpinning && !isStopped) {
      hasStoppedRef.current = false;
      // Start rapid changing
      intervalRef.current = window.setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 10).toString());
      }, 60); // Speed of flicker
    } else if (isStopped) {
      // Stop on target
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayValue(value);

      // Trigger stop callback only once when transitioning from spinning to stopped
      if (!hasStoppedRef.current && isSpinning) {
          hasStoppedRef.current = true;
          if (onStop) onStop();
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isSpinning, isStopped, value, onStop]);

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`relative w-[18vw] h-[26vw] sm:w-[16vw] sm:h-[24vw] md:w-[14vw] md:h-[22vw] lg:w-[12vw] lg:h-[20vw] max-w-[120px] max-h-[180px] sm:max-w-[160px] sm:max-h-[240px] md:max-w-[200px] md:max-h-[300px] min-w-[60px] min-h-[90px] bg-gradient-to-b from-white to-slate-100 border-2 sm:border-4 rounded-lg shadow-inner flex items-center justify-center overflow-hidden mx-0.5 sm:mx-1 md:mx-2 ${
        isClickable ? 'cursor-pointer hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition-all' : ''
      }`}
      title={isClickable ? (isSpinning ? 'Bấm để dừng số này' : 'Bấm để bắt đầu quay') : ''}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/10 pointer-events-none z-10"></div>
      {isClickable && !isStopped && !isSpinning && (
        <div className="absolute inset-0 bg-cyan-400/30 animate-pulse pointer-events-none z-20 rounded-lg"></div>
      )}
      {isClickable && isSpinning && !isStopped && (
        <div className="absolute inset-0 bg-orange-400/20 animate-pulse pointer-events-none z-20 rounded-lg"></div>
      )}
      <span
        className={`font-black text-slate-800 slot-number ${isSpinning && !isStopped ? 'blur-sm scale-110' : 'scale-100'} transition-all duration-200`}
        style={{ fontSize: 'clamp(2.5rem, 10vw, 10rem)' }}
      >
        {/* Show "?" in MANUAL mode before digit is clicked, otherwise show displayValue */}
        {showQuestionMark ? '?' : displayValue}
      </span>
    </div>
  );
};

export const SlotMachine = forwardRef<SlotMachineRef, SlotMachineProps>(({
  targetNumber,
  isSpinning,
  digitCount,
  spinMode,
  spinDuration,
  manualRevealMode = ManualRevealMode.CLICK,
  autoStopMode = AutoStopMode.MANUAL,
  onFinished,
  onStopDigit,
  onStartedSpin,
  onDigitSpinStart,
  onDigitSpinStop,
  isManualSpinActive
}, ref) => {
  // For MANUAL mode: Track individual digit states
  // Each digit can be: waiting (?) → spinning → stopped (showing actual value)
  const [digitSpinningState, setDigitSpinningState] = useState<boolean[]>(
    Array(digitCount).fill(false)
  );
  const [digitStoppedState, setDigitStoppedState] = useState<boolean[]>(
    Array(digitCount).fill(false)
  );
  const [manualSpinStarted, setManualSpinStarted] = useState(false);
  const [pendingClickIndex, setPendingClickIndex] = useState<number | null>(null);

  // Track how many digits are currently spinning (for sound control in MANUAL mode)
  const [spinningDigitCount, setSpinningDigitCount] = useState(0);

  // Reset states when switching between prizes or modes
  useEffect(() => {
    setDigitSpinningState(Array(digitCount).fill(false));
    setDigitStoppedState(Array(digitCount).fill(false));
    setManualSpinStarted(false);
    setPendingClickIndex(null);
    setSpinningDigitCount(0);
  }, [digitCount, spinMode]);

  // Reset states when a new MANUAL spin session starts (isManualSpinActive changes to true)
  const prevIsManualSpinActive = useRef(isManualSpinActive);
  useEffect(() => {
    if (spinMode === SpinMode.MANUAL && isManualSpinActive && !prevIsManualSpinActive.current) {
      // New spin session started - reset all digit states to show "?"
      setDigitSpinningState(Array(digitCount).fill(false));
      setDigitStoppedState(Array(digitCount).fill(false));
      setManualSpinStarted(true);
      setSpinningDigitCount(0);
    }
    prevIsManualSpinActive.current = isManualSpinActive;
  }, [isManualSpinActive, spinMode, digitCount]);

  // Handle MANUAL + TIMER mode: Auto-start all digits spinning when session starts, then stop one by one
  useEffect(() => {
    if (spinMode !== SpinMode.MANUAL || manualRevealMode !== ManualRevealMode.TIMER) return;
    if (!isManualSpinActive || !targetNumber) return;

    // Start all digits spinning at once
    setDigitSpinningState(Array(digitCount).fill(true));
    setSpinningDigitCount(digitCount);

    // Notify parent that digit(s) started spinning
    if (onDigitSpinStart) {
      onDigitSpinStart();
    }

    // Stop digits one by one with timer
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < digitCount; i++) {
      const t = setTimeout(() => {
        // Stop this digit
        setDigitSpinningState(prev => {
          const newState = [...prev];
          newState[i] = false;
          return newState;
        });
        setDigitStoppedState(prev => {
          const newState = [...prev];
          newState[i] = true;
          return newState;
        });

        // Update spinning count
        setSpinningDigitCount(prev => {
          const newCount = prev - 1;
          // Notify parent with whether other digits are still spinning
          if (onDigitSpinStop) {
            onDigitSpinStop(newCount > 0);
          }
          return newCount;
        });

        if (onStopDigit) onStopDigit();
      }, spinDuration * (i + 1));
      timeouts.push(t);
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isManualSpinActive, targetNumber, spinMode, manualRevealMode, digitCount, spinDuration]);

  // When targetNumber arrives after pending click, start spinning that digit
  useEffect(() => {
    if (spinMode === SpinMode.MANUAL && pendingClickIndex !== null && targetNumber) {
      startDigitSpin(pendingClickIndex);
      setPendingClickIndex(null);
    }
  }, [targetNumber]);

  // Reset MANUAL mode state when targetNumber is cleared (after spin completes)
  useEffect(() => {
    if (spinMode === SpinMode.MANUAL && targetNumber === null && manualSpinStarted) {
      // Parent has cleared the targetNumber, reset for next spin
      setManualSpinStarted(false);
      setDigitSpinningState(Array(digitCount).fill(false));
      setDigitStoppedState(Array(digitCount).fill(false));
      setSpinningDigitCount(0);
      setPendingClickIndex(null);
    }
  }, [targetNumber, spinMode, manualSpinStarted, digitCount]);

  // For AUTO modes, sync with isSpinning
  useEffect(() => {
    if (spinMode !== SpinMode.MANUAL) {
      setDigitStoppedState(isSpinning ? Array(digitCount).fill(false) : Array(digitCount).fill(true));
      setDigitSpinningState(Array(digitCount).fill(isSpinning));
    }
  }, [isSpinning, digitCount, spinMode]);

  // Check if all digits are stopped (for MANUAL mode)
  useEffect(() => {
    if (spinMode === SpinMode.MANUAL && manualSpinStarted) {
      const allStopped = digitStoppedState.every(s => s);
      if (allStopped) {
        onFinished();
        // Reset manual spin started state after calling onFinished
        // This prevents multiple calls to onFinished
        setManualSpinStarted(false);
      }
    }
  }, [digitStoppedState, spinMode, onFinished, manualSpinStarted]);

  // Function to reveal result (stop all digits) - used for ALL_AT_ONCE + MANUAL mode
  const revealResult = () => {
    if (!isSpinning || !targetNumber) return;
    setDigitStoppedState(Array(digitCount).fill(true));
    if (onStopDigit) onStopDigit();
    onFinished();
  };

  // Expose revealResult to parent via ref
  useImperativeHandle(ref, () => ({
    revealResult
  }), [isSpinning, targetNumber, digitCount, onStopDigit, onFinished]);

  // Handle Stopping Logic for AUTO modes (ALL_AT_ONCE, SEQUENTIAL)
  useEffect(() => {
    if (spinMode === SpinMode.MANUAL) return; // Skip for MANUAL mode
    if (!isSpinning || !targetNumber) return;

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    if (spinMode === SpinMode.ALL_AT_ONCE) {
      // If autoStopMode is MANUAL, don't auto-stop - wait for user to click reveal button
      if (autoStopMode === AutoStopMode.MANUAL) {
        return; // Don't set any timeout - user will call revealResult via ref
      }
      // Stop all at once after duration (TIMER mode)
      const t = setTimeout(() => {
        setDigitStoppedState(Array(digitCount).fill(true));
        if (onStopDigit) onStopDigit();
        onFinished();
      }, spinDuration);
      timeouts.push(t);
    } else {
      // Sequential
      for (let i = 0; i < digitCount; i++) {
        const t = setTimeout(() => {
          setDigitStoppedState(prev => {
            const newState = [...prev];
            newState[i] = true;
            return newState;
          });

          if (onStopDigit) onStopDigit();

          if (i === digitCount - 1) {
            onFinished();
          }
        }, spinDuration * (i + 1));
        timeouts.push(t);
      }
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [isSpinning, targetNumber, spinMode, spinDuration, digitCount, onFinished, autoStopMode]);

  // Function to start spinning a digit (for MANUAL + CLICK mode - no auto-stop)
  const startDigitSpin = (index: number) => {
    setDigitSpinningState(prev => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });

    // Update spinning count
    setSpinningDigitCount(prev => {
      const newCount = prev + 1;
      // First digit started spinning - notify parent
      if (newCount === 1 && onDigitSpinStart) {
        onDigitSpinStart();
      }
      return newCount;
    });
    // In CLICK mode: Do NOT auto-stop - user must click again to stop
  };

  // Function to stop a spinning digit (for MANUAL + CLICK mode)
  const stopDigitSpin = (index: number) => {
    setDigitSpinningState(prev => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });
    setDigitStoppedState(prev => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });

    // Update spinning count
    setSpinningDigitCount(prev => {
      const newCount = prev - 1;
      // Notify parent with whether other digits are still spinning
      if (onDigitSpinStop) {
        onDigitSpinStop(newCount > 0);
      }
      return newCount;
    });

    if (onStopDigit) onStopDigit();
  };

  // Handle digit click for MANUAL mode (only works in CLICK mode, not TIMER mode)
  const handleDigitClick = (index: number) => {
    if (spinMode !== SpinMode.MANUAL) return;
    if (manualRevealMode === ManualRevealMode.TIMER) return; // TIMER mode doesn't allow clicking

    // If digit is currently spinning, stop it (second click)
    if (digitSpinningState[index]) {
      stopDigitSpin(index);
      return;
    }

    // Check if all digits are stopped (starting a new spin cycle)
    const allStopped = digitStoppedState.every(s => s);

    // If this specific digit is stopped but not all are stopped, can't click
    if (digitStoppedState[index] && !allStopped) return;

    // First click OR starting new cycle after all stopped - generate the winning number
    if (!manualSpinStarted || allStopped) {
      // Reset states for new spin cycle
      if (allStopped) {
        setDigitStoppedState(Array(digitCount).fill(false));
      }
      setManualSpinStarted(true);

      // Only call onStartedSpin if we don't have a targetNumber yet
      // (If targetNumber already exists, it means user clicked "Next number" button)
      if (!targetNumber && onStartedSpin) {
        onStartedSpin();
        // Remember this click to start spinning when targetNumber arrives
        setPendingClickIndex(index);
        return;
      }

      // If we already have targetNumber (from button click), start spinning immediately
      startDigitSpin(index);
      return;
    }

    // Check if we have a target number before allowing digit to spin
    if (!targetNumber) return;

    // Start spinning this digit
    startDigitSpin(index);
  };

  // Pad target number or use "000" placeholder
  const safeTarget = targetNumber ? targetNumber.padStart(digitCount, '0') : '0'.repeat(digitCount);

  // In MANUAL mode, show ? for digits that are: waiting (not stopped, not spinning) OR have no targetNumber
  const getShowQuestionMark = (idx: number) => {
    // Always show ? if no targetNumber (for all modes)
    if (!targetNumber) return true;
    // For MANUAL mode: show ? for waiting digits (not stopped, not spinning)
    if (spinMode === SpinMode.MANUAL) {
      return !digitStoppedState[idx] && !digitSpinningState[idx];
    }
    // For AUTO modes: show ? only when not spinning and no target
    return false;
  };

  // In MANUAL mode with CLICK reveal:
  // - Click once to START spinning a digit
  // - Click again to STOP that spinning digit
  // - Only ONE digit can spin at a time (other digits are disabled while one is spinning)
  // In TIMER mode, clicking is disabled
  const areAllDigitsStopped = digitStoppedState.every(s => s);
  const isAnyDigitSpinning = digitSpinningState.some(s => s);
  const isDigitClickable = (idx: number) => {
    if (spinMode !== SpinMode.MANUAL) return false;
    if (manualRevealMode === ManualRevealMode.TIMER) return false; // TIMER mode doesn't allow clicking
    // Allow clicking if THIS digit is spinning (to stop it)
    if (digitSpinningState[idx]) return true;
    // If ANY digit is currently spinning, disable all other digits
    if (isAnyDigitSpinning) return false;
    // Allow clicking any digit if all are stopped (starting new spin cycle)
    if (areAllDigitsStopped) return true;
    // Allow clicking digits that are not yet stopped
    if (!digitStoppedState[idx]) return true;
    return false;
  };

  return (
    <div className="flex justify-center items-center px-3 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 bg-slate-800/50 rounded-xl sm:rounded-2xl shadow-2xl backdrop-blur-sm border border-white/10">
      {Array.from({ length: digitCount }).map((_, idx) => (
        <SlotDigit
          key={idx}
          value={safeTarget[idx]}
          isSpinning={digitSpinningState[idx]}
          isStopped={digitStoppedState[idx]}
          onClick={() => handleDigitClick(idx)}
          isClickable={isDigitClickable(idx)}
          showQuestionMark={getShowQuestionMark(idx)}
        />
      ))}
    </div>
  );
});
