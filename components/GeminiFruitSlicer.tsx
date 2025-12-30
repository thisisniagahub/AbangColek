
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { getSenseiAdvice } from '../services/geminiService';
import { Point, Fruit, Particle, FruitType, DebugInfo } from '../types';
import { Loader2, Trophy, BrainCircuit, Play, Eye, Terminal, Target, Lightbulb, Monitor, Zap, Timer, Medal, ChevronRight, RotateCcw, Sparkles, CameraOff } from 'lucide-react';

const GRAVITY = 0.22;
const INITIAL_SPAWN_INTERVAL = 1400;
const BLADE_TRAIL_LIMIT = 6;
const GAME_DURATION = 60; // seconds

const FRUIT_CONFIG: Record<FruitType, { hex: string, points: number, label: string, radius: number }> = {
  guava:       { hex: '#4CAF50', points: 10,  label: 'Guava',       radius: 38 },
  mango:       { hex: '#FFC107', points: 20,  label: 'Mango',       radius: 42 },
  pineapple:   { hex: '#FFEB3B', points: 50,  label: 'Pineapple',   radius: 54 },
  sweet_mango: { hex: '#FF5722', points: 150, label: 'Sweet Mango', radius: 46 }
};

type GameState = 'START' | 'PLAYING' | 'GAMEOVER';

const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const GeminiFruitSlicer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDestroyed = useRef<boolean>(false);
  
  // Game state refs
  const fruits = useRef<Fruit[]>([]);
  const particles = useRef<Particle[]>([]);
  const bladeTrail = useRef<Point[]>([]);
  const scoreRef = useRef<number>(0);
  const lastSpawnTime = useRef<number>(0);
  const captureRequestRef = useRef<boolean>(false);
  const gameActive = useRef<boolean>(false);

  // React UI state
  const [gameState, setGameState] = useState<GameState>('START');
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [senseiHint, setSenseiHint] = useState<string>("Sensei is watching...");
  const [senseiRationale, setSenseiRationale] = useState<string | null>(null);
  const [techniqueTip, setTechniqueTip] = useState<string | null>(null);
  const [priorityFruit, setPriorityFruit] = useState<FruitType | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [isAiThinking, setIsAiThinking] = useState(false);

  const startGame = () => {
    scoreRef.current = 0;
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setLevel(1);
    fruits.current = [];
    particles.current = [];
    gameActive.current = true;
    setGameState('PLAYING');
  };

  const spawnFruit = (width: number, height: number) => {
    const typeChance = Math.random();
    let type: FruitType = 'guava';
    if (typeChance > 0.93) type = 'sweet_mango';
    else if (typeChance > 0.78) type = 'pineapple';
    else if (typeChance > 0.45) type = 'mango';

    const config = FRUIT_CONFIG[type];
    const levelBonus = (level - 1) * 1.5;
    
    fruits.current.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: Math.random() * (width - 200) + 100,
      y: height + 80,
      vx: (Math.random() - 0.5) * (7 + levelBonus),
      vy: -(Math.random() * 5 + 14 + levelBonus),
      radius: config.radius,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.18,
      isSliced: false
    });
  };

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 30; i++) {
      particles.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 22,
        vy: (Math.random() - 0.5) * 22,
        life: 1.0,
        color
      });
    }
  };

  const performAiAnalysis = async (screenshot: string) => {
    if (!gameActive.current || isDestroyed.current) return;
    setIsAiThinking(true);
    const activeData = fruits.current.filter(f => !f.isSliced).map(f => ({ type: f.type, y: f.y }));
    
    try {
      const res = await getSenseiAdvice(screenshot, activeData, scoreRef.current);
      if (isDestroyed.current) return;
      setSenseiHint(res.hint.message);
      setSenseiRationale(res.hint.rationale || null);
      setTechniqueTip(res.hint.techniqueTip || null);
      setPriorityFruit(res.hint.priorityFruit || null);
      setDebugInfo(res.debug);
    } catch (e) {
      console.error("AI Analysis failed", e);
    } finally {
      setIsAiThinking(false);
    }
  };

  const drawFruit = (ctx: CanvasRenderingContext2D, fruit: Fruit) => {
    const config = FRUIT_CONFIG[fruit.type];
    ctx.save();
    ctx.translate(fruit.x, fruit.y);
    ctx.rotate(fruit.rotation);

    if (fruit.isSliced) {
      const angle = fruit.sliceAngle || 0;
      ctx.rotate(angle);
      
      ctx.save();
      ctx.translate(0, -10);
      drawDetailedFruit(ctx, fruit.type, fruit.radius, true);
      ctx.restore();
      
      ctx.save();
      ctx.translate(0, 10);
      drawDetailedFruit(ctx, fruit.type, fruit.radius, false);
      ctx.restore();
    } else {
      drawDetailedFruit(ctx, fruit.type, fruit.radius);
    }
    ctx.restore();
  };

  const drawDetailedFruit = (ctx: CanvasRenderingContext2D, type: FruitType, radius: number, isHalfTop?: boolean) => {
    const config = FRUIT_CONFIG[type];
    const color = config.hex;
    
    ctx.beginPath();
    
    if (type === 'mango' || type === 'sweet_mango') {
        ctx.moveTo(-radius, 0);
        ctx.bezierCurveTo(-radius, -radius * 1.3, radius, -radius * 1.6, radius, 0);
        ctx.bezierCurveTo(radius, radius * 1.3, -radius, radius * 0.9, -radius, 0);
    } else if (type === 'pineapple') {
        ctx.ellipse(0, 0, radius * 0.8, radius, 0, 0, Math.PI * 2);
    } else {
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
    }

    ctx.save();
    if (isHalfTop === true) ctx.clip(new Path2D(`M -200 -200 L 200 -200 L 200 -2 L -200 -2 Z`));
    if (isHalfTop === false) ctx.clip(new Path2D(`M -200 200 L 200 200 L 200 2 L -200 2 Z`));

    const grad = ctx.createRadialGradient(-radius*0.4, -radius*0.4, radius*0.1, 0, 0, radius);
    if (type === 'mango' || type === 'sweet_mango') {
        grad.addColorStop(0, '#FFD54F');
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, adjustColor(color, -60));
    } else if (type === 'guava') {
        grad.addColorStop(0, '#AED581');
        grad.addColorStop(1, '#33691E');
    } else {
        grad.addColorStop(0, color);
        grad.addColorStop(1, adjustColor(color, -60));
    }
    
    ctx.fillStyle = grad;
    ctx.fill();

    if (type === 'pineapple') {
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1;
        for (let i = -radius; i < radius; i += 12) {
            ctx.beginPath(); ctx.moveTo(i, -radius); ctx.lineTo(i + 20, radius); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(i + 20, -radius); ctx.lineTo(i, radius); ctx.stroke();
        }
        if (isHalfTop === undefined || isHalfTop === true) {
            ctx.fillStyle = '#2E7D32';
            ctx.beginPath();
            ctx.moveTo(-15, -radius + 5);
            ctx.lineTo(0, -radius - 35);
            ctx.lineTo(15, -radius + 5);
            ctx.fill();
        }
    } else if (type === 'guava') {
        ctx.fillStyle = 'rgba(0,0,0,0.05)';
        for(let i=0; i<15; i++) {
            ctx.beginPath(); ctx.arc((Math.random()-0.5)*radius, (Math.random()-0.5)*radius, 2, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.restore();

    ctx.strokeStyle = adjustColor(color, -80);
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-radius*0.35, -radius*0.35, radius*0.35, radius*0.18, Math.PI/4, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
  };

  useEffect(() => {
    isDestroyed.current = false;
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let camera: any = null;
    let hands: any = null;

    const onResults = (results: any) => {
      if (isDestroyed.current) return;
      setLoading(false);
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      ctx.save();
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(10, 10, 10, 0.82)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (gameState !== 'PLAYING') {
          ctx.restore();
          return;
      }

      let handPoint: Point | null = null;
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const landmarks = results.multiHandLandmarks[0];
        handPoint = {
          x: landmarks[8].x * canvas.width,
          y: landmarks[8].y * canvas.height
        };
        bladeTrail.current.push(handPoint);
        if (bladeTrail.current.length > BLADE_TRAIL_LIMIT) bladeTrail.current.shift();
      } else {
        bladeTrail.current = [];
      }

      const now = performance.now();
      const currentSpawnRate = Math.max(450, INITIAL_SPAWN_INTERVAL - (level * 180));
      if (now - lastSpawnTime.current > currentSpawnRate) {
        spawnFruit(canvas.width, canvas.height);
        lastSpawnTime.current = now;
        if (Math.random() > 0.88) captureRequestRef.current = true;
      }

      if (bladeTrail.current.length >= 2) {
        const p1 = bladeTrail.current[bladeTrail.current.length - 2];
        const p2 = bladeTrail.current[bladeTrail.current.length - 1];
        
        fruits.current.forEach(fruit => {
          if (!fruit.isSliced) {
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const lineLenSq = dx*dx + dy*dy;
            if (lineLenSq < 10) return;

            const dist = Math.abs(dy * fruit.x - dx * fruit.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(lineLenSq);
            const inBoundsX = fruit.x > Math.min(p1.x, p2.x) - fruit.radius && fruit.x < Math.max(p1.x, p2.x) + fruit.radius;
            const inBoundsY = fruit.y > Math.min(p1.y, p2.y) - fruit.radius && fruit.y < Math.max(p1.y, p2.y) + fruit.radius;

            if (dist < fruit.radius && inBoundsX && inBoundsY) {
              fruit.isSliced = true;
              fruit.sliceAngle = Math.atan2(dy, dx);
              const config = FRUIT_CONFIG[fruit.type];
              scoreRef.current += config.points;
              setScore(scoreRef.current);
              
              const nextLevel = Math.floor(scoreRef.current / 1200) + 1;
              if (nextLevel > level) {
                setLevel(nextLevel);
                setShowLevelUp(true);
                setTimeout(() => setShowLevelUp(false), 2000);
              }
              createExplosion(fruit.x, fruit.y, config.hex);
            }
          }
        });
      }

      for (let i = fruits.current.length - 1; i >= 0; i--) {
        const f = fruits.current[i];
        f.x += f.vx; f.y += f.vy; f.vy += GRAVITY;
        f.rotation += f.rotationSpeed;
        if (f.y > canvas.height + 150) fruits.current.splice(i, 1);
        else drawFruit(ctx, f);
      }

      if (bladeTrail.current.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(bladeTrail.current[0].x, bladeTrail.current[0].y);
        for (let i = 1; i < bladeTrail.current.length; i++) {
          ctx.lineTo(bladeTrail.current[i].x, bladeTrail.current[i].y);
        }
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 12;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = 25;
        ctx.shadowColor = '#03A9F4';
        ctx.stroke();
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx; p.y += p.vy; p.life -= 0.045;
        if (p.life <= 0) particles.current.splice(i, 1);
        else {
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.restore();

      if (captureRequestRef.current && !isAiThinking) {
        captureRequestRef.current = false;
        const offscreen = document.createElement('canvas');
        offscreen.width = 480; offscreen.height = 270;
        const oCtx = offscreen.getContext('2d');
        if (oCtx) {
          oCtx.drawImage(canvas, 0, 0, offscreen.width, offscreen.height);
          performAiAnalysis(offscreen.toDataURL('image/jpeg', 0.6));
        }
      }
    };

    if (window.Hands) {
      hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      if (window.Camera && videoRef.current) {
        camera = new window.Camera(videoRef.current, {
          onFrame: async () => { 
            if (isDestroyed.current || !videoRef.current || !hands) return;
            try {
              await hands.send({ image: videoRef.current });
            } catch (e) {
              console.warn("Hands tracking frame skipped", e);
            }
          },
          width: 1280, height: 720,
        });
        
        camera.start()
          .then(() => {
            setCameraError(null);
          })
          .catch((e: any) => {
            console.error("Camera start failed", e);
            setLoading(false);
            if (e.name === 'NotAllowedError' || e.message?.includes('Permission denied')) {
                setCameraError("Akses kamera ditolak. Mohon izinkan akses kamera di browser Anda untuk bermain.");
            } else {
                setCameraError("Gagal memulai kamera. Pastikan kamera terhubung dan tidak digunakan aplikasi lain.");
            }
          });
      }
    }

    return () => { 
      isDestroyed.current = true;
      if (camera) camera.stop(); 
      if (hands) hands.close(); 
    };
  }, [gameState, level]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) {
                gameActive.current = false;
                setGameState('GAMEOVER');
                return 0;
            }
            return prev - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const getMedal = () => {
    if (score >= 4000) return { label: 'DIAMOND', color: '#B2EBF2', icon: '💎' };
    if (score >= 2500) return { label: 'GOLD', color: '#FFD700', icon: '🏆' };
    if (score >= 1200) return { label: 'SILVER', color: '#C0C0C0', icon: '🥈' };
    if (score >= 500) return { label: 'BRONZE', color: '#CD7F32', icon: '🥉' };
    return null;
  };

  const currentMedal = getMedal();
  const accentColor = priorityFruit ? FRUIT_CONFIG[priorityFruit].hex : '#03A9F4';

  return (
    <div className="flex w-full h-screen bg-[#0a0a0a] overflow-hidden font-roboto text-[#e3e3e3] select-none">
      
      {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 z-[100] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm animate-in fade-in duration-500">
              <div className="bg-[#1a1a1a] border border-white/10 p-12 rounded-[48px] text-center max-w-lg w-full shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500" />
                  <h2 className="text-5xl font-black mb-2 tracking-tighter text-red-500 italic uppercase">HABIS WAKTU!</h2>
                  <p className="text-gray-400 mb-8 font-black uppercase tracking-[0.4em] text-[10px]">TUKANG COLEK RESULTS</p>
                  
                  <div className="mb-8 flex flex-col items-center">
                      <p className="text-7xl font-black text-white mb-2 tracking-tighter">{score.toLocaleString()}</p>
                      <div className="h-1 w-24 bg-white/20 rounded-full mb-2" />
                      <p className="text-xs font-bold text-[#03A9F4] uppercase tracking-[0.3em]">Total Poin</p>
                  </div>

                  {currentMedal ? (
                      <div className="mb-10 p-8 bg-white/5 rounded-[40px] border border-white/10 shadow-inner group transition-all">
                          <span className="text-7xl block mb-4 filter drop-shadow-lg group-hover:scale-110 transition-transform duration-500">{currentMedal.icon}</span>
                          <p className="text-lg font-black tracking-[0.3em] uppercase" style={{ color: currentMedal.color }}>
                              PANGKAT {currentMedal.label}
                          </p>
                      </div>
                  ) : (
                      <div className="mb-10 p-6 opacity-60 italic text-sm text-gray-400">Masih amatir, ayo coba lagi!</div>
                  )}

                  <button 
                    onClick={startGame}
                    className="w-full bg-white text-black font-black py-6 rounded-3xl flex items-center justify-center gap-4 hover:bg-[#03A9F4] hover:text-white transition-all active:scale-95 shadow-xl shadow-black/60 group"
                  >
                    <RotateCcw className="w-7 h-7 group-hover:rotate-180 transition-transform duration-500" /> MULAI LAGI
                  </button>
              </div>
          </div>
      )}

      {showLevelUp && (
          <div className="absolute inset-0 pointer-events-none z-[110] flex items-center justify-center animate-out fade-out zoom-out duration-1000 fill-mode-forwards">
              <div className="bg-yellow-400 text-black px-12 py-6 rounded-2xl rotate-3 shadow-[0_0_100px_rgba(250,204,21,0.5)]">
                  <p className="text-6xl font-black italic tracking-tighter uppercase">LEVEL {level} UP!</p>
                  <p className="text-center font-bold text-xs tracking-widest uppercase">Makin Kencang!</p>
              </div>
          </div>
      )}

      <div className="w-[400px] bg-[#0f0f0f] border-r border-white/5 flex flex-col h-full shadow-2xl relative z-20">
        <div className="p-10 border-b border-white/5 bg-gradient-to-br from-black to-[#111]">
           <div className="relative inline-block mb-4">
               <div className="bg-red-600 text-white font-black text-[12px] px-3 py-1 rounded-sm absolute -top-2 -right-6 rotate-12 shadow-xl border border-white/20">MANTAP</div>
               <h1 className="text-5xl font-black tracking-tighter italic text-white leading-tight drop-shadow-2xl uppercase">
                 ABANG<br/>
                 <span className="text-yellow-400 bg-black px-2 not-italic">COLEK</span>
               </h1>
           </div>
           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-4 opacity-70">Simulation of the Blade</p>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
            <div className="space-y-5">
                <div className="flex items-center gap-3">
                    <BrainCircuit className="w-6 h-6 text-[#03A9F4]" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">Petuah Sensei</h2>
                </div>
                <div 
                  className="p-8 rounded-[32px] transition-all duration-700 border-l-[10px] shadow-2xl relative overflow-hidden" 
                  style={{ backgroundColor: '#1a1a1a', borderLeftColor: accentColor }}
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <p className="text-xl font-bold leading-tight italic text-white relative z-10">"{senseiHint}"</p>
                    {isAiThinking && <Loader2 className="w-5 h-5 animate-spin text-white/30 mt-6" />}
                </div>
                
                {techniqueTip && (
                    <div className="flex items-center gap-4 bg-orange-950/20 p-5 rounded-3xl border border-orange-500/20 shadow-lg">
                        <Sparkles className="w-6 h-6 text-orange-400" />
                        <p className="text-[11px] font-bold text-orange-200 uppercase tracking-widest leading-relaxed">{techniqueTip}</p>
                    </div>
                )}
            </div>

            <div className="space-y-5 pt-5 border-t border-white/5">
                <div className="flex items-center gap-3 text-gray-500">
                    <Target className="w-6 h-6" />
                    <h2 className="text-[11px] font-black uppercase tracking-[0.2em]">Data Real-time</h2>
                </div>
                <div className="grid grid-cols-2 gap-5">
                    <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Pangkat</p>
                        <p className="text-3xl font-black text-white">{level}</p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-[32px] border border-white/5">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Skor</p>
                        <p className="text-3xl font-black text-white">{score}</p>
                    </div>
                </div>
            </div>

            {debugInfo?.screenshotBase64 && (
                <div className="pt-5 border-t border-white/5">
                    <div className="flex items-center gap-3 mb-5 text-gray-500">
                        <Eye className="w-6 h-6" />
                        <h2 className="text-[11px] font-black uppercase tracking-[0.2em]">Visi Sensei</h2>
                    </div>
                    <div className="rounded-3xl overflow-hidden border-4 border-white/5 bg-black shadow-2xl grayscale hover:grayscale-0 transition-all duration-700">
                        <img src={debugInfo.screenshotBase64} alt="Vision" className="w-full opacity-70" />
                    </div>
                </div>
            )}
        </div>

        <div className="p-8 bg-black border-t border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
              <p className="text-[10px] font-black tracking-widest uppercase text-gray-600">Flash Engine Active</p>
            </div>
            <p className="text-[10px] text-gray-800 font-black">v4.0</p>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 relative h-full overflow-hidden bg-black cursor-none">
        <video ref={videoRef} className="absolute hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0" />

        {gameState === 'START' && (
            <div className="absolute inset-0 z-50 bg-[#080808] flex flex-col items-center justify-center p-12 overflow-hidden">
                 <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 animate-bounce text-9xl">🥭</div>
                    <div className="absolute bottom-1/4 right-1/4 animate-pulse text-9xl rotate-12">🍍</div>
                    <div className="absolute top-1/2 right-1/3 animate-bounce text-8xl -rotate-12 delay-700">🥝</div>
                 </div>

                 <div className="flex flex-col items-center mb-20 animate-in zoom-in slide-in-from-bottom-12 duration-1000">
                     <div className="bg-yellow-400 text-black font-black text-2xl px-8 py-2 rounded-full -rotate-6 shadow-2xl mb-4 border-4 border-black">CABAI & GARAM</div>
                     <h1 className="text-[12rem] font-black tracking-tighter italic text-white drop-shadow-[0_25px_25px_rgba(0,0,0,1)] leading-none select-none uppercase">
                        ABANG<span className="text-yellow-400 not-italic block mt-[-3rem] text-[10rem]">COLEK</span>
                     </h1>
                     <div className="flex items-center gap-6 mt-8">
                        <div className="h-1.5 w-32 bg-white/10 rounded-full" />
                        <p className="text-gray-500 font-black tracking-[1em] text-xs uppercase">ARCADE EDITION</p>
                        <div className="h-1.5 w-32 bg-white/10 rounded-full" />
                     </div>
                 </div>

                 <button 
                    onClick={startGame}
                    disabled={!!cameraError}
                    className="group relative bg-white text-black font-black text-3xl px-16 py-8 rounded-[40px] flex items-center gap-8 hover:scale-110 active:scale-95 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:bg-yellow-400 hover:text-black border-b-8 border-black/20 uppercase disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-white disabled:hover:text-black"
                 >
                     <Play className="w-10 h-10 fill-current" /> 
                     Mulai Motong!
                     <ChevronRight className="w-8 h-8 opacity-0 group-hover:opacity-100 -translate-x-6 group-hover:translate-x-0 transition-all" />
                 </button>

                 <div className="mt-24 grid grid-cols-3 gap-16 text-gray-500 font-bold text-xs tracking-[0.2em] uppercase">
                     <div className="flex flex-col items-center gap-4 group">
                         <Zap className="w-10 h-10 text-yellow-500 group-hover:scale-125 transition-transform" /> 
                         <span className="text-white opacity-40 group-hover:opacity-100 uppercase">Hand Tracking</span>
                     </div>
                     <div className="flex flex-col items-center gap-4 group">
                         <Timer className="w-10 h-10 text-red-500 group-hover:scale-125 transition-transform" />
                         <span className="text-white opacity-40 group-hover:opacity-100 uppercase">60 Detik</span>
                     </div>
                     <div className="flex flex-col items-center gap-4 group">
                         <Medal className="w-10 h-10 text-[#CD7F32] group-hover:scale-125 transition-transform" />
                         <span className="text-white opacity-40 group-hover:opacity-100 uppercase">Cari Pangkat</span>
                     </div>
                 </div>
            </div>
        )}

        {gameState === 'PLAYING' && (
            <div className="p-12 absolute inset-0 pointer-events-none flex flex-col justify-between">
                <div className="flex justify-between items-start z-40 animate-in slide-in-from-top-12 duration-700">
                    <div className="flex gap-8">
                        <div className="bg-[#1a1a1a]/95 backdrop-blur-3xl px-10 py-6 rounded-[40px] border border-white/10 shadow-2xl flex items-center gap-8">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center">
                                <Trophy className="w-8 h-8 text-yellow-500" />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1 uppercase">Skor</p>
                                <p className="text-5xl font-black text-white tracking-tighter">{score.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-[#1a1a1a]/95 backdrop-blur-3xl px-10 py-6 rounded-[40px] border border-white/10 shadow-2xl flex items-center gap-8">
                            <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center">
                                <Timer className={`w-8 h-8 ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-[#03A9F4]'}`} />
                            </div>
                            <div>
                                <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1 uppercase">Sisa Waktu</p>
                                <p className={`text-5xl font-black tracking-tighter ${timeLeft < 10 ? 'text-red-500' : 'text-white'}`}>{timeLeft}s</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/40 backdrop-blur-md px-10 py-6 rounded-[40px] border border-white/10 shadow-2xl flex items-center gap-6">
                        <p className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em] uppercase">Level</p>
                        <p className="text-5xl font-black text-[#03A9F4] tracking-tighter">{level}</p>
                    </div>
                </div>

                <div className="flex justify-center opacity-30">
                    <p className="text-[11px] font-black uppercase tracking-[1em] text-white uppercase">Abang Colek Blade Console v4.0</p>
                </div>
            </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080808] z-[200]">
             <div className="flex flex-col items-center p-12 text-center max-w-xl bg-[#1a1a1a] rounded-[48px] border border-red-500/20 shadow-2xl">
                 <CameraOff className="w-24 h-24 text-red-500 mb-8 animate-pulse" />
                 <h2 className="text-4xl font-black text-white mb-4 uppercase tracking-tighter">Kamera Error</h2>
                 <p className="text-gray-400 mb-8 font-bold text-lg">{cameraError}</p>
                 <button 
                   onClick={() => window.location.reload()}
                   className="bg-red-600 text-white font-black py-4 px-10 rounded-full hover:bg-red-500 transition-all shadow-lg active:scale-95"
                 >
                   MUAT ULANG HALAMAN
                 </button>
             </div>
          </div>
        )}

        {loading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#080808] z-[200]">
            <div className="flex flex-col items-center">
              <div className="relative mb-10">
                <Loader2 className="w-24 h-24 text-[#03A9F4] animate-spin" />
                <BrainCircuit className="w-10 h-10 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-2xl font-black tracking-[0.5em] text-[#03A9F4] animate-pulse uppercase italic">Mengasah Pisau...</p>
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-5%); }
          50% { transform: translateY(5%); }
        }
        .animate-bounce {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

export default GeminiFruitSlicer;
