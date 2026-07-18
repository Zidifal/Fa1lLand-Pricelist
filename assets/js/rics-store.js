// assets/js/rics-store.js
// FA1LLAND STORE — Cyberpunk RimWorld Edition
// With filter chips, sortable tables, neon glow, and full search

class RICSStore {
    constructor() {
        this.data = { items: [], events: [], traits: [], races: [], weather: [], mods: [] };
        this.filteredData = { items: [], events: [], traits: [], races: [], weather: [], mods: [] };
        this.currentSort = {};
        this.loadFailed = false;
        this.activeFilters = { items: 'all', events: 'all', weather: 'all', traits: 'all' };
        this.searchTerms = { items: '', events: '', weather: '', traits: '', races: '', mods: '' };
        this.init();
    }

    async init() {
        this.initParticles();
        await this.loadAllData();
        this.renderAllTabs();
        this.updateHeaderStats();
        this.updateTabCounts();
        this.buildFilterChips();
        this.setupEventListeners();
    }

    // ══════════════════════════════════════════════
    //  PARTICLES
    // ══════════════════════════════════════════════
    initParticles() {
        const container = document.getElementById('particles');
        if (!container) return;
        const count = Math.min(Math.floor(window.innerWidth / 35), 35);
        const colors = ['#00ffa3', '#00e5ff', '#bf5af2', '#ff2d78'];
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const c = colors[Math.floor(Math.random() * colors.length)];
            const size = (1 + Math.random() * 2) + 'px';
            Object.assign(p.style, {
                left: Math.random() * 100 + '%',
                animationDuration: (8 + Math.random() * 16) + 's',
                animationDelay: (Math.random() * 12) + 's',
                width: size,
                height: size,
                background: c,
                boxShadow: `0 0 6px ${c}`
            });
            container.appendChild(p);
        }
    }

    // ══════════════════════════════════════════════
    //  DATA LOADING
    // ══════════════════════════════════════════════
    async loadAllData() {
        this.loadFailed = false;
        const promises = [
            this.loadJson('items',   'data/StoreItems.json',    this.processItemsData.bind(this)),
            this.loadJson('traits',  'data/Traits.json',        this.processTraitsData.bind(this)),
            this.loadJson('races',   'data/RaceSettings.json',  this.processRacesData.bind(this)),
            this.loadJson('events',  'data/Incidents.json',     this.processEventsData.bind(this)),
            this.loadJson('weather', 'data/Weather.json',       this.processWeatherData.bind(this)),
            this.loadJson('mods',    'data/ActiveMods.json',    this.processModsData.bind(this))
        ];

        await Promise.allSettled(promises);

        if (this.loadFailed) {
            const warning = document.createElement('div');
            warning.className = 'warning-bar';
            warning.textContent = '⚠ Warning: Some data files failed to load. Some tabs may be incomplete.';
            const container = document.querySelector('.container');
            const tabContent = document.querySelector('.tab-content');
            if (container && tabContent) {
                container.insertBefore(warning, tabContent);
            }
        }

        console.log('Data loaded:', {
            items: this.data.items.length,
            traits: this.data.traits.length,
            races: this.data.races.length,
            events: this.data.events.length,
            weather: this.data.weather.length,
            mods: this.data.mods.length
        });
    }

    async loadJson(key, url, processor) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const raw = await res.json();
            const data = (key === 'items' && raw.items) ? raw.items : raw;

            this.data[key] = processor(data);
            this.filteredData[key] = [...this.data[key]];
        } catch (e) {
            console.error(`Failed to load ${url}:`, e);
            this.loadFailed = true;
            this.data[key] = [];
            this.filteredData[key] = [];
        }
    }

    // ══════════════════════════════════════════════
    //  PROCESSORS
    // ══════════════════════════════════════════════
    convertRimWorldColors(text) {
        if (!text || typeof text !== 'string') return text;
        let result = text;
        result = result.replace(/<color=#([0-9a-fA-F]{6,8})>(.*?)<\/color>/gi,
            '<span style="color: #$1">$2</span>');
        result = result.replace(/<b>(.*?)<\/b>/gi, '<strong>$1</strong>');
        result = result.replace(/<i>(.*?)<\/i>/gi, '<em>$1</em>');
        return result;
    }

    processItemsData(itemsObject) {
        return Object.entries(itemsObject || {})
            .map(([key, itemData]) => ({
                defName: itemData.DefName || key,
                name: itemData.CustomName || itemData.DefName || key,
                price: itemData.BasePrice || 0,
                category: itemData.Category || 'Misc',
                quantityLimit: itemData.HasQuantityLimit ? (itemData.QuantityLimit || 0) : 'Unlimited',
                limitMode: itemData.LimitMode,
                mod: itemData.Mod || 'Unknown',
                isUsable: itemData.IsUsable || false,
                isEquippable: itemData.IsEquippable || false,
                isWearable: itemData.IsWearable || false,
                enabled: itemData.Enabled !== false,
                modactive: itemData.modactive === true
            }))
            .filter(item => item.modactive)
            .filter(item => (item.enabled || item.isUsable || item.isEquippable || item.isWearable))
            .filter(item => item.price > 0);
    }

    processEventsData(eventsObject) {
        return Object.entries(eventsObject || {})
            .map(([key, eventData]) => ({
                defName: eventData.DefName || key,
                label: eventData.Label || eventData.DefName || key,
                baseCost: eventData.BaseCost || 0,
                karmaType: eventData.KarmaType || 'None',
                modSource: eventData.ModSource || 'Unknown',
                enabled: eventData.Enabled !== false,
                modactive: eventData.modactive === true
            }))
            .filter(event => event.modactive)
            .filter(event => event.enabled && event.baseCost > 0);
    }

    processTraitsData(traitsObject) {
        return Object.entries(traitsObject || {})
            .map(([key, traitData]) => ({
                defName: traitData.DefName || key,
                name: traitData.Name || traitData.DefName || key,
                description: this.processTraitDescription(traitData.Description || ''),
                stats: traitData.Stats || [],
                conflicts: traitData.Conflicts || [],
                canAdd: traitData.CanAdd || false,
                canRemove: traitData.CanRemove || false,
                addPrice: traitData.AddPrice || 0,
                removePrice: traitData.RemovePrice || 0,
                bypassLimit: traitData.BypassLimit || false,
                modSource: traitData.ModSource || 'Unknown',
                modactive: traitData.modactive === true
            }))
            .filter(trait => trait.modactive)
            .filter(trait => trait.canAdd || trait.canRemove)
            .filter(trait => trait.addPrice > 0 || trait.removePrice > 0);
    }

    processWeatherData(weatherObject) {
        return Object.entries(weatherObject || {})
            .map(([key, weatherData]) => ({
                defName: weatherData.DefName || key,
                label: weatherData.Label || weatherData.DefName || key,
                description: weatherData.Description || '',
                baseCost: weatherData.BaseCost || 0,
                karmaType: weatherData.KarmaType || 'None',
                modSource: weatherData.ModSource || 'Unknown',
                enabled: weatherData.Enabled !== false,
                modactive: weatherData.modactive === true
            }))
            .filter(weather => weather.modactive)
            .filter(weather => weather.enabled && weather.baseCost > 0);
    }

    processRacesData(racesObject) {
        const grouped = {};
        Object.entries(racesObject || {}).forEach(([raceKey, raceData]) => {
            const baseRace = {
                defName: raceKey,
                name: raceData.DisplayName || raceKey,
                basePrice: Math.round(raceData.BasePrice || 0),
                minAge: raceData.MinAge || 0,
                maxAge: raceData.MaxAge || 0,
                allowCustomXenotypes: raceData.AllowCustomXenotypes || false,
                defaultXenotype: raceData.DefaultXenotype || 'None',
                enabled: raceData.Enabled !== false,
                modActive: raceData.ModActive !== false,
                allowedGenders: raceData.AllowedGenders || {},
                xenotypePrices: raceData.XenotypePrices || {},
                enabledXenotypes: raceData.EnabledXenotypes || {}
            };
            if (!baseRace.enabled || baseRace.modActive === false) return;
            if (!grouped[raceKey]) {
                grouped[raceKey] = { ...baseRace, isBaseRace: true, xenotypes: [] };
            }
            if (baseRace.enabledXenotypes) {
                Object.entries(baseRace.enabledXenotypes).forEach(([xenotype, isEnabled]) => {
                    if (isEnabled && baseRace.xenotypePrices[xenotype] !== undefined) {
                        grouped[raceKey].xenotypes.push({
                            defName: `${raceKey}_${xenotype}`,
                            name: xenotype,
                            basePrice: Math.round(baseRace.xenotypePrices[xenotype]),
                            isXenotype: true,
                            parentRace: baseRace.name
                        });
                    }
                });
            }
        });
        return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
    }

    processModsData(modsRoot) {
        if (!modsRoot || !modsRoot.mods) return [];
        return modsRoot.mods.map(mod => ({
            name: mod.name || "Unnamed Mod",
            author: mod.author || "Unknown",
            steamId: mod.steamId || null,
            version: mod.version || "—",
            exportedAt: modsRoot.exportedAt || null
        }));
    }

    processTraitDescription(description) {
        return description
            .replace(/{PAWN_nameDef}/g, 'Timmy')
            .replace(/{PAWN_name}/g, 'Timmy')
            .replace(/{PAWN_pronoun}/g, 'he')
            .replace(/{PAWN_possessive}/g, 'his')
            .replace(/{PAWN_objective}/g, 'him')
            .replace(/{PAWN_label}/g, 'Timmy')
            .replace(/{PAWN_def}/g, 'Timmy')
            .replace(/\[PAWN_nameDef\]/g, 'Timmy')
            .replace(/\[PAWN_name\]/g, 'Timmy')
            .replace(/\[PAWN_pronoun\]/g, 'he')
            .replace(/\[PAWN_possessive\]/g, 'his')
            .replace(/\[PAWN_objective\]/g, 'him')
            .replace(/\[PAWN_label\]/g, 'Timmy')
            .replace(/\[PAWN_def\]/g, 'Timmy');
    }

    // ══════════════════════════════════════════════
    //  RENDERING
    // ══════════════════════════════════════════════
    renderAllTabs() {
        this.renderItems();
        this.renderEvents();
        this.renderWeather();
        this.renderTraits();
        this.renderRaces();
        this.renderMods();
    }

    renderItems() {
        const tbody = document.getElementById('items-tbody');
        if (!tbody) return;
        const items = this.filteredData.items;
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);font-family:\'Share Tech Mono\',monospace;">No items found</td></tr>';
            return;
        }
        tbody.innerHTML = items.map(item => `
            <tr>
                <td>
                    <div class="item-name">${this.escapeHtml(item.name)}</div>
                    <span class="metadata">
                        ${this.safeEscape(item.defName)}<br>
                        From ${this.safeEscape(this.getModDisplayName(item.mod))}<br>
                        Usage: !buy ${this.safeEscape(item.name)} or !buy ${this.safeEscape(item.defName)}
                        ${this.getUsageTypes(item)}
                    </span>
                </td>
                <td class="no-wrap"><strong>${item.price}</strong></td>
                <td>${this.safeEscape(item.category)}</td>
                <td class="no-wrap">${item.quantityLimit}</td>
            </tr>
        `).join('');
    }

    renderEvents() {
        const tbody = document.getElementById('events-tbody');
        if (!tbody) return;
        const events = this.filteredData.events;
        if (events.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-muted);">No events found</td></tr>';
            return;
        }
        tbody.innerHTML = events.map(event => {
            const coloredLabel = this.convertRimWorldColors(event.label);
            const karmaClass = this.getKarmaClass(event.karmaType);
            return `<tr>
                <td>
                    <div class="item-name">${coloredLabel}</div>
                    <span class="metadata">
                        ${this.safeEscape(event.defName)}<br>
                        From ${this.safeEscape(event.modSource)}<br>
                        Usage: !event ${this.safeEscape(event.label)} or !event ${this.safeEscape(event.defName)}
                    </span>
                </td>
                <td class="no-wrap"><strong>${event.baseCost}</strong></td>
                <td><span class="karma-badge ${karmaClass}">${this.getKarmaIcon(event.karmaType)} ${this.safeEscape(event.karmaType)}</span></td>
            </tr>`;
        }).join('');
    }

    renderWeather() {
        const tbody = document.getElementById('weather-tbody');
        if (!tbody) return;
        const weather = this.filteredData.weather;
        if (weather.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">No weather found</td></tr>';
            return;
        }
        tbody.innerHTML = weather.map(w => {
            const colored = this.convertRimWorldColors(w.label);
            const karmaClass = this.getKarmaClass(w.karmaType);
            return `<tr>
                <td>
                    <div class="item-name">${colored}</div>
                    <span class="metadata">
                        ${this.safeEscape(w.defName)}<br>
                        From ${this.safeEscape(w.modSource)}<br>
                        Usage: !weather ${this.safeEscape(w.label)} or !weather ${this.safeEscape(w.defName)}
                    </span>
                </td>
                <td class="no-wrap"><strong>${w.baseCost}</strong></td>
                <td><span class="karma-badge ${karmaClass}">${this.getKarmaIcon(w.karmaType)} ${this.safeEscape(w.karmaType)}</span></td>
                <td>${w.description ? `<div class="trait-description">${this.convertRimWorldColors(w.description)}</div>` : '<span style="color:var(--text-muted)">No description</span>'}</td>
            </tr>`;
        }).join('');
    }

    renderTraits() {
        const tbody = document.getElementById('traits-tbody');
        if (!tbody) return;
        const traits = this.filteredData.traits;
        if (traits.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">No traits found</td></tr>';
            return;
        }
        tbody.innerHTML = traits.map(trait => {
            const coloredName = this.convertRimWorldColors(trait.name);
            return `
            <tr>
                <td>
                    <div class="item-name">${coloredName}</div>
                    <span class="metadata">
                        ${this.safeEscape(trait.defName)}
                        <br>From ${this.safeEscape(trait.modSource)}
                        ${trait.bypassLimit ? '<br><span class="usage">Bypasses Limit</span>' : ''}
                    </span>
                </td>
                <td class="no-wrap">
                    ${trait.canAdd ? `<strong>${trait.addPrice}</strong>` : '<span class="metadata">Cannot Add</span>'}
                </td>
                <td class="no-wrap">
                    ${trait.canRemove
                        ? `<strong style="color:var(--neon-pink);text-shadow:0 0 6px rgba(255,45,120,.3)">${trait.removePrice}</strong>`
                        : '<span class="metadata">Cannot Remove</span>'}
                </td>
                <td>
                    <div class="trait-description">${this.convertRimWorldColors(trait.description)}</div>
                    ${this.renderTraitStats(trait)}
                    ${this.renderTraitConflicts(trait)}
                </td>
            </tr>`;
        }).join('');
    }

    renderTraitStats(trait) {
        if (!trait.stats?.length) return '';
        return `<div class="metadata" style="margin-top:8px;">
            <strong style="color:var(--neon-cyan);text-shadow:none;font-size:.8rem;">Stats:</strong>
            <ul style="margin:5px 0;padding-left:20px;list-style:none;">
                ${trait.stats.map(s => `<li style="padding:2px 0;">▸ ${this.convertRimWorldColors(s)}</li>`).join('')}
            </ul>
        </div>`;
    }

    renderTraitConflicts(trait) {
        if (!trait.conflicts?.length) return '';
        return `<div class="metadata" style="margin-top:6px;">
            <strong style="color:var(--neon-pink);text-shadow:none;font-size:.8rem;">Conflicts with:</strong>
            <ul style="margin:5px 0;padding-left:20px;list-style:none;">
                ${trait.conflicts.map(c => `<li style="padding:2px 0;">✕ ${this.convertRimWorldColors(c)}</li>`).join('')}
            </ul>
        </div>`;
    }

    renderRaces() {
        const container = document.getElementById('races-container');
        if (!container) return;
        const races = this.filteredData.races;
        if (races.length === 0) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);font-family:\'Share Tech Mono\',monospace;">No races found</div>';
            return;
        }

        let html = '';
        races.forEach(race => {
            const genders = this.getAvailableGenders(race.allowedGenders);
            const ageRange = `Age: ${race.minAge}–${race.maxAge === 999999 ? '∞' : race.maxAge}`;

            html += `
                <details class="race-group">
                    <summary>
                        <strong>${this.safeEscape(race.name)}</strong>
                        — Price: <strong style="color:var(--neon-green);font-family:'Orbitron',monospace;text-shadow:0 0 6px rgba(0,255,163,.3)">${race.basePrice}</strong>
                        • ${ageRange}
                        ${genders ? ` • Genders: ${genders}` : ''}
                        ${race.allowCustomXenotypes ? ' • <span class="usage">Custom xenotypes</span>' : ''}
                        ${race.xenotypes.length ? ` (${race.xenotypes.length} xenotypes)` : ''}
                    </summary>
                    <div class="xenotype-list">`;

            if (race.xenotypes.length === 0) {
                html += `<div style="padding:14px 20px;color:var(--text-muted);font-family:'Share Tech Mono',monospace;font-size:.88rem;">No xenotypes available for this race.</div>`;
            } else {
                race.xenotypes.forEach(xeno => {
                    html += `
                        <div class="xenotype-item">
                            <div>
                                <strong>${this.safeEscape(xeno.name)}</strong>
                                <span style="color:var(--text-muted);font-size:.85em;margin-left:6px;">(${this.safeEscape(xeno.defName)})</span>
                            </div>
                            <div class="xeno-price">${xeno.basePrice}</div>
                        </div>`;
                });
            }

            html += `</div></details>`;
        });

        container.innerHTML = html;
    }

    renderMods() {
        const tbody = document.getElementById('mods-tbody');
        if (!tbody) return;
        const mods = this.filteredData.mods;
        if (mods.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">No mods exported yet (or ActiveMods.json missing)</td></tr>';
            return;
        }
        tbody.innerHTML = mods.map(mod => {
            let steamLink = '<span style="color:var(--text-muted)">—</span>';
            if (mod.steamId) {
                steamLink = `<a href="https://steamcommunity.com/sharedfiles/filedetails/?id=${mod.steamId}"
                               target="_blank" rel="noopener" class="steam-link">
                               🔗 Workshop
                             </a>`;
            }
            return `
                <tr>
                    <td><div class="item-name">${this.safeEscape(mod.name)}</div></td>
                    <td>${this.safeEscape(mod.author)}</td>
                    <td class="no-wrap"><span class="version-badge" style="font-size:.78rem">${this.safeEscape(mod.version)}</span></td>
                    <td>${steamLink}</td>
                </tr>`;
        }).join('');
    }

    // ══════════════════════════════════════════════
    //  HEADER STATS & TAB COUNTS
    // ══════════════════════════════════════════════
    updateHeaderStats() {
        const el = document.getElementById('header-stats');
        if (!el) return;
        const total = this.data.items.length + this.data.events.length +
                      this.data.weather.length + this.data.traits.length +
                      this.data.races.length;

        el.innerHTML = [
            { label: 'Items',   value: this.data.items.length   },
            { label: 'Events',  value: this.data.events.length  },
            { label: 'Traits',  value: this.data.traits.length  },
            { label: 'Races',   value: this.data.races.length   },
            { label: 'Total',   value: total                    },
            { label: 'Mods',    value: this.data.mods.length    }
        ].map(s => `
            <div class="stat-item">
                <span class="stat-value">${s.value}</span>
                <span class="stat-label">${s.label}</span>
            </div>
        `).join('');
    }

    updateTabCounts() {
        const map = {
            items:   this.data.items.length,
            events:  this.data.events.length,
            weather: this.data.weather.length,
            traits:  this.data.traits.length,
            races:   this.data.races.length,
            mods:    this.data.mods.length
        };
        Object.entries(map).forEach(([key, val]) => {
            const el = document.getElementById(`count-${key}`);
            if (el) el.textContent = val;
        });
    }

    // ══════════════════════════════════════════════
    //  FILTER CHIPS
    // ══════════════════════════════════════════════
    buildFilterChips() {
        // Config: which tabs get filter chips + which field to group by
        const configs = [
            { tab: 'items',   field: 'category',  containerId: 'items-filters'   },
            { tab: 'events',  field: 'karmaType', containerId: 'events-filters'  },
            { tab: 'weather', field: 'karmaType', containerId: 'weather-filters' },
            { tab: 'traits',  field: 'modSource', containerId: 'traits-filters'  }
        ];

        configs.forEach(cfg => {
            const container = document.getElementById(cfg.containerId);
            if (!container) return;

            // Count entries per category
            const counts = {};
            this.data[cfg.tab].forEach(entry => {
                const val = entry[cfg.field] || 'Other';
                counts[val] = (counts[val] || 0) + 1;
            });

            // Sort alphabetically
            const sortedCategories = Object.keys(counts).sort((a, b) => a.localeCompare(b));

            const totalCount = this.data[cfg.tab].length;
            const activeFilter = this.activeFilters[cfg.tab] || 'all';

            // Build HTML
            let html = `
                <button class="filter-chip ${activeFilter === 'all' ? 'active' : ''}"
                        data-filter="all">
                    ${this.getCategoryIcon('all')} All
                    <span class="chip-count">${totalCount}</span>
                </button>
            `;

            sortedCategories.forEach(cat => {
                const isActive = activeFilter === cat;
                html += `
                    <button class="filter-chip ${isActive ? 'active' : ''}"
                            data-filter="${this.safeEscape(cat)}">
                        ${this.getCategoryIcon(cat)} ${this.safeEscape(cat)}
                        <span class="chip-count">${counts[cat]}</span>
                    </button>
                `;
            });

            container.innerHTML = html;

            // Bind clicks
            container.querySelectorAll('.filter-chip').forEach(chip => {
                chip.addEventListener('click', () => {
                    this.activeFilters[cfg.tab] = chip.dataset.filter;
                    container.querySelectorAll('.filter-chip').forEach(c =>
                        c.classList.remove('active')
                    );
                    chip.classList.add('active');
                    this.applyFilters(cfg.tab);
                });
            });
        });
    }

    // ══════════════════════════════════════════════
    //  CATEGORY ICONS
    // ══════════════════════════════════════════════
    getCategoryIcon(category) {
        if (!category) return '📁';
        const c = category.toLowerCase();
        const icons = {
            'all':         '⚡',
            'weapons':     '⚔️',
            'weapon':      '⚔️',
            'apparel':     '🧥',
            'clothing':    '👕',
            'armor':       '🛡️',
            'medicine':    '💊',
            'medical':     '🩺',
            'food':        '🍖',
            'meals':       '🍽️',
            'drugs':       '💊',
            'books':       '📚',
            'book':        '📖',
            'resources':   '🪨',
            'materials':   '🧱',
            'building':    '🏗️',
            'furniture':   '🛋️',
            'tech':        '💻',
            'technology':  '🔧',
            'plants':      '🌱',
            'animals':     '🐺',
            'misc':        '📦',
            'other':       '📁',
            'ammo':        '🎯',
            'grenades':    '💣',
            'melee':       '🗡️',
            'ranged':      '🔫',
            'utility':     '🔨',
            'consumables': '🧪',
            'good karma':  '😇',
            'bad karma':   '😈',
            'doom':        '💀',
            'neutral':     '⚖️',
            'none':        '➖',
            'core':        '⭐'
        };
        if (icons[c]) return icons[c];
        for (const [k, v] of Object.entries(icons)) {
            if (c.includes(k)) return v;
        }
        return '📁';
    }

    // ══════════════════════════════════════════════
    //  APPLY COMBINED FILTERS (search + chip)
    // ══════════════════════════════════════════════
    applyFilters(tabName) {
        const all = this.data[tabName] || [];
        const search = (this.searchTerms[tabName] || '').toLowerCase().trim();
        const activeFilter = this.activeFilters[tabName] || 'all';

        const categoryField = {
            items:   'category',
            events:  'karmaType',
            weather: 'karmaType',
            traits:  'modSource'
        }[tabName];

        this.filteredData[tabName] = all.filter(item => {
            // Chip filter
            if (activeFilter !== 'all' && categoryField) {
                const val = item[categoryField] || 'Other';
                if (val !== activeFilter) return false;
            }

            // Search filter
            if (search) {
                const text = [
                    item.name, item.label, item.defName, item.description,
                    item.category, item.karmaType, item.modSource, item.mod,
                    ...(Array.isArray(item.stats) ? item.stats : []),
                    ...(Array.isArray(item.conflicts) ? item.conflicts : []),
                    item.author || ''
                ].join(' ').toLowerCase();
                if (!text.includes(search)) return false;
            }

            return true;
        });

        // Re-render
        const renderName = `render${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
        if (typeof this[renderName] === 'function') {
            this[renderName]();
        }
    }

    // ══════════════════════════════════════════════
    //  HELPERS
    // ══════════════════════════════════════════════
    getUsageTypes(item) {
        const types = [];
        if (item.isUsable)     types.push('Usable');
        if (item.isEquippable) types.push('Equippable');
        if (item.isWearable)   types.push('Wearable');
        return types.length
            ? `<br><span class="usage">${types.join(', ')}</span>`
            : '';
    }

    getAvailableGenders(g) {
        if (!g) return '';
        const arr = [];
        if (g.AllowMale)   arr.push('M');
        if (g.AllowFemale) arr.push('F');
        if (g.AllowOther)  arr.push('O');
        return arr.join(' ');
    }

    getModDisplayName(mod) {
        return mod === 'Core' ? 'RimWorld' : (mod || 'Unknown');
    }

    getKarmaClass(karmaType) {
        if (!karmaType) return 'neutral';
        const k = karmaType.toLowerCase();
        if (k.includes('good') || k.includes('positive')) return 'good';
        if (k.includes('bad')  || k.includes('negative')) return 'bad';
        if (k.includes('doom') || k.includes('extreme'))  return 'doom';
        return 'neutral';
    }

    getKarmaIcon(karmaType) {
        const cls = this.getKarmaClass(karmaType);
        switch (cls) {
            case 'good': return '😇';
            case 'bad':  return '😈';
            case 'doom': return '💀';
            default:     return '⚖️';
        }
    }

    // Safe escape (no HTML processing)
    safeEscape(unsafe) {
        if (typeof unsafe !== 'string') return unsafe || '';
        const div = document.createElement('div');
        div.textContent = unsafe;
        return div.innerHTML;
    }

    // Escape with RimWorld color processing
    escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe || '';
        return this.convertRimWorldColors(unsafe);
    }

    // ══════════════════════════════════════════════
    //  EVENT LISTENERS
    // ══════════════════════════════════════════════
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Search per tab
        ['items', 'events', 'weather', 'traits', 'races', 'mods'].forEach(tab =>
            this.setupSearch(tab)
        );

        // Sorting
        this.setupSorting();
    }

    setupSearch(tabName) {
        const input = document.getElementById(`${tabName}-search`);
        if (!input) return;
        let debounce;
        input.addEventListener('input', e => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                this.searchTerms[tabName] = e.target.value;
                // For tabs with chips, use combined filter
                if (['items', 'events', 'weather', 'traits'].includes(tabName)) {
                    this.applyFilters(tabName);
                } else {
                    // For races/mods, simple search
                    this.filterTabSimple(tabName, e.target.value);
                }
            }, 180);
        });
    }

    filterTabSimple(tabName, searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const all = this.data[tabName] || [];
        if (!term) {
            this.filteredData[tabName] = [...all];
        } else {
            this.filteredData[tabName] = all.filter(item => {
                const text = [
                    item.name, item.label, item.defName, item.description,
                    item.category, item.karmaType, item.modSource,
                    ...(Array.isArray(item.stats) ? item.stats : []),
                    ...(Array.isArray(item.conflicts) ? item.conflicts : []),
                    item.author || ''
                ].join(' ').toLowerCase();
                return text.includes(term);
            });
        }
        const renderName = `render${tabName.charAt(0).toUpperCase() + tabName.slice(1)}`;
        if (typeof this[renderName] === 'function') {
            this[renderName]();
        }
    }

    setupSorting() {
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.addEventListener('click', () => {
                const tab = header.closest('.tab-pane')?.id;
                if (!tab) return;
                const field = header.dataset.sort;

                // Toggle direction
                if (!this.currentSort[tab]) {
                    this.currentSort[tab] = { field, direction: 'asc' };
                } else if (this.currentSort[tab].field === field) {
                    this.currentSort[tab].direction =
                        this.currentSort[tab].direction === 'asc' ? 'desc' : 'asc';
                } else {
                    this.currentSort[tab] = { field, direction: 'asc' };
                }

                // Update sort indicator classes
                const table = header.closest('table');
                table.querySelectorAll('th').forEach(t =>
                    t.classList.remove('sort-asc', 'sort-desc')
                );
                header.classList.add(
                    this.currentSort[tab].direction === 'asc' ? 'sort-asc' : 'sort-desc'
                );

                // Sort data
                this.filteredData[tab].sort((a, b) => {
                    let va = a[field], vb = b[field];
                    if (field === 'quantityLimit') {
                        va = va === 'Unlimited' ? Infinity : va;
                        vb = vb === 'Unlimited' ? Infinity : vb;
                    }
                    if (typeof va === 'number' && typeof vb === 'number') {
                        return this.currentSort[tab].direction === 'asc' ? va - vb : vb - va;
                    }
                    if (typeof va === 'string') va = va.toLowerCase();
                    if (typeof vb === 'string') vb = vb.toLowerCase();
                    if (va < vb) return this.currentSort[tab].direction === 'asc' ? -1 : 1;
                    if (va > vb) return this.currentSort[tab].direction === 'asc' ? 1 : -1;
                    return 0;
                });

                // Re-render
                const renderName = `render${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
                if (typeof this[renderName] === 'function') {
                    this[renderName]();
                }
            });
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(tabName);
        if (pane) pane.classList.add('active');
    }
}

// ═══ INIT ═══
document.addEventListener('DOMContentLoaded', () => new RICSStore());