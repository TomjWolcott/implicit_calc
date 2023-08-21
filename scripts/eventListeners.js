// ------------------------------------------ Mouse info
const mouseInfo = {
    leftButtonDown: false,
    rightButtonDown: false,
    prevPosition: [0, 0],
    position: [0, 0],
    scrolling: 0
}

window.onmousemove = (event) => {
    mouseInfo.position = [event.clientX, event.clientY]
}

const setPrevPostion = () => {
    mouseInfo.prevPosition = mouseInfo.position;
}

window.onmousedown = (event) => {
    if (event.which == 1) 
        mouseInfo.leftButtonDown = true;
    else if (event.which == 3) 
        mouseInfo.rightButtonDown = true;
}

window.onmouseup = (event) => {
    if (event.which == 1) 
        mouseInfo.leftButtonDown = false;
    else if (event.which == 3) 
        mouseInfo.rightButtonDown = false;
}

window.onwheel = (event) => {
    mouseInfo.scrolling = event.deltaY;
}

// ------------------------------------------ Canvas
const canvas = document.querySelector("canvas");

canvas.oncontextmenu = (e) => e.preventDefault();

const moveCamera = () => {
    if (mouseInfo.leftButtonDown || !mouseInfo.rightButtonDown) return;

    const differenceInPosition = math.subtract(mouseInfo.position, mouseInfo.prevPosition);
    const scale = -2 * cameraState.zoom * rendererInfo.scale / Math.min(canvas.width, canvas.height);

    cameraState.position = math.add(
        cameraState.position, 
        math.multiply(scale * differenceInPosition[0], cameraState.x),
        math.multiply(scale * differenceInPosition[1], cameraState.y),
    );

    changeProvidedVarsDefinition();
}

const rotateCamera = () => {
    if (!mouseInfo.leftButtonDown || mouseInfo.rightButtonDown) return;

    const differenceInPosition = math.multiply(
        -2 * cameraState.zoom * rendererInfo.scale / Math.min(canvas.width, canvas.height),
        math.subtract(mouseInfo.position, mouseInfo.prevPosition),
    );

    let xzMatrix = math.matrixFromColumns(cameraState.x, cameraState.z);
    xzMatrix = math.multiply(xzMatrix, math.rotationMatrix(differenceInPosition[0]));
    xzMatrix = math.transpose(xzMatrix);
    cameraState.x = xzMatrix._data[0];
    cameraState.z = xzMatrix._data[1];

    let xyMatrix = math.matrixFromColumns(cameraState.y, cameraState.z);
    xyMatrix = math.multiply(xyMatrix, math.rotationMatrix(differenceInPosition[1]));
    xyMatrix = math.transpose(xyMatrix)
    cameraState.y = xyMatrix._data[0];
    cameraState.z = xyMatrix._data[1];

    cameraState.position = math.multiply(-2, cameraState.z);

    changeProvidedVarsDefinition();
}

const zoomCamera = () => {
    cameraState.zoom *= 1.0001**mouseInfo.scrolling;
    mouseInfo.scrolling = 0;
}

// ------------------------------------------ Interval
var idealFps = 30;

const fpsCounter = document.querySelector(".fpsCounter");
const sampleSize = 40;
let renderLoop;

const startRendering = () => {
    let msDifferences = [];
    let lastTimestamp = performance.now();
    let prevStepCompleted = true;
    let prevCompletionTime = -10000;

    clearInterval(renderLoop);

    renderLoop = setInterval(async () => {
        startTime = performance.now();

        if (!prevStepCompleted && startTime - prevCompletionTime < 5) return;

        prevStepCompleted = false;

        msDifferences.unshift(startTime - lastTimestamp);
        msDifferences = msDifferences.slice(0, sampleSize);

        let averageFps = 1000 / math.mean(...msDifferences);
        fpsCounter.innerHTML = Math.round(averageFps);
    
        lastTimestamp = startTime;

        moveCamera();
        rotateCamera();
        zoomCamera();
        setPrevPostion();

        if (typeof render != "undefined") {
            await render();
        }

        if (averageFps < 5) {
            alert(`\
                Rendering is too laggy!! Edit one of the following values in \
                the console: to ease performance: idealFps, rendererInfo.scale. and \
                then run the function startRendering() \
            `.replaceAll(/[ ]+/g, " "));

            clearInterval(renderLoop);
        }

        prevStepCompleted = true;
        prevCompletionTime = performance.now();
    }, 1000 / idealFps);
};

startRendering();


// ------------------------------------------ toggleSidebar
const sidebar = document.querySelector(".sidebar");
const toggleSidebar = document.querySelector(".toggleSidebar");

toggleSidebar.onclick = () => {
    if (sidebar.style.display == "none") {
        sidebar.style.display = "flex";
        toggleSidebar.innerHTML = "-";
    } else {
        sidebar.style.display = "none";
        toggleSidebar.innerHTML = "+";
    }
}

// ------------------------------------------ sliceDefinition
const providedVarsDefinition = document.querySelector(".sliceDefinition");
const precision = 2;
const roundWithPercision = (x) => {
    let num = (Math.round(10**precision * x) / 10**precision) + "";

    if (!num.includes("-"))
        num = "+" + num;

    if (!num.includes("."))
        num += ".";

    return `\\textcolor{rgb(
        ${127 * (1 + x)}, 
        ${100 * (1 - x)},
        ${127 * (1 - x)}
    )}{${num + "0".repeat(3 + precision - num.length)}}`
};

let lastValidValue = `
    \\vec{c_x}=\\begin{bmatrix} ${cameraState.x.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}, \\;
    \\vec{c_y}=\\begin{bmatrix} ${cameraState.y.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}, \\;
    \\vec{c_z}=\\begin{bmatrix} ${cameraState.z.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}, \\;
    \\vec{c_p}=\\begin{bmatrix} ${cameraState.position.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}\\;
    \\vec{c_p}=\\vec{c_p} - 2\\vec{c_z}
`;

providedVarsDefinition.innerHTML = lastValidValue;

const changeProvidedVarsDefinition = () => {
    lastValidValue = `
        \\vec{c_x}=\\begin{bmatrix} ${cameraState.x.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}, \\;
        \\vec{c_y}=\\begin{bmatrix} ${cameraState.y.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}, \\;
        \\vec{c_z}=\\begin{bmatrix} ${cameraState.z.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}, \\;
        \\vec{c_p}=\\begin{bmatrix} ${cameraState.position.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}
    `;

    providedVarsDefinition.value = lastValidValue;
}

// ------------------------------------------ save/load settings
const eqDivider = "|||||"

window.onunload = (e) => {
    window.localStorage.setItem("eqs", 
        [...document.querySelectorAll(".eqInputs math-field")]
            .map(field => field.value)
            .join(eqDivider)
    );
}

window.onload = (e) => {
    let storedInfo = window.localStorage.getItem("eqs");

    if (storedInfo != null && storedInfo != "")
        storedInfo
            .split(eqDivider)
            .forEach(eq => addEq(eq));
}