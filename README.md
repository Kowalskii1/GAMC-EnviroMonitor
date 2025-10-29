🌍 Real-Time GAMC'EnviroMonitor
Descripción del proyecto

Este proyecto tiene como objetivo desarrollar un sistema de Big Data en tiempo real para la captura, limpieza, almacenamiento, análisis y visualización de datos ambientales —con especial enfoque en la zona de la Gran Área Metropolitana de la Ciudad (GAMC)— para las siguientes variables críticas:

Concentración de CO₂ y otros gases en el aire

Niveles de contaminación acústica

Parámetros subterráneos (humedad)

El fin es monitorear estas variables, detectar anomalías, visualizar tendencias en tiempo real y facilitar la toma de decisiones mediante análisis de datos y modelos de Machine Learning.

🧩 Arquitectura General

El sistema se compone de varias etapas coordinadas para garantizar ingestión, procesamiento y visualización eficientes:

1. Ingesta de Datos

Orígenes de datos: sensores instalados en la GAMC + archivos históricos (.csv .xlsx) con mediciones de aire/sonido/subterráneas.

Futura integración de flujos en tiempo real mediante protocolos como MQTT o plataformas como Kafka.

2. Limpieza y Preprocesamiento

Implementado en Python utilizando:

pandas: lectura, limpieza y manipulación de datos estructurados.

NumPy: operaciones matemáticas y vectoriales de alto rendimiento.

PySpark: procesamiento distribuido para grandes volúmenes de datos.
Durante esta fase se eliminan duplicados, se gestionan valores nulos, se estandarizan unidades/formatos y se transforman los datos para su análisis.

3. Almacenamiento

Base de datos: MongoDB (NoSQL) para soportar datos semi­estructurados y obtener consultas rápidas y escalabilidad.

Estructura: documentos adaptados para incluir mediciones temporales de CO₂, ruido, parámetros subterráneos, metadatos de ubicación y sensor.

4. Análisis y Procesamiento

Lenguaje principal: Python.

Algoritmos: análisis estadístico, detección de anomalías, y en fases posteriores, modelos de Machine Learning para predicción de tendencias ambientales.

Librerías clave: scikit-learn para ML, Matplotlib / Seaborn para análisis visual.

5. Visualización y Monitoreo

Primera versión: interfaz en Python con Matplotlib, Seaborn o Dash, mostrando:

Series temporales de CO₂, ruido y parámetros subterráneos.

Tendencias y comparativas por ubicación.

Alertas visuales para valores fuera de rango o anomalías.

Fases futuras: integración con herramientas como Grafana, Streamlit o plataformas GIS (ej. ArcGIS) para mapas interactivos y dashboards en tiempo real.

🏗️ Tecnologías Utilizadas
Componente	Tecnología / Herramienta	Descripción
Lenguaje principal	Python 3.x	Procesamiento, análisis y visualización
Ingesta de datos	Archivos CSV / XLSX + sensores	Datos de CO₂, ruido y parámetros subterráneos
Limpieza y procesamiento	Pandas, NumPy, PySpark	Transformación y preparación de datos
Almacenamiento	MongoDB	Base de datos NoSQL para datos semi­estructurados
Análisis y ML	Scikit-learn	Modelos y análisis predictivo
Visualización	Matplotlib, Dash	Gráficos, dashboards y monitoreo visual
Control de versiones	GitHub	Repositorio colaborativo del proyecto

⚙️ Flujo del Sistema
Fuentes de datos (Sensores / Archivos – CO₂, ruido, soterrados)
             ↓
Limpieza y pre-procesamiento (Python: Pandas, NumPy, PySpark)
             ↓
Almacenamiento en MySql, MongoDB
             ↓
Análisis y procesamiento (Python: estadística, ML)
             ↓
Visualización y monitoreo en dashboards e interfaces

🚀 Próximos pasos

Incorporar flujo en tiempo real con MQTT/Kafka para ingestión en vivo de sensores.

Desarrollar modelos de predicción para anticipar picos de contaminación de CO₂ o ruido, y detectar situaciones subterráneas críticas.

Integrar un dashboard web interactivo y responsive, con mapas y geolocalización de sensores.

Añadir sistema de alertas automatizadas (SMS, e-mail o notificaciones) cuando los valores excedan umbrales definidos.
