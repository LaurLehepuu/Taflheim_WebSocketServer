/* === server.js (main entry point) ===
  Initilize managers here*/
const http = require("http");
const { PORT } = require("./config/constants");
const ConnectionHandler = require('./handlers/ConnectionHandler');
const GameHandler = require('./handlers/GameHandler');
const MoveHandler = require('./handlers/MoveHandler')
const ClientManager = require("./managers/ClientManager");
const GameManager = require("./managers/GameManager");
const WebSocketManager = require("./managers/WebSocketManager");
const ruleEngine = require("./utils/RuleEngine");

// Create and start HTTP server
const httpServer = http.createServer();
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Initialize managers
const clientManager = new ClientManager();
const gameManager = new GameManager();

// Initialize handlers here
const connectionHandler = new ConnectionHandler(clientManager);
const gameHandler = new GameHandler(clientManager, gameManager);
const moveHandler = new MoveHandler(clientManager, gameManager);

//Initialize webSocketManager
const webSocketManager = new WebSocketManager(httpServer, connectionHandler, gameHandler, moveHandler, clientManager, gameManager);
console.log("WebSocket server initialized and ready for connections");
