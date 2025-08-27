/* Manages Clients on the server*/
class ClientManager {
  constructor() {
    this.clients = {};
  }

  //Adds a client -> void
  addClient(client_id, connection, gameId = null) {
    this.clients[client_id] = { 
      connection,
      game_id: gameId
    };
    console.log(`Client registered: ${client_id}`);
  }

  //Removes a client -> void
  removeClient(client_id) {
    delete this.clients[client_id];
    console.log(`Client removed: ${client_id}`);
  }

  //Returns a clients connection by its id -> string
  getClient(client_id) {
    return this.clients[client_id];
  }
  //Updates a clients connection (on resume) -> void
  updateClientConnection(client_id, connection) {
    if (this.clients[client_id]) {
      this.clients[client_id].connection = connection;
    }
  }

  //Checks if client exists -> bool 
  clientExists(client_id) {
    return !!this.clients[client_id];
  }

  getAllClients() {
    return this.clients
  }

}

module.exports = ClientManager
