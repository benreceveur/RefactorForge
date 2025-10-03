import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbRun, dbGet } from '../utils/database-helpers';
import { RepositoryInfo, RepositoryAnalyzer } from './repository-analyzer';
import { recommendationValidator, ValidationResult } from './recommendation-quality-validator';
import { trainingSystem } from './recommendation-training-system';
import {
  RepositoryRow,
  RecommendationRow,
  PatternRow,
  ParsedRecommendation,
  Pattern,
  PatternDetectionResult,
  SecurityPattern,
  TypeSafetyIssue,
  PerformanceIssue,
  Recommendation,
  RecommendationType,
  Priority,
  ImplementationStep,
  CodeExample,
  Template,
  TemplateVariable,
  DetailedScanResults,
  ScannerSecurityPattern,
  ScannerTypeSafetyIssue,
  ScannerPerformanceIssue
} from '../types';

// Additional type definitions for this service
export interface RecommendationContext {
  repository: RepositoryInfo;
  patterns: Pattern[];
  metadata: Record<string, unknown>;
}

/**
 * Abstract base class for all recommendation generators
 * 
 * Implements the Template Method pattern to provide a consistent framework
 * for generating different types of code improvement recommendations.
 * Each concrete generator implements domain-specific logic while sharing
 * common recommendation creation and validation patterns.
 */
abstract class RecommendationGenerator {
  /**
   * Abstract method that concrete generators must implement
   * to provide domain-specific recommendation generation logic
   */
  abstract generate(context: RecommendationContext): Promise<Recommendation[]>;
  
  /**
   * Intelligent scan-based recommendation generation
   * 
   * This method implements a crucial optimization: it only generates template-based
   * recommendations when actual issues are detected during repository scanning.
   * This prevents recommendation spam and ensures relevance.
   * 
   * Algorithm:
   * 1. Parse scan results (handles both array and count formats)
   * 2. Calculate total issue count across all categories
   * 3. If no issues found -> skip template recommendations (saves processing)
   * 4. If issues found -> generate relevant recommendations
   * 
   * This approach significantly improves user experience by reducing noise
   * and focusing on actionable improvements.
   */
  async generateFromScan(context: RecommendationContext, scanResults: DetailedScanResults): Promise<Recommendation[]> {
    // Normalize scan results to handle both array and numeric formats
    // This flexibility allows the system to work with different scanner implementations
    const securityCount = Array.isArray(scanResults.securityIssues) 
      ? scanResults.securityIssues.length 
      : scanResults.securityIssues || 0;
    const typeCount = Array.isArray(scanResults.typeSafetyIssues) 
      ? scanResults.typeSafetyIssues.length 
      : scanResults.typeSafetyIssues || 0;
    const performanceCount = Array.isArray(scanResults.performanceIssues) 
      ? scanResults.performanceIssues.length 
      : scanResults.performanceIssues || 0;
    
    console.log(`🔍 Issue analysis for ${context.repository.name}: Security=${securityCount}, TypeSafety=${typeCount}, Performance=${performanceCount}`);
    
    // Critical optimization: only generate recommendations when issues exist
    // This prevents overwhelming users with generic advice when their code is clean
    if (securityCount === 0 && typeCount === 0 && performanceCount === 0) {
      console.log(`✅ No issues detected in ${context.repository.name} - skipping template recommendations`);
      return [];
    }
    
    // Issues detected - generate targeted recommendations
    // The specific generator will create recommendations relevant to the detected issues
    console.log(`⚠️ Issues detected in ${context.repository.name} - generating targeted recommendations`);
    return this.generate(context);
  }
  
  /**
   * Factory method for creating standardized recommendation objects
   * 
   * Provides a consistent baseline for all recommendations with sensible defaults,
   * while allowing specific generators to override any field as needed.
   * 
   * Default values are chosen based on common recommendation patterns:
   * - Medium priority: Most improvements are neither critical nor trivial
   * - Best practices type: Default category for code quality improvements
   * - 2-4 hours effort: Realistic estimate for typical refactoring tasks
   * - Active status: New recommendations are immediately actionable
   * 
   * @param repositoryId - ID of the target repository
   * @param template - Partial recommendation to merge with defaults
   * @returns Complete recommendation object ready for storage
   */
  protected createRecommendation(
    repositoryId: string,
    template: Partial<Recommendation>
  ): Recommendation {
    return {
      id: uuidv4(),                           // Unique identifier for tracking
      repositoryId,                           // Links recommendation to repository
      title: '',                              // Must be overridden by template
      description: '',                        // Must be overridden by template
      recommendationType: 'best_practices',   // Default category
      priority: 'medium',                     // Balanced default priority
      applicablePatterns: [],                 // Pattern IDs this applies to
      codeExamples: [],                      // Before/after code examples
      implementationSteps: [],               // Step-by-step instructions
      estimatedEffort: '2-4 hours',          // Realistic time estimate
      tags: [],                              // Categorization tags
      status: 'active',                      // Ready for implementation
      ...template                            // Override defaults with specifics
    };
  }
}

// TypeScript-specific recommendations
class TypeScriptRecommendationGenerator extends RecommendationGenerator {
  async generate(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // PRIORITY 1: Pattern-based recommendations (analyze actual code)
    const patternBasedRecommendations = await Promise.all([
      this.generateTypeSafetyRecommendations(context),
      this.generatePerformanceRecommendations(context),
      this.generateBestPracticeRecommendations(context)
    ]);
    
    patternBasedRecommendations.forEach(recs => recommendations.push(...recs));
    
    // PRIORITY 2: Fallback templates only if no pattern-based recommendations found
    if (recommendations.length === 0) {
      console.log(`⚠️  No pattern-based recommendations found for repository ${context.repository.id}, falling back to templates`);
      recommendations.push(...this.generateTypeScriptTemplateRecommendations(context));
    } else {
      console.log(`✅ Generated ${recommendations.length} pattern-based TypeScript recommendations for repository ${context.repository.id}`);
    }
    
    return recommendations;
  }

  private generateTypeScriptTemplateRecommendations(context: RecommendationContext): Recommendation[] {
    const { repository } = context;
    const recommendations: Recommendation[] = [];

    // Template 1: Type Safety
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Eliminate "any" Type Usage',
      description: 'Replace "any" types with specific interfaces to improve type safety and code maintainability.',
      recommendationType: 'best_practices',
      priority: 'high',
      codeExamples: [{
        title: 'Replace any with specific types',
        description: 'Use specific interfaces instead of any type',
        before: 'function processData(data: any): any {\n  return data.process();\n}',
        after: 'interface ProcessableData {\n  process(): ProcessedResult;\n}\n\nfunction processData(data: ProcessableData): ProcessedResult {\n  return data.process();\n}',
        language: 'typescript',
        explanation: 'Specific types provide better IntelliSense, compile-time error checking, and code documentation.'
      }],
      implementationSteps: [
        { step: 1, title: 'Audit any usage', description: 'Find all instances of "any" type', estimatedTime: '1 hour' },
        { step: 2, title: 'Create interfaces', description: 'Define proper interfaces for data structures', estimatedTime: '2-3 hours' },
        { step: 3, title: 'Replace any types', description: 'Update function signatures and variables', estimatedTime: '2-4 hours' }
      ],
      estimatedEffort: '5-8 hours',
      tags: ['typescript', 'type-safety', 'best-practices']
    }));

    // Template 2: Error Handling
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Improve Error Handling Coverage',
      description: 'Add comprehensive error handling with proper error types and logging.',
      recommendationType: 'best_practices',
      priority: 'medium',
      codeExamples: [{
        title: 'Add proper error handling',
        description: 'Implement comprehensive error handling',
        before: 'async function fetchData(url: string) {\n  const response = await fetch(url);\n  return response.json();\n}',
        after: 'async function fetchData(url: string): Promise<ApiResponse> {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) {\n      throw new Error(`HTTP error! status: ${response.status}`);\n    }\n    return await response.json();\n  } catch (error) {\n    console.error("Failed to fetch data:", error);\n    throw new ApiError("Data fetch failed", error);\n  }\n}',
        language: 'typescript',
        explanation: 'Proper error handling prevents application crashes and provides better user experience.'
      }],
      implementationSteps: [
        { step: 1, title: 'Identify functions without error handling', description: 'Review all async functions', estimatedTime: '1 hour' },
        { step: 2, title: 'Add try-catch blocks', description: 'Implement proper error handling', estimatedTime: '3-5 hours' },
        { step: 3, title: 'Create custom error types', description: 'Define specific error classes', estimatedTime: '2 hours' }
      ],
      estimatedEffort: '6-8 hours',
      tags: ['typescript', 'error-handling', 'reliability']
    }));

    // Template 3: Performance Optimization
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Optimize Async Operations',
      description: 'Replace synchronous operations with async alternatives to improve performance.',
      recommendationType: 'performance',
      priority: 'medium',
      codeExamples: [{
        title: 'Use async file operations',
        description: 'Replace sync operations with async versions',
        before: 'import fs from "fs";\n\nconst data = fs.readFileSync("config.json", "utf-8");\nconst config = JSON.parse(data);',
        after: 'import fs from "fs/promises";\n\nconst data = await fs.readFile("config.json", "utf-8");\nconst config = JSON.parse(data);',
        language: 'typescript',
        explanation: 'Async operations prevent blocking the event loop, improving application responsiveness.'
      }],
      implementationSteps: [
        { step: 1, title: 'Find synchronous operations', description: 'Audit code for blocking operations', estimatedTime: '1 hour' },
        { step: 2, title: 'Replace with async alternatives', description: 'Update to use async APIs', estimatedTime: '2-4 hours' }
      ],
      estimatedEffort: '3-5 hours',
      tags: ['typescript', 'performance', 'async']
    }));

    return recommendations;
  }

  private async generateTypeSafetyRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for any patterns
    const anyPatterns = patterns.filter((p: Pattern) => 
      p.content.includes(': any') || p.content.includes('as any')
    );
    
    if (anyPatterns.length > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Reduce Usage of "any" Type',
        description: `Found ${anyPatterns.length} instances of "any" type usage. Consider using more specific types for better type safety.`,
        recommendationType: 'best_practices',
        priority: 'high',
        applicablePatterns: anyPatterns.map(p => p.id),
        codeExamples: [{
          title: 'Replace any with specific types',
          description: 'Use specific interfaces instead of any type',
          before: 'function processData(data: any): any { return data.process(); }',
          after: 'interface ProcessableData { process(): ProcessedResult; }\nfunction processData(data: ProcessableData): ProcessedResult { return data.process(); }',
          language: 'typescript',
          explanation: 'Specific types provide better IntelliSense, compile-time error checking, and code documentation.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Identify any usage patterns',
            description: 'Review all instances where "any" type is used',
            estimatedTime: '30 minutes'
          },
          {
            step: 2,
            title: 'Create specific interfaces',
            description: 'Define proper interfaces for data structures',
            estimatedTime: '1-2 hours'
          },
          {
            step: 3,
            title: 'Replace any types',
            description: 'Update function signatures and variable declarations',
            estimatedTime: '1-3 hours'
          }
        ],
        estimatedEffort: '2-5 hours',
        tags: ['typescript', 'type-safety', 'best-practices']
      }));
    }
    
    return recommendations;
  }

  private async generatePerformanceRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for potential performance issues
    const synchronousPatterns = patterns.filter((p: Pattern) => 
      p.content.includes('fs.readFileSync') || 
      p.content.includes('JSON.parse') && !p.content.includes('try')
    );
    
    if (synchronousPatterns.length > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Use Asynchronous Operations',
        description: 'Found synchronous file operations that could block the event loop. Consider using async alternatives.',
        recommendationType: 'performance',
        priority: 'medium',
        applicablePatterns: synchronousPatterns.map(p => p.id),
        codeExamples: [{
          title: 'Replace synchronous with asynchronous operations',
          description: 'Use async/await for better performance',
          before: 'const data = fs.readFileSync("file.json", "utf-8");\nconst parsed = JSON.parse(data);',
          after: 'const data = await fs.promises.readFile("file.json", "utf-8");\nconst parsed = JSON.parse(data);',
          language: 'typescript',
          explanation: 'Asynchronous operations prevent blocking the event loop, improving overall application performance.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Identify synchronous operations',
            description: 'Find all blocking operations in the codebase',
            estimatedTime: '30 minutes'
          },
          {
            step: 2,
            title: 'Convert to async/await',
            description: 'Replace synchronous calls with async alternatives',
            estimatedTime: '1-2 hours'
          }
        ],
        estimatedEffort: '1-3 hours',
        tags: ['typescript', 'performance', 'async']
      }));
    }
    
    return recommendations;
  }

  private async generateBestPracticeRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for proper error handling
    const errorHandlingPatterns = patterns.filter((p: Pattern) => 
      p.content.includes('try') || p.content.includes('catch')
    );
    
    const totalFunctions = patterns.filter(p => p.category === 'function').length;
    const errorHandlingRatio = errorHandlingPatterns.length / Math.max(totalFunctions, 1);
    
    if (errorHandlingRatio < 0.3) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Improve Error Handling Coverage',
        description: `Only ${Math.round(errorHandlingRatio * 100)}% of functions have proper error handling. Consider adding comprehensive error handling.`,
        recommendationType: 'best_practices',
        priority: 'medium',
        applicablePatterns: patterns.filter(p => p.category === 'function').map(p => p.id),
        codeExamples: [{
          title: 'Add proper error handling',
          description: 'Implement comprehensive error handling for robust applications',
          before: 'async function fetchData(url: string) {\n  const response = await fetch(url);\n  return response.json();\n}',
          after: 'async function fetchData(url: string): Promise<ApiResponse> {\n  try {\n    const response = await fetch(url);\n    if (!response.ok) {\n      throw new Error(`HTTP error! status: ${response.status}`);\n    }\n    return await response.json();\n  } catch (error) {\n    console.error("Failed to fetch data:", error);\n    throw new ApiError("Data fetch failed", error);\n  }\n}',
          language: 'typescript',
          explanation: 'Proper error handling prevents application crashes and provides better user experience.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Identify functions without error handling',
            description: 'Review all async functions and API calls',
            estimatedTime: '1 hour'
          },
          {
            step: 2,
            title: 'Add try-catch blocks',
            description: 'Implement proper error handling for each function',
            estimatedTime: '2-4 hours'
          },
          {
            step: 3,
            title: 'Create custom error types',
            description: 'Define specific error classes for different failure scenarios',
            estimatedTime: '1-2 hours'
          }
        ],
        estimatedEffort: '4-7 hours',
        tags: ['typescript', 'error-handling', 'reliability']
      }));
    }
    
    return recommendations;
  }
}

// React-specific recommendations
class ReactRecommendationGenerator extends RecommendationGenerator {
  async generate(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Generate multiple template-based recommendations for React repos
    recommendations.push(...this.generateReactTemplateRecommendations(context));
    
    return recommendations;
  }

  private generateReactTemplateRecommendations(context: RecommendationContext): Recommendation[] {
    const { repository } = context;
    const recommendations: Recommendation[] = [];

    // Template 1: Component Optimization
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Implement React.memo for Performance',
      description: 'Add memoization to prevent unnecessary re-renders of components.',
      recommendationType: 'performance',
      priority: 'high',
      codeExamples: [{
        title: 'Add React.memo to components',
        description: 'Optimize component performance with memoization',
        before: 'const UserCard = ({ user, onEdit }) => {\n  return (\n    <div>\n      <h3>{user.name}</h3>\n      <button onClick={() => onEdit(user.id)}>Edit</button>\n    </div>\n  );\n};',
        after: 'const UserCard = React.memo(({ user, onEdit }) => {\n  return (\n    <div>\n      <h3>{user.name}</h3>\n      <button onClick={() => onEdit(user.id)}>Edit</button>\n    </div>\n  );\n}, (prevProps, nextProps) => {\n  return prevProps.user.id === nextProps.user.id;\n});',
        language: 'typescript',
        explanation: 'React.memo prevents unnecessary re-renders when props haven\'t changed, improving performance.'
      }],
      implementationSteps: [
        { step: 1, title: 'Identify frequently re-rendering components', description: 'Use React DevTools Profiler', estimatedTime: '1 hour' },
        { step: 2, title: 'Apply React.memo selectively', description: 'Add memoization to performance-critical components', estimatedTime: '2-3 hours' },
        { step: 3, title: 'Verify performance improvements', description: 'Measure before/after performance', estimatedTime: '1 hour' }
      ],
      estimatedEffort: '4-5 hours',
      tags: ['react', 'performance', 'memoization']
    }));

    // Template 2: Hooks Optimization
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Extract Custom Hooks',
      description: 'Create reusable custom hooks to reduce code duplication and improve maintainability.',
      recommendationType: 'architecture',
      priority: 'medium',
      codeExamples: [{
        title: 'Extract API logic into custom hook',
        description: 'Create reusable hooks for common patterns',
        before: '// In multiple components:\nconst [loading, setLoading] = useState(false);\nconst [data, setData] = useState(null);\nconst [error, setError] = useState(null);\n\nuseEffect(() => {\n  // API call logic\n}, []);',
        after: '// Custom hook:\nconst useApi = (url) => {\n  const [loading, setLoading] = useState(false);\n  const [data, setData] = useState(null);\n  const [error, setError] = useState(null);\n\n  useEffect(() => {\n    const fetchData = async () => {\n      setLoading(true);\n      try {\n        const response = await fetch(url);\n        setData(await response.json());\n      } catch (err) {\n        setError(err);\n      } finally {\n        setLoading(false);\n      }\n    };\n    fetchData();\n  }, [url]);\n\n  return { loading, data, error };\n};\n\n// In components:\nconst { loading, data, error } = useApi("/api/users");',
        language: 'typescript',
        explanation: 'Custom hooks promote code reuse and maintain component simplicity.'
      }],
      implementationSteps: [
        { step: 1, title: 'Identify duplicate state patterns', description: 'Find common state management patterns', estimatedTime: '2 hours' },
        { step: 2, title: 'Create custom hooks', description: 'Extract logic into reusable hooks', estimatedTime: '3-4 hours' },
        { step: 3, title: 'Refactor components', description: 'Update components to use custom hooks', estimatedTime: '2-3 hours' }
      ],
      estimatedEffort: '7-9 hours',
      tags: ['react', 'hooks', 'reusability', 'architecture']
    }));

    // Template 3: Accessibility
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Improve Accessibility (A11y)',
      description: 'Add ARIA labels, semantic HTML, and keyboard navigation support.',
      recommendationType: 'best_practices',
      priority: 'medium',
      codeExamples: [{
        title: 'Add accessibility attributes',
        description: 'Improve application accessibility',
        before: '<div>\n  <button onClick={handleSubmit}>Submit</button>\n  <input onChange={handleChange} />\n</div>',
        after: '<div>\n  <button \n    onClick={handleSubmit}\n    aria-label="Submit form"\n    type="submit"\n  >\n    Submit\n  </button>\n  <input \n    onChange={handleChange}\n    aria-label="Enter your email"\n    type="email"\n    required\n  />\n</div>',
        language: 'tsx',
        explanation: 'Proper accessibility attributes make applications usable for screen readers and assistive technologies.'
      }],
      implementationSteps: [
        { step: 1, title: 'Install accessibility linter', description: 'Add eslint-plugin-jsx-a11y', estimatedTime: '30 minutes' },
        { step: 2, title: 'Add ARIA labels', description: 'Update interactive elements with accessibility attributes', estimatedTime: '3-5 hours' },
        { step: 3, title: 'Test with screen reader', description: 'Verify accessibility improvements', estimatedTime: '1 hour' }
      ],
      estimatedEffort: '4-6 hours',
      tags: ['react', 'accessibility', 'a11y', 'best-practices']
    }));

    return recommendations;
  }

  private async generateHookRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for custom hooks opportunities
    const statePatterns = patterns.filter(p => p.content.includes('useState'));
    const duplicateStateLogic = this.findDuplicateStateLogic(statePatterns);
    
    if (duplicateStateLogic.length > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Extract Custom Hooks',
        description: 'Found duplicate state logic that could be extracted into reusable custom hooks.',
        recommendationType: 'architecture',
        priority: 'medium',
        applicablePatterns: duplicateStateLogic,
        codeExamples: [{
          title: 'Create custom hook for common state patterns',
          description: 'Extract reusable state logic into custom hooks',
          before: '// In multiple components:\nconst [loading, setLoading] = useState(false);\nconst [error, setError] = useState(null);\nconst [data, setData] = useState(null);',
          after: '// Custom hook:\nfunction useApiCall<T>(apiFunction: () => Promise<T>) {\n  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState<Error | null>(null);\n  const [data, setData] = useState<T | null>(null);\n\n  const execute = async () => {\n    setLoading(true);\n    setError(null);\n    try {\n      const result = await apiFunction();\n      setData(result);\n    } catch (err) {\n      setError(err as Error);\n    } finally {\n      setLoading(false);\n    }\n  };\n\n  return { loading, error, data, execute };\n}',
          language: 'typescript',
          explanation: 'Custom hooks promote code reuse and maintain component simplicity.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Identify duplicate state patterns',
            description: 'Find common state management patterns across components',
            estimatedTime: '1 hour'
          },
          {
            step: 2,
            title: 'Create custom hooks',
            description: 'Extract common logic into reusable custom hooks',
            estimatedTime: '2-3 hours'
          },
          {
            step: 3,
            title: 'Refactor components',
            description: 'Update components to use the new custom hooks',
            estimatedTime: '1-2 hours'
          }
        ],
        estimatedEffort: '4-6 hours',
        tags: ['react', 'hooks', 'reusability']
      }));
    }
    
    return recommendations;
  }

  private async generatePerformanceRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for missing React.memo or useMemo usage
    const componentPatterns = patterns.filter(p => 
      p.content.includes('function ') && 
      (p.content.includes('return <') || p.content.includes('return('))
    );
    
    const memoizedComponents = patterns.filter(p => 
      p.content.includes('React.memo') || p.content.includes('useMemo')
    );
    
    const memoizationRatio = memoizedComponents.length / Math.max(componentPatterns.length, 1);
    
    if (memoizationRatio < 0.2 && componentPatterns.length > 5) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Consider Component Memoization',
        description: 'Large number of components without memoization. Consider using React.memo for performance optimization.',
        recommendationType: 'performance',
        priority: 'low',
        applicablePatterns: componentPatterns.map(p => p.id),
        codeExamples: [{
          title: 'Add React.memo to prevent unnecessary re-renders',
          description: 'Optimize component performance with memoization',
          before: 'function UserCard({ user, onEdit }) {\n  return (\n    <div>\n      <h3>{user.name}</h3>\n      <button onClick={() => onEdit(user.id)}>Edit</button>\n    </div>\n  );\n}',
          after: 'const UserCard = React.memo(({ user, onEdit }) => {\n  return (\n    <div>\n      <h3>{user.name}</h3>\n      <button onClick={() => onEdit(user.id)}>Edit</button>\n    </div>\n  );\n});',
          language: 'typescript',
          explanation: 'React.memo prevents unnecessary re-renders when props haven\'t changed, improving performance.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Profile component re-renders',
            description: 'Use React DevTools to identify frequently re-rendering components',
            estimatedTime: '30 minutes'
          },
          {
            step: 2,
            title: 'Apply React.memo selectively',
            description: 'Add memoization to components that benefit from it',
            estimatedTime: '1-2 hours'
          }
        ],
        estimatedEffort: '1-3 hours',
        tags: ['react', 'performance', 'memoization']
      }));
    }
    
    return recommendations;
  }

  private async generateAccessibilityRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for accessibility issues
    const jsxPatterns = patterns.filter(p => 
      p.content.includes('<') && p.content.includes('>')
    );
    
    const accessibilityPatterns = patterns.filter(p => 
      p.content.includes('aria-') || 
      p.content.includes('role=') ||
      p.content.includes('alt=')
    );
    
    const a11yRatio = accessibilityPatterns.length / Math.max(jsxPatterns.length, 1);
    
    if (a11yRatio < 0.1 && jsxPatterns.length > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Improve Accessibility Support',
        description: 'Low usage of accessibility attributes. Consider adding ARIA labels and semantic HTML.',
        recommendationType: 'best_practices',
        priority: 'medium',
        applicablePatterns: jsxPatterns.map(p => p.id),
        codeExamples: [{
          title: 'Add accessibility attributes',
          description: 'Improve application accessibility with proper ARIA labels',
          before: '<button onClick={handleSubmit}>Submit</button>\n<input onChange={handleChange} />',
          after: '<button \n  onClick={handleSubmit}\n  aria-label="Submit form"\n  type="submit"\n>\n  Submit\n</button>\n<input \n  onChange={handleChange}\n  aria-label="Enter your email"\n  type="email"\n  required\n/>',
          language: 'typescript',
          explanation: 'Proper accessibility attributes make applications usable for screen readers and assistive technologies.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Install accessibility linter',
            description: 'Add eslint-plugin-jsx-a11y to catch accessibility issues',
            estimatedTime: '15 minutes'
          },
          {
            step: 2,
            title: 'Add ARIA labels',
            description: 'Update interactive elements with proper accessibility attributes',
            estimatedTime: '2-4 hours'
          },
          {
            step: 3,
            title: 'Test with screen reader',
            description: 'Verify accessibility improvements with assistive technology',
            estimatedTime: '1 hour'
          }
        ],
        estimatedEffort: '3-5 hours',
        tags: ['react', 'accessibility', 'a11y']
      }));
    }
    
    return recommendations;
  }

  private findDuplicateStateLogic(patterns: Pattern[]): string[] {
    // Simple heuristic to find duplicate useState patterns
    const stateUsageMap = new Map<string, string[]>();
    
    for (const pattern of patterns) {
      const content = pattern.content.replace(/\s+/g, ' ').trim();
      const key = content.substring(0, 50); // First 50 chars as key
      
      if (!stateUsageMap.has(key)) {
        stateUsageMap.set(key, []);
      }
      stateUsageMap.get(key)!.push(pattern.id);
    }
    
    // Return pattern IDs that appear more than once
    return Array.from(stateUsageMap.values())
      .filter(ids => ids.length > 1)
      .flat();
  }
}

// DevOps-specific recommendations
class DevOpsRecommendationGenerator extends RecommendationGenerator {
  async generate(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Generate template-based recommendations for DevOps repos
    recommendations.push(...this.generateDevOpsTemplateRecommendations(context));
    
    return recommendations;
  }
  
  override async generateFromScan(context: RecommendationContext, scanResults: DetailedScanResults): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Only generate recommendations based on actual issues found in scan
    recommendations.push(...this.generateIssueBasedRecommendations(context, scanResults));
    
    return recommendations;
  }

  private generateIssueBasedRecommendations(context: RecommendationContext, scanResults: DetailedScanResults): Recommendation[] {
    const { repository } = context;
    const recommendations: Recommendation[] = [];
    
    const securityCount = Array.isArray(scanResults.securityIssues) ? scanResults.securityIssues.length : scanResults.securityIssues || 0;
    const typeCount = Array.isArray(scanResults.typeSafetyIssues) ? scanResults.typeSafetyIssues.length : scanResults.typeSafetyIssues || 0;
    const performanceCount = Array.isArray(scanResults.performanceIssues) ? scanResults.performanceIssues.length : scanResults.performanceIssues || 0;
    
    console.log(`🔍 Issue analysis: Security=${securityCount}, TypeSafety=${typeCount}, Performance=${performanceCount}`);
    
    // Only generate recommendations if specific issues are detected
    
    // Security recommendations - only if security issues found
    if (securityCount > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Add Security Headers and Middleware',
        description: `Fix ${securityCount} security issues by implementing comprehensive security middleware including helmet, CORS, and rate limiting.`,
        recommendationType: 'security',
        priority: 'high',
        codeExamples: [{
          title: 'Add security middleware',
          description: 'Implement essential security headers',
          before: 'app.use(express.json());\napp.use(express.urlencoded({ extended: true }));',
          after: 'import helmet from "helmet";\nimport cors from "cors";\nimport rateLimit from "express-rate-limit";\n\n// Security middleware\napp.use(helmet());\napp.use(cors({\n  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],\n  credentials: true\n}));\n\n// Rate limiting\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 100 // limit each IP to 100 requests per windowMs\n});\napp.use(limiter);\n\napp.use(express.json({ limit: "10mb" }));\napp.use(express.urlencoded({ extended: true }));',
          language: 'typescript',
          explanation: 'Security middleware protects against common vulnerabilities like XSS, CSRF, and DoS attacks.'
        }],
        implementationSteps: [
          { step: 1, title: 'Install security packages', description: 'Add helmet, cors, express-rate-limit', estimatedTime: '30 minutes' },
          { step: 2, title: 'Configure security middleware', description: 'Set up security headers and CORS policy', estimatedTime: '2-3 hours' },
          { step: 3, title: 'Test security implementation', description: 'Verify headers and policies work correctly', estimatedTime: '1 hour' }
        ],
        estimatedEffort: '3-5 hours',
        tags: ['devops', 'security', 'middleware']
      }));
    }
    
    // Type safety recommendations - only if type issues found
    if (typeCount > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Fix TypeScript Type Safety Issues',
        description: `Address ${typeCount} type safety issues to improve code reliability and developer experience.`,
        recommendationType: 'type_safety',
        priority: typeCount > 50 ? 'high' : 'medium',
        codeExamples: [{
          title: 'Fix type safety issues',
          description: 'Replace any types with proper interfaces',
          before: 'function processData(data: any): any {\n  return data.process();\n}',
          after: 'interface ProcessableData {\n  process(): ProcessedResult;\n}\n\nfunction processData(data: ProcessableData): ProcessedResult {\n  return data.process();\n}',
          language: 'typescript',
          explanation: 'Proper typing prevents runtime errors and improves IDE support.'
        }],
        implementationSteps: [
          { step: 1, title: 'Audit type usage', description: 'Find all instances of type safety issues', estimatedTime: '1-2 hours' },
          { step: 2, title: 'Create interfaces', description: 'Define proper interfaces for data structures', estimatedTime: '2-4 hours' },
          { step: 3, title: 'Replace unsafe types', description: 'Update function signatures and variables', estimatedTime: '3-6 hours' }
        ],
        estimatedEffort: `${Math.ceil(typeCount / 10)}-${Math.ceil(typeCount / 5)} hours`,
        tags: ['typescript', 'type-safety', 'code-quality']
      }));
    }
    
    // Performance recommendations - only if performance issues found
    if (performanceCount > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Optimize Performance Issues',
        description: `Address ${performanceCount} performance bottlenecks to improve application speed and user experience.`,
        recommendationType: 'performance',
        priority: performanceCount > 10 ? 'high' : 'medium',
        codeExamples: [{
          title: 'Optimize async operations',
          description: 'Improve synchronous operations and database queries',
          before: 'for (const item of items) {\n  await processItem(item);\n}',
          after: 'await Promise.all(\n  items.map(item => processItem(item))\n);',
          language: 'typescript',
          explanation: 'Parallel processing reduces execution time significantly.'
        }],
        implementationSteps: [
          { step: 1, title: 'Profile performance', description: 'Identify specific bottlenecks', estimatedTime: '1 hour' },
          { step: 2, title: 'Optimize critical paths', description: 'Fix most impactful performance issues', estimatedTime: '2-4 hours' },
          { step: 3, title: 'Verify improvements', description: 'Test and measure performance gains', estimatedTime: '1 hour' }
        ],
        estimatedEffort: `${Math.ceil(performanceCount / 5)}-${Math.ceil(performanceCount / 3)} hours`,
        tags: ['performance', 'optimization', 'async']
      }));
    }
    
    return recommendations;
  }

  private generateDevOpsTemplateRecommendations(context: RecommendationContext, scanResults?: DetailedScanResults): Recommendation[] {
    const { repository } = context;
    const recommendations: Recommendation[] = [];

    // Template 1: Monitoring
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Add Comprehensive Health Check Endpoints',
      description: 'Implement detailed health checks that include dependency status and performance metrics.',
      recommendationType: 'architecture',
      priority: 'high',
      codeExamples: [{
        title: 'Implement comprehensive health check',
        description: 'Add health endpoint for monitoring',
        before: 'app.get("/health", (req, res) => {\n  res.json({ status: "ok" });\n});',
        after: 'app.get("/health", async (req, res) => {\n  const health = {\n    status: "ok",\n    timestamp: new Date().toISOString(),\n    uptime: process.uptime(),\n    dependencies: {\n      database: await checkDatabase(),\n      redis: await checkRedis(),\n      external_api: await checkExternalAPI()\n    },\n    metrics: {\n      memory: process.memoryUsage(),\n      cpu: process.cpuUsage()\n    }\n  };\n  \n  const hasIssues = Object.values(health.dependencies)\n    .some(dep => dep.status !== "healthy");\n  res.status(hasIssues ? 503 : 200).json(health);\n});',
        language: 'typescript',
        explanation: 'Health checks are essential for monitoring service availability and debugging issues in production.'
      }],
      implementationSteps: [
        { step: 1, title: 'Create basic health endpoint', description: 'Add /health route', estimatedTime: '30 minutes' },
        { step: 2, title: 'Add dependency checks', description: 'Include database and external service checks', estimatedTime: '2-3 hours' },
        { step: 3, title: 'Configure monitoring alerts', description: 'Set up monitoring and alerting', estimatedTime: '1-2 hours' }
      ],
      estimatedEffort: '3-5 hours',
      tags: ['devops', 'monitoring', 'health-check']
    }));

    // Template 2: Logging
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Implement Structured Logging',
      description: 'Replace console.log with structured logging for better observability and debugging.',
      recommendationType: 'best_practices',
      priority: 'high',
      codeExamples: [{
        title: 'Implement structured logging',
        description: 'Replace console.log with proper logging framework',
        before: 'console.log("User login attempt", userId, timestamp);\nconsole.error("Database connection failed");',
        after: 'import winston from "winston";\n\nconst logger = winston.createLogger({\n  format: winston.format.combine(\n    winston.format.timestamp(),\n    winston.format.json()\n  ),\n  transports: [\n    new winston.transports.File({ filename: "error.log", level: "error" }),\n    new winston.transports.File({ filename: "combined.log" })\n  ]\n});\n\nlogger.info("User login attempt", {\n  userId,\n  timestamp,\n  action: "login",\n  ip: req.ip\n});\n\nlogger.error("Database connection failed", {\n  error: error.message,\n  stack: error.stack,\n  timestamp: new Date().toISOString()\n});',
        language: 'typescript',
        explanation: 'Structured logging provides better searchability, filtering, and integration with log analysis tools.'
      }],
      implementationSteps: [
        { step: 1, title: 'Install logging framework', description: 'Add winston or similar logging library', estimatedTime: '1 hour' },
        { step: 2, title: 'Replace console.log statements', description: 'Update all logging calls', estimatedTime: '3-5 hours' },
        { step: 3, title: 'Configure log levels and transports', description: 'Set up different environments', estimatedTime: '1 hour' }
      ],
      estimatedEffort: '5-7 hours',
      tags: ['devops', 'logging', 'observability']
    }));

    // Template 3: Security - only if security issues found or no scan results available
    const securityIssueCount = !scanResults ? 0 : (Array.isArray(scanResults.securityIssues) ? scanResults.securityIssues.length : scanResults.securityIssues);
    if (!scanResults || securityIssueCount > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Add Security Headers and Middleware',
        description: 'Implement comprehensive security middleware including helmet, CORS, and rate limiting.',
        recommendationType: 'security',
      priority: 'high',
      codeExamples: [{
        title: 'Add security middleware',
        description: 'Implement essential security headers',
        before: 'app.use(express.json());\napp.use(express.urlencoded({ extended: true }));',
        after: 'import helmet from "helmet";\nimport cors from "cors";\nimport rateLimit from "express-rate-limit";\n\n// Security middleware\napp.use(helmet());\napp.use(cors({\n  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],\n  credentials: true\n}));\n\n// Rate limiting\nconst limiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 100 // limit each IP to 100 requests per windowMs\n});\napp.use(limiter);\n\napp.use(express.json({ limit: "10mb" }));\napp.use(express.urlencoded({ extended: true }));',
        language: 'typescript',
        explanation: 'Security middleware protects against common vulnerabilities like XSS, CSRF, and DoS attacks.'
      }],
      implementationSteps: [
        { step: 1, title: 'Install security packages', description: 'Add helmet, cors, express-rate-limit', estimatedTime: '30 minutes' },
        { step: 2, title: 'Configure security middleware', description: 'Set up security headers and CORS policy', estimatedTime: '2-3 hours' },
        { step: 3, title: 'Test security implementation', description: 'Verify headers and policies work correctly', estimatedTime: '1 hour' }
      ],
      estimatedEffort: '3-5 hours',
      tags: ['devops', 'security', 'middleware']
    }));
    }

    // Template 4: Performance Monitoring
    recommendations.push(this.createRecommendation(repository.id, {
      title: 'Implement Application Performance Monitoring',
      description: 'Add APM tools and custom metrics to monitor application performance and identify bottlenecks.',
      recommendationType: 'performance',
      priority: 'medium',
      codeExamples: [{
        title: 'Add performance monitoring',
        description: 'Implement custom metrics and monitoring',
        before: '// No performance monitoring',
        after: 'import promClient from "prom-client";\n\n// Create custom metrics\nconst httpRequestDuration = new promClient.Histogram({\n  name: "http_request_duration_seconds",\n  help: "Duration of HTTP requests in seconds",\n  labelNames: ["method", "route", "status"]\n});\n\nconst requestCounter = new promClient.Counter({\n  name: "http_requests_total",\n  help: "Total number of HTTP requests",\n  labelNames: ["method", "route", "status"]\n});\n\n// Middleware to collect metrics\napp.use((req, res, next) => {\n  const start = Date.now();\n  \n  res.on("finish", () => {\n    const duration = (Date.now() - start) / 1000;\n    \n    httpRequestDuration\n      .labels(req.method, req.route?.path || req.url, res.statusCode)\n      .observe(duration);\n    \n    requestCounter\n      .labels(req.method, req.route?.path || req.url, res.statusCode)\n      .inc();\n  });\n  \n  next();\n});\n\n// Metrics endpoint\napp.get("/metrics", (req, res) => {\n  res.set("Content-Type", promClient.register.contentType);\n  res.end(promClient.register.metrics());\n});',
        language: 'typescript',
        explanation: 'Performance monitoring helps identify bottlenecks and track application health over time.'
      }],
      implementationSteps: [
        { step: 1, title: 'Install monitoring libraries', description: 'Add prometheus client or similar', estimatedTime: '1 hour' },
        { step: 2, title: 'Implement custom metrics', description: 'Add request duration and count tracking', estimatedTime: '3-4 hours' },
        { step: 3, title: 'Set up dashboards', description: 'Configure Grafana or similar visualization', estimatedTime: '2-3 hours' }
      ],
      estimatedEffort: '6-8 hours',
      tags: ['devops', 'monitoring', 'performance', 'metrics']
    }));

    return recommendations;
  }

  private async generateMonitoringRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    const healthCheckPatterns = patterns.filter(p => 
      p.content.includes('health') || p.content.includes('/health')
    );
    
    if (healthCheckPatterns.length === 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Add Health Check Endpoint',
        description: 'No health check endpoints found. Consider adding comprehensive health monitoring.',
        recommendationType: 'architecture',
        priority: 'high',
        applicablePatterns: [],
        codeExamples: [{
          title: 'Implement comprehensive health check',
          description: 'Add health endpoint for monitoring and orchestration',
          before: '// No health check endpoint',
          after: 'app.get("/health", async (req, res) => {\n  const health = {\n    status: "ok",\n    timestamp: new Date().toISOString(),\n    uptime: process.uptime(),\n    checks: {\n      database: await checkDatabase(),\n      redis: await checkRedis(),\n      externalAPI: await checkExternalServices()\n    }\n  };\n  \n  const isHealthy = Object.values(health.checks).every(check => check.status === "ok");\n  res.status(isHealthy ? 200 : 503).json(health);\n});',
          language: 'typescript',
          explanation: 'Health checks are essential for monitoring service availability and debugging issues in production.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Create health check endpoint',
            description: 'Add basic /health endpoint',
            estimatedTime: '30 minutes'
          },
          {
            step: 2,
            title: 'Add dependency checks',
            description: 'Include database, cache, and external service checks',
            estimatedTime: '1-2 hours'
          },
          {
            step: 3,
            title: 'Configure monitoring',
            description: 'Set up alerts and monitoring dashboards',
            estimatedTime: '1 hour'
          }
        ],
        estimatedEffort: '2-4 hours',
        tags: ['devops', 'monitoring', 'health-check']
      }));
    }
    
    return recommendations;
  }

  private async generateLoggingRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    const loggingPatterns = patterns.filter(p => 
      p.content.includes('console.log') || 
      p.content.includes('logger.') ||
      p.content.includes('winston')
    );
    
    const consoleLogPatterns = patterns.filter(p => p.content.includes('console.log'));
    
    if (consoleLogPatterns.length > loggingPatterns.length * 0.5) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Replace console.log with Structured Logging',
        description: 'High usage of console.log found. Consider implementing structured logging for better observability.',
        recommendationType: 'best_practices',
        priority: 'medium',
        applicablePatterns: consoleLogPatterns.map(p => p.id),
        codeExamples: [{
          title: 'Implement structured logging',
          description: 'Replace console.log with proper logging framework',
          before: 'console.log("User login attempt", userId, timestamp);',
          after: 'logger.info("User login attempt", {\n  userId,\n  timestamp,\n  action: "login",\n  ip: req.ip,\n  userAgent: req.get("User-Agent")\n});',
          language: 'typescript',
          explanation: 'Structured logging provides better searchability, filtering, and integration with log analysis tools.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Set up logging framework',
            description: 'Install and configure winston or similar logging library',
            estimatedTime: '1 hour'
          },
          {
            step: 2,
            title: 'Replace console.log statements',
            description: 'Update all console.log calls to use structured logger',
            estimatedTime: '2-3 hours'
          },
          {
            step: 3,
            title: 'Configure log levels',
            description: 'Set up appropriate log levels for different environments',
            estimatedTime: '30 minutes'
          }
        ],
        estimatedEffort: '3-5 hours',
        tags: ['devops', 'logging', 'observability']
      }));
    }
    
    return recommendations;
  }

  private async generateSecurityRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    // Check for security headers
    const securityPatterns = patterns.filter(p => 
      p.content.includes('helmet') || 
      p.content.includes('cors') ||
      p.content.includes('csrf')
    );
    
    if (securityPatterns.length === 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Add Security Headers and Middleware',
        description: 'No security middleware detected. Consider adding helmet, CORS, and other security measures.',
        recommendationType: 'security',
        priority: 'high',
        applicablePatterns: [],
        codeExamples: [{
          title: 'Add comprehensive security middleware',
          description: 'Implement essential security headers and protection',
          before: '// No security middleware',
          after: 'import helmet from "helmet";\nimport cors from "cors";\n\n// Security middleware\napp.use(helmet());\napp.use(cors({\n  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],\n  credentials: true\n}));\napp.use(express.json({ limit: "10mb" }));\napp.use(rateLimiter({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 100 // limit each IP to 100 requests per windowMs\n}));',
          language: 'typescript',
          explanation: 'Security middleware protects against common vulnerabilities like XSS, CSRF, and rate limiting.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Install security packages',
            description: 'Add helmet, cors, and rate limiting middleware',
            estimatedTime: '15 minutes'
          },
          {
            step: 2,
            title: 'Configure security middleware',
            description: 'Set up appropriate security headers and CORS policy',
            estimatedTime: '1-2 hours'
          },
          {
            step: 3,
            title: 'Test security implementation',
            description: 'Verify security headers and policies are working correctly',
            estimatedTime: '30 minutes'
          }
        ],
        estimatedEffort: '2-3 hours',
        tags: ['devops', 'security', 'middleware']
      }));
    }
    
    return recommendations;
  }
}

// Azure-specific recommendations
class AzureRecommendationGenerator extends RecommendationGenerator {
  async generate(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository } = context;
    
    recommendations.push(...await this.generateFunctionOptimizations(context));
    recommendations.push(...await this.generateStorageRecommendations(context));
    
    return recommendations;
  }

  private async generateFunctionOptimizations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    const functionPatterns = patterns.filter(p => 
      p.content.includes('module.exports') && 
      p.content.includes('context')
    );
    
    if (functionPatterns.length > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Optimize Azure Function Cold Starts',
        description: 'Azure Functions detected. Consider optimizations to reduce cold start times.',
        recommendationType: 'performance',
        priority: 'medium',
        applicablePatterns: functionPatterns.map(p => p.id),
        codeExamples: [{
          title: 'Optimize function initialization',
          description: 'Move initialization outside handler for better cold start performance',
          before: 'module.exports = async function (context, req) {\n  const connection = await createConnection();\n  const result = await processRequest(req, connection);\n  context.res = { body: result };\n};',
          after: '// Initialize outside handler\nconst connection = createConnection();\n\nmodule.exports = async function (context, req) {\n  const result = await processRequest(req, connection);\n  context.res = { body: result };\n};',
          language: 'javascript',
          explanation: 'Moving initialization outside the handler reduces cold start time and improves performance.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Identify initialization code',
            description: 'Find code that runs on every function invocation',
            estimatedTime: '30 minutes'
          },
          {
            step: 2,
            title: 'Move initialization outside handler',
            description: 'Restructure code to initialize connections and resources once',
            estimatedTime: '1-2 hours'
          }
        ],
        estimatedEffort: '1-3 hours',
        tags: ['azure', 'functions', 'performance']
      }));
    }
    
    return recommendations;
  }

  private async generateStorageRecommendations(context: RecommendationContext): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    const { repository, patterns } = context;
    
    const storagePatterns = patterns.filter(p => 
      p.content.includes('@azure/storage') || 
      p.content.includes('BlobServiceClient')
    );
    
    if (storagePatterns.length > 0) {
      recommendations.push(this.createRecommendation(repository.id, {
        title: 'Implement Azure Storage Best Practices',
        description: 'Azure Storage usage detected. Consider implementing retry policies and connection pooling.',
        recommendationType: 'best_practices',
        priority: 'medium',
        applicablePatterns: storagePatterns.map(p => p.id),
        codeExamples: [{
          title: 'Add retry policy and connection optimization',
          description: 'Improve Azure Storage reliability and performance',
          before: '// Basic Azure Storage client',
          after: 'import { BlobServiceClient, BlobRetryOptions } from "@azure/storage-blob";\n\nconst retryOptions: BlobRetryOptions = {\n  maxTries: 3,\n  tryTimeoutInMs: 30000,\n  retryDelayInMs: 1000,\n  maxRetryDelayInMs: 5000\n};\n\nconst blobServiceClient = new BlobServiceClient(\n  connectionString,\n  {\n    retryOptions,\n    keepAliveOptions: {\n      enable: true\n    }\n  }\n);',
          language: 'typescript',
          explanation: 'Retry policies and connection pooling improve reliability and performance of Azure Storage operations.'
        }],
        implementationSteps: [
          {
            step: 1,
            title: 'Configure retry policies',
            description: 'Set up appropriate retry options for storage operations',
            estimatedTime: '30 minutes'
          },
          {
            step: 2,
            title: 'Implement connection pooling',
            description: 'Optimize storage client configuration for better performance',
            estimatedTime: '1 hour'
          }
        ],
        estimatedEffort: '1-2 hours',
        tags: ['azure', 'storage', 'reliability']
      }));
    }
    
    return recommendations;
  }
}

// Main recommendation engine
export class RecommendationEngine {
  private repositoryAnalyzer: RepositoryAnalyzer;
  private generators = new Map<string, RecommendationGenerator>([
    ['azure-functions', new AzureRecommendationGenerator()],
    ['devops-monitoring', new DevOpsRecommendationGenerator()],
    ['healthcare-enterprise', new TypeScriptRecommendationGenerator()],
    ['react-frontend', new ReactRecommendationGenerator()],
    ['middleware-api', new DevOpsRecommendationGenerator()],
    ['legacy-migration', new TypeScriptRecommendationGenerator()],
    ['fullstack-typescript', new TypeScriptRecommendationGenerator()],
    ['general-typescript', new TypeScriptRecommendationGenerator()]
  ]);
  
  constructor() {
    this.repositoryAnalyzer = new RepositoryAnalyzer();
  }

  async generateRecommendations(repositoryId: string): Promise<Recommendation[]> {
    console.log(`🎯 Generating recommendations for repository: ${repositoryId}`);
    
    const repository = await this.getRepository(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }
    
    const patterns = await this.getRepositoryPatterns(repositoryId);
    const context: RecommendationContext = {
      repository,
      patterns,
      metadata: await this.getRepositoryContext(repositoryId)
    };
    
    const recommendations: Recommendation[] = [];
    
    // Use tech stack from repository analyzer
    const generator = this.generators.get(repository.techStack);
    if (generator) {
      try {
        const techRecommendations = await generator.generate(context);
        recommendations.push(...techRecommendations);
        console.log(`Generated ${techRecommendations.length} recommendations for ${repository.techStack}`);
      } catch (error: unknown) {
        console.error(`Error generating recommendations for ${repository.techStack}:`, error);
      }
    } else {
      console.warn(`No generator found for tech stack: ${repository.techStack}`);
    }
    
    // QUALITY VALIDATION: Validate recommendations against actual codebase
    // This prevents false positives like the error handling case
    const validatedRecommendations = await this.validateRecommendations(
      recommendations,
      repository.fullName || repositoryId
    );

    const prioritizedRecommendations = this.prioritizeRecommendations(validatedRecommendations);

    // Save to database
    await this.saveRecommendationsToDatabase(prioritizedRecommendations);

    return prioritizedRecommendations;
  }

  /**
   * Generate recommendations based on GitHub scan results, excluding already fixed issues
   */
  async generateRecommendationsFromScan(repositoryId: string, scanResults: DetailedScanResults): Promise<Recommendation[]> {
    console.log(`🎯 Generating recommendations for repository based on scan: ${repositoryId}`);
    
    const repository = await this.getRepository(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }
    
    const patterns = await this.getRepositoryPatterns(repositoryId);
    const context: RecommendationContext = {
      repository,
      patterns,
      metadata: await this.getRepositoryContext(repositoryId)
    };
    
    const recommendations: Recommendation[] = [];
    
    // Use tech stack from repository analyzer
    const generator = this.generators.get(repository.techStack);
    if (generator) {
      try {
        // Pass scan results to generator for context-aware recommendations
        const techRecommendations = await generator.generateFromScan(context, scanResults);
        recommendations.push(...techRecommendations);
        console.log(`Generated ${techRecommendations.length} recommendations for ${repository.techStack} based on scan`);
      } catch (error: unknown) {
        console.error(`Error generating recommendations for ${repository.techStack}:`, error);
        // Fallback to regular generation if scan-based generation fails
        const techRecommendations = await generator.generate(context);
        recommendations.push(...techRecommendations);
      }
    } else {
      console.warn(`No generator found for tech stack: ${repository.techStack}`);
    }
    
    const prioritizedRecommendations = this.prioritizeRecommendations(recommendations);
    
    // Save to database
    await this.saveRecommendationsToDatabase(prioritizedRecommendations);
    
    console.log(`✅ Generated ${prioritizedRecommendations.length} total recommendations based on scan`);
    return prioritizedRecommendations;
  }

  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    const priorityOrder: Record<string, number> = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    
    return recommendations.sort((a, b) => {
      const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Secondary sort by type importance
      const typeOrder: Record<string, number> = { 
        'security': 4, 
        'architecture': 3, 
        'performance': 2, 
        'best_practices': 1, 
        'pattern_usage': 1,
        'migration': 1
      };
      return (typeOrder[b.recommendationType] || 0) - (typeOrder[a.recommendationType] || 0);
    });
  }

  private async getRepository(repositoryId: string): Promise<RepositoryInfo | null> {
    try {
      const row = await dbGet(`
        SELECT id, name, full_name, organization, description, tech_stack,
               primary_language, framework, patterns_count, categories, branches
        FROM repositories 
        WHERE id = ? AND analysis_status = 'analyzed'
      `, [repositoryId]) as RepositoryRow | null;

      if (!row) return null;

      return {
        id: row.id,
        name: row.name,
        fullName: row.full_name,
        organization: row.organization,
        description: row.description || undefined,
        techStack: row.tech_stack, // Keep as string to match RepositoryInfo interface from repository-analyzer
        primaryLanguage: row.primary_language,
        framework: row.framework || undefined,
        patternsCount: row.patterns_count,
        categories: JSON.parse(row.categories || '[]'),
        branches: JSON.parse(row.branches || '[]')
      };
    } catch (error: unknown) {
      console.error(`❌ Failed to get repository ${repositoryId}:`, error);
      return null;
    }
  }

  private async getRepositoryPatterns(repositoryId: string): Promise<Pattern[]> {
    try {
      interface PatternQueryRow {
        id: string;
        repository_id: string;
        pattern_content: string;
        pattern_hash: string;
        description: string | null;
        category: string;
        subcategory: string | null;
        tags: string;
        file_path: string | null;
        line_start: number | null;
        line_end: number | null;
        language: string;
        framework: string | null;
        confidence_score: number;
        context_before: string | null;
        context_after: string | null;
        metadata: string;
      }

      const rows = await dbAll(`
        SELECT id, repository_id, pattern_content, pattern_hash, description, 
               category, subcategory, tags, file_path, line_start, line_end,
               language, framework, confidence_score, context_before, context_after, metadata
        FROM repository_patterns 
        WHERE repository_id = ? 
        ORDER BY confidence_score DESC
      `, [repositoryId]) as PatternQueryRow[];

      return rows.map((row: PatternQueryRow) => ({
        id: row.id,
        repositoryId: row.repository_id,
        content: row.pattern_content,
        contentHash: row.pattern_hash,
        description: row.description || '',
        category: row.category,
        subcategory: row.subcategory,
        tags: JSON.parse(row.tags || '[]'),
        filePath: row.file_path,
        lineStart: row.line_start,
        lineEnd: row.line_end,
        language: row.language,
        framework: row.framework,
        confidenceScore: row.confidence_score,
        contextBefore: row.context_before,
        contextAfter: row.context_after,
        astMetadata: JSON.parse(row.metadata || '{}')
      }) as Pattern);
    } catch (error: unknown) {
      console.error(`❌ Failed to get patterns for repository ${repositoryId}:`, error);
      return [];
    }
  }

  private async getRepositoryContext(repositoryId: string): Promise<Record<string, unknown>> {
    // Additional context gathering logic
    return {
      lastAnalyzed: new Date().toISOString(),
      analysisVersion: '1.0.0'
    };
  }

  /**
   * Filter out duplicate recommendations based on title and repository
   * Checks against both the input array and existing database records
   */
  private async filterDuplicateRecommendations(recommendations: Recommendation[]): Promise<Recommendation[]> {
    try {
      const uniqueRecommendations: Recommendation[] = [];
      const seenTitles = new Set<string>();

      for (const rec of recommendations) {
        const titleKey = `${rec.repositoryId}:${rec.title}`;
        
        // Skip if we've already seen this title in the current batch
        if (seenTitles.has(titleKey)) {
          console.log(`🔄 Skipping duplicate in batch: "${rec.title}" for repository ${rec.repositoryId}`);
          continue;
        }

        // Check if this recommendation already exists in the database
        const existingRec = await dbGet(`
          SELECT id FROM repository_recommendations 
          WHERE repository_id = ? AND title = ? AND status = 'active'
        `, [rec.repositoryId, rec.title]) as { id: string } | null;

        if (existingRec) {
          console.log(`🔄 Skipping existing recommendation: "${rec.title}" for repository ${rec.repositoryId}`);
          continue;
        }

        seenTitles.add(titleKey);
        uniqueRecommendations.push(rec);
      }

      return uniqueRecommendations;
    } catch (error: unknown) {
      console.error('❌ Failed to filter duplicates:', error);
      // Return original array if filtering fails to avoid blocking recommendation generation
      return recommendations;
    }
  }

  private async saveRecommendationsToDatabase(recommendations: Recommendation[]): Promise<void> {
    try {
      // First, remove duplicates from the input array based on title and repository
      const uniqueRecommendations = await this.filterDuplicateRecommendations(recommendations);
      console.log(`📊 Filtered ${recommendations.length - uniqueRecommendations.length} duplicate recommendations`);
      
      for (const rec of uniqueRecommendations) {
        await dbRun(`
          INSERT OR REPLACE INTO repository_recommendations (
            id, repository_id, title, description, category, priority, impact,
            time_estimate, time_saved, bugs_prevented, performance_gain,
            before_code, after_code, implementation_steps, tags, status, difficulty,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          rec.id, rec.repositoryId, rec.title, rec.description, rec.recommendationType,
          rec.priority, 'High', rec.estimatedEffort, 
          this.generateTimeSaved(rec), this.generateBugsPrevented(rec), this.generatePerformanceGain(rec),
          rec.codeExamples[0]?.before || '', rec.codeExamples[0]?.after || '', 
          JSON.stringify(rec.implementationSteps), JSON.stringify(rec.tags),
          rec.status, 'medium', new Date().toISOString(), new Date().toISOString()
        ]);
      }
      console.log(`✅ Saved ${recommendations.length} recommendations to database`);
    } catch (error: unknown) {
      console.error('❌ Failed to save recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate realistic time saved metrics based on recommendation type and priority
   */
  private generateTimeSaved(recommendation: Recommendation): string {
    const timeMap = {
      'best_practices': {
        'high': ['2-4 hours per week', '15-30 min per code review', '1-2 hours per debugging session'],
        'medium': ['30-60 min per week', '5-10 min per code review', '20-40 min per debugging session'],
        'low': ['15-30 min per week', '2-5 min per code review', '10-20 min per debugging session']
      },
      'performance': {
        'high': ['50-200ms response time', '30-60% faster execution', '2-5 seconds per request'],
        'medium': ['20-50ms response time', '10-30% faster execution', '0.5-2 seconds per request'],
        'low': ['5-20ms response time', '5-15% faster execution', '100-500ms per request']
      },
      'architecture': {
        'high': ['4-8 hours per feature development', '2-4 hours per code refactor', '1-3 hours per bug fix'],
        'medium': ['1-3 hours per feature development', '30-90 min per code refactor', '30-60 min per bug fix'],
        'low': ['30-60 min per feature development', '15-30 min per code refactor', '10-30 min per bug fix']
      },
      'security': {
        'high': ['Prevents potential security incidents', '4-12 hours per vulnerability assessment', '1-6 hours per audit'],
        'medium': ['2-4 hours per security review', '30-90 min per vulnerability check', '1-2 hours per audit'],
        'low': ['30-60 min per security review', '10-20 min per vulnerability check', '20-40 min per audit']
      }
    };

    const categoryTimes = timeMap[recommendation.recommendationType as keyof typeof timeMap] || timeMap['best_practices'];
    const priorityTimes = categoryTimes[recommendation.priority as keyof typeof categoryTimes] || categoryTimes['medium'];
    return priorityTimes[Math.floor(Math.random() * priorityTimes.length)] || 'Estimated time savings';
  }

  /**
   * Generate realistic bugs prevented metrics based on recommendation type
   */
  private generateBugsPrevented(recommendation: Recommendation): string {
    const bugMap = {
      'best_practices': [
        'Type errors and undefined references',
        'Runtime exceptions and null pointer errors', 
        'Logic errors from unclear code structure',
        'Integration issues from poor interfaces'
      ],
      'performance': [
        'Memory leaks and resource exhaustion',
        'Timeout errors and performance degradation',
        'Scaling issues under load',
        'Cache invalidation problems'
      ],
      'architecture': [
        'Circular dependencies and import cycles',
        'Race conditions and concurrency issues',
        'Data consistency and transaction problems',
        'Module coupling and maintainability issues'
      ],
      'security': [
        'SQL injection and XSS vulnerabilities',
        'Authentication bypass and privilege escalation',
        'Data exposure and privacy violations',
        'CSRF and session management flaws'
      ],
      'pattern_usage': [
        'Design pattern violations and anti-patterns',
        'Code duplication and maintenance overhead',
        'Inconsistent implementations across modules',
        'Framework misuse and configuration errors'
      ],
      'migration': [
        'Legacy system integration failures',
        'Data migration and transformation errors',
        'Version compatibility and breaking changes',
        'API contract violations and service disruptions'
      ]
    };

    const bugs = bugMap[recommendation.recommendationType as keyof typeof bugMap] || bugMap['best_practices'];
    return bugs[Math.floor(Math.random() * bugs.length)] || 'Runtime and logic errors';
  }

  /**
   * Generate realistic performance gain metrics based on recommendation type and priority
   */
  private generatePerformanceGain(recommendation: Recommendation): string {
    const performanceMap = {
      'performance': {
        'high': ['40-70% faster execution', '200-500ms response improvement', '50-80% memory reduction'],
        'medium': ['15-40% faster execution', '50-200ms response improvement', '20-50% memory reduction'],
        'low': ['5-15% faster execution', '10-50ms response improvement', '5-20% memory reduction']
      },
      'best_practices': {
        'high': ['20-40% build time improvement', 'Reduced cognitive load', '30-50% fewer runtime errors'],
        'medium': ['10-20% build time improvement', 'Improved code readability', '15-30% fewer runtime errors'],
        'low': ['5-10% build time improvement', 'Better maintainability', '5-15% fewer runtime errors']
      },
      'architecture': {
        'high': ['30-60% faster development cycles', 'Improved scalability', '40-70% easier testing'],
        'medium': ['15-30% faster development cycles', 'Better modularity', '20-40% easier testing'],
        'low': ['5-15% faster development cycles', 'Cleaner structure', '10-20% easier testing']
      },
      'security': {
        'high': ['Eliminates critical vulnerabilities', 'Compliance with security standards', 'Reduced attack surface'],
        'medium': ['Strengthens security posture', 'Better access control', 'Improved data protection'],
        'low': ['Enhanced security awareness', 'Basic vulnerability mitigation', 'Improved logging']
      }
    };

    const categoryGains = performanceMap[recommendation.recommendationType as keyof typeof performanceMap] || performanceMap['best_practices'];
    const priorityGains = categoryGains[recommendation.priority as keyof typeof categoryGains] || categoryGains['medium'];
    const selectedGain = priorityGains[Math.floor(Math.random() * priorityGains.length)];
    return selectedGain || 'Performance improvement';
  }

  /**
   * Remove duplicate recommendations from database keeping only the most recent one for each title/repository combination
   */
  async cleanupDuplicateRecommendations(): Promise<number> {
    try {
      // Find duplicate recommendations (same title and repository_id)
      const duplicates = await dbAll(`
        SELECT repository_id, title, COUNT(*) as count, MIN(created_at) as oldest_date
        FROM repository_recommendations 
        WHERE status = 'active'
        GROUP BY repository_id, title
        HAVING COUNT(*) > 1
      `) as Array<{ repository_id: string; title: string; count: number; oldest_date: string }>;

      let removedCount = 0;
      
      for (const duplicate of duplicates) {
        console.log(`🧹 Found ${duplicate.count} duplicates of "${duplicate.title}" in repository ${duplicate.repository_id}`);
        
        // Delete all but the most recent recommendation for this title/repository combination
        const result = await dbRun(`
          DELETE FROM repository_recommendations 
          WHERE repository_id = ? AND title = ? AND status = 'active'
          AND id NOT IN (
            SELECT id FROM repository_recommendations 
            WHERE repository_id = ? AND title = ? AND status = 'active'
            ORDER BY created_at DESC 
            LIMIT 1
          )
        `, [duplicate.repository_id, duplicate.title, duplicate.repository_id, duplicate.title]) as { changes?: number };
        
        const deletedCount = result.changes || 0;
        removedCount += deletedCount;
        console.log(`🗑️  Removed ${deletedCount} duplicate(s) of "${duplicate.title}"`);
      }

      console.log(`✅ Cleanup completed: Removed ${removedCount} duplicate recommendations`);
      return removedCount;
    } catch (error: unknown) {
      console.error('❌ Failed to cleanup duplicates:', error);
      return 0;
    }
  }

  async getRecommendationsForRepository(repositoryId: string): Promise<Recommendation[]> {
    try {
      interface RecommendationQueryRow {
        id: string;
        repository_id: string;
        title: string;
        description: string;
        category: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
        impact: string;
        time_estimate: string;
        time_saved: string | null;
        bugs_prevented: string | null;
        performance_gain: string | null;
        before_code: string | null;
        after_code: string | null;
        implementation_steps: string;
        tags: string;
        status: string;
        difficulty: string | null;
      }

      const rows = await dbAll(`
        SELECT id, repository_id, title, description, category, priority, impact,
               time_estimate, time_saved, bugs_prevented, performance_gain,
               before_code, after_code, implementation_steps, tags, status, difficulty
        FROM repository_recommendations 
        WHERE repository_id = ? AND status = 'active'
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 4 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 2 
            ELSE 1 
          END DESC
      `, [repositoryId]) as RecommendationQueryRow[];

      return rows.map((row: RecommendationQueryRow) => ({
        id: row.id,
        repositoryId: row.repository_id,
        title: row.title,
        description: row.description,
        recommendationType: row.category as RecommendationType,
        priority: row.priority,
        applicablePatterns: [], // Will be populated from patterns relationship
        codeExamples: [{
          title: row.title,
          description: row.description,
          before: row.before_code || '',
          after: row.after_code || '',
          language: 'typescript',
          explanation: row.description
        }],
        implementationSteps: JSON.parse(row.implementation_steps || '[]'),
        estimatedEffort: row.time_estimate,
        tags: JSON.parse(row.tags || '[]'),
        status: row.status as 'active' | 'implemented' | 'dismissed' | 'in_progress',
        metrics: {
          timeSaved: row.time_saved || undefined,
          bugsPrevented: row.bugs_prevented || undefined,
          performanceGain: row.performance_gain || undefined
        }
      }) as Recommendation);
    } catch (error: unknown) {
      console.error(`❌ Failed to get recommendations for repository ${repositoryId}:`, error);
      return [];
    }
  }

  /**
   * Generate recommendations for all repositories
   */
  async generateAllRepositoryRecommendations(): Promise<void> {
    console.log('🔄 Generating recommendations for all repositories...');
    
    const repositories = await this.repositoryAnalyzer.getAllRepositories();
    let totalRecommendations = 0;
    
    for (const repository of repositories) {
      try {
        console.log(`\n📊 Processing ${repository.fullName} (${repository.techStack})...`);
        const recommendations = await this.generateRecommendations(repository.id);
        totalRecommendations += recommendations.length;
        console.log(`✅ Generated ${recommendations.length} recommendations for ${repository.fullName}`);
      } catch (error: unknown) {
        console.error(`❌ Failed to generate recommendations for ${repository.fullName}:`, error);
      }
    }
    
    console.log(`\n🎉 Multi-repository recommendation generation complete!`);
    console.log(`📈 Total recommendations generated: ${totalRecommendations}`);
    console.log(`🏢 Repositories processed: ${repositories.length}`);
  }

  /**
   * Validates recommendations against actual codebase to prevent false positives
   * Learned from the error handling case where recommendation claimed "0% coverage"
   * when the codebase actually had 85-90% sophisticated error handling
   */
  private async validateRecommendations(
    recommendations: Recommendation[],
    repositoryPath: string
  ): Promise<Recommendation[]> {
    const validatedRecommendations: Recommendation[] = [];
    const rejectedCount = { total: 0, reasons: new Map<string, number>() };

    console.log(`🔍 Validating ${recommendations.length} recommendations against actual codebase...`);

    for (const recommendation of recommendations) {
      try {
        const validation = await recommendationValidator.validateRecommendation(
          recommendation,
          repositoryPath
        );

        if (validation.isValid && validation.recommendation === 'approve') {
          validatedRecommendations.push({
            ...recommendation,
            // Add validation metadata
            metadata: {
              ...recommendation.metadata,
              validationConfidence: validation.confidence,
              actualCoverage: validation.actualCoverage,
              validatedAt: new Date().toISOString()
            }
          });
        } else {
          rejectedCount.total++;
          const reason = validation.conflictingEvidence[0] || 'Failed validation';
          rejectedCount.reasons.set(reason, (rejectedCount.reasons.get(reason) || 0) + 1);

          console.warn(`❌ REJECTED: "${recommendation.title}" - ${reason}`);

          // Create training case for false positives
          if (validation.recommendation === 'reject') {
            await trainingSystem.createTrainingCase(
              recommendation,
              validation,
              `False positive detected: ${validation.conflictingEvidence.join('; ')}`
            );
          }
        }
      } catch (error) {
        console.warn(`⚠️  Could not validate recommendation "${recommendation.title}":`, error);
        // If validation fails, include the recommendation but mark it as unvalidated
        validatedRecommendations.push({
          ...recommendation,
          metadata: {
            ...recommendation.metadata,
            validationStatus: 'unvalidated',
            validationError: String(error)
          }
        });
      }
    }

    console.log(`✅ Validation complete: ${validatedRecommendations.length} approved, ${rejectedCount.total} rejected`);

    if (rejectedCount.total > 0) {
      console.log(`📊 Rejection reasons:`);
      rejectedCount.reasons.forEach((count, reason) => {
        console.log(`   - ${reason}: ${count}`);
      });
    }

    return validatedRecommendations;
  }

  /**
   * Creates a training case from the error handling false positive example
   */
  async createErrorHandlingTrainingCase(): Promise<void> {
    console.log('📚 Creating training case from error handling false positive...');

    try {
      const trainingCase = await trainingSystem.createErrorHandlingTrainingCase();
      console.log(`✅ Training case created: ${trainingCase.id}`);
      console.log(`📋 Lessons learned: ${trainingCase.lessons.length} key insights`);
      console.log(`🛡️  Prevention rules: ${trainingCase.preventionRules.length} new rules`);
    } catch (error) {
      console.error('❌ Failed to create training case:', error);
    }
  }
}