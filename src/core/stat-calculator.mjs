/**
 * Utility class for stat calculations with flat and percent bonuses.
 */
export class StatCalculator {

    static calculate(baseValue, bonuses = { flat: 0, percent: 0 }, globalPercent = 0) {
        const flat = bonuses.flat || 0;
        const percent = bonuses.percent || 0;

        const withFlat = baseValue + flat;
        const withPercent = withFlat * (1 + percent / 100);
        const withGlobal = withPercent * (1 + globalPercent / 100);

        return Math.floor(withGlobal);
    }

    static aggregate(target, ...sources) {
        for (const source of sources) {
            if (!source) continue;

            if (typeof source.forEach === 'function') {
                source.forEach((value, stat) => {
                    target.set(stat, (target.get(stat) || 0) + value);
                });
            }
        }
    }

    static calculateWithScaling(target, base, scaling, level, bonusPercent = 0) {
        target.reset();

        base.forEach((value, stat) => target.set(stat, value));

        scaling.forEach((value, stat) => {
            target.set(stat, (target.get(stat) || 0) + Math.floor(level * value));
        });

        if (bonusPercent > 0) {
            target.forEach((value, stat) => {
                const bonus = Math.floor(value * bonusPercent / 100);
                target.set(stat, value + bonus);
            });
        }
    }

    static applyMultiplier(target, multiplier) {
        if (multiplier === 1) return;

        target.forEach((value, stat) => {
            target.set(stat, Math.floor(value * multiplier));
        });
    }
}
