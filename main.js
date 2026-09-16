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

    const opaBytes = [0, 1, 2, 3].map(i => cpu.readMemory(fpu.ADDR_OPA + i));
    const opbBytes = [0, 1, 2, 3].map(i => cpu.readMemory(fpu.ADDR_OPB + i));
    const resBytes = [0, 1, 2, 3].map(i => cpu.readMemory(fpu.ADDR_RESULT + i));

    document.getElementById('fpu-opa-hex').textContent = formatBytes(opaBytes);
    document.getElementById('fpu-opb-hex').textContent = formatBytes(opbBytes);
    document.getElementById('fpu-res-hex').textContent = formatBytes(resBytes);

    document.getElementById('fpu-opa-val').textContent = formatFloat(fpu.readFloat(fpu.ADDR_OPA));
    document.getElementById('fpu-opb-val').textContent = formatFloat(fpu.readFloat(fpu.ADDR_OPB));
    document.getElementById('fpu-res-val').textContent = formatFloat(fpu.readFloat(fpu.ADDR_RESULT));

    document.getElementById('fpu-opname').textContent = fpu.lastOpName;

    const status = cpu.readMemory(fpu.ADDR_STATUS);
    document.getElementById('fpu-ready').textContent = (status & 0x01) ? '1' : '0';
    document.getElementById('fpu-error').textContent = (status & 0x02) ? '1' : '0';
    document.getElementById('fpu-res-int').textContent = cpu.readMemory(fpu.ADDR_RESULT_INT);
    document.getElementById('fpu-total').textContent = cpu.readMemory(fpu.ADDR_TOTAL);

    const fpuCard = document.querySelector('.fpu');
    if (fpuCard) {
        fpuCard.classList.toggle('has-error', !!(status & 0x02));
    }
}

function setMemoryStart(addr) {
    memoryStart = addr & 0xFFFF;
    const memStartInput = document.getElementById('mem-start-addr');
    if (memStartInput) {
        memStartInput.value = memoryStart.toString(16).toUpperCase().padStart(4, '0');
    }
    renderMemory();
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
            if (cpu.fpu && cellAddr >= 0x9000 && cellAddr <= 0x900F) {
                c.classList.add('mem-fpu-zone');
                c.title = 'Zona compartida FPU';
            }
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
    const demo = `; Coprocesador FPU - memoria compartida 9000H-900FH
; 10.01 + 10.02, resultado entero + total previo = 25

MVI A, 05H
STA 900FH

; Operando A = 10.01 (F6 28 20 41)
MVI A, 0F6H
STA 9000H
MVI A, 28H
STA 9001H
MVI A, 20H
STA 9002H
MVI A, 41H
STA 9003H

; Operando B = 10.02 (EC 51 20 41)
MVI A, 0ECH
STA 9004H
MVI A, 51H
STA 9005H
MVI A, 20H
STA 9006H
MVI A, 41H
STA 9007H

; comando -> dispara la FPU
MVI A, 01H
STA 9008H

LDA 900EH
MOV B, A
LDA 900FH
ADD B
STA 900FH

HLT`;
    document.getElementById('code-editor').value = demo;
    const output = document.getElementById('assembler-output');
    if (output) {
        output.textContent = 'Demo cargado. Assemble & Load y luego Run o Step.';
        output.className = '';
    }
});

document.querySelectorAll('.fpu-jump-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const addr = parseInt(btn.getAttribute('data-addr'), 16);
        setMemoryStart(addr);
    });
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
