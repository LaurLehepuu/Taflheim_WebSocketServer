class ResourceManager {
  constructor() {
    this.maxGamesPerID = 5;
    this.maxConnectionsPerIP = 5;
    this.connectionsByIP = new Map();
    this.gamesByID = new Map();
  }
  
  canCreateConnection(ip) {
    const currentConnections = this.connectionsByIP.get(ip) || 0;
    return currentConnections < this.maxConnectionsPerIP;
  }

  addConnection(ip) {
    const current_connections = this.connectionsByIP.get(ip) || 0
    this.connectionsByIP.set(ip, current_connections + 1)
  }

  removeConnection(ip) {
    const current_connections = this.connectionsByIP.get(ip) || 0
    this.connectionsByIP.set(ip, current_connections - 1)
  }

  canCreateGame(client_id) {
    const currentGames = this.gamesByID.get(client_id) || 0;
    return currentGames < this.maxGamesPerID;
  }

  addGame(client_id) {
    const current_games = this.gamesByID.get(client_id) || 0
    this.gamesByID.set(client_id, current_games + 1)
  }

  removeGame(client_id) {
    const current_games = this.gamesByID.get(client_id) || 0
    this.gamesByID.set(client_id, current_games - 1)
  }
}

module.exports = ResourceManager
