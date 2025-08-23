/* Manages Active Games on the server */
const EventEmitter = require('events');
const TurnTimer = require('../utils/TurnTimer')

class GameManager extends EventEmitter {
  constructor() {
    super();
    this.games = {};
    this.takenRoles = []
  }

  //Creates and returns a game -> Dictionary
  createGame(game_id, initialGameState, length) {
    this.games[game_id] = {
      id: game_id,
      timer: new TurnTimer(length*60000 , "attacker", (win_con, winner) => this.gameTimerTimeout(game_id, win_con, winner)), //Convert minutes to ms
      game_state: initialGameState,
      game_state_history: [],
      clients: [], //Stores client objects
      takenRoles: [],
      current_turn: "attacker",
      active: false
    };
    console.log(`Game created: ${game_id}`);
    return this.games[game_id];
  }

  //Returns a game by its id -> String
  getGame(gameId) {
    return this.games[gameId];
  }

  gameExists(gameId) {
    return !!this.games[gameId];
  }

  //Returns true if player could be added, otherwise false -> bool
  addPlayerToGame(gameId, client_id, role) {
    const game = this.games[gameId];
    if (game && game.clients.length < 2) {
        // Check if client is already in the game
        game.clients.forEach(client => {
          if (client.id == client_id)
            return false; //Player is already in game
        });
        
        //If the player didn't specify a role, add them to whatever is available
        if (!role) {
            if (!game.takenRoles.includes("attacker")) {
                role = "attacker"
            } else if (!game.takenRoles.includes("defender")) {
                role = "defender"
            } 
        }
        //Otherwise add them to the specified role
        else {
            // Validate the role exists
            if (role !== 'attacker' && role !== 'defender') {
                return false;
            }
            // Check if role is already taken
            if (game.takenRoles.includes(role)) {
              return false  
            }
        }
        
        //if everything is good, create client object and add client to role
        const client = {
          id: client_id,
          role,
          timer: game.length,
          ready: false,
        }
        game.takenRoles = role
        game.clients.push(client);
        console.log(`Player ${client_id} added to game ${gameId} as ${role}`);
        return true;
    }
    return false;
  }

      // Updates game state (and saves game state to history) -> void
      updateGameState(game_id, newState, previousState) {
    if (this.games[game_id]) {
      this.games[game_id].game_state_history.push(previousState);
      this.games[game_id].game_state = newState;
    }
  }
  
  
  //Changes the current turn of a game -> void
  changeTurn(game_id) {
    const game = this.games[game_id];
    if (game.current_turn == "attacker"){
      game.current_turn = "defender";
    }
    else {
      game.current_turn = "attacker";
    }
    game.timer.switchPlayer()
  }
  
  getCurrentTurn(game_id){
    return this.games[game_id].current_turn
  }
  getPlayerRole(game_id, client_id) {
    const game = this.games[game_id]
    if (!game){
      console.log("no game")
    }
    const client = game.clients.find(clientObj => clientObj.id == client_id)
    return client ? client.role : undefined
  }
  
  //Returns all clients in a game -> Array
  getGameClients(gameId) {
    return this.games[gameId]?.clients || [];
  }
  
  
  //Checks if game is full -> bool
  isGameFull(gameId) {
    const game = this.games[gameId];
    return game && game.clients.length >= 2;
  }

  setClientReady(gameId, clientId) {
    const game = this.games[gameId]
    if (!game) return false;
    const gameClientObjects = this.getGameClients(gameId);
    //Find client and change them to ready
    gameClientObjects.forEach(clientObj => {
      if (clientObj.id == clientId) {
        clientObj.ready = true;
      }
    })

    //Check if all clients are ready
    return this.areAllClientsReady(gameId);
  }

  areAllClientsReady(gameId) {
    const game = this.games[gameId];
    if (!game) return false;
    if (game.clients.length != 2) {
      return false;
    }

    //check if all clients are ready
    const gameClientObjects = this.getGameClients(gameId)
    gameClientObjects.forEach(clientObj => {
      if (!clientObj.ready){
        return false
      }
    }) 
    return true
  }

  //Starts game by making it active -> void
  startGame(gameId) {
    const game = this.games[gameId];
    game.active = true;
    game.timer.start() 
  }

  getGameTimes(game_id) {
    const game = this.games[game_id]
    return game.timer.getTimes();
  }

  gameTimerTimeout(game_id, win_con, winner) {
    this.emit('gameTimeout', game_id, win_con, winner);
  }

  //Ends game by making it inactive -> void
  gameWin(gameId, win_con) {
    const game = this.games[gameId];
    game.active = false;
    game.won_by = win_con 
    game.timer.stop()
  }

}

module.exports = GameManager;
