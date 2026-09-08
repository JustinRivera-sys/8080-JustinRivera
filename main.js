const cpu = new Intel8080();
const assembler = new Assembler8080();

let runInterval = null;
let memoryStart = 0;

function updateUI() {
    // Registers
    document.getElementById('reg-a').textContent = cpu.registers.a.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-b').textContent = cpu.registers.b.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-c').textContent = cpu.registers.c.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-d').textContent = cpu.registers.d.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-e').textContent = cpu.registers.e.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-h').textContent = cpu.registers.h.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-l').textContent = cpu.registers.l.toString(16).toUpperCase().padStart(2, '0');
    document.getElementById('reg-pc').textContent = cpu.registers.pc.toString(16).toUpperCase().padStart(4, '0');
    document.getElementById('reg-sp').textContent = cpu.registers.sp.toString(16).toUpperCase().padStart(4, '0');
    document.getElementById('reg-f').textContent = cpu.getFlagByte().toString(16).toUpperCase().padStart(2, '0');

    // Flags
    document.getElementById('flag-s').textContent = cpu.flags.s ? '1' : '0';
    document.getElementById('flag-z').textContent = cpu.flags.z ? '1' : '0';
    document.getElementById('flag-ac').textContent = cpu.flags.ac ? '1' : '0';
    document.getElementById('flag-p').textContent = cpu.flags.p ? '1' : '0';
    document.getElementById('flag-cy').textContent = cpu.flags.cy ? '1' : '0';

    document.getElementById('status-badge').textContent = cpu.halted ? 'Halted' : (runInterval ? 'Running' : 'Idle');
    document.getElementById('status-badge').style.backgroundColor = cpu.halted ? '#fee2e2' : (runInterval ? '#f0fdf4' : '#e2e8f0');

    renderMemory();
    renderStack();
    renderFPU();
}

function formatBytes(byteArray) {
    return Array.from(byteArray).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}

function formatFloat(f) {
    if (Number.isNaN(f)) return 'NaN';
    if (!Number.isFinite(f)) return f > 0 ? '+Inf' : '-Inf';
    // Muestra hasta 6 decimales significativos, sin ceros de más
    return parseFloat(f.toPrecision(7)).toString();
}

function renderFPU() {
    const fpu = cpu.fpu;
    if (!fpu) return;

    document.getElementById('fpu-opa-hex').textContent = formatBytes(fpu.opA);
    document.getElementById('fpu-opb-hex').textContent = formatBytes(fpu.opB);
    document.getElementById('fpu-res-hex').textContent = formatBytes(fpu.result);

    document.getElementById('fpu-opa-val').textContent = formatFloat(fpu.bytesToFloat(fpu.opA));
    document.getElementById('fpu-opb-val').textContent = formatFloat(fpu.bytesToFloat(fpu.opB));
    document.getElementById('fpu-res-val').textContent = formatFloat(fpu.lastResult);

    document.getElementById('fpu-opname').textContent = fpu.lastOpName;

    document.getElementById('fpu-ready').textContent = fpu.status.ready ? '1' : '0';
    document.getElementById('fpu-error').textContent = fpu.status.error ? '1' : '0';

    const fpuCard = document.querySelector('.fpu');
    if (fpuCard) {
        fpuCard.classList.toggle('has-error', fpu.status.error);
    }
}

function renderStack() {
    const table = document.getElementById('stack-table');
    if (!table) return;
    table.innerHTML = '';

    const currentSP = cpu.registers.sp;

    // Show 5 slots (2-byte aligned) from SP - 4 to SP + 6
    for (let offset = 6; offset >= -4; offset -= 2) {
        const addr = (currentSP + offset) & 0xFFFF;

        const row = document.createElement('div');
        row.className = 'stack-row';
        if (offset === 0) {
            row.classList.add('active');
        }

        const addrSpan = document.createElement('span');
        addrSpan.className = 'stack-addr';
        addrSpan.textContent = (offset === 0 ? 'SP ➔ ' : '     ') + addr.toString(16).toUpperCase().padStart(4, '0') + ':';

        const low = cpu.readMemory(addr);
        const high = cpu.readMemory((addr + 1) & 0xFFFF);
        const val16 = (high << 8) | low;

        const valSpan = document.createElement('span');
        valSpan.className = 'stack-val';
        valSpan.textContent = val16.toString(16).toUpperCase().padStart(4, '0') + 'H (' + high.toString(16).toUpperCase().padStart(2, '0') + ' ' + low.toString(16).toUpperCase().padStart(2, '0') + ')';

        row.appendChild(addrSpan);
        row.appendChild(valSpan);
        table.appendChild(row);
    }
}

function renderMemory() {
    const table = document.getElementById('memory-table');
    table.innerHTML = '';

    // Header
    const empty = document.createElement('div');
    empty.className = 'mem-cell mem-header';
    empty.textContent = '';
    table.appendChild(empty);

    for (let i = 0; i < 16; i++) {
        const h = document.createElement('div');
        h.className = 'mem-cell mem-header';
        h.textContent = i.toString(16).toUpperCase();
        table.appendChild(h);
    }

    // Rows
    for (let row = 0; row < 8; row++) {
        const addr = (memoryStart + row * 16) & 0xFFFF;
        const h = document.createElement('div');
        h.className = 'mem-cell mem-addr';
        h.textContent = addr.toString(16).toUpperCase().padStart(4, '0');
        table.appendChild(h);

        for (let col = 0; col < 16; col++) {
            const cellAddr = (addr + col) & 0xFFFF;
            const c = document.createElement('div');
            c.className = 'mem-cell';
            if (cellAddr === cpu.registers.pc) c.style.backgroundColor = '#fde047';
            c.textContent = cpu.readMemory(cellAddr).toString(16).toUpperCase().padStart(2, '0');
            table.appendChild(c);
        }
    }
}

document.getElementById('btn-assemble').addEventListener('click', () => {
    const source = document.getElementById('code-editor').value;
    const output = document.getElementById('assembler-output');
    try {
        const result = assembler.assemble(source);
        cpu.memory.set(result.binary);
        output.textContent = 'Assembly successful! Loaded into memory.';
        output.className = 'success';
        updateUI();
    } catch (e) {
        output.textContent = 'Error: ' + e.message;
        output.className = 'error';
    }
});

document.getElementById('btn-clear-code').addEventListener('click', () => {
    document.getElementById('code-editor').value = '';
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = '';
        output.className = '';
    }
});

document.getElementById('btn-fpu-demo').addEventListener('click', () => {
    const demo = `; ==========================================================
; DEMO: Coprocesador de Punto Flotante (FPU8087 conceptual)
; Calcula 2.5 + 4.5 usando IN/OUT y guarda el resultado en 3000H
; ==========================================================

; --- Cargar Operando A = 2.5 (IEEE-754: 00 00 20 40) ---
MVI A, 00H
OUT 10H
MVI A, 00H
OUT 11H
MVI A, 20H
OUT 12H
MVI A, 40H
OUT 13H

; --- Cargar Operando B = 4.5 (IEEE-754: 00 00 90 40) ---
MVI A, 00H
OUT 14H
MVI A, 00H
OUT 15H
MVI A, 90H
OUT 16H
MVI A, 40H
OUT 17H

; --- Disparar operacion FADD (01H = suma) ---
MVI A, 01H
OUT 18H

; --- Leer resultado (4 bytes) y guardarlo en memoria 3000H ---
IN 1AH
STA 3000H
IN 1BH
STA 3001H
IN 1CH
STA 3002H
IN 1DH
STA 3003H

HLT`;
    document.getElementById('code-editor').value = demo;
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = 'Demo FPU cargado. Presiona "Assemble & Load" y luego "Run" o "Step".';
        output.className = '';
    }
});

document.getElementById('btn-step').addEventListener('click', () => {
    cpu.step();
    updateUI();
});

document.getElementById('btn-run').addEventListener('click', () => {
    if (runInterval) return;
    runInterval = setInterval(() => {
        if (cpu.halted) {
            clearInterval(runInterval);
            runInterval = null;
            updateUI();
            return;
        }
        for (let i = 0; i < 100; i++) { // Execute in bursts
            cpu.step();
            if (cpu.halted) break;
        }
        updateUI();
    }, 10);
    updateUI();
});

document.getElementById('btn-stop').addEventListener('click', () => {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
        updateUI();
    }
});

document.getElementById('btn-reset').addEventListener('click', () => {
    if (runInterval) {
        clearInterval(runInterval);
        runInterval = null;
    }
    cpu.reset();

    // Clear assembler output
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = '';
        output.className = '';
    }

    // Reset memory start address and variable
    const memStartInput = document.getElementById('mem-start-addr');
    if (memStartInput) {
        memStartInput.value = '0000';
    }
    memoryStart = 0;

    updateUI();
});

document.getElementById('btn-mem-go').addEventListener('click', () => {
    const val = document.getElementById('mem-start-addr').value;
    memoryStart = parseInt(val, 16) || 0;
    renderMemory();
});

// Initial UI update
updateUI();
