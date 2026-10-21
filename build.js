const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DIST = path.join(ROOT, "dist");

const EXCLUDED = new Set([
  "node_modules",
  "dist",
  ".git",
  ".env",
  ".env.local",
  "build.js",
  "node-codes.zip",
]);

function copyRecursive(source, destination) {
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    if (EXCLUDED.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      copyRecursive(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

// Remove old dist
if (fs.existsSync(DIST)) {
  fs.rmSync(DIST, {
    recursive: true,
    force: true,
  });
}

// Create dist
fs.mkdirSync(DIST, {
  recursive: true,
});

// Copy project
copyRecursive(ROOT, DIST);

console.log("");
console.log("========================================");
console.log(" KCL BACKEND BUILD COMPLETED");
console.log("========================================");
console.log(`Output: ${DIST}`);
console.log("========================================");