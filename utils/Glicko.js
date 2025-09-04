const { Glicko2 } = require("glicko2");
class GlickoCalculator {
    constructor() {
        this.ranking = new Glicko2()
    }

    calculatePostGameRatings(loser_ratings, winner_ratings) {
        const { loser_rating, loser_rd, loser_volatility } = loser_ratings
        const { winner_rating, winner_rd, winner_volatility } = winner_ratings
        const loser = this.ranking.makePlayer(loser_rating, loser_rd, loser_volatility)
        const winner = this.ranking.makePlayer(winner_rating, winner_rd, winner_volatility)
        this.ranking.updateRatings([[winner,loser, 1]])

        //Package the new ratings
        const new_loser_ratings = {
            rating: loser.getRating(),
            rating_deviation: loser.getRd(),
            rating_volatility: loser.getVol()
        } 

        const new_winner_ratings = {
            rating: winner.getRating(),
            rating_deviation: winner.getRd(),
            rating_volatility: winner.getVol()
        }

        return { loser: new_loser_ratings, winner: new_winner_ratings }
    }
}

module.exports = new GlickoCalculator()

