const { loadModule } = mod.getContext(import.meta);

/**
 * Interactive stat breakdown tooltip with collapsible sections
 */
export class AdventuringStatBreakdownTooltipElement extends HTMLElement {
    constructor() {
        super();
        this._content = new DocumentFragment();
        this._content.append(getTemplateNode('adventuring-stat-breakdown-tooltip-template'));

        this.container = getElementFromFragment(this._content, 'container', 'div');
        this.header = getElementFromFragment(this._content, 'header', 'div');
        this.headerIcon = getElementFromFragment(this._content, 'header-icon', 'img');
        this.headerName = getElementFromFragment(this._content, 'header-name', 'span');
        this.headerValue = getElementFromFragment(this._content, 'header-value', 'span');
        this.body = getElementFromFragment(this._content, 'body', 'div');

        // Track collapsed state
        this.collapsedSections = new Set();
        
        // Default collapsed sections
        this.defaultCollapsed = new Set(['combatJob', 'passiveJob', 'achievements', 'globalPassives', 'mastery']);
    }

    connectedCallback() {
        this.appendChild(this._content);
    }

    /**
     * Set the breakdown data to display
     * @param {StatBreakdown} breakdown
     */
    setBreakdown(breakdown) {
        if (!breakdown || !breakdown.stat) return;

        // Header
        this.headerIcon.src = breakdown.stat.media;
        this.headerName.textContent = breakdown.stat.name;
        this.headerValue.textContent = breakdown.finalValue;

        // Clear body
        this.body.replaceChildren();

        // Base section
        this._addBaseSection(breakdown);

        // Positive bonuses
        if (breakdown.positive.length > 0) {
            this._addBonusSection('Positive Bonuses', breakdown.positive, 'positive', breakdown.positiveTotal);
        }

        // Negative modifiers
        if (breakdown.negative.length > 0) {
            this._addBonusSection('Negative Modifiers', breakdown.negative, 'negative', breakdown.negativeTotal);
        }

        // Combat effects
        if (breakdown.combat.buffs.length > 0 || breakdown.combat.debuffs.length > 0) {
            this._addCombatSection(breakdown);
        }

        // Calculation footer
        this._addCalculationFooter(breakdown);
    }

    /**
     * Add base stat section
     */
    _addBaseSection(breakdown) {
        const section = document.createElement('div');
        section.className = 'stat-breakdown-section';
        
        const row = document.createElement('div');
        row.className = 'stat-breakdown-row stat-breakdown-base';
        row.innerHTML = `
            <span class="stat-breakdown-label">Base</span>
            <span class="stat-breakdown-value">${breakdown.base}</span>
        `;
        section.appendChild(row);
        
        this.body.appendChild(section);
    }

    /**
     * Add a collapsible bonus section
     */
    _addBonusSection(title, contributions, type, total) {
        const section = document.createElement('div');
        section.className = 'stat-breakdown-section';

        // Section header (collapsible)
        const header = document.createElement('div');
        header.className = `stat-breakdown-section-header stat-breakdown-${type}`;
        
        const totalDisplay = this._formatTotal(total, type === 'negative');
        header.innerHTML = `
            <span class="stat-breakdown-toggle">▼</span>
            <span class="stat-breakdown-section-title">${title}</span>
            <span class="stat-breakdown-section-total">${totalDisplay}</span>
        `;
        
        const content = document.createElement('div');
        content.className = 'stat-breakdown-section-content';

        // Add contributions
        for (const contrib of contributions) {
            this._addContribution(content, contrib, 1);
        }

        // Toggle handler
        header.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = content.classList.toggle('collapsed');
            header.querySelector('.stat-breakdown-toggle').textContent = isCollapsed ? '▶' : '▼';
        };

        section.appendChild(header);
        section.appendChild(content);
        this.body.appendChild(section);
    }

    /**
     * Add combat effects section (buffs and debuffs)
     */
    _addCombatSection(breakdown) {
        const section = document.createElement('div');
        section.className = 'stat-breakdown-section';

        const header = document.createElement('div');
        header.className = 'stat-breakdown-section-header stat-breakdown-combat';
        
        const total = breakdown.combatTotal;
        const totalDisplay = this._formatTotal(total, false);
        header.innerHTML = `
            <span class="stat-breakdown-toggle">▼</span>
            <span class="stat-breakdown-section-title">Combat Effects</span>
            <span class="stat-breakdown-section-total">${totalDisplay}</span>
        `;

        const content = document.createElement('div');
        content.className = 'stat-breakdown-section-content';

        // Buffs
        if (breakdown.combat.buffs.length > 0) {
            const buffsDiv = document.createElement('div');
            buffsDiv.className = 'stat-breakdown-subsection';
            
            const buffsHeader = document.createElement('div');
            buffsHeader.className = 'stat-breakdown-subsection-header stat-breakdown-buff';
            buffsHeader.innerHTML = `<span class="stat-breakdown-toggle">▼</span> Buffs`;
            
            const buffsContent = document.createElement('div');
            buffsContent.className = 'stat-breakdown-subsection-content';
            
            for (const buff of breakdown.combat.buffs) {
                this._addContribution(buffsContent, buff, 2);
            }

            buffsHeader.onclick = (e) => {
                e.stopPropagation();
                const isCollapsed = buffsContent.classList.toggle('collapsed');
                buffsHeader.querySelector('.stat-breakdown-toggle').textContent = isCollapsed ? '▶' : '▼';
            };

            buffsDiv.appendChild(buffsHeader);
            buffsDiv.appendChild(buffsContent);
            content.appendChild(buffsDiv);
        }

        // Debuffs
        if (breakdown.combat.debuffs.length > 0) {
            const debuffsDiv = document.createElement('div');
            debuffsDiv.className = 'stat-breakdown-subsection';
            
            const debuffsHeader = document.createElement('div');
            debuffsHeader.className = 'stat-breakdown-subsection-header stat-breakdown-debuff';
            debuffsHeader.innerHTML = `<span class="stat-breakdown-toggle">▼</span> Debuffs`;
            
            const debuffsContent = document.createElement('div');
            debuffsContent.className = 'stat-breakdown-subsection-content';
            
            for (const debuff of breakdown.combat.debuffs) {
                this._addContribution(debuffsContent, debuff, 2);
            }

            debuffsHeader.onclick = (e) => {
                e.stopPropagation();
                const isCollapsed = debuffsContent.classList.toggle('collapsed');
                debuffsHeader.querySelector('.stat-breakdown-toggle').textContent = isCollapsed ? '▶' : '▼';
            };

            debuffsDiv.appendChild(debuffsHeader);
            debuffsDiv.appendChild(debuffsContent);
            content.appendChild(debuffsDiv);
        }

        // Toggle handler
        header.onclick = (e) => {
            e.stopPropagation();
            const isCollapsed = content.classList.toggle('collapsed');
            header.querySelector('.stat-breakdown-toggle').textContent = isCollapsed ? '▶' : '▼';
        };

        section.appendChild(header);
        section.appendChild(content);
        this.body.appendChild(section);
    }

    /**
     * Add a single contribution row with optional sub-contributions
     */
    _addContribution(container, contrib, depth) {
        const row = document.createElement('div');
        row.className = `stat-breakdown-row stat-breakdown-depth-${depth}`;
        
        // Icon (if available)
        let iconHtml = '';
        if (contrib.icon) {
            iconHtml = `<img src="${contrib.icon}" class="stat-breakdown-icon" />`;
        }

        // Value display
        const valueDisplay = this._formatContribution(contrib);
        
        row.innerHTML = `
            ${iconHtml}
            <span class="stat-breakdown-label">${contrib.source}</span>
            <span class="stat-breakdown-value">${valueDisplay}</span>
        `;

        container.appendChild(row);

        // Sub-contributions
        if (contrib.subContributions && contrib.subContributions.length > 0) {
            // Make this row collapsible if it has subs
            if (depth === 1) {
                const toggle = document.createElement('span');
                toggle.className = 'stat-breakdown-toggle';
                toggle.textContent = '▼';
                row.insertBefore(toggle, row.firstChild);
                row.classList.add('stat-breakdown-collapsible');

                const subContainer = document.createElement('div');
                subContainer.className = 'stat-breakdown-sub-content';

                for (const sub of contrib.subContributions) {
                    this._addContribution(subContainer, sub, depth + 1);
                }

                // Check if should be default collapsed
                if (this.defaultCollapsed.has(contrib.sourceType)) {
                    subContainer.classList.add('collapsed');
                    toggle.textContent = '▶';
                }

                row.onclick = (e) => {
                    e.stopPropagation();
                    const isCollapsed = subContainer.classList.toggle('collapsed');
                    toggle.textContent = isCollapsed ? '▶' : '▼';
                };

                container.appendChild(subContainer);
            } else {
                // Just add inline for deeper levels
                for (const sub of contrib.subContributions) {
                    this._addContribution(container, sub, depth + 1);
                }
            }
        }
    }

    /**
     * Add calculation footer
     */
    _addCalculationFooter(breakdown) {
        const footer = document.createElement('div');
        footer.className = 'stat-breakdown-footer';
        
        const base = breakdown.base;
        const flat = breakdown.totalFlat;
        const percent = breakdown.totalPercent;
        const final = breakdown.finalValue;

        let formula = `(${base}`;
        if (flat > 0) formula += ` + ${flat}`;
        else if (flat < 0) formula += ` - ${Math.abs(flat)}`;
        formula += ')';
        
        if (percent !== 0) {
            const multiplier = (1 + percent / 100).toFixed(2);
            formula += ` × ${multiplier}`;
        }
        
        footer.innerHTML = `
            <div class="stat-breakdown-calc">
                <span class="stat-breakdown-formula">${formula}</span>
                <span class="stat-breakdown-equals">=</span>
                <span class="stat-breakdown-final">${final}</span>
            </div>
        `;

        this.body.appendChild(footer);
    }

    /**
     * Format a contribution's value for display
     */
    _formatContribution(contrib) {
        const parts = [];
        
        if (contrib.flat !== 0) {
            const sign = contrib.flat > 0 ? '+' : '';
            parts.push(`${sign}${contrib.flat}`);
        }
        
        if (contrib.percent !== 0) {
            const sign = contrib.percent > 0 ? '+' : '';
            parts.push(`(${sign}${contrib.percent}%)`);
        }

        if (parts.length === 0) {
            // Check sub-contributions for totals
            const totalFlat = contrib.totalFlat;
            const totalPercent = contrib.totalPercent;
            if (totalFlat !== 0) parts.push(`+${totalFlat}`);
            if (totalPercent !== 0) parts.push(`(+${totalPercent}%)`);
        }

        return parts.join(' ') || '—';
    }

    /**
     * Format total for section header
     */
    _formatTotal(total, isNegative) {
        const parts = [];
        
        if (total.flat !== 0) {
            const sign = total.flat > 0 ? '+' : '';
            parts.push(`${sign}${total.flat}`);
        }
        
        if (total.percent !== 0) {
            const sign = total.percent > 0 ? '+' : '';
            parts.push(`${sign}${total.percent}%`);
        }

        return parts.join(' ') || (isNegative ? '—' : '+0');
    }
}

window.customElements.define('adventuring-stat-breakdown-tooltip', AdventuringStatBreakdownTooltipElement);
