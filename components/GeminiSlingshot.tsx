/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getStrategicHint, TargetCandidate } from '../services/geminiService';
import { Point, Bubble, Particle, BubbleColor, DebugInfo } from '../types';
import { Loader2, Trophy, BrainCircuit, Play, MousePointerClick, Eye, Terminal, Target, Lightbulb, Monitor } from 'lucide-react';

const PINCH_THRESHOLD = 0.05;
const GRAVITY = 0.0; 
const FRICTION = 0.998; 

const BUBBLE_RADIUS = 22;
const ROW_HEIGHT = BUBBLE_RADIUS * Math.sqrt(3);
const GRID_COLS = 12;
const GRID_ROWS = 8;
const SLINGSHOT_BOTTOM_OFFSET = 220;

const MAX_DRAG_DIST = 180;
const MIN_FORCE_MULT = 0.15;
const MAX_FORCE_MULT = 0.45;

const COLOR_CONFIG: Record<BubbleColor, { hex: string, points: number, label: string }> = {
  red:    { hex: '#ef5350', points: 100, label: 'Red' },
  blue:   { hex: '#42a5f5', points: 150, label: 'Blue' },
  green:  { hex: '#66bb6a', points: 200, label: 'Green' },
  yellow: { hex: '#ffee58', points: 250, label: 'Yellow' },
  purple: { hex: '#ab47bc', points: 300, label: 'Purple' },
  orange: { hex: '#ffa726', points: 500, label: 'Orange' }
};

const COLOR_KEYS: BubbleColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

const adjustColor = (color: string, amount: number) => {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));
    const cTH = (c: number) => c.toString(16).padStart(2, '0');
    return "#" + cTH(r) + cTH(g) + cTH(b);
};

const GeminiSlingshot: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  
  const ballPos = useRef<Point>({ x: 0, y: 0 });
  const ballVel = useRef<Point>({ x: 0, y: 0 });
  const anchorPos = useRef<Point>({ x: 0, y: 0 });
  const isPinching = useRef<boolean>(false);
  const isFlying = useRef<boolean>(false);
  const flightStartTime = useRef<number>(0);
  const bubbles = useRef<Bubble[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef<number>(0);
  const isDestroyed = useRef<boolean>(false);
  
  const aimTargetRef = useRef<Point | null>(null);
  const isAiThinkingRef = useRef<boolean>(false);
  const captureRequestRef = useRef<boolean>(false);
  const selectedColorRef = useRef<BubbleColor>('red');
  
  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aiHint, setAiHint] = useState<string | null>("Initializing strategy engine...");
  const [aiRationale, setAiRationale] = useState<string | null>(null);
  const [aimTarget, setAimTarget] = useState<Point | null>(null);
  const [score, setScore] = useState(0);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [selectedColor, setSelectedColor] = useState<BubbleColor>('red');
  const [availableColors, setAvailableColors] = useState<BubbleColor[]>([]);
  const [aiRecommendedColor, setAiRecommendedColor] = useState<BubbleColor | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    selectedColorRef.current = selectedColor;
  }, [selectedColor]);

  useEffect(() => {
    aimTargetRef.current = aimTarget;
  }, [aimTarget]);

  useEffect(() => {
    isAiThinkingRef.current = isAiThinking;
  }, [isAiThinking]);
  
  const getBubblePos = (row: number, col: number, width: number) => {
    const xO = (width - (GRID_COLS * BUBBLE_RADIUS * 2)) / 2 + BUBBLE_RADIUS;
    return { x: xO + col * (BUBBLE_RADIUS * 2) + (row % 2 !== 0 ? BUBBLE_RADIUS : 0), y: BUBBLE_RADIUS + row * ROW_HEIGHT };
  };

  const updateAvailableColors = () => {
    const activeColors = new Set<BubbleColor>();
    bubbles.current.forEach(b => { if (b.active) activeColors.add(b.color); });
    setAvailableColors(Array.from(activeColors));
    if (!activeColors.has(selectedColorRef.current) && activeColors.size > 0) setSelectedColor(Array.from(activeColors)[0]);
  };

  const initGrid = useCallback((width: number) => {
    const nB: Bubble[] = [];
    for (let r = 0; r < 5; r++) { 
      for (let c = 0; c < (r % 2 !== 0 ? GRID_COLS - 1 : GRID_COLS); c++) {
        if (Math.random() > 0.1) {
            const { x, y } = getBubblePos(r, c, width);
            nB.push({ id: `${r}-${c}`, row: r, col: c, x, y, color: COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)], active: true });
        }
      }
    }
    bubbles.current = nB; updateAvailableColors();
    setTimeout(() => { captureRequestRef.current = true; }, 2000);
  }, []);

  const createExplosion = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) particles.current.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 1.0, color });
  };

  const isPathClear = (target: Bubble) => {
    if (!anchorPos.current) return false;
    const dx = target.x - anchorPos.current.x; const dy = target.y - anchorPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(distance / (BUBBLE_RADIUS / 2)); 
    for (let i = 1; i < steps - 2; i++) { 
        const t = i / steps; const cx = anchorPos.current.x + dx * t; const cy = anchorPos.current.y + dy * t;
        for (const b of bubbles.current) { if (!b.active || b.id === target.id) continue; if (Math.pow(cx - b.x, 2) + Math.pow(cy - b.y, 2) < Math.pow(BUBBLE_RADIUS * 1.8, 2)) return false; }
    }
    return true;
  };

  const getAllReachableClusters = (): TargetCandidate[] => {
    const activeBubbles = bubbles.current.filter(b => b.active);
    const uC = Array.from(new Set(activeBubbles.map(b => b.color))) as BubbleColor[];
    const allClusters: TargetCandidate[] = [];
    for (const color of uC) {
        const visited = new Set<string>();
        for (const b of activeBubbles) {
            if (b.color !== color || visited.has(b.id)) continue;
            const cluster: Bubble[] = []; const queue = [b]; visited.add(b.id);
            while (queue.length > 0) {
                const curr = queue.shift()!; cluster.push(curr);
                activeBubbles.filter(n => !visited.has(n.id) && n.color === color && Math.abs(n.row - curr.row) <= 1).forEach(n => { visited.add(n.id); queue.push(n); });
            }
            cluster.sort((a,b) => b.y - a.y);
            const hittable = cluster.find(m => isPathClear(m));
            if (hittable) {
                const xP = hittable.x / (gameContainerRef.current?.clientWidth || 1000);
                allClusters.push({ id: hittable.id, color, size: cluster.length, row: hittable.row, col: hittable.col, pointsPerBubble: COLOR_CONFIG[color].points, description: xP < 0.33 ? "Left" : xP > 0.66 ? "Right" : "Center" });
            }
        }
    }
    return allClusters;
  };

  const checkMatches = (startBubble: Bubble) => {
    const toCheck = [startBubble]; const visited = new Set<string>(); const matches: Bubble[] = [];
    while (toCheck.length > 0) {
      const current = toCheck.pop()!; if (visited.has(current.id)) continue; visited.add(current.id);
      if (current.color === startBubble.color) {
        matches.push(current);
        bubbles.current.filter(b => b.active && !visited.has(b.id) && Math.abs(b.row - current.row) <= 1).forEach(n => toCheck.push(n));
      }
    }
    if (matches.length >= 3) {
      matches.forEach(b => { b.active = false; createExplosion(b.x, b.y, COLOR_CONFIG[b.color].hex); });
      scoreRef.current += Math.floor(matches.length * COLOR_CONFIG[startBubble.color].points * (matches.length > 3 ? 1.5 : 1.0));
      setScore(scoreRef.current); return true;
    }
    return false;
  };

  const performAiAnalysis = async (screenshot: string) => {
    isAiThinkingRef.current = true; setIsAiThinking(true);
    const clusters = getAllReachableClusters();
    const maxRow = bubbles.current.reduce((max, b) => b.active ? Math.max(max, b.row) : max, 0);
    const aiResponse = await getStrategicHint(screenshot, clusters, maxRow);
    setAiHint(aiResponse.hint.message); setAiRationale(aiResponse.hint.rationale || null);
    if (typeof aiResponse.hint.targetRow === 'number' && typeof aiResponse.hint.targetCol === 'number') {
        if (aiResponse.hint.recommendedColor) { setAiRecommendedColor(aiResponse.hint.recommendedColor); setSelectedColor(aiResponse.hint.recommendedColor); }
        setAimTarget(getBubblePos(aiResponse.hint.targetRow, aiResponse.hint.targetCol, canvasRef.current?.width || 1000));
    }
    isAiThinkingRef.current = false; setIsAiThinking(false);
  };

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colorKey: BubbleColor) => {
    const bC = COLOR_CONFIG[colorKey].hex;
    const grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
    grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.2, bC); grad.addColorStop(1, adjustColor(bC, -60));
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); ctx.ellipse(x - radius * 0.3, y - radius * 0.35, radius * 0.25, radius * 0.15, Math.PI / 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.fill();
  };

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current || !gameContainerRef.current) return;
    const video = videoRef.current; const canvas = canvasRef.current; const container = gameContainerRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return;
    canvas.width = container.clientWidth; canvas.height = container.clientHeight;
    anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET };
    ballPos.current = { ...anchorPos.current };
    initGrid(canvas.width);
    let camera: any = null; let hands: any = null;
    const onResults = (results: any) => {
      if (isDestroyed.current) return; setLoading(false);
      if (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight) { canvas.width = container.clientWidth; canvas.height = container.clientHeight; anchorPos.current = { x: canvas.width / 2, y: canvas.height - SLINGSHOT_BOTTOM_OFFSET }; }
      if (canvas.width <= 0 || canvas.height <= 0) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(18, 18, 18, 0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      let handPos: Point | null = null; let pinchDist = 1.0;
      if (results.multiHandLandmarks?.length > 0) {
        const l = results.multiHandLandmarks[0];
        handPos = { x: (l[8].x + l[4].x) * canvas.width / 2, y: (l[8].y + l[4].y) * canvas.height / 2 };
        pinchDist = Math.sqrt((l[8].x - l[4].x)**2 + (l[8].y - l[4].y)**2);
        if (window.drawConnectors) window.drawConnectors(ctx, l, window.HAND_CONNECTIONS, {color: '#669df6', lineWidth: 1});
      }
      const isLocked = isAiThinkingRef.current;
      if (!isLocked && handPos && pinchDist < PINCH_THRESHOLD && !isFlying.current) { if (!isPinching.current && Math.sqrt((handPos.x - ballPos.current.x)**2 + (handPos.y - ballPos.current.y)**2) < 100) isPinching.current = true; if (isPinching.current) { ballPos.current = { ...handPos }; const d = Math.sqrt((ballPos.current.x-anchorPos.current.x)**2 + (ballPos.current.y-anchorPos.current.y)**2); if (d > MAX_DRAG_DIST) { const a = Math.atan2(ballPos.current.y-anchorPos.current.y, ballPos.current.x-anchorPos.current.x); ballPos.current = { x: anchorPos.current.x + Math.cos(a)*MAX_DRAG_DIST, y: anchorPos.current.y + Math.sin(a)*MAX_DRAG_DIST }; } } }
      else if (isPinching.current && (!handPos || pinchDist >= PINCH_THRESHOLD || isLocked)) {
        isPinching.current = false;
        if (!isLocked) {
            const dx = anchorPos.current.x - ballPos.current.x; const dy = anchorPos.current.y - ballPos.current.y;
            if (Math.sqrt(dx*dx+dy*dy) > 30) { isFlying.current = true; flightStartTime.current = performance.now(); const m = MIN_FORCE_MULT + (MAX_FORCE_MULT - MIN_FORCE_MULT) * Math.min(Math.sqrt(dx*dx+dy*dy)/MAX_DRAG_DIST, 1)**2; ballVel.current = { x: dx*m, y: dy*m }; }
            else ballPos.current = { ...anchorPos.current };
        } else ballPos.current = { ...anchorPos.current };
      } else if (!isFlying.current && !isPinching.current) { ballPos.current.x += (anchorPos.current.x - ballPos.current.x) * 0.15; ballPos.current.y += (anchorPos.current.y - ballPos.current.y) * 0.15; }
      if (isFlying.current) {
        if (performance.now() - flightStartTime.current > 5000) { isFlying.current = false; ballPos.current = { ...anchorPos.current }; }
        else {
            const steps = Math.ceil(Math.sqrt(ballVel.current.x**2+ballVel.current.y**2)/15); let hit = false;
            for (let i = 0; i < steps; i++) {
                ballPos.current.x += ballVel.current.x/steps; ballPos.current.y += ballVel.current.y/steps;
                if (ballPos.current.x < BUBBLE_RADIUS || ballPos.current.x > canvas.width - BUBBLE_RADIUS) { ballVel.current.x *= -1; }
                if (ballPos.current.y < BUBBLE_RADIUS || bubbles.current.some(b => b.active && Math.sqrt((ballPos.current.x-b.x)**2 + (ballPos.current.y-b.y)**2) < BUBBLE_RADIUS*1.8)) { hit = true; break; }
            }
            if (hit) {
                isFlying.current = false; let bD = Infinity; let bR = 0, bC = 0, bX = 0, bY = 0;
                for (let r = 0; r < GRID_ROWS + 5; r++) { for (let c = 0; c < (r%2!==0?GRID_COLS-1:GRID_COLS); c++) { const p = getBubblePos(r,c,canvas.width); if (!bubbles.current.some(b => b.active && b.row === r && b.col === c)) { const d = Math.sqrt((ballPos.current.x-p.x)**2+(ballPos.current.y-p.y)**2); if (d < bD) { bD = d; bR = r; bC = c; bX = p.x; bY = p.y; } } } }
                const nB = { id: Date.now().toString(), row: bR, col: bC, x: bX, y: bY, color: selectedColorRef.current, active: true }; bubbles.current.push(nB); checkMatches(nB); updateAvailableColors(); ballPos.current = { ...anchorPos.current }; captureRequestRef.current = true;
            }
            if (ballPos.current.y > canvas.height) { isFlying.current = false; ballPos.current = { ...anchorPos.current }; }
        }
      }
      bubbles.current.forEach(b => { if (b.active) drawBubble(ctx, b.x, b.y, BUBBLE_RADIUS - 1, b.color); });
      if (aimTargetRef.current && !isFlying.current && (!aiRecommendedColor || aiRecommendedColor === selectedColorRef.current)) {
          ctx.save(); ctx.shadowBlur = 15; ctx.shadowColor = COLOR_CONFIG[selectedColorRef.current].hex; ctx.beginPath(); ctx.moveTo(anchorPos.current.x, anchorPos.current.y); ctx.lineTo(aimTargetRef.current.x, aimTargetRef.current.y); ctx.setLineDash([20, 15]); ctx.lineDashOffset = -performance.now()/15; ctx.strokeStyle = COLOR_CONFIG[selectedColorRef.current].hex; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
      }
      if (!isFlying.current) { ctx.beginPath(); ctx.moveTo(anchorPos.current.x - 35, anchorPos.current.y - 10); ctx.lineTo(ballPos.current.x, ballPos.current.y); ctx.lineTo(anchorPos.current.x + 35, anchorPos.current.y - 10); ctx.lineWidth = 5; ctx.strokeStyle = isPinching.current ? '#fdd835' : 'rgba(255,255,255,0.4)'; ctx.stroke(); }
      drawBubble(ctx, ballPos.current.x, ballPos.current.y, BUBBLE_RADIUS, selectedColorRef.current);
      ctx.beginPath(); ctx.moveTo(anchorPos.current.x, canvas.height); ctx.lineTo(anchorPos.current.x, anchorPos.current.y + 40); ctx.lineTo(anchorPos.current.x - 40, anchorPos.current.y); ctx.moveTo(anchorPos.current.x, anchorPos.current.y + 40); ctx.lineTo(anchorPos.current.x + 40, anchorPos.current.y); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.strokeStyle = '#616161'; ctx.stroke();
      particles.current.forEach((p, i) => { p.x += p.vx; p.y += p.vy; p.life -= 0.05; if (p.life <= 0) particles.current.splice(i, 1); else { ctx.globalAlpha = p.life; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill(); ctx.globalAlpha = 1.0; } });
      if (captureRequestRef.current) {
        captureRequestRef.current = false; const off = document.createElement('canvas'); off.width = 480; off.height = 360; const oC = off.getContext('2d');
        if (oC) { oC.drawImage(canvas, 0, 0, 480, 360); setTimeout(() => performAiAnalysis(off.toDataURL("image/jpeg", 0.6)), 0); }
      }
    };
    const initMP = async () => {
      try {
        // @ts-ignore
        hands = new window.Hands({ locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
        hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
        hands.onResults(onResults);
        // @ts-ignore
        camera = new window.Camera(video, { onFrame: async () => { if (!isDestroyed.current && video.readyState >= 2 && video.videoWidth > 0 && hands) await hands.send({ image: video }); }, width: 1280, height: 720 });
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
    if (window.Hands && window.Camera) initMP();
    return () => { isDestroyed.current = true; if (camera) camera.stop(); if (hands) { hands.close(); hands = null; } };
  }, [initGrid]);

  return (
    <div className="flex w-full h-screen bg-[#121212] overflow-hidden font-roboto text-[#e3e3e3]">
      <div className="fixed inset-0 z-[100] bg-[#121212] flex flex-col items-center justify-center p-8 text-center md:hidden"><Monitor className="w-16 h-16 text-[#ef5350] mb-6 animate-pulse" /><h2 className="text-2xl font-bold text-[#e3e3e3] mb-4">Desktop View Required</h2><p className="text-[#c4c7c5] max-w-md text-lg leading-relaxed">This experience requires a larger screen.</p></div>
      <div ref={gameContainerRef} className="flex-1 relative h-full overflow-hidden">
        {/* Removed display:none via 'hidden' class, using opacity-0 and pointer-events-none instead */}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#121212] z-50">
             <div className="flex flex-col items-center text-center">
                 <Loader2 className="w-12 h-12 text-[#42a5f5] animate-spin mb-4" />
                 <p className="text-[#e3e3e3] text-lg font-medium">Starting Engine...</p>
                 {cameraError && <p className="text-red-500 mt-4 bg-red-500/10 px-4 py-2 rounded border border-red-500/20 max-w-md">{cameraError}</p>}
             </div>
          </div>
        )}
        <div className="absolute top-6 left-6 z-40"><div className="bg-[#1e1e1e] p-5 rounded-[28px] border border-[#444746] shadow-2xl flex items-center gap-4 min-w-[180px]"><div className="bg-[#42a5f5]/20 p-3 rounded-full"><Trophy className="w-6 h-6 text-[#42a5f5]" /></div><div><p className="text-xs text-[#c4c7c5] uppercase tracking-wider font-medium">Score</p><p className="text-3xl font-bold text-white">{score.toLocaleString()}</p></div></div></div>
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40"><div className="bg-[#1e1e1e] px-6 py-4 rounded-[32px] border border-[#444746] shadow-2xl flex items-center gap-4">{availableColors.map(color => (<button key={color} onClick={() => setSelectedColor(color)} className={`relative w-14 h-14 rounded-full transition-all duration-300 transform flex items-center justify-center ${selectedColor === color ? 'scale-110 ring-4 ring-white/50 z-10' : 'opacity-80'}`} style={{ background: `radial-gradient(circle at 35% 35%, ${COLOR_CONFIG[color].hex}, ${adjustColor(COLOR_CONFIG[color].hex, -60)})` }}>{selectedColor === color && <MousePointerClick className="w-6 h-6 text-white/90" />}</button>))}</div></div>
      </div>
      <div className="w-[380px] bg-[#1e1e1e] border-l border-[#444746] flex flex-col h-full overflow-hidden shadow-2xl">
        <div className="p-5 border-b-4 flex flex-col gap-2" style={{ backgroundColor: '#252525', borderColor: aiRecommendedColor ? COLOR_CONFIG[aiRecommendedColor].hex : '#444746' }}><div className="flex items-center justify-between"><div className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-[#a8c7fa]" /><h2 className="font-bold text-sm tracking-widest uppercase text-[#a8c7fa]">Flash Strategy</h2></div>{isAiThinking && <Loader2 className="w-4 h-4 animate-spin text-white/50" />}</div><p className="text-[#e3e3e3] text-sm leading-relaxed font-bold">{aiHint}</p>{aiRationale && (<div className="flex gap-2 mt-1"><Lightbulb className="w-4 h-4 text-[#a8c7fa] shrink-0 mt-0.5" /><p className="text-[#a8c7fa] text-xs italic opacity-90 leading-tight">{aiRationale}</p></div>)}</div>
      </div>
    </div>
  );
};

export default GeminiSlingshot;