/* Handles Game related actions */
const { v4: uuidv4 } = require('uuid');
const app_db = require('../utils/Database')
const PayloadBuilder = require('../utils/PayloadBuilder');
const InputValidator = require('../utils/InputValidator');
const EventEmitter = require('events');
const { logger } = require('../config/winston_config')

class GameHandler extends EventEmitter {
  constructor(clientManager, gameManager, resourceManager) {
    super();
    this.clientManager = clientManager;
    this.gameManager = gameManager;
    this.resourceManager = resourceManager;
  }

  // Handles game creation -> void
  handleCreate(message) {
    const gameId = uuidv4();
    const client_id = message.client_id;
    

    //Check if the ip can create a game
    if (!this.resourceManager.canCreateGame(client_id)) {
      return this.emit('sendErrorToClient', client_id, 'game_limit_reached', "You already have too many active games")
    }

    const game = this.gameManager.createGame(client_id, gameId, message.board, message.length);
    this.resourceManager.addGame(client_id)
    const payload = PayloadBuilder.create(game);
    
    const client = this.clientManager.getClient(client_id);
    client.connection.send(JSON.stringify(payload));
  }

  // Handles people joining games -> void
  async handleJoin(message) {
    const { client_id, game_id, role } = message;


    //#region Input Validations

    //Send error to client doesnt work from websocket
    if (!InputValidator.validateClientId(client_id)) {
      this.emit('sendErrorToClient', client_id, "invalid_client_id", "Client ID format is invalid");
      return
    }

    if (!InputValidator.validateGameId(game_id)) {
      this.emit('sendErrorToClient', client_id, "invalid_game_id", "Game ID format is invalid")
      return;
    }

    if (role && !InputValidator.validateRole(role)) {
    this.emit('sendErrorToClient', client_id, "invalid_role", "Role must be 'attacker' or 'defender'");
    return;
    }
    //#endregion

    if (!this.gameManager.gameExists(game_id)) {
      logger.info("Game not found:", game_id);
      return;
    }

    if (this.gameManager.isGameFull(game_id)) {
      logger.info("Game is full");
      return;
    }

    //Find player name and rating
    const user = await app_db.findUsernameAndRating(client_id)
    const game = this.gameManager.getGame(game_id)
    
    this.gameManager.addPlayerToGame(game_id, client_id, role);

    const join_payload = PayloadBuilder.join(user.username, user.current_rating, game);
    
    // Notify all clients in the game
    this.emit('broadcastToGame', game_id, join_payload)

    
  }
  
  // Handles client ready status -> void
  async handleReady(message) {
    const { client_id, game_id } = message;
    
    const game = this.gameManager.getGame(game_id);
    if (!this.gameManager.gameExists(game_id)) {
      logger.info("Game not found:", game_id);
      return;
    }
    
    // Check if client is actually in this game
    const gameClientObjects = this.gameManager.getGameClients(game_id);
    const clientInGame = gameClientObjects.find(clientObj => clientObj.id == client_id)
    
    if (!clientInGame){
      logger.info("Cant find this client in current game:", client_id)
      return
    }

    // Set client as ready and check if all clients are ready
    const all_ready = this.gameManager.setClientReady(game_id, client_id);

    //Send the player who just got ready a "catch up" payload if they arent first
    if (game.clients.length == 2) {
      const opponent_client = game.clients.find(client => client.id !== client_id);
      const opponent = await app_db.findUsernameAndRating(opponent_client.id);
      
      const current_game_payload = PayloadBuilder.currentGameState(opponent.username, opponent.current_rating, game.game_state);
      this.emit('sendToClient', client_id, current_game_payload);
    }

    // If all clients are ready, send the players their roles and start the game
    if (all_ready) {
      //send startGame
      const timers = this.gameManager.getGameTimes(game_id)
      this.gameManager.startGame(game_id);
      const start_payload = PayloadBuilder.start(game, timers);
      this.emit('broadcastToGame', game_id, start_payload)
    }
  }

  handleWin(message) {
    const {game_id, win_condition, winner} = message
    this.gameManager.gameWin(game_id, win_condition) 
    const win_payload = PayloadBuilder.win(game_id, win_condition, winner)
    this.emit('broadcastToGame', game_id, win_payload)
  }

  handleTimeout(game_id, win_con, winner) {
    this.gameManager.gameWin(game_id, win_con)
    const win_payload = PayloadBuilder.win(game_id, win_con, winner)
    this.emit('broadcastToGame', game_id, win_payload)
  }
  
}

module.exports = GameHandler;
