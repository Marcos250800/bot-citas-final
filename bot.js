const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.emailUser, pass: config.emailPass }
});

async function enviarCorreo(texto) {
    try {
        await transporter.sendMail({
            from: config.emailUser,
            to: config.emailDestino,
            subject: '🚨 ¡CITA DETECTADA!',
            text: texto
        });
        console.log('📧 CORREO ENVIADO');
    } catch (e) { console.error('Error email:', e); }
}

async function checkCitas() {
    console.log("🤖 GitHub V13 (Multiventana): " + new Date().toLocaleTimeString());
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        page.setDefaultTimeout(120000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 1. GESTIÓN DE ALERTAS (Preventiva)
        page.on('dialog', async dialog => await dialog.accept());

        // 2. IR AL MINISTERIO
        console.log("🌍 Entrando...");
        await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 3. PREPARAR EL SALTO A LA NUEVA PESTAÑA
        console.log("🔎 Buscando enlace...");
        // Escuchamos cuando el navegador crea una nueva "target" (pestaña)
        const newPagePromise = new Promise(x => browser.once('targetcreated', target => x(target.page())));
        
        const selectorEnlace = 'a[href*="citaconsular.es"]';
        await page.waitForSelector(selectorEnlace, { timeout: 30000 });

        // 4. CLIC (Dejamos que abra ventana nueva)
        console.log("👉 Clic (abriendo popup)...");
        await page.click(selectorEnlace);

        // 5. CAPTURAR LA NUEVA PESTAÑA
        const citaPage = await newPagePromise;
        if (!citaPage) throw new Error("No se abrió la pestaña nueva.");
        
        await citaPage.bringToFront();
        console.log("✅ Saltado a la nueva pestaña.");
        
        // Configurar alertas también en la nueva pestaña
        citaPage.on('dialog', async dialog => await dialog.accept());

        // 6. ESPERA PASIVA (Dejamos que cargue)
        console.log("⏳ Esperando carga (15s)...");
        await new Promise(r => setTimeout(r, 15000));

        // 7. INTENTAR F5 SI ES BLANCO EN LA NUEVA PESTAÑA
        let contenido = await citaPage.content();
        if (contenido.length < 500) {
            console.log("⚠️ Blanco. F5 en nueva pestaña...");
            await citaPage.reload({ waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 5000));
        }

        // 8. ANÁLISIS
        contenido = (await citaPage.content()).toLowerCase();
        
        if (contenido.includes("hueco") || contenido.includes("libre") || contenido.includes("reservar")) {
            console.log("🚨 ¡¡BINGO!! CITA DETECTADA.");
            await enviarCorreo(`¡Hay huecos!`);
        } else if (contenido.includes("no hay horas") || contenido.includes("inténtelo de nuevo")) {
            console.log("❌ Sin novedad. (Mensaje 'No hay horas')");
        } else {
            console.log("❓ Pantalla desconocida. CHIVATO:");
            console.log(contenido.substring(0, 300));
        }

    } catch (error) {
        console.error("⚠️ Error:", error.message);
        process.exit(0);
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
}

checkCitas();
