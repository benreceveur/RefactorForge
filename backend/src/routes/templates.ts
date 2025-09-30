import { Router, Request, Response } from 'express';
import { TemplateEngine, TemplateRenderContext } from '../services/template-engine';
import { Template, TemplateVariable, TemplateVariableValue, TemplateGenerationRequest, TemplateGenerationResult, TemplateSearchCriteria, TemplateSearchResult } from '../types/template.types';
import { TemplateRow } from '../types/database.types';
import { ApiResponse, PaginatedResponse } from '../types/common.types';

const router = Router();
const templateEngine = new TemplateEngine();

// Template generation and rendering endpoints

// POST /api/templates/generate - Generate templates for a repository
router.post('/generate', async (req: Request, res: Response) => {
  const { repositoryId, categories, languages } = req.body;
  
  try {
    if (!repositoryId) {
      return res.status(400).json({ error: 'Repository ID is required' });
    }

    console.log(`🎨 Generating templates for repository: ${repositoryId}`);
    const templates = await templateEngine.generateTemplates(repositoryId);
    
    let filteredTemplates = templates;
    
    // Apply category filter if specified
    if (categories && Array.isArray(categories)) {
      filteredTemplates = filteredTemplates.filter(t => 
        categories.includes(t.category)
      );
    }
    
    // Apply language filter if specified
    if (languages && Array.isArray(languages)) {
      filteredTemplates = filteredTemplates.filter(t => 
        t.applicableLanguages.some(lang => languages.includes(lang))
      );
    }
    
    res.json({
      repositoryId,
      templates: filteredTemplates,
      summary: {
        total: filteredTemplates.length,
        byCategory: filteredTemplates.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        byLanguage: filteredTemplates.reduce((acc, t) => {
          t.applicableLanguages.forEach(lang => {
            acc[lang] = (acc[lang] || 0) + 1;
          });
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (error: unknown) {
    console.error('Template generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate templates', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/render - Render a template with variables
router.post('/render', async (req: Request, res: Response) => {
  const { 
    templateId, 
    variables, 
    repository,
    targetFile,
    insertionPoint = 'cursor' 
  } = req.body;
  
  try {
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }
    
    if (!variables) {
      return res.status(400).json({ error: 'Template variables are required' });
    }

    const context: TemplateRenderContext = {
      variables,
      repository,
      targetFile,
      insertionPoint
    };
    
    const rendered = await templateEngine.renderTemplate(templateId, context);
    
    res.json({
      templateId,
      rendered,
      context: {
        variables,
        targetFile,
        insertionPoint
      },
      metadata: {
        length: rendered.length,
        lines: rendered.split('\n').length
      }
    });
    
  } catch (error: unknown) {
    console.error('Template rendering error:', error);
    res.status(500).json({ 
      error: 'Failed to render template', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/repository/:id - Get templates for a specific repository
router.get('/repository/:id', async (req: Request, res: Response) => {
  const repositoryId = req.params.id;
  
  if (!repositoryId) {
    return res.status(400).json({ error: 'Repository ID is required' });
  }
  const { 
    category, 
    language, 
    framework,
    limit = '20',
    offset = '0'
  } = req.query;
  
  try {
    console.log(`📋 Fetching templates for repository: ${repositoryId}`);
    let templates = await templateEngine.generateTemplates(repositoryId);
    
    // Apply filters
    if (category) {
      templates = templates.filter(t => t.category === category);
    }
    
    if (language) {
      templates = templates.filter(t => 
        t.applicableLanguages.includes(language as string)
      );
    }
    
    if (framework) {
      templates = templates.filter(t => 
        t.applicableFrameworks.includes(framework as string) ||
        t.applicableFrameworks.includes('any')
      );
    }
    
    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedTemplates = templates.slice(startIndex, endIndex);
    
    res.json({
      repositoryId,
      templates: paginatedTemplates,
      pagination: {
        total: templates.length,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: endIndex < templates.length
      },
      filters: {
        category,
        language,
        framework
      }
    });
    
  } catch (error: unknown) {
    console.error('Repository templates fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch repository templates', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/categories - Get available template categories
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // These would typically come from analyzing all templates in the database
    const categories = [
      {
        name: 'interface',
        displayName: 'Interfaces',
        description: 'TypeScript interface definitions',
        count: 0,
        languages: ['typescript']
      },
      {
        name: 'function',
        displayName: 'Functions',
        description: 'Function definitions with proper typing',
        count: 0,
        languages: ['typescript', 'javascript']
      },
      {
        name: 'class',
        displayName: 'Classes',
        description: 'Class definitions and patterns',
        count: 0,
        languages: ['typescript', 'javascript']
      },
      {
        name: 'component',
        displayName: 'Components',
        description: 'React functional components',
        count: 0,
        languages: ['typescript', 'javascript']
      },
      {
        name: 'hook',
        displayName: 'Hooks',
        description: 'Custom React hooks',
        count: 0,
        languages: ['typescript', 'javascript']
      },
      {
        name: 'pattern',
        displayName: 'Design Patterns',
        description: 'Common design patterns and architectural structures',
        count: 0,
        languages: ['typescript', 'javascript']
      },
      {
        name: 'service',
        displayName: 'Services',
        description: 'Service layer implementations',
        count: 0,
        languages: ['typescript', 'javascript']
      },
      {
        name: 'configuration',
        displayName: 'Configuration',
        description: 'Configuration files and setup code',
        count: 0,
        languages: ['typescript', 'javascript', 'json']
      }
    ];
    
    res.json({
      categories,
      total: categories.length,
      summary: {
        totalTemplates: categories.reduce((sum, cat) => sum + cat.count, 0),
        languageSupport: {
          typescript: categories.filter(c => c.languages.includes('typescript')).length,
          javascript: categories.filter(c => c.languages.includes('javascript')).length,
          react: categories.filter(c => ['component', 'hook'].includes(c.name)).length
        }
      }
    });
    
  } catch (error: unknown) {
    console.error('Categories fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch template categories', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/validate - Validate template variables
router.post('/validate', async (req: Request, res: Response) => {
  const { templateId, variables } = req.body;
  
  try {
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }
    
    if (!variables) {
      return res.status(400).json({ error: 'Variables are required for validation' });
    }

    // Get template to access its variable definitions
    const template = await templateEngine.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const validationResults = validateTemplateVariables(template.variables, variables);
    const isValid = validationResults.every(result => result.isValid);
    
    res.json({
      templateId,
      isValid,
      validationResults,
      summary: {
        totalVariables: template.variables.length,
        validVariables: validationResults.filter(r => r.isValid).length,
        invalidVariables: validationResults.filter(r => !r.isValid).length
      }
    });
    
  } catch (error: unknown) {
    console.error('Template validation error:', error);
    res.status(500).json({ 
      error: 'Failed to validate template', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/preview - Preview rendered template without saving
router.post('/preview', async (req: Request, res: Response) => {
  const { template, variables } = req.body;
  
  try {
    if (!template) {
      return res.status(400).json({ error: 'Template content is required' });
    }
    
    if (!variables) {
      return res.status(400).json({ error: 'Variables are required' });
    }

    // Create a temporary template engine instance for preview
    const tempEngine = new (class extends TemplateEngine {
      async previewTemplate(templateContent: string, vars: Record<string, TemplateVariableValue>): Promise<string> {
        return this['templateRenderer'].render(templateContent, vars);
      }
    })();
    
    const preview = await (tempEngine as TemplateEngine & { previewTemplate: (content: string, vars: Record<string, TemplateVariableValue>) => Promise<string> }).previewTemplate(template, variables);
    
    res.json({
      template: template.substring(0, 200) + (template.length > 200 ? '...' : ''),
      variables,
      preview,
      metadata: {
        templateLength: template.length,
        previewLength: preview.length,
        previewLines: preview.split('\n').length,
        variablesUsed: Object.keys(variables).length
      }
    });
    
  } catch (error: unknown) {
    console.error('Template preview error:', error);
    res.status(500).json({ 
      error: 'Failed to preview template', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/templates/popular - Get most popular/used templates
router.get('/popular', async (req: Request, res: Response) => {
  const { 
    language, 
    category, 
    timeframe = '30d',
    limit = '10' 
  } = req.query;
  
  try {
    // This would typically query usage statistics from database
    const popularTemplates = [
      {
        id: 'typescript-interface',
        name: 'TypeScript Interface',
        description: 'Generate a TypeScript interface with common properties',
        category: 'interface',
        language: 'typescript',
        usageCount: 145,
        rating: 4.8,
        lastUsed: new Date().toISOString()
      },
      {
        id: 'react-component',
        name: 'React Component',
        description: 'Generate a React functional component with TypeScript',
        category: 'component',
        language: 'typescript',
        usageCount: 123,
        rating: 4.7,
        lastUsed: new Date().toISOString()
      },
      {
        id: 'typescript-function',
        name: 'TypeScript Function',
        description: 'Generate a TypeScript function with proper typing and error handling',
        category: 'function',
        language: 'typescript',
        usageCount: 98,
        rating: 4.6,
        lastUsed: new Date().toISOString()
      },
      {
        id: 'custom-hook',
        name: 'Custom React Hook',
        description: 'Generate a custom React hook with state and effects',
        category: 'hook',
        language: 'typescript',
        usageCount: 87,
        rating: 4.5,
        lastUsed: new Date().toISOString()
      },
      {
        id: 'repository-pattern',
        name: 'Repository Pattern',
        description: 'Generate a repository class for data access',
        category: 'pattern',
        language: 'typescript',
        usageCount: 76,
        rating: 4.4,
        lastUsed: new Date().toISOString()
      }
    ];
    
    let filtered = popularTemplates;
    
    if (language) {
      filtered = filtered.filter(t => t.language === language);
    }
    
    if (category) {
      filtered = filtered.filter(t => t.category === category);
    }
    
    // Apply limit
    const limitNum = parseInt(limit as string);
    filtered = filtered.slice(0, limitNum);
    
    res.json({
      templates: filtered,
      timeframe,
      filters: { language, category },
      summary: {
        totalShown: filtered.length,
        averageUsage: filtered.reduce((sum, t) => sum + t.usageCount, 0) / filtered.length,
        averageRating: filtered.reduce((sum, t) => sum + t.rating, 0) / filtered.length,
        topCategories: filtered.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    });
    
  } catch (error: unknown) {
    console.error('Popular templates fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch popular templates', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/templates/usage - Record template usage (for analytics)
router.post('/usage', async (req: Request, res: Response) => {
  const { 
    templateId, 
    repositoryId, 
    success = true, 
    rating,
    feedback 
  } = req.body;
  
  try {
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }

    // Here we would typically update usage statistics in the database
    console.log(`📊 Recording usage for template: ${templateId}`);
    
    const usageRecord = {
      templateId,
      repositoryId,
      success,
      rating,
      feedback,
      timestamp: new Date().toISOString()
    };
    
    // In a real implementation, save to database
    // await saveTemplateUsage(usageRecord);
    
    res.json({
      message: 'Usage recorded successfully',
      usageRecord
    });
    
  } catch (error: unknown) {
    console.error('Usage recording error:', error);
    res.status(500).json({ 
      error: 'Failed to record usage', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions

interface ValidationResult {
  variableName: string;
  isValid: boolean;
  errors: string[];
  value: TemplateVariableValue;
}

function validateTemplateVariables(
  templateVariables: TemplateVariable[], 
  providedVariables: Record<string, TemplateVariableValue>
): ValidationResult[] {
  return templateVariables.map(templateVar => {
    const result: ValidationResult = {
      variableName: templateVar.name,
      isValid: true,
      errors: [],
      value: providedVariables[templateVar.name] || ''
    };
    
    const value = providedVariables[templateVar.name];
    
    // Check if required variable is provided
    if (templateVar.required && (value === undefined || value === null)) {
      result.isValid = false;
      result.errors.push(`Required variable '${templateVar.name}' is missing`);
      return result;
    }
    
    // Skip further validation if variable is not provided and not required
    if (value === undefined || value === null) {
      return result;
    }
    
    // Type validation
    const expectedType = templateVar.type;
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    
    if (actualType !== expectedType) {
      result.isValid = false;
      result.errors.push(`Expected type '${expectedType}' but got '${actualType}'`);
    }
    
    // Validation rules
    if (templateVar.validation) {
      const validation = templateVar.validation;
      
      // Pattern validation for strings
      if (validation.pattern && typeof value === 'string') {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          result.isValid = false;
          result.errors.push(`Value does not match required pattern: ${validation.pattern}`);
        }
      }
      
      // Min/max validation for numbers
      if (typeof value === 'number') {
        if (validation.min !== undefined && value < validation.min) {
          result.isValid = false;
          result.errors.push(`Value must be at least ${validation.min}`);
        }
        if (validation.max !== undefined && value > validation.max) {
          result.isValid = false;
          result.errors.push(`Value must be at most ${validation.max}`);
        }
      }
      
      // Options validation
      if (validation.enum && !validation.enum.includes(String(value))) {
        result.isValid = false;
        result.errors.push(`Value must be one of: ${validation.enum.join(', ')}`);
      }
    }
    
    return result;
  });
}

export default router;