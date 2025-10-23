/**
 * ANTHROPIC SKILLS LOADER
 *
 * Carica skills (istruzioni specializzate per AI agents) dalla cartella .skills/
 * Gli skills sono file markdown con metadata YAML che guidano l'AI in task specifici.
 */

import fs from 'fs';
import path from 'path';

/**
 * Metadata dello skill (estratto dal frontmatter YAML)
 */
export interface SkillMetadata {
  name: string;
  version: string;
  description: string;
  tags: string[];
  model?: string;
  author?: string;
  created?: string;
}

/**
 * Skill completo (metadata + contenuto)
 */
export interface Skill {
  metadata: SkillMetadata;
  content: string;
  rawContent: string; // Contenuto completo incluso frontmatter
}

/**
 * Carica uno skill dalla cartella .skills
 *
 * @param skillName - Nome dello skill (nome cartella)
 * @returns Skill object con metadata e contenuto
 * @throws Error se lo skill non esiste
 *
 * @example
 * const skill = loadSkill('invoice-parsing');
 * console.log(skill.metadata.version); // "1.0.0"
 * console.log(skill.content); // Contenuto markdown senza frontmatter
 */
export function loadSkill(skillName: string): Skill {
  const skillPath = path.join(process.cwd(), '.skills', skillName, 'SKILL.md');

  // Verifica esistenza file
  if (!fs.existsSync(skillPath)) {
    throw new Error(
      `Skill "${skillName}" non trovato.\n` +
      `Percorso cercato: ${skillPath}\n` +
      `Skills disponibili: ${listSkills().join(', ')}`
    );
  }

  // Leggi contenuto
  const rawContent = fs.readFileSync(skillPath, 'utf-8');

  // Estrai metadata dal frontmatter YAML (tra --- e ---)
  const metadataMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);

  // Default metadata
  let metadata: SkillMetadata = {
    name: skillName,
    version: '1.0.0',
    description: '',
    tags: []
  };

  // Contenuto senza frontmatter
  let content = rawContent;

  if (metadataMatch) {
    const yamlContent = metadataMatch[1];

    // Parse YAML semplice (sufficiente per il nostro caso)
    const lines = yamlContent.split('\n');
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) return;

      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      switch (key) {
        case 'name':
          metadata.name = value;
          break;
        case 'version':
          metadata.version = value;
          break;
        case 'description':
          metadata.description = value;
          break;
        case 'model':
          metadata.model = value;
          break;
        case 'author':
          metadata.author = value;
          break;
        case 'created':
          metadata.created = value;
          break;
        case 'tags':
          // Parse [tag1, tag2, tag3]
          metadata.tags = value
            .replace(/[\[\]]/g, '') // Rimuovi []
            .split(',')              // Split per virgola
            .map(t => t.trim())      // Trim spazi
            .filter(t => t.length > 0); // Rimuovi vuoti
          break;
      }
    });

    // Rimuovi frontmatter dal contenuto
    content = rawContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  }

  return {
    metadata,
    content: content.trim(),
    rawContent
  };
}

/**
 * Lista tutti gli skills disponibili
 *
 * @returns Array di nomi skills
 *
 * @example
 * const skills = listSkills();
 * console.log(skills); // ['invoice-parsing', 'product-matching']
 */
export function listSkills(): string[] {
  const skillsDir = path.join(process.cwd(), '.skills');

  // Se la cartella non esiste, ritorna array vuoto
  if (!fs.existsSync(skillsDir)) {
    console.warn('⚠️ Cartella .skills/ non trovata');
    return [];
  }

  // Leggi tutte le cartelle
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  // Filtra solo le cartelle che contengono SKILL.md
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => {
      const skillPath = path.join(skillsDir, name, 'SKILL.md');
      return fs.existsSync(skillPath);
    });
}

/**
 * Carica tutti gli skills disponibili
 *
 * @returns Map di skills (chiave = nome, valore = Skill)
 *
 * @example
 * const allSkills = loadAllSkills();
 * console.log(allSkills.size); // 2
 * console.log(allSkills.get('invoice-parsing')?.metadata.version); // "1.0.0"
 */
export function loadAllSkills(): Map<string, Skill> {
  const skillNames = listSkills();
  const skills = new Map<string, Skill>();

  skillNames.forEach(name => {
    try {
      const skill = loadSkill(name);
      skills.set(name, skill);
    } catch (error: any) {
      console.error(`❌ Errore caricamento skill "${name}":`, error.message);
    }
  });

  return skills;
}

/**
 * Verifica se uno skill esiste
 *
 * @param skillName - Nome dello skill
 * @returns true se esiste, false altrimenti
 *
 * @example
 * if (skillExists('invoice-parsing')) {
 *   const skill = loadSkill('invoice-parsing');
 * }
 */
export function skillExists(skillName: string): boolean {
  const skillPath = path.join(process.cwd(), '.skills', skillName, 'SKILL.md');
  return fs.existsSync(skillPath);
}

/**
 * Ottieni informazioni su tutti gli skills (metadata only, senza contenuto)
 * Utile per UI che mostra lista skills senza caricarli tutti
 *
 * @returns Array di metadata
 *
 * @example
 * const skillsInfo = getSkillsInfo();
 * skillsInfo.forEach(info => {
 *   console.log(`${info.name} v${info.version} - ${info.description}`);
 * });
 */
export function getSkillsInfo(): SkillMetadata[] {
  const skillNames = listSkills();
  const infos: SkillMetadata[] = [];

  skillNames.forEach(name => {
    try {
      const skill = loadSkill(name);
      infos.push(skill.metadata);
    } catch (error: any) {
      console.error(`❌ Errore lettura metadata skill "${name}":`, error.message);
    }
  });

  return infos;
}

/**
 * Crea un prompt completo combinando skill + dati utente
 * Helper per usare gli skills con Anthropic API
 *
 * @param skillName - Nome dello skill
 * @param userContent - Contenuto aggiuntivo dall'utente
 * @returns Prompt completo
 *
 * @example
 * const prompt = createPromptWithSkill('invoice-parsing', 'Analizza questo PDF...');
 * const response = await anthropic.messages.create({
 *   model: 'claude-3-5-sonnet-20241022',
 *   messages: [{ role: 'user', content: prompt }]
 * });
 */
export function createPromptWithSkill(skillName: string, userContent: string): string {
  const skill = loadSkill(skillName);
  return `${skill.content}\n\n---\n\n${userContent}`;
}

/**
 * Log info su uno skill (per debugging)
 *
 * @param skillName - Nome dello skill
 */
export function logSkillInfo(skillName: string): void {
  try {
    const skill = loadSkill(skillName);
    console.log('📚 Skill Info:');
    console.log(`   Name: ${skill.metadata.name}`);
    console.log(`   Version: ${skill.metadata.version}`);
    console.log(`   Description: ${skill.metadata.description}`);
    console.log(`   Tags: ${skill.metadata.tags.join(', ')}`);
    console.log(`   Model: ${skill.metadata.model || 'default'}`);
    console.log(`   Content length: ${skill.content.length} chars`);
  } catch (error: any) {
    console.error(`❌ Skill "${skillName}" non trovato:`, error.message);
  }
}
