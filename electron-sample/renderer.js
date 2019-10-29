const os = require("os");
const pty = require("node-pty");
const Terminal = require("xterm").Terminal;

function start() {
  try {
    // Choose shell based on os
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

    // Start PTY process
    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cwd: process.env.HOME, // Which path should terminal start
      env: process.env // Pass environment variables
    });

    // Create and attach xtermjs terminal on DOM
    const terminal = new Terminal();
    terminal.open(document.getElementById("terminal-container"));

    // Add event listeners for pty process and terminal
    // Since we enabled nodeIntegration in electron (see ./main.js file BrowserWindow options), we don't need to use
    // any socket to communicate between xterm/node-pty

    ptyProcess.on("data", function(data) {
      terminal.write(data);
    });

    terminal.onData(data => ptyProcess.write(data));
  } catch (error) {
    console.log("error:", error);
  }
}

start();
