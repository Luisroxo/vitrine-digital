// Carrega variáveis de ambiente
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const routes = require('./routes');

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(routes);

// Iniciar servidor
app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor rodando em http://${HOST}:${PORT}`);
});