const fs = require('fs');
const path = require('path');

console.log('=== ENVIRONMENT FILE CHECK ===\n');
console.log('Current directory:', process.cwd());
console.log('');

const envLocal = path.join(process.cwd(), '.env.local');
const env = path.join(process.cwd(), '.env');

console.log('.env.local:', fs.existsSync(envLocal) ? 'EXISTS' : 'NOT FOUND');
console.log('.env:', fs.existsSync(env) ? 'EXISTS' : 'NOT FOUND');
console.log('');

if (fs.existsSync(envLocal)) {
  console.log('Reading .env.local...');
  const content = fs.readFileSync(envLocal, 'utf8');
  const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  console.log(`Found ${lines.length} variables:`);
  lines.forEach(line => {
    const key = line.split('=')[0].trim();
    const hasValue = line.includes('=') && line.split('=')[1]?.trim();
    console.log(`  ${key}: ${hasValue ? 'HAS VALUE' : 'NO VALUE'}`);
  });
} else {
  console.log('❌ .env.local NOT FOUND!');
  console.log('\nTo create it:');
  console.log('  1. cp env.example .env.local');
  console.log('  2. Edit .env.local and add your credentials');
  console.log('  3. Restart dev server: npm run dev');
}

