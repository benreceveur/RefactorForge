#!/usr/bin/env ts-node

/**
 * TypeScript Type Safety Checker
 * Comprehensive analysis of type safety across the RefactorForge codebase
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TypeSafetyReport {
  totalFiles: number;
  tsFiles: number;
  jsFiles: number;
  anyUsages: Array<{
    file: string;
    line: number;
    content: string;
  }>;
  missingReturnTypes: Array<{
    file: string;
    line: number;
    functionName: string;
    content: string;
  }>;
  implicitTypes: Array<{
    file: string;
    line: number;
    content: string;
  }>;
  typeErrorCount: number;
  compilerErrors: string[];
  recommendations: string[];
}

const EXCLUDED_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.tsbuildinfo'
];

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

class TypeSafetyChecker {
  private rootDir: string;
  private report: TypeSafetyReport;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.report = {
      totalFiles: 0,
      tsFiles: 0,
      jsFiles: 0,
      anyUsages: [],
      missingReturnTypes: [],
      implicitTypes: [],
      typeErrorCount: 0,
      compilerErrors: [],
      recommendations: [],
    };
  }

  private isExcluded(filePath: string): boolean {
    return EXCLUDED_PATTERNS.some(pattern => 
      filePath.includes(path.sep + pattern + path.sep) || 
      filePath.includes(pattern + path.sep) ||
      filePath.endsWith(path.sep + pattern)
    );
  }

  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    const traverse = (currentDir: string) => {
      if (this.isExcluded(currentDir)) return;
      
      try {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          
          if (this.isExcluded(fullPath)) continue;
          
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            traverse(fullPath);
          } else if (FILE_EXTENSIONS.some(ext => item.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not read directory ${currentDir}: ${error}`);
      }
    };
    
    traverse(dir);
    return files;
  }

  private analyzeFile(filePath: string): void {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const isTypeScript = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
      
      this.report.totalFiles++;
      if (isTypeScript) {
        this.report.tsFiles++;
      } else {
        this.report.jsFiles++;
      }
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmedLine = line.trim();
        
        // Check for 'any' usage
        if (this.containsAnyUsage(line)) {
          this.report.anyUsages.push({
            file: path.relative(this.rootDir, filePath),
            line: lineNumber,
            content: trimmedLine,
          });
        }
        
        // Check for missing return types (only in TypeScript files)
        if (isTypeScript) {
          const missingReturnType = this.checkMissingReturnType(line);
          if (missingReturnType) {
            this.report.missingReturnTypes.push({
              file: path.relative(this.rootDir, filePath),
              line: lineNumber,
              functionName: missingReturnType,
              content: trimmedLine,
            });
          }
        }
        
        // Check for implicit types (let/const without types)
        if (isTypeScript && this.hasImplicitType(line)) {
          this.report.implicitTypes.push({
            file: path.relative(this.rootDir, filePath),
            line: lineNumber,
            content: trimmedLine,
          });
        }
      });
      
    } catch (error) {
      console.warn(`Warning: Could not analyze file ${filePath}: ${error}`);
    }
  }

  private containsAnyUsage(line: string): boolean {
    // Match various 'any' patterns while avoiding false positives
    const anyPatterns = [
      /:\s*any\b/,           // : any
      /as\s+any\b/,          // as any
      /<any>/,               // <any>
      /Array<any>/,          // Array<any>
      /Promise<any>/,        // Promise<any>
      /Record<[^,>]+,\s*any>/, // Record<string, any>
      /\bany\[\]/,           // any[]
    ];
    
    // Exclude comments and strings
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return false;
    }
    
    // Exclude template literals and strings
    const withoutStrings = line.replace(/'[^']*'/g, '').replace(/"[^"]*"/g, '').replace(/`[^`]*`/g, '');
    
    return anyPatterns.some(pattern => pattern.test(withoutStrings));
  }

  private checkMissingReturnType(line: string): string | null {
    // Check for function declarations without return types
    const functionPatterns = [
      /function\s+(\w+)\s*\([^)]*\)\s*{/,         // function name() {
      /(\w+)\s*\([^)]*\)\s*{/,                    // name() {
      /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>/,      // const name = () =>
      /let\s+(\w+)\s*=\s*\([^)]*\)\s*=>/,        // let name = () =>
      /(\w+)\s*=\s*\([^)]*\)\s*=>/,              // name = () =>
    ];
    
    for (const pattern of functionPatterns) {
      const match = pattern.exec(line);
      if (match) {
        const functionName = match[1];
        
        // Skip if already has return type
        if (line.includes('):') || line.includes('): ')) {
          return null;
        }
        
        // Skip constructors, getters, setters
        if (functionName === 'constructor' || line.includes('get ') || line.includes('set ')) {
          return null;
        }
        
        // Skip test functions and common patterns
        if (functionName.startsWith('test') || functionName.startsWith('it') || functionName.startsWith('describe')) {
          return null;
        }
        
        return functionName;
      }
    }
    
    return null;
  }

  private hasImplicitType(line: string): boolean {
    // Check for variable declarations without explicit types
    const implicitPatterns = [
      /const\s+\w+\s*=.*[^:]$/,  // const x = ... (without type annotation)
      /let\s+\w+\s*=.*[^:]$/,    // let x = ... (without type annotation)
    ];
    
    // Skip if it's already typed
    if (line.includes(': ') && !line.includes('= ')) {
      return false;
    }
    
    // Skip destructuring and complex patterns
    if (line.includes('{') || line.includes('[') || line.includes('...')) {
      return false;
    }
    
    return implicitPatterns.some(pattern => pattern.test(line.trim()));
  }

  private async checkTypeErrors(): Promise<void> {
    try {
      // Check backend TypeScript compilation
      const backendPath = path.join(this.rootDir, 'backend');
      if (fs.existsSync(path.join(backendPath, 'tsconfig.json'))) {
        try {
          await execAsync('npx tsc --noEmit', { cwd: backendPath });
        } catch (error) {
          this.report.compilerErrors.push(`Backend: ${error}`);
          this.report.typeErrorCount += 1;
        }
      }
      
      // Check frontend TypeScript compilation
      const frontendPath = path.join(this.rootDir, 'frontend');
      if (fs.existsSync(path.join(frontendPath, 'tsconfig.json'))) {
        try {
          await execAsync('npx tsc --noEmit', { cwd: frontendPath });
        } catch (error) {
          this.report.compilerErrors.push(`Frontend: ${error}`);
          this.report.typeErrorCount += 1;
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not check TypeScript compilation: ${error}`);
    }
  }

  private generateRecommendations(): void {
    const { anyUsages, missingReturnTypes, jsFiles, tsFiles } = this.report;
    
    if (anyUsages.length > 0) {
      this.report.recommendations.push(
        `🔴 CRITICAL: Found ${anyUsages.length} usages of 'any' type. Replace with specific types for better type safety.`
      );
    }
    
    if (missingReturnTypes.length > 0) {
      this.report.recommendations.push(
        `🟡 MODERATE: Found ${missingReturnTypes.length} functions without explicit return types. Add return type annotations.`
      );
    }
    
    if (jsFiles > 0 && tsFiles > 0) {
      this.report.recommendations.push(
        `🟡 MODERATE: Found ${jsFiles} JavaScript files in a TypeScript project. Consider migrating to TypeScript.`
      );
    }
    
    if (this.report.typeErrorCount > 0) {
      this.report.recommendations.push(
        `🔴 CRITICAL: Found ${this.report.typeErrorCount} TypeScript compilation errors. Fix these for better type safety.`
      );
    }
    
    // Add configuration recommendations
    this.report.recommendations.push(
      '✅ RECOMMENDED: Enable strict TypeScript options: exactOptionalPropertyTypes, noImplicitReturns, noUncheckedIndexedAccess'
    );
    
    this.report.recommendations.push(
      '✅ RECOMMENDED: Use runtime validation with libraries like Zod for API boundaries'
    );
    
    this.report.recommendations.push(
      '✅ RECOMMENDED: Implement comprehensive type guards for external data validation'
    );
  }

  public async analyze(): Promise<TypeSafetyReport> {
    console.log('🔍 Starting TypeScript type safety analysis...');
    
    const files = this.getAllFiles(this.rootDir);
    console.log(`📁 Found ${files.length} files to analyze`);
    
    files.forEach(file => this.analyzeFile(file));
    
    console.log('🔧 Checking TypeScript compilation...');
    await this.checkTypeErrors();
    
    console.log('💡 Generating recommendations...');
    this.generateRecommendations();
    
    return this.report;
  }

  public printReport(): void {
    const { report } = this;
    
    console.log('\n📊 TYPE SAFETY ANALYSIS REPORT');
    console.log('=====================================\n');
    
    console.log('📈 SUMMARY:');
    console.log(`  Total files analyzed: ${report.totalFiles}`);
    console.log(`  TypeScript files: ${report.tsFiles}`);
    console.log(`  JavaScript files: ${report.jsFiles}`);
    console.log(`  Type coverage: ${((report.tsFiles / report.totalFiles) * 100).toFixed(1)}%\n`);
    
    console.log('🚨 TYPE SAFETY ISSUES:');
    console.log(`  'any' type usages: ${report.anyUsages.length}`);
    console.log(`  Missing return types: ${report.missingReturnTypes.length}`);
    console.log(`  Implicit types: ${report.implicitTypes.length}`);
    console.log(`  Compilation errors: ${report.typeErrorCount}\n`);
    
    if (report.anyUsages.length > 0) {
      console.log('🔴 ANY TYPE USAGES:');
      report.anyUsages.slice(0, 10).forEach(usage => {
        console.log(`  ${usage.file}:${usage.line} → ${usage.content}`);
      });
      if (report.anyUsages.length > 10) {
        console.log(`  ... and ${report.anyUsages.length - 10} more\n`);
      } else {
        console.log('');
      }
    }
    
    if (report.missingReturnTypes.length > 0) {
      console.log('🟡 MISSING RETURN TYPES:');
      report.missingReturnTypes.slice(0, 10).forEach(missing => {
        console.log(`  ${missing.file}:${missing.line} → ${missing.functionName}()`);
      });
      if (report.missingReturnTypes.length > 10) {
        console.log(`  ... and ${report.missingReturnTypes.length - 10} more\n`);
      } else {
        console.log('');
      }
    }
    
    if (report.compilerErrors.length > 0) {
      console.log('🔴 COMPILATION ERRORS:');
      report.compilerErrors.forEach(error => {
        console.log(`  ${error}`);
      });
      console.log('');
    }
    
    console.log('💡 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => {
      console.log(`  ${rec}`);
    });
    
    console.log('\n=====================================');
    
    const score = this.calculateTypeScore();
    console.log(`🏆 TYPE SAFETY SCORE: ${score}/100`);
    
    if (score >= 90) {
      console.log('🎉 EXCELLENT type safety!');
    } else if (score >= 70) {
      console.log('👍 GOOD type safety, minor improvements needed.');
    } else if (score >= 50) {
      console.log('⚠️  MODERATE type safety, significant improvements recommended.');
    } else {
      console.log('🚨 POOR type safety, immediate attention required.');
    }
  }

  private calculateTypeScore(): number {
    const { totalFiles, tsFiles, anyUsages, missingReturnTypes, typeErrorCount } = this.report;
    
    let score = 100;
    
    // Penalize JavaScript files in TypeScript project
    const jsFileRatio = (totalFiles - tsFiles) / totalFiles;
    score -= jsFileRatio * 20;
    
    // Penalize 'any' usage heavily
    const anyPenalty = Math.min(anyUsages.length * 2, 30);
    score -= anyPenalty;
    
    // Penalize missing return types
    const returnTypePenalty = Math.min(missingReturnTypes.length * 1, 20);
    score -= returnTypePenalty;
    
    // Penalize compilation errors severely
    const compilationPenalty = Math.min(typeErrorCount * 10, 40);
    score -= compilationPenalty;
    
    return Math.max(Math.round(score), 0);
  }
}

// Main execution
async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const checker = new TypeSafetyChecker(rootDir);
  
  try {
    await checker.analyze();
    checker.printReport();
  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { TypeSafetyChecker };