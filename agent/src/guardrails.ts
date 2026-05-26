export class Guardrails {
    private maxSpendGoat: number;
    private totalSpentThisSession: number = 0;

    constructor(maxSpendGoat: number) {
        this.maxSpendGoat = maxSpendGoat;
    }

    setLimit(goat: number): void {
        this.maxSpendGoat = goat;
    }

    getLimit(): number {
        return this.maxSpendGoat;
    }

    getSpent(): number {
        return this.totalSpentThisSession;
    }

    checkAndRecord(amountGoat: number): void {
        if (amountGoat > this.maxSpendGoat) {
            throw new Error(
                `BLOCKED: Payment of ${amountGoat.toFixed(6)} GOAT exceeds spending limit of ${this.maxSpendGoat.toFixed(6)} GOAT.\nUse /setlimit <amount> to adjust.`
            );
        }
        this.totalSpentThisSession += amountGoat;
    }
}
