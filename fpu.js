/**
 * FPU8087 - Coprocesador Aritmético de Punto Flotante (conceptual)
 * ------------------------------------------------------------------
 * El Intel 8080 real nunca tuvo un coprocesador oficial (el histórico
 * fue el 8087, compañero del 8086/8088). Este módulo integra, de forma
 * CONCEPTUAL Y DIDÁCTICA, un coprocesador de punto flotante que se
 * comunica con la CPU a través del bus de E/S (I/O) del propio 8080,
 * usando las instrucciones ya existentes IN (0xDB) y OUT (0xD3).
 *
 * Esto es fiel a como los coprocesadores/periféricos reales del 8080
 * se comunicaban: mediante puertos de 8 bits direccionados con IN/OUT.
 *
 * MAPA DE PUERTOS
 * ------------------------------------------------------------------
 *  OUT 10H..13H  -> Escribe byte 0..3 (LSB..MSB) del Operando A (float32)
 *  OUT 14H..17H  -> Escribe byte 0..3 (LSB..MSB) del Operando B (float32)
 *  OUT 18H       -> Registro de Comando (dispara la operación):
 *                     01H = FADD (A + B)
 *                     02H = FSUB (A - B)
 *                     03H = FMUL (A * B)
 *                     04H = FDIV (A / B)
 *  IN  19H       -> Registro de Estado (lectura):
 *                     bit 0 (01H) = READY  (1 = resultado listo)
 *                     bit 1 (02H) = ERROR  (1 = división por cero)
 *  IN  1AH..1DH  -> Lee byte 0..3 (LSB..MSB) del Resultado (float32)
 *
 * El resultado se almacena internamente en formato IEEE-754 de
 * precisión simple (32 bits), igual que un "float" en C/JS.
 */
class FPU8087 {
    constructor() {
        this.opA = new Uint8Array(4);
        this.opB = new Uint8Array(4);
        this.result = new Uint8Array(4);

        this.status = {
            ready: true,   // true = no hay operación pendiente / resultado disponible
            error: false   // true = último error (ej. división por cero)
        };

        // Metadatos para la UI (no forman parte del "hardware" real)
        this.lastOpName = '-';
        this.lastA = 0;
        this.lastB = 0;
        this.lastResult = 0;
    }

    reset() {
        this.opA.fill(0);
        this.opB.fill(0);
        this.result.fill(0);
        this.status.ready = true;
        this.status.error = false;
        this.lastOpName = '-';
        this.lastA = 0;
        this.lastB = 0;
        this.lastResult = 0;
    }

    /** Indica si este dispositivo atiende el puerto dado */
    handlesPort(port) {
        return port >= 0x10 && port <= 0x1D;
    }

    /** Atiende una instrucción OUT port, A */
    out(port, value) {
        value &= 0xFF;
        if (port >= 0x10 && port <= 0x13) {
            this.opA[port - 0x10] = value;
            this.status.ready = false;
        } else if (port >= 0x14 && port <= 0x17) {
            this.opB[port - 0x14] = value;
            this.status.ready = false;
        } else if (port === 0x18) {
            this.compute(value);
        }
    }

    /** Atiende una instrucción IN A, port. Devuelve el byte leído. */
    in(port) {
        if (port === 0x19) {
            let s = 0;
            if (this.status.ready) s |= 0x01;
            if (this.status.error) s |= 0x02;
            return s;
        }
        if (port >= 0x1A && port <= 0x1D) {
            return this.result[port - 0x1A];
        }
        return 0xFF; // puerto no asignado -> bus flotante
    }

    /** Convierte 4 bytes (little-endian) a un float de 32 bits (JS number) */
    bytesToFloat(bytes) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        for (let i = 0; i < 4; i++) view.setUint8(i, bytes[i]);
        return view.getFloat32(0, true);
    }

    /** Convierte un float de 32 bits a 4 bytes (little-endian) */
    floatToBytes(f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        const out = new Uint8Array(4);
        for (let i = 0; i < 4; i++) out[i] = view.getUint8(i);
        return out;
    }

    /** Ejecuta la operación solicitada sobre opA y opB */
    compute(opCode) {
        const a = this.bytesToFloat(this.opA);
        const b = this.bytesToFloat(this.opB);
        let r = 0;
        this.status.error = false;

        switch (opCode) {
            case 0x01: this.lastOpName = 'FADD'; r = a + b; break;
            case 0x02: this.lastOpName = 'FSUB'; r = a - b; break;
            case 0x03: this.lastOpName = 'FMUL'; r = a * b; break;
            case 0x04:
                this.lastOpName = 'FDIV';
                if (b === 0) {
                    this.status.error = true;
                    r = 0;
                } else {
                    r = a / b;
                }
                break;
            default:
                this.lastOpName = 'NOP';
                r = 0;
        }

        this.lastA = a;
        this.lastB = b;
        this.lastResult = r;
        this.result = this.floatToBytes(r);
        this.status.ready = true;
    }
}

if (typeof module !== 'undefined') {
    module.exports = FPU8087;
}
