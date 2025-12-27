export class AdventuringConsumablesElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-consumables-template'));

        this.page = getElementFromFragment(this._content, 'page', 'div');
        this.back = getElementFromFragment(this._content, 'back', 'button');
        this.items = getElementFromFragment(this._content, 'items', 'div');
        this.slotsContainer = getElementFromFragment(this._content, 'slots', 'div');
        
        // Get individual slot elements
        this.slots = [];
        for(let i = 0; i < 3; i++) {
            this.slots.push(getElementFromFragment(this._content, `slot-${i}`, 'div'));
        }
        
        // Details panel elements
        this.detailsContainer = getElementFromFragment(this._content, 'details-container', 'div');
        this.details = getElementFromFragment(this._content, 'details', 'div');
        this.detailsPlaceholder = getElementFromFragment(this._content, 'details-placeholder', 'div');
        this.detailIcon = getElementFromFragment(this._content, 'detail-icon', 'img');
        this.detailName = getElementFromFragment(this._content, 'detail-name', 'h5');
        this.detailDescription = getElementFromFragment(this._content, 'detail-description', 'p');
        this.detailEffects = getElementFromFragment(this._content, 'detail-effects', 'div');
        this.detailCharges = getElementFromFragment(this._content, 'detail-charges', 'span');
        this.detailMaterials = getElementFromFragment(this._content, 'detail-materials', 'div');
        this.craftButton = getElementFromFragment(this._content, 'craft-button', 'button');
        this.equipButton = getElementFromFragment(this._content, 'equip-button', 'button');
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    mount(parent) {
        parent.appendChild(this);
    }

    show() {
        this.page.classList.remove('d-none');
    }

    hide() {
        this.page.classList.add('d-none');
    }
    
    showDetails() {
        this.details.classList.remove('d-none');
        this.detailsPlaceholder.classList.add('d-none');
    }
    
    hideDetails() {
        this.details.classList.add('d-none');
        this.detailsPlaceholder.classList.remove('d-none');
    }
}
window.customElements.define('adventuring-consumables', AdventuringConsumablesElement);
