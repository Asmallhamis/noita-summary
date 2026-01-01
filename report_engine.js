window.renderReport = function (data) {
    const container = document.getElementById('report-view');
    container.innerHTML = `
        <div id="slides-container"></div>
        <div class="nav-controls">
            <button class="nav-btn-mini" onclick="window.prevSlide()">← 上一页</button>
            <div id="dots"></div>
            <button class="nav-btn-mini" onclick="window.nextSlide()">下一页 →</button>
        </div>
    `;

    const slidesContainer = document.getElementById('slides-container');
    const sections = [
        renderOverview(data),
        renderLegendaryRun(data),
        renderRadar(data),
        renderDailyHeatmap(data),
        renderDeathAnalysis(data),
        renderBehaviorStyle(data),
        renderEcology(data),
        renderSuffering(data),
        renderBadges(data),
        renderEnding(data)
    ];

    sections.forEach((content, i) => {
        const slide = document.createElement('div');
        slide.className = 'slide-full' + (i === 0 ? ' active' : '');
        slide.innerHTML = content;
        slidesContainer.appendChild(slide);
    });

    initNavigation();
    initCharts(data);
    initDownload(data);
    initPollenToggle(data);
};

// --- Sub-Renderers ---

function renderOverview(data) {
    const totalHours = (data.total_playtime_s / 3600).toFixed(1);
    const goldTotal = formatBigNumber(data.total_gold_collected);
    const infiniteRuns = data.progression.gold_infinite_runs;
    return `
        <div class="report-card">
            <h2>${data.year} 年度概览</h2>
            <div class="big-grid" style="grid-template-columns: repeat(3, 1fr);">
                <div class="mini-card">
                    <div class="stat-val">${data.total_sessions}</div>
                    <div class="stat-label">总轮回次数<span class="info-tip" data-tip="包含所有胜利、死亡、未完成和测试局">?</span></div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${totalHours}h</div>
                    <div class="stat-label">总游玩时长<span class="info-tip" data-tip="所有轮回累计的实时游戏时间">?</span></div>
                </div>
                <div class="mini-card">
                    <div class="stat-val" id="total-kills-val">${data.total_enemies_killed.toLocaleString()}</div>
                    <div class="stat-label">累计击杀<span class="info-tip" data-tip="杀戮的生灵总数">?</span></div>
                    <label style="font-size: 0.65rem; color: var(--text-dim); display: flex; align-items: center; gap: 4px; cursor: pointer; justify-content: center; margin-top: 10px; opacity: 0.8;">
                        <input type="checkbox" id="exclude-pollen" style="cursor: pointer; width: 12px; height: 12px;"> 排除花粉
                    </label>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${data.progression.total_items_picked_up.toLocaleString()}</div>
                    <div class="stat-label">收集物品总数<span class="info-tip" data-tip="items,全年捡起的法杖、药水等物品总计">?</span></div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${goldTotal}</div>
                    <div class="stat-label">累计金币收益<span class="info-tip" data-tip="全年所有轮回（非无限钱局）获得金币的总和">?</span></div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${infiniteRuns}</div>
                    <div class="stat-label">达成无限钱<span class="info-tip" data-tip="财力突破天际，金币显示为无限的局数">?</span></div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${data.progression.peak_exploration}</div>
                    <div class="stat-label">单局最高探索<span class="info-tip" data-tip="单局内抵达过的独特区域数量峰值">?</span></div>
                </div>
            </div>
        </div>
    `;
}

function renderLegendaryRun(data) {
    const run = data.records.legendary_run;
    if (!run) return `<div class="report-card"><h2>年度最运营局</h2><p>这一年你似乎还没有开始真正的冒险。</p></div>`;

    const playtimeMin = (run.playtime / 60).toFixed(1);
    const dateStr = run.timestamp.split('-')[0].replace(/(\d{4})(\d{2})(\d{2})/, '$1/$2/$3');
    const status = run.is_victory ? "胜利" : "陨落";
    const statusClass = run.is_victory ? "status-win" : "status-loss";

    return `
        <div class="report-card legendary-card">
            <div class="legendary-header">
                <span class="badge-gold">年度最运营局</span>
                <span class="run-date">${dateStr}</span>
            </div>
            
            <div class="legendary-main">
                <div class="legendary-items">
                    <div class="item-total-count">${run.items}</div>
                    <div class="item-label">拾获物品总数</div>
                    <p class="item-desc">法杖、药水、法术... 每一件都是真理的碎片</p>
                </div>
                
                <div class="legendary-details">
                    <div class="detail-row">
                        <span class="detail-label">持续时长</span>
                        <span class="detail-val">${playtimeMin} min</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">最终结局</span>
                        <span class="detail-val ${statusClass}">${status}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">累计击杀</span>
                        <span class="detail-val">${run.kills.toLocaleString()}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">搜刮金币</span>
                        <span class="detail-val">${formatBigNumber(run.gold)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">探索区域</span>
                        <span class="detail-val">${run.places}</span>
                    </div>
                </div>
            </div>

            <div class="legendary-footer">
                <p>死因: <span class="death-reason">${run.killed_by || "未知"}</span></p>
                <p class="seed-info">世界种子: <code>${run.seed}</code></p>
            </div>
        </div>
    `;
}

function renderRadar(data) {
    return `
        <div class="report-card">
            <h2>六维能力分布</h2>
            <div class="radar-layout">
                <div class="radar-canvas-container">
                    <canvas id="radarChart"></canvas>
                </div>
                <div class="formula-list">
                    <div class="formula-item"><strong>杀戮欲</strong><span>正式局(胜/败)击杀中位数 / 30</span></div>
                    <div class="formula-item"><strong>金钱控制</strong><span>中位数：总获得/7k(权重40%) + 总花费/3k(60%) (已默认排除变形死亡局)</span></div>
                    <div class="formula-item"><strong>探索欲</strong><span>场均进入非主线群落数 / 5 (真菌洞穴、坍塌矿场也计分)</span></div>
                    <div class="formula-item"><strong>存活率</strong><span>正式局胜率 (胜利次数 / 胜+败总局数)</span></div>
                    <div class="formula-item"><strong>肝度</strong><span>总时长/100h (权重50%) + 活跃天数/60天 (50%)</span></div>
                    <div class="formula-item"><strong>博学</strong><span>生物群落解锁率 (已发现群落数 / 30)</span></div>
                </div>
            </div>
        </div>
    `;
}

function renderDailyHeatmap(data) {
    return `
        <div class="report-card">
            <h2>时间里的炼金术</h2>
            <div style="height: 300px;">
                <canvas id="lineChart"></canvas>
            </div>
            <p style="margin-top: 40px; color: var(--text-dim);">最活跃的一天: <strong>${data.records.most_active_day.date}</strong> (做了 ${data.records.most_active_day.count} 次实验)</p>
        </div>
    `;
}

function renderDeathAnalysis(data) {
    return `
        <div class="report-card">
            <h2>因何而死</h2>
            <div class="big-grid" style="grid-template-columns: 1.2fr 1fr;">
                 <div>
                    <canvas id="deathPieChart"></canvas>
                 </div>
                 <div class="card" style="text-align: left; padding: 20px;">
                    <p class="stat-label">宿敌排行榜</p>
                    <div id="nemesis-list" style="margin-top: 20px;"></div>
                 </div>
            </div>
        </div>
    `;
}

function renderBehaviorStyle(data) {
    const b = data.behavioral;
    let styleTitle = "破坏狂：这一年你射出了百万枚弹药";
    if (b.total_wands_edited > b.total_projectiles_shot / 100) styleTitle = "构筑大师：比起开火，你更爱调校法杖";
    else if (b.total_kicks > 500) styleTitle = "战术达人：踢击是你最沉默的语言";

    return `
        <div class="report-card">
            <h2>行为风格</h2>
            <p class="subtitle" style="margin-top: -20px;">${styleTitle}</p>
            <div class="big-grid">
                <div class="mini-card"><div class="stat-val">${b.total_kicks.toLocaleString()}</div><div class="stat-label">踢击<span class="info-tip" data-tip="黄金右脚的艺术，包含踢物体和生物">?</span></div></div>
                <div class="mini-card"><div class="stat-val">${b.total_teleports.toLocaleString()}</div><div class="stat-label">瞬移<span class="info-tip" data-tip="使用传送法术或技能的次数（注：传送投射物可能不计入）">?</span></div></div>
                <div class="mini-card"><div class="stat-val">${b.total_wands_edited.toLocaleString()}</div><div class="stat-label">调校法杖<span class="info-tip" data-tip="在神圣之山或通过技能修改法杖构筑的次数">?</span></div></div>
                <div class="mini-card"><div class="stat-val">${(b.total_projectiles_shot / 1000).toFixed(1)}k</div><div class="stat-label">射出咒语<span class="info-tip" data-tip="所有轮回中发射的法术投射物总数">?</span></div></div>
            </div>
        </div>
    `;
}

function renderEcology(data) {
    return `
        <div class="report-card">
            <h2>猎人与生态</h2>
            <div class="big-grid" style="grid-template-columns: 1fr 1fr;">
                <div class="mini-card">
                    <div class="stat-label" style="margin-bottom:20px">物种灭绝名单 (Top 5)</div>
                    <div id="victim-list"></div>
                </div>
                <div style="display:flex; flex-direction:column; gap:20px">
                    <div class="mini-card">
                        <div class="stat-val">${(data.total_enemies_killed / data.total_sessions).toFixed(1)}</div>
                        <div class="stat-label">场均割草数<span class="info-tip" data-tip="平均每局轮回杀死的敌人数量">?</span></div>
                    </div>
                    <div class="mini-card">
                        <div class="stat-val">${data.progression.peak_exploration}</div>
                        <div class="stat-label">探索之最<span class="info-tip" data-tip="单局轮回中抵达过的独特地点数量（包含并行世界）">?</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSuffering(data) {
    const sd = data.suffering;
    const pr = data.progression;
    const totalLife = sd.total_damage_taken + sd.total_healed;
    const dmgPct = (sd.total_damage_taken / totalLife * 100).toFixed(1);
    const healPct = (sd.total_healed / totalLife * 100).toFixed(1);

    return `
        <div class="report-card">
            <h2>苦难、真相与奇迹</h2>
            <div class="mini-card">
                <div class="stat-label">受难对比 (伤害 vs 回复)</div>
                <div class="comparison-bar" style="height: 30px; margin: 20px 0;">
                    <div style="width: ${dmgPct}%; background: var(--danger);"></div>
                    <div style="width: ${healPct}%; background: var(--success);"></div>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:10px">
                    <span>${formatBigNumber(sd.total_damage_taken)} Damage</span>
                    <span>${formatBigNumber(sd.total_healed)} Healed<span class="info-tip" data-tip="注：治疗液的恢复通常不计入此项">?</span></span>
                </div>
                
                <div style="margin-top:40px; text-align:left; border-top: 1px solid var(--border); padding-top:20px;">
                    <p style="margin: 10px 0;">✦ 累计开启种子: <span style="color:var(--secondary)">${pr.unique_seeds}</span></p>
                    <p style="margin: 10px 0;">✦ 无限钱次数: <span style="color:var(--secondary)">${pr.gold_infinite_runs}</span></p>
                    <p style="margin: 10px 0;">✦ 纯粹主义者: <span style="color:var(--secondary)">${pr.no_wand_runs}</span> 次<span class="info-tip" data-tip="不携带法杖进入新生物群落的通关局数（不计入圣山）">?</span></p>
                </div>
            </div>
        </div>
    `;
}

function renderBadges(data) {
    const badgesHtml = data.badges.map(b => `
        <div class="badge-item">
            <span style="font-size: 2.5rem; margin-bottom: 10px; display:block;">${b.icon}</span>
            <strong>${b.name}</strong>
            <p style="font-size: 0.8rem; opacity: 0.7; margin-top:5px;">${b.desc}</p>
        </div>
    `).join('');

    return `
        <div class="report-card">
            <h2>成就勋章</h2>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin-top:40px;">
                ${badgesHtml || '<p>继续探索，更多奖章在前方等着你。</p>'}
            </div>
        </div>
    `;
}

function renderEnding(data) {
    return `
        <div class="report-card" style="text-align: center; border: none; background:transparent;">
            <p style="font-size: 1.5rem; margin-bottom: 20px; color: var(--text-dim);">“真理并非被发现，而是被经历。”</p>
            <h1 style="font-size: 4rem;">NOITA ${data.year}</h1>
            <p style="margin-top: 40px; color: var(--text-dim); font-size: 0.9rem;">感谢在这一年里不懈探索的你。</p>
            <div style="display: flex; gap: 20px; justify-content: center; margin-top: 40px;">
                <button class="btn-primary" onclick="location.reload()">再次回味</button>
                <button class="btn-secondary" id="download-archive" style="padding: 16px 32px; border-radius: 50px; font-weight: 600;">下载完整档案 (.txt)</button>
            </div>
        </div>
    `;
}

// --- Logic Engines ---

function formatBigNumber(num) {
    if (!num || num === 0) return "0";
    const units = ["", "K", "M", "B", "T", "P", "E"];
    const i = Math.floor(Math.log10(Math.abs(num)) / 3);
    if (i <= 0) return Math.floor(num).toLocaleString();
    const unit = units[Math.min(i, units.length - 1)];
    return (num / Math.pow(10, Math.min(i, units.length - 1) * 3)).toFixed(2) + unit;
}

function initNavigation() {
    let currentSlide = 0;
    const slides = document.querySelectorAll('.slide-full');
    const dots = document.getElementById('dots');

    slides.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => window.goToSlide(i);
        dots.appendChild(dot);
    });

    window.nextSlide = () => {
        if (currentSlide < slides.length - 1) goToSlide(currentSlide + 1);
    };
    window.prevSlide = () => {
        if (currentSlide > 0) goToSlide(currentSlide - 1);
    };
    window.goToSlide = (n) => {
        slides[currentSlide].classList.remove('active');
        document.querySelectorAll('.dot')[currentSlide].classList.remove('active');
        currentSlide = n;
        slides[currentSlide].classList.add('active');
        document.querySelectorAll('.dot')[currentSlide].classList.add('active');
    };
}

function initCharts(data) {
    if (!data.radar_stats || Object.keys(data.radar_stats).length === 0) return;
    // 1. Radar
    new Chart(document.getElementById('radarChart'), {
        type: 'radar',
        data: {
            labels: Object.keys(data.radar_stats),
            datasets: [{
                label: '能力指数',
                data: Object.values(data.radar_stats),
                backgroundColor: 'rgba(157, 78, 221, 0.2)',
                borderColor: '#9d4edd',
                pointBackgroundColor: '#9d4edd'
            }]
        },
        options: {
            scales: { r: { min: 0, max: 100, ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' }, angleLines: { color: 'rgba(255,255,255,0.1)' }, pointLabels: { color: '#fff', font: { size: 14 } } } },
            plugins: { legend: { display: false } }
        }
    });

    // 2. Line
    new Chart(document.getElementById('lineChart'), {
        type: 'line',
        data: {
            labels: Array.from({ length: 24 }, (_, i) => `${i}h`),
            datasets: [{
                label: '活跃强度',
                data: data.time_distribution.hourly,
                borderColor: '#ff9e00',
                tension: 0.4,
                fill: true,
                backgroundColor: 'rgba(255, 158, 0, 0.05)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } } },
            plugins: { legend: { display: false } }
        }
    });

    // 3. Pie
    new Chart(document.getElementById('deathPieChart'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(data.death_groups),
            datasets: [{
                data: Object.values(data.death_groups),
                backgroundColor: ['#9d4edd', '#ff9e00', '#2ec4b6', '#ff4d4d', '#aaa']
            }]
        },
        options: { plugins: { legend: { position: 'right', labels: { color: '#fff', padding: 20 } } } }
    });

    // 4. Victim List
    const vList = document.getElementById('victim-list');
    Object.entries(data.enemies_killed_breakdown || {}).slice(0, 5).forEach(([name, count]) => {
        vList.innerHTML += `<div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.05);"><span>${name}</span> <span style="color:var(--secondary)">${count.toLocaleString()}</span></div>`;
    });

    // 5. Nemesis
    const nList = document.getElementById('nemesis-list');
    Object.entries(data.all_death_causes).slice(0, 8).forEach(([name, count]) => {
        nList.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:12px; font-size:0.9rem;"><span>${name}</span> <span style="opacity:0.6">${count} 次</span></div>`;
    });
}

function initDownload(data) {
    const btn = document.getElementById('download-archive');
    if (!btn) return;
    btn.onclick = () => {
        const scanner = new NoitaWebScanner();
        const content = scanner.exportFullText(data);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Noita_${data.year}_年度真理档案.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };
}

function initPollenToggle(data) {
    const checkbox = document.getElementById('exclude-pollen');
    const valDisplay = document.getElementById('total-kills-val');
    if (!checkbox || !valDisplay) return;

    checkbox.onchange = () => {
        const isExcluded = checkbox.checked;
        const finalVal = isExcluded ? (data.total_enemies_killed - data.total_pollen_killed) : data.total_enemies_killed;
        valDisplay.innerText = finalVal.toLocaleString();
    };
}

