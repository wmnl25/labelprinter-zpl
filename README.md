# ZPL Label Printer

![ZPL Label Printer Screenshot](screenshot.png)

A web application to print PDFs and images (PNG, JPG, WEBP) directly to Zebra (ZPL) label printers over the local network (TCP port 9100).

## Features
- **Drag & Drop:** Easily upload PDFs and images.
- **Auto-trim:** Automatically removes excess whitespace around labels.
- **Auto-rotation & Scaling:** Automatically rotates to portrait mode and scales the image to a 4x6 inch format (shipping labels) with a neat 5mm margin.
- **Direct Printing:** Print directly to network printers via Raw TCP (port 9100).
- **ZPL Download:** Ability to download the generated ZPL code for debugging.
- **Multi-language Support:** Available in English, Dutch, German, French, and Spanish.

## Installation & Local Usage

Because the application communicates with the printer via Raw TCP (port 9100), the backend (Node.js) must have access to the same network as the printer.

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd zpl-labelprinter
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. (Optional) Set a default printer:
   Copy `.env.example` to `.env` and fill in your default printer IP:
   ```env
   VITE_PRINTER_HOST=192.168.1.100
   VITE_PRINTER_PORT=9100
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The application is now accessible at `http://localhost:3000`.

## Production (Deployment)

If you want to host the application on your own server (e.g., a Raspberry Pi or local server in your warehouse):

1. Build the frontend:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm run start
   ```
   *Note: The server runs on port 3000. You can use a reverse proxy (like Nginx or Apache) to make it available via port 80/443.*

## Architecture
- **Frontend:** React, Tailwind CSS, Vite
- **Backend:** Express (Node.js) for TCP socket communication
- **PDF Processing:** PDF.js
- **ZPL Conversion:** Custom binarization and hex encoding (via HTML5 Canvas)
