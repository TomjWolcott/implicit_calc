const cameraStateFlags = {
    border: 1,
}

const getInitCameraState = (
    dimensions = 3,
    x = [-1, 0, 0],
    y = [0, 1, 0],
    z = [0, 0, 1]
) => {
    for (let i = 0; i < dimensions; i++) {
        x[i] = x[i] || 0;
        y[i] = y[i] || 0;
        z[i] = z[i] || 0;
    }

    console.log("Vectors:", x, y, z);
    console.log("dot:", math.dot(x, y), math.dot(x, z), math.dot(y, z))

    return {
        dimensions,

        x,
        y,
        z,
        position: z.map(x => -2 * x),

        initialDepth: 0,
        incrementDepth: 0.001,
        maxDepth: 4,
        opacityLayers: 1,
        zoom: 1,
        flags: cameraStateFlags.border
    }
}

const gramSchmidt = (...vectors) => {
    for (let i = 0; i < vectors.length; i++) {
        for (let j = 0; j < Math.max(...vectors.map(v => v.length)); j++) {
            vectors[i][j] = vectors[i][j] || 0;
        }
    }

    for (let i = 0; i < vectors.length; i++) {
        vectors[i] = math.multiply(vectors[i], 1 / math.norm(vectors[i]));
    }

    for (let i = 0; i < vectors.length; i++) {
        for (let j = 0; j < i; j++) {
            vectors[i] = math.subtract(
                vectors[i], 
                math.multiply(
                    vectors[j], 
                    math.dot(vectors[i], vectors[j]) / math.dot(vectors[j], vectors[j])
                )
            );
        }
    }

    return vectors;
}

// const cameraState = getInitCameraState(4, ...gramSchmidt([1, 8, 3, 4], [4, 2, 3, 4], [1, 0, -1, 4]));
// const cameraState = getInitCameraState(6, ...gramSchmidt([1, 1, 3, 4, 2, 6], [4, 2, 3, 4, 0, 1], [1, 8, -1, 4, 1, 0]));
const cameraState = getInitCameraState(6);
console.log(cameraState)