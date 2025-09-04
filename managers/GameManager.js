/* Manages Active Games on the server */
const EventEmitter = require('events');
const TurnTimer = require('../utils/TurnTimer')
const app_db = require('../utils/Database')
const glickoCalculator = require('../utils/Glicko')
const { logger } = require('../config/winston_config')

class GameManager extends EventEmitter {
  constructor(inactivityTimeout = 10 * 60 * 1000) { //default 10 minutes
    super();
    this.games = {};
    this.takenRoles = []

    // Start cleanup interval (check every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      logger.info("Cleanup started")
      this.cleanupInactiveGames();
    }, 5 * 60 * 1000);
    this.inactivityTimeout = inactivityTimeout;
  }

  //Creates and returns a game -> Dictionary
  createGame(client_id, game_id, initialGameState, length) {
    this.games[game_id] = {
      id: game_id,
      timer: new TurnTimer(length*60000 , "attacker", (win_con, winner) => this.gameTimerTimeout(game_id, win_con, winner)), //Convert minutes to ms
      game_state: initialGameState,
      game_state_history: [],
      clients: [], //Stores client objects
      takenRoles: [],
      current_turn: "attacker",
      active: false,
      created_at: Date.now(),
      created_by: client_id,
      last_activity: Date.now()
    };
    logger.info(`Game created: ${game_id}`);
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
  addPlayerToGame(gameId, client_id, role, rating) {
    const game = this.games[gameId];

    if(!game) {
      logger.error(`Game ${gameId} not found`);
      return false;
    }

    if (!client_id) {
      logger.error("Cliend ID is required")
      return false;
    }

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
          rating,
          timer: game.length,
          ready: false,
        }
        game.takenRoles = role
        game.clients.push(client);
        logger.info(`Player ${client_id} added to game ${gameId} as ${role}`);
        return true;
    }
    return false;
  }

  // Updates game state (and saves game state to history) -> void
  updateGameState(game_id, newState, previousState) {
    const game = this.games[game_id]
    if (game) {
      game.game_state_history.push(previousState);
      game.game_state = newState;
      game.lastActivity = Date.now()
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
      logger.error("no game")
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
    game.lastActivity = Date.now()
  }

  getGameTimes(game_id) {
    const game = this.games[game_id]
    return game.timer.getTimes();
  }

  gameTimerTimeout(game_id, win_con, winner) {
    this.emit('gameTimeout', game_id, win_con, winner);
  }

  //Calculates new ratings, updates them and ends the game by making it inactive -> void
  async gameWin(gameId, winner) {
    //find clients 
    const clients = this.games[gameId].clients
    if (!clients) {
      logger.error("No client found when gameWin")
      return 
    }
    const defender = clients.find(clientObj => clientObj.role == 'defender')
    const attacker = clients.find(clientObj => clientObj.role == 'attacker') 
    
    //Get their ratings
    const defender_ratings = await app_db.findRatingInfo(defender.id)
    const attacker_ratings = await app_db.findRatingInfo(attacker.id)
    //Calculate new ratings and update them
    let new_ratings;
    
    //Passed in winner is wrong
    if (winner = 'defender') {
      new_ratings = glickoCalculator.calculatePostGameRatings(attacker_ratings, defender_ratings)
      app_db.updateRatingInfo(new_ratings, attacker.id, defender.id)
    }
    else {
      new_ratings = glickoCalculator.calculatePostGameRatings(defender_ratings, attacker_ratings)
      app_db.updateRatingInfo(new_ratings, defender.id, attacker.id)
    }

    //Save game to DB !TODO

    const game = this.games[gameId];
    game.active = false;
    game.won_by = winner 
    game.timer.stop()
    game.lastActivity = Date.now()
  }

  // Cleanup inactive games
  cleanupInactiveGames() {
    const now = Date.now();
    const gamesToDelete = [];

    for (const [gameId, game] of Object.entries(this.games)) {
      const timeSinceActivity = now - game.last_activity;
      
      // Delete if inactive for longer than timeout or if game ended and been inactive
      if (timeSinceActivity > this.inactivityTimeout || 
          (!game.active && timeSinceActivity > 5 * 60 * 1000)) { // 5 min for ended games
        gamesToDelete.push(gameId);
      }
    }

    gamesToDelete.forEach(gameId => {
      this.deleteGame(gameId);
    });

    if (gamesToDelete.length > 0) {
      logger.info(`Cleaned up ${gamesToDelete.length} inactive games`);
    }
  }

  // Delete a specific game
  deleteGame(gameId) {
    const game = this.games[gameId];
    if (game) {
      // Stop timer if still running
      if (game.timer) {
        game.timer.stop();
      }
      const client_id = this.games[gameId].created_by
      this.emit('deleteGame', client_id)
      delete this.games[gameId];
      logger.info(`Game deleted: ${gameId}`);
      return true;
    }
    return false;
  }

}

module.exports = GameManager;
