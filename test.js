// test.js - Unit tests for Intel 8080 CPU and Assembler
const Intel8080 = require('./cpu.js');
const Assembler8080 = require('./assembler.js');
const assert = require('assert');

console.log('--- Running Intel 8080 Emulator & Assembler Tests ---');

// Helper to run a test block and report status
function runTest(name, fn) {
    try {
        fn();
        console.log(`[PASS] ${name}`);
    } catch (e) {
        console.error(`[FAIL] ${name}`);
        console.error(e);
        process.exit(1);
    }
}

runTest('CPU Reset & Initial Values', () => {
    const cpu = new Intel8080();
    assert.strictEqual(cpu.registers.a, 0);
    assert.strictEqual(cpu.registers.b, 0);
    assert.strictEqual(cpu.registers.sp, 0xFFFF);
    assert.strictEqual(cpu.registers.pc, 0);
    assert.strictEqual(cpu.flags.z, false);
    assert.strictEqual(cpu.flags.cy, false);
    assert.strictEqual(cpu.halted, false);
});

runTest('INR / DCR AC Flag Behavior', () => {
    const cpu = new Intel8080();

    // INR 0x0F -> should set AC
    cpu.registers.a = 0x0F;
    cpu.execute(0x3C); // INR A
    assert.strictEqual(cpu.registers.a, 0x10);
    assert.strictEqual(cpu.flags.ac, true, 'INR 0x0F should set AC flag');

    // DCR 0x10 -> should clear AC (as there is a borrow out of low order nibble, complement of borrow is 0)
    cpu.registers.a = 0x10;
    cpu.execute(0x3D); // DCR A
    assert.strictEqual(cpu.registers.a, 0x0F);
    assert.strictEqual(cpu.flags.ac, false, 'DCR 0x10 should clear AC flag');

    // DCR 0x0F -> should set AC (as there is no borrow out of low order nibble, complement of borrow is 1)
    cpu.registers.a = 0x0F;
    cpu.execute(0x3D); // DCR A
    assert.strictEqual(cpu.registers.a, 0x0E);
    assert.strictEqual(cpu.flags.ac, true, 'DCR 0x0F should set AC flag');
});

runTest('Subtraction AC and Carry Flag Logic', () => {
    const cpu = new Intel8080();

    // Test: 0x3E - 0x05 (no borrow)
    cpu.registers.a = 0x3E;
    cpu.executeALU(2, 0x05); // SUB 0x05 (ALU op 2 is SUB)
    assert.strictEqual(cpu.registers.a, 0x39);
    assert.strictEqual(cpu.flags.cy, false);
    // (0x0E & 0x0F) - (0x05 & 0x0F) = 0x0E - 0x05 = 0x09 >= 0, so AC flag calculation should match physical 8080
    // In physical 8080, SUB does: A + ~B + 1.
    // Let's check AC logic: 0x3E + ~0x05 + 1 = 0x3E + 0xFA + 1. Low nibbles: 0x0E + 0x0A + 1 = 0x19 (carry out is 1)
    // Physical 8080 does not invert AC after subtraction, so AC = 1.
    assert.strictEqual(cpu.flags.ac, true, 'SUB 0x3E - 0x05 should result in AC = 1 (since 0x0E + 0x0A + 1 = 0x19)');

    // Test: 0x00 - 0x01
    cpu.reset();
    cpu.registers.a = 0x00;
    cpu.executeALU(2, 0x01); // SUB 0x01
    assert.strictEqual(cpu.registers.a, 0xFF);
    assert.strictEqual(cpu.flags.cy, true, '0x00 - 0x01 should set carry (borrow)');
    // Low nibbles: 0x00 + ~0x01 + 1 = 0x00 + 0x0E + 1 = 0x0F (carry out is 0). Thus AC = 0.
    assert.strictEqual(cpu.flags.ac, false, '0x00 - 0x01 should result in AC = 0');
});

runTest('Rotate Masking (RLC / RAL accumulator 8-bit safety)', () => {
    const cpu = new Intel8080();

    // RLC with MSB set: 0x80 -> should rotate to 0x01, CY = true
    cpu.registers.a = 0x80;
    cpu.execute(0x07); // RLC
    assert.strictEqual(cpu.registers.a, 0x01);
    assert.strictEqual(cpu.flags.cy, true);

    // RAL with MSB set and CY = false: 0x80 -> should rotate to 0x00, CY = true
    cpu.reset();
    cpu.registers.a = 0x80;
    cpu.flags.cy = false;
    cpu.execute(0x17); // RAL
    assert.strictEqual(cpu.registers.a, 0x00);
    assert.strictEqual(cpu.flags.cy, true);
});

runTest('Assembler Supports Pair Names (BC, DE, HL)', () => {
    const assembler = new Assembler8080();
    const source = `
        LXI BC, 1234H
        LXI DE, 5678H
        LXI HL, 9ABCH
    `;
    const result = assembler.assemble(source);
    const bin = result.binary;

    // LXI BC, 1234H -> 01 34 12
    assert.strictEqual(bin[0], 0x01);
    assert.strictEqual(bin[1], 0x34);
    assert.strictEqual(bin[2], 0x12);

    // LXI DE, 5678H -> 11 78 56
    assert.strictEqual(bin[3], 0x11);
    assert.strictEqual(bin[4], 0x78);
    assert.strictEqual(bin[5], 0x56);

    // LXI HL, 9ABCH -> 21 BC 9A
    assert.strictEqual(bin[6], 0x21);
    assert.strictEqual(bin[7], 0xBC);
    assert.strictEqual(bin[8], 0x9A);
});

runTest('Assembler Supports RST 0 - RST 7 Instructions', () => {
    const assembler = new Assembler8080();
    const source = `
        RST 0
        RST 3
        RST 7
    `;
    const result = assembler.assemble(source);
    const bin = result.binary;

    assert.strictEqual(bin[0], 0xC7); // RST 0
    assert.strictEqual(bin[1], 0xDF); // RST 3
    assert.strictEqual(bin[2], 0xFF); // RST 7
});

runTest('Assembler Rejects Invalid Code & Registers', () => {
    const assembler = new Assembler8080();

    // Test invalid register
    assert.throws(() => {
        assembler.assemble('MOV B, X');
    }, /Invalid register/i);

    // Test MOV M, M (illegal instruction on 8080)
    assert.throws(() => {
        assembler.assemble('MOV M, M');
    }, /Cannot use MOV M, M/i);

    // Test undefined labels
    assert.throws(() => {
        assembler.assemble('JMP UNDEFINED_LABEL');
    }, /Undefined label/i);
});

runTest('FPU Coprocessor: FADD via IN/OUT ports (2.5 + 4.5 = 7)', () => {
    const cpu = new Intel8080();

    function floatBytes(f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        return [0, 1, 2, 3].map(i => view.getUint8(i));
    }

    floatBytes(2.5).forEach((b, i) => cpu.ioWrite(0x10 + i, b)); // Operando A
    floatBytes(4.5).forEach((b, i) => cpu.ioWrite(0x14 + i, b)); // Operando B
    cpu.ioWrite(0x18, 0x01); // FADD

    const resBytes = [0, 1, 2, 3].map(i => cpu.ioRead(0x1A + i));
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    resBytes.forEach((b, i) => view.setUint8(i, b));

    assert.strictEqual(view.getFloat32(0, true), 7);
    assert.strictEqual(cpu.ioRead(0x19) & 0x01, 0x01, 'READY debe estar en 1 tras completar la operacion');
    assert.strictEqual(cpu.ioRead(0x19) & 0x02, 0, 'ERROR no debe estar activo en una suma valida');
});

runTest('FPU Coprocessor: FDIV by zero sets ERROR flag', () => {
    const cpu = new Intel8080();

    function floatBytes(f) {
        const buf = new ArrayBuffer(4);
        const view = new DataView(buf);
        view.setFloat32(0, f, true);
        return [0, 1, 2, 3].map(i => view.getUint8(i));
    }

    floatBytes(1.0).forEach((b, i) => cpu.ioWrite(0x10 + i, b));
    floatBytes(0.0).forEach((b, i) => cpu.ioWrite(0x14 + i, b));
    cpu.ioWrite(0x18, 0x04); // FDIV

    assert.strictEqual(cpu.ioRead(0x19) & 0x02, 0x02, 'ERROR debe activarse en division por cero');
});

runTest('FPU Coprocessor: unrelated I/O ports are ignored safely', () => {
    const cpu = new Intel8080();
    assert.strictEqual(cpu.ioRead(0x50), 0xFF, 'Puerto no conectado debe devolver 0xFF (bus flotante)');
    cpu.ioWrite(0x50, 0x99); // No debe lanzar error ni afectar la FPU
    assert.strictEqual(cpu.fpu.status.ready, true);
});

console.log('All tests completed successfully!');
