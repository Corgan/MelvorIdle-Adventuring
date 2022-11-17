const { loadModule } = mod.getContext(import.meta);


const { AdventuringPage } = await loadModule('src/adventuring-page.mjs');

const { AdventuringEquipment } = await loadModule('src/adventuring-equipment.mjs');
const { AdventuringEquipmentItem } = await loadModule('src/adventuring-equipment-item.mjs');
const { AdventuringStashSlot } = await loadModule('src/adventuring-stash-slot.mjs');
const { AdventuringStashUIComponent } = await loadModule('src/components/adventuring-stash.mjs');

class AdventuringStashRenderQueue {
    constructor() {
        this.details = false;
        this.slots = false;
    }
}

export class AdventuringStash extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.baseSlots = 26;
        this.slots = new Array(this.baseSlots).fill(null).map(() => new AdventuringStashSlot(this.manager, this.game));

        this.component = new AdventuringStashUIComponent(this.manager, this.game);

        this.component.trash.onclick = () => this.trashItem();
        this.renderQueue = new AdventuringStashRenderQueue();
    }

    onLoad() {
        super.onLoad();
        this.slots.forEach(slot => slot.onLoad());
        this.renderQueue.slots = true;
    }

    onShow() {
        this.manager.party.all.forEach(member => member.equipment.setLocked(false));
    }

    onHide() {
        super.onHide();
        this.clearSelected();

        this.manager.party.all.forEach(member => {
            member.equipment.setLocked(true);
            member.equipment.clearSelected();
        });
    }

    get firstEmpty() {
        return this.slots.find(slot => slot.empty);
    }

    get emptyCount() {
        return this.slots.filter(slot => slot.empty).length;
    }

    add(item) {
        for(let i = 0; i < this.slots.length; i++) {
            if(this.slots[i].empty) {
                this.slots[i].setItem(item);
                this.renderQueue.slots = true;
                return true;
            }
        }

        return false;
    }

    remove(item) {
        for(let i = 0; i < this.slots.length; i++) {
            if(this.slots[i].item === item) {
                this.slots[i].setEmpty();
                this.renderQueue.slots = true;
                return true;
            }
        }
        return false;
    }

    trashItem() {
        if(this.manager.stash.selectedSlot !== undefined) {
            this.selectedSlot.setEmpty();
            this.clearSelected();
        } else {
            let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);
            if(selectedEquipment !== undefined && selectedEquipment.selectedSlot !== undefined) {
                selectedEquipment.selectedSlot.setEmpty();
                selectedEquipment.clearSelected();
            }
        }
    }

    postDataRegistration() {

    }

    selectSlot(selectedSlot) {
        if(this.selectedSlot === selectedSlot)
            return this.clearSelected();

        this.selectedSlot = selectedSlot;
        this.slots.forEach(slot => {
            slot.setSelected(slot === selectedSlot);
        });
        this.manager.party.all.forEach(character => {
            character.equipment.slots.forEach(slot => {
                slot.setSelected(slot === selectedSlot);
                slot.setHighlight(!this.selectedSlot.empty && slot.canEquip(selectedSlot.item));
            });
        });
        this.renderQueue.details = true;
    }

    clearSelected() {
        this.selectedSlot = undefined;
        this.slots.forEach(slot => {
            slot.setSelected(false);
        });
        this.manager.party.all.forEach(character => {
            character.equipment.slots.forEach(slot => {
                slot.setSelected(false);
                slot.setHighlight(false);
            });
        });
        this.renderQueue.details = true;
    }

    render() {
        this.renderSlots();
        this.renderDetails();
    }

    renderSlots() {
        this.slots.forEach(slot => slot.render());

        if(!this.renderQueue.slots)
            return;

        let slots = this.slots.map(slot => slot.component.$elements).flat();

        slots.push(this.component.trash);
        
        this.component.slots.replaceChildren(...slots);

        this.renderQueue.slots = false;
    }

    renderDetails() {
        if(!this.renderQueue.details)
            return;

        let selectedSlot = this.selectedSlot;
        let selectedEquipment = this.manager.party.all.map(member => member.equipment).find(member => member.selectedSlot !== undefined);

        if(selectedSlot === undefined && selectedEquipment !== undefined)
            selectedSlot = selectedEquipment.selectedSlot;

        if(selectedSlot !== undefined) {
            this.component.name.textContent = selectedSlot.item.name;
            Object.entries(this.component.levels.skills).forEach(([skill, text]) => {
                text.textContent = selectedSlot.item.levels.get(skill) || "-";
            });
        } else {
            this.component.name.textContent = "";
            Object.entries(this.component.levels.skills).forEach(([skill, text]) => {
                text.textContent = "-";
            });
        }

        this.renderQueue.details = false;
    }

    encode(writer) {
        writer.writeArray(this.slots, (slot, writer) => {
            slot.encode(writer);
        });
        return writer;
    }

    decode(reader, version) {
        let i=0;
        reader.getArray((reader)=> {
            if(this.slots[i] === undefined) // Add extra slots as needed?
                this.slots.push(new AdventuringEquipmentItem(this.manager, this.game));
            this.slots[i].decode(reader, version);
            i++;
        });
    }
}