const path = require("path");
const fs = require("fs");

const targetDir = path.join(__dirname, "..", "backend");

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (file === "node_modules" || file === "dist" || file === ".git" || file === ".next") {
      continue;
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else {
      callback(filePath);
    }
  }
}

console.log(`Scanning directory: ${targetDir} for git conflicts...`);
let resolvedCount = 0;

walkDir(targetDir, (filePath) => {
  // Only check text files
  const ext = path.extname(filePath).toLowerCase();
  if (![".ts", ".js", ".json", ".sql", ".md", ".yml", ".yaml", ".txt"].includes(ext)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (content.includes("<<<<<<<") && content.includes("=======") && content.includes(">>>>>>>")) {
    console.log(`Resolving conflict in: ${path.relative(targetDir, filePath)}`);
    
    // Regular expression to match standard git conflict block and extract stashed changes section
    const resolvedContent = content.replace(/<<<<<<<[\s\S]*?=======([\s\S]*?)>>>>>>>.*/g, "$1");
    
    fs.writeFileSync(filePath, resolvedContent, "utf8");
    resolvedCount++;
  }
});

console.log(`Finished conflict resolution. Total files resolved: ${resolvedCount}`);
