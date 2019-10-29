---
title: How to create web-based terminals
date: "2019-10-29T11:24:19-04:00"
description: "Tutorial about how to create terminals similar to VSCode built-in terminal and HyperJS using web technologies."
---

This article gives bare-bones details about how to build a terminal using web technologies and use it in the browser. The same technologies are used to create terminal apps like VSCode built-in terminal and [Hyper](https://hyper.is/).

We need to create both server and client. And, we are going to use [Socket.IO](https://socket.io/) to send and receive data. If you need this for electron, you do not need [socket.io](http://socket.io/). Please check the electron related information at the end of the article.

### Main libraries we are going to use:

**Client Side**

1. [Socket.io](http://socket.io/) client
2. [xterm.js](https://github.com/xtermjs/xterm.js) - UI for terminal

**Server Side**

1. [Socket.io](http://socket.io/) server
2. [node-pty](https://github.com/microsoft/node-pty) - Creates pseudoterminals. We need to send input to this. Check [this](https://en.wikipedia.org/wiki/Pseudoterminal) if you need more information about pseudoterminals.

The running apps for both client and server are available in the following codesandbox links. If they are not working, please open the links and give them a quick refresh to wake them up if the apps are hibernated by Codesandbox.

- [Server Codesandbox](https://codesandbox.io/s/web-terminal-tutorial-server-g2ihu)
- [Client Codesandbox](https://codesandbox.io/s/web-terminal-turorial-client-sgjgg)

The code also available is available on [Github](https://github.com/saisandeepvaddi/how-to-create-web-terminals)

### Creating Server

Let us first setup basics. Create a server from NodeJS `http` module and pass it to [socket.io](http://socket.io/) server.

```js
//index.js
const http = require("http");
const SocketService = require("./SocketService");

/* 
  Create Server from http module.
  If you use other packages like express, use something like,
  
  const app = require("express")();
  const server = require("http").Server(app);

*/
const server = http.createServer((req, res) => {
  res.write("Terminal Server Running.");
  res.end();
});

const port = 8080;

server.listen(port, function() {
  console.log("Server listening on : ", port);
  const socketService = new SocketService();

 // We are going to pass server to socket.io in SocketService.js
  socketService.attachServer(server);
});
```
Next, we need to create a wrapper class to add event listeners for [socket.io](http://socket.io/) events.

```js
//SocketService.js

const socketIO = require("socket.io");
const PTYService = require("./PTYService");

class SocketService {
  constructor() {
    this.socket = null;
    this.pty = null;
  }

  attachServer(server) {
    if (!server) {
      throw new Error("Server not found...");
    }

    const io = socketIO(server);
    console.log("Created socket server. Waiting for client connection.");
    // "connection" event happens when any client connects to this io instance.
    io.on("connection", socket => {
      console.log("Client connect to socket.", socket.id);

      this.socket = socket;

      this.socket.on("disconnect", () => {
        console.log("Disconnected Socket: ", socket.id);
      });

      // Create a new pty service when client connects.
      this.pty = new PTYService(this.socket);

     // Attach event listener for socket.io
      this.socket.on("input", input => {
        // Runs this listener when socket receives "input" events from socket.io client.
				// input event is emitted on client side when user types in terminal UI
        this.pty.write(input);
      });
    });
  }
}

module.exports = SocketService;
```

Finally on the server-side, let's create a pseudo-terminal process using `node-pty`. The input we enter will be passed to an instance of `node-pty` and output will be sent to connected [socket.io](http://socket.io/) client. We are going to add [socket.io](http://socket.io/) client later.

```js
// PTYService.js

const os = require("os");
const pty = require("node-pty");

class PTY {
  constructor(socket) {
    // Setting default terminals based on user os
    this.shell = os.platform() === "win32" ? "powershell.exe" : "bash";
    this.ptyProcess = null;
    this.socket = socket;

    // Initialize PTY process.
    this.startPtyProcess();
  }

  /**
   * Spawn an instance of pty with a selected shell.
   */
  startPtyProcess() {
    this.ptyProcess = pty.spawn(this.shell, [], {
      name: "xterm-color",
      cwd: process.env.HOME, // Which path should terminal start
      env: process.env // Pass environment variables
    });

    // Add a "data" event listener.
    this.ptyProcess.on("data", data => {
      // Whenever terminal generates any data, send that output to socket.io client
      this.sendToClient(data);
    });
  }

  /**
   * Use this function to send in the input to Pseudo Terminal process.
   * @param {*} data Input from user like a command sent from terminal UI
   */

  write(data) {
    this.ptyProcess.write(data);
  }

  sendToClient(data) {
    // Emit data to socket.io client in an event "output"
    this.socket.emit("output", data);
  }
}

module.exports = PTY;
```

### Creating Client

Now comes the UI. It is super simple. All we have to do now is, create a terminal with `xterm` and attach it to a container in dom. Then, pass input in terminal to the connected [socket.io](http://socket.io/)'s server. We are also going to add an event listener to socket.io-client which will write the reply from [socket.io](http://socket.io/) server to xtermjs terminal.

On a html page, create a `div` where xtermjs will attach a terminal.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Terminal in Browser</title>
    <meta charset="UTF-8" />
  </head>

  <body>
    <div id="terminal-container"></div>
    <script src="src/index.js"></script>
  </body>
</html>
```

Before starting [socket.io](http://socket.io) client, Let's create a wrapper class to contain xtermjs related functions and also required event listeners for socket.io-client.

```js
// TerminalUI.js

// You will need a bundler like webpack or parcel to use these imports.
// The example in codesandboxes and github uses parcel.

import { Terminal } from "xterm";
import "xterm/css/xterm.css"; // DO NOT forget importing xterm.css

export class TerminalUI {
  constructor(socket) {
    this.terminal = new Terminal();

    /* You can make your terminals colorful :) */
    this.terminal.setOption("theme", {
      background: "#202B33",
      foreground: "#F5F8FA"
    });

    this.socket = socket;
  }

  /**
   * Attach event listeners for terminal UI and socket.io client
   */
  startListening() {
    this.terminal.onData(data => this.sendInput(data));
    this.socket.on("output", data => {
      // When there is data from PTY on server, print that on Terminal.
      this.write(data);
    });
  }

  /**
   * Print something to terminal UI.
   */
  write(text) {
    this.terminal.write(text);
  }

  /**
   * Utility function to print new line on terminal.
   */
  prompt() {
    this.terminal.write(`\\r\\n$ `);
  }

  /**
   * Send whatever you type in Terminal UI to PTY process in server.
   * @param {*} input Input to send to server
   */
  sendInput(input) {
    this.socket.emit("input", input);
  }

  /**
   *
   * container is a HTMLElement where xterm can attach terminal ui instance.
   * div#terminal-container in this example.
   */
  attachTo(container) {
    this.terminal.open(container);
    // Default text to display on terminal.
    this.terminal.write("Terminal Connected");
    this.terminal.write("");
    this.prompt();
  }

  clear() {
    this.terminal.clear();
  }
}
```

*xtermjs* has support for all kinds of cool stuff. You can create themes for your terminals, you can use addons for other functionality. Check [xtermjs github repo](https://github.com/xtermjs/xterm.js) for details. If you want more customization right in this example, you can update above `TerminalUI.js` file and customize the `this.terminal` object. A basic dark theme option is added here as an example.

And finally, we need to initialize our [socket.io](http://socket.io/) client to send/receive events from the *node-pty* process from the server.

```js
// index.js

import { TerminalUI } from "./TerminalUI";
import io from "socket.io-client";

// IMPORTANT: Make sure you replace this address with your server address.

const serverAddress = "http://localhost:8080";

function connectToSocket(serverAddress) {
  return new Promise(res => {
    const socket = io(serverAddress);
    res(socket);
  });
}

function startTerminal(container, socket) {
  // Create an xterm.js instance.
  const terminal = new TerminalUI(socket);

  // Attach created terminal to a DOM element.
  terminal.attachTo(container);

  // When terminal attached to DOM, start listening for input, output events.
  // Check TerminalUI startListening() function for details.
  terminal.startListening();
}

function start() {
  const container = document.getElementById("terminal-container");
  // Connect to socket and when it is available, start terminal.
  connectToSocket(serverAddress).then(socket => {
    startTerminal(container, socket);
  });
}

// Better to start on DOMContentLoaded. So, we know terminal-container is loaded
start();
```


When both server and client are running, you'll see a terminal in your browser. Please check xtermjs documentation for other styling customization like height, width.


### For Electron users

Using *xtermjs* and *node-pty* is even simpler in Electron. As the renderer process can run node modules, you can directly create and pass data between *xtermjs* and *node-pty* without using any socket library. A simple example would look something like,

```js
// In electronjs renderer process

// Make sure nodeIntegration is enabled in your BrowserWindow. 
// Check github repo for full example (link given at the beginning of this article).

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
// we don't need to use any socket to communicate between xterm/node-pty

ptyProcess.on("data", function(data) {
  terminal.write(data);
});

terminal.onData(data => ptyProcess.write(data));
```

A working electron example is added in Github repository.

### Other Information

If you only need a terminal UI that just prints output from NodeJS `child_process`, you do not need *node-pty*. You can send `child_process` stdout directly to *xtermjs* UI. 

One of my open-source projects [https://github.com/saisandeepvaddi/ten-hands](https://github.com/saisandeepvaddi/ten-hands) works this way. Check [Ten Hands](https://github.com/saisandeepvaddi/ten-hands) to see some in-depth usage of `xtermjs`, `socket.io`, and `ReactJS` together to build terminal-based apps.

Thank you 🙏