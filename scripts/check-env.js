#!/usr/bin/env node
// Quick script to check .env.local file location and contents

const fs = require('fs');
const path = require('path');

console.log('🔍 Environment File Check\n');
console.log('='.repeat(50));

const cwd = process.cwd();
console.log('Current working directory:', cwd);
console.log('');

// Check for .env files
const envFiles = ['.env.local', '.env', '.env.development', '.env.production'];
const foundFiles = [];

envFiles.forEach(file => {
  const filePath = path.join(cwd, file);
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✅' : '❌'} ${file}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
  
  if (exists) {
    foundFiles.push(file);
    // Show first few lines (without values)
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
      console.log(`   Variables found: ${lines.length}`);
      lines.slice(0, 5).forEach(line => {
        const key = line.split('=')[0].trim();
        console.log(`   - ${key}`);
      });
      if (lines.length > 5) {
        console.log(`   ... and ${lines.length - 5} more`);
      }
    } catch (err) {
      console.log(`   Error reading: ${err.message}`);
    }
  }
});

console.log('\n' + '='.repeat(50));
console.log('\n📝 Next.js Environment Variable Priority:');
console.log('1. .env.local (highest priority)');
console.log('2. .env.development or .env.production (based on NODE_ENV)');
console.log('3. .env (lowest priority)');

if (foundFiles.length === 0) {
  console.log('\n❌ No .env files found!');
  console.log('\nTo create .env.local:');
  console.log('  cp env.example .env.local');
  console.log('  # Then edit .env.local and fill in your credentials');
} else {
  console.log(`\n✅ Found ${foundFiles.length} environment file(s)`);
  if (foundFiles.includes('.env.local')) {
    console.log('✅ .env.local exists - Next.js will use this file');
  } else {
    console.log('⚠️  .env.local not found - Next.js will use .env instead');
    console.log('   (Consider creating .env.local for local development)');
  }
}

console.log('\n💡 Tip: Restart your dev server after changing .env files!');
console.log('   npm run dev\n');

