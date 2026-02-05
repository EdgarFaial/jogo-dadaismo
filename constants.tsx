
import { LevelConfig } from './types';

export const COLORS = {
  PAPER: '#e8e4d9',
  INK: '#1a1a1a',
  RED: '#bc2a1e',
  BLUE: '#2a4d69',
  GOLD: '#d4a373',
  TRAP: '#000000',
  WHITE: '#ffffff',
  YELLOW: '#fef08a'
};

export const DADA_RESPONSES = [
  "O relógio derreteu em sua própria sombra.",
  "A resposta está escondida no grito de um peixe.",
  "Sete cores não bastam para pintar o silêncio.",
  "Sua mente é um guarda-chuva furado.",
  "A lógica é um sapato apertado demais para a alma.",
  "A porta não existe, apenas a sua vontade de sair.",
  "O caos é a única ordem que não cobra impostos.",
  "O espelho ri de quem procura o reflexo.",
  "Uma escada que só sobe para baixo.",
  "Onde o nada encontra o vazio, o Dada faz um café."
];

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    title: "Manifesto Inicial",
    instruction: "A direita é o destino inevitável.",
    rule: "O movimento é a única regra que não mentimos.",
    solution: "Apenas ande para a direita e toque no portal vermelho.",
    mechanic: 'NORMAL',
    bgColor: '#fdf6e3'
  },
  {
    id: 2,
    title: "O Pânico do Botão",
    instruction: "Pressione o botão para liberar a passagem.",
    rule: "O botão foge da sua intenção.",
    solution: "O botão azul foge do seu CURSOR (mouse). Empurre-o com o cursor em direção ao seu personagem ou cerque-o rapidamente.",
    mechanic: 'SHY_BUTTON',
    bgColor: '#e2e8f0'
  },
  {
    id: 3,
    title: "O Espelho do Absurdo",
    instruction: "Caminhe contra a sua vontade.",
    rule: "Direita é Esquerda. A lógica é uma prisão.",
    solution: "Os controles estão invertidos. Pressione ESQUERDA para ir para a DIREITA.",
    mechanic: 'REVERSE',
    bgColor: '#fae8ff'
  },
  {
    id: 4,
    title: "Queda Ascendente",
    instruction: "O chão é o teto de outro alguém.",
    rule: "Pule para cair. Caia para subir.",
    solution: "A gravidade está invertida. Você caminha no teto. Pressione para baixo ou Espaço para 'pular' em direção ao chão.",
    mechanic: 'GRAVITY_SWAP',
    bgColor: '#ffedd5'
  },
  {
    id: 5,
    title: "Obscuridade Visível",
    instruction: "O que você não vê te impede.",
    rule: "Existem blocos de silêncio no caminho.",
    solution: "Existem colunas invisíveis no meio. Pule alto logo após o início para passar por cima delas.",
    mechanic: 'INVISIBLE_WALLS',
    bgColor: '#d1fae5'
  },
  {
    id: 6,
    title: "O Tamanho da Dúvida",
    instruction: "Sua importância varia com o tempo.",
    rule: "Fique pequeno para passar, grande para saltar.",
    solution: "Seu personagem muda de escala. Espere ficar pequeno para passar pelo vão central.",
    mechanic: 'SIZE_SHIFT',
    bgColor: '#fefce8'
  },
  {
    id: 7,
    title: "Instabilidade Crítica",
    instruction: "O mundo treme diante de você.",
    rule: "Mantenha o equilíbrio enquanto a realidade vibra.",
    solution: "A tela treme sem parar. Apenas ignore e siga para a direita, desviando do espinho no centro.",
    mechanic: 'SCREEN_SHAKE',
    bgColor: '#fee2e2'
  },
  {
    id: 8,
    title: "A Porta Nômade",
    instruction: "A saída não quer ser encontrada.",
    rule: "Persiga o objetivo geográfico.",
    solution: "O portal está se movendo. Pule no centro do mapa para interceptar o portal no ar.",
    mechanic: 'DRIFTING_DOOR',
    bgColor: '#f0f9ff'
  },
  {
    id: 9,
    title: "A Porta é uma Mentira II",
    instruction: "Ignore a porta vermelha. Saia por onde entrou?",
    rule: "A resposta está no rodapé.",
    solution: "A porta vermelha é falsa. Você deve CLICAR no 'NÚMERO DA FASE' (no topo esquerdo da tela) para passar.",
    mechanic: 'NORMAL',
    bgColor: '#ffffff'
  },
  {
    id: 10,
    title: "Veredito de Tinta",
    instruction: "Escreva algo sem nexo para o Juiz.",
    rule: "O silêncio é uma resposta errada.",
    solution: "Digite qualquer coisa e clique em Enviar. O Juiz Dadaísta te deixará passar após uma resposta aleatória.",
    mechanic: 'GEMINI_SAYS',
    bgColor: '#1a1a1a'
  },
  {
    id: 11,
    title: "O Sopro do Vácuo",
    instruction: "O ar está pesado hoje.",
    rule: "O vento sopra contra o progresso.",
    solution: "Uma força constante te empurra para trás. Segure DIREITA e pule sem parar para ganhar tração.",
    mechanic: 'WIND_AFFECTED',
    bgColor: '#f1f5f9'
  },
  {
    id: 12,
    title: "Estatismo Dinâmico",
    instruction: "Nada se move se você parar.",
    rule: "O tempo é escravo dos seus passos.",
    solution: "Se você parar de andar, a gravidade e a física pausam. Continue andando para não cair no abismo enquanto pula.",
    mechanic: 'MOVE_ONLY_IF_MOVE',
    bgColor: '#fdf4ff'
  },
  {
    id: 13,
    title: "Relatividade Tardia",
    instruction: "Quanto mais longe, mais lento.",
    rule: "A distância dilata os segundos.",
    solution: "Quanto mais perto da porta, mais devagar você fica. Tenha paciência e continue segurando o botão de andar.",
    mechanic: 'TIME_DILATION',
    bgColor: '#ecfdf5'
  },
  {
    id: 14,
    title: "Fantasmagoria",
    instruction: "A matéria é uma ilusão de ótica.",
    rule: "Paredes são atravessáveis no ar.",
    solution: "Enquanto você estiver NO AR (pulando), as plataformas e espinhos são fantasmas. Você só colide quando está no chão. Pule e caia exatamente no portal.",
    mechanic: 'PHANTOM_PLATFORMS',
    bgColor: '#fff7ed'
  },
  {
    id: 15,
    title: "O Paradoxo do Toque",
    instruction: "Toque não é sentir. Ver não é clicar.",
    rule: "A porta precisa de um convite manual.",
    solution: "Encoste seu personagem na porta E CLIQUE nela com o mouse simultaneamente.",
    mechanic: 'DUAL_CONTACT',
    bgColor: '#fff1f2'
  },
  {
    id: 16,
    title: "Labirinto do Ócio",
    instruction: "O caminho óbvio é uma armadilha.",
    rule: "O chão desaparece onde você pisa.",
    solution: "As plataformas centrais caem logo após serem tocadas. Faça um parkour rápido sem parar.",
    mechanic: 'NORMAL',
    bgColor: '#e2e8f0'
  },
  {
    id: 17,
    title: "Tique-Taque Gravitacional",
    instruction: "O céu e a terra trocam de lugar.",
    rule: "A gravidade inverte a cada 3 batidas.",
    solution: "Fique atento ao ritmo. A gravidade inverte periodicamente. Tente estar no chão firme quando o 'tique' acontecer.",
    mechanic: 'GRAVITY_TICK',
    bgColor: '#fef3c7'
  },
  {
    id: 18,
    title: "Glitch na Matriz Dada",
    instruction: "O portal está com defeito.",
    rule: "A colisão é uma variável aleatória.",
    solution: "Paredes sólidas tornam-se atravessáveis e vácuos tornam-se sólidos. Siga o rastro de luz.",
    mechanic: 'GLITCH_MAZE',
    bgColor: '#1e1b4b'
  },
  {
    id: 19,
    title: "O Pulo do Niilista",
    instruction: "Parkour sobre o abismo.",
    rule: "Plataformas invisíveis + Vento.",
    solution: "Combine o que aprendeu: há plataformas invisíveis no meio. Pule enquanto luta contra o vento.",
    mechanic: 'WIND_AFFECTED',
    bgColor: '#f8fafc'
  },
  {
    id: 20,
    title: "A Rebelião do Portal",
    instruction: "O portal se cansa de ser usado.",
    rule: "Sobreviva ao ataque e capture a saída.",
    solution: "O Portal agora atira contra você! Desvie dos projéteis pretos e toque nele 3 vezes para forçar a vitória.",
    mechanic: 'BOSS_FIGHT',
    bgColor: '#450a0a'
  }
];
