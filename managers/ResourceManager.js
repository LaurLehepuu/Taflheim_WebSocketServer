class ResourceManager {
  constructor() {
    this.maxGamesPerIP = 5;
    this.maxConnectionsPerIP = 1;
    this.connectionsByIP = new Map();
    this.gamesByIP = new Map();
  }
  
  canCreateConnection(ip) {
    const currentConnections = this.connectionsByIP.get(ip) || 0;
    console.log(currentConnections)
    return currentConnections < this.maxConnectionsPerIP;
  }
  
  canCreateGame(ip) {
    const currentGames = this.gamesByIP.get(ip) || 0;
    return currentGames < this.maxGamesPerIP;
  }

  addConnection(ip) {
    const current_connections = this.connectionsByIP.get(ip) || 0
    this.connectionsByIP.set(ip, current_connections + 1)
  }

  removeConnection(ip) {
    const current_connections = this.connectionsByIP.get(ip) || 0
    this.connectionsByIP.set(ip, current_connections - 1)
  }

  addGame(ip) {
    const current_games = this.gamesByIP.get(ip) || 0
    this.gamesByIP.set(ip, current_games + 1)
  }

  removeGame(ip) {
    const current_games = this.gamesByIP.get(ip) || 0
    this.gamesByIP.set(ip, current_games - 1)
  }
}

module.exports = ResourceManager
