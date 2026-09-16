// Coprocesador FPU (punto flotante), memoria compartida con la CPU.
// Mapa: 9000-9003 opA, 9004-9007 opB, 9008 comando, 9009 estado,
// 900A-900D resultado, 900E resultado entero, 900F total (uso del CPU).
class FPU8087 {
    constructor(memory) {
        this.memory = memory;

        this.ADDR_OPA = 0x9000;
        this.ADDR_OPB = 0x9004;
        this.ADDR_CMD = 0x9008;
        this.ADDR_STATUS = 0x9009;
        this.ADDR_RESULT = 0x900A;
        this.ADDR_RESULT_INT = 0x900E;
        this.ADDR_TOTAL = 0x900F;

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
            this.memory[this.ADDR_STATUS] = 0x01;
        }
    }

    isTriggerAddress(addr) {
        return addr === this.ADDR_CMD;
    }

    readFloat(addr) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        for (let i = 0; i < 4; i++) view.setUint8(i, this.memory[addr + i]);
        return view.getFloat32(0, true);
    }

    writeFloat(addr, f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        for (let i = 0; i < 4; i++) this.memory[addr + i] = view.getUint8(i);
    }

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

        this.writeFloat(this.ADDR_RESULT, r);

        let intPart = Math.trunc(Math.abs(r));
        if (intPart > 255) intPart = 255;
        this.memory[this.ADDR_RESULT_INT] = intPart & 0xFF;

        let status = 0x01;
        if (error) status |= 0x02;
        this.memory[this.ADDR_STATUS] = status;
    }
}

if (typeof module !== 'undefined') {
    module.exports = FPU8087;
}
