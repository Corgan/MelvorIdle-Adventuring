const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/core/adventuring-stats.mjs');
const { TooltipBuilder } = await loadModule('src/ui/adventuring-tooltip.mjs');
const { formatTrigger } = await loadModule('src/core/adventuring-utils.mjs');

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

        this.component = createElement('adventuring-aura-instance');
        this.component.auraInstance = this;

        this.renderQueue = new AdventuringAuraInstanceRenderQueue();
    }

    get tooltip() {
        try {
            if(this.base !== undefined && typeof this.base !== 'string' && this.base.name) {
                const tooltip = TooltipBuilder.create()
                    .header(this.base.name, this.base.media);
                
                // Show aura type (buff/debuff)
                const isBuff = this.base.isBuff ?? false;
                const typeText = isBuff ? 'Buff' : 'Debuff';
                tooltip.subheader(typeText);
                
                // Show description with resolved values
                const desc = this.base.getDescription(this);
                if(desc) {
                    tooltip.separator().info(desc);
                }
                
                // Show trigger information
                const triggers = this.getUniqueTriggers();
                if(triggers.length > 0) {
                    tooltip.separator().hint('Triggers:');
                    triggers.forEach(trigger => {
                        tooltip.hint(`• ${formatTrigger(trigger)}`);
                    });
                }
                
                // Show stacks and amount
                tooltip.separator();
                if(this.stacks > 1) {
                    tooltip.hint(`Stacks: ${this.stacks}`);
                }
                if(this.amount && this.amount > 1) {
                    tooltip.hint(`Amount: ${this.amount}`);
                }
                
                return tooltip.build();
            } else {
                console.warn('[Aura Tooltip] Invalid base:', {
                    base: this.base,
                    baseType: typeof this.base,
                    stacks: this.stacks,
                    amount: this.amount,
                    source: this.source?.name || this.source
                });
            }
        } catch(e) {
            console.warn('[Aura Tooltip] Error rendering:', e, {
                base: this.base,
                baseName: this.base?.name,
                stacks: this.stacks,
                amount: this.amount
            });
        }
        return '<div>Unknown Aura</div>';
    }

    /**
     * Get unique triggers from all effects
     */
    getUniqueTriggers() {
        if(!this.base || !this.base.effects) return [];
        const triggers = new Set();
        this.base.effects.forEach(effect => {
            if(effect.trigger && effect.type !== 'remove' && effect.type !== 'remove_stacks') {
                triggers.add(effect.trigger);
            }
        });
        return Array.from(triggers);
    }

    setAura(aura, stacks=1, amount=1) {
        this.base = aura;
        this.stacks = stacks;
        // Use the aura's base amount if no amount is provided or amount is 0
        // This ensures buffs like Regen use their base healing amount (e.g., 5)
        // even when applied by passives that only specify stacks
        this.amount = amount > 0 ? amount : (aura.amount !== undefined ? aura.amount : 1);
        
        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
        
        // Invalidate effect cache
        this.auras.character?.invalidateEffects?.('auras');
    }

    set(stacks, amount) {
        this.stacks = stacks;
        this.amount = amount;
        
        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
        
        // Invalidate effect cache
        this.auras.character?.invalidateEffects?.('auras');
    }

    remove() {
        this.stacks = 0;

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
        
        // Invalidate effect cache
        this.auras.character?.invalidateEffects?.('auras');
    }

    remove_stacks(count) {
        this.stacks = Math.max(this.stacks - count, 0);

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
        
        // Invalidate effect cache
        this.auras.character?.invalidateEffects?.('auras');
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
            this.component.border.classList.toggle('border-info', this.base.isBuff ?? false);
            this.component.border.classList.toggle('border-danger', this.base.isDebuff ?? false);
        }

        this.renderQueue.icon = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        if(this.component.tooltip === undefined)
            return;

        const tooltipContent = this.tooltip;
        this.component.tooltip.setContent(tooltipContent);

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
        writer.writeUint8(this.manager.encounter.all.indexOf(this.source))
        return writer;
    }

    decode(reader, version) {
        const base = reader.getNamespacedObject(this.manager.auras);
        // Only set base if it was successfully found (not a string/error)
        if(typeof base !== 'string') {
            this.base = base;
        }
        this.stacks = reader.getUint32();
        let sourceIdx = reader.getUint8();
        this.source = this.manager.encounter.all[sourceIdx];
    }
}