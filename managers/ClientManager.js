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

  //Returns a client by its id -> string
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

  sendErrorToClient(clientId, errorType, message, details = null) {
    const client = this.clientManager.getClient(clientId);
    if (client && client.connection) {
      const errorPayload = PayloadBuilder.error(errorType, message, details);
      try {
        client.connection.send(JSON.stringify(errorPayload));
      } catch (error) {
        console.error('Failed to send error to client', { clientId, error: error.message });
      }
    }
  }
  
}

module.exports = ClientManager
