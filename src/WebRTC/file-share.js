const MAX_CHUNKS = 1e10;
const CHUNK_HEADER_SIZE = 2 + 255 + Math.log10(MAX_CHUNKS) + Math.log10(MAX_CHUNKS) + 255;

function extractChunk(data) {
    let chunk = [];
    let str = "";
    let delimCount = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === "," && delimCount < 5) {
        chunk.push(str);
        str = "";
        delimCount ++;
      } else {
        str += data[i];
      }
    }
    chunk.push(str);
    return chunk;
}

export class ChunkSendBuffer{
    constructor(buffer, filename){
        

        // Validate filenmae
        if (typeof filename !== "string" || filename.length > 255) 
            throw new Error(typeof filename === "string" ? "The filename was greater then 255 characters long." : "The filename must be a string");
    
        // Type of file either string or array buffer
        let type = "S";
        if (buffer instanceof ArrayBuffer) {
            buffer = new Uint8Array(buffer);
            type = "A";
        } else if (typeof buffer !== "string") {
            throw new Error("The buffer is neither a string or ArrayBuffer");
        } 

        // Check for empty buffer
        if (buffer.length == 0) throw new Error("The buffer is empty")
        this.buffer = buffer;
        this.type = type;
        this.filename = filename;
    }

    reset(size){
        size = Math.round((size - CHUNK_HEADER_SIZE)*0.4);
        if (size != this.size && !this.chunks) {
            let {buffer, type} =  this;
            this.size = size;

            // Number of chunks
            let noChunks = Math.ceil(buffer.length / size);
            if (noChunks > MAX_CHUNKS) throw new Error("To many chunks");
            
            // Create string chunks
            let chunks = []
            let chunk = ""
            for (let i = 0; i < buffer.length; i++) {
                if (i % size == 0 && i != 0) {
                    chunks.push(chunk);
                    chunk = "";
                }
                chunk += type == "S" ? buffer[i] : String.fromCharCode(buffer[i]);
            }
            chunks.push(chunk);
            this.chunks = chunks;
            this.ts = new Date().getTime();
        }
        this.sent = new Array(this.length);
    }

    get progress(){
        let progress = null;
        if (this.sent) {
            progress = 0;
            for (let chunk of this.sent) {
                progress += !!chunk ? 1 : 0
            }
            progress /= this.length;
        }
        return progress;
    }

    get complete(){
        let complete = false;
        if (this.sent) {
            complete = true;
            for (let chunk of this.sent) {
                if (!chunk) {
                    complete = false;
                    break;
                }
            }
        }
        return complete;
    }

    get length(){return this.chunks.length;}

    // Get the ith serialised chunk or the next unsent chunk
    get(i = null){
        if (!this.chunks) {
            throw new Error('Chunks not created, use reset(size)')
        }

        let chunk = null;
        if (typeof i !== "number") {
            for (i = 0; i < this.length; i++) {
                if (!this.sent[i]) break;
            }
        } else if (i < 0 || i > this.length) {
            throw new Error(`No chunk at index ${i}`);
        }
        return ["F"+this.type, this.ts, this.filename, i, this.length, this.chunks[i]].join(",");
    }

    response(str) {
        let [key, index] = str.split(",");
        this.sent[parseFloat(index)] = true;
    }

}


export class ChunkReceiveBuffer{
    constructor(){
    }

    add(chunk) {
        let [key, ts, filename, index, length, buffer] = extractChunk(chunk);
        length = parseInt(length);
        index = parseInt(index);
        let type = key[1];

        if (!this.filename) this.filename = filename;
        if (!this.ts) this.ts = ts;
        if (this.length == null) this.chunks = new Array(length);
        if (!this.type) this.type = type;

        if (this.filename !== filename || this.length !== length || this.type !== type || this.ts !== ts) 
            throw new Error("This chunk is for a different file");
    
        this.chunks[index] = buffer;

        return 'R,' + index;
    }

    get length(){
        if (this.chunks) return this.chunks.length;
        else return null;
    }

    get progress(){
        let progress = null;
        if (this.chunks) {
            progress = 0;
            for (let chunk of this.chunks) {
                progress += !!chunk ? 1 : 0
            }
            progress /= this.length;
        }
        return progress;
    }

    get complete(){
        let complete = false;
        if (this.chunks) {
            complete = true;
            for (let chunk of this.chunks) {
                if (!chunk) {
                    complete = false;
                    break;
                }
            }
        }
        return complete;
    }

    get result(){
        let result = null;
        if (this.complete) {
            let {type} = this;
            let buffer = type == "S" ? "" : [];
            for (let chunk of this.chunks) {
              for (let i = 0; i < chunk.length; i++) {
                if (this.type == "S") {
                  buffer += chunk[i];
                } else {
                  buffer.push(chunk.charCodeAt(i));
                }
              }
            }
        
            // Cast to array buffer
            if (type == "A") {
              let uint8buffer = new Uint8Array(buffer);
              buffer = uint8buffer.buffer;
            }
            result = {name: this.filename, buffer: buffer};
        }
        return result;
    }
}
