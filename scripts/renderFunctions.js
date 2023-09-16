rendererInfo = { 
    loaded: false,
    scale: 3/4
};

let depthInfoData;

const prepareRenderer = async () => {
    const canvas = document.querySelector("canvas");

    if (!navigator.gpu) 
        throw new Error("WebGPU not available on this browser");
    
    const adapter = await navigator.gpu.requestAdapter();
    
    if (!adapter)
        throw new Error("No appropriate GPUAdapeter found");
    
    const device = await adapter.requestDevice();
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

    const vertices = new Float32Array([
    //    X     Y
        -1.0, -1.0,
         1.0, -1.0,
         1.0,  1.0,

        -1.0, -1.0,
        -1.0,  1.0,
         1.0,  1.0,
    ]);

    const vertexBuffer = device.createBuffer({
        label: "vertices",
        size: vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    await device.queue.writeBuffer(vertexBuffer, 0, vertices);

    const vertexBufferLayout = {
        arrayStride: 8,
        attributes: [{
            format: "float32x2",
            offset: 0,
            shaderLocation: 0, // Position, see vertex shader
        }],
    };

    const bindGroupLayout = device.createBindGroupLayout({
        label: "Full pipeline layout",
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
            buffer: { type: "uniform" }
        }, {
            binding: 1,
            visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
            buffer: { type: "storage" }
        }]
    });

    depthInfoData = new Float32Array(Array(2 * canvas.width * canvas.height).fill(0));

    rendererInfo = {
        ...rendererInfo,
        loaded: true,
        canvas,
        device,
        canvasFormat,
        vertexBufferLayout,
        vertexBuffer,
        bindGroupLayout,
        workgroupSize: 16,
    };

    loadWgsl();
}

const loadWgsl = () => {
    const {
        device, canvasFormat, vertexBufferLayout, bindGroupLayout
    } = rendererInfo;

    const shaderModule = device.createShaderModule({
        label: "shader",
        code: wgsl()
    });

    rendererInfo.renderPipeline = device.createRenderPipeline({
        label: "render pipeline",
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        }),
        vertex: {
          module: shaderModule,
          entryPoint: "vertex_main",
          buffers: [vertexBufferLayout]
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fragment_main",
          targets: [{
            format: canvasFormat
          }]
        }
    });

    rendererInfo.computePipeline = device.createComputePipeline({
        label: "compute pipeline",
        layout: device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        }),
        compute: {
            module: shaderModule,
            entryPoint: "calculate_depths"
        }
    })
}

const render = async () => {
    const {
        loaded, scale, canvas, device,
        canvasFormat, vertexBuffer, workgroupSize,
        bindGroupLayout, renderPipeline, computePipeline
    } = rendererInfo;

    if (!loaded) return;

    let canvasBoundingBox = canvas.getBoundingClientRect();

    if (
        canvas.width != scale * canvasBoundingBox.width || 
        canvas.height != scale * canvasBoundingBox.height
    ) depthInfoData = new Float32Array(Array(Math.ceil(
        2 * (scale**2) * canvasBoundingBox.width * canvasBoundingBox.height
    )).fill(0));

    canvas.width = scale * canvasBoundingBox.width;
    canvas.height = scale * canvasBoundingBox.height;

    const context = canvas.getContext("webgpu");
    
    context.configure({
      device: device,
      format: canvasFormat,
    });

    const cameraStateData = new Float32Array([
        ...cameraState.x, ...cameraState.y,
        ...cameraState.z, ...cameraState.position,
        cameraState.initialDepth, cameraState.incrementDepth,
        cameraState.maxDepth, cameraState.opacityLayers,
        cameraState.zoom, canvas.width, canvas.height, 
        Date.now() % (2**31), cameraState.flags, cameraState.opacity,
        0, 0, 0, 0, 0, 0, 0 // A bunch of zeros for padding the buffer
    ]);

    const cameraStateBuffer = device.createBuffer({
        label: "camera state buffer",
        size: cameraStateData.byteLength,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    await device.queue.writeBuffer(cameraStateBuffer, 0, cameraStateData);

    const depthInfoBuffer = device.createBuffer({
        label: "depth info buffer",
        size: depthInfoData.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    await device.queue.writeBuffer(depthInfoBuffer, 0, depthInfoData);

    const bindGroup = device.createBindGroup({
        label: "Full bind group",
        layout: bindGroupLayout,
        entries: [{
            binding: 0,
            resource: { buffer: cameraStateBuffer }
        }, {
            binding: 1,
            resource: { buffer: depthInfoBuffer }
        }]
    })
    
    const computeEncoder = device.createCommandEncoder();
    const computePass = computeEncoder.beginComputePass();

    computePass.setBindGroup(0, bindGroup);
    computePass.setPipeline(computePipeline);
    computePass.dispatchWorkgroups(
        Math.ceil(canvas.width / workgroupSize), 
        Math.ceil(canvas.height / workgroupSize)
    );

    computePass.end();
    
    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
        colorAttachments: [{
           view: context.getCurrentTexture().createView(),
           loadOp: "clear",
           storeOp: "store",
           clearValue: { r: 1.0, g: 0.9, b: 0.1, a: 1.0 }
        }]
    });

    renderPass.setPipeline(renderPipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);

    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6);
    
    renderPass.end();
    
    await device.queue.submit([computeEncoder.finish(), encoder.finish()]);

}

prepareRenderer().then(() => render());