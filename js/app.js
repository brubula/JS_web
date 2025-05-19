// Elementos del DOM
const loadingElement = document.getElementById('loading');
const loadingStatusElement = document.getElementById('loadingStatus');
const progressBarElement = document.getElementById('progressBar');
const totalVolumeElement = document.getElementById('totalVolume');
const avgBuyPriceElement = document.getElementById('avgBuyPrice');
const avgSellPriceElement = document.getElementById('avgSellPrice');
const liquidityIndexElement = document.getElementById('liquidityIndex');
const liquidityDescriptionElement = document.getElementById('liquidityDescription');
const minBuyPriceElement = document.getElementById('minBuyPrice');
const maxBuyPriceElement = document.getElementById('maxBuyPrice');
const minSellPriceElement = document.getElementById('minSellPrice');
const maxSellPriceElement = document.getElementById('maxSellPrice');
const lastUpdateElement = document.getElementById('lastUpdate');
const headerMinBuyPriceElement = document.getElementById('headerMinBuyPrice');
const headerMaxSellPriceElement = document.getElementById('headerMaxSellPrice');
const refreshButton = document.getElementById('refreshButton');

// Elementos del modal
const modal = document.getElementById('ordersModal');
const volumeCard = document.getElementById('volumeCard');
const closeBtn = document.getElementsByClassName('close')[0];
const ordersListElement = document.getElementById('ordersList');

// Variables globales
let currentBuyOrders = [];
let isUpdating = false;
let isManualUpdate = false;
let isFirstLoad = true;

// Configuración
const CORS_PROXY = 'https://corsproxy.io/?';
const BINANCE_P2P_API = CORS_PROXY + encodeURIComponent('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search');
const UPDATE_INTERVAL = 60000; // 1 minuto

// Funciones de utilidad
const formatNumber = (number) => {
    if (isNaN(number) || number === null || number === undefined) return '0.00';
    return new Intl.NumberFormat('es-BO', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    }).format(number);
};

const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('es-BO', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).format(date);
};

// Funciones de UI
const setLoading = (isLoading, status = '') => {
    loadingElement.style.display = isLoading && isManualUpdate ? 'flex' : 'none';
    if (isLoading && isManualUpdate) {
        refreshButton.classList.add('loading');
        refreshButton.disabled = true;
        progressBarElement.classList.add('active');
        if (status) loadingStatusElement.textContent = status;
    } else {
        refreshButton.classList.remove('loading');
        refreshButton.disabled = false;
        progressBarElement.classList.remove('active');
        isManualUpdate = false;
    }
};

const updateValueWithAnimation = (element, value, forceUpdate = false) => {
    if (isFirstLoad || forceUpdate) {
        if (isFirstLoad) {
            const loadingRing = element.querySelector('.loading-ring');
            if (loadingRing) loadingRing.remove();
        }
        element.textContent = value;
    }
};

// Funciones del modal
volumeCard.onclick = () => showOrdersList();
closeBtn.onclick = () => modal.style.display = "none";
window.onclick = (event) => {
    if (event.target == modal) modal.style.display = "none";
};

function showOrdersList() {
    if (currentBuyOrders.length === 0) {
        ordersListElement.innerHTML = '<p>No hay órdenes disponibles en este momento.</p>';
    } else {
        let html = `
            <div class="order-item order-header">
                <div>Usuario</div>
                <div>Precio (BOB)</div>
                <div>Cantidad Disponible (USDT)</div>
                <div>Límites (BOB)</div>
            </div>
        `;

        currentBuyOrders.forEach(order => {
            const price = parseFloat(order.adv.price);
            const amount = parseFloat(order.adv.surplusAmount);
            const minLimit = parseFloat(order.adv.minSingleTransAmount) || 0;
            const maxLimit = parseFloat(order.adv.dynamicMaxSingleTransAmount) || 0;
            const username = order.advertiser.nickName;

            html += `
                <div class="order-item">
                    <div class="order-username">${username}</div>
                    <div class="order-price">${formatNumber(price)}</div>
                    <div class="order-amount">${formatNumber(amount)}</div>
                    <div class="order-limits">${formatNumber(minLimit)} - ${formatNumber(maxLimit)}</div>
                </div>
            `;
        });

        ordersListElement.innerHTML = html;
    }
    modal.style.display = "block";
}

// Funciones de API
async function fetchP2PDataPage(tradeType, page) {
    const status = isManualUpdate ? `Obteniendo página ${page} de ${tradeType}...` : '';
    setLoading(true, status);
    
    const payload = {
        page,
        rows: 20,
        payTypes: [],
        asset: "USDT",
        tradeType,
        fiat: "BOB",
        publisherType: null,
        merchantCheck: false,
        transAmount: ""
    };

    try {
        const response = await fetch(BINANCE_P2P_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data.data || [];
    } catch (error) {
        console.error(`Error al obtener datos de la página ${page}:`, error);
        return [];
    }
}

async function fetchAllPages(tradeType) {
    let allData = [];
    let currentPage = 1;
    let hasMoreData = true;

    while (hasMoreData) {
        const pageData = await fetchP2PDataPage(tradeType, currentPage);
        if (pageData.length === 0) {
            hasMoreData = false;
        } else {
            allData = allData.concat(pageData);
            if (pageData.length < 20) {
                hasMoreData = false;
            } else {
                await new Promise(resolve => setTimeout(resolve, 500));
                currentPage++;
            }
        }
    }

    return allData;
}

function calculateMarketStats(buyData, sellData) {
    let stats = {
        totalVolume: 0,
        avgBuyPrice: 0,
        avgSellPrice: 0,
        minBuyPrice: Infinity,
        maxBuyPrice: -Infinity,
        minSellPrice: Infinity,
        maxSellPrice: -Infinity
    };

    if (buyData.length > 0) {
        buyData.forEach(item => {
            const price = parseFloat(item.adv.price) || 0;
            const amount = parseFloat(item.adv.surplusAmount) || 0;
            
            stats.totalVolume += amount;
            
            if (price > 0) {
                stats.minBuyPrice = Math.min(stats.minBuyPrice, price);
                stats.maxBuyPrice = Math.max(stats.maxBuyPrice, price);
                stats.avgBuyPrice += price;
            }
        });
        stats.avgBuyPrice /= buyData.length;
    }

    if (sellData.length > 0) {
        sellData.forEach(item => {
            const price = parseFloat(item.adv.price) || 0;
            if (price > 0) {
                stats.minSellPrice = Math.min(stats.minSellPrice, price);
                stats.maxSellPrice = Math.max(stats.maxSellPrice, price);
                stats.avgSellPrice += price;
            }
        });
        stats.avgSellPrice /= sellData.length;
    }

    return stats;
}

function getLiquidityDescription(spreadPercentage) {
    if (spreadPercentage <= 1) return "Mercado muy líquido: Diferencia menor al 1% entre compra y venta";
    if (spreadPercentage <= 2) return "Mercado líquido: Diferencia entre 1% y 2% entre compra y venta";
    if (spreadPercentage <= 3) return "Liquidez moderada: Diferencia entre 2% y 3% entre compra y venta";
    if (spreadPercentage <= 5) return "Baja liquidez: Diferencia entre 3% y 5% entre compra y venta";
    return "Liquidez muy baja: Diferencia mayor al 5% entre compra y venta";
}

async function updateData(manual = false) {
    if (isUpdating) return;
    isUpdating = true;
    isManualUpdate = manual;

    try {
        const [buyData, sellData] = await Promise.all([
            fetchAllPages('BUY'),
            fetchAllPages('SELL')
        ]);

        currentBuyOrders = buyData;
        const stats = calculateMarketStats(buyData, sellData);
        
        const spread = stats.avgSellPrice - stats.avgBuyPrice;
        const spreadPercentage = (spread / stats.avgBuyPrice) * 100;
        const liquidityDescription = getLiquidityDescription(spreadPercentage);

        // Actualizar UI
        updateValueWithAnimation(totalVolumeElement, formatNumber(stats.totalVolume), true);
        updateValueWithAnimation(avgBuyPriceElement, formatNumber(stats.avgBuyPrice), true);
        updateValueWithAnimation(avgSellPriceElement, formatNumber(stats.avgSellPrice), true);
        updateValueWithAnimation(liquidityIndexElement, formatNumber(Math.abs(spreadPercentage)) + '%', true);
        updateValueWithAnimation(minBuyPriceElement, formatNumber(stats.minBuyPrice), true);
        updateValueWithAnimation(maxBuyPriceElement, formatNumber(stats.maxBuyPrice), true);
        updateValueWithAnimation(minSellPriceElement, formatNumber(stats.minSellPrice), true);
        updateValueWithAnimation(maxSellPriceElement, formatNumber(stats.maxSellPrice), true);
        updateValueWithAnimation(headerMinBuyPriceElement, formatNumber(stats.minBuyPrice), true);
        updateValueWithAnimation(headerMaxSellPriceElement, formatNumber(stats.maxSellPrice), true);
        liquidityDescriptionElement.textContent = liquidityDescription;
        lastUpdateElement.textContent = formatDateTime(new Date());

        liquidityIndexElement.className = 'stat-value ' + 
            (spreadPercentage <= 2 ? 'liquidity-high' : 
             spreadPercentage <= 3 ? 'liquidity-medium' : 
             'liquidity-low');

        if (isFirstLoad) isFirstLoad = false;
    } catch (error) {
        console.error('Error al actualizar datos:', error);
        if (isManualUpdate) setLoading(true, 'Error al actualizar datos. Reintentando...');
    } finally {
        isUpdating = false;
        setLoading(false);
    }
}

// Inicialización
refreshButton.addEventListener('click', () => updateData(true));
updateData(false);
setInterval(() => updateData(false), UPDATE_INTERVAL); 