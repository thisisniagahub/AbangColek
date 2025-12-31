
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
  guava:       { hex: '#8DBF42', points: 10,  label: 'Guava',       radius: 46, fleshColor: '#F48FB1', secondaryColor: '#558B2F', speckleColor: '#33691E' },
  mango:       { hex: '#FFC107', points: 20,  label: 'Mango',       radius: 54, fleshColor: '#FFE082', secondaryColor: '#E65100', speckleColor: '#F57C00' },
  pineapple:   { hex: '#FDD835', points: 50,  label: 'Pineapple',   radius: 68, fleshColor: '#FFF9C4', secondaryColor: '#795548', speckleColor: '#5D4037' },
  sweet_mango: { hex: '#FF7043', points: 150, label: 'Sweet Mango', radius: 56, fleshColor: '#FFCC80', secondaryColor: '#3E2723', speckleColor: '#212121' },
  bomb:        { hex: '#121212', points: -100, label: 'Spicy Bottle', radius: 42, fleshColor: '#D32F2F', secondaryColor: '#000000', speckleColor: '#FF1744' }
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

const GameLogo: React.FC<{ size?: 'sm' | 'lg' }> = ({ size = 'lg' }) => {
  const isLarge = size === 'lg';
  return (
    <div className={`flex flex-col items-center justify-center select-none ${isLarge ? 'gap-2' : 'gap-0 scale-75 md:scale-100'}`}>
      <div className="relative">
        <div className={`absolute inset-0 bg-red-600/30 blur-3xl rounded-full ${isLarge ? 'scale-150' : 'scale-110'}`} />
        
        <svg 
          viewBox="0 0 400 160" 
          className={isLarge ? "w-full max-w-lg h-auto drop-shadow-[0_0_30px_rgba(255,112,67,0.4)]" : "w-48 h-16"}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="abangGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FF7043" />
              <stop offset="50%" stopColor="#F4511E" />
              <stop offset="100%" stopColor="#BF360C" />
            </linearGradient>
            <linearGradient id="bladeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="neon">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
              <feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
              <feFlood floodColor="#00B8D4" result="color" />
              <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
              <feComponentTransfer in="shadow">
                <feFuncA type="linear" slope="0.8" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle cx="200" cy="65" r="50" fill="#FFC107" fillOpacity="0.1" />
          <text x="200" y="85" textAnchor="middle" className="font-[900] italic" style={{ fontSize: '100px', fill: 'url(#abangGrad)', stroke: '#3E2723', strokeWidth: '4px', letterSpacing: '-4px' }}>ABANG</text>
          <text x="200" y="135" textAnchor="middle" className="font-[900]" style={{ fontSize: '32px', fill: '#00E5FF', filter: 'url(#neon)', letterSpacing: '8px', textTransform: 'uppercase' }}>FRUIT NINJA</text>
          <rect x="50" y="70" width="300" height="4" fill="url(#bladeGrad)" transform="rotate(-15, 200, 72)" className="animate-pulse" />
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
  const lastSpawnTime = useRef<number>(0);
  const lastSwooshTime = useRef<number>(0);
  const captureRequestRef = useRef<boolean>(false);
  const gameActive = useRef<boolean>(false);

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
  const [senseiHint, setSenseiHint] = useState<string>("Sensei sedang mengasah mata batinnya...");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [priorityFruit, setPriorityFruit] = useState<FruitType | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    setIsMuted(soundManager.getMuteState());
    initFruitCache();
  }, []);

  const toggleMute = () => {
    const newState = soundManager.toggleMute();
    setIsMuted(newState);
  };

  const initFruitCache = () => {
    (Object.keys(FRUIT_CONFIG) as FruitType[]).forEach(type => {
      const radius = FRUIT_CONFIG[type].radius;
      const size = Math.ceil(radius * 5.8); 

      const intactCanvas = document.createElement('canvas');
      intactCanvas.width = size; intactCanvas.height = size;
      const ctxI = intactCanvas.getContext('2d');
      if (ctxI) {
          ctxI.translate(size/2, size/2);
          drawRealisticFruitProcedural(ctxI, type, radius);
          fruitCache.current[`${type}_intact`] = intactCanvas;
      }

      const topCanvas = document.createElement('canvas');
      topCanvas.width = size; topCanvas.height = size;
      const ctxT = topCanvas.getContext('2d');
      if (ctxT) {
          ctxT.translate(size/2, size/2);
          drawRealisticFruitProcedural(ctxT, type, radius, true);
          fruitCache.current[`${type}_top`] = topCanvas;
      }

      const bottomCanvas = document.createElement('canvas');
      bottomCanvas.width = size; bottomCanvas.height = size;
      const ctxB = bottomCanvas.getContext('2d');
      if (ctxB) {
          ctxB.translate(size/2, size/2);
          drawRealisticFruitProcedural(ctxB, type, radius, false);
          fruitCache.current[`${type}_bottom`] = bottomCanvas;
      }
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
        const timer = setTimeout(() => {
          setCountdown(countdown - 1);
          soundManager.playClick();
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        startGame();
      }
    }
  }, [countdown, gameState]);

  const startGame = () => {
    scoreRef.current = 0;
    livesRef.current = MAX_LIVES;
    setScore(0);
    setLives(MAX_LIVES);
    setTimeLeft(GAME_DURATION);
    setLevel(1);
    fruits.current = [];
    particles.current = [];
    xpPoints.current = [];
    gameActive.current = true;
    setGameState('PLAYING');
    timeScale.current = 1.0;
    shakeIntensity.current = 0;
    flashOpacity.current = 0;
  };

  const spawnFruit = (width: number, height: number) => {
    const typeChance = Math.random();
    let type: FruitType = 'guava';
    
    const bombThreshold = Math.min(0.25, 0.05 + (level * 0.03));
    if (typeChance < bombThreshold) {
        type = 'bomb';
    } else {
        const roll = Math.random();
        if (roll > 0.94) type = 'sweet_mango';
        else if (roll > 0.82) type = 'pineapple';
        else if (roll > 0.45) type = 'mango';
        else type = 'guava';
    }

    const config = FRUIT_CONFIG[type];
    const levelBonus = Math.min(12, (level - 1) * 2);
    const padding = 120;
    const launchX = Math.random() * (width - padding * 2) + padding;
    
    let baseVx = (Math.random() - 0.5) * 8;
    if (launchX < width * 0.25) baseVx = Math.random() * 5 + 4;
    if (launchX > width * 0.75) baseVx = -(Math.random() * 5 + 4);

    fruits.current.push({
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: launchX,
      y: height + 100,
      vx: baseVx,
      vy: -(Math.random() * 6 + 18 + levelBonus), 
      radius: config.radius,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.18,
      isSliced: false
    });
  };

  const createExplosion = (x: number, y: number, color: string, bladeDx: number, bladeDy: number, isBomb = false) => {
    const bladeLen = Math.sqrt(bladeDx*bladeDx + bladeDy*bladeDy) || 1;
    const nx = bladeDx / bladeLen;
    const ny = bladeDy / bladeLen;
    const count = (isBomb ? 40 : 20) + Math.random() * 15;
    
    for (let i = 0; i < count; i++) {
      if (particles.current.length >= MAX_PARTICLES) particles.current.shift();
      const angle = Math.atan2(ny, nx) + (Math.random() - 0.5) * (isBomb ? 6.28 : 2.8); 
      const speed = Math.random() * (isBomb ? 25 : 18) + 5;
      particles.current.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        color: Math.random() > 0.8 ? '#FFFFFF' : color 
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
      setPriorityFruit(res.hint.priorityFruit || null);
    } catch (e) {
      console.error("AI failed", e);
    } finally {
      setIsAiThinking(false);
    }
  };

  const drawFruit = (ctx: CanvasRenderingContext2D, fruit: Fruit) => {
    const type = fruit.type;
    const radius = fruit.radius;
    const size = Math.ceil(radius * 5.8);

    ctx.save();
    ctx.translate(fruit.x, fruit.y);
    ctx.rotate(fruit.rotation);

    if (fruit.isSliced) {
      const angle = fruit.sliceAngle || 0;
      ctx.rotate(angle);
      
      const separation = 40 * (1.0 - timeScale.current * 0.5); 
      const topImg = fruitCache.current[`${type}_top`];
      if (topImg) ctx.drawImage(topImg, -size/2, -size/2 - separation, size, size);
      const bottomImg = fruitCache.current[`${type}_bottom`];
      if (bottomImg) ctx.drawImage(bottomImg, -size/2, -size/2 + separation, size, size);
    } else {
      const intactImg = fruitCache.current[`${type}_intact`];
      if (intactImg) ctx.drawImage(intactImg, -size/2, -size/2, size, size);
    }
    ctx.restore();
  };

  const drawRealisticFruitProcedural = (ctx: CanvasRenderingContext2D, type: FruitType, radius: number, isHalfTop?: boolean) => {
    const config = FRUIT_CONFIG[type];
    
    if (type === 'bomb') {
        ctx.save();
        if (isHalfTop === true) {
            ctx.beginPath(); ctx.rect(-radius*6, -radius*6, radius*12, radius*6); ctx.clip();
        } else if (isHalfTop === false) {
            ctx.beginPath(); ctx.rect(-radius*6, 0, radius*12, radius*6); ctx.clip();
        }

        const bodyW = radius * 0.85;
        const bodyH = radius * 1.5;

        // Bottle Outline with Gloss
        ctx.beginPath();
        ctx.moveTo(-bodyW, bodyH/2.5);
        ctx.lineTo(bodyW, bodyH/2.5);
        ctx.lineTo(bodyW, -bodyH/4);
        ctx.quadraticCurveTo(bodyW, -bodyH/2, bodyW/2.2, -bodyH/2);
        ctx.lineTo(bodyW/3, -bodyH);
        ctx.lineTo(-bodyW/3, -bodyH);
        ctx.lineTo(-bodyW/2.2, -bodyH/2);
        ctx.quadraticCurveTo(-bodyW, -bodyH/2, -bodyW, -bodyH/4);
        ctx.closePath();

        const grad = ctx.createLinearGradient(-bodyW, 0, bodyW, 0);
        grad.addColorStop(0, '#0a0a0a');
        grad.addColorStop(0.3, '#333333');
        grad.addColorStop(0.5, '#444444');
        grad.addColorStop(0.7, '#111111');
        grad.addColorStop(1, '#000000');
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 2.5; ctx.stroke();

        // Shiny Highlight on Bottle
        const glassShine = ctx.createLinearGradient(-bodyW, -bodyH, bodyW, bodyH);
        glassShine.addColorStop(0, 'rgba(255,255,255,0.1)');
        glassShine.addColorStop(0.5, 'rgba(255,255,255,0)');
        glassShine.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = glassShine;
        ctx.fill();

        // Label with Detail
        ctx.fillStyle = '#C62828';
        ctx.fillRect(-bodyW*0.75, -bodyH*0.15, bodyW*1.5, bodyH*0.45);
        ctx.strokeStyle = '#FFCDD2'; ctx.lineWidth = 1; ctx.strokeRect(-bodyW*0.75, -bodyH*0.15, bodyW*1.5, bodyH*0.45);
        
        ctx.fillStyle = '#FFFFFF'; ctx.font = `bold ${radius/3}px Roboto`; ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
        ctx.fillText('PEDAS', 0, bodyH*0.12);
        ctx.shadowBlur = 0;

        // Cap with Metallic Texture
        const capGrad = ctx.createLinearGradient(-bodyW/3, 0, bodyW/3, 0);
        capGrad.addColorStop(0, '#B71C1C'); capGrad.addColorStop(0.5, '#FF5252'); capGrad.addColorStop(1, '#8E0000');
        ctx.fillStyle = capGrad;
        ctx.fillRect(-bodyW/3 - 2, -bodyH - 12, bodyW/1.5 + 4, 12);
        ctx.strokeStyle = '#3E2723'; ctx.strokeRect(-bodyW/3 - 2, -bodyH - 12, bodyW/1.5 + 4, 12);

        ctx.restore();
        return;
    }

    const drawShape = () => {
        ctx.beginPath();
        if (type === 'mango' || type === 'sweet_mango') {
            ctx.moveTo(0, -radius * 1.18);
            ctx.bezierCurveTo(radius * 1.4, -radius * 1.15, radius * 1.5, radius * 0.9, 0, radius * 1.28); 
            ctx.bezierCurveTo(-radius * 1.0, radius * 1.2, -radius * 1.8, -radius * 0.3, 0, -radius * 1.18);
        } else if (type === 'pineapple') {
            ctx.ellipse(0, 0, radius * 0.88, radius * 1.28, 0, 0, Math.PI * 2);
        } else {
            ctx.moveTo(radius, 0);
            for(let a=0; a<Math.PI*2; a+=0.1) {
                const r = radius * (0.97 + Math.sin(a*8)*0.04);
                ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
            }
            ctx.closePath();
        }
    };

    ctx.save();
    if (isHalfTop === true) {
        ctx.beginPath(); ctx.rect(-radius*6, -radius*6, radius*12, radius*6); ctx.clip();
    } else if (isHalfTop === false) {
        ctx.beginPath(); ctx.rect(-radius*6, 0, radius*12, radius*6); ctx.clip();
    }

    // Base Skin Layer
    const skinGrad = ctx.createRadialGradient(-radius*0.4, -radius*0.7, radius*0.1, 0, 0, radius*1.6);
    skinGrad.addColorStop(0, config.hex);
    skinGrad.addColorStop(0.65, config.secondaryColor);
    skinGrad.addColorStop(1, adjustColor(config.secondaryColor, -70));
    ctx.fillStyle = skinGrad;
    drawShape();
    ctx.fill();

    // Procedural Skin Textures
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = config.speckleColor;
    
    if (type === 'guava') {
        // High density lenticels
        for (let i = 0; i < 220; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * radius * 0.99;
            ctx.beginPath(); 
            ctx.arc(Math.cos(a)*d, Math.sin(a)*d, Math.random() * 2.2 + 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'pineapple') {
        // Detailed 3D-effect scales
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2.2;
        const spacing = 22;
        for(let i=-8; i<=8; i++) {
             ctx.beginPath(); ctx.moveTo(i*spacing, -radius*1.7); ctx.lineTo(i*spacing + radius, radius*1.7); ctx.stroke();
             ctx.beginPath(); ctx.moveTo(i*spacing, -radius*1.7); ctx.lineTo(i*spacing - radius, radius*1.7); ctx.stroke();
             // Scale centers/eyes
             const centerColor = i%2 === 0 ? adjustColor(config.secondaryColor, -40) : adjustColor(config.hex, -10);
             ctx.fillStyle = centerColor;
             for(let j=-5; j<=5; j++) {
                ctx.beginPath();
                ctx.arc(i*spacing, j*spacing, 2.5, 0, Math.PI*2);
                ctx.fill();
             }
        }
    } else {
        // Mango pores and organic sunspots
        for (let i = 0; i < 110; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * radius;
            ctx.beginPath(); 
            ctx.ellipse(Math.cos(a)*d, Math.sin(a)*d, Math.random()*6, Math.random()*3, a, 0, Math.PI*2);
            ctx.fill();
        }
    }
    ctx.restore();

    // Polished Highlights
    const highlight = ctx.createRadialGradient(-radius*0.65, -radius*0.7, 0, -radius*0.65, -radius*0.7, radius*1.2);
    highlight.addColorStop(0, 'rgba(255,255,255,0.55)');
    highlight.addColorStop(0.3, 'rgba(255,255,255,0.25)');
    highlight.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = highlight;
    ctx.beginPath(); ctx.ellipse(-radius*0.65, -radius*0.7, radius*0.6, radius*0.4, Math.PI/4, 0, Math.PI*2); ctx.fill();

    // Sharp "Juicy" Specs
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(-radius*0.48, -radius*0.48, radius*0.18, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-radius*0.6, -radius*0.3, radius*0.08, 0, Math.PI*2); ctx.fill();

    // Crown/Stem Details
    if (type === 'pineapple' && isHalfTop !== false) {
        ctx.save();
        ctx.fillStyle = '#1B5E20';
        const drawLeaf = (angle: number, lengthMult: number, width: number, colorShift: number) => {
            ctx.save();
            ctx.rotate(angle);
            ctx.fillStyle = adjustColor('#2E7D32', colorShift);
            ctx.beginPath();
            ctx.moveTo(0, -radius * 1.05);
            ctx.bezierCurveTo(width, -radius-radius*lengthMult*0.65, width*0.7, -radius-radius*lengthMult, 0, -radius-radius*lengthMult);
            ctx.bezierCurveTo(-width*0.7, -radius-radius*lengthMult, -width, -radius-radius*lengthMult*0.65, 0, -radius*1.05);
            ctx.fill();
            // Leaf vein
            ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,-radius*1.05); ctx.lineTo(0, -radius-radius*lengthMult*0.9); ctx.stroke();
            ctx.restore();
        };
        for(let i=-3; i<=3; i++) drawLeaf(i*0.32, 0.6 + Math.random()*0.3, 12, -30);
        for(let i=-2; i<=2; i++) drawLeaf(i*0.25, 0.9 + Math.random()*0.25, 18, 0);
        drawLeaf(0, 1.5, 24, 30);
        ctx.restore();
    } else if (isHalfTop !== false) {
        ctx.fillStyle = '#3E2723';
        ctx.beginPath();
        ctx.moveTo(-4, -radius); ctx.lineTo(4, -radius); ctx.lineTo(2.5, -radius*1.3); ctx.lineTo(-2.5, -radius*1.3);
        ctx.closePath(); ctx.fill();
        // High contrast highlight on stem
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.rect(-1, -radius*1.2, 2, radius*0.2); ctx.fill();
    }

    ctx.restore();

    // Interior Flesh (Sliced Faces)
    if (isHalfTop !== undefined) {
        ctx.save();
        ctx.scale(1, 0.35);
        ctx.beginPath();
        if (type === 'mango' || type === 'sweet_mango') {
            ctx.ellipse(0, 0, radius*1.15, radius*1.3, 0, 0, Math.PI*2);
        } else {
            ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
        }
        
        const fGrad = ctx.createRadialGradient(0,0, 0, 0,0, radius);
        fGrad.addColorStop(0, adjustColor(config.fleshColor, 80));
        fGrad.addColorStop(0.75, config.fleshColor);
        fGrad.addColorStop(1, adjustColor(config.hex, -25));
        ctx.fillStyle = fGrad;
        ctx.fill();
        
        if (type === 'guava') {
            // Detailed pink flesh with distinct core area and seeds
            ctx.fillStyle = '#880E4F'; ctx.globalAlpha = 0.65;
            for(let i=0; i<75; i++) {
                ctx.beginPath(); 
                const dist = radius * (0.3 + Math.random()*0.6);
                const angle = Math.random()*Math.PI*2;
                ctx.arc(Math.cos(angle)*dist, Math.sin(angle)*dist, 4, 0, Math.PI*2);
                ctx.fill();
            }
            // Central core area
            ctx.fillStyle = '#FFFFFF'; ctx.globalAlpha = 0.2;
            ctx.beginPath(); ctx.arc(0,0, radius*0.35, 0, Math.PI*2); ctx.fill();
        } else if (type === 'pineapple') {
            // Fibrous core with radial texture lines
            ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2.8;
            for(let i=0; i<18; i++) {
                const a = (i/18)*Math.PI*2;
                ctx.beginPath(); ctx.moveTo(0,0);
                ctx.lineTo(Math.cos(a)*radius*0.99, Math.sin(a)*radius*0.99);
                ctx.stroke();
            }
            // Dense fibrous center
            const centerGrad = ctx.createRadialGradient(0,0,0, 0,0, radius*0.4);
            centerGrad.addColorStop(0, '#FFFFFF'); centerGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = centerGrad; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.arc(0,0, radius*0.4, 0, Math.PI*2); ctx.fill();
        } else {
            // Mango pit area with subtle texture
            const coreGrad = ctx.createRadialGradient(0,0,0, 0,0, radius*0.75);
            coreGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
            coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = coreGrad;
            ctx.beginPath(); ctx.ellipse(0, 0, radius*0.65, radius*0.35, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
        
        // Polished Rim for "Slick" cut look
        ctx.beginPath(); 
        if (type === 'mango' || type === 'sweet_mango') ctx.ellipse(0, 0, radius*1.15, 6, 0, 0, Math.PI*2);
        else ctx.arc(0, 0, radius * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.stroke();
    }
  };

  useEffect(() => {
    isDestroyed.current = false;
    let isMounted = true; 

    if (!videoRef.current || !canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); 
    if (!ctx) return;

    let hands: any = null;

    const onResults = (results: any) => {
      if (!isMounted) return;
      
      setLoading(false);
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
      }

      ctx.save();
      if (shakeIntensity.current > 0) {
        ctx.translate((Math.random()-0.5)*shakeIntensity.current, (Math.random()-0.5)*shakeIntensity.current);
        shakeIntensity.current *= 0.85; 
      }

      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (flashOpacity.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity.current})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashOpacity.current -= 0.12;
      }

      let handFound = false;
      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        handFound = true;
        const landmarks = results.multiHandLandmarks[0];
        const hp = { x: (1 - landmarks[8].x) * canvas.width, y: landmarks[8].y * canvas.height };
        
        if (gameState === 'PLAYING') {
          bladeTrail.current.push(hp);
          if (bladeTrail.current.length > BLADE_TRAIL_LIMIT) bladeTrail.current.shift();
        }
      } else {
        bladeTrail.current = [];
      }
      setHandDetected(handFound);

      if (gameState !== 'PLAYING') {
          ctx.restore();
          return;
      }

      if (timeScale.current < 1.0) timeScale.current += 0.12;
      const ts = timeScale.current; 
      const now = performance.now();
      
      const spawnRate = Math.max(380, INITIAL_SPAWN_INTERVAL - (level * 200));
      if (now - lastSpawnTime.current > spawnRate) {
        spawnFruit(canvas.width, canvas.height);
        lastSpawnTime.current = now;
        if (Math.random() > 0.88) captureRequestRef.current = true;
      }

      if (bladeTrail.current.length >= 2) {
        const p1 = bladeTrail.current[bladeTrail.current.length - 2];
        const p2 = bladeTrail.current[bladeTrail.current.length - 1];
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        
        if (dx*dx + dy*dy > 1400 && now - lastSwooshTime.current > 180) {
            soundManager.playSwoosh(); lastSwooshTime.current = now;
        }

        fruits.current.forEach(f => {
          if (!f.isSliced) {
            const lineLenSq = dx*dx + dy*dy;
            if (lineLenSq < 10) return;
            const dist = Math.abs(dy * f.x - dx * f.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(lineLenSq);
            if (dist < f.radius * 1.15 && 
                f.x > Math.min(p1.x, p2.x) - f.radius && f.x < Math.max(p1.x, p2.x) + f.radius &&
                f.y > Math.min(p1.y, p2.y) - f.radius && f.y < Math.max(p1.y, p2.y) + f.radius) {
              f.isSliced = true;
              
              const pts = FRUIT_CONFIG[f.type].points;
              
              if (f.type === 'bomb') {
                  soundManager.playBombExplosion();
                  livesRef.current -= 1;
                  setLives(livesRef.current);
                  shakeIntensity.current = 60;
                  flashOpacity.current = 0.8;
                  if (livesRef.current <= 0) {
                      gameActive.current = false;
                      setGameState('GAMEOVER');
                      soundManager.playGameOver();
                  }
              } else {
                  soundManager.playSlice();
                  timeScale.current = 0.08;
                  shakeIntensity.current = 35;
                  flashOpacity.current = 0.55;
              }

              f.sliceAngle = Math.atan2(dy, dx);
              scoreRef.current = Math.max(0, scoreRef.current + pts);
              setScore(scoreRef.current);

              xpPoints.current.push({
                x: f.x,
                y: f.y,
                value: pts,
                color: FRUIT_CONFIG[f.type].hex,
                life: 1.0,
                vx: (Math.random() - 0.5) * 4,
                vy: -6
              });
              
              const nl = Math.floor(scoreRef.current / 1500) + 1;
              if (nl > level) {
                setLevel(nl); soundManager.playLevelUp(); setShowLevelUp(true);
                setTimeout(() => setShowLevelUp(false), 2000);
              }
              createExplosion(f.x, f.y, FRUIT_CONFIG[f.type].fleshColor, dx, dy, f.type === 'bomb');
            }
          }
        });
      }

      // Draw XP Points (Polished popups)
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = xpPoints.current.length - 1; i >= 0; i--) {
          const xp = xpPoints.current[i];
          xp.x += xp.vx * ts;
          xp.y += xp.vy * ts;
          xp.life -= 0.025 * ts;
          if (xp.life <= 0) {
              xpPoints.current.splice(i, 1);
          } else {
              ctx.globalAlpha = xp.life;
              ctx.font = `900 ${46 * (0.8 + xp.life * 0.2)}px Roboto`;
              ctx.fillStyle = xp.value < 0 ? '#FF1744' : '#FFFFFF';
              ctx.shadowColor = xp.color;
              ctx.shadowBlur = 25;
              ctx.fillText(`${xp.value < 0 ? '' : '+'}${xp.value}`, xp.x, xp.y);
          }
      }
      ctx.restore();

      for (let i = fruits.current.length - 1; i >= 0; i--) {
        const f = fruits.current[i];
        f.x += f.vx * ts; f.y += f.vy * ts; f.vy += GRAVITY * ts; f.rotation += f.rotationSpeed * ts;
        if (f.y > canvas.height + 150) fruits.current.splice(i, 1);
        else drawFruit(ctx, f);
      }

      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx * ts; p.y += p.vy * ts; p.vy += (GRAVITY * 0.45) * ts; p.life -= 0.05 * ts; 
        if (p.life <= 0) particles.current.splice(i, 1);
        else {
          ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 6 * p.life, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (bladeTrail.current.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(bladeTrail.current[0].x, bladeTrail.current[0].y);
        for (let i = 1; i < bladeTrail.current.length; i++) ctx.lineTo(bladeTrail.current[i].x, bladeTrail.current[i].y);
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowBlur = 35; ctx.shadowColor = '#00B8D4'; ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();

      if (captureRequestRef.current && !isAiThinking) {
        captureRequestRef.current = false;
        const off = document.createElement('canvas'); off.width = 480; off.height = 270;
        const oCtx = off.getContext('2d');
        if (oCtx) { oCtx.drawImage(canvas, 0, 0, 480, 270); performAiAnalysis(off.toDataURL('image/jpeg', 0.6)); }
      }
    };

    if (window.Hands) {
      hands = new window.Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      
      const startCamera = async () => {
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" } });
              if (videoRef.current) {
                  videoRef.current.srcObject = stream;
                  await videoRef.current.play();
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
  }, [gameState, level]);

  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    const interval = setInterval(() => {
        setTimeLeft(p => {
            if (p <= 1) { gameActive.current = false; setGameState('GAMEOVER'); soundManager.playGameOver(); return 0; }
            return p - 1;
        });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  const pColor = priorityFruit ? FRUIT_CONFIG[priorityFruit].hex : '#03A9F4';
  const playerRank = getRank(score);

  return (
    <div className="relative w-full h-screen bg-[#050505] overflow-hidden font-roboto text-[#e3e3e3] select-none">
      
      <div className="absolute top-24 right-6 z-[200] flex flex-col gap-2">
        <button onClick={toggleMute} className="bg-black/40 backdrop-blur-md p-3 rounded-full border border-white/10 hover:bg-white/10 transition-colors shadow-xl">
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-white" />}
        </button>
      </div>

      {gameState === 'PLAYING' && (
        <div className="absolute top-0 left-0 right-0 z-[150] p-4 flex flex-col md:flex-row items-center justify-between gap-4 pointer-events-none animate-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-2xl px-5 py-2 rounded-full border border-white/10 shadow-2xl">
                <GameLogo size="sm" />
            </div>

            <div className="flex-1 max-w-2xl">
                 <div className="relative bg-black/80 backdrop-blur-2xl px-8 py-3 rounded-3xl border-x-4 flex items-center justify-center text-center shadow-2xl transition-colors duration-500" style={{ borderColor: pColor }}>
                    <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2 mb-0.5">
                            <BrainCircuit className="w-4 h-4" style={{ color: pColor }} />
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">Petuah Sensei</span>
                            {isAiThinking && <Loader2 className="w-3 h-3 animate-spin text-white" />}
                        </div>
                        <p className="text-lg font-black italic text-white leading-tight drop-shadow-lg uppercase tracking-tight">
                            "{senseiHint}"
                        </p>
                    </div>
                 </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="bg-black/60 backdrop-blur-2xl px-4 py-2 rounded-2xl border border-white/10 flex gap-1 shadow-xl">
                    {[...Array(MAX_LIVES)].map((_, i) => (
                        <Heart key={i} className={`w-5 h-5 ${i < lives ? 'text-red-500 fill-red-500' : 'text-gray-600'}`} />
                    ))}
                </div>
                <div className="bg-black/60 backdrop-blur-2xl px-6 py-2 rounded-2xl border border-white/10 flex flex-col items-end shadow-xl">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">LVL</span>
                    <span className="text-2xl font-black text-white leading-none">{level}</span>
                </div>
                <div className="bg-blue-950/40 backdrop-blur-2xl px-6 py-2 rounded-2xl border border-blue-500/30 flex flex-col items-end min-w-[120px] shadow-xl">
                    <span className="text-[10px] font-bold text-blue-300 uppercase">SKOR</span>
                    <span className="text-2xl font-black text-white leading-none">{score.toLocaleString()}</span>
                </div>
                <div className={`backdrop-blur-2xl px-5 py-2 rounded-full border flex items-center gap-2 shadow-xl ${timeLeft < 10 ? 'bg-red-950/50 border-red-500 animate-pulse' : 'bg-black/60 border-white/10'}`}>
                    <Timer className={`w-5 h-5 ${timeLeft < 10 ? 'text-red-400' : 'text-white'}`} />
                    <span className="text-xl font-bold font-mono">{timeLeft}s</span>
                </div>
            </div>
        </div>
      )}

      {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none">
              <div className="text-[18rem] font-black italic text-white drop-shadow-[0_0_80px_rgba(255,255,255,0.5)] animate-in zoom-in duration-300">
                  {countdown === 0 ? "MULAI!" : countdown}
              </div>
          </div>
      )}

      {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-lg animate-in fade-in duration-700">
              <div className="bg-[#111] border border-white/10 p-12 rounded-[50px] text-center max-w-md w-full shadow-2xl transform rotate-1 scale-105">
                  <h2 className="text-5xl font-black mb-2 tracking-tighter text-red-500 italic uppercase">
                    {lives <= 0 ? 'HABIS NYAWA!' : 'WAKTU HABIS!'}
                  </h2>
                  
                  <div className="mb-4 flex flex-col items-center">
                      <div className={`flex items-center gap-2 font-black text-xl mb-4 ${playerRank.color}`}>
                          <Award className="w-6 h-6" /> {playerRank.title}
                      </div>
                      <p className="text-8xl font-black text-white mb-1 tracking-tighter drop-shadow-lg">{score.toLocaleString()}</p>
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">Skor Akhir</p>
                  </div>

                  <button onClick={startCountdown} className="w-full bg-white text-black font-black py-6 rounded-3xl flex items-center justify-center gap-4 hover:bg-yellow-400 transition-all active:scale-95 shadow-2xl group text-2xl uppercase">
                    <RotateCcw className="w-8 h-8 group-hover:rotate-180 transition-transform duration-700" /> COBA LAGI
                  </button>
              </div>
          </div>
      )}

      {showLevelUp && (
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 pointer-events-none z-[110] animate-bounce">
              <div className="bg-yellow-400 text-black px-12 py-6 rounded-3xl rotate-2 shadow-2xl border-4 border-black">
                  <p className="text-7xl font-black italic tracking-tighter uppercase">LEVEL UP!</p>
              </div>
          </div>
      )}

      <div ref={containerRef} className="absolute inset-0 z-0 h-full overflow-hidden bg-black cursor-none">
        <video ref={videoRef} className="absolute hidden" playsInline />
        <canvas ref={canvasRef} className="absolute inset-0" />

        {gameState === 'START' && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl">
                 <div className="mb-8 animate-in zoom-in slide-in-from-bottom duration-1000">
                     <GameLogo size="lg" />
                 </div>

                 <div className="flex flex-col items-center gap-6 mb-12">
                    <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-8 py-5 rounded-3xl backdrop-blur-md">
                        <div className="flex flex-col items-center text-center max-w-[200px]">
                            <Hand className="w-8 h-8 text-blue-400 mb-2 animate-pulse" />
                            <p className="text-xs font-bold uppercase text-gray-400">Instruksi</p>
                            <p className="text-sm font-medium">Gunakan jari telunjuk Anda untuk memotong buah!</p>
                        </div>
                        <div className="w-[1px] h-12 bg-white/10" />
                        <div className="flex flex-col items-center text-center min-w-[150px]">
                            {handDetected ? (
                                <CheckCircle2 className="w-8 h-8 text-green-400 mb-2" />
                            ) : (
                                <Info className="w-8 h-8 text-red-400 mb-2 animate-pulse" />
                            )}
                            <p className="text-xs font-bold uppercase text-gray-400">Status Kamera</p>
                            <p className={`text-sm font-black uppercase ${handDetected ? 'text-green-400' : 'text-red-400 animate-pulse'}`}>
                                {handDetected ? 'Siap Bermain' : 'Cari Tangan...'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-red-950/20 border border-red-500/30 px-6 py-3 rounded-2xl">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-sm font-bold text-red-200 uppercase tracking-tighter">HATI-HATI: Jangan sentuh Botol Hitam (Pedas Sekali!)</p>
                    </div>
                 </div>

                 <button 
                    onClick={startCountdown} 
                    disabled={!!cameraError} 
                    className="bg-white text-black font-black text-4xl px-20 py-8 rounded-[40px] flex items-center gap-8 hover:scale-110 active:scale-95 transition-all shadow-2xl uppercase group relative overflow-hidden"
                 >
                     <div className="absolute inset-0 bg-yellow-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                     <Play className="w-12 h-12 fill-current relative z-10" /> 
                     <span className="relative z-10">MULAI!</span>
                 </button>

                 <p className="mt-12 text-[10px] font-bold text-white/30 tracking-[0.3em] uppercase animate-pulse flex items-center gap-2">
                     <Zap className="w-3 h-3 text-yellow-400" /> POWERED BY GOOGLE GEMINI 3 FLASH
                 </p>
            </div>
        )}

        {loading && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#050505] z-[200]">
            <div className="flex flex-col items-center">
              <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-4" />
              <p className="text-xl font-black tracking-[0.2em] text-white animate-pulse uppercase">Menyiapkan Pisau Golok...</p>
            </div>
          </div>
        )}

        {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-[250] p-10 text-center">
                <div className="bg-red-900/20 border-2 border-red-500 p-12 rounded-[40px] backdrop-blur-xl max-w-lg">
                    <Info className="w-20 h-20 text-red-500 mx-auto mb-6" />
                    <h2 className="text-3xl font-black mb-4 uppercase">Kamera Bermasalah</h2>
                    <p className="text-gray-400 mb-8 font-medium">{cameraError}</p>
                    <button onClick={() => window.location.reload()} className="bg-red-500 text-white font-black px-10 py-4 rounded-2xl hover:bg-red-600 transition-colors uppercase">
                        Muat Ulang
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default GeminiFruitSlicer;
