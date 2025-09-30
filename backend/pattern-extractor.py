#!/usr/bin/env python3
"""
Pattern Extraction Service for RefactorForge

This service analyzes actual repository code to extract patterns for the recommendation engine.
It replaces template-based recommendations with real code analysis.

Author: RefactorForge Team
"""

import os
import re
import sqlite3
import json
import hashlib
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum


class PatternCategory(Enum):
    PERFORMANCE = "performance"
    TYPE_SAFETY = "type-safety"
    ARCHITECTURE = "architecture"
    ERROR_HANDLING = "error-handling"
    ASYNC_PATTERNS = "async-patterns"
    REACT_PATTERNS = "react-patterns"
    FILE_OPERATIONS = "file-operations"
    CODE_QUALITY = "code-quality"


class PatternSeverity(Enum):
    LOW = 0.3
    MEDIUM = 0.6
    HIGH = 0.9
    CRITICAL = 1.0


@dataclass
class CodePattern:
    """Represents a discovered code pattern"""
    pattern_type: str
    pattern_content: str
    description: str
    category: PatternCategory
    subcategory: Optional[str]
    file_path: str
    line_start: int
    line_end: int
    language: str
    framework: Optional[str]
    confidence_score: float
    usage_count: int = 1
    context_before: str = ""
    context_after: str = ""
    tags: List[str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.metadata is None:
            self.metadata = {}

    @property
    def pattern_hash(self) -> str:
        """Generate a unique hash for this pattern"""
        content = f"{self.pattern_type}:{self.pattern_content}:{self.category.value}"
        return hashlib.md5(content.encode()).hexdigest()


class TypeScriptPatternExtractor:
    """Extracts patterns from TypeScript/JavaScript code"""
    
    def __init__(self, repository_path: str, db_path: str):
        self.repository_path = Path(repository_path)
        self.db_path = db_path
        self.patterns: List[CodePattern] = []
        
        # Pattern definitions with regex and metadata
        self.pattern_definitions = {
            # File System Operations
            'fs_sync_operations': {
                'regex': r'fs\.(readFileSync|writeFileSync|appendFileSync|existsSync|statSync|lstatSync|mkdirSync|rmdirSync)',
                'category': PatternCategory.PERFORMANCE,
                'subcategory': 'synchronous-io',
                'description': 'Synchronous filesystem operations that block the event loop',
                'severity': PatternSeverity.HIGH,
                'tags': ['blocking', 'filesystem', 'performance']
            },
            'fs_async_operations': {
                'regex': r'fs\.(readFile|writeFile|appendFile|exists|stat|lstat|mkdir|rmdir|readdir)',
                'category': PatternCategory.PERFORMANCE,
                'subcategory': 'asynchronous-io',
                'description': 'Asynchronous filesystem operations',
                'severity': PatternSeverity.LOW,
                'tags': ['non-blocking', 'filesystem', 'async']
            },
            
            # Type Safety Patterns
            'any_type_usage': {
                'regex': r':\s*any\b|as\s+any\b|\bany\[\]',
                'category': PatternCategory.TYPE_SAFETY,
                'subcategory': 'weak-typing',
                'description': 'Usage of "any" type which bypasses TypeScript type checking',
                'severity': PatternSeverity.MEDIUM,
                'tags': ['type-safety', 'any-type', 'weak-typing']
            },
            'interface_definitions': {
                'regex': r'interface\s+\w+\s*{[^}]+}',
                'category': PatternCategory.TYPE_SAFETY,
                'subcategory': 'strong-typing',
                'description': 'Interface definitions for type safety',
                'severity': PatternSeverity.LOW,
                'tags': ['interfaces', 'type-safety', 'strong-typing']
            },
            'type_assertions': {
                'regex': r'as\s+\w+|<\w+>',
                'category': PatternCategory.TYPE_SAFETY,
                'subcategory': 'type-casting',
                'description': 'Type assertions that may bypass type checking',
                'severity': PatternSeverity.MEDIUM,
                'tags': ['type-assertions', 'type-casting']
            },
            
            # Async/Await Patterns
            'await_usage': {
                'regex': r'\bawait\s+',
                'category': PatternCategory.ASYNC_PATTERNS,
                'subcategory': 'await-async',
                'description': 'Await keyword usage for asynchronous operations',
                'severity': PatternSeverity.LOW,
                'tags': ['async', 'await', 'promises']
            },
            'promise_usage': {
                'regex': r'new\s+Promise|Promise\.(all|race|resolve|reject)',
                'category': PatternCategory.ASYNC_PATTERNS,
                'subcategory': 'promises',
                'description': 'Promise-based asynchronous patterns',
                'severity': PatternSeverity.LOW,
                'tags': ['promises', 'async']
            },
            'callback_patterns': {
                'regex': r'\(\s*err,?\s*\w*\s*\)\s*=>\s*{|\(\s*error,?\s*\w*\s*\)\s*=>\s*{',
                'category': PatternCategory.ASYNC_PATTERNS,
                'subcategory': 'callbacks',
                'description': 'Callback-based asynchronous patterns',
                'severity': PatternSeverity.MEDIUM,
                'tags': ['callbacks', 'async', 'error-first']
            },
            
            # React Patterns
            'react_hooks': {
                'regex': r'use(State|Effect|Context|Reducer|Callback|Memo|Ref|ImperativeHandle|LayoutEffect|DebugValue)\s*\(',
                'category': PatternCategory.REACT_PATTERNS,
                'subcategory': 'hooks',
                'description': 'React hooks usage',
                'severity': PatternSeverity.LOW,
                'tags': ['react', 'hooks', 'functional-components']
            },
            'react_memo': {
                'regex': r'React\.memo\s*\(|memo\s*\(',
                'category': PatternCategory.REACT_PATTERNS,
                'subcategory': 'performance',
                'description': 'React.memo usage for component memoization',
                'severity': PatternSeverity.LOW,
                'tags': ['react', 'memo', 'performance', 'optimization']
            },
            'useCallback_useMemo': {
                'regex': r'use(Callback|Memo)\s*\(',
                'category': PatternCategory.REACT_PATTERNS,
                'subcategory': 'performance',
                'description': 'useCallback/useMemo for performance optimization',
                'severity': PatternSeverity.LOW,
                'tags': ['react', 'performance', 'memoization']
            },
            
            # Error Handling
            'try_catch_blocks': {
                'regex': r'try\s*{[^}]*}\s*catch\s*\([^)]*\)\s*{',
                'category': PatternCategory.ERROR_HANDLING,
                'subcategory': 'exception-handling',
                'description': 'Try-catch blocks for error handling',
                'severity': PatternSeverity.LOW,
                'tags': ['error-handling', 'exceptions', 'try-catch']
            },
            'error_throwing': {
                'regex': r'throw\s+new\s+\w*Error|throw\s+\w+',
                'category': PatternCategory.ERROR_HANDLING,
                'subcategory': 'error-throwing',
                'description': 'Error throwing patterns',
                'severity': PatternSeverity.LOW,
                'tags': ['error-handling', 'throw', 'exceptions']
            },
            
            # Architecture Patterns
            'arrow_functions': {
                'regex': r'=>\s*{|=>\s*\w+',
                'category': PatternCategory.ARCHITECTURE,
                'subcategory': 'functional-programming',
                'description': 'Arrow function usage',
                'severity': PatternSeverity.LOW,
                'tags': ['arrow-functions', 'functional', 'es6']
            },
            'destructuring': {
                'regex': r'const\s*{\s*\w+.*}\s*=|const\s*\[\s*\w+.*\]\s*=',
                'category': PatternCategory.ARCHITECTURE,
                'subcategory': 'es6-features',
                'description': 'Object/array destructuring patterns',
                'severity': PatternSeverity.LOW,
                'tags': ['destructuring', 'es6', 'modern-js']
            },
            'template_literals': {
                'regex': r'`[^`]*\${[^}]+}[^`]*`',
                'category': PatternCategory.ARCHITECTURE,
                'subcategory': 'es6-features',
                'description': 'Template literal usage',
                'severity': PatternSeverity.LOW,
                'tags': ['template-literals', 'es6', 'string-interpolation']
            },
            
            # Code Quality
            'console_statements': {
                'regex': r'console\.(log|warn|error|info|debug)',
                'category': PatternCategory.CODE_QUALITY,
                'subcategory': 'debugging',
                'description': 'Console statements that may need removal in production',
                'severity': PatternSeverity.MEDIUM,
                'tags': ['console', 'debugging', 'production-cleanup']
            },
            'todo_comments': {
                'regex': r'//\s*(TODO|FIXME|HACK|XXX|BUG)',
                'category': PatternCategory.CODE_QUALITY,
                'subcategory': 'technical-debt',
                'description': 'TODO/FIXME comments indicating technical debt',
                'severity': PatternSeverity.MEDIUM,
                'tags': ['todo', 'technical-debt', 'comments']
            }
        }

    def extract_patterns_from_repository(self) -> List[CodePattern]:
        """Extract all patterns from the repository"""
        print(f"🔍 Starting pattern extraction from: {self.repository_path}")
        
        # Find all TypeScript/JavaScript files
        ts_files = list(self.repository_path.rglob("*.ts"))
        js_files = list(self.repository_path.rglob("*.js"))
        tsx_files = list(self.repository_path.rglob("*.tsx"))
        jsx_files = list(self.repository_path.rglob("*.jsx"))
        
        all_files = ts_files + js_files + tsx_files + jsx_files
        
        # Filter out node_modules and dist directories
        filtered_files = [f for f in all_files if 'node_modules' not in str(f) and 'dist' not in str(f)]
        
        print(f"📁 Found {len(filtered_files)} TypeScript/JavaScript files to analyze")
        
        for file_path in filtered_files:
            self._extract_patterns_from_file(file_path)
        
        print(f"✅ Extracted {len(self.patterns)} total patterns")
        return self.patterns

    def _extract_patterns_from_file(self, file_path: Path) -> None:
        """Extract patterns from a single file"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.splitlines()
        except Exception as e:
            print(f"❌ Error reading file {file_path}: {e}")
            return

        # Determine language and framework
        language = self._determine_language(file_path)
        framework = self._determine_framework(content, file_path)
        
        relative_path = str(file_path.relative_to(self.repository_path))
        
        # Extract patterns using regex
        for pattern_name, pattern_def in self.pattern_definitions.items():
            matches = list(re.finditer(pattern_def['regex'], content, re.MULTILINE | re.DOTALL))
            
            for match in matches:
                # Find line numbers
                line_start = content[:match.start()].count('\n') + 1
                line_end = content[:match.end()].count('\n') + 1
                
                # Get context (2 lines before and after)
                context_start = max(0, line_start - 3)
                context_end = min(len(lines), line_end + 2)
                context_before = '\n'.join(lines[context_start:line_start-1])
                context_after = '\n'.join(lines[line_end:context_end])
                
                pattern = CodePattern(
                    pattern_type=pattern_name,
                    pattern_content=match.group(0).strip(),
                    description=pattern_def['description'],
                    category=pattern_def['category'],
                    subcategory=pattern_def.get('subcategory'),
                    file_path=relative_path,
                    line_start=line_start,
                    line_end=line_end,
                    language=language,
                    framework=framework,
                    confidence_score=pattern_def['severity'].value,
                    context_before=context_before,
                    context_after=context_after,
                    tags=pattern_def['tags'].copy(),
                    metadata={
                        'match_length': len(match.group(0)),
                        'file_size': len(content),
                        'total_lines': len(lines)
                    }
                )
                
                self.patterns.append(pattern)

    def _determine_language(self, file_path: Path) -> str:
        """Determine the programming language based on file extension"""
        extension = file_path.suffix.lower()
        return {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript'
        }.get(extension, 'unknown')

    def _determine_framework(self, content: str, file_path: Path) -> Optional[str]:
        """Determine the framework being used"""
        if re.search(r'import.*react|from\s+["\']react["\']', content, re.IGNORECASE):
            return 'react'
        elif re.search(r'import.*vue|from\s+["\']vue["\']', content, re.IGNORECASE):
            return 'vue'
        elif re.search(r'import.*angular|from\s+["\']@angular', content, re.IGNORECASE):
            return 'angular'
        elif re.search(r'express\(|app\.get|app\.post', content):
            return 'express'
        elif 'node' in str(file_path) or re.search(r'require\(|module\.exports', content):
            return 'nodejs'
        return None

    def save_patterns_to_database(self, repository_id: str) -> None:
        """Save extracted patterns to the database"""
        if not self.patterns:
            print("⚠️  No patterns found to save")
            return
            
        print(f"💾 Saving {len(self.patterns)} patterns to database...")
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Clear existing patterns for this repository
            cursor.execute("DELETE FROM repository_patterns WHERE repository_id = ?", (repository_id,))
            
            # Group patterns by hash to count occurrences
            pattern_groups = {}
            for pattern in self.patterns:
                hash_key = pattern.pattern_hash
                if hash_key not in pattern_groups:
                    pattern_groups[hash_key] = {
                        'pattern': pattern,
                        'count': 0,
                        'files': set()
                    }
                pattern_groups[hash_key]['count'] += 1
                pattern_groups[hash_key]['files'].add(pattern.file_path)
            
            # Insert patterns with aggregated counts
            for hash_key, group_data in pattern_groups.items():
                pattern = group_data['pattern']
                usage_count = group_data['count']
                
                # Add file count to metadata
                pattern.metadata['file_count'] = len(group_data['files'])
                pattern.metadata['files'] = list(group_data['files'])
                
                cursor.execute("""
                    INSERT INTO repository_patterns (
                        id, repository_id, pattern_type, pattern_content, pattern_hash,
                        description, category, subcategory, tags, file_path, line_start,
                        line_end, language, framework, confidence_score, usage_count,
                        context_before, context_after, metadata, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()),
                    repository_id,
                    pattern.pattern_type,
                    pattern.pattern_content,
                    pattern.pattern_hash,
                    pattern.description,
                    pattern.category.value,
                    pattern.subcategory,
                    json.dumps(pattern.tags),
                    pattern.file_path,
                    pattern.line_start,
                    pattern.line_end,
                    pattern.language,
                    pattern.framework,
                    pattern.confidence_score,
                    usage_count,
                    pattern.context_before,
                    pattern.context_after,
                    json.dumps(pattern.metadata),
                    datetime.now().isoformat(),
                    datetime.now().isoformat()
                ))
            
            conn.commit()
            print(f"✅ Successfully saved {len(pattern_groups)} unique patterns to database")
            
        except Exception as e:
            print(f"❌ Error saving patterns to database: {e}")
            if conn:
                conn.rollback()
        finally:
            if conn:
                conn.close()

    def generate_pattern_report(self) -> Dict[str, Any]:
        """Generate a comprehensive report of extracted patterns"""
        if not self.patterns:
            return {"message": "No patterns found"}
        
        # Categorize patterns
        category_counts = {}
        severity_counts = {}
        file_counts = {}
        pattern_type_counts = {}
        
        for pattern in self.patterns:
            # Count by category
            category = pattern.category.value
            category_counts[category] = category_counts.get(category, 0) + 1
            
            # Count by severity (confidence score ranges)
            if pattern.confidence_score >= 0.9:
                severity = 'critical'
            elif pattern.confidence_score >= 0.6:
                severity = 'high'
            elif pattern.confidence_score >= 0.3:
                severity = 'medium'
            else:
                severity = 'low'
            severity_counts[severity] = severity_counts.get(severity, 0) + 1
            
            # Count by file
            file_counts[pattern.file_path] = file_counts.get(pattern.file_path, 0) + 1
            
            # Count by pattern type
            pattern_type_counts[pattern.pattern_type] = pattern_type_counts.get(pattern.pattern_type, 0) + 1
        
        return {
            'total_patterns': len(self.patterns),
            'category_breakdown': category_counts,
            'severity_breakdown': severity_counts,
            'top_files_by_pattern_count': dict(sorted(file_counts.items(), key=lambda x: x[1], reverse=True)[:10]),
            'pattern_type_breakdown': dict(sorted(pattern_type_counts.items(), key=lambda x: x[1], reverse=True)),
            'extraction_timestamp': datetime.now().isoformat(),
            'repository_path': str(self.repository_path)
        }


def main():
    """Main function to run pattern extraction"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Extract code patterns from repository')
    parser.add_argument('--repo-path', required=True, help='Path to repository to analyze')
    parser.add_argument('--db-path', default='refactorforge.db', help='Path to SQLite database')
    parser.add_argument('--repository-id', help='Repository ID in database')
    parser.add_argument('--report-only', action='store_true', help='Generate report only, don\'t save to database')
    
    args = parser.parse_args()
    
    # Initialize extractor
    extractor = TypeScriptPatternExtractor(args.repo_path, args.db_path)
    
    # Extract patterns
    patterns = extractor.extract_patterns_from_repository()
    
    # Generate and display report
    report = extractor.generate_pattern_report()
    print("\n" + "="*60)
    print("📊 PATTERN EXTRACTION REPORT")
    print("="*60)
    print(json.dumps(report, indent=2))
    
    # Save to database if repository ID provided and not report-only
    if args.repository_id and not args.report_only:
        extractor.save_patterns_to_database(args.repository_id)
    elif not args.repository_id and not args.report_only:
        print("\n⚠️  No repository ID provided. Use --repository-id to save patterns to database.")
    
    print(f"\n✅ Pattern extraction complete!")


if __name__ == "__main__":
    main()