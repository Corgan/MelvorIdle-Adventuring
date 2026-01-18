/**
 * Extensible effect processor with registered handlers.
 */
export class EffectProcessor {
    constructor() {
        this.handlers = new Map();
    }

    register(type, handler) {
        this.handlers.set(type, handler);
    }

    process(effect, context) {
        const handler = this.handlers.get(effect.type);
        if (handler) {
            return handler(effect, context);
        } else {
            console.warn(`[EffectProcessor] No handler for effect type: ${effect.type}`);
            return null;
        }
    }

    hasHandler(type) {
        return this.handlers.has(type);
    }

    unregister(type) {
        this.handlers.delete(type);
    }

    clear() {
        this.handlers.clear();
    }
}

/**
 * Creates a standard effect processor with common handlers.
 * @param {Object} manager - The manager instance
 * @returns {EffectProcessor}
 */
export function createStandardEffectProcessor(manager) {
    const processor = new EffectProcessor();

    processor.register('heal', (effect, context) => {
        const { character, encounter, source } = context;
        if (!character) return null;

        let amount = effect.amount || 0;

        if (effect.stat === 'missing_hp') {
            const missing = character.maxHitpoints - character.hitpoints;
            amount = Math.floor(missing * (effect.amount / 100));
        } else if (effect.stat === 'max_hp_percent') {
            amount = Math.floor(character.maxHitpoints * (effect.amount / 100));
        }

        character.heal(amount);

        return { type: 'heal', amount, target: character };
    });

    processor.register('damage', (effect, context) => {
        const { character, target, encounter, source } = context;
        if (!target) return null;

        const attacker = character;
        let amount = effect.amount || 0;

        if (effect.stat === 'attack_percent' && attacker) {
            const attackStat = attacker.getStat('attack');
            amount = Math.floor(attackStat * (effect.amount / 100));
        }

        if (target.takeDamage) {
            target.takeDamage(amount, attacker, encounter);
        }

        return { type: 'damage', amount, target };
    });

    processor.register('restore_energy', (effect, context) => {
        const { character } = context;
        if (!character) return null;

        const amount = effect.amount || 0;
        if (character.restoreEnergy) {
            character.restoreEnergy(amount);
        }

        return { type: 'restore_energy', amount };
    });

    processor.register('apply_buff', (effect, context) => {
        const { character, encounter } = context;
        if (!character || !character.auras) return null;

        const buff = manager.buffs?.getObjectByID(effect.id);
        if (!buff) {
            console.warn(`Unknown buff: ${effect.id}`);
            return null;
        }

        const stacks = effect.stacks || 1;
        const duration = effect.duration;

        character.auras.add(buff, { stacks, duration });

        return { type: 'apply_buff', buff, stacks };
    });

    processor.register('apply_debuff', (effect, context) => {
        const { target, encounter } = context;
        if (!target || !target.auras) return null;

        const debuff = manager.debuffs?.getObjectByID(effect.id);
        if (!debuff) {
            console.warn(`Unknown debuff: ${effect.id}`);
            return null;
        }

        const stacks = effect.stacks || 1;
        const duration = effect.duration;

        target.auras.add(debuff, { stacks, duration });

        return { type: 'apply_debuff', debuff, stacks };
    });

    processor.register('remove_buff', (effect, context) => {
        const { character } = context;
        if (!character || !character.auras) return null;

        const buff = manager.buffs?.getObjectByID(effect.id);
        if (buff) {
            character.auras.remove(buff);
        }

        return { type: 'remove_buff', buff };
    });

    processor.register('remove_debuff', (effect, context) => {
        const { target } = context;
        if (!target || !target.auras) return null;

        const debuff = manager.debuffs?.getObjectByID(effect.id);
        if (debuff) {
            target.auras.remove(debuff);
        }

        return { type: 'remove_debuff', debuff };
    });

    processor.register('stat_modifier', (effect, context) => {
        // Stat modifiers are typically handled through the stat system
        // This is a placeholder for direct application if needed
        return { type: 'stat_modifier', stat: effect.stat, amount: effect.amount };
    });

    processor.register('grant_material', (effect, context) => {
        const material = manager.materials?.getObjectByID(effect.id);
        if (!material) return null;

        const amount = effect.amount || 1;
        manager.stash?.addMaterial(material, amount);

        return { type: 'grant_material', material, amount };
    });

    processor.register('consume_material', (effect, context) => {
        const material = manager.materials?.getObjectByID(effect.id);
        if (!material) return null;

        const amount = effect.amount || 1;
        manager.stash?.removeMaterial(material, amount);

        return { type: 'consume_material', material, amount };
    });

    return processor;
}
