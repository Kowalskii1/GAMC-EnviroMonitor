require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parse/sync');
const path = require('path');

const Sensor = require('../models/Sensor');

async function migrateCSV() {
  try {
    console.log('🔄 Conectando a MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      dbName: process.env.DB_NAME
    });
    console.log('✅ Conectado a MongoDB');

    const filePath = path.join(__dirname, '../WS302-915M SONIDO NOV 2024.csv');
    
    console.log('📊 Leyendo CSV...');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = csv.parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`📈 Total de registros: ${records.length}`);

    // Borrar registros existentes
    await Sensor.deleteMany({});
    console.log('🗑️ Registros anteriores eliminados');

    const batchSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      const documents = batch.map(row => ({
        _id: row._id,
        devAddr: row.devAddr,
        deduplicationId: row.deduplicationId,
        time: new Date(row.time),
        deviceInfo: {
          deviceName: row['deviceInfo.deviceName'],
          applicationName: row['deviceInfo.applicationName'],
          devEui: row['deviceInfo.devEui'],
          tags: {
            Description: row['deviceInfo.tags.Description'],
            Address: row['deviceInfo.tags.Address'],
            Location: row['deviceInfo.tags.Location'],
            Name: row['deviceInfo.tags.Name']
          }
        },
        measurements: {
          LAeq: parseFloat(row['object.LAeq']) || null,
          LAI: parseFloat(row['object.LAI']) || null,
          LAImax: parseFloat(row['object.LAImax']) || null,
          battery: parseFloat(row['object.battery']) || null
        },
        txInfo: {
          modulation: {
            lora: {
              spreadingFactor: parseInt(row['txInfo.modulation.lora.spreadingFactor']),
              bandwidth: parseInt(row['txInfo.modulation.lora.bandwidth']),
              codeRate: row['txInfo.modulation.lora.codeRate']
            }
          },
          frequency: parseInt(row['txInfo.frequency'])
        },
        fPort: parseInt(row.fPort),
        fCnt: parseInt(row.fCnt),
        confirmed: row.confirmed === 'true',
        adr: row.adr === 'true',
        dr: parseInt(row.dr),
        rxInfo: [
          {
            rssi: parseInt(row['rxInfo[0].rssi']) || null,
            snr: parseFloat(row['rxInfo[0].snr']) || null,
            metadata: {
              region_config_id: row['rxInfo[0].metadata.region_config_id'],
              region_common_name: row['rxInfo[0].metadata.region_common_name']
            }
          }
        ]
      })).filter(doc => doc.measurements.LAeq !== null);

      await Sensor.insertMany(documents, { ordered: false });
      insertedCount += documents.length;
      console.log(`✓ ${insertedCount}/${records.length} registros insertados`);
    }

    console.log(`\n✅ Migración completada: ${insertedCount} registros insertados`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

migrateCSV();
