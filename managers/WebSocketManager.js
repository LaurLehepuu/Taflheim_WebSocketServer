/* Websocket manager routes and handles messages sent through websockets
Initilization of handlers happens here                  */ 
const WebSocketServer = require("websocket").server;
const ConnectionHandler = require('../handlers/ConnectionHandler');
const GameHandler = require('../handlers/GameHandler');
const MoveHandler = require('../handlers/MoveHandler');
const PayloadBuilder = require("../utils/PayloadBuilder");
const { logger } = require('../config/winston_config')

class WebSocketManager {
  constructor(httpServer, connectionHandler, gameHandler, moveHandler, clientManager, gameManager, resourceManager) {
    this.connectionHandler = connectionHandler;
    this.gameHandler = gameHandler;
    this.moveHandler = moveHandler
    this.clientManager = clientManager;
    this.gameManager = gameManager;
    this.resourceManager = resourceManager
    
    
    
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
      const client_ip = request.remoteAddress; 

      //If a connection cant be created due to resource manager
      if (!this.resourceManager.canCreateConnection(client_ip)) {
        request.reject(429, "This IP already has too many connections open")
      }

      const connection = request.accept(null, request.origin);
      logger.info(`Connection opened to IP:${client_ip}`)
      this.resourceManager.addConnection(client_ip)

      connection.on("error", (error) => {
        logger.error("Websocket Connection error:", error)
        this.handleConnectionError(connection, error);
      });

      connection.on("close", (reasonCode, description) => {
        logger.info(`Connection closed with code: ${reasonCode}, description: ${description}`);
        this.handleDisconnect(connection)
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

    //Removes game from specifics client limit
    this.gameManager.on('deleteGame', (client_id) => {
      this.resourceManager.removeGame(client_id)
    });

    //#region Send events
    this.moveHandler.on('broadcastToGame', (game_id, payload) => {
      this.broadcastToGame(game_id, payload);
    });

    this.gameHandler.on('sendErrorToClient', (client_id, error_type, message, details = null) => {
      this.sendErrorToClient(client_id, error_type, message, details);
    });

    this.gameHandler.on('sendToClient', (client_id, payload) => {
      this.sendToClient(client_id, payload)
    })

    this.gameHandler.on('broadcastToOtherPlayers', (game_id, client_id, payload) => {
      this.broadcastToOtherPlayers(game_id, client_id, payload)
    })

    this.gameHandler.on('broadcastToGame', (game_id, payload) => {
      this.broadcastToGame(game_id, payload);
    });

    this.connectionHandler.on('clientResumed', (client_id) => {
      this.clearDisconnectionTimeout(client_id);
    });
    //#endregion
  }

  handleConnectionError(connection, error) {
    const client_id = this.findClientByConnection(connection);
    const client_ip = connection.remoteAddress

    //If you found the client, proceed to handle error
    if (client_id) {
      this.clientManager.removeClient(client_id)
      this.resourceManager.removeConnection(client_ip)
      this.sendErrorToClient(client_id, "connection_error", "there was an error with your connection")
    }
  }

  handleDisconnect(connection) {
    const client_ip = connection.remoteAddress;
    
    if (!connection) {
      this.resourceManager.removeConnection(client_ip);
      logger.error('Connection not defined');
      return;
    }
    
    const client_id = this.findClientByConnection(connection);
    if (!client_id) {
      this.resourceManager.removeConnection(client_ip);
      logger.error('Handling disconnect failed due to a non existent client_id');
      return;
    }
    
    // Remove connection from resource manager
    this.resourceManager.removeConnection(client_ip);
    
    const client = this.clientManager.getClient(client_id);
    
    // Remove client from any active game immediately
    if (client && client.game_id) {
      const game = this.gameManager.getGame(client.game_id);
      if (game && game.active) {

        //Find client role
        const role = this.gameManager.getPlayerRole(client.game_id, client_id)

        const payload = {
          game_id: client.game_id,
          win_condition: "opponent_disconnect",
          winner: role == "attacker" ? "defender" : "attacker",
        };
        
        // End the game due to disconnection
        this.gameHandler.handleWin(payload);
      }
    }
    
    // Set up a timeout to allow for reconnection attempts
    const timeoutId = setTimeout(() => {
      const currentClient = this.clientManager.getClient(client_id);
      
      if (!currentClient || currentClient.connection.readyState !== currentClient.connection.OPEN) {
        logger.info(`Client ${client_id} did not reconnect, cleaning up`);
        
        this.clientManager.removeClient(client_id);
        logger.info(`Client ${client_id} removed due to disconnect`);
      }
      
      // Clean up the timeout reference
      if (this.disconnectionTimeouts) {
        delete this.disconnectionTimeouts[client_id];
      }
    }, 30000);
    
    // Store the timeout ID so we can cancel it if client reconnects
    if (!this.disconnectionTimeouts) {
      this.disconnectionTimeouts = {};
    }
    this.disconnectionTimeouts[client_id] = timeoutId;
  }

  clearDisconnectionTimeout(client_id) {
  if (this.disconnectionTimeouts && this.disconnectionTimeouts[client_id]) {
    clearTimeout(this.disconnectionTimeouts[client_id]);
    delete this.disconnectionTimeouts[client_id];
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
      logger.warn("Non-UTF8 message received");
      return;
    }
    
    let parsedMessage;
    try {
      parsedMessage = JSON.parse(message.utf8Data);
    } catch (error) {
      logger.error("Error parsing JSON:", error);
      this.sendError(connection, "parse_error", "invalid JSON format")
      return;
    }

    //Validate message structure
    if (!this.validateMessage(parsedMessage)) {
      logger.info(`Non valid structure payload :${message.utf8Data}`)
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

  // all other methods require a client_id
  return typeof message.client_id === "string";
}

//Routes message via method -> void
routeMessage(message, connection) {
  const { method, client_id } = message;
  const client_ip = connection.remoteAddress;

  // Handle connection methods that don't require client validation
  if (method === "new_connection") {
    this.connectionHandler.handleNewConnection(connection, message.client_id);
    logger.info(`New Connection established: ${message.client_id}`)
    return;
  }

  if (method === "resume") {
    logger.info("Connection resume")
    this.connectionHandler.handleResume(message, connection);
    return;
  }

  // Validate client exists for all other methods
  if (!this.clientManager.clientExists(client_id)) {
    logger.info("Invalid client_id received:", client_id);
    return;
  }

    // Route to appropriate handler with error handling
    try {
      switch (method) {
        case "create":
          this.gameHandler.handleCreate(message, client_ip);
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
        case "move":
          this.moveHandler.handleMove(message);
          break;
        default:
          logger.info("Unknown method:", method);
          this.sendError(connection, "unknown_method", `Method '${method}' is not supported`, {
            method: method,
            supported_methods: ["create", "join", "start", "ready", "win", "move"]
          });
      }
    } catch (error) {
      logger.error(`Error handling method ${method}:`, error);
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

  sendToClient(client_id, payload) {
    const client = this.clientManager.getClient(client_id)
    if (client) {
      client.connection.send(JSON.stringify(payload))
    }
    else {
      logger.error(`COULDNT SEND CLIENT ${client_id} a message`)
    }
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
      logger.error("Cannot send error - connection is not open")
      return false;
    }

    try {
      const errorPayload = PayloadBuilder.error(error_type, message, details);
      connection.send(JSON.stringify(errorPayload))
      logger.info(`Error sent to client: ${error_type} - ${message}`)
      return true

    } catch (sendError) {
      logger.error("Failed to send error message:", sendError);
      return false;
    }
  }

  //Sends an error to the client specified
  sendErrorToClient(client_id, error_type, message, details = null) {
      const client = this.clientManager.getClient(client_id);
      if (client && client.connection) {
          const errorPayload = PayloadBuilder.error(error_type, message, details);
          try {
              client.connection.send(JSON.stringify(errorPayload));
          } catch (error) {
              logger.error('Failed to send error to client', { client_id, error: error.message });
          }
      }
  }
  //#endregion
}



module.exports = WebSocketManager;
