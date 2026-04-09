export interface WhatsAppAgentConfig {
  name: string;
  emoji: string;
  role: string;
  owner: { name: string; number: string };
  whatsapp: string;
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
};

export function getAgent(name: string): WhatsAppAgentConfig | undefined {
  return WHATSAPP_AGENTS[name.toLowerCase()];
}

export function getAllAgents(): [string, WhatsAppAgentConfig][] {
  return Object.entries(WHATSAPP_AGENTS);
}
