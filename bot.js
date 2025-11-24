const puppeteer = require('puppeteer');
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
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 1. IR AL MINISTERIO (Le damos mucho tiempo: 2 minutos)
        console.log("🌍 Entrando al Ministerio...");
        try {
            await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
        } catch (e) {
            console.log("⚠️ La web tarda mucho, pero seguimos intentando...");
        }

        // 2. TRUCO MISMA PESTAÑA
        console.log("🔎 Buscando enlace...");
        const selectorEnlace = 'a[href*="citaconsular.es"]';
        await page.waitForSelector(selectorEnlace, { timeout: 20000 });
        await page.$eval(selectorEnlace, el => el.setAttribute('target', '_self'));

        // 3. CLIC Y ESPERA FIJA (Aquí estaba el fallo antes)
        console.log("👉 Clic en el enlace...");
        
        // NO esperamos a la navegación perfecta, solo hacemos clic y esperamos tiempo real
        await page.click(selectorEnlace);
        
        console.log("⏳ Esperando 20 segundos a que cargue la web lenta...");
        await new Promise(r => setTimeout(r, 20000));

        // 4. MACHACAR ALERTA CON ENTER
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
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch(e) {}
            await new Promise(r => setTimeout(r, 5000));
            await page.keyboard.press('Enter');
        }

        // 6. BOTÓN CONTINUAR
        try {
            const boton = await page.waitForSelector('input[value*="Continuar"], input[value*="Continue"], button', { timeout: 10000 });
            if (boton) {
                console.log("👉 Botón Continuar...");
                await boton.click();
                // Esperamos otros 15 segundos fijos
                await new Promise(r => setTimeout(r, 15000));
            }
        } catch (e) { console.log("ℹ️ No vi botón (quizás ya pasó)."); }

        // 7. ANÁLISIS FINAL
        contenido = (await page.content()).toLowerCase();
        
        const exito = ["hueco", "libre", "reservar", "seleccionar"]; 
        const fracaso = ["no hay horas disponibles", "inténtelo de nuevo", "no availability"];

        if (exito.some(p => contenido.includes(p))) {
            console.log("🚨 ¡¡BINGO!! CITA DETECTADA.");
            await enviarCorreo(`¡Hay huecos! Entra desde el Ministerio.`);
        
        } else if (fracaso.some(f => contenido.includes(f))) {
            console.log("❌ Sin novedad. (Mensaje 'No hay horas').");
        
        } else {
            console.log("❓ Pantalla desconocida o Error de carga.");
        }

    } catch (error) {
        console.error("⚠️ Error fatal:", error.message);
        process.exit(1);
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
}

checkCitas();
