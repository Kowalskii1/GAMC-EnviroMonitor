# 🌍 Sistema en Tiempo Real para la Captura, Análisis, Visualización y Monitoreo de Datos de Medio Ambiente Subterráneo GAMC-EnviroMonitor

Este proyecto tiene como objetivo desarrollar un sistema de **Big Data en tiempo real** que permita la captura, limpieza, almacenamiento, análisis y visualización de datos ambientales —con enfoque en variables subterráneas como aire (CO₂), contaminación acústica y parámetros soterrados— con el fin de monitorear variables críticas del entorno y facilitar la toma de decisiones mediante técnicas de análisis de datos y Machine Learning.

---

## 🧩 Arquitectura General

El sistema se compone de las siguientes etapas:

### 1. Ingesta de Datos  
- Los datos son obtenidos a partir de sensores, archivos de texto (.txt) o archivos Excel (.xlsx) con mediciones del medio ambiente: concentración de CO₂, niveles de ruido, parámetros subterráneos (temperatura, humedad, gases, etc.).  
- En futuras versiones se planea integrar flujos en tiempo real mediante protocolos como MQTT o plataformas como Kafka.

### 2. Limpieza y Preprocesamiento  
Implementado en Python utilizando:  
- `pandas` → para lectura, limpieza y manipulación de datos estructurados.  
- `NumPy` → para operaciones matemáticas y vectoriales.  
- `PySpark` → para procesamiento distribuido de grandes volúmenes de datos.  
Durante esta fase se eliminan duplicados, se gestionan valores nulos, se estandarizan unidades y formatos, y se transforman los datos para su posterior análisis.

### 3. Almacenamiento  
- Se emplea una base de datos NoSQL, `MongoDB`, ideal para datos semi-estructurados y con necesidades de escalabilidad.  
- La estructura de documentos en MongoDB permitirá consultas rápidas e integración futura de nuevos sensores o variables.

### 4. Análisis y Procesamiento  
- Realizado en Python: análisis estadístico, detección de anomalías, y en etapas posteriores, modelos de Machine Learning para predicción de variables ambientales.  
- Librerías principales: `scikit-learn` para ML, `Matplotlib` / `Seaborn` para visualización de resultados analíticos.

### 5. Visualización y Monitoreo  
- En la versión inicial se implementará una interfaz en Python (usando `Matplotlib`, `Seaborn` o `Dash`) para visualizar:  
  - Series temporales de CO₂, ruido y parámetros subterráneos.  
  - Tendencias de variables a lo largo del tiempo.  
  - Alertas o valores anómalos.  
- En fases futuras se planea integrar con herramientas como `Grafana`, `Streamlit` o plataformas GIS (ej. ArcGIS) para dashboards interactivos y mapas de sensores.

---

## 🏗️ Tecnologías Utilizadas  
| Componente                     | Tecnología / Herramienta           | Descripción                                           |
|--------------------------------|------------------------------------|-------------------------------------------------------|
| Lenguaje principal            | Python 3.x                         | Procesamiento, análisis y visualización de datos     |
| Ingesta de datos              | Archivos TXT / XLSX + sensores     | Datos de CO₂, contaminación acústica, parámetros soterrados |
| Limpieza y procesamiento      | Pandas, NumPy, PySpark             | Transformación y preparación de los datos            |
| Almacenamiento                | MongoDB                            | Base de datos NoSQL para datos semi-estructurados    |
| Análisis y Machine Learning   | Scikit-learn (Python)              | Modelos de predicción y análisis                     |
| Visualización                 | Matplotlib, Dash                   | Gráficos, dashboards e interfaces                     |
| Control de versiones          | GitHub                             | Repositorio colaborativo del proyecto                 |

---

## ⚙️ Flujo del Sistema

```text
[Fuentes de datos: TXT / Excel]
             ↓
[Limpieza y preprocesamiento - Python (Pandas, NumPy, PySpark)]
             ↓
[Almacenamiento - MongoDB]
             ↓
[Análisis y procesamiento - Python]
             ↓
[Visualización y monitoreo - Python]


