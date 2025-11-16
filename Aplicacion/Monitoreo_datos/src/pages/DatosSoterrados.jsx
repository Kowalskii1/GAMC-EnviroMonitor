import styled from "styled-components";
import React, { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar,
  PieChart, Pie, Cell,
  ResponsiveContainer
} from "recharts";

const API = "http://localhost:3000/api";

export function DashboardSoterrados() {

  const [vista, setVista] = useState("inicio");

  const [sensores, setSensores] = useState([]);
  const [alertas, setAlertas] = useState([]);

  const [historial, setHistorial] = useState([]);
  const [sensorSeleccionado, setSensorSeleccionado] = useState("");

  // 📌 Cargar estado de sensores y alertas
  useEffect(() => {
    fetch(`${API}/sensores/status`)
      .then(res => res.json())
      .then(data => setSensores(data));

    fetch(`${API}/sensores/alertas`)
      .then(res => res.json())
      .then(data => setAlertas(data));
  }, []);

  // 📌 Cargar historial
  const cargarHistorial = async (deviceName) => {
    setSensorSeleccionado(deviceName);
    const res = await fetch(`${API}/historial/sensor/${deviceName}`);
    const data = await res.json();
    setHistorial(data);
    setVista("historial");
  };

  // 📌 Datos Pie (alertas vs normales)
  const pieData = [
    { name: "En alerta", value: alertas.length },
    { name: "Operativos", value: sensores.length - alertas.length }
  ];

  const COLORS = ["#FF4D4D", "#4CAF50"];

  // 📌 Datos para gráfica de barras (tipos)
  const sensoresPorTipo = Object.values(
    sensores.reduce((acc, s) => {
      const tipo = s.Sensor_type || "Desconocido";
      acc[tipo] = acc[tipo] || { tipo, cantidad: 0 };
      acc[tipo].cantidad++;
      return acc;
    }, {})
  );

  // 📌 Items del menú superior
  const menuItems = [
    { id: "inicio", label: "Inicio" },
    { id: "estado", label: "Estado General" },
    { id: "tipos", label: "Sensores por Tipo" },
    { id: "lista", label: "Lista Sensores" },
    { id: "historial", label: "Historial" }
  ];

  return (
    <Container>

      {/* ---------------- MENÚ SUPERIOR ---------------- */}
      <Navbar>
        {menuItems.map(item => (
          <NavItem
            key={item.id}
            active={vista === item.id}
            onClick={() => setVista(item.id)}
          >
            {item.label}
          </NavItem>
        ))}
      </Navbar>

      <h1>Dashboard Datos Soterrados</h1>

      {/* ---------------- VISTA: INICIO ---------------- */}
      {vista === "inicio" && (
        <Section>
          <h2>Bienvenido</h2>
          <p>Seleccione una opción del menú superior para ver información.</p>
        </Section>
      )}

      {/* ---------------- VISTA: ESTADO GENERAL ---------------- */}
      {vista === "estado" && (
        <Section>
          <h2>Estado General</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                label
                outerRadius={90}
              >
                {pieData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ---------------- VISTA: SENSORES POR TIPO ---------------- */}
      {vista === "tipos" && (
        <Section>
          <h2>Sensores por Tipo</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sensoresPorTipo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tipo" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="cantidad" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </Section>
      )}

      {/* ---------------- VISTA: LISTA DE SENSORES ---------------- */}
      {vista === "lista" && (
        <Section>
          <h2>Lista de Sensores</h2>
          <SensorGrid>
            {sensores.map((s) => (
              <SensorItem key={s.devEui} onClick={() => cargarHistorial(s.deviceName)}>
                <h3>{s.deviceName}</h3>
                <p><strong>Dato:</strong> {s.data}</p>
                <p><strong>Hora:</strong> {s.time}</p>
                <p><strong>Dirección:</strong> {s.device_address}</p>
              </SensorItem>
            ))}
          </SensorGrid>
        </Section>
      )}

      {/* ---------------- VISTA: HISTORIAL ---------------- */}
      {vista === "historial" && (
        <Section>
          <h2>Historial de Sensores</h2>

          {/* SELECTOR DE SENSOR */}
          <SelectSensor>
            <label>Seleccionar sensor: </label>
            <select
              value={sensorSeleccionado}
              onChange={(e) => cargarHistorial(e.target.value)}
            >
              <option value="">-- Seleccione un sensor --</option>
              {sensores.map((s) => (
                <option key={s.devEui} value={s.deviceName}>
                  {s.deviceName}
                </option>
              ))}
            </select>
          </SelectSensor>

          {!sensorSeleccionado && (
            <p>Seleccione un sensor para ver su historial.</p>
          )}

          {sensorSeleccionado && historial.length > 0 && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={historial}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" hide />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="data" stroke="#2196F3" />
              </LineChart>
            </ResponsiveContainer>
          )}

        </Section>
      )}

    </Container>
  );
}

/* ---------------------- ESTILOS ---------------------- */

const Container = styled.div`
  padding: 20px;
`;

const Navbar = styled.div`
  display: flex;
  gap: 20px;
  padding: 15px;
  background: #ffffff;
  border-bottom: 2px solid #ddd;
  margin-bottom: 20px;
`;

const NavItem = styled.div`
  cursor: pointer;
  font-weight: ${(p) => (p.active ? "bold" : "normal")};
  border-bottom: ${(p) => (p.active ? "3px solid #333" : "none")};

  &:hover {
    color: #0077ff;
  }
`;

const Section = styled.div`
  margin-top: 20px;
`;

const SensorGrid = styled.div`
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
`;

const SensorItem = styled.div`
  background: #fff;
  padding: 15px;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);

  &:hover {
    background: #f0f0f0;
  }
`;

const SelectSensor = styled.div`
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
  align-items: center;

  label {
    font-weight: bold;
  }

  select {
    padding: 8px;
    border-radius: 5px;
    border: 1px solid #999;
  }
`;
