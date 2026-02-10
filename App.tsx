// App.tsx CORRIGIDO - Fases 4, 13, 14 e pulo
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, LevelConfig, Entity } from './types';
import { LEVELS, COLORS, DADA_RESPONSES } from './constants';

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
  const [glitchActive, setGlitchActive] = useState(false);
  const [touchControls, setTouchControls] = useState({
    left: false,
    right: false,
    jump: false
  });
  const [canDoubleJump, setCanDoubleJump] = useState(true);
  const [hasJumped, setHasJumped] = useState(false);
  const [jumpCooldown, setJumpCooldown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const lastUpdateRef = useRef<number>(0);
  const shakeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const glitchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const playerRef = useRef<Entity>({
    x: 50, y: 300, width: 32, height: 48, color: COLORS.INK, vx: 0, vy: 0, type: 'PLAYER', scale: 1
  });
  const entitiesRef = useRef<Entity[]>([]);
  const projectilesRef = useRef<Entity[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef({ x: 0, y: 0 });

  const currentLevel = LEVELS[currentLevelIdx];

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    localStorage.setItem('dada_level', currentLevelIdx.toString());
    localStorage.setItem('dada_max', Math.max(maxReachedIdx, currentLevelIdx).toString());
    localStorage.setItem('dada_deaths', deaths.toString());
    if (currentLevelIdx > maxReachedIdx) setMaxReachedIdx(currentLevelIdx);
  }, [currentLevelIdx, deaths, maxReachedIdx]);

  const die = useCallback(() => {
    setDeaths(d => d + 1);
    playerRef.current.x = 50;
    playerRef.current.y = gravityInverted ? 50 : 300;
    playerRef.current.vx = 0;
    playerRef.current.vy = 0;
    playerRef.current.scale = 1;
    playerRef.current.width = 32;
    playerRef.current.height = 48;
    setHasJumped(false);
    setCanDoubleJump(true);
    setJumpCooldown(false);
    projectilesRef.current = [];
    if (currentLevelIdx === 19) {
      setBossHealth(3);
      setBossLastHitTime(0);
    }
  }, [currentLevelIdx, gravityInverted]);

  const triggerShake = useCallback((intensity: number, duration: number = 200) => {
    setShakeAmount(intensity);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    const timer = setTimeout(() => setShakeAmount(0), duration);
    shakeTimerRef.current = timer;
  }, []);

  const initLevel = useCallback((idx: number) => {
    const level = LEVELS[idx];
    const startY = level.mechanic === 'GRAVITY_SWAP' ? 50 : 300;
    playerRef.current = { 
      ...playerRef.current, 
      x: 50, 
      y: startY, 
      vx: 0, 
      vy: 0, 
      scale: 1,
      width: 32,
      height: 48
    };
    setDoorOpen(level.mechanic !== 'SHY_BUTTON');
    setShowHelp(false);
    setDadaVerdict(null);
    setPlayerInput("");
    setGravityInverted(level.mechanic === 'GRAVITY_SWAP');
    setBossHealth(3);
    setBossLastHitTime(0);
    setShakeAmount(0);
    setGlitchActive(false);
    setHasJumped(false);
    setCanDoubleJump(true);
    setJumpCooldown(false);
    projectilesRef.current = [];
    
    // Clear any existing intervals
    if (glitchIntervalRef.current) {
      clearInterval(glitchIntervalRef.current);
      glitchIntervalRef.current = null;
    }
    
    const platforms: Entity[] = [
      { x: 0, y: 380, width: 800, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: 'PLATFORM', isSolid: true },
      { x: 720, y: 280, width: 50, height: 100, color: COLORS.RED, vx: 0, vy: 0, type: 'GOAL' }
    ];

    // FASE 4 CORRIGIDA: GRAVITY_SWAP - Mais jogável
    if (idx === 3) { // Fase 4
      platforms[0] = { x: 0, y: 0, width: 800, height: 20, color: COLORS.INK, vx: 0, vy: 0, type: 'PLATFORM', isSolid: true }; // Teto
      platforms[1] = { x: 720, y: 50, width: 50, height: 100, color: COLORS.RED, vx: 0, vy: 0, type: 'GOAL' }; // Portal no teto
      // Plataformas no "teto" para facilitar
      platforms.push({ x: 200, y: 60, width: 100, height: 15, color: '#2a4d69', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true });
      platforms.push({ x: 450, y: 60, width: 100, height: 15, color: '#2a4d69', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true });
    }
    
    // FASE 6 (SIZE_SHIFT)
    if (idx === 5) {
      platforms.push({ 
        x: 350, y: 340, width: 100, height: 40, color: '#2a4d69', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true 
      });
      platforms[1] = { x: 720, y: 300, width: 50, height: 80, color: COLORS.RED, vx: 0, vy: 0, type: 'GOAL' };
    }
    
    // FASE 13 (TIME_DILATION) - CORRIGIDA: Mais jogável
    if (idx === 12) {
      // Remove traps para facilitar
      platforms[1] = { x: 750, y: 280, width: 30, height: 100, color: COLORS.RED, vx: 0, vy: 0, type: 'GOAL' }; // Portal menor
      // Adiciona plataformas de ajuda
      platforms.push({ x: 400, y: 350, width: 80, height: 15, color: '#d4a373', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true });
      platforms.push({ x: 600, y: 320, width: 80, height: 15, color: '#d4a373', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true });
    }
    
    // Obstáculos básicos (exceto nas fases específicas)
    if (idx >= 2 && idx !== 3 && idx !== 5 && idx !== 12 && idx !== 13 && idx !== 18) {
      platforms.push({ 
        x: 300, y: 365, width: 60, height: 15, color: COLORS.TRAP, vx: 0, vy: 0, type: 'TRAP', isSolid: true 
      });
    }
    
    if (idx >= 6 && idx !== 12 && idx !== 13 && idx !== 15 && idx !== 18) {
      platforms.push({ 
        x: 500, y: 365, width: 60, height: 15, color: COLORS.TRAP, vx: 0, vy: 0, type: 'TRAP', isSolid: true 
      });
    }
    
    // FASE 14 (PHANTOM_PLATFORMS) - CORRIGIDA: Agora funciona
    if (idx === 13) {
      // Remove traps padrão
      platforms.pop();
      platforms.pop();
      // Plataforma fantasma no meio
      platforms.push({ 
        x: 300, y: 320, width: 200, height: 20, color: COLORS.GOLD, vx: 0, vy: 0, type: 'PLATFORM', isSolid: false,
        phantom: true
      });
      // Plataformas sólidas para ajudar
      platforms.push({ x: 150, y: 350, width: 80, height: 15, color: '#2a4d69', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true });
      platforms.push({ x: 550, y: 300, width: 80, height: 15, color: '#2a4d69', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true });
    }
    
    // FASE 16 - Labirinto do Ócio
    if (idx === 15) {
      platforms.push({ 
        x: 150, y: 280, width: 80, height: 20, color: '#d4a373', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true
      });
      platforms.push({ 
        x: 300, y: 220, width: 80, height: 20, color: '#d4a373', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true
      });
      platforms.push({ 
        x: 450, y: 160, width: 80, height: 20, color: '#d4a373', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true
      });
    }
    
    // SHY_BUTTON
    if (level.mechanic === 'SHY_BUTTON') {
      platforms.push({ 
        x: 400, y: 250, width: 40, height: 40, color: COLORS.BLUE, vx: 0, vy: 0, type: 'BUTTON', isSolid: false 
      });
      setDoorOpen(false);
    }
    
    // INVISIBLE_WALLS
    if (level.mechanic === 'INVISIBLE_WALLS') {
      platforms.push({ 
        x: 250, y: 200, width: 30, height: 180, color: 'transparent', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true 
      });
      platforms.push({ 
        x: 450, y: 150, width: 30, height: 230, color: 'transparent', vx: 0, vy: 0, type: 'PLATFORM', isSolid: true 
      });
    }
    
    // GLITCH_MAZE
    if (level.mechanic === 'GLITCH_MAZE') {
      const glitchPositions = [
        { x: 200, y: 320 }, { x: 350, y: 280 }, { x: 500, y: 240 },
        { x: 150, y: 200 }, { x: 300, y: 160 }, { x: 450, y: 120 }
      ];
      
      glitchPositions.forEach(pos => {
        const isSolid = Math.random() > 0.5;
        platforms.push({
          x: pos.x,
          y: pos.y,
          width: 60,
          height: 15,
          color: isSolid ? '#4a5568' : '#718096',
          vx: 0,
          vy: 0,
          type: 'PLATFORM',
          isSolid: isSolid
        });
      });
      
      glitchIntervalRef.current = setInterval(() => {
        setGlitchActive(prev => !prev);
        entitiesRef.current.forEach((ent, index) => {
          if (ent.type === 'PLATFORM' && index >= 2 && index <= 7) {
            ent.isSolid = !ent.isSolid;
            ent.color = ent.isSolid ? '#4a5568' : '#718096';
          }
        });
      }, 800);
    }
    
    // Fase 19 - O Pulo do Niilista (plataformas invisíveis + vento)
    if (idx === 18) {
      const invisiblePlatforms = [
        { x: 200, y: 320, width: 60, height: 15 },
        { x: 350, y: 270, width: 60, height: 15 },
        { x: 500, y: 220, width: 60, height: 15 },
        { x: 280, y: 180, width: 60, height: 15 },
        { x: 430, y: 130, width: 60, height: 15 }
      ];
      
      invisiblePlatforms.forEach(pos => {
        platforms.push({
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
          color: 'rgba(212, 163, 115, 0.3)',
          vx: 0,
          vy: 0,
          type: 'PLATFORM',
          isSolid: true
        });
      });
    }
    
    // BOSS_FIGHT
    if (level.mechanic === 'BOSS_FIGHT') {
      platforms[1] = { 
        x: 650, 
        y: 100, 
        width: 80, 
        height: 140, 
        color: '#8B0000', 
        vx: 0, 
        vy: 0, 
        type: 'GOAL', 
        health: 3 
      };
    }

    entitiesRef.current = platforms;
    setDadaQuote(DADA_RESPONSES[Math.floor(Math.random() * DADA_RESPONSES.length)]);
  }, []);

  useEffect(() => {
    if (gameState === GameState.PLAYING) initLevel(currentLevelIdx);
    return () => {
      if (glitchIntervalRef.current) {
        clearInterval(glitchIntervalRef.current);
        glitchIntervalRef.current = null;
      }
    };
  }, [gameState, currentLevelIdx, initLevel]);

  const handleKeyDown = (e: KeyboardEvent) => { 
    keysRef.current[e.code] = true; 
  };
  
  const handleKeyUp = (e: KeyboardEvent) => { 
    keysRef.current[e.code] = false; 
  };
  
  const handleTouchControl = (key: string, pressed: boolean) => { 
    keysRef.current[key] = pressed; 
    setTouchControls(prev => ({
      ...prev,
      left: key === 'TouchLeft' ? pressed : prev.left,
      right: key === 'TouchRight' ? pressed : prev.right,
      jump: key === 'TouchJump' ? pressed : prev.jump
    }));
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

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (currentLevel.mechanic === 'DUAL_CONTACT' && gameState === GameState.PLAYING) {
      const goal = entitiesRef.current.find(ent => ent.type === 'GOAL');
      const p = playerRef.current;
      
      if (goal && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;
        
        const mouseOverGoal = mouseX > goal.x && 
                             mouseX < goal.x + goal.width && 
                             mouseY > goal.y && 
                             mouseY < goal.y + goal.height;
        
        const playerTouchingGoal = p.x < goal.x + goal.width && 
                                  p.x + p.width > goal.x && 
                                  p.y < goal.y + goal.height && 
                                  p.y + p.height > goal.y;
        
        if (mouseOverGoal && playerTouchingGoal) {
          triggerShake(5);
          goal.color = COLORS.GOLD;
          
          setTimeout(() => {
            if (currentLevelIdx === LEVELS.length - 1) {
              setGameState(GameState.WIN_TROLL);
            } else {
              setCurrentLevelIdx(prev => prev + 1);
            }
          }, 500);
        } else if (mouseOverGoal || playerTouchingGoal) {
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

  const update = useCallback((time: number) => {
    if (gameState !== GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(update);
      return;
    }
    
    const dt = time - lastUpdateRef.current;
    lastUpdateRef.current = time;

    const p = playerRef.current;
    const level = LEVELS[currentLevelIdx];
    const speed = 5;
    
    // Mecânica SIZE_SHIFT
    if (level.mechanic === 'SIZE_SHIFT') {
      const scaleTime = Math.floor(time / 1000) % 2;
      if (scaleTime === 0) {
        p.scale = 0.6;
        p.width = 20;
        p.height = 30;
      } else {
        p.scale = 1.0;
        p.width = 32;
        p.height = 48;
      }
    }
    
    // Mecânica SCREEN_SHAKE
    if (level.mechanic === 'SCREEN_SHAKE') {
      const shakeIntensity = 3 + Math.sin(time / 250) * 2;
      setShakeAmount(shakeIntensity);
    }
    
    // Mecânica GRAVITY_TICK
    if (level.mechanic === 'GRAVITY_TICK') {
      if (Math.floor(time / 1500) % 2 === 0) setGravityInverted(false);
      else setGravityInverted(true);
    }

    let gravity = gravityInverted ? -0.4 : 0.4;
    const jumpPower = gravityInverted ? 12 : -13; // Pulo mais forte

    let moveX = 0;
    if (keysRef.current['ArrowLeft'] || keysRef.current['KeyA'] || keysRef.current['TouchLeft']) moveX -= 1;
    if (keysRef.current['ArrowRight'] || keysRef.current['KeyD'] || keysRef.current['TouchRight']) moveX += 1;
    if (level.mechanic === 'REVERSE') moveX *= -1;

    p.vx = moveX * speed;
    
    // VENTO AFETADO
    if (level.mechanic === 'WIND_AFFECTED' || currentLevelIdx === 18) {
      p.vx -= 2.5;
    }
    
    if (level.mechanic === 'MOVE_ONLY_IF_MOVE' && moveX === 0) {
      gravity = 0;
      p.vy = 0;
    }

    p.vy += gravity;

    // FASE 13 (TIME_DILATION) - CORRIGIDA: Efeito mais suave
    let deltaMultiplier = 1;
    if (level.mechanic === 'TIME_DILATION') {
      // Efeito começa mais tarde e é menos severo
      const slowStart = 400;
      if (p.x > slowStart) {
        const progress = (p.x - slowStart) / (800 - slowStart);
        deltaMultiplier = Math.max(0.3, 1 - progress * 0.7);
      }
    }

    p.x += p.vx * deltaMultiplier;
    p.y += p.vy * deltaMultiplier;

    // SISTEMA DE PULO MELHORADO: Pulo normal + 1 pulo no ar
    const onFloor = gravityInverted ? p.y <= 10 : p.y >= 330;
    
    // Verifica colisão com plataformas para ver se está no chão
    let isOnPlatform = false;
    entitiesRef.current.forEach(ent => {
      if (ent.type === 'PLATFORM' && ent.isSolid) {
        const touchingPlatform = p.x < ent.x + ent.width && 
                                p.x + p.width > ent.x && 
                                p.y + p.height >= ent.y - 1 && 
                                p.y + p.height <= ent.y + 5;
        if (touchingPlatform && p.vy >= 0) {
          isOnPlatform = true;
        }
      }
    });
    
    const isGrounded = onFloor || isOnPlatform;
    
    if (isGrounded) {
      setHasJumped(false);
      setCanDoubleJump(true);
      setJumpCooldown(false);
    }
    
    const jumpPressed = keysRef.current['ArrowUp'] || keysRef.current['Space'] || keysRef.current['KeyW'] || keysRef.current['TouchJump'];
    
    if (jumpPressed && !jumpCooldown) {
      if (isGrounded) {
        p.vy = jumpPower;
        setHasJumped(true);
        setJumpCooldown(true);
        setTimeout(() => setJumpCooldown(false), 300);
      } else if (canDoubleJump && !hasJumped) {
        p.vy = jumpPower * 0.9; // Pulo no ar quase tão bom quanto no chão
        setCanDoubleJump(false);
        setHasJumped(true);
        setJumpCooldown(true);
        setTimeout(() => setJumpCooldown(false), 300);
      }
    }

    // Boss Projectiles
    if (level.mechanic === 'BOSS_FIGHT' && Math.random() < 0.025) {
      const goal = entitiesRef.current.find(e => e.type === 'GOAL');
      if (goal) {
        projectilesRef.current.push({
          x: goal.x, 
          y: goal.y + Math.random() * goal.height, 
          width: 15, 
          height: 15, 
          color: '#8B0000', 
          vx: -5,
          vy: (Math.random() - 0.5) * 5,
          type: 'PROJECTILE'
        });
      }
    }

    // Update projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const proj = projectilesRef.current[i];
      proj.x += proj.vx; 
      proj.y += proj.vy;
      
      if (proj.x < -50 || proj.x > 850 || proj.y < -50 || proj.y > 450) {
        projectilesRef.current.splice(i, 1);
        continue;
      }
      
      if (p.x < proj.x + proj.width && 
          p.x + p.width > proj.x && 
          p.y < proj.y + proj.height && 
          p.y + p.height > proj.y) {
        triggerShake(10);
        projectilesRef.current.splice(i, 1);
        die();
        break;
      }
    }

    // Screen boundaries
    if (p.x < 0) p.x = 0;
    if (p.x + p.width > 800) p.x = 800 - p.width;
    
    // Para gravidade invertida, limites diferentes
    if (gravityInverted) {
      if (p.y < -200) die();
      if (p.y > 600) p.y = 600;
    } else {
      if (p.y < -200) p.y = -200;
      if (p.y > 600) die();
    }

    // Mecânica PHANTOM_PLATFORMS - CORRIGIDA: Funciona agora
    if (level.mechanic === 'PHANTOM_PLATFORMS') {
      entitiesRef.current.forEach((ent, index) => {
        if (ent.type === 'PLATFORM' && 'phantom' in ent) {
          // Alterna entre sólida e fantasma baseado na posição Y do player
          if (p.y > ent.y - 50 && p.y < ent.y + 50) {
            // Quando player está perto, plataforma é sólida
            ent.isSolid = true;
            ent.color = COLORS.GOLD;
          } else {
            // Quando player está longe, plataforma é fantasma
            ent.isSolid = false;
            ent.color = 'rgba(212, 163, 115, 0.3)';
          }
        }
      });
    }

    // Check collisions with entities
    entitiesRef.current.forEach((ent, index) => {
      // SHY_BUTTON
      if (ent.type === 'BUTTON' && level.mechanic === 'SHY_BUTTON') {
        const dx = ent.x + ent.width/2 - p.x;
        const dy = ent.y + ent.height/2 - p.y;
        const distToPlayer = Math.sqrt(dx*dx + dy*dy);
        
        if (distToPlayer < 120) {
          ent.x += (dx/distToPlayer) * 6;
          ent.y += (dy/distToPlayer) * 6;
        }
        
        const dxMouse = ent.x + ent.width/2 - mouseRef.current.x;
        const dyMouse = ent.y + ent.height/2 - mouseRef.current.y;
        const distToMouse = Math.sqrt(dxMouse*dxMouse + dyMouse*dyMouse);
        
        if (distToMouse < 80) {
          ent.x -= (dxMouse/distToMouse) * 4;
          ent.y -= (dyMouse/distToMouse) * 4;
        }
        
        if (ent.x < 100) ent.x = 100;
        if (ent.x > 700) ent.x = 700;
        if (ent.y < 100) ent.y = 100;
        if (ent.y > 300) ent.y = 300;
      }

      const isColliding = p.x < ent.x + ent.width && 
                         p.x + p.width > ent.x && 
                         p.y < ent.y + ent.height && 
                         p.y + p.height > ent.y;
      
      if (isColliding) {
        if (ent.type === 'PLATFORM' && ent.isSolid) {
          if (p.vy > 0 && p.y < ent.y) { 
            p.y = ent.y - p.height; 
            p.vy = 0;
            setHasJumped(false);
            setCanDoubleJump(true);
          } else if (p.vy < 0 && p.y > ent.y) { 
            p.y = ent.y + ent.height; 
            p.vy = 0;
          }
        }
        
        if (ent.type === 'TRAP') {
          triggerShake(8);
          die();
        }
        
        if (ent.type === 'GOAL' && doorOpen && level.id !== 9 && level.mechanic !== 'DUAL_CONTACT') {
          if (level.mechanic === 'SIZE_SHIFT') {
            if (p.scale && p.scale < 0.7) {
              if (currentLevelIdx === LEVELS.length - 1) {
                setGameState(GameState.WIN_TROLL);
              } else {
                setCurrentLevelIdx(prev => prev + 1);
              }
            } else {
              triggerShake(3);
              p.x -= 30;
            }
          } else if (level.mechanic === 'BOSS_FIGHT') {
            const currentTime = Date.now();
            if (currentTime - bossLastHitTime > 500) {
              setBossLastHitTime(currentTime);
              setBossHealth(prev => {
                const newHealth = prev - 1;
                
                triggerShake(15);
                
                if (newHealth <= 0) {
                  setTimeout(() => {
                    setGameState(GameState.WIN_TROLL);
                  }, 1000);
                } else {
                  const newBossX = Math.random() * 400 + 200;
                  const newBossY = Math.random() * 150 + 50;
                  ent.x = newBossX;
                  ent.y = newBossY;
                  
                  p.x = 50;
                  p.y = 300;
                  p.vx = 0;
                  p.vy = 0;
                }
                return newHealth;
              });
            }
          } else {
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
          triggerShake(5);
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
  }, [gameState, currentLevelIdx, doorOpen, die, gravityInverted, bossLastHitTime, triggerShake, glitchActive, hasJumped, canDoubleJump, jumpCooldown]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = currentLevel.bgColor || COLORS.PAPER;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Desenha indicador de vento
    if (currentLevel.mechanic === 'WIND_AFFECTED' || currentLevelIdx === 18) {
      for (let i = 0; i < 15; i++) {
        const x = 50 + i * 50;
        const y = 50 + Math.sin(Date.now() / 500 + i) * 20;
        ctx.fillStyle = 'rgba(99, 179, 237, 0.6)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 15, y);
        ctx.lineTo(x - 10, y - 4);
        ctx.moveTo(x - 15, y);
        ctx.lineTo(x - 10, y + 4);
        ctx.stroke();
      }
    }

    // Indicador de TIME_DILATION
    if (currentLevel.mechanic === 'TIME_DILATION') {
      const slowProgress = Math.max(0, (playerRef.current.x - 400) / 400);
      ctx.fillStyle = `rgba(139, 0, 0, ${0.3 + slowProgress * 0.4})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Texto indicador
      ctx.fillStyle = 'white';
      ctx.font = 'bold 16px Courier';
      ctx.textAlign = 'center';
      ctx.fillText(`VELOCIDADE: ${Math.round((1 - slowProgress * 0.7) * 100)}%`, 400, 30);
    }

    // Draw entities
    entitiesRef.current.forEach(ent => {
      if (ent.type === 'GOAL') {
        ctx.save();
        ctx.translate(ent.x + ent.width/2, ent.y + ent.height/2);
        const time = Date.now() / 1000;
        ctx.rotate(Math.sin(time) * 0.1);
        
        if (doorOpen) {
          ctx.fillStyle = currentLevel.mechanic === 'BOSS_FIGHT' ? '#8B0000' : COLORS.RED;
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
          
          if (currentLevel.mechanic === 'BOSS_FIGHT') {
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Courier';
            ctx.textAlign = 'center';
            ctx.fillText("HP:" + bossHealth, 0, -70);
          }
        } else {
          ctx.fillStyle = '#444';
          ctx.fillRect(-ent.width/2, -ent.height/2, ent.width, ent.height);
          ctx.fillStyle = COLORS.GOLD;
          ctx.fillRect(-10, -5, 20, 15);
          ctx.beginPath();
          ctx.arc(0, -5, 8, 0, Math.PI);
          ctx.fill();
        }
        ctx.restore();
      } else if (ent.type === 'PLATFORM') {
        if (ent.color !== 'transparent') {
          // Plataforma fantasma pisca
          if (currentLevel.mechanic === 'PHANTOM_PLATFORMS' && !ent.isSolid) {
            const alpha = 0.2 + Math.sin(Date.now() / 300) * 0.2;
            ctx.globalAlpha = alpha;
          }
          
          ctx.fillStyle = ent.color;
          ctx.fillRect(ent.x, ent.y, ent.width, ent.height);
          
          if (currentLevel.mechanic === 'GLITCH_MAZE') {
            if (!ent.isSolid) {
              ctx.strokeStyle = '#ff0000';
              ctx.lineWidth = 2;
              ctx.setLineDash([3, 3]);
              ctx.strokeRect(ent.x, ent.y, ent.width, ent.height);
              ctx.setLineDash([]);
            }
          } else if (!(currentLevel.mechanic === 'PHANTOM_PLATFORMS' && !ent.isSolid)) {
            ctx.strokeStyle = '#fff'; 
            ctx.lineWidth = 1;
            ctx.beginPath(); 
            ctx.moveTo(ent.x, ent.y + ent.height/2); 
            ctx.lineTo(ent.x + ent.width, ent.y + ent.height/2); 
            ctx.stroke();
          }
          
          ctx.globalAlpha = 1.0;
        }
      } else if (ent.type === 'TRAP') {
        ctx.fillStyle = ent.color;
        for(let i = 0; i < ent.width; i += 10) {
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
    });

    // Draw player
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.x + p.width/2, p.y + p.height/2);
    
    // Aplica scale para SIZE_SHIFT
    if (p.scale && p.scale !== 1) {
      ctx.scale(p.scale, p.scale);
    }
    
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
    ctx.fillStyle = COLORS.WHITE;
    ctx.beginPath(); 
    ctx.arc(0, -p.height/4, p.scale && p.scale < 1 ? 6 : 10, 0, Math.PI * 2); 
    ctx.fill();
    ctx.fillStyle = COLORS.INK;
    ctx.beginPath(); 
    ctx.arc(0, -p.height/4, p.scale && p.scale < 1 ? 2 : 3, 0, Math.PI * 2); 
    ctx.fill();
    
    // Indicador de tamanho para SIZE_SHIFT
    if (currentLevel.mechanic === 'SIZE_SHIFT') {
      ctx.fillStyle = p.scale && p.scale < 1 ? '#00ff00' : '#ff5555';
      ctx.font = 'bold 12px Courier';
      ctx.textAlign = 'center';
      ctx.fillText(p.scale && p.scale < 1 ? 'PEQUENO' : 'GRANDE', 0, -p.height/2 - 15);
    }
    
    // Indicador de pulo
    if (canDoubleJump && !hasJumped) {
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 10px Courier';
      ctx.textAlign = 'center';
      ctx.fillText('2 PULOS', 0, p.height/2 + 15);
    } else if (!canDoubleJump && hasJumped) {
      ctx.fillStyle = '#ff5555';
      ctx.font = 'bold 10px Courier';
      ctx.textAlign = 'center';
      ctx.fillText('1 PULO', 0, p.height/2 + 15);
    }
    
    ctx.restore();
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => { 
      if (requestRef.current) cancelAnimationFrame(requestRef.current); 
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
    if (currentLevel.id === 9 && gameState === GameState.PLAYING) {
      triggerShake(8);
      
      const phaseElement = document.querySelector('.phase-number');
      if (phaseElement) {
        phaseElement.classList.add('animate-pulse', 'text-red-600');
        setTimeout(() => {
          phaseElement.classList.remove('animate-pulse', 'text-red-600');
        }, 1000);
      }
      
      setTimeout(() => {
        setCurrentLevelIdx(prev => prev + 1);
      }, 800);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-2 md:p-4 relative overflow-hidden select-none touch-none">
      
      {/* Top Bar */}
      <div className="fixed top-0 left-0 w-full p-2 md:p-4 flex justify-between items-start z-[100] pointer-events-none">
        <div 
          onClick={() => setGameState(GameState.LEVEL_SELECT)}
          className="bg-black text-white p-2 md:p-3 border-2 md:border-4 border-white shadow-[4px_4px_0px_black] pointer-events-auto cursor-pointer hover:bg-red-600 transition-colors"
        >
          <p className="font-black text-[10px] md:text-sm uppercase leading-tight">
            FASE: <span 
              className="text-xl md:text-2xl cursor-pointer hover:underline text-yellow-400 p-1 phase-number transition-all duration-300"
              onClick={(e) => { 
                e.stopPropagation(); 
                handlePhaseCounterClick(); 
              }}
              onMouseEnter={(e) => {
                if (currentLevel.id === 9 && gameState === GameState.PLAYING) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'scale(1.2)';
                  el.style.textShadow = '0 0 10px red';
                }
              }}
              onMouseLeave={(e) => {
                if (currentLevel.id === 9 && gameState === GameState.PLAYING) {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform = 'scale(1)';
                  el.style.textShadow = 'none';
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
              onClick={() => setShowHelp(!showHelp)}
              className="bg-red-600 text-white px-4 py-2 border-4 border-black pointer-events-auto font-black text-sm shadow-[4px_4px_0px_white] hover:bg-black transition-all"
            >
              {showHelp ? "VOLTAR" : "SOCORRO"}
            </button>
          )}
        </div>
      </div>

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
                  <span className="text-xs mt-1">{lvl.title.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
          <button onClick={() => setGameState(GameState.START)} className="mt-8 px-8 py-3 bg-red-600 text-white font-black border-4 border-black uppercase">Voltar</button>
        </div>
      )}

      {gameState === GameState.PLAYING && (
        <div 
          className="z-10 flex flex-col items-center w-full transition-transform duration-75" 
          style={{ 
            transform: `translate(${Math.random() * shakeAmount - shakeAmount/2}px, ${Math.random() * shakeAmount - shakeAmount/2}px)`,
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
                <button onClick={handleVerdictPredefined} disabled={isLoading} className="px-12 py-4 bg-white text-black text-2xl font-black hover:bg-red-600 transition-all uppercase">
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
              className="w-full h-auto aspect-[2/1] bg-white"
              style={{ cursor: 'default' }}
            />
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
      )}

      {isMobile && gameState === GameState.PLAYING && (
        <div className="fixed bottom-4 left-0 w-full flex justify-between px-6 z-[120] pointer-events-none">
          <div className="flex gap-4 pointer-events-auto">
            <button 
              onTouchStart={() => handleTouchControl('TouchLeft', true)} 
              onTouchEnd={() => handleTouchControl('TouchLeft', false)} 
              className={`w-16 h-16 border-4 border-white text-white font-black text-3xl flex items-center justify-center rounded-full transition-all ${
                touchControls.left ? 'bg-red-600 scale-90' : 'bg-black/80'
              }`}
            >←</button>
            <button 
              onTouchStart={() => handleTouchControl('TouchRight', true)} 
              onTouchEnd={() => handleTouchControl('TouchRight', false)} 
              className={`w-16 h-16 border-4 border-white text-white font-black text-3xl flex items-center justify-center rounded-full transition-all ${
                touchControls.right ? 'bg-red-600 scale-90' : 'bg-black/80'
              }`}
            >→</button>
          </div>
          <div className="pointer-events-auto">
            <button 
              onTouchStart={() => handleTouchControl('TouchJump', true)} 
              onTouchEnd={() => handleTouchControl('TouchJump', false)} 
              className={`w-20 h-20 border-4 border-white text-white font-black text-xl flex items-center justify-center rounded-full uppercase transition-all ${
                touchControls.jump ? 'bg-blue-600 scale-90' : 'bg-black/80'
              }`}
            >PULO</button>
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
