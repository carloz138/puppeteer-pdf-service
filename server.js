// server.js - Servidor de Puppeteer COMPLETO con endpoint /generate-pdf
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuración de Puppeteer para EasyPanel
const PUPPETEER_CONFIG = {
  headless: 'new',
  executablePath: '/usr/bin/google-chrome',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor'
  ]
};

// Cache de browser para reutilizar
let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    console.log('🚀 Iniciando nueva instancia de Puppeteer...');
    browserInstance = await puppeteer.launch(PUPPETEER_CONFIG);
  }
  return browserInstance;
}

// ENDPOINT PRINCIPAL - GENERAR PDF
app.post('/generate-pdf', async (req, res) => {
  const startTime = Date.now();
  console.log('📄 Nueva solicitud de PDF recibida');
  
  try {
    const { html, options = {}, filename = 'catalog.pdf' } = req.body;
    
    if (!html) {
      return res.status(400).json({ 
        error: 'HTML content is required',
        code: 'MISSING_HTML' 
      });
    }

    console.log('📄 HTML recibido:', html.length, 'caracteres');
    console.log('⚙️ Opciones:', JSON.stringify(options, null, 2));

    // Configuración mejorada para PDFs de catálogo
    const pdfOptions = {
      format: options.format || 'A4',
      margin: options.margin || {
        top: '10mm',
        right: '10mm', 
        bottom: '10mm',
        left: '10mm'
      },
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      waitUntil: options.waitUntil || 'networkidle0',
      timeout: 30000,
      ...options
    };

    console.log('🌐 Abriendo nueva página...');
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    // Configurar viewport para mejor rendering
    await page.setViewport({ 
      width: 1200, 
      height: 800,
      deviceScaleFactor: 1
    });

    // IMPORTANTE: Agregar estilos de compatibilidad
    await page.addStyleTag({
      content: `
        html {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `
    });
    
    console.log('📝 Cargando contenido HTML...');
    await page.setContent(html, { 
      waitUntil: pdfOptions.waitUntil,
      timeout: pdfOptions.timeout 
    });

    // Esperar un poco más para asegurar que todo se renderice
    await page.waitForTimeout(1000);

    console.log('🎨 Generando PDF...');
    const pdfBuffer = await page.pdf(pdfOptions);
    
    await page.close();

    const generationTime = Date.now() - startTime;
    console.log(`✅ PDF generado exitosamente en ${generationTime}ms`);

    // Enviar PDF como descarga
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });
    
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    res.status(500).json({ 
      error: error.message,
      code: 'PDF_GENERATION_ERROR',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint de salud
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: '1.0.0'
  });
});

// Endpoint de prueba PDF
app.get('/test-pdf', async (req, res) => {
  const testHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          padding: 20px; 
          -webkit-print-color-adjust: exact !important;
        }
        .header { 
          text-align: center; 
          color: #333; 
          margin-bottom: 30px; 
          background: linear-gradient(135deg, #3B82F6, #1E40AF) !important;
          color: white !important;
          padding: 20px;
          border-radius: 8px;
          -webkit-print-color-adjust: exact !important;
        }
        .content { 
          line-height: 1.6; 
          background: #F8F9FA !important;
          padding: 20px;
          border-radius: 8px;
          -webkit-print-color-adjust: exact !important;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🧪 PDF Test Exitoso</h1>
        <p>Generado el ${new Date().toLocaleString('es-MX')}</p>
      </div>
      <div class="content">
        <p>Este es un PDF de prueba generado por Puppeteer en EasyPanel.</p>
        <p>Si puedes ver esto con colores y estilos, el servicio está funcionando correctamente.</p>
        <p>Servidor: ${process.env.NODE_ENV || 'production'}</p>
        <p>Puerto: ${PORT}</p>
      </div>
    </body>
    </html>
  `;

  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    await page.addStyleTag({
      content: `
        html {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      `
    });
    
    await page.setContent(testHTML);
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
      printBackground: true
    });
    await page.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="test.pdf"'
    });
    res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Error en test PDF:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener información del servicio
app.get('/', (req, res) => {
  res.json({
    service: 'Puppeteer PDF Generator',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      generatePdf: '/generate-pdf (POST)',
      testPdf: '/test-pdf (GET)'
    },
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('📛 Cerrando servidor...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('📛 Recibido SIGTERM, cerrando...');
  if (browserInstance) {
    await browserInstance.close();
  }
  process.exit(0);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎯 Servidor PDF corriendo en puerto ${PORT}`);
  console.log(`📄 Endpoint: http://localhost:${PORT}/generate-pdf`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log(`🧪 Test: http://localhost:${PORT}/test-pdf`);
  console.log(`📋 Info: http://localhost:${PORT}/`);
});

module.exports = app;
