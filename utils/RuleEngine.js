//Rule engine functions to double check client made moves

//Imports
const {find_king, flood_fill, sign, remove_piece} = require("./HelperFunctions")

//Active Rules
var active_rules = {
  "cant_move_over": true,
  "sandwich": true,
  "shieldwall": true,
  "armed_king": true,
  "defenders_surrounded_win_con": true,
  "king_surrounded_win_con": true,
  "king_corner_retreat": true,
  "edge_fort_escape": true,
  "end_on_repetition": false,
  "take_against_restricted_squares": true
}

var game_over_reason;
var winner;
var taken_piece_coordinates;


//#region MOVEMENT RULES
function is_move_valid(game_state, move_from, move_to) {
  const validators = [
    validate_target_square_is_empty,
    validate_straight_line,
    validate_cant_move_over,
    validate_restricted_squares
  ]
  return validators.every(validator => 
    validator(game_state, move_from, move_to)
  );
}

function validate_target_square_is_empty(game_state, _move_from, move_to) {
  const targetSquare = game_state[move_to[1]][move_to[0]]
  if (targetSquare != ' ') {
    return false
  }
  return true
}

//Checks if movement is happening in a straight line
function validate_straight_line(_game_state, move_from, move_to) {
  
  // Check if path is a straight line
  if (move_from[0] != move_to[0] && move_from[1] != move_to[1]) {
    return false
  }
  return true
}

// Validates that a piece is not moving over another piece
function validate_cant_move_over(game_state, move_from, move_to) {
  if (!active_rules.cant_move_over) {
    return true
  }
  
  // Calculate direction
  var dx = sign(move_to[0] - move_from[0])
  var dy = sign(move_to[1] - move_from[1])
  
  // Start from the square after the starting position
  var current_x = move_from[0] + dx
  var current_y = move_from[1] + dy
  
  // Check each square in the path until we reach the destination (excluding destination)
  while (current_x != move_to[0] || current_y != move_to[1]) {
    // Check bounds to prevent array access errors
    if (current_y < 0 || current_y >= game_state.length || 
        current_x < 0 || current_x >= game_state[0].length) {
      return false
    }
    
    if (game_state[current_y][current_x] != ' ') {
      return false
    }
    
    // Move to the next square in the path
    current_x += dx
    current_y += dy
  }
  return true
}

// Checks if move attempt is to a restricted square
function validate_restricted_squares(game_state, move_from, move_to) {
  if (game_state[move_from[1]][move_from[0]] == "k")
    return true //King can move anywhere

  //if (move_to.restricted_squares)
    //return false

  return true
}
//#endregion



//#region WIN CONDITIONS
function has_win_occurred(game_state) {
  const win_conditions = [
    king_corner_retreat,
    king_surrounded,
    edge_fort_escape,
    defenders_surrounded,
    repetition_check,
  ]
  return win_conditions.some(win_con => 
    win_con(game_state)
  );
}

function king_corner_retreat(game_state) {
  
  var corner_squares = [
    [0, 0],
    [game_state.length - 1, game_state.length - 1],
    [game_state.length - 1, 0],
    [0, game_state.length - 1]
  ];
  
  return corner_squares.some(corner => {
    let row = corner[0];
    let col = corner[1];
    
    if (row >= 0 && row < game_state.length && 
        col >= 0 && col < game_state[row].length) {
      
      var square = game_state[row][col];
      
      if (square.includes("k")) {
        game_over_reason = "king_corner_retreat";
        winner = "Defender"
        return true;
      }

      else 
        null;
    }
    return false;
  });
}

function king_surrounded(game_state) {
  if (!active_rules["king_surrounded_win_con"]) {
    return false;
  }

  // Get king position
  var king_pos = find_king(game_state);
  
  // Check if king exists
  if (!king_pos) {
    return false; // No king found
  }
  
  var king_surroundings = [
    [king_pos[0], king_pos[1] + 1], // Right
    [king_pos[0], king_pos[1] - 1], // Left  
    [king_pos[0] + 1, king_pos[1]], // Down
    [king_pos[0] - 1, king_pos[1]]  // Up
  ];
  
  // Check each surrounding position
  for (let i = 0; i < king_surroundings.length; i++) {
    let coordinate = king_surroundings[i];
    let row = coordinate[0];
    let col = coordinate[1];
    
    // Bounds checking
    if (row < 0 || row >= game_state.length || 
        col < 0 || col >= game_state[row].length) {
      return false; // Out of bounds means not surrounded
    }
    
    // Check if the square is valid and contains an attacker
    let square = game_state[row][col];
    if (!square.includes('a')) {
      return false; // If there isn't an attacker, not surrounded
    }
  }
  game_over_reason = "king_surrounded";
  winner = "Attacker"
  return true;
}

function edge_fort_escape(game_state) {
  if (!active_rules["edge_fort_escape"]) {
    return false;
  }

  const board_size = game_state.length;
  const king_position = find_king(game_state); // [row, col]
  if (!king_position) return false;

  const [king_y, king_x] = king_position;

  // Check if king is on edge
  if (!(king_y === 0 || king_y === board_size - 1 ||
        king_x === 0 || king_x === board_size - 1)) {
    // Not on edge
    return false;
  }

  // Prepare possible moves (adjacent squares)
  const possible_moves = [
    [king_y + 1, king_x],
    [king_y - 1, king_x],
    [king_y, king_x + 1],
    [king_y, king_x - 1],
  ];

  // Flood fill to find the region containing the king, blocking on defenders
  const visited_squares = new Set();

  // Block on defenders
  flood_fill(king_y, king_x, visited_squares, game_state, "d");

  // Check if any attackers are in the flooded area
  for (const coord_key of visited_squares) {
    const [y, x] = coord_key.split(',').map(Number);
    const square_array = game_state[y][x];

    if (square_array.length > 0 && square_array[0] === "a") {
      console.log("attackers in the flooded area")
      return false;
    }
  }

  // Check if king has at least one empty adjacent square to move to
  let has_empty_square = false;
  for (const move of possible_moves) {
    const [y, x] = move;

    // Out of bounds check
    if (y < 0 || y >= game_state.length ||
        x < 0 || x >= game_state.length) {
      continue;
    }

    if (game_state[y][x] == ' ') {
      has_empty_square = true;
      break;
    }
  }

  if (has_empty_square) {
    game_over_reason = "edge_fort_escape";
    winner = "Defender"
    return true;
  } else {
    return false;
  }
}

function defenders_surrounded(game_state) {
  if (active_rules["defenders_surrounded_win_con"] == false) {
    return false;
  }

  const visited_squares = new Set();
  const board_size = game_state.length;

  // Flood fill from all edges
  for (let i = 0; i < board_size; i++) {
    flood_fill(0, i, visited_squares, game_state);
    flood_fill(i, 0, visited_squares, game_state);
    flood_fill(board_size - 1, i, visited_squares, game_state);
    flood_fill(i, board_size - 1, visited_squares, game_state);
  }

  // Check if any defender is in the visited squares
  for (const coord_key of visited_squares) {
    const [x, y] = coord_key.split(',').map(Number);
    const square_array = game_state[y][x];

    if (square_array[0] == "d") {
      return false;
    }
  }

  game_over_reason = "defenders_surrounded";
  winner = "Attacker"
  return true;
}

function repetition_check(game_state_history) {
  if (!active_rules["end_on_repetition"]) {
    return false;
  }

}
//#endregion

//#region TAKING RULES
//Go through all taking rules
function has_taking_occurred(game_state, aggressor_square) {
  taken_piece_coordinates = [];

  const checks = [
    sandwich_check,
    shieldwall_check,
  ]

  for (const check of checks) {
    check(game_state, aggressor_square);
  }
}

// Check for sandwich captures
function sandwich_check(game_state, aggressor_square) {
  if (!active_rules.sandwich) return;

  const [aggressor_x, aggressor_y] = aggressor_square;
  const aggressor_array = game_state[aggressor_y][aggressor_x];

  if (!aggressor_array.length) return;
  const aggressor = aggressor_array[0];

  const potential_victim_squares = [
    [aggressor_y + 1, aggressor_x], // Below
    [aggressor_y - 1, aggressor_x], // Above
    [aggressor_y, aggressor_x + 1], // Right
    [aggressor_y, aggressor_x - 1], // Left
  ];

  const restricted_squares = [
    [5, 5], [0, 0], [10, 0], [0, 10], [10, 10]
  ];

  const board_size = game_state.length;

  for (const square of potential_victim_squares) {
    const [victim_y, victim_x] = square;

    // Victim bounds check
    if (
      victim_y < 0 || victim_y >= board_size ||
      victim_x < 0 || victim_x >= board_size
    ) continue;

    const victim = game_state[victim_y][victim_x];

    // Skip empty squares
    if (victim === ' ' || victim.length === 0) continue;

    // Only check captures against opposing pieces
    if (aggressor === victim) continue;

    // Find the direction from aggressor to victim
    const dx = victim_x - aggressor_x;
    const dy = victim_y - aggressor_y;

    // Calculate helping aggressor position (opposite side of victim from aggressor)
    const helping_aggressor_pos = [victim_y + dy, victim_x + dx];

    // Helping_aggressor bounds check
    if (
      helping_aggressor_pos[0] < 0 || helping_aggressor_pos[0] >= board_size ||
      helping_aggressor_pos[1] < 0 || helping_aggressor_pos[1] >= board_size
    ) continue;

    const helping_aggressor = game_state[helping_aggressor_pos[0]][helping_aggressor_pos[1]];

      // Check if it's the same type as the aggressor (sandwich complete)
      if (aggressor === helping_aggressor) {
        // Prevent king captures
        if (victim === "k") return;

        // Regular piece capture
        console.log("Piece captured at:", [victim_y, victim_x]);
        game_state[victim_y][victim_x] = ' ';
        taken_piece_coordinates.push([victim_y, victim_x]);
      }

      // Check if armed king is active
      if (!active_rules.armed_king) continue;

      // Armed king capture rules
      if (aggressor === "d" && helping_aggressor === "k" && victim === "a") {
        console.log("Armed king Piece capture at:", [victim_y, victim_x]);
        game_state[victim_y][victim_x] = ' ';
        taken_piece_coordinates.push([victim_y, victim_x]);

      } else {
      // Check if take_against_restricted_squares rule is active
      if (!active_rules.take_against_restricted_squares) continue;
      if (restricted_squares.some(([ry, rx]) => ry === helping_aggressor_pos[0] && rx === helping_aggressor_pos[1])) {
        // Prevent king from capturing defenders against restricted squares
        if (aggressor === "k" && victim === "d") {
          continue;
        }
        if (victim !== "k") {
          console.log("Piece captured against restricted square at:", [victim_y, victim_x]);
          game_state[victim_y][victim_x] = ' ';
          taken_piece_coordinates.push([victim_y, victim_x]);
        }
      }
    }
  }
}
//#region Shieldwall Captures
// Check for shieldwall captures
function shieldwall_check(game_state, aggressor_square) {
  if (!active_rules.shieldwall) return;
  
  const board_size = game_state.length;
  const [aggressor_x, aggressor_y] = aggressor_square;
  const aggressor_array = game_state[aggressor_y][aggressor_x];
  if (!aggressor_array.length) return;
  const aggressor = aggressor_array[0];
  
  // Check all four edges of the board
  const edges = [
    { edge: 'top', row: 0, isHorizontal: true },
    { edge: 'bottom', row: board_size - 1, isHorizontal: true },
    { edge: 'left', col: 0, isHorizontal: false },
    { edge: 'right', col: board_size - 1, isHorizontal: false }
  ];
  
  for (const edgeInfo of edges) {
    checkShieldwallOnEdge(game_state, aggressor, edgeInfo, board_size, [aggressor_y, aggressor_x]);
  }
}

function checkShieldwallOnEdge(game_state, aggressor, edgeInfo, board_size, aggressorPos) {
  const { edge, row, col, isHorizontal } = edgeInfo;
  
  // Get all positions along the edge
  const edgePositions = [];
  if (isHorizontal) {
    for (let x = 0; x < board_size; x++) {
      edgePositions.push([row, x]);
    }
  } else {
    for (let y = 0; y < board_size; y++) {
      edgePositions.push([y, col]);
    }
  }
  
  // Find continuous groups of pieces along the edge
  const groups = findContinuousGroups(game_state, edgePositions);
  
  // Check each group for shieldwall capture
  for (const group of groups) {
    if (group.length < 2) continue; // Need at least 2 pieces for shieldwall
    
    const pieceType = game_state[group[0][0]][group[0][1]][0];
    if (pieceType === aggressor) continue; // Can't capture own pieces
    
    // Check if this group can be captured by shieldwall
    if (canCaptureShieldwall(game_state, group, aggressor, edge, board_size, aggressorPos)) {
      captureShieldwallGroup(game_state, group, pieceType);
    }
  }
}

function findContinuousGroups(game_state, positions) {
  const groups = [];
  let currentGroup = [];
  let lastPieceType = null;

  for (const [y, x] of positions) {
    const square = game_state[y][x];

    if (square.length > 0) {
      const pieceType = square[0];

      // Treat king and defender as the same group for shieldwall
      if (
        (pieceType === "d" || pieceType === "k") &&
        (lastPieceType === "d" || lastPieceType === "k" || lastPieceType === null)
      ) {
        currentGroup.push([y, x]);
        lastPieceType = pieceType;
      } else if (pieceType === lastPieceType && currentGroup.length > 0) {
        currentGroup.push([y, x]);
      } else {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [[y, x]];
        lastPieceType = pieceType;
      }
    } else {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
        lastPieceType = null;
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

function canCaptureShieldwall(game_state, group, aggressor, edge, board_size, aggressorPos) {
  // Check if every piece in the group has an enemy piece directly in front of it
  for (const [y, x] of group) {
    if (!hasEnemyInFront(game_state, [y, x], aggressor, edge, board_size)) {
      return false;
    }
  }
  
  // Check if both ends of the group are properly bracketed
  const firstPos = group[0];
  const lastPos = group[group.length - 1];
  
  const firstBracketPos = getBracketPosition(firstPos, edge, 'start');
  const lastBracketPos = getBracketPosition(lastPos, edge, 'end');
  
  const firstBracketed = isBracketed(game_state, firstPos, aggressor, edge, board_size, 'start');
  const lastBracketed = isBracketed(game_state, lastPos, aggressor, edge, board_size, 'end');
  
  // The capture only occurs if the last move was a bracketing move
  const [aggressorY, aggressorX] = aggressorPos;
  const isAggressorBracketing = (
    (firstBracketPos && firstBracketPos[0] === aggressorY && firstBracketPos[1] === aggressorX) ||
    (lastBracketPos && lastBracketPos[0] === aggressorY && lastBracketPos[1] === aggressorX)
  );
  console.log("coordinates:", aggressorPos);
  console.log("firstBracketPos:", firstBracketPos, "lastBracketPos:", lastBracketPos);
  console.log("isAggressorBracketing:", isAggressorBracketing);
  console.log("firstBracketed:", firstBracketed, "lastBracketed:", lastBracketed);
  return firstBracketed && lastBracketed && isAggressorBracketing;
}

function hasEnemyInFront(game_state, position, aggressor, edge, board_size) {
  const [y, x] = position;
  let frontY, frontX;

  // Calculate the position "in front" based on which edge we're on
  switch (edge) {
    case 'top':
      frontY = y + 1;
      frontX = x;
      break;
    case 'bottom':
      frontY = y - 1;
      frontX = x;
      break;
    case 'left':
      frontY = y;
      frontX = x + 1;
      break;
    case 'right':
      frontY = y;
      frontX = x - 1;
      break;
  }

  // Check bounds
  if (frontY < 0 || frontY >= board_size || frontX < 0 || frontX >= board_size) {
    return false;
  }

  const frontSquare = game_state[frontY][frontX];

  // If aggressor is a defender, king also counts as "enemy in front"
  if (aggressor === "d" || aggressor === "k") {
    return frontSquare.length > 0 && (frontSquare[0] === "d" || frontSquare[0] === "k");
  }

  // Otherwise, only exact match
  return frontSquare.length > 0 && frontSquare[0] === aggressor;
}

function getBracketPosition(position, edge, endType) {
  const [y, x] = position;
  let bracketY, bracketX;
  
  // Calculate the bracketing position based on edge and end type
  switch (edge) {
    case 'top':
    case 'bottom':
      if (endType === 'start') {
        bracketY = y;
        bracketX = x - 1;
      } else {
        bracketY = y;
        bracketX = x + 1;
      }
      break;
    case 'left':
    case 'right':
      if (endType === 'start') {
        bracketY = y - 1;
        bracketX = x;
      } else {
        bracketY = y + 1;
        bracketX = x;
      }
      break;
  }
  
  return [bracketY, bracketX];
}

function isBracketed(game_state, position, aggressor, edge, board_size, endType) {
  const [bracketY, bracketX] = getBracketPosition(position, edge, endType);
  
  // Check if it's a corner square (corners can act as bracketing pieces)
  const corners = [[0, 0], [0, board_size - 1], [board_size - 1, 0], [board_size - 1, board_size - 1]];
  const isCorner = corners.some(([cy, cx]) => cy === bracketY && cx === bracketX);
  
  if (isCorner) {
    return true; // Corner squares can bracket
  }
  
  // Check bounds
  if (bracketY < 0 || bracketY >= board_size || bracketX < 0 || bracketX >= board_size) {
    return false;
  }
  
  const bracketSquare = game_state[bracketY][bracketX];
  if (aggressor === "d" || aggressor === "k") {
    // Defender or king can bracket
    return bracketSquare.length > 0 && (bracketSquare[0] === "d" || bracketSquare[0] === "k");
  } else {
    // Only exact match can bracket
    return bracketSquare.length > 0 && bracketSquare[0] === aggressor;
  }
}

function captureShieldwallGroup(game_state, group, pieceType) {
  // Special handling for king in shieldwall
  let capturedPieces = [];
  
  for (const [y, x] of group) {
    const piece = game_state[y][x][0];
    if (piece === 'k') {
      console.log("King in shieldwall - king not captured at:", [y, x]);
      continue; // Don't capture the king
    }
    // Capture attackers or defenders as needed
    if (piece === 'a' || piece === 'd') {
      console.log("Shieldwall piece captured at:", [y, x]);
      game_state[y][x] = ' ';
      taken_piece_coordinates.push([y, x]);
      capturedPieces.push[y,x];
    }
}
  
  if (capturedPieces.length > 0) {
    console.log("Shieldwall capture completed - captured", capturedPieces.length, "pieces");
  }
}
//#endregion
//#endregion

module.exports = {
  is_move_valid,
  has_win_occurred,
  has_taking_occurred,
  get winner() { return winner },
  get game_over_reason() { return game_over_reason; },
  get taken_piece_coordinates() { return taken_piece_coordinates; },
}
