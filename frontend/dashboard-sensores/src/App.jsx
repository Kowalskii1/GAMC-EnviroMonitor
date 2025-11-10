import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { 
  LayoutDashboard, 
  AlertTriangle, 
  CheckCircle, 
  BarChart3, 
  FileText, 
  Loader2, 
  ServerCrash, 
  MapPin, 
  Calendar, 
  Clock, 
  Tag 
} from 'lucide-react';

// --- CONSTANTES ---
const API_BASE_URL = "http://localhost:3000";

// --- COMPONENTES AUXILIARES ---

/**
 * Muestra un ícono de carga giratorio.
 */
const LoadingSpinner = ({ className = '' }) => (
  <div className={`flex justify-center items-center p-10 ${className}`}>
    <Loader2 className="animate-spin h-12 w-12 text-blue-500" />
  </div>
);

/**
 * Muestra un mensaje de error.
 */
const ErrorMessage = ({ message }) => (
  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-center shadow-md">
    <ServerCrash className="h-6 w-6 mr-3 flex-shrink-0" />
    <div>
      <p className="font-bold">Error en la API</p>
      <p className="text-sm">{message || "No se pudo conectar con el servidor."}</p>
    </div>
  </div>
);

/**
 * Tarjeta individual para mostrar el estado de un sensor.
 */
const SensorCard = ({ sensor }) => {
  const isAlert = sensor.data === "0";
  const statusConfig = {
    "0": {
      text: "Alerta",
      icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
      bg: "bg-gradient-to-br from-red-50 to-red-100 border-red-300",
      textClass: "text-red-600 font-bold"
    },
    "1": {
      text: "Normal",
      icon: <CheckCircle className="h-6 w-6 text-green-600" />,
      bg: "bg-gradient-to-br from-green-50 to-green-100 border-green-300",
      textClass: "text-green-600 font-bold"
    },
  };

  const config = statusConfig[sensor.data] || {
    text: "Desconocido",
    icon: <Tag className="h-6 w-6 text-gray-500" />,
    bg: "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300",
    textClass: "text-gray-600"
  };

  return (
    <div className={`shadow-lg rounded-xl p-5 border ${config.bg} flex flex-col justify-between transform transition-all hover:scale-105 hover:shadow-xl bg-white`}> {/* Fondo blanco forzado */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xl font-semibold text-gray-800 truncate leading-tight" title={sensor.deviceName}>
          {sensor.deviceName}
        </h3>
        {config.icon}
      </div>
      <p className="text-sm text-gray-600 mb-4 flex items-center">
        <MapPin className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
        <span className="truncate">{sensor.device_address || "Ubicación Desconocida"}</span>
      </p>
      <div className="text-center bg-gray-50 rounded-lg p-3 shadow-inner"> {/* Fondo interno gris claro */}
        <span className={`text-2xl ${config.textClass} uppercase tracking-wide`}>{config.text}</span>
      </div>
      <p className="text-xs text-gray-500 mt-4 text-right flex items-center justify-end">
        <Clock className="h-3 w-3 mr-1" />
        <span className="whitespace-nowrap">Última lectura: {new Date(sensor.time).toLocaleString('es-ES')}</span>
      </p>
    </div>
  );
};

/**
 * Tabla para mostrar datos de reportes.
 */
const ReporteTabla = ({ data }) => {
  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500 p-6 bg-white rounded-lg shadow-md">No hay datos para mostrar con los criterios seleccionados.</p>;
  }

  const headers = Object.keys(data[0]).filter(key => key !== '_id');

  return (
    <div className="overflow-x-auto shadow-xl rounded-xl border border-gray-200 max-h-[600px] overflow-y-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            {headers.map(header => (
              <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                {header.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, index) => (
            <tr key={row._id || index} className="hover:bg-blue-50 transition-colors">
              {headers.map(header => (
                <td key={`${row._id || index}-${header}`} className="px-6 py-4 whitespace-nowGrap text-sm text-gray-800">
                  {header === 'time' ? new Date(row[header]).toLocaleString('es-ES') : String(row[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- VISTAS PRINCIPALES ---

/**
 * Vista del Dashboard: Muestra Alertas y Estado General.
 */
const DashboardView = () => {
  const [status, setStatus] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [statusRes, alertasRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sensores/status`),
          fetch(`${API_BASE_URL}/api/sensores/alertas`)
        ]);

        if (!statusRes.ok || !alertasRes.ok) {
          throw new Error('Error al obtener los datos del dashboard');
        }

        const statusData = await statusRes.json();
        const alertasData = await alertasRes.json();

        setStatus(statusData);
        setAlertas(alertasData);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="space-y-10">
      {/* Sección de Alertas */}
      <section>
        <h2 className="text-3xl font-extrabold text-red-700 mb-6 flex items-center">
          <AlertTriangle className="mr-3 h-8 w-8" />
          Alertas Activas ({alertas.length})
        </h2>
        {alertas.length === 0 ? (
          <p className="text-lg text-gray-700 bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <CheckCircle className="inline-block mr-2 text-green-500" />
            ¡Todo tranquilo! No hay sensores en estado de alerta actualmente.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {alertas.map(sensor => (
              <SensorCard key={sensor.deviceName} sensor={sensor} />
            ))}
          </div>
        )}
      </section>

      {/* Sección de Estado General */}
      <section>
        <h2 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
          <LayoutDashboard className="mr-3 h-8 w-8" />
          Estado General ({status.length})
        </h2>
        {status.length === 0 ? (
           <p className="text-lg text-gray-700 bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
             No se encontraron sensores en el sistema.
           </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {status.map(sensor => (
              <SensorCard key={sensor.deviceName} sensor={sensor} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/**
 * Vista de Historial: Gráfica por sensor.
 */
const HistorialView = () => {
  const [sensoresList, setSensoresList] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSensores = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/sensores/unicos`);
        if (!res.ok) throw new Error('No se pudo cargar la lista de sensores');
        const data = await res.json();
        setSensoresList(data);
        if (data.length > 0 && !selectedSensor) {
          // No seleccionamos uno por defecto para que el usuario elija
          // setSelectedSensor(data[0]);
        }
      } catch (e) {
        setError(e.message);
      }
    };
    fetchSensores();
  }, []); // Solo se ejecuta una vez al montar

  useEffect(() => {
    if (!selectedSensor) {
      setHistorial([]); // Limpia el historial si no hay sensor seleccionado
      return;
    }

    const fetchHistorial = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/historial/sensor/${selectedSensor}`);
        if (!res.ok) throw new Error(`Error al cargar historial de ${selectedSensor}`);
        const data = await res.json();
        setHistorial(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchHistorial();
  }, [selectedSensor]); // Se ejecuta CADA VEZ que selectedSensor cambia

  const chartData = useMemo(() => {
    return historial
      .map(d => ({
        time: new Date(d.time).getTime(),
        timeLabel: new Date(d.time).toLocaleString('es-ES', {hour: '2-digit', minute:'2-digit', day: '2-digit', month: '2-digit'}),
        dataVal: parseInt(d.data, 10)
      }))
      .sort((a, b) => a.time - b.time);
  }, [historial]);

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <label htmlFor="sensor-select" className="block text-lg font-semibold text-gray-800 mb-3">
          Selecciona un Sensor para ver su historial:
        </label>
        <select
          id="sensor-select"
          value={selectedSensor}
          onChange={(e) => setSelectedSensor(e.target.value)}
          className="block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-gray-50 hover:border-blue-400 transition-colors"
        >
          <option value="">-- Elige un sensor --</option>
          {sensoresList.map(sensorName => (
            <option key={sensorName} value={sensorName}>{sensorName}</option>
          ))}
        </select>
      </div>

      {error && <ErrorMessage message={error} />}
      
      {loading && <LoadingSpinner />}

      {!loading && !error && selectedSensor && historial.length > 0 && (
        <div className="bg-white p-6 rounded-xl shadow-lg h-[500px] border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-5">Historial de Estado: <span className="text-blue-600">{selectedSensor}</span></h3>
          <ResponsiveContainer width="100%" height="calc(100% - 40px)">
            <LineChart
              data={chartData}
              margin={{ top: 15, right: 40, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="timeLabel"
                tick={{ fontSize: 11, fill: '#555' }}
                angle={-45}
                textAnchor="end"
                height={60}
              />
              <YAxis 
                domain={[-0.1, 1.1]}
                ticks={[0, 1]} 
                tickFormatter={(val) => (val === 0 ? 'Alerta' : 'Normal')} 
                tick={{ fontSize: 12, fill: '#555' }}
                width={80}
              />
              <Tooltip
                contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', border: '1px solid #ccc', borderRadius: '8px', padding: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontWeight: 'bold', color: '#333' }}
                itemStyle={{ color: '#666' }}
                formatter={(value) => [value === 0 ? 'Alerta' : 'Normal', 'Estado']}
                labelFormatter={(label) => `Fecha/Hora: ${label}`}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Line
                type="stepAfter"
                dataKey="dataVal" 
                name="Estado (0=Alerta, 1=Normal)" 
                stroke="#4f46e5"
                strokeWidth={3}
                dot={{ r: 4, fill: '#4f46e5', stroke: '#fff', strokeWidth: 1 }}
                activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && !error && selectedSensor && historial.length === 0 && (
        <p className="text-lg text-gray-700 bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
          No hay datos de historial disponibles para el sensor <span className="font-semibold text-blue-600">{selectedSensor}</span> en la base de datos.
        </p>
      )}
    </div>
  );
};

/**
 * Vista de Reportes: Consultas por fechas, ubicación, etc.
 */
const ReportesView = () => {
  const [reportType, setReportType] = useState('sensorFecha');
  const [formData, setFormData] = useState({
    deviceName: '',
    fechaInicio: '',
    fechaFin: '',
    direccion: ''
  });
  const [sensoresList, setSensoresList] = useState([]);
  const [ubicacionesList, setUbicacionesList] = useState([]);
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDropdowns = async () => {
      try {
        const [sensoresRes, ubicacionesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/sensores/unicos`),
          fetch(`${API_BASE_URL}/api/ubicaciones/unicas`)
        ]);
        setSensoresList(await sensoresRes.json());
        setUbicacionesList(await ubicacionesRes.json());
      } catch (e) {
        setError("No se pudieron cargar las listas de filtros.");
      }
    };
    fetchDropdowns();
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReportData(null);

    let url = `${API_BASE_URL}/api/`;
    const params = new URLSearchParams();

    try {
      if (reportType === 'sensorFecha') {
        if (!formData.deviceName || !formData.fechaInicio || !formData.fechaFin) {
          throw new Error("Se requieren sensor, fecha de inicio y fecha de fin.");
        }
        url += 'historial/reporte';
        params.append('deviceName', formData.deviceName);
        params.append('fechaInicio', new Date(formData.fechaInicio).toISOString());
        params.append('fechaFin', new Date(formData.fechaFin).toISOString());
      } else if (reportType === 'soloFechas') {
        if (!formData.fechaInicio || !formData.fechaFin) {
          throw new Error("Se requieren fecha de inicio y fecha de fin.");
        }
        url += 'historial/fechas';
        params.append('fechaInicio', new Date(formData.fechaInicio).toISOString());
        params.append('fechaFin', new Date(formData.fechaFin).toISOString());
      } else if (reportType === 'ubicacion') {
        if (!formData.direccion) {
          throw new Error("Se requiere una ubicación.");
        }
        url += 'sensores/ubicacion';
        params.append('direccion', formData.direccion);
      }

      const res = await fetch(`${url}?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `Error al generar el reporte: ${res.statusText}`);
      }
      const data = await res.json();
      setReportData(data);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [reportType, formData]);

  const renderFormInputs = () => {
    const commonClasses = "mt-1 block w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-gray-700 bg-gray-50";

    switch (reportType) {
      case 'sensorFecha':
        return (
          <>
            <div className="flex-1 min-w-[250px]">
              <label htmlFor="deviceName" className="block text-sm font-medium text-gray-700 mb-1">Sensor</label>
              <select name="deviceName" value={formData.deviceName} onChange={handleInputChange} className={commonClasses}>
                <option value="">-- Selecciona un sensor --</option>
                {sensoresList.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="fechaInicio" className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora Inicio</label>
              <input type="datetime-local" name="fechaInicio" value={formData.fechaInicio} onChange={handleInputChange} className={commonClasses} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="fechaFin" className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora Fin</label>
              <input type="datetime-local" name="fechaFin" value={formData.fechaFin} onChange={handleInputChange} className={commonClasses} />
            </div>
          </>
        );
      case 'soloFechas':
        return (
          <>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="fechaInicio" className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora Inicio</label>
              <input type="datetime-local" name="fechaInicio" value={formData.fechaInicio} onChange={handleInputChange} className={commonClasses} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="fechaFin" className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora Fin</label>
              <input type="datetime-local" name="fechaFin" value={formData.fechaFin} onChange={handleInputChange} className={commonClasses} />
            </div>
          </>
        );
      case 'ubicacion':
        return (
          <div className="flex-1 min-w-[250px]">
            <label htmlFor="direccion" className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
            <select name="direccion" value={formData.direccion} onChange={handleInputChange} className={commonClasses}>
              <option value="">-- Selecciona una ubicación --</option>
              {ubicacionesList.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-10">
      {/* Formulario de Filtros */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 space-y-6">
        <div className="flex border-b border-gray-200">
          <button type="button" onClick={() => setReportType('sensorFecha')} className={`py-3 px-6 text-lg font-medium transition-colors ${reportType === 'sensorFecha' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-500'}`}>
            <BarChart3 className="inline-block mr-2" /> Sensor y Fechas
          </button>
          <button type="button" onClick={() => setReportType('soloFechas')} className={`py-3 px-6 text-lg font-medium transition-colors ${reportType === 'soloFechas' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-500'}`}>
            <Calendar className="inline-block mr-2" /> Por Fechas
          </button>
          <button type="button" onClick={() => setReportType('ubicacion')} className={`py-3 px-6 text-lg font-medium transition-colors ${reportType === 'ubicacion' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-blue-500'}`}>
            <MapPin className="inline-block mr-2" /> Por Ubicación
          </button>
        </div>
        
        <div className="flex flex-wrap items-end gap-5 p-4 bg-slate-50 rounded-lg border border-slate-200">
          {renderFormInputs()}
          <button type="submit" disabled={loading} className="bg-blue-600 text-white py-3 px-6 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 self-end text-lg font-medium transition-colors flex items-center">
            {loading ? <Loader2 className="animate-spin mr-2" /> : <FileText className="mr-2" />}
            {loading ? "Generando..." : "Generar Reporte"}
          </button>
        </div>
      </form>

      {/* Resultados */}
      {error && <ErrorMessage message={error} />}
      {loading && <LoadingSpinner />}
      {reportData && (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-5 flex items-center">
            <FileText className="mr-3 text-blue-600" /> Resultados del Reporte
          </h3>
          <ReporteTabla data={reportData} />
        </div>
      )}
    </div>
  );
};


// --- NUEVOS COMPONENTES DE LAYOUT ---

/**
 * El menú lateral de navegación
 */
const Sidebar = ({ activeView, setActiveView }) => {
  const NavItem = ({ viewName, icon, label }) => (
    <button
      onClick={() => setActiveView(viewName)}
      className={`flex items-center w-full px-4 py-3 rounded-lg transition-colors ${
        activeView === viewName
          ? 'bg-blue-600 text-white shadow-lg'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="ml-3 font-medium">{label}</span>
    </button>
  );

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col p-4 shadow-2xl fixed">
      {/* Logo/Título del Sidebar */}
      <div className="py-4 px-2 mb-6 text-center">
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          SENSORES
        </h2>
        <p className="text-xs text-blue-300">GAMC</p>
      </div>

      {/* Navegación */}
      <nav className="flex flex-col space-y-3">
        <NavItem 
          viewName="dashboard" 
          label="Dashboard" 
          icon={<LayoutDashboard className="h-6 w-6" />} 
        />
        <NavItem 
          viewName="historial" 
          label="Historial (Gráfica)" 
          icon={<BarChart3 className="h-6 w-6" />} 
        />
        <NavItem 
          viewName="reportes" 
          label="Reportes" 
          icon={<FileText className="h-6 w-6" />} 
        />
      </nav>
      
      {/* Footer del Sidebar */}
      <div className="mt-auto text-center text-xs text-gray-500">
        <p>&copy; {new Date().getFullYear()} GAMC</p>
        <p>Monitoreo Inteligente</p>
      </div>
    </div>
  );
};

/**
 * El encabezado del área de contenido principal
 */
const Header = ({ activeView }) => {
  const titles = {
    dashboard: "Dashboard",
    historial: "Historial de Sensores",
    reportes: "Generador de Reportes"
  };

  return (
    <header className="bg-white shadow-md rounded-xl mx-6 mt-6 p-6 border border-gray-200">
      <h1 className="text-3xl font-bold text-gray-900">
        {titles[activeView] || "Monitor de Sensores"}
      </h1>
      <p className="text-gray-600 mt-1">Gestión de Activos y Mantenimiento de Calidad</p>
    </header>
  );
};


// --- COMPONENTE PRINCIPAL (Rediseñado con Sidebar) ---

/**
 * Aplicación principal
 */
export default function App() {
  const [activeView, setActiveView] = useState('dashboard'); // 'dashboard', 'historial', 'reportes'

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'historial':
        return <HistorialView />;
      case 'reportes':
        return <ReportesView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans antialiased text-gray-800">
      
      {/* Menú Lateral (Sidebar) */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} />

      {/* Contenido Principal (con scroll) */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto ml-64"> {/* ml-64 para dejar espacio al sidebar */}
        
        {/* Encabezado del Contenido */}
        <Header activeView={activeView} />

        {/* Contenido de la Vista Activa */}
        <main className="flex-1 p-6 md:p-8">
          {renderView()}
        </main>

      </div>
    </div>
  );
}