
/* This file contains helper functions used in the rule engine */

// Function to find the king's position in the game state
function find_king(game_state) {
  for (let i = 0; i < game_state.length; i++) {
    for (let j = 0; j < game_state[i].length; j++) {
      if (game_state[i][j].includes('k')) {
        return [i, j]; // returns [row, column]
      }
    }
  }
  return null; // element not found
}

// Function to perform a flood fill algorithm on the game state -> void
function flood_fill(y, x, visited_squares, game_state, check_against = "a") {
  const board_size = game_state.length;

  // Out of bounds check
  if (x < 0 || x >= board_size || y < 0 || y >= board_size) {
    return;
  }

  const coord_key = `${y},${x}`;

  // If already visited, quit
  if (visited_squares.has(coord_key)) {
    return;
  }

  const current_square = game_state[y][x];

  // If the square has the type of piece we're checking against, quit
  if (current_square[0] === check_against) {
    return;
  }

  // Mark as visited and check adjacent squares
  visited_squares.add(coord_key);
  flood_fill(y + 1, x, visited_squares, game_state, check_against);
  flood_fill(y - 1, x, visited_squares, game_state, check_against);
  flood_fill(y, x + 1, visited_squares, game_state, check_against);
  flood_fill(y, x - 1, visited_squares, game_state, check_against);
}

// Helper function for sign -> int
function sign(x) {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}


module.exports = {
  sign,
  find_king,
  flood_fill,
}
