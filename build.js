const fs = require("fs");
const path = require("path");

const SRC = __dirname;
const DST = path.join(SRC, "public");

const includes = {
  nav: fs.readFileSync(path.join(SRC, "includes", "nav.html"), "utf8"),
  footer: fs.readFileSync(path.join(SRC, "includes", "footer.html"), "utf8"),
  "footer-index": fs.readFileSync(path.join(SRC, "includes", "footer-index.html"), "utf8"),
};

const footerMap = {
  "index.html": "footer-index",
};

const SKIP_DIRS = new Set(["includes", "node_modules", "plans", ".git", "public"]);
const SKIP_FILES = new Set(["build.js", "deploy.sh", ".env", ".env.example", "package.json", ".gitignore", "AGENTS.md", "README.md", "PROMPT_CONTO.md", "PROMPTS_IMAGENS.md", "tiburion-planfloor.af"]);

function copy(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (SKIP_DIRS.has(path.basename(src))) return;
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name.startsWith(".") && name !== ".htaccess") continue;
      copy(path.join(src, name), path.join(dst, name));
    }
  } else {
    const base = path.basename(src);
    if (SKIP_FILES.has(base)) return;
    if (base.endsWith(".html")) {
      let html = fs.readFileSync(src, "utf8");
      html = html.replace("<!--#include nav-->", includes.nav);
      html = html.replace("<!--#include footer-->", includes[footerMap[base] || "footer"]);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, html);
    } else {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
  }
}

fs.mkdirSync(DST, { recursive: true });
copy(SRC, DST);
console.log("Build concluído: public/");
