/**
 * 🔍 AUTO-DISCOVERY SYSTEM
 * Scopre automaticamente nuove app e genera il loro contesto
 */

import fs from 'fs/promises';
import path from 'path';
import { AppContext } from '../types/agent-types';

export class AutoDiscovery {
  private appDirectory: string;
  private discoveredApps: Map<string, AppContext>;

  constructor(appDirectory: string = 'app') {
    this.appDirectory = appDirectory;
    this.discoveredApps = new Map();
  }

  /**
   * Scansiona tutte le app nella directory
   */
  async discoverAllApps(): Promise<AppContext[]> {
    console.log('🔍 Starting app discovery...');

    const appDirs = await this.scanAppDirectories();

    const apps: AppContext[] = [];

    for (const appDir of appDirs) {
      try {
        const context = await this.analyzeApp(appDir);
        this.discoveredApps.set(context.appName, context);
        apps.push(context);
        console.log(`✅ Discovered: ${context.appName}`);
      } catch (error) {
        console.error(`❌ Failed to analyze ${appDir}:`, error);
      }
    }

    console.log(`🎉 Discovery complete! Found ${apps.length} apps`);

    return apps;
  }

  /**
   * Analizza una singola app
   */
  async analyzeApp(appPath: string): Promise<AppContext> {
    console.log(`📊 Analyzing app: ${appPath}`);

    const appName = this.extractAppName(appPath);

    // Scan structure
    const structure = await this.scanAppStructure(appPath);

    // Analyze dependencies
    const dependencies = await this.analyzeDependencies(appPath, structure);

    // Detect patterns
    const patterns = await this.detectPatterns(appPath, structure);

    // Extract capabilities
    const capabilities = await this.extractCapabilities(appPath, structure);

    // Calculate metadata
    const metadata = await this.calculateMetadata(structure);

    // Determine category
    const category = this.determineCategory(appName, capabilities);

    // Generate description
    const description = this.generateDescription(appName, category, capabilities);

    return {
      appName,
      appPath,
      description,
      category,
      structure,
      dependencies,
      patterns,
      capabilities,
      metadata
    };
  }

  /**
   * Scansiona le directory delle app
   */
  private async scanAppDirectories(): Promise<string[]> {
    const appDirs: string[] = [];
    const basePath = path.join(process.cwd(), this.appDirectory);

    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() && this.isAppDirectory(entry.name)) {
          appDirs.push(path.join(this.appDirectory, entry.name));

          // Check for nested apps (es: app/apps/magazzino)
          const nestedPath = path.join(basePath, entry.name);
          try {
            const nestedEntries = await fs.readdir(nestedPath, { withFileTypes: true });
            for (const nested of nestedEntries) {
              if (nested.isDirectory() && this.isAppDirectory(nested.name)) {
                appDirs.push(path.join(this.appDirectory, entry.name, nested.name));
              }
            }
          } catch (error) {
            // Ignore nested scan errors
          }
        }
      }
    } catch (error) {
      console.error('Error scanning app directories:', error);
    }

    return appDirs;
  }

  /**
   * Verifica se una directory è una app
   */
  private isAppDirectory(name: string): boolean {
    // Escludi directory di sistema
    const excluded = ['api', 'components', 'lib', 'node_modules', '.next', 'public', 'styles'];

    return !excluded.includes(name) && !name.startsWith('_') && !name.startsWith('.');
  }

  /**
   * Scansiona la struttura di una app
   */
  private async scanAppStructure(appPath: string): Promise<AppContext['structure']> {
    const fullPath = path.join(process.cwd(), appPath);

    const structure = {
      pages: [] as string[],
      components: [] as string[],
      apiRoutes: [] as string[],
      types: [] as string[]
    };

    try {
      await this.scanDirectory(fullPath, fullPath, structure);
    } catch (error) {
      console.error(`Error scanning ${appPath}:`, error);
    }

    return structure;
  }

  /**
   * Scansiona ricorsivamente una directory
   */
  private async scanDirectory(
    dirPath: string,
    basePath: string,
    structure: AppContext['structure']
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(process.cwd(), fullPath);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectory(fullPath, basePath, structure);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);

          if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
            if (entry.name.includes('page.')) {
              structure.pages.push(relativePath);
            } else if (entry.name.includes('route.')) {
              structure.apiRoutes.push(relativePath);
            } else if (entry.name.includes('types') || entry.name.includes('.d.ts')) {
              structure.types.push(relativePath);
            } else {
              structure.components.push(relativePath);
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors for inaccessible directories
    }
  }

  /**
   * Analizza le dipendenze di una app
   */
  private async analyzeDependencies(
    appPath: string,
    structure: AppContext['structure']
  ): Promise<AppContext['dependencies']> {
    const dependencies = {
      odoo: [] as string[],
      external: [] as string[],
      internal: [] as string[]
    };

    const allFiles = [
      ...structure.pages,
      ...structure.components,
      ...structure.apiRoutes
    ];

    for (const file of allFiles.slice(0, 20)) {  // Limit to first 20 files for performance
      try {
        const content = await fs.readFile(path.join(process.cwd(), file), 'utf-8');

        // Extract Odoo models
        const odooMatches = Array.from(content.matchAll(/['"`]([a-z]+\.[a-z.]+)['"`]/g));
        for (const match of odooMatches) {
          const model = match[1];
          if (model.includes('.') && !dependencies.odoo.includes(model)) {
            dependencies.odoo.push(model);
          }
        }

        // Extract external imports
        const importMatches = Array.from(content.matchAll(/from ['"]([^.][^'"]+)['"]/g));
        for (const match of importMatches) {
          const pkg = match[1].split('/')[0];
          if (pkg.startsWith('@') || !pkg.startsWith('.')) {
            if (!dependencies.external.includes(pkg)) {
              dependencies.external.push(pkg);
            }
          }
        }
      } catch (error) {
        // Ignore read errors
      }
    }

    return dependencies;
  }

  /**
   * Rileva i pattern usati nell'app
   */
  private async detectPatterns(
    appPath: string,
    structure: AppContext['structure']
  ): Promise<AppContext['patterns']> {
    const patterns: AppContext['patterns'] = {};

    // Sample first page/component to detect patterns
    const sampleFiles = [...structure.pages, ...structure.components].slice(0, 5);

    for (const file of sampleFiles) {
      try {
        const content = await fs.readFile(path.join(process.cwd(), file), 'utf-8');

        // Detect state management
        if (content.includes('zustand')) patterns.stateManagement = 'zustand';
        else if (content.includes('redux')) patterns.stateManagement = 'redux';
        else if (content.includes('useState')) patterns.stateManagement = 'react-hooks';

        // Detect data fetching
        if (content.includes('useSWR')) patterns.dataFetching = 'SWR';
        else if (content.includes('useQuery')) patterns.dataFetching = 'react-query';
        else if (content.includes('fetch')) patterns.dataFetching = 'fetch';

        // Detect styling
        if (content.includes('tailwind') || content.includes('className=')) {
          patterns.styling = 'tailwind';
        } else if (content.includes('styled-components')) {
          patterns.styling = 'styled-components';
        }

        // Detect routing
        if (content.includes('next/navigation')) patterns.routing = 'next.js-app-router';
        else if (content.includes('next/router')) patterns.routing = 'next.js-pages';
      } catch (error) {
        // Ignore read errors
      }
    }

    return patterns;
  }

  /**
   * Estrae le capabilities di una app
   */
  private async extractCapabilities(
    appPath: string,
    structure: AppContext['structure']
  ): Promise<string[]> {
    const capabilities: string[] = [];

    // Analyze API routes to infer capabilities
    for (const route of structure.apiRoutes) {
      const routeName = path.basename(route, path.extname(route));

      if (routeName.includes('list')) capabilities.push(`List ${this.extractAppName(appPath)}`);
      if (routeName.includes('create')) capabilities.push(`Create ${this.extractAppName(appPath)}`);
      if (routeName.includes('update')) capabilities.push(`Update ${this.extractAppName(appPath)}`);
      if (routeName.includes('delete')) capabilities.push(`Delete ${this.extractAppName(appPath)}`);
      if (routeName.includes('search')) capabilities.push(`Search ${this.extractAppName(appPath)}`);
      if (routeName.includes('export')) capabilities.push(`Export ${this.extractAppName(appPath)}`);
      if (routeName.includes('import')) capabilities.push(`Import ${this.extractAppName(appPath)}`);
    }

    // Remove duplicates
    return Array.from(new Set(capabilities));
  }

  /**
   * Calcola i metadata di una app
   */
  private async calculateMetadata(
    structure: AppContext['structure']
  ): Promise<AppContext['metadata']> {
    let linesOfCode = 0;
    let totalComplexity = 0;

    const allFiles = [
      ...structure.pages,
      ...structure.components,
      ...structure.apiRoutes
    ];

    for (const file of allFiles) {
      try {
        const content = await fs.readFile(path.join(process.cwd(), file), 'utf-8');
        const lines = content.split('\n').length;
        linesOfCode += lines;

        // Simple complexity calculation
        const complexity = this.calculateComplexity(content);
        totalComplexity += complexity;
      } catch (error) {
        // Ignore read errors
      }
    }

    const avgComplexity = allFiles.length > 0 ? totalComplexity / allFiles.length : 0;

    return {
      lastAnalyzed: new Date(),
      linesOfCode,
      complexity: avgComplexity < 50 ? 'low' : avgComplexity < 150 ? 'medium' : 'high',
      maintenanceScore: Math.min(100, Math.max(0, 100 - (avgComplexity / 2)))
    };
  }

  /**
   * Calcola la complessità di un file
   */
  private calculateComplexity(content: string): number {
    let complexity = 0;

    // Count control structures
    complexity += (content.match(/\bif\b/g) || []).length;
    complexity += (content.match(/\bfor\b/g) || []).length;
    complexity += (content.match(/\bwhile\b/g) || []).length;
    complexity += (content.match(/\bswitch\b/g) || []).length;
    complexity += (content.match(/\bcatch\b/g) || []).length;

    // Count functions
    complexity += (content.match(/\bfunction\b/g) || []).length;
    complexity += (content.match(/=>\s*\{/g) || []).length;

    return complexity;
  }

  /**
   * Determina la categoria di una app
   */
  private determineCategory(
    appName: string,
    capabilities: string[]
  ): AppContext['category'] {
    const name = appName.toLowerCase();

    if (name.includes('magazzino') || name.includes('inventory') ||
        name.includes('stock') || name.includes('pick')) {
      return 'magazzino';
    }

    if (name.includes('vendita') || name.includes('venditor') ||
        name.includes('sales') || name.includes('order')) {
      return 'vendite';
    }

    if (name.includes('delivery') || name.includes('consegna') ||
        name.includes('shipping')) {
      return 'delivery';
    }

    if (name.includes('admin') || name.includes('user') ||
        name.includes('setting')) {
      return 'admin';
    }

    return 'general';
  }

  /**
   * Genera una descrizione automatica
   */
  private generateDescription(
    appName: string,
    category: string,
    capabilities: string[]
  ): string {
    const capString = capabilities.length > 0 ?
      `Capabilities include: ${capabilities.slice(0, 3).join(', ')}` :
      'No specific capabilities detected';

    return `${appName} is a ${category} application. ${capString}.`;
  }

  /**
   * Estrae il nome dell'app dal path
   */
  private extractAppName(appPath: string): string {
    const parts = appPath.split(path.sep);
    return parts[parts.length - 1];
  }

  /**
   * Ottiene le app scoperte
   */
  getDiscoveredApps(): Map<string, AppContext> {
    return this.discoveredApps;
  }

  /**
   * Cerca una app specifica
   */
  findApp(appName: string): AppContext | undefined {
    return this.discoveredApps.get(appName);
  }
}
