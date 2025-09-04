class InputValidator {
  static validateGameId(gameId) {
    return typeof gameId === 'string' && 
           /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(gameId);
  }
  
  static validateClientId(clientId) {
    return typeof clientId === 'string' && 
           /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(clientId);
  }
  
  static validateRole(role) {
    return role === 'attacker' || role === 'defender';
  }
  

  //Not in use yet but will come in handy later
  static validateBoardState(board) {
    return Array.isArray(board) && 
           board.length > 0 && 
           board.every(row => Array.isArray(row));
  }
  
  static validateMoveCoordinates(coords) {
    return Array.isArray(coords) && 
           coords.length === 2 && 
           coords.every(coord => Number.isInteger(coord) && coord >= 0);
  }
}

module.exports = InputValidator;
