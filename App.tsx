import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Entity } from './types';
import { LEVELS, COLORS, DADA_RESPONSES } from './constants';

// Interfaces adicionais
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface ScreenShake {
  x: number;
  y: number;
  intensity: number;
}

const App: React.FC = () => {
  // Persistence
  const savedLevel = parseInt(localStorage.getItem('dada_level') || '0');
  const savedMax = parseInt(localStorage.getItem('dada_max') || '0');
  const savedDeaths = parseInt(localStorage.getItem('dada_deaths') || '0');

  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [currentLevelIdx, setCurrentLevelIdx] = useState(savedLevel >= LEVELS.length ? 0 : savedLevel);
  const [maxReachedIdx, setMaxReachedIdx] = useState(savedMax);
  const [deaths, setDeaths] = useState(savedDeaths);
  const [dadaQuote, setDadaQuote] = useState("Dada não significa nada.");
  const [playerInput, setPlayerInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [doorOpen, setDoorOpen] = useState(true);
  const [shakeAmount, setShakeAmount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dadaVerdict, setDadaVerdict] = useState<{allow: boolean, reason: string} | null>(null);
  const [gravityInverted, setGravityInverted] = useState(false);
  const [bossHealth, setBossHealth] = useState(3);
  const [bossLastHitTime, setBossLastHitTime] = useState<number>(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [achievements, setAchievements] = useState<string[]>([]);
  const [invulnerable, setInvulnerable] = useState(false);
  const [flashEffect, setFlashEffect] = useState(false);
  const [playerTrail, setPlayerTrail] = useState<Array<{x: number, y: number, alpha: number}>>([]);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);
  const [achievementTimeout, setAchievementTimeout] = useState<NodeJS.Timeout | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  const screenShakeRef = useRef<ScreenShake>({ x: 0, y: 0, intensity: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const playerRef = useRef<Entity>({
    x: 50, y: 300, width: 32, height: 48, color: COLORS.INK, vx: 0, vy: 0, type: 'PLAYER', scale: 1
  });
  const entitiesRef = useRef<Entity[]>([]);
  const projectilesRef = useRef<Entity[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef({ x: 0, y: 0 });
  const canvasSizeRef = useRef({ width: 800, height: 400, scale: 1 });

  const currentLevel = LEVELS[currentLevelIdx];

  // Responsividade simplificada
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (!container) return;
    
    const maxWidth = Math.min(window.innerWidth * 0.95, 800);
    const height = maxWidth / 2;
    
    canvas.style.width = `${maxWidth}px`;
    canvas.style.height = `${height}px`;
    
    canvasSizeRef.current = {
      width: 800,
      height: 400,
      scale: maxWidth / 800
    };
  }, []);

  // Sistema de áudio simplificado
  const playSound = useCallback((type: 'jump' | 'hit' | 'death' | 'shoot' | 'win' | 'bossHit') => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      const frequencies = {
        jump: 523.25,
        hit: 349.23,
        death: 220,
        shoot: 659.25,
        win: 1046.50,
        bossHit: 392
      };
      
      oscillator.frequency.setValueAtTime(frequencies[type], ctx.currentTime);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (e) {
      console.log("Audio not supported");
    }
  }, []);

  // Sistema de conquistas com popup
  const unlockAchievement = useCallback((id: string, name: string) => {
    if (!achievements.includes(id)) {
      setAchievements(prev => [...prev, id]);
      setShowAchievement(name);
      
      localStorage.setItem('dada_achievements', JSON.stringify([...achievements, id]));
      
      // Limpar timeout anterior
      if (achievementTimeout) {
        clearTimeout(achievementTimeout);
      }
      
      // Esconder após 3 segundos
      const timeout = setTimeout(() => {
        setShowAchievement(null);
      }, 3000);
      
      setAchievementTimeout(timeout);
    }
  }, [achievements, achievementTimeout]);

  // Sistema de partículas
  const createParticles = useCallback((x: number, y: number, count: number, color: string, spread: number = 5) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * spread,
        vy: (Math.random() - 0.5) * spread,
        life: 1.0,
        color,
        size: Math.random() * 4 + 2
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // Sistema de trail do jogador
  const updatePlayerTrail = useCallback((x: number, y: number) => {
    setPlayerTrail(prev => {
      const newTrail = [{ x, y, alpha: 1.0 }, ...prev.slice(0, 9)];
      return newTrail.map((pos, i) => ({
        ...pos,
        alpha: 1.0 - (i / 10)
      }));
    });
  }, []);

  // Sistema de screen shake simplificado mas FUNCIONAL
  const triggerShake = useCallback((intensity: number) => {
    screenShakeRef.current.intensity = intensity;
    setShakeAmount(intensity);
    
    setTimeout(() => {
      screenShakeRef.current.intensity = 0;
      setShakeAmount(0);
    }, 300);
    
    if (intensity >= 15) {
      createParticles(playerRef.current.x + 16, playerRef.current.y + 24, 20, COLORS.RED, 8);
      playSound('bossHit');
    } else if (intensity >= 10) {
      createParticles(playerRef.current.x + 16, playerRef.current.y + 24, 10, COLORS.WHITE, 6);
      playSound('hit');
    }
  }, [createParticles, playSound]);

  // Efeito de flash
  const triggerFlash = useCallback((duration: number = 100) => {
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), duration);
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth < 1024 || 'ontouchstart' in window;
      setIsMobile(isMobileDevice);
      updateCanvasSize();
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Carregar conquistas salvas
    const savedAchievements = localStorage.getItem('dada_achievements');
    if (savedAchievements) {
      setAchievements(JSON.parse(savedAchievements));
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      if (achievementTimeout) clearTimeout(achievementTimeout);
    };
  }, [updateCanvasSize]);

  useEffect(() => {
    localStorage.setItem('dada_level', currentLevelIdx.toString());
    localStorage.setItem('dada_max', Math.max(maxReachedIdx, currentLevelIdx).toString());
    localStorage.setItem('dada_deaths', deaths.toString());
    if (currentLevelIdx > maxReachedIdx) setMaxReachedIdx(currentLevelIdx);
  }, [currentLevelIdx, deaths, maxReachedIdx]);

  const die = useCallback(() => {
    setDeaths(d => d + 1);
    createParticles(playerRef.current.x + 16, playerRef.current.y + 24, 30, COLORS.INK, 10);
    triggerShake(20);
    triggerFlash(200);
    playSound('death');
    
    playerRef.current.x = 50;
    playerRef.current.y = 300;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.scale = 1;
    projectilesRef.current = [];
    if (currentLevelIdx === 19) {
      setBossHealth(3);
      setBossLastHitTime(0);
    }
  }, [currentLevelIdx, createParticles, triggerShake, triggerFlash, playSound]);

  const initLevel = useCallback((idx: number) => {
    const level = LEVELS[idx];
    playerRef.current = { ...playerRef.current, x: 50, y: 300, vx: 0, vy: 0, scale: 1 };
    setDoorOpen(level.mechanic !== 'SHY_BUTTON');
    setShowHelp(false);
    setDadaVerdict(null);
    setPlayerInput("");
    setGravityInverted(level.mechanic === 'GRAVITY_SWAP');
    setBossHealth(3);
    setBossLastHitTime(0);
    setShakeAmount(0);
    setParticles([]);
    setPlayerTrail([]);
    setInvulnerable(false);
    projectilesRef.current = [];
    
    const platforms: Entity[] = [
      { x: 0, y: 380, width: 800, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: 'PLATFORM' },
      { x: 720, y: 280, width: 50, height: 100, color: COLORS.RED, vx: 0, vy: 0, type: 'GOAL' }
    ];

    // Obstacles
    if (idx > 1) platforms.push({ x: 300, y: 365, width: 60, height: 15, color: COLORS.TRAP, vx: 0, vy: 0, type: 'TRAP' });
    if (idx > 5) platforms.push({ x: 500, y: 365, width: 60, height: 15, color: COLORS.TRAP, vx: 0, vy: 0, type: 'TRAP' });
    if (idx === 15) { // Labirinto do Ócio (Fase 16)
        platforms.push({ x: 150, y: 280, width: 80, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: 'PLATFORM' });
        platforms.push({ x: 300, y: 220, width: 80, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: 'PLATFORM' });
        platforms.push({ x: 450, y: 160, width: 80, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: 'PLATFORM' });
    }
    if (level.mechanic === 'SHY_BUTTON') platforms.push({ x: 400, y: 200, width: 40, height: 40, color: COLORS.BLUE, vx: 0, vy: 0, type: 'BUTTON' });
    if (level.mechanic === 'INVISIBLE_WALLS') platforms.push({ x: 350, y: 150, width: 40, height: 230, color: 'transparent', vx: 0, vy: 0, type: 'PLATFORM' });
    if (level.mechanic === 'PHANTOM_PLATFORMS') platforms.push({ x: 200, y: 250, width: 400, height: 20, color: COLORS.GOLD, vx: 0, vy: 0, type: 'PLATFORM' });
    if (level.mechanic === 'BOSS_FIGHT') {
      platforms[1] = { 
        x: 600, 
        y: 150, 
        width: 60, 
        height: 120, 
        color: COLORS.RED, 
        vx: 0, 
        vy: 0, 
        type: 'GOAL', 
        health: 3 
      };
    }

    entitiesRef.current = platforms;
    setDadaQuote(DADA_RESPONSES[Math.floor(Math.random() * DADA_RESPONSES.length)]);
    updateCanvasSize();
  }, [updateCanvasSize]);

  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initLevel(currentLevelIdx);
    }
  }, [gameState, currentLevelIdx, initLevel]);

  const handleKeyDown = (e: KeyboardEvent) => { 
    keysRef.current[e.code] = true; 
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      playSound('jump');
    }
  };
  
  const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };

  // Controles touch funcionais
  const handleTouchStart = (direction: 'left' | 'right' | 'jump') => {
    if (direction === 'left') {
      keysRef.current['ArrowLeft'] = true;
    } else if (direction === 'right') {
      keysRef.current['ArrowRight'] = true;
    } else if (direction === 'jump') {
      keysRef.current['Space'] = true;
      playSound('jump');
    }
  };

  const handleTouchEnd = (direction: 'left' | 'right' | 'jump') => {
    if (direction === 'left') {
      keysRef.current['ArrowLeft'] = false;
    } else if (direction === 'right') {
      keysRef.current['ArrowRight'] = false;
    } else if (direction === 'jump') {
      keysRef.current['Space'] = false;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      mouseRef.current = { 
        x: (e.clientX - rect.left) * scaleX, 
        y: (e.clientY - rect.top) * scaleY 
      };
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (currentLevel.mechanic === 'DUAL_CONTACT') {
        const goal = entitiesRef.current.find(ent => ent.type === 'GOAL');
        const p = playerRef.current;
        if (goal) {
            const mouseOverGoal = mouseRef.current.x > goal.x && 
                                 mouseRef.current.x < goal.x + goal.width && 
                                 mouseRef.current.y > goal.y && 
                                 mouseRef.current.y < goal.y + goal.height;
            const playerTouchingGoal = p.x < goal.x + goal.width && 
                                       p.x + p.width > goal.x && 
                                       p.y < goal.y + goal.height && 
                                       p.y + p.height > goal.y;
            if (mouseOverGoal && playerTouchingGoal) {
                if (currentLevelIdx === LEVELS.length - 1) setGameState(GameState.WIN_TROLL);
                else setCurrentLevelIdx(prev => prev + 1);
            }
        }
    }
  };

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
  }, [currentLevelIdx]);

  const update = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) {
      lastUpdateRef.current = time;
      requestRef.current = requestAnimationFrame(update);
      return;
    }
    
    const dt = Math.min(time - lastUpdateRef.current, 100) / 16;
    lastUpdateRef.current = time;

    const p = playerRef.current;
    const level = LEVELS[currentLevelIdx];
    const speed = 5;
    
    // Gravity Ticking mechanic
    if (level.mechanic === 'GRAVITY_TICK') {
        if (Math.floor(time / 2000) % 2 === 0) setGravityInverted(false);
        else setGravityInverted(true);
    }

    let gravity = gravityInverted ? -0.4 : 0.4;
    const jumpPower = gravityInverted ? 10 : -11;

    let moveX = 0;
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA']) moveX -= 1;
    if (keysRef.current['ArrowRight'] || keysRef.current['KeyD']) moveX += 1;
    if (level.mechanic === 'REVERSE') moveX *= -1;

    p.vx = moveX * speed;
    if (level.mechanic === 'WIND_AFFECTED') p.vx -= 3;
    if (level.mechanic === 'MOVE_ONLY_IF_MOVE' && moveX === 0) {
        gravity = 0;
        p.vy = 0;
    }

    p.vy += gravity;

    let deltaMultiplier = 1;
    if (level.mechanic === 'TIME_DILATION') deltaMultiplier = Math.max(0.1, 1 - (p.x / 800));

    p.x += p.vx * deltaMultiplier * dt;
    p.y += p.vy * deltaMultiplier * dt;

    if (keysRef.current['ArrowUp'] || keysRef.current['Space'] || keysRef.current['KeyW']) {
      const onFloor = gravityInverted ? p.y <= 10 : p.y >= 330;
      if (onFloor || Math.abs(p.vy) < 0.8) {
        p.vy = jumpPower;
        createParticles(p.x + 16, p.y + 48, 5, gravityInverted ? COLORS.BLUE : COLORS.INK, 2);
      }
    }

    // Atualizar trail do jogador
    updatePlayerTrail(p.x + 16, p.y + 24);

    // Boss Projectiles
    if (level.mechanic === 'BOSS_FIGHT' && Math.random() < 0.02) {
        const goal = entitiesRef.current.find(e => e.type === 'GOAL');
        if (goal) {
            projectilesRef.current.push({
                x: goal.x, 
                y: goal.y + Math.random() * goal.height, 
                width: 15, 
                height: 15, 
                color: COLORS.INK, 
                vx: -5, 
                vy: (Math.random() - 0.5) * 4, 
                type: 'PROJECTILE'
            });
            createParticles(goal.x, goal.y + goal.height/2, 3, COLORS.RED, 1);
            playSound('shoot');
        }
    }

    // Update projectiles
    projectilesRef.current.forEach((proj, idx) => {
        proj.x += proj.vx * dt; 
        proj.y += proj.vy * dt;
        
        // Remove projectiles that go off screen
        if (proj.x < -20 || proj.x > 820 || proj.y < -20 || proj.y > 420) {
          projectilesRef.current.splice(idx, 1);
          return;
        }
        
        // Check collision with player
        if (!invulnerable && 
            p.x < proj.x + proj.width && 
            p.x + p.width > proj.x && 
            p.y < proj.y + proj.height && 
            p.y + p.height > proj.y) {
          // Trigger screen shake when player is hit
          triggerShake(15);
          createParticles(proj.x + 7.5, proj.y + 7.5, 20, COLORS.WHITE, 5);
          projectilesRef.current.splice(idx, 1);
          
          // Temporariamente invulnerável
          setInvulnerable(true);
          setTimeout(() => setInvulnerable(false), 1000);
          
          die();
          return;
        }
    });

    // Atualizar partículas
    setParticles(prev => prev
      .map(particle => ({
        ...particle,
        x: particle.x + particle.vx * dt,
        y: particle.y + particle.vy * dt,
        life: particle.life - 0.02
      }))
      .filter(particle => particle.life > 0)
    );

    // Screen boundaries
    if (p.x < 0) p.x = 0;
    if (p.x + p.width > 800) p.x = 800 - p.width;
    if (p.y < -200 || p.y > 600) die();

    // Check collisions with entities
    entitiesRef.current.forEach(ent => {
      const isColliding = p.x < ent.x + ent.width && 
                         p.x + p.width > ent.x && 
                         p.y < ent.y + ent.height && 
                         p.y + p.height > ent.y;
      
      if (isColliding) {
        if (ent.type === 'PLATFORM') {
          const phantomActive = level.mechanic === 'PHANTOM_PLATFORMS' && Math.abs(p.vy) > 1;
          if (!phantomActive) {
            if (p.vy > 0 && p.y < ent.y) { 
              p.y = ent.y - p.height; 
              p.vy = 0; 
            } else if (p.vy < 0 && p.y > ent.y) { 
              p.y = ent.y + ent.height; 
              p.vy = 0; 
            }
          }
        }
        
        if (ent.type === 'TRAP' && !invulnerable) {
          triggerShake(20);
          triggerFlash(150);
          createParticles(p.x + 16, p.y + 24, 30, COLORS.TRAP, 8);
          die();
        }
        
        if (ent.type === 'GOAL' && doorOpen && level.id !== 9 && level.mechanic !== 'DUAL_CONTACT') {
          if (level.mechanic === 'BOSS_FIGHT') {
            const currentTime = Date.now();
            if (currentTime - bossLastHitTime > 500) {
              setBossLastHitTime(currentTime);
              setBossHealth(prev => {
                const newHealth = prev - 1;
                
                // Trigger muito mais forte quando o boss é atingido
                triggerShake(25);
                triggerFlash(100);
                createParticles(ent.x + ent.width/2, ent.y + ent.height/2, 50, COLORS.RED, 15);
                
                if (newHealth <= 0) {
                  // Boss defeated
                  createParticles(ent.x + ent.width/2, ent.y + ent.height/2, 100, COLORS.GOLD, 20);
                  playSound('win');
                  unlockAchievement('boss_defeated', 'VENCEDOR DO BOSS');
                  
                  setTimeout(() => {
                    if (currentLevelIdx === LEVELS.length - 1) {
                      setGameState(GameState.WIN_TROLL);
                    } else {
                      setCurrentLevelIdx(prev => prev + 1);
                    }
                  }, 1000);
                } else {
                  // Reposition boss and player
                  const newBossX = Math.random() * 500 + 200;
                  const newBossY = Math.random() * 200 + 50;
                  ent.x = newBossX;
                  ent.y = newBossY;
                  
                  createParticles(newBossX + ent.width/2, newBossY + ent.height/2, 30, COLORS.RED, 10);
                  
                  // Reset player position
                  p.x = 50;
                  p.y = 300;
                  p.vx = 0;
                  p.vy = 0;
                }
                return newHealth;
              });
            }
          } else {
            // Normal level completion
            createParticles(ent.x + ent.width/2, ent.y + ent.height/2, 30, COLORS.GOLD, 8);
            playSound('win');
            
            if (currentLevelIdx === LEVELS.length - 1) {
              setGameState(GameState.WIN_TROLL);
            } else {
              setCurrentLevelIdx(prev => prev + 1);
            }
          }
        }
        
        if (ent.type === 'BUTTON') { 
          setDoorOpen(true); 
          ent.color = COLORS.GOLD;
          createParticles(ent.x + ent.width/2, ent.y + ent.height/2, 20, COLORS.GOLD, 5);
        }
      }

      // Shy button mechanic
      if (ent.type === 'BUTTON' && level.mechanic === 'SHY_BUTTON') {
        const dx = ent.x + ent.width/2 - mouseRef.current.x;
        const dy = ent.y + ent.height/2 - mouseRef.current.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 150) {
          ent.x += (dx/dist) * 10 * dt; 
          ent.y += (dy/dist) * 10 * dt;
          if (ent.x < 0 || ent.x > 760) ent.x = Math.random() * 700;
          if (ent.y < 0 || ent.y > 340) ent.y = Math.random() * 300;
        }
      }

      // Drifting door mechanic
      if (ent.type === 'GOAL' && level.mechanic === 'DRIFTING_DOOR') {
        ent.y = 150 + Math.sin(time / 500) * 100;
        ent.x = 600 + Math.cos(time / 1000) * 100;
      }
    });

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [gameState, currentLevelIdx, doorOpen, die, gravityInverted, bossLastHitTime, triggerShake, triggerFlash, createParticles, playSound, updatePlayerTrail, invulnerable, unlockAchievement]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Aplicar screen shake
    const shakeX = screenShakeRef.current.intensity > 0 ? 
      (Math.random() - 0.5) * screenShakeRef.current.intensity * 2 : 0;
    const shakeY = screenShakeRef.current.intensity > 0 ? 
      (Math.random() - 0.5) * screenShakeRef.current.intensity * 2 : 0;
    
    ctx.save();
    ctx.translate(shakeX, shakeY);
    
    // Clear canvas with current background color
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = currentLevel.bgColor || COLORS.PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenhar trail do jogador
    playerTrail.forEach((pos, i) => {
      ctx.globalAlpha = pos.alpha;
      ctx.fillStyle = invulnerable ? '#ff9900' : COLORS.INK;
      ctx.fillRect(
        pos.x - 8, 
        pos.y - 12, 
        16 * (1 - i/10), 
        24 * (1 - i/10)
      );
    });
    ctx.globalAlpha = 1.0;

    // Draw entities
    entitiesRef.current.forEach(ent => {
      if (ent.type === 'GOAL') {
        ctx.save();
        ctx.translate(ent.x + ent.width/2, ent.y + ent.height/2);
        const time = Date.now() / 1000;
        ctx.rotate(Math.sin(time) * 0.1);
        
        if (doorOpen) {
          // Draw boss/enemy
          ctx.fillStyle = COLORS.RED;
          ctx.beginPath(); 
          ctx.ellipse(0, 0, ent.width/2, ent.height/2, 0, 0, Math.PI * 2); 
          ctx.fill();
          
          ctx.fillStyle = COLORS.WHITE;
          ctx.beginPath(); 
          ctx.ellipse(0, 0, ent.width/3, ent.height/4, 0, 0, Math.PI * 2); 
          ctx.fill();
          
          ctx.fillStyle = COLORS.INK;
          ctx.beginPath(); 
          ctx.arc(Math.sin(time*2)*5, 0, 8, 0, Math.PI * 2); 
          ctx.fill();
          
          // Draw boss health for boss fight
          if (currentLevel.mechanic === 'BOSS_FIGHT') {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Courier';
            ctx.textAlign = 'center';
            ctx.fillText("HP:" + bossHealth, 0, -70);
            
            // Health bar
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-30, -80, 60, 8);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(-30, -80, (bossHealth / 3) * 60, 8);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(-30, -80, 60, 8);
          }
        } else {
          // Draw locked door
          ctx.fillStyle = '#444';
          ctx.fillRect(-ent.width/2, -ent.height/2, ent.width, ent.height);
        }
        ctx.restore();
      } else if (ent.type === 'PLATFORM') {
        if (ent.color !== 'transparent') {
          ctx.fillStyle = ent.color;
          ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
          ctx.strokeStyle = '#fff'; 
          ctx.lineWidth = 1;
          ctx.beginPath(); 
          ctx.moveTo(ent.x, ent.y + ent.height/2); 
          ctx.lineTo(ent.x + ent.width, ent.y + ent.height/2); 
          ctx.stroke();
        }
      } else if (ent.type === 'TRAP') {
        ctx.fillStyle = COLORS.INK;
        for(let i=0; i<ent.width; i+=10) {
          ctx.beginPath(); 
          ctx.moveTo(ent.x + i, ent.y + ent.height); 
          ctx.lineTo(ent.x + i + 5, ent.y); 
          ctx.lineTo(ent.x + i + 10, ent.y + ent.height); 
          ctx.fill();
        }
      } else {
        ctx.fillStyle = ent.color;
        ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
      }
    });

    // Draw projectiles
    projectilesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x + p.width/2, p.y + p.height/2, p.width/2, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow effect for projectiles
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw particles
    particles.forEach(particle => {
      ctx.globalAlpha = particle.life;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw player
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.x + p.width/2, p.y + p.height/2);
    
    // Piscar quando invulnerável
    if (invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
      ctx.globalAlpha = 0.5;
    }
    
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
    ctx.fillStyle = COLORS.WHITE;
    ctx.beginPath(); 
    ctx.arc(0, -p.height/4, 12, 0, Math.PI * 2); 
    ctx.fill();
    ctx.fillStyle = COLORS.INK;
    ctx.beginPath(); 
    ctx.arc(0, -p.height/4, 4, 0, Math.PI * 2); 
    ctx.fill();
    
    // Indicador de gravidade invertida
    if (gravityInverted) {
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.moveTo(-p.width/2, -p.height/2);
      ctx.lineTo(p.width/2, -p.height/2);
      ctx.lineTo(0, -p.height/2 - 10);
      ctx.fill();
    }
    
    ctx.restore();

    ctx.restore(); // Restaurar transformação do shake
    
    // Efeito de flash (sobreposto)
    if (flashEffect) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [update]);

  const handleLevelSelect = (idx: number) => {
    if (idx <= maxReachedIdx) {
      setCurrentLevelIdx(idx);
      setGameState(GameState.PLAYING);
    }
  };

  const handleVerdictPredefined = () => {
    if (!playerInput.trim()) {
        setDadaVerdict({ allow: false, reason: "O silêncio é a língua dos mortos. Tente gritar letras." });
        return;
    }
    setIsLoading(true);
    setTimeout(() => {
        setDadaVerdict({ allow: true, reason: DADA_RESPONSES[Math.floor(Math.random() * DADA_RESPONSES.length)] });
        setIsLoading(false);
        setTimeout(() => {
            if (currentLevelIdx === LEVELS.length - 1) setGameState(GameState.WIN_TROLL);
            else setCurrentLevelIdx(prev => prev + 1);
        }, 1500);
    }, 800);
  };

  const handlePhaseCounterClick = () => {
    if (currentLevel.id === 9) setCurrentLevelIdx(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 md:p-4 relative overflow-hidden select-none touch-none" style={{
      transform: `translate(${shakeAmount * (Math.random() - 0.5) * 0.5}px, ${shakeAmount * (Math.random() - 0.5) * 0.5}px)`,
      transition: 'transform 0.05s linear'
    }}>
      
      {/* Top Bar */}
      <div className="fixed top-0 left-0 w-full p-2 md:p-4 flex justify-between items-start z-[100] pointer-events-none">
        <div 
          onClick={() => setGameState(GameState.LEVEL_SELECT)}
          className="bg-black text-white p-2 md:p-3 border-2 md:border-4 border-white shadow-[4px_4px_0px_black] pointer-events-auto cursor-pointer hover:bg-red-600 transition-colors"
        >
          <p className="font-black text-[10px] md:text-sm uppercase leading-tight">
            FASE: <span 
              className="text-xl md:text-2xl cursor-pointer hover:underline text-yellow-400 p-1" 
              onClick={(e) => { e.stopPropagation(); handlePhaseCounterClick(); }}
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
                    onClick={() => setShowHelp(!showHelp)}
                    className="bg-red-600 text-white px-4 py-2 border-4 border-black pointer-events-auto font-black text-sm shadow-[4px_4px_0px_white] hover:bg-black transition-all"
                >
                    {showHelp ? "VOLTAR" : "SOCORRO"}
                </button>
            )}
        </div>
      </div>

      {/* Popup de conquista */}
      {showAchievement && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[200] animate-bounce">
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black p-4 md:p-6 border-4 md:border-8 border-black shadow-[10px_10px_0px_rgba(0,0,0,0.5)]">
            <div className="text-center">
              <p className="text-xl md:text-3xl font-black mb-2">🎉 CONQUISTA!</p>
              <p className="text-lg md:text-2xl font-bold">{showAchievement}</p>
            </div>
          </div>
        </div>
      )}

      {gameState === GameState.START && (
        <div className="z-10 text-center space-y-4 md:space-y-8 max-w-xl bg-white p-6 md:p-12 border-[8px] border-black shadow-[15px_15px_0px_0px_rgba(0,0,0,1)] relative mx-4">
          <div className="absolute -top-12 -left-12 bg-red-600 text-white p-6 rotate-[-10deg] font-black text-4xl border-4 border-black dada-shake">DADA!</div>
          <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-none">DADA<br/><span className="bg-black text-white px-2">TROLL</span></h1>
          <p className="text-sm md:text-xl italic font-serif text-gray-800">Seu progresso é eterno no navegador.</p>
          <button 
            onClick={() => setGameState(GameState.PLAYING)}
            className="w-full px-6 py-4 md:px-12 md:py-6 bg-black text-white text-2xl md:text-4xl font-black transition-all hover:bg-red-600 border-4 border-black shadow-[8px_8px_0px_#bc2a1e]"
          >
            CONTINUAR
          </button>
        </div>
      )}

      {gameState === GameState.LEVEL_SELECT && (
        <div className="z-[110] bg-white p-6 md:p-12 border-8 border-black shadow-[15px_15px_0px_black] max-w-3xl w-full max-h-[90vh] overflow-y-auto mx-4">
          <h2 className="text-3xl md:text-6xl font-black mb-8 border-b-8 border-black pb-4 uppercase">Mapeamento do Caos</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 md:gap-4">
            {LEVELS.map((lvl, idx) => {
              const unlocked = idx <= maxReachedIdx;
              return (
                <button
                  key={lvl.id}
                  onClick={() => handleLevelSelect(idx)}
                  disabled={!unlocked}
                  className={`h-16 md:h-24 flex flex-col items-center justify-center border-4 font-black text-xl md:text-2xl transition-all ${
                    unlocked ? 'bg-black text-white border-black hover:bg-red-600 cursor-pointer' : 'bg-gray-300 text-gray-500 border-gray-400'
                  }`}
                >
                  {lvl.id}
                </button>
              );
            })}
          </div>
          <button onClick={() => setGameState(GameState.START)} className="mt-8 px-8 py-3 bg-red-600 text-white font-black border-4 border-black uppercase">Voltar</button>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <>
          <div className="z-10 flex flex-col items-center w-full mb-2 md:mb-6">
            <div className="text-center max-w-2xl bg-white p-2 border-2 border-black rotate-[-1deg] mx-2 shadow-md">
              <div className="bg-black text-white px-4 py-1 mb-1">
                <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest leading-none">{currentLevel.title}</h2>
              </div>
              <p className="text-sm md:text-xl italic font-serif text-black font-bold">"{dadaQuote}"</p>
            </div>
          </div>

          <div className="z-10 flex flex-col items-center w-full">
            <div className="relative border-[8px] md:border-[16px] border-black shadow-[20px_20px_0px_rgba(0,0,0,0.2)] bg-white overflow-hidden max-w-[95vw]">
              
              {showHelp && (
                <div className="absolute inset-0 bg-white z-[90] p-6 md:p-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-200">
                  <h3 className="text-4xl md:text-6xl font-black text-black mb-6 uppercase border-b-8 border-black">O Oráculo Diz:</h3>
                  <p className="text-xl md:text-3xl font-black leading-tight text-red-600 mb-10 bg-black p-4 inline-block">{currentLevel.solution}</p>
                  <button onClick={() => setShowHelp(false)} className="bg-black text-white px-12 py-5 font-black uppercase text-2xl border-4 border-red-600 hover:bg-red-600 transition-colors">IGNORAR</button>
                </div>
              )}

              {currentLevel.mechanic === 'GEMINI_SAYS' && (
                <div className="absolute inset-0 bg-black z-50 flex flex-col items-center justify-center p-4 md:p-12 text-center text-white">
                  <h3 className="text-3xl md:text-6xl font-black mb-4 text-yellow-400 uppercase">O Juiz de Tinta</h3>
                  <p className="text-sm md:text-xl mb-6 italic">"O silêncio é uma arma branca. O que você tem a dizer?"</p>
                  <input 
                    type="text" 
                    autoFocus 
                    value={playerInput} 
                    onChange={(e) => setPlayerInput(e.target.value)} 
                    className="w-full p-4 border-4 border-white text-xl md:text-3xl font-bold mb-6 bg-transparent text-white outline-none text-center" 
                    placeholder="..." 
                  />
                  <button 
                    onClick={handleVerdictPredefined} 
                    disabled={isLoading} 
                    className="px-12 py-4 bg-white text-black text-2xl font-black hover:bg-red-600 transition-all uppercase"
                  >
                    {isLoading ? "Processando..." : "ENVIAR"}
                  </button>
                  {dadaVerdict && (
                    <div className="mt-4 p-4 border-4 border-dashed border-white bg-red-900">
                      <p className="text-xl md:text-2xl font-black">{dadaVerdict.reason}</p>
                    </div>
                  )}
                </div>
              )}

              <canvas 
                ref={canvasRef} 
                width={800} 
                height={400} 
                className="w-full h-auto aspect-[2/1] bg-white cursor-none"
              />

              {!isMobile && (
                <div className="fixed pointer-events-none z-[200] text-3xl md:text-5xl mix-blend-difference drop-shadow-lg"
                  style={{ 
                    left: mouseRef.current.x + (canvasRef.current?.getBoundingClientRect().left || 0) - 20, 
                    top: mouseRef.current.y + (canvasRef.current?.getBoundingClientRect().top || 0) - 20 
                  }}
                >
                  👁️‍🗨️
                </div>
              )}
            </div>

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
        </>
      )}

      {isMobile && gameState === GameState.PLAYING && (
        <div className="fixed bottom-4 left-0 w-full flex justify-between px-4 sm:px-6 z-[120] pointer-events-none">
          <div className="flex gap-2 sm:gap-4 pointer-events-auto">
            <button 
              onTouchStart={(e) => { e.preventDefault(); handleTouchStart('left'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('left'); }}
              className="w-12 h-12 sm:w-16 sm:h-16 bg-black/90 border-2 sm:border-4 border-white text-white font-black text-2xl sm:text-3xl flex items-center justify-center active:bg-red-600 rounded-full shadow-lg"
            >
              ←
            </button>
            <button 
              onTouchStart={(e) => { e.preventDefault(); handleTouchStart('right'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('right'); }}
              className="w-12 h-12 sm:w-16 sm:h-16 bg-black/90 border-2 sm:border-4 border-white text-white font-black text-2xl sm:text-3xl flex items-center justify-center active:bg-red-600 rounded-full shadow-lg"
            >
              →
            </button>
          </div>
          <div className="pointer-events-auto">
            <button 
              onTouchStart={(e) => { e.preventDefault(); handleTouchStart('jump'); }}
              onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('jump'); }}
              className="w-14 h-14 sm:w-20 sm:h-20 bg-black/90 border-2 sm:border-4 border-white text-white font-black text-lg sm:text-xl flex items-center justify-center active:bg-blue-600 rounded-full shadow-lg uppercase px-2"
            >
              PULO
            </button>
          </div>
        </div>
      )}

      {gameState === GameState.WIN_TROLL && (
        <div className="z-[130] text-center bg-white p-8 md:p-20 border-[12px] border-black shadow-[30px_30px_0px_rgba(255,0,0,0.5)] max-w-3xl mx-4">
          <h1 className="text-5xl md:text-9xl font-black mb-8 leading-none uppercase">VITÓRIA<br/>DADAISTA</h1>
          <p className="text-lg md:text-3xl mb-12 italic text-black font-serif">A conformidade morreu. Você completou o ciclo do absurdo.</p>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-12 py-6 bg-red-600 text-white text-3xl font-black border-8 border-black uppercase hover:bg-black transition-all">ZERAR TUDO</button>
        </div>
      )}
    </div>
  );
};

export default App;
