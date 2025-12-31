
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

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
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
  const ambientParticles = useRef<AmbientParticle[]>([]);
  const xpPoints = useRef<XPPoint[]>([]);
  const bladeTrail = useRef<Point[]>([]);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(MAX_LIVES);
  const levelRef = useRef<number>(1);
  const lastSpawnTime = useRef<number>(0);
  const lastSwooshTime = useRef<number>(0);
  const captureRequestRef = useRef<boolean>(false);
  const lastAnalysisScore = useRef<number>(0);
  const gameActive = useRef<boolean>(false);
  
  // Visual Effects Refs
  const bgHue = useRef<number>(200);
  const pulseIntensity = useRef<number>(0);
  
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
    isDestroyed.current = false;
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
    fruits.current = []; particles.current = []; ambientParticles.current = []; xpPoints.current = []; gameActive.current = true;
    bgHue.current = 200; pulseIntensity.current = 0;
    lastAnalysisScore.current = 0;
    setGameState('PLAYING'); timeScale.current = 1.0; shakeIntensity.current = 0; flashOpacity.current = 0;
  };

  const spawnFruit = (width: number, height: number) => {
    const currentLevel = levelRef.current;
    const typeChance = Math.random();
    let type: FruitType = 'guava';
    
    let bombThreshold = 0;
    if (currentLevel >= 3) {
        bombThreshold = Math.min(0.35, 0.05 + ((currentLevel - 3) * 0.015));
    }
    
    if (typeChance < bombThreshold) { 
        type = 'bomb'; 
    } else {
        const roll = Math.random();
        const tier = Math.min(currentLevel, 15);
        
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
    const activeData = fruits.current.filter(f => !f.isSliced && f.type !== 'bomb').map(f => ({ type: FRUIT_CONFIG[f.type].label, y: f.y }));
    
    const response = await getSenseiAdvice(screenshot, activeData, scoreRef.current);
    
    if (response.hint && !isDestroyed.current) {
        setSenseiHint(response.hint.message);
        setPriorityFruit(response.hint.priorityFruit || null);
    }
    setIsAiThinking(false);
  };

  // --- RENDERING HELPERS ---

  const drawFruitGraphic = (ctx: CanvasRenderingContext2D, type: FruitType, radius: number, isTop?: boolean) => {
    const config = FRUIT_CONFIG[type];
    ctx.save();
    
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

    const grad = ctx.createRadialGradient(-radius*0.3, -radius*0.3, radius*0.1, 0, 0, radius);
    grad.addColorStop(0, adjustColor(config.hex, 30));
    grad.addColorStop(1, adjustColor(config.hex, -20));
    ctx.fillStyle = grad;
    ctx.fill();

    if (type !== 'bomb') {
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      for(let i=0; i<8; i++) {
        const sx = (Math.random()-0.5)*radius*1.4;
        const sy = (Math.random()-0.5)*radius*1.4;
        ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI*2); ctx.fill();
      }
    } else {
      ctx.strokeStyle = '#ff9999';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
      ctx.moveTo(10, -10); ctx.lineTo(-10, 10);
      ctx.stroke();
    }

    if (isTop !== undefined) {
      const yOffset = isTop ? 0 : 0;
      ctx.fillStyle = config.fleshColor;
      ctx.beginPath();
      ctx.ellipse(0, yOffset, radius * 0.85, radius * 0.85 * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  };

  // --- MAIN GAME LOOP ---

  const checkCollisions = () => {
    if (bladeTrail.current.length < 2) return;
    const tip = bladeTrail.current[bladeTrail.current.length - 1];
    const prev = bladeTrail.current[bladeTrail.current.length - 2];
    
    // Calculate blade velocity for sound/physics
    const dx = tip.x - prev.x;
    const dy = tip.y - prev.y;
    const speed = Math.sqrt(dx*dx + dy*dy);
    
    if (speed > 25 && performance.now() - lastSwooshTime.current > 150) {
        soundManager.playSwoosh();
        lastSwooshTime.current = performance.now();
    }

    fruits.current.forEach(fruit => {
      if (fruit.isSliced) return;

      // Line Segment to Circle intersection
      const fx = fruit.x; const fy = fruit.y;
      const t = ((fx - prev.x) * (tip.x - prev.x) + (fy - prev.y) * (tip.y - prev.y)) / (speed * speed);
      const clampT = Math.max(0, Math.min(1, t));
      const closestX = prev.x + clampT * (tip.x - prev.x);
      const closestY = prev.y + clampT * (tip.y - prev.y);
      const dist = Math.sqrt((fx - closestX)**2 + (fy - closestY)**2);

      if (dist < fruit.radius) {
        // HIT!
        fruit.isSliced = true;
        const config = FRUIT_CONFIG[fruit.type];
        
        // Effects
        shakeIntensity.current = fruit.type === 'bomb' ? 25 : 3;
        pulseIntensity.current = 0.3; // Flash background slightly on hit
        
        if (fruit.type === 'bomb') {
            soundManager.playBombExplosion();
            createExplosion(fruit.x, fruit.y, '#FF4444', dx, dy, true);
            flashOpacity.current = 0.8;
            livesRef.current = Math.max(0, livesRef.current - 1);
            setLives(livesRef.current);
            timeScale.current = 0.1; // Hitstop
            setTimeout(() => { if(!isDestroyed.current) timeScale.current = 1.0; }, 400);
        } else {
            soundManager.playSlice();
            createExplosion(fruit.x, fruit.y, config.fleshColor, dx, dy);
            
            // Score
            const points = config.points;
            scoreRef.current += points;
            setScore(scoreRef.current);
            
            // Level Logic
            const nextLevel = 1 + Math.floor(scoreRef.current / 300);
            if (nextLevel > levelRef.current) {
                levelRef.current = nextLevel;
                setLevel(nextLevel);
                soundManager.playLevelUp();
                pulseIntensity.current = 1.0; // Big flash on level up
                setShowLevelUp(true);
                setTimeout(() => setShowLevelUp(false), 2000);
            }

            // Floating Text
            xpPoints.current.push({
                x: fruit.x, y: fruit.y - 30,
                value: points, color: config.hex,
                life: 1.0, vx: 0, vy: -2
            });

            // Trigger AI Analysis on high value slices or score thresholds
            if (fruit.type === 'sweet_mango' || (scoreRef.current - lastAnalysisScore.current >= 500)) {
                captureRequestRef.current = true;
                lastAnalysisScore.current = scoreRef.current;
            }
        }
        
        // Push apart halves
        const sliceAngle = Math.atan2(dy, dx);
        fruit.sliceAngle = sliceAngle;
        fruit.vx = Math.cos(sliceAngle) * 2; // Add some impact
        fruit.vy = Math.sin(sliceAngle) * 2;
      }
    });
  };

  const updatePhysics = (width: number, height: number) => {
    const dt = timeScale.current;
    
    // Update Fruits
    for (let i = fruits.current.length - 1; i >= 0; i--) {
      const f = fruits.current[i];
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += GRAVITY * dt;
      f.rotation += f.rotationSpeed * dt;

      // Missed fruit logic
      if (f.y > height + 100) {
        if (!f.isSliced && f.type !== 'bomb') {
             // Currently no penalty for missing, just cleanup
        }
        fruits.current.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = particles.current.length - 1; i >= 0; i--) {
      const p = particles.current[i];
      if (p.wait && p.wait > 0) {
        p.wait -= 0.05 * dt;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += GRAVITY * 0.5 * dt;
      p.life -= 0.015 * dt;
      if (p.life <= 0) particles.current.splice(i, 1);
    }

    // Update Ambient Particles
    const targetAmbient = 40 + (levelRef.current * 10);
    if (ambientParticles.current.length < targetAmbient) {
        ambientParticles.current.push({
            x: Math.random() * width,
            y: height + Math.random() * 100,
            vx: 0,
            vy: -(Math.random() * 0.5 + 0.2 + (levelRef.current * 0.1)),
            size: Math.random() * 3 + 1,
            opacity: 0,
            phase: Math.random() * Math.PI * 2
        });
    }

    for (let i = ambientParticles.current.length - 1; i >= 0; i--) {
        const p = ambientParticles.current[i];
        p.y += p.vy * dt;
        p.x += Math.sin(performance.now() * 0.001 + p.phase) * 0.5 * dt;
        
        if (p.opacity < 0.4) p.opacity += 0.01 * dt;
        
        if (p.y < -10) {
            ambientParticles.current.splice(i, 1);
        }
    }

    // Update Background Effects
    bgHue.current = (bgHue.current + 0.1 + (levelRef.current * 0.02)) % 360;
    if (pulseIntensity.current > 0) pulseIntensity.current = Math.max(0, pulseIntensity.current - 0.05);

    // Update XP Points
    for (let i = xpPoints.current.length - 1; i >= 0; i--) {
        const xp = xpPoints.current[i];
        xp.x += xp.vx * dt;
        xp.y += xp.vy * dt;
        xp.life -= 0.02 * dt;
        if (xp.life <= 0) xpPoints.current.splice(i, 1);
    }

    // Shake Decay
    if (shakeIntensity.current > 0) shakeIntensity.current *= 0.9;
    if (shakeIntensity.current < 0.5) shakeIntensity.current = 0;
    
    // Flash Decay
    if (flashOpacity.current > 0) flashOpacity.current -= 0.05;

    // Check Game Over
    if (livesRef.current <= 0 && gameActive.current) {
        gameActive.current = false;
        soundManager.playGameOver();
        setGameState('GAMEOVER');
        
        // One final AI analysis for the post-game
        captureRequestRef.current = true;
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number, image: any) => {
    ctx.clearRect(0, 0, width, height);
    
    // Shake effect
    ctx.save();
    if (shakeIntensity.current > 0) {
        const dx = (Math.random() - 0.5) * shakeIntensity.current;
        const dy = (Math.random() - 0.5) * shakeIntensity.current;
        ctx.translate(dx, dy);
    }

    // Draw Camera Feed
    if (image) {
      ctx.save();
      ctx.scale(-1, 1); // Mirror
      ctx.translate(-width, 0);
      ctx.drawImage(image, 0, 0, width, height);
      ctx.restore();
    }
    
    // Darken Overlay with Dynamic Tint
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, width, height);
    
    // Ambient Atmosphere Overlay
    ctx.save();
    const bgGrad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width);
    // Center glow pulsing with gameplay
    bgGrad.addColorStop(0, `hsla(${bgHue.current}, 70%, 50%, ${0.05 + pulseIntensity.current * 0.2})`);
    // Dark edges shifting with level
    bgGrad.addColorStop(1, `hsla(${(bgHue.current + 40) % 360}, 70%, 15%, 0.3)`);
    
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Draw Ambient Particles
    ctx.save();
    ambientParticles.current.forEach(p => {
        const pColor = `hsla(${bgHue.current}, 80%, 80%, ${p.opacity})`;
        ctx.fillStyle = pColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    // Draw Blade Trail
    if (bladeTrail.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(bladeTrail.current[0].x, bladeTrail.current[0].y);
        for (let i = 1; i < bladeTrail.current.length; i++) {
            // Smooth curve
            const p0 = bladeTrail.current[i-1];
            const p1 = bladeTrail.current[i];
            const mx = (p0.x + p1.x) / 2;
            const my = (p0.y + p1.y) / 2;
            ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#00E5FF';
        ctx.shadowColor = '#00E5FF';
        ctx.shadowBlur = 20;
        ctx.stroke();
        
        // Inner white core
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // Draw Particles
    particles.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.random() * 3 + 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Fruits
    fruits.current.forEach(f => {
        ctx.save();
        ctx.translate(f.x, f.y);
        
        if (f.isSliced) {
             const sep = 25; // Separation distance
             const angle = f.sliceAngle || 0;
             const dx = Math.cos(angle + Math.PI/2) * sep;
             const dy = Math.sin(angle + Math.PI/2) * sep;
             
             // Top Half
             ctx.save();
             ctx.translate(-dx, -dy);
             ctx.rotate(f.rotation - 0.2); // Tilt away
             if (fruitCache.current[`${f.type}_top`]) {
                ctx.drawImage(fruitCache.current[`${f.type}_top`], -f.radius*3, -f.radius*3);
             }
             ctx.restore();

             // Bottom Half
             ctx.save();
             ctx.translate(dx, dy);
             ctx.rotate(f.rotation + 0.2);
             if (fruitCache.current[`${f.type}_bottom`]) {
                ctx.drawImage(fruitCache.current[`${f.type}_bottom`], -f.radius*3, -f.radius*3);
             }
             ctx.restore();

        } else {
             ctx.rotate(f.rotation);
             // Use cached canvas for performance
             if (fruitCache.current[`${f.type}_intact`]) {
                // Determine scale based on type (bombs pulse)
                let s = 1.0;
                if (f.type === 'bomb') s = 1.0 + Math.sin(performance.now() * 0.01) * 0.1;
                
                ctx.scale(s, s);
                ctx.drawImage(fruitCache.current[`${f.type}_intact`], -f.radius*3, -f.radius*3);
                
                // Priority Indicator
                if (priorityFruit === f.type) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0,0, f.radius + 10, 0, Math.PI*2);
                    ctx.stroke();
                }
             }
        }
        ctx.restore();
    });

    // Draw XP Points (Floating Text)
    xpPoints.current.forEach(xp => {
        ctx.save();
        ctx.globalAlpha = xp.life;
        ctx.translate(xp.x, xp.y);
        ctx.fillStyle = xp.color;
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.font = '900 28px Roboto';
        ctx.fillText(`+${xp.value}`, 0, 0);
        ctx.restore();
    });

    // Flash Overlay (Bomb)
    if (flashOpacity.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity.current})`;
        ctx.fillRect(0, 0, width, height);
    }

    ctx.restore(); // Restore shake
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    // Resize handling
    const resizeObserver = new ResizeObserver(() => {
        if (container) {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        }
    });
    resizeObserver.observe(container);

    let camera: any = null;
    let hands: any = null;

    const onResults = (results: any) => {
        if (isDestroyed.current) return;
        setLoading(false);
        setCameraError(null);

        // Update Hand tracking
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            setHandDetected(true);
            const landmarks = results.multiHandLandmarks[0];
            // Use Index Finger Tip (Landmark 8)
            const indexTip = landmarks[8];
            const x = (1 - indexTip.x) * canvas.width; // Mirror X
            const y = indexTip.y * canvas.height;
            
            bladeTrail.current.push({ x, y });
            if (bladeTrail.current.length > BLADE_TRAIL_LIMIT) bladeTrail.current.shift();
        } else {
            setHandDetected(false);
            if (!touchActive.current && bladeTrail.current.length > 0) {
                // Decay trail if hand lost
                bladeTrail.current.shift();
            }
        }
        
        // Game Logic update (tied to frame rate)
        if (gameActive.current) {
            // Spawning
            const now = performance.now();
            const spawnRate = Math.max(300, INITIAL_SPAWN_INTERVAL - (levelRef.current * 60));
            if (now - lastSpawnTime.current > spawnRate) {
                spawnFruit(canvas.width, canvas.height);
                lastSpawnTime.current = now;
            }
            
            checkCollisions();
            updatePhysics(canvas.width, canvas.height);
        }

        draw(ctx, canvas.width, canvas.height, results.image);

        // Handle Screenshot for AI
        if (captureRequestRef.current) {
            captureRequestRef.current = false;
            // Draw current state to an offscreen canvas for cleaner screenshot
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = 480; tempCanvas.height = 360; // Low Res for API
            const tCtx = tempCanvas.getContext('2d');
            if (tCtx) {
                tCtx.drawImage(canvas, 0, 0, 480, 360);
                performAiAnalysis(tempCanvas.toDataURL('image/jpeg', 0.6));
            }
        }
    };

    const initMediaPipe = async () => {
        try {
            // @ts-ignore
            hands = new window.Hands({
                locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
            });
            hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            hands.onResults(onResults);

            // @ts-ignore
            camera = new window.Camera(video, {
                onFrame: async () => {
                   if (!isDestroyed.current && videoRef.current) await hands.send({ image: videoRef.current });
                },
                width: 1280,
                height: 720
            });
            await camera.start();
        } catch (e: any) {
            console.error("MediaPipe Init Error:", e);
            setCameraError("Camera access denied or not available.");
            setLoading(false);
        }
    };

    if (window.Hands && window.Camera) {
        initMediaPipe();
    } else {
        // Fallback or wait for script load (handled by index.html script tags usually)
        const checkInterval = setInterval(() => {
            if (window.Hands && window.Camera) {
                clearInterval(checkInterval);
                initMediaPipe();
            }
        }, 500);
    }

    // Timer Logic
    const timerInterval = setInterval(() => {
        if (gameActive.current && timeLeft > 0) {
            setTimeLeft(prev => prev - 1);
        } else if (gameActive.current && timeLeft <= 0) {
            gameActive.current = false;
            soundManager.playGameOver();
            setGameState('GAMEOVER');
            captureRequestRef.current = true;
        }
    }, 1000);

    return () => {
        isDestroyed.current = true;
        if (camera) camera.stop();
        if (hands) hands.close();
        resizeObserver.disconnect();
        clearInterval(timerInterval);
    };
  }, [timeLeft]); // Re-bind if timer changes (actually mostly runs once due to refs)


  // --- UI RENDER ---

  const rank = getRank(score);

  return (
    <div className="relative w-full h-full bg-neutral-950 overflow-hidden font-roboto select-none">
       <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover hidden" playsInline muted />
       <div ref={containerRef} className="absolute inset-0 w-full h-full">
          <canvas ref={canvasRef} className="block w-full h-full touch-none" />
       </div>

       {/* Loading Screen */}
       {loading && (
          <div className="absolute inset-0 bg-black flex flex-col items-center justify-center z-50">
             <div className="relative">
                <div className="absolute inset-0 blur-xl bg-blue-500/30 rounded-full animate-pulse" />
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
             </div>
             <p className="text-gray-400 mt-6 tracking-widest uppercase text-sm font-bold animate-pulse">Initializing Vision System...</p>
             {cameraError && <p className="text-red-500 mt-4 bg-red-500/10 px-4 py-2 rounded border border-red-500/20">{cameraError}</p>}
          </div>
       )}

       {/* HUD - Top Bar */}
       <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-30 pointer-events-none">
          {/* Left: Lives & Level */}
          <div className="flex flex-col gap-3">
             <div className="flex gap-2 p-2 bg-black/20 backdrop-blur-md rounded-2xl border border-white/5">
                {[...Array(MAX_LIVES)].map((_, i) => (
                    <Heart 
                        key={i} 
                        className={`w-6 h-6 transition-all duration-300 ${i < lives ? 'fill-red-500 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'fill-neutral-800 text-neutral-700'}`} 
                    />
                ))}
             </div>
             <div className="bg-black/40 backdrop-blur-xl px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 w-fit shadow-lg">
                <Award className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-500 font-bold text-sm tracking-wider">LVL {level}</span>
             </div>
          </div>

          {/* Center: Timer (Only in game) */}
          {gameState === 'PLAYING' && (
             <div className={`relative px-6 py-2 rounded-b-2xl backdrop-blur-sm transition-colors duration-300 ${timeLeft < 10 ? 'bg-red-500/10' : 'bg-transparent'}`}>
                <div className={`text-5xl font-black tracking-widest tabular-nums drop-shadow-lg ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                    {timeLeft}
                </div>
                {timeLeft < 10 && <div className="absolute inset-0 bg-red-500/10 blur-xl rounded-full -z-10 animate-pulse" />}
             </div>
          )}

          {/* Right: Score & Mute */}
          <div className="flex flex-col items-end gap-3 pointer-events-auto">
             <div className="relative group">
                 <div className="absolute -inset-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                 <div className="relative text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-200 to-neutral-400 drop-shadow-2xl tabular-nums">
                    {score.toLocaleString()}
                 </div>
             </div>
             <button onClick={toggleMute} className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white/70 hover:bg-white/10 border border-white/5 transition-all active:scale-95">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
             </button>
          </div>
       </div>

       {/* Sensei Hint Overlay - Bottom Center */}
       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xl z-30">
           <div className={`
                relative overflow-hidden
                bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl
                transition-all duration-500 group
                ${isAiThinking ? 'shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)] border-blue-500/30' : 'hover:border-white/20'}
           `}>
                {/* Animated Gradient Border Effect */}
                <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer pointer-events-none`} />
                
                <div className="flex items-start gap-4">
                    <div className={`
                        p-3 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 border border-white/5 shadow-inner
                        ${isAiThinking ? 'animate-pulse ring-2 ring-blue-500/20' : ''}
                    `}>
                        <BrainCircuit className={`w-6 h-6 ${isAiThinking ? 'text-blue-400' : 'text-neutral-400'}`} />
                    </div>
                    
                    <div className="flex-1">
                         <div className="flex items-center justify-between mb-1">
                            <h3 className={`text-xs font-bold tracking-[0.2em] uppercase ${isAiThinking ? 'text-blue-400' : 'text-neutral-500'}`}>
                                {isAiThinking ? 'ANALYZING TACTICS...' : 'SENSEI SAYS'}
                            </h3>
                            {priorityFruit && !isAiThinking && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                                    <Zap className="w-3 h-3 text-yellow-500" />
                                    <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Priority Target</span>
                                </div>
                            )}
                        </div>
                        <p className="text-neutral-200 text-sm leading-relaxed font-medium">
                            "{senseiHint}"
                        </p>
                    </div>
                </div>
           </div>
       </div>

       {/* Hand Tracking Status (Bottom Right) */}
       <div className="absolute bottom-8 right-8 z-20 hidden md:flex items-center gap-3 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5">
          <div className="relative">
            <div className={`w-2.5 h-2.5 rounded-full ${handDetected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${handDetected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          </div>
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest">{handDetected ? 'System Online' : 'Searching Hand'}</span>
       </div>

       {/* Level Up Splash */}
       {showLevelUp && (
          <div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
             <div className="text-center animate-bounce relative">
                <div className="absolute inset-0 bg-yellow-500/20 blur-[100px] rounded-full" />
                <h2 className="relative text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] stroke-white">
                    LEVEL UP!
                </h2>
             </div>
          </div>
       )}

       {/* GAME STATES: Start / Countdown / GameOver */}
       
       {gameState === 'START' && !loading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 animate-in fade-in duration-500">
              <GameLogo />
              
              <div className="mt-16 space-y-6 text-center">
                  <button 
                    onClick={startCountdown}
                    className="group relative px-10 py-5 bg-neutral-900 rounded-2xl overflow-hidden hover:scale-105 transition-all duration-300 shadow-[0_0_0_1px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_-10px_rgba(234,179,8,0.5)]"
                  >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="flex items-center gap-4 relative z-10">
                          <div className="p-2 rounded-lg bg-orange-500 text-black group-hover:scale-110 transition-transform">
                             <Play className="w-5 h-5 fill-current" />
                          </div>
                          <span className="text-xl font-black text-white tracking-widest uppercase">Start Game</span>
                      </div>
                  </button>
                  
                  <div className="flex justify-center gap-8 text-neutral-500 text-xs font-medium tracking-wider uppercase">
                      <div className="flex items-center gap-2">
                          <Hand className="w-4 h-4" />
                          <span>Index Finger Control</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500/50" />
                          <span>Avoid Bombs</span>
                      </div>
                  </div>
              </div>
          </div>
       )}

       {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-sm">
             <div className="text-[12rem] font-black text-white animate-ping drop-shadow-[0_0_50px_rgba(255,255,255,0.5)]">
                {countdown === 0 ? 'GO!' : countdown}
             </div>
          </div>
       )}

       {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in zoom-in duration-300">
              <div className="text-center space-y-2 mb-12">
                  <h2 className="text-sm font-bold text-neutral-500 uppercase tracking-[0.5em] mb-4">Simulation Ended</h2>
                  <div className={`text-8xl font-black ${rank.color} drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]`}>
                      {score.toLocaleString()}
                  </div>
                  <div className="inline-block bg-white/5 px-6 py-2 rounded-full border border-white/10 mt-4 backdrop-blur-md">
                      <span className="text-sm font-bold tracking-widest text-neutral-300 uppercase">Rank: {rank.title}</span>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-6 w-full max-w-md mb-12 px-4">
                  <div className="bg-neutral-900/50 p-6 rounded-2xl flex flex-col items-center border border-white/5 relative group overflow-hidden">
                      <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Zap className="w-6 h-6 text-yellow-500 mb-2" />
                      <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Total Score</span>
                      <span className="text-2xl font-bold text-white mt-1">{score}</span>
                  </div>
                  <div className="bg-neutral-900/50 p-6 rounded-2xl flex flex-col items-center border border-white/5 relative group overflow-hidden">
                      <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-2" />
                      <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Level Reached</span>
                      <span className="text-2xl font-bold text-white mt-1">{level}</span>
                  </div>
              </div>

              <div className="flex gap-4">
                  {/* Magic UI Shimmer Button for Retry */}
                  <button 
                    onClick={startCountdown}
                    className="relative inline-flex h-14 overflow-hidden rounded-full p-[2px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 hover:scale-105 transition-transform"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#E2E8F0_0%,#50a3f9_50%,#E2E8F0_100%)]" />
                    <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-950 px-8 py-1 text-sm font-medium text-white backdrop-blur-3xl gap-2 uppercase tracking-widest">
                      <RotateCcw className="w-5 h-5" />
                      Play Again
                    </span>
                  </button>
              </div>
          </div>
       )}
    </div>
  );
};

export default GeminiFruitSlicer;
