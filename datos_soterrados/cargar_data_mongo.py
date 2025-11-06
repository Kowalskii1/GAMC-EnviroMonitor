import pandas as pd
from pymongo import MongoClient
import sys

DEFAULT_FILE_NAME = "datos_soterrados_limpio.csv"

MONGO_URI = "mongodb://localhost:27017/"
DB_NAME = "soterradosDB"
COLLECTION_NAME = "sensores"

def cargar_datos_a_mongo(file_name: str = None):
    if file_name is None:
        file_name = DEFAULT_FILE_NAME
        
    print(f"Iniciando el proceso de carga para: {file_name}")

    try:

        print(f"Cargando archivo CSV: {file_name}...")
        df = pd.read_csv(file_name, delimiter=',')
        
        print(f"Archivo cargado. Se encontraron {len(df)} filas.")
        
        # Verificación simple de las columnas
        if 'devEui' not in df.columns or 'deviceName' not in df.columns:
            print("Error: El archivo CSV no tiene las columnas esperadas (ej. 'devEui').")
            sys.exit(1)
            
        print("Columnas verificadas.")

        # --- Paso 2: Conectar a MongoDB ---
        print(f"Conectando a MongoDB en {MONGO_URI}...")
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        collection = db[COLLECTION_NAME]
        
        print(f"Conectado. Usando Base de Datos: '{DB_NAME}', Colección: '{COLLECTION_NAME}'")

        print(f"Convirtiendo {len(df)} filas a formato de documento...")
        data_dict = df.to_dict('records')
        

        # --- Paso 4: Borrar datos antiguos e insertar nuevos ---
        print(f"Borrando datos antiguos de la colección '{COLLECTION_NAME}'...")
        collection.delete_many({})
        
        print(f"Insertando {len(data_dict)} nuevos documentos...")
        collection.insert_many(data_dict)
        
        print("\n" + "="*30)
        print("  ¡PROCESO COMPLETADO CON ÉXITO!  ")
        print("="*30)
        print(f"Se insertaron {collection.count_documents({})} documentos.")
        
        # Verificar con un ejemplo
        print("\nVerificación: Mostrando un documento desde MongoDB:")
        print(collection.find_one())


    except FileNotFoundError:
        print(f"\n--- ERROR ---")
        print(f"No se encontró el archivo: '{file_name}'")
        print("Asegúrate de que el script de Python esté en la misma carpeta que el archivo.")
        sys.exit(1)
    except Exception as e:
        print(f"\n--- OCURRIÓ UN ERROR INESPERADO ---")
        print(e)
        sys.exit(1)

# --- 3. FUNCIÓN DE UPLOAD ---

def upload(file_path: str = None):
    
    if file_path is None:
        try:
            try:
                import tkinter as tk
                from tkinter import filedialog
                
                print("Abriendo selector de archivos...")
                root = tk.Tk()
                root.withdraw()
                
                file_path = filedialog.askopenfilename(
                    title="Seleccionar archivo CSV",
                    filetypes=[("CSV files", "*.csv"), ("All files", "*.*")]
                )
                
                root.destroy()
                
                if not file_path:
                    print("No se seleccionó ningún archivo.")
                    return False
                    
            except ImportError:
                # Si tkinter no está disponible, usar input
                print("Selector de archivos no disponible. Usando entrada manual.")
                file_path = input("Ruta del archivo CSV a cargar: ").strip()
                
        except Exception as e:
            print(f"Error al obtener la ruta del archivo: {e}")
            return False
    
    if not file_path:
        print("No se proporcionó ninguna ruta de archivo.")
        return False
        
    try:
        cargar_datos_a_mongo(file_path)
        return True
    except SystemExit:
        return False
    except Exception as e:
        print(f"Error al cargar el archivo: {e}")
        return False

# --- 4. EJECUTAR EL SCRIPT ---
if __name__ == "__main__":
    
    args = sys.argv[1:]
    
    if len(args) == 0:
        cargar_datos_a_mongo()
    elif len(args) == 1:
        if args[0].lower() == 'upload':
            # Solo "upload": abrir selector/prompt
            success = upload()
            sys.exit(0 if success else 1)
        else:
            success = upload(args[0])
            sys.exit(0 if success else 1)
    elif len(args) == 2 and args[0].lower() == 'upload':
        success = upload(args[1])
        sys.exit(0 if success else 1)
    else:
        print("Uso:")
        print("  python cargar_data_mongo.py                    # Archivo por defecto")
        print("  python cargar_data_mongo.py upload             # Selector de archivos")
        print("  python cargar_data_mongo.py upload <archivo>   # Archivo específico")
        print("  python cargar_data_mongo.py <archivo>          # Archivo específico")
        sys.exit(1)