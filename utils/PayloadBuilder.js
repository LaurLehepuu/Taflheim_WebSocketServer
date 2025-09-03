
/* A class to quickly construct payloads */
class PayloadBuilder {
    static connect(clientId, gameId = null) {
        return {
            method: "connect",
            client_id: clientId,
            game_id: gameId
        };
    }

    static error(error_type, message, details = null) {
        const payload = {
            method: "error",
            error_type,
            message,
            timestamp: new Date().toISOString()
        };

        if (details) {
            payload.details = details;
        }

        return payload;
    }

    static create(game) {
        return {
            method: "create",
            game
        };
    }

    static currentGameState(opponent_username, opponent_rating, game_state) {
        return {
            method: "current_game_state",
            opponent_username,
            opponent_rating,
            game_state 
        }
    }

    static join(new_client_name, new_client_rating, game) {
        return {
            method: "join",
            new_client: new_client_name,
            new_client_rating,
            game
        };
    }


    static ready(client_id, game_id) {
        return {
            method: "ready",
            client_id,
            game_id
        };
    }

    static start(game, timers) {
        let attacker_id;
        let defender_id; 
        //Find attacker and defender clients
        game.clients.forEach(clientObj => {
            if (clientObj.role == "attacker"){
                attacker_id = clientObj.id
            }
            else if (clientObj.role == "defender"){
                defender_id = clientObj.id
            }
        });

        return {
            method: "start",
            attacker: attacker_id,
            defender: defender_id,
            starting_turn: game.current_turn,
            timers
        };
    }

    static move(move_from, move_to, timers) {
        return {
            method: "move",
            move_from,
            move_to,
            timers
        };
    }

    static taken(gameId, coordinates) {
        return {
            method: "taken",
            game_id: gameId,
            taken_piece_coordinates: coordinates
        };
    }

    static win(gameId, reason, winner) {
        return {
            method: "win",
            game_id: gameId,
            win_reason: reason,
            winner: winner
        };
    }
}

module.exports = PayloadBuilder;
