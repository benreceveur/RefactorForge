# RefactorForge

> Professional code refactoring and analysis platform powered by AI

RefactorForge is an intelligent code analysis and refactoring tool that helps developers improve their codebase through AI-powered recommendations, performance optimization insights, and security vulnerability detection.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/refactorforge.git
cd refactorforge

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev
```

The application will be available at:
- Frontend: http://localhost:8745
- Backend API: http://localhost:8001
- Memory API: http://localhost:3721

## ✨ Features

### Core Capabilities
- **GitHub Repository Analysis** - Deep analysis of code structure and patterns
- **AI-Powered Recommendations** - Intelligent suggestions for code improvements
- **Performance Optimization** - Identify and resolve performance bottlenecks
- **Security Vulnerability Detection** - Automated security audit and remediation
- **Real-time Metrics** - Track code quality metrics over time
- **Pattern Recognition** - Identify code smells and anti-patterns

### Technical Features
- **TypeScript** - Full type safety across frontend and backend
- **Monorepo Architecture** - Organized workspace structure
- **SQLite Database** - Lightweight, embedded database
- **React Frontend** - Modern, responsive UI with Material-UI
- **Express Backend** - RESTful API with comprehensive endpoints
- **Memory System Integration** - Advanced pattern learning and caching

## 📚 Documentation

📖 **[Complete Documentation](./docs/README.md)** - Comprehensive documentation index

**Quick Links:**
- [System Architecture](./docs/architecture/SYSTEM_ARCHITECTURE.md) - Complete technical architecture
- [Developer Guide](./docs/development/DEVELOPER_GUIDE.md) - Development setup and guidelines
- [API Documentation](./docs/api/API_DOCUMENTATION.md) - Complete API reference
- [Security Reports](./docs/reports/) - Security analysis and remediation
- [Contributing Guide](./CONTRIBUTING.md) - How to contribute

## 🛠️ Technology Stack

### Frontend
- React 18
- TypeScript
- Material-UI
- Axios
- React Router

### Backend
- Node.js 18+
- Express.js
- TypeScript
- SQLite3
- Octokit (GitHub API)

### Development Tools
- npm workspaces
- Concurrently
- TypeScript compiler
- ESLint & Prettier (coming soon)

## 📁 Project Structure

```
RefactorForge/
├── frontend/              # React TypeScript application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.tsx       # Main application
│   │   └── index.tsx     # Entry point
│   └── package.json
├── backend/               # Express TypeScript API
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Business logic
│   │   ├── types/        # TypeScript definitions
│   │   └── utils/        # Utility functions
│   └── package.json
├── docs/                  # Documentation
├── scripts/              # Utility scripts
└── package.json          # Root workspace config
```

## 🔧 Available Scripts

### Root Level
- `npm run dev` - Start all services in development mode
- `npm run build` - Build both frontend and backend
- `npm run start` - Start production servers
- `npm run install:all` - Install all dependencies

### Frontend
- `npm run dev:frontend` - Start frontend development server
- `npm run build:frontend` - Build frontend for production

### Backend
- `npm run dev:backend` - Start backend development server
- `npm run build:backend` - Build backend for production

## 🔍 API Overview

The backend provides a comprehensive REST API:

### Core Endpoints
- `POST /api/analyze` - Analyze GitHub repository
- `GET /api/recommendations/:repoName` - Get AI recommendations
- `GET /api/history` - View analysis history
- `GET /api/metrics/:repoName` - Get repository metrics

### Performance Endpoints
- `GET /api/performance/baseline` - Get performance baseline
- `POST /api/performance/analyze` - Analyze performance
- `GET /api/performance/history` - View performance history

### Security Endpoints
- `POST /api/security/scan` - Security vulnerability scan
- `GET /api/security/report/:id` - Get security report

[View Complete API Documentation](./docs/api/API_DOCUMENTATION.md)

## 🚦 Requirements

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher
- Git
- SQLite3

## 🔐 Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Required
NODE_ENV=development
BACKEND_PORT=8001
FRONTEND_PORT=8745

# Optional - GitHub Integration
GITHUB_TOKEN=your_github_token_here

# See .env.example for all available options
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --testNamePattern="GitHub"
```

## 🐛 Debugging

### Common Issues

1. **Port already in use**
   ```bash
   # Kill processes on specific ports
   lsof -ti:8001 | xargs kill -9
   ```

2. **Database locked**
   ```bash
   # Reset database
   rm backend/refactorforge.db
   npm run dev
   ```

3. **Memory API not responding**
   - Check if memory system is running on port 3721
   - Verify MEMORY_API_URL in .env

[View Developer Guide](./docs/development/DEVELOPER_GUIDE.md)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Process
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Ensure all tests pass
6. Submit a pull request

## 📊 Performance

RefactorForge is optimized for performance:

- **Fast Analysis** - Analyzes repositories in seconds
- **Efficient Caching** - Smart caching reduces API calls
- **Optimized Queries** - Database queries optimized for speed
- **Lazy Loading** - Frontend components load on demand
- **Concurrent Processing** - Parallel processing for multiple repos

[View Performance Analysis](./PERFORMANCE_ANALYSIS.md)

## 🔒 Security

Security is a top priority:

- **SQL Injection Protection** - Parameterized queries throughout
- **XSS Prevention** - Input sanitization and validation
- **CORS Configuration** - Proper cross-origin resource sharing
- **Environment Variables** - Sensitive data in environment files
- **Security Audits** - Regular security assessments

[View Security Reports](./docs/reports/SECURITY_AUDIT_REPORT.md)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Built with modern web technologies
- Inspired by best practices in code quality
- Community-driven development

## 📮 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/refactorforge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/refactorforge/discussions)
- **Email**: support@refactorforge.com

## 🚀 Roadmap

- [ ] Jest testing framework implementation
- [ ] ESLint and Prettier integration
- [ ] CI/CD pipeline with GitHub Actions
- [ ] Docker containerization
- [ ] GraphQL API support
- [ ] Plugin system for custom analyzers
- [ ] VSCode extension
- [ ] Cloud deployment options

---

**RefactorForge** - *Transforming code, one recommendation at a time*