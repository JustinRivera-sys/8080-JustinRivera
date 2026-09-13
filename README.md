# Intel 8080 CPU Emulator & Assembler - Version 2.1.0

Bienvenidos al emulador y ensamblador de la arquitectura Intel 8080. Este proyecto ha sido construido desde cero utilizando tecnología 100% web pura (HTML5, CSS3 y Vanilla JavaScript) sin frameworks ni dependencias de ningún tipo, garantizando una carga instantánea y la máxima compatibilidad educativa.

---

## 🌟 ¿Por qué nació este proyecto? (Historia y Propósito)

En la enseñanza de la informática y la ingeniería de sistemas, existe una brecha pedagógica crítica al transicionar de lenguajes de alto nivel (como Python, Java o JavaScript) al entendimiento del hardware real. Los simuladores tradicionales de bajo nivel suelen ser difíciles de instalar, tienen interfaces obsoletas o carecen de feedback visual inmediato.

**Este simulador nació con el propósito de resolver este problema.** Su objetivo es democratizar la enseñanza de la arquitectura de computadoras proporcionando un entorno gráfico intuitivo, interactivo y moderno. Permite a los estudiantes "ver dentro" de una unidad central de procesamiento (CPU): observar cómo cambian los registros paso a paso, cómo fluyen los datos en la memoria RAM y cómo se comportan las banderas de estado (*flags*) en respuesta a operaciones aritméticas elementales.

---

## 🛠️ ¿Para qué sirve?

*   **Enseñanza Didáctica y Práctica:** Ideal para profesores y estudiantes de ciencias de la computación que desean experimentar la programación en lenguaje ensamblador sin la fricción de instalar herramientas en sistemas operativos locales.
*   **Visualización de Flujo de Datos:** El panel interactivo permite observar las dinámicas de:
    *   Los registros de propósito general y específicos.
    *   Las operaciones de pila (*Stack*) con seguimiento visual directo de la dirección apuntada por `SP`.
    *   La memoria RAM desglosada en un mapa bidimensional interactivo con localización instantánea.
*   **Depuración Paso a Paso (*Debugging*):** Permite ejecutar programas instrucción por instrucción, deteniendo y analizando el procesador para encontrar errores de lógica con facilidad.

---

## 🧮 Coprocesador de Punto Flotante (FPU8087) — Integración Conceptual

El Intel 8080 real **nunca tuvo un coprocesador matemático oficial** (el histórico fue el **8087**, compañero del 8086/8088, lanzado años después). Este fork integra, de forma **conceptual y didáctica**, un coprocesador de punto flotante que **comparte la misma memoria** que la CPU (memoria compartida / *memory-mapped I/O*): no existe un canal de comunicación separado — ambos dispositivos leen y escriben las mismas celdas del arreglo de 64KB de memoria RAM.

La CPU "avisa" al coprocesador escribiendo en una dirección de memoria reservada como **comando**. En ese instante, el coprocesador reacciona: lee los operandos desde la memoria compartida, calcula el resultado, y lo deja en otra sección de esa misma memoria para que la CPU lo lea después con una simple instrucción `LDA`, exactamente igual que leería cualquier otro dato.

### Mapa de memoria compartida (CPU ↔ Coprocesador)

| Dirección | Quién escribe | Función |
|---|---|---|
| `9000H`–`9003H` | CPU | **Operando A** (float32 IEEE-754, little-endian) |
| `9004H`–`9007H` | CPU | **Operando B** (float32 IEEE-754, little-endian) |
| `9008H` | CPU | **Comando** — escribir aquí **dispara** la operación → `01H`=FADD, `02H`=FSUB, `03H`=FMUL, `04H`=FDIV |
| `9009H` | Coprocesador | **Estado** — bit0=READY (resultado listo), bit1=ERROR (ej. división por cero) |
| `900AH`–`900DH` | Coprocesador | **Resultado** (float32 IEEE-754, little-endian) |
| `900EH` | Coprocesador | **Resultado entero truncado** (0–255) — para que el 8080, que solo maneja enteros de 8 bits, lo pueda sumar directamente |
| `900FH` | CPU | **Total entero acumulado** por el programa 8080 (no lo toca el coprocesador) |

### El flujo completo: cómo "saltan" los datos entre CPU y coprocesador

1. La CPU escribe los 4 bytes del Operando A en `9000H`-`9003H` (instrucciones `MVI`+`STA`).
2. La CPU escribe los 4 bytes del Operando B en `9004H`-`9007H`.
3. La CPU escribe el código de operación en `9008H` (ej. `01H` = sumar). **Este escribe es el "salto" clave**: al compartir memoria, el coprocesador detecta esa escritura y toma el control de inmediato — lee los 8 bytes de operandos, calcula, y escribe el resultado en `900AH`-`900EH`.
4. La CPU salta a leer `900EH` (la parte entera del resultado) con `LDA`.
5. La CPU suma ese valor a un total entero que ya llevaba (guardado en `900FH`) usando `ADD`, y guarda el nuevo total de vuelta en `900FH` con `STA`.

Este ejemplo está disponible con un clic usando el botón **"Load FPU Demo"**, que calcula `10.01 + 10.02 = 20.03`, toma la parte entera (`20`) y la suma a un total que ya valía `5`, dando `25` como resultado final. El panel **FPU Coprocessor** del dashboard muestra en tiempo real los operandos, la operación, el resultado (float y entero) y el total acumulado por la CPU. Además, incluye botones de salto rápido (Operando A, Operando B, Comando/Estado, Resultado, Total) que llevan el **Memory View** directamente a cada segmento de memoria compartida, y esa zona (`9000H`-`900FH`) se resalta visualmente en el mapa de memoria.

### Archivos involucrados

*   **`fpu.js`** — Clase `FPU8087`: recibe una **referencia directa** al mismo arreglo de memoria (`Uint8Array`) que usa la CPU. Implementa la lectura/escritura de floats IEEE-754 sobre esa memoria compartida, las 4 operaciones aritméticas, y el manejo de errores.
*   **`cpu.js`** — El método `writeMemory()` (usado por toda instrucción que escribe en RAM) detecta cuándo la CPU escribió en la dirección de comando (`9008H`) y en ese momento invoca `this.fpu.compute()`. No hay un mecanismo de E/S aparte: es la memoria compartida la que dispara la comunicación.
*   **`main.js`** — Función `renderFPU()` que lee los valores directamente de la memoria compartida y los sincroniza con el panel visual; también maneja los botones de salto rápido a cada segmento de memoria.

---

## 🚀 Novedades de la Versión 2.1.0

Esta versión representa un gran salto adelante en la calidad del entorno de desarrollo web:
- **Visualizador de Pila (*Stack View*):** Un componente visual que muestra los valores de 16 bits y bytes individuales que se encuentran en las posiciones de memoria alrededor de la dirección del puntero de pila (`SP`).
- **Banderas Explicadas (*Tooltips*):** Al colocar el puntero del ratón sobre cualquiera de las banderas de estado (`S`, `Z`, `AC`, `P`, `CY`), se muestra un tooltip detallado en español explicando su lógica.
- **Botón Clear Code:** Permite vaciar el editor del ensamblador y sus salidas con un solo clic.
- **Reset Profundo:** Al reiniciar el CPU, se limpia la memoria por completo (rellenando con ceros), se resetean todos los registros, banderas y el visor de memoria se restablece a la dirección inicial `0000`.

---

## 📦 Características Principales

*   **Núcleo de CPU Intel 8080 Completo:**
    *   Emulación fiel del juego de instrucciones.
    *   Gestión precisa de banderas (Sign, Zero, Auxiliary Carry, Parity, Carry).
    *   Soporte completo de la instrucción decimal `DAA`.
*   **Ensamblador Integrado:**
    *   Soporta mnemónicos estándar, etiquetas (labels) y comentarios.
    *   Directivas especiales como `ORG` (Origin) y `DB` (Define Byte).
    *   Soporta alias de registros dobles (`BC`, `DE`, `HL`).
*   **Cuadro de Mando Visual (Dashboard):**
    *   Registros en tiempo real.
    *   Estado del CPU (Ejecutando, En pausa, Halted).
*   **Mapa de Memoria Dinámico:**
    *   Visor de memoria con búsqueda hexadecimal y marcado de color para la posición actual del Program Counter (`PC`).

---

## 💻 Guía de Inicio Rápido

Para utilizar el emulador de forma local en tu máquina o para desarrollo:

1. **Clonar o descargar** este repositorio.
2. Servir el proyecto localmente mediante cualquier servidor web estático. Por ejemplo, si tienes Python instalado, ejecuta en la terminal de la raíz:
   ```bash
   python3 -m http.server 8000
   ```
3. Abre tu navegador e ingresa a `http://localhost:8000`.
4. ¡Comienza a escribir código ensamblador, presiona **Assemble & Load**, y ejecuta tu programa con **Run** o **Step**!

---

## 📝 Documentación Recomendada

*   **`INSTRUCTIONS.md`:** Nuestro libro didáctico interactivo diseñado específicamente para que los estudiantes de alto nivel aprendan el funcionamiento práctico del ensamblador paso a paso, con guías estructuradas de aritmética, ciclos, condicionales y la pila.

---
**Versión del Proyecto:** 2.1.0
**Licencia:** MIT
