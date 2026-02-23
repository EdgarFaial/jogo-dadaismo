/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameState, COLORS, DADA_QUOTES, LEVELS, Level } from './constants';

interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  vx: number;
  vy: number;
  type: string;
  isSolid?: boolean;
  scale?: number;
  phantom?: boolean;
  health?: number;
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(() => {
    const saved = localStorage.getItem('dada_level');
    return saved ? Math.min(parseInt(saved), LEVELS.length - 1) : 0;
  });
  const [maxLevelReached, setMaxLevelReached] = useState(() => {
    const saved = localStorage.getItem('dada_max');
    return saved ? parseInt(saved) : 0;
  });
  const [deaths, setDeaths] = useState(() => {
    const saved = localStorage.getItem('dada_deaths');
    return saved ? parseInt(saved) : 0;
  });

  const [absurdElements, setAbsurdElements] = useState<{ id: number; x: number; y: number; vx: number; vy: number; emoji: string; rotation: number; rv: number }[]>([]);
  const nextAbsurdId = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playSound = (type: 'jump' | 'death' | 'transform' | 'glitch' | 'wind' | 'win') => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'jump') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'death') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'transform') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.linearRampToValueAtTime(880, now + 0.2);
      osc.frequency.linearRampToValueAtTime(440, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'glitch') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(Math.random() * 1000 + 100, now);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.setValueAtTime(0, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'wind') {
      // Noise-like sound
      const bufferSize = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(1000, now + 0.5);
      noise.connect(filter);
      filter.connect(gain);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      noise.start(now);
      noise.stop(now + 0.5);
    } else if (type === 'win') {
      osc.type = 'sine';
      [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
        const t = now + i * 0.1;
        osc.frequency.setValueAtTime(freq, t);
      });
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  };

  const [dadaQuote, setDadaQuote] = useState("Dada não significa nada.");
  const [userInput, setUserInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGoalActive, setIsGoalActive] = useState(true);
  const [shakeIntensity, setShakeIntensity] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [judgeResponse, setJudgeResponse] = useState<{ allow: boolean; reason: string } | null>(null);
  const [isGravityInverted, setIsGravityInverted] = useState(false);
  const [bossHealth, setBossHealth] = useState(3);
  const [lastHitTime, setLastHitTime] = useState(0);
  const [isGlitchActive, setIsGlitchActive] = useState(false);
  const [touchControls, setTouchControls] = useState({ left: false, right: false, jump: false });
  const [canDoubleJump, setCanDoubleJump] = useState(true);
  const [isJumping, setIsJumping] = useState(false);
  const [isFalling, setIsFalling] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(undefined);
  const lastTimeRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const playerRef = useRef<GameObject>({
    x: 50,
    y: 300,
    width: 32,
    height: 48,
    color: COLORS.INK,
    vx: 0,
    vy: 0,
    type: "PLAYER",
    scale: 1
  });

  const objectsRef = useRef<GameObject[]>([]);
  const projectilesRef = useRef<GameObject[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mousePosRef = useRef({ x: 0, y: 0 });

  const currentLevel = LEVELS[currentLevelIdx];

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('dada_level', currentLevelIdx.toString());
    localStorage.setItem('dada_max', Math.max(maxLevelReached, currentLevelIdx).toString());
    localStorage.setItem('dada_deaths', deaths.toString());
    if (currentLevelIdx > maxLevelReached) setMaxLevelReached(currentLevelIdx);
  }, [currentLevelIdx, deaths, maxLevelReached]);

  const resetPlayer = useCallback(() => {
    setDeaths(d => d + 1);
    playSound('death');
    playerRef.current.x = 50;
    playerRef.current.y = isGravityInverted ? 50 : 300;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.scale = 1;
    playerRef.current.width = 32;
    playerRef.current.height = 48;
    setIsJumping(false);
    setCanDoubleJump(true);
    setIsFalling(false);
    projectilesRef.current = [];
    if (currentLevelIdx === 19) {
      setBossHealth(3);
      setLastHitTime(0);
    }
  }, [currentLevelIdx, isGravityInverted]);

  const triggerShake = useCallback((intensity: number, duration = 200) => {
    setShakeIntensity(intensity);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setShakeIntensity(0), duration);
  }, []);

  const initLevel = useCallback((idx: number) => {
    const level = LEVELS[idx];
    const startX = level.config?.playerStart?.x ?? 50;
    const startY = level.config?.playerStart?.y ?? (level.mechanic === "GRAVITY_SWAP" ? 50 : 300);
    
    playerRef.current = {
      ...playerRef.current,
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      scale: 1,
      width: 32,
      height: 48
    };

    setIsGoalActive(level.mechanic !== "SHY_BUTTON");
    setIsHelpOpen(false);
    setJudgeResponse(null);
    setUserInput("");
    setIsGravityInverted(level.config?.gravityInverted ?? level.mechanic === "GRAVITY_SWAP");
    setBossHealth(3);
    setLastHitTime(0);
    setShakeIntensity(0);
    setIsGlitchActive(false);
    setIsJumping(false);
    setCanDoubleJump(true);
    setIsFalling(false);
    projectilesRef.current = [];

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    let objs: GameObject[] = [];
    if (level.config?.objects) {
      objs = level.config.objects.map(o => ({ ...o, vx: 0, vy: 0 }));
    } else {
      objs = [
        { x: 0, y: 380, width: 800, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: "PLATFORM", isSolid: true },
        { x: 720, y: 280, width: 50, height: 100, color: COLORS.RED, vx: 0, vy: 0, type: "GOAL" }
      ];
    }

    // Add traps for most levels if not explicitly configured
    if (!level.config?.objects) {
      if (idx >= 2 && idx !== 3 && idx !== 5 && idx !== 12 && idx !== 13 && idx !== 18) {
        objs.push({ x: 300, y: 365, width: 60, height: 15, color: COLORS.TRAP, vx: 0, vy: 0, type: "TRAP", isSolid: true });
      }
      if (idx >= 6 && idx !== 12 && idx !== 13 && idx !== 15 && idx !== 18) {
        objs.push({ x: 500, y: 365, width: 60, height: 15, color: COLORS.TRAP, vx: 0, vy: 0, type: "TRAP", isSolid: true });
      }
    }

    if (level.mechanic === "SHY_BUTTON") {
      objs.push({ x: 400, y: 250, width: 40, height: 40, color: COLORS.BLUE, vx: 0, vy: 0, type: "BUTTON", isSolid: false });
      setIsGoalActive(false);
    }

    if (level.mechanic === "GLITCH_MAZE") {
      const positions = [{ x: 200, y: 320 }, { x: 350, y: 280 }, { x: 500, y: 240 }, { x: 150, y: 200 }, { x: 300, y: 160 }, { x: 450, y: 120 }];
      positions.forEach(p => {
        const isSolid = Math.random() > 0.5;
        objs.push({ x: p.x, y: p.y, width: 60, height: 15, color: isSolid ? "#4a5568" : "#718096", vx: 0, vy: 0, type: "PLATFORM", isSolid });
      });
      intervalRef.current = setInterval(() => {
        setIsGlitchActive(prev => !prev);
        objectsRef.current.forEach((obj) => {
          if (obj.type === "PLATFORM" && obj.color !== COLORS.INK && obj.color !== COLORS.GOLD) {
            if (obj.x >= 150 && obj.x <= 500 && obj.y >= 120 && obj.y <= 320) {
              obj.isSolid = !obj.isSolid;
              obj.color = obj.isSolid ? "#4a5568" : "#718096";
            }
          }
        });
      }, 800);
    }

    if (idx === 18) { // Glitch na Matriz Dada
      const platforms = [{ x: 200, y: 320, width: 60, height: 15 }, { x: 350, y: 270, width: 60, height: 15 }, { x: 500, y: 220, width: 60, height: 15 }, { x: 280, y: 180, width: 60, height: 15 }, { x: 430, y: 130, width: 60, height: 15 }];
      platforms.forEach(p => {
        objs.push({ ...p, color: "rgba(212, 163, 115, 0.3)", vx: 0, vy: 0, type: "PLATFORM", isSolid: true });
      });
    }

    if (level.mechanic === "BOSS_FIGHT") {
      objs[1] = { x: 650, y: 100, width: 80, height: 140, color: "#8B0000", vx: 0, vy: 0, type: "GOAL", health: 3 };
    }

    objectsRef.current = objs;
    setDadaQuote(DADA_QUOTES[Math.floor(Math.random() * DADA_QUOTES.length)]);
  }, []);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initLevel(currentLevelIdx);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [gameState, currentLevelIdx, initLevel]);

  const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.code] = true; };
  const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mousePosRef.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
      };
    }
  };

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (currentLevel.mechanic === "DUAL_CONTACT" && gameState === GameState.PLAYING) {
      const goal = objectsRef.current.find(o => o.type === "GOAL");
      const player = playerRef.current;
      if (goal && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;
        
        const isMouseOverGoal = mx > goal.x && mx < goal.x + goal.width && my > goal.y && my < goal.y + goal.height;
        const isPlayerOverGoal = player.x < goal.x + goal.width && player.x + player.width > goal.x && player.y < goal.y + goal.height && player.y + player.height > goal.y;

        if (isMouseOverGoal && isPlayerOverGoal) {
          triggerShake(5);
          playSound('win');
          goal.color = COLORS.GOLD;
          setTimeout(() => {
            if (currentLevelIdx === LEVELS.length - 1) setGameState(GameState.WIN_TROLL);
            else setCurrentLevelIdx(prev => prev + 1);
          }, 500);
        } else if (isMouseOverGoal || isPlayerOverGoal) {
          triggerShake(2);
        }
      }
    }
  }, [currentLevel.mechanic, currentLevelIdx, gameState, triggerShake]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown]);

  const gameLoop = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(gameLoop);
      return;
    }

    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const player = playerRef.current;
    const level = LEVELS[currentLevelIdx];
    const speed = 5;

    // Mechanics
    if (level.mechanic === "SIZE_SHIFT") {
      const isSmall = Math.floor(time / 1000) % 2 === 0;
      const wasSmall = player.scale && player.scale < 1;
      if (isSmall !== wasSmall) playSound('transform');
      
      if (isSmall) {
        player.scale = 0.6;
        player.width = 20;
        player.height = 30;
      } else {
        player.scale = 1;
        player.width = 32;
        player.height = 48;
      }
    }

    if (level.mechanic === "SCREEN_SHAKE") {
      const s = 25 + Math.sin(time / 100) * 15;
      setShakeIntensity(s);
    }

    if (level.mechanic === "GRAVITY_TICK") {
      const nextInverted = Math.floor(time / 1500) % 2 !== 0;
      if (nextInverted !== isGravityInverted) playSound('glitch');
      setIsGravityInverted(nextInverted);
    }

    let gravity = isGravityInverted ? -0.4 : 0.4;
    const jumpForce = isGravityInverted ? 12 : -13;

    let moveX = 0;
    if (keysRef.current.ArrowLeft || keysRef.current.KeyA || touchControls.left) moveX -= 1;
    if (keysRef.current.ArrowRight || keysRef.current.KeyD || touchControls.right) moveX += 1;
    
    if (level.mechanic === "REVERSE") moveX *= -1;
    
    player.vx = moveX * speed;
    
    if (level.mechanic === "WIND_AFFECTED" || currentLevelIdx === 18) player.vx -= 2.5;
    if (level.mechanic === "MOVE_ONLY_IF_MOVE" && moveX === 0) {
      gravity = 0;
      player.vy = 0;
    }

    player.vy += gravity;

    let timeScale = 1;
    if (level.mechanic === "TIME_DILATION") {
      const dist = Math.max(0, (player.x - 50) / 670);
      timeScale = Math.max(0.005, 1 - dist * 0.995);
    }

    player.x += player.vx * timeScale;
    player.y += player.vy * timeScale;

    // Ground check
    const isAtBottom = isGravityInverted ? player.y <= 10 : player.y >= 330;
    let isOnPlatform = false;
    objectsRef.current.forEach(obj => {
      if (obj.type === "PLATFORM" && obj.isSolid && 
          player.x < obj.x + obj.width && player.x + player.width > obj.x &&
          player.y + player.height >= obj.y - 1 && player.y + player.height <= obj.y + 5 &&
          player.vy >= 0) {
        isOnPlatform = true;
      }
    });

    const grounded = isAtBottom || isOnPlatform;
    if (grounded) {
      setIsJumping(false);
      setCanDoubleJump(true);
      setIsFalling(false);
    }

    // Jump
    if ((keysRef.current.ArrowUp || keysRef.current.Space || keysRef.current.KeyW || touchControls.jump) && !isFalling) {
      if (grounded) {
        player.vy = jumpForce;
        setIsJumping(true);
        setIsFalling(true);
        playSound('jump');
        if (level.mechanic === "GRAVITY_ON_JUMP") setIsGravityInverted(prev => !prev);
        setTimeout(() => setIsFalling(false), 300);
      } else if (canDoubleJump && !isJumping) {
        player.vy = jumpForce * 0.9;
        setCanDoubleJump(false);
        setIsJumping(true);
        setIsFalling(true);
        playSound('jump');
        if (level.mechanic === "GRAVITY_ON_JUMP") setIsGravityInverted(prev => !prev);
        setTimeout(() => setIsFalling(false), 300);
      }
    }

    // Absurd Elements Spawning
    if (Math.random() < 1/500) {
      const emojis = ["🐟", "👢", "🎩", "🍌", "🎷", "👁️", "🚲", "☕"];
      const newElement = {
        id: nextAbsurdId.current++,
        x: Math.random() * 800,
        y: Math.random() * 400,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        emoji: emojis[Math.floor(Math.random() * emojis.length)],
        rotation: 0,
        rv: (Math.random() - 0.5) * 0.2
      };
      setAbsurdElements(prev => [...prev, newElement]);
      setTimeout(() => {
        setAbsurdElements(prev => prev.filter(el => el.id !== newElement.id));
      }, 3000);
    }

    // Update Absurd Elements
    setAbsurdElements(prev => prev.map(el => ({
      ...el,
      x: el.x + el.vx,
      y: el.y + el.vy,
      rotation: el.rotation + el.rv
    })));

    // Boss fight projectiles
    if (level.mechanic === "BOSS_FIGHT" && Math.random() < 0.025) {
      const boss = objectsRef.current.find(o => o.type === "GOAL");
      if (boss) {
        projectilesRef.current.push({
          x: boss.x,
          y: boss.y + Math.random() * boss.height,
          width: 15,
          height: 15,
          color: "#8B0000",
          vx: -5,
          vy: (Math.random() - 0.5) * 5,
          type: "PROJECTILE"
        });
      }
    }

    // Update projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const p = projectilesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < -50 || p.x > 850 || p.y < -50 || p.y > 450) {
        projectilesRef.current.splice(i, 1);
        continue;
      }
      if (player.x < p.x + p.width && player.x + player.width > p.x &&
          player.y < p.y + p.height && player.y + player.height > p.y) {
        triggerShake(10);
        projectilesRef.current.splice(i, 1);
        resetPlayer();
        break;
      }
    }

    // Falling platforms
    if (level.mechanic === "FALLING_PLATFORMS") {
      objectsRef.current.forEach(obj => {
        if (obj.type === "PLATFORM" && obj.color !== COLORS.INK) {
          const isTouched = player.x < obj.x + obj.width && player.x + player.width > obj.x &&
                          player.y + player.height >= obj.y - 5 && player.y + player.height <= obj.y + 10;
          if (isTouched) {
            obj.vy = (obj.vy || 0) + 0.2;
          }
          if (obj.vy) {
            obj.y += obj.vy;
            if (obj.y > 450) obj.isSolid = false;
          }
        }
      });
    }

    // Boundaries
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > 800) player.x = 800 - player.width;
    
    if (isGravityInverted) {
      if (player.y < -200) resetPlayer();
      if (player.y > 600) player.y = 600;
    } else {
      if (player.y < -200) player.y = -200;
      if (player.y > 600) resetPlayer();
    }

    // Phantom platforms
    if (level.mechanic === "PHANTOM_PLATFORMS") {
      objectsRef.current.forEach(obj => {
        if (obj.type === "PLATFORM" && "phantom" in obj) {
          const wasSolid = obj.isSolid;
          if (player.y > obj.y - 50 && player.y < obj.y + 50) {
            obj.isSolid = true;
            obj.color = COLORS.GOLD;
            if (!wasSolid) playSound('glitch');
          } else {
            obj.isSolid = false;
            obj.color = "rgba(212, 163, 115, 0.3)";
          }
        }
      });
    }

    // Collisions
    objectsRef.current.forEach(obj => {
      // Shy button
      if (obj.type === "BUTTON" && level.mechanic === "SHY_BUTTON") {
        const dx = (obj.x + obj.width / 2) - player.x;
        const dy = (obj.y + obj.height / 2) - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          obj.x += (dx / dist) * 6;
          obj.y += (dy / dist) * 6;
        }
        const mdx = (obj.x + obj.width / 2) - mousePosRef.current.x;
        const mdy = (obj.y + obj.height / 2) - mousePosRef.current.y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < 80) {
          obj.x -= (mdx / mdist) * 4;
          obj.y -= (mdy / mdist) * 4;
        }
        if (obj.x < 100) obj.x = 100;
        if (obj.x > 700) obj.x = 700;
        if (obj.y < 100) obj.y = 100;
        if (obj.y > 300) obj.y = 300;
      }

      // General collision
      if (player.x < obj.x + obj.width && player.x + player.width > obj.x &&
          player.y < obj.y + obj.height && player.y + player.height > obj.y) {
        
        if (obj.type === "PLATFORM" && obj.isSolid) {
          if (player.vy > 0 && player.y < obj.y) {
            player.y = obj.y - player.height;
            player.vy = 0;
            setIsJumping(false);
            setCanDoubleJump(true);
          } else if (player.vy < 0 && player.y > obj.y) {
            player.y = obj.y + obj.height;
            player.vy = 0;
          }
        }

        if (obj.type === "TRAP") {
          triggerShake(8);
          resetPlayer();
        }

        if (obj.type === "GOAL" && isGoalActive && level.id !== 9 && level.mechanic !== "DUAL_CONTACT") {
          if (level.mechanic === "SIZE_SHIFT") {
            if (player.scale && player.scale < 0.7) {
              playSound('win');
              if (currentLevelIdx === LEVELS.length - 1) setGameState(GameState.WIN_TROLL);
              else setCurrentLevelIdx(p => p + 1);
            } else {
              triggerShake(3);
              player.x -= 30;
            }
          } else if (level.mechanic === "BOSS_FIGHT") {
            const now = Date.now();
            if (now - lastHitTime > 500) {
              setLastHitTime(now);
              setBossHealth(h => {
                const newH = h - 1;
                triggerShake(15);
                if (newH <= 0) {
                  playSound('win');
                  setTimeout(() => setGameState(GameState.WIN_TROLL), 1000);
                } else {
                  obj.x = Math.random() * 400 + 200;
                  obj.y = Math.random() * 150 + 50;
                  player.x = 50;
                  player.y = 300;
                  player.vx = 0;
                  player.vy = 0;
                }
                return newH;
              });
            }
          } else {
            playSound('win');
            if (currentLevelIdx === LEVELS.length - 1) setGameState(GameState.WIN_TROLL);
            else setCurrentLevelIdx(p => p + 1);
          }
        }

        if (obj.type === "BUTTON") {
          setIsGoalActive(true);
          obj.color = COLORS.GOLD;
          triggerShake(5);
        }
      }

      // Drifting door
      if (obj.type === "GOAL" && level.mechanic === "DRIFTING_DOOR") {
        obj.y = 150 + Math.sin(time / 500) * 100;
        obj.x = 600 + Math.cos(time / 1000) * 100;
      }
    });

    draw();
    requestRef.current = requestAnimationFrame(gameLoop);
  }, [gameState, currentLevelIdx, isGoalActive, resetPlayer, isGravityInverted, lastHitTime, triggerShake, touchControls, isFalling, canDoubleJump, isJumping]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = currentLevel.bgColor || COLORS.PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Wind effect
    if (currentLevel.mechanic === "WIND_AFFECTED" || currentLevelIdx === 18) {
      if (Math.random() < 0.05) playSound('wind');
      for (let i = 0; i < 15; i++) {
        const x = 50 + i * 50;
        const y = 50 + Math.sin(Date.now() / 500 + i) * 20;
        ctx.strokeStyle = "rgba(99, 179, 237, 0.6)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 15, y);
        ctx.lineTo(x - 10, y - 4);
        ctx.moveTo(x - 15, y);
        ctx.lineTo(x - 10, y + 4);
        ctx.stroke();
      }
    }

    // Time dilation UI
    if (currentLevel.mechanic === "TIME_DILATION") {
      const dist = Math.max(0, (playerRef.current.x - 50) / 670);
      const timeScale = Math.max(0.005, 1 - dist * 0.995);
      ctx.fillStyle = `rgba(139, 0, 0, ${0.3 + dist * 0.4})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "bold 16px Courier";
      ctx.textAlign = "center";
      ctx.fillText(`VELOCIDADE: ${Math.round(timeScale * 100)}%`, 400, 30);
    }

    // Draw objects
    objectsRef.current.forEach(obj => {
      if (obj.type === "GOAL") {
        ctx.save();
        ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
        const t = Date.now() / 1000;
        ctx.rotate(Math.sin(t) * 0.1);
        if (isGoalActive) {
          ctx.fillStyle = currentLevel.mechanic === "BOSS_FIGHT" ? "#8B0000" : COLORS.RED;
          ctx.beginPath();
          ctx.ellipse(0, 0, obj.width / 2, obj.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.WHITE;
          ctx.beginPath();
          ctx.ellipse(0, 0, obj.width / 3, obj.height / 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = COLORS.INK;
          ctx.beginPath();
          ctx.arc(Math.sin(t * 2) * 5, 0, 8, 0, Math.PI * 2);
          ctx.fill();
          if (currentLevel.mechanic === "BOSS_FIGHT") {
            ctx.fillStyle = "white";
            ctx.font = "bold 20px Courier";
            ctx.textAlign = "center";
            ctx.fillText("HP:" + bossHealth, 0, -70);
          }
        } else {
          ctx.fillStyle = "#444";
          ctx.fillRect(-obj.width / 2, -obj.height / 2, obj.width, obj.height);
          ctx.fillStyle = COLORS.GOLD;
          ctx.fillRect(-10, -5, 20, 15);
          ctx.beginPath();
          ctx.arc(0, -5, 8, 0, Math.PI);
          ctx.fill();
        }
        ctx.restore();
      } else if (obj.type === "PLATFORM") {
        if (obj.color !== "transparent") {
          if (currentLevel.mechanic === "PHANTOM_PLATFORMS" && !obj.isSolid) {
            ctx.globalAlpha = 0.2 + Math.sin(Date.now() / 300) * 0.2;
          }
          ctx.fillStyle = obj.color;
          ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
          if (currentLevel.mechanic === "GLITCH_MAZE") {
            if (!obj.isSolid) {
              ctx.strokeStyle = "#ff0000";
              ctx.lineWidth = 2;
              ctx.setLineDash([3, 3]);
              ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
              ctx.setLineDash([]);
            }
          } else if (!(currentLevel.mechanic === "PHANTOM_PLATFORMS" && !obj.isSolid)) {
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y + obj.height / 2);
            ctx.lineTo(obj.x + obj.width, obj.y + obj.height / 2);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
        }
      } else if (obj.type === "TRAP") {
        ctx.fillStyle = obj.color;
        for (let x = 0; x < obj.width; x += 10) {
          ctx.beginPath();
          ctx.moveTo(obj.x + x, obj.y + obj.height);
          ctx.lineTo(obj.x + x + 5, obj.y);
          ctx.lineTo(obj.x + x + 10, obj.y + obj.height);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = obj.color;
        ctx.fillRect(obj.x, obj.y, obj.width, obj.height);
      }
    });

    // Projectiles
    projectilesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x + p.width / 2, p.y + p.height / 2, p.width / 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Absurd Elements
    absurdElements.forEach(el => {
      ctx.save();
      ctx.translate(el.x, el.y);
      ctx.rotate(el.rotation);
      ctx.font = "40px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(el.emoji, 0, 0);
      ctx.restore();
    });

    // Player
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    if (p.scale && p.scale !== 1) ctx.scale(p.scale, p.scale);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
    ctx.fillStyle = COLORS.WHITE;
    ctx.beginPath();
    ctx.arc(0, -p.height / 4, p.scale && p.scale < 1 ? 6 : 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.INK;
    ctx.beginPath();
    ctx.arc(0, -p.height / 4, p.scale && p.scale < 1 ? 2 : 3, 0, Math.PI * 2);
    ctx.fill();
    
    if (currentLevel.mechanic === "SIZE_SHIFT") {
      ctx.fillStyle = p.scale && p.scale < 1 ? "#00ff00" : "#ff5555";
      ctx.font = "bold 12px Courier";
      ctx.textAlign = "center";
      ctx.fillText(p.scale && p.scale < 1 ? "PEQUENO" : "GRANDE", 0, -p.height / 2 - 15);
    }
    
    ctx.restore();
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  const selectLevel = (idx: number) => {
    initAudio();
    if (idx <= maxLevelReached) {
      setCurrentLevelIdx(idx);
      setGameState(GameState.PLAYING);
    }
  };

  const handleJudgeSubmit = () => {
    if (!userInput.trim()) {
      setJudgeResponse({ allow: false, reason: "O silêncio é a língua dos mortos. Tente gritar letras." });
      return;
    }
    setIsProcessing(true);
    setTimeout(() => {
      setJudgeResponse({ allow: true, reason: DADA_QUOTES[Math.floor(Math.random() * DADA_QUOTES.length)] });
      setIsProcessing(false);
      setTimeout(() => {
        playSound('win');
        if (currentLevelIdx === LEVELS.length - 1) setGameState(GameState.WIN_TROLL);
        else setCurrentLevelIdx(prev => prev + 1);
      }, 1500);
    }, 800);
  };

  const handlePhaseClick = () => {
    if (currentLevel.id === 9 && gameState === GameState.PLAYING) {
      triggerShake(8);
      playSound('win');
      const el = document.querySelector(".phase-number");
      if (el) {
        el.classList.add("animate-pulse", "text-red-600");
        setTimeout(() => el.classList.remove("animate-pulse", "text-red-600"), 1000);
      }
      setTimeout(() => setCurrentLevelIdx(prev => prev + 1), 800);
    }
  };

  const setTouch = (key: string, val: boolean) => {
    setTouchControls(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div 
      onMouseDown={initAudio}
      onTouchStart={initAudio}
      className="min-h-screen flex flex-col items-center justify-center p-2 md:p-4 relative overflow-hidden select-none touch-none"
    >
      {/* Header UI */}
      <div className="fixed top-0 left-0 w-full p-2 md:p-4 flex justify-between items-start z-[100] pointer-events-none">
        <div 
          onClick={() => setGameState(GameState.LEVEL_SELECT)}
          className="bg-black text-white p-2 md:p-3 border-2 md:border-4 border-white shadow-[4px_4px_0px_black] pointer-events-auto cursor-pointer hover:bg-red-600 transition-colors"
        >
          <p className="font-black text-[10px] md:text-sm uppercase leading-tight">
            FASE: <span 
              className="text-xl md:text-2xl cursor-pointer hover:underline text-yellow-400 p-1 phase-number transition-all duration-300"
              onClick={(e) => { e.stopPropagation(); handlePhaseClick(); }}
              onMouseEnter={(e) => {
                if (currentLevel.id === 9 && gameState === GameState.PLAYING) {
                  e.currentTarget.style.transform = "scale(1.2)";
                  e.currentTarget.style.textShadow = "0 0 10px red";
                }
              }}
              onMouseLeave={(e) => {
                if (currentLevel.id === 9 && gameState === GameState.PLAYING) {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.textShadow = "none";
                }
              }}
            >
              {currentLevelIdx + 1}/{LEVELS.length}
            </span>
          </p>
          <p className="text-[8px] md:text-[10px]">MORTES: {deaths}</p>
        </div>

        <div className="flex flex-col gap-2 items-end">
          <div className="bg-yellow-200 text-black p-1 md:p-2 border-2 border-black rotate-1 pointer-events-auto hidden md:block shadow-md">
            <p className="text-[10px] md:text-[12px] font-bold">"DADA NÃO É NADA"</p>
          </div>
          {gameState === GameState.PLAYING && (
            <button 
              onClick={() => setIsHelpOpen(!isHelpOpen)}
              className="bg-red-600 text-white px-4 py-2 border-4 border-black pointer-events-auto font-black text-sm shadow-[4px_4px_0px_white] hover:bg-black transition-all"
            >
              {isHelpOpen ? "VOLTAR" : "SOCORRO"}
            </button>
          )}
        </div>
      </div>

      {/* Start Screen */}
      {gameState === GameState.START && (
        <div className="z-10 text-center space-y-4 md:space-y-8 max-w-xl bg-white p-6 md:p-12 border-[8px] border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] relative mx-4">
          <div className="absolute -top-12 -left-12 bg-red-600 text-white p-6 rotate-[-10deg] font-black text-4xl border-4 border-black dada-shake">DADA!</div>
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none">
            DADA<br/><span className="bg-black text-white px-2">TROLL</span>
          </h1>
          <p className="text-sm md:text-xl italic font-serif text-gray-800">Seu progresso é eterno no navegador.</p>
          <button 
            onClick={() => setGameState(GameState.PLAYING)}
            className="w-full px-6 py-4 md:px-12 md:py-6 bg-black text-white text-2xl md:text-4xl font-black transition-all hover:bg-red-600 border-4 border-black shadow-[8px_8px_0px_#bc2a1e]"
          >
            CONTINUAR
          </button>
        </div>
      )}

      {/* Level Select */}
      {gameState === GameState.LEVEL_SELECT && (
        <div className="z-[110] bg-white p-6 md:p-12 border-8 border-black shadow-[15px_15px_0px_black] max-w-3xl w-full max-h-[90vh] overflow-y-auto mx-4">
          <h2 className="text-3xl md:text-6xl font-black mb-8 border-b-8 border-black pb-4 uppercase">Mapeamento do Caos</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
            {LEVELS.map((lvl, i) => {
              const isUnlocked = i <= maxLevelReached;
              return (
                <button
                  key={lvl.id}
                  onClick={() => selectLevel(i)}
                  disabled={!isUnlocked}
                  className={`h-16 md:h-24 flex flex-col items-center justify-center border-4 font-black text-xl md:text-2xl transition-all ${
                    isUnlocked ? "bg-black text-white border-black hover:bg-red-600 cursor-pointer" : "bg-gray-300 text-gray-500 border-gray-400"
                  }`}
                >
                  {lvl.id}
                  <span className="text-xs mt-1">{lvl.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
          <button 
            onClick={() => setGameState(GameState.START)}
            className="mt-8 px-8 py-3 bg-red-600 text-white font-black border-4 border-black uppercase"
          >
            Voltar
          </button>
        </div>
      )}

      {/* Game View */}
      {gameState === GameState.PLAYING && (
        <div 
          className="z-10 flex flex-col items-center w-full transition-transform duration-75"
          style={{ 
            transform: `translate(${Math.random() * shakeIntensity - shakeIntensity / 2}px, ${Math.random() * shakeIntensity - shakeIntensity / 2}px)`,
            transition: 'transform 0.1s linear'
          }}
        >
          <div className="mb-2 md:mb-6 text-center max-w-2xl bg-white p-2 border-2 border-black rotate-[-1deg] mx-2 shadow-md">
            <div className="bg-black text-white px-4 py-1 mb-1">
              <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest leading-none">{currentLevel.title}</h2>
            </div>
            <p className="text-sm md:text-xl italic font-serif text-black font-bold">"{dadaQuote}"</p>
          </div>

          <div className="relative border-[8px] md:border-[16px] border-black shadow-[20px_20px_0px_rgba(0,0,0,0.2)] bg-white overflow-hidden max-w-[95vw]">
            {/* Help Overlay */}
            {isHelpOpen && (
              <div className="absolute inset-0 bg-white z-[90] p-6 md:p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-200">
                <h3 className="text-4xl md:text-6xl font-black text-black mb-6 uppercase border-b-8 border-black">O Oráculo Diz:</h3>
                <p className="text-xl md:text-3xl font-black leading-tight text-red-600 mb-10 bg-black p-4 inline-block">{currentLevel.solution}</p>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="bg-black text-white px-12 py-5 font-black uppercase text-2xl border-4 border-red-600 hover:bg-red-600 transition-colors"
                >
                  IGNORAR
                </button>
              </div>
            )}

            {/* Judge Overlay */}
            {currentLevel.mechanic === "GEMINI_SAYS" && (
              <div className="absolute inset-0 bg-black z-[110] flex flex-col items-center justify-center p-4 md:p-12 text-center text-white overflow-y-auto">
                <h3 className="text-2xl md:text-6xl font-black mb-2 md:mb-4 text-yellow-400 uppercase">O Juiz de Tinta</h3>
                <p className="text-xs md:text-xl mb-4 md:mb-6 italic">"O silêncio é uma arma branca. O que você tem a dizer?"</p>
                <input 
                  type="text" 
                  autoFocus 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="w-full p-2 md:p-4 border-2 md:border-4 border-white text-lg md:text-3xl font-bold mb-4 md:mb-6 bg-transparent text-white outline-none text-center"
                  placeholder="..."
                />
                <button 
                  onClick={handleJudgeSubmit}
                  disabled={isProcessing}
                  className="px-8 py-3 md:px-12 md:py-4 bg-white text-black text-xl md:text-2xl font-black hover:bg-red-600 transition-all uppercase"
                >
                  {isProcessing ? "Processando..." : "ENVIAR"}
                </button>
                {judgeResponse && (
                  <div className="mt-4 p-3 md:p-4 border-2 md:border-4 border-dashed border-white bg-red-900 animate-in fade-in slide-in-from-bottom-2">
                    <p className="text-lg md:text-2xl font-black">{judgeResponse.reason}</p>
                  </div>
                )}
              </div>
            )}

            <canvas 
              ref={canvasRef} 
              width={800} 
              height={400} 
              className="w-full h-auto aspect-[2/1] bg-white"
              style={{ cursor: 'default' }}
            />
          </div>

          {/* Instructions */}
          <div className="mt-4 md:mt-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 max-w-3xl w-full px-2">
            <div className="bg-white border-8 border-black p-4 md:p-6 rotate-1 shadow-[8px_8px_0px_black]">
              <p className="font-black border-b-4 border-black mb-2 text-xl md:text-2xl">INSTRUÇÃO:</p>
              <p className="text-sm md:text-lg font-bold text-black italic">{currentLevel.instruction}</p>
            </div>
            <div className="bg-yellow-400 text-black border-8 border-black p-4 md:p-6 -rotate-1 shadow-[8px_8px_0px_black]">
              <p className="font-black border-b-4 border-black mb-2 text-xl md:text-2xl">REGRA:</p>
              <p className="text-[10px] md:text-sm font-black uppercase">{currentLevel.rule}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Controls */}
      {isMobile && gameState === GameState.PLAYING && (
        <div className="fixed bottom-4 left-0 w-full flex justify-between px-6 z-[120] pointer-events-none">
          <div className="flex gap-4 pointer-events-auto">
            <button 
              onTouchStart={() => setTouch('left', true)}
              onTouchEnd={() => setTouch('left', false)}
              className={`w-16 h-16 border-4 border-white text-white font-black text-3xl flex items-center justify-center rounded-full transition-all ${touchControls.left ? 'bg-red-600 scale-90' : 'bg-black/80'}`}
            >
              ←
            </button>
            <button 
              onTouchStart={() => setTouch('right', true)}
              onTouchEnd={() => setTouch('right', false)}
              className={`w-16 h-16 border-4 border-white text-white font-black text-3xl flex items-center justify-center rounded-full transition-all ${touchControls.right ? 'bg-red-600 scale-90' : 'bg-black/80'}`}
            >
              →
            </button>
          </div>
          <div className="pointer-events-auto">
            <button 
              onTouchStart={() => setTouch('jump', true)}
              onTouchEnd={() => setTouch('jump', false)}
              className={`w-20 h-20 border-4 border-white text-white font-black text-xl flex items-center justify-center rounded-full uppercase transition-all ${touchControls.jump ? 'bg-blue-600 scale-90' : 'bg-black/80'}`}
            >
              PULO
            </button>
          </div>
        </div>
      )}

      {/* Win Screen */}
      {gameState === GameState.WIN_TROLL && (
        <div className="z-[130] text-center bg-white p-8 md:p-20 border-[12px] border-black shadow-[30px_30px_0px_rgba(255,0,0,0.5)] max-w-3xl mx-4">
          <h1 className="text-5xl md:text-9xl font-black mb-8 leading-none uppercase">VITÓRIA<br/>DADAISTA</h1>
          <p className="text-lg md:text-3xl mb-12 italic text-black font-serif">A conformidade morreu. Você completou o ciclo do absurdo.</p>
          <button 
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-12 py-6 bg-red-600 text-white text-3xl font-black border-8 border-black uppercase hover:bg-black transition-all"
          >
            ZERAR TUDO
          </button>
        </div>
      )}
    </div>
  );
}
