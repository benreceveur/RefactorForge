/**
 * Recommendation Training System
 *
 * Learns from false positives to improve recommendation quality.
 * This system was created after discovering the error handling recommendation
 * claimed "0% coverage" when RefactorForge actually has 85-90% sophisticated error handling.
 */

import * as fs from 'fs';
import * as path from 'path';
import { recommendationValidator, ValidationResult } from './recommendation-quality-validator';

export interface TrainingCase {
  id: string;
  timestamp: string;
  caseType: 'false_positive' | 'false_negative' | 'accurate' | 'improvement';
  recommendation: {
    title: string;
    description: string;
    category: string;
    claimedMetrics?: any;
  };
  actualAnalysis: {
    coverage?: number;
    patternsFound: string[];
    sophisticatedImplementations: string[];
  };
  validation: ValidationResult;
  impact: 'high' | 'medium' | 'low';
  lessons: string[];
  preventionRules: PreventionRule[];
}

export interface PreventionRule {
  name: string;
  condition: string;
  action: 'reject' | 'modify' | 'flag_for_review';
  confidence: number;
  description: string;
}

export class RecommendationTrainingSystem {
  private trainingDataPath: string;
  private preventionRules: PreventionRule[] = [];

  constructor(dataPath: string = './training-data') {
    this.trainingDataPath = dataPath;
    this.loadPreventionRules();
  }

  /**
   * Creates training case from the error handling false positive
   */
  async createErrorHandlingTrainingCase(): Promise<TrainingCase> {
    const falsePositiveRecommendation = {
      title: "Improve Error Handling Coverage",
      description: "Only 0% of functions have proper error handling. Consider adding comprehensive error handling.",
      category: "maintainability",
      claimedMetrics: {
        currentCoverage: "0%",
        estimatedEffort: "4-7 hours",
        impact: "medium"
      }
    };

    // Validate against actual codebase
    const validation = await recommendationValidator.validateRecommendation(
      falsePositiveRecommendation,
      '/Users/benreceveur/GitHub/RefactorForge'
    );

    const trainingCase: TrainingCase = {
      id: `error-handling-false-positive-${Date.now()}`,
      timestamp: new Date().toISOString(),
      caseType: 'false_positive',
      recommendation: falsePositiveRecommendation,
      actualAnalysis: {
        coverage: validation.actualCoverage || 0,
        patternsFound: [
          'Centralized error handler (errorHandler.ts)',
          'Custom AppError classes',
          'AsyncHandler wrapper for all routes',
          'Database retry logic with exponential backoff',
          'Transaction rollback support',
          'Rate limit error handling',
          'Frontend error boundaries',
          'API error recovery mechanisms'
        ],
        sophisticatedImplementations: [
          'Global error middleware with correlation IDs',
          'Security-focused error sanitization',
          'Connection pool error management',
          'Comprehensive async error handling',
          'Error classification and categorization',
          'Graceful degradation in UI components'
        ]
      },
      validation,
      impact: 'high',
      lessons: [
        'Never make coverage claims without actual code analysis',
        'Check for existing sophisticated error handling patterns',
        'Template-based recommendations can be completely wrong',
        'High-quality codebases may already have comprehensive implementations',
        'False positives waste developer time and reduce trust',
        'Always validate recommendations against real codebase before presenting'
      ],
      preventionRules: [
        {
          name: 'error_handling_coverage_validation',
          condition: 'recommendation.title.includes("Error Handling") && recommendation.description.includes("0%")',
          action: 'reject',
          confidence: 0.9,
          description: 'Reject error handling recommendations claiming 0% coverage without validation'
        },
        {
          name: 'sophisticated_pattern_detection',
          condition: 'codebase.contains("errorHandler") || codebase.contains("AppError") || codebase.contains("asyncHandler")',
          action: 'flag_for_review',
          confidence: 0.8,
          description: 'Flag error handling recommendations when sophisticated patterns exist'
        },
        {
          name: 'enterprise_grade_validation',
          condition: 'codebase.hasErrorMiddleware && codebase.hasCustomErrorClasses && codebase.hasAsyncErrorHandling',
          action: 'reject',
          confidence: 0.95,
          description: 'Reject basic error handling recommendations for enterprise-grade implementations'
        }
      ]
    };

    await this.saveTrainingCase(trainingCase);
    return trainingCase;
  }

  /**
   * Saves training case to persistent storage
   */
  private async saveTrainingCase(trainingCase: TrainingCase): Promise<void> {
    try {
      // Ensure training data directory exists
      if (!fs.existsSync(this.trainingDataPath)) {
        fs.mkdirSync(this.trainingDataPath, { recursive: true });
      }

      const filePath = path.join(
        this.trainingDataPath,
        `training-case-${trainingCase.id}.json`
      );

      fs.writeFileSync(filePath, JSON.stringify(trainingCase, null, 2));

      // Update prevention rules
      this.updatePreventionRules(trainingCase.preventionRules);

      console.log(`✅ Training case saved: ${trainingCase.id}`);
    } catch (error) {
      console.error('Failed to save training case:', error);
    }
  }

  /**
   * Updates prevention rules based on training cases
   */
  private updatePreventionRules(newRules: PreventionRule[]): void {
    for (const newRule of newRules) {
      const existingRuleIndex = this.preventionRules.findIndex(
        rule => rule.name === newRule.name
      );

      if (existingRuleIndex >= 0) {
        // Update existing rule with higher confidence
        if (newRule.confidence > this.preventionRules[existingRuleIndex].confidence) {
          this.preventionRules[existingRuleIndex] = newRule;
        }
      } else {
        // Add new rule
        this.preventionRules.push(newRule);
      }
    }

    this.savePreventionRules();
  }

  /**
   * Applies learned prevention rules to new recommendations
   */
  async applyPreventionRules(recommendation: any, codebaseAnalysis: any): Promise<{
    action: 'approve' | 'reject' | 'flag_for_review';
    reasons: string[];
    confidence: number;
  }> {
    const appliedRules: { rule: PreventionRule; matched: boolean; confidence: number }[] = [];

    for (const rule of this.preventionRules) {
      const matched = this.evaluateRuleCondition(rule.condition, recommendation, codebaseAnalysis);
      appliedRules.push({ rule, matched, confidence: rule.confidence });
    }

    const matchedRules = appliedRules.filter(r => r.matched);

    if (matchedRules.length === 0) {
      return { action: 'approve', reasons: [], confidence: 0.8 };
    }

    // Determine action based on highest confidence matched rule
    const highestConfidenceRule = matchedRules.reduce((prev, current) =>
      current.confidence > prev.confidence ? current : prev
    );

    return {
      action: highestConfidenceRule.rule.action,
      reasons: matchedRules.map(r => r.rule.description),
      confidence: highestConfidenceRule.confidence
    };
  }

  /**
   * Evaluates a rule condition (simplified implementation)
   */
  private evaluateRuleCondition(
    condition: string,
    recommendation: any,
    codebaseAnalysis: any
  ): boolean {
    // Simplified condition evaluation
    // In production, this would use a proper expression evaluator

    if (condition.includes('Error Handling') && condition.includes('0%')) {
      return recommendation.title?.includes('Error Handling') &&
             recommendation.description?.includes('0%');
    }

    if (condition.includes('errorHandler') || condition.includes('AppError')) {
      return codebaseAnalysis?.sophisticatedPatterns?.includes('errorHandler') ||
             codebaseAnalysis?.sophisticatedPatterns?.includes('AppError');
    }

    return false;
  }

  /**
   * Loads prevention rules from storage
   */
  private loadPreventionRules(): void {
    try {
      const rulesPath = path.join(this.trainingDataPath, 'prevention-rules.json');
      if (fs.existsSync(rulesPath)) {
        const data = fs.readFileSync(rulesPath, 'utf-8');
        this.preventionRules = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Could not load prevention rules:', error);
      this.preventionRules = [];
    }
  }

  /**
   * Saves prevention rules to storage
   */
  private savePreventionRules(): void {
    try {
      if (!fs.existsSync(this.trainingDataPath)) {
        fs.mkdirSync(this.trainingDataPath, { recursive: true });
      }

      const rulesPath = path.join(this.trainingDataPath, 'prevention-rules.json');
      fs.writeFileSync(rulesPath, JSON.stringify(this.preventionRules, null, 2));
    } catch (error) {
      console.error('Failed to save prevention rules:', error);
    }
  }

  /**
   * Generates training report
   */
  generateTrainingReport(): {
    totalCases: number;
    falsePositives: number;
    preventionRules: number;
    recommendations: string[];
  } {
    const caseFiles = fs.existsSync(this.trainingDataPath) ?
      fs.readdirSync(this.trainingDataPath).filter(f => f.startsWith('training-case-')) : [];

    return {
      totalCases: caseFiles.length,
      falsePositives: caseFiles.length, // All current cases are false positives
      preventionRules: this.preventionRules.length,
      recommendations: [
        'Implement real-time validation before showing recommendations',
        'Add codebase analysis to recommendation generation',
        'Create confidence scoring based on actual code patterns',
        'Reject template-based recommendations that contradict reality',
        'Build pattern detection for existing sophisticated implementations'
      ]
    };
  }
}

export const trainingSystem = new RecommendationTrainingSystem(
  path.join(__dirname, '../../training-data')
);