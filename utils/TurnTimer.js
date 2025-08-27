class TurnTimer {
    constructor(initial_time, starting_side, on_timeout_call_back) {
        this.defender_time = initial_time
        this.attacker_time = initial_time
        this.active_side = starting_side
        this.is_running = null;
        this.lastUpdate = Date.now()

        this.onTimeout = on_timeout_call_back
    }

    start() {
        if (this.is_running) return;

        try {
            this.is_running = true;
            this.lastUpdate = Date.now();

            this.interval = setInterval(() => {
                const now = Date.now()
                const elapsed = now - this.lastUpdate;

                if (this.active_side == "attacker") {
                    this.attacker_time = Math.max(0, this.attacker_time - elapsed);
                } else {
                    this.defender_time = Math.max(0, this.defender_time - elapsed) 
                }

                this.lastUpdate = now;

                // Check for timeout
                if (this.defender_time == 0 || this.attacker_time == 0) {
                    this.stop()
                    this.onTimeout?.(
                        this.defender_time == 0 ? "defender_timeout" : "attacker_timeout",
                        this.defender_time == 0 ? "attacker" : "defender"
                    );
                }
            }, 100) //Update every 100ms
        } catch (error) {
            console.error("Timer start error:", error);
            this.is_running = false;
        }
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.is_running = false;
    }

    switchPlayer() {
        this.active_side = this.active_side == 'defender' ? 'attacker' : 'defender'
        this.lastUpdate = Date.now();
    }

    getTimes() {
        return {
            defender: this.defender_time,
            attacker: this.attacker_time,
            active_side: this.active_side
        };
    }
}

module.exports = TurnTimer;
