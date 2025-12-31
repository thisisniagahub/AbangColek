/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { soundManager } from '../services/soundService';
import { Point, Fruit, Particle, FruitType, XPPoint } from '../types';
import { Loader2, Play, RotateCcw, Volume2, VolumeX, Hand, Award, CheckCircle2, Heart, AlertTriangle, Zap } from 'lucide-react';

const GRAVITY = 0.38; 
const INITIAL_SPAWN_INTERVAL = 1100; 
const BLADE_TRAIL_LIMIT = 8; 
const MAX_PARTICLES = 120; 
const GAME_DURATION = 60; 
const MAX_LIVES = 3;

// Specialized colors and metadata for realistic fruit rendering
const FRUIT_CONFIG: Record<FruitType, { hex: string, points: number, label: string, radius: number, fleshColor: string, secondaryColor: string, speckleColor: string }> = {
  guava:       { hex: '#7CB342', points: 10,  label: 'Jambu Biji',   radius: 42, fleshColor: '#F06292', secondaryColor: '#558B2F', speckleColor: '#33691E' },
  mango:       { hex: '#AFB42B', points: 20,  label: 'Mangga Hijau', radius: 48, fleshColor: '#FFB300', secondaryColor: '#E65100', speckleColor: '#FBC02D' },
  pineapple:   { hex: '#FBC02D', points: 50,  label: 'Nanas Madu',   radius: 60, fleshColor: '#FFF176', secondaryColor: '#795548', speckleColor: '#5D4037' },
  sweet_mango: { hex: '#FF8F00', points: 150, label: 'Mangga Masak', radius: 52, fleshColor: '#FFCC80', secondaryColor: '#BF360C', speckleColor: '#E65100' },
  bomb:        { hex: '#D32F2F', points: -100, label: 'Botol Sambal', radius: 38, fleshColor: '#FFCDD2', secondaryColor: '#000000', speckleColor: '#FF1744' }
};

type GameState = 'START' | 'COUNTDOWN' | 'PLAYING' | 'GAMEOVER';

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
  isLeaf?: boolean;
  rotation?: number;
}

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
  const widthClass = isLarge ? "w-full max-w-xl" : "w-40";

  return (
    <div className={`flex flex-col items-center justify-center select-none ${isLarge ? 'scale-100' : ''}`}>
      <div className={`relative ${widthClass} transition-all duration-500`}>
        {isLarge && <div className="absolute inset-0 bg-yellow-500/10 blur-[60px] rounded-full animate-pulse" />}
        <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-2xl w-full h-auto">
           <defs>
             <linearGradient id="skinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#78909C" />
                <stop offset="100%" stopColor="#37474F" />
             </linearGradient>
             <linearGradient id="capGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF5252" />
                <stop offset="100%" stopColor="#B71C1C" />
             </linearGradient>
             <filter id="stickerStroke">
                <feMorphology in="SourceAlpha" result="DILATED" operator="dilate" radius="4" />
                <feFlood floodColor="white" result="FLOOD" />
                <feComposite in="FLOOD" in2="DILATED" operator="in" result="OUTLINE" />
                <feMerge>
                    <feMergeNode in="OUTLINE" />
                    <feMergeNode in="SourceGraphic" />
                </feMerge>
             </filter>
           </defs>
           
           {/* Background Leaf */}
           <path d="M420,60 Q460,20 490,60 Q510,110 460,130 Q410,110 420,60" fill="#43A047" opacity="0.9" transform="rotate(15 440 80)"/>

           {/* --- ABANG CHARACTER --- */}
           <g transform="translate(250, 160) scale(1.4)" filter="url(#stickerStroke)">
             {/* Face */}
             <path d="M-50,0 C-50,-50 50,-50 50,0 C50,45 35,75 0,75 C-35,75 -50,45 -50,0" fill="url(#skinGrad)" stroke="#1a1a1a" strokeWidth="2.5"/>
             
             {/* Grin & Teeth */}
             <path d="M-30,40 Q0,65 30,40 Q30,30 33,30 Q0,60 -33,30 Q-30,30 -30,40" fill="#2D1C1C" />
             <rect x="-22" y="32" width="6" height="8" fill="#FFD700" rx="1" /> {/* Gold Tooth */}
             <rect x="16" y="32" width="6" height="8" fill="white" rx="1" />

             {/* Sunglasses */}
             <rect x="-48" y="-5" width="45" height="30" rx="6" fill="#121212" stroke="white" strokeWidth="2" />
             <rect x="3" y="-5" width="45" height="30" rx="6" fill="#121212" stroke="white" strokeWidth="2" />
             <rect x="-5" y="5" width="10" height="5" fill="#121212" />

             {/* Red Cap */}
             <path d="M-54,-12 Q0,-60 54,-12 L58,0 L-58,0 Z" fill="url(#capGrad)" stroke="#1a1a1a" strokeWidth="2" />
             <path d="M-58,-2 L-80,12 Q-40,0 0,0" fill="#B71C1C" stroke="#1a1a1a" strokeWidth="2" transform="rotate(-15 -58 -2)" />

             {/* Hands holding Mango (Green Mango from image) */}
             <g transform="translate(65, 45) rotate(-15)">
                <path d="M0,0 Q35,-25 55,10 Q65,55 35,75 Q-15,85 -25,45 Q-30,15 0,0" fill="#7CB342" stroke="#33691E" strokeWidth="2.5" />
                <path d="M5,25 Q15,25 25,35" stroke="#78909C" strokeWidth="14" strokeLinecap="round" />
                <path d="M0,45 Q10,45 20,55" stroke="#78909C" strokeWidth="14" strokeLinecap="round" />
             </g>
           </g>

           {/* --- TYPOGRAPHY --- */}
           <g transform="translate(250, 275)">
             <text x="0" y="-35" textAnchor="middle" fontFamily="'Roboto', sans-serif" fontWeight="900" fontStyle="italic" fontSize="75" fill="#121212" stroke="white" strokeWidth="5">ABANG</text>
             <text x="0" y="30" textAnchor="middle" fontFamily="'Roboto', sans-serif" fontWeight="900" fontSize="55" fill="#D32F2F" stroke="white" strokeWidth="5" letterSpacing="2">COLEX</text>
           </g>
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
  const ambientParticles = useRef<AmbientParticle[]>([]);
  const xpPoints = useRef<XPPoint[]>([]);
  const bladeTrail = useRef<Point[]>([]);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(MAX_LIVES);
  const levelRef = useRef<number>(1);
  const lastSpawnTime = useRef<number>(0);
  const lastSwooshTime = useRef<number>(0);
  const gameActive = useRef<boolean>(false);
  
  const bgHue = useRef<number>(60); // Start with yellowish background
  const pulseIntensity = useRef<number>(0);
  
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
  const [isMuted, setIsMuted] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    isDestroyed.current = false;
    setIsMuted(soundManager.getMuteState());
    initFruitCache();
    
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
        isDestroyed.current = true;
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
      const size = Math.ceil(radius * 7.0); 

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
    fruits.current = []; particles.current = []; ambientParticles.current = []; xpPoints.current = []; gameActive.current = true;
    bgHue.current = 60; pulseIntensity.current = 0;
    setGameState('PLAYING'); timeScale.current = 1.0; shakeIntensity.current = 0; flashOpacity.current = 0;
  };

  const spawnFruit = (width: number, height: number) => {
    const currentLevel = levelRef.current;
    const typeChance = Math.random();
    let type: FruitType = 'guava';
    let bombThreshold = currentLevel >= 3 ? Math.min(0.3, 0.05 + ((currentLevel - 3) * 0.02)) : 0;
    
    if (typeChance < bombThreshold) { 
        type = 'bomb'; 
    } else {
        const roll = Math.random();
        if (roll > 0.95) type = 'sweet_mango'; 
        else if (roll > 0.8) type = 'pineapple'; 
        else if (roll > 0.4) type = 'mango'; 
        else type = 'guava';
    }

    const config = FRUIT_CONFIG[type];
    const launchX = Math.random() * (width - 120) + 60;
    fruits.current.push({
      id: Math.random().toString(36).substr(2, 9), 
      type, x: launchX, y: height + 80,
      vx: (Math.random() - 0.5) * (6 + (currentLevel * 0.4)), 
      vy: -(Math.random() * 5 + 16 + currentLevel * 1.2), 
      radius: config.radius,
      rotation: Math.random() * Math.PI * 2, 
      rotationSpeed: (Math.random() - 0.5) * (0.12 + currentLevel * 0.01), 
      isSliced: false
    });
  };

  const createExplosion = (x: number, y: number, color: string, bladeDx: number, bladeDy: number, isBomb = false) => {
    const count = (isBomb ? 50 : 30) + Math.random() * 15;
    for (let i = 0; i < count; i++) {
      if (particles.current.length >= MAX_PARTICLES) particles.current.shift();
      const angle = Math.atan2(bladeDy, bladeDx || 1) + (Math.random() - 0.5) * (isBomb ? 6.28 : 2.2); 
      const speed = Math.random() * (isBomb ? 25 : 18) + 3;
      particles.current.push({ 
        x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, 
        life: 1.0, color: Math.random() > 0.8 ? '#FFFFFF' : color, wait: isBomb ? 0 : Math.random() * 0.15
      });
    }
  };

  // RENDERING DETAILED FRUITS
  const drawFruitGraphic = (ctx: CanvasRenderingContext2D, type: FruitType, radius: number, isTop?: boolean) => {
    const config = FRUIT_CONFIG[type];
    ctx.save();
    
    if (type === 'bomb') {
        // Draw Sambal Bottle (The "Spicy" Hazard)
        ctx.save();
        ctx.scale(1.2, 1.2);
        // Bottle Body
        ctx.fillStyle = '#B71C1C';
        ctx.beginPath();
        ctx.roundRect(-radius*0.4, -radius*0.8, radius*0.8, radius*1.6, 8);
        ctx.fill();
        ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.stroke();
        
        // Label
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(-radius*0.3, -radius*0.3, radius*0.6, radius*0.6);
        ctx.fillStyle = '#D32F2F';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PEDAS', 0, radius*0.1);
        
        // Cap
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.roundRect(-radius*0.3, -radius*1.0, radius*0.6, radius*0.3, 2);
        ctx.fill();
        ctx.restore();
        ctx.restore();
        return;
    }

    if (isTop !== undefined) {
      ctx.beginPath();
      if (isTop) ctx.arc(0, 0, radius, Math.PI, 0); 
      else ctx.arc(0, 0, radius, 0, Math.PI);
      ctx.closePath();
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
    }

    // Base Skin Gradient
    const grad = ctx.createRadialGradient(-radius*0.3, -radius*0.3, radius*0.1, 0, 0, radius);
    grad.addColorStop(0, adjustColor(config.hex, 30));
    grad.addColorStop(1, adjustColor(config.hex, -15));
    ctx.fillStyle = grad;
    ctx.fill();

    // Textures based on type
    if (type === 'guava') {
        // Jambu Biji Bintik
        ctx.fillStyle = config.speckleColor;
        for(let i=0; i<15; i++) {
            const x = (Math.random()-0.5)*radius*1.5;
            const y = (Math.random()-0.5)*radius*1.5;
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI*2); ctx.fill();
        }
    } else if (type === 'pineapple') {
        // Nanas Scales
        ctx.strokeStyle = config.secondaryColor;
        ctx.lineWidth = 1;
        for(let r=0; r<radius; r+=15) {
            ctx.beginPath(); ctx.arc(0,0, r, 0, Math.PI*2); ctx.stroke();
        }
    }

    if (isTop !== undefined) {
      // Internal Flesh rendering
      const yOff = 0;
      ctx.fillStyle = config.fleshColor;
      ctx.beginPath();
      ctx.ellipse(0, yOff, radius * 0.9, radius * 0.9 * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Flesh Detail (Seeds/Pits)
      if (type === 'guava') {
          ctx.fillStyle = '#B71C1C';
          for(let i=0; i<10; i++) {
              ctx.beginPath(); ctx.arc((Math.random()-0.5)*radius, (Math.random()-0.5)*radius*0.2, 2, 0, Math.PI*2); ctx.fill();
          }
      } else if (type === 'mango' || type === 'sweet_mango') {
          ctx.fillStyle = '#FBC02D';
          ctx.beginPath(); ctx.ellipse(0, 0, radius*0.4, radius*0.1, 0, 0, Math.PI*2); ctx.fill();
      }
    }

    ctx.restore();
  };

  const checkCollisions = () => {
    if (bladeTrail.current.length < 2) return;
    const tip = bladeTrail.current[bladeTrail.current.length - 1];
    const prev = bladeTrail.current[bladeTrail.current.length - 2];
    const dx = tip.x - prev.x; const dy = tip.y - prev.y;
    const speed = Math.sqrt(dx*dx + dy*dy);
    if (speed > 25 && performance.now() - lastSwooshTime.current > 150) {
        soundManager.playSwoosh(); lastSwooshTime.current = performance.now();
    }
    fruits.current.forEach(fruit => {
      if (fruit.isSliced) return;
      const t = ((fruit.x - prev.x) * dx + (fruit.y - prev.y) * dy) / (speed * speed || 1);
      const cX = prev.x + Math.max(0, Math.min(1, t)) * dx;
      const cY = prev.y + Math.max(0, Math.min(1, t)) * dy;
      if (Math.sqrt((fruit.x - cX)**2 + (fruit.y - cY)**2) < fruit.radius) {
        fruit.isSliced = true;
        const config = FRUIT_CONFIG[fruit.type];
        shakeIntensity.current = fruit.type === 'bomb' ? 25 : 3;
        pulseIntensity.current = 0.3;
        if (fruit.type === 'bomb') {
            soundManager.playBombExplosion(); createExplosion(fruit.x, fruit.y, '#FF4444', dx, dy, true);
            flashOpacity.current = 0.8; livesRef.current = Math.max(0, livesRef.current - 1); setLives(livesRef.current);
            timeScale.current = 0.1; setTimeout(() => { if(!isDestroyed.current) timeScale.current = 1.0; }, 400);
        } else {
            soundManager.playSlice(); createExplosion(fruit.x, fruit.y, config.fleshColor, dx, dy);
            scoreRef.current += config.points; setScore(scoreRef.current);
            const nL = 1 + Math.floor(scoreRef.current / 300);
            if (nL > levelRef.current) { levelRef.current = nL; setLevel(nL); soundManager.playLevelUp(); pulseIntensity.current = 1.0; setShowLevelUp(true); setTimeout(() => setShowLevelUp(false), 2000); }
            xpPoints.current.push({ x: fruit.x, y: fruit.y - 30, value: config.points, color: config.hex, life: 1.0, vx: 0, vy: -2 });
        }
        (fruit as any).slicedTime = performance.now(); 
        fruit.sliceAngle = Math.atan2(dy, dx);
        
        // --- IMPROVED PHYSICS ---
        // Store impact intensity for dynamic separation
        (fruit as any).impactIntensity = Math.min(Math.max(speed, 10), 40);
        
        // Strong upward pop regardless of original velocity (pop the halves up)
        fruit.vy = -12 - Math.random() * 5;
        
        // Transfer some lateral blade momentum to the main body
        fruit.vx = (dx * 0.3);
        
        // Add random spin to make it feel chaotic
        fruit.rotationSpeed += (Math.random() - 0.5) * 0.8;
      }
    });
  };

  const updatePhysics = (width: number, height: number) => {
    const dt = timeScale.current;
    for (let i = fruits.current.length - 1; i >= 0; i--) {
      const f = fruits.current[i]; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += GRAVITY * dt; f.rotation += f.rotationSpeed * dt;
      if (f.y > height + 100) fruits.current.splice(i, 1);
    }
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      if (p.wait && p.wait > 0) { p.wait -= 0.05 * dt; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += GRAVITY * 0.5 * dt; p.life -= 0.015 * dt;
      if (p.life <= 0) particles.current.splice(i, 1);
    }
    // Ambient Leaves (Background)
    if (ambientParticles.current.length < 50) {
        ambientParticles.current.push({ 
            x: Math.random() * width, 
            y: -50, 
            vx: (Math.random() - 0.5) * 2, 
            vy: Math.random() * 1.5 + 0.5, 
            size: Math.random() * 20 + 10, 
            opacity: Math.random() * 0.5 + 0.2, 
            phase: Math.random() * Math.PI * 2,
            isLeaf: true,
            rotation: Math.random() * Math.PI * 2
        });
    }
    for (let i = ambientParticles.current.length - 1; i >= 0; i--) {
        const p = ambientParticles.current[i]; 
        p.y += p.vy * dt; 
        p.x += Math.sin(performance.now() * 0.001 + p.phase) * 1.2 * dt;
        if (p.rotation !== undefined) p.rotation += 0.02 * dt;
        if (p.y > height + 100) ambientParticles.current.splice(i, 1);
    }
    bgHue.current = (bgHue.current + 0.05) % 360;
    if (pulseIntensity.current > 0) pulseIntensity.current = Math.max(0, pulseIntensity.current - 0.05);
    for (let i = xpPoints.current.length - 1; i >= 0; i--) {
        const xp = xpPoints.current[i]; xp.x += xp.vx * dt; xp.y += xp.vy * dt; xp.life -= 0.02 * dt;
        if (xp.life <= 0) xpPoints.current.splice(i, 1);
    }
    if (shakeIntensity.current > 0) shakeIntensity.current *= 0.9;
    if (flashOpacity.current > 0) flashOpacity.current -= 0.05;
    if (livesRef.current <= 0 && gameActive.current) { gameActive.current = false; soundManager.playGameOver(); setGameState('GAMEOVER'); }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number, image: any) => {
    if (width <= 0 || height <= 0) return;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (shakeIntensity.current > 0) ctx.translate((Math.random() - 0.5) * shakeIntensity.current, (Math.random() - 0.5) * shakeIntensity.current);
    
    // Draw Camera Feed (Darkened)
    if (image) { ctx.save(); ctx.scale(-1, 1); ctx.translate(-width, 0); ctx.drawImage(image, 0, 0, width, height); ctx.restore(); }
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(0, 0, width, height);
    
    // Ambient Atmosphere Gradient (Yellowish like Colex Image)
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    bgGrad.addColorStop(0, `hsla(45, 100%, 50%, ${0.05 + pulseIntensity.current * 0.2})`);
    bgGrad.addColorStop(1, `hsla(30, 100%, 10%, 0.4)`);
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, width, height);
    
    // Background Leaves
    ambientParticles.current.forEach(p => { 
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size/2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    if (bladeTrail.current.length > 1) {
        ctx.beginPath(); ctx.moveTo(bladeTrail.current[0].x, bladeTrail.current[0].y);
        for (let i = 1; i < bladeTrail.current.length; i++) { const p0 = bladeTrail.current[i-1]; const p1 = bladeTrail.current[i]; ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + p1.x)/2, (p0.y + p1.y)/2); }
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = '#FFFFFF'; ctx.shadowColor = '#00E5FF'; ctx.shadowBlur = 20; ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = '#00E5FF'; ctx.stroke(); ctx.shadowBlur = 0;
    }
    particles.current.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, Math.random() * 4 + 2, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1.0;
    
    fruits.current.forEach(f => {
        ctx.save(); ctx.translate(f.x, f.y);
        if (f.isSliced) {
             const angle = f.sliceAngle || 0; 
             const tS = performance.now() - ((f as any).slicedTime || 0);
             
             // --- IMPROVED MASH & SEPARATION LOGIC ---
             const impact = (f as any).impactIntensity || 15;
             let sep = 0;
             
             // Phase 1: MASH (0-60ms) - Quick compression/squash effect
             // Negative separation makes halves overlap/mash together
             if (tS < 60) {
                // Sine wave for organic squash and recoil
                sep = -12 * Math.sin((tS / 60) * Math.PI); 
             } else {
                // Phase 2: SEPARATION (>60ms) - Fly apart
                // Dynamic separation based on blade speed + acceleration over time
                const flyTime = tS - 60;
                sep = (impact * 0.8) * (flyTime * 0.05) + (flyTime * flyTime * 0.0015);
             }

             ctx.save(); ctx.rotate(f.rotation);
             [true, false].forEach(isTop => {
                ctx.save(); 
                ctx.rotate(angle - f.rotation); 
                // Slight scale pulse during mash
                const scale = tS < 60 ? 1.05 : 1.0;
                ctx.scale(scale, scale);
                
                ctx.translate(0, isTop ? -sep : sep); 
                ctx.rotate(-(angle - f.rotation));
                
                // Add slight angular drift between halves
                const drift = isTop ? -0.1 : 0.1;
                ctx.rotate(drift); 

                if (fruitCache.current[`${f.type}_${isTop?'top':'bottom'}`]) {
                    ctx.drawImage(fruitCache.current[`${f.type}_${isTop?'top':'bottom'}`], -f.radius*3.5, -f.radius*3.5);
                }
                ctx.restore();
             });
             ctx.restore();
        } else {
             ctx.rotate(f.rotation); if (fruitCache.current[`${f.type}_intact`]) { ctx.drawImage(fruitCache.current[`${f.type}_intact`], -f.radius*3.5, -f.radius*3.5); }
        }
        ctx.restore();
    });
    xpPoints.current.forEach(xp => { ctx.save(); ctx.globalAlpha = xp.life; ctx.translate(xp.x, xp.y); ctx.fillStyle = xp.color; ctx.shadowColor = 'black'; ctx.shadowBlur = 4; ctx.font = '900 32px Roboto'; ctx.fillText(`+${xp.value}`, 0, 0); ctx.restore(); });
    if (flashOpacity.current > 0) { ctx.fillStyle = `rgba(255, 0, 0, ${flashOpacity.current * 0.3})`; ctx.fillRect(0, 0, width, height); }
    ctx.restore();
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current; const container = containerRef.current; const ctx = canvas.getContext('2d', { alpha: false }); if (!ctx) return;
    const resizeObserver = new ResizeObserver(() => { if (container) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; } });
    resizeObserver.observe(container);
    let camera: any = null; let hands: any = null;
    const onResults = (results: any) => {
        if (isDestroyed.current) return; setLoading(false); setCameraError(null);
        if (results.multiHandLandmarks?.length > 0) {
            setHandDetected(true); const l = results.multiHandLandmarks[0][8]; const x = (1 - l.x) * canvas.width; const y = l.y * canvas.height;
            bladeTrail.current.push({ x, y }); if (bladeTrail.current.length > BLADE_TRAIL_LIMIT) bladeTrail.current.shift();
        } else { setHandDetected(false); if (!touchActive.current && bladeTrail.current.length > 0) bladeTrail.current.shift(); }
        if (gameActive.current) {
            const now = performance.now(); if (now - lastSpawnTime.current > Math.max(300, INITIAL_SPAWN_INTERVAL - (levelRef.current * 60))) { spawnFruit(canvas.width, canvas.height); lastSpawnTime.current = now; }
            checkCollisions(); updatePhysics(canvas.width, canvas.height);
        }
        draw(ctx, canvas.width, canvas.height, results.image);
    };
    const initMediaPipe = async () => {
        try {
            // @ts-ignore
            hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
            hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
            hands.onResults(onResults);
            // @ts-ignore
            camera = new window.Camera(video, {
                onFrame: async () => {
                   if (!isDestroyed.current && video.readyState >= 2 && video.videoWidth > 0 && hands) { await hands.send({ image: video }); }
                },
                width: 1280, height: 720
            });
            await camera.start();
        } catch (e: any) { 
             console.error("Camera error:", e);
             setLoading(false); 
             if (e.name === 'NotReadableError') {
                 setCameraError("Camera is busy or not available. Please close other apps using the camera.");
             } else if (e.name === 'NotAllowedError') {
                 setCameraError("Camera permission denied. Please allow access.");
             } else {
                 setCameraError(`Camera Error: ${e.message || "Unknown error"}`);
             }
        }
    };
    if (window.Hands && window.Camera) initMediaPipe();
    else { const cI = setInterval(() => { if (window.Hands && window.Camera) { clearInterval(cI); initMediaPipe(); } }, 500); }
    const tI = setInterval(() => { if (gameActive.current && timeLeft > 0) setTimeLeft(prev => prev - 1); else if (gameActive.current) { gameActive.current = false; soundManager.playGameOver(); setGameState('GAMEOVER'); } }, 1000);
    return () => {
        isDestroyed.current = true; if (camera) camera.stop(); 
        if (hands) { hands.close(); hands = null; }
        resizeObserver.disconnect(); clearInterval(tI);
    };
  }, []);

  const rank = getRank(score);

  return (
    <div className="relative w-full h-full bg-neutral-950 overflow-hidden font-roboto select-none">
       {/* Removed display:none via 'hidden' class, using opacity-0 and pointer-events-none instead */}
       <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline muted autoPlay />
       <div ref={containerRef} className="absolute inset-0 w-full h-full">
          <canvas ref={canvasRef} className="block w-full h-full touch-none" />
       </div>
       {loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50">
             <div className="relative"><div className="absolute inset-0 blur-xl bg-yellow-500/30 rounded-full animate-pulse" /><Loader2 className="w-16 h-16 text-yellow-500 animate-spin relative z-10" /></div>
             <p className="text-gray-400 mt-6 tracking-widest uppercase text-sm font-bold animate-pulse">Menyiapkan Alat Potong...</p>
             {cameraError && <p className="text-red-500 mt-4 bg-red-500/10 px-4 py-2 rounded border border-red-500/20 max-w-md text-center">{cameraError}</p>}
          </div>
       )}
       <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-30 pointer-events-none">
          <div className="flex flex-col gap-3">
             <div className="flex gap-2 p-2 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10">{[...Array(MAX_LIVES)].map((_, i) => (<Heart key={i} className={`w-6 h-6 transition-all duration-300 ${i < lives ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'fill-neutral-800 text-neutral-700'}`} />))}</div>
             <div className="bg-black/40 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 w-fit shadow-lg"><Award className="w-4 h-4 text-yellow-500" /><span className="text-yellow-500 font-bold text-sm tracking-wider">LEVEL {level}</span></div>
          </div>
          {gameState === 'PLAYING' && (<div className={`relative px-6 py-2 rounded-b-2xl backdrop-blur-sm transition-colors duration-300 ${timeLeft < 10 ? 'bg-red-500/10' : 'bg-transparent'}`}><div className={`text-5xl font-black tracking-widest tabular-nums drop-shadow-lg ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>{timeLeft}</div></div>)}
          <div className="flex flex-col items-end gap-3 pointer-events-auto">
             <div className="relative group"><div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" /><div className="relative text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-200 to-neutral-400 drop-shadow-2xl tabular-nums">{score.toLocaleString()}</div></div>
             <button onClick={toggleMute} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:bg-white/10 border border-white/5 transition-all active:scale-95">{isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
          </div>
       </div>
       
       {showLevelUp && (<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"><div className="text-center animate-bounce relative"><div className="absolute inset-0 bg-yellow-500/20 blur-[100px] rounded-full" /><h2 className="relative text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] stroke-white">LEVEL UP!</h2></div></div>)}
       {gameState === 'START' && !loading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-in fade-in duration-500">
              <GameLogo /><div className="mt-8 space-y-6 text-center"><button onClick={startCountdown} className="group relative px-10 py-5 bg-neutral-900 rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_-10px_rgba(234,179,8,0.5)]"><div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" /><div className="flex items-center gap-4 relative z-10"><div className="p-2 rounded-lg bg-orange-500 text-black group-hover:scale-110 transition-transform"><Play className="w-5 h-5 fill-current" /></div><span className="text-xl font-black text-white tracking-widest uppercase">Mulai Motong</span></div></button><div className="flex justify-center gap-8 text-neutral-500 text-xs font-medium tracking-wider uppercase"><div className="flex items-center gap-2"><Hand className="w-4 h-4" /><span>Gunakan Jari Telunjuk</span></div><div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500/50" /><span>Hindari Sambal!</span></div></div></div>
          </div>
       )}
       {gameState === 'COUNTDOWN' && (<div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-sm"><div className="text-[12rem] font-black text-white animate-ping drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">{countdown === 0 ? 'GO!' : countdown}</div></div>)}
       {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in zoom-in duration-300">
              <div className="text-center space-y-2 mb-12"><h2 className="text-sm font-bold text-neutral-500 uppercase tracking-[0.5em] mb-4">Simulasi Selesai</h2><div className={`text-8xl font-black ${rank.color} drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]`}>{score.toLocaleString()}</div><div className="inline-block bg-white/5 px-6 py-2 rounded-full border border-white/10 mt-4 backdrop-blur-md"><span className="text-sm font-bold tracking-widest text-neutral-300 uppercase">Pangkat: {rank.title}</span></div></div>
              <div className="grid grid-cols-2 gap-6 w-full max-w-md mb-12 px-4"><div className="bg-neutral-900/50 p-6 rounded-2xl flex flex-col items-center border border-white/5 relative group overflow-hidden"><div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" /><Zap className="w-6 h-6 text-yellow-500 mb-2" /><span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Total Skor</span><span className="text-2xl font-bold text-white mt-1">{score}</span></div><div className="bg-neutral-900/50 p-6 rounded-2xl flex flex-col items-center border border-white/5 relative group overflow-hidden"><div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" /><CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" /><span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Level Akhir</span><span className="text-2xl font-bold text-white mt-1">{level}</span></div></div>
              <div className="flex gap-4"><button onClick={startCountdown} className="relative inline-flex h-14 overflow-hidden rounded-full p-[2px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 hover:scale-105 transition-transform"><span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#50a3f9_50%,#E2E8F0_100%)]" /><span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl gap-2 uppercase tracking-widest"><RotateCcw className="w-5 h-5" />Coba Lagi</span></button></div>
          </div>
       )}
    </div>
  );
};

export default GeminiFruitSlicer;