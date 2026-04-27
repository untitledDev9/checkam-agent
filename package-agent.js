const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Starting CheckAm Agent packaging process...');

// 1. Bundle with esbuild (NO MINIFY - needed for --no-bytecode to work with source)
console.log('🔨 Bundling with esbuild (unminified for source inclusion)...');
execSync('npx esbuild src/index.ts --bundle --platform=node --target=node18 --outfile=dist/index.js', { stdio: 'inherit' });

// 2. Patch the bundle to remove node:sqlite references just in case (though undici is gone)
console.log('🩹 Patching bundle for safety...');
const bundlePath = path.join(__dirname, 'dist', 'index.js');
let bundle = fs.readFileSync(bundlePath, 'utf8');
const patchedBundle = bundle.replace(/require\("node:sqlite"\)/g, '{}')
                           .replace(/import\("node:sqlite"\)/g, 'Promise.resolve({})');
fs.writeFileSync(bundlePath, patchedBundle);

// 3. Package with pkg
console.log('📦 Running pkg with --no-bytecode...');
try {
  // We use --no-bytecode because the bytecode generator fails on Node 22/24. 
  // Since we are passing the unminified source bundle, it will be included as source.
  execSync('npx pkg dist/index.js --no-bytecode --out-path build --targets node18-win-x64,node18-macos-x64,node18-macos-arm64', { stdio: 'inherit' });
  console.log('🎉 Packaging successful! Check the "build" folder.');
} catch (err) {
  console.error('❌ pkg failed.');
  process.exit(1);
}
