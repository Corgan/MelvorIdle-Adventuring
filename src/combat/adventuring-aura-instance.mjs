const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/stats/adventuring-stats.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { formatTrigger, defaultEffectProcessor } = await loadModule('src/core/utils/adventuring-utils.mjs');

const { AdventuringAuraInstanceElement } = await loadModule('src/combat/components/adventuring-aura-instance.mjs');

class AdventuringAuraInstanceRenderQueue {
    constructor() {
        this.icon = false;
        this.stacks = false;
        this.tooltip = false;
    }

    queueAll() {
        this.icon = true;
        this.stacks = true;
        this.tooltip = true;
    }
}

export class AdventuringAuraInstance {
    constructor(manager, game, auras, source) {
        this.manager = manager;
        this.game = game;
        this.auras = auras;
        this.source = source;
        this.stacks = 0;

        this.snapshotStats = null;

        this._component = null; // Lazy-created on first access

        this.renderQueue = new AdventuringAuraInstanceRenderQueue();
    }

    /** @returns {AdventuringAuraInstanceElement} Lazily created component */
    get component() {
        if (this._component === null) {
            this._component = createElement('adventuring-aura-instance');
            this._component.auraInstance = this;
        }
        return this._component;
    }

    captureSnapshot(character) {
        if (!character || !character.stats) {
            this.snapshotStats = null;
            return;
        }

        this.snapshotStats = new Map();
        character.stats.forEach((value, key) => {
            this.snapshotStats.set(key, value);
        });
    }

    needsSnapshot() {
        if (!this.base || !this.base.effects) return false;
        return this.base.effects.some(effect => effect.scaleFrom === 'snapshot');
    }

    get tooltip() {
        try {
            if(this.base !== undefined && typeof this.base !== 'string' && this.base.name) {
                const tooltip = TooltipBuilder.create()
                    .header(this.base.name, this.base.media);

                const isBuff = this.base.isBuff !== undefined ? this.base.isBuff : false;
                const typeText = isBuff ? 'Buff' : 'Debuff';
                tooltip.subheader(typeText);

                const desc = this.base.getDescription(this);
                if(desc) {
                    tooltip.separator().info(desc);
                }

                tooltip.separator();
                if(this.stacks > 1) {
                    tooltip.hint(`Stacks: ${this.stacks}`);
                }
                if(this.age > 0) {
                    tooltip.hint(`Age: ${this.age}`);
                }

                return tooltip.build();
            } else {
                console.warn('[Aura Tooltip] Invalid base:', {
                    base: this.base,
                    baseType: typeof this.base,
                    stacks: this.stacks,
                    amount: this.amount,
                    source: this.source !== undefined ? this.source.name : this.source
                });
            }
        } catch(e) {
            console.warn('[Aura Tooltip] Error rendering:', e, {
                base: this.base,
                baseName: this.base !== undefined ? this.base.name : undefined,
                stacks: this.stacks,
                amount: this.amount
            });
        }
        return '<div>Unknown Aura</div>';
    }

    getUniqueTriggers() {
        if(!this.base || !this.base.effects) return [];

        const triggers = new Set();
        this.base.effects.forEach(effect => {
            if(effect.trigger && effect.describe !== false) {
                triggers.add(effect.trigger);
            }
        });
        return Array.from(triggers);
    }

    setAura(aura, stacks=1, snapshot=null) {
        this.base = aura;
        this.stacks = stacks;

        if (snapshot) {
            this.snapshotStats = snapshot;
        }

        if(aura.maxStacks !== undefined) {
            this.stacks = Math.min(this.stacks, aura.maxStacks);
        }

        this.age = 0;

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;

        if (this.auras.character !== undefined && this.auras.character.invalidateEffects !== undefined) {
            this.auras.character.invalidateEffects('auras');
        }
    }

    setStacks(stacks) {
        this.stacks = stacks;

        if(this.base !== undefined && this.base.maxStacks !== undefined) {
            this.stacks = Math.min(this.stacks, this.base.maxStacks);
        }

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;

        if (this.auras.character !== undefined && this.auras.character.invalidateEffects !== undefined) {
            this.auras.character.invalidateEffects('auras');
        }
    }

    remove() {
        this.stacks = 0;

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;

        if (this.auras.character !== undefined && this.auras.character.invalidateEffects !== undefined) {
            this.auras.character.invalidateEffects('auras');
        }
    }

    remove_stacks(count) {
        const previousStacks = this.stacks;
        this.stacks = Math.max(this.stacks - count, 0);

        if (previousStacks > 0 && this.stacks === 0 && this.auras.character) {

            const depletedEffects = this.base.effects.filter(e => e.trigger === 'stacks_depleted');
            if (depletedEffects.length > 0) {
                const ctx = {
                    character: this.auras.character,
                    manager: this.auras.character.manager,
                    extra: { source: this.source, aura: this.base }
                };
                for (const effect of depletedEffects) {
                    defaultEffectProcessor.processEffect(
                        effect,
                        effect.amount || 0,
                        effect.stacks || 1,
                        this.base?.name || 'Aura',
                        ctx
                    );
                }
            }
        }

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;

        if (this.auras.character !== undefined && this.auras.character.invalidateEffects !== undefined) {
            this.auras.character.invalidateEffects('auras');
        }
    }

    render() {
        this.renderIcon();
        this.renderTooltip();
        this.renderStacks();
    }

    renderIcon() {
        if(!this.renderQueue.icon)
            return;

        if(this.stacks === 0 || this.base === undefined) {
            if(this.component.tooltip !== undefined)
                this.component.tooltip.hide();
            this.component.classList.add('d-none');
        } else {
            this.component.classList.remove('d-none');
            this.component.icon.src = this.base.media;
            this.component.border.classList.toggle('border-info', this.base.isBuff !== undefined ? this.base.isBuff : false);
            this.component.border.classList.toggle('border-danger', this.base.isDebuff !== undefined ? this.base.isDebuff : false);
        }

        this.renderQueue.icon = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.setTooltipContent(this.tooltip);

        this.renderQueue.tooltip = false;
    }

    renderStacks() {
        if(!this.renderQueue.stacks)
            return;

        this.component.stacks.classList.toggle('d-none', this.stacks <= 1);
        this.component.stacks.textContent = this.stacks;

        this.renderQueue.stacks = false;
    }

    encode(writer) {
        writer.writeNamespacedObject(this.base);
        writer.writeUint32(this.stacks);
        writer.writeUint8(this.manager.encounter.all.indexOf(this.source));
        writer.writeUint16(this.age || 0);

        const hasSnapshot = this.snapshotStats !== null && this.snapshotStats.size > 0;
        writer.writeBoolean(hasSnapshot);
        if (hasSnapshot) {
            writer.writeUint16(this.snapshotStats.size);
            this.snapshotStats.forEach((value, stat) => {
                writer.writeNamespacedObject(stat);
                writer.writeFloat64(value);
            });
        }

        return writer;
    }

    decode(reader, version) {
        const base = reader.getNamespacedObject(this.manager.auras);

        if(typeof base !== 'string') {
            this.base = base;
        }
        this.stacks = reader.getUint32();
        let sourceIdx = reader.getUint8();
        this.source = this.manager.encounter.all[sourceIdx];
        this.age = reader.getUint16();

        const hasSnapshot = reader.getBoolean();
        if (hasSnapshot) {
            this.snapshotStats = new Map();
            const count = reader.getUint16();
            for (let i = 0; i < count; i++) {
                const stat = reader.getNamespacedObject(this.manager.stats);
                const value = reader.getFloat64();
                if (stat && typeof stat !== 'string') {
                    this.snapshotStats.set(stat, value);
                }
            }
        }
    }
}