const { execSync } = require('child_process');
const fs = require('fs');

console.log('📦 Starting CheckAm Agent packaging process...');

// 🛡️ Ensure directories exist
if (!fs.existsSync('dist')) fs.mkdirSync('dist');
if (!fs.existsSync('build')) fs.mkdirSync('build');

// 1. Bundle with esbuild
console.log('🔨 Bundling with esbuild...');
execSync('npx esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js', { stdio: 'inherit' });

// 2. Windows: --no-console = runs silently with NO terminal window
console.log('📦 Building Windows (silent mode — no terminal)...');
try {
  execSync(
    'npx pkg dist/index.js --no-bytecode --public --no-console --out-path build --targets node18-win-x64',
    { stdio: 'inherit' }
  );
  console.log('  ✅ Windows → build/index-win-x64.exe (fully silent, no terminal)');
} catch {
  console.error('  ❌ Windows build failed.');
}

// 3. macOS ARM (M1/M2/M3)
console.log('📦 Building macOS ARM64...');
try {
  execSync(
    'npx pkg dist/index.js --no-bytecode --public --output build/checkam-agent-macos-arm64 --targets node18-macos-arm64',
    { stdio: 'inherit' }
  );
  console.log('  ✅ macOS ARM64 → build/checkam-agent-macos-arm64');
} catch {
  console.error('  ❌ macOS ARM64 build failed.');
}

// 4. macOS Intel (x64)
console.log('📦 Building macOS x64...');
try {
  execSync(
    'npx pkg dist/index.js --no-bytecode --public --output build/checkam-agent-macos-x64 --targets node18-macos-x64',
    { stdio: 'inherit' }
  );
  console.log('  ✅ macOS x64 → build/checkam-agent-macos-x64');
} catch {
  console.error('  ❌ macOS x64 build failed.');
}

console.log('\n🎉 Done! Executables are in the "build" folder.');
console.log('   Windows users: double-click the .exe — NO terminal will appear.');
