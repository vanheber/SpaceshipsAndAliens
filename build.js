const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const DST = path.join(SRC, "public");

const includes = {
  nav: fs.readFileSync(path.join(SRC, "includes", "nav.html"), "utf8"),
  footer: fs.readFileSync(path.join(SRC, "includes", "footer.html"), "utf8"),
  "footer-index": fs.readFileSync(path.join(SRC, "includes", "footer-index.html"), "utf8"),
};

const footerMap = { "index.html": "footer-index" };

const SKIP_DIRS = new Set(["includes", "node_modules", "plans", ".git", "public"]);
const SKIP_FILES = new Set(["build.js", "deploy.sh", ".env", ".env.example", "package.json", ".gitignore", "AGENTS.md", "README.md", "PROMPT_CONTO.md", "PROMPTS_IMAGENS.md", "tiburion-planfloor.af"]);

function writeIfChanged(dst, content) {
  try {
    const existing = fs.readFileSync(dst, "utf8");
    if (existing === content) return;
  } catch (e) {}
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content);
}

function copyIfChanged(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    return;
  }
  const existing = fs.readFileSync(dst);
  const current = fs.readFileSync(src);
  if (existing.equals(current)) return;
  fs.copyFileSync(src, dst);
}

function shouldSkip(relPath) {
  const parts = relPath.split(path.sep);
  for (let i = 0; i < parts.length - 1; i++) {
    if (SKIP_DIRS.has(parts[i])) return true;
  }
  const name = parts[parts.length - 1];
  if (SKIP_FILES.has(name)) return true;
  if (name.startsWith(".") && name !== ".htaccess") return true;
  return false;
}

function processDir(srcDir, dstDir) {
  fs.mkdirSync(dstDir, { recursive: true });
  for (const name of fs.readdirSync(srcDir)) {
    if (name.startsWith(".") && name !== ".htaccess") continue;
    const srcPath = path.join(srcDir, name);
    const dstPath = path.join(dstDir, name);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(name)) continue;
      processDir(srcPath, dstPath);
    } else {
      if (SKIP_FILES.has(name)) continue;
      if (name.endsWith(".html")) {
        let html = fs.readFileSync(srcPath, "utf8");
        html = html.replace("<!--#include nav-->", includes.nav);
        html = html.replace("<!--#include footer-->", includes[footerMap[name] || "footer"]);
        writeIfChanged(dstPath, html);
      } else {
        copyIfChanged(srcPath, dstPath);
      }
    }
  }
}

function cleanRemoved(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const dstPath = path.join(dir, name);
    const stat = fs.statSync(dstPath);
    if (stat.isDirectory()) {
      cleanRemoved(dstPath);
      if (fs.readdirSync(dstPath).length === 0) fs.rmdirSync(dstPath);
    } else {
      const rel = path.relative(DST, dstPath);
      const srcPath = path.join(SRC, rel);
      if (!fs.existsSync(srcPath) || shouldSkip(rel)) fs.unlinkSync(dstPath);
    }
  }
}

processDir(SRC, DST);
cleanRemoved(DST);
console.log("Build concluído: public/");
