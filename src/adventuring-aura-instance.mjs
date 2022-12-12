const { loadModule } = mod.getContext(import.meta);

const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');
const { AdventuringBuff } = await loadModule('src/adventuring-buff.mjs');
const { AdventuringDebuff } = await loadModule('src/adventuring-debuff.mjs');

const { AdventuringAuraInstanceUIComponent } = await loadModule('src/components/adventuring-aura-instance.mjs');

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

        this.component = new AdventuringAuraInstanceUIComponent(this.manager, this.game, this);

        this.renderQueue = new AdventuringAuraInstanceRenderQueue();
    }

    get tooltip() {
        let html = '<div>';
        if(this.base !== undefined) {
            html += `<div><span>${this.base.name}</span></div>`;
            html += `<div>${this.base.getDescription(this)}</div>`;
        }
        html += '</div>'
        return html;
    }

    setAura(aura, stacks=1, amount=1) {
        this.base = aura;
        this.stacks = stacks;
        this.amount = amount;
        
        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
    }

    set(stacks, amount) {
        this.stacks = stacks;
        this.amount = amount;
        
        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
    }

    remove() {
        this.stacks = 0;

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
    }

    remove_stacks(count) {
        this.stacks = Math.max(this.stacks - count, 0);

        this.auras.buildEffects();
        this.renderQueue.icon = true;
        this.renderQueue.stacks = true;
        this.renderQueue.tooltip = true;
        this.auras.renderQueue.auras = true;
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
            this.component.tooltip.hide();
            this.component.hide();
        } else {
            this.component.show();
            this.component.icon.src = this.base.media;
            this.component.border.classList.toggle('border-info', this.base instanceof AdventuringBuff);
            this.component.border.classList.toggle('border-danger', this.base instanceof AdventuringDebuff);
        }

        this.renderQueue.icon = false;
    }

    renderTooltip() {
        if(!this.renderQueue.tooltip)
            return;

        this.component.tooltip.setContent(this.tooltip);

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
        this.base = reader.getNamespacedObject(this.manager.auras);
        this.stacks = reader.getUint32();
        let sourceIdx = reader.getUint8();
        this.source = this.manager.encounter.all[sourceIdx];
    }
}