const eqInputs = document.querySelector(".eqInputs");

const addEq = (value = "") => {
    const newEqTag = document.createElement("div");
    newEqTag.className = "flex flex-row my-5 w-full";
    newEqTag.innerHTML = `
        <button class="w-fit hover:bg-slate-100 matchMathField" onclick="this.parentElement.remove(); loadWgsl()"><span> - </span></button>
        <math-field class="ml-5 eqInput" oninput="loadWgsl()">${value}</math-field>
    `;

    eqInputs.appendChild(newEqTag);

    loadWgsl();
};

const eqEnviroment = {
    implicitEquations: [],
    definitions: []
};

const functionDefinitionRegex = /^[a-zA-Z](_\{[a-zA-Z0-9]+\})?\\left\(([a-zA-Z](_\{[a-zA-Z0-9]+\})?(,)?)+\\right\)=/;
const variableDefinitionRegex = /^[a-zA-Z](_\{[a-zA-Z0-9]+\})?=/;
const variableRegex = /[a-zA-Z](_\{[a-zA-Z0-9]+\})?/g;
const comparers = ["Equal", "Less", "LessEqual"];

const preprocess = (value) => value;

const computeEngine = new ComputeEngine.ComputeEngine();
computeEngine.defineFunction("m", {
    complexity: 2800,
    hold: "none",
    signature: {
        domain: "RealNumber",
        evaluate: x => x
    }
});

//$$ \left(\sqrt{x^2+y^2}-0.4\right)^2+\left(z+0.2\tan^{-1}\left(\frac{y}{x}\right)\right)^2=0.05^2 $$

const getEqEnviroment = () => {
    let implicitEquations = [];
    const eqs = document.querySelectorAll(".eqInputs math-field");

    const variableDefinitions = {};
    const functionDefinitions = {};

    for (let i = 0; i < eqs.length; i++) {
        const eq = preprocess(eqs[i].value);

        if (functionDefinitionRegex.test(eq)) {

        } else if (variableDefinitionRegex.test(eq)) {

        } else {
            let mathJson = computeEngine.parse(eq).json;
            const compareType = mathJson[0];

            console.log(eq, mathJson);

            if (comparers.indexOf(compareType) == -1) {
                eqs[i].style.outline = "2px solid red";
                continue;
            }

            let statement1, statement2, vars;

            try {
                let result1 = mathJsonToWgsl.toWgsl(mathJson[1]);
                let result2 = mathJsonToWgsl.toWgsl(mathJson[2]);

                vars = mathJsonToWgsl.reduceVars([result1, result2]);

                statement1 = result1.statement;
                statement2 = result2.statement;

                eqs[i].style.outline = "none";
            } catch (e) {
                eqs[i].style.outline = "2px solid red";
                continue;
            };
            
            vars = cameraState.x.map((_, i) => vars[i] || `_x${i}`);
            vars.sort(varsSort);

            const name1 = `f${2*i}`;
            const name2 = `f${2*i + 1}`;

            const f1 = `fn ${name1}(${vars.map(vari => `${vari}: f32`).join(", ")}) -> f32 {
                return ${statement1};
            }`;
            
            const f2 = `fn ${name2}(${vars.map(vari => `${vari}: f32`).join(", ")}) -> f32 {
                return ${statement2};
            }`;

            console.log(vars, name1, name2, f1, f2);

            implicitEquations.push({ 
                f1, name1, 
                f2, name2,
                test: (compareType == "Equal") ? `((${name1}_test == ${name2}_test) || (${name1}_test - ${name2}_test) * prev_difference${i} < 0)` 
                    : `${name1}_test < ${name2}_test`
            });
        }
    }

    return { implicitEquations };
}

// Thanks ChatGPT, I did not feel like writing this one
const varsSort = (var1, var2) => {
    const sequence = ['x', 'y', 'z', 'w'];

    // Special case for "_x1", "_x2", ... 
    if (var1.startsWith('_x') && var2.startsWith('_x')) {
        return parseInt(var1.slice(2), 10) - parseInt(var2.slice(2), 10);
    }
    if (var1.startsWith('_x')) return 1;
    if (var2.startsWith('_x')) return -1;

    // Extract base and index for a string
    function extractParts(str) {
        const match = str.match(/^([a-z])_?({?(\d+)}?)?$/);
        if (!match) return { base: str, index: 0 }; // If string doesn't match format

        return {
            base: match[1],
            index: match[3] ? parseInt(match[3], 10) : 0
        };
    }

    const var1Parts = extractParts(var1);
    const var2Parts = extractParts(var2);

    // First sort by base sequence
    if (var1Parts.base !== var2Parts.base) {
        const var1BaseIndex = sequence.indexOf(var1Parts.base);
        const var2BaseIndex = sequence.indexOf(var2Parts.base);

        // If var1's base is not in sequence, but var2's is, var2 comes first
        if (var1BaseIndex === -1 && var2BaseIndex !== -1) return 1;

        // If var2's base is not in sequence, but var1's is, var1 comes first
        if (var1BaseIndex !== -1 && var2BaseIndex === -1) return -1;

        // If neither are in the sequence, sort alphabetically
        if (var1BaseIndex === -1 && var2BaseIndex === -1) return var1Parts.base.localeCompare(var2Parts.base);

        // If both are in the sequence, use sequence order
        return var1BaseIndex - var2BaseIndex;
    }

    // If the bases are the same, sort by index
    return var1Parts.index - var2Parts.index;
}

const mathJsonToWgsl = {
    toWgsl(mathJson) {
        if (typeof mathJson == "string") {
            return {
                statement: mathJson,
                vars: [mathJson]
            };
        } else if (typeof mathJson == "number") {
            return {
                statement: mathJson + '',
                vars: []
            };
        }
        
        if (mathJson[0] == "Error")
            throw new Error(`Parse error: [${[...mathJson].slice(1).join(", ")}]`)
        else if (!(mathJson[0] in this))
            throw new Error(`${mathJson[0]} is not provided for conversion into wgsl`)

        return this[mathJson[0]](
            ...[...mathJson]
                .slice(1)
                .map(eqPart => this.toWgsl(eqPart))
        );
    },
    reduceVars(operands) {
        return operands.reduce((acc, operand) => 
            acc.concat(operand.vars.filter(vari => acc.indexOf(vari) == -1))
        , []);
    },
    implementBasicOperation(operation, symbol, mapOperands = (...operands) => operands) {
        this[operation] = (...operands) => ({
            statement: `(${
                mapOperands(...operands)
                    .map(operand => operand.statement)
                    .join(symbol)
            })`,
            vars: this.reduceVars(operands)
        })
    },
    implementFunctionOperation(operation, functionName, mapOperands = (...operands) => operands) {
        this[operation] = (...operands) => ({
            statement: `${functionName}(${
                mapOperands(...operands)
                    .map(operand => operand.statement)
                    .join(",")
            })`,
            vars: this.reduceVars(operands)
        })
    },
};

[
    ["Add", "+"],
    ["Subtract", "-"],
    ["Multiply", "*"],
    ["Divide", "/"],
    ["Rational", "/", (op1, op2) => [op1, {statement: `f32(${op2.statement})`}]],
    ["m", "%"],
    ["Negate", "*", (op) => {console.log("negate", op); return [{statement: "-1.0"}, op];}]
].forEach(args => mathJsonToWgsl.implementBasicOperation(...args));

[
    ["Power", "pow"],
    ["Exp", "pow", (op) => [{statement: "2.718281828"}, op]],
    ["Root", "pow", (op, op2) => [op, {statement: `(1.0/${op2.statement})`}]],
    ["Square", "pow", (op) => [op, {statement: "2.0"}]],
    ["Cos", "cos"],
    ["Sin", "sin"],
    ["Tan", "tan"],
    ["Arccos", "acos"],
    ["Arcsin", "asin"],
    ["Arctan", "atan"],
    ["Sqrt", "pow", (op) => [op, {statement: "0.5"}]],
    ["Abs", "abs"]
].forEach(args => mathJsonToWgsl.implementFunctionOperation(...args));