const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Starting CheckAm Agent packaging process (Final Workaround)...');

// 🛡️ Ensure directories exist
if (!fs.existsSync('dist')) fs.mkdirSync('dist');
if (!fs.existsSync('build')) fs.mkdirSync('build');

// 1. Bundle with esbuild
console.log('🔨 Bundling with esbuild (unminified for source inclusion)...');
execSync('npx esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js', { stdio: 'inherit' });

// 2. Package with pkg (using --no-bytecode to skip the part that crashes in Node 24)
console.log('📦 Running pkg --no-bytecode...');
try {
  // The --public flag is essential when using --no-bytecode on a bundled file
  execSync('npx pkg dist/index.js --no-bytecode --public --out-path build --targets node18-win-x64,node18-macos-x64,node18-macos-arm64', { stdio: 'inherit' });
  console.log('\n🎉 SUCCESS! Your executables are in the "build" folder.');
} catch (err) {
  console.error('\n❌ pkg failed again.');
  console.log('\n💡 Final suggestion: If you have Node 18 or 20 installed elsewhere, try running the build there.');
}
