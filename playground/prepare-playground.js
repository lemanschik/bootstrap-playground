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

fs.copyFileSync("../workbench.ts", "src/vs/code/browser/workbench/workbench.ts");

child_process.execSync("yarn gulp vscode-web-min", { stdio: "inherit" });

// Extract compiled files update code-oss-web
if (fs.existsSync("../../code-oss-web")) {
  //fs.rmdirSync("../../code-oss-web", { recursive: true });
}
// /code-oss-web
fs.mkdirSync("../../code-oss-web");
fse.copySync("../vscode-web", "../../code-oss-web");
fse.copySync("../extensions", "../../code-oss-web/extensions");
