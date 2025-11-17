import styled from "styled-components";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer
} from "recharts";

const API = "http://localhost:3000/api";

export function DashboardSoterrados() {
  const [vista, setVista] = useState("inicio");

  // Lista principal
  const [sensores, setSensores] = useState([]);
  const [alertas, setAlertas] = useState([]);

  // Historial
  const [historial, setHistorial] = useState([]);
  const [sensorSeleccionado, setSensorSeleccionado] = useState("");

  // Estadísticas
  const [subVistaEstadisticas, setSubVistaEstadisticas] = useState("movingAvg");
  const [statsSource, setStatsSource] = useState("latest");
  const [statsDevice, setStatsDevice] = useState("");
  const [computedData, setComputedData] = useState([]);
  const [histogramData, setHistogramData] = useState([]);
  const [rawStatsData, setRawStatsData] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStatusAndAlerts();
  }, []);

  async function fetchStatusAndAlerts() {
    try {
      const resStatus = await fetch(`${API}/sensores/status`);
      const resAlerts = await fetch(`${API}/sensores/alertas`);

      const status = await resStatus.json();
      const cleaned = status.map(s => ({
        ...s,
        data: Number(s.data),
        latitude: Number(s.latitude),
        longitude: Number(s.longitude),
      }));

      setSensores(cleaned);
      setAlertas(await resAlerts.json());
    } catch (e) {
      setError("No se pudieron cargar los sensores.");
    }
  }

  //Historial
  async function cargarHistorial(deviceName) {
    if (!deviceName) return;
    setSensorSeleccionado(deviceName);
    setLoading(true);

    try {
      const res = await fetch(`${API}/historial/sensor/${deviceName}`);
      const arr = await res.json();

      const cleaned = arr
        .map(d => ({ ...d, data: Number(d.data) }))
        .sort((a, b) => new Date(a.time) - new Date(b.time));

      setHistorial(cleaned);
      setVista("historial");
    } catch {
      setError("No se pudo cargar historial.");
    }

    setLoading(false);
  }
  //Estadisticas
  async function fetchStatsSource() {
    setComputedData([]);
    setHistogramData([]);
    setRawStatsData([]);
    setLoading(true);

    try {
      if (statsSource === "latest") {
        const res = await fetch(`${API}/sensores/status`);
        const arr = await res.json();
        const dev = arr.find(s => s.deviceName === statsDevice);

        if (!dev) {
          setLoading(false);
          return setError("Sensor no encontrado en últimos datos");
        }

        const datum = { time: dev.time, data: Number(dev.data) };
        setRawStatsData([datum]);
        prepareComputed([datum]);
      }

      if (statsSource === "historial") {
        if (!statsDevice) {
          setLoading(false);
          return setError("Seleccione un sensor.");
        }

        const res = await fetch(`${API}/historial/sensor/${statsDevice}`);
        const arr = await res.json();

        const cleaned = arr
          .map(d => ({ ...d, data: Number(d.data) }))
          .sort((a, b) => new Date(a.time) - new Date(b.time));

        setRawStatsData(cleaned);
        prepareComputed(cleaned);
      }

    } catch {
      setError("Error cargando estadísticas");
    }

    setLoading(false);
  }

  //Calculos
  function movingAverageArr(arr, w = 5) {
    return arr.map((d, i) => {
      const start = Math.max(0, i - w + 1);
      const window = arr.slice(start, i + 1).map(x => x.data);
      const avg = window.reduce((a, b) => a + b, 0) / window.length;
      return { ...d, movingAvg: avg };
    });
  }

  function rollingStdArr(arr, w = 5) {
    return arr.map((d, i) => {
      const start = Math.max(0, i - w + 1);
      const window = arr.slice(start, i + 1).map(x => x.data);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
      return { ...d, rollingStd: Math.sqrt(variance) };
    });
  }

  function addDeviationBands(arr, w = 5) {
    const ma = movingAverageArr(arr, w);
    const rs = rollingStdArr(arr, w);

    return ma.map((d, i) => ({
      ...d,
      upper: d.movingAvg + rs[i].rollingStd,
      lower: d.movingAvg - rs[i].rollingStd
    }));
  }

  function buildHistogram(arr) {
    const values = arr.map(d => d.data);
    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) return [{ rango: `${min} - ${max}`, cantidad: values.length }];

    const bins = Math.floor(Math.sqrt(values.length));
    const binSize = (max - min) / bins;

    const hist = Array.from({ length: bins }, (_, i) => ({
      rango: `${(min + binSize * i).toFixed(2)} - ${(min + binSize * (i + 1)).toFixed(2)}`,
      cantidad: 0
    }));

    values.forEach(v => {
      let idx = Math.floor((v - min) / binSize);
      if (idx >= bins) idx = bins - 1;
      hist[idx].cantidad++;
    });

    return hist;
  }

  function prepareComputed(arr) {
    const bands = addDeviationBands(arr, 5);
    const hist = buildHistogram(arr);
    setComputedData(bands);
    setHistogramData(hist);
  }

  const sensoresPorTipo = useMemo(() => {
    return Object.values(
      sensores.reduce((acc, s) => {
        const t = s.Sensor_type || "Desconocido";
        acc[t] = acc[t] || { tipo: t, cantidad: 0 };
        acc[t].cantidad++;
        return acc;
      }, {})
    );
  }, [sensores]);


  //UI
  return (
    <Container>
      {/* NAVBAR */}
      <Navbar>
        <NavItem active={vista === "inicio"} onClick={() => setVista("inicio")}>Inicio</NavItem>
        <NavItem active={vista === "estado"} onClick={() => setVista("estado")}>Estado General</NavItem>
        <NavItem active={vista === "tipos"} onClick={() => setVista("tipos")}>Sensores por Tipo</NavItem>
        <NavItem active={vista === "lista"} onClick={() => setVista("lista")}>Lista Sensores</NavItem>
        <NavItem active={vista === "historial"} onClick={() => setVista("historial")}>Historial</NavItem>
        <NavItem active={vista === "estadisticas"} onClick={() => setVista("estadisticas")}>Estadísticas</NavItem>
      </Navbar>

      <Header>
        <h1>Dashboard Datos Soterrados</h1>
      </Header>

      {error && <ErrorBox>{error}</ErrorBox>}

      {}
      {vista === "inicio" && (
        <Section>
          <h2>Bienvenido</h2>
        </Section>
      )}

      {}
      {vista === "estado" && (
        <Section>
          <h2>Estado General</h2>
          <SummaryCards>
            <SmallCard><h3>{sensores.length}</h3><p>Sensores totales</p></SmallCard>
            <SmallCard><h3>{alertas.length}</h3><p>Alertas</p></SmallCard>
            <SmallCard><h3>{sensores.length - alertas.length}</h3><p>Operativos</p></SmallCard>
          </SummaryCards>

          <ChartBox>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Alertas", value: alertas.length },
                    { name: "Operativos", value: sensores.length - alertas.length }
                  ]}
                  dataKey="value"
                  label
                  outerRadius={90}
                >
                  <Cell fill="#FF5252" />
                  <Cell fill="#4CAF50" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      )}

      {}
      {vista === "tipos" && (
        <Section>
          <h2>Sensores por Tipo</h2>

          <ChartBox>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={sensoresPorTipo}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tipo" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cantidad" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </ChartBox>
        </Section>
      )}

      {}
      {vista === "lista" && (
        <Section>
          <h2>Lista de Sensores</h2>
          {/* TARJETAS */}
          <SensorGrid>
            {sensores.map(s => (
              <SensorItem key={s.devEui} onClick={() => cargarHistorial(s.deviceName)}>
                <strong>{s.deviceName}</strong>
                <div>Dato: {String(s.data)}</div>
                <div>Hora: {s.time}</div>
                <div>Dirección: {s.device_address}</div>
              </SensorItem>
            ))}
          </SensorGrid>
        </Section>
      )}

      {}
      {vista === "historial" && (
        <Section>
          <h2>Historial de Sensores</h2>

          <SelectSensor>
            <label>Sensor:</label>
            <select
              value={sensorSeleccionado}
              onChange={e => cargarHistorial(e.target.value)}
            >
              <option value="">-- Seleccione --</option>
              {sensores.map(s => (
                <option key={s.devEui} value={s.deviceName}>
                  {s.deviceName}
                </option>
              ))}
            </select>
          </SelectSensor>

          {loading && <p>Cargando...</p>}
          {!loading && historial.length === 0 && <p>No hay datos.</p>}

          {historial.length > 0 && (
            <ChartBox>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={historial}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleString()} />
                  <YAxis />
                  <Tooltip labelFormatter={t => new Date(t).toLocaleString()} />
                  <Line type="monotone" dataKey="data" stroke="#2196F3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}
        </Section>
      )}

      {}
      {vista === "estadisticas" && (
        <Section>
          <h2>Estadísticas</h2>

          <SubNavbar>
            <SubNavItem active={subVistaEstadisticas === "movingAvg"} onClick={() => setSubVistaEstadisticas("movingAvg")}>Media móvil</SubNavItem>
            <SubNavItem active={subVistaEstadisticas === "spline"} onClick={() => setSubVistaEstadisticas("spline")}>Curva suavizada</SubNavItem>
            <SubNavItem active={subVistaEstadisticas === "variability"} onClick={() => setSubVistaEstadisticas("variability")}>Variabilidad</SubNavItem>
            <SubNavItem active={subVistaEstadisticas === "histogram"} onClick={() => setSubVistaEstadisticas("histogram")}>Histograma</SubNavItem>
          </SubNavbar>

          <ControlsRow>
            <div>
              <label>Fuente:</label>
              <select value={statsSource} onChange={e => setStatsSource(e.target.value)}>
                <option value="latest">Últimos</option>
                <option value="historial">Historial completo</option>
              </select>
            </div>

            <div>
              <label>Sensor:</label>
              <select value={statsDevice} onChange={e => setStatsDevice(e.target.value)}>
                <option value="">-- Seleccione --</option>
                {sensores.map(s => (
                  <option key={s.devEui} value={s.deviceName}>{s.deviceName}</option>
                ))}
              </select>
            </div>

            <div>
              <button onClick={fetchStatsSource}>Cargar</button>
            </div>
          </ControlsRow>

          {}
          {subVistaEstadisticas === "movingAvg" && computedData.length > 0 && (
            <ChartBox>
              <h3>Media móvil</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={computedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleString()} />
                  <YAxis />
                  <Tooltip labelFormatter={t => new Date(t).toLocaleString()} />
                  <Line type="monotone" dataKey="data" stroke="#999" dot={false} />
                  <Line type="monotone" dataKey="movingAvg" stroke="#FFAA00" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}

          {}
          {subVistaEstadisticas === "spline" && computedData.length > 0 && (
            <ChartBox>
              <h3>Curva Suavizada</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={computedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleString()} />
                  <YAxis />
                  <Tooltip labelFormatter={t => new Date(t).toLocaleString()} />
                  <Line type="natural" dataKey="movingAvg" stroke="#0077FF" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}

          {}
          {subVistaEstadisticas === "variability" && computedData.length > 0 && (
            <ChartBox>
              <h3>Variabilidad (±σ)</h3>
              <ResponsiveContainer width="100%" height={330}>
                <LineChart data={computedData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tickFormatter={t => new Date(t).toLocaleString()} />
                  <YAxis />
                  <Tooltip labelFormatter={t => new Date(t).toLocaleString()} />
                  <Line type="monotone" dataKey="upper" stroke="#FF4444" strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="lower" stroke="#FF4444" strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="movingAvg" stroke="#000" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartBox>
          )}

          {}
          {subVistaEstadisticas === "histogram" && histogramData.length > 0 && (
            <ChartBox>
              <h3>Histograma</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={histogramData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rango" angle={-30} textAnchor="end" interval={0} height={50} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="cantidad" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </ChartBox>
          )}

        </Section>
      )}

    </Container>
  );
}

//Styles

const Container = styled.div`
  padding: 18px 26px;
  background: #f5f9fc;
  min-height: 100vh;
`;

const Navbar = styled.div`
  display: flex;
  gap: 18px;
  padding: 12px 0;
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
`;

const NavItem = styled.div`
  padding: 8px 10px;
  cursor: pointer;
  font-weight: ${(p) => (p.active ? "700" : "500")};
  border-bottom: ${(p) => (p.active ? "3px solid #222" : "3px solid transparent")};
  &:hover { color: #0077ff; }
`;

const Header = styled.div`
  margin: 18px 0;
  h1 { margin: 0; font-size: 30px; color: #222; }
`;

const Section = styled.div`
  margin-top: 12px;
  background: #fff;
  padding: 18px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
`;

const SummaryCards = styled.div`
  display: flex;
  gap: 12px;
`;

const SmallCard = styled.div`
  background: #fafafa;
  padding: 12px;
  border-radius: 6px;
  min-width: 140px;
  text-align: center;
`;

const SensorGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
`;

const SensorItem = styled.div`
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
  cursor: pointer;
  &:hover { transform: translateY(-3px); transition: 0.2s; }
`;

const SelectSensor = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
`;

const ChartBox = styled.div`
  margin-top: 12px;
`;

const MapBox = styled.div`
  margin-top: 20px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0,0,0,0.1);
`;

const SubNavbar = styled.div`
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
`;

const SubNavItem = styled.div`
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 6px;
  background: ${(p) => (p.active ? "#eef3f8" : "transparent")};
  &:hover { background: #eef3f8; }
`;

const ControlsRow = styled.div`
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
  flex-wrap: wrap;

  select {
    padding: 6px;
    border-radius: 6px;
  }

  button {
    padding: 8px 12px;
    background: #0077ff;
    color: white;
    border-radius: 6px;
    border: none;
    cursor: pointer;
  }
`;

const ErrorBox = styled.div`
  background: #ffeeee;
  padding: 10px;
  color: #a70000;
  border-radius: 6px;
  margin-bottom: 10px;
`;

