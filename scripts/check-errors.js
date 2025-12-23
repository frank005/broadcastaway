#!/usr/bin/env node
// Comprehensive error checker for Next.js app

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Checking for errors...\n');
console.log('='.repeat(60));

const errors = [];
const warnings = [];

// 1. Check Node version
try {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.split('.')[0].substring(1));
  if (major < 18) {
    errors.push(`Node.js version ${nodeVersion} is too old. Need 18+`);
  } else {
    console.log(`✅ Node.js version: ${nodeVersion}`);
  }
} catch (e) {
  errors.push(`Cannot check Node version: ${e.message}`);
}

// 2. Check if node_modules exists
const nodeModulesExists = fs.existsSync('node_modules');
if (!nodeModulesExists) {
  errors.push('node_modules not found. Run: npm install');
} else {
  console.log('✅ node_modules exists');
}

// 3. Check critical dependencies
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredDeps = ['next', 'react', 'react-dom'];
requiredDeps.forEach(dep => {
  const installed = fs.existsSync(`node_modules/${dep}`);
  if (!installed) {
    errors.push(`Missing dependency: ${dep}. Run: npm install`);
  } else {
    console.log(`✅ ${dep} installed`);
  }
});

// 4. Check .env.local
const envLocalExists = fs.existsSync('.env.local');
if (!envLocalExists) {
  warnings.push('.env.local not found. Create it with: cp env.example .env.local');
} else {
  console.log('✅ .env.local exists');
  
  // Check if it has actual values (not placeholders)
  const envContent = fs.readFileSync('.env.local', 'utf8');
  if (envContent.includes('your_agora_app_id') || envContent.includes('your_agora_certificate')) {
    warnings.push('.env.local contains placeholder values. Replace with actual credentials.');
  }
}

// 5. Check critical files
const criticalFiles = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/api/token/route.js',
  'netlify/functions/utils/RtcTokenBuilder2.js',
];

criticalFiles.forEach(file => {
  if (!fs.existsSync(file)) {
    errors.push(`Missing critical file: ${file}`);
  } else {
    console.log(`✅ ${file} exists`);
  }
});

// 6. Check for TypeScript errors
console.log('\n📝 Checking TypeScript compilation...');
try {
  execSync('npx tsc --noEmit --skipLibCheck', { 
    stdio: 'pipe',
    cwd: process.cwd(),
    timeout: 10000 
  });
  console.log('✅ No TypeScript errors');
} catch (e) {
  const output = e.stdout?.toString() || e.stderr?.toString() || e.message;
  if (output.includes('error TS')) {
    errors.push('TypeScript errors found. Run: npx tsc --noEmit');
    console.log('❌ TypeScript errors:');
    console.log(output.split('\n').slice(0, 10).join('\n'));
  }
}

// 7. Check Next.js config
try {
  const nextConfig = require('./next.config.js');
  console.log('✅ next.config.js is valid');
} catch (e) {
  errors.push(`next.config.js error: ${e.message}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ No errors found!');
  console.log('\n💡 Next steps:');
  console.log('   1. Make sure .env.local has your actual credentials');
  console.log('   2. Run: npm run dev');
  console.log('   3. Check terminal for any runtime errors\n');
} else {
  if (errors.length > 0) {
    console.log('❌ ERRORS FOUND:');
    errors.forEach((err, i) => {
      console.log(`   ${i + 1}. ${err}`);
    });
    console.log('');
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach((warn, i) => {
      console.log(`   ${i + 1}. ${warn}`);
    });
    console.log('');
  }
}

process.exit(errors.length > 0 ? 1 : 0);

