const spawn = require("cross-spawn");
const path = require("path");
const fs = require("fs");

const frontendDir = path.join(__dirname, "..", "frontend");
const distDir = path.join(__dirname, "frontend-dist");
const buildSourceDir = path.join(frontendDir, "out");

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  const files = fs.readdirSync(from);
  for (const file of files) {
    const currentFrom = path.join(from, file);
    const currentTo = path.join(to, file);
    const stat = fs.statSync(currentFrom);
    if (stat.isDirectory()) {
      copyFolderSync(currentFrom, currentTo);
    } else {
      fs.copyFileSync(currentFrom, currentTo);
    }
  }
}

console.log("=== Starting Desktop Frontend Build Automation ===");

// 1. Clean previous desktop frontend-dist
if (fs.existsSync(distDir)) {
  console.log(`Cleaning old frontend assets at ${distDir}...`);
  fs.rmSync(distDir, { recursive: true, force: true });
}

// 1.a Clean previous Next.js export output to avoid stale assets
if (fs.existsSync(buildSourceDir)) {
  console.log(`Cleaning old Next.js export output at ${buildSourceDir}...`);
  fs.rmSync(buildSourceDir, { recursive: true, force: true });
}

// 2. Build Next.js frontend in static export mode
console.log("Running Next.js production build with static HTML export...");
const result = spawn.sync("npm", ["run", "build"], {
  cwd: frontendDir,
  env: {
    ...process.env,
    IS_ELECTRON_BUILD: "true",
    NEXT_PUBLIC_API_URL: "http://localhost:3000/api"
  },
  stdio: "inherit"
});

if (result.status !== 0) {
  console.error("Next.js static export build failed!");
  process.exit(result.status || 1);
}

// 3. Copy frontend/out to desktop/frontend-dist
console.log(`Copying compiled assets from ${buildSourceDir} to ${distDir}...`);
copyFolderSync(buildSourceDir, distDir);

console.log("=== Desktop Frontend Build Completed Successfully ===");

// === Backend Bundling Automation ===
console.log("\n=== Starting Desktop Backend Build Automation ===");

const backendDir = path.join(__dirname, "..", "backend");
const backendRuntimeDir = path.join(__dirname, "backend-runtime");

// 4. Clean previous backend-runtime
if (fs.existsSync(backendRuntimeDir)) {
  console.log(`Cleaning old backend runtime at ${backendRuntimeDir}...`);
  fs.rmSync(backendRuntimeDir, { recursive: true, force: true });
}

// 5. Compile NestJS backend
console.log("Running NestJS production compilation...");
const backendBuildResult = spawn.sync("npm", ["run", "build"], {
  cwd: backendDir,
  stdio: "inherit"
});

if (backendBuildResult.status !== 0) {
  console.error("NestJS backend compilation failed!");
  process.exit(backendBuildResult.status || 1);
}

// 6. Copy dist, prisma, and node_modules into backend-runtime
console.log("Copying backend dist to runtime...");
copyFolderSync(path.join(backendDir, "dist"), path.join(backendRuntimeDir, "dist"));

console.log("Copying backend prisma schema and migrations...");
copyFolderSync(path.join(backendDir, "prisma"), path.join(backendRuntimeDir, "prisma"));

console.log("Copying backend node_modules dependencies (this may take a few seconds)...");
copyFolderSync(path.join(backendDir, "node_modules"), path.join(backendRuntimeDir, "node_modules"));

console.log("=== Desktop Backend Build Completed Successfully ===\n");

