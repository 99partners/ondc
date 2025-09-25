const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const searchRoutes = require('./routes/search');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? [`https://${config.domain}`] : true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Host restriction in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const hostHeader = req.headers.host || '';
    const incomingHost = hostHeader.split(':')[0];
    if (incomingHost !== config.domain) {
      return res.status(403).json({ error: 'Forbidden', message: 'Invalid host' });
    }
  }
  next();
});

// Routes
app.use('/', searchRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'ONDC Seller - Fashion', version: config.ondc.version, domain: config.domain });
});

const PORT = config.port;
app.listen(PORT, () => {
  console.log(`ONDC Seller Retail running on port ${PORT}`);
});

module.exports = app;


