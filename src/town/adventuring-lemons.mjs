const { loadModule } = mod.getContext(import.meta);

const { AdventuringPage } = await loadModule('src/ui/adventuring-page.mjs');

const { AdventuringLemonsElement } = await loadModule('src/town/components/adventuring-lemons.mjs');
const { AdventuringStatCardElement } = await loadModule('src/ui/components/adventuring-stat-card.mjs');

const LEMON_QUOTES = [
    "When life gives you lemons, make lemonade!",
    "You're the zest!",
    "This stall is un-be-lemon-able!",
    "I'm so souré of your progress!",
    "Pucker up, adventurer!",
    "You've found the main squeeze of the town!",
    "These prices are sub-lime!",
    "Don't be bitter, have some lemonade!",
    "I've got a zest for life!",
    "Squeeze the day!",
    "When life gives you lemons, you'd better have some sugar.",
    "A lemon a day keeps the monsters away!",
    "You look like you could use some vitamin C-ombat stats!",
    "Our lemonade is totally natural - no artificial flavorings or magic!",
    "This is where the cool adventurers hang out. Very refreshing.",
];

const LEMON_SECRETS = [
    "Psst! Did you know lemons were first grown in Assam, India?",
    "Fun fact: The average lemon contains about 3 tablespoons of juice!",
    "Secret menu: Ask about the 'Lemvor Special' (we don't actually have it)",
    "According to legend, a lemon tree grows at the center of every great dungeon.",
    "Some say if you collect 1000 lemons, something magical happens...",
    "The Lemon Stall has been here longer than the town itself. We're not sure how.",
];

class AdventuringLemonRenderQueue {
    constructor() {
        this.all = false;
        this.quote = false;
        this.stats = false;
    }

    queueAll() {
        this.all = true;
        this.quote = true;
        this.stats = true;
    }
}

export class AdventuringLemons extends AdventuringPage {
    constructor(manager, game) {
        super(manager, game);
        this.manager = manager;
        this.game = game;
        this.component = createElement('adventuring-lemons');
        this.renderQueue = new AdventuringLemonRenderQueue();

        this.lemonadesConsumed = 0;
        this.lemonsSquashed = 0;
        this.timesVisited = 0;
        this.secretsFound = new Set();

        this.currentQuote = this.getRandomQuote();

        this.component.back.onclick = () => this.back();
    }

    back() {
        if(this.active) {
            this.manager.town.setBuilding(undefined);
        }
    }

    onLoad() {
        super.onLoad();
        this.renderQueue.all = true;
    }

    onShow() {
        this.manager.party.setAllLocked(false);
        this.timesVisited++;
        this.currentQuote = this.getRandomQuote();
        this.renderQueue.all = true;

        if(Math.random() < 0.1) {
            this.discoverSecret();
        }
    }

    onHide() {
        this.manager.party.setAllLocked(true);
    }

    // Required by base class contract - no additional registration needed
    postDataRegistration() {

    }

    getRandomQuote() {
        return LEMON_QUOTES[Math.floor(Math.random() * LEMON_QUOTES.length)];
    }

    discoverSecret() {
        const undiscovered = LEMON_SECRETS.filter((_, i) => !this.secretsFound.has(i));
        if(undiscovered.length > 0) {
            const idx = LEMON_SECRETS.indexOf(undiscovered[Math.floor(Math.random() * undiscovered.length)]);
            this.secretsFound.add(idx);
            this.manager.log.add(`🍋 Secret discovered: "${LEMON_SECRETS[idx]}"`, {
                category: 'town'
            });
            this.renderQueue.all = true;
        }
    }

    buyLemonade() {
        const cost = 5;
        if(this.manager.stash.currency < cost) {
            this.manager.log.add("You can't afford lemonade! How sad.", {
                category: 'town'
            });
            return;
        }

        this.manager.stash.removeCurrency(cost);
        this.lemonadesConsumed++;

        const messages = [
            "Ahh, refreshing!",
            "That hit the spot!",
            "Pucker power!",
            "Deliciously tart!",
            "You feel invigorated!",
            "The tartness awakens your senses!",
        ];

        this.manager.log.add(`🍋 ${messages[Math.floor(Math.random() * messages.length)]}`, {
            category: 'town'
        });

        if(this.lemonadesConsumed % 10 === 0) {
            const bonus = Math.floor(this.lemonadesConsumed / 10);
            this.manager.log.add(`🍋 Loyalty reward! You've had ${this.lemonadesConsumed} lemonades!`, {
                category: 'town'
            });
            this.manager.stash.addCurrency(bonus * 5);
        }

        this.currentQuote = this.getRandomQuote();
        this.renderQueue.all = true;
    }

    squashLemon() {
        this.lemonsSquashed++;

        const outcomes = [
            { msg: "Splat! That was satisfying.", weight: 40 },
            { msg: "You got lemon juice in your eye! Ow!", weight: 20 },
            { msg: "Perfect squash! The juice flies everywhere!", weight: 20 },
            { msg: "The lemon explodes dramatically!", weight: 10 },
            { msg: "Wait, that was a lime... close enough!", weight: 5 },
            { msg: "A golden lemon! You find 20 coins inside!", weight: 4, coins: 20 },
            { msg: "MEGA SQUASH! The town applauds!", weight: 1, coins: 100 },
        ];

        const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
        let roll = Math.random() * totalWeight;

        for(const outcome of outcomes) {
            roll -= outcome.weight;
            if(roll <= 0) {
                this.manager.log.add(`🍋 ${outcome.msg}`, {
                    category: 'town'
                });
                if(outcome.coins) {
                    this.manager.stash.addCurrency(outcome.coins);
                }
                break;
            }
        }

        this.currentQuote = this.getRandomQuote();
        this.renderQueue.all = true;
    }

    render() {
        if(!this.renderQueue.all && !this.renderQueue.quote && !this.renderQueue.stats)
            return;

        if(this.component.quote) {
            this.component.quote.textContent = `"${this.currentQuote}"`;
        }

        if(this.component.stats) {
            this.component.stats.replaceChildren();
            const row = document.createElement('div');
            row.className = 'row';

            const stats = [
                { value: this.lemonadesConsumed, label: 'Lemonades Consumed' },
                { value: this.lemonsSquashed, label: 'Lemons Squashed' },
                { value: `${this.secretsFound.size}/${LEMON_SECRETS.length}`, label: 'Secrets Found' }
            ];

            stats.forEach(stat => {
                const card = new AdventuringStatCardElement();
                card.setColumnClass('col-4');
                card.setStat({ value: stat.value, label: stat.label });
                row.appendChild(card);
            });

            this.component.stats.appendChild(row);
        }

        if(this.component.secrets) {
            if(this.secretsFound.size > 0) {
                let html = '<ul class="list-unstyled mb-0">';
                this.secretsFound.forEach(idx => {
                    html += `<li class="text-info small mb-1">🍋 ${LEMON_SECRETS[idx]}</li>`;
                });
                html += '</ul>';
                this.component.secrets.innerHTML = html;
            } else {
                this.component.secrets.innerHTML = '<small class="text-muted">No secrets discovered yet. Keep visiting!</small>';
            }
        }

        if(this.component.buyBtn) {
            this.component.buyBtn.onclick = () => this.buyLemonade();
        }
        if(this.component.squashBtn) {
            this.component.squashBtn.onclick = () => this.squashLemon();
        }

        this.renderQueue.all = false;
        this.renderQueue.quote = false;
        this.renderQueue.stats = false;
    }

    resetStats() {
        this.lemonadesConsumed = 0;
        this.lemonsSquashed = 0;
        this.timesVisited = 0;
        this.secretsFound = new Set();
        this.renderQueue.queueAll();
    }

    encode(writer) {
        writer.writeUint32(this.lemonadesConsumed);
        writer.writeUint32(this.lemonsSquashed);
        writer.writeUint32(this.timesVisited);
        writer.writeUint8(this.secretsFound.size);
        this.secretsFound.forEach(idx => writer.writeUint8(idx));
    }

    decode(reader, version) {
        this.lemonadesConsumed = reader.getUint32();
        this.lemonsSquashed = reader.getUint32();
        this.timesVisited = reader.getUint32();
        const numSecrets = reader.getUint8();
        this.secretsFound = new Set();
        for(let i = 0; i < numSecrets; i++) {
            this.secretsFound.add(reader.getUint8());
        }
    }
}