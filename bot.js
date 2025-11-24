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
            // AQUI ESTÁ EL CAMBIO: Damos 4 minutos de margen técnico
            protocolTimeout: 240000, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        // Aumentamos también el tiempo de espera por defecto a 2 minutos
        page.setDefaultTimeout(120000); 
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // 1. IR AL MINISTERIO
        console.log("🌍 Entrando al Ministerio...");
        await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded' });

        // 2. TRUCO MISMA PESTAÑA
        console.log("🔎 Buscando enlace...");
        const selectorEnlace = 'a[href*="citaconsular.es"]';
        await page.waitForSelector(selectorEnlace);
        await page.$eval(selectorEnlace, el => el.setAttribute('target', '_self'));

        // 3. CLIC Y ESPERA (Sin waitForNavigation para no bloquearnos)
        console.log("👉 Clic en el enlace...");
        await page.click(selectorEnlace);
        
        console.log("⏳ Esperando 25 segundos a que cargue (Modo Seguro)...");
        await new Promise(r => setTimeout(r, 25000));

        // 4. MACHACAR ALERTA (Con try/catch para que no falle nunca)
        console.log("⚔️ Gestionando alertas...");
        
        // Intento A: Diálogo nativo
        page.on('dialog', async dialog => { try { await dialog.accept(); } catch(e){} });
        
        // Intento B: Teclado (Protegido contra fallos)
        try {
            for (let i = 0; i < 5; i++) {
                await page.keyboard.press('Enter');
                await new Promise(r => setTimeout(r, 500));
            }
        } catch(e) { console.log("⚠️ No se pudo usar el teclado (no grave)."); }

        // 5. RECARGA SI BLANCO
        let contenido = await page.content();
        if (contenido.length < 500) {
            console.log("⚠️ Blanco. F5...");
            try {
                await page.reload({ waitUntil: 'domcontentloaded' });
                await new Promise(r => setTimeout(r, 5000));
                await page.keyboard.press('Enter');
            } catch(e) {}
        }

        // 6. BOTÓN CONTINUAR
        try {
            const boton = await page.waitForSelector('input[value*="Continuar"], input[value*="Continue"], button', { timeout: 10000 });
            if (boton) {
                console.log("👉 Botón Continuar...");
                await boton.click();
                await new Promise(r => setTimeout(r, 15000));
            }
        } catch (e) { console.log("ℹ️ No vi botón (seguimos)."); }

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
            console.log("❓ Pantalla desconocida (Posible bloqueo).");
        }

    } catch (error) {
        console.error("⚠️ Error controlado:", error.message);
        // No salimos con error (exit 1) para que GitHub no te mande mail de "Failed Run"
        process.exit(0); 
    } finally {
        if (browser) await browser.close();
        process.exit(0);
    }
}

checkCitas();
