const rotate = (angle, [v1, v2]) => {
    let v1v2Matrix = math.matrixFromColumns(v1, v2);
    v1v2Matrix = math.multiply(v1v2Matrix, math.rotationMatrix(angle));
    v1v2Matrix = math.transpose(v1v2Matrix);

    v1 = v1v2Matrix._data[0];
    v2 = v1v2Matrix._data[1];

    v1 = math.multiply(v1, 1 / math.norm(v1));
    v2 = math.multiply(v2, 1 / math.norm(v2));

    return [v1, v2];
}

// ------------------------------------------ Mouse info
const mouseInfo = {
    leftButtonDown: false,
    rightButtonDown: false,
    prevPosition: [0, 0],
    position: [0, 0],
    scrolling: 0,
    target: null
}

window.onmousemove = (event) => {
    rotateRotator();
    mouseInfo.position = [event.clientX, event.clientY];
}

const setPrevPostion = () => {
    mouseInfo.prevPosition = mouseInfo.position;
}

window.onmousedown = (event) => {
    mouseInfo.target = event.target.id;

    if (event.which == 1) 
        mouseInfo.leftButtonDown = true;
    else if (event.which == 3) 
        mouseInfo.rightButtonDown = true;
}

window.onmouseup = (event) => {
    mouseInfo.target = null;

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
    if (mouseInfo.leftButtonDown || !mouseInfo.rightButtonDown || mouseInfo.target != "canvas") return;

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
    if (!mouseInfo.leftButtonDown || mouseInfo.rightButtonDown || mouseInfo.target != "canvas") return;

    const differenceInPosition = math.multiply(
        -2 * cameraState.zoom * rendererInfo.scale / Math.min(canvas.width, canvas.height),
        math.subtract(mouseInfo.position, mouseInfo.prevPosition),
    );

    [cameraState.x, cameraState.z] = rotate(differenceInPosition[0], [cameraState.x, cameraState.z]);
    [cameraState.y, cameraState.z] = rotate(differenceInPosition[1], [cameraState.y, cameraState.z]);

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

const pausedOverlay = document.querySelector(".pausedOverlay");
let renderLoop;

const startRendering = () => {
    let msDifferences = [];
    let lastTimestamp = performance.now();
    let prevStepCompleted = true;
    let prevCompletionTime = -10000;
    if (typeof rendererInfo != "undefined") rendererInfo.scale = 1;

    clearInterval(renderLoop);

    pausedOverlay.style.display = "none";

    renderLoop = setInterval(async () => {
        startTime = performance.now();

        if (!prevStepCompleted && startTime - prevCompletionTime < 5) {
            rendererInfo.scale *= 0.99;
            return;
        }

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

        if (averageFps < idealFps) {
            rendererInfo.scale *= 0.995;
        } else if (averageFps > 1.2 * idealFps) {
            rendererInfo.scale *= 1.005;
        }

        // if (averageFps < Math.min(5, idealFps / 3)) {
        //     alert(`\
        //         Rendering is too laggy!! Edit one of the following values in \
        //         the console: to ease performance: idealFps, rendererInfo.scale. and \
        //         then run the function startRendering() \
        //     `.replaceAll(/[ ]+/g, " "));

        //     stopRendering();
        // }

        prevStepCompleted = true;
        prevCompletionTime = performance.now();
    }, 1000 / idealFps);
};

const stopRendering = () => {
    pausedOverlay.style.display = "flex";
    clearInterval(renderLoop);
    renderLoop = null;
}

startRendering();

window.onunload = () => stopRendering();

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
    \\vec{c_p}=\\begin{bmatrix} ${cameraState.position.map(roundWithPercision).join(" \\\\ ")} \\end{bmatrix}
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

// ------------------------------------------ Edit slice
const rotator = document.querySelector("#rotator");
const axis1 = document.querySelector(".axis1");
const axis2 = document.querySelector(".axis2");
rotator.angle = 0;

axis1.innerHTML = cameraState.x.map((_, i) => `<option value="${i}">x${i}</option>`).join("");
axis2.innerHTML = cameraState.x.map((_, i) => `<option value="${i}">x${i}</option>`).join("");

const getComponentVector = (index) => {
    return (index == 0) ? cameraState.x :
        (index == 1) ? cameraState.y :
        (index == 2) ? cameraState.z :
        cameraState.rest[index - 3];
}

const setComponentVector = (index, vector) => {
    if (index == 0) 
        cameraState.x = vector;
    else if (index == 1) 
        cameraState.y = vector;
    else if (index == 2)
        cameraState.z = vector;
    else
        cameraState.rest[index - 3] = vector;
}

const rotateRotator = () => {
    let rotatorBox = rotator.getBoundingClientRect();
    let center = [
        rotatorBox.left  + rotatorBox.width  / 2, 
        rotatorBox.top + rotatorBox.height / 2
    ];

    if (mouseInfo.leftButtonDown && mouseInfo.target.includes("rotator")) {
        const r1 = math.subtract(mouseInfo.position, center);
        const r2 = math.subtract(mouseInfo.prevPosition, center);
        let angle = (Math.atan2(r1[1], r1[0]) - Math.atan2(r2[1], r2[0])) / 1.5;
        let v1 = getComponentVector(parseInt(axis1.value));
        let v2 = getComponentVector(parseInt(axis2.value));

        let [v3, v4] = rotate(angle, [v1, v2]);

        setComponentVector(parseInt(axis1.value), v3);
        setComponentVector(parseInt(axis2.value), v4);

        rotator.angle += angle;
        rotator.style.transform = `rotate(${rotator.angle}rad)`;
        cameraState.position = math.multiply(-2, cameraState.z);

        changeProvidedVarsDefinition();
    } else {
        rotator.angle = 0;
        rotator.style.transform = "rotate(0rad)"
    }
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