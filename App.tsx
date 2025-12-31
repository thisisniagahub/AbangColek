
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import GeminiFruitSlicer from './components/GeminiFruitSlicer';
import GeminiSlingshot from './components/GeminiSlingshot';
import { Gamepad2, ArrowLeft, Zap, Target, Sparkles, ChevronRight } from 'lucide-react';

type GameMode = 'MENU' | 'SLICER' | 'SLINGSHOT';

const App: React.FC = () => {
  const [gameMode, setGameMode] = useState<GameMode>('MENU');

  const renderContent = () => {
    switch (gameMode) {
      case 'SLICER':
        return <GeminiFruitSlicer />;
      case 'SLINGSHOT':
        return <GeminiSlingshot />;
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-950 text-white p-6 relative overflow-hidden font-roboto selection:bg-yellow-500/30">
             {/* Magic UI Backgrounds */}
             <div className="absolute inset-0 h-full w-full bg-neutral-950 bg-grid-white/[0.05] bg-[bottom_1px_center] [mask-image:linear-gradient(to_bottom,transparent,black)] pointer-events-none" />
             <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/20 rounded-full blur-[128px] pointer-events-none animate-pulse" />
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[128px] pointer-events-none" />
             
             <div className="z-10 w-full max-w-5xl animate-in fade-in zoom-in duration-700 flex flex-col items-center">
                
                {/* Header Section */}
                <div className="text-center mb-16 relative group cursor-default">
                    <div className="absolute inset-0 -inset-x-8 bg-gradient-to-r from-yellow-500/0 via-yellow-500/10 to-orange-500/0 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <div className="mb-6 flex justify-center">
                        <div className="relative">
                             <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-600 blur-xl opacity-50 animate-pulse" />
                             <div className="relative bg-gradient-to-br from-neutral-800 to-neutral-900 p-6 rounded-[2rem] border border-white/10 shadow-2xl rotate-3 transform group-hover:rotate-6 transition-all duration-500">
                                <Gamepad2 className="w-16 h-16 text-yellow-500 drop-shadow-md" />
                            </div>
                        </div>
                    </div>
                    
                    <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-br from-white via-neutral-200 to-neutral-500 drop-shadow-sm select-none">
                        ABANG ARCADE
                    </h1>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        <span className="text-xs font-medium tracking-widest uppercase text-neutral-400">Powered by Google Gemini 3 Flash</span>
                    </div>
                </div>

                {/* Bento Grid Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full px-4">
                    {/* Fruit Ninja Card */}
                    <button 
                        onClick={() => setGameMode('SLICER')}
                        className="group relative h-full overflow-hidden rounded-[2.5rem] bg-neutral-900/50 border border-white/10 hover:border-yellow-500/50 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(234,179,8,0.3)] text-left"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500" />
                        
                        <div className="relative p-8 h-full flex flex-col justify-between z-10">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-yellow-500/20">
                                    <Zap className="w-6 h-6 text-yellow-500" />
                                </div>
                                <h3 className="text-3xl font-black italic text-white mb-3 group-hover:translate-x-1 transition-transform">FRUIT NINJA</h3>
                                <p className="text-sm text-neutral-400 leading-relaxed max-w-sm">
                                    Use your hand as a digital blade. Slice fruits, build combos, and listen to the AI Sensei's wisdom.
                                </p>
                            </div>
                            
                            <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-yellow-500/80 bg-yellow-500/10 px-3 py-1.5 rounded-full uppercase tracking-wider">
                                    <span>AI Vision Analysis</span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-black transition-all duration-300">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </button>

                    {/* Slingshot Card */}
                    <button 
                        onClick={() => setGameMode('SLINGSHOT')}
                        className="group relative h-full overflow-hidden rounded-[2.5rem] bg-neutral-900/50 border border-white/10 hover:border-blue-500/50 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(59,130,246,0.3)] text-left"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500" />
                        
                        <div className="relative p-8 h-full flex flex-col justify-between z-10">
                            <div>
                                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 border border-blue-500/20">
                                    <Target className="w-6 h-6 text-blue-500" />
                                </div>
                                <h3 className="text-3xl font-black italic text-white mb-3 group-hover:translate-x-1 transition-transform">BUBBLE SLINGSHOT</h3>
                                <p className="text-sm text-neutral-400 leading-relaxed max-w-sm">
                                    Pinch your fingers to aim and shoot. Solve bubble puzzles with tactical support from the AI.
                                </p>
                            </div>
                            
                            <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-6">
                                <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500/80 bg-blue-500/10 px-3 py-1.5 rounded-full uppercase tracking-wider">
                                    <span>Strategic Engine</span>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-black transition-all duration-300">
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </button>
                </div>
             </div>
             
             <div className="absolute bottom-6 text-neutral-700 text-[10px] font-mono uppercase tracking-widest hover:text-neutral-500 transition-colors cursor-help">
                v1.2.0 • Magic UI Edition
             </div>
          </div>
        );
    }
  };

  return (
    <div className="w-full h-full relative bg-neutral-950">
      {renderContent()}
      
      {gameMode !== 'MENU' && (
          <button 
            onClick={() => setGameMode('MENU')}
            className="absolute top-6 left-6 z-[200] bg-black/20 backdrop-blur-xl p-3 rounded-full border border-white/10 hover:bg-white/10 transition-all group shadow-2xl active:scale-95"
            title="Back to Menu"
          >
            <ArrowLeft className="w-5 h-5 text-white group-hover:-translate-x-0.5 transition-transform" />
          </button>
      )}
    </div>
  );
};

export default App;
