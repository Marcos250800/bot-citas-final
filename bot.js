const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const config = require('./config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: config.emailUser, pass: config.emailPass }
});

async function enviarCorreo(mensaje) {
    const mailOptions = {
        from: config.emailUser,
        to: config.emailDestino,
        subject: '🚨 ¡CITA DETECTADA! (GitHub Actions)',
        text: `¡ÉXITO! El bot ha visto: "${mensaje}"\n\nENTRA YA: ${config.base44ApiUrl}\n\nHora: ${new Date().toLocaleTimeString()}`
    };
    try { await transporter.sendMail(mailOptions); console.log('📧 CORREO ENVIADO'); } 
    catch (error) { console.error('Error email:', error); }
}

async function checkCitas() {
    console.log("🤖 Iniciando escaneo rápido...");
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1920,1080']
        });

        const page = await browser.newPage();
        
        // Disfraz de Windows para que no nos bloqueen
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Entrar a la web (esperamos hasta 60s)
        await page.goto(config.base44ApiUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Intentar pulsar continuar si existe
        try {
            const boton = await page.waitForSelector('input[value*="Continuar"], input[value*="Continue"], button', { timeout: 8000 });
            if (boton) {
                await boton.click();
                await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
            }
        } catch (e) {}

        // ANÁLISIS
        const contenido = await page.content();
        const textoWeb = contenido.toLowerCase();
        
        const frasesExito = ["hueco", "libre", "reservar", "seleccionar"];
        const frasesRechazo = ["no hay horas disponibles", "inténtelo de nuevo", "no availability"];

        if (frasesExito.some(p => textoWeb.includes(p))) {
            console.log("🚨 ¡BINGO! CITA ENCONTRADA.");
            await enviarCorreo("Se han detectado huecos libres.");
        } else if (frasesRechazo.some(f => textoWeb.includes(f))) {
            console.log("❌ Nada. Mensaje de 'No hay horas' detectado.");
        } else {
            console.log("⚠️ Lectura confusa (posible bloqueo o error).");
        }

    } catch (error) {
        console.error("Fallo:", error.message);
    } finally {
        if (browser) await browser.close();
        process.exit(0); // Apagar la máquina al terminar
    }
}

checkCitas();
