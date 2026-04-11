export type AgentPlatform = 'whatsapp' | 'telegram';

export interface WhatsAppAgentConfig {
  name: string;
  emoji: string;
  role: string;
  owner: { name: string; number: string };
  whatsapp: string | null;
  platforms: AgentPlatform[];
  pc: { ip: string; ssh: string; os: string };
  useWSL: boolean;
  paths: {
    bot: string;
    agent: string;
    skills: string;
    memory: string;
    log: string;
    claude: string;
    soul: string;
  };
  model: string;
  maxTurns: { default: number; heavy?: number };
  telegram: { bot: string } | null;
  color: string;
}

export const WHATSAPP_AGENTS: Record<string, WhatsAppAgentConfig> = {
  stella: {
    name: 'Stella',
    emoji: '⭐',
    role: 'Assistente Personale CEO',
    owner: { name: 'Paul Teodorescu', number: '41763998515' },
    whatsapp: '+41 76 399 85 15',
    platforms: ['whatsapp', 'telegram'],
    pc: { ip: '192.168.1.157', ssh: 'stella', os: 'Win11 + WSL 2' },
    useWSL: true,
    paths: {
      bot: '/home/lapa/stella-whatsapp-bot',
      agent: '/home/lapa/stella-agent',
      skills: '/home/lapa/stella-agent/skills',
      memory: '/home/lapa/stella-agent/memory/MEMORY.md',
      log: '/home/lapa/stella-whatsapp-bot/bot.log',
      claude: '/home/lapa/stella-agent/CLAUDE.md',
      soul: '/home/lapa/stella-agent/SOUL.md',
    },
    model: 'sonnet + opus',
    maxTurns: { default: 15, heavy: 50 },
    telegram: { bot: '@stella_lapa_bot' },
    color: '#e94560',
  },
  romeo: {
    name: 'Romeo',
    emoji: '🏠',
    role: 'Assistente Amministrativa Laura',
    owner: { name: 'Laura Teodorescu', number: '41763617021' },
    whatsapp: '+41 76 361 70 21',
    platforms: ['whatsapp', 'telegram'],
    pc: { ip: '192.168.1.237', ssh: 'romeo', os: 'Win + WSL' },
    useWSL: true,
    paths: {
      bot: '/home/lapa/romeo-whatsapp-bot',
      agent: '/home/lapa/romeo-agent',
      skills: '/home/lapa/romeo-agent/skills',
      memory: '/home/lapa/romeo-agent/memory/MEMORY.md',
      log: '/home/lapa/romeo-whatsapp-bot/bot.log',
      claude: '/home/lapa/romeo-agent/CLAUDE.md',
      soul: '/home/lapa/romeo-agent/SOUL.md',
    },
    model: 'sonnet',
    maxTurns: { default: 15 },
    telegram: { bot: '@romeo_lapa_bot' },
    color: '#0f3460',
  },
  diana: {
    name: 'Diana',
    emoji: '💼',
    role: 'Vendite & Customer Service',
    owner: { name: 'Paul Teodorescu', number: '41768039886' },
    whatsapp: '+41 76 803 98 86',
    platforms: ['whatsapp', 'telegram'],
    pc: { ip: '192.168.1.33', ssh: 'diana', os: 'Win + WSL 1' },
    useWSL: false,
    paths: {
      bot: 'C:\\Users\\lapa.DIANA\\diana-whatsapp-bot',
      agent: 'C:\\Users\\lapa.DIANA\\diana-agent',
      skills: 'C:\\Users\\lapa.DIANA\\diana-whatsapp-bot\\skills',
      memory: 'C:\\Users\\lapa.DIANA\\diana-whatsapp-bot\\memory\\MEMORY.md',
      log: 'C:\\Users\\lapa.DIANA\\diana-whatsapp-bot\\bot-loop.log',
      claude: 'C:\\Users\\lapa.DIANA\\diana-whatsapp-bot\\CLAUDE.md',
      soul: 'C:\\Users\\lapa.DIANA\\diana-whatsapp-bot\\SOUL.md',
    },
    model: 'sonnet',
    maxTurns: { default: 15 },
    telegram: { bot: '@diana_lapa_bot' },
    color: '#533483',
  },
  vanessa: {
    name: 'Vanessa',
    emoji: '🚗',
    role: 'Vendite Campo Mihai',
    owner: { name: 'Mihai Nita', number: '41763945347' },
    whatsapp: '+41 76 394 53 47',
    platforms: ['whatsapp'],
    pc: { ip: '192.168.1.58', ssh: 'lapa-sales', os: 'Win + WSL' },
    useWSL: true,
    paths: {
      bot: '/home/lapa/vanessa-whatsapp-bot',
      agent: '/home/lapa/vanessa-agent',
      skills: '/home/lapa/vanessa-agent/skills',
      memory: '/home/lapa/vanessa-agent/memory/MEMORY.md',
      log: '/home/lapa/vanessa-whatsapp-bot/bot.log',
      claude: '/home/lapa/vanessa-agent/CLAUDE.md',
      soul: '/home/lapa/vanessa-agent/SOUL.md',
    },
    model: 'sonnet',
    maxTurns: { default: 15 },
    telegram: null,
    color: '#1fab89',
  },
  aurora: {
    name: 'Aurora',
    emoji: '🌅',
    role: 'Social Media Manager',
    owner: { name: 'Paul Teodorescu', number: '41763998515' },
    whatsapp: null,
    platforms: ['telegram'],
    pc: { ip: '192.168.1.157', ssh: 'stella', os: 'Win11 + WSL 2' },
    useWSL: true,
    paths: {
      bot: '/home/lapa/aurora-agent',
      agent: '/home/lapa/aurora-agent',
      skills: '/home/lapa/aurora-agent/skills',
      memory: '/home/lapa/aurora-agent/memory/MEMORY.md',
      log: '/home/lapa/aurora-agent/bot.log',
      claude: '/home/lapa/aurora-agent/CLAUDE.md',
      soul: '/home/lapa/aurora-agent/SOUL.md',
    },
    model: 'sonnet',
    maxTurns: { default: 15 },
    telegram: { bot: '@aurora_social_lapa_bot' },
    color: '#ff6b35',
  },
  sergio: {
    name: 'Sergio',
    emoji: '📊',
    role: 'Direttore Vendite AI',
    owner: { name: 'Paul Teodorescu', number: '41763998515' },
    whatsapp: null,
    platforms: ['telegram'],
    pc: { ip: '192.168.1.58', ssh: 'lapa-sales', os: 'Win + WSL' },
    useWSL: false,
    paths: {
      bot: 'C:\\Users\\Admin\\agente-vendite',
      agent: 'C:\\Users\\Admin\\agente-vendite',
      skills: 'C:\\Users\\Admin\\agente-vendite\\skills',
      memory: 'C:\\Users\\Admin\\agente-vendite\\memory\\MEMORY.md',
      log: 'C:\\Users\\Admin\\agente-vendite\\bot.log',
      claude: 'C:\\Users\\Admin\\agente-vendite\\CLAUDE.md',
      soul: 'C:\\Users\\Admin\\agente-vendite\\SOUL.md',
    },
    model: 'opus',
    maxTurns: { default: 15 },
    telegram: { bot: '@lapa_sales_bot' },
    color: '#2196f3',
  },
  giulio: {
    name: 'Giulio',
    emoji: '🔧',
    role: 'Agente AI Operativo',
    owner: { name: 'Paul Teodorescu', number: '41763998515' },
    whatsapp: null,
    platforms: ['telegram'],
    pc: { ip: '192.168.1.37', ssh: 'lapa10', os: 'Win + WSL 2' },
    useWSL: true,
    paths: {
      bot: '/home/lapa/.openclaw/workspace',
      agent: '/home/lapa/.openclaw/workspace',
      skills: '/home/lapa/.openclaw/workspace/skills',
      memory: '/home/lapa/.openclaw/workspace/MEMORY.md',
      log: '/home/lapa/gateway_output.log',
      claude: '/home/lapa/.openclaw/workspace/CLAUDE.md',
      soul: '/home/lapa/.openclaw/workspace/SOUL.md',
    },
    model: 'openclaw',
    maxTurns: { default: 15 },
    telegram: { bot: '@giulio_lapa_bot' },
    color: '#4caf50',
  },
  magazzino: {
    name: 'Magazzino',
    emoji: '📦',
    role: 'Agente Magazzino & Logistica',
    owner: { name: 'Paul Teodorescu', number: '41763998515' },
    whatsapp: null,
    platforms: ['telegram'],
    pc: { ip: '192.168.1.37', ssh: 'lapa10', os: 'Win + WSL 2' },
    useWSL: true,
    paths: {
      bot: '/home/lapa/magazzino-agent',
      agent: '/home/lapa/magazzino-agent',
      skills: '/home/lapa/magazzino-agent/skills',
      memory: '/home/lapa/magazzino-agent/memory/MEMORY.md',
      log: '/home/lapa/magazzino-agent/bot.log',
      claude: '/home/lapa/magazzino-agent/CLAUDE.md',
      soul: '/home/lapa/magazzino-agent/SOUL.md',
    },
    model: 'sonnet',
    maxTurns: { default: 15 },
    telegram: { bot: '@lapa_magazzino_bot' },
    color: '#795548',
  },
};

export function getAgent(name: string): WhatsAppAgentConfig | undefined {
  return WHATSAPP_AGENTS[name.toLowerCase()];
}

export function getAllAgents(): [string, WhatsAppAgentConfig][] {
  return Object.entries(WHATSAPP_AGENTS);
}
