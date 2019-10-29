// index.js

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
  socketService.attachServer(server);
});
