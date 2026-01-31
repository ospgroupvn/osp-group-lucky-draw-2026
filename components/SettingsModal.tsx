import React, { useState, useEffect } from 'react';
import { Prize, GlobalSettings, SpinMode, RandomSource, ManualRevealMode } from '../types';
import { X, Plus, Trash2, Save, Settings as SettingsIcon } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prizes: Prize[];
  setPrizes: (p: Prize[]) => void;
  settings: GlobalSettings;
  setSettings: (s: GlobalSettings) => void;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  prizes,
  setPrizes,
  settings,
  setSettings,
  onResetData
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'prizes'>('general');

  // Local state for editing
  const [localPrizes, setLocalPrizes] = useState<Prize[]>([]);
  const [localSettings, setLocalSettings] = useState<GlobalSettings | null>(null);

  // Sync local state with props when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalPrizes(JSON.parse(JSON.stringify(prizes)));
      setLocalSettings(JSON.parse(JSON.stringify(settings)));
    }
  }, [isOpen, prizes, settings]);

  const handleSave = () => {
    if (localSettings) setSettings(localSettings);
    setPrizes(localPrizes);
    onClose();
  };

  const handlePrizeChange = (index: number, field: keyof Prize, value: any) => {
    const newPrizes = [...localPrizes];
    newPrizes[index] = { ...newPrizes[index], [field]: value };

    // When switching to MANUAL mode, set default manualRevealMode to CLICK if not set
    if (field === 'spinMode' && value === SpinMode.MANUAL && !newPrizes[index].manualRevealMode) {
      newPrizes[index].manualRevealMode = ManualRevealMode.CLICK;
    }

    setLocalPrizes(newPrizes);
  };

  const addPrize = () => {
    const newPrize: Prize = {
      id: `prize-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More robust ID
      name: 'Giải Mới',
      quantity: 1,
      spinMode: SpinMode.ALL_AT_ONCE,
      spinDuration: 4000,
      digitCount: 3,
    };
    setLocalPrizes([...localPrizes, newPrize]);
  };

  const removePrize = (index: number) => {
    if (confirm('Bạn có chắc chắn muốn xóa giải này không?')) {
      const newPrizes = localPrizes.filter((_, i) => i !== index);
      setLocalPrizes(newPrizes);
    }
  };

  if (!isOpen || !localSettings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-white w-full max-w-3xl sm:max-w-4xl max-h-[90vh] sm:max-h-[85vh] rounded-xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b flex justify-between items-center bg-slate-50 gap-2">
          <h2 className="text-base sm:text-xl font-bold flex items-center gap-2 text-slate-800">
            <SettingsIcon className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600" /> <span className="hidden sm:inline">Cài đặt hệ thống</span><span className="sm:hidden">Cài đặt</span>
          </h2>
          <button onClick={onClose} className="p-1.5 sm:p-2 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`flex-1 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors ${activeTab === 'general' ? 'border-b-2 border-cyan-500 text-cyan-700 bg-cyan-50' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('general')}
          >
            Cấu hình chung
          </button>
          <button
            className={`flex-1 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors ${activeTab === 'prizes' ? 'border-b-2 border-cyan-500 text-cyan-700 bg-cyan-50' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('prizes')}
          >
            Cơ cấu giải
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-50 custom-scroll">
          {activeTab === 'general' ? (
            <div className="space-y-4 sm:space-y-6 max-w-lg mx-auto">
              <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm space-y-3 sm:space-y-4">
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-slate-700">Phạm vi quay số</h3>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1">Số nhỏ nhất</label>
                    <input
                      type="number"
                      value={localSettings.minNumber}
                      onChange={(e) => setLocalSettings({ ...localSettings, minNumber: Number(e.target.value) })}
                      className="w-full border rounded-lg px-2 sm:px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1">Số lớn nhất</label>
                    <input
                      type="number"
                      value={localSettings.maxNumber}
                      onChange={(e) => setLocalSettings({ ...localSettings, maxNumber: Number(e.target.value) })}
                      className="w-full border rounded-lg px-2 sm:px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-start gap-2 sm:gap-3 mt-2">
                  <input
                    type="checkbox"
                    id="exclude"
                    checked={localSettings.excludePreviousWinners}
                    onChange={(e) => setLocalSettings({ ...localSettings, excludePreviousWinners: e.target.checked })}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 rounded focus:ring-cyan-500 mt-0.5 sm:mt-0 flex-shrink-0"
                  />
                  <label htmlFor="exclude" className="text-xs sm:text-sm font-medium text-slate-700">
                    Không quay lại số đã trúng
                  </label>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm space-y-3 sm:space-y-4">
                <h3 className="font-bold text-base sm:text-lg mb-3 sm:mb-4 text-slate-700">Nguồn ngẫu nhiên</h3>
                <div className="space-y-2">
                  <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1">Loại random</label>
                  <select
                    value={localSettings.randomSource}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLocalSettings({ ...localSettings, randomSource: e.target.value as RandomSource })}
                    className="w-full border rounded-lg px-2 sm:px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <option value={RandomSource.LOCAL}>Local (crypto.getRandomValues)</option>
                    <option value={RandomSource.RANDOM_ORG}>Random.org API (true random)</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    {localSettings.randomSource === RandomSource.LOCAL
                      ? 'Dùng thuật toán ngẫu nhiên an toàn của trình duyệt.'
                      : 'Dùng Random.org API - cần kết nối mạng và API key.'}
                  </p>
                </div>
                {localSettings.randomSource === RandomSource.RANDOM_ORG && (
                  <div className="space-y-2">
                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1">API Key (Random.org)</label>
                    <input
                      type="text"
                      value={localSettings.randomOrgApiKey || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, randomOrgApiKey: e.target.value })}
                      className="w-full border rounded-lg px-2 sm:px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                      placeholder="Nhập API key từ random.org"
                    />
                    <p className="text-xs text-slate-500">Lấy free API key tại <a href="https://api.random.org/" target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">api.random.org</a></p>
                  </div>
                )}
              </div>

              <div className="bg-red-50 p-4 sm:p-6 rounded-xl border border-red-100">
                <h3 className="font-bold text-sm sm:text-base text-red-700 mb-2">Vùng nguy hiểm</h3>
                <p className="text-xs sm:text-sm text-red-600 mb-3 sm:mb-4">Xóa toàn bộ lịch sử quay số và danh sách người trúng giải.</p>
                <button
                  onClick={() => {
                    if (confirm("Bạn chắc chắn muốn xóa toàn bộ dữ liệu?")) {
                      onResetData();
                      onClose();
                    }
                  }}
                  className="px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-xs sm:text-sm"
                >
                  Reset Dữ Liệu
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {localPrizes.map((prize, index) => (
                <div key={prize.id} className="bg-white p-3 sm:p-4 rounded-xl border shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <span className="bg-slate-100 text-slate-500 font-bold px-2 py-1 rounded text-xs flex-shrink-0">#{index + 1}</span>
                      <input
                        type="text"
                        value={prize.name}
                        onChange={(e) => handlePrizeChange(index, 'name', e.target.value)}
                        className="font-bold text-base sm:text-lg text-slate-800 border-b border-transparent focus:border-cyan-500 focus:outline-none bg-transparent w-full min-w-0"
                        placeholder="Tên giải thưởng..."
                      />
                    </div>
                    <button onClick={() => removePrize(index)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <label className="block text-slate-500 text-[10px] sm:text-xs mb-1">Số lượng</label>
                      <input
                        type="number"
                        min={1}
                        value={prize.quantity}
                        onChange={(e) => handlePrizeChange(index, 'quantity', Number(e.target.value))}
                        className="w-full border rounded px-2 py-1.5 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-[10px] sm:text-xs mb-1">Số chữ số</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={prize.digitCount}
                        onChange={(e) => handlePrizeChange(index, 'digitCount', Number(e.target.value))}
                        className="w-full border rounded px-2 py-1.5 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 text-[10px] sm:text-xs mb-1">Kiểu quay</label>
                      <select
                        value={prize.spinMode}
                        onChange={(e) => handlePrizeChange(index, 'spinMode', e.target.value)}
                        className="w-full border rounded px-2 py-1.5 bg-white focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      >
                        <option value={SpinMode.ALL_AT_ONCE}>Cùng lúc</option>
                        <option value={SpinMode.SEQUENTIAL}>Lần lượt</option>
                        <option value={SpinMode.MANUAL}>Bấm từng số</option>
                      </select>
                    </div>
                    {/* Hide duration field when MANUAL + CLICK mode (no timer needed) */}
                    {!(prize.spinMode === SpinMode.MANUAL && (prize.manualRevealMode || ManualRevealMode.CLICK) === ManualRevealMode.CLICK) && (
                      <div>
                        <label className="block text-slate-500 text-[10px] sm:text-xs mb-1">Thời gian (ms)</label>
                        <input
                          type="number"
                          step={100}
                          value={prize.spinDuration}
                          onChange={(e) => handlePrizeChange(index, 'spinDuration', Number(e.target.value))}
                          className="w-full border rounded px-2 py-1.5 focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                        />
                      </div>
                    )}
                  </div>
                  {/* Manual reveal mode option - only show when spinMode is MANUAL */}
                  {prize.spinMode === SpinMode.MANUAL && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <label className="block text-slate-500 text-[10px] sm:text-xs mb-1">Cách mở số (chế độ MANUAL)</label>
                      <select
                        value={prize.manualRevealMode || ManualRevealMode.CLICK}
                        onChange={(e) => handlePrizeChange(index, 'manualRevealMode', e.target.value)}
                        className="w-full border rounded px-2 py-1.5 bg-white focus:ring-2 focus:ring-cyan-500 outline-none text-sm"
                      >
                        <option value={ManualRevealMode.CLICK}>Bấm thủ công từng số</option>
                        <option value={ManualRevealMode.TIMER}>Tự động mở theo hẹn giờ</option>
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {(prize.manualRevealMode || ManualRevealMode.CLICK) === ManualRevealMode.CLICK
                          ? 'Người điều khiển bấm vào từng ô số để mở'
                          : 'Sau khi bấm nút quay, các số sẽ tự động mở lần lượt theo thời gian đã cài đặt'}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              <button
                onClick={addPrize}
                className="w-full py-2.5 sm:py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-cyan-500 hover:text-cyan-600 font-medium text-sm flex items-center justify-center gap-2 transition-all bg-slate-50 hover:bg-white"
              >
                <Plus size={18} /> Thêm Giải Thưởng
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t bg-white flex justify-end gap-2 sm:gap-3">
          <button
            onClick={onClose}
            className="px-4 sm:px-6 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition-colors text-sm"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 sm:px-6 py-2 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-200 text-sm"
          >
            <Save size={16} /> <span className="hidden sm:inline">Lưu Thay Đổi</span><span className="sm:hidden">Lưu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
