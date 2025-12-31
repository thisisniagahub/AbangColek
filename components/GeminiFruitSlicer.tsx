
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSenseiAdvice } from '../services/geminiService';
import { soundManager } from '../services/soundService';
import { Point, Fruit, Particle, FruitType, XPPoint } from '../types';
import { Loader2, BrainCircuit, Play, Timer, RotateCcw, Volume2, VolumeX, Hand, Info, Award, CheckCircle2, Zap, Heart, AlertTriangle } from 'lucide-react';

// --- PERFORMANCE & PHYSICS CONSTANTS ---
const GRAVITY = 0.38; 
const INITIAL_SPAWN_INTERVAL = 1100; 
const BLADE_TRAIL_LIMIT = 8; 
const MAX_PARTICLES = 120; 
const GAME_DURATION = 60; 
const MAX_LIVES = 3;

const FRUIT_CONFIG: Record<FruitType, { hex: string, points: number, label: string, radius: number, fleshColor: string, secondaryColor: string, speckleColor: string }> = {
  guava:       { hex: '#A4C639', points: 10,  label: 'Guava',       radius: 42, fleshColor: '#F06292', secondaryColor: '#558B2F', speckleColor: '#33691E' },
  mango:       { hex: '#FFD54F', points: 20,  label: 'Mango',       radius: 48, fleshColor: '#FFB300', secondaryColor: '#E65100', speckleColor: '#FB8C00' },
  pineapple:   { hex: '#FBC02D', points: 50,  label: 'Pineapple',   radius: 60, fleshColor: '#FFF176', secondaryColor: '#795548', speckleColor: '#5D4037' },
  sweet_mango: { hex: '#FF7043', points: 150, label: 'Sweet Mango', radius: 52, fleshColor: '#FF9800', secondaryColor: '#BF360C', speckleColor: '#212121' },
  bomb:        { hex: '#1a1a1a', points: -100, label: 'Spicy Bottle', radius: 38, fleshColor: '#D32F2F', secondaryColor: '#000000', speckleColor: '#FF1744' }
};

type GameState = 'START' | 'COUNTDOWN' | 'PLAYING' | 'GAMEOVER';

const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    const toHex = (c: number) => c.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const getRank = (score: number) => {
    if (score >= 10000) return { title: 'GRANDMASTER', color: 'text-cyan-400' };
    if (score >= 7000) return { title: 'MASTER', color: 'text-purple-400' };
    if (score >= 4000) return { title: 'EXPERT', color: 'text-red-400' };
    if (score >= 2000) return { title: 'DISCIPLE', color: 'text-green-400' };
    return { title: 'NOVICE', color: 'text-gray-400' };
};

const GameLogo: React.FC<{ size?: 'xs' | 'sm' | 'lg' }> = ({ size = 'lg' }) => {
  const isLarge = size === 'lg';
  const isXs = size === 'xs';
  const widthClass = isLarge ? "w-full max-w-xl" : (isXs ? "w-28" : "w-40");

  return (
    <div className={`flex flex-col items-center justify-center select-none ${isLarge ? 'scale-100' : ''}`}>
      <div className={`relative ${widthClass} transition-all duration-500`}>
        {isLarge && <div className="absolute inset-0 bg-orange-500/20 blur-[60px] rounded-full animate-pulse" />}
        <svg viewBox="0 0 500 240" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl w-full h-auto">
           <defs>
             <linearGradient id="gradText" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFD54F" />
                <stop offset="100%" stopColor="#FF6F00" />
             </linearGradient>
             <linearGradient id="gradSub" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4FC3F7" />
                <stop offset="100%" stopColor="#0277BD" />
             </linearGradient>
             <filter id="glowEffect">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
             </filter>
             <filter id="textShadow">
                <feDropShadow dx="3" dy="5" stdDeviation="2" floodOpacity="0.6"/>
             </filter>
           </defs>
           
           <g transform="translate(250, 130) scale(1.1)">
             <path d="M-150,0 A150,150 0 0,0 150,0 L0,0 Z" fill="#2E7D32" stroke="#1B5E20" strokeWidth="5" />
             <path d="M-135,0 A135,135 0 0,0 135,0 L0,0 Z" fill="#F1F8E9" />
             <path d="M-125,0 A125,125 0 0,0 125,0 L0,0 Z" fill="#D32F2F" />
             <g fill="#212121" opacity="0.8">
               <circle cx="-60" cy="40" r="5" />
               <circle cx="0" cy="85" r="5" />
               <circle cx="65" cy="35" r="5" />
               <circle cx="-30" cy="70" r="3" opacity="0.5" />
               <circle cx="40" cy="65" r="3" opacity="0.5" />
             </g>
           </g>

           <g transform="translate(250, 120) rotate(-6)">
             <text x="0" y="0" textAnchor="middle" fontFamily="'Roboto', sans-serif" fontWeight="900" fontStyle="italic" fontSize="90" fill="url(#gradText)" stroke="#3E2723" strokeWidth="3" filter="url(#textShadow)">ABANG</text>
             <path d="M-180,15 L180,15 L190,65 L-170,65 Z" fill="#121212" opacity="0.8" transform="skewX(-20)" />
             <text x="0" y="55" textAnchor="middle" fontFamily="'Roboto', sans-serif" fontWeight="900" fontSize="36" fill="url(#gradSub)" letterSpacing="5" filter="url(#glowEffect)">FRUIT NINJA</text>
           </g>

           <path d="M50,210 L450,30" stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.9" filter="url(#glowEffect)" />
           <circle cx="430" cy="50" r="6" fill="#D32F2F" />
           <circle cx="410" cy="40" r="4" fill="#D32F2F" />
        </svg>
      </div>
    </div>
  );
};

const GeminiFruitSlicer: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDestroyed = useRef<boolean>(false);
  
  const fruitCache = useRef<Record<string, HTMLCanvasElement>>({});
  const fruits = useRef<Fruit[]>([]);
  const particles = useRef<Particle[]>([]);
  const xpPoints = useRef<XPPoint[]>([]);
  const bladeTrail = useRef<Point[]>([]);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(MAX_LIVES);
  const levelRef = useRef<number>(1);
  const lastSpawnTime = useRef<number>(0);
  const lastSwooshTime = useRef<number>(0);
  const captureRequestRef = useRef<boolean>(false);
  const gameActive = useRef<boolean>(false);
  
  // Input tracking
  const touchActive = useRef<boolean>(false);
  const lastTouchPos = useRef<Point | null>(null);

  const timeScale = useRef<number>(1.0);
  const shakeIntensity = useRef<number>(0);
  const flashOpacity = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState>('START');
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [senseiHint, setSenseiHint] = useState<string>("Sensei sedang mengamati...");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [priorityFruit, setPriorityFruit] = useState<FruitType | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    setIsMuted(soundManager.getMuteState());
    initFruitCache();
    
    // Add touch support
    const handleTouchStart = (e: TouchEvent) => {
        if (gameState !== 'PLAYING') return;
        touchActive.current = true;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && e.touches[0]) {
            lastTouchPos.current = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
    };
    
    const handleTouchMove = (e: TouchEvent) => {
        if (!touchActive.current || gameState !== 'PLAYING') return;
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect && e.touches[0]) {
            const currentPos = { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
            bladeTrail.current.push(currentPos);
            if (bladeTrail.current.length > BLADE_TRAIL_LIMIT) bladeTrail.current.shift();
            lastTouchPos.current = currentPos;
        }
    };
    
    const handleTouchEnd = () => {
        touchActive.current = false;
        lastTouchPos.current = null;
        bladeTrail.current = [];
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [gameState]);

  const toggleMute = () => {
    const newState = soundManager.toggleMute();
    setIsMuted(newState);
  };

  const initFruitCache = () => {
    (Object.keys(FRUIT_CONFIG) as FruitType[]).forEach(type => {
      const radius = FRUIT_CONFIG[type].radius;
      const size = Math.ceil(radius * 6.0); 

      const intactCanvas = document.createElement('canvas');
      intactCanvas.width = size; intactCanvas.height = size;
      const ctxI = intactCanvas.getContext('2d');
      if (ctxI) { ctxI.translate(size/2, size/2); drawFruitGraphic(ctxI, type, radius); fruitCache.current[`${type}_intact`] = intactCanvas; }

      const topCanvas = document.createElement('canvas');
      topCanvas.width = size; topCanvas.height = size;
      const ctxT = topCanvas.getContext('2d');
      if (ctxT) { ctxT.translate(size/2, size/2); drawFruitGraphic(ctxT, type, radius, true); fruitCache.current[`${type}_top`] = topCanvas; }

      const bottomCanvas = document.createElement('canvas');
      bottomCanvas.width = size; bottomCanvas.height = size;
      const ctxB = bottomCanvas.getContext('2d');
      if (ctxB) { ctxB.translate(size/2, size/2); drawFruitGraphic(ctxB, type, radius, false); fruitCache.current[`${type}_bottom`] = bottomCanvas; }
    });
  };

  const startCountdown = () => {
    soundManager.playClick();
    setGameState('COUNTDOWN');
    setCountdown(3);
  };

  useEffect(() => {
    if (gameState === 'COUNTDOWN' && countdown !== null) {
      if (countdown > 0) {
        const timer = setTimeout(() => { setCountdown(countdown - 1); soundManager.playClick(); }, 1000);
        return () => clearTimeout(timer);
      } else { startGame(); }
    }
  }, [countdown, gameState]);

  const startGame = () => {
    scoreRef.current = 0; livesRef.current = MAX_LIVES; levelRef.current = 1;
    setScore(0); setLives(MAX_LIVES); setTimeLeft(GAME_DURATION); setLevel(1);
    fruits.current = []; particles.current = []; xpPoints.current = []; gameActive.current = true;
    setGameState('PLAYING'); timeScale.current = 1.0; shakeIntensity.current = 0; flashOpacity.current = 0;
  };

  const spawnFruit = (width: number, height: number) => {
    const currentLevel = levelRef.current;
    const typeChance = Math.random();
    let type: FruitType = 'guava';
    
    // Dynamic difficulty: Bomb probability logic
    // Grace period: No bombs until level 3
    // Scaling: Starts at 5% at level 3, increases by 1.5% per level, caps at 35%
    let bombThreshold = 0;
    if (currentLevel >= 3) {
        bombThreshold = Math.min(0.35, 0.05 + ((currentLevel - 3) * 0.015));
    }
    
    if (typeChance < bombThreshold) { 
        type = 'bomb'; 
    } else {
        const roll = Math.random();
        const tier = Math.min(currentLevel, 15);
        
        // Increase rare fruit probability as level increases
        const sweetThreshold = 0.94 - (tier * 0.005);
        const pineappleThreshold = 0.82 - (tier * 0.01);
        const mangoThreshold = 0.45 - (tier * 0.01);

        if (roll > sweetThreshold) type = 'sweet_mango'; 
        else if (roll > pineappleThreshold) type = 'pineapple'; 
        else if (roll > mangoThreshold) type = 'mango'; 
        else type = 'guava';
    }

    const config = FRUIT_CONFIG[type];
    const padding = 60;
    const launchX = Math.random() * (width - padding * 2) + padding;
    
    // Dynamic speed scaling
    const speedBonus = currentLevel * 1.2;
    const spreadX = 6 + (currentLevel * 0.4);
    
    const baseVx = (Math.random() - 0.5) * spreadX;
    const baseVy = -(Math.random() * 5 + 16 + speedBonus);

    fruits.current.push({
      id: Math.random().toString(36).substr(2, 9), 
      type, 
      x: launchX, 
      y: height + 80,
      vx: baseVx, 
      vy: baseVy, 
      radius: config.radius,
      rotation: Math.random() * Math.PI * 2, 
      rotationSpeed: (Math.random() - 0.5) * (0.12 + currentLevel * 0.01), 
      isSliced: false
    });
  };

  const createExplosion = (x: number, y: number, color: string, bladeDx: number, bladeDy: number, isBomb = false) => {
    const bladeLen = Math.sqrt(bladeDx*bladeDx + bladeDy*bladeDy) || 1;
    const nx = bladeDx / bladeLen; const ny = bladeDy / bladeLen;
    const count = (isBomb ? 50 : 30) + Math.random() * 15;
    for (let i = 0; i < count; i++) {
      if (particles.current.length >= MAX_PARTICLES) particles.current.shift();
      const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * (isBomb ? 6.28 : 2.2); 
      const speed = Math.random() * (isBomb ? 25 : 18) + 3;
      
      // Mashing effect: Particles clump together for a split second before exploding
      // Bombs explode instantly for better impact
      const wait = isBomb ? 0 : Math.random() * 0.15;

      particles.current.push({ 
        x: x + (Math.random() - 0.5) * 10, 
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed, 
        vy: Math.sin(angle) * speed, 
        life: 1.0, 
        color: Math.random() > 0.8 ? '#FFFFFF' : color,
        wait: wait
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
      setSenseiHint(res.hint.message); setPriorityFruit(res.hint.priorityFruit || null);
    } catch (e) { console.error("AI failed", e); } finally { setIsAiThinking(false); }
  };

  const drawFruit = (ctx: CanvasRenderingContext2D, fruit: Fruit) => {
    const type = fruit.type; const radius = fruit.radius; const size = Math.ceil(radius * 6.0);
    ctx.save(); ctx.translate(fruit.x, fruit.y); ctx.rotate(fruit.rotation);
    if (fruit.isSliced) {
      const angle = fruit.sliceAngle || 0; ctx.rotate(angle);
      const separation = 40 * (1.0 - timeScale.current * 0.4); 
      const topImg = fruitCache.current[`${type}_top`]; if (topImg) ctx.drawImage(topImg, -size/2, -size/2 - separation, size, size);
      const bottomImg = fruitCache.current[`${type}_bottom`]; if (bottomImg) ctx.drawImage(bottomImg, -size/2, -size/2 + separation, size, size);
    } else {
      const intactImg = fruitCache.current[`${type}_intact`]; if (intactImg) ctx.drawImage(intactImg, -size/2, -size/2, size, size);
    }
    ctx.restore();
  };

  const drawFruitGraphic = (ctx: CanvasRenderingContext2D, type: FruitType, radius: number, isHalfTop?: boolean) => {
    const config = FRUIT_CONFIG[type];
    ctx.save();
    if (isHalfTop === true) { ctx.beginPath(); ctx.rect(-radius*5, -radius*5, radius*10, radius*5); ctx.clip(); } 
    else if (isHalfTop === false) { ctx.beginPath(); ctx.rect(-radius*5, 0.5, radius*10, radius*5); ctx.clip(); }

    if (type === 'bomb') {
        const bw = radius * 0.8; const bh = radius * 1.5;
        ctx.beginPath(); ctx.moveTo(-bw, bh/2); ctx.lineTo(bw, bh/2); ctx.lineTo(bw, -bh/4);
        ctx.quadraticCurveTo(bw, -bh/2, bw/2, -bh/2); ctx.lineTo(bw/3, -bh); ctx.lineTo(-bw/3, -bh);
        ctx.lineTo(-bw/2, -bh/2); ctx.quadraticCurveTo(-bw, -bh/2, -bw, -bh/4); ctx.closePath();
        const grad = ctx.createLinearGradient(-bw, 0, bw, 0); grad.addColorStop(0, '#0a0a0a'); grad.addColorStop(0.5, '#333333'); grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad; ctx.fill(); ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = '#D32F2F'; ctx.fillRect(-bw*0.75, -bh*0.1, bw*1.5, bh*0.45);
        ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${radius/3.5}px Roboto`; ctx.textAlign = 'center'; ctx.fillText('PEDAS', 0, bh*0.22);
        ctx.fillStyle = '#FF1744'; ctx.fillRect(-bw/3 - 1, -bh - 8, bw/1.5 + 2, 8);
    } else {
        const drawS = () => {
            ctx.beginPath();
            if (type === 'mango' || type === 'sweet_mango') { ctx.moveTo(0, -radius * 1.2); ctx.bezierCurveTo(radius * 1.4, -radius * 1.1, radius * 1.5, radius * 0.9, 0, radius * 1.25); ctx.bezierCurveTo(-radius * 1.0, radius * 1.1, -radius * 1.8, -radius * 0.2, 0, -radius * 1.2); } 
            else if (type === 'pineapple') { ctx.ellipse(0, 0, radius * 0.85, radius * 1.25, 0, 0, Math.PI * 2); } 
            else { ctx.moveTo(radius, 0); for(let a=0; a<Math.PI*2; a+=0.2) { const r = radius * (0.97 + Math.sin(a*9)*0.035); ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r); } }
            ctx.closePath();
        };
        const skinG = ctx.createRadialGradient(-radius*0.4, -radius*0.6, radius*0.2, 0, 0, radius*1.6);
        skinG.addColorStop(0, config.hex); skinG.addColorStop(0.7, config.secondaryColor); skinG.addColorStop(1, adjustColor(config.secondaryColor, -70));
        ctx.fillStyle = skinG; drawS(); ctx.fill();
        ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.5; ctx.fillStyle = config.speckleColor;
        if (type === 'guava') { for (let i = 0; i < 180; i++) { const a = Math.random()*6.28; const d = Math.random()*radius*0.98; ctx.beginPath(); ctx.arc(Math.cos(a)*d, Math.sin(a)*d, Math.random()*2+0.5, 0, 6.28); ctx.fill(); } } 
        else if (type === 'pineapple') { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; const sp = 22; for(let i=-7; i<=7; i++) { ctx.beginPath(); ctx.moveTo(i*sp, -radius*1.7); ctx.lineTo(i*sp+radius, radius*1.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(i*sp, -radius*1.7); ctx.lineTo(i*sp-radius, radius*1.7); ctx.stroke(); } } 
        else { for (let i = 0; i < 90; i++) { const a = Math.random()*6.28; const d = Math.random()*radius; ctx.beginPath(); ctx.ellipse(Math.cos(a)*d, Math.sin(a)*d, Math.random()*6, Math.random()*3, a, 0, 6.28); ctx.fill(); } }
        ctx.restore();
        const highlight = ctx.createRadialGradient(-radius*0.6, -radius*0.6, 0, -radius*0.6, -radius*0.6, radius*1.1);
        highlight.addColorStop(0, 'rgba(255,255,255,0.5)'); highlight.addColorStop(0.3, 'rgba(255,255,255,0.15)'); highlight.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = highlight; ctx.beginPath(); ctx.ellipse(-radius*0.6, -radius*0.6, radius*0.6, radius*0.4, Math.PI/4, 0, 6.28); ctx.fill();
        if (isHalfTop !== undefined) {
            ctx.save(); ctx.scale(1, 0.35); ctx.beginPath();
            if (type === 'mango' || type === 'sweet_mango') ctx.ellipse(0, 0, radius*1.15, radius*1.3, 0, 0, 6.28); else ctx.arc(0, 0, radius * 1.1, 0, 6.28);
            const fG = ctx.createRadialGradient(0,0, 0, 0,0, radius); fG.addColorStop(0, adjustColor(config.fleshColor, 80)); fG.addColorStop(0.75, config.fleshColor); fG.addColorStop(1, adjustColor(config.hex, -20));
            ctx.fillStyle = fG; ctx.fill();
            if (type === 'guava') { ctx.fillStyle = '#880E4F'; ctx.globalAlpha = 0.6; for(let i=0; i<60; i++) { ctx.beginPath(); const d=radius*(0.3+Math.random()*0.6); const a=Math.random()*6.28; ctx.arc(Math.cos(a)*d, Math.sin(a)*d, 3.5, 0, 6.28); ctx.fill(); } } 
            else if (type === 'pineapple') { ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2.5; for(let i=0; i<16; i++) { const a=(i/16)*6.28; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*radius, Math.sin(a)*radius); ctx.stroke(); } }
            ctx.restore(); ctx.beginPath(); if (type === 'mango' || type === 'sweet_mango') ctx.ellipse(0, 0, radius*1.15, 6, 0, 0, 6.28); else ctx.arc(0, 0, radius * 1.1, 0, 6.28);
            ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.stroke();
        }
    }
    ctx.restore();
  };

  useEffect(() => {
    isDestroyed.current = false; let isMounted = true; 
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current; const container = containerRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    let hands: any = null;

    const onResults = (results: any) => {
      if (!isMounted) return;
      setLoading(false);
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; }
      ctx.save();
      if (shakeIntensity.current > 0) { ctx.translate((Math.random()-0.5)*shakeIntensity.current, (Math.random()-0.5)*shakeIntensity.current); shakeIntensity.current *= 0.85; }
      ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height); ctx.restore();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (flashOpacity.current > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity.current})`; ctx.fillRect(0, 0, canvas.width, canvas.height); flashOpacity.current -= 0.12; }

      let handFound = false;
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handFound = true; const landmarks = results.multiHandLandmarks[0];
        const hp = { x: (1 - landmarks[8].x) * canvas.width, y: landmarks[8].y * canvas.height };
        if (gameState === 'PLAYING') { bladeTrail.current.push(hp); if (bladeTrail.current.length > BLADE_TRAIL_LIMIT) bladeTrail.current.shift(); }
      }
      setHandDetected(handFound);

      if (gameState !== 'PLAYING') { ctx.restore(); return; }
      if (timeScale.current < 1.0) timeScale.current += 0.12;
      const ts = timeScale.current; const now = performance.now();
      
      // Dynamic Spawn Rate using Ref (prevents restart)
      const spawnRate = Math.max(300, INITIAL_SPAWN_INTERVAL - (levelRef.current * 60));
      if (now - lastSpawnTime.current > spawnRate) { spawnFruit(canvas.width, canvas.height); lastSpawnTime.current = now; if (Math.random() > 0.88) captureRequestRef.current = true; }

      if (bladeTrail.current.length >= 2) {
        const p1 = bladeTrail.current[bladeTrail.current.length - 2];
        const p2 = bladeTrail.current[bladeTrail.current.length - 1];
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        if (dx*dx + dy*dy > 1200 && now - lastSwooshTime.current > 180) { soundManager.playSwoosh(); lastSwooshTime.current = now; }
        fruits.current.forEach(f => {
          if (!f.isSliced) {
            const lineLenSq = dx*dx + dy*dy; if (lineLenSq < 8) return;
            const dist = Math.abs(dy * f.x - dx * f.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(lineLenSq);
            if (dist < f.radius * 1.25 && f.x > Math.min(p1.x, p2.x) - f.radius && f.x < Math.max(p1.x, p2.x) + f.radius && f.y > Math.min(p1.y, p2.y) - f.radius && f.y < Math.max(p1.y, p2.y) + f.radius) {
              f.isSliced = true; const pts = FRUIT_CONFIG[f.type].points;
              if (f.type === 'bomb') { soundManager.playBombExplosion(); livesRef.current -= 1; setLives(livesRef.current); shakeIntensity.current = 60; flashOpacity.current = 0.8; if (livesRef.current <= 0) { gameActive.current = false; setGameState('GAMEOVER'); soundManager.playGameOver(); } } 
              else { soundManager.playSlice(); timeScale.current = 0.08; shakeIntensity.current = 35; flashOpacity.current = 0.55; }
              f.sliceAngle = Math.atan2(dy, dx); scoreRef.current = Math.max(0, scoreRef.current + pts); setScore(scoreRef.current);
              xpPoints.current.push({ x: f.x, y: f.y, value: pts, color: FRUIT_CONFIG[f.type].hex, life: 1.0, vx: (Math.random()-0.5)*4, vy: -6 });
              
              // Check for Level Up
              const nl = Math.floor(scoreRef.current / 1500) + 1; 
              if (nl > levelRef.current) { 
                levelRef.current = nl; 
                setLevel(nl); 
                soundManager.playLevelUp(); 
                setShowLevelUp(true); 
                setTimeout(() => setShowLevelUp(false), 2000); 
              }
              createExplosion(f.x, f.y, FRUIT_CONFIG[f.type].fleshColor, dx, dy, f.type === 'bomb');
            }
          }
        });
      }

      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = xpPoints.current.length - 1; i >= 0; i--) {
          const xp = xpPoints.current[i]; xp.x += xp.vx * ts; xp.y += xp.vy * ts; xp.life -= 0.025 * ts;
          if (xp.life <= 0) xpPoints.current.splice(i, 1);
          else { ctx.globalAlpha = xp.life; ctx.font = `900 ${36 * (0.8 + xp.life * 0.2)}px Roboto`; ctx.fillStyle = xp.value < 0 ? '#FF1744' : '#FFFFFF'; ctx.shadowColor = xp.color; ctx.shadowBlur = 20; ctx.fillText(`${xp.value < 0 ? '' : '+'}${xp.value}`, xp.x, xp.y); }
      }
      ctx.restore();
      for (let i = fruits.current.length - 1; i >= 0; i--) { const f = fruits.current[i]; f.x += f.vx * ts; f.y += f.vy * ts; f.vy += GRAVITY * ts; f.rotation += f.rotationSpeed * ts; if (f.y > canvas.height + 120) fruits.current.splice(i, 1); else drawFruit(ctx, f); }
      
      for (let i = particles.current.length - 1; i >= 0; i--) { 
        const p = particles.current[i]; 
        
        // Mashing Effect Logic
        if (p.wait && p.wait > 0) {
            // While 'waiting', particles are clumped and jitter slightly
            p.wait -= 0.015 * ts;
            p.x += (Math.random() - 0.5) * 1.5 * ts;
            p.y += (Math.random() - 0.5) * 1.5 * ts;
        } else {
            // Normal dispersal
            p.x += p.vx * ts; 
            p.y += p.vy * ts; 
            p.vy += (GRAVITY * 0.45) * ts; 
            p.life -= 0.03 * ts; 
        }

        if (p.life <= 0) {
            particles.current.splice(i, 1); 
        } else { 
            ctx.globalAlpha = p.life; 
            ctx.fillStyle = p.color; 
            const radius = 6 * p.life;
            ctx.beginPath(); 
            ctx.arc(p.x, p.y, radius, 0, 6.28); 
            ctx.fill(); 
            
            // Specular Highlight for Wet Look
            if (p.life > 0.3) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(p.x - radius * 0.25, p.y - radius * 0.25, radius * 0.3, 0, 6.28);
                ctx.fill();
            }
        } 
      }
      
      if (bladeTrail.current.length >= 2) { ctx.beginPath(); ctx.moveTo(bladeTrail.current[0].x, bladeTrail.current[0].y); for (let i = 1; i < bladeTrail.current.length; i++) ctx.lineTo(bladeTrail.current[i].x, bladeTrail.current[i].y); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.shadowBlur = 30; ctx.shadowColor = '#00B8D4'; ctx.stroke(); }
      ctx.restore();

      if (captureRequestRef.current && !isAiThinking) {
        captureRequestRef.current = false;
        const off = document.createElement('canvas'); off.width = 480; off.height = 270;
        const oCtx = off.getContext('2d'); if (oCtx) { oCtx.drawImage(canvas, 0, 0, 480, 270); performAiAnalysis(off.toDataURL('image/jpeg', 0.6)); }
      }
    };

    if (window.Hands) {
      hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      const startCamera = async () => {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } });
              if (videoRef.current) {
                  videoRef.current.srcObject = stream; await videoRef.current.play();
                  const proc = async () => {
                      if (!isMounted) return;
                      try { if (videoRef.current && hands && videoRef.current.readyState >= 2) await hands.send({ image: videoRef.current }); } catch (err) {}
                      if (isMounted) requestAnimationFrame(proc);
                  };
                  proc();
              }
          } catch (e) { setLoading(false); setCameraError("Akses kamera ditolak."); }
      };
      startCamera();
    }
    return () => { isMounted = false; isDestroyed.current = true; };
  }, [gameState]); // Removed 'level' dependency to prevent game loop reset

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => { setTimeLeft(p => { if (p <= 1) { gameActive.current = false; setGameState('GAMEOVER'); soundManager.playGameOver(); return 0; } return p - 1; }); }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const pColor = priorityFruit ? FRUIT_CONFIG[priorityFruit].hex : '#03A9F4';
  const playerRank = getRank(score);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-roboto text-[#e3e3e3] select-none touch-none">
      
      {/* Mobile-First HUD Overlay */}
      {gameState === 'PLAYING' && (
        <div className="absolute top-0 left-0 right-0 z-[150] p-2 md:p-4 flex flex-col gap-2 pointer-events-none animate-in slide-in-from-top duration-500">
            {/* Top Bar: Score, Lives, Timer */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="bg-black/60 backdrop-blur-xl p-1.5 rounded-xl border border-white/10 flex items-center gap-1 shadow-xl">
                        {[...Array(MAX_LIVES)].map((_, i) => (
                            <Heart key={i} className={`w-4 h-4 md:w-5 md:h-5 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-700'}`} />
                        ))}
                    </div>
                    <div className="bg-blue-950/40 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-blue-500/30 flex flex-col items-center min-w-[70px] md:min-w-[100px] shadow-xl">
                        <span className="text-[8px] md:text-[10px] font-bold text-blue-300 uppercase leading-none mb-0.5">SKOR</span>
                        <span className="text-lg md:text-2xl font-black text-white leading-none">{score.toLocaleString()}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="bg-black/60 backdrop-blur-xl px-3 py-1.5 rounded-xl border border-white/10 flex flex-col items-center shadow-xl">
                        <span className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase leading-none mb-0.5">LVL</span>
                        <span className="text-lg md:text-2xl font-black text-white leading-none">{level}</span>
                    </div>
                    <div className={`backdrop-blur-xl px-3 py-1.5 rounded-xl border flex items-center gap-1 shadow-xl ${timeLeft < 10 ? 'bg-red-950/50 border-red-500 animate-pulse' : 'bg-black/60 border-white/10'}`}>
                        <Timer className={`w-4 h-4 md:w-5 md:h-5 ${timeLeft < 10 ? 'text-red-400' : 'text-white'}`} />
                        <span className="text-lg md:text-xl font-bold font-mono">{timeLeft}s</span>
                    </div>
                </div>
            </div>

            {/* Sensei Box: Adaptive for Mobile */}
            <div className="mx-auto w-full max-w-lg mt-1">
                 <div className="relative bg-black/80 backdrop-blur-xl px-4 py-2 rounded-2xl border-x-4 flex items-center justify-center text-center shadow-2xl transition-colors duration-500" style={{ borderColor: pColor }}>
                    <div className="flex flex-col items-center overflow-hidden">
                        <div className="flex items-center gap-2 mb-0.5">
                            <BrainCircuit className="w-3 h-3 md:w-4 md:h-4" style={{ color: pColor }} />
                            <span className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-gray-400">Petuah Sensei</span>
                            {isAiThinking && <Loader2 className="w-2.5 h-2.5 md:w-3 md:h-3 animate-spin text-white" />}
                        </div>
                        <p className="text-sm md:text-lg font-black italic text-white leading-tight drop-shadow-lg uppercase truncate w-full px-2">"{senseiHint}"</p>
                    </div>
                 </div>
            </div>
        </div>
      )}

      {/* Floating Mute Button */}
      <div className="absolute bottom-6 right-6 z-[200]">
        <button onClick={toggleMute} className="bg-black/40 backdrop-blur-xl p-3 rounded-full border border-white/10 hover:bg-white/10 transition-all shadow-2xl active:scale-90">
          {isMuted ? <VolumeX className="w-6 h-6 text-red-400" /> : <Volume2 className="w-6 h-6 text-white" />}
        </button>
      </div>

      {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
              <div className="text-9xl md:text-[18rem] font-black italic text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.5)] animate-in zoom-in duration-300">
                  {countdown === 0 ? "MULAI!" : countdown}
              </div>
          </div>
      )}

      {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 z-[250] flex items-center justify-center p-4 backdrop-blur-lg animate-in fade-in duration-700">
              <div className="bg-[#111] border border-white/10 p-8 md:p-12 rounded-[40px] text-center max-w-sm w-full shadow-2xl transform scale-105">
                  <h2 className="text-4xl md:text-5xl font-black mb-2 tracking-tighter text-red-500 italic uppercase leading-none">{lives <= 0 ? 'HABIS NYAWA!' : 'WAKTU HABIS!'}</h2>
                  <div className="mb-6 flex flex-col items-center">
                      <div className={`flex items-center gap-2 font-black text-lg md:text-xl mb-2 ${playerRank.color}`}><Award className="w-5 h-5 md:w-6 md:h-6" /> {playerRank.title}</div>
                      <p className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-lg">{score.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mt-1">Skor Akhir</p>
                  </div>
                  <button onClick={startCountdown} className="w-full bg-white text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-yellow-400 transition-all active:scale-95 shadow-xl text-xl uppercase">
                    <RotateCcw className="w-6 h-6" /> COBA LAGI
                  </button>
              </div>
          </div>
      )}

      {showLevelUp && (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-[160] animate-bounce">
              <div className="bg-yellow-400 text-black px-8 py-4 md:px-12 md:py-6 rounded-2xl rotate-2 shadow-2xl border-2 md:border-4 border-black">
                  <p className="text-4xl md:text-7xl font-black italic tracking-tighter uppercase leading-none">LEVEL UP!</p>
              </div>
          </div>
      )}

      <div ref={containerRef} className="absolute inset-0 z-0 h-full overflow-hidden bg-black cursor-none touch-none">
        <video ref={videoRef} className="absolute hidden" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0" />
        
        {gameState === 'START' && (
            <div className="absolute inset-0 z-[200] flex flex-col items-center justify-between py-12 md:justify-center md:gap-10 bg-black/60 backdrop-blur-xl p-6">
                 <div className="animate-in zoom-in slide-in-from-bottom duration-1000"><GameLogo size="lg" /></div>
                 
                 <div className="flex flex-col items-center gap-6 w-full max-w-md">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex items-center gap-3">
                            <Hand className="w-6 h-6 text-blue-400" />
                            <div className="text-left">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Kontrol</p>
                                <p className="text-xs font-medium">Gunakan jari atau tangan Anda!</p>
                            </div>
                        </div>
                        <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-md flex items-center gap-3">
                            {handDetected ? <CheckCircle2 className="w-6 h-6 text-green-400" /> : <Info className="w-6 h-6 text-yellow-400 animate-pulse" />}
                            <div className="text-left">
                                <p className="text-[10px] font-bold uppercase text-gray-500">Status Kamera</p>
                                <p className={`text-xs font-black uppercase ${handDetected ? 'text-green-400' : 'text-yellow-400'}`}>{handDetected ? 'Siap Bermain' : 'Menunggu Hand...'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-red-950/20 border border-red-500/30 px-5 py-3 rounded-2xl w-full">
                        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                        <p className="text-[10px] md:text-xs font-bold text-red-200 uppercase tracking-tighter">HATI-HATI: Jangan sentuh Botol Hitam (Pedas Sekali!)</p>
                    </div>
                 </div>

                 <button onClick={startCountdown} disabled={!!cameraError} className="bg-white text-black font-black text-3xl md:text-4xl px-12 py-6 md:px-20 md:py-8 rounded-3xl flex items-center gap-4 md:gap-8 hover:scale-105 active:scale-95 transition-all shadow-2xl uppercase group relative overflow-hidden">
                     <div className="absolute inset-0 bg-yellow-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                     <Play className="w-8 h-8 md:w-12 md:h-12 fill-current relative z-10" /> 
                     <span className="relative z-10">MULAI!</span>
                 </button>

                 <p className="text-[10px] font-bold text-white/30 tracking-[0.3em] uppercase animate-pulse flex items-center gap-2"><Zap className="w-3 h-3 text-yellow-400" /> GEMINI 3 FLASH AI</p>
            </div>
        )}

        {loading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050505] z-[200]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <p className="text-sm font-black tracking-[0.2em] text-white animate-pulse uppercase">Memuat Pisau Golok...</p>
            </div>
          </div>
        )}

        {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-[300] p-6 text-center">
                <div className="bg-red-900/20 border border-red-500/50 p-8 rounded-3xl backdrop-blur-xl max-w-sm">
                    <Info className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-black mb-2 uppercase">Kamera Bermasalah</h2>
                    <p className="text-xs text-gray-400 mb-6 font-medium leading-relaxed">{cameraError}</p>
                    <button onClick={() => window.location.reload()} className="w-full bg-red-500 text-white font-black py-4 rounded-xl hover:bg-red-600 transition-colors uppercase text-sm">Muat Ulang</button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default GeminiFruitSlicer;
