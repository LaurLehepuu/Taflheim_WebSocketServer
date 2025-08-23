/* Websocket manager routes and handles messages sent through websockets
Initilization of handlers happens here                  */ 
const WebSocketServer = require("websocket").server;
const ConnectionHandler = require('../handlers/ConnectionHandler');
const GameHandler = require('../handlers/GameHandler');
const MoveHandler = require('../handlers/MoveHandler');

class WebSocketManager {
  constructor(httpServer, connectionHandler, gameHandler, moveHandler, clientManager, gameManager) {
    this.connectionHandler = connectionHandler;
    this.gameHandler = gameHandler;
    this.moveHandler = moveHandler
    this.clientManager = clientManager;
    this.gameManager = gameManager;
    
    
    
    // Initialize WebSocket server
    this.websocket = new WebSocketServer({
      httpServer: httpServer
    });
    
    this.setupWebSocketHandlers();

    //Find a better way to do this, for now gameManager emits Event
    this.gameManager.on('gameTimeout', (game_id, win_con, winner) => {
      this.gameHandler.handleTimeout(game_id, win_con, winner)
    });
  }
  
  //Sets up websocket -> void
  setupWebSocketHandlers() {
    this.websocket.on("request", request => {
      const connection = request.accept(null, request.origin);
      
      connection.on("open", () => console.log("Connection opened"));
      connection.on("close", () => console.log("Connection closed"));
      connection.on("message", (message) => this.parseMessage(message, connection));
    });
  }
  
  //Tries to parse message and hands it off to the handler -> void
  parseMessage(message, connection) {
  // Validate message format
  if (message.type !== 'utf8') return;
  
  let parsedMessage;
  try {
    parsedMessage = JSON.parse(message.utf8Data);
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return;
  }
  
  this.routeMessage(parsedMessage, connection);
}

//Routes message via method -> void
routeMessage(message, connection) {
  const { method, client_id } = message;

  // Handle connection methods that don't require client validation
  if (method === "new_connection") {
    this.connectionHandler.handleNewConnection(connection);
    return;
  }

  if (method === "resume") {
    console.log("Connection resume")
    this.connectionHandler.handleResume(message, connection);
    return;
  }

  // Validate client exists for all other methods
  if (!this.clientManager.clientExists(client_id)) {
    console.log("Invalid client_id received:", client_id);
    return;
  }

  // Route to appropriate handler
  switch (method) {
    case "create":
      this.gameHandler.handleCreate(message);
      break;
    case "join":
      this.gameHandler.handleJoin(message);
      break;
    case "start":
      this.gameHandler.handleStart(message);
      break;
    case "ready":
      this.gameHandler.handleReady(message);
      break;
    case "win":
      this.gameHandler.handleWin(message);
      break;
    case "move":
      this.moveHandler.handleMove(message);
      break;
    default:
      console.log("Unknown method:", method);
    }

  }

}



module.exports = WebSocketManager;
