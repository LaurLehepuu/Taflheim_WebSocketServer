/* Handles Move related actions */
const ruleEngine = require('../utils/RuleEngine');
const PayloadBuilder = require('../utils/PayloadBuilder');

class MoveHandler {
  constructor(clientManager, gameManager) {
    this.clientManager = clientManager;
    this.gameManager = gameManager;

  }

  //Handles everything to do with moves -> void
  handleMove(message) {
    const { game_id, client_id, move_from, move_to } = message;
    const game = this.gameManager.getGame(game_id);
    const player_role = this.gameManager.getPlayerRole(game_id, client_id)
    const current_turn = this.gameManager.getCurrentTurn(game_id)

    // If it is not currently this players turn, return
    if (this.gameManager.getCurrentTurn(game_id) != this.gameManager.getPlayerRole(game_id, client_id)){
      console.log("Not currently that players turn:", client_id)
      return;
    }

    if (!game) {
      console.log("Game not found for move:", game_id);
      return;
    }

    //This should never happen due to inactive pieces on the client
    if (game.active == false){
      console.log("Game is inactive")
      return;
    }

    const gameState = game.game_state;
    const isValid = ruleEngine.is_move_valid(gameState, move_from, move_to);
    
    // Send validation result to the player who made the move
    const timers = this.gameManager.getGameTimes(game_id)
    const validationPayload = PayloadBuilder.move(isValid, timers);
    this.clientManager.getClient(client_id).connection.send(JSON.stringify(validationPayload));

    if (isValid) { //If the move is valid, continue on with Processing the move
      this.processValidMove(game_id, client_id, move_from, move_to, gameState);
    }
  }

  //Does all the work needed for movement to occur -> void
  processValidMove(gameId, clientId, moveFrom, moveTo, gameState) {
    // Update game state
    const previousState = JSON.parse(JSON.stringify(gameState)); // Deep copy
    gameState[moveTo[1]][moveTo[0]] = gameState[moveFrom[1]][moveFrom[0]];
    gameState[moveFrom[1]][moveFrom[0]] = ' ';
    
    this.gameManager.updateGameState(gameId, gameState, previousState);

    // Check for taken pieces
    ruleEngine.has_taking_occurred(gameState, moveTo);
    if (ruleEngine.taken_piece_coordinates.length > 0) {
      const takenPayload = PayloadBuilder.taken(gameId, ruleEngine.taken_piece_coordinates);
      this.broadcastToGame(gameId, takenPayload);
    }

    // Sync move to other players
    const timers = this.gameManager.getGameTimes(gameId)
    const syncPayload = PayloadBuilder.sync(moveFrom, moveTo, timers);
    this.broadcastToOtherPlayers(gameId, clientId, syncPayload);

    // Check for win condition
    const hasWon = ruleEngine.has_win_occurred(gameState);
    if (hasWon) {
      console.log(ruleEngine.game_over_reason);
      const winPayload = PayloadBuilder.win(gameId, ruleEngine.game_over_reason, ruleEngine.winner);
      this.gameManager.gameWin(gameId, ruleEngine.game_over_reason)
      this.broadcastToGame(gameId, winPayload);
    }

    //Change whose turn it is
    this.gameManager.changeTurn(gameId);
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

  // Broadcasts a payload to all players excluding the one who originally sent it -> void
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

module.exports = MoveHandler;
