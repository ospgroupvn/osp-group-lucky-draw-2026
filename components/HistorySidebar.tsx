import React from 'react';
import { Prize, Winner } from '../types';
import { Trophy, Clock, Users, Hash } from 'lucide-react';

interface HistorySidebarProps {
  prizes: Prize[];
  currentPrizeId: string;
  winners: Winner[];
  onSelectPrize: (id: string) => void;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({
  prizes,
  currentPrizeId,
  winners,
  onSelectPrize,
}) => {
  return (
    <div className="w-full h-full flex flex-col bg-white border-r border-slate-200 shadow-xl z-20">
      {/* Header */}
      <div className="p-6 bg-slate-900 text-white flex items-center gap-3 shadow-md">
        <Trophy className="w-6 h-6 text-yellow-400" />
        <h2 className="text-xl font-bold uppercase tracking-wider">Kết Quả</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-6">
        {prizes.map((prize) => {
          const prizeWinners = winners.filter(w => w.prizeId === prize.id);
          const isCurrent = prize.id === currentPrizeId;
          const isComplete = prizeWinners.length >= prize.quantity;

          return (
            <div 
              key={prize.id} 
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isCurrent 
                  ? 'border-cyan-500 ring-2 ring-cyan-100 shadow-lg bg-cyan-50/50' 
                  : 'border-slate-200 bg-white hover:border-cyan-200'
              }`}
            >
              <div 
                onClick={() => onSelectPrize(prize.id)}
                className={`p-3 cursor-pointer flex justify-between items-center ${
                  isCurrent ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white' : 'bg-slate-50 text-slate-700'
                }`}
              >
                <div>
                  <h3 className="font-bold text-2xl md:text-3xl">{prize.name}</h3>
                  <div className="flex items-center gap-2 text-sm opacity-90 mt-1">
                    <span className="flex items-center gap-1"><Users size={16}/> {prizeWinners.length}/{prize.quantity}</span>
                    <span className="flex items-center gap-1"><Hash size={16}/> {prize.digitCount} số</span>
                  </div>
                </div>
                {isCurrent && <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>}
              </div>

              {/* Winners List */}
              <div className="p-2 space-y-1">
                {prizeWinners.length === 0 ? (
                  <div className="text-center text-slate-400 text-xs py-2 italic">Chưa có kết quả</div>
                ) : (
                  <div className="grid grid-cols-1 gap-1">
                    {prizeWinners.map((w) => (
                      <div key={w.id} className="bg-white border border-slate-100 rounded px-3 py-3 flex items-center justify-center shadow-sm min-h-[70px]">
                        <span className="font-mono font-bold text-4xl text-slate-800 text-center block w-full">{w.number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
