/* Websocket manager routes and handles messages sent through websockets
Initilization of handlers happens here                  */ 
const WebSocketServer = require("websocket").server;
const ConnectionHandler = require('../handlers/ConnectionHandler');
const GameHandler = require('../handlers/GameHandler');
const MoveHandler = require('../handlers/MoveHandler');
const PayloadBuilder = require("../utils/PayloadBuilder");

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
    this.setupEventListeners();
  }

  //Sets up websocket -> void
  setupWebSocketHandlers() {
    this.websocket.on("request", request => {
      const connection = request.accept(null, request.origin);
      
      connection.on("error", (error) => {
        console.error("Websocket Connection error:", error)
        this.handleConnectionError(connection, error);
      });

      connection.on("open", () => console.log("Connection opened"));

      connection.on("close", () => {
        console.log(`Connection closed`)
        //Wait a little and if connection isnt resumed, remove from active clients 
      });

      connection.on("message", (message) => this.parseMessage(message, connection));
    });
  }

  //Sets up event listeners so managers could use events to talk to websockets
  setupEventListeners() {

    //Timeout Event
    this.gameManager.on('gameTimeout', (game_id, win_con, winner) => {
      this.gameHandler.handleTimeout(game_id, win_con, winner)
    });

    //#region Send events
    this.moveHandler.on('broadcastToGame', (game_id, payload) => {
      this.broadcastToGame(game_id, payload);
    });

    this.gameHandler.on('broadcastToGame', (game_id, payload) => {
      this.broadcastToGame(game_id, payload);
    })
    //#endregion
  }

  handleConnectionError(connection, error) {
    const clientId = this.findClientByConnection(connection);
    if (clientId) {
      this.clientManager.removeClient(clientId)
    }
  }

  findClientByConnection(connection) {
  
    const clients = this.clientManager.getAllClients();

    for (const [clientId, client] of Object.entries(clients)) {
      if (client.connection === connection) {
        return clientId;
      }
    }

  return null; // Not found
  }
  
  //Tries to parse message and hands it off to the handler -> void
  parseMessage(message, connection) {
    // Validate message format
    if (message.type !== 'utf8') {
      console.warn("Non-UTF8 message received");
      return;
    }
    
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.utf8Data);
    } catch (error) {
      console.error("Error parsing JSON:", error);
      this.sendError(connection, "parse_error", "invalid JSON format")
      return;
    }

    //Validate message structure
    if (!this.validateMessage(parsedMessage)) {
      this.sendError(connection, "validation_error", "Invalid message structure");
      return;
    }
    
    this.routeMessage(parsedMessage, connection);
}

//Validate message structure
validateMessage(message) {
  if (!message || typeof message !== "object" || typeof message.method !== "string") {
    return false;
  }

  if (message.method === "new_connection") {
    return true; // no client_id required
  }

  // all other methods require a client_id
  return typeof message.client_id === "string";
}

//Routes message via method -> void
routeMessage(message, connection) {
  const { method, client_id } = message;

  // Handle connection methods that don't require client validation
  if (method === "new_connection") {
    const client_id = this.connectionHandler.handleNewConnection(connection);
    console.log(`New Connection established: ${client_id}`)
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

    // Route to appropriate handler with error handling
    try {
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
          this.sendError(connection, "unknown_method", `Method '${method}' is not supported`, {
            method: method,
            supported_methods: ["create", "join", "start", "ready", "win", "move"]
          });
      }
    } catch (error) {
      console.error(`Error handling method ${method}:`, error);
      this.sendError(connection, "handler_error", "Internal server error while processing request", {
        method: method
      });
    }
  }

  //#region send messages
  //Broadcasts payload to other players in the game -> void
  broadcastToOtherPlayers(gameId, excludeClientId, payload) {
    const clients = this.gameManager.getGameClients(gameId);
    clients.forEach(clientObj => {
      if (clientObj.id !== excludeClientId) {
        const client = this.clientManager.getClient(clientObj.id);
        if (client) {
            client.connection.send(JSON.stringify(payload));
        }
      }});
    }

  // Broadcasts a payload to all players in a game -> void
  broadcastToGame(gameId, payload) {
      const clients = this.gameManager.getGameClients(gameId);
      clients.forEach(clientObj => {
          const client = this.clientManager.getClient(clientObj.id);
          if (client) {
              client.connection.send(JSON.stringify(payload));
          }
      });
    }

    //Sends the error message to the given connection -> bool
    sendError(connection, error_type, message, details = null) {
    if (!connection || connection.readyState != connection.OPEN) {
      console.error("Cannot send error - connection is not open")
      return false;
    }

    try {
      const errorPayload = PayloadBuilder.error(error_type, message, details);
      connection.send(JSON.stringify(errorPayload))
      console.log(`Error sent to client: ${error_type} - ${message}`)
      return true

    } catch (sendError) {
      console.error("Failed to send error message:", sendError);
      return false;
    }
  }

  //Sends an error to the client specified
  sendErrorToClient(clientId, error_type, message, details = null) {
      const client = this.clientManager.getClient(clientId);
      if (client && client.connection) {
          const errorPayload = PayloadBuilder.error(error_type, message, details);
          try {
              client.connection.send(JSON.stringify(errorPayload));
          } catch (error) {
              console.error('Failed to send error to client', { clientId, error: error.message });
          }
      }
  }
  //#endregion
}



module.exports = WebSocketManager;
