# Security Fix Implementation Guide

## Immediate Fix for Critical Vulnerability (PrismJS XSS)

### Option 1: Update react-syntax-highlighter (Recommended)

```bash
cd frontend
npm uninstall react-syntax-highlighter
npm install react-syntax-highlighter@latest --save
```

### Option 2: Switch to Alternative Syntax Highlighter

```bash
cd frontend
npm uninstall react-syntax-highlighter
npm install @uiw/react-textarea-code-editor --save
# OR
npm install monaco-editor --save
```

### Option 3: Implement Security Wrapper (If update not possible)

Create `frontend/src/components/SecureSyntaxHighlighter.jsx`:

```javascript
import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import DOMPurify from 'dompurify';

const SecureSyntaxHighlighter = ({ children, language, style, ...props }) => {
  // Sanitize input to prevent XSS
  const sanitizedCode = DOMPurify.sanitize(children, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
  });

  // Additional validation
  const validateCode = (code) => {
    // Remove any potential script tags or event handlers
    const dangerous = /<script|on\w+\s*=/gi;
    return dangerous.test(code);
  };

  if (validateCode(children)) {
    console.warn('Potentially dangerous code detected and sanitized');
  }

  return (
    <SyntaxHighlighter
      language={language}
      style={style}
      {...props}
    >
      {sanitizedCode}
    </SyntaxHighlighter>
  );
};

export default SecureSyntaxHighlighter;
```

## Backend Security Headers Implementation

Create `backend/src/middleware/security.ts`:

```typescript
import helmet from 'helmet';
import { Express } from 'express';

export const configureSecurityHeaders = (app: Express): void => {
  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: "no-referrer" },
    xssFilter: true,
  }));

  // Additional custom headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
};
```

## Input Validation Implementation

Create `backend/src/middleware/validation.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

// SQL Injection Prevention
export const sanitizeSQLInput = (input: string): string => {
  // Remove or escape potentially dangerous SQL characters
  return input.replace(/['";\\]/g, '');
};

// XSS Prevention
export const sanitizeHTMLInput = (input: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };
  return input.replace(/[&<>"'/]/g, (char) => map[char]);
};

// Input validation middleware
export const validateInput = (schema: z.ZodSchema) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = await schema.parseAsync(req.body);
      req.body = validatedData;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};

// Example schema for repository analysis
export const repositoryAnalysisSchema = z.object({
  url: z.string().url().refine(
    (url) => url.startsWith('https://github.com/'),
    { message: 'Only GitHub repositories are supported' }
  ),
  branch: z.string().regex(/^[a-zA-Z0-9\-_\/]+$/).optional(),
  token: z.string().min(40).max(100).optional(),
});
```

## CORS Security Configuration

Update `backend/src/index.ts`:

```typescript
import cors from 'cors';

const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? ['https://your-production-domain.com']
    : ['http://localhost:3000', 'http://localhost:8745'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
```

## Authentication Security (JWT Best Practices)

Create `backend/src/auth/jwt-security.ts`:

```typescript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const REFRESH_SECRET = process.env.REFRESH_SECRET || crypto.randomBytes(64).toString('hex');

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
}

export const generateTokens = (payload: TokenPayload) => {
  // Short-lived access token (15 minutes)
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
    algorithm: 'HS256',
    issuer: 'refactorforge',
    audience: 'refactorforge-api',
  });

  // Long-lived refresh token (7 days)
  const refreshToken = jwt.sign(
    { userId: payload.userId },
    REFRESH_SECRET,
    {
      expiresIn: '7d',
      algorithm: 'HS256',
    }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'refactorforge',
    audience: 'refactorforge-api',
  }) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  return jwt.verify(token, REFRESH_SECRET, {
    algorithms: ['HS256'],
  }) as { userId: string };
};
```

## Rate Limiting Implementation

Create `backend/src/middleware/rate-limit.ts`:

```typescript
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General API rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Speed limiting - gradually slow down responses
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per 15 minutes at full speed
  delayMs: 500, // Begin adding 500ms of delay per request above 50
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

// Repository analysis rate limiting (expensive operation)
export const analysisLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 analyses per hour
  message: 'Too many repository analyses requested, please try again later.',
});
```

## Security Testing Script

Create `scripts/security-test.sh`:

```bash
#!/bin/bash

echo "🔒 Running Security Tests..."

# Check for vulnerabilities
echo "📋 Checking npm vulnerabilities..."
npm audit --audit-level=moderate

# Check for secrets in code
echo "🔑 Scanning for secrets..."
if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --verbose
else
    echo "⚠️  gitleaks not installed. Install with: brew install gitleaks"
fi

# Check for outdated dependencies
echo "📦 Checking for outdated dependencies..."
npm outdated

# Run OWASP dependency check (if available)
if [ -f "dependency-check.sh" ]; then
    echo "🛡️  Running OWASP Dependency Check..."
    ./dependency-check.sh --project RefactorForge --scan .
fi

# Test security headers
echo "🔍 Testing security headers..."
if [ "$(lsof -i:8001 | grep LISTEN)" ]; then
    curl -I http://localhost:8001/api/health | grep -E "X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security"
else
    echo "⚠️  Backend not running. Start it to test security headers."
fi

echo "✅ Security tests complete!"
```

## Environment Variables Security

Create `.env.example`:

```env
# Server Configuration
NODE_ENV=development
PORT=8001
FRONTEND_URL=http://localhost:3000

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
REFRESH_SECRET=your-refresh-token-secret-change-this
SESSION_SECRET=your-session-secret-change-this
ENCRYPTION_KEY=your-32-character-encryption-key

# GitHub Integration
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Database
DATABASE_URL=sqlite://./data/refactorforge.db

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8745

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Features
ENABLE_GITHUB_INTEGRATION=true
ENABLE_AI_SUGGESTIONS=true
```

## Security Checklist

### ✅ Immediate Actions
- [ ] Update react-syntax-highlighter to fix PrismJS vulnerability
- [ ] Implement input sanitization for code highlighting
- [ ] Add security headers to backend
- [ ] Configure CORS properly
- [ ] Implement rate limiting

### ✅ Short-term Actions (This Week)
- [ ] Update all frontend dependencies
- [ ] Implement JWT authentication properly
- [ ] Add input validation middleware
- [ ] Set up environment variables securely
- [ ] Create security testing scripts

### ✅ Long-term Actions (This Month)
- [ ] Set up Dependabot for automatic updates
- [ ] Implement comprehensive logging
- [ ] Add security monitoring
- [ ] Conduct penetration testing
- [ ] Create incident response plan

### ✅ Development Practices
- [ ] Use npm audit in pre-commit hooks
- [ ] Regular security training for developers
- [ ] Code review for security issues
- [ ] Secure coding guidelines documentation
- [ ] Security champion designation

## Monitoring and Alerting

```javascript
// backend/src/monitoring/security-monitor.ts
import winston from 'winston';

const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'security.log' }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Log security events
export const logSecurityEvent = (event: {
  type: 'AUTH_FAILURE' | 'RATE_LIMIT' | 'INJECTION_ATTEMPT' | 'XSS_ATTEMPT';
  ip: string;
  details?: any;
}) => {
  securityLogger.warn('Security Event', event);

  // Send alert for critical events
  if (event.type === 'INJECTION_ATTEMPT' || event.type === 'XSS_ATTEMPT') {
    // Implement alerting (email, Slack, etc.)
    sendSecurityAlert(event);
  }
};
```

---

This implementation guide provides production-ready security fixes following OWASP best practices. Prioritize the PrismJS fix as it's the only runtime vulnerability affecting production security.