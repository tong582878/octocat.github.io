/* ============================================
   黑白猫资本 - 智能驾驶舱 核心逻辑
   ============================================ */

// ============================================
// 默认数据（仅在 data.js 不存在时使用）
// ============================================
const FALLBACK_SHAREHOLDERS = [
    { id: 'sh_001', name: '猫哥', amount: 15.00, avatar: '🐱', joinDate: '2024-03-15' },
    { id: 'sh_002', name: '大橘', amount: 12.50, avatar: '🐱', joinDate: '2024-03-15' },
    { id: 'sh_003', name: '布偶', amount: 18.00, avatar: '🐈', joinDate: '2024-03-15' },
    { id: 'sh_004', name: '狸花', amount: 10.00, avatar: '🐈‍⬛', joinDate: '2024-03-16' },
    { id: 'sh_005', name: '蓝猫', amount: 13.88, avatar: '😼', joinDate: '2024-03-16' },
];

const FALLBACK_FUNDS = [
    { id: 'f_001', name: '天弘余额宝货币', code: '000198', type: '货币型', shares: 15.00, costNav: 1.0000, currentNav: 1.0023 },
    { id: 'f_002', name: '易方达蓝筹精选混合', code: '005827', type: '混合型', shares: 3.20, costNav: 2.1500, currentNav: 2.0834 },
    { id: 'f_003', name: '招商中证白酒指数', code: '161725', type: '指数型', shares: 2.50, costNav: 1.3200, currentNav: 1.2756 },
    { id: 'f_004', name: '中欧医疗健康混合', code: '003095', type: '混合型', shares: 4.00, costNav: 0.8500, currentNav: 0.8123 },
    { id: 'f_005', name: '华夏沪深300ETF联接', code: '000051', type: '指数型', shares: 2.00, costNav: 1.4500, currentNav: 1.5234 },
];

// 生成30天历史数据
function generateHistoricalData(funds) {
    const data = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const entry = { date: dateStr, funds: {} };
        funds.forEach(fund => {
            const volatility = fund.type === '货币型' ? 0.0001 : 0.02;
            const trend = (Math.random() - 0.48) * volatility;
            const prevNav = i === 29 ? fund.costNav : (data[data.length - 1]?.funds[fund.id] || fund.costNav);
            entry.funds[fund.id] = Math.max(0.1, parseFloat((prevNav * (1 + trend)).toFixed(4)));
        });
        data.push(entry);
    }
    return data;
}

// ============================================
// 数据管理
// ============================================
class DataManager {
    constructor() {
        this.load();
    }

    load() {
        // 优先从 data.js (window.BWCAT_DATA) 读取
        if (window.BWCAT_DATA) {
            const remoteData = window.BWCAT_DATA;
            this.shareholders = remoteData.shareholders || [];
            this.funds = remoteData.funds || [];
            this.history = remoteData.history || [];
            // 如果 data.js 没有历史数据，自动从当前基金生成
            if (this.history.length === 0 && this.funds.length > 0) {
                this.history = generateHistoricalData(this.funds);
            }
            // 同步到 localStorage 并记录远程版本号
            this._remoteVersion = remoteData.version || 0;
            this._remoteLastUpdate = remoteData.lastUpdate || '';
            this.save();
            return;
        }

        // 其次从 localStorage 读取
        const saved = localStorage.getItem('bwcat_data');
        if (saved) {
            const data = JSON.parse(saved);
            this.shareholders = data.shareholders || [];
            this.funds = data.funds || [];
            this.history = data.history || [];
        } else {
            // 最后使用内置默认数据
            this.shareholders = [...FALLBACK_SHAREHOLDERS];
            this.funds = [...FALLBACK_FUNDS];
            this.history = generateHistoricalData(FALLBACK_FUNDS);
            this.save();
        }
    }

    save() {
        localStorage.setItem('bwcat_data', JSON.stringify({
            shareholders: this.shareholders,
            funds: this.funds,
            history: this.history,
        }));
    }

    // Shareholders
    addShareholder(sh) {
        const existing = this.shareholders.find(s => s.id === sh.id);
        if (existing) {
            Object.assign(existing, sh);
        } else {
            sh.id = 'sh_' + Date.now();
            sh.joinDate = new Date().toISOString().split('T')[0];
            this.shareholders.push(sh);
        }
        this.save();
    }

    deleteShareholder(id) {
        this.shareholders = this.shareholders.filter(s => s.id !== id);
        this.save();
    }

    // Funds
    addFund(fund) {
        const existing = this.funds.find(f => f.id === fund.id);
        if (existing) {
            Object.assign(existing, fund);
        } else {
            fund.id = 'f_' + Date.now();
            this.funds.push(fund);
        }
        this.save();
    }

    deleteFund(id) {
        this.funds = this.funds.filter(f => f.id !== id);
        this.history.forEach(h => delete h.funds[id]);
        this.save();
    }

    // Performance
    addPerformance(date, fundId, nav) {
        let dayEntry = this.history.find(h => h.date === date);
        if (!dayEntry) {
            dayEntry = { date, funds: {} };
            this.history.push(dayEntry);
            this.history.sort((a, b) => a.date.localeCompare(b.date));
        }
        dayEntry.funds[fundId] = parseFloat(nav);
        const fund = this.funds.find(f => f.id === fundId);
        if (fund) fund.currentNav = parseFloat(nav);
        this.save();
    }

    // Computed
    getTotalAsset() {
        return this.funds.reduce((sum, f) => sum + (f.shares * f.currentNav), 0);
    }

    getCostAsset() {
        return this.funds.reduce((sum, f) => sum + (f.shares * f.costNav), 0);
    }

    getDailyReturn() {
        if (this.history.length < 2) return 0;
        const latest = this.history[this.history.length - 1];
        const prev = this.history[this.history.length - 2];
        let latestTotal = 0, prevTotal = 0;
        this.funds.forEach(f => {
            latestTotal += f.shares * (latest.funds[f.id] || f.currentNav);
            prevTotal += f.shares * (prev.funds[f.id] || f.costNav);
        });
        return prevTotal > 0 ? ((latestTotal - prevTotal) / prevTotal * 100) : 0;
    }

    getEquity(name) {
        const total = this.shareholders.reduce((s, sh) => s + sh.amount, 0);
        const sh = this.shareholders.find(s => s.name === name);
        return total > 0 ? (sh ? (sh.amount / total * 100) : 0) : 0;
    }

    reset() {
        if (window.BWCAT_DATA) {
            this.shareholders = [...window.BWCAT_DATA.shareholders];
            this.funds = [...window.BWCAT_DATA.funds];
            this.history = window.BWCAT_DATA.history && window.BWCAT_DATA.history.length > 0
                ? [...window.BWCAT_DATA.history]
                : generateHistoricalData(window.BWCAT_DATA.funds);
        } else {
            this.shareholders = [...FALLBACK_SHAREHOLDERS];
            this.funds = [...FALLBACK_FUNDS];
            this.history = generateHistoricalData(FALLBACK_FUNDS);
        }
        this.save();
    }

    exportData() {
        return JSON.stringify({
            shareholders: this.shareholders,
            funds: this.funds,
            history: this.history,
        }, null, 2);
    }

    // 导出为 data.js 文件（用于提交到 GitHub 全网同步）
    exportDataJS() {
        const now = new Date().toISOString();
        const currentVersion = (window.BWCAT_DATA && window.BWCAT_DATA.version) || 0;
        const newVersion = currentVersion + 1;

        const data = {
            shareholders: this.shareholders,
            funds: this.funds,
            history: this.history,
            lastUpdate: now,
            version: newVersion,
        };

        const content = `/* ============================================
   黑白猫资本 - 数据源文件
   自动生成于: ${now}
   版本号: v${newVersion}
   ============================================ */

window.BWCAT_DATA = ${JSON.stringify(data, null, 4)};
`;

        return { content, version: newVersion, lastUpdate: now };
    }

    importData(jsonStr) {
        const data = JSON.parse(jsonStr);
        this.shareholders = data.shareholders || [];
        this.funds = data.funds || [];
        this.history = data.history || [];
        this.save();
    }
}

const dm = new DataManager();

// ============================================
// 3D Background - Three.js Particles
// ============================================
function init3DBackground() {
    const canvas = document.getElementById('bg-canvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Particles
    const particleCount = 800;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorPalette = [
        new THREE.Color(0x00f0ff),
        new THREE.Color(0xa855f7),
        new THREE.Color(0xf472b6),
        new THREE.Color(0x22c55e),
    ];

    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

        const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        sizes[i] = Math.random() * 2 + 0.5;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
        size: 0.08,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Grid lines
    const gridHelper = new THREE.GridHelper(40, 40, 0x00f0ff, 0x0a1929);
    gridHelper.position.y = -10;
    gridHelper.material.opacity = 0.15;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Wireframe sphere
    const sphereGeo = new THREE.IcosahedronGeometry(5, 2);
    const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.06,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    scene.add(sphere);

    // Another wireframe
    const torusGeo = new THREE.TorusKnotGeometry(3, 0.8, 100, 16);
    const torusMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        wireframe: true,
        transparent: true,
        opacity: 0.04,
    });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.position.x = 12;
    torus.position.y = 3;
    scene.add(torus);

    camera.position.z = 20;
    camera.position.y = 5;

    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    });

    function animate() {
        requestAnimationFrame(animate);

        const time = Date.now() * 0.0005;

        particles.rotation.y += 0.0005;
        particles.rotation.x += 0.0002;

        sphere.rotation.x += 0.001;
        sphere.rotation.y += 0.0015;

        torus.rotation.x += 0.002;
        torus.rotation.y -= 0.001;

        camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
        camera.position.y += (-mouseY * 2 + 5 - camera.position.y) * 0.02;
        camera.lookAt(scene.position);

        renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// ============================================
// Chart Helpers
// ============================================
const CHART_COLORS = [
    '#00f0ff', '#a855f7', '#f472b6', '#22c55e',
    '#f59e0b', '#3b82f6', '#ef4444', '#14b8a6',
    '#8b5cf6', '#ec4899'
];

let navChart = null;
let equityChart = null;
let shPieChart = null;
let fundsComparisonChart = null;
let miniCharts = {};

function getChartData(days) {
    const history = dm.history;
    if (history.length === 0) return { labels: [], datasets: [] };

    const sliced = days < history.length ? history.slice(-days) : history;
    const labels = sliced.map(h => {
        const d = new Date(h.date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    const totalValues = sliced.map(h => {
        let total = 0;
        dm.funds.forEach(f => {
            total += f.shares * (h.funds[f.id] || f.currentNav);
        });
        return parseFloat(total.toFixed(2));
    });

    return { labels, values: totalValues };
}

function initNavChart(days = 7) {
    const ctx = document.getElementById('nav-chart').getContext('2d');
    if (navChart) navChart.destroy();

    const { labels, values } = getChartData(days);

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
    gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

    navChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '总资产净值',
                data: values,
                borderColor: '#00f0ff',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: '#00f0ff',
                pointBorderColor: '#00f0ff',
                pointHoverRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 15, 30, 0.9)',
                    borderColor: 'rgba(0, 240, 255, 0.3)',
                    borderWidth: 1,
                    titleColor: '#00f0ff',
                    bodyColor: '#e2e8f0',
                    titleFont: { family: 'Orbitron', size: 11 },
                    bodyFont: { family: 'JetBrains Mono', size: 13 },
                    callbacks: {
                        label: ctx => `¥${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: { color: '#475569', font: { size: 10, family: 'JetBrains Mono' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
                    ticks: {
                        color: '#475569',
                        font: { size: 10, family: 'JetBrains Mono' },
                        callback: v => '¥' + v.toFixed(0)
                    }
                }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

function initEquityChart() {
    const ctx = document.getElementById('equity-chart').getContext('2d');
    if (equityChart) equityChart.destroy();

    const total = dm.shareholders.reduce((s, sh) => s + sh.amount, 0);
    if (total === 0) return;

    equityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: dm.shareholders.map(sh => sh.name),
            datasets: [{
                data: dm.shareholders.map(sh => sh.amount),
                backgroundColor: CHART_COLORS.slice(0, dm.shareholders.length),
                borderColor: 'rgba(3, 7, 18, 0.8)',
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(10, 15, 30, 0.9)',
                    borderColor: 'rgba(0, 240, 255, 0.3)',
                    borderWidth: 1,
                    titleColor: '#00f0ff',
                    bodyColor: '#e2e8f0',
                    callbacks: {
                        label: ctx => {
                            const pct = (ctx.parsed / total * 100).toFixed(1);
                            return `${ctx.label}: ¥${ctx.parsed.toFixed(2)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    // Custom legend
    const legendEl = document.getElementById('equity-legend');
    legendEl.innerHTML = dm.shareholders.map((sh, i) => {
        const pct = (sh.amount / total * 100).toFixed(1);
        return `<div class="legend-item">
            <div class="legend-dot" style="background:${CHART_COLORS[i]}"></div>
            ${sh.avatar} ${sh.name} ${pct}%
        </div>`;
    }).join('');
}

function initSHPieChart() {
    const ctx = document.getElementById('sh-pie-chart');
    if (!ctx) return;
    if (shPieChart) shPieChart.destroy();

    const total = dm.shareholders.reduce((s, sh) => s + sh.amount, 0);
    if (total === 0) return;

    shPieChart = new Chart(ctx.getContext('2d'), {
        type: 'pie',
        data: {
            labels: dm.shareholders.map(sh => `${sh.avatar} ${sh.name}`),
            datasets: [{
                data: dm.shareholders.map(sh => sh.amount),
                backgroundColor: CHART_COLORS.slice(0, dm.shareholders.length),
                borderColor: 'rgba(3, 7, 18, 0.8)',
                borderWidth: 3,
                hoverOffset: 12,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        padding: 16,
                        font: { size: 12 },
                        usePointStyle: true,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 15, 30, 0.9)',
                    borderColor: 'rgba(0, 240, 255, 0.3)',
                    borderWidth: 1,
                    titleColor: '#00f0ff',
                    bodyColor: '#e2e8f0',
                    callbacks: {
                        label: ctx => {
                            const pct = (ctx.parsed / total * 100).toFixed(1);
                            return ` ¥${ctx.parsed.toFixed(2)} — ${pct}%`;
                        }
                    }
                }
            }
        }
    });
}

function initFundsComparisonChart() {
    const ctx = document.getElementById('funds-comparison-chart');
    if (!ctx) return;
    if (fundsComparisonChart) fundsComparisonChart.destroy();

    const history = dm.history;
    if (history.length === 0) return;

    const labels = history.map(h => {
        const d = new Date(h.date);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    const datasets = dm.funds.map((fund, i) => {
        const values = history.map(h => h.funds[fund.id] || fund.currentNav);
        const base = values[0] || 1;
        const normalized = values.map(v => ((v / base - 1) * 100).toFixed(2));
        return {
            label: fund.name.length > 12 ? fund.name.substring(0, 12) + '...' : fund.name,
            data: normalized,
            borderColor: CHART_COLORS[i % CHART_COLORS.length],
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
        };
    });

    fundsComparisonChart = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#94a3b8',
                        font: { size: 11 },
                        usePointStyle: true,
                        padding: 16,
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 15, 30, 0.9)',
                    borderColor: 'rgba(168, 85, 247, 0.3)',
                    borderWidth: 1,
                    titleColor: '#a855f7',
                    bodyColor: '#e2e8f0',
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#475569', font: { size: 10, family: 'JetBrains Mono' } }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: {
                        color: '#475569',
                        font: { size: 10, family: 'JetBrains Mono' },
                        callback: v => v + '%'
                    }
                }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

// ============================================
// Render Functions
// ============================================
function renderDashboard() {
    const totalAsset = dm.getTotalAsset();
    const costAsset = dm.getCostAsset();
    const dailyReturn = dm.getDailyReturn();

    document.getElementById('total-asset').textContent = `¥${totalAsset.toFixed(2)}`;
    document.getElementById('total-shareholders').textContent = dm.shareholders.length;
    document.getElementById('total-funds').textContent = dm.funds.length;

    const returnEl = document.getElementById('daily-return');
    returnEl.textContent = `${dailyReturn >= 0 ? '+' : ''}${dailyReturn.toFixed(2)}%`;
    returnEl.parentElement.querySelector('.stat-change').className = `stat-change ${dailyReturn >= 0 ? 'positive' : ''}`;
    returnEl.parentElement.querySelector('.stat-change').textContent = dailyReturn >= 0 ? '↑ 今日盈利' : '↓ 今日亏损';

    initNavChart(7);
    initEquityChart();
    renderActivityFeed();
    renderFundRank();
    renderFunFact();

    // 显示数据同步状态
    renderSyncStatus();
}

function renderSyncStatus() {
    const syncEl = document.getElementById('sync-status');
    if (!syncEl) return;
    if (window.BWCAT_DATA) {
        const update = window.BWCAT_DATA.lastUpdate ? new Date(window.BWCAT_DATA.lastUpdate).toLocaleString('zh-CN') : '未知';
        const ver = window.BWCAT_DATA.version || '?';
        syncEl.innerHTML = `☁ 数据源: data.js (v${ver}) · 更新于 ${update}`;
        syncEl.style.display = 'block';
    } else {
        syncEl.innerHTML = '⚠ 数据源: 本地浏览器 (请部署 data.js 实现全网同步)';
        syncEl.style.display = 'block';
    }
}

function renderActivityFeed() {
    const list = document.getElementById('activity-list');
    const activities = [];

    dm.shareholders.forEach(sh => {
        activities.push({
            icon: sh.avatar,
            text: `<strong>${sh.name}</strong> 投资了 ¥${sh.amount.toFixed(2)}，占股 ${dm.getEquity(sh.name).toFixed(1)}%`,
            time: sh.joinDate,
        });
    });

    dm.funds.forEach(fund => {
        const pnl = (fund.currentNav - fund.costNav) / fund.costNav * 100;
        activities.push({
            icon: pnl >= 0 ? '📈' : '📉',
            text: `基金 <strong>${fund.name}</strong> (${fund.code}) 最新净值 ${fund.currentNav.toFixed(4)}，${pnl >= 0 ? '盈利' : '亏损'} ${Math.abs(pnl).toFixed(2)}%`,
            time: '最新',
        });
    });

    activities.sort((a, b) => b.time.localeCompare(a.time));

    list.innerHTML = activities.map(a => `
        <div class="activity-item">
            <div class="activity-icon">${a.icon}</div>
            <div class="activity-content">
                <div class="activity-text">${a.text}</div>
                <div class="activity-time">${a.time}</div>
            </div>
        </div>
    `).join('');
}

function renderFundRank() {
    const list = document.getElementById('fund-rank-list');
    const sorted = [...dm.funds].sort((a, b) => {
        const returnA = (a.currentNav - a.costNav) / a.costNav;
        const returnB = (b.currentNav - b.costNav) / b.costNav;
        return returnB - returnA;
    });

    list.innerHTML = sorted.map((fund, i) => {
        const pnl = ((fund.currentNav - fund.costNav) / fund.costNav * 100);
        const isPositive = pnl >= 0;
        return `
            <div class="fund-rank-item">
                <div class="fund-rank-num ${i === 0 ? 'top' : ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1)}</div>
                <div class="fund-rank-info">
                    <div class="fund-rank-name">${fund.name}</div>
                    <div class="fund-rank-code">${fund.code} · ${fund.type}</div>
                </div>
                <div class="fund-rank-return ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${pnl.toFixed(2)}%</div>
            </div>
        `;
    }).join('');
}

function renderFunFact() {
    const facts = [
        { quote: '投资的第一条规则：永远不要亏损。投资的第二条规则：永远不要忘记第一条。', author: '—— 沃伦·巴菲特（黑白猫资本精神导师）' },
        { quote: '我们不是在买基金，我们是在买快乐。', author: '—— 黑白猫资本首席快乐官' },
        { quote: '市场有风险，投资需谨慎。但我们不在乎。', author: '—— 黑白猫资本风控部门（已解散）' },
        { quote: '十几块钱也是钱，每一分钱都值得被认真对待。', author: '—— 黑白猫资本首席财务官' },
        { quote: '别人恐惧时我贪婪，别人贪婪时我……也贪婪。', author: '—— 黑白猫资本投资总监' },
        { quote: '我的投资组合今天涨了0.01%，我决定请客喝奶茶。', author: '—— 某不知名股东' },
        { quote: '黑白猫资本，两只猫的资本冒险。', author: '—— 创始团队' },
        { quote: '我们距离管理一亿资产只差9999万9900块了。', author: '—— 悲观但不失希望的分析师' },
        { quote: '基金经理问我投资目标是什么，我说：保住本金。他说：那你不该买基金。我说：我知道，但我开心。', author: '—— 资深猫粉' },
        { quote: '今天的基金跌了，但没关系，我们的友谊不会跌。', author: '—— 友谊比收益更重要' },
        { quote: '如果你把钱存银行，你只能得到利息。如果你加入黑白猫资本，你还能得到快乐。', author: '—— 入股邀请函' },
        { quote: '黑白猫资本的核心竞争力：我们亏得起。', author: '—— 因为本来就只有十几块' },
    ];

    const idx = new Date().getDate() % facts.length;
    const fact = facts[idx];

    document.getElementById('fun-fact').innerHTML = `
        <div class="quote">"${fact.quote}"</div>
        <div class="author">${fact.author}</div>
    `;
}

function renderShareholdersView() {
    const total = dm.shareholders.reduce((s, sh) => s + sh.amount, 0);
    const totalAsset = dm.getTotalAsset();
    const totalCost = dm.getCostAsset();

    const cardsEl = document.getElementById('sh-cards');
    cardsEl.innerHTML = dm.shareholders.map(sh => {
        const equity = dm.getEquity(sh.name);
        const pnl = totalCost > 0 ? (totalAsset - totalCost) / totalCost * sh.amount : 0;
        const isPositive = pnl >= 0;
        return `
            <div class="sh-card">
                <div class="sh-card-avatar">${sh.avatar}</div>
                <div class="sh-card-name">${sh.name}</div>
                <div class="sh-card-amount">¥${sh.amount.toFixed(2)}</div>
                <div class="sh-card-equity">占股 ${equity.toFixed(1)}% · ${sh.joinDate} 入股</div>
                <div class="sh-card-pnl ${isPositive ? 'positive' : 'negative'}">
                    预估盈亏: ${isPositive ? '+' : ''}¥${pnl.toFixed(2)}
                </div>
            </div>
        `;
    }).join('');

    const sorted = [...dm.shareholders].sort((a, b) => b.amount - a.amount);
    const medals = ['🥇', '🥈', '🥉'];
    const rankEl = document.getElementById('ranking-list');
    rankEl.innerHTML = sorted.map((sh, i) => `
        <div class="ranking-item">
            <div class="ranking-medal">${medals[i] || '#' + (i + 1)}</div>
            <div class="ranking-info">
                <div class="ranking-name">${sh.avatar} ${sh.name}</div>
                <div class="ranking-detail">占股 ${dm.getEquity(sh.name).toFixed(1)}% · ${sh.joinDate} 加入</div>
            </div>
            <div class="ranking-amount">¥${sh.amount.toFixed(2)}</div>
        </div>
    `).join('');

    initSHPieChart();
}

function renderFundsView() {
    const listEl = document.getElementById('funds-detail-list');
    listEl.innerHTML = dm.funds.map(fund => {
        const pnl = fund.currentNav - fund.costNav;
        const pnlPct = (pnl / fund.costNav * 100);
        const marketValue = fund.shares * fund.currentNav;
        const profit = marketValue - fund.shares * fund.costNav;
        const isPositive = pnl >= 0;

        return `
            <div class="fund-detail-card">
                <div class="fund-detail-header">
                    <div>
                        <div class="fund-detail-name">${fund.name}</div>
                        <div class="fund-detail-code">${fund.code}</div>
                    </div>
                    <div class="fund-detail-type">${fund.type}</div>
                </div>
                <div class="fund-detail-stats">
                    <div class="fund-stat">
                        <div class="fund-stat-label">当前净值</div>
                        <div class="fund-stat-value">${fund.currentNav.toFixed(4)}</div>
                    </div>
                    <div class="fund-stat">
                        <div class="fund-stat-label">累计收益</div>
                        <div class="fund-stat-value ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}${pnlPct.toFixed(2)}%</div>
                    </div>
                    <div class="fund-stat">
                        <div class="fund-stat-label">持有市值</div>
                        <div class="fund-stat-value">¥${marketValue.toFixed(2)}</div>
                    </div>
                </div>
                <div class="fund-detail-stats" style="margin-top: 0.8rem;">
                    <div class="fund-stat">
                        <div class="fund-stat-label">持有份额</div>
                        <div class="fund-stat-value">${fund.shares.toFixed(2)}份</div>
                    </div>
                    <div class="fund-stat">
                        <div class="fund-stat-label">成本净值</div>
                        <div class="fund-stat-value">${fund.costNav.toFixed(4)}</div>
                    </div>
                    <div class="fund-stat">
                        <div class="fund-stat-label">盈亏金额</div>
                        <div class="fund-stat-value ${isPositive ? 'positive' : 'negative'}">${isPositive ? '+' : ''}¥${profit.toFixed(2)}</div>
                    </div>
                </div>
                <div class="fund-mini-chart">
                    <canvas id="mini-${fund.id}"></canvas>
                </div>
            </div>
        `;
    }).join('');

    dm.funds.forEach(fund => {
        const canvas = document.getElementById(`mini-${fund.id}`);
        if (!canvas) return;
        if (miniCharts[fund.id]) miniCharts[fund.id].destroy();

        const recentHistory = dm.history.slice(-7);
        const values = recentHistory.map(h => h.funds[fund.id] || fund.currentNav);

        const isPositive = values[values.length - 1] >= values[0];
        const color = isPositive ? '#22c55e' : '#ef4444';

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 60);
        gradient.addColorStop(0, isPositive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)');
        gradient.addColorStop(1, 'transparent');

        miniCharts[fund.id] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: recentHistory.map(h => {
                    const d = new Date(h.date);
                    return `${d.getMonth() + 1}/${d.getDate()}`;
                }),
                datasets: [{
                    data: values,
                    borderColor: color,
                    backgroundColor: gradient,
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false }
                }
            }
        });
    });

    initFundsComparisonChart();
}

// ============================================
// Admin Panel
// ============================================
const ADMIN_PASSWORD = 'bwcat2024';
let isAdminAuthenticated = false;

function showPasswordModal() {
    document.getElementById('admin-password-modal').classList.add('open');
    document.getElementById('admin-password-input').value = '';
    document.getElementById('password-error').classList.remove('visible');
    setTimeout(() => {
        document.getElementById('admin-password-input').focus();
    }, 100);
}

function hidePasswordModal() {
    document.getElementById('admin-password-modal').classList.remove('open');
    document.getElementById('admin-password-input').value = '';
    document.getElementById('password-error').classList.remove('visible');
}

function verifyPassword() {
    const input = document.getElementById('admin-password-input').value;
    if (input === ADMIN_PASSWORD) {
        isAdminAuthenticated = true;
        hidePasswordModal();
        document.getElementById('admin-panel').classList.add('open');
        renderAdminLists();
    } else {
        document.getElementById('password-error').classList.add('visible');
        document.getElementById('admin-password-input').value = '';
        document.getElementById('admin-password-input').focus();
        const modal = document.querySelector('.password-modal-content');
        modal.style.animation = 'none';
        modal.offsetHeight;
        modal.style.animation = 'passwordShake 0.4s ease';
    }
}

function initAdmin() {
    // Toggle - show password modal first
    document.getElementById('admin-toggle').addEventListener('click', () => {
        showPasswordModal();
    });

    // Password modal events
    document.getElementById('password-submit').addEventListener('click', verifyPassword);
    document.getElementById('password-cancel').addEventListener('click', hidePasswordModal);

    document.getElementById('admin-password-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') verifyPassword();
        if (e.key === 'Escape') hidePasswordModal();
    });

    document.getElementById('admin-close').addEventListener('click', () => {
        document.getElementById('admin-panel').classList.remove('open');
        isAdminAuthenticated = false;
    });

    document.querySelectorAll('.admin-panel > .admin-backdrop').forEach(el => {
        el.addEventListener('click', () => {
            document.getElementById('admin-panel').classList.remove('open');
            isAdminAuthenticated = false;
        });
    });

    document.querySelectorAll('.admin-password-modal > .admin-backdrop').forEach(el => {
        el.addEventListener('click', hidePasswordModal);
    });

    // Tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });

    // Save shareholder
    document.getElementById('save-shareholder').addEventListener('click', () => {
        const name = document.getElementById('sh-name').value.trim();
        const amount = parseFloat(document.getElementById('sh-amount').value);
        const avatar = document.getElementById('sh-avatar').value.trim() || '😎';

        if (!name || isNaN(amount)) {
            alert('请填写完整的股东信息！');
            return;
        }

        dm.addShareholder({ name, amount, avatar });
        document.getElementById('sh-name').value = '';
        document.getElementById('sh-amount').value = '';
        document.getElementById('sh-avatar').value = '😎';
        renderAdminLists();
        renderAll();
    });

    // Save fund
    document.getElementById('save-fund').addEventListener('click', () => {
        const name = document.getElementById('fund-name').value.trim();
        const code = document.getElementById('fund-code').value.trim();
        const type = document.getElementById('fund-type').value;
        const shares = parseFloat(document.getElementById('fund-shares').value);
        const costNav = parseFloat(document.getElementById('fund-cost-nav').value);
        const currentNav = parseFloat(document.getElementById('fund-current-nav').value);

        if (!name || !code || isNaN(shares) || isNaN(costNav) || isNaN(currentNav)) {
            alert('请填写完整的基金信息！');
            return;
        }

        dm.addFund({ name, code, type, shares, costNav, currentNav });
        document.getElementById('fund-name').value = '';
        document.getElementById('fund-code').value = '';
        document.getElementById('fund-shares').value = '';
        document.getElementById('fund-cost-nav').value = '';
        document.getElementById('fund-current-nav').value = '';
        renderAdminLists();
        renderAll();
    });

    // Save performance
    document.getElementById('save-performance').addEventListener('click', () => {
        const date = document.getElementById('perf-date').value;
        const fundId = document.getElementById('perf-fund').value;
        const nav = parseFloat(document.getElementById('perf-nav').value);

        if (!date || !fundId || isNaN(nav)) {
            alert('请填写完整的业绩信息！');
            return;
        }

        dm.addPerformance(date, fundId, nav);
        document.getElementById('perf-nav').value = '';
        renderAdminLists();
        renderAll();
    });

    // Export JSON
    document.getElementById('export-data').addEventListener('click', () => {
        const data = dm.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bwcat_capital_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // Export data.js (全网同步)
    document.getElementById('export-datajs').addEventListener('click', () => {
        const { content, version, lastUpdate } = dm.exportDataJS();
        const blob = new Blob([content], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data.js';
        a.click();
        URL.revokeObjectURL(url);

        // Show success message
        const syncInfo = document.getElementById('sync-info');
        if (syncInfo) {
            syncInfo.innerHTML = `✅ data.js 已导出 (v${version})！<br>
                <strong>同步步骤：</strong><br>
                1. 用下载的 data.js 替换项目中的 data.js<br>
                2. git add data.js && git commit -m "update data v${version}"<br>
                3. git push origin main<br>
                4. GitHub Pages 会自动更新，全网生效 🎉<br>
                <span style="font-size:0.7rem;color:var(--text-dim)">更新于 ${new Date(lastUpdate).toLocaleString('zh-CN')}</span>`;
            syncInfo.style.display = 'block';
        }
    });

    // Import
    document.getElementById('import-data').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                dm.importData(ev.target.result);
                renderAdminLists();
                renderAll();
                alert('数据导入成功！');
            } catch (err) {
                alert('数据导入失败：' + err.message);
            }
        };
        reader.readAsText(file);
    });

    // Reset
    document.getElementById('reset-data').addEventListener('click', () => {
        if (confirm('确定要重置所有数据吗？此操作不可撤销！')) {
            dm.reset();
            renderAdminLists();
            renderAll();
        }
    });

    // Set default date
    document.getElementById('perf-date').value = new Date().toISOString().split('T')[0];
}

function renderAdminLists() {
    const shList = document.getElementById('admin-sh-list');
    shList.innerHTML = dm.shareholders.map(sh => `
        <div class="admin-list-item">
            <div class="admin-list-info">
                <div class="admin-list-avatar">${sh.avatar}</div>
                <div>
                    <div class="admin-list-name">${sh.name}</div>
                    <div class="admin-list-detail">¥${sh.amount.toFixed(2)} · ${dm.getEquity(sh.name).toFixed(1)}%</div>
                </div>
            </div>
            <div class="admin-list-actions">
                <button class="admin-list-btn edit" onclick="editShareholder('${sh.id}')" title="编辑">✎</button>
                <button class="admin-list-btn delete" onclick="deleteShareholder('${sh.id}')" title="删除">✕</button>
            </div>
        </div>
    `).join('');

    const fundList = document.getElementById('admin-fund-list');
    fundList.innerHTML = dm.funds.map(fund => {
        const pnl = ((fund.currentNav - fund.costNav) / fund.costNav * 100);
        return `
            <div class="admin-list-item">
                <div class="admin-list-info">
                    <div>
                        <div class="admin-list-name">${fund.name}</div>
                        <div class="admin-list-detail">${fund.code} · ${fund.type} · ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%</div>
                    </div>
                </div>
                <div class="admin-list-actions">
                    <button class="admin-list-btn edit" onclick="editFund('${fund.id}')" title="编辑">✎</button>
                    <button class="admin-list-btn delete" onclick="deleteFund('${fund.id}')" title="删除">✕</button>
                </div>
            </div>
        `;
    }).join('');

    const perfList = document.getElementById('admin-perf-list');
    const recentPerfs = dm.history.slice(-10).reverse();
    perfList.innerHTML = recentPerfs.map(h => {
        const fundEntries = Object.entries(h.funds);
        return fundEntries.map(([fundId, nav]) => {
            const fund = dm.funds.find(f => f.id === fundId);
            if (!fund) return '';
            return `
                <div class="admin-list-item">
                    <div class="admin-list-info">
                        <div>
                            <div class="admin-list-name">${fund.name}</div>
                            <div class="admin-list-detail">${h.date} · 净值: ${nav.toFixed(4)}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }).join('');

    const perfSelect = document.getElementById('perf-fund');
    perfSelect.innerHTML = '<option value="">-- 请选择基金 --</option>' +
        dm.funds.map(f => `<option value="${f.id}">${f.name} (${f.code})</option>`).join('');
}

window.editShareholder = function(id) {
    const sh = dm.shareholders.find(s => s.id === id);
    if (!sh) return;
    document.getElementById('sh-name').value = sh.name;
    document.getElementById('sh-amount').value = sh.amount;
    document.getElementById('sh-avatar').value = sh.avatar;
    document.getElementById('sh-name').focus();
};

window.deleteShareholder = function(id) {
    if (confirm('确定删除该股东？')) {
        dm.deleteShareholder(id);
        renderAdminLists();
        renderAll();
    }
};

window.editFund = function(id) {
    const fund = dm.funds.find(f => f.id === id);
    if (!fund) return;
    document.getElementById('fund-name').value = fund.name;
    document.getElementById('fund-code').value = fund.code;
    document.getElementById('fund-type').value = fund.type;
    document.getElementById('fund-shares').value = fund.shares;
    document.getElementById('fund-cost-nav').value = fund.costNav;
    document.getElementById('fund-current-nav').value = fund.currentNav;
    document.getElementById('fund-name').focus();
};

window.deleteFund = function(id) {
    if (confirm('确定删除该基金？')) {
        dm.deleteFund(id);
        renderAdminLists();
        renderAll();
    }
};

// ============================================
// Navigation
// ============================================
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('view-' + view).classList.add('active');

            if (view === 'dashboard') {
                renderDashboard();
            } else if (view === 'shareholders') {
                renderShareholdersView();
            } else if (view === 'funds') {
                renderFundsView();
            }
        });
    });

    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            initNavChart(parseInt(btn.dataset.range));
        });
    });
}

// ============================================
// Clock
// ============================================
function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN', { hour12: false });
    document.getElementById('nav-time').textContent = timeStr;
    const sysTime = document.getElementById('sys-time');
    if (sysTime) sysTime.textContent = now.toLocaleString('zh-CN');
}

// ============================================
// Render All
// ============================================
function renderAll() {
    renderDashboard();
    renderShareholdersView();
    renderFundsView();
}

// ============================================
// Initialize
// ============================================
function init() {
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-nav').classList.add('visible');
    }, 2200);

    init3DBackground();
    initNavigation();
    initAdmin();
    updateClock();
    setInterval(updateClock, 1000);

    setTimeout(() => {
        renderAll();
    }, 2300);
}

document.addEventListener('DOMContentLoaded', init);