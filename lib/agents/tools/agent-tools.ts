/**
 * 🛠️ AGENT TOOLS
 * Tool concreti che gli agenti possono usare
 */

import fs from 'fs/promises';
import path from 'path';

export class AgentTools {
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  /**
   * Legge il contenuto di un file
   */
  async readFile(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      return {
        success: true,
        content
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Scrive contenuto in un file
   */
  async writeFile(filePath: string, content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);

      // Create directory if it doesn't exist
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });

      await fs.writeFile(fullPath, content, 'utf-8');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Modifica un file sostituendo contenuto specifico
   */
  async modifyFile(
    filePath: string,
    oldContent: string,
    newContent: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Check if old content exists
      if (!content.includes(oldContent)) {
        return {
          success: false,
          error: 'Old content not found in file'
        };
      }

      // Replace content
      const newFileContent = content.replace(oldContent, newContent);
      await fs.writeFile(fullPath, newFileContent, 'utf-8');

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to modify file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Cerca pattern nel codice
   */
  async searchCode(
    pattern: string,
    filePath?: string
  ): Promise<{ success: boolean; matches?: SearchMatch[]; error?: string }> {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches: SearchMatch[] = [];

      if (filePath) {
        // Search in specific file
        const result = await this.searchInFile(filePath, regex);
        if (result) matches.push(result);
      } else {
        // Search in all TypeScript files
        const files = await this.findTypeScriptFiles();
        for (const file of files.slice(0, 50)) {  // Limit to 50 files
          const result = await this.searchInFile(file, regex);
          if (result && result.matches.length > 0) {
            matches.push(result);
          }
        }
      }

      return {
        success: true,
        matches
      };
    } catch (error) {
      return {
        success: false,
        error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Cerca in un file specifico
   */
  private async searchInFile(filePath: string, regex: RegExp): Promise<SearchMatch | null> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      const matches: LineMatch[] = [];

      lines.forEach((line, index) => {
        const match = regex.exec(line);
        if (match) {
          matches.push({
            line: index + 1,
            content: line.trim(),
            match: match[0]
          });
        }
      });

      if (matches.length === 0) return null;

      return {
        file: filePath,
        matches
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Trova tutti i file TypeScript nel progetto
   */
  private async findTypeScriptFiles(): Promise<string[]> {
    const files: string[] = [];

    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          // Skip node_modules and .next
          if (entry.name === 'node_modules' || entry.name === '.next' ||
              entry.name === '.git' || entry.name.startsWith('.')) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
              files.push(path.relative(this.projectRoot, fullPath));
            }
          }
        }
      } catch (error) {
        // Ignore errors
      }
    };

    await scanDir(this.projectRoot);

    return files;
  }

  /**
   * Analizza la struttura di un file
   */
  async analyzeStructure(filePath: string): Promise<{
    success: boolean;
    analysis?: FileAnalysis;
    error?: string;
  }> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      const analysis: FileAnalysis = {
        file: filePath,
        linesOfCode: content.split('\n').length,
        imports: this.extractImports(content),
        exports: this.extractExports(content),
        functions: this.extractFunctions(content),
        components: this.extractComponents(content),
        complexity: this.calculateComplexity(content)
      };

      return {
        success: true,
        analysis
      };
    } catch (error) {
      return {
        success: false,
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Estrae gli import da un file
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;

    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  /**
   * Estrae gli export da un file
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];

    // Named exports
    const namedExportRegex = /export\s+(const|function|class|interface|type)\s+(\w+)/g;
    let match;
    while ((match = namedExportRegex.exec(content)) !== null) {
      exports.push(match[2]);
    }

    // Default export
    if (content.includes('export default')) {
      exports.push('default');
    }

    return exports;
  }

  /**
   * Estrae le funzioni da un file
   */
  private extractFunctions(content: string): string[] {
    const functions: string[] = [];

    // Function declarations
    const funcRegex = /function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    // Arrow functions assigned to const
    const arrowRegex = /const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  /**
   * Estrae i componenti React da un file
   */
  private extractComponents(content: string): string[] {
    const components: string[] = [];

    // Component function declarations
    const compRegex = /(?:export\s+)?function\s+([A-Z]\w+)/g;
    let match;
    while ((match = compRegex.exec(content)) !== null) {
      components.push(match[1]);
    }

    // Arrow function components
    const arrowCompRegex = /(?:export\s+)?const\s+([A-Z]\w+)\s*=\s*(?:React\.FC|React\.FunctionComponent|\([^)]*\)\s*=>)/g;
    while ((match = arrowCompRegex.exec(content)) !== null) {
      components.push(match[1]);
    }

    return components;
  }

  /**
   * Calcola la complessità ciclomatica semplificata
   */
  private calculateComplexity(content: string): number {
    let complexity = 1;  // Base complexity

    // Count decision points
    complexity += (content.match(/\bif\b/g) || []).length;
    complexity += (content.match(/\belse\b/g) || []).length;
    complexity += (content.match(/\bfor\b/g) || []).length;
    complexity += (content.match(/\bwhile\b/g) || []).length;
    complexity += (content.match(/\bcase\b/g) || []).length;
    complexity += (content.match(/\bcatch\b/g) || []).length;
    complexity += (content.match(/\?\?/g) || []).length;  // Nullish coalescing
    complexity += (content.match(/\?[^?]/g) || []).length / 2;  // Ternary (divided by 2 to avoid double counting)

    return complexity;
  }

  /**
   * Lista i file in una directory
   */
  async listFiles(
    directory: string,
    pattern?: string
  ): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      const fullPath = path.join(this.projectRoot, directory);
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      let files = entries
        .filter(entry => entry.isFile())
        .map(entry => path.join(directory, entry.name));

      // Apply pattern filter if provided
      if (pattern) {
        const regex = new RegExp(pattern);
        files = files.filter(file => regex.test(file));
      }

      return {
        success: true,
        files
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Crea una nuova directory
   */
  async createDirectory(dirPath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.join(this.projectRoot, dirPath);
      await fs.mkdir(fullPath, { recursive: true });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Elimina un file
   */
  async deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fullPath = path.join(this.projectRoot, filePath);
      await fs.unlink(fullPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Rinomina/muove un file
   */
  async moveFile(
    oldPath: string,
    newPath: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const fullOldPath = path.join(this.projectRoot, oldPath);
      const fullNewPath = path.join(this.projectRoot, newPath);

      // Create directory for new path if needed
      const newDir = path.dirname(fullNewPath);
      await fs.mkdir(newDir, { recursive: true });

      await fs.rename(fullOldPath, fullNewPath);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to move file: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

// ============= TYPES =============

interface SearchMatch {
  file: string;
  matches: LineMatch[];
}

interface LineMatch {
  line: number;
  content: string;
  match: string;
}

interface FileAnalysis {
  file: string;
  linesOfCode: number;
  imports: string[];
  exports: string[];
  functions: string[];
  components: string[];
  complexity: number;
}
