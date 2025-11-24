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
            subject: '🚨 ¡CITA DETECTADA! (GitHub)',
            text: texto
        });
        console.log('📧 CORREO ENVIADO');
    } catch (e) { console.error('Error email:', e); }
}

async function checkCitas() {
    console.log("🤖 GitHub Action Iniciada: " + new Date().toLocaleTimeString());
    let browser = null;

    try {
        // MODO SERVIDOR (Sin pantalla, pero con esteroides de tiempo)
        browser = await puppeteer.launch({
            headless: "new",
            protocolTimeout: 240000, // 4 minutos para evitar cuelgues técnicos
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        // Tiempo de espera general aumentado
        page.setDefaultTimeout(120000);
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 1. IR AL MINISTERIO
        console.log("🌍 Entrando al Ministerio...");
        await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // 2. TRUCO MISMA PESTAÑA (Vital para no perder el control)
        console.log("🔎 Buscando enlace...");
        const selectorEnlace = 'a[href*="citaconsular.es"]';
        await page.waitForSelector(selectorEnlace, { timeout: 30000 });
        // Forzamos que se abra aquí mismo
        await page.$eval(selectorEnlace, el => el.setAttribute('target', '_self'));

        // 3. CLIC Y ESPERA
        console.log("👉 Clic en el enlace...");
        await Promise.all([
            page.click(selectorEnlace),
            // Esperamos a que cargue la nueva página en esta misma ventana
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 })
        ]);

        // 4. MACHACAR ALERTA CON ENTER (Tu truco maestro)
        console.log("⚔️ Machacando alerta...");
        
        // Oyente de alertas
        page.on('dialog', async dialog => { try { await dialog.accept(); } catch(e){} });
        
        // Golpes de teclado por si la alerta es rebelde
        try {
            for (let i = 0; i < 5; i++) {
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 500));
            }
        } catch(e) {}

        // 5. RECARGA SI BLANCO (F5)
        let contenido = await page.content();
        if (contenido.length < 500) {
            console.log("⚠️ Blanco. F5...");
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                await new Promise(r => setTimeout(r, 5000));
                await page.keyboard.press('Enter');
            } catch(e) {}
        }

        // 6. BOTÓN CONTINUAR
        try {
            const boton = await page.waitForSelector('input[value*="Continuar"], input[value*="Continue"], button', { timeout: 15000 });
            if (boton) {
                console.log("👉 Botón Continuar...");
                await boton.click();
                await new Promise(r => setTimeout(r, 20000));
            }
        } catch (e) { console.log("ℹ️ No vi botón (seguimos)."); }

        // 7. ANÁLISIS FINAL (Lógica estricta)
        contenido = (await page.content()).toLowerCase();
        
        const exito = ["hueco", "libre", "reservar", "seleccionar"]; 
        const fracaso = ["no hay horas disponibles", "inténtelo de nuevo", "no availability"];

        if (exito.some(p => contenido.includes(p))) {
            console.log("🚨 ¡¡BINGO!! CITA DETECTADA.");
            await enviarCorreo(`¡Hay huecos! Entra desde el Ministerio.`);
        
        } else if (fracaso.some(f => contenido.includes(f))) {
            console.log("❌ Sin novedad. (Mensaje 'No hay horas').");
        
        } else {
            console.log("❓ Pantalla desconocida o Bloqueo.");
        }

    } catch (error) {
        console.error("⚠️ Error controlado:", error.message);
        process.exit(0); // Salimos sin error para que GitHub siga programado
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
}

checkCitas();
