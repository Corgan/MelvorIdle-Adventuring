const { loadModule } = mod.getContext(import.meta);

/**
 * Stat breakdown tooltip using game-native styling
 * Builds HTML content for tippy tooltips matching base game appearance
 */
export class AdventuringStatBreakdownTooltipElement extends HTMLElement {
    constructor() {
        super();
        this._container = document.createElement('div');
        this._container.className = 'text-left';
        this.appendChild(this._container);
        this._collapseIdCounter = 0;
    }

    /**
     * Set the breakdown data to display
     * @param {StatBreakdown} breakdown
     */
    setBreakdown(breakdown) {
        if (!breakdown || !breakdown.stat) return;
        this._collapseIdCounter = 0;
        this._container.innerHTML = this._buildContent(breakdown);
        this._attachCollapseHandlers();
    }

    /**
     * Attach click handlers for collapsible sections
     */
    _attachCollapseHandlers() {
        const toggles = this._container.querySelectorAll('[data-collapse-toggle]');
        toggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = toggle.getAttribute('data-collapse-toggle');
                const target = this._container.querySelector(`[data-collapse-id="${targetId}"]`);
                const icon = toggle.querySelector('i.fa');
                
                if (target) {
                    const isHidden = target.style.display === 'none';
                    target.style.display = isHidden ? 'block' : 'none';
                    if (icon) {
                        icon.classList.toggle('fa-chevron-right', !isHidden);
                        icon.classList.toggle('fa-chevron-down', isHidden);
                    }
                }
            });
        });
    }

    /**
     * Build the tooltip HTML content using game-native styles
     */
    _buildContent(breakdown) {
        const sections = [];

        // Header with icon and stat name
        sections.push(`
            <div class="text-center mb-3">
                <img class="skill-icon-xs mr-1" src="${breakdown.stat.media}">
                <span class="font-w600 text-warning">${breakdown.stat.name}</span>
                <span class="font-w700 text-info ml-2">${breakdown.finalValue}</span>
            </div>
        `);

        // Base stat row
        sections.push(`
            <div class="d-flex justify-content-between mb-2 pb-2" style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                <span class="text-muted">Base</span>
                <span>${breakdown.base}</span>
            </div>
        `);

        // Calculate pre-percent value for showing actual percent contributions
        const prePercentValue = breakdown.base + breakdown.totalFlat;

        // All bonuses - each source gets its own row with spacing
        const allContribs = [...breakdown.positive, ...breakdown.negative];
        if (allContribs.length > 0) {
            for (let i = 0; i < allContribs.length; i++) {
                const contrib = allContribs[i];
                const isPositive = breakdown.positive.includes(contrib);
                const colorClass = isPositive ? 'text-success' : 'text-danger';
                const isLast = i === allContribs.length - 1 && breakdown.combat.buffs.length === 0 && breakdown.combat.debuffs.length === 0;
                sections.push(this._buildSourceRow(contrib, colorClass, !isLast, prePercentValue));
            }
        }

        // Combat effects - each gets its own row with spacing
        const allCombat = [...breakdown.combat.buffs, ...breakdown.combat.debuffs];
        if (allCombat.length > 0) {
            for (let i = 0; i < allCombat.length; i++) {
                const effect = allCombat[i];
                const isBuff = breakdown.combat.buffs.includes(effect);
                const colorClass = isBuff ? 'text-success' : 'text-danger';
                const isLast = i === allCombat.length - 1;
                sections.push(this._buildSourceRow(effect, colorClass, !isLast, prePercentValue));
            }
        }

        return sections.join('');
    }

    /**
     * Build a source row with icon, name, and value - with clear visual separation
     * @param {StatContribution} contrib - The contribution to display
     * @param {string} colorClass - CSS class for coloring (text-success/text-danger)
     * @param {boolean} showBorder - Whether to show bottom border
     * @param {number} prePercentValue - The stat value before percent bonuses (for calculating actual percent contribution)
     */
    _buildSourceRow(contrib, colorClass = '', showBorder = true, prePercentValue = 0) {
        let iconHtml = '';
        if (contrib.icon) {
            iconHtml = `<img class="skill-icon-xxs mr-2" src="${contrib.icon}">`;
        }

        const valueDisplay = this._formatContribution(contrib, prePercentValue);
        const hasSubs = contrib.subContributions && contrib.subContributions.length > 0;
        
        // Wrap entire group in container with border at bottom
        const borderStyle = showBorder ? 'border-bottom: 1px solid rgba(255,255,255,0.1);' : '';
        
        let html = `<div class="py-1 mb-1" style="${borderStyle}">`;
        
        // Parent row - if it has subs, make it clickable to collapse/expand
        if (hasSubs) {
            const collapseId = `collapse-${this._collapseIdCounter++}`;
            html += `
                <div class="d-flex justify-content-between align-items-center" style="cursor: pointer;" data-collapse-toggle="${collapseId}">
                    <span class="text-muted">
                        <i class="fa fa-chevron-down fa-fw mr-1" style="font-size: 0.7em;"></i>${iconHtml}${contrib.source}
                    </span>
                    <span class="${colorClass} font-w600 ml-3">${valueDisplay}</span>
                </div>
            `;
            
            // Sub-contributions container (collapsible)
            html += `<div data-collapse-id="${collapseId}">`;
            for (const sub of contrib.subContributions) {
                let subIcon = '';
                if (sub.icon) {
                    subIcon = `<img class="skill-icon-xxs mr-1" src="${sub.icon}">`;
                }
                const subValue = this._formatContribution(sub, prePercentValue);
                // Level-capped items show with gold/warning text
                const nameClass = sub.isLevelCapped ? 'text-warning' : 'text-muted';
                html += `
                    <div class="d-flex justify-content-between align-items-center pl-3 pt-1" style="opacity: 0.8; font-size: 0.9em;">
                        <span class="${nameClass}">${subIcon}${sub.source}</span>
                        <span class="${colorClass} ml-3">${subValue}</span>
                    </div>
                `;
            }
            html += `</div>`;
        } else {
            // No subs - simple row
            html += `
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted">${iconHtml}${contrib.source}</span>
                    <span class="${colorClass} font-w600 ml-3">${valueDisplay}</span>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    }

    /**
     * Format a contribution's value for display
     * For parent contributions with sub-contributions, shows total flat only
     * For percent-only contributions, calculates and shows actual value
     * @param {StatContribution} contrib - The contribution
     * @param {number} prePercentValue - Value before percent bonuses for calculating actual contribution
     */
    _formatContribution(contrib, prePercentValue = 0) {
        const parts = [];
        
        // If this has sub-contributions, show the sum of sub flat values
        if (contrib.subContributions && contrib.subContributions.length > 0) {
            const totalFlat = contrib.totalFlat;
            if (totalFlat !== 0) {
                const sign = totalFlat > 0 ? '+' : '';
                parts.push(`${sign}${totalFlat}`);
            }
            // Don't show percent for parent - percent effects are handled by effectCache separately
        } else {
            // Direct contribution (no subs)
            if (contrib.flat !== 0) {
                const sign = contrib.flat > 0 ? '+' : '';
                parts.push(`${sign}${contrib.flat}`);
            }
            
            if (contrib.percent !== 0) {
                // Calculate the actual value this percent contributes (not floored - stat calc floors at end)
                const actualValue = prePercentValue * contrib.percent / 100;
                const sign = actualValue >= 0 ? '+' : '';
                // Show to 1 decimal place, or as integer if whole number
                const displayValue = Number.isInteger(actualValue) ? actualValue : actualValue.toFixed(1);
                // Show as "+X (+Y%)" where X is actual contribution, Y is the percent
                const percentSign = contrib.percent > 0 ? '+' : '';
                parts.push(`${sign}${displayValue} (${percentSign}${contrib.percent}%)`);
            }
        }

        return parts.join(' ') || '—';
    }

    /**
     * Format total for section header
     */
    _formatTotal(total) {
        const parts = [];
        
        if (total.flat !== 0) {
            const sign = total.flat > 0 ? '+' : '';
            parts.push(`${sign}${total.flat}`);
        }
        
        if (total.percent !== 0) {
            const sign = total.percent > 0 ? '+' : '';
            parts.push(`${sign}${total.percent}%`);
        }

        return parts.join(' ') || '+0';
    }
}

window.customElements.define('adventuring-stat-breakdown-tooltip', AdventuringStatBreakdownTooltipElement);
