import fs from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

class ErrorLogFilter extends Transform {
    constructor() {
        super();
        this.leftOver = '';
        this.timer = null;
    }

    _transform(chunk, encoding, callback) {
        const data = this.leftOver + chunk.toString();

        let index = 0;

        const pushNext = () => {
            if (index >= data.length) {
                // 全部推送完毕，通知流继续
                this.leftOver = '';
                callback();
                return;
            }

            // 每次推送 5 个字符
            this.push(data.slice(index, index + 5));
            index += 5;

            // 延迟 100ms 后推送下一组
            this.timer = setTimeout(pushNext, 100);
        };

        // 开始推送
        pushNext();
    }

    _flush(callback) {
        // 清理定时器
        if (this.timer) {
            clearTimeout(this.timer);
        }
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