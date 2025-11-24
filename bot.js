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
    console.log("🤖 GitHub V11 (Ligero): " + new Date().toLocaleTimeString());
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: "new",
            // Quitamos el timeout técnico agresivo
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        page.setDefaultTimeout(120000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 1. GESTIÓN DE ALERTAS NATIVA (Sin teclado, consume menos CPU)
        page.on('dialog', async dialog => {
            console.log(`🔔 Alerta detectada. Aceptando...`);
            await dialog.accept();
        });

        // 2. IR A LA WEB
        console.log("🌍 Entrando...");
        await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 3. TRUCO PESTAÑA
        const selectorEnlace = 'a[href*="citaconsular.es"]';
        await page.waitForSelector(selectorEnlace, { timeout: 30000 });
        await page.$eval(selectorEnlace, el => el.setAttribute('target', '_self'));

        // 4. CLIC Y ESPERA LARGA (Sin acciones intermedias)
        console.log("👉 Clic...");
        await Promise.all([
            page.click(selectorEnlace),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
        ]);

        // 5. ESPERA PASIVA (Dejamos que la CPU respire)
        console.log("⏳ Esperando carga (10s)...");
        await new Promise(r => setTimeout(r, 10000));

        // 6. INTENTAR F5 SI ES BLANCO (Solo una vez)
        let contenido = await page.content();
        if (contenido.length < 500) {
            console.log("⚠️ Blanco. F5...");
            await page.reload({ waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 5000));
        }

        // 7. ANÁLISIS
        contenido = (await page.content()).toLowerCase();
        
        if (contenido.includes("hueco") || contenido.includes("libre") || contenido.includes("reservar")) {
            console.log("🚨 ¡¡BINGO!! CITA DETECTADA.");
            await enviarCorreo(`¡Hay huecos!`);
        } else if (contenido.includes("no hay horas") || contenido.includes("inténtelo de nuevo")) {
            console.log("❌ Sin novedad. (Mensaje 'No hay horas')");
        } else {
            console.log("❓ Pantalla desconocida.");
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
