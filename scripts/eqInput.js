const eqInputs = document.querySelector(".eqInputs");

const addEq = (value = "") => {
    const newEqTag = document.createElement("div");
    newEqTag.className = "flex flex-row my-5 w-full";
    newEqTag.innerHTML = `
        <button 
            class="w-fit hover:bg-slate-100 matchMathField" 
            onclick="this.parentElement.remove(); loadWgsl()"
        ><span> - </span></button>
        <math-field class="ml-5 eqInput" oninput="loadWgsl()">${value}</math-field>
    `;

    eqInputs.appendChild(newEqTag);

    loadWgsl();
};

const subscriptRegexStr = `_\\{[a-zA-Z0-9]+\\}|_[a-zA-Z0-9]+`;
const identifierRegexStr = `[a-zA-Z](${subscriptRegexStr})?`;
const functionDefinitionRegex = new RegExp(`^${identifierRegexStr}\\\\left\\((${identifierRegexStr},)*${identifierRegexStr}\\\\right\\)(?==)`);
const functionDefinitionRegex2 = new RegExp(`^${identifierRegexStr}\\\\left\\((${identifierRegexStr},)+0\\\\right\\)(?==)`);
const functionNameRegex = new RegExp(`^${identifierRegexStr}(?=\\\\left\\()`);
const variableDefinitionRegex = new RegExp(`^${identifierRegexStr}(?==)`);
const comparers = ["Equal", "Less", "LessEqual"];

const preprocess = (eq, functionNames = []) => {
    if (functionNames.some(functionName => eq.includes(functionName))) {
        let lastParenthesisIndex = 0;
        let isFunctionArgsStack = [];
        let insertionPoints = [];
        const parentheses = [
            ...eq.matchAll("\\\\left\\("),
            ...eq.matchAll("\\\\right\\)")
        ];
    
        parentheses.sort((a, b) => a.index - b.index);

        for (const parenthesis of parentheses) {
            if (parenthesis[0].includes("(")) {
                isFunctionArgsStack.push(functionNames.some(functionName => eq
                    .slice(lastParenthesisIndex, parenthesis.index + parenthesis[0].length + 1)
                    .includes(functionName + "\\left(")
                ));
            } else {
                if (isFunctionArgsStack.pop()) {
                    insertionPoints.push(parenthesis.index);
                }

                lastParenthesisIndex = parenthesis.index + 7;
            }
        }

        insertionPoints
            .reverse()
            .forEach(index => {
                eq = eq.slice(0, index) + ",0" + eq.slice(index);
            });
    }

    return eq;
};

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
    const eqs = [...document.querySelectorAll(".eqInputs math-field")];

    const functionNames = eqs
        .map(eqField => preprocess(eqField.value))
        .filter(eq => functionDefinitionRegex.test(eq))
        .map(eq => eq.match(functionNameRegex)[0]);

    const variableNames = eqs
        .map(eqField => preprocess(eqField.value))
        .filter(eq => variableDefinitionRegex.test(eq))
        .map(eq => eq.match(variableDefinitionRegex)[0]);

    const functionDefinitions = {};
    const variableDefinitions = {
        // "c_x": { to: "camera_state.x" },
        // "c_y": { to: "camera_state.y" },
        // "c_z": { to: "camera_state.z" },
        // "c_p": { to: "camera_state.position" }
    };
    const implicitEquations = [];
    const definitions = [];

    for (let i = 0; i < eqs.length; i++) {
        const eq = preprocess(eqs[i].value, functionNames);
        let mathJson = computeEngine.parse(eq).json;

        console.log(eq);

        if (functionDefinitionRegex2.test(eq)) {
            const functionDef = eq.match(functionDefinitionRegex2)[0];
            const functionName = eq.match(functionNameRegex)[0];
            const functionArgs = functionDef
                .replace(functionName, "")
                .replace(/\\left\(|\\right\)|=/g, "")
                .split(",");

            if (functionArgs.pop() != 0) throw new Error(`Whoops, the last arg for ${functionName} wasn't 0 (due to preprocessor)`);

            try {
                let result = mathJsonToWgsl.toWgsl(mathJson[2]);
                console.log(mathJson, result);

                functionDefinitions[functionName] = {
                    eq: result.statement,
                    vars: mathJsonToWgsl.reduceDuplicates(result.vars, functionArgs),
                    components: result.components,
                    functionArgs
                };

                eqs[i].style.outline = "none";
            } catch (error) {
                eqs[i].title = error;
                eqs[i].style.outline = "2px solid red";
                continue;
            }
        } else if (variableDefinitionRegex.test(eq)) {
            const varName = eq.match(variableDefinitionRegex)[0];

            try {
                let result = mathJsonToWgsl.toWgsl(eq.replace(varNameDef, ""));

                functionDefinitions[varName] = {
                    eq: result.statement,
                    vars: result.vars,
                    components: result.components
                };

                eqs[i].style.outline = "none";
            } catch (error) {
                eqs[i].title = error;
                eqs[i].style.outline = "2px solid red";
                continue;
            }
        } else {
            const compareType = mathJson[0];

            if (comparers.indexOf(compareType) == -1) {
                eqs[i].style.outline = "2px solid red";
                continue;
            }

            try {
                let result1 = mathJsonToWgsl.toWgsl(mathJson[1]);
                let result2 = mathJsonToWgsl.toWgsl(mathJson[2]);

                implicitEquations.push({
                    eq1: result1.statement,
                    eq2: result2.statement,
                    vars: mathJsonToWgsl.reduceDuplicates(result1.vars, result2.vars),
                    compareType
                });

                eqs[i].style.outline = "none";
            } catch (error) {
                eqs[i].title = error;
                eqs[i].style.outline = "2px solid red";
                continue;
            };
        }
    }

    for (const functionName in functionDefinitions) {
        const {
            functionArgs,
            eq
        } = functionDefinitions[functionName];

        const fn = `fn ${functionName}(${functionArgs.map(arg => `${arg}: f32`).join(",")}) -> f32 {
            return ${eq};
        }`;

        definitions.push({
            fn,
            name: functionName
        });
    }

    for (const varName in variableDefinitions) {

    }

    for (let i = 0; i < implicitEquations.length; i++) {
        let {
            vars, eq1, eq2, compareType
        } = implicitEquations[i];

        vars = cameraState.x.map((_, i) => ["x", "y", "z", "w"][i] || `_x${i}`);
        // vars = cameraState.x.map((_, i) => vars[i] || `_x${i}`);
        // vars.sort(varsSort);

        const name1 = `f${2*i}`;
        const name2 = `f${2*i + 1}`;

        const f1 = `fn ${name1}(${vars.map(vari => `${vari}: f32`).join(", ")}) -> f32 {
            return ${eq1};
        }`;
        
        const f2 = `fn ${name2}(${vars.map(vari => `${vari}: f32`).join(", ")}) -> f32 {
            return ${eq2};
        }`;

        console.log(vars, name1, name2, f1, f2);

        implicitEquations[i] = { 
            f1, name1, 
            f2, name2,
            test: (compareType == "Equal") ? `(
                (${name1}_test == ${name2}_test) || 
                (${name1}_test - ${name2}_test) * prev_difference${i} < 0
            )` : `${name1}_test < ${name2}_test`
        };
    }

    console.log(
        "fn names", functionNames, 
        "\nvar names", variableNames, 
        "\nfn defs", functionDefinitions, 
        "\nvar defs", variableDefinitions, 
        "\nimplicit eqs", implicitEquations, 
        "\ndefs", definitions
    );

    return { 
        definitions,
        implicitEquations 
    };
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
                vars: [mathJson],
                components: []
            };
        } else if (typeof mathJson == "number") {
            return {
                statement: mathJson + '',
                vars: [],
                components: []
            };
        }
        
        if (mathJson[0] == "Error")
            throw new Error(`Parse error: [${[...mathJson].slice(1).join(", ")}]`)
        // else if (!(mathJson[0] in this))
        //     throw new Error(`${mathJson[0]} is not provided for conversion into wgsl`)

        let wgsl = (mathJson[0] in this) ? this[mathJson[0]](
            ...[...mathJson]
                .slice(1)
                .map(eqPart => this.toWgsl(eqPart))
        ) : this["Function"](
            mathJson[0],
            ...[...mathJson]
                .slice(1)
                .map(eqPart => this.toWgsl(eqPart))
        )

        wgsl.components.push(wgsl.statement);

        return wgsl;
    },
    reduceDuplicates(...arrays) {
        return arrays.reduce((acc, array) => 
            acc.concat(array.filter(element => acc.indexOf(element) == -1))
        , []);
    },
    implementBasicOperation(operation, symbol, mapOperands = (...operands) => operands) {
        this[operation] = (...operands) => ({
            statement: `(${
                mapOperands(...operands)
                    .map(operand => operand.statement)
                    .join(symbol)
            })`,
            vars: this.reduceDuplicates(...operands.map(op => op.vars)),
            components: this.reduceDuplicates(...operands.map(op => op.components)),
        })
    },
    // Sum(eq, description) {

    // },
    implementFunctionOperation(operation, functionName, mapOperands = (...operands) => operands) {
        this[operation] = (...operands) => ({
            statement: `${functionName}(${
                mapOperands(...operands)
                    .map(operand => operand.statement)
                    .join(",")
            })`,
            vars: this.reduceDuplicates(...operands.map(op => op.vars)),
            components: this.reduceDuplicates(...operands.map(op => op.components)),
        })
    },
    Function(functionName, ...args) {
        return {
            statement: `${functionName}(${args.slice(0, args.length - 1).map(arg => arg.statement).join(",")})`,
            vars: this.reduceDuplicates(...args.map(arg => arg.vars)),
            components: this.reduceDuplicates(...args.map(arg => arg.components)),
        }
    }
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