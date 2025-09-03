const db = require('mysql2')
const { appDbConfig } = require('../config/database_config')

//This connection can access anything BUT user_login_info
class AppDatabase {
    constructor() {
        this.pool = db.createPool(appDbConfig).promise()
    }

    async findUsernameAndRating(player_id) {
        const [rows] = await this.pool.query(`
            SELECT username, current_rating
            FROM user_profiles
            WHERE player_id = ?
            `, [player_id])
        return rows[0]
    }
}

module.exports = new AppDatabase()
