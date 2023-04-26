var fs = require("fs");
const fse = require("fs-extra");
const child_process = require("child_process");
const process = require("process");

const codeOssVersion = "1.77.1";

if (!fs.existsSync("code-oss")) {
  child_process.execSync(`git clone -s --depth 1 https://github.com/microsoft/vscode.git -b ${codeOss} code-oss`, {
    stdio: "inherit",
  });
}

process.chdir("code-oss");

if (!fs.existsSync("node_modules")) {
  child_process.execSync("yarn", { stdio: "inherit" });
}

// Use simple workbench
fs.copyFileSync(
  "../workbench.ts",
  "src/vs/code/browser/workbench/workbench.ts"
);

// Compile
child_process.execSync("yarn gulp vscode-web-min", { stdio: "inherit" });

// Extract compiled files
if (fs.existsSync("../dist")) {
  fs.rmdirSync("../dist", { recursive: true });
}
fs.mkdirSync("../dist");
fse.copySync("../vscode-web", "../dist");
