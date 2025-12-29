class NoitaWebScanner {
    constructor() {
        this.summary = this.initSummary();
        this.raw = {
            playtimes: [],
            golds: [],
            goldsSpent: [],
            kills: [],
            sideBiomes: [],
            sessionsData: [],
            seedsSet: new Set()
        };
    }

    initSummary() {
        return {
            year: new Date().getFullYear(),
            total_sessions: 0,
            total_playtime_s: 0,
            total_gold_collected: 0,
            total_gold_spent: 0,
            total_enemies_killed: 0,
            total_pollen_killed: 0,
            session_types: { victory: 0, death: 0, unfinished: 0, test_run: 0 },
            death_causes: {},
            all_death_causes: {},
            biomes_visited: {},
            enemies_killed_breakdown: {},
            time_distribution: { hourly: new Array(24).fill(0), monthly: new Array(12).fill(0) },
            records: {
                longest_session: { timestamp: "", playtime: 0 },
                shortest_session: { timestamp: "", playtime: 999999 },
                late_night_owl: { timestamp: "", time_str: "", val: 0 },
                most_active_day: { date: "", count: 0 },
                richest_run: { timestamp: "", gold: 0 },
                most_extravagant_run: { timestamp: "", spent: 0 },
                bloodiest_run: { timestamp: "", kills: 0 },
                nemesis: { name: "", count: 0 },
                max_win_streak: 0,
                max_loss_streak: 0
            },
            daily_activity: {},
            behavioral: { total_kicks: 0, total_teleports: 0, total_wands_edited: 0, total_projectiles_shot: 0 },
            suffering: { total_damage_taken: 0, total_healed: 0 },
            progression: { total_items_picked_up: 0, unique_seeds: 0, gold_infinite_runs: 0, no_wand_runs: 0, peak_exploration: 0 },
            death_groups: {},
            death_locations: [],
            fatal_spots: {},
            badges: [],
            radar_stats: {}
        };
    }

    async scanDirectory(dirHandle, onProgress, selectedYear = "all") {
        this.summary.year = selectedYear === "all" ? "全时期" : parseInt(selectedYear);
        let statsFiles = [];
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('_stats.xml')) {
                const fYear = entry.name.substring(0, 4);
                if (selectedYear === "all" || fYear === String(selectedYear)) {
                    statsFiles.push(entry);
                }
            }
        }

        const total = statsFiles.length;
        let processed = 0;
        const batchSize = 100; // 提高并行批处理大小

        for (let i = 0; i < statsFiles.length; i += batchSize) {
            const batch = statsFiles.slice(i, i + batchSize);
            await Promise.all(batch.map(async (fileHandle) => {
                const timestamp = fileHandle.name.replace('_stats.xml', '');
                const file = await fileHandle.getFile();
                const text = await file.text();

                let killsText = "";
                try {
                    const killsHandle = await dirHandle.getFileHandle(`${timestamp}_kills.xml`);
                    const killsFile = await killsHandle.getFile();
                    killsText = await killsFile.text();
                } catch (e) { }

                await this.parseSession(timestamp, text, killsText);
                processed++;
                if (onProgress) onProgress(processed, total);
            }));
        }

        this.calculateDeepStats();
        this.calculateBadges();
        this.calculateRadarStats();
        return this.getReport();
    }

    async preScanYears(dirHandle) {
        const yearCounts = {};
        for await (const entry of dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('_stats.xml')) {
                const y = entry.name.substring(0, 4);
                if (/^\d{4}$/.test(y)) yearCounts[y] = (yearCounts[y] || 0) + 1;
            }
        }
        return yearCounts;
    }

    async parseSession(timestamp, statsXml, killsXml) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(statsXml, "text/xml");
        const statsElem = doc.querySelector("stats");
        if (!statsElem) return;

        const s = statsElem.attributes;
        const getAttr = (name, def = 0) => s.getNamedItem(name) ? s.getNamedItem(name).value : def;
        const safeFloat = (val) => {
            if (!val || String(val).includes("INF")) return 1e15; // 封顶，防止超出 JS 安全范围
            let f = parseFloat(val) || 0;
            return Math.min(f, 1e15); // 限制在安全范围内
        };

        const data = {
            playtime: safeFloat(getAttr("playtime")),
            gold_all: parseInt(getAttr("gold_all")),
            gold_rem: parseInt(getAttr("gold")),
            enemies_killed: parseInt(getAttr("enemies_killed")),
            dead: getAttr("dead") === "1",
            killed_by: this.normalizeDeathCause(getAttr("killed_by")),
            death_pos: { x: safeFloat(getAttr("death_pos.x")), y: safeFloat(getAttr("death_pos.y")) },
            kicks: parseInt(getAttr("kicks")),
            teleports: parseInt(getAttr("teleports")),
            wands_edited: parseInt(getAttr("wands_edited")),
            projectiles_shot: parseInt(getAttr("projectiles_shot")),
            damage_taken: safeFloat(getAttr("damage_taken")),
            healed: safeFloat(getAttr("healed")),
            hp_max: safeFloat(getAttr("hp")),
            items_picked: parseInt(getAttr("items")),
            gold_infinite: getAttr("gold_infinite") === "1",
            world_seed: getAttr("world_seed"),
            biomes_with_wands: parseInt(getAttr("biomes_visited_with_wands")),
            places_visited: parseInt(getAttr("places_visited"))
        };
        data.gold_spent = data.gold_all - data.gold_rem;

        const biomesVisited = Array.from(doc.querySelectorAll("biomes_visited E")).map(e => e.getAttribute("key").replace("$biome_", ""));
        data.biomes = biomesVisited;

        const mainline = ["coalmine", "excavationsite", "snowcave", "snowcastle", "rainforest", "rainforest_open", "vault", "crypt", "boss_arena", "holymountain", "boss_victoryroom"];
        data.side_biomes_count = biomesVisited.filter(b => !mainline.includes(b)).length;

        // Determination
        const isNearBoss = Math.abs(data.death_pos.x - 6419) < 1000 && Math.abs(data.death_pos.y - 15106) < 1000;
        const isNearAltar = Math.abs(data.death_pos.x - 787) < 500 && Math.abs(data.death_pos.y - (-1136)) < 500;
        const hasDeep = biomesVisited.some(b => ["crypt", "vault", "boss_arena", "rainforest"].includes(b));

        data.is_victory = biomesVisited.includes("boss_victoryroom") || data.killed_by === "点金" || (data.dead && isNearBoss) || (data.dead && isNearAltar && hasDeep);
        data.is_death = !data.is_victory && data.dead;
        data.is_test_run = !data.is_victory && !data.is_death && data.playtime < 120 && data.enemies_killed < 5;
        data.is_unfinished = !data.is_victory && !data.is_death && !data.is_test_run;

        // Global Aggregation
        const sum = this.summary;
        sum.total_sessions++;
        sum.total_playtime_s += data.playtime;
        sum.total_gold_collected += data.gold_all;
        sum.total_gold_spent += data.gold_spent;
        sum.total_enemies_killed += data.enemies_killed;

        sum.behavioral.total_kicks += data.kicks;
        sum.behavioral.total_teleports += data.teleports;
        sum.behavioral.total_wands_edited += data.wands_edited;
        sum.behavioral.total_projectiles_shot += data.projectiles_shot;

        sum.suffering.total_damage_taken += data.damage_taken;
        sum.suffering.total_healed += data.healed;

        sum.progression.total_items_picked_up += data.items_picked;
        sum.progression.peak_exploration = Math.max(sum.progression.peak_exploration, data.places_visited);
        if (data.gold_infinite) sum.progression.gold_infinite_runs++;
        if (data.world_seed) this.raw.seedsSet.add(data.world_seed);
        if (data.is_victory && data.biomes_with_wands === 0) sum.progression.no_wand_runs++;

        // Time
        try {
            const datePart = timestamp.split('-')[0];
            const year = datePart.substring(0, 4);
            const month = parseInt(datePart.substring(4, 6));
            const day = parseInt(datePart.substring(6, 8));
            const timePart = timestamp.split('-')[1];
            const hour = parseInt(timePart.substring(0, 2));
            const min = parseInt(timePart.substring(2, 4));

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (year === String(this.summary.year) || this.summary.year === "全时期") {
                sum.time_distribution.hourly[hour]++;
                sum.time_distribution.monthly[month - 1]++;
                sum.daily_activity[dateStr] = (sum.daily_activity[dateStr] || 0) + 1;

                if (hour >= 0 && hour < 5) {
                    const val = hour * 60 + min;
                    if (val > sum.records.late_night_owl.val) {
                        sum.records.late_night_owl = { timestamp, time_str: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, date: dateStr, val };
                    }
                }
            }
        } catch (e) { }

        // Type
        let typeStr = "unfinished";
        if (data.is_victory) { sum.session_types.victory++; typeStr = "victory"; }
        else if (data.is_test_run) { sum.session_types.test_run++; typeStr = "test"; }
        else if (data.is_death) {
            sum.session_types.death++; typeStr = "death";
            sum.death_locations.push([Math.round(data.death_pos.x * 10) / 10, Math.round(data.death_pos.y * 10) / 10]);
            const spot = `${Math.floor(data.death_pos.x / 500)},${Math.floor(data.death_pos.y / 500)}`;
            sum.fatal_spots[spot] = (sum.fatal_spots[spot] || 0) + 1;
        }

        if (data.is_victory || data.is_death) {
            sum.all_death_causes[data.killed_by] = (sum.all_death_causes[data.killed_by] || 0) + 1;
            if (data.is_death) sum.death_causes[data.killed_by] = (sum.death_causes[data.killed_by] || 0) + 1;

            let cat = "敌人";
            const envs = ["酸液", "岩浆", "诅咒", "冻伤", "变形", "恒星坍缩", "毒素", "火焰", "窒息", "雷电", "爆炸"];
            if (data.is_victory) cat = "胜利";
            else if (data.killed_by === "自身失误") cat = "艺术(自爆)";
            else if (envs.includes(data.killed_by)) cat = "环境/陷阱";
            sum.death_groups[cat] = (sum.death_groups[cat] || 0) + 1;
        }

        data.biomes.forEach(b => sum.biomes_visited[b] = (sum.biomes_visited[b] || 0) + 1);

        // Medians Raw
        if ((data.is_victory || data.is_death) && data.playtime >= 120) {
            this.raw.playtimes.push(data.playtime);
            this.raw.golds.push(data.gold_all);
            this.raw.goldsSpent.push(data.gold_spent);
            this.raw.kills.push(data.enemies_killed);
            this.raw.sideBiomes.push(data.side_biomes_count);
        }

        // Records
        if (data.playtime > sum.records.longest_session.playtime) sum.records.longest_session = { timestamp, playtime: data.playtime };
        if (data.playtime > 60 && data.playtime < sum.records.shortest_session.playtime && !data.is_test_run) sum.records.shortest_session = { timestamp, playtime: data.playtime };
        if (data.gold_all > sum.records.richest_run.gold) sum.records.richest_run = { timestamp, gold: data.gold_all };
        if (data.gold_spent > sum.records.most_extravagant_run.spent) sum.records.most_extravagant_run = { timestamp, spent: data.gold_spent };
        if (data.enemies_killed > sum.records.bloodiest_run.kills) sum.records.bloodiest_run = { timestamp, kills: data.enemies_killed };

        this.raw.sessionsData.push({ type: typeStr, ts: timestamp });

        // Kills Map
        if (killsXml) {
            const kDoc = parser.parseFromString(killsXml, "text/xml");
            Array.from(kDoc.querySelectorAll("kill_map E")).forEach(e => {
                const key = e.getAttribute("key");
                const val = parseInt(e.getAttribute("value"));
                if (key === "pollen") {
                    sum.total_pollen_killed += val;
                }
                sum.enemies_killed_breakdown[key] = (sum.enemies_killed_breakdown[key] || 0) + val;
            });
        }
    }

    normalizeDeathCause(cause) {
        if (!cause) return "\"\"";
        if (/迈达斯|Midas|点金|ミダス/.test(cause)) return "点金";
        if (/酸液|Acid/.test(cause)) return "酸液";
        if (/岩浆|Lava/.test(cause)) return "岩浆";
        if (/诅咒|Curse/.test(cause)) return "诅咒";
        if (/冰冷|Cold/.test(cause)) return "冻伤";
        if (/变形|Polymorph/.test(cause)) return "变形";
        if (/太阳|Sun|超新星/.test(cause)) return "恒星坍缩";
        if (/毒|Toxic/.test(cause)) return "毒素";
        if (/我自己|米纳|Minä/.test(cause)) return "自身失误";
        if (/爆炸|Explosion/.test(cause)) return "爆炸";
        if (/雷电|Electricity/.test(cause)) return "雷电";
        if (/火焰|Fire/.test(cause)) return "火焰";
        if (/窒息|Suffocation/.test(cause)) return "窒息";
        return cause;
    }

    calculateDeepStats() {
        const getMedian = (arr) => {
            if (!arr.length) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        };

        this.summary.medians = {
            playtime: getMedian(this.raw.playtimes),
            gold: getMedian(this.raw.golds),
            gold_spent: getMedian(this.raw.goldsSpent),
            kills: getMedian(this.raw.kills),
            side_biomes: getMedian(this.raw.sideBiomes)
        };

        let maxWin = 0, maxLoss = 0, currWin = 0, currLoss = 0;
        this.raw.sessionsData.forEach(s => {
            if (s.type === "victory") { currWin++; currLoss = 0; }
            else if (s.type === "death") { currLoss++; currWin = 0; }
            maxWin = Math.max(maxWin, currWin);
            maxLoss = Math.max(maxLoss, currLoss);
        });
        this.summary.records.max_win_streak = maxWin;
        this.summary.records.max_loss_streak = maxLoss;

        const potential = { ...this.summary.death_causes };
        delete potential["\"\""]; delete potential["点金"]; delete potential["自身失误"];
        const topNemesis = Object.entries(potential).sort((a, b) => b[1] - a[1])[0];
        this.summary.records.nemesis = topNemesis ? { name: topNemesis[0], count: topNemesis[1] } : { name: "无", count: 0 };
    }

    calculateBadges() {
        const s = this.summary;
        const badges = [];
        if (s.total_sessions >= 200) badges.push({ icon: "🧙‍♂️", name: "大炼金术师", desc: "200+次轮回的试炼" });
        if (s.records.longest_session.playtime > 10800) badges.push({ icon: "⌛", name: "坚毅之心", desc: "单局坚持3小时以上" });
        if (s.session_types.victory >= 10) badges.push({ icon: "👑", name: "大功业", desc: "10+次完成伟大之作" });
        if (s.behavioral.total_kicks > 1000) badges.push({ icon: "🦵", name: "黄金右脚", desc: "1000+次踢击，力大砖飞" });
        if (s.behavioral.total_wands_edited > 3000) badges.push({ icon: "🛠️", name: "精修匠人", desc: "3000+次法杖构筑" });
        
        // 神级成就
        const realKills = s.total_enemies_killed - s.total_pollen_killed;
        if (realKills >= 10000) badges.push({ icon: "💀", name: "杀戮之神", desc: "累计击杀(不含花粉)超过1万敌众" });
        if (s.records.richest_run.gold >= 1000000000) badges.push({ icon: "💰", name: "富可敌国", desc: "单局持有金币突破10亿" });
        if (s.records.max_win_streak >= 10) badges.push({ icon: "🔥", name: "不败传说", desc: "达成10次以上的恐怖连胜" });
        if (s.progression.peak_exploration >= 33) badges.push({ icon: "🌌", name: "世界吞噬者", desc: "单局探索超过33个区域" });
        if (s.behavioral.total_teleports >= 500) badges.push({ icon: "🌀", name: "虚空行者", desc: "累计瞬移次数超过500次" });
        
        this.summary.badges = badges;
    }

    calculateRadarStats() {
        const s = this.summary;
        const med = s.medians;
        this.summary.radar_stats = {
            "杀戮欲": Math.min(100, Math.floor((med.kills / 40) * 100)),
            "金钱控制": Math.min(100, Math.floor((Math.min(8000, med.gold) / 8000) * 40 + (Math.min(4000, med.gold_spent) / 4000) * 60)),
            "探索欲": Math.min(100, Math.floor((med.side_biomes / 6) * 100)),
            "存活率": Math.min(100, Math.floor(s.session_types.victory / Math.max(1, s.session_types.victory + s.session_types.death) * 100)),
            "肝度": Math.min(100, Math.floor((s.total_playtime_s / 360000) * 50 + (Object.keys(s.daily_activity).length / 60) * 50)),
            "博学": Math.min(100, Math.floor((Object.keys(s.biomes_visited).length / 30) * 100))
        };
    }

    getReport() {
        const r = JSON.parse(JSON.stringify(this.summary));
        r.progression.unique_seeds = this.raw.seedsSet.size;

        const top = (obj, n) => Object.fromEntries(Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n));
        r.death_causes = top(r.death_causes, 12);
        r.all_death_causes = top(r.all_death_causes, 12);
        r.biomes_visited = top(r.biomes_visited, 15);
        r.enemies_killed_breakdown = top(r.enemies_killed_breakdown, 30);
        r.fatal_spots = top(r.fatal_spots, 10);

        const activity = Object.entries(this.summary.daily_activity).sort((a, b) => b[1] - a[1]);
        if (activity.length) r.records.most_active_day = { date: activity[0][0], count: activity[0][1] };

        return r;
    }

    exportFullText(data) {
        let txt = `=== NOITA 年度终极真理档案 (${data.year}) ===\n`;
        txt += `生成时间: ${new Date().toLocaleString()}\n\n`;

        txt += `[核心统计]\n`;
        txt += `- 总轮回次数: ${data.total_sessions}\n`;
        txt += `- 总游玩时长: ${(data.total_playtime_s / 3600).toFixed(2)} 小时\n`;
        txt += `- 累计击杀: ${data.total_enemies_killed}\n`;
        txt += `- 累计金币收集: ${data.total_gold_collected}\n`;
        txt += `- 累计金币消费: ${data.total_gold_spent}\n`;
        txt += `- 胜/败/测试/未完成: ${data.session_types.victory}/${data.session_types.death}/${data.session_types.test_run}/${data.session_types.unfinished}\n\n`;

        txt += `[行为风格]\n`;
        txt += `- 踢击总数: ${data.behavioral.total_kicks}\n`;
        txt += `- 瞬移总数: ${data.behavioral.total_teleports}\n`;
        txt += `- 调校法杖: ${data.behavioral.total_wands_edited}\n`;
        txt += `- 射出咒语: ${data.behavioral.total_projectiles_shot}\n\n`;

        txt += `[最高纪录]\n`;
        txt += `- 最长单局: ${(data.records.longest_session.playtime / 60).toFixed(1)} 分钟\n`;
        txt += `- 暴富局金币: ${data.records.richest_run.gold}\n`;
        txt += `- 杀戮之最: ${data.records.bloodiest_run.kills} 击杀\n`;
        txt += `- 探索之最: ${data.progression.peak_exploration} 个地点\n`;
        txt += `- 最高连胜/连败: ${data.records.max_win_streak}/${data.records.max_loss_streak}\n\n`;

        txt += `[生存报告]\n`;
        txt += `- 累计承受伤害: ${Math.floor(data.suffering.total_damage_taken)}\n`;
        txt += `- 累计获得治疗: ${Math.floor(data.suffering.total_healed)}\n`;
        txt += `- 宿敌: ${data.records.nemesis.name} (击杀你 ${data.records.nemesis.count} 次)\n\n`;

        txt += `[详细击杀清单 (Top 50)]\n`;
        Object.entries(data.enemies_killed_breakdown).slice(0, 50).forEach(([name, count]) => {
            txt += `${name.padEnd(20)}: ${count}\n`;
        });

        txt += `\n[死亡原因统计]\n`;
        Object.entries(data.all_death_causes).forEach(([cause, count]) => {
            txt += `${cause.padEnd(20)}: ${count}\n`;
        });

        txt += `\n[足迹 (访问生物群落)]\n`;
        Object.entries(data.biomes_visited).forEach(([biome, count]) => {
            txt += `${biome.padEnd(20)}: ${count}\n`;
        });

        txt += `\n\n--- 真理并非被发现，而是被经历 ---`;
        return txt;
    }
}

// Controller Logic
const btn = document.getElementById('open-folder');
const progress = document.getElementById('progress-container');
const fill = document.getElementById('progress-fill');
const status = document.getElementById('status-text');

btn.addEventListener('click', async () => {
    try {
        const dirHandle = await window.showDirectoryPicker();
        btn.style.display = 'none';
        progress.style.display = 'block';
        status.innerText = "正在预扫描年份...";

        const scanner = new NoitaWebScanner();
        const yearCounts = await scanner.preScanYears(dirHandle);

        // 确保 2025 始终出现在选项中（即使没有数据也显示为 0）
        if (!yearCounts["2025"]) yearCounts["2025"] = 0;

        // Show year selector
        const yearSelector = document.getElementById('year-selector');
        const yearButtons = document.getElementById('year-buttons');
        yearSelector.style.display = 'block';
        yearButtons.innerHTML = "";
        status.innerText = "请选择统计年度";

        // 按年份倒序排列，2025 在最前
        const sortedYears = Object.entries(yearCounts).sort((a, b) => b[0] < b[0] ? 1 : -1);

        const createBtn = (year, count) => {
            const b = document.createElement('button');
            b.className = 'btn-secondary';
            b.style.fontSize = '0.9rem';
            b.style.padding = '8px 16px';
            b.innerHTML = `${year} <span style="opacity:0.6; font-size:0.7rem;">(${count} 次)</span>`;
            b.onclick = async () => {
                yearSelector.style.display = 'none';
                status.innerText = `正在初始化 ${year === "all" ? "全时期" : year} 统计任务...`;
                if (year !== "all") {
                    document.getElementById('main-title').innerText = `NOITA ${year}`;
                }

                const report = await scanner.scanDirectory(dirHandle, (p, t) => {
                    const pct = Math.floor((p / t) * 100);
                    fill.style.width = pct + '%';
                    status.innerText = `正在解析 ${p} / ${t}个文件... (${pct}%)`;
                }, year);

                // Switch to report view
                document.getElementById('landing-page').style.display = 'none';
                const reportView = document.getElementById('report-view');
                reportView.style.display = 'block';

                if (window.renderReport) {
                    window.renderReport(report);
                } else {
                    console.error("Report engine not loaded");
                    reportView.innerText = JSON.stringify(report, null, 2);
                }
            };
            return b;
        };

        // All years option
        const totalCount = Object.values(yearCounts).reduce((a, b) => a + b, 0);
        yearButtons.appendChild(createBtn("all", totalCount));

        sortedYears.forEach(([year, count]) => {
            yearButtons.appendChild(createBtn(year, count));
        });

    } catch (err) {
        console.error(err);
        if (err.name !== 'AbortError') {
            alert('读取文件夹失败，请确保使用 Chrome/Edge 浏览器并授予权限。');
            btn.style.display = 'block';
            progress.style.display = 'none';
        }
    }
});
