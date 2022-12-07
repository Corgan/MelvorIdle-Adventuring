const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');
const { AdventuringStats } = await loadModule('src/adventuring-stats.mjs');

const { AdventuringEquipment } = await loadModule('src/adventuring-equipment.mjs');
const { AdventuringArmoryUIComponent } = await loadModule('src/components/adventuring-armory.mjs');
const { AdventuringMaterialUIComponent } = await loadModule('src/components/adventuring-material.mjs');

class AdventuringArmoryRenderQueue {
    constructor(){
        this.details = false;
    }
    updateAll() {
        this.details = true;
    }
}

export class AdventuringArmory extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.upgradeLevels = new Map();
        this.itemsBySlot = new Map();
        this.unlocked = new Map();

        this.component = new AdventuringArmoryUIComponent(this.manager, this.game, this);
        this.renderQueue = new AdventuringArmoryRenderQueue();

        this.base = new AdventuringStats(this.manager, this.game);
        this.base.component.mount(this.component.base);

        this.scaling = new AdventuringStats(this.manager, this.game);
        this.scaling.component.mount(this.component.scaling);

        this.materialComponents = [];

        this.component.upgradeButton.onclick = () => this.upgradeSelected();
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.details = true;
        this.checkUnlocked();
    }

    onShow() {
        this.manager.party.all.forEach(member => {
            member.setLocked(false);
            member.equipment.setLocked(false);
        });
    }

    onHide() {
        super.onHide();
        this.clearSelected();

        this.manager.party.all.forEach(member => {
            member.setLocked(true);
            member.equipment.setLocked(true);
        });
    }

    postDataRegistration() {
        this.manager.baseItems.forEach(baseItem => {
            if(baseItem.id !== "adventuring:none") {
                this.upgradeLevels.set(baseItem, 0);
                if(baseItem.slots !== undefined && baseItem.slots.length > 0) {
                    let slot = baseItem.slots[0];
                    let existingItems = this.itemsBySlot.get(slot);
                    if(existingItems === undefined)
                        existingItems = [];
                    existingItems.push(baseItem);
                    this.itemsBySlot.set(slot, existingItems);
                }
            }
        });

        this.itemsBySlot.forEach((baseItems, slot) => {
            this.component.items.appendChild(createElement('div', { className: 'p-1 w-100', text: slot.name }));
            baseItems.forEach(baseItem => {
                baseItem.component.mount(this.component.items);
            });
        });     

        //createElement('div', { className: 'w-100' })
    }

    checkUnlocked() {
        this.upgradeLevels.forEach((level, baseItem) => {
            let unlock = [...baseItem.materials.keys()].map((material) => this.manager.stash.unlocked.get(material) === true).reduce((acc, val) => acc && val, true);
            if(unlock) {
                this.unlock(baseItem);
                baseItem.renderQueue.updateAll();
            }
        });
    }

    unlock(item) {
        this.unlocked.set(item, true);
        item.renderQueue.updateAll();
        this.renderQueue.details = true;
    }

    upgradeSelected() {
        if(this.selectedItem !== undefined) {
            this.upgrade(this.selectedItem);
            this.updateSelectHighlight()
        }
    }

    upgrade(item) {
        if(item.upgradeable) {
            for(let material of item.materials.keys()) {
                this.manager.stash.remove(material, item.getCost(material));
            }
            this.upgradeLevels.set(item, this.upgradeLevels.get(item) + 1);
            item.renderQueue.updateAll();
        }
        this.renderQueue.details = true;
    }

    updateSelectHighlight() {
        this.manager.baseItems.forEach(item => {
            item.setSelected(item === this.selectedItem);
            item.setHighlight(false);
        });

        this.manager.party.all.forEach(character => {
            character.equipment.slots.forEach(slot => {
                slot.setSelected(slot.item === this.selectedItem);
                slot.setHighlight(slot.canEquip(this.selectedItem, slot));
            });
        });
        this.renderQueue.details = true;
    }

    selectItem(selectedItem) {
        if(this.selectedItem === selectedItem)
            return this.clearSelected();

        this.selectedItem = selectedItem;
        this.updateSelectHighlight();
    }

    clearSelected() {
        this.selectedItem = undefined;

        this.updateSelectHighlight();
    }

    render() {
        this.upgradeLevels.forEach((level, baseItem) => baseItem.render());
        this.renderDetails();
        this.base.render();
        this.scaling.render();
    }

    renderDetails() {
        if(!this.renderQueue.details)
            return;

        this.component.details.classList.toggle('invisible', this.selectedItem === undefined);

        if(this.selectedItem !== undefined) {
            this.component.icon.src = this.selectedItem.media;
            this.component.name.textContent = this.selectedItem.name;

            this.base.reset();
            this.selectedItem.base.forEach((value, stat) => {
                this.base.set(stat, value);
            });
            this.base.renderQueue.stats = true;

            this.scaling.reset();
            this.selectedItem.scaling.forEach((value, stat) => {
                this.scaling.set(stat, value);
            });
            this.scaling.renderQueue.stats = true;

            this.materialComponents.forEach(component => {
                component.unmount();
            });

            let componentCount = 0;
            for(let material of this.selectedItem.materials.keys()) {
                let component = this.materialComponents[componentCount];
                if(component === undefined) {
                    component = new AdventuringMaterialUIComponent(this.manager, this.game, this);
                    this.materialComponents[componentCount] = component;
                }

                component.mount(this.component.materials);
                component.tooltip.setContent(material.name);
        
                component.icon.src = material.media;
        
                component.count.textContent = this.selectedItem.getCost(material);
                componentCount++;
            }
        }

        this.renderQueue.details = false;
    }

    encode(writer) {
        writer.writeComplexMap(this.upgradeLevels, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeUint8(value);
        });
        writer.writeComplexMap(this.unlocked, (key, value, writer) => {
            writer.writeNamespacedObject(key);
            writer.writeBoolean(value);
        });

        return writer;
    }

    decode(reader, version) {
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getUint8();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.upgradeLevels.set(key, value);
        });
        reader.getComplexMap((reader) => {
            let key = reader.getNamespacedObject(this.manager.baseItems);
            let value = reader.getBoolean();
            if(typeof key !== "string" && key.id !== "adventuring:none")
                this.unlocked.set(key, value);
        });
    }
}