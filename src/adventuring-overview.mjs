const { loadModule, getResourceUrl } = mod.getContext(import.meta);

const { AdventuringCards } = await loadModule('src/adventuring-cards.mjs');

const { AdventuringOverviewUIComponent } = await loadModule('src/components/adventuring-overview.mjs');
const { AdventuringOverviewButtonUIComponent } = await loadModule('src/components/adventuring-overview-button.mjs');

class AdventuringOverviewButton {
    constructor(manager, game, data) {
        this.manager = manager;
        this.game = game;
        this.data = data;
        this.component = new AdventuringOverviewButtonUIComponent(this.manager, this.game, this);

        this.component.button.onclick = () => this.clicked();
    }

    clicked() {
        if(this.data.page !== undefined) {
            let page = this.manager.pages.byId.get(this.data.page);
            if(page !== undefined) {
                if(this.data.pageFn !== undefined && page[this.data.pageFn] !== undefined) {
                    page[this.data.pageFn]();
                } else {
                    page.go();
                }
            }
        }
    }
    
    get active() {
        if(this.data.page !== undefined)
            if(this.manager.pages.byId.get(this.data.page).active)
                return true;
        return false;
    }

    get name() {
        if(this.manager.isActive && this.data.states !== undefined && this.data.states.active !== undefined && this.data.states.active.name !== undefined)
            return this.data.states.active.name;
        if(!this.manager.isActive && this.data.states !== undefined && this.data.states.passive !== undefined && this.data.states.passive.name !== undefined)
            return this.data.states.passive.name;
        return this.data.name;
    }

    get media() {
        if(this.manager.isActive && this.data.states !== undefined && this.data.states.active !== undefined && this.data.states.active.media !== undefined)
            return getResourceUrl(this.data.states.active.media);
        if(!this.manager.isActive && this.data.states !== undefined && this.data.states.passive !== undefined && this.data.states.passive.media !== undefined)
            return getResourceUrl(this.data.states.passive.media);
        return getResourceUrl(this.data.media);
    }

    render() {
        if(this.data.states !== undefined && this.data.states.active !== undefined)
            this.component.button.classList.toggle(this.data.states.active.className, this.manager.isActive);
        if(this.data.states !== undefined && this.data.states.passive !== undefined)
            this.component.button.classList.toggle(this.data.states.passive.className, !this.manager.isActive);

        this.component.button.classList.toggle('btn-info', this.active);
        this.component.name.textContent = this.name;
        this.component.icon.src = this.media;
    }
}

class OverviewRenderQueue {
    constructor() {
        this.status = false;
        this.buttons = false;
        this.turnProgressBar = false;
    }
}

export class AdventuringOverview {
    constructor(manager, game) {
        this.manager = manager;
        this.game = game;

        this.renderQueue = new OverviewRenderQueue();
        this.component = new AdventuringOverviewUIComponent(this.manager, this.game, this);

        this.buttons = new Set();

        this.cards = new AdventuringCards(this.manager, this.game);
        
        this.cards.component.mount(this.component.cards);
    }

    onLoad() {
        this.renderQueue.status = true;
        this.renderQueue.buttons = true;
        this.renderQueue.turnProgressBar = true;
    }

    registerData(data) {
        if(data.buttons !== undefined) {
            data.buttons.forEach(buttonData => {
                let button = new AdventuringOverviewButton(this.manager, this.game, buttonData);
                button.component.mount(this.component.buttons);
                this.buttons.add(button);
            });
        }
    }

    postDataRegistration() {

    }

    render() {
        this.renderButtons();
        this.renderStatus();
        this.renderTurnProgress();
        this.cards.render();
    }

    renderButtons() {
        if(!this.renderQueue.buttons)
            return;

        this.buttons.forEach(button => button.render());

        this.component.cards.classList.toggle('d-none', false && !this.manager.isActive);

        this.renderQueue.buttons = false;
    }

    renderStatus() {
        if(!this.renderQueue.status)
            return;

        let status = '';

        if(this.manager.isActive) {
            if(this.manager.dungeon.area !== undefined) {
                let floor = this.manager.dungeon.progress == this.manager.dungeon.numFloors ? "Boss Floor" : `Floor ${this.manager.dungeon.progress+1}`;
                status += `${this.manager.dungeon.area.name} - ${floor}`;
            }

            if(this.manager.encounter.isFighting)
                status += ` - Round ${this.manager.encounter.roundCounter}`;
        } else {
            status = `Town`;
        }

        this.component.statusText.textContent = status;

        this.renderQueue.status = false;
    }

    renderTurnProgress() {
        if(!this.renderQueue.turnProgressBar)
            return;

        if(this.manager.encounter.hitTimer.isActive) {
            this.component.turnProgressBar.animateStriped();
        } else if(this.manager.encounter.turnTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.encounter.turnTimer);
        } else if(this.manager.dungeon.exploreTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.dungeon.exploreTimer);
        } else if(this.manager.healTimer.isActive) {
            this.component.turnProgressBar.animateProgressFromTimer(this.manager.healTimer);
        } else {
            this.component.turnProgressBar.stopAnimation();
        }

        this.renderQueue.turnProgressBar = false;
    }
}