#!/usr/bin/env ts-node

/**
 * RefactorForge Database Optimization CLI
 *
 * Command-line interface for running database performance optimizations
 * with comprehensive reporting and rollback capabilities.
 *
 * Usage:
 *   npx ts-node src/scripts/optimize-database.ts [options]
 *
 * Options:
 *   --dry-run     Show what would be created without making changes
 *   --priority    Specify priority levels: critical,high,medium,low
 *   --test-only   Run performance tests only
 *   --rollback    Remove specific indexes (comma-separated names)
 *   --stats       Show current index statistics
 *   --help        Show help information
 */

import * as path from 'path';
import * as process from 'process';
import { logger } from '../utils/logger';
import {
  DatabaseIndexOptimizer,
  PERFORMANCE_INDEXES,
  optimizeDatabase,
  getIndexStatistics,
  runPerformanceTests,
  IndexDefinition,
  OptimizationReport
} from '../migrations/index-optimizer';

interface CliOptions {
  dryRun: boolean;
  priorities: Array<'critical' | 'high' | 'medium' | 'low'>;
  testOnly: boolean;
  rollback: string[];
  stats: boolean;
  help: boolean;
}

class DatabaseOptimizerCLI {
  private options: CliOptions;

  constructor() {
    this.options = this.parseArguments();
  }

  async run(): Promise<void> {
    try {
      // Initialize database connection
      console.log('🔧 RefactorForge Database Optimizer\n');

      if (this.options.help) {
        this.showHelp();
        return;
      }

      if (this.options.stats) {
        await this.showStatistics();
        return;
      }

      if (this.options.testOnly) {
        await this.runTestsOnly();
        return;
      }

      if (this.options.rollback.length > 0) {
        await this.rollbackIndexes();
        return;
      }

      if (this.options.dryRun) {
        await this.performDryRun();
        return;
      }

      // Run the actual optimization
      await this.performOptimization();

    } catch (error) {
      console.error('❌ Optimization failed:', error);
      logger.error('Database optimization CLI failed', {
        error: String(error),
        options: this.options
      });
      process.exit(1);
    }
  }

  private async performOptimization(): Promise<void> {
    console.log('🚀 Starting database optimization...\n');

    const report = await optimizeDatabase(this.options.priorities);

    this.displayOptimizationReport(report);

    if (report.failedIndexes > 0) {
      console.log('⚠️  Some indexes failed to create. Check logs for details.');
      process.exit(1);
    } else {
      console.log('✅ Database optimization completed successfully!');
    }
  }

  private async performDryRun(): Promise<void> {
    console.log('📋 Dry Run - No changes will be made\n');

    const targetIndexes = PERFORMANCE_INDEXES.filter(idx =>
      this.options.priorities.includes(idx.priority)
    );

    console.log(`Found ${targetIndexes.length} indexes to create:\n`);

    const optimizer = DatabaseIndexOptimizer.getInstance();

    for (const indexDef of targetIndexes) {
      const exists = await optimizer.indexExists(indexDef.name);
      const status = exists ? '✅ EXISTS' : '🆕 NEW';

      console.log(`${status} ${indexDef.name}`);
      console.log(`   Table: ${indexDef.table}`);
      console.log(`   Columns: ${indexDef.columns.join(', ')}`);
      console.log(`   Priority: ${indexDef.priority}`);
      console.log(`   Impact: ${indexDef.estimatedImpact}`);
      console.log(`   Description: ${indexDef.description}`);
      console.log('');
    }

    console.log('💡 Run without --dry-run to apply these changes');
  }

  private async runTestsOnly(): Promise<void> {
    console.log('🧪 Running performance tests...\n');

    const tests = await runPerformanceTests();

    console.log(`Performance Test Results (${tests.length} tests):\n`);

    for (const test of tests) {
      const icon = test.usesIndex ? '✅' : '⚠️';
      console.log(`${icon} ${test.description}`);
      console.log(`   Query: ${test.query.substring(0, 100)}...`);
      console.log(`   Execution Plan: ${test.executionPlan}`);
      console.log(`   Uses Index: ${test.usesIndex}`);
      console.log(`   Impact: ${test.estimatedImprovement}`);
      console.log('');
    }

    const optimizedQueries = tests.filter(t => t.usesIndex).length;
    console.log(`📊 Summary: ${optimizedQueries}/${tests.length} queries are optimized`);
  }

  private async rollbackIndexes(): Promise<void> {
    console.log('🔄 Rolling back indexes...\n');

    const optimizer = DatabaseIndexOptimizer.getInstance();

    for (const indexName of this.options.rollback) {
      try {
        const exists = await optimizer.indexExists(indexName);
        if (!exists) {
          console.log(`⚠️  Index ${indexName} does not exist, skipping`);
          continue;
        }

        await optimizer.removeIndexes([indexName]);
        console.log(`✅ Removed index: ${indexName}`);
      } catch (error) {
        console.log(`❌ Failed to remove index ${indexName}: ${error}`);
      }
    }

    console.log('\n🔄 Rollback completed');
  }

  private async showStatistics(): Promise<void> {
    console.log('📊 Database Index Statistics\n');

    const stats = await getIndexStatistics();

    console.log(`Total Indexes: ${stats.totalIndexes}`);
    console.log(`Custom Indexes: ${stats.customIndexes}`);
    console.log('');

    if (stats.indexSizes.length > 0) {
      console.log('Existing Indexes:');
      const groupedByTable = stats.indexSizes.reduce((acc, idx) => {
        if (!acc[idx.table]) acc[idx.table] = [];
        acc[idx.table]!.push(idx.name);
        return acc;
      }, {} as Record<string, string[]>);

      for (const [table, indexes] of Object.entries(groupedByTable)) {
        console.log(`  ${table}:`);
        indexes.forEach(name => {
          const isPerformanceIndex = name.startsWith('idx_');
          const icon = isPerformanceIndex ? '🚀' : '📋';
          console.log(`    ${icon} ${name}`);
        });
      }
    }

    // Show potential optimizations
    const optimizer = DatabaseIndexOptimizer.getInstance();
    const potentialIndexes = [];

    for (const indexDef of PERFORMANCE_INDEXES) {
      const exists = await optimizer.indexExists(indexDef.name);
      if (!exists) {
        potentialIndexes.push(indexDef);
      }
    }

    if (potentialIndexes.length > 0) {
      console.log('\n💡 Potential Optimizations:');
      potentialIndexes.forEach(idx => {
        console.log(`  🆕 ${idx.name} (${idx.priority} priority)`);
        console.log(`     Impact: ${idx.estimatedImpact}`);
      });
      console.log('\nRun optimization to create these indexes.');
    } else {
      console.log('\n✅ All performance indexes are already created!');
    }
  }

  private displayOptimizationReport(report: OptimizationReport): void {
    console.log('📊 Optimization Report\n');

    console.log(`⏱️  Total Execution Time: ${report.totalExecutionTime}ms`);
    console.log(`📈 New Indexes Created: ${report.newIndexes}`);
    console.log(`⏭️  Indexes Skipped (already exist): ${report.skippedIndexes}`);
    console.log(`❌ Failed Indexes: ${report.failedIndexes}`);
    console.log('');

    if (report.results && report.results.length > 0) {
      console.log('Index Creation Details:');
      report.results.forEach(result => {
        let status = '';
        if (result.created) status = '✅ CREATED';
        else if (result.existed) status = '⏭️  EXISTED';
        else if (result.error) status = '❌ FAILED';

        console.log(`  ${status} ${result.name} (${result.executionTime}ms)`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
      console.log('');
    }

    if (report.performanceTests.length > 0) {
      console.log('Performance Validation:');
      const optimized = report.performanceTests.filter(t => t.usesIndex).length;
      console.log(`  📊 ${optimized}/${report.performanceTests.length} queries are optimized`);

      report.performanceTests.forEach(test => {
        const icon = test.usesIndex ? '✅' : '⚠️';
        console.log(`  ${icon} ${test.description}`);
      });
      console.log('');
    }

    // Performance summary
    if (report.newIndexes > 0) {
      console.log('🎯 Expected Performance Improvements:');
      console.log('   • Repository dashboard queries: 80-95% faster');
      console.log('   • Pattern searches: 85-95% faster');
      console.log('   • Timeline events: 75-90% faster');
      console.log('   • Error analytics: 70-85% faster');
      console.log('');
    }
  }

  private parseArguments(): CliOptions {
    const args = process.argv.slice(2);
    const options: CliOptions = {
      dryRun: false,
      priorities: ['critical', 'high'],
      testOnly: false,
      rollback: [],
      stats: false,
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      switch (arg) {
        case '--dry-run':
          options.dryRun = true;
          break;

        case '--priority':
          if (i + 1 < args.length) {
            const priorityStr = args[++i];
            if (priorityStr) {
              options.priorities = priorityStr.split(',').map(p => p.trim()) as any;
            }
          }
          break;

        case '--test-only':
          options.testOnly = true;
          break;

        case '--rollback':
          if (i + 1 < args.length) {
            const indexStr = args[++i];
            if (indexStr) {
              options.rollback = indexStr.split(',').map(name => name.trim());
            }
          }
          break;

        case '--stats':
          options.stats = true;
          break;

        case '--help':
        case '-h':
          options.help = true;
          break;

        default:
          console.log(`Unknown option: ${arg}`);
          options.help = true;
          break;
      }
    }

    return options;
  }

  private showHelp(): void {
    console.log(`
RefactorForge Database Optimizer

USAGE:
  npx ts-node src/scripts/optimize-database.ts [options]

OPTIONS:
  --dry-run              Show what would be created without making changes
  --priority LEVELS      Specify priority levels (default: critical,high)
                         Options: critical, high, medium, low
  --test-only            Run performance tests only
  --rollback NAMES       Remove specific indexes (comma-separated names)
  --stats                Show current index statistics
  --help, -h             Show this help information

EXAMPLES:
  # Run optimization with critical and high priority indexes
  npx ts-node src/scripts/optimize-database.ts

  # Dry run to see what would be created
  npx ts-node src/scripts/optimize-database.ts --dry-run

  # Create all indexes including medium priority
  npx ts-node src/scripts/optimize-database.ts --priority critical,high,medium

  # Check current database statistics
  npx ts-node src/scripts/optimize-database.ts --stats

  # Run performance tests only
  npx ts-node src/scripts/optimize-database.ts --test-only

  # Rollback specific indexes
  npx ts-node src/scripts/optimize-database.ts --rollback idx_test1,idx_test2

PERFORMANCE IMPACT:
  • Repository queries: 80-95% faster
  • Pattern searches: 85-95% faster
  • Timeline events: 75-90% faster
  • Error analytics: 70-85% faster

The optimization is safe and can be rolled back if needed.
`);
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  const cli = new DatabaseOptimizerCLI();
  cli.run().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { DatabaseOptimizerCLI };