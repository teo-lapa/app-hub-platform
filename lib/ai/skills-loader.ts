/**
 * ANTHROPIC SKILLS LOADER v2.0.0
 *
 * Carica skills (istruzioni specializzate per AI agents) dalla cartella .skills/
 * Gli skills sono file markdown con metadata YAML che guidano l'AI in task specifici.
 *
 * v2.0.0 Changes:
 * - Support for category/skill-name pattern (e.g., 'customer-intelligence/customer-profiling')
 * - In-memory caching for loaded skills
 * - Enhanced YAML validation
 * - Helper function loadSkillByCategory()
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
  category?: string;  // NEW: Category of the skill
  model?: string;
  author?: string;
  created?: string;
  updated?: string;   // NEW: Last update date
}

/**
 * Skill completo (metadata + contenuto)
 */
export interface Skill {
  metadata: SkillMetadata;
  content: string;
  rawContent: string; // Contenuto completo incluso frontmatter
  filePath: string;   // NEW: Absolute path to the skill file
}

/**
 * In-memory cache for loaded skills
 */
const skillCache = new Map<string, Skill>();

/**
 * Clear the skills cache (useful for hot-reloading)
 */
export function clearSkillCache(): void {
  skillCache.clear();
}

/**
 * Parse YAML frontmatter from skill content
 *
 * @param yamlContent - YAML content string
 * @param skillName - Name of the skill (for defaults)
 * @returns Parsed metadata
 */
function parseYAMLMetadata(yamlContent: string, skillName: string): SkillMetadata {
  // Default metadata
  const metadata: SkillMetadata = {
    name: skillName,
    version: '1.0.0',
    description: '',
    tags: []
  };

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
      case 'category':
        metadata.category = value;
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
      case 'updated':
        metadata.updated = value;
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

  return metadata;
}

/**
 * Validate skill YAML metadata
 *
 * @param metadata - Skill metadata to validate
 * @throws Error if validation fails
 */
function validateSkillMetadata(metadata: SkillMetadata): void {
  if (!metadata.name || metadata.name.trim().length === 0) {
    throw new Error('Skill metadata validation failed: "name" is required');
  }
  if (!metadata.version || !/^\d+\.\d+\.\d+$/.test(metadata.version)) {
    throw new Error(`Skill metadata validation failed: "version" must be semantic (e.g., "1.0.0"), got "${metadata.version}"`);
  }
  if (!metadata.description || metadata.description.trim().length === 0) {
    throw new Error('Skill metadata validation failed: "description" is required');
  }
  if (!Array.isArray(metadata.tags)) {
    throw new Error('Skill metadata validation failed: "tags" must be an array');
  }
}

/**
 * Carica uno skill dalla cartella .skills
 *
 * Supports both legacy (skillName/SKILL.md) and new (category/skill-name.md) patterns.
 *
 * @param skillPath - Nome dello skill o path relativo (es: 'invoice-parsing' o 'document-processing/invoice-parsing')
 * @param options - Loading options
 * @param options.skipCache - Skip cache and reload from disk (default: false)
 * @param options.validate - Validate YAML metadata (default: true)
 * @returns Skill object con metadata e contenuto
 * @throws Error se lo skill non esiste o la validazione fallisce
 *
 * @example
 * // Legacy format
 * const skill = loadSkill('invoice-parsing');
 *
 * @example
 * // New format with category
 * const skill = loadSkill('document-processing/invoice-parsing');
 */
export function loadSkill(
  skillPath: string,
  options: { skipCache?: boolean; validate?: boolean } = {}
): Skill {
  const { skipCache = false, validate = true } = options;

  // Check cache first
  if (!skipCache && skillCache.has(skillPath)) {
    return skillCache.get(skillPath)!;
  }

  const skillsRoot = path.join(process.cwd(), '.skills');
  let absolutePath: string;
  let skillName: string;

  // Try new format first: category/skill-name.md
  if (skillPath.includes('/')) {
    absolutePath = path.join(skillsRoot, `${skillPath}.md`);
    skillName = path.basename(skillPath);
  } else {
    // Try legacy format: skillName/SKILL.md
    absolutePath = path.join(skillsRoot, skillPath, 'SKILL.md');
    skillName = skillPath;
  }

  // Verifica esistenza file
  if (!fs.existsSync(absolutePath)) {
    // Try alternative format if first attempt failed
    if (skillPath.includes('/')) {
      // Try legacy format as fallback
      const legacyPath = path.join(skillsRoot, skillName, 'SKILL.md');
      if (fs.existsSync(legacyPath)) {
        absolutePath = legacyPath;
      } else {
        throw new Error(
          `Skill "${skillPath}" non trovato.\n` +
          `Percorso cercato: ${absolutePath}\n` +
          `Percorso alternativo: ${legacyPath}\n` +
          `Skills disponibili: ${listSkills().join(', ')}`
        );
      }
    } else {
      // Try new format as fallback
      const newFormatPath = path.join(skillsRoot, `${skillPath}.md`);
      if (fs.existsSync(newFormatPath)) {
        absolutePath = newFormatPath;
      } else {
        throw new Error(
          `Skill "${skillPath}" non trovato.\n` +
          `Percorso cercato: ${absolutePath}\n` +
          `Percorso alternativo: ${newFormatPath}\n` +
          `Skills disponibili: ${listSkills().join(', ')}`
        );
      }
    }
  }

  // Leggi contenuto
  let rawContent = fs.readFileSync(absolutePath, 'utf-8');

  // Normalizza line endings (Windows CRLF → Unix LF)
  rawContent = rawContent.replace(/\r\n/g, '\n');

  // Estrai metadata dal frontmatter YAML (tra --- e ---)
  const metadataMatch = rawContent.match(/^---\n([\s\S]*?)\n---/);

  let metadata: SkillMetadata;
  let content: string;

  if (metadataMatch) {
    const yamlContent = metadataMatch[1];
    metadata = parseYAMLMetadata(yamlContent, skillName);

    // Auto-detect category from path if not specified
    if (!metadata.category && skillPath.includes('/')) {
      metadata.category = skillPath.split('/')[0];
    }

    // Validate metadata if requested
    if (validate) {
      validateSkillMetadata(metadata);
    }

    // Rimuovi frontmatter dal contenuto
    content = rawContent.replace(/^---\n[\s\S]*?\n---\n/, '');
  } else {
    throw new Error(
      `Skill "${skillPath}" non ha metadata YAML valido.\n` +
      `File: ${absolutePath}\n` +
      `Il file deve iniziare con:\n---\nname: ...\nversion: ...\n---`
    );
  }

  const skill: Skill = {
    metadata,
    content: content.trim(),
    rawContent,
    filePath: absolutePath
  };

  // Cache the skill
  skillCache.set(skillPath, skill);

  return skill;
}

/**
 * Recursively find all skill files in a directory
 *
 * @param dir - Directory to search
 * @param baseDir - Base directory for relative paths
 * @returns Array of skill paths relative to baseDir
 */
function findSkillFilesRecursive(dir: string, baseDir: string): string[] {
  const skills: string[] = [];

  if (!fs.existsSync(dir)) {
    return skills;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Recursively search subdirectories
      skills.push(...findSkillFilesRecursive(fullPath, baseDir));
    } else if (entry.isFile()) {
      // Check if it's a skill file (SKILL.md or *.md in category folders)
      if (entry.name === 'SKILL.md' || (entry.name.endsWith('.md') && entry.name !== 'README.md' && entry.name !== 'SKILLS_GUIDE.md')) {
        const relativePath = path.relative(baseDir, fullPath);
        // Convert to skill path format
        if (entry.name === 'SKILL.md') {
          // Legacy format: folder/SKILL.md -> folder
          const skillName = path.basename(path.dirname(fullPath));
          skills.push(skillName);
        } else {
          // New format: category/skill-name.md -> category/skill-name
          const skillPath = relativePath.replace(/\.md$/, '').replace(/\\/g, '/');
          skills.push(skillPath);
        }
      }
    }
  }

  return skills;
}

/**
 * Lista tutti gli skills disponibili
 *
 * Supports both legacy (skillName/SKILL.md) and new (category/skill-name.md) formats.
 *
 * @returns Array di path skills (es: ['invoice-parsing', 'document-processing/invoice-parsing'])
 *
 * @example
 * const skills = listSkills();
 * console.log(skills); // ['invoice-parsing', 'document-processing/invoice-parsing']
 */
export function listSkills(): string[] {
  const skillsDir = path.join(process.cwd(), '.skills');

  // Se la cartella non esiste, ritorna array vuoto
  if (!fs.existsSync(skillsDir)) {
    console.warn('⚠️ Cartella .skills/ non trovata');
    return [];
  }

  return findSkillFilesRecursive(skillsDir, skillsDir);
}

/**
 * Lista tutti gli skills raggruppati per categoria
 *
 * @returns Map di categorie -> array di skill names
 *
 * @example
 * const byCategory = listSkillsByCategory();
 * console.log(byCategory.get('document-processing')); // ['invoice-parsing', 'contract-analysis']
 */
export function listSkillsByCategory(): Map<string, string[]> {
  const skills = listSkills();
  const byCategory = new Map<string, string[]>();

  for (const skillPath of skills) {
    if (skillPath.includes('/')) {
      const [category, skillName] = skillPath.split('/');
      if (!byCategory.has(category)) {
        byCategory.set(category, []);
      }
      byCategory.get(category)!.push(skillName);
    } else {
      // Legacy skills without category
      if (!byCategory.has('uncategorized')) {
        byCategory.set('uncategorized', []);
      }
      byCategory.get('uncategorized')!.push(skillPath);
    }
  }

  return byCategory;
}

/**
 * Carica uno skill da categoria e nome
 *
 * @param category - Categoria dello skill
 * @param skillName - Nome dello skill
 * @param options - Loading options
 * @returns Skill object
 *
 * @example
 * const skill = loadSkillByCategory('document-processing', 'invoice-parsing');
 */
export function loadSkillByCategory(
  category: string,
  skillName: string,
  options: { skipCache?: boolean; validate?: boolean } = {}
): Skill {
  const skillPath = `${category}/${skillName}`;
  return loadSkill(skillPath, options);
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
 * @param skillPath - Path dello skill (es: 'invoice-parsing' o 'document-processing/invoice-parsing')
 * @returns true se esiste, false altrimenti
 *
 * @example
 * if (skillExists('invoice-parsing')) {
 *   const skill = loadSkill('invoice-parsing');
 * }
 * if (skillExists('document-processing/invoice-parsing')) {
 *   const skill = loadSkill('document-processing/invoice-parsing');
 * }
 */
export function skillExists(skillPath: string): boolean {
  const skillsRoot = path.join(process.cwd(), '.skills');

  // Try new format first
  if (skillPath.includes('/')) {
    const newFormatPath = path.join(skillsRoot, `${skillPath}.md`);
    if (fs.existsSync(newFormatPath)) {
      return true;
    }
    // Try legacy format as fallback
    const skillName = path.basename(skillPath);
    const legacyPath = path.join(skillsRoot, skillName, 'SKILL.md');
    return fs.existsSync(legacyPath);
  }

  // Try legacy format first for simple names
  const legacyPath = path.join(skillsRoot, skillPath, 'SKILL.md');
  if (fs.existsSync(legacyPath)) {
    return true;
  }

  // Try new format as fallback
  const newFormatPath = path.join(skillsRoot, `${skillPath}.md`);
  return fs.existsSync(newFormatPath);
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
 *   model: 'claude-sonnet-4-5-20250929',
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
