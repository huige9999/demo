import fs from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

class ErrorLogFilter extends Transform {
    constructor() {
        super();
        this.leftOver = '';
    }

    _transform(chunk, encoding, callback) {
        // 1. chunk 转字符串
        const text = chunk.toString();
        // 2. 拼接 leftover
        const data = this.leftOver + text;
        // 3. 按换行符切割
        const lines = data.split('\n');
        // 4. 保存最后一个可能不完整的半行
        this.leftOver = lines.pop();
        // 5. 处理完整行，筛选 [ERROR]
        const errorLines = lines.filter(line => line.includes('[ERROR]'));
        // 6. this.push(...)
        if (errorLines.length > 0) {
            this.push(errorLines.join('\n') + '\n');
        }
        // 7. callback()
        callback();
    }

    _flush(callback) {
        // 处理最后残留的 leftover
        if (this.leftOver && this.leftOver.includes('[ERROR]')) {
            this.push(this.leftOver + '\n');
        }
        this.leftOver = '';
        callback();
    }
}


async function main() {
    const readStream = fs.createReadStream('./app.log');
    const transformStream = new ErrorLogFilter();
    const writeStream = fs.createWriteStream('./error.log');

    await pipeline(readStream, transformStream, writeStream);
}


main().catch((err) => {
    console.error(err);
});