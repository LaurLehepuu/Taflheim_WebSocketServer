/* === server.js (main entry point) ===
  Initilize managers here*/
const http = require("http");
const { PORT } = require("./config/constants");
const ConnectionHandler = require('./handlers/ConnectionHandler');
const GameHandler = require('./handlers/GameHandler');
const MoveHandler = require('./handlers/MoveHandler')
const ClientManager = require("./managers/ClientManager");
const GameManager = require("./managers/GameManager");
const ResourceManager = require("./managers/ResourceManager")
const WebSocketManager = require("./managers/WebSocketManager");
const ruleEngine = require("./utils/RuleEngine");
const { logger } = require("./config/winston_config");

// Create and start HTTP server
const httpServer = http.createServer();
httpServer.listen(PORT, () => {
  logger.info(`Server listening on port ${PORT}`);
});

// Initialize managers
const clientManager = new ClientManager();
const gameManager = new GameManager();
const resourceManager = new ResourceManager()

// Initialize handlers here
const connectionHandler = new ConnectionHandler(clientManager);
const gameHandler = new GameHandler(clientManager, gameManager, resourceManager);
const moveHandler = new MoveHandler(clientManager, gameManager);

//Initialize webSocketManager
const webSocketManager = new WebSocketManager(httpServer, connectionHandler, gameHandler, moveHandler, clientManager, gameManager, resourceManager);
console.log("WebSocket server initialized and ready for connections");
