const db = require('mysql2')
const { appDbConfig } = require('../config/database_config')
const { logger } = require('../config/winston_config')

//This connection can access anything BUT user_login_info
class AppDatabase {
    constructor() {
        this.pool = db.createPool(appDbConfig).promise()
    }

    async findUsername(player_id) {
        const [username] = await this.pool.query(`
            SELECT username
            FROM user_profiles
            WHERE player_id = ?
            `, [player_id])
            return username[0]
        }

    async findUserId(player_id) {
        //Find user_id
        const [user_id] = await this.pool.query(`
            SELECT user_id
            FROM user_profiles
            WHERE player_id = ?
            `, [player_id])
            return user_id[0].user_id
    }

    async findRatingInfo(player_id) {
        const user_id = await this.findUserId(player_id)
        const [rating_info] = await this.pool.query(`
            SELECT rating, rating_volatility, rating_deviation
            FROM user_ratings
            WHERE user_id = ?
            `, [user_id])
        return rating_info[0]
        }
    
    async updateRatingInfo(new_ratings, loser_player_id, winner_player_id){
        const winner_user_id = await this.findUserId(winner_player_id)
        const loser_user_id = await this.findUserId(loser_player_id)

        const {loser, winner} = new_ratings
        logger.info(loser.rating, loser.rating_deviation, loser.rating_volatility)
        const update_query =`
            UPDATE user_ratings
            SET rating = ?, rating_deviation = ?, rating_volatility = ?
            WHERE user_id = ?
            `

        //Update winner rating info
        await this.pool.query(update_query,
            [parseFloat(winner.rating), parseFloat(winner.rating_deviation), parseFloat(winner.rating_volatility), winner_user_id])

        //Update loser rating info
        await this.pool.query(update_query, 
            [loser.rating, loser.rating_deviation, loser.rating_volatility, loser_user_id])
    }
}

module.exports = new AppDatabase()
