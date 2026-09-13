/**
 * FPU8087 - Coprocesador Aritmetico de Punto Flotante (conceptual)
 * ------------------------------------------------------------------
 * El Intel 8080 real nunca tuvo un coprocesador oficial (el historico
 * fue el 8087, companero del 8086/8088). Este modulo integra, de forma
 * CONCEPTUAL Y DIDACTICA, un coprocesador de punto flotante que
 * COMPARTE LA MISMA MEMORIA que la CPU (memoria compartida / memory-
 * mapped I/O): no existe un canal de comunicacion separado, ambos
 * dispositivos leen y escriben las mismas celdas del arreglo de 64KB.
 *
 * La CPU "avisa" al coprocesador escribiendo en la direccion de
 * COMANDO (9008H). En ese instante, el coprocesador toma el control:
 * lee los operandos desde la memoria compartida (9000H-9007H), calcula
 * el resultado, y lo vuelve a dejar en otra seccion de la misma
 * memoria (900AH en adelante) para que la CPU lo pueda leer despues
 * con una simple instruccion LDA, exactamente igual que leeria
 * cualquier otro dato.
 *
 * MAPA DE MEMORIA COMPARTIDA (CPU <-> Coprocesador)
 * ------------------------------------------------------------------
 *  9000H-9003H  Operando A   (float32 IEEE-754, little-endian) [CPU escribe]
 *  9004H-9007H  Operando B   (float32 IEEE-754, little-endian) [CPU escribe]
 *  9008H        Comando      (dispara la operacion)            [CPU escribe]
 *                  01H = FADD (A + B)
 *                  02H = FSUB (A - B)
 *                  03H = FMUL (A * B)
 *                  04H = FDIV (A / B)
 *  9009H        Estado       (bit0=READY, bit1=ERROR)          [FPU escribe]
 *  900AH-900DH  Resultado    (float32 IEEE-754, little-endian) [FPU escribe]
 *  900EH        Resultado entero truncado (0-255)              [FPU escribe]
 *  900FH        Total entero acumulado por el programa 8080    [CPU escribe]
 */
class FPU8087 {
    constructor(memory) {
        this.memory = memory; // Referencia COMPARTIDA al mismo Uint8Array que usa la CPU

        this.ADDR_OPA        = 0x9000; // 4 bytes
        this.ADDR_OPB        = 0x9004; // 4 bytes
        this.ADDR_CMD        = 0x9008; // 1 byte  (escribir aqui dispara la operacion)
        this.ADDR_STATUS     = 0x9009; // 1 byte
        this.ADDR_RESULT     = 0x900A; // 4 bytes (float32)
        this.ADDR_RESULT_INT = 0x900E; // 1 byte  (parte entera truncada, 0-255)
        this.ADDR_TOTAL      = 0x900F; // 1 byte  (lo usa el programa 8080, no la FPU)

        this.lastOpName = '-';
        this.lastA = 0;
        this.lastB = 0;
        this.lastResult = 0;

        this.reset();
    }

    reset() {
        this.lastOpName = '-';
        this.lastA = 0;
        this.lastB = 0;
        this.lastResult = 0;
        if (this.memory) {
            this.memory[this.ADDR_STATUS] = 0x01; // READY = 1, ERROR = 0
        }
    }

    /** true si esta direccion es la que dispara una operacion */
    isTriggerAddress(addr) {
        return addr === this.ADDR_CMD;
    }

    /** Lee un float32 (little-endian) desde 4 bytes consecutivos de la memoria compartida */
    readFloat(addr) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        for (let i = 0; i < 4; i++) view.setUint8(i, this.memory[addr + i]);
        return view.getFloat32(0, true);
    }

    /** Escribe un float32 (little-endian) en 4 bytes consecutivos de la memoria compartida */
    writeFloat(addr, f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        for (let i = 0; i < 4; i++) this.memory[addr + i] = view.getUint8(i);
    }

    /**
     * Ejecuta la operacion solicitada. Se llama automaticamente cuando
     * la CPU escribe en ADDR_CMD (9008H) mediante una instruccion normal
     * como STA o MOV M,A -- es decir, el "disparo" ocurre por compartir
     * memoria, no por un mecanismo especial de E/S.
     */
    compute(opCode) {
        const a = this.readFloat(this.ADDR_OPA);
        const b = this.readFloat(this.ADDR_OPB);
        let r = 0;
        let error = false;

        switch (opCode) {
            case 0x01: this.lastOpName = 'FADD'; r = a + b; break;
            case 0x02: this.lastOpName = 'FSUB'; r = a - b; break;
            case 0x03: this.lastOpName = 'FMUL'; r = a * b; break;
            case 0x04:
                this.lastOpName = 'FDIV';
                if (b === 0) { error = true; r = 0; } else { r = a / b; }
                break;
            default:
                this.lastOpName = 'NOP';
                r = 0;
        }

        this.lastA = a;
        this.lastB = b;
        this.lastResult = r;

        // El resultado se deja en OTRA seccion de la misma memoria compartida
        this.writeFloat(this.ADDR_RESULT, r);

        // Version entera truncada (0-255), para que el 8080 -que solo
        // maneja enteros de 8 bits- la pueda sumar con una simple ADD.
        let intPart = Math.trunc(Math.abs(r));
        if (intPart > 255) intPart = 255;
        this.memory[this.ADDR_RESULT_INT] = intPart & 0xFF;

        let status = 0x01; // READY
        if (error) status |= 0x02; // ERROR
        this.memory[this.ADDR_STATUS] = status;
    }
}

if (typeof module !== 'undefined') {
    module.exports = FPU8087;
}
