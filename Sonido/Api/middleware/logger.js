const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = fs.createWriteStream(
  path.join(logDir, `${new Date().toISOString().split('T')[0]}.log`),
  { flags: 'a' }
);

module.exports = {
  stream: logFile
};
