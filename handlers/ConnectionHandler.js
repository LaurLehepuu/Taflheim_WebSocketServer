/* Handles Connetion related actions */
const { v4: uuidv4 } = require('uuid');
const PayloadBuilder = require('../utils/PayloadBuilder');

class ConnectionHandler {
  constructor(clientManager) {
    this.clientManager = clientManager;
  }
  
  //Handles creating a new connection for a client -> String
  handleNewConnection(connection) {
    const clientId = uuidv4();
    this.clientManager.addClient(clientId, connection);
    
    const payload = PayloadBuilder.connect(clientId);
    connection.send(JSON.stringify(payload));
    return clientId;
  }

  //Handles when client sessions should resume (when changing pages) -> void
  handleResume(message, connection) {
    const { client_id, game_id } = message;
    const session = this.clientManager.getClient(client_id);

    if (session) {
      this.clientManager.updateClientConnection(client_id, connection);
      
      if (game_id) {
        session.game_id = game_id;
      }

      const payload = PayloadBuilder.connect(client_id, session.game_id);
      connection.send(JSON.stringify(payload));
    } else {
      const payload = PayloadBuilder.error("resume", "Session not found, please start a new_connection");
      connection.send(JSON.stringify(payload));
    }
  }
}

module.exports = ConnectionHandler;
