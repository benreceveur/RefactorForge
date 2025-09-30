import { v4 as uuidv4 } from 'uuid';
import db from '../database';
import { RepositoryInfo } from './repository-analyzer';

// Define Pattern interface locally to avoid import conflicts
export interface Pattern {
  id: string;
  repositoryId: string;
  content: string;
  contentHash: string;
  description: string;
  category: string;
  subcategory: string;
  tags: string[];
  filePath: string;
  lineStart: number;
  lineEnd: number;
  language: string;
  framework: string;
  confidenceScore: number;
  contextBefore: string;
  contextAfter: string;
  astMetadata: Record<string, unknown>;
}

import {
  Template,
  TemplateVariable as TypedTemplateVariable,
  TemplateVariableValue,
  VariableType,
  TemplateMetadata,
  TemplateGenerationRequest,
  TemplateGenerationResult,
  TemplateValidationError,
  TemplateContext,
  TemplateResolution,
  TemplateRow,
  ApiResponse
} from '../types';

// Type definitions
export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  applicableLanguages: string[];
  applicableFrameworks: string[];
  template: string;
  variables: TypedTemplateVariable[];
  examples: TemplateExample[];
  relatedPatterns: string[];
  category: string;
  tags: string[];
  usage: TemplateUsage;
  metadata: TemplateMetadata;
}

export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  defaultValue?: TemplateVariableValue;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface TemplateExample {
  title: string;
  description: string;
  variables: Record<string, TemplateVariableValue>;
  expectedOutput: string;
  explanation: string;
}

export interface TemplateUsage {
  usageCount: number;
  lastUsed?: Date;
  successRate: number;
  averageRating: number;
  repositories: string[];
}

export interface TemplateRenderContext {
  variables: Record<string, TemplateVariableValue>;
  repository?: RepositoryInfo;
  targetFile?: string;
  insertionPoint?: 'top' | 'bottom' | 'cursor';
}

// Template generators for different tech stacks
abstract class TemplateGenerator {
  abstract generateTemplates(
    repository: RepositoryInfo, 
    patterns: Pattern[]
  ): Promise<PatternTemplate[]>;
  
  protected createTemplate(base: Partial<PatternTemplate>): PatternTemplate {
    return {
      id: uuidv4(),
      name: '',
      description: '',
      applicableLanguages: [],
      applicableFrameworks: [],
      template: '',
      variables: [],
      examples: [],
      relatedPatterns: [],
      category: 'general',
      tags: [],
      usage: {
        usageCount: 0,
        successRate: 1.0,
        averageRating: 0,
        repositories: []
      },
      metadata: { tags: [] },
      ...base
    };
  }
}

// TypeScript template generator
class TypeScriptTemplateGenerator extends TemplateGenerator {
  async generateTemplates(repository: RepositoryInfo, patterns: Pattern[]): Promise<PatternTemplate[]> {
    const templates: PatternTemplate[] = [];
    
    // Generate interface templates
    templates.push(...await this.generateInterfaceTemplates(patterns));
    
    // Generate function templates
    templates.push(...await this.generateFunctionTemplates(patterns));
    
    // Generate class templates
    templates.push(...await this.generateClassTemplates(patterns));
    
    // Generate service templates
    templates.push(...await this.generateServiceTemplates(patterns));
    
    return templates;
  }

  private async generateInterfaceTemplates(patterns: Pattern[]): Promise<PatternTemplate[]> {
    const interfacePatterns = patterns.filter(p => 
      p.category === 'interface' || p.content.includes('interface ')
    );
    
    if (interfacePatterns.length === 0) return [];
    
    // Analyze common interface patterns
    const commonProperties = this.extractCommonProperties(interfacePatterns);
    
    return [
      this.createTemplate({
        name: 'TypeScript Interface',
        description: 'Generate a TypeScript interface with common properties',
        applicableLanguages: ['typescript'],
        applicableFrameworks: ['any'],
        category: 'interface',
        tags: ['typescript', 'interface', 'type'],
        template: `interface {{interfaceName}} {
{{#properties}}
  {{name}}{{#optional}}?{{/optional}}: {{type}};{{#description}} // {{description}}{{/description}}
{{/properties}}
{{#extends}}
}

interface {{interfaceName}} extends {{extends}} {
{{/extends}}
{{^extends}}
}
{{/extends}}`,
        variables: [
          {
            name: 'interfaceName',
            type: 'string',
            description: 'Name of the interface',
            required: true,
            validation: { pattern: '^[A-Z][a-zA-Z0-9]*$' }
          },
          {
            name: 'properties',
            type: 'array',
            description: 'Array of properties for the interface',
            required: true,
            defaultValue: JSON.stringify(commonProperties.slice(0, 3))
          },
          {
            name: 'extends',
            type: 'string',
            description: 'Parent interface to extend (optional)',
            required: false
          }
        ],
        examples: [
          {
            title: 'User Interface',
            description: 'A typical user interface with common properties',
            variables: {
              interfaceName: 'User',
              properties: JSON.stringify([
                { name: 'id', type: 'string', optional: false, description: 'Unique identifier' },
                { name: 'name', type: 'string', optional: false, description: 'User name' },
                { name: 'email', type: 'string', optional: true, description: 'Email address' }
              ])
            },
            expectedOutput: `interface User {
  id: string; // Unique identifier
  name: string; // User name
  email?: string; // Email address
}`,
            explanation: 'Creates a standard user interface with ID, name, and optional email'
          }
        ],
        relatedPatterns: interfacePatterns.map(p => p.id)
      })
    ];
  }

  private async generateFunctionTemplates(patterns: Pattern[]): Promise<PatternTemplate[]> {
    const functionPatterns = patterns.filter(p => 
      p.category === 'function' || p.content.includes('function ') || p.content.includes('=>')
    );
    
    if (functionPatterns.length === 0) return [];
    
    const asyncFunctions = functionPatterns.filter(p => p.subcategory === 'async');
    const hasErrorHandling = functionPatterns.some(p => 
      p.content.includes('try') || p.content.includes('catch')
    );
    
    return [
      this.createTemplate({
        name: 'TypeScript Function',
        description: 'Generate a TypeScript function with proper typing and error handling',
        applicableLanguages: ['typescript'],
        applicableFrameworks: ['any'],
        category: 'function',
        tags: ['typescript', 'function', 'async'],
        template: `{{#async}}async {{/async}}function {{functionName}}({{#parameters}}{{name}}: {{type}}{{#hasDefault}} = {{defaultValue}}{{/hasDefault}}{{#sep}}, {{/sep}}{{/parameters}}): {{#async}}Promise<{{returnType}}>{{/async}}{{^async}}{{returnType}}{{/async}} {
{{#errorHandling}}
  try {
{{#indent}}    {{/indent}}{{functionBody}}
{{#errorHandling}}
  } catch (error) {
    console.error('Error in {{functionName}}:', error);
    {{#async}}throw error;{{/async}}{{^async}}return null;{{/async}}
  }
{{/errorHandling}}
}`,
        variables: [
          {
            name: 'functionName',
            type: 'string',
            description: 'Name of the function',
            required: true,
            validation: { pattern: '^[a-z][a-zA-Z0-9]*$' }
          },
          {
            name: 'async',
            type: 'boolean',
            description: 'Whether the function is async',
            required: false,
            defaultValue: asyncFunctions.length > functionPatterns.length * 0.5
          },
          {
            name: 'parameters',
            type: 'array',
            description: 'Function parameters',
            required: false,
            defaultValue: []
          },
          {
            name: 'returnType',
            type: 'string',
            description: 'Return type of the function',
            required: true,
            defaultValue: 'void'
          },
          {
            name: 'functionBody',
            type: 'string',
            description: 'Body of the function',
            required: true,
            defaultValue: '// TODO: Implement function logic'
          },
          {
            name: 'errorHandling',
            type: 'boolean',
            description: 'Include error handling',
            required: false,
            defaultValue: hasErrorHandling
          }
        ],
        examples: [
          {
            title: 'Async API Call Function',
            description: 'Function to make an API call with error handling',
            variables: {
              functionName: 'fetchUserData',
              async: true,
              parameters: JSON.stringify([
                { name: 'userId', type: 'string' }
              ]),
              returnType: 'User',
              functionBody: 'const response = await fetch(`/api/users/${userId}`);\nreturn await response.json();',
              errorHandling: true
            },
            expectedOutput: `async function fetchUserData(userId: string): Promise<User> {
  try {
    const response = await fetch(\`/api/users/\${userId}\`);
    return await response.json();
  } catch (error) {
    console.error('Error in fetchUserData:', error);
    throw error;
  }
}`,
            explanation: 'Creates an async function with proper error handling for API calls'
          }
        ],
        relatedPatterns: functionPatterns.map(p => p.id)
      })
    ];
  }

  private async generateClassTemplates(patterns: Pattern[]): Promise<PatternTemplate[]> {
    const classPatterns = patterns.filter(p => 
      p.category === 'class' || p.content.includes('class ')
    );
    
    if (classPatterns.length === 0) return [];
    
    return [
      this.createTemplate({
        name: 'TypeScript Class',
        description: 'Generate a TypeScript class with constructor and methods',
        applicableLanguages: ['typescript'],
        applicableFrameworks: ['any'],
        category: 'class',
        tags: ['typescript', 'class', 'oop'],
        template: `{{#export}}export {{/export}}{{#abstract}}abstract {{/abstract}}class {{className}}{{#extends}} extends {{extends}}{{/extends}}{{#implements}} implements {{implements}}{{/implements}} {
{{#properties}}
  {{#access}}{{access}} {{/access}}{{#readonly}}readonly {{/readonly}}{{name}}: {{type}};
{{/properties}}

{{#constructor}}
  constructor({{#parameters}}{{name}}: {{type}}{{#sep}}, {{/sep}}{{/parameters}}) {
{{#superCall}}
    super({{#superArgs}}{{.}}{{#sep}}, {{/sep}}{{/superArgs}});
{{/superCall}}
{{#assignments}}
    this.{{property}} = {{value}};
{{/assignments}}
  }
{{/constructor}}

{{#methods}}
  {{#access}}{{access}} {{/access}}{{#async}}async {{/async}}{{name}}({{#parameters}}{{name}}: {{type}}{{#sep}}, {{/sep}}{{/parameters}}): {{#async}}Promise<{{returnType}}>{{/async}}{{^async}}{{returnType}}{{/async}} {
    {{body}}
  }
{{#sep}}

{{/sep}}{{/methods}}
}`,
        variables: [
          {
            name: 'className',
            type: 'string',
            description: 'Name of the class',
            required: true,
            validation: { pattern: '^[A-Z][a-zA-Z0-9]*$' }
          },
          {
            name: 'export',
            type: 'boolean',
            description: 'Export the class',
            required: false,
            defaultValue: true
          },
          {
            name: 'abstract',
            type: 'boolean',
            description: 'Make the class abstract',
            required: false,
            defaultValue: false
          },
          {
            name: 'extends',
            type: 'string',
            description: 'Parent class to extend',
            required: false
          },
          {
            name: 'implements',
            type: 'string',
            description: 'Interface(s) to implement',
            required: false
          },
          {
            name: 'properties',
            type: 'array',
            description: 'Class properties',
            required: false,
            defaultValue: []
          },
          {
            name: 'constructor',
            type: 'object',
            description: 'Constructor configuration',
            required: false
          },
          {
            name: 'methods',
            type: 'array',
            description: 'Class methods',
            required: false,
            defaultValue: []
          }
        ],
        examples: [
          {
            title: 'Service Class',
            description: 'A typical service class with dependency injection',
            variables: {
              className: 'UserService',
              export: true,
              properties: JSON.stringify([
                { access: 'private', name: 'repository', type: 'UserRepository' }
              ]),
              constructor: JSON.stringify({
                parameters: [
                  { name: 'repository', type: 'UserRepository' }
                ],
                assignments: [
                  { property: 'repository', value: 'repository' }
                ]
              }),
              methods: JSON.stringify([
                {
                  access: 'public',
                  async: true,
                  name: 'getUser',
                  parameters: [{ name: 'id', type: 'string' }],
                  returnType: 'User',
                  body: 'return await this.repository.findById(id);'
                }
              ])
            },
            expectedOutput: `export class UserService {
  private repository: UserRepository;

  constructor(repository: UserRepository) {
    this.repository = repository;
  }

  public async getUser(id: string): Promise<User> {
    return await this.repository.findById(id);
  }
}`,
            explanation: 'Creates a service class with dependency injection pattern'
          }
        ],
        relatedPatterns: classPatterns.map(p => p.id)
      })
    ];
  }

  private async generateServiceTemplates(patterns: Pattern[]): Promise<PatternTemplate[]> {
    const servicePatterns = patterns.filter(p => 
      p.content.includes('Service') || 
      p.content.includes('Repository') ||
      p.filePath?.includes('service')
    );
    
    if (servicePatterns.length === 0) return [];
    
    return [
      this.createTemplate({
        name: 'Repository Pattern',
        description: 'Generate a repository class for data access',
        applicableLanguages: ['typescript'],
        applicableFrameworks: ['any'],
        category: 'pattern',
        tags: ['typescript', 'repository', 'pattern', 'database'],
        template: `export interface I{{entityName}}Repository {
  findAll(): Promise<{{entityName}}[]>;
  findById(id: string): Promise<{{entityName}} | null>;
  create(entity: Omit<{{entityName}}, 'id'>): Promise<{{entityName}}>;
  update(id: string, entity: Partial<{{entityName}}>): Promise<{{entityName}} | null>;
  delete(id: string): Promise<boolean>;
}

export class {{entityName}}Repository implements I{{entityName}}Repository {
  constructor({{#database}}private db: Database{{/database}}) {}

  async findAll(): Promise<{{entityName}}[]> {
    // TODO: Implement findAll logic
    throw new Error('Method not implemented');
  }

  async findById(id: string): Promise<{{entityName}} | null> {
    // TODO: Implement findById logic
    throw new Error('Method not implemented');
  }

  async create(entity: Omit<{{entityName}}, 'id'>): Promise<{{entityName}}> {
    // TODO: Implement create logic
    throw new Error('Method not implemented');
  }

  async update(id: string, entity: Partial<{{entityName}}>): Promise<{{entityName}} | null> {
    // TODO: Implement update logic
    throw new Error('Method not implemented');
  }

  async delete(id: string): Promise<boolean> {
    // TODO: Implement delete logic
    throw new Error('Method not implemented');
  }
}`,
        variables: [
          {
            name: 'entityName',
            type: 'string',
            description: 'Name of the entity (e.g., User, Product)',
            required: true,
            validation: { pattern: '^[A-Z][a-zA-Z0-9]*$' }
          },
          {
            name: 'database',
            type: 'boolean',
            description: 'Include database dependency',
            required: false,
            defaultValue: true
          }
        ],
        examples: [
          {
            title: 'User Repository',
            description: 'Repository pattern for User entity',
            variables: {
              entityName: 'User',
              database: true
            },
            expectedOutput: `export interface IUserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  create(entity: Omit<User, 'id'>): Promise<User>;
  update(id: string, entity: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}

export class UserRepository implements IUserRepository {
  constructor(private db: Database) {}

  async findAll(): Promise<User[]> {
    // TODO: Implement findAll logic
    throw new Error('Method not implemented');
  }

  async findById(id: string): Promise<User | null> {
    // TODO: Implement findById logic
    throw new Error('Method not implemented');
  }

  async create(entity: Omit<User, 'id'>): Promise<User> {
    // TODO: Implement create logic
    throw new Error('Method not implemented');
  }

  async update(id: string, entity: Partial<User>): Promise<User | null> {
    // TODO: Implement update logic
    throw new Error('Method not implemented');
  }

  async delete(id: string): Promise<boolean> {
    // TODO: Implement delete logic
    throw new Error('Method not implemented');
  }
}`,
            explanation: 'Generates a complete repository pattern implementation with interface'
          }
        ],
        relatedPatterns: servicePatterns.map(p => p.id)
      })
    ];
  }

  private extractCommonProperties(patterns: Pattern[]): Array<{
    name: string;
    type: string;
    optional: boolean;
    description: string;
  }> {
    // Simplified property extraction - in reality, this would use AST parsing
    const commonProps = [
      { name: 'id', type: 'string', optional: false, description: 'Unique identifier' },
      { name: 'name', type: 'string', optional: false, description: 'Name field' },
      { name: 'createdAt', type: 'Date', optional: true, description: 'Creation timestamp' },
      { name: 'updatedAt', type: 'Date', optional: true, description: 'Last update timestamp' }
    ];
    
    return commonProps;
  }
}

// React template generator
class ReactTemplateGenerator extends TemplateGenerator {
  async generateTemplates(repository: RepositoryInfo, patterns: Pattern[]): Promise<PatternTemplate[]> {
    const templates: PatternTemplate[] = [];
    
    // Generate component templates
    templates.push(...await this.generateComponentTemplates(patterns));
    
    // Generate hook templates
    templates.push(...await this.generateHookTemplates(patterns));
    
    return templates;
  }

  private async generateComponentTemplates(patterns: Pattern[]): Promise<PatternTemplate[]> {
    const componentPatterns = patterns.filter(p => 
      p.content.includes('function ') && 
      (p.content.includes('return <') || p.content.includes('return('))
    );
    
    if (componentPatterns.length === 0) return [];
    
    return [
      this.createTemplate({
        name: 'React Component',
        description: 'Generate a React functional component with TypeScript',
        applicableLanguages: ['typescript', 'javascript'],
        applicableFrameworks: ['react'],
        category: 'component',
        tags: ['react', 'component', 'functional'],
        template: `{{#imports}}
import React{{#hasState}}, { useState{{#hasEffect}}, useEffect{{/hasEffect}} }{{/hasState}} from 'react';
{{#customImports}}
{{#each}}import {{name}} from '{{path}}';
{{/each}}
{{/customImports}}
{{/imports}}

{{#interface}}
interface {{componentName}}Props {
{{#props}}
  {{name}}{{#optional}}?{{/optional}}: {{type}};{{#description}} // {{description}}{{/description}}
{{/props}}
}
{{/interface}}

{{#export}}export {{/export}}{{#default}}default {{/default}}function {{componentName}}({{#hasProps}}{ {{#props}}{{name}}{{#sep}}, {{/sep}}{{/props}} }: {{componentName}}Props{{/hasProps}}) {
{{#state}}
  const [{{name}}, set{{capitalizedName}}] = useState{{#hasType}}<{{type}}>{{/hasType}}({{defaultValue}});
{{/state}}

{{#effects}}
  useEffect(() => {
    {{body}}
  }, [{{#dependencies}}{{.}}{{#sep}}, {{/sep}}{{/dependencies}}]);
{{/effects}}

{{#handlers}}
  const {{name}} = {{#async}}async {{/async}}({{#parameters}}{{name}}: {{type}}{{#sep}}, {{/sep}}{{/parameters}}) => {
    {{body}}
  };
{{/handlers}}

  return (
    {{jsx}}
  );
}`,
        variables: [
          {
            name: 'componentName',
            type: 'string',
            description: 'Name of the component',
            required: true,
            validation: { pattern: '^[A-Z][a-zA-Z0-9]*$' }
          },
          {
            name: 'export',
            type: 'boolean',
            description: 'Export the component',
            required: false,
            defaultValue: true
          },
          {
            name: 'default',
            type: 'boolean',
            description: 'Use default export',
            required: false,
            defaultValue: false
          },
          {
            name: 'props',
            type: 'array',
            description: 'Component props',
            required: false,
            defaultValue: []
          },
          {
            name: 'state',
            type: 'array',
            description: 'Component state variables',
            required: false,
            defaultValue: []
          },
          {
            name: 'effects',
            type: 'array',
            description: 'useEffect hooks',
            required: false,
            defaultValue: []
          },
          {
            name: 'jsx',
            type: 'string',
            description: 'JSX content',
            required: true,
            defaultValue: '<div>\n      <h1>{{componentName}}</h1>\n    </div>'
          }
        ],
        examples: [
          {
            title: 'User Profile Component',
            description: 'A component that displays user profile information',
            variables: {
              componentName: 'UserProfile',
              export: true,
              props: JSON.stringify([
                { name: 'userId', type: 'string', optional: false, description: 'User ID to display' }
              ]),
              state: JSON.stringify([
                { name: 'user', capitalizedName: 'User', type: 'User | null', defaultValue: 'null' },
                { name: 'loading', capitalizedName: 'Loading', type: 'boolean', defaultValue: 'false' }
              ]),
              effects: JSON.stringify([
                {
                  body: 'setLoading(true);\nfetchUser(userId).then(setUser).finally(() => setLoading(false));',
                  dependencies: ['userId']
                }
              ]),
              jsx: '<div>\n      {loading ? <div>Loading...</div> : user ? <h1>{user.name}</h1> : <div>User not found</div>}\n    </div>'
            },
            expectedOutput: `import React, { useState, useEffect } from 'react';

interface UserProfileProps {
  userId: string; // User ID to display
}

export function UserProfile({ userId }: UserProfileProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);

  return (
    <div>
      {loading ? <div>Loading...</div> : user ? <h1>{user.name}</h1> : <div>User not found</div>}
    </div>
  );
}`,
            explanation: 'Creates a React component with state management and effect hooks'
          }
        ],
        relatedPatterns: componentPatterns.map(p => p.id)
      })
    ];
  }

  private async generateHookTemplates(patterns: Pattern[]): Promise<PatternTemplate[]> {
    const hookPatterns = patterns.filter(p => 
      p.content.includes('use') && 
      (p.content.includes('useState') || p.content.includes('useEffect'))
    );
    
    if (hookPatterns.length === 0) return [];
    
    return [
      this.createTemplate({
        name: 'Custom React Hook',
        description: 'Generate a custom React hook with state and effects',
        applicableLanguages: ['typescript', 'javascript'],
        applicableFrameworks: ['react'],
        category: 'hook',
        tags: ['react', 'hook', 'custom'],
        template: `import { useState{{#hasEffect}}, useEffect{{/hasEffect}} } from 'react';

{{#interface}}
interface {{hookName}}Options {
{{#options}}
  {{name}}{{#optional}}?{{/optional}}: {{type}};{{#description}} // {{description}}{{/description}}
{{/options}}
}

interface {{hookName}}Return {
{{#returns}}
  {{name}}: {{type}};{{#description}} // {{description}}{{/description}}
{{/returns}}
}
{{/interface}}

export function {{hookName}}({{#hasOptions}}options: {{hookName}}Options{{/hasOptions}}) {{#hasInterface}}: {{hookName}}Return{{/hasInterface}} {
{{#state}}
  const [{{name}}, set{{capitalizedName}}] = useState{{#hasType}}<{{type}}>{{/hasType}}({{defaultValue}});
{{/state}}

{{#effects}}
  useEffect(() => {
    {{body}}
  }, [{{#dependencies}}{{.}}{{#sep}}, {{/sep}}{{/dependencies}}]);
{{/effects}}

{{#functions}}
  const {{name}} = {{#async}}async {{/async}}({{#parameters}}{{name}}: {{type}}{{#sep}}, {{/sep}}{{/parameters}}) => {
    {{body}}
  };
{{/functions}}

  return {
{{#returns}}
    {{name}}{{#sep}},{{/sep}}
{{/returns}}
  };
}`,
        variables: [
          {
            name: 'hookName',
            type: 'string',
            description: 'Name of the hook (should start with "use")',
            required: true,
            validation: { pattern: '^use[A-Z][a-zA-Z0-9]*$' }
          },
          {
            name: 'options',
            type: 'array',
            description: 'Hook options/parameters',
            required: false,
            defaultValue: []
          },
          {
            name: 'state',
            type: 'array',
            description: 'State variables',
            required: false,
            defaultValue: []
          },
          {
            name: 'effects',
            type: 'array',
            description: 'Effect hooks',
            required: false,
            defaultValue: []
          },
          {
            name: 'functions',
            type: 'array',
            description: 'Helper functions',
            required: false,
            defaultValue: []
          },
          {
            name: 'returns',
            type: 'array',
            description: 'Values to return from the hook',
            required: true,
            defaultValue: []
          }
        ],
        examples: [
          {
            title: 'useApi Hook',
            description: 'Custom hook for API calls with loading and error states',
            variables: {
              hookName: 'useApi',
              options: JSON.stringify([
                { name: 'url', type: 'string', optional: false, description: 'API endpoint URL' }
              ]),
              state: JSON.stringify([
                { name: 'data', capitalizedName: 'Data', type: 'unknown', defaultValue: 'null' },
                { name: 'loading', capitalizedName: 'Loading', type: 'boolean', defaultValue: 'false' },
                { name: 'error', capitalizedName: 'Error', type: 'string | null', defaultValue: 'null' }
              ]),
              effects: JSON.stringify([
                {
                  body: 'const fetchData = async () => {\n      setLoading(true);\n      setError(null);\n      try {\n        const response = await fetch(options.url);\n        const result = await response.json();\n        setData(result);\n      } catch (err) {\n        setError(err.message);\n      } finally {\n        setLoading(false);\n      }\n    };\n    fetchData();',
                  dependencies: ['options.url']
                }
              ]),
              returns: JSON.stringify([
                { name: 'data', type: 'unknown', description: 'API response data' },
                { name: 'loading', type: 'boolean', description: 'Loading state' },
                { name: 'error', type: 'string | null', description: 'Error message if any' }
              ])
            },
            expectedOutput: `import { useState, useEffect } from 'react';

interface useApiOptions {
  url: string; // API endpoint URL
}

interface useApiReturn {
  data: unknown; // API response data
  loading: boolean; // Loading state
  error: string | null; // Error message if any
}

export function useApi(options: useApiOptions): useApiReturn {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(options.url);
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [options.url]);

  return {
    data,
    loading,
    error
  };
}`,
            explanation: 'Creates a reusable API hook with loading and error handling'
          }
        ],
        relatedPatterns: hookPatterns.map(p => p.id)
      })
    ];
  }
}

// Main template engine
export class TemplateEngine {
  private generators = new Map<string, TemplateGenerator>([
    ['typescript', new TypeScriptTemplateGenerator()],
    ['react', new ReactTemplateGenerator()]
  ]);

  private templateRenderer: TemplateRenderer = new TemplateRenderer();

  async generateTemplates(repositoryId: string): Promise<PatternTemplate[]> {
    console.log(`🎨 Generating templates for repository: ${repositoryId}`);
    
    const repository = await this.getRepository(repositoryId);
    if (!repository) {
      throw new Error(`Repository not found: ${repositoryId}`);
    }
    
    const patterns = await this.getRepositoryPatterns(repositoryId);
    const allTemplates: PatternTemplate[] = [];
    
    const techArray = repository.techStack.split(',').map(t => t.trim());
    for (const tech of techArray) {
      const generator = this.generators.get(tech);
      if (generator) {
        try {
          const templates = await generator.generateTemplates(repository, patterns);
          allTemplates.push(...templates);
          console.log(`Generated ${templates.length} templates for ${tech}`);
        } catch (error: unknown) {
          console.error(`Error generating templates for ${tech}:`, error);
        }
      }
    }
    
    // Save templates to database (optional - for caching)
    // await this.saveTemplatesToDatabase(allTemplates);
    
    console.log(`✅ Generated ${allTemplates.length} total templates`);
    return allTemplates;
  }

  async renderTemplate(templateId: string, context: TemplateRenderContext): Promise<string> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    return this.templateRenderer.render(template.template, context.variables);
  }

  async getTemplate(templateId: string): Promise<PatternTemplate | null> {
    // This would typically fetch from database or cache
    // For now, we'll generate on-demand
    return null;
  }

  async getTemplatesByCategory(category: string, language?: string): Promise<PatternTemplate[]> {
    // Implementation would filter templates by category and language
    return [];
  }

  private async getRepository(repositoryId: string): Promise<RepositoryInfo | null> {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM repositories WHERE id = ?',
        [repositoryId],
        (err, row: unknown) => {
          if (err) {
            reject(err);
          } else if (row) {
            const dbRow = row as Record<string, unknown>;
            resolve({
              id: dbRow.id as string,
              name: dbRow.name as string,
              fullName: dbRow.full_name as string,
              organization: dbRow.organization as string,
              description: dbRow.description as string | null,
              techStack: dbRow.tech_stack as string,
              primaryLanguage: dbRow.primary_language as string,
              framework: dbRow.framework as string | null,
              patternsCount: dbRow.patterns_count as number,
              categories: JSON.parse((dbRow.categories as string) || '[]') as string[],
              branches: JSON.parse((dbRow.branches as string) || '[]') as string[],
              // Note: Only including fields that exist in RepositoryInfo interface
            } as RepositoryInfo);
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  private async getRepositoryPatterns(repositoryId: string): Promise<Pattern[]> {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM patterns WHERE repository_id = ? ORDER BY confidence_score DESC',
        [repositoryId],
        (err, rows: unknown[]) => {
          if (err) {
            reject(err);
          } else {
            const patterns = (rows as Record<string, unknown>[]).map((row: Record<string, unknown>) => ({
              id: row.id as string,
              repositoryId: row.repository_id as string,
              content: row.content as string,
              contentHash: row.content_hash as string,
              description: row.description as string,
              category: row.category as string,
              subcategory: row.subcategory as string,
              tags: JSON.parse((row.tags as string) || '[]') as string[],
              filePath: row.file_path as string,
              lineStart: row.line_start as number,
              lineEnd: row.line_end as number,
              language: row.language as string,
              framework: row.framework as string,
              confidenceScore: row.confidence_score as number,
              contextBefore: row.context_before as string,
              contextAfter: row.context_after as string,
              astMetadata: JSON.parse((row.ast_metadata as string) || '{}') as Record<string, unknown>
            }));
            resolve(patterns);
          }
        }
      );
    });
  }
}

// Simple template renderer
class TemplateRenderer {
  render(template: string, variables: Record<string, TemplateVariableValue>): string {
    // Simple template rendering - in production, use a proper template engine like Handlebars
    let rendered = template;
    
    // Replace simple variables {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    // Handle conditional blocks {{#condition}}...{{/condition}}
    rendered = this.handleConditionals(rendered, variables);
    
    // Handle loops {{#array}}...{{/array}}
    rendered = this.handleLoops(rendered, variables);
    
    return rendered;
  }

  private handleConditionals(template: string, variables: Record<string, TemplateVariableValue>): string {
    const conditionalRegex = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;
    
    return template.replace(conditionalRegex, (match, condition, content) => {
      const value = variables[condition];
      return value ? content : '';
    });
  }

  private handleLoops(template: string, variables: Record<string, TemplateVariableValue>): string {
    const loopRegex = /{{#(\w+)}}([\s\S]*?){{\/\1}}/g;
    
    return template.replace(loopRegex, (match, arrayName, content) => {
      const array = variables[arrayName];
      if (!Array.isArray(array)) return '';
      
      return array.map((item, index) => {
        let itemContent = content;
        
        // Replace item properties
        if (typeof item === 'object' && item !== null) {
          for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            itemContent = itemContent.replace(regex, String(value));
          }
        } else {
          itemContent = itemContent.replace(/{{\.}}/g, String(item));
        }
        
        // Handle separators
        const sepRegex = /{{#sep}}(.*?){{\/sep}}/g;
        itemContent = itemContent.replace(sepRegex, (sepMatch: string, separator: string) => {
          return index < array.length - 1 ? separator : '';
        });
        
        return itemContent;
      }).join('');
    });
  }
}