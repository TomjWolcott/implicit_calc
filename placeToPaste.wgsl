
const pi: f32 = 3.1415;
const border_color: vec4<f32> = vec4(1, 1, 1, 1);
const border_width: f32 = 5;

const eq_colors: array<vec4<f32>, 5> = array(
    vec4(0.6, 0.3, 0.3, 1),
    vec4(0.3, 0.6, 0.3, 1),
    vec4(0.3, 0.3, 0.6, 1),
    vec4(0.7, 0.5, 0.1, 1),
    vec4(0.1, 0.5, 0.7, 1),
);

struct cameraState {
    x0: f32,x1: f32,x2: f32,x3: f32,x4: f32,x5: f32,
    y0: f32,y1: f32,y2: f32,y3: f32,y4: f32,y5: f32,
    z0: f32,z1: f32,z2: f32,z3: f32,z4: f32,z5: f32,
    p0: f32,p1: f32,p2: f32,p3: f32,p4: f32,p5: f32,
    initial_depth: f32,
    increment_depth: f32,
    max_depth: f32,
    opacity_layers: f32,
    zoom: f32,
    width: f32,
    height: f32
}

@group(0) @binding(0) var<uniform> camera_state: cameraState;

struct DepthInfo {
    percent_depth: f32,
    intersected_id: u32
}

@group(0) @binding(1) var<storage, read_write> depth_info: array<DepthInfo>;

@compute @workgroup_size(1, 1) // arbitrary choice
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
    
    var prev_difference0: f32 = 0;

    loop {
        let t0: f32 = 
            camera_state.zoom * camera_state.x0 * centered_pos.x + 
            camera_state.zoom * camera_state.y0 * centered_pos.y +
            camera_state.z0 * d +
            camera_state.p0;
        
        let t1: f32 = 
            camera_state.zoom * camera_state.x1 * centered_pos.x + 
            camera_state.zoom * camera_state.y1 * centered_pos.y +
            camera_state.z1 * d +
            camera_state.p1;
        
        let t2: f32 = 
            camera_state.zoom * camera_state.x2 * centered_pos.x + 
            camera_state.zoom * camera_state.y2 * centered_pos.y +
            camera_state.z2 * d +
            camera_state.p2;
        
        let t3: f32 = 
            camera_state.zoom * camera_state.x3 * centered_pos.x + 
            camera_state.zoom * camera_state.y3 * centered_pos.y +
            camera_state.z3 * d +
            camera_state.p3;
        
        let t4: f32 = 
            camera_state.zoom * camera_state.x4 * centered_pos.x + 
            camera_state.zoom * camera_state.y4 * centered_pos.y +
            camera_state.z4 * d +
            camera_state.p4;
        
        let t5: f32 = 
            camera_state.zoom * camera_state.x5 * centered_pos.x + 
            camera_state.zoom * camera_state.y5 * centered_pos.y +
            camera_state.z5 * d +
            camera_state.p5;
        

        
            let f0_test = f0(t0,t1,t2,t3,t4,t5);
            let f1_test = f1(t0,t1,t2,t3,t4,t5);
        

        if d >= camera_state.max_depth { 
            intersected_id = 0;
            break;
        }

        
            if (f0_test < f1_test) {
                intersected_id = 1;
                break;
            }
        

        
            prev_difference0 = sign(f0_test - f1_test);
        

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
fn fragment_main(@builtin(position) pos: vec4<f32>, @builtin(sample_index) sample_index: u32) -> @location(0) vec4<f32> {
    let x: f32 = f32(sample_index) % camera_state.width;
    let y: f32 = floor(f32(sample_index) / camera_state.width);
    let my_depth_info = depth_info[sample_index];

    if (my_depth_info.intersected_id == 0) {
        return vec4(0, 0, 0, 1);
    } else {
        return vec4(1, 1, 1, 1);
    }
    
    // if (is_border(my_depth_info.intersected_id, x, y)) {
    //     return border_color;
    // } else {
    //     return eq_colors[my_depth_info.intersected_id - 1] - 
    //         round(2 * cos(30 * my_depth_info.percent_depth)) * vec4(0.05, 0.05, 0.05, 0);
    // }
}

fn is_border(my_id: u32, x: f32, y: f32) -> bool {
    for (var i: f32 = -border_width; i <= border_width; i += 1) {
        for (var j: f32 = -border_width; j <= border_width; j += 1) {
            let index = u32((x + i) + (y + j) * camera_state.width);

            if (depth_info[index].intersected_id != my_id) {
                return true;
            }
        }
    }

    return false;
}

fn f0(_x0: f32, _x1: f32, _x2: f32, _x3: f32, _x4: f32, _x5: f32) -> f32 {
        return 1;
    }
fn f1(_x0: f32, _x1: f32, _x2: f32, _x3: f32, _x4: f32, _x5: f32) -> f32 {
        return 2;
    }
    