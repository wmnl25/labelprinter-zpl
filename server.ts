import express from 'express';
import net from 'net';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large ZPL strings
  app.use(express.json({ limit: '50mb' }));

  // API Route to test printer connection
  app.post('/api/test-printer', (req, res) => {
    const { host, port } = req.body;
    
    if (!host || !port) {
      return res.status(400).json({ error: 'Missing host or port.' });
    }

    const client = new net.Socket();
    client.setTimeout(3000); // 3 seconds timeout

    client.connect(port, host, () => {
      client.destroy();
      if (!res.headersSent) {
        res.json({ success: true, message: 'Connection successful.' });
      }
    });

    client.on('error', (err: any) => {
      client.destroy();
      if (!res.headersSent) {
        res.status(500).json({ error: `Connection failed: ${err.message}` });
      }
    });

    client.on('timeout', () => {
      client.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Connection timeout.' });
      }
    });
  });

  // API Route to print ZPL via raw TCP socket
  app.post('/api/print', (req, res) => {
    const { host, port, zpl } = req.body;
    
    if (!host || !port || !zpl) {
      return res.status(400).json({ error: 'Missing host, port, or zpl data.' });
    }

    const client = new net.Socket();
    client.setTimeout(5000); // 5 seconds timeout

    client.connect(port, host, () => {
      client.write(zpl, () => {
        client.end();
      });
    });

    client.on('close', () => {
      if (!res.headersSent) {
        res.json({ success: true, message: 'Print job sent successfully.' });
      }
    });

    client.on('error', (err: any) => {
      console.error('TCP Socket Error:', err);
      if (!res.headersSent) {
        if (err.code === 'ENOTFOUND' || err.code === 'EHOSTUNREACH' || err.code === 'ETIMEDOUT') {
          res.status(500).json({ 
            error: `Kan de printer niet bereiken (${host}). Let op: Omdat deze app in de cloud draait, kan deze geen verbinding maken met printers op je lokale netwerk (zoals .lan adressen of 192.168.x.x). Je moet de app lokaal draaien (downloaden) om te printen naar een lokale netwerkprinter.` 
          });
        } else {
          res.status(500).json({ error: `Printer connection error: ${err.message}` });
        }
      }
    });

    client.on('timeout', () => {
      console.error('TCP Socket Timeout');
      client.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Connection to printer timed out.' });
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
