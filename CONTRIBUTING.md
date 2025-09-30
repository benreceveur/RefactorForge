# Contributing to RefactorForge

Thank you for your interest in contributing to RefactorForge! We welcome contributions from the community and are grateful for any help you can provide.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## 📜 Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on constructive criticism
- Accept feedback gracefully
- Prioritize the community's best interests

## 🚀 Getting Started

1. **Fork the Repository**
   ```bash
   # Fork via GitHub UI, then:
   git clone https://github.com/YOUR_USERNAME/refactorforge.git
   cd refactorforge
   git remote add upstream https://github.com/ORIGINAL_OWNER/refactorforge.git
   ```

2. **Set Up Development Environment**
   ```bash
   # Install dependencies
   npm install
   
   # Copy environment configuration
   cp .env.example .env
   
   # Start development servers
   npm run dev
   ```

3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

## 💻 Development Setup

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git
- A GitHub account
- A code editor (VSCode recommended)

### Environment Setup

1. **Install Node Version Manager (nvm)**
   ```bash
   # Use the version specified in .nvmrc
   nvm use
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   - Copy `.env.example` to `.env`
   - Add your GitHub token for API access
   - Configure other optional services

4. **Verify Setup**
   ```bash
   # Run tests
   npm test
   
   # Start development server
   npm run dev
   ```

## 🤝 How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When reporting a bug, include:**
- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment details (OS, Node version, etc.)

**Bug Report Template:**
```markdown
## Description
Brief description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable

## Environment
- OS: [e.g., macOS 13.0]
- Node: [e.g., 18.20.4]
- Browser: [e.g., Chrome 120]
```

### Suggesting Features

**Feature Request Template:**
```markdown
## Feature Description
Clear description of the proposed feature

## Use Case
Why is this feature needed?

## Proposed Implementation
How might this work?

## Alternatives Considered
Other solutions you've thought about
```

### Submitting Code

1. **Find an Issue**
   - Look for issues tagged `good-first-issue` or `help-wanted`
   - Comment on the issue to claim it
   - Wait for maintainer approval

2. **Write Your Code**
   - Follow our [Coding Standards](#coding-standards)
   - Write tests for new features
   - Update documentation as needed

3. **Commit Your Changes**
   ```bash
   # Use conventional commit format
   git commit -m "feat: add new analysis algorithm"
   git commit -m "fix: resolve database connection issue"
   git commit -m "docs: update API documentation"
   ```

   **Commit Types:**
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes (formatting, etc.)
   - `refactor:` Code refactoring
   - `test:` Test additions or updates
   - `chore:` Maintenance tasks

## 🔄 Pull Request Process

### Before Submitting

1. **Update Your Branch**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run Quality Checks**
   ```bash
   # Run tests
   npm test
   
   # Run linter
   npm run lint
   
   # Run type check
   npm run typecheck
   
   # Build project
   npm run build
   ```

3. **Update Documentation**
   - Update README if needed
   - Add JSDoc comments for new functions
   - Update API documentation

### PR Guidelines

**Title Format:**
```
[Type] Brief description

Examples:
[Feature] Add repository caching mechanism
[Fix] Resolve memory leak in scanner service
[Docs] Update installation instructions
```

**PR Description Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Changes Made
- List of specific changes
- Another change
- etc.

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
```

### Review Process

1. **Automated Checks** - CI/CD runs tests and linting
2. **Code Review** - Maintainer reviews code
3. **Discussion** - Address feedback and questions
4. **Approval** - Receive approval from maintainer
5. **Merge** - PR is merged to main branch

## 📝 Coding Standards

### TypeScript Guidelines

```typescript
// Good: Use explicit types
interface UserData {
  id: string;
  name: string;
  email: string;
}

function processUser(user: UserData): void {
  // Implementation
}

// Bad: Avoid 'any' type
function processData(data: any) {
  // Implementation
}
```

### React Guidelines

```tsx
// Good: Functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ label, onClick, disabled = false }) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};

// Use hooks appropriately
const MyComponent: React.FC = () => {
  const [data, setData] = useState<UserData[]>([]);
  
  useEffect(() => {
    fetchData().then(setData);
  }, []);
  
  return <div>{/* render */}</div>;
};
```

### API Guidelines

```typescript
// Good: RESTful endpoints with proper status codes
app.post('/api/users', async (req, res) => {
  try {
    const user = await createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Use middleware for common tasks
app.use('/api', authenticate);
app.use('/api', validateInput);
```

### General Best Practices

- **DRY** - Don't Repeat Yourself
- **KISS** - Keep It Simple, Stupid
- **YAGNI** - You Aren't Gonna Need It
- **Single Responsibility** - Each function/class does one thing
- **Meaningful Names** - Use descriptive variable and function names
- **Error Handling** - Always handle errors appropriately
- **Comments** - Write self-documenting code, comment complex logic

## 🧪 Testing Guidelines

### Unit Tests

```typescript
// Example test file: githubScanner.test.ts
describe('GitHubScanner', () => {
  describe('scanRepository', () => {
    it('should return repository data for valid repo', async () => {
      const result = await scanRepository('owner/repo');
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('stars');
    });
    
    it('should throw error for invalid repo', async () => {
      await expect(scanRepository('invalid')).rejects.toThrow();
    });
  });
});
```

### Integration Tests

```typescript
// Example integration test
describe('API Integration', () => {
  it('should analyze repository end-to-end', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .send({ repository: 'owner/repo' });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('recommendations');
  });
});
```

### Test Coverage

- Aim for >80% code coverage
- Focus on critical paths
- Test edge cases and error conditions
- Don't test implementation details

## 📚 Documentation

### Code Documentation

```typescript
/**
 * Analyzes a GitHub repository for code quality issues
 * @param {string} repoUrl - The GitHub repository URL
 * @param {AnalysisOptions} options - Analysis configuration options
 * @returns {Promise<AnalysisResult>} Analysis results with recommendations
 * @throws {InvalidRepositoryError} If repository URL is invalid
 * @example
 * const result = await analyzeRepository('https://github.com/owner/repo', {
 *   depth: 'full',
 *   includeTests: true
 * });
 */
async function analyzeRepository(
  repoUrl: string,
  options: AnalysisOptions
): Promise<AnalysisResult> {
  // Implementation
}
```

### README Updates

Update README.md when:
- Adding new features
- Changing installation process
- Modifying API endpoints
- Adding new dependencies

### API Documentation

Document all API endpoints in `docs/API.md`:
```markdown
## POST /api/analyze

Analyzes a GitHub repository

### Request
```json
{
  "repository": "owner/repo",
  "options": {
    "depth": "full"
  }
}
```

### Response
```json
{
  "status": "success",
  "data": {
    "recommendations": []
  }
}
```
```

## 🎯 Areas for Contribution

### Current Priorities

- **Testing**: Increase test coverage
- **Documentation**: Improve API documentation
- **Performance**: Optimize database queries
- **Features**: Plugin system implementation
- **UI/UX**: Improve user interface
- **DevOps**: Docker configuration

### Good First Issues

Look for issues labeled:
- `good-first-issue` - Simple tasks for beginners
- `help-wanted` - Tasks where we need help
- `documentation` - Documentation improvements
- `bug` - Bug fixes

## 🌟 Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Project documentation

## 💬 Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General discussions
- **Pull Requests** - Code contributions

### Getting Help

- Check existing documentation
- Search closed issues
- Ask in GitHub Discussions
- Tag maintainers for urgent issues

## 📧 Contact

- **Maintainers**: @maintainer-username
- **Security Issues**: security@refactorforge.com
- **General Questions**: Use GitHub Discussions

## 🙏 Thank You!

Every contribution matters, whether it's:
- Reporting bugs
- Suggesting features
- Improving documentation
- Writing code
- Helping others

We appreciate your time and effort in making RefactorForge better!

---

**Happy Contributing! 🚀**