import pandas as pd
import numpy as np
import re
import io
import base64
import struct
import sys  
# --- 1. FUNCIÓN DE DECODIFICACIÓN DE PAYLOAD (EM310-UDL) ---

def decode_payload(base64_str):

    if not isinstance(base64_str, str):
        return np.nan, np.nan, np.nan

    try:
        bytes_data = base64.b64decode(base64_str)
    except Exception:
        return np.nan, np.nan, np.nan

    i = 0
    decoded = {}
    while i < len(bytes_data):
        if i + 2 > len(bytes_data):
            break
        channel = bytes_data[i]
        ctype = bytes_data[i+1]
        i += 2
        try:
            if channel == 0x01 and ctype == 0x75:
                if i >= len(bytes_data): break
                decoded['battery'] = bytes_data[i]
                i += 1
            elif channel == 0x04 and ctype == 0x80:
                if i + 2 > len(bytes_data): break
                decoded['distance'] = struct.unpack('<H', bytes_data[i:i+2])[0]
                i += 2
            elif channel == 0x05 and ctype == 0x71:
                if i >= len(bytes_data): break
                decoded['status'] = 'tilt' if bytes_data[i] == 1 else 'normal'
                i += 1
            elif channel == 0x03 and ctype == 0x67:
                if i + 2 > len(bytes_data): break
                decoded['temperature'] = struct.unpack('<h', bytes_data[i:i+2])[0] * 0.1
                i += 2
            else:
                break
        except Exception:
            break
    return decoded.get('distance'), decoded.get('battery'), decoded.get('status')

# --- 2. FUNCIÓN PRINCIPAL DEL SCRIPT ---

def ejecutar_etl_y_limpieza():
    # --- Definición de Nombres de Archivos ---
    input_file = "EM310-UDL-915M soterrados nov 2024.csv"
    final_output_file = "datos_soterrados_limpio.csv"
    
    print(f"Iniciando el proceso ETL y de limpieza...")
    print(f"Archivo de entrada: {input_file}")
    print(f"Archivo de salida: {final_output_file}")

    try:
        print("\nPaso 1/5: Cargando archivo original...")
        
        try:
            header_df = pd.read_csv(input_file, delimiter=';', nrows=1, low_memory=False)
        except FileNotFoundError:
            print(f"Error FATAL: No se encontró el archivo de entrada '{input_file}'.")
            print("Asegúrate de que el archivo está en la misma carpeta que el script.")
            sys.exit(1) # Termina el script
            
        header_list = list(header_df.columns)
        
        data_col_index = header_list.index('data')
        location_col_index = header_list.index('deviceInfo.tags.Location')
        
        dtype_dict = {header_list[data_col_index]: str}
        
        df_raw = pd.read_csv(input_file, delimiter=';', low_memory=False, header=0, dtype=dtype_dict)
        print("...Archivo CSV cargado (forzando 'data' como texto).")

        # --- 2B. Limpieza de Ubicación (Fusión de Columnas) ---
        print("Paso 2/5: Corrigiendo y extrayendo coordenadas...")
        
        col_name_loc = df_raw.columns[location_col_index]
        col_name_next1 = df_raw.columns[location_col_index + 1]
        col_name_next2 = df_raw.columns[location_col_index + 2]
        
        df_raw['location_full_text'] = (
            df_raw[col_name_loc].astype(str) + ' ' +
            df_raw[col_name_next1].astype(str) + ' ' +
            df_raw[col_name_next2].astype(str)
        )
        
        regex_pattern = r'(-?\d+\.\d+)[^0-9\.-]*(-?\d+\.\d+)'
        extracted_coords = df_raw['location_full_text'].str.extract(regex_pattern)
        
        df_raw['latitude'] = pd.to_numeric(extracted_coords[0], errors='coerce')
        df_raw['longitude'] = pd.to_numeric(extracted_coords[1], errors='coerce')
        print("...Coordenadas de Latitud y Longitud extraídas.")
        
        # --- 2D. Selección y Renombrado ---
        print("Paso 3/5: Renombrando y seleccionando columnas finales...")
        df_final = df_raw.rename(columns={
            'object.position': 'measurement_value_orig',
            'object.battery': 'battery_level_orig',
            'deviceInfo.tags.Address': 'device_address',
            'deviceInfo.tags.Description': 'Description',
            'txInfo.modulation.lora.spreadingFactor': 'Sensor_type',
            'deviceInfo.devEui': 'devEui',
            'deviceInfo.deviceName': 'deviceName'
        })
        
        final_key_columns = [
            'devEui', 'deviceName', 'Sensor_type', 'data', 'time', 'device_address', 'Description',
            'latitude', 'longitude'
        ]
        
        df_key = df_final[final_key_columns].copy()
        print("...Columnas seleccionadas.")

        # Aplicada directamente a 'df_key' en memoria
        
        print("\nPaso 4/5: Eliminando filas con 'data' vacía...")
        
        total_filas_antes = len(df_key)
        filas_vacias = df_key['data'].isna().sum()
        
        print(f"Total de filas ANTES de limpiar: {total_filas_antes}")
        print(f"Filas con 'data' vacía (NaN): {filas_vacias}")
        
        # Eliminación de filas
        df_filtrado = df_key.dropna(subset=['data'])
        
        total_filas_despues = len(df_filtrado)
        filas_eliminadas = total_filas_antes - total_filas_despues
        
        print(f"Total de filas DESPUÉS de limpiar: {total_filas_despues}")
        print(f"Filas eliminadas: {filas_eliminadas}")

        # --- 3. Guardado Final ---
        print(f"\nPaso 5/5: Guardando el archivo final como: {final_output_file}...")
        
        # Se guarda con sep=',' como en tu segundo script
        df_filtrado.to_csv(final_output_file, index=False, sep=',')
        
        print(f"\n✅ Proceso ETL completado con éxito.")
        print(f"Se extrajeron {df_filtrado['latitude'].notna().sum()} coordenadas.")
        print(f"El archivo final se ha guardado como: {final_output_file}")
        
        print("\nPrimeras 5 filas del archivo final (para verificación):")
        print(df_filtrado.head())

    except KeyError as e:
        print(f"Error FATAL de Clave (KeyError): No se encontró la columna {e}.")
        print("Verifica que los nombres de las columnas en el CSV original no han cambiado.")
        sys.exit(1)
    except Exception as e:
        print(f"Ocurrió un error inesperado durante el procesamiento: {e}")
        sys.exit(1)

if __name__ == "__main__":
    ejecutar_etl_y_limpieza()