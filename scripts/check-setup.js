#!/usr/bin/env node
// Diagnostic script to check setup

const fs = require('fs');
const path = require('path');

console.log('🔍 BroadCastaway Setup Diagnostics\n');
console.log('=' .repeat(50));

// Check 1: Node version
console.log('\n1. Node.js Version:');
console.log(`   ${process.version} (${process.versions.node >= 18 ? '✅' : '❌'} - Need 18+)`);

// Check 2: Environment files
console.log('\n2. Environment Files:');
const envFiles = ['.env', '.env.local', '.env.development.local'];
envFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${file}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
  if (exists) {
    const content = fs.readFileSync(file, 'utf8');
    const hasAppId = content.includes('NEXT_PUBLIC_AGORA_APP_ID') && !content.includes('your_agora_app_id');
    const hasCert = content.includes('AGORA_APP_CERTIFICATE') && !content.includes('your_agora_certificate');
    console.log(`      - NEXT_PUBLIC_AGORA_APP_ID: ${hasAppId ? '✅ SET' : '⚠️  NOT SET'}`);
    console.log(`      - AGORA_APP_CERTIFICATE: ${hasCert ? '✅ SET' : '⚠️  NOT SET'}`);
  }
});

// Check 3: Required files
console.log('\n3. Required Files:');
const requiredFiles = [
  'package.json',
  'next.config.js',
  'app/api/token/route.js',
  'app/api/channels/route.ts',
  'netlify/functions/utils/AccessToken2.js',
  'netlify/functions/utils/RtcTokenBuilder2.js',
  'src/services/agoraService.js'
];

requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
});

// Check 4: Node modules
console.log('\n4. Dependencies:');
const nodeModulesExists = fs.existsSync('node_modules');
console.log(`   node_modules: ${nodeModulesExists ? '✅ EXISTS' : '❌ MISSING - Run: npm install'}`);

if (nodeModulesExists) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = Object.keys(packageJson.dependencies || {});
  const devDeps = Object.keys(packageJson.devDependencies || {});
  console.log(`   Dependencies: ${deps.length} packages`);
  console.log(`   Dev Dependencies: ${devDeps.length} packages`);
  
  // Check critical deps
  const critical = ['next', 'react', 'react-dom'];
  critical.forEach(dep => {
    const installed = fs.existsSync(`node_modules/${dep}`);
    console.log(`   ${dep}: ${installed ? '✅' : '❌'}`);
  });
}

// Check 5: Next.js structure
console.log('\n5. Next.js Structure:');
const appFiles = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/browse/page.tsx',
  'app/host/page.tsx',
  'app/watch/page.tsx',
  'app/broadcast/[channelName]/page.tsx',
  'app/watch/[channelName]/page.tsx'
];

appFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`   ${file}: ${exists ? '✅' : '❌'}`);
});

// Check 6: Token builder exports
console.log('\n6. Token Builder Utilities:');
try {
  const tokenBuilderPath = path.join(process.cwd(), 'netlify', 'functions', 'utils', 'RtcTokenBuilder2.js');
  if (fs.existsSync(tokenBuilderPath)) {
    const content = fs.readFileSync(tokenBuilderPath, 'utf8');
    const hasExports = content.includes('module.exports');
    console.log(`   RtcTokenBuilder2.js: ✅ EXISTS`);
    console.log(`   Has module.exports: ${hasExports ? '✅' : '❌'}`);
  } else {
    console.log(`   RtcTokenBuilder2.js: ❌ MISSING`);
  }
} catch (err) {
  console.log(`   Error checking: ${err.message}`);
}

console.log('\n' + '='.repeat(50));
console.log('\n📝 Next Steps:');
console.log('   1. If .env.local is missing, create it from env.example');
console.log('   2. Fill in your Agora credentials');
console.log('   3. Run: npm install (if node_modules missing)');
console.log('   4. Run: npm run dev');
console.log('   5. Check terminal logs for detailed error messages\n');

