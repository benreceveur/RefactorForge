/**
 * Recommendation Quality Validator
 *
 * Validates recommendations against actual codebase to prevent false positives
 * like claiming "0% error handling" when sophisticated error handling exists.
 *
 * Training Example: Error handling recommendation was completely inaccurate
 * - Claimed: 0% error handling coverage
 * - Reality: 85-90% sophisticated error handling with enterprise patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  actualCoverage?: number;
  conflictingEvidence: string[];
  supportingEvidence: string[];
  recommendation: 'approve' | 'reject' | 'modify';
  modificationSuggestions?: string[];
}

export interface CodePattern {
  name: string;
  patterns: RegExp[];
  weight: number;
  category: 'error_handling' | 'testing' | 'security' | 'performance';
}

export class RecommendationQualityValidator {
  private codePatterns: CodePattern[] = [
    // Error Handling Patterns
    {
      name: 'try_catch_blocks',
      patterns: [
        /try\s*\{[\s\S]*?\}\s*catch\s*\(/g,
        /\.catch\s*\(/g,
        /catch\s*\([^)]*\)\s*\{/g
      ],
      weight: 1.0,
      category: 'error_handling'
    },
    {
      name: 'error_classes',
      patterns: [
        /class\s+\w*Error\s+extends\s+Error/g,
        /throw\s+new\s+\w*Error/g,
        /AppError|ValidationError|DatabaseError/g
      ],
      weight: 1.5,
      category: 'error_handling'
    },
    {
      name: 'async_error_handling',
      patterns: [
        /async\s+function[\s\S]*?try\s*\{/g,
        /await[\s\S]*?\.catch/g,
        /Promise\.reject|Promise\.catch/g
      ],
      weight: 1.2,
      category: 'error_handling'
    },
    {
      name: 'error_middleware',
      patterns: [
        /errorHandler|error.*middleware/gi,
        /app\.use.*error/gi,
        /next\s*\(\s*error\s*\)/g
      ],
      weight: 2.0,
      category: 'error_handling'
    },
    {
      name: 'database_error_handling',
      patterns: [
        /transaction.*rollback/gi,
        /db\.run.*catch|db\.get.*catch|db\.all.*catch/g,
        /sqliteWrapper|dbWrapper/gi
      ],
      weight: 1.5,
      category: 'error_handling'
    }
  ];

  private falsePositivePatterns = {
    error_handling: [
      // If these exist, error handling recommendations are likely false
      'asyncHandler',
      'errorHandler.ts',
      'AppError',
      'try {',
      '.catch(',
      'throw new',
      'error-handler',
      'middleware/error'
    ]
  };

  /**
   * Validates a recommendation against actual codebase
   */
  async validateRecommendation(
    recommendation: any,
    repositoryPath: string
  ): Promise<ValidationResult> {
    const category = this.categorizeRecommendation(recommendation);

    if (category === 'error_handling') {
      return this.validateErrorHandlingRecommendation(recommendation, repositoryPath);
    }

    // Add more category validations as needed
    return this.defaultValidation(recommendation, repositoryPath);
  }

  /**
   * Validates error handling recommendations against actual implementation
   */
  private async validateErrorHandlingRecommendation(
    recommendation: any,
    repositoryPath: string
  ): Promise<ValidationResult> {
    const files = await this.getCodeFiles(repositoryPath);
    let totalFunctions = 0;
    let functionsWithErrorHandling = 0;
    const conflictingEvidence: string[] = [];
    const supportingEvidence: string[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const analysis = this.analyzeErrorHandling(content, file);

        totalFunctions += analysis.totalFunctions;
        functionsWithErrorHandling += analysis.functionsWithErrorHandling;
        conflictingEvidence.push(...analysis.conflictingEvidence);
        supportingEvidence.push(...analysis.supportingEvidence);
      } catch (error) {
        console.warn(`Could not analyze file ${file}:`, error);
      }
    }

    const actualCoverage = totalFunctions > 0 ?
      (functionsWithErrorHandling / totalFunctions) * 100 : 0;

    // Check for sophisticated error handling patterns
    const hasSophisticatedErrorHandling = conflictingEvidence.some(evidence =>
      evidence.includes('errorHandler') ||
      evidence.includes('AppError') ||
      evidence.includes('asyncHandler') ||
      evidence.includes('middleware')
    );

    // Determine if recommendation is valid
    let isValid = true;
    let confidence = 1.0;
    let recommendationAction: 'approve' | 'reject' | 'modify' = 'approve';

    // Training Case: Reject if claiming low coverage when high coverage exists
    if (recommendation.title?.includes('Error Handling') &&
        (recommendation.description?.includes('0%') || recommendation.description?.includes('Only 0%'))) {

      if (actualCoverage > 50 || hasSophisticatedErrorHandling) {
        isValid = false;
        confidence = 0.1;
        recommendationAction = 'reject';
        conflictingEvidence.push(
          `VALIDATION FAILURE: Recommendation claims low error handling coverage, but analysis found ${actualCoverage.toFixed(1)}% coverage with sophisticated patterns`
        );
      }
    }

    return {
      isValid,
      confidence,
      actualCoverage,
      conflictingEvidence,
      supportingEvidence,
      recommendation: recommendationAction,
      modificationSuggestions: isValid ? [] : [
        'Remove this recommendation - error handling already well implemented',
        'Consider recommendations for specific error handling gaps instead',
        'Focus on areas that actually lack error handling'
      ]
    };
  }

  /**
   * Analyzes error handling patterns in a single file
   */
  private analyzeErrorHandling(content: string, filePath: string) {
    let totalFunctions = 0;
    let functionsWithErrorHandling = 0;
    const conflictingEvidence: string[] = [];
    const supportingEvidence: string[] = [];

    // Count functions
    const functionMatches = content.match(/(?:function|async\s+function|\w+\s*=\s*(?:async\s+)?\(|\w+\s*:\s*(?:async\s+)?\()/g);
    totalFunctions = functionMatches ? functionMatches.length : 0;

    // Analyze error handling patterns
    for (const pattern of this.codePatterns.filter(p => p.category === 'error_handling')) {
      for (const regex of pattern.patterns) {
        const matches = content.match(regex);
        if (matches) {
          functionsWithErrorHandling += matches.length * pattern.weight;
          conflictingEvidence.push(
            `${filePath}: Found ${matches.length} instances of ${pattern.name}`
          );
        }
      }
    }

    // Check for false positive indicators
    for (const indicator of this.falsePositivePatterns.error_handling) {
      if (content.includes(indicator)) {
        conflictingEvidence.push(
          `${filePath}: Contains sophisticated error handling pattern: "${indicator}"`
        );
      }
    }

    // Look for specific RefactorForge error handling patterns
    const sophisticatedPatterns = [
      'asyncHandler',
      'AppError',
      'errorHandler',
      'middleware/error',
      'try {',
      '.catch(',
      'throw new Error',
      'error-handler.ts'
    ];

    for (const pattern of sophisticatedPatterns) {
      if (content.includes(pattern)) {
        conflictingEvidence.push(
          `${filePath}: Uses enterprise error handling pattern: "${pattern}"`
        );
      }
    }

    return {
      totalFunctions,
      functionsWithErrorHandling: Math.min(functionsWithErrorHandling, totalFunctions),
      conflictingEvidence,
      supportingEvidence
    };
  }

  /**
   * Gets all code files for analysis
   */
  private async getCodeFiles(repositoryPath: string): Promise<string[]> {
    const patterns = [
      path.join(repositoryPath, '**/*.ts'),
      path.join(repositoryPath, '**/*.js'),
      path.join(repositoryPath, '**/*.tsx'),
      path.join(repositoryPath, '**/*.jsx')
    ];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(`Could not glob pattern ${pattern}:`, error);
      }
    }

    return [...new Set(allFiles)]; // Remove duplicates
  }

  /**
   * Categorizes a recommendation for validation
   */
  private categorizeRecommendation(recommendation: any): string {
    const title = recommendation.title?.toLowerCase() || '';
    const description = recommendation.description?.toLowerCase() || '';

    if (title.includes('error') || description.includes('error handling')) {
      return 'error_handling';
    }
    if (title.includes('test') || description.includes('testing')) {
      return 'testing';
    }
    if (title.includes('security') || description.includes('vulnerability')) {
      return 'security';
    }
    if (title.includes('performance') || description.includes('optimize')) {
      return 'performance';
    }

    return 'general';
  }

  /**
   * Default validation for uncategorized recommendations
   */
  private async defaultValidation(
    recommendation: any,
    repositoryPath: string
  ): Promise<ValidationResult> {
    return {
      isValid: true,
      confidence: 0.8,
      conflictingEvidence: [],
      supportingEvidence: ['No specific validation available'],
      recommendation: 'approve'
    };
  }

  /**
   * Creates training data from validation results
   */
  createTrainingCase(
    recommendation: any,
    validation: ValidationResult,
    notes: string
  ) {
    return {
      timestamp: new Date().toISOString(),
      recommendation: {
        title: recommendation.title,
        description: recommendation.description,
        category: recommendation.category
      },
      validation,
      notes,
      lessons: [
        'Always analyze actual code before making coverage claims',
        'Check for existing sophisticated implementations',
        'Validate recommendations against real codebase patterns',
        'Reject template-based recommendations that contradict reality'
      ]
    };
  }
}

export const recommendationValidator = new RecommendationQualityValidator();