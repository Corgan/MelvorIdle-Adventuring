export class AdventuringLogSettingsElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-log-settings-template'));

        this.presetsContainer = getElementFromFragment(this._content, 'presets', 'div');
        this.categoriesContainer = getElementFromFragment(this._content, 'categories', 'div');
        this.slotsContainer = getElementFromFragment(this._content, 'slots', 'div');
        this.limitInput = getElementFromFragment(this._content, 'limit-input', 'input');
        
        this.onApplyPreset = null;
        this.onToggleCategory = null;
        this.onToggleSlot = null;
        this.onShowAllSlots = null;
        this.onToggleEnemyOnly = null;
        this.onSetLimit = null;
    }

    connectedCallback() {
        this.appendChild(this._content);
        
        // Wire up limit input
        if (this.limitInput) {
            this.limitInput.onchange = () => {
                const value = parseInt(this.limitInput.value, 10);
                if (!isNaN(value) && this.onSetLimit) {
                    this.onSetLimit(value);
                }
            };
        }
    }
    
    /**
     * Render settings with current filter state
     */
    render(filterSettings, categories, presets) {
        const SLOT_NAMES = ['Front', 'Center', 'Back'];
        
        // Update limit input
        if (this.limitInput) {
            this.limitInput.value = filterSettings.messageLimit;
        }
        
        // Render preset buttons
        if (this.presetsContainer) {
            this.presetsContainer.replaceChildren();
            for (const [id, preset] of Object.entries(presets)) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-sm btn-outline-info mr-1 mb-1';
                btn.textContent = preset.name;
                btn.title = preset.description;
                btn.onclick = () => {
                    if (this.onApplyPreset) this.onApplyPreset(id);
                };
                this.presetsContainer.appendChild(btn);
            }
        }
        
        // Render category toggles grouped by category group
        if (this.categoriesContainer) {
            this.categoriesContainer.replaceChildren();
            
            const groups = {};
            for (const [id, cat] of Object.entries(categories)) {
                if (!groups[cat.group]) groups[cat.group] = [];
                groups[cat.group].push({ id, ...cat });
            }
            
            for (const [groupName, cats] of Object.entries(groups)) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'mb-1';
                
                const groupLabel = document.createElement('div');
                groupLabel.className = 'font-size-xs text-muted mb-1';
                groupLabel.textContent = groupName;
                groupDiv.appendChild(groupLabel);
                
                const togglesDiv = document.createElement('div');
                togglesDiv.className = 'd-flex flex-wrap';
                
                for (const cat of cats) {
                    const label = document.createElement('label');
                    label.className = 'custom-control custom-checkbox mr-2 mb-1';
                    label.style.fontSize = '0.75rem';
                    
                    const input = document.createElement('input');
                    input.type = 'checkbox';
                    input.className = 'custom-control-input';
                    input.checked = filterSettings.enabledCategories.has(cat.id);
                    input.onchange = () => {
                        if (this.onToggleCategory) this.onToggleCategory(cat.id);
                    };
                    
                    const span = document.createElement('span');
                    span.className = 'custom-control-label';
                    span.textContent = cat.name.split(': ').pop();
                    
                    label.appendChild(input);
                    label.appendChild(span);
                    togglesDiv.appendChild(label);
                }
                
                groupDiv.appendChild(togglesDiv);
                this.categoriesContainer.appendChild(groupDiv);
            }
        }
        
        // Render slot toggles (heroes + enemies)
        if (this.slotsContainer) {
            this.slotsContainer.replaceChildren();
            
            // "All" button
            const allBtn = document.createElement('button');
            allBtn.className = `btn btn-sm mr-1 mb-1 ${filterSettings.showAllSlots ? 'btn-info' : 'btn-outline-secondary'}`;
            allBtn.textContent = 'All';
            allBtn.onclick = () => {
                if (this.onShowAllSlots) this.onShowAllSlots();
            };
            this.slotsContainer.appendChild(allBtn);
            
            // Individual hero slot buttons
            for (let slot = 0; slot < 3; slot++) {
                const btn = document.createElement('button');
                const isEnabled = filterSettings.showAllSlots || filterSettings.enabledSlots.has(slot);
                btn.className = `btn btn-sm mr-1 mb-1 ${isEnabled ? 'btn-outline-info' : 'btn-outline-secondary'}`;
                btn.textContent = SLOT_NAMES[slot];
                btn.onclick = () => {
                    if (this.onToggleSlot) this.onToggleSlot(slot);
                };
                this.slotsContainer.appendChild(btn);
            }
            
            // Separator
            const sep = document.createElement('span');
            sep.className = 'mx-1';
            sep.textContent = '|';
            this.slotsContainer.appendChild(sep);
            
            // "Enemies" toggle button
            const enemyBtn = document.createElement('button');
            const enemyEnabled = filterSettings.showAllSlots || filterSettings.showEnemyOnly;
            enemyBtn.className = `btn btn-sm mr-1 mb-1 ${enemyEnabled ? 'btn-outline-danger' : 'btn-outline-secondary'}`;
            enemyBtn.textContent = 'Enemies';
            enemyBtn.title = 'Show messages involving only enemies (no heroes)';
            enemyBtn.onclick = () => {
                if (this.onToggleEnemyOnly) this.onToggleEnemyOnly();
            };
            this.slotsContainer.appendChild(enemyBtn);
        }
    }
}
window.customElements.define('adventuring-log-settings', AdventuringLogSettingsElement);
