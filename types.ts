
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  LEVEL_SELECT = 'LEVEL_SELECT',
  WIN_TROLL = 'WIN_TROLL'
}

export type Mechanic = 
  | 'NORMAL' 
  | 'REVERSE' 
  | 'SHY_BUTTON' 
  | 'GRAVITY_SWAP' 
  | 'INVISIBLE_WALLS' 
  | 'GEMINI_SAYS'
  | 'SIZE_SHIFT'
  | 'SCREEN_SHAKE'
  | 'DRIFTING_DOOR'
  | 'WIND_AFFECTED'
  | 'MOVE_ONLY_IF_MOVE'
  | 'TIME_DILATION'
  | 'PHANTOM_PLATFORMS'
  | 'DUAL_CONTACT'
  | 'GRAVITY_TICK'
  | 'GLITCH_MAZE'
  | 'BOSS_FIGHT';

export interface LevelConfig {
  id: number;
  title: string;
  instruction: string;
  rule: string;
  solution: string;
  mechanic: Mechanic;
  bgColor?: string;
}

export interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  vx: number;
  vy: number;
  type: 'PLAYER' | 'PLATFORM' | 'GOAL' | 'TRAP' | 'BUTTON' | 'PROJECTILE';
  scale?: number;
  health?: number;
}
