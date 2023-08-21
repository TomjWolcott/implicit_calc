const wgsl = () => {
    const indices = cameraState.x.map((_, i) => i);
    let eqEnviroment = getEqEnviroment();

    console.log(eqEnviroment);
    
    return `
        const pi: f32 = 3.1415;
        const border_color: vec4<f32> = vec4(1, 1, 1, 1);
        const border_width: f32 = 1;
        
        const eq_colors: array<vec4<f32>, 8> = array(
            vec4(0.6, 0.3, 0.3, 1),
            vec4(0.3, 0.6, 0.3, 1),
            vec4(0.3, 0.3, 0.6, 1),
            vec4(0.7, 0.5, 0.1, 1),
            vec4(0.1, 0.5, 0.7, 1),
            vec4(0.85, 0.9, 0.9, 1),
            vec4(0.4, 0.8, 0.1, 1),
            vec4(0.5, 0.1, 0.8, 1),
        );

        struct cameraState {
            ${indices.map(i => `x${i}: f32`).join(",")},
            ${indices.map(i => `y${i}: f32`).join(",")},
            ${indices.map(i => `z${i}: f32`).join(",")},
            ${indices.map(i => `p${i}: f32`).join(",")},
            initial_depth: f32,
            increment_depth: f32,
            max_depth: f32,
            opacity_layers: f32,
            zoom: f32,
            width: f32,
            height: f32,
            time: f32,
            flags: u32
        }

        @group(0) @binding(0) var<uniform> camera_state: cameraState;

        struct DepthInfo {
            percent_depth: f32,
            intersected_id: u32
        }

        @group(0) @binding(1) var<storage, read_write> depth_info: array<DepthInfo>;

        @compute @workgroup_size(${rendererInfo.workgroupSize}, ${rendererInfo.workgroupSize}) // arbitrary choice
        fn calculate_depths(@builtin(global_invocation_id) global_id: vec3<u32>) {
            // if (global_id.x >= u32(camera_state.width) || global_id.y >= u32(camera_state.width)) {
            //     return;
            // }

            var d: f32 = camera_state.initial_depth;
            let scale = min(camera_state.width, camera_state.height);
            let norm_pos = vec4(f32(global_id.x) / scale, f32(global_id.y) / scale, 0, 0);
            var centered_pos: vec4<f32>;
            var intersected_id: u32;

            if (camera_state.width > camera_state.height) {
                centered_pos = 2 * norm_pos - vec4(camera_state.width / camera_state.height, 1, 0, 0);
            } else {
                centered_pos = 2 * norm_pos - vec4(1, camera_state.height / camera_state.width, 0, 0);
            }
            
            ${eqEnviroment.implicitEquations.map((_, i) => `var prev_difference${i}: f32 = 0;`).join("\n\n")}

            loop {
                ${indices.map(i => `let t${i}: f32 = 
                    camera_state.zoom * camera_state.x${i} * centered_pos.x + 
                    camera_state.zoom * camera_state.y${i} * centered_pos.y +
                    camera_state.z${i} * d +
                    camera_state.p${i};
                `).join("\n" + "    ".repeat(4))}

                ${eqEnviroment.implicitEquations.map(({ name1, name2 }) => `
                    let ${name1}_test = ${name1}(${indices.map(i => `t${i}`).join(",")});
                    let ${name2}_test = ${name2}(${indices.map(i => `t${i}`).join(",")});
                `).join("\n\n")}

                if d >= camera_state.max_depth { 
                    intersected_id = 0;
                    break;
                }

                ${eqEnviroment.implicitEquations.map(({ test }, i) => `
                    if (${test}) {
                        intersected_id = ${i + 1};
                        break;
                    }
                `).join("\n\n")}

                ${eqEnviroment.implicitEquations.map(({name1, name2}, i) => `
                    prev_difference${i} = sign(${name1}_test - ${name2}_test);
                `).join("\n\n")}

                d += camera_state.increment_depth;
            }

            let global_index = global_id.x + global_id.y * u32(camera_state.width);

            depth_info[global_index] = DepthInfo(
                (d - camera_state.initial_depth) / (camera_state.max_depth - camera_state.initial_depth),
                intersected_id
            );
        }

        @vertex
        fn vertex_main(@location(0) pos: vec2<f32>) -> @builtin(position) vec4<f32> {
            return vec4(pos.x, pos.y, 0, 1);
        }

        @fragment
        fn fragment_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
            let global_index = u32(pos.x) + u32(pos.y) * u32(camera_state.width);
            let my_depth_info = depth_info[global_index];

            if (my_depth_info.intersected_id == 0) {
                return vec4(0, 0, 0, 1);
            } else if ((camera_state.flags) > 0 && is_border(pos.x, pos.y)) {
                return border_color;
            } else {
                return eq_colors[my_depth_info.intersected_id - 1] - 
                    round((cos(1000 * (my_depth_info.percent_depth + (camera_state.time / 400000)))+1) / 2) * vec4(0.05, 0.05, 0.05, 0);
            }
        }

        fn is_border(x: f32, y: f32) -> bool {
            let my_depth_info = get_depth_info(x, y);
            // let depth_dx = get_depth_info(x+1, y).percent_depth - my_depth_info.percent_depth;
            // let depth_dy = get_depth_info(x, y+1).percent_depth - my_depth_info.percent_depth;

            for (var i: f32 = -border_width; i <= border_width; i += 1) {
                for (var j: f32 = -border_width; j <= border_width; j += 1) {
                    let other_depth_info = get_depth_info(x + i, y + j);
                    let id_difference = i32(my_depth_info.intersected_id) - i32(other_depth_info.intersected_id);
                    // let expected_depth = my_depth_info.percent_depth + i * depth_dx + j * depth_dy;
                    let depth_difference = my_depth_info.percent_depth - other_depth_info.percent_depth;

                    if ((id_difference != 0 && depth_difference < 0) || depth_difference < -0.1 * camera_state.zoom) {
                        return true;
                    }
                }
            }

            return false;
        }

        fn get_depth_info(x: f32, y: f32) -> DepthInfo {
            return depth_info[u32(x) + u32(y) * u32(camera_state.width)];
        }

        ${eqEnviroment.implicitEquations.map(({ f1, f2 }) => f1 + "\n" + f2).join("\n\n")}
    `.replaceAll("\n        ", "\n");
};