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
            subject: '🚨 ¡CITA DETECTADA! (GitHub Action)',
            text: texto
        });
        console.log('📧 CORREO ENVIADO');
    } catch (e) { console.error('Error email:', e); }
}

async function checkCitas() {
    console.log("🤖 GitHub Action Iniciada: " + new Date().toLocaleTimeString());
    let browser = null;

    try {
        // MODO SIN PANTALLA (Headless) para el servidor
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 1. IR AL MINISTERIO
        console.log("🌍 Entrando al Ministerio...");
        await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 2. TRUCO MISMA PESTAÑA
        console.log("🔎 Buscando enlace...");
        const selectorEnlace = 'a[href*="citaconsular.es"]';
        await page.waitForSelector(selectorEnlace, { timeout: 20000 });
        await page.$eval(selectorEnlace, el => el.setAttribute('target', '_self'));

        // 3. CLIC
        console.log("👉 Clic...");
        await Promise.all([
            page.click(selectorEnlace),
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
        ]);

        // 4. MACHACAR ALERTA CON ENTER (Tu truco)
        console.log("⚔️ Machacando alerta...");
        page.on('dialog', async dialog => { try { await dialog.accept(); } catch(e){} });
        
        for (let i = 0; i < 5; i++) {
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 300));
        }

        // 5. RECARGA SI BLANCO
        let contenido = await page.content();
        if (contenido.length < 500) {
            console.log("⚠️ Blanco. F5...");
            await page.reload({ waitUntil: 'domcontentloaded' });
            await new Promise(r => setTimeout(r, 3000));
            await page.keyboard.press('Enter');
        }

        // 6. BOTÓN CONTINUAR
        try {
            const boton = await page.waitForSelector('input[value*="Continuar"], input[value*="Continue"], button', { timeout: 10000 });
            if (boton) {
                console.log("👉 Botón Continuar...");
                await Promise.all([
                    boton.click(),
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(()=>null)
                ]);
            }
        } catch (e) { console.log("ℹ️ No vi botón (seguimos)."); }

        // 7. ANÁLISIS FINAL (TUS PALABRAS CLAVE)
        await new Promise(r => setTimeout(r, 2000));
        contenido = (await page.content()).toLowerCase();
        
        const exito = ["hueco", "libre", "reservar", "seleccionar"]; // <--- ESTO ES LO QUE BUSCA
        const fracaso = ["no hay horas disponibles", "inténtelo de nuevo", "no availability"];

        if (exito.some(p => contenido.includes(p))) {
            console.log("🚨 ¡¡BINGO!! CITA DETECTADA.");
            await enviarCorreo(`¡Hay huecos! Entra desde el Ministerio.`);
        
        } else if (fracaso.some(f => contenido.includes(f))) {
            console.log("❌ Sin novedad. (Mensaje 'No hay horas').");
        
        } else {
            console.log("❓ Pantalla desconocida o Error.");
        }

    } catch (error) {
        console.error("⚠️ Error:", error.message);
        process.exit(1); // Salir con error
    } finally {
        if (browser) await browser.close();
        process.exit(0); // Apagar la máquina
    }
}

checkCitas();
