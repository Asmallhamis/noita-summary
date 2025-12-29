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
};

// --- Sub-Renderers ---

function renderOverview(data) {
    const totalHours = (data.total_playtime_s / 3600).toFixed(1);
    const avgSpent = (data.total_gold_spent / data.total_sessions).toFixed(0);
    return `
        <div class="report-card">
            <h2>${data.year} 年度概览</h2>
            <div class="big-grid">
                <div class="mini-card">
                    <div class="stat-val">${data.total_sessions}</div>
                    <div class="stat-label">总轮回次数</div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${totalHours}h</div>
                    <div class="stat-label">总游玩时长</div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${data.total_enemies_killed.toLocaleString()}</div>
                    <div class="stat-label">累计击杀</div>
                </div>
                <div class="mini-card">
                    <div class="stat-val">${avgSpent}</div>
                    <div class="stat-label">场均消费 (买买买!)</div>
                </div>
            </div>
        </div>
    `;
}

function renderRadar(data) {
    return `
        <div class="report-card">
            <h2>六维能力分布</h2>
            <div style="max-width: 600px; margin: 40px auto;">
                <canvas id="radarChart"></canvas>
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
                <div class="mini-card"><div class="stat-val">${b.total_kicks.toLocaleString()}</div><div class="stat-label">踢击</div></div>
                <div class="mini-card"><div class="stat-val">${b.total_teleports.toLocaleString()}</div><div class="stat-label">瞬移</div></div>
                <div class="mini-card"><div class="stat-val">${b.total_wands_edited.toLocaleString()}</div><div class="stat-label">调校法杖</div></div>
                <div class="mini-card"><div class="stat-val">${(b.total_projectiles_shot / 1000).toFixed(1)}k</div><div class="stat-label">射出咒语</div></div>
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
                        <div class="stat-label">场均割草数</div>
                    </div>
                    <div class="mini-card">
                        <div class="stat-val">${Math.floor(data.suffering.peak_hp)}</div>
                        <div class="stat-label">血量巅峰 (Max HP)</div>
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
                    <span>${Math.floor(sd.total_damage_taken).toLocaleString()} Damage</span>
                    <span>${Math.floor(sd.total_healed).toLocaleString()} Healed</span>
                </div>
                
                <div style="margin-top:40px; text-align:left; border-top: 1px solid var(--border); padding-top:20px;">
                    <p style="margin: 10px 0;">✦ 累计开启种子: <span style="color:var(--secondary)">${pr.unique_seeds}</span></p>
                    <p style="margin: 10px 0;">✦ 迈达斯降临次数: <span style="color:var(--secondary)">${pr.gold_infinite_runs}</span></p>
                    <p style="margin: 10px 0;">✦ 纯粹主义者 (不使用法杖通关): <span style="color:var(--secondary)">${pr.no_wand_runs}</span> 次</p>
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
            <button class="btn-primary" onclick="location.reload()" style="margin-top: 40px;">再次回味</button>
        </div>
    `;
}

// --- Logic Engines ---

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
