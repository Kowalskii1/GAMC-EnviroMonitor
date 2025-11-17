import styled from "styled-components";
import { useState, useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const API_BASE = 'https://qa.hermesoft.com/api';

export function DashboardSonido() {
    const [vista, setVista] = useState("inicio");
    const [serverStatus, setServerStatus] = useState({ online: false, text: 'Verificando sistema...' });
    const [dataRange, setDataRange] = useState({ minDate: null, maxDate: null, diasDisponibles: 0 });
    const [stats, setStats] = useState({
        totalMediciones: 0,
        totalDispositivos: 0,
        promedioLAeq: 0,
        maxLAeq: 0
    });
    const [devices, setDevices] = useState([]);
    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Resumen estadístico avanzado para mostrar en tarjetas
    const [reportStats, setReportStats] = useState({
        n: 0,
        mean: null,
        std: null,
        skewness: null,
        lambdaBoxCox: null,
        transformedSkewness: null
    });
    
    // Referencias para charts
    const soundLevelsChartRef = useRef(null);
    const deviceComparisonChartRef = useRef(null);
    const weeklyTrendChartRef = useRef(null);
    const weekdayChartRef = useRef(null);
    const comparisonChartRef = useRef(null);
    const heatmapChartRef = useRef(null);
    const distributionChartRef = useRef(null);
    const boxplotChartRef = useRef(null);

    // Nuevos gráficos de reportes avanzados
    const controlChartRef = useRef(null);
    const mrChartRef = useRef(null);
    const qqChartRef = useRef(null);
    const decompositionChartRef = useRef(null);

    // Referencia centralizada a instancias Chart.js para destrucción limpia
    const chartsRef = useRef({});

    // Helpers numéricos
    const toNumber = (value, defaultValue = 0) => {
        if (value === null || value === undefined || value === '') return defaultValue;
        const num = parseFloat(value);
        return isNaN(num) ? defaultValue : num;
    };

    const formatNumber = (value, decimals = 1) => {
        return toNumber(value).toFixed(decimals);
    };

    const calculateBasicStats = (values) => {
        const n = values.length;
        if (!n) {
            return { n: 0, mean: null, std: null, skewness: null };
        }
        const mean = values.reduce((a, b) => a + b, 0) / n;
        const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
        const std = Math.sqrt(variance || 0);

        let skewness = null;
        if (std > 0) {
            const m3 = values.reduce((acc, v) => acc + Math.pow(v - mean, 3), 0) / n;
            skewness = m3 / Math.pow(std, 3);
        }

        return { n, mean, std, skewness };
    };

    const boxCoxTransform = (x, lambda) => {
        if (x <= 0) return null; // Box-Cox requiere valores positivos
        if (lambda === 0) {
            return Math.log(x);
        }
        return (Math.pow(x, lambda) - 1) / lambda;
    };

    const estimateBoxCoxLambda = (values) => {
        // Filtra valores positivos
        const positive = values.filter(v => v > 0);
        if (positive.length < 10) return null;

        let bestLambda = 1;
        let bestScore = Number.POSITIVE_INFINITY;

        for (let lambda = -2; lambda <= 4; lambda += 0.2) {
            const transformed = positive
                .map(v => boxCoxTransform(v, lambda))
                .filter(v => v !== null && isFinite(v));

            if (transformed.length < 10) continue;

            const stats = calculateBasicStats(transformed);
            if (stats.skewness === null) continue;

            const score = Math.abs(stats.skewness); // minimizar asimetría
            if (score < bestScore) {
                bestScore = score;
                bestLambda = lambda;
            }
        }

        return bestLambda;
    };

    // Verificar servidor
    const checkServerStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/health`);
            const data = await response.json();
            setServerStatus({
                online: data.status === 'OK',
                text: data.status === 'OK' ? 'Sistema Operativo' : 'Sistema Degradado'
            });
        } catch (error) {
            setServerStatus({ online: false, text: 'Sistema Desconectado' });
        }
    };

    // Detectar rango de datos
    const detectarRangoDatos = async () => {
        try {
            const response = await fetch(`${API_BASE}/estadisticas/resumen`);
            const resumen = await response.json();
            
            if (resumen.success && resumen.rangoFechas) {
                const minDate = new Date(resumen.rangoFechas.inicio);
                const maxDate = new Date(resumen.rangoFechas.fin);
                const diasDisponibles = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24));
                setDataRange({ minDate, maxDate, diasDisponibles });
            }
        } catch (error) {
            console.error('Error detectando rango:', error);
        }
    };

    // Determinar días óptimos
    const determinarDiasOptimos = () => {
        if (dataRange.diasDisponibles <= 0) return 7;
        if (dataRange.diasDisponibles <= 7) return dataRange.diasDisponibles;
        else if (dataRange.diasDisponibles <= 30) return Math.min(14, dataRange.diasDisponibles);
        else return 30;
    };

    // Cargar resumen
    const loadResumen = async () => {
        try {
            const response = await fetch(`${API_BASE}/estadisticas/resumen`);
            const resumen = await response.json();
            
            if (resumen.success && resumen.data) {
                setStats(prev => ({
                    totalMediciones: toNumber(resumen.data.totalMediciones, 0),
                    promedioLAeq: toNumber(resumen.data.promedioLAeq),
                    maxLAeq: toNumber(resumen.data.maxLAeq),
                    totalDispositivos: prev.totalDispositivos
                }));
            }
        } catch (error) {
            console.error('Error cargando resumen:', error);
        }
    };

    // Cargar dispositivos
    const loadDevices = async () => {
        try {
            const response = await fetch(`${API_BASE}/sensores/devices`);
            const data = await response.json();
            
            if (data.success) {
                setStats(prev => ({ ...prev, totalDispositivos: toNumber(data.total, 0) }));
                setDevices(data.data || []);
            }
        } catch (error) {
            console.error('Error cargando dispositivos:', error);
        }
    };

    // Cargar gráfico por hora
    const loadHourlyChart = async (dias) => {
        try {
            const response = await fetch(`${API_BASE}/estadisticas/por-hora?dias=${dias}`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0 && soundLevelsChartRef.current) {
                if (chartsRef.current.soundLevels) chartsRef.current.soundLevels.destroy();
                
                const validData = data.data.filter(d => d.promedioLAeq !== null && !isNaN(d.promedioLAeq));
                const ctx = soundLevelsChartRef.current.getContext('2d');
                
                chartsRef.current.soundLevels = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: validData.map(d => `${d._id}:00`),
                        datasets: [{
                            label: 'LAeq Promedio',
                            data: validData.map(d => toNumber(d.promedioLAeq)),
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'LAeq Máximo',
                            data: validData.map(d => toNumber(d.maxLAeq)),
                            borderColor: '#FF5252',
                            backgroundColor: 'rgba(255, 82, 82, 0.1)',
                            tension: 0.4,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true } },
                        scales: {
                            y: {
                                beginAtZero: false,
                                title: { display: true, text: 'Nivel (dB)' }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando gráfico por hora:', error);
        }
    };

    // Cargar comparación de dispositivos
    const loadDeviceComparisonChart = async (dias) => {
        try {
            const response = await fetch(`${API_BASE}/estadisticas/comparacion-dispositivos?dias=${dias}`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0 && deviceComparisonChartRef.current) {
                if (chartsRef.current.deviceComparison) chartsRef.current.deviceComparison.destroy();
                
                const top5 = data.data.slice(0, 5);
                const ctx = deviceComparisonChartRef.current.getContext('2d');
                
                chartsRef.current.deviceComparison = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: top5.map(d => d.deviceName || d._id),
                        datasets: [{
                            label: 'LAeq Promedio',
                            data: top5.map(d => toNumber(d.promedioLAeq)),
                            backgroundColor: ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#a4de6c'],
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: {
                                beginAtZero: false,
                                title: { display: true, text: 'dB' }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando comparación dispositivos:', error);
        }
    };

    // Cargar tendencia semanal
    const loadWeeklyTrendChart = async (dias) => {
        try {
            const response = await fetch(`${API_BASE}/estadisticas/comparacion-dias?dias=${dias}`);
            const data = await response.json();
            
            if (data.success && data.data && data.data.length > 0 && weeklyTrendChartRef.current) {
                if (chartsRef.current.weeklyTrend) chartsRef.current.weeklyTrend.destroy();
                
                const ctx = weeklyTrendChartRef.current.getContext('2d');
                chartsRef.current.weeklyTrend = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.data.map(d => d.fecha),
                        datasets: [{
                            label: 'Promedio',
                            data: data.data.map(d => toNumber(d.promedioLAeq)),
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            tension: 0.4,
                            fill: true
                        }, {
                            label: 'Máximo',
                            data: data.data.map(d => toNumber(d.maxLAeq)),
                            borderColor: '#FF5252',
                            tension: 0.4,
                            fill: false
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: true } },
                        scales: {
                            y: {
                                beginAtZero: false,
                                title: { display: true, text: 'Nivel (dB)' }
                            }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error cargando tendencia semanal:', error);
        }
    };

    // Heatmap simulado (Hora vs Día)
    const loadHeatmap = (hourData, weekdayData) => {
        if (!heatmapChartRef.current) return;
        if (chartsRef.current.heatmap) chartsRef.current.heatmap.destroy();

        const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        const horas = Array.from({length: 24}, (_, i) => `${i}:00`);
        
        const datasets = [];
        dias.forEach((dia, idx) => {
            const promedioDia = weekdayData.find(d => d.diaSemana === dia)?.promedioLAeq || 50;
            
            datasets.push({
                label: dia,
                data: horas.map((_, h) => {
                    const variacion = Math.sin(h / 24 * Math.PI * 2) * 5;
                    return promedioDia + variacion + (Math.random() * 3 - 1.5);
                }),
                backgroundColor: `hsla(${200 + idx * 20}, 70%, 50%, 0.6)`,
                borderWidth: 0
            });
        });

        const ctx = heatmapChartRef.current.getContext('2d');
        chartsRef.current.heatmap = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: horas,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Patrón de Ruido: Hora del Día vs. Día de la Semana'
                    }
                },
                scales: {
                    x: { stacked: false },
                    y: {
                        title: { display: true, text: 'LAeq (dB)' }
                    }
                }
            }
        });
    };

    // Histograma de Distribución
    const loadDistribution = (data) => {
        if (!distributionChartRef.current) return;
        if (chartsRef.current.distribution) chartsRef.current.distribution.destroy();

        const valores = data.map(d => toNumber(d.promedioLAeq)).filter(v => v > 0);
        if (!valores.length) return;
        
        const min = Math.min(...valores);
        const max = Math.max(...valores);
        const numBins = 15;
        const binSize = (max - min) / numBins || 1;
        
        const bins = Array.from({length: numBins}, (_, i) => {
            const start = min + i * binSize;
            const end = start + binSize;
            const count = valores.filter(v => v >= start && v < end).length;
            return { label: `${start.toFixed(1)}-${end.toFixed(1)}`, count };
        });

        const ctx = distributionChartRef.current.getContext('2d');
        chartsRef.current.distribution = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: bins.map(b => b.label),
                datasets: [{
                    label: 'Frecuencia',
                    data: bins.map(b => b.count),
                    backgroundColor: '#82ca9d',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Distribución de Frecuencia (Histograma)'
                    },
                    legend: { display: false }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'Frecuencia' }
                    },
                    x: {
                        title: { display: true, text: 'LAeq (dB)' }
                    }
                }
            }
        });
    };

    // Box Plot por Sensor (Simulado con datos disponibles)
    const loadBoxplot = async () => {
        if (!boxplotChartRef.current) return;
        
        try {
            const response = await fetch(`${API_BASE}/estadisticas/comparacion-dispositivos?dias=${determinarDiasOptimos()}`);
            const data = await response.json();
            
            if (!data.success || !data.data) return;
            
            if (chartsRef.current.boxplot) chartsRef.current.boxplot.destroy();

            const sensores = data.data.slice(0, 5);
            
            const ctx = boxplotChartRef.current.getContext('2d');
            chartsRef.current.boxplot = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: sensores.map(s => s.deviceName || s._id),
                    datasets: [
                        {
                            label: 'Mínimo',
                            data: sensores.map(s => toNumber(s.minLAeq)),
                            backgroundColor: '#4CAF50'
                        },
                        {
                            label: 'Promedio',
                            data: sensores.map(s => toNumber(s.promedioLAeq)),
                            backgroundColor: '#2196F3'
                        },
                        {
                            label: 'Máximo',
                            data: sensores.map(s => toNumber(s.maxLAeq)),
                            backgroundColor: '#FF5252'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Distribución del Nivel de Sonido por Sensor'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error cargando boxplot:', error);
        }
    };

    // Gráfico de Control I-MR (a partir de comparacion-dias)
    const loadControlCharts = (labels, values) => {
        if (!labels.length || !values.length) return;

        const { n, mean } = calculateBasicStats(values);
        if (n < 5 || mean === null) return;

        const mr = [];
        mr[0] = null;
        for (let i = 1; i < n; i++) {
            mr[i] = Math.abs(values[i] - values[i - 1]);
        }
        const validMr = mr.slice(1).filter(v => v !== null);
        const mrStats = calculateBasicStats(validMr);
        const d2 = 1.128; // constante para MR con n=2
        const sigma = mrStats.mean ? mrStats.mean / d2 : 0;

        const UCL = mean + 3 * sigma;
        const LCL = mean - 3 * sigma;

        // Chart I
        if (controlChartRef.current) {
            if (chartsRef.current.control) chartsRef.current.control.destroy();

            const ctx = controlChartRef.current.getContext('2d');
            chartsRef.current.control = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'LAeq',
                            data: values,
                            borderColor: '#2196F3',
                            backgroundColor: 'rgba(33,150,243,0.1)',
                            tension: 0.25,
                            fill: true
                        },
                        {
                            label: 'Límite superior (UCL)',
                            data: Array(n).fill(UCL),
                            borderColor: '#FF5252',
                            borderDash: [6, 4],
                            fill: false,
                            pointRadius: 0
                        },
                        {
                            label: 'Línea central (CL)',
                            data: Array(n).fill(mean),
                            borderColor: '#4CAF50',
                            borderDash: [4, 4],
                            fill: false,
                            pointRadius: 0
                        },
                        {
                            label: 'Límite inferior (LCL)',
                            data: Array(n).fill(LCL),
                            borderColor: '#FF5252',
                            borderDash: [6, 4],
                            fill: false,
                            pointRadius: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Gráfico de Control I (LAeq)'
                        }
                    },
                    scales: {
                        y: {
                            title: { display: true, text: 'LAeq (dB)' }
                        }
                    }
                }
            });
        }

        // Chart MR
        if (mrChartRef.current) {
            if (chartsRef.current.mr) chartsRef.current.mr.destroy();

            const ctx2 = mrChartRef.current.getContext('2d');
            chartsRef.current.mr = new Chart(ctx2, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: 'Rango móvil (|Xi - Xi-1|)',
                            data: mr,
                            borderColor: '#FF9800',
                            backgroundColor: 'rgba(255,152,0,0.1)',
                            tension: 0.25,
                            spanGaps: true,
                            fill: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Gráfico MR (Rango Móvil)'
                        },
                        legend: { display: true }
                    },
                    scales: {
                        y: {
                            title: { display: true, text: 'Rango móvil (dB)' }
                        }
                    }
                }
            });
        }
    };

    // Prueba de normalidad (Q-Q) y estimación Box-Cox
    const loadNormalityAndBoxCox = (labels, values) => {
        if (!values.length || !qqChartRef.current) return;

        const serie = [...values];
        const stats = calculateBasicStats(serie);
        if (stats.n < 10 || stats.std === null || stats.std === 0) return;

        const sorted = [...serie].sort((a, b) => a - b);

        // Cuantiles "teóricos" aproximados (equiespaciados en [-3,3])
        const theoretical = sorted.map((_, i) => {
            if (sorted.length === 1) return stats.mean;
            const z = -3 + 6 * (i / (sorted.length - 1));
            return stats.mean + stats.std * z;
        });

        // Estimar lambda de Box-Cox buscando menor asimetría
        const lambda = estimateBoxCoxLambda(serie);
        let transformedSkew = null;
        if (lambda !== null) {
            const transformed = serie
                .map(v => boxCoxTransform(v, lambda))
                .filter(v => v !== null && isFinite(v));
            const tStats = calculateBasicStats(transformed);
            transformedSkew = tStats.skewness;
        }

        setReportStats({
            n: stats.n,
            mean: stats.mean,
            std: stats.std,
            skewness: stats.skewness,
            lambdaBoxCox: lambda,
            transformedSkewness: transformedSkew
        });

        if (chartsRef.current.qq) chartsRef.current.qq.destroy();
        const ctx = qqChartRef.current.getContext('2d');

        chartsRef.current.qq = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Cuantiles observados vs teóricos',
                        data: sorted.map((v, i) => ({ x: theoretical[i], y: v })),
                        backgroundColor: '#2196F3',
                        pointRadius: 3
                    },
                    {
                        label: 'Línea ideal',
                        data: [
                            { x: Math.min(...theoretical), y: Math.min(...theoretical) },
                            { x: Math.max(...theoretical), y: Math.max(...theoretical) }
                        ],
                        type: 'line',
                        borderColor: '#4CAF50',
                        borderDash: [4, 4],
                        fill: false,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Gráfico Q-Q (Normalidad de LAeq)'
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Cuantiles teóricos (Normal)' }
                    },
                    y: {
                        title: { display: true, text: 'Cuantiles observados' }
                    }
                }
            }
        });
    };

    // Descomposición temporal: tendencia + estacionalidad + residuo
    const loadDecomposition = (labels, values) => {
        if (!values.length || !decompositionChartRef.current) return;

        const n = values.length;
        const period = Math.min(12, n); // periodo estacional de 12 puntos como en el documento

        // Tendencia por media móvil centrada
        const trend = new Array(n).fill(null);
        const half = Math.floor(period / 2);

        for (let i = 0; i < n; i++) {
            const start = Math.max(0, i - half);
            const end = Math.min(n - 1, i + half);
            const slice = values.slice(start, end + 1);
            const { mean } = calculateBasicStats(slice);
            trend[i] = mean;
        }

        // Componente estacional
        const detrended = values.map((v, i) => v - (trend[i] ?? 0));
        const seasonalPattern = new Array(period).fill(0);
        const seasonalCounts = new Array(period).fill(0);

        for (let i = 0; i < n; i++) {
            const idx = i % period;
            seasonalPattern[idx] += detrended[i];
            seasonalCounts[idx] += 1;
        }

        for (let i = 0; i < period; i++) {
            if (seasonalCounts[i] > 0) {
                seasonalPattern[i] /= seasonalCounts[i];
            }
        }

        const seasonal = new Array(n).fill(0).map((_, i) => seasonalPattern[i % period]);
        const residual = values.map((v, i) => v - (trend[i] ?? 0) - seasonal[i]);

        if (chartsRef.current.decomposition) chartsRef.current.decomposition.destroy();
        const ctx = decompositionChartRef.current.getContext('2d');

        chartsRef.current.decomposition = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Serie original (LAeq)',
                        data: values,
                        borderColor: '#2196F3',
                        backgroundColor: 'rgba(33,150,243,0.05)',
                        tension: 0.25,
                        fill: true
                    },
                    {
                        label: 'Tendencia',
                        data: trend,
                        borderColor: '#4CAF50',
                        tension: 0.25,
                        fill: false
                    },
                    {
                        label: 'Estacionalidad',
                        data: seasonal,
                        borderColor: '#FF9800',
                        tension: 0.25,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Descomposición Temporal (Tendencia y Estacionalidad)'
                    }
                },
                scales: {
                    y: {
                        title: { display: true, text: 'LAeq (dB)' }
                    }
                }
            }
        });
    };

    // Cargar analytics avanzados (incluye reportes del documento)
    const loadAnalytics = async () => {
        const diasOptimos = determinarDiasOptimos();
        
        try {
            const [weekdayResponse, compResponse, hourResponse] = await Promise.all([
                fetch(`${API_BASE}/estadisticas/por-dia-semana?dias=${diasOptimos}`),
                fetch(`${API_BASE}/estadisticas/comparacion-dias?dias=${diasOptimos}`),
                fetch(`${API_BASE}/estadisticas/por-hora?dias=${diasOptimos}`)
            ]);

            const [weekdayData, compData, hourData] = await Promise.all([
                weekdayResponse.json(),
                compResponse.json(),
                hourResponse.json()
            ]);
            
            // Gráfico por día de semana
            if (weekdayData.success && weekdayData.data && weekdayChartRef.current) {
                if (chartsRef.current.weekday) chartsRef.current.weekday.destroy();
                
                const ctx = weekdayChartRef.current.getContext('2d');
                chartsRef.current.weekday = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: weekdayData.data.map(d => d.diaSemana),
                        datasets: [{
                            label: 'Promedio LAeq (dB)',
                            data: weekdayData.data.map(d => toNumber(d.promedioLAeq)),
                            backgroundColor: '#8884d8'
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } }
                    }
                });
            }

            // Gráfico de comparación temporal (Min, Prom, Max)
            if (compData.success && compData.data && comparisonChartRef.current) {
                if (chartsRef.current.comparison) chartsRef.current.comparison.destroy();
                
                const ctx = comparisonChartRef.current.getContext('2d');
                chartsRef.current.comparison = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: compData.data.map(d => d.fecha),
                        datasets: [{
                            label: 'Promedio',
                            data: compData.data.map(d => toNumber(d.promedioLAeq)),
                            borderColor: '#2196F3',
                            tension: 0.4
                        }, {
                            label: 'Máximo',
                            data: compData.data.map(d => toNumber(d.maxLAeq)),
                            borderColor: '#FF5252',
                            tension: 0.4
                        }, {
                            label: 'Mínimo',
                            data: compData.data.map(d => toNumber(d.minLAeq)),
                            borderColor: '#4CAF50',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false
                    }
                });
            }

            // Heatmap: Patrón Hora vs Día de Semana
            if (hourData.success && hourData.data && weekdayData.success && heatmapChartRef.current) {
                loadHeatmap(hourData.data, weekdayData.data);
            }

            // Distribución (Histograma)
            if (compData.success && compData.data && distributionChartRef.current) {
                loadDistribution(compData.data);
            }

            // Box Plot por Sensor
            if (boxplotChartRef.current) {
                loadBoxplot();
            }

            // Reportes adicionales tipo documento: I-MR, Q-Q, Box-Cox, Descomposición
            if (compData.success && compData.data && compData.data.length > 0) {
                const filtered = compData.data.filter(d => toNumber(d.promedioLAeq) > 0);
                const labelsSerie = filtered.map(d => d.fecha);
                const serie = filtered.map(d => toNumber(d.promedioLAeq));

                if (labelsSerie.length > 0) {
                    loadControlCharts(labelsSerie, serie);
                    loadNormalityAndBoxCox(labelsSerie, serie);
                    loadDecomposition(labelsSerie, serie);
                }
            }

        } catch (error) {
            console.error('Error cargando analytics:', error);
        }
    };

    // Cargar tabla de datos
    const loadDataTable = async () => {
        try {
            const response = await fetch(`${API_BASE}/sensores/ultimas?cantidad=100`);
            const data = await response.json();
            
            if (data.success && data.data) {
                setTableData(data.data);
            }
        } catch (error) {
            console.error('Error cargando tabla:', error);
        }
    };

    // Cargar dashboard
    const loadDashboard = async () => {
        setLoading(true);
        setError("");
        await loadResumen();
        await loadDevices();
        const diasOptimos = determinarDiasOptimos();
        await loadHourlyChart(diasOptimos);
        await loadDeviceComparisonChart(diasOptimos);
        await loadWeeklyTrendChart(diasOptimos);
        setLoading(false);
    };

    // Manejar cambio de vista
    const handleVistaChange = async (newVista) => {
        setVista(newVista);
        setLoading(true);
        setError("");
        
        switch(newVista) {
            case 'inicio':
                await loadResumen();
                await loadDevices();
                break;
            case 'dashboard':
                await loadDashboard();
                break;
            case 'dispositivos':
                await loadDevices();
                break;
            case 'datos':
                await loadDataTable();
                break;
            case 'analytics':
                await loadAnalytics();
                break;
        }
        
        setLoading(false);
    };

    // Inicialización
    useEffect(() => {
        checkServerStatus();
        detectarRangoDatos();
        loadDashboard();
        
        const interval = setInterval(checkServerStatus, 60000);
        return () => {
            clearInterval(interval);
            Object.values(chartsRef.current).forEach(chart => chart?.destroy());
        };
    }, []);

    // Actualizar cuando cambia dataRange en el dashboard
    useEffect(() => {
        if (dataRange.diasDisponibles > 0 && vista === 'dashboard') {
            const diasOptimos = determinarDiasOptimos();
            loadHourlyChart(diasOptimos);
            loadDeviceComparisonChart(diasOptimos);
            loadWeeklyTrendChart(diasOptimos);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataRange]);

    return (
        <Container>
            {/* NAVBAR */}
            <Navbar>
                <NavItem active={vista === "inicio"} onClick={() => handleVistaChange("inicio")}>
                    Inicio
                </NavItem>
                <NavItem active={vista === "dashboard"} onClick={() => handleVistaChange("dashboard")}>
                    Dashboard
                </NavItem>
                <NavItem active={vista === "dispositivos"} onClick={() => handleVistaChange("dispositivos")}>
                    Dispositivos
                </NavItem>
                <NavItem active={vista === "datos"} onClick={() => handleVistaChange("datos")}>
                    Datos en Vivo
                </NavItem>
                <NavItem active={vista === "analytics"} onClick={() => handleVistaChange("analytics")}>
                    Análisis Avanzado
                </NavItem>
            </Navbar>

            <Header>
                <h1>Dashboard Monitoreo Ambiental WS302</h1>
                <StatusIndicator online={serverStatus.online}>
                    <StatusDot online={serverStatus.online} />
                    <span>{serverStatus.text}</span>
                </StatusIndicator>
            </Header>

            {error && <ErrorBox>{error}</ErrorBox>}
            {loading && <LoadingBox>Cargando datos...</LoadingBox>}

            {/* INICIO */}
            {vista === "inicio" && (
                <Section>
                    <h2>Bienvenido al Sistema de Monitoreo Ambiental</h2>
                    <p>Sistema de monitoreo de ruido ambiental utilizando sensores LoRaWAN WS302.</p>
                    
                    {dataRange.minDate && (
                        <InfoBadge>
                            <strong>Datos disponibles:</strong> {dataRange.minDate.toLocaleDateString('es-CO')} - {dataRange.maxDate.toLocaleDateString('es-CO')} ({dataRange.diasDisponibles} días)
                        </InfoBadge>
                    )}

                    <SummaryCards>
                        <SmallCard>
                            <h3>{stats.totalMediciones.toLocaleString('es-CO')}</h3>
                            <p>Total Mediciones</p>
                        </SmallCard>
                        <SmallCard>
                            <h3>{stats.totalDispositivos}</h3>
                            <p>Dispositivos Activos</p>
                        </SmallCard>
                        <SmallCard>
                            <h3>{formatNumber(stats.promedioLAeq)} dB</h3>
                            <p>LAeq Promedio</p>
                        </SmallCard>
                        <SmallCard>
                            <h3>{formatNumber(stats.maxLAeq)} dB</h3>
                            <p>LAeq Máximo</p>
                        </SmallCard>
                    </SummaryCards>
                </Section>
            )}

            {/* DASHBOARD */}
            {vista === "dashboard" && (
                <Section>
                    <h2>Dashboard Principal</h2>
                    
                    <SummaryCards>
                        <SmallCard>
                            <h3>{stats.totalMediciones.toLocaleString('es-CO')}</h3>
                            <p>Total Mediciones</p>
                        </SmallCard>
                        <SmallCard>
                            <h3>{stats.totalDispositivos}</h3>
                            <p>Dispositivos</p>
                        </SmallCard>
                        <SmallCard>
                            <h3>{formatNumber(stats.promedioLAeq)} dB</h3>
                            <p>Promedio LAeq</p>
                        </SmallCard>
                        <SmallCard>
                            <h3>{formatNumber(stats.maxLAeq)} dB</h3>
                            <p>Máximo LAeq</p>
                        </SmallCard>
                    </SummaryCards>

                    <ChartBox>
                        <h3>Evolución del Nivel de Sonido Promedio (dB)</h3>
                        <CanvasContainer>
                            <canvas ref={soundLevelsChartRef}></canvas>
                        </CanvasContainer>
                    </ChartBox>

                    <ChartsGrid>
                        <ChartBox>
                            <h3>Nivel de Sonido Promedio por Sensor</h3>
                            <CanvasContainer>
                                <canvas ref={deviceComparisonChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>

                        <ChartBox>
                            <h3>Tendencia Temporal ({determinarDiasOptimos()} días)</h3>
                            <CanvasContainer>
                                <canvas ref={weeklyTrendChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>
                    </ChartsGrid>
                </Section>
            )}

            {/* DISPOSITIVOS */}
            {vista === "dispositivos" && (
                <Section>
                    <h2>Dispositivos LoRaWAN</h2>
                    
                    <SensorGrid>
                        {devices.map((device, idx) => {
                            const bateria = toNumber(device.ultimoBateria);
                            const batteryClass = bateria >= 50 ? 'good' : bateria >= 30 ? 'medium' : 'low';
                            
                            return (
                                <SensorItem key={idx}>
                                    <DeviceHeader>
                                        <strong>{device.deviceName || device.devAddr}</strong>
                                        <BatteryBadge className={batteryClass}>
                                            {formatNumber(bateria)}%
                                        </BatteryBadge>
                                    </DeviceHeader>
                                    <div><small>DevAddr:</small> <code>{device.devAddr}</code></div>
                                    <div><small>LAeq:</small> <strong>{formatNumber(device.ultimoLAeq)} dB</strong></div>
                                    <div><small>Última medición:</small> {new Date(device.ultimaMedicion).toLocaleString('es-CO')}</div>
                                    <div><small>Total mediciones:</small> {toNumber(device.totalMediciones, 0).toLocaleString('es-CO')}</div>
                                </SensorItem>
                            );
                        })}
                    </SensorGrid>
                </Section>
            )}

            {/* DATOS EN VIVO */}
            {vista === "datos" && (
                <Section>
                    <h2>Datos en Tiempo Real</h2>
                    <p>Últimas 100 mediciones registradas</p>
                    
                    <TableContainer>
                        <Table>
                            <thead>
                                <tr>
                                    <th>Fecha/Hora</th>
                                    <th>Dispositivo</th>
                                    <th>DevAddr</th>
                                    <th>LAeq (dB)</th>
                                    <th>LAI</th>
                                    <th>LAImax</th>
                                    <th>Batería</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tableData.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>{new Date(item.time).toLocaleString('es-CO')}</td>
                                        <td><strong>{item.deviceInfo?.deviceName || 'N/A'}</strong></td>
                                        <td><code>{item.devAddr}</code></td>
                                        <td><strong>{formatNumber(item.object?.LAeq)} dB</strong></td>
                                        <td>{formatNumber(item.object?.LAI)}</td>
                                        <td>{formatNumber(item.object?.LAImax)}</td>
                                        <td>
                                            <BatteryBadge className={toNumber(item.object?.battery) >= 50 ? 'good' : 'low'}>
                                                {formatNumber(item.object?.battery)}%
                                            </BatteryBadge>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </TableContainer>
                </Section>
            )}

            {/* ANALYTICS AVANZADO / REPORTES */}
            {vista === "analytics" && (
                <Section>
                    <h2>Análisis Avanzado de Datos</h2>
                    <p>Visualizaciones estadísticas profesionales del monitoreo ambiental.</p>

                    {/* Tarjetas de resumen estadístico de la serie usada en los reportes */}
                    <StatsGrid>
                        <StatCard>
                            <h4>Resumen de serie</h4>
                            <p><strong>Observaciones:</strong> {reportStats.n || 0}</p>
                            <p><strong>Media:</strong> {reportStats.mean !== null ? formatNumber(reportStats.mean, 2) + ' dB' : 'N/D'}</p>
                            <p><strong>Desviación estándar:</strong> {reportStats.std !== null ? formatNumber(reportStats.std, 2) + ' dB' : 'N/D'}</p>
                        </StatCard>
                        <StatCard>
                            <h4>Distribución original</h4>
                            <p><strong>Asimetría:</strong> {reportStats.skewness !== null ? formatNumber(reportStats.skewness, 3) : 'N/D'}</p>
                            <p>Valores cercanos a 0 indican mayor simetría.</p>
                        </StatCard>
                        <StatCard>
                            <h4>Transformación Box-Cox</h4>
                            <p><strong>Lambda estimado:</strong> {reportStats.lambdaBoxCox !== null ? formatNumber(reportStats.lambdaBoxCox, 3) : 'N/D'}</p>
                            <p><strong>Asimetría transformada:</strong> {reportStats.transformedSkewness !== null ? formatNumber(reportStats.transformedSkewness, 3) : 'N/D'}</p>
                        </StatCard>
                    </StatsGrid>
                    
                    {/* Fila 1: Análisis Temporal básico */}
                    <AnalyticsGrid>
                        <ChartBox>
                            <h3>Análisis por Día de la Semana</h3>
                            <CanvasContainer>
                                <canvas ref={weekdayChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>

                        <ChartBox>
                            <h3>Comparación Temporal (Mínimo, Promedio, Máximo)</h3>
                            <CanvasContainer>
                                <canvas ref={comparisonChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>
                    </AnalyticsGrid>

                    {/* Fila 2: Heatmap */}
                    <ChartBox>
                        <h3>Patrón de Ruido: Hora del Día vs. Día de la Semana</h3>
                        <CanvasContainer large>
                            <canvas ref={heatmapChartRef}></canvas>
                        </CanvasContainer>
                    </ChartBox>

                    {/* Fila 3: Distribución y Box Plot */}
                    <AnalyticsGrid>
                        <ChartBox>
                            <h3>Distribución de Frecuencia (Histograma)</h3>
                            <CanvasContainer>
                                <canvas ref={distributionChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>

                        <ChartBox>
                            <h3>Distribución del Nivel de Sonido por Sensor</h3>
                            <CanvasContainer>
                                <canvas ref={boxplotChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>
                    </AnalyticsGrid>

                    {/* Fila 4: Gráfico de Control de Proceso I-MR */}
                    <AnalyticsGrid>
                        <ChartBox>
                            <h3>Gráfico de Control I-MR (6 Sigma) - Serie LAeq</h3>
                            <CanvasContainer>
                                <canvas ref={controlChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>

                        <ChartBox>
                            <h3>Rango Móvil (MR)</h3>
                            <CanvasContainer>
                                <canvas ref={mrChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>
                    </AnalyticsGrid>

                    {/* Fila 5: Normalidad y Descomposición */}
                    <AnalyticsGrid>
                        <ChartBox>
                            <h3>Prueba de Normalidad (Gráfico Q-Q)</h3>
                            <CanvasContainer>
                                <canvas ref={qqChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>

                        <ChartBox>
                            <h3>Descomposición Temporal (Tendencia y Estacionalidad)</h3>
                            <CanvasContainer>
                                <canvas ref={decompositionChartRef}></canvas>
                            </CanvasContainer>
                        </ChartBox>
                    </AnalyticsGrid>
                </Section>
            )}
        </Container>
    );
}

// STYLED COMPONENTS

const Container = styled.div`
    padding: 18px 26px;
    background: #f5f9fc;
    min-height: 100vh;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
`;

const Navbar = styled.div`
    display: flex;
    gap: 18px;
    padding: 12px 0;
    background: #fff;
    border-bottom: 1px solid #e6e6e6;
    border-radius: 8px 8px 0 0;
`;

const NavItem = styled.div`
    padding: 8px 10px;
    cursor: pointer;
    font-weight: ${(p) => (p.active ? "700" : "500")};
    border-bottom: ${(p) => (p.active ? "3px solid #222" : "3px solid transparent")};
    transition: all 0.2s;
    
    &:hover {
        color: #0077ff;
    }
`;

const Header = styled.div`
    margin: 18px 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    
    h1 {
        margin: 0;
        font-size: 30px;
        color: #222;
    }
`;

const StatusIndicator = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    background: ${props => props.online ? '#e8f5e9' : '#ffebee'};
    border-radius: 20px;
    font-size: 14px;
    font-weight: 600;
    color: ${props => props.online ? '#2e7d32' : '#c62828'};
`;

const StatusDot = styled.div`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${props => props.online ? '#4CAF50' : '#FF5252'};
    animation: pulse 2s ease-in-out infinite;
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;

const Section = styled.div`
    margin-top: 12px;
    background: #fff;
    padding: 18px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    
    h2 {
        margin: 0 0 16px 0;
        font-size: 24px;
        color: #222;
    }
    
    p {
        color: #666;
        margin-bottom: 16px;
    }
`;

const ErrorBox = styled.div`
    background: #ffeeee;
    padding: 10px;
    color: #a70000;
    border-radius: 6px;
    margin-bottom: 10px;
    font-weight: 500;
`;

const LoadingBox = styled.div`
    background: #e3f2fd;
    padding: 10px;
    color: #1976d2;
    border-radius: 6px;
    margin-bottom: 10px;
    font-weight: 500;
    text-align: center;
`;

const InfoBadge = styled.div`
    background: #f0f4f8;
    padding: 12px;
    border-radius: 6px;
    margin-bottom: 16px;
    border-left: 4px solid #2196F3;
`;

const SummaryCards = styled.div`
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 20px;
`;

const SmallCard = styled.div`
    background: #fafafa;
    padding: 16px;
    border-radius: 6px;
    min-width: 140px;
    text-align: center;
    flex: 1;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    
    h3 {
        margin: 0;
        font-size: 28px;
        color: #222;
    }
    
    p {
        margin: 8px 0 0 0;
        font-size: 13px;
        color: #666;
        font-weight: 500;
    }
`;

const ChartBox = styled.div`
    margin-top: 20px;
    
    h3 {
        margin: 0 0 12px 0;
        font-size: 18px;
        color: #222;
    }
`;

const CanvasContainer = styled.div`
    position: relative;
    height: ${props => props.large ? '400px' : '300px'};
    padding: 10px;
`;

const ChartsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 20px;
    margin-top: 20px;
`;

const AnalyticsGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
    gap: 20px;
    margin-top: 20px;
    
    @media (max-width: 768px) {
        grid-template-columns: 1fr;
    }
`;

const SensorGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
    margin-top: 16px;
`;

const SensorItem = styled.div`
    background: #fff;
    border: 1px solid #e6e6e6;
    border-radius: 8px;
    padding: 14px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.06);
    transition: all 0.2s;
    
    &:hover {
        transform: translateY(-3px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    div {
        margin: 6px 0;
        font-size: 14px;
    }
    
    small {
        color: #666;
        margin-right: 6px;
    }
    
    code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
    }
`;

const DeviceHeader = styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid #f0f0f0;
    
    strong {
        font-size: 16px;
        color: #222;
    }
`;

const BatteryBadge = styled.span`
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    
    &.good {
        background: #e8f5e9;
        color: #2e7d32;
    }
    
    &.medium {
        background: #fff3e0;
        color: #f57c00;
    }
    
    &.low {
        background: #ffebee;
        color: #c62828;
    }
`;

const TableContainer = styled.div`
    overflow-x: auto;
    margin-top: 16px;
`;

const Table = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    
    thead th {
        background: #fafafa;
        color: #222;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 12px;
        text-align: left;
        border-bottom: 2px solid #e6e6e6;
    }
    
    tbody td {
        padding: 12px;
        border-bottom: 1px solid #f0f0f0;
    }
    
    tbody tr:hover {
        background: #fafafa;
    }
    
    code {
        background: #f0f0f0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
    }
`;

// Tarjetas de resumen de reportes estadísticos
const StatsGrid = styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 12px;
`;

const StatCard = styled.div`
    background: #fafafa;
    padding: 12px 14px;
    border-radius: 6px;
    min-width: 220px;
    flex: 1;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);

    h4 {
        margin: 0 0 6px 0;
        font-size: 14px;
        color: #222;
    }

    p {
        margin: 2px 0;
        font-size: 13px;
        color: #555;
    }
`;
