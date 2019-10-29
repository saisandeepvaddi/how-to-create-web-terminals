const os = require("os");
const pty = require("node-pty");
const Terminal = require("xterm").Terminal;

function start() {
  try {
    const shell = os.platform() === "win32" ? "powershell.exe" : "bash";

    const ptyProcess = pty.spawn(shell, [], {
      name: "xterm-color",
      cwd: process.env.HOME, // Which path should terminal start
      env: process.env // Pass environment variables
    });

    ptyProcess.on("data", function(data) {
      xterm.write(data);
    });

    // Initialize xterm.js and attach it to the DOM
    const xterm = new Terminal();
    xterm.open(document.getElementById("terminal-container"));

    // Setup communication between xterm.js and node-pty
    xterm.onData(data => ptyProcess.write(data));
  } catch (error) {
    console.log("error:", error);
  }
}

start();
