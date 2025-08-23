/* Handles Game related actions */
const { v4: uuidv4 } = require('uuid');
const PayloadBuilder = require('../utils/PayloadBuilder');

class GameHandler {
  constructor(clientManager, gameManager) {
    this.clientManager = clientManager;
    this.gameManager = gameManager;
  }

  // Handles game creation -> void
  handleCreate(message) {
    const gameId = uuidv4();
    const clientId = message.client_id;
    
    const game = this.gameManager.createGame(gameId, message.board, message.length);
    const payload = PayloadBuilder.create(game);
    
    const client = this.clientManager.getClient(clientId);
    client.connection.send(JSON.stringify(payload));
  }

  // Handles people joining games -> void
  handleJoin(message) {
    const { client_id, game_id, role } = message;
    
    if (!this.gameManager.gameExists(game_id)) {
      console.log("Game not found:", game_id);
      return;
    }

    if (this.gameManager.isGameFull(game_id)) {
      console.log("Game is full");
      return;
    }

    this.gameManager.addPlayerToGame(game_id, client_id, role);
    const game = this.gameManager.getGame(game_id);
    const joinPayload = PayloadBuilder.join(client_id, game);

    // Notify all clients in the game
    this.broadcastToGame(game_id, joinPayload);
  }

  // Handles client ready status -> void
  handleReady(message) {
    const { client_id, game_id } = message;

    const game = this.gameManager.getGame(game_id);
    if (!this.gameManager.gameExists(game_id)) {
      console.log("Game not found:", game_id);
    return;
    }

    // Check if client is actually in this game
    const gameClientObjects = this.gameManager.getGameClients(game_id);
    const clientInGame = gameClientObjects.find(clientObj => clientObj.id == client_id)

    if (!clientInGame){
      console.log("Cant find this client in current game:", client_id)
      return
    }

    // Set client as ready and check if all clients are ready
    const all_ready = this.gameManager.setClientReady(game_id, client_id);

    // Notify all clients that someone is ready
    const ready_payload = PayloadBuilder.ready(client_id, game_id);
    this.broadcastToGame(game_id, ready_payload);

    // If all clients are ready, send the players their roles and start the game
    if (all_ready) {
      //send startGame
      const timers = this.gameManager.getGameTimes(game_id)
      this.gameManager.startGame(game_id);
      const start_payload = PayloadBuilder.start(game, timers);
      this.broadcastToGame(game_id, start_payload);
    }
  }

  handleTimeout(game_id, win_con, winner) {
    this.gameManager.gameWin(game_id, win_con)
    const win_payload = PayloadBuilder.win(game_id, win_con, winner)
    this.broadcastToGame(game_id, win_payload)
  }

  //Handles sending a payload to everyone in a game -> void
  broadcastToGame(gameId, payload) {
    const clients = this.gameManager.getGameClients(gameId);
    clients.forEach(clientObj => {
      const client = this.clientManager.getClient(clientObj.id);
      if (client) {
        client.connection.send(JSON.stringify(payload));
      }
    });
  }

   broadcastToOtherPlayers(gameId, excludeClientId, payload) {
    const clients = this.gameManager.getGameClients(gameId);
    clients.forEach(clientObj => {
      if (clientObj.id !== excludeClientId) {
        const client = this.clientManager.getClient(clientObj.id);
        if (client) {
          client.connection.send(JSON.stringify(payload));
        }
      }
    });
  }
}

module.exports = GameHandler;
