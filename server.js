const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: { error: 'Demasiadas solicitudes, intenta de nuevo más tarde.' }
});
app.use('/api/', limiter);

// Body parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'puppeteer-pdf-service',
    timestamp: new Date().toISOString()
  });
});

/**
 * Endpoint principal para generar PDF
 */
app.post('/api/generate-pdf', async (req, res) => {
  const { products, businessInfo, template, options } = req.body;
  
  // Validaciones básicas
  if (!products || !Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'Se requiere array de productos válido' });
  }
  
  if (!businessInfo || !businessInfo.business_name) {
    return res.status(400).json({ error: 'Se requiere información del negocio' });
  }
  
  let browser = null;
  
  try {
    console.log(`Generando PDF para ${products.length} productos...`);
    
    // Lanzar browser
    browser = await puppeteer.launch({
      headless: 'new',
      executablePath: '/usr/bin/google-chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar viewport
    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 2
    });
    
    // Generar HTML
    const htmlContent = generateCatalogHTML(products, businessInfo, template);
    
    // Cargar contenido
    await page.setContent(htmlContent, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Generar PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '10mm',
        right: '10mm'
      },
      printBackground: true
    });
    
    console.log('PDF generado exitosamente');
    
    // Enviar PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="catalogo-${businessInfo.business_name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({ 
      error: 'Error generando PDF',
      details: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

/**
 * Endpoint de prueba
 */
app.post('/api/test-pdf', async (req, res) => {
  const testData = {
    products: [
      {
        id: '1',
        name: 'Producto de Prueba',
        image_url: 'https://via.placeholder.com/300x300.png?text=TEST',
        price_retail: 199.99,
        description: 'Descripción de prueba'
      }
    ],
    businessInfo: {
      business_name: 'Test Business',
      phone: '+52 1234567890',
      email: 'test@example.com'
    },
    template: {
      displayName: 'Test Template',
      productsPerPage: 6,
      layout: { columns: 3 },
      colors: {
        primary: '#007bff',
        secondary: '#6c757d',
        accent: '#17a2b8',
        background: '#ffffff',
        text: '#333333'
      }
    }
  };
  
  // Usar el mismo endpoint
  req.body = testData;
  return app._router.handle(req, res, () => {});
});

/**
 * Función para generar HTML del catálogo
 */
function generateCatalogHTML(products, businessInfo, template) {
  const productsPerPage = template.productsPerPage || 6;
  const columns = template.layout?.columns || 3;
  
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Catálogo ${businessInfo.business_name}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        @page {
          size: A4;
          margin: 10mm;
        }
        
        body {
          font-family: 'Arial', sans-serif;
          color: ${template.colors?.text || '#333'};
          background: ${template.colors?.background || '#ffffff'};
          line-height: 1.4;
        }
        
        .catalog-header {
          text-align: center;
          margin-bottom: 25px;
          padding: 20px;
          background: linear-gradient(135deg, ${template.colors?.primary || '#007bff'}, ${template.colors?.secondary || '#6c757d'});
          color: white;
          border-radius: 12px;
        }
        
        .business-name {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 8px;
        }
        
        .products-grid {
          display: grid;
          grid-template-columns: repeat(${columns}, 1fr);
          gap: 15px;
          margin-bottom: 20px;
        }
        
        .product-card {
          background: white;
          border: 2px solid ${template.colors?.accent || '#dee2e6'};
          border-radius: 10px;
          padding: 12px;
          text-align: center;
          display: flex;
          flex-direction: column;
        }
        
        .product-image-container {
          width: 100%;
          aspect-ratio: 1 / 1;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 10px;
          overflow: hidden;
          position: relative;
          border: 1px solid #e9ecef;
        }
        
        .product-image {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
        }
        
        .product-name {
          font-size: 14px;
          font-weight: 600;
          color: ${template.colors?.primary || '#007bff'};
          margin-bottom: 8px;
          word-wrap: break-word;
          flex-grow: 1;
        }
        
        .product-price {
          font-size: 16px;
          font-weight: 700;
          color: ${template.colors?.secondary || '#6c757d'};
          background: ${template.colors?.accent || '#dee2e6'}40;
          padding: 6px 10px;
          border-radius: 6px;
          margin-top: auto;
        }
        
        .catalog-footer {
          margin-top: 20px;
          padding: 15px;
          background: ${template.colors?.primary || '#007bff'}10;
          border-radius: 8px;
          text-align: center;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="catalog-header">
        <h1 class="business-name">${businessInfo.business_name}</h1>
        <p>Catálogo ${template.displayName || 'Premium'}</p>
      </div>
      
      <div class="products-grid">
        ${products.map(product => `
          <div class="product-card">
            <div class="product-image-container">
              <img 
                src="${product.image_url || 'https://via.placeholder.com/300x300.png?text=Sin+Imagen'}" 
                alt="${product.name}"
                class="product-image"
              />
            </div>
            <h3 class="product-name">${product.name}</h3>
            <div class="product-price">$${formatPrice(product.price_retail)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="catalog-footer">
        <div>📞 ${businessInfo.phone || ''} | 📧 ${businessInfo.email || ''}</div>
        <div style="margin-top: 5px; opacity: 0.8;">
          Catálogo generado con CatalogoIA - ${products.length} productos
        </div>
      </div>
    </body>
    </html>
  `;
}

function formatPrice(price) {
  return new Intl.NumberFormat('es-MX').format(price);
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test PDF: http://localhost:${PORT}/api/test-pdf`);
});
