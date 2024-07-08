import { Vector } from "../app-class.js";

// Returns the inverse of matrix `M`.
function matrix_invert(M){
    // I use Guassian Elimination to calculate the inverse:
    // (1) 'augment' the matrix (left) by the identity (on the right)
    // (2) Turn the matrix on the left into the identity by elemetry row ops
    // (3) The matrix on the right is the inverse (was the identity matrix)
    // There are 3 elemtary row ops: (I combine b and c in my code)
    // (a) Swap 2 rows
    // (b) Multiply a row by a scalar
    // (c) Add 2 rows
    
    //if the matrix isn't square: exit (error)
    if(M.length !== M[0].length){return;}
    
    //create the identity matrix (I), and a copy (C) of the original
    var i=0, ii=0, j=0, dim=M.length, e=0, t=0;
    var I = [], C = [];
    for(i=0; i<dim; i+=1){
        // Create the row
        I[I.length]=[];
        C[C.length]=[];
        for(j=0; j<dim; j+=1){
            
            //if we're on the diagonal, put a 1 (for identity)
            if(i==j){ I[i][j] = 1; }
            else{ I[i][j] = 0; }
            
            // Also, make the copy of the original
            C[i][j] = M[i][j];
        }
    }
    
    // Perform elementary row operations
    for(i=0; i<dim; i+=1){
        // get the element e on the diagonal
        e = C[i][i];
        
        // if we have a 0 on the diagonal (we'll need to swap with a lower row)
        if(e==0){
            //look through every row below the i'th row
            for(ii=i+1; ii<dim; ii+=1){
                //if the ii'th row has a non-0 in the i'th col
                if(C[ii][i] != 0){
                    //it would make the diagonal have a non-0 so swap it
                    for(j=0; j<dim; j++){
                        e = C[i][j];       //temp store i'th row
                        C[i][j] = C[ii][j];//replace i'th row by ii'th
                        C[ii][j] = e;      //repace ii'th by temp
                        e = I[i][j];       //temp store i'th row
                        I[i][j] = I[ii][j];//replace i'th row by ii'th
                        I[ii][j] = e;      //repace ii'th by temp
                    }
                    //don't bother checking other rows since we've swapped
                    break;
                }
            }
            //get the new diagonal
            e = C[i][i];
            //if it's still 0, not invertable (error)
            if(e==0){return}
        }
        
        // Scale this row down by e (so we have a 1 on the diagonal)
        for(j=0; j<dim; j++){
            C[i][j] = C[i][j]/e; //apply to original matrix
            I[i][j] = I[i][j]/e; //apply to identity
        }
        
        // Subtract this row (scaled appropriately for each row) from ALL of
        // the other rows so that there will be 0's in this column in the
        // rows above and below this one
        for(ii=0; ii<dim; ii++){
            // Only apply to other rows (we want a 1 on the diagonal)
            if(ii==i){continue;}
            
            // We want to change this element to 0
            e = C[ii][i];
            
            // Subtract (the row above(or below) scaled by e) from (the
            // current row) but start at the i'th column and assume all the
            // stuff left of diagonal is 0 (which it should be if we made this
            // algorithm correctly)
            for(j=0; j<dim; j++){
                C[ii][j] -= e*C[i][j]; //apply to original matrix
                I[ii][j] -= e*I[i][j]; //apply to identity
            }
        }
    }
    
    //we've done all operations, C should be the identity
    //matrix I should be the inverse:
    return I;
}


function mmultiply(a,b) {
	return a.map(function(x,i) {
		return transpose(b).map(function(y,k) {
			return dotproduct(x, y)
		});
	});
}

function dotproduct(a,b) {
	return a.map(function(x,i) {
		return a[i] * b[i];
	}).reduce(function(m,n) { return m + n; });
}

function transpose(a) {
	return a[0].map(function(x,i) {
		return a.map(function(y,k) {
			return y[i];
		})
	});
}


class CubicBezier {
    constructor(p1, c1, c2, p2) {
        this.p1 = p1;
        this.p2 = p2;
        this.c1 = c1;
        this.c2 = c2;
    }
}
export function fit_cubic(points) {
    let M = [
        [-1, 3, -3, 1],
        [3, -6, 3, 0],
        [-3, 3, 0, 0],
        [1, 0, 0, 0],
    ];

    let ti = [0]
    let sumti = 0;
    for (let i = 1; i < points.length; i++) {
        let di = points[i-1].dist(points[i]);
        sumti+=di;
        ti.push(sumti);
    }
    let T = ti.map(di => [Math.pow(di/sumti, 3), Math.pow(di/sumti, 2), di/sumti, 1]);
    let XY = points.map(p => [p.x, p.y]);
    let Tt = transpose(T);
    let Minv = matrix_invert(M);
    let TtTinv = matrix_invert(mmultiply(Tt, T));
    let M1 = mmultiply(mmultiply(Minv, TtTinv), Tt);
    let p = mmultiply(M1, XY);


    let err = mmultiply(mmultiply(T, M), p).map(a => new Vector(a))
    err = err.map((a, i) => a.dist(points[i])).reduce((a, b) => a+b)
    p = new CubicBezier(...p.map(v => new Vector(v)));
    p.error = err;
    return p;
}



function simple(){
    let errs = []
    let N =a.length;
    let init = 50;
    let ns = init;
    let start = 0;
    let lastp = null;
    let ps = []
    let n = init;
    let s = 0;
    while (s < N - init) {
        for (n = ns; n < N; n+=5) {
            let suba = a.slice(s, n);
            let p = fit_cubic(suba)
    
            if (p.error > 20) {
                ps.push(lastp);
                s = n-5;
                break;
            }
            lastp = p;
        }
        console.log(s);
        ns = s + 50;
    }
    let suba = a.slice(s, N);
    ps.push(fit_cubic(suba))
    
    console.log(ps);
    
    // let suba = a.slice(0, 105);
    ps.map((p, i) => {
        if (i < ps.length - 1) {
            p[3] = p[3].add(ps[i+1][0]).div(2);
            ps[i+1][0] = p[3];
        }
        let cubic = svg.createChild("path", {
        d: `M${p[0]}C${p[1]},${p[2]},${p[3]}`,
        stroke: "red",
        fill: "none"
        })
        // p.map(v => svg.createChild("circle", {r: 0.5, fill: "blue", cx: v.x, cy: v.y}))
    });
}






/**
 * @param {[Vector]} points
 * @return {[Vector]}
 */
export function find_corners(points, threshold = 2.5) {
    let n = points.length;
    let corners = [];
    corners.data = []
    let d = 0;
    let lgrad = null;
    let lquad = null;
    let goffset = 0;
    for(let i = 1; i < n; i++) {
        let last = points[i-1];

        let p = points[i];
        
        d += p.dist(last);

        let delta = p.sub(last);
        let quad = 0;
        let grad = Math.atan(Math.abs(delta.y)/Math.abs(delta.x));
        if (delta.x < 0 && delta.y >= 0) {
            grad = Math.PI - grad;
            quad = 1
        } else if (delta.x <= 0 && delta.y < 0) {
            grad += Math.PI;
            quad = 2;
        } else if (delta.y < 0 && delta.x > 0) { 
            grad = 2 * Math.PI - grad;
            quad = 3;
        }


        if (lquad == 0 && quad == 3) {
            goffset -= 2 * Math.PI;
        } else if (lquad == 3 && quad == 0) {
            goffset += 2 * Math.PI;
        }

        grad += goffset;

        if (lgrad != null) {
            if (Math.abs((grad - lgrad) * 18 / Math.PI) > threshold) {
                last.i = i - 1;
                corners.push(last);
            }
            corners.data.push((grad - lgrad) * 18 / Math.PI);
        }
    
        lquad = quad;
        lgrad = grad;
    }
    return corners;
}


export function split_segments(points) {
    let corners = find_corners(points);

    let c = corners.shift()
    console.log(c);
    let segmens = [];
    let seg = []
    for (let i = 0; i < points.length; i++) {
        console.log(c);
        if (c instanceof Vector && i == c.i) {
            seg.push(points[i]);
            segmens.push(seg);
            seg = [];
            c = corners.shift();
        }
        seg.push(points[i])
    }
    segmens.push(seg);
    return segmens;
}



export function fit_path(points) {
    if (points.length <= 3) {
        return [points];
    }

    let result = [];
    let si = 0;
    let ei = 4;
    let error = 0;
    let lastp = null;
    let p = null;
    while (ei <= points.length) {
        while (error < 5 && ei <= points.length) {
            lastp = p;
            p = fit_cubic(points.slice(si, ei));
            error = p.error;
            console.log(error);
            ei+=1;
        }
        error = 0;
        result.push(lastp);
        si = ei - 2;
        if (si + 4 > points.length) {
            result.push(points.slice(si))
            break;
        } else {
            ei = si + 4;
        }
    }
    return result;
}