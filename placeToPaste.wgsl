
const pi: f32 = 3.1415;
const border_color: vec4<f32> = vec4(1, 1, 1, 1);
const border_width: f32 = 1;
const EPSILON: f32 = 0.001;

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
    height: f32,
    time: f32,
    flags: u32
}

@group(0) @binding(0) var<uniform> camera_state: cameraState;

struct DepthInfo {
    percent_depth: f32,
    intersected_id: u32
    // info: vec2<u32>
    // split up into camera_state.opacity_layers pieces with each piece 
    // having 4 bits for an id of the intersected eq and the rest for the percent depth
}

// example with camera_state.opactiy_layers = 3;
// 21 bits each with one left over, each section has for 4 bits for the id and a depth percent 
// 0001 00001000000000111  0010 00101100001010010  0000 00000000000000000  0

@group(0) @binding(1) var<storage, read_write> depth_info: array<DepthInfo>;

@compute @workgroup_size(16, 16) // arbitrary choice
fn calculate_depths(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let perspective_dist: f32 = 3.0;
    let global_index = global_id.x + global_id.y * u32(camera_state.width);
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

    let pixel_pos0: f32 = 
        camera_state.zoom * camera_state.x0 * centered_pos.x + 
        camera_state.zoom * camera_state.y0 * centered_pos.y +
        camera_state.p0;
    
        let pixel_pos1: f32 = 
        camera_state.zoom * camera_state.x1 * centered_pos.x + 
        camera_state.zoom * camera_state.y1 * centered_pos.y +
        camera_state.p1;
    
        let pixel_pos2: f32 = 
        camera_state.zoom * camera_state.x2 * centered_pos.x + 
        camera_state.zoom * camera_state.y2 * centered_pos.y +
        camera_state.p2;
    
        let pixel_pos3: f32 = 
        camera_state.zoom * camera_state.x3 * centered_pos.x + 
        camera_state.zoom * camera_state.y3 * centered_pos.y +
        camera_state.p3;
    
        let pixel_pos4: f32 = 
        camera_state.zoom * camera_state.x4 * centered_pos.x + 
        camera_state.zoom * camera_state.y4 * centered_pos.y +
        camera_state.p4;
    
        let pixel_pos5: f32 = 
        camera_state.zoom * camera_state.x5 * centered_pos.x + 
        camera_state.zoom * camera_state.y5 * centered_pos.y +
        camera_state.p5;
    

    let ray_length: f32 = pow(pow(
        camera_state.zoom * camera_state.x0 * centered_pos.x + 
        camera_state.zoom * camera_state.y0 * centered_pos.y +
        camera_state.z0 * perspective_dist
    , 2)+pow(
        camera_state.zoom * camera_state.x1 * centered_pos.x + 
        camera_state.zoom * camera_state.y1 * centered_pos.y +
        camera_state.z1 * perspective_dist
    , 2)+pow(
        camera_state.zoom * camera_state.x2 * centered_pos.x + 
        camera_state.zoom * camera_state.y2 * centered_pos.y +
        camera_state.z2 * perspective_dist
    , 2)+pow(
        camera_state.zoom * camera_state.x3 * centered_pos.x + 
        camera_state.zoom * camera_state.y3 * centered_pos.y +
        camera_state.z3 * perspective_dist
    , 2)+pow(
        camera_state.zoom * camera_state.x4 * centered_pos.x + 
        camera_state.zoom * camera_state.y4 * centered_pos.y +
        camera_state.z4 * perspective_dist
    , 2)+pow(
        camera_state.zoom * camera_state.x5 * centered_pos.x + 
        camera_state.zoom * camera_state.y5 * centered_pos.y +
        camera_state.z5 * perspective_dist
    , 2), 0.5);

    let ray0: f32 = (
        camera_state.zoom * camera_state.x0 * centered_pos.x + 
        camera_state.zoom * camera_state.y0 * centered_pos.y +
        camera_state.z0 * perspective_dist
    ) / ray_length;
        let ray1: f32 = (
        camera_state.zoom * camera_state.x1 * centered_pos.x + 
        camera_state.zoom * camera_state.y1 * centered_pos.y +
        camera_state.z1 * perspective_dist
    ) / ray_length;
        let ray2: f32 = (
        camera_state.zoom * camera_state.x2 * centered_pos.x + 
        camera_state.zoom * camera_state.y2 * centered_pos.y +
        camera_state.z2 * perspective_dist
    ) / ray_length;
        let ray3: f32 = (
        camera_state.zoom * camera_state.x3 * centered_pos.x + 
        camera_state.zoom * camera_state.y3 * centered_pos.y +
        camera_state.z3 * perspective_dist
    ) / ray_length;
        let ray4: f32 = (
        camera_state.zoom * camera_state.x4 * centered_pos.x + 
        camera_state.zoom * camera_state.y4 * centered_pos.y +
        camera_state.z4 * perspective_dist
    ) / ray_length;
        let ray5: f32 = (
        camera_state.zoom * camera_state.x5 * centered_pos.x + 
        camera_state.zoom * camera_state.y5 * centered_pos.y +
        camera_state.z5 * perspective_dist
    ) / ray_length;

    var increment_depth: f32 = camera_state.increment_depth;

    // if (depth_info[global_index].percent_depth > 0.99) {
    //     increment_depth *= 500000;
    // }

    // let size = u32(64 / camera_state.opacity_layers);
    // var info: vec2<f32> = vec2(0, 0);
    // var in_a_row: bool = false;
    // var opacity_layers_used: u32 = 0;

    loop {
        let t0: f32 = 
            pixel_pos0 + ray0 * d;
        
        let t1: f32 = 
            pixel_pos1 + ray1 * d;
        
        let t2: f32 = 
            pixel_pos2 + ray2 * d;
        
        let t3: f32 = 
            pixel_pos3 + ray3 * d;
        
        let t4: f32 = 
            pixel_pos4 + ray4 * d;
        
        let t5: f32 = 
            pixel_pos5 + ray5 * d;
        

        if d >= camera_state.max_depth { 
            intersected_id = 0;
            break;
        }

        
            if (_f0(t0,t1,t2,t3,t4,t5)) {
                intersected_id = 1;
                break;
            }
        

        d += increment_depth;
    }

    depth_info[global_index] = DepthInfo(
        (d - camera_state.initial_depth) / (camera_state.max_depth - camera_state.initial_depth),
        intersected_id
    );
}

// fn add_to_info(intersection_id: u32, depth: f32, layer_index: u32, info: ptr<function, vec2<f32>>) {
//     let size = u32(64 / camera_state.opacity_layers);

//     (*info).x = (*info).x | 
//         ((intersection_id & 15) << (layer_index * size)) | 
//         ((u32(depth * pow(2, size - 4)) & 0xfffffff0) << (layer_index * size))
// }

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
        let stripe_freq = 1000;
        let x = 100 * (my_depth_info.percent_depth + (camera_state.time / 400000));

        return eq_colors[my_depth_info.intersected_id - 1] - 
            stripe(x, 1, 0.5) * vec4(0.05, 0.05, 0.05, 0) -  
            stripe(x, 10, 0.5) * vec4(0.15, 0.15, 0.15, 0) -
            (2 * my_depth_info.percent_depth - 1) * vec4(0.2, 0.2, 0.2, 0);
    }
}

fn stripe(x: f32, period: f32, length: f32) -> f32 {
    if (x % period + length > period) {
        return 1.0;
    } else {
        return 0.0;
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


        fn f(x: f32) -> f32 {
            return select(0.01, select(1.01, -100, (abs(x) < 0.6)), (abs(x) < 0.5));
        }
    


            fn _f0(x: f32,y: f32,z: f32,w: f32,_x4: f32,_x5: f32) -> bool {
                return (1 < (f(x)+f(y)+f(z)));
            }
        
    