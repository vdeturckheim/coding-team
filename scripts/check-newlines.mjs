#!/usr/bin/env node

import fs from 'node:fs';
import { glob } from 'glob';

/**
 * Check and optionally fix missing final newlines in files
 */
function checkNewlines(fix = false) {
  const patterns = ['src/**/*.ts', 'tests/**/*.ts', '*.json', '*.md', '*.yml', '*.yaml'];
  const exclude = ['node_modules/**', 'dist/**', '**/*.d.ts', '**/*.js', '**/*.js.map'];
  
  let hasErrors = false;
  
  for (const pattern of patterns) {
    const files = glob.sync(pattern, { ignore: exclude });
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(file);
        
        // Check if file is empty or ends with newline
        if (content.length > 0 && content[content.length - 1] !== 0x0A) {
          hasErrors = true;
          console.error(`❌ Missing final newline: ${file}`);
          
          if (fix) {
            fs.appendFileSync(file, '\n');
            console.log(`✅ Fixed: ${file}`);
          }
        }
      } catch (error) {
        console.error(`Error reading ${file}:`, error.message);
        hasErrors = true;
      }
    }
  }
  
  if (!fix && hasErrors) {
    console.error('\n💡 Run with --fix to automatically add missing newlines');
    process.exit(1);
  }
  
  if (!hasErrors) {
    console.log('✅ All files have proper final newlines');
  }
}

// Run the check
const fix = process.argv.includes('--fix');
checkNewlines(fix);