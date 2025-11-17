import pandas as pd
import numpy as np
import re
import base64
import struct
import sys

# --- Función para decodificar la columna 'data' si contiene payload base64 ---
def decode_payload(base64_str):
    """
    Decodifica el payload de datos base64.
    Retorna un diccionario con posibles campos: 'co2', 'temperature', 'humidity', 'battery'.
    """
    if not isinstance(base64_str, str) or base64_str == '':
        return np.nan, np.nan, np.nan, np.nan

    try:
        bytes_data = base64.b64decode(base64_str)
    except Exception:
        return np.nan, np.nan, np.nan, np.nan

    i = 0
    decoded = {}
    while i < len(bytes_data):
        if i + 2 > len(bytes_data):
            break
        channel = bytes_data[i]
        ctype = bytes_data[i+1]
        i += 2
        try:
            # Ejemplo de decodificación según tu sensor EM500-CO2-915M
            if channel == 0x01 and ctype == 0x75:
                decoded['battery'] = bytes_data[i]
                i += 1
            elif channel == 0x03 and ctype == 0x67:
                decoded['temperature'] = struct.unpack('<h', bytes_data[i:i+2])[0] * 0.1
                i += 2
            elif channel == 0x04 and ctype == 0x68:
                decoded['humidity'] = bytes_data[i]
                i += 1
            elif channel == 0x05 and ctype == 0x69:
                decoded['co2'] = struct.unpack('<H', bytes_data[i:i+2])[0]
                i += 2
            else:
                i += 1
        except Exception:
            break
    return decoded.get('co2'), decoded.get('temperature'), decoded.get('humidity'), decoded.get('battery')


def ejecutar_etl_csv(input_file: str = "EM500-CO2-915M_nov_2024.csv",
                     final_output_file: str = "datos_soterrados_limpio.csv"):

    print(f"Iniciando ETL sobre: {input_file}")
    try:
        # --- 1. Cargar CSV completo ---
        df = pd.read_csv(input_file, delimiter=',', low_memory=False, dtype=str)
        print(f"Archivo cargado. Filas: {len(df)}, Columnas: {len(df.columns)}")

        # --- 2. Extraer coordenadas de Location ---
        if 'deviceInfo.tags.Location' in df.columns:
            regex_pattern = r'(-?\d+\.\d+)[^0-9\.-]*(-?\d+\.\d+)'
            coords = df['deviceInfo.tags.Location'].astype(str).str.extract(regex_pattern)
            df['latitude'] = pd.to_numeric(coords[0], errors='coerce')
            df['longitude'] = pd.to_numeric(coords[1], errors='coerce')
            print("Coordenadas extraídas correctamente.")

        # --- 3. Decodificar columna 'data' ---
        print("Decodificando columna 'data'...")
        co2_list, temp_list, hum_list, batt_list = [], [], [], []
        for val in df['data']:
            co2, temp, hum, batt = decode_payload(val)
            co2_list.append(co2)
            temp_list.append(temp)
            hum_list.append(hum)
            batt_list.append(batt)
        df['co2_decoded'] = co2_list
        df['temperature_decoded'] = temp_list
        df['humidity_decoded'] = hum_list
        df['battery_decoded'] = batt_list
        print("Decodificación completada.")

        # --- 4. Selección de columnas finales para análisis ---
        columnas_finales = [
            'id', 'devAddr', 'deduplicationId', 'time',
            'deviceInfo.deviceClassEnabled', 'deviceInfo.tenantName',
            'deviceInfo.deviceName', 'deviceInfo.devEui',
            'deviceInfo.tags.Description', 'deviceInfo.tags.Address',
            'data', 'fPort', 'confirmed', 'adr', 'dr', 'batteryLevel', 'margin',
            'co2_decoded', 'temperature_decoded', 'humidity_decoded',
            'latitude', 'longitude', 'description'
        ]
        columnas_presentes = [col for col in columnas_finales if col in df.columns]
        df_final = df[columnas_presentes].copy()

        # --- 5. Eliminar filas donde 'data' esté vacío ---
        total_filas = len(df_final)
        df_final = df_final.dropna(subset=['data'])
        print(f"Filas eliminadas por 'data' vacío: {total_filas - len(df_final)}")

        # --- 6. Guardar CSV limpio ---
        df_final.to_csv(final_output_file, index=False)
        print(f"✅ ETL completado. Archivo limpio guardado en: {final_output_file}")
        print("Primeras 5 filas:")
        print(df_final.head())

    except FileNotFoundError:
        print(f"Error: No se encontró el archivo {input_file}")
        sys.exit(1)
    except Exception as e:
        print(f"Ocurrió un error durante el procesamiento: {e}")
        sys.exit(1)


if __name__ == "__main__":
    ejecutar_etl_csv()
