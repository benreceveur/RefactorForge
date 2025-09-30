#!/usr/bin/env node

/**
 * Button Fix Verification Script
 * 
 * This script verifies that all button fixes are properly implemented
 * and provides a checklist for manual testing.
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 BUTTON FIX VERIFICATION');
console.log('=' .repeat(50));

// Files to check
const filesToCheck = [
  'src/components/CodeImprovements.js',
  'src/index.css',
  'test-button-functionality.html',
  'test-code-improvements-buttons.html',
  'BUTTON_FIX_SUMMARY.md'
];

// Verification checks
const checks = [
  {
    name: 'Stable Key Generation (No Timestamp)',
    file: 'src/components/CodeImprovements.js',
    pattern: /Date\.now\(\)/,
    shouldExist: false,
    description: 'Timestamp removed from key generation to ensure stability'
  },
  {
    name: 'Debug Logging Added',
    file: 'src/components/CodeImprovements.js', 
    pattern: /console\.log\('🔘.*button clicked'/,
    shouldExist: true,
    description: 'Debug logging added to track button clicks'
  },
  {
    name: 'Toggle Logic Fixed',
    file: 'src/components/CodeImprovements.js',
    pattern: /setExpandedCard\(isExpanded \? null : uniqueKey\)/,
    shouldExist: true,
    description: 'Both buttons use consistent toggle logic'
  },
  {
    name: 'Chrome Extension Error Handling',
    file: 'src/components/CodeImprovements.js',
    pattern: /runtime\.lastError.*message channel closed/,
    shouldExist: true,
    description: 'Chrome extension warning suppression added'
  },
  {
    name: 'CSS Button Improvements',
    file: 'src/index.css',
    pattern: /pointer-events: auto/,
    shouldExist: true,
    description: 'Explicit pointer events and cursor styling added'
  },
  {
    name: 'State Change Monitoring',
    file: 'src/components/CodeImprovements.js',
    pattern: /🔄 Expanded card state changed/,
    shouldExist: true,
    description: 'State change monitoring for debugging'
  }
];

let passedChecks = 0;
let failedChecks = 0;

console.log('Running verification checks...\n');

checks.forEach((check, index) => {
  const filePath = path.join(__dirname, check.file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`❌ ${index + 1}. ${check.name}`);
    console.log(`   File not found: ${check.file}\n`);
    failedChecks++;
    return;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const matches = fileContent.match(check.pattern);
  
  if (check.shouldExist) {
    if (matches) {
      console.log(`✅ ${index + 1}. ${check.name}`);
      console.log(`   ${check.description}\n`);
      passedChecks++;
    } else {
      console.log(`❌ ${index + 1}. ${check.name}`);
      console.log(`   Pattern not found: ${check.pattern}\n`);
      failedChecks++;
    }
  } else {
    if (!matches) {
      console.log(`✅ ${index + 1}. ${check.name}`);
      console.log(`   ${check.description}\n`);
      passedChecks++;
    } else {
      console.log(`❌ ${index + 1}. ${check.name}`);
      console.log(`   Unwanted pattern found: ${check.pattern}\n`);
      failedChecks++;
    }
  }
});

console.log('VERIFICATION SUMMARY');
console.log('=' .repeat(20));
console.log(`✅ Passed: ${passedChecks}`);
console.log(`❌ Failed: ${failedChecks}`);
console.log(`📊 Total:  ${checks.length}\n`);

if (failedChecks === 0) {
  console.log('🎉 ALL CHECKS PASSED!');
  console.log('The button fixes have been successfully implemented.\n');
} else {
  console.log('⚠️  SOME CHECKS FAILED');
  console.log('Please review the failed checks above.\n');
}

console.log('MANUAL TESTING CHECKLIST');
console.log('=' .repeat(25));
console.log('□ 1. Open http://localhost:3000');
console.log('□ 2. Navigate to Code Improvements section');
console.log('□ 3. Open browser developer console (F12)');
console.log('□ 4. Click "View Code" button on any improvement card');
console.log('□ 5. Verify code comparison section expands');
console.log('□ 6. Check console for debug log: "🔘 View Code button clicked"');
console.log('□ 7. Click "View Details" button');
console.log('□ 8. Verify implementation details section expands');
console.log('□ 9. Check console for debug log: "🔘 View Details button clicked"');
console.log('□ 10. Verify only one section is expanded at a time');
console.log('□ 11. Test button toggle functionality (expand/collapse)');
console.log('□ 12. Verify no React warnings in console\n');

console.log('EXPECTED CONSOLE OUTPUT');
console.log('=' .repeat(23));
console.log('🔍 Card state debug: { uniqueKey: "improvement-0-...", ... }');
console.log('🔘 View Code button clicked { uniqueKey: "...", ... }');
console.log('🔄 Expanded card state changed: improvement-0-...');
console.log('🔘 View Details button clicked { uniqueKey: "...", ... }\n');

console.log('If manual testing passes, the button issue is fully resolved! 🚀');