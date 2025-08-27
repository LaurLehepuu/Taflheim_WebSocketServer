/* Handles Move related actions */
const ruleEngine = require('../utils/RuleEngine');
const PayloadBuilder = require('../utils/PayloadBuilder');
const InputValidator = require('../utils/InputValidator');
const EventEmitter = require('events');

class MoveHandler extends EventEmitter {
  constructor(clientManager, gameManager) {
    super()
    this.clientManager = clientManager;
    this.gameManager = gameManager;

  }

  //Handles everything to do with moves -> void
  handleMove(message) {
    const { game_id, client_id, move_from, move_to } = message;


    //#region Input validators
    if (!InputValidator.validateGameId(game_id)) {
      console.error("Invalid game ID in move");
      return;
    }
    
    if (!InputValidator.validateMoveCoordinates(move_from)) {
      console.error("Invalid move_from coordinates");
      return;
    }
    
    if (!InputValidator.validateMoveCoordinates(move_to)) {
      console.error("Invalid move_to coordinates");  
      return;
    }
    //#endregion


    //Make sure all critical info exists
    if (!game_id || !client_id || !move_from || !move_to) {
      console.error("Missing required move paramaters");
      return;
    }

    const game = this.gameManager.getGame(game_id);

    //Make sure game exists
    if (!game) {
      console.error(`Game ${game_id} not found`);
      return;
    }

    const player_role = this.gameManager.getPlayerRole(game_id, client_id)
    const current_turn = this.gameManager.getCurrentTurn(game_id)

    // If it is not currently this players turn, return
    if (current_turn != player_role){
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
      this.emit('broadcastToGame', gameId, takenPayload)
    }

    // Sync move to other players
    const timers = this.gameManager.getGameTimes(gameId)
    const move_payload = PayloadBuilder.move(moveFrom, moveTo, timers);
    this.emit('broadcastToGame', gameId, move_payload)

    // Check for win condition
    const hasWon = ruleEngine.has_win_occurred(gameState);
    if (hasWon) {
      console.log(ruleEngine.game_over_reason);
      const winPayload = PayloadBuilder.win(gameId, ruleEngine.game_over_reason, ruleEngine.winner);
      this.gameManager.gameWin(gameId, ruleEngine.game_over_reason)
      this.emit('broadcastToGame', gameId, winPayload)
    }

    //Change whose turn it is
    this.gameManager.changeTurn(gameId);
  }
}

module.exports = MoveHandler;
